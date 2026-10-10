"""
医码合一智慧医疗系统 — 后端主入口

============ 启动方式 ============

开发环境:
    cd backend
    uvicorn app.main:app --reload --port 8000

生产环境:
    docker-compose up -d

查看API文档:
    浏览器打开 http://localhost:8000/docs

============ 默认账号 ============
管理员: admin / admin123

============ 技术架构 ============
├── FastAPI: Web框架，自动生成API文档
├── SQLAlchemy + SQLite: 结构化数据存储（患者、就诊记录）
├── MongoDB: 非结构化数据存储（训练数据、知识文档、用户行为）
├── FAISS: 向量相似度搜索（智能症状匹配）
├── JWT: 无状态身份认证
└── Motor: 异步MongoDB驱动
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .core.database import init_db
# 插件化：功能模块作为插件，由 PluginManager 在启动时按启用状态挂载（NocoBase 风格）
from .core.plugin_manager import plugin_manager
from .core.plugins import register_builtin_plugins
from .api.plugins import router as plugins_router
from .api.token_usage import router as token_usage_router
from .api.conversation import router as conversation_router
from .api.audit import router as audit_router
from .api.notification import router as notification_router
from .api.message import router as message_router
from .api.appointment import router as appointment_router
from .api.patient_account import router as patient_account_router
from .api.patient_auth import router as patient_auth_router
from .core.dependencies import get_current_user


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期"""
    # === 启动时 ===
    print("=" * 50)
    print(f"  {settings.APP_NAME} v{settings.APP_VERSION}")
    print("=" * 50)

    # 1. 初始化SQLite数据库
    init_db()
    print("[启动] SQLite 数据库已初始化")

    # 2. 确保默认管理员存在
    _ensure_default_admin()

    # 2b. 确保默认患者账号存在（手机号 admin / 密码 admin）
    try:
        _ensure_default_patient()
    except Exception as e:
        print(f"[警告] 默认患者账号初始化失败（不影响启动）: {e}")

    # 3. 尝试初始化MongoDB（失败也不影响系统运行）
    try:
        from .core.mongodb import init_mongodb
        await init_mongodb()
        print("[启动] MongoDB 已连接")
    except Exception as e:
        print(f"[启动] MongoDB 未连接（非结构化功能暂不可用）: {e}")

    # 4. 预热向量数据库
    try:
        from .services.vector_db import vector_db
        _ = await vector_db.search("test", top_k=1)
        print("[启动] 向量数据库就绪")
    except Exception as e:
        print(f"[启动] 向量数据库初始化: {e}")

    # 5. 插件化：注册内置插件并挂载（对齐 NocoBase 启动时启用插件）
    register_builtin_plugins(plugin_manager)
    await plugin_manager.beforeLoad()
    await plugin_manager.load()
    plugin_manager.mount(app)
    print(f"[启动] 已加载 {len(plugin_manager.active())} 个插件")

    # 6. 员工域低代码引擎播种（幂等：建集合/页面/权限/流程 + 演示数据）
    try:
        from .services.seed_lowcode import seed_lowcode
        seed_lowcode()
    except Exception as e:
        print(f"[启动] 员工域播种失败（不影响主功能）: {e}")

    print(f"[启动] 服务器运行在 http://{settings.HOST}:{settings.PORT}")
    print(f"[启动] API文档: http://localhost:{settings.PORT}/docs")
    print("=" * 50)

    yield

    # === 关闭时 ===
    try:
        from .core.mongodb import close_mongodb
        await close_mongodb()
    except Exception:
        pass
    print("[关闭] 系统已停止")


def _ensure_default_admin():
    """确保系统中存在默认管理员账号（写入员工库 employee.db）"""
    from .core.database import employee_session
    from .models.models import User, UserRole
    from .core.security import hash_password

    db = employee_session()
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            admin = User(
                username="admin",
                hashed_password=hash_password("admin"),
                real_name="系统管理员",
                role=UserRole.ADMIN,
            )
            db.add(admin)
            db.commit()
            print("[初始化] 默认管理员已创建: admin / admin")
        else:
            print("[初始化] 默认管理员已存在 (admin / admin)")
    finally:
        db.close()


