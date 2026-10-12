"""
为「默认患者」生成完整档案 + 多条完整就诊记录（写入 patient.db）。

默认患者：手机号 admin / 密码 admin（Patient id 通常为 6，本脚本自动定位）
用法：python seed_default_patient_records.py
幂等：患者档案只在字段为空时补齐；就诊记录用 (patient_id, symptoms) 判重，避免重复插入。
"""
import sqlite3
from datetime import datetime

DB_PATH = "db/patient.db"


def now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")


def get_conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def main():
    conn = get_conn()
    cur = conn.cursor()

    # 1) 定位默认患者（账号 phone='admin'）
    acct = cur.execute("SELECT patient_id FROM patient_accounts WHERE phone='admin'").fetchone()
    if not acct:
        print("[跳过] 未找到默认患者账号（phone=admin），请先启动后端初始化默认账号")
        conn.close()
        return
    pid = acct["patient_id"]
    print(f"[定位] 默认患者 patient_id={pid}")

    # 2) 补齐患者档案（仅在为空时填充，避免覆盖真实数据）
    pat = cur.execute("SELECT * FROM patients WHERE id=?", (pid,)).fetchone()
    if not pat:
        print("[错误] patients 表无 id=%d 的记录" % pid)
        conn.close()
        return

    updates = {}
    if not pat["gender"] or pat["gender"] == "OTHER":
        updates["gender"] = "FEMALE"
    if not pat["id_card"]:
        updates["id_card"] = "110101199001011234"
    if not pat["birth_date"]:
        updates["birth_date"] = "1990-01-01"
    if not pat["address"]:
        updates["address"] = "北京市海淀区中关村南大街 1 号"
    if not pat["medical_history"]:
        updates["medical_history"] = "既往体健；2021 年曾因急性阑尾炎行阑尾切除术；无药物过敏史；血压偏高（临界高血压）需定期监测。"

    if updates:
        cols = ", ".join(f"{k}=?" for k in updates)
        cur.execute(f"UPDATE patients SET {cols}, updated_at=? WHERE id=?",
                    [*updates.values(), now(), pid])
        print(f"[患者] 已补齐档案字段：{list(updates.keys())}")

    # 3) 更新患者账号的身份证信息（patient_accounts）
    cur.execute(
        "UPDATE patient_accounts SET id_type='居民身份证', id_number='110101199001011234', "
        "surname='默', given_name='认患者' WHERE patient_id=?",
        (pid,),
    )

    conn.commit()
    conn.close()

    # 医生在 employee.db
    econn = sqlite3.connect("db/employee.db")
    econn.row_factory = sqlite3.Row
    docs = econn.execute(
        "SELECT id, real_name, username, department, title FROM users "
        "WHERE role='DOCTOR' AND is_active=1 ORDER BY id ASC"
    ).fetchall()
    econn.close()
    if not docs:
        print("[错误] employee.db 无在职医生")
        return
    # 优先选择有真实姓名的医生（如 张伟）
    doctor = next((d for d in docs if d["real_name"] not in (d["username"], "")), docs[0])
    print(f"[医生] 选用医生：{doctor['real_name']}({doctor['department']}·{doctor['title']}) id={doctor['id']}")

    # 5) 生成就诊记录（完整字段）
    records = [
        {
            "symptoms": "反复头痛 3 天，伴恶心、畏光，劳累后加重；体温 37.8℃，无呕吐。",
            "diagnosis": "紧张性头痛",
            "prescription": "1. 布洛芬缓释胶囊 0.3g q12h 口服×3天\n2. 谷维素片 10mg tid 口服×7天\n3. 建议规律作息，避免熬夜与精神紧张。",
            "notes": "血压 138/88 mmHg，偏高，建议低盐饮食并定期复查。",
            "review_status": "已审核",
            "ai_suggestion": "紧张性头痛（可能性高）；需排除偏头痛、颅内占位。建议完善头颅 CT 排除器质性病变。",
            "ai_confidence": "0.82",
            "ai_reviewed": 1,
            "admin_reviewed": 1,
            "admin_name": "系统管理员",
            "room": "内科 3 诊室",
        },
        {
            "symptoms": "咳嗽、咳黄痰 5 天，伴发热，体温最高 38.6℃，夜间咳嗽明显。",
            "diagnosis": "急性支气管炎",
            "prescription": "1. 阿莫西林克拉维酸钾片 0.375g bid 口服×5天\n2. 盐酸氨溴索片 30mg tid 口服×7天\n3. 多饮水，注意休息。",
            "notes": "双肺呼吸音粗，未闻及干湿啰音。建议完善胸部 X 线。",
            "review_status": "已审核",
            "ai_suggestion": "急性支气管炎；需排除肺炎、支气管哮喘。",
            "ai_confidence": "0.75",
            "ai_reviewed": 1,
            "admin_reviewed": 1,
            "admin_name": "系统管理员",
            "room": "内科 2 诊室",
        },
        {
            "symptoms": "右上腹隐痛 1 周，进食油腻后加重，伴腹胀、嗳气。",
            "diagnosis": "慢性胆囊炎",
            "prescription": "1. 消炎利胆片 6 片 tid 口服×14天\n2. 建议低脂饮食，忌暴饮暴食。",
            "notes": "腹部超声示胆囊壁毛糙增厚，胆囊内见小结石。建议肝胆外科随访。",
            "review_status": "待审核",
            "ai_suggestion": "慢性胆囊炎伴胆囊结石；需排除胆总管结石、胰腺炎。",
            "ai_confidence": "0.70",
            "ai_reviewed": 0,
            "admin_reviewed": 0,
            "admin_name": "",
            "room": "内科 1 诊室",
        },
    ]

    conn = get_conn()
    cur = conn.cursor()
    inserted = 0
    for r in records:
        # 判重：同患者同症状已存在则跳过
        exists = cur.execute(
            "SELECT id FROM medical_records WHERE patient_id=? AND symptoms=?",
            (pid, r["symptoms"]),
        ).fetchone()
        if exists:
            continue
        ts = now()
        cur.execute(
            """INSERT INTO medical_records
               (patient_id, doctor_id, appointment_id, symptoms, diagnosis, prescription, notes,
                review_status, created_at, updated_at, room, ai_suggestion, ai_confidence,
                ai_reviewed, admin_reviewed, admin_name)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                pid, doctor["id"], None, r["symptoms"], r["diagnosis"], r["prescription"], r["notes"],
                r["review_status"], ts, ts, r["room"], r["ai_suggestion"], r["ai_confidence"],
                r["ai_reviewed"], r["admin_reviewed"], r["admin_name"],
            ),
        )
        inserted += 1
    conn.commit()

    # 汇总
    total = cur.execute("SELECT COUNT(*) FROM medical_records WHERE patient_id=?", (pid,)).fetchone()[0]
    conn.close()
    print(f"[记录] 新增就诊记录 {inserted} 条（当前默认患者共 {total} 条）")


if __name__ == "__main__":
    main()
