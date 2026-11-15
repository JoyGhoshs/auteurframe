from __future__ import annotations

import asyncio

import json
import re
from typing import Any, Callable

from . import house, llm as llmmod, qa, research, schemas, styles
from .memory import Brain
from .skills import library

RULESET = """AUTEUR RULESET (binding, enforced by automated QA):
R1 One hero per frame; everything else supports it.
R2 At most two type levels per shot; no text smaller than var(--fs-min).
R3 Landings decelerate (au.softLand), exits accelerate (au.exit); overshoot under 9 percent and only on accents.
R4 No dead frames: something visibly moves in every half second (ambient drift, camera push, stagger, light).
R5 Entrances finish by D-0.9s, then hold 0.6 to 1.4s so the cut lands on a resolved frame.
R6 The ground is never static: keep slow ambient motion alive.
R7 Use only the bible palette through CSS variables; the accent marks the one thing that matters.
R8 Continuity: bible tokens (fonts, palette, radius, stroke, texture) are locked; never restyle the film per scene.
R9 Scene transitions are done by the editor; do not fade the whole scene out at the end.
R10 Everything readable stays inside the safe area and never collides with the caption band.
R11 Nothing overflows its box and nothing important leaves the canvas.
R12 Every scene is unique: vary layout, choreography and composition from its neighbours."""

ARCHETYPE_SCHEMAS = """House archetypes and their data (used when a scene falls back to the deterministic library):
kinetic-title {kicker,title,subtitle,icon} | word-stack {words[]} | big-number {kicker,value,prefix,suffix,decimals,label,context}
bar-race {kicker,title,items[{label,value}],unit} | line-chart {kicker,title,series[],callout} | donut {kicker,title,parts[{label,value}],unit}
versus {kicker,title,left{label,value,points[]},right{label,value,points[]}} | timeline {kicker,title,events[{date,label}]}
quote {quote,author,role} | list-reveal {kicker,title,items[]} | process-flow {kicker,title,steps[{label,icon}]}
icon-grid {kicker,title,items[{icon,label}]} | doodle-explain {kicker,title,nodes[]} | equation {title,tex,note}
image-focus {kicker,title,caption,image,annotate} | scale-zoom {kicker,title,levels[]} | map-pins {kicker,title,pins[{label,x,y}]}
ui-mockup {kicker,title,subtitle,app{title,rows[],metric,metricLabel}} | lower-third {name,role,image} | end-card {title,subtitle,cta,icon}
phone-showcase {kicker,title,subtitle,screens[],features[]} | ui-cascade {kicker,title,image,url,callouts[],focus[x,y]} | code-typing {title,language,code,output}
shape-morph {words[]} | particles-type {title,subtitle} | photo-stack {title,photos[],captions[]} | music-visualizer {title,artist,cover}
paper-cut {kicker,title,subtitle} | vox-board {kicker,title,photo,notes[]} | three-hero {kicker,title,subtitle,mode:shapes|gallery,images[]}
logo-reveal {logo,name,tagline} | kinetic-beat {words[],bpm} | diagram-build {kicker,title,nodes[]} | mascot-talk {title,lines[]}
line-art {kicker,title,subtitle,night} | three-hero also has mode "orbit" (sun, planets on orbits, starfield)
Wrap the one key word of a title in *asterisks* to accent it. Icons are Lucide names (e.g. rocket, globe, brain, trending-up)."""

Emit = Callable[[str, dict[str, Any]], None]


def _tokens(emit: Emit, agent: str, scene: int | None = None):
    buffer: list[str] = []
    state = {"n": 0}

    def on_token(kind: str, text: str) -> None:
        buffer.append(text)
        state["n"] += len(text)
        if sum(len(b) for b in buffer) > 60 or "\n" in text:
            emit("agent.token", {"agent": agent, "scene": scene, "kind": kind, "text": "".join(buffer)})
            buffer.clear()

    def flush() -> None:
        if buffer:
            emit("agent.token", {"agent": agent, "scene": scene, "kind": "text", "text": "".join(buffer)})
            buffer.clear()
    return on_token, flush


def grid_text(project: dict[str, Any]) -> str:
    w, h = project["width"], project["height"]
    portrait = h > w
    sx, sy = (round(w * 0.08), round(h * 0.1)) if portrait else (round(w * 0.06), round(h * 0.08))
    sw, sh = w - 2 * sx, (round(h * 0.72) if portrait else h - 2 * sy)
    cols, rows = 12, 6
    cap = "the band below y=" + (str(round(h * 0.62)) if portrait else str(round(h * 0.86))) + "px is reserved for captions"
    return (f"Stage {w}x{h}px ({'portrait 9:16 short' if portrait else 'landscape' if w > h else 'square'}). Safe area x={sx}..{sx + sw}, y={sy}..{sy + sh}; {cap}. "
            f"Layout grid over the safe area: {cols} columns A..L of {sw / cols:.0f}px and {rows} rows 1..6 of {sh / rows:.0f}px. "
            f"Name placements by cell (e.g. hero in C2:J4) and convert to CSS with var(--safe-x)/var(--safe-y) offsets or flex/grid layout.")


