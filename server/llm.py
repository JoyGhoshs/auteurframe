from __future__ import annotations

import asyncio
import contextvars
import json
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
    if conn.get("_no_thinking_field") or mode == "auto":
        return {}
    base = (conn.get("base_url") or "").lower()
    if conn.get("provider") in ("openrouter", "kilo") or "openrouter.ai" in base or "kilo.ai" in base:
        return {"reasoning": {"effort": "none"}} if mode == "off" else {"reasoning": {"enabled": True}}
    if any(k in model for k in TEMPLATE_THINKING):
        return {"chat_template_kwargs": {"enable_thinking": mode == "on"}}
    if "deepseek" in model or conn.get("provider") == "deepseek":
        return {"thinking": {"type": "disabled" if mode == "off" else "enabled"}}
    return {}


class LLM:
    def __init__(self, role: str = "director") -> None:
        self.role = role
        self.settings = read_settings()
        self.chain = self._chain()
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
        return f"{self.chain[0].get('provider')}:{self.chain[0].get('model')}"

    @property
    def vision(self) -> bool:
        if not self.chain:
            return False
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

    def _notify(self, msg: str) -> None:
        hook = self.on_retry or NOTIFY.get()
        if hook:
            try:
                hook(f"{self.role}: {msg}" if not self.on_retry else msg)
            except Exception:
                pass

    async def json(self, system: str, user: str, *, retries: int = 2, on_token=None, temperature: float | None = None, max_tokens: int | None = None) -> Any:
        prompt = user
        last: Exception | None = None
        for attempt in range(retries + 1):
            try:
                raw = await self.complete(system, prompt, on_token=on_token, temperature=temperature, max_tokens=max_tokens)
                return _extract_json(raw)
            except (ProviderError, ValueError) as error:
                last = error
                if isinstance(error, ProviderError) and "no model" in str(error):
                    raise
                prompt = user + "\n\nYour previous reply was not valid JSON. Reply with ONLY one valid JSON value, no prose, no code fences."
                await asyncio.sleep(0.5 * (attempt + 1))
        raise ProviderError(f"json failed: {last}")

    async def _stream(self, conn, system, msgs, temperature, max_tokens, on_token) -> str:
        temp = self.settings.get("temperature", 0.8) if temperature is None else temperature
        limit = max_tokens or self.settings.get("max_tokens", 8000)
        timeout = httpx.Timeout(300.0, connect=20.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            kind = PRESETS.get(conn.get("provider", "custom"), PRESETS["custom"])["kind"]
            if kind == "anthropic":
                return await self._anthropic(client, conn, system, msgs, temp, limit, on_token)
            if kind == "gemini":
                return await self._gemini(client, conn, system, msgs, temp, limit, on_token)
            return await self._openai(client, conn, system, msgs, temp, limit, on_token)

    @staticmethod
    def _emit(on_token, kind: str, text: str) -> None:
        if on_token and text:
            try:
                on_token(kind, text)
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
        url = conn["base_url"].rstrip("/") + "/chat/completions"
        out = []
        thoughts = []
        self.last_finish = ""
        async with client.stream("POST", url, headers=headers, json=body) as response:
            if response.status_code >= 400:
                detail = (await response.aread()).decode(errors="ignore")[:300]
                if extra_fields and response.status_code in (400, 422):
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
                usage = chunk.get("usage") or {}
                self.tokens_in += usage.get("prompt_tokens", 0) or 0
                self.tokens_out += usage.get("completion_tokens", 0) or 0
        self.last_reasoning_chars = sum(len(t) for t in thoughts)
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
        url = conn["base_url"].rstrip("/") + "/v1/messages"
        out = []
        self.last_finish = ""
        async with client.stream("POST", url, headers=headers, json=body) as response:
            if response.status_code >= 400:
                raise self._fail(response, (await response.aread()).decode(errors="ignore")[:300])
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
        return "".join(out)

    async def _gemini(self, client, conn, system, msgs, temp, limit, on_token) -> str:
        contents = []
        for m in msgs:
            parts: list[dict[str, Any]] = [{"text": m["text"]}]
            for img in m["images"]:
                parts.append({"inlineData": {"mimeType": "image/jpeg", "data": img}})
            contents.append({"role": "model" if m["role"] == "assistant" else "user", "parts": parts})
        body = {"systemInstruction": {"parts": [{"text": system}]}, "contents": contents, "generationConfig": {"temperature": temp, "maxOutputTokens": limit}}
        url = f"{conn['base_url'].rstrip('/')}/models/{conn['model']}:streamGenerateContent?alt=sse&key={conn.get('api_key', '')}"
        out = []
        async with client.stream("POST", url, json=body) as response:
            if response.status_code >= 400:
                raise self._fail(response, (await response.aread()).decode(errors="ignore")[:300])
            async for line in response.aiter_lines():
                if not line.startswith("data:"):
                    continue
                try:
                    chunk = json.loads(line[5:].strip())
                except json.JSONDecodeError:
                    continue
                for cand in chunk.get("candidates", []):
                    for part in (cand.get("content") or {}).get("parts", []):
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
