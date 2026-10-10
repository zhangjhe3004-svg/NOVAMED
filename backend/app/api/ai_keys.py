"""
AI 服务商 API Key 配置 —— /api/ai-keys
"""
import json
from pathlib import Path
from fastapi import APIRouter, Depends

from ..core.dependencies import require_admin

router = APIRouter(prefix="/api/ai-keys", tags=["AI 服务商"])

_KEYS_FILE = Path(__file__).resolve().parents[2] / "data" / "ai_keys.json"


def _load() -> dict:
    if _KEYS_FILE.exists():
        try:
            return json.loads(_KEYS_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def _save(data: dict):
    _KEYS_FILE.parent.mkdir(parents=True, exist_ok=True)
    _KEYS_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


@router.get("")
def list_keys(_=Depends(require_admin)):
    data = _load()
    return {"keys": [{"provider": k, "configured": bool(v.get("api_key"))} for k, v in data.items()]}


@router.post("/{provider}")
def save_key(provider: str, payload: dict, _=Depends(require_admin)):
    data = _load()
    data[provider] = payload
    _save(data)
    return {"provider": provider, "configured": True}
