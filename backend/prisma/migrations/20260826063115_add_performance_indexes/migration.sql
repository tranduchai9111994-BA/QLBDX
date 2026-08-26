BEGIN TRY

BEGIN TRAN;

-- CreateIndex
CREATE NONCLUSTERED INDEX [CustomerPackages_CustomerId_idx] ON [dbo].[CustomerPackages]([CustomerId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CustomerPackages_VehicleId_idx] ON [dbo].[CustomerPackages]([VehicleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CustomerPackages_Status_idx] ON [dbo].[CustomerPackages]([Status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CustomerPackages_EndDate_idx] ON [dbo].[CustomerPackages]([EndDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CustomerPackages_StartDate_idx] ON [dbo].[CustomerPackages]([StartDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PackagePriceHistory_PackageId_EffectiveFrom_idx] ON [dbo].[PackagePriceHistory]([PackageId], [EffectiveFrom]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ParkingRecords_Status_EntryTime_idx] ON [dbo].[ParkingRecords]([Status], [EntryTime]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ParkingRecords_EntryTime_idx] ON [dbo].[ParkingRecords]([EntryTime]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ParkingRecords_ExitTime_idx] ON [dbo].[ParkingRecords]([ExitTime]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ParkingRecords_VehicleTypeId_idx] ON [dbo].[ParkingRecords]([VehicleTypeId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ParkingRecords_ParkingSpotId_idx] ON [dbo].[ParkingRecords]([ParkingSpotId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ParkingRecords_VehicleId_idx] ON [dbo].[ParkingRecords]([VehicleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ParkingSpots_Status_idx] ON [dbo].[ParkingSpots]([Status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Payments_Status_PaidAt_idx] ON [dbo].[Payments]([Status], [PaidAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Payments_PaidAt_idx] ON [dbo].[Payments]([PaidAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Payments_ParkingRecordId_idx] ON [dbo].[Payments]([ParkingRecordId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Payments_CustomerPackageId_idx] ON [dbo].[Payments]([CustomerPackageId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [UserActivityLogs_CreatedAt_idx] ON [dbo].[UserActivityLogs]([CreatedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [UserActivityLogs_UserId_idx] ON [dbo].[UserActivityLogs]([UserId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Vehicles_CustomerId_idx] ON [dbo].[Vehicles]([CustomerId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Vehicles_VehicleTypeId_idx] ON [dbo].[Vehicles]([VehicleTypeId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VehicleTypeRateHistory_VehicleTypeId_EffectiveFrom_idx] ON [dbo].[VehicleTypeRateHistory]([VehicleTypeId], [EffectiveFrom]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
