/**
 * Thuật toán gợi ý chỗ đỗ thông minh — SAW (Simple Additive Weighting).
 *
 * Tài liệu thiết kế: docs/DE_XUAT_THUAT_TOAN_GOI_Y_CHO_DO_THONG_MINH.md
 *
 * Bài toán: trong số các chỗ đỗ còn trống và hợp loại xe, chọn ra chỗ tốt nhất cho khách.
 * Đây là bài toán ra quyết định đa tiêu chí (MCDA) — mỗi chỗ được chấm điểm trên 5 tiêu chí,
 * mỗi tiêu chí có trọng số, chỗ nào tổng điểm cao nhất thì gợi ý.
 *
 *   SAW  — Fishburn, P.C. (1967). Operations Research, 15(3), 537–542.
 *          Hwang, C.L. & Yoon, K. (1981). Multiple Attribute Decision Making. Springer-Verlag.
 *   EWMA — Holt, C.C. (1957/2004). International Journal of Forecasting, 20(1), 5–10.
 *          (dùng làm bước tiền xử lý sinh tiêu chí C1, không phải thuật toán ra quyết định)
 *
 * Chọn SAW thay vì TOPSIS vì điểm SAW giải thích được bằng một câu tiếng Việt mà nhân viên bãi
 * xe đọc hiểu ngay ("điểm 0.76 — khu ưa thích chiếm 35%"), còn TOPSIS phải nói tới "khoảng cách
 * Euclidean đến phương án lý tưởng". Với 5 tiêu chí và vài chục chỗ đỗ, hai thuật toán cho kết
 * quả gần như trùng nhau nên không đáng đánh đổi tính giải thích được.
 */
import { getSpotCategory, getVehicleCategory } from './businessRules';

/** Số tiêu chí của mô hình — C1..C5, xem bảng tiêu chí trong tài liệu thiết kế. */
export const SAW_CRITERIA_COUNT = 5;

/**
 * Trọng số mặc định [w1..w5], tổng = 1.0. Dùng khi chưa cấu hình luật PARKING_REC_WEIGHTS
 * ở hệ chuyên gia (domain `parking_recommendation`).
 */
export const DEFAULT_SAW_WEIGHTS = [0.35, 0.25, 0.2, 0.1, 0.1];

/** Hệ số suy giảm mặc định của Exponential Decay. Càng lớn thì lượt đỗ gần đây càng áp đảo. */
export const DEFAULT_DECAY_ALPHA = 0.3;

/**
 * Chiều của từng tiêu chí: benefit = càng cao càng tốt, cost = càng thấp càng tốt.
 * Chỉ C5 (mức độ đông đúc) là cost.
 */
const IS_BENEFIT = [true, true, true, true, false];

/** Tên tiêu chí hiển thị cho người dùng — thứ tự phải khớp IS_BENEFIT và mảng trọng số. */
export const CRITERIA_LABELS = [
  'Mức ưa thích chỗ đỗ',
  'Tỷ lệ còn trống',
  'Phù hợp loại xe',
  'Phù hợp giờ quen',
  'Mức độ vắng',
];

/** Một chỗ đỗ ứng viên kèm giá trị thô của 5 tiêu chí. */
export interface SpotCandidate {
  spotId: number;
  spotNumber: string;
  zoneName: string;
  /**
   * C1 — mức ưa thích chỗ đỗ, từ Exponential Decay (benefit).
   * Gộp hai mức: điểm của KHU + điểm của ĐÚNG CHỖ đó. Xem calcSpotPreference() để biết vì sao
   * cần thành phần "đúng chỗ".
   */
  zonePreference: number;
  /** C2 — tỷ lệ chỗ còn trống của khu, 0–1 (benefit). */
  zoneAvailability: number;
  /** C3 — độ tương thích loại xe, 0.5 hoặc 1.0 (benefit). */
  typeMatchScore: number;
  /** C4 — mức phù hợp với khung giờ khách hay đỗ, 0–1 (benefit). */
  peakHourFit: number;
  /** C5 — mức độ đông đúc hiện tại của khu, 0–1 (cost). */
  currentOccupancy: number;
}

