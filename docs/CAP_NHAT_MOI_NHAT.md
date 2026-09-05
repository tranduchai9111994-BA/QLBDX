# Cập nhật mới nhất — tổng hợp & hướng dẫn kiểm chứng

> ⚠️ **Có đợt cập nhật mới hơn file này (05/09/2026 — chống tranh chấp đồng thời khi giành chỗ đỗ,
> CÓ migration DB).** Xem [SUA_LOI_RACE_CONDITION_CHO_DO.md](SUA_LOI_RACE_CONDITION_CHO_DO.md).
> Nội dung bên dưới là đợt 01/09/2026, vẫn còn hiệu lực.

> **Đọc file này trước.** Đây là bản tóm tắt những gì vừa sửa, kèm **cách tự kiểm chứng từng thay
> đổi** (bấm ở đâu, gõ gì, phải thấy gì). Cần chi tiết kỹ thuật thì theo đường dẫn ở mục 6.
>
> Cập nhật: 01/09/2026 · Nhánh: `fix/expert-rule-enabled-and-domain-validation`

---

## 1. Tóm tắt trong 1 phút

| # | Vấn đề trước đây | Đã sửa thành |
|---|---|---|
| 1 | Tắt một mốc cảnh báo nhưng nó **vẫn phát cảnh báo** | Chỉ luật đang bật mới được đưa vào Inference Engine |
| 2 | **Không có nút nào** để tắt một mốc cảnh báo | Thêm cột "Đang dùng" ở tab *Cấu hình mức độ* |
| 3 | Luật sai cấu trúc vẫn lưu được, tới lúc chạy mới lỗi | Validate riêng theo từng nhóm, chặn ngay lúc lưu kèm lời giải thích |
| 4 | Nội dung câu gợi ý nằm trong code, muốn sửa phải build lại | Nằm trong luật, sửa được trên giao diện |
| 5 | Phải **gõ JSON** mới thêm/sửa được luật | Nhập bằng ô chọn / ô chữ bình thường |
| 6 | Bấm icon mở app: không thấy phản hồi, bấm lại thì **khởi động lại từ đầu** | Hiện cửa sổ "Đang khởi động", bấm thêm không làm chậm nữa |

---

## 2. Sửa logic bật/tắt luật

**Lỗi cũ:** cảnh báo trong hệ thống không đi qua Inference Engine mà đọc thẳng bảng luật, và câu
đọc đó thiếu điều kiện lọc `enabled`. Kết quả: tắt mốc "Xe đỗ quá lâu ≥ 24h" xong nó vẫn báo.

**Đã sửa:** hàm cấp dữ liệu cho phần cảnh báo (`getAllGrouped()`) nay chỉ trả về mốc đang bật.
Màn hình quản lý vẫn thấy đủ cả mốc bật lẫn mốc tắt để bật lại.

Sửa kèm 1 lỗi nữa: bộ luật mặc định (gói dịch vụ / DSS / báo cáo) có thể **không bao giờ được nạp**
nếu tab *Cấu hình mức độ* được mở trước — vì cả hai ghi chung một bảng, mà điều kiện nạp lại là
"bảng còn trống". Nay nạp theo mã luật nên không phụ thuộc thứ tự nữa.

### Cách kiểm chứng

**Test A — tắt luật gợi ý báo cáo**

1. Vào **Cảnh báo → Cấu hình nâng cao**.
2. Tìm dòng `insight_long_parked` ("Xe đỗ quá lâu"), **gạt tắt** công tắc ở cột *Bật*.
3. Sang **Tổng quan**, kéo xuống mục *Gợi ý thông minh*.
4. **Kỳ vọng:** dòng gợi ý "Có N xe đỗ quá 24 giờ..." **biến mất**.
5. Bật lại công tắc → tải lại **Tổng quan** → dòng gợi ý **hiện lại**.

**Test B — tắt mốc cảnh báo** (đây là lỗi chính đã sửa)

1. Vào **Cảnh báo → Cấu hình mức độ**.
2. Tắt **cả hai** mốc "Xe đỗ quá lâu" (mốc 24 giờ và mốc 48 giờ).
   > Chỉ tắt mốc 24h thì số cảnh báo có thể **không đổi** — vì xe nào cũng đã đỗ quá 48h nên mốc
   > 48h vẫn bắt. Đây là đúng logic, không phải lỗi.
