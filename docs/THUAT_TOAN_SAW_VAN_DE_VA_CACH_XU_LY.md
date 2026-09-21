# Thuật toán gợi ý chỗ đỗ SAW — Vấn đề gặp phải, cách xử lý và cách kiểm chứng

> **Tài liệu này là gì**: nhật ký kỹ thuật của lần triển khai thuật toán SAW vào tính năng gợi ý
> chỗ đỗ. Ghi lại từng vấn đề đã gặp, nguyên nhân thật (có số liệu đo được), cách xử lý, vị trí
> code tương ứng và cách tự kiểm chứng lại bằng test.
>
> **Phân biệt với tài liệu kia**: `DE_XUAT_THUAT_TOAN_GOI_Y_CHO_DO_THONG_MINH.md` là bản **thiết
> kế** (chọn thuật toán nào và vì sao). Tài liệu này là bản **thực thi** (làm rồi thì vỡ ra
> những gì, sửa thế nào). Ở cuối có mục 8 liệt kê những chỗ code đã đi khác thiết kế ban đầu.
>
> **Ngày lập**: 21/09/2026 · **Trạng thái**: đã chạy và nghiệm thu trên hệ thống thật qua **2 vòng
> kiểm chứng** (vòng 1: luồng thuận CRUD; vòng 2: các hướng biên — xem mục 5.3 và 5.3b)

---

## 1. Tóm tắt trong 10 dòng

Tính năng cũ gợi ý chỗ đỗ bằng một câu lệnh duy nhất: đếm xem khách hay đỗ khu nào nhất rồi lấy
**chỗ đầu tiên** còn trống trong khu đó. Bản mới thay bằng **SAW (Simple Additive Weighting)** —
thuật toán ra quyết định đa tiêu chí: chấm điểm mọi chỗ trống trên 5 tiêu chí có trọng số, xếp
hạng, và giải thích được vì sao chọn.

Trong quá trình làm phát sinh **5 vấn đề**, trong đó vấn đề nghiêm trọng nhất (mục 3.1) chỉ lộ ra
khi chạy trên dữ liệu thật chứ không lộ ra ở test: thuật toán chạy đúng về mặt toán học nhưng
**kết quả y hệt code cũ** — mọi chỗ đều 1.00 điểm. Tất cả đã xử lý xong, có test hồi quy chặn lại.

---

## 2. Bản đồ code — file nào làm gì

| File | Vai trò | Dòng đáng chú ý |
|---|---|---|
| [`backend/src/utils/smartParkingAlgorithms.ts`](../backend/src/utils/smartParkingAlgorithms.ts) | Toàn bộ thuật toán, hàm thuần tuý, không chạm DB | `scoreSAW()`, `calcZonePreference()`, `calcSpotPreference()` |
| [`backend/src/utils/smartParkingAlgorithms.test.ts`](../backend/src/utils/smartParkingAlgorithms.test.ts) | 23 ca kiểm thử | chạy bằng `npm run test:saw` |
| [`backend/src/services/parking.service.ts`](../backend/src/services/parking.service.ts) | Hàm `smartLookup()` — lấy dữ liệu từ DB rồi gọi thuật toán | `getSawConfig()` ở cuối class |
| [`backend/src/expertSystem/rules/defaults.ts`](../backend/src/expertSystem/rules/defaults.ts) | Luật seed `PARKING_REC_WEIGHTS` | cuối mảng `DEFAULT_RULES` |
| [`backend/src/expertSystem/domainSpecs.ts`](../backend/src/expertSystem/domainSpecs.ts) | Khai báo domain + form nhập trọng số cho admin | `SAW_WEIGHT_KEYS`, `DOMAIN_FORM_SPEC.parking_recommendation` |
| [`backend/src/expertSystem/validation.ts`](../backend/src/expertSystem/validation.ts) | Chặn trọng số sai ngay lúc lưu | `DOMAIN_VALIDATORS.parking_recommendation` |
| [`frontend/src/pages/ParkingEntry.tsx`](../frontend/src/pages/ParkingEntry.tsx) | Panel "Vì sao chọn chỗ này?" | trong card `smartInsights` |
| [`frontend/src/types/index.ts`](../frontend/src/types/index.ts) | Kiểu `SawScoringDetails` | cạnh `SmartLookupInsights` |