export interface ScoredSpot extends SpotCandidate {
  /** Giá trị 5 tiêu chí sau khi chuẩn hoá về [0,1]. */
  normalizedScores: number[];
  /** Điểm SAW tổng hợp ∈ [0,1] — càng cao càng nên gợi ý. */
  totalScore: number;
  rank: number;
  /** Câu giải thích hiển thị cho nhân viên. */
  explanation: string;
}

/**
 * Bước tiền xử lý — Exponential Decay Weighting: chấm điểm "khu ưa thích" cho từng khu vực.
 *
 * Khác với cách đếm tần suất cũ (mọi lượt đỗ có trọng số như nhau), ở đây lượt càng gần đây
 * trọng số càng lớn: weight(i) = α × (1-α)^i. Nhờ vậy khi khách đổi thói quen sang khu khác,
 * hệ thống bám theo sau vài lượt thay vì phải đợi đủ đa số trong 30 lượt.
 *
 * @param recentRecords Bản ghi đỗ xe đã sắp xếp entryTime GIẢM DẦN (gần nhất đứng đầu).
 * @param alpha         Hệ số suy giảm ∈ (0,1).
 * @returns Map<tên khu, điểm ưa thích>. Tổng các điểm < 1 (phần đuôi bị cắt) — không sao vì
 *          SAW sẽ chuẩn hoá lại theo giá trị lớn nhất.
 */
export function calcZonePreference(
  recentRecords: Array<{ parkingSpot?: { zone?: { name: string } | null } | null }>,
  alpha: number = DEFAULT_DECAY_ALPHA,
): Map<string, number> {
  // Map là "quyển sổ hai cột": cột trái tên khu, cột phải điểm tích luỹ.
  const scores = new Map<string, number>();
  // Alpha nằm ngoài khoảng (0,1) thì công thức vô nghĩa (trọng số âm hoặc không giảm) → dùng mặc định.
  const a = alpha > 0 && alpha < 1 ? alpha : DEFAULT_DECAY_ALPHA;

  recentRecords.forEach((record, index) => {
    const zoneName = record.parkingSpot?.zone?.name;
    if (!zoneName) return; // bản ghi thiếu khu (dữ liệu cũ/hỏng) thì bỏ qua, không làm hỏng tổng

    // `index` là THỨ TỰ TỪ MỚI TỚI CŨ: 0 là lượt gần nhất, 1 là lượt trước đó...
    // Mảng đã được sắp entryTime giảm dần từ trước khi truyền vào — nếu ai đó đổi thứ tự sắp xếp
    // ở tầng truy vấn thì công thức này lập tức chấm ngược, ưu tiên lượt đỗ CŨ NHẤT.
    //
    // Math.pow(1-a, index) là phép luỹ thừa: (1-a) nhân với chính nó `index` lần.
    // Với a = 0.3 thì trọng số giảm dần theo cấp số nhân khi đi ngược về quá khứ:
    //     lượt gần nhất  0.3 × 0.7⁰ = 0.300
    //     lượt trước đó  0.3 × 0.7¹ = 0.210
    //     lượt trước nữa 0.3 × 0.7² = 0.147 ...
    // Nhờ vậy khách đổi thói quen sang khu mới thì sau vài lượt khu mới đã vượt lên, không phải
    // đợi nó chiếm đa số trong cả 30 lượt như cách đếm tần suất cũ.
    const weight = a * Math.pow(1 - a, index);

    // Cộng dồn vào khu tương ứng. `|| 0` để lần đầu gặp khu đó thì bắt đầu từ 0 thay vì undefined.
    scores.set(zoneName, (scores.get(zoneName) || 0) + weight);
  });

  return scores;
}

