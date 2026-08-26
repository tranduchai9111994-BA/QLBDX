# QLBDX — Nâng cấp thông minh (KHÔNG dùng Machine Learning)

> **Bối cảnh**: Đã code dở phần ML (ml-service Python Flask + scikit-learn).
> Quyết định: **BỎ toàn bộ ML**, thay bằng tính năng thông minh dựa trên **rule-based + phân tích dữ liệu + DSS**.
> Theo giáo trình C1: "Nếu không yêu cầu cao về thông minh thì độ chính xác ở mức thấp đã có thể thành công" — rule-based hoàn toàn đủ.

---

## PHẦN 1 — DỌN DẸP CODE ML ĐÃ LÀM DỞ

### 1.1 Xoá toàn bộ thư mục ml-service

```bash
# Xoá thư mục ML Service (Python Flask)
rm -rf ml-service/
```

Bao gồm tất cả: `app.py`, `requirements.txt`, `training/`, `services/`, `models/*.pkl`, `data/`, `tests/`.

### 1.2 Xoá code ML phía Backend (Express)

**Tìm và xoá các file sau** (nếu đã tạo):

```
backend/src/routes/ml.routes.ts        → XOÁ FILE
backend/src/controllers/ml.controller.ts → XOÁ FILE
```

**Trong file `backend/src/routes/index.ts`** — tìm và xoá dòng:

```typescript
// XOÁ dòng này:
app.use('/api/ml', mlRoutes);
// XOÁ dòng import tương ứng:
import mlRoutes from './ml.routes';
```

**Nếu đã thêm model Prisma `MLFeedback`** — xoá trong `backend/prisma/schema.prisma`:

```prisma
// XOÁ toàn bộ block này nếu có:
model MLFeedback {
  ...
}
```

Sau khi xoá, chạy:
```bash
cd backend
npx prisma generate
```

### 1.3 Xoá code ML phía Frontend (React)

**Tìm và xoá các file/component sau** (nếu đã tạo):

```
frontend/src/pages/MLEvaluation.tsx     → XOÁ FILE (trang đánh giá mô hình)
```

**Trong các file đã sửa** — revert lại:

| File | Tìm và xoá | Mô tả |
|------|-------------|-------|
| `Dashboard.tsx` | Block `<Card>` có title chứa "Dự đoán" hoặc "AI" hoặc "predict" | Card dự đoán công suất |
| `Dashboard.tsx` | Các `useEffect` / `useState` gọi `/api/ml/predict` | State + fetch ML |
| `ParkingExit.tsx` | Modal/Alert gợi ý gói có gọi `/api/ml/recommend` | Popup gợi ý ML |
| `Alerts.tsx` | Tab "Cảnh báo thông minh" / "Cảnh báo AI" gọi `/api/ml/detect` | Tab anomaly ML |
| `Sidebar.tsx` hoặc menu config | Menu item "Đánh giá AI" / route `/ml-evaluation` | Menu entry |

**Cách tìm nhanh**: Search toàn bộ `frontend/src/` cho keyword:
```
/api/ml
predict
anomaly
MLEvaluation
ml-evaluation
recommend/package
```

Bất kỳ dòng code nào reference tới các keyword trên → xoá hoặc revert.

### 1.4 Xoá seed data ML (nếu đã tạo)

```
database/seed_ml_data.sql → XOÁ FILE nếu có
```

Trong `backend/prisma/seed.ts` — nếu đã thêm logic seed ML data → revert về bản gốc.

### 1.5 Cập nhật start.bat

Nếu đã sửa `start.bat` để khởi động ML Service → xoá phần đó:

```bat
:: XOÁ block này:
echo [3/4] Starting ML Service...
cd ../ml-service && start "QLBDX-ML" cmd /k "python app.py"
```

### 1.6 Kiểm tra sau dọn dẹp

```bash
# Backend build OK?
cd backend && npm run build

# Test vẫn pass?
npm test

# Frontend compile OK?
cd ../frontend && npm start
```

Nếu có lỗi TypeScript import → tìm file đang import module đã xoá, sửa lại.

---

## PHẦN 2 — TÍNH NĂNG THÔNG MINH THAY THẾ (KHÔNG CẦN ML)

Theo giáo trình, "thông minh" không bắt buộc phải là ML. Giáo trình C1 định nghĩa rõ **Hệ thống hỗ trợ ra quyết định (DSS)** và **Hệ thống khuyến nghị & cảnh báo** là các dạng hệ thống thông minh. Tất cả đều có thể làm bằng rule-based + phân tích dữ liệu ngay trong Backend Express hiện tại.

