BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[AlertSettings] ADD [LongParkingSeverity] NVARCHAR(20) NOT NULL CONSTRAINT [AlertSettings_LongParkingSeverity_df] DEFAULT 'warning',
[ParkingAnomalySeverity] NVARCHAR(20) NOT NULL CONSTRAINT [AlertSettings_ParkingAnomalySeverity_df] DEFAULT 'warning',
[RenewalOpportunitySeverity] NVARCHAR(20) NOT NULL CONSTRAINT [AlertSettings_RenewalOpportunitySeverity_df] DEFAULT 'info',
[RevenueDropSeverity] NVARCHAR(20) NOT NULL CONSTRAINT [AlertSettings_RevenueDropSeverity_df] DEFAULT 'warning',
[SuspiciousPaymentSeverity] NVARCHAR(20) NOT NULL CONSTRAINT [AlertSettings_SuspiciousPaymentSeverity_df] DEFAULT 'warning',
[ZoneFullSeverity] NVARCHAR(20) NOT NULL CONSTRAINT [AlertSettings_ZoneFullSeverity_df] DEFAULT 'danger',
[ZoneImbalanceSeverity] NVARCHAR(20) NOT NULL CONSTRAINT [AlertSettings_ZoneImbalanceSeverity_df] DEFAULT 'warning',
[ZoneNearFullSeverity] NVARCHAR(20) NOT NULL CONSTRAINT [AlertSettings_ZoneNearFullSeverity_df] DEFAULT 'warning';

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
