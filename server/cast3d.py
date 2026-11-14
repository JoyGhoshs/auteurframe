from __future__ import annotations

import json
import re
from typing import Any

LOOKS = ("lowpoly", "felt", "clay", "toy", "paper")
SETS = ("studio", "lab", "battlefield", "suburb", "living-room", "forest", "city-night", "space")
PRESETS = ("scientist", "soldier", "knight", "kid", "teen-girl", "teen-boy", "businessman", "chef", "old-man", "hero", "astronaut", "zombie", "farmer", "robot")
HAIR = ("short", "side", "spiky", "messy", "ponytail", "bun", "long", "curly", "bald")
HATS = ("helmet", "cap", "hardhat", "chef", "beanie", "crown", "tophat", "straw", "space", "none")
OUTFITS = ("casual", "labcoat", "armor", "hoodie", "suit", "overalls", "suit-space", "robot")
EXTRAS = ("goggles", "glasses", "backpack", "cape", "beard", "mustache")
PROPS = ("sword", "shield", "wrench", "phone", "book", "cup", "torch", "flashlight", "sign", "umbrella", "briefcase", "flask")
HEX = re.compile(r"#[0-9A-Fa-f]{6}")

STRONG = ("low-poly", "lowpoly", "low poly", "roblox", "roblox-like", "blocky characters", "voxel", "claymation", "plasticine", "stop motion", "stop-motion",
          "world3d", "felt animation", "felt characters", "felt puppet", "felt style")
WEAK = ("3d", "3-d", "three dimensional", "toy", "clay", "felt")
NOUNS = r"(cartoon|cartoons|character|characters|animation|animated|short|shorts|film|style|look|world|scene|scenes|figure|figures|puppet|puppets|mascot|clip|clips)"


def wants_3d(project: dict[str, Any]) -> bool:
    medium = ((project.get("options") or {}).get("medium") or "auto").lower()
    if medium == "3d":
        return True
    if medium in ("toon", "2d", "stickman", "anime", "none"):
        return False
    text = f"{project.get('title', '')} {project.get('brief', '')}".lower()
    if re.search(r"(?<![a-z])(anime|manga|sakuga|cel[- ]animated)(?![a-z])", text) and not re.search(r"(?<![a-z0-9])(3d|3-d)(?![a-z0-9])", text):
        return False
    if re.search(r"(?<![a-z0-9])(3d|3-d)(?![a-z0-9])", text) and not re.search(r"(?<![a-z0-9])(3d|3-d)[\s-]+(print|printing|printer|printed|scan|scanner|scanning|glasses|tv|movie ticket|render|renders|rendering|product|logo|chart|charts|graph|map|maps|model of|mockup|animation of (?:a|an|the|our) (?:phone|product|app|logo))", text):
        return True
    if any(re.search(r"(?<![a-z0-9])" + re.escape(w) + r"(?![a-z0-9])", text) for w in STRONG):
        return True
    for w in WEAK:
        if re.search(r"(?<![a-z0-9])" + re.escape(w) + r"(?:[\s-]+[a-z,]+){0,3}?[\s-]+" + NOUNS + r"(?![a-z])", text):
            return True
    return False


def _pick(text: str, table: list[tuple[tuple[str, ...], str]], default: str) -> str:
    for words, value in table:
        if any(re.search(r"(?<![a-z])" + re.escape(w) + r"(?![a-z])", text) for w in words):
            return value
    return default


def fallback(project: dict[str, Any]) -> dict[str, Any]:
    text = f"{project.get('title', '')} {project.get('brief', '')}".lower()
    look = _pick(text, [(("felt", "fabric", "plush"), "felt"), (("clay", "claymation", "plasticine"), "clay"), (("toy", "vinyl", "plastic"), "toy"),
                        (("paper", "cardboard", "cut-out"), "paper")], "lowpoly")
    sett = _pick(text, [(("lab", "tesla", "experiment", "science", "scientist"), "lab"), (("battle", "castle", "catapult", "knight", "war", "siege"), "battlefield"),
                        (("tornado", "street", "suburb", "town", "neighbourhood", "neighborhood"), "suburb"), (("sofa", "living room", "home", "bedroom", "room"), "living-room"),
                        (("forest", "woods", "camp"), "forest"), (("space", "planet", "moon", "astronaut"), "space"), (("city", "night"), "city-night")], "studio")
    preset = _pick(text, [(("scientist", "inventor", "professor", "lab"), "scientist"), (("soldier", "army"), "soldier"), (("knight",), "knight"),
                          (("astronaut",), "astronaut"), (("chef", "cook"), "chef"), (("robot",), "robot"), (("zombie",), "zombie"), (("farmer",), "farmer"),
                          (("girl", "she", "her"), "teen-girl"), (("boy", "kid", "child"), "kid"), (("businessman", "ceo", "office"), "businessman")], "kid")
    return {"look": look, "set": sett, "cast": [{"id": "hero", "preset": preset}], "why": "picked from the brief's words"}


