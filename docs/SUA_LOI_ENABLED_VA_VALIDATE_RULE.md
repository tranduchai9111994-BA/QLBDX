# Sửa logic `enabled` của rule + Validate rule theo từng domain

> Cần bản tóm tắt ngắn kèm hướng dẫn tự kiểm chứng? Xem [CAP_NHAT_MOI_NHAT.md](CAP_NHAT_MOI_NHAT.md).
>
> Phạm vi: module Expert System (Knowledge Base + Inference Engine) của hệ thống QLBDX.
> Ngày thực hiện: 01/09/2026.
> Kết quả kiểm thử: backend + frontend `tsc --noEmit` exit 0; chạy end-to-end thật với SQL Server (kết quả ở mục 6).

---

## 1. Mục tiêu

| # | Yêu cầu | Trạng thái |
|---|---------|-----------|
| 1 | Rule `enabled = true` mới được đưa vào Inference Engine; `enabled = false` không sinh gợi ý/cảnh báo/quyết định | Đã sửa |
| 2 | Validate rule riêng theo từng domain (`package` / `alert` / `analytics` / `report`) | Đã làm |
| 3 | Rule sai cấu trúc không lưu được vào DB | Đã làm |
| 4 | Demo bật/tắt rule thay đổi được kết quả thực tế | Đã kiểm chứng |
| 5 | Source thể hiện rõ Knowledge Base + Inference Engine | Đã làm |

---

## 2. Hiện trạng trước khi sửa (đánh giá)

### 2.1. Phần `enabled` — đã đúng một nửa

`knowledgeBase.load()` vốn đã có `where: { enabled: true }`, nên 3 domain đi qua Inference Engine
(`package`, `analytics`, `report`) đã tôn trọng cờ `enabled` từ trước.

### 2.2. Lỗ thật: domain `alert` KHÔNG đi qua Inference Engine

`report.service.getAlerts()` không gọi `evaluate()` mà gọi `alertRuleTierService.evaluate(...)`,
với bảng mốc lấy từ `getAllGrouped()` → `list()`. Câu query của `list()` là:

```ts
const rows = await prisma.expertRule.findMany({ where: { domain: 'alert' } });
```

Không có `enabled: true`. Hệ quả: **tắt một mốc cảnh báo thì nó vẫn tiếp tục phát cảnh báo** —
đúng như lo ngại "chức năng bật/tắt rule bị sai ý nghĩa".

Tệ hơn: **không có UI nào tắt được luật `alert`**, vì `ExpertRulesPanel` cố tình lọc bỏ
`domain !== 'alert'` (dòng 61), còn tab "Cấu hình mức độ" thì chưa có cột bật/tắt.

### 2.3. Bug liền kề: luật mặc định có thể không bao giờ được seed

`knowledgeBase.load()` seed `DEFAULT_RULES` với điều kiện `expertRule.count() === 0` — đếm **toàn
bảng**. Nhưng `alertRuleTierService.list()` cũng seed 7 mốc `alert` vào cùng bảng đó. Nếu admin mở
tab "Cấu hình mức độ" trước khi hệ thống chạy `evaluate()` lần đầu, thì `count() > 0` và **11 luật
package/analytics/report sẽ không bao giờ được nạp** → toàn bộ gợi ý gói, DSS, insight im lặng.

### 2.4. Phần validate — chỉ có check chung

`expertRuleService.validate()` cũ chỉ kiểm tra: có `code`, có `domain`, có ít nhất 1 condition với
operator hợp lệ, có ít nhất 1 action. Không hề biết `action.params` của từng domain cần gì.

### 2.5. Hai điểm lệch giữa đề xuất ban đầu và code thật

1. Schema là `conditions: Condition[]` và `actions: Action[]` (**mảng, số nhiều**), không phải
   `rule.condition` / `rule.action` số ít → validate phải duyệt mảng.
2. **Nghiêm trọng:** yêu cầu `params.message` / `params.title` / `params.recommendation` sẽ làm
   **23/23 rule đang có trở thành invalid**, vì nội dung câu gợi ý không nằm trong rule mà được
   ghép trong code từ dữ liệu sống:
   - `analytics`: params chỉ có `{ id: 'd1', template: 'expand_zone' }`
   - `report`: params chỉ có `{ type: 'revenue_up' }`
   - `alert`: params chỉ có `{ severity }` — và `alertRuleTierService.create()` cũng chỉ ghi `severity`,
     nên bắt buộc `message` sẽ làm tab "Cấu hình mức độ" không tạo/sửa được mốc nào nữa.

