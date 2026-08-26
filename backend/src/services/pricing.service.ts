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

export async function syncDuePrices(): Promise<void> {
  await Promise.all([syncDueVehicleTypeRates(), syncDuePackagePrices()]);
}