def bible_text(bible: dict[str, Any]) -> str:
    pal = ", ".join(f"--{k}: {v}" for k, v in bible["palette"].items())
    return (f"Style: {bible['name']}. {bible['brief']}\nPalette tokens: {pal}\nFonts: display var(--font-display) = {bible['fonts']['display'].split(',')[0]}, "
            f"body var(--font-body) = {bible['fonts']['body'].split(',')[0]}, mono var(--font-mono).\nType scale tokens: --fs-hero --fs-xl --fs-lg --fs-md --fs-sm --fs-min. "
            f"Radius var(--radius), stroke var(--stroke). Ground '{bible['ground']}' and texture '{bible['texture']}' are drawn by the runtime.\n"
            f"Motion language '{bible['motion']['name']}': enter {bible['motion']['enter']}, accent {bible['motion']['accent']}, exit {bible['motion']['exit']}, "
            f"stagger {bible['motion']['stagger']}s, tempo x{bible['motion']['tempo']}." + (f"\nMotif: {bible['motif']}" if bible.get("motif") else "") + (f"\nArt notes: {bible['notes']}" if bible.get("notes") else ""))


CORE_SKILLS = ("composition-contract", "motion-rules-core", "swarm-protocol", "skill-scout", "storyboard-director", "explainer-grammar",
               "art-direction-bible", "qa-critic", "research-and-fact-grounding", "subtitle-sync", "anti-slop-checklist")


def technique_skills() -> list[Any]:
    return [s for s in library.all() if s.enabled and s.name not in CORE_SKILLS and s.stage in ("animate", "design", "any", "edit")]


def technique_catalog() -> str:
    return "\n".join(f"- {s.name}: {s.description[:220]}" for s in technique_skills())


def find_plan(value: Any) -> dict[str, Any] | None:
    def scene_list(v: Any) -> bool:
        return isinstance(v, list) and len(v) > 0 and all(isinstance(x, dict) for x in v) and any(k in v[0] for k in ("narration", "visual", "duration", "title", "archetype"))
    if scene_list(value):
        return {"scenes": value}
    if isinstance(value, dict):
        if scene_list(value.get("scenes")):
            return value
        for key in ("scenes", "plan", "film", "screenplay", "storyboard", "shots", "data", "result", "output", "response"):
            inner = value.get(key)
            if scene_list(inner):
                return dict(value, scenes=inner)
            if isinstance(inner, dict):
                found = find_plan(inner)
                if found:
                    return dict({k: v for k, v in value.items() if k != key}, **found)
        for inner in value.values():
            if scene_list(inner):
                return dict(value, scenes=inner)
    return None


def continuity_line(project: dict[str, Any]) -> str:
    from . import continuity
    return continuity.text_for_director(project)


