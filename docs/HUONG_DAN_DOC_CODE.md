# Hướng dẫn đọc code QLBDX — bản đồ theo luồng nghiệp vụ

> Mục đích: mở bất kỳ chức năng nào cũng biết ngay **đi qua những file nào, theo thứ tự nào**.
> Dùng khi cần trình bày, bảo vệ đồ án, hoặc khi quay lại code sau một thời gian.

---

## 0. Đọc trong 2 phút

**Công nghệ:** React + TypeScript (frontend) · Node.js + Express + TypeScript (backend) ·
Prisma ORM · SQL Server.

**Quy tắc vàng — mọi chức năng đều đi đúng chuỗi 6 bước này:**

```
Màn hình (frontend/src/pages/*.tsx)
   ↓ gọi API qua đối tượng `api` (frontend/src/api/axios.ts — tự đính token)
Định tuyến (backend/src/routes/*.routes.ts)
   ↓ chạy lần lượt các middleware: auth → phân quyền → validate
Controller (backend/src/controllers/*.controller.ts)
   ↓ chỉ ép kiểu tham số rồi gọi service, KHÔNG chứa nghiệp vụ
Service (backend/src/services/*.service.ts)
   ↓ toàn bộ nghiệp vụ nằm ở đây
Prisma (backend/src/config/prisma.ts)
   ↓
SQL Server (cấu trúc bảng: backend/prisma/schema.prisma)
```

Nhớ một chuỗi này là tra được vị trí của **mọi** chức năng trong hệ thống.

**Ba file nên mở đầu tiên:**

| File | Vì sao |
|---|---|
| [frontend/src/App.tsx](../frontend/src/App.tsx) | Bản đồ đường dẫn: URL nào ứng với màn hình nào |
| [backend/src/routes/index.ts](../backend/src/routes/index.ts) | Bản đồ API: đường dẫn nào ứng với nhóm chức năng nào |
| [backend/prisma/schema.prisma](../backend/prisma/schema.prisma) | Cấu trúc dữ liệu: có những bảng gì, liên kết ra sao |

---

## 1. Luồng ĐĂNG NHẬP & PHÂN QUYỀN

### 1.1. Đăng nhập

| # | File | Việc làm |
|---|---|---|
| 1 | [pages/Login.tsx](../frontend/src/pages/Login.tsx) | Form nhập tài khoản, gọi `login()` |
| 2 | [context/AuthContext.tsx](../frontend/src/context/AuthContext.tsx) | Gọi API, lưu token vào localStorage |
| 3 | [routes/auth.routes.ts](../backend/src/routes/auth.routes.ts) | `POST /api/auth/login` |
| 4 | [validators/auth.validator.ts](../backend/src/validators/auth.validator.ts) | Chặn body thiếu username/password |
| 5 | [controllers/auth.controller.ts](../backend/src/controllers/auth.controller.ts) | Ghi nhật ký LOGIN / LOGIN_FAILED |
| 6 | [services/auth.service.ts](../backend/src/services/auth.service.ts) | So khớp mật khẩu bcrypt, ký JWT |

**Câu hỏi thầy hay hỏi — và câu trả lời nằm ở đâu:**

- *"Mật khẩu lưu thế nào?"* → `auth.service.ts`, hàm `register`: băm bcrypt với muối riêng cho từng
  tài khoản. Cơ sở dữ liệu chỉ có cột `passwordHash`, không có mật khẩu gốc.
- *"Vì sao sai tài khoản và sai mật khẩu báo lỗi giống nhau?"* → `auth.service.ts`, hàm `login`:
  cố ý, để người dò không biết username nào có thật.
- *"Token hết hạn thì sao?"* → `api/axios.ts` bộ chặn chiều về: bắt lỗi 401, xoá phiên, về trang đăng nhập.

### 1.2. Phân quyền — 3 lớp

```
Lớp 1 — ẨN MENU        : MainLayout.tsx (hàm canSee)          → gọn giao diện
Lớp 2 — CHẶN ĐIỀU HƯỚNG: App.tsx (PrivateRoute/AdminRoute/    → chặn gõ URL trực tiếp
                          PermissionRoute)
Lớp 3 — CHẶN API THẬT  : middlewares/auth.ts + requirePermission.ts  ← LỚP DUY NHẤT LÀ BẢO MẬT
```

