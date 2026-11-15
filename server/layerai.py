from __future__ import annotations

import copy
import json
import math
import re
from typing import Any

from . import config, llm as llmmod

EASES = ["inOut", "linear", "in", "out", "back", "bounce", "hold"]
ENTERS = ["rise", "fade", "pop", "drop", "slideLeft", "slideRight", "zoom", "blur", "wipe", "iris", "spin", "none"]
TEXT_ENTERS = ["chars", "words", "typewriter", "scramble", "bounce", "mask", "block", "burst", "roll", "skate", "stomp", "tumble", "flicker", "scrapbook", "bungee", "tracking", "wave", "count"]
EXITS = ["none", "fade", "sink", "lift", "shrink", "blur", "slideLeft", "slideRight", "wipe"]
LOOPS = ["none", "pulse", "float", "sway", "spin"]
ACTORS = {"toon", "toon-animal", "stickman", "anime-figure", "model-spec", "character", "mascot", "anime-face"}
WORD = re.compile(r"[a-z][a-z-]*")

_MANIFEST: dict[str, Any] = {}


def manifest() -> dict[str, Any]:
    path = config.WEB / "runtime" / "components.json"
    key = path.stat().st_mtime if path.exists() else 0
    if _MANIFEST.get("key") != key:
        data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"components": []}
        _MANIFEST.update(key=key, by={c["name"]: c for c in data.get("components", [])})
    return _MANIFEST["by"]


def action_doc(component: str) -> str:
    meta = manifest().get(component) or {}
    return str(((meta.get("params") or {}).get("actions") or {}).get("doc") or "")


def action_names(component: str) -> set[str]:
    doc = action_doc(component)
    head = doc.split("at,")[0] if "at," in doc else doc
    skip = {"do", "with", "to", "dir", "up", "left", "right", "height", "anticipation", "frames", "smear", "true", "amount", "x"}
    return {w for w in WORD.findall(head.lower()) if w not in skip}


def expressions(component: str) -> list[str]:
    meta = manifest().get(component) or {}
    return list(((meta.get("params") or {}).get("expression") or {}).get("options") or [])


def _num(v: Any, lo: float, hi: float, default: float | None = None) -> float | None:
    try:
        x = float(v)
    except (TypeError, ValueError):
        return default
    if not math.isfinite(x):
        return default
    return round(max(lo, min(hi, x)), 3)


def clean_keys(keys: Any, duration: float) -> list[dict[str, Any]]:
    out = []
    for k in keys if isinstance(keys, list) else []:
        if not isinstance(k, dict):
            continue
        t = _num(k.get("t"), 0, duration)
        if t is None:
            continue
        out.append({"t": t, "dx": _num(k.get("dx"), -150, 150, 0.0), "dy": _num(k.get("dy"), -150, 150, 0.0), "scale": _num(k.get("scale"), 0, 20, 1.0),
                    "rotate": _num(k.get("rotate"), -3600, 3600, 0.0), "opacity": _num(k.get("opacity"), 0, 1, 1.0),
                    "ease": k.get("ease") if k.get("ease") in EASES else "inOut"})
    out.sort(key=lambda k: k["t"])
    dedup: list[dict[str, Any]] = []
    for k in out:
        if dedup and abs(dedup[-1]["t"] - k["t"]) < 0.02:
            dedup[-1] = k
        else:
            dedup.append(k)
    return dedup[:80]