**Quyết định đã chọn:** làm đúng spec (bắt buộc `message`/`title`), kèm **migrate** dữ liệu và code
tiêu thụ. Cách làm chi tiết ở mục 4.

---

## 3. Sửa điểm 1 — `enabled` chỉ luật bật vào Inference Engine

### 3.1. `backend/src/expertSystem/knowledgeBase.ts`

- Giữ nguyên `where: { enabled: true }` khi nạp luật, thêm comment giải thích đây là nguồn **duy
  nhất** Inference Engine được dùng.
- Thay cơ chế seed `count() === 0` bằng `syncDefaults()`: so theo **mã luật** (`code`), chỉ tạo
  những luật mặc định còn thiếu.

```ts
private async syncDefaults(): Promise<void> {
  const existing = await prisma.expertRule.findMany({
    where: { code: { in: DEFAULT_RULES.map((r) => r.code) } },
    select: { id: true, code: true, actions: true },
  });
  const byCode = new Map(existing.map((r) => [r.code, r]));
  const missing = DEFAULT_RULES.filter((r) => !byCode.has(r.code));
  if (missing.length > 0) await prisma.expertRule.createMany({ data: missing });
  // ... phần bù params.message xem mục 4.4
}
```

### 3.2. `backend/src/services/alertRuleTier.service.ts` — sửa lỗ chính

Tách rõ 2 đường đọc dữ liệu:

| Hàm | Dùng cho | Lọc `enabled` |
|-----|----------|---------------|
| `list()` | Màn hình quản lý (tab Cấu hình mức độ) | **Không** — trả cả bật và tắt, kèm cờ `enabled` |
| `getAllGrouped()` | Đầu vào suy diễn cảnh báo của `report.service` | **Có** — `.filter((t) => t.enabled)` |

```ts
async getAllGrouped(): Promise<Record<string, GroupedTier[]>> {
  const tiers = (await this.list()).filter((t) => t.enabled);
  // ...
}
```

Đồng thời:
- `AlertTier` thêm field `enabled` (và `message`).
- `update()` nhận thêm `enabled?: boolean` để bật/tắt mốc.
- `RULE_TYPES` / `VALID_SEVERITIES` chuyển sang `expertSystem/domainSpecs.ts` (dùng chung với
  validate), service này `re-export` lại để controller đang import không phải sửa.

### 3.3. `frontend/src/components/AlertSettingsPanel.tsx`

Thêm cột **"Đang dùng"** với `Switch` — đây là UI đầu tiên cho phép tắt một mốc cảnh báo:

```tsx
const handleToggleTier = async (tier: RuleTier, enabled: boolean) => {
  await api.put(`/alert-rule-tiers/${tier.id}`, {
    ruleType: tier.ruleType, threshold: tier.threshold, severity: tier.severity, enabled,
  });
  message.success(enabled ? 'Đã bật mốc ngưỡng' : 'Đã tắt mốc ngưỡng — cảnh báo này sẽ không phát nữa');
  fetchTiers();
};
```

Mốc đã tắt được làm mờ (`opacity: 0.45`) ở cột Ngưỡng.

### 3.4. `frontend/src/hooks/useAlertRuleTiers.ts`

Hook này dùng để tô màu thời gian đỗ ở trang "Xe ra". Trước đây nó nạp **mọi** mốc trả về từ API →
mốc đã tắt vẫn tô màu. Đã lọc cho khớp backend:

```ts
res.data.filter((t) => t.enabled !== false).forEach((t) => { (g[t.ruleType] ??= []).push(t); });
```

### 3.5. `frontend/src/components/ExpertRulesPanel.tsx`

Chức năng "Chạy thử" gọi `/expert-rules/evaluate` → đi qua Inference Engine → luật đã tắt không có
trong kết quả. Trước đây UI im lặng không hiện gì. Nay:
- Chọn luật đang tắt → hiện `Alert` màu vàng "Luật này đang tắt ... Bật luật ở cột Bật rồi thử lại".
- Chạy thử mà không có kết quả cho luật đó → hiện cảnh báo giải thích lý do.