> **Điểm cần nhấn khi trình bày:** hai lớp đầu chỉ để giao diện gọn gàng. Ẩn nút **không phải** là
> bảo mật — ai cũng có thể gọi thẳng API bằng Postman. Lớp thứ ba ở backend mới thực sự chặn, và
> nó theo nguyên tắc **từ chối mặc định**: không có dòng quyền tương ứng thì từ chối.

Đọc [middlewares/requirePermission.ts](../backend/src/middlewares/requirePermission.ts) — file ngắn,
thể hiện rõ nguyên tắc này.

---

## 2. Luồng XE VÀO → XE RA → TÍNH PHÍ (nghiệp vụ cốt lõi)

### 2.1. Xe vào

| # | File | Việc làm |
|---|---|---|
| 1 | [pages/ParkingEntry.tsx](../frontend/src/pages/ParkingEntry.tsx) | Nhập biển số → tra cứu thông minh → chọn chỗ |
| 2 | `GET /api/parking/smart-lookup/:plate` | Tự điền loại xe, gợi ý chỗ đỗ theo thói quen khách |
| 3 | `POST /api/parking/entry` | |
| 4 | [validators/parking.validator.ts](../backend/src/validators/parking.validator.ts) | Kiểm tra định dạng biển số |
| 5 | [services/parking.service.ts](../backend/src/services/parking.service.ts) → `entry()` | 5 bước kiểm tra rồi tạo bản ghi |

Năm bước kiểm tra trong `entry()`:
1. Đồng bộ bảng giá đến hạn.
2. Xe chưa đang đỗ trong bãi (chống ghi nhận trùng).
3. Loại xe tồn tại.
4. Bãi còn chỗ **phù hợp với loại xe** đó.
5. Chỗ nhân viên chọn đang trống và vừa với xe.

### 2.2. Xe ra

| # | File | Việc làm |
|---|---|---|
| 1 | [pages/ParkingExit.tsx](../frontend/src/pages/ParkingExit.tsx) → `openExitModal` | `GET /parking/:id/preview` — **báo giá trước, chưa chốt** |
| 2 | `handleExit` | `POST /parking/exit` — chốt lượt |
| 3 | [parking.service.ts](../backend/src/services/parking.service.ts) → `completeExit()` | Tính phí → cập nhật bản ghi → trả chỗ → sinh phiếu thu |
| 4 | [utils/feeCalculator.ts](../backend/src/utils/feeCalculator.ts) | Công thức tính tiền |
| 5 | `printReceipt` | In biên nhận |

### 2.3. Công thức tính phí — phần hay bị hỏi nhất

File: [backend/src/utils/feeCalculator.ts](../backend/src/utils/feeCalculator.ts) (hàm thuần, có bài test riêng)

```
Số giờ = làm tròn LÊN (gửi 1h05' tính 2 giờ)

Gửi ≤ 24 giờ :  phí = min(số giờ × giá giờ, giá ngày)
Gửi > 24 giờ :  phí = làm tròn lên số ngày × giá ngày
Có gói còn hạn / gửi 0 giây : phí = 0
```

**Ba câu hỏi thường gặp:**

- *"Vì sao có `min` với giá ngày?"* → nếu không, khách gửi 20 giờ phải trả nhiều hơn khách gửi trọn
  24 giờ — vô lý.
- *"Đổi bảng giá thì xe đang gửi tính theo giá nào?"* → **giá lúc gửi**. Khi xe vào, `entry()` ghi
  giá đang áp dụng vào chính bản ghi (`hourlyRateApplied` / `dailyRateApplied`); lúc ra `completeExit()`
  đọc lại từ đó. Đây là chi tiết thiết kế đáng nêu khi trình bày.
- *"Kiểm chứng công thức thế nào?"* → chạy `npm test` trong thư mục `backend`
  ([utils/feeCalculator.test.ts](../backend/src/utils/feeCalculator.test.ts)). Hàm thuần nên test được
  trực tiếp, không cần dựng cơ sở dữ liệu.

### 2.4. Xe ra ngoại lệ

Khách mất vé / vé hỏng / cần giải phóng chỗ / được miễn phí → `POST /parking/exit-exception`.

