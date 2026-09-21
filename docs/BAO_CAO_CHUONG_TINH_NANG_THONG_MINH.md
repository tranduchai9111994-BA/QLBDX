# Chương: Thiết kế và cài đặt các tính năng thông minh

> **Hướng dẫn cho Claude Chat:**
> Đây là **một chương hoàn chỉnh** để chèn vào báo cáo đồ án (file Word đang có).
> - Chương này được đánh số tạm là **Chương 4**. Nếu báo cáo đã có Chương 4 khác, hãy đổi số
>   chương và đánh lại toàn bộ mục con (4.1 → x.1, 4.1.1 → x.1.1…) cho khớp, đồng thời cập nhật
>   mục lục tự động của Word.
> - **Giữ nguyên toàn bộ đoạn mã nguồn** — đây là code thật của dự án, không viết lại cho gọn.
>   Định dạng code trong Word: font Consolas 10pt, nền xám nhạt, khung viền mảnh, không tự
>   xuống dòng (bật "Không ngắt dòng" nếu cần).
> - Các bảng đều để dạng bảng Word có viền, hàng tiêu đề đậm, lặp lại tiêu đề khi sang trang.
> - Chỗ ghi **[HÌNH x.y]** cần vẽ sơ đồ hoặc chèn ảnh chụp màn hình — mô tả nội dung hình đã ghi
>   ngay bên dưới, hãy vẽ đúng theo mô tả đó.
> - Mọi tham chiếu chéo (Bảng, Hình) nên dùng chức năng Cross-reference của Word để tự cập nhật.
> - Báo cáo **không giới hạn số trang**, ưu tiên đủ ý và đúng trọng tâm; không được cắt bớt phần
>   giải thích để rút ngắn.

---

## 4.1. Đặt vấn đề

### 4.1.1. Giới hạn của một hệ thống quản lý thuần tuý

Một hệ thống quản lý bãi đỗ xe ở mức cơ bản chỉ thực hiện bốn nhóm thao tác: ghi nhận xe vào, ghi
nhận xe ra, tính tiền và lưu trữ lịch sử. Hệ thống loại này giải quyết được vấn đề *ghi chép*
nhưng để lại nguyên vẹn ba vấn đề *ra quyết định*:

**Thứ nhất, dữ liệu tồn tại nhưng không được khai thác.** Sau vài tháng vận hành, cơ sở dữ liệu
tích luỹ hàng chục nghìn bản ghi lượt gửi xe và giao dịch thanh toán. Tuy nhiên nếu hệ thống chỉ
cung cấp chức năng tra cứu và xuất báo cáo, người quản lý phải tự đọc bảng số liệu rồi tự rút ra
kết luận. Trên thực tế, công việc này hầu như không diễn ra — người quản lý bận vận hành hằng
ngày, và việc phân tích số liệu bị lùi vô thời hạn.

**Thứ hai, các tình huống bất thường không được phát hiện kịp thời.** Một chiếc xe đỗ liên tục 40
giờ trong khi trung bình của loại xe đó là 4 giờ là dấu hiệu cần kiểm tra — có thể là xe bỏ quên,
xe tranh chấp, hoặc lỗi ghi nhận. Nhưng thông tin này chỉ hiện ra nếu có người chủ động mở bảng
danh sách và so sánh từng dòng.

**Thứ ba, cơ hội kinh doanh bị bỏ lỡ.** Một khách hàng gửi xe 15 lần mỗi tháng đang trả tiền theo
lượt, trong khi mua gói tháng sẽ rẻ hơn cho khách và tạo doanh thu ổn định cho bãi. Không có hệ
thống nào chỉ ra điều đó, nhân viên quầy không thể tự nhớ tần suất của từng khách.

### 4.1.2. Định nghĩa "thông minh" áp dụng trong đề tài

Trong phạm vi đề tài này, một chức năng được xem là **thông minh** khi nó thoả mãn đồng thời ba
tiêu chí:

| Tiêu chí | Diễn giải |
|---|---|
| **Chủ động** | Hệ thống tự phân tích dữ liệu và đưa ra kết luận, không chờ người dùng đặt câu hỏi |
| **Khuyến nghị hành động** | Kết quả không dừng ở con số mà chỉ ra việc cần làm |
| **Giải thích được** | Hệ thống nói rõ vì sao đưa ra kết luận đó, bằng ngôn ngữ người vận hành hiểu được |

Định nghĩa này bám sát khái niệm **Hệ hỗ trợ ra quyết định** (Decision Support System – DSS) và
**Hệ chuyên gia** (Expert System) trong lĩnh vực Hệ thống thông tin, và cố ý **không** đồng nhất
"thông minh" với "học máy". Cơ sở của lựa chọn này được trình bày ở mục 4.2.

### 4.1.3. Năm tính năng thông minh đã cài đặt

| # | Tính năng | Loại | Module cài đặt |
|---|---|---|---|
| 1 | Gợi ý gói dịch vụ theo tần suất sử dụng | Hệ khuyến nghị | `customerPackage.service.ts` |
| 2 | Cảnh báo thông minh đa tầng | Hệ cảnh báo | `report.service.ts` → `getAlerts()` |
| 3 | Gợi ý chỗ đỗ bằng thuật toán SAW (MCDA) | Ra quyết định đa tiêu chí + giao diện thích ứng | `utils/smartParkingAlgorithms.ts` + `parking.service.ts` → `smartLookup()` |
| 4 | Tổng quan thông minh: so sánh và xu hướng | DSS – giai đoạn phát hiện | `report.service.ts` → `getInsights()` |
| 5 | Phân tích và hỗ trợ ra quyết định | DSS – giai đoạn thiết kế phương án | `analytics.service.ts` → `getInsights()` |

Điểm đáng lưu ý về mặt kiến trúc: **cả năm tính năng dùng chung một bộ máy suy luận duy nhất**,
đặt tại `backend/src/expertSystem/`. Chúng chỉ khác nhau ở **nhóm luật** (domain) được nạp và ở
tập **dữ kiện** được đo. Thiết kế này được phân tích chi tiết ở mục 4.3.

---

## 4.2. Lựa chọn kiến trúc: Hệ chuyên gia thay vì Học máy

### 4.2.1. Bối cảnh của quyết định

Phiên bản đầu của đề tài có một dịch vụ riêng viết bằng Python (Flask + scikit-learn) làm nhiệm
vụ dự đoán. Dịch vụ này sau đó **được loại bỏ hoàn toàn** và thay bằng kiến trúc hệ chuyên bằng
luật. Đây là quyết định thiết kế có chủ đích, dựa trên bốn cơ sở dưới đây.

### 4.2.2. Bốn cơ sở của quyết định

**(a) Quy mô dữ liệu không đủ để học máy phát huy ưu thế**

Một bãi đỗ xe đơn lẻ sinh ra khoảng vài chục nghìn bản ghi lịch sử sau một năm vận hành. Với quy
mô này, một mô hình học máy (ví dụ phân cụm để phát hiện bất thường, hoặc hồi quy để dự báo công
suất) không cho kết quả vượt trội so với một quy tắc thống kê đơn giản như trung bình trượt hay
so sánh theo kỳ. Chi phí xây dựng và duy trì mô hình vì thế không được bù đắp bằng lợi ích.

**(b) Quy luật của bài toán đã tường minh**

Các quy luật cần áp dụng đều là tri thức mà một người quản lý bãi xe giàu kinh nghiệm tự đúc kết
được:

- "Xe đỗ lâu gấp ba lần mức trung bình của loại xe đó là bất thường."
- "Khách gửi xe từ 20 lần mỗi tháng trở lên thì mua gói năm có lợi hơn."
- "Khu vực còn dưới 10% chỗ trống là sắp đầy, cần điều phối."

Đây chính là định nghĩa của **tri thức chuyên gia** (expert knowledge). Khi tri thức đã tường
minh như vậy, việc dùng một mô hình để *học lại* điều đã biết rõ là thừa và làm mất tính minh
bạch.

**(c) Yêu cầu về khả năng giải thích**

Đây là cơ sở quan trọng nhất. Người sử dụng trực tiếp các khuyến nghị là nhân viên quầy trực và
quản lý bãi — không có nền tảng kỹ thuật. Một khuyến nghị dạng *"xác suất khách này mua gói:
0.87"* sẽ bị bỏ qua vì không ai biết vì sao. Ngược lại, khuyến nghị dạng *"khách đã gửi 12 lần
trong 30 ngày, vượt ngưỡng 12 lần của gói quý"* được nhân viên đọc hiểu ngay và giải thích lại
được cho khách hàng.

Trong bài toán vận hành, **một khuyến nghị không giải thích được là một khuyến nghị không được
thực thi**. Độ chính xác cao thêm vài phần trăm không bù được việc người dùng mất niềm tin.

**(d) Chi phí vận hành**

Kiến trúc hệ chuyên gia không cần huấn luyện lại mô hình, không cần theo dõi hiện tượng trôi mô
hình (model drift), và không cần một dịch vụ Python chạy song song với backend Node.js. Toàn bộ
hệ thống rút gọn còn hai tiến trình (backend và frontend) cùng một cơ sở dữ liệu.

### 4.2.3. So sánh hai hướng tiếp cận

| Tiêu chí | Học máy | Hệ chuyên gia (lựa chọn của đề tài) |
|---|---|---|
| Nguồn tri thức | Học từ dữ liệu lịch sử | Do chuyên gia nghiệp vụ khai báo |
| Yêu cầu dữ liệu | Lớn, đa dạng, đã gán nhãn | Không bắt buộc |
| Khả năng giải thích | Khó, phụ thuộc loại mô hình | Luôn có, sinh tự động cùng kết luận |
| Cách thay đổi hành vi | Huấn luyện lại, triển khai lại | Sửa luật trên giao diện, có hiệu lực ngay |
| Xử lý tình huống chưa từng gặp | Kém | Áp dụng luật, không phụ thuộc dữ liệu quá khứ |
| Chi phí hạ tầng | Thêm dịch vụ huấn luyện và suy luận | Không phát sinh |
| Điểm yếu | Hộp đen, cần dữ liệu lớn | Không tự phát hiện quy luật mới |

**Kết luận của mục 4.2:** với đặc thù bài toán (dữ liệu vừa phải, quy luật tường minh, yêu cầu
giải thích cao), hệ chuyên gia là lựa chọn phù hợp hơn. Điểm yếu của nó — không tự phát hiện quy
luật mới — được bù bằng việc trao quyền điều chỉnh luật cho chính người quản trị, những người
hiểu nghiệp vụ nhất (xem mục 4.11).

---

## 4.3. Thiết kế hệ chuyên gia

### 4.3.1. Mô hình ba thành phần

Hệ chuyên gia của đề tài được xây dựng theo đúng mô hình kinh điển gồm ba thành phần, cộng thêm
cơ chế giải thích:

**[HÌNH 4.1] Kiến trúc hệ chuyên gia của hệ thống QLBDX**

Mô tả hình cần vẽ: sơ đồ khối gồm bốn hộp và các mũi tên:

```
   ┌────────────────────────────────┐
   │  DỮ KIỆN (Facts)               │
   │  Do Service nghiệp vụ đo       │
   │  từ dữ liệu thật trong CSDL    │
   │  VD: { frequency: 12 }         │
   └───────────────┬────────────────┘
                   │ đầu vào
                   ▼
   ┌────────────────────────────────┐  nạp luật   ┌──────────────────────────────┐
   │  MÁY SUY DIỄN                  │ ◄────────── │  CƠ SỞ TRI THỨC              │
   │  Inference Engine              │             │  Knowledge Base              │
   │  inferenceEngine.ts            │             │  knowledgeBase.ts            │
   │  – Đối chiếu dữ kiện với luật  │             │  – Bộ nhớ đệm các luật       │
   │  – Quyết định luật nào "cháy"  │             │  – Nguồn: bảng ExpertRules   │
   └───────────────┬────────────────┘             └──────────────────────────────┘
                   │ đầu ra
                   ▼
   ┌──────────────────────────────────────────────────────┐
   │  KẾT LUẬN + CƠ CHẾ GIẢI THÍCH                        │
   │  – firedRules: các luật thoả mãn                     │
   │  – explanations: "frequency = 12 >= 12 → đúng"       │
   └──────────────────────────────────────────────────────┘
```

### 4.3.2. Ánh xạ lý thuyết sang cài đặt

| Thành phần lý thuyết | Cài đặt trong đề tài | Vai trò cụ thể |
|---|---|---|
| Knowledge Base | `expertSystem/knowledgeBase.ts` + bảng `ExpertRules` | Lưu trữ và cung cấp bộ luật |
| Inference Engine | `expertSystem/inferenceEngine.ts` | Suy diễn tiến, xác định luật thoả mãn |
| Facts | Các Service nghiệp vụ | Đo chỉ số từ dữ liệu vận hành thật |
| Explanation Facility | Trường `explanation` trong `RuleResult` | Sinh lời giải thích cùng lúc với kết luận |
| Knowledge Acquisition | Màn hình *Cảnh báo → Cấu hình nâng cao* | Giao diện để người quản trị bổ sung tri thức |

Bảng trên cho thấy đề tài cài đặt **đầy đủ năm thành phần** của một hệ chuyên gia hoàn chỉnh, kể
cả thành phần thu nhận tri thức (knowledge acquisition) — vốn thường bị bỏ qua trong các đồ án
chỉ dừng ở mức viết luật cứng trong mã nguồn.

### 4.3.3. Cấu trúc dữ liệu của một luật

Một luật tuân theo dạng chuẩn **NẾU – THÌ** (production rule):

```
NẾU   <tất cả điều kiện đều thoả mãn>   THÌ   <thực hiện các hành động>
```

Khai báo kiểu dữ liệu tương ứng:

**Mã nguồn 4.1** — `backend/src/expertSystem/types.ts`

```ts
export interface Condition {
  fact: string;                                          // tên dữ kiện, VD 'frequency'
  operator: 'gte' | 'lte' | 'gt' | 'lt' | 'eq' | 'neq';   // toán tử so sánh
  value: number;                                         // ngưỡng
}

export interface Action {
  type: string;                        // loại hành động: recommend | alert | decision | suggestion
  params: Record<string, any>;         // tham số cụ thể, mỗi loại yêu cầu khoá khác nhau
}

export interface Rule {
  id: number;
  code: string;              // mã luật, duy nhất
  domain: string;            // nhóm luật: package | alert | analytics | report
  name: string;
  description: string | null;
  priority: number;          // số nhỏ hơn = ưu tiên cao hơn
  conditions: Condition[];   // các điều kiện, nối với nhau bằng phép VÀ
  actions: Action[];         // hành động khi luật thoả mãn
  enabled: boolean;          // cho phép tắt luật mà không cần xoá
}
```

**Giải thích các quyết định thiết kế:**

| Trường | Quyết định | Lý do |
|---|---|---|
| `conditions` | Mảng, nối bằng phép VÀ (AND) | Đủ biểu diễn mọi luật của bài toán. Nếu cần phép HOẶC, tách thành hai luật riêng — cách này giữ mỗi luật đơn giản và lời giải thích ngắn gọn |
| `operator` | Cố định 6 toán tử số học | Hạn chế phạm vi để bảo đảm mọi luật đều kiểm chứng được. Không cho phép biểu thức tự do nhằm tránh rủi ro thực thi mã tuỳ ý |
| `priority` | Số nhỏ = ưu tiên cao | Quy ước phổ biến, thuận tiện khi chèn luật mới vào giữa (dùng số cách quãng 10, 20, 30) |
| `enabled` | Cờ bật/tắt riêng | Cho phép tạm ngừng một luật để quan sát mà không mất cấu hình đã nhập |
| `domain` | Phân nhóm luật | Ngăn luật gợi ý gói lẫn với luật cảnh báo; đồng thời giảm số luật phải duyệt mỗi lần suy diễn |

### 4.3.4. Lưu trữ tri thức trong cơ sở dữ liệu

Bộ luật được lưu ở bảng `ExpertRules`:

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `Id` | int, khoá chính | Định danh |
| `Code` | nvarchar, duy nhất | Mã luật, dùng để đối chiếu khi nạp bộ luật mặc định |
| `Domain` | nvarchar | Nhóm luật |
| `Name` | nvarchar | Tên hiển thị |
| `Description` | nvarchar, cho phép rỗng | Mô tả mục đích của luật |
| `Priority` | int | Thứ tự ưu tiên |
| `Conditions` | nvarchar(max) | **Chuỗi JSON** của mảng điều kiện |
| `Actions` | nvarchar(max) | **Chuỗi JSON** của mảng hành động |
| `Enabled` | bit | Trạng thái bật/tắt |
| `UpdatedBy` | int, khoá ngoại | Người sửa gần nhất |

**Ví dụ một dòng dữ liệu thật:**

```json
{
  "code": "pkg_recommend_quarterly",
  "domain": "package",
  "name": "Gợi ý gói quý",
  "description": "Khách đỗ xe >= 12 lần/tháng → gợi ý gói quý, tiết kiệm ~30%",
  "priority": 20,
  "conditions": [
    { "fact": "frequency", "operator": "gte", "value": 12 }
  ],
  "actions": [
    { "type": "recommend",
      "params": { "package": "quarterly", "savings": "~30%", "durationDays": 90 } }
  ],
  "enabled": true
}
```

**Phân tích quyết định lưu điều kiện và hành động dưới dạng JSON:**

*Ưu điểm:* thêm một loại luật mới với cấu trúc tham số khác hoàn toàn không đòi hỏi thay đổi cấu
trúc bảng. Nếu chuẩn hoá thành nhiều bảng quan hệ (`Rules` – `Conditions` – `Actions` – `ActionParams`),
mỗi lần bổ sung một loại tham số mới sẽ phải viết migration cơ sở dữ liệu.

*Nhược điểm:* không truy vấn được theo nội dung điều kiện bằng SQL, ví dụ không thể viết câu lệnh
"tìm mọi luật có ngưỡng lớn hơn 10".

*Đánh giá:* nhược điểm này **không ảnh hưởng** đến hệ thống, vì luật không bao giờ được truy vấn
theo điều kiện. Toàn bộ bộ luật được nạp một lần vào bộ nhớ rồi lọc trong ứng dụng (xem mục 4.4).
Với quy mô vài chục luật, cách này nhanh hơn hẳn truy vấn cơ sở dữ liệu.

---

## 4.4. Cài đặt Cơ sở tri thức

### 4.4.1. Cơ chế nạp và lưu trong bộ nhớ đệm

**Mã nguồn 4.2** — `backend/src/expertSystem/knowledgeBase.ts`

```ts
class KnowledgeBase {
  private rules: Rule[] = [];      // bộ nhớ đệm
  private loaded = false;          // cờ đánh dấu đã nạp hay chưa

  async load(): Promise<void> {
    await this.syncDefaults();                    // (1) bổ sung bộ luật mặc định nếu thiếu

    const rows = await prisma.expertRule.findMany({
      where: { enabled: true },                                    // (2)
      orderBy: [{ domain: 'asc' }, { priority: 'asc' }],           // (3)
    });

    this.rules = rows.map((r) => ({
      id: r.id, code: r.code, domain: r.domain, name: r.name,
      description: r.description, priority: r.priority,
      conditions: JSON.parse(r.conditions) as Condition[],         // (4)
      actions: JSON.parse(r.actions) as Action[],
      enabled: r.enabled,
    }));
    this.loaded = true;
  }

  async ensureLoaded(): Promise<void> {
    if (!this.loaded) await this.load();                           // (5) nạp trễ
  }

  async getRulesByDomain(domain: string): Promise<Rule[]> {
    await this.ensureLoaded();
    return this.rules.filter((r) => r.domain === domain);          // (6)
  }

  async reload(): Promise<void> {
    this.loaded = false;
    await this.load();                                             // (7)
  }
}
```

**Giải thích từng điểm được đánh số:**

| Điểm | Nội dung | Phân tích |
|---|---|---|
| (1) | Gọi `syncDefaults()` trước khi nạp | Bảo đảm hệ thống luôn có bộ luật khởi tạo ngay lần chạy đầu tiên. Chi tiết ở mục 4.4.2 |
| (2) | Chỉ nạp luật `enabled = true` | Đây là điểm mấu chốt: Máy suy diễn **chỉ nhìn thấy** luật đang bật. Tắt một luật là nó lập tức không sinh ra bất kỳ khuyến nghị nào. Màn hình quản trị đọc qua đường khác nên vẫn hiển thị đủ cả luật đã tắt |
| (3) | Sắp xếp sẵn theo `domain` rồi `priority` | Máy suy diễn nhận được mảng đã đúng thứ tự ưu tiên, nên **không cần biết gì** về khái niệm ưu tiên. Trách nhiệm được tách bạch |
| (4) | `JSON.parse` **một lần lúc nạp** | Đây là điểm tối ưu quan trọng. Một lượt suy diễn có thể xét hàng chục luật; nếu giải mã JSON tại thời điểm suy diễn thì cùng một chuỗi bị phân tích lại nhiều lần một cách vô ích |
| (5) | Nạp trễ (lazy loading) | Bộ luật chỉ được đọc từ cơ sở dữ liệu ở lần cần dùng đầu tiên, không làm chậm quá trình khởi động server |
| (6) | Lọc theo nhóm ngay tại đây | Máy suy diễn luôn chỉ nhận đúng tập luật liên quan |
| (7) | `reload()` đặt lại cờ rồi nạp lại | Cơ chế đồng bộ khi luật thay đổi, xem mục 4.4.3 |

### 4.4.2. Bổ sung bộ luật mặc định

Hệ thống cần có sẵn tri thức khởi tạo để hoạt động ngay sau khi cài đặt, đồng thời không được ghi
đè lên chỉnh sửa của người quản trị. Hàm `syncDefaults()` giải quyết yêu cầu này:

**Mã nguồn 4.3** — `backend/src/expertSystem/knowledgeBase.ts`

```ts
private async syncDefaults(): Promise<void> {
  const existing = await prisma.expertRule.findMany({
    where: { code: { in: DEFAULT_RULES.map((r) => r.code) } },     // đối chiếu theo MÃ luật
    select: { id: true, code: true, actions: true },
  });
  const byCode = new Map(existing.map((r) => [r.code, r]));

  const missing = DEFAULT_RULES.filter((r) => !byCode.has(r.code));
  if (missing.length > 0) {
    await prisma.expertRule.createMany({ data: missing });         // chỉ thêm luật CÒN THIẾU
  }
  // ... phần bổ sung field còn thiếu cho luật đã tạo từ phiên bản cũ
}
```

