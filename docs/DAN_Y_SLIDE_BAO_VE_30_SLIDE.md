# Dàn ý 30 slide bảo vệ đồ án QLBDX — trọng tâm: các tính năng thông minh

> **Đây là bản mô tả nội dung để dựng slide, không phải slide.**
> Đưa nguyên file này cho Claude Chat kèm câu: *"Dựng bộ slide theo đúng dàn ý này, giữ nguyên
> bảng màu và bố cục đã ghi ở mục 0."*
>
> **Thời lượng:** 25–30 phút · 30 slide · trung bình ~55 giây/slide.
> **Trọng tâm:** 20/30 slide đi sâu vào code các tính năng thông minh.
> **Nguồn nội dung:** toàn bộ code trích trong file này là **code thật** của dự án, đã đối chiếu
> tại thời điểm 02/09/2026. Không có đoạn nào là code minh hoạ bịa ra.

---

## 0. Quy định trình bày (Claude Chat đọc kỹ mục này trước)

### 0.1. Bảng màu — lấy đúng từ `frontend/src/design-system.css`

| Vai trò | Mã màu | Dùng cho |
|---|---|---|
| Chủ đạo | `#005daa` | Tiêu đề slide, thanh nhấn, số thứ tự, viền bảng |
| Chủ đạo nhạt | `#0075d5` | Gradient, trạng thái nhấn, biểu đồ tuyến 2 |
| Nền slide | `#ffffff` | Nền chính |
| Nền phụ | `#f5f7fa` | Nền khối trích dẫn, nền bảng xen kẽ |
| Chữ chính | `#1f2937` | Nội dung |
| Chữ phụ | `#6b7280` | Chú thích, nguồn, số slide |
| Nhấn mạnh tích cực | `#15803d` | "ĐÚNG", kết quả PASS |
| Nhấn mạnh tiêu cực | `#b91c1c` | "SAI", lỗi, cảnh báo nguy hiểm |
| Nền khối code | `#0f172a` (chữ `#e2e8f0`) | Mọi đoạn code |

> Bảng màu này trùng với màu app đang chạy, nên ảnh chụp màn hình demo chèn vào slide sẽ ăn khớp.

### 0.2. Typography

- Tiêu đề slide: sans-serif đậm, 30–34pt, màu `#005daa`.
- Nội dung: sans-serif, 18–22pt, màu `#1f2937`. **Không dùng cỡ dưới 16pt.**
- Code: font đơn cách (Consolas / JetBrains Mono / Fira Code), **14–16pt**, nền tối.

### 0.3. Quy tắc bắt buộc về code trên slide

1. **Tối đa 12 dòng code trên một slide.** Dài hơn thì cắt bớt và ghi `// ...` ở chỗ lược.
2. **Luôn có tên file ở góc trên khối code**, dạng `backend/src/expertSystem/inferenceEngine.ts`.
3. **Tô sáng (highlight) đúng 1–2 dòng mấu chốt** bằng nền `#005daa` mờ 20% — dòng nào thì mỗi
   slide đã ghi rõ ở phần "Nhấn dòng".
4. **Không đọc code trên slide.** Phần "Nói" luôn là giải thích *vì sao*, không phải đọc lại code.

### 0.4. Ký hiệu trong file này

| Ký hiệu | Nghĩa |
|---|---|
| ⏱️ | Thời lượng gợi ý cho slide đó |
| 🔑 | Slide **bắt buộc**, không được lược |
| ⏭️ | Slide có thể lướt nhanh (10–15 giây) nếu thiếu giờ |
| 🖼️ | Cần chèn hình / sơ đồ / ảnh chụp màn hình |

### 0.5. Nhịp tổng thể

| Phần | Slide | Thời lượng |
|---|---|---|
| A. Mở đầu & bối cảnh | 1–4 | ~3 phút |
| B. Hệ chuyên gia — nền tảng kỹ thuật | 5–14 | ~9 phút |
| C. Năm tính năng thông minh | 15–24 | ~9 phút |
| D. Chất lượng kỹ thuật | 25–28 | ~4 phút |
| E. Demo & kết luận | 29–30 | ~4 phút |

---

# PHẦN A — MỞ ĐẦU & BỐI CẢNH

---

## Slide 1 — Bìa ⏱️ 20 giây

**Bố cục:** căn giữa, nền trắng, dải màu `#005daa` chạy dọc mép trái (rộng ~40px).

- **Tiêu đề:** HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE THÔNG MINH (QLBDX)
- **Phụ đề:** Ứng dụng Hệ chuyên gia trong hỗ trợ ra quyết định vận hành
- Tên sinh viên · Lớp · MSSV · Giảng viên hướng dẫn · Tháng 09/2026

🖼️ Ảnh nền mờ 15%: ảnh chụp màn hình Dashboard của hệ thống.

**Nói:** Chào hỏi, giới thiệu tên đề tài, nêu ngay một câu định vị: *"Điểm trọng tâm em muốn
trình bày hôm nay là phần hệ chuyên gia — cách hệ thống tự đưa ra khuyến nghị thay vì chỉ hiển
thị số liệu."*

---

## Slide 2 — Bài toán & phạm vi ⏱️ 50 giây 🔑

**Bố cục:** 2 cột.

**Cột trái — Vấn đề thực tế:**
- Ghi chép thủ công → sai sót, thất thoát
- Không biết chỗ trống ở đâu, khách phải chạy vòng tìm
- Không biết khách nào nên mời mua gói
- Số liệu có nhưng **không ai đọc** → quản lý ra quyết định theo cảm tính

**Cột phải — Hệ thống giải quyết:**
- Số hoá toàn bộ nghiệp vụ xe vào / xe ra / thu tiền
- 8 nhóm chức năng, 19 nhóm API, 20 màn hình
- **5 tính năng thông minh** — hệ thống chủ động khuyến nghị

**Nói:** Nhấn ý cuối: *"Ba gạch đầu đầu tiên là bài toán quản lý thông thường. Gạch cuối mới là
phần em đầu tư nhiều nhất — hệ thống không chỉ lưu trữ mà còn phân tích và đề xuất hành động."*

---

## Slide 3 — Kiến trúc tổng thể ⏱️ 60 giây 🔑 🖼️

**Bố cục:** sơ đồ khối nằm ngang, chiếm 70% slide.

🖼️ **Sơ đồ cần vẽ** (mỗi khối một hộp bo góc, mũi tên nối, khối hệ chuyên gia tô màu `#005daa`
để nổi bật):

```
┌─────────────────┐   HTTP + JWT   ┌──────────────────────────────────┐
│   FRONTEND      │ ─────────────► │           BACKEND                │
│ React 18 + TS   │                │  Express + TypeScript            │
│ Ant Design      │ ◄───────────── │                                  │
│ 20 màn hình     │     JSON       │  Route → Middleware → Controller │
└─────────────────┘                │              ↓                   │
                                   │           Service                │
                                   │              ↓                   │
                                   │  ╔════════════════════════════╗  │
                                   │  ║   HỆ CHUYÊN GIA            ║  │
                                   │  ║ Knowledge Base + Inference ║  │
                                   │  ╚════════════════════════════╝  │
                                   │              ↓                   │
                                   │        Prisma ORM                │
                                   └──────────────┬───────────────────┘
                                                  ▼
                                          ┌──────────────┐
                                          │  SQL Server  │
                                          └──────────────┘
```

**Chú thích dưới sơ đồ:** *Mọi chức năng đều đi đúng một chuỗi: Màn hình → Route → Middleware →
Controller → Service → Prisma → CSDL.*