Luồng chạy:

```
Nhân viên gõ biển số, rời ô input (onBlur)
   └─ GET /api/parking/smart-lookup/:plate
        └─ parking.service.ts → smartLookup()
             ├─ 4 query DB song song (Promise.all)
             ├─ getSawConfig()          ← đọc trọng số từ hệ chuyên gia
             ├─ calcZonePreference()    ← C1 phần khu   (Exponential Decay)
             ├─ calcSpotPreference()    ← C1 phần chỗ   (Exponential Decay)
             ├─ calcZoneStats()         ← C2 và C5
             ├─ calcTypeMatch()         ← C3
             ├─ calcHourlyPattern()     ← C4
             └─ scoreSAW()              ← chuẩn hoá, nhân trọng số, xếp hạng
        └─ trả về suggestedSpotId + scoringDetails
   └─ Frontend tự điền chỗ đỗ + hiện panel giải thích
```

---

## 3. Các vấn đề đã gặp và cách xử lý

### 3.1. **Vấn đề nghiêm trọng nhất** — thuật toán chạy đúng nhưng vô nghĩa: mọi chỗ đều 1.00 điểm

#### Triệu chứng

Sau khi code xong và test đơn vị pass hết, gọi API thật thì mọi xe đều cho kết quả như nhau:

```
51H423456 → gợi ý Khu A — A03 | top3: A03=1  A04=1  A06=1
51FB5566  → gợi ý Khu C — C02 | top3: C02=1  C03=1  C04=1
59G22334  → gợi ý Khu B — B03 | top3: B03=1  B04=1  B06=1
```

Ba chỗ đứng đầu **bằng điểm nhau tuyệt đối**, và đều là 1.00 — điểm tối đa.

#### Nguyên nhân thật

Hai sự thật cộng lại:

1. **Cả 5 tiêu chí ban đầu đều là thuộc tính của KHU, không phải của từng chỗ đỗ.**
   C1 (khu ưa thích), C2 (tỷ lệ trống của khu), C3 (loại xe của khu), C4 (giờ quen ở khu),
   C5 (độ đông của khu) — mọi chỗ trong cùng một khu có giá trị y hệt nhau.

2. **Bộ lọc tương thích loại xe gần như luôn chỉ chừa lại đúng MỘT khu.**
   Đo trên dữ liệu thật:

   | Biển số | Loại xe | Số ứng viên sau lọc | Khu |
   |---|---|---|---|
   | 51H423456 | Xe máy | 45 | chỉ Khu A (Khu A đang trống đúng 45 chỗ) |
   | 59G22334 | Ô tô điện | 27 | chỉ Khu B (Khu B trống đúng 27) |
   | 51FB5566 | Xe khách | 19 | chỉ Khu C (Khu C trống đúng 19) |

   Con số ứng viên **khớp chính xác** số chỗ trống của một khu → xác nhận toàn bộ ứng viên nằm
   trong một khu duy nhất.

Khi mọi ứng viên có 5 giá trị tiêu chí giống hệt nhau, phép chuẩn hoá của SAW cho ra kết quả:

```
Tiêu chí benefit:  r = x / max(x) = x / x = 1
Tiêu chí cost:     r = min(x) / x = x / x = 1
→ Score = Σ (w_j × 1) = Σ w_j = 1.00  cho MỌI ứng viên
```

Tức là **SAW thoái hoá thành một phép hoà điểm toàn phần**. Chỗ được chọn cuối cùng là chỗ đầu
mảng — mà mảng đang sắp theo `spotNumber` tăng dần. **Đúng bằng hành vi của code cũ.** Toàn bộ
công sức nâng cấp không đổi được một quyết định nào.

