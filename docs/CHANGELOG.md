# Lịch sử cập nhật hệ thống QLBDX

---

## 01/09/2026 — Sửa logic `enabled` của luật & validate luật theo domain

**Không có thay đổi schema, không cần chạy migration.** Chỉ cần `git pull` rồi restart backend —
dữ liệu luật cũ được tự bù field còn thiếu khi khởi động.

| Nhóm | Thay đổi |
|---|---|
| Sửa lỗi | Mốc cảnh báo đã tắt vẫn phát cảnh báo — `alertRuleTierService.getAllGrouped()` không lọc `enabled`. Đã lọc. |
| Sửa lỗi | Luật mặc định (`package`/`analytics`/`report`) có thể không bao giờ được seed nếu tab "Cấu hình mức độ" ghi luật `alert` trước. Đã đổi sang seed theo mã luật. |
| Mới | Cột bật/tắt mốc ngưỡng ở tab Cảnh báo → "Cấu hình mức độ" (trước đó không có UI nào tắt được luật `alert`). |
| Mới | Validate luật theo từng domain (`expertSystem/validation.ts` + `domainSpecs.ts`) — chặn cả trường hợp luật lưu được nhưng runtime không xử lý được. |
| Mới | Nội dung câu gợi ý chuyển vào `action.params.message` dạng mẫu `{tenBien}` — admin sửa câu chữ trên UI, không cần build lại. |
| Mới | Form thêm/sửa luật không còn bắt gõ JSON: dropdown + ô chữ sinh từ khuôn form backend gửi về (`GET /expert-rules/form-spec`). Ô "Loại hành động" bị bỏ vì mỗi nhóm chỉ dùng đúng 1 loại. |
| Dọn | Bỏ field thừa `params.template` (ghi vào DB nhưng không service nào đọc) — tự dọn khỏi dữ liệu cũ khi khởi động. |
| Hiệu năng | Bấm icon mở app: thêm cửa sổ "Đang khởi động" + khoá chống bấm trùng. Bấm 3 lần liên tiếp trước đây mất 61s (mỗi lần bấm kill tiến trình đang khởi động dở), nay ~10s. |
| Hiệu năng | Tắt bước lint của dev server (`frontend/.env`) — biên dịch lại từ đầu 36.3s → 31.3s. Lint chuyển sang `npm run lint`. |

Tóm tắt + cách tự kiểm chứng từng thay đổi: [CAP_NHAT_MOI_NHAT.md](CAP_NHAT_MOI_NHAT.md).
Chi tiết kỹ thuật + log kiểm thử: [SUA_LOI_ENABLED_VA_VALIDATE_RULE.md](SUA_LOI_ENABLED_VA_VALIDATE_RULE.md).

---

## 29/08/2026 — Rule-based Expert System & hợp nhất cấu hình cảnh báo

Chuyển các logic "thông minh" từ if/else hardcode sang module hệ chuyên gia
(`backend/src/expertSystem/`), gộp bảng `AlertRuleTier` cũ vào `ExpertRule` (`domain = "alert"`).
Có migration DB (`20260828235326_add_expert_rule`, `20260829000000_drop_alert_rule_tier`).

Chi tiết: [NANG_CAP_NANG_CAO.md](NANG_CAP_NANG_CAO.md).

---

## 26/08/2026 — Đợt cập nhật lớn (hướng dẫn bên dưới)

File này mô tả toàn bộ thay đổi trong đợt cập nhật này, hướng dẫn tải về/cập nhật cho các thành viên trong nhóm, và cách lấy dữ liệu mới nhất để kiểm tra.

---

## 1. Cách cập nhật (dành cho thành viên nhóm)

### Bước 1 — Kéo code mới nhất

```bash
git pull origin main
```

### Bước 2 — Cài lại dependency (không bắt buộc, nhưng nên làm cho chắc)

```bash
cd backend && npm install
cd ../frontend && npm install
```

> Đợt này **không thêm package mới**, chỉ đổi code — nhưng cứ chạy `npm install` để an toàn nếu máy bạn lâu chưa cập nhật.

