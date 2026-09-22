# ĐỀ XUẤT: Nâng cấp thuật toán Gợi ý chỗ đỗ thông minh bằng SAW (Simple Additive Weighting)

> **Mục đích**: Thay thế logic "chọn chỗ đầu tiên trong khu ưa thích" của bản cũ bằng một thuật toán
> ra quyết định đa tiêu chí (MCDA) đã được kiểm chứng quốc tế, đáp ứng yêu cầu giảng viên về
> tính học thuật của tính năng thông minh.
>
> **Thuật toán được chọn**: **SAW — Simple Additive Weighting** (Fishburn 1967; Hwang & Yoon 1981),
> có **Exponential Decay Weighting** (Holt 1957) làm bước tiền xử lý cho tiêu chí "mức ưa thích chỗ đỗ".
>
> **Nguyên tắc**: Giữ nguyên tech stack (Express + TypeScript + Prisma + SQL Server), không thêm
> service mới, không cần ML. Thuật toán phải giải thích được (explainable) và chạy trong hàm
> `smartLookup()` hiện có.
>
> **Ngày lập**: 21/09/2026 · **Cập nhật**: 21/09/2026 — đồng bộ với code đã triển khai và chạy thật
>
> **Trạng thái**: ĐÃ TRIỂN KHAI XONG. Tài liệu này mô tả thiết kế **đúng như code hiện tại**.
> Quá trình triển khai phát sinh 5 vấn đề (một trong đó khiến thuật toán chạy đúng nhưng vô nghĩa),
> ghi đầy đủ ở **`THUAT_TOAN_SAW_VAN_DE_VA_CACH_XU_LY.md`** — đọc file đó để biết *vì sao* thiết kế
> lại thành ra như hiện nay.

---

## 1. Phân tích hiện trạng — Hạn chế cần khắc phục

### 1.1. Code TRƯỚC khi nâng cấp (`parking.service.ts → smartLookup()`)

```
Bước 1: Đếm tần suất zone trong 30 lượt gần nhất → preferredZone (mode)
Bước 2: Lọc chỗ trống tương thích loại xe
Bước 3: Ưu tiên chỗ trong preferredZone, nếu hết thì lấy chỗ đầu tiên ở khu khác
```

### 1.2. Vấn đề của bản cũ

| # | Hạn chế | Hệ quả |
|---|---|---|
| 1 | Chỉ xét **1 tiêu chí** (khu ưa thích) | Bỏ qua các yếu tố quan trọng: mức độ đông đúc, thói quen giờ, tỷ lệ còn trống |
| 2 | Không có **hàm tính điểm (scoring)** | Không xếp hạng được các chỗ — chỉ "có hoặc không" |
| 3 | Lượt đỗ 29 ngày trước có trọng số bằng lượt hôm qua | Không phản ánh thay đổi hành vi gần đây |
| 4 | Không nêu tên thuật toán quốc tế nào | Khó bảo vệ trước câu hỏi "thuật toán gì, tham chiếu ở đâu" |

---

## 2. Lý do chọn SAW (và vì sao không chọn phương án khác)

SAW là phương pháp MCDA được trích dẫn nhiều nhất trong lịch sử ngành Operations Research và là
phương án duy nhất đáp ứng được **cả ba ràng buộc thực tế** của đồ án cùng lúc:

**(1) Tính giải thích được — tiêu chí quan trọng nhất của môn học.**
SAW sinh ra một câu tiếng Việt mà nhân viên bãi xe đọc hiểu ngay:
*"Điểm 0.76 — chỗ ưa thích chiếm 35%, còn trống 25%"*.
TOPSIS thì phải giải thích *"khoảng cách Euclidean đến phương án lý tưởng"* — khái niệm trừu tượng
với người vận hành không có nền kỹ thuật.

**(2) Phạm vi bao phủ.**
SAW là thuật toán đa tiêu chí trọn vẹn: nhận vào 5 tiêu chí → chuẩn hoá → nhân trọng số → trả về
xếp hạng. Exponential Decay chỉ là **một kỹ thuật tính trọng số thời gian** cho một trong 5 đầu vào
đó, nên nó tự nhiên trở thành **bước tiền xử lý bên trong SAW** chứ không đứng riêng được như một
thuật toán ra quyết định.

**(3) Tích hợp với Hệ chuyên gia đã có.**
Trọng số SAW (w₁ = 0.35, w₂ = 0.25, …) lưu thẳng vào bảng `ExpertRules` domain
`parking_recommendation`; admin chỉnh qua UI mà không sửa code — đúng tinh thần
*Knowledge Acquisition* của hệ chuyên gia đã xây. Với TOPSIS, việc giải thích cho admin
"thay đổi trọng số này ảnh hưởng khoảng cách Euclidean thế nào" là không thực tế.

> **Tóm tắt**: Exponential Decay không đủ tư cách là thuật toán ra quyết định (nó là tiền xử lý);
> TOPSIS thừa phức tạp cho bài toán 5 tiêu chí × vài chục chỗ đỗ và cho kết quả gần như trùng SAW.
> SAW vừa đủ mạnh, vừa đủ đơn giản, và có nền tài liệu học thuật quốc tế vững nhất cho đúng ngữ cảnh MCDA.
> Phân tích so sánh chi tiết xem **Phụ lục A (mục 12)**.

### Tổng quan kiến trúc mới

```
Nhân viên nhập biển số
        │
        ▼
[smartLookup()] — 4 query DB song song (GIỮ NGUYÊN)
        │
        ▼
┌───────────────────────────────────────────────────────┐
│  BƯỚC MỚI: SAW Multi-Criteria Scoring Pipeline        │
│                                                       │
│  Tiền xử lý: Exponential Decay Weighting              │
│      → điểm KHU + điểm ĐÚNG CHỖ = tiêu chí C1         │
│              │                                        │
│              ▼                                        │
│  SAW — Simple Additive Weighting                      │
│      Bước 1: chuẩn hoá 5 tiêu chí về [0,1]            │
│      Bước 2: Score = Σ (wⱼ × rᵢⱼ)                     │
│      Bước 3: xếp hạng, chọn Score cao nhất            │
│                                                       │
│  Trọng số wⱼ đọc từ ExpertRules (admin cấu hình được) │
└───────────────────────────────────────────────────────┘
        │
        ▼
Trả về: suggestedSpotId + điểm + giải thích chi tiết
```

---

## 3. Bước tiền xử lý: Exponential Decay Weighting (sinh tiêu chí C1)

> **Quan trọng**: điểm ưa thích được chấm ở **hai mức rồi cộng lại** — điểm của KHU và điểm của
> ĐÚNG CHỖ ĐỖ đó. Lý do bắt buộc phải có mức thứ hai xem mục 3.6 và
> `THUAT_TOAN_SAW_VAN_DE_VA_CACH_XU_LY.md` mục 3.1.

### 3.1. Tham chiếu học thuật

