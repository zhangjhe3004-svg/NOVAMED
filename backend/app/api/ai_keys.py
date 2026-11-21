"""
AI 服务商 API Key 配置 —— /api/ai-keys

迁移自 cc-switch：在原有 Key CRUD 基础上，补齐供应商切换、模型注入、真实测速、
模型聚合、个人偏好覆盖与路由配置能力。底层路由/注入逻辑见 services/ai_provider.py。

权限约定：
- Key / 路由 / 测速等管理类操作仅管理员（require_admin）。
- 模型聚合、个人偏好（仅本人）对任意登录用户开放（不暴露 Key）。
"""
import json
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..core.dependencies import get_current_user, require_admin
from ..services import ai_provider as svc

router = APIRouter(prefix="/api/ai-keys", tags=["AI 服务商"])

_KEYS_FILE = Path(__file__).resolve().parents[2] / "data" / "ai_keys.json"


# ---------------- 兼容旧读写（供可能的外部引用，底层已下沉到服务层） ----------------

def _load() -> dict:
    return svc.load_keys()


def _save(data: dict):
    svc.save_keys(data)


# ---------------- 请求/响应模型 ----------------

class SaveKeyPayload(BaseModel):
    provider: Optional[str] = None
    api_key: Optional[str] = None
    name: Optional[str] = None
    model: Optional[str] = None
    models: Optional[list[str]] = None
    request_url: Optional[str] = None
    base_url: Optional[str] = None
    auth_header: Optional[str] = None
    stream: Optional[bool] = None
    enabled: Optional[bool] = None
    priority: Optional[int] = None
    access: Optional[str] = None


class ActivePayload(BaseModel):
    provider: str
    model: Optional[str] = None


class RoutingPayload(BaseModel):
    active_provider: Optional[str] = None
    active_model: Optional[str] = None
    failover_enabled: Optional[bool] = None
    max_attempts: Optional[int] = None
    system_prompts: Optional[dict] = None


class PreferencePayload(BaseModel):
    active_provider: Optional[str] = None
    active_model: Optional[str] = None


# ---------------- 校验 ----------------

def _validate_provider_key(provider: str) -> str:
    p = (provider or "").strip().lower()
    if not p:
        raise HTTPException(422, "provider 不能为空")
    if len(p) > 50 or any(ch in p for ch in " \t\r\n/"):
        raise HTTPException(422, "provider 须为不含空格与斜杠的短标识")
    return p


def _validate_models(models) -> list[str]:
    if models is None:
        return []
    if isinstance(models, str):
        models = [m.strip() for m in models.split(",") if m.strip()]
    out = []
    for m in models:
        s = str(m).strip()
        if not s:
            continue
        if len(s) > 200:
            raise HTTPException(422, f"模型名过长：{s[:20]}…")
        out.append(s)
    return out


def _validate_priority(priority) -> int:
    if priority is None:
        return 100
    try:
        p = int(priority)
    except (TypeError, ValueError):
        raise HTTPException(422, "priority 必须为整数")
    if p < 0 or p > 9999:
        raise HTTPException(422, "priority 须在 0~9999 之间")
    return p


def _validate_access(access) -> str:
    if access is None:
        return "direct"
    a = str(access).strip().lower()
    if a not in svc.ACCESS_MODES:
        raise HTTPException(422, f"access 须为 {sorted(svc.ACCESS_MODES)} 之一")
    return a


def _serialize_key(provider: str, entry: dict, routing: dict) -> dict:
    """把存储条目转为接口返回结构（含路由态，脱敏不返回 key 原文）。"""
    e = svc.normalize_entry(provider, entry)
    active = (routing.get("active_provider") or "").strip().lower()
    return {
        "provider": e["provider"],
        "name": e["name"],
        "model": e["active_model"] or e["model"],
        "models": e["models"],
        "request_url": e["request_url"],
        "configured": bool(e["api_key"]),
        "enabled": e["enabled"],
        "priority": e["priority"],
        "access": e["access"],
        "is_active": e["provider"] == active,
    }


# ---------------- 路由 ----------------

@router.get("")
def list_keys(_=Depends(require_admin)):
    data = svc.load_keys()
    routing = svc.load_routing()
    active = (routing.get("active_provider") or "").strip().lower()
    # 激活供应商不存在时，自动落到第一个可用者（仅返回态，不落盘）
    keys = [
        _serialize_key(k, v, routing)
        for k, v in data.items() if isinstance(v, dict)
    ]
    if active and not any(k["provider"] == active for k in keys):
        first = next((k for k in keys if k["configured"] and k["enabled"]), None)
        if first:
            for k in keys:
                k["is_active"] = k["provider"] == first["provider"]
    return {
        "keys": keys,
        "routing": {
            "active_provider": active,
            "active_model": routing.get("active_model"),
            "failover_enabled": routing.get("failover_enabled", True),
            "max_attempts": routing.get("max_attempts", 0),
        },
    }


