# -*- coding: utf-8 -*-
"""
幂等脚本：批量创建 admin+数字 医生账号，分配科室，并自动放号同步到患者端预约挂号。

设计要点：
- 账号命名：admin01、admin02 ……（与系统管理员 admin 区分，role=doctor，可被患者挂号）。
- 科室：写在员工库 users.department 上；患者端科室列表由这些医生账号自动聚合（见
  GET /api/schedule/public-departments），无需再单独维护科室字典。
- 号源：为每位医生在「今天起 5 天」的上午/下午时段放号；已存在则跳过，可重复执行。
- 已存在的账号只补齐 real_name / department / title / is_active，不重置密码。

用法（在 backend 目录下）：
    python seed_admin_doctors.py
"""
import datetime

from app.core.database import employee_session, patient_session, init_db
from app.core.security import hash_password
from app.models.models import User, UserRole, DoctorSchedule

# username -> (显示名, 科室, 职称)；按需求 real_name 与用户名保持一致
DOCTORS = [
    ("admin01", "admin01", "内科",       "主任医师"),
    ("admin02", "admin02", "外科",       "副主任医师"),
    ("admin03", "admin03", "儿科",       "主治医师"),
    ("admin04", "admin04", "妇产科",     "主任医师"),
    ("admin05", "admin05", "骨科",       "副主任医师"),
    ("admin06", "admin06", "眼科",       "主治医师"),
    ("admin07", "admin07", "耳鼻喉科",   "主任医师"),
    ("admin08", "admin08", "皮肤科",     "副主任医师"),
    ("admin09", "admin09", "神经内科",   "主治医师"),
    ("admin10", "admin10", "心血管内科", "主任医师"),
]

DEFAULT_PASSWORD = "123456"
TIME_SLOTS = ["08:00-09:00", "09:00-10:00", "10:00-11:00", "14:00-15:00"]
DAYS_AHEAD = 5
SLOT_TOTAL = 10


def ensure_users():
    s = employee_session()
    created, updated = [], []
    try:
        for username, real_name, dept, title in DOCTORS:
            u = s.query(User).filter(User.username == username).first()
            if u is None:
                u = User(
                    username=username,
                    hashed_password=hash_password(DEFAULT_PASSWORD),
                    real_name=real_name,
                    role=UserRole.DOCTOR,
                    department=dept,
                    title=title,
                    work_status="在职",
                    is_active=True,
                    auth_level=1,
                )
                s.add(u)
                s.flush()  # 拿到 u.id
                created.append(username)
            else:
                u.real_name = real_name
                u.department = dept
                u.title = title
                u.role = UserRole.DOCTOR
                u.is_active = True
                if u.work_status not in ("在职", ""):
                    u.work_status = "在职"
                updated.append(username)
        s.commit()
        # 回填 id 映射
        id_map = {}
        for username, _, dept, _ in DOCTORS:
            u = s.query(User).filter(User.username == username).first()
            id_map[username] = (u.id, dept)
    finally:
        s.close()
    return id_map, created, updated


def seed_schedules(id_map):
    db = patient_session()
    today = datetime.date.today()
    added = 0
    try:
        for (username, _, _dept, _title), (doctor_id, dept) in zip(
            [(u, n, d, t) for (u, n, d, t) in DOCTORS],
            [id_map[u] for (u, _, _, _) in DOCTORS],
        ):
            for offset in range(DAYS_AHEAD):
                day = (today + datetime.timedelta(days=offset)).strftime("%Y-%m-%d")
                for slot in TIME_SLOTS:
                    exists = db.query(DoctorSchedule).filter(
                        DoctorSchedule.doctor_id == doctor_id,
                        DoctorSchedule.date == day,
                        DoctorSchedule.time_slot == slot,
                    ).first()
                    if exists:
                        continue
                    db.add(DoctorSchedule(
                        doctor_id=doctor_id, date=day, time_slot=slot,
                        department=dept, total=SLOT_TOTAL, remaining=SLOT_TOTAL,
                    ))
                    added += 1
        db.commit()
    finally:
        db.close()
    return added


def main():
    init_db()
    id_map, created, updated = ensure_users()
    added = seed_schedules(id_map)
    print("== 建号/同步完成 ==")
    print(f"新建账号: {created or '无'}")
    print(f"更新账号: {updated or '无'}")
    print(f"本次新放号源条数: {added}")
    print("科室一览（自动同步到患者端）:")
    for username, real_name, dept, title in DOCTORS:
        print(f"  {username:8s} {real_name}  {dept:<6s} {title}  (id={id_map[username][0]})")


if __name__ == "__main__":
    main()
