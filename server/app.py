from __future__ import annotations

import asyncio
import io
import json
import mimetypes
import re
import shutil
import time
import random
import uuid
import zipfile
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import audio, compose, config, house, llm, render, research, stock, styles, subtitles, swarm, templates, updates
from .bus import bus
from .skills import library, fetch_skill
from .store import project_dir, store


@asynccontextmanager
async def lifespan(app: FastAPI):
    bus.bind(asyncio.get_running_loop())
    try:
        swarm.recover_orphans()
    except Exception:
        pass
    try:
        updates.reload()
    except Exception:
        pass
    asyncio.create_task(_warm())
    yield
    render.stop_renderer()


async def _warm() -> None:
    try:
        await render.ensure_renderer()
    except Exception as error:
        bus.publish("system", "renderer.error", {"message": str(error)})


app = FastAPI(title="AuteurFrame", version=updates.version(), lifespan=lifespan)
app.mount("/vendor", StaticFiles(directory=config.WEB / "vendor"), name="vendor")
app.mount("/runtime", StaticFiles(directory=config.WEB / "runtime"), name="runtime")
app.mount("/app", StaticFiles(directory=config.WEB / "app"), name="app")
app.mount("/media", StaticFiles(directory=config.PROJECTS), name="media")
if (config.WEB / "_dev").exists():
    app.mount("/_dev", StaticFiles(directory=config.WEB / "_dev"), name="dev")


def _project(pid: str) -> dict[str, Any]:
    try:
        return store.get(pid)
    except KeyError:
        raise HTTPException(404, "project not found")


def _scene(project: dict[str, Any], sid: str) -> dict[str, Any]:
    for scene in project["scenes"]:
        if scene["id"] == sid:
            return scene
    raise HTTPException(404, "scene not found")


def _retime(project: dict[str, Any]) -> None:
    t = 0.0
    for i, scene in enumerate(project["scenes"]):
        scene["index"] = i
        scene["start"] = round(t, 4)
        t += float(scene["duration"])
    if project["scenes"]:
        last = project["scenes"][-1]
        last.setdefault("transition", {})["type"] = "cut"


@app.get("/", response_class=HTMLResponse)
async def index() -> HTMLResponse:
    return HTMLResponse((config.WEB / "index.html").read_text(encoding="utf-8"), headers={"Cache-Control": "no-cache"})


@app.get("/favicon.ico")
async def favicon() -> Response:
    return FileResponse(config.WEB / "app" / "favicon.svg", media_type="image/svg+xml")


@app.get("/api/health")
async def health() -> dict[str, Any]:
    state = await render.health()
    return {"ok": True, "renderer": state, "llm": llm.has_llm(), "skills": len(library.all()), "version": updates.version(), "projects": len(store.list())}


@app.get("/api/styles")
async def get_styles() -> dict[str, Any]:
    return {"styles": styles.catalogue(), "aspects": styles.ASPECTS, "archetypes": templates.KNOWN_ARCHETYPES,
            "transitions": sorted(render.XFADE) + ["cut"], "captions": ["pop", "karaoke", "boxed", "minimal", "typewriter"]}


SAMPLE = {
    "kinetic-title": {"kicker": "Preview", "title": "Motion with *intent*", "subtitle": "Every frame designed, every beat timed."},
}


@app.get("/api/styles/{style_id}/preview", response_class=HTMLResponse)
async def style_preview(style_id: str, aspect: str = "16:9", archetype: str = "kinetic-title", seed: int = 7) -> HTMLResponse:
    w, h = styles.ASPECTS.get(aspect, styles.ASPECTS["16:9"])
    pack = styles.pack(style_id)
    project = {"id": "preview", "width": w, "height": h, "fps": 30, "seed": seed, "style": style_id, "captions": {"enabled": False}, "assets": [], "cues": []}
    project["bible"] = styles.build_bible(style_id, seed, w, h)
    data = {"kicker": pack["category"], "title": f"{pack['name'].split()[0]} *{pack['name'].split()[-1]}*", "subtitle": pack["tagline"], "variant": seed}
    scene = {"index": 0, "start": 0, "duration": 4.0, "archetype": archetype, "data": data}
    return HTMLResponse(compose.build_document(project, scene, "preview"))


class SettingsBody(BaseModel):
    connections: list[dict[str, Any]] | None = None
    routing: dict[str, Any] | None = None
    temperature: float | None = None
    max_tokens: int | None = None
    vision_critic: bool | None = None
    stock: dict[str, Any] | None = None
    media: dict[str, Any] | None = None


@app.get("/api/settings")
async def get_settings() -> dict[str, Any]:
    return llm.public_settings()


@app.post("/api/settings")
async def post_settings(body: SettingsBody) -> dict[str, Any]:
    return llm.write_settings({k: v for k, v in body.model_dump().items() if v is not None})


@app.post("/api/settings/test")
async def test_settings(body: dict[str, Any]) -> dict[str, Any]:
    return await llm.ping(body.get("connection"))


@app.post("/api/settings/models")
async def settings_models(body: dict[str, Any]) -> dict[str, Any]:
    return {"models": await llm.list_models(body.get("provider", "custom"), body.get("base_url", ""), body.get("api_key", ""), body.get("id"))}


class ProjectBody(BaseModel):
    title: str = "Untitled film"
    brief: str = ""
    aspect: str = "16:9"
    style: str = "editorial-paper"
    duration: float = 30.0
    fps: int = 30
    options: dict[str, Any] | None = None
    captions: dict[str, Any] | None = None


@app.get("/api/projects")
async def list_projects() -> dict[str, Any]:
    return {"projects": store.list()}


@app.post("/api/projects")
async def create_project(body: ProjectBody) -> dict[str, Any]:
    if body.aspect not in styles.ASPECTS:
        raise HTTPException(400, "unknown aspect")
    auto = body.style == "auto"
    style = styles.auto_pack(body.brief, styles.ASPECTS[body.aspect][1] > styles.ASPECTS[body.aspect][0]) if auto else body.style
    project = store.create(title=body.title.strip()[:120] or "Untitled film", brief=body.brief[:12000], aspect=body.aspect, style=style,
                           duration=max(5.0, min(600.0, body.duration)), fps=body.fps if body.fps in (24, 25, 30, 60) else 30)
    if body.options or body.captions or auto:
        def apply(p: dict[str, Any]) -> None:
            p["options"].update(body.options or {})
            p["captions"].update(body.captions or {})
            if auto:
                p["options"]["auto_style"] = True
        project = store.mutate(project["id"], apply)
    return project


@app.get("/api/projects/{pid}")
async def get_project(pid: str) -> dict[str, Any]:
    project = _project(pid)
    run = swarm.RUNS.get(pid)
    project["run"] = run.summary() if run else None
    return project


ALLOWED_PATCH = {"title", "brief", "style", "aspect", "duration_target", "captions", "audio", "options", "bible_overrides", "fps", "lens"}


@app.patch("/api/projects/{pid}")
async def patch_project(pid: str, body: dict[str, Any]) -> dict[str, Any]:
    _project(pid)

    def apply(p: dict[str, Any]) -> None:
        for key, value in body.items():
            if key not in ALLOWED_PATCH:
                continue
            if key in ("captions", "audio", "options") and isinstance(value, dict):
                p[key].update(value)
            else:
                p[key] = value
        if "aspect" in body and body["aspect"] in styles.ASPECTS:
            p["width"], p["height"] = styles.ASPECTS[body["aspect"]]
        if "style" in body or "aspect" in body or "bible_overrides" in body:
            p["bible"] = styles.build_bible(p["style"], p["seed"], p["width"], p["height"], overrides=p.get("bible_overrides"))
        if "palette" in body and isinstance(body["palette"], dict):
            p["bible"]["palette"].update({k: v for k, v in body["palette"].items() if re.fullmatch(r"#[0-9A-Fa-f]{6}|rgba?\([^)]*\)", str(v))})
            p.setdefault("bible_overrides", {}).setdefault("palette", {}).update(body["palette"])
    project = store.mutate(pid, apply, revision=True, reason="project settings")
    bus.publish(pid, "project.update", {"keys": list(body.keys())})
    return project


