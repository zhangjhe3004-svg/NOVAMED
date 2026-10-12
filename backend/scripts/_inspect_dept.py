import sqlite3
c = sqlite3.connect('data/employee.db')
print("dyn_collections cols:", [r[1] for r in c.execute("PRAGMA table_info(dyn_collections)")])
for r in c.execute("SELECT * FROM dyn_collections WHERE name='departments'"):
    print(r)
print("---")
print("dyn_departments cols:", [r[1] for r in c.execute("PRAGMA table_info(dyn_departments)")])
