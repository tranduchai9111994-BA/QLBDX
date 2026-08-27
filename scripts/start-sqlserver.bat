@echo off
:: Khoi dong SQL Server (MSSQLSERVER) can quyen Administrator
:: Icon nay se hien UAC prompt - bam Yes de cho phep.
powershell -NoProfile -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -Command \"Start-Service MSSQLSERVER; Write-Host (Get-Service MSSQLSERVER).Status; Start-Sleep 2\"'"
echo.
echo Da gui lenh khoi dong SQL Server (MSSQLSERVER).
echo Kiem tra trang thai bang: sc query MSSQLSERVER
pause
