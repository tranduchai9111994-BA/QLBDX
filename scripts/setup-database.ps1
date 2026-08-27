# =============================================================================
# setup-database.ps1 — Dung DB QLBDX tu dau cho thanh vien moi (Windows/PowerShell)
#
# Vi sao co script nay: database/legacy/setup.sql la ban dump CU (13/07), thieu toan bo
# bang them sau do (AlertSettings, AlertRuleTiers, PermissionGroups, GroupPermissions,
# cot ValidFrom/ValidTo cua goi...). Chay file do se ra schema SAI. Nguon su that duy nhat
# bay gio la Prisma migrations trong backend/prisma/migrations/.
#
# Cach dung:
#   .\scripts\setup-database.ps1                  # migrate + seed day du (khuyen nghi)
#   .\scripts\setup-database.ps1 -FromBackup      # restore nhanh tu file .bak co san
#   .\scripts\setup-database.ps1 -SkipHistory     # bo qua seed lich su nhieu nam (nhanh hon ~2-3p)
# =============================================================================
[CmdletBinding()]
param(
    # Restore tu database/ParkingManagement.bak thay vi migrate+seed (nhanh nhat, co san ~39k ban ghi)
    [switch]$FromBackup,
    # Bo qua buoc seed du lieu lich su nhieu nam (buoc lau nhat)
    [switch]$SkipHistory,
    [string]$SqlServer = 'localhost',
    [string]$SqlUser   = 'sa',
    [string]$SqlPass   = '123',
    [string]$DbName    = 'ParkingManagement'
)

$ErrorActionPreference = 'Stop'
$root       = Split-Path $PSScriptRoot -Parent
$backendDir = Join-Path $root 'backend'
$bakPath    = Join-Path $root 'database\ParkingManagement.bak'

function Write-Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn2($msg) { Write-Host "  [!] $msg" -ForegroundColor Yellow }

function Invoke-Sql($query) {
    $out = sqlcmd -S $SqlServer -U $SqlUser -P $SqlPass -b -Q $query 2>&1
    if ($LASTEXITCODE -ne 0) { throw "sqlcmd loi: $out" }
    return $out
}

# ---------------------------------------------------------------------------
Write-Step 'Kiem tra moi truong'

if (-not (Get-Command sqlcmd -ErrorAction SilentlyContinue)) {
    throw "Khong tim thay 'sqlcmd'. Cai SQL Server Command Line Utilities roi chay lai."
}
Write-Ok 'sqlcmd san sang'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Khong tim thay 'node'. Cai Node.js 18+ roi chay lai."
}
Write-Ok "node $(node --version)"

try {
    Invoke-Sql 'SELECT 1' | Out-Null
    Write-Ok "Ket noi duoc SQL Server ($SqlServer, user $SqlUser)"
} catch {
    throw "Khong ket noi duoc SQL Server tai '$SqlServer' voi user '$SqlUser'. Kiem tra service SQL Server da chay chua (dung scripts\start-sqlserver.bat), hoac truyen -SqlServer/-SqlUser/-SqlPass khac."
}

# ---------------------------------------------------------------------------
Write-Step 'Kiem tra file .env cua backend'

$envPath = Join-Path $backendDir '.env'
if (-not (Test-Path $envPath)) {
    Copy-Item (Join-Path $backendDir '.env.example') $envPath
    Write-Ok 'Da tao backend\.env tu .env.example'
    Write-Warn2 'Nho doi JWT_SECRET truoc khi dung that!'
} else {
    Write-Ok 'backend\.env da ton tai (giu nguyen)'
}

# ---------------------------------------------------------------------------
if ($FromBackup) {
    Write-Step "Restore tu backup: $bakPath"
    if (-not (Test-Path $bakPath)) { throw "Khong tim thay file backup: $bakPath" }

    Invoke-Sql "IF DB_ID('$DbName') IS NOT NULL ALTER DATABASE [$DbName] SET SINGLE_USER WITH ROLLBACK IMMEDIATE" | Out-Null
    Invoke-Sql "RESTORE DATABASE [$DbName] FROM DISK = N'$bakPath' WITH REPLACE" | Out-Null
    Invoke-Sql "IF DB_ID('$DbName') IS NOT NULL ALTER DATABASE [$DbName] SET MULTI_USER" | Out-Null
    Write-Ok 'Restore xong (da co san toan bo du lieu demo)'

    Write-Step 'Cai dependency + tao Prisma client'
    Push-Location $backendDir
    try {
        if (-not (Test-Path 'node_modules')) { npm install | Out-Null; Write-Ok 'npm install xong' }
        npx prisma generate | Out-Null
        Write-Ok 'prisma generate xong'
    } finally { Pop-Location }

    Write-Host "`nHOAN TAT. Chay .\start.bat de mo ung dung." -ForegroundColor Green
    exit 0
}

