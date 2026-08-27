/**
 * seedFreshPackages.ts — Làm mới demo "Gói dịch vụ của khách hàng" theo ngày RELATIVE TO NOW mỗi
 * lần chạy — giống lý do đã xử lý với xe "đang đỗ" trong seed.ts: dữ liệu neo theo ngày cố định
 * (VD: kết thúc 07/08/2026) sẽ dần biến thành "Hết hạn hết" khi thời gian thực trôi qua, khiến
 * trang Đăng ký gói dịch vụ mở lên chỉ toàn thấy trạng thái đỏ, mất hẳn ví dụ "sắp hết hạn" (badge
 * cảnh báo "còn Nn") hay gói còn hiệu lực lâu dài.
 *
 * Xoá batch cũ (đánh dấu qua Payment.notes) rồi tạo lại quanh `now`, đảm bảo luôn có đủ 4 nhóm:
 *   - Active còn dài hạn (40-240 ngày)
 *   - Active sắp hết hạn (1-7 ngày)  -> demo badge cảnh báo + alert "Cơ hội gia hạn"
 *   - Vừa hết hạn (1-15 ngày trước)  -> demo nút "Gia hạn"
 *   - Chưa tới ngày áp dụng (2-8 ngày tới) -> trạng thái "Chưa hiệu lực"
 *
 * Idempotent: chạy lại bất kỳ lúc nào cũng an toàn (xoá batch cũ, tạo batch mới quanh "now" hiện tại).
 * Chạy: npx ts-node prisma/seedFreshPackages.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MARKER = '<<SEED_FRESH_PACKAGES>>';

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function addDays(d: Date, days: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + days);
  return c;
}
function computeStatus(startDate: Date, endDate: Date, now: Date): string {
  if (endDate < now) return 'expired';
  if (startDate > now) return 'pending';
  return 'active';
}

async function main() {
  const now = new Date();

  // ── Dọn batch cũ (nếu chạy lại) ──────────────────────────────────────────
  const oldPayments = await prisma.payment.findMany({
    where: { notes: { contains: MARKER } },
    select: { id: true, customerPackageId: true },
  });
  if (oldPayments.length > 0) {
    await prisma.payment.deleteMany({ where: { id: { in: oldPayments.map((p) => p.id) } } });
    const oldPackageIds = oldPayments.map((p) => p.customerPackageId).filter((id): id is number => id != null);
    if (oldPackageIds.length > 0) {
      await prisma.customerPackage.deleteMany({ where: { id: { in: oldPackageIds } } });
    }
    console.log(`Đã dọn ${oldPackageIds.length} gói demo cũ.`);
  }

  const [vehicles, packages, actors] = await Promise.all([
    prisma.vehicle.findMany({ select: { id: true, customerId: true, vehicleTypeId: true } }),
    prisma.parkingPackage.findMany({ where: { isActive: true }, select: { id: true, vehicleTypeId: true, price: true } }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true } }),
  ]);
  if (vehicles.length === 0 || packages.length === 0) {
    console.log('✗ Chưa có Vehicle/ParkingPackage — hãy chạy `npm run prisma:seed` trước.');
    await prisma.$disconnect();
    return;
  }
  const actorIds = actors.length > 0 ? actors.map((a) => a.id) : [1];
  const packagesByType = new Map<number, typeof packages>();
  for (const p of packages) {
    const list = packagesByType.get(p.vehicleTypeId);
    if (list) list.push(p);
    else packagesByType.set(p.vehicleTypeId, [p]);
  }

  const usedVehicleIds = new Set<number>();

  async function pickVehicleAndPackage(startDate: Date, endDate: Date) {
    const shuffled = [...vehicles].sort(() => Math.random() - 0.5);
    for (const v of shuffled) {
      if (usedVehicleIds.has(v.id)) continue;
      const opts = packagesByType.get(v.vehicleTypeId);
      if (!opts || opts.length === 0) continue;

      const overlapping = await prisma.customerPackage.findFirst({
        where: {
          vehicleId: v.id,
          status: { not: 'cancelled' },
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
        select: { id: true },
      });
      if (overlapping) continue;

      usedVehicleIds.add(v.id);
      return { vehicle: v, pkg: randItem(opts) };
    }
    return null;
  }

  type Scenario = { startDate: Date; endDate: Date };
  const scenarios: Scenario[] = [];

  // Active còn dài hạn
  for (let i = 0; i < 6; i++) {
    const endDate = addDays(now, randInt(40, 240));
    const startDate = addDays(endDate, -randInt(30, 365));
    scenarios.push({ startDate, endDate });
  }
  // Active sắp hết hạn — feed badge cảnh báo + alert "Cơ hội gia hạn"
  for (let i = 0; i < 5; i++) {
    const endDate = addDays(now, randInt(1, 7));
    const startDate = addDays(endDate, -randInt(30, 365));
    scenarios.push({ startDate, endDate });
  }
  // Vừa hết hạn gần đây — demo nút "Gia hạn"
  for (let i = 0; i < 4; i++) {
    const endDate = addDays(now, -randInt(1, 15));
    const startDate = addDays(endDate, -randInt(30, 365));
    scenarios.push({ startDate, endDate });
  }
  // Chưa tới ngày áp dụng
  for (let i = 0; i < 2; i++) {
    const startDate = addDays(now, randInt(2, 8));
    const endDate = addDays(startDate, randInt(30, 90));
    scenarios.push({ startDate, endDate });
  }

  let created = 0;
  for (const s of scenarios) {
    const picked = await pickVehicleAndPackage(s.startDate, s.endDate);
    if (!picked) continue;

    const status = computeStatus(s.startDate, s.endDate, now);
    const customerPackage = await prisma.customerPackage.create({
      data: {
        customerId: picked.vehicle.customerId,
        packageId: picked.pkg.id,
        vehicleId: picked.vehicle.id,
        startDate: s.startDate,
        endDate: s.endDate,
        status,
      },
    });

    await prisma.payment.create({
      data: {
        customerPackageId: customerPackage.id,
        amount: picked.pkg.price,
        paymentMethod: randItem(['cash', 'transfer', 'card']),
        paymentType: 'package',
        status: 'completed',
        paidAt: s.startDate < now ? s.startDate : now,
        createdBy: randItem(actorIds),
        notes: `${MARKER} package payment`,
      },
    });
    created += 1;
  }

  console.log(`✓ Đã tạo ${created}/${scenarios.length} gói demo quanh thời điểm hiện tại (${now.toISOString().slice(0, 10)}).`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
