# Hệ thống Quản lý Bãi Đỗ Xe (QLBDX)

> Cập nhật gần nhất — xem **[docs/CHANGELOG.md](docs/CHANGELOG.md)** để biết thay đổi mới nhất, cách cập nhật code/database cho máy đã cài trước đó.

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

**Lần đầu cài đặt — 1 lệnh duy nhất** (mở PowerShell tại thư mục gốc):

```powershell
.\scripts\setup-all.ps1
```

Script tự làm hết: tạo `.env` → tạo database → áp dụng Prisma migrations → seed dữ liệu demo →
cài dependency backend + frontend. Thêm `-FromBackup` để restore nhanh từ file `.bak` có sẵn,
hoặc `-SkipHistory` để bỏ qua bước seed lịch sử nhiều năm (bước lâu nhất).

Sau đó double-click **`start.bat`** → hệ thống khởi động ngầm và tự mở trình duyệt.

**Lần sau (đã có node_modules):**
- Double-click **`scripts\start-fast.bat`** → khởi động nhanh, không kiểm tra dependency

> `start.bat` / `start-fast.bat` chạy **hoàn toàn ẩn** (không mở cửa sổ CMD) — Backend + Frontend chạy ngầm, log ghi vào `logs/`. Nếu hệ thống **đã chạy sẵn** (VD: bấm icon lần 2), trình duyệt mở lại gần như ngay lập tức; nếu khởi động lần đầu/mới tắt hẳn thì mất ~10-90 giây tuỳ máy. Muốn dừng: chạy `stop.bat`.

> ⚠️ **Không dùng `database/legacy/setup.sql`** — bản dump cũ, thiếu nhiều bảng thêm về sau. Nguồn sự thật của schema là Prisma migrations trong `backend/prisma/migrations/`.

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

### 1. Backend + Database
```bash
cd backend
cp .env.example .env          # Windows: copy .env.example .env
npm install
npx prisma migrate deploy     # tạo/cập nhật toàn bộ bảng theo migrations
npx prisma generate
npm run dev                   # http://localhost:5001
```

### 2. Frontend
```bash
cd frontend
npm install
npm start                     # http://localhost:3000
```

### 3. Seed dữ liệu demo
```bash
cd backend
npm run prisma:seed                    # tài khoản + danh mục + dữ liệu cơ bản
npm run prisma:seed-permission-groups  # BẮT BUỘC — không có thì staff trắng quyền
npm run prisma:seed-vehicle-expansion  # xe/khách mẫu cho 5 loại phương tiện mở rộng
npm run prisma:seed-exceptions         # dữ liệu "checkout ngoại lệ" cho Báo cáo
npm run prisma:seed-fresh-packages     # gói active/sắp hết hạn/vừa hết hạn quanh hôm nay
npm run prisma:seed-history            # (~2-3 phút) dữ liệu nhiều năm cho Dashboard/Báo cáo
npm run prisma:fix-stale-parked        # nếu demo chạy lâu ngày, xe "đang đỗ" bị coi là đỗ quá lâu
```

Mọi seed script đều **idempotent** — chạy lại nhiều lần an toàn.

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

> Xem chi tiết thiết kế tại [SMART_UPGRADE_PLAN.md](docs/archive/SMART_UPGRADE_PLAN.md).

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
│   │   ├── schema.prisma          # Data model — NGUỒN SỰ THẬT của schema
│   │   ├── migrations/            # Lịch sử thay đổi DB (dùng `prisma migrate deploy`)
│   │   ├── seed.ts                # Dữ liệu demo cơ bản
│   │   ├── seedPermissionGroups.ts    # Nhóm quyền mặc định (bắt buộc cho staff)
│   │   ├── seedVehicleTypeExpansion.ts # Xe/khách mẫu cho 5 loại phương tiện mở rộng
│   │   ├── seedExceptionCheckouts.ts   # Dữ liệu checkout ngoại lệ cho Báo cáo
│   │   ├── seedFreshPackages.ts        # Gói dịch vụ quanh ngày hiện tại
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
│           ├── dateFormat.ts       # Định dạng hh:mm:ss dd/mm/yyyy dùng chung
│           └── tablePagination.ts  # Phân trang (chọn 10/20/30/50/100 dòng) dùng chung
├── database/
│   ├── ParkingManagement.bak    # Backup đầy đủ dữ liệu (dùng cho -FromBackup)
│   ├── README.md                # Chi tiết DB + mô tả từng script seed
│   └── legacy/                  # ⚠ SQL script CŨ, KHÔNG dùng nữa (giữ tham khảo)
├── docs/
│   ├── KIEN_TRUC_TONG_QUAN.md      # Kiến trúc tổng quan
│   ├── KIEN_TRUC_CHI_TIET.md       # Kiến trúc chi tiết (API, luồng nghiệp vụ, rủi ro)
│   ├── Function.md                 # Đặc tả chức năng theo endpoint
│   ├── SMART_FEATURES_DEEP_DIVE.md # Giải thích kỹ thuật 5 tính năng thông minh
│   ├── demo_accounts.md            # Tài khoản demo chi tiết
│   ├── CHANGELOG.md                # Lịch sử thay đổi
│   └── archive/                    # Tài liệu kế hoạch/audit đã hoàn thành
├── scripts/
│   ├── setup-all.ps1        # Setup toàn bộ dự án (1 lệnh, cho máy mới)
│   ├── setup-database.ps1   # Chỉ dựng lại database
│   ├── start-fast.bat       # Khởi động nhanh (bỏ qua install)
│   ├── start-silent.ps1     # Logic khởi động thật (chạy ngầm)
│   ├── stop-silent.ps1      # Logic dừng thật
│   └── start-sqlserver.bat  # Bật service SQL Server
├── logs/                    # Log runtime (không commit)
├── ONBOARDING.md            # Hướng dẫn setup & làm quen sản phẩm cho thành viên mới
├── start.bat                # Khởi động (giữ ở gốc cho tiện shortcut Desktop)
└── stop.bat                 # Dừng Backend + Frontend
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
PORT=5001
DATABASE_URL="sqlserver://localhost:1433;database=ParkingManagement;user=sa;password=123;encrypt=false;trustServerCertificate=true"
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h
```

> ⚠️ Đổi `JWT_SECRET` trước khi dùng thật. Nếu đổi `PORT`, phải set thêm `REACT_APP_API_URL`
> cho frontend (VD tạo `frontend/.env` với `REACT_APP_API_URL=http://localhost:5002/api`) —
> mặc định frontend gọi `http://localhost:5001/api`.

---

## Phân quyền

- **Admin**: toàn quyền, không thuộc nhóm quyền nào.
- **Staff**: gán vào **Nhóm quyền** (tạo ở *Người dùng → Nhóm quyền*). Mỗi nhóm có ma trận
  **Thêm / Sửa / Xóa** theo từng chức năng; xem dữ liệu tra cứu thì luôn mở.
- Quyền lưu trong DB (`PermissionGroups` / `GroupPermissions`) và **backend chặn thật** qua
  middleware `requirePermission` — không phải chỉ ẩn/hiện menu. Chi tiết: [docs/KIEN_TRUC_CHI_TIET.md](docs/KIEN_TRUC_CHI_TIET.md) mục 8.5.
- Đổi ma trận quyền → nhân viên trong nhóm **đăng nhập lại** là có hiệu lực (không cần deploy).
