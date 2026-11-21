@echo off
setlocal
chcp 65001 >nul
title NOVAMED 初始化数据库
set "ROOT=%~dp0..\.."
cd /d "%ROOT%"
echo 正在初始化双数据库（patient.db / employee.db）...
python scripts\database\init_databases.py
if errorlevel 1 (
  echo 初始化失败：请检查 Python 是否已正确安装并加入 PATH。
) else (
  echo 初始化成功！数据库文件位于 backend\data\ 目录。
)
pause