---

## 4. Sửa điểm 2 — Validate rule theo từng domain

### 4.1. File mới: `backend/src/expertSystem/domainSpecs.ts`

Khai báo tập trung "hợp đồng" giữa Knowledge Base và code tiêu thụ luật. Đặt riêng để cả validate và
service nghiệp vụ dùng chung một nguồn, tránh import vòng:

```ts
export const VALID_SEVERITIES = ['danger', 'warning', 'info'] as const;
export const RULE_TYPES = { /* 7 loại cảnh báo + unit + comparator */ } as const;
export const PACKAGE_LEVELS = ['yearly', 'quarterly', 'monthly'] as const;
export const ANALYTICS_DECISION_IDS = ['d1', 'd2', 'd3'] as const;
export const REPORT_SUGGESTION_TYPES = [
  'revenue_up', 'revenue_down', 'occupancy_warning', 'long_parking', 'renewal_campaign',
] as const;
export const DOMAIN_ACTION_TYPE: Record<string, string> = {
  package: 'recommend', alert: 'alert', analytics: 'decision', report: 'suggestion',
};
```

### 4.2. File mới: `backend/src/expertSystem/validation.ts`

Gồm 2 tầng:

**Tầng chung (`validateShape`)** — mã luật, domain, ≥1 điều kiện với `fact` + operator ∈ 6 toán tử +
`value` là số, ≥1 hành động có `type` và `params` dạng object.

**Tầng riêng theo domain (`DOMAIN_VALIDATORS`)**:

| Domain | `action.type` bắt buộc | `action.params` bắt buộc | Điều kiện |
|--------|------------------------|--------------------------|-----------|
| `package` | `recommend` | `package` ∈ {yearly, quarterly, monthly}<br>`durationDays` là số > 0<br>`savings` khác rỗng | — |
| `alert` | `alert` | `message` **hoặc** `title`<br>`severity` ∈ {danger, warning, info} | mọi `fact` ∈ 7 khoá của `RULE_TYPES` |
| `analytics` | `decision` | `id` ∈ {d1, d2, d3}<br>`message` **hoặc** `recommendation` | — |
| `report` | `suggestion` | `type` ∈ 5 loại gợi ý<br>`message` (string không rỗng) | — |

Domain lạ (admin tự thêm nhóm mới) chỉ qua tầng chung — vì chưa service nào tiêu thụ nên không thể
biết `params` phải gồm những gì.

Điểm quan trọng: **không chỉ check có field, mà check cả giá trị**. Rule mà engine fire được nhưng
code không xử lý được (VD `analytics` với `id = 'd9'`, hay `report` với `type = 'abc'`) bị chặn kèm
message chỉ rõ tập giá trị hợp lệ:

```
Loại gợi ý (params.type) không hợp lệ: "abc".
Hệ thống chỉ xử lý được: revenue_up, revenue_down, occupancy_warning, long_parking, renewal_campaign
```

### 4.3. Áp dụng validate ở cả 2 đường ghi

- `expertRuleService.create()` / `update()` → `validateRule(data)`.
- `alertRuleTierService` (tạo mốc từ dropdown) → cũng đi qua `validateRule()` trong hàm
  `tierRuleData()`. Nghĩa là mốc tạo bằng UI thân thiện và luật gõ JSON tay đều bị soi cùng một
  bộ quy tắc.

### 4.4. Migrate `params.message` — để làm đúng spec mà không phá dữ liệu cũ

Vấn đề: bắt buộc `message` sẽ làm 23 rule cũ invalid. Cách xử lý:

**a) Câu gợi ý chuyển vào rule dưới dạng mẫu có chỗ trống**

File mới `backend/src/expertSystem/messageTemplate.ts`:

```ts
export function renderMessage(template: unknown, vars: Record<string, string | number> = {}): string {
  if (typeof template !== 'string' || !template.trim()) return '';
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    vars[key] === undefined ? whole : String(vars[key]));
}
```

`rules/defaults.ts` nay lưu, ví dụ:

