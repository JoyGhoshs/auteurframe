from __future__ import annotations

import json
import re
from typing import Any

from . import cast3d

MEDIA = ("3d", "toon", "stickman", "anime", "none")
TOON_PRESETS = ("kid", "teen-girl", "teen-boy", "old-man", "old-woman", "police", "soldier", "doctor", "scientist", "businessman", "chef", "biker",
                "beekeeper", "thief", "zombie", "hero", "teacher", "nurse", "firefighter", "astronaut", "pirate", "wizard", "king", "queen", "princess", "ninja", "farmer", "artist", "detective", "graduate", "builder", "viking", "mail-carrier", "singer", "athlete", "photographer")
TOON_HATS = ("beanie", "cap", "police", "military", "helmet", "beekeeper", "cowboy", "chef", "crown", "hood", "tophat", "hardhat", "headband", "party", "wizard", "beret", "bandana", "firefighter", "graduation", "pirate", "nurse", "space", "ninja", "fedora", "viking", "none")
TOON_HAIR = ("messy", "bowl", "spiky", "side", "ponytail", "long", "bun", "curly", "wild", "bald-sides", "mohawk", "bald")
TOON_EXTRAS = ("backpack", "cape", "tie", "badge", "scarf", "apron", "stethoscope", "vest", "glasses", "sunglasses", "eyepatch", "bandage", "freckles", "scar", "earrings", "bowtie", "necklace", "sash", "belt")
TOON_PROPS = ("flashlight", "phone", "money", "radio", "sign", "torch", "book", "bag", "cup", "umbrella", "map", "key", "wand", "sword", "clipboard", "paintbrush", "pointer", "microphone", "camera", "balloon", "flower", "hammer", "pan", "ball", "magnifier")
STICK_STYLES = ("classic", "filled", "chalk", "neon", "marker")
STICK_HATS = ("none", "beanie", "cap", "hair")
SPECIES = ("dog", "cat", "rabbit", "fox", "pig", "bird", "bear", "mouse", "lion", "sheep", "cow", "horse", "panda")
ANIME_HAIR = ("short", "spiky", "messy", "long", "bob", "ponytail", "twintails", "bun")
ANIME_OUTFITS = ("coat", "uniform", "hoodie", "kimono", "armor", "jacket", "dress", "shirt")
ANIME_ACCESSORIES = ("none", "scarf", "ribbon", "tie", "headband", "hairclip", "glasses")
ANIME_COATS = ("#7a2e3a", "#2f6a58", "#7a6230", "#40507e", "#6a3a7a", "#5a6a72")
ANIME_SCRIPTS = ("indigo", "ember", "noon", "sakura", "festival", "storm", "dawn", "neon")
ANIME = re.compile(r"(?<![a-z])(anime|manga|japanese animation|sakuga|shonen|shounen|shojo|shoujo|isekai|cel[- ]animated|cel animation)(?![a-z])")
HEX = re.compile(r"#[0-9A-Fa-f]{6}")
STORY = re.compile(r"(?<![a-z])(he|she|his|her|they|character|characters|hero|story|girl|boy|man|woman|kid|friend|meets|journey|adventure|cartoon|stickman|stick figure)(?![a-z])")
STICK = re.compile(r"(?<![a-z])(stick ?man|stick ?figures?|stickmen)(?![a-z])")

PROMPT = """Decide how this film's characters look so every scene stays consistent, like a real animated film with one model sheet.
Brief: {brief}
Visual style: {style}
Choose "medium":
- "toon": recurring 2D cartoon characters drawn with AuteurFrame's toon component (bold outlined story-channel look)
- "stickman": stick figure comedy or minimal line-art explainers
- "anime": 2D anime or cel animation (anime-face close-ups and anime-figure action, a closed colour script)
- "none": no recurring characters (motion graphics, data, documentary with real photos, product films)
Return JSON only:
{{"medium": "toon|stickman|anime|none", "script": for anime one of {scripts},
 "cast": [{{"id": "short-lowercase-id", "name": "Name", "role": "who they are in one line",
           "preset": one of {presets}, "hat": one of {hats}, "hatColor": "#hex", "hair": one of {hair}, "hairColor": "#hex",
           "shirt": "#hex", "pants": "#hex", "skin": "#hex or omit", "extras": subset of {extras}, "prop": one of {props} or omit,
           "style": for stickman one of {stick}, "stickHat": for stickman one of {stickhats},
           "anime": for anime {{"hair": one of {ahair}, "hairColor": "#hex", "iris": "#hex", "outfit": one of {aoutfits}, "coat": "#hex", "accent": "#hex", "accessory": one of {aacc}}}}},
          {{"id": "short-id", "name": "Name", "role": "...", "kind": "animal", "species": one of {species}, "color": "#hex", "color2": "#hex", "collar": "#hex or omit", "spots": true or false}}],
 "world": "the recurring place and its look in one sentence",
 "why": "one sentence"}}
For "none" return an empty cast. One to four characters, each with one signature colour and silhouette.
For anime, give every character a different mid-tone coat and hair colour (never near-black or near-white) so they read apart at night. Pets and animals use the animal form, never a human preset."""


