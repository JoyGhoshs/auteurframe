from __future__ import annotations

import random
import re
from typing import Any

from . import house, media, subtitles
from .store import project_dir

GRADES = {
    "clean": "Clean natural", "golden-film": "Golden film", "teal-orange": "Teal and orange", "mono": "Black and white", "vivid": "Vivid pop",
    "moody": "Moody low key", "cool": "Cool cinematic", "faded": "Faded retro",
}
STAMP_STYLES = ["pop", "highlight", "outline", "neon", "box"]
GFX_KINDS = ["follow", "progress", "stat", "comment", "arrow", "title"]


def grade_from_prompt(prompt: str) -> str:
    p = prompt.lower()
    for key, words in (("mono", ("black and white", "b&w", "noir", "monochrome")), ("golden-film", ("golden", "film", "warm", "vintage")),
                       ("teal-orange", ("cinematic", "teal", "hollywood")), ("moody", ("moody", "dark", "dramatic")), ("vivid", ("vivid", "vibrant", "pop", "bright")),
                       ("cool", ("cool", "blue", "tech")), ("faded", ("faded", "retro", "nostalgic"))):
        if any(w in p for w in words):
            return key
    return "clean"


def wants(prompt: str, *words: str) -> bool:
    p = prompt.lower()
    return any(w in p for w in words)


def emphasis_word(text: str, prompt_words: set[str]) -> str | None:
    words = re.findall(r"[A-Za-z][A-Za-z'\-]{2,}|\d[\d.,]*%?", text)
    if not words:
        return None
    nums = [w for w in words if w[0].isdigit()]
    if nums:
        return nums[0]
    hits = [w for w in words if w.lower() in prompt_words]
    if hits:
        return hits[0]
    content = [w for w in words if w.lower() not in house.STOP and len(w) >= 4]
    return max(content, key=len) if content else None