**Nói:** Đi nhanh từ trái sang phải. Dừng ở khối hệ chuyên gia: *"Khối được tô đậm này là phần em
sẽ trình bày sâu nhất. Nó không nằm ngoài kiến trúc mà được các Service gọi vào như một thư viện
ra quyết định."*

---

## Slide 4 — Vì sao KHÔNG dùng Machine Learning ⏱️ 70 giây 🔑

**Bố cục:** bảng 2 cột, 4 dòng. Đây là slide **rất dễ bị hỏi**, cần chắc.

| Lý do | Giải thích ngắn |
|---|---|
| Dữ liệu không đủ | Một bãi xe đơn lẻ chỉ sinh vài chục nghìn bản ghi — không đủ để mô hình học máy vượt trội một quy tắc thống kê đơn giản |
| Quy luật đã tường minh | "Đỗ lâu gấp 3 lần trung bình là bất thường" — người quản lý giàu kinh nghiệm cũng đặt ra đúng luật đó. Không cần mô hình *học lại* điều đã biết |
| **Giải thích được** | Rule-based luôn trả lời được "vì sao hệ thống báo điều này" bằng một câu tiếng Việt. Mô hình học máy khó giải thích cho nhân viên vận hành |
| Chi phí vận hành | Không cần huấn luyện lại, không theo dõi trôi mô hình, không cần thêm một dịch vụ Python chạy song song |

**Khối nhấn mạnh cuối slide** (nền `#f5f7fa`, viền trái `#005daa`):

> "Thông minh" ở đây không có nghĩa là dự đoán bằng mô hình toán phức tạp, mà là **hệ thống tự
> phân tích dữ liệu, phát hiện tình huống cần chú ý và đề xuất hành động cụ thể** — thay vì bắt
> người dùng tự đọc số liệu thô rồi tự suy luận. Đó chính là định nghĩa của Hệ hỗ trợ ra quyết
> định (DSS).

**Nói:** Nói thẳng đây là **lựa chọn có chủ đích**, không phải né tránh. Nhấn dòng thứ 3: *"Với
bài toán vận hành, khả năng giải thích quan trọng hơn độ chính xác thêm vài phần trăm — nhân viên
phải hiểu vì sao hệ thống báo thì mới tin và hành động theo."*

> 📌 Nếu thầy vặn *"vậy có phải AI không?"* → xem slide dự phòng ở phần Phụ lục cuối file.

---

# PHẦN B — HỆ CHUYÊN GIA: NỀN TẢNG KỸ THUẬT

---

## Slide 5 — Bản đồ 5 tính năng thông minh ⏱️ 50 giây 🔑

**Bố cục:** 5 thẻ ngang, mỗi thẻ có biểu tượng + tên + một dòng mô tả + tên file.

| # | Tính năng | Loại thông minh | File chính |
|---|---|---|---|
| 1 | Gợi ý gói dịch vụ | Hệ khuyến nghị | `customerPackage.service.ts` |
| 2 | Cảnh báo thông minh đa tầng | Hệ cảnh báo | `report.service.ts` → `getAlerts()` |
| 3 | Gợi ý chỗ đỗ bằng SAW (MCDA) | Trải nghiệm thích ứng | `smartParkingAlgorithms.ts` + `smartLookup()` |
| 4 | Tổng quan thông minh | DSS — giai đoạn phát hiện | `report.service.ts` → `getInsights()` |
| 5 | Phân tích & hỗ trợ quyết định | DSS — giai đoạn thiết kế | `analytics.service.ts` |

**Khối dưới cùng, tô nền `#005daa`, chữ trắng:**
> Cả 5 tính năng dùng **chung một bộ máy**: module `backend/src/expertSystem/`

**Nói:** *"Điểm em muốn nhấn: không phải em viết 5 đoạn if/else riêng cho 5 tính năng. Cả năm đều
gọi vào cùng một hệ chuyên gia, chỉ khác nhóm luật (domain). Thêm tính năng thứ sáu chỉ cần thêm
nhóm luật mới, không sửa máy suy diễn."*

---

## Slide 6 — Hệ chuyên gia là gì — 3 thành phần ⏱️ 60 giây 🔑 🖼️

**Bố cục:** sơ đồ 3 khối + mũi tên vòng.

🖼️ **Sơ đồ:**

```
    ┌────────────────────┐
    │  DỮ KIỆN (Facts)   │   ← Service nghiệp vụ đo từ dữ liệu thật
    │  { frequency: 12 } │      VD: khách gửi 12 lần/30 ngày
    └─────────┬──────────┘
              │
              ▼
    ┌────────────────────────┐        ┌──────────────────────────┐
    │  MÁY SUY DIỄN          │ ◄───── │  CƠ SỞ TRI THỨC          │
    │  Inference Engine      │  nạp   │  Knowledge Base          │
    │  inferenceEngine.ts    │  luật  │  knowledgeBase.ts        │
    └─────────┬──────────────┘        │  ← bảng ExpertRules (DB) │
              │                       └──────────────────────────┘
              ▼
    ┌───────────────────────────────────────────┐
    │  KẾT LUẬN + LỜI GIẢI THÍCH                │
    │  "Gợi ý gói quý — vì frequency = 12 >= 12"│
    └───────────────────────────────────────────┘
```

**Bảng đối chiếu bên dưới:**

| Lý thuyết | Cài đặt trong dự án |
|---|---|
| Knowledge Base | `expertSystem/knowledgeBase.ts` + bảng `ExpertRules` trong SQL Server |
| Inference Engine | `expertSystem/inferenceEngine.ts` |
| Facts | Do các Service nghiệp vụ đo và truyền vào |
| Explanation Facility | Trường `explanation` trong `RuleResult` |

**Nói:** Chỉ vào từng khối theo đúng thứ tự mũi tên. *"Đây là đúng mô hình kinh điển của hệ chuyên
gia trong giáo trình. Em ánh xạ từng thành phần sang một file cụ thể trong mã nguồn."*

---

## Slide 7 — Cấu trúc một luật ⏱️ 60 giây 🔑

**Bố cục:** trên là dạng ngôn ngữ tự nhiên, dưới là code.

**Khối trên** (chữ to, căn giữa, nền `#f5f7fa`):

```
NẾU   <tất cả điều kiện đều đúng>   THÌ   <thực hiện các hành động>
```

**Ví dụ cụ thể** (chữ màu `#005daa`):
> **NẾU** số lần gửi xe trong 30 ngày ≥ 5
> **THÌ** gợi ý gói tháng, thời hạn 30 ngày, tiết kiệm ~20%

**Khối code** — `backend/src/expertSystem/types.ts`:

```ts
export interface Condition {
  fact: string;                                         // tên dữ kiện
  operator: 'gte'|'lte'|'gt'|'lt'|'eq'|'neq';           // toán tử so sánh
  value: number;                                        // ngưỡng
}

export interface Rule {
  code: string; domain: string; name: string;
  priority: number;          // nhỏ hơn = ưu tiên cao hơn
  conditions: Condition[];   // nối với nhau bằng VÀ (AND)
  actions: Action[];         // làm gì khi thoả
  enabled: boolean;          // tắt luật mà không cần xoá
}
```

**Nhấn dòng:** `priority` và `conditions`.

**Nói:** *"Hai chi tiết cần lưu ý. Thứ nhất, các điều kiện nối với nhau bằng VÀ — phải thoả hết
thì luật mới cháy. Thứ hai, priority nhỏ hơn nghĩa là ưu tiên cao hơn, dùng khi nhiều luật cùng
thoả — lát nữa em sẽ chỉ chỗ nó phát huy tác dụng."*

