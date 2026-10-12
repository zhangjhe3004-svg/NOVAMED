@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title MediCode 前端修复工具

cd /d "%~dp0.."

echo ============================================
echo   MediCode 前端修复工具
echo ============================================
echo.

echo [1/3] 清理 Vite 缓存...
if exist "frontend\node_modules\.vite" (
    rmdir /s /q "frontend\node_modules\.vite" 2>nul
    echo [OK] 员工端 Vite 缓存已清理
) else (
    echo [OK] 员工端 Vite 缓存不存在，跳过
)
if exist "frontend\node_modules\.vite-patient" (
    rmdir /s /q "frontend\node_modules\.vite-patient" 2>nul
    echo [OK] 患者端 Vite 缓存已清理
) else (
    echo [OK] 患者端 Vite 缓存不存在，跳过
)

echo.
echo [2/3] 清理 node_modules 缓存...
if exist "frontend\node_modules\.cache" (
    rmdir /s /q "frontend\node_modules\.cache" 2>nul
    echo [OK] node_modules 缓存已清理
) else (
    echo [OK] node_modules 缓存不存在，跳过
)

echo.
echo [3/3] 提示...
echo [INFO] 请在浏览器按 Ctrl+Shift+Delete 清理缓存，或使用无痕模式。
echo [INFO] 若仍异常，请删除 frontend\node_modules 后运行：
echo        cd frontend ^&^& npm install

echo.
echo ============================================
echo   修复完成！请重新运行「一键启动.bat」。
echo ============================================
echo.
pause >nul