```
report/insight_long_parked      → "Có {longParkedCount} xe đỗ quá 24 giờ, cần kiểm tra và xử lý."
report/insight_revenue_down     → "Doanh thu tuần này giảm {revenueDropPercent}% so với tuần trước, ..."
report/insight_zone_busy        → "{zoneName} đạt {zoneOccupancyPercent}% công suất. ..."
analytics/dss_zone_overloaded   → "Có nên mở thêm chỗ đỗ ở {zone}?"
```

**b) Code tiêu thụ đọc message từ rule thay vì hardcode `if/else`**

`report.service.getInsights()` — trước là chuỗi `if (type === 'revenue_up') { message: \`...\` }` cho
5 loại; nay:

```ts
const globalVars = {
  revenueChangePercent: weekComparison.changePercent.revenue,
  revenueDropPercent: Math.abs(weekComparison.changePercent.revenue),
  peakAfternoonHour: peakHours.afternoon.hour,
  longParkedCount,
  expiringPackagesCount,
};
for (const fired of globalEval.firedRules) {
  for (const action of fired.actionOutputs) {
    const message = renderMessage(action.params?.message, globalVars);
    if (!message) continue;
    suggestions.push({ type: action.params.type, message, explanation: fired.explanation });
  }
}
```

`analytics.service.ts` — `message` của rule trở thành **câu hỏi quyết định**:

```ts
const messageById = new Map(dssResult.firedRules.map(
  (r) => [r.actionOutputs[0]?.params?.id, r.actionOutputs[0]?.params?.message]));
// ...
question: renderMessage(messageById.get('d1'), { zone: z.zone }),
```

**c) Luật `alert` tự sinh message**

Tab "Cấu hình mức độ" chỉ có dropdown loại/ngưỡng/mức độ, không có ô nhập message. Nên message được
sinh từ chính 3 thông tin đó, với `{value}` là chỗ trống cho giá trị đo được lúc chạy:

```
"Xe đỗ quá lâu: giá trị {value} >= mốc 24giờ đã đỗ → mức warning"
```

`evaluateWithExplanation()` nay lấy explanation từ message của mốc khớp thay vì tự ghép chuỗi.

**d) Self-heal cho DB đang có sẵn**

Không cần xoá bảng hay viết migration SQL. Hai chỗ tự bù `params.message` khi thiếu, **chỉ thêm khi
thiếu, không ghi đè nội dung admin đã sửa**:

- `knowledgeBase.syncDefaults()` — bù cho luật `package`/`analytics`/`report` seed từ bản cũ.
- `alertRuleTierService.backfillMessages()` — bù cho 7+ mốc `alert`.

---

## 5. Danh sách file thay đổi

### Backend — file mới

| File | Nội dung |
|------|----------|
| `src/expertSystem/domainSpecs.ts` | Tập giá trị hợp lệ của từng domain (whitelist) |
| `src/expertSystem/validation.ts` | Validate chung + validate riêng theo domain |
| `src/expertSystem/messageTemplate.ts` | `renderMessage()` — điền số liệu vào mẫu `{tenBien}` |

### Backend — file sửa

| File | Thay đổi |
|------|----------|
| `src/expertSystem/knowledgeBase.ts` | `syncDefaults()` seed theo mã luật + bù `params.message`; comment rõ chỉ nạp luật `enabled = true` |
| `src/expertSystem/rules/defaults.ts` | 11 luật mặc định có thêm `params.message` dạng mẫu |
| `src/expertSystem/index.ts` | Export `validateRule`, `renderMessage`, các whitelist |
| `src/services/expertRule.service.ts` | Bỏ validate cũ, gọi `validateRule()` |
| `src/services/alertRuleTier.service.ts` | `getAllGrouped()` lọc `enabled`; `update()` nhận `enabled`; tier có `message`; `matchTier()` dùng chung cho `evaluate` + `evaluateWithExplanation`; import whitelist từ `domainSpecs` |
| `src/services/report.service.ts` | `getInsights()` lấy nội dung gợi ý từ `params.message` (bỏ ~50 dòng chuỗi hardcode) |
| `src/services/analytics.service.ts` | Câu hỏi quyết định lấy từ `params.message` |

### Frontend — file sửa

