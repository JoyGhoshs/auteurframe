from __future__ import annotations

import json
import re
import shlex
import shutil
import subprocess
import time
import uuid
from functools import lru_cache
from pathlib import Path
from typing import Any

from . import config
from .store import project_dir, store

ENGINES_DIR = config.ROOT / "engines"
FFSKILL = ENGINES_DIR / "ffmpeg-skill"
MANIM_PY = ENGINES_DIR / "manim-venv" / "bin" / "python"
KIND_BY_EXT = {".mp4": "video", ".webm": "video", ".mov": "video", ".mkv": "video", ".gif": "image", ".png": "image", ".jpg": "image", ".jpeg": "image",
               ".webp": "image", ".svg": "svg", ".wav": "audio", ".mp3": "audio", ".m4a": "audio", ".aac": "audio", ".ogg": "audio", ".opus": "audio",
               ".flac": "audio", ".glb": "model", ".json": "data", ".srt": "subtitle", ".vtt": "subtitle"}
MIME = {".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
        ".webp": "image/webp", ".svg": "image/svg+xml", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".glb": "model/gltf-binary", ".json": "application/json"}


@lru_cache(maxsize=1)
def _components() -> dict[str, Any]:
    path = config.WEB / "runtime" / "components.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"common": {}, "components": []}


def list_components(query: str = "") -> str:
    data = _components()
    words = set(re.findall(r"[a-z0-9]{3,}", query.lower()))
    rows = data["components"]
    if words:
        def score(c: dict[str, Any]) -> int:
            blob = f"{c['name']} {c['category']} {c['description']}".lower()
            return sum(3 if w in c["name"] else 1 for w in words if w in blob)
        rows = sorted([c for c in rows if score(c)], key=score, reverse=True) or rows
    return "\n".join(f"- {c['name']} ({c['category']}): {c['description'][:170]}" for c in rows)


def component_info(name: str) -> str:
    data = _components()
    c = next((x for x in data["components"] if x["name"] == name), None)
    if not c:
        raise ValueError(f"unknown component {name}; use list_components")
    lines = [f"{c['name']} ({c['category']}): {c['description']}", "parameters:"]
    for k, spec in c["params"].items():
        opts = f" one of {spec['options']}" if spec.get("options") else ""
        lines.append(f"- {k} ({spec.get('type')}, default {json.dumps(spec.get('default'))}){opts}{': ' + spec['doc'] if spec.get('doc') else ''}")
    lines.append("common parameters (every component): " + ", ".join(f"{k} ({v.get('doc', '')})" for k, v in data["common"].items()))
    lines.append(f"example: {c.get('example', '')}")
    lines.append("Use: add_component " + c["name"] + " with a JSON body, or AU.component('" + c["name"] + "', {...}) inside AU.scene. It returns { el, end }.")
    return "\n".join(lines)


def parse_params(body: str) -> dict[str, Any]:
    text = (body or "").strip()
    if not text:
        return {}
    try:
        value = json.loads(text)
    except json.JSONDecodeError as error:
        raise ValueError(f"body must be a JSON object of parameters ({error.msg} at line {error.lineno} col {error.colno})")
    if not isinstance(value, dict):
        raise ValueError("body must be a JSON object")
    return value


def component_call(name: str, params: dict[str, Any]) -> str:
    if not any(c["name"] == name for c in _components()["components"]):
        raise ValueError(f"unknown component {name!r}; use list_components")
    return f"AU.component({json.dumps(name)}, {json.dumps(params, ensure_ascii=False)});"


def insert_call(code: str, snippet: str) -> str:
    m = list(re.finditer(r"\}\s*\)\s*;?\s*</script>", code))
    if not m:
        return code.rstrip() + f"\n<script>\nAU.scene((ctx) => {{\n  {snippet}\n}});\n</script>\n"
    last = m[-1]
    return code[: last.start()] + f"  {snippet}\n" + code[last.start():]


async def search_models(query: str, opts: dict[str, Any]) -> str:
    from . import assets3d
    res = await assets3d.search(query, opts.get("class"), opts.get("rigged"), opts.get("max_triangles"), int(opts.get("limit", 10)))
    if not res["results"]:
        return f"no models for {query!r}; try simpler words or a class (character, animal, prop, vehicle, building)"
    rows = [f"- {r['id']}: {r['title']} [{r['class']}, {r['triangles']} tris{', rigged' if r['rigged'] else ''}{', kit ' + r['kit'] if r.get('kit') else ''}]" for r in res["results"]]
    return f"{res.get('total')} matches (coverage {res.get('coverage')}). Import with import_model <id>.\n" + "\n".join(rows)


