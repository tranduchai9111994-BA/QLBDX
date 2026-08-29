# Nâng cấp: Rule-based Expert System & hợp nhất cấu hình cảnh báo

> Tài liệu mô tả đợt nâng cấp chuyển các logic "thông minh" từ if/else hardcode rải rác sang
> một module hệ chuyên gia (expert system) có cấu trúc rõ ràng, kèm giao diện quản trị.

---

## 1. Vấn đề trước khi nâng cấp

Hệ thống có 2 vấn đề được nêu ra:

1. **Rule thông minh nằm rải rác** ở nhiều service (`customerPackage.service.ts`, `analytics.service.ts`,
   `report.service.ts`), không có Knowledge Base / Inference Engine / Explanation rõ ràng như một
   hệ chuyên gia đúng nghĩa.
2. **Hardcode ngưỡng bằng if/else** — ví dụ gợi ý gói dịch vụ:
   ```ts
   if (frequency >= 20) recommendation = 'yearly';
   else if (frequency >= 12) recommendation = 'quarterly';
   else if (frequency >= 5) recommendation = 'monthly';
   ```
   Ngưỡng 5/12/20 và % tiết kiệm bị "chôn cứng" trong code, admin không tự chỉnh được.

Ngoài ra, hệ thống cảnh báo (`AlertRuleTier`) và bộ luật mới (`ExpertRule`) ban đầu là **2 bảng
dữ liệu tách biệt** — 2 tab cấu hình khác nhau, dễ gây nhầm lẫn "sửa cái này có ảnh hưởng cái kia
không?".

---

## 2. Kiến trúc mới: `backend/src/expertSystem/`

```
expertSystem/
├── types.ts            # Condition, Action, Rule, Fact, RuleResult, EvaluationResult
├── knowledgeBase.ts     # Load/cache luật từ DB, seed mặc định nếu bảng trống
├── inferenceEngine.ts    # evaluate(facts, domain) — AND-match điều kiện, sinh explanation
├── rules/defaults.ts     # Seed data mặc định (11 rule ban đầu)
└── index.ts              # Facade: evaluate(), reload()
```

Mỗi **luật (Rule)** gồm:

| Thành phần | Vai trò | Ví dụ |
|---|---|---|
| **Input** (`conditions`) | Dữ liệu thực tế lấy từ hệ thống | `frequency >= 5` |
| **Inference** | AND-match toàn bộ điều kiện, chọn theo `priority` | rule nào priority nhỏ hơn ưu tiên trước |
| **Output** (`actions`) | Gợi ý/cảnh báo/quyết định trả về | `{ type: 'recommend', params: { package: 'monthly' } }` |
| **Explanation** | Lý do vì sao luật khớp hay không | `"frequency = 15 >= 5 → đúng"` |

## 3. Bảng dữ liệu mới: `ExpertRule`

Migration `20260828235326_add_expert_rule` tạo bảng `ExpertRules` (domain, code, name, priority,
conditions/actions dạng JSON, enabled). Admin CRUD qua API `/expert-rules` + UI.

## 4. Xoá hardcode — chuyển 3 nơi sang expert system

| File | Trước | Sau |
|---|---|---|
| `customerPackage.service.ts` | if/else 5/12/20 | `evaluate({frequency}, 'package')` — domain `package` |
| `analytics.service.ts` | if occupancy>80, weekend<50%, ... | `evaluate({...}, 'analytics')` — domain `analytics` |
| `report.service.ts` (weekly insights) | if revenue±10%, occupancy>80%, ... | `evaluate({...}, 'report')` — domain `report` |

Mỗi kết quả trả về đều kèm `explanation` để hiển thị lý do cho người dùng.

## 5. Hợp nhất "Cấu hình mức độ" và "Cấu hình nâng cao"

Phát hiện thêm trong quá trình làm: **`AlertRuleTier`** (bảng ngưỡng cảnh báo cũ, 7 loại cố định)
và **`ExpertRule`** là 2 hệ thống rule song song, không liên thông — gây cảm giác "2 nơi cấu hình
riêng nó hơi kỳ".

**Giải pháp:** Migrate toàn bộ dữ liệu `AlertRuleTier` (bao gồm mốc admin đã tự thêm, ví dụ
"Xe đỗ quá lâu ≥48h → Nguy hiểm") thành các `ExpertRule` với `domain = "alert"`. Sau đó:

- `alertRuleTier.service.ts` được viết lại thành **adapter mỏng** trên `ExpertRule` — giữ nguyên
  toàn bộ API cũ (`list`, `create`, `update`, `delete`, `evaluate`) nên `report.service.ts`,
  frontend hook `useAlertRuleTiers`, và các trang dùng nó (VD tô màu thời gian đỗ ở `ParkingExit.tsx`)
  **không cần sửa gì**.
