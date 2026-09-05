/**
 * Kiểm thử tranh chấp đồng thời (race condition) cho nghiệp vụ vận hành bãi xe.
 *
 * Vì sao cần file test riêng: các kiểm tra "chỗ còn trống không / xe đã vào chưa" trong
 * ParkingService là ĐỌC rồi mới GHI. Giữa hai bước đó có `await`, nên hai yêu cầu tới gần
 * như đồng thời đều đọc thấy "còn trống" và đều ghi được — hai xe cùng một chỗ đỗ.
 * Test này ép đúng tình huống đó bằng cách bắn nhiều lệnh song song vào CÙNG một chỗ đỗ.
 *
 * Chạy:  npm run test:concurrency        (cần SQL Server đang chạy, DATABASE_URL hợp lệ)
 *
 * Test đụng DB THẬT nên tự tạo dữ liệu riêng (khu "ZZ_TEST_CONCURRENCY") và tự dọn sạch ở
 * bước cuối — không động vào dữ liệu nghiệp vụ có sẵn.
 */
import assert from 'assert';
import prisma from '../config/prisma';
import { ParkingService } from './parking.service';

const TEST_ZONE_NAME = 'ZZ_TEST_CONCURRENCY';
const CONCURRENCY = 5;

const service = new ParkingService();
/** Hậu tố duy nhất cho mỗi lần chạy, tránh đụng biển số của lần chạy trước còn sót. */
const RUN_ID = Date.now().toString().slice(-6);

type Ctx = {
  zoneId: number;
  vehicleTypeId: number;
  userId: number;
  /** Cấp n chỗ đỗ TRỐNG hoàn toàn mới — mỗi test dùng chỗ riêng để không ảnh hưởng lẫn nhau. */
  newSpots: (n: number) => Promise<number[]>;
};

/** Tạo khu riêng cho test. Tên khu không chứa từ khoá phân loại nên nhận mọi loại xe. */
async function setup(): Promise<Ctx> {
  await cleanup();

  const zone = await prisma.parkingZone.create({
    data: { name: TEST_ZONE_NAME, description: 'Du lieu test tranh chap - tu dong xoa', totalSpots: 0 },
  });

  const vehicleType = await prisma.vehicleType.findFirst({ orderBy: { id: 'asc' } });
  const user = await prisma.user.findFirst({ orderBy: { id: 'asc' } });
  assert.ok(vehicleType, 'Cần ít nhất 1 loại xe trong DB để chạy test');
  assert.ok(user, 'Cần ít nhất 1 tài khoản trong DB để chạy test');

  let nextSpotNumber = 1;
  const newSpots = async (n: number) => {
    const ids: number[] = [];
    for (let i = 0; i < n; i += 1) {
      const spot = await prisma.parkingSpot.create({
        data: {
          zoneId: zone.id,
          spotNumber: `T${nextSpotNumber}`,
          spotType: 'standard',
          status: 'available',
        },
      });
      nextSpotNumber += 1;
      ids.push(spot.id);
    }
    return ids;
  };

  return { zoneId: zone.id, vehicleTypeId: vehicleType.id, userId: user.id, newSpots };
}

/** Xoá sạch dữ liệu test theo đúng thứ tự khoá ngoại: Payment -> ParkingRecord -> Spot -> Zone. */
async function cleanup() {
  const zones = await prisma.parkingZone.findMany({ where: { name: TEST_ZONE_NAME }, select: { id: true } });
  if (zones.length === 0) return;

  const zoneIds = zones.map((z) => z.id);
  const spots = await prisma.parkingSpot.findMany({ where: { zoneId: { in: zoneIds } }, select: { id: true } });
  const spotIds = spots.map((s) => s.id);

  if (spotIds.length > 0) {
    const records = await prisma.parkingRecord.findMany({
      where: { parkingSpotId: { in: spotIds } },
      select: { id: true },
    });
    const recordIds = records.map((r) => r.id);
    if (recordIds.length > 0) {
      await prisma.payment.deleteMany({ where: { parkingRecordId: { in: recordIds } } });
      await prisma.parkingRecord.deleteMany({ where: { id: { in: recordIds } } });
    }
    await prisma.parkingSpot.deleteMany({ where: { id: { in: spotIds } } });
  }
  await prisma.parkingZone.deleteMany({ where: { id: { in: zoneIds } } });
}

/** Bắn n lệnh song song, gom lại số lệnh thành công và danh sách thông báo lỗi. */
async function runConcurrently<T>(tasks: Array<() => Promise<T>>) {
  const settled = await Promise.allSettled(tasks.map((task) => task()));
  const rejected = settled.filter((s) => s.status === 'rejected') as PromiseRejectedResult[];
  return {
    successCount: settled.filter((s) => s.status === 'fulfilled').length,
    errors: rejected.map((r) => (r.reason as { message?: string })?.message || String(r.reason)),
  };
}

