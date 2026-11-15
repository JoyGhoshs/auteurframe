from __future__ import annotations

import asyncio
import math
import re
import time
from typing import Any

import httpx

from . import config, subtitles

RANGE = re.compile(r"(?<![\d.])(\d{1,4}(?:\.\d+)?)\s*(?:s|sec|secs|seconds)?\s*(?:to|-|–|—|until|through)\s*(\d{1,4}(?:\.\d+)?)\s*(?:s\b|sec\b|secs\b|seconds\b)", re.I)


def _snap(value: float, fps: int) -> float:
    return round(round(value * fps) / fps, 4)


UNIT_WORDS = ["সেকেন্ড", "সেকেণ্ড", "সে.", "सेकंड", "सेकेंड", "सेकण्ड", "ثانية", "ثوان", "ثانيه", "秒", "초", "วินาที", "segundos", "secondes", "sekunden", "секунд", "saniye", "detik"]
TO_WORDS = ["থেকে", "से", "إلى", "الى", "から", "〜", "~", "부터", "ถึง", "a", "à", "bis", "до", "hingga", "sampai"]


def _normalize(text: str) -> str:
    import unicodedata
    out = []
    for ch in text or "":
        if ch.isdigit() and not ch.isascii():
            try:
                out.append(str(unicodedata.digit(ch)))
                continue
            except (TypeError, ValueError):
                pass
        out.append(ch)
    text = "".join(out).replace("٫", ".")
    for w in UNIT_WORDS:
        text = text.replace(w, "s")
    for w in TO_WORDS:
        text = re.sub(r"(\d)\s*" + re.escape(w) + r"\s*(\d)", r"\1 to \2", text)
    return text


def prompt_beats(text: str) -> list[dict[str, Any]]:
    text = _normalize(text)
    beats = []
    for line in re.split(r"[\n\r]+|(?<=[.;])\s+(?=\d+[.)]\s)", text or ""):
        for m in RANGE.finditer(line):
            a, b = float(m.group(1)), float(m.group(2))
            if b <= a or b - a < 0.5 or b > 3600:
                continue
            label = RANGE.sub("", line)
            label = re.sub(r"^\s*\d+[.)]\s*", "", label)
            label = re.sub(r"[()\[\]]", "", label).strip(" :-–—")
            beats.append({"start": a, "end": b, "label": label[:240]})
    beats.sort(key=lambda x: x["start"])
    clean: list[dict[str, Any]] = []
    for b in beats:
        if clean and b["start"] < clean[-1]["end"] - 0.25:
            continue
        clean.append(b)
    return clean


def cue_boundaries(cues: list[dict[str, Any]], fps: int) -> list[float]:
    out = []
    for prev, cue in zip(cues, cues[1:]):
        gap = max(0.0, float(cue["start"]) - float(prev["end"]))
        out.append(_snap(float(cue["start"]) - min(0.12, gap / 2), fps))
    return out


def scene_windows(project: dict[str, Any], shorts: bool | None = None) -> list[dict[str, Any]]:
    fps = int(project.get("fps", 30))
    if shorts is None:
        shorts = project.get("height", 1080) > project.get("width", 1920)
    cues = [c for c in (project.get("cues") or []) if not c.get("synthetic")]
    beats = prompt_beats(project.get("brief", ""))
    if cues and beats and len(beats) >= 2:
        candidates = cue_boundaries(cues, fps)
        cuts: list[float] = []
        for beat in beats[1:]:
            if not candidates:
                break
            best = min(candidates, key=lambda c: abs(c - beat["start"]))
            if abs(best - beat["start"]) > 2.5:
                continue
            if (not cuts or best > cuts[-1] + 0.5) and best > 0.5:
                cuts.append(best)
        end = _snap(max(float(cues[-1]["end"]) + (0.7 if shorts else 1.0), beats[-1]["end"] if beats[-1]["end"] >= float(cues[-1]["end"]) else 0), fps)
        edges = [0.0] + cuts + [end]
        windows = []
        for i in range(len(edges) - 1):
            a, b = edges[i], edges[i + 1]
            inside = [c for c in cues if a - 0.001 <= float(c["start"]) < b - 0.001]
            beat = min(beats, key=lambda x: abs(x["start"] - a))
            windows.append({"start": a, "duration": round(b - a, 4), "text": " ".join(c["text"] for c in inside), "cues": [c.get("id", 0) for c in inside],
                            "beat": beat["label"], "beat_range": [beat["start"], beat["end"]]})
        return [w for w in windows if w["duration"] > 0.3]
    if cues:
        windows = subtitles.group_scenes(cues, fps=fps, shorts=shorts)
        for w in windows:
            w["beat"] = ""
        return windows
    if beats:
        windows = []
        t = 0.0
        for i, beat in enumerate(beats):
            end = beats[i + 1]["start"] if i + 1 < len(beats) else beat["end"]
            a = _snap(t, fps)
            b = _snap(max(end, a + 0.8), fps)
            windows.append({"start": a, "duration": round(b - a, 4), "text": beat["label"], "cues": [], "beat": beat["label"], "beat_range": [beat["start"], beat["end"]]})
            t = b
        return windows
    return []


