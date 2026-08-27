# Database Setup — QLBDX

## Yêu cầu

- SQL Server 2016+ (hoặc SQL Server Express)
- SQL Server Management Studio (SSMS)

---

## Cách chạy lần đầu

### Cách nhanh nhất — Restore từ backup có sẵn (khuyến nghị)

File `database/ParkingManagement.bak` chứa toàn bộ database **kèm sẵn ~39.000 bản ghi** (data nhiều năm 2024 → nay) — restore xong là có ngay dữ liệu thật, không cần chạy seed script (~3 phút) nữa.

Trong SSMS: chuột phải **Databases → Restore Database... → Device → chọn `ParkingManagement.bak`** → OK.

Hoặc bằng lệnh (`sqlcmd`):
```bash
sqlcmd -S localhost -U sa -P 123 -Q "RESTORE DATABASE [ParkingManagement] FROM DISK = N'database/ParkingManagement.bak' WITH REPLACE"
```

Xong bước này → bỏ qua "Bước 2 — Chạy script" bên dưới, chuyển thẳng sang **Bước 3 — Cấu hình backend**.

---

### Cách thủ công — Chạy script từ đầu (nếu muốn tự tạo data hoặc backup bị lỗi)

### Bước 1 — Kết nối SSMS

| Trường | Giá trị |
|--------|---------|
| Server | `localhost` hoặc `localhost\SQLEXPRESS` |
| Authentication | SQL Server Authentication |
| Login | `sa` |
| Password | `123` |

> Windows Authentication: bỏ qua user/password, sửa `DATABASE_URL` trong `backend/.env` tương ứng.

### Bước 2 — Chạy script

1. Mở `database/setup.sql` trong SSMS (`File → Open → File...`)
2. Nhấn **F5** hoặc nút **Execute** → chờ ~10 giây
3. _(Tuỳ chọn)_ Chạy tiếp `database/demo_business_patch.sql` để bổ sung dữ liệu demo nghiệp vụ
4. _(Khuyên dùng)_ Chạy Prisma seed để có data demo cơ bản + tài khoản:

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:seed
```

5. _(Khuyên dùng — để Dashboard/Báo cáo/Phân tích hiển thị đúng xu hướng thực tế)_ Bồi đắp dữ liệu
   nhiều năm (2024 → nay), mất khoảng 2-3 phút, idempotent nên chạy lại vô tư:

```bash
npm run prisma:seed-history
```

### Bước 3 — Cấu hình backend

Kiểm tra `backend/.env`:
```env
DATABASE_URL="sqlserver://localhost:1433;database=ParkingManagement;user=sa;password=123;encrypt=false;trustServerCertificate=true"
```

Chỉnh `user`, `password` hoặc tên server nếu khác.

---

## Dữ liệu mẫu

| Bảng | Số lượng |
|------|---------|
| Loại xe | 4 (Xe máy, Ô tô con, Ô tô lớn, Xe đạp) |
| Khu đỗ / Chỗ đỗ | ~5 khu, ~100 chỗ |
| Khách hàng | ~25 người |
| Phương tiện | ~30 xe đa dạng loại |
| Gói dịch vụ | 10 gói (tháng/quý/năm theo từng loại xe) |
| Đăng ký gói | ~20 bản ghi (active, sắp hết hạn, expired, pending) |
| Lịch sử đỗ xe | ~1.500+ lượt sau `prisma:seed`, **~39.000+** sau `prisma:seed-history` |
| Thanh toán | tương ứng số lượt đỗ xe có phí |
| Người dùng | 5 (2 admin, 3 staff — 1 tài khoản bị khoá để demo deactivate) |

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
| `setup.sql` | Tạo database + schema + seed cơ bản |
| `demo_business_patch.sql` | Bổ sung/sync dữ liệu demo rule nghiệp vụ |
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
