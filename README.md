# Hệ thống Quản lý Bãi Đỗ Xe (QLBDX)

> Cập nhật gần nhất — xem **[CAP_NHAT_2026-08-26.md](CAP_NHAT_2026-08-26.md)** để biết thay đổi mới nhất, cách cập nhật code/database cho máy đã cài trước đó.

## Công nghệ sử dụng

| Phần | Công nghệ |
|------|-----------|
| Frontend | React 18 + TypeScript + Ant Design 5 + Recharts |
| Backend | Node.js + Express + TypeScript + Prisma ORM |
| Database | SQL Server 2016+ |
| Auth | JWT (HS256) |

---

## Khởi động nhanh (Windows)

> Hướng dẫn setup từ đầu chi tiết nhất: xem **[ONBOARDING.md](ONBOARDING.md)**.

**Lần đầu cài đặt:**
1. Chạy `database/setup.sql` trong SSMS để tạo DB và dữ liệu mẫu
2. Copy `backend/.env.example` → `backend/.env`, chỉnh connection string SQL Server nếu cần
3. Double-click **`start.bat`** → hệ thống tự cài dependency, khởi động ngầm và mở trình duyệt

**Lần sau (đã có node_modules):**
- Double-click **`start-fast.bat`** → khởi động nhanh, không kiểm tra dependency

> `start.bat`/`start-fast.bat` chạy **hoàn toàn ẩn** (không mở cửa sổ CMD) — Backend + Frontend chạy ngầm, log ghi vào `logs/`. Nếu hệ thống **đã chạy sẵn** (VD: bấm icon lần 2), trình duyệt mở lại gần như ngay lập tức; nếu khởi động lần đầu/mới tắt hẳn thì mất ~10-90 giây tuỳ máy. Muốn dừng: chạy `stop.bat`.

---

## Tài khoản demo

| Vai trò | Username | Email | Mật khẩu |
|---------|----------|-------|-----------|
| Quản trị viên | `admin` | `admin@parking.com` | `admin123` |
| Nhân viên | `nhanvien1` | `nv1@parking.com` | `staff123` |
| Nhân viên | `nhanvien2` | `nv2@parking.com` | `staff123` |

> Form đăng nhập hỗ trợ nhập **username hoặc email**. Endpoint `/api/auth/register` yêu cầu đăng nhập admin, không public.

---

## Cài đặt thủ công

### 1. Database
```bash
# Mở SSMS → kết nối localhost, user sa / 123
# Chạy: database/setup.sql  (tạo schema + seed cơ bản)
# Tuỳ chọn: database/demo_business_patch.sql  (dữ liệu demo dày)
```

### 2. Backend
```bash
cd backend
npm install
# Cấu hình backend/.env nếu cần (DATABASE_URL, JWT_SECRET)
npm run prisma:generate
npm run dev          # http://localhost:5000
```

### 3. Frontend
```bash
cd frontend
npm install
npm start            # http://localhost:3000
```

### 4. Seed dữ liệu (tuỳ chọn)
```bash
cd backend
npm run prisma:seed          # Seed tài khoản + danh mục + dữ liệu demo cơ bản
npm run prisma:seed-history  # Bồi đắp dữ liệu lịch sử nhiều năm (2024 → nay) cho Dashboard/Báo cáo thực tế
npm run prisma:fix-stale-parked  # Nếu app đã chạy demo lâu ngày, xe "đang đỗ" bị coi là đỗ quá lâu — chạy lệnh này để làm mới
npm run prisma:seed-exceptions   # Seed 16 bản ghi "checkout ngoại lệ" mẫu cho Báo cáo
```

---

## Tính năng chính

| Module | Mô tả |
|--------|-------|
| **Xe vào / Xe ra** | Ghi nhận, tính phí theo giờ/ngày, checkout ngoại lệ (mất vé...) |
| **Tính phí** | ≤24h: min(giờ×rate, daily); >24h: ngày × dailyRate; có gói → miễn phí |
| **Test tính phí** | `cd backend && npm test` (9 test cases: 0p, qua đêm, mốc cap, có gói) |
| **Bãi đỗ xe** | Quản lý khu/chỗ theo loại xe, trạng thái available/occupied/maintenance |
| **Khách hàng & Phương tiện** | CRUD đầy đủ, validate trùng biển số/SĐT/CCCD |
| **Gói dịch vụ** | Vé tháng/quý/năm, kiểm tra chồng gói, deactivate/reactivate |
| **Lịch sử biển số** | Tra cứu toàn bộ lịch sử + checkout ngoại lệ theo biển số |
| **Thanh toán** | Tự sinh khi xe ra/mua gói, sửa được thông tin giao dịch, xuất Excel/CSV/in PDF |
| **Giao diện** | Sáng/Tối (dark mode) — nút chuyển ở header, tự nhớ lựa chọn lần sau |
| **Báo cáo** | Doanh thu theo ngày/tháng/năm, phân loại xe, PTTT, xuất Excel |
| **Cảnh báo** | Gói sắp hết hạn, bãi sắp đầy, xe đỗ quá lâu, dữ liệu lệch — **ngưỡng và mức độ (Nguy hiểm/Cảnh báo/Thông tin) tự cấu hình được**, mỗi loại có thể đặt nhiều mốc (VD: >=48h = Nguy hiểm, >=24h = Cảnh báo) |
| **Phân quyền** | Admin: toàn quyền; Staff: vận hành (xe vào/ra, khách, gói) |
| **Nhật ký** | Ghi log mọi thao tác: ai làm gì, lúc nào, kết quả gì |

