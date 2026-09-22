# Cấu trúc code — Tính năng thông minh (Smart Features)

> Tài liệu phân tích chi tiết cấu trúc và logic code của 5 tính năng thông minh trong hệ thống QLBDX.
> Mỗi tính năng đều kèm **đoạn code mẫu gốc** có chú thích từng dòng để người đọc hiểu cách tư duy và học theo.
>
> **Cập nhật 01/09/2026** — các luật if/else trong tài liệu này đã được chuyển sang module hệ chuyên gia
> `backend/src/expertSystem/` (Knowledge Base lưu trong DB + Inference Engine). Code mẫu bên dưới đã được
> cập nhật theo bản mới nhất. Xem thêm [NANG_CAP_NANG_CAO.md](NANG_CAP_NANG_CAO.md) và
> [SUA_LOI_ENABLED_VA_VALIDATE_RULE.md](SUA_LOI_ENABLED_VA_VALIDATE_RULE.md).

---

## Mục lục

1. [Tổng quan kiến trúc Smart Features](#1-tổng-quan-kiến-trúc-smart-features)
2. [Smart Lookup — Tra cứu thông minh & auto-fill](#2-smart-lookup--tra-cứu-thông-minh--auto-fill)
3. [Package Recommendation — Gợi ý gói dịch vụ](#3-package-recommendation--gợi-ý-gói-dịch-vụ)
4. [Alert Rule Engine — Hệ thống cảnh báo đa tầng](#4-alert-rule-engine--hệ-thống-cảnh-báo-đa-tầng)
5. [Dashboard Insights — Phân tích tổng quan thông minh](#5-dashboard-insights--phân-tích-tổng-quan-thông-minh)
6. [Analytics DSS — Hệ hỗ trợ ra quyết định](#6-analytics-dss--hệ-hỗ-trợ-ra-quyết-định)
7. [Các module hỗ trợ (Utility)](#7-các-module-hỗ-trợ-utility)
8. [Luồng dữ liệu end-to-end](#8-luồng-dữ-liệu-end-to-end)

---

## 1. Tổng quan kiến trúc Smart Features

### Triết lý thiết kế

Hệ thống **không sử dụng AI/ML** (machine learning). Toàn bộ "trí thông minh" được xây dựng bằng **thuật toán rule-based** (dựa trên quy tắc) kết hợp **thống kê cửa sổ trượt 30 ngày** (rolling window). Đây là lựa chọn có chủ đích:

| Tiêu chí | Rule-based (đã chọn) | ML/AI |
|---|---|---|
| Giải thích được | ✅ Admin hiểu tại sao hệ thống gợi ý | ❌ Black box |
| Dữ liệu cần thiết | Ít (vài trăm bản ghi) | Nhiều (hàng ngàn+) |
| Triển khai | Đơn giản, không cần GPU/service riêng | Phức tạp |
| Tuỳ chỉnh | Admin tự chỉnh ngưỡng qua UI | Cần retrain model |

### Sơ đồ kiến trúc tổng thể

```
┌──────────────────────────────────────────────────────────────┐
│  FRONTEND (React + Ant Design)                               │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ParkingEntry  │  │MgmtDashboard │  │  Alerts / Analytics│  │
│  │(auto-fill)   │  │(insights)    │  │  (cảnh báo + DSS)  │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬───────────┘  │
│         │                 │                    │              │
│  useDashboardData (hook: auto-refresh 90s)     │              │
└─────────┼─────────────────┼────────────────────┼──────────────┘
          │ API             │ API                │ API
          ▼                 ▼                    ▼
┌──────────────────────────────────────────────────────────────┐
│  BACKEND (Express + Prisma + TypeScript)                     │
│                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐  │
│  │parking.service  │  │report.service   │  │analytics      │  │
│  │ smartLookup()  │  │ getInsights()  │  │ .service      │  │
│  │                │  │ getAlerts()    │  │ getInsights() │  │
│  └───────┬────────┘  └───────┬────────┘  └───────┬───────┘  │
│          │                   │                    │          │
│  ┌───────┴───────────────────┴────────────────────┘          │
│  │  Shared utilities:                                        │
│  │  • feeCalculator.ts (tính phí)                            │
│  │  • businessRules.ts (phân loại xe/chỗ đỗ)                │
│  │  • expertSystem/ (Knowledge Base + Inference Engine)      │
│  └───────────────────────────────────────────────────────────┘
│                          │                                    │
└──────────────────────────┼────────────────────────────────────┘
                           ▼
                    ┌──────────────┐
                    │  SQL Server  │
                    │  (Prisma)    │
                    └──────────────┘
```

### Mẫu thiết kế chung (Common Patterns)

Tất cả smart features đều tuân theo 3 pattern nhất quán:

1. **Rolling Window 30 ngày**: Mọi thống kê đều lấy dữ liệu 30 ngày gần nhất, không phải toàn bộ lịch sử
2. **Promise.all cho query song song**: Gộp nhiều query DB chạy đồng thời để giảm latency
3. **Pure logic tách khỏi DB**: Phần tính toán là hàm thuần (pure function), dễ test

---

## 2. Smart Lookup — Gợi ý chỗ đỗ bằng thuật toán SAW

**Thuật toán:** `backend/src/utils/smartParkingAlgorithms.ts` — SAW + Exponential Decay (hàm thuần tuý)
**Nghiệp vụ:** `backend/src/services/parking.service.ts` → hàm `smartLookup()` (dòng 763–947)
**API:** `GET /api/parking/smart-lookup/:plate`
**Frontend:** `frontend/src/pages/ParkingEntry.tsx`
**Kiểm thử:** `backend/src/utils/smartParkingAlgorithms.test.ts` — `npm run test:saw` (23 ca)

### Mục đích
Khi nhân viên nhập biển số xe vào, hệ thống tự động:
- Nhận diện khách quen / khách mới
- **Chấm điểm và xếp hạng mọi chỗ trống** bằng SAW, gợi ý chỗ điểm cao nhất (auto-fill vào form)
- **Giải thích được** vì sao chọn chỗ đó
- Hiển thị lịch sử và thói quen đỗ xe

> **Thuật toán quốc tế**: SAW — Simple Additive Weighting (Fishburn 1967; Hwang & Yoon 1981),
> có Exponential Decay Weighting (Holt 1957) làm bước tiền xử lý.
> Lý do chọn: `docs/DE_XUAT_THUAT_TOAN_GOI_Y_CHO_DO_THONG_MINH.md`.
> Vấn đề gặp khi triển khai + cách xử lý: `docs/THUAT_TOAN_SAW_VAN_DE_VA_CACH_XU_LY.md`.

### Code mẫu Backend — các bước suy luận

```typescript
// File: parking.service.ts — hàm smartLookup()
// ═══════════════════════════════════════════════════════════════
// Bước 1: Chạy 4 query DB SONG SONG bằng Promise.all
// Thay vì chạy tuần tự (A xong → B xong → C xong → D xong),
// Promise.all chạy cả 4 cùng lúc → tổng thời gian = query chậm nhất
// ═══════════════════════════════════════════════════════════════

const since30 = new Date();
since30.setDate(since30.getDate() - 30);   // ← Rolling window: chỉ lấy 30 ngày
const now = new Date();

const [visitCount30Days, recentRecords, activePkg, availableSpots] = await Promise.all([
  // Query 1: Đếm số lần xe này vào bãi trong 30 ngày
  prisma.parkingRecord.count({
    where: { vehicleId: fullVehicle.id, entryTime: { gte: since30 } }
  }),

  // Query 2: Lấy 30 lượt gần nhất (đã hoàn thành) kèm thông tin chỗ đỗ
  prisma.parkingRecord.findMany({
    where: { vehicleId: fullVehicle.id, status: 'completed' },
    orderBy: { entryTime: 'desc' },
    take: 30,
    include: { parkingSpot: { include: { zone: { select: { name: true } } } } },
  }),

  // Query 3: Kiểm tra xe có gói dịch vụ đang hiệu lực không
  prisma.customerPackage.findFirst({
    where: {
      vehicleId: fullVehicle.id,
      status: { not: 'cancelled' },
      startDate: { lte: now },      // Gói đã bắt đầu
      endDate: { gte: now },        // Gói chưa hết hạn
    },
    include: { parkingPackage: { select: { name: true } } },
  }),

  // Query 4: Lấy toàn bộ chỗ đỗ đang trống
  prisma.parkingSpot.findMany({
    where: { status: 'available' },
    include: { zone: { select: { name: true, description: true } } },
  }),
]);
```

**Giải thích:** Promise.all nhận 1 mảng các Promise, chạy tất cả đồng thời, trả về mảng kết quả theo đúng thứ tự. Nếu 4 query mỗi cái mất 50ms, chạy tuần tự sẽ mất 200ms; dùng Promise.all chỉ mất ~50ms.

### Code mẫu — Mức ưa thích chỗ đỗ (Exponential Decay Weighting)

```typescript
// ═══════════════════════════════════════════════════════════════
// Bước 2: Chấm điểm "khách hay đỗ đâu" — KHÔNG đếm tần suất đơn thuần
//
// Vấn đề của phép đếm: lượt đỗ 29 ngày trước có trọng số BẰNG lượt hôm qua,
// nên khách đổi thói quen thì hệ thống phải đợi rất lâu mới bám theo.
//
// Exponential Decay (Holt 1957): weight(i) = alpha * (1-alpha)^i
//   i = 0 là lượt gần nhất  → weight = 0.300
//   i = 1                    → weight = 0.210
//   i = 2                    → weight = 0.147 ...
// ═══════════════════════════════════════════════════════════════

export function calcZonePreference(recentRecords, alpha = 0.3) {
  const scores = new Map<string, number>();
  recentRecords.forEach((record, index) => {
    const zoneName = record.parkingSpot?.zone?.name;
    if (!zoneName) return;
    const weight = alpha * Math.pow(1 - alpha, index);
    scores.set(zoneName, (scores.get(zoneName) || 0) + weight);
  });
  return scores;
}

// Hàm song song calcSpotPreference() chấm điểm cho TỪNG CHỖ ĐỖ cụ thể
// (cùng công thức, gom theo parkingSpotId thay vì theo tên khu)
```

**Giải thích:** `Math.pow(1 - alpha, index)` làm trọng số giảm theo cấp số nhân khi đi ngược về quá
khứ. Độ phức tạp vẫn O(n) như phép đếm cũ, nhưng kết quả **tự thích nghi**: khách chuyển sang khu
mới thì sau vài lượt khu mới đã vượt lên, không cần đợi chiếm đa số trong 30 lượt.

**Vì sao phải chấm điểm ở cả mức từng chỗ đỗ?** Bốn tiêu chí còn lại (C2–C5) đều là thuộc tính của
**khu**, nên mọi chỗ nằm trong cùng một khu bằng điểm nhau. Nếu điểm ưa thích cũng chỉ ở mức khu
thì thuật toán không phân biệt được chỗ nào với chỗ nào. Bộ lọc loại xe càng làm rõ vấn đề vì nó
thu hẹp ứng viên về rất ít khu (Khu A cho xe hai bánh, Khu B cho ô tô, Khu C cho xe lớn, Khu D
nhận mọi loại). Đo được trên dữ liệu thật: cả 45 chỗ trống của Khu A cùng ra 1.00 điểm. Chi tiết:
`THUAT_TOAN_SAW_VAN_DE_VA_CACH_XU_LY.md` mục 3.1.

### Code mẫu — SAW: chấm điểm và xếp hạng chỗ đỗ

```typescript
// ═══════════════════════════════════════════════════════════════
// Bước 3: Xây danh sách ứng viên với 5 tiêu chí
// ═══════════════════════════════════════════════════════════════

// Lọc: chỉ giữ các chỗ trống phù hợp loại xe (xe máy ↔ khu xe máy, ô tô ↔ khu ô tô)
const compatibleSpots = availableSpots.filter((s) =>
  isSpotCompatibleWithVehicleType(s, fullVehicle.vehicleType.name)
);

const candidates: SpotCandidate[] = compatibleSpots.map((spot) => {
  const zoneName = spot.zone?.name || '';
  const stats = zoneStats.get(zoneName);
  return {
    spotId: spot.id,
    spotNumber: spot.spotNumber,
    zoneName,
    // C1 — ưa thích: điểm KHU + điểm ĐÚNG CHỖ đó
    zonePreference: (zonePreferences.get(zoneName) || 0) + (spotPreferences.get(spot.id) || 0),
    zoneAvailability: stats?.availability ?? 0,          // C2 — tỷ lệ còn trống
    typeMatchScore: calcTypeMatch(spot, vehicleTypeName), // C3 — hợp loại xe
    peakHourFit: hourlyPattern.get(zoneName) ?? 0.5,      // C4 — hợp khung giờ
    currentOccupancy: stats?.occupancy ?? 0,              // C5 — độ đông (cost)
  };
});

// ═══════════════════════════════════════════════════════════════
// Bước 4: SAW — chuẩn hoá về [0,1] rồi tính tổng có trọng số
// ═══════════════════════════════════════════════════════════════

for (let j = 0; j < SAW_CRITERIA_COUNT; j++) {
  const column = criteria.map((row) => row[j]);
  const maxVal = Math.max(...column);
  const minVal = Math.min(...column);

  for (let i = 0; i < candidates.length; i++) {
    normalized[i][j] = IS_BENEFIT[j]
      ? (maxVal > 0 ? criteria[i][j] / maxVal : 0)           // benefit: cao = tốt
      : (criteria[i][j] > 0 ? minVal / criteria[i][j] : 1);  // cost: thấp = tốt
  }
}

// Score = tổng có trọng số, rồi xếp hạng giảm dần
const totalScore = w.reduce((sum, weight, j) => sum + weight * normalized[i][j], 0);
results.sort((a, b) => b.totalScore - a.totalScore);

const bestSpot = sawResults[0];
suggestedSpotId = bestSpot.spotId;
suggestedSpotNote = bestSpot.explanation;
```

**Giải thích:** Đây là toàn bộ SAW gói trong ba chục dòng. Phép chuẩn hoá đưa các tiêu chí có đơn vị
hoàn toàn khác nhau (điểm decay, tỷ lệ %, điểm 0.5/1.0) về cùng thang [0, 1] để cộng được với nhau.
Độ phức tạp O(n×m) với n = số chỗ trống, m = 5 tiêu chí — toàn bộ tính trong bộ nhớ, **không phát
sinh query DB nào**.

Ba chi tiết dễ bị bỏ qua:
- `maxVal > 0 ? ... : 0` — khi cả cột bằng 0 (xe mới chưa có lịch sử) thì tránh chia cho 0.
- `criteria[i][j] > 0 ? minVal / ... : 1` — với tiêu chí cost, giá trị 0 là hoàn hảo (khu trống trơn).
- Điểm SAW là **điểm tương đối trong nhóm**, không phải thang tuyệt đối. Chỗ tốt nhất trên mọi tiêu
  chí luôn đạt đúng 1.00, kể cả khi nó thực sự là một chỗ tồi. Vì vậy câu giải thích không ghi
  "1.00/1.00" mà báo rõ thế hoà khi nhiều chỗ cùng điểm.

### Code mẫu — Sinh câu giải thích (explainability)

```typescript
// Nêu 2 tiêu chí đóng góp nhiều điểm nhất
const topFactors = spot.normalizedScores
  .map((s, idx) => ({ name: CRITERIA_LABELS[idx], contribution: s * weights[idx] }))
  .filter((f) => f.contribution > 0)
  .sort((a, b) => b.contribution - a.contribution)
  .slice(0, 2);

// → "Điểm 1.00 — yếu tố chính: Mức ưa thích chỗ đỗ (35%), Tỷ lệ còn trống (25%)"

// Nhiều chỗ hoà điểm đầu bảng → nói thẳng, không vờ có căn cứ riêng
if (spot.rank === 1 && tiedAtTop > 1) {
  return `Điểm ${score} — ${tiedAtTop} chỗ trống cùng mức điểm cao nhất, chọn chỗ đầu danh sách`;
}
```

**Giải thích:** Đây là phần phân biệt hệ thống khuyến nghị **giải thích được** với một mô hình hộp
đen. Nhân viên đọc câu này là nói lại được với khách vì sao hôm nay gợi ý chỗ khác.

### Code mẫu — Trọng số đọc từ Hệ chuyên gia (không hardcode)

```typescript
// parking.service.ts → getSawConfig()
private async getSawConfig(): Promise<{ weights: number[]; alpha: number }> {
  const fallback = { weights: DEFAULT_SAW_WEIGHTS, alpha: DEFAULT_DECAY_ALPHA };
  try {
    const rules = await knowledgeBase.getRulesByDomain('parking_recommendation');
    const params = rules.find((r) => r.code === 'PARKING_REC_WEIGHTS')?.actions[0]?.params;
    if (!params) return fallback;

    const weights = SAW_WEIGHT_KEYS.map((key) => params[key]);
    if (weights.some((w) => typeof w !== 'number' || Number.isNaN(w))) return fallback;
    ...
  } catch {
    return fallback;   // luật hỏng/bị tắt → vẫn chạy được
  }
}
```

**Giải thích:** Admin chỉnh 5 trọng số + hệ số alpha trên màn **Cảnh báo → Cấu hình nâng cao**, hệ
thống áp dụng ngay. `validateRule()` chặn lưu nếu tổng 5 trọng số khác 1.0. Chiều đọc luôn có
fallback vì hàm này chạy mỗi lần nhân viên gõ biển số — không được phép chết vì một dòng cấu hình sai.

### Code mẫu Frontend — Auto-fill form khi lookup thành công

```typescript
// File: ParkingEntry.tsx — hàm lookupPlate()
// ═══════════════════════════════════════════════════════════════
// Khi nhân viên nhập biển số → gọi API smart-lookup → tự điền form
// ═══════════════════════════════════════════════════════════════

const lookupPlate = async () => {
  const raw = form.getFieldValue('licensePlate');
  if (!raw) return;
  const plate = normalizePlate(raw);              // Chuẩn hoá: bỏ dấu gạch, space, in hoa
  form.setFieldsValue({ licensePlate: plate });

  try {
    const res = await api.get<SmartLookupResult>(
      `/parking/smart-lookup/${encodeURIComponent(plate)}`
    );
    const { vehicle, insights } = res.data;

    if (!vehicle) {
      // Xe mới, chưa có trong hệ thống → xoá state cũ
      setVehicleInfo(null);
      setSmartInsights(null);
      return;
    }

    // ← Đây là lúc "thông minh" thể hiện ở frontend:
    setVehicleInfo(vehicle);
    setSmartInsights(insights);                    // Hiện card thông tin thông minh

    form.setFieldsValue({ vehicleTypeId: vehicle.vehicleTypeId }); // Auto-fill loại xe

    if (insights?.suggestedSpotId) {
      form.setFieldsValue({ parkingSpotId: insights.suggestedSpotId }); // Auto-fill chỗ đỗ!
    }

    message.info(`Xe của: ${vehicle.customer?.fullName || 'Không rõ'}`);
  } catch {
    setVehicleInfo(null);
    setSmartInsights(null);
  }
};
```

**Giải thích:** `form.setFieldsValue()` là API của Ant Design Form — cho phép set giá trị nhiều trường cùng lúc. Nhân viên không cần chọn tay, chỉ cần nhập biển số → hệ thống tự điền loại xe + chỗ đỗ.

---

## 3. Package Recommendation — Gợi ý gói dịch vụ

**File:** `backend/src/services/customerPackage.service.ts` → hàm `getPackageRecommendation()` (dòng 364–468)
**API:** `GET /api/customer-packages/recommend/:customerId`
**Hiển thị:** Sau khi khách thanh toán xong ở trang `ParkingExit.tsx`

### Mục đích
Phân tích hành vi 30 ngày → gợi ý gói dịch vụ tiết kiệm nhất cho khách, đúng loại xe, đúng thời điểm (sau khi thanh toán — "upsell moment").

### Code mẫu — Luật gợi ý theo tần suất (tiered rules)

```typescript
// File: customerPackage.service.ts — hàm getPackageRecommendation()
// ═══════════════════════════════════════════════════════════════
// Bước 1: Đếm tần suất đỗ xe trong 30 ngày
// ═══════════════════════════════════════════════════════════════

const now = new Date();
const since30 = new Date();
since30.setDate(since30.getDate() - 30);     // ← Rolling window 30 ngày

const [records, activePkg] = await Promise.all([
  prisma.parkingRecord.findMany({
    where: {
      vehicle: { customerId },                // Mọi xe của khách này
      entryTime: { gte: since30 },            // Trong 30 ngày qua
      status: 'completed',                    // Chỉ lượt đã hoàn thành
    },
    select: { fee: true, vehicleTypeId: true },
  }),
  prisma.customerPackage.findFirst({           // Kiểm tra đã có gói chưa
    where: {
      customerId,
      status: { not: 'cancelled' },
      startDate: { lte: now },
      endDate: { gte: now },
    },
  }),
]);

const frequency = records.length;              // Số lần đỗ trong tháng
const totalSpent = records.reduce((sum, r) => sum + Number(r.fee || 0), 0);

// ═══════════════════════════════════════════════════════════════
// Bước 2: Nếu đã có gói → không gợi ý (tránh phiền khách)
// ═══════════════════════════════════════════════════════════════
if (activePkg) {
  return {
    recommendation: 'none',
    reason: 'Khách hàng đã có gói đang hiệu lực',
  };
}

// ═══════════════════════════════════════════════════════════════
// Bước 3: Hỏi Inference Engine — KHÔNG còn if/else ngưỡng trong code
//
// Ngưỡng 5/12/20 và % tiết kiệm nay nằm trong Knowledge Base
// (bảng ExpertRules, domain "package"), admin sửa được qua UI.
// knowledgeBase chỉ nạp luật enabled = true → tắt 1 luật là nó
// lập tức ngừng sinh gợi ý, không cần sửa code hay deploy lại.
// ═══════════════════════════════════════════════════════════════

const evalResult = await evaluate({ frequency }, 'package');

// firedRules xếp theo priority tăng dần → phần tử đầu là luật ưu tiên
// cao nhất trong số các luật cùng khớp (đỗ 22 lần/tháng khớp cả gói
// năm/quý/tháng → lấy gói năm vì priority = 10 nhỏ nhất).
const fired = evalResult.firedRules[0];

if (!fired) {
  return {
    recommendation: 'none',
    reason: `Tần suất đỗ xe thấp (${frequency} lần/tháng, dưới ngưỡng cấu hình)`,
  };
}

const params = fired.actionOutputs[0].params;  // { package, savings, durationDays }
const recommendation = params.package;         // 'yearly' | 'quarterly' | 'monthly'
const savings = params.savings;                // '~40%' | '~30%' | '~20%'
const durationDays = params.durationDays;      // 365 | 90 | 30

// fired.explanation = "[Gợi ý gói năm] Thỏa mãn: frequency = 22 >= 20 → đúng"
// → trả kèm về frontend làm Explanation Facility của hệ chuyên gia
```

**Giải thích:** Pattern "tiered rules" vẫn còn, nhưng đã **chuyển từ code xuống dữ liệu**. Trước đây chuỗi `if/else` quyết định ngưỡng; nay Inference Engine AND-match từng luật rồi sắp theo `priority`, còn ngưỡng nằm trong bảng `ExpertRules`. Ba khác biệt quan trọng: (1) admin đổi ngưỡng 5/12/20 qua UI, không cần deploy; (2) tắt một luật là nó biến mất khỏi engine; (3) mỗi kết quả kèm chuỗi `explanation` giải thích vì sao luật khớp.

> **Validate khi lưu luật** — luật `domain = "package"` bắt buộc `action.type = "recommend"` và
> `params` phải có `package` (yearly/quarterly/monthly), `durationDays` (số > 0), `savings`.
> Thiếu field hoặc sai giá trị thì API trả 400, không lưu được vào DB. Xem
> `backend/src/expertSystem/validation.ts`.

### Code mẫu — Tìm loại xe chủ đạo (dominant type)

```typescript
// ═══════════════════════════════════════════════════════════════
// Bước 4: Tìm loại xe khách dùng nhiều nhất → match đúng gói
// Vì sao? 1 khách có thể có cả xe máy lẫn ô tô, nhưng gói dịch vụ
// phân theo loại xe. Cần tìm loại xe đỗ thường xuyên nhất.
// ═══════════════════════════════════════════════════════════════

const typeCounts = new Map<number, number>();     // {vehicleTypeId → số lần}
for (const r of records) {
  typeCounts.set(r.vehicleTypeId, (typeCounts.get(r.vehicleTypeId) || 0) + 1);
}

let dominantTypeId = records[0].vehicleTypeId;    // Mặc định: xe đầu tiên
let maxCount = 0;
for (const [typeId, count] of typeCounts) {
  if (count > maxCount) {
    maxCount = count;
    dominantTypeId = typeId;                      // → Loại xe đỗ nhiều nhất
  }
}

// Tìm gói dịch vụ khớp: đúng loại xe + đúng thời hạn + đang bán
const matchingPackage = await prisma.parkingPackage.findFirst({
  where: {
    vehicleTypeId: dominantTypeId,
    durationDays: durationDays!,                  // 30, 90, hoặc 365
    isActive: true,
  },
});

// Trả về gợi ý cụ thể: tên gói, giá, mức tiết kiệm
return {
  recommendation,
  savings,
  frequency,
  totalSpent,
  reason: `Đỗ xe ${frequency} lần/tháng — rất thường xuyên`,
  packageId: matchingPackage?.id ?? null,
  packageName: matchingPackage?.name ?? null,
  packagePrice: matchingPackage ? Number(matchingPackage.price) : null,
};
```

**Giải thích:** Kết quả không phải "bạn nên mua gói" chung chung, mà là gợi ý **cụ thể**: tên gói + giá + tiết kiệm bao nhiêu %. Frontend có thể hiển thị nút "Đăng ký ngay" dẫn thẳng đến gói.

---

## 4. Alert Rule Engine — Hệ thống cảnh báo đa tầng

**File chính:**
- `backend/src/expertSystem/` — Knowledge Base + Inference Engine (nguồn luật duy nhất)
- `backend/src/services/alertRuleTier.service.ts` — adapter mỏng trên `ExpertRule` domain `"alert"`,
  cung cấp `getAllGrouped()` (chỉ mốc `enabled = true`) và `evaluate()` chọn mốc nghiêm trọng nhất
- `backend/src/services/report.service.ts` → hàm `getAlerts()`

**API:** `GET /api/reports/alerts`

### Mục đích
Phát hiện bất thường, rủi ro, và cơ hội kinh doanh — với mức nghiêm trọng (severity) tự động phân loại dựa trên ngưỡng admin cấu hình.

### Kiến trúc 2 lớp

```
Lớp 1: Knowledge Base (bảng ExpertRules, domain = "alert")
   ┌──────────────────────────────────────────────────────────┐
   │  code                            fact/threshold  severity │  enabled
   │  ──────────────────────────────────────────────────────── │
   │  alert_longParkingHours_48       >= 48h          danger   │   true
   │  alert_longParkingHours_24       >= 24h          warning  │   true
   │  alert_zoneNearFullPercent_10    <= 10%          warning  │   true
   │  alert_parkingAnomalyMultiplier_3 >= 3 lần       warning  │   false ← đã tắt
   └──────────────────────────────────────────────────────────┘
          │
          ▼ getAllGrouped()  ── LỌC enabled = true ──
          │   (mốc đã tắt bị loại ở đây → không thể phát cảnh báo)
          │
   ┌──────────────────────────────────────────────┐
   │ Sắp xếp ngưỡng: cao → thấp (gte)             │
   │ So khớp: trả severity của ngưỡng đầu tiên    │
   │          mà value >= threshold                │
   └──────────────────────────────────────────────┘

Lớp 2: Alert Generators (report.service.ts → getAlerts())
   7 loại detector, mỗi loại gọi evaluate() để xác định severity
```

### Code mẫu — Rule Engine (hàm evaluate)

```typescript
// File: alertRuleTier.service.ts
// ═══════════════════════════════════════════════════════════════
// Đây là "trái tim" của hệ thống cảnh báo — hàm evaluate()
// Nhận: loại quy tắc + giá trị đo được
// Trả: mức nghiêm trọng ('danger' | 'warning' | 'info') hoặc null
// ═══════════════════════════════════════════════════════════════

// Định nghĩa 7 loại cảnh báo, mỗi loại có:
// - label: tên hiển thị
// - unit: đơn vị đo
// - comparator: chiều so sánh ('gte' = >=, 'lte' = <=)
export const RULE_TYPES = {
  zoneNearFullPercent:      { label: 'Khu vực sắp đầy',     unit: '% chỗ trống',    comparator: 'lte' },
  zoneImbalanceMaxPercent:  { label: 'Mất cân bằng khu vực', unit: '% khu quá tải',  comparator: 'gte' },
  longParkingHours:         { label: 'Xe đỗ quá lâu',       unit: 'giờ đã đỗ',      comparator: 'gte' },
  parkingAnomalyMultiplier: { label: 'Xe đỗ bất thường',    unit: 'lần so với TB',   comparator: 'gte' },
  suspiciousPaymentAmount:  { label: 'Thanh toán bất thường',unit: 'đ',              comparator: 'gte' },
  revenueDropPercent:       { label: 'Doanh thu sụt giảm',  unit: '% sụt',          comparator: 'gte' },
  renewalFrequency:         { label: 'Gợi ý gia hạn',       unit: 'lần đỗ/tháng',   comparator: 'gte' },
} as const;

// Hàm evaluate — thuật toán so khớp ngưỡng
evaluate(
  ruleType: RuleType,
  value: number,
  grouped: Record<string, { threshold: number; severity: string }[]>
): string | null {
  const tiers = grouped[ruleType] || [];
  if (tiers.length === 0) return null;           // Chưa có ngưỡng → tắt rule này

  const comparator = RULE_TYPES[ruleType].comparator;

  // Sắp xếp: ngưỡng nghiêm trọng nhất trước
  // - 'gte' (>=): sắp giảm dần (48 > 24 > 12) → kiểm tra ngưỡng cao nhất trước
  // - 'lte' (<=): sắp tăng dần (5 < 10 < 15) → kiểm tra ngưỡng thấp nhất trước
  const sorted = [...tiers].sort((a, b) =>
    comparator === 'gte'
      ? b.threshold - a.threshold    // Ví dụ: [48, 24, 12]
      : a.threshold - b.threshold    // Ví dụ: [5, 10, 15]
  );

  // Duyệt từ mức nghiêm trọng nhất → trả về ngay khi khớp
  for (const tier of sorted) {
    const matched = comparator === 'gte'
      ? value >= tier.threshold      // "Xe đỗ 50h" >= 48 → danger
      : value <= tier.threshold;     // "Còn 3% chỗ" <= 5% → danger
    if (matched) return tier.severity;
  }
  return null;                       // Dưới mọi ngưỡng → không cảnh báo
}
```

**Giải thích:** Thuật toán "first-match từ nghiêm trọng nhất". Ví dụ xe đỗ 50 giờ:
- So với 48h (danger) → 50 >= 48 ✅ → trả "danger", **dừng**
- Không cần kiểm tra 24h (warning) nữa

Nếu xe đỗ 30 giờ:
- So với 48h (danger) → 30 >= 48 ❌ → tiếp
- So với 24h (warning) → 30 >= 24 ✅ → trả "warning"

### Code mẫu — Phát hiện xe đỗ bất thường (Anomaly Detection)

```typescript
// File: report.service.ts — trong hàm getAlerts()
// ═══════════════════════════════════════════════════════════════
// Phát hiện: Xe đỗ lâu hơn N lần trung bình của LOẠI XE ĐÓ
// Tại sao "loại xe đó"? Vì xe tải đỗ 2 ngày là bình thường,
// nhưng xe máy đỗ 2 ngày là bất thường.
// ═══════════════════════════════════════════════════════════════

// Bước 1: Tính trung bình duration 30 ngày, THEO TỪNG LOẠI XE
const avgDurationByType = new Map(
  vehicleTypeAvgDuration.map((v) => [
    v.vehicleTypeId,
    Number(v._avg.duration || 0)    // Prisma groupBy + _avg
  ])
);

// Bước 2: Duyệt mọi xe đang đỗ, so sánh với trung bình loại xe đó
const parkingAnomalyAlerts = currentlyParkedForAnomaly
  .map((record) => {
    // Tính thời gian đã đỗ (phút)
    const currentMinutes = Math.ceil(
      (now.getTime() - new Date(record.entryTime).getTime()) / 60000
    );
    // Lấy trung bình của loại xe này
    const avgMinutes = avgDurationByType.get(record.vehicleTypeId) || 0;

    // Bỏ qua nếu: chưa có dữ liệu trung bình, hoặc đỗ dưới ngưỡng tối thiểu
    if (avgMinutes <= 0 || currentMinutes < settings.parkingAnomalyMinMinutes) {
      return null;
    }

    // Tính hệ số bất thường: currentMinutes / avgMinutes
    // Ví dụ: xe máy TB đỗ 2h, xe này đỗ 8h → multiplier = 4.0
    const multiplier = currentMinutes / avgMinutes;

    // Đưa qua rule engine: multiplier >= 5 → danger, >= 3 → warning
    const severity = evalTier('parkingAnomalyMultiplier', multiplier);
    if (!severity) return null;       // Dưới ngưỡng → bỏ qua

    return {
      severity,
      title: 'Xe đỗ bất thường',
      description: `${record.licensePlate} đã đỗ ${currentHours}h, `
        + `gấp ${multiplier.toFixed(1)} lần trung bình ${avgHours}h`,
      suggestedAction: 'Kiểm tra xe',
    };
  })
  .filter(Boolean);                   // Loại bỏ null
```

**Giải thích:** Đây là kỹ thuật **anomaly detection đơn giản bằng z-score cải tiến**: thay vì so với trung bình chung, so với trung bình **theo nhóm** (per-group). Hiệu quả hơn nhiều vì mỗi loại xe có pattern khác nhau. Phương pháp này gọi là **contextual anomaly detection** trong thống kê.

---

## 5. Dashboard Insights — Phân tích tổng quan thông minh

**File:** `backend/src/services/report.service.ts` → hàm `getInsights()` (dòng 733–924)
**API:** `GET /api/reports/insights`
**Frontend hook:** `frontend/src/hooks/useDashboardData.ts`

### Mục đích
Cung cấp bức tranh tổng quan cho quản lý: so sánh tuần, giờ cao điểm, xu hướng, gợi ý hành động.

### Code mẫu — So sánh tuần theo đúng ngày trong tuần (weekday-aligned)

```typescript
// File: report.service.ts — hàm getInsights()
// ═══════════════════════════════════════════════════════════════
// So sánh "tuần này" vs "tuần trước" — ALIGNED theo ngày trong tuần
//
// Tại sao không đơn giản trừ 7 ngày?
// → Nếu hôm nay là Thứ 4, "7 ngày trước" bao gồm cả Thứ 7 + CN
//   của tuần trước, nhưng "tuần này" chưa có Thứ 7 + CN
//   → So sánh sai lệch (Sai số gọi là "weekday bias")
//
// Cách đúng: So cùng vị trí trong tuần
// Tuần này:  T2...T4 (đến bây giờ)
// Tuần trước: T2...T4 (cùng giờ tuần trước)
// ═══════════════════════════════════════════════════════════════

const now = new Date();
const dayOfWeek = now.getDay();                   // 0=CN, 1=T2, ..., 6=T7
const daysSinceMonday = (dayOfWeek + 6) % 7;     // Tính khoảng cách đến T2 gần nhất

// Mốc đầu tuần này (Thứ 2, 00:00:00)
const thisWeekStart = new Date(now);
thisWeekStart.setDate(thisWeekStart.getDate() - daysSinceMonday);
thisWeekStart.setHours(0, 0, 0, 0);

// Mốc đầu tuần trước (Thứ 2 tuần trước)
const lastWeekStart = new Date(thisWeekStart);
lastWeekStart.setDate(lastWeekStart.getDate() - 7);

// Mốc "cùng thời điểm tuần trước" — để so sánh fair
// Ví dụ: bây giờ là T4 14:30 → so với T4 tuần trước lúc 14:30
const lastWeekSameTime = new Date(now);
lastWeekSameTime.setDate(lastWeekSameTime.getDate() - 7);
```

### Code mẫu — Phát hiện giờ cao điểm (Peak Hour Detection)

```typescript
// ═══════════════════════════════════════════════════════════════
// Thuật toán: Histogram giờ vào bãi (30 ngày) → tìm peak trong 2 khung
// Buổi sáng: 5h–11h   |   Buổi chiều: 12h–21h
//
// Tại sao tách 2 khung? Vì bãi đỗ xe thường có 2 đỉnh:
// - Sáng: người đi làm gửi xe
// - Chiều: đi đón con / mua sắm
// Gộp chung sẽ bị peak chiều "nuốt" peak sáng
// ═══════════════════════════════════════════════════════════════

// Bước 1: Đếm số xe vào theo từng giờ (histogram)
const hourCounts = new Map<number, number>();
for (const r of recentRecords30d) {
  const hour = new Date(r.entryTime).getHours();  // 0–23
  hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
}

// Bước 2: Hàm tìm giờ đông nhất trong 1 khoảng
const daysSpan = 30;
const bestHourIn = (range: number[]) => {
  let bestHour = range[0];
  let bestCount = -1;
  for (const h of range) {
    const c = hourCounts.get(h) || 0;
    if (c > bestCount) {
      bestCount = c;
      bestHour = h;
    }
  }
  return {
    hour: bestHour,
    avgCount: Math.round((bestCount / daysSpan) * 10) / 10  // TB xe/ngày tại giờ đó
  };
};

// Bước 3: Áp dụng cho 2 khung giờ
const morningRange = Array.from({ length: 7 }, (_, i) => i + 5);    // [5,6,7,8,9,10,11]
const afternoonRange = Array.from({ length: 10 }, (_, i) => i + 12); // [12,13,...,21]
const peakHours = {
  morning: bestHourIn(morningRange),     // Ví dụ: { hour: 8, avgCount: 12.3 }
  afternoon: bestHourIn(afternoonRange), // Ví dụ: { hour: 17, avgCount: 15.7 }
};
```

**Giải thích:** Histogram là cấu trúc dữ liệu đếm tần suất theo nhóm. Ở đây nhóm là "giờ trong ngày" (0–23). Chia 2 khung thời gian giúp tìm 2 peak riêng biệt — kỹ thuật này gọi là **constrained argmax** (tìm max trong miền giới hạn).

### Code mẫu — Gợi ý hành động cho admin (rule-based suggestions)

```typescript
// ═══════════════════════════════════════════════════════════════
// Cả NGƯỠNG lẫn NỘI DUNG câu gợi ý đều nằm trong Knowledge Base
// (ExpertRules, domain "report"). Code chỉ còn 2 việc:
//   1. Gom dữ liệu thật thành "facts" đưa cho Inference Engine
//   2. Điền số liệu vào chỗ trống {tenBien} trong câu mẫu của luật
// ═══════════════════════════════════════════════════════════════

const suggestions: { type: string; message: string; explanation?: string }[] = [];

// Bước 1: đưa facts cho engine — engine chỉ xét luật enabled = true
const globalEval = await evaluate(
  {
    revenueChangePercent: weekComparison.changePercent.revenue,
    longParkedCount,
    expiringPackagesCount,
  },
  'report',
);

// Bước 2: các biến có thể điền vào câu mẫu của luật
const globalVars = {
  revenueChangePercent: weekComparison.changePercent.revenue,
  revenueDropPercent: Math.abs(weekComparison.changePercent.revenue),
  peakAfternoonHour: peakHours.afternoon.hour,
  longParkedCount,
  expiringPackagesCount,
};

// Bước 3: mỗi luật khớp → 1 gợi ý. KHÔNG còn if/else theo từng loại.
for (const fired of globalEval.firedRules) {
  for (const action of fired.actionOutputs) {
    // params.message VD: "Có {longParkedCount} xe đỗ quá 24 giờ, cần kiểm tra và xử lý."
    const message = renderMessage(action.params?.message, globalVars);
    if (!message) continue;
    suggestions.push({
      type: action.params.type,
      message,                          // → "Có 17 xe đỗ quá 24 giờ, cần kiểm tra và xử lý."
      explanation: fired.explanation,   // → "[Xe đỗ quá lâu] Thỏa mãn: longParkedCount = 17 > 5 → đúng"
    });
  }
}

// Gợi ý theo từng khu vực: chạy engine 1 lần cho mỗi khu, biến {zoneName}
// và {zoneOccupancyPercent} được điền theo khu đang xét.
for (const z of zoneStats) {
  const zoneEval = await evaluate({ zoneOccupancyRate: z.occupancyRate }, 'report');
  for (const fired of zoneEval.firedRules) {
    for (const action of fired.actionOutputs) {
      if (action.params?.type !== 'occupancy_warning') continue;
      const message = renderMessage(action.params.message, {
        zoneName: z.name,
        zoneOccupancyPercent: Math.round(z.occupancyRate * 100),
      });
      if (!message) continue;
      suggestions.push({ type: 'occupancy_warning', message, explanation: fired.explanation });
    }
  }
}
```

**Giải thích:** Trước đây thêm một loại gợi ý mới phải sửa code + deploy. Nay chỉ cần thêm 1 dòng vào bảng `ExpertRules` với `params = { type, message }` — miễn `type` nằm trong danh sách hệ thống biết hiển thị (`revenue_up`, `revenue_down`, `occupancy_warning`, `long_parking`, `renewal_campaign`), validate sẽ chặn nếu gõ sai. Đổi câu chữ của một gợi ý cũng chỉ là sửa `params.message` trên UI.

### Code mẫu — Frontend auto-refresh (polling pattern)

```typescript
// File: useDashboardData.ts
// ═══════════════════════════════════════════════════════════════
// Pattern: Polling interval với silent refresh
// Mỗi 90 giây tự động gọi lại API, KHÔNG hiện loading spinner
// (để admin không bị gián đoạn khi đang đọc dashboard)
// ═══════════════════════════════════════════════════════════════

const REFRESH_INTERVAL_MS = 90_000;  // 90 giây

useEffect(() => {
  fetchData(false);                   // Lần đầu: hiện loading spinner

  timerRef.current = setInterval(
    () => fetchData(true),            // Các lần sau: silent=true → không spinner
    REFRESH_INTERVAL_MS
  );

  return () => {                      // Cleanup khi component unmount
    if (timerRef.current) clearInterval(timerRef.current);
  };
}, [fetchData]);
```

**Giải thích:** `fetchData(true)` (silent mode) chỉ cập nhật dữ liệu mà không set `loading = true`. Nhờ đó dashboard luôn hiện nội dung cũ trong lúc fetch mới — UX mượt hơn so với hiện "đang tải..." mỗi 90 giây.

---

## 6. Analytics DSS — Hệ hỗ trợ ra quyết định

**File:** `backend/src/services/analytics.service.ts` (261 dòng)
**API:** `GET /api/analytics/insights?period=month|quarter|year`

### Mục đích
Phân tích sâu theo kỳ (tháng/quý/năm) — sinh ra **câu hỏi quyết định** kèm các phương án có ước tính tác động và rủi ro.

### Code mẫu — Tính occupancy theo thời gian thực (Time-weighted)

```typescript
// File: analytics.service.ts
// ═══════════════════════════════════════════════════════════════
// Vấn đề: occupancy = "hiện tại có bao nhiêu xe" → SAI khi xem báo cáo tháng trước
// Giải pháp: Tính % THỜI GIAN có xe trong kỳ (time-weighted occupancy)
//
// Công thức:
//   occupancy% = Σ (overlap giữa lượt đỗ và kỳ báo cáo) / (số chỗ × độ dài kỳ)
//
// Ví dụ minh hoạ:
//   Kỳ: 1/1 → 31/1 (31 ngày = 744 giờ)
//   Khu A có 10 chỗ → capacityHours = 7440 giờ
//   Tổng giờ có xe = 5208 giờ → occupancy = 5208/7440 = 70%
// ═══════════════════════════════════════════════════════════════

const periodMs = Math.max(1, end.getTime() - start.getTime());
const zoneOccupiedMs = new Map<number, number>();

for (const r of occupancyRecords) {
  const zoneId = r.parkingSpot?.zoneId;
  if (zoneId == null) continue;

  // Tính phần GIAO NHAU giữa lượt đỗ xe và kỳ báo cáo
  // Lượt đỗ: [entryTime ─────── exitTime]
  // Kỳ:              [start ────── end]
  // Overlap:         [overlapStart ── overlapEnd]
  const overlapStart = Math.max(
    new Date(r.entryTime).getTime(),
    start.getTime()
  );
  const overlapEnd = Math.min(
    r.exitTime ? new Date(r.exitTime).getTime() : end.getTime(),  // Xe chưa ra → tính đến end
    end.getTime()
  );
  const overlapMs = Math.max(0, overlapEnd - overlapStart);

  // Cộng dồn theo khu vực
  zoneOccupiedMs.set(zoneId, (zoneOccupiedMs.get(zoneId) || 0) + overlapMs);
}

// Tính tỷ lệ cho từng khu
const zoneEfficiency = zones.map((z) => {
  const total = z.parkingSpots.length;            // Số chỗ đỗ
  const occupiedMs = zoneOccupiedMs.get(z.id) || 0;
  const capacityMs = total * periodMs;            // Tổng "slot-milliseconds" khả dụng

  return {
    zone: z.name,
    avgOccupancy: capacityMs > 0
      ? Math.round((occupiedMs / capacityMs) * 1000) / 10   // → phần trăm, 1 chữ số thập phân
      : 0,
    revenue: zoneRevenue.get(z.id) || 0,
    revenuePerSpot: total > 0 ? Math.round(revenue / total) : 0,
  };
});
```

**Giải thích:** Đây là thuật toán **interval overlap** — tính phần giao nhau của 2 khoảng thời gian. `Math.max(start1, start2)` cho điểm bắt đầu giao, `Math.min(end1, end2)` cho điểm kết thúc giao. Nếu overlap < 0 thì 2 khoảng không giao nhau. Kỹ thuật này phổ biến trong lập lịch (scheduling) và phân tích time-series.

### Code mẫu — Sinh quyết định với đa phương án (DSS pattern)

```typescript
// ═══════════════════════════════════════════════════════════════
// Pattern: Mỗi "quyết định" có cấu trúc:
//   question    → Câu hỏi cần trả lời
//   analysis    → Dữ liệu nền (con số cụ thể)
//   options[]   → Các phương án, mỗi phương án có:
//     - action          → Mô tả hành động
//     - estimatedImpact → Ước tính tác động (tính từ dữ liệu thật)
//     - risk            → Rủi ro / trade-off
//
// Hệ thống KHÔNG chọn hộ — chỉ cung cấp thông tin để admin quyết định
// ═══════════════════════════════════════════════════════════════

// Ví dụ: Phát hiện khu vực quá tải
const overloadedZones = zoneEfficiency.filter((z) => z.avgOccupancy > 80);
if (overloadedZones.length > 0) {
  const z = overloadedZones.sort((a, b) => b.avgOccupancy - a.avgOccupancy)[0];
  const underusedZone = [...zoneEfficiency].sort((a, b) => a.avgOccupancy - b.avgOccupancy)[0];

  decisions.push({
    id: 'd1',
    // Câu hỏi cũng lấy từ luật: params.message = "Có nên mở thêm chỗ đỗ ở {zone}?"
    question: renderMessage(messageById.get('d1'), { zone: z.zone }),
    analysis: `${z.zone} có occupancy ${z.avgOccupancy}% — gần đầy. `
      + `Doanh thu/chỗ: ${z.revenuePerSpot.toLocaleString('vi-VN')}đ.`,
    options: [
      {
        action: `Mở thêm chỗ đỗ ở ${z.zone}`,
        // ← estimatedImpact TÍNH TỪ DỮ LIỆU THẬT, không hardcode
        estimatedImpact: `Nếu lấp đầy 80% chỗ mới, có thể tăng thêm `
          + `~${Math.round(z.revenuePerSpot * 0.8 * 10).toLocaleString('vi-VN')}đ `
          + `cho mỗi 10 chỗ.`,
        risk: 'Chi phí mở rộng hạ tầng, có thể không lấp đủ ngoài giờ cao điểm.',
      },
      {
        action: underusedZone.zone !== z.zone
          ? `Giữ nguyên, điều phối xe sang ${underusedZone.zone}`
          : 'Giữ nguyên, tối ưu quay vòng chỗ đỗ hiện có',
        estimatedImpact: `Tăng occupancy ${underusedZone.zone} từ `
          + `${underusedZone.avgOccupancy}% lên mức cân bằng hơn.`,
        risk: 'Khách có thể không hài lòng nếu phải đỗ xa hơn.',
      },
    ],
  });
}
```

**Giải thích:** Pattern DSS (Decision Support System): hệ thống **không ra quyết định**, mà **cung cấp dữ liệu + phân tích + phương án** để con người quyết. Mỗi phương án đều có impact (lợi) và risk (hại) — giúp admin cân nhắc trade-off thay vì nhận gợi ý 1 chiều.

---

## 7. Các module hỗ trợ (Utility)

### 7.1. Fee Calculator — Thuật toán tính phí (pure function)

**File:** `backend/src/utils/feeCalculator.ts` (81 dòng)

```typescript
// ═══════════════════════════════════════════════════════════════
// Pure function — không phụ thuộc DB, không side effect
// Input: thời gian đỗ (ms) + bảng giá → Output: phí
//
// Quy tắc:
// - ≤ 24h: fee = min(giờ × giá/giờ, giá/ngày)  ← "daily rate cap"
// - > 24h: fee = ceil(giờ/24) × giá/ngày
// - Có gói: fee = 0
// ═══════════════════════════════════════════════════════════════

export function calculateParkingFee(
  durationMs: number,
  rates: FeeRates,
  options?: { hasPackage?: boolean }
): FeeCalcResult {
  const parts = calcDurationParts(durationMs);

  // Có gói dịch vụ → miễn phí
  if (options?.hasPackage) {
    return { ...parts, fee: 0, billedDays: null, cappedByDailyRate: false };
  }

  const hourlyRate = Number(rates.hourlyRate) || 0;
  const dailyRate = Number(rates.dailyRate) || 0;

  if (parts.durationHours <= 24) {
    const rawHourly = parts.durationHours * hourlyRate;
    const fee = Math.min(rawHourly, dailyRate);    // ← Daily cap: không vượt giá ngày
    return {
      ...parts,
      fee,
      cappedByDailyRate: rawHourly > dailyRate,    // Báo cho frontend biết đã áp cap
    };
  }

  // Trên 24h: tính theo ngày
  const billedDays = Math.ceil(parts.durationHours / 24);
  return { ...parts, fee: billedDays * dailyRate, billedDays, cappedByDailyRate: false };
}
```

**Giải thích:** "Daily rate cap" là kỹ thuật phổ biến trong pricing: đỗ 10 giờ × 5.000đ/giờ = 50.000đ, nhưng giá ngày là 40.000đ → tính 40.000đ. Đảm bảo khách luôn lợi khi đỗ lâu. Flag `cappedByDailyRate` để frontend hiện dòng "Đã áp giá ngày" giúp khách hiểu hoá đơn.

### 7.2. Business Rules — Phân loại xe và chỗ đỗ (NLP-lite)

**File:** `backend/src/utils/businessRules.ts` (141 dòng)

```typescript
// ═══════════════════════════════════════════════════════════════
// Phân loại chỗ đỗ từ tên khu vực (text classification)
//
// Vì sao cần? Dữ liệu thực tế không có trường "loại chỗ đỗ" riêng.
// Tên khu có thể là: "Khu A - Xe máy", "Bãi ô tô con", "Zone C"
// → Cần "đọc hiểu" tên để phân loại.
// ═══════════════════════════════════════════════════════════════

function normalizeText(value?: string | null) {
  return (value || '')
    .normalize('NFD')                             // Tách dấu tiếng Việt
    .replace(/[̀-ͯ]/g, '')             // Xoá dấu: "đỗ" → "do"
    .toLowerCase();                               // Viết thường
}

export function getSpotCategory(spot: SpotRuleInput): VehicleCategory {
  // Gộp mọi thông tin text liên quan
  const zoneText = `${spot.zone?.name || ''} ${spot.zone?.description || ''} `
    + `${spot.spotNumber || ''} ${spot.spotType || ''}`;
  const normalized = normalizeText(zoneText);

  // Luật phân loại: kiểm tra keyword theo thứ tự ưu tiên
  if (normalized.includes('vip'))        return 'any';        // VIP chấp nhận mọi xe
  if (normalized.includes('xe may'))     return 'two-wheel';  // "Khu xe máy"
  if (normalized.includes('o to lon'))   return 'large-car';  // "Ô tô lớn"
  if (normalized.includes('xe tai'))     return 'large-car';  // "Xe tải"
  if (normalized.includes('o to'))       return 'car';        // "Ô tô" (con)
  if (normalized.startsWith('khu a'))    return 'two-wheel';  // Convention: Khu A = xe máy
  if (normalized.startsWith('khu b'))    return 'car';        // Khu B = ô tô
  if (normalized.startsWith('khu c'))    return 'large-car';  // Khu C = xe lớn

  return 'any';                                   // Không nhận dạng được → chấp nhận mọi loại
}

// Kiểm tra tương thích: xe có đỗ được chỗ này không?
export function isSpotCompatibleWithVehicleType(
  spot: SpotRuleInput,
  vehicleTypeName: string
) {
  const spotCategory = getSpotCategory(spot);
  const vehicleCategory = getVehicleCategory(vehicleTypeName);

  // "any" tương thích với mọi loại (VIP spot hoặc loại xe không xác định)
  if (spotCategory === 'any' || vehicleCategory === 'any') return true;

  // Chỉ tương thích khi cùng loại
  return spotCategory === vehicleCategory;
}
```

**Giải thích:** Đây là **keyword-based text classification** — phương pháp NLP đơn giản nhất: bỏ dấu → lowercase → tìm keyword. Ưu điểm: dễ hiểu, dễ bảo trì, không cần training data. Nhược điểm: phụ thuộc vào convention đặt tên, cần cập nhật khi thêm loại khu mới.

---

## 8. Luồng dữ liệu end-to-end

### Luồng 1: Xe vào bãi (có smart lookup)

```
Nhân viên nhập biển số "51F-123.45"
        │
        ▼
[Frontend] normalizePlate() → "51F12345"
        │
        ▼
[API] GET /parking/smart-lookup/51F12345
        │
        ▼
[Backend] smartLookup()
        ├─ findVehicleByNormalizedPlate() → tìm xe trong DB
        ├─ Promise.all → 4 query song song
        ├─ Exponential Decay → điểm ưa thích khu + từng chỗ
        ├─ isSpotCompatibleWithVehicleType() → lọc chỗ phù hợp
        └─ SAW chấm điểm 5 tiêu chí → xếp hạng → suggestedSpotId = 42
        │
        ▼
[Frontend] auto-fill form:
        ├─ vehicleTypeId ← từ DB
        ├─ parkingSpotId ← 42 (gợi ý)
        └─ Hiện card: "Khách quen, 15 lần/tháng, khu A, có gói VIP"
        │
        ▼
Nhân viên chỉ cần bấm "Xác nhận" (không cần chọn tay)
```

### Luồng 2: Xe ra bãi (có gợi ý gói)

```
Nhân viên xác nhận xe ra
        │
        ▼
[Backend] calculateParkingFee()
        ├─ durationMs = exitTime - entryTime
        ├─ Kiểm tra gói active → hasPackage? → fee=0 hoặc tính phí
        └─ Daily rate cap: min(giờ×giá, giá/ngày)
        │
        ▼
Thanh toán thành công
        │
        ▼
[API] GET /customer-packages/recommend/:customerId
        │
        ▼
[Backend] getPackageRecommendation()
        ├─ Đếm frequency 30 ngày → 15 lần
        ├─ 15 >= 12 → recommendation = "quarterly"
        ├─ Tìm dominant vehicle type → Xe máy
        └─ Match gói: "Gói Quý - Xe máy" giá 450.000đ
        │
        ▼
[Frontend] Hiện popup: "Gợi ý gói Quý, tiết kiệm ~30% (450.000đ/3 tháng)"
```

### Luồng 3: Dashboard tự động refresh

```
Admin mở trang Dashboard
        │
        ▼
[Hook] useDashboardData()
        ├─ fetchData(false) → lần đầu, hiện spinner
        └─ setInterval(fetchData(true), 90_000) → silent refresh
        │
        ▼ mỗi 90 giây
[API] GET /reports/insights + GET /reports/alerts
        │
        ▼
[Backend] getInsights()
        ├─ weekComparison (aligned by weekday)
        ├─ peakHours (histogram → constrained argmax)
        ├─ dailyTrend (7 ngày)
        ├─ topVehicleTypes (frequency distribution)
        └─ suggestions (rule-based, có ngưỡng)
        │
[Backend] getAlerts()
        ├─ 7 rule types × multi-tier severity
        ├─ evalTier() cho mỗi giá trị đo được
        └─ Sort: danger → warning → info, mới → cũ
        │
        ▼
[Frontend] Cập nhật dashboard không hiện loading (silent)
```

---

## Tổng kết — Các kỹ thuật đáng học

| # | Kỹ thuật | Dùng ở đâu | Ý nghĩa |
|---|---|---|---|
| 1 | **Rolling Window 30 ngày** | Mọi nơi | Dữ liệu luôn "tươi", không bị pha loãng bởi lịch sử cũ |
| 2 | **Promise.all** | smartLookup, getAlerts, getInsights | Giảm latency bằng query song song |
| 3 | **SAW — Simple Additive Weighting** | Gợi ý chỗ đỗ (`scoreSAW`) | Ra quyết định đa tiêu chí, O(n×m) — Fishburn 1967 |
| 3b | **Exponential Decay Weighting** | Mức ưa thích chỗ đỗ (`calcZonePreference`) | Trọng số suy giảm theo thời gian, O(n) — Holt 1957 |
| 3c | **Mode calculation (Map + max)** | dominantType | Tìm giá trị phổ biến nhất — O(n) |
| 4 | **Histogram + constrained argmax** | peakHours | Tìm peak trong miền giới hạn |
| 5 | **Tiered rule evaluation** | Rule Engine | First-match từ nghiêm trọng nhất |
| 6 | **Contextual anomaly detection** | parkingAnomaly | So sánh với trung bình theo nhóm, không chung |
| 7 | **Interval overlap** | Time-weighted occupancy | Tính phần giao 2 khoảng thời gian |
| 8 | **Weekday-aligned comparison** | weekComparison | Loại bỏ weekday bias khi so sánh tuần |
| 9 | **Daily rate cap** | feeCalculator | Pricing: khách luôn lợi khi đỗ lâu |
| 10 | **Keyword text classification** | businessRules | NLP đơn giản: bỏ dấu → tìm keyword |
| 11 | **DSS pattern** | Analytics decisions | Đưa phương án + impact + risk, không quyết hộ |
| 12 | **Silent polling** | useDashboardData | Auto-refresh không gián đoạn UX |

---

*Tài liệu được tạo ngày 28/08/2026 — phản ánh trạng thái code tại thời điểm viết.*