### Tổng quan 5 tính năng thông minh thay thế

| # | Tính năng | Loại thông minh (theo giáo trình) | Độ khó |
|---|-----------|-----------------------------------|--------|
| 1 | Dashboard thông minh — so sánh & xu hướng | DSS: "số liệu so sánh tuần này vs tuần trước" | Vừa |
| 2 | Gợi ý gói dịch vụ dựa trên tần suất (rule-based) | Hệ thống khuyến nghị | Dễ |
| 3 | Cảnh báo thông minh nâng cao (rule + ngưỡng động) | Hệ thống cảnh báo | Vừa |
| 4 | Tự động gợi ý thông tin khi nhập biển số | Trải nghiệm thông minh (C3) | Dễ |
| 5 | Phân tích & gợi ý quyết định cho Admin | DSS: "hậu quả của các quyết định khác nhau" | Vừa |

---

### TASK 1: Dashboard thông minh — So sánh & Xu hướng

**Tiêu chí môn học**: DSS — "số liệu bán hàng so sánh giữa tuần này và tuần tiếp theo", "số liệu doanh thu dự kiến".

**Hiện trạng**: Dashboard có hero card và biểu đồ doanh thu cơ bản nhưng chưa có so sánh hay xu hướng.

**Yêu cầu**:

```
Backend — Tạo endpoint mới hoặc mở rộng dashboard.service.ts:
---
GET /api/dashboard/insights

Response trả về:
{
  // So sánh tuần này vs tuần trước
  "weekComparison": {
    "thisWeek": { "revenue": 5200000, "vehicles": 342, "avgDuration": 3.5 },
    "lastWeek": { "revenue": 4800000, "vehicles": 310, "avgDuration": 3.2 },
    "changePercent": { "revenue": 8.3, "vehicles": 10.3, "avgDuration": 9.4 }
  },

  // Giờ cao điểm (tính từ dữ liệu 30 ngày gần nhất)
  "peakHours": {
    "morning": { "hour": 8, "avgCount": 12.5 },
    "afternoon": { "hour": 17, "avgCount": 15.2 }
  },

  // Xu hướng 7 ngày gần nhất: mỗi ngày bao nhiêu xe, doanh thu
  "dailyTrend": [
    { "date": "2026-08-20", "vehicles": 45, "revenue": 680000 },
    ...
  ],

  // Top loại xe phổ biến nhất
  "topVehicleTypes": [
    { "type": "Xe máy", "count": 210, "percent": 61.4 },
    { "type": "Ô tô 4 chỗ", "count": 98, "percent": 28.7 },
    ...
  ],

  // Gợi ý cho admin (rule-based)
  "suggestions": [
    {
      "type": "revenue_up",
      "message": "Doanh thu tuần này tăng 8.3% so với tuần trước. Giờ cao điểm chiều (17h) đông nhất — cân nhắc bố trí thêm nhân viên."
    },
    {
      "type": "occupancy_warning",
      "message": "Khu A đạt 85% công suất trung bình vào giờ cao điểm. Nên cân nhắc điều phối xe sang Khu B."
    }
  ]
}
---

Logic tính suggestions (rule-based, trong service):
- Nếu changePercent.revenue > 10  → "Doanh thu tăng mạnh..."
- Nếu changePercent.revenue < -10 → "Doanh thu giảm, cần xem xét..."
- Nếu occupancy bất kỳ zone > 80% → "Khu X sắp đầy..."
- Nếu có > 5 xe đỗ quá 24h        → "Có N xe đỗ quá lâu, cần kiểm tra"
- Nếu gói sắp hết hạn > 10 khách  → "N khách sắp hết gói, cơ hội gia hạn"
---
```

```
Frontend — Dashboard.tsx:
---
Thêm 1 row mới giữa hero cards và biểu đồ hiện tại:

1. Card "So sánh tuần":
   - 3 mini stat: Doanh thu ▲8.3%, Lượt xe ▲10.3%, TB thời gian đỗ ▲9.4%
   - Dùng Ant Design Statistic component với prefix icon mũi tên xanh/đỏ
   - Ant Design đã có sẵn trong dự án

2. Card "Giờ cao điểm":
   - Hiện icon đồng hồ + text: "Sáng: 8h (~13 xe) | Chiều: 17h (~15 xe)"

3. Card "Gợi ý thông minh" (có icon 💡 hoặc Ant Design BulbOutlined):
   - Render danh sách suggestions từ API
   - Mỗi suggestion là 1 Alert component (type info/warning/success)
   - Có badge "Hệ thống gợi ý" hoặc "Smart Insight"

4. Biểu đồ xu hướng 7 ngày:
   - Line chart (Recharts đã có) hiện vehicles + revenue theo ngày
   - Dual axis: trái = số xe, phải = doanh thu
---
```