---

## Slide 8 — Luật được lưu ở đâu ⏱️ 55 giây 🔑

**Bố cục:** trái là bảng CSDL, phải là một dòng dữ liệu thật.

**Trái — bảng `ExpertRules`:**

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `Code` | nvarchar (unique) | Mã luật |
| `Domain` | nvarchar | Nhóm: package / alert / analytics / report |
| `Priority` | int | Thứ tự ưu tiên |
| `Conditions` | nvarchar(max) | **JSON** mảng điều kiện |
| `Actions` | nvarchar(max) | **JSON** mảng hành động |
| `Enabled` | bit | Bật / tắt |

**Phải — một dòng thật trong CSDL:**

```json
{
  "code": "pkg_recommend_quarterly",
  "domain": "package",
  "priority": 20,
  "conditions": [
    { "fact": "frequency", "operator": "gte", "value": 12 }
  ],
  "actions": [
    { "type": "recommend",
      "params": { "package": "quarterly", "savings": "~30%", "durationDays": 90 } }
  ]
}
```

**Khối nhấn:** Lưu điều kiện/hành động dưới dạng **JSON** để thêm loại luật mới **không phải đổi
cấu trúc bảng**.

**Nói:** *"Đây là điểm thiết kế quan trọng: luật là **dữ liệu**, không phải mã nguồn. Người quản
trị sửa luật trên giao diện là hệ thống áp dụng ngay, không cần lập trình viên biên dịch lại."*

> Nếu thầy hỏi *"lưu JSON thì mất khả năng truy vấn?"* → trả lời: chấp nhận đánh đổi, vì luật chỉ
> được **đọc toàn bộ vào bộ nhớ một lần** rồi lọc trong ứng dụng (xem slide 9), không truy vấn
> theo từng điều kiện bao giờ.

---

## Slide 9 — Cơ sở tri thức: nạp luật vào bộ nhớ ⏱️ 65 giây 🔑

**Bố cục:** code chiếm 60%, giải thích 40% bên phải.

`backend/src/expertSystem/knowledgeBase.ts`

```ts
class KnowledgeBase {
  private rules: Rule[] = [];          // bộ nhớ đệm
  private loaded = false;

  async load(): Promise<void> {
    await this.syncDefaults();          // nạp bù bộ luật mặc định nếu thiếu
    const rows = await prisma.expertRule.findMany({
      where: { enabled: true },                            // ①
      orderBy: [{ domain: 'asc' }, { priority: 'asc' }],   // ②
    });
    this.rules = rows.map((r) => ({
      ...r,
      conditions: JSON.parse(r.conditions),   // ③ giải mã JSON MỘT lần
      actions: JSON.parse(r.actions),
    }));
    this.loaded = true;
  }
}
```

**Nhấn dòng:** ① và ③.

**Giải thích 3 điểm đánh số:**
- ① Chỉ nạp luật **đang bật** → tắt một luật là nó không còn sinh gợi ý nào nữa.
- ② Sắp xếp sẵn theo `priority` → máy suy diễn không cần biết gì về thứ tự ưu tiên.
- ③ `JSON.parse` **một lần lúc nạp**, không phải mỗi lần suy diễn. Một lượt suy diễn có thể xét
  hàng chục luật; nếu giải mã JSON mỗi lần thì đó là công việc lặp lại vô ích.

**Nói:** Nhấn ý ③ — đây là chi tiết tối ưu dễ ghi điểm: *"Em tách rõ trách nhiệm: Cơ sở tri thức
lo việc đọc CSDL, giải mã và lọc luật đang bật. Máy suy diễn nhận vào một mảng luật đã sẵn sàng,
hoàn toàn không biết luật được lưu ở đâu."*

---

## Slide 10 — Cơ sở tri thức: nạp lại khi luật thay đổi ⏱️ 45 giây ⏭️

**Bố cục:** code ngắn + sơ đồ vòng đời.

```ts
async reload(): Promise<void> {
  this.loaded = false;
  await this.load();
}
```

🖼️ **Sơ đồ vòng đời:**

```
Admin bấm "Lưu luật" trên giao diện
        ↓
POST/PUT/PATCH/DELETE /api/expert-rules
        ↓
expertRule.service ghi CSDL
        ↓
knowledgeBase.reload()      ← BẮT BUỘC
        ↓
Lượt suy diễn kế tiếp dùng luật MỚI
```

**Khối cảnh báo** (viền `#b91c1c`):
> Thiếu bước `reload()` thì luật vừa tắt **vẫn tiếp tục cháy** cho tới khi khởi động lại server.
> Vì vậy cả 5 hàm ghi (`create`, `update`, `setEnabled`, `delete`, và các thao tác ở tab Cấu hình
> mức độ) đều gọi `reload()`.

**Nói:** *"Cái giá của việc dùng bộ nhớ đệm là phải nhớ làm mới. Em xử lý bằng cách gọi reload
ngay trong Service, không để lộ trách nhiệm đó ra ngoài cho người gọi."*

---

## Slide 11 — Máy suy diễn: xét một điều kiện ⏱️ 65 giây 🔑

`backend/src/expertSystem/inferenceEngine.ts`

```ts
function evaluateCondition(condition: Condition, facts: Fact) {
  const actual = facts[condition.fact];

  // Thiếu dữ kiện -> KHÔNG thoả, thay vì ném lỗi                        ①
  if (actual === undefined || typeof actual !== 'number') {
    return { matched: false, explanation: `${condition.fact}: không có dữ liệu` };
  }

  let matched = false;
  if (op === 'gte') matched = actual >= expected;
  else if (op === 'lte') matched = actual <= expected;
  // ... 4 toán tử còn lại

  return {
    matched,
    explanation: `${condition.fact} = ${actual} ${label} ${expected} → ${matched ? 'đúng' : 'sai'}`,
  };                                                                   // ②
}
```

**Nhấn dòng:** ① và ②.

**Hai điểm cần nói:**
- ① **Chọn hướng an toàn:** một luật bị cấu hình sai chỉ khiến *luật đó* không cháy, không làm
  hỏng cả lượt suy diễn của các luật khác.
- ② Trả về **kèm câu giải thích**, không chỉ đúng/sai. Đây là lý do không dùng thẳng một biểu
  thức so sánh.

**Nói:** Nhấn ②: *"Nếu chỉ cần đúng/sai thì một dòng `actual >= expected` là xong. Em viết thành
hàm riêng vì hệ chuyên gia bắt buộc phải nói được vì sao — và câu giải thích đó phải sinh ra ngay
tại chỗ so sánh, chỗ duy nhất biết đủ cả giá trị thật lẫn ngưỡng."*

---

## Slide 12 — Máy suy diễn: một chi tiết dễ sai ⏱️ 60 giây 🔑

**Bố cục:** code bên trái, giải thích bên phải, có ví dụ số.

```ts
function evaluateRule(rule: Rule, facts: Fact): RuleResult {
  const condResults = rule.conditions.map((c) => evaluateCondition(c, facts));

  const matched = condResults.length > 0 && condResults.every((r) => r.matched);
  //              ^^^^^^^^^^^^^^^^^^^^^^ ← vì sao cần dòng này?

  return { rule, matched, explanation, actionOutputs: matched ? rule.actions : [] };
}
```

**Nhấn dòng:** dòng `const matched = ...`.

**Giải thích bên phải:**