async def direct(project: dict[str, Any], brain: Brain, emit: Emit) -> dict[str, Any]:
    model = llmmod.LLM("director")
    skills_text, used = library.inject(project.get("brief", "") + " storyboard explainer shorts", "director", budget=7000, must=["storyboard-director", "explainer-grammar"] + (["film-continuity"] if continuity_line(project) else []) + (["multilingual-type"] if language_line(project).find("(en)") < 0 else []))
    emit("agent.skills", {"agent": "director", "skills": used})
    bible = project["bible"]
    shorts = project["height"] > project["width"]
    cues = project.get("cues") or []
    from . import sync
    windows = sync.scene_windows(project, shorts)
    system = "You are the Director and Screenwriter of an agentic motion-graphics studio. You plan short films that are visually inventive, factual and tightly timed.\n\n" + RULESET + "\n\n" + skills_text
    if windows and any(w.get("cues") for w in windows):
        frame = "\n".join(f"{i}. start {w['start']:.2f}s dur {w['duration']:.2f}s narration: {w['text']}" + (f" | brief beat: {w['beat']}" if w.get("beat") else "") for i, w in enumerate(windows))
        task = (f"The film is driven by uploaded subtitles, which are the master clock. Keep EXACTLY these {len(windows)} scene windows in order with their narration and durations; "
                f"they were cut on subtitle boundaries{' and the timings written in the brief' if any(w.get('beat') for w in windows) else ''}. Invent the visuals; when a brief beat is given, the scene must deliver that beat:\n{frame}")
    elif windows:
        frame = "\n".join(f"{i}. start {w['start']:.2f}s dur {w['duration']:.2f}s beat: {w['beat']}" for i, w in enumerate(windows))
        task = (f"The brief specifies its own timing. Keep EXACTLY these {len(windows)} scene windows in order with their durations, write narration that fits each window "
                f"(about 2.4 words per second), and deliver each beat:\n{frame}")
    else:
        target = float(project.get("duration_target") or 30)
        per = "2.5 to 4" if shorts else "3.5 to 6.5"
        task = (f"Target duration {target:.0f}s. Write narration for each scene (it becomes the captions). Scenes last {per}s; total must equal the target within 5 percent. "
                f"Open with a hook in the first 2 seconds and end with a payoff scene.")
    user = f"""Brief: {project.get('brief', '')}
Title so far: {project.get('title', '')}
Format: {grid_text(project)}
Visual style: {bible['name']} — {bible['brief']}
Audience: {project['options'].get('audience') or 'general'}; tone: {project['options'].get('tone') or 'confident, curious'}.
{language_line(project)}
{continuity_line(project)}
Shared memory:
{brain.snapshot(['research', 'references', 'producer', 'documents'], 9000)}
If user images are listed under references, place them by id in data.image (image-focus, vox-board photo, lower-third), data.photos (photo-stack) or data.images (three-hero gallery) where they fit the story.

{task}

{ARCHETYPE_SCHEMAS}

Technique skills the animators can load (pick per scene by name; each one is a full playbook with working code patterns):
{technique_catalog()}
For every scene decide the technique: "code" means an animator writes a bespoke GSAP composition guided by the skills you pick (use this for most scenes, it is what makes the film unique);
"archetype" means reuse the house archetype as is (only when it is clearly the best fit, for example a precise data chart). Pick 1 to 3 skills that match the visual you describe.
Also suggest the instruments the animator should reach for: "components" (titles, lower thirds, callouts, charts, steps, chat, device, CTA),
"character" (2D people or mascots acting), "3d" (real low-poly models from a free library, rigged ones walk and run), "media" (edit uploaded footage),
"manim" (mathematical constructions rendered by Manim), "libraries" (d3, physics, particles, noise, morphs), "code" (bespoke GSAP),
"web" (real photos, archival images, logos, flags, icons and website screenshots with highlighted sentences collected from the internet; use it whenever the scene names a real person, place, product, document or event),
"map" (animated real maps: flights between places, routes, pins, highlighted countries, 3D city and terrain flyovers),
"sound" (real sound effects placed on on-screen events), "data" (real statistics from Wikidata, Our World in Data or the World Bank),
"dialogue" (characters, presenters or portraits that speak with lip sync), "lens" (a lens look or move: anamorphic, fisheye, tilt-shift, vintage, VHS, crash or dolly zoom). Mix them. Documentary, news, history and Vox-style films lean on web and map.

Return JSON only:
{{"title": str, "logline": str, "tone": str, "scenes": [{{"title": str, "purpose": "hook|context|evidence|turn|payoff|cta", "narration": str, "duration": number,
"onscreen": "the few words that appear on screen", "visual": "concrete visual concept: layout, hero element, motion, camera, how it hands off to the next scene",
"archetype": one of the house archetypes above (closest fallback), "data": {{fields for that archetype}}, "transition": "fade|smoothleft|slideup|wipeleft|circleopen|zoomin|fadeblack|cut",
"technique": "code|archetype", "skills": ["skill names from the technique list"],
"instruments": ["any of: components, character, 3d, media, manim, libraries, code, web, map, sound, data, dialogue, lens"]}}]}}"""
    on_token, flush = _tokens(emit, "director")
    plan = await model.json(system, user, on_token=on_token, max_tokens=8000, schema=schemas.DIRECTOR, tool="submit_plan")
    flush()
    plan = find_plan(plan)
    if not plan:
        raise llmmod.ProviderError("director returned no scenes (reply had no list of scenes)")
    if windows:
        scenes = plan["scenes"][: len(windows)]
        while len(scenes) < len(windows):
            scenes.append({"narration": windows[len(scenes)]["text"]})
        for s, w in zip(scenes, windows):
            s["start"], s["duration"], s["cue_ids"] = w["start"], w["duration"], w.get("cues", [])
            if w.get("cues"):
                s["narration"] = w["text"]
            elif not s.get("narration"):
                s["narration"] = w.get("beat", "")
    else:
        scenes = plan["scenes"]
        target = float(project.get("duration_target") or 30)
        total = sum(max(1.2, float(s.get("duration") or 4)) for s in scenes) or 1
        scale = target / total if abs(total - target) / target > 0.05 else 1.0
        t = 0.0
        for s in scenes:
            d = round(max(1.2, float(s.get("duration") or 4)) * scale * project["fps"]) / project["fps"]
            s["start"], s["duration"] = round(t, 4), d
            t += d
    plan["scenes"] = scenes
    return plan


def language_line(project: dict[str, Any]) -> str:
    from . import fonts as fontlib
    fi = fontlib.info(project)
    name = fontlib.LANG.get(fi["lang"], {}).get("name", "English")
    extra = []
    if fi["rtl"]:
        extra.append("it reads right to left")
    if fi["complex"]:
        extra.append("never split it into characters, no letter-spacing, line-height 1.3 or more, no uppercase")
    if fi["cjk"]:
        extra.append("it has no spaces between words")
    return f"Language: {name} ({fi['lang']}). Write all narration, on-screen text and data strings in {name}" + ("; " + "; ".join(extra) if extra else "") + "."


