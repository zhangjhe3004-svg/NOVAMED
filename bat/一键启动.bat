@echo off
setlocal enabledelayedexpansion
title MediCode 一键启动

REM 项目根目录（本脚本位于 bat\ 下）
cd /d "%~dp0.."

echo ============================================
echo   MediCode 一键启动
echo   当前目录: %CD%
echo ============================================
echo.

REM 目录校验
if not exist "backend" (
    echo [错误] 未找到 backend 目录
    pause & exit /b 1
)
if not exist "frontend" (
    echo [错误] 未找到 frontend 目录
    pause & exit /b 1
)
echo [OK] 目录检查通过
echo.

REM 清理旧的 MediCode 服务进程（避免端口冲突/重复启动）
echo [信息] 正在停止旧的 MediCode 服务进程...
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
echo   [员工端] http://localhost:%STAFF_PORT%
echo   [患者端] http://localhost:%PATIENT_PORT%
echo ============================================
echo.

REM 清理 Vite 缓存
echo [信息] 清理 Vite 缓存...
if exist "frontend\node_modules\.vite" (
    rmdir /s /q "frontend\node_modules\.vite" 2>nul
    echo [OK] 员工端 Vite 缓存已清理
) else (
    echo [OK] 员工端 Vite 缓存不存在，跳过
)
if exist "frontend\node_modules\.vite-patient" (
    rmdir /s /q "frontend\node_modules\.vite-patient" 2>nul
    echo [OK] 患者端 Vite 缓存已清理
)
echo.

REM 日志目录
if not exist "bat\logs" mkdir "bat\logs"

echo ============================================
echo   正在启动服务（后台最小化运行）
echo ============================================
echo.

REM 后端：0.0.0.0 监听，手机/局域网可访问（三个 start 都是异步的，无需互相等待）
start "MediCode-Backend" /min cmd /c "cd /d %CD%\backend && set BACKEND_PORT=%BACKEND_PORT%&& python -m uvicorn app.main:app --reload --host 0.0.0.0 --port %BACKEND_PORT% > %CD%\bat\logs\backend.log 2>&1"

REM 员工端前端（直接调 vite，跳过 npm 中间层，省 1-2 秒）
start "MediCode-Frontend" /min cmd /c "cd /d %CD%\frontend && set STAFF_PORT=%STAFF_PORT%&& set BACKEND_PORT=%BACKEND_PORT%&& node node_modules\vite\bin\vite.js > %CD%\bat\logs\frontend.log 2>&1"

REM 患者端前端
start "MediCode-Patient" /min cmd /c "cd /d %CD%\frontend && set PATIENT_PORT=%PATIENT_PORT%&& set BACKEND_PORT=%BACKEND_PORT%&& node node_modules\vite\bin\vite.js --config vite.patient.config.ts > %CD%\bat\logs\patient.log 2>&1"

REM 等待员工端（统一登录页）就绪后自动打开浏览器：node 单进程轮询，150ms 间隔，就绪即开
echo [信息] 等待员工端就绪（最多 30 秒），就绪后立即打开浏览器...
node -e "const t0=Date.now();(function p(){const s=require('net').connect({port:%STAFF_PORT%,host:'127.0.0.1'});s.on('connect',()=>{s.destroy();process.exit(0)});s.on('error',()=>{s.destroy();if(Date.now()-t0>30000)process.exit(1);setTimeout(p,150)})})()"
start "" "http://localhost:%STAFF_PORT%/login"
echo [OK] 已打开统一登录页：http://localhost:%STAFF_PORT%/login

echo.
echo ============================================
echo   启动完成！服务已在后台最小化运行
echo ============================================
echo.
echo 登录信息:
echo   员工端: http://localhost:%STAFF_PORT%   (账号: admin/admin)
echo   患者端: 已并入员工端统一入口（登录页切换「患者登录」直通患者工作台）
echo   API文档: http://localhost:%BACKEND_PORT%/docs
echo.
echo 说明:
echo   - 两个端已统一入口：员工端登录页含「员工登录 / 患者登录」切换，登录后各自进入对应工作台（自动读取对应数据库）。
echo   - 服务窗口已最小化到任务栏，桌面只保留本窗口，不影响其他操作。
echo   - 运行日志: bat\logs\backend.log / frontend.log / patient.log
echo   - 停止服务: 双击 bat\一键停止.bat
echo   - 提示: 端口被占用时会自动切换到空闲端口，请以实际显示端口为准。
echo.
echo 按任意键关闭此窗口（关闭后服务继续在后台运行）...
pause >nul
