import sqlite3, os
os.chdir(r"C:\Users\zhang\Desktop\MediCode\backend")
conn = sqlite3.connect("data/employee.db")
cur = conn.cursor()
tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
print("tables:", tables)
# find users table
for t in tables:
    cols = [c[1] for c in cur.execute(f"PRAGMA table_info({t})").fetchall()]
    print(t, "->", cols)
