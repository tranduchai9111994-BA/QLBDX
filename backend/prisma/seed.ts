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

// ──────────────────────────────────────
// MASTER DATA
// ──────────────────────────────────────
async function seedMasterData() {
  const hp = await bcrypt.hash('admin123', 10);
  const hs = await bcrypt.hash('staff123', 10);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash: hp, fullName: 'Quan tri vien', email: 'admin@parking.com', role: 'admin', isActive: true },
    create: { username: 'admin', passwordHash: hp, fullName: 'Quan tri vien', email: 'admin@parking.com', role: 'admin' },
  });
  await prisma.user.upsert({
    where: { username: 'nhanvien1' },
    update: { passwordHash: hs, fullName: 'Nguyen Van An', email: 'nv1@parking.com', role: 'staff', isActive: true },
    create: { username: 'nhanvien1', passwordHash: hs, fullName: 'Nguyen Van An', email: 'nv1@parking.com', role: 'staff' },
  });
  await prisma.user.upsert({
    where: { username: 'nhanvien2' },
    update: { passwordHash: hs, fullName: 'Tran Thi Bich', email: 'nv2@parking.com', role: 'staff', isActive: true },
    create: { username: 'nhanvien2', passwordHash: hs, fullName: 'Tran Thi Bich', email: 'nv2@parking.com', role: 'staff' },
  });

  for (const [i, vt] of [
    { name: 'Xe may', description: 'Xe may, xe gan may', hourlyRate: 5000, dailyRate: 20000, monthlyRate: 200000 },
    { name: 'O to con', description: 'O to duoi 9 cho', hourlyRate: 20000, dailyRate: 100000, monthlyRate: 1500000 },
    { name: 'O to lon', description: 'O to 9 cho tro len, xe tai', hourlyRate: 30000, dailyRate: 150000, monthlyRate: 2500000 },
    { name: 'Xe dap', description: 'Xe dap cac loai', hourlyRate: 2000, dailyRate: 10000, monthlyRate: 100000 },
  ].entries()) {
    await prisma.vehicleType.upsert({ where: { id: i + 1 }, update: {}, create: vt });
  }

  for (const [i, z] of [
    { name: 'Khu A', description: 'Khu vuc xe may', totalSpots: 50 },
    { name: 'Khu B', description: 'Khu vuc o to con', totalSpots: 30 },
    { name: 'Khu C', description: 'Khu vuc o to lon', totalSpots: 20 },
    { name: 'Khu D', description: 'Khu vuc VIP', totalSpots: 10 },
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
    { name: 'Ve thang xe may', vehicleTypeId: 1, durationDays: 30, price: 200000, description: 'Goi gui xe may theo thang' },
    { name: 'Ve quy xe may', vehicleTypeId: 1, durationDays: 90, price: 550000, description: 'Goi gui xe may theo quy' },
    { name: 'Ve nam xe may', vehicleTypeId: 1, durationDays: 365, price: 2000000, description: 'Goi gui xe may theo nam' },
    { name: 'Ve thang o to con', vehicleTypeId: 2, durationDays: 30, price: 1500000, description: 'Goi gui o to con theo thang' },
    { name: 'Ve quy o to con', vehicleTypeId: 2, durationDays: 90, price: 4000000, description: 'Goi gui o to con theo quy' },
    { name: 'Ve nam o to con', vehicleTypeId: 2, durationDays: 365, price: 15000000, description: 'Goi gui o to con theo nam' },
    { name: 'Ve thang o to lon', vehicleTypeId: 3, durationDays: 30, price: 2500000, description: 'Goi gui o to lon theo thang' },
    { name: 'Ve thang xe dap', vehicleTypeId: 4, durationDays: 30, price: 100000, description: 'Goi gui xe dap theo thang' },
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
      { fullName: 'Nguyen Van Hung', phone: '0901234001', email: 'hung.nv@email.com', address: '12 Ly Thuong Kiet, Q1', identityCard: '079201001234' },
      { fullName: 'Tran Thi Mai', phone: '0912345002', email: 'mai.tt@email.com', address: '45 Nguyen Hue, Q1', identityCard: '079202002345' },
      { fullName: 'Le Van Duc', phone: '0923456003', email: 'duc.lv@email.com', address: '78 Le Loi, Q1', identityCard: '079201003456' },
      { fullName: 'Pham Thi Lan', phone: '0934567004', email: 'lan.pt@email.com', address: '90 Tran Hung Dao, Q5', identityCard: '079202004567' },
      { fullName: 'Hoang Van Minh', phone: '0945678005', email: 'minh.hv@email.com', address: '23 Cach Mang Thang 8, Q3', identityCard: '079201005678' },
      { fullName: 'Nguyen Thi Hoa', phone: '0956789006', email: 'hoa.nt@email.com', address: '56 Dien Bien Phu, BT', identityCard: '079202006789' },
      { fullName: 'Vo Van Long', phone: '0967890007', email: 'long.vv@email.com', address: '34 Nguyen Dinh Chieu, Q3', identityCard: '079201007890' },
      { fullName: 'Dang Thi Thu', phone: '0978901008', email: 'thu.dt@email.com', address: '67 Hai Ba Trung, Q1', identityCard: '079202008901' },
      { fullName: 'Bui Van Cuong', phone: '0989012009', email: 'cuong.bv@email.com', address: '89 Pasteur, Q1', identityCard: '079201009012' },
      { fullName: 'Do Thi Nga', phone: '0990123010', email: 'nga.dt@email.com', address: '12 Nam Ky Khoi Nghia, Q3', identityCard: '079202010123' },
      { fullName: 'Tran Van Khanh', phone: '0901234011', email: 'khanh.tv@email.com', address: '45 Vo Van Tan, Q3', identityCard: '079201011234' },
      { fullName: 'Le Thi Phuong', phone: '0912345012', email: 'phuong.lt@email.com', address: '78 Ba Thang Hai, Q10', identityCard: '079202012345' },
      { fullName: 'Phan Van Toan', phone: '0923456013', email: 'toan.pv@email.com', address: '90 Ly Tu Trong, Q1', identityCard: '079201013456' },
      { fullName: 'Nguyen Thi Thuy', phone: '0934567014', email: 'thuy.nt@email.com', address: '23 Nguyen Thi Minh Khai, Q1', identityCard: '079202014567' },
      { fullName: 'Cao Van Binh', phone: '0945678015', email: 'binh.cv@email.com', address: '56 Truong Dinh, Q3', identityCard: '079201015678' },
      { fullName: 'Ly Thi Kim', phone: '0956789016', email: 'kim.lt@email.com', address: '34 Pham Ngu Lao, Q1', identityCard: '079202016789' },
      { fullName: 'Nguyen Van Tung', phone: '0967890017', email: 'tung.nv2@email.com', address: '67 Bui Vien, Q1', identityCard: '079201017890' },
      { fullName: 'Tran Thi Loan', phone: '0978901018', email: 'loan.tt@email.com', address: '89 De Tham, Q1', identityCard: '079202018901' },
      { fullName: 'Dinh Van Nghia', phone: '0989012019', email: 'nghia.dv@email.com', address: '12 Cong Quynh, Q1', identityCard: '079201019012' },
      { fullName: 'Vo Thi Xuan', phone: '0990123020', email: 'xuan.vt@email.com', address: '45 Nguyen Cu Trinh, Q1', identityCard: '079202020123' },
      { fullName: 'Nguyen Hoang Nam', phone: '0901234021', email: 'nam.nh@email.com', address: '78 Nguyen Trai, Q1', identityCard: '079201021234' },
      { fullName: 'Tran Van Quang', phone: '0912345022', email: 'quang.tv2@email.com', address: '90 Ham Nghi, Q1', identityCard: '079201022345' },
      { fullName: 'Le Thi Dung', phone: '0923456023', email: 'dung.lt@email.com', address: '23 Nguyen Huu Canh, BT', identityCard: '079202023456' },
      { fullName: 'Pham Van Loc', phone: '0934567024', email: 'loc.pv@email.com', address: '56 Doan Van Bo, Q4', identityCard: '079201024567' },
      { fullName: 'Hoang Thi Nhung', phone: '0945678025', email: 'nhung.ht@email.com', address: '34 Ton That Thuyet, Q4', identityCard: '079202025678' },
    ],
  });

  const allCustomers = await prisma.customer.findMany({ orderBy: { id: 'asc' } });

  // Vehicles: spread across vehicle types, use customer IDs
  const vehicleRows = [
    // Xe may (vehicleTypeId=1) – 15 vehicles
    { customerId: allCustomers[0].id, vehicleTypeId: 1, licensePlate: '59B1-12345', brand: 'Honda', model: 'Wave Alpha', color: 'Xanh' },
    { customerId: allCustomers[1].id, vehicleTypeId: 1, licensePlate: '51G3-45678', brand: 'Yamaha', model: 'Exciter', color: 'Den' },
    { customerId: allCustomers[2].id, vehicleTypeId: 1, licensePlate: '59P2-78901', brand: 'Honda', model: 'Air Blade', color: 'Bac' },
    { customerId: allCustomers[3].id, vehicleTypeId: 1, licensePlate: '51H4-23456', brand: 'Honda', model: 'SH', color: 'Do' },
    { customerId: allCustomers[4].id, vehicleTypeId: 1, licensePlate: '59N1-56789', brand: 'Yamaha', model: 'Nouvo', color: 'Trang' },
    { customerId: allCustomers[5].id, vehicleTypeId: 1, licensePlate: '51K2-89012', brand: 'Suzuki', model: 'Satria', color: 'Xanh' },
    { customerId: allCustomers[6].id, vehicleTypeId: 1, licensePlate: '59C3-34567', brand: 'Honda', model: 'Vision', color: 'Vang' },
    { customerId: allCustomers[7].id, vehicleTypeId: 1, licensePlate: '51D4-67890', brand: 'Piaggio', model: 'Liberty', color: 'Trang' },
    { customerId: allCustomers[8].id, vehicleTypeId: 1, licensePlate: '59E1-12340', brand: 'Kymco', model: 'Like', color: 'Hong' },
    { customerId: allCustomers[9].id, vehicleTypeId: 1, licensePlate: '51F2-45671', brand: 'Honda', model: 'Lead', color: 'Den' },
    { customerId: allCustomers[10].id, vehicleTypeId: 1, licensePlate: '59L3-78902', brand: 'Yamaha', model: 'Sirius', color: 'Do' },
    { customerId: allCustomers[11].id, vehicleTypeId: 1, licensePlate: '51M4-23463', brand: 'Honda', model: 'Future', color: 'Bac' },
    { customerId: allCustomers[12].id, vehicleTypeId: 1, licensePlate: '59R1-56784', brand: 'Suzuki', model: 'Smash', color: 'Xanh' },
    { customerId: allCustomers[13].id, vehicleTypeId: 1, licensePlate: '51S2-89015', brand: 'Honda', model: 'Winner X', color: 'Den' },
    { customerId: allCustomers[14].id, vehicleTypeId: 1, licensePlate: '59T3-34566', brand: 'Yamaha', model: 'Grande', color: 'Trang' },
    // O to con (vehicleTypeId=2) – 10 vehicles
    { customerId: allCustomers[0].id, vehicleTypeId: 2, licensePlate: '51A-12345', brand: 'Toyota', model: 'Vios', color: 'Trang' },
    { customerId: allCustomers[2].id, vehicleTypeId: 2, licensePlate: '59A-23456', brand: 'Honda', model: 'City', color: 'Bac' },
    { customerId: allCustomers[4].id, vehicleTypeId: 2, licensePlate: '51B-34567', brand: 'Mazda', model: 'CX-5', color: 'Den' },
    { customerId: allCustomers[6].id, vehicleTypeId: 2, licensePlate: '59B-45678', brand: 'Hyundai', model: 'Accent', color: 'Do' },
    { customerId: allCustomers[8].id, vehicleTypeId: 2, licensePlate: '51C-56789', brand: 'Kia', model: 'Morning', color: 'Trang' },
    { customerId: allCustomers[15].id, vehicleTypeId: 2, licensePlate: '59C-67890', brand: 'Toyota', model: 'Fortuner', color: 'Den' },
    { customerId: allCustomers[16].id, vehicleTypeId: 2, licensePlate: '51D-78901', brand: 'Ford', model: 'EcoSport', color: 'Bac' },
    { customerId: allCustomers[17].id, vehicleTypeId: 2, licensePlate: '59D-89012', brand: 'VinFast', model: 'VF8', color: 'Xanh' },
    { customerId: allCustomers[18].id, vehicleTypeId: 2, licensePlate: '51E-90123', brand: 'Mitsubishi', model: 'Xpander', color: 'Trang' },
    { customerId: allCustomers[19].id, vehicleTypeId: 2, licensePlate: '59E-01234', brand: 'Toyota', model: 'Camry', color: 'Den' },
    // O to lon (vehicleTypeId=3) – 3 vehicles
    { customerId: allCustomers[20].id, vehicleTypeId: 3, licensePlate: '51FA-1234', brand: 'Hyundai', model: 'County', color: 'Vang' },
    { customerId: allCustomers[21].id, vehicleTypeId: 3, licensePlate: '59FA-2345', brand: 'Toyota', model: 'Coaster', color: 'Trang' },
    { customerId: allCustomers[22].id, vehicleTypeId: 3, licensePlate: '51H-01234', brand: 'Isuzu', model: 'NPR', color: 'Xanh' },
    // Xe dap (vehicleTypeId=4) – 2 vehicles
    { customerId: allCustomers[23].id, vehicleTypeId: 4, licensePlate: 'XD-001', brand: 'Giant', model: 'ATX', color: 'Do' },
    { customerId: allCustomers[24].id, vehicleTypeId: 4, licensePlate: 'XD-002', brand: 'Trek', model: 'FX3', color: 'Den' },
  ];

  for (const v of vehicleRows) {
    await prisma.vehicle.upsert({ where: { licensePlate: v.licensePlate }, update: {}, create: v });
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
    if (vehicleTypeId === 1) return randInt(1, 50);   // xe may -> Khu A
    if (vehicleTypeId === 2) return randInt(51, 80);  // o to con -> Khu B
    if (vehicleTypeId === 3) return randInt(81, 100); // o to lon -> Khu C
    return randInt(1, 50);                            // xe dap -> Khu A
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
  for (let i = 0; i < randInt(8, 18); i++) {
    const vehicle = randItem(vehicles);
    const entryHour = randInt(6, 10);
    const entryTime = new Date();
    entryTime.setHours(entryHour, randInt(0, 59), 0, 0);
    todayParked.push({
      vehicleId: vehicle.id,
      licensePlate: vehicle.licensePlate,
      vehicleTypeId: vehicle.vehicleTypeId,
      parkingSpotId: getSpotId(vehicle.vehicleTypeId),
      entryTime,
      status: 'parked',
      createdBy: randItem(userIds),
      createdAt: entryTime,
    });
  }
  if (todayParked.length > 0) {
    await prisma.parkingRecord.createMany({ data: todayParked });
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

  // Historical packages: ~20 entries spread over 2024-2026
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

  console.log(`✓ ${scenarios.length} customer packages seeded`);
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
      details: action === 'LOGIN' ? 'Dang nhap thanh cong' : action === 'LOGOUT' ? 'Dang xuat' : `${action} ${entity || ''}`,
      ipAddress: `192.168.1.${randInt(1, 50)}`,
      statusCode: 200,
      createdAt: logTime,
    });
  }

  await prisma.userActivityLog.createMany({ data: logs });
  console.log(`✓ ${logs.length} activity logs seeded`);
}

// ──────────────────────────────────────
// MAIN
// ──────────────────────────────────────
async function main() {
  console.log('=== BAT DAU SEED DU LIEU MAU ===\n');
  await seedMasterData();
  const vehicles = await seedCustomersAndVehicles();
  await seedParkingHistory(vehicles);
  await seedCustomerPackages(vehicles);
  await seedActivityLogs();
  console.log('\n✅ SEED HOAN TAT!');
  console.log('   - 25 khach hang, 30 xe cac loai');
  console.log('   - Du lieu lich su tu 01/2024 den nay (~1200+ biet dong xe)');
  console.log('   - 20 goi ve thang/quy/nam');
  console.log('   - 300 nhat ky hoat dong');
  console.log('   - Tai khoan: admin/admin123, nhanvien1/staff123, nhanvien2/staff123');
}

main()
  .catch((e) => { console.error('Seed that bai:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