### Bước 3 — Cập nhật database (chọn 1 trong 2 cách)

**Cách nhanh nhất — restore đè bằng backup mới (khuyến nghị):**

File `database/ParkingManagement.bak` đã được cập nhật, có sẵn đầy đủ bảng mới + dữ liệu (~39.000 bản ghi lịch sử đỗ xe nhiều năm). Restore đè lên database cũ:

```bash
sqlcmd -S localhost -U sa -P 123 -Q "RESTORE DATABASE [ParkingManagement] FROM DISK = N'database/ParkingManagement.bak' WITH REPLACE"
```

Hoặc trong SSMS: chuột phải **Databases → Restore Database... → Device → chọn `ParkingManagement.bak`** → tick **Overwrite the existing database (WITH REPLACE)** → OK.

**Cách khác — chỉ chạy migration (nếu bạn có dữ liệu riêng đang test, không muốn mất):**

```bash
cd backend
npx prisma migrate deploy
```

Lệnh này chỉ áp 3 migration mới (thêm bảng lịch sử giá, index tăng tốc, bảng cấu hình cảnh báo) — **giữ nguyên dữ liệu hiện có** của bạn. Bảng cấu hình cảnh báo (`AlertSettings`) sẽ tự tạo giá trị mặc định khi vào trang Cảnh báo lần đầu, không cần seed thủ công.

### Bước 4 — Khởi động lại app

```bash
# Windows — bấm icon Desktop như bình thường (đã sửa nhanh hơn nhiều, xem mục 4)
# Hoặc chạy tay:
cd backend && npm run dev
cd frontend && npm start
```

---

## 2. Tổng quan các cải tiến

### A. Nâng cấp giao diện (UIUX) — theo đề xuất trong `docs/archive/QLBDX_UIUX_Review_and_Remediation_Plan.md`

- **Tách Dashboard theo vai trò**: Nhân viên thấy màn hình vận hành (xe đỗ, khu bãi, **"Ca của tôi"** — đối soát tiền mặt riêng của mình); Quản trị thấy snapshot nhanh + có nút chuyển qua lại 2 view. Bỏ hero banner rườm rà, bỏ đồng hồ giây trùng lặp ở header.
- **Sửa mâu thuẫn số liệu**: trước đây có chỗ ghi "đỗ >8 giờ", chỗ khác ghi "đỗ >24 giờ" cho cùng 1 khái niệm — nay thống nhất 1 ngưỡng.
- **Chuẩn hoá giao diện dùng chung**: thanh tiêu đề trang, nhóm sidebar (Vận hành / Danh mục / Quản trị) **có thể thu gọn/mở ra**, thẻ trạng thái (StatusTag), nút xác nhận xoá, thanh bộ lọc, phân quyền hiển thị — dùng lại 1 component cho toàn bộ thay vì mỗi trang viết riêng một kiểu.
- **Dọn màu sắc**: thay toàn bộ mã màu hex viết cứng bằng biến CSS dùng chung, để đổi theme sau này dễ hơn.
- **Hoàn thiện đa ngôn ngữ (VI/EN)**: kể cả khung Nhập Excel, trước đó bị bỏ sót.
- **Đổi thương hiệu**: dùng logo thật (`frontend/Logo.png`) làm favicon, icon sidebar, icon trang đăng nhập, và **icon desktop**; đổi tên hiển thị "ParkManager" (sai) → "Quản lý bãi đỗ xe" (đúng, thống nhất toàn hệ thống).
- **Sửa lỗi nút "Xuất báo cáo" chữ mờ không đọc được** (lỗi CSS khiến chữ cùng màu với nền).
- **Sửa lỗi chính tả** "Vãn lai" → "Vãng lai".

### B. Hiệu năng