---

### TASK 2: Gợi ý gói dịch vụ (Rule-based)

**Tiêu chí môn học**: Hệ thống khuyến nghị — "gợi ý sản phẩm phù hợp theo thói quen người dùng".

**Yêu cầu**:

```
Backend — Tạo mới hoặc mở rộng customerPackage.service.ts:
---
Hàm: getPackageRecommendation(customerId: number)

Logic:
1. Đếm số lần khách đỗ xe trong 30 ngày gần nhất (query ParkingRecord)
2. Tính tổng phí đã trả (query Payment liên quan)
3. Kiểm tra khách có gói active không
4. Rule:
   - Nếu đã có gói active → return { recommendation: 'none', reason: 'Đã có gói' }
   - Nếu frequency >= 20 lần/tháng:
     → Tính giá nếu mua gói năm vs trả lẻ 12 tháng
     → return { recommendation: 'yearly', savings: "~40%", reason: "Đỗ xe ≥20 lần/tháng" }
   - Nếu frequency >= 12:
     → return { recommendation: 'quarterly', savings: "~30%", ... }
   - Nếu frequency >= 5:
     → return { recommendation: 'monthly', savings: "~20%", ... }
   - Else → return { recommendation: 'none', reason: 'Tần suất thấp' }

Endpoint: GET /api/customer-packages/recommend/:customerId
Response: { recommendation, savings, frequency, totalSpent, reason }
---
```

```
Frontend — ParkingExit.tsx:
---
Sau khi checkout xe ra thành công:
1. Gọi GET /api/customer-packages/recommend/:customerId
2. Nếu recommendation !== 'none':
   → Hiện Ant Design Alert hoặc Notification ở góc:
     "💡 Khách [Tên] đỗ xe [N] lần/tháng.
      Đăng ký gói [tháng/quý] tiết kiệm ~[X]%.
      [Xem gói →]"
   → Nút "Xem gói" navigate sang trang Gói dịch vụ
3. Nếu recommendation === 'none' → không hiện gì
---
```

---

### TASK 3: Cảnh báo thông minh nâng cao

**Tiêu chí môn học**: Hệ thống cảnh báo — "dự đoán và thông báo về mối nguy hiểm", "giám sát tiêu chí thành công".

**Hiện trạng**: Module Alert đã có nhưng chỉ kiểm tra đơn giản. Nâng cấp thêm rule phức tạp hơn.

**Yêu cầu**:

```
Backend — Mở rộng alert.service.ts:
---
Thêm các loại cảnh báo mới:

1. "Xe đỗ bất thường" (parking_anomaly):
   - Query ParkingRecord đang đỗ (exitTime = null)
   - Tính thời gian đỗ tính đến hiện tại
   - So sánh với trung bình thời gian đỗ của loại xe đó trong 30 ngày
   - Nếu duration > avg * 3 → cảnh báo "Xe [biển số] đỗ [X]h,
     gấp 3 lần trung bình [Y]h của [loại xe]. Cần kiểm tra."
   - Level: warning

2. "Biến động doanh thu" (revenue_change):
   - So sánh doanh thu hôm nay (tính đến giờ hiện tại) vs cùng giờ hôm qua
   - Nếu giảm > 30% → cảnh báo "Doanh thu hôm nay thấp hơn 35%
     so với cùng thời điểm hôm qua"
   - Level: warning

3. "Cơ hội gia hạn" (renewal_opportunity):
   - Tìm gói hết hạn trong 7 ngày tới
   - Kèm tần suất đỗ xe của khách → "Khách [Tên] gói sắp hết (còn 3 ngày),
     tần suất đỗ 18 lần/tháng — nên liên hệ gia hạn"
   - Level: info

4. "Mất cân bằng khu vực" (zone_imbalance):
   - So sánh occupancy rate giữa các zone
   - Nếu zone A > 90% mà zone B < 30% → "Khu A quá tải (92%),
     Khu B còn trống (28%). Cân nhắc điều phối."
   - Level: warning

Response mỗi cảnh báo có thêm field:
  - "smartLevel": "rule_based"
  - "context": { avgDuration, frequency, occupancyRate, ... }  ← dữ liệu kèm theo
  - "suggestedAction": "Liên hệ khách" | "Kiểm tra xe" | "Điều phối khu vực"
---
```