| | Không có `length > 0` | Có `length > 0` |
|---|---|---|
| Luật có 2 điều kiện, thoả cả 2 | cháy ✅ | cháy ✅ |
| Luật có 2 điều kiện, thoả 1 | không cháy ✅ | không cháy ✅ |
| **Luật KHÔNG có điều kiện nào** | **cháy với MỌI dữ liệu** ❌ | không cháy ✅ |

> Trong JavaScript, `[].every(...)` luôn trả về `true` — gọi là *chân lý rỗng* (vacuous truth).

**Nói:** *"Đây là một cái bẫy của JavaScript. `every` trên mảng rỗng trả về true. Nếu bỏ điều
kiện `length > 0`, một luật bị lưu thiếu điều kiện sẽ cháy với mọi dữ liệu đầu vào — hệ thống sẽ
gợi ý sai cho tất cả khách hàng. Hệ thống có hai lớp chặn: validate lúc lưu không cho tạo luật
rỗng, và dòng này là lớp phòng vệ thứ hai ngay tại máy suy diễn."*

---

## Slide 13 — Máy suy diễn: suy diễn tiến ⏱️ 60 giây 🔑

```ts
class InferenceEngine {
  async evaluate(facts: Fact, domain: string): Promise<EvaluationResult> {
    const rules = await knowledgeBase.getRulesByDomain(domain);   // ① chỉ luật của nhóm đó
    const results = rules.map((r) => evaluateRule(r, facts));     // ② xét TẤT CẢ
    const firedRules = results.filter((r) => r.matched);          // ③ lọc luật cháy

    return {
      results,        // giữ CẢ luật không thoả → cho màn hình "Test luật"
      firedRules,     // phần Service nghiệp vụ thực sự dùng
      explanations: firedRules.map((r) => r.explanation),
    };
  }
}
```

**Nhấn dòng:** ① và dòng `results,`.

**Khối giải thích:**

**Suy diễn tiến (forward chaining):** xuất phát từ dữ kiện đã biết → quét toàn bộ luật của nhóm →
thu lại những luật thoả mãn.

**Cố ý KHÔNG suy diễn nhiều tầng** (kết quả luật này không trở thành dữ kiện cho luật khác) vì:
bài toán chỉ cần một tầng, và một tầng thì chuỗi giải thích luôn ngắn gọn, dễ hiểu với nhân viên
vận hành.

**Nói:** Giải thích thuật ngữ forward chaining bằng lời thường trước, rồi mới nói tên thuật ngữ.
Nhấn `results`: *"Em giữ lại cả kết quả của luật KHÔNG thoả. Nghe có vẻ thừa, nhưng đó chính là
thứ làm nên màn hình Test luật — người quản trị cần biết vì sao một luật đã *không* cháy để còn
chỉnh ngưỡng."*

---

## Slide 14 — Tính giải thích được ⏱️ 55 giây 🔑 🖼️

**Bố cục:** so sánh 2 cột.

| Mô hình học máy (hộp đen) | Hệ chuyên gia (dự án này) |
|---|---|
| "Xác suất khách mua gói: 0.87" | "Gợi ý gói quý — vì `frequency = 12 >= 12`" |
| Không nói được vì sao | Nói rõ luật nào, ngưỡng nào, giá trị nào |
| Muốn đổi hành vi → huấn luyện lại | Muốn đổi hành vi → sửa ngưỡng trên giao diện |
| Nhân viên khó tin để hành động theo | Nhân viên đọc là hiểu, giải thích lại được cho khách |

**Khối code nhỏ** — nơi sinh ra lời giải thích:

```ts
const explanation = matched
  ? `[${rule.name}] Thỏa mãn: ${condExplanations}`
  : `[${rule.name}] Không thỏa: ${condExplanations}`;
```

🖼️ Ảnh chụp màn hình: hộp gợi ý gói ở màn hình Xe ra, có hiển thị câu giải thích.

**Nói:** *"Đây là lý do chính em chọn hệ chuyên gia thay vì học máy. Trong bài toán vận hành, một
khuyến nghị không giải thích được thì nhân viên sẽ bỏ qua. Câu giải thích này đi thẳng lên giao
diện, nhân viên đọc và nói lại được với khách."*

---

# PHẦN C — NĂM TÍNH NĂNG THÔNG MINH

---

## Slide 15 — TN1: Gợi ý gói dịch vụ — luồng tổng thể ⏱️ 55 giây 🔑 🖼️

🖼️ **Sơ đồ 5 bước** (đánh số tròn, màu `#005daa`):

```
① ĐO DỮ KIỆN
   Đếm số lượt khách gửi xe trong 30 ngày  →  frequency = 12
        ↓
② SUY DIỄN
   evaluate({ frequency: 12 }, 'package')
        ↓
③ LUẬT CHÁY
   Gói năm (≥20) ✗ · Gói quý (≥12) ✓ · Gói tháng (≥5) ✓
   → priority quyết định: gói quý (20) thắng gói tháng (30)
        ↓
④ TRA GÓI CỤ THỂ
   Tìm gói quý khớp loại xe khách hay gửi nhất
        ↓
⑤ TRẢ VỀ
   Tên gói + giá + mức tiết kiệm + LỜI GIẢI THÍCH
```

**Nói:** Đi theo mũi tên. Dừng lâu hơn ở ③: *"Chỗ này là ví dụ điển hình cho priority mà em nói ở
slide 7 — khách gửi 12 lần thì thoả cả luật gói quý lẫn gói tháng. Hệ thống phải chọn một, và
priority quyết định chọn gói có lợi hơn cho cả khách lẫn bãi xe."*

---

## Slide 16 — TN1: Code đo dữ kiện & gọi suy diễn ⏱️ 65 giây 🔑

`backend/src/services/customerPackage.service.ts`

```ts
async getPackageRecommendation(customerId: number) {
  const since30 = new Date();
  since30.setDate(since30.getDate() - 30);       // cửa sổ trượt 30 ngày

  const [records, activePkg] = await Promise.all([
    prisma.parkingRecord.findMany({
      where: { vehicle: { customerId }, entryTime: { gte: since30 }, status: 'completed' },
      select: { fee: true, vehicleTypeId: true },
    }),
    /* ... kiểm tra khách đã có gói chưa ... */
  ]);

  const frequency = records.length;               // ← DỮ KIỆN

  if (activePkg) return { recommendation: 'none', reason: 'Khách đã có gói đang hiệu lực' };

  const evalResult = await evaluate({ frequency }, 'package');   // ← SUY DIỄN
  const fired = evalResult.firedRules[0];                        // ← luật ưu tiên cao nhất
```

**Nhấn dòng:** `const frequency = records.length;` và `const evalResult = await evaluate(...)`.

**Ba điểm nói:**
1. **Cửa sổ trượt 30 ngày**, không phải "tháng theo lịch" — nếu tính theo lịch thì ngày mùng 2
   khách nào cũng có tần suất gần bằng 0.
2. Khách **đã có gói thì thoát sớm** — không gợi ý bán chồng, tránh làm phiền.
3. Service chỉ **đo** một con số rồi giao cho hệ chuyên gia. Muốn thêm tiêu chí (ví dụ tổng tiền
   đã chi) thì chỉ cần thêm khoá vào object dữ kiện và tạo luật mới — **không sửa dòng nào ở đây**.

**Nói:** Nhấn điểm 3 — đó là giá trị kiến trúc: *"Ranh giới trách nhiệm rất rõ: Service biết cách
đo dữ liệu bãi xe, hệ chuyên gia biết cách ra quyết định. Hai bên không cần biết việc của nhau."*

