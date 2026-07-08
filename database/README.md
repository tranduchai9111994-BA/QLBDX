# Database Setup - QLBDX

## Yêu cầu
- SQL Server 2016 trở lên (hoặc SQL Server Express)
- SQL Server Management Studio (SSMS)

## Cách chạy

### Bước 1 — Mở SSMS
Kết nối vào SQL Server với thông tin:
- Server: `localhost` hoặc `localhost\SQLEXPRESS`
- Authentication: SQL Server Authentication
- User: `sa` / Password: `123`

> Nếu dùng Windows Authentication thì bỏ qua user/password

### Bước 2 — Chạy script
1. Mở file `setup.sql` trong SSMS (`File > Open > File...`)
2. Nhấn **F5** hoặc nút **Execute**
3. Chờ khoảng 5–10 giây

Script sẽ tự động:
- Tạo database `ParkingManagement` (nếu chưa có)
- Xóa bảng cũ và tạo lại toàn bộ schema
- Chèn dữ liệu mẫu từ 2024 đến nay

### Bước 3 — Cấu hình backend
Mở file `backend/.env`, kiểm tra connection string:
```
DATABASE_URL="sqlserver://localhost:1433;database=ParkingManagement;user=sa;password=123;encrypt=false;trustServerCertificate=true"
```
Chỉnh `user`, `password` hoặc tên server nếu khác.

---

## Dữ liệu mẫu đi kèm

| Bảng | Số lượng |
|------|---------|
| Khách hàng | 25 người |
| Xe | 30 xe (xe máy, ô tô, xe đạp) |
| Lịch sử đỗ xe | ~1.493 lượt (01/2024 – 07/2026) |
| Thanh toán | ~1.259 giao dịch |
| Gói vé tháng/quý/năm | 20 gói |

## Tài khoản đăng nhập

| Username | Password | Vai trò |
|----------|----------|---------|
| `admin` | `admin123` | Quản trị viên |
| `nhanvien1` | `staff123` | Nhân viên |
| `nhanvien2` | `staff123` | Nhân viên |
