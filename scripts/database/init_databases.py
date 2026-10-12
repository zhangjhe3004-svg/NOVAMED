# -*- coding: utf-8 -*-
"""
MediCode 一键初始化双数据库（患者库 patient.db / 员工库 employee.db）

说明：
- 仅使用 Python 标准库 sqlite3，不依赖 SQLAlchemy / FastAPI，可独立运行。
- 数据库文件统一存放到 backend/data/。
- 本脚本幂等：所有表使用 CREATE TABLE IF NOT EXISTS，可重复执行。
"""
import os
import sqlite3
import sys


def _create_db(db_path, tables):
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    con = sqlite3.connect(db_path)
    try:
        cur = con.cursor()
        for sql in tables:
            cur.execute(sql)
        con.commit()
    finally:
        con.close()


# ============================ 员工域 employee.db ============================

EMPLOYEE_TABLES = [
    """CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username VARCHAR(100) UNIQUE NOT NULL,
        hashed_password VARCHAR(255) NOT NULL,
        real_name VARCHAR(100) DEFAULT '',
        role VARCHAR(20) DEFAULT 'staff',
        is_active INTEGER DEFAULT 1,
        superior_id INTEGER,
        phone VARCHAR(50) DEFAULT '',
        email VARCHAR(120) DEFAULT '',
        id_type VARCHAR(50) DEFAULT '',
        id_number VARCHAR(50) DEFAULT '',
        surname VARCHAR(50) DEFAULT '',
        given_name VARCHAR(50) DEFAULT '',
        valid_until VARCHAR(50) DEFAULT '',
        issue_date VARCHAR(50) DEFAULT '',
        registered_place VARCHAR(200) DEFAULT '',
        employee_no VARCHAR(50) DEFAULT '',
        department VARCHAR(100) DEFAULT '',
        title VARCHAR(50) DEFAULT '',
        work_status VARCHAR(20) DEFAULT '在职',
        auth_level INTEGER DEFAULT 1,
        created_at DATETIME,
        updated_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER,
        receiver_id INTEGER NOT NULL,
        title VARCHAR(200) DEFAULT '',
        content TEXT DEFAULT '',
        is_read INTEGER DEFAULT 0,
        message_type VARCHAR(50) DEFAULT 'system',
        created_at DATETIME,
        updated_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title VARCHAR(200) DEFAULT '',
        content TEXT DEFAULT '',
        is_read INTEGER DEFAULT 0,
        level VARCHAR(20) DEFAULT 'info',
        created_at DATETIME,
        updated_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username VARCHAR(100) DEFAULT '',
        action VARCHAR(100) NOT NULL,
        resource VARCHAR(200) DEFAULT '',
        detail TEXT DEFAULT '',
        ip VARCHAR(50) DEFAULT '',
        created_at DATETIME,
        updated_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS token_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        provider VARCHAR(50) DEFAULT '',
        model VARCHAR(100) DEFAULT '',
        prompt_tokens INTEGER DEFAULT 0,
        completion_tokens INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        created_at DATETIME,
        updated_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title VARCHAR(200) DEFAULT '',
        messages TEXT DEFAULT '[]',
        created_at DATETIME,
        updated_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS user_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        preferences TEXT DEFAULT '{}',
        created_at DATETIME,
        updated_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS session_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        action VARCHAR(100) DEFAULT '',
        payload TEXT DEFAULT '{}',
        created_at DATETIME,
        updated_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS dyn_collections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(100) UNIQUE NOT NULL,
        title VARCHAR(200) DEFAULT '',
        description VARCHAR(500) DEFAULT '',
        fields_json TEXT DEFAULT '[]',
        enabled INTEGER DEFAULT 1,
        created_at DATETIME,
        updated_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS page_schemas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(100) UNIQUE NOT NULL,
        title VARCHAR(200) DEFAULT '',
        schema_json TEXT DEFAULT '{}',
        enabled INTEGER DEFAULT 1,
        created_at DATETIME,
        updated_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS acl_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role VARCHAR(50) DEFAULT '',
        collection VARCHAR(100) DEFAULT '',
        action VARCHAR(50) DEFAULT 'read',
        row_scope VARCHAR(50) DEFAULT 'all',
        enabled INTEGER DEFAULT 1,
        created_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS wf_defs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key VARCHAR(100) UNIQUE NOT NULL,
        title VARCHAR(200) DEFAULT '',
        trigger_collection VARCHAR(100) DEFAULT '',
        status_field VARCHAR(100) DEFAULT '',
        nodes_json TEXT DEFAULT '[]',
        enabled INTEGER DEFAULT 1,
        created_at DATETIME,
        updated_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS wf_instances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        def_id INTEGER NOT NULL,
        row_id INTEGER,
        current_index INTEGER DEFAULT 0,
        assignees_json TEXT DEFAULT '[]',
        history_json TEXT DEFAULT '[]',
        status VARCHAR(50) DEFAULT '审批中',
        created_at DATETIME,
        updated_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS permission_levels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        level INTEGER UNIQUE NOT NULL,
        name VARCHAR(100) DEFAULT '',
        description VARCHAR(500) DEFAULT '',
        permissions TEXT DEFAULT '[]',
        enabled INTEGER DEFAULT 1,
        created_at DATETIME,
        updated_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS nearby_transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL,
        receiver_id INTEGER NOT NULL,
        direction VARCHAR(20) DEFAULT 'send',
        item_type VARCHAR(50) DEFAULT 'message',
        item_title VARCHAR(300) DEFAULT '',
        payload TEXT DEFAULT '{}',
        status VARCHAR(30) DEFAULT '待处理',
        note VARCHAR(500) DEFAULT '',
        created_at DATETIME,
        updated_at DATETIME
    )"""
]