/**
 * Cùng công thức Exponential Decay nhưng chấm điểm cho TỪNG CHỖ ĐỖ cụ thể thay vì cả khu.
 *
 * VÌ SAO CẦN HÀM NÀY — bốn tiêu chí C2–C5 đều là thuộc tính của KHU, nên mọi chỗ NẰM TRONG
 * CÙNG MỘT KHU có giá trị y hệt nhau. Mà bộ lọc tương thích loại xe
 * (isSpotCompatibleWithVehicleType) thường thu hẹp ứng viên về một hoặc hai khu, và phần lớn
 * ứng viên dồn vào khu chuyên dụng của loại xe đó.
 *
 * Hệ quả đo được trên dữ liệu thật: cả 45 chỗ trống của Khu A cùng ra 1.00 điểm, SAW không phân
 * biệt được chỗ nào với chỗ nào và rơi về đúng hành vi cũ (lấy chỗ đầu danh sách).
 *
 * Điểm "đúng chỗ" là dữ kiện DUY NHẤT ở mức từng chỗ đỗ mà dữ liệu hiện có cung cấp được, nên
 * nó là thứ phá được thế hoà đó. Nghiệp vụ cũng đúng: khách quen thường quay lại đúng chỗ cũ.
 *
 * @param recentRecords Bản ghi đỗ xe đã sắp entryTime GIẢM DẦN.
 * @returns Map<id chỗ đỗ, điểm ưa thích>.
 */
export function calcSpotPreference(
  recentRecords: Array<{ parkingSpotId?: number | null }>,
  alpha: number = DEFAULT_DECAY_ALPHA,
): Map<number, number> {
  const scores = new Map<number, number>();
  const a = alpha > 0 && alpha < 1 ? alpha : DEFAULT_DECAY_ALPHA;

  recentRecords.forEach((record, index) => {
    const spotId = record.parkingSpotId;
    if (typeof spotId !== 'number') return;
    const weight = a * Math.pow(1 - a, index);
    scores.set(spotId, (scores.get(spotId) || 0) + weight);
  });

  return scores;
}

/**
 * Tính tỷ lệ còn trống (C2) và mức độ đông đúc (C5) của từng khu.
 *
 * Cần danh sách TOÀN BỘ chỗ đỗ chứ không chỉ chỗ trống, vì mẫu số là tổng số chỗ của khu.
 */
export function calcZoneStats(
  allSpots: Array<{ zone?: { name: string } | null; status: string }>,
): Map<string, { availability: number; occupancy: number }> {
  const counts = new Map<string, { total: number; available: number }>();

  for (const spot of allSpots) {
    const zone = spot.zone?.name;
    if (!zone) continue;
    const entry = counts.get(zone) || { total: 0, available: 0 };
    entry.total++;
    if (spot.status === 'available') entry.available++;
    counts.set(zone, entry);
  }

  const result = new Map<string, { availability: number; occupancy: number }>();
  for (const [zone, { total, available }] of counts) {
    const availability = total > 0 ? available / total : 0;
    result.set(zone, { availability, occupancy: 1 - availability });
  }
  return result;
}

/**
 * Tiêu chí C3 — độ tương thích giữa chỗ đỗ và loại xe.
 *
 * Dùng lại cách phân nhóm của businessRules.ts để không sinh ra một quy ước đặt tên khu thứ hai:
 *   - khu chuyên đúng nhóm xe (khu xe máy ↔ xe máy)  → 1.0
 *   - khu tổng hợp hoặc loại xe không xác định nhóm  → 0.5
 *
 * Chỗ KHÔNG hợp loại xe đã bị lọc bỏ từ trước bởi isSpotCompatibleWithVehicleType() nên không
 * cần trả về 0 ở đây.
 */
export function calcTypeMatch(
  spot: {
    spotNumber: string;
    spotType?: string | null;
    zone?: { name?: string | null; description?: string | null } | null;
  },
  vehicleTypeName: string,
): number {
  const spotCategory = getSpotCategory(spot);
  const vehicleCategory = getVehicleCategory(vehicleTypeName);

  if (spotCategory === 'any' || vehicleCategory === 'any') return 0.5;
  return spotCategory === vehicleCategory ? 1.0 : 0.5;
}

/**
 * Tiêu chí C4 — mức phù hợp với khung giờ: khu nào khách hay đỗ vào đúng khung giờ hiện tại
 * (±1 giờ) thì điểm cao.
 *
 * @param currentHour Giờ hiện tại (0–23). Truyền vào thay vì đọc `new Date()` bên trong để
 *                    hàm thuần tuý, test được.
 */
