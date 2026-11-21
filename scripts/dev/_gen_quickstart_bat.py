# -*- coding: utf-8 -*-
"""生成 GBK 编码的「一键秒启.bat / 重新构建.bat」(前端用 vite preview 服务静态产物,秒进页面)。"""
import os

BAT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "bat", "客户端")

START_BAT = r'''@echo off
setlocal enabledelayedexpansion
title NOVAMED 一键秒启

REM 项目根目录（本脚本位于 bat\客户端\ 下）
cd /d "%~dp0..\.."

echo ============================================
echo   NOVAMED 一键秒启（静态产物 + 后台服务）
echo   当前目录: %CD%
echo ============================================
echo.

REM 目录校验
if not exist "backend" (
    echo [错误] 未找到 backend 目录
    pause & exit /b 1
)
if not exist "frontend\dist" (
    echo [错误] 未找到 frontend\dist 产物，请先运行「重新构建.bat」
    pause & exit /b 1
)
echo [OK] 目录与产物检查通过
echo.

REM 清理旧的 NOVAMED 服务进程（避免端口冲突/重复启动）
echo [信息] 正在停止旧的 NOVAMED 服务进程...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\dev\stop_services.ps1"
echo.

REM 自动检测空闲端口，并更新前后端配置
echo [信息] 正在自动检测空闲端口并更新配置...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\dev\select_free_port.ps1"
if errorlevel 1 (
    echo [错误] 端口检测失败
    pause & exit /b 1
)

REM 读取分配到的端口
if exist "backend\.ports" (
    for /f "usebackq tokens=1,2 delims==" %%a in ("backend\.ports") do set "%%a=%%b"
) else (
    set BACKEND_PORT=18001
    set STAFF_PORT=3051
    set PATIENT_PORT=3005
)

echo ============================================
echo   端口分配
echo   [后端]   http://localhost:%BACKEND_PORT%/docs
echo   [客户端] http://localhost:%STAFF_PORT%
echo ============================================
echo.

REM 日志目录
if not exist "bat\系统工具\logs" mkdir "bat\系统工具\logs"

echo ============================================
echo   正在启动服务（全部后台最小化运行）
echo ============================================
echo.

REM 后端：0.0.0.0 监听，手机/局域网可访问；无 --reload，直启就绪快
start "NOVAMED-Backend" /min cmd /c "cd /d %CD%\backend && set BACKEND_PORT=%BACKEND_PORT%&& python -m uvicorn app.main:app --host 0.0.0.0 --port %BACKEND_PORT% > %CD%\bat\系统工具\logs\backend.log 2>&1"

REM 员工端前端：vite preview 直接服务已构建好的 dist 静态产物（秒开，无 dev 预构建等待）
start "NOVAMED-Frontend" /min cmd /c "cd /d %CD%\frontend && set STAFF_PORT=%STAFF_PORT%&& node node_modules\vite\bin\vite.js preview > %CD%\bat\系统工具\logs\frontend.log 2>&1"

REM 患者端前端：同样用 preview 服务 patient\dist 产物
start "NOVAMED-Patient" /min cmd /c "cd /d %CD%\frontend && set PATIENT_PORT=%PATIENT_PORT%&& node node_modules\vite\bin\vite.js preview --config vite.patient.config.ts > %CD%\bat\系统工具\logs\patient.log 2>&1"

REM 等待客户端（统一登录页）就绪后自动打开浏览器：preview 服务静态文件，几乎即时就绪
echo [信息] 等待客户端就绪（最多 15 秒），就绪后立即打开浏览器...
node -e "const t0=Date.now();(function p(){const s=require('net').connect({port:%STAFF_PORT%,host:'127.0.0.1'});s.on('connect',()=>{s.destroy();process.exit(0)});s.on('error',()=>{s.destroy();if(Date.now()-t0>15000)process.exit(1);setTimeout(p,120)})})()"
start "" "http://localhost:%STAFF_PORT%/login"
echo [OK] 已打开客户端统一登录页：http://localhost:%STAFF_PORT%/login

echo.
echo ============================================
echo   启动完成！服务已在后台最小化运行
echo ============================================
echo.
echo 登录信息:
echo   客户端: http://localhost:%STAFF_PORT%   (账号: admin/admin，登录页可切换「患者登录」)
echo   API文档: http://localhost:%BACKEND_PORT%/docs
echo.
echo 说明:
echo   - 本脚本服务「预构建的静态产物」，页面秒开，后端/前端均在后台运行。
echo   - 改过前端代码后，需先运行「重新构建.bat」再秒启（或改用「一键启动.bat」开发模式）。
echo   - 运行日志: bat\系统工具\logs\backend.log / frontend.log / patient.log
echo   - 停止服务: 双击 bat\一键停止.bat
echo.
echo 按任意键关闭此窗口（关闭后服务继续在后台运行）...
pause >nul
'''

BUILD_BAT = r'''@echo off
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
'''

os.makedirs(BAT_DIR, exist_ok=True)
for name, content in (("一键秒启.bat", START_BAT), ("重新构建.bat", BUILD_BAT)):
    path = os.path.join(BAT_DIR, name)
    with open(path, "w", encoding="gbk", newline="\r\n") as f:
        f.write(content)
    print("written:", path, os.path.getsize(path), "bytes (GBK)")
