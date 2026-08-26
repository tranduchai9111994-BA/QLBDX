# QLBDX — Đánh giá UI/UX & Phương án khắc phục "giao diện rối"

> **Đối tượng đọc**: Frontend Dev, Tech Lead, BA, QA.
> **Nguồn đánh giá**: `UIUX_AUDIT.md` (as-is, đọc từ source) + 2 ảnh chụp thực tế màn hình `Tổng quan` và `Phân tích & Gợi ý` (26/08/2026).
> **Phạm vi**: React 18 + TypeScript + Ant Design 5 + Recharts, `design-system.css` ("Precision Authority").
> **Ngày lập**: 26/08/2026 · Phiên bản: v1.0

---

## Mục lục

1. [Tóm tắt điều hành](#1-tóm-tắt-điều-hành)
2. [Chẩn đoán gốc rễ — vì sao giao diện bị "rối"](#2-chẩn-đoán-gốc-rễ--vì-sao-giao-diện-bị-rối)
3. [Bảng vấn đề chi tiết](#3-bảng-vấn-đề-chi-tiết)
4. [Giải pháp đề xuất theo tầng](#4-giải-pháp-đề-xuất-theo-tầng)
5. [Phương án thực hiện kỹ thuật](#5-phương-án-thực-hiện-kỹ-thuật)
6. [Lộ trình & ước lượng](#6-lộ-trình--ước-lượng)
7. [Acceptance Criteria](#7-acceptance-criteria)
8. [Need Confirm — câu hỏi cần bạn chốt](#8-need-confirm--câu-hỏi-cần-bạn-chốt)

---

## 1. Tóm tắt điều hành

Nền tảng design system của app **tốt hơn mức trung bình** của một B2B ops tool: có tonal palette 5 cấp kiểu M3, spacing/radius token hoá, "No-Line Rule" rõ triết lý, table pattern đồng nhất tuyệt đối, `ImportModal` tái sử dụng đúng nghĩa. Vấn đề **không nằm ở việc thiếu hệ thống, mà ở việc hệ thống không được thực thi và bị chồng thêm quá nhiều lớp "nhấn mạnh"**.

5 phát hiện quan trọng nhất, xếp theo mức ảnh hưởng tới cảm giác "rối":

| # | Phát hiện | Mức độ |
|---|---|---|
| 1 | **Đảo ngược trọng số thị giác**: container (card) gần như vô hình (nền `#fff` trên nền `#f9f9ff`, không viền, shadow ~0), trong khi phần tử ít quan trọng nhất (header bảng) lại là khối đậm nhất màn hình. Người dùng không "đọc" được cấu trúc trang, chỉ thấy các mảng màu rời rạc. | Critical |
| 2 | **Không có phân tầng theo kỳ thời gian**: một màn Dashboard trộn 4 mốc (hôm nay / tuần này vs tuần trước / 7 ngày / 30 ngày) mà không có nhãn nhóm. Người dùng phải tự đối chiếu từng con số thuộc kỳ nào. | Critical |
| 3 | **Trùng lặp & mâu thuẫn dữ liệu hiển thị**: 3 đồng hồ lệch nhau trên cùng 1 màn (13:38:00 / 13:37 / 13:37:30); "20% — 88/110 trống" ở gauge trùng card "Chỗ trống"; "22 xe đỗ >8 giờ" (stat card) vs "22 xe đỗ quá 24 giờ" (gợi ý) — cùng số 22, khác ngưỡng. | Critical |
| 4 | **Hero banner tiêu tốn ~22% chiều cao viewport cho ~1 chỉ số thật** — phần còn lại là lời chào, glow trang trí và 4 nút đã có sẵn trong sidebar. Trong ops tool, above-the-fold là tài nguyên đắt nhất. | High |
| 5 | **IA sidebar phẳng 13 mục top-level, 2 nhóm tự bung** → tổng 15 dòng cùng cấp thị giác, không có group header phân tách Vận hành / Danh mục / Quản trị. | High |

Ngoài ra, các vấn đề đã ghi nhận trong `UIUX_AUDIT.md` (hardcode màu, StatusTag không đồng nhất, i18n nửa vời, responsive gap) vẫn giữ nguyên giá trị và được tích hợp vào roadmap bên dưới.

**Khuyến nghị định hướng**: không redesign. Làm 1 đợt **"visual de-noise"** (giảm số lớp nhấn mạnh, chuẩn hoá elevation & type scale) + **tái cấu trúc nội dung Dashboard theo kỳ thời gian**, giữ nguyên toàn bộ nghiệp vụ và component. Ước lượng 12–16 man-day cho Phase 1+2 (phần tạo ra ~80% cảm nhận cải thiện).

**Quyết định đã chốt (26/08/2026):**

| # | Nội dung | Ảnh hưởng tới phương án |
|---|---|---|
| D-1 | **Tách 2 dashboard theo vai trò** (Vận hành / Quản lý) | Mục 4.3 viết lại; +2 man-day cho P2; giải quyết triệt để B-02, B-03, B-04 |
| D-2 | **Được phép đổi `--surface` và bỏ gradient tối ở header bảng** | Mở khoá 2 thay đổi hiệu quả cao nhất của P1; không cần phương án dự phòng yếu hơn |
| D-3 | **Desktop-only — không cần responsive tablet** | T-13 rút gọn từ ~3 man-day còn ~0.5; đổi mục tiêu thành "an toàn tới 1366px + chặn dưới ngưỡng" |

---

## 2. Chẩn đoán gốc rễ — vì sao giao diện bị "rối"

Cảm giác "rối" hầu như không bao giờ đến từ "nhiều dữ liệu", mà đến từ **nhiều thứ cùng đòi được chú ý**. Định lượng lại màn Tổng quan:

**Đếm số "điểm nhấn thị giác" (elements cạnh tranh sự chú ý) trên 1 viewport:**

| Loại nhấn mạnh | Số lượng trên màn Tổng quan | Nhận xét |
|---|---|---|
| Khối nền tối/gradient đậm | 2 (sidebar 240px + hero banner) | Cùng tông xanh đậm nhưng khác gradient |
| Accent bar màu semantic | 4 (xanh dương / xanh lá / cam / đỏ) | 4 KPI = 4 màu ⇒ đọc như 4 mức cảnh báo, không phải 4 chỉ số |
| Callout có nền màu | 3 (xanh info + 2 vàng warning) | Khối "Gợi ý thông minh" |
| Icon màu inline trong text | ~10 (🚗 💲 ⚡ 📍 ⚠ ↗ ↘ 🌅 🌇 …) | Trộn icon AntD + emoji |
| Nút primary gradient | 4 trong hero | Trùng chức năng với sidebar |
| Số liệu cỡ lớn (≥1.5rem) | 5 (gauge 20% + 4 KPI) | Không có 1 con số nào là "chỉ số chủ đạo" |

⇒ **Không có focal point.** Mắt không biết đọc từ đâu. Trong ops tool, quy tắc thực dụng là **tối đa 1 khối "đậm" và 1 con số "chủ đạo" trên mỗi viewport**; phần còn lại phải hạ tông xuống nền.

**5 nguyên nhân kỹ thuật đứng sau:**

| Mã | Nguyên nhân | Bằng chứng |
|---|---|---|
| RC-1 | Không có **elevation scale** — chỉ có 2 shadow (`ambient` cực nhẹ, `float`). Card, section, page cùng một mức ⇒ không phân biệt được "nhóm" và "phần tử". | `design-system.css` §3.2 |
| RC-2 | Không có **type scale** hệ thống hoá (`0.72rem / 0.875rem / 1.5rem / 1.75rem` rải rác). Không có quy ước "cỡ nào = cấp nào" ⇒ mỗi trang tự quyết định. | `UIUX_AUDIT.md` §3.3 |
| RC-3 | **Màu semantic bị dùng để định danh** thay vì báo trạng thái (4 accent bar cho 4 KPI trung tính). Khi màu đỏ/cam xuất hiện ở nơi không có vấn đề gì, người dùng mất khả năng "quét cảnh báo". | Ảnh 1, hàng stat card |
| RC-4 | **2 lớp theming chồng nhau** (AntD token + CSS `!important`) ⇒ mỗi lần muốn hạ tông một thành phần phải sửa 2 nơi, nên Dev có xu hướng… thêm inline style. Đây chính là nguồn của 7.1/7.6/7.10. | `UIUX_AUDIT.md` §3.4 |
| RC-5 | **Không có tầng layout primitive** (`PageHeader`, `Section`, `StatGrid`, `FilterBar`). Mỗi trang tự bố cục ⇒ padding/khoảng cách/tiêu đề khác nhau giữa các trang. | So sánh ảnh 1 vs ảnh 2: ảnh 2 có `<h1>` trong content, ảnh 1 không có |

---

## 3. Bảng vấn đề chi tiết

Mức độ: **P0** = gây hiểu sai dữ liệu / chặn công việc · **P1** = gây rối, giảm tốc độ thao tác · **P2** = nợ kỹ thuật/nhất quán.

### 3.1 Nhóm A — Dữ liệu hiển thị sai/mâu thuẫn (P0)

| ID | Màn hình | Vấn đề (bằng chứng từ ảnh) | Mức |
|---|---|---|---|
| A-01 | Tổng quan | **3 đồng hồ lệch nhau**: header `13:38:00`, hero `13:37`, chip nổi giữa hero `13:37:30`. 3 `setInterval` độc lập, khác chu kỳ. Người dùng thấy hệ thống "không đáng tin". | P0 |
| A-02 | Tổng quan | **Ngưỡng mâu thuẫn cùng một số**: card "Xe đang đỗ" ghi `22 xe đỗ >8 giờ`; callout gợi ý ghi `Có 22 xe đỗ quá 24 giờ`. Một trong hai sai, hoặc 2 chỗ dùng 2 config ngưỡng khác nhau. | P0 |
| A-03 | Phân tích | **Khu D: tỷ lệ lấp đầy 100% (thanh đỏ full + icon check) nhưng Doanh thu 0đ và DT/chỗ 0đ**. Hoặc dữ liệu sai, hoặc 100% là "xe tháng không phát sinh giao dịch" — UI không giải thích. | P0 |
| A-04 | Phân tích | **Thanh Progress 100% màu đỏ kèm icon ✓ xanh** — 2 tín hiệu ngược chiều trên cùng 1 ô. Đỏ = xấu hay = đầy (tốt)? Không có legend. | P0 |
| A-05 | Tổng quan | Chart "Xu hướng 7 ngày": điểm cuối (25-08, hôm nay) rớt gần 0 vì **ngày chưa kết thúc** nhưng không có ký hiệu partial-data ⇒ đọc như "sập lưu lượng". | P1 |

### 3.2 Nhóm B — Cấu trúc thông tin & trọng số thị giác (P1, nguồn chính của "rối")

| ID | Màn hình | Vấn đề | Mức |
|---|---|---|---|
| B-01 | Toàn app | Card không viền + nền `#fff` trên `#f9f9ff` (ΔL rất nhỏ) ⇒ ranh giới nhóm không đọc được; trong khi header bảng gradient `#0e3a6e→#005daa` chữ trắng hoa là khối đậm nhất màn hình. **Trọng số thị giác đảo ngược.** | P1 |
| B-02 | Tổng quan | Hero banner ~200px (≈22% viewport) chứa: lời chào, 3 dòng meta, 4 nút trùng sidebar, glow trang trí — chỉ **1 chỉ số thật** (gauge 20%), mà gauge này **trùng** card "Chỗ trống 88/110". | P1 |
| B-03 | Tổng quan | Trộn 4 kỳ thời gian không nhãn nhóm: *hôm nay* (4 KPI), *tuần này vs tuần trước*, *30 ngày* (giờ cao điểm, loại xe), *7 ngày* (chart). | P1 |
| B-04 | Tổng quan | 4 KPI dùng 4 màu accent khác nhau cho các chỉ số **trung tính** ⇒ mất khả năng dùng màu để quét cảnh báo (RC-3). | P1 |
| B-05 | Tổng quan | Chart "Xu hướng 7 ngày" dùng **trục kép** (Lượt xe 0–100 trái, Doanh thu 0–10.000k phải). Hai đường cắt nhau ở nhiều điểm mà **không có quan hệ định lượng thật** — anti-pattern kinh điển. | P1 |
| B-06 | Phân tích | Band filter chiếm ~90px chiều cao cho **duy nhất 1 Segmented 3 lựa chọn**; phần còn lại là khoảng trắng. | P1 |
| B-07 | Phân tích | **5 KPI card ép trên 1 hàng bị tràn mép phải** (card "Tỷ lệ lấp đầy hiện tại" bị cắt) ở độ rộng viewport thực tế. | P1 |
| B-08 | Phân tích | Bảng "Hiệu quả theo khu vực": cột `KHU VỰC` rộng ~400px chỉ chứa "Khu A"; cột `TỔNG CHỖ` bị bó xuống 2 dòng. Không set `width`/`ellipsis` ⇒ AntD chia đều theo nội dung header. | P1 |
| B-09 | Toàn app | **Không có breadcrumb / page title chuẩn**: header luôn hiển thị tên app "Quản lý bãi đỗ xe" thay vì tên trang hiện tại. Ảnh 2 có `<h1>` trong content, ảnh 1 không ⇒ 2 pattern tiêu đề trang. | P1 |
| B-10 | Sidebar | 13 mục top-level + 2 nhóm tự bung = **15 dòng cùng cấp thị giác**, không group header, không nút thu gọn. | P1 |
| B-11 | Tổng quan | Chart cột theo thứ / theo giờ: **không có value label, không highlight giá trị max**, buộc người dùng ước lượng theo lưới. Trục giờ 24 nhãn `0h…23h` san sát. | P2 |

### 3.3 Nhóm C — Nhất quán & nợ kỹ thuật (P2, đã nêu trong audit gốc, giữ nguyên)

| ID | Vấn đề | Tham chiếu audit |
|---|---|---|
| C-01 | Hardcode hex thay vì CSS var (nặng nhất: `Reports.tsx`, `Users.tsx`; `Users.tsx` còn dùng gradient `#0e3a6e→#1677ff` khác `--primary`) | §7.1 |
| C-02 | ≥4 cách hiển thị trạng thái (`Badge` / `Tag.chip-*` / `Tag color` / `Tag` mặc định / emoji trong `Select`) | §7.2 |
| C-03 | `Popconfirm` vs `Modal.confirm` cho cùng hành động xoá | §7.3 |
| C-04 | Nút bị chặn quyền: ẩn hẳn (Customers/Vehicles) vs hiện Tag giải thích (ParkingSpots/CustomerPackages) | §7.4 |
| C-05 | Filter server-side (đa số) vs client-side (`Users.tsx`) | §7.5 |
| C-06 | Nút pill tự chế trong `Reports.tsx` thay vì `Segmented` | §7.6 |
| C-07 | Trùng điểm vào: filter khu 2 chỗ (ParkingSpots), 2 nút xuất Excel (Reports), 2 UI đổi ngôn ngữ | §7.7 |
| C-08 | Branding 3 tên: ParkManager / Quản lý bãi đỗ xe / PSM; thiếu favicon & manifest | §7.8, §7.9 |
| C-09 | `<style>` inject trong `ActivityLogs.tsx`; logic export trùng lặp không dùng `reportExport.ts` | §7.10, §7.11 |
| C-10 | i18n phủ ~50% — `ImportModal` hardcode 100% dù dùng chung nhiều trang; `<html lang>` không đổi động | §8 |
| C-11 | 1 media query duy nhất toàn codebase; sidebar `fixed 240px` không thu gọn | §9.1 |
| C-12 | Xoá thực chất là soft-deactivate nhưng dùng `DeleteOutlined` màu nguy hiểm (Customers) | §5.4 |
| C-13 | Regex biển số `^\d{2}[A-Z]\d{4,5}$` không khớp định dạng thật (VD `51H4-23456`) | §5.2 |

---

## 4. Giải pháp đề xuất theo tầng

Nguyên tắc xuyên suốt: **"Chi tiêu độ đậm ở đúng một chỗ"** — mỗi viewport có 1 khối đậm nhất và 1 con số chủ đạo; mọi thứ khác hạ tông.

### 4.1 Tầng nền tảng — Design token (giải quyết RC-1, RC-2, RC-3, B-01)

**(a) Bổ sung elevation scale 3 cấp** thay cho 2 shadow hiện tại. Card phải "nhìn thấy được" mà không cần viền đậm:

```css
/* design-system.css — thêm vào :root */
--elev-0: none;                                            /* nền trang */
--elev-1: 0 1px 2px rgba(19,27,44,.04),
          0 1px 3px rgba(19,27,44,.06);                    /* card mặc định */
--elev-2: 0 4px 12px rgba(19,27,44,.08);                   /* card hover / popover */
--elev-3: 0 12px 32px rgba(19,27,44,.14);                  /* modal / drawer */

/* Tăng tương phản card↔nền: hạ nền trang, giữ card trắng */
--surface: #f4f6fb;          /* thay #f9f9ff — ΔL đủ để card nổi tự nhiên */
--card-hairline: rgba(19,27,44,.06);   /* hairline 1px thay cho "no-line" tuyệt đối */
```

> **Điều chỉnh triết lý "No-Line Rule"**: giữ tinh thần (không viền đậm) nhưng cho phép **hairline 1px ở mức 6% opacity**. Đây là cách Linear/Stripe làm — vẫn "không viền" về cảm nhận nhưng nhóm được nội dung.

**(b) Định nghĩa type scale chính thức** (hiện đang thiếu hoàn toàn):

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--fs-display` | `1.75rem / 700 / -0.02em` | Con số chủ đạo duy nhất của trang |
| `--fs-metric` | `1.375rem / 650` | KPI card value |
| `--fs-h1` | `1.25rem / 600` | Tiêu đề trang |
| `--fs-h2` | `1rem / 600` | Tiêu đề section/card |
| `--fs-body` | `0.875rem / 400` | Nội dung, cell bảng |
| `--fs-caption` | `0.75rem / 500` | Nhãn, meta, sub-note |
| `--fs-overline` | `0.6875rem / 600 / 0.06em / uppercase` | Nhãn KPI, header bảng |

**(c) Hạ tông header bảng** — bỏ gradient đậm, dùng surface token + overline. Đây là thay đổi **1 dòng CSS nhưng tác động lớn nhất** tới cảm giác "rối" vì bảng xuất hiện ở 15/18 trang:

```css
.ant-table-thead > tr > th {
  background: var(--surface-container-low) !important;  /* #f1f3ff */
  color: var(--on-surface-variant) !important;
  font: var(--fs-overline);
  border-bottom: 1px solid var(--outline-variant) !important;
}
```

**(d) Quy ước dùng màu** (chống RC-3):

| Màu | CHỈ dùng khi | KHÔNG dùng để |
|---|---|---|
| `--error` / `--warning` | Có vấn đề cần người dùng xử lý | Định danh một chỉ số, tô cho đẹp |
| `--success` | Trạng thái hoàn tất/khoẻ mạnh | Nhấn mạnh doanh thu |
| `--primary` | Hành động chính, dữ liệu đang chọn | Mọi tiêu đề |
| Trung tính | **Mặc định cho mọi KPI** | — |

⇒ 4 KPI card: **tất cả accent bar chuyển sang trung tính**, chỉ đổi sang warning/error khi vượt ngưỡng thật (VD: `Chỗ trống < 10%` → cam).

### 4.2 Tầng App Shell (B-09, B-10, C-11)

**(a) Sidebar có group header + thu gọn được**

```
VẬN HÀNH          ← group label, --fs-overline, on-surface-variant
  Tổng quan
  Xe vào / Xe ra / Lịch sử
DANH MỤC
  Bãi đỗ xe · Khách hàng · Phương tiện · Loại xe · Gói dịch vụ
QUẢN TRỊ
  Thanh toán · Cảnh báo · Báo cáo · Phân tích · Người dùng · Nhật ký
```
- Mặc định chỉ bung group chứa route hiện tại (accordion), lưu state vào `localStorage`.
- Thêm nút thu gọn 240px → 64px (icon-only + Tooltip), tự thu khi `width < 1280px`.

**(b) Component `PageHeader` dùng chung** — thay việc mỗi trang tự đặt `<h1>` (hoặc không đặt):

```
[Breadcrumb: Trang chủ / Quản trị / Phân tích]
Phân tích & Gợi ý                        [actions: filter, export]
Cập nhật 13:38 · Dữ liệu tháng 8/2026
```
Header app phía trên chỉ còn: logo + tên app (trái), chuông cảnh báo + ngôn ngữ + user (phải). **Bỏ đồng hồ giây khỏi header** (A-01).

### 4.3 Tầng Dashboard — tách 2 dashboard theo vai trò + phân tầng theo kỳ thời gian (B-02, B-03, B-04, A-01, A-02)

> **Đã chốt**: tách thành 2 dashboard riêng theo vai trò. Đây là quyết định đúng — nguyên nhân sâu xa khiến màn Tổng quan hiện tại "rối" chính là **1 trang phải phục vụ 2 nhu cầu ngược nhau**: nhân viên quầy cần biết *"còn chỗ không, xe nào bất thường"* (chu kỳ tính bằng phút), quản lý cần biết *"tiền về bao nhiêu, xu hướng đi đâu"* (chu kỳ tính bằng tuần/tháng). Ép chung 1 trang thì không có chỉ số nào được ưu tiên.

**Cơ chế định tuyến**: giữ nguyên route `/` — `Dashboard.tsx` trở thành router mỏng, đọc `role` từ `AuthContext` rồi render `<OpsDashboard />` hoặc `<MgmtDashboard />`. Admin thấy `<MgmtDashboard />` nhưng có **Segmented "Quản lý | Vận hành"** ở `PageHeader` để xem cả bản vận hành (trưởng ca cần). Staff **không** có toggle và **không** thấy dữ liệu doanh thu tổng.

#### A. Dashboard Vận hành (staff, và admin khi chuyển tab)

Con số chủ đạo: **Tỷ lệ lấp đầy**. Tự làm mới 60–90s.

```
┌─ PageHeader: "Tổng quan · Vận hành"  ·  Cập nhật 13:38   [Làm mới] ────┐

┌─ NGAY BÂY GIỜ ─────────────────────────────────────────────────────────┐
│  ┌─────────────────────┐ ┌──────────┐┌──────────┐┌──────────┐          │
│  │  TỶ LỆ LẤP ĐẦY      │ │Xe đang đỗ││Lượt hôm  ││Cảnh báo  │          │
│  │       20%           │ │    22    ││ nay   6  ││   49     │          │
│  │  88/110 chỗ trống   │ │          ││          ││          │          │
│  │  [thanh ngang]      │ └──────────┘└──────────┘└──────────┘          │
│  │  ● Công suất ổn định│   ← accent bar TRUNG TÍNH, chỉ đổi màu khi     │
│  └─────────────────────┘     vượt ngưỡng thật                          │
│  [Xe vào] [Xe ra] [Sơ đồ bãi]   ← nút text/tertiary, không gradient    │
└────────────────────────────────────────────────────────────────────────┘

┌─ CẦN XỬ LÝ (3) ────────────────────────────────────────── [Xem tất cả]─┐
│  ⚠ 22 xe đỗ quá 24 giờ                            → Danh sách xe        │
│  ⚠ Khu D đạt 100% công suất                       → Điều phối           │
│  ⓘ 49 cảnh báo chưa xử lý                         → Trang cảnh báo      │
└────────────────────────────────────────────────────────────────────────┘

┌─ LẤP ĐẦY THEO KHU ─────────────────────────────────────────────────────┐
│  Khu A ████░░░░░░ 16%   Khu B ██░░░░░░░░ 6.7%                           │
│  Khu C █░░░░░░░░░ 5%    Khu D ██████████ 100%  [Đầy]                    │
└────────────────────────────────────────────────────────────────────────┘

┌─ XE ĐANG TRONG BÃI ────────────────────────────── [bảng, mặc định 10] ─┐
```

Bỏ khỏi màn vận hành: doanh thu hôm nay/tháng, so sánh tuần, chart xu hướng 7 ngày, cơ cấu loại xe 30 ngày — **toàn bộ chuyển sang dashboard quản lý**. Đây là phần cắt giảm lớn nhất và cũng là phần tạo hiệu quả rõ nhất.

#### B. Dashboard Quản lý (admin, mặc định)

Con số chủ đạo: **Doanh thu**. Có bộ chọn kỳ ở `PageHeader` (`Hôm nay | 7 ngày | 30 ngày | Tháng này`) áp dụng cho **toàn trang** — đây là cách giải quyết triệt để B-03 (trộn 4 kỳ thời gian): thay vì mỗi khối một kỳ ngầm định, cả trang dùng 1 kỳ do người dùng chọn, mỗi khối chỉ ghi rõ mốc so sánh.

```
┌─ PageHeader: "Tổng quan · Quản lý"   [Hôm nay|7 ngày|30 ngày|Tháng] ──┐

┌────────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────┐ ┌──────────┐┌──────────┐┌──────────┐          │
│  │  DOANH THU (7 ngày) │ │Lượt xe   ││TB DT/ngày││Lấp đầy TB│          │
│  │    92.232.000đ      │ │  1.902   ││3.074.400 ││  19.1%   │          │
│  │  ↗ +66.4% vs kỳ trước│ │ ↘ -16.4% ││          ││          │          │
│  └─────────────────────┘ └──────────┘└──────────┘└──────────┘          │
└────────────────────────────────────────────────────────────────────────┘

┌─ XU HƯỚNG ─────────────────────────────────────────────────────────────┐
│  ┌── Doanh thu ──────────────┐  ┌── Lượt xe ──────────────┐            │
│  │  1 trục Y · 1 đường       │  │  1 trục Y · 1 đường      │            │
│  │  hôm nay: nét đứt         │  │  hôm nay: nét đứt        │            │
│  └───────────────────────────┘  └──────────────────────────┘            │
│  ← BỎ TRỤC KÉP: 2 chart riêng, cùng trục X, tooltip đồng bộ            │
└────────────────────────────────────────────────────────────────────────┘

┌─ Cơ cấu & cao điểm ────────────────────────────────────────────────────┐
│  Loại xe (%)          │  Giờ cao điểm: 7h (~8.4) · 17h (~7.3)          │
└────────────────────────────────────────────────────────────────────────┘

┌─ HIỆU QUẢ THEO KHU VỰC ────────────────────── [bảng, cột width cố định]┐
```

**Lưu ý ranh giới với trang `Phân tích & Gợi ý`**: sau khi tách, `MgmtDashboard` và `Analytics.tsx` bị **trùng khoảng 70% nội dung** (đều là KPI doanh thu + chart theo kỳ + bảng hiệu quả khu vực). Cần chốt ranh giới — xem Q5 ở mục 8. Đề xuất: `MgmtDashboard` = ảnh chụp nhanh + delta; `Analytics` = phân tích sâu + gợi ý quyết định (Collapse) và **không lặp lại 5 KPI card**.

**Thay đổi cụ thể:**

| Việc | Lý do |
|---|---|
| **Bỏ hero banner gradient**; gauge → card KPI đầu tiên, phóng to gấp đôi (span 2 cột) làm focal point | B-02, B-04 — trả lại ~200px above-the-fold, tạo 1 focal point |
| **Bỏ lời chào "Xin chào, Quản trị viên"** và 3 dòng meta trong hero | Không mang thông tin vận hành; tên user đã có ở góc phải |
| **Bỏ 2/3 đồng hồ**: chỉ giữ 1 dòng "Cập nhật lúc HH:mm" trong PageHeader | A-01 |
| 4 nút hành động → `type="text"` có icon, đặt dưới KPI, không gradient | Giảm 4 điểm nhấn; hành động này đã có trong sidebar |
| Gộp "Gợi ý thông minh" + "1 khu sắp đầy" + "22 xe >8 giờ" thành **1 khối "Cần xử lý"** duy nhất, mỗi dòng có 1 CTA điều hướng | A-02, B-03 — hết trùng lặp, biến insight thành hành động |
| Tất cả accent bar KPI → trung tính, chỉ đổi màu khi vượt ngưỡng cấu hình | B-04 |
| **Tách chart trục kép thành 2 sparkline/chart riêng** cùng hàng | B-05 |
| Ngày hôm nay trong chart: nét đứt + chú thích "đang cập nhật" | A-05 |
| "So sánh tuần" → nhãn delta gắn thẳng vào chart tương ứng, bỏ card riêng | B-03 |
| **Tách `Dashboard.tsx` thành `OpsDashboard` + `MgmtDashboard`**, `Dashboard.tsx` chỉ còn router theo role | Đã chốt — mỗi trang 1 nhóm người dùng, 1 con số chủ đạo |
| Cả trang quản lý dùng **1 bộ chọn kỳ chung**, mỗi khối ghi rõ mốc so sánh | B-03 — hết tình trạng trộn 4 kỳ ngầm định |

### 4.4 Tầng Analytics / Reports (B-06, B-07, B-08, B-11, C-06)

| Việc | Chi tiết |
|---|---|
| **Bỏ card bao quanh Segmented** | Đưa Segmented lên hàng action của `PageHeader` → thu hồi ~90px (B-06) |
| **KPI grid responsive thật** | `Row gutter=[16,16]` + `Col xs=24 sm=12 lg=8 xxl` — 5 card xuống 3+2 thay vì tràn (B-07) |
| **Set width cột bảng** | `KHU VỰC width:180`, `TỔNG CHỖ width:110 align:right`, `TỶ LỆ LẤP ĐẦY width:220`, tiền tệ `align:right` + `tabular-nums` (B-08) |
| **Chuẩn hoá Progress** | Bỏ màu đỏ cho 100%; dùng gradient theo ngưỡng: `<60%` trung tính, `60–85%` primary, `>85%` warning, `100%` error **kèm chữ "Đầy"**. Bỏ icon ✓ (A-04) |
| **Value label trên chart cột** | Bật `LabelList`, highlight cột max bằng `--primary`, các cột còn lại `--primary` 40% opacity (B-11) |
| **Trục giờ** | Chỉ hiện nhãn mỗi 3 giờ (`interval={2}`), giữ tooltip đầy đủ |
| **Thay nút pill tự chế bằng `Segmented`** trong `Reports.tsx` | C-06 |
| **Gộp 2 nút xuất Excel** vào 1 dropdown "Xuất" với option phạm vi | C-07 |

### 4.5 Tầng component dùng chung (C-02, C-03, C-04, C-09)

**(a) `<StatusTag>`** — 1 component thay ≥4 cách hiển thị trạng thái:

```tsx
type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'error';

interface StatusTagProps {
  tone: StatusTone;          // quyết định màu, LUÔN từ CSS var
  label: string;             // LUÔN có chữ (accessibility, đã làm tốt — giữ)
  dot?: boolean;             // hiển thị chấm trạng thái thay vì nền
  size?: 'sm' | 'md';
}
// Từ điển ánh xạ nghiệp vụ → tone, đặt tập trung 1 file:
// statusMap.ts: { available:'success', occupied:'info', expired:'error', ... }
```
Áp dụng đồng loạt cho: chỗ đỗ, khu vực, phương thức thanh toán, trạng thái gói, trạng thái user. **Xoá toàn bộ `Tag color="purple"`, `.chip-*`, emoji trong `Select`.**

**(b) `confirmDanger()`** — 1 helper thay `Popconfirm`/`Modal.confirm` lẫn lộn:
- Hành động **không phục hồi được** (xoá cứng) → `Modal.confirm` + gõ xác nhận nếu cần.
- Hành động **phục hồi được** (deactivate) → `Popconfirm` + đổi icon `DeleteOutlined` → `StopOutlined`, nhãn "Ngừng hoạt động" (C-12).

**(c) `<PermissionGate>`** — chuẩn hoá C-04: mặc định **disable + Tooltip lý do** (thay vì ẩn hẳn), vì ẩn nút làm người dùng tưởng tính năng không tồn tại và gọi hỗ trợ.

**(d) `<FilterBar>`** — 1 layout chuẩn cho toolbar filter mọi trang: `[search] [filter…] [reset] ————— [actions]`, chiều cao cố định, wrap có kiểm soát.

---

## 5. Phương án thực hiện kỹ thuật

### 5.1 Nguyên tắc triển khai

1. **Không đụng logic nghiệp vụ / API** ở Phase 1–2. Chỉ CSS token + layout + component wrapper.
2. **Một nguồn chân lý cho theming** — dứt điểm RC-4: mọi thứ AntD hiểu được thì đặt ở `ConfigProvider` token; `design-system.css` chỉ giữ những gì token không phủ; **xoá dần `!important`**.
3. **Đổi token trước, đổi trang sau** — sửa `design-system.css` là đã cải thiện toàn app vì phần lớn style là override global.
4. Mỗi PR đi kèm ảnh before/after 1 màn hình đại diện.

### 5.2 Chi tiết theo hạng mục

| # | Hạng mục | File tác động | Cách làm | Rủi ro |
|---|---|---|---|---|
| T-01 | Elevation + type scale + hạ tông table header | `design-system.css` | Thêm token, sửa `.ant-table-thead`, `.ant-card` | Thấp — regression thị giác toàn app, cần QA quét 18 trang |
| T-02 | Đồng bộ token AntD ↔ CSS | `App.tsx`, `design-system.css` | Chuyển `headerBg`, `borderRadius`, `controlHeight` về 1 nơi; xoá `!important` trùng | Trung bình — dễ vỡ style cục bộ |
| T-03 | `PageHeader` + breadcrumb | `components/PageHeader.tsx` (mới), `MainLayout.tsx`, 18 page | Map route → `{title, parent}` trong 1 file `routeMeta.ts`; page chỉ truyền `actions` | Thấp |
| T-04 | Sidebar group + collapse | `MainLayout.tsx`, `permConfig.ts` | Thêm `group` vào cấu hình menu; `Menu` items lồng theo group; `useBreakpoint()` của AntD để auto-collapse `<1280px` | Trung bình — phải kiểm tra lại `canSee()` khi group rỗng thì ẩn cả group |
| T-05 | **Tách 2 dashboard theo role** | `pages/Dashboard.tsx` → `dashboard/OpsDashboard.tsx`, `dashboard/MgmtDashboard.tsx`, `dashboard/_shared/` | `Dashboard.tsx` giữ route `/`, đọc `role` từ `AuthContext` → render nhánh tương ứng; admin có Segmented đổi view (lưu lựa chọn vào `localStorage`). Component dùng chung tách vào `_shared/`: `<StatGrid>`, `<ActionItems>`, `<TrendChart>`, `<ZoneFillList>` | Trung bình — file `Dashboard.tsx` hiện lớn, tách theo khối UI trước rồi mới chia 2 nhánh |
| T-05b | Nội dung từng dashboard | như trên | Ops: bỏ hero, bỏ mọi chỉ số doanh thu, focal = tỷ lệ lấp đầy, gộp insight thành "Cần xử lý". Mgmt: focal = doanh thu, **1 bộ chọn kỳ áp dụng toàn trang**, tách chart trục kép thành 2 chart | Trung bình — cần BE hỗ trợ tham số kỳ thống nhất, xem Q4 |
| T-05c | Chặn rò rỉ dữ liệu doanh thu sang staff | `OpsDashboard`, API dashboard | Staff **không** gọi endpoint doanh thu (chặn ở cả FE và BE, không chỉ ẩn UI) | **Cần BE** — tách endpoint hoặc lọc field theo role |
| T-06 | Hợp nhất đồng hồ | `MainLayout.tsx`, `Dashboard.tsx` | 1 `useClock()` hook duy nhất, chu kỳ 1s, share qua context; Dashboard chỉ hiển thị `lastUpdatedAt` | Thấp |
| T-07 | Thống nhất ngưỡng cảnh báo | BE config + FE | Đưa ngưỡng `overstayHours` về **1 nguồn** (API config), FE không hardcode 8/24 | **Cần BE** — xem Need Confirm Q4 |
| T-08 | `StatusTag` + `statusMap.ts` | `components/StatusTag.tsx` (mới) + 8 trang | Thay thế dần theo trang, mỗi trang 1 commit | Thấp |
| T-09 | `confirmDanger()` + `PermissionGate` | `utils/confirm.tsx`, `components/PermissionGate.tsx` | Thay thế dần | Thấp |
| T-10 | Chuẩn hoá bảng | tất cả page có `Table` | Bắt buộc mọi column có `width` hoặc `ellipsis`; số/tiền `align:'right'` + class `.num` (`font-variant-numeric: tabular-nums`) | Thấp |
| T-11 | Chuẩn hoá chart | `pages/Reports.tsx`, `Analytics.tsx`, `Dashboard.tsx` | Tạo `chartTheme.ts` export `CHART_COLORS` đọc từ CSS var qua `getComputedStyle`; xoá mảng hex rời | Thấp |
| T-12 | Lint chặn hardcode màu | `.stylelintrc`, `eslint` | `stylelint`: `color-no-hex` (trừ file token); ESLint rule `no-restricted-syntax` chặn literal `#RRGGBB` trong `.tsx` | Thấp — bật ở chế độ `warn` trước, `error` sau khi dọn xong |
| T-13 | **Desktop-only có kiểm soát** (rút gọn theo D-3) | `design-system.css`, `MainLayout.tsx` | Bỏ tham vọng responsive đầy đủ. Chỉ làm 2 việc: (1) đảm bảo **không scroll ngang cấp trang ở 1366px** — grid KPI `Col lg=8/xl=6`, bảng dùng `scroll={{x}}` cục bộ; (2) dưới 1024px hiện banner "Ứng dụng tối ưu cho màn hình từ 1366px" thay vì để layout vỡ âm thầm | Thấp |
| T-14 | i18n `ImportModal` + trang thiếu | `ImportModal.tsx`, `translations.ts` | Bổ sung ~60 key; TS parity đã ép sẵn nên an toàn. `useEffect` set `document.documentElement.lang` | Thấp |
| T-15 | Branding | `public/`, `Login.tsx`, `MainLayout.tsx` | Chốt 1 tên; thêm `favicon.ico` + `manifest.json`; xoá inline style logo | Thấp — **cần bạn chốt tên, Q7** |
| T-16 | Regex biển số | `ParkingEntry.tsx` (+ BE) | Đồng bộ 1 regex FE/BE, cho phép định dạng `51H4-23456`, `29A-12345`, xe quân đội/ngoại giao | **Cần BE xác nhận danh sách định dạng hợp lệ** |
| T-17 | Dọn `<style>` inject + export trùng | `ActivityLogs.tsx`, `utils/reportExport.ts` | Chuyển style sang class `.row-login-failed`; mở rộng `reportExport.ts` nhận `columns+rows` generic | Thấp |

### 5.3 Snippet tham khảo cho 2 điểm dễ sai

**Bỏ trục kép — tách 2 chart cùng hàng, đồng bộ tooltip:**

```tsx
// Dashboard.tsx
<Row gutter={16}>
  <Col xs={24} lg={12}>
    <TrendChart title="Lượt xe" data={data} dataKey="visits"
      delta={-16.4} color="var(--primary)" />
  </Col>
  <Col xs={24} lg={12}>
    <TrendChart title="Doanh thu" data={data} dataKey="revenue"
      delta={66.4} color="var(--success)" format="currency" />
  </Col>
</Row>
// TrendChart: 1 YAxis, 1 Line, hôm nay dùng strokeDasharray + ReferenceArea "đang cập nhật"
```

**Đọc màu chart từ CSS variable (chống C-01):**

```ts
// utils/chartTheme.ts
const css = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const CHART_COLORS = () => [
  css('--primary'), css('--success'), css('--warning'),
  css('--error'), css('--inverse-primary'),
];
// Gọi trong useMemo ở component để hỗ trợ dark mode sau này mà không sửa lại chart
```

---

## 6. Lộ trình & ước lượng

| Phase | Nội dung | Hạng mục | Man-day | Kết quả cảm nhận |
|---|---|---|---|---|
| **P0 — Hotfix dữ liệu** | Sửa mâu thuẫn số liệu | A-01→A-05, T-06, T-07 | 2–3 | Hết cảm giác "hệ thống báo sai" |
| **P1 — De-noise nền tảng** | Token, elevation, type scale, hạ tông table header, đồng bộ theming | T-01, T-02, T-10, T-11 | 4–5 | **~60% cảm giác "rối" biến mất, toàn app** |
| **P2 — Cấu trúc trang** | PageHeader, sidebar group, **tách 2 dashboard**, chỉnh Analytics | T-03, T-04, T-05/05b/05c | 8–10 | Mỗi vai trò có 1 trang đúng nhu cầu, above-the-fold hữu ích |
| **P3 — Nhất quán component** | StatusTag, confirmDanger, PermissionGate, FilterBar | T-08, T-09 | 4–5 | Học 1 lần dùng mọi trang |
| **P4 — Nợ kỹ thuật** | Lint màu, chốt desktop-only, i18n, branding, dọn code | T-12→T-17 | 4–6 | Bền vững, không tái phát |

**Tổng: 22–29 man-day** (đã tính D-1 làm tăng P2 và D-3 làm giảm P4). Nếu chỉ có ngân sách hẹp: làm **P0 + P1** (6–8 man-day) đã giải quyết phần lớn vấn đề bạn đang cảm nhận, vì phần lớn style là override global nên sửa token là toàn app hưởng lợi.

---

## 7. Acceptance Criteria

**Nhóm dữ liệu (P0)**
- Đạt khi trên màn Tổng quan chỉ còn **tối đa 1 hiển thị thời gian** và giá trị này khớp giờ hệ thống.
- Đạt khi ngưỡng "xe đỗ quá giờ" hiển thị **cùng một con số và cùng một ngưỡng** ở mọi vị trí trên app, và ngưỡng lấy từ config chứ không hardcode.
- Đạt khi khu vực có tỷ lệ lấp đầy 100% nhưng doanh thu 0đ hiển thị kèm chú thích lý do (hoặc dữ liệu được xác nhận là sai và đã sửa).

**Nhóm thị giác (P1)**
- Đạt khi trên mỗi viewport 1440×900 của Tổng quan/Phân tích, đếm được **≤1 khối nền tối/gradient** và **≤1 con số cỡ `--fs-display`**.
- Đạt khi mọi header bảng dùng `--surface-container-low`, không còn gradient tối.
- Đạt khi 4 KPI trên Tổng quan hiển thị màu trung tính ở trạng thái bình thường, và **chỉ** đổi sang cam/đỏ khi vượt ngưỡng cấu hình (kiểm chứng bằng cách chỉnh ngưỡng test).
- Đạt khi không còn biểu đồ nào dùng 2 trục Y khác đơn vị.
- Đạt khi ở độ rộng **1366px** (độ phân giải mục tiêu tối thiểu), không card/cột nào bị cắt tràn ngang trên Tổng quan, Phân tích, Báo cáo — không xuất hiện scroll ngang cấp trang.
- Đạt khi tài khoản **staff** đăng nhập thấy Dashboard Vận hành, **không có** bất kỳ chỉ số doanh thu nào, và **request tới endpoint doanh thu bị BE từ chối** (không chỉ ẩn ở UI).
- Đạt khi tài khoản **admin** thấy Dashboard Quản lý mặc định và chuyển được sang bản Vận hành; lựa chọn được ghi nhớ sau khi tải lại trang.
- Đạt khi trên Dashboard Quản lý, đổi bộ chọn kỳ làm **toàn bộ** KPI và chart cập nhật theo cùng một kỳ (không còn khối nào giữ kỳ ngầm định riêng).
- Đạt khi mọi cột bảng có `width` hoặc `ellipsis`, cột số/tiền căn phải và dùng `tabular-nums`.

**Nhóm nhất quán (P2)**
- Đạt khi grep toàn bộ `src/**/*.tsx` không còn literal `#RRGGBB` (trừ `design-system.css` và file token) — kiểm bằng lint CI.
- Đạt khi mọi trạng thái nghiệp vụ render qua `<StatusTag>`; không còn `Tag color=` hardcode, không còn emoji trong `Select`.
- Đạt khi bật English, toàn bộ `ImportModal` và 5 trang đang hardcode hiển thị tiếng Anh; `document.documentElement.lang` đổi theo.
- Đạt khi dưới 1024px, hệ thống hiện banner khuyến nghị độ phân giải thay vì để layout vỡ âm thầm.

---

## 8. Need Confirm — câu hỏi cần bạn chốt

| # | Câu hỏi | Vì sao cần |
|---|---|---|
| Q1 | **Staff có được xem doanh thu ở mức nào không?** (VD: doanh thu ca trực của chính mình, để đối soát tiền mặt cuối ca) | Đã chốt tách 2 dashboard, nhưng nếu staff cần đối soát ca thì bản Vận hành phải có 1 khối "Ca của tôi" — khác với "doanh thu toàn bãi". Ảnh hưởng T-05c và cả API. |
| Q2 | **Hero banner có phải yêu cầu của khách hàng/lãnh đạo không?** | Nếu là yêu cầu cứng, tôi giữ nhưng nén xuống ~96px (chỉ gauge + 1 dòng trạng thái) thay vì bỏ hẳn. |
| Q3 | **Ngưỡng "xe đỗ quá giờ" đúng là bao nhiêu — 8h hay 24h?** Có cấu hình được không? | Sửa A-02, T-07. Ảnh hưởng cả BE. |
| Q4 | **API dashboard hiện có nhận tham số kỳ (from/to) không**, hay mỗi khối là 1 endpoint với kỳ cố định phía BE? | Dashboard Quản lý dùng **1 bộ chọn kỳ cho toàn trang**. Nếu BE đang cố định kỳ theo từng endpoint thì phải sửa BE, và đây là hạng mục dài nhất của P2. |
| Q5 | **Ranh giới giữa Dashboard Quản lý và trang "Phân tích & Gợi ý"?** | Sau khi tách, 2 màn trùng ~70% nội dung. Đề xuất: Dashboard = ảnh chụp nhanh + delta; Analytics = phân tích sâu + gợi ý quyết định, bỏ 5 KPI card trùng. Cần bạn xác nhận trước khi tôi chi tiết hoá. |
| Q6 | **Khu D lấp đầy 100% nhưng doanh thu 0đ** — bug dữ liệu, hay đúng nghiệp vụ (toàn xe tháng đã thu tiền từ trước)? | Quyết định fix data hay fix cách hiển thị (thêm cột "Doanh thu ghi nhận kỳ"). |
| Q7 | **Có ca trực đêm không?** | Quyết định có đầu tư dark mode. Nếu có, T-11 (`chartTheme` đọc CSS var) phải làm trước để không sửa chart 2 lần. |
| Q8 | **Chốt 1 tên sản phẩm**: ParkManager / Quản lý bãi đỗ xe / PSM? | T-15, ảnh hưởng Login, header, favicon, manifest, title tab. |
| Q9 | **Phạm vi song ngữ**: hoàn thiện i18n toàn bộ hay rút gọn về khung sườn + khai báo rõ? | Chênh lệch ~2–3 man-day. Trạng thái "nửa vời" hiện tại là tệ nhất trong 3 lựa chọn. |
| Q10 | **Trang Thanh toán chỉ đọc là chủ đích kiểm toán hay là gap chưa làm?** | Nếu chủ đích, cần thêm dòng giải thích trên UI để user không đi tìm nút Sửa. |

> Q1, Q4, Q5 là 3 câu chặn tiến độ P2 — cần chốt trước khi Dev bắt đầu tách dashboard.

---

*Tài liệu này đề xuất giải pháp cho trạng thái as-is mô tả trong `UIUX_AUDIT.md`. Các hạng mục đánh dấu **Cần BE** hoặc **Need Confirm** chưa được đưa vào ước lượng cứng cho tới khi có xác nhận.*
