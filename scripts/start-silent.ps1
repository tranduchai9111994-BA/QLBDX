# start-silent.ps1 — Khoi dong toan bo QLBDX (SQL Server + Backend + Frontend) hoan toan an,
# khong hien cua so CMD nao. Log duoc ghi vao thu muc logs/ de tra loi khi can.
#
# Tham so:
#   -Fast     : bo qua buoc kiem tra/cai dependency (npm install, prisma generate).
#   -NoSplash : khong hien cua so "Dang khoi dong" (dung khi chay tu script khac / do thoi gian).

param(
    [switch]$Fast,
    [switch]$NoSplash
)

$ErrorActionPreference = 'SilentlyContinue'
# Script nam trong scripts/ nen root cua project la thu muc cha.
$root = Split-Path $PSScriptRoot -Parent
$backendDir = Join-Path $root 'backend'
$frontendDir = Join-Path $root 'frontend'
$logDir = Join-Path $root 'logs'

if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }

function Write-Log($message) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $message"
    Add-Content -Path (Join-Path $logDir 'launcher.log') -Value $line
}

# ── Cua so bao "dang khoi dong" ─────────────────────────────────────────────
# Ly do can: truoc day bam icon xong khong thay gi trong ~20s, nguoi dung tuong
# hong nen bam lai — moi lan bam lai lai kill tien trinh dang khoi dong do va
# lam lai tu dau (log 01/09 cho thay 3 lan bam = 61s thay vi 23s).
$splash = $null
$splashLabel = $null
function Show-Splash($text) {
    if ($NoSplash) { return }
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $script:splash = New-Object System.Windows.Forms.Form
    $splash.Text = 'QLBDX'
    $splash.FormBorderStyle = 'FixedSingle'
    $splash.StartPosition = 'CenterScreen'
    $splash.Size = New-Object System.Drawing.Size(420, 150)
    $splash.MaximizeBox = $false
    $splash.MinimizeBox = $false
    $splash.TopMost = $true
    $splash.BackColor = [System.Drawing.Color]::White
    $icon = Join-Path $PSScriptRoot 'app-icon.ico'
    if (Test-Path $icon) { $splash.Icon = New-Object System.Drawing.Icon($icon) }

    $script:splashLabel = New-Object System.Windows.Forms.Label
    $splashLabel.Text = $text
    $splashLabel.AutoSize = $false
    $splashLabel.Size = New-Object System.Drawing.Size(380, 44)
    $splashLabel.Location = New-Object System.Drawing.Point(20, 18)
    $splashLabel.Font = New-Object System.Drawing.Font('Segoe UI', 10)
    $splash.Controls.Add($splashLabel)

    $bar = New-Object System.Windows.Forms.ProgressBar
    $bar.Style = 'Marquee'
    $bar.MarqueeAnimationSpeed = 30
    $bar.Size = New-Object System.Drawing.Size(380, 18)
    $bar.Location = New-Object System.Drawing.Point(20, 70)
    $splash.Controls.Add($bar)

    $splash.Show()
    $splash.Refresh()
    [System.Windows.Forms.Application]::DoEvents()
}
function Set-SplashText($text) {
    if ($splashLabel) {
        $splashLabel.Text = $text
        [System.Windows.Forms.Application]::DoEvents()
    }
}
function Close-Splash {
    if ($splash) { $splash.Close(); $splash.Dispose(); $script:splash = $null }
}

# Kiem tra frontend da san sang chua. Luu y: webpack-dev-server MO CONG 3000
# tu rat som (~4s) nhung giu request lai cho toi khi compile xong, nen phai thu
# bang HTTP chu khong the chi kiem tra cong co mo hay khong.
function Test-FrontendReady([int]$timeoutMs = 1500) {
    try {
        $req = [System.Net.HttpWebRequest]::Create('http://127.0.0.1:3000')
        $req.Timeout = $timeoutMs
        $req.ReadWriteTimeout = $timeoutMs
        $req.Method = 'GET'
        $resp = $req.GetResponse()
        $code = [int]$resp.StatusCode
        $resp.Close()
        return ($code -lt 500)
    } catch { return $false }
}

function Open-App {
    Start-Process 'http://localhost:3000'
}

# ── 0) Chong bam icon nhieu lan ─────────────────────────────────────────────
# Mutex toan may: neu da co 1 lan khoi dong dang chay, lan bam thu 2 KHONG kill
# va khoi dong lai, ma chi doi cho toi khi san sang roi mo trinh duyet.
$mutex = New-Object System.Threading.Mutex($false, 'Global\QLBDX_Launcher')
$isOwner = $mutex.WaitOne(0)

if (-not $isOwner) {
    Write-Log "Da co mot lan khoi dong dang chay - chi doi va mo trinh duyet (khong khoi dong lai)."
    Show-Splash "QLBDX dang khoi dong (tu lan bam truoc)...`nVui long doi, dung bam them."
    for ($i = 0; $i -lt 400; $i++) {
        if (Test-FrontendReady) { Close-Splash; Open-App; exit 0 }
        Start-Sleep -Milliseconds 300
        [System.Windows.Forms.Application]::DoEvents()
    }
    Close-Splash
    exit 0
}