- **Holt, C.C. (1957/2004)**. *"Forecasting Seasonals and Trends by Exponentially Weighted Moving Averages"*. International Journal of Forecasting, 20(1), 5–10.
- **Hunter, J.S. (1986)**. *"The Exponentially Weighted Moving Average"*. Journal of Quality Technology, 18(4), 203–210.
- Được sử dụng rộng rãi trong kiểm soát chất lượng (SPC), tài chính (EWMA charts), và hệ thống gợi ý thương mại điện tử.

> **Vị trí trong kiến trúc**: đây **không** phải thuật toán ra quyết định độc lập. Nó chỉ thay thế
> phép đếm tần suất (mode) hiện tại để sinh ra giá trị thô cho **tiêu chí C1** của SAW.

### 3.2. Ý tưởng

Thay vì đếm tần suất zone đơn thuần (mode), gán **trọng số suy giảm theo hàm mũ** cho mỗi lượt đỗ:
lượt gần đây có ảnh hưởng lớn hơn lượt cũ.

### 3.3. Công thức

```
Với mỗi lượt đỗ i (i=0 là gần nhất, i=n-1 là xa nhất):

  weight(i) = α × (1 - α)^i

  trong đó α ∈ (0, 1) là hệ số decay (đề xuất α = 0.3)

Điểm ưa thích của zone z:

  zonePreference(z) = Σ weight(i)  với mọi lượt i mà xe đỗ ở zone z
```

### 3.4. Ví dụ minh hoạ

```
30 lượt gần nhất, α = 0.3:

Lượt 0 (hôm qua, Khu B):      weight = 0.3 × 0.7^0 = 0.300
Lượt 1 (2 ngày trước, Khu A): weight = 0.3 × 0.7^1 = 0.210
Lượt 2 (3 ngày trước, Khu A): weight = 0.3 × 0.7^2 = 0.147
Lượt 3 (4 ngày trước, Khu A): weight = 0.3 × 0.7^3 = 0.103
...

zonePreference("Khu A") = 0.210 + 0.147 + 0.103 + ... = 0.52
zonePreference("Khu B") = 0.300 + ... = 0.38

→ Khu A vẫn được ưu tiên dù lượt gần nhất ở Khu B,
  nhưng nếu khách bắt đầu chuyển sang Khu B thì sau vài lượt nữa
  Khu B sẽ vượt — hệ thống TỰ THÍCH NGHI.
```

### 3.5. Code TypeScript

```typescript
// File mới: backend/src/utils/smartParkingAlgorithms.ts

/**
 * Exponential Decay Weighting (Holt, 1957; Hunter, 1986)
 * Tiền xử lý cho tiêu chí C1 của SAW: tính điểm ưa thích cho mỗi zone
 * dựa trên lịch sử đỗ xe, lượt gần đây có trọng số cao hơn.
 *
 * @param recentRecords - Mảng bản ghi đỗ xe, sắp theo entryTime DESC
 * @param alpha - Hệ số decay (0 < α < 1), mặc định 0.3
 * @returns Map<zoneName, preferenceScore>
 */
export function calcZonePreference(
  recentRecords: Array<{ parkingSpot?: { zone?: { name: string } } }>,
  alpha: number = 0.3
): Map<string, number> {
  const scores = new Map<string, number>();

  recentRecords.forEach((record, index) => {
    const zoneName = record.parkingSpot?.zone?.name;
    if (!zoneName) return;

    const weight = alpha * Math.pow(1 - alpha, index);
    scores.set(zoneName, (scores.get(zoneName) || 0) + weight);
  });

  return scores;
}
```

### 3.6. Chấm điểm ở mức từng chỗ đỗ — bắt buộc phải có

Chỉ chấm điểm ở mức **khu** là chưa đủ. Bốn tiêu chí còn lại (C2–C5) đều là thuộc tính của khu,
nên **mọi chỗ nằm trong cùng một khu có 5 giá trị tiêu chí giống hệt nhau**. Phép chuẩn hoá của
SAW khi đó cho ra `r = 1` ở mọi ô, và các chỗ cùng khu đều đạt đúng 1.00 điểm — thuật toán thoái
hoá về đúng hành vi của code cũ (lấy chỗ đầu danh sách).

Bộ lọc tương thích loại xe càng làm vấn đề rõ hơn, vì nó thu hẹp ứng viên về rất ít khu:

| Khu | Nhóm suy ra từ tên khu | Nhận loại xe |
|---|---|---|
| Khu A | `two-wheel` | xe máy, xe máy điện |
| Khu B | `car` | ô tô con, ô tô điện, xe bán tải |
| Khu C | `large-car` | xe tải, xe khách |
| Khu D | `any` | **mọi loại xe** — tên "Khu D" không khớp từ khoá nào |

Về nguyên tắc ứng viên trải trên hai khu (khu chuyên dụng + Khu D), nhưng phần lớn dồn vào khu
chuyên dụng. Đo trên dữ liệu thật lúc phát hiện lỗi — Khu D đang đầy 100% — thì cả 45 chỗ trống
của Khu A cùng ra 1.00 điểm.

Vì vậy điểm "đúng chỗ" — dữ kiện duy nhất ở mức từng chỗ mà dữ liệu hiện có cung cấp được — là thứ
phá được thế hoà đó. Nghiệp vụ cũng đúng: khách quen thường quay lại đúng chỗ cũ.

```typescript
/**
 * Cùng công thức Exponential Decay nhưng gom theo parkingSpotId thay vì theo tên khu.
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
```

Hai điểm được cộng lại khi xây ứng viên cho SAW:

```typescript
zonePreference: (zonePreferences.get(zoneName) || 0) + (spotPreferences.get(spot.id) || 0),
```

Thứ tự ưu tiên sinh ra một cách tự nhiên: **đúng chỗ cũ > chỗ khác trong khu quen > chỗ ở khu lạ**.

---

## 4. Thuật toán chính: SAW — Simple Additive Weighting

### 4.1. Tham chiếu học thuật

- **Fishburn, P.C. (1967)**. *"Additive Utilities with Incomplete Product Set: Applications to Priorities and Assignments"*. Operations Research, 15(3), 537–542.
- **MacCrimmon, K.R. (1968)**. *"Decision Making among Multiple-Attribute Alternatives: A Survey and Consolidated Approach"*. RAND Corporation Memorandum, RM-4823-ARPA.
- **Hwang, C.L. & Yoon, K. (1981)**. *"Multiple Attribute Decision Making: Methods and Applications"*. Springer-Verlag, Berlin. (Chương 2–3)
- SAW/WSM là phương pháp MCDA được sử dụng nhiều nhất trong thực tế do tính đơn giản và tính giải thích được (Triantaphyllou, 2000).

### 4.2. Ý tưởng

Mỗi chỗ đỗ trống được chấm điểm trên **nhiều tiêu chí**, mỗi tiêu chí có trọng số phản ánh mức
độ quan trọng. Chỗ có tổng điểm cao nhất được gợi ý.

### 4.3. Các tiêu chí (5 tiêu chí)

