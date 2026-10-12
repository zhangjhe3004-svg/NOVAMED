# -*- coding: utf-8 -*-
"""生成移动端启动 bat（员工端/患者端），内置代理绕过 + Metro 启动。"""
import os

BAT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "bat")

# 员工端
STAFF = r'''@echo off
title MediCode 员工端 App（Expo）
cd /d "%~dp0..\apk"

REM 绕过 WorkBuddy 本地代理（127.0.0.1:6377），否则 Expo 会报 unable to verify the first certificate
set NO_PROXY=localhost,127.0.0.1,192.168.0.6,10.0.2.2,*.expo.dev,*.exp.host,*.expo.io,*.expo.app
set NODE_OPTIONS=--use-system-ca

echo ============================================
echo   MediCode 员工端（Expo Metro）
echo ============================================
echo.
echo 启动后请用手机 Expo Go 扫码，或按 a 键在安卓设备打开。
echo 手机与电脑需在同一 WiFi（后端地址 http://192.168.0.6:18001）。
echo.
npm run staff
pause
'''

# 患者端
PATIENT = r'''@echo off
title MediCode 患者端 App（Expo）
cd /d "%~dp0..\apk"

REM 绕过 WorkBuddy 本地代理（127.0.0.1:6377），否则 Expo 会报 unable to verify the first certificate
set NO_PROXY=localhost,127.0.0.1,192.168.0.6,10.0.2.2,*.expo.dev,*.exp.host,*.expo.io,*.expo.app
set NODE_OPTIONS=--use-system-ca

echo ============================================
echo   MediCode 患者端（Expo Metro）
echo ============================================
echo.
echo 启动后请用手机 Expo Go 扫码，或按 a 键在安卓设备打开。
echo 手机与电脑需在同一 WiFi（后端地址 http://192.168.0.6:18001）。
echo.
npm run patient
pause
'''

os.makedirs(BAT_DIR, exist_ok=True)
for name, content in (("启动员工端App.bat", STAFF), ("启动患者端App.bat", PATIENT)):
    path = os.path.join(BAT_DIR, name)
    with open(path, "w", encoding="gbk", newline="\r\n") as f:
        f.write(content)
    print("written:", path)
