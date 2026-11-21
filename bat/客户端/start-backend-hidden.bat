@echo off
rem NOVAMED backend resident launcher (started via Task Scheduler)
cd /d C:\Users\zhang\Desktop\MediCode\backend
C:\Users\zhang\AppData\Local\Python\pythoncore-3.14-64\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 18001 > C:\Users\zhang\Desktop\MediCode\bat\系统工具\logs\backend.log 2>&1