---

## Slide 17 — TN1: Chọn luật & tra gói cụ thể ⏱️ 60 giây

```ts
// Cơ sở tri thức đã sắp theo priority tăng dần, mà priority nhỏ = ưu tiên cao
const fired = evalResult.firedRules[0];

const params = fired.actionOutputs[0].params;      // { package, savings, durationDays }

// Khách có thể có nhiều xe khác loại → chọn loại xe gửi NHIỀU NHẤT trong 30 ngày
const typeCounts = new Map<number, number>();
for (const r of records) typeCounts.set(r.vehicleTypeId, (typeCounts.get(r.vehicleTypeId) || 0) + 1);
let dominantTypeId = records[0].vehicleTypeId, maxCount = 0;
for (const [typeId, count] of typeCounts) if (count > maxCount) { maxCount = count; dominantTypeId = typeId; }

const matchingPackage = await prisma.parkingPackage.findFirst({
  where: { vehicleTypeId: dominantTypeId, durationDays: params.durationDays, isActive: true },
});
```

**Nhấn dòng:** `const fired = evalResult.firedRules[0];`

**Bảng bộ luật mặc định** (nhỏ, góc dưới):

| Luật | Điều kiện | Priority | Tiết kiệm |
|---|---|---|---|
| Gói năm | frequency ≥ 20 | 10 | ~40% |
| Gói quý | frequency ≥ 12 | **20** | ~30% |
| Gói tháng | frequency ≥ 5 | 30 | ~20% |

**Nói:** *"Luật chỉ nói mức gói và số ngày — 'quarterly, 90 ngày'. Việc tra ra gói cụ thể nào
trong danh mục vẫn là nghiệp vụ, vì còn phụ thuộc loại xe. Em chọn loại xe khách gửi nhiều nhất
trong 30 ngày, vì giá gói khác nhau theo loại xe."*

---

## Slide 18 — TN2: Cảnh báo — kiến trúc hai tầng ⏱️ 60 giây 🔑 🖼️

🖼️ **Sơ đồ hai tầng:**

```
TẦNG 1 — ĐO (mã nguồn, report.service.ts)
  "Xe 29A-12345 đã đỗ 13.4 giờ, gấp 3.2 lần trung bình 4.2 giờ của loại xe này"
                        ↓ chỉ ra CON SỐ, chưa kết luận
TẦNG 2 — XẾP MỨC ĐỘ (dữ liệu, bảng ExpertRules domain = 'alert')
  multiplier = 3.2  →  mốc ≥ 3 → Cảnh báo · mốc ≥ 5 → Nguy hiểm
                        ↓
                   severity = 'warning'
```

**Khối nhấn:**
> Mã nguồn chỉ **đo**. Việc "số này tới mức nào thì là Nguy hiểm / Cảnh báo / Thông tin" là **dữ
> liệu cấu hình được**, người quản trị sửa trên giao diện.

**Bảy loại cảnh báo hệ thống quét:**
gói sắp hết hạn · gói sai trạng thái · khu sắp đầy · khu lệch tải · xe đỗ quá lâu · xe đỗ bất
thường · giao dịch số tiền bất thường · doanh thu giảm mạnh

**Nói:** *"Đây là chỗ tách bạch rõ nhất giữa 'đo' và 'phán xét'. Nếu chủ bãi thấy hệ thống báo
động quá nhiều, họ chỉ cần vào giao diện nâng mốc từ 3 lên 4 — không cần gọi em sửa code."*

---

## Slide 19 — TN2: Phát hiện xe đỗ bất thường ⏱️ 70 giây 🔑

`backend/src/services/report.service.ts` → `getAlerts()`

```ts
// Trung bình thời gian đỗ 30 ngày của TỪNG loại xe (Prisma groupBy + _avg)
const avgDurationByType = new Map(
  vehicleTypeAvgDuration.map((v) => [v.vehicleTypeId, Number(v._avg.duration || 0)])
);

const parkingAnomalyAlerts = currentlyParkedForAnomaly.map((record) => {
  const currentMinutes = Math.ceil((now.getTime() - new Date(record.entryTime).getTime()) / 60000);
  const avgMinutes = avgDurationByType.get(record.vehicleTypeId) || 0;

  if (avgMinutes <= 0 || currentMinutes < settings.parkingAnomalyMinMinutes) return null;  // ①

  const multiplier = currentMinutes / avgMinutes;                                          // ②
  const severity = evalTier('parkingAnomalyMultiplier', multiplier);                       // ③
  if (!severity) return null;

  return { severity, title: 'Xe đỗ bất thường',
    description: `${record.licensePlate} đã đỗ ${currentHours}h, gấp ${multiplier.toFixed(1)} lần
                  trung bình ${avgHours}h của loại xe này. Cần kiểm tra.` };
}).filter(Boolean);
```

**Nhấn dòng:** ① và ③.

**Ba điểm giải thích:**
- ② **So với trung bình của CÙNG loại xe**, không so với trung bình toàn bãi. Xe máy đỗ 8 giờ là
  bình thường với người đi làm; ô tô tải đỗ 8 giờ có thể là bất thường.
- ① **Hai lớp chống báo động giả:** bỏ qua loại xe chưa có dữ liệu lịch sử (`avgMinutes <= 0`), và
  bỏ qua xe mới vào chưa đủ số phút tối thiểu — nếu không, xe vừa vào 3 phút mà trung bình là 1
  phút sẽ bị báo "gấp 3 lần".
- ③ Ngưỡng "gấp bao nhiêu lần" lấy từ **bộ luật**, không viết cứng.

**Nói:** Nhấn ①: *"Chi tiết em muốn nói kỹ là hai lớp chống báo động giả. Một hệ cảnh báo mà báo
sai nhiều thì nhân viên sẽ tắt nó đi — lúc đó tính năng coi như vô dụng dù thuật toán đúng."*

---

## Slide 20 — TN2: Chọn mốc chặt nhất ⏱️ 55 giây

`backend/src/services/alertRuleTier.service.ts`

```ts
private matchTier(ruleType: RuleType, value: number, grouped): GroupedTier | null {
  const tiers = grouped[ruleType] || [];
  if (tiers.length === 0) return null;                    // chưa cấu hình mốc nào → không báo

  const comparator = RULE_TYPES[ruleType].comparator;
  const sorted = [...tiers].sort((a, b) =>
    comparator === 'gte' ? b.threshold - a.threshold      // ← sắp GIẢM dần
                         : a.threshold - b.threshold);

  for (const tier of sorted) {                            // duyệt mốc CHẶT NHẤT trước
    const matched = comparator === 'gte' ? value >= tier.threshold : value <= tier.threshold;
    if (matched) return tier;
  }
  return null;
}
```

**Nhấn dòng:** dòng `sorted` và `for`.

**Ví dụ minh hoạ** (bảng nhỏ bên dưới):

Cấu hình: `≥ 3 → Cảnh báo`, `≥ 5 → Nguy hiểm`

| Giá trị đo | Mốc khớp | Kết quả |
|---|---|---|
| 2.1 | không mốc nào | không báo |
| 3.2 | ≥ 3 | Cảnh báo |
| 6.8 | **≥ 5** (không phải ≥ 3) | **Nguy hiểm** |

**Nói:** *"Sắp xếp giảm dần rồi lấy mốc đầu tiên khớp — nhờ vậy giá trị 6.8 được xếp Nguy hiểm chứ
không dừng lại ở Cảnh báo. Nếu duyệt theo thứ tự tăng thì mọi giá trị lớn đều bị gán mức nhẹ nhất."*

