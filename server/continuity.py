from __future__ import annotations

import json
import re
from typing import Any

from . import cast3d

MEDIA = ("3d", "toon", "stickman", "none")
TOON_PRESETS = ("kid", "teen-girl", "teen-boy", "old-man", "old-woman", "police", "soldier", "doctor", "scientist", "businessman", "chef", "biker",
                "beekeeper", "thief", "zombie", "hero")
TOON_HATS = ("beanie", "cap", "police", "military", "helmet", "beekeeper", "cowboy", "chef", "crown", "hood", "tophat", "hardhat", "headband", "party", "none")
TOON_HAIR = ("messy", "bowl", "spiky", "side", "ponytail", "long", "bun", "curly", "wild", "bald-sides", "mohawk", "bald")
TOON_EXTRAS = ("backpack", "cape", "tie", "badge", "scarf", "apron", "stethoscope", "vest", "glasses", "sunglasses", "eyepatch", "bandage", "freckles", "scar", "earrings")
TOON_PROPS = ("flashlight", "phone", "money", "radio", "sign", "torch", "book", "bag", "cup", "umbrella", "map", "key")
STICK_STYLES = ("classic", "filled", "chalk", "neon", "marker")
STICK_HATS = ("none", "beanie", "cap", "hair")
SPECIES = ("dog", "cat", "rabbit", "fox", "pig", "bird")
HEX = re.compile(r"#[0-9A-Fa-f]{6}")
STORY = re.compile(r"(?<![a-z])(he|she|his|her|they|character|characters|hero|story|girl|boy|man|woman|kid|friend|meets|journey|adventure|cartoon|stickman|stick figure)(?![a-z])")
STICK = re.compile(r"(?<![a-z])(stick ?man|stick ?figures?|stickmen)(?![a-z])")

PROMPT = """Decide how this film's characters look so every scene stays consistent, like a real animated film with one model sheet.
Brief: {brief}
Visual style: {style}
Choose "medium":
- "toon": recurring 2D cartoon characters drawn with AuteurFrame's toon component (bold outlined story-channel look)
- "stickman": stick figure comedy or minimal line-art explainers
- "none": no recurring characters (motion graphics, data, documentary with real photos, product films)
Return JSON only:
{{"medium": "toon|stickman|none",
 "cast": [{{"id": "short-lowercase-id", "name": "Name", "role": "who they are in one line",
           "preset": one of {presets}, "hat": one of {hats}, "hatColor": "#hex", "hair": one of {hair}, "hairColor": "#hex",
           "shirt": "#hex", "pants": "#hex", "skin": "#hex or omit", "extras": subset of {extras}, "prop": one of {props} or omit,
           "style": for stickman one of {stick}, "stickHat": for stickman one of {stickhats}}},
          {{"id": "short-id", "name": "Name", "role": "...", "kind": "animal", "species": one of {species}, "color": "#hex", "color2": "#hex", "collar": "#hex or omit", "spots": true or false}}],
 "world": "the recurring place and its look in one sentence",
 "why": "one sentence"}}
For "none" return an empty cast. One to four characters, each with one signature colour and silhouette. Pets and animals use the animal form, never a human preset."""


def _rx(word: str) -> str:
    return r"(?<![a-z0-9])" + re.escape(word.lower()) + r"(?![a-z0-9])"


def wants_characters(project: dict[str, Any]) -> bool:
    text = f"{project.get('title', '')} {project.get('brief', '')}".lower()
    return bool(STORY.search(text))


def fallback2d(project: dict[str, Any]) -> dict[str, Any]:
    text = f"{project.get('title', '')} {project.get('brief', '')}".lower()
    if STICK.search(text):
        return {"medium": "stickman", "cast": [{"id": "hero", "name": "Hero", "style": "classic", "stickHat": "none"}], "world": "", "why": "the brief asks for stick figures"}
    if not wants_characters(project):
        return {"medium": "none", "cast": [], "world": "", "why": "no recurring characters in the brief"}
    preset = next((p for p in TOON_PRESETS if re.search(_rx(p.replace("-", " ")), text)), "kid")
    return {"medium": "toon", "cast": [{"id": "hero", "name": "Hero", "preset": preset}], "world": "", "why": "picked from the brief's words"}