@app.delete("/api/projects/{pid}")
async def delete_project(pid: str) -> dict[str, Any]:
    _project(pid)
    swarm.cancel(pid)
    store.delete(pid)
    return {"ok": True}


@app.post("/api/projects/{pid}/duplicate")
async def duplicate_project(pid: str) -> dict[str, Any]:
    src = _project(pid)
    copy = store.create(title=src["title"] + " copy", brief=src["brief"], aspect=src["aspect"], style=src["style"], duration=src["duration_target"], fps=src["fps"])
    for key in ("scenes", "cues", "captions", "audio", "options", "bible", "assets"):
        copy[key] = json.loads(json.dumps(src[key]))
    for item in src.get("assets", []):
        source = project_dir(pid) / "assets" / item["file"]
        if source.exists():
            shutil.copy2(source, project_dir(copy["id"]) / "assets" / item["file"])
    for a in copy["assets"]:
        a["url"] = f"/media/{copy['id']}/assets/{a['file']}"
    copy["outputs"] = {}
    return store.save(copy)


def _kind(name: str, mime: str) -> str:
    low = name.lower()
    if low.endswith((".srt", ".vtt", ".ass", ".ssa")) or (low.endswith(".json") and "subtitle" in low):
        return "subtitle"
    if low.endswith(".svg"):
        return "svg"
    if mime.startswith("image/"):
        return "image"
    if mime.startswith("video/"):
        return "video"
    if mime.startswith("audio/"):
        return "audio"
    if low.endswith((".json",)):
        return "data"
    if low.endswith((".ttf", ".otf", ".woff", ".woff2")):
        return "font"
    if low.endswith((".md", ".txt", ".csv", ".pdf", ".docx")):
        return "document"
    return "file"


@app.post("/api/projects/{pid}/assets")
async def upload_asset(pid: str, file: UploadFile = File(...), role: str = Form("reference")) -> dict[str, Any]:
    _project(pid)
    name = re.sub(r"[^\w.\- ]+", "_", file.filename or "upload")[:120]
    mime = file.content_type or ""
    if not mime or mime in ("application/octet-stream", "binary/octet-stream"):
        mime = mimetypes.guess_type(name)[0] or {".m4a": "audio/mp4", ".webm": "video/webm", ".mkv": "video/x-matroska"}.get(Path(name).suffix.lower(), "application/octet-stream")
    kind = _kind(name, mime)
    aid = "as_" + uuid.uuid4().hex[:10]
    ext = Path(name).suffix.lower()[:8]
    stored = f"{aid}{ext}"
    target = project_dir(pid) / "assets" / stored
    size = 0
    with open(target, "wb") as handle:
        while chunk := await file.read(1 << 20):
            size += len(chunk)
            if size > config.MAX_UPLOAD_MB * (1 << 20):
                handle.close()
                target.unlink(missing_ok=True)
                raise HTTPException(413, "file too large")
            handle.write(chunk)
    meta: dict[str, Any] = {}
    if kind in ("video", "audio"):
        info = render.probe_media(target)
        meta["duration"] = float(info.get("format", {}).get("duration", 0) or 0)
        for s in info.get("streams", []):
            if s.get("width"):
                meta["width"], meta["height"] = s["width"], s["height"]
    elif kind == "image":
        try:
            from PIL import Image
            with Image.open(target) as im:
                meta["width"], meta["height"] = im.size
        except Exception:
            pass
    if kind == "audio" and role == "reference":
        role = "music"
    asset = {"id": aid, "name": name, "file": stored, "kind": kind, "mime": mime, "size": size, "role": role, "url": f"/media/{pid}/assets/{stored}", "meta": meta, "added": time.time()}
    result: dict[str, Any] = {"asset": asset}
    if kind == "subtitle" or (kind == "data" and role == "subtitles"):
        text = target.read_text(encoding="utf-8", errors="ignore")
        try:
            parsed = subtitles.parse(text, name)
        except Exception as error:
            raise HTTPException(400, f"could not read subtitles: {error}")
        if not parsed["cues"]:
            raise HTTPException(400, "no timed lines found in this subtitle file; expected SRT, VTT, ASS or JSON with start and end times")
        asset["kind"] = "subtitle"

        def apply_sub(p: dict[str, Any]) -> None:
            p["cues"] = parsed["cues"]
            p["subtitle_file"] = asset["id"]
            p["cues_synthetic"] = False
            if parsed["duration"]:
                p["duration_target"] = round(parsed["duration"] + 1.0, 2)
            p["assets"].append(asset)
        store.mutate(pid, apply_sub, revision=True, reason="subtitles")
        result["subtitles"] = {k: v for k, v in parsed.items() if k != "cues"} | {"count": len(parsed["cues"])}
    else:
        def apply(p: dict[str, Any]) -> None:
            p["assets"].append(asset)
            if kind == "audio" and role == "voice":
                p["audio"]["voice"] = aid
            elif kind == "audio" and role == "music":
                p["audio"]["music"] = aid
        store.mutate(pid, apply)
    bus.publish(pid, "asset.added", {"asset": asset})
    return result


@app.patch("/api/projects/{pid}/assets/{aid}")
async def patch_asset(pid: str, aid: str, body: dict[str, Any]) -> dict[str, Any]:
    def apply(p: dict[str, Any]) -> None:
        for a in p["assets"]:
            if a["id"] == aid:
                for k in ("name", "role"):
                    if k in body:
                        a[k] = body[k]
                if a["kind"] == "audio" and body.get("role") in ("voice", "music"):
                    p["audio"][body["role"]] = aid
    return store.mutate(pid, apply)


@app.delete("/api/projects/{pid}/assets/{aid}")
async def delete_asset(pid: str, aid: str) -> dict[str, Any]:
    def apply(p: dict[str, Any]) -> None:
        p["assets"] = [a for a in p["assets"] if a["id"] != aid]
        if p.get("subtitle_file") == aid:
            p["cues"], p["subtitle_file"] = [], None
        for key in ("voice", "music"):
            if p["audio"].get(key) == aid:
                p["audio"][key] = "auto" if key == "music" else None
    return store.mutate(pid, apply, revision=True, reason="remove asset")


@app.post("/api/projects/{pid}/subtitles")
async def set_subtitles(pid: str, body: dict[str, Any]) -> dict[str, Any]:
    text = body.get("text", "")
    if not text.strip():
        def clear(p: dict[str, Any]) -> None:
            p["cues"], p["subtitle_file"] = [], None
        store.mutate(pid, clear)
        return {"count": 0}
    try:
        parsed = subtitles.parse(text, body.get("filename", ""))
    except Exception as error:
        raise HTTPException(400, f"could not read subtitles: {error}")
    if not parsed["cues"]:
        raise HTTPException(400, "no timed lines found; expected SRT, VTT, ASS or JSON with start and end times")

    def apply(p: dict[str, Any]) -> None:
        p["cues"] = parsed["cues"]
        p["cues_synthetic"] = False
        if parsed["duration"]:
            p["duration_target"] = round(parsed["duration"] + 1.0, 2)
    store.mutate(pid, apply, revision=True, reason="subtitles")
    return {k: v for k, v in parsed.items() if k != "cues"} | {"count": len(parsed["cues"]), "cues": parsed["cues"]}


@app.patch("/api/projects/{pid}/cues/{cue_id}")
async def patch_cue(pid: str, cue_id: int, body: dict[str, Any]) -> dict[str, Any]:
    def apply(p: dict[str, Any]) -> None:
        for cue in p["cues"]:
            if cue.get("id") == cue_id:
                s0, e0 = float(cue["start"]), float(cue["end"])
                for k in ("text", "start", "end"):
                    if k in body:
                        cue[k] = round(float(body[k]), 4) if k != "text" else str(body[k])
                if "text" in body:
                    cue.pop("words", None)
                elif cue.get("words") and ("start" in body or "end" in body):
                    s1, e1 = float(cue["start"]), float(cue["end"])
                    k = (e1 - s1) / max(1e-6, e0 - s0)
                    cue["words"] = [dict(w, t=round(s1 + (float(w.get("t", s0)) - s0) * k, 4), e=round(s1 + (float(w.get("e", w.get("t", s0))) - s0) * k, 4)) for w in cue["words"]]
        p["cues"].sort(key=lambda c: float(c["start"]))
    store.mutate(pid, apply, revision=True, reason=f"cue {cue_id}")
    bus.publish(pid, "project.update", {"keys": ["cues"], "by": "user"})
    return {"ok": True}