def align(project: dict[str, Any]) -> dict[str, Any]:
    fps = int(project.get("fps", 30))
    cues = [dict(c) for c in (project.get("cues") or [])]
    fixes: list[str] = []
    warnings: list[str] = []
    cues.sort(key=lambda c: float(c["start"]))
    for i, c in enumerate(cues):
        if "id" not in c:
            c["id"] = i
        nxt = cues[i + 1] if i + 1 < len(cues) else None
        if nxt and float(c["end"]) > float(nxt["start"]):
            fixes.append(f"cue {i + 1} overlapped cue {i + 2} by {(float(c['end']) - float(nxt['start'])) * 1000:.0f}ms; trimmed to the next start")
            c["end"] = float(nxt["start"])
        if float(c["end"]) - float(c["start"]) < 2 / fps:
            c["end"] = round(float(c["start"]) + 2 / fps, 4)
            fixes.append(f"cue {i + 1} was shorter than two frames; extended")
    scenes = project.get("scenes") or []
    total = sum(float(s["duration"]) for s in scenes)
    real = [c for c in cues if not c.get("synthetic")]
    extend = 0.0
    if scenes and real:
        last = float(real[-1]["end"])
        if total < last + 0.2:
            extend = _snap(last + 0.5 - total, fps)
            fixes.append(f"film ended {max(0.0, last - total):.2f}s before the last subtitle; last scene extended by {extend:.2f}s")
        starts, t = [], 0.0
        for s in scenes:
            starts.append(t)
            t += float(s["duration"])
        for b in starts[1:]:
            for c in real:
                if float(c["start"]) + 0.25 < b < float(c["end"]) - 0.25:
                    warnings.append(f"scene cut at {b:.2f}s falls inside \"{c['text'][:40]}\"; the caption continues across the cut")
    voice = next((a for a in project.get("assets", []) if a["id"] == (project.get("audio") or {}).get("voice")), None)
    if voice and real:
        vd = float((voice.get("meta") or {}).get("duration") or 0)
        if vd and abs(vd - float(real[-1]["end"])) > 2.0:
            warnings.append(f"voice is {vd:.1f}s but subtitles end at {float(real[-1]['end']):.1f}s; check that the SRT belongs to this recording")
        if vd and float(real[0]["start"]) > vd:
            warnings.append("first subtitle starts after the voice ends")
    return {"cues": cues, "fixes": fixes, "warnings": warnings, "extend_last": extend}


def _norm(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (text or "").lower()).strip()


