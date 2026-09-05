# Sửa lỗi tranh chấp đồng thời (race condition) khi giành chỗ đỗ

> Ngày: 05/09/2026
> Phạm vi: `backend/src/services/parking.service.ts` (`entry()`, `completeExit()`),
> migration `20260905000000_add_active_parking_unique_indexes`,
> `frontend/src/pages/ParkingEntry.tsx` + `ParkingExit.tsx`.
> **Có thay đổi cơ sở dữ liệu** — phải chạy `npx prisma migrate deploy`.

---

## 1. Bối cảnh — câu hỏi phản biện

> **Hỏi:** "Nếu hai nhân viên cùng chọn một chỗ đỗ đúng cùng lúc thì sao?"
>
> **Đáp (trước đợt sửa này):** Service có kiểm tra chỗ còn trống trước khi tạo bản ghi, xử lý tốt
> đa số tình huống. Nhưng nếu hai yêu cầu tới gần như đồng thời thì vẫn còn rủi ro *race condition*
> vì chưa khóa transaction ở mức database. Em xin ghi nhận đây là hướng cải tiến.

Câu trả lời đó **đúng về mặt chẩn đoán**. Tài liệu này ghi lại việc đo để xác nhận lỗi có thật, rồi
xử lý dứt điểm — để lần sau câu trả lời là "đã xử lý, kiểm chứng bằng test tự động" chứ không còn là
"hướng cải tiến".

---

## 2. Phân tích lỗi

### 2.1. Cơ chế gây lỗi — mẫu "kiểm tra rồi mới ghi"

Code cũ trong `entry()`:

```ts
// 1) ĐỌC trạng thái chỗ đỗ
const selectedSpot = await prisma.parkingSpot.findUnique({ where: { id: data.parkingSpotId } });

// 2) KIỂM TRA
if (!selectedSpot || selectedSpot.status !== 'available') {
  throw { status: 400, message: 'Chỗ đỗ đã được sử dụng hoặc không khả dụng' };
}

// 3) GHI
const record = await prisma.parkingRecord.create({ /* ... */ });
await prisma.parkingSpot.update({ where: { id: data.parkingSpotId }, data: { status: 'occupied' } });
```

Giữa bước (1) và bước (3) có `await` — tức là có một khoảng thời gian thực sự trôi qua, trong đó
tiến trình Node xử lý các request khác. Hai request lọt vào khoảng đó:

```
Nhân viên A                              Nhân viên B
──────────────────────────────────       ──────────────────────────────────
đọc chỗ #12  -> 'available'
                                         đọc chỗ #12  -> 'available'   ← vẫn thấy trống
tạo ParkingRecord (xe A)
                                         tạo ParkingRecord (xe B)      ← chỗ #12 có 2 xe
cập nhật chỗ #12 -> 'occupied'
                                         cập nhật chỗ #12 -> 'occupied'
```

Cùng cơ chế đó gây thêm hai lỗi nữa:

- **Trùng biển số:** `entry()` đọc danh sách xe đang đỗ rồi mới chèn — hai request cùng biển số đều
  lọt, một xe có hai lượt gửi mở, lúc cho ra không biết đóng lượt nào.
- **Xe ra hai lần:** `completeExit()` đọc bản ghi `status='parked'` rồi mới cập nhật — bấm hai lần
  (mạng chậm) hoặc hai quầy cùng chốt thì tính phí hai lần và sinh **hai phiếu thu**.

### 2.2. Ba lệnh rời rạc, không có transaction

Ngoài tranh chấp, `completeExit()` còn chạy ba lệnh ghi tách rời: đóng bản ghi → trả chỗ đỗ → sinh
phiếu thu. Đứt kết nối hoặc lỗi ở giữa để lại trạng thái nửa vời — lượt gửi đã đóng nhưng chỗ vẫn
kẹt "có xe" (đúng là nguồn của cảnh báo "chỗ đỗ ma" đã ghi nhận trong `KIEN_TRUC_CHI_TIET.md`).

### 2.3. Đo thực tế — lỗi có thật, không phải lý thuyết

Viết `backend/src/services/parking.concurrency.test.ts` chạy trên DB thật, bắn 5 lệnh song song.
Kết quả **trên code cũ**:

```
=== Parking concurrency tests ===
FAIL  5 nhân viên cùng chọn MỘT chỗ đỗ -> chỉ 1 xe được vào
      Chỗ đỗ 111 đang có 5 xe cùng lúc (phải là 1). Lỗi trả về: []
      5 !== 1

FAIL  5 lần ghi nhận CÙNG MỘT biển số vào các chỗ khác nhau -> chỉ 1 lần được nhận
      Biển số 29Y203182 đang có 4 lượt đỗ mở cùng lúc (phải là 1).
      4 !== 1

FAIL  5 lần bấm "Xe ra" cùng lúc trên MỘT lượt gửi -> chỉ thu tiền 1 lần

Result: 0 passed, 3 failed, 3 total
```

**5/5 lệnh vào bãi đều thành công** — không lệnh nào bị chặn. Chỗ đỗ #111 có 5 xe.

---

## 3. Hướng xử lý

### 3.1. Nguyên tắc

Không thể vá bằng cách "kiểm tra kỹ hơn": mọi kiểm tra tách rời khỏi lệnh ghi đều để lại khoảng
trễ. Phải **gộp điều kiện vào chính lệnh ghi**, và đặt thêm một ràng buộc bất biến ở tầng dữ liệu để
không phụ thuộc vào việc code ứng dụng có đúng hay không.

| Lớp | Cơ chế | Bảo vệ khỏi |
|---|---|---|
| 1. Kiểm tra sớm | Đọc trước, báo lỗi dễ hiểu | Tình huống thường gặp (chỗ đã có xe từ trước, chỗ đang bảo trì). **Không** đảm bảo đúng đắn. |
| 2. Compare-and-set trong transaction | `updateMany` kèm điều kiện trạng thái | Hai request gần như đồng thời |
| 3. Chỉ mục UNIQUE có điều kiện ở DB | `UX_ParkingRecords_ActiveSpot`, `UX_ParkingRecords_ActivePlate` | Lỗi lập trình về sau, script ghi thẳng vào DB, seed sai |

### 3.2. Lớp 2 — chốt chỗ nguyên tử

```ts
private async claimSpotOrThrow(tx: PrismaTransaction, parkingSpotId: number) {
  const claimed = await tx.parkingSpot.updateMany({
    where: { id: parkingSpotId, status: 'available' },   // ← điều kiện nằm TRONG lệnh ghi
    data: { status: 'occupied' },
  });

  if (claimed.count === 0) {
    throw { status: 409, message: SPOT_TAKEN_MESSAGE, code: 'SPOT_TAKEN' };
  }
}
```

Prisma dịch ra đúng một câu `UPDATE ParkingSpots SET Status='occupied' WHERE Id=? AND Status='available'`.
SQL Server khoá dòng đó rồi **mới xét lại điều kiện**, nên trong hai lệnh đồng thời:

- lệnh đến trước: đổi được trạng thái → `count = 1` → đi tiếp;
- lệnh đến sau: chờ khoá, xét lại thấy `Status` đã là `'occupied'` → `count = 0` → ném 409.

Chốt chỗ và tạo bản ghi nằm chung `prisma.$transaction`, nên nếu bước tạo bản ghi hỏng thì việc
chiếm chỗ cũng bị rollback — không có chỗ nào bị chiếm "treo".

Luồng xe ra dùng đúng kỹ thuật đó, với điều kiện `status: 'parked'`:

```ts
const closed = await tx.parkingRecord.updateMany({
  where: { id: params.recordId, status: 'parked' },
  data: { exitTime, duration: calc.durationMinutes, fee: new Decimal(fee), status: 'completed', ... },
});
if (closed.count === 0) {
  throw { status: 409, message: 'Lượt gửi này vừa được kết thúc bởi thao tác khác', code: 'RECORD_ALREADY_CLOSED' };
}
```

Ba việc (đóng bản ghi, trả chỗ, sinh phiếu thu) nay nằm chung một transaction — hết trạng thái nửa vời.

### 3.3. Lớp 3 — chỉ mục UNIQUE có điều kiện

```sql
CREATE UNIQUE NONCLUSTERED INDEX [UX_ParkingRecords_ActiveSpot]
    ON [dbo].[ParkingRecords]([ParkingSpotId])
    WHERE [Status] = 'parked' AND [ParkingSpotId] IS NOT NULL;

CREATE UNIQUE NONCLUSTERED INDEX [UX_ParkingRecords_ActivePlate]
    ON [dbo].[ParkingRecords]([LicensePlate])
    WHERE [Status] = 'parked';
```

