# =============================================================================
# setup-all.ps1 — Setup TOAN BO du an QLBDX tu dau tren may moi (1 lenh duy nhat)
#
# Goi setup-database.ps1 cho phan DB, roi cai them dependency frontend.
# Sau khi chay xong: bam .\start.bat la dung duoc ngay.
#
# Cach dung (mo PowerShell tai thu muc goc du an):
#   .\scripts\setup-all.ps1                 # day du (khuyen nghi cho may moi)
#   .\scripts\setup-all.ps1 -FromBackup     # nhanh nhat: restore .bak thay vi migrate+seed
#   .\scripts\setup-all.ps1 -SkipHistory    # bo qua seed lich su nhieu nam
# =============================================================================
[CmdletBinding()]
param(
    [switch]$FromBackup,
    [switch]$SkipHistory,
    [string]$SqlServer = 'localhost',
    [string]$SqlUser   = 'sa',
    [string]$SqlPass   = '123'
)

$ErrorActionPreference = 'Stop'
$root        = Split-Path $PSScriptRoot -Parent
$frontendDir = Join-Path $root 'frontend'

Write-Host @"
==========================================================
QLBDX - SETUP TOAN BO DU AN
==========================================================
"@ -ForegroundColor Cyan

# 1) Database + backend
$dbArgs = @{ SqlServer = $SqlServer; SqlUser = $SqlUser; SqlPass = $SqlPass }
if ($FromBackup)  { $dbArgs['FromBackup']  = $true }
if ($SkipHistory) { $dbArgs['SkipHistory'] = $true }
& (Join-Path $PSScriptRoot 'setup-database.ps1') @dbArgs
if ($LASTEXITCODE -ne 0) { throw 'setup-database.ps1 that bai' }

# 2) Frontend
Write-Host "`n=== Cai dependency frontend ===" -ForegroundColor Cyan
Push-Location $frontendDir
try {
    if (-not (Test-Path 'node_modules')) {
        npm install
        if ($LASTEXITCODE -ne 0) { throw 'npm install (frontend) that bai' }
    }
    Write-Host '  [OK] node_modules san sang' -ForegroundColor Green
} finally { Pop-Location }

Write-Host @"

==========================================================
SETUP HOAN TAT - san sang chay
==========================================================
  .\start.bat      # khoi dong he thong (tu mo trinh duyet)
  .\stop.bat       # dung he thong
==========================================================
"@ -ForegroundColor Green
