import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

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
function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}
function endOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy;
}
function atDate(year: number, month: number, day: number, hour: number, minute = 0): Date {
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}
function normalizePlate(plate: string): string {
  return plate.replace(/[-.\s]/g, '').toUpperCase();
}

// ──────────────────────────────────────
// MASTER DATA
// ──────────────────────────────────────
async function seedMasterData() {
  const hp = await bcrypt.hash('admin123', 10);
  const hs = await bcrypt.hash('staff123', 10);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash: hp, fullName: 'Quản trị viên', email: 'admin@parking.com', role: 'admin', isActive: true },
    create: { username: 'admin', passwordHash: hp, fullName: 'Quản trị viên', email: 'admin@parking.com', role: 'admin' },
  });
  await prisma.user.upsert({
    where: { username: 'nhanvien1' },
    update: { passwordHash: hs, fullName: 'Nguyễn Văn An', email: 'nv1@parking.com', role: 'staff', isActive: true },
    create: { username: 'nhanvien1', passwordHash: hs, fullName: 'Nguyễn Văn An', email: 'nv1@parking.com', role: 'staff' },
  });
  await prisma.user.upsert({
    where: { username: 'nhanvien2' },
    update: { passwordHash: hs, fullName: 'Trần Thị Bích', email: 'nv2@parking.com', role: 'staff', isActive: true },
    create: { username: 'nhanvien2', passwordHash: hs, fullName: 'Trần Thị Bích', email: 'nv2@parking.com', role: 'staff' },
  });

  for (const [i, vt] of [
    { name: 'Xe máy', description: 'Xe máy, xe gắn máy', hourlyRate: 5000, dailyRate: 20000, monthlyRate: 200000 },
    { name: 'Ô tô con', description: 'Ô tô dưới 9 chỗ', hourlyRate: 20000, dailyRate: 100000, monthlyRate: 1500000 },
    { name: 'Ô tô lớn', description: 'Ô tô từ 9 chỗ trở lên, xe tải', hourlyRate: 30000, dailyRate: 150000, monthlyRate: 2500000 },
    { name: 'Xe đạp', description: 'Xe đạp các loại', hourlyRate: 2000, dailyRate: 10000, monthlyRate: 100000 },
  ].entries()) {
    await prisma.vehicleType.upsert({ where: { id: i + 1 }, update: {}, create: vt });
  }

  for (const [i, z] of [
    { name: 'Khu A', description: 'Khu vực xe máy', totalSpots: 50 },
    { name: 'Khu B', description: 'Khu vực ô tô con', totalSpots: 30 },
    { name: 'Khu C', description: 'Khu vực ô tô lớn', totalSpots: 20 },
    { name: 'Khu D', description: 'Khu vực VIP', totalSpots: 10 },
  ].entries()) {
    await prisma.parkingZone.upsert({ where: { id: i + 1 }, update: {}, create: z });
  }

  const spotConfigs = [
    { zoneId: 1, prefix: 'A', count: 50, type: 'standard' },
    { zoneId: 2, prefix: 'B', count: 30, type: 'standard' },
    { zoneId: 3, prefix: 'C', count: 20, type: 'standard' },
    { zoneId: 4, prefix: 'D', count: 10, type: 'vip' },
  ];
  for (const cfg of spotConfigs) {
    for (let i = 1; i <= cfg.count; i++) {
      const sn = `${cfg.prefix}${String(i).padStart(2, '0')}`;
      await prisma.parkingSpot.upsert({
        where: { zoneId_spotNumber: { zoneId: cfg.zoneId, spotNumber: sn } },
        update: {},
        create: { zoneId: cfg.zoneId, spotNumber: sn, spotType: cfg.type },
      });
    }
  }

  for (const [i, pkg] of [
    { name: 'Vé tháng xe máy', vehicleTypeId: 1, durationDays: 30, price: 200000, description: 'Gói gửi xe máy theo tháng' },
    { name: 'Vé quý xe máy', vehicleTypeId: 1, durationDays: 90, price: 550000, description: 'Gói gửi xe máy theo quý' },
    { name: 'Vé năm xe máy', vehicleTypeId: 1, durationDays: 365, price: 2000000, description: 'Gói gửi xe máy theo năm' },
    { name: 'Vé tháng ô tô con', vehicleTypeId: 2, durationDays: 30, price: 1500000, description: 'Gói gửi ô tô con theo tháng' },
    { name: 'Vé quý ô tô con', vehicleTypeId: 2, durationDays: 90, price: 4000000, description: 'Gói gửi ô tô con theo quý' },
    { name: 'Vé năm ô tô con', vehicleTypeId: 2, durationDays: 365, price: 15000000, description: 'Gói gửi ô tô con theo năm' },
    { name: 'Vé tháng ô tô lớn', vehicleTypeId: 3, durationDays: 30, price: 2500000, description: 'Gói gửi ô tô lớn theo tháng' },
    { name: 'Vé tháng xe đạp', vehicleTypeId: 4, durationDays: 30, price: 100000, description: 'Gói gửi xe đạp theo tháng' },
  ].entries()) {
    await prisma.parkingPackage.upsert({ where: { id: i + 1 }, update: {}, create: pkg });
  }

  console.log('✓ Master data done');
}

