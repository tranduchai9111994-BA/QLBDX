BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[ExpertRules] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [Code] NVARCHAR(80) NOT NULL,
    [Domain] NVARCHAR(40) NOT NULL,
    [Name] NVARCHAR(200) NOT NULL,
    [Description] NVARCHAR(500),
    [Priority] INT NOT NULL CONSTRAINT [ExpertRules_Priority_df] DEFAULT 100,
    [Conditions] NVARCHAR(4000) NOT NULL,
    [Actions] NVARCHAR(4000) NOT NULL,
    [Enabled] BIT NOT NULL CONSTRAINT [ExpertRules_Enabled_df] DEFAULT 1,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [ExpertRules_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [ExpertRules_UpdatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedBy] INT,
    CONSTRAINT [ExpertRules_pkey] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [ExpertRules_Code_key] UNIQUE NONCLUSTERED ([Code])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ExpertRules_Domain_idx] ON [dbo].[ExpertRules]([Domain]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ExpertRules_Enabled_Domain_idx] ON [dbo].[ExpertRules]([Enabled], [Domain]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
