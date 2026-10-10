@echo off
setlocal
chcp 65001 >nul
title MediCode 初始化数据库
set "ROOT=%~dp0.."
cd /d "%ROOT%"
echo 正在初始化双数据库（patient.db / employee.db）...
python scripts\database\init_databases.py
if errorlevel 1 (
  echo 初始化失败，请检查 Python 是否已安装。
) else (
  echo 初始化成功！数据库文件在 backend\data\ 目录。
)
pause
