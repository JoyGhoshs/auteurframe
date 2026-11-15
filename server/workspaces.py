from __future__ import annotations

import json
import re
import threading
import time
import uuid
from typing import Any

from . import config

COLORS = ["#A78BFA", "#2DE1C2", "#F472B6", "#60A5FA", "#FBBF24", "#34D399", "#F87171", "#818CF8"]
_LOCK = threading.Lock()
VALID = re.compile(r"^ws_[a-f0-9]{8}$")


def _path():
    return config.DATA / "workspaces.json"


def _read() -> list[dict[str, Any]]:
    try:
        data = json.loads(_path().read_text(encoding="utf-8"))
        return [w for w in data if isinstance(w, dict) and VALID.match(str(w.get("id", "")))]
    except (OSError, json.JSONDecodeError):
        return []


def _write(items: list[dict[str, Any]]) -> None:
    path = _path()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(items, indent=1, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


def clean_name(name: Any) -> str:
    text = re.sub(r"\s+", " ", str(name or "")).strip()[:60]
    if not text:
        raise ValueError("give the workspace a name")
    return text


def list_all() -> list[dict[str, Any]]:
    with _LOCK:
        return _read()


def exists(wid: str | None) -> bool:
    return bool(wid) and any(w["id"] == wid for w in list_all())


def create(name: Any, color: str | None = None) -> dict[str, Any]:
    with _LOCK:
        items = _read()
        if len(items) >= 100:
            raise ValueError("you already have 100 workspaces")
        item = {"id": "ws_" + uuid.uuid4().hex[:8], "name": clean_name(name), "created": time.time(),
                "color": color if color in COLORS else COLORS[len(items) % len(COLORS)]}
        items.append(item)
        _write(items)
        return item


def update(wid: str, name: Any = None, color: str | None = None) -> dict[str, Any]:
    with _LOCK:
        items = _read()
        item = next((w for w in items if w["id"] == wid), None)
        if not item:
            raise KeyError(wid)
        if name is not None:
            item["name"] = clean_name(name)
        if color in COLORS:
            item["color"] = color
        _write(items)
        return item


def delete(wid: str) -> None:
    with _LOCK:
        items = _read()
        if not any(w["id"] == wid for w in items):
            raise KeyError(wid)
        _write([w for w in items if w["id"] != wid])
