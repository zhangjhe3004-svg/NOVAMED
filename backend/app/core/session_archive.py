"""
员工会话归档库（永不初始化）

- 独立的 SQLite 归档库 backend/data/employee_sessions.db
- 应用启动的 init_db() 不会初始化、迁移或重置此库
- 仅首次写入时惰性建立归档表（幂等 CREATE IF NOT EXISTS），之后永久追加
- 每位员工登录 -> 退出自动生成「时间+员工姓名.sql」并写入该库
"""
import datetime
from pathlib import Path

from sqlalchemy import create_engine, text

ARCHIVE_DIR = Path(__file__).resolve().parents[2] / "db"
ARCHIVE_PATH = ARCHIVE_DIR / "employee_sessions.db"

_engine = create_engine(
    "sqlite:///" + str(ARCHIVE_PATH),
    connect_args={"check_same_thread": False},
    echo=False,
)


def _now():
    return datetime.datetime.utcnow()


def _iso(dt):
    return dt.isoformat() if dt else ""


def _fmt(dt):
    return dt.strftime("%Y-%m-%d %H:%M:%S") if dt else ""


def _esc(s):
    return str(s).replace(chr(92), chr(92) * 2).replace(chr(39), chr(39) * 2).replace(chr(13), chr(32)).replace(chr(10), chr(32))


