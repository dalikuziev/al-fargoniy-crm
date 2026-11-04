@echo off
chcp 65001 >nul
title Al-Farg'oniy CRM Server

echo ========================================================
echo        AL-FARG'ONIY CRM - O'QUVCHILAR TO'LOV TIZIMI
echo ========================================================
echo.
echo [1/2] Backend server tekshirilmoqda...

where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [2/2] Python REST API Backend ishga tushirilmoqda...
    start /min "" python "%~dp0server.py"
    timeout /t 2 >nul
    start "" "http://localhost:8080/index.html"
) else (
    echo [2/2] Offline rejimda brauzerda ochilmoqda...
    start "" "%~dp0index.html"
)

echo.
echo ========================================================
echo Tizim muvaffaqiyatli ochildi!
echo Bo'limlar: 1. Al-Farg'oniy (yangiqo'rg'on) [37 ta]
echo            2. Al-Farg'oniy (uchko'prik)   [23 ta]
echo ========================================================
timeout /t 4 >nul
exit