- **Sửa lỗi "Lịch sử thanh toán" tải rất lâu / treo**: nguyên nhân là API trả về **toàn bộ 38.000+ bản ghi** cùng lúc không phân trang. Nay phân trang phía server — tải xong dưới 1 giây thay vì treo vô thời hạn.
- **Thêm tuỳ chọn số dòng/trang (10/20/30/50/100 + gõ số nhảy trang)** cho 11 trang danh sách: Thanh toán, Phương tiện, Khách hàng, Loại xe, Gói dịch vụ, Đăng ký gói, Người dùng, Bãi đỗ xe, Lịch sử đỗ xe, Nhật ký hoạt động, Cảnh báo.
- **Sửa lỗi khởi động app chậm (10-20 giây mỗi lần bấm icon)**: trước đây icon luôn tắt-bật lại toàn bộ server dù app đang chạy sẵn. Nay kiểm tra trước — nếu đã chạy thì mở thẳng trình duyệt trong khoảng 1 giây.

### C. Cảnh báo hệ thống thông minh hơn

- **Tự cấu hình được ngưỡng cảnh báo** (mục **Cảnh báo → tab "Cấu hình mức độ"**, chỉ Quản trị viên thấy): số chỗ trống coi là sắp đầy, ngưỡng % mất cân bằng giữa các khu, số giờ đỗ lâu, số tiền giao dịch bất thường, % sụt doanh thu, tần suất gợi ý gia hạn... Trước đây toàn bộ các mức này viết cứng trong code, mỗi bãi xe lại có nhu cầu khác nhau nên giờ tự chỉnh được, không cần sửa code.
- **Sửa lỗi hiển thị dữ liệu kỹ thuật cho người dùng xem**: một số dòng cảnh báo trước đây in ra thẳng tên biến tiếng Anh kiểu `maxZone: Khu D · maxOccupancy: 100` — nay bỏ hẳn, chỉ hiện câu mô tả tiếng Việt.
- **Icon báo có bản cập nhật mới**: góc phải trên cùng, tự kiểm tra mỗi phút — có bản mới thì hiện icon xoay màu vàng, bấm vào là tải lại trang ngay, không cần tắt mở lại app thủ công.

### D. Định dạng ngày giờ

- Thống nhất toàn hệ thống về 1 định dạng duy nhất: **hh:mm:ss dd/mm/yyyy** (có số 0 phía trước, ví dụ `08:05:00 01/08/2026` thay vì `8:5:0 1/8/2026`) — áp dụng cho Cảnh báo, Thanh toán, Lịch sử đỗ xe, Nhật ký hoạt động, Xe vào/ra, Báo cáo.
- Sửa **regex biển số xe** — mẫu cũ chỉ chấp nhận dạng "29A12345", không khớp với biển 2 chữ cái ("59FA2345"), biển có số series ("59N156789"), hay mã nội bộ cho xe đạp ("XD001") — vốn đều là dữ liệu có thật trong hệ thống nhưng nhập lại thì bị báo lỗi sai định dạng.

---

## 3. Muốn tự tạo lại dữ liệu từ đầu thay vì dùng file backup?

Chỉ cần khi bạn muốn dữ liệu demo hoàn toàn mới (không dùng `.bak` có sẵn):

```bash
cd backend
npx prisma migrate deploy      # tạo schema mới nhất
npm run prisma:seed            # dữ liệu demo cơ bản (~1.500 lượt đỗ xe)
npm run prisma:seed-history    # bồi thêm dữ liệu nhiều năm (~39.000 bản ghi, ~2-3 phút, chạy lại vô tư)
```

Xem chi tiết đầy đủ về cấu trúc dữ liệu, tài khoản đăng nhập mẫu tại `database/README.md`.

---

## 4. Có gì cần lưu ý (breaking changes)

- **Không có breaking change nào phá vỡ dữ liệu cũ.** Migration mới chỉ *thêm* bảng/cột, không xoá/đổi kiểu dữ liệu hiện có.
- API `/payments` đổi từ trả về mảng thẳng sang trả về `{ data, total, page, pageSize }` — nếu bạn có code/script nào gọi trực tiếp API này (ngoài giao diện web), cần cập nhật theo cấu trúc mới.
- Regex biển số xe được nới lỏng hơn — biển số đã lưu trước đây vẫn hợp lệ, chỉ là **nhập biển số mới** giờ chấp nhận thêm nhiều định dạng hơn trước.

