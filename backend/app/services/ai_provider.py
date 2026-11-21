"""
AI 服务商路由与模型注入服务 —— /services/ai_provider.py

迁移自 cc-switch（https://github.com/farion1231/cc-switch）的核心能力，并在
保持 NOVAMED 现有 `data/ai_keys.json` 约定不变的前提下落地：

  1. 供应商切换（Switch）            —— active_provider 互斥激活，持久化到 data/ai_routing.json
  2. 模型注入（Model Injection）      —— 每个供应商维护 models[]/active_model，请求时注入 model
  3. 故障转移（Failover）             —— 按 priority 依次尝试，失败自动切换下一家可用供应商
  4. 模型聚合（Aggregation）          —— list_models() 合并所有启用供应商的模型为一个列表
  5. 系统提示词注入（System Prompt）   —— 按场景（agent/analyze/diagnose）从 ai_routing.json 注入
  6. 个人偏好覆盖（Per-user Override） —— user_overrides 允许个人覆盖系统默认供应商/模型

约定：
- Key 文件：backend/data/ai_keys.json（与 ai_keys.py 共用，保持原结构 + 可选扩展字段）
- 路由文件：backend/data/ai_routing.json（新增，缺省自动创建）
- 模型调用走 OpenAI 兼容协议 /chat/completions，标准库 urllib 完成，不引入额外依赖。
"""
import json
import logging
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# 与 ai_keys.py 共用同一份 Key 文件（管理员在「设置 → API 密钥」配置）
_KEYS_FILE = Path(__file__).resolve().parents[2] / "data" / "ai_keys.json"
_ROUTING_FILE = Path(__file__).resolve().parents[2] / "data" / "ai_routing.json"