def clean_actions(actions: Any, component: str, duration: float) -> list[dict[str, Any]]:
    allowed = action_names(component)
    faces = set(expressions(component))
    out = []
    for a in actions if isinstance(actions, list) else []:
        if not isinstance(a, dict):
            continue
        name = str(a.get("do") or "").strip().lower()
        if allowed and name not in allowed:
            continue
        at = _num(a.get("at"), 0, duration, 0.0)
        item: dict[str, Any] = {"do": name, "at": at, "duration": _num(a.get("duration"), 0.1, duration, 1.0)}
        if a.get("to") is not None:
            item["to"] = _num(a.get("to"), -20, 120, 50.0)
        if a.get("dir") in ("left", "right", "up", "down"):
            item["dir"] = a["dir"]
        if a.get("expression") and (not faces or a["expression"] in faces):
            item["expression"] = str(a["expression"])
        for key in ("height", "amount"):
            if a.get(key) is not None:
                item[key] = _num(a.get(key), 0, 100, None)
        if a.get("joint"):
            item["joint"] = str(a["joint"])[:30]
        out.append(item)
    out.sort(key=lambda a: a["at"])
    return out[:40]


def describe(layer: dict[str, Any], full: bool) -> dict[str, Any]:
    p = layer.get("params") or {}
    info: dict[str, Any] = {"id": layer.get("id"), "kind": layer.get("kind"), "name": layer.get("name") or layer.get("text") or layer.get("component") or layer.get("kind")}
    if layer.get("kind") == "component":
        info["component"] = layer.get("component")
        for key in ("preset", "species", "name", "model", "style", "outfit"):
            if p.get(key):
                info[key] = p[key]
        info["x"] = p.get("x", layer.get("x"))
        info["y"] = p.get("y", layer.get("y"))
        info["h"] = p.get("h")
        if p.get("facing"):
            info["facing"] = p["facing"]
    else:
        for key in ("x", "y", "w", "h"):
            if layer.get(key) is not None:
                info[key] = layer[key]
    info["start"] = layer.get("start", 0)
    info["end"] = layer.get("end")
    if full:
        info["keys"] = layer.get("keys") or []
        if layer.get("kind") == "component":
            info["actions"] = p.get("actions") or []
        info["enter"] = (layer.get("enter") or {}).get("preset") if isinstance(layer.get("enter"), dict) else layer.get("enter")
        info["exit"] = (layer.get("exit") or {}).get("preset") if isinstance(layer.get("exit"), dict) else layer.get("exit")
        info["emphasis"] = layer.get("emphasis", "none")
    return info


SPEED = re.compile(r"^(?:make (?:it|them|this|these) )?(?:a (?:bit|little) )?(?:(\d+(?:\.\d+)?)\s*x\s*)?(faster|slower|quicker|speed (?:it |them )?up|slow (?:it |them )?down)$")
STAGGER = re.compile(r"^stagger(?: (?:them|these|it))?(?: by)?(?: (\d+(?:\.\d+)?)\s*s?(?:ec(?:onds?)?)?)?$")
EASE_WORDS = {"bouncier": "bounce", "bouncy": "bounce", "springier": "back", "springy": "back", "snappy": "back", "snappier": "back", "smoother": "inOut",
              "softer": "inOut", "smooth": "inOut", "linear": "linear", "robotic": "linear"}
ENTER_WORDS = {"fade in": "fade", "pop in": "pop", "zoom in": "zoom", "blur in": "blur", "drop in": "drop", "rise in": "rise", "wipe in": "wipe", "spin in": "spin",
               "slide in from left": "slideRight", "slide in from the left": "slideRight", "slide in from right": "slideLeft", "slide in from the right": "slideLeft"}
EXIT_WORDS = {"fade out": "fade", "blur out": "blur", "shrink out": "shrink", "sink out": "sink", "lift out": "lift", "wipe out": "wipe",
              "slide out left": "slideLeft", "slide out right": "slideRight"}
LOOP_WORDS = {"float": "float", "bob": "float", "hover": "float", "pulse": "pulse", "breathe": "pulse", "sway": "sway", "wobble": "sway", "spin": "spin",
              "keep spinning": "spin", "stop looping": "none", "no loop": "none", "stop the loop": "none"}
FOLLOW_WORDS = {"follow", "follow it", "follow them", "camera follow", "camera follows", "follow with camera", "follow with the camera", "track it", "track", "camera track"}
CLEAR = {"remove the animation", "remove animation", "clear the animation", "clear animation", "reset the animation", "no animation", "stop moving"}