async def choose_style(project: dict[str, Any], emit: Emit) -> dict[str, Any]:
    from . import fonts as fontlib
    model = llmmod.LLM("art")
    packs = "\n".join(f"- {p['id']}: {p['name']} ({p['category']}) {p['tagline']}" for p in styles.PACKS)
    fonts = ", ".join(styles.FONTS.keys())
    scripts = fontlib.scripts_for(project)
    families = fontlib.describe_for_agents(scripts)
    user = f"""Brief: {project.get('brief', '')}
Format: {project['aspect']}. Pick the visual system that fits this brief best, then tune it so the film looks designed for this subject.
Style packs:
{packs}
Font keys: {fonts}. Grounds: paper, solid, spotlight, mesh, aurora, grid, blueprint, dots, stars, halftone, scanlines, clay. Textures: grain, paper, halftone, scanlines, vignette, none.
{language_line(project)}
Installed font families you may name exactly (for the film's language and Latin): {families}
Return JSON only: {{"pack": id, "reason": short, "palette": {{"bg": hex, "bg-2": hex, "ink": hex, "ink-2": hex, "muted": hex, "accent": hex, "accent-2": hex}},
"display_font": key, "body_font": key, "display_family": "optional exact family name from the installed list, best for the film's language",
"body_family": "optional exact family name", "ground": str, "texture": str, "caption": "pop|karaoke|boxed|minimal|typewriter", "motif": str, "notes": str}}
Keep ink and bg at contrast 7:1 or more and the accent readable on bg."""
    on_token, flush = _tokens(emit, "art")
    try:
        data = await model.json("You are an art director choosing a visual system for a motion film. Return JSON only.", user, on_token=on_token, max_tokens=1500, schema=schemas.STYLE, tool="submit_style")
    finally:
        flush()
    return data if isinstance(data, dict) else {}


async def caption_image(b64: str, name: str) -> str:
    model = llmmod.LLM("critic")
    if not model.available or not model.vision:
        return ""
    reply = await model.complete("You describe images for a video editor in one short sentence.", f"Describe this image ({name}) in under 18 words: subject, setting, mood.",
                                 images=[b64], max_tokens=600, temperature=0.2)
    return reply.strip().split("\n")[0][:200]


async def art_direct(project: dict[str, Any], brain: Brain, emit: Emit) -> dict[str, Any]:
    model = llmmod.LLM("art")
    bible = project["bible"]
    skills_text, used = library.inject("art direction palette type motif " + bible["name"], "art", budget=4500, must=["art-direction-bible"] + (["multilingual-type"] if language_line(project).find("(en)") < 0 else []))
    emit("agent.skills", {"agent": "art", "skills": used})
    system = "You are the Art Director. You extend a locked style bible with a signature motif and art notes so every scene feels like one film.\n\n" + skills_text
    user = f"""Brief: {project.get('brief', '')}
Current bible:
{bible_text(bible)}
Reference notes: {brain.read('references', 'none')}
Return JSON only: {{"motif": "one recurring visual device (shape, line, texture, framing) used across scenes", "notes": "3-5 short rules for this film's look",
"accent": optional hex colour if the brief or references demand a different accent, "caption": optional caption style pop|karaoke|boxed|minimal|typewriter}}"""
    on_token, flush = _tokens(emit, "art")
    patch = await model.json(system, user, on_token=on_token, max_tokens=1500, schema=schemas.ART, tool="submit_art_notes")
    flush()
    return patch if isinstance(patch, dict) else {}


async def design_cast3d(project: dict[str, Any], emit: Emit) -> dict[str, Any]:
    from . import cast3d
    model = llmmod.LLM("art")
    if not model.available:
        return cast3d.fallback(project)
    user = cast3d.PROMPT.format(brief=project.get("brief", "")[:3000], looks=list(cast3d.LOOKS), sets=list(cast3d.SETS), presets=list(cast3d.PRESETS),
                                hair=list(cast3d.HAIR), hats=list(cast3d.HATS), outfits=list(cast3d.OUTFITS), extras=list(cast3d.EXTRAS), props=list(cast3d.PROPS))
    on_token, flush = _tokens(emit, "art")
    try:
        raw = await model.json("You are the Art Director casting a 3D cartoon film.", user, on_token=on_token, max_tokens=1200)
    finally:
        flush()
    return cast3d.validate(raw, project)


def _neighbours(project: dict[str, Any], scene: dict[str, Any]) -> str:
    scenes = project["scenes"]
    i = scene["index"]
    prev = scenes[i - 1] if i > 0 else None
    nxt = scenes[i + 1] if i + 1 < len(scenes) else None
    parts = []
    if prev:
        parts.append(f"Previous scene ({prev.get('archetype')}): {prev.get('visual', '')[:200]}. Its last frame shows: {prev.get('onscreen', '')[:120]}.")
    if nxt:
        parts.append(f"Next scene: {nxt.get('visual', '')[:200]}. Transition out: {(scene.get('transition') or {}).get('type', 'fade')}.")
    return " ".join(parts) or "This is the only scene."


