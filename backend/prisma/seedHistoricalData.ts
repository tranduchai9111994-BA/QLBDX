/**
 * seedHistoricalData.ts — Bồi đắp dữ liệu lịch sử nhiều năm (2024 → nay) cho ParkingRecords/Payments
 * để Dashboard/Báo cáo/Phân tích thể hiện đúng xu hướng dữ liệu theo thực tế (tăng trưởng theo năm,
 * mùa cao điểm, cuối tuần thấp hơn ngày thường, giờ cao điểm sáng/chiều...).
 *
 * Idempotent theo NGÀY: với mỗi ngày trong khoảng, tính "mật độ mục tiêu" rồi chỉ bù thêm phần còn
 * thiếu (target - số bản ghi đã có) — không đụng tới ngày đã đủ dày (ví dụ 90 ngày gần nhất đã seed).
 * Chạy lại nhiều lần an toàn.
 *
 * Chạy: npx ts-node prisma/seedHistoricalData.ts
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
function addDays(d: Date, days: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + days);
  return c;
}
function randNormal(mean: number, std: number): number {
  const u1 = Math.random() || 1e-9;
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * std;
}
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function sampleEntryHour(): { hour: number; minute: number } {
  const r = Math.random();
  let h: number;
  if (r < 0.4) h = randNormal(8, 1.3);
  else if (r < 0.75) h = randNormal(17.5, 1.5);
  else h = randInt(6, 22);
  h = clamp(h, 6, 22.9);
  const hour = Math.floor(h);
  const minute = clamp(Math.floor((h - hour) * 60) + randInt(0, 15), 0, 59);
  return { hour, minute };
}

const VEHICLE_TYPE_WEIGHTS: Array<{ id: number; weight: number }> = [
  { id: 1, weight: 0.6 },
  { id: 2, weight: 0.3 },
  { id: 3, weight: 0.1 },
];
function pickVehicleTypeId(): number {
  const r = Math.random();
  let acc = 0;
  for (const vt of VEHICLE_TYPE_WEIGHTS) {
    acc += vt.weight;
    if (r <= acc) return vt.id;
  }
  return VEHICLE_TYPE_WEIGHTS[0].id;
}
function getSpotId(vehicleTypeId: number): number {
  if (vehicleTypeId === 1) return randInt(1, 50);
  if (vehicleTypeId === 2) return randInt(51, 80);
  if (vehicleTypeId === 3) return randInt(81, 100);
  return randInt(1, 50);
}
const HOURLY_RATE: Record<number, number> = { 1: 5000, 2: 20000, 3: 30000, 4: 2000 };
const DAILY_RATE: Record<number, number> = { 1: 20000, 2: 100000, 3: 150000, 4: 10000 };
function calcFee(durationMinutes: number, vehicleTypeId: number): number {
  const hours = Math.ceil(durationMinutes / 60);
  const hourly = HOURLY_RATE[vehicleTypeId] || 5000;
  const daily = DAILY_RATE[vehicleTypeId] || 20000;
  if (hours <= 0) return 0;
  if (hours <= 24) return Math.min(hours * hourly, daily);
  return Math.ceil(hours / 24) * daily;
}

/** Mật độ mục tiêu/ngày: tăng trưởng theo năm + mùa cao điểm (T9-T11) + Tết thấp điểm (T1-T2). */
function targetForDate(date: Date): number {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const dow = date.getDay();
  const isWeekend = dow === 0 || dow === 6;

  let lo: number, hi: number;
  if (year <= 2024) {
    [lo, hi] = isWeekend ? [15, 25] : [25, 45];
  } else if (year === 2025) {
    [lo, hi] = isWeekend ? [20, 35] : [35, 60];
  } else {
    [lo, hi] = isWeekend ? [25, 40] : [45, 75];
  }

  const isBusySeason = month >= 9 && month <= 11;
  const isTetSeason = month <= 2;
  if (isBusySeason) {
    lo = Math.round(lo * 1.15);
    hi = Math.round(hi * 1.15);
  } else if (isTetSeason) {
    lo = Math.round(lo * 0.7);
    hi = Math.round(hi * 0.7);
  }

  return randInt(lo, hi);
}

const START_DATE = new Date(2024, 0, 1); // 2024-01-01

