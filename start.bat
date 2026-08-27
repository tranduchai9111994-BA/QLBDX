@echo off
rem QLBDX - Khoi dong toan bo he thong (SQL Server + Backend + Frontend) hoan toan an.
rem Khong hien cua so CMD nao - moi tien trinh chay ngam, log ghi vao thu muc logs\.
rem Trinh duyet se tu mo khi he thong san sang (~30-90 giay lan dau).
rem Script that nam trong scripts\ - file nay giu o root cho tien tao shortcut Desktop.
start "" /min powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0scripts\start-silent.ps1"
exit