**Điểm thiết kế cần nhấn mạnh:** hàm này đối chiếu theo **mã luật**, không phải theo tổng số dòng
của bảng. Lý do đã được ghi trong chú thích của mã nguồn: bảng `ExpertRules` còn chứa các luật
thuộc nhóm `alert` do màn hình *Cấu hình mức độ* tự sinh ra. Nếu chỉ kiểm tra "bảng đã có bao
nhiêu dòng" thì khi bảng đã có sẵn luật nhóm `alert`, các nhóm `package`, `analytics`, `report`
sẽ **không bao giờ được nạp** — một lỗi rất khó phát hiện vì hệ thống vẫn chạy bình thường, chỉ
là không đưa ra khuyến nghị nào.

### 4.4.3. Đồng bộ khi tri thức thay đổi

Vì bộ luật được giữ trong bộ nhớ, mọi thao tác ghi lên bảng `ExpertRules` đều phải kèm theo lệnh
nạp lại. Vòng đời đầy đủ:

**[HÌNH 4.2] Vòng đời cập nhật tri thức**

```
Người quản trị bấm "Lưu" trên giao diện quản lý luật
              ↓
POST / PUT / PATCH / DELETE  /api/expert-rules
              ↓
expertRule.service ghi thay đổi xuống bảng ExpertRules
              ↓
knowledgeBase.reload()          ← BẮT BUỘC
              ↓
Lượt suy diễn kế tiếp sử dụng bộ luật MỚI
```

Toàn bộ các hàm ghi đều tuân thủ quy tắc này: `create()`, `update()`, `setEnabled()`, `delete()`
trong `expertRule.service.ts`, và `create()`, `update()`, `delete()` trong `alertRuleTier.service.ts`.
Nếu bỏ sót lệnh `reload()` ở bất kỳ hàm nào, luật vừa sửa sẽ không có hiệu lực cho tới khi khởi
động lại server — một lỗi khó truy vết vì nó chỉ xuất hiện gián đoạn.

Trách nhiệm gọi `reload()` được đặt **bên trong Service**, không để lộ ra cho tầng Controller.
Nhờ vậy mọi đường ghi dữ liệu đều đi qua cùng một chỗ có bảo đảm.

---

## 4.5. Cài đặt Máy suy diễn

### 4.5.1. Xét một điều kiện đơn lẻ

**Mã nguồn 4.4** — `backend/src/expertSystem/inferenceEngine.ts`

```ts
function evaluateCondition(condition: Condition, facts: Fact):
    { matched: boolean; explanation: string } {

  const actual = facts[condition.fact];

  // (1) Thiếu dữ kiện hoặc dữ kiện không phải số → coi như KHÔNG thoả, không ném lỗi
  if (actual === undefined || typeof actual !== 'number') {
    return { matched: false, explanation: `${condition.fact}: không có dữ liệu` };
  }

  const op = condition.operator;
  const expected = condition.value;
  let matched = false;
  if (op === 'gte') matched = actual >= expected;
  else if (op === 'lte') matched = actual <= expected;
  else if (op === 'gt')  matched = actual >  expected;
  else if (op === 'lt')  matched = actual <  expected;
  else if (op === 'eq')  matched = actual === expected;
  else if (op === 'neq') matched = actual !== expected;

  const label = OPERATOR_LABELS[op] || op;
  return {
    matched,
    // (2) Sinh lời giải thích ngay tại chỗ so sánh
    explanation: `${condition.fact} = ${actual} ${label} ${expected} → ${matched ? 'đúng' : 'sai'}`,
  };
}
```

**Phân tích hai điểm thiết kế:**

**(1) Chiến lược xử lý dữ kiện thiếu.** Có ba phương án khả dĩ khi một luật tham chiếu tới dữ
kiện không tồn tại: ném lỗi, coi là thoả, hoặc coi là không thoả. Đề tài chọn phương án thứ ba
với lý do: ném lỗi sẽ khiến **cả lượt suy diễn thất bại**, kéo theo các luật khác — vốn hoàn toàn
hợp lệ — cũng không được xét. Coi là thoả thì nguy hiểm hơn nữa, vì luật cấu hình sai sẽ sinh
khuyến nghị sai. Coi là không thoả là phương án an toàn nhất: hậu quả giới hạn trong đúng luật bị
cấu hình sai, và người quản trị vẫn thấy được lý do qua câu "không có dữ liệu" ở màn hình Test luật.

**(2) Sinh lời giải thích cùng lúc với kết luận.** Nếu chỉ cần kết quả đúng/sai thì một biểu thức
so sánh là đủ, không cần viết thành hàm riêng. Hàm này tồn tại vì **lời giải thích phải được sinh
ra tại đúng chỗ so sánh** — đây là nơi duy nhất biết đồng thời cả giá trị thực tế, toán tử và
ngưỡng. Nếu để tầng trên tự dựng câu giải thích thì phải truyền lại toàn bộ ba thông tin đó, và
nguy cơ câu giải thích lệch với phép so sánh thật là rất cao.

### 4.5.2. Xét một luật hoàn chỉnh

**Mã nguồn 4.5** — `backend/src/expertSystem/inferenceEngine.ts`

```ts
function evaluateRule(rule: Rule, facts: Fact): RuleResult {
  const condResults = rule.conditions.map((c) => evaluateCondition(c, facts));

  const matched = condResults.length > 0 && condResults.every((r) => r.matched);

  const condExplanations = condResults.map((r) => r.explanation).join('; ');
  const explanation = matched
    ? `[${rule.name}] Thỏa mãn: ${condExplanations}`
    : `[${rule.name}] Không thỏa: ${condExplanations}`;

  return { rule, matched, explanation, actionOutputs: matched ? rule.actions : [] };
}
```

**Phân tích điều kiện `condResults.length > 0`:**

Phép `Array.prototype.every()` trong JavaScript trả về `true` khi được gọi trên mảng rỗng — hiện
tượng gọi là **chân lý rỗng** (vacuous truth), xuất phát từ logic vị từ: mệnh đề "mọi phần tử của
tập rỗng đều thoả tính chất P" là đúng theo định nghĩa.

Hệ quả nếu bỏ điều kiện kiểm tra độ dài:

| Tình huống | Không có `length > 0` | Có `length > 0` |
|---|---|---|
| Luật có 2 điều kiện, thoả cả 2 | Cháy (đúng) | Cháy (đúng) |
| Luật có 2 điều kiện, thoả 1 | Không cháy (đúng) | Không cháy (đúng) |
| **Luật không có điều kiện nào** | **Cháy với mọi dữ liệu đầu vào (sai)** | Không cháy (đúng) |

Trường hợp thứ ba là lỗi nghiêm trọng: một luật bị lưu thiếu điều kiện sẽ sinh khuyến nghị cho
**toàn bộ** khách hàng, không phân biệt. Hệ thống có hai lớp phòng vệ độc lập cho tình huống này:

- **Lớp 1 – chặn lúc lưu:** `validateRule()` từ chối luật không có điều kiện nào (mục 4.11.1).
- **Lớp 2 – chặn lúc chạy:** chính điều kiện `length > 0` này.

Việc duy trì hai lớp là có chủ đích: dữ liệu trong bảng `ExpertRules` có thể được sửa trực tiếp
bằng công cụ quản trị cơ sở dữ liệu, không đi qua lớp kiểm tra của ứng dụng.

### 4.5.3. Suy diễn trên toàn bộ nhóm luật

**Mã nguồn 4.6** — `backend/src/expertSystem/inferenceEngine.ts`

```ts
class InferenceEngine {
  async evaluate(facts: Fact, domain: string): Promise<EvaluationResult> {
    const rules = await knowledgeBase.getRulesByDomain(domain);   // (1)
    const results = rules.map((r) => evaluateRule(r, facts));     // (2)
    const firedRules = results.filter((r) => r.matched);          // (3)

    return {
      results,                                                    // (4)
      firedRules,
      explanations: firedRules.map((r) => r.explanation),
    };
  }
}
```

**Cơ chế suy diễn: suy diễn tiến (forward chaining).** Hệ thống xuất phát từ tập dữ kiện đã biết,
quét toàn bộ luật của nhóm và thu lại những luật có điều kiện thoả mãn. Đây là hướng suy diễn phù
hợp với bài toán *"có dữ liệu này thì kết luận được gì"*, khác với suy diễn lùi (backward chaining)
vốn phù hợp với bài toán chẩn đoán *"muốn chứng minh kết luận này thì cần dữ kiện gì"*.

**Quyết định không suy diễn nhiều tầng.** Hệ thống cố ý không cho phép kết quả của một luật trở
thành dữ kiện đầu vào cho luật khác. Hai lý do:

1. Bài toán hiện tại không cần: mọi kết luận đều rút ra trực tiếp từ chỉ số đo được.
2. Suy diễn một tầng bảo đảm **chuỗi giải thích luôn có độ dài một**, tức luôn đọc được trong một
   câu. Suy diễn nhiều tầng sẽ sinh ra chuỗi lý luận kiểu "A vì B, B vì C, C vì D" — đúng về mặt
   logic nhưng khó dùng với người vận hành.

**Điểm (4) — giữ lại cả luật không thoả.** Trường `results` chứa kết quả của **mọi** luật, kể cả
luật không cháy. Thoạt nhìn đây là dữ liệu thừa vì phần nghiệp vụ chỉ dùng `firedRules`. Tuy
nhiên đây chính là dữ liệu cho **màn hình Test luật**: người quản trị cần biết vì sao một luật đã
*không* cháy để còn điều chỉnh ngưỡng. Đây là biểu hiện của thành phần *Explanation Facility*
trong lý thuyết hệ chuyên gia — giải thích cả trường hợp phủ định, không chỉ trường hợp khẳng định.

### 4.5.4. Đánh giá độ phức tạp

Gọi *n* là số luật đang bật của một nhóm, *m* là số điều kiện trung bình của một luật. Một lượt
suy diễn có độ phức tạp **O(n × m)**.

Trong thực tế, *n* nằm trong khoảng 3–10 luật mỗi nhóm, *m* thường bằng 1–2. Toàn bộ phép tính
diễn ra trong bộ nhớ trên dữ liệu đã giải mã sẵn, không phát sinh truy vấn cơ sở dữ liệu nào. Chi
phí của một lượt suy diễn vì thế không đáng kể so với chi phí truy vấn để **đo dữ kiện** trước đó.

---

## 4.6. Tính năng 1 — Gợi ý gói dịch vụ

### 4.6.1. Bài toán

Khách hàng gửi xe theo lượt sẽ trả nhiều tiền hơn nếu tần suất cao, trong khi bãi xe lại muốn có
nguồn doanh thu ổn định từ gói. Vấn đề là nhân viên quầy không thể nhớ tần suất của từng khách để
chủ động mời mua gói đúng lúc.

### 4.6.2. Luồng xử lý

**[HÌNH 4.3] Luồng gợi ý gói dịch vụ**

```
① ĐO DỮ KIỆN
   Đếm số lượt gửi xe của khách trong 30 ngày gần nhất → frequency = 12
              ↓
② SUY DIỄN
   evaluate({ frequency: 12 }, 'package')
              ↓
③ XÁC ĐỊNH LUẬT THẮNG
   Gói năm (≥20): không thoả · Gói quý (≥12): thoả · Gói tháng (≥5): thoả
   → priority quyết định: gói quý (20) được chọn trước gói tháng (30)
              ↓
④ TRA GÓI CỤ THỂ
   Tìm trong danh mục gói có thời hạn 90 ngày, đúng loại xe khách gửi nhiều nhất
              ↓
⑤ TRẢ KẾT QUẢ
   Tên gói + giá + mức tiết kiệm + lời giải thích
```

### 4.6.3. Cài đặt — bước đo dữ kiện

**Mã nguồn 4.7** — `backend/src/services/customerPackage.service.ts`