def animator_system(project: dict[str, Any], scene: dict[str, Any]) -> tuple[str, list[str]]:
    query = f"{scene.get('visual', '')} {scene.get('archetype', '')} {project['bible']['name']} {project['bible']['brief']}"
    must = ["composition-contract", "motion-rules-core"]
    chosen = [n for n in (scene.get("skills") or [])[:3] if library.get(n)]
    for name in chosen:
        if name not in must:
            must.append(name)
    if not chosen:
        blob = f"{scene.get('visual', '')} {scene.get('onscreen', '')} {scene.get('archetype', '')}".lower()
        for words, name in ((("3d", "three", "planet", "orbit", "glossy", "sphere"), "three-d-motion"), (("line art", "ink", "pen", "sketch", "hand-drawn", "doodle"), "line-art-ink"),
                            (("chart", "graph", "percent", "data"), "data-visualization-motion"), (("paper", "cutout", "collage"), "paper-cut-craft")):
            if any(w in blob for w in words) and name not in must:
                must.append(name)
    if "motion-recipes" not in must:
        must.append("motion-recipes")
    if "motion-craft-rules" not in must:
        must.insert(2, "motion-craft-rules")
    if llmmod.read_settings().get("animator_mode", "harness") == "harness":
        must.insert(2, "motion-toolkit")
    inst = set(scene.get("instruments") or [])
    story_words = ("story", "character", "zombie", "hero", "villain", "boy", "girl", "man", "woman", "kid", "friend", "family", "people", "crowd", "says", "whisper", "ran", "runs")
    blob3 = f"{project.get('brief', '')[:600]} {scene.get('visual', '')} {scene.get('narration', '')}".lower()
    if "character" in (scene.get("instruments") or []) or any(w in blob3 for w in story_words):
        for name in ("svg-character-design", "svg-architecture-and-props", "story-animation-direction"):
            if name not in must:
                must.append(name)
    for key, name in (("character", "character-animation"), ("3d", "3d-models"), ("media", "video-editing-tools"), ("manim", "code-video-frameworks"), ("libraries", "motion-libraries"),
                      ("web", "documentary-assets"), ("map", "maps-and-geography"), ("sound", "audio-assets"), ("data", "real-data-sources"), ("dialogue", "character-dialogue-lipsync"), ("lens", "lens-and-camera-optics")):
        if key in inst and name not in must:
            must.append(name)
    from . import continuity
    sheet = continuity.bible(project)
    if sheet:
        if sheet["medium"] == "3d":
            must = [m for m in must if m not in ("svg-character-design", "3d-models", "character-animation", "three-d-motion")]
            extra = ["procedural-3d-world"] + (["stop-motion-craft-looks"] if sheet.get("look") in ("felt", "clay", "paper") else [])
        elif sheet["medium"] == "stickman":
            must = [m for m in must if m not in ("svg-character-design", "3d-models")]
            extra = ["stickman-direction"]
        elif sheet["medium"] == "anime":
            must = [m for m in must if m not in ("svg-character-design", "3d-models", "three-d-motion")]
            extra = ["anime-direction"]
        else:
            must = [m for m in must if m != "3d-models"]
            extra = ["svg-character-design"]
        for name in ["film-continuity"] + extra:
            if name not in must and library.get(name):
                must.insert(2, name)
    blob2 = f"{scene.get('visual', '')} {scene.get('onscreen', '')} {scene.get('narration', '')}".lower()
    if any(w in blob2 for w in (" map", "route", "journey", "border", "country", "countries", "city", "flight", "travel", "located")) and "maps-and-geography" not in must and llmmod.read_settings().get("animator_mode", "harness") == "harness":
        must.append("maps-and-geography")
    if any(w in blob2 for w in ("photo", "archival", "screenshot", "headline", "article", "documentary", "logo", "flag", "newspaper", "real ")) and "documentary-assets" not in must and llmmod.read_settings().get("animator_mode", "harness") == "harness":
        must.append("documentary-assets")
    from . import fonts as fontlib
    fi = fontlib.info(project)
    if fi["lang"] != "en" or fi["scripts"]:
        must.append("multilingual-type")
    skills_text, used = library.inject(query, "animator", budget=26000, must=must)
    system = ("You are a senior motion designer who writes HTML/CSS/GSAP compositions for a frame-accurate video renderer. Your scenes look like work from a top studio: "
              "layered depth, typographic craft, choreographed staggers, purposeful camera, nothing generic, nothing slide-like.\n\n" + RULESET + "\n\n" + language_line(project) + "\n\n" + skills_text)
    return system, used


def cast3d_line(project: dict[str, Any]) -> str:
    from . import continuity
    return continuity.text_for_animator(project)


def recall_text(project: dict[str, Any], scene: dict[str, Any]) -> str:
    from . import recall
    return recall.text_for_animator(project, scene)