```
Frontend — Alerts.tsx:
---
Với mỗi cảnh báo có smartLevel === 'rule_based':
- Hiển thị thêm badge <Tag color="purple">Smart</Tag> hoặc icon 💡
- Hiện thêm dòng "Gợi ý: [suggestedAction]" dưới nội dung cảnh báo
- Phần context render nhỏ bên dưới dạng text mờ:
  "TB thời gian đỗ loại xe này: 4.2h | Xe này đã đỗ: 38h"

Không cần tạo tab mới — chỉ cần thêm badge và context vào item cảnh báo hiện tại.
---
```

---

### TASK 4: Tự động gợi ý khi nhập biển số (Smart Auto-fill)

**Tiêu chí môn học**: Trải nghiệm thông minh — "thể hiện trí thông minh cho người dùng", "thay đổi những gì người dùng nhìn thấy".

**Hiện trạng**: Xe vào đã có lookup biển số → hiện thông tin khách. Nhưng chưa có "gợi ý thông minh".

**Yêu cầu**:

```
Backend — Mở rộng parking.service.ts hoặc tạo endpoint mới:
---
GET /api/parking/smart-lookup/:plateNumber

Response:
{
  // Thông tin xe + khách (đã có)
  "vehicle": { ... },
  "customer": { ... },

  // THÊM MỚI — thông tin thông minh:
  "insights": {
    "visitCount30Days": 12,
    "lastVisit": "2026-08-25T08:30:00",
    "avgDuration": "3.5h",
    "preferredZone": "Khu A",           // zone xe đỗ nhiều nhất
    "hasActivePackage": true,
    "packageName": "Gói tháng xe máy",
    "packageExpiry": "2026-09-15",
    "isFrequent": true,                 // >= 10 lần/tháng
    "suggestedSpot": "A-05"             // chỗ gần nhất trong zone ưa thích còn trống
  }
}
---

Logic suggestedSpot:
1. Tìm zone xe đỗ nhiều nhất (preferredZone)
2. Trong zone đó, tìm spot available gần nhất (theo mã số nhỏ nhất)
3. Nếu zone đó đầy → tìm zone khác có trống → ghi "Khu A đầy, gợi ý Khu B"
---
```

```
Frontend — ParkingEntry.tsx:
---
Khi nhập biển số và API trả về insights:
1. Hiện Card nhỏ dưới form nhập:
   "🔍 Khách quen — [Tên], đỗ [N] lần/tháng
    Gói: [Tên gói] (hết hạn [ngày])
    Thường đỗ: [Khu A] | Gợi ý chỗ: [A-05]"

2. Auto-select chỗ đỗ được gợi ý (suggestedSpot) trong dropdown
   → Nhân viên vẫn có thể đổi, nhưng mặc định chọn sẵn

3. Nếu isFrequent === true mà chưa có gói:
   Hiện thêm dòng nhỏ: "Khách đỗ thường xuyên, chưa có gói — gợi ý tư vấn gói"
---
```

---

### TASK 5: Trang Phân tích & Gợi ý quyết định (Admin DSS)

**Tiêu chí môn học**: DSS — "phát triển và phân tích các hành động thay thế", "hậu quả của các quyết định khác nhau".

**Yêu cầu**:

