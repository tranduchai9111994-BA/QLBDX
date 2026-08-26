# ONBOARDING — Hướng dẫn cho thành viên mới (QLBDX)

> Tài liệu này dành cho người **lần đầu** tham gia dự án: từ lấy source về máy, cài đặt, chạy thử, đến hiểu sản phẩm đang có gì. Đọc từ trên xuống, làm theo từng bước.

---

## 0. Sản phẩm này là gì?

**QLBDX** là hệ thống quản lý bãi đỗ xe — web app cho 2 vai trò:

- **Nhân viên**: ghi nhận xe vào/ra, tính phí, đăng ký gói dịch vụ cho khách.
- **Admin**: quản trị toàn bộ (danh mục, người dùng, báo cáo, cảnh báo, phân tích).

Stack: **React + Ant Design** (frontend) — **Node.js + Express + Prisma** (backend) — **SQL Server** (database).

> Giao diện hỗ trợ **Sáng/Tối (dark mode)** — nút chuyển ở header, hệ thống tự nhớ lựa chọn cho lần sau. Ứng dụng tối ưu cho màn hình desktop; nếu thu nhỏ dưới 1024px sẽ hiện banner cảnh báo nên dùng màn hình lớn hơn.

---

## 1. Yêu cầu môi trường

Cài trước khi bắt đầu:

| Công cụ | Phiên bản | Kiểm tra bằng |
|---|---|---|
| Node.js | 18 trở lên | `node -v` |
| Git | bất kỳ | `git --version` |
| SQL Server | 2016+ (hoặc Express) | SSMS kết nối được `localhost` |

> Windows là môi trường được test kỹ nhất (có sẵn script `.bat`). Mac/Linux vẫn chạy được nhưng phải tự thay các bước script bằng lệnh tương đương.

---

## 2. Lấy source về máy

```bash
git clone https://github.com/tranduchai9111994-BA/QLBDX.git
cd QLBDX
```

---

## 3. Khởi tạo Database

Chọn **1 trong 3 cách**:

### Cách A — Restore từ backup có sẵn (nhanh nhất, khuyến nghị)

`database/ParkingManagement.bak` đã chứa sẵn **~39.000 bản ghi** dữ liệu nhiều năm (2024 → nay) — restore xong là có ngay Dashboard/Báo cáo đầy đủ, khỏi cần chạy seed script.

Trong SSMS: chuột phải **Databases → Restore Database... → Device → chọn file `.bak`** → OK. Hoặc dùng `sqlcmd` — chi tiết xem [database/README.md](database/README.md).

Xong cách này → bỏ qua các lệnh `prisma:seed`/`prisma:seed-history` ở **Mục 5**.

### Cách B — Dùng SSMS chạy từ script (tự tạo data mới)

1. Mở SQL Server Management Studio, kết nối `localhost` (user `sa` / password `123`, hoặc Windows Authentication).
2. Mở file `database/setup.sql` → nhấn **F5** để chạy → đợi ~10 giây. Script tự tạo database `ParkingManagement` + toàn bộ bảng + data mẫu.
3. *(Tuỳ chọn)* Chạy tiếp `database/demo_business_patch.sql` để chuẩn hoá thêm dữ liệu nghiệp vụ demo.

### Cách C — Dùng Prisma (khuyến nghị nếu bạn sẽ code backend nhiều)

Bỏ qua bước này, làm ở **Mục 5** — Prisma sẽ tự tạo schema từ `backend/prisma/schema.prisma` (luôn khớp code mới nhất, không sợ SQL script bị lỗi thời).

---

## 4. Cấu hình kết nối (`.env`)

```bash
cd backend
copy .env.example .env      # Windows
# hoặc: cp .env.example .env   (Mac/Linux)
```

Mở `backend/.env`, sửa lại nếu SQL Server của bạn khác cấu hình mặc định:

```env
DATABASE_URL="sqlserver://localhost:1433;database=ParkingManagement;user=sa;password=123;encrypt=false;trustServerCertificate=true"
```

> File `.env` **không** được commit lên git (đã có trong `.gitignore`) — mỗi máy tự cấu hình riêng.

---

## 5. Cài đặt & seed dữ liệu

```bash
# Backend
cd backend
npm install
npm run prisma:generate

# Nếu bạn chọn Cách C ở Mục 3 (chưa tạo DB bằng SSMS/backup):
npx prisma db push
```