Đây là loại lỗi test đơn vị không bắt được: ví dụ minh hoạ trong tài liệu thiết kế có 3 chỗ ở 3
khu khác nhau (A-05, B-12, C-03), nên trong test mọi thứ đều đẹp. Chỉ dữ liệu thật mới lộ ra
rằng tình huống "3 khu khác nhau cùng hợp một loại xe" gần như không xảy ra.

#### Cách xử lý

Bổ sung **thành phần ở mức từng chỗ đỗ** cho tiêu chí C1: điểm ưa thích giờ là

```
C1(chỗ) = điểm Decay của KHU chứa chỗ đó  +  điểm Decay của ĐÚNG CHỖ đó
```

Điểm "đúng chỗ" là dữ kiện duy nhất ở mức từng chỗ mà dữ liệu hiện có cung cấp được
(`parkingRecord.parkingSpotId`), và nghiệp vụ cũng đúng: khách quen thường quay lại đúng chỗ cũ.

Code: hàm [`calcSpotPreference()`](../backend/src/utils/smartParkingAlgorithms.ts) và chỗ gộp
trong `smartLookup()`:

```typescript
zonePreference: (zonePreferences.get(zoneName) || 0) + (spotPreferences.get(spot.id) || 0),
```

Thứ tự ưu tiên sinh ra một cách tự nhiên:
đúng chỗ cũ > chỗ khác trong khu quen > chỗ ở khu lạ.

#### Kết quả sau khi sửa

```
51H423456 → gợi ý Khu A — A09 | top3: A09=1  A46=0.976  A25=0.947
51FB5566  → gợi ý Khu C — C14 | top3: C14=1  C03=0.916  C07=0.906
59G22334  → gợi ý Khu B — B29 | top3: B29=1  B19=0.974  B04=0.944
```

Điểm đã tách bạch, và A09 đúng là chỗ mà xe 51H4-23456 hay đỗ trong lịch sử.

#### Test chặn hồi quy

`npm run test:saw` → ca **"Hồi quy: khách quen cùng một khu — C1 gộp điểm chỗ phải phá được thế hoà"**.
Ca này tái hiện đúng tình huống lỗi (3 chỗ cùng Khu A, C2–C5 bằng nhau) và assert hai điều:
gợi ý phải ra đúng chỗ khách hay đỗ, **và** điểm của hạng 1 phải lớn hơn hạng 2 — nếu ai đó lỡ
đưa C1 về lại mức khu thì test này đỏ ngay.

---

### 3.2. Câu giải thích "Điểm 1.00/1.00" gây hiểu nhầm cho nhân viên

#### Vấn đề

Câu hiển thị ban đầu là `Điểm 1.00/1.00 — yếu tố chính: ...`. Cách viết "x/1.00" khiến người đọc
hiểu đây là **thang điểm tuyệt đối** và 1.00 nghĩa là chỗ đỗ hoàn hảo.

Thực tế SAW chuẩn hoá bằng cách **chia cho giá trị lớn nhất của từng cột**, nên điểm là **điểm
tương đối trong nhóm chỗ trống đang xét**. Chỗ nào tốt nhất trên mọi tiêu chí thì **luôn luôn**
đạt đúng 1.00, kể cả khi nó thực sự là một chỗ tồi (ví dụ khu đang đầy 95%, chỉ vì các chỗ còn
lại còn tệ hơn). Nói với khách "chỗ này được 1.00/1.00" là nói sai.

#### Cách xử lý

Hai thay đổi trong [`buildExplanation()`](../backend/src/utils/smartParkingAlgorithms.ts):

