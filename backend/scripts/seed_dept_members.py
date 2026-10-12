# -*- coding: utf-8 -*-
"""
幂等脚本：把真实员工按「科室 + 子科室」同步进低代码「科室人员名单」集合。

- 集合 dept_members（物理表 dyn_dept_members，位于 backend/db/employee.db）
  由 seed_lowcode 建好；本脚本只补数据，已存在（同科室+子科室+姓名）则跳过。
- 每个大科室下 10 个子科室（科室名 + 1..10），与科室组织卡片上的小框一一对应；
  员工按顺序轮流落到各子科室，保证每个科室都有可点开的名单。

用法（backend 目录下）：
    python seed_dept_members.py
"""
from sqlalchemy import text

from app.core.database import employee_session, init_db
from app.services.seed_lowcode import _seed_collections

# 与科室组织卡片一致：每个大科室 10 个子科室
SUB_COUNT = 10


def seed_members(db):
    # 确保集合与物理表存在（幂等 upsert 元数据）
    _seed_collections(db)

    staff = db.execute(text(
        "SELECT real_name, username, role, department, title, phone, work_status "
        "FROM users WHERE is_active = 1 ORDER BY id"
    )).mappings().all()

    depts = [r[0] for r in db.execute(
        text("SELECT name FROM dyn_departments ORDER BY id")
    ).all()]

    existing = {
        (r["department"], r["sub_department"], r["name"])
        for r in db.execute(text(
            "SELECT department, sub_department, name FROM dyn_dept_members"
        )).mappings().all()
    }

    added = 0
    for dept in depts:
        # 精确匹配科室名；无命中时按前缀兜底（如「药房」员工归入「药剂科」）
        members = [s for s in staff if (s["department"] or "") == dept]
        if not members:
            members = [s for s in staff if dept.startswith(s["department"] or "\x00")]
        if not members:
            # 该科室暂无在职员工账号，留空由管理员在弹窗内自行添加
            continue
        for i, s in enumerate(members):
            sub = f"{dept}{(i % SUB_COUNT) + 1}"
            name = s["real_name"] or s["username"]
            key = (dept, sub, name)
            if key in existing:
                continue
            db.execute(text(
                "INSERT INTO dyn_dept_members (department, sub_department, name, title, phone, status) "
                "VALUES (:dept, :sub, :name, :title, :phone, :status)"
            ), {
                "dept": dept,
                "sub": sub,
                "name": name,
                "title": s["title"] or "",
                "phone": s["phone"] or "",
                "status": s["work_status"] or "在职",
            })
            existing.add(key)
            added += 1
    db.commit()
    return added


def main():
    init_db()
    db = employee_session()
    try:
        a = seed_members(db)
        total = db.execute(text("SELECT COUNT(*) FROM dyn_dept_members")).scalar()
        print("== 科室人员名单 同步完成 ==")
        print(f"本次新增人员: {a}，名单总数: {total}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
