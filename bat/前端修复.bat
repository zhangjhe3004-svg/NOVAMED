@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title MediCode 前端修复工具

cd /d "%~dp0"

echo ============================================
echo   MediCode 前端修复工具
echo ============================================
echo.

echo [1/5] 清理Vite缓存...
if exist "..\frontend\node_modules\.vite" (
    rmdir /s /q "..\frontend\node_modules\.vite" 2>nul
    echo [OK] Vite缓存已清理
) else (
    echo [OK] Vite缓存不存在，跳过
)

echo.
echo [2/5] 清理node_modules缓存...
if exist "..\frontend\node_modules\.cache" (
    rmdir /s /q "..\frontend\node_modules\.cache" 2>nul
    echo [OK] node_modules缓存已清理
) else (
    echo [OK] node_modules缓存不存在，跳过
)

echo.
echo [3/5] 检查端口占用...
netstat -ano | findstr :3051 >nul 2>&1
if errorlevel 0 (
    echo [WARN] 端口 3051 被占用
    echo [INFO] 正在查找占用进程...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3051') do (
        echo [INFO] PID: %%a
        taskkill /F /PID %%a 2>nul
        if errorlevel 0 (
            echo [OK] 进程已终止
        ) else (
            echo [WARN] 无法终止进程，请手动关闭
        )
    )
) else (
    echo [OK] 端口 3051 空闲
)

echo.
echo [4/5] 清理浏览器缓存提示...
echo [INFO] 请在浏览器中按 Ctrl+Shift+Delete 清理缓存
echo [INFO] 或使用无痕模式测试

echo.
echo [5/5] 重新安装依赖（可选）...
echo [INFO] 如果问题依然存在，请运行: cd frontend && npm install

echo.
echo ============================================
echo   修复完成！
echo ============================================
echo.
echo 现在可以运行 "一键启动.bat" 来启动服务
echo.
echo 如果问题依然存在，请尝试:
echo   1. 删除 frontend\node_modules 文件夹
echo   2. 运行 cd frontend && npm install
echo   3. 重新运行此脚本
echo.
echo 按任意键关闭此窗口...
pause >nul