# ============================ 患者域 patient.db ============================

PATIENT_TABLES = [
    """CREATE TABLE IF NOT EXISTS patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(100) NOT NULL,
        gender VARCHAR(10) DEFAULT '其他',
        phone VARCHAR(50) DEFAULT '',
        id_card VARCHAR(50) DEFAULT '',
        birth_date VARCHAR(50) DEFAULT '',
        address VARCHAR(300) DEFAULT '',
        medical_history TEXT DEFAULT '',
        created_at DATETIME,
        updated_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS patient_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER,
        id_type VARCHAR(50) DEFAULT '居民身份证',
        id_number VARCHAR(50) DEFAULT '',
        surname VARCHAR(50) DEFAULT '',
        given_name VARCHAR(50) DEFAULT '',
        valid_until VARCHAR(50) DEFAULT '',
        issue_date VARCHAR(50) DEFAULT '',
        registered_place VARCHAR(200) DEFAULT '',
        phone VARCHAR(50) DEFAULT '',
        password_hash VARCHAR(255) DEFAULT '',
        status VARCHAR(20) DEFAULT '已注册',
        created_at DATETIME,
        updated_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doctor_id INTEGER NOT NULL,
        patient_id INTEGER,
        patient_name VARCHAR(100) DEFAULT '',
        phone VARCHAR(50) DEFAULT '',
        hospital VARCHAR(200) DEFAULT '',
        department VARCHAR(100) DEFAULT '',
        date VARCHAR(50) DEFAULT '',
        time_slot VARCHAR(50) DEFAULT '',
        symptoms TEXT DEFAULT '',
        status VARCHAR(30) DEFAULT '待就诊',
        diagnosis TEXT DEFAULT '',
        prescription TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        created_at DATETIME,
        updated_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS medical_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        doctor_id INTEGER,
        appointment_id INTEGER,
        symptoms TEXT DEFAULT '',
        diagnosis TEXT DEFAULT '',
        prescription TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        review_status VARCHAR(30) DEFAULT '待审核',
        created_at DATETIME,
        updated_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS record_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id INTEGER NOT NULL,
        author VARCHAR(100) DEFAULT '',
        content TEXT DEFAULT '',
        kind VARCHAR(30) DEFAULT 'comment',
        created_at DATETIME,
        updated_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS doctor_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doctor_id INTEGER NOT NULL,
        date VARCHAR(50) DEFAULT '',
        time_slot VARCHAR(50) DEFAULT '',
        department VARCHAR(100) DEFAULT '',
        total INTEGER DEFAULT 0,
        remaining INTEGER DEFAULT 0,
        created_at DATETIME,
        updated_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS knowledge_docs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title VARCHAR(300) NOT NULL,
        category VARCHAR(100) DEFAULT '',
        tags VARCHAR(500) DEFAULT '',
        content TEXT DEFAULT '',
        created_at DATETIME,
        updated_at DATETIME
    )"""
]

# ============================ 多租户存储 storage.db ============================

STORAGE_TABLES = [
    """CREATE TABLE IF NOT EXISTS storage_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username VARCHAR(64) UNIQUE NOT NULL,
        email VARCHAR(128) DEFAULT '',
        password_hash VARCHAR(255) NOT NULL,
        api_key_hash VARCHAR(64) NOT NULL,
        status VARCHAR(16) DEFAULT 'active',
        max_collections INTEGER DEFAULT 100,
        max_records INTEGER DEFAULT 1000000,
        created_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS storage_collections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        name VARCHAR(64) NOT NULL,
        schema_json TEXT DEFAULT '{}',
        created_at DATETIME,
        UNIQUE(account_id, name)
    )""",
    """CREATE TABLE IF NOT EXISTS storage_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        collection_id INTEGER NOT NULL,
        data TEXT NOT NULL,
        created_at DATETIME,
        updated_at DATETIME
    )"""
]


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    here = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(here))
    data_dir = os.path.join(project_root, "backend", "data")

    print("开始初始化 MediCode 双数据库（存储到 backend/data/）：")

    employee_db = os.path.join(data_dir, "employee.db")
    patient_db = os.path.join(data_dir, "patient.db")
    storage_db = os.path.join(data_dir, "storage.db")

    _create_db(employee_db, EMPLOYEE_TABLES)
    print(f"  [员工库] {employee_db}  ({len(EMPLOYEE_TABLES)} 张表)")

    _create_db(patient_db, PATIENT_TABLES)
    print(f"  [患者库] {patient_db}  ({len(PATIENT_TABLES)} 张表)")

    _create_db(storage_db, STORAGE_TABLES)
    print(f"  [存储库] {storage_db}  ({len(STORAGE_TABLES)} 张表)")

    print("完成！请运行「一键启动.bat」启动系统。")


if __name__ == "__main__":
    main()