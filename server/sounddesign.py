from __future__ import annotations

import asyncio
import re
import uuid
from typing import Any, Callable

from . import audio
from . import llm as llmmod
from .store import store

SYSTEM = """You are the Sound Designer of an animation studio. You place sound effects on the film's timeline so every important on-screen
event and story beat is heard: footsteps when someone walks, glass on a break, a whoosh into fast moves, an impact on reveals, a riser
under rising tension, an ambience bed that sets each place (wind, rain, fire, city, crowd, ocean, bees). Few sounds, exactly on time,
quieter than the voice. Return JSON only."""


def _scene_digest(project: dict[str, Any], s: dict[str, Any]) -> str:
    start, end = float(s["start"]), float(s["start"]) + float(s["duration"])
    words = [f"{w['t'] - start:.2f} {w['w']}" for c in project.get("cues") or [] for w in (c.get("words") or []) if start <= w["t"] < end][:60]
    code = s.get("code") or ""
    beats = re.findall(r"(?:do:\s*'(\w+)'|component\('([\w-]+)')", code)[:24]
    acts = ", ".join(sorted({a or b for a, b in beats}))
    return (f"Scene {s['index'] + 1} ({float(s['duration']):.1f}s) {s.get('title', '')}\n  narration: {s.get('narration', '')[:260]}\n  visual: {s.get('visual', '')[:260]}\n"
            f"  animated parts: {acts or 'n/a'}\n  word times (scene seconds): {' | '.join(words) or 'none'}")


def _prompt(project: dict[str, Any]) -> str:
    lib = "\n".join(f"- {k}: {v}" for k, v in audio.SFX_LIBRARY.items())
    scenes = "\n".join(_scene_digest(project, s) for s in project["scenes"])
    return (f"Film: {project.get('title', '')}. Brief: {project.get('brief', '')[:700]}\n\nScenes:\n{scenes}\n\nSynthesised library (use the name):\n{lib}\n\n"
            "You may also request a real recording from free libraries with \"search\": \"short english query\" (for sounds the library lacks, such as "
            "a dog bark, a car engine, a helicopter, a crowd scream).\n"
            'Return {"cues": [{"scene": n, "t": scene seconds, "sfx": "library name" or omit, "search": "query" or omit, "gain": 0.2 to 0.9, '
            '"dur": seconds for ambiences, footsteps, sirens and other loops, "why": "short"}]}. Two to five cues per scene, at most one ambience bed per scene '
            "(gain 0.15 to 0.3, dur about the scene length), hits 0.03 s before the visual or word they belong to, nothing louder than 0.8.")


def heuristic(project: dict[str, Any]) -> list[dict[str, Any]]:
    cues = []
    for s in project["scenes"]:
        text = f"{s.get('narration', '')} {s.get('visual', '')}".lower()
        d = float(s["duration"])
        for words, name in ((("rain", "storm"), "rain"), (("fire", "burn", "smoke"), "fire"), (("wind", "empty", "quiet"), "wind"), (("city", "street", "traffic"), "city"),
                            (("sea", "ocean", "beach", "river"), "ocean"), (("bee",), "bees"), (("crowd", "people"), "crowd")):
            if any(w in text for w in words):
                cues.append({"scene": s["index"] + 1, "t": 0.0, "sfx": name, "gain": 0.22, "dur": d})
                break
        for words, name in ((("siren",), "siren"), (("radio",), "radio-static"), (("glass", "window"), "glass"), (("ran", "run"), "running"), (("walk",), "footsteps"),
                            (("zombie", "dead"), "zombie-groan"), (("gate", "door"), "gate-creak"), (("thunder",), "thunder"), (("heart", "fear"), "heartbeat")):
            if any(w in text for w in words):
                cues.append({"scene": s["index"] + 1, "t": min(d * 0.3, 1.2), "sfx": name, "gain": 0.45, "dur": min(3.0, d * 0.6)})
        if s["index"] > 0:
            cues.append({"scene": s["index"] + 1, "t": 0.0, "sfx": "whoosh", "gain": 0.35})
    return cues


async def plan(project: dict[str, Any], on_token: Any = None) -> list[dict[str, Any]]:
    model = llmmod.LLM("director")
    if not model.available:
        return heuristic(project)
    try:
        data = await model.json(SYSTEM, _prompt(project), on_token=on_token, max_tokens=4000)
        cues = data.get("cues") if isinstance(data, dict) else None
        if isinstance(cues, list) and cues:
            return cues
    except Exception:
        pass
    return heuristic(project)


async def apply(pid: str, cues: list[dict[str, Any]], emit: Callable[[str, dict[str, Any]], None] | None = None) -> dict[str, Any]:
    from . import media_sources as ms
    project = store.get(pid)
    by_index = {s["index"] + 1: s for s in project["scenes"]}
    clips: list[dict[str, Any]] = []
    searches = 0
    for cue in cues[:60]:
        if not isinstance(cue, dict):
            continue
        try:
            scene = by_index.get(int(cue.get("scene")))
        except (TypeError, ValueError):
            continue
        if not scene:
            continue
        t = float(scene["start"]) + max(0.0, min(float(scene["duration"]), float(cue.get("t") or 0)))
        gain = max(0.05, min(0.85, float(cue.get("gain") or 0.5)))
        clip: dict[str, Any] = {"id": "sd_" + uuid.uuid4().hex[:8], "t": round(t, 3), "gain": gain, "by": "sound", "label": str(cue.get("why") or cue.get("sfx") or cue.get("search") or "")[:60]}
        dur = cue.get("dur")
        if dur:
            clip["dur"] = round(max(0.2, min(float(dur), float(scene["start"]) + float(scene["duration"]) - t + 0.4)), 2)
            clip["fade_out"] = 0.4
            clip["fade_in"] = 0.2
        name = str(cue.get("sfx") or "").strip()
        if name in audio.SFX_LIBRARY:
            clip["sfx"] = name
            clip["seed"] = len(clips) + 3
        elif cue.get("search") and searches < 8:
            searches += 1
            try:
                found = await ms.search_audio(str(cue["search"])[:60], "sfx", 12)
                got = None
                for item in found[:3]:
                    try:
                        got = await ms.collect_audio(pid, item, 0, min(8.0, float(dur or 6)))
                        break
                    except Exception:
                        continue
                if not got:
                    continue
                clip["asset"] = got["id"]
                if emit:
                    emit("asset.added", {"asset": got})
            except Exception:
                continue
        else:
            continue
        clips.append(clip)

    def save(doc: dict[str, Any]) -> None:
        a = doc.setdefault("audio", {})
        kept = [c for c in a.get("clips") or [] if c.get("by") != "sound"]
        a["clips"] = kept + clips
        a["sfx"] = False
        a["sound_designed"] = True
    store.mutate(pid, save)
    return {"clips": len(clips), "searched": searches}


async def run(pid: str, emit: Callable[[str, dict[str, Any]], None] | None = None, on_token: Any = None) -> dict[str, Any]:
    project = store.get(pid)
    cues = await plan(project, on_token)
    return await apply(pid, cues, emit)
