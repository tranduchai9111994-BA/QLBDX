@echo off
setlocal

set "ROOT=%~dp0"

echo.
echo  ============================================================
echo   QLBDX - Quan Ly Bai Do Xe
echo   Backend  : http://localhost:5000
echo   Frontend : http://localhost:3000
echo  ============================================================
echo.

:: Kill tien trinh dang chiem port 5000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000 " ^| findstr "LISTENING" 2^>nul') do (
    echo [AUTO] Dang giai phong port 5000 - PID %%a...
    taskkill /PID %%a /F >nul 2>&1
)

:: Kill tien trinh dang chiem port 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING" 2^>nul') do (
    echo [AUTO] Dang giai phong port 3000 - PID %%a...
    taskkill /PID %%a /F >nul 2>&1
)

:: Doi 1 giay de port duoc giai phong
timeout /t 1 /nobreak >nul

echo [1/2] Khoi dong Backend (port 5000)...
start "QLBDX Backend :5000" cmd /k "cd /d %ROOT%backend && npm run dev"

echo Cho backend khoi dong...
timeout /t 3 /nobreak >nul

echo [2/2] Khoi dong Frontend (port 3000)...
start "QLBDX Frontend :3000" cmd /k "cd /d %ROOT%frontend && npm start"

echo.
echo [OK] App dang khoi dong. Vui long cho vai giay roi mo http://localhost:3000
echo.

endlocal
