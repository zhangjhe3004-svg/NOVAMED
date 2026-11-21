@echo off
title NOVAMED 患者端 App（Expo）
cd /d "%~dp0..\..\apk"

REM 绕过 WorkBuddy 本地代理（127.0.0.1:6377），否则 Expo 会报 unable to verify the first certificate
set NO_PROXY=localhost,127.0.0.1,192.168.0.6,10.0.2.2,*.expo.dev,*.exp.host,*.expo.io,*.expo.app
set NODE_OPTIONS=--use-system-ca

echo ============================================
echo   NOVAMED 患者端（Expo Metro）
echo ============================================
echo.
echo 启动后请用手机 Expo Go 扫码，或按 a 键在安卓设备打开。
echo 手机与电脑需在同一 WiFi（后端地址 http://192.168.0.6:18001）。
echo.
npm run patient
pause
