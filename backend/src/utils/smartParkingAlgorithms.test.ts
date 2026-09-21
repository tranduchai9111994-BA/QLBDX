/**
 * Kiểm thử thuật toán gợi ý chỗ đỗ (SAW + Exponential Decay).
 *
 * Chạy: npm run test:saw  (trong thư mục backend)
 *
 * Các ca kiểm thử bám theo tài liệu thiết kế
 * docs/DE_XUAT_THUAT_TOAN_GOI_Y_CHO_DO_THONG_MINH.md — đặc biệt là ví dụ minh hoạ mục 4.5,
 * để tài liệu và code không lệch nhau.
 */
import assert from 'assert';
import {
  calcHourlyPattern,
  calcSpotPreference,
  calcTypeMatch,
  calcZonePreference,
  calcZoneStats,
  scoreSAW,
  SpotCandidate,
  DEFAULT_SAW_WEIGHTS,
} from './smartParkingAlgorithms';

type Case = {
  name: string;
  run: () => void;
};

/** Làm tròn 3 chữ số để so sánh với con số viết trong tài liệu. */
const r3 = (n: number) => Math.round(n * 1000) / 1000;

const rec = (zone: string | null, entryTime = new Date('2026-09-21T14:00:00')) => ({
  entryTime,
  parkingSpot: zone ? { zone: { name: zone } } : null,
});