// ──────────────────────────────────────
// CUSTOMERS & VEHICLES
// ──────────────────────────────────────
async function seedCustomersAndVehicles() {
  const existing = await prisma.customer.count();
  if (existing > 0) {
    console.log(`✓ Skip customers/vehicles (${existing} customers already exist)`);
    const vehicles = await prisma.vehicle.findMany({ select: { id: true, vehicleTypeId: true, licensePlate: true } });
    return vehicles;
  }

  const customers = await prisma.customer.createMany({
    data: [
      { fullName: 'Nguyễn Văn Hùng', phone: '0901234001', email: 'hung.nv@email.com', address: '12 Lý Thường Kiệt, Q1', identityCard: '079201001234' },
      { fullName: 'Trần Thị Mai', phone: '0912345002', email: 'mai.tt@email.com', address: '45 Nguyễn Huệ, Q1', identityCard: '079202002345' },
      { fullName: 'Lê Văn Đức', phone: '0923456003', email: 'duc.lv@email.com', address: '78 Lê Lợi, Q1', identityCard: '079201003456' },
      { fullName: 'Phạm Thị Lan', phone: '0934567004', email: 'lan.pt@email.com', address: '90 Trần Hưng Đạo, Q5', identityCard: '079202004567' },
      { fullName: 'Hoàng Văn Minh', phone: '0945678005', email: 'minh.hv@email.com', address: '23 Cách Mạng Tháng 8, Q3', identityCard: '079201005678' },
      { fullName: 'Nguyễn Thị Hoa', phone: '0956789006', email: 'hoa.nt@email.com', address: '56 Điện Biên Phủ, BT', identityCard: '079202006789' },
      { fullName: 'Võ Văn Long', phone: '0967890007', email: 'long.vv@email.com', address: '34 Nguyễn Đình Chiểu, Q3', identityCard: '079201007890' },
      { fullName: 'Đặng Thị Thu', phone: '0978901008', email: 'thu.dt@email.com', address: '67 Hai Bà Trưng, Q1', identityCard: '079202008901' },
      { fullName: 'Bùi Văn Cường', phone: '0989012009', email: 'cuong.bv@email.com', address: '89 Pasteur, Q1', identityCard: '079201009012' },
      { fullName: 'Đỗ Thị Nga', phone: '0990123010', email: 'nga.dt@email.com', address: '12 Nam Kỳ Khởi Nghĩa, Q3', identityCard: '079202010123' },
      { fullName: 'Trần Văn Khánh', phone: '0901234011', email: 'khanh.tv@email.com', address: '45 Võ Văn Tần, Q3', identityCard: '079201011234' },
      { fullName: 'Lê Thị Phương', phone: '0912345012', email: 'phuong.lt@email.com', address: '78 Ba Tháng Hai, Q10', identityCard: '079202012345' },
      { fullName: 'Phan Văn Toàn', phone: '0923456013', email: 'toan.pv@email.com', address: '90 Lý Tự Trọng, Q1', identityCard: '079201013456' },
      { fullName: 'Nguyễn Thị Thủy', phone: '0934567014', email: 'thuy.nt@email.com', address: '23 Nguyễn Thị Minh Khai, Q1', identityCard: '079202014567' },
      { fullName: 'Cao Văn Bình', phone: '0945678015', email: 'binh.cv@email.com', address: '56 Trương Định, Q3', identityCard: '079201015678' },
      { fullName: 'Lý Thị Kim', phone: '0956789016', email: 'kim.lt@email.com', address: '34 Phạm Ngũ Lão, Q1', identityCard: '079202016789' },
      { fullName: 'Nguyễn Văn Tùng', phone: '0967890017', email: 'tung.nv2@email.com', address: '67 Bùi Viện, Q1', identityCard: '079201017890' },
      { fullName: 'Trần Thị Loan', phone: '0978901018', email: 'loan.tt@email.com', address: '89 Đề Thám, Q1', identityCard: '079202018901' },
      { fullName: 'Đinh Văn Nghĩa', phone: '0989012019', email: 'nghia.dv@email.com', address: '12 Cống Quỳnh, Q1', identityCard: '079201019012' },
      { fullName: 'Võ Thị Xuân', phone: '0990123020', email: 'xuan.vt@email.com', address: '45 Nguyễn Cư Trinh, Q1', identityCard: '079202020123' },
      { fullName: 'Nguyễn Hoàng Nam', phone: '0901234021', email: 'nam.nh@email.com', address: '78 Nguyễn Trãi, Q1', identityCard: '079201021234' },
      { fullName: 'Trần Văn Quang', phone: '0912345022', email: 'quang.tv2@email.com', address: '90 Hàm Nghi, Q1', identityCard: '079201022345' },
      { fullName: 'Lê Thị Dung', phone: '0923456023', email: 'dung.lt@email.com', address: '23 Nguyễn Hữu Cảnh, BT', identityCard: '079202023456' },
      { fullName: 'Phạm Văn Lộc', phone: '0934567024', email: 'loc.pv@email.com', address: '56 Đoàn Văn Bơ, Q4', identityCard: '079201024567' },
      { fullName: 'Hoàng Thị Nhung', phone: '0945678025', email: 'nhung.ht@email.com', address: '34 Tôn Thất Thuyết, Q4', identityCard: '079202025678' },
    ],
  });

  const allCustomers = await prisma.customer.findMany({ orderBy: { id: 'asc' } });

  // Vehicles: spread across vehicle types, use customer IDs
  const vehicleRows = [
    // Xe máy (vehicleTypeId=1) – 15 vehicles
    { customerId: allCustomers[0].id, vehicleTypeId: 1, licensePlate: '59B1-12345', brand: 'Honda', model: 'Wave Alpha', color: 'Xanh' },
    { customerId: allCustomers[1].id, vehicleTypeId: 1, licensePlate: '51G3-45678', brand: 'Yamaha', model: 'Exciter', color: 'Đen' },
    { customerId: allCustomers[2].id, vehicleTypeId: 1, licensePlate: '59P2-78901', brand: 'Honda', model: 'Air Blade', color: 'Bạc' },
    { customerId: allCustomers[3].id, vehicleTypeId: 1, licensePlate: '51H4-23456', brand: 'Honda', model: 'SH', color: 'Đỏ' },
    { customerId: allCustomers[4].id, vehicleTypeId: 1, licensePlate: '59N1-56789', brand: 'Yamaha', model: 'Nouvo', color: 'Trắng' },
    { customerId: allCustomers[5].id, vehicleTypeId: 1, licensePlate: '51K2-89012', brand: 'Suzuki', model: 'Satria', color: 'Xanh' },
    { customerId: allCustomers[6].id, vehicleTypeId: 1, licensePlate: '59C3-34567', brand: 'Honda', model: 'Vision', color: 'Vàng' },
    { customerId: allCustomers[7].id, vehicleTypeId: 1, licensePlate: '51D4-67890', brand: 'Piaggio', model: 'Liberty', color: 'Trắng' },
    { customerId: allCustomers[8].id, vehicleTypeId: 1, licensePlate: '59E1-12340', brand: 'Kymco', model: 'Like', color: 'Hồng' },
    { customerId: allCustomers[9].id, vehicleTypeId: 1, licensePlate: '51F2-45671', brand: 'Honda', model: 'Lead', color: 'Đen' },
    { customerId: allCustomers[10].id, vehicleTypeId: 1, licensePlate: '59L3-78902', brand: 'Yamaha', model: 'Sirius', color: 'Đỏ' },
    { customerId: allCustomers[11].id, vehicleTypeId: 1, licensePlate: '51M4-23463', brand: 'Honda', model: 'Future', color: 'Bạc' },
    { customerId: allCustomers[12].id, vehicleTypeId: 1, licensePlate: '59R1-56784', brand: 'Suzuki', model: 'Smash', color: 'Xanh' },
    { customerId: allCustomers[13].id, vehicleTypeId: 1, licensePlate: '51S2-89015', brand: 'Honda', model: 'Winner X', color: 'Đen' },
    { customerId: allCustomers[14].id, vehicleTypeId: 1, licensePlate: '59T3-34566', brand: 'Yamaha', model: 'Grande', color: 'Trắng' },
    // Ô tô con (vehicleTypeId=2) – 10 vehicles
    { customerId: allCustomers[0].id, vehicleTypeId: 2, licensePlate: '51A-12345', brand: 'Toyota', model: 'Vios', color: 'Trắng' },
    { customerId: allCustomers[2].id, vehicleTypeId: 2, licensePlate: '59A-23456', brand: 'Honda', model: 'City', color: 'Bạc' },
    { customerId: allCustomers[4].id, vehicleTypeId: 2, licensePlate: '51B-34567', brand: 'Mazda', model: 'CX-5', color: 'Đen' },
    { customerId: allCustomers[6].id, vehicleTypeId: 2, licensePlate: '59B-45678', brand: 'Hyundai', model: 'Accent', color: 'Đỏ' },
    { customerId: allCustomers[8].id, vehicleTypeId: 2, licensePlate: '51C-56789', brand: 'Kia', model: 'Morning', color: 'Trắng' },
    { customerId: allCustomers[15].id, vehicleTypeId: 2, licensePlate: '59C-67890', brand: 'Toyota', model: 'Fortuner', color: 'Đen' },
    { customerId: allCustomers[16].id, vehicleTypeId: 2, licensePlate: '51D-78901', brand: 'Ford', model: 'EcoSport', color: 'Bạc' },
    { customerId: allCustomers[17].id, vehicleTypeId: 2, licensePlate: '59D-89012', brand: 'VinFast', model: 'VF8', color: 'Xanh' },
    { customerId: allCustomers[18].id, vehicleTypeId: 2, licensePlate: '51E-90123', brand: 'Mitsubishi', model: 'Xpander', color: 'Trắng' },
    { customerId: allCustomers[19].id, vehicleTypeId: 2, licensePlate: '59E-01234', brand: 'Toyota', model: 'Camry', color: 'Đen' },
    // Ô tô lớn (vehicleTypeId=3) – 3 vehicles
    { customerId: allCustomers[20].id, vehicleTypeId: 3, licensePlate: '51FA-1234', brand: 'Hyundai', model: 'County', color: 'Vàng' },
    { customerId: allCustomers[21].id, vehicleTypeId: 3, licensePlate: '59FA-2345', brand: 'Toyota', model: 'Coaster', color: 'Trắng' },
    { customerId: allCustomers[22].id, vehicleTypeId: 3, licensePlate: '51H-01234', brand: 'Isuzu', model: 'NPR', color: 'Xanh' },
    // Xe đạp (vehicleTypeId=4) – 2 vehicles
    { customerId: allCustomers[23].id, vehicleTypeId: 4, licensePlate: 'XD-001', brand: 'Giant', model: 'ATX', color: 'Đỏ' },
    { customerId: allCustomers[24].id, vehicleTypeId: 4, licensePlate: 'XD-002', brand: 'Trek', model: 'FX3', color: 'Đen' },
  ];

  for (const v of vehicleRows) {
    await prisma.vehicle.upsert({
      where: { licensePlate: normalizePlate(v.licensePlate) },
      update: {},
      create: { ...v, licensePlate: normalizePlate(v.licensePlate) },
    });
  }

  const vehicles = await prisma.vehicle.findMany({ select: { id: true, vehicleTypeId: true, licensePlate: true } });
  console.log(`✓ ${customers.count} customers, ${vehicles.length} vehicles created`);
  return vehicles;
}

