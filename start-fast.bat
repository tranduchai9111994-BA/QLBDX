@echo off
rem QLBDX - Khoi dong nhanh (bo qua kiem tra/cai dependency), hoan toan an, khong hien CMD.
start "" /min powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0start-silent.ps1" -Fast
exit
