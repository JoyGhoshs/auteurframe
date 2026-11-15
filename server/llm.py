from __future__ import annotations

import asyncio
import contextvars
import json
import os
import random
import re
import time
import uuid
from typing import Any, Callable

import httpx

from . import config

ROLES = ["director", "writer", "art", "animator", "critic", "research"]

PRESETS: dict[str, dict[str, Any]] = {
    "anthropic": {"label": "Anthropic", "kind": "anthropic", "base_url": "https://api.anthropic.com", "models": ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5", "claude-fable-5-2"], "vision": True},
    "openai": {"label": "OpenAI", "kind": "openai", "base_url": "https://api.openai.com/v1", "models": ["gpt-5", "gpt-5-mini", "gpt-4.1"], "vision": True},
    "google": {"label": "Google Gemini", "kind": "gemini", "base_url": "https://generativelanguage.googleapis.com/v1beta", "models": ["gemini-2.5-pro", "gemini-2.5-flash"], "vision": True},
    "kilo": {"label": "Kilo AI Gateway", "kind": "openai", "base_url": "https://ai-gateway.kilo.ai/api/v1",
             "models": ["nvidia/nemotron-3.5-super-vl:free", "nvidia/nemotron-3-ultra-550b-a55b:free", "thinkingmachines/inkling-2-small:free", "dots-studio/dots-3-note-preview:free", "kilo-auto/free"], "vision": True},
    "openrouter": {"label": "OpenRouter", "kind": "openai", "base_url": "https://openrouter.ai/api/v1", "models": ["anthropic/claude-sonnet-5.5", "openai/gpt-5", "google/gemini-2.5-pro", "deepseek/deepseek-chat"], "vision": True},
    "groq": {"label": "Groq", "kind": "openai", "base_url": "https://api.groq.com/openai/v1", "models": ["llama-3.3-70b-versatile"], "vision": False},
    "deepseek": {"label": "DeepSeek", "kind": "openai", "base_url": "https://api.deepseek.com/v1", "models": ["deepseek-chat", "deepseek-reasoner"], "vision": False},
    "mistral": {"label": "Mistral", "kind": "openai", "base_url": "https://api.mistral.ai/v1", "models": ["mistral-large-latest", "codestral-latest"], "vision": False},
    "xai": {"label": "xAI", "kind": "openai", "base_url": "https://api.x.ai/v1", "models": ["grok-4", "grok-3-mini"], "vision": True},
    "together": {"label": "Together", "kind": "openai", "base_url": "https://api.together.xyz/v1", "models": ["Qwen/Qwen2.5-Coder-32B-Instruct"], "vision": False},
    "ollama": {"label": "Ollama (local)", "kind": "openai", "base_url": "http://127.0.0.1:11434/v1", "models": ["qwen2.5-coder:14b", "llama3.1"], "vision": False},
    "lmstudio": {"label": "LM Studio (local)", "kind": "openai", "base_url": "http://127.0.0.1:1234/v1", "models": [], "vision": False},
    "custom": {"label": "Custom OpenAI-compatible", "kind": "openai", "base_url": "", "models": [], "vision": False},
}


class ProviderError(RuntimeError):
    status: int | None = None
    retry_after: float | None = None


RETRY_DELAYS = (3.0, 8.0, 20.0, 45.0)
TRANSIENT_STATUS = {408, 409, 425, 429, 500, 502, 503, 504, 520, 522, 524, 529}
TRANSIENT_TEXT = ("temporarily unavailable", "overloaded", "rate limit", "rate_limit", "try again", "retry shortly", "server_error",
                  "timeout", "timed out", "capacity", "busy", "unavailable")


class RateLimiter:
    def __init__(self, rpm: float, concurrency: int) -> None:
        self.base_rpm = max(1.0, rpm)
        self.rpm = self.base_rpm
        self.sem = asyncio.Semaphore(max(1, concurrency))
        self.lock = asyncio.Lock()
        self.next_at = 0.0
        self.cooldown_until = 0.0
        self.ok_streak = 0

    async def acquire(self) -> None:
        await self.sem.acquire()
        async with self.lock:
            now = time.monotonic()
            start = max(now, self.next_at, self.cooldown_until)
            self.next_at = start + 60.0 / self.rpm
        delay = start - time.monotonic()
        if delay > 0:
            await asyncio.sleep(delay)

    def release(self, ok: bool) -> None:
        if ok:
            self.ok_streak += 1
            if self.ok_streak >= 5 and self.rpm < self.base_rpm:
                self.rpm = min(self.base_rpm, self.rpm * 1.25)
                self.ok_streak = 0
        self.sem.release()

    def throttle(self, wait: float) -> None:
        self.ok_streak = 0
        self.rpm = max(1.0, self.rpm / 2)
        self.cooldown_until = max(self.cooldown_until, time.monotonic() + wait)
        self.next_at = max(self.next_at, self.cooldown_until)


_LIMITERS: dict[str, RateLimiter] = {}
NOTIFY: contextvars.ContextVar = contextvars.ContextVar("llm_notify", default=None)


def is_free(conn: dict[str, Any]) -> bool:
    model = (conn.get("model") or "").lower()
    return model.endswith(":free") or model in ("openrouter/free", "kilo-auto/free") or bool(conn.get("free_tier"))


def limits_for(conn: dict[str, Any]) -> tuple[float, int]:
    if conn.get("rate_limit") is False:
        return 1e6, 1000
    free = is_free(conn)
    rpm = conn.get("rpm") or (12 if free else 120)
    conc = conn.get("concurrency") or (1 if free else 6)
    return float(rpm), int(conc)


def limiter(conn: dict[str, Any]) -> RateLimiter:
    rpm, conc = limits_for(conn)
    key = f"{conn.get('id') or conn.get('base_url')}|{conn.get('model')}|{rpm}|{conc}"
    if key not in _LIMITERS:
        _LIMITERS[key] = RateLimiter(rpm, conc)
    return _LIMITERS[key]


def reset_seconds(headers: Any, detail: str) -> float | None:
    h = {k.lower(): v for k, v in (headers or {}).items()}
    for name in ("retry-after", "x-ratelimit-reset-requests", "x-ratelimit-reset", "x-ratelimit-reset-tokens", "ratelimit-reset"):
        v = h.get(name)
        if not v:
            continue
        v = str(v).strip()
        m = re.fullmatch(r"(?:(\d+)h)?(?:(\d+)m(?!s))?(?:([\d.]+)s)?(?:(\d+)ms)?", v)
        if m and any(m.groups()):
            hh, mm, ss, ms = m.groups()
            return int(hh or 0) * 3600 + int(mm or 0) * 60 + float(ss or 0) + int(ms or 0) / 1000
        try:
            x = float(v)
        except ValueError:
            continue
        if x > 1e12:
            return max(0.0, x / 1000 - time.time())
        if x > 1e9:
            return max(0.0, x - time.time())
        return x
    m = re.search(r"(?:retry|try again|reset)\D{0,20}(\d+(?:\.\d+)?)\s*(ms|s|sec|seconds|m|min|minutes|h|hours)", detail or "", re.I)
    if m:
        n, unit = float(m.group(1)), m.group(2).lower()
        return n / 1000 if unit == "ms" else n * 60 if unit.startswith("m") and unit != "ms" else n * 3600 if unit.startswith("h") else n
    return None


QUOTA_TEXT = ("per day", "per-day", "daily", "quota", "free-models-per", "credits", "insufficient")


def transient(error: BaseException) -> bool:
    if isinstance(error, (httpx.TimeoutException, httpx.TransportError, httpx.RemoteProtocolError)):
        return True
    status = getattr(error, "status", None)
    if status in TRANSIENT_STATUS:
        return True
    text = str(error).lower()
    head = text[:4]
    if head[:3].isdigit() and int(head[:3]) in TRANSIENT_STATUS:
        return True
    if status in (400, 401, 403, 404, 422):
        return False
    return any(t in text for t in TRANSIENT_TEXT)


def read_settings() -> dict[str, Any]:
    try:
        data = json.loads(config.SETTINGS.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        data = {}
    data.setdefault("connections", [])
    data.setdefault("routing", {})
    data.setdefault("temperature", 0.8)
    data.setdefault("max_tokens", 8000)
    data.setdefault("vision_critic", True)
    media = dict(MEDIA_DEFAULTS)
    media.update(data.get("media") or {})
    data["media"] = media
    return data


MEDIA_DEFAULTS: dict[str, Any] = {"tts": False, "tts_provider": "edge", "elevenlabs_key": "", "elevenlabs_model": "eleven_multilingual_v2", "default_voice": "",
                                  "image_gen": False, "pollinations_key": ""}
MEDIA_SECRETS = ("elevenlabs_key", "pollinations_key")


def media_settings() -> dict[str, Any]:
    return read_settings()["media"]


def write_settings(data: dict[str, Any]) -> dict[str, Any]:
    current = read_settings()
    if "connections" in data:
        old = {c["id"]: c for c in current["connections"]}
        conns = []
        for conn in data["connections"]:
            conn = dict(conn)
            conn.setdefault("id", "conn_" + uuid.uuid4().hex[:8])
            key = conn.get("api_key", "")
            if (not key or "•" in key) and conn["id"] in old:
                prev = old[conn["id"]]
                same_target = (conn.get("base_url") or "").rstrip("/") == (prev.get("base_url") or "").rstrip("/") and conn.get("provider", "custom") == prev.get("provider", "custom")
                conn["api_key"] = prev.get("api_key", "") if same_target else ""
            preset = PRESETS.get(conn.get("provider", "custom"), PRESETS["custom"])
            conn["kind"] = preset["kind"]
            if not conn.get("base_url"):
                conn["base_url"] = preset["base_url"]
            conns.append(conn)
        current["connections"] = conns
    if isinstance(data.get("stock"), dict):
        merged = dict(current.get("stock", {}))
        for name, value in data["stock"].items():
            if value and "•" not in value:
                merged[name] = value.strip()
            elif value == "":
                merged.pop(name, None)
        current["stock"] = merged
    if isinstance(data.get("media"), dict):
        merged = dict(current.get("media") or MEDIA_DEFAULTS)
        for name, value in data["media"].items():
            if name not in MEDIA_DEFAULTS:
                continue
            if name in MEDIA_SECRETS:
                if isinstance(value, str) and value and "•" not in value:
                    merged[name] = value.strip()
                elif value == "":
                    merged[name] = ""
            elif isinstance(MEDIA_DEFAULTS[name], bool):
                merged[name] = bool(value)
            else:
                merged[name] = str(value or "")[:200]
        current["media"] = merged
    for key in ("routing", "temperature", "max_tokens", "vision_critic"):
        if key in data:
            current[key] = data[key]
    if "free_pool" in data and data["free_pool"] is not None:
        current["free_pool"] = bool(data["free_pool"])
    config.SETTINGS.write_text(json.dumps(current, indent=1), encoding="utf-8")
    return public_settings()


def mask(key: str) -> str:
    if not key:
        return ""
    return key[:4] + "•" * 8 + key[-4:] if len(key) > 10 else "•" * 8


def public_settings() -> dict[str, Any]:
    data = read_settings()
    conns = []
    for conn in data["connections"]:
        item = dict(conn)
        item["api_key"] = mask(conn.get("api_key", ""))
        item["has_key"] = bool(conn.get("api_key"))
        conns.append(item)
    return {"connections": conns, "routing": data["routing"], "temperature": data["temperature"], "max_tokens": data["max_tokens"],
            "vision_critic": data["vision_critic"], "presets": PRESETS, "roles": ROLES, "enabled": bool(_usable(data)),
            "free_pool": data.get("free_pool", True) is not False, "free_active": free_enabled(data),
            "stock": {k: mask(v) for k, v in data.get("stock", {}).items()},
            "media": {k: (mask(v) if k in MEDIA_SECRETS else v) for k, v in data["media"].items()} | {f"has_{k}": bool(data["media"].get(k)) for k in MEDIA_SECRETS}}


def _usable(data: dict[str, Any]) -> list[dict[str, Any]]:
    out = []
    for conn in data["connections"]:
        if conn.get("disabled"):
            continue
        local = conn.get("provider") in ("ollama", "lmstudio", "custom", "kilo")
        if conn.get("model") and (conn.get("api_key") or local) and conn.get("base_url"):
            out.append(conn)
    return out


def has_llm() -> bool:
    return bool(_usable(read_settings()))


def _extract_json(text: str) -> Any:
    text = (text or "").strip()
    text = re.sub(r"(?s)<think>.*?</think>", "", text).strip()
    fence = re.search(r"```(?:json)?\s*\n(.*?)```", text, re.S)
    if fence:
        try:
            return json.loads(fence.group(1))
        except json.JSONDecodeError:
            text = fence.group(1)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    for start in [m.start() for m in re.finditer(r"[\[{]", text)]:
        depth, in_str, esc = 0, False, False
        for index in range(start, len(text)):
            ch = text[index]
            if in_str:
                if esc:
                    esc = False
                elif ch == "\\":
                    esc = True
                elif ch == '"':
                    in_str = False
                continue
            if ch == '"':
                in_str = True
            elif ch in "[{":
                depth += 1
            elif ch in "]}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[start:index + 1])
                    except json.JSONDecodeError:
                        break
    raise ValueError("no json in model reply")


THINK_OPEN = ("<think>", "<thinking>")
THINK_CLOSE = ("</think>", "</thinking>")
INLINE_THINKERS: set[str] = set()
NO_TOOLS: set[str] = set()
JSON_BUDGET_CAP = 16000
CALL: contextvars.ContextVar[dict[str, Any] | None] = contextvars.ContextVar("llm_call", default=None)
WRAPPERS = ("result", "data", "json", "output", "answer", "response", "value", "arguments")


THINK_OFF_LADDER = ({"reasoning_effort": "none"}, {"thinking": {"type": "disabled"}}, {"chat_template_kwargs": {"enable_thinking": False}}, {"reasoning": {"effort": "none"}})
THINK_OFF_WORKS: dict[str, dict[str, Any]] = {}
TOOL_ERROR = re.compile(r"tool|function", re.I)


class ThinkOverrun(Exception):
    pass


class FieldRejected(Exception):
    pass


def conn_key(conn: dict[str, Any]) -> str:
    return f"{conn.get('id')}:{conn.get('model')}"


def tool_args(raw: str) -> Any:
    raw = (raw or "").strip()
    if not raw:
        return None
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        try:
            value = _extract_json(raw)
        except ValueError:
            return None
    for _ in range(2):
        if isinstance(value, dict) and len(value) == 1:
            key, inner = next(iter(value.items()))
            if isinstance(inner, str) and inner.strip()[:1] in "{[":
                try:
                    value = json.loads(inner)
                    continue
                except json.JSONDecodeError:
                    pass
            if key in WRAPPERS and isinstance(inner, dict):
                value = inner
                continue
        break
    return value if value not in ({}, [], None) else None


def free_objects(schema: Any) -> bool:
    if isinstance(schema, dict):
        if schema.get("type") == "object" and not schema.get("properties"):
            return True
        return any(free_objects(v) for v in schema.values())
    if isinstance(schema, list):
        return any(free_objects(v) for v in schema)
    return False


def gemini_schema(schema: Any) -> Any:
    if isinstance(schema, dict):
        out = {}
        for key, value in schema.items():
            if key == "additionalProperties":
                continue
            out[key] = value.upper() if key == "type" and isinstance(value, str) else gemini_schema(value)
        return out
    if isinstance(schema, list):
        return [gemini_schema(v) for v in schema]
    return schema


def strip_think(text: str) -> str:
    text = re.sub(r"(?s)<think(?:ing)?>.*?</think(?:ing)?>", "", text or "")
    close = max(text.rfind(tag) + len(tag) if tag in text else -1 for tag in THINK_CLOSE)
    if close >= 0:
        text = text[close:]
    opens = [text.find(tag) for tag in THINK_OPEN if tag in text]
    if opens:
        text = text[:min(opens)]
    return text.strip()


class ThinkSplit:
    def __init__(self) -> None:
        self.thinking = False
        self.pending = ""
        self.seen = False

    def feed(self, piece: str) -> list[tuple[str, str]]:
        text = self.pending + piece
        self.pending = ""
        out: list[tuple[str, str]] = []
        while text:
            tags = THINK_CLOSE if self.thinking else THINK_OPEN
            hits = [(text.find(tag), tag) for tag in tags if tag in text]
            if hits:
                at, tag = min(hits)
                if at:
                    out.append(("think" if self.thinking else "text", text[:at]))
                self.thinking = not self.thinking
                self.seen = True
                text = text[at + len(tag):]
                continue
            keep = max((n for tag in tags for n in range(1, len(tag)) if text.endswith(tag[:n])), default=0)
            if keep:
                self.pending = text[-keep:]
                text = text[:-keep]
            if text:
                out.append(("think" if self.thinking else "text", text))
            break
        return out

    def flush(self) -> list[tuple[str, str]]:
        text, self.pending = self.pending, ""
        return [("think" if self.thinking else "text", text)] if text else []


def extract_code(text: str, lang: str = "html") -> str:
    text = re.sub(r"(?s)<think>.*?</think>", "", text or "")
    blocks = [b.strip() for b in re.findall(r"```(?:html|HTML|xml)?[ \t]*\n(.*?)```", text, re.S)]
    blocks = [b for b in blocks if re.search(r"<div[^>]*class=[\"'][^\"']*\bscene\b", b) or "AU.scene" in b]
    if blocks:
        return max(blocks, key=len)
    open_block = re.search(r"```(?:html|HTML|xml)?[ \t]*\n(.*)$", text, re.S)
    if open_block and re.search(r"<div[^>]*class=[\"'][^\"']*\bscene\b", open_block.group(1)):
        return open_block.group(1).strip()
    start = re.search(r"(?m)^\s*<div[^>]*class=[\"'][^\"']*\bscene\b", text)
    if start:
        return text[start.start():].strip()
    return ""


TEMPLATE_THINKING = ("nemotron", "qwen", "glm", "hunyuan", "minimax")


def thinking_mode(conn: dict[str, Any], force: str | None = None) -> str:
    mode = conn.get("thinking") or "auto"
    if mode == "on":
        return "on"
    if force:
        return force
    if mode != "auto":
        return mode
    return "off" if "deepseek" in (conn.get("model") or "").lower() or conn.get("provider") == "deepseek" else "auto"


def thinking_fields(conn: dict[str, Any], mode: str) -> dict[str, Any]:
    model = (conn.get("model") or "").lower()
    if mode == "off" and conn.get("_disable_fields") is not None:
        return conn["_disable_fields"]
    if mode == "off" and CALL.get() is not None and conn_key(conn) in THINK_OFF_WORKS and not conn.get("_no_thinking_field"):
        return THINK_OFF_WORKS[conn_key(conn)]
    if conn.get("_no_thinking_field") or mode == "auto":
        return {}
    base = (conn.get("base_url") or "").lower()
    if conn.get("provider") in ("openrouter", "kilo") or "openrouter.ai" in base or "kilo.ai" in base:
        return {"reasoning": {"effort": "none"}} if mode == "off" else {"reasoning": {"enabled": True}}
    if "minimax" in model:
        return {"thinking": {"type": "disabled"}} if mode == "off" else {}
    if any(k in model for k in TEMPLATE_THINKING):
        return {"chat_template_kwargs": {"enable_thinking": mode == "on"}}
    if "deepseek" in model or conn.get("provider") == "deepseek":
        return {"thinking": {"type": "disabled" if mode == "off" else "enabled"}}
    return {}


def think_off_ladder(conn: dict[str, Any]) -> list[dict[str, Any]]:
    first = thinking_fields(dict(conn, _no_thinking_field=False), "off")
    return ([first] if first else []) + [f for f in THINK_OFF_LADDER if f != first]


FREE_OK: contextvars.ContextVar[bool] = contextvars.ContextVar("llm_free_ok", default=False)
FREE_FORCE: contextvars.ContextVar[bool] = contextvars.ContextVar("llm_free_force", default=False)
FREE_PATIENCE: contextvars.ContextVar[float] = contextvars.ContextVar("llm_free_patience", default=3.0)
CODE_ROLES = ("animator", "writer")


def free_allowed(settings: dict[str, Any] | None = None) -> bool:
    if os.environ.get("AUTEUR_FREE_POOL") == "0":
        return False
    data = settings if settings is not None else read_settings()
    return data.get("free_pool", True) is not False


def free_enabled(settings: dict[str, Any] | None = None) -> bool:
    data = settings if settings is not None else read_settings()
    return free_allowed(data) and not _usable(data)


def free_available() -> bool:
    return free_enabled()


class LLM:
    def __init__(self, role: str = "director", task: str | None = None) -> None:
        self.role = role
        self.settings = read_settings()
        self.chain = self._chain()
        self.task = task or ("code" if role in CODE_ROLES else "json")
        self.free = False
        forced = FREE_FORCE.get() and free_allowed(self.settings)
        if forced or (not self.chain and FREE_OK.get() and free_enabled(self.settings)):
            from . import freepool
            self.free = True
            self.chain = freepool.chain(self.task)
        self.calls = 0
        self.tokens_in = 0
        self.tokens_out = 0
        self.retries = 0
        self.force_thinking: str | None = None
        self.on_retry: Callable[[str], None] | None = None
        self.last_finish = ""
        self.last_reasoning_chars = 0

    def _chain(self) -> list[dict[str, Any]]:
        usable = _usable(self.settings)
        if not usable:
            return []
        route = self.settings.get("routing", {}).get(self.role) or {}
        first = None
        if route.get("connection"):
            first = next((c for c in usable if c["id"] == route["connection"]), None)
            if first and route.get("model"):
                first = dict(first, model=route["model"])
        chain = [first] if first else []
        for conn in usable:
            if not first or conn["id"] != first["id"]:
                chain.append(conn)
        return chain

    @property
    def available(self) -> bool:
        return bool(self.chain)

    @property
    def label(self) -> str:
        if not self.chain:
            return "house"
        if self.free:
            return "Auteur-Free"
        return f"{self.chain[0].get('provider')}:{self.chain[0].get('model')}"

    @property
    def vision(self) -> bool:
        if not self.chain:
            return False
        if self.free:
            from . import freepool
            return any("vision" in m["tasks"] for m in freepool.MODELS)
        conn = self.chain[0]
        if "vision" in conn and conn["vision"] is not None:
            return bool(conn["vision"])
        name = (conn.get("model") or "").lower()
        if re.search(r"(^|[-_/.])(vl|vision|omni)([-_/.]|$)|gpt-4o|gpt-4\.1|gpt-5|claude|gemini|pixtral|llava|qwen.*vl", name):
            return True
        return PRESETS.get(conn.get("provider", "custom"), {}).get("vision", False)

    async def complete(self, system: str, user: str, *, images: list[str] | None = None, temperature: float | None = None,
                       max_tokens: int | None = None, on_token: Callable[[str, str], None] | None = None) -> str:
        return await self.chat(system, [{"role": "user", "text": user, "images": images or []}], temperature=temperature, max_tokens=max_tokens, on_token=on_token)

    async def chat(self, system: str, messages: list[dict[str, Any]], *, temperature: float | None = None, max_tokens: int | None = None,
                   on_token: Callable[[str, str], None] | None = None) -> str:
        if not self.chain:
            raise ProviderError("no model connected")
        msgs = [{"role": m.get("role", "user"), "text": str(m.get("text", m.get("content", ""))), "images": list(m.get("images") or [])} for m in messages]
        errors = []
        if self.free:
            return await self._chat_free(system, msgs, temperature, max_tokens, on_token)
        for conn in self.chain:
            delays = list(RETRY_DELAYS)
            limited = 0
            lim = limiter(conn)
            while True:
                await lim.acquire()
                ok = False
                try:
                    started = time.time()
                    text = await self._stream(conn, system, msgs, temperature, max_tokens, on_token)
                    self.calls += 1
                    self.last_ms = int((time.time() - started) * 1000)
                    ok = True
                    return text
                except (ProviderError, httpx.HTTPError, KeyError, ValueError) as error:
                    label = f"{conn.get('provider')}/{conn.get('model')}"
                    text_err = str(error).lower()
                    if getattr(error, "status", None) == 429 or "rate limit" in text_err or "too many requests" in text_err:
                        wait = getattr(error, "retry_after", None)
                        if (wait and wait > 300) or any(q in text_err for q in QUOTA_TEXT):
                            when = f" (resets in {wait / 60:.0f} min)" if wait else ""
                            errors.append(f"{label}: quota exhausted{when}: {str(error)[:160]}")
                            break
                        limited += 1
                        if limited > 8:
                            errors.append(f"{label}: still rate limited after {limited - 1} waits")
                            break
                        wait = float(wait or min(90.0, 6.0 * (2 ** (limited - 1)))) + random.uniform(0.5, 2.0)
                        lim.throttle(wait)
                        self.retries += 1
                        self._notify(f"{label}: rate limited; pausing this connection {wait:.0f}s and slowing to {lim.rpm:.0f} requests/min")
                        continue
                    if transient(error) and delays:
                        wait = getattr(error, "retry_after", None) or delays.pop(0)
                        wait = min(60.0, float(wait)) + random.uniform(0, 1.5)
                        self.retries += 1
                        self._notify(f"{label}: {str(error)[:120]}; retrying in {wait:.0f}s")
                        await asyncio.sleep(wait)
                        continue
                    errors.append(f"{label}: {str(error)[:200]}")
                    break
                finally:
                    lim.release(ok)
        raise ProviderError(" | ".join(errors))

    async def _chat_free(self, system: str, msgs: list[dict[str, Any]], temperature: float | None, max_tokens: int | None, on_token) -> str:
        from . import freepool
        errors: list[str] = []
        tried = 0
        task = "vision" if any(m.get("images") for m in msgs) else self.task
        deadline = time.time() + max(3.0, FREE_PATIENCE.get())
        while True:
            for conn in freepool.chain(task):
                if tried >= 6:
                    break
                if not freepool.begin(conn):
                    continue
                tried += 1
                self.chain = [conn] + [c for c in self.chain if c.get("id") != conn["id"]]
                started = time.time()
                try:
                    text = await self._stream(conn, system, msgs, temperature, max_tokens, on_token)
                    if not (text or "").strip() and not CALL.get():
                        raise ProviderError("empty reply")
                    self.calls += 1
                    self.last_ms = int((time.time() - started) * 1000)
                    freepool.end(conn, True, ms=self.last_ms)
                    return text
                except (ProviderError, httpx.HTTPError, KeyError, ValueError) as error:
                    status = getattr(error, "status", None)
                    freepool.end(conn, False, status=status, retry_after=getattr(error, "retry_after", None))
                    errors.append(f"{conn['free_provider']}/{conn['model']}: {str(error)[:120]}")
                    self.retries += 1
                    self._notify(f"Auteur-Free: {conn['free_provider']}/{conn['model']} {'is busy' if status == 429 else 'failed'}; trying another free model")
            if tried or time.time() >= deadline:
                break
            await asyncio.sleep(min(5.0, max(1.0, deadline - time.time())))
        if not tried:
            raise ProviderError("every Auteur-Free model is at its rate limit right now; try again in a minute or connect your own model under Models")
        raise ProviderError("Auteur-Free could not answer: " + " | ".join(errors[-4:]))

    def _notify(self, msg: str) -> None:
        hook = self.on_retry or NOTIFY.get()
        if hook:
            try:
                hook(f"{self.role}: {msg}" if not self.on_retry else msg)
            except Exception:
                pass

    async def json(self, system: str, user: str, *, retries: int = 2, on_token=None, temperature: float | None = None, max_tokens: int | None = None,
                   schema: dict[str, Any] | None = None, tool: str = "submit", images: list[str] | None = None) -> Any:
        prompt = user
        last: Exception | None = None
        budget = max_tokens or self.settings.get("max_tokens", 8000)
        cap = max(3000, int(budget * 1.5))
        if self.chain and conn_key(self.chain[0]) in INLINE_THINKERS:
            budget = max(budget, min(JSON_BUDGET_CAP, budget + 6000))
        spec = {"name": tool, "description": "Submit your finished answer. Put every field the instructions ask for into the arguments.",
                "parameters": schema or {"type": "object", "properties": {}}}
        use_tools = bool(self.chain)
        for attempt in range(retries + 1):
            call = {"tool": spec if use_tools and conn_key(self.chain[0]) not in NO_TOOLS else None, "cap": cap, "args": None,
                    "off": conn_key(self.chain[0]) in THINK_OFF_WORKS if self.chain else False}
            token = CALL.set(call)
            try:
                raw = await self.complete(system, prompt, images=images, on_token=on_token, temperature=temperature, max_tokens=budget)
                if call["args"] is not None:
                    parsed = tool_args(call["args"])
                    if parsed is not None:
                        return parsed
                if call["tool"]:
                    use_tools = False
                if str(self.last_finish).lower() in ("length", "max_tokens"):
                    try:
                        whole = json.loads(raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip())
                        return whole
                    except json.JSONDecodeError:
                        pass
                    budget = max(budget, min(JSON_BUDGET_CAP, int(budget * 2.5)))
                    prompt = user + "\n\nYour previous reply hit the length limit before the JSON was complete. Keep your reasoning short and reply with ONLY the JSON value."
                    raise ValueError(f"reply cut off at the token limit ({len(raw)} chars)")
                return _extract_json(raw)
            except (ProviderError, ValueError) as error:
                last = error
                if isinstance(error, ProviderError) and "no model" in str(error):
                    raise
                if call["tool"]:
                    use_tools = False
                if "cut off" not in str(error):
                    prompt = user + "\n\nYour previous reply was not valid JSON. Reply with ONLY one valid JSON value, no prose, no code fences."
                await asyncio.sleep(0.5 * (attempt + 1))
            finally:
                CALL.reset(token)
        raise ProviderError(f"json failed: {last}")

    async def _stream(self, conn, system, msgs, temperature, max_tokens, on_token) -> str:
        temp = self.settings.get("temperature", 0.8) if temperature is None else temperature
        limit = max_tokens or self.settings.get("max_tokens", 8000)
        timeout = httpx.Timeout(150.0, connect=10.0) if conn.get("free_pool") else httpx.Timeout(300.0, connect=20.0)
        call = CALL.get()
        saved = self.force_thinking
        ladder: list[dict[str, Any]] | None = None
        step = 0
        kind = PRESETS.get(conn.get("provider", "custom"), PRESETS["custom"])["kind"]
        if call and call.get("off") and conn_key(conn) in THINK_OFF_WORKS:
            self.force_thinking = "off"
        try:
            while True:
                split = ThinkSplit()
                seen = {"inline": 0, "all": 0}
                cap = call.get("cap") if call else None

                def route(k0: str, text: str) -> None:
                    parts = [(k0, text)] if k0 != "text" else split.feed(text)
                    for k, t in parts:
                        if k == "think":
                            seen["all"] += len(t)
                            if k0 == "text":
                                seen["inline"] += len(t)
                        self._emit(on_token, k, t)
                    if cap and seen["all"] > cap:
                        raise ThinkOverrun(seen["all"])

                try:
                    async with httpx.AsyncClient(timeout=timeout) as client:
                        if kind == "anthropic":
                            raw = await self._anthropic(client, conn, system, msgs, temp, limit, route)
                        elif kind == "gemini":
                            raw = await self._gemini(client, conn, system, msgs, temp, limit, route)
                        else:
                            raw = await self._openai(client, conn, system, msgs, temp, limit, route)
                except ThinkOverrun as overrun:
                    if thinking_mode(conn, "off") != "off":
                        raise ProviderError(f"the model kept thinking past {overrun.args[0]} chars without answering")
                    if ladder is None:
                        ladder = think_off_ladder(conn) if kind == "openai" else []
                        self._notify(f"thinking ran past {overrun.args[0]} chars without an answer; asking again with thinking off")
                        self._emit(on_token, "think", "\n[thinking cut off; asking again with thinking off]\n")
                    self.force_thinking = "off"
                    if step < len(ladder):
                        conn["_disable_fields"] = ladder[step]
                        step += 1
                    else:
                        conn.pop("_disable_fields", None)
                        call["cap"] = None
                    continue
                except FieldRejected:
                    if ladder is not None and step < len(ladder):
                        conn["_disable_fields"] = ladder[step]
                        step += 1
                    else:
                        conn.pop("_disable_fields", None)
                        call["cap"] = None
                    continue
                break
            if conn.get("_disable_fields") is not None:
                THINK_OFF_WORKS[conn_key(conn)] = conn["_disable_fields"]
        finally:
            self.force_thinking = saved
            conn.pop("_disable_fields", None)
        for k, t in split.flush():
            self._emit(on_token, k, t)
        if split.seen or any(tag in raw for tag in THINK_CLOSE):
            INLINE_THINKERS.add(conn_key(conn))
            self.last_reasoning_chars = (self.last_reasoning_chars or 0) + seen["inline"]
            return strip_think(raw)
        return raw

    @staticmethod
    def _emit(on_token, kind: str, text: str) -> None:
        if on_token and text:
            try:
                on_token(kind, text)
            except ThinkOverrun:
                raise
            except Exception:
                pass

    @staticmethod
    def _fail(response: httpx.Response, detail: str) -> ProviderError:
        error = ProviderError(f"{response.status_code} {detail}")
        error.status = response.status_code
        wait = reset_seconds(response.headers, detail)
        if wait is not None:
            error.retry_after = wait
        return error

    async def _openai(self, client, conn, system, msgs, temp, limit, on_token) -> str:
        headers = {"Content-Type": "application/json"}
        if conn.get("api_key"):
            headers["Authorization"] = f"Bearer {conn['api_key']}"
        if conn.get("provider") == "openrouter":
            headers["HTTP-Referer"] = "https://auteur.local"
            headers["X-Title"] = "AuteurFrame"
        messages: list[dict[str, Any]] = [{"role": "system", "content": system}]
        for m in msgs:
            content: Any = m["text"]
            if m["images"] and m["role"] == "user":
                content = [{"type": "text", "text": m["text"]}] + [{"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img}"}} for img in m["images"]]
            messages.append({"role": m["role"], "content": content})
        model = conn["model"]
        body: dict[str, Any] = {"model": model, "messages": messages, "stream": True}
        reasoning_model = bool(re.match(r"^(o\d|gpt-5)", model.split("/")[-1]))
        if reasoning_model and conn.get("provider") == "openai":
            body["max_completion_tokens"] = limit
        else:
            body["max_tokens"] = limit
            body["temperature"] = temp
        extra_fields = thinking_fields(conn, thinking_mode(conn, self.force_thinking))
        body.update(extra_fields)
        call = CALL.get()
        tool = call.get("tool") if call and conn_key(conn) not in NO_TOOLS and not conn.get("no_tools") else None
        if tool:
            body["tools"] = [{"type": "function", "function": tool}]
            body["tool_choice"] = {"type": "function", "function": {"name": tool["name"]}}
        if conn.get("free_pool"):
            headers["User-Agent"] = "AuteurFrame (open-source motion studio; Auteur-Free)"
            if "max_tokens" in body and conn.get("max_out"):
                body["max_tokens"] = min(int(body["max_tokens"]), int(conn["max_out"]))
        url = conn.get("endpoint") or conn["base_url"].rstrip("/") + "/chat/completions"
        out = []
        thoughts = []
        calls: dict[int, dict[str, str]] = {}
        self.last_finish = ""
        async with client.stream("POST", url, headers=headers, json=body) as response:
            if response.status_code >= 400:
                detail = (await response.aread()).decode(errors="ignore")[:300]
                if tool and response.status_code in (400, 404, 422) and TOOL_ERROR.search(detail):
                    self._notify(f"provider rejected the tool call ({response.status_code}: {detail[:160]}); using plain JSON")
                    NO_TOOLS.add(conn_key(conn))
                    call["tool"] = None
                    return await self._openai(client, conn, system, msgs, temp, limit, on_token)
                if extra_fields and response.status_code in (400, 422):
                    if conn.get("_disable_fields") is not None:
                        raise FieldRejected(detail)
                    self._notify(f"provider rejected the thinking setting ({response.status_code}: {detail[:160]}); sending without it")
                    conn["_no_thinking_field"] = True
                    return await self._openai(client, conn, system, msgs, temp, limit, on_token)
                raise self._fail(response, detail)
            async for line in response.aiter_lines():
                if not line.startswith("data:"):
                    continue
                payload = line[5:].strip()
                if payload == "[DONE]":
                    break
                try:
                    chunk = json.loads(payload)
                except json.JSONDecodeError:
                    continue
                if chunk.get("error"):
                    raise ProviderError(str(chunk["error"])[:300])
                for choice in chunk.get("choices", []):
                    delta = choice.get("delta") or {}
                    thought = delta.get("reasoning_content") or delta.get("reasoning") or ""
                    if thought:
                        thoughts.append(thought)
                        self._emit(on_token, "think", thought)
                    if choice.get("finish_reason"):
                        self.last_finish = choice["finish_reason"]
                    piece = delta.get("content") or ""
                    if piece:
                        out.append(piece)
                        self._emit(on_token, "text", piece)
                    for tc in delta.get("tool_calls") or []:
                        slot = calls.setdefault(int(tc.get("index") or 0), {"name": "", "args": ""})
                        fn = tc.get("function") or {}
                        slot["name"] += fn.get("name") or ""
                        piece = fn.get("arguments") or ""
                        if isinstance(piece, dict):
                            piece = json.dumps(piece)
                        slot["args"] += piece
                        self._emit(on_token, "tool", piece)
                usage = chunk.get("usage") or {}
                self.tokens_in += usage.get("prompt_tokens", 0) or 0
                self.tokens_out += usage.get("completion_tokens", 0) or 0
        self.last_reasoning_chars = sum(len(t) for t in thoughts)
        if tool and calls:
            pick = next((c for c in calls.values() if c["name"] == tool["name"]), next(iter(calls.values())))
            call["args"] = pick["args"]
        return "".join(out)

    async def _anthropic(self, client, conn, system, msgs, temp, limit, on_token) -> str:
        headers = {"Content-Type": "application/json", "x-api-key": conn.get("api_key", ""), "anthropic-version": "2023-06-01"}
        messages = []
        for m in msgs:
            content: Any = m["text"]
            if m["images"] and m["role"] == "user":
                content = [{"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": img}} for img in m["images"]] + [{"type": "text", "text": m["text"]}]
            messages.append({"role": m["role"], "content": content})
        body = {"model": conn["model"], "system": system, "max_tokens": limit, "temperature": min(1.0, temp), "stream": True, "messages": messages}
        call = CALL.get()
        tool = call.get("tool") if call else None
        if tool:
            body["tools"] = [{"name": tool["name"], "description": tool["description"], "input_schema": tool["parameters"]}]
            body["tool_choice"] = {"type": "tool", "name": tool["name"]}
        url = conn["base_url"].rstrip("/") + "/v1/messages"
        out = []
        args: list[str] = []
        self.last_finish = ""
        async with client.stream("POST", url, headers=headers, json=body) as response:
            if response.status_code >= 400:
                detail = (await response.aread()).decode(errors="ignore")[:300]
                if tool and response.status_code in (400, 404, 422) and TOOL_ERROR.search(detail):
                    self._notify(f"provider rejected the tool call ({response.status_code}: {detail[:160]}); using plain JSON")
                    NO_TOOLS.add(conn_key(conn))
                    call["tool"] = None
                    return await self._anthropic(client, conn, system, msgs, temp, limit, on_token)
                raise self._fail(response, detail)
            async for line in response.aiter_lines():
                if not line.startswith("data:"):
                    continue
                try:
                    event = json.loads(line[5:].strip())
                except json.JSONDecodeError:
                    continue
                kind = event.get("type")
                if kind == "content_block_delta":
                    delta = event.get("delta", {})
                    if delta.get("type") == "text_delta":
                        out.append(delta.get("text", ""))
                        self._emit(on_token, "text", delta.get("text", ""))
                    elif delta.get("type") == "thinking_delta":
                        self._emit(on_token, "think", delta.get("thinking", ""))
                    elif delta.get("type") == "input_json_delta":
                        args.append(delta.get("partial_json", ""))
                        self._emit(on_token, "tool", delta.get("partial_json", ""))
                elif kind == "message_delta":
                    self.tokens_out += (event.get("usage") or {}).get("output_tokens", 0) or 0
                    self.last_finish = (event.get("delta") or {}).get("stop_reason") or self.last_finish
                elif kind == "message_start":
                    self.tokens_in += ((event.get("message") or {}).get("usage") or {}).get("input_tokens", 0) or 0
                elif kind == "error":
                    err = ProviderError(str(event.get("error"))[:300])
                    if "overloaded" in str(event.get("error")).lower():
                        err.status = 529
                    raise err
        if tool and args:
            call["args"] = "".join(args)
        return "".join(out)

    async def _gemini(self, client, conn, system, msgs, temp, limit, on_token) -> str:
        contents = []
        for m in msgs:
            parts: list[dict[str, Any]] = [{"text": m["text"]}]
            for img in m["images"]:
                parts.append({"inlineData": {"mimeType": "image/jpeg", "data": img}})
            contents.append({"role": "model" if m["role"] == "assistant" else "user", "parts": parts})
        body = {"systemInstruction": {"parts": [{"text": system}]}, "contents": contents, "generationConfig": {"temperature": temp, "maxOutputTokens": limit}}
        call = CALL.get()
        tool = call.get("tool") if call else None
        if tool and free_objects(tool["parameters"]):
            tool = None
        if tool:
            body["tools"] = [{"functionDeclarations": [{"name": tool["name"], "description": tool["description"], "parameters": gemini_schema(tool["parameters"])}]}]
            body["toolConfig"] = {"functionCallingConfig": {"mode": "ANY", "allowedFunctionNames": [tool["name"]]}}
        url = f"{conn['base_url'].rstrip('/')}/models/{conn['model']}:streamGenerateContent?alt=sse&key={conn.get('api_key', '')}"
        out = []
        self.last_finish = ""
        async with client.stream("POST", url, json=body) as response:
            if response.status_code >= 400:
                detail = (await response.aread()).decode(errors="ignore")[:300]
                if tool and response.status_code in (400, 404, 422) and TOOL_ERROR.search(detail):
                    self._notify(f"provider rejected the tool call ({response.status_code}: {detail[:160]}); using plain JSON")
                    NO_TOOLS.add(conn_key(conn))
                    call["tool"] = None
                    return await self._gemini(client, conn, system, msgs, temp, limit, on_token)
                raise self._fail(response, detail)
            async for line in response.aiter_lines():
                if not line.startswith("data:"):
                    continue
                try:
                    chunk = json.loads(line[5:].strip())
                except json.JSONDecodeError:
                    continue
                for cand in chunk.get("candidates", []):
                    if cand.get("finishReason"):
                        self.last_finish = cand["finishReason"]
                    for part in (cand.get("content") or {}).get("parts", []):
                        if tool and part.get("functionCall"):
                            call["args"] = json.dumps(part["functionCall"].get("args") or {})
                            self._emit(on_token, "tool", call["args"])
                            continue
                        text = part.get("text", "")
                        if not text:
                            continue
                        if part.get("thought"):
                            self._emit(on_token, "think", text)
                        else:
                            out.append(text)
                            self._emit(on_token, "text", text)
        return "".join(out)


