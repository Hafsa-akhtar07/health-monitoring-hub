@echo off
cd /d "%~dp0"
echo Running push-to-main.ps1 ...
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0push-to-main.ps1"
echo.
pause