> **Nếu bạn đã restore từ `ParkingManagement.bak` (Cách A ở Mục 3) — bỏ qua 2 lệnh seed bên dưới**, data đã có sẵn trong backup rồi.

```bash
# Seed tài khoản + danh mục + dữ liệu demo cơ bản
npm run prisma:seed

# (Khuyến nghị) Bồi đắp dữ liệu nhiều năm để Dashboard/Báo cáo/Phân tích
# hiển thị đúng xu hướng thực tế thay vì chỉ vài bản ghi rời rạc.
# Idempotent — chạy lại vô tư, không sợ trùng dữ liệu.
npm run prisma:seed-history

# (Tuỳ chọn) Seed thêm 16 bản ghi "checkout ngoại lệ" mẫu để test màn hình Báo cáo
npm run prisma:seed-exceptions
```

```bash
# Frontend (mở terminal mới)
cd frontend
npm install
```

`prisma:seed-history` mất khoảng **2-3 phút** (bồi đắp ~38.000 bản ghi trải dài từ 01/2024 đến hiện tại, có xu hướng tăng trưởng theo năm + mùa cao điểm). Chạy 1 lần là đủ, không cần chạy lại mỗi ngày.

---

## 6. Khởi động hệ thống

### Cách nhanh nhất (Windows) — chạy ngầm, không hiện cửa sổ CMD

Double-click **`start.bat`** ở thư mục gốc. Script sẽ:
- Tự kiểm tra & bật SQL Server nếu đang tắt (có thể hiện UAC — bấm **Yes**)
- Cài dependency nếu thiếu
- Chạy Backend (`:5000`) + Frontend (`:3000`) **hoàn toàn ẩn** — log ghi vào thư mục `logs/`
- Tự mở trình duyệt khi sẵn sàng (~10-90 giây)

Lần sau (đã cài xong dependency), dùng **`start-fast.bat`** để khởi động nhanh hơn (bỏ qua bước kiểm tra cài đặt).

Muốn dừng hệ thống: chạy **`stop.bat`**.

> Nếu có lỗi khi khởi động, kiểm tra `logs/launcher.log`, `logs/backend.err.log`, `logs/frontend.err.log`.

