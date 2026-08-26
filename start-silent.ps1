# start-silent.ps1 — Khoi dong toan bo QLBDX (SQL Server + Backend + Frontend) hoan toan an,
# khong hien cua so CMD nao. Log duoc ghi vao thu muc logs/ de tra loi khi can.
#
# Tham so:
#   -Fast   : bo qua buoc kiem tra/cai dependency (npm install, prisma generate) de khoi dong nhanh hon.

param(
    [switch]$Fast
)

$ErrorActionPreference = 'SilentlyContinue'
$root = $PSScriptRoot
$backendDir = Join-Path $root 'backend'
$frontendDir = Join-Path $root 'frontend'
$logDir = Join-Path $root 'logs'

if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }

function Write-Log($message) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $message"
    Add-Content -Path (Join-Path $logDir 'launcher.log') -Value $line
}

Write-Log "=== Khoi dong QLBDX (Fast=$Fast) ==="

# 1) Dam bao SQL Server (MSSQLSERVER) dang chay — co the hien UAC neu dang tat
$svc = Get-Service MSSQLSERVER -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -ne 'Running') {
    Write-Log "SQL Server dang tat, dang khoi dong (can quyen Administrator)..."
    Start-Process powershell -Verb RunAs -WindowStyle Hidden `
        -ArgumentList '-NoProfile -Command "Start-Service MSSQLSERVER"' -Wait
    Write-Log "Da gui lenh khoi dong SQL Server."
}

# 2) Cai dependency neu thieu (bo qua neu chay -Fast)
if (-not $Fast) {
    if (-not (Test-Path (Join-Path $backendDir 'node_modules'))) {
        Write-Log "Cai dat backend dependencies..."
        Start-Process npm -ArgumentList 'install' -WorkingDirectory $backendDir -WindowStyle Hidden -Wait `
            -RedirectStandardOutput (Join-Path $logDir 'backend-install.log') `
            -RedirectStandardError (Join-Path $logDir 'backend-install.err.log')
    }
    if (-not (Test-Path (Join-Path $backendDir 'node_modules\.prisma'))) {
        Write-Log "Tao Prisma client..."
        Start-Process npx -ArgumentList 'prisma generate' -WorkingDirectory $backendDir -WindowStyle Hidden -Wait `
            -RedirectStandardOutput (Join-Path $logDir 'prisma-generate.log') `
            -RedirectStandardError (Join-Path $logDir 'prisma-generate.err.log')
    }
    if (-not (Test-Path (Join-Path $frontendDir 'node_modules'))) {
        Write-Log "Cai dat frontend dependencies..."
        Start-Process npm -ArgumentList 'install' -WorkingDirectory $frontendDir -WindowStyle Hidden -Wait `
            -RedirectStandardOutput (Join-Path $logDir 'frontend-install.log') `
            -RedirectStandardError (Join-Path $logDir 'frontend-install.err.log')
    }
}

# 3) Tat process cu dang chiem cong 3000/5000 (khoi dong lai sach)
foreach ($port in 3000, 5000) {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
        Write-Log "Dang tat process cu tren cong $port (PID $($c.OwningProcess))"
        Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}

# 4) Khoi dong Backend — hoan toan an, log ra file
Write-Log "Khoi dong Backend (an)..."
Start-Process cmd.exe -ArgumentList '/c npm run dev' -WorkingDirectory $backendDir -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir 'backend.log') `
    -RedirectStandardError (Join-Path $logDir 'backend.err.log')

# 5) Khoi dong Frontend — hoan toan an, khong tu mo trinh duyet rieng (BROWSER=none)
Write-Log "Khoi dong Frontend (an)..."
Start-Process cmd.exe -ArgumentList '/c set BROWSER=none&& npm start' -WorkingDirectory $frontendDir -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir 'frontend.log') `
    -RedirectStandardError (Join-Path $logDir 'frontend.err.log')

# 6) Doi Frontend san sang (toi da 3 phut) roi tu mo trinh duyet
Write-Log "Dang doi Frontend san sang..."
$ok = $false
for ($i = 0; $i -lt 90; $i++) {
    Start-Sleep -Seconds 2
    try {
        # Dung 127.0.0.1 thay vi localhost: Invoke-WebRequest co the treo vai giay khi
        # thu resolve "localhost" qua IPv6 truoc khi fallback IPv4.
        $r = Invoke-WebRequest http://127.0.0.1:3000 -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        if ($r.StatusCode -lt 500) { $ok = $true; break }
    } catch {}
}

if ($ok) {
    Write-Log "San sang! Mo trinh duyet."
    Start-Process 'http://localhost:3000'
} else {
    Write-Log "LOI: Qua thoi gian cho Frontend khong len."
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
        "Khong the khoi dong QLBDX trong thoi gian cho (3 phut).`nKiem tra file log tai:`n$logDir",
        "QLBDX - Loi khoi dong",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
}