def validate2d(raw: Any, project: dict[str, Any]) -> dict[str, Any]:
    base = fallback2d(project)
    if not isinstance(raw, dict) or raw.get("medium") not in ("toon", "stickman", "none"):
        return base
    out = {"medium": raw["medium"], "cast": [], "world": str(raw.get("world") or "")[:240], "why": str(raw.get("why") or "")[:200]}
    if out["medium"] == "none":
        return out
    for i, c in enumerate(raw.get("cast") or []):
        if not isinstance(c, dict):
            continue
        cid = re.sub(r"[^a-z0-9-]", "", str(c.get("id") or f"c{i}").lower())[:20] or f"c{i}"
        m: dict[str, Any] = {"id": cid, "name": str(c.get("name") or cid)[:40]}
        if c.get("role"):
            m["role"] = str(c["role"])[:100]
        if c.get("kind") == "animal" or c.get("species") in SPECIES:
            m["kind"] = "animal"
            m["species"] = c.get("species") if c.get("species") in SPECIES else "dog"
            for key in ("color", "color2", "collar"):
                if isinstance(c.get(key), str) and HEX.fullmatch(c[key]):
                    m[key] = c[key]
            if c.get("spots") is True:
                m["spots"] = True
        elif out["medium"] == "toon":
            m["preset"] = c.get("preset") if c.get("preset") in TOON_PRESETS else "kid"
            for key, allowed in (("hat", TOON_HATS), ("hair", TOON_HAIR), ("prop", TOON_PROPS)):
                if c.get(key) in allowed:
                    m[key] = c[key]
            ex = [e for e in (c.get("extras") or []) if e in TOON_EXTRAS]
            if ex:
                m["extras"] = ex[:4]
            for key in ("hatColor", "hairColor", "shirt", "pants", "skin"):
                if isinstance(c.get(key), str) and HEX.fullmatch(c[key]):
                    m[key] = c[key]
        else:
            m["style"] = c.get("style") if c.get("style") in STICK_STYLES else "classic"
            hat = c.get("stickHat") or c.get("hat")
            m["hat"] = hat if hat in STICK_HATS else "none"
            if isinstance(c.get("shirt"), str) and HEX.fullmatch(c["shirt"]):
                m["shirt"] = c["shirt"]
        out["cast"].append(m)
        if len(out["cast"]) >= 5:
            break
    if not out["cast"]:
        return base
    return out


def bible(project: dict[str, Any]) -> dict[str, Any] | None:
    if project.get("cast3d"):
        spec = project["cast3d"]
        return {"medium": "3d", "cast": spec.get("cast", []), "look": spec.get("look"), "set": spec.get("set")}
    spec = project.get("cast2d")
    if isinstance(spec, dict) and spec.get("medium") in ("toon", "stickman"):
        return spec
    return None


def _params(c: dict[str, Any], skip: tuple[str, ...] = ("id", "name", "role")) -> dict[str, Any]:
    return {k: v for k, v in c.items() if k not in skip}


def text_for_director(project: dict[str, Any]) -> str:
    b = bible(project)
    if not b:
        return ""
    who = "; ".join(f"{c.get('name', c['id'])} (id {c['id']}{', ' + c['role'] if c.get('role') else ''})" for c in b["cast"])
    medium = {"3d": f"3D world3d film ({b.get('look')} look, main set {b.get('set')})", "toon": "2D toon cartoon film", "stickman": "stick figure film"}[b["medium"]]
    return (f"CONTINUITY BIBLE (locked by the art director): this is a {medium}. Recurring cast: {who}. "
            "Every scene that shows a character uses this cast in this medium, never redesigned and never switched between 2D and 3D. "
            "Name the cast members who appear in each scene's visual, keep one world and one lighting logic, and carry screen direction, props and "
            "state (injuries, hair, mess) from scene to scene. For character scenes set instruments to "
            + ('["3d"]' if b["medium"] == "3d" else '["character"]') + ".")