export function calcHourlyPattern(
  recentRecords: Array<{ entryTime: Date; parkingSpot?: { zone?: { name: string } | null } | null }>,
  currentHour: number = new Date().getHours(),
): Map<string, number> {
  const counts = new Map<string, { sameHour: number; total: number }>();

  for (const r of recentRecords) {
    const zone = r.parkingSpot?.zone?.name;
    if (!zone) continue;
    const entry = counts.get(zone) || { sameHour: 0, total: 0 };
    entry.total++;
    const recordHour = new Date(r.entryTime).getHours();
    // Lệch giờ tính vòng tròn: 23h và 0h là hai khung liền kề, không phải cách nhau 23 tiếng.
    const diff = Math.abs(recordHour - currentHour);
    if (Math.min(diff, 24 - diff) <= 1) entry.sameHour++;
    counts.set(zone, entry);
  }

  const result = new Map<string, number>();
  for (const [zone, { sameHour, total }] of counts) {
    result.set(zone, total > 0 ? sameHour / total : 0.5);
  }
  return result;
}

/**
 * SAW — Simple Additive Weighting.
 *
 *   Bước 1: chuẩn hoá mọi tiêu chí về [0,1]
 *             benefit: r_ij = x_ij / max(x_j)
 *             cost:    r_ij = min(x_j) / x_ij
 *   Bước 2: Score_i = Σ (w_j × r_ij)
 *   Bước 3: xếp hạng giảm dần theo Score
 *
 * ── HIỂU BẰNG VÍ DỤ ĐỜI THƯỜNG ──────────────────────────────────────────────
 * Y hệt cách người ta chọn phòng trọ. Có 3 phòng, quan tâm 2 điều là tiền và
 * khoảng cách:
 *
 *     Phòng A: 3 triệu, 8 km     Phòng B: 5 triệu, 2 km     Phòng C: 4 triệu, 5 km
 *
 * Không thể cộng thẳng "3 triệu + 8 km" vì hai thứ khác đơn vị. Nên làm 3 bước:
 *
 *   1. QUY VỀ THANG CHUNG — lấy cái tốt nhất từng mặt làm chuẩn 10 điểm.
 *      Tiền: A rẻ nhất → 10đ; C = 3/4 → 7,5đ; B = 3/5 → 6đ.
 *      (tiền càng THẤP càng tốt nên lấy nhỏ nhất chia cho từng số)
 *      Khoảng cách: B gần nhất → 10đ; C = 2/5 → 4đ; A = 2/8 → 2,5đ.
 *
 *   2. NÓI RÕ CÁI NÀO QUAN TRỌNG HƠN — VD tiền 70%, khoảng cách 30%.
 *
 *   3. NHÂN RỒI CỘNG:
 *      A = 10×70% + 2,5×30% = 7,75   ← chọn A
 *      B =  6×70% + 10 ×30% = 7,20
 *      C = 7,5×70% + 4 ×30% = 6,45
 *
 * Hàm này làm đúng 3 bước đó, chỉ khác: 5 mặt thay vì 2, vài chục chỗ đỗ thay
 * vì 3 phòng, và dùng thang 1 thay vì thang 10.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * @param candidates Danh sách ứng viên đã tính sẵn giá trị thô 5 tiêu chí ("các phòng trọ").
 * @param weights    Mảng 5 trọng số ("70% - 30%"), tổng nên bằng 1.0 để điểm nằm trong [0,1].
 * @returns Mảng MỚI đã sắp xếp giảm dần theo điểm (không sửa mảng đầu vào).
 */
