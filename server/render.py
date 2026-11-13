from __future__ import annotations

import asyncio
import json
import os
import subprocess
import time
from pathlib import Path
from typing import Any, Callable

import httpx

from . import audio, compose, config, subtitles
from .store import project_dir

_renderer_proc: subprocess.Popen | None = None
_start_lock = asyncio.Lock()

XFADE = {"fade", "wipeleft", "wiperight", "wipeup", "wipedown", "slideleft", "slideright", "slideup", "slidedown", "circlecrop", "rectcrop",
         "distance", "fadeblack", "fadewhite", "radial", "smoothleft", "smoothright", "smoothup", "smoothdown", "circleopen", "circleclose",
         "vertopen", "vertclose", "horzopen", "horzclose", "dissolve", "pixelize", "diagtl", "diagtr", "diagbl", "diagbr", "hlslice", "hrslice",
         "vuslice", "vdslice", "hblur", "fadegrays", "squeezeh", "squeezev", "zoomin"}


async def health() -> dict[str, Any] | None:
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            r = await client.get(config.RENDERER_URL + "/health")
            return r.json()
    except Exception:
        return None


async def ensure_renderer() -> dict[str, Any]:
    global _renderer_proc
    async with _start_lock:
        state = await health()
        if state:
            return state
        if not config.RENDERER_AUTOSTART:
            raise RuntimeError("render service is not reachable at " + config.RENDERER_URL)
        if _renderer_proc is None or _renderer_proc.poll() is not None:
            log = open(config.DATA / "renderer.log", "a")
            env = dict(os.environ)
            env.setdefault("RENDER_CONCURRENCY", str(max(2, (os.cpu_count() or 4) // 2)))
            _renderer_proc = subprocess.Popen([config.NODE, str(config.RENDERER_DIR / "src" / "server.mjs")], cwd=str(config.ROOT), stdout=log, stderr=log, env=env)
        for _ in range(60):
            await asyncio.sleep(0.5)
            state = await health()
            if state:
                return state
        raise RuntimeError("render service did not start; see data/renderer.log")


def stop_renderer() -> None:
    if _renderer_proc and _renderer_proc.poll() is None:
        _renderer_proc.terminate()


def handle_for(project: dict[str, Any], scene: dict[str, Any]) -> float:
    scenes = project["scenes"]
    if scene["index"] >= len(scenes) - 1:
        return 0.0
    trans = scene.get("transition") or {}
    if trans.get("type") == "cut":
        return 1.0 / project.get("fps", 30)
    return max(1.0 / project.get("fps", 30), float(trans.get("duration", 0.5)))


def write_document(project: dict[str, Any], scene: dict[str, Any], mode: str = "render", handle: float | None = None) -> tuple[str, str]:
    h = handle_for(project, scene) if handle is None else handle
    doc = compose.build_document(project, scene, mode, handle=h)
    digest = compose.document_hash(doc, project["fps"], project["width"], project["height"])
    folder = project_dir(project["id"]) / "docs"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{digest}.html"
    if not path.exists():
        path.write_text(doc, encoding="utf-8")
    url = f"{config.PUBLIC_URL}/media/{project['id']}/docs/{digest}.html"
    return digest, url


def write_raw(project: dict[str, Any], doc: str) -> tuple[str, str]:
    digest = compose.document_hash(doc, project["fps"], project["width"], project["height"])
    folder = project_dir(project["id"]) / "docs"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{digest}.html"
    if not path.exists():
        path.write_text(doc, encoding="utf-8")
    return digest, f"{config.PUBLIC_URL}/media/{project['id']}/docs/{digest}.html"


async def render_captions(project: dict[str, Any], on_progress: Callable[[dict[str, Any]], None] | None = None) -> dict[str, Any] | None:
    if not compose.caption_overlay(project):
        return None
    await ensure_renderer()
    doc = compose.build_captions_document(project, "render")
    digest, url = write_raw(project, doc)
    folder = project_dir(project["id"]) / "renders"
    folder.mkdir(parents=True, exist_ok=True)
    out = folder / f"captions_{digest}.mkv"
    meta = folder / f"captions_{digest}.json"
    total = round(sum(float(s["duration"]) for s in project["scenes"]), 4)
    if out.exists() and meta.exists() and out.stat().st_size > 200:
        info = json.loads(meta.read_text())
        info["cached"] = True
        return info
    async with httpx.AsyncClient(timeout=180) as client:
        r = await client.post(config.RENDERER_URL + "/probe", json={"url": url, "width": project["width"], "height": project["height"], "times": [], "captionBox": True})
        data = r.json()
    box = data.get("captionBox")
    if not box or box.get("width", 0) < 4 or box.get("height", 0) < 4:
        return None
    started = time.time()
    job = {"id": f"{project['id']}:captions", "url": url, "out": str(out), "width": project["width"], "height": project["height"], "fps": project["fps"],
           "duration": total, "alpha": True, "clip": box, "preview": False, "minChunk": 60}
    async with httpx.AsyncClient(timeout=httpx.Timeout(None, connect=10)) as client:
        async with client.stream("POST", config.RENDERER_URL + "/render", json=job) as response:
            async for line in response.aiter_lines():
                if not line.strip():
                    continue
                try:
                    msg = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if msg.get("type") == "progress" and on_progress:
                    on_progress(msg)
                elif msg.get("type") == "error":
                    raise RuntimeError(msg.get("error", "caption render failed"))
    if not out.exists():
        raise RuntimeError("caption overlay produced no file")
    info = {"file": out.name, "path": str(out), "box": box, "hash": digest, "duration": total, "ms": int((time.time() - started) * 1000), "url": url}
    meta.write_text(json.dumps(info))
    return info


async def probe_scene(project: dict[str, Any], scene: dict[str, Any], with_energy: bool = True, layout_times: list[float] | None = None) -> dict[str, Any]:
    from . import qa
    await ensure_renderer()
    _, url = write_document(project, scene, "render", handle=0.0)
    duration = float(scene["duration"])
    times = qa.sample_times(duration, 5)
    shot_times = qa.energy_times(duration, 0.5) if with_energy else times
    async with httpx.AsyncClient(timeout=180) as client:
        r = await client.post(config.RENDERER_URL + "/probe", json={"url": url, "width": project["width"], "height": project["height"], "times": times, "shotTimes": shot_times, "shotScale": 0.25,
                                                          "layoutTimes": layout_times or []})
        data = r.json()
    if "error" in data:
        raise RuntimeError(data["error"])
    return data


async def snapshot(project: dict[str, Any], scene: dict[str, Any], t: float | None = None, scale: float = 0.33) -> Path:
    await ensure_renderer()
    _, url = write_document(project, scene, "render", handle=0.0)
    t = float(scene["duration"]) * 0.72 if t is None else t
    out = project_dir(project["id"]) / "renders" / "thumbs" / f"{scene['id']}.jpg"
    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(config.RENDERER_URL + "/snapshot", json={"url": url, "width": project["width"], "height": project["height"], "times": [t], "scale": scale, "out": str(out), "quality": 82})
        data = r.json()
    if "error" in data:
        raise RuntimeError(data["error"])
    return out


async def render_scene(project: dict[str, Any], scene: dict[str, Any], on_progress: Callable[[dict[str, Any]], None] | None = None,
                       draft: bool = False) -> dict[str, Any]:
    await ensure_renderer()
    digest, url = write_document(project, scene, "render")
    scale = 0.6667 if draft else 1.0
    out = project_dir(project["id"]) / "renders" / f"{scene['id']}_{digest}{'_d' if draft else ''}.mp4"
    duration = float(scene["duration"]) + handle_for(project, scene)
    if out.exists() and out.stat().st_size > 1000:
        return {"file": out.name, "hash": digest, "cached": True, "ms": 0, "duration": duration}
    started = time.time()
    job = {"id": f"{project['id']}:{scene['id']}", "url": url, "out": str(out), "width": project["width"], "height": project["height"],
           "fps": project["fps"], "duration": duration, "preview": True, "previewEvery": 6, "previewScale": 0.3, "scale": scale, "crf": 20 if draft else 17}
    result: dict[str, Any] = {}
    async with httpx.AsyncClient(timeout=httpx.Timeout(None, connect=10)) as client:
        async with client.stream("POST", config.RENDERER_URL + "/render", json=job) as response:
            async for line in response.aiter_lines():
                if not line.strip():
                    continue
                try:
                    msg = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if msg.get("type") in ("progress", "preview") and on_progress:
                    on_progress(msg)
                elif msg.get("type") == "done":
                    result = msg
                elif msg.get("type") == "error":
                    raise RuntimeError(msg.get("error", "render failed"))
    if not out.exists():
        raise RuntimeError("render produced no file")
    return {"file": out.name, "hash": digest, "cached": False, "ms": int((time.time() - started) * 1000), "duration": duration, "logs": result.get("logs", [])}


def _run(cmd: list[str], timeout: int = 1800) -> None:
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr[-1200:])


def probe_media(path: Path) -> dict[str, Any]:
    proc = subprocess.run([config.FFPROBE, "-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames", "-of", "json", str(path)],
                          capture_output=True, text=True)
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError:
        return {}


def video_frames(path: Path) -> int | None:
    for stream in probe_media(path).get("streams", []):
        if stream.get("codec_type") == "video":
            try:
                return int(stream.get("nb_frames"))
            except (TypeError, ValueError):
                return None
    return None


def media_duration(path: Path) -> float:
    try:
        return float(probe_media(path).get("format", {}).get("duration", 0))
    except (TypeError, ValueError):
        return 0.0


def assemble(project: dict[str, Any], segments: list[Path], on_step: Callable[[str], None] | None = None, captions: dict[str, Any] | None = None) -> dict[str, Any]:
    pid = project["id"]
    folder = project_dir(pid)
    outdir = folder / "out"
    outdir.mkdir(exist_ok=True)
    scenes = project["scenes"]
    fps = project["fps"]
    total = round(sum(float(s["duration"]) for s in scenes), 4)
    step = on_step or (lambda s: None)
    inputs: list[str] = []
    for seg in segments:
        inputs += ["-i", str(seg)]
    filters = []
    last = "[0:v]"
    offset = 0.0
    used = []
    for i in range(1, len(segments)):
        prev = scenes[i - 1]
        offset += float(prev["duration"])
        trans = prev.get("transition") or {}
        kind = trans.get("type", "fade")
        dur = handle_for(project, prev)
        if kind not in XFADE:
            kind = "fade"
        used.append(kind)
        label = f"[v{i}]"
        at = round(offset * fps) / fps
        span = max(1, round(dur * fps)) / fps - 0.0001
        filters.append(f"{last}[{i}:v]xfade=transition={kind}:duration={span:.6f}:offset={at:.6f}{label}")
        last = label
    if captions:
        inputs += ["-i", captions["path"]]
        box = captions["box"]
        filters.append(f"{last}trim=duration={total:.4f},setpts=PTS-STARTPTS[vbase]")
        filters.append(f"[{len(segments)}:v]format=rgba,setpts=PTS-STARTPTS[capv]")
        filters.append(f"[vbase][capv]overlay=x={int(box['x'])}:y={int(box['y'])}:eof_action=pass:format=auto,format=yuv420p[vout]")
    else:
        filters.append(f"{last}format=yuv420p,trim=duration={total:.4f}[vout]")
    voice = None if (project.get("audio") or {}).get("voice_mute") else next((a for a in project.get("assets", []) if a["id"] == (project.get("audio") or {}).get("voice")), None)
    music_choice = (project.get("audio") or {}).get("music", "auto")
    music_asset = next((a for a in project.get("assets", []) if a["id"] == music_choice), None)
    extra: list[str] = []
    edit = project.get("edit") or {}
    edit_src = next((a for a in project.get("assets", []) if a["id"] == edit.get("source")), None) if edit.get("ranges") else None
    has_voice = bool(voice) or bool(edit_src)
    if edit_src:
        import numpy as np
        step("cutting the voice track")
        src = audio.load_wav(folder / "assets" / edit_src["file"])
        parts = [src[int(a * audio.SR):int(b * audio.SR)] for a, b in edit["ranges"]]
        fade = int(0.008 * audio.SR)
        for p in parts:
            if len(p) > 2 * fade:
                p[:fade] *= np.linspace(0, 1, fade, dtype=np.float32)
                p[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)
        track = np.concatenate(parts) if parts else src
        vpath = outdir / "voice_edit.wav"
        audio._write(track, vpath)
        extra += ["-i", str(vpath)]
    elif has_voice:
        extra += ["-i", str(folder / "assets" / voice["file"])]
    has_music = False
    if music_asset:
        extra += ["-stream_loop", "-1", "-i", str(folder / "assets" / music_asset["file"])]
        has_music = True
    elif music_choice == "auto" or (isinstance(music_choice, str) and music_choice.startswith("mood:")):
        step("composing score")
        mood = music_choice[5:] if music_choice.startswith("mood:") else None
        bed = audio.music_bed(total, project.get("style", ""), int(project.get("seed", 1)), outdir / "score.wav", mood=mood)
        extra += ["-i", str(bed)]
        has_music = True
    clips = (project.get("audio") or {}).get("clips") or []
    auto_sfx = bool((project.get("audio") or {}).get("sfx", True)) and len(scenes) > 1
    has_sfx = auto_sfx or bool(clips)
    if has_sfx:
        cuts, t = [], 0.0
        for s in scenes[:-1]:
            t += float(s["duration"])
            cuts.append(t)
        payoff = None
        for s in scenes:
            if s.get("archetype") in ("big-number", "word-stack") and payoff is None and s["index"] > 0:
                payoff = float(s["start"]) + 0.3
        by_id = {a["id"]: folder / "assets" / a["file"] for a in project.get("assets", [])}
        sfx = audio.sfx_track(total, cuts, payoff, fps, outdir / "sfx.wav", int(project.get("seed", 1)), clips=clips, resolve=by_id.get, auto=auto_sfx)
        extra += ["-i", str(sfx)]
    gain = float((project.get("audio") or {}).get("music_gain", -18.0)) + (0 if not has_voice else -2)
    amix, alabel = audio.mix_filter(has_voice, has_music, has_sfx, gain + 12, len(segments) + (1 if captions else 0))
    graph = ";".join(filters + ([amix] if amix else []))
    master = outdir / "master.mp4"
    tmp = outdir / "master.tmp.mp4"
    cmd = [config.FFMPEG, "-hide_banner", "-loglevel", "error", "-y"] + inputs + extra + ["-filter_complex", graph, "-map", "[vout]"]
    if alabel:
        cmd += ["-map", alabel, "-c:a", "aac", "-b:a", "192k", "-ar", "48000"]
    cmd += ["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-r", str(fps), "-movflags", "+faststart", "-t", f"{total:.4f}", str(tmp)]
    step("assembling master")
    _run(cmd)
    frames = video_frames(tmp)
    want = round(total * fps)
    if frames is not None and frames < want - 2:
        raise RuntimeError(f"master video stopped early: {frames} of {want} frames ({frames / fps:.2f}s of {total:.2f}s); the scene segments or transitions did not join")
    os.replace(tmp, master)
    step("poster and subtitles")
    hero = max(scenes, key=lambda s: 1 if s.get("archetype") in ("kinetic-title", "big-number", "word-stack") else 0)
    poster_t = float(hero["start"]) + float(hero["duration"]) * 0.75
    _run([config.FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{poster_t:.3f}", "-i", str(master), "-frames:v", "1", "-q:v", "3", str(outdir / "poster.jpg")])
    cues = project.get("cues") or subtitles.synth_cues(scenes)
    (outdir / "subtitles.srt").write_text(subtitles.to_srt(cues), encoding="utf-8")
    info = probe_media(master)
    return {
        "master": f"/media/{pid}/out/master.mp4", "poster": f"/media/{pid}/out/poster.jpg", "srt": f"/media/{pid}/out/subtitles.srt",
        "duration": float(info.get("format", {}).get("duration", total)), "expected": total, "transitions": used, "updated": time.time(),
        "streams": [{k: v for k, v in s.items()} for s in info.get("streams", [])], "size": master.stat().st_size,
    }