def _ensure_default_patient():
    """确保存在默认患者账号（手机号 admin / 密码 admin），便于快速体验患者端。"""
    from .core.database import patient_session
    from .models.models import PatientAccount, Patient, Gender
    from .core.security import hash_password

    db = patient_session()
    try:
        acct = db.query(PatientAccount).filter(PatientAccount.phone == "admin").first()
        if not acct:
            pat = Patient(name="默认患者", gender=Gender.OTHER, phone="admin")
            db.add(pat)
            db.commit()
            db.refresh(pat)
            acct = PatientAccount(
                id_type="居民身份证",
                id_number="000000000000000000",
                surname="默",
                given_name="认患者",
                phone="admin",
                patient_id=pat.id,
                password_hash=hash_password("admin"),
                status="已注册",
            )
            db.add(acct)
            db.commit()
            print("[初始化] 默认患者账号已创建: admin / admin")
        else:
            print("[初始化] 默认患者账号已存在 (admin / admin)")
    finally:
        db.close()


# 创建FastAPI应用
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="""
## 医码合一全域智慧医疗系统

基于边缘计算平台的智慧医疗辅助系统。

### 核心功能
- 🏥 **患者管理**: 患者档案CRUD、病史记录
- 🤖 **AI辅助诊断**: 症状分析、相似病例搜索、诊断建议
- 📊 **数据看板**: 实时统计、趋势分析
- 🔒 **安全认证**: JWT令牌 + 角色权限控制
- 🧠 **用户记忆**: 自动学习用户习惯、个性化推荐
- 📚 **知识库**: 医学知识积累与检索

### 技术栈
- FastAPI + SQLAlchemy + SQLite/PostgreSQL
- MongoDB + FAISS 向量搜索
- React + TypeScript + Ant Design
- Docker 容器化部署
    """,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS 跨域配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 系统级路由（始终挂载，不随插件启停）
app.include_router(plugins_router)  # 插件管理（/api/plugins）
app.include_router(token_usage_router)  # Token 用量统计（/api/token-usage）
app.include_router(conversation_router)  # 会话管理（/api/conversations）
app.include_router(audit_router)  # 审计日志（/api/audit-logs）
app.include_router(notification_router)  # 通知（/api/notifications）
app.include_router(message_router)  # 员工消息（/api/messages）
app.include_router(appointment_router)  # 预约挂号（/api/appointments）
app.include_router(patient_account_router)  # 患者注册（/api/patient-register）
app.include_router(patient_auth_router)  # 患者端认证（/api/patient-auth）

# 其余功能模块路由由 PluginManager 在 lifespan 启动时按启用状态挂载（见上方第5步）


@app.get("/", tags=["系统"])
def root():
    """系统根路径 - 健康检查"""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
    }


@app.get("/api/system/routes", tags=["系统"])
def system_routes(current_user=Depends(get_current_user)):
    """列出系统所有已挂载的 API 路由（仅管理员）。"""
    routes = []
    seen = set()
    for r in app.routes:
        methods = getattr(r, "methods", None)
        path = getattr(r, "path", "")
        if methods and path.startswith("/api"):
            for m in methods:
                if m == "HEAD":
                    continue
                key = (m, path)
                if key not in seen:
                    seen.add(key)
                    routes.append({"method": m, "path": path})
    routes.sort(key=lambda x: (x["path"], x["method"]))
    return {"total": len(routes), "items": routes}


@app.get("/api/health", tags=["系统"])
def health_check():
    """健康检查接口"""
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
    }


"""
应用核心配置
所有配置项通过环境变量覆盖，默认值用于本地开发
"""