def direction_text(scene: dict[str, Any]) -> str:
    out = []
    if scene.get("direction"):
        out.append(f"Direction for this scene from the editor (highest priority): {scene['direction']}")
    if scene.get("reference_code"):
        out.append("Reference scene to match (same characters with identical parameters, same set, palette, type and motion language; write your own code for "
                   "the new beat, do not just copy it):\n```html\n" + str(scene["reference_code"])[:7000] + "\n```")
    if scene.get("relay_code"):
        if scene.get("relay_kind") == "cast":
            keep = ("Keep every recurring character with identical component parameters (preset, skin, hair, outfit, colours, model, scale), the same world, "
                    "set, palette, light, type and motion language, and the same screen direction (who stands left, who faces where). Pick up from the state "
                    "the previous scene ended in (positions, props in hand, mood) and move the story forward")
        else:
            keep = ("Keep the film's visual system exactly: the same palette and background treatment, the same type families, sizes and weights, the same "
                    "layout grid and margins, the same easing and motion language, and the recurring motifs (shapes, icons, textures, accent marks). Let the "
                    "first frame continue from the previous scene's last frame so the cut feels like one film, and give this scene its own new idea")
        out.append(f"RELAY: this is the next scene after scene {scene.get('relay_from', '?')}, which is finished and accepted. Its code is below. "
                   + keep + "; write the new beat yourself, never copy it:\n```html\n" + str(scene["relay_code"])[:6000] + "\n```")
    if scene.get("reference_asset"):
        out.append("A reference image or video from the user is attached as frames: match its composition, character designs, colours and motion style using "
                   "AuteurFrame components (toon, toon-set, toon-prop) or your own SVG.")
    return "\n".join(out)


def scout_text(scene: dict[str, Any]) -> str:
    from . import scout
    return scout.describe_for_animator(scene)


def animator_user(project: dict[str, Any], scene: dict[str, Any], extra: str = "", harness: bool = False) -> str:
    assets = [f"{a['id']} ({a['kind']}{', ' + a.get('name', '') if a.get('name') else ''}{': ' + (a.get('meta') or {}).get('caption', '') if (a.get('meta') or {}).get('caption') else ''})"
              for a in project.get("assets", []) if a.get("kind") in ("image", "video", "svg", "map", "model")]
    cue_words = scene.get("narration", "")
    start, dur = float(scene.get("start", 0)), float(scene["duration"])
    timed = []
    for cue in project.get("cues") or []:
        if cue["end"] <= start or cue["start"] >= start + dur:
            continue
        words = cue.get("words") or []
        if not words:
            toks = cue["text"].split()
            span = (cue["end"] - cue["start"]) / max(1, len(toks))
            words = [{"t": cue["start"] + i * span, "w": w} for i, w in enumerate(toks)]
        timed += [f"{max(0.0, w['t'] - start):.2f} {w['w']}" for w in words if start <= w["t"] < start + dur]
    timing = ("Word timings in scene seconds (land visual accents 0 to 2 frames before the word): " + " | ".join(timed[:70])) if timed else "No word timing; pace accents every 0.8 to 1.5 s."
    return f"""Write scene {scene['index'] + 1} of {len(project['scenes'])}.
Duration D = {dur:.2f}s. Captions (if any) are rendered by the runtime in the caption band; do not duplicate the narration as body text.
Narration heard during this scene: "{cue_words}"
{timing}
Before the code, write three short lines: CONCEPT (the visual metaphor), SIGNATURE MOVE (one memorable choreography from the motion-recipes idea bank or your own), HAND-OFF (how the last frame leads into the next scene). Then build exactly that, with at least two layers of depth and a background that moves.
On-screen words: "{scene.get('onscreen', '')}"
Visual concept: {scene.get('visual', '')}
Director's suggested instruments: {', '.join(scene.get('instruments') or []) or 'your choice'}
Purpose: {scene.get('purpose', '')}
Continuity: {_neighbours(project, scene)}
{grid_text(project)}
{bible_text(project['bible'])}
Project assets you may use with AU.asset(id) as img/video src: {', '.join(assets) or 'none'}.
Facts you may cite (never invent numbers): {'; '.join(f.get('claim', '')[:120] + (' [source: ' + f['url'] + ']' if harness and f.get('url') else '') for f in (project.get('memory', {}).get('facts') or [])[:8]) or 'none'}
{scout_text(scene) if harness else ""}
{direction_text(scene)}
{cast3d_line(project)}
{recall_text(project, scene)}
{extra}
{"Build this scene as scene.html in your workspace with the tools: plan, read the skills you need, write it (in parts if long), preview, fix, then finish." if harness else "Output ONE html fragment in a ```html code block: markup inside <div class=" + chr(34) + "scene" + chr(34) + ">...</div>, one <style>, one <script> calling AU.scene."}
The ctx passed to AU.scene has: tl, $, $$, W, H, D, fps, seed, rand, clamp, lerp, data, assets, safe, portrait, split, counter, draw, rough, camera, chart, math, icon, ambient, particles, onFrame, three, typewrite, scramble, fit, asset, cssColor.
For real 3D use three(selector, (g) => {{ ...build meshes with g.material('var(--accent)')...; return (t) => {{ position from t }}; }}) as described in the three-d-motion skill.
All motion goes on tl at absolute times (never negative). Every animated element has data-layer. Use CSS variables for every colour and font.
Render cost matters: glows are radial-gradient(closest-side, colour, transparent), never big filter blurs or backdrop-filter; blur only small elements briefly (24px max)."""


