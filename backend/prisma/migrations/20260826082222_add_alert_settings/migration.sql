BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[AlertSettings] (
    [Id] INT NOT NULL CONSTRAINT [AlertSettings_Id_df] DEFAULT 1,
    [ZoneNearFullAvailable] INT NOT NULL CONSTRAINT [AlertSettings_ZoneNearFullAvailable_df] DEFAULT 2,
    [ZoneNearFullPercent] FLOAT(53) NOT NULL CONSTRAINT [AlertSettings_ZoneNearFullPercent_df] DEFAULT 10,
    [ZoneImbalanceMaxPercent] FLOAT(53) NOT NULL CONSTRAINT [AlertSettings_ZoneImbalanceMaxPercent_df] DEFAULT 90,
    [ZoneImbalanceMinPercent] FLOAT(53) NOT NULL CONSTRAINT [AlertSettings_ZoneImbalanceMinPercent_df] DEFAULT 30,
    [LongParkingHours] INT NOT NULL CONSTRAINT [AlertSettings_LongParkingHours_df] DEFAULT 24,
    [ParkingAnomalyMultiplier] FLOAT(53) NOT NULL CONSTRAINT [AlertSettings_ParkingAnomalyMultiplier_df] DEFAULT 3,
    [ParkingAnomalyMinMinutes] INT NOT NULL CONSTRAINT [AlertSettings_ParkingAnomalyMinMinutes_df] DEFAULT 60,
    [SuspiciousPaymentHighAmount] DECIMAL(12,2) NOT NULL CONSTRAINT [AlertSettings_SuspiciousPaymentHighAmount_df] DEFAULT 5000000,
    [SuspiciousPaymentParkingAmount] DECIMAL(12,2) NOT NULL CONSTRAINT [AlertSettings_SuspiciousPaymentParkingAmount_df] DEFAULT 300000,
    [RevenueDropPercent] FLOAT(53) NOT NULL CONSTRAINT [AlertSettings_RevenueDropPercent_df] DEFAULT 30,
    [RenewalFrequencyThreshold] INT NOT NULL CONSTRAINT [AlertSettings_RenewalFrequencyThreshold_df] DEFAULT 5,
    [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [AlertSettings_UpdatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedBy] INT,
    CONSTRAINT [AlertSettings_pkey] PRIMARY KEY CLUSTERED ([Id])
);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