@app.delete("/api/projects/{pid}/cues/{cue_id}")
async def delete_cue(pid: str, cue_id: int) -> dict[str, Any]:
    store.mutate(pid, lambda p: p.__setitem__("cues", [c for c in p["cues"] if c.get("id") != cue_id]), revision=True, reason=f"delete cue {cue_id}")
    bus.publish(pid, "project.update", {"keys": ["cues"], "by": "user"})
    return {"ok": True}


def _next_cue_id(p: dict[str, Any]) -> int:
    return max([int(c.get("id", 0)) for c in p.get("cues") or []] + [-1]) + 1


@app.post("/api/projects/{pid}/cues/{cue_id}/split")
async def split_cue(pid: str, cue_id: int, body: dict[str, Any]) -> dict[str, Any]:
    at = float(body.get("at", -1))

    def apply(p: dict[str, Any]) -> None:
        cue = next((c for c in p["cues"] if c.get("id") == cue_id), None)
        if not cue or not (float(cue["start"]) + 0.05 < at < float(cue["end"]) - 0.05):
            raise HTTPException(400, "put the playhead inside the caption to split it")
        words = cue.get("words") or []
        if words:
            left = [w for w in words if float(w["t"]) < at]
            right = [w for w in words if float(w["t"]) >= at]
            ta, tb = " ".join(w["w"] for w in left), " ".join(w["w"] for w in right)
        else:
            toks = str(cue["text"]).split()
            k = max(1, min(len(toks) - 1, round(len(toks) * (at - float(cue["start"])) / max(1e-6, float(cue["end"]) - float(cue["start"])))))
            ta, tb, left, right = " ".join(toks[:k]), " ".join(toks[k:]), [], []
        new = {"id": _next_cue_id(p), "start": round(at, 4), "end": cue["end"], "text": tb or cue["text"]}
        if right:
            new["words"] = right
        cue["end"] = round(at, 4)
        cue["text"] = ta or cue["text"]
        if words:
            cue["words"] = left
        p["cues"].append(new)
        p["cues"].sort(key=lambda c: float(c["start"]))
    store.mutate(pid, apply, revision=True, reason=f"split cue {cue_id}")
    bus.publish(pid, "project.update", {"keys": ["cues"], "by": "user"})
    return {"ok": True}


@app.post("/api/projects/{pid}/cues/{cue_id}/merge")
async def merge_cue(pid: str, cue_id: int) -> dict[str, Any]:
    def apply(p: dict[str, Any]) -> None:
        cues = sorted(p["cues"], key=lambda c: float(c["start"]))
        i = next((k for k, c in enumerate(cues) if c.get("id") == cue_id), None)
        if i is None or i + 1 >= len(cues):
            raise HTTPException(400, "there is no next caption to merge with")
        a, b = cues[i], cues[i + 1]
        a["end"] = b["end"]
        a["text"] = f"{a['text']} {b['text']}".strip()
        if a.get("words") or b.get("words"):
            a["words"] = (a.get("words") or []) + (b.get("words") or [])
        p["cues"] = [c for c in cues if c is not b]
    store.mutate(pid, apply, revision=True, reason=f"merge cue {cue_id}")
    bus.publish(pid, "project.update", {"keys": ["cues"], "by": "user"})
    return {"ok": True}


@app.post("/api/projects/{pid}/cues")
async def add_cue(pid: str, body: dict[str, Any]) -> dict[str, Any]:
    t = max(0.0, float(body.get("start", 0)))

    def apply(p: dict[str, Any]) -> None:
        nxt = min([float(c["start"]) for c in p.get("cues") or [] if float(c["start"]) > t] + [t + 2.0])
        if any(float(c["start"]) <= t < float(c["end"]) for c in p.get("cues") or []):
            raise HTTPException(400, "a caption already covers this time")
        p.setdefault("cues", []).append({"id": _next_cue_id(p), "start": round(t, 4), "end": round(min(nxt, t + float(body.get("duration", 2.0))), 4), "text": str(body.get("text") or "New caption")[:300]})
        p["cues"].sort(key=lambda c: float(c["start"]))
    store.mutate(pid, apply, revision=True, reason="add cue")
    bus.publish(pid, "project.update", {"keys": ["cues"], "by": "user"})
    return {"ok": True}


@app.post("/api/projects/{pid}/scenes/{sid}/duplicate")
async def duplicate_scene(pid: str, sid: str) -> dict[str, Any]:
    import copy

    def apply(p: dict[str, Any]) -> None:
        i = next(k for k, s in enumerate(p["scenes"]) if s["id"] == sid)
        b = copy.deepcopy(p["scenes"][i])
        b["id"] = f"sc_{uuid.uuid4().hex[:8]}"
        b["title"] = (b.get("title") or "Scene") + " copy"
        b.pop("render", None)
        b["status"] = "written" if b.get("code") else "planned"
        p["scenes"].insert(i + 1, b)
        _retime(p)
    _scene(_project(pid), sid)
    project = store.mutate(pid, apply, revision=True, reason=f"duplicate {sid}")
    bus.publish(pid, "project.scenes", {"count": len(project["scenes"])})
    return project


@app.post("/api/projects/{pid}/audio/to-clip")
async def audio_to_clip(pid: str, body: dict[str, Any]) -> dict[str, Any]:
    project = _project(pid)
    which = body.get("track", "music")
    cfg = project.get("audio") or {}
    total = round(sum(float(s["duration"]) for s in project["scenes"]), 3)
    asset = None
    if which == "voice":
        asset = next((a for a in project["assets"] if a["id"] == cfg.get("voice")), None)
        if not asset:
            raise HTTPException(400, "there is no voiceover")
        gain = 1.0
    else:
        choice = cfg.get("music") or ""
        asset = next((a for a in project["assets"] if a["id"] == choice), None)
        if not asset:
            if not (choice == "auto" or str(choice).startswith("mood:")):
                raise HTTPException(400, "there is no music bed")
            aid = "as_" + uuid.uuid4().hex[:10]
            out = project_dir(pid) / "assets" / f"{aid}.wav"
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, lambda: audio.music_bed(total, project.get("style", ""), int(project.get("seed", 1)), out, mood=choice[5:] if str(choice).startswith("mood:") else None))
            asset = {"id": aid, "name": "Generated score", "file": out.name, "kind": "audio", "mime": "audio/wav", "size": out.stat().st_size, "role": "music",
                     "url": f"/media/{pid}/assets/{out.name}", "meta": {"duration": total, "generated": True}, "added": time.time()}
        gain = round(10 ** ((float(cfg.get("music_gain", -18.0)) + 12) / 20), 3)
    clip = {"id": "c" + uuid.uuid4().hex[:6], "asset": asset["id"], "name": asset.get("name") or which, "t": 0.0, "in": 0.0,
            "dur": round(min(total, float((asset.get("meta") or {}).get("duration") or total)), 3), "gain": gain, "fade_in": 0.02, "fade_out": 0.4 if which == "music" else 0.02, "role": which}

    def apply(p: dict[str, Any]) -> None:
        if not any(a["id"] == asset["id"] for a in p["assets"]):
            p["assets"].append(asset)
        a = p.setdefault("audio", {})
        a.setdefault("clips", []).append(clip)
        if which == "voice":
            a["voice"] = None
        else:
            a["music"] = ""
    store.mutate(pid, apply, revision=True, reason=f"{which} to clip")
    bus.publish(pid, "project.update", {"keys": ["audio", "assets"], "by": "user"})
    return {"clip": clip}


SCENE_FIELDS = {"title", "narration", "onscreen", "visual", "archetype", "data", "code", "layers", "overrides", "transition", "duration", "locked", "ground", "texture", "variant", "reseed", "lens"}