# 服务商：OpenAI 兼容接口地址 + 默认模型（未在 Key 里显式指定时用）。
# 与前端 config/aiProviders.tsx 的 key 对齐。
PROVIDER_META: dict[str, tuple[str, str]] = {
    # —— 中国 · 对话模型 ——
    "deepseek": ("https://api.deepseek.com/v1", "deepseek-chat"),
    "qwen":     ("https://dashscope.aliyuncs.com/compatible-mode/v1", "qwen-plus"),
    "kimi":     ("https://api.moonshot.cn/v1", "moonshot-v1-8k"),
    "moonshot": ("https://api.moonshot.cn/v1", "moonshot-v1-8k"),
    "glm":      ("https://open.bigmodel.cn/api/paas/v4", "glm-4-flash"),
    "zhipu":    ("https://open.bigmodel.cn/api/paas/v4", "glm-4-flash"),
    "chatglm":  ("https://open.bigmodel.cn/api/paas/v4", "glm-4-flash"),
    "baichuan": ("https://api.baichuan-ai.com/v1", "Baichuan4-Turbo"),
    "baidu":    ("https://qianfan.baidubce.com/v2", "ernie-4.0-turbo-8k"),
    "wenxin":   ("https://qianfan.baidubce.com/v2", "ernie-4.0-turbo-8k"),
    "hunyuan":  ("https://api.hunyuan.cloud.tencent.com/v1", "hunyuan-lite"),
    "tencent":  ("https://api.hunyuan.cloud.tencent.com/v1", "hunyuan-lite"),
    "doubao":   ("https://ark.cn-beijing.volces.com/api/v3", "doubao-1-5-pro-32k-250115"),
    "volcengine": ("https://ark.cn-beijing.volces.com/api/v3", "doubao-1-5-pro-32k-250115"),
    "minimax":  ("https://api.minimax.chat/v1", "abab6.5s-chat"),
    "yi":       ("https://api.lingyiwanwu.com/v1", "yi-large"),
    "zeroone":  ("https://api.lingyiwanwu.com/v1", "yi-large"),
    "stepfun":  ("https://api.stepfun.com/v1", "step-1-8k"),
    "spark":    ("https://spark-api-open.xf-yun.com/v1", "generalv3.5"),
    "iflytek":  ("https://spark-api-open.xf-yun.com/v1", "generalv3.5"),
    "sensenova": ("https://api.sensenova.cn/compatible-mode/v1", "SenseChat-5"),
    # —— 国际 · 对话模型 ——
    "openai":   ("https://api.openai.com/v1", "gpt-4o-mini"),
    "claude":   ("https://api.anthropic.com/v1", "claude-3-5-haiku-latest"),
    "anthropic": ("https://api.anthropic.com/v1", "claude-3-5-haiku-latest"),
    "gemini":   ("https://generativelanguage.googleapis.com/v1beta/openai", "gemini-1.5-flash"),
    "grok":     ("https://api.x.ai/v1", "grok-beta"),
    "xai":      ("https://api.x.ai/v1", "grok-beta"),
    "mistral":  ("https://api.mistral.ai/v1", "mistral-small-latest"),
    "cohere":   ("https://api.cohere.com/v2", "command-r-plus"),
    "perplexity": ("https://api.perplexity.ai", "sonar"),
    "together": ("https://api.together.xyz/v1", "meta-llama/Llama-3.3-70B-Instruct-Turbo"),
    "groq":     ("https://api.groq.com/openai/v1", "llama-3.3-70b-versatile"),
    "reka":     ("https://api.reka.ai", "reka-flash"),
    "ai21":     ("https://api.ai21.com/studio/v1", "jamba-1.5-mini"),
    "upstage":  ("https://api.upstage.ai/v1", "solar-1-mini-chat"),
    "deepinfra": ("https://api.deepinfra.com/v1", "meta-llama/Llama-3.3-70B-Instruct-Turbo"),
    "fireworks": ("https://api.fireworks.ai/inference/v1", "accounts/fireworks/models/llama-v3p1-70b-instruct"),
    "sambanova": ("https://api.sambanova.ai/v1", "Meta-Llama-3.3-70B-Instruct"),
    "nebius":   ("https://api.nebius.ai/v1", "meta-llama/Llama-3.3-70B-Instruct"),
    # —— 本地 · 聚合 / 代理 ——
    "siliconcloud": ("https://api.siliconflow.cn/v1", "Qwen/Qwen2.5-7B-Instruct"),
    "modelscope": ("https://api-inference.modelscope.cn/v1", "Qwen/Qwen2.5-7B-Instruct"),
    "openrouter": ("https://openrouter.ai/api/v1", "openai/gpt-4o-mini"),
    "ollama":   ("http://localhost:11434/v1", "llama3.2"),
    "lmstudio": ("http://localhost:1234/v1", "local-model"),
    "vllm":     ("http://localhost:8000/v1", "local-model"),
    "xinference": ("http://localhost:9997/v1", "local-model"),
    "hyperbolic": ("https://api.hyperbolic.xyz/v1", "meta-llama/Llama-3.3-70B-Instruct"),
}

# 可用接入方式（校验用，与前端「直连/代理」对齐）
ACCESS_MODES = {"direct", "proxy", "routing", "aggregation"}


# ==================== 配置读写 ====================