try {

Write-Log "=== Khoi dong QLBDX (Fast=$Fast) ==="

# 1) Fast-path: app da chay san (bam icon lan 2, hoac chi dong tab trinh duyet)
#    -> mo thang trinh duyet, khong khoi dong lai.
if (Test-FrontendReady 2000) {
    Write-Log "Frontend da chay san - mo trinh duyet ngay, khong khoi dong lai."
    Open-App
    exit 0
}

Show-Splash "Dang khoi dong QLBDX...`nLan dau sau khi sua code co the mat 30-40 giay."

# 2) Dam bao SQL Server (MSSQLSERVER) dang chay — co the hien UAC neu dang tat
$svc = Get-Service MSSQLSERVER -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -ne 'Running') {
    Set-SplashText "Dang khoi dong SQL Server..."
    Write-Log "SQL Server dang tat, dang khoi dong (can quyen Administrator)..."
    Start-Process powershell -Verb RunAs -WindowStyle Hidden `
        -ArgumentList '-NoProfile -Command "Start-Service MSSQLSERVER"' -Wait
    Write-Log "Da gui lenh khoi dong SQL Server."
}

# 3) Cai dependency neu thieu (bo qua neu chay -Fast)
if (-not $Fast) {
    if (-not (Test-Path (Join-Path $backendDir 'node_modules'))) {
        Set-SplashText "Lan dau chay: dang cai dependency backend (vai phut)..."
        Write-Log "Cai dat backend dependencies..."
        Start-Process npm -ArgumentList 'install' -WorkingDirectory $backendDir -WindowStyle Hidden -Wait `
            -RedirectStandardOutput (Join-Path $logDir 'backend-install.log') `
            -RedirectStandardError (Join-Path $logDir 'backend-install.err.log')
    }
    if (-not (Test-Path (Join-Path $backendDir 'node_modules\.prisma'))) {
        Set-SplashText "Dang tao Prisma client..."
        Write-Log "Tao Prisma client..."
        Start-Process npx -ArgumentList 'prisma generate' -WorkingDirectory $backendDir -WindowStyle Hidden -Wait `
            -RedirectStandardOutput (Join-Path $logDir 'prisma-generate.log') `
            -RedirectStandardError (Join-Path $logDir 'prisma-generate.err.log')
    }
    if (-not (Test-Path (Join-Path $frontendDir 'node_modules'))) {
        Set-SplashText "Lan dau chay: dang cai dependency frontend (vai phut)..."
        Write-Log "Cai dat frontend dependencies..."
        Start-Process npm -ArgumentList 'install' -WorkingDirectory $frontendDir -WindowStyle Hidden -Wait `
            -RedirectStandardOutput (Join-Path $logDir 'frontend-install.log') `
            -RedirectStandardError (Join-Path $logDir 'frontend-install.err.log')
    }
}

# 4) Tat process cu dang chiem cong 3000 (frontend) / 5001 (backend).
#    Dung 1 lan `netstat -ano` thay vi 2 lan Get-NetTCPConnection: cmdlet do phai
#    nap module NetTCPIP, ton ~1.5s moi lan goi dau tien.
Set-SplashText "Dang don tien trinh cu..."
$netstat = netstat -ano -p TCP | Select-String 'LISTENING'
foreach ($port in 3000, 5001) {
    foreach ($row in $netstat) {
        if ($row -match ":$port\s+\S+\s+LISTENING\s+(\d+)") {
            $procId = [int]$matches[1]
            Write-Log "Dang tat process cu tren cong $port (PID $procId)"
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        }
    }
}

# 5) Khoi dong Backend — hoan toan an, log ra file
Set-SplashText "Dang khoi dong Backend..."
Write-Log "Khoi dong Backend (an)..."
Start-Process cmd.exe -ArgumentList '/c npm run dev' -WorkingDirectory $backendDir -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir 'backend.log') `
    -RedirectStandardError (Join-Path $logDir 'backend.err.log')

# 6) Khoi dong Frontend — hoan toan an (BROWSER=none da dat trong frontend/.env)
Write-Log "Khoi dong Frontend (an)..."
Start-Process cmd.exe -ArgumentList '/c npm start' -WorkingDirectory $frontendDir -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir 'frontend.log') `
    -RedirectStandardError (Join-Path $logDir 'frontend.err.log')

# 7) Doi Frontend san sang (toi da 3 phut) roi tu mo trinh duyet
Set-SplashText "Dang bien dich giao dien... (buoc lau nhat, 7-40 giay)"
Write-Log "Dang doi Frontend san sang..."
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$ok = $false
while ($sw.Elapsed.TotalSeconds -lt 180) {
    if (Test-FrontendReady) { $ok = $true; break }
    Start-Sleep -Milliseconds 300
    if ($splash) { [System.Windows.Forms.Application]::DoEvents() }
}
$sw.Stop()

if ($ok) {
    Write-Log ("San sang sau {0:N1}s! Mo trinh duyet." -f $sw.Elapsed.TotalSeconds)
    Close-Splash
    Open-App
} else {
    Write-Log "LOI: Qua thoi gian cho Frontend khong len."
    Close-Splash
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
        "Khong the khoi dong QLBDX trong thoi gian cho (3 phut).`nKiem tra file log tai:`n$logDir",
        "QLBDX - Loi khoi dong",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
}

} finally {
    Close-Splash
    if ($isOwner) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
