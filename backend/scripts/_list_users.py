import sqlite3, os
os.chdir(r"C:\Users\zhang\Desktop\MediCode\backend")
conn = sqlite3.connect("data/employee.db")
cur = conn.cursor()
rows = cur.execute("SELECT id, username, real_name, auth_level, department, role FROM users ORDER BY auth_level, id").fetchall()
for r in rows:
    print(r)
