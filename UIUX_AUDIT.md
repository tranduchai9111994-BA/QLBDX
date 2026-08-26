# QLBDX — Tài liệu mô tả UI/UX chuyên sâu

> **Mục đích tài liệu**: Mô tả đầy đủ hệ thống thiết kế, kiến trúc UI, và kiểm kê từng màn hình của ứng dụng quản lý bãi đỗ xe QLBDX, để đưa cho một phiên Claude khác **đánh giá và góp ý nâng cấp UI/UX**. Tài liệu được viết từ việc đọc trực tiếp source code (React + TypeScript + Ant Design 5), không phải suy đoán.
>
> Cập nhật: 2026-08-26 · Nguồn: `D:\QLBDX_REVIEW\QLBDX\frontend`

> **[GHI CHÚ CẬP NHẬT]** Tài liệu này là ảnh chụp **as-is tại thời điểm viết** — giữ nguyên toàn văn để làm mốc lịch sử. Sau đó một đợt remediation (xem `QLBDX_UIUX_Review_and_Remediation_Plan.md`) đã triển khai và phần lớn các phát hiện dưới đây **đã được sửa trong code hiện tại**. Các phát hiện đã sửa được đánh dấu **[ĐÃ SỬA — xem mã X]** ngay tại vị trí liên quan, tham chiếu theo mã vấn đề (A-xx/B-xx/C-xx) dùng trong tài liệu remediation. Phát hiện không có nhãn = vẫn giữ nguyên hiện trạng như mô tả (đã xác minh lại qua code ngày 2026-08-26).
>
> Tóm tắt nhanh theo mã: **Đã sửa** — A-01, A-02, A-04, B-01, B-02, B-04, B-05, B-07, B-08, B-09, B-10, C-01, C-03, C-04, C-09, C-13, D-1, D-3, i18n ImportModal. **Sửa một phần** — B-03 (period label rõ nhưng chưa có 1 bộ chọn kỳ toàn trang), C-02 (StatusTag đã có nhưng ParkingSpots/Payments chưa áp dụng), C-07 (đã gộp nút xuất Excel + hợp nhất UI ngôn ngữ, nhưng ParkingSpots vẫn còn 2 điểm filter khu), C-10 (đã bỏ `<style>` inject ở ActivityLogs, nhưng export logic vẫn chưa dùng chung `reportExport.ts`). **Chưa sửa** — A-03, A-05, B-06, B-11, C-05, C-06, C-08, C-11 (chủ đích theo quyết định D-3, xem T-13), C-12.

---

## Mục lục