1. Bỏ hậu tố `/1.00`, chỉ còn `Điểm 1.00 — yếu tố chính: ...`.
2. Khi có nhiều chỗ **hoà điểm đầu bảng** (tình huống không tránh được, ví dụ xe hoàn toàn mới
   chưa có lịch sử nên C1 = 0 cho tất cả), câu giải thích nói thẳng ra thay vì vờ có căn cứ:

   ```
   Điểm 1.00 — 27 chỗ trống cùng mức điểm cao nhất, chọn chỗ đầu danh sách
   ```

#### Test

Hai ca trong `npm run test:saw`:
- *"câu giải thích nêu điểm và tiêu chí đóng góp nhiều nhất"* — assert chuỗi **không** chứa `/1.00`.
- *"nhiều chỗ hoà điểm đầu bảng → câu giải thích nói rõ là hoà, không vờ có căn cứ"*.

---

### 3.3. Luật cấu hình không lưu được vì hệ chuyên gia bắt buộc phải có điều kiện

#### Vấn đề

Tài liệu thiết kế viết luật `PARKING_REC_WEIGHTS` với `conditions: []` — hợp lý về mặt ý niệm vì
luật này chỉ dùng để **lưu tham số**, không chạy qua máy suy diễn.

Nhưng [`validateShape()`](../backend/src/expertSystem/validation.ts) chặn:

```typescript
if (!Array.isArray(data.conditions) || data.conditions.length === 0) {
  throw ruleError('Cần ít nhất 1 điều kiện');
}
```

Luật seed lúc khởi động thì lọt (vì `createMany` ghi thẳng vào DB, không qua validate), nhưng
**ngay lần đầu admin bấm Sửa rồi Lưu là báo lỗi** — đúng cái thao tác mà tính năng này sinh ra để
phục vụ.

#### Cách xử lý

Dùng một điều kiện giữ chỗ luôn đúng, đặt tên tự mô tả để người đọc luật hiểu ngay:

```typescript
conditions: JSON.stringify([{ fact: 'configOnly', operator: 'gte', value: 0 }]),
```

Chọn cách này thay vì nới lỏng `validateShape()` cho domain kiểu `config`, vì `validateShape()` là
hàm dùng chung cho **mọi** domain — nới ở đó là mở đường cho luật thiếu điều kiện lọt vào các
domain khác, nơi thiếu điều kiện đồng nghĩa luật cháy vô điều kiện.

Phần `facts` của form admin cũng ghi rõ dòng hướng dẫn: *"Luật này chỉ lưu tham số, không chạy qua
máy suy diễn. Giữ nguyên điều kiện mặc định configOnly >= 0."*

#### Kiểm chứng

Đã thao tác thật: Cảnh báo → Cấu hình nâng cao → dòng `PARKING_REC_WEIGHTS` → Sửa → Cập nhật →
hiện thông báo **"Đã cập nhật luật"**.

---

### 3.4. Trọng số lồng nhau làm hỏng form nhập của admin

#### Vấn đề

Thiết kế ban đầu để trọng số lồng trong một object:

```jsonc
{ "weights": { "zonePreference": 0.35, "zoneAvailability": 0.25, ... } }
```

Nhưng form nhập luật ở màn quản trị được **sinh tự động** từ `DOMAIN_FORM_SPEC`, và mỗi field chỉ
map tới một khoá phẳng trong `action.params` (xem `handleSave()` trong
[`ExpertRulesPanel.tsx`](../frontend/src/components/ExpertRulesPanel.tsx)). Với cấu trúc lồng,
admin sẽ phải **gõ JSON bằng tay** — mất đúng cái ưu điểm "cấu hình được, không cần lập trình
viên" vốn là một trong ba lý do chọn SAW thay vì TOPSIS.

#### Cách xử lý

Để params phẳng:

```jsonc
{
  "zonePreference": 0.35, "zoneAvailability": 0.25, "typeMatch": 0.2,
  "peakHourFit": 0.1, "occupancy": 0.1, "decayAlpha": 0.3
}
```

Khai báo 6 ô nhập kiểu `number` trong `DOMAIN_FORM_SPEC.parking_recommendation`, mỗi ô có nhãn
`C1 — ...` và dòng trợ giúp nêu giá trị mặc định.