```ts
async getPackageRecommendation(customerId: number) {
  await this.syncExpiredStatuses();
  await syncDuePackagePrices();

  const now = new Date();
  const since30 = new Date();
  since30.setDate(since30.getDate() - 30);                          // (1) cửa sổ trượt 30 ngày

  const [records, activePkg] = await Promise.all([
    prisma.parkingRecord.findMany({
      where: { vehicle: { customerId }, entryTime: { gte: since30 }, status: 'completed' },
      select: { fee: true, vehicleTypeId: true },                   // (2) chỉ lấy 2 cột cần dùng
    }),
    prisma.customerPackage.findFirst({
      where: { customerId, status: { not: 'cancelled' },
               startDate: { lte: now }, endDate: { gte: now } },
    }),
  ]);

  const frequency = records.length;                                 // (3) DỮ KIỆN
  const totalSpent = records.reduce((sum, r) => sum + Number(r.fee || 0), 0);

  if (activePkg) {                                                  // (4) thoát sớm
    return { recommendation: 'none' as const, savings: null, frequency, totalSpent,
             reason: 'Khách hàng đã có gói đang hiệu lực' };
  }

  const evalResult = await evaluate({ frequency }, 'package');      // (5) SUY DIỄN
  const fired = evalResult.firedRules[0];                           // (6) luật ưu tiên cao nhất
```

**Giải thích các điểm:**

| Điểm | Phân tích |
|---|---|
| (1) | Dùng **cửa sổ trượt 30 ngày** thay vì "tháng theo lịch". Nếu tính theo lịch, vào ngày mùng 2 hằng tháng mọi khách hàng đều có tần suất gần bằng 0 và hệ thống ngừng gợi ý — một sai lệch có tính chu kỳ |
| (2) | Chỉ lấy hai cột thực sự cần (`fee` để tính tổng chi, `vehicleTypeId` để tra gói), không kéo toàn bộ bản ghi về ứng dụng |
| (3) | Dữ kiện được rút gọn thành **một con số**. Đây là ranh giới trách nhiệm: Service biết cách đo dữ liệu bãi xe, hệ chuyên gia biết cách ra quyết định |
| (4) | Khách đã có gói thì dừng ngay, không gợi ý bán chồng. Đây là quy tắc nghiệp vụ nằm ngoài bộ luật vì nó mang tính chặn tuyệt đối, không phải điều kiện có thể điều chỉnh |
| (5) | Chỉ một dòng gọi hệ chuyên gia. Muốn bổ sung tiêu chí xét (ví dụ tổng tiền đã chi), chỉ cần thêm khoá vào object dữ kiện rồi tạo luật mới trên giao diện — **không sửa dòng mã nào ở đây** |
| (6) | Lấy phần tử đầu tiên của danh sách luật đã cháy. Điều này đúng vì Cơ sở tri thức đã sắp xếp theo `priority` tăng dần khi nạp (mục 4.4.1, điểm 3) |

### 4.6.4. Cài đặt — bước tra gói cụ thể

**Mã nguồn 4.8** — `backend/src/services/customerPackage.service.ts`

```ts
  const params = fired.actionOutputs[0].params;
  const recommendation: 'yearly'|'quarterly'|'monthly'|'none' = params.package;
  const savings: string | null = params.savings;
  const durationDays: number | null = params.durationDays;

  // Loại xe khách gửi nhiều nhất trong 30 ngày → dùng để tra gói phù hợp
  const typeCounts = new Map<number, number>();
  for (const r of records) typeCounts.set(r.vehicleTypeId, (typeCounts.get(r.vehicleTypeId) || 0) + 1);
  let dominantTypeId = records[0].vehicleTypeId;
  let maxCount = 0;
  for (const [typeId, count] of typeCounts) {
    if (count > maxCount) { maxCount = count; dominantTypeId = typeId; }
  }

  const matchingPackage = await prisma.parkingPackage.findFirst({
    where: { vehicleTypeId: dominantTypeId, durationDays: durationDays!, isActive: true },
  });

  return {
    recommendation, savings, frequency, totalSpent,
    reason: reasonByLevel[recommendation],
    explanation: fired.explanation,                        // ← lời giải thích từ máy suy diễn
    packageId: matchingPackage?.id ?? null,
    packageName: matchingPackage?.name ?? null,
    packagePrice: matchingPackage ? Number(matchingPackage.price) : null,
  };
}
```

**Phân chia trách nhiệm giữa luật và mã nguồn.** Luật chỉ nêu **mức gói** (`quarterly`) và **thời
hạn** (`90` ngày). Việc tra ra gói cụ thể nào trong danh mục vẫn thuộc về mã nghiệp vụ, vì kết
quả còn phụ thuộc loại xe — mà một khách hàng có thể sở hữu nhiều xe khác loại. Hệ thống chọn
loại xe khách gửi **nhiều nhất** trong kỳ, vì giá gói khác nhau theo loại xe.

Ranh giới này thể hiện nguyên tắc thiết kế xuyên suốt: **luật quyết định "nên làm gì", mã nguồn
biết "làm bằng cách nào"**.

### 4.6.5. Bộ luật mặc định

| Mã luật | Điều kiện | Priority | Hành động |
|---|---|---|---|
| `pkg_recommend_yearly` | `frequency >= 20` | 10 | Gói năm, 365 ngày, tiết kiệm ~40% |
| `pkg_recommend_quarterly` | `frequency >= 12` | 20 | Gói quý, 90 ngày, tiết kiệm ~30% |
| `pkg_recommend_monthly` | `frequency >= 5` | 30 | Gói tháng, 30 ngày, tiết kiệm ~20% |

Các ngưỡng 5 / 12 / 20 được đặt tương ứng với điểm hoà vốn giữa giá theo lượt và giá gói của từng
mức. Quan trọng hơn con số cụ thể: chủ bãi xe **tự điều chỉnh được** các ngưỡng này theo bảng giá
và tệp khách của mình, không cần can thiệp mã nguồn.

---

## 4.7. Tính năng 2 — Cảnh báo thông minh đa tầng

### 4.7.1. Kiến trúc hai tầng

Đây là tính năng có thiết kế đáng chú ý nhất về mặt phân tách trách nhiệm:

**[HÌNH 4.4] Kiến trúc hai tầng của hệ cảnh báo**

```
TẦNG 1 — ĐO (thuộc mã nguồn, report.service.ts)
  Tính toán chỉ số từ dữ liệu thật
  "Xe 29A-12345 đã đỗ 13,4 giờ, gấp 3,2 lần trung bình 4,2 giờ của loại xe này"
                              ↓  đưa ra CON SỐ, chưa kết luận mức độ
TẦNG 2 — XẾP MỨC ĐỘ (thuộc dữ liệu, bảng ExpertRules domain = 'alert')
  Đối chiếu con số với bảng mốc do người quản trị cấu hình
  multiplier = 3,2  →  mốc ≥ 3 → Cảnh báo · mốc ≥ 5 → Nguy hiểm
                              ↓
                    severity = 'warning'
```

Nguyên tắc: **mã nguồn chỉ đo, dữ liệu quyết định mức độ**. Nếu chủ bãi thấy hệ thống báo động quá
nhiều, họ chỉ cần vào giao diện nâng mốc từ 3 lên 4 — không cần lập trình viên can thiệp.

### 4.7.2. Các loại cảnh báo được cài đặt

**Bảng 4.x** — Danh mục loại cảnh báo (khai báo tại `expertSystem/domainSpecs.ts`)

| Mã loại | Tên hiển thị | Đơn vị | Chiều so sánh |
|---|---|---|---|
| `zoneNearFullPercent` | Khu vực sắp đầy | % chỗ trống còn lại | `lte` (nhỏ hơn thì cảnh báo) |
| `zoneImbalanceMaxPercent` | Mất cân bằng khu vực | % khu quá tải | `gte` |
| `longParkingHours` | Xe đỗ quá lâu | giờ đã đỗ | `gte` |
| `parkingAnomalyMultiplier` | Xe đỗ bất thường | lần so với trung bình | `gte` |
| `suspiciousPaymentAmount` | Thanh toán bất thường | đồng | `gte` |
| `revenueDropPercent` | Doanh thu sụt giảm | % sụt so với hôm qua | `gte` |
| `renewalFrequency` | Gợi ý gia hạn | lần đỗ xe/tháng | `gte` |

Lưu ý về **chiều so sánh**: loại `zoneNearFullPercent` dùng `lte` vì đo *phần trăm chỗ còn trống* —
càng nhỏ càng nghiêm trọng. Các loại còn lại dùng `gte`. Việc khai báo chiều so sánh cùng chỗ với
loại cảnh báo giúp thuật toán xếp mức độ (mục 4.7.4) xử lý được cả hai chiều bằng một đoạn mã duy nhất.

### 4.7.3. Cài đặt — phát hiện xe đỗ bất thường

Đây là loại cảnh báo thể hiện rõ nhất tính "thông minh" vì ngưỡng của nó **không cố định** mà phụ
thuộc dữ liệu lịch sử.

**Mã nguồn 4.9** — `backend/src/services/report.service.ts` → `getAlerts()`

```ts
// Trung bình thời gian đỗ 30 ngày của TỪNG loại xe (Prisma groupBy + _avg)
const avgDurationByType = new Map(
  vehicleTypeAvgDuration.map((v) => [v.vehicleTypeId, Number(v._avg.duration || 0)])
);

const parkingAnomalyAlerts = currentlyParkedForAnomaly
  .map((record) => {
    const currentMinutes = Math.ceil((now.getTime() - new Date(record.entryTime).getTime()) / 60000);
    const avgMinutes = avgDurationByType.get(record.vehicleTypeId) || 0;

    // (1) Hai lớp chống báo động giả
    if (avgMinutes <= 0 || currentMinutes < settings.parkingAnomalyMinMinutes) return null;

    const multiplier = currentMinutes / avgMinutes;                          // (2)
    const severity = evalTier('parkingAnomalyMultiplier', multiplier);       // (3)
    if (!severity) return null;

    const currentHours = (currentMinutes / 60).toFixed(1);
    const avgHours = (avgMinutes / 60).toFixed(1);
    return {
      id: `parking-anomaly-${record.id}`,
      severity, category: 'parking', title: 'Xe đỗ bất thường',
      description: `${record.licensePlate} (${record.vehicleType.name}) đã đỗ ${currentHours}h, `
                 + `gấp ${multiplier.toFixed(1)} lần trung bình ${avgHours}h của loại xe này. Cần kiểm tra.`,
      occurredAt: record.entryTime,
      smartLevel: 'rule_based',
      suggestedAction: 'Kiểm tra xe',
    };
  })
  .filter(Boolean);
```

**Phân tích ba điểm:**

**(2) Ngưỡng tương đối theo từng loại xe.** Hệ thống không so thời gian đỗ với một hằng số, cũng
không so với trung bình toàn bãi, mà so với **trung bình của chính loại xe đó**. Lý do: xe máy đỗ
8 giờ là bình thường với người đi làm cả ngày; ô tô tải đỗ 8 giờ tại bãi công cộng có thể là bất
thường. Trung bình được tính trên cửa sổ 30 ngày nên tự thích ứng theo mùa vụ và thay đổi trong
tệp khách.

**(1) Hai lớp chống báo động giả.** Đây là chi tiết quyết định tính hữu dụng thực tế của tính năng:

- `avgMinutes <= 0`: loại xe chưa có dữ liệu lịch sử hoàn tất nào. Không có mẫu so sánh thì không
  kết luận được điều gì, phải bỏ qua thay vì chia cho 0.