async def verify(project: dict[str, Any]) -> dict[str, Any]:
    from . import compose, render
    started = time.time()
    fps = int(project.get("fps", 30))
    cap = project.get("captions") or {}
    cues = [c for c in (project.get("cues") or [])]
    synthetic = project.get("cues_synthetic") or all(c.get("synthetic") for c in cues or [{}])
    if not cues or cap.get("enabled") is False or (synthetic and not cap.get("from_narration")):
        return {"checked": 0, "ok": True, "skipped": "captions are off or there is no subtitle file", "cues": [], "at": time.time()}
    scenes = project.get("scenes") or []
    if not scenes:
        return {"checked": 0, "ok": False, "skipped": "no scenes yet", "cues": [], "at": time.time()}
    total = sum(float(s["duration"]) for s in scenes)

    def scene_for(g: float) -> dict[str, Any] | None:
        for s in scenes:
            if float(s["start"]) - 1e-6 <= g < float(s["start"]) + float(s["duration"]) - 1e-6:
                return s
        return None

    overlay = compose.caption_overlay(project)
    plan: dict[str, list[tuple[int, float]]] = {}
    frames_of: dict[int, list[int]] = {}
    for idx, c in enumerate(cues):
        k0 = math.ceil(float(c["start"]) * fps - 1e-6)
        k1 = math.ceil(float(c["end"]) * fps - 1e-6)
        ks = sorted(set(list(range(k0 - 2, k0 + 3)) + list(range(k1 - 2, k1 + 2))))
        frames_of[idx] = ks
        for k in ks:
            g = k / fps
            if g < 0 or g >= total:
                continue
            if overlay:
                plan.setdefault("captions", []).append((k, round(g, 5)))
                continue
            s = scene_for(g)
            if s:
                plan.setdefault(s["id"], []).append((k, round(g - float(s["start"]), 5)))
    await render.ensure_renderer()
    seen: dict[int, list[str]] = {}

    async def run_scene(sid: str, items: list[tuple[int, float]]) -> None:
        if sid == "captions":
            _, url = render.write_raw(project, compose.build_captions_document(project, "render"))
        else:
            scene = next(s for s in scenes if s["id"] == sid)
            _, url = render.write_document(project, scene, "preview" if not overlay else "render", handle=0.0)
        times = sorted({t for _, t in items})
        async with httpx.AsyncClient(timeout=180) as client:
            r = await client.post(config.RENDERER_URL + "/probe", json={"url": url, "width": project["width"], "height": project["height"], "times": [], "captionTimes": times})
            data = r.json()
        by_t = {round(x["t"], 5): x["visible"] for x in (data.get("captions") or [])}
        for k, t in items:
            seen[k] = [str(v.get("cue")) for v in by_t.get(round(t, 5), [])]

    sem = asyncio.Semaphore(4)

    async def guarded(sid: str, items: list[tuple[int, float]]) -> None:
        async with sem:
            await run_scene(sid, items)

    await asyncio.gather(*(guarded(sid, items) for sid, items in plan.items()))
    results = []
    worst = 0.0
    for idx, c in enumerate(cues):
        cid = str(c.get("id", idx))
        ks = [k for k in frames_of[idx] if k in seen]
        if not ks:
            continue
        vis = [k for k in ks if cid in seen[k]]
        k0 = math.ceil(float(c["start"]) * fps - 1e-6)
        k1 = math.ceil(float(c["end"]) * fps - 1e-6)
        expected_in = [k for k in ks if k0 <= k < k1]
        first = min((k for k in vis if k <= k0 + 2), default=None)
        last = max((k for k in vis if k >= k1 - 2), default=None)
        din = None if first is None else (first - k0) / fps
        dout = None if last is None else (last + 1 - k1) / fps
        missing = [k for k in expected_in if k not in vis]
        ok = first is not None and abs(din) <= 1 / fps + 1e-6 and (last is None or abs(dout) <= 1 / fps + 1e-6) and len(missing) <= 1
        if din is not None:
            worst = max(worst, abs(din))
        if dout is not None:
            worst = max(worst, abs(dout))
        results.append({"id": c.get("id", idx), "text": c.get("text", "")[:80], "start": c["start"], "end": c["end"],
                        "in_ms": None if din is None else round(din * 1000), "out_ms": None if dout is None else round(dout * 1000), "ok": ok})
    bad = [r for r in results if not r["ok"]]
    return {"checked": len(results), "ok": not bad, "failed": len(bad), "max_drift_ms": round(worst * 1000), "frame_ms": round(1000 / fps, 1),
            "cues": results, "at": time.time(), "ms": int((time.time() - started) * 1000), "target": "caption track" if overlay else "scene documents"}