@router.post("/{provider}")
def save_key(provider: str, payload: SaveKeyPayload, _=Depends(require_admin)):
    provider = _validate_provider_key(provider)
    data = svc.load_keys()
    existing = data.get(provider)
    # merge 语义：只覆盖 payload 显式出现的字段，保留 workbuddy 等特殊字段
    merged = {**(existing if isinstance(existing, dict) else {})}
    for field in ("api_key", "name", "model", "request_url", "base_url", "auth_header"):
        v = getattr(payload, field)
        if v is not None:
            merged[field] = v
    if payload.stream is not None:
        merged["stream"] = bool(payload.stream)
    if payload.enabled is not None:
        merged["enabled"] = bool(payload.enabled)
    if payload.models is not None:
        merged["models"] = _validate_models(payload.models)
    if payload.priority is not None:
        merged["priority"] = _validate_priority(payload.priority)
    if payload.access is not None:
        merged["access"] = _validate_access(payload.access)
    # 模型切换：model 显式给定时同时作为 active_model
    if payload.model is not None and payload.model:
        merged.setdefault("model", payload.model)
        merged["active_model"] = payload.model

    # 校验：新增时 api_key 必填；request_url 可为空（走 PROVIDER_META 兜底）
    if not existing and not (merged.get("api_key") or "").strip():
        raise HTTPException(422, "新增供应商须提供 api_key")

    merged["provider"] = provider
    data[provider] = merged
    svc.save_keys(data)
    return {"provider": provider, "configured": bool((merged.get("api_key") or "").strip())}


@router.delete("/{provider}")
def delete_key(provider: str, _=Depends(require_admin)):
    provider = _validate_provider_key(provider)
    data = svc.load_keys()
    if provider not in data:
        return {"provider": provider, "configured": False, "deleted": False}
    del data[provider]
    svc.save_keys(data)
    # 若删除的是激活供应商，一并清空激活态，避免悬空引用
    routing = svc.load_routing()
    if (routing.get("active_provider") or "").strip().lower() == provider:
        routing["active_provider"] = None
        routing["active_model"] = None
        svc.save_routing(routing)
    return {"provider": provider, "configured": False, "deleted": True}


@router.get("/routing")
def get_routing(_=Depends(require_admin)):
    return svc.load_routing()


@router.put("/routing")
def update_routing(payload: RoutingPayload, _=Depends(require_admin)):
    routing = svc.load_routing()
    if payload.active_provider is not None:
        routing["active_provider"] = _validate_provider_key(payload.active_provider)
    if payload.active_model is not None:
        routing["active_model"] = (payload.active_model or "").strip() or None
    if payload.failover_enabled is not None:
        routing["failover_enabled"] = bool(payload.failover_enabled)
    if payload.max_attempts is not None:
        try:
            routing["max_attempts"] = max(0, int(payload.max_attempts))
        except (TypeError, ValueError):
            raise HTTPException(422, "max_attempts 必须为整数")
    if payload.system_prompts is not None:
        routing["system_prompts"] = {k: str(v) for k, v in payload.system_prompts.items()}
    svc.save_routing(routing)
    return {"detail": "ok", "routing": routing}


@router.put("/active")
def set_active(payload: ActivePayload, _=Depends(require_admin)):
    """切换激活供应商/模型（Switch + Model Injection 的落点）。"""
    provider = _validate_provider_key(payload.provider)
    data = svc.load_keys()
    entry = data.get(provider)
    if not isinstance(entry, dict):
        raise HTTPException(404, f"供应商 {provider} 不存在")
    if not (entry.get("api_key") or "").strip():
        raise HTTPException(422, f"供应商 {provider} 尚未配置 API Key")
    routing = svc.load_routing()
    routing["active_provider"] = provider
    model = (payload.model or "").strip() or None
    routing["active_model"] = model
    if model:
        entry["active_model"] = model
        data[provider] = entry
        svc.save_keys(data)
    svc.save_routing(routing)
    return {"detail": "ok", "active_provider": provider, "active_model": model}


@router.get("/models")
def list_models(_=Depends(get_current_user)):
    """模型聚合：合并所有启用供应商的模型（供前端模型选择器）。"""
    return {"models": svc.list_models()}


@router.post("/{provider}/test")
def test_provider(provider: str, _=Depends(require_admin)):
    """真实连通性测速（替代原「示例」实现）。"""
    provider = _validate_provider_key(provider)
    return svc.test_provider(provider)


@router.put("/me/preference")
def set_preference(payload: PreferencePayload, user=Depends(get_current_user)):
    """个人偏好覆盖：仅作用于本人发起的分析，覆盖系统默认供应商/模型。"""
    routing = svc.load_routing()
    overrides = routing.get("user_overrides") or {}
    ov = overrides.get(str(user.id))
    if not isinstance(ov, dict):
        ov = {}
    if payload.active_provider is not None:
        ov["active_provider"] = _validate_provider_key(payload.active_provider)
    if payload.active_model is not None:
        ov["active_model"] = (payload.active_model or "").strip() or None
    overrides[str(user.id)] = ov
    routing["user_overrides"] = overrides
    svc.save_routing(routing)
    return {"detail": "ok", "preference": ov}