```
Backend — Tạo mới:
---
File: backend/src/services/analytics.service.ts
File: backend/src/controllers/analytics.controller.ts
File: backend/src/routes/analytics.routes.ts
File: backend/src/validators/analytics.validator.ts (nếu cần)

Endpoint: GET /api/analytics/insights?period=month (admin only)

Response:
{
  "period": "2026-08",

  "summary": {
    "totalRevenue": 15200000,
    "totalVehicles": 1240,
    "avgRevenuePerDay": 490000,
    "avgVehiclesPerDay": 40,
    "occupancyRate": 62.5
  },

  // Phân tích theo ngày trong tuần
  "dayOfWeekAnalysis": [
    { "day": "Thứ 2", "avgVehicles": 52, "avgRevenue": 780000 },
    { "day": "Thứ 3", "avgVehicles": 48, "avgRevenue": 720000 },
    ...
    { "day": "CN", "avgVehicles": 22, "avgRevenue": 330000 }
  ],

  // Phân tích theo khung giờ
  "hourlyAnalysis": [
    { "hour": 6, "avgVehicles": 3.2 },
    { "hour": 7, "avgVehicles": 8.5 },
    { "hour": 8, "avgVehicles": 14.2 },  // peak
    ...
  ],

  // Phân tích hiệu quả từng zone
  "zoneEfficiency": [
    {
      "zone": "Khu A",
      "totalSpots": 20,
      "avgOccupancy": 85.2,
      "revenue": 8500000,
      "revenuePerSpot": 425000
    },
    ...
  ],

  // GỢI Ý QUYẾT ĐỊNH (rule-based DSS)
  "decisions": [
    {
      "id": "d1",
      "question": "Có nên mở thêm chỗ đỗ ở Khu A?",
      "analysis": "Khu A có occupancy 85% — gần đầy vào giờ cao điểm. Doanh thu/chỗ cao nhất (425K/tháng).",
      "options": [
        {
          "action": "Mở thêm 10 chỗ",
          "estimatedImpact": "Tăng doanh thu ~4.2M/tháng nếu lấp 80%",
          "risk": "Chi phí mở rộng, có thể không lấp đủ ngoài giờ cao điểm"
        },
        {
          "action": "Giữ nguyên, điều phối sang Khu B",
          "estimatedImpact": "Tăng occupancy Khu B từ 30% lên ~50%",
          "risk": "Khách có thể không hài lòng nếu phải đỗ xa hơn"
        }
      ]
    },
    {
      "id": "d2",
      "question": "Có nên điều chỉnh giá vào cuối tuần?",
      "analysis": "Cuối tuần chỉ 22 xe/ngày (vs 50 xe ngày thường). Occupancy giảm 56%.",
      "options": [
        { "action": "Giảm giá 20% cuối tuần", "estimatedImpact": "...", "risk": "..." },
        { "action": "Giữ nguyên giá", "estimatedImpact": "...", "risk": "..." }
      ]
    }
  ]
}
---

Logic tạo decisions (rule-based):
- Nếu zone nào occupancy > 80% → gợi ý mở rộng hoặc điều phối
- Nếu weekend revenue < 50% weekday → gợi ý điều chỉnh giá
- Nếu có > 20% khách frequent chưa có gói → gợi ý chiến dịch bán gói
- Mỗi decision có ít nhất 2 options với impact + risk
---

Đăng ký route: app.use('/api/analytics', analyticsRoutes) — authMiddleware + adminOnly
```

```
Frontend — Tạo mới:
---
File: frontend/src/pages/Analytics.tsx

Trang chỉ Admin thấy (thêm vào sidebar menu, dưới Báo cáo).
Icon: LineChartOutlined hoặc FundOutlined (Ant Design)
Tên menu: "Phân tích & Gợi ý"

Layout:
1. Row 1 — Summary cards: Doanh thu, Lượt xe, TB/ngày, Tỉ lệ lấp đầy
   (dùng Ant Design Statistic, tương tự Dashboard)

2. Row 2 — 2 biểu đồ:
   - Trái: Bar chart "Lượt xe theo ngày trong tuần" (Recharts)
   - Phải: Line chart "Lượt xe theo giờ trong ngày" (Recharts)

3. Row 3 — Bảng "Hiệu quả theo khu vực":
   - Table Ant Design: Zone | Tổng chỗ | Occupancy | Doanh thu | DT/chỗ
   - Cột occupancy có Progress bar màu (xanh < 60, vàng < 80, đỏ >= 80)

4. Row 4 — Card "Gợi ý quyết định" (phần quan trọng nhất):
   - Mỗi decision là 1 Card hoặc Collapse panel
   - Title: câu hỏi quyết định
   - Body: phân tích + bảng options (action | tác động dự kiến | rủi ro)
   - Có icon 💡 và badge "DSS" hoặc "Hệ thống gợi ý"

5. Filter: chọn tháng/quý (DatePicker month picker)
---

Thêm vào Sidebar:
- Menu item "Phân tích & Gợi ý"
- Route: /analytics
- Quyền: admin only (ẩn với staff)
---
```

---

## PHẦN 3 — THỨ TỰ THỰC HIỆN

| Bước | Việc | Thời gian |
|------|------|-----------|
| **0** | **Dọn dẹp code ML (Phần 1)** | 30 phút |
| **1** | Task 4 — Smart auto-fill biển số | 2–3h |
| **2** | Task 2 — Gợi ý gói rule-based | 2h |
| **3** | Task 3 — Cảnh báo thông minh nâng cao | 2–3h |
| **4** | Task 1 — Dashboard insights + so sánh tuần | 3–4h |
| **5** | Task 5 — Trang Phân tích DSS | 3–4h |

