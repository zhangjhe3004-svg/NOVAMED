"""
插件管理器 —— 移植 NocoBase 的「自注册插件 + 生命周期」模式

通俗理解：把系统里的一个功能模块（患者管理、就诊记录、AI诊断、知识库…）看成一个「插件」。
每个插件有统一的生命周期钩子（afterAdd / beforeLoad / load / install / afterEnable / afterDisable / remove），
由 PluginManager 统一注册、启停、加载。

用法：
├── 定义插件：继承 Plugin 基类，设置 name / display_name / description / version / router
├── 注册插件：manager.register(MyPlugin())
├── 加载插件：manager.beforeLoad(); manager.load()   # 启动时由 main.py 在 lifespan 中调用
├── 启停插件：manager.enable(name) / manager.disable(name) / manager.list()
└── 挂载路由：PluginManager.mount(app) 会把所有已启用插件持有 router 挂到 FastAPI app

与 NocoBase 的对应：
├── Plugin 类 → @nocobase/server 的 Plugin
├── PluginManager → 插件管理器（插件市场）
├── 生命周期钩子 → afterAdd/beforeLoad/load/install/afterEnable/afterDisable/remove
└── router 持有 → 前端页面区块/路由由插件注册
"""
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)


class Plugin:
    """
    插件基类（对齐 NocoBase Plugin 生命周期）。

    子类只需覆盖需要关心的钩子；未覆盖的钩子为空实现。
    """

    name: str = ""
    display_name: str = ""
    description: str = ""
    version: str = "1.0.0"
    # 可选：插件持有的 FastAPI router（在 load 时由 PluginManager.mount 挂载）
    router: Optional[object] = None
    # 是否启用（可在启动前由配置/接口修改）
    enabled: bool = True

    async def afterAdd(self):  # noqa: N802 —— 与 NocoBase 钩子命名保持一致
        """插件被注册后调用"""
        return None

    async def beforeLoad(self):  # noqa: N802
        """加载前调用"""
        return None

    async def load(self):  # noqa: N802
        """加载时调用（业务初始化）"""
        return None

    async def install(self):  # noqa: N802
        """安装时调用（建表/初始化数据）"""
        return None

    async def afterEnable(self):  # noqa: N802
        """启用后调用"""
        return None

    async def afterDisable(self):  # noqa: N802
        """禁用后调用"""
        return None

    async def remove(self):  # noqa: N802
        """移除时调用（卸载清理）"""
        return None


class PluginManager:
    """
    插件注册表（对齐 NocoBase 插件管理器）。
    """

    def __init__(self):
        self._plugins: dict[str, Plugin] = {}
        self._order: List[str] = []

    def register(self, plugin: Plugin) -> Plugin:
        """注册一个插件（同名覆盖）"""
        self._plugins[plugin.name] = plugin
        if plugin.name not in self._order:
            self._order.append(plugin.name)
        logger.info(f"[插件] 已注册: {plugin.name}")
        return plugin

    def get(self, name: str) -> Optional[Plugin]:
        return self._plugins.get(name)

    def is_enabled(self, name: str) -> bool:
        p = self.get(name)
        return bool(p and p.enabled)

    def enable(self, name: str) -> Optional[Plugin]:
        p = self.get(name)
        if p and not p.enabled:
            p.enabled = True
            logger.info(f"[插件] 启用: {name}")
        return p

    def disable(self, name: str) -> Optional[Plugin]:
        p = self.get(name)
        if p and p.enabled:
            p.enabled = False
            logger.info(f"[插件] 禁用: {name}")
        return p

    def list(self) -> List[Plugin]:
        """按注册顺序返回所有插件"""
        return [self._plugins[n] for n in self._order if n in self._plugins]

    def active(self) -> List[Plugin]:
        """返回已启用插件"""
        return [p for p in self.list() if p.enabled]

    async def beforeLoad(self):  # noqa: N802
        for p in self.list():
            await p.beforeLoad()

    async def load(self):  # noqa: N802
        """加载所有启用插件的 load 钩子"""
        for p in self.active():
            await p.load()
            logger.info(f"[插件] 已加载: {p.name}")

    def mount(self, app):
        """
        把所有已启用、且持有 router 的插件挂载到 FastAPI app。

        注意：会在应用启动（lifespan）时调用，保证启用状态在启动时生效（与 NocoBase 启动时启用插件一致）。
        """
        for p in self.active():
            if p.router is not None:
                app.include_router(p.router)
                logger.info(f"[插件] 已挂载路由: {p.name}")


# 全局单例
plugin_manager = PluginManager()
