"""
内置插件注册 —— 把系统各功能模块注册为 NocoBase 风格插件

每个插件 = 一个持有 FastAPI router 的功能模块。启停状态持久化到 backend/data/plugins_state.json，
在应用启动时生效（与 NocoBase 「启动时启用插件」一致）。

对应关系：
├── auth（认证）        → api/auth.py 的 login/register/reset
├── users（用户管理）   → api/auth.py 的 admin_router（/api/users）
├── patients（患者管理）→ api/patients.py
├── records（就诊记录） → api/records.py
├── ai（AI诊断）        → api/ai.py
├── memory（用户记忆）  → api/memory.py
├── knowledge（知识库） → api/knowledge.py
└── ai_keys（AI服务商） → api/ai_keys.py
"""
import json
import logging
from pathlib import Path

from .plugin_manager import Plugin, PluginManager, plugin_manager

logger = logging.getLogger(__name__)

# backend/data/plugins_state.json
_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
_STATE_FILE = _DATA_DIR / "plugins_state.json"


def _load_state() -> dict:
    if _STATE_FILE.exists():
        try:
            return json.loads(_STATE_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def _save_state(state: dict):
    try:
        _DATA_DIR.mkdir(parents=True, exist_ok=True)
        _STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass


class SimplePlugin(Plugin):
    """轻量插件：只持有 router 与元数据"""

    def __init__(self, name: str, display_name: str, description: str, router, version: str = "1.0.0"):
        self.name = name
        self.display_name = display_name
        self.description = description
        self.version = version
        self.router = router
        self.enabled = True


def register_builtin_plugins(mgr: PluginManager) -> None:
    """注册所有内置插件，并应用持久化的启停状态（默认全部启用）"""
    from ..api import auth, patients, records, ai, memory, knowledge
    from ..api.ai_keys import router as ai_keys_router
    from ..api.dyn import router as dyn_router
    from ..api.pages import router as pages_router
    from ..api.acl import router as acl_router
    from ..api.biz_workflow import router as wf_router
    from ..api.schedule import router as schedule_router
    from ..api.supervision import router as supervision_router
    from ..api.pharmacy import router as pharmacy_router
    from ..api.billing import router as billing_router
    from ..api.labtest import router as labtest_router
    from ..api.analytics import router as analytics_router
    from ..api.tasks import router as tasks_router
    from ..api.roles import router as roles_router

    definitions = [
        ("auth", "认证", "登录/注册/重置密码/JWT 令牌", auth.router),
        ("users", "用户管理", "管理员进行用户列表/角色切换/禁用启用/密码重置", auth.admin_router),
        ("patients", "患者管理", "患者档案 CRUD/搜索/分页/病史时间线", patients.router),
        ("records", "就诊记录", "就诊记录 CRUD/AI审核/混合搜索", records.router),
        ("ai", "AI 诊断", "规则引擎/相似病例/知识库/防幻觉验证/云端CoT", ai.router),
        ("memory", "用户记忆", "用户行为记录与个性化推荐", memory.router),
        ("knowledge", "知识库", "医学文档 CRUD/分类检索/混合搜索", knowledge.router),
        ("ai_keys", "AI 服务商", "API Key 配置（OpenAI/DeepSeek/千问/Claude）", ai_keys_router),
        # 员工域低代码引擎（NocoBase 风格）
        ("dyn", "动态数据源", "集合管理：元数据建集合/物理建表/自动CRUD", dyn_router),
        ("pages", "低代码页面", "页面 Schema 构建器：页面由配置驱动渲染", pages_router),
        ("acl", "数据权限", "角色×集合×动作×行范围 的数据权限规则", acl_router),
        ("workflow", "业务工作流", "通用流程引擎：请假审批等（区别于 AI 诊断工作流）", wf_router),
        ("schedule", "号源排班", "医生号源排班与真实放号/扣号（对接预约挂号）", schedule_router),
        ("supervision", "下级审阅", "上级分配下级医生 / 查看与审阅责任链内下级就诊记录", supervision_router),
        ("pharmacy", "药房管理", "药品库存 CRUD/库存预警/入库出库调整", pharmacy_router),
        ("billing", "财务收费", "收费记录 CRUD/收费统计/退费", billing_router),
        ("labtest", "检查检验", "检查项目 CRUD/状态流转/结果录入/统计", labtest_router),
        ("analytics", "运营数据", "患者/就诊/预约/收费/检查多维运营指标聚合", analytics_router),
        ("tasks", "定时任务", "任务 CRUD/后台调度执行/站内提醒", tasks_router),
        ("roles", "角色管理", "角色 CRUD/菜单授权/权限矩阵数据源（sys_roles + sys_role_menus）", roles_router),
    ]

    state = _load_state()
    for name, display_name, description, router in definitions:
        plugin = SimplePlugin(name, display_name, description, router)
        # 应用持久化启停状态（缺省启用）
        plugin.enabled = state.get(name, True)
        mgr.register(plugin)
