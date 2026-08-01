# Hệ thống Quản lý Bãi đỗ xe

## Công nghệ sử dụng
- **Backend:** Node.js + Express
- **Frontend:** ReactJS + Ant Design + Recharts
- **Database:** SQL Server

## Tính năng
1. **Quản lý xe ra/vào** - Ghi nhận xe vào, xe ra, tính phí tự động
2. **Quản lý bãi đỗ** - Phân khu, chỗ đỗ, trạng thái
3. **Quản lý khách hàng** - Thông tin khách hàng, phương tiện
4. **Gói dịch vụ** - Vé tháng/quý/năm cho từng loại xe
5. **Tính phí & thanh toán** - Tính phí theo giờ/ngày, nhận nhiều phương thức
6. **Quản lý người dùng** - Admin/nhân viên, phân quyền
7. **Báo cáo thống kê** - Doanh thu, lượt xe, biểu đồ

## Cài đặt

### 1. Database
- Mở SQL Server Management Studio
- Chạy file `database/schema.sql` để tạo database và dữ liệu mẫu

### 2. Backend
```bash
cd backend
npm install
```
- Cấu hình file `.env` với thông tin SQL Server:
```
data_base_url
```
- Chạy server:
```bash
npm run dev
```
Server chạy tại: http://localhost:5000

### 3. Tài khoản demo mặc định
Sau khi seed dữ liệu bằng `npm run prisma:seed` trong thư mục `backend`, hệ thống tạo sẵn các tài khoản:

- `admin` / `admin123` (`admin@parking.com`)
- `nhanvien1` / `staff123` (`nv1@parking.com`)
- `nhanvien2` / `staff123` (`nv2@parking.com`)

Form đăng nhập và API `POST /api/auth/login` đều hỗ trợ nhập **username hoặc email** vào trường `username`.

> Lưu ý: endpoint `/api/auth/register` hiện yêu cầu đăng nhập bằng tài khoản `admin`, nên không dùng để bootstrap admin ban đầu.

### 4. Frontend
```bash
cd frontend
npm install
npm start
```
Ứng dụng chạy tại: http://localhost:3000

## Cấu trúc dự án
```
├── backend/
│   ├── config/db.js          # Kết nối SQL Server
│   ├── middleware/auth.js    # Xác thực JWT
│   ├── routes/               # API routes
│   │   ├── auth.js           # Đăng nhập/đăng ký
│   │   ├── users.js          # Quản lý người dùng
│   │   ├── customers.js      # Quản lý khách hàng
│   │   ├── vehicles.js       # Quản lý phương tiện
│   │   ├── vehicleTypes.js   # Loại phương tiện
│   │   ├── parkingZones.js   # Khu vực đỗ xe
│   │   ├── parkingSpots.js   # Chỗ đỗ xe
│   │   ├── packages.js       # Gói dịch vụ
│   │   ├── customerPackages.js # Đăng ký gói
│   │   ├── parking.js        # Xe ra/vào
│   │   ├── payments.js       # Thanh toán
│   │   └── reports.js        # Báo cáo
│   ├── server.js
│   └── .env
├── frontend/
│   └── src/
│       ├── api/axios.js      # HTTP client
│       ├── context/AuthContext.js
│       ├── components/Layout/
│       └── pages/            # Các trang
├── database/
│   └── schema.sql            # Script tạo DB
└── README.md
```

## Tài khoản mặc định
- **Username:** `admin` hoặc **Email:** `admin@parking.com`
- **Password:** `admin123`