| File | Thay đổi |
|------|----------|
| `src/components/AlertSettingsPanel.tsx` | Cột "Đang dùng" (Switch bật/tắt mốc), làm mờ mốc đã tắt |
| `src/hooks/useAlertRuleTiers.ts` | Bỏ qua mốc đã tắt khi tô màu |
| `src/components/ExpertRulesPanel.tsx` | Hướng dẫn params bắt buộc theo từng domain; cảnh báo khi chạy thử luật đang tắt |

---

## 6. Kết quả kiểm thử

### 6.1. Type-check

```
backend  npx tsc --noEmit  →  exit 0
frontend npx tsc --noEmit  →  exit 0
```

### 6.2. Backfill `params.message` trên DB thật

19 luật trong DB, sau khi chạy `knowledgeBase.reload()` + `alertRuleTierService.list()`:
**0 luật thiếu message** (trừ domain `package` vốn không yêu cầu message theo spec).

### 6.3. Bật/tắt luật `report` → Inference Engine

```
evaluate({ longParkedCount: 99 }, 'report')
  Trước khi tắt, luật khớp: [ 'insight_long_parked' ]
  Sau khi TẮT,  luật khớp: []
```

### 6.4. Bật/tắt luật → thay đổi gợi ý thật trên báo cáo tuần (`getInsights()`)

```
Khi luật TẮT -> [ 'revenue_down', 'occupancy_warning' ]
Khi luật BẬT -> [ 'revenue_down', 'long_parking', 'occupancy_warning' ]

Nội dung gợi ý (lấy từ params.message của luật):
  [revenue_down]      Doanh thu tuần này giảm 100% so với tuần trước, cần xem xét nguyên nhân (...)
  [long_parking]      Có 17 xe đỗ quá 24 giờ, cần kiểm tra và xử lý.
  [occupancy_warning] Khu D đạt 100% công suất. Nên cân nhắc điều phối xe sang khu khác còn trống.
```

### 6.5. Bật/tắt mốc cảnh báo → thay đổi cảnh báo thật (`getAlerts()`)

Đây chính là lỗ trước khi sửa. Domain `longParkingHours` có 2 mốc: 24h (warning) và 48h (danger).

```
Ban đầu (bật cả 24h và 48h)  | mốc đang bật: ["48/danger","24/warning"] | số cảnh báo: 17
TẮT 24h (còn 48h)            | mốc đang bật: ["48/danger"]              | số cảnh báo: 17
TẮT cả 24h và 48h            | mốc đang bật: []                         | số cảnh báo: 0
BẬT lại cả hai (phục hồi)    | mốc đang bật: ["48/danger","24/warning"] | số cảnh báo: 17
```

> Lưu ý khi đọc số liệu: tắt riêng mốc 24h vẫn ra 17 vì cả 17 xe trong dữ liệu demo đều đã đỗ quá
> 48h nên mốc `danger` vẫn bắt — đúng logic, không phải lỗi. Tắt cả hai mốc thì cảnh báo về 0.

### 6.6. Validate theo domain — chặn 11/11 trường hợp sai

```
CHẶN 400 | report thiếu message        -> Luật gợi ý báo cáo phải có params.message
CHẶN 400 | report type lạ              -> Loại gợi ý (params.type) không hợp lệ: "abc". Hệ thống chỉ xử lý được: revenue_up, revenue_down, occupancy_warning, long_parking, renewal_campaign
CHẶN 400 | report sai action type      -> Luật nhóm "report" phải dùng hành động type = "suggestion" (đang là "alert")
CHẶN 400 | package thiếu durationDays  -> Luật gợi ý gói phải có params.durationDays là số ngày > 0
CHẶN 400 | package mức gói lạ          -> Mức gói (params.package) không hợp lệ: "weekly". Hệ thống chỉ xử lý được: yearly, quarterly, monthly
CHẶN 400 | analytics id lạ             -> Mã quyết định (params.id) không hợp lệ: "d9". Hệ thống chỉ xử lý được: d1, d2, d3
CHẶN 400 | analytics thiếu message     -> Luật hỗ trợ quyết định phải có params.message hoặc params.recommendation
CHẶN 400 | alert severity lạ           -> Mức độ cảnh báo (params.severity) không hợp lệ: "oops". Hệ thống chỉ xử lý được: danger, warning, info
CHẶN 400 | alert fact lạ               -> Loại cảnh báo (điều kiện fact) không hợp lệ: "khongTonTai". Hệ thống chỉ xử lý được: zoneNearFullPercent, ... , renewalFrequency
CHẶN 400 | toán tử lạ                  -> Toán tử không hợp lệ: "between". Chỉ dùng: gte, lte, gt, lt, eq, neq
CHẶN 400 | ngưỡng không phải số        -> Ngưỡng của điều kiện "longParkedCount" phải là số
=> Chặn 11/11 trường hợp sai.
```

