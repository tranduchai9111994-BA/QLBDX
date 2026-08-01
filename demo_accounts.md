# Danh sách tài khoản demo

Dưới đây là danh sách các tài khoản demo được thiết lập sẵn trong hệ thống (dựa theo dữ liệu mẫu - seed data):

| Vai trò | Tên đăng nhập (Username) | Email | Mật khẩu (Password) | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| **Quản trị viên (Admin)** | `admin` | `admin@parking.com` | `admin123` | Tài khoản có toàn quyền quản trị hệ thống. |
| **Nhân viên (Staff)** | `nhanvien1` | `nv1@parking.com` | `staff123` | Dùng để demo quyền nhân viên, không thấy menu thanh toán/báo cáo/người dùng. |
| **Nhân viên (Staff)** | `nhanvien2` | `nv2@parking.com` | `staff123` | Dùng thêm cho luồng xe vào/xe ra và biên nhận. |

> **Lưu ý:**
> - Nếu bạn vừa cài đặt xong hệ thống, hãy đảm bảo đã chạy seed data (lệnh `npm run prisma:seed` trong thư mục `backend`) để tài khoản này được tạo trong cơ sở dữ liệu.
> - Màn hình đăng nhập và API `/api/auth/login` đều chấp nhận nhập **username hoặc email** vào trường `username`.
> - Endpoint `/auth/register` đã được khóa cho public; để tạo thêm user demo, hãy đăng nhập admin và dùng màn hình quản lý người dùng.
