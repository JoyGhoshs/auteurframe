from __future__ import annotations

import random
import threading
import time
from collections import deque
from typing import Any

PROVIDERS: dict[str, dict[str, Any]] = {
    "llm7": {"label": "LLM7.io", "site": "https://llm7.io", "base_url": "https://api.llm7.io/v1",
             "per_minute": 30, "per_hour": 240, "gap": 1.0, "concurrency": 2, "scope": "provider",
             "note": "Anonymous access to the turbo pool. A free token from token.llm7.io raises limits."},
    "ovh": {"label": "OVHcloud AI Endpoints", "site": "https://endpoints.ai.cloud.ovh.net", "base_url": "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1",
            "per_minute": 2, "per_hour": 120, "gap": 0.0, "concurrency": 1, "scope": "model",
            "note": "EU hosted. Anonymous: 2 requests per minute per IP per model."},
    "kilo": {"label": "Kilo Gateway", "site": "https://kilo.ai", "base_url": "https://api.kilo.ai/api/gateway",
             "per_minute": 10, "per_hour": 190, "gap": 0.5, "concurrency": 2, "scope": "provider", "logged": True,
             "note": "About 200 requests per hour per IP on free models. Prompts may be logged upstream."},
    "pollinations": {"label": "Pollinations", "site": "https://pollinations.ai", "base_url": "https://text.pollinations.ai/openai", "endpoint": "https://text.pollinations.ai/openai",
                     "per_minute": 2, "per_hour": 100, "gap": 31.0, "concurrency": 1, "scope": "provider",
                     "note": "One request at a time with a 30 second gap when unregistered."},
    "blockrun": {"label": "BlockRun", "site": "https://blockrun.ai", "base_url": "https://blockrun.ai/api/v1",
                 "per_minute": 6, "per_hour": 90, "gap": 2.0, "concurrency": 1, "scope": "provider",
                 "note": "Free Nemotron route with no key. Limits are not published, so AuteurFrame uses it gently."},
}

