from __future__ import annotations

import threading
import time
from typing import Any

from .bus import bus

_locks: dict[str, threading.RLock] = {}


def _lock(pid: str) -> threading.RLock:
    return _locks.setdefault(pid, threading.RLock())


class Brain:
    def __init__(self, pid: str, initial: dict[str, Any] | None = None) -> None:
        self.pid = pid
        base = initial or {}
        self.keys: dict[str, dict[str, Any]] = dict(base.get("keys", {}))
        self.decisions: list[dict[str, Any]] = list(base.get("decisions", []))
        self.facts: list[dict[str, Any]] = list(base.get("facts", []))
        self.leases: dict[str, dict[str, Any]] = {}
        self.notes: list[dict[str, Any]] = list(base.get("notes", []))

    def read(self, key: str, default: Any = None) -> Any:
        entry = self.keys.get(key)
        return entry["value"] if entry else default

    def version(self, key: str) -> int:
        entry = self.keys.get(key)
        return entry["version"] if entry else 0

    def write(self, key: str, value: Any, author: str, reason: str = "", base_version: int | None = None) -> int:
        with _lock(self.pid):
            current = self.keys.get(key)
            if base_version is not None and current and current["version"] != base_version:
                raise RuntimeError(f"stale write to {key}: base {base_version} current {current['version']}")
            version = (current["version"] if current else 0) + 1
            self.keys[key] = {"value": value, "version": version, "author": author, "reason": reason, "t": round(time.time(), 3)}
        bus.publish(self.pid, "memory.write", {"key": key, "version": version, "author": author, "reason": reason, "preview": _preview(value)})
        return version

    def decide(self, author: str, decision: str, why: str = "") -> None:
        item = {"t": round(time.time(), 3), "author": author, "decision": decision, "why": why}
        with _lock(self.pid):
            self.decisions.append(item)
        bus.publish(self.pid, "memory.decision", item)

    def add_fact(self, claim: str, source: str, url: str = "", author: str = "research") -> str:
        with _lock(self.pid):
            fid = f"F{len(self.facts) + 1}"
            self.facts.append({"id": fid, "claim": claim[:400], "source": source[:200], "url": url[:400], "author": author})
        bus.publish(self.pid, "memory.fact", {"id": fid, "claim": claim[:200], "url": url})
        return fid

    def claim(self, key: str, agent: str, ttl: float = 180.0) -> bool:
        with _lock(self.pid):
            lease = self.leases.get(key)
            now = time.time()
            if lease and lease["agent"] != agent and lease["until"] > now:
                return False
            self.leases[key] = {"agent": agent, "until": now + ttl}
        bus.publish(self.pid, "memory.claim", {"key": key, "agent": agent})
        return True

    def release(self, key: str, agent: str) -> None:
        with _lock(self.pid):
            lease = self.leases.get(key)
            if lease and lease["agent"] == agent:
                del self.leases[key]

    def snapshot(self, keys: list[str] | None = None, budget: int = 6000) -> str:
        parts = []
        wanted = keys or list(self.keys.keys())
        for key in wanted:
            entry = self.keys.get(key)
            if not entry:
                continue
            parts.append(f"[{key} v{entry['version']} by {entry['author']}]\n{_text(entry['value'])}")
        if self.facts:
            parts.append("[facts]\n" + "\n".join(f"{f['id']}: {f['claim']} ({f['source']})" for f in self.facts[-24:]))
        if self.decisions:
            parts.append("[decisions]\n" + "\n".join(f"- {d['author']}: {d['decision']}" for d in self.decisions[-14:]))
        text = "\n\n".join(parts)
        return text[:budget]

    def dump(self) -> dict[str, Any]:
        return {"keys": self.keys, "decisions": self.decisions[-200:], "facts": self.facts[-200:], "notes": self.notes[-100:]}


def _text(value: Any) -> str:
    import json
    if isinstance(value, str):
        return value[:2400]
    try:
        return json.dumps(value, ensure_ascii=False)[:2400]
    except (TypeError, ValueError):
        return str(value)[:2400]


def _preview(value: Any) -> str:
    return _text(value)[:220]