### Cách thủ công (mọi hệ điều hành)

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm start
```

Mở trình duyệt: **http://localhost:3000**

---

## 7. Đăng nhập kiểm tra

| Vai trò | Username | Mật khẩu |
|---|---|---|
| Quản trị viên | `admin` | `admin123` |
| Nhân viên | `nhanvien1` | `staff123` |

*(Chi tiết đầy đủ các tài khoản demo — bao gồm tài khoản bị khoá để test tính năng deactivate — xem [demo_accounts.md](demo_accounts.md))*

**Checklist xác nhận cài đặt thành công:**
- [ ] Đăng nhập `admin` → thấy Dashboard hiện số liệu (không phải toàn số 0 / báo lỗi)
- [ ] Vào **Xe vào** → nhập biển số bất kỳ trong DB (VD: xem ở màn hình Phương tiện) → hệ thống tự hiện thông tin khách quen
- [ ] Vào **Báo cáo** → chọn "Toàn bộ" → thấy dữ liệu trải nhiều tháng/năm, không phải chỉ 1-2 ngày
- [ ] Đăng nhập `nhanvien1` → menu bị ẩn bớt (không thấy Báo cáo, Thanh toán, Người dùng...)

---

## 8. Tổng quan chức năng hiện có

### 8.1 Vận hành hằng ngày

| Chức năng | Mô tả |
|---|---|
| **Xe vào** | Nhập biển số → chọn loại xe + chỗ đỗ → ghi nhận. Nếu xe đã đăng ký trước, hệ thống tự nhận diện. |
| **Xe ra** | Chọn xe đang đỗ → xem trước phí → xác nhận → in biên nhận. Có gói dịch vụ thì miễn phí. |
| **Checkout ngoại lệ** | Dùng khi khách mất vé, vé hỏng, cần giải phóng chỗ bắt buộc, hoặc miễn phí đặc biệt — ghi chú lý do bắt buộc. |
| **Lịch sử đỗ xe** | Tra cứu toàn bộ lượt xe đã hoàn tất, lọc theo ngày/khu/loại xe/biển số. |
| **Tra cứu theo biển số** | Xem toàn bộ lịch sử ra/vào của 1 biển số cụ thể. |

**Công thức tính phí**: `≤24h → min(số giờ × giá/giờ, giá/ngày)` · `>24h → số ngày × giá/ngày` · có gói active → **miễn phí**.

### 8.2 Danh mục & hạ tầng

| Chức năng | Mô tả |
|---|---|
| **Loại xe** | Bảng giá theo giờ/ngày/tháng cho từng loại (xe máy, ô tô con, ô tô lớn, xe đạp...). |
| **Bãi đỗ xe** | Quản lý khu vực + từng chỗ đỗ, trạng thái available/occupied/maintenance. |
| **Gói dịch vụ** | Catalog vé tháng/quý/năm theo loại xe. |
| **Đăng ký gói** | Gán gói cho 1 xe cụ thể của khách, kiểm tra không chồng thời gian hiệu lực. |

### 8.3 Khách hàng & phương tiện

CRUD đầy đủ, validate trùng số điện thoại/CCCD/biển số. Có **Import Excel** hàng loạt (nút Import ở góc màn hình danh sách).

### 8.4 Quản trị (chỉ admin)

| Chức năng | Mô tả |
|---|---|
| **Thanh toán** | Danh sách mọi giao dịch thu tiền (gửi lẻ + gói dịch vụ), sửa được thông tin giao dịch. |
| **Báo cáo** | Doanh thu theo ngày/tháng/năm, phân loại xe, phương thức thanh toán, thống kê checkout ngoại lệ — đều xuất được Excel/CSV/PDF. |
| **Cảnh báo** | Gói sắp hết hạn, khu vực sắp đầy, xe đỗ quá lâu, dữ liệu bị lệch trạng thái, thanh toán bất thường. |
| **Người dùng** | CRUD tài khoản, khoá/mở khoá, và **phân quyền màn hình cho staff** (bật/tắt từng menu staff nhìn thấy). |
| **Nhật ký hoạt động** | Log mọi thao tác tạo/sửa/xoá: ai, lúc nào, kết quả gì. |

> Đặc tả chi tiết từng API/field/validation: xem **[Function.md](Function.md)**. Kiến trúc kỹ thuật đầy đủ (luồng nghiệp vụ, ER diagram, rủi ro kỹ thuật): xem **[KIEN_TRUC_CHI_TIET.md](KIEN_TRUC_CHI_TIET.md)**.

---

## 9. Chức năng thông minh mới bổ sung

Đây là phần **mới nhất**, thêm "trí thông minh" theo hướng **rule-based** (dựa trên phân tích dữ liệu + ngưỡng nghiệp vụ, không dùng machine learning — xem lý do trong [SMART_UPGRADE_PLAN.md](SMART_UPGRADE_PLAN.md)). Hãy thử từng cái để hiểu:

### 9.1 Smart auto-fill khi nhập biển số
**Ở đâu**: màn hình **Xe vào**, gõ xong biển số rồi bấm ra ngoài ô nhập (blur).
**Thấy gì**: nếu biển số đã có trong hệ thống — hiện ngay 1 card: khách quen bao nhiêu lượt/30 ngày, có gói hay chưa, thời gian đỗ trung bình, khu vực hay đỗ, và **tự động chọn sẵn chỗ đỗ gợi ý** (nhân viên vẫn đổi được).
**Vì sao có ích**: nhân viên không phải hỏi lại khách, giảm sai sót chọn nhầm loại xe/chỗ đỗ.

### 9.2 Gợi ý gói dịch vụ sau khi checkout
**Ở đâu**: màn hình **Xe ra**, sau khi xác nhận xe ra thành công.
**Thấy gì**: nếu khách đỗ xe thường xuyên (≥5 lần/tháng) mà chưa có gói — hiện popup "Gợi ý thông minh": nên mua gói tháng/quý/năm, tiết kiệm khoảng bao nhiêu % so với gửi lẻ, có nút bấm sang thẳng trang Gói dịch vụ.
**Ngưỡng**: ≥5 lần/tháng → gợi ý gói tháng · ≥12 → gói quý · ≥20 → gói năm.

### 9.3 Cảnh báo thông minh nâng cao
**Ở đâu**: trang **Cảnh báo**, các dòng có badge tím **"Smart"**.
**4 loại cảnh báo mới**:
- *Xe đỗ bất thường* — thời gian đỗ hiện tại gấp >3 lần trung bình của loại xe đó (không chỉ đơn giản ">24h" như cảnh báo cũ).
- *Biến động doanh thu* — doanh thu hôm nay (tính đến giờ hiện tại) thấp hơn >30% so với cùng giờ hôm qua.
- *Cơ hội gia hạn* — khách sắp hết gói **và** đỗ xe thường xuyên → ưu tiên liên hệ trước.
- *Mất cân bằng khu vực* — 1 khu quá tải (>90%) trong khi khu khác còn trống nhiều (<30%).

Mỗi cảnh báo Smart đều kèm dòng "💡 Gợi ý: ..." nói rõ nên làm gì.

### 9.4 Dashboard insights (so sánh & xu hướng)
**Ở đâu**: trang **Tổng quan**, phần giữa hero card và bảng khu vực.
**Thấy gì**:
- Card so sánh **tuần này vs tuần trước** (doanh thu, lượt xe, TB thời gian đỗ) — mũi tên xanh/đỏ.
- Card **giờ cao điểm** (30 ngày gần nhất) + loại xe phổ biến nhất.
- Card **gợi ý thông minh** — câu văn rule-based, VD: "Doanh thu tuần này tăng 83% — cân nhắc bố trí thêm nhân viên giờ cao điểm chiều".
- Biểu đồ **xu hướng 7 ngày** (số xe + doanh thu, 2 trục).

### 9.5 Phân tích & Gợi ý quyết định (DSS)
**Ở đâu**: menu mới **"Phân tích & Gợi ý"** (chỉ admin thấy, dưới mục Báo cáo).
**Thấy gì**: chọn kỳ (tháng/quý/năm) → xem phân tích theo thứ trong tuần, theo giờ, hiệu quả từng khu vực (doanh thu/chỗ) — và quan trọng nhất là **card "Gợi ý quyết định"**: mỗi câu hỏi kinh doanh (VD: "Có nên mở thêm chỗ ở Khu D?", "Có nên giảm giá cuối tuần?", "Có nên chạy chiến dịch bán gói?") kèm 2 phương án cụ thể, mỗi phương án có **tác động dự kiến** và **rủi ro** — mô hình ra quyết định (DSS) đúng nghĩa: phát hiện vấn đề → đề xuất phương án → admin tự chọn.

---

## 10. Sự cố thường gặp

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Dashboard hiện toàn số 0 / báo "Không tải được dữ liệu" | Backend chưa chạy, hoặc SQL Server chưa bật | Kiểm tra `logs/backend.err.log`; chạy `sc query MSSQLSERVER` xem service đã Running chưa |
| `npm run prisma:generate` báo lỗi kết nối DB | `DATABASE_URL` trong `.env` sai, hoặc SQL Server chưa bật | Kiểm tra lại `.env`, thử kết nối bằng SSMS trước |
| Chạy `start.bat` xong không thấy trình duyệt mở | Frontend compile lâu hơn 90 giây (lần đầu, máy yếu) | Đợi thêm rồi tự mở `http://localhost:3000`; xem `logs/frontend.log` |
| Port 3000/5000 đã bị chiếm | Có tiến trình cũ chưa tắt hẳn | Chạy `stop.bat`, hoặc `netstat -ano \| findstr :3000` rồi `taskkill /F /PID <pid>` |
| Dashboard/Báo cáo dữ liệu quá ít, biểu đồ trống | Chưa chạy `npm run prisma:seed-history` | Chạy lại lệnh này (Mục 5), idempotent nên an toàn |

---

## 11. Tài liệu liên quan

| File | Nội dung |
|---|---|
| [README.md](README.md) | Tóm tắt nhanh (tech stack, lệnh chạy) |
| [KIEN_TRUC_CHI_TIET.md](KIEN_TRUC_CHI_TIET.md) | Kiến trúc đầy đủ: sơ đồ, luồng nghiệp vụ, danh mục API, rủi ro kỹ thuật |
| [KIEN_TRUC_TONG_QUAN.md](KIEN_TRUC_TONG_QUAN.md) | Kiến trúc tóm tắt, dễ đọc |
| [Function.md](Function.md) | Đặc tả chi tiết từng chức năng/API |
| [SMART_UPGRADE_PLAN.md](SMART_UPGRADE_PLAN.md) | Thiết kế các tính năng thông minh (Mục 9) |
| [demo_accounts.md](demo_accounts.md) | Đầy đủ tài khoản demo + kịch bản demo gợi ý |
| [database/README.md](database/README.md) | Chi tiết setup database |

Có vướng mắc gì trong lúc setup — hỏi trong nhóm, đừng tự loay hoay quá 15 phút.
