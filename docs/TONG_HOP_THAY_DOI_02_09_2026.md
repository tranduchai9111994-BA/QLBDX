# Tổng hợp thay đổi — phiên làm việc 02/09/2026

> **Dành cho:** thành viên trong nhóm kiểm tra, đối chiếu lại toàn bộ thay đổi.
> **Phạm vi:** từ commit `7932766` (trước phiên) đến `327f9bc`.
> **Kết quả:** 6 commit, đã push lên `origin/main`.
> **Cam kết quan trọng:** **KHÔNG có thay đổi nào làm đổi hành vi ngoài ý muốn.** Chỉ 1 sửa lỗi
> + 1 tính năng mới (đều đã test API thật), phần còn lại là comment và tài liệu.

---

## Mục lục

1. [Bảng tóm tắt 6 commit](#1-bảng-tóm-tắt-6-commit)
2. [Thay đổi 1 — Sửa lỗi `PUT` ghi đè field không gửi](#2-thay-đổi-1--sửa-lỗi-put-ghi-đè-field-không-gửi)
3. [Thay đổi 2 — Thêm endpoint `PATCH /:id/enabled`](#3-thay-đổi-2--thêm-endpoint-patch-idenabled)
4. [Thay đổi 3 — Comment toàn bộ mã nguồn FE→BE](#4-thay-đổi-3--comment-toàn-bộ-mã-nguồn-febe)
5. [Thay đổi 4 — Tài liệu mới](#5-thay-đổi-4--tài-liệu-mới)
6. [Cách tự kiểm chứng lại](#6-cách-tự-kiểm-chứng-lại)
7. [Việc đã cân nhắc nhưng CỐ Ý không làm](#7-việc-đã-cân-nhắc-nhưng-cố-ý-không-làm)
8. [Đọc thêm](#8-đọc-thêm)

---

## 1. Bảng tóm tắt 6 commit

| # | Commit | Loại | File đổi | Nội dung |
|---|---|---|---|---|
| 1 | `207dddd` | 🐛 Sửa lỗi | 2 (+209 / −3) | `update()` không còn ghi đè `enabled` / `priority` / `description` khi payload không gửi |
| 2 | `5d2e5ed` | ✨ Tính năng | 6 (+133 / −18) | Thêm `PATCH /api/expert-rules/:id/enabled` cho thao tác bật/tắt nhanh |
| 3 | `3d8dc97` | 📝 Comment | 26 (+863 / −10) | Backend: nền tảng, đăng nhập, vận hành bãi xe, hệ chuyên gia |
| 4 | `d8819e8` | 📝 Comment | 32 (+374 / −6) | Backend: gói dịch vụ, loại xe, tài khoản, báo cáo + 26 file còn trống |
| 5 | `3ce5848` | 📝 Comment | 44 (+450 / −4) | Frontend: toàn bộ màn hình và thành phần dùng chung |
| 6 | `327f9bc` | 📄 Tài liệu | 1 (+339) | `docs/HUONG_DAN_DOC_CODE.md` — bản đồ đọc code |

**Chỉ commit 1 và 2 đụng vào logic.** Commit 3, 4, 5 chỉ thêm dòng comment (số dòng xoá rất
nhỏ là do phải chèn comment vào giữa các dòng có sẵn, không phải xoá logic).

---

## 2. Thay đổi 1 — Sửa lỗi `PUT` ghi đè field không gửi

**File:** [backend/src/services/expertRule.service.ts](../backend/src/services/expertRule.service.ts) — hàm `update()`

### 2.1. Lỗi là gì

`PUT /api/expert-rules/:id` là endpoint **thay thế toàn bộ** (full-replace): controller truyền
thẳng `req.body` xuống service, không có bước gộp với bản ghi cũ. Trong `update()` cũ, ba field
tuỳ chọn dùng toán tử `??` để đặt giá trị mặc định:

```ts
// ❌ TRƯỚC
description: data.description ?? null,    // không gửi -> XOÁ TRẮNG mô tả
priority:    data.priority   ?? 100,      // không gửi -> RESET độ ưu tiên về 100
enabled:     data.enabled    ?? true,     // không gửi -> BẬT LẠI luật đang tắt
```

Prisma **bỏ qua** field mang giá trị `undefined` (tức giữ nguyên giá trị trong DB). Nhưng `??` đã
biến `undefined` thành một giá trị cụ thể **trước khi** tới Prisma, nên Prisma buộc phải ghi đè.

### 2.2. Vì sao validate không chặn được

`validateRule()` chỉ bắt buộc `code`, `domain`, `conditions`, `actions`
([validation.ts:31](../backend/src/expertSystem/validation.ts)). Ba field trên là tuỳ chọn nên
payload thiếu chúng **vẫn qua validate** và đi thẳng xuống Prisma.

### 2.3. Sửa thế nào

```ts
// ✅ SAU
...(data.description !== undefined && { description: data.description }),
...(data.priority   !== undefined && { priority: data.priority }),
...(data.enabled    !== undefined && { enabled: data.enabled }),
```

Cú pháp *conditional spread*: điều kiện sai thì `false && {...}` cho ra `false`, và spread một
giá trị `false` không thêm khoá nào vào object — field đó vắng mặt hoàn toàn nên Prisma bỏ qua.

**Ba điểm cần lưu ý khi đối chiếu:**

| Điểm | Giải thích |
|---|---|
| Dùng `!== undefined`, **không** dùng `??` hay kiểm tra "có giá trị thật" | Để `description: null` vẫn xoá được mô tả như trước. Nếu dùng truthy check thì `null` bị bỏ qua và không bao giờ xoá được mô tả nữa. |
| `create()` **giữ nguyên** `??` | Đó là giá trị mặc định hợp lệ cho bản ghi mới, không phải lỗi. |
| Không sửa frontend | `ExpertRulesPanel.tsx` vốn đã gửi đủ field, hành vi UI không đổi. |

### 2.4. Ví dụ đối chiếu — chạy thật

Rule đang ở trạng thái: `enabled = false`, `priority = 42`, `description = "Mo ta ban dau"`.
Gửi request chỉ đổi tên:

```bash
PUT /api/expert-rules/21
{
  "code": "TEST_PARTIAL_UPDATE", "domain": "report", "name": "Ten moi sau khi sua",
  "conditions": [{"fact":"revenueGrowth","operator":"gte","value":15}],
  "actions": [{"type":"suggestion","params":{"type":"revenue_up","message":"Doanh thu tang"}}]
}
```

| Field | Code CŨ | Code MỚI | Đúng? |
|---|---|---|---|
| `name` | "Ten moi sau khi sua" | "Ten moi sau khi sua" | ✅ cả hai |
| `conditions[0].value` | 15 | 15 | ✅ cả hai |
| `enabled` | **`true`** ❌ (bị bật lại!) | `false` | ✅ mới |
| `priority` | **`100`** ❌ (bị reset) | `42` | ✅ mới |
| `description` | **`null`** ❌ (bị xoá) | "Mo ta ban dau" | ✅ mới |

### 2.5. Bằng chứng: bộ test bắt đúng lỗi

Để chứng minh bộ test không phải "luôn xanh", đã `git stash` bản sửa rồi chạy lại trên code cũ:

```
raw: {"id":22,...,"description":null,"priority":100,...,"enabled":true,...}
  [PASS] name đã đổi
  [PASS] conditions đã đổi (value=15)
  [FAIL] REGRESSION: enabled bị reset về true
  [FAIL] REGRESSION: priority bị reset
  [FAIL] REGRESSION: description bị xóa
```

Code cũ **fail đúng 3 điểm**, code mới pass cả 3.

### 2.6. Mức độ ảnh hưởng thực tế

| Tác nhân | Có gửi `enabled`? | Dính lỗi? |
|---|---|---|
| Form sửa luật trên UI | Có (`values.enabled`) | Không |
| Switch bật/tắt trên bảng | Có (gửi cả object) | Không |
| Postman / script / mobile sau này | Có thể không | **Có** |

⇒ Đây là **lỗi tiềm ẩn** (latent bug), không phải sự cố đang xảy ra. Nhưng là **hợp đồng API
sai** — cần sửa trước khi có client thứ hai.

📖 Chi tiết đầy đủ: [SUA_LOI_PARTIAL_UPDATE_EXPERT_RULE.md](SUA_LOI_PARTIAL_UPDATE_EXPERT_RULE.md)

---

## 3. Thay đổi 2 — Thêm endpoint `PATCH /:id/enabled`

### 3.1. Vì sao cần

Switch bật/tắt trên bảng quản trị trước đây gọi `PUT /expert-rules/:id` và phải **gửi lại toàn bộ
object rule** chỉ để đổi một giá trị luận lý. Ba vấn đề:

1. Chạy lại `validateRule()` cho dữ liệu vốn đã hợp lệ trong DB — thừa.
2. Mọi field client gửi kèm đều có cơ hội ghi đè nhầm. Nếu state phía UI lệch (ví dụ danh sách
   chưa tải lại sau khi người khác vừa sửa luật), một cú bật/tắt sẽ ghi đè bằng **dữ liệu cũ**.
3. Quên gửi field nào thì lại rơi đúng vào lớp lỗi vừa sửa ở mục 2.

Bật/tắt là **cập nhật một phần trên đúng 1 cột** — đúng ngữ nghĩa của `PATCH`, không phải `PUT`.

### 3.2. Các file đã đổi

| Lớp | File | Nội dung |
|---|---|---|
| Service | [expertRule.service.ts](../backend/src/services/expertRule.service.ts) | Thêm `setEnabled()`; map lỗi Prisma `P2025` → HTTP 404 |
| Controller | [expertRule.controller.ts](../backend/src/controllers/expertRule.controller.ts) | Thêm `setEnabled()`; trả 400 nếu `body.enabled` không phải boolean |
| Route | [expertRule.routes.ts](../backend/src/routes/expertRule.routes.ts) | `router.patch('/:id/enabled', auth, adminOnly, ...)` |
| Hook FE | [useExpertRules.ts](../frontend/src/hooks/useExpertRules.ts) | Thêm `setRuleEnabled(id, enabled)` |
| UI | [ExpertRulesPanel.tsx](../frontend/src/components/ExpertRulesPanel.tsx) | `handleToggleEnabled` dùng `setRuleEnabled` thay `updateRule` |

### 3.3. Code chính

```ts
async setEnabled(id: number, enabled: boolean, updatedBy?: number) {
  const row = await prisma.expertRule.update({
    where: { id },
    data: { enabled, updatedBy },        // ← chỉ đúng 1 cột + người sửa
  }).catch((err: any) => {
    if (err?.code === 'P2025') {          // Prisma: không tìm thấy bản ghi
      const e = ruleError(`Không tìm thấy luật id = ${id}`);
      e.status = 404;                     // nếu không bắt -> controller trả 500 (sai ngữ nghĩa)
      throw e;
    }
    throw err;
  });
  await knowledgeBase.reload();           // Inference Engine chỉ nạp luật enabled = true
  return { ...row, conditions: JSON.parse(row.conditions), actions: JSON.parse(row.actions) };
}
```

**Điểm mấu chốt:** hàm này **không đọc field nào khác ngoài `enabled`**. Dù client có gửi kèm
`name`, `conditions`… cũng không thể làm hỏng nội dung luật.

**Vì sao vẫn phải `knowledgeBase.reload()`:** Cơ sở tri thức giữ luật trong bộ nhớ và chỉ nạp
luật `enabled = true` ([knowledgeBase.ts](../backend/src/expertSystem/knowledgeBase.ts) → `load()`).
Không nạp lại thì luật vừa tắt vẫn tiếp tục "cháy" cho tới lần reload sau.

### 3.4. So sánh trước / sau

| | Trước (PUT) | Sau (PATCH) |
|---|---|---|
| Dữ liệu gửi lên | Toàn bộ rule (~10 field, gồm cả JSON điều kiện/hành động) | `{ "enabled": false }` |
| Chạy `validateRule()` | Có (thừa) | Không |
| Rủi ro ghi đè nhầm nội dung luật | Có | **Không thể** |
| Mã lỗi khi id không tồn tại | 500 | **404** |

### 3.5. Tương thích ngược

`PUT /expert-rules/:id` **giữ nguyên**, vẫn cập nhật được `enabled` khi có gửi. Endpoint PATCH là
**bổ sung**, không phá client cũ.

### 3.6. Kết quả test — 18/18 PASS

| # | Kịch bản | Kết quả |
|---|---|---|
| 1 | `PATCH {enabled:false}` → response + DB đều `false` | PASS |
| 1b | `name` / `priority` / `description` / `conditions` **giữ nguyên** sau PATCH | PASS ×4 |
| 2 | `PATCH {enabled:true}` → bật lại được | PASS |
| 3 | Body `{}`, `{"enabled":"false"}`, `{"enabled":1}`, `{"enabled":null}` → **400** | PASS ×4 |
| 4 | Không token → **401** · token nhân viên → **403** (`adminOnly`) | PASS ×2 |
| 5 | `id` không tồn tại → **404** (không phải 500) | PASS |
| 6 | Route `/:id/enabled` **không đè** `/:id`: `PUT` và `DELETE` vẫn chạy đúng | PASS ×2 |

**Test UI thật** (backend + frontend cùng chạy, đăng nhập `admin`, vào Cảnh báo → Cấu hình nâng cao,
bấm Switch):

```
[2164.118] PATCH http://localhost:5000/api/expert-rules/4/enabled -> 200 OK
[2164.119] GET   http://localhost:5000/api/expert-rules            -> 200 OK
```

⇒ Không còn `PUT` nào. Tải lại trang, Switch hiển thị đúng trạng thái trong DB. Toàn bộ 19 luật đã
khôi phục về `enabled = true` như ban đầu, không để lại dữ liệu rác.

📖 Chi tiết: [SUA_LOI_PARTIAL_UPDATE_EXPERT_RULE.md § 6](SUA_LOI_PARTIAL_UPDATE_EXPERT_RULE.md)

---

## 4. Thay đổi 3 — Comment toàn bộ mã nguồn FE→BE

### 4.1. Mục tiêu

Mở bất kỳ file nào cũng đọc và giải thích được ngay, phục vụ bảo vệ đồ án và bảo trì về sau.

| | Trước | Sau |
|---|---|---|
| File backend thiếu comment | 34 / 88 | **0** |
| File frontend không có khối mô tả đầu file | 39 / 52 | **0** ¹ |
| Tổng dòng comment thêm vào | | **~1.690** |

¹ Trừ `react-app-env.d.ts` (file do Create React App sinh tự động, không nên sửa).

### 4.2. Quy ước 3 mức

| Mức | Đặt ở đâu | Nội dung |
|---|---|---|
| 1 | Đầu file, khối `/** … */` | File này làm gì · nằm ở đâu trong luồng · liên kết tới file liên quan |
| 2 | Trên mỗi hàm public, JSDoc | Hàm làm gì · tham số nghĩa là gì · trả về gì |
| 3 | Trong thân hàm, `//` | Chỉ ở chỗ **khó**, và luôn giải thích **VÌ SAO** |

**Nguyên tắc quan trọng nhất — không thuật lại điều dòng lệnh đã nói.**

```ts
// ❌ KHÔNG viết kiểu này (dòng lệnh đã tự nói rồi)
// tăng i lên 1
i++;

// ✅ Viết kiểu này (giải thích điều code KHÔNG nói được)
// Điều kiện status = 'parked' rất quan trọng: nếu chỉ tìm theo id thì bấm "Xe ra" hai lần
// (mạng chậm, người dùng bấm lại) sẽ tính phí và tạo phiếu thu lần thứ hai cho cùng một lượt.
const record = await prisma.parkingRecord.findFirst({
  where: { id: params.recordId, status: 'parked' },
```

### 4.3. Ví dụ header đầu file

```ts
/**
 * Thuật toán tính phí gửi xe.
 *
 * Vị trí trong luồng:
 *   pages/ParkingExit.tsx (bấm "Xe ra") -> POST /api/parking/exit
 *     -> parking.service.ts lấy giá theo loại xe + kiểm tra gói
 *     -> calculateParkingFee() ở file này ra số tiền
 *     -> tạo bản ghi Payment -> màn hình Thanh toán
 *
 * Đây là HÀM THUẦN (pure function): kết quả chỉ phụ thuộc tham số truyền vào, không đọc DB,
 * không đọc giờ hệ thống. Nhờ vậy có thể kiểm thử bằng cách gọi trực tiếp với dữ liệu giả.
 *
 * Quy tắc tính (ví dụ xe máy: hourlyRate = 5.000đ, dailyRate = 30.000đ):
 * - Gửi <= 24 giờ: fee = min(số giờ x giá giờ, giá ngày)
 *     gửi 10 giờ -> min(50.000, 30.000) = 30.000đ  (bị chặn trần bởi giá ngày)
 * ...
 */
```

### 4.4. Những chỗ được giải thích sâu nhất (nên xem trước khi bảo vệ)

| File | Nội dung được làm rõ |
|---|---|
| [utils/feeCalculator.ts](../backend/src/utils/feeCalculator.ts) | Vì sao có trần giá ngày · vì sao làm tròn lên · vì sao là hàm thuần |
| [services/parking.service.ts](../backend/src/services/parking.service.ts) | Chốt giá lúc xe vào · chống bấm "Xe ra" hai lần · vì sao gộp chung `completeExit` |
| [expertSystem/inferenceEngine.ts](../backend/src/expertSystem/inferenceEngine.ts) | Suy diễn tiến · vì sao cần `length > 0` · vì sao giữ cả luật không thoả |
| [middlewares/auth.ts](../backend/src/middlewares/auth.ts) | Vì sao verify token rồi vẫn phải đọc lại DB |
| [services/auth.service.ts](../backend/src/services/auth.service.ts) | Vì sao 2 lỗi đăng nhập báo giống nhau · bcrypt muối riêng |
| [services/customerPackage.service.ts](../backend/src/services/customerPackage.service.ts) | Cách dùng hệ chuyên gia để gợi ý gói · công thức chống chồng gói |
| [utils/businessRules.ts](../backend/src/utils/businessRules.ts) | Chuẩn hoá biển số · hạn chế của việc đoán loại khu từ tên |
| [frontend/src/api/axios.ts](../frontend/src/api/axios.ts) | Hai bộ chặn · vì sao loại trừ request đăng nhập khỏi xử lý 401 |
| [frontend/src/App.tsx](../frontend/src/App.tsx) | Ba mức chặn route · vì sao phải chờ `loading` |

### 4.5. Hai hạn chế đã được ghi rõ trong comment (không tự ý sửa)

Đây là hai chỗ **cố ý giữ nguyên** nhưng đã ghi chú minh bạch — nếu thầy hỏi thì có sẵn câu trả lời:

**a) Đoạn mã trùng lặp trong `ParkingEntry.tsx`**

Ba hàm `getVehicleCategory` / `getSpotCategory` / `isSpotCompatible` là bản sao của
`backend/src/utils/businessRules.ts`. **Trùng lặp có chủ đích** để lọc danh sách chỗ đỗ ngay trên
trình duyệt cho phản hồi tức thì. Danh sách hiển thị chỉ mang tính **gợi ý** — backend luôn kiểm
tra lại khi bấm lưu, nên dù bản sao có lệch thì dữ liệu vẫn không sai.

**b) `getSpotCategory` đoán loại xe của khu từ TÊN khu**

Cơ sở dữ liệu chưa có cột khai báo "khu này dành cho loại xe nào", nên phải dò từ khoá trong tên
do người dùng đặt ("Khu A - Xe máy"). Hướng cải tiến đã ghi trong comment: thêm cột phân loại vào
bảng `ParkingZone` rồi đọc thẳng.

---

## 5. Thay đổi 4 — Tài liệu mới

| File | Nội dung | Dùng khi nào |
|---|---|---|
| [HUONG_DAN_DOC_CODE.md](HUONG_DAN_DOC_CODE.md) | Bản đồ đọc code theo luồng nghiệp vụ, bảng tra nhanh "chức năng X code ở đâu", mục "câu hỏi thầy hay hỏi → câu trả lời ở file nào" | Khi cần tìm nhanh vị trí một chức năng, hoặc ôn trước buổi bảo vệ |
| [SUA_LOI_PARTIAL_UPDATE_EXPERT_RULE.md](SUA_LOI_PARTIAL_UPDATE_EXPERT_RULE.md) | Phân tích đầy đủ lỗi + endpoint PATCH, có bảng hành vi trước/sau và log đối chứng | Khi cần hiểu chi tiết 2 thay đổi logic của phiên này |
| `TONG_HOP_THAY_DOI_02_09_2026.md` | Chính là file bạn đang đọc | Đối chiếu tổng thể |

Mọi con số trong tài liệu đã đối chiếu với code thật (ngưỡng luật mặc định 20/12/5, priority
10/20/30, tên endpoint `/hourly-stats`, các hàm được dẫn link đều tồn tại).

---

## 6. Cách tự kiểm chứng lại

### 6.1. Xem toàn bộ thay đổi

```bash
git log --oneline 7932766..327f9bc
```

Xem một commit cụ thể (khuyến nghị bắt đầu từ 2 commit logic):

```bash
git show 207dddd
```

```bash
git show 5d2e5ed
```

Chỉ xem thay đổi logic, bỏ qua toàn bộ comment và tài liệu:

```bash
git diff 7932766 327f9bc -- backend/src/services/expertRule.service.ts backend/src/controllers/expertRule.controller.ts backend/src/routes/expertRule.routes.ts frontend/src/hooks/useExpertRules.ts frontend/src/components/ExpertRulesPanel.tsx
```

### 6.2. Kiểm tra biên dịch

```bash
cd backend && npx tsc --noEmit
```

```bash
cd frontend && npx tsc --noEmit
```

Cả hai phải trả về exit code 0, không in ra lỗi nào.

### 6.3. Chạy test đơn vị công thức tính phí

```bash
cd backend && npm test
```

Kết quả mong đợi: `Result: 9 passed, 0 failed, 9 total`.

### 6.4. Test API thật (cần SQL Server đang chạy)

Khởi động backend rồi kiểm tra endpoint mới bằng `curl`:

```bash
curl -s -X POST http://localhost:5001/api/auth/login -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"admin123\"}"
```

Lấy token từ kết quả, sau đó gọi PATCH (thay `<TOKEN>` và `<ID>`):

```bash
curl -s -X PATCH http://localhost:5001/api/expert-rules/<ID>/enabled -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d "{\"enabled\":false}"
```

Kiểm tra body sai kiểu phải trả 400:

```bash
curl -s -o /dev/null -w "%{http_code}" -X PATCH http://localhost:5001/api/expert-rules/<ID>/enabled -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d "{\"enabled\":\"false\"}"
```

### 6.5. Kiểm tra trên giao diện

1. Đăng nhập `admin` / `admin123`.
2. Vào **Cảnh báo → Cấu hình nâng cao**.
3. Mở DevTools tab Network, bấm Switch cột "BẬT" của một luật bất kỳ.
4. **Phải thấy:** `PATCH /api/expert-rules/<id>/enabled` → 200. **Không được thấy** request `PUT`.
5. Tải lại trang — trạng thái Switch phải giữ đúng như vừa đặt.

### 6.6. Kiểm tra comment đã phủ hết chưa

Chạy trong thư mục gốc dự án (Git Bash), kết quả mong đợi là không in ra file nào:

```bash
for f in $(find backend/src -name "*.ts"); do c=$(grep -cE '^\s*(//|/\*|\*)' "$f"); [ "$c" -eq 0 ] && echo "$f"; done
```

---

## 7. Việc đã cân nhắc nhưng CỐ Ý không làm

Ghi lại để thành viên không tưởng là bị bỏ sót:

| Việc | Vì sao không làm |
|---|---|
| Gộp 3 hàm trùng lặp ở `ParkingEntry.tsx` về một chỗ | Trùng lặp có chủ đích (lọc tức thì trên trình duyệt). Gộp lại sẽ phải gọi API mỗi lần đổi loại xe. Đã ghi rõ trong comment header của file. |
| Thêm cột phân loại loại xe cho bảng `ParkingZone` | Cần migration DB, nằm ngoài phạm vi phiên này. Đã ghi hướng cải tiến trong comment `businessRules.ts`. |
| Sửa `?? ` trong `create()` của `expertRule.service.ts` | Không phải lỗi — đó là giá trị mặc định hợp lệ cho bản ghi mới. |
| Xoá endpoint `PUT /expert-rules/:id` | Giữ để tương thích ngược. PATCH là bổ sung, không thay thế. |
| Áp dụng cùng cách sửa cho `update()` của các service khác | Chưa rà soát hết; chỉ sửa chỗ đã xác minh có lỗi. **Đây là việc đáng làm tiếp** — xem mục dưới. |

### Gợi ý việc tiếp theo

Rà soát các `update()` khác xem có dùng `?? <default>` cho field tuỳ chọn không —
cùng lớp lỗi với mục 2. Câu lệnh tìm nhanh:

```bash
grep -rn "?? null,\|?? true,\|?? 100," backend/src/services/*.service.ts
```

Lưu ý: kết quả sẽ gồm cả `create()` (đúng, không cần sửa) — chỉ xét những dòng nằm trong `update()`.

---

## 8. Đọc thêm

Nếu có điểm nào chưa rõ, tra theo bảng sau:

| Chưa hiểu về… | Đọc file |
|---|---|
| Chi tiết 2 thay đổi logic của phiên này | [SUA_LOI_PARTIAL_UPDATE_EXPERT_RULE.md](SUA_LOI_PARTIAL_UPDATE_EXPERT_RULE.md) |
| "Chức năng X code ở đâu", luồng nghiệp vụ | [HUONG_DAN_DOC_CODE.md](HUONG_DAN_DOC_CODE.md) |
| Kiến trúc tổng thể hệ thống | [KIEN_TRUC_TONG_QUAN.md](KIEN_TRUC_TONG_QUAN.md) |
| Kiến trúc chi tiết từng tầng | [KIEN_TRUC_CHI_TIET.md](KIEN_TRUC_CHI_TIET.md) |
| Cấu trúc code các tính năng thông minh | [CAU_TRUC_CODE_TINH_NANG_THONG_MINH.md](CAU_TRUC_CODE_TINH_NANG_THONG_MINH.md) |
| Vì sao dùng rule-based thay vì Machine Learning | [SMART_FEATURES_DEEP_DIVE.md](SMART_FEATURES_DEEP_DIVE.md) § 0 |
| Lần nâng cấp hệ chuyên gia trước đó | [SUA_LOI_ENABLED_VA_VALIDATE_RULE.md](SUA_LOI_ENABLED_VA_VALIDATE_RULE.md) · [NANG_CAP_NANG_CAO.md](NANG_CAP_NANG_CAO.md) |
| Danh sách chức năng đầy đủ | [Function.md](Function.md) |
| Tài khoản đăng nhập thử | [demo_accounts.md](demo_accounts.md) |
| Lịch sử thay đổi tổng thể | [CHANGELOG.md](CHANGELOG.md) |