@app.patch("/api/projects/{pid}/scenes/{sid}")
async def patch_scene(pid: str, sid: str, body: dict[str, Any]) -> dict[str, Any]:
    project = _project(pid)
    _scene(project, sid)
    retime = "duration" in body

    def apply(p: dict[str, Any]) -> None:
        scene = _scene(p, sid)
        for key, value in body.items():
            if key in SCENE_FIELDS:
                scene[key] = value
        if "code" in body:
            scene["source"] = "user" if body["code"] else "house"
        if "duration" in body:
            scene["duration"] = max(0.5, min(120.0, float(body["duration"])))
        scene["status"] = "edited" if scene.get("status") in ("rendered", "written", "edited") else scene.get("status", "planned")
        if retime:
            _retime(p)
    project = store.mutate(pid, apply, revision=bool({"code", "duration", "archetype"} & body.keys()), reason=f"edit {sid}")
    scene = _scene(project, sid)
    bus.publish(pid, "scene.update", {"id": sid, "index": scene["index"], "patch": {k: v for k, v in body.items() if k != "code"}, "by": "user"})
    return scene


@app.post("/api/projects/{pid}/scenes")
async def add_scene(pid: str, body: dict[str, Any]) -> dict[str, Any]:
    def apply(p: dict[str, Any]) -> None:
        at = int(body.get("at", len(p["scenes"])))
        arch = body.get("archetype", "kinetic-title")
        text = body.get("narration") or body.get("title") or "New scene"
        scene = {"id": f"sc_{uuid.uuid4().hex[:8]}", "index": at, "title": body.get("title", "New scene"), "purpose": "", "start": 0, "duration": float(body.get("duration", 4.0)),
                 "narration": body.get("narration", ""), "onscreen": "", "visual": "", "archetype": arch, "data": body.get("data") or house.build_data(arch, text, {"index": at}),
                 "variant": 0, "code": None, "source": "user", "status": "planned", "layers": [], "overrides": {}, "transition": {"type": "fade", "duration": 0.5}}
        p["scenes"].insert(at, scene)
        _retime(p)
    return store.mutate(pid, apply, revision=True, reason="add scene")


@app.delete("/api/projects/{pid}/scenes/{sid}")
async def delete_scene(pid: str, sid: str) -> dict[str, Any]:
    def apply(p: dict[str, Any]) -> None:
        p["scenes"] = [s for s in p["scenes"] if s["id"] != sid]
        _retime(p)
    return store.mutate(pid, apply, revision=True, reason="delete scene")


@app.post("/api/projects/{pid}/scenes/reorder")
async def reorder(pid: str, body: dict[str, Any]) -> dict[str, Any]:
    order = body.get("order", [])

    def apply(p: dict[str, Any]) -> None:
        by = {s["id"]: s for s in p["scenes"]}
        p["scenes"] = [by[i] for i in order if i in by] + [s for s in p["scenes"] if s["id"] not in order]
        _retime(p)
    return store.mutate(pid, apply, revision=True, reason="reorder")


@app.get("/api/projects/{pid}/scenes/{sid}/doc", response_class=HTMLResponse)
async def scene_doc(pid: str, sid: str, mode: str = "preview") -> HTMLResponse:
    project = _project(pid)
    scene = _scene(project, sid)
    doc = compose.build_document(project, scene, mode if mode in ("preview", "edit", "render") else "preview", handle=0.0)
    return HTMLResponse(doc, headers={"Cache-Control": "no-store"})


@app.get("/api/projects/{pid}/scenes/{sid}/code")
async def scene_code(pid: str, sid: str) -> dict[str, Any]:
    project = _project(pid)
    scene = _scene(project, sid)
    code = scene.get("code") or compose.house_fragment(scene.get("archetype") or "kinetic-title")
    return {"code": code, "source": scene.get("source"), "agent_code": scene.get("agent_code"), "archetype": scene.get("archetype"), "data": scene.get("data")}


@app.post("/api/projects/{pid}/run")
async def run_project(pid: str, body: dict[str, Any]) -> dict[str, Any]:
    project = _project(pid)
    mode = body.get("mode", "full")
    if mode not in ("full", "plan", "render", "house", "edit"):
        raise HTTPException(400, "unknown mode")
    if mode == "render" and not project["scenes"]:
        mode = "full"
    if body.get("options"):
        store.mutate(pid, lambda p: p["options"].update(body["options"]))
    try:
        run = swarm.start(pid, mode, body.get("options"))
    except RuntimeError as error:
        raise HTTPException(409, str(error))
    return run.summary()


@app.post("/api/projects/{pid}/cancel")
async def cancel_run(pid: str) -> dict[str, Any]:
    return {"cancelled": swarm.cancel(pid)}


@app.get("/api/projects/{pid}/run")
async def run_state(pid: str) -> dict[str, Any]:
    run = swarm.RUNS.get(pid)
    return {"run": run.summary() if run else None, "roster": swarm.ROSTER}


@app.post("/api/projects/{pid}/scenes/{sid}/chat")
async def scene_chat(pid: str, sid: str, body: dict[str, Any]) -> dict[str, Any]:
    project = _project(pid)
    _scene(project, sid)
    instruction = (body.get("message") or "").strip()[:2000]
    if not instruction:
        raise HTTPException(400, "empty message")
    bus.publish(pid, "chat.user", {"scene": sid, "message": instruction})
    if not llm.has_llm():
        scene = _scene(project, sid)
        arch = scene.get("archetype")
        low = instruction.lower()
        patch: dict[str, Any] = {"variant": int(scene.get("variant", 0)) + 1}
        for name in ("big-number", "word-stack", "list-reveal", "versus", "timeline", "quote", "icon-grid", "process-flow", "doodle-explain", "kinetic-title", "end-card", "line-chart", "bar-race", "donut", "equation"):
            if name.replace("-", " ") in low or name in low:
                patch["archetype"] = name
                patch["data"] = house.build_data(name, scene.get("narration") or scene.get("title", ""), {"index": scene["index"]})
        for key, word in (("slower", 1.2), ("longer", 1.2), ("faster", 0.85), ("shorter", 0.85)):
            if key in low:
                patch["duration"] = round(float(scene["duration"]) * word, 2)
        await patch_scene(pid, sid, patch)
        bus.publish(pid, "chat.agent", {"scene": sid, "message": "No model is connected, so the house director re-cut this scene: " + ", ".join(f"{k} → {v}" for k, v in patch.items() if k != "data")})
        return {"mode": "house", "patch": patch}
    try:
        run = swarm.start(pid, "scene", {}, scene_id=sid, instruction=instruction)
    except RuntimeError as error:
        raise HTTPException(409, str(error))
    return run.summary()


@app.post("/api/projects/{pid}/replicate")
async def replicate(pid: str, body: dict[str, Any]) -> dict[str, Any]:
    project = _project(pid)
    if not llm.has_llm():
        raise HTTPException(400, "connect a model in Settings to replicate with agents")
    mode = body.get("mode") if body.get("mode") in ("replicate", "extend", "variation") else "replicate"
    count = max(1, min(4, int(body.get("count") or 1)))
    instruction = str(body.get("instruction") or "").strip()[:1500]
    lines = [x.strip() for x in str(body.get("narration") or "").split("\n") if x.strip()]
    source = next((s for s in project["scenes"] if s["id"] == body.get("scene_id")), None)
    ref_asset = next((a for a in project.get("assets", []) if a["id"] == body.get("asset_id") and a.get("kind") in ("image", "video")), None)
    if not source and not ref_asset:
        raise HTTPException(400, "choose a source scene or a reference image or video")
    at = (source["index"] + 1) if source else len(project["scenes"])
    words = {"replicate": "Recreate the reference as a new shot: same look, layout, characters and motion",
             "extend": "Continue the story right after the reference: same characters with identical parameters, same set, palette and style; show the next beat",
             "variation": "Make a fresh variation of the reference beat: same story moment and style, a different composition, camera and choreography"}[mode]
    new_ids = []
    new_scenes = []
    for i in range(count):
        sid = f"sc_{uuid.uuid4().hex[:8]}"
        new_ids.append(sid)
        nar = lines[i] if i < len(lines) else ("" if mode == "extend" else (source or {}).get("narration", ""))
        step = f" (part {i + 1} of {count}, each part advances the action)" if count > 1 and mode == "extend" else ""
        new_scenes.append({
            "id": sid, "index": 0, "title": f"{(source or {}).get('title') or 'Reference'} {mode} {i + 1}"[:90], "purpose": (source or {}).get("purpose", ""),
            "start": 0.0, "duration": float((source or {}).get("duration") or body.get("duration") or 5.0), "narration": nar, "onscreen": (source or {}).get("onscreen", ""),
            "visual": f"{words}{step}. {instruction}".strip(), "archetype": (source or {}).get("archetype") or "kinetic-title", "data": dict((source or {}).get("data") or {}),
            "variant": random.randrange(12), "code": None, "source": "agent", "status": "planned", "layers": [], "overrides": {}, "cue_ids": [],
            "technique": "code", "skills": list((source or {}).get("skills") or [])[:3], "instruments": list(dict.fromkeys(((source or {}).get("instruments") or []) + ["character"]))[:8],
            "transition": dict((source or {}).get("transition") or {"type": "fade", "duration": 0.5}), "direction": f"{words}{step}. {instruction}".strip(),
            "reference_code": (source or {}).get("code") or "", "reference_asset": ref_asset["id"] if ref_asset else None, "origin": {"mode": mode, "from": (source or {}).get("id"), "asset": ref_asset and ref_asset["id"]},
        })

    def apply(p: dict[str, Any]) -> None:
        p["scenes"][at:at] = new_scenes
        _retime(p)
    store.mutate(pid, apply, revision=True, reason=f"replicate with agent ({mode})")
    bus.publish(pid, "project.scenes", {"count": len(store.get(pid)["scenes"])})
    try:
        run = swarm.start(pid, "scenes", {}, scene_ids=new_ids, instruction=instruction)
    except RuntimeError as error:
        raise HTTPException(409, str(error))
    return {"scenes": new_ids, "run": run.summary()}