---

## Slide 21 — TN3: Tra cứu thông minh khi nhập biển số ⏱️ 55 giây 🖼️

**Bố cục:** trái là ảnh chụp màn hình, phải là luồng.

🖼️ Ảnh chụp màn hình **Xe vào** sau khi gõ biển số quen — thấy rõ các ô đã tự điền và hộp thông
tin khách.

**Luồng bên phải:**

```
Nhân viên gõ biển số → rời ô nhập
        ↓
GET /api/parking/smart-lookup/:plate
        ↓
Hệ thống trả về đồng thời:
  • Thông tin xe + chủ xe
  • Số lần ghé 30 ngày, thời gian đỗ trung bình
  • Khu vực khách hay đỗ
  • Tình trạng gói (còn hạn / sắp hết)
  • CHỖ ĐỖ GỢI Ý
        ↓
Form tự điền loại xe + chỗ đỗ
```

**Con số ấn tượng:** với khách quen, nhân viên chỉ cần **gõ biển số → bấm Lưu**. Từ 5 thao tác
xuống còn 2.

**Nói:** *"Đây là loại thông minh khác — không phải khuyến nghị quản trị mà là trải nghiệm thích
ứng theo ngữ cảnh. Hệ thống học thói quen của khách từ chính lịch sử giao dịch."*

---

## Slide 22 — TN3: Gợi ý chỗ đỗ bằng thuật toán SAW ⏱️ 75 giây 🔑

`backend/src/utils/smartParkingAlgorithms.ts` + `parking.service.ts` → `smartLookup()`

**Thuật toán**: SAW — Simple Additive Weighting (Fishburn 1967; Hwang & Yoon 1981), có
Exponential Decay Weighting (Holt 1957) làm bước tiền xử lý.

```ts
// ① Tiền xử lý — Exponential Decay: lượt gần đây trọng số lớn hơn lượt cũ
const weight = alpha * Math.pow(1 - alpha, index);   // α = 0.3

// ② Chấm điểm 2 mức: điểm KHU + điểm ĐÚNG CHỖ đó
zonePreference: (zonePreferences.get(zoneName) || 0) + (spotPreferences.get(spot.id) || 0),

// ③ SAW — chuẩn hoá 5 tiêu chí về [0,1] rồi tính tổng có trọng số
normalized[i][j] = isBenefit[j]
  ? criteria[i][j] / maxVal        // benefit: càng cao càng tốt
  : minVal / criteria[i][j];       // cost:    càng thấp càng tốt
totalScore = w.reduce((sum, weight, j) => sum + weight * normalized[i][j], 0);

// ④ Sinh câu GIẢI THÍCH — nêu 2 tiêu chí đóng góp nhiều điểm nhất
// → "Điểm 1.00 — yếu tố chính: Mức ưa thích chỗ đỗ (35%), Tỷ lệ còn trống (25%)"
```

**Trọng số lưu ở đâu**: luật `PARKING_REC_WEIGHTS` trong hệ chuyên gia — admin sửa trên giao diện,
áp dụng ngay, không cần sửa code.

**Nhấn dòng:** ③ và ④.

**Nói:** *"Đây là thuật toán ra quyết định đa tiêu chí SAW, được trích dẫn nhiều nhất trong ngành
Operations Research. Em chọn nó thay vì TOPSIS vì một lý do: điểm SAW giải thích được bằng một câu
tiếng Việt mà nhân viên bãi xe đọc hiểu ngay — dòng ④. TOPSIS thì phải nói 'khoảng cách Euclidean
đến phương án lý tưởng', người vận hành không hành động được với câu đó.*

*Và toàn bộ trọng số không nằm trong code — nó nằm trong hệ chuyên gia, admin tự chỉnh. Đúng tinh
thần Knowledge Acquisition ở phần trước."*

> **Nếu thầy hỏi "chạy thật có khác gì code cũ không?"** — có, và em đo được: khi chỗ quen A09 bị
> chiếm, hệ thống tự chuyển sang A46 là chỗ khách hay đỗ thứ nhì, điểm 1.000 / 0.969 / 0.960.
> Chi tiết quá trình phát hiện và xử lý ghi ở `docs/THUAT_TOAN_SAW_VAN_DE_VA_CACH_XU_LY.md`.

---

## Slide 23 — TN4: Tổng quan thông minh — bẫy so sánh ⏱️ 60 giây

**Bố cục:** biểu đồ minh hoạ bên trái, code bên phải.

🖼️ **Biểu đồ cột đơn giản** minh hoạ cái bẫy:

```
Tuần trước (trọn 7 ngày):  ████████████████  100 triệu
Tuần này (mới tới thứ 3):  ████              28 triệu
                            → Kết luận SAI: "giảm 72%!"
```

`backend/src/services/report.service.ts` → `getInsights()`

```ts
// JS đánh số 0=CN..6=T7, tuần làm việc VN bắt đầu Thứ 2 → quy đổi
const daysSinceMonday = (now.getDay() + 6) % 7;      // T2→0, T3→1, ..., CN→6

const lastWeekSameTime = new Date(now);
lastWeekSameTime.setDate(lastWeekSameTime.getDate() - 7);   // ← CÙNG MỐC thời gian
```

**Nhấn dòng:** dòng `lastWeekSameTime`.

**Khối nhấn:**
> So sánh tuần này với tuần trước **tính tới cùng thứ, cùng giờ**, không so với trọn tuần trước.
> Nếu so với cả tuần thì sáng thứ Ba tuần nào cũng "giảm mạnh" — một kết luận sai hoàn toàn.

**Nói:** *"Đây là loại lỗi mà nếu không nghĩ tới thì hệ thống vẫn chạy, vẫn ra số, nhưng số đó
gây hiểu nhầm nghiêm trọng. Quản lý sẽ hoảng vì tưởng doanh thu sụp mỗi đầu tuần."*

---

## Slide 24 — TN5: Phân tích DSS & mẫu câu động ⏱️ 60 giây

**Bố cục:** trên là code `renderMessage`, dưới là ví dụ trước/sau.

`backend/src/expertSystem/messageTemplate.ts`

```ts
export function renderMessage(template: unknown, vars: Record<string, string|number> = {}): string {
  if (typeof template !== 'string' || !template.trim()) return '';
  return template.replace(/\{(\w+)\}/g, (whole, key) =>
    vars[key] === undefined ? whole : String(vars[key]));
}
```

**Ví dụ:**

| Mẫu câu lưu trong luật (CSDL) | Số liệu thật | Hiển thị cho người dùng |
|---|---|---|
| `Khu {zone} đã lấp đầy {rate}%, cần điều phối` | zone=B, rate=92 | Khu **B** đã lấp đầy **92%**, cần điều phối |
| `Xe đỗ quá lâu: giá trị {value} >= mốc 24h` | value=31.5 | Xe đỗ quá lâu: giá trị **31.5** >= mốc 24h |

**Khối nhấn:**
> Nội dung câu chữ của cảnh báo/gợi ý cũng nằm trong **luật**, không nằm trong code. Admin sửa
> câu chữ trên giao diện mà không cần biên dịch lại backend.

**Nói:** *"Đây là mức 'cấu hình được' thứ ba. Mức một là ngưỡng, mức hai là mức độ nghiêm trọng,
mức ba là chính câu chữ. Kết quả: gần như toàn bộ hành vi của phần thông minh đều điều chỉnh được
mà không đụng tới mã nguồn."*

