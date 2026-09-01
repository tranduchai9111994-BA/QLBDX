# Sửa lỗi PUT /expert-rules ghi đè field tùy chọn không gửi

> Ngày: 02/09/2026
> Phần 1–5: sửa `update()` trong `backend/src/services/expertRule.service.ts` — lỗi tiềm ẩn (latent bug), UI hiện tại chưa dính.
> Phần 6: bổ sung endpoint `PATCH /expert-rules/:id/enabled` cho thao tác bật/tắt nhanh (FE + BE).

---

## 1. Bối cảnh — góp ý ban đầu

Góp ý nhận được:

> Ở hàm `update()` đang có dòng `enabled: data.enabled ?? true`. Nếu rule đang bị tắt,
> sau đó sửa rule nhưng request update không gửi field `enabled`, backend sẽ tự set lại
> `enabled = true`. Rule bị bật lại ngoài ý muốn.
> Nên sửa thành `...(data.enabled !== undefined && { enabled: data.enabled })`.

**Kết luận thẩm định: góp ý đúng, và phạm vi lỗi rộng hơn 1 dòng.**

---

## 2. Phân tích lỗi

### 2.1. Cơ chế gây lỗi

Endpoint `PUT /api/expert-rules/:id` là **full-replace**: controller truyền thẳng `req.body`
xuống service ([expertRule.controller.ts](../backend/src/controllers/expertRule.controller.ts)),
không có lớp merge với bản ghi cũ.

Trong `update()` cũ, 3 field tùy chọn dùng toán tử `??` để đặt giá trị mặc định:

```ts
description: data.description ?? null,    // thiếu -> XÓA TRẮNG mô tả
priority:    data.priority   ?? 100,      // thiếu -> RESET độ ưu tiên về 100
enabled:     data.enabled    ?? true,     // thiếu -> BẬT LẠI rule đang tắt
```

Prisma **bỏ qua** field có giá trị `undefined` (giữ nguyên giá trị trong DB), nhưng `??`
đã biến `undefined` thành một giá trị cụ thể trước khi tới Prisma — nên Prisma buộc phải ghi đè.

### 2.2. Vì sao validate không chặn được

`validateRule()` ([validation.ts](../backend/src/expertSystem/validation.ts)) chỉ bắt buộc
`code`, `domain`, `conditions`, `actions`. Ba field `description` / `priority` / `enabled`
là optional nên payload thiếu chúng **vẫn qua validate** và đi thẳng xuống Prisma.

### 2.3. Mức độ ảnh hưởng thực tế

| Tác nhân | Có gửi `enabled`? | Dính lỗi? |
|---|---|---|
| Form sửa luật trên UI (`ExpertRulesPanel.tsx:212`) | Có (`values.enabled`) | Không |
| Switch bật/tắt nhanh trên bảng (`ExpertRulesPanel.tsx:248`) | Có (gửi cả object) | Không |
| Postman / script / client khác / mobile sau này | Có thể không | **Có** |

⇒ Chưa phải bug sống trên UI hiện tại, nhưng là **hợp đồng API sai**. Bất kỳ client nào sau này
gửi payload rút gọn sẽ âm thầm bật lại rule đã tắt, đổi thứ tự fire của Inference Engine
(qua `priority`) và xóa mô tả.

### 2.4. Hệ quả nghiệp vụ nếu để nguyên

- **`enabled` bị bật lại**: rule đã tắt có chủ đích (ví dụ luật cảnh báo gây nhiễu) đột nhiên
  fire trở lại. Inference Engine chỉ nạp rule `enabled = true`, nên đây là thay đổi hành vi thật.
- **`priority` reset về 100**: `list()` sắp xếp theo `priority asc` và engine duyệt luật theo
  thứ tự đó — reset priority làm đổi luật nào thắng khi nhiều luật cùng khớp.
- **`description` bị xóa**: mất ngữ cảnh vì sao luật tồn tại, khó bảo trì knowledge base.

---

## 3. Hướng xử lý

### 3.1. Nguyên tắc

- **`create()` giữ nguyên `??`** — đó là giá trị mặc định hợp lệ cho bản ghi mới.
- **`update()` chỉ ghi đè field tùy chọn khi payload thực sự gửi field đó** — dùng conditional
  spread để field vắng mặt trở thành `undefined` và bị Prisma bỏ qua.
- **Vẫn phải xóa được mô tả**: dùng `!== undefined` (không dùng `??` hay truthy check) nên
  client gửi `description: null` vẫn xóa được như trước.
- Các field bắt buộc (`code`, `domain`, `name`, `conditions`, `actions`) giữ nguyên gán trực tiếp
  vì validate đã đảm bảo chúng luôn có mặt.

### 3.2. Code sau khi sửa