def _scale_time(layer: dict[str, Any], factor: float, duration: float) -> None:
    s0 = float(layer.get("start") or 0)
    if layer.get("keys"):
        layer["keys"] = clean_keys([dict(k, t=s0 + (float(k.get("t", 0)) - s0) * factor) for k in layer["keys"]], duration)
    p = layer.get("params") or {}
    if p.get("actions"):
        p["actions"] = [dict(a, at=round(s0 + (float(a.get("at", 0)) - s0) * factor, 3), duration=round(max(0.1, float(a.get("duration", 1)) * factor), 3)) for a in p["actions"]]
    for key in ("enter", "exit"):
        if isinstance(layer.get(key), dict) and layer[key].get("duration"):
            layer[key] = dict(layer[key], duration=round(max(0.1, float(layer[key]["duration"]) * factor), 3))


def _shift(layer: dict[str, Any], dt: float, duration: float) -> None:
    layer["start"] = round(max(0.0, min(duration - 0.2, float(layer.get("start") or 0) + dt)), 3)
    if layer.get("keys"):
        layer["keys"] = clean_keys([dict(k, t=float(k.get("t", 0)) + dt) for k in layer["keys"]], duration)
    p = layer.get("params") or {}
    if p.get("actions"):
        p["actions"] = [dict(a, at=round(max(0.0, float(a.get("at", 0)) + dt), 3)) for a in p["actions"]]


def instant(layers: list[dict[str, Any]], ids: list[str], instruction: str, duration: float) -> tuple[list[dict[str, Any]], str] | None:
    text = re.sub(r"[.!]+$", "", instruction.strip().lower())
    text = re.sub(r"\s+", " ", text)
    if not text or len(text.split()) > 7:
        return None
    out = copy.deepcopy(layers)
    picked = [L for L in out if L.get("id") in ids]
    if not picked:
        return None
    m = SPEED.match(text)
    if m:
        times = float(m.group(1)) if m.group(1) else 1.5
        slower = "slow" in m.group(2)
        factor = times if slower else 1 / times
        for L in picked:
            _scale_time(L, factor, duration)
        return out, f"{'slowed down' if slower else 'sped up'} by {times:g}x"
    m = STAGGER.match(text)
    if m and len(picked) > 1:
        gap = float(m.group(1)) if m.group(1) else 0.2
        for i, L in enumerate(picked):
            _shift(L, i * gap, duration)
        return out, f"staggered by {gap:g}s"
    if text in EASE_WORDS or text.replace("make it ", "").replace("make them ", "") in EASE_WORDS:
        ease = EASE_WORDS.get(text) or EASE_WORDS[text.replace("make it ", "").replace("make them ", "")]
        changed = False
        for L in picked:
            if L.get("keys"):
                L["keys"] = [dict(k, ease=ease) for k in L["keys"]]
                changed = True
        return (out, f"easing set to {ease}") if changed else None
    if text in ENTER_WORDS:
        for L in picked:
            L["enter"] = {"preset": ENTER_WORDS[text], "duration": 0.7}
        return out, f"entrance: {ENTER_WORDS[text]}"
    if text in EXIT_WORDS:
        for L in picked:
            L["exit"] = {"preset": EXIT_WORDS[text], "duration": 0.5}
        return out, f"exit: {EXIT_WORDS[text]}"
    if text in LOOP_WORDS:
        for L in picked:
            L["emphasis"] = LOOP_WORDS[text]
        return out, f"loop: {LOOP_WORDS[text]}"
    if text in CLEAR:
        for L in picked:
            L["keys"] = []
            if isinstance(L.get("params"), dict):
                L["params"]["actions"] = []
            L["emphasis"] = "none"
        return out, "animation cleared"
    return None


