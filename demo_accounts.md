# Tài khoản demo QLBDX — Parking Management System

## Danh sách tài khoản

Form đăng nhập hỗ trợ nhập **username hoặc email** vào trường `username`.

| # | Vai trò | Username | Email | Mật khẩu | Trạng thái | Dùng để demo |
|---|---------|----------|-------|-----------|------------|--------------|
| 1 | **Admin chính** | `admin` | `admin@parking.com` | `admin123` | ✅ Hoạt động | Toàn bộ chức năng quản trị |
| 2 | **Admin phụ** | `giamdoc` | `gd@parking.com` | `admin123` | ✅ Hoạt động | Demo quản lý nhiều admin, xem Users |
| 3 | **Nhân viên** | `nhanvien1` | `nv1@parking.com` | `staff123` | ✅ Hoạt động | Vận hành hàng ngày (xe vào/ra, gói) |
| 4 | **Nhân viên** | `nhanvien2` | `nv2@parking.com` | `staff123` | ✅ Hoạt động | Demo cùng lúc 2 nhân viên |
| 5 | **Nhân viên (khoá)** | `nhanvien3` | `nv3@parking.com` | `staff123` | 🔴 Bị khoá | Demo tính năng deactivate tài khoản |

> Mật khẩu admin: `admin123` | Mật khẩu staff: `staff123`

---

## Quyền theo vai trò

### Admin (`admin`, `giamdoc`)
- Toàn quyền tất cả chức năng
- Thanh toán, Báo cáo, Cảnh báo, Nhật ký hoạt động
- Quản lý người dùng & phân quyền
- CRUD tất cả danh mục (loại xe, bãi đỗ, gói, ...)
- Xóa / vô hiệu hoá dữ liệu

### Nhân viên (`nhanvien1`, `nhanvien2`)
Quyền mặc định (admin có thể điều chỉnh tại **Người dùng → Phân quyền chức năng**):
- ✅ Dashboard (vận hành)
- ✅ Xe vào / Xe ra / Lịch sử đỗ xe
- ✅ Khách hàng (xem + tạo, không xóa)
- ✅ Phương tiện (xem + tạo, không xóa)
- ✅ Loại xe (chỉ xem)
- ✅ Bãi đỗ xe (chỉ xem)
- ✅ Gói dịch vụ (xem + đăng ký, không xóa/sửa)
- ❌ Thanh toán, Báo cáo, Cảnh báo, Nhật ký, Người dùng (ẩn)

### Nhân viên bị khoá (`nhanvien3`)
- Tài khoản `isActive = false`
- Đăng nhập sẽ bị từ chối: *"Tài khoản đã bị vô hiệu hoá"*
- Demo: Admin vào **Người dùng** → bật lại khoá để kích hoạt

---

## Tình huống demo bảo vệ (gợi ý kịch bản)

### Kịch bản 1 — Vận hành hàng ngày
1. **Login nhân viên** (`nhanvien1` / `staff123`) → menu gọn, không thấy Báo cáo/Thanh toán
2. **Xe vào** → nhập biển số có trong DB → hệ thống tự gợi loại xe + thông tin khách
3. **Xe ra** → chọn xe → xem phí tự tính → chọn PTTT → in biên nhận
4. **Xe tháng** → thấy badge "Xe tháng" màu xanh → phí = 0đ
5. **Checkout ngoại lệ** → bật switch → chọn "Mất vé" → miễn phí → lưu ghi chú

### Kịch bản 2 — Quản trị
6. **Login admin** (`admin` / `admin123`)
7. **Dashboard** → hero card, đồng hồ lấp đầy, cảnh báo ưu tiên, biểu đồ doanh thu
8. **Phân quyền** → vào **Người dùng → Phân quyền chức năng** → bật/tắt màn hình staff
9. **Báo cáo** → lọc theo tháng → xuất Excel (5 sheet) / in PDF
10. **Cảnh báo** → lọc theo ngày/tuần → xuất Excel/CSV
11. **Nhật ký** → xem history mọi thao tác → xuất CSV

### Kịch bản 3 — Gói dịch vụ & gia hạn
12. **Đăng ký gói** → Gói dịch vụ → chọn khách + xe + gói → đặt ngày bắt đầu
13. **Gia hạn gói hết hạn** → nút "Gia hạn" → form chỉ chọn gói mới + ngày (KH/xe cố định)
14. **Import Excel** → tải template → điền dữ liệu → import nhiều khách cùng lúc

### Kịch bản 4 — Bảo mật
15. **Thử login `nhanvien3`** → báo lỗi tài khoản bị khoá
16. **Admin bật lại** → Users → toggle isActive
17. **Test tính phí** → `cd backend && npm test` → 9/9 PASS

---

## Reset / seed lại dữ liệu

```bash
cd backend
npm run prisma:seed
```

Lệnh trên sẽ:
- Tạo/cập nhật 5 tài khoản demo
- Seed dữ liệu khách, xe, khu/chỗ đỗ, gói, lịch sử demo 01–02/08/2026
- Idempotent: chạy lại không bị lỗi trùng

Hoặc seed từ SQL:
```sql
-- SSMS: chạy database/setup.sql rồi database/demo_business_patch.sql
```

---

## Cách tạo tài khoản mới (qua UI)

Admin đăng nhập → menu **Người dùng** → **Thêm người dùng**.

> Endpoint `POST /api/auth/register` đã được bảo vệ — chỉ admin gọi được.
