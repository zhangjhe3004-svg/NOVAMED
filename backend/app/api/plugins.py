"""
插件管理 API（系统级，始终挂载）—— /api/plugins
"""
from fastapi import APIRouter, Depends

from ..core.plugin_manager import plugin_manager
from ..core.plugins import _save_state, _load_state
from ..core.dependencies import require_admin

router = APIRouter(prefix="/api/plugins", tags=["插件管理"])


def _current_state() -> dict:
    return {p.name: p.enabled for p in plugin_manager.list()}


@router.get("")
def list_plugins(_=Depends(require_admin)):
    plugins = [
        {
            "name": p.name,
            "display_name": p.display_name,
            "description": p.description,
            "version": p.version,
            "enabled": p.enabled,
        }
        for p in plugin_manager.list()
    ]
    return {"total": len(plugins), "plugins": plugins}


@router.post("/{name}/enable")
def enable_plugin(name: str, _=Depends(require_admin)):
    p = plugin_manager.get(name)
    if not p:
        return {"detail": "插件不存在"}
    plugin_manager.enable(name)
    _save_state(_current_state())
    return {"name": name, "enabled": True, "note": "重启后生效"}


@router.post("/{name}/disable")
def disable_plugin(name: str, _=Depends(require_admin)):
    p = plugin_manager.get(name)
    if not p:
        return {"detail": "插件不存在"}
    plugin_manager.disable(name)
    _save_state(_current_state())
    return {"name": name, "enabled": False, "note": "重启后生效"}