def schema() -> dict[str, Any]:
    key = {"type": "object", "properties": {"t": {"type": "number", "description": "seconds from scene start"},
                                            "dx": {"type": "number", "description": "offset from the layer's base position in % of frame width"},
                                            "dy": {"type": "number", "description": "offset in % of frame height (positive is down)"},
                                            "scale": {"type": "number"}, "rotate": {"type": "number", "description": "degrees"},
                                            "opacity": {"type": "number"}, "ease": {"type": "string", "enum": EASES}}, "required": ["t"]}
    action = {"type": "object", "properties": {"do": {"type": "string"}, "at": {"type": "number"}, "duration": {"type": "number"},
                                               "to": {"type": "number", "description": "walk/run target x in % of frame width"},
                                               "dir": {"type": "string", "enum": ["left", "right", "up", "down"]}, "expression": {"type": "string"}},
              "required": ["do", "at", "duration"]}
    layer = {"type": "object", "properties": {
        "id": {"type": "string"}, "keys": {"type": "array", "items": key, "description": "full keyframe list, replaces the old one"},
        "actions": {"type": "array", "items": action, "description": "characters only: full action list, replaces the old one"},
        "enter": {"type": "string", "enum": ENTERS + TEXT_ENTERS, "description": "text layers can also use the per-word and per-letter entrances"},
        "exit": {"type": "string", "enum": EXITS}, "emphasis": {"type": "string", "enum": LOOPS},
        "start": {"type": "number"}, "end": {"type": "number"}, "x": {"type": "number"}, "y": {"type": "number"},
        "facing": {"type": "string", "enum": ["left", "right"]}, "expression": {"type": "string"}}, "required": ["id"]}
    follow = {"type": "object", "properties": {"target": {"type": "string", "description": "layer id the camera locks onto"}, "from": {"type": "number"}, "to": {"type": "number"},
                                               "zoom": {"type": "number", "description": "1 to 3"}, "lag": {"type": "number", "description": "smoothing seconds, 0.2 to 0.6"},
                                               "lead": {"type": "number", "description": "look-ahead seconds, 0 to 0.5"}, "offsetX": {"type": "number"}}, "required": ["target"]}
    return {"type": "object", "properties": {"note": {"type": "string", "description": "one short sentence describing what you did"},
                                             "layers": {"type": "array", "items": layer},
                                             "camera_follow": {"type": "array", "items": follow, "description": "only when the user asks the camera to follow, track or chase something; segments can hand the camera from one layer to another"}},
            "required": ["layers"]}


SYSTEM = """You are the layer animator of AuteurFrame, a motion studio. The user selected some layers on the stage and tells you how to animate them.
Change only the selected layers. Coordinates are percentages of the frame: x from the left, y from the top.

Ways to animate a layer (combine them):
- keys: keyframes {t, dx, dy, scale, rotate, opacity, ease}. dx/dy are offsets from the layer's base position, in % of frame width/height.
  The value holds between keys and before the first key. Use 2 to 12 keys; put a key at the start of each move so it does not drift early.
- actions (characters only): body animation that moves limbs. To make a character travel, use walk or run with "to" (target x %), never keys.
  Use the action names listed for that character. Each action has at and duration in seconds from the scene start.
- enter / exit / emphasis: preset entrance, exit and loop effects. Text layers also have per-word and per-letter entrances:
  words, chars, stomp (words slam in), mask (rise from a baseline), block (colour block wipe), burst, roll, skate, tumble, flicker,
  scrapbook, bungee, tracking, wave, typewriter, scramble, count (a number counts up).
- start / end: when the layer is visible. x / y: move the base position. facing: left or right.
- camera_follow: a game-style follow camera that locks onto a layer (any layer id in the scene), with zoom, lag (smoothing) and lead (look-ahead).
  Use it only when the user mentions the camera following, tracking or chasing. Overlapping segments blend from one target to the next.
Keep timing inside the scene, leave a held beat at the end, and make motion readable: anticipation before big moves, ease out on landings.
Reply by calling the tool with the selected layers you changed."""


