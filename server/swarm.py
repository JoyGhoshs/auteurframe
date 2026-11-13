from __future__ import annotations

import asyncio
import random
import re
import time
import traceback
from pathlib import Path
from typing import Any

from . import agents, compose, config, house, llm as llmmod, qa, render, styles
from .bus import bus
from .memory import Brain
from .skills import library
from .store import project_dir, store

RUNS: dict[str, "Run"] = {}

ROSTER = [
    {"id": "producer", "name": "Producer", "role": "Reads the brief and uploads, sets the production plan", "icon": "clipboard-list"},
    {"id": "research", "name": "Research Scout", "role": "Searches the open web, browses sources, grounds facts", "icon": "globe"},
    {"id": "director", "name": "Director", "role": "Writes the screenplay and fits it to the master clock", "icon": "clapperboard"},
    {"id": "narrator", "name": "Narrator", "role": "Voices the narration with free neural TTS and locks word timing", "icon": "mic"},
    {"id": "sound", "name": "Sound Designer", "role": "Places synthesised and library sound effects and ambience on every scene", "icon": "audio-lines"},
    {"id": "scout", "name": "Asset Scout", "role": "Collects real photos, footage, icons, sound and music from free libraries", "icon": "binoculars"},
    {"id": "art", "name": "Art Director", "role": "Locks the style bible, palette, type and motif", "icon": "palette"},
    {"id": "animator-1", "name": "Animator A", "role": "Writes scene compositions", "icon": "pen-tool"},
    {"id": "animator-2", "name": "Animator B", "role": "Writes scene compositions", "icon": "pen-tool"},
    {"id": "animator-3", "name": "Animator C", "role": "Writes scene compositions", "icon": "pen-tool"},
    {"id": "animator-4", "name": "Animator D", "role": "Writes scene compositions", "icon": "pen-tool"},
    {"id": "critic", "name": "Motion QA", "role": "Probes layout, motion energy and readability, orders repairs", "icon": "scan-eye"},
    {"id": "render-1", "name": "Render Node 1", "role": "Captures frames in headless Chrome", "icon": "cpu"},
    {"id": "render-2", "name": "Render Node 2", "role": "Captures frames in headless Chrome", "icon": "cpu"},
    {"id": "render-3", "name": "Render Node 3", "role": "Captures frames in headless Chrome", "icon": "cpu"},
    {"id": "editor", "name": "Editor", "role": "Conforms transitions, mixes sound, masters the film", "icon": "film"},
    {"id": "sync", "name": "Sync Agent", "role": "Locks scenes and captions to the subtitle clock and verifies every cue frame by frame", "icon": "timer"},
    {"id": "cutter", "name": "Cut Agent", "role": "Finds silences and makes jump cuts", "icon": "scissors", "group": "edit"},
    {"id": "captions", "name": "Caption Agent", "role": "Word-synced captions and kinetic stamps", "icon": "captions", "group": "edit"},
    {"id": "zoom", "name": "Zoom Agent", "role": "Punch-ins and pushes on emphasis", "icon": "zoom-in", "group": "edit"},
    {"id": "gfx", "name": "GFX Agent", "role": "Titles, stats, follow buttons, arrows", "icon": "sparkles", "group": "edit"},
    {"id": "broll", "name": "B-roll Agent", "role": "Finds and inserts illustrative footage", "icon": "images", "group": "edit"},
    {"id": "sfx", "name": "Sound Agent", "role": "Lands whooshes and pops on visual hits", "icon": "audio-lines", "group": "edit"},
    {"id": "grade", "name": "Grade Agent", "role": "One consistent colour grade", "icon": "palette", "group": "edit"},
]


class Pool:
    def __init__(self, prefix: str, size: int) -> None:
        self.free = [f"{prefix}-{i + 1}" for i in range(size)]
        self.cond = asyncio.Condition()

    async def take(self) -> str:
        async with self.cond:
            while not self.free:
                await self.cond.wait()
            return self.free.pop(0)

    async def give(self, name: str) -> None:
        async with self.cond:
            self.free.append(name)
            self.free.sort()
            self.cond.notify()


class Run:
    def __init__(self, pid: str, mode: str, options: dict[str, Any]) -> None:
        self.id = f"run_{int(time.time())}_{random.randrange(1000):03d}"
        self.pid = pid
        self.mode = mode
        self.options = options
        self.started = time.time()
        self.status = "running"
        self.phase = "starting"
        self.cancelled = False
        self.task: asyncio.Task | None = None
        project = store.get(pid)
        self.brain = Brain(pid, project.get("memory"))
        self.agent_state: dict[str, dict[str, Any]] = {a["id"]: {"state": "idle", "detail": ""} for a in ROSTER}
        self.stats = {"scenes": 0, "written": 0, "repairs": 0, "fallbacks": 0, "rendered": 0, "llm_calls": 0}

    def emit(self, kind: str, data: dict[str, Any] | None = None) -> None:
        payload = dict(data or {})
        payload.setdefault("run", self.id)
        bus.publish(self.pid, kind, payload)

    def agent(self, agent_id: str, state: str, detail: str = "", scene: int | None = None) -> None:
        self.agent_state[agent_id] = {"state": state, "detail": detail, "scene": scene, "t": time.time()}
        self.emit("agent.status", {"agent": agent_id, "state": state, "detail": detail, "scene": scene})

    def cursor(self, agent_id: str, scene: int | None, x: float | None = None, y: float | None = None, label: str = "") -> None:
        rnd = random.random
        self.emit("agent.cursor", {"agent": agent_id, "scene": scene, "x": x if x is not None else 0.2 + rnd() * 0.6, "y": y if y is not None else 0.2 + rnd() * 0.55, "label": label})

    def set_phase(self, phase: str) -> None:
        self.phase = phase
        self.emit("run.phase", {"phase": phase})

    def check(self) -> None:
        if self.cancelled:
            raise asyncio.CancelledError()

    def persist_memory(self) -> None:
        dump = self.brain.dump()
        store.mutate(self.pid, lambda p: p.__setitem__("memory", dump))

    def summary(self) -> dict[str, Any]:
        return {"id": self.id, "mode": self.mode, "status": self.status, "phase": self.phase, "started": self.started, "agents": self.agent_state,
                "stats": self.stats, "elapsed": round(time.time() - self.started, 1)}