```ts
/**
 * Lưu ý: các field tùy chọn (description / priority / enabled) chỉ ghi đè khi payload có gửi.
 * Nếu dùng `?? <default>` như lúc create thì client nào không gửi field sẽ vô tình reset giá trị
 * cũ trong DB — ví dụ sửa mỗi tên luật lại làm rule đang tắt bị bật lại, hoặc priority về 100
 * làm đổi thứ tự fire của Inference Engine. Gửi `description: null` vẫn xóa được mô tả như cũ.
 */
async update(id: number, data: ExpertRuleInput, updatedBy?: number) {
  this.validate(data);
  const row = await prisma.expertRule.update({
    where: { id },
    data: {
      code: data.code,
      domain: data.domain,
      name: data.name,
      conditions: JSON.stringify(data.conditions),
      actions: JSON.stringify(data.actions),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.priority !== undefined && { priority: data.priority }),
      ...(data.enabled !== undefined && { enabled: data.enabled }),
      updatedBy,
    },
  });
  await knowledgeBase.reload();
  return row;
}
```

### 3.3. Bảng hành vi trước / sau

| Payload PUT | Trước khi sửa | Sau khi sửa |
|---|---|---|
| Có `enabled: false` | `enabled = false` ✅ | `enabled = false` ✅ |
| Có `enabled: true` | `enabled = true` ✅ | `enabled = true` ✅ |
| **Không gửi `enabled`** | `enabled = true` ❌ | **giữ nguyên DB** ✅ |
| **Không gửi `priority`** | `priority = 100` ❌ | **giữ nguyên DB** ✅ |
| **Không gửi `description`** | `description = null` ❌ | **giữ nguyên DB** ✅ |
| Có `description: null` | xóa mô tả ✅ | xóa mô tả ✅ |

### 3.4. Không thay đổi gì khác

- Không sửa frontend — `ExpertRulesPanel.tsx` vốn đã gửi đủ field, hành vi UI không đổi.
- Không sửa `create()`, `validate()`, controller, routes, Prisma schema.
- Không cần migration DB.

---

## 4. Kiểm thử thực tế

### 4.1. Typecheck

```bash
cd backend && npx tsc --noEmit
```

→ exit code 0, không lỗi.

### 4.2. Test CRUD qua API thật

Chạy backend (`npm run dev`, port 5000) với SQL Server thật, login `admin/admin123`, gọi
tuần tự bằng `curl`. Kịch bản: **CREATE → READ → tắt rule → UPDATE thiếu field → UPDATE có
field → gửi null → validate → DELETE**.

| # | Bước | Kết quả |
|---|---|---|
| 0 | Login admin lấy JWT | PASS |
| 1 | CREATE rule (`priority=42`, `enabled=true`, có mô tả) | PASS |
| 2 | READ: `GET /expert-rules?domain=report` + `GET /:id` | PASS |
| 3 | PUT `enabled=false` → tắt được rule | PASS |
| 4 | **PUT chỉ đổi `name` + `conditions`, KHÔNG gửi 3 field optional** | |
| 4a | → `name` đổi đúng | PASS |
| 4b | → `conditions` đổi đúng (value 10 → 15) | PASS |
| 4c | → `enabled` **giữ `false`** (không bị bật lại) | PASS |
| 4d | → `priority` **giữ `42`** (không reset 100) | PASS |
| 4e | → `description` **giữ nguyên** | PASS |
| 5 | PUT có `enabled=true`, `priority=7` → cập nhật đúng | PASS |
| 6 | PUT `description: null` → vẫn xóa được mô tả | PASS |
| 7 | PUT `conditions: []`, `actions: []` → HTTP 400 (validate vẫn chặn) | PASS |
| 8 | DELETE rule → `GET /:id` trả 404 | PASS |

**Tổng: 18/18 PASS, 0 FAIL.**

### 4.3. Đối chứng — chạy lại đúng bộ test trên code cũ

Để chứng minh bộ test bắt đúng lỗi (không phải test luôn xanh), `git stash` bản sửa rồi
chạy lại bước 4 trên code cũ:

```
raw: {"id":22,...,"description":null,"priority":100,...,"enabled":true,...}
  [PASS] name đã đổi
  [PASS] conditions đã đổi (value=15)
  [FAIL] REGRESSION: enabled bị reset về true
  [FAIL] REGRESSION: priority bị reset
  [FAIL] REGRESSION: description bị xóa
```

⇒ Code cũ fail đúng 3 điểm, code mới pass cả 3. Lỗi có thật và đã được sửa.

Dữ liệu test đã dọn sạch — không còn rule `TEST_PARTIAL_UPDATE` nào trong DB.

---

## 5. Rủi ro và lưu ý

- **Rủi ro thấp.** Thay đổi chỉ nới lỏng việc ghi đè, không đổi hành vi khi client gửi đủ field
  (đúng trường hợp UI hiện tại).
- Một client vốn *cố ý* dựa vào việc "không gửi `priority` để reset về 100" sẽ mất hành vi đó —
  không có client nào trong repo làm vậy.
- Khuyến nghị tách endpoint bật/tắt riêng **đã được thực hiện** — xem phần 6 dưới đây.