11 luật mặc định trong `defaults.ts` đều pass validate.

### 6.7. CRUD đầy đủ của một luật hợp lệ

```
CREATE  -> id = 20 | enabled = true
READ    -> __crud_demo | params = {"type":"long_parking","message":"CRUD test: {longParkedCount} xe do lau"}
LIST    -> domain report có 6 luật (kể cả tắt): insight_revenue_up:true, ..., __crud_demo:true
ENGINE (đang bật) -> khớp: [ 'insight_long_parked', '__crud_demo' ]
UPDATE  -> Luat test CRUD (da sua) | priority = 901 | enabled = false | điều kiện = [{"fact":"longParkedCount","operator":"gt","value":2}]
ENGINE (đã tắt)   -> khớp: [ 'insight_long_parked' ]          ← luật vừa tắt không còn fire
UPDATE sai cấu trúc -> CHẶN 400 | Luật gợi ý báo cáo phải có params.message
DELETE  -> còn trong DB? false
```

Trạng thái DB sau toàn bộ test: **19 luật, không luật nào bị tắt sót** (đã dọn sạch).

---

## 7. Kịch bản demo với thầy

1. **Bật/tắt luật gợi ý báo cáo** — vào Quản lý luật nâng cao, tắt luật `insight_long_parked`,
   mở lại Dashboard thông minh → gợi ý "Có N xe đỗ quá 24 giờ" biến mất. Bật lại → xuất hiện lại.
2. **Bật/tắt mốc cảnh báo** — vào Cảnh báo → Cấu hình mức độ, tắt cả 2 mốc "Xe đỗ quá lâu"
   → danh sách cảnh báo về 0 mục loại đó. Bật lại → quay về đủ.
3. **Sửa câu chữ gợi ý ngay trên UI** — sửa `params.message` của một luật `report`, VD đổi thành
   `"CẢNH BÁO: {longParkedCount} xe đỗ quá lâu!"` → báo cáo tuần đổi text ngay, không cần build lại.
   Đây là bằng chứng rõ nhất rằng tri thức nằm trong Knowledge Base, không hardcode.
4. **Rule sai thì hệ thống xử lý sao?** — tạo luật `report` mà bỏ trống `message`, hoặc gõ
   `type = "abc"` → API trả 400 kèm câu giải thích và liệt kê giá trị hợp lệ.
5. **Chạy thử luật (Test)** — nhập giá trị dữ kiện, xem luật khớp/không khớp kèm chuỗi giải thích
   `frequency = 20 >= 20 → đúng` (Explanation Facility của hệ chuyên gia).

---

## 8. Điểm cần lưu ý về sau

- `DOMAIN_ACTION_TYPE` giả định **1 domain dùng đúng 1 loại action**. Nếu sau này một domain cần
  nhiều loại action, phải đổi `validateRule()` từ "mọi action phải cùng type" sang bảng
  `domain → tập type hợp lệ`.
- Thêm loại gợi ý/quyết định mới thì phải cập nhật **cả 2 nơi**: whitelist trong `domainSpecs.ts`
  và code hiển thị tương ứng trong `report.service.ts` / `analytics.service.ts`.
- `renderMessage()` giữ nguyên chỗ trống nếu không có biến tương ứng (VD `{sai_ten}` sẽ hiện đúng
  như vậy) — cố ý, để admin thấy mình gõ sai tên biến thay vì ra chuỗi rỗng khó hiểu.
- Domain `package` không bắt buộc `message` (theo spec) — nội dung `reason` vẫn ghép trong
  `customerPackage.service.ts`. Nếu muốn nhất quán, có thể chuyển tiếp sang message-driven.

---

## 9. Bổ sung — form nhập luật thay cho ô JSON

Phản hồi khi dùng thử: form thêm/sửa luật bắt gõ JSON vào ô `params`, mà *"không phải ai cũng biết
code"*; thêm nữa ô `Loại hành động` chỉ có đúng một giá trị hợp lệ cho mỗi nhóm nên để đó là thừa.

