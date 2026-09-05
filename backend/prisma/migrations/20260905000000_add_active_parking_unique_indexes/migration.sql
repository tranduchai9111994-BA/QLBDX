/*
  Chốt chặn ở TẦNG CƠ SỞ DỮ LIỆU cho tranh chấp đồng thời (race condition) khi hai nhân viên
  cùng thao tác một lúc.

  Kiểm tra trong tầng Service (đọc rồi mới ghi) không đủ: giữa lúc đọc "chỗ còn trống" và lúc ghi
  bản ghi có khoảng trễ, hai yêu cầu tới gần như đồng thời đều đọc thấy "còn trống" và đều ghi
  được. Hai chỉ mục UNIQUE có điều kiện dưới đây là ràng buộc cuối cùng — dù ứng dụng có sai sót
  hoặc có ai ghi thẳng vào DB thì SQL Server vẫn từ chối:

    1. UX_ParkingRecords_ActiveSpot  — mỗi chỗ đỗ chỉ có TỐI ĐA 1 lượt đang gửi (Status='parked').
    2. UX_ParkingRecords_ActivePlate — mỗi biển số chỉ có TỐI ĐA 1 lượt đang gửi.

  Dùng chỉ mục LỌC (filtered index, mệnh đề WHERE) chứ không phải UNIQUE thường: bảng còn giữ
  lịch sử, một chỗ đỗ có hàng nghìn lượt đã kết thúc (Status='completed') là bình thường — chỉ
  các lượt ĐANG gửi mới phải là duy nhất.

  Lưu ý: Prisma chưa mô tả được chỉ mục lọc trong schema.prisma nên phần này viết SQL tay.
  Nếu sau này chạy `prisma migrate dev`, Prisma sẽ báo lệch (drift) và đề nghị xoá 2 chỉ mục này
  — KHÔNG chấp nhận đề nghị đó; xem ghi chú tại schema.prisma (model ParkingRecord).
*/

BEGIN TRY

BEGIN TRAN;

-- CreateIndex
CREATE UNIQUE NONCLUSTERED INDEX [UX_ParkingRecords_ActiveSpot]
    ON [dbo].[ParkingRecords]([ParkingSpotId])
    WHERE [Status] = 'parked' AND [ParkingSpotId] IS NOT NULL;

-- CreateIndex
CREATE UNIQUE NONCLUSTERED INDEX [UX_ParkingRecords_ActivePlate]
    ON [dbo].[ParkingRecords]([LicensePlate])
    WHERE [Status] = 'parked';

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
