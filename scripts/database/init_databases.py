# -*- coding: utf-8 -*-
"""
MediCode 一键初始化双数据库
生成独立的 patient.db / employee.db（SQLite），表结构来自
患者数据库.sql / 员工数据库.sql。
"""
import os
import re
import sqlite3

# 数据库文件统一存放到一个文件夹：backend/data/
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "backend", "data")
os.makedirs(DATA_DIR, exist_ok=True)
# SQL 文件统一放在项目根目录的 db/ 文件夹
SQL_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "db")


def run_sql_file(db_path: str, sql_file: str, label: str) -> None:
    with open(sql_file, encoding="utf-8") as f:
        content = f.read()
    content = re.sub(r"--[^\n]*", "", content)
    stmts = [s.strip() for s in content.split(";") if s.strip()]
    con = sqlite3.connect(db_path)
    cur = con.cursor()
    for s in stmts:
        if s.upper().startswith("CREATE"):
            cur.execute(s)
    con.commit()
    con.close()
    print(f"  [{label}] {db_path}  ->  {len(stmts)} 条语句")


def main() -> None:
    print("开始初始化 MediCode 双数据库（存储到 backend/data/）：")
    run_sql_file(os.path.join(DATA_DIR, "patient.db"), os.path.join(SQL_DIR, "患者数据库.sql"), "患者库")
    run_sql_file(os.path.join(DATA_DIR, "employee.db"), os.path.join(SQL_DIR, "员工数据库.sql"), "员工库")
    print(f"完成！已生成 {DATA_DIR}\\patient.db 与 {DATA_DIR}\\employee.db")


if __name__ == "__main__":
    main()