| # | Tiêu chí (Criterion) | Ký hiệu | Cách tính | Loại | Trọng số mặc định |
|---|---|---|---|---|---|
| C1 | **Mức ưa thích chỗ đỗ** | zonePreference | Exponential Decay (mục 3): điểm của **khu** + điểm của **đúng chỗ đó** | Benefit (cao = tốt) | w₁ = 0.35 |
| C2 | **Tỷ lệ còn trống của zone** | zoneAvailability | = số chỗ trống / tổng chỗ trong zone | Benefit | w₂ = 0.25 |
| C3 | **Độ tương thích loại xe** | typeMatch | = 1 nếu zone chuyên cho loại xe này, 0.5 nếu zone tổng hợp | Benefit | w₃ = 0.20 |
| C4 | **Phù hợp khung giờ quen** | peakHourFit | = tỷ lệ lượt đỗ của zone rơi vào khung giờ hiện tại (±1h, tính **vòng tròn** — 23h và 0h là hai khung liền kề) trong 30 lượt gần nhất | Benefit | w₄ = 0.10 |
| C5 | **Mức độ đông đúc hiện tại** | currentOccupancy | = số xe đang đỗ / tổng chỗ trong zone | Cost (thấp = tốt) | w₅ = 0.10 |

> **Lưu ý về C2 và C5**: trong code `occupancy = 1 − availability`, nên hai tiêu chí này đo **cùng
> một đại lượng** nhìn từ hai chiều — vi phạm giả định "các tiêu chí độc lập" của SAW. Đã cân nhắc
> và **quyết định giữ nguyên**: khi mọi ứng viên cùng một khu (tình huống thường gặp nhất) thì C2
> và C5 bằng nhau ở mọi ứng viên nên không ảnh hưởng thứ hạng; kịch bản hai khu đã đo thử, không
> có đảo hạng. Phân tích đầy đủ ba hệ quả và hai phương án đã loại:
> `THUAT_TOAN_SAW_VAN_DE_VA_CACH_XU_LY.md` mục 4.1.

> **Ghi chú**: Trọng số w₁–w₅ lưu vào `ExpertRules` (domain = `parking_recommendation`)
> để admin chỉnh được, đúng tinh thần "cấu hình được, không hardcode" (xem mục 7).

### 4.4. Công thức SAW

```
Bước 1: Chuẩn hoá (Normalization) — đưa mọi tiêu chí về thang [0, 1]

  Với tiêu chí Benefit (cao = tốt):
    r_ij = x_ij / max(x_j)      (chia cho giá trị lớn nhất trong cột j)

  Với tiêu chí Cost (thấp = tốt):
    r_ij = min(x_j) / x_ij      (chia giá trị nhỏ nhất cho giá trị hiện tại)
    (nếu x_ij = 0 thì r_ij = 1, tức hoàn hảo — zone trống hoàn toàn)

Bước 2: Tính điểm tổng hợp

  Score(spot_i) = Σ (w_j × r_ij)  với j = 1..5

Bước 3: Xếp hạng

  Chỗ đỗ có Score cao nhất → suggestedSpotId
```

### 4.5. Ví dụ minh hoạ

```
Xe máy "51F-123.45", khách quen Khu A, hiện tại 14:00

Chỗ trống cần chấm điểm:
┌────────┬──────┬──────┬──────┬──────┬──────┐
│ Spot   │  C1  │  C2  │  C3  │  C4  │  C5  │
│        │zPref │avail │match │peak  │occup │
├────────┼──────┼──────┼──────┼──────┼──────┤
│ A-05   │ 0.52 │ 0.30 │ 1.0  │ 0.8  │ 0.70 │
│ B-12   │ 0.38 │ 0.60 │ 0.5  │ 0.9  │ 0.40 │
│ C-03   │ 0.10 │ 0.80 │ 1.0  │ 0.6  │ 0.20 │
└────────┴──────┴──────┴──────┴──────┴──────┘

Bước 1 — Chuẩn hoá:
  C1 (benefit): max=0.52 → A-05: 1.00, B-12: 0.73, C-03: 0.19
  C2 (benefit): max=0.80 → A-05: 0.38, B-12: 0.75, C-03: 1.00
  C3 (benefit): max=1.0  → A-05: 1.00, B-12: 0.50, C-03: 1.00
  C4 (benefit): max=0.9  → A-05: 0.89, B-12: 1.00, C-03: 0.67
  C5 (cost):    min=0.20 → A-05: 0.29, B-12: 0.50, C-03: 1.00

Bước 2 — Tính điểm (w = 0.35, 0.25, 0.20, 0.10, 0.10):
  A-05 = 0.35×1.00 + 0.25×0.38 + 0.20×1.00 + 0.10×0.89 + 0.10×0.29
       = 0.350 + 0.094 + 0.200 + 0.089 + 0.029 = 0.762

  B-12 = 0.35×0.73 + 0.25×0.75 + 0.20×0.50 + 0.10×1.00 + 0.10×0.50
       = 0.256 + 0.188 + 0.100 + 0.100 + 0.050 = 0.693

  C-03 = 0.35×0.19 + 0.25×1.00 + 0.20×1.00 + 0.10×0.67 + 0.10×1.00
       = 0.067 + 0.250 + 0.200 + 0.067 + 0.100 = 0.683

→ Xếp hạng: A-05 (0.762) > B-12 (0.693) > C-03 (0.683)
→ Gợi ý: A-05 ✓
→ Giải thích: "Điểm 0.76 — yếu tố chính: Mức ưa thích chỗ đỗ (35%), Phù hợp loại xe (20%)"
```

### 4.6. Code TypeScript