def ensure_archive_table():
    with _engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS session_archives (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                username TEXT,
                real_name TEXT,
                filename TEXT,
                login_at TEXT,
                logout_at TEXT,
                sql_content TEXT,
                status TEXT
            )
        """))
    return str(ARCHIVE_PATH)


def start_session(user) -> int:
    """登录时开启会话，生成「时间+员工姓名.sql」文件名，返回 session id。"""
    ensure_archive_table()
    login_at = _now()
    filename = login_at.strftime("%Y%m%d_%H%M%S") + "_" + (user.real_name or user.username) + ".sql"
    with _engine.begin() as conn:
        result = conn.execute(text(
            "INSERT INTO session_archives (user_id, username, real_name, filename, login_at, status) "
            "VALUES (:uid, :un, :rn, :fn, :la, '进行中')"
        ), {"uid": user.id, "un": user.username, "rn": user.real_name or user.username,
            "fn": filename, "la": _iso(login_at)})
        return result.lastrowid


def find_active_session(user_id):
    with _engine.connect() as conn:
        row = conn.execute(text(
            "SELECT id FROM session_archives WHERE user_id=:u AND status='进行中' ORDER BY id DESC LIMIT 1"
        ), {"u": user_id}).fetchone()
    return row[0] if row else None


def get_session_login(sid):
    if not sid:
        return None
    with _engine.connect() as conn:
        row = conn.execute(text("SELECT login_at FROM session_archives WHERE id=:s"), {"s": sid}).fetchone()
    return row[0] if row else None


def _num(v):
    return str(v) if v is not None else "NULL"


def _build_sql(user, login_at, logout_at, actions, diagnoses=None, appointments=None):
    NL = chr(10)
    Q = chr(39)

    def q(s):
        return Q + _esc(s) + Q

    out = []
    out.append("-- MediCode 员工会话归档（自动生成）")
    out.append("-- 员工: %s (%s)" % (user.real_name or user.username, user.username))
    out.append("-- 登录时间: %s" % _fmt(_parse(login_at)))
    out.append("-- 退出时间: %s" % _fmt(logout_at))
    out.append("")

    # 审计动作
    out.append("CREATE TABLE IF NOT EXISTS session_archive (")
    out.append("    id INTEGER PRIMARY KEY AUTOINCREMENT,")
    out.append("    employee_id INTEGER,")
    out.append("    employee_name TEXT,")
    out.append("    action TEXT,")
    out.append("    detail TEXT,")
    out.append("    logged_at TEXT")
    out.append(");")
    out.append("INSERT INTO session_archive (employee_id, employee_name, action, detail, logged_at) VALUES")
    rows = []
    rows.append("    (%s, %s, %s, %s, %s)" % (_num(user.id), q(user.real_name or user.username), q("登录系统"), q("用户登录"), q(_fmt(_parse(login_at)))))
    for a in (actions or []):
        rows.append("    (%s, %s, %s, %s, %s)" % (_num(user.id), q(user.real_name or user.username), q(a.get("action", "")), q(a.get("detail", "")), q(a.get("logged_at", ""))))
    rows.append("    (%s, %s, %s, %s, %s)" % (_num(user.id), q(user.real_name or user.username), q("退出系统"), q("用户退出"), q(_fmt(logout_at))))
    out.append("    " + ("," + NL + "    ").join(rows) + ";")
    out.append("")

    # 每日诊断
    out.append("CREATE TABLE IF NOT EXISTS daily_diagnoses (")
    out.append("    id INTEGER,")
    out.append("    employee_id INTEGER,")
    out.append("    patient_id INTEGER,")
    out.append("    symptoms TEXT,")
    out.append("    diagnosis TEXT,")
    out.append("    prescription TEXT,")
    out.append("    notes TEXT,")
    out.append("    created_at TEXT")
    out.append(");")
    out.append("INSERT INTO daily_diagnoses (id, employee_id, patient_id, symptoms, diagnosis, prescription, notes, created_at) VALUES")
    drows = []
    for d in (diagnoses or []):
        drows.append("    (%s, %s, %s, %s, %s, %s, %s, %s)" % (
            _num(d.get("id")), _num(user.id), _num(d.get("patient_id")), q(d.get("symptoms", "")),
            q(d.get("diagnosis", "")), q(d.get("prescription", "")), q(d.get("notes", "")), q(d.get("created_at", ""))))
    if drows:
        out.append("    " + ("," + NL + "    ").join(drows) + ";")
    else:
        out.append("    SELECT NULL WHERE 0;")
    out.append("")

    # 每日预约
    out.append("CREATE TABLE IF NOT EXISTS daily_appointments (")
    out.append("    id INTEGER,")
    out.append("    employee_id INTEGER,")
    out.append("    patient_name TEXT,")
    out.append("    department TEXT,")
    out.append("    date TEXT,")
    out.append("    time_slot TEXT,")
    out.append("    symptoms TEXT,")
    out.append("    status TEXT,")
    out.append("    created_at TEXT")
    out.append(");")
    out.append("INSERT INTO daily_appointments (id, employee_id, patient_name, department, date, time_slot, symptoms, status, created_at) VALUES")
    arows = []
    for a in (appointments or []):
        arows.append("    (%s, %s, %s, %s, %s, %s, %s, %s, %s)" % (
            _num(a.get("id")), _num(user.id), q(a.get("patient_name", "")), q(a.get("department", "")),
            q(a.get("date", "")), q(a.get("time_slot", "")), q(a.get("symptoms", "")), q(a.get("status", "")), q(a.get("created_at", ""))))
    if arows:
        out.append("    " + ("," + NL + "    ").join(arows) + ";")
    else:
        out.append("    SELECT NULL WHERE 0;")

    return NL.join(out)


def _parse(s):
    if not s:
        return None
    try:
        return datetime.datetime.fromisoformat(str(s))
    except Exception:
        return None


def finish_session(user, sid, actions, diagnoses=None, appointments=None):
    """退出时生成 .sql 内容并归档，返回文件名。"""
    ensure_archive_table()
    if not sid:
        sid = find_active_session(user.id)
    if not sid:
        return None
    login_at = get_session_login(sid)
    logout_at = _now()
    sql = _build_sql(user, login_at, logout_at, actions, diagnoses, appointments)
    filename = logout_at.strftime("%Y%m%d_%H%M%S") + "_" + (user.real_name or user.username) + ".sql"
    with _engine.begin() as conn:
        conn.execute(text(
            "UPDATE session_archives SET logout_at=:lo, sql_content=:sc, status='已归档' WHERE id=:sid"
        ), {"lo": _iso(logout_at), "sc": sql, "sid": sid})
    return filename
