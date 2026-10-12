# -*- coding: utf-8 -*-
"""按 2 小时一格重灌一周排班：夜/早/中三班各 4 格，每格一名医生。"""
import datetime
from sqlalchemy import text
from app.core.database import employee_session, init_db

SLOTS = [
    ("00-02", "00:00-02:00", "night"),
    ("02-04", "02:00-04:00", "night"),
    ("04-06", "04:00-06:00", "night"),
    ("06-08", "06:00-08:00", "night"),
    ("08-10", "08:00-10:00", "morning"),
    ("10-12", "10:00-12:00", "morning"),
    ("12-14", "12:00-14:00", "morning"),
    ("14-16", "14:00-16:00", "morning"),
    ("16-18", "16:00-18:00", "mid"),
    ("18-20", "18:00-20:00", "mid"),
    ("20-22", "20:00-22:00", "mid"),
    ("22-24", "22:00-24:00", "mid"),
]
GROUP_LABEL = {"night": "夜班", "morning": "早班", "mid": "中班"}

def main():
    init_db()
    db = employee_session()
    try:
        doctors = db.execute(text(
            "SELECT username, real_name, department FROM users "
            "WHERE role='DOCTOR' ORDER BY id"
        )).all()
        doc_list = [(r[1] or r[0], r[2] or "内科") for r in doctors]

        db.execute(text("DELETE FROM dyn_staff_schedules"))
        db.commit()

        today = datetime.date.today()
        monday = today - datetime.timedelta(days=today.weekday()) + datetime.timedelta(days=7)

        idx = 0
        for day_off in range(7):
            day = monday + datetime.timedelta(days=day_off)
            date_str = day.strftime("%Y-%m-%d")
            for slot_key, time_label, group in SLOTS:
                doc_name, dept = doc_list[idx % len(doc_list)]
                idx += 1
                shift_str = f"{time_label}|{GROUP_LABEL[group]}|{slot_key}|{dept}"
                db.execute(text(
                    "INSERT INTO dyn_staff_schedules (employee, date, shift) VALUES (:e, :d, :s)"
                ), {"e": doc_name, "d": date_str, "s": shift_str})
        db.commit()
        n = db.execute(text("SELECT COUNT(*) FROM dyn_staff_schedules")).scalar()
        print(f"已写入 {n} 条 2 小时格排班，周起点 {monday}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