3. Sang tab **Danh sách cảnh báo**, bấm *Làm mới*.
4. **Kỳ vọng:** không còn cảnh báo nào tiêu đề "Xe đỗ quá lâu".
5. Bật lại cả hai mốc → *Làm mới* → cảnh báo quay lại đầy đủ.

**Test C — chạy thử luật đang tắt**

1. **Cảnh báo → Cấu hình nâng cao → Test luật**, chọn một luật đang **tắt**.
2. **Kỳ vọng:** hiện khung vàng "Luật này đang tắt — ... Bật luật ở cột Bật rồi thử lại", chứ
   không im lặng không ra kết quả như trước.

---

## 3. Validate luật theo từng nhóm

Mỗi nhóm luật cần thông tin khác nhau, nên hệ thống kiểm tra riêng theo nhóm — và kiểm tra **cả
giá trị**, không chỉ "có điền hay chưa".

| Nhóm | Bắt buộc phải có |
|---|---|
| **Gợi ý gói** (`package`) | Mức gói (gói tháng/quý/năm), Thời hạn gói (số ngày > 0), Mức tiết kiệm |
| **Ngưỡng cảnh báo** (`alert`) | Nội dung cảnh báo, Mức độ (Nguy hiểm/Cảnh báo/Thông tin), loại cảnh báo nằm trong 7 loại hệ thống hiểu |
| **Hỗ trợ quyết định** (`analytics`) | Quyết định hiển thị (d1/d2/d3), Câu hỏi quyết định |
| **Gợi ý báo cáo** (`report`) | Loại gợi ý (1 trong 5 loại), Nội dung gợi ý |

### Cách kiểm chứng

**Test D — luật thiếu thông tin thì không lưu được**

1. **Cảnh báo → Cấu hình nâng cao → Thêm luật**.
2. Nhóm: chọn *Gợi ý trên báo cáo tuần (report)*. Mã luật: `test_loi`. Tên: `Test lỗi`.
3. Điều kiện: chọn *Số xe đang đỗ quá 24 giờ*, toán tử `>`, giá trị `1`.
4. Ở phần *Kết quả khi luật khớp*: chọn Loại gợi ý nhưng **để trống Nội dung gợi ý**.
5. **Kỳ vọng:** không lưu được, báo đỏ *"Luật gợi ý báo cáo phải có params.message"*.

**Test E — giá trị lạ cũng bị chặn**

Nếu gọi thẳng API (VD bằng Postman) với `params.type = "abc"`, hệ thống trả lỗi 400 kèm danh sách
giá trị hợp lệ:

```
Loại gợi ý (params.type) không hợp lệ: "abc".
Hệ thống chỉ xử lý được: revenue_up, revenue_down, occupancy_warning, long_parking, renewal_campaign
```

Đây là câu trả lời cho câu hỏi *"rule sai thì hệ thống xử lý sao?"*.

---

## 4. Sửa nội dung gợi ý ngay trên giao diện + bỏ ô JSON

Trước đây form thêm/sửa luật bắt gõ JSON kiểu:

```json
{ "id": "d1", "template": "expand_zone", "message": "Có nên mở thêm chỗ đỗ ở {zone}?" }
```

Hai vấn đề: **không phải ai cũng biết JSON**, và ô `Loại hành động` là **thừa** — mỗi nhóm chỉ
dùng đúng một loại (nhóm `analytics` luôn là `decision`). Field `template` cũng thừa: được ghi
vào database nhưng **không có chỗ nào trong hệ thống đọc tới**.