Vẫn đi qua **cùng một hàm** `completeExit()` để hai luồng không lệch nghiệp vụ; chỉ khác là ghi thêm
dòng ghi chú có gắn mã `[NGOAI_LE:<lý do>]`. Nhờ tiền tố đó mà sau này lọc và thống kê được toàn bộ
lượt ngoại lệ để đối soát.

---

## 3. HỆ CHUYÊN GIA — điểm nhấn của đồ án

Thư mục: [backend/src/expertSystem/](../backend/src/expertSystem/)

### 3.1. Ba thành phần kinh điển

| Thành phần | File | Vai trò |
|---|---|---|
| Cơ sở tri thức (Knowledge Base) | [knowledgeBase.ts](../backend/src/expertSystem/knowledgeBase.ts) | Giữ bộ luật đọc từ bảng `ExpertRules` |
| Máy suy diễn (Inference Engine) | [inferenceEngine.ts](../backend/src/expertSystem/inferenceEngine.ts) | Đối chiếu dữ kiện với luật, sinh lời giải thích |
| Dữ kiện (Facts) | do các service cung cấp | Số liệu đo từ dữ liệu thật |

Các file hỗ trợ: [types.ts](../backend/src/expertSystem/types.ts) (kiểu dữ liệu),
[validation.ts](../backend/src/expertSystem/validation.ts) (kiểm tra luật lúc lưu),
[domainSpecs.ts](../backend/src/expertSystem/domainSpecs.ts) (giá trị hợp lệ + khuôn form nhập luật),
[rules/defaults.ts](../backend/src/expertSystem/rules/defaults.ts) (bộ luật mặc định).

### 3.2. Cấu trúc một luật

```
NẾU  <tất cả điều kiện đều đúng>   THÌ  <thực hiện các hành động>

Ví dụ:  NẾU  số lần gửi xe trong tháng >= 5
        THÌ  gợi ý gói 'monthly', 30 ngày, tiết kiệm ~20%
```

Các điều kiện nối bằng **VÀ**. `priority` nhỏ hơn = ưu tiên cao hơn (dùng khi nhiều luật cùng thoả).

### 3.3. Bốn nhóm luật và nơi tiêu thụ

| Nhóm | Dùng để | Service tiêu thụ |
|---|---|---|
| `package` | Gợi ý khách nên mua gói nào | `customerPackage.service.ts` → `getPackageRecommendation()` |
| `alert` | Xếp mức độ cảnh báo | `report.service.ts` → `getAlerts()` |
| `analytics` | Nhận định hỗ trợ ra quyết định | `analytics.service.ts` → `getInsights()` |
| `report` | Gợi ý trong báo cáo tuần | `report.service.ts` → `getInsights()` |

### 3.4. Ví dụ chạy thật — gợi ý gói dịch vụ

Đọc `customerPackage.service.ts` → `getPackageRecommendation()`:

```
1. ĐO dữ kiện   : đếm số lượt khách gửi xe trong 30 ngày  →  frequency = 12
2. SUY DIỄN     : evaluate({ frequency: 12 }, 'package')
3. LUẬT CHÁY    : bộ luật mặc định có 3 ngưỡng — gói năm (>= 20), gói quý (>= 12),
                  gói tháng (>= 5). Với 12 thì hai luật quý và tháng cùng thoả;
                  luật gói quý có priority nhỏ hơn nên được chọn.
4. TRA GÓI      : tìm gói quý khớp loại xe khách hay gửi
5. TRẢ VỀ       : gói cụ thể + mức tiết kiệm + LỜI GIẢI THÍCH
                  "frequency = 12 >= 12 → đúng"
```

### 3.5. Hai điểm nên nhấn khi bảo vệ

1. **Không viết cứng ngưỡng trong code.** Tất cả ngưỡng nằm trong bảng `ExpertRules`, người quản trị
   sửa trên giao diện *(Cảnh báo → Cấu hình nâng cao)* rồi hệ thống áp dụng ngay, không cần lập trình
   viên biên dịch lại. Nếu thầy hỏi "muốn đổi ngưỡng thì làm sao" → mở màn hình đó ra sửa tại chỗ.

