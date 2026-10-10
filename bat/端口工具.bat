@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title MediCode 端口工具

set "MODE=%~1"
if /i "!MODE!"=="auto" goto auto

echo ============================================
echo   MediCode 端口工具
echo   [1] 检查端口（保留段/占用/当前配置）
echo   [2] 一键换端口（自动挑选空闲端口并改写配置）
echo ============================================
choice /C 12 /M "请选择"
if !errorlevel!==1 goto check
if !errorlevel!==2 goto auto

:check
echo 检查 Windows 保留端口段（被保留则无法绑定，WinError 10013）：
netsh interface ipv4 show excludedportrange protocol=tcp
echo.
echo 当前正在使用的相关端口（18001 / 3051 / 3005）：
netstat -ano | findstr ":18001 :3051 :3005"
echo.
echo 当前后端端口配置：
findstr /C:"PORT: int" "%~dp0..\backend\app\core\config.py"
echo 当前前端端口配置：
findstr /C:"port:" "%~dp0..\frontend\vite.config.ts"
findstr /C:"port:" "%~dp0..\frontend\vite.patient.config.ts"
echo.
echo 提示：若后端启动报 WinError 10013，请选 [2] 一键换端口。
pause
exit /b

:auto
echo 正在自动挑选空闲端口并改写所有配置...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\scripts\dev\select_free_port.ps1"
echo.
echo 端口切换完成，请重启「一键启动.bat」。
pause
exit /b