def text_for_animator(project: dict[str, Any]) -> str:
    b = bible(project)
    if not b:
        return ""
    if b["medium"] == "3d":
        return cast3d.text_for_animator(project.get("cast3d"))
    cast = [_params(c) for c in b["cast"]]
    names = ", ".join(f"{c.get('name', c['id'])} = {json.dumps(_params(c))}" for c in b["cast"])
    people = [c for c in b["cast"] if c.get("kind") != "animal"]
    animals = [c for c in b["cast"] if c.get("kind") == "animal"]
    pets = ", ".join(f"{c.get('name', c['id'])} = {json.dumps({k: v for k, v in _params(c).items() if k != 'kind'})}" for c in animals)
    if b["medium"] == "toon":
        who = ", ".join(f"{c.get('name', c['id'])} = {json.dumps(_params(c))}" for c in people)
        return ("CONTINUITY: this film's characters are 2D toon characters. "
                + (f"Draw every person with AU.component('toon', {{...}}) using exactly these parameters (add only x, y, h, facing, actions and expression): {who}. " if people else "")
                + (f"Draw every animal with AU.component('toon-animal', {{...}}) using exactly: {pets} (add only x, y, h, facing and actions). " if animals else "")
                + "Never redraw them as 3D, stick figures or new designs. Give each character component layer: '<cast id>' so AU.component('speech', { target: '<cast id>', text }) "
                "can place dialogue above them. " + (f"World: {b.get('world')}. " if b.get("world") else ""))
    names = ", ".join(f"{c.get('name', c['id'])} = {json.dumps(_params(c))}" for c in people)
    return ((f"Draw every animal with AU.component('toon-animal', {{...}}) using exactly: {pets}. " if animals else "") + "CONTINUITY: this film uses stick figures. Draw every character with AU.component('stickman', {...}) using exactly these parameters "
            f"(add only x, y, h, facing, actions and impacts for this beat): {names}. Never switch to toon, 3D or a different line style. "
            + (f"World: {b.get('world')}. " if b.get("world") else "") + f"Cast list: {json.dumps(cast)}")


def _mentions(scene: dict[str, Any], b: dict[str, Any]) -> list[dict[str, Any]]:
    text = " ".join(str(scene.get(k) or "") for k in ("title", "visual", "narration", "onscreen")).lower()
    hits = []
    for c in b["cast"]:
        words = [c["id"].replace("-", " "), str(c.get("name", "")).lower()]
        words += [w for w in str(c.get("name", "")).lower().replace(".", " ").split() if len(w) > 2 and w not in ("the", "dr", "mr", "mrs", "ms")]
        if any(w and re.search(_rx(w), text) for w in words):
            hits.append(c)
    return hits


def _has_value(code: str, key: str, value: Any) -> bool:
    if isinstance(value, list):
        return all(_has_value(code, key, v) for v in value) if key != "extras" else all(re.search(r"['\"]" + re.escape(str(v)) + r"['\"]", code) for v in value)
    v = re.escape(str(value))
    return bool(re.search(r"['\"]?" + re.escape(key) + r"['\"]?\s*:\s*['\"]" + v + r"['\"]", code, re.I))


