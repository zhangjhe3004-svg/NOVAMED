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
from .api.login_logs import router as login_logs_router
from .api.notification import router as notification_router
from .api.message import router as message_router
from .api.appointment import router as appointment_router
from .api.patient_account import router as patient_account_router
from .api.patient_auth import router as patient_auth_router
from .api.storage import router as storage_router
from .api.nearby import router as nearby_router
from .api.permissions import router as permissions_router
from .core.dependencies import get_current_user
from .core.security_headers import SecurityHeadersMiddleware
from .core.rate_limit import RateLimitMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期"""
    # === 启动时 ===
    print("=" * 50)
    print(f"  {settings.APP_NAME} v{settings.APP_VERSION}")
    print("=" * 50)

    # 安全基线提示
    if settings.SECRET_KEY == "change-this-to-a-random-secret-key-in-production":
        print("[安全警告] SECRET_KEY 仍为默认值，生产环境必须通过环境变量覆盖")
    if not settings.FERNET_KEY:
        print("[安全提示] 未配置 FERNET_KEY，PHI 字段级加密未启用（开发模式可接受）")

    # 1. 初始化SQLite数据库
    init_db()
    print("[启动] SQLite 数据库已初始化")

    # 1a. 启动定时任务后台调度线程
    try:
        from .api.tasks import start_scheduler
        start_scheduler()
        print("[启动] 定时任务调度线程已启动")
    except Exception as e:
        print(f"[启动] 定时任务调度线程启动失败: {e}")

    # 1b. 初始化多租户数据存储库
    try:
        from .core.storage_db import init_storage_db
        init_storage_db()
        print("[启动] 多租户数据存储库已初始化")
    except Exception as e:
        print(f"[启动] 数据存储库初始化失败: {e}")

    # 2. 确保默认管理员存在
    _ensure_default_admin()

    # 2a. 确保演示员工账号存在（责任链层级）
    _ensure_demo_staff()
    _ensure_bulk_staff()

    # 2d. 确保演示号源存在（患者端预约挂号）
    _ensure_demo_schedules()

    # 2c. 确保默认数字权限级别（1-9）存在
    try:
        from .services.nearby_service import seed_permission_levels
        seed_permission_levels()
    except Exception as e:
        print(f"[警告] 数字权限级别初始化失败（不影响启动）: {e}")

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



def _ensure_demo_staff():
    """确保存在演示员工账号，便于体验「附近互传」与多人协作（上级默认不设置，按需在用户管理分配）。"""
    from .core.database import employee_session
    from .models.models import User, UserRole
    from .core.security import hash_password

    db = employee_session()
    try:
        # 管理员应为最高数字权限级别（九级·超级管理员）
        admin = db.query(User).filter(User.username == "admin").first()
        if admin and admin.auth_level != 9:
            admin.auth_level = 9
            db.commit()

        demo_users = [
            dict(username="zhangys", real_name="张伟", role=UserRole.DOCTOR, department="内科", title="主任医师", auth_level=5),
            dict(username="liyf", real_name="李芳", role=UserRole.DOCTOR, department="外科", title="副主任医师", auth_level=4),
            dict(username="wangq", real_name="王强", role=UserRole.NURSE, department="内科", title="主管护师", auth_level=3),
            dict(username="zhaom", real_name="赵敏", role=UserRole.STAFF, department="药房", title="药师", auth_level=2),
        ]
        created = 0
        for u in demo_users:
            existing = db.query(User).filter(User.username == u["username"]).first()
            if existing:
                continue
            db.add(User(
                username=u["username"],
                hashed_password=hash_password("123456"),
                real_name=u["real_name"],
                role=u["role"],
                department=u["department"],
                title=u["title"],
                auth_level=u["auth_level"],
                superior_id=None,  # 上级默认不设置，由管理员在用户管理页按需分配
                work_status="在职",
            ))
            created += 1
        db.commit()
        print(f"[初始化] 演示员工账号已就绪（新增 {created} 个：zhangys/liyf/wangq/zhaom，密码 123456）")
    finally:
        db.close()


def _ensure_bulk_staff():
    """创建批量演示员工 admin01..admin10（密码同名），并按科室分配，便于患者端预约挂号体验。"""
    from .core.database import employee_session
    from .models.models import User, UserRole
    from .core.security import hash_password

    departments = ["内科", "外科", "儿科", "妇产科", "骨科", "眼科", "耳鼻喉科", "皮肤科", "神经内科", "心血管内科"]
    titles = ["主任医师", "副主任医师", "主治医师"]

    db = employee_session()
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        created = 0
        for i in range(1, 11):
            username = f"admin{i:02d}"
            dept = departments[(i - 1) % len(departments)]
            user = db.query(User).filter(User.username == username).first()
            if not user:
                db.add(User(
                    username=username,
                    hashed_password=hash_password(username),
                    real_name=f"员工{i}号",
                    role=UserRole.DOCTOR,
                    department=dept,
                    title=titles[(i - 1) % len(titles)],
                    auth_level=2,
                    superior_id=None,  # 上级默认不设置，由管理员在用户管理页按需分配
                    work_status="在职",
                ))
                created += 1
            else:
                if not user.department:
                    user.department = dept
                if not user.title:
                    user.title = titles[(i - 1) % len(titles)]
                if user.role != UserRole.DOCTOR:
                    user.role = UserRole.DOCTOR
        db.commit()
        print(f"[初始化] 批量演示员工已就绪（新增 {created} 个，admin01..admin10，密码同名）")
    finally:
        db.close()


def _ensure_demo_schedules():
    """确保演示号源存在（按员工真实 ID 生成，并清理失效号源），便于患者端预约挂号体验。"""
    import datetime
    from .core.database import patient_session, employee_session
    from .models.models import DoctorSchedule, User, UserRole

    edb = employee_session()
    try:
        staff = edb.query(User).filter(User.role != UserRole.ADMIN, User.is_active == True).all()
        staff_map = {u.username: u for u in staff}
        valid_ids = {u.id for u in staff}
    finally:
        edb.close()

    plans = []
    for username, dept, dates, slots in [
        ("zhangys", "内科", 2, ["08:00-09:00", "09:00-10:00", "10:00-11:00"]),
        ("liyf", "外科", 3, ["09:00-10:00", "14:00-15:00"]),
        ("wangq", "内科", 2, ["10:00-11:00", "15:00-16:00"]),
    ]:
        u = staff_map.get(username)
        if u:
            plans.append((u.id, dept, dates, slots))
    for i in range(1, 11):
        username = f"admin{i:02d}"
        u = staff_map.get(username)
        if u and u.department:
            plans.append((u.id, u.department, 3, ["08:00-09:00", "09:00-10:00", "10:00-11:00", "14:00-15:00"]))

    db = patient_session()
    try:
        orphan_ids = {did for (did,) in db.query(DoctorSchedule.doctor_id).distinct().all() if did not in valid_ids}
        if orphan_ids:
            db.query(DoctorSchedule).filter(DoctorSchedule.doctor_id.in_(orphan_ids)).delete(synchronize_session=False)
            db.commit()

        today = datetime.date.today()
        added = 0
        for doctor_id, dept, dates, slots in plans:
            for i in range(dates):
                day = (today + datetime.timedelta(days=i)).strftime("%Y-%m-%d")
                for slot in slots:
                    exists = db.query(DoctorSchedule).filter(
                        DoctorSchedule.doctor_id == doctor_id,
                        DoctorSchedule.date == day,
                        DoctorSchedule.time_slot == slot,
                    ).first()
                    if exists:
                        continue
                    db.add(DoctorSchedule(
                        doctor_id=doctor_id,
                        date=day,
                        time_slot=slot,
                        department=dept,
                        total=10,
                        remaining=10,
                    ))
                    added += 1
        db.commit()
        if added:
            print(f"[初始化] 演示号源已同步（新增 {added} 个号源）")
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

# CORS 跨域配置（鉴权走 Bearer header，无需 cookie 凭据；多机并发允许任意来源）
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 医院级安全加固：安全响应头 + 认证接口限流（最外层，保证错误响应也带安全头）
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)

# 系统级路由（始终挂载，不随插件启停）
app.include_router(plugins_router)  # 插件管理（/api/plugins）
app.include_router(token_usage_router)  # Token 用量统计（/api/token-usage）
app.include_router(conversation_router)  # 会话管理（/api/conversations）
app.include_router(audit_router)  # 审计日志（/api/audit-logs）
app.include_router(login_logs_router)  # 登录日志（/api/login-logs）
app.include_router(notification_router)  # 通知（/api/notifications）
app.include_router(message_router)  # 员工消息（/api/messages）
app.include_router(appointment_router)  # 预约挂号（/api/appointments）
app.include_router(patient_account_router)  # 患者注册（/api/patient-register）
app.include_router(patient_auth_router)  # 患者端认证（/api/patient-auth）
app.include_router(storage_router)  # 多租户数据存储服务（/api/storage）
app.include_router(nearby_router)  # 附近协作与数字权限（/api/nearby）
app.include_router(permissions_router)  # 权限关系图（/api/permissions/graph）

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