async def animate(project: dict[str, Any], scene: dict[str, Any], emit: Emit, feedback: str = "", previous_code: str = "", instruction: str = "",
                  steps: int | None = None, topups: int | None = None) -> str:
    if llmmod.read_settings().get("animator_mode", "harness") == "harness":
        from . import harness
        try:
            return await harness.run(project, scene, emit, feedback=feedback, previous_code=previous_code, instruction=instruction, steps=steps, topups=topups)
        except asyncio.CancelledError:
            raise
        except Exception as error:
            emit("run.warning", {"message": f"scene {scene['index'] + 1}: workshop agent failed ({str(error)[:160]}); trying a single-shot write"})
    model = llmmod.LLM("animator")
    model.on_retry = lambda msg: emit("run.warning", {"message": f"scene {scene['index'] + 1}: {msg}"})
    system, used = animator_system(project, scene)
    emit("agent.skills", {"agent": "animator", "scene": scene["index"], "skills": used})
    extra = ""
    if instruction:
        extra += f"\nUser direction for this scene (highest priority): {instruction}\n"
    if previous_code:
        extra += f"\nCurrent scene code:\n```html\n{previous_code[:12000]}\n```\n"
    if feedback:
        extra += f"\nQA found these problems. Fix every one while keeping what works; return the complete corrected fragment:\n{feedback}\n"
    on_token, flush = _tokens(emit, "animator", scene["index"])
    rejected = ""
    last = []
    for attempt in range(3):
        user = animator_user(project, scene, extra + rejected)
        raw = await model.complete(system, user, on_token=on_token, max_tokens=16000, temperature=0.85 if attempt == 0 else 0.6)
        flush()
        code = llmmod.extract_code(raw)
        problems = qa.validate_fragment(code)
        if not problems:
            return code
        last = problems
        why = f"{len(raw)} chars, finish={getattr(model, 'last_finish', '') or 'n/a'}, reasoning={getattr(model, 'last_reasoning_chars', 0)} chars"
        emit("run.warning", {"message": f"scene {scene['index'] + 1}: reply rejected by the validator ({problems[0]}) [{why}]; regenerating"})
        rejected = ("\n\nYOUR PREVIOUS REPLY WAS REJECTED by the code validator:\n- " + "\n- ".join(problems) +
                    "\nStart over from scratch. Write the three short plan lines, then ONE complete ```html block that starts with <div class=\"scene\">, "
                    "has one <style> and one <script> with AU.scene(({ tl, ... }) => { ... }), and puts real tweens on tl. "
                    "Keep the whole fragment under 9000 characters so it is never cut off. No notes inside the code.")
    raise llmmod.ProviderError("animator could not produce valid scene code: " + "; ".join(last)[:300])


async def critique(project: dict[str, Any], scene: dict[str, Any], result: dict[str, Any], sheet_b64: str, emit: Emit) -> dict[str, Any]:
    model = llmmod.LLM("critic")
    if not model.available:
        return {}
    skills_text, used = library.inject("critique contact sheet probe report repair", "critic", budget=5000, must=["qa-critic"])
    system = "You are the Motion QA critic. You did not build this scene. Judge only what the frames and the probe report show. Be specific and terse.\n\n" + RULESET + "\n\n" + skills_text
    issues = qa.repair_brief(result) or "none"
    user = f"""Scene {scene['index'] + 1}: intended visual: {scene.get('visual', '')}; on-screen words: {scene.get('onscreen', '')}; style {project['bible']['name']}.
Automated probe issues:\n{issues}
{continuity_line(project) + ' If a character in the frames does not match this model sheet (different medium, face, hair, clothes or colours), report a P0 continuity note.' if continuity_line(project) else ''}
{'The attached contact sheet shows frames across the scene. Work in this order: (1) describe each frame in one short sentence as a stranger who never read the brief would, naming only what is visible; (2) in one sentence, say what a stranger thinks the scene is about; (3) compare that with the intended visual. If the stranger would miss the point, that is a P1 note.' if sheet_b64 else 'No frames attached.'}
Notes are instructions for the animator, not opinions. Each note names the time, the layer and the visible problem, then the change with numbers
("title at 1.2s overlaps the robot's face -> move it to y 12% and size 64px", never "improve the layout"). Report at most 6 notes, most visible first.
Do not report taste preferences that the frames do not show as a problem. A scene that reads clearly and matches the bible passes even if you would have made it differently.
Return JSON only: {{"frames": [str], "stranger": str, "reads_clearly": 1-5, "on_bible": 1-5, "verdict": "pass" or "repair",
"notes": [{{"severity": "P0|P1|P2", "layer": "data-layer or element", "time": seconds, "problem": str, "fix": str}}]}}"""
    on_token, flush = _tokens(emit, "critic", scene["index"])
    images = [sheet_b64] if sheet_b64 and model.vision and llmmod.read_settings().get("vision_critic", True) else []
    try:
        model.force_thinking = "off"
        verdict = await model.json(system, user, images=images, on_token=on_token, max_tokens=3000, temperature=0.2, schema=schemas.CRITIC, tool="submit_verdict")
    finally:
        flush()
    return verdict if isinstance(verdict, dict) else {}


