import sqlite3, os
os.chdir(r"C:\Users\zhang\Desktop\MediCode\backend")
conn = sqlite3.connect("data/patient.db")
cur = conn.cursor()
tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
print("patient tables:", tables)
for t in tables:
    cols = [c[1] for c in cur.execute(f"PRAGMA table_info({t})").fetchall()]
    print(t, cols)
    # search
    for n in ["赵敏","张伟","李芳","王强"]:
        for col in cols:
            try:
                cur.execute(f"SELECT COUNT(*) FROM {t} WHERE {col}=?", (n,))
                c = cur.fetchone()[0]
                if c:
                    print(f"  found {c} '{n}' in {col}, deleting...")
                    cur.execute(f"DELETE FROM {t} WHERE {col}=?", (n,))
            except Exception:
                pass
conn.commit()
conn.close()