def validate(raw: Any, project: dict[str, Any]) -> dict[str, Any]:
    base = fallback(project)
    if not isinstance(raw, dict):
        return base
    out = {"look": raw.get("look") if raw.get("look") in LOOKS else base["look"], "set": raw.get("set") if raw.get("set") in SETS else base["set"], "cast": []}
    for i, c in enumerate(raw.get("cast") or []):
        if not isinstance(c, dict):
            continue
        cid = re.sub(r"[^a-z0-9-]", "", str(c.get("id") or f"c{i}").lower())[:20] or f"c{i}"
        if c.get("kind") == "animal" or c.get("model") in ("dog", "cat", "bird"):
            a: dict[str, Any] = {"id": cid, "kind": "animal", "model": c.get("model") if c.get("model") in ("dog", "cat", "bird") else "dog"}
            if c.get("name"):
                a["name"] = str(c["name"])[:40]
            cols = {k: v for k, v in (c.get("colors") or {}).items() if isinstance(v, str) and HEX.fullmatch(v) and re.fullmatch(r"[a-z_]{1,16}", str(k))}
            if cols:
                a["colors"] = cols
            out["cast"].append(a)
            continue
        m: dict[str, Any] = {"id": cid, "preset": c.get("preset") if c.get("preset") in PRESETS else "kid"}
        if c.get("name"):
            m["name"] = str(c["name"])[:40]
        for key, allowed in (("hair", HAIR), ("hat", HATS), ("outfit", OUTFITS), ("prop", PROPS), ("propL", PROPS)):
            if c.get(key) in allowed:
                m[key] = c[key]
        for key in ("skin", "hairColor", "hatColor", "shirt", "pants", "shoes"):
            if isinstance(c.get(key), str) and HEX.fullmatch(c[key]):
                m[key] = c[key]
        ex = [e for e in (c.get("extras") or []) if e in EXTRAS]
        if ex:
            m["extras"] = ex[:4]
        try:
            sc = float(c.get("scale", 1))
            if 0.6 <= sc <= 1.4 and sc != 1:
                m["scale"] = round(sc, 2)
        except (TypeError, ValueError):
            pass
        out["cast"].append(m)
        if len(out["cast"]) >= 5:
            break
    if not out["cast"]:
        out["cast"] = base["cast"]
    out["why"] = str(raw.get("why") or "designed by the art director")[:200]
    return out


PROMPT = """Design the recurring 3D cast and look for a film rendered with AuteurFrame's world3d component (characters built from primitives with painted faces).
Brief: {brief}
Return JSON only:
{{"look": one of {looks}, "set": the main set, one of {sets},
 "cast": [{{"id": "short-lowercase-id", "name": "Name", "preset": one of {presets}, "hair": one of {hair}, "hairColor": "#hex", "hat": one of {hats},
           "outfit": one of {outfits}, "extras": subset of {extras}, "prop": one of {props} or omit, "propL": "shield" or omit,
           "skin": "#hex", "shirt": "#hex", "pants": "#hex", "scale": 0.8 for children else 1}},
          {{"id": "short-id", "name": "Name", "kind": "animal", "model": one of ["dog", "cat", "bird"], "colors": {{"coat": "#hex"}}, "scale": 1}}],
 "why": "one sentence"}}
Give every character one signature colour and silhouette so they read instantly. One to four characters."""


def text_for_animator(spec: dict[str, Any] | None) -> str:
    if not spec:
        return ""
    cast = [{k: v for k, v in c.items() if k != "name"} for c in spec.get("cast", [])]
    names = ", ".join(f"{c.get('name', c['id'])} = id '{c['id']}'" for c in spec.get("cast", []))
    return ("THIS FILM IS 3D. Build this scene with the world3d component (read the procedural-3d-world skill) so every scene shares one world and cast. "
            f"Use look '{spec['look']}' and set '{spec['set']}' unless this beat clearly happens elsewhere. Cast ({names}); copy these parameters exactly "
            "and add only x, z, facing and actions for this beat: " + json.dumps(cast) + ". Direct the camera (shot, target, moves) and effects for the beat. "
            "Do not draw these characters in 2D or rebuild them with raw three.js.")