def _rx(word: str) -> str:
    return r"(?<![a-z0-9])" + re.escape(word.lower()) + r"(?![a-z0-9])"


def luminance(hexcolor: str) -> float:
    def ch(v: int) -> float:
        c = v / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (int(hexcolor[i:i + 2], 16) for i in (1, 3, 5))
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def wants_characters(project: dict[str, Any]) -> bool:
    text = f"{project.get('title', '')} {project.get('brief', '')}".lower()
    return bool(STORY.search(text))


def fallback2d(project: dict[str, Any]) -> dict[str, Any]:
    text = f"{project.get('title', '')} {project.get('brief', '')}".lower()
    forced = ((project.get("options") or {}).get("medium") or "auto").lower()
    if forced == "none":
        return {"medium": "none", "cast": [], "world": "", "why": "chosen in the new film settings"}
    if forced == "stickman":
        return {"medium": "stickman", "cast": [{"id": "hero", "name": "Hero", "style": "classic", "hat": "none"}], "world": "", "why": "chosen in the new film settings"}
    if forced == "anime" or (forced == "auto" and ANIME.search(text)):
        return {"medium": "anime", "script": "indigo", "cast": [{"id": "hero", "name": "Hero", "hair": "messy", "outfit": "coat", "accessory": "scarf"}],
                "world": "", "why": "chosen in the new film settings" if forced == "anime" else "the brief asks for anime"}
    if forced in ("toon", "2d"):
        preset = next((p for p in TOON_PRESETS if re.search(_rx(p.replace("-", " ")), text)), "kid")
        return {"medium": "toon", "cast": [{"id": "hero", "name": "Hero", "preset": preset}], "world": "", "why": "chosen in the new film settings"}
    if STICK.search(text):
        return {"medium": "stickman", "cast": [{"id": "hero", "name": "Hero", "style": "classic", "stickHat": "none"}], "world": "", "why": "the brief asks for stick figures"}
    if not wants_characters(project):
        return {"medium": "none", "cast": [], "world": "", "why": "no recurring characters in the brief"}
    preset = next((p for p in TOON_PRESETS if re.search(_rx(p.replace("-", " ")), text)), "kid")
    return {"medium": "toon", "cast": [{"id": "hero", "name": "Hero", "preset": preset}], "world": "", "why": "picked from the brief's words"}


def validate2d(raw: Any, project: dict[str, Any]) -> dict[str, Any]:
    base = fallback2d(project)
    if not isinstance(raw, dict) or raw.get("medium") not in ("toon", "stickman", "anime", "none"):
        return base
    out = {"medium": raw["medium"], "cast": [], "world": str(raw.get("world") or "")[:240], "why": str(raw.get("why") or "")[:200]}
    if out["medium"] == "anime":
        out["script"] = raw.get("script") if raw.get("script") in ANIME_SCRIPTS else "indigo"
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
        elif out["medium"] == "anime":
            a = c.get("anime") if isinstance(c.get("anime"), dict) else c
            m["hair"] = a.get("hair") if a.get("hair") in ANIME_HAIR else "short"
            m["outfit"] = a.get("outfit") if a.get("outfit") in ANIME_OUTFITS else "coat"
            m["accessory"] = a.get("accessory") if a.get("accessory") in ANIME_ACCESSORIES else "none"
            for key in ("hairColor", "iris", "coat", "accent", "skin"):
                if isinstance(a.get(key), str) and HEX.fullmatch(a[key]) and 0.025 <= luminance(a[key]) <= 0.92:
                    m[key] = a[key]
            taken = {x.get("coat") for x in out["cast"]} | ({None} if out["cast"] else set())
            if m.get("coat") in taken:
                m["coat"] = next(col for col in ANIME_COATS if col not in taken)
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
    if isinstance(spec, dict) and spec.get("medium") in ("toon", "stickman", "anime"):
        return spec
    return None


