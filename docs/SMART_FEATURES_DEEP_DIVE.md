# QLBDX — 5 tính năng thông minh: giải thích kỹ thuật chi tiết (tài liệu bảo vệ đồ án)

> **Mục đích tài liệu**: giải thích **vì sao** và **bằng cách nào** 5 tính năng "thông minh" trong hệ thống QLBDX được xây dựng mà **không dùng Machine Learning**, để dùng làm căn cứ học và phản biện trước giảng viên.
> **Nguồn gốc quyết định**: xem `docs/archive/SMART_UPGRADE_PLAN.md` — tài liệu lập kế hoạch gốc, viết trước khi code. Tài liệu này mô tả **những gì thực sự đã được cài đặt**, đối chiếu trực tiếp với source code.
> **Ngày lập**: 26/08/2026

---

## Mục lục

0. [Vì sao không dùng Machine Learning](#0-vì-sao-không-dùng-machine-learning)
1. [Tính năng 1 — Dashboard thông minh: so sánh & xu hướng](#tính-năng-1--dashboard-thông-minh-so-sánh--xu-hướng)
2. [Tính năng 2 — Gợi ý gói dịch vụ (rule-based recommendation)](#tính-năng-2--gợi-ý-gói-dịch-vụ-rule-based-recommendation)
3. [Tính năng 3 — Cảnh báo thông minh nâng cao](#tính-năng-3--cảnh-báo-thông-minh-nâng-cao)
4. [Tính năng 4 — Smart auto-fill khi nhập biển số](#tính-năng-4--smart-auto-fill-khi-nhập-biển-số)
5. [Tính năng 5 — Trang Phân tích & Gợi ý quyết định (DSS)](#tính-năng-5--trang-phân-tích--gợi-ý-quyết-định-dss)
6. [Bảng tổng hợp: tiêu chí môn học ↔ code thực tế](#6-bảng-tổng-hợp-tiêu-chí-môn-học--code-thực-tế)
7. [Bộ câu hỏi phản biện dự kiến & cách trả lời](#7-bộ-câu-hỏi-phản-biện-dự-kiến--cách-trả-lời)

---

## 0. Vì sao không dùng Machine Learning

Dự án ban đầu có một `ml-service` (Python Flask + scikit-learn) làm dở, sau đó bị **loại bỏ hoàn toàn** và thay bằng 5 tính năng rule-based. Đây là quyết định có chủ đích, không phải vì "làm ML khó quá":

| Lý do | Giải thích |
|---|---|
| **Dữ liệu không đủ lớn/đa dạng** | Một bãi đỗ xe đơn lẻ tạo ra vài chục nghìn bản ghi lịch sử — không đủ để một mô hình học máy (vd. dự đoán công suất, phát hiện bất thường bằng clustering) vượt trội so với một quy tắc thống kê đơn giản (trung bình trượt, so sánh theo kỳ). |
| **Bài toán có pattern tường minh** | "Xe đỗ lâu gấp 3 lần trung bình là bất thường", "khách đỗ ≥20 lần/tháng thì mua gói năm lợi hơn" — đây là các luật mà một người quản lý bãi xe dày dạn kinh nghiệm cũng sẽ tự đặt ra. Không cần một mô hình "học" lại điều đã biết rõ. |
| **Khả năng giải thích (explainability)** | Rule-based luôn trả lời được "vì sao hệ thống báo cái này" bằng 1 câu tiếng Việt rõ ràng (VD: "gấp 3.2 lần trung bình 4.2h của loại xe này"). Một mô hình ML (đặc biệt là các mô hình phức tạp) khó giải thích ngắn gọn cho nhân viên vận hành không có nền tảng kỹ thuật. |
| **Chi phí vận hành** | Không cần huấn luyện lại mô hình, không cần theo dõi model drift, không cần một service Python riêng chạy song song — giảm hẳn 1 tầng hạ tầng và rủi ro vận hành. |
| **Đúng với giáo trình môn học** | Giáo trình định nghĩa "hệ thống thông minh" rộng hơn ML: **Hệ thống hỗ trợ ra quyết định (DSS)**, **hệ thống khuyến nghị (recommender system)**, **hệ thống cảnh báo (alerting system)**, và **trải nghiệm thích ứng theo ngữ cảnh** đều được xem là biểu hiện của "trí thông minh" trong một hệ thống thông tin, không bắt buộc phải học từ dữ liệu bằng thuật toán ML. |

**Điểm mấu chốt cần nhớ khi bảo vệ**: "thông minh" ở đây không có nghĩa là "dự đoán chính xác dựa trên mô hình toán học phức tạp", mà là **hệ thống tự động phân tích dữ liệu hiện có, phát hiện tình huống cần chú ý, và đưa ra khuyến nghị hành động cụ thể** — thay vì bắt người dùng tự đọc số liệu thô rồi tự suy luận. Đây chính là định nghĩa thực dụng của DSS.

---

## Tính năng 1 — Dashboard thông minh: so sánh & xu hướng

**Loại thông minh**: DSS — giai đoạn "Thông minh" (Intelligence phase: quét dữ liệu để phát hiện tình huống cần ra quyết định).

> **Đường dẫn kiểm tra**: đăng nhập bằng tài khoản `admin` → trang **Tổng quan** (`/`, menu "Tổng quan" ngoài cùng bên trái) → mặc định hiện view "Quản lý" (đổi qua "Vận hành" bằng toggle ở góc phải header nếu cần). Phần so sánh tuần/xu hướng/gợi ý nằm ngay trong nội dung trang, không cần bấm thêm.

### File liên quan

| Vai trò | File |
|---|---|
| Endpoint | `GET /api/reports/insights` — `backend/src/routes/report.routes.ts` |
| Logic tính toán | `ReportService.getInsights()` — `backend/src/services/report.service.ts` (khoảng dòng 733+) |
| Hiển thị | `frontend/src/pages/Dashboard.tsx` và các dashboard con (`OpsDashboard`, `MgmtDashboard`) |

### Cách hoạt động

1. **So sánh tuần này vs tuần trước** — không so sánh "7 ngày gần nhất vs 7 ngày trước đó" một cách máy móc, mà so sánh **cùng vị trí trong tuần** (Thứ Hai tuần này 00:00 → hiện tại, đối chiếu Thứ Hai tuần trước 00:00 → cùng giờ tuần trước). Điều này quan trọng: nếu hôm nay là thứ Tư 14h, so với "7 ngày trước" sẽ lệch pha thứ trong tuần (weekday effect — thứ Bảy/CN luôn ít xe hơn ngày thường), còn so với "cùng giờ tuần trước" thì loại được sai lệch này.

   ```ts
   const pctChange = (curr: number, prev: number) =>
     prev > 0 ? Math.round(((curr - prev) / prev) * 1000) / 10 : 0;
   ```

   Áp dụng cho 3 chỉ số: doanh thu, số lượt xe, thời gian đỗ trung bình.

2. **Giờ cao điểm (30 ngày gần nhất)** — đếm số lượt xe vào theo từng giờ trong ngày (`Map<hour, count>`), tách riêng khung sáng (5h–11h) và khung chiều (12h–21h), chọn giờ có tần suất cao nhất mỗi khung. Đây là một dạng **thống kê tần suất (histogram) rolling window 30 ngày** — không hardcode "giờ cao điểm là 8h và 17h" như nhiều hệ thống demo hay làm, mà tính từ dữ liệu thật, tự thích nghi nếu thói quen khách hàng đổi theo thời gian.

3. **Xu hướng 7 ngày** — với mỗi ngày trong 7 ngày gần nhất, đếm số lượt xe vào và tổng doanh thu trong ngày đó, trả về mảng để frontend vẽ line chart.

4. **Gợi ý (suggestions)** — sinh ra từ các luật đơn giản dựa trên kết quả bước 1–3, ví dụ: doanh thu tuần này tăng/giảm quá một ngưỡng % thì sinh câu gợi ý tương ứng; có khu vực gần đầy thì gợi ý điều phối; có nhiều xe đỗ quá hạn thì gợi ý kiểm tra.

### Vì sao đây là DSS chứ không chỉ là "hiển thị số liệu"

Một dashboard thông thường chỉ **trình bày** số liệu (doanh thu = X, lượt xe = Y). Dashboard này đi thêm 1 bước: **tự động diễn giải** con số đó có ý nghĩa gì (tăng/giảm bao nhiêu % so với đường baseline hợp lý — cùng thời điểm tuần trước, không phải baseline ngẫu nhiên) và **đưa ra hành động gợi ý**. Đây đúng là giai đoạn đầu của mô hình DSS 4 giai đoạn (Intelligence → Design → Choice → Implementation): hệ thống làm hộ giai đoạn "Intelligence" — quét dữ liệu, phát hiện điều kiện đáng chú ý — để người quản lý không phải tự dò từng bảng số.

---

## Tính năng 2 — Gợi ý gói dịch vụ (rule-based recommendation)

**Loại thông minh**: Recommender system (hệ thống khuyến nghị) — khuyến nghị dựa trên hành vi (behavior-based), không phải collaborative filtering hay content-based như các hệ khuyến nghị ML kinh điển.

> **Đường dẫn kiểm tra**: menu **Vận hành → Xe ra** (`/parking/exit`) → chọn 1 xe của khách có tần suất đỗ cao (≥5 lần/30 ngày — VD các khách đã có "Vé tháng/quý" trong dữ liệu mẫu) → bấm "Cho xe ra" và xác nhận thanh toán → gợi ý gói hiện lên ngay sau khi checkout thành công (Alert/Notification góc màn hình).

### File liên quan

| Vai trò | File |
|---|---|
| Logic | `CustomerPackageService.getRecommendation()` (tên hàm thực tế) — `backend/src/services/customerPackage.service.ts` (~dòng 300–408) |
| Endpoint | `GET /api/customer-packages/recommend/:customerId` — `backend/src/routes/customerPackage.routes.ts` |
| Hiển thị | `frontend/src/pages/ParkingExit.tsx` — hiện sau khi checkout thành công |

### Luật khuyến nghị (rule-based, ngưỡng cố định trong code)

```
Đếm frequency = số lần xe của khách đỗ trong 30 ngày gần nhất
Nếu khách đã có gói active               → recommendation = 'none' (không làm phiền)
Nếu frequency ≥ 20 lần/tháng              → gợi ý gói NĂM,  tiết kiệm ước tính ~40%
Nếu frequency ≥ 12 lần/tháng              → gợi ý gói QUÝ,  tiết kiệm ước tính ~30%
Nếu frequency ≥ 5  lần/tháng              → gợi ý gói THÁNG, tiết kiệm ước tính ~20%
Nếu frequency < 5                         → recommendation = 'none', kèm lý do
```

Sau khi xác định mức gói, hệ thống còn làm thêm 1 bước: xác định **loại xe khách đỗ nhiều nhất** trong 30 ngày qua (không phải loại xe hiện tại đang checkout — vì 1 khách có thể có nhiều xe), rồi tìm đúng gói dịch vụ (`ParkingPackage`) khớp `vehicleTypeId` + `durationDays` để gợi ý **cụ thể tên gói và giá tiền thật**, chứ không chỉ nói chung chung "nên mua gói tháng".

### Vì sao gọi đây là "hệ thống khuyến nghị" hợp lệ theo giáo trình

Khuyến nghị dựa trên **hành vi quá khứ của chính người dùng đó** (tần suất ghé trong 30 ngày — rolling window, tự cập nhật theo thời gian, không phải số liệu tĩnh nhập tay), sinh ra **khuyến nghị cá nhân hoá** (đúng gói, đúng giá, đúng lý do bằng tiếng Việt) tại đúng thời điểm quyết định có ý nghĩa nhất (ngay sau khi khách vừa trả tiền gửi xe lẻ — thời điểm khách cảm nhận rõ nhất "phí lẻ tốn kém"). Đây là khuyến nghị rule-based (if/else theo ngưỡng), khác khuyến nghị ML (collaborative/content-based filtering) ở chỗ **luật được viết tường minh bởi con người, dựa trên hiểu biết nghiệp vụ**, thay vì học từ ma trận tương tác người dùng — phù hợp vì hệ thống chỉ có 1 loại "sản phẩm" (gói dịch vụ theo loại xe/thời hạn), không có đủ chiều dữ liệu để ML phát huy lợi thế.

---

## Tính năng 3 — Cảnh báo thông minh nâng cao

**Loại thông minh**: Alerting/monitoring system — giám sát tiêu chí thành công + phát hiện bất thường theo ngưỡng động (dynamic/configurable thresholding).

> **Đường dẫn kiểm tra**: menu **Quản trị → Cảnh báo** (`/alerts`) → tab đầu xem danh sách cảnh báo (badge, mức độ, `context` + `suggestedAction`). Tab **"Cấu hình mức độ"** (chỉ admin) cho phép chỉnh ngưỡng từng loại luật — đổi thử 1 ngưỡng rồi quay lại tab đầu để thấy danh sách cảnh báo đổi theo ngay, chứng minh ngưỡng không hardcode.

### File liên quan

| Vai trò | File |
|---|---|
| Logic sinh cảnh báo | `ReportService` — `backend/src/services/report.service.ts` (~dòng 482–601) |
| Bảng ngưỡng cấu hình được | `AlertRuleTierService` — `backend/src/services/alertRuleTier.service.ts` (adapter mỏng trên `ExpertRule`) |
| Model dữ liệu ngưỡng | `ExpertRule` với `domain = "alert"` — `backend/prisma/schema.prisma` (bảng `AlertRuleTier` cũ đã bị xoá) |
| Lọc luật đang bật | `alertRuleTierService.getAllGrouped()` — chỉ trả mốc `enabled = true`, đây là đầu vào duy nhất của `getAlerts()` |
| Validate luật theo domain | `backend/src/expertSystem/validation.ts` + `domainSpecs.ts` |
| API cấu hình ngưỡng (admin) | `backend/src/routes/alertRuleTier.routes.ts`, `backend/src/controllers/alertRuleTier.controller.ts` |
| Hiển thị | `frontend/src/pages/Alerts.tsx` (tab cảnh báo + tab "Cấu hình mức độ") |

### 4 loại cảnh báo và luật phát hiện

| # | Loại | Điều kiện kích hoạt | Nguồn dữ liệu |
|---|---|---|---|
| 1 | **Xe đỗ bất thường** (`parking_anomaly`) | Thời gian đỗ hiện tại ≥ N lần trung bình 30 ngày **của đúng loại xe đó** (không so trung bình chung mọi loại xe — ô tô đỗ lâu hơn xe máy là bình thường, phải so trong cùng nhóm) | `ParkingRecord.duration`, group theo `vehicleTypeId` |
| 2 | **Biến động doanh thu** (`revenue_change`) | Doanh thu hôm nay (tính đến giờ hiện tại) sụt ≥ N% so với **cùng thời điểm hôm qua** (không so cả ngày hôm qua với nửa ngày hôm nay — sẽ luôn báo sụt giảm sai) | `Payment` aggregate theo khung giờ |
| 3 | **Cơ hội gia hạn** (`renewal_opportunity`) | Gói dịch vụ sắp hết hạn trong 7 ngày **và** khách có tần suất đỗ xe ≥ N lần/tháng (chỉ nhắc gia hạn khách còn dùng thường xuyên, không làm phiền khách gần như không dùng) | `CustomerPackage.endDate`, `ParkingRecord` 30 ngày |
| 4 | **Mất cân bằng khu vực** (`zone_imbalance`) | 1 khu có tỷ lệ lấp đầy cao vượt ngưỡng trong khi khu khác còn trống nhiều | `ParkingZone` + `ParkingSpot.status` |

### Điểm nâng cấp so với thiết kế ban đầu: ngưỡng KHÔNG hardcode

Bản kế hoạch gốc (`docs/archive/SMART_UPGRADE_PLAN.md`) mô tả ngưỡng cố định trong code (VD: "duration > avg × 3"). Khi triển khai thực tế, hệ thống được nâng lên một mức: toàn bộ ngưỡng (`parkingAnomalyMultiplier`, `revenueDropPercent`, `renewalFrequency`, `zoneImbalanceMaxPercent`, `zoneNearFullPercent`, `longParkingHours`, `suspiciousPaymentAmount`) được lưu trong bảng `ExpertRules` (`domain = "alert"`), **admin tự chỉnh qua giao diện** (Cảnh báo → tab "Cấu hình mức độ"), không cần sửa code hay deploy lại. Mỗi mốc còn **bật/tắt được** — mốc tắt bị `getAllGrouped()` loại khỏi Inference Engine nên ngừng phát cảnh báo ngay (kiểm chứng: tắt cả 2 mốc "Xe đỗ quá lâu" thì số cảnh báo loại đó về 0, bật lại thì quay về đủ). Mỗi loại luật còn hỗ trợ **nhiều mốc (tier) với mức độ nghiêm trọng khác nhau** — ví dụ "đỗ quá 24h → warning, quá 48h → danger" — hàm `evaluate()` trong `alertRuleTier.service.ts` chọn mốc khớp nghiêm trọng nhất:

```ts
evaluate(ruleType, value, grouped): string | null {
  const tiers = grouped[ruleType] || [];
  const comparator = RULE_TYPES[ruleType].comparator; // 'gte' hoặc 'lte'
  const sorted = [...tiers].sort((a, b) =>
    comparator === 'gte' ? b.threshold - a.threshold : a.threshold - b.threshold);
  for (const tier of sorted) {
    const matched = comparator === 'gte' ? value >= tier.threshold : value <= tier.threshold;
    if (matched) return tier.severity; // trả về mốc nghiêm trọng nhất mà giá trị đạt tới
  }
  return null;
}
```

Đây là một dạng **rule engine tối giản tự viết** (không dùng thư viện rule-engine ngoài) — tách rời "loại luật + đơn vị + chiều so sánh" (cố định trong code, vì đây là quyết định thiết kế) khỏi "ngưỡng số + mức độ" (lưu trong DB, admin toàn quyền chỉnh).

### Mỗi cảnh báo đều có `context` + `suggestedAction`

Khác với cảnh báo thông thường chỉ có 1 dòng text, mỗi cảnh báo rule-based ở đây trả về thêm:
- `context`: dữ liệu định lượng đứng sau kết luận (VD: `{ avgDurationHours: 4.2, currentDurationHours: 13.4 }`) — để người xem tự kiểm chứng logic, không phải "tin mù" vào hệ thống.
- `suggestedAction`: một hành động cụ thể tiếp theo ("Kiểm tra xe", "Liên hệ khách", "Điều phối khu vực") — biến cảnh báo từ "thông báo" thành "gợi ý hành động", đúng tinh thần DSS.

---

## Tính năng 4 — Smart auto-fill khi nhập biển số

**Loại thông minh**: Trải nghiệm thích ứng theo ngữ cảnh (context-aware UX) — hệ thống "nhận ra" khách quen và tự động điều chỉnh giao diện/giá trị mặc định thay vì bắt nhân viên tự nhớ/tự chọn.

> **Đường dẫn kiểm tra**: menu **Vận hành → Xe vào** (`/parking/entry`) → gõ biển số của một xe **đã có trong hệ thống và từng ra/vào nhiều lần** (VD lấy 1 biển số bất kỳ trong trang Phương tiện `/vehicles`) → sau khi gõ xong, quan sát card thông tin khách quen hiện ra dưới form và ô "Chỗ đỗ" tự động chọn sẵn.

### File liên quan

| Vai trò | File |
|---|---|
| Thuật toán | `backend/src/utils/smartParkingAlgorithms.ts` — SAW + Exponential Decay, hàm thuần tuý không chạm DB |
| Logic nghiệp vụ | `ParkingService.smartLookup()` — `backend/src/services/parking.service.ts` (~dòng 763–947) |
| Đọc trọng số | `ParkingService.getSawConfig()` — `parking.service.ts` (~dòng 949) |
| Cấu hình trọng số | Luật `PARKING_REC_WEIGHTS`, domain `parking_recommendation` — `backend/src/expertSystem/` |
| Endpoint | `GET /api/parking/smart-lookup/:plate` — `backend/src/routes/parking.routes.ts` |
| Hiển thị + auto-select | `frontend/src/pages/ParkingEntry.tsx` |
| Kiểm thử | `backend/src/utils/smartParkingAlgorithms.test.ts` — `npm run test:saw` (23 ca) |

### Cách hoạt động — 6 bước suy luận từ 1 biển số

Khi nhân viên gõ xong biển số ở màn Xe vào, hệ thống gọi `smartLookup()` và tính đồng thời (Promise.all, không tuần tự — tối ưu độ trễ):

1. **Tần suất ghé 30 ngày** (`visitCount30Days`) — đếm `ParkingRecord` của đúng xe đó trong 30 ngày.
2. **Thời gian đỗ trung bình** (`avgDurationHours`) — trung bình `duration` của 30 lượt gần nhất.
3. **Mức ưa thích chỗ đỗ** (`preferredZone` + điểm từng chỗ) — không đếm tần suất đơn thuần nữa mà dùng
   **Exponential Decay Weighting** (Holt 1957): lượt đỗ càng gần đây trọng số càng lớn, `weight(i) = α(1-α)^i`
   với α = 0.3. Nhờ vậy khách đổi thói quen sang khu khác thì hệ thống bám theo sau vài lượt, thay vì phải đợi
   đủ đa số trong 30 lượt.

   Điểm được chấm ở **hai mức rồi cộng lại** — điểm của khu + điểm của đúng chỗ đó:
   ```ts
   zonePreference: (zonePreferences.get(zoneName) || 0) + (spotPreferences.get(spot.id) || 0),
   ```
   Phải có thành phần "đúng chỗ" thì thuật toán mới phân biệt được các chỗ trong cùng một khu: bốn
   tiêu chí còn lại đều là thuộc tính của khu nên chúng bằng nhau ở mọi chỗ trong khu đó. Lý do đầy
   đủ kèm số liệu đo được: `THUAT_TOAN_SAW_VAN_DE_VA_CACH_XU_LY.md` mục 3.1.
4. **Gói dịch vụ đang hiệu lực** (`hasActivePackage`, `packageExpiry`) — tra `CustomerPackage` còn hạn.
5. **Gợi ý chỗ đỗ cụ thể** (`suggestedSpotId`) — đây là bước "thông minh" nhất, và là nơi chạy thuật toán
   ra quyết định đa tiêu chí **SAW (Simple Additive Weighting)** — Fishburn 1967; Hwang & Yoon 1981.

   Sau khi lọc chỗ trống **tương thích loại xe** (`isSpotCompatibleWithVehicleType`), mọi chỗ còn lại được
   chấm điểm trên **5 tiêu chí** có trọng số:

   | Tiêu chí | Chiều | Trọng số |
   |---|---|---|
   | C1 — Mức ưa thích chỗ đỗ (khu + đúng chỗ, theo Decay) | Benefit | 0.35 |
   | C2 — Tỷ lệ còn trống của khu | Benefit | 0.25 |
   | C3 — Độ tương thích loại xe | Benefit | 0.20 |
   | C4 — Phù hợp khung giờ quen | Benefit | 0.10 |
   | C5 — Mức độ đông đúc của khu | Cost | 0.10 |

   > C2 và C5 đo cùng một đại lượng (`occupancy = 1 − availability`) — hạn chế đã ghi nhận, quyết
   > định giữ nguyên. Xem `THUAT_TOAN_SAW_VAN_DE_VA_CACH_XU_LY.md` mục 4.1.

   Công thức: chuẩn hoá mọi tiêu chí về [0,1] (benefit chia cho max, cost lấy min chia cho giá trị), rồi
   `Score = Σ (wⱼ × rᵢⱼ)`. Chỗ điểm cao nhất được gợi ý.

   Mỗi kết quả kèm **câu giải thích** sinh tự động, nêu 2 tiêu chí đóng góp nhiều điểm nhất:
   `"Điểm 1.00 — yếu tố chính: Mức ưa thích chỗ đỗ (35%), Tỷ lệ còn trống (25%)"`. Nếu khu quen đã hết chỗ,
   câu giải thích nói rõ (`"Khu A đã hết chỗ phù hợp — ..."`) — không âm thầm đổi khu khiến nhân viên/khách
   hoang mang. Nếu nhiều chỗ hoà điểm (khách mới hoàn toàn), hệ thống cũng nói thẳng
   (`"27 chỗ trống cùng mức điểm cao nhất, chọn chỗ đầu danh sách"`) thay vì vờ có căn cứ riêng.

6. **Trọng số cấu hình được qua Hệ chuyên gia** — 5 trọng số và hệ số α không viết cứng trong code mà lưu ở
   luật `PARKING_REC_WEIGHTS` (domain `parking_recommendation`). Admin sửa trên màn **Cảnh báo → Cấu hình
   nâng cao**, hệ thống áp dụng ngay không cần khởi động lại. Hệ thống chặn lưu nếu tổng 5 trọng số khác 1.0.
   Luật hỏng hoặc bị tắt thì rơi về bộ mặc định — tính năng này chạy mỗi lần nhân viên gõ biển số, không được
   phép chết vì một dòng cấu hình sai.

### Ở phía frontend — hệ thống thực sự "thay đổi những gì người dùng thấy"

```tsx
// ParkingEntry.tsx
if (insights?.suggestedSpotId) {
  form.setFieldsValue({ parkingSpotId: insights.suggestedSpotId }); // tự điền sẵn, nhân viên vẫn đổi được
}
```

Ô chọn chỗ đỗ được **tự động điền sẵn** giá trị gợi ý (chứ không chỉ hiển thị gợi ý dạng text để nhân viên tự gõ lại) — đúng tiêu chí "trải nghiệm thông minh phải thay đổi những gì người dùng thấy và tương tác", không chỉ là hiển thị thêm thông tin thụ động.

---

## Tính năng 5 — Trang Phân tích & Gợi ý quyết định (DSS)

**Loại thông minh**: DSS đầy đủ nhất trong 5 tính năng — duy nhất tính năng này đi tới cả giai đoạn "Design" (đưa ra nhiều phương án thay thế kèm phân tích tác động/rủi ro), không dừng ở "Intelligence" (phát hiện vấn đề) như Tính năng 1 và 3.

> **Đường dẫn kiểm tra**: menu **Quản trị → Phân tích & Gợi ý** (`/analytics`, chỉ admin thấy). Đổi bộ lọc kỳ (tháng/quý) ở đầu trang để thấy `zoneEfficiency` và phần "Gợi ý quyết định" (Collapse có icon 💡, badge "DSS") thay đổi theo đúng kỳ đang chọn.

### File liên quan

| Vai trò | File |
|---|---|
| Logic | `AnalyticsService.getInsights()` — `backend/src/services/analytics.service.ts` |
| Controller/Route | `backend/src/controllers/analytics.controller.ts`, `backend/src/routes/analytics.routes.ts` (chỉ admin — `adminOnly` middleware) |
| Hiển thị | `frontend/src/pages/Analytics.tsx` — menu "Phân tích & Gợi ý", route `/analytics` |

### Cấu trúc dữ liệu trả về

1. **`summary`** — tổng doanh thu, lượt xe, TB/ngày, tỷ lệ lấp đầy toàn bãi trong kỳ đang chọn.
2. **`dayOfWeekAnalysis`** — trung bình lượt xe/doanh thu theo từng thứ trong tuần (phát hiện pattern cuối tuần vắng khách).
3. **`hourlyAnalysis`** — trung bình lượt xe theo từng khung giờ trong ngày.
4. **`zoneEfficiency`** — hiệu quả từng khu: tổng chỗ, tỷ lệ lấp đầy **time-weighted đúng theo kỳ đang xem** (xem hộp giải thích bên dưới — đây chính là bug đã sửa trong đợt cập nhật gần nhất), doanh thu, doanh thu/chỗ.
5. **`decisions`** — phần quan trọng nhất, xem bên dưới.

> **Vì sao `zoneEfficiency.avgOccupancy` phải tính time-weighted?**
> Phiên bản trước đọc **tình trạng chỗ đỗ tại thời điểm xem trang** (live snapshot) bất kể đang lọc theo kỳ nào — nên đổi bộ lọc từ "tháng này" sang "quý này" vẫn ra cùng 1 con số %, không khớp gì với doanh thu của đúng kỳ đó (từng gây ra hiện tượng vô lý "Khu D lấp đầy 100% nhưng doanh thu 0đ"). Cách tính đúng: với mỗi bản ghi đỗ xe, tính phần thời gian bản ghi đó **chồng lấn** với khoảng `[kỳ.start, kỳ.end]` đang chọn (`overlapMs = max(0, min(exitTime ?? kỳ.end, kỳ.end) − max(entryTime, kỳ.start))`), cộng dồn theo từng khu, rồi chia cho `tổng số chỗ × độ dài kỳ`. Đây là công thức chuẩn để tính "tỷ lệ sử dụng tài nguyên theo thời gian" (utilization rate), tương tự cách tính uptime/downtime trong giám sát hệ thống.

### Luật sinh "decisions" — DSS thực thụ: mỗi vấn đề luôn có ≥2 phương án kèm phân tích

```
Nếu có khu vực occupancy > 80%  (dùng ngưỡng cấu hình được, không hardcode)
  → sinh 1 "decision" dạng câu hỏi: "Có nên mở thêm chỗ đỗ ở Khu X?"
  → phương án A: "Mở rộng thêm chỗ"
      - estimatedImpact: ước tính doanh thu tăng thêm dựa trên revenuePerSpot hiện tại × tỷ lệ lấp đầy giả định 80%
      - risk: "Chi phí mở rộng hạ tầng, có thể không lấp đủ ngoài giờ cao điểm"
  → phương án B: "Giữ nguyên, điều phối sang khu ít tải hơn"
      - estimatedImpact: khu nào đang thấp tải nhất sẽ tăng occupancy lên bao nhiêu nếu điều phối
      - risk: "Khách có thể không hài lòng nếu phải đỗ xa hơn"

Nếu doanh thu cuối tuần < 50% doanh thu ngày thường (từ dayOfWeekAnalysis)
  → sinh decision: "Có nên điều chỉnh giá cuối tuần?"
  → phương án A: giảm giá cuối tuần | phương án B: giữ nguyên giá, theo dõi thêm

Nếu > X% khách hàng tần suất cao chưa có gói dịch vụ
  → sinh decision: "Có nên triển khai chiến dịch bán gói?"
  → phương án A: chạy chiến dịch tư vấn | phương án B: không làm gì
```

Mỗi phương án luôn đi kèm **cả `estimatedImpact` (lợi ích ước tính, tính từ dữ liệu thật — không phải số bịa) lẫn `risk` (đánh đổi/rủi ro)** — đây là điểm khác biệt cốt lõi so với Tính năng 1 và 3 (chỉ dừng ở "phát hiện vấn đề + 1 gợi ý hành động đơn"): tính năng 5 trình bày **nhiều phương án loại trừ lẫn nhau, để người ra quyết định (admin) tự cân nhắc đánh đổi**, đúng bản chất giai đoạn "Design" trong mô hình DSS — hệ thống không quyết định thay người dùng, chỉ chuẩn bị đầy đủ thông tin để người dùng quyết định nhanh và có căn cứ hơn.

### Frontend hiển thị

Mỗi `decision` render thành 1 `Collapse` panel: tiêu đề là câu hỏi ra quyết định, mở ra thấy phần phân tích (`analysis`) và 1 bảng so sánh các phương án (hành động | tác động ước tính | rủi ro) — có icon 💡 và badge "DSS" để phân biệt rõ đây là nội dung hệ thống tự sinh, không phải dữ liệu thô.

---

## 6. Bảng tổng hợp: tiêu chí môn học ↔ code thực tế

| Tiêu chí giáo trình | Đáp ứng bằng tính năng nào | Hàm/file cụ thể chứng minh |
|---|---|---|
| **DSS — so sánh số liệu theo kỳ** | Tính năng 1 | `getInsights()` trong `report.service.ts`, phần `weekComparison` |
| **DSS — phân tích phương án & hậu quả quyết định** | Tính năng 5 | `getInsights()` trong `analytics.service.ts`, mảng `decisions` với `estimatedImpact`/`risk` |
| **Hệ thống khuyến nghị (recommender)** | Tính năng 2 | `getRecommendation()` trong `customerPackage.service.ts` |
| **Hệ thống cảnh báo / giám sát tiêu chí thành công** | Tính năng 3 | `report.service.ts` phần "Cảnh báo thông minh nâng cao" + `alertRuleTier.service.ts` |
| **Hệ chuyên gia (Knowledge Base + Inference Engine + Explanation)** | Cả 5 tính năng | `backend/src/expertSystem/` — luật lưu trong DB, bật/tắt được, validate theo domain, mỗi kết quả kèm chuỗi giải thích |
| **Trải nghiệm thông minh — thay đổi những gì người dùng thấy** | Tính năng 4 | `smartLookup()` trong `parking.service.ts` + auto-`setFieldsValue` trong `ParkingEntry.tsx` |
| **Giảm thiểu sai sót người dùng** | Tính năng 4 (auto-fill giảm chọn nhầm chỗ), Tính năng 3 (phát hiện bất thường sớm) | như trên |
| **Hệ thống cải thiện/thích nghi theo thời gian** | Cả 5 tính năng | Mọi ngưỡng/tính toán đều dùng **rolling window** (30 ngày gần nhất) chứ không phải hằng số tĩnh nhập 1 lần — dữ liệu tích luỹ thêm thì trung bình, tần suất, giờ cao điểm tự cập nhật theo lần gọi API tiếp theo, không cần "huấn luyện lại" |
| **Cấu hình được, không hardcode (đáp ứng nhu cầu khác nhau mỗi bãi xe)** | Tính năng 3 | Bảng `ExpertRules` trong DB + UI cấu hình cho admin (cả ngưỡng, nội dung câu gợi ý, và cờ bật/tắt) |

---

## 7. Bộ câu hỏi phản biện dự kiến & cách trả lời

**Q: Đây có thực sự là "thông minh" không, hay chỉ là if/else thông thường?**
→ Đúng, về bản chất kỹ thuật đây là if/else + thống kê mô tả (trung bình, tần suất, % thay đổi). Nhưng "thông minh" trong ngữ cảnh môn học không đồng nghĩa với "học máy phức tạp" — nó được định nghĩa qua **hành vi quan sát được của hệ thống**: tự phát hiện tình huống bất thường mà không cần người dùng tự so sánh số liệu, tự đưa ra khuyến nghị hành động cụ thể, tự thích nghi khi dữ liệu thay đổi (rolling window), và tự thay đổi giao diện theo ngữ cảnh (auto-fill). Một hệ thống chỉ hiển thị bảng số liệu thô, dù dùng ML phía sau, mà không tự diễn giải/khuyến nghị gì, thì kém "thông minh" hơn theo định nghĩa DSS so với hệ rule-based có diễn giải.

**Q: Tại sao không dùng ML để dự đoán chính xác hơn?**
→ Xem mục 0. Tóm tắt: dữ liệu 1 bãi xe không đủ lớn để ML có lợi thế thống kê rõ rệt so với rule-based; rule-based dễ giải thích và dễ tin cậy hơn với người vận hành không rành kỹ thuật; chi phí hạ tầng thấp hơn hẳn (không cần service ML riêng, không cần retrain).

**Q: Ngưỡng (VD: "gấp 3 lần trung bình") được chọn dựa trên cơ sở gì, có phải chỉ đoán bừa?**
→ Ban đầu là ước lượng nghiệp vụ hợp lý (tương tự cách một quản lý giàu kinh nghiệm sẽ đặt ngưỡng cảnh báo), nhưng điểm quan trọng là **toàn bộ ngưỡng đều lưu trong bảng `ExpertRules` và admin chỉnh được qua UI** (thêm/sửa/xoá/bật/tắt), không hardcode trong code. Vì vậy hệ thống không cứng nhắc theo 1 con số đoán ban đầu — mỗi bãi xe có thể tinh chỉnh ngưỡng theo đặc thù thực tế của mình mà không cần sửa code/deploy lại.

**Q: Hệ thống có "học" được gì không, hay ngưỡng cố định mãi mãi?**
→ Bản thân *ngưỡng* (threshold) là cố định cho tới khi admin đổi tay — đây là điểm khác biệt thật với ML (ML tự điều chỉnh tham số qua quá trình huấn luyện, rule-based thì không). Nhưng *dữ liệu đầu vào cho luật* luôn là rolling window (30 ngày gần nhất) — nên các con số trung bình, tần suất, giờ cao điểm luôn tự cập nhật theo dữ liệu mới nhất mỗi lần gọi API, không "đóng băng" theo dữ liệu tại thời điểm code được viết. Đây là lý do khi trả lời câu này nên phân biệt rõ 2 khái niệm: "ngưỡng so sánh" (tĩnh, admin kiểm soát) và "dữ liệu để so sánh" (động, tự cập nhật).

**Q: 5 tính năng này có phụ thuộc lẫn nhau không, hay độc lập?**
→ Phần lớn độc lập về code (mỗi tính năng có service/endpoint riêng), nhưng **chia sẻ chung 1 nguồn ngưỡng cấu hình** (`ExpertRules`) giữa Tính năng 3 và gián tiếp ảnh hưởng tới các "suggestions" trong Tính năng 1 — đây là thiết kế có chủ đích để tránh tình trạng "2 nơi hiển thị 2 ngưỡng khác nhau cho cùng 1 khái niệm" (từng là một lỗi thực tế trong hệ thống, đã ghi nhận và sửa — xem mục A-02 trong `docs/archive/QLBDX_UIUX_Review_and_Remediation_Plan.md`).

**Q: Có thể chứng minh các tính năng này chạy đúng bằng cách nào (không chỉ đọc code)?**
→ Gợi ý demo trực tiếp: (1) Tính năng 4 — gõ 1 biển số khách quen ở màn Xe vào, quan sát ô chọn chỗ tự điền sẵn; (2) Tính năng 2 — checkout 1 xe của khách có tần suất cao, quan sát Alert gợi ý gói hiện lên với đúng tên gói/giá; (3) Tính năng 3 — vào Cảnh báo → Cấu hình mức độ, đổi 1 ngưỡng, quan sát danh sách cảnh báo đổi theo ngay; (4) Tính năng 5 — vào Phân tích & Gợi ý, đổi bộ lọc kỳ (tháng/quý), quan sát `zoneEfficiency` và `decisions` thay đổi theo đúng kỳ đang chọn (điểm này còn chứng minh được cả bug time-weighted occupancy đã sửa, vì trước đây đổi kỳ không làm % lấp đầy thay đổi).

---

*Tài liệu này mô tả trạng thái triển khai thực tế tại thời điểm 26/08/2026, đối chiếu trực tiếp với source code trong repo. Xem thêm `docs/archive/SMART_UPGRADE_PLAN.md` để biết kế hoạch/lý do thiết kế ban đầu trước khi code, và `docs/archive/QLBDX_UIUX_Review_and_Remediation_Plan.md` mục Q6 để biết chi tiết bug time-weighted occupancy đã sửa liên quan tới Tính năng 5.*
