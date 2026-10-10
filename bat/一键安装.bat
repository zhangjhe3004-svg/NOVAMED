@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title MediCode 一键安装依赖

set "ROOT="
if defined PROJ set "ROOT=%PROJ%"
if not defined ROOT call :findroot
if not defined ROOT (
  echo [ERROR] 找不到项目目录（需同时包含 backend 和 frontend）。
  pause & exit /b 1
)

echo Project root : !ROOT!
cd /d "!ROOT!\backend" || (echo [ERROR] backend 目录不存在 & pause & exit /b 1)

set "PY=python"
where py >nul 2>nul && set "PY=py"
where "%PY%" >nul 2>nul || (echo [ERROR] 未找到 Python，请安装 3.11+ & pause & exit /b 1)

echo [1/2] 安装后端 Python 依赖...
"%PY%" -m pip install -r requirements.txt
echo.

cd /d "!ROOT!\frontend" || (echo [ERROR] frontend 目录不存在 & pause & exit /b 1)
where npm >nul 2>nul || (echo [ERROR] 未找到 npm，请安装 Node 20+ & pause & exit /b 1)

echo [2/2] 安装前端 Node 依赖...
call npm install
echo.

echo 依赖安装完成，请运行「一键启动.bat」启动系统。
pause
exit /b

:findroot
set "cur=%~dp0"
set "ROOT="
for /l %%i in (1,1,8) do (
  if not defined ROOT (
    if exist "!cur!backend\app\main.py" if exist "!cur!frontend\package.json" set "ROOT=!cur!"
    set "cur=!cur!..\"
  )
)
if defined ROOT ( for %%p in ("!ROOT!.") do set "ROOT=%%~fp" )
goto :eof