---

# PHẦN D — CHẤT LƯỢNG KỸ THUẬT

---

## Slide 25 — Chặn luật sai ngay lúc lưu ⏱️ 55 giây

**Bố cục:** code + bảng quy tắc theo nhóm.

`backend/src/expertSystem/validation.ts`

```ts
const DOMAIN_VALIDATORS = {
  // Gói: customerPackage.service cần package + durationDays để tra gói, savings để hiển thị
  package(params) {
    requireOneOf(params.package, PACKAGE_LEVELS, 'Mức gói');
    if (typeof params.durationDays !== 'number' || params.durationDays <= 0)
      throw ruleError('Luật gợi ý gói phải có params.durationDays là số ngày > 0');
    if (params.savings === undefined || params.savings === null || params.savings === '')
      throw ruleError('Luật gợi ý gói phải có params.savings');
  },
  alert(params, conditions) { /* severity + message + fact hợp lệ */ },
  analytics(params) { /* id nằm trong danh sách + có nội dung */ },
  report(params) { /* type hợp lệ + message không rỗng */ },
};
```

**Khối nhấn:**
> Mỗi nhóm luật đòi hỏi tham số khác nhau vì **Service tiêu thụ đọc field khác nhau**. Chặn ngay
> lúc lưu để một luật thiếu field bị từ chối tại chỗ — thay vì lưu được rồi tới lúc chạy mới sinh
> gợi ý rỗng hoặc lỗi `undefined` giữa giờ cao điểm.

**Nói:** *"Nguyên tắc em áp dụng: phát hiện lỗi càng sớm càng rẻ. Admin nhập sai thì được báo ngay
trên form, kèm câu tiếng Việt nói rõ thiếu field nào."*

---

## Slide 26 — Một nguồn sự thật cho form nhập luật ⏱️ 50 giây ⏭️

🖼️ **Sơ đồ:**

```
            backend/src/expertSystem/domainSpecs.ts
                    (MỘT nguồn khai báo duy nhất)
                    ╱                          ╲
                   ╱                            ╲
        validation.ts                    GET /expert-rules/form-spec
     (chặn giá trị sai                          ↓
      khi lưu)                          ExpertRulesPanel.tsx
                                     (sinh dropdown trên giao diện)
```

**Vấn đề tránh được:** nếu khai báo giá trị hợp lệ ở hai nơi, thêm một loại gợi ý mới phải nhớ sửa
cả hai — quên một chỗ là dropdown hiện lựa chọn mà backend từ chối, hoặc ngược lại.

**Nói:** *"Giao diện nhập luật không viết cứng danh sách lựa chọn mà hỏi backend. Thêm một loại
gợi ý mới chỉ sửa đúng một file, cả validate lẫn dropdown cùng đổi theo."*

---

## Slide 27 — Bảo mật & phân quyền 3 lớp ⏱️ 55 giây 🔑

🖼️ **Sơ đồ 3 lớp xếp chồng:**

```
Lớp 1 — ẨN MENU          MainLayout.tsx (canSee)              → gọn giao diện
Lớp 2 — CHẶN ĐIỀU HƯỚNG  App.tsx (PrivateRoute/AdminRoute/…)  → chặn gõ URL trực tiếp
Lớp 3 — CHẶN API THẬT    middlewares/auth.ts +                → ★ LỚP DUY NHẤT LÀ BẢO MẬT
                         requirePermission.ts
```

**Nguyên tắc từ chối mặc định:**

```ts
const allowed = perm ? (/* tra đúng cột canView/canCreate/... */) : false;
//                                                                  ^^^^^
// Không có dòng quyền cho màn hình đó → TỪ CHỐI (không phải cho qua)
```

**Nói thẳng, đây là điểm ghi điểm:** *"Em muốn nói rõ: hai lớp đầu chỉ để giao diện gọn. Ẩn nút
**không phải** là bảo mật — ai cũng gọi được API bằng Postman. Chỉ lớp thứ ba ở backend mới thực
sự chặn. Ngoài ra, mặc dù token còn hạn 24 giờ, mỗi request vẫn đọc lại tài khoản trong CSDL —
để admin khoá tài khoản là có hiệu lực tức thì, không phải đợi token hết hạn."*

---

## Slide 28 — Kiểm thử: bằng chứng, không phải lời nói ⏱️ 60 giây 🔑

**Bố cục:** 3 khối kết quả.

**① Kiểm thử đơn vị — công thức tính phí**
```
Result: 9 passed, 0 failed, 9 total
```
Tính phí là **hàm thuần** (không đọc CSDL, không đọc giờ hệ thống) nên gọi trực tiếp với dữ liệu
giả để kiểm chứng từng mốc: dưới 24h, đúng 24h, 25h, 48h, 49h, có gói.

**② Kiểm thử API thật — CRUD hệ chuyên gia**
```
KET QUA: PASS=18 FAIL=0        (CRUD + chống ghi đè field không gửi)
KET QUA: PASS=18 FAIL=0        (PATCH bật/tắt + phân quyền 401/403 + 400/404)
```

**③ Đối chứng — bộ test có thật sự bắt lỗi không?**

Tạm hoàn tác bản sửa rồi chạy lại đúng bộ test đó trên code cũ:
```
[FAIL] REGRESSION: enabled bị reset về true
[FAIL] REGRESSION: priority bị reset
[FAIL] REGRESSION: description bị xóa
```

**Nói:** Nhấn ③: *"Em muốn nhấn khối thứ ba. Một bộ test luôn xanh thì không chứng minh được gì —
có thể nó chẳng kiểm tra đúng chỗ. Em cố tình hoàn tác bản sửa, chạy lại, và bộ test fail đúng ba
điểm cần fail. Đó mới là bằng chứng bản sửa có tác dụng thật."*

---

# PHẦN E — DEMO & KẾT LUẬN

---

## Slide 29 — Kịch bản demo trực tiếp ⏱️ 2,5–3 phút 🔑 🖼️

**Bố cục:** 4 bước đánh số lớn, mỗi bước một dòng + ảnh chụp nhỏ minh hoạ.

| # | Thao tác | Điều cần chỉ cho hội đồng thấy |
|---|---|---|
| 1 | Xe vào — gõ biển số xe quen | Form **tự điền** loại xe và chỗ đỗ gợi ý, kèm thông tin khách |
| 2 | Xe ra — bấm báo giá rồi xác nhận | Số tiền + **gợi ý gói kèm lời giải thích** hiện lên sau khi thu tiền |
| 3 | Cảnh báo → Cấu hình mức độ | **Đổi ngưỡng ngay tại chỗ**, quay lại danh sách cảnh báo thấy mức độ đổi theo |
| 4 | Cảnh báo → Cấu hình nâng cao → **Test luật** | Nhập giá trị dữ kiện → hiện luật nào cháy, luật nào không, **và vì sao** |

**Khối nhấn (nền `#005daa`, chữ trắng):**
> Bước 3 và 4 là phần đáng xem nhất — chứng minh trực tiếp rằng **luật là dữ liệu, không phải code**.

**Nói:** Chuẩn bị sẵn dữ liệu trước buổi bảo vệ: một khách đã gửi ≥12 lần, một xe đang đỗ quá lâu.
Câu chốt sau bước 4: *"Em vừa thay đổi hành vi ra quyết định của hệ thống mà không viết một dòng
code nào."*

> ⚠️ **Phương án dự phòng:** nếu không kịp giờ hoặc máy trục trặc, quay sẵn một video 2 phút cho 4
> bước này và chèn vào slide.

