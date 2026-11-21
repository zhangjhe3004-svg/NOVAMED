@echo off
title NOVAMED 重新构建
cd /d "%~dp0..\..\frontend"

echo ============================================
echo   NOVAMED 前端产物重新构建（员工端 + 患者端）
echo ============================================
echo.
echo [信息] 正在构建员工端产物（vite build）...
node node_modules\vite\bin\vite.js build
if errorlevel 1 (
    echo [错误] 员工端构建失败
    pause & exit /b 1
)
echo.
echo [信息] 正在构建患者端产物（vite build --config vite.patient.config.ts）...
node node_modules\vite\bin\vite.js build --config vite.patient.config.ts
if errorlevel 1 (
    echo [错误] 患者端构建失败
    pause & exit /b 1
)
echo.
echo [OK] 产物构建完成，可运行「一键秒启.bat」秒进页面。
echo.
pause
