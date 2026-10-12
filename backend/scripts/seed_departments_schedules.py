# -*- coding: utf-8 -*-
"""
幂等脚本：把全院科室与真实医生排班同步进低代码「科室组织 / 排班表」页面。

- 科室组织（dyn_departments）：补齐全套科室（与用户管理里的科室下拉一致），已存在则跳过。
- 排班表（dyn_staff_schedules）：清空演示假数据，写入真实医生账号(admin01~10)未来几天的排班，
  使其在患者端/员工端都以表格形式呈现。

用法（backend 目录下）：
    python seed_departments_schedules.py
"""
import datetime

from sqlalchemy import text

from app.core.database import employee_session, employee_engine, init_db
from app.models.models import User, UserRole

# 与前端用户管理页科室下拉保持一致的全院科室全集
DEPARTMENTS = [
    "内科", "外科", "妇产科", "儿科", "骨科", "眼科", "耳鼻喉科", "皮肤科",
    "神经内科", "心血管内科", "呼吸内科", "消化内科", "内分泌科", "肾内科",
    "血液内科", "肿瘤科", "泌尿外科", "胸外科", "神经外科", "急诊科",
    "麻醉科", "口腔科", "中医科", "康复医学科", "全科医学科",
    "检验科", "影像科", "药剂科", "预防保健科",
]

# 班次模板
SHIFT_POOL = ["早班 08:00-16:00", "白班 08:00-17:00", "晚班 16:00-24:00"]


def seed_departments(db):
    existing = {r[0] for r in db.execute(text("SELECT name FROM dyn_departments")).all()}
    added = 0
    for dept in DEPARTMENTS:
        if dept in existing:
            continue
        db.execute(
            text("INSERT INTO dyn_departments (name, leader, description) VALUES (:n, :l, :d)"),
            {"n": dept, "l": "待任命", "d": f"{dept}门诊、病房及相关医技工作"},
        )
        added += 1
    db.commit()
    return added


def seed_schedules(db):
    # 取真实医生账号（admin01~10，role=doctor）
    rows = db.execute(
        text("SELECT username, real_name, department FROM users "
             "WHERE username LIKE 'admin0%' OR username = 'admin10' ORDER BY id")
    ).all()
    doctors = [(r[0], r[1] or r[0], r[2] or "内科") for r in rows]

    # 清空演示假数据，换成真实排班
    db.execute(text("DELETE FROM dyn_staff_schedules"))
    db.commit()

    today = datetime.date.today()
    inserted = 0
    for i, (username, real_name, dept) in enumerate(doctors):
        for offset in range(3):  # 今天起 3 天
            day = (today + datetime.timedelta(days=offset)).strftime("%Y-%m-%d")
            shift = SHIFT_POOL[(i + offset) % len(SHIFT_POOL)]
            db.execute(
                text("INSERT INTO dyn_staff_schedules (employee, date, shift) VALUES (:e, :d, :s)"),
                {"e": real_name, "d": day, "s": f"{dept} · {shift}"},
            )
            inserted += 1
    db.commit()
    return inserted


def main():
    init_db()
    db = employee_session()
    try:
        a = seed_departments(db)
        s = seed_schedules(db)
        dept_count = db.execute(text("SELECT COUNT(*) FROM dyn_departments")).scalar()
        sched_count = db.execute(text("SELECT COUNT(*) FROM dyn_staff_schedules")).scalar()
        print("== 科室组织 / 排班表 同步完成 ==")
        print(f"本次新增科室: {a}，科室总数: {dept_count}")
        print(f"排班表写入真实排班: {s} 条，当前总数: {sched_count}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
