from __future__ import annotations

import hashlib
import json
import os
import re
import time
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx

from . import config, templates

RELEASE = config.ROOT / "release.json"
BUNDLED = config.ROOT / "templates"
PULLED = config.DATA / "templates"
STATE = config.DATA / "updates.json"
TTL = 6 * 3600
MAX_FEED = 512 * 1024
MAX_PACK = 256 * 1024


def local() -> dict[str, Any]:
    try:
        return json.loads(RELEASE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"name": "AuteurFrame", "version": "0.0.0", "templates": []}


def version() -> str:
    return str(local().get("version", "0.0.0"))


def parse(v: str) -> tuple[int, ...]:
    m = re.match(r"^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?", str(v or "").strip())
    return tuple(int(x or 0) for x in m.groups()) if m else (0, 0, 0)


def newer(a: str, b: str) -> bool:
    return parse(a) > parse(b)


def state() -> dict[str, Any]:
    try:
        return json.loads(STATE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"check": True}


def save_state(s: dict[str, Any]) -> None:
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(s, indent=1), encoding="utf-8")


def feed_url() -> str:
    return os.environ.get("AUTEURFRAME_UPDATE_FEED") or str(local().get("feed") or "")


def installed() -> dict[str, int]:
    out: dict[str, int] = {}
    for folder in (BUNDLED, PULLED):
        if not folder.is_dir():
            continue
        for f in folder.glob("*.json"):
            try:
                d = json.loads(f.read_text(encoding="utf-8"))
                out[d["id"]] = max(out.get(d["id"], 0), int(d.get("version", 1)))
            except (OSError, ValueError, KeyError, TypeError):
                continue
    return out


def reload() -> list[str]:
    return templates.load_packs([(BUNDLED, "bundled"), (PULLED, "feed")])


def summary(remote: dict[str, Any] | None, error: str = "") -> dict[str, Any]:
    cur = version()
    have = installed()
    rows = []
    for t in (remote or {}).get("templates") or []:
        if not isinstance(t, dict) or not isinstance(t.get("id"), str):
            continue
        v = int(t.get("version", 1) or 1)
        status = "new" if t["id"] not in have else ("update" if v > have[t["id"]] else "installed")
        rows.append({"id": t["id"], "name": str(t.get("name") or t["id"])[:60], "version": v, "installed": have.get(t["id"]), "status": status,
                     "added": str(t.get("added", ""))[:20], "description": str(t.get("description", ""))[:200]})
    latest = str((remote or {}).get("version") or cur)
    return {"current": cur, "latest": latest, "update_available": bool(remote) and newer(latest, cur), "notes": (remote or {}).get("notes") or [],
            "download": (remote or {}).get("download") or local().get("download", ""), "released": (remote or {}).get("released", ""),
            "templates": rows, "pending": sum(1 for r in rows if r["status"] != "installed"), "check": bool(state().get("check", True)),
            "feed": feed_url(), "checked_at": state().get("checked_at"), "error": error,
            "license": local().get("license", ""), "commercial": local().get("commercial", "")}


async def fetch_feed() -> dict[str, Any]:
    url = feed_url()
    if not url.startswith("https://"):
        raise ValueError("update feed must be an https URL")
    async with httpx.AsyncClient(timeout=12, follow_redirects=True, headers={"User-Agent": f"AuteurFrame/{version()} update-check"}) as client:
        r = await client.get(url)
        r.raise_for_status()
        if len(r.content) > MAX_FEED:
            raise ValueError("update feed is too large")
        data = r.json()
    if not isinstance(data, dict) or not isinstance(data.get("version"), str):
        raise ValueError("update feed is not a release manifest")
    return data


async def check(force: bool = False) -> dict[str, Any]:
    s = state()
    if not force and not s.get("check", True):
        return summary(None)
    if not force and s.get("remote") and time.time() - float(s.get("checked_at") or 0) < TTL:
        return summary(s["remote"])
    try:
        remote = await fetch_feed()
    except (httpx.HTTPError, ValueError) as error:
        return summary(s.get("remote"), f"could not reach the update feed: {str(error)[:160]}")
    s.update(remote=remote, checked_at=time.time())
    save_state(s)
    return summary(remote)


LEGAL = config.DATA / "legal.json"
NOTICE_VERSION = 1


def legal_state() -> dict[str, Any]:
    try:
        saved = json.loads(LEGAL.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        saved = {}
    rel = local()
    return {"show": saved.get("notice") != NOTICE_VERSION, "accepted_at": saved.get("accepted_at"), "version": version(),
            "license": rel.get("license", ""), "copyright": rel.get("copyright", ""), "repository": rel.get("repository", ""),
            "commercial": rel.get("commercial", "")}


def accept_legal() -> dict[str, Any]:
    LEGAL.parent.mkdir(parents=True, exist_ok=True)
    LEGAL.write_text(json.dumps({"notice": NOTICE_VERSION, "accepted_at": time.time(), "version": version()}, indent=1), encoding="utf-8")
    return legal_state()


def set_check(enabled: bool) -> dict[str, Any]:
    s = state()
    s["check"] = bool(enabled)
    save_state(s)
    return summary(s.get("remote"))


async def pull_templates(ids: list[str] | None = None) -> dict[str, Any]:
    remote = await fetch_feed()
    base = feed_url()
    host = urlparse(base).netloc
    have = installed()
    PULLED.mkdir(parents=True, exist_ok=True)
    done, failed = [], []
    async with httpx.AsyncClient(timeout=20, follow_redirects=True, headers={"User-Agent": f"AuteurFrame/{version()} templates"}) as client:
        for t in remote.get("templates") or []:
            tid = t.get("id") if isinstance(t, dict) else None
            if not isinstance(tid, str) or (ids and tid not in ids):
                continue
            if tid in have and int(t.get("version", 1) or 1) <= have[tid]:
                continue
            try:
                url = urljoin(base, str(t.get("file") or ""))
                if urlparse(url).scheme != "https" or urlparse(url).netloc != host:
                    raise ValueError("template file must live next to the update feed")
                r = await client.get(url)
                r.raise_for_status()
                if len(r.content) > MAX_PACK:
                    raise ValueError("template file is too large")
                digest = hashlib.sha256(r.content).hexdigest()
                if t.get("sha256") and digest != str(t["sha256"]).lower():
                    raise ValueError("checksum does not match the release manifest")
                pack = templates.validate_pack(json.loads(r.content))
                if pack["id"] != tid:
                    raise ValueError("template id does not match the release manifest")
                (PULLED / f"{tid}.json").write_bytes(r.content)
                done.append(tid)
            except (httpx.HTTPError, ValueError) as error:
                failed.append({"id": tid, "error": str(error)[:200]})
    reload()
    s = state()
    s.update(remote=remote, checked_at=time.time())
    save_state(s)
    return {"installed": done, "failed": failed, "summary": summary(remote)}