Thứ tự đọc trọng số ra thành mảng `[w1..w5]` được cố định một chỗ duy nhất bằng hằng số
`SAW_WEIGHT_KEYS` trong `domainSpecs.ts`, để `parking.service.ts` và `validation.ts` không thể
hiểu lệch thứ tự nhau.

#### Kiểm chứng

Form admin render đúng 6 ô số với giá trị đọc từ DB:

```
C1 — Mức ưa thích chỗ đỗ        0.35
C2 — Tỷ lệ còn trống của khu    0.25
C3 — Độ phù hợp loại xe         0.2
C4 — Phù hợp khung giờ quen     0.1
C5 — Mức độ vắng của khu        0.1
Hệ số suy giảm α (0 < α < 1)    0.3
```

---

### 3.5. Tổng trọng số sai làm điểm vượt thang, nhưng không có gì chặn

#### Vấn đề

Điểm SAW nằm trong [0, 1] **chỉ khi** tổng 5 trọng số bằng 1.0. Admin gõ nhầm 0.9 thành 0.99 là
điểm lệch; gõ 0.35 thành 3.5 là điểm vượt xa 1 và câu giải thích in ra số vô nghĩa. Không có chỗ
nào chặn việc này.

#### Cách xử lý

Thêm validator cho domain trong [`validation.ts`](../backend/src/expertSystem/validation.ts):
mỗi trọng số phải là số trong [0, 1], **tổng phải bằng 1.0** (sai số ±0.001), và `decayAlpha` phải
nằm trong khoảng mở (0, 1). Chặn ngay lúc lưu, kèm thông báo nêu rõ tổng hiện tại.

Ở chiều đọc, [`getSawConfig()`](../backend/src/services/parking.service.ts) bọc `try/catch` và rơi
về bộ mặc định nếu luật hỏng/bị tắt/thiếu field — tính năng này chạy mỗi lần nhân viên gõ biển số,
không được phép chết vì một dòng cấu hình sai.

#### Kiểm chứng

Đã thử thật trên giao diện: sửa C1 từ 0.35 thành 0.9 (tổng thành 1.55) rồi bấm Cập nhật →
hệ thống chặn với thông báo:

> **Tổng 5 trọng số phải bằng 1.0 (hiện tại là 1.550)**

---

### 3.6. Hai lỗi nhỏ phát hiện khi viết code

| Lỗi | Ở đâu | Xử lý |
|---|---|---|
| Lệch giờ tính bằng `Math.abs(a - b)` nên 23h và 0h bị coi là cách nhau 23 tiếng, trong khi thực tế là hai khung liền kề | `calcHourlyPattern()` | Đổi sang khoảng cách vòng tròn `Math.min(diff, 24 - diff)`. Test: *"lệch giờ tính vòng tròn"* |
| Tiêu chí C3 tự dò chuỗi tên khu để đoán loại xe, tạo ra quy ước đặt tên thứ hai song song với `businessRules.ts` | `calcTypeMatch()` | Dùng lại `getSpotCategory()` / `getVehicleCategory()` sẵn có. Test: 2 ca TypeMatch |

---

## 4. Năm tiêu chí hiện tại

| # | Tiêu chí | Chiều | Trọng số | Nguồn dữ liệu |
|---|---|---|---|---|
| C1 | Mức ưa thích **chỗ đỗ** (khu + đúng chỗ) | Benefit | 0.35 | 30 lượt đỗ gần nhất, Exponential Decay α=0.3 |
| C2 | Tỷ lệ còn trống của khu | Benefit | 0.25 | Toàn bộ bảng `ParkingSpot` |
| C3 | Độ tương thích loại xe | Benefit | 0.20 | Tên/mô tả khu, qua `getSpotCategory()` |
| C4 | Phù hợp khung giờ quen | Benefit | 0.10 | Giờ vào của 30 lượt gần nhất (±1h, vòng tròn) |
| C5 | Mức độ đông đúc của khu | **Cost** | 0.10 | Toàn bộ bảng `ParkingSpot` |