1. [Bối cảnh sản phẩm](#1-bối-cảnh-sản-phẩm)
2. [Stack công nghệ UI](#2-stack-công-nghệ-ui)
3. [Design System — "Precision Authority"](#3-design-system--precision-authority)
4. [Kiến trúc khung UI (App Shell)](#4-kiến-trúc-khung-ui-app-shell)
5. [Kiểm kê chi tiết từng màn hình](#5-kiểm-kê-chi-tiết-từng-màn-hình)
6. [Pattern đang nhất quán (điểm mạnh)](#6-pattern-đang-nhất-quán-điểm-mạnh)
7. [Vấn đề & sự thiếu nhất quán (tổng hợp theo nhóm)](#7-vấn-đề--sự-thiếu-nhất-quán-tổng-hợp-theo-nhóm)
8. [Đa ngôn ngữ (i18n) — hạ tầng tốt nhưng phủ không đều](#8-đa-ngôn-ngữ-i18n--hạ-tầng-tốt-nhưng-phủ-không-đều)
9. [Responsive & Accessibility](#9-responsive--accessibility)
10. [Câu hỏi gợi ý để nhờ đánh giá](#10-câu-hỏi-gợi-ý-để-nhờ-đánh-giá)
11. [Phụ lục: bảng toàn bộ màn hình](#11-phụ-lục-bảng-toàn-bộ-màn-hình)

---

## 1. Bối cảnh sản phẩm

**QLBDX** là web app quản trị nội bộ (B2B ops tool) cho một bãi đỗ xe, phục vụ 2 vai trò:

- **Admin**: toàn quyền — danh mục, người dùng, báo cáo, cảnh báo, phân tích, thanh toán.
- **Nhân viên (staff)**: vận hành hằng ngày — xe vào/ra, khách hàng, phương tiện, đăng ký gói. Menu bị ẩn bớt theo cấu hình phân quyền (admin cấu hình được).

Đây **không phải app tiêu dùng** — người dùng là nhân viên ngồi tại quầy/văn phòng, thao tác lặp lại nhiều lần/ngày trên desktop. Điều này ảnh hưởng tới ưu tiên UX: tốc độ nhập liệu, mật độ thông tin, độ tin cậy quan trọng hơn tính thẩm mỹ trang trí.

---

## 2. Stack công nghệ UI

| Thành phần | Công nghệ | Ghi chú |
|---|---|---|
| Framework | React 18 + TypeScript | CRA (react-scripts 5) |
| UI Kit | Ant Design 5 | Dùng gần như thuần AntD component, không có thư viện UI khác |
| Biểu đồ | Recharts | Bar/Line/Area/Pie/RadialBar |
| Ngày giờ | dayjs | Đồng bộ với AntD DatePicker |
| Excel | `xlsx` + `exceljs` | Import (đọc) và export (ghi, style nâng cao) |
| Icon | `@ant-design/icons` | Nhất quán, trừ vài chỗ dùng emoji thủ công |
| Routing | react-router-dom v6 | `BrowserRouter`, route lồng trong `MainLayout` |
| State | React Context (Auth, Language) + local `useState`/`useEffect` | Không có Redux/Zustand — state quản lý theo từng trang |
| Font | Inter (Google Fonts, preconnect trong `index.html`) | |

**Không có**: state management library, form validation library ngoài AntD Form, testing library cho UI, Storybook/component catalog, design token file dùng chung ngoài CSS variables.

---

## 3. Design System — "Precision Authority"

Toàn bộ theme được định nghĩa tập trung tại `frontend/src/design-system.css` (1034 dòng, tự đặt tên "Precision Authority") + `ConfigProvider` theme trong `App.tsx`. Đây là điểm khởi đầu quan trọng nhất cho bất kỳ đánh giá UI/UX nào.

### 3.1 Bảng màu (CSS custom properties)

```css
/* Primary */
--primary: #005daa;
--primary-container: #0075d5;
--on-primary: #ffffff;

/* Surface hierarchy (5 mức tonal) */
--surface: #f9f9ff;
--surface-container-lowest: #ffffff;
--surface-container-low: #f1f3ff;
--surface-container: #eaecf6;
--surface-container-high: #e0e8ff;
--surface-container-highest: #d4daf0;

/* Inverse (sidebar tối) */
--inverse-surface: #283042;
--inverse-on-surface: #dfe2f0;
--inverse-primary: #a8c8ff;

/* On-surface */
--on-surface: #131b2c;
--on-surface-variant: #44474f;
--outline-variant: rgba(116, 119, 127, 0.15);

/* Semantic */
--success: #1a7a2e;   --success-container: #dcf5e0;
--warning: #934600;   --warning-container: #ffdcbe;
--error: #ba1a1a;     --error-container: #ffdad6;
--info: #005daa;      --info-container: #d4e3ff;
```

Đây là hệ màu kiểu **Material Design 3 tonal palette** (surface container 5 cấp, semantic color kèm "container" nhạt hơn) — khá bài bản trên giấy tờ. Vấn đề: **rất nhiều nơi trong code không dùng các biến này**, xem [§7.1](#71-màu-sắc-hardcode-thay-vì-dùng-css-variable).

### 3.2 Spacing / Radius / Shadow — hệ số chuẩn hoá

```css
--spacing-xs: 0.25rem;  --spacing-sm: 0.5rem;  --spacing-md: 1rem;
--spacing-lg: 1.5rem;   --spacing-xl: 2rem;

--radius-sm: 4px;  --radius-default: 8px;  --radius-lg: 12px;
--radius-xl: 16px; --radius-full: 9999px;

--shadow-ambient: 0 20px 40px rgba(19, 27, 44, 0.06);  /* rất nhẹ */
--shadow-float: 0 8px 24px rgba(19, 27, 44, 0.12);      /* modal/dropdown */
```

Triết lý rõ ràng: **"No-Line Rule"** — card/table/input không viền, phân tách bằng màu nền tonal + shadow rất nhẹ khi hover thay vì border. Bo góc nhất quán 8px cho hầu hết component.

### 3.3 Typography

- Font: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- `letter-spacing: -0.01em` toàn cục (chữ hơi "thắt" lại — phong cách hiện đại)
- Không có type scale chính thức (không có `--font-size-*` variables) — kích thước chữ rải rác trong từng rule (`0.72rem` header table, `0.875rem` cell, `1.5rem` page title, `1.75rem` KPI value...). Đây là khoảng trống: **không có type scale hệ thống hoá**.

### 3.4 AntD theme token override (`App.tsx`)

```js
theme={{
  token: {
    colorPrimary: '#005daa',
    colorBgBase: '#f9f9ff',
    fontFamily: "'Inter', ...",
    borderRadius: 8,
    fontSize: 14,
    controlHeight: 40,        // input/button/select cao hơn mặc định AntD (32px)
    colorError: '#ba1a1a',
    colorSuccess: '#1a7a2e',
    colorWarning: '#934600',
  },
  components: {
    Card: { boxShadowTertiary: 'none' },
    Table: { borderColor: 'transparent', headerBg: '#f1f3ff' },
    ...
  },
}}
```

`controlHeight: 40` là quyết định đáng chú ý — input/button cao hơn mặc định, phù hợp thao tác nhập liệu nhanh bằng chuột lẫn cảm ứng (dù app không thật sự tối ưu cho cảm ứng, xem §9).

Lưu ý: **`Table.headerBg: '#f1f3ff'` trong theme token bị `design-system.css` override đè bằng gradient** `linear-gradient(135deg, #0e3a6e, #005daa)` qua `!important` — hai nguồn định nghĩa cùng một thuộc tính, nguồn CSS thắng. Dấu hiệu code có 2 lớp theming chồng nhau (AntD token + CSS override) thay vì một nguồn chân lý duy nhất.

> **[ĐÃ SỬA — B-01]** `design-system.css` hiện dùng `background: var(--surface-container-low)` (phẳng, không gradient) cho `.ant-table-thead`; card dùng `--surface-container-lowest` + `--elev-1` để nổi trên nền thay vì "vô hình". Đã bổ sung `--elev-0..3` và `--card-hairline`.

### 3.5 Pattern trực quan đặc trưng đã định hình

| Pattern | Mô tả | CSS class |
|---|---|---|
| **Gradient table header** | Header bảng luôn có gradient xanh đậm `#0e3a6e → #005daa`, chữ trắng hoa, letter-spacing rộng | `.ant-table-thead` (override global) |
| **Zebra + hover wash** | Hàng lẻ trắng, hàng chẵn `#eef4ff`, hover `#d6e8ff`, cột đầu có thanh accent trái khi hover | `.ant-table-tbody` |
| **Pill tag** | Mọi `Tag` bo tròn hoàn toàn (`border-radius: 9999px`), không viền | `.ant-tag` (override global) |
| **License plate tag** | Biển số luôn hiện trong khung riêng biệt, nền `--info-container`, chữ đậm | `.plate-tag` |
| **Stat card accent bar** | Thẻ số liệu có thanh màu 4px dọc cạnh trái theo semantic (info/success/warning/error) | `.stat-card` + modifier |
| **Dashboard hero banner** | Card gradient tối phủ toàn chiều rộng, có glow tròn mờ góc phải — khác hẳn phần còn lại của trang | `.dashboard-hero` — **[ĐÃ SỬA — B-02/B-04]** Hero banner đã bỏ khỏi cả 2 dashboard mới; KPI dùng class `dashboard-kpi` trung tính, không còn 4 màu accent theo semantic. |
| **Gradient primary button** | Nút primary có gradient + nhấc lên (`translateY(-1px)`) + shadow xanh khi hover | `.ant-btn-primary` |
| **Sidebar tối cố định** | 240px, nền `--inverse-surface` (#283042), menu item bo góc nổi khi active | `.app-sidebar` |

---

## 4. Kiến trúc khung UI (App Shell)

`MainLayout.tsx` **không dùng AntD `Layout`/`Sider`/`Header`** — tự dựng bằng 3 vùng CSS thuần:

```
┌─────────────┬──────────────────────────────────────┐
│             │  Header (64px, sticky top)             │
│  Sidebar    │  logo · —— · clock · lang · user menu  │
│  (240px,    ├──────────────────────────────────────┤
│  fixed,     │                                        │
│  dark)      │  Content (margin-left: 240px,          │
│             │  padding: 32px)                        │
│             │  <Outlet />                             │
└─────────────┴──────────────────────────────────────┘
```

- **Sidebar**: `position: fixed`, không có nút thu gọn/hamburger, không đổi trên màn hình hẹp — đây là gap responsive lớn nhất (xem §9).
- **Header**: logo + tên app bên trái; đồng hồ sống (cập nhật mỗi giây, `setInterval`) + toggle ngôn ngữ (`Segmented` cờ VN/EN) + dropdown user (avatar chữ cái đầu, vai trò, Hồ sơ, Đăng xuất) bên phải.
- **Menu**: `AntD Menu mode="inline" theme="dark"`, item được build động theo hàm `canSee(key)` đọc từ `localStorage` (cấu hình phân quyền staff) — đồng bộ giữa các tab qua việc **tự bắn `storage` event thủ công** (pattern hơi khác thường, vì event `storage` chuẩn chỉ bắn cross-tab tự nhiên, ở đây được dispatch thủ công trong cùng tab).
- **Không có breadcrumb** — điều hướng hoàn toàn dựa vào sidebar, các trang con sâu (VD: chi tiết ngoại lệ trong Reports) không có đường quay lại theo path.
  **[ĐÃ SỬA — B-09]** `components/PageHeader.tsx` (mới) render `Breadcrumb` + tiêu đề trang, map route qua `routeMeta.ts`, dùng ở các trang chính.

> **[ĐÃ SỬA MỘT PHẦN — B-10 / C-11]** Sidebar đã nhóm menu thành `grp-ops` / `grp-catalog` / `grp-admin` (group header, accordion nhớ trạng thái mở) — hết tình trạng 13-15 mục phẳng cùng cấp (B-10). Tuy nhiên **chưa có** nút thu gọn 240px→64px hay Drawer cho màn hình hẹp (C-11) — theo quyết định D-3, phần responsive/collapse bị hạ ưu tiên, thay vào đó có banner cảnh báo dưới 1024px (xem T-13, đã làm — `DesktopOnlyBanner.tsx`).

---

## 5. Kiểm kê chi tiết từng màn hình

### 5.1 Nhóm Xác thực

#### Login (`pages/Login.tsx`)
- Card căn giữa toàn màn hình (`.login-page`, gradient tối nền), form dọc đơn giản, input icon prefix, nút submit cao 48px full-width.
- Có toggle ngôn ngữ riêng (khác markup với header).
- **Không có**: "remember me", "quên mật khẩu", CAPTCHA/khoá tài khoản sau N lần sai (dù `ActivityLogs` có ghi nhận field liên quan).
- Logo/gradient viết **inline style hardcode** thay vì dùng CSS class.
- Branding hiển thị "**ParkManager**" (tiếng Anh) — không khớp tên "Quản lý bãi đỗ xe" / "PSM" dùng ở mọi nơi khác.

### 5.2 Nhóm Vận hành (Quản lý ra vào)

#### Dashboard (`pages/Dashboard.tsx`)
- Hero banner gradient tối (đồng hồ lấp đầy dạng `Progress type="dashboard"`) → 4 KPI card có accent bar → 2 card insight thông minh (so sánh tuần, giờ cao điểm, gợi ý) → biểu đồ xu hướng 7 ngày (LineChart 2 trục) → 2 cột (lấp đầy theo khu / cảnh báo ưu tiên) → bảng xe đang trong bãi → 2 biểu đồ nhỏ (giờ hôm nay, cơ cấu loại xe 30 ngày).
- Tự động làm mới mỗi 90 giây (`setInterval`), có nút refresh thủ công + hiển thị "cập nhật lúc".
- Trang **dày đặc thông tin nhất** trong app — hero + 4 KPI + 2 insight card + 4 biểu đồ + 2 bảng, tất cả trên 1 trang cuộn dọc, không tab/phân đoạn.

> **[ĐÃ SỬA — D-1/T-05, A-01, B-02/B-04/B-05]** Toàn bộ mô tả trên là as-is cũ. `Dashboard.tsx` nay chỉ là router mỏng theo `role`, render `pages/dashboard/OpsDashboard.tsx` (staff, focal = tỷ lệ lấp đầy) hoặc `MgmtDashboard.tsx` (admin mặc định, có Segmented đổi sang view Vận hành). Hero banner đã bỏ; đồng hồ hợp nhất qua `hooks/useClock.ts` dùng chung (hết 3 đồng hồ lệch nhau — A-01); chart xu hướng đã tách thành 2 LineChart 1 trục riêng thay vì trục kép (B-05). **Còn thiếu**: chưa có 1 bộ chọn kỳ áp dụng toàn trang Mgmt — mỗi khối vẫn ghi kỳ riêng trong tiêu đề (B-03, sửa một phần); điểm "hôm nay" trên chart xu hướng chưa có ký hiệu partial-data (A-05, chưa sửa).

#### Xe vào (`pages/ParkingEntry.tsx`)
- Layout 2 cột: form nhập (trái, 14/24) — thông tin/gợi ý thông minh + chỗ trống (phải, 10/24). Bảng "xe đang trong bãi" full-width bên dưới.
- Smart auto-fill: nhập biển số → card khách quen + auto-chọn chỗ đỗ gợi ý (tính năng mới).
- Validate biển số bằng regex cứng `^\d{2}[A-Z]\d{4,5}$` — đã biết là **không khớp một số định dạng biển số thật** (VD `51H4-23456`) dù logic backend vẫn chấp nhận — lỗi hiển thị validate nhưng không chặn submit thực sự (xem note trong lịch sử làm việc trước).
  **[ĐÃ SỬA — C-13]** Regex đã nới thành `/^(\d{2}[A-Z]{1,2}\d{4,6}|[A-Z]{2}\d{3,5})$/` kèm `normalizePlate()` bỏ dấu gạch/khoảng trắng trước khi validate — khớp được `51H4-23456`.

#### Xe ra (`pages/ParkingExit.tsx`)
- Bảng danh sách xe đang đỗ (filter theo khu/loại xe/segment xe tháng-vãng lai) → Modal xác nhận xe ra (preview phí, toggle "Checkout ngoại lệ") → Modal biên nhận (in) → Modal gợi ý gói (mới, sau khi checkout).
- Hàng "xe tháng" được tô nền xanh nhạt riêng (`.exit-row-monthly`) — pattern tô hàng theo trạng thái nghiệp vụ, tương tự CustomerPackages nhưng không đồng nhất về cách đặt tên class.

#### Lịch sử (`pages/ParkingHistory.tsx`)
- Card tra cứu theo biển số (riêng) + Card bảng lịch sử full-filter (ngày, biển số, khu, loại xe, search) — **phân trang server-side** (mới sửa, trước đó tải hết ~39.000 dòng).

### 5.3 Nhóm Hạ tầng & Danh mục

#### Bãi đỗ xe (`pages/ParkingSpots.tsx`)
- **Pattern độc đáo nhất app**: grid card khu vực ở đầu trang (`Row/Col xs={24} sm={12} lg={6}` — một trong số ít nơi có breakpoint responsive rõ ràng), click vào card để lọc (toggle chọn/bỏ chọn) — nhưng đồng thời toolbar bên dưới **cũng có Select lọc khu riêng** → 2 điểm điều khiển cho cùng 1 filter, không đồng bộ trực quan.
  **[CHƯA SỬA — C-07]** Vẫn còn 2 điểm điều khiển filter khu (card click + Select) chưa hợp nhất.
- 2 Tab (Chỗ đỗ / Khu vực), mỗi tab bảng riêng.
- Trạng thái chỗ dùng `Badge status+text` (tốt, có cả màu và chữ), nhưng cấp khu vực lại dùng `Tag className="chip-*"` — 2 ngôn ngữ hiển thị khác nhau cho cùng khái niệm available/occupied.
  **[ĐÃ SỬA MỘT PHẦN — C-02]** `components/StatusTag.tsx` đã được tạo và dùng ở `CustomerPackages.tsx`, nhưng `ParkingSpots.tsx` vẫn còn dùng `Badge`/`Tag chip-*` như mô tả — chưa áp dụng `StatusTag` ở đây.

#### Loại xe (`pages/VehicleTypes.tsx`)
- Bảng đơn giản + Modal Sửa/Thêm. **Mới bổ sung**: nút "Lịch sử giá" + "Đặt lịch đổi giá" (đặt hiệu lực tương lai) — 2 Modal phụ mới, UI nhất quán với bảng chính.

#### Gói dịch vụ (`pages/Packages.tsx`)
- Tương tự VehicleTypes, có thêm Segmented ẩn/hiện gói ngừng áp dụng. Cùng cặp nút "Lịch sử giá"/"Đặt lịch đổi giá" mới.
- **Chưa có import Excel** (khác với Customers/Vehicles/CustomerPackages đã có) — gap đã ghi nhận, sẽ bổ sung.

### 5.4 Nhóm Khách hàng & Phương tiện

#### Khách hàng (`pages/Customers.tsx`)
- Toolbar (search + status filter + reset) → Table → Modal CRUD. Có nút Import Excel + Thêm khách hàng.
- Xoá thực chất là **soft-deactivate** nhưng icon/style dùng `DeleteOutlined` màu nguy hiểm — dễ hiểu nhầm là xoá vĩnh viễn.
- Dùng `Popconfirm` cho xác nhận xoá (khác Users/ParkingSpots dùng `Modal.confirm` đầy đủ hơn).

#### Phương tiện (`pages/Vehicles.tsx`)
- Nhiều filter hơn Customers (khách hàng, loại xe, trạng thái đỗ). Biển số tự chuẩn hoá real-time khi gõ (viết hoa, bỏ dấu gạch/chấm) — chi tiết UX tốt.
- Import Excel có kèm **reference sheet** (danh sách khách hàng/loại xe để copy giá trị đúng) — pattern import tốt nhất trong app.

### 5.5 Nhóm Quản trị (chỉ Admin)

#### Người dùng (`pages/Users.tsx`)
- 2 Tab: Danh sách user (CRUD chuẩn) + **Ma trận phân quyền màn hình cho Staff** — bảng HTML thuần tự dựng (không dùng AntD Table), có `Radio.Group` dạng nút (Ẩn/Xem/Đầy đủ) mỗi dòng, nút "set-all" hàng loạt, lưu nháp rồi mới "Lưu".
- **Đây là nơi tập trung hardcode màu nhiều nhất app**: gradient header riêng `#0e3a6e→#1677ff` (khác `--primary` #005daa!), nhiều hex rời rạc (`#52c41a`, `#d9d9d9`, `#ff4d4f`...) — lệch hẳn khỏi design token.
  **[ĐÃ SỬA — C-01]** Không còn literal hex trong `Users.tsx` — đã chuyển sang dùng CSS variable.
- Điểm hay: dòng của chính user đang đăng nhập bị disable nút Sửa/Xoá (tự bảo vệ).

#### Thanh toán (`pages/Payments.tsx`)
- Trang **chỉ đọc** duy nhất — không Modal, không CRUD, chỉ filter + bảng + xuất Excel. Không có cách sửa/huỷ giao dịch từ UI (có thể chủ đích vì lý do kiểm toán, nhưng đáng nêu ra để xác nhận).
- Tag phương thức thanh toán dùng **3 cách khác nhau** cho 3 giá trị: tiền mặt → class `.chip-available`, chuyển khoản → `color="purple"` hardcode, thẻ → Tag mặc định xám.
  **[CHƯA SỬA — C-02]** `Payments.tsx` vẫn dùng `Tag` thô, chưa chuyển sang `StatusTag` dùng chung.

#### Cảnh báo (`pages/Alerts.tsx`)
- 3 Statistic card (nguy hiểm/cảnh báo/thông tin) → filter đa dạng (khoảng thời gian preset, mức độ, loại) → bảng. Badge "Smart" tím cho cảnh báo rule-based mới, kèm dòng gợi ý hành động + context nhỏ.

#### Báo cáo (`pages/Reports.tsx`, 754 dòng — trang nặng nhất)
- Toolbar có **nút pill tự chế** cho quick-range (Tháng này/Quý này/Năm nay/2025/2024/Toàn bộ) — tự dựng `<button>` với style inline thay vì dùng `Segmented`/`Radio.Group` sẵn có của chính AntD (mà trang này vẫn dùng `Radio.Group` cho toggle loại biểu đồ vài dòng bên dưới — mâu thuẫn ngay trong cùng file).
  **[CHƯA SỬA — C-06]** Vẫn là `<button>` tự dựng, chưa chuyển sang `Segmented`.
- 6 KPI card → biểu đồ doanh thu (Bar/Line/Area chọn được) + Pie loại xe → Pie phương thức thanh toán + Bar giờ cao điểm + RadialBar tỷ lệ → bảng chi tiết doanh thu → khối thống kê ngoại lệ (3 tile + pie + 2 bảng).
- **Mật độ hardcode màu cao nhất app**: mảng `CHART_COLORS`, map `METHOD_COLORS`, hàng chục hex rời rạc lặp lại thay vì CSS variable.
  **[ĐÃ SỬA — C-01]** Không còn literal hex trong `Reports.tsx`.
- Dropdown "Xuất báo cáo" gộp Excel/CSV/Print-PDF, nhưng phần thống kê ngoại lệ lại có **thêm 1 nút "Xuất Excel" riêng** — trùng lặp điểm vào cho cùng nhóm dữ liệu.
  **[ĐÃ SỬA — C-07]** Đã gộp về 1 `Dropdown` xuất duy nhất.
- **Chưa có bước xem trước (preview) khi xuất** — tải file trực tiếp, đã ghi nhận là task cần bổ sung.

#### Nhật ký hoạt động (`pages/ActivityLogs.tsx`)
- Cấu trúc 3 tầng: Statistic card tổng quan (dùng đúng CSS var, hiếm hoi) → Card filter → bảng phân trang server-side.
- Hàng đăng nhập thất bại tô đỏ nhạt qua **`<style>` tag chèn trực tiếp trong component** (không phải class trong file CSS chung) — pattern khác lạ so với phần còn lại của app.
  **[ĐÃ SỬA — C-10/§7.10]** Không còn `<style>` inject trong `ActivityLogs.tsx`.
- Có 2 kiểu export tự viết riêng (CSV thủ công build blob, Excel qua `xlsx`) — không dùng chung `utils/reportExport.ts` như Reports.tsx.
  **[CHƯA SỬA — C-10/§7.11]** Vẫn tự viết logic export XLSX riêng, chưa dùng chung `reportExport.ts`.

#### Phân tích & Gợi ý (`pages/Analytics.tsx`, mới)
- Segmented chọn kỳ (tháng/quý/năm) → 5 Statistic card → 2 biểu đồ (Bar theo thứ, Line theo giờ) → bảng hiệu quả khu vực (có `Progress` màu theo ngưỡng) → Collapse các "gợi ý quyết định" (mỗi thẻ: câu hỏi, phân tích, bảng phương án/tác động/rủi ro). UI mới nhất, nhất quán tốt với phần còn lại.

> **[CẬP NHẬT SAU REMEDIATION]** — B-07 **[ĐÃ SỬA]**: hàng 5 KPI card kiểu cũ đã được thiết kế lại (không còn dàn 5 card 1 hàng tràn mép). B-08 **[ĐÃ SỬA]**: cột bảng "Hiệu quả theo khu vực" nay có `width`/`ellipsis`/`align:'right'` rõ ràng. A-04 **[ĐÃ SỬA]**: `Progress` dùng màu theo ngưỡng (đỏ/cam/xanh) và đã bỏ icon ✓ mâu thuẫn màu đỏ. B-06 **[CHƯA SỬA]**: Segmented chọn kỳ vẫn nằm trong `Card` riêng, chưa chuyển vào action của `PageHeader` — vẫn tốn khoảng trắng. A-03 **[CHƯA SỬA]**: trường hợp khu 100% lấp đầy nhưng doanh thu 0đ vẫn chưa có chú thích giải thích trên UI.

#### Hồ sơ cá nhân (`pages/Profile.tsx`)
- 2 Card cạnh nhau (thông tin + đổi mật khẩu), đơn giản nhất app. Không có upload ảnh đại diện (toàn app chỉ dùng avatar chữ cái đầu).

### 5.6 Component dùng chung

#### `ImportModal.tsx` — điểm sáng về tái sử dụng
- 1 component phục vụ import Excel cho Customers/Vehicles/CustomerPackages: tải template có sẵn sheet hướng dẫn + sheet "lựa chọn hợp lệ" → kéo-thả file → preview 10 dòng đầu (đánh dấu đỏ ô thiếu dữ liệu bắt buộc) → import → báo cáo kết quả kèm danh sách lỗi.
- Modal tự đổi độ rộng theo trạng thái (520px → 900px khi có preview) — chi tiết nhỏ nhưng tinh tế.
- Nhưng: **100% chuỗi hiển thị hardcode tiếng Việt, không qua `t()`** — nếu đây là component dùng chung nhiều nơi thì đây là điểm hở i18n có tác động rộng nhất.
  **[ĐÃ SỬA — T-14]** `ImportModal.tsx` nay gọi `t()` (36 lần), không còn hardcode hoàn toàn.

---

## 6. Pattern đang nhất quán (điểm mạnh)

Để phần góp ý không chỉ toàn điểm trừ — đây là những gì đang làm tốt và nên **giữ lại/nhân rộng**:

- **Token hoá màu/spacing/radius bài bản ở tầng CSS gốc** — nền tảng tốt, vấn đề là thực thi chưa triệt để.
- **`.plate-tag`** cho biển số được dùng nhất quán ở mọi nơi hiển thị biển số (ParkingEntry, ParkingExit, ParkingHistory, Vehicles, CustomerPackages, Payments, Reports).
- **Bảng gradient header + zebra + hover accent** đồng nhất tuyệt đối trên mọi Table trong app (vì override global, không phải per-page).
- **`ImportModal` tái sử dụng đúng nghĩa** — 1 component, nhiều trang, giảm trùng lặp.
- **Cascading filter trong CustomerPackages** (Khách hàng → lọc Xe → lọc Gói theo loại xe xe đó) dùng `Form.useWatch` — progressive disclosure tốt.
- **Giải thích ngữ cảnh trước hành động khó hiểu**: modal Gia hạn gói có callout màu vàng giải thích rõ điều gì sẽ xảy ra; modal Checkout ngoại lệ cảnh báo trước khi bật.
- **Tự bảo vệ khỏi lỗi thao tác**: user không tự xoá/sửa được chính mình ở trang Users.
- **Badge trạng thái luôn kèm chữ, không chỉ màu** (đa số nơi) — tốt cho khả năng tiếp cận với người mù màu.

---

## 7. Vấn đề & sự thiếu nhất quán (tổng hợp theo nhóm)

### 7.1 Màu sắc hardcode thay vì dùng CSS variable

Mức độ nghiêm trọng tăng dần: Payments (1 chỗ) → CustomerPackages (vài callout) → ImportModal (toàn bộ palette phụ) → **Reports.tsx và Users.tsx là nặng nhất** — hàng chục hex rời rạc, thậm chí Users.tsx dùng một **cặp gradient xanh khác** (`#0e3a6e→#1677ff`) không trùng `--primary` (#005daa) ở bất kỳ đâu khác trong app. Rủi ro: đổi màu thương hiệu sau này phải sửa tay từng file thay vì 1 chỗ.

> **[ĐÃ SỬA — C-01]** Không còn literal hex trong `Reports.tsx` và `Users.tsx` (2 nơi nặng nhất, đã kiểm tra lại code hiện tại).

### 7.2 Hiển thị trạng thái không đồng nhất

Cùng một khái niệm "còn trống/đang dùng" hoặc "loại giao dịch" được thể hiện bằng **≥4 cách khác nhau** tuỳ trang:
- `Badge status+text` (ParkingSpots — chỗ đỗ)
- `Tag className="chip-*"` (ParkingSpots — khu vực; Payments — tiền mặt)
- `Tag color="..."` hardcode (Payments — chuyển khoản)
- `Tag` mặc định không màu (Payments — thẻ; Customers)
- Emoji trong text option của `Select` (CustomerPackages status filter: ✅⏳🔴⛔) — không nơi nào khác trong app dùng emoji cho filter.

> **[ĐÃ SỬA MỘT PHẦN — C-02]** Component `StatusTag` (`components/StatusTag.tsx`) đã được tạo và áp dụng ở `CustomerPackages.tsx`. Nhưng `ParkingSpots.tsx` vẫn `Badge`/`Tag chip-*`, `Payments.tsx` vẫn `Tag` thô 3 kiểu khác nhau, và emoji trong `Select` của CustomerPackages vẫn còn — chưa thay thế đồng loạt.

### 7.3 Xác nhận xoá/hành động nguy hiểm không đồng nhất

`Popconfirm` (Customers, Vehicles) vs `Modal.confirm` (Users, ParkingSpots, ParkingPackages) — 2 pattern UX khác nhau cho cùng hành động "xác nhận trước khi xoá", không rõ tiêu chí chọn cái nào.

> **[ĐÃ SỬA — C-03]** Đã thống nhất về `Popconfirm` cho các hành động xoá (Customers/Vehicles/VehicleTypes...); không còn dùng `Modal.confirm` cho xoá.

### 7.4 Cách xử lý nút bị ẩn theo quyền không đồng nhất

- Customers/Vehicles: **ẩn hẳn nút** nếu không đủ quyền.
- ParkingSpots/CustomerPackages: **hiện Tag giải thích** ("Chỉ quản trị được sửa") thay chỗ nút.

Cả 2 đều hợp lý riêng lẻ, nhưng không nhất quán giữa các trang cùng loại (đều là bảng CRUD có phân quyền).

> **[ĐÃ SỬA — C-04]** Đã có component `PermissionGate` dùng chung, áp dụng ở Customers/Vehicles/CustomerPackages.

### 7.5 Kiến trúc filter không đồng nhất

- Đa số trang (Customers, Vehicles, ParkingHistory, CustomerPackages...): filter qua **query param gửi server**, `useEffect` khi filter đổi.
- Users.tsx: filter **hoàn toàn client-side** trên dữ liệu đã tải hết.

Không nhất quán về nơi xử lý dữ liệu, ảnh hưởng hiệu năng nếu bảng Users lớn dần.

> **[CHƯA SỬA]** `Users.tsx` vẫn filter client-side bằng `.filter()` trên dữ liệu đã tải hết.

### 7.6 Control tự chế thay vì dùng component AntD sẵn có

Reports.tsx tự dựng nút pill quick-range bằng `<button>` + inline style, trong khi cùng file vẫn dùng `Radio.Group` chuẩn cho việc khác — không có lý do kỹ thuật rõ ràng để không dùng `Segmented`/`Radio.Group` cho cả hai.

> **[CHƯA SỬA — C-06]** Vẫn là `<button>` tự dựng, chưa chuyển sang `Segmented`.

### 7.7 Trùng lặp điểm vào cho cùng 1 hành động

- ParkingSpots: filter khu vực có **2 điểm điều khiển** (card click + Select) không đồng bộ trực quan với nhau.
- Reports: nút "Xuất báo cáo" tổng + nút "Xuất Excel" riêng cho phần ngoại lệ.
- Login + MainLayout: 2 UI chuyển ngôn ngữ độc lập, markup khác nhau.

> **[ĐÃ SỬA MỘT PHẦN — C-07]** Reports: 2 nút xuất đã gộp về 1 `Dropdown` (đã sửa). Ngôn ngữ: chỉ còn 1 UI chuyển ngôn ngữ ở `MainLayout.tsx` (đã sửa). ParkingSpots: **vẫn còn** 2 điểm điều khiển filter khu vực (chưa sửa).

### 7.8 Branding không nhất quán

"ParkManager" (Login, tiếng Anh) vs "Quản lý bãi đỗ xe" (title, header) vs "**PSM**" (logo text sidebar, viết tắt không giải thích ở đâu — có thể là "Parking System Management"?) — 3 tên gọi khác nhau cho cùng 1 sản phẩm.

> **[CHƯA SỬA — C-08]** `translations.ts`, `index.html`, `manifest.json`, `Login.tsx` vẫn còn lẫn "Quản lý bãi đỗ xe" và "PSM"/"Parking Management System" — chưa chốt 1 tên (xem Q8 trong remediation plan).

### 7.9 Thiếu branding assets

Không có `favicon.ico`, không có `manifest.json`, không có logo file nào trong `public/` — tab trình duyệt hiện icon mặc định/trống. (Ghi chú: người dùng đã gửi 1 ảnh icon đề xuất, đang chờ file để áp dụng.)

> **[ĐÃ SỬA — C-09]** `favicon.ico` và `manifest.json` đã có trong `frontend/public/`.

### 7.10 Style injection không chuẩn

ActivityLogs.tsx chèn `<style>` trực tiếp trong component React để style hàng đăng nhập thất bại — nên là 1 class trong `design-system.css` như mọi nơi khác.

> **[ĐÃ SỬA]** Không còn `<style>` inject trong `ActivityLogs.tsx`.

### 7.11 Export logic trùng lặp

`utils/reportExport.ts` được Reports.tsx dùng tốt (tập trung hoá), nhưng ActivityLogs.tsx tự viết lại logic export CSV/Excel riêng thay vì tái sử dụng/mở rộng module chung.

> **[CHƯA SỬA]** `ActivityLogs.tsx` vẫn tự viết logic export XLSX riêng, chưa dùng chung `reportExport.ts`.

---

## 8. Đa ngôn ngữ (i18n) — hạ tầng tốt nhưng phủ không đều

**Đây là phát hiện lớn nhất của tài liệu này.**

- Hạ tầng i18n rất bài bản: `LanguageContext`, `translations.ts` (~210 key × 2 ngôn ngữ), TypeScript ép buộc **parity 100% key** giữa `vi`/`en` (thiếu key bên nào là lỗi compile), `ConfigProvider locale` của AntD cũng đổi theo (DatePicker, pagination text...).
- Nhưng: **thực tế nhiều trang hầu như không gọi `t()`** — string hardcode tiếng Việt thẳng trong JSX:
  - `ImportModal.tsx`: **100% hardcode**, không dịch được dù dùng ở nhiều trang.
  - `Profile.tsx`, `Payments.tsx`, `Reports.tsx` (trừ tiêu đề trang), `CustomerPackages.tsx` (trừ tiêu đề), `ParkingSpots.tsx`: gần như toàn bộ label/nút/status hardcode.
  - `ActivityLogs.tsx`: hỗn hợp — tiêu đề/cột có `t()`, nhưng nhãn action/entity/placeholder hardcode.
  - So sánh: `Login`, `Customers`, `Vehicles`, `Users`, `MainLayout` dùng `t()` khá đầy đủ.
- Hệ quả: **bật "English" chỉ đổi được khung sườn (menu, header) và vài trang**, phần lớn nội dung nghiệp vụ vẫn tiếng Việt — tính năng song ngữ nhìn có vẻ hoàn chỉnh nhưng thực tế nửa vời.
- Thêm: `<html lang="vi">` trong `index.html` không đổi động khi user chuyển English — sai lệch nhỏ nhưng thật về accessibility/SEO.

---

## 9. Responsive & Accessibility

### 9.1 Responsive — gap lớn

- Toàn bộ codebase (`.css` + `.tsx`) chỉ có **1 media query duy nhất** (`@media max-width: 992px` cho riêng dashboard hero banner).
- Sidebar `position: fixed; width: 240px` — **không có nút thu gọn, không có hamburger/Drawer cho mobile**. Trên màn hình hẹp, sidebar sẽ đè/chiếm layout mà không có cơ chế ẩn.
- Đa số trang tự chống chịu bằng `Space wrap` (toolbar tự xuống dòng) hoặc `Row/Col` breakpoint (`xs/sm/lg/xl`) rải rác — không nhất quán, không phải chiến lược responsive chủ đích.
- Ngoại lệ có breakpoint rõ ràng: ParkingSpots (grid khu vực), Reports (Row/Col cho KPI/chart), Profile (flexWrap 2 card).
- **Kết luận**: app hiện được thiết kế **desktop-only trên thực tế**, dù có viewport meta tag chuẩn. Nếu nhân viên cần dùng tablet ở quầy, trải nghiệm sẽ không tốt.

> **[ĐÃ CHỐT HƯỚNG — D-3/T-13, C-11]** Theo quyết định D-3 trong remediation plan, app **chính thức chấp nhận desktop-only** thay vì đầu tư responsive đầy đủ. Đã thêm `DesktopOnlyBanner.tsx` cảnh báo khi viewport < 1024px (đã sửa). Sidebar vẫn fixed-width, chưa có nút thu gọn/Drawer (phần responsive/collapse của C-11 vẫn chưa làm — nhưng nay là chủ đích, không còn là gap ngoài ý muốn).

### 9.2 Dark mode

Không có. `ConfigProvider` chỉ định nghĩa 1 bộ token sáng, không có `algorithm: theme.darkAlgorithm`, không toggle, không lắng nghe `prefers-color-scheme`.

### 9.3 Accessibility — điểm tốt và điểm thiếu

**Tốt:**
- Đa số trạng thái/tag kết hợp cả màu **và** chữ (không chỉ dựa màu để phân biệt) — quan trọng cho người mù màu.
- `Badge status+text` ở ParkingSpots là ví dụ chuẩn.

**Thiếu/chưa rõ:**
- Không thấy `aria-label` tuỳ biến ở các nơi cần (Dragger upload, nút icon-only).
- Bảng dữ liệu dày đặc (Reports, Dashboard) — chưa rõ có tối ưu cho screen reader (thứ tự đọc, `scope` cột) hay không.
- Contrast của text trắng trên gradient nhạt (`dashboard-hero`) nên kiểm tra tỷ lệ WCAG AA, đặc biệt phần opacity thấp (`opacity: 0.85`, `0.78`...).

---

## 10. Câu hỏi gợi ý để nhờ đánh giá

Khi đưa tài liệu này cho Claude chat, có thể hỏi cụ thể:

1. Với bảng màu "Precision Authority" hiện tại, có nên chuẩn hoá lại thành design token layer (VD: style-dictionary hoặc đơn giản là ép mọi component chỉ dùng CSS var, có lint rule chặn hex hardcode) không? Ưu tiên sửa ở đâu trước (Reports/Users là 2 nơi nặng nhất)?
2. Nên gộp các pattern hiển thị trạng thái (`Badge` vs `Tag` vs `Tag+class`) thành 1 component `StatusTag` dùng chung không? Thiết kế API cho nó nên như thế nào?
3. Chiến lược responsive nào phù hợp nhất cho 1 B2B ops tool desktop-first nhưng cần dùng được trên tablet ở quầy — collapse sidebar theo breakpoint, hay Drawer overlay, hay chấp nhận desktop-only và ghi rõ yêu cầu màn hình tối thiểu?
4. Có nên đầu tư hoàn thiện i18n cho toàn bộ trang (đặc biệt `ImportModal` vì dùng nhiều nơi), hay nên rút gọn phạm vi song ngữ lại (chỉ khung sườn) để không tạo cảm giác "nửa vời"?
5. Trang Dashboard và Reports có đang quá dày đặc thông tin so với việc nhân viên cần thao tác nhanh không? Có nên tách bớt thành tab/section thu gọn được?
6. Nút pill tự chế trong Reports.tsx (quick-range) có nên thay bằng `Segmented` chuẩn để nhất quán với phần còn lại của trang không, hay giữ nguyên vì lý do UX riêng (VD: cần layout 6 nút trên 1 hàng mà Segmented không hỗ trợ tốt)?
7. Có cần dark mode cho 1 app vận hành 24/7 (bãi xe có thể có ca đêm) không — nhân viên trực đêm nhìn màn hình sáng liên tục có phải vấn đề thực tế?
8. Đề xuất icon/favicon nào phù hợp thương hiệu, và có nên thống nhất lại tên gọi sản phẩm (ParkManager / Quản lý bãi đỗ xe / PSM → chọn 1) không?

---

## 11. Phụ lục: bảng toàn bộ màn hình

| # | Trang | Route | Vai trò | File |
|---|---|---|---|---|
| 1 | Đăng nhập | `/login` | Public | `Login.tsx` |
| 2 | Tổng quan | `/` | Admin+Staff (nội dung khác nhau) | `Dashboard.tsx` |
| 3 | Xe vào | `/parking/entry` | Admin+Staff | `ParkingEntry.tsx` |
| 4 | Xe ra | `/parking/exit` | Admin+Staff | `ParkingExit.tsx` |
| 5 | Lịch sử | `/parking/history` | Admin+Staff | `ParkingHistory.tsx` |
| 6 | Bãi đỗ xe | `/parking-spots` | Admin (Staff: view tuỳ cấu hình) | `ParkingSpots.tsx` |
| 7 | Khách hàng | `/customers` | Admin+Staff | `Customers.tsx` |
| 8 | Phương tiện | `/vehicles` | Admin+Staff | `Vehicles.tsx` |
| 9 | Loại xe | `/vehicle-types` | Admin (Staff: view) | `VehicleTypes.tsx` |
| 10 | Danh sách gói | `/packages` | Admin (Staff: view) | `Packages.tsx` |
| 11 | Đăng ký gói | `/customer-packages` | Admin+Staff | `CustomerPackages.tsx` |
| 12 | Thanh toán | `/payments` | Admin only | `Payments.tsx` |
| 13 | Cảnh báo | `/alerts` | Admin only | `Alerts.tsx` |
| 14 | Báo cáo | `/reports` | Admin only | `Reports.tsx` |
| 15 | Phân tích & Gợi ý | `/analytics` | Admin only | `Analytics.tsx` |
| 16 | Người dùng | `/users` | Admin only | `Users.tsx` |
| 17 | Nhật ký hoạt động | `/activity-logs` | Admin only | `ActivityLogs.tsx` |
| 18 | Hồ sơ cá nhân | `/profile` | Admin+Staff | `Profile.tsx` |

**Component dùng chung đáng chú ý**: `MainLayout.tsx` (app shell), `ImportModal.tsx` (import Excel), `LanguageContext.tsx` + `translations.ts` (i18n), `permConfig.ts` (phân quyền màn hình staff), `reportExport.ts` (xuất báo cáo).

---

*Tài liệu này mô tả trạng thái hiện tại (as-is), không đưa ra khuyến nghị thiết kế cụ thể — phần đó dành cho phiên đánh giá kế tiếp.*
