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

---

## File scripts

| File | Mô tả |
|------|-------|
| `setup.sql` | Tạo database + schema + seed cơ bản |
| `demo_business_patch.sql` | Bổ sung/sync dữ liệu demo rule nghiệp vụ |
| `backend/prisma/seed.ts` | Seed tài khoản + danh mục + dữ liệu demo cơ bản (chạy qua `npm run prisma:seed`) |
| `backend/prisma/seedHistoricalData.ts` | Bồi đắp dữ liệu nhiều năm cho Dashboard/Báo cáo thực tế (`npm run prisma:seed-history`) |

---

## Tài khoản đăng nhập

| Username | Email | Mật khẩu | Vai trò |
|----------|-------|-----------|---------|
| `admin` | `admin@parking.com` | `admin123` | Quản trị viên |
| `nhanvien1` | `nv1@parking.com` | `staff123` | Nhân viên |
| `nhanvien2` | `nv2@parking.com` | `staff123` | Nhân viên |

API `POST /api/auth/login` hỗ trợ nhập username **hoặc** email.