def verify_overlay(project: dict[str, Any], info: dict[str, Any]) -> dict[str, Any]:
    import subprocess
    import numpy as np
    fps = int(project.get("fps", 30))
    box = info["box"]
    w, h = int(box["width"]), int(box["height"])
    cues = sorted(project.get("cues") or [], key=lambda c: float(c["start"]))
    checks: list[tuple[int, bool, int]] = []
    for i, c in enumerate(cues):
        k0 = math.ceil(float(c["start"]) * fps - 1e-6)
        k1 = math.ceil(float(c["end"]) * fps - 1e-6)
        prev_end = math.ceil(float(cues[i - 1]["end"]) * fps - 1e-6) if i else -10
        next_start = math.ceil(float(cues[i + 1]["start"]) * fps - 1e-6) if i + 1 < len(cues) else 10 ** 9
        checks.append((k0, True, i))
        if k1 - k0 > 2:
            checks.append((k1 - 1, True, i))
        if k0 - prev_end >= 2 and k0 >= 1:
            checks.append((k0 - 1, False, i))
        if next_start - k1 >= 2:
            checks.append((k1 + 1, False, i))
    if not checks:
        return {"ok": True, "frames": 0}
    frames = sorted({k for k, _, _ in checks})
    expr = "+".join(f"eq(n\\,{k})" for k in frames)
    cmd = [config.FFMPEG, "-v", "error", "-i", info["path"], "-vf", f"select={expr},alphaextract", "-vsync", "0", "-f", "rawvideo", "-pix_fmt", "gray", "-"]
    raw = subprocess.run(cmd, capture_output=True, timeout=300).stdout
    size = w * h
    got = {}
    for j, k in enumerate(frames):
        chunk = raw[j * size:(j + 1) * size]
        if len(chunk) < size:
            break
        a = np.frombuffer(chunk, dtype=np.uint8)
        got[k] = float((a > 127).mean())
    bad = []
    for k, want, i in checks:
        if k not in got:
            continue
        on = got[k] > 0.002
        if on != want:
            bad.append({"cue": cues[i].get("id", i), "frame": k, "t": round(k / fps, 3), "expected": "visible" if want else "hidden", "text": cues[i].get("text", "")[:60]})
    return {"ok": not bad, "frames": len(got), "bad": bad[:20]}


def reflow_plan(project: dict[str, Any]) -> dict[str, Any]:
    fps = int(project.get("fps") or 30)
    scenes = project.get("scenes") or []
    cues = sorted(project.get("cues") or [], key=lambda c: float(c["start"]))
    by_id = {c.get("id"): c for c in cues}
    if not scenes:
        return {"durations": [], "changes": [], "linked": 0}
    starts: list[float] = []
    linked = 0
    for i, s in enumerate(scenes):
        own = [by_id[c] for c in (s.get("cue_ids") or []) if c in by_id]
        if own:
            linked += 1
        if i == 0:
            starts.append(0.0)
            continue
        prev = starts[-1]
        if own:
            first = min(own, key=lambda c: float(c["start"]))
            before = [c for c in cues if float(c["end"]) <= float(first["start"]) + 1e-6]
            gap = max(0.0, float(first["start"]) - (float(before[-1]["end"]) if before else 0.0))
            start = _snap(float(first["start"]) - min(0.12, gap / 2), fps)
        else:
            start = prev + float(scenes[i - 1]["duration"])
        starts.append(max(prev + 0.5, start))
    last = scenes[-1]
    own_last = [by_id[c] for c in (last.get("cue_ids") or []) if c in by_id]
    old_end = float(last["start"]) + float(last["duration"])
    end = max(old_end, max(float(c["end"]) for c in own_last) + 0.3) if own_last else starts[-1] + float(last["duration"])
    bounds = starts + [max(starts[-1] + 0.5, end)]
    durations = [_snap(bounds[i + 1] - bounds[i], fps) for i in range(len(scenes))]
    changes = [{"index": i, "id": s["id"], "title": s.get("title", ""), "from": round(float(s["duration"]), 3), "to": durations[i],
                "start_from": round(float(s.get("start") or 0), 3), "start_to": round(starts[i], 3)}
               for i, s in enumerate(scenes) if abs(durations[i] - float(s["duration"])) > 0.5 / fps]
    return {"durations": durations, "changes": changes, "linked": linked}