```typescript
// File: backend/src/utils/smartParkingAlgorithms.ts (tiếp)

export interface SpotCandidate {
  spotId: number;
  spotNumber: string;
  zoneName: string;
  zonePreference: number;     // C1 — từ Exponential Decay
  zoneAvailability: number;   // C2 — tỷ lệ còn trống (0–1)
  typeMatchScore: number;     // C3 — 1.0 hoặc 0.5
  peakHourFit: number;        // C4 — phù hợp giờ (0–1)
  currentOccupancy: number;   // C5 — mức đông đúc (0–1)
}

export interface ScoredSpot extends SpotCandidate {
  normalizedScores: number[];
  totalScore: number;
  rank: number;
  explanation: string;
}

/**
 * SAW — Simple Additive Weighting (Fishburn 1967; Hwang & Yoon 1981)
 *
 * Chuẩn hoá các tiêu chí về [0,1] rồi tính tổng có trọng số.
 * Tiêu chí C1–C4 là benefit (cao = tốt), C5 là cost (thấp = tốt).
 *
 * @param candidates - Danh sách chỗ đỗ ứng viên đã tính raw scores
 * @param weights - Mảng 5 trọng số [w1..w5], tổng = 1.0
 * @returns Mảng chỗ đỗ đã chấm điểm và xếp hạng, sắp theo totalScore DESC
 */
export function scoreSAW(
  candidates: SpotCandidate[],
  weights: number[] = [0.35, 0.25, 0.20, 0.10, 0.10]
): ScoredSpot[] {
  if (candidates.length === 0) return [];

  // Trích giá trị thô theo từng tiêu chí
  const criteria: number[][] = candidates.map(c => [
    c.zonePreference,     // C1 — benefit
    c.zoneAvailability,   // C2 — benefit
    c.typeMatchScore,     // C3 — benefit
    c.peakHourFit,        // C4 — benefit
    c.currentOccupancy,   // C5 — cost
  ]);

  const numCriteria = 5;
  const isBenefit = [true, true, true, true, false]; // C5 là cost

  // Bước 1: Chuẩn hoá
  const normalized: number[][] = [];
  for (let i = 0; i < candidates.length; i++) {
    normalized.push(new Array(numCriteria));
  }

  for (let j = 0; j < numCriteria; j++) {
    const column = criteria.map(row => row[j]);
    const maxVal = Math.max(...column);
    const minVal = Math.min(...column);

    for (let i = 0; i < candidates.length; i++) {
      if (isBenefit[j]) {
        // Benefit: r_ij = x_ij / max(x_j)
        normalized[i][j] = maxVal > 0 ? criteria[i][j] / maxVal : 0;
      } else {
        // Cost: r_ij = min(x_j) / x_ij (thấp = tốt)
        normalized[i][j] = criteria[i][j] > 0 ? minVal / criteria[i][j] : 1;
      }
    }
  }

  // Bước 2: Tính điểm tổng hợp
  const results: ScoredSpot[] = candidates.map((candidate, i) => {
    const totalScore = weights.reduce(
      (sum, w, j) => sum + w * normalized[i][j], 0
    );

    return {
      ...candidate,
      normalizedScores: normalized[i],
      totalScore,
      rank: 0, // sẽ gán sau
      explanation: '', // sẽ sinh sau
    };
  });

  // Bước 3: Xếp hạng
  results.sort((a, b) => b.totalScore - a.totalScore);
  results.forEach((r, idx) => {
    r.rank = idx + 1;
    r.explanation = buildExplanation(r, weights);
  });

  return results;
}

export const CRITERIA_LABELS = [
  'Mức ưa thích chỗ đỗ',
  'Tỷ lệ còn trống',
  'Phù hợp loại xe',
  'Phù hợp giờ quen',
  'Mức độ vắng',
];

/**
 * LƯU Ý về con số: SAW chuẩn hoá bằng cách chia cho giá trị lớn nhất của từng cột, nên điểm là
 * ĐIỂM TƯƠNG ĐỐI trong nhóm chỗ trống đang xét, không phải điểm chất lượng tuyệt đối. Chỗ tốt
 * nhất trên mọi tiêu chí sẽ luôn đạt đúng 1.00. Vì vậy KHÔNG ghi "1.00/1.00" (dễ bị hiểu là hoàn
 * hảo) mà ghi kèm thế hoà khi có nhiều chỗ cùng điểm.
 *
 * @param tiedAtTop Số chỗ cùng đạt điểm cao nhất — > 1 nghĩa là thuật toán không phân biệt được.
 */
function buildExplanation(spot: ScoredSpot, weights: number[], tiedAtTop: number): string {
  const score = spot.totalScore.toFixed(2);

  if (spot.rank === 1 && tiedAtTop > 1) {
    return `Điểm ${score} — ${tiedAtTop} chỗ trống cùng mức điểm cao nhất, chọn chỗ đầu danh sách`;
  }

  const topFactors = spot.normalizedScores
    .map((s, idx) => ({ name: CRITERIA_LABELS[idx], contribution: s * weights[idx] }))
    .filter(f => f.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 2);

  if (topFactors.length === 0) return `Điểm ${score}`;

  const reasons = topFactors
    .map(f => `${f.name} (${(f.contribution * 100).toFixed(0)}%)`)
    .join(', ');

  return `Điểm ${score} — yếu tố chính: ${reasons}`;
}
```

---

## 5. Tích hợp vào hàm `smartLookup()`

### 5.1. Nguyên tắc tích hợp

- **Không phá vỡ code hiện có**: giữ nguyên 4 query `Promise.all`, giữ nguyên cấu trúc response.
- **Thêm bước scoring SAW** sau khi có danh sách `compatibleSpots`.
- **Exponential Decay** thay thế mode calculation hiện tại (sinh C1).
- **Trọng số đọc từ ExpertRules**, có fallback mặc định nếu chưa cấu hình.

### 5.2. Thay đổi trong `parking.service.ts`

```typescript
// === TRƯỚC khi nâng cấp ===
// Bước 2: Mode calculation đơn giản
const zoneCounts = new Map<string, number>();
for (const r of recentRecords) {
  const zoneName = r.parkingSpot?.zone?.name;
  if (zoneName) zoneCounts.set(zoneName, (zoneCounts.get(zoneName) || 0) + 1);
}
// → chọn key có value lớn nhất

// Bước 3: Chọn chỗ đầu tiên trong khu ưa thích
const inPreferred = preferredZone
  ? compatibleSpots.filter((s) => s.zone?.name === preferredZone)
  : [];
const chosen = inPreferred[0] || compatibleSpots[0];

// === SAU (code mới) ===
import {
  calcZonePreference,
  calcSpotPreference,
  calcZoneStats,
  calcTypeMatch,
  calcHourlyPattern,
  scoreSAW,
  SpotCandidate
} from '../utils/smartParkingAlgorithms';

// Bước 2 MỚI: Exponential Decay thay cho mode → sinh tiêu chí C1
// Chấm ở HAI mức rồi cộng lại — bắt buộc, xem mục 3.6
const zonePreferences = calcZonePreference(recentRecords, alpha);
const spotPreferences = calcSpotPreference(recentRecords, alpha);

// Tính thêm dữ liệu cho các tiêu chí C2–C5
// LƯU Ý: calcZoneStats cần TOÀN BỘ chỗ đỗ, không chỉ chỗ trống — mẫu số là tổng chỗ của khu.
// Vì vậy query chỗ đỗ ở Promise.all đã BỎ bộ lọc `where: { status: 'available' }`,
// và danh sách chỗ trống được lọc lại trong bộ nhớ:
//     const availableSpots = allSpots.filter((s) => s.status === 'available');
const zoneStats = calcZoneStats(allSpots);                        // helper mới
const hourlyPattern = calcHourlyPattern(recentRecords, now.getHours()); // helper mới

// Bước 3 MỚI: Xây danh sách ứng viên + chấm điểm SAW
const candidates: SpotCandidate[] = compatibleSpots.map(spot => ({
  spotId: spot.id,
  spotNumber: spot.spotNumber,
  zoneName: spot.zone?.name || '',
  // C1 — điểm khu + điểm đúng chỗ đó (mục 3.6)
  zonePreference: (zonePreferences.get(spot.zone?.name || '') || 0)
                + (spotPreferences.get(spot.id) || 0),
  zoneAvailability: zoneStats.get(spot.zone?.name || '')?.availability || 0,
  typeMatchScore: calcTypeMatch(spot, vehicleTypeName),
  peakHourFit: hourlyPattern.get(spot.zone?.name || '') || 0.5,
  currentOccupancy: zoneStats.get(spot.zone?.name || '')?.occupancy || 0,
}));

const sawResults = scoreSAW(candidates, weights);

// Chọn chỗ tốt nhất theo SAW
const bestSpot = sawResults[0];
if (bestSpot) {
  suggestedSpotId = bestSpot.spotId;
  suggestedSpotLabel = `${bestSpot.zoneName} — ${bestSpot.spotNumber}`;
  suggestedSpotNote = bestSpot.explanation;
}
```