@app.post("/api/projects/{pid}/scenes/{sid}/thumb")
async def scene_thumb(pid: str, sid: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
    project = _project(pid)
    scene = _scene(project, sid)
    path = await render.snapshot(project, scene, (body or {}).get("t"))
    url = f"/media/{pid}/renders/thumbs/{path.name}?v={int(time.time())}"
    store.update_scene(pid, sid, {"thumb": url})
    return {"thumb": url}


@app.get("/api/projects/{pid}/events")
async def events(pid: str, request: Request, since: int = 0) -> StreamingResponse:
    queue = bus.subscribe(pid)
    system = bus.subscribe("system")

    async def stream():
        try:
            for event in bus.recent(pid, 400):
                if event["seq"] > since:
                    yield f"id: {event['seq']}\ndata: {json.dumps(event, ensure_ascii=False)}\n\n"
            yield ": ready\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    getter = asyncio.ensure_future(queue.get())
                    sysget = asyncio.ensure_future(system.get())
                    done, pending = await asyncio.wait({getter, sysget}, timeout=15, return_when=asyncio.FIRST_COMPLETED)
                    for p in pending:
                        p.cancel()
                    if not done:
                        yield ": ping\n\n"
                        continue
                    for d in done:
                        event = d.result()
                        yield f"id: {event['seq']}\ndata: {json.dumps(event, ensure_ascii=False)}\n\n"
                except asyncio.CancelledError:
                    break
        finally:
            bus.unsubscribe(pid, queue)
            bus.unsubscribe("system", system)
    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.get("/api/projects/{pid}/revisions")
async def revisions(pid: str) -> dict[str, Any]:
    _project(pid)
    return {"revisions": store.revisions(pid)}


@app.post("/api/projects/{pid}/revisions/{rev}")
async def restore(pid: str, rev: str) -> dict[str, Any]:
    _project(pid)
    try:
        return store.restore(pid, rev)
    except (KeyError, OSError):
        raise HTTPException(404, "revision not found")


@app.get("/api/projects/{pid}/export")
async def export_bundle(pid: str) -> Response:
    project = _project(pid)
    folder = project_dir(pid)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name in ("master.mp4", "poster.jpg", "subtitles.srt"):
            path = folder / "out" / name
            if path.exists():
                zf.write(path, f"film/{name}")
        for scene in project["scenes"]:
            zf.writestr(f"scenes/{scene['index'] + 1:02d}-{scene['id']}.html", compose.build_document(project, scene, "preview"))
            if scene.get("code"):
                zf.writestr(f"scenes/{scene['index'] + 1:02d}-{scene['id']}.fragment.html", scene["code"])
        zf.writestr("project.json", json.dumps(project, indent=1, ensure_ascii=False))
        zf.writestr("README.txt", "AuteurFrame export. Scene documents expect the AuteurFrame runtime at /vendor and /runtime (serve the studio web folder next to them).\n")
        used = set()
        for name in ("composition-contract", "motion-rules-core", "art-direction-bible", "subtitle-sync"):
            skill = library.get(name)
            if skill and name not in used:
                zf.write(skill.path, f"skills/{name}/SKILL.md")
                used.add(name)
    slug = re.sub(r"[^a-z0-9]+", "-", project["title"].lower()).strip("-") or "film"
    return Response(buf.getvalue(), media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="{slug}-auteurframe.zip"'})


@app.get("/api/skills")
async def list_skills() -> dict[str, Any]:
    return {"skills": [s.summary() for s in library.all()]}


@app.get("/api/skills/{name}")
async def get_skill(name: str) -> dict[str, Any]:
    skill = library.get(name)
    if not skill:
        raise HTTPException(404, "skill not found")
    return {**skill.summary(), "body": skill.body, "raw": skill.path.read_text(encoding="utf-8")}


@app.post("/api/skills")
async def save_skill(body: dict[str, Any]) -> dict[str, Any]:
    name = body.get("name", "").strip()
    text = body.get("text", "")
    if not name or len(text) < 20:
        raise HTTPException(400, "name and text are required")
    skill = library.save_user_skill(name, text, body.get("source", "user"))
    return skill.summary()


@app.post("/api/skills/import")
async def import_skill(body: dict[str, Any]) -> dict[str, Any]:
    url = body.get("url", "").strip()
    if not re.match(r"^https://", url):
        raise HTTPException(400, "an https address is required")
    try:
        text, source = await fetch_skill(url)
    except Exception as error:
        raise HTTPException(400, str(error))
    name = body.get("name") or re.sub(r"[^a-z0-9]+", "-", url.rstrip("/").split("/")[-1].lower().replace(".md", ""))
    if name in ("skill", "readme"):
        name = re.sub(r"[^a-z0-9]+", "-", url.rstrip("/").split("/")[-2].lower())
    skill = library.save_user_skill(name, text, source)
    return skill.summary()


@app.post("/api/skills/{name}/toggle")
async def toggle_skill(name: str, body: dict[str, Any]) -> dict[str, Any]:
    try:
        library.toggle(name, bool(body.get("enabled", True)))
    except KeyError:
        raise HTTPException(404, "skill not found")
    return {"ok": True}


@app.post("/api/skills/scout")
async def scout_skills(body: dict[str, Any]) -> dict[str, Any]:
    from . import agents
    need = body.get("need", "").strip()
    if not need:
        raise HTTPException(400, "describe the skill you need")
    names = await agents.import_skill_for({}, need, lambda k, d: bus.publish("system", k, d))
    return {"imported": names}


@app.get("/api/skills.zip")
async def skills_zip() -> Response:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for skill in library.all():
            zf.write(skill.path, f"auteurframe-skills/{skill.name}/SKILL.md")
        zf.writestr("auteurframe-skills/README.md", "Universal motion-design skills. Each folder holds a SKILL.md with frontmatter (name, description, stage, tags). Load the ones whose stage matches the agent's job.\n")
    return Response(buf.getvalue(), media_type="application/zip", headers={"Content-Disposition": 'attachment; filename="auteurframe-skills.zip"'})


@app.post("/api/research/search")
async def api_search(body: dict[str, Any]) -> dict[str, Any]:
    q = (body.get("q") or "").strip()
    if not q:
        raise HTTPException(400, "query required")
    return await research.search(q, limit=int(body.get("limit", 8)), engines=body.get("engines"))


@app.post("/api/research/browse")
async def api_browse(body: dict[str, Any]) -> dict[str, Any]:
    try:
        page = await research.browse(body.get("url", ""), frames=1)
    except ValueError as error:
        raise HTTPException(400, str(error))
    return {k: page.get(k) for k in ("url", "title", "description", "links", "via")} | {"text": (page.get("text") or "")[:6000], "frame": (page.get("frames") or [{}])[-1].get("jpeg")}


@app.exception_handler(KeyError)
async def key_error(request: Request, exc: KeyError) -> JSONResponse:
    return JSONResponse({"detail": f"not found: {exc}"}, status_code=404)


@app.get("/api/templates")
async def list_templates() -> dict[str, Any]:
    return {"templates": templates.public()}


@app.get("/api/updates")
async def get_updates(force: bool = False) -> dict[str, Any]:
    return await updates.check(force)


@app.get("/api/legal")
async def get_legal() -> dict[str, Any]:
    return updates.legal_state()


@app.post("/api/legal/accept")
async def accept_legal() -> dict[str, Any]:
    return updates.accept_legal()


@app.post("/api/updates/prefs")
async def update_prefs(body: dict[str, Any]) -> dict[str, Any]:
    return updates.set_check(bool(body.get("check", True)))


@app.post("/api/updates/templates")
async def update_templates(body: dict[str, Any]) -> dict[str, Any]:
    ids = body.get("ids")
    try:
        return await updates.pull_templates(ids if isinstance(ids, list) else None)
    except (httpx.HTTPError, ValueError) as error:
        raise HTTPException(502, f"could not download templates: {str(error)[:200]}")


@app.get("/api/templates/{tid}/preview", response_class=HTMLResponse)
async def template_preview(tid: str, aspect: str = "", scene: int = 0) -> HTMLResponse:
    try:
        t = templates.get(tid)
    except KeyError:
        raise HTTPException(404, "template not found")
    asp = aspect if aspect in styles.ASPECTS else t["aspect"]
    w, h = styles.ASPECTS[asp]
    scenes = templates.build(t, {}, {}, 30, h > w)
    sc = scenes[max(0, min(scene, len(scenes) - 1))]
    project = {"id": "preview", "width": w, "height": h, "fps": 30, "seed": 11, "style": t["style"], "captions": {"enabled": False}, "assets": [], "cues": [],
               "bible": styles.build_bible(t["style"], 11, w, h)}
    return HTMLResponse(compose.build_document(project, dict(sc, start=0), "preview"), headers={"Cache-Control": "no-store"})


@app.post("/api/projects/{pid}/template")
async def apply_template(pid: str, body: dict[str, Any]) -> dict[str, Any]:
    project = _project(pid)
    try:
        t = templates.get(body.get("template", ""))
    except KeyError:
        raise HTTPException(404, "template not found")
    values = dict(body.get("values") or {})
    slots: dict[str, list[str]] = {}
    for a in project["assets"]:
        role = a.get("role", "")
        if role.startswith("slot:"):
            slots.setdefault(role[5:], []).append(a["id"])
    music_id = (slots.get("music") or [None])[0]
    levels: list[float] = []
    if music_id:
        asset = next(a for a in project["assets"] if a["id"] == music_id)
        path = project_dir(pid) / "assets" / asset["file"]
        dur = render.media_duration(path)
        if t["id"] == "music-visualizer":
            values["_audio_duration"] = round(max(5.0, min(60.0, dur or 30.0)), 2)
            loop = asyncio.get_running_loop()
            levels = await loop.run_in_executor(None, lambda: audio.levels(path, project["fps"], 60.0))
    shorts = project["height"] > project["width"]
    scenes = templates.build(t, values, slots, project["fps"], shorts)
    if levels:
        for s in scenes:
            if s["archetype"] == "music-visualizer":
                s["data"]["levels"] = levels[: int(s["duration"] * project["fps"]) + 2]
                s["data"]["total"] = s["duration"]

    def apply(p: dict[str, Any]) -> None:
        p["scenes"] = scenes
        p["template"] = {"id": t["id"], "values": values}
        p["captions"]["enabled"] = bool(body.get("captions", False))
        p["cues"] = []
        p["cues_synthetic"] = True
        p["title"] = body.get("title") or p["title"]
        if music_id:
            p["audio"]["music"] = music_id
            p["audio"]["sfx"] = t["id"] != "music-visualizer"
        elif t.get("mood"):
            p["audio"]["music"] = "mood:" + t["mood"]
        p["status"] = "planned"
        p["duration_target"] = round(sum(s["duration"] for s in scenes), 2)
    project = store.mutate(pid, apply, revision=True, reason=f"template {t['id']}")
    bus.publish(pid, "project.scenes", {"count": len(scenes), "template": t["id"]})
    if body.get("render", True):
        try:
            swarm.start(pid, "render", {})
        except RuntimeError:
            pass
    return project


@app.get("/api/stock/search")
async def stock_search(q: str, kind: str = "image", source: str = "auto", page: int = 1) -> dict[str, Any]:
    if kind not in ("image", "video"):
        raise HTTPException(400, "kind must be image or video")
    return await stock.cached_search(q, kind, source, max(1, min(20, page)))


@app.post("/api/projects/{pid}/stock/import")
async def stock_import(pid: str, body: dict[str, Any]) -> dict[str, Any]:
    _project(pid)
    try:
        path, ctype = await stock.download(body.get("url", ""), project_dir(pid) / "assets", body.get("kind", "image"))
    except ValueError as error:
        raise HTTPException(400, str(error))
    kind = "video" if ctype.startswith("video/") or path.suffix in (".mp4", ".webm") else ("svg" if path.suffix == ".svg" else "image")
    meta: dict[str, Any] = {"attribution": stock.attribution(body), "source": body.get("source"), "page": body.get("page")}
    if kind == "image":
        try:
            from PIL import Image
            with Image.open(path) as im:
                meta["width"], meta["height"] = im.size
        except Exception:
            pass
    asset = {"id": path.stem, "name": (body.get("title") or path.name)[:80], "file": path.name, "kind": kind, "mime": ctype, "size": path.stat().st_size,
             "role": body.get("role", "reference"), "url": f"/media/{pid}/assets/{path.name}", "meta": meta, "added": time.time()}
    store.mutate(pid, lambda p: p["assets"].append(asset))
    bus.publish(pid, "asset.added", {"asset": asset})
    return {"asset": asset}


@app.post("/api/projects/{pid}/web/screenshot")
async def web_screenshot(pid: str, body: dict[str, Any]) -> dict[str, Any]:
    _project(pid)
    from . import webtools
    try:
        out = await webtools.screenshot(pid, body.get("url", ""), body)
    except (ValueError, RuntimeError) as error:
        raise HTTPException(400, str(error))
    return {"asset": out["asset"], "boxes": out["data"].get("boxes", []), "title": out["data"].get("title", "")}


@app.post("/api/projects/{pid}/web/images")
async def web_page_images(pid: str, body: dict[str, Any]) -> dict[str, Any]:
    _project(pid)
    from . import webtools
    try:
        data = await webtools.capture(body.get("url", ""), {"images": True, "minImage": int(body.get("min", 260))})
    except (ValueError, RuntimeError) as error:
        raise HTTPException(400, str(error))
    return {"title": data.get("title", ""), "url": data.get("url"), "images": data.get("images", [])}


@app.post("/api/projects/{pid}/maps")
async def make_map(pid: str, body: dict[str, Any]) -> dict[str, Any]:
    project = _project(pid)
    from . import maps
    try:
        out = await maps.build(project, body, float(body.get("duration") or 8))
    except ValueError as error:
        raise HTTPException(400, str(error))
    bus.publish(pid, "asset.added", {"asset": out["asset"]})
    return out


@app.get("/api/tts/voices")
async def tts_voices(lang: str = "") -> dict[str, Any]:
    from . import voice
    try:
        return {"provider": voice.provider(), "enabled": voice.enabled(), "voices": await voice.catalog(lang), "default": voice.settings().get("default_voice") or ""}
    except Exception as error:
        raise HTTPException(502, f"voice list unavailable: {error}")


@app.post("/api/projects/{pid}/voice/tts")
async def tts_narrate(pid: str, body: dict[str, Any]) -> dict[str, Any]:
    _project(pid)
    from . import voice
    try:
        voice.require()
        out = await voice.narrate(pid, body.get("voice", ""), body.get("rate", "+0%"), body.get("pitch", "+0Hz"), bool(body.get("fit_scenes", True)))
    except (ValueError, RuntimeError) as error:
        raise HTTPException(400, str(error))
    bus.publish(pid, "asset.added", {"asset": out["asset"]})
    bus.publish(pid, "project.update", {"keys": ["scenes", "cues", "audio", "assets"]})
    return out


@app.post("/api/projects/{pid}/images/{aid}/edit")
async def image_edit(pid: str, aid: str, body: dict[str, Any]) -> dict[str, Any]:
    project = _project(pid)
    from . import imaging
    asset = next((a for a in project.get("assets", []) if a["id"] == aid), None)
    if not asset or asset.get("kind") != "image":
        raise HTTPException(404, "image not found")
    try:
        new = await asyncio.to_thread(imaging.edit, pid, asset, body.get("ops") or [], body.get("name", ""))
    except ValueError as error:
        raise HTTPException(400, str(error))
    bus.publish(pid, "asset.added", {"asset": new})
    return {"asset": new}


@app.get("/api/projects/{pid}/images/{aid}/analyze")
async def image_analyze(pid: str, aid: str) -> dict[str, Any]:
    project = _project(pid)
    from . import imaging
    asset = next((a for a in project.get("assets", []) if a["id"] == aid), None)
    if not asset or asset.get("kind") != "image":
        raise HTTPException(404, "image not found")
    return await asyncio.to_thread(imaging.analyze, imaging.load(pid, asset))


@app.get("/api/library/search")
async def library_search(q: str, kind: str = "image", style: str = "photo") -> dict[str, Any]:
    from . import media_sources, webtools
    if kind == "footage":
        return {"results": await media_sources.search_footage(q)}
    if kind in ("sfx", "music", "ambience"):
        return {"results": await media_sources.search_audio(q, kind)}
    return {"results": await webtools.search_images(q, style)}


@app.post("/api/projects/{pid}/library/collect")
async def library_collect(pid: str, body: dict[str, Any]) -> dict[str, Any]:
    _project(pid)
    from . import media_sources, webtools
    item = body.get("item") or {}
    kind = body.get("kind", "image")
    try:
        if kind == "footage":
            info = await media_sources.resolve_footage(item.get("id", ""))
            asset = await asyncio.to_thread(media_sources.collect_footage, pid, info, float(body.get("start", 0)), float(body.get("duration", 6)))
        elif kind in ("sfx", "music", "ambience"):
            asset = await media_sources.collect_audio(pid, item, float(body.get("start", 0)), body.get("duration"))
            if body.get("place") in ("sfx", "music"):
                media_sources.place_audio(pid, asset["id"], body["place"], float(body.get("t", 0)))
        else:
            asset = await webtools.collect(pid, item, item.get("title", ""))
    except (ValueError, RuntimeError) as error:
        raise HTTPException(400, str(error))
    bus.publish(pid, "asset.added", {"asset": asset})
    return {"asset": asset}


@app.post("/api/projects/{pid}/generate-image")
async def gen_image(pid: str, body: dict[str, Any]) -> dict[str, Any]:
    project = _project(pid)
    from . import media_sources
    try:
        asset = await media_sources.generate_image(pid, body.get("prompt", ""), int(body.get("width", min(1600, project["width"]))), int(body.get("height", min(1600, project["height"]))), body.get("seed"))
    except RuntimeError as error:
        raise HTTPException(502, str(error))
    bus.publish(pid, "asset.added", {"asset": asset})
    return {"asset": asset}


@app.get("/api/data/owid")
async def data_owid(slug: str, countries: str = "") -> dict[str, Any]:
    from . import media_sources
    try:
        return await media_sources.owid(slug, [c for c in countries.split(",") if c.strip()])
    except ValueError as error:
        raise HTTPException(404, str(error))


@app.get("/api/data/wikidata")
async def data_wikidata(q: str) -> dict[str, Any]:
    from . import media_sources
    try:
        return await media_sources.wikidata(q)
    except ValueError as error:
        raise HTTPException(404, str(error))


@app.get("/api/geocode")
async def geocode(q: str) -> dict[str, Any]:
    from . import maps
    try:
        return await maps.geocode(q)
    except ValueError as error:
        raise HTTPException(404, str(error))


@app.get("/api/icons/search")
async def icons_search(q: str, prefix: str = "") -> dict[str, Any]:
    try:
        return await stock.icons(q, 96, prefix)
    except Exception as error:
        raise HTTPException(502, f"icon search failed: {error}")


@app.post("/api/projects/{pid}/icons/import")
async def icon_import(pid: str, body: dict[str, Any]) -> dict[str, Any]:
    _project(pid)
    try:
        svg = await stock.icon_svg(body.get("name", ""), body.get("color", ""))
    except ValueError as error:
        raise HTTPException(400, str(error))
    aid = "as_" + uuid.uuid4().hex[:10]
    path = project_dir(pid) / "assets" / f"{aid}.svg"
    path.write_text(svg, encoding="utf-8")
    asset = {"id": aid, "name": body.get("name"), "file": path.name, "kind": "svg", "mime": "image/svg+xml", "size": len(svg), "role": "icon",
             "url": f"/media/{pid}/assets/{path.name}", "meta": {"width": 512, "height": 512, "attribution": "Iconify " + body.get("name", "")}, "added": time.time()}
    store.mutate(pid, lambda p: p["assets"].append(asset))
    bus.publish(pid, "asset.added", {"asset": asset})
    return {"asset": asset}


@app.get("/api/audio/library")
async def audio_library() -> dict[str, Any]:
    return {"moods": [{"id": k, "label": k.capitalize(), "description": v[3], "bpm": v[1]} for k, v in audio.MOODS.items()],
            "sfx": [{"id": k, "label": k.capitalize(), "description": v} for k, v in audio.SFX_LIBRARY.items()]}


@app.get("/api/audio/sfx/{name}.wav")
async def sfx_wav(name: str) -> FileResponse:
    if name not in audio.SFX_LIBRARY:
        raise HTTPException(404, "unknown sound")
    return FileResponse(audio.sfx_file(name, config.DATA / "sfx"), media_type="audio/wav")


@app.get("/api/audio/mood/{name}.wav")
async def mood_wav(name: str) -> FileResponse:
    if name not in audio.MOODS:
        raise HTTPException(404, "unknown mood")
    path = config.DATA / "moods" / f"{name}.wav"
    if not path.exists():
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, lambda: audio.music_bed(12.0, "", 7, path, mood=name))
    return FileResponse(path, media_type="audio/wav")


@app.post("/api/projects/{pid}/scenes/{sid}/render")
async def render_scene_now(pid: str, sid: str) -> dict[str, Any]:
    project = _project(pid)
    _scene(project, sid)
    try:
        run = swarm.start(pid, "scene-render", {}, scene_id=sid)
    except RuntimeError as error:
        raise HTTPException(409, str(error))
    return run.summary()


@app.get("/api/templates/{tid}/poster.jpg")
async def template_poster(tid: str, aspect: str = "16:9", t: float = 3.0) -> FileResponse:
    try:
        tpl = templates.get(tid)
    except KeyError:
        raise HTTPException(404, "template not found")
    asp = aspect if aspect in styles.ASPECTS else tpl["aspect"]
    out = config.DATA / "posters" / f"{tid}_v{tpl.get('version', 0)}_{asp.replace(':', 'x')}_{compose.runtime_signature()}.jpg"
    if not out.exists():
        await render.ensure_renderer()
        w, h = styles.ASPECTS[asp]
        url = f"{config.PUBLIC_URL}/api/templates/{tid}/preview?aspect={asp}"
        out.parent.mkdir(parents=True, exist_ok=True)
        import httpx
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(config.RENDERER_URL + "/snapshot", json={"url": url, "width": w, "height": h, "times": [t], "scale": 0.4, "out": str(out), "quality": 84})
            if r.status_code >= 400 or not out.exists():
                raise HTTPException(502, "poster render failed")
    return FileResponse(out, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=3600"})


@app.get("/api/projects/{pid}/audio/preview.wav")
async def audio_preview(pid: str) -> FileResponse:
    import hashlib
    project = _project(pid)
    key_src = json.dumps({"a": project.get("audio"), "d": [round(float(s["duration"]), 3) for s in project["scenes"]], "s": project.get("style"),
                          "seed": project.get("seed"), "e": (project.get("edit") or {}).get("ranges"), "assets": [a["id"] for a in project["assets"]]}, sort_keys=True)
    key = hashlib.sha1(key_src.encode()).hexdigest()[:12]
    out = project_dir(pid) / "renders" / "audio" / f"preview_{key}.wav"
    if not out.exists():
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, lambda: audio.preview_mix(project, project_dir(pid), out))
    return FileResponse(out, media_type="audio/wav", headers={"Cache-Control": "no-cache", "X-Preview-Key": key})


@app.put("/api/projects/{pid}/state")
async def put_state(pid: str, body: dict[str, Any]) -> dict[str, Any]:
    _project(pid)

    def apply(p: dict[str, Any]) -> None:
        for key in ("scenes", "audio", "captions", "cues"):
            if key in body and body[key] is not None:
                p[key] = body[key]
        _retime(p)
    project = store.mutate(pid, apply, revision=True, reason="undo/redo")
    bus.publish(pid, "project.update", {"keys": list(body.keys()), "by": "user"})
    return project


@app.post("/api/projects/{pid}/scenes/{sid}/split")
async def split_scene(pid: str, sid: str, body: dict[str, Any]) -> dict[str, Any]:
    import copy
    project = _project(pid)
    scene = _scene(project, sid)
    at = float(body.get("at", scene["duration"] / 2))
    fps = project["fps"]
    at = round(round(at * fps) / fps, 4)
    if at < 2 / fps or at > scene["duration"] - 2 / fps:
        raise HTTPException(400, "playhead must be inside the scene to split")

    def apply(p: dict[str, Any]) -> None:
        idx = next(i for i, s in enumerate(p["scenes"]) if s["id"] == sid)
        a = p["scenes"][idx]
        b = copy.deepcopy(a)
        b["id"] = f"sc_{uuid.uuid4().hex[:8]}"
        b["duration"] = round(a["duration"] - at, 4)
        a["duration"] = at
        b["title"] = (a.get("title") or "Scene") + " B"
        a["layers"] = [dict(L, end=min(L.get("end", at), at)) for L in a.get("layers", []) if L.get("start", 0) < at - 0.05]
        b["layers"] = [dict(L, start=max(0.0, L.get("start", 0) - at), end=max(0.1, L.get("end", at + b["duration"]) - at)) for L in b.get("layers", []) if L.get("end", 1e9) > at + 0.05]
        if a.get("archetype") == "footage-edit":
            b["data"]["src_in"] = round(a["data"].get("src_in", 0) + at, 4)
            b["data"]["t0"] = round(a["data"].get("t0", a.get("start", 0)) + at, 4)
            b["data"]["broll"] = [dict(x, t=round(x["t"] - at, 3)) for x in a["data"].get("broll", []) if x["t"] >= at]
            a["data"]["broll"] = [x for x in a["data"].get("broll", []) if x["t"] < at]
        else:
            b["variant"] = int(a.get("variant", 0)) + 1
        b["transition"] = dict(a.get("transition") or {"type": "fade", "duration": 0.4})
        a["transition"] = {"type": "cut", "duration": 0.0}
        a["status"] = b["status"] = "edited"
        a.pop("render", None)
        b.pop("render", None)
        p["scenes"].insert(idx + 1, b)
        _retime(p)
    project = store.mutate(pid, apply, revision=True, reason=f"split {sid}")
    bus.publish(pid, "project.update", {"keys": ["scenes"], "by": "user"})
    return project


_HISTORY_KEYS = ("scenes", "audio", "captions", "cues")
_HISTORY_CAP = 40
_history_lock = asyncio.Lock()


def _history_path(pid: str) -> Path:
    return project_dir(pid) / "history.json"


def _history_load(pid: str) -> dict[str, list]:
    path = _history_path(pid)
    if path.exists():
        try:
            data = json.loads(path.read_text("utf-8"))
            return {"past": list(data.get("past", [])), "future": list(data.get("future", []))}
        except (OSError, ValueError):
            pass
    return {"past": [], "future": []}


def _history_save(pid: str, h: dict[str, list]) -> None:
    path = _history_path(pid)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(h), "utf-8")
    tmp.replace(path)