# ---------------------------------------------------------------------------
Write-Step 'Tao database rong (neu chua co)'
Invoke-Sql "IF DB_ID('$DbName') IS NULL CREATE DATABASE [$DbName]" | Out-Null
Write-Ok "Database [$DbName] san sang"

Write-Step 'Cai dependency backend'
Push-Location $backendDir
try {
    if (-not (Test-Path 'node_modules')) {
        npm install
        if ($LASTEXITCODE -ne 0) { throw 'npm install that bai' }
    }
    Write-Ok 'node_modules san sang'

    # ---------------------------------------------------------------------
    Write-Step 'Ap dung Prisma migrations (nguon su that cua schema)'
    npx prisma migrate deploy
    if ($LASTEXITCODE -ne 0) { throw 'prisma migrate deploy that bai' }
    Write-Ok 'Schema day du, dung phien ban moi nhat'

    npx prisma generate | Out-Null
    Write-Ok 'Prisma client da tao'

    # ---------------------------------------------------------------------
    Write-Step 'Seed du lieu demo'

    npm run prisma:seed
    if ($LASTEXITCODE -ne 0) { throw 'prisma:seed that bai' }
    Write-Ok 'Tai khoan + danh muc + du lieu co ban'

    npm run prisma:seed-permission-groups
    Write-Ok 'Nhom quyen mac dinh (bat buoc - khong co thi staff trang quyen)'

    npm run prisma:seed-vehicle-expansion
    Write-Ok 'Xe/khach hang mau cho 5 loai phuong tien mo rong'

    npm run prisma:seed-exceptions
    Write-Ok 'Du lieu mau checkout ngoai le (cho trang Bao cao)'

    npm run prisma:seed-fresh-packages
    Write-Ok 'Goi dich vu quanh ngay hien tai (active/sap het han/vua het han)'

    if ($SkipHistory) {
        Write-Warn2 'Bo qua seed lich su nhieu nam (-SkipHistory) - Dashboard/Bao cao se it du lieu'
    } else {
        Write-Host '  ... dang seed lich su 2024 -> nay, mat khoang 2-3 phut' -ForegroundColor DarkGray
        npm run prisma:seed-history
        Write-Ok 'Du lieu lich su nhieu nam'
    }
} finally { Pop-Location }

# ---------------------------------------------------------------------------
Write-Step 'Kiem tra ket qua'
$counts = Invoke-Sql @"
SET NOCOUNT ON;
USE [$DbName];
SELECT 'Users=' + CAST(COUNT(*) AS varchar) FROM Users;
SELECT 'PermissionGroups=' + CAST(COUNT(*) AS varchar) FROM PermissionGroups;
SELECT 'VehicleTypes=' + CAST(COUNT(*) AS varchar) FROM VehicleTypes;
SELECT 'ParkingRecords=' + CAST(COUNT(*) AS varchar) FROM ParkingRecords;
"@
$counts | Where-Object { $_ -match '=' } | ForEach-Object { Write-Ok $_.Trim() }

Write-Host @"

==========================================================
HOAN TAT SETUP DATABASE
==========================================================
Tai khoan dang nhap:
  admin     / admin123   (quan tri - toan quyen)
  giamdoc   / admin123   (quan tri)
  nhanvien1 / staff123   (nhan vien - nhom "Nhan vien tieu chuan")
  nhanvien2 / staff123   (nhan vien)
  nhanvien3 / staff123   (DA BI KHOA - de demo tinh nang khoa tai khoan)

Buoc tiep theo:
  .\start.bat           # khoi dong ca backend + frontend (tu mo trinh duyet)

Backend chay o cong 5001, frontend 3000 (xem backend\.env).
Chi tiet them: docs\ va database\README.md
==========================================================
"@ -ForegroundColor Green