### 5.3. Mở rộng response API

```typescript
// Thêm vào object trả về của smartLookup():
return {
  // ... giữ nguyên các trường hiện có ...
  vehicle, insights: {
    visitCount30Days,
    avgDurationHours,
    preferredZone: topZone,  // zone có điểm Exponential Decay cao nhất
    suggestedSpotId: bestSpot?.spotId || null,
    suggestedSpotLabel,
    suggestedSpotNote,

    // === TRƯỜNG MỚI ===
    scoringDetails: {
      algorithm: 'SAW — Simple Additive Weighting',
      references: [
        'Fishburn, P.C. (1967). Operations Research, 15(3), 537–542',
        'Hwang, C.L. & Yoon, K. (1981). Springer-Verlag',
      ],
      weights: { zonePreference: 0.35, zoneAvailability: 0.25, typeMatch: 0.20, peakHourFit: 0.10, occupancy: 0.10 },
      decayAlpha: alpha,
      topCandidates: sawResults.slice(0, 3).map(r => ({
        spotId: r.spotId,
        spotNumber: r.spotNumber,
        zone: r.zoneName,
        sawScore: r.totalScore,
        normalizedScores: r.normalizedScores,
        explanation: r.explanation,
      })),
    },
  },
};
```

---

## 6. Các hàm phụ trợ

### 6.1. `calcZoneStats()` — Thống kê zone (sinh C2, C5)

```typescript
/**
 * Tính tỷ lệ trống và mức đông đúc hiện tại của mỗi zone
 */
export function calcZoneStats(
  // Cần TOÀN BỘ chỗ đỗ (không chỉ chỗ trống) vì mẫu số là tổng số chỗ của khu.
  allSpots: Array<{ zone?: { name: string } | null; status: string }>
): Map<string, { availability: number; occupancy: number }> {
  const stats = new Map<string, { total: number; available: number }>();

  for (const spot of allSpots) {
    const zone = spot.zone?.name || 'unknown';
    const entry = stats.get(zone) || { total: 0, available: 0 };
    entry.total++;
    if (spot.status === 'available') entry.available++;
    stats.set(zone, entry);
  }

  const result = new Map<string, { availability: number; occupancy: number }>();
  for (const [zone, { total, available }] of stats) {
    result.set(zone, {
      availability: total > 0 ? available / total : 0,
      occupancy: total > 0 ? (total - available) / total : 0,
    });
  }
  return result;
}
```

### 6.2. `calcTypeMatch()` — Phù hợp loại xe (sinh C3)

```typescript
/**
 * Tính điểm tương thích giữa chỗ đỗ và loại xe.
 *
 * Dùng lại cách phân nhóm của businessRules.ts (getSpotCategory / getVehicleCategory) thay vì tự
 * dò chuỗi tên khu — nếu tự dò thì hệ thống sẽ có HAI quy ước đặt tên khu song song, sửa một chỗ
 * quên chỗ kia là lệch nghiệp vụ.
 *
 *   - khu chuyên đúng nhóm xe (khu xe máy ↔ xe máy)  → 1.0
 *   - khu tổng hợp hoặc loại xe không xác định nhóm  → 0.5
 *
 * Chỗ KHÔNG hợp loại xe đã bị lọc bỏ từ trước bởi isSpotCompatibleWithVehicleType() nên không cần
 * trả về 0 ở đây.
 */
export function calcTypeMatch(
  spot: {
    spotNumber: string;
    spotType?: string | null;
    zone?: { name?: string | null; description?: string | null } | null;
  },
  vehicleTypeName: string
): number {
  const spotCategory = getSpotCategory(spot);
  const vehicleCategory = getVehicleCategory(vehicleTypeName);

  if (spotCategory === 'any' || vehicleCategory === 'any') return 0.5;
  return spotCategory === vehicleCategory ? 1.0 : 0.5;
}
```

### 6.3. `calcHourlyPattern()` — Phù hợp khung giờ quen (sinh C4)

```typescript
/**
 * Dựa trên 30 lượt đỗ gần nhất, tính zone nào khách thường đỗ vào khung giờ hiện tại
 * Trả về Map<zoneName, fitScore> ∈ [0, 1]
 */
export function calcHourlyPattern(
  recentRecords: Array<{
    entryTime: Date;
    parkingSpot?: { zone?: { name: string } | null } | null;
  }>,
  // Truyền giờ vào thay vì đọc new Date() bên trong để hàm thuần tuý, test được.
  currentHour: number = new Date().getHours()
): Map<string, number> {
  const zoneCounts = new Map<string, { sameHour: number; total: number }>();

  for (const r of recentRecords) {
    const zone = r.parkingSpot?.zone?.name;
    if (!zone) continue;
    const entry = zoneCounts.get(zone) || { sameHour: 0, total: 0 };
    entry.total++;
    const recordHour = new Date(r.entryTime).getHours();
    // Lệch giờ tính VÒNG TRÒN: 23h và 0h là hai khung liền kề, không phải cách nhau 23 tiếng.
    const diff = Math.abs(recordHour - currentHour);
    if (Math.min(diff, 24 - diff) <= 1) entry.sameHour++;
    zoneCounts.set(zone, entry);
  }

  const result = new Map<string, number>();
  for (const [zone, { sameHour, total }] of zoneCounts) {
    // Nếu zone này có nhiều lượt đỗ vào khung giờ hiện tại → fit score cao
    result.set(zone, total > 0 ? sameHour / total : 0.5);
  }
  return result;
}
```

---

## 7. Tích hợp vào Hệ chuyên gia (Expert System)

### 7.1. Thêm domain mới: `parking_recommendation`

Tạo ExpertRules cho domain `parking_recommendation` để admin có thể **chỉnh trọng số SAW** qua UI
quản trị, không cần sửa code:

```typescript
// backend/src/expertSystem/rules/defaults.ts — thêm vào mảng DEFAULT_RULES

{
  code: 'PARKING_REC_WEIGHTS',
  domain: 'parking_recommendation',
  name: 'Trọng số thuật toán gợi ý chỗ đỗ (SAW)',
  priority: 1,
  // Điều kiện GIỮ CHỖ: validateShape() bắt buộc mọi luật phải có tối thiểu 1 điều kiện,
  // nên không thể để mảng rỗng dù luật này chỉ lưu tham số, không chạy qua máy suy diễn.
  conditions: JSON.stringify([{ fact: 'configOnly', operator: 'gte', value: 0 }]),
  actions: JSON.stringify([
    {
      type: 'config',
      // Params để PHẲNG, không lồng object: form nhập luật của admin được sinh tự động từ
      // DOMAIN_FORM_SPEC và mỗi field chỉ map tới một khoá phẳng trong params. Nếu lồng,
      // admin phải gõ JSON tay — mất đúng ưu điểm "cấu hình không cần lập trình viên".
      params: {
        zonePreference: 0.35,
        zoneAvailability: 0.25,
        typeMatch: 0.2,
        peakHourFit: 0.1,
        occupancy: 0.1,
        decayAlpha: 0.3,
      },
    },
  ]),
}
```