def check(project: dict[str, Any], scene: dict[str, Any], code: str) -> list[dict[str, Any]]:
    b = bible(project)
    if not b or not code:
        return []
    issues: list[dict[str, Any]] = []
    uses = {
        "3d": bool(re.search(r"component\(\s*['\"](world3d|figure3d)['\"]", code)),
        "toon": bool(re.search(r"component\(\s*['\"](toon|toon-crowd)['\"]", code)),
        "stickman": bool(re.search(r"component\(\s*['\"]stickman['\"]", code)),
    }
    medium = b["medium"]
    names = ", ".join(c.get("name", c["id"]) for c in b["cast"])
    others = [m for m in ("3d", "toon", "stickman") if m != medium and uses[m]]
    if others:
        label = {"3d": "3D world3d", "toon": "2D toon", "stickman": "stick figure"}
        issues.append({"kind": "continuity", "severity": "P0", "message": f"medium drift: this film is a {label[medium]} film but the scene draws {', '.join(label[o] for o in others)} characters",
                       "fix": f"Rebuild the scene in the film's medium with the locked cast ({names}); do not mix media."})
    mentioned = _mentions(scene, b)
    humans = [x for x in mentioned if x.get("kind") != "animal"]
    if humans and not uses[medium]:
        comp = {"3d": "world3d", "toon": "toon", "stickman": "stickman"}[medium]
        issues.append({"kind": "continuity", "severity": "P0", "message": f"cast missing: the scene features {', '.join(c.get('name', c['id']) for c in humans)} but does not use the {comp} component",
                       "fix": f"Show the character with AU.component('{comp}', ...) using the locked cast parameters, like every other scene."})
    for c in [x for x in mentioned if x.get("kind") == "animal"]:
        if not re.search(r"component\(\s*['\"]toon-animal['\"]", code):
            issues.append({"kind": "continuity", "severity": "P1", "message": f"cast missing: {c.get('name', c['id'])} appears in this scene but is not drawn with toon-animal",
                           "fix": f"Draw {c.get('name', c['id'])} with AU.component('toon-animal', {json.dumps({k: v for k, v in _params(c).items() if k != 'kind'})})."})
            continue
        wrong = [k for k in ("species", "color", "collar") if k in c and not _has_value(code, k, c[k])]
        if wrong:
            issues.append({"kind": "continuity", "severity": "P1", "message": f"character drift: {c.get('name', c['id'])} does not match the model sheet ({', '.join(wrong)})",
                           "fix": f"Use exactly {json.dumps({k: c[k] for k in wrong})} for {c.get('name', c['id'])}."})
    mentioned = [x for x in mentioned if x.get("kind") != "animal"]
    if uses[medium]:
        keys = {"3d": ("preset", "hair", "hat", "outfit", "skin", "hairColor", "shirt", "pants"), "toon": ("preset", "hat", "hair", "hairColor", "hatColor", "shirt", "pants", "skin"),
                "stickman": ("style", "hat", "shirt")}[medium]
        solo = [x for x in b["cast"] if x.get("kind") != "animal"]
        for c in mentioned or (solo if len(solo) == 1 else []):
            if medium == "3d" and not re.search(r"['\"]" + re.escape(c["id"]) + r"['\"]", code):
                continue
            wrong = [k for k in keys if k in c and not _has_value(code, k, c[k])]
            if medium in ("3d", "toon") and c.get("extras") and not _has_value(code, "extras", c["extras"]):
                wrong.append("extras")
            if wrong:
                want = {k: c[k] for k in wrong}
                issues.append({"kind": "continuity", "severity": "P1", "message": f"character drift: {c.get('name', c['id'])} does not match the model sheet ({', '.join(wrong)})",
                               "fix": f"Use exactly {json.dumps(want)} for {c.get('name', c['id'])}, as in every other scene."})
    if medium == "3d" and uses["3d"] and project.get("cast3d"):
        look = project["cast3d"].get("look")
        m = re.search(r"look\s*:\s*['\"]([a-z]+)['\"]", code)
        if look and m and m.group(1) != look:
            issues.append({"kind": "continuity", "severity": "P1", "message": f"look drift: the scene uses look '{m.group(1)}' but the film is '{look}'",
                           "fix": f"Set look: '{look}' like every other scene."})
    return issues


async def design(project: dict[str, Any], emit, llm_factory) -> dict[str, Any]:
    model = llm_factory("art")
    if not model.available:
        return fallback2d(project)
    user = PROMPT.format(brief=project.get("brief", "")[:3000], style=(project.get("bible") or {}).get("name", project.get("style", "")),
                         presets=list(TOON_PRESETS), hats=list(TOON_HATS), hair=list(TOON_HAIR), extras=list(TOON_EXTRAS), props=list(TOON_PROPS),
                         stick=list(STICK_STYLES), stickhats=list(STICK_HATS), species=list(SPECIES))
    raw = await model.json("You are the Art Director writing the film's model sheet.", user, max_tokens=1400)
    return validate2d(raw, project)
