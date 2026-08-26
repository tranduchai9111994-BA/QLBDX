import assert from 'assert';
import { calculateParkingFee } from './feeCalculator';

type Case = {
  name: string;
  run: () => void;
};

const HOURLY = 5000;
const DAILY = 50000;
const rates = { hourlyRate: HOURLY, dailyRate: DAILY };

const cases: Case[] = [
  {
    name: 'Gửi 0 phút → phí = 0',
    run: () => {
      const result = calculateParkingFee(0, rates);
      assert.strictEqual(result.durationMinutes, 0);
      assert.strictEqual(result.durationHours, 0);
      assert.strictEqual(result.fee, 0);
    },
  },
  {
    name: 'Gửi vài giây (< 1 phút) → làm tròn lên 1 phút / 1 giờ theo ceil',
    run: () => {
      const result = calculateParkingFee(30 * 1000, rates); // 30 giây
      assert.strictEqual(result.durationMinutes, 1);
      assert.strictEqual(result.durationHours, 1);
      assert.strictEqual(result.fee, HOURLY);
    },
  },
  {
    name: 'Gửi đúng 1 giờ → 1 * hourlyRate',
    run: () => {
      const result = calculateParkingFee(60 * 60 * 1000, rates);
      assert.strictEqual(result.durationHours, 1);
      assert.strictEqual(result.fee, HOURLY);
    },
  },
  {
    name: 'Mốc chuyển giá trong ngày: hourly * hours > dailyRate → bị cap = dailyRate',
    run: () => {
      // 11 giờ * 5000 = 55000 > 50000 → fee = 50000
      const result = calculateParkingFee(11 * 60 * 60 * 1000, rates);
      assert.strictEqual(result.durationHours, 11);
      assert.strictEqual(result.fee, DAILY);
      assert.strictEqual(result.cappedByDailyRate, true);
    },
  },
  {
    name: 'Đúng mốc 24 giờ → vẫn tính trong ngày, cap dailyRate',
    run: () => {
      const result = calculateParkingFee(24 * 60 * 60 * 1000, rates);
      assert.strictEqual(result.durationHours, 24);
      assert.strictEqual(result.fee, DAILY);
      assert.ok(result.durationHours <= 24);
    },
  },
  {
    name: 'Qua đêm > 24 giờ (25h) → ceil(25/24)=2 ngày * dailyRate',
    run: () => {
      const result = calculateParkingFee(25 * 60 * 60 * 1000, rates);
      assert.strictEqual(result.durationHours, 25);
      assert.strictEqual(result.billedDays, 2);
      assert.strictEqual(result.fee, 2 * DAILY);
    },
  },
  {
    name: 'Gửi 48 giờ đúng → 2 ngày * dailyRate',
    run: () => {
      const result = calculateParkingFee(48 * 60 * 60 * 1000, rates);
      assert.strictEqual(result.billedDays, 2);
      assert.strictEqual(result.fee, 2 * DAILY);
    },
  },
  {
    name: 'Gửi 49 giờ → ceil(49/24)=3 ngày * dailyRate',
    run: () => {
      const result = calculateParkingFee(49 * 60 * 60 * 1000, rates);
      assert.strictEqual(result.billedDays, 3);
      assert.strictEqual(result.fee, 3 * DAILY);
    },
  },
  {
    name: 'Có gói dịch vụ active → miễn phí dù gửi qua đêm',
    run: () => {
      const result = calculateParkingFee(30 * 60 * 60 * 1000, rates, { hasPackage: true });
      assert.strictEqual(result.fee, 0);
    },
  },
];

let passed = 0;
let failed = 0;

console.log('=== Fee calculator tests ===');
for (const testCase of cases) {
  try {
    testCase.run();
    passed += 1;
    console.log(`PASS  ${testCase.name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL  ${testCase.name}`);
    console.error(err);
  }
}

console.log(`\nResult: ${passed} passed, ${failed} failed, ${cases.length} total`);
if (failed > 0) {
  process.exit(1);
}
