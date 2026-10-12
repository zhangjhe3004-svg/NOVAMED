import sqlite3, os
os.chdir(r"C:\Users\zhang\Desktop\MediCode\backend")
names = ["赵敏", "张伟", "李芳", "王强"]
for db in ["data/employee.db", "data/patient.db"]:
    if not os.path.exists(db):
        print(db, "not found")
        continue
    conn = sqlite3.connect(db)
    cur = conn.cursor()
    # find user table
    tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
    for t in tables:
        cols = [c[1] for c in cur.execute(f"PRAGMA table_info({t})").fetchall()]
        if "real_name" in cols:
            for n in names:
                cur.execute(f"DELETE FROM {t} WHERE real_name = ?", (n,))
                if cur.rowcount:
                    print(f"{db} {t}: deleted {cur.rowcount} row(s) for {n}")
        if "name" in cols and t in ("patients",):
            for n in names:
                cur.execute(f"DELETE FROM {t} WHERE name = ?", (n,))
                if cur.rowcount:
                    print(f"{db} {t}: deleted {cur.rowcount} row(s) for {n}")
    conn.commit()
    conn.close()
print("done")
