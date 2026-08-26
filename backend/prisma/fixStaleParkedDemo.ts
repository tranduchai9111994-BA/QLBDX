/**
 * fixStaleParkedDemo.ts — Sửa dữ liệu demo "xe đang đỗ" bị coi là đỗ hàng trăm giờ.
 *
 * Nguyên nhân: seedHistoricalData.ts thêm 1 lô "xe đang đỗ hôm nay" (entryTime = new Date()
 * tại thời điểm chạy) mỗi lần được chạy lại, nhưng không bao giờ tự "cho xe ra" lô cũ — nên
 * sau nhiều lần seed cách nhau vài tuần, các lô cũ càng lúc càng "già" (25 ngày, 50 ngày...)
 * dù trông như mới ghi nhận sáng nay.
 *
 * Script này: cho phần lớn xe đang đỗ "ra" với thời gian hợp lý (hoàn tất + có Payment tương
 * ứng), chỉ giữ lại vài xe thật sự đang đỗ với giờ vào gần đây — trong đó 1-2 xe cố tình để
 * quá ngưỡng cấu hình (Cảnh báo → Cấu hình mức độ) để minh hoạ cảnh báo "Xe đỗ quá lâu" hoạt
 * động đúng, thay vì im lặng biến mất.
 *
 * Chạy: npx ts-node prisma/fixStaleParkedDemo.ts
 * Idempotent theo nghĩa an toàn chạy lại — nếu không còn bản ghi 'parked' nào cũ thì không làm gì.
 */
import { PrismaClient } from '@prisma/client';
import { calculateParkingFee } from '../src/utils/feeCalculator';

const prisma = new PrismaClient();

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  const now = new Date();
  const STALE_HOURS = 20; // đang đỗ quá 20h coi là "lô cũ" cần dọn (xe thường ra trong ngày)

  const parkedRecords = await prisma.parkingRecord.findMany({
    where: { status: 'parked' },
    include: { vehicleType: { select: { hourlyRate: true, dailyRate: true } } },
    orderBy: { entryTime: 'desc' },
  });

  const staleRecords = parkedRecords.filter(
    (r) => (now.getTime() - new Date(r.entryTime).getTime()) / 3600000 > STALE_HOURS
  );

  if (staleRecords.length === 0) {
    console.log('Không có xe "đang đỗ" nào bị coi là dữ liệu cũ — không cần sửa.');
    return;
  }

  console.log(`Tìm thấy ${staleRecords.length} xe "đang đỗ" nhưng thực chất là dữ liệu demo cũ.`);

  // Giữ lại tối đa 5 xe làm "đang đỗ thật" — phần còn lại cho ra (completed).
  const KEEP_PARKED = Math.min(5, staleRecords.length);
  const toKeepParked = staleRecords.slice(0, KEEP_PARKED);
  const toComplete = staleRecords.slice(KEEP_PARKED);

  const users = await prisma.user.findMany({ select: { id: true } });
  const userIds = users.map((u) => u.id);
  const methods = ['cash', 'card', 'transfer'];

  // --- Nhóm giữ lại "đang đỗ": đặt giờ vào gần đây, thực tế ---
  // Đa số trong ngày (0-15h trước); 1-2 xe cố tình vượt ngưỡng cảnh báo để demo hoạt động đúng.
  for (let i = 0; i < toKeepParked.length; i++) {
    const record = toKeepParked[i];
    let hoursAgo: number;
    if (i === 0) hoursAgo = 50; // vượt mốc "nguy hiểm" (>=48h) nếu đã cấu hình
    else if (i === 1) hoursAgo = 30; // vượt mốc "cảnh báo" (>=24h)
    else hoursAgo = randInt(0, 15); // bình thường, trong ngày

    const newEntryTime = new Date(now.getTime() - hoursAgo * 3600000);
    await prisma.parkingRecord.update({
      where: { id: record.id },
      data: { entryTime: newEntryTime, createdAt: newEntryTime },
    });
  }
  console.log(`Đã cập nhật ${toKeepParked.length} xe đang đỗ về giờ vào hợp lý (2 xe cố tình đỗ lâu để demo cảnh báo).`);

  // --- Nhóm cho ra: hoàn tất record + tạo Payment tương ứng ---
  let completedCount = 0;
  for (const record of toComplete) {
    const hoursAgo = randInt(1, 18); // xe này đã "ra" cách đây 1-18h, đỗ trong khoảng hợp lý
    const durationMinutes = randInt(20, 8 * 60); // 20 phút tới 8 tiếng
    const exitTime = new Date(now.getTime() - hoursAgo * 3600000);
    const entryTime = new Date(exitTime.getTime() - durationMinutes * 60000);
    if (entryTime >= now) continue;

    const calc = calculateParkingFee(
      durationMinutes * 60000,
      {
        hourlyRate: Number(record.hourlyRateApplied ?? record.vehicleType.hourlyRate),
        dailyRate: Number(record.dailyRateApplied ?? record.vehicleType.dailyRate),
      }
    );

    await prisma.parkingRecord.update({
      where: { id: record.id },
      data: {
        entryTime,
        exitTime,
        duration: calc.durationMinutes,
        fee: calc.fee,
        status: 'completed',
        createdAt: entryTime,
      },
    });

    if (calc.fee > 0) {
      await prisma.payment.create({
        data: {
          parkingRecordId: record.id,
          amount: calc.fee,
          paymentMethod: randItem(methods),
          paymentType: 'parking',
          status: 'completed',
          paidAt: exitTime,
          createdBy: randItem(userIds),
          notes: '[FIX_STALE_DEMO] auto-completed từ dữ liệu demo cũ',
        },
      });
    }
    completedCount++;
  }
  console.log(`Đã cho ${completedCount} xe "ra" với thời gian đỗ hợp lý (kèm Payment tương ứng).`);

  // --- Đồng bộ lại trạng thái chỗ đỗ theo parkingRecord còn 'parked' ---
  const stillParked = await prisma.parkingRecord.findMany({
    where: { status: 'parked', parkingSpotId: { not: null } },
    select: { parkingSpotId: true },
  });
  const occupiedIds = Array.from(new Set(stillParked.map((r) => r.parkingSpotId).filter(Boolean))) as number[];
  await prisma.parkingSpot.updateMany({
    where: { status: { not: 'maintenance' } },
    data: { status: 'available' },
  });
  if (occupiedIds.length > 0) {
    await prisma.parkingSpot.updateMany({
      where: { id: { in: occupiedIds } },
      data: { status: 'occupied' },
    });
  }
  console.log(`Đã đồng bộ trạng thái chỗ đỗ — ${occupiedIds.length} chỗ đang occupied.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
