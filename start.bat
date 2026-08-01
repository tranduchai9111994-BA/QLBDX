@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%backend"
set "FRONTEND_DIR=%ROOT%frontend"
set "BACKEND_URL=http://127.0.0.1:5000/"
set "FRONTEND_URL=http://127.0.0.1:3000/"
set "FAST_MODE=%QLBDX_FAST%"

if /I "%~1"=="--fast" set "FAST_MODE=1"
if not defined FAST_MODE set "FAST_MODE=0"

echo.
echo  ============================================================
echo   QLBDX - Quan Ly Bai Do Xe
echo   Backend  : http://localhost:5000
echo   Frontend : http://localhost:3000
echo  ============================================================
echo.

if not exist "%BACKEND_DIR%\package.json" (
    echo [ERROR] Khong tim thay backend\package.json.
    exit /b 1
)

if not exist "%FRONTEND_DIR%\package.json" (
    echo [ERROR] Khong tim thay frontend\package.json.
    exit /b 1
)

if "%FAST_MODE%"=="1" (
    echo [MODE] FAST - bo qua check npm install va Prisma generate.
) else (
    echo [MODE] SAFE - chi cai dat bo sung khi thieu dependency.
    call :ensure_node_modules "Backend" "%BACKEND_DIR%" || goto :error
    call :ensure_node_modules "Frontend" "%FRONTEND_DIR%" || goto :error
    call :ensure_prisma_client || goto :error
)

echo [STEP] Giai phong port neu dang bi chiem...
call :free_port 5000
call :free_port 3000
timeout /t 1 /nobreak >nul

echo [STEP] Khoi dong Backend va Frontend song song...
start "QLBDX Backend :5000" cmd /k "cd /d %BACKEND_DIR% && npm run dev"
start "QLBDX Frontend :3000" cmd /k "cd /d %FRONTEND_DIR% && set BROWSER=none && npm start"

echo [STEP] Dang doi service san sang...
call :wait_for_url "Backend API" "%BACKEND_URL%" 30 || goto :startup_warning
call :wait_for_url "Frontend UI" "%FRONTEND_URL%" 90 || goto :startup_warning

echo.
echo [OK] He thong da san sang. Dang mo trinh duyet...
start "" "http://localhost:3000"
goto :done

:startup_warning
echo.
echo [WARN] Da qua thoi gian doi du kien. Hay xem 2 cua so Backend/Frontend de biet chi tiet.
goto :done

:error
echo.
echo [ERROR] Khoi dong that bai.
endlocal
exit /b 1

:done
echo.
echo Truy cap:
echo   Backend  : http://localhost:5000
echo   Frontend : http://localhost:3000
echo.
endlocal
exit /b 0

:ensure_node_modules
set "APP_NAME=%~1"
set "APP_DIR=%~2"

if exist "%APP_DIR%\node_modules" (
    echo [CHECK] %APP_NAME%: da co node_modules, bo qua npm install.
    exit /b 0
)

echo [SETUP] %APP_NAME%: thieu node_modules, dang chay npm install...
pushd "%APP_DIR%"
call npm install
set "EXIT_CODE=!ERRORLEVEL!"
popd

if not "!EXIT_CODE!"=="0" (
    echo [ERROR] %APP_NAME%: npm install that bai.
    exit /b 1
)

echo [SETUP] %APP_NAME%: npm install hoan tat.
exit /b 0

:ensure_prisma_client
if exist "%BACKEND_DIR%\node_modules\.prisma\client\index.js" (
    echo [CHECK] Backend: Prisma Client da san sang, bo qua generate.
    exit /b 0
)

echo [SETUP] Backend: thieu Prisma Client, dang chay npm run prisma:generate...
pushd "%BACKEND_DIR%"
call npm run prisma:generate
set "EXIT_CODE=!ERRORLEVEL!"
popd

if not "!EXIT_CODE!"=="0" (
    echo [ERROR] Backend: prisma generate that bai.
    exit /b 1
)

echo [SETUP] Backend: Prisma Client da duoc tao.
exit /b 0

:free_port
set "PORT=%~1"
set "FOUND=0"

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING" 2^>nul') do (
    if "!FOUND!"=="0" echo [PORT] Dang giai phong %PORT%...
    set "FOUND=1"
    taskkill /PID %%a /F >nul 2>&1
)

if "!FOUND!"=="0" echo [PORT] %PORT% dang trong.
exit /b 0

:wait_for_url
set "LABEL=%~1"
set "URL=%~2"
set /a "TIMEOUT_SECONDS=%~3"
set /a "ELAPSED=0"

:wait_for_url_loop
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest '%URL%' -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 (
    echo [READY] !LABEL! da san sang: !URL!
    exit /b 0
)

if "!ELAPSED!"=="0" (
    echo [WAIT] !LABEL! dang khoi dong...
) else (
    set /a "WAIT_REMINDER=!ELAPSED! %% 5"
    if "!WAIT_REMINDER!"=="0" echo [WAIT] !LABEL! dang khoi dong... !ELAPSED!s
)

if !ELAPSED! geq !TIMEOUT_SECONDS! (
    echo [WARN] !LABEL! chua san sang sau !TIMEOUT_SECONDS!s.
    exit /b 1
)

timeout /t 1 /nobreak >nul
set /a "ELAPSED+=1"
goto :wait_for_url_loop
