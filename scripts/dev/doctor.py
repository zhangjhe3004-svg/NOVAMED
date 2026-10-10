#!/usr/bin/env python3
"""
MediCode doctor 命令 —— 系统运行诊断（对齐优化方案 9.2 节 / 工单 T22）

检查范围：运行时、依赖、构建、端口、数据、配置、依赖服务、进程。
不输出任何密钥值。
"""
import importlib
import os
import shutil
import socket
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BACKEND = os.path.join(ROOT, "backend")
FRONTEND = os.path.join(ROOT, "frontend")


def section(title):
    print("\n" + "=" * 50)
    print("  " + title)
    print("=" * 50)


def cmd(args, cwd=None):
    try:
        r = subprocess.run(args, cwd=cwd, capture_output=True, text=True, timeout=30)
        return r.returncode, (r.stdout or "").strip(), (r.stderr or "").strip()
    except Exception as e:
        return -1, "", str(e)


def port_free(port):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.settimeout(1)
        s.bind(("127.0.0.1", port))
        return True
    except OSError:
        return False
    finally:
        s.close()


def main():
    print("MediCode doctor")
    print("项目根目录: " + ROOT)

    section("运行时")
    for name in ("python", "py", "node", "npm"):
        path = shutil.which(name)
        if path:
            if name in ("python", "py"):
                code, out, _ = cmd([path, "--version"])
                print(f"[OK] {name}: {path} -> {out}")
            else:
                code, out, _ = cmd([path, "--version"])
                print(f"[OK] {name}: {path} -> {out}")
        else:
            print(f"[MISS] {name}: 未找到")

    section("后端关键模块")
    for mod in ("fastapi", "sqlalchemy", "pydantic", "pydantic_settings", "bcrypt", "jose", "motor", "pymongo"):
        try:
            importlib.import_module(mod)
            print(f"[OK] {mod}")
        except Exception:
            print(f"[MISS] {mod}")

    section("前端依赖")
    if os.path.exists(os.path.join(FRONTEND, "node_modules")):
        print("[OK] frontend/node_modules 存在")
    else:
        print("[WARN] frontend/node_modules 不存在，请运行 bat\一键安装.bat")
    if os.path.exists(os.path.join(FRONTEND, "package-lock.json")):
        print("[OK] package-lock.json 存在")
    else:
        print("[WARN] package-lock.json 不存在（npm install 后生成）")

    section("构建")
    code, out, _ = cmd([shutil.which("npm") or "npm", "run", "build"], cwd=FRONTEND)
    if code == 0:
        print("[OK] 前端构建通过")
    else:
        print("[WARN] 前端构建未通过（可能存在类型错误）")

    section("端口")
    for port, label in ((18001, "后端"), (3051, "员工前端"), (3005, "患者前端")):
        free = port_free(port)
        print(f"[{'OK' if free else 'BUSY'}] {label}端口 {port}: {'可绑定' if free else '被占用'}")

    section("数据")
    for db in ("employee.db", "patient.db"):
        p = os.path.join(BACKEND, "data", db)
        print(f"[{'OK' if os.path.exists(p) else 'NONE'}] {db}: {p}")

    section("配置")
    for p in (os.path.join(ROOT, ".env.example"), os.path.join(ROOT, "config", "agent_config.json")):
        print(f"[{'OK' if os.path.exists(p) else 'MISS'}] {os.path.relpath(p, ROOT)}")

    section("依赖服务")
    code, _, _ = cmd([shutil.which("python") or "python", "-c", "import pymongo; pymongo.MongoClient('mongodb://localhost:27017', serverSelectionTimeoutMS=1500).admin.command('ping')"], cwd=BACKEND)
    print(f"[{'OK' if code == 0 else 'DOWN'}] MongoDB (localhost:27017)")

    section("进程")
    try:
        import requests  # noqa
    except Exception:
        requests = None
    if requests:
        for port, label in ((18001, "后端"), (3051, "员工前端"), (3005, "患者前端")):
            try:
                r = requests.get(f"http://127.0.0.1:{port}/api/health", timeout=1.5)
                print(f"[{'UP' if r.status_code == 200 else 'DOWN'}] {label} http://127.0.0.1:{port}")
            except Exception:
                print(f"[DOWN] {label} http://127.0.0.1:{port}")
    else:
        print("[SKIP] 未安装 requests，跳过 HTTP 探活")

    print("\n诊断完成。")


if __name__ == "__main__":
    main()