### 7.2. Đọc trọng số từ Expert System khi chấm điểm

```typescript
// parking.service.ts → getSawConfig()
//
// Bọc try/catch và luôn có fallback: hàm này chạy MỖI LẦN nhân viên gõ biển số, không được
// phép chết vì một dòng cấu hình sai. getRulesByDomain() chỉ trả luật đang BẬT, nên admin tắt
// luật cũng tự động rơi về mặc định.
private async getSawConfig(): Promise<{ weights: number[]; alpha: number }> {
  const fallback = { weights: DEFAULT_SAW_WEIGHTS, alpha: DEFAULT_DECAY_ALPHA };
  try {
    const rules = await knowledgeBase.getRulesByDomain('parking_recommendation');
    const params = rules.find((r) => r.code === 'PARKING_REC_WEIGHTS')?.actions[0]?.params;
    if (!params) return fallback;

    // SAW_WEIGHT_KEYS cố định THỨ TỰ đọc trọng số ra mảng [w1..w5] — khai báo một chỗ duy nhất
    // ở domainSpecs.ts để service và validation không hiểu lệch thứ tự nhau.
    const weights = SAW_WEIGHT_KEYS.map((key) => params[key]);
    if (weights.some((w) => typeof w !== 'number' || Number.isNaN(w))) return fallback;

    const alpha = params.decayAlpha;
    return {
      weights: weights as number[],
      alpha: typeof alpha === 'number' && alpha > 0 && alpha < 1 ? alpha : DEFAULT_DECAY_ALPHA,
    };
  } catch {
    return fallback;
  }
}
```

### 7.3. Validate lúc lưu

Đã cài trong `expertSystem/validation.ts` → `DOMAIN_VALIDATORS.parking_recommendation`:

```typescript
parking_recommendation(params) {
  let sum = 0;
  for (const key of SAW_WEIGHT_KEYS) {
    const value = params[key];
    if (typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 1) {
      throw ruleError(`Trọng số "${key}" phải là số trong khoảng 0 đến 1`);
    }
    sum += value;
  }
  if (Math.abs(sum - 1) > 0.001) {
    throw ruleError(`Tổng 5 trọng số phải bằng 1.0 (hiện tại là ${sum.toFixed(3)})`);
  }
  const alpha = params.decayAlpha;
  if (typeof alpha !== 'number' || !(alpha > 0 && alpha < 1)) {
    throw ruleError('Hệ số suy giảm decayAlpha phải là số lớn hơn 0 và nhỏ hơn 1');
  }
},
```

Nếu không chặn, điểm SAW sẽ vượt ra ngoài thang [0, 1] và câu giải thích in ra số vô nghĩa.
Ngoài ra `DOMAIN_ACTION_TYPE.parking_recommendation = 'config'` buộc luật nhóm này phải dùng đúng
loại hành động `config`.

---

## 8. Hiển thị trên Frontend

### 8.1. Panel "Vì sao chọn chỗ này?" trên `ParkingEntry.tsx`

Panel **mặc định gập lại** để không làm rối màn hình nhập liệu hằng ngày, mở ra khi nhân viên muốn
biết căn cứ. Dùng API `items` của Collapse (antd v5) — `Collapse.Panel` đã deprecated.

```tsx
{smartInsights.scoringDetails && smartInsights.scoringDetails.topCandidates.length > 0 && (
  <Collapse
    ghost
    size="small"
    items={[
      {
        key: 'scoring',
        label: (
          <span style={{ fontSize: '0.85rem' }}>
            Vì sao chọn chỗ này?
            <Tag color="blue" style={{ marginLeft: 8 }}>SAW</Tag>
          </span>
        ),
        children: (
          <>
            <div style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)', marginBottom: 8 }}>
              Thuật toán <b>{smartInsights.scoringDetails.algorithm}</b> — chấm điểm{' '}
              {smartInsights.scoringDetails.candidateCount} chỗ trống trên 5 tiêu chí:
              chỗ ưa thích {Math.round(smartInsights.scoringDetails.weights.zonePreference * 100)}%,
              còn trống {Math.round(smartInsights.scoringDetails.weights.zoneAvailability * 100)}%,
              loại xe {Math.round(smartInsights.scoringDetails.weights.typeMatch * 100)}%,
              giờ quen {Math.round(smartInsights.scoringDetails.weights.peakHourFit * 100)}%,
              độ vắng {Math.round(smartInsights.scoringDetails.weights.occupancy * 100)}%.
            </div>
            <Table
              size="small"
              rowKey="spotId"
              dataSource={smartInsights.scoringDetails.topCandidates}
              pagination={false}
              columns={[
                { title: '#', key: 'rank', width: 40,
                  render: (_: unknown, __: unknown, i: number) => i + 1 },
                { title: 'Chỗ đỗ', dataIndex: 'spotNumber', key: 'spotNumber' },
                { title: 'Khu', dataIndex: 'zone', key: 'zone' },
                { title: 'Điểm', dataIndex: 'score', key: 'score',
                  render: (v: number) => v.toFixed(3) },
              ]}
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginTop: 8 }}>
              Tham chiếu: {smartInsights.scoringDetails.references.join(' · ')}
            </div>
          </>
        ),
      },
    ]}
  />
)}
```

Kết quả hiển thị thực tế:

```
Vì sao chọn chỗ này?  [SAW]
  Thuật toán SAW — Simple Additive Weighting — chấm điểm 27 chỗ trống trên 5 tiêu chí:
  chỗ ưa thích 35%, còn trống 25%, loại xe 20%, giờ quen 10%, độ vắng 10%.

  #   CHỖ ĐỖ   KHU     ĐIỂM
  1   B29      Khu B   1.000
  2   B19      Khu B   0.974
  3   B04      Khu B   0.944

  Tham chiếu: Fishburn, P.C. (1967). Operations Research, 15(3), 537–542 ·
              Hwang, C.L. & Yoon, K. (1981). Multiple Attribute Decision Making. Springer-Verlag
```

Câu giải thích ngắn gọn của chỗ được chọn hiển thị ngay trên dòng auto-fill, không cần mở panel:

> Đã tự động chọn chỗ đỗ gợi ý: **Khu B — B29** — Điểm 1.00 — yếu tố chính: Mức ưa thích chỗ đỗ
> (35%), Tỷ lệ còn trống (25%)

### 8.2. Trang Analytics — chỉ số acceptance rate (ĐÃ LÀM 22/09/2026)

Thẻ **"Hiệu quả thuật toán gợi ý chỗ đỗ"** trên trang Phân tích (`/analytics`) hiển thị:

- **Tỷ lệ chấp nhận gợi ý** — % lượt nhân viên giữ nguyên chỗ hệ thống gợi ý, dạng đồng hồ
  (xanh ≥70%, vàng 40–70%, đỏ <40%)
- Tên thuật toán, cỡ mẫu, số lượt giữ nguyên, số lượt đổi chỗ
- Cảnh báo khi mẫu < 30 lượt rằng con số chưa đủ tin cậy

Đây là chỉ số **định lượng** để đánh giá thuật toán: ô chọn chỗ chỉ được điền sẵn chứ không khoá,
nhân viên đổi tuỳ ý — nên tỷ lệ họ chấp nhận chính là đánh giá của người dùng thật.

**Cách cài**: thêm cột `SuggestedSpotId` vào `ParkingRecords` để ghi lại gợi ý của thuật toán tại
thời điểm xe vào, rồi so với `ParkingSpotId` (chỗ thực tế). Chi tiết thiết kế, các quyết định về
kiểu dữ liệu và kết quả kiểm chứng: `THUAT_TOAN_SAW_VAN_DE_VA_CACH_XU_LY.md` mục 8.

> **Giới hạn**: chỉ đo được từ ngày cài trở đi. Dữ liệu lịch sử không lưu gợi ý nên không tính được.

**Hướng mở rộng tiếp (chưa làm)**: biểu đồ cột trọng số hiện tại để thấy tiêu chí nào đang chi phối;
tách acceptance rate theo loại xe hoặc theo khung giờ để biết thuật toán yếu ở nhóm nào.

---

## 9. Bảng đối chiếu: Tiêu chí môn học ↔ Thuật toán

| Tiêu chí giáo trình | SAW đáp ứng thế nào | Giải thích |
|---|---|---|
| **Sử dụng thuật toán quốc tế đã kiểm chứng** | SAW (Fishburn 1967; Hwang & Yoon 1981), tiền xử lý EWMA (Holt 1957) | Tài liệu học thuật quốc tế, hàng chục nghìn citations |
| **Hệ thống khuyến nghị** | SAW scoring → gợi ý chỗ đỗ tốt nhất | Khuyến nghị cá nhân hoá dựa trên hành vi + ngữ cảnh |
| **DSS — phân tích đa tiêu chí** | 5 tiêu chí × trọng số cấu hình được | Đúng mô hình MCDA trong giáo trình |
| **Giải thích được (Explainability)** | Trường `explanation` cho mỗi kết quả | "Điểm 0.76 — yếu tố chính: Mức ưa thích chỗ đỗ (35%)". Khi nhiều chỗ hoà điểm thì nói thẳng là hoà, không vờ có căn cứ |
| **Thích nghi theo thời gian** | Exponential Decay + rolling window 30 ngày | Hành vi mới tự động ảnh hưởng mạnh hơn hành vi cũ |
| **Cấu hình được** | Trọng số lưu trong ExpertRules, admin chỉnh qua UI | Mỗi bãi xe có thể đặt trọng số khác nhau — Knowledge Acquisition |
| **Đo được hiệu quả** | Acceptance rate: % lượt nhân viên giữ nguyên gợi ý | Chỉ số định lượng để đánh giá thuật toán — đã cài trên trang Phân tích, xem mục 8.2 |

---

## 10. Triển khai — đã hoàn thành

### 10.1. Các file đã tạo/sửa

| # | File | Nội dung |
|---|---|---|
| 1 | `backend/src/utils/smartParkingAlgorithms.ts` | **Mới** — `calcZonePreference()`, `calcSpotPreference()`, `scoreSAW()`, `calcZoneStats()`, `calcTypeMatch()`, `calcHourlyPattern()` |
| 2 | `backend/src/utils/smartParkingAlgorithms.test.ts` | **Mới** — 23 ca kiểm thử, chạy bằng `npm run test:saw` |
| 3 | `backend/src/expertSystem/rules/defaults.ts` | Thêm luật seed `PARKING_REC_WEIGHTS` |
| 4 | `backend/src/expertSystem/domainSpecs.ts` | Đăng ký domain `parking_recommendation`, hằng `SAW_WEIGHT_KEYS`, form 6 ô số cho admin |
| 5 | `backend/src/expertSystem/validation.ts` | Validator chặn tổng trọng số ≠ 1.0 và α ngoài (0,1) |
| 6 | `backend/src/services/parking.service.ts` | `smartLookup()` dùng SAW, thêm `scoringDetails` vào response, thêm `getSawConfig()` |
| 7 | `frontend/src/types/index.ts` | Kiểu `SawScoringDetails` |
| 8 | `frontend/src/pages/ParkingEntry.tsx` | Panel gập "Vì sao chọn chỗ này?" |

### 10.2. Những điều cần giữ — dễ làm hỏng khi sửa về sau

1. **Không đưa C1 về lại mức khu.** Đó chính là lỗi khiến mọi chỗ cùng 1.00 điểm (mục 3.6). Đã có
   test hồi quy canh chỗ này.
2. **Thứ tự `SAW_WEIGHT_KEYS` phải khớp thứ tự cột trong `scoreSAW()`.** Đảo một khoá là toàn bộ
   trọng số gán nhầm tiêu chí mà không có lỗi nào bắn ra — điểm vẫn tính được, chỉ là sai.
3. **`IS_BENEFIT` phải khớp bảng tiêu chí.** C5 là cost; đánh dấu nhầm thành benefit sẽ khiến hệ
   thống ưu tiên đúng khu đông nhất.
4. **Query chỗ đỗ phải lấy TOÀN BỘ, không lọc `status = 'available'`.** C2 và C5 cần tổng số chỗ
   của khu làm mẫu số. Thêm lại bộ lọc là C2 luôn bằng 1 cho mọi khu.
5. **Nhớ reload knowledge base sau khi admin sửa luật** — màn quản trị đã tự gọi; nếu thêm đường
   sửa luật mới thì phải gọi `reload()`.
6. **Giữ nguyên hành vi auto-fill**: frontend vẫn `setFieldsValue({ parkingSpotId })` — hệ thống
   gợi ý chứ không quyết định thay nhân viên.
7. **Hiệu năng**: toàn bộ SAW chạy in-memory trên dữ liệu đã query sẵn, O(n×m) với n = số chỗ
   trống, m = 5 — không phát sinh query DB nào.

### 10.3. Kiểm thử đơn vị — 23 ca, `npm run test:saw`

| Nhóm | Số ca | Kiểm cái gì |
|---|---|---|
| Decay | 4 | Đúng công thức, bỏ qua bản ghi thiếu khu, α sai rơi về mặc định |
| SpotPreference | 2 | Chấm điểm ở mức từng chỗ đỗ |
| **Hồi quy** | **1** | **Chặn lỗi "mọi chỗ cùng 1.00 điểm" quay lại** |
| ZoneStats | 2 | C2 + C5 cộng bằng 1; chỗ bảo trì tính vào tổng nhưng không phải chỗ trống |
| TypeMatch | 2 | Khu chuyên loại xe = 1.0, khu VIP = 0.5 |
| HourlyPattern | 3 | Đúng khung giờ, vòng tròn 23h↔0h, lệch hẳn giờ |
| SAW | 9 | Khớp ví dụ mục 4.5, thang [0,1], xe mới, 1 chỗ, 0 chỗ, đổi trọng số, câu giải thích, hoà điểm, không sửa mảng gốc |