type Case = { name: string; run: (ctx: Ctx) => Promise<void> };

const cases: Case[] = [
  {
    name: `${CONCURRENCY} nhân viên cùng chọn MỘT chỗ đỗ -> chỉ 1 xe được vào`,
    run: async (ctx) => {
      const [spotId] = await ctx.newSpots(1);
      const result = await runConcurrently(
        Array.from({ length: CONCURRENCY }, (_, i) => () =>
          service.entry(
            { licensePlate: `29Z${RUN_ID}${i}`, vehicleTypeId: ctx.vehicleTypeId, parkingSpotId: spotId },
            ctx.userId
          )
        )
      );

      const parkedOnSpot = await prisma.parkingRecord.count({
        where: { parkingSpotId: spotId, status: 'parked' },
      });
      const spot = await prisma.parkingSpot.findUnique({ where: { id: spotId } });

      assert.strictEqual(
        parkedOnSpot,
        1,
        `Chỗ đỗ ${spotId} đang có ${parkedOnSpot} xe cùng lúc (phải là 1). Lỗi trả về: ${JSON.stringify(result.errors)}`
      );
      assert.strictEqual(result.successCount, 1, `Có ${result.successCount} lệnh vào bãi thành công (phải là 1)`);
      assert.strictEqual(spot?.status, 'occupied', 'Chỗ đỗ phải chuyển sang trạng thái đã có xe');
    },
  },
  {
    name: `${CONCURRENCY} lần ghi nhận CÙNG MỘT biển số vào các chỗ khác nhau -> chỉ 1 lần được nhận`,
    run: async (ctx) => {
      const plate = `29Y${RUN_ID}`;
      const spotIds = await ctx.newSpots(CONCURRENCY);
      const result = await runConcurrently(
        spotIds.map((spotId) => () =>
          service.entry({ licensePlate: plate, vehicleTypeId: ctx.vehicleTypeId, parkingSpotId: spotId }, ctx.userId)
        )
      );

      const parkedSamePlate = await prisma.parkingRecord.count({ where: { licensePlate: plate, status: 'parked' } });

      assert.strictEqual(
        parkedSamePlate,
        1,
        `Biển số ${plate} đang có ${parkedSamePlate} lượt đỗ mở cùng lúc (phải là 1). Lỗi trả về: ${JSON.stringify(result.errors)}`
      );
      assert.strictEqual(result.successCount, 1, `Có ${result.successCount} lệnh vào bãi thành công (phải là 1)`);
    },
  },
  {
    name: `${CONCURRENCY} lần bấm "Xe ra" cùng lúc trên MỘT lượt gửi -> chỉ thu tiền 1 lần`,
    run: async (ctx) => {
      const [spotId] = await ctx.newSpots(1);
      const plate = `29X${RUN_ID}`;
      await service.entry({ licensePlate: plate, vehicleTypeId: ctx.vehicleTypeId, parkingSpotId: spotId }, ctx.userId);
      const record = await prisma.parkingRecord.findFirst({
        where: { licensePlate: plate, status: 'parked' },
        select: { id: true },
      });
      assert.ok(record, 'Không tạo được lượt gửi để kiểm thử xe ra');

      const result = await runConcurrently(
        Array.from({ length: CONCURRENCY }, () => () =>
          service.exit({ parkingRecordId: record.id, paymentMethod: 'cash' }, ctx.userId)
        )
      );

      const payments = await prisma.payment.count({ where: { parkingRecordId: record.id } });
      const spot = await prisma.parkingSpot.findUnique({ where: { id: spotId } });

      assert.ok(
        payments <= 1,
        `Sinh ${payments} phiếu thu cho cùng một lượt gửi (tối đa 1). Lỗi: ${JSON.stringify(result.errors)}`
      );
      assert.strictEqual(result.successCount, 1, `Có ${result.successCount} lệnh xe ra thành công (phải là 1)`);
      assert.strictEqual(spot?.status, 'available', 'Chỗ đỗ phải được trả về trạng thái trống');
    },
  },
];

(async () => {
  console.log('=== Parking concurrency tests (DB that) ===');
  let passed = 0;
  let failed = 0;

  try {
    const ctx = await setup();
    for (const testCase of cases) {
      try {
        await testCase.run(ctx);
        passed += 1;
        console.log(`PASS  ${testCase.name}`);
      } catch (err) {
        failed += 1;
        console.error(`FAIL  ${testCase.name}`);
        console.error(`      ${(err as Error).message}`);
      }
    }
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed, ${cases.length} total`);
  if (failed > 0) process.exit(1);
})();
