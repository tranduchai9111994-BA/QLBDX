BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[ParkingRecords] ADD [DailyRateApplied] DECIMAL(10,2),
[HourlyRateApplied] DECIMAL(10,2);

-- CreateTable
CREATE TABLE [dbo].[VehicleTypeRateHistory] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [VehicleTypeId] INT NOT NULL,
    [HourlyRate] DECIMAL(10,2) NOT NULL,
    [DailyRate] DECIMAL(10,2) NOT NULL,
    [MonthlyRate] DECIMAL(10,2) NOT NULL,
    [EffectiveFrom] DATETIME2 NOT NULL,
    [ChangedBy] INT,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [VehicleTypeRateHistory_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [VehicleTypeRateHistory_pkey] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[PackagePriceHistory] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [PackageId] INT NOT NULL,
    [Price] DECIMAL(10,2) NOT NULL,
    [EffectiveFrom] DATETIME2 NOT NULL,
    [ChangedBy] INT,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [PackagePriceHistory_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PackagePriceHistory_pkey] PRIMARY KEY CLUSTERED ([Id])
);

-- AddForeignKey
ALTER TABLE [dbo].[VehicleTypeRateHistory] ADD CONSTRAINT [VehicleTypeRateHistory_VehicleTypeId_fkey] FOREIGN KEY ([VehicleTypeId]) REFERENCES [dbo].[VehicleTypes]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VehicleTypeRateHistory] ADD CONSTRAINT [VehicleTypeRateHistory_ChangedBy_fkey] FOREIGN KEY ([ChangedBy]) REFERENCES [dbo].[Users]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PackagePriceHistory] ADD CONSTRAINT [PackagePriceHistory_PackageId_fkey] FOREIGN KEY ([PackageId]) REFERENCES [dbo].[ParkingPackages]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PackagePriceHistory] ADD CONSTRAINT [PackagePriceHistory_ChangedBy_fkey] FOREIGN KEY ([ChangedBy]) REFERENCES [dbo].[Users]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