Ca đáng chú ý nhất lấy nguyên bộ số của **ví dụ minh hoạ mục 4.5** và assert ra đúng
0.762 / 0.693 / 0.683 — nếu ai sửa công thức mà quên cập nhật tài liệu (hoặc ngược lại), ca này đỏ.

### 10.4. Kiểm chứng trên hệ thống thật (21/09/2026)

| # | Kịch bản | Kết quả |
|---|---|---|
| 1 | Khách quen `59G22334`, gõ biển số rồi rời ô | Tự điền *Ô tô điện*, chỗ *Khu B — B29*; top 3: 1.000 / 0.974 / 0.944 |
| 2 | Bấm Ghi nhận xe vào → Xe ra | Thành công, phí 20.000đ, chỗ trống cập nhật đúng |
| 3 | Sửa trọng số cho tổng = 1.55 | Bị chặn: *"Tổng 5 trọng số phải bằng 1.0 (hiện tại là 1.550)"* |
| 4 | Đặt C1 = 0.10, C2 = 0.50 | Áp dụng ngay không cần khởi động lại; khoảng cách điểm giữa các chỗ co lại đúng như kỳ vọng khi hạ w₁ |
| 5 | Biển số lạ `88X99999` | Không hiện card gợi ý, không lỗi — nhân viên nhập tay như khách vãng lai |
| 6 | **Chỗ quen A09 bị xe khác chiếm** | Tự chuyển sang A46 (chỗ quen thứ nhì), ứng viên 45→44, xếp hạng dịch đúng một bậc |
| 7 | Đổi α từ 0.3 → 0.9 | Phân bố điểm đổi đúng logic: lượt cũ bị dập gần về 0 nên các chỗ chỉ có trong lịch sử xa trở nên hoà nhau |
| 8 | **Tắt luật `PARKING_REC_WEIGHTS`** | HTTP 200, rơi về trọng số mặc định và α = 0.3, không lỗi |

Kịch bản 6 là bằng chứng rõ nhất rằng thuật toán phản ứng theo **trạng thái bãi tại thời điểm tra
cứu**, không phải một bảng tra cứng.

---

## 11. Tài liệu tham khảo (References)

1. Fishburn, P.C. (1967). "Additive Utilities with Incomplete Product Set". *Operations Research*, 15(3), 537–542.
2. Hwang, C.L. & Yoon, K. (1981). *Multiple Attribute Decision Making: Methods and Applications*. Springer-Verlag.
3. MacCrimmon, K.R. (1968). "Decision Making among Multiple-Attribute Alternatives". RAND Corporation, RM-4823-ARPA.
4. Holt, C.C. (2004). "Forecasting Seasonals and Trends by Exponentially Weighted Moving Averages". *International Journal of Forecasting*, 20(1), 5–10. (Reprint of 1957 ONR memorandum)
5. Hunter, J.S. (1986). "The Exponentially Weighted Moving Average". *Journal of Quality Technology*, 18(4), 203–210.
6. Triantaphyllou, E. (2000). *Multi-Criteria Decision Making Methods: A Comparative Study*. Springer.
7. Saaty, T.L. (1980). *The Analytic Hierarchy Process*. McGraw-Hill. (Tham khảo thêm nếu muốn mở rộng AHP để sinh trọng số thay vì gán tay)

---

## 12. Phụ lục A: Các phương án đã cân nhắc nhưng không chọn

Mục này để trả lời câu hỏi phản biện *"Sao không dùng TOPSIS / chỉ dùng Exponential Decay?"*.

### 12.1. Exponential Decay đứng riêng — **không đủ tư cách**

Exponential Decay chỉ trả lời được câu hỏi *"khách hay đỗ khu nào gần đây?"* — tức **một tiêu chí
duy nhất**. Nó không chuẩn hoá, không cân bằng nhiều tiêu chí, không xếp hạng phương án. Vì vậy nó
được giữ lại đúng vai trò: **bước tiền xử lý sinh giá trị thô cho tiêu chí C1 của SAW** (mục 3).

### 12.2. TOPSIS — **thừa phức tạp cho quy mô bài toán này**

| Tiêu chí so sánh | SAW (chọn) | TOPSIS (không chọn) |
|---|---|---|
| **Độ phức tạp tính toán** | O(n×m) | O(n×m) — tương đương |
| **Độ phức tạp khái niệm** | ✅ "điểm = tổng trọng số × giá trị chuẩn hoá" | ⚠️ Cần giải thích chuẩn hoá vector, phương án lý tưởng A⁺/A⁻, khoảng cách Euclidean, chỉ số CC |
| **Giải thích cho nhân viên bãi xe** | ✅ "Điểm 0.76 — khu ưa thích 35%, còn trống 25%" | ❌ "CC = 0.71 vì gần phương án lý tưởng" — không hành động được |
| **Giải thích cho admin khi chỉnh trọng số** | ✅ Tăng w₁ → khu ưa thích quan trọng hơn; tuyến tính, dự đoán được | ❌ Tăng w₁ làm dịch chuyển cả A⁺ lẫn A⁻ → ảnh hưởng phi tuyến, khó dự đoán |
| **Nhạy với outlier** | Ít nhạy (chuẩn hoá chia cho max) | Nhạy hơn (chuẩn hoá vector dùng √Σx²) |
| **Kết quả trên bài toán này** | — | Gần như trùng SAW: với 5 tiêu chí và vài chục chỗ đỗ, thứ hạng top-1 hầu như luôn giống nhau |

**Kết luận**: TOPSIS mạnh khi số phương án lớn, tiêu chí xung đột mạnh và cần phân biệt tinh vi giữa
các phương án gần nhau. Bài toán gợi ý chỗ đỗ ở đây có quy mô nhỏ (vài chục chỗ trống, 5 tiêu chí
không xung đột gay gắt), nên chi phí khái niệm của TOPSIS không đổi lại được lợi ích nào — trong khi
lại làm hỏng chính điểm mạnh nhất của hệ thống: **tính giải thích được**.

*(Nếu hội đồng muốn xem hướng mở rộng: có thể bổ sung TOPSIS như một module đối chứng ở phiên bản sau,
hoặc dùng AHP — Saaty 1980 — để sinh trọng số w₁–w₅ một cách có hệ thống thay vì gán tay.)*

---

> **Kết luận**: SAW — Simple Additive Weighting — là thuật toán ra quyết định chính thức cho tính năng
> gợi ý chỗ đỗ, với Exponential Decay Weighting làm bước tiền xử lý cho tiêu chí "mức ưa thích chỗ đỗ".
> Phương án này đáp ứng đủ tiêu chí "thuật toán quốc tế đã được kiểm chứng", thể hiện năng lực phân
> tích đa tiêu chí (MCDA), giải thích được tới từng tiêu chí, và cấu hình được qua Hệ chuyên gia —
> tất cả nằm trong tech stack hiện tại, không cần ML hay service bên ngoài.
