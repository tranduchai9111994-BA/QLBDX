import prisma from '../config/prisma';

/**
 * Đồng bộ giá "hiện hành" cho các đối tượng có lịch sử đổi giá đã đến hạn hiệu lực
 * (effectiveFrom <= thời điểm hiện tại) nhưng cột giá sống (VehicleTypes.HourlyRate/...,
 * ParkingPackages.Price) chưa được cập nhật — trường hợp admin đặt lịch đổi giá cho
 * tương lai và ngày đó vừa đến.
 *
 * Nguyên tắc: "giá hiện hành" của 1 đối tượng = dòng lịch sử có effectiveFrom LỚN NHẤT
 * mà effectiveFrom <= now. Không cần cột effectiveTo — tính bằng ROW_NUMBER() mỗi lần gọi.
 *
 * Gọi hàm này trước mọi điểm đọc "giá hiện tại" quan trọng: danh sách loại xe/gói dịch vụ,
 * và đặc biệt là lúc xe vào bãi (thời điểm chốt giá cho lượt gửi đó).
 */

/**
 * Cập nhật giá hiện hành cho các LOẠI XE có lịch đổi giá đã tới ngày hiệu lực.
 *
 * Viết bằng SQL thuần thay vì Prisma vì đây là thao tác "cập nhật hàng loạt theo kết quả xếp
 * hạng": ROW_NUMBER() chọn ra dòng lịch sử mới nhất của từng loại xe rồi UPDATE thẳng trong một
 * câu lệnh. Làm bằng Prisma sẽ phải đọc hết lịch sử về ứng dụng, tự xếp hạng rồi ghi lại từng dòng.
 *
 * Điều kiện `WHERE vt.HourlyRate <> r.HourlyRate OR ...` ở cuối để chỉ ghi khi giá thực sự khác —
 * gọi lại nhiều lần cũng không tạo ra lượt ghi thừa xuống DB.
 */
export async function syncDueVehicleTypeRates(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    ;WITH Ranked AS (
      SELECT VehicleTypeId, HourlyRate, DailyRate, MonthlyRate,
             ROW_NUMBER() OVER (PARTITION BY VehicleTypeId ORDER BY EffectiveFrom DESC) AS rn
      FROM VehicleTypeRateHistory
      WHERE EffectiveFrom <= GETDATE()
    )
    UPDATE vt
    SET vt.HourlyRate = r.HourlyRate, vt.DailyRate = r.DailyRate, vt.MonthlyRate = r.MonthlyRate
    FROM VehicleTypes vt
    JOIN Ranked r ON r.VehicleTypeId = vt.Id AND r.rn = 1
    WHERE vt.HourlyRate <> r.HourlyRate OR vt.DailyRate <> r.DailyRate OR vt.MonthlyRate <> r.MonthlyRate
  `);
}

/** Tương tự nhưng cho giá GÓI DỊCH VỤ (bảng ParkingPackages). */
export async function syncDuePackagePrices(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    ;WITH Ranked AS (
      SELECT PackageId, Price,
             ROW_NUMBER() OVER (PARTITION BY PackageId ORDER BY EffectiveFrom DESC) AS rn
      FROM PackagePriceHistory
      WHERE EffectiveFrom <= GETDATE()
    )
    UPDATE pp
    SET pp.Price = r.Price
    FROM ParkingPackages pp
    JOIN Ranked r ON r.PackageId = pp.Id AND r.rn = 1
    WHERE pp.Price <> r.Price
  `);
}

/**
 * Đồng bộ cả hai loại giá. Được gọi một lần lúc server khởi động (server.ts) để bù lại những
 * lịch đổi giá đã đến hạn trong khoảng thời gian hệ thống tắt.
 */
export async function syncDuePrices(): Promise<void> {
  await Promise.all([syncDueVehicleTypeRates(), syncDuePackagePrices()]);
}
