from __future__ import annotations

import json
import shutil
import time
import urllib.parse
import uuid
from pathlib import Path
from typing import Any

import httpx

from . import config
from .store import project_dir, store

API = "https://polyfork.dev/api"
UA = {"User-Agent": "AuteurFrame/1.0 (+https://github.com/joyghoshs/auteurframe) model import"}
CACHE = config.DATA / "cache" / "polyfork"
CLASSES = ("prop", "building", "vehicle", "character", "animal", "ultra", "attachment", "terrain", "hand")


def _row(a: dict[str, Any]) -> dict[str, Any]:
    return {"id": a.get("id"), "title": a.get("title"), "class": a.get("class"), "triangles": a.get("triangles"), "rigged": bool(a.get("has_rig") or a.get("preview_rigged")),
            "clips": [c.get("name") for c in (a.get("clips") or []) if isinstance(c, dict)], "kit": a.get("kit"), "thumbnail": a.get("thumbnail"),
            "size_m": a.get("size_m")}


async def search(query: str = "", cls: str | None = None, rigged: bool | None = None, max_triangles: int | None = None, limit: int = 12) -> dict[str, Any]:
    params: dict[str, Any] = {"per_page": min(100, max(limit * 3, 20)), "free": 1}
    if query:
        params["q"] = query
    if cls in CLASSES:
        params["class"] = cls
    if max_triangles:
        params["max_triangles"] = int(max_triangles)
    async with httpx.AsyncClient(timeout=30, headers=UA) as client:
        r = await client.get(f"{API}/assets", params=params)
        r.raise_for_status()
        data = r.json()
    rows = [_row(a) for a in data.get("assets", [])]
    if rigged is not None:
        rows = [x for x in rows if x["rigged"] == bool(rigged)]
    return {"total": data.get("total"), "coverage": data.get("coverage"), "results": rows[:limit]}


async def detail(asset_id: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=30, headers=UA) as client:
        r = await client.get(f"{API}/assets/{urllib.parse.quote(asset_id)}")
        r.raise_for_status()
        return r.json()


async def matching(asset_id: str, limit: int = 10) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=30, headers=UA) as client:
        r = await client.get(f"{API}/assets/{urllib.parse.quote(asset_id)}/matching")
        r.raise_for_status()
        data = r.json()
    items = data.get("assets") if isinstance(data, dict) else data
    return [_row(a) for a in (items or [])][:limit]


async def import_model(pid: str, asset_id: str) -> dict[str, Any]:
    meta = await detail(asset_id)
    url = (meta.get("download") or {}).get("glb") or meta.get("preview_glb")
    if not url:
        raise ValueError(f"{asset_id} has no downloadable GLB")
    CACHE.mkdir(parents=True, exist_ok=True)
    cached = CACHE / f"{asset_id}.glb"
    if not cached.exists() or cached.stat().st_size < 100:
        async with httpx.AsyncClient(timeout=120, headers=UA, follow_redirects=True) as client:
            r = await client.get(url)
            r.raise_for_status()
            if not r.content[:4] == b"glTF":
                raise ValueError("download is not a GLB file")
            cached.write_bytes(r.content)
    aid = f"as_{uuid.uuid4().hex[:10]}"
    stored = f"{aid}.glb"
    dest = project_dir(pid) / "assets" / stored
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(cached, dest)
    clips = [{"name": c.get("name"), "seconds": c.get("seconds")} for c in (meta.get("clips") or []) if isinstance(c, dict)]
    asset = {"id": aid, "name": meta.get("title") or asset_id, "file": stored, "kind": "model", "mime": "model/gltf-binary", "size": dest.stat().st_size, "role": "model",
             "url": f"/media/{pid}/assets/{stored}", "added": time.time(),
             "meta": {"source": "polyfork", "source_id": asset_id, "title": meta.get("title"), "clips": clips, "rigged": bool(meta.get("has_rig")),
                      "triangles": meta.get("triangles"), "size_m": meta.get("size_m"), "credit": meta.get("credit"), "license": meta.get("license"), "page": meta.get("page")}}

    def apply(p: dict[str, Any]) -> None:
        p.setdefault("assets", []).append(asset)
        credits = p.setdefault("credits", [])
        if meta.get("credit") and meta["credit"] not in credits:
            credits.append(meta["credit"])
    store.mutate(pid, apply)
    return asset