def plan_house(prompt: str, duration: float, cues: list[dict[str, Any]], speech: list[list[float]], seed: int, portrait: bool) -> dict[str, Any]:
    rnd = random.Random(seed)
    prompt_words = {w.lower() for w in re.findall(r"[A-Za-z]{4,}", prompt) if w.lower() not in house.STOP}
    edl: dict[str, Any] = {"grade": grade_from_prompt(prompt), "zooms": [], "stamps": [], "gfx": [], "broll": [], "sfx": [], "cut_silence": wants(prompt, "silence", "jump cut", "tighten", "pauses", "fast pace", "fast-paced"),
                           "captions": "pop" if portrait else "boxed", "music": "minimal" if not wants(prompt, "no music") else None}
    beats = [(c["start"], c["end"], c["text"]) for c in cues] if cues else [(a, b, "") for a, b in speech]
    if not cues and len(beats) < duration / 3.0:
        beats, t = [], 0.0
        while t < duration - 0.8:
            step = 2.0 + rnd.random() * 0.6
            beats.append((round(t, 3), round(min(duration, t + step), 3), ""))
            t += step
    level = 1.0
    for i, (a, b, text) in enumerate(beats):
        if a >= duration - 0.3:
            break
        if i % 3 == 2:
            edl["zooms"].append({"t": round(a, 3), "dur": round(max(0.6, b - a), 3), "scale": 1.12, "x": 0, "y": -0.04, "kind": "push"})
            level = 1.12
        else:
            target = 1.0 if level > 1.05 and i % 2 == 0 else round(1.16 + rnd.random() * 0.1, 3)
            edl["zooms"].append({"t": round(a, 3), "dur": 0.22, "scale": target, "x": round((rnd.random() - 0.5) * 0.06, 3), "y": round(-0.05 + rnd.random() * 0.04, 3), "kind": "punch"})
            if target > 1.0:
                edl["sfx"].append({"t": round(max(0, a - 0.06), 3), "sfx": "swoosh", "gain": 0.35})
            level = target
        if text and i % 2 == 0:
            word = emphasis_word(text, prompt_words)
            if word:
                style = STAMP_STYLES[(i // 2) % len(STAMP_STYLES)]
                edl["stamps"].append({"t": round(a + 0.1, 3), "dur": round(min(1.4, max(0.8, b - a)), 3), "text": word.upper(), "style": style, "y": 0.2 if portrait else 0.24})
                edl["sfx"].append({"t": round(a + 0.1, 3), "sfx": "pop", "gain": 0.45})
    if cues:
        edl["gfx"].append({"t": 0.2, "dur": min(2.8, duration * 0.3), "kind": "title", "text": house.headline(cues[0]["text"], 6).replace("*", "")})
    if wants(prompt, "progress"):
        edl["gfx"].append({"t": 0.0, "dur": duration, "kind": "progress", "text": ""})
    if wants(prompt, "follow", "subscribe", "cta", "call to action") or duration > 8:
        edl["gfx"].append({"t": max(0.0, duration - 2.6), "dur": 2.4, "kind": "follow", "text": ""})
        edl["sfx"].append({"t": max(0.0, duration - 2.6), "sfx": "notify", "gain": 0.5})
    if wants(prompt, "stat", "number", "data") and cues:
        for c in cues:
            num = house.find_number(c["text"])
            if num:
                edl["gfx"].append({"t": round(c["start"], 3), "dur": 2.0, "kind": "stat", "text": num["match"].strip(), "label": house.headline(c["text"], 5).replace("*", "")})
                break
    if (wants(prompt, "b-roll", "broll", "stock", "visual", "images") or len(cues) >= 4) and cues:
        for i, c in enumerate(cues):
            if i % 3 != 1:
                continue
            q = house.iconic(c["text"]) or house.keywords(c["text"], 2)
            if q:
                edl["broll"].append({"t": round(c["start"] + 0.2, 3), "dur": round(min(2.2, max(1.2, c["end"] - c["start"])), 3), "query": " ".join(q[:2]).lower(), "mode": "pip" if i % 2 else "full"})
                edl["sfx"].append({"t": round(c["start"] + 0.14, 3), "sfx": "whoosh", "gain": 0.3})
    return edl


EDIT_SYSTEM = """You are the lead editor of a short-form video team (captions, zooms, graphics, b-roll, sound, grade). You plan edits like top creators:
hook in the first second, a visual change every 1 to 2 seconds, punch-in zooms on emphasis, kinetic word stamps on key words, b-roll that illustrates nouns,
sound effects that land on visual hits, one consistent grade. Never cover the speaker's face with text for long; stamps sit in the upper third.
Return JSON only."""


def plan_prompt(prompt: str, duration: float, cues: list[dict[str, Any]], portrait: bool, assets: list[str]) -> str:
    lines = "\n".join(f"{c['start']:.2f}-{c['end']:.2f}: {c['text']}" for c in cues[:120]) or "(no transcript; plan from timing only)"
    return f"""Editing brief from the user: {prompt}
Clip length {duration:.2f}s, {'vertical 9:16' if portrait else 'landscape'}. Transcript with source timestamps:
{lines}
User images you may insert as b-roll by id: {', '.join(assets) or 'none'}
Grades: {', '.join(GRADES)}. Stamp styles: {', '.join(STAMP_STYLES)}. Graphics: {', '.join(GFX_KINDS)}. Sounds: whoosh, swoosh, pop, click, ding, impact, boom, riser, typing, shutter, glitch, notify.
Return {{"grade": str, "cut_silence": bool, "captions": "pop|karaoke|boxed|minimal|none", "music": mood or null,
"zooms": [{{"t": s, "dur": s, "scale": 1.0-1.4, "x": -0.2..0.2, "y": -0.2..0.2, "kind": "punch|push"}}],
"stamps": [{{"t": s, "dur": s, "text": "ONE OR TWO WORDS", "style": str, "y": 0.1-0.8}}],
"gfx": [{{"t": s, "dur": s, "kind": str, "text": str, "label": str}}],
"broll": [{{"t": s, "dur": s, "query": "stock search words", "asset": optional id, "mode": "full|pip"}}],
"sfx": [{{"t": s, "sfx": name, "gain": 0.2-0.9}}]}}. All times are source seconds."""


def sanitize(edl: dict[str, Any], duration: float) -> dict[str, Any]:
    def clamp_t(v: Any) -> float:
        try:
            return round(max(0.0, min(duration - 0.05, float(v))), 3)
        except (TypeError, ValueError):
            return 0.0
    out = {"grade": edl.get("grade") if edl.get("grade") in GRADES else "clean", "cut_silence": bool(edl.get("cut_silence")),
           "captions": edl.get("captions") if edl.get("captions") in ("pop", "karaoke", "boxed", "minimal", "none") else "pop",
           "music": edl.get("music") if isinstance(edl.get("music"), str) else None}
    for key in ("zooms", "stamps", "gfx", "broll", "sfx"):
        items = []
        for it in (edl.get(key) or [])[:80]:
            if not isinstance(it, dict):
                continue
            it = dict(it)
            it["t"] = clamp_t(it.get("t", 0))
            if "dur" in it:
                it["dur"] = round(max(0.15, min(duration, float(it.get("dur") or 1.0))), 3)
            if key == "zooms":
                it["scale"] = max(1.0, min(1.5, float(it.get("scale", 1.15))))
            items.append(it)
        out[key] = sorted(items, key=lambda x: x["t"])
    return out


def map_items(items: list[dict[str, Any]], tl: media.Timeline) -> list[dict[str, Any]]:
    out = []
    for it in items:
        o = tl.to_out(it["t"])
        if o is None:
            nxt = next((r for r in tl.ranges if r[0] >= it["t"]), None)
            o = tl.to_out(nxt[0]) if nxt else None
        if o is None:
            continue
        out.append(dict(it, t=o))
    return out


def map_cues(cues: list[dict[str, Any]], tl: media.Timeline) -> list[dict[str, Any]]:
    out = []
    for c in cues:
        a = tl.to_out(c["start"]) if tl.to_out(c["start"]) is not None else tl.to_out(next((r[0] for r in tl.ranges if r[0] >= c["start"]), c["end"]))
        b = tl.to_out(c["end"])
        if b is None:
            prev = [r for r in tl.ranges if r[1] <= c["end"]]
            b = tl.to_out(prev[-1][1]) if prev else None
        if a is None or b is None or b - a < 0.15:
            continue
        words = []
        for w in c.get("words") or []:
            wt = tl.to_out(w["t"])
            if wt is not None:
                words.append({"t": wt, "e": tl.to_out(w["e"]) or wt + 0.25, "w": w["w"]})
        cue = {"id": len(out), "start": a, "end": b, "text": c["text"]}
        if words:
            cue["words"] = words
        out.append(cue)
    return out


STAMP_LAYER = {
    "pop": {"style": {"size": 150, "weight": 900, "align": "center", "transform": "uppercase", "color": "#ffffff", "effect": "stroke-fill"}, "enter": {"preset": "pop", "duration": 0.35}},
    "highlight": {"style": {"size": 120, "weight": 900, "align": "center", "transform": "uppercase", "effect": "highlight", "bg": "#FFE500", "color": "#111111"}, "enter": {"preset": "wipe", "duration": 0.3}},
    "outline": {"style": {"size": 160, "weight": 900, "align": "center", "transform": "uppercase", "effect": "outline", "color": "#ffffff"}, "enter": {"preset": "zoom", "duration": 0.35}},
    "neon": {"style": {"size": 130, "weight": 800, "align": "center", "transform": "uppercase", "effect": "neon", "color": "#33E1FF"}, "enter": {"preset": "blur", "duration": 0.35}},
    "box": {"style": {"size": 110, "weight": 900, "align": "center", "transform": "uppercase", "bg": "#FF3D2E", "color": "#ffffff", "radius": 18}, "enter": {"preset": "spin", "duration": 0.4}},
}


def gfx_layers(g: dict[str, Any], portrait: bool) -> list[dict[str, Any]]:
    k = g.get("kind")
    t, d = g["t"], g.get("dur", 2.0)
    if k == "title":
        return [{"kind": "text", "text": g.get("text", ""), "x": 8, "y": 9 if portrait else 8, "w": 84, "start": t, "end": t + d, "enter": {"preset": "chars", "duration": 0.6}, "exit": {"preset": "lift", "duration": 0.3},
                 "style": {"size": 84 if portrait else 76, "weight": 850, "align": "center", "color": "#ffffff", "effect": "stroke-fill", "stroke": "rgba(0,0,0,0.85)"}}]
    if k == "follow":
        return [{"kind": "text", "text": g.get("text") or g.get("follow_text") or "Follow for more", "x": 22 if portrait else 34, "y": 74 if portrait else 78, "w": 56 if portrait else 32, "start": t, "end": t + d,
                 "enter": {"preset": "pop", "duration": 0.45}, "emphasis": "pulse", "style": {"size": 56, "weight": 800, "align": "center", "bg": "#FF3D2E", "color": "#ffffff", "radius": 999}}]
    if k == "progress":
        return [{"kind": "shape", "x": 0, "y": 99.2, "w": 100, "h": 0.8, "start": 0, "end": t + d, "enter": {"preset": "wipe", "duration": max(1.0, d)}, "style": {"bg": "#FFE500", "radius": 0}}]
    if k == "stat":
        return [{"kind": "text", "text": f"{g.get('text', '')}", "x": 10, "y": 30, "w": 80, "start": t, "end": t + d, "enter": {"preset": "bounce", "duration": 0.6},
                 "style": {"size": 220, "weight": 900, "align": "center", "color": "#FFE500", "effect": "stroke-fill"}},
                {"kind": "text", "text": g.get("label", ""), "x": 10, "y": 46, "w": 80, "start": t + 0.2, "end": t + d, "enter": {"preset": "rise", "duration": 0.4},
                 "style": {"size": 54, "weight": 700, "align": "center", "color": "#ffffff", "effect": "stroke-fill"}}]
    if k == "comment":
        return [{"kind": "text", "text": g.get("text", ""), "x": 8, "y": 58, "w": 70, "start": t, "end": t + d, "enter": {"preset": "pop", "duration": 0.4},
                 "style": {"size": 44, "weight": 650, "align": "left", "bg": "#ffffff", "color": "#111111", "radius": 22, "font": "var(--font-body)"}}]
    if k == "arrow":
        return [{"kind": "icon", "icon": "arrow-down-right", "x": 60, "y": 40, "w": 16, "start": t, "end": t + d, "enter": {"preset": "pop", "duration": 0.35}, "emphasis": "float", "style": {"color": "#FFE500", "stroke": 2.6}}]
    return []


def compile_edit(project: dict[str, Any], edl: dict[str, Any], source: dict[str, Any], analysis: dict[str, Any]) -> dict[str, Any]:
    fps = project["fps"]
    portrait = project["height"] > project["width"]
    duration = analysis["duration"]
    ranges = media.keep_ranges(duration, analysis.get("silences", [])) if edl.get("cut_silence") else [[0.0, round(duration, 3)]]
    tl = media.Timeline(ranges)
    out_cues = map_cues(analysis.get("source_cues") or [], tl)
    zooms = map_items(edl["zooms"], tl)
    stamps = map_items(edl["stamps"], tl)
    gfx = map_items(edl["gfx"], tl)
    broll = map_items(edl["broll"], tl)
    sfx = map_items(edl["sfx"], tl)
    total = tl.duration
    bounds = sorted(set([0.0] + tl.boundaries() + [total]))
    chunks: list[tuple[float, float]] = []
    for a, b in zip(bounds, bounds[1:]):
        n = max(1, int((b - a) // 5.0))
        step = (b - a) / n
        for i in range(n):
            chunks.append((round(a + i * step, 4), round(a + (i + 1) * step if i < n - 1 else b, 4)))
    chunks = [(round(round(a * fps) / fps, 4), round(round(b * fps) / fps, 4)) for a, b in chunks]
    chunks = [(a, b) for a, b in chunks if b - a >= 1.0 / fps]
    layers_all: list[dict[str, Any]] = []
    for i, s in enumerate(stamps):
        spec = STAMP_LAYER.get(s.get("style"), STAMP_LAYER["pop"])
        layers_all.append({"kind": "text", "text": str(s.get("text", ""))[:28], "x": 6, "y": round(float(s.get("y", 0.22)) * 100, 1), "w": 88, "start": s["t"], "end": s["t"] + s.get("dur", 1.0),
                           "enter": spec["enter"], "exit": {"preset": "shrink", "duration": 0.18}, "style": dict(spec["style"], size=int(spec["style"]["size"] * (1.0 if portrait else 0.75))), "agent": "captions", "src": None})
    for g in gfx:
        if g.get("kind") == "follow" and not g.get("text"):
            from . import fonts as fontlib, locale
            g = dict(g, text=locale.follow(fontlib.language_of(project)) or "Follow for more")
        for L in gfx_layers(g, portrait):
            L["agent"] = "gfx"
            layers_all.append(L)
    scenes = []
    rnd = random.Random(project.get("seed", 1))
    for i, (a, b) in enumerate(chunks):
        d = round(b - a, 4)
        src_in = tl.to_src(a + 1e-4)
        local_layers = []
        for j, L in enumerate(layers_all):
            if L["end"] <= a + 0.02 or L["start"] >= b - 0.02:
                continue
            ll = {k: v for k, v in L.items() if k not in ("agent",)}
            ll["id"] = f"E{i}_{j}"
            ll["start"] = round(max(0.0, L["start"] - a), 3)
            ll["end"] = round(min(d, L["end"] - a), 3)
            if L["start"] < a - 0.02:
                ll["enter"] = {"preset": "none"}
            local_layers.append(ll)
        local_broll = [dict(br, t=round(br["t"] - a, 3)) for br in broll if a - 0.01 <= br["t"] < b - 0.3]
        scenes.append({
            "id": f"sc_{i:03d}_{rnd.randrange(16 ** 4):04x}", "index": i, "title": f"Cut {i + 1}", "purpose": "edit", "start": round(a, 4), "duration": d,
            "narration": " ".join(c["text"] for c in out_cues if a <= (c["start"] + c["end"]) / 2 < b), "onscreen": "", "visual": "footage edit",
            "archetype": "footage-edit", "variant": 0, "code": None, "source": "edit", "status": "planned", "overrides": {}, "layers": local_layers,
            "data": {"src": source["id"], "src_in": round(src_in, 4), "t0": round(a, 4), "zooms": zooms, "grade": edl["grade"], "broll": local_broll, "fit": "cover"},
            "transition": {"type": "cut", "duration": 0.0},
        })
    return {"scenes": scenes, "cues": out_cues, "ranges": ranges, "duration": total, "sfx": [{"id": f"x{i}", "t": s["t"], "sfx": s.get("sfx", "pop"), "gain": float(s.get("gain", 0.5))} for i, s in enumerate(sfx)],
            "zooms": zooms, "stamps": stamps, "gfx": gfx, "broll": broll}


def ops_log(edl: dict[str, Any]) -> list[dict[str, Any]]:
    ops = []
    for i, z in enumerate(edl["zooms"]):
        ops.append({"agent": "zoom", "id": f"zoom-{i + 1:02d}", "t": z["t"], "track": "a-roll", "label": f"{'punch-in' if z.get('kind') == 'punch' else 'push'} {int(z['scale'] * 100)}%"})
    for i, s in enumerate(edl["stamps"]):
        ops.append({"agent": "captions", "id": f"caps-{i + 1:02d}", "t": s["t"], "track": "text", "label": f"stamp “{s.get('text', '')}”"})
    for i, g in enumerate(edl["gfx"]):
        ops.append({"agent": "gfx", "id": f"gfx-{i + 1:02d}", "t": g["t"], "track": "gfx", "label": f"{g.get('kind')} {g.get('text', '')}".strip()})
    for i, b in enumerate(edl["broll"]):
        ops.append({"agent": "broll", "id": f"broll-{i + 1:02d}", "t": b["t"], "track": "b-roll", "label": f"b-roll {b.get('query') or b.get('asset', '')}"})
    for i, s in enumerate(edl["sfx"]):
        ops.append({"agent": "sfx", "id": f"sfx-{i + 1:02d}", "t": s["t"], "track": "sfx", "label": f"{s.get('sfx')} @ {s['t']:.2f}s"})
    return sorted(ops, key=lambda o: o["t"])