- `currentMinutes < settings.parkingAnomalyMinMinutes`: xe mới vào bãi. Nếu bỏ qua điều kiện này,
  một loại xe có trung bình 1 phút (do dữ liệu ít) sẽ khiến mọi xe vừa vào 3 phút đều bị báo "gấp
  3 lần trung bình".

Một hệ cảnh báo báo sai nhiều sẽ bị người dùng vô hiệu hoá, khi đó tính năng trở nên vô dụng dù
thuật toán về mặt lý thuyết là đúng. Vì vậy hai lớp lọc này quan trọng không kém thuật toán chính.

**(3) Mức độ do bộ luật quyết định.** Hàm `evalTier` là bí danh của `alertRuleTierService.evaluate`,
tra bảng mốc trong Cơ sở tri thức. Trả về `null` nghĩa là giá trị chưa vượt mốc nào đang bật, khi
đó không sinh cảnh báo.

### 4.7.4. Cài đặt — thuật toán xếp mức độ

**Mã nguồn 4.10** — `backend/src/services/alertRuleTier.service.ts`

```ts
private matchTier(ruleType: RuleType, value: number,
                  grouped: Record<string, GroupedTier[]>): GroupedTier | null {
  const tiers = grouped[ruleType] || [];
  if (tiers.length === 0) return null;              // (1) chưa cấu hình mốc nào → không báo

  const comparator = RULE_TYPES[ruleType].comparator;
  const sorted = [...tiers].sort((a, b) =>
    comparator === 'gte' ? b.threshold - a.threshold      // (2) gte → sắp GIẢM dần
                         : a.threshold - b.threshold);    //     lte → sắp TĂNG dần

  for (const tier of sorted) {                             // (3) duyệt mốc CHẶT NHẤT trước
    const matched = comparator === 'gte' ? value >= tier.threshold : value <= tier.threshold;
    if (matched) return tier;
  }
  return null;
}
```

**Phân tích thuật toán:**

Bài toán: cho một giá trị đo được và một tập mốc ngưỡng, xác định mốc nào áp dụng. Ví dụ với cấu
hình `≥ 3 → Cảnh báo` và `≥ 5 → Nguy hiểm`:

| Giá trị đo | Mốc khớp | Kết quả đúng |
|---|---|---|
| 2,1 | không mốc nào | Không báo |
| 3,2 | ≥ 3 | Cảnh báo |
| 6,8 | **≥ 5** | **Nguy hiểm** |

Với giá trị 6,8, cả hai mốc đều thoả (6,8 ≥ 3 và 6,8 ≥ 5). Nếu duyệt theo thứ tự ngưỡng tăng dần,
thuật toán dừng ở mốc ≥ 3 và trả về mức Cảnh báo — **sai**, vì mức độ nghiêm trọng bị đánh giá
thấp. Lời giải: sắp xếp giảm dần rồi lấy mốc đầu tiên khớp (điểm 2 và 3).

Với chiều so sánh `lte`, logic đảo ngược tương ứng: mốc chặt nhất là mốc có ngưỡng **nhỏ nhất**,
nên sắp tăng dần. Một đoạn mã xử lý được cả hai chiều nhờ khai báo `comparator` tập trung.

**Điểm (1)** thể hiện nguyên tắc *im lặng khi chưa cấu hình*: nếu người quản trị chưa đặt mốc nào
cho một loại cảnh báo, hệ thống coi như tính năng đó chưa được bật, không tự áp một giá trị mặc
định ngầm.

### 4.7.5. Hai giao diện cho cùng một tri thức

Đề tài cung cấp hai màn hình quản trị cho cùng bảng `ExpertRules`:

| Màn hình | Đối tượng | Cách nhập |
|---|---|---|
| Cảnh báo → **Cấu hình mức độ** | Người quản lý nghiệp vụ | Chọn loại cảnh báo, ngưỡng, mức độ qua danh sách thả xuống |
| Cảnh báo → **Cấu hình nâng cao** | Người quản trị hệ thống | Nhập đầy đủ điều kiện và hành động của luật |

Về bản chất, một "mốc ngưỡng cảnh báo" chính là một luật thuộc nhóm `alert` có đúng một điều kiện
và một hành động đặt mức độ. Hàm `tierRuleData()` chuyển đổi dữ liệu từ giao diện đơn giản sang
cấu trúc luật đầy đủ, và **đi qua đúng cùng một hàm `validateRule()`** như luật nhập tay. Nhờ vậy
hai giao diện không thể tạo ra dữ liệu mâu thuẫn nhau; sửa ở giao diện nào cũng phản ánh sang giao
diện kia ngay lập tức.

---

## 4.8. Tính năng 3 — Gợi ý chỗ đỗ bằng thuật toán SAW

### 4.8.1. Bài toán

Với khách quen, nhân viên phải lặp lại chuỗi thao tác: gõ biển số → tra khách hàng → chọn loại xe
→ chọn chỗ đỗ → lưu. Trong giờ cao điểm, chuỗi này tạo ra hàng đợi ở quầy.

Phiên bản đầu của tính năng chỉ xét **một tiêu chí duy nhất**: khách hay đỗ khu nào nhất thì lấy
chỗ đầu tiên còn trống trong khu đó. Cách này bỏ qua những yếu tố mà một nhân viên có kinh nghiệm
vẫn cân nhắc: khu đó đang đông hay vắng, chỗ nào hợp loại xe hơn, khách hay đỗ vào khung giờ nào.
Nó cũng không xếp hạng được các phương án, nên không có gì để giải thích cho khách.

### 4.8.2. Lựa chọn thuật toán

Bài toán "chọn một phương án tốt nhất trong nhiều phương án, cân nhắc nhiều tiêu chí có tầm quan
trọng khác nhau" chính là bài toán **ra quyết định đa tiêu chí (MCDA — Multi-Criteria Decision
Analysis)**. Hệ thống áp dụng **SAW — Simple Additive Weighting**:

- **Fishburn, P.C. (1967)**. *Additive Utilities with Incomplete Product Set*. Operations Research, 15(3), 537-542.
- **Hwang, C.L. & Yoon, K. (1981)**. *Multiple Attribute Decision Making: Methods and Applications*. Springer-Verlag.

Kèm bước tiền xử lý **Exponential Decay Weighting** (Holt, C.C., 1957/2004, *International Journal
of Forecasting*, 20(1), 5-10) để tính mức ưa thích có suy giảm theo thời gian.

SAW được chọn thay vì TOPSIS vì ba lý do, trong đó lý do quyết định là **tính giải thích được**:
điểm SAW diễn giải được bằng một câu tiếng Việt mà nhân viên bãi xe đọc hiểu ngay, trong khi TOPSIS
phải giải thích bằng khái niệm "khoảng cách Euclidean đến phương án lý tưởng" — trừu tượng với
người vận hành. Lập luận đầy đủ xem `docs/DE_XUAT_THUAT_TOAN_GOI_Y_CHO_DO_THONG_MINH.md`.

### 4.8.3. Năm tiêu chí

| # | Tiêu chí | Chiều | Trọng số | Cách tính |
|---|---|---|---|---|
| C1 | Mức ưa thích chỗ đỗ | Benefit | 0.35 | Exponential Decay trên 30 lượt gần nhất, cộng điểm khu + điểm đúng chỗ |
| C2 | Tỷ lệ còn trống của khu | Benefit | 0.25 | Số chỗ trống / tổng chỗ của khu |
| C3 | Độ tương thích loại xe | Benefit | 0.20 | Khu chuyên đúng loại xe = 1.0; khu tổng hợp = 0.5 |
| C4 | Phù hợp khung giờ quen | Benefit | 0.10 | Tỷ lệ lượt đỗ rơi vào khung giờ hiện tại (±1h) |
| C5 | Mức độ đông đúc của khu | **Cost** | 0.10 | Số chỗ đang có xe / tổng chỗ của khu |

### 4.8.4. Cài đặt

**Mã nguồn 4.11** — `backend/src/utils/smartParkingAlgorithms.ts`

```ts
// (1) Tiền xử lý — Exponential Decay Weighting (Holt 1957)
//     Lượt đỗ càng gần đây trọng số càng lớn: weight(i) = alpha * (1-alpha)^i
export function calcZonePreference(recentRecords, alpha = 0.3) {
  const scores = new Map<string, number>();
  recentRecords.forEach((record, index) => {
    const zoneName = record.parkingSpot?.zone?.name;
    if (!zoneName) return;
    const weight = alpha * Math.pow(1 - alpha, index);
    scores.set(zoneName, (scores.get(zoneName) || 0) + weight);
  });
  return scores;
}

// (2) SAW — chuẩn hoá về [0,1] rồi tính tổng có trọng số
for (let j = 0; j < SAW_CRITERIA_COUNT; j++) {
  const column = criteria.map((row) => row[j]);
  const maxVal = Math.max(...column);
  const minVal = Math.min(...column);
  for (let i = 0; i < candidates.length; i++) {
    normalized[i][j] = IS_BENEFIT[j]
      ? (maxVal > 0 ? criteria[i][j] / maxVal : 0)           // benefit: chia cho lớn nhất
      : (criteria[i][j] > 0 ? minVal / criteria[i][j] : 1);  // cost: lấy nhỏ nhất chia
  }
}
const totalScore = w.reduce((sum, weight, j) => sum + weight * normalized[i][j], 0);
```

**Mã nguồn 4.12** — `backend/src/services/parking.service.ts` → `smartLookup()`

```ts
// (3) Chấm điểm C1 ở HAI mức: điểm của khu + điểm của đúng chỗ đó
const candidates = compatibleSpots.map((spot) => ({
  spotId: spot.id,
  zonePreference: (zonePreferences.get(zoneName) || 0) + (spotPreferences.get(spot.id) || 0),
  zoneAvailability: stats?.availability ?? 0,
  typeMatchScore: calcTypeMatch(spot, fullVehicle.vehicleType.name),
  peakHourFit: hourlyPattern.get(zoneName) ?? 0.5,
  currentOccupancy: stats?.occupancy ?? 0,
}));

const sawResults = scoreSAW(candidates, weights);   // weights đọc từ hệ chuyên gia
const bestSpot = sawResults[0];
```

**Phân tích:**

**(1)** Exponential Decay thay cho phép đếm tần suất đơn thuần. Với alpha = 0.3, lượt đỗ gần nhất có
trọng số 0.300, lượt trước đó 0.210, rồi 0.147... Nhờ vậy khi khách đổi thói quen sang khu mới, hệ
thống bám theo sau vài lượt thay vì phải đợi khu mới chiếm đa số trong 30 lượt.

**(2)** Phép chuẩn hoá đưa các tiêu chí có đơn vị khác nhau (điểm decay, tỷ lệ phần trăm, điểm
0.5/1.0) về cùng thang [0, 1] để cộng được với nhau. Hai nhánh điều kiện tương ứng hai chiều tiêu
chí: với tiêu chí benefit thì giá trị lớn nhất được 1 điểm, với tiêu chí cost thì giá trị nhỏ nhất
được 1 điểm.

**(3)** Điểm C1 được cộng từ hai mức — điểm của khu và điểm của **đúng chỗ đó**. Chi tiết này không
có trong thiết kế ban đầu mà phát sinh sau khi chạy thử trên dữ liệu thật: bốn tiêu chí C2-C5 đều
là thuộc tính của khu, trong khi bộ lọc tương thích loại xe gần như luôn chỉ chừa lại một khu duy
nhất, nên nếu C1 cũng chỉ ở mức khu thì **mọi chỗ trống đều bằng điểm nhau** và thuật toán thoái
hoá về đúng hành vi cũ. Quá trình phát hiện và xử lý ghi ở
`docs/THUAT_TOAN_SAW_VAN_DE_VA_CACH_XU_LY.md` mục 3.1.