Phải là chỉ mục **có lọc** (mệnh đề `WHERE`), không phải `UNIQUE` thường: bảng `ParkingRecords` giữ
cả lịch sử, một chỗ đỗ có hàng nghìn lượt `completed` là bình thường — chỉ các lượt **đang gửi** mới
phải duy nhất.

Khi chỉ mục chặn, Prisma ném `P2002` kèm tên chỉ mục; hàm `rethrowActiveParkingConflict()` dịch sang
thông báo tiếng Việt để nhân viên không thấy câu lỗi kỹ thuật.

### 3.4. Mã lỗi: tách 409 khỏi 400

| Mã | Ý nghĩa | Frontend làm gì |
|---|---|---|
| 400 | Nhân viên nhập sai (chỗ không tồn tại, chỗ đang bảo trì, hết chỗ phù hợp) | Hiện lỗi đỏ, giữ nguyên form |
| 409 | Xung đột đồng thời — vừa bị người khác giành mất | Hiện cảnh báo vàng, **tự tải lại** sơ đồ chỗ trống / danh sách xe trong bãi |

Màn **Xe vào** còn xoá luôn ô "Chỗ đỗ" để nhân viên chọn lại ngay, không phải F5. Màn **Xe ra** đóng
modal và tải lại danh sách — vì tiền đã được thu đúng một lần ở lệnh thắng, báo lỗi đỏ sẽ khiến
người dùng tưởng hệ thống hỏng và thu thêm lần nữa.