> **Ghi chú trung thực về C2 và C5**: hiện `occupancy = 1 − availability`, nên hai tiêu chí này là
> **cùng một đại lượng** nhìn từ hai chiều. Về mặt mô hình, C2 và C5 đang đếm trùng: tổng ảnh
> hưởng của "khu còn bao nhiêu chỗ" thực chất là 0.25 + 0.10 = 0.35 chứ không phải 0.25. Điều này
> không gây sai kết quả (chỉ là phân bổ trọng số), nhưng nếu muốn mô hình sạch thì nên **bỏ C5 và
> dồn trọng số vào C2**, hoặc định nghĩa lại C5 thành một đại lượng khác thật sự (ví dụ tốc độ lấp
> đầy của khu trong 1 giờ qua). Chưa làm vì đó là thay đổi mô hình, cần thống nhất với tài liệu
> thiết kế trước.

---

## 5. Cách tự kiểm chứng

### 5.1. Chạy bộ test đơn vị

```bash
cd backend && npm run test:saw
```

Kỳ vọng: `Result: 23 passed, 0 failed, 23 total`.

Bộ test chia theo nhóm:

| Nhóm | Số ca | Kiểm cái gì |
|---|---|---|
| Decay | 4 | Trọng số suy giảm đúng công thức, bỏ qua bản ghi thiếu khu, α sai rơi về mặc định |
| SpotPreference | 2 | Chấm điểm ở mức từng chỗ đỗ |
| **Hồi quy** | **1** | **Chặn lỗi mục 3.1 quay lại** |
| ZoneStats | 2 | C2 + C5 cộng bằng 1, chỗ bảo trì tính vào tổng nhưng không phải chỗ trống |
| TypeMatch | 2 | Khu chuyên loại xe = 1.0, khu VIP = 0.5 |
| HourlyPattern | 3 | Đúng khung giờ, **vòng tròn 23h↔0h**, lệch hẳn giờ |
| SAW | 9 | Khớp ví dụ tài liệu, thang [0,1], xe mới, 1 chỗ, 0 chỗ, đổi trọng số, câu giải thích, hoà điểm, không sửa mảng gốc |

Ca đáng chú ý nhất — **"khớp đúng ví dụ minh hoạ mục 4.5 của tài liệu thiết kế"** — lấy nguyên bộ
số trong tài liệu và assert ra đúng 0.762 / 0.693 / 0.683. Nếu ai sửa công thức mà quên cập nhật
tài liệu (hoặc ngược lại), ca này đỏ.

### 5.2. Kiểm chứng qua API

```bash
TOKEN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r .token)

curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:5001/api/parking/smart-lookup/51H423456 | jq .insights.scoringDetails
```

Kỳ vọng: `topCandidates` có **điểm khác nhau** (không phải cả ba cùng 1). Nếu thấy cả ba cùng
bằng 1 → lỗi mục 3.1 đã quay lại.

### 5.3. Kiểm chứng trên giao diện

| # | Thao tác | Kỳ vọng |
|---|---|---|
| 1 | Xe vào → gõ biển số `59G22334` → rời ô (Tab) | Tự điền loại xe *Ô tô điện*, chỗ đỗ *Khu B — B29* |
| 2 | Mở panel **"Vì sao chọn chỗ này?"** | Bảng 3 chỗ, điểm giảm dần (1.000 / 0.974 / 0.944), dòng trọng số, 2 dòng tham chiếu học thuật |
| 3 | Bấm **Ghi nhận xe vào** | "Ghi nhận xe vào thành công!", chỗ trống giảm 1, xe hiện trong bảng đang đỗ |
| 4 | Cảnh báo → Cấu hình nâng cao → `PARKING_REC_WEIGHTS` → Sửa → đặt C1 = 0.9 → Cập nhật | Bị chặn: *"Tổng 5 trọng số phải bằng 1.0 (hiện tại là 1.550)"* |
| 5 | Đặt C1 = 0.1, C2 = 0.5 → Cập nhật | "Đã cập nhật luật". Gọi lại smart-lookup: `weights` đổi theo, khoảng cách điểm giữa các chỗ **co lại** (vì hạ trọng số tiêu chí đang phân biệt) |
| 6 | Trả C1 = 0.35, C2 = 0.25 | Trọng số về mặc định |
| 7 | Xe ra → chọn xe vừa vào → Xác nhận | "Xe ra thành công! Phí: 20,000đ" |