2. **Giải thích được (explainability).** Máy suy diễn trả về câu giải thích cho từng luật, kể cả luật
   **không** thoả. Đây là điểm phân biệt hệ chuyên gia với mô hình học máy hộp đen: hệ thống nói rõ
   *vì sao* nó kết luận như vậy. Xem `RuleResult.explanation` trong
   [types.ts](../backend/src/expertSystem/types.ts).

### 3.6. Cách trình diễn trực tiếp

Màn hình **Cảnh báo → Cấu hình nâng cao** có nút **"Test luật"**: nhập giá trị dữ kiện, bấm chạy,
hệ thống hiện luật nào cháy và vì sao. Rất phù hợp để minh hoạ khi bảo vệ.

---

## 4. Luồng GÓI DỊCH VỤ

Hai khái niệm dễ nhầm — **cần phân biệt rõ khi trình bày**:

| | Danh mục gói | Gói khách đã mua |
|---|---|---|
| Bảng DB | `ParkingPackages` | `CustomerPackages` |
| Service | `package.service.ts` | `customerPackage.service.ts` |
| Màn hình | Packages.tsx | CustomerPackages.tsx |
| Nghĩa | "Gói tháng xe máy — 300.000đ" | "Anh A mua gói đó cho xe 29A-12345, từ 1/9 đến 30/9" |

**Bảy điều kiện trước khi bán gói** — xem `ensurePackageCreateValidity()`, đáng chú ý nhất là điều
kiện thứ 7: chống mua **chồng gói trùng thời gian** cho cùng một xe. Cách kiểm tra hai đoạn thời gian
giao nhau: `A1 <= B2 && A2 >= B1`.

**Liên kết với luồng xe ra:** xe thuộc gói còn hiệu lực thì phí = 0
(`parking.service.ts` → `hasActivePackage()`).

---

## 5. Cơ chế GIÁ HAI LỚP

Áp dụng cho cả loại xe lẫn gói dịch vụ:

```
Bảng chính (VehicleTypes / ParkingPackages)          →  giá HIỆN HÀNH (đang bán)
Bảng lịch sử (…RateHistory / …PriceHistory)          →  mọi lần đổi + ngày hiệu lực + người đổi
```

[services/pricing.service.ts](../backend/src/services/pricing.service.ts) làm nhiệm vụ "tới ngày thì
áp dụng": dùng `ROW_NUMBER()` chọn dòng lịch sử mới nhất đã tới hạn rồi cập nhật cột giá hiện hành.

**Vì sao thiết kế vậy:**
- Hẹn trước được lịch tăng giá cho ngày trong tương lai.
- Truy vết được ai đổi giá, đổi lúc nào.
- **Không cần tiến trình chạy nền theo lịch** — chỉ đồng bộ tại các điểm đọc giá quan trọng
  (danh sách loại xe, danh sách gói, và đặc biệt là lúc xe vào bãi).

Đây là câu trả lời cho câu hỏi *"nếu server tắt qua đêm mà đúng ngày đổi giá thì sao?"* →
`server.ts` gọi `syncDuePrices()` một lần lúc khởi động để bù lại.

---

## 6. Luồng BÁO CÁO & CẢNH BÁO

| Màn hình | API | Service |
|---|---|---|
| Tổng quan | `/api/reports/dashboard`, `/insights` | `report.service.ts` |
| Báo cáo | `/api/reports/revenue`, `/vehicle-stats`, `/hourly-stats`, … | `report.service.ts` |
| Cảnh báo | `/api/reports/alerts` | `report.service.ts` → `getAlerts()` |
| Phân tích | `/api/analytics/insights` | `analytics.service.ts` |

**Phân biệt hai màn hình dễ nhầm:**
- **Báo cáo** — hiển thị **số liệu** để vẽ biểu đồ.
- **Phân tích** — hệ thống **đọc số liệu và đề xuất hành động** kèm lý do (hỗ trợ ra quyết định).

**Cách sinh cảnh báo:** phần mã nguồn chỉ **đo** số liệu; việc "số liệu tới mức nào thì là Nguy hiểm /
Cảnh báo / Thông tin" do **bộ luật** quyết định. Ba nguồn cấu hình:
`alertSettings.service.ts`, `alertRuleTier.service.ts`, và hệ chuyên gia.

---

## 7. Nhật ký hoạt động