async def import_model(pid: str, model_id: str) -> str:
    from . import assets3d
    asset = await assets3d.import_model(pid, model_id)
    clips = ", ".join(f"{c['name']} ({c.get('seconds')}s)" for c in asset["meta"].get("clips") or []) or "none"
    return (f"imported {asset['meta']['title']} as asset {asset['id']} (rigged: {asset['meta']['rigged']}, clips: {clips}).\n"
            f"Place it: add_component model3d {{\"src\": \"{asset['id']}\", \"clip\": \"Walk\"}}. Credit recorded: {asset['meta'].get('credit')}")


def list_media(project: dict[str, Any]) -> str:
    rows = []
    for a in project.get("assets", []):
        if a.get("kind") not in ("video", "audio", "image", "svg", "model", "data"):
            continue
        m = a.get("meta") or {}
        info = ", ".join(x for x in [f"{m.get('duration'):.2f}s" if isinstance(m.get("duration"), (int, float)) else "",
                                     f"{m.get('width')}x{m.get('height')}" if m.get("width") else "", a.get("role") or ""] if x)
        rows.append(f"- {a['id']} {a['kind']} {a.get('name', '')!r} [{info}] sandbox path /mnt/media/{a['file']}")
    return "\n".join(rows) or "the project has no media yet"


@lru_cache(maxsize=1)
def _contract() -> dict[str, Any]:
    if not FFSKILL.exists():
        return {"tools": []}
    out = subprocess.run(["python3", str(FFSKILL / "scripts" / "_contract.py"), "--json", "--static"], capture_output=True, text=True, timeout=60)
    try:
        return json.loads(out.stdout)
    except json.JSONDecodeError:
        return {"tools": []}


def media_tools(query: str = "") -> str:
    tools = _contract().get("tools", [])
    if not tools:
        return "media tools are not installed (engines/ffmpeg-skill missing)"
    words = set(re.findall(r"[a-z0-9]{3,}", query.lower()))
    rows = []
    for t in tools:
        ex = "; ".join(e.get("command", "") for e in (t.get("examples") or [])[:2])
        blob = f"{t['name']} {t.get('description', '')} {ex}".lower()
        if words and not any(w in blob for w in words):
            continue
        rows.append(f"- {t['name']}: {t.get('description', '')[:120]} | e.g. {ex[:160]}")
    return "Run with: media <tool> <input under /mnt/media or out/> [flags] -o out/<name>. Use media_help <tool> for flags.\n" + "\n".join(rows)


def media_help(tool: str) -> str:
    t = next((x for x in _contract().get("tools", []) if x["name"] == tool), None)
    if not t:
        raise ValueError(f"unknown media tool {tool}; use media_tools")
    schema = t.get("input_schema") or {}
    lines = [f"{t['name']}: {t.get('description', '')}", f"positional: {schema.get('positional', [])}"]
    for k, spec in (schema.get("properties") or {}).items():
        flag = "/".join(spec.get("cli") or []) or k
        extra = f" choices {spec['enum']}" if spec.get("enum") else ""
        lines.append(f"- {flag} ({spec.get('type', '')}{', default ' + str(spec['default']) if 'default' in spec else ''}){extra}: {spec.get('description', '')[:160]}")
    lines.append("examples: " + " | ".join(e.get("command", "") for e in (t.get("examples") or [])[:4]))
    return "\n".join(lines)[:7000]


def media_command(tool: str, args: str) -> str:
    names = {t["name"] for t in _contract().get("tools", [])}
    if tool not in names:
        raise ValueError(f"unknown media tool {tool}; use media_tools")
    parts = shlex.split(args)
    for p in parts:
        if p.startswith("/") and not (p.startswith("/mnt/media/") or p.startswith("/mnt/work/")):
            raise ValueError("inputs must be under /mnt/media/ or your workspace")
    if "--json" not in parts and "--json-brief" not in parts:
        parts.append("--json-brief")
    return "python3 /mnt/engines/ffmpeg-skill/scripts/" + tool + ".py " + " ".join(shlex.quote(p) for p in parts)


def _probe(path: Path) -> dict[str, Any]:
    out = subprocess.run([config.FFPROBE, "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", str(path)], capture_output=True, text=True)
    meta: dict[str, Any] = {}
    try:
        d = json.loads(out.stdout)
        meta["duration"] = float(d.get("format", {}).get("duration") or 0) or None
        v = next((s for s in d.get("streams", []) if s.get("codec_type") == "video"), None)
        if v:
            meta["width"], meta["height"] = v.get("width"), v.get("height")
        meta["has_audio"] = any(s.get("codec_type") == "audio" for s in d.get("streams", []))
    except (json.JSONDecodeError, ValueError):
        pass
    return meta