**Đã chạy đủ 7 bước trên hệ thống thật ngày 21/09/2026, tất cả đạt.**

### 5.3b. Vòng kiểm chứng thứ hai — các hướng khác

Vòng đầu đi theo luồng thuận (khách quen → vào → ra). Vòng hai cố tình đi các hướng khác để tìm chỗ
thuật toán có thể gãy:

| # | Kịch bản | Kỳ vọng | Kết quả thật |
|---|---|---|---|
| 1 | **Biển số hoàn toàn lạ** `88X99999` | Không gợi ý, không lỗi, nhân viên nhập tay | Đạt — không hiện card gợi ý, form trống bình thường |
| 2 | **Chỗ quen bị chiếm** — cho xe khác vào đúng A09 của xe `51H4-23456` | Phải né sang chỗ quen kế tiếp, không cố chấp A09 | Đạt — chuyển sang **A46**, ứng viên 45→44, xếp hạng dịch đúng một bậc: 1.000 / 0.969 / 0.960 |
| 3 | **Đổi α từ 0.3 → 0.9** (chỉ tin lượt gần nhất) | Phân bố điểm phải đổi | Đạt — A25 và A24 từ 0.969/0.960 chuyển thành hoà nhau ở 0.971, đúng vì α cao dập các lượt cũ gần về 0 |
| 4 | **Tắt hẳn luật** `PARKING_REC_WEIGHTS` | Không được chết, phải rơi về mặc định | Đạt — HTTP 200, trọng số về `[0.35, 0.25, 0.2, 0.1, 0.1]`, α về 0.3 |

Kịch bản 2 là bằng chứng mạnh nhất: thuật toán đọc **trạng thái bãi tại thời điểm tra cứu**, không
phải một bảng tra cứng. Sau khi cho xe test ra khỏi A09, gợi ý quay lại đúng A09 với điểm ban đầu
(1.000 / 0.976 / 0.947) — trạng thái khôi phục hoàn toàn.

Vòng này **không phát hiện lỗi mới**.

### 5.4. Bộ test cũ không được vỡ

```bash
cd backend && npm run test:fee          # 9 passed — tính phí
cd backend && npx tsc --noEmit          # không lỗi kiểu
cd frontend && npx tsc --noEmit         # không lỗi kiểu
```

---

## 6. Những chỗ dễ làm hỏng về sau

1. **Đừng đưa C1 về lại mức khu.** Đó chính là lỗi mục 3.1. Test hồi quy đang canh chỗ này.
2. **Thứ tự `SAW_WEIGHT_KEYS` phải khớp thứ tự cột trong `scoreSAW()`.** Đảo một khoá là toàn bộ
   trọng số gán nhầm tiêu chí mà không có lỗi nào bắn ra — điểm vẫn tính được, chỉ là sai.
3. **`IS_BENEFIT` phải khớp bảng tiêu chí.** C5 là cost; đánh dấu nhầm thành benefit sẽ khiến hệ
   thống ưu tiên đúng khu đông nhất.
4. **Query lấy chỗ đỗ phải lấy TOÀN BỘ, không lọc `status = 'available'`.** C2 và C5 cần tổng số
   chỗ của khu làm mẫu số. Thêm lại bộ lọc vào query là C2 luôn bằng 1 cho mọi khu.