**Tổng: ~13–16 giờ** (nhẹ hơn plan ML cũ ~22h).

**Nếu gấp, chỉ cần Bước 0 + 1 + 2 + 4** (~8h) là đã cover:
- ✅ Trải nghiệm thông minh (smart auto-fill)
- ✅ Hệ thống khuyến nghị (gợi ý gói)
- ✅ DSS (dashboard so sánh + gợi ý)
- ✅ Giám sát tiêu chí thành công (cảnh báo hiện có)

---

## PHẦN 4 — MAPPING VỚI TIÊU CHÍ MÔN HỌC (KHÔNG CẦN ML)

| Tiêu chí giáo trình | Đáp ứng bằng | Task |
|---|---|---|
| **C1: Mục tiêu có ý nghĩa** | Tối ưu vận hành bãi xe, tăng doanh thu, giảm lãng phí | Tất cả |
| **C1: DSS — So sánh số liệu** | Dashboard so sánh tuần, xu hướng 7 ngày | Task 1 |
| **C1: DSS — Hậu quả quyết định** | Trang Phân tích: "nếu mở rộng → impact X, risk Y" | Task 5 |
| **C1: Hệ thống khuyến nghị** | Gợi ý gói dựa trên tần suất đỗ xe | Task 2 |
| **C1: Hệ thống cảnh báo** | Cảnh báo xe bất thường, biến động doanh thu, mất cân bằng zone | Task 3 |
| **C3: Trải nghiệm thông minh** | Smart auto-fill: gợi ý chỗ đỗ, hiện insight khách quen | Task 4 |
| **C3: Thể hiện trí thông minh cho người dùng** | Badge "Smart" trên cảnh báo, card gợi ý trên Dashboard | Task 1, 3 |
| **C3: Giảm thiểu sai sót** | Auto-fill giảm nhập sai, cảnh báo phát hiện bất thường | Task 3, 4 |
| **C3: Giám sát tiêu chí thành công** | Dashboard insight + cảnh báo khi metric lệch | Task 1, 3 |
| **C3: Tích hợp vào môi trường sử dụng** | Tất cả tính năng tích hợp trực tiếp vào UI hiện tại | Tất cả |

---

## PHẦN 5 — CÂU HỎI PHẢN BIỆN & CÂU TRẢ LỜI

**Q: Tại sao không dùng Machine Learning?**
→ Theo giáo trình C3, slide 22: "Nếu không yêu cầu cao về thông minh thì độ chính xác ở mức thấp đã có thể thành công". Bài toán quản lý bãi xe có pattern rõ ràng, rule-based đủ chính xác và dễ giải thích hơn ML. Ngoài ra, dữ liệu bãi xe đơn lẻ không đủ lớn để ML có lợi thế so với rule.

**Q: Hệ thống có "cải thiện theo thời gian" không?**
→ Có. Các ngưỡng cảnh báo và gợi ý được tính dựa trên dữ liệu 30 ngày gần nhất (rolling window). Khi dữ liệu tích luỹ thêm, các con số trung bình, giờ cao điểm, tần suất khách đều tự cập nhật. Admin có thể điều chỉnh ngưỡng qua cấu hình.

**Q: Đây có phải DSS không?**
→ Đúng. Theo giáo trình C1 slide 3–8, DSS gồm 4 giai đoạn: Thông minh (tìm điều kiện) → Thiết kế (phân tích phương án) → Lựa chọn → Thực hiện. Trang Phân tích & Gợi ý cover đúng 3 giai đoạn đầu: phát hiện vấn đề (zone quá tải), đưa ra 2 phương án (mở rộng vs điều phối), admin lựa chọn.

**Q: "Trải nghiệm thông minh" ở đâu?**
→ Theo giáo trình C3 slide 14: "Trải nghiệm thông minh phải thay đổi những gì người dùng nhìn thấy và tương tác". Cụ thể: khi nhập biển số, hệ thống tự hiện khách quen + gợi ý chỗ đỗ ưa thích + auto-select spot. Khi checkout, hiện gợi ý gói tiết kiệm. Dashboard hiện xu hướng và gợi ý hành động. Người dùng thấy rõ hệ thống "hiểu" ngữ cảnh.

---

*File này dùng để đưa cho Claude Code. Bắt đầu từ Phần 1 (dọn dẹp ML), sau đó làm Task theo thứ tự Phần 3.*