export function scoreSAW(
  candidates: SpotCandidate[],
  weights: number[] = DEFAULT_SAW_WEIGHTS,
): ScoredSpot[] {
  if (candidates.length === 0) return [];

  // Người gọi đưa thiếu/thừa trọng số thì dùng bộ mặc định, thay vì để công thức chạy lệch cột.
  const w = weights.length === SAW_CRITERIA_COUNT ? weights : DEFAULT_SAW_WEIGHTS;

  // Gom dữ liệu thành BẢNG SỐ: mỗi dòng một chỗ đỗ, mỗi cột một tiêu chí.
  // Phải gom thành bảng vì bước chuẩn hoá cần so sánh THEO CỘT ("phòng nào rẻ nhất") —
  // dữ liệu nằm rải rác trong từng object thì không so được.
  //
  //          C1     C2    C3    C4    C5
  //   A-05  0.52   0.30   1.0   0.8   0.70
  //   B-12  0.38   0.60   0.5   0.9   0.40
  const criteria: number[][] = candidates.map((c) => [
    c.zonePreference, // C1 — benefit
    c.zoneAvailability, // C2 — benefit
    c.typeMatchScore, // C3 — benefit
    c.peakHourFit, // C4 — benefit
    c.currentOccupancy, // C5 — cost
  ]);

  // ── BƯỚC 1: chuẩn hoá — "quy về thang chung, lấy cái tốt nhất làm chuẩn" ──
  // Tạo sẵn bảng kết quả cùng kích thước, điền 0, rồi ghi đè từng ô bên dưới.
  const normalized: number[][] = candidates.map(() => new Array(SAW_CRITERIA_COUNT).fill(0));

  // Vòng ngoài chạy TỪNG CỘT (từng tiêu chí) — xử lý xong cột "tiền" mới sang cột "khoảng cách".
  for (let j = 0; j < SAW_CRITERIA_COUNT; j++) {
    const column = criteria.map((row) => row[j]); // rút cả cột j ra thành một dãy
    const maxVal = Math.max(...column); // "phòng nào tốt nhất ở mặt này"
    const minVal = Math.min(...column); // "phòng nào thấp nhất ở mặt này"

    // Vòng trong chạy TỪNG CHỖ ĐỖ trong cột đó.
    for (let i = 0; i < candidates.length; i++) {
      // IS_BENEFIT trả lời: cột này càng CAO càng tốt, hay càng THẤP càng tốt?
      // Bốn tiêu chí đầu càng cao càng tốt; riêng C5 (khu đang đông) thì ngược lại.
      if (IS_BENEFIT[j]) {
        // Càng cao càng tốt → chia cho giá trị lớn nhất. Chỗ tốt nhất được 1, chỗ bằng nửa được 0.5.
        //
        // Dấu `? :` đọc là "nếu ... thì ... không thì ...". Ở đây hỏi maxVal > 0 để tránh
        // phép chia 0/0 (ra NaN, hỏng toàn bộ điểm) khi CẢ CỘT đều bằng 0 — xảy ra thật với
        // xe mới chưa có lịch sử nên C1 = 0 ở mọi ứng viên. Lúc đó mọi chỗ cùng 0 điểm ở tiêu
        // chí này, quyết định nhường cho 4 tiêu chí còn lại.
        normalized[i][j] = maxVal > 0 ? criteria[i][j] / maxVal : 0;
      } else {
        // Càng thấp càng tốt → lấy giá trị nhỏ nhất chia cho từng giá trị.
        // Đúng như tính tiền phòng trọ: phòng 3 triệu được 1 điểm, phòng 5 triệu được 3/5 = 0.6.
        //
        // Nhánh `: 1` cho trường hợp giá trị bằng 0 — khu trống trơn, tức hoàn hảo ở tiêu chí
        // "độ vắng", nên cho thẳng điểm tối đa thay vì chia cho 0.
        normalized[i][j] = criteria[i][j] > 0 ? minVal / criteria[i][j] : 1;
      }
    }
  }

  // ── BƯỚC 2: nhân trọng số rồi cộng lại ──────────────────────────────────
  // `.reduce` nghĩa là "gom cả dãy thành MỘT con số" — ở đây là phép cộng dồn.
  // Trải ra cho chỗ A-05 sẽ là:
  //     0 + 0.35×1.00 + 0.25×0.38 + 0.20×1.00 + 0.10×0.89 + 0.10×0.29 = 0.762
  // Giống hệt "10×70% + 2,5×30% = 7,75" ở ví dụ phòng trọ.
  const results: ScoredSpot[] = candidates.map((candidate, i) => ({
    ...candidate,
    normalizedScores: normalized[i],
    totalScore: w.reduce((sum, weight, j) => sum + weight * normalized[i][j], 0),
    rank: 0,
    explanation: '',
  }));

  // ── BƯỚC 3: xếp hạng ────────────────────────────────────────────────────
  // `b - a` là GIẢM DẦN (điểm cao đứng trước). Viết nhầm thành `a - b` là hệ thống gợi ý chỗ
  // TỆ NHẤT mà không báo lỗi gì — không có test nào bắt được, nên đừng đụng vào dòng này.
  // Sau dòng này, results[0] chính là chỗ được gợi ý.
  results.sort((a, b) => b.totalScore - a.totalScore);

  // Đếm số chỗ cùng hoà điểm cao nhất, để câu giải thích nói thật khi thuật toán không phân
  // biệt được (VD xe mới hoàn toàn: mọi chỗ trong khu đều như nhau).
  //
  // Không so bằng `===` mà so "chênh nhau dưới 0.000000001", vì máy tính lưu số thập phân
  // không chính xác tuyệt đối: hai phép tính cho cùng kết quả trên giấy có thể ra 0.7 và
  // 0.7000000000000001 trong bộ nhớ, `===` sẽ bảo chúng khác nhau.
  const topScore = results[0].totalScore;
  const tiedAtTop = results.filter((r) => Math.abs(r.totalScore - topScore) < 1e-9).length;

  results.forEach((r, idx) => {
    r.rank = idx + 1;
    r.explanation = buildExplanation(r, w, tiedAtTop);
  });

  return results;
}

