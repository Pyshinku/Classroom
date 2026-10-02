@echo off
chcp 65001 >nul
title Google Classroom Local Server

echo ======================================================================
echo    🎓 ЗАПУСК СЕРВЕРА GOOGLE CLASSROOM С ОБЩЕЙ БАЗОЙ ДАННЫХ
echo ======================================================================
echo.

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ОШИБКА] Python не найден в системе! 
    echo Установите Python 3 с официального сайта python.org и поставьте галочку "Add to PATH".
    pause
    exit /b 1
)

echo Запуск сервера...
start "" http://localhost:8000
python server.py

pause
