/**
 * seedExceptionCheckouts.ts — Bổ sung dữ liệu mẫu cho "Checkout ngoại lệ" (mất vé, vé hỏng,
 * giải phóng chỗ bắt buộc, miễn giảm phí, lý do khác) để trang Báo cáo → Thống kê Checkout
 * ngoại lệ có dữ liệu minh hoạ thay vì trống trơn.
 *
 * Idempotent: đánh dấu bằng note `[SEED_EXCEPTION_DEMO]` — chạy lại sẽ không tạo trùng nếu đã
 * có sẵn (kiểm tra count trước khi thêm).
 *
 * Chạy: npx ts-node prisma/seedExceptionCheckouts.ts
 */
import { PrismaClient } from '@prisma/client';
import { calculateParkingFee } from '../src/utils/feeCalculator';

const prisma = new PrismaClient();

// Không dùng dấu ngoặc vuông trong marker — SQL Server LIKE coi [ ] là ký tự đại diện
// character-class, khiến Prisma `contains` khớp nhầm hàng loạt bản ghi không liên quan.
const SEED_MARK = '<<SEED_EXCEPTION_DEMO>>';
const TARGET_COUNT = 16;

const REASON_LABEL: Record<string, string> = {
  lost_ticket: 'Mất vé / mất phiếu',
  damaged_ticket: 'Vé hỏng / không quét được',
  force_release: 'Giải phóng chỗ bắt buộc',
  fee_waiver: 'Miễn giảm phí (ngoại lệ)',
  other: 'Lý do khác',
};
const REASONS = Object.keys(REASON_LABEL);

const CUSTOM_NOTES: Record<string, string[]> = {
  lost_ticket: ['Khách báo mất vé giấy tại quầy', 'Không tìm thấy vé sau khi tìm trong xe'],
  damaged_ticket: ['Vé bị ướt mưa không quét được', 'Mã vạch trầy xước không đọc được'],
  force_release: ['Xe hỏng máy cần kéo đi, giải phóng chỗ gấp', 'Khách yêu cầu đổi chỗ khẩn'],
  fee_waiver: ['Khách VIP, miễn phí theo chính sách', 'Xe của ban quản lý toà nhà'],
  other: ['Nhân viên xác nhận qua camera an ninh', 'Đối soát thủ công với bảo vệ ca trước'],
};

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  const existing = await prisma.parkingRecord.count({
    where: { notes: { contains: SEED_MARK } },
  });
  if (existing >= TARGET_COUNT) {
    console.log(`Đã có ${existing} bản ghi checkout ngoại lệ mẫu — không cần thêm.`);
    return;
  }
  const toCreate = TARGET_COUNT - existing;

  const vehicles = await prisma.vehicle.findMany({
    include: { vehicleType: { select: { id: true, hourlyRate: true, dailyRate: true } } },
  });
  const spots = await prisma.parkingSpot.findMany({ select: { id: true } });
  const users = await prisma.user.findMany({ select: { id: true } });
  if (vehicles.length === 0 || users.length === 0) {
    console.error('Chưa có dữ liệu xe/người dùng — chạy `npm run prisma:seed` trước.');
    return;
  }
  const userIds = users.map((u) => u.id);
  const methods = ['cash', 'card', 'transfer'];

  const now = new Date();
  let created = 0;

  for (let i = 0; i < toCreate; i++) {
    const vehicle = randItem(vehicles);
    const reason = randItem(REASONS);
    const spot = spots.length > 0 ? randItem(spots) : null;

    // Trải đều trong ~8 tháng gần nhất để khớp khung "Chi tiết doanh thu (8 kỳ)" ở Báo cáo.
    const daysAgo = randInt(1, 240);
    const durationMinutes = randInt(30, 8 * 60);
    const exitTime = new Date(now.getTime() - daysAgo * 86_400_000 - randInt(0, 12) * 3600_000);
    const entryTime = new Date(exitTime.getTime() - durationMinutes * 60_000);
    if (entryTime >= now || exitTime >= now) continue;

    const calc = calculateParkingFee(
      durationMinutes * 60_000,
      { hourlyRate: Number(vehicle.vehicleType.hourlyRate), dailyRate: Number(vehicle.vehicleType.dailyRate) }
    );
    // fee_waiver luôn miễn phí; các lý do khác ~40% được miễn theo quyết định nhân viên trực.
    const fee = reason === 'fee_waiver' || Math.random() < 0.4 ? 0 : calc.fee;

    const customNote = randItem(CUSTOM_NOTES[reason]);
    const notes = `[NGOAI_LE:${reason}] ${REASON_LABEL[reason]} — ${customNote} ${SEED_MARK}`;
    const createdBy = randItem(userIds);

    const record = await prisma.parkingRecord.create({
      data: {
        vehicleId: vehicle.id,
        licensePlate: vehicle.licensePlate,
        vehicleTypeId: vehicle.vehicleTypeId,
        parkingSpotId: spot?.id ?? null,
        entryTime,
        exitTime,
        duration: calc.durationMinutes,
        fee,
        status: 'completed',
        notes,
        createdBy,
        createdAt: entryTime,
      },
    });

    if (fee > 0) {
      await prisma.payment.create({
        data: {
          parkingRecordId: record.id,
          amount: fee,
          paymentMethod: randItem(methods),
          paymentType: 'parking',
          status: 'completed',
          paidAt: exitTime,
          createdBy,
          notes: `Checkout ngoại lệ: ${REASON_LABEL[reason]}`,
        },
      });
    }
    created++;
  }

  console.log(`Đã tạo ${created} bản ghi checkout ngoại lệ mẫu (tổng cộng ${existing + created}).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