### 4.8.5. Tính giải thích được

Mỗi kết quả kèm một câu giải thích sinh tự động, nêu hai tiêu chí đóng góp nhiều điểm nhất:

> *"Điểm 1.00 — yếu tố chính: Mức ưa thích chỗ đỗ (35%), Tỷ lệ còn trống (25%)"*

Khi khu quen đã hết chỗ, câu giải thích nói rõ lý do đổi khu thay vì im lặng:

> *"Khu A đã hết chỗ phù hợp — Điểm 0.84 — yếu tố chính: Tỷ lệ còn trống (25%)..."*

Khi thuật toán **không phân biệt được** (khách hoàn toàn mới, mọi chỗ cùng điểm), hệ thống cũng
nói thẳng thay vì tạo cảm giác có căn cứ riêng:

> *"Điểm 1.00 — 27 chỗ trống cùng mức điểm cao nhất, chọn chỗ đầu danh sách"*

Sự trung thực này quan trọng về mặt phương pháp: một hệ thống khuyến nghị nói rõ khi nó không biết
thì đáng tin hơn một hệ thống luôn tỏ ra chắc chắn.

### 4.8.6. Trọng số cấu hình được qua Hệ chuyên gia

Năm trọng số và hệ số alpha không viết cứng trong code mà lưu ở luật `PARKING_REC_WEIGHTS`, domain
`parking_recommendation` của hệ chuyên gia (mục 4.2). Quản trị viên sửa trên màn **Cảnh báo → Cấu
hình nâng cao**; hệ thống nạp lại cơ sở tri thức và áp dụng ngay, không cần biên dịch hay khởi động
lại. Đây chính là tinh thần **Knowledge Acquisition** đã nêu ở mục 4.2, được áp dụng sang một tính
năng không phải suy diễn luật.

Hai lớp bảo vệ:

- **Lúc ghi** — `validateRule()` chặn nếu tổng 5 trọng số khác 1.0 (sai số ±0.001) hoặc alpha nằm
  ngoài khoảng (0, 1), kèm thông báo nêu rõ tổng hiện tại. Nếu không chặn, điểm SAW sẽ vượt ra ngoài
  thang [0, 1] và câu giải thích in ra số vô nghĩa.
- **Lúc đọc** — `getSawConfig()` bọc `try/catch` và rơi về bộ mặc định nếu luật hỏng, thiếu trường
  hoặc bị tắt. Gợi ý chỗ đỗ chạy mỗi lần nhân viên gõ biển số, không được phép hỏng vì một dòng
  cấu hình sai.

### 4.8.7. Kết quả trả về

Ngoài chỗ đỗ gợi ý, API còn trả về nhóm chỉ số hành vi và chi tiết chấm điểm:

| Chỉ số | Ý nghĩa | Cách tính |
|---|---|---|
| `visitCount30Days` | Số lượt ghé 30 ngày | Đếm bản ghi |
| `lastVisit` | Lần ghé gần nhất | Bản ghi mới nhất |
| `avgDurationHours` | Thời gian đỗ trung bình | Trung bình cộng, làm tròn 1 chữ số thập phân |
| `preferredZone` | Khu hay đỗ | Khu có điểm Exponential Decay cao nhất |
| `hasActivePackage` / `packageExpiry` | Tình trạng gói | Truy vấn gói còn hiệu lực |
| `isFrequent` | Khách thân thiết | `visitCount30Days >= 10` |
| `scoringDetails` | Chi tiết thuật toán | Tên thuật toán, tham chiếu học thuật, trọng số đang dùng, alpha, số ứng viên, top 3 chỗ kèm điểm |

Trường `scoringDetails` được giao diện hiển thị trong một panel gập tên **"Vì sao chọn chỗ này?"** —
mặc định đóng để không làm rối màn hình nhập liệu hằng ngày, mở ra khi nhân viên muốn biết căn cứ.

### 4.8.8. Kiểm chứng

Thuật toán nằm trong các hàm thuần tuý, không chạm cơ sở dữ liệu, nên kiểm thử được độc lập:
`backend/src/utils/smartParkingAlgorithms.test.ts` gồm **23 ca**, chạy bằng `npm run test:saw`.
Đáng chú ý:

- Một ca lấy nguyên bộ số của ví dụ minh hoạ trong tài liệu thiết kế và kiểm tra kết quả ra đúng
  0.762 / 0.693 / 0.683 — nếu công thức và tài liệu lệch nhau thì ca này báo lỗi.
- Một ca **hồi quy** tái hiện tình huống mọi chỗ cùng điểm ở mục 4.8.4(3), chặn lỗi đó quay lại.
- Các ca biên: xe chưa có lịch sử, chỉ còn một chỗ trống, không còn chỗ nào, đổi trọng số.

Kiểm chứng trên hệ thống thật (21/09/2026): khi chỗ quen A09 của xe 51H4-23456 bị xe khác chiếm,
hệ thống tự chuyển gợi ý sang A46 — chỗ khách hay đỗ thứ nhì — với điểm 1.000 / 0.969 / 0.960,
chứng minh thuật toán phản ứng theo trạng thái bãi tại thời điểm tra cứu.

### 4.8.9. Hiệu quả

Với khách quen, chuỗi thao tác rút từ 5 bước xuống còn 2 bước: gõ biển số và bấm lưu. Loại xe và
chỗ đỗ được điền tự động và có thể chỉnh lại nếu cần — hệ thống gợi ý chứ không quyết định thay
nhân viên.

---

## 4.9. Tính năng 4 — Tổng quan thông minh

### 4.9.1. Bài toán và cạm bẫy phương pháp

Yêu cầu: so sánh kết quả kinh doanh tuần này với tuần trước. Cách làm ngây thơ là lấy tổng doanh
thu tuần này chia cho tổng doanh thu **trọn** tuần trước. Cách này sai nghiêm trọng:

**[HÌNH 4.5] Sai lệch khi so sánh kỳ không cùng độ dài**

```
Tuần trước (trọn 7 ngày):   ████████████████   100 triệu
Tuần này (mới tới thứ Ba):  ████                28 triệu
                             → Kết luận SAI: "doanh thu giảm 72%"
```

Lỗi này có tính hệ thống: mọi ngày đầu tuần đều cho ra kết luận "giảm mạnh", khiến người quản lý
mất niềm tin vào toàn bộ báo cáo.

### 4.9.2. Cài đặt — chuẩn hoá mốc so sánh

**Mã nguồn 4.12** — `backend/src/services/report.service.ts` → `getInsights()`

```ts
const now = new Date();

// (1) JS đánh số 0=CN..6=T7; tuần làm việc Việt Nam bắt đầu Thứ 2 → quy đổi
const dayOfWeek = now.getDay();
const daysSinceMonday = (dayOfWeek + 6) % 7;        // T2→0, T3→1, ..., CN→6

const thisWeekStart = new Date(now);
thisWeekStart.setDate(thisWeekStart.getDate() - daysSinceMonday);
thisWeekStart.setHours(0, 0, 0, 0);

const lastWeekStart = new Date(thisWeekStart);
lastWeekStart.setDate(lastWeekStart.getDate() - 7);

// (2) Điểm mấu chốt: mốc kết thúc của kỳ trước là CÙNG thứ, CÙNG giờ của tuần trước
const lastWeekSameTime = new Date(now);
lastWeekSameTime.setDate(lastWeekSameTime.getDate() - 7);
```

**Giải thích (1).** Hàm `Date.getDay()` của JavaScript trả 0 cho Chủ nhật và 6 cho Thứ Bảy, trong
khi tuần làm việc tại Việt Nam bắt đầu từ Thứ Hai. Biểu thức `(dayOfWeek + 6) % 7` quy đổi sang số
ngày đã trôi qua kể từ Thứ Hai. Kiểm chứng: Thứ Hai `(1+6)%7 = 0`; Thứ Ba `(2+6)%7 = 1`; Chủ nhật
`(0+6)%7 = 6`. Đây là cách quy đổi không cần rẽ nhánh điều kiện.

**Giải thích (2).** Kỳ so sánh được cắt tại **cùng mốc thời gian tương đối** của tuần trước. Nhờ
vậy hai kỳ luôn có cùng độ dài, và tỷ lệ tăng/giảm phản ánh đúng biến động thật.

### 4.9.3. Sinh gợi ý hành động qua hệ chuyên gia

**Mã nguồn 4.13** — `backend/src/services/report.service.ts` → `getInsights()`

```ts
const globalEval = await evaluate(
  {
    revenueChangePercent: weekComparison.changePercent.revenue,
    longParkedCount,
    expiringPackagesCount,
  },
  'report',
);

// Nội dung gợi ý lấy từ chính luật; số liệu thật điền vào chỗ trống {..}
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

Điểm cần lưu ý: hệ chuyên gia được gọi **hai lần** trong hàm này — một lần cho các chỉ số toàn hệ
thống (đoạn trên), một lần cho từng khu vực (vòng lặp theo `zoneStats`, xét dữ kiện
`zoneOccupancyRate`). Cùng một nhóm luật `report` phục vụ cả hai phạm vi, phân biệt nhờ tên dữ kiện
khác nhau.

---

## 4.10. Tính năng 5 — Phân tích và hỗ trợ ra quyết định

### 4.10.1. Vị trí trong mô hình DSS

Theo mô hình ra quyết định của Herbert Simon, quá trình ra quyết định gồm ba giai đoạn: **Phát
hiện** (Intelligence) → **Thiết kế phương án** (Design) → **Lựa chọn** (Choice). Đối chiếu với đề tài:

| Giai đoạn | Tính năng đảm nhiệm |
|---|---|
| Phát hiện | Tính năng 2 (cảnh báo) và 4 (tổng quan) — chỉ ra tình huống cần chú ý |
| Thiết kế phương án | **Tính năng 5** — đưa ra các phương án kèm tác động ước tính và rủi ro |
| Lựa chọn | Thuộc về người quản lý; hệ thống không tự quyết |

Ranh giới cuối cùng là có chủ đích: hệ thống hỗ trợ, không thay thế người ra quyết định.

### 4.10.2. Cài đặt

**Mã nguồn 4.14** — `backend/src/services/analytics.service.ts` → `getInsights()`

```ts
const dssResult = await evaluate(
  { maxZoneOccupancy, weekendDropPercent, percentWithoutPackage },
  'analytics',
);

const firedIds = new Set(dssResult.firedRules.map((r) => r.actionOutputs[0]?.params?.id));
const explanationById = new Map(
  dssResult.firedRules.map((r) => [r.actionOutputs[0]?.params?.id, r.explanation]));
const messageById = new Map(
  dssResult.firedRules.map((r) => [r.actionOutputs[0]?.params?.id, r.actionOutputs[0]?.params?.message]));

