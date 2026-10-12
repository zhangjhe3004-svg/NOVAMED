import sqlite3, os
os.chdir(r"C:\Users\zhang\Desktop\MediCode\backend")
conn = sqlite3.connect("data/employee.db")
cur = conn.cursor()
for n in ["赵敏","张伟","李芳","王强"]:
    cur.execute("DELETE FROM users WHERE real_name=?", (n,))
    print(f"deleted {n}: {cur.rowcount}")
conn.commit()
# verify
rows = cur.execute("SELECT id, username, real_name, auth_level FROM users ORDER BY id").fetchall()
for r in rows: print(r)
conn.close()