5. **Nhớ reload knowledge base sau khi admin sửa luật** — hiện màn quản trị đã tự gọi, nhưng nếu
   thêm đường sửa luật mới thì phải gọi `reload()`, nếu không trọng số mới không có tác dụng cho
   tới lần khởi động lại sau.

---

## 7. Giới hạn còn lại — nói trước để không bị hỏi bất ngờ

| Giới hạn | Ảnh hưởng thực tế |
|---|---|
| C2 và C5 đo cùng một đại lượng (mục 4) | Trọng số phân bổ chưa sạch về mặt mô hình, không sai kết quả |
| Với **khách hoàn toàn mới**, C1 = 0 cho mọi ứng viên, mà C2–C5 đều ở mức khu → vẫn hoà điểm toàn phần | Chấp nhận được: không có dữ liệu thì không có căn cứ phân biệt. Câu giải thích nói rõ "N chỗ cùng mức điểm cao nhất" thay vì vờ có lý do |
| Phân loại khu vẫn dựa trên **dò từ khoá trong tên khu** (kế thừa từ `businessRules.ts`) | Đặt tên khu sai quy ước thì C3 đoán sai. Hướng sửa gốc: thêm cột phân loại vào bảng `ParkingZone` |
| C4 chỉ dùng lịch sử **của riêng xe đó** | Xe ít lịch sử thì C4 gần như vô nghĩa. Có thể mở rộng sang thống kê toàn bãi theo giờ |
| Chưa đo được hiệu quả | Nên bổ sung chỉ số **acceptance rate** — % lượt nhân viên giữ nguyên chỗ hệ thống gợi ý — làm bằng chứng định lượng cho báo cáo |

---

## 8. Những chỗ code đã đi khác tài liệu thiết kế ban đầu

> **Cập nhật 21/09/2026**: toàn bộ các lệch dưới đây **đã được đồng bộ ngược vào tài liệu**. Bảng
> này giữ lại như nhật ký thay đổi — để biết thiết kế ban đầu nói gì và vì sao phải đổi. Các file
> đã cập nhật: `DE_XUAT_THUAT_TOAN_GOI_Y_CHO_DO_THONG_MINH.md`,
> `BAO_CAO_CHUONG_TINH_NANG_THONG_MINH.md`, `CAU_TRUC_CODE_TINH_NANG_THONG_MINH.md`,
> `SMART_FEATURES_DEEP_DIVE.md`, `DAN_Y_SLIDE_BAO_VE_30_SLIDE.md`, `HUONG_DAN_DOC_CODE.md`.

| Thiết kế viết | Code thực tế | Lý do |
|---|---|---|
| C1 = mức ưa thích **khu vực** | C1 = ưa thích **khu + đúng chỗ** | Mục 3.1 — nếu không thì thuật toán vô nghĩa |
| `conditions: []` | `conditions: [{ configOnly, gte, 0 }]` | Mục 3.3 — validate bắt buộc ≥ 1 điều kiện |
| `params.weights` lồng object | params phẳng | Mục 3.4 — form admin chỉ dựng được field phẳng |
| Query `where: { status: 'available' }` | Lấy toàn bộ rồi lọc trong bộ nhớ | C2/C5 cần tổng số chỗ của khu; vẫn giữ đúng 4 query |
| `Math.abs(recordHour - currentHour) <= 1` | Khoảng cách vòng tròn | Mục 3.6 — 23h và 0h là hai khung liền kề |
| `calcTypeMatch` tự dò chuỗi tên khu | Dùng lại `getSpotCategory()` | Mục 3.6 — tránh hai quy ước đặt tên song song |
| `Điểm 0.76/1.00` | `Điểm 0.76` + báo hoà điểm | Mục 3.2 — điểm SAW là tương đối, không phải tuyệt đối |
| TOPSIS chạy song song để cross-validate | Đã bỏ hẳn | Chốt phương án chỉ dùng SAW |
