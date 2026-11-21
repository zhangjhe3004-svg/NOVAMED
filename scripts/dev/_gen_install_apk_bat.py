# -*- coding: utf-8 -*-
"""生成 bat/手机端/安装APK到手机.bat（GBK）。"""
import os

BAT_DIR = r"C:\Users\zhang\Desktop\MediCode\bat\手机端"

BAT = r'''@echo off
setlocal enabledelayedexpansion
title NOVAMED 安装 APK 到手机
cd /d "%~dp0"

set ADB=C:\Users\zhang\Android\Sdk\platform-tools\adb.exe

echo ============================================
echo   NOVAMED 安装 APK 到手机/模拟器
echo ============================================
echo.
if not exist "%ADB%" (
    echo [错误] 未找到 adb：%ADB%
    echo        请先安装 Android SDK platform-tools，或修改本脚本中的 ADB 路径。
    pause & exit /b 1
)

echo [信息] 检测已连接的安卓设备...
"%ADB%" devices
echo.

echo 请选择要安装的应用：
echo   [1] 员工端 NOVAMED-staff-release.apk
echo   [2] 患者端 NOVAMED-patient-release.apk
echo   [3] 两个都装
echo   [0] 退出
echo.
set /p CH=请输入序号（1/2/3/0）：

if "%CH%"=="1" goto staff
if "%CH%"=="2" goto patient
if "%CH%"=="3" goto both
if "%CH%"=="0" exit /b 0
echo [错误] 输入无效，请重新运行。
pause & exit /b 1

:staff
echo [信息] 正在安装员工端...
"%ADB%" install -r "%~dp0NOVAMED-staff-release.apk"
goto done

:patient
echo [信息] 正在安装患者端...
"%ADB%" install -r "%~dp0NOVAMED-patient-release.apk"
goto done

:both
echo [信息] 正在安装员工端...
"%ADB%" install -r "%~dp0NOVAMED-staff-release.apk"
echo [信息] 正在安装患者端...
"%ADB%" install -r "%~dp0NOVAMED-patient-release.apk"
goto done

:done
echo.
echo [OK] 安装完成。可在设备桌面找到 NOVAMED 应用，双击图标即可运行（无需 Metro）。
echo     后端服务请先通过 bat\客户端\一键秒启.bat 启动。
echo.
pause
'''

os.makedirs(BAT_DIR, exist_ok=True)
path = os.path.join(BAT_DIR, "安装APK到手机.bat")
with open(path, "w", encoding="gbk", newline="\r\n") as f:
    f.write(BAT)
print("written:", path, os.path.getsize(path), "bytes (GBK)")