async def ping(conn_id: str | None = None) -> dict[str, Any]:
    settings = read_settings()
    usable = _usable(settings)
    if conn_id:
        usable = [c for c in usable if c["id"] == conn_id]
    if not usable:
        return {"ok": False, "error": "connection is missing a model, key or base URL"}
    llm = LLM("director")
    llm.chain = usable[:1]
    started = time.time()
    try:
        reply = await llm.complete("You are a health check.", "Reply with exactly: ready", max_tokens=600, temperature=0)
        return {"ok": True, "reply": reply.strip()[:60], "ms": int((time.time() - started) * 1000), "model": usable[0]["model"]}
    except Exception as error:
        return {"ok": False, "error": str(error)[:400], "ms": int((time.time() - started) * 1000)}


async def list_models(provider: str, base_url: str, api_key: str, conn_id: str | None = None) -> list[str]:
    if conn_id and (not api_key or "•" in api_key):
        for conn in read_settings()["connections"]:
            if conn["id"] == conn_id:
                api_key = conn.get("api_key", "")
    preset = PRESETS.get(provider, PRESETS["custom"])
    base = (base_url or preset["base_url"]).rstrip("/")
    async with httpx.AsyncClient(timeout=20) as client:
        try:
            if preset["kind"] == "anthropic":
                r = await client.get(base + "/v1/models", headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"})
                return sorted(m["id"] for m in r.json().get("data", []))
            if preset["kind"] == "gemini":
                r = await client.get(f"{base}/models?key={api_key}")
                return sorted(m["name"].split("/")[-1] for m in r.json().get("models", []) if "generateContent" in m.get("supportedGenerationMethods", []))
            headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
            r = await client.get(base + "/models", headers=headers)
            return sorted(m["id"] for m in r.json().get("data", []))[:400]
        except Exception:
            return preset["models"]
