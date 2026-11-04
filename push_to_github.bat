@echo off
chcp 65001 >nul
title GitHub-ga Yuklash (Diyorbek Alikuziev CRM)

echo ========================================================
echo        GITHUB-GA LOYIHANI YUKLASH (PUSH TO GITHUB)
echo ========================================================
echo.
echo 1. Avval brauzeringizda github.com saytiga kiring
echo 2. "New repository" tugmasini bosib, yangi repo oching (masalan: crm-system)
echo 3. O'sha reponing HTTPS linkini nusxalab oling (Copy)
echo.
echo Masalan: https://github.com/dalikuziev/crm-system.git
echo ========================================================
echo.

set /p REPO_URL="GitHub Repository havolasini (linkini) kiriting: "

if "%REPO_URL%"=="" (
    echo Link kiritilmadi! Bekor qilindi.
    pause
    exit /b
)

echo.
echo [1/3] Remote ulanmoqda...
git remote remove origin >nul 2>nul
git remote add origin %REPO_URL%

echo [2/3] Branch tekshirilmoqda...
git branch -M main

echo [3/3] GitHub-ga yuklanmoqda (Push)...
echo (Brauzeringizda avtorizatsiya oynasi chiqsa, "Authorize" tugmasini bosing)
echo.
git push -u origin main

echo.
if %ERRORLEVEL% equ 0 (
    echo ========================================================
    echo  TABRIKLAYMIZ! Loyiha GitHub-ga muvaffaqiyatli yuklandi!
    echo ========================================================
) else (
    echo Xatolik yuz berdi. Iltimos link to'g'riligini va internet aloqasini tekshiring.
)

pause