---

## 6. Phần bổ sung: endpoint `PATCH /expert-rules/:id/enabled`

### 6.1. Vì sao cần

Switch bật/tắt trên bảng quản trị trước đây gọi `PUT /expert-rules/:id` và phải **gửi lại toàn bộ
object rule** chỉ để đổi 1 boolean. Vấn đề:

- Chạy lại `validateRule()` cho dữ liệu vốn đã hợp lệ trong DB — thừa.
- Mọi field client gửi kèm đều có cơ hội ghi đè nhầm nội dung luật. Nếu state phía UI lệch
  (ví dụ `rules` chưa refetch sau khi ai đó vừa sửa luật), một cú bật/tắt sẽ ghi đè bằng dữ liệu cũ.
- Nếu quên gửi field nào đó thì lại rơi đúng vào lớp lỗi đã sửa ở mục 2.

Bật/tắt là thao tác **partial update trên đúng 1 cột** — đúng ngữ nghĩa của `PATCH`, không phải `PUT`.

### 6.2. Thay đổi

| Lớp | File | Nội dung |
|---|---|---|
| Service | `backend/src/services/expertRule.service.ts` | Thêm `setEnabled(id, enabled, updatedBy)` — chỉ ghi cột `enabled` + `updatedBy`, rồi `knowledgeBase.reload()`. Map lỗi Prisma `P2025` thành HTTP 404. |
| Controller | `backend/src/controllers/expertRule.controller.ts` | Thêm `setEnabled()` — chặn 400 nếu `body.enabled` không phải boolean. |
| Route | `backend/src/routes/expertRule.routes.ts` | `router.patch('/:id/enabled', auth, adminOnly, ...)` |
| Hook FE | `frontend/src/hooks/useExpertRules.ts` | Thêm `setRuleEnabled(id, enabled)` gọi `api.patch`. |
| UI | `frontend/src/components/ExpertRulesPanel.tsx` | `handleToggleEnabled` dùng `setRuleEnabled` thay vì `updateRule`. |

Điểm quan trọng: `setEnabled()` **không đọc field nào khác ngoài `enabled`** — dù client có gửi kèm
`name`, `conditions`... cũng không thể làm hỏng nội dung luật.

`knowledgeBase.reload()` vẫn được gọi vì Inference Engine chỉ nạp luật `enabled = true`; không reload
thì luật vừa tắt vẫn tiếp tục fire.

### 6.3. Kiểm thử — API thật (18/18 PASS)

| # | Kịch bản | Kết quả |
|---|---|---|
| 1 | `PATCH {enabled:false}` → response + DB đều `false` | PASS |
| 1b | `name` / `priority` / `description` / `conditions` **giữ nguyên** sau PATCH | PASS (4 assert) |
| 2 | `PATCH {enabled:true}` → bật lại được | PASS |
| 3 | Body `{}`, `{"enabled":"false"}`, `{"enabled":1}`, `{"enabled":null}` → **400** | PASS (4 assert) |
| 4 | Không token → **401**; token nhân viên → **403** (`adminOnly`) | PASS |
| 5 | `id` không tồn tại → **404** (không phải 500) | PASS |
| 6 | Route `/:id/enabled` **không đè** `/:id`: `PUT` và `DELETE` vẫn chạy đúng | PASS |

Bộ test regression ở mục 4 chạy lại sau thay đổi: vẫn **18/18 PASS**.

### 6.4. Kiểm thử — UI thật (end-to-end)

Chạy cả backend + frontend, đăng nhập `admin`, vào **Cảnh báo → Cấu hình nâng cao**, bấm Switch cột "BẬT":

```
[2164.118] PATCH http://localhost:5000/api/expert-rules/4/enabled -> 200 OK
[2164.119] GET   http://localhost:5000/api/expert-rules            -> 200 OK
```

⇒ Switch gọi đúng `PATCH`, **không còn `PUT`** nào. Reload trang, Switch hiển thị đúng trạng thái
trong DB. Console không phát sinh lỗi mới (chỉ còn cảnh báo deprecated của antd đã có từ trước).
Trạng thái dữ liệu đã khôi phục — cả 19 luật đều `enabled = true` như ban đầu.

### 6.5. Tương thích ngược

`PUT /expert-rules/:id` **giữ nguyên**, vẫn cập nhật được `enabled` khi có gửi. Endpoint PATCH là
bổ sung, không phá client cũ.

---

## 7. Tài liệu liên quan

- [SUA_LOI_ENABLED_VA_VALIDATE_RULE.md](SUA_LOI_ENABLED_VA_VALIDATE_RULE.md) — lần sửa trước:
  Inference Engine chỉ dùng rule `enabled`, và validate rule theo domain.
- [CAU_TRUC_CODE_TINH_NANG_THONG_MINH.md](CAU_TRUC_CODE_TINH_NANG_THONG_MINH.md) — kiến trúc hệ chuyên gia.