MODELS: list[dict[str, Any]] = [
    {"provider": "ovh", "model": "gpt-oss-120b", "quality": 5, "tasks": {"json", "code"}, "max_out": 12000, "tools": True},
    {"provider": "ovh", "model": "Qwen3.8-27B", "quality": 4, "tasks": {"json", "code"}, "max_out": 10000, "tools": True},
    {"provider": "ovh", "model": "Meta-Llama-3_3-70B-Instruct", "quality": 4, "tasks": {"json"}, "max_out": 6000, "tools": True},
    {"provider": "ovh", "model": "gpt-oss-20b", "quality": 3, "tasks": {"json"}, "max_out": 8000, "tools": True},
    {"provider": "ovh", "model": "Mistral-Small-3.2-24B-Instruct-2506", "quality": 3, "tasks": {"json"}, "max_out": 6000, "tools": False},
    {"provider": "ovh", "model": "Qwen3.5-397B-A17B", "quality": 3, "tasks": {"json", "code"}, "max_out": 12000, "tools": False},
    {"provider": "llm7", "model": "gpt-oss:20b", "quality": 4, "tasks": {"json"}, "max_out": 8000, "tools": True},
    {"provider": "llm7", "model": "glm-5.3-flash", "quality": 4, "tasks": {"json", "code"}, "max_out": 10000, "tools": True},
    {"provider": "llm7", "model": "codestral-latest", "quality": 4, "tasks": {"code", "json"}, "max_out": 8000, "tools": True},
    {"provider": "llm7", "model": "minimax-m2.7", "quality": 3, "tasks": {"json", "code"}, "max_out": 10000, "tools": True},
    {"provider": "llm7", "model": "DeepSeek-V4-Flash-0731", "quality": 3, "tasks": {"json", "code"}, "max_out": 12000, "tools": True},
    {"provider": "llm7", "model": "mistral-Nemo-Instruct-2407", "quality": 2, "tasks": {"json"}, "max_out": 6000, "tools": False},
    {"provider": "kilo", "model": "nvidia/nemotron-3-ultra-550b-a55b:free", "quality": 5, "tasks": {"json", "code"}, "max_out": 12000, "tools": True},
    {"provider": "kilo", "model": "openrouter/free", "quality": 4, "tasks": {"json", "code"}, "max_out": 10000, "tools": True},
    {"provider": "kilo", "model": "nvidia/nemotron-3.5-lightning:free", "quality": 3, "tasks": {"json"}, "max_out": 8000, "tools": True},
    {"provider": "kilo", "model": "kilo-auto/free", "quality": 5, "boost": 1.6, "tasks": {"json", "code"}, "max_out": 10000, "tools": True},
    {"provider": "kilo", "model": "cohere/north-mini-code:free", "quality": 3, "tasks": {"code"}, "max_out": 10000, "tools": False},
    {"provider": "pollinations", "model": "openai-fast", "quality": 2, "tasks": {"json"}, "max_out": 4000, "tools": False},
    {"provider": "blockrun", "model": "nvidia/nemotron-3.5-lightning", "quality": 3, "tasks": {"json"}, "max_out": 8000, "tools": True},
    {"provider": "ovh", "model": "Qwen2.5-VL-72B-Instruct", "quality": 5, "tasks": {"vision"}, "max_out": 4000, "tools": False},
    {"provider": "kilo", "model": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", "quality": 4, "tasks": {"vision"}, "max_out": 4000, "tools": False},
    {"provider": "kilo", "model": "nvidia/nemotron-3.5-super-vl:free", "quality": 3, "tasks": {"vision"}, "max_out": 4000, "tools": False},
]

_LOCK = threading.Lock()
_CALLS: dict[str, deque] = {}
_INFLIGHT: dict[str, int] = {}
_COOL: dict[str, float] = {}
_STATS: dict[str, dict[str, Any]] = {}


def _scope(entry: dict[str, Any]) -> str:
    prov = PROVIDERS[entry["provider"]]
    return entry["provider"] if prov["scope"] == "provider" else f"{entry['provider']}:{entry['model']}"


def key(entry: dict[str, Any]) -> str:
    return f"{entry['provider']}:{entry['model']}"


def _entry_of(conn: dict[str, Any]) -> dict[str, Any] | None:
    return next((m for m in MODELS if m["provider"] == conn.get("free_provider") and m["model"] == conn.get("model")), None)


def headroom(entry: dict[str, Any], now: float | None = None) -> bool:
    now = now or time.time()
    prov = PROVIDERS[entry["provider"]]
    for k in (key(entry), entry["provider"]):
        if _COOL.get(k, 0) > now:
            return False
    scope = _scope(entry)
    calls = _CALLS.setdefault(scope, deque())
    while calls and now - calls[0] > 3600:
        calls.popleft()
    last_min = sum(1 for t in calls if now - t < 60)
    if last_min >= prov["per_minute"] or len(calls) >= prov["per_hour"]:
        return False
    if calls and now - calls[-1] < prov["gap"]:
        return False
    return _INFLIGHT.get(scope, 0) < prov["concurrency"]


def connection(entry: dict[str, Any]) -> dict[str, Any]:
    prov = PROVIDERS[entry["provider"]]
    conn = {"id": "free:" + key(entry), "provider": "auteur-free", "free_provider": entry["provider"], "label": f"Auteur-Free · {prov['label']}",
            "base_url": prov["base_url"], "model": entry["model"], "api_key": "", "free_pool": True, "rate_limit": False, "max_out": entry["max_out"],
            "no_tools": not entry.get("tools", True)}
    if prov.get("endpoint"):
        conn["endpoint"] = prov["endpoint"]
    return conn


def chain(task: str = "json", rng: random.Random | None = None) -> list[dict[str, Any]]:
    rng = rng or random
    now = time.time()
    with _LOCK:
        pool = [m for m in MODELS if task in m["tasks"]] or list(MODELS)
        ready = [m for m in pool if headroom(m, now)]
        later = [m for m in pool if m not in ready]
    ordered: list[dict[str, Any]] = []
    bag = list(ready)
    while bag:
        weights = [m["quality"] ** 2 * m.get("boost", 1.0) * (0.15 if m["provider"] == "pollinations" else 1.0) for m in bag]
        pick = rng.choices(bag, weights=weights, k=1)[0]
        ordered.append(pick)
        bag.remove(pick)
    later.sort(key=lambda m: min(_COOL.get(key(m), 0), _COOL.get(m["provider"], 0)))
    return [connection(m) for m in ordered + later]


def ready(conn: dict[str, Any]) -> bool:
    entry = _entry_of(conn)
    if not entry:
        return True
    with _LOCK:
        return headroom(entry)


def begin(conn: dict[str, Any]) -> bool:
    entry = _entry_of(conn)
    if not entry:
        return True
    with _LOCK:
        if not headroom(entry):
            return False
        scope = _scope(entry)
        _CALLS.setdefault(scope, deque()).append(time.time())
        _INFLIGHT[scope] = _INFLIGHT.get(scope, 0) + 1
    return True


def end(conn: dict[str, Any], ok: bool, status: int | None = None, retry_after: float | None = None, ms: int = 0) -> None:
    entry = _entry_of(conn)
    if not entry:
        return
    with _LOCK:
        scope = _scope(entry)
        _INFLIGHT[scope] = max(0, _INFLIGHT.get(scope, 0) - 1)
        st = _STATS.setdefault(key(entry), {"ok": 0, "fail": 0, "limited": 0, "ms": 0})
        if ok:
            st["ok"] += 1
            st["ms"] = int(ms if not st["ms"] else st["ms"] * 0.7 + ms * 0.3)
            _COOL.pop(key(entry), None)
            return
        if status in (402, 429, 503):
            st["limited"] += 1
            wait = min(86400.0, float(retry_after)) if retry_after else (60.0 if PROVIDERS[entry["provider"]]["scope"] == "model" else 120.0)
            target = entry["provider"] if PROVIDERS[entry["provider"]]["scope"] == "provider" else key(entry)
            _COOL[target] = time.time() + wait
        else:
            st["fail"] += 1
            fails = st["fail"]
            _COOL[key(entry)] = time.time() + min(900.0, 20.0 * (2 ** min(5, fails - 1)))


def status() -> dict[str, Any]:
    now = time.time()
    with _LOCK:
        models = []
        for m in MODELS:
            k = key(m)
            cool = max(_COOL.get(k, 0), _COOL.get(m["provider"], 0))
            models.append({"provider": m["provider"], "model": m["model"], "quality": m["quality"], "tasks": sorted(m["tasks"]), "ready": headroom(m, now),
                           "cooldown": max(0, round(cool - now)), **_STATS.get(k, {"ok": 0, "fail": 0, "limited": 0, "ms": 0})})
    return {"providers": {k: {kk: v for kk, v in p.items() if kk in ("label", "site", "note", "per_minute", "per_hour", "logged")} for k, p in PROVIDERS.items()}, "models": models}


def reset() -> None:
    with _LOCK:
        _CALLS.clear()
        _INFLIGHT.clear()
        _COOL.clear()
        _STATS.clear()
