/*
  Thêm cột SuggestedSpotId vào ParkingRecords — ghi lại chỗ đỗ mà THUẬT TOÁN SAW đã gợi ý tại
  thời điểm nhân viên ghi nhận xe vào.

  VÌ SAO CẦN: để đo được "acceptance rate" — tỷ lệ % lượt mà nhân viên GIỮ NGUYÊN chỗ hệ thống
  gợi ý, thay vì tự chọn chỗ khác. Đây là chỉ số định lượng đánh giá chất lượng thuật toán gợi ý:
  nhân viên là người biết rõ thực tế bãi nhất, nên tỷ lệ họ chấp nhận gợi ý phản ánh trực tiếp
  gợi ý đó có sát thực tế hay không.

  Không đo được từ dữ liệu cũ: trước đây gợi ý được tính lúc tra cứu rồi bỏ đi, không lưu lại
  ở đâu. Toàn bộ bản ghi trước migration này có SuggestedSpotId = NULL và bị loại khỏi phép
  tính (xem analytics.service.ts → tính acceptance rate chỉ trên các bản ghi CÓ gợi ý).

  Cột để NULL được và KHÔNG đặt khoá ngoại tới ParkingSpots. Lý do: đây là ảnh chụp lại quyết
  định của thuật toán tại một thời điểm, mang tính lịch sử. Nếu đặt khoá ngoại thì xoá một chỗ
  đỗ sẽ kéo theo ràng buộc lên toàn bộ lịch sử gợi ý — không đáng, vì số liệu này chỉ dùng để
  thống kê chứ không dùng để tra cứu ngược lại chỗ đỗ.

  NULL còn mang thêm một nghĩa hợp lệ ở dữ liệu MỚI: xe vãng lai chưa có lịch sử nên hệ thống
  không đưa ra gợi ý nào, hoặc nhân viên nhập tay không qua bước tra cứu biển số.
*/

BEGIN TRY

BEGIN TRAN;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[ParkingRecords]')
      AND name = N'SuggestedSpotId'
)
BEGIN
    ALTER TABLE [dbo].[ParkingRecords] ADD [SuggestedSpotId] INT NULL;
END;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;

THROW

END CATCH