Nhánh kiểm tra sớm trong `entry()` cũng được tách làm ba (trước đây gộp một câu chung "Chỗ đỗ đã được
sử dụng hoặc không khả dụng"), để trạng thái `occupied` trả 409 chứ không phải 400.

---

## 4. Kiểm thử thực tế

### 4.1. Typecheck

```
backend : npx tsc --noEmit   → không lỗi
frontend: npx tsc --noEmit   → không lỗi
```

### 4.2. Test tự động trên DB thật — sau khi sửa

```
$ cd backend && npm run test:concurrency

=== Parking concurrency tests ===
PASS  5 nhân viên cùng chọn MỘT chỗ đỗ -> chỉ 1 xe được vào
PASS  5 lần ghi nhận CÙNG MỘT biển số vào các chỗ khác nhau -> chỉ 1 lần được nhận
PASS  5 lần bấm "Xe ra" cùng lúc trên MỘT lượt gửi -> chỉ thu tiền 1 lần

Result: 3 passed, 0 failed, 3 total
```

Test tự tạo khu `ZZ_TEST_CONCURRENCY` với chỗ đỗ riêng và tự dọn sạch (Payment → ParkingRecord →
ParkingSpot → ParkingZone) ở bước cuối, kể cả khi có case fail.

### 4.3. Kiểm chứng chỉ mục ở tầng DB — bỏ qua toàn bộ tầng ứng dụng

Ghi thẳng bằng Prisma, không qua Service:

```
INDEXES   : UX_ParkingRecords_ActiveSpot  (unique, filter: [Status]='parked' AND [ParkingSpotId] IS NOT NULL)
            UX_ParkingRecords_ActivePlate (unique, filter: [Status]='parked')
SAME_SPOT  blocked -> P2002 {"modelName":"ParkingRecord","target":"UX_ParkingRecords_ActiveSpot"}
SAME_PLATE blocked -> P2002 {"modelName":"ParkingRecord","target":"UX_ParkingRecords_ActivePlate"}
REUSE_AFTER_EXIT: OK   ← chỗ đỗ nhận được lượt mới sau khi lượt cũ đã 'completed'
```

Dòng cuối quan trọng: chỉ mục **không** cản trở nghiệp vụ bình thường — một chỗ đỗ vẫn nhận vô hạn
lượt gửi nối tiếp nhau, chỉ cấm hai lượt **đang mở** cùng lúc.

### 4.4. End-to-end qua HTTP thật

5 tiến trình `curl` độc lập bắn song song vào backend đang chạy:

```
POST /api/parking/entry  (cùng parkingSpotId = 3)
  req1 -> HTTP 409 | {"message":"Chỗ đỗ vừa được nhân viên khác sử dụng, vui lòng chọn chỗ khác"}
  req2 -> HTTP 201 | {"message":"Ghi nhận xe vào thành công","id":44067}
  req3 -> HTTP 409 | ...
  req4 -> HTTP 409 | ...
  req5 -> HTTP 409 | ...
  => 1 thành công / 5 (đúng)

POST /api/parking/exit   (cùng parkingRecordId = 44067)
  req1 -> HTTP 200 | {"message":"Ghi nhận xe ra thành công", "fee":5000, ...}
  req2 -> HTTP 409 | {"message":"Lượt gửi này vừa được kết thúc bởi thao tác khác"}
  req3 -> HTTP 409 | ...
  => 1 thành công / 3 (đúng)
```

Đối chiếu dữ liệu trong DB sau đó:

```
RECORDS : 1 bản ghi, status='completed', fee=5000
PAYMENTS: 1 phiếu thu, amount=5000        ← không nhân đôi
SPOTS   : chỗ #3 status='available'       ← đã trả chỗ
```

Toàn bộ dữ liệu test đã được xoá sau khi đo; kiểm tra lại toàn bảng: không có chỗ đỗ nào có 2 lượt
`parked`, không có biển số nào có 2 lượt `parked`, không có chỗ nào lệch trạng thái với bản ghi.

---

## 5. Rủi ro và lưu ý

1. **Prisma báo lệch schema (drift).** Prisma chưa mô tả được chỉ mục có điều kiện trong
   `schema.prisma`, nên hai chỉ mục này viết SQL tay trong migration. Chạy `prisma migrate dev` về
   sau sẽ báo lệch và **đề nghị xoá chúng — không được chấp nhận**. Ghi chú cảnh báo đã đặt ngay tại
   model `ParkingRecord` trong `schema.prisma` và trong chính file migration.

2. **Dữ liệu cũ phải sạch trước khi chạy migration.** Nếu DB đang có sẵn hai lượt `parked` trên cùng
   một chỗ (hậu quả của lỗi cũ) thì lệnh tạo chỉ mục sẽ thất bại. Câu kiểm tra trước khi migrate:

   ```sql
   SELECT ParkingSpotId, COUNT(*) FROM ParkingRecords
   WHERE Status='parked' AND ParkingSpotId IS NOT NULL
   GROUP BY ParkingSpotId HAVING COUNT(*) > 1;

   SELECT LicensePlate, COUNT(*) FROM ParkingRecords
   WHERE Status='parked' GROUP BY LicensePlate HAVING COUNT(*) > 1;
   ```

   Cả hai phải trả về 0 dòng. (Trên DB hiện tại đã kiểm tra: sạch.)

3. **Chỉ mục biển số so khớp nguyên văn.** Nó dựa trên giá trị đã lưu, mà `entry()` luôn lưu biển số
   đã chuẩn hoá (`normalizeLicensePlate`). Với bản ghi cũ lưu chưa chuẩn hoá thì chỉ mục không bắt
   được — lớp kiểm tra ở ứng dụng (so sánh sau khi chuẩn hoá) vẫn là lớp chính cho trường hợp này.

4. **Không đổi hành vi nghiệp vụ nào khác.** Công thức tính phí, chốt giá lúc xe vào, checkout ngoại
   lệ, gói dịch vụ đều giữ nguyên. `npm test` (9 case tính phí) vẫn 9/9 PASS.

---

## 6. Tài liệu liên quan

- [CHANGELOG.md](CHANGELOG.md) — mục 05/09/2026
- [KIEN_TRUC_CHI_TIET.md](KIEN_TRUC_CHI_TIET.md) — mục 12.4 "Kiểm soát tranh chấp đồng thời"
- [KIEN_TRUC_TONG_QUAN.md](KIEN_TRUC_TONG_QUAN.md) — câu hỏi số 5
- [HUONG_DAN_DOC_CODE.md](HUONG_DAN_DOC_CODE.md) — mục 2.4
- [Function.md](Function.md) — FUNC-PARK-002, FUNC-PARK-003 (bảng mã lỗi)
- [DAN_Y_SLIDE_BAO_VE_30_SLIDE.md](DAN_Y_SLIDE_BAO_VE_30_SLIDE.md) — slide dự phòng P7