Điểm hay của thiết kế: **không rải lệnh ghi log vào từng controller**. Chỉ cần khai báo một
middleware ở route là mọi thao tác của route đó được ghi lại:

```ts
router.post('/', auth, activityLogger('vehicle'), controller.create)
```

Xem [middlewares/activityLogger.ts](../backend/src/middlewares/activityLogger.ts). Hai chi tiết đáng
nêu: ghi ở sự kiện `finish` (sau khi đã phản hồi) nên không làm người dùng phải chờ, và bỏ qua
request GET cùng request thất bại để bảng nhật ký không phình vô ích.

---

## 8. Bảng tra nhanh: "chức năng X code ở đâu?"

| Muốn xem | Mở file |
|---|---|
| Công thức tính tiền gửi xe | `backend/src/utils/feeCalculator.ts` |
| Chuẩn hoá biển số / khớp xe với chỗ đỗ | `backend/src/utils/businessRules.ts` |
| Xe vào, xe ra, tra cứu lịch sử | `backend/src/services/parking.service.ts` |
| Đăng nhập, băm mật khẩu, cấp JWT | `backend/src/services/auth.service.ts` |
| Kiểm tra token mọi request | `backend/src/middlewares/auth.ts` |
| Chặn quyền theo màn hình | `backend/src/middlewares/requirePermission.ts` |
| Máy suy diễn của hệ chuyên gia | `backend/src/expertSystem/inferenceEngine.ts` |
| Gợi ý gói bằng hệ chuyên gia | `backend/src/services/customerPackage.service.ts` |
| Sinh cảnh báo | `backend/src/services/report.service.ts` → `getAlerts()` |
| Cơ chế đổi giá theo lịch | `backend/src/services/pricing.service.ts` |
| Bản đồ màn hình ↔ URL | `frontend/src/App.tsx` |
| Menu và ẩn/hiện theo quyền | `frontend/src/components/Layout/MainLayout.tsx` |
| Tự đính token vào request | `frontend/src/api/axios.ts` |
| Cấu trúc bảng cơ sở dữ liệu | `backend/prisma/schema.prisma` |

---

## 9. Quy ước comment trong mã nguồn

Toàn bộ mã nguồn viết comment **tiếng Việt** theo ba mức:

1. **Đầu file** — khối `/** … */`: file này làm gì, nằm ở đâu trong luồng.
2. **Trên mỗi hàm public** — JSDoc ngắn: hàm làm gì, tham số nghĩa là gì.
3. **Trong thân hàm** — comment `//` chỉ ở chỗ **khó**, và luôn giải thích **VÌ SAO** chứ không
   thuật lại điều dòng lệnh đã nói.

Ví dụ đúng tinh thần đó (trích `parking.service.ts`):

```ts
// Điều kiện status = 'parked' rất quan trọng: nếu chỉ tìm theo id thì bấm "Xe ra" hai lần
// (mạng chậm, người dùng bấm lại) sẽ tính phí và tạo phiếu thu lần thứ hai cho cùng một lượt.
const record = await prisma.parkingRecord.findFirst({
  where: { id: params.recordId, status: 'parked' },
```

Comment kiểu `// tăng i lên 1` là thứ **không** có trong mã nguồn này — dòng lệnh đã tự nói rồi.

---

## 10. Tài liệu liên quan

- [KIEN_TRUC_TONG_QUAN.md](KIEN_TRUC_TONG_QUAN.md) — kiến trúc tổng thể
- [KIEN_TRUC_CHI_TIET.md](KIEN_TRUC_CHI_TIET.md) — kiến trúc chi tiết
- [CAU_TRUC_CODE_TINH_NANG_THONG_MINH.md](CAU_TRUC_CODE_TINH_NANG_THONG_MINH.md) — các tính năng thông minh
- [SMART_FEATURES_DEEP_DIVE.md](SMART_FEATURES_DEEP_DIVE.md) — phân tích sâu hệ chuyên gia
- [SUA_LOI_PARTIAL_UPDATE_EXPERT_RULE.md](SUA_LOI_PARTIAL_UPDATE_EXPERT_RULE.md) — ví dụ một lần sửa lỗi có phân tích đầy đủ
- [demo_accounts.md](demo_accounts.md) — tài khoản demo