def prompt(scene: dict[str, Any], layers: list[dict[str, Any]], ids: list[str], instruction: str, aspect: str) -> str:
    selected = [describe(L, True) for L in layers if L.get("id") in ids]
    others = [describe(L, False) for L in layers if L.get("id") not in ids]
    vocab = []
    for comp in sorted({L.get("component") for L in layers if L.get("id") in ids and L.get("kind") == "component"}):
        if comp in ACTORS and action_doc(comp):
            faces = expressions(comp)
            vocab.append(f"- {comp} actions: {action_doc(comp)}" + (f"\n  expressions: {', '.join(x for x in faces if x)}" if faces else ""))
    return (f"Scene: {float(scene.get('duration') or 5):.2f}s long, frame {aspect}. Scene idea: {str(scene.get('visual') or scene.get('title') or '')[:300]}\n"
            f"Selected layers (animate these):\n{json.dumps(selected, ensure_ascii=False)}\n"
            f"Other layers on stage (for reference, do not change):\n{json.dumps(others, ensure_ascii=False)[:3000]}\n"
            + ("Action vocabulary:\n" + "\n".join(vocab) + "\n" if vocab else "")
            + f"\nUser direction: {instruction}")


def clean_follow(items: Any, layers: list[dict[str, Any]], duration: float) -> list[dict[str, Any]] | None:
    if not isinstance(items, list):
        return None
    known = {L.get("id") for L in layers}
    out = []
    for f in items[:6]:
        if not isinstance(f, dict) or f.get("target") not in known:
            continue
        start = _num(f.get("from"), 0, duration, 0.0)
        end = _num(f.get("to"), 0, duration, duration)
        if end is None or start is None or end <= start:
            continue
        out.append({"target": f["target"], "from": start, "to": end, "zoom": max(1.25, _num(f.get("zoom"), 1, 4, 1.6) or 1.6), "lag": _num(f.get("lag"), 0, 2, 0.35),
                    "lead": _num(f.get("lead"), 0, 1.5, 0.2), "offsetX": _num(f.get("offsetX"), -40, 40, 0.0), "offsetY": 0.0})
    return out or None


def normalize(result: Any, ids: list[str]) -> Any:
    if isinstance(result, list):
        return {"layers": result}
    if not isinstance(result, dict):
        return result
    if isinstance(result.get("layers"), list):
        return result
    if result.get("id") in ids:
        return {"layers": [result], "note": result.get("note")}
    for key in ("selected_layers", "animations", "animation", "changes", "result", "data"):
        val = result.get(key)
        if isinstance(val, list):
            return dict(result, layers=val)
        if isinstance(val, dict) and isinstance(val.get("layers"), list):
            return dict(result, layers=val["layers"])
    keyed = [dict(v, id=k) for k, v in result.items() if k in ids and isinstance(v, dict)]
    if keyed:
        return dict(result, layers=keyed)
    return result