---

## 5. Đợt cập nhật bổ sung (cùng ngày) — hoàn tất toàn bộ hạng mục còn lại trong kế hoạch UIUX

Sau đợt cập nhật ở mục 1–4, đã xử lý nốt 3 câu hỏi "Need Confirm" còn treo và 6 hạng mục kỹ thuật cuối cùng trong `docs/archive/QLBDX_UIUX_Review_and_Remediation_Plan.md` (mục 8, Q6/Q7/Q10 và mục 5.2, T-02/T-06/T-10/T-12/T-13/T-17). Không cần thêm bước cập nhật nào (không đổi schema, không thêm package) — chỉ cần `git pull` lại code mới nhất.

### A. Sửa bug "Khu D 100% lấp đầy nhưng doanh thu 0đ" (Q6)

Xác nhận đây là **bug tính toán**, không phải nghiệp vụ đúng: công thức tỷ lệ lấp đầy trong trang Phân tích trước đây đọc tình trạng chỗ đỗ **tại thời điểm xem trang**, bất kể đang chọn xem theo tháng hay theo quý — nên đổi kỳ xem vẫn ra cùng 1 con số, không khớp với doanh thu của đúng kỳ đó. Đã sửa lại thành tính đúng theo khoảng thời gian đang chọn (thời gian mỗi xe *thực sự* chiếm chỗ trong kỳ đó).

### B. Chế độ Tối (Dark Mode) (Q7)

Bãi có ca trực đêm nên đã bổ sung chế độ giao diện tối — bấm icon mặt trăng/mặt trời ở góc phải header để chuyển đổi, hệ thống nhớ lựa chọn cho lần sau. Toàn bộ màu sắc giao diện (kể cả bảng biểu, thẻ AntD) đều đổi theo, không cần chỉnh riêng từng trang.

### C. Thêm chức năng Sửa cho trang Thanh toán (Q10)

Trang Thanh toán trước đây chỉ xem, không sửa được — xác nhận đây là thiếu sót (gap), không phải chủ đích kiểm toán. Đã thêm nút "Sửa" cho mỗi giao dịch, cho phép chỉnh lại số tiền/phương thức thanh toán/ghi chú khi ghi nhận nhầm. Mọi lần sửa đều được ghi lại vào Nhật ký hoạt động để có thể tra soát sau này (chỉ Quản trị viên có quyền sửa).

### D. Chuẩn hoá bảng biểu toàn hệ thống

Toàn bộ bảng dữ liệu trên tất cả các trang giờ đều có độ rộng cột cố định và cắt chữ tràn (`...`) thay vì dồn/vỡ layout khi nội dung dài; các cột tiền/số đều căn phải và canh chữ số thẳng hàng, dễ so sánh hơn khi liệt kê danh sách dài.

### E. Đồng bộ màu sắc & chặn hardcode màu

Toàn bộ mã màu viết cứng (hex) còn sót lại trong giao diện được thay bằng biến màu dùng chung, đảm bảo đổi theme sáng/tối luôn nhất quán trên mọi trang. Đồng thời bật sẵn cảnh báo tự động (lint) để nếu sau này có ai vô tình viết cứng màu mới, hệ thống sẽ nhắc ngay lúc code thay vì phải rà tay.

### F. Cảnh báo màn hình nhỏ

Ứng dụng được thiết kế tối ưu cho màn hình desktop (từ 1366px trở lên). Nếu mở trên màn hình/cửa sổ nhỏ hơn 1024px, hệ thống hiện banner cảnh báo ở đầu trang thay vì để giao diện vỡ âm thầm không rõ nguyên nhân.

### G. Dọn dẹp kỹ thuật (không ảnh hưởng người dùng cuối)

Gộp lại các đoạn code lặp giữa nhiều chức năng xuất báo cáo CSV, bỏ 1 đoạn CSS viết trực tiếp trong file trang (chuyển vào file CSS chung theo đúng quy ước của hệ thống).