if (firedIds.has('d1')) {
  const z = [...zoneEfficiency].sort((a, b) => b.avgOccupancy - a.avgOccupancy)[0];
  const underusedZone = [...zoneEfficiency].sort((a, b) => a.avgOccupancy - b.avgOccupancy)[0];
  decisions.push({
    id: 'd1',
    question: renderMessage(messageById.get('d1'), { zone: z.zone }),
    analysis: `${z.zone} có occupancy ${z.avgOccupancy}% — gần đầy. `
            + `Doanh thu/chỗ hiện tại: ${z.revenuePerSpot.toLocaleString('vi-VN')}đ.`,
    explanation: explanationById.get('d1'),
    options: [
      {
        action: `Mở thêm chỗ đỗ ở ${z.zone}`,
        estimatedImpact: `Nếu lấp đầy 80% chỗ mới với doanh thu/chỗ tương đương, `
                       + `có thể tăng thêm ~${...}đ/tháng cho mỗi 10 chỗ.`,
        risk: 'Chi phí mở rộng hạ tầng, có thể không lấp đủ ngoài giờ cao điểm.',
      },
      { action: `Giữ nguyên, điều phối xe sang ${underusedZone.zone}`, /* ... */ },
    ],
  });
}
```

**Cấu trúc một khối hỗ trợ quyết định:**

| Thành phần | Vai trò | Nguồn |
|---|---|---|
| `question` | Câu hỏi quyết định | Mẫu câu trong **luật**, điền số liệu bằng `renderMessage` |
| `analysis` | Phân tích tình hình bằng số liệu | Mã nguồn tính từ dữ liệu thật |
| `explanation` | Vì sao khối này xuất hiện | Máy suy diễn sinh ra |
| `options[]` | Các phương án, mỗi phương án gồm hành động, tác động ước tính, rủi ro | Mã nguồn dựng, dựa trên dữ liệu thật của khu vực liên quan |

Việc mỗi phương án đều nêu **cả rủi ro** là điểm phân biệt hệ hỗ trợ ra quyết định với một hệ
khuyến nghị đơn thuần: hệ thống trình bày đánh đổi để người quản lý cân nhắc, không đẩy họ về một
lựa chọn duy nhất.

### 4.10.3. Cơ chế mẫu câu động

**Mã nguồn 4.15** — `backend/src/expertSystem/messageTemplate.ts`

```ts
export function renderMessage(template: unknown,
                              vars: Record<string, string | number> = {}): string {
  if (typeof template !== 'string' || !template.trim()) return '';
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    vars[key] === undefined ? whole : String(vars[key]),
  );
}
```

**Ví dụ hoạt động:**

| Mẫu câu lưu trong luật | Biến truyền vào | Kết quả hiển thị |
|---|---|---|
| `Khu {zone} đã lấp đầy {rate}%, cần điều phối` | `zone='B'`, `rate=92` | Khu B đã lấp đầy 92%, cần điều phối |
| `Xe đỗ quá lâu: giá trị {value} >= mốc 24 giờ` | `value=31.5` | Xe đỗ quá lâu: giá trị 31.5 >= mốc 24 giờ |

**Ý nghĩa thiết kế.** Đây là **mức cấu hình được thứ ba** của hệ thống:

| Mức | Nội dung cấu hình được | Nơi cấu hình |
|---|---|---|
| 1 | Ngưỡng của điều kiện | Giao diện quản lý luật |
| 2 | Mức độ nghiêm trọng | Giao diện cấu hình mức độ |
| 3 | **Câu chữ hiển thị** | Trường `params.message` của luật |

Kết quả: gần như toàn bộ hành vi quan sát được của phần thông minh đều điều chỉnh được mà không
biên dịch lại mã nguồn. Chỉ có *cách đo dữ kiện* là vẫn thuộc về mã nguồn — điều này hợp lý vì
việc đo đòi hỏi hiểu biết về cấu trúc cơ sở dữ liệu.

Chi tiết nhỏ nhưng quan trọng trong cài đặt: khi biến không tồn tại, hàm giữ nguyên chuỗi
`{tenBien}` thay vì thay bằng chuỗi rỗng hay `undefined`. Nhờ vậy lỗi đặt tên biến sai hiện ra rõ
ràng trên giao diện để người quản trị phát hiện, thay vì âm thầm tạo ra một câu thiếu nghĩa.

---

## 4.11. Kiểm soát chất lượng tri thức

Trao quyền sửa luật cho người quản trị mang lại tính linh hoạt, nhưng cũng tạo ra rủi ro: một
luật nhập sai có thể khiến hệ thống sinh khuyến nghị rỗng hoặc lỗi lúc chạy. Đề tài xử lý rủi ro
này bằng ba cơ chế.

### 4.11.1. Kiểm tra luật theo nhóm ngay lúc lưu

**Mã nguồn 4.16** — `backend/src/expertSystem/validation.ts`

```ts
const DOMAIN_VALIDATORS: Record<string, (params, conditions) => void> = {
  // Gợi ý gói — customerPackage.service cần package + durationDays để tra gói, savings để hiển thị
  package(params) {
    requireOneOf(params.package, PACKAGE_LEVELS, 'Mức gói (params.package)');
    if (typeof params.durationDays !== 'number' || params.durationDays <= 0) {
      throw ruleError('Luật gợi ý gói phải có params.durationDays là số ngày > 0');
    }
    if (params.savings === undefined || params.savings === null || params.savings === '') {
      throw ruleError('Luật gợi ý gói phải có params.savings (mức tiết kiệm, VD "~20%")');
    }
  },

  // Cảnh báo — report.service dùng severity để xếp mức độ; message/title là nội dung
  alert(params, conditions) {
    if (!params.message && !params.title) {
      throw ruleError('Luật cảnh báo phải có params.message hoặc params.title');
    }
    requireOneOf(params.severity, VALID_SEVERITIES, 'Mức độ cảnh báo (params.severity)');
    for (const c of conditions) {
      requireOneOf(c.fact, Object.keys(RULE_TYPES), 'Loại cảnh báo (điều kiện fact)');
    }
  },

  analytics(params) { /* id phải nằm trong ANALYTICS_DECISION_IDS + có nội dung */ },
  report(params)    { /* type phải hợp lệ + message không rỗng */ },
};
```

**Nguyên tắc:** mỗi nhóm luật đòi hỏi tham số khác nhau vì **Service tiêu thụ đọc trường khác
nhau**. Kiểm tra ngay lúc lưu để luật thiếu trường bị từ chối tại chỗ, kèm thông báo tiếng Việt
nói rõ thiếu gì — thay vì lưu được rồi tới lúc chạy mới sinh khuyến nghị rỗng hoặc lỗi truy cập
thuộc tính của `undefined` giữa giờ cao điểm.

Đây là ứng dụng của nguyên tắc **phát hiện lỗi càng sớm càng rẻ**: chi phí sửa một luật sai ngay
trên form nhập gần bằng 0, trong khi chi phí truy vết một khuyến nghị rỗng xuất hiện ngẫu nhiên
trên môi trường thật là rất lớn.

Ngoài kiểm tra theo nhóm, hàm `validateShape()` kiểm tra phần chung: mã luật và nhóm không rỗng,
có **ít nhất một điều kiện** (đây chính là lớp phòng vệ thứ nhất đã nêu ở mục 4.5.2), toán tử nằm
trong danh sách cho phép, ngưỡng phải là số, và có ít nhất một hành động.

### 4.11.2. Một nguồn khai báo duy nhất cho giá trị hợp lệ

**[HÌNH 4.6] Mô hình một nguồn sự thật**

```
              backend/src/expertSystem/domainSpecs.ts
                (nơi khai báo DUY NHẤT các giá trị hợp lệ)
                      ╱                            ╲
                     ╱                              ╲
            validation.ts                  GET /api/expert-rules/form-spec
       (từ chối giá trị sai                          ↓
        khi lưu luật)                        ExpertRulesPanel.tsx
                                        (sinh danh sách thả xuống trên giao diện)
```

Nếu tập giá trị hợp lệ được khai báo ở hai nơi — một bản cho kiểm tra ở backend, một bản cho giao
diện — thì mỗi lần bổ sung một loại gợi ý mới phải nhớ sửa cả hai. Quên một chỗ sẽ dẫn tới một
trong hai lỗi: giao diện hiển thị lựa chọn mà backend từ chối, hoặc backend chấp nhận giá trị mà
giao diện không cho chọn.

Giải pháp: giao diện **không viết cứng** danh sách lựa chọn mà gọi API `form-spec` để lấy khuôn
form từ backend. Thêm một loại gợi ý mới chỉ cần sửa đúng một file `domainSpecs.ts`; cả phần kiểm
tra lẫn danh sách thả xuống cùng thay đổi theo.

### 4.11.3. Bảo toàn cấu hình khi cập nhật luật

Trong quá trình phát triển, một lỗi tiềm ẩn của endpoint cập nhật luật đã được phát hiện và sửa.
Vì lỗi này minh hoạ rõ một nguyên tắc thiết kế API, nó được trình bày ngắn ở đây.

**Mã nguồn 4.17** — `backend/src/services/expertRule.service.ts`, hàm `update()`

```ts
// Trước khi sửa — SAI
description: data.description ?? null,      // không gửi → xoá trắng mô tả
priority:    data.priority   ?? 100,        // không gửi → đặt lại độ ưu tiên về 100
enabled:     data.enabled    ?? true,       // không gửi → BẬT LẠI luật đang tắt