// ──────────────────────────────────────
// PARKING RECORDS + PAYMENTS (monthly batches)
// ──────────────────────────────────────
async function seedParkingHistory(vehicles: { id: number; vehicleTypeId: number; licensePlate: string }[]) {
  const existing = await prisma.parkingRecord.count();
  if (existing > 0) {
    console.log(`✓ Skip parking records (${existing} records already exist)`);
    return;
  }

  // Spots by zone: Khu A(1-50), Khu B(51-80), Khu C(81-100), Khu D(101-110)
  // Map vehicle type -> spot range (approximate zone assignment)
  function getSpotId(vehicleTypeId: number): number {
    if (vehicleTypeId === 1) return randInt(1, 50);   // Xe máy -> Khu A
    if (vehicleTypeId === 2) return randInt(51, 80);  // Ô tô con -> Khu B
    if (vehicleTypeId === 3) return randInt(81, 100); // Ô tô lớn -> Khu C
    return randInt(1, 50);                            // Xe đạp -> Khu A
  }

  const hourlyRate: Record<number, number> = { 1: 5000, 2: 20000, 3: 30000, 4: 2000 };
  const methods = ['cash', 'cash', 'cash', 'transfer', 'card'];
  const userIds = [1, 1, 2, 3];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Jan 2024 → tháng hiện tại
  const now = new Date();
  const months: Array<{ year: number; month: number }> = [];
  for (let y = 2024; y <= now.getFullYear(); y++) {
    const maxM = y === now.getFullYear() ? now.getMonth() + 1 : 12;
    for (let m = 1; m <= maxM; m++) {
      months.push({ year: y, month: m });
    }
  }

  let totalRecords = 0;
  let totalPayments = 0;

  for (const { year, month } of months) {
    const daysInMonth = new Date(year, month, 0).getDate();

    // ~40 completed records per month + seasonal variation
    const isBusy = month >= 9 && month <= 11; // Sep-Nov busier
    const isTet = month <= 2;                  // Jan-Feb quieter
    const monthlyTarget = isBusy ? randInt(55, 70) : isTet ? randInt(20, 35) : randInt(40, 55);

    const recordsBatch: any[] = [];

    for (let r = 0; r < monthlyTarget; r++) {
      const vehicle = randItem(vehicles);
      const rate = hourlyRate[vehicle.vehicleTypeId] || 5000;
      const day = randInt(1, daysInMonth);
      const entryHour = randInt(6, 21);
      const entryMin = randInt(0, 59);
      const entryTime = new Date(year, month - 1, day, entryHour, entryMin, 0);

      if (entryTime >= today) continue; // no future records

      const durationMins = randInt(30, 480);
      const exitTime = addMinutes(entryTime, durationMins);
      if (exitTime >= today) continue;

      const hours = Math.ceil(durationMins / 60);
      const fee = hours * rate;

      recordsBatch.push({
        vehicleId: vehicle.id,
        licensePlate: vehicle.licensePlate,
        vehicleTypeId: vehicle.vehicleTypeId,
        parkingSpotId: getSpotId(vehicle.vehicleTypeId),
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

    // Bulk insert records for this month
    await prisma.parkingRecord.createMany({ data: recordsBatch });
    totalRecords += recordsBatch.length;

    // Fetch back the created records for this month to link payments
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);
    const created = await prisma.parkingRecord.findMany({
      where: { entryTime: { gte: monthStart, lte: monthEnd }, status: 'completed' },
      select: { id: true, fee: true, exitTime: true },
    });

    // Only create payments if not already created
    const existingPayments = await prisma.payment.count({
      where: { paidAt: { gte: monthStart, lte: monthEnd }, paymentType: 'parking' },
    });
    if (existingPayments === 0 && created.length > 0) {
      const paymentsBatch = created.map((rec) => ({
        parkingRecordId: rec.id,
        amount: rec.fee || 0,
        paymentMethod: randItem(methods),
        paymentType: 'parking',
        status: 'completed',
        paidAt: rec.exitTime || new Date(),
        createdBy: randItem(userIds),
      }));
      await prisma.payment.createMany({ data: paymentsBatch });
      totalPayments += paymentsBatch.length;
    }
  }

  // Add currently-parked vehicles (today)
  const todayParked: any[] = [];
  const usedSpotIds = new Set<number>();
  for (let i = 0; i < randInt(8, 18); i++) {
    const vehicle = randItem(vehicles);
    const entryHour = randInt(6, 10);
    const entryTime = new Date();
    entryTime.setHours(entryHour, randInt(0, 59), 0, 0);
    let parkingSpotId = getSpotId(vehicle.vehicleTypeId);
    while (usedSpotIds.has(parkingSpotId)) {
      parkingSpotId = getSpotId(vehicle.vehicleTypeId);
    }
    usedSpotIds.add(parkingSpotId);
    todayParked.push({
      vehicleId: vehicle.id,
      licensePlate: vehicle.licensePlate,
      vehicleTypeId: vehicle.vehicleTypeId,
      parkingSpotId,
      entryTime,
      status: 'parked',
      createdBy: randItem(userIds),
      createdAt: entryTime,
    });
  }
  if (todayParked.length > 0) {
    await prisma.parkingRecord.createMany({ data: todayParked });
    await prisma.parkingSpot.updateMany({
      where: { id: { in: Array.from(usedSpotIds) } },
      data: { status: 'occupied' },
    });

    const maintenanceSpots = [5, 55, 105].filter((spotId) => !usedSpotIds.has(spotId));
    if (maintenanceSpots.length > 0) {
      await prisma.parkingSpot.updateMany({
        where: { id: { in: maintenanceSpots } },
        data: { status: 'maintenance' },
      });
    }
    totalRecords += todayParked.length;
  }

  console.log(`✓ ${totalRecords} parking records, ${totalPayments} payments seeded`);
}

// ──────────────────────────────────────
// CUSTOMER PACKAGES
// ──────────────────────────────────────
async function seedCustomerPackages(vehicles: { id: number; vehicleTypeId: number }[]) {
  const existing = await prisma.customerPackage.count();
  if (existing > 0) {
    console.log(`✓ Skip customer packages (${existing} already exist)`);
    return;
  }

  const allCustomers = await prisma.customer.findMany({ select: { id: true }, orderBy: { id: 'asc' } });
  const today = new Date();

  // vehicleTypeId -> [packageId, price, durationDays]
  const pkgOptions: Record<number, Array<[number, number, number]>> = {
    1: [[1, 200000, 30], [2, 550000, 90], [3, 2000000, 365]],
    2: [[4, 1500000, 30], [5, 4000000, 90], [6, 15000000, 365]],
    3: [[7, 2500000, 30]],
    4: [[8, 100000, 30]],
  };

  // Historical packages: spread over 2024-2026
  const scenarios = [
    { vi: 0, ci: 0, daysAgo: 900 }, { vi: 15, ci: 0, daysAgo: 540 },
    { vi: 1, ci: 1, daysAgo: 720 }, { vi: 16, ci: 2, daysAgo: 600 },
    { vi: 2, ci: 2, daysAgo: 480 }, { vi: 17, ci: 4, daysAgo: 365 },
    { vi: 3, ci: 3, daysAgo: 365 }, { vi: 18, ci: 6, daysAgo: 300 },
    { vi: 4, ci: 4, daysAgo: 240 }, { vi: 19, ci: 8, daysAgo: 180 },
    { vi: 5, ci: 5, daysAgo: 120 }, { vi: 20, ci: 15, daysAgo: 90 },
    { vi: 6, ci: 6, daysAgo: 60 },  { vi: 21, ci: 16, daysAgo: 30 },
    // Active now
    { vi: 7, ci: 7, daysAgo: 15 },  { vi: 22, ci: 20, daysAgo: 20 },
    { vi: 8, ci: 8, daysAgo: 10 },  { vi: 23, ci: 23, daysAgo: 25 },
    { vi: 9, ci: 9, daysAgo: 5 },   { vi: 24, ci: 24, daysAgo: 8 },
    // Sắp hết hạn
    { vi: 10, ci: 10, daysAgo: 27 }, { vi: 16, ci: 16, daysAgo: 26 },
  ];

  for (const s of scenarios) {
    if (s.vi >= vehicles.length || s.ci >= allCustomers.length) continue;
    const vehicle = vehicles[s.vi];
    const opts = pkgOptions[vehicle.vehicleTypeId];
    if (!opts || opts.length === 0) continue;

    const [pkgId, price, dur] = randItem(opts);
    const startDate = addDays(today, -s.daysAgo);
    const endDate = addDays(startDate, dur);
    const status = endDate > today ? 'active' : 'expired';

    const pkg = await prisma.customerPackage.create({
      data: {
        customerId: allCustomers[s.ci].id,
        packageId: pkgId,
        vehicleId: vehicle.id,
        startDate,
        endDate,
        status,
        createdAt: startDate,
      },
    });

    await prisma.payment.create({
      data: {
        customerPackageId: pkg.id,
        amount: price,
        paymentMethod: randItem(['cash', 'transfer', 'card']),
        paymentType: 'package',
        status: 'completed',
        paidAt: startDate,
        createdBy: 1,
      },
    });
  }

  const futureScenarios = [
    { vi: 11, ci: 11, startsInDays: 3 },
    { vi: 17, ci: 17, startsInDays: 5 },
  ];

  for (const s of futureScenarios) {
    if (s.vi >= vehicles.length || s.ci >= allCustomers.length) continue;
    const vehicle = vehicles[s.vi];
    const opts = pkgOptions[vehicle.vehicleTypeId];
    if (!opts || opts.length === 0) continue;

    const [pkgId, price, dur] = randItem(opts);
    const startDate = addDays(today, s.startsInDays);
    const endDate = addDays(startDate, dur);

    const pkg = await prisma.customerPackage.create({
      data: {
        customerId: allCustomers[s.ci].id,
        packageId: pkgId,
        vehicleId: vehicle.id,
        startDate,
        endDate,
        status: 'pending',
        createdAt: today,
      },
    });

    await prisma.payment.create({
      data: {
        customerPackageId: pkg.id,
        amount: price,
        paymentMethod: randItem(['cash', 'transfer', 'card']),
        paymentType: 'package',
        status: 'completed',
        paidAt: today,
        createdBy: 1,
      },
    });
  }

  console.log(`✓ ${scenarios.length + futureScenarios.length} customer packages seeded`);
}

// ──────────────────────────────────────
// ACTIVITY LOGS
// ──────────────────────────────────────
async function seedActivityLogs() {
  const existing = await prisma.userActivityLog.count();
  if (existing > 0) {
    console.log(`✓ Skip activity logs (${existing} already exist)`);
    return;
  }

  const today = new Date();
  const logs: any[] = [];
  const userProfiles = [
    { id: 1, username: 'admin' },
    { id: 2, username: 'nhanvien1' },
    { id: 3, username: 'nhanvien2' },
  ];
  const actions = ['LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'VIEW'];
  const entities = ['ParkingRecord', 'Customer', 'Vehicle', 'Payment', 'CustomerPackage', 'User'];

  for (let i = 0; i < 300; i++) {
    const u = randItem(userProfiles);
    const daysAgo = randInt(0, 180);
    const logTime = addDays(today, -daysAgo);
    logTime.setHours(randInt(7, 22), randInt(0, 59), 0, 0);
    const action = randItem(actions);
    const entity = (action === 'LOGIN' || action === 'LOGOUT') ? null : randItem(entities);
    logs.push({
      userId: u.id,
      username: u.username,
      action,
      entity,
      entityId: entity ? randInt(1, 200) : null,
      details: action === 'LOGIN' ? 'Đăng nhập thành công' : action === 'LOGOUT' ? 'Đăng xuất' : `${action} ${entity || ''}`,
      ipAddress: `192.168.1.${randInt(1, 50)}`,
      statusCode: 200,
      createdAt: logTime,
    });
  }

  await prisma.userActivityLog.createMany({ data: logs });
  console.log(`✓ ${logs.length} activity logs seeded`);
}

// ──────────────────────────────────────
// DENSE DEMO DATA FOR 01-02/08/2026
// ──────────────────────────────────────
async function seedDenseAug2026Demo(vehicles: { id: number; vehicleTypeId: number; licensePlate: string }[]) {
  const demoTag = '[DEMO_AUG2026]';
  const userIds = (await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
    orderBy: { id: 'asc' },
  })).map((user) => user.id);
  const actorIds = userIds.length > 0 ? userIds : [1];

  const spots = await prisma.parkingSpot.findMany({
    orderBy: [{ zoneId: 'asc' }, { spotNumber: 'asc' }],
    select: { id: true, zoneId: true, spotNumber: true },
  });

  const typeToSpotPool: Record<number, number[]> = {
    1: spots.filter((spot) => spot.zoneId === 1).map((spot) => spot.id),
    2: spots.filter((spot) => spot.zoneId === 2).map((spot) => spot.id),
    3: spots.filter((spot) => spot.zoneId === 3).map((spot) => spot.id),
    4: spots.filter((spot) => spot.zoneId === 1).map((spot) => spot.id),
  };
  const vipSpotIds = spots.filter((spot) => spot.zoneId === 4).map((spot) => spot.id);

  const vehiclePool = [...vehicles].sort((a, b) => a.id - b.id);
  const hourlyRateMap: Record<number, number> = { 1: 5000, 2: 20000, 3: 30000, 4: 2000 };
  const methods = ['cash', 'transfer', 'card'];

  const oldDemoRecords = await prisma.parkingRecord.findMany({
    where: { notes: { contains: demoTag } },
    select: { id: true },
  });
  if (oldDemoRecords.length > 0) {
    await prisma.payment.deleteMany({
      where: {
        OR: [
          { notes: { contains: demoTag } },
          { parkingRecordId: { in: oldDemoRecords.map((record) => record.id) } },
        ],
      },
    });
    await prisma.parkingRecord.deleteMany({
      where: { id: { in: oldDemoRecords.map((record) => record.id) } },
    });
  }

  const completedSchedules = [
    { day: 1, countsByHour: [2, 3, 4, 4, 4, 5, 5, 4, 5, 5, 5, 5, 4, 3, 2] },
    { day: 2, countsByHour: [1, 2, 2, 3, 3, 4, 3, 3, 3, 2, 2, 2] },
  ];
  const completedRecordsData: any[] = [];
  let completedIndex = 0;

  for (const schedule of completedSchedules) {
    const startHour = 6;
    schedule.countsByHour.forEach((count, hourOffset) => {
      const hour = startHour + hourOffset;
      for (let i = 0; i < count; i++) {
        const vehicle = vehiclePool[completedIndex % vehiclePool.length];
        const entryMinute = (i * 11 + completedIndex * 7) % 60;
        const durationMinutes = [35, 50, 65, 80, 95, 120, 145, 180][completedIndex % 8];
        const entryTime = atDate(2026, 8, schedule.day, hour, entryMinute);
        const exitTime = addMinutes(entryTime, durationMinutes);
        const fee = Math.ceil(durationMinutes / 60) * (hourlyRateMap[vehicle.vehicleTypeId] || 5000);
        const spotPool = typeToSpotPool[vehicle.vehicleTypeId] || typeToSpotPool[1];
        const parkingSpotId = spotPool[(completedIndex * 3 + i) % spotPool.length];

        completedRecordsData.push({
          vehicleId: vehicle.id,
          licensePlate: vehicle.licensePlate,
          vehicleTypeId: vehicle.vehicleTypeId,
          parkingSpotId,
          entryTime,
          exitTime,
          duration: durationMinutes,
          fee,
          status: 'completed',
          notes: `${demoTag} completed ${schedule.day === 1 ? 'today' : 'tomorrow'}`,
          createdBy: actorIds[completedIndex % actorIds.length],
          createdAt: entryTime,
        });
        completedIndex += 1;
      }
    });
  }

  if (completedRecordsData.length > 0) {
    await prisma.parkingRecord.createMany({ data: completedRecordsData });
  }

  const createdCompletedRecords = await prisma.parkingRecord.findMany({
    where: {
      notes: { contains: demoTag },
      status: 'completed',
    },
    select: { id: true, fee: true, exitTime: true },
    orderBy: { id: 'asc' },
  });

  if (createdCompletedRecords.length > 0) {
    await prisma.payment.createMany({
      data: createdCompletedRecords.map((record, index) => ({
        parkingRecordId: record.id,
        amount: record.fee || 0,
        paymentMethod: methods[index % methods.length],
        paymentType: 'parking',
        status: 'completed',
        paidAt: record.exitTime || new Date(),
        createdBy: actorIds[index % actorIds.length],
        notes: `${demoTag} parking payment`,
      })),
    });
  }

  const parkedVehicleSelections = [
    { vehicle: vehiclePool[0], spotId: vipSpotIds[0], entryTime: atDate(2026, 8, 1, 8, 15) },
    { vehicle: vehiclePool[1], spotId: vipSpotIds[1], entryTime: atDate(2026, 8, 1, 8, 40) },
    { vehicle: vehiclePool[2], spotId: vipSpotIds[2], entryTime: atDate(2026, 8, 1, 9, 5) },
    { vehicle: vehiclePool[3], spotId: vipSpotIds[3], entryTime: atDate(2026, 8, 1, 9, 30) },
    { vehicle: vehiclePool[4], spotId: vipSpotIds[4], entryTime: atDate(2026, 8, 1, 10, 10) },
    { vehicle: vehiclePool[5], spotId: vipSpotIds[5], entryTime: atDate(2026, 8, 1, 11, 20) },
    { vehicle: vehiclePool[15], spotId: vipSpotIds[6], entryTime: atDate(2026, 8, 1, 12, 0) },
    { vehicle: vehiclePool[16], spotId: vipSpotIds[7], entryTime: atDate(2026, 8, 1, 13, 45) },
    { vehicle: vehiclePool[20], spotId: vipSpotIds[8], entryTime: atDate(2026, 8, 1, 14, 25) },
    { vehicle: vehiclePool[23], spotId: vipSpotIds[9], entryTime: atDate(2026, 8, 1, 15, 5) },
    { vehicle: vehiclePool[24], spotId: typeToSpotPool[4][0], entryTime: atDate(2026, 8, 1, 16, 10) },
    { vehicle: vehiclePool[17], spotId: typeToSpotPool[2][0], entryTime: atDate(2026, 8, 1, 17, 20) },
    { vehicle: vehiclePool[18], spotId: typeToSpotPool[2][1], entryTime: atDate(2026, 8, 1, 18, 0) },
    { vehicle: vehiclePool[21], spotId: typeToSpotPool[3][0], entryTime: atDate(2026, 8, 1, 19, 30) },
  ].filter((item) => item.vehicle && item.spotId);

  await prisma.parkingRecord.createMany({
    data: parkedVehicleSelections.map((item, index) => ({
      vehicleId: item.vehicle.id,
      licensePlate: item.vehicle.licensePlate,
      vehicleTypeId: item.vehicle.vehicleTypeId,
      parkingSpotId: item.spotId,
      entryTime: item.entryTime,
      status: 'parked',
      notes: `${demoTag} parked overnight`,
      createdBy: actorIds[index % actorIds.length],
      createdAt: item.entryTime,
    })),
  });

  await prisma.parkingSpot.updateMany({
    where: { status: { not: 'maintenance' } },
    data: { status: 'available' },
  });
  const activeParkedSpots = await prisma.parkingRecord.findMany({
    where: { status: 'parked', parkingSpotId: { not: null } },
    select: { parkingSpotId: true },
  });
  const occupiedSpotIds = Array.from(new Set(activeParkedSpots.map((record) => record.parkingSpotId).filter(Boolean) as number[]));
  if (occupiedSpotIds.length > 0) {
    await prisma.parkingSpot.updateMany({
      where: { id: { in: occupiedSpotIds } },
      data: { status: 'occupied' },
    });
  }
  const maintenanceSpots = [5, 55, 105].filter((spotId) => !occupiedSpotIds.includes(spotId));
  if (maintenanceSpots.length > 0) {
    await prisma.parkingSpot.updateMany({
      where: { id: { in: maintenanceSpots } },
      data: { status: 'maintenance' },
    });
  }

  const packageTemplates = [
    { vehicleTypeId: 1, endDate: endOfDay(atDate(2026, 8, 2, 0, 0)) },
    { vehicleTypeId: 1, endDate: endOfDay(atDate(2026, 8, 4, 0, 0)) },
    { vehicleTypeId: 2, endDate: endOfDay(atDate(2026, 8, 5, 0, 0)) },
    { vehicleTypeId: 3, endDate: endOfDay(atDate(2026, 8, 7, 0, 0)) },
  ];

  let packageDemoCount = 0;
  for (const template of packageTemplates) {
    const activePackage = await prisma.parkingPackage.findFirst({
      where: { vehicleTypeId: template.vehicleTypeId, isActive: true },
      orderBy: { durationDays: 'asc' },
    });
    if (!activePackage) continue;

    const candidateVehicles = await prisma.vehicle.findMany({
      where: { vehicleTypeId: template.vehicleTypeId },
      include: { customer: { select: { id: true, isActive: true } } },
      orderBy: { id: 'asc' },
    });

    const startDate = atDate(2026, 7, 10 + packageDemoCount, 0, 0);
    const normalizedStartDate = new Date(startDate);
    normalizedStartDate.setHours(0, 0, 0, 0);

    for (const candidate of candidateVehicles) {
      if (!candidate.customer.isActive) continue;

      const overlapping = await prisma.customerPackage.findFirst({
        where: {
          vehicleId: candidate.id,
          status: { not: 'cancelled' },
          startDate: { lte: template.endDate },
          endDate: { gte: normalizedStartDate },
        },
      });
      if (overlapping) continue;

      const existingSameWindow = await prisma.customerPackage.findFirst({
        where: {
          vehicleId: candidate.id,
          packageId: activePackage.id,
          startDate: normalizedStartDate,
          endDate: template.endDate,
        },
      });
      if (existingSameWindow) break;

      const createdPackage = await prisma.customerPackage.create({
        data: {
          customerId: candidate.customer.id,
          packageId: activePackage.id,
          vehicleId: candidate.id,
          startDate: normalizedStartDate,
          endDate: template.endDate,
          status: 'active',
          createdAt: normalizedStartDate,
        },
      });

      await prisma.payment.create({
        data: {
          customerPackageId: createdPackage.id,
          amount: activePackage.price,
          paymentMethod: methods[packageDemoCount % methods.length],
          paymentType: 'package',
          status: 'completed',
          paidAt: normalizedStartDate,
          createdBy: actorIds[packageDemoCount % actorIds.length],
          notes: `${demoTag} package payment`,
        },
      });

      packageDemoCount += 1;
      break;
    }
  }

  console.log(`✓ Dense demo 01-02/08/2026: ${completedRecordsData.length} completed, ${parkedVehicleSelections.length} parked, ${packageDemoCount} expiring packages`);
}

// ──────────────────────────────────────
// MAIN
// ──────────────────────────────────────
async function main() {
  console.log('=== BẮT ĐẦU SEED DỮ LIỆU MẪU ===\n');
  await seedMasterData();
  const vehicles = await seedCustomersAndVehicles();
  await seedParkingHistory(vehicles);
  await seedCustomerPackages(vehicles);
  await seedDenseAug2026Demo(vehicles);
  await seedActivityLogs();
  console.log('\n✅ SEED HOÀN TẤT!');
  console.log('   - 25 khách hàng, 30 xe các loại');
  console.log('   - Dữ liệu lịch sử từ 01/2024 đến nay (~1200+ biến động xe)');
  console.log('   - Gói active / sắp hết hạn / expired / chưa tới ngày áp dụng');
  console.log('   - 300 nhật ký hoạt động');
  console.log('   - Tài khoản: admin/admin123, nhanvien1/staff123, nhanvien2/staff123');
}

main()
  .catch((e) => { console.error('Seed thất bại:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