---

## Slide 30 — Kết luận & hướng phát triển ⏱️ 60 giây 🔑

**Bố cục:** 2 cột.

**Cột trái — Đã đạt được:**
- Số hoá trọn vẹn nghiệp vụ bãi đỗ xe: 8 nhóm chức năng, 20 màn hình, 19 nhóm API
- **Hệ chuyên gia đầy đủ 3 thành phần**, phục vụ chung cho 5 tính năng thông minh
- Toàn bộ tri thức là **dữ liệu cấu hình được** — ngưỡng, mức độ, và cả câu chữ
- Mọi khuyến nghị đều **giải thích được**
- Có kiểm thử đơn vị và kiểm thử API, kèm đối chứng chứng minh test bắt đúng lỗi
- Mã nguồn được chú thích đầy đủ, kèm tài liệu bản đồ đọc code

**Cột phải — Hướng phát triển:**
- Suy diễn nhiều tầng: cho kết luận của luật này thành dữ kiện của luật khác
- Bổ sung cột phân loại loại xe cho khu vực (hiện đang suy ra từ tên khu)
- Ghi lại lịch sử: khuyến nghị nào được nhân viên chấp nhận → dữ liệu để tinh chỉnh ngưỡng
- Khi dữ liệu đủ lớn: dùng học máy **bổ sung** cho hệ chuyên gia (đề xuất ngưỡng), không thay thế

**Câu kết:**
> Cảm ơn thầy cô đã lắng nghe. Em xin sẵn sàng trả lời câu hỏi.

**Nói:** Đọc chậm gạch cuối cột phải — thể hiện đã hiểu vị trí của học máy chứ không phải né tránh
nó: *"Em không cho rằng học máy vô dụng. Em cho rằng ở quy mô dữ liệu hiện tại, hệ chuyên gia là
lựa chọn đúng — và khi dữ liệu đủ lớn, học máy sẽ đóng vai trò gợi ý ngưỡng cho hệ chuyên gia,
chứ không thay thế nó, vì tính giải thích được vẫn phải giữ."*

---

# PHỤ LỤC — Slide dự phòng cho phần phản biện

> Đặt sau slide 30, **không trình bày**, chỉ mở khi được hỏi đúng câu đó.
> Đề nghị Claude Chat dựng thêm 7 slide này, đánh số P1–P7, dùng bố cục tối giản: 1 câu hỏi lớn
> ở trên, câu trả lời gạch đầu dòng ở dưới.

| # | Câu hỏi dự kiến | Ý chính để trả lời |
|---|---|---|
| P1 | "Hệ thống này có phải AI không?" | Hệ chuyên gia là một nhánh kinh điển của Trí tuệ nhân tạo, có trước học máy. AI ≠ chỉ có học máy. Dẫn đúng 3 thành phần ở slide 6. |
| P2 | "Vì sao không dùng học máy?" | Bốn lý do ở slide 4. Nhấn: dữ liệu chưa đủ + cần giải thích được. |
| P3 | "Luật ai đặt ra? Có cơ sở gì?" | Bộ luật mặc định lấy từ thực tiễn vận hành bãi xe (ngưỡng 5/12/20 lần/tháng tương ứng mức giá gói tháng/quý/năm). Quan trọng hơn: chủ bãi **tự điều chỉnh** được theo dữ liệu của họ. |
| P4 | "Nếu hai luật mâu thuẫn thì sao?" | Cơ chế `priority` (slide 7 + 17). Với nhóm 'alert' thì dùng mốc chặt nhất (slide 20). Không có tình huống hệ thống bị "kẹt". |
| P5 | "Hiệu năng thế nào khi luật nhiều?" | Luật nạp vào bộ nhớ một lần, `JSON.parse` một lần lúc nạp (slide 9). Một lượt suy diễn chỉ là vòng lặp trên mảng đã lọc theo nhóm — độ phức tạp tuyến tính theo số luật của nhóm đó, thực tế vài chục luật. |
| P6 | "Bảo mật ra sao?" | Ba lớp (slide 27) + mật khẩu băm bcrypt có muối riêng + đọc lại tài khoản mỗi request + nguyên tắc từ chối mặc định + ghi nhật ký cả lần đăng nhập thất bại. |
| P7 | "Hai nhân viên cùng chọn một chỗ đỗ đúng cùng lúc thì sao?" | Chỉ một người vào được. **Ba lớp**: (1) kiểm tra sớm để báo lỗi dễ hiểu; (2) chốt chỗ nguyên tử `UPDATE ... WHERE Id=? AND Status='available'` trong transaction — DB khoá dòng rồi mới xét điều kiện nên chỉ một lệnh thắng; (3) chỉ mục UNIQUE có điều kiện ở DB làm chốt chặn cuối. Nhấn: kiểm tra "đọc rồi ghi" một mình là **chưa đủ** vì có khoảng trễ giữa hai bước — đo thực tế trước khi sửa: 5/5 lệnh song song đều lọt. Kiểm chứng: `npm run test:concurrency`. |

---

# Ghi chú cho Claude Chat

1. **Giữ nguyên toàn bộ đoạn code** trong file này — đây là code thật của dự án, không viết lại
   hay "làm đẹp" cho gọn.
2. Các sơ đồ vẽ bằng ASCII trong file này là **mô tả bố cục**, hãy vẽ lại thành sơ đồ đồ hoạ đúng
   cấu trúc đó.
3. Chỗ nào ghi 🖼️ mà cần ảnh chụp màn hình thì để **khung giữ chỗ** có ghi rõ cần chụp màn hình
   nào — người trình bày sẽ tự chụp và chèn.
4. Chân trang mỗi slide: số slide + tên đề tài, cỡ 12pt, màu `#6b7280`.
5. Slide có 🔑 tuyệt đối không lược bớt nội dung khi dàn trang; slide có ⏭️ nếu chật thì được rút gọn.
6. Nếu nội dung một slide tràn, **tách làm hai slide** và đánh số phụ (ví dụ 19a, 19b) — không thu
   nhỏ chữ dưới 16pt.

---

# Nguồn tham chiếu

Toàn bộ nội dung dựa trên mã nguồn thật và các tài liệu sau trong `docs/`:

| Tài liệu | Nội dung liên quan |
|---|---|
| [SMART_FEATURES_DEEP_DIVE.md](SMART_FEATURES_DEEP_DIVE.md) | Lý do không dùng học máy · bộ câu hỏi phản biện |
| [CAU_TRUC_CODE_TINH_NANG_THONG_MINH.md](CAU_TRUC_CODE_TINH_NANG_THONG_MINH.md) | Cấu trúc code 5 tính năng thông minh |
| [HUONG_DAN_DOC_CODE.md](HUONG_DAN_DOC_CODE.md) | Bản đồ luồng · bảng tra "chức năng X ở đâu" |
| [KIEN_TRUC_TONG_QUAN.md](KIEN_TRUC_TONG_QUAN.md) · [KIEN_TRUC_CHI_TIET.md](KIEN_TRUC_CHI_TIET.md) | Sơ đồ kiến trúc (slide 3) |
| [BAO_CAO_CHUONG_TINH_NANG_THONG_MINH.md](BAO_CAO_CHUONG_TINH_NANG_THONG_MINH.md) | Bản chuyên sâu của cùng nội dung, dùng cho báo cáo Word |
| [TONG_HOP_THAY_DOI_02_09_2026.md](TONG_HOP_THAY_DOI_02_09_2026.md) | Số liệu kiểm thử ở slide 28 |
