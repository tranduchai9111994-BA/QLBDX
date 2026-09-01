# Database Setup — QLBDX

## Yêu cầu

- SQL Server 2016+ (hoặc SQL Server Express)
- SQL Server Management Studio (SSMS)

---
## Cách nhanh nhất — dùng script tự động

Mở **PowerShell** tại thư mục gốc dự án:

```powershell
# Dựng lại DB từ đầu: migrate + seed đầy đủ (khuyến nghị)
.\scripts\setup-database.ps1

# Hoặc restore nhanh từ file .bak có sẵn (~39.000 bản ghi, không cần seed)
.\scripts\setup-database.ps1 -FromBackup

# Bỏ qua seed lịch sử nhiều năm (nhanh hơn ~2-3 phút)
.\scripts\setup-database.ps1 -SkipHistory
```

SQL Server khác cấu hình mặc định? Truyền tham số:
```powershell
.\scripts\setup-database.ps1 -SqlServer "localhost\SQLEXPRESS" -SqlUser sa -SqlPass matkhau
```

Script tự kiểm tra môi trường (`sqlcmd`, `node`, kết nối SQL Server), tạo `.env` nếu thiếu, áp dụng
migrations, chạy toàn bộ seed theo đúng thứ tự, rồi in ra số bản ghi để bạn xác nhận.

---

## ⚠️ Không dùng `database/legacy/`

`legacy/setup.sql`, `legacy/schema.sql`, `legacy/demo_business_patch.sql` là các bản dump **CŨ**
(07/2026), giữ lại chỉ để tham khảo lịch sử. Chúng **thiếu toàn bộ bảng/cột thêm về sau**:

| Thiếu gì | Thuộc tính năng |
|---|---|
| `AlertSettings`, `ExpertRules` | Cấu hình ngưỡng cảnh báo + Knowledge Base của hệ chuyên gia (bảng `AlertRuleTiers` cũ đã bị xoá ở migration `20260829000000_drop_alert_rule_tier`, dữ liệu gộp vào `ExpertRules` với `domain = "alert"`) |
| `PermissionGroups`, `GroupPermissions`, `Users.PermissionGroupId` | Nhóm quyền (phân quyền Thêm/Sửa/Xóa) |
| `ParkingPackages.ValidFrom` / `ValidTo` | Khoảng thời gian bán gói dịch vụ |
| `ParkingRecords.HourlyRateApplied` / `DailyRateApplied` | Chốt giá tại thời điểm xe vào |
| `VehicleTypeRateHistory`, `PackagePriceHistory` | Lịch sử giá / đặt lịch đổi giá |

Chạy các file đó sẽ ra **schema sai** và app không hoạt động đúng.
**Nguồn sự thật duy nhất của schema là Prisma migrations** trong `backend/prisma/migrations/`.

---

## Cách thủ công (Mac/Linux, hoặc muốn hiểu từng bước)

### Bước 1 — Tạo database rỗng

```bash
sqlcmd -S localhost -U sa -P 123 -Q "IF DB_ID('ParkingManagement') IS NULL CREATE DATABASE [ParkingManagement]"
```

Hoặc trong SSMS: chuột phải **Databases → New Database...** → tên `ParkingManagement`.

| Trường kết nối | Giá trị mặc định |
|--------|---------|
| Server | `localhost` hoặc `localhost\SQLEXPRESS` |
| Authentication | SQL Server Authentication |
| Login | `sa` |
| Password | `123` |

> Dùng Windows Authentication: bỏ user/password, sửa `DATABASE_URL` trong `backend/.env` tương ứng.

### Bước 2 — Áp dụng schema bằng Prisma migrations

```bash
cd backend
cp .env.example .env          # Windows: copy .env.example .env
npm install
npx prisma migrate deploy     # tạo toàn bộ bảng, đúng phiên bản mới nhất
npx prisma generate
```

### Bước 3 — Seed dữ liệu demo (thứ tự này quan trọng)

```bash
npm run prisma:seed                      # tài khoản + danh mục + dữ liệu cơ bản
npm run prisma:seed-permission-groups    # BẮT BUỘC — không có thì staff trắng quyền
npm run prisma:seed-vehicle-expansion    # xe/khách mẫu cho 5 loại phương tiện mở rộng
npm run prisma:seed-exceptions           # dữ liệu checkout ngoại lệ (cho trang Báo cáo)
npm run prisma:seed-fresh-packages       # gói active/sắp hết hạn/vừa hết hạn quanh hôm nay
npm run prisma:seed-history              # (~2-3 phút) dữ liệu nhiều năm cho Dashboard/Báo cáo
```