async def scout(project: dict[str, Any], brain: Brain, emit: Emit) -> list[dict[str, Any]]:
    model = llmmod.LLM("research")
    brief = project.get("brief", "")
    if model.available:
        on_token, flush = _tokens(emit, "research")
        try:
            q = await model.json("You plan web research for a factual explainer film. Return JSON only.",
                                 f"Brief: {brief}\nReturn {{\"queries\": [3 precise search queries that would find numbers, dates and quotes]}}", on_token=on_token, max_tokens=500, schema=schemas.QUERIES, tool="submit_queries")
        finally:
            flush()
        queries = [s for s in (q.get("queries") if isinstance(q, dict) else []) or [] if isinstance(s, str)][:3]
    else:
        queries = []
    if not queries:
        topic = " ".join(house.keywords(brief, 5)) or project.get("title", "")
        queries = [topic, topic + " statistics", topic + " history timeline"][:2]
    pages = []
    for query in queries:
        emit("agent.status", {"agent": "research", "state": "searching", "detail": query})
        found = await research.search(query, limit=5, on_event=lambda k, d: emit(k, d))
        emit("research.results", {"query": query, "results": found["results"][:6], "engines": found["engines"]})
        for item in found["results"][:2]:
            url = item["url"]
            if any(p["url"] == url for p in pages):
                continue
            emit("agent.status", {"agent": "research", "state": "browsing", "detail": url})
            emit("agent.cursor", {"agent": "research", "target": "browser", "url": url})
            try:
                page = await research.browse(url, frames=2, on_frame=lambda jpeg, u=url: emit("browse.frame", {"url": u, "jpeg": jpeg}))
            except Exception as error:
                emit("agent.status", {"agent": "research", "state": "skipped", "detail": f"{url}: {str(error)[:80]}"})
                continue
            pages.append({"url": url, "title": page.get("title") or item.get("title", ""), "text": research.excerpt(page.get("text", ""), query + " " + brief, 1800)})
            if len(pages) >= 5:
                break
    facts: list[dict[str, Any]] = []
    if pages and model.available:
        corpus = "\n\n".join(f"SOURCE {i + 1}: {p['title']} <{p['url']}>\n{p['text']}" for i, p in enumerate(pages))
        on_token, flush = _tokens(emit, "research")
        try:
            data = await model.json("You extract verifiable facts for a film. Only use the sources given. Never invent numbers. Return JSON only.",
                                    f"Brief: {brief}\n\n{corpus[:14000]}\n\nReturn {{\"facts\": [{{\"claim\": short factual sentence with the number or date, \"source\": source title, \"url\": url}}]}} with 4 to 10 facts.",
                                    on_token=on_token, max_tokens=1800, schema=schemas.FACTS, tool="submit_facts")
        finally:
            flush()
        facts = [f for f in (data.get("facts") if isinstance(data, dict) else []) or [] if isinstance(f, dict) and f.get("claim")]
    elif pages:
        for p in pages[:4]:
            sentence = next((s for s in re.split(r"(?<=[.!?])\s+", p["text"]) if re.search(r"\d", s) and 40 < len(s) < 220), "")
            if sentence:
                facts.append({"claim": sentence, "source": p["title"], "url": p["url"]})
    for f in facts[:10]:
        brain.add_fact(f["claim"], f.get("source", ""), f.get("url", ""))
    brain.write("research", {"queries": queries, "sources": [{"title": p["title"], "url": p["url"]} for p in pages], "facts": facts[:10]}, "research", "web research")
    return facts


async def import_skill_for(project: dict[str, Any], need: str, emit: Emit) -> list[str]:
    from . import skills as skillmod
    found = await research.search(f"{need} SKILL.md motion graphics github", limit=6, engines=["github", "duckduckgo", "bing"])
    imported = []
    for item in found["results"][:4]:
        if "github.com" not in item["url"]:
            continue
        try:
            text, src = await skillmod.fetch_skill(item["url"])
        except Exception:
            continue
        if len(text) < 400:
            continue
        name = re.sub(r"[^a-z0-9]+", "-", item["url"].rstrip("/").split("/")[-1].lower())[:40]
        skill = library.save_user_skill(name, text, src)
        imported.append(skill.name)
        emit("skill.imported", {"name": skill.name, "source": src})
        if len(imported) >= 2:
            break
    return imported