// Sau khi sửa — ĐÚNG
...(data.description !== undefined && { description: data.description }),
...(data.priority   !== undefined && { priority: data.priority }),
...(data.enabled    !== undefined && { enabled: data.enabled }),
```

**Bản chất vấn đề.** Prisma bỏ qua trường mang giá trị `undefined`, tức giữ nguyên giá trị đang có
trong cơ sở dữ liệu. Nhưng toán tử `??` đã biến `undefined` thành một giá trị cụ thể **trước khi**
tới Prisma, buộc Prisma phải ghi đè. Hệ quả nghiêm trọng nhất: một luật đã bị tắt có chủ đích sẽ
tự bật lại khi có ai đó cập nhật luật mà không gửi kèm trường `enabled` — và luật đó lập tức sinh
khuyến nghị trở lại.

**Cú pháp sửa** dùng *conditional spread*: khi điều kiện sai, biểu thức `false && {...}` cho ra
`false`, và trải một giá trị `false` không thêm khoá nào vào đối tượng — trường đó vắng mặt hoàn
toàn nên Prisma bỏ qua. Dùng phép so sánh `!== undefined` thay vì kiểm tra "có giá trị thật" để
việc gửi `description: null` vẫn xoá được mô tả như thiết kế ban đầu.

**Bổ sung endpoint chuyên biệt.** Sau khi sửa, hệ thống bổ sung endpoint
`PATCH /api/expert-rules/:id/enabled` chỉ nhận đúng trường `enabled` cho thao tác bật/tắt nhanh.
Hàm xử lý không đọc bất kỳ trường nào khác, nên dù client có gửi kèm dữ liệu gì cũng không thể làm
hỏng nội dung luật. Endpoint `PUT` cũ được giữ nguyên để bảo đảm tương thích ngược.

> Phân tích đầy đủ về lỗi này, bao gồm bảng hành vi trước/sau và nhật ký kiểm thử đối chứng, xem
> tài liệu `docs/SUA_LOI_PARTIAL_UPDATE_EXPERT_RULE.md`.

---

## 4.12. Kiểm thử và đánh giá

### 4.12.1. Kiểm thử đơn vị cho thuật toán tính phí

Thuật toán tính phí gửi xe được cài đặt dưới dạng **hàm thuần** (pure function): không đọc cơ sở
dữ liệu, không đọc đồng hồ hệ thống, kết quả chỉ phụ thuộc tham số truyền vào. Nhờ đặc điểm này,
hàm có thể được kiểm thử bằng cách gọi trực tiếp với dữ liệu giả, không cần dựng cơ sở dữ liệu.

**Các trường hợp kiểm thử:**

| # | Trường hợp | Mục đích |
|---|---|---|
| 1 | Gửi dưới 24 giờ, tổng theo giờ nhỏ hơn giá ngày | Tính theo giờ |
| 2 | Gửi dưới 24 giờ, tổng theo giờ vượt giá ngày | Kiểm tra trần giá ngày |
| 3 | Gửi đúng 24 giờ | Kiểm tra biên |
| 4 | Gửi 25 giờ | Chuyển sang tính theo ngày, làm tròn lên |
| 5 | Gửi 48 giờ | Đúng 2 ngày |
| 6 | Gửi 49 giờ | Làm tròn lên 3 ngày |
| 7 | Khách có gói còn hiệu lực | Miễn phí dù gửi qua đêm |
| 8–9 | Thời gian bằng 0 và giá trị biên khác | Chống chia cho 0, chống số âm |

**Kết quả:** `Result: 9 passed, 0 failed, 9 total`.

### 4.12.2. Kiểm thử tích hợp qua API thật

Nhóm chức năng quản trị bộ luật được kiểm thử ở mức API, chạy trên backend thật kết nối SQL Server
thật, gọi tuần tự bằng `curl` theo kịch bản đầy đủ vòng đời dữ liệu.

**Bộ 1 — vòng đời luật và cơ chế bảo toàn cấu hình (18/18 đạt):**

| Nhóm | Trường hợp | Kết quả |
|---|---|---|
| Xác thực | Đăng nhập lấy JWT | Đạt |
| Tạo | Tạo luật với `priority=42`, `enabled=true`, có mô tả | Đạt |
| Đọc | Lấy danh sách theo nhóm; lấy chi tiết theo id | Đạt |
| Cập nhật | Tắt luật qua `PUT` | Đạt |
| **Bảo toàn** | `PUT` chỉ đổi tên → `enabled`, `priority`, `description` **giữ nguyên** | Đạt (4 khẳng định) |
| Cập nhật | `PUT` có gửi trường → cập nhật đúng | Đạt |
| Xoá mô tả | `PUT` với `description: null` → xoá được | Đạt |
| Kiểm tra | `PUT` thiếu điều kiện/hành động → HTTP 400 | Đạt |
| Xoá | Xoá luật → truy vấn lại trả HTTP 404 | Đạt |

**Bộ 2 — endpoint bật/tắt chuyên biệt (18/18 đạt):**

| Nhóm | Trường hợp | Kết quả |
|---|---|---|
| Chức năng | `PATCH {enabled:false}` → phản hồi và cơ sở dữ liệu đều đổi | Đạt |
| Bảo toàn | Sau `PATCH`, các trường `name`/`priority`/`description`/`conditions` giữ nguyên | Đạt (4 khẳng định) |
| Kiểm tra đầu vào | Body `{}`, `{"enabled":"false"}`, `{"enabled":1}`, `{"enabled":null}` → HTTP 400 | Đạt (4 khẳng định) |
| Phân quyền | Không có token → 401; token nhân viên → 403 | Đạt |
| Xử lý lỗi | id không tồn tại → HTTP 404 (không phải 500) | Đạt |
| Định tuyến | Route mới không che khuất `PUT`/`DELETE` trên `/:id` | Đạt |

### 4.12.3. Kiểm chứng tính hiệu lực của bộ kiểm thử

Một bộ kiểm thử luôn cho kết quả đạt không chứng minh được điều gì — nó có thể đang kiểm tra sai
chỗ. Để xác nhận bộ kiểm thử thực sự bắt được lỗi, bản sửa ở mục 4.11.3 được **tạm hoàn tác** rồi
chạy lại đúng bộ kiểm thử đó trên mã nguồn cũ:

```
[PASS] name đã đổi
[PASS] conditions đã đổi (value=15)
[FAIL] REGRESSION: enabled bị reset về true
[FAIL] REGRESSION: priority bị reset
[FAIL] REGRESSION: description bị xóa
```

Mã nguồn cũ **thất bại đúng ba điểm** cần thất bại, mã nguồn mới đạt cả ba. Đây là bằng chứng cho
thấy bản sửa có tác dụng thật và bộ kiểm thử kiểm tra đúng nội dung cần kiểm tra.

### 4.12.4. Kiểm thử giao diện

Thao tác bật/tắt luật trên màn hình quản trị được kiểm chứng bằng cách theo dõi lưu lượng mạng
thật:

```
PATCH  http://localhost:5000/api/expert-rules/4/enabled  →  200 OK
GET    http://localhost:5000/api/expert-rules            →  200 OK
```

Kết quả xác nhận giao diện gọi đúng endpoint chuyên biệt, không còn phát sinh yêu cầu `PUT` nào.
Sau khi tải lại trang, trạng thái hiển thị khớp với dữ liệu trong cơ sở dữ liệu.

---

## 4.13. Đánh giá kết quả

### 4.13.1. Đối chiếu với mục tiêu đề ra

| Tiêu chí (mục 4.1.2) | Mức độ đáp ứng | Minh chứng |
|---|---|---|
| Chủ động | Đạt | Cảnh báo tự quét, gợi ý gói tự hiện sau khi thu tiền, chỗ đỗ tự điền |
| Khuyến nghị hành động | Đạt | Mỗi cảnh báo có `suggestedAction`; mỗi khối DSS có các phương án kèm tác động và rủi ro |
| Giải thích được | Đạt | Trường `explanation` sinh tự động cho mọi kết luận; màn hình Test luật giải thích cả trường hợp luật không cháy |

### 4.13.2. Đối chiếu với mô hình hệ chuyên gia

| Thành phần lý thuyết | Cài đặt | Đánh giá |
|---|---|---|
| Knowledge Base | Bảng `ExpertRules` + lớp đệm trong bộ nhớ | Đầy đủ, có cơ chế nạp bộ luật mặc định |
| Inference Engine | Suy diễn tiến một tầng | Đủ cho phạm vi bài toán; hạn chế đã nêu ở 4.5.3 |
| Facts | Do Service nghiệp vụ đo | Đầy đủ, mở rộng được không cần sửa máy suy diễn |
| Explanation Facility | Trường `explanation` | Đầy đủ, giải thích cả trường hợp phủ định |
| Knowledge Acquisition | Hai màn hình quản trị + kiểm tra theo nhóm | Đầy đủ — thành phần thường bị bỏ qua trong các đồ án tương tự |

### 4.13.3. Hạn chế

**(a) Suy diễn chỉ một tầng.** Kết quả của một luật không thể trở thành dữ kiện cho luật khác. Với
bài toán hiện tại đây không phải trở ngại, nhưng nếu mở rộng sang chẩn đoán nhiều bước (ví dụ suy
luận nguyên nhân gốc của một chuỗi sự cố) thì cần bổ sung cơ chế chuỗi suy diễn.

**(b) Chỉ so sánh được dữ kiện kiểu số.** `evaluateCondition` chỉ xử lý giá trị số. Muốn đặt luật
theo dữ kiện kiểu chuỗi (ví dụ "khu vực = VIP") thì phải mã hoá thành số hoặc bổ sung toán tử mới.

**(c) Phân loại khu vực suy ra từ tên.** Cơ sở dữ liệu chưa có cột khai báo khu vực dành cho loại
xe nào, nên hệ thống dò từ khoá trong tên khu do người dùng đặt. Hướng khắc phục đã xác định: bổ
sung cột phân loại vào bảng `ParkingZone`.

**(d) Chất lượng tri thức phụ thuộc người cấu hình.** Đây là hạn chế cố hữu của mọi hệ chuyên gia:
hệ thống chỉ thông minh ngang tầm bộ luật được nạp vào. Đề tài giảm nhẹ bằng bộ luật mặc định hợp
lý và lớp kiểm tra chặt, nhưng không loại bỏ được hoàn toàn.

### 4.13.4. Hướng phát triển

| Hướng | Nội dung |
|---|---|
| Suy diễn nhiều tầng | Cho phép kết luận của luật này làm dữ kiện cho luật khác, mở rộng sang bài toán chẩn đoán |
| Ghi nhận phản hồi | Lưu lại khuyến nghị nào được nhân viên chấp nhận, khuyến nghị nào bị bỏ qua |
| Đề xuất ngưỡng tự động | Khi có dữ liệu phản hồi tích luỹ, dùng phương pháp thống kê (hoặc học máy) để **đề xuất** điều chỉnh ngưỡng cho người quản trị duyệt |
| Chuẩn hoá dữ liệu khu vực | Bổ sung cột phân loại loại xe cho bảng `ParkingZone` |

Cần nhấn mạnh về hướng thứ ba: học máy khi đó đóng vai trò **bổ trợ** cho hệ chuyên gia — đề xuất
ngưỡng để con người duyệt — chứ **không thay thế** cơ chế ra quyết định. Cách kết hợp này giữ được
tính giải thích được, vốn là yêu cầu bắt buộc của bài toán đã phân tích ở mục 4.2.2(c).

---

## Phụ lục chương: Bảng tra cứu tệp mã nguồn

| Nội dung | Tệp |
|---|---|
| Kiểu dữ liệu của luật | `backend/src/expertSystem/types.ts` |
| Cơ sở tri thức | `backend/src/expertSystem/knowledgeBase.ts` |
| Máy suy diễn | `backend/src/expertSystem/inferenceEngine.ts` |
| Kiểm tra tính hợp lệ của luật | `backend/src/expertSystem/validation.ts` |
| Khai báo giá trị hợp lệ và khuôn form | `backend/src/expertSystem/domainSpecs.ts` |
| Mẫu câu động | `backend/src/expertSystem/messageTemplate.ts` |
| Bộ luật mặc định | `backend/src/expertSystem/rules/defaults.ts` |
| Gợi ý gói dịch vụ | `backend/src/services/customerPackage.service.ts` |
| Cảnh báo và tổng quan thông minh | `backend/src/services/report.service.ts` |
| Xếp mức độ cảnh báo | `backend/src/services/alertRuleTier.service.ts` |
| Phân tích hỗ trợ ra quyết định | `backend/src/services/analytics.service.ts` |
| Gợi ý chỗ đỗ (SAW) | `backend/src/utils/smartParkingAlgorithms.ts` + `services/parking.service.ts` → `smartLookup()` |
| Quản trị bộ luật (API) | `backend/src/services/expertRule.service.ts` |
| Giao diện quản trị bộ luật | `frontend/src/components/ExpertRulesPanel.tsx` |
| Giao diện cấu hình mức độ | `frontend/src/components/AlertSettingsPanel.tsx` |

## Tài liệu tham chiếu nội bộ

| Tài liệu | Nội dung bổ sung |
|---|---|
| `docs/SMART_FEATURES_DEEP_DIVE.md` | Bộ câu hỏi phản biện dự kiến và cách trả lời |
| `docs/CAU_TRUC_CODE_TINH_NANG_THONG_MINH.md` | Mã nguồn đầy đủ của 5 tính năng, chú thích từng dòng |
| `docs/HUONG_DAN_DOC_CODE.md` | Bản đồ luồng nghiệp vụ toàn hệ thống |
| `docs/SUA_LOI_PARTIAL_UPDATE_EXPERT_RULE.md` | Phân tích đầy đủ lỗi ở mục 4.11.3 |
| `docs/KIEN_TRUC_CHI_TIET.md` | Kiến trúc chi tiết các tầng |
| `docs/TONG_HOP_THAY_DOI_02_09_2026.md` | Số liệu kiểm thử ở mục 4.12 |
