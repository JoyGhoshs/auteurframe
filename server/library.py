from __future__ import annotations

import asyncio
import hashlib
import json
import re
from pathlib import Path
from typing import Any

import httpx

from . import compose, config, render, styles

THUMBS = config.DATA / "cache" / "thumbs"
SAFE = re.compile(r"^[a-z0-9][a-z0-9_.-]{0,60}$")
THUMB_W, THUMB_H = 800, 600
LOCKS: dict[str, asyncio.Lock] = {}

PLACE = {
    "toon": lambda v: {"preset": v, "x": 50, "y": 96, "h": 86},
    "toon-animal": lambda v: {"species": v, "x": 50, "y": 90, "h": 58},
    "toon-set": lambda v: {"preset": v},
    "toon-prop": lambda v: {"name": v, "x": 50, "y": 94, "h": 82},
    "model-spec": lambda v: {"model": v, "x": 8, "y": 4, "w": 84, "h": 92},
    "stickman": lambda v: {"style": v, "x": 50, "y": 94, "h": 84} if v else {"x": 50, "y": 94, "h": 84},
    "anime-figure": lambda v: {"preset": v or "schoolgirl", "pose": "stand", "x": 50, "y": 98, "h": 92},
    "anime-set": lambda v: {"preset": v},
    "fx": lambda v: {"kind": v, "at": 0},
    "intro": lambda v: {"style": v, "title": "Your Title", "subtitle": "Subtitle here", "at": 0},
}
BACKDROP = {"toon-set", "anime-set", "fx", "intro", "world3d", "particles"}
AT = {"fx": 1.1, "intro": 1.9}


def valid(component: str, value: str) -> bool:
    return bool(SAFE.match(component or "")) and (not value or bool(SAFE.match(value)))


def params_for(component: str, value: str) -> dict[str, Any]:
    maker = PLACE.get(component)
    if maker:
        return maker(value)
    return {"preset": value} if value else {}


DARK = {("stickman", "chalk"), ("stickman", "neon")}
FX_AT = {"camera-shake": 0.35, "zoom-punch": 0.25, "flash": 0.08, "confetti": 0.9, "glitch": 0.8}


def thumb_time(component: str, value: str) -> float:
    if component == "fx":
        return FX_AT.get(value, 1.1)
    return AT.get(component, 1.6)


def thumb_project(style: str = "editorial-paper") -> dict[str, Any]:
    project = {"id": "library", "title": "library", "width": THUMB_W, "height": THUMB_H, "fps": 30, "seed": 3, "style": style,
               "captions": {"enabled": False}, "assets": [], "cues": [], "options": {}, "scenes": []}
    project["bible"] = styles.build_bible(style, 3, THUMB_W, THUMB_H)
    return project


def thumb_document(component: str, value: str) -> str:
    project = thumb_project("neon-night" if (component, value) in DARK else "editorial-paper")
    layer = {"id": "thumb", "kind": "component", "component": component, "params": params_for(component, value), "start": 0,
             "back": component in BACKDROP and component != "fx", "enter": {"preset": "none"}}
    layers = [layer]
    if component == "fx":
        layers = [{"id": "set", "kind": "component", "component": "toon-set", "params": {"preset": "city-day"}, "start": 0, "back": True, "enter": {"preset": "none"}},
                  {"id": "who", "kind": "component", "component": "toon", "params": {"preset": "teen-girl", "x": 50, "y": 94, "h": 60}, "start": 0, "enter": {"preset": "none"}}, layer]
    scene = {"id": "thumb", "index": 0, "start": 0, "duration": 4.0, "code": '<div class="scene"></div><script>AU.scene(() => {});</script>',
             "layers": layers, "overrides": {}, "ground": "solid", "texture": "none"}
    project["scenes"] = [scene]
    return compose.build_document(project, scene, "render", handle=0.0)


def thumb_path(component: str, value: str) -> Path:
    sig = hashlib.sha1((compose.runtime_signature() + json.dumps(params_for(component, value), sort_keys=True)).encode()).hexdigest()[:10]
    return THUMBS / f"{component}__{value or '_'}__{sig}.jpg"


async def thumbnail(component: str, value: str) -> Path:
    out = thumb_path(component, value)
    if out.exists() and out.stat().st_size > 500:
        return out
    lock = LOCKS.setdefault(out.name, asyncio.Lock())
    async with lock:
        if out.exists() and out.stat().st_size > 500:
            return out
        await render.ensure_renderer()
        THUMBS.mkdir(parents=True, exist_ok=True)
        url = f"{config.PUBLIC_URL}/api/library/doc?component={component}&value={value}"
        async with httpx.AsyncClient(timeout=90) as client:
            r = await client.post(config.RENDERER_URL + "/snapshot", json={"url": url, "width": THUMB_W, "height": THUMB_H, "times": [thumb_time(component, value)],
                                                                         "scale": 0.4, "out": str(out), "quality": 80})
            data = r.json()
        if "error" in data:
            raise RuntimeError(data["error"])
        for old in THUMBS.glob(f"{component}__{value or '_'}__*.jpg"):
            if old != out:
                old.unlink(missing_ok=True)
    return out
