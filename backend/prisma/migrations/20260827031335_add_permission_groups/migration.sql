BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[Users] ADD [PermissionGroupId] INT;

-- CreateTable
CREATE TABLE [dbo].[PermissionGroups] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [Name] NVARCHAR(100) NOT NULL,
    [Description] NVARCHAR(255),
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [PermissionGroups_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [PermissionGroups_UpdatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PermissionGroups_pkey] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [PermissionGroups_Name_key] UNIQUE NONCLUSTERED ([Name])
);

-- CreateTable
CREATE TABLE [dbo].[GroupPermissions] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [GroupId] INT NOT NULL,
    [ScreenKey] NVARCHAR(50) NOT NULL,
    [CanView] BIT NOT NULL CONSTRAINT [GroupPermissions_CanView_df] DEFAULT 0,
    [CanCreate] BIT NOT NULL CONSTRAINT [GroupPermissions_CanCreate_df] DEFAULT 0,
    [CanUpdate] BIT NOT NULL CONSTRAINT [GroupPermissions_CanUpdate_df] DEFAULT 0,
    [CanDelete] BIT NOT NULL CONSTRAINT [GroupPermissions_CanDelete_df] DEFAULT 0,
    CONSTRAINT [GroupPermissions_pkey] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [GroupPermissions_GroupId_ScreenKey_key] UNIQUE NONCLUSTERED ([GroupId],[ScreenKey])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Users_PermissionGroupId_idx] ON [dbo].[Users]([PermissionGroupId]);

-- AddForeignKey
ALTER TABLE [dbo].[Users] ADD CONSTRAINT [Users_PermissionGroupId_fkey] FOREIGN KEY ([PermissionGroupId]) REFERENCES [dbo].[PermissionGroups]([Id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[GroupPermissions] ADD CONSTRAINT [GroupPermissions_GroupId_fkey] FOREIGN KEY ([GroupId]) REFERENCES [dbo].[PermissionGroups]([Id]) ON DELETE CASCADE ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