const cases: Case[] = [
  // ── Exponential Decay ────────────────────────────────────────────────────
  {
    name: 'Decay: lượt gần nhất có trọng số lớn nhất = α',
    run: () => {
      const scores = calcZonePreference([rec('Khu A'), rec('Khu B')], 0.3);
      assert.strictEqual(r3(scores.get('Khu A')!), 0.3);
      assert.strictEqual(r3(scores.get('Khu B')!), 0.21); // 0.3 × 0.7^1
    },
  },
  {
    name: 'Decay: nhiều lượt cũ ở Khu A vẫn thắng 1 lượt mới ở Khu B',
    run: () => {
      // Khu B đứng đầu (mới nhất), Khu A chiếm 3 lượt kế tiếp
      const scores = calcZonePreference(
        [rec('Khu B'), rec('Khu A'), rec('Khu A'), rec('Khu A')],
        0.3,
      );
      assert.ok(scores.get('Khu A')! > scores.get('Khu B')!, 'Khu A phải cao điểm hơn Khu B');
    },
  },
  {
    name: 'Decay: bản ghi thiếu khu vực bị bỏ qua, không làm hỏng điểm',
    run: () => {
      const scores = calcZonePreference([rec(null), rec('Khu A')], 0.3);
      assert.strictEqual(scores.has('Khu A'), true);
      assert.strictEqual(scores.size, 1);
    },
  },
  {
    name: 'Decay: alpha ngoài khoảng (0,1) rơi về mặc định 0.3',
    run: () => {
      const scores = calcZonePreference([rec('Khu A')], 5);
      assert.strictEqual(r3(scores.get('Khu A')!), 0.3);
    },
  },

  // ── calcSpotPreference (phá thế hoà điểm trong cùng một khu) ─────────────
  {
    name: 'SpotPreference: chỗ khách hay quay lại có điểm cao hơn chỗ chỉ đỗ 1 lần',
    run: () => {
      const scores = calcSpotPreference(
        [{ parkingSpotId: 9 }, { parkingSpotId: 3 }, { parkingSpotId: 9 }],
        0.3,
      );
      assert.ok(scores.get(9)! > scores.get(3)!, 'Chỗ số 9 (2 lượt) phải hơn chỗ số 3 (1 lượt)');
    },
  },
  {
    name: 'SpotPreference: bản ghi thiếu parkingSpotId bị bỏ qua',
    run: () => {
      const scores = calcSpotPreference([{ parkingSpotId: null }, { parkingSpotId: 5 }], 0.3);
      assert.strictEqual(scores.size, 1);
      assert.strictEqual(scores.has(5), true);
    },
  },
  {
    name: 'Hồi quy: khách quen cùng một khu — C1 gộp điểm chỗ phải phá được thế hoà',
    run: () => {
      // Tái hiện lỗi đo được trên dữ liệu thật: mọi chỗ trống đều thuộc Khu A nên C2–C5 bằng
      // nhau, nếu C1 chỉ ở mức khu thì cả 3 chỗ cùng 1.00 điểm và thuật toán vô nghĩa.
      const zoneScore = 0.51; // điểm Khu A, giống nhau cho mọi chỗ trong khu
      const spotScores = new Map([[9, 0.3]]); // khách hay đỗ đúng chỗ A09
      const base = { zoneAvailability: 0.9, typeMatchScore: 1, peakHourFit: 0.5, currentOccupancy: 0.1 };
      const candidates: SpotCandidate[] = [
        { spotId: 3, spotNumber: 'A03', zoneName: 'Khu A', zonePreference: zoneScore + (spotScores.get(3) || 0), ...base },
        { spotId: 9, spotNumber: 'A09', zoneName: 'Khu A', zonePreference: zoneScore + (spotScores.get(9) || 0), ...base },
        { spotId: 12, spotNumber: 'A12', zoneName: 'Khu A', zonePreference: zoneScore + (spotScores.get(12) || 0), ...base },
      ];
      const results = scoreSAW(candidates);
      assert.strictEqual(results[0].spotNumber, 'A09', 'Phải gợi ý đúng chỗ khách hay đỗ');
      assert.ok(
        results[0].totalScore > results[1].totalScore,
        `Điểm phải khác nhau, đang là ${results[0].totalScore} vs ${results[1].totalScore}`,
      );
    },
  },

  // ── calcZoneStats ────────────────────────────────────────────────────────
  {
    name: 'ZoneStats: tỷ lệ trống và mức đông đúc cộng lại bằng 1',
    run: () => {
      const stats = calcZoneStats([
        { zone: { name: 'Khu A' }, status: 'available' },
        { zone: { name: 'Khu A' }, status: 'occupied' },
        { zone: { name: 'Khu A' }, status: 'occupied' },
        { zone: { name: 'Khu B' }, status: 'available' },
      ]);
      assert.strictEqual(r3(stats.get('Khu A')!.availability), 0.333);
      assert.strictEqual(r3(stats.get('Khu A')!.occupancy), 0.667);
      assert.strictEqual(stats.get('Khu B')!.availability, 1);
      assert.strictEqual(stats.get('Khu B')!.occupancy, 0);
    },
  },
  {
    name: 'ZoneStats: chỗ bảo trì tính vào tổng nhưng không tính là trống',
    run: () => {
      const stats = calcZoneStats([
        { zone: { name: 'Khu A' }, status: 'available' },
        { zone: { name: 'Khu A' }, status: 'maintenance' },
      ]);
      assert.strictEqual(stats.get('Khu A')!.availability, 0.5);
    },
  },

  // ── calcTypeMatch ────────────────────────────────────────────────────────
  {
    name: 'TypeMatch: khu chuyên đúng loại xe → 1.0',
    run: () => {
      const score = calcTypeMatch({ spotNumber: 'A-05', zone: { name: 'Khu A - Xe máy' } }, 'Xe máy');
      assert.strictEqual(score, 1);
    },
  },
  {
    name: 'TypeMatch: khu VIP (nhận mọi loại xe) → 0.5',
    run: () => {
      const score = calcTypeMatch({ spotNumber: 'V-01', zone: { name: 'Khu VIP' } }, 'Xe máy');
      assert.strictEqual(score, 0.5);
    },
  },

  // ── calcHourlyPattern ────────────────────────────────────────────────────
  {
    name: 'HourlyPattern: khu khách hay đỗ đúng khung giờ → điểm 1.0',
    run: () => {
      const pattern = calcHourlyPattern(
        [rec('Khu A', new Date('2026-09-20T14:30:00')), rec('Khu A', new Date('2026-09-19T13:10:00'))],
        14,
      );
      assert.strictEqual(pattern.get('Khu A'), 1);
    },
  },
  {
    name: 'HourlyPattern: lệch giờ tính vòng tròn — 23h và 0h là hai khung liền kề',
    run: () => {
      const pattern = calcHourlyPattern([rec('Khu A', new Date('2026-09-20T23:00:00'))], 0);
      assert.strictEqual(pattern.get('Khu A'), 1);
    },
  },
  {
    name: 'HourlyPattern: đỗ lệch hẳn khung giờ → điểm 0',
    run: () => {
      const pattern = calcHourlyPattern([rec('Khu A', new Date('2026-09-20T06:00:00'))], 14);
      assert.strictEqual(pattern.get('Khu A'), 0);
    },
  },

  // ── SAW ──────────────────────────────────────────────────────────────────
  {
    name: 'SAW: khớp đúng ví dụ minh hoạ mục 4.5 của tài liệu thiết kế',
    run: () => {
      const candidates: SpotCandidate[] = [
        { spotId: 1, spotNumber: 'A-05', zoneName: 'Khu A', zonePreference: 0.52, zoneAvailability: 0.3, typeMatchScore: 1.0, peakHourFit: 0.8, currentOccupancy: 0.7 },
        { spotId: 2, spotNumber: 'B-12', zoneName: 'Khu B', zonePreference: 0.38, zoneAvailability: 0.6, typeMatchScore: 0.5, peakHourFit: 0.9, currentOccupancy: 0.4 },
        { spotId: 3, spotNumber: 'C-03', zoneName: 'Khu C', zonePreference: 0.1, zoneAvailability: 0.8, typeMatchScore: 1.0, peakHourFit: 0.6, currentOccupancy: 0.2 },
      ];
      const results = scoreSAW(candidates, DEFAULT_SAW_WEIGHTS);

      assert.strictEqual(results[0].spotNumber, 'A-05');
      assert.strictEqual(results[1].spotNumber, 'B-12');
      assert.strictEqual(results[2].spotNumber, 'C-03');

      // Tài liệu ghi 0.762 / 0.693 / 0.683 (làm tròn từng bước), sai số cho phép 0.005.
      assert.ok(Math.abs(results[0].totalScore - 0.762) < 0.005, `A-05 = ${results[0].totalScore}`);
      assert.ok(Math.abs(results[1].totalScore - 0.693) < 0.005, `B-12 = ${results[1].totalScore}`);
      assert.ok(Math.abs(results[2].totalScore - 0.683) < 0.005, `C-03 = ${results[2].totalScore}`);

      assert.deepStrictEqual(results.map((r) => r.rank), [1, 2, 3]);
    },
  },
  {
    name: 'SAW: điểm luôn nằm trong [0,1] khi tổng trọng số = 1',
    run: () => {
      const candidates: SpotCandidate[] = [
        { spotId: 1, spotNumber: 'A-01', zoneName: 'Khu A', zonePreference: 0.9, zoneAvailability: 1, typeMatchScore: 1, peakHourFit: 1, currentOccupancy: 0 },
        { spotId: 2, spotNumber: 'B-01', zoneName: 'Khu B', zonePreference: 0, zoneAvailability: 0.1, typeMatchScore: 0.5, peakHourFit: 0, currentOccupancy: 0.9 },
      ];
      for (const r of scoreSAW(candidates)) {
        assert.ok(r.totalScore >= 0 && r.totalScore <= 1, `Điểm ngoài thang: ${r.totalScore}`);
      }
    },
  },
  {
    name: 'SAW: xe mới chưa có lịch sử (C1 = 0 toàn bộ) vẫn xếp hạng được theo C2–C5',
    run: () => {
      const candidates: SpotCandidate[] = [
        { spotId: 1, spotNumber: 'A-01', zoneName: 'Khu A', zonePreference: 0, zoneAvailability: 0.2, typeMatchScore: 0.5, peakHourFit: 0.5, currentOccupancy: 0.8 },
        { spotId: 2, spotNumber: 'B-01', zoneName: 'Khu B', zonePreference: 0, zoneAvailability: 0.9, typeMatchScore: 1, peakHourFit: 0.5, currentOccupancy: 0.1 },
      ];
      const results = scoreSAW(candidates);
      assert.strictEqual(results[0].spotNumber, 'B-01', 'Phải chọn khu trống hơn và hợp loại xe hơn');
      assert.ok(Number.isFinite(results[0].totalScore), 'Không được sinh NaN khi cả cột C1 = 0');
    },
  },
  {
    name: 'SAW: chỉ còn đúng 1 chỗ trống → không lỗi chia cho 0, trả về chính chỗ đó',
    run: () => {
      const results = scoreSAW([
        { spotId: 7, spotNumber: 'C-09', zoneName: 'Khu C', zonePreference: 0, zoneAvailability: 0, typeMatchScore: 0.5, peakHourFit: 0.5, currentOccupancy: 1 },
      ]);
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].spotId, 7);
      assert.ok(Number.isFinite(results[0].totalScore));
    },
  },
  {
    name: 'SAW: không còn chỗ trống → trả về mảng rỗng',
    run: () => {
      assert.deepStrictEqual(scoreSAW([]), []);
    },
  },
  {
    name: 'SAW: đổi trọng số làm đổi kết quả gợi ý',
    run: () => {
      const candidates: SpotCandidate[] = [
        { spotId: 1, spotNumber: 'A-01', zoneName: 'Khu A', zonePreference: 0.9, zoneAvailability: 0.5, typeMatchScore: 1, peakHourFit: 0.5, currentOccupancy: 0.5 },
        { spotId: 2, spotNumber: 'B-01', zoneName: 'Khu B', zonePreference: 0, zoneAvailability: 1, typeMatchScore: 1, peakHourFit: 0.5, currentOccupancy: 0 },
      ];
      // Trọng số mặc định: khu ưa thích chi phối → A-01
      assert.strictEqual(scoreSAW(candidates, DEFAULT_SAW_WEIGHTS)[0].spotNumber, 'A-01');
      // Admin hạ trọng số khu ưa thích, đẩy trọng số "còn trống" lên → B-01
      assert.strictEqual(scoreSAW(candidates, [0.1, 0.5, 0.2, 0.1, 0.1])[0].spotNumber, 'B-01');
    },
  },
  {
    name: 'SAW: câu giải thích nêu điểm và tiêu chí đóng góp nhiều nhất',
    run: () => {
      const results = scoreSAW([
        { spotId: 1, spotNumber: 'A-01', zoneName: 'Khu A', zonePreference: 0.5, zoneAvailability: 0.5, typeMatchScore: 1, peakHourFit: 0.5, currentOccupancy: 0.5 },
      ]);
      assert.ok(results[0].explanation.includes('Điểm'), results[0].explanation);
      assert.ok(results[0].explanation.includes('Mức ưa thích chỗ đỗ'), results[0].explanation);
      // Không được ghi "/1.00": điểm SAW là điểm tương đối trong nhóm, không phải thang tuyệt đối.
      assert.ok(!results[0].explanation.includes('/1.00'), results[0].explanation);
    },
  },
  {
    name: 'SAW: nhiều chỗ hoà điểm đầu bảng → câu giải thích nói rõ là hoà, không vờ có căn cứ',
    run: () => {
      const base = { zoneName: 'Khu A', zonePreference: 0, zoneAvailability: 0.9, typeMatchScore: 1, peakHourFit: 0.5, currentOccupancy: 0.1 };
      const results = scoreSAW([
        { spotId: 1, spotNumber: 'A03', ...base },
        { spotId: 2, spotNumber: 'A04', ...base },
        { spotId: 3, spotNumber: 'A06', ...base },
      ]);
      assert.ok(results[0].explanation.includes('3 chỗ trống cùng mức điểm cao nhất'), results[0].explanation);
    },
  },
  {
    name: 'SAW: không sửa mảng đầu vào (hàm thuần tuý)',
    run: () => {
      const candidates: SpotCandidate[] = [
        { spotId: 1, spotNumber: 'A-01', zoneName: 'Khu A', zonePreference: 0.1, zoneAvailability: 0.1, typeMatchScore: 0.5, peakHourFit: 0.5, currentOccupancy: 0.5 },
        { spotId: 2, spotNumber: 'B-01', zoneName: 'Khu B', zonePreference: 0.9, zoneAvailability: 0.9, typeMatchScore: 1, peakHourFit: 0.5, currentOccupancy: 0.1 },
      ];
      scoreSAW(candidates);
      assert.strictEqual(candidates[0].spotNumber, 'A-01', 'Thứ tự mảng gốc phải giữ nguyên');
      assert.strictEqual((candidates[0] as any).totalScore, undefined, 'Không được gắn thêm field vào object gốc');
    },
  },
];

let passed = 0;
let failed = 0;

console.log('=== Smart parking algorithms (SAW) tests ===');
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