def load_keys() -> dict:
    """读取 ai_keys.json（结构：{provider: {...}}）。"""
    if _KEYS_FILE.exists():
        try:
            return json.loads(_KEYS_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_keys(data: dict) -> None:
    _KEYS_FILE.parent.mkdir(parents=True, exist_ok=True)
    _KEYS_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _default_routing() -> dict:
    return {
        "active_provider": None,
        "active_model": None,
        "failover_enabled": True,
        "max_attempts": 0,          # 0 = 尝试所有可用供应商
        "system_prompts": {},       # {scenario: prompt}
        "user_overrides": {},       # {user_id: {active_provider, active_model}}
    }


def load_routing() -> dict:
    """读取 ai_routing.json，缺省返回默认结构（不落盘）。"""
    if _ROUTING_FILE.exists():
        try:
            data = json.loads(_ROUTING_FILE.read_text(encoding="utf-8"))
            base = _default_routing()
            base.update(data if isinstance(data, dict) else {})
            return base
        except Exception:
            return _default_routing()
    return _default_routing()


def save_routing(data: dict) -> None:
    base = _default_routing()
    base.update(data if isinstance(data, dict) else {})
    _ROUTING_FILE.parent.mkdir(parents=True, exist_ok=True)
    _ROUTING_FILE.write_text(json.dumps(base, ensure_ascii=False, indent=2), encoding="utf-8")


def get_system_prompt(scenario: str, default: str = "") -> str:
    """按场景取系统提示词：ai_routing.json 有覆盖则用之，否则回退内置默认。"""
    prompts = (load_routing().get("system_prompts") or {})
    return (prompts.get(scenario) or "").strip() or default


# ==================== 数据规整 ====================

def normalize_entry(key: str, entry: dict) -> dict:
    """把 ai_keys.json 中的一条记录规整为统一结构，缺失字段给默认值。"""
    provider = (entry.get("provider") or key or "").strip().lower()
    api_key = (entry.get("api_key") or "").strip()
    model = (entry.get("model") or "").strip()
    models = entry.get("models") or []
    if isinstance(models, str):
        models = [m.strip() for m in models.split(",") if m.strip()]
    models = [str(m).strip() for m in models if str(m).strip()]
    if model and model not in models:
        models = [model] + models
    if not models and model:
        models = [model]

    priority = entry.get("priority")
    try:
        priority = int(priority)
    except (TypeError, ValueError):
        priority = 100

    return {
        "provider": provider,
        "key": key,
        "name": (entry.get("name") or key or provider),
        "api_key": api_key,
        "model": model,
        "models": models,
        "active_model": (entry.get("active_model") or model or "").strip(),
        "request_url": (entry.get("request_url") or entry.get("base_url") or "").strip(),
        "auth_header": (entry.get("auth_header") or "").strip() or None,
        "stream": bool(entry.get("stream")),
        "enabled": bool(entry.get("enabled", True)),
        "priority": priority,
        "access": (entry.get("access") or "direct").strip(),
    }


def _ordered_entries(keys: dict) -> list[dict]:
    """所有供应商按 priority 升序（数字越小越优先）。"""
    entries = []
    for key, entry in (keys or {}).items():
        if not isinstance(entry, dict):
            continue
        entries.append(normalize_entry(key, entry))
    entries.sort(key=lambda e: (e["priority"], e["provider"]))
    return entries


def _find_entry(entries: list[dict], provider: str) -> Optional[dict]:
    p = (provider or "").strip().lower()
    for e in entries:
        if e["provider"] == p or e["key"] == p:
            return e
    return None


def _active_choice(user_id, requested_provider, requested_model, routing: dict):
    """计算当前生效的 (provider, model)：显式请求 > 个人偏好 > 系统默认。"""
    provider, model = None, None
    overrides = routing.get("user_overrides") or {}
    if user_id is not None:
        ov = overrides.get(str(user_id)) or overrides.get(user_id)
        if isinstance(ov, dict):
            provider = ov.get("active_provider") or None
            model = ov.get("active_model") or None
    if not provider:
        provider = routing.get("active_provider") or None
        model = routing.get("active_model") or None
    if requested_provider:
        provider = requested_provider
    if requested_model:
        model = requested_model
    return (provider or "").strip() or None, (model or "").strip() or None


# ==================== 路由 / 注入 / 聚合 ====================

def resolve_chain(user_id=None, requested_provider=None, requested_model=None,
                  keys: Optional[dict] = None, routing: Optional[dict] = None) -> list[dict]:
    """返回按优先级排好的「可用供应商链」（激活者优先，其余按 priority 追加），用于故障转移。

    每条元素包含：provider/key/label/base/model/models/api_key/auth_header/stream/priority。
    跳过：未启用、无 api_key、无请求地址的供应商。
    """
    keys = load_keys() if keys is None else keys
    routing = load_routing() if routing is None else routing
    active_provider, active_model = _active_choice(user_id, requested_provider, requested_model, routing)

    entries = _ordered_entries(keys)
    chain: list[dict] = []
    seen: set = set()

    def _build(e: dict, model_override: Optional[str]) -> Optional[dict]:
        base, fallback = PROVIDER_META.get(e["provider"], ("", ""))
        base = (e["request_url"] or base or "").rstrip("/")
        if not base or not e["api_key"] or not e["enabled"]:
            return None
        model = (model_override or e["active_model"] or e["model"] or fallback or "deepseek-chat").strip()
        return {
            "provider": e["provider"],
            "key": e["key"],
            "label": e["name"] or e["provider"],
            "base": base,
            "model": model,
            "models": e["models"] or [model],
            "api_key": e["api_key"],
            "auth_header": e["auth_header"],
            "stream": e["stream"],
            "priority": e["priority"],
        }

    if active_provider:
        e = _find_entry(entries, active_provider)
        if e:
            r = _build(e, active_model)
            if r:
                chain.append(r)
                seen.add(e["provider"])

    for e in entries:
        if e["provider"] in seen:
            continue
        r = _build(e, None)
        if r:
            chain.append(r)
            seen.add(e["provider"])

    return chain


def resolve_provider(user_id=None, requested_provider=None, requested_model=None,
                     keys: Optional[dict] = None, routing: Optional[dict] = None) -> Optional[dict]:
    """返回当前最佳（首个）可用供应商，兼容旧 _pick_provider 语义。"""
    chain = resolve_chain(user_id, requested_provider, requested_model, keys, routing)
    return chain[0] if chain else None


def _pick_provider(data: dict) -> Optional[dict]:
    """【兼容】旧逻辑：从 Key 文件挑第一个可用服务商。现已并入路由链语义。"""
    chain = resolve_chain(keys=data, routing=load_routing())
    return chain[0] if chain else None


def list_models(keys: Optional[dict] = None) -> list[dict]:
    """模型聚合：合并所有启用且已配 Key 的供应商模型为一个列表（按 priority 排序）。"""
    keys = load_keys() if keys is None else keys
    result: list[dict] = []
    for e in _ordered_entries(keys):
        if not e["enabled"] or not e["api_key"]:
            continue
        for m in (e["models"] or [e["model"]] or []):
            if not m:
                continue
            result.append({
                "provider": e["provider"],
                "provider_name": e["name"],
                "model": m,
                "is_active_model": m == (e["active_model"] or e["model"]),
            })
    return result


# ==================== 底层调用 ====================

def _apply_auth(req: urllib.request.Request, prov: dict) -> None:
    if prov.get("auth_header"):
        req.add_header(prov["auth_header"], prov["api_key"])
    else:
        req.add_header("Authorization", f"Bearer {prov['api_key']}")


def _chat(base: str, api_key: str, model: str, messages: list[dict], timeout: int = 40,
          auth_header: Optional[str] = None, stream: bool = False,
          temperature: float = 0.4, max_tokens: int = 800) -> str:
    """OpenAI 兼容 /chat/completions 单次调用，返回文本。"""
    base = (base or "").rstrip("/")
    url = base + "/chat/completions"
    body_obj: dict = {"model": model, "messages": messages, "temperature": temperature}
    if stream:
        body_obj["stream"] = True
    else:
        body_obj["max_tokens"] = max_tokens
    body = json.dumps(body_obj).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    prov = {"api_key": api_key, "auth_header": auth_header}
    _apply_auth(req, prov)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        if stream:
            return _parse_sse(resp)
        payload = json.loads(resp.read().decode("utf-8"))
    return (payload["choices"][0]["message"]["content"] or "").strip()


def _parse_sse(resp) -> str:
    """把 OpenAI 兼容 SSE 流逐帧拼接为完整文本（WorkBuddy 云端模型仅支持流式）。"""
    parts: list[str] = []
    for raw in resp:
        line = raw.decode("utf-8", "ignore").strip()
        if not line.startswith("data:"):
            continue
        data = line[5:].strip()
        if data == "[DONE]":
            break
        try:
            obj = json.loads(data)
        except Exception:
            continue
        for ch in obj.get("choices") or []:
            delta = ch.get("delta") or {}
            c = delta.get("content")
            if c:
                parts.append(c)
    return "".join(parts).strip()


def _extract_http_error(e: urllib.error.HTTPError) -> str:
    detail = ""
    try:
        detail = json.loads(e.read().decode("utf-8")).get("error", {}).get("message", "")
    except Exception:
        pass
    return f"返回 {e.code}" + (f"：{detail}" if detail else "")


def chat_with_failover(messages: list[dict], user_id=None, requested_provider=None,
                       requested_model=None, system_prompt: Optional[str] = None,
                       timeout: int = 40, max_attempts: int = 0) -> dict:
    """注入系统提示词 + 按路由链依次尝试（故障转移），返回 {content/provider/model/available/error}。"""
    if system_prompt:
        messages = [{"role": "system", "content": system_prompt}] + \
                   [m for m in messages if (m.get("role") or "") != "system"]
    routing = load_routing()
    chain = resolve_chain(user_id=user_id, requested_provider=requested_provider,
                          requested_model=requested_model, routing=routing)
    if not chain:
        return {"content": "", "provider": "", "model": "", "available": False,
                "error": "无可用供应商：请管理员在「设置 → API 密钥」配置并启用至少一家服务商。"}

    limit = max_attempts or (len(chain) if routing.get("failover_enabled", True) else 1)
    errors: list[str] = []
    attempted = 0
    for prov in chain[:limit]:
        attempted += 1
        try:
            content = _chat(prov["base"], prov["api_key"], prov["model"], messages,
                            timeout=timeout, auth_header=prov.get("auth_header"),
                            stream=prov.get("stream"))
            if content:
                return {"content": content, "provider": prov["label"], "model": prov["model"],
                        "available": True, "attempted": attempted, "error": ""}
            errors.append(f"{prov['label']}: 空响应")
        except urllib.error.HTTPError as e:
            errors.append(f"{prov['label']} {_extract_http_error(e)}")
        except Exception as e:
            errors.append(f"{prov['label']}: {e}")
        logger.warning("AI 供应商切换（故障转移）：%s", errors[-1])
    return {"content": "", "provider": "", "model": "", "available": False,
            "error": "；".join(errors), "attempted": attempted}


def test_provider(provider_key: str, keys: Optional[dict] = None) -> dict:
    """真实连通性测速：优先 GET /models，失败回退一次 1-token 的最小对话。

    返回 {provider/ok/latency_ms/method/models/error}，不抛异常。
    """
    keys = load_keys() if keys is None else keys
    entry = keys.get(provider_key)
    if not isinstance(entry, dict):
        return {"provider": provider_key, "ok": False, "error": "供应商不存在"}
    e = normalize_entry(provider_key, entry)
    base = (e["request_url"] or PROVIDER_META.get(e["provider"], ("", ""))[0] or "").rstrip("/")
    if not base:
        return {"provider": provider_key, "ok": False, "error": "未配置请求地址"}
    if not e["api_key"]:
        return {"provider": provider_key, "ok": False, "error": "未配置 API Key"}

    prov = {"api_key": e["api_key"], "auth_header": e["auth_header"]}

    # 1) GET /models
    started = time.time()
    try:
        req = urllib.request.Request(base + "/models", method="GET")
        _apply_auth(req, prov)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            raw = data.get("data") or data.get("models") or []
            models = [m.get("id") or m.get("name") for m in raw if isinstance(m, dict)]
            return {"provider": provider_key, "ok": True,
                    "latency_ms": round((time.time() - started) * 1000),
                    "method": "GET /models",
                    "models": [m for m in models if m][:20]}
    except Exception:
        pass

    # 2) 最小对话（1-token）
    model = e["active_model"] or e["model"] or PROVIDER_META.get(e["provider"], ("", ""))[1] or "deepseek-chat"
    started = time.time()
    try:
        _chat(base, e["api_key"], model,
              [{"role": "user", "content": "ping"}], timeout=15,
              auth_header=e["auth_header"], stream=False, max_tokens=1)
        return {"provider": provider_key, "ok": True,
                "latency_ms": round((time.time() - started) * 1000),
                "method": "POST /chat/completions", "models": [model]}
    except Exception as exc:
        return {"provider": provider_key, "ok": False,
                "latency_ms": round((time.time() - started) * 1000),
                "error": str(exc)}
