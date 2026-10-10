"""
测试员工域低代码引擎初始化
"""
import sys
import io
sys.path.insert(0, 'C:/Users/zhang/Desktop/MediCode/backend')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from app.core.database import init_db, employee_session
from app.models.workspace import DynCollection, AclRule, WorkflowDef, PageSchemaModel
from app.services.dyn_engine import get_collection, list_collections
from app.services.acl_service import effective
from app.services.biz_workflow import list_defs

print("=== 开始验证员工域低代码引擎 ===")

# 1. 初始化数据库
print("\n1. 初始化数据库...")
init_db()
print("数据库初始化成功")

# 2. 检查元数据表
print("\n2. 检查元数据表...")
db = employee_session()
try:
    collections = db.query(DynCollection).all()
    print(f"找到 {len(collections)} 个集合定义:")
    for coll in collections:
        print(f"   - {coll.name} ({coll.title})")

    acl_rules = db.query(AclRule).all()
    print(f"找到 {len(acl_rules)} 条 ACL 规则")

    wf_defs = db.query(WorkflowDef).all()
    print(f"找到 {len(wf_defs)} 个工作流定义")
    
    page_schemas = db.query(PageSchemaModel).all()
    print(f"找到 {len(page_schemas)} 个页面 schema")
finally:
    db.close()

# 3. 检查动态物理表
print("\n3. 检查动态物理表...")
db = employee_session()
try:
    for coll in collections:
        table_name = f"dyn_{coll.name}"
        # 尝试查询表结构
        from sqlalchemy import text
        result = db.execute(text(f"PRAGMA table_info({table_name})"))
        columns = result.fetchall()
        print(f"表 {table_name} 存在，{len(columns)} 列")
finally:
    db.close()

# 4. 测试动态集合引擎
print("\n4. 测试动态集合引擎...")
db = employee_session()
try:
    all_collections = list_collections(db)
    print(f"列出集合: {len(all_collections)} 个")
    for coll in all_collections:
        print(f"   - {coll['name']}: {coll['title']}")
finally:
    db.close()

print("\n=== 验证完成 ===")
