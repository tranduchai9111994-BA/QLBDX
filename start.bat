@echo off
rem QLBDX - Khoi dong toan bo he thong (SQL Server + Backend + Frontend) hoan toan an.
rem Khong hien cua so CMD nao - moi tien trinh chay ngam, log ghi vao thu muc logs\.
rem Trinh duyet se tu mo khi he thong san sang (~30-90 giay lan dau).
start "" /min powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0start-silent.ps1"
exit
