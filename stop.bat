@echo off
rem QLBDX - Dung Backend + Frontend dang chay ngam.
rem Script that nam trong scripts\ - file nay giu o root cho tien tao shortcut Desktop.
start "" /min powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0scripts\stop-silent.ps1"
exit