### 9.1. Khuôn form sinh từ backend

Thêm `DOMAIN_FORM_SPEC` trong [`domainSpecs.ts`](../backend/src/expertSystem/domainSpecs.ts) — mô tả
cho mỗi nhóm: loại hành động cố định, danh sách dữ kiện dùng được ở phần Điều kiện, và từng ô nhập
của phần `params` (kiểu ô, nhãn tiếng Việt, danh sách lựa chọn, các chỗ trống `{tenBien}` dùng được).

Backend expose qua `GET /expert-rules/form-spec`; frontend dựng form từ đó. Nhờ vậy **dropdown trên
UI và validate ở server dùng chung một nguồn** — thêm một loại gợi ý mới chỉ sửa `domainSpecs.ts`,
không phải sửa 2 nơi rồi lệch nhau.

### 9.2. Thay đổi ở `ExpertRulesPanel.tsx`

| Trước | Sau |
|---|---|
| Ô `type` phải tự gõ (`recommend`/`decision`/...) | Bỏ hẳn — hiện nhãn cho biết, hệ thống tự điền theo nhóm |
| Ô `params` là textarea JSON | Các ô nhập cụ thể: Select cho giá trị có sẵn, Input/TextArea cho nội dung |
| Ô `fact` gõ tay (`longParkedCount`...) | Select có nhãn tiếng Việt ("Số xe đang đỗ quá 24 giờ") |
| `durationDays` gõ tay, dễ sai | Select đúng các thời hạn gói đang bán |
| Chưa chọn nhóm vẫn hiện ô JSON | Hiện hướng dẫn "Chọn Nhóm (domain) ở phía trên trước" |
| Nhóm admin tự thêm | Vẫn dùng ô JSON (chưa service nào tiêu thụ nên không thể biết cần field gì) |

Các khoá `params` không nằm trong khuôn form được **giữ nguyên khi lưu** (state `extraParams`) để
không làm mất dữ liệu đã có.

### 9.3. Dọn field thừa `params.template`

`template` (`expand_zone` / `weekend_pricing` / `package_campaign`) được ghi vào DB từ bản đầu
nhưng `grep` toàn bộ source cho thấy **không có chỗ nào đọc tới** — `analytics.service.ts` tra khối
phân tích theo `params.id`. Đã bỏ khỏi `rules/defaults.ts` và tự xoá khỏi dữ liệu cũ trong
`knowledgeBase.syncDefaults()`.

### 9.4. Kiểm chứng trên trình duyệt thật

Mở luật `dss_zone_overloaded` → **Sửa**, đọc DOM của modal:

```
Kết quả khi luật khớp  [decision]
Khi số liệu vượt ngưỡng thì đưa câu hỏi quyết định kèm các phương án cho quản lý.
Loại hành động của nhóm này luôn là decision nên hệ thống tự điền, bạn không cần nhập.
Quyết định hiển thị     → d1 — Mở thêm chỗ đỗ / điều phối sang khu trống
Câu hỏi quyết định      → Có nên mở thêm chỗ đỗ ở {zone}?
Có thể chèn số liệu thật bằng các chỗ trống sau: {zone}
```

Không còn textarea JSON nào (kiểm tra bằng script: mọi textarea đều không bắt đầu bằng `{`).
Bấm **Cập nhật** → toast "Đã cập nhật luật", đọc lại DB xác nhận `template` đã được dọn:

```
dss_zone_overloaded  -> [{"type":"decision","params":{"id":"d1","message":"Có nên mở thêm chỗ đỗ ở {zone}?"}}]
dss_weekend_drop     -> [{"type":"decision","params":{"id":"d2","message":"Có nên điều chỉnh giá vào cuối tuần?"}}]
dss_package_campaign -> [{"type":"decision","params":{"id":"d3","message":"Có nên triển khai chiến dịch bán gói dịch vụ?"}}]
```

---

## 10. Bổ sung — tăng tốc mở app khi bấm icon

### 10.1. Nguyên nhân thật, đọc từ `logs/launcher.log`