def import_media(pid: str, path: Path, name: str = "") -> str:
    if not path.exists() or not path.is_file():
        raise ValueError(f"{path.name} does not exist in the workspace")
    ext = path.suffix.lower()
    kind = KIND_BY_EXT.get(ext)
    if kind not in ("video", "image", "svg", "audio", "model", "data"):
        raise ValueError(f"cannot import {ext} files")
    if path.stat().st_size > 400 * 1024 * 1024:
        raise ValueError("file is larger than 400 MB")
    aid = f"as_{uuid.uuid4().hex[:10]}"
    stored = f"{aid}{ext}"
    dest = project_dir(pid) / "assets" / stored
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(path, dest)
    meta = _probe(dest) if kind in ("video", "audio", "image") else {}
    meta["source"] = "agent"
    asset = {"id": aid, "name": name or path.name, "file": stored, "kind": kind, "mime": MIME.get(ext, "application/octet-stream"), "size": dest.stat().st_size,
             "role": "generated", "url": f"/media/{pid}/assets/{stored}", "meta": meta, "added": time.time()}
    store.mutate(pid, lambda p: p.setdefault("assets", []).append(asset))
    use = {"video": f"AU.component('clip', {{ src: '{aid}' }})", "image": f"AU.component('image', {{ src: '{aid}' }})", "svg": f"AU.component('image', {{ src: '{aid}', fit: 'contain' }})",
           "audio": "add it to the soundtrack from the editor", "model": f"AU.component('model3d', {{ src: '{aid}' }})", "data": f"fetch(AU.asset('{aid}'))"}[kind]
    dims = f" {meta.get('width')}x{meta.get('height')}" if meta.get("width") else ""
    dur = f" {meta['duration']:.2f}s" if meta.get("duration") else ""
    return f"imported {path.name} as asset {aid} ({kind}{dims}{dur}). Use: {use}"


def engines_info() -> str:
    rows = [
        f"- manim: {'ready' if MANIM_PY.exists() else 'not installed'}. Python Manim Community 0.19 for equations as Text (no LaTeX installed, so MathTex is unavailable), graphs, geometry, "
        "number lines, transforms. Write a .py file with one Scene class, then render_engine manim scene.py with an optional body "
        "{\"scene\": \"ClassName\", \"transparent\": true}. The clip matches the project size and fps; keep its run time equal to the shot.",
        f"- ffmpeg: {'ready' if FFSKILL.exists() else 'missing'} through the media tools.",
        "- html (AuteurFrame runtime, GSAP, three.js, d3, pixi, p5): always ready; this is scene.html itself.",
        "- remotion, motion-canvas, revideo, hyperframes: not installed as render engines. Read the code-video-frameworks skill and port their patterns "
        "(spring, interpolate, sequences, generator timing) into scene.html with AU.spring and AU.interpolate.",
    ]
    return "\n".join(rows)


def engine_command(engine: str, src: str, opts: dict[str, Any], project: dict[str, Any], scene: dict[str, Any]) -> tuple[str, str]:
    if engine != "manim":
        raise ValueError(f"engine {engine} is not available; see engines")
    if not MANIM_PY.exists():
        raise ValueError("manim is not installed")
    if not re.fullmatch(r"[\w./-]+\.py", src) or ".." in src:
        raise ValueError("give a .py file in your workspace")
    w, h, fps = project["width"], project["height"], project.get("fps", 30)
    scene_name = opts.get("scene") or ""
    if scene_name and not re.fullmatch(r"[A-Za-z_]\w*", scene_name):
        raise ValueError("scene must be a class name")
    transparent = opts.get("transparent", True)
    fmt = "webm" if transparent else "mp4"
    cmd = (f"/mnt/engines/manim-venv/bin/python -m manim render {shlex.quote(src)} {scene_name} --format {fmt} "
           f"{'--transparent ' if transparent else ''}-r {w},{h} --fps {fps} --media_dir out/manim --disable_caching -q h --progress_bar none")
    return cmd, f"out/manim/**/*.{fmt}"


def find_output(root: Path, pattern: str) -> Path | None:
    files = [p for p in root.glob(pattern) if p.is_file() and "partial_movie_files" not in p.parts]
    return max(files, key=lambda p: p.stat().st_mtime) if files else None
