import sqlite3, json
c = sqlite3.connect('data/employee.db')

# 1. 加列
for col in ["deputy_1", "deputy_2", "deputy_3", "deputy_4", "deputy_5"]:
    try:
        c.execute(f"ALTER TABLE dyn_departments ADD COLUMN {col} VARCHAR(100) DEFAULT ''")
        print("added", col)
    except Exception as e:
        print("skip", col, e)

# 2. 更新字段元数据
old = json.loads(c.execute("SELECT fields_json FROM dyn_collections WHERE name='departments'").fetchone()[0])
new_fields = [old[0], old[1],
    {"name": "leader", "type": "string", "label": "主任"},
    {"name": "deputy_1", "type": "string", "label": "副主任1"},
    {"name": "deputy_2", "type": "string", "label": "副主任2"},
    {"name": "deputy_3", "type": "string", "label": "副主任3"},
    {"name": "deputy_4", "type": "string", "label": "副主任4"},
    {"name": "deputy_5", "type": "string", "label": "副主任5"},
    old[3],
]
c.execute("UPDATE dyn_collections SET fields_json=? WHERE name='departments'", (json.dumps(new_fields, ensure_ascii=False),))
c.commit()
print("cols now:", [r[1] for r in c.execute("PRAGMA table_info(dyn_departments)")])
print("fields now:", c.execute("SELECT fields_json FROM dyn_collections WHERE name='departments'").fetchone()[0])