### Tính năng thông minh (rule-based, không dùng ML)

| Module | Mô tả | Chi tiết |
|--------|-------|----------|
| **Smart auto-fill** | Nhập biển số → tự hiện khách quen, gói dịch vụ, chỗ đỗ ưa thích, auto-chọn chỗ gợi ý | Màn hình Xe vào |
| **Gợi ý gói dịch vụ** | Sau khi checkout, hệ thống tự tính tần suất 30 ngày → gợi ý gói tháng/quý/năm kèm % tiết kiệm | Màn hình Xe ra |
| **Cảnh báo thông minh** | Xe đỗ bất thường (so với TB loại xe), biến động doanh thu, cơ hội gia hạn, mất cân bằng khu vực | Màn hình Cảnh báo (badge "Smart") |
| **Dashboard insights** | So sánh tuần này/tuần trước, giờ cao điểm, xu hướng 7 ngày, gợi ý hành động cho admin | Trang Tổng quan |
| **Phân tích & Gợi ý (DSS)** | Phân tích theo thứ/giờ/khu vực + đề xuất quyết định (mở rộng chỗ, đổi giá cuối tuần, chiến dịch bán gói) kèm tác động & rủi ro | Trang Phân tích & Gợi ý (admin) |

> Xem chi tiết thiết kế tại [SMART_UPGRADE_PLAN.md](SMART_UPGRADE_PLAN.md).

---

## Cấu trúc dự án

```
QLBDX/
├── backend/
│   ├── src/
│   │   ├── config/          # DB, JWT config
│   │   ├── controllers/     # Nhận request → gọi service (gồm analytics.controller.ts mới)
│   │   ├── services/        # Nghiệp vụ chính (gồm analytics.service.ts — Phân tích & Gợi ý DSS)
│   │   ├── routes/          # Định nghĩa URL
│   │   ├── middlewares/     # Auth JWT, activity logger, validate
│   │   ├── validators/      # Zod schema
│   │   └── utils/
│   │       ├── feeCalculator.ts       # Thuật toán tính phí (pure)
│   │       ├── feeCalculator.test.ts  # Unit tests
│   │       └── businessRules.ts       # Rule loại xe / biển số
│   ├── prisma/
│   │   ├── schema.prisma          # Data model
│   │   ├── seed.ts                # Dữ liệu demo cơ bản
│   │   ├── seedHistoricalData.ts  # Bồi đắp dữ liệu nhiều năm (2024 → nay)
│   │   └── fixStaleParkedDemo.ts  # Dọn xe "đang đỗ" demo bị đỗ quá lâu do instance chạy lâu ngày
│   └── .env.example          # Template cấu hình — copy thành .env
├── frontend/
│   └── src/
│       ├── api/axios.ts     # HTTP client + interceptors
│       ├── context/         # AuthContext, LanguageContext (song ngữ vi/en), ThemeContext (dark mode)
│       ├── theme/            # useAntdTheme.ts — theme token AntD theo sáng/tối
│       ├── i18n/            # translations.ts
│       ├── components/      # Layout, ImportModal, PageHeader, StatusTag, FilterBar,
│       │                    # PermissionGate, AlertSettingsPanel (bảng ngưỡng cảnh báo),
│       │                    # DesktopOnlyBanner (cảnh báo màn hình < 1024px)
│       ├── hooks/            # useDashboardData, useAlertRuleTiers, useUpdateAvailable
│       ├── pages/           # Trang UI (Dashboard tách OpsDashboard/MgmtDashboard theo vai trò)
│       ├── types/index.ts   # TypeScript interfaces
│       └── utils/
│           ├── reportExport.ts     # Xuất Excel/CSV/PDF báo cáo
│           ├── permConfig.ts       # Cấu hình phân quyền màn hình staff
│           ├── dateFormat.ts       # Định dạng hh:mm:ss dd/mm/yyyy dùng chung
│           └── tablePagination.ts  # Phân trang (chọn 10/20/30/50/100 dòng) dùng chung
├── database/
│   ├── setup.sql                # Schema + seed cơ bản
│   ├── demo_business_patch.sql  # Dữ liệu demo nghiệp vụ
│   └── README.md
├── ONBOARDING.md            # Hướng dẫn setup & làm quen sản phẩm cho thành viên mới
├── demo_accounts.md         # Tài khoản demo chi tiết
├── KIEN_TRUC_TONG_QUAN.md   # Kiến trúc tổng quan
├── KIEN_TRUC_CHI_TIET.md    # Kiến trúc chi tiết (API, luồng nghiệp vụ, rủi ro kỹ thuật)
├── SMART_UPGRADE_PLAN.md    # Thiết kế 5 tính năng thông minh rule-based
├── Function.md              # Đặc tả chức năng chi tiết theo endpoint
├── start.bat                # Khởi động đầy đủ, chạy ngầm (auto install)
├── start-fast.bat           # Khởi động nhanh, chạy ngầm (bỏ qua install)
└── stop.bat                 # Dừng Backend + Frontend đang chạy ngầm
```

---

## Chạy test

```bash
cd backend
npm test        # Unit test thuật toán tính phí (9 cases)
npm run build   # TypeScript build check
```

---

## Môi trường backend (`backend/.env`)

```env
PORT=5000
DATABASE_URL="sqlserver://localhost:1433;database=ParkingManagement;user=sa;password=123;encrypt=false;trustServerCertificate=true"
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h
```