Mọi seed script đều **idempotent** — chạy lại nhiều lần an toàn, không tạo trùng.

### Bước 4 — Restore từ backup (thay cho Bước 2+3)

```bash
sqlcmd -S localhost -U sa -P 123 -Q "RESTORE DATABASE [ParkingManagement] FROM DISK = N'D:\duong\dan\den\database\ParkingManagement.bak' WITH REPLACE"
```

Trong SSMS: chuột phải **Databases → Restore Database... → Device → chọn `ParkingManagement.bak`** → OK.
Backup đã chứa sẵn ~39.000 bản ghi + nhóm quyền mặc định → xong là dùng được ngay, chỉ cần
`npm install` và `npx prisma generate` ở `backend/`.

---

## Dữ liệu mẫu

| Bảng | Số lượng |
|------|---------|
| Loại xe | 9 (Xe máy, Ô tô con, Ô tô lớn, Xe đạp + 5 loại mở rộng: Xe đạp điện, Xe máy điện, Ô tô điện, Xe bán tải, Xe khách) |
| Khu đỗ / Chỗ đỗ | ~4 khu, ~110 chỗ |
| Khách hàng | ~30 người |
| Phương tiện | ~40 xe đa dạng loại |
| Gói dịch vụ | 16 gói (tháng/quý/năm theo từng loại xe) |
| Đăng ký gói | ~40+ bản ghi (active, sắp hết hạn, expired, pending) — làm mới quanh ngày hiện tại qua `prisma:seed-fresh-packages` |
| Lịch sử đỗ xe | ~1.500+ lượt sau `prisma:seed`, **~40.000+** sau `prisma:seed-history` |
| Checkout ngoại lệ | 16 bản ghi sau `prisma:seed-exceptions` |
| Thanh toán | tương ứng số lượt đỗ xe có phí |
| Người dùng | 5 (2 admin, 3 staff — 1 tài khoản bị khoá để demo deactivate) |
| Nhóm quyền | 1 mặc định ("Nhân viên tiêu chuẩn") sau `prisma:seed-permission-groups` |

### Sau khi chạy `npm run prisma:seed`
- ~14 xe đang trong bãi (occupied spots)
- ~5 gói sắp hết hạn trong 7 ngày
- ~19 cảnh báo bất thường (xe lâu, khu đầy, gói lệch)

### Sau khi chạy thêm `npm run prisma:seed-history`
Dữ liệu trải dài từ 01/2024 đến hiện tại, có **xu hướng tăng trưởng theo năm** và **mùa cao điểm T9-T11**
— cần thiết để Dashboard (so sánh tuần, xu hướng 7 ngày), Báo cáo (nhóm theo năm) và Phân tích & Gợi ý
(kỳ quý/năm) hiển thị số liệu thực tế thay vì gần như trống.

### Muốn có dữ liệu mẫu cho Báo cáo → Thống kê Checkout ngoại lệ

Mặc định seed cơ bản/lịch sử ít sinh checkout ngoại lệ (mất vé, vé hỏng, giải phóng chỗ bắt buộc,
miễn giảm phí...). Chạy thêm lệnh sau để có **16 bản ghi mẫu** minh hoạ đầy đủ các lý do:

```bash
npm run prisma:seed-exceptions
```

Idempotent — đánh dấu bằng note riêng, chạy lại không tạo trùng.

### Nếu app đã chạy demo lâu ngày — xe "đang đỗ" hiện đỗ hàng trăm giờ

Dữ liệu demo "xe đang đỗ" được ghi với giờ vào tương đối lúc seed chạy — nếu instance demo đã
chạy sẵn nhiều tuần mà không có ai "cho xe ra" thật, các xe này sẽ trông như đỗ cả tháng trời.
Chạy lệnh sau để tự động "cho xe ra" phần lớn và chỉ giữ lại vài xe với giờ vào hợp lý:

```bash
npm run prisma:fix-stale-parked
```

### Nếu vào trang "Gói dịch vụ của khách hàng" chỉ toàn thấy "Hết hạn"

Cùng nguyên nhân như xe "đang đỗ" ở trên — dữ liệu gói neo theo ngày cố định lúc seed nên dần dần
toàn bộ chuyển "Hết hạn" khi thời gian thực trôi qua, mất hẳn ví dụ "sắp hết hạn" (badge cảnh báo)
hay gói còn hiệu lực dài hạn. Chạy lại lệnh sau bất kỳ lúc nào để làm mới quanh ngày hiện tại:

```bash
npm run prisma:seed-fresh-packages
```

Idempotent — đánh dấu qua Payment.notes riêng, chạy lại sẽ xoá batch cũ và tạo lại batch mới.

### Thêm loại phương tiện mới (ngoài 4 loại gốc) kèm dữ liệu mẫu

`npm run prisma:seed` đã có sẵn 5 loại xe mở rộng (Xe đạp điện, Xe máy điện, Ô tô điện, Xe bán tải,
Xe khách) trong danh mục Loại xe, nhưng phần khách hàng/xe/lịch sử ra-vào cho các loại này cần chạy
thêm bước riêng (vì `seed.ts` bỏ qua toàn bộ phần khách hàng/xe nếu DB đã có dữ liệu):

```bash
npm run prisma:seed-vehicle-expansion
```

Sau đó chạy lại `npm run prisma:seed-history` — script này đọc loại xe/chỗ đỗ/giá trực tiếp từ DB
nên sẽ tự rải thêm dữ liệu lịch sử cho các loại xe mới (và bất kỳ loại xe nào thêm sau này qua trang
Loại xe) mà không cần sửa code.

### Sau khi restore/migrate DB mới — tạo Nhóm quyền mặc định cho staff

Hệ phân quyền chuyển từ localStorage sang bảng `PermissionGroups`/`GroupPermissions` — DB mới (chạy
`prisma migrate deploy` từ đầu) sẽ chưa có nhóm quyền nào, nghĩa là mọi tài khoản staff demo
(`nhanvien1/2/3`) tạm thời **không thao tác Thêm/Sửa/Xóa được ở màn nào cả** (vẫn xem được — Xem
không qua nhóm quyền). Chạy lệnh sau để tạo nhóm mặc định và gán cho các tài khoản staff demo:

```bash
npm run prisma:seed-permission-groups
```

Idempotent — chạy lại không tạo trùng nhóm, chỉ cập nhật lại quyền của nhóm "Nhân viên tiêu chuẩn".

---

## File scripts

| File | Mô tả |
|------|-------|
| `scripts/setup-database.ps1` | Script tự động: migrate + seed đầy đủ, hoặc restore từ backup |
| `legacy/setup.sql`, `legacy/schema.sql`, `legacy/demo_business_patch.sql` | ⚠ **Đã lỗi thời** — chỉ giữ tham khảo lịch sử, không dùng nữa (xem cảnh báo ở đầu file) |
| `backend/prisma/seed.ts` | Seed tài khoản + danh mục + dữ liệu demo cơ bản (chạy qua `npm run prisma:seed`) |
| `backend/prisma/seedHistoricalData.ts` | Bồi đắp dữ liệu nhiều năm cho Dashboard/Báo cáo thực tế, đọc loại xe/chỗ đỗ/giá động từ DB (`npm run prisma:seed-history`) |
| `backend/prisma/fixStaleParkedDemo.ts` | Dọn xe "đang đỗ" demo bị coi là đỗ quá lâu do instance chạy nhiều tuần (`npm run prisma:fix-stale-parked`) |
| `backend/prisma/seedExceptionCheckouts.ts` | Bổ sung dữ liệu mẫu "Checkout ngoại lệ" cho Báo cáo (`npm run prisma:seed-exceptions`) |
| `backend/prisma/seedFreshPackages.ts` | Làm mới demo gói dịch vụ khách hàng quanh ngày hiện tại — luôn có đủ active/sắp hết hạn/vừa hết hạn/chưa hiệu lực (`npm run prisma:seed-fresh-packages`) |
| `backend/prisma/seedVehicleTypeExpansion.ts` | Thêm khách hàng/xe/lịch sử mẫu cho 5 loại phương tiện mở rộng (`npm run prisma:seed-vehicle-expansion`) |
| `backend/prisma/seedPermissionGroups.ts` | Tạo nhóm quyền mặc định "Nhân viên tiêu chuẩn" + gán cho staff demo chưa có nhóm (`npm run prisma:seed-permission-groups`) |

---

## Tài khoản đăng nhập

| Username | Email | Mật khẩu | Vai trò |
|----------|-------|-----------|---------|
| `admin` | `admin@parking.com` | `admin123` | Quản trị viên |
| `nhanvien1` | `nv1@parking.com` | `staff123` | Nhân viên |
| `nhanvien2` | `nv2@parking.com` | `staff123` | Nhân viên |

API `POST /api/auth/login` hỗ trợ nhập username **hoặc** email.