**Đã sửa:**
- Form sinh ra các ô nhập cụ thể theo nhóm: dropdown cho những giá trị có sẵn, ô chữ cho nội dung.
- Ô *Dữ kiện* trong phần Điều kiện cũng thành dropdown có tên tiếng Việt (VD *"Số xe đang đỗ quá
  24 giờ"* thay vì phải nhớ `longParkedCount`).
- Ô *Loại hành động* bị bỏ — hệ thống tự điền, chỉ hiện một nhãn cho biết.
- Field `template` đã được xoá khỏi luật mặc định và tự dọn khỏi dữ liệu cũ.
- Nội dung gợi ý viết dạng câu bình thường, chèn số liệu bằng chỗ trống `{tên biến}`. Ngay dưới ô
  nhập có danh sách các chỗ trống dùng được, rê chuột vào từng cái sẽ hiện giải thích.

Danh sách lựa chọn trên form **lấy từ backend** (`GET /expert-rules/form-spec`) — cùng nguồn với
phần validate, nên dropdown không bao giờ lệch với giá trị mà server chấp nhận.

### Cách kiểm chứng

**Test F — form không còn JSON**

1. **Cảnh báo → Cấu hình nâng cao**, bấm **Sửa** ở luật `dss_zone_overloaded`.
2. **Kỳ vọng:** phần *Kết quả khi luật khớp* hiện:
   - Nhãn `decision` (không phải ô nhập) + dòng chú thích "hệ thống tự điền, bạn không cần nhập".
   - Ô **Quyết định hiển thị** = dropdown, đang chọn *"d1 — Mở thêm chỗ đỗ / điều phối sang khu trống"*.
   - Ô **Câu hỏi quyết định** = ô chữ, đang có `Có nên mở thêm chỗ đỗ ở {zone}?`, bên dưới có thẻ `{zone}`.
   - **Không còn ô JSON nào.**

**Test G — sửa câu chữ, kết quả đổi theo**

1. Vẫn ở luật `dss_zone_overloaded`, sửa *Câu hỏi quyết định* thành:
   `Khu {zone} sắp đầy — có nên mở thêm chỗ không?`
2. Bấm **Cập nhật**.
3. Vào **Quản trị → Phân tích & Gợi ý**, xem phần quyết định.
4. **Kỳ vọng:** câu hỏi hiển thị đúng câu mới, và `{zone}` được thay bằng tên khu thật (VD "Khu D").
5. Sửa lại về câu cũ nếu muốn.

**Test H — chưa chọn nhóm thì chưa hiện ô nhập**

1. Bấm **Thêm luật**, chưa chọn Nhóm.
2. **Kỳ vọng:** phần *Kết quả khi luật khớp* hiện hướng dẫn "Chọn Nhóm (domain) ở phía trên trước",
   không hiện ô JSON.

---

## 5. Tăng tốc mở app khi bấm icon

**Đo được từ log thật ngày 01/09:** bấm icon 3 lần liên tiếp (vì không thấy phản hồi) mất **61 giây**
— mỗi lần bấm lại **kill tiến trình đang khởi động dở** rồi làm lại từ đầu.

**Đã sửa:**

| Thay đổi | Kết quả đo được |
|---|---|
| Hiện cửa sổ **"Đang khởi động QLBDX..."** ngay khi bấm | Không còn tưởng app hỏng mà bấm lại |
| Khoá chống bấm trùng: lần bấm thứ 2 **chỉ chờ**, không khởi động lại | 3 lần bấm: **61s → ~10s** |
| Thay 2 lệnh quét cổng chậm bằng 1 lệnh `netstat` | Bớt ~1s mỗi lần mở |
| Tắt bước lint của dev server (`DISABLE_ESLINT_PLUGIN`) | Lần biên dịch lại từ đầu: **36.3s → 31.3s** |

Số liệu tham chiếu sau khi sửa: mở bình thường **~8-10 giây**; lần đầu sau khi sửa code **~31 giây**
(phải biên dịch lại toàn bộ giao diện — đây là giới hạn của dev server, không tránh được).

> Lint không bị mất, chỉ chuyển sang chạy khi cần: `cd frontend && npm run lint`
> (và `npm run typecheck` để kiểm tra kiểu).

### Cách kiểm chứng

**Test I — bấm icon nhiều lần không còn làm chậm**

1. Bấm **stop.bat** để tắt hẳn.
2. Bấm **start.bat** (hoặc shortcut ngoài Desktop) → thấy ngay cửa sổ *"Đang khởi động QLBDX..."*.
3. Trong lúc chờ, **bấm thêm 2 lần nữa**.
4. **Kỳ vọng:** trình duyệt mở ra sau khoảng 10 giây; mở `logs\launcher.log` sẽ thấy
   `Da co mot lan khoi dong dang chay - chi doi va mo trinh duyet (khong khoi dong lai).`
   thay vì các dòng `Dang tat process cu tren cong 3000` lặp lại.

**Test J — đọc thời gian thật trong log**

Mở `logs\launcher.log`, dòng cuối mỗi lần khởi động có dạng:

```
2026-09-01 18:39:35  San sang sau 8.0s! Mo trinh duyet.
```

---

## 6. Đường dẫn tới tài liệu chi tiết

| Cần tìm gì | Đọc file |
|---|---|
| Chi tiết kỹ thuật đợt sửa này: từng file sửa gì, code trước/sau, toàn bộ log kiểm thử end-to-end | [SUA_LOI_ENABLED_VA_VALIDATE_RULE.md](SUA_LOI_ENABLED_VA_VALIDATE_RULE.md) |
| Vì sao có module hệ chuyên gia, kiến trúc Knowledge Base / Inference Engine, việc gộp bảng ngưỡng cảnh báo cũ | [NANG_CAP_NANG_CAO.md](NANG_CAP_NANG_CAO.md) |
| Code mẫu có chú thích từng dòng của 5 tính năng thông minh | [CAU_TRUC_CODE_TINH_NANG_THONG_MINH.md](CAU_TRUC_CODE_TINH_NANG_THONG_MINH.md) |
| Giải thích kỹ thuật + bộ câu hỏi phản biện dự kiến và cách trả lời | [SMART_FEATURES_DEEP_DIVE.md](SMART_FEATURES_DEEP_DIVE.md) |
| Lịch sử các đợt cập nhật, hướng dẫn `git pull` / cập nhật database | [CHANGELOG.md](CHANGELOG.md) |
| Kiến trúc tổng thể hệ thống | [KIEN_TRUC_TONG_QUAN.md](KIEN_TRUC_TONG_QUAN.md) · [KIEN_TRUC_CHI_TIET.md](KIEN_TRUC_CHI_TIET.md) |
| Đặc tả chức năng theo từng endpoint API | [Function.md](Function.md) |
| Tài khoản demo để đăng nhập thử | [demo_accounts.md](demo_accounts.md) |
| Cài đặt máy mới từ đầu | [../ONBOARDING.md](../ONBOARDING.md) |
| Dựng lại database, ý nghĩa từng script seed | [../database/README.md](../database/README.md) |

---

## 7. Chuẩn bị trước khi test

```bash
git pull
```

**Không cần chạy migration** — đợt này không đổi cấu trúc database. Dữ liệu luật cũ được tự bổ sung
phần còn thiếu khi backend khởi động.

Khởi động lại để backend nạp code mới:

```bash
stop.bat
```

```bash
start.bat
```

Đăng nhập bằng tài khoản admin (`admin` / `admin123` — xem [demo_accounts.md](demo_accounts.md)),
vì toàn bộ màn hình cấu hình luật chỉ admin mới vào được.

---

## 8. Bảng đối chiếu nhanh khi demo với thầy

| Thầy hỏi | Mở màn hình nào | Chứng minh bằng gì |
|---|---|---|
| "Tri thức nằm ở đâu, có phải hardcode không?" | Cảnh báo → Cấu hình nâng cao | Bảng luật đọc từ database, sửa được ngay trên giao diện |
| "Tắt một luật thì sao?" | Test A hoặc Test B ở trên | Gợi ý/cảnh báo tương ứng biến mất, bật lại thì quay về |
| "Rule sai thì hệ thống xử lý thế nào?" | Test D ở trên | Báo lỗi rõ ràng, không cho lưu |
| "Hệ thống giải thích được vì sao đưa ra gợi ý không?" | Cấu hình nâng cao → Test luật | Chuỗi giải thích kiểu `frequency = 22 >= 20 → đúng` |
| "Người không biết lập trình có sửa được luật không?" | Test F ở trên | Toàn bộ là dropdown và ô chữ, không có JSON |