```
18:27:44  === Khoi dong QLBDX ===          ← bấm lần 1
18:27:56  === Khoi dong QLBDX ===          ← bấm lần 2 (chưa thấy gì nên bấm lại)
18:27:59  Dang tat process cu tren cong 3000 (PID 5408)   ← GIẾT tiến trình của lần 1
18:28:19  === Khoi dong QLBDX ===          ← bấm lần 3
18:28:22  Dang tat process cu tren cong 3000 (PID 19216)  ← GIẾT tiến trình của lần 2
18:28:45  San sang! Mo trinh duyet.        ← tổng cộng 61 giây
```

Launcher không có phản hồi gì trong ~20 giây đầu, nên người dùng bấm lại; mỗi lần bấm lại chạy
bước "dọn tiến trình cũ trên cổng 3000/5001" và **giết đúng tiến trình đang khởi động dở**.

### 10.2. Các thay đổi trong `scripts/start-silent.ps1`

1. **Mutex `Global\QLBDX_Launcher`** — lần bấm thứ 2 trở đi không kill và khởi động lại nữa, chỉ
   chờ tới khi sẵn sàng rồi mở trình duyệt.
2. **Cửa sổ "Đang khởi động QLBDX..."** (WinForms, có thanh tiến trình chạy) hiện ngay khi bấm, cập
   nhật theo từng bước (khởi động SQL Server / dọn tiến trình cũ / biên dịch giao diện) và tự đóng
   khi mở trình duyệt. Tham số `-NoSplash` để tắt khi chạy từ script khác.
3. **Quét cổng bằng 1 lệnh `netstat -ano`** thay cho 2 lần `Get-NetTCPConnection` — cmdlet đó phải
   nạp module NetTCPIP, tốn ~1.5s ở lần gọi đầu.
4. **Kiểm tra sẵn sàng bằng `HttpWebRequest`** (nhẹ hơn `Invoke-WebRequest`), poll 300ms thay 500ms.
   Vẫn phải dùng HTTP chứ không kiểm tra cổng: webpack-dev-server mở cổng 3000 từ giây thứ ~4 nhưng
   giữ request lại cho tới khi biên dịch xong.
5. Ghi thời gian thật vào log: `San sang sau 8.0s! Mo trinh duyet.`

### 10.3. `frontend/.env` mới

```
BROWSER=none              # launcher tự mở trình duyệt 1 lần khi thực sự sẵn sàng
DISABLE_ESLINT_PLUGIN=true  # bớt ~5s mỗi lần biên dịch lại từ đầu
```

Đã đo: cache lạnh **36.3s → 31.3s**. Cảnh báo lint trước đây chỉ ghi vào `logs/frontend.log` không
ai đọc; nay chạy tường minh bằng `npm run lint` / `npm run typecheck` (2 script mới trong
`frontend/package.json`).

> Đã thử `GENERATE_SOURCEMAP=false` nhưng **không đưa vào**: trong CRA 5 biến này chỉ ảnh hưởng bản
> build production, chế độ dev luôn dùng `cheap-module-source-map` — thêm vào chỉ gây hiểu nhầm.

### 10.4. Số đo trước/sau

| Tình huống | Trước | Sau |
|---|---|---|
| Bấm icon 3 lần liên tiếp | 61s (đo từ log 18:27:44 → 18:28:45) | ~10s (18:39:25 → 18:39:35) |
| Bấm 1 lần, cache ấm | ~11s | ~8-10s |
| Bấm 1 lần, sau khi sửa code (cache lạnh) | ~36s | ~31s |
| Bấm khi app đang chạy sẵn | mở ngay | mở ngay (giữ nguyên) |

Log xác nhận cơ chế chống bấm trùng hoạt động:

```
18:37:16  === Khoi dong QLBDX ===
18:37:29  Da co mot lan khoi dong dang chay - chi doi va mo trinh duyet (khong khoi dong lai).
18:37:38  San sang sau 18.9s! Mo trinh duyet.
```

> Phần biên dịch giao diện (~7s ấm / ~31s lạnh) là giới hạn của `react-scripts` dev server, không
> rút ngắn thêm được nếu vẫn chạy chế độ dev. Muốn mở gần như tức thì thì phải chuyển sang chạy bản
> build sẵn (`npm run build` rồi phục vụ tĩnh) — đổi lại mỗi lần sửa code phải build lại ~1-2 phút,
> nên chưa làm.