def patch_scene(run: Run, scene_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    scene = store.update_scene(run.pid, scene_id, patch)
    light = {k: v for k, v in patch.items() if k != "code"}
    if "code" in patch:
        light["has_code"] = bool(patch["code"])
    run.emit("scene.update", {"id": scene_id, "index": scene["index"], "patch": light})
    return scene


def reference_palette(project: dict[str, Any]) -> list[str]:
    from PIL import Image
    colours: list[tuple[float, str]] = []
    for asset in project.get("assets", []):
        if asset.get("kind") != "image" or asset.get("role") not in ("reference", "style", None):
            continue
        path = project_dir(project["id"]) / "assets" / asset["file"]
        try:
            img = Image.open(path).convert("RGB")
            img.thumbnail((160, 160))
            pal = img.quantize(colors=6, method=Image.Quantize.MEDIANCUT).convert("RGB").getcolors(160 * 160) or []
        except Exception:
            continue
        for count, (r, g, b) in pal:
            mx, mn = max(r, g, b), min(r, g, b)
            sat = (mx - mn) / (mx or 1)
            if sat > 0.35 and 60 < mx:
                colours.append((sat * count, f"#{r:02X}{g:02X}{b:02X}"))
    colours.sort(reverse=True)
    out = []
    for _, c in colours:
        if c not in out:
            out.append(c)
    return out[:3]


async def stage_understand(run: Run) -> None:
    run.set_phase("understand")
    project = store.get(run.pid)
    run.agent("producer", "working", "reading brief and uploads")
    run.cursor("producer", None, 0.5, 0.3, "brief")
    shorts = project["height"] > project["width"]
    kw = house.keywords(project.get("brief", "") or project.get("title", ""), 6)
    refs = reference_palette(project)
    producer = {"topic": " ".join(kw[:3]), "keywords": kw, "format": "short" if shorts else "landscape", "cues": len(project.get("cues", [])),
                "assets": len(project.get("assets", [])), "research": bool(project["options"].get("research")), "llm": llmmod.LLM("director").label}
    run.brain.write("producer", producer, "producer", "production plan")
    if refs:
        run.brain.write("references", {"palette": refs, "images": [a["name"] for a in project["assets"] if a.get("kind") == "image"]}, "producer", "reference palette")
        run.brain.decide("producer", f"Accent taken from reference image {refs[0]}", "user references beat pack defaults")
    if project.get("cues"):
        run.brain.decide("producer", f"Master clock locked to {len(project['cues'])} subtitle cues", "subtitle-first timing")
    folder = project_dir(run.pid)
    docs_text = []
    for a in project.get("assets", []):
        path = folder / "assets" / a["file"]
        if a.get("kind") in ("document", "data") or path.suffix.lower() in (".txt", ".md", ".csv", ".pdf"):
            try:
                if path.suffix.lower() == ".pdf":
                    import shutil, subprocess
                    if shutil.which("pdftotext"):
                        text = subprocess.run(["pdftotext", "-layout", str(path), "-"], capture_output=True, text=True, timeout=60).stdout
                    else:
                        text = ""
                else:
                    text = path.read_text(encoding="utf-8", errors="ignore")
                if text.strip():
                    docs_text.append(f"[{a['name']}]\n{text.strip()[:6000]}")
            except Exception:
                continue
    if docs_text:
        run.brain.write("documents", "\n\n".join(docs_text)[:14000], "producer", f"{len(docs_text)} documents read")
        run.brain.decide("producer", f"Read {len(docs_text)} attached documents", "user files ground the screenplay")
    images = [a for a in project.get("assets", []) if a.get("kind") == "image" and a.get("role") in ("reference", "style", "stock", None)][:8]
    if images:
        captions = []
        vision = llmmod.LLM("critic")
        for a in images:
            cap = (a.get("meta") or {}).get("caption", "")
            if not cap and vision.available and vision.vision and run.mode != "house":
                try:
                    import base64, io
                    from PIL import Image
                    img = Image.open(folder / "assets" / a["file"]).convert("RGB")
                    img.thumbnail((640, 640))
                    buf = io.BytesIO()
                    img.save(buf, "JPEG", quality=80)
                    cap = await agents.caption_image(base64.b64encode(buf.getvalue()).decode(), a["name"])
                    if cap:
                        store.mutate(run.pid, lambda p, aid=a["id"], c=cap: [x.setdefault("meta", {}).__setitem__("caption", c) for x in p["assets"] if x["id"] == aid])
                except Exception:
                    cap = ""
            captions.append({"id": a["id"], "name": a["name"], "caption": cap or a["name"]})
        refs_info = {"palette": refs, "images": captions}
        run.brain.write("references", refs_info, "producer", f"{len(captions)} user images described")
    run.agent("producer", "done", f"{producer['format']} film, {producer['cues']} cues, {producer['assets']} assets")

    async def do_research() -> None:
        if not project["options"].get("research"):
            run.agent("research", "idle", "research disabled for this film")
            return
        run.agent("research", "working", "planning queries")
        try:
            facts = await agents.scout(project, run.brain, run.emit)
            run.agent("research", "done", f"{len(facts)} facts grounded")
        except Exception as error:
            run.agent("research", "error", str(error)[:160])

    async def do_art() -> None:
        run.agent("art", "working", "locking the style bible")
        run.cursor("art", None, 0.8, 0.2, "palette")
        overrides = dict(project.get("bible_overrides") or {})
        if project["options"].get("auto_style") and llmmod.LLM("art").available and run.mode != "house":
            try:
                pick = await agents.choose_style(project, run.emit)
                if pick.get("pack") in [p["id"] for p in styles.PACKS]:
                    project["style"] = pick["pack"]
                    store.mutate(run.pid, lambda p, s=pick["pack"]: p.__setitem__("style", s))
                pal = {k: v for k, v in (pick.get("palette") or {}).items() if isinstance(v, str) and re.fullmatch(r"#[0-9A-Fa-f]{6}", v)}
                if pal:
                    overrides["palette"] = pal
                fonts = {}
                if pick.get("display_font") in styles.FONTS:
                    overrides["font_keys"] = {"display": pick["display_font"], "body": pick.get("body_font") if pick.get("body_font") in styles.FONTS else "inter"}
                    fonts["display"] = styles.FONTS[pick["display_font"]]
                    fonts["caption"] = styles.FONTS[pick["display_font"]]
                if pick.get("body_font") in styles.FONTS:
                    fonts["body"] = styles.FONTS[pick["body_font"]]
                if fonts:
                    overrides["fonts"] = fonts
                from . import fonts as fontlib
                picks = {k: pick[f"{k}_family"] for k in ("display", "body") if isinstance(pick.get(f"{k}_family"), str) and pick[f"{k}_family"] in fontlib.families()}
                if picks:
                    overrides["font_family"] = dict(overrides.get("font_family") or {}, **picks)
                    run.brain.decide("art", f"Typefaces: {', '.join(picks.values())}", "chosen for the film's language")
                for key in ("ground", "texture", "caption", "motif", "notes"):
                    if isinstance(pick.get(key), str) and pick[key]:
                        overrides[key] = pick[key]
                run.brain.decide("art", f"Auto style: {pick.get('pack')}", str(pick.get("reason", ""))[:160])
            except Exception as error:
                run.brain.decide("art", "Auto style fell back to keyword match", str(error)[:120])
        bible = styles.build_bible(project["style"], project["seed"], project["width"], project["height"], overrides=overrides, reference_palette=refs)
        model = llmmod.LLM("art")
        if model.available and run.mode != "house":
            try:
                patch = await agents.art_direct(dict(project, bible=bible), run.brain, run.emit)
                if patch.get("motif"):
                    bible["motif"] = str(patch["motif"])[:300]
                if patch.get("notes"):
                    bible["notes"] = str(patch["notes"])[:600]
                if isinstance(patch.get("accent"), str) and re.fullmatch(r"#[0-9A-Fa-f]{6}", patch["accent"]) and not refs:
                    bible["palette"]["accent"] = patch["accent"]
                if patch.get("caption") in ("pop", "karaoke", "boxed", "minimal", "typewriter"):
                    bible["caption"] = patch["caption"]
            except Exception as error:
                run.brain.decide("art", "kept pack defaults", f"art model failed: {str(error)[:100]}")
        previous = [p for p in store.list() if p["id"] != run.pid][:1]
        fp = styles.fingerprint(bible, [])
        if previous:
            prev_palette = previous[0].get("palette", {})
            if prev_palette.get("accent") == bible["palette"]["accent"] and previous[0].get("style") == bible["style"]:
                bible["palette"]["accent"] = styles.shift_hue(bible["palette"]["accent"], 28)
                run.brain.decide("art", "Shifted accent hue 28 degrees", "R12 uniqueness against the previous film")
        def apply(p: dict[str, Any]) -> None:
            p["bible"] = bible
            p["fingerprint"] = fp
        store.mutate(run.pid, apply)
        run.brain.write("bible", {"style": bible["name"], "palette": bible["palette"], "fonts": bible["font_keys"], "motif": bible.get("motif", ""), "ground": bible["ground"]}, "art", "bible locked")
        run.emit("project.bible", {"bible": bible})
        run.agent("art", "done", f"{bible['name']} · accent {bible['palette']['accent']}")

    await asyncio.gather(do_research(), do_art())


async def stage_write(run: Run) -> None:
    run.set_phase("write")
    project = store.get(run.pid)
    run.agent("director", "working", "writing the screenplay")
    run.cursor("director", None, 0.3, 0.7, "timeline")
    model = llmmod.LLM("director")
    plan_scenes = None
    title = project.get("title")
    if model.available and run.mode != "house":
        try:
            plan = await agents.direct(project, run.brain, run.emit)
            plan_scenes = plan["scenes"]
            if plan.get("title") and (not title or title == "Untitled film"):
                title = str(plan["title"])[:90]
            run.brain.write("logline", plan.get("logline", ""), "director", "logline")
            run.stats["llm_calls"] += 1
        except Exception as error:
            run.brain.decide("director", "Fell back to the house director", str(error)[:200])
            run.emit("run.warning", {"message": f"Director model failed, house director used: {str(error)[:200]}"})
    house_scenes = house.plan(project)
    if plan_scenes:
        scenes = []
        transitions = project["bible"].get("transitions", ["fade"])
        for i, s in enumerate(plan_scenes):
            arch = s.get("archetype") if s.get("archetype") in ("kinetic-title", "word-stack", "big-number", "bar-race", "line-chart", "donut", "versus", "timeline", "quote", "list-reveal",
                                                                  "process-flow", "icon-grid", "doodle-explain", "equation", "image-focus", "scale-zoom", "map-pins", "ui-mockup", "lower-third", "end-card", "phone-showcase", "ui-cascade", "code-typing", "shape-morph", "particles-type", "photo-stack", "music-visualizer", "paper-cut", "vox-board", "three-hero", "logo-reveal", "kinetic-beat", "diagram-build", "mascot-talk", "line-art") else None
            fallback = house_scenes[min(i, len(house_scenes) - 1)] if house_scenes else {}
            trans = s.get("transition") if s.get("transition") in render.XFADE or s.get("transition") == "cut" else transitions[i % len(transitions)]
            scenes.append({
                "id": f"sc_{i:03d}_{random.randrange(16 ** 4):04x}", "index": i, "title": str(s.get("title") or fallback.get("title", ""))[:90],
                "purpose": s.get("purpose", ""), "start": float(s["start"]), "duration": float(s["duration"]), "narration": s.get("narration", ""),
                "onscreen": s.get("onscreen", ""), "visual": s.get("visual", ""), "archetype": arch or fallback.get("archetype", "kinetic-title"),
                "data": s.get("data") if isinstance(s.get("data"), dict) and arch else fallback.get("data", {}), "variant": random.randrange(12),
                "code": None, "source": "agent", "status": "planned", "layers": [], "overrides": {}, "cue_ids": s.get("cue_ids", []),
                "technique": s.get("technique") if s.get("technique") in ("code", "archetype") else "code",
                "skills": [n for n in (s.get("skills") or []) if isinstance(n, str) and library.get(n)][:3],
                "instruments": [x for x in (s.get("instruments") or []) if x in ("components", "character", "3d", "media", "manim", "libraries", "code", "web", "map", "sound", "data", "dialogue", "lens")][:8],
                "transition": {"type": "cut" if i == len(plan_scenes) - 1 else trans, "duration": 0.35 if project["height"] > project["width"] else 0.5},
            })
    else:
        scenes = house_scenes
    previous = {s["id"]: s for s in project.get("scenes", []) if s.get("locked")}
    if previous:
        for i, s in enumerate(scenes):
            match = next((p for p in previous.values() if p["index"] == i), None)
            if match:
                scenes[i] = dict(match, start=s["start"], duration=s["duration"])
    if not project.get("cues"):
        from . import subtitles
        cues = subtitles.synth_cues(scenes)
    else:
        cues = project["cues"]

    def apply(p: dict[str, Any]) -> None:
        p["scenes"] = scenes
        p["title"] = title or p.get("title")
        p["cues"] = cues
        p["cues_synthetic"] = not bool(project.get("cues")) or all(c.get("synthetic") for c in project.get("cues", []))
        p["status"] = "planned"
    store.mutate(run.pid, apply, revision=True, reason="screenplay")
    run.stats["scenes"] = len(scenes)
    run.brain.write("outline", [{"i": s["index"], "title": s["title"], "archetype": s["archetype"], "dur": s["duration"]} for s in scenes], "director", "outline locked")
    run.emit("project.scenes", {"count": len(scenes), "title": title})
    run.agent("director", "done", f"{len(scenes)} scenes · {sum(s['duration'] for s in scenes):.1f}s")
    run.emit("barrier", {"name": "OutlineBarrier", "detail": "outline and bible locked; animators released"})


async def stage_sound(run: Run) -> None:
    project = store.get(run.pid)
    opts = project.get("options") or {}
    audio_cfg = project.get("audio") or {}
    if run.mode == "house" or opts.get("sound_design") is False or audio_cfg.get("sfx_locked"):
        return
    if run.mode == "render" and audio_cfg.get("sound_designed"):
        return
    from . import sounddesign
    run.set_phase("sound")
    run.agent("sound", "working", "spotting the film for sound")
    on_token, flush = agents._tokens(run.emit, "sound")
    try:
        res = await sounddesign.run(run.pid, run.emit, on_token)
        flush()
        run.agent("sound", "done", f"{res['clips']} sound cues" + (f", {res['searched']} from libraries" if res["searched"] else ""))
        run.brain.decide("sound", f"Sound designed with {res['clips']} cues", "effects follow the story beats instead of a fixed whoosh on every cut")
    except Exception as error:
        flush()
        run.agent("sound", "error", str(error)[:160])
        run.emit("run.warning", {"message": f"sound design failed, default effects used: {str(error)[:140]}"})


async def stage_voice(run: Run) -> None:
    project = store.get(run.pid)
    opts = project.get("options") or {}
    from . import voice
    if opts.get("narration") != "ai" or (project.get("audio") or {}).get("voice") or not project.get("cues_synthetic", True):
        return
    if not voice.enabled():
        run.emit("run.warning", {"message": "AI narration was requested but text to speech is turned off in Settings; continuing without a voice"})
        return
    run.set_phase("voice")
    run.agent("narrator", "working", "voicing the narration")
    try:
        res = await voice.narrate(run.pid, opts.get("voice", ""), opts.get("voice_rate", "+0%"), on_step=lambda m: run.agent("narrator", "working", m))
        run.agent("narrator", "done", f"{res['voice']} · {res['duration']:.1f}s · {res['cues']} cues")
        run.brain.decide("narrator", f"Narration voiced with {res['voice']}", "scene lengths now follow the spoken words; subtitles use exact word timing")
        run.emit("asset.added", {"asset": res["asset"]})
        run.emit("project.scenes", {"count": len(store.get(run.pid)["scenes"]), "title": project.get("title")})
    except Exception as error:
        run.agent("narrator", "error", str(error)[:160])
        run.emit("run.warning", {"message": f"AI narration failed, continuing without voice: {str(error)[:160]}"})


async def stage_scout(run: Run) -> None:
    project = store.get(run.pid)
    opts = project.get("options") or {}
    from . import scout
    wants = opts.get("scout") is not False and (opts.get("scout") or any(set(s.get("instruments") or []) & {"web", "media"} for s in project["scenes"]))
    if run.mode == "house" or not wants:
        choice = (project.get("audio") or {}).get("music", "auto")
        if run.mode != "house" and opts.get("library_music") and (choice in (None, "auto") or str(choice).startswith("mood:")):
            run.agent("scout", "working", "choosing a library music track")
            try:
                mood = " ".join(str(opts.get("tone") or "cinematic ambient").replace(",", " ").split()[:4])
                rec = await scout.music(run.pid, mood, sum(float(s["duration"]) for s in project["scenes"]))
                run.agent("scout", "done", f"music: {rec['title'][:50]}" if rec else "no library track found; generated score kept")
            except Exception as error:
                run.agent("scout", "error", str(error)[:160])
        return
    run.set_phase("scout")
    run.agent("scout", "working", "planning the asset hunt")
    on_token, flush = agents._tokens(run.emit, "scout")
    try:
        res = await scout.run(run.pid, run.emit, on_token)
        flush()
        summary = f"{res['items']} assets for {res['scenes']} scenes" + (f" · music: {res['music']['title'][:40]}" if res.get("music") else "")
        run.agent("scout", "done", summary)
        run.brain.write("scout", {"items": res["items"], "music": res.get("music")}, "scout", summary)
    except Exception as error:
        flush()
        run.agent("scout", "error", str(error)[:160])
        run.emit("run.warning", {"message": f"asset scout failed: {str(error)[:160]}"})


IMAGE_SLOTS = {"image-focus": "image", "vox-board": "photo", "lower-third": "image", "photo-stack": "photos", "three-hero": "images", "phone-showcase": "screens"}


async def stage_stock(run: Run) -> None:
    from . import stock
    project = store.get(run.pid)
    if project["options"].get("stock") is False:
        return
    needy = []
    for s in project["scenes"]:
        key = IMAGE_SLOTS.get(s.get("archetype"))
        if not key or s.get("archetype") == "phone-showcase" or s.get("source") == "template":
            continue
        if s.get("archetype") == "three-hero" and (s.get("data") or {}).get("mode") != "gallery":
            continue
        if (s.get("data") or {}).get(key):
            continue
        needy.append((s, key))
    if not needy:
        return
    run.set_phase("stock")
    run.agent("producer", "working", f"finding imagery for {len(needy)} scenes")
    topic = " ".join(house.keywords(project.get("brief", "") or project.get("title", ""), 2))
    used: set[str] = set()
    for s, key in needy[:6]:
        words = house.keywords((s.get("narration") or s.get("title") or ""), 3)
        query = " ".join(words[:2] + ([topic] if topic and topic.lower() not in " ".join(words).lower() else []))[:80] or topic
        run.cursor("producer", s["index"], label=f"stock: {query}")
        try:
            found = await stock.cached_search(query, "image", "auto", 1)
            pick = next((r for r in found["results"] if r["url"] not in used and (r.get("width") or 1200) >= 800), None)
            if not pick:
                continue
            used.add(pick["url"])
            path, ctype = await stock.download(pick["url"], project_dir(run.pid) / "assets", "image")
            asset = {"id": path.stem, "name": pick.get("title", "")[:80], "file": path.name, "kind": "image", "mime": ctype, "size": path.stat().st_size, "role": "stock",
                     "url": f"/media/{run.pid}/assets/{path.name}", "meta": {"attribution": stock.attribution(pick), "source": pick.get("source"), "page": pick.get("page")}, "added": time.time()}
            value = [asset["id"]] if key in ("photos", "images") else asset["id"]

            def apply(p: dict[str, Any], sid=s["id"], a=asset, k=key, v=value) -> None:
                p["assets"].append(a)
                for sc in p["scenes"]:
                    if sc["id"] == sid:
                        sc.setdefault("data", {})[k] = v
            store.mutate(run.pid, apply)
            run.emit("asset.added", {"asset": asset})
            run.emit("stock.import", {"scene": s["index"], "query": query, "title": pick.get("title"), "source": pick.get("source"), "thumb": pick.get("thumb")})
            run.brain.decide("producer", f"Scene {s['index'] + 1} uses stock image from {pick.get('source')}", stock.attribution(pick)[:120])
        except Exception as error:
            run.emit("run.warning", {"message": f"stock search failed for scene {s['index'] + 1}: {str(error)[:120]}"})
    run.agent("producer", "done", "imagery placed")


async def write_scene(run: Run, scene_id: str, animators: Pool, instruction: str = "") -> None:
    project = store.get(run.pid)
    scene = next(s for s in project["scenes"] if s["id"] == scene_id)
    idx = scene["index"]
    model = llmmod.LLM("animator")
    agent_mode = model.available and run.mode != "house" and project["options"].get("mode", "auto") != "house" and not scene.get("locked") \
        and (scene.get("technique") != "archetype" or instruction)
    if scene.get("locked") and scene.get("code"):
        return
    if not agent_mode:
        who = await animators.take()
        try:
            run.agent(who, "working", f"house composition: {scene['archetype']}", idx)
            run.cursor(who, idx, label=scene["archetype"])
            patch_scene(run, scene_id, {"status": "written", "source": "house", "code": None})
            await quick_qa(run, scene_id, who)
            run.agent(who, "idle", "", None)
        finally:
            await animators.give(who)
        return
    who = await animators.take()
    critic_rounds = 0
    try:
        run.agent(who, "working", f"writing scene {idx + 1}", idx)
        run.cursor(who, idx, label="writing")
        patch_scene(run, scene_id, {"status": "writing"})
        code = await agents.animate(project, scene, run.emit, instruction=instruction, previous_code=(scene.get("code") or "") if instruction else "")
        run.stats["llm_calls"] += 1
        best = None
        began = time.time()
        seen: dict[str, int] = {}
        for round_no in range(config.MAX_REPAIR_ROUNDS + 1):
            run.check()
            patch_scene(run, scene_id, {"code": code, "source": "agent", "status": "qa"})
            project = store.get(run.pid)
            scene = next(s for s in project["scenes"] if s["id"] == scene_id)
            run.agent("critic", "working", f"probing scene {idx + 1} round {round_no + 1}", idx)
            run.cursor("critic", idx, label="probe")
            lint = qa.lint(code)
            try:
                probe = await render.probe_scene(project, scene)
                result = qa.evaluate(probe, float(scene["duration"]), lint)
            except Exception as error:
                result = {"score": 0, "pass": False, "issues": [{"kind": "probe", "severity": "P0", "message": str(error)[:200], "fix": "Make the scene load without errors."}], "energy": []}
                probe = {}
            notes = []
            if probe.get("shots") and critic_rounds < config.MAX_REPAIR_ROUNDS + 2:
                sheet = qa.contact_sheet(probe["shots"][:: max(1, len(probe["shots"]) // 6)][:6])
                try:
                    verdict = await agents.critique(project, scene, result, sheet, run.emit)
                    critic_rounds += 1
                    run.stats["llm_calls"] += 1
                    notes = verdict.get("notes", []) if isinstance(verdict, dict) else []
                    result["critic"] = {k: verdict.get(k) for k in ("reads_clearly", "on_bible", "verdict", "frames")} if isinstance(verdict, dict) else {}
                    for n in notes:
                        if isinstance(n, dict) and n.get("severity") in ("P0", "P1"):
                            result["issues"].append({"kind": "critic", "severity": n["severity"], "message": f"{n.get('problem', '')} ({n.get('layer', '')} at {n.get('time', '?')}s)", "fix": n.get("fix", "")})
                    rc, ob = verdict.get("reads_clearly") or 5, verdict.get("on_bible") or 5
                    if isinstance(rc, (int, float)) and isinstance(ob, (int, float)) and (rc < 4 or ob < 4):
                        result["pass"] = False
                except Exception as error:
                    run.emit("run.warning", {"message": f"critic unavailable: {str(error)[:120]}"})
            result["round"] = round_no + 1
            patch_scene(run, scene_id, {"qa": {k: v for k, v in result.items() if k != "energy"}})
            run.emit("qa.report", {"scene": idx, "score": result["score"], "pass": result["pass"], "issues": result["issues"][:8], "round": round_no + 1})
            improved = best is None or quality_key(result) > quality_key(best[1])
            if improved:
                best = (code, result)
            repeats = repeated_notes(result, seen)
            if result["pass"]:
                best = (code, result)
                break
            if round_no >= config.MAX_REPAIR_ROUNDS:
                break
            reason = stop_reason(best[1], improved, repeats, result, time.time() - began, round_no)
            if reason:
                run.brain.decide("critic", f"Scene {idx + 1}: repairs stopped after round {round_no + 1}", reason)
                run.emit("run.warning", {"message": f"scene {idx + 1}: {reason}; keeping the best version (score {best[1]['score']})"})
                break
            run.stats["repairs"] += 1
            base, base_result = best
            run.agent(who, "working", f"repairing scene {idx + 1} ({len(base_result['issues'])} notes)", idx)
            run.cursor(who, idx, label="repair")
            fresh = any(i.get("severity") == "P0" for i in base_result["issues"])
            brief = qa.repair_brief(base_result) + repeat_brief(repeats)
            code = await agents.animate(project, scene, run.emit, feedback=brief, previous_code="" if fresh else base, instruction=instruction,
                                        steps=None if fresh else config.REPAIR_STEPS, topups=1 if fresh else 0)
            run.stats["llm_calls"] += 1
        code, result = best
        if needs_rescue(result):
            run.stats["rescues"] = run.stats.get("rescues", 0) + 1
            run.agent(who, "working", f"rebuilding scene {idx + 1} from scratch ({len(result['issues'])} notes left)", idx)
            run.brain.decide(who, f"Scene {idx + 1} rebuilt from scratch", "repairs did not reach the quality bar")
            try:
                project = store.get(run.pid)
                scene = next(s for s in project["scenes"] if s["id"] == scene_id)
                code2 = await agents.animate(project, scene, run.emit, feedback=qa.repair_brief(result) + RESCUE_BRIEF, previous_code="", instruction=instruction, topups=1)
                run.stats["llm_calls"] += 1
                patch_scene(run, scene_id, {"code": code2, "source": "agent", "status": "qa"})
                project = store.get(run.pid)
                scene = next(s for s in project["scenes"] if s["id"] == scene_id)
                probe2 = await render.probe_scene(project, scene)
                result2 = qa.evaluate(probe2, float(scene["duration"]), qa.lint(code2))
                if probe2.get("shots"):
                    sheet2 = qa.contact_sheet(probe2["shots"][:: max(1, len(probe2["shots"]) // 6)][:6])
                    try:
                        verdict2 = await agents.critique(project, scene, result2, sheet2, run.emit)
                        for n in (verdict2.get("notes", []) if isinstance(verdict2, dict) else []):
                            if isinstance(n, dict) and n.get("severity") in ("P0", "P1"):
                                result2["issues"].append({"kind": "critic", "severity": n["severity"], "message": str(n.get("problem", ""))[:200], "fix": n.get("fix", "")})
                    except Exception:
                        pass
                result2["round"] = "rescue"
                if quality_key(result2) > quality_key(result):
                    best = (code2, result2)
                    patch_scene(run, scene_id, {"qa": {k: v for k, v in result2.items() if k != "energy"}})
                    run.emit("qa.report", {"scene": idx, "score": result2["score"], "pass": result2["pass"], "issues": result2["issues"][:8], "round": "rescue"})
            except asyncio.CancelledError:
                raise
            except Exception as error:
                run.emit("run.warning", {"message": f"scene {idx + 1}: rescue rebuild failed ({str(error)[:120]}); keeping the best earlier version"})
            code, result = best
        blocking = [i for i in result["issues"] if i["severity"] == "P0"]
        if blocking:
            run.stats["fallbacks"] += 1
            run.brain.decide("critic", f"Scene {idx + 1} fell back to house archetype {scene['archetype']}", blocking[0]["message"][:140])
            patch_scene(run, scene_id, {"code": None, "source": "house", "status": "written", "agent_code": code})
            await quick_qa(run, scene_id, "critic")
        else:
            patch_scene(run, scene_id, {"code": code, "source": "agent", "status": "written"})
        run.stats["written"] += 1
    except asyncio.CancelledError:
        raise
    except Exception as error:
        run.stats["fallbacks"] += 1
        run.brain.decide(who, f"Scene {idx + 1} uses the house archetype", f"animator failed: {str(error)[:140]}")
        run.emit("run.warning", {"message": f"scene {idx + 1}: {str(error)[:200]}"})
        patch_scene(run, scene_id, {"code": None, "source": "house", "status": "written"})
    finally:
        run.agent(who, "idle", "", None)
        run.agent("critic", "idle", "")
        await animators.give(who)


RESCUE_BRIEF = """
The earlier attempts did not reach the quality bar, so start over with a simpler and stronger plan: one clear focal idea; a painted
environment from toon-set or your own layered SVG; characters from toon (or your own SVG rig) and objects from toon-prop that act on the
narration; a moving camera; a few precise GSAP moves instead of many weak ones. Keep the code compact so you finish well within the step
budget: write, preview, fix the top problems, finish."""


def note_key(issue: dict[str, Any]) -> str:
    text = re.sub(r"[^a-z ]+", " ", str(issue.get("message", "")).lower())
    return issue.get("kind", "") + ":" + " ".join(text.split()[:8])


def repeated_notes(result: dict[str, Any], seen: dict[str, int]) -> list[dict[str, Any]]:
    out = []
    for issue in result.get("issues") or []:
        if issue.get("severity") not in ("P0", "P1"):
            continue
        key = note_key(issue)
        if seen.get(key):
            out.append(issue)
        seen[key] = seen.get(key, 0) + 1
    return out


def repeat_brief(repeats: list[dict[str, Any]]) -> str:
    if not repeats:
        return ""
    lines = "\n".join(f"- {i['message'][:160]}" for i in repeats[:6])
    return ("\nThese notes were raised in an earlier round and are still open. The previous fix did not work, so change the approach for them "
            "(restructure that layer, change its size, colour or timing decisively) instead of nudging values, and do not undo fixes that already landed:\n" + lines)


def stop_reason(best: dict[str, Any], improved: bool, repeats: list[dict[str, Any]], result: dict[str, Any], elapsed: float, round_no: int) -> str:
    blocking = any(i.get("severity") == "P0" for i in best.get("issues") or [])
    if not blocking and float(best.get("score") or 0) >= config.ACCEPT_SCORE:
        return f"good enough at score {best.get('score')} with no blocking issues"
    if elapsed > config.SCENE_SECONDS:
        return f"scene time budget of {config.SCENE_SECONDS}s used"
    if round_no >= 1 and not improved:
        return "the last repair did not improve the scene"
    serious = [i for i in result.get("issues") or [] if i.get("severity") in ("P0", "P1")]
    if round_no >= 1 and serious and len(repeats) >= max(2, int(len(serious) * 0.6)):
        return "the same notes keep coming back"
    return ""


def needs_rescue(result: dict[str, Any]) -> bool:
    if result.get("pass"):
        return False
    blocking = any(i.get("severity") == "P0" for i in result.get("issues") or [])
    return blocking or float(result.get("score") or 0) < 60


def quality_key(result: dict[str, Any]) -> tuple[int, int, float]:
    issues = result.get("issues") or []
    return (-sum(1 for i in issues if i.get("severity") == "P0"), -sum(1 for i in issues if i.get("severity") == "P1"), float(result.get("score") or 0))


async def quick_qa(run: Run, scene_id: str, who: str) -> None:
    project = store.get(run.pid)
    scene = next(s for s in project["scenes"] if s["id"] == scene_id)
    try:
        probe = await render.probe_scene(project, scene, with_energy=False)
        result = qa.evaluate(probe, float(scene["duration"]), [])
        result["round"] = 1
        patch_scene(run, scene_id, {"qa": {k: v for k, v in result.items() if k != "energy"}})
        run.emit("qa.report", {"scene": scene["index"], "score": result["score"], "pass": result["pass"], "issues": result["issues"][:6], "round": 1})
    except Exception as error:
        run.emit("run.warning", {"message": f"probe failed on scene {scene['index'] + 1}: {str(error)[:160]}"})


async def thumb(run: Run, scene_id: str) -> None:
    project = store.get(run.pid)
    scene = next(s for s in project["scenes"] if s["id"] == scene_id)
    try:
        path = await render.snapshot(project, scene)
        url = f"/media/{run.pid}/renders/thumbs/{path.name}?v={int(time.time())}"
        patch_scene(run, scene_id, {"thumb": url})
    except Exception as error:
        run.emit("run.warning", {"message": f"thumbnail failed: {str(error)[:120]}"})


async def render_one(run: Run, scene_id: str, renderers: Pool, draft: bool = False) -> Path:
    who = await renderers.take()
    try:
        project = store.get(run.pid)
        scene = next(s for s in project["scenes"] if s["id"] == scene_id)
        idx = scene["index"]
        run.agent(who, "working", f"rendering scene {idx + 1}", idx)
        patch_scene(run, scene_id, {"status": "rendering", "progress": 0})
        last = {"t": 0.0}

        def progress(msg: dict[str, Any]) -> None:
            if msg["type"] == "progress":
                pct = round(msg["frame"] / max(1, msg["total"]) * 100)
                if time.time() - last["t"] > 0.4 or pct >= 100:
                    last["t"] = time.time()
                    run.emit("render.progress", {"scene": idx, "id": scene_id, "pct": pct, "fps": msg.get("fps"), "agent": who})
            elif msg["type"] == "preview":
                run.emit("render.preview", {"scene": idx, "id": scene_id, "t": msg.get("t"), "jpeg": msg.get("jpeg")})
        result = await render.render_scene(project, scene, progress, draft=draft)
        patch = {"status": "rendered", "progress": 100, "render": {k: v for k, v in result.items() if k != "logs"}}
        seg = project_dir(run.pid) / "renders" / result["file"]
        thumb_path = project_dir(run.pid) / "renders" / "thumbs" / f"{scene_id}.jpg"
        if seg.exists():
            thumb_path.parent.mkdir(parents=True, exist_ok=True)
            mid = max(0.0, float(scene["duration"]) * 0.6)
            proc = await asyncio.create_subprocess_exec(config.FFMPEG, "-v", "error", "-y", "-ss", f"{mid:.2f}", "-i", str(seg), "-frames:v", "1", "-vf", "scale=480:-2", str(thumb_path))
            await proc.wait()
            if thumb_path.exists():
                patch["thumb"] = f"/media/{run.pid}/renders/thumbs/{thumb_path.name}?v={int(time.time())}"
        patch_scene(run, scene_id, patch)
        run.stats["rendered"] += 1
        return project_dir(run.pid) / "renders" / result["file"]
    finally:
        run.agent(who, "idle", "")
        await renderers.give(who)


async def stage_scenes(run: Run, do_render: bool, only: list[str] | None = None, instruction: str = "") -> list[Path]:
    run.set_phase("animate" if not do_render else "produce")
    project = store.get(run.pid)
    animators = Pool("animator", min(4, config.SCENE_CONCURRENCY))
    renderers = Pool("render", min(3, config.RENDER_CONCURRENCY))
    draft = project["options"].get("quality") == "draft"
    await render.ensure_renderer()
    ids = only or [s["id"] for s in project["scenes"]]
    results: dict[str, Path] = {}

    async def pipeline(scene_id: str) -> None:
        run.check()
        if run.mode not in ("render", "scene-render", "edit"):
            await write_scene(run, scene_id, animators, instruction)
            await thumb(run, scene_id)
        if do_render:
            results[scene_id] = await render_one(run, scene_id, renderers, draft)

    await asyncio.gather(*(pipeline(i) for i in ids))
    project = store.get(run.pid)
    return [results[s["id"]] for s in project["scenes"] if s["id"] in results]


async def stage_assemble(run: Run, segments: list[Path]) -> None:
    run.set_phase("master")
    run.agent("editor", "working", "conforming transitions")
    run.cursor("editor", None, 0.5, 0.9, "timeline")
    project = store.get(run.pid)
    captions = None
    try:
        run.agent("editor", "working", "rendering the caption track")
        captions = await render.render_captions(project, lambda m: run.agent("editor", "working", f"caption track {m.get('frame', 0)}/{m.get('total', 0)}"))
    except Exception as error:
        run.emit("run.warning", {"message": f"Caption overlay failed, captions skipped: {str(error)[:200]}"})
    if captions:
        from . import sync
        run.agent("sync", "working", "checking the rendered caption track frame by frame")
        loop = asyncio.get_running_loop()
        check = await loop.run_in_executor(None, lambda: sync.verify_overlay(project, captions))
        run.emit("sync.overlay", check)
        run.agent("sync", "done", f"caption track verified on {check['frames']} boundary frames" if check["ok"] else f"{len(check['bad'])} boundary frames wrong in the caption track")
        if not check["ok"]:
            run.emit("run.warning", {"message": f"Caption track: {len(check['bad'])} boundary frames off"})
        store.mutate(run.pid, lambda p: p.setdefault("sync", {}).__setitem__("overlay", check))
    loop = asyncio.get_running_loop()
    outputs = await loop.run_in_executor(None, lambda: render.assemble(project, segments, lambda s: run.agent("editor", "working", s), captions))
    drift = abs(outputs["duration"] - outputs["expected"])
    outputs["drift"] = round(drift, 3)
    from .store import content_key
    outputs["key"] = content_key(project)
    outputs["sync"] = (project.get("sync") or {}).get("ok")

    def apply(p: dict[str, Any]) -> None:
        p["outputs"] = outputs
        p["status"] = "mastered"
    store.mutate(run.pid, apply, revision=True, reason="master")
    run.emit("project.outputs", outputs)
    run.agent("editor", "done", f"master {outputs['duration']:.2f}s · drift {drift * 1000:.0f}ms")


def _summary(report: dict[str, Any]) -> str:
    if report.get("skipped"):
        return report["skipped"]
    if report.get("ok"):
        return f"{report['checked']}/{report['checked']} cues frame-exact, max drift {report.get('max_drift_ms', 0)}ms"
    return f"{report.get('failed', 0)} of {report['checked']} cues off by more than one frame (max {report.get('max_drift_ms', 0)}ms)"


async def stage_sync(run: Run, verify: bool = True) -> dict[str, Any] | None:
    from . import sync
    project = store.get(run.pid)
    if not project.get("scenes"):
        return None
    run.agent("sync", "working", "locking subtitles to the master clock")
    run.cursor("sync", None, 0.2, 0.85, "timeline")
    result = sync.align(project)

    def apply(p: dict[str, Any]) -> None:
        if p.get("cues"):
            p["cues"] = result["cues"]
        if result["extend_last"] and p.get("scenes"):
            p["scenes"][-1]["duration"] = round(float(p["scenes"][-1]["duration"]) + result["extend_last"], 4)
            p["scenes"][-1]["status"] = "edited"
        t = 0.0
        for i, s in enumerate(p.get("scenes") or []):
            s["index"], s["start"] = i, round(t, 4)
            t += float(s["duration"])
    store.mutate(run.pid, apply, revision=False)
    for fix in result["fixes"]:
        run.brain.decide("sync", fix, "subtitle timing tool")
    for warning in result["warnings"][:6]:
        run.emit("sync.warning", {"message": warning})
    run.emit("sync.align", {"fixes": result["fixes"], "warnings": result["warnings"]})
    if not verify:
        run.agent("sync", "done", f"{len(result['fixes'])} timing fixes, {len(result['warnings'])} notes")
        return None
    run.agent("sync", "working", "verifying every caption frame by frame")
    try:
        report = await sync.verify(store.get(run.pid))
    except Exception as error:
        run.agent("sync", "idle", f"verification failed: {str(error)[:120]}")
        return None
    report["fixes"] = result["fixes"]
    report["warnings"] = result["warnings"]

    def save(p: dict[str, Any]) -> None:
        p["sync"] = report
    store.mutate(run.pid, save, revision=False)
    run.emit("sync.report", {k: v for k, v in report.items() if k != "cues"} | {"bad": [c for c in report.get("cues", []) if not c["ok"]][:12]})
    run.brain.decide("sync", _summary(report), "verified against the rendered scene documents")
    if not report.get("ok") and not report.get("skipped"):
        run.emit("run.warning", {"message": "Subtitle sync: " + _summary(report)})
    run.agent("sync", "done", _summary(report))
    return report


async def stage_edit(run: Run) -> None:
    from . import edit as editmod, media, stock
    run.set_phase("analyse")
    project = store.get(run.pid)
    folder = project_dir(run.pid)
    info = project.get("edit") or {}
    source = next((a for a in project["assets"] if a["id"] == info.get("source")), None) or next((a for a in project["assets"] if a["kind"] == "video" and a.get("role") in ("footage", "source", "slot:video")), None) \
        or next((a for a in project["assets"] if a["kind"] == "video"), None)
    if not source:
        raise RuntimeError("upload a video to edit first")
    path = folder / "assets" / source["file"]
    loop = asyncio.get_running_loop()
    run.agent("cutter", "working", "listening for silences")
    run.cursor("cutter", None, 0.5, 0.92, "waveform")
    meta = await loop.run_in_executor(None, lambda: media.probe(path))
    quiet = await loop.run_in_executor(None, lambda: media.silences(path)) if meta.get("has_audio") else []
    source_cues = info.get("source_cues")
    if source_cues is None:
        source_cues = [c for c in (project.get("cues") or []) if not c.get("synthetic")]
    analysis = {"duration": meta["duration"] or 10.0, "silences": quiet, "source_cues": source_cues}
    run.agent("cutter", "done", f"{len(quiet)} pauses found in {meta['duration']:.1f}s")
    run.set_phase("plan")
    prompt = project.get("brief", "")
    portrait = project["height"] > project["width"]
    user_imgs = [a["id"] for a in project["assets"] if a["kind"] in ("image", "svg") and a["id"] != source["id"]]
    model = llmmod.LLM("director")
    edl = None
    run.agent("director", "working", "planning the edit")
    if model.available and run.mode != "house" and project["options"].get("mode", "auto") != "house":
        try:
            on_token, flush = agents._tokens(run.emit, "director")
            raw = await model.json(editmod.EDIT_SYSTEM, editmod.plan_prompt(prompt, analysis["duration"], source_cues, portrait, user_imgs) + chr(10) + agents.language_line(project) + " Stamps, titles and graphics text must be in that language.", on_token=on_token, max_tokens=6000)
            flush()
            edl = editmod.sanitize(raw if isinstance(raw, dict) else {}, analysis["duration"])
            run.stats["llm_calls"] += 1
            run.brain.decide("director", "Edit planned by the model", f"{len(edl['zooms'])} zooms, {len(edl['stamps'])} stamps, {len(edl['broll'])} b-roll")
        except Exception as error:
            run.brain.decide("director", "House editor planned the cut", str(error)[:160])
    if edl is None:
        edl = editmod.sanitize(editmod.plan_house(prompt, analysis["duration"], source_cues, media.keep_ranges(analysis["duration"], quiet), int(project.get("seed", 1)), portrait), analysis["duration"])
    if project["options"].get("cut_silence") is not None:
        edl["cut_silence"] = bool(project["options"]["cut_silence"])
    run.agent("director", "done", f"grade {edl['grade']} · {len(edl['zooms'])} zooms · {len(edl['stamps'])} stamps")
    if edl["broll"]:
        run.agent("broll", "working", f"sourcing {len(edl['broll'])} inserts")
        pool = list(user_imgs)
        for i, b in enumerate(edl["broll"]):
            if b.get("asset") in user_imgs:
                continue
            if pool and (project["options"].get("stock") is False or i % 2 == 0):
                b["asset"] = pool.pop(0)
                continue
            if project["options"].get("stock") is False or not b.get("query"):
                continue
            try:
                found = await stock.cached_search(b["query"], "image", "auto", 1)
                pick = next((r for r in found["results"] if (r.get("width") or 1000) >= 700), None)
                if pick:
                    p, ctype = await stock.download(pick["url"], folder / "assets", "image")
                    asset = {"id": p.stem, "name": pick.get("title", "")[:80], "file": p.name, "kind": "image", "mime": ctype, "size": p.stat().st_size, "role": "stock",
                             "url": f"/media/{run.pid}/assets/{p.name}", "meta": {"attribution": stock.attribution(pick)}, "added": time.time()}
                    store.mutate(run.pid, lambda pr, a=asset: pr["assets"].append(a))
                    b["asset"] = asset["id"]
                    run.emit("stock.import", {"query": b["query"], "title": pick.get("title"), "source": pick.get("source"), "thumb": pick.get("thumb")})
            except Exception as error:
                run.emit("run.warning", {"message": f"b-roll search failed: {str(error)[:100]}"})
        edl["broll"] = [b for b in edl["broll"] if b.get("asset")]
        run.agent("broll", "done", f"{len(edl['broll'])} inserts placed")
    run.set_phase("edit")
    ops = editmod.ops_log(edl)
    for agent_id in ("captions", "zoom", "gfx", "sfx", "grade"):
        run.agent(agent_id, "working", "editing")
    run.emit("edit.op", {"agent": "grade", "id": "grade-01", "t": 0, "track": "grade", "label": f"grade {editmod.GRADES.get(edl['grade'], edl['grade'])}"})
    pace = min(0.12, 4.0 / max(1, len(ops)))
    dur = max(0.5, analysis["duration"])
    for op in ops:
        run.check()
        run.emit("edit.op", op)
        run.emit("agent.cursor", {"agent": op["agent"], "scene": None, "target": "timeline", "t": op["t"], "x": min(0.95, op["t"] / dur), "y": 0.5, "label": op["label"]})
        await asyncio.sleep(pace)
    compiled = editmod.compile_edit(project, edl, source, analysis)
    for agent_id in ("captions", "zoom", "gfx", "sfx", "grade"):
        run.agent(agent_id, "done", "")

    def apply(p: dict[str, Any]) -> None:
        p["scenes"] = compiled["scenes"]
        p["cues"] = compiled["cues"]
        p["cues_synthetic"] = False
        p["captions"]["enabled"] = edl["captions"] != "none" and bool(compiled["cues"])
        if edl["captions"] != "none":
            p["captions"]["style"] = p["captions"].get("style") or edl["captions"]
        p["audio"]["voice"] = None
        p["audio"]["sfx"] = False
        p["audio"]["clips"] = compiled["sfx"]
        if p["audio"].get("music") in (None, "auto") or str(p["audio"].get("music", "")).startswith("mood:"):
            p["audio"]["music"] = f"mood:{edl['music']}" if edl.get("music") else None
            p["audio"]["music_gain"] = -27.0
        p["edit"] = {"source": source["id"], "ranges": compiled["ranges"], "source_cues": source_cues, "duration": compiled["duration"], "edl": edl,
                     "source_duration": analysis["duration"], "ops": ops[:400]}
        p["duration_target"] = compiled["duration"]
        p["status"] = "planned"
    store.mutate(run.pid, apply, revision=True, reason="edit plan")
    run.stats["scenes"] = len(compiled["scenes"])
    run.emit("project.scenes", {"count": len(compiled["scenes"]), "edit": True})
    run.brain.write("edit", {"grade": edl["grade"], "ranges": len(compiled["ranges"]), "duration": compiled["duration"]}, "editor", "edit compiled")


async def execute(run: Run, scene_id: str | None = None, instruction: str = "", scene_ids: list[str] | None = None) -> None:
    llmmod.NOTIFY.set(lambda msg: run.emit("run.warning", {"message": msg}))
    try:
        run.emit("run.start", {"mode": run.mode, "llm": llmmod.LLM("director").label, "roster": ROSTER})
        if run.mode in ("full", "plan", "house"):
            await stage_understand(run)
            run.check()
            await stage_write(run)
            run.check()
            await stage_voice(run)
            run.check()
            await stage_scout(run)
            run.check()
            await stage_stock(run)
            run.check()
            await stage_sync(run, verify=False)
            run.check()
            run.persist_memory()
        if run.mode == "edit":
            await stage_edit(run)
            run.check()
            segments = await stage_scenes(run, do_render=True)
            run.check()
            await stage_sync(run)
            run.check()
            await stage_assemble(run, segments)
        elif run.mode == "scene-render" and scene_id:
            await stage_scenes(run, do_render=True, only=[scene_id])
        elif run.mode == "scenes" and scene_ids:
            await stage_scenes(run, do_render=False, only=scene_ids, instruction=instruction)
        elif run.mode == "scene" and scene_id:
            await stage_scenes(run, do_render=False, only=[scene_id], instruction=instruction)
        elif run.mode == "plan":
            await stage_scenes(run, do_render=False)
            run.check()
            await stage_sync(run)
        else:
            if run.mode == "render":
                await stage_sync(run, verify=False)
                run.check()
            segments = await stage_scenes(run, do_render=True)
            run.check()
            await stage_sync(run)
            run.check()
            await stage_sound(run)
            run.check()
            await stage_assemble(run, segments)
        run.status = "done"
        run.persist_memory()
        run.emit("run.done", {"stats": run.stats, "elapsed": round(time.time() - run.started, 1)})
    except asyncio.CancelledError:
        run.status = "cancelled"
        run.emit("run.cancelled", {})
    except Exception as error:
        run.status = "error"
        run.emit("run.error", {"message": str(error)[:600], "trace": traceback.format_exc()[-1500:]})
    finally:
        for agent_id, state in run.agent_state.items():
            if state["state"] == "working":
                run.agent(agent_id, "idle", "")
        if run.status != "done":
            settle_busy(run.pid, run.emit)
        store.mutate(run.pid, lambda p: p.setdefault("runs", []).append({"id": run.id, "mode": run.mode, "status": run.status, "stats": run.stats, "elapsed": round(time.time() - run.started, 1)}))


BUSY_STATES = ("writing", "qa", "rendering")


def settle_busy(pid: str, emit: Any = None) -> int:
    fixed: list[int] = []

    def apply(doc: dict[str, Any]) -> None:
        for s in doc.get("scenes") or []:
            if s.get("status") in BUSY_STATES:
                s["status"] = "written" if (s.get("code") or s.get("source") == "house") else "planned"
                s["interrupted"] = True
                s.pop("progress", None)
                fixed.append(s.get("index", 0))
    try:
        store.mutate(pid, apply)
    except Exception:
        return 0
    if fixed and emit:
        for i in fixed:
            emit("scene.update", {"index": i, "patch": {"status": "written"}})
        emit("run.warning", {"message": f"{len(fixed)} scene(s) were interrupted mid-run and kept their last version; re-run them to continue improving"})
    return len(fixed)


def recover_orphans() -> int:
    total = 0
    for item in store.list():
        current = RUNS.get(item["id"])
        if current and current.status == "running":
            continue
        try:
            project = store.get(item["id"])
        except Exception:
            continue
        if any(s.get("status") in BUSY_STATES for s in project.get("scenes") or []):
            total += settle_busy(item["id"])
    return total


def start(pid: str, mode: str = "full", options: dict[str, Any] | None = None, scene_id: str | None = None, instruction: str = "",
          scene_ids: list[str] | None = None) -> Run:
    current = RUNS.get(pid)
    if current and current.status == "running":
        raise RuntimeError("a run is already active for this project")
    run = Run(pid, mode, options or {})
    RUNS[pid] = run
    run.task = asyncio.create_task(execute(run, scene_id, instruction, scene_ids))
    return run


def cancel(pid: str) -> bool:
    run = RUNS.get(pid)
    if not run or run.status != "running":
        return False
    run.cancelled = True
    if run.task:
        run.task.cancel()
    return True
