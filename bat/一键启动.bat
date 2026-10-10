@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
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

REM 自动检测端口占用（被占用则 +1）
echo [信息] 检测端口占用...
netstat -ano | findstr :18001 >nul 2>&1
if errorlevel 0 ( set BACKEND_PORT=18002 ) else ( set BACKEND_PORT=18001 )
netstat -ano | findstr :3051 >nul 2>&1
if errorlevel 0 ( set STAFF_PORT=3052 ) else ( set STAFF_PORT=3051 )
netstat -ano | findstr :3005 >nul 2>&1
if errorlevel 0 ( set PATIENT_PORT=3006 ) else ( set PATIENT_PORT=3005 )

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
    echo [OK] Vite 缓存已清理
) else (
    echo [OK] Vite 缓存不存在，跳过
)
echo.

REM 更新后端端口与 CORS 配置
echo [信息] 更新后端配置...
cd backend
powershell -NoProfile -Command "(Get-Content app\core\config.py -Encoding UTF8) -replace 'PORT: int = \d+', 'PORT: int = %BACKEND_PORT%' -replace 'CORS_ORIGINS: list\[str\] = .*', 'CORS_ORIGINS = [\"http://localhost:%STAFF_PORT%\", \"http://localhost:%PATIENT_PORT%\"]'" | Set-Content app\core\config.py -Encoding UTF8
cd ..

echo [信息] 更新前端配置...
cd frontend
powershell -NoProfile -Command "(Get-Content vite.config.ts -Encoding UTF8) -replace 'port: \d+', 'port: %STAFF_PORT%' -replace 'target: .*', 'target: \"http://localhost:%BACKEND_PORT%\"'" | Set-Content vite.config.ts -Encoding UTF8
powershell -NoProfile -Command "(Get-Content vite.patient.config.ts -Encoding UTF8) -replace 'port: \d+', 'port = %PATIENT_PORT%' -replace 'target: .*', 'target: \"http://localhost:%BACKEND_PORT%\"'" | Set-Content vite.patient.config.ts -Encoding UTF8
cd ..

echo ============================================
echo   正在启动服务...
echo ============================================
echo.

start "MediCode-Backend"  cmd /k "cd backend && set BACKEND_PORT=%BACKEND_PORT% && python -m uvicorn app.main:app --reload --host 127.0.0.1 --port %BACKEND_PORT%"
timeout /t 2 /nobreak >nul
start "MediCode-Frontend" cmd /k "cd frontend && set STAFF_PORT=%STAFF_PORT% && set BACKEND_PORT=%BACKEND_PORT% && npm run dev"
timeout /t 2 /nobreak >nul
start "MediCode-Patient" cmd /k "cd frontend && set PATIENT_PORT=%PATIENT_PORT% && set BACKEND_PORT=%BACKEND_PORT% && npm run dev:patient"

echo.
echo ============================================
echo   启动完成！
echo ============================================
echo.
echo 登录信息:
echo   员工端: http://localhost:%STAFF_PORT%   (账号: admin/admin)
echo   患者端: http://localhost:%PATIENT_PORT%
echo   API文档: http://localhost:%BACKEND_PORT%/docs
echo.
echo 提示: 端口被占用时会自动切换，请以实际显示端口为准。
echo.
echo 按任意键关闭此窗口...
pause >nul
