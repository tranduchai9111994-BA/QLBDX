BEGIN TRY

BEGIN TRAN;

-- DropDefaultConstraints
ALTER TABLE [dbo].[AlertSettings] DROP CONSTRAINT [AlertSettings_LongParkingHours_df];
ALTER TABLE [dbo].[AlertSettings] DROP CONSTRAINT [AlertSettings_LongParkingSeverity_df];
ALTER TABLE [dbo].[AlertSettings] DROP CONSTRAINT [AlertSettings_ParkingAnomalyMultiplier_df];
ALTER TABLE [dbo].[AlertSettings] DROP CONSTRAINT [AlertSettings_ParkingAnomalySeverity_df];
ALTER TABLE [dbo].[AlertSettings] DROP CONSTRAINT [AlertSettings_RenewalFrequencyThreshold_df];
ALTER TABLE [dbo].[AlertSettings] DROP CONSTRAINT [AlertSettings_RenewalOpportunitySeverity_df];
ALTER TABLE [dbo].[AlertSettings] DROP CONSTRAINT [AlertSettings_RevenueDropPercent_df];
ALTER TABLE [dbo].[AlertSettings] DROP CONSTRAINT [AlertSettings_RevenueDropSeverity_df];
ALTER TABLE [dbo].[AlertSettings] DROP CONSTRAINT [AlertSettings_SuspiciousPaymentHighAmount_df];
ALTER TABLE [dbo].[AlertSettings] DROP CONSTRAINT [AlertSettings_SuspiciousPaymentSeverity_df];
ALTER TABLE [dbo].[AlertSettings] DROP CONSTRAINT [AlertSettings_ZoneImbalanceMaxPercent_df];
ALTER TABLE [dbo].[AlertSettings] DROP CONSTRAINT [AlertSettings_ZoneImbalanceSeverity_df];
ALTER TABLE [dbo].[AlertSettings] DROP CONSTRAINT [AlertSettings_ZoneNearFullPercent_df];
ALTER TABLE [dbo].[AlertSettings] DROP CONSTRAINT [AlertSettings_ZoneNearFullSeverity_df];

-- AlterTable
ALTER TABLE [dbo].[AlertSettings] DROP COLUMN [LongParkingHours],
[LongParkingSeverity],
[ParkingAnomalyMultiplier],
[ParkingAnomalySeverity],
[RenewalFrequencyThreshold],
[RenewalOpportunitySeverity],
[RevenueDropPercent],
[RevenueDropSeverity],
[SuspiciousPaymentHighAmount],
[SuspiciousPaymentSeverity],
[ZoneImbalanceMaxPercent],
[ZoneImbalanceSeverity],
[ZoneNearFullPercent],
[ZoneNearFullSeverity];

-- CreateTable
CREATE TABLE [dbo].[AlertRuleTiers] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [RuleType] NVARCHAR(50) NOT NULL,
    [Threshold] FLOAT(53) NOT NULL,
    [Severity] NVARCHAR(20) NOT NULL,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [AlertRuleTiers_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [AlertRuleTiers_UpdatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedBy] INT,
    CONSTRAINT [AlertRuleTiers_pkey] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AlertRuleTiers_RuleType_idx] ON [dbo].[AlertRuleTiers]([RuleType]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