async function main() {
  const now = new Date();
  const startDay = new Date(START_DATE);
  startDay.setHours(0, 0, 0, 0);

  console.log('Đang đọc mật độ hiện có theo ngày...');
  const existingByDay = await prisma.$queryRawUnsafe<{ d: string; cnt: number }[]>(`
    SELECT CAST(EntryTime AS date) AS d, COUNT(*) AS cnt
    FROM ParkingRecords
    WHERE EntryTime >= '${startDay.toISOString().slice(0, 10)}'
    GROUP BY CAST(EntryTime AS date)
  `);
  const existingMap = new Map<string, number>();
  for (const row of existingByDay) {
    const key = new Date(row.d).toISOString().slice(0, 10);
    existingMap.set(key, Number(row.cnt));
  }

  const vehicles = await prisma.vehicle.findMany({
    select: { id: true, vehicleTypeId: true, licensePlate: true },
  });
  if (vehicles.length === 0) {
    console.log('✗ Chưa có Vehicle nào — hãy chạy `npm run prisma:seed` trước.');
    await prisma.$disconnect();
    return;
  }

  const userIds = [1, 2, 3];
  const methods = ['cash', 'cash', 'cash', 'transfer', 'card'];
  let plateCounter = 800000;
  function nextWalkInPlate(): string {
    plateCounter += 1;
    return `29B${plateCounter}`;
  }

  let totalDaysFilled = 0;
  let totalRecordsAdded = 0;
  let totalPaymentsAdded = 0;

  const totalDays = Math.floor((now.getTime() - startDay.getTime()) / (24 * 60 * 60 * 1000)) + 1;

  for (let i = 0; i < totalDays; i++) {
    const day = addDays(startDay, i);
    const dayKey = day.toISOString().slice(0, 10);
    const target = targetForDate(day);
    const existing = existingMap.get(dayKey) || 0;
    const gap = target - existing;
    if (gap <= 0) continue;

    const recordsBatch: any[] = [];
    for (let j = 0; j < gap; j++) {
      const { hour, minute } = sampleEntryHour();
      const entryTime = new Date(day);
      entryTime.setHours(hour, minute, randInt(0, 59), 0);
      if (entryTime >= now) continue;

      let vehicleId: number | null = null;
      let vehicleTypeId: number;
      let licensePlate: string;

      if (Math.random() < 0.85) {
        const v = randItem(vehicles);
        vehicleId = v.id;
        vehicleTypeId = v.vehicleTypeId;
        licensePlate = v.licensePlate;
      } else {
        vehicleTypeId = pickVehicleTypeId();
        licensePlate = nextWalkInPlate();
      }

      const hoursSample = clamp(randNormal(4, 2), 0.5, 10);
      const durationMinutes = Math.round(hoursSample * 60);
      const exitTime = addMinutes(entryTime, durationMinutes);
      if (exitTime >= now) continue;

      const fee = calcFee(durationMinutes, vehicleTypeId);

      recordsBatch.push({
        vehicleId,
        licensePlate,
        vehicleTypeId,
        parkingSpotId: getSpotId(vehicleTypeId),
        entryTime,
        exitTime,
        duration: durationMinutes,
        fee,
        status: 'completed',
        createdBy: randItem(userIds),
        createdAt: entryTime,
      });
    }

    if (recordsBatch.length === 0) continue;

    await prisma.parkingRecord.createMany({ data: recordsBatch });
    totalRecordsAdded += recordsBatch.length;
    totalDaysFilled += 1;

    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    const created = await prisma.parkingRecord.findMany({
      where: { entryTime: { gte: day, lte: dayEnd }, status: 'completed', fee: { gt: 0 } },
      select: { id: true, fee: true, exitTime: true },
      orderBy: { id: 'desc' },
      take: recordsBatch.length,
    });

    const paymentsBatch = created.map((rec) => ({
      parkingRecordId: rec.id,
      amount: rec.fee || 0,
      paymentMethod: randItem(methods),
      paymentType: 'parking',
      status: 'completed',
      paidAt: rec.exitTime || new Date(),
      createdBy: randItem(userIds),
    }));
    if (paymentsBatch.length > 0) {
      await prisma.payment.createMany({ data: paymentsBatch });
      totalPaymentsAdded += paymentsBatch.length;
    }

    if (totalDaysFilled % 100 === 0) {
      console.log(`  ... đã xử lý ${totalDaysFilled} ngày, +${totalRecordsAdded} bản ghi`);
    }
  }

  console.log(`✓ Hoàn tất: bù thêm dữ liệu cho ${totalDaysFilled} ngày (từ ${startDay.toISOString().slice(0, 10)} → ${now.toISOString().slice(0, 10)}).`);
  console.log(`✓ Thêm ${totalRecordsAdded} lượt đỗ xe, ${totalPaymentsAdded} thanh toán.`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