/**
 * Sinh câu giải thích cho một chỗ đỗ — phần "explainability" của hệ thống.
 *
 * Nêu 2 tiêu chí đóng góp nhiều điểm nhất, kèm phần trăm đóng góp, để nhân viên nói lại được
 * với khách vì sao hệ thống chọn chỗ này.
 *
 * LƯU Ý về con số: SAW chuẩn hoá bằng cách chia cho giá trị lớn nhất của từng cột, nên điểm là
 * ĐIỂM TƯƠNG ĐỐI trong nhóm chỗ trống đang xét, không phải điểm chất lượng tuyệt đối. Chỗ tốt
 * nhất trên mọi tiêu chí sẽ luôn đạt đúng 1.00. Vì vậy không ghi "1.00/1.00" (dễ bị hiểu là
 * hoàn hảo) mà ghi kèm thế hoà khi có nhiều chỗ cùng điểm.
 *
 * @param tiedAtTop Số chỗ cùng đạt điểm cao nhất — > 1 nghĩa là thuật toán không phân biệt được.
 */
function buildExplanation(spot: ScoredSpot, weights: number[], tiedAtTop: number): string {
  const score = spot.totalScore.toFixed(2);

  // Nhiều chỗ hoà điểm đầu bảng: nói thẳng là các chỗ này tương đương nhau, tránh để nhân viên
  // tưởng hệ thống có căn cứ riêng để chọn đúng chỗ này.
  if (spot.rank === 1 && tiedAtTop > 1) {
    return `Điểm ${score} — ${tiedAtTop} chỗ trống cùng mức điểm cao nhất, chọn chỗ đầu danh sách`;
  }

  // Tìm 2 tiêu chí đóng góp NHIỀU ĐIỂM NHẤT vào tổng. Đọc chuỗi 4 bước từ trên xuống:
  //   .map    — với mỗi tiêu chí, tính xem nó góp bao nhiêu điểm (điểm chuẩn hoá × trọng số)
  //   .filter — bỏ những tiêu chí góp 0 điểm, nêu ra cũng vô nghĩa
  //   .sort   — xếp tiêu chí góp nhiều nhất lên đầu
  //   .slice  — lấy 2 cái đầu; nêu cả 5 thì câu giải thích dài, nhân viên không đọc
  const topFactors = spot.normalizedScores
    .map((s, idx) => ({ name: CRITERIA_LABELS[idx], contribution: s * weights[idx] }))
    .filter((f) => f.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 2);

  if (topFactors.length === 0) {
    return `Điểm ${score}`;
  }

  const reasons = topFactors
    .map((f) => `${f.name} (${(f.contribution * 100).toFixed(0)}%)`)
    .join(', ');

  return `Điểm ${score} — yếu tố chính: ${reasons}`;
}
