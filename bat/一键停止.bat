@echo off
title MediCode 一键停止
cd /d "%~dp0.."

echo ============================================
echo   MediCode 一键停止
echo ============================================
echo.
echo [信息] 正在停止所有 MediCode 服务...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\dev\stop_services.ps1"
echo.
echo [OK] 已全部停止。
echo.
pause