def merge(layers: list[dict[str, Any]], ids: list[str], result: Any, duration: float) -> list[dict[str, Any]]:
    result = normalize(result, ids)
    out = copy.deepcopy(layers)
    by = {L.get("id"): L for L in out}
    items = result.get("layers") if isinstance(result, dict) else None
    if not isinstance(items, list):
        raise ValueError("the agent returned no layers")
    changed = 0
    for item in items:
        if not isinstance(item, dict) or item.get("id") not in ids or item.get("id") not in by:
            continue
        L = by[item["id"]]
        comp = L.get("kind") == "component"
        if "keys" in item:
            L["keys"] = clean_keys(item["keys"], duration)
        if comp and "actions" in item:
            L.setdefault("params", {})["actions"] = clean_actions(item["actions"], L.get("component", ""), duration)
        if item.get("enter") in ENTERS or (item.get("enter") in TEXT_ENTERS and L.get("kind") == "text"):
            L["enter"] = {"preset": item["enter"], "duration": (L.get("enter") or {}).get("duration", 0.7) if isinstance(L.get("enter"), dict) else 0.7}
        if item.get("exit") in EXITS:
            L["exit"] = {"preset": item["exit"], "duration": 0.5}
        if item.get("emphasis") in LOOPS:
            L["emphasis"] = item["emphasis"]
        start = _num(item.get("start"), 0, duration - 0.1)
        end = _num(item.get("end"), 0.1, duration)
        if start is not None:
            L["start"] = start
        if end is not None and end > (L.get("start") or 0):
            L["end"] = end
        for axis in ("x", "y"):
            v = _num(item.get(axis), -50, 150)
            if v is not None:
                L[axis] = v
                if comp:
                    L.setdefault("params", {})[axis] = v
        if comp and item.get("facing") in ("left", "right"):
            L.setdefault("params", {})["facing"] = item["facing"]
        if comp and item.get("expression") and item["expression"] in expressions(L.get("component", "")):
            L.setdefault("params", {})["expression"] = item["expression"]
        before = next((x for x in layers if x.get("id") == L.get("id")), None) or {}
        motion = lambda d: (d.get("keys") or [], (d.get("params") or {}).get("actions") or [], d.get("enter"), d.get("exit"), d.get("emphasis"),
                            (d.get("params") or {}).get("expression"), (d.get("params") or {}).get("facing"))
        if motion(L) != motion(before):
            changed += 1
    if not changed and not clean_follow((result or {}).get("camera_follow"), layers, duration):
        raise ValueError("the agent did not change any selected layer")
    return out


async def animate(project: dict[str, Any], scene: dict[str, Any], ids: list[str], instruction: str, on_token=None, use_free: bool = False) -> dict[str, Any]:
    layers = list(scene.get("layers") or [])
    duration = float(scene.get("duration") or 5)
    ids = [i for i in ids if any(L.get("id") == i for L in layers)]
    if not ids:
        raise ValueError("select at least one layer you added")
    quick = instant(layers, ids, instruction, duration)
    if quick:
        new, note = quick
        return {"layers": new, "note": note, "by": "instant"}
    if re.sub(r"[.!]+$", "", instruction.strip().lower()) in FOLLOW_WORDS:
        camera = dict(scene.get("camera") or {}, follow=[{"target": ids[0], "from": 0.0, "to": duration, "zoom": 1.6, "lag": 0.35, "lead": 0.2, "offsetX": 0.0, "offsetY": 0.0}])
        return {"layers": copy.deepcopy(layers), "camera": camera, "note": "camera follows the selection", "by": "instant"}
    token = llmmod.FREE_OK.set(True)
    force = llmmod.FREE_FORCE.set(bool(use_free))
    try:
        model = llmmod.LLM("animator", task="json")
        if not model.available:
            raise ValueError("connect a model to animate with words, or use a quick command like faster, slower, bouncier, fade in, float")
        last: Exception | None = None
        for _ in range(2):
            result = normalize(await model.json(SYSTEM, prompt(scene, layers, ids, instruction, project.get("aspect", "16:9")), on_token=on_token,
                                                max_tokens=4000, temperature=0.4, schema=schema(), tool="submit_animation"), ids)
            try:
                new = merge(layers, ids, result, duration)
                break
            except ValueError as error:
                last = error
        else:
            raise ValueError(f"the animator's answer did not fit the selection ({last}); try rephrasing")
    finally:
        llmmod.FREE_FORCE.reset(force)
        llmmod.FREE_OK.reset(token)
    out = {"layers": new, "note": str((result or {}).get("note") or "animated")[:200], "by": "agent"}
    follow = clean_follow((result or {}).get("camera_follow"), layers, duration)
    if follow:
        out["camera"] = dict(scene.get("camera") or {}, follow=follow)
    return out