- Bảng `AlertRuleTiers` cũ đã **xoá** khỏi schema (migration `20260829000000_drop_alert_rule_tier`)
  sau khi xác nhận dữ liệu đã chuyển đầy đủ (8/8 mốc, kể cả mốc tuỳ chỉnh).
- Tab **"Cấu hình mức độ"** (dễ dùng: chọn loại cảnh báo có sẵn + ngưỡng + mức độ) và tab
  **"Cấu hình nâng cao"** (`ExpertRulesPanel`, dành cho domain `package`/`analytics`/`report`) giờ
  **cùng đọc/ghi 1 nguồn dữ liệu** — sửa ở đâu cũng phản ánh đúng, không còn 2 nơi tách biệt.
  Domain `alert` được ẩn khỏi panel nâng cao để tránh 2 nơi cùng sửa 1 dữ liệu.

## 6. Cải thiện trải nghiệm quản trị (theo phản hồi trong quá trình dùng thử)

- **Hướng dẫn & ví dụ** — thêm mục thu gọn (mặc định đóng, mở khi cần) ở đầu tab "Cấu hình nâng cao",
  giải thích Input/Output/Explanation kèm ví dụ cụ thể (luật gợi ý gói tháng), có nút "Điền ví dụ
  vào form" để xem trước khi tự tạo luật.
- **Test luật không cần biết JSON** — trước đây phải tự gõ facts dạng JSON để test; giờ **chọn đích
  danh 1 luật** từ danh sách, hệ thống tự sinh ô nhập số theo đúng field (`fact`) luật đó dùng.
  Kết quả hiển thị rõ luật đang test có khớp không + lý do, các luật khác cùng nhóm để phụ bên dưới
  (thu gọn) — tránh nhầm lẫn khi 1 nhóm có nhiều luật.
- **Cảnh báo khi cấu hình sai** — nếu admin gõ `durationDays` không khớp gói dịch vụ nào đang có
  trong hệ thống, hệ thống cảnh báo trước khi lưu (luật vẫn fire được nhưng sẽ không tra ra gói cụ
  thể để gợi ý cho khách).
- **Xuất Excel/CSV** — thêm nút xuất báo cáo cho bảng "Ngưỡng cảnh báo" và bảng "Luật nâng cao",
  cùng kiểu với xuất danh sách cảnh báo đã có.
- **Sửa lỗi UI**: nút "Chạy thử" bị style disabled (xanh nhạt, dễ hiểu lầm là không bấm được) trong
  dark mode → bỏ trạng thái disabled, để cảnh báo qua `message.warning` khi chưa chọn luật. Sửa lỗi
  React key warning trong `Form.List` (spread `{...field}` chứa `key` sai cách theo doc antd).

## 7. Các file chính đã thay đổi

**Backend (mới):**
- `src/expertSystem/{types,knowledgeBase,inferenceEngine,index}.ts`
- `src/expertSystem/rules/defaults.ts`
- `src/services/expertRule.service.ts`
- `src/controllers/expertRule.controller.ts`
- `src/routes/expertRule.routes.ts`

**Backend (sửa):**
- `prisma/schema.prisma` — thêm `ExpertRule`, xoá `AlertRuleTier`
- `src/services/alertRuleTier.service.ts` — viết lại thành adapter
- `src/services/customerPackage.service.ts`, `analytics.service.ts`, `report.service.ts` — bỏ hardcode
- `src/routes/index.ts` — thêm route `/expert-rules`

**Frontend (mới):**
- `src/components/ExpertRulesPanel.tsx`
- `src/hooks/useExpertRules.ts`

**Frontend (sửa):**
- `src/pages/Alerts.tsx` — thêm tab "Cấu hình nâng cao"
- `src/components/AlertSettingsPanel.tsx` — thêm nút xuất báo cáo
- `src/utils/reportExport.ts` — thêm hàm xuất Excel/CSV cho ngưỡng cảnh báo & luật nâng cao

## 8. Kiểm thử đã thực hiện

- `tsc --noEmit` sạch cho cả backend và frontend sau mỗi thay đổi.
- Verify qua browser thật: login → Dashboard (gợi ý thông minh vẫn đúng dữ liệu) → tab "Cấu hình
  mức độ" (8/8 mốc, kể cả mốc tuỳ chỉnh, đọc đúng từ `ExpertRule`) → tab "Cấu hình nâng cao" (11 luật,
  test luật "Gợi ý gói quý" với `frequency=15` → khớp đúng) → không còn console error/warning phát
  sinh từ code mới.
