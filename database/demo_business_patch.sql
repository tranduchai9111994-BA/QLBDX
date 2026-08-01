/*
  Demo business patch cho QLBDX
  Chạy sau database/setup.sql nếu muốn đồng bộ dữ liệu demo theo rule bảo vệ:
  - Chuẩn hóa biển số
  - Đồng bộ trạng thái gói active/pending/expired
  - Đồng bộ trạng thái chỗ đỗ occupied/available/maintenance
  - Bổ sung tối thiểu 1 gói pending nếu chưa có
*/

USE [ParkingManagement];
GO

BEGIN TRY
  BEGIN TRAN;

  -- 1) Chuẩn hóa biển số cho xe và lịch sử đỗ xe
  UPDATE [Vehicles]
  SET [LicensePlate] = UPPER(REPLACE(REPLACE(REPLACE([LicensePlate], '-', ''), '.', ''), ' ', ''))
  WHERE [LicensePlate] LIKE '%-%' OR [LicensePlate] LIKE '%.%' OR [LicensePlate] LIKE '% %';

  UPDATE [ParkingRecords]
  SET [LicensePlate] = UPPER(REPLACE(REPLACE(REPLACE([LicensePlate], '-', ''), '.', ''), ' ', ''))
  WHERE [LicensePlate] LIKE '%-%' OR [LicensePlate] LIKE '%.%' OR [LicensePlate] LIKE '% %';

  -- 2) Đồng bộ trạng thái gói dịch vụ theo ngày hiện tại
  UPDATE [CustomerPackages]
  SET [Status] = 'expired'
  WHERE [Status] <> 'cancelled' AND [EndDate] < CAST(GETDATE() AS DATE);

  UPDATE [CustomerPackages]
  SET [Status] = 'pending'
  WHERE [Status] <> 'cancelled'
    AND [StartDate] > CAST(GETDATE() AS DATE);

  UPDATE [CustomerPackages]
  SET [Status] = 'active'
  WHERE [Status] <> 'cancelled'
    AND [StartDate] <= CAST(GETDATE() AS DATE)
    AND [EndDate] >= CAST(GETDATE() AS DATE);

  -- 3) Reset trạng thái chỗ đỗ theo xe đang trong bãi
  UPDATE [ParkingSpots]
  SET [Status] = 'available'
  WHERE [Status] <> 'maintenance';

  UPDATE ps
  SET ps.[Status] = 'occupied'
  FROM [ParkingSpots] ps
  INNER JOIN [ParkingRecords] pr ON pr.[ParkingSpotId] = ps.[Id]
  WHERE pr.[Status] = 'parked';

  UPDATE [ParkingSpots]
  SET [Status] = 'maintenance'
  WHERE [Id] IN (5, 55, 105)
    AND [Id] NOT IN (
      SELECT DISTINCT [ParkingSpotId]
      FROM [ParkingRecords]
      WHERE [Status] = 'parked' AND [ParkingSpotId] IS NOT NULL
    );

  -- 4) Nếu chưa có gói pending thì tạo 1 gói demo
  IF NOT EXISTS (SELECT 1 FROM [CustomerPackages] WHERE [Status] = 'pending')
  BEGIN
    DECLARE @CustomerId INT;
    DECLARE @VehicleId INT;
    DECLARE @PackageId INT;
    DECLARE @DurationDays INT;
    DECLARE @Price DECIMAL(10,2);
    DECLARE @StartDate DATE = DATEADD(DAY, 3, CAST(GETDATE() AS DATE));
    DECLARE @EndDate DATE;

    SELECT TOP 1
      @CustomerId = c.[Id],
      @VehicleId = v.[Id]
    FROM [Customers] c
    INNER JOIN [Vehicles] v ON v.[CustomerId] = c.[Id]
    WHERE c.[IsActive] = 1
      AND NOT EXISTS (
        SELECT 1
        FROM [CustomerPackages] cp
        WHERE cp.[VehicleId] = v.[Id]
          AND cp.[Status] <> 'cancelled'
          AND cp.[EndDate] >= @StartDate
      )
    ORDER BY c.[Id];

    SELECT TOP 1
      @PackageId = p.[Id],
      @DurationDays = p.[DurationDays],
      @Price = p.[Price]
    FROM [ParkingPackages] p
    INNER JOIN [Vehicles] v ON v.[VehicleTypeId] = p.[VehicleTypeId]
    WHERE v.[Id] = @VehicleId AND p.[IsActive] = 1
    ORDER BY p.[DurationDays];

    IF @CustomerId IS NOT NULL AND @VehicleId IS NOT NULL AND @PackageId IS NOT NULL
    BEGIN
      SET @EndDate = DATEADD(DAY, @DurationDays, @StartDate);

      INSERT INTO [CustomerPackages] ([CustomerId], [PackageId], [VehicleId], [StartDate], [EndDate], [Status], [CreatedAt])
      VALUES (@CustomerId, @PackageId, @VehicleId, @StartDate, @EndDate, 'pending', GETDATE());
    END
  END

  COMMIT TRAN;
  PRINT N'Demo business patch hoàn tất.';
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0
    ROLLBACK TRAN;

  THROW;
END CATCH;
GO
