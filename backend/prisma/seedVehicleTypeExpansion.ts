/**
 * seedVehicleTypeExpansion.ts — Thêm khách hàng/xe/lịch sử ra-vào mẫu cho 5 loại phương tiện mới
 * (Xe đạp điện, Xe máy điện, Ô tô điện, Xe bán tải, Xe khách) vừa được thêm vào VehicleTypes trong
 * seed.ts. `seed.ts` chỉ upsert MASTER DATA (loại xe/gói) một cách an toàn — phần khách hàng/xe/lịch
 * sử bị SKIP hoàn toàn nếu DB đã có dữ liệu, nên các loại xe mới thêm sau này không tự có dữ liệu mẫu.
 * Script này bù riêng phần đó, độc lập và không đụng tới dữ liệu 4 loại xe gốc.
 *
 * Idempotent: kiểm tra theo licensePlate (unique) — chạy lại không tạo trùng.
 * Chạy: npx ts-node prisma/seedVehicleTypeExpansion.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function addMinutes(d: Date, m: number): Date {
  return new Date(d.getTime() + m * 60_000);
}
function normalizePlate(plate: string): string {
  return plate.replace(/[-.\s]/g, '').toUpperCase();
}

async function main() {
  const now = new Date();

  // ── Khách hàng mới cho nhóm xe mở rộng ──────────────────────────────────
  const newCustomersData = [
    { fullName: 'Vũ Thị Hạnh', phone: '0901234030', email: 'hanh.vt@email.com', address: '15 Lê Duẩn, Q1', identityCard: '079203030001' },
    { fullName: 'Ngô Văn Phát', phone: '0912345031', email: 'phat.nv@email.com', address: '27 Nguyễn Trãi, Q5', identityCard: '079203030002' },
    { fullName: 'Trịnh Thị Hồng', phone: '0923456032', email: 'hong.tt@email.com', address: '39 Cộng Hòa, Tân Bình', identityCard: '079203030003' },
    { fullName: 'Đoàn Văn Kiên', phone: '0934567033', email: 'kien.dv@email.com', address: '51 Hoàng Văn Thụ, Tân Bình', identityCard: '079203030004' },
    { fullName: 'Lương Thị Yến', phone: '0945678034', email: 'yen.lt@email.com', address: '63 Trường Chinh, Q12', identityCard: '079203030005' },
  ];
  for (const c of newCustomersData) {
    const existing = await prisma.customer.findFirst({ where: { phone: c.phone } });
    if (!existing) await prisma.customer.create({ data: c });
  }
  const customers = await prisma.customer.findMany({
    where: { phone: { in: newCustomersData.map((c) => c.phone) } },
    orderBy: { id: 'asc' },
  });

  // ── VehicleTypes mở rộng (id cố định theo thứ tự khai báo trong seed.ts) ─
  const TYPE = { XE_DAP_DIEN: 5, XE_MAY_DIEN: 6, O_TO_DIEN: 7, XE_BAN_TAI: 8, XE_KHACH: 9 };

  const vehicleRows = [
    { customerId: customers[0].id, vehicleTypeId: TYPE.XE_DAP_DIEN, licensePlate: 'XDD-001', brand: 'VinFast', model: 'Klara S', color: 'Trắng' },
    { customerId: customers[1].id, vehicleTypeId: TYPE.XE_DAP_DIEN, licensePlate: 'XDD-002', brand: 'Yadea', model: 'iQ', color: 'Đen' },
    { customerId: customers[2].id, vehicleTypeId: TYPE.XE_MAY_DIEN, licensePlate: '59M1-11223', brand: 'VinFast', model: 'Feliz S', color: 'Xanh' },
    { customerId: customers[3].id, vehicleTypeId: TYPE.XE_MAY_DIEN, licensePlate: '51N2-22334', brand: 'Yadea', model: 'G5', color: 'Đỏ' },
    { customerId: customers[4].id, vehicleTypeId: TYPE.XE_MAY_DIEN, licensePlate: '59Q3-33445', brand: 'Pega', model: 'NewTech', color: 'Bạc' },
    { customerId: customers[0].id, vehicleTypeId: TYPE.O_TO_DIEN, licensePlate: '51F-11223', brand: 'VinFast', model: 'VF7', color: 'Trắng' },
    { customerId: customers[1].id, vehicleTypeId: TYPE.O_TO_DIEN, licensePlate: '59G-22334', brand: 'VinFast', model: 'VF9', color: 'Đen' },
    { customerId: customers[2].id, vehicleTypeId: TYPE.XE_BAN_TAI, licensePlate: '51H-33445', brand: 'Ford', model: 'Ranger', color: 'Xám' },
    { customerId: customers[3].id, vehicleTypeId: TYPE.XE_BAN_TAI, licensePlate: '59J-44556', brand: 'Mazda', model: 'BT-50', color: 'Trắng' },
    { customerId: customers[4].id, vehicleTypeId: TYPE.XE_KHACH, licensePlate: '51FB-5566', brand: 'Thaco', model: 'Universe', color: 'Trắng' },
    { customerId: customers[0].id, vehicleTypeId: TYPE.XE_KHACH, licensePlate: '59FC-6677', brand: 'Hyundai', model: 'Universe Noble', color: 'Xanh' },
  ];

  for (const v of vehicleRows) {
    await prisma.vehicle.upsert({
      where: { licensePlate: normalizePlate(v.licensePlate) },
      update: {},
      create: { ...v, licensePlate: normalizePlate(v.licensePlate) },
    });
  }

  const vehicles = await prisma.vehicle.findMany({
    where: { vehicleTypeId: { in: Object.values(TYPE) } },
    include: { vehicleType: { select: { hourlyRate: true, dailyRate: true } } },
  });

  // Pool chỗ đỗ theo khu — xe điện 2 bánh dùng chung Khu A (xe máy), ô tô điện/bán tải dùng chung
  // Khu B (ô tô con), xe khách dùng chung Khu C (ô tô lớn) — đúng theo category trong businessRules.ts.
  const zones = await prisma.parkingZone.findMany({ select: { id: true, name: true } });
  const zoneIdByName = new Map(zones.map((z) => [z.name, z.id]));
  const spots = await prisma.parkingSpot.findMany({ select: { id: true, zoneId: true } });
  const spotPoolByZoneId = new Map<number, number[]>();
  for (const s of spots) {
    const list = spotPoolByZoneId.get(s.zoneId);
    if (list) list.push(s.id);
    else spotPoolByZoneId.set(s.zoneId, [s.id]);
  }
  const twoWheelSpots = spotPoolByZoneId.get(zoneIdByName.get('Khu A') ?? -1) ?? [];
  const carSpots = spotPoolByZoneId.get(zoneIdByName.get('Khu B') ?? -1) ?? [];
  const largeCarSpots = spotPoolByZoneId.get(zoneIdByName.get('Khu C') ?? -1) ?? [];
  function spotPoolForType(vehicleTypeId: number): number[] {
    if (vehicleTypeId === TYPE.XE_DAP_DIEN || vehicleTypeId === TYPE.XE_MAY_DIEN) return twoWheelSpots;
    if (vehicleTypeId === TYPE.O_TO_DIEN || vehicleTypeId === TYPE.XE_BAN_TAI) return carSpots;
    return largeCarSpots;
  }

  const alreadySeeded = await prisma.parkingRecord.count({
    where: { vehicleId: { in: vehicles.map((v) => v.id) } },
  });
  if (alreadySeeded > 0) {
    console.log(`✓ Đã có ${alreadySeeded} bản ghi ra/vào cho nhóm xe mở rộng — bỏ qua bước tạo lịch sử.`);
    console.log(`✓ ${vehicles.length} xe thuộc 5 loại phương tiện mới.`);
    await prisma.$disconnect();
    return;
  }

  // ── Lịch sử ra/vào 2024 → nay cho nhóm xe mới, mật độ thấp hơn nhóm xe gốc (xe điện/pickup/xe
  // khách vốn ít phổ biến hơn xe máy/ô tô thường) nhưng đủ để biểu đồ/báo cáo không bị trống. ─────
  const userIds = [1, 1, 2, 3];
  const methods = ['cash', 'cash', 'transfer', 'card'];
  const startYear = 2024;
  let totalRecords = 0;
  let totalPayments = 0;

  const months: Array<{ year: number; month: number }> = [];
  for (let y = startYear; y <= now.getFullYear(); y++) {
    const maxM = y === now.getFullYear() ? now.getMonth() + 1 : 12;
    for (let m = 1; m <= maxM; m++) months.push({ year: y, month: m });
  }

  for (const { year, month } of months) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const isBusy = month >= 9 && month <= 11;
    const isTet = month <= 2;
    const monthlyTarget = isBusy ? randInt(10, 16) : isTet ? randInt(4, 8) : randInt(7, 13);

    const recordsBatch: any[] = [];
    for (let r = 0; r < monthlyTarget; r++) {
      const vehicle = randItem(vehicles);
      const rate = Number(vehicle.vehicleType.hourlyRate) || 5000;
      const daily = Number(vehicle.vehicleType.dailyRate) || 20000;
      const day = randInt(1, daysInMonth);
      const entryTime = new Date(year, month - 1, day, randInt(6, 21), randInt(0, 59), 0);
      if (entryTime >= now) continue;

      const durationMins = randInt(30, 480);
      const exitTime = addMinutes(entryTime, durationMins);
      if (exitTime >= now) continue;

      const hours = Math.ceil(durationMins / 60);
      const fee = Math.min(hours * rate, hours <= 24 ? daily : Math.ceil(hours / 24) * daily);

      const pool = spotPoolForType(vehicle.vehicleTypeId);
      recordsBatch.push({
        vehicleId: vehicle.id,
        licensePlate: vehicle.licensePlate,
        vehicleTypeId: vehicle.vehicleTypeId,
        parkingSpotId: pool.length > 0 ? randItem(pool) : null,
        entryTime,
        exitTime,
        duration: durationMins,
        fee,
        status: 'completed',
        createdBy: randItem(userIds),
        createdAt: entryTime,
      });
    }
    if (recordsBatch.length === 0) continue;

    await prisma.parkingRecord.createMany({ data: recordsBatch });
    totalRecords += recordsBatch.length;

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);
    const created = await prisma.parkingRecord.findMany({
      where: { entryTime: { gte: monthStart, lte: monthEnd }, vehicleId: { in: vehicles.map((v) => v.id) }, status: 'completed' },
      select: { id: true, fee: true, exitTime: true },
      orderBy: { id: 'desc' },
      take: recordsBatch.length,
    });
    if (created.length > 0) {
      await prisma.payment.createMany({
        data: created.map((rec) => ({
          parkingRecordId: rec.id,
          amount: rec.fee || 0,
          paymentMethod: randItem(methods),
          paymentType: 'parking',
          status: 'completed',
          paidAt: rec.exitTime || new Date(),
          createdBy: randItem(userIds),
        })),
      });
      totalPayments += created.length;
    }
  }

  // Một vài xe "đang đỗ" ngay bây giờ — tính TƯƠNG ĐỐI so với lúc chạy script (không cố định),
  // chỉ chọn chỗ hiện đang trống để không đè lên xe khác đang đỗ thật.
  const availableSpots = await prisma.parkingSpot.findMany({ where: { status: 'available' }, select: { id: true } });
  const availableSpotIds = new Set(availableSpots.map((s) => s.id));
  const hoursAgoEntry = (hours: number) => new Date(now.getTime() - hours * 60 * 60_000);
  const usedSpotIds: number[] = [];
  const parkedNow: any[] = [];
  for (const [i, vehicle] of vehicles.slice(0, 3).entries()) {
    const pool = spotPoolForType(vehicle.vehicleTypeId).filter((id) => availableSpotIds.has(id) && !usedSpotIds.includes(id));
    if (pool.length === 0) continue;
    const spotId = randItem(pool);
    usedSpotIds.push(spotId);
    parkedNow.push({
      vehicleId: vehicle.id,
      licensePlate: vehicle.licensePlate,
      vehicleTypeId: vehicle.vehicleTypeId,
      parkingSpotId: spotId,
      entryTime: hoursAgoEntry(randInt(1, 6) + i),
      status: 'parked',
      createdBy: randItem(userIds),
      createdAt: hoursAgoEntry(randInt(1, 6) + i),
    });
  }
  if (parkedNow.length > 0) {
    await prisma.parkingRecord.createMany({ data: parkedNow });
    await prisma.parkingSpot.updateMany({ where: { id: { in: usedSpotIds } }, data: { status: 'occupied' } });
    totalRecords += parkedNow.length;
  }

  console.log(`✓ ${vehicles.length} xe (5 loại mới), ${totalRecords} bản ghi ra/vào, ${totalPayments} thanh toán.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
