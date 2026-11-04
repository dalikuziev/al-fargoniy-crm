@echo off
chcp 65001 >nul
title CRM Web Server

echo CRM Server ishga tushirilmoqda...
python "%~dp0server.py"
pause