def _params(c: dict[str, Any], skip: tuple[str, ...] = ("id", "name", "role")) -> dict[str, Any]:
    return {k: v for k, v in c.items() if k not in skip}


def text_for_director(project: dict[str, Any]) -> str:
    b = bible(project)
    if not b:
        return ""
    who = "; ".join(f"{c.get('name', c['id'])} (id {c['id']}{', ' + c['role'] if c.get('role') else ''})" for c in b["cast"])
    medium = {"3d": f"3D world3d film ({b.get('look')} look, main set {b.get('set')})", "toon": "2D toon cartoon film", "stickman": "stick figure film",
              "anime": f"2D anime film in the '{b.get('script', 'indigo')}' colour script"}[b["medium"]]
    return (f"CONTINUITY BIBLE (locked by the art director): this is a {medium}. Recurring cast: {who}. "
            "Every scene that shows a character uses this cast in this medium, never redesigned and never switched between 2D and 3D. "
            "Name the cast members who appear in each scene's visual, keep one world and one lighting logic, and carry screen direction, props and "
            "state (injuries, hair, mess) from scene to scene. For character scenes set instruments to "
            + ('["3d"]' if b["medium"] == "3d" else '["character"]') + "."
            + (" Plan it as anime shot sheets: establish (wide, silhouettes, one small push), approach (closer cut), turn (anticipation then hold), "
               "one sakuga action scene per 20 seconds with the camera locked, aftermath (hold), button (close-up and the line). Get closer by cutting "
               "to a tighter scene, never by zooming, and cut on the action. Leave on-screen words empty unless the brief gives a title or a "
               "line of dialogue; anime tells the story in drawings." if b["medium"] == "anime" else ""))


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
    if b["medium"] == "anime":
        scr = b.get("script", "indigo")
        who = ", ".join(f"{c.get('name', c['id'])} = {json.dumps(dict(_params(c), script=scr))}" for c in people)
        return ("CONTINUITY: this film is 2D anime in the closed colour script '" + scr + "'. "
                + (f"Draw every person with AU.component('anime-face', {{...}}) for close and medium close shots and AU.component('anime-figure', {{...}}) for medium, "
                   f"wide and action shots, using exactly these parameters (add only x, y, h, facing, turn, expression, pose and actions): {who}. " if people else "")
                + (f"Draw every animal with AU.component('toon-animal', {{...}}) using exactly: {pets}. " if animals else "")
                + f"Every anime-set, anime-face, anime-figure and anime-fx uses script: '{scr}'; never introduce colours outside it. Act on twos, hold settled "
                "drawings at least half a second, never fade characters in, and keep one sakuga action shot per sequence. Give each character layer: '<cast id>'. "
                + (f"World: {b.get('world')}. " if b.get("world") else ""))
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