def _history_state(project: dict[str, Any]) -> dict[str, Any]:
    return {k: project.get(k) for k in _HISTORY_KEYS}


def _history_counts(h: dict[str, list]) -> dict[str, int]:
    return {"undo": len(h["past"]), "redo": len(h["future"])}


@app.get("/api/projects/{pid}/history")
async def history_info(pid: str) -> dict[str, Any]:
    _project(pid)
    return _history_counts(_history_load(pid))


@app.post("/api/projects/{pid}/history/snap")
async def history_snap(pid: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
    async with _history_lock:
        project = _project(pid)
        h = _history_load(pid)
        state = _history_state(project)
        if not h["past"] or h["past"][-1] != state:
            h["past"] = (h["past"] + [state])[-_HISTORY_CAP:]
        h["future"] = []
        _history_save(pid, h)
        return _history_counts(h)


async def _history_step(pid: str, src: str, dst: str) -> dict[str, Any]:
    async with _history_lock:
        project = _project(pid)
        h = _history_load(pid)
        if not h[src]:
            raise HTTPException(409, f"nothing to {'undo' if src == 'past' else 'redo'}")
        target = h[src].pop()
        h[dst] = (h[dst] + [_history_state(project)])[-_HISTORY_CAP:]

        def apply(p: dict[str, Any]) -> None:
            for key in _HISTORY_KEYS:
                if key in target and target[key] is not None:
                    p[key] = target[key]
            _retime(p)
        project = store.mutate(pid, apply, revision=True, reason="undo" if src == "past" else "redo")
        _history_save(pid, h)
    bus.publish(pid, "project.update", {"keys": list(_HISTORY_KEYS), "by": "user"})
    return {"project": project, **_history_counts(h)}


@app.post("/api/projects/{pid}/history/undo")
async def history_undo(pid: str) -> dict[str, Any]:
    return await _history_step(pid, "past", "future")


@app.post("/api/projects/{pid}/history/redo")
async def history_redo(pid: str) -> dict[str, Any]:
    return await _history_step(pid, "future", "past")


@app.post("/api/projects/{pid}/sync")
async def sync_check(pid: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
    from . import sync
    project = _project(pid)
    result = sync.align(project)
    fix = bool((body or {}).get("fix", True))
    if fix and (result["fixes"] or result["extend_last"]):
        def apply(p: dict[str, Any]) -> None:
            if p.get("cues"):
                p["cues"] = result["cues"]
            if result["extend_last"] and p.get("scenes"):
                p["scenes"][-1]["duration"] = round(float(p["scenes"][-1]["duration"]) + result["extend_last"], 4)
            _retime(p)
        project = store.mutate(pid, apply, revision=True, reason="sync fixes")
    try:
        report = await sync.verify(project)
    except Exception as error:
        raise HTTPException(502, f"sync verification failed: {error}")
    report["fixes"] = result["fixes"] if fix else []
    report["warnings"] = result["warnings"]
    store.mutate(pid, lambda p: p.__setitem__("sync", report))
    bus.publish(pid, "sync.report", {k: v for k, v in report.items() if k != "cues"})
    return report


@app.get("/api/projects/{pid}/beats")
async def beats(pid: str) -> dict[str, Any]:
    from . import sync
    project = _project(pid)
    return {"beats": sync.prompt_beats(project.get("brief", "")), "windows": sync.scene_windows(project)}


@app.get("/api/fonts")
async def fonts_catalog() -> dict[str, Any]:
    from . import fonts
    return {"fonts": fonts.catalog(), "languages": fonts.LANGUAGES, "keys": list(styles.FONTS.keys())}


@app.get("/api/projects/{pid}/language")
async def project_language(pid: str) -> dict[str, Any]:
    from . import fonts
    return fonts.info(_project(pid))


@app.get("/api/projects/{pid}/captions/doc", response_class=HTMLResponse)
async def captions_doc(pid: str) -> HTMLResponse:
    project = _project(pid)
    if not project.get("scenes"):
        raise HTTPException(404, "no scenes")
    return HTMLResponse(compose.build_captions_document(project, "preview"), headers={"Cache-Control": "no-store"})