def mentions(scene: dict[str, Any], b: dict[str, Any]) -> list[dict[str, Any]]:
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
        "anime": bool(re.search(r"component\(\s*['\"]anime-(face|figure)['\"]", code)),
    }
    medium = b["medium"]
    names = ", ".join(c.get("name", c["id"]) for c in b["cast"])
    others = [m for m in ("3d", "toon", "stickman", "anime") if m != medium and uses[m]]
    if others:
        label = {"3d": "3D world3d", "toon": "2D toon", "stickman": "stick figure", "anime": "2D anime"}
        issues.append({"kind": "continuity", "severity": "P0", "message": f"medium drift: this film is a {label[medium]} film but the scene draws {', '.join(label[o] for o in others)} characters",
                       "fix": f"Rebuild the scene in the film's medium with the locked cast ({names}); do not mix media."})
    mentioned = mentions(scene, b)
    humans = [x for x in mentioned if x.get("kind") != "animal"]
    if humans and not uses[medium]:
        comp = {"3d": "world3d", "toon": "toon", "stickman": "stickman", "anime": "anime-face or anime-figure"}[medium]
        issues.append({"kind": "continuity", "severity": "P0", "message": f"cast missing: the scene features {', '.join(c.get('name', c['id']) for c in humans)} but does not use the {comp} component",
                       "fix": f"Show the character with AU.component('{comp}', ...) using the locked cast parameters, like every other scene."})
    for c in [x for x in mentioned if x.get("kind") == "animal"]:
        if medium == "3d":
            if not re.search(r"model\s*:\s*['\"]" + re.escape(c.get("model", "dog")) + r"['\"]", code):
                issues.append({"kind": "continuity", "severity": "P1", "message": f"cast missing: {c.get('name', c['id'])} (3d animals) is not in the world3d cast",
                               "fix": f"Add {{ id: '{c['id']}', model: '{c.get('model', 'dog')}' }} to the world3d cast with the same colours as every scene."})
            continue
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
                "stickman": ("style", "hat", "shirt"), "anime": ("hair", "hairColor", "iris", "outfit", "accessory", "coat", "accent")}[medium]
        solo = [x for x in b["cast"] if x.get("kind") != "animal"]
        drawn = re.findall(r"component\(\s*['\"](?:world3d|figure3d|toon|toon-crowd|stickman|anime-face|anime-figure)['\"]", code)
        for c in mentioned or (solo if len(solo) == 1 else []):
            if medium == "3d" and not re.search(r"['\"]" + re.escape(c["id"]) + r"['\"]", code):
                continue
            if len(solo) > 1 and not re.search(r"['\"]" + re.escape(c["id"]) + r"['\"]", code) and len(drawn) < len(mentioned):
                continue
            wrong = [k for k in keys if k in c and not _has_value(code, k, c[k])]
            if medium in ("3d", "toon") and c.get("extras") and not _has_value(code, "extras", c["extras"]):
                wrong.append("extras")
            if wrong:
                want = {k: c[k] for k in wrong}
                issues.append({"kind": "continuity", "severity": "P1", "message": f"character drift: {c.get('name', c['id'])} does not match the model sheet ({', '.join(wrong)})",
                               "fix": f"Use exactly {json.dumps(want)} for {c.get('name', c['id'])}, as in every other scene."})
    if medium == "anime" and uses["anime"]:
        scr = b.get("script", "indigo")
        bad = sorted({m for m in re.findall(r"script\s*:\s*['\"]([a-z]+)['\"]", code) if m != scr})
        if bad:
            issues.append({"kind": "continuity", "severity": "P1", "message": f"colour script drift: the scene uses {', '.join(bad)} but the film is '{scr}'",
                           "fix": f"Set script: '{scr}' on every anime component, as in every other scene."})
        if re.search(r"(from|fromTo)\(\s*['\"][^'\"]*(anime|face|figure)[^'\"]*['\"]\s*,\s*\{[^}]*(opacity|autoAlpha)\s*:\s*0", code):
            issues.append({"kind": "continuity", "severity": "P2", "message": "a character fades in from opacity 0; anime characters cut in with the shot",
                           "fix": "Remove the opacity fade on the character and let it be present when the scene starts, or start the component later with at."})
    if medium == "3d" and uses["3d"] and project.get("cast3d"):
        look = project["cast3d"].get("look")
        m = re.search(r"look\s*:\s*['\"]([a-z]+)['\"]", code)
        if look and m and m.group(1) != look:
            issues.append({"kind": "continuity", "severity": "P1", "message": f"look drift: the scene uses look '{m.group(1)}' but the film is '{look}'",
                           "fix": f"Set look: '{look}' like every other scene."})
    return issues


async def design(project: dict[str, Any], emit, llm_factory) -> dict[str, Any]:
    model = llm_factory("art")
    forced = ((project.get("options") or {}).get("medium") or "auto").lower()
    if not model.available or forced == "none":
        return fallback2d(project)
    user = PROMPT.format(brief=project.get("brief", "")[:3000], style=(project.get("bible") or {}).get("name", project.get("style", "")),
                         presets=list(TOON_PRESETS), hats=list(TOON_HATS), hair=list(TOON_HAIR), extras=list(TOON_EXTRAS), props=list(TOON_PROPS),
                         stick=list(STICK_STYLES), stickhats=list(STICK_HATS), species=list(SPECIES), scripts=list(ANIME_SCRIPTS),
                         ahair=list(ANIME_HAIR), aoutfits=list(ANIME_OUTFITS), aacc=list(ANIME_ACCESSORIES))
    if forced in ("toon", "2d", "stickman", "anime"):
        user += f"\nThe user chose the medium '{'toon' if forced in ('toon', '2d') else forced}' in the film settings; use it."
    elif ANIME.search(f"{project.get('title', '')} {project.get('brief', '')}".lower()):
        user += "\nThe brief asks for anime; use the anime medium."
    raw = await model.json("You are the Art Director writing the film's model sheet.", user, max_tokens=1400)
    spec = validate2d(raw, project)
    if forced in ("toon", "2d", "stickman", "anime") and spec["medium"] != ("toon" if forced in ("toon", "2d") else forced):
        return fallback2d(project)
    return spec
