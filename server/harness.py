from __future__ import annotations

import asyncio
import base64
import json
import re
import shutil
import subprocess
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any, Callable

from . import compose, config, llm as llmmod, qa, render, toolkit, webtools
from .skills import library
from .store import project_dir

MAX_STEPS = 26
TOPUP_STEPS = 10
TOPUPS = 2
REPLY_TOKENS = 9000
FILE_LIMIT = 120_000
RESULT_LIMIT = 7000
SANDBOX = Path(__file__).with_name("sandbox.sh")
WS_ROOT = Path(tempfile.gettempdir()) / "auteur-ws"
TOOL_BLOCK = re.compile(r"```tool[ \t]+([a-z_]+)[ \t]*([^\n]*)\n(.*?)\n?```[ \t]*(?=\n|$)", re.S)
OPEN_BLOCK = re.compile(r"```tool[ \t]+([a-z_]+)[ \t]*([^\n]*)\n(.*)$", re.S)
EDIT_BLOCK = re.compile(r"<<<<<<< SEARCH\n(.*?)\n=======\n(.*?)\n>>>>>>> REPLACE", re.S)
_SANDBOX_OK: dict[str, bool] = {}

HARNESS_SYSTEM = """You are an animator agent working inside AuteurFrame's scene workshop: a private workspace with real tools, like a coding agent.
You build ONE scene. The deliverable is the file scene.html in your workspace: an HTML fragment (root <div class="scene">, one <style>, one <script>
calling AU.scene) that AuteurFrame's runtime renders frame by frame. Writing code alone does not make a video: you must preview it in the real renderer,
read what came back, fix it, and only then finish.

Choose the right instrument for each part of the shot, and combine them freely:
- components for standard professional pieces (titles, lower thirds, callouts, charts, steps, chat, characters, 3D models). They are tuned,
  frame-exact and themed; place them with add_component or call AU.component(name, params) inside your own script.
- your own GSAP/HTML code for the signature move that makes this scene unique; build it around and between components.
- 3D models from search_models/import_model when a real object or character sells the idea; rigged ones can walk, run or idle.
- media tools when the scene uses footage: cut, reframe, speed ramp, grade and caption real video, then import the result and place it with the clip component.
- real-world material from the internet when the shot is about something real: a person, place, landmark, building, artwork, product, logo,
  document, news article, historical photo or a map. Never fake these with a weak drawing. Search (search_images, search_icons, web_search),
  look at the candidates, collect the best one, and place it (image, webpage, map components or your own code). Screenshot real web pages for
  documentary moves (highlight a sentence, zoom into a quote) and build maps with make_map. Read the documentary-assets and maps-and-geography skills.
- engines when another tool is simply better (Manim for equations and mathematical constructions), rendered to a clip and composited.
- characters designed for the story: toon (presets, hats, hair, outfits, props, expressions, zombies, toon-crowd) or your own coded SVG rig
  (svg-character-design skill); never reuse one stock figure for different people. Places and objects from toon-set (animated environments)
  and toon-prop (about 50 living buildings, vehicles and objects), or your own SVG architecture (svg-architecture-and-props skill).
- characters that act and speak: toon, 2D character, mascot, 3D models and talking-head portraits, lip synced to the narration or to dialogue lines
  from speak (character-dialogue-lipsync skill), and a lens look or lens move for the shot (component lens, lens-and-camera-optics skill).

How to work:
1. Plan in two or three short lines: CONCEPT (the visual idea), SIGNATURE MOVE (the memorable choreography), HAND-OFF (how it leads into the next scene).
2. Learn what the shot needs. The composition contract and the skills the director chose for this scene are included below. Search others with
   list_skills and open them with read_skill. Check list_libraries when d3, Pixi, p5, physics, noise, morphing or Lottie would help, and read the
   motion-libraries skill before using one.
3. Write scene.html. Each of your replies is limited, so write long files in parts: write_file the first part, then append_file the rest across
   several replies. Never cram everything into one giant reply. If a block gets cut off, it is still saved and you continue with append_file.
4. preview renders real frames and returns runtime errors, QA issues, motion energy per time window and the layout of every layer.
   Fix problems with edit_file (small exact SEARCH/REPLACE edits) instead of rewriting the whole file.
5. Use run for computation: write a node (.mjs) or python script in the workspace to precompute paths, data, layouts or physics, run it, and paste the
   result into scene.html. The sandbox has no network and no access to anything outside the workspace.
6. When preview shows no runtime errors, no P0/P1 issues and motion in every window, call finish.

Tool call format. Each reply may contain one to three tool blocks. The first line is three backticks, the word tool, the tool name and its
argument, all plain words with no angle brackets and no XML; everything up to the closing three backticks is the body. Real examples:
```tool read_skill motion-toolkit
```
```tool write_file scene.html
<div class="scene"><h1 class="t" data-layer="t">Sky</h1></div>
<style>.t{color:var(--ink)}</style>
```
```tool append_file scene.html
<script>AU.scene(({ tl }) => { tl.fromTo('.t', { y: 60 }, { y: 0, duration: 0.6 }, 0.1); });</script>
```
```tool add_component title
{"text": "Why the sky is *blue*", "style": "mask"}
```
```tool preview
```
Tools:
- list_skills [query]          list technique skills, best matches first
- read_skill <name> [page]     read a skill (pages of about 8000 characters)
- list_libraries               libraries you can load with data-libs on the scene root
- list_files                   files in your workspace
- read_file <path> [from-to]   show a file with line numbers
- write_file <path>            body is the complete new content
- append_file <path>           body is appended to the end of the file
- edit_file <path>             body is one or more blocks:
<<<<<<< SEARCH
exact existing text
=======
replacement text
>>>>>>> REPLACE
- run <shell command>          sandboxed shell in the workspace (node, python3, ffmpeg), 30 s limit
- list_components [query]      ready-made professional components (titles, lower thirds, callouts, highlights, charts, steps, chat, cursor, device,
                               characters, mascots, sprites, 3D models, Lottie, particles, logo stings...)
- component_info <name>        parameters, defaults and an example for one component
- add_component <name>         body is a JSON object of parameters; inserts AU.component(name, params) into scene.html (creates it if needed)
- search_models <query>        free 3D models from Polyfork (GLB, many rigged with Idle/Walk/Run clips); optional JSON body {"class","rigged","max_triangles"}
- import_model <id>            download a model into the project; returns an asset id for the model3d component
- list_media                   the project's footage, images and audio, with their paths inside the sandbox (/mnt/media/...)
- media_tools [query]          42 ffmpeg editing tools (cut, fit/reframe, speedramp, color/LUT, caption burn-in, audio ducking, loudness, overlay,
                               join with transitions, stabilize, denoise, broll, look contact sheets...)
- media_help <tool>            the flags of one media tool
- media <tool> <args>          run a media tool in the sandbox; read inputs from /mnt/media, write outputs under out/ in your workspace
- import_media <path> [name]   turn a workspace file (video, image, audio) into a project asset id usable by the clip and image components
- engines                      external render engines you can use (for example Manim for math), with their status
- render_engine <engine> <file> render a source file you wrote with that engine into a transparent clip asset; optional JSON body of options
- web_search <query>           search the web; returns titles, urls and snippets
- read_page <url> [focus words] read a page as text (with a screenshot for vision models)
- search_images <query>        free images (Openverse, Wikimedia Commons, stock); optional JSON body {"style": "photo|illustration|vector|transparent|historical|portrait"}.
                               Results are numbered; use the numbers with look and collect_image
- search_icons <query>         icon names from Iconify (200,000 icons, logos and flags, for example logos:google or flag:bd-4x3)
- scrape_images <url>          list the images a web page shows (numbered, with sizes); optional JSON body {"min": 300}
- look <numbers or asset ids>  see candidates side by side (a contact sheet for vision models, details for others), for example: look 3,5,9
- collect_image <number|url> [name]  download a result or image URL into the project as an asset id (credit is recorded automatically)
- collect_icon <prefix:name> [color]  save an Iconify icon as an svg asset
- screenshot <url>             capture a web page with the headless browser into an image asset; JSON body {"find": ["phrase to locate"], "full": false,
                               "selector": "css", "dark": false, "width": 1440, "height": 900}; returns the boxes of each phrase in % for the webpage component
- geocode <place>              latitude, longitude and bounding box of a place (OpenStreetMap Nominatim)
- make_map                     body is a JSON map spec (style, camera flights, markers, routes, regions); downloads the tiles and returns a map asset id
                               for the map component. Read the maps-and-geography skill first
- edit_image <asset>           local image editing; body is a JSON list of operations, for example [{"op": "cutout"}, {"op": "sticker"}] or
                               [{"op": "crop", "aspect": "9:16"}, {"op": "duotone"}]. Ops: cutout (background removal), sticker, outline, shadow, trim, crop,
                               resize, upscale, duotone, grayscale, sepia, halftone, posterize, sketch, blur_bg, adjust, tint, vignette, grain, shape, border,
                               rotate, flip. Returns a new asset id; image_ops lists every parameter
- analyze_image <asset>        faces, subject box, focus point (for Ken Burns: image component param focus), palette and brightness
- generate_image <prompt>      AI illustration (Pollinations) when no real material exists; JSON body {"width", "height", "seed"}.
                               Never use it for real people, places or events
- voices [description]         the text-to-speech voices you can cast (gender, age, accent, character), filtered by a description
- speak <voice|auto> [role]    body is the line to say; synthesises dialogue for a character (auto casts a fitting voice for the role and
                               remembers it), returns an audio asset with word timings, and places it in this scene; JSON body form
                               {"text": "...", "at": 1.2, "role": "old fisherman", "rate": "+0%"}. Feed the asset to talking-head or a character
                               with lipsync so the mouth follows the words
- rig_face <image asset>       find the face landmarks of a portrait so the talking-head component can animate it (done automatically too)
- search_footage <query>       archival and stock video (Internet Archive, NASA, Wikimedia Commons), numbered with ids
- footage_info <id>            duration, shot changes and a frame contact sheet of one result
- collect_footage <id> <start seconds> <seconds> [name]  cut a clip (up to 60 s, 1080p, silent unless {"audio": true}) into a video asset
- search_audio <query>         free sound effects, music and ambience (Freesound, Jamendo, ccMixter, Wikimedia, Internet Archive; commercial-use
                               licences only); JSON body {"kind": "sfx|music|ambience", "max_seconds": 8}
- collect_audio <number> [start] [seconds]  download a result as an audio asset (music gets bpm and beat times)
- place_audio <asset> <sfx|music> [scene seconds]  put a sound effect on the film timeline at a time inside this scene, or set the film's music;
                               JSON body {"gain": 0.8, "in": 0, "dur": null, "fade_in": 0, "fade_out": 0}
- sfx <name> <scene seconds> [gain] [length]  place a synthesised sound effect (whoosh, impact, riser, footsteps, glass, siren, zombie-groan,
                               wind, rain, fire, thunder, heartbeat ...); sfx list shows all 39
- wikidata <entity>            structured facts about a person, place, organisation or thing (dates, numbers, relations, official images)
- sparql                       body is a Wikidata SPARQL query; returns up to 300 rows
- owid <chart-slug> [countries] a real data series from Our World in Data (for example owid life-expectancy Bangladesh,India); saved as a data asset
- worldbank <indicator> [countries]  World Bank series by code or name (population, gdp, gdp per capita, life expectancy, inflation...); saved as data
- data_search <topic>          find Our World in Data chart slugs for a topic
- validate                     static checks of scene.html
- preview [t1, t2, ...]        render scene.html and report errors, issues, motion and layout
- finish [one line summary]    submit scene.html (it must validate and render without runtime errors)

Rules: never put planning notes inside files; no comments and no emoji in scene code; all motion on tl or in onFrame from t; colours and fonts from
CSS variables; stay inside the safe area; keep the caption band free. Keep replies short outside tool blocks."""


def reference_images(project: dict[str, Any], scene: dict[str, Any]) -> list[str]:
    aid = scene.get("reference_asset")
    if not aid:
        return []
    a = next((x for x in project.get("assets", []) if x.get("id") == aid), None)
    if not a:
        return []
    try:
        if a.get("kind") == "image":
            from . import imaging
            return [imaging.to_jpeg_b64(imaging.load(project["id"], a), 1100)]
        if a.get("kind") == "video":
            from . import media_sources as ms
            path = str(project_dir(project["id"]) / "assets" / a["file"])
            dur = ms._probe(path).get("duration") or 6
            sheet = ms.frame_sheet(path, [round(dur * k / 9, 2) for k in range(1, 9)])
            return [sheet] if sheet else []
    except Exception:
        return []
    return []


def gated_system() -> str:
    media = llmmod.media_settings()
    text = HARNESS_SYSTEM
    drop = []
    if not media.get("image_gen"):
        drop.append("- generate_image")
    if not media.get("tts"):
        drop.append("- speak ")
        drop.append("- voices")
    if not drop:
        return text
    out, skipping = [], False
    for line in text.split("\n"):
        if any(line.startswith(d) for d in drop):
            skipping = True
            continue
        if skipping and line.startswith("    "):
            continue
        skipping = False
        out.append(line)
    return "\n".join(out)


def _sandbox_ok() -> bool:
    if "ok" not in _SANDBOX_OK:
        try:
            _SANDBOX_OK["ok"] = shutil.which("unshare") is not None and subprocess.run(["unshare", "-rnm", "true"], capture_output=True, timeout=10).returncode == 0
        except (OSError, subprocess.SubprocessError):
            _SANDBOX_OK["ok"] = False
    return _SANDBOX_OK["ok"]


WEB_TOOLS = {"web_search", "read_page", "search_images", "search_icons", "scrape_images", "look", "collect_image", "collect_icon", "screenshot", "geocode", "make_map"}
MEDIA_TOOLS = {"edit_image", "image_ops", "analyze_image", "generate_image", "search_footage", "footage_info", "collect_footage", "search_audio", "collect_audio",
               "place_audio", "wikidata", "sparql", "owid", "worldbank", "data_search", "voices", "speak", "rig_face", "lens_help", "sfx"}


async def stock_icons(query: str, prefix: str = "") -> dict[str, Any]:
    from . import stock
    return await stock.icons(query, 80, prefix)


XML_FENCE = re.compile(r"```tool[ \t]*<\s*([a-z_]+)\s*>(.*?)(?:</\s*(?:tool|\1)\s*>)?\s*```", re.S)
XML_TAG = re.compile(r"<tool\s+name\s*=\s*[\"']([a-z_]+)[\"']([^>]*)>(.*?)</tool>", re.S)
JSON_CALL = re.compile(r"```(?:json|tool)?\s*(\{\s*\"(?:tool|name)\"\s*:.*?\})\s*```", re.S)
ARG_KEYS = ("path", "arg", "argument", "name", "query", "command", "tool", "id", "times", "summary", "engine", "file", "url", "place")


def _inner(text: str, tag: str) -> str | None:
    m = re.search(rf"<\s*{tag}\s*>(.*?)</\s*{tag}\s*>", text, re.S)
    return m.group(1) if m else None


def _from_xml(name: str, inner: str, attrs: str = "") -> tuple[str, str, str]:
    arg_parts = []
    for key in ARG_KEYS:
        v = _inner(inner, key)
        if v is not None:
            arg_parts.append(v.strip())
    am = re.findall(r"(\w+)\s*=\s*[\"']([^\"']*)[\"']", attrs)
    arg_parts += [v for k, v in am if k in ARG_KEYS]
    body = _inner(inner, "body") or _inner(inner, "content") or _inner(inner, "params") or _inner(inner, "parameters")
    if body is None:
        body = re.sub(r"<\s*(\w+)\s*>.*?</\s*\1\s*>", "", inner, flags=re.S).strip() if arg_parts else inner.strip()
    return name, " ".join(arg_parts), body.strip("\n")


def _from_json(text: str) -> tuple[str, str, str] | None:
    try:
        d = json.loads(text)
    except json.JSONDecodeError:
        return None
    name = d.get("tool") or d.get("name")
    args = d.get("args") or d.get("arguments") or d.get("parameters") or {}
    if isinstance(args, str):
        try:
            args = json.loads(args)
        except json.JSONDecodeError:
            args = {"arg": args}
    if not isinstance(name, str) or not isinstance(args, dict):
        return None
    arg = " ".join(str(args[k]) for k in ARG_KEYS if k in args and k != "tool")
    body = args.get("body") or args.get("content")
    if body is None:
        rest = {k: v for k, v in args.items() if k not in ARG_KEYS}
        body = json.dumps(rest) if rest else ""
    return name, arg, body if isinstance(body, str) else json.dumps(body)


def parse_tools(reply: str) -> tuple[list[tuple[str, str, str]], tuple[str, str, str] | None]:
    calls = [(m.group(1), m.group(2).strip(), m.group(3)) for m in TOOL_BLOCK.finditer(reply or "")]
    if not calls:
        alt = [_from_xml(m.group(1), m.group(2)) for m in XML_FENCE.finditer(reply or "")]
        alt += [_from_xml(m.group(1), m.group(3), m.group(2)) for m in XML_TAG.finditer(reply or "")]
        alt += [c for c in (_from_json(m.group(1)) for m in JSON_CALL.finditer(reply or "")) if c]
        if alt:
            return alt, None
    rest = TOOL_BLOCK.sub("", reply or "")
    partial = None
    m = OPEN_BLOCK.search(rest)
    if m:
        partial = (m.group(1), m.group(2).strip(), m.group(3))
    return calls, partial


class Workshop:
    def __init__(self, project: dict[str, Any], scene: dict[str, Any], emit: Callable[..., Any], model: llmmod.LLM, vision: bool) -> None:
        self.project = project
        self.scene = scene
        self.emit = emit
        self.model = model
        self.vision = vision
        self.root = WS_ROOT / f"{project['id']}-{scene['id']}-{uuid.uuid4().hex[:6]}"
        self.root.mkdir(parents=True, exist_ok=True)
        self.previews = 0
        self.last_preview: dict[str, Any] | None = None
        self.images: list[str] = []
        self.done = False
        self.summary = ""
        self.loaded: set[str] = set()
        self.reading_turns = 0
        self.found: dict[int, dict[str, Any]] = {}
        self.found_next = 1

    def path(self, rel: str) -> Path:
        rel = (rel or "scene.html").strip().strip("\"'")
        target = (self.root / rel).resolve()
        if self.root.resolve() not in target.parents and target != self.root.resolve():
            raise ValueError("paths must stay inside the workspace")
        if target.name == "node_modules" or "node_modules" in target.parts:
            raise ValueError("node_modules is read-only")
        return target

    def read(self, rel: str = "scene.html") -> str:
        p = self.path(rel)
        return p.read_text(encoding="utf-8") if p.exists() else ""

    def tool_event(self, name: str, arg: str, ok: bool, detail: str) -> None:
        self.emit("agent.tool", {"agent": "animator", "scene": self.scene["index"], "tool": name, "arg": arg[:80], "ok": ok, "detail": detail[:160]})

    async def call(self, name: str, arg: str, body: str) -> str:
        try:
            out = await self._dispatch(name, arg, body)
            self.tool_event(name, arg, True, out.split("\n", 1)[0])
            return out
        except Exception as error:
            self.tool_event(name, arg, False, str(error))
            return f"ERROR: {error}"

    async def _dispatch(self, name: str, arg: str, body: str) -> str:
        if name == "list_skills":
            query = (arg or body).strip()
            skills = library.search(query, "animator", limit=14) if query else [s for s in library.all() if s.enabled]
            return "\n".join(f"- {s.name}: {s.description[:200]}" for s in skills) or "no skills found"
        if name == "read_skill":
            parts = (arg or body).split()
            if not parts:
                raise ValueError("give a skill name")
            skill = library.get(parts[0])
            if not skill:
                raise ValueError(f"unknown skill {parts[0]}; use list_skills")
            nums = [int(x) for x in re.findall(r"\d+", " ".join(parts[1:]))]
            page = nums[0] if nums else 1
            if skill.name in self.loaded and page == 1:
                return f"skill {skill.name} is already in your instructions above (the full text). Do not read it again; use it and write scene.html."
            text = skill.body
            size = 6000
            pages = max(1, -(-len(text) // size))
            if page > pages:
                return f"skill {skill.name} has only {pages} page(s); you have read all of it."
            chunk = text[(page - 1) * size: page * size]
            return f"skill {skill.name} page {page}/{pages}\n{chunk}"
        if name == "list_libraries":
            cat = compose.library_catalog()
            return ("Declare on the root: <div class=\"scene\" data-libs=\"d3 simplex\">. Read the motion-libraries skill for deterministic usage.\n" +
                    "\n".join(f"- {k} (global {v['global']}, v{v['version']}): {v['use']}" for k, v in cat.items()))
        if name == "list_files":
            files = [p for p in sorted(self.root.rglob("*")) if p.is_file() and "node_modules" not in p.parts]
            return "\n".join(f"{p.relative_to(self.root)}  {p.stat().st_size} bytes" for p in files) or "workspace is empty"
        if name == "read_file":
            p = self.path(arg.split()[0] if arg else "scene.html")
            if not p.exists():
                raise ValueError(f"{p.name} does not exist")
            lines = p.read_text(encoding="utf-8").split("\n")
            rng = re.search(r"(\d+)\s*-\s*(\d+)", arg)
            a, b = (int(rng.group(1)), int(rng.group(2))) if rng else (1, len(lines))
            shown = "\n".join(f"{i:4d}| {lines[i - 1]}" for i in range(max(1, a), min(len(lines), b) + 1))
            return f"{p.name}: {len(lines)} lines\n{shown}"
        if name in ("write_file", "append_file"):
            p = self.path(arg or "scene.html")
            p.parent.mkdir(parents=True, exist_ok=True)
            current = p.read_text(encoding="utf-8") if (name == "append_file" and p.exists()) else ""
            content = current + (body if not current or current.endswith("\n") or body.startswith("\n") else "\n" + body)
            if len(content) > FILE_LIMIT:
                raise ValueError(f"file would exceed {FILE_LIMIT} characters; keep scenes lean")
            p.write_text(content, encoding="utf-8")
            return f"{'appended to' if name == 'append_file' else 'wrote'} {p.name}: now {len(content)} characters, {content.count(chr(10)) + 1} lines"
        if name == "edit_file":
            p = self.path(arg or "scene.html")
            text = p.read_text(encoding="utf-8") if p.exists() else ""
            blocks = EDIT_BLOCK.findall(body)
            if not blocks:
                raise ValueError("no SEARCH/REPLACE block found")
            done = 0
            for old, new in blocks:
                if old not in text:
                    first = old.strip().split("\n")[0][:60]
                    hint = next((l for l in text.split("\n") if first and first[:25] in l), "")
                    raise ValueError(f"SEARCH text not found (applied {done} of {len(blocks)} edits). Closest line: {hint[:120]!r}. Use read_file to copy exact text.")
                text = text.replace(old, new, 1)
                done += 1
            p.write_text(text, encoding="utf-8")
            return f"applied {done} edit(s) to {p.name}: now {len(text)} characters"
        if name == "run":
            command = (arg + "\n" + body).strip() if body.strip() else arg
            if not command:
                raise ValueError("give a command")
            return await self.run(command)
        if name == "validate":
            problems = qa.validate_fragment(self.read())
            return "scene.html passes the static checks" if not problems else "problems:\n- " + "\n- ".join(problems)
        if name == "preview":
            times = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", arg + " " + body)][:6]
            return await self.preview(times)
        if name == "finish":
            code = self.read()
            problems = qa.validate_fragment(code)
            if problems:
                return "NOT FINISHED. Fix these first:\n- " + "\n- ".join(problems)
            report = await self.preview([], quiet=True)
            if self.last_preview and self.last_preview.get("blocking"):
                reason = next((l.strip("- ").strip() for l in report.split("\n") if l.startswith("- [P0]") or l.startswith("- ") and "runtime" in report.split(l)[0][-40:]), "see the report")
                return f"NOT FINISHED: {reason[:160]}\nThe render still has blocking problems; fix them with edit_file, preview again, then finish.\n" + report
            self.done = True
            self.summary = (arg + " " + body).strip()[:200]
            return "finished"
        if name == "list_components":
            return toolkit.list_components((arg + " " + body).strip())
        if name == "component_info":
            return toolkit.component_info((arg or body).strip())
        if name == "add_component":
            comp = (arg or "").split()[0] if arg else ""
            params = toolkit.parse_params(body)
            snippet = toolkit.component_call(comp, params)
            code = self.read()
            if not code.strip():
                code = '<div class="scene"></div>\n<script>\nAU.scene((ctx) => {\n});\n</script>\n'
            new = toolkit.insert_call(code, snippet)
            self.path("scene.html").write_text(new, encoding="utf-8")
            return f"added {snippet}\nscene.html now {len(new)} characters. Add more components, write your own code around them, then preview."
        if name == "search_models":
            q = (arg or "").strip()
            opts = toolkit.parse_params(body) if body.strip() else {}
            return await toolkit.search_models(q, opts)
        if name == "import_model":
            mid = (arg or body).strip().split()[0]
            out = await toolkit.import_model(self.project["id"], mid)
            self.refresh()
            return out
        if name == "list_media":
            return toolkit.list_media(self.project)
        if name == "media_tools":
            return toolkit.media_tools((arg + " " + body).strip())
        if name == "media_help":
            return toolkit.media_help((arg or body).strip())
        if name == "media":
            parts = (arg + " " + body).strip().split(None, 1)
            if not parts:
                raise ValueError("give a tool name, for example: media fit /mnt/media/clip.mp4 --aspect 9:16 --fit crop -o out/vertical.mp4")
            command = toolkit.media_command(parts[0], parts[1] if len(parts) > 1 else "")
            (self.root / "out").mkdir(exist_ok=True)
            return await self.run(command, seconds=240, media=True)
        if name == "import_media":
            bits = (arg + " " + body).strip().split(None, 1)
            if not bits:
                raise ValueError("give the workspace path of the file to import")
            out = toolkit.import_media(self.project["id"], self.path(bits[0]), bits[1] if len(bits) > 1 else "")
            self.refresh()
            return out
        if name == "engines":
            return toolkit.engines_info()
        if name == "render_engine":
            bits = (arg or "").split()
            if len(bits) < 2:
                raise ValueError("usage: render_engine <engine> <source file> with an optional JSON body of options")
            engine, src = bits[0], bits[1]
            opts = toolkit.parse_params(body) if body.strip() else {}
            command, expect = toolkit.engine_command(engine, src, opts, self.project, self.scene)
            out = await self.run(command, seconds=int(opts.get("timeout", 240)), media=True)
            produced = toolkit.find_output(self.root, expect)
            if not produced:
                return "ENGINE RENDER FAILED\n" + out
            imported = toolkit.import_media(self.project["id"], produced, opts.get("name") or f"{engine} clip")
            self.refresh()
            return f"rendered {produced.name}\n{imported}\n{out[-1200:]}"
        if name in WEB_TOOLS:
            return await self._web(name, arg.strip(), body)
        if name in MEDIA_TOOLS:
            return await self._media(name, arg.strip(), body)
        raise ValueError(f"unknown tool {name}")

    def _asset(self, ref: str) -> dict[str, Any]:
        self.refresh()
        a = next((x for x in self.project.get("assets", []) if x.get("id") == ref or x.get("name") == ref), None)
        if not a:
            raise ValueError(f"no asset {ref}; list_media shows the project's assets")
        return a

    async def _media(self, name: str, arg: str, body: str) -> str:
        from . import imaging, media_sources as ms
        pid = self.project["id"]
        raw = body.strip()
        opts = toolkit.parse_params(raw) if raw.startswith("{") else {}
        if name == "image_ops":
            return imaging.OPS_HELP
        if name == "lens_help":
            return toolkit.component_info("lens")
        if name == "sfx":
            from . import audio as au
            bits = arg.split()
            if not bits or bits[0] == "list":
                return "Synthesised sound effects (free, instant):\n" + "\n".join(f"- {k}: {v}" for k, v in au.SFX_LIBRARY.items()) + \
                    "\nUse: sfx <name> <scene seconds> [gain] [length]; for other sounds use search_audio, collect_audio and place_audio."
            if bits[0] not in au.SFX_LIBRARY:
                raise ValueError(f"unknown sound {bits[0]}; sfx list shows the library")
            at = float(bits[1]) if len(bits) > 1 else 0.0
            gain = float(bits[2]) if len(bits) > 2 else 0.6
            length = float(bits[3]) if len(bits) > 3 else None
            t = float(self.scene.get("start", 0)) + at
            clip = {"id": "ac_" + uuid.uuid4().hex[:8], "sfx": bits[0], "t": round(t, 3), "gain": max(0.05, min(0.9, gain)), "by": "agent", "seed": int(t * 10) % 97}
            if length:
                clip["dur"] = length
            from .store import store as st
            st.mutate(pid, lambda doc: doc.setdefault("audio", {}).setdefault("clips", []).append(clip))
            self.refresh()
            return f"{bits[0]} placed at scene {at:.2f}s (film {t:.2f}s), gain {clip['gain']}"
        if name == "rig_face":
            if not arg:
                raise ValueError("give a portrait image asset id")
            a = self._asset(arg.split()[0])
            rig = await asyncio.to_thread(imaging.rig_asset, pid, a)
            self.refresh()
            if not rig:
                return "no face found; use a clear, front-facing portrait (or a character illustration with a visible face)"
            return (f"face rigged ({len(rig['points'])} landmarks). Use: AU.component('talking-head', {{ src: '{a['id']}', lipsync: 'voice' }}) for the narration, "
                    "or lipsync: '<audio asset from speak>', lipsyncAt: <scene seconds>")
        if name in ("voices", "speak"):
            from . import voice
            voice.require()
            if name == "voices":
                lang = voice.project_lang(self.project)
                found = await voice.catalog(lang)
                words = [w for w in re.findall(r"[a-z]+", (arg + " " + raw).lower()) if len(w) > 2]
                if words:
                    scored = sorted(found, key=lambda v: -sum(w in json.dumps(v).lower() for w in words))
                    found = scored
                cast = (self.project.get("audio") or {}).get("cast") or {}
                return (f"provider {voice.provider()}, language {lang}. Already cast: {json.dumps(cast) if cast else 'nobody'}\n" +
                        "\n".join(f"- {v['id']}: {v['name']} | {v.get('gender', '')} {v.get('age', '')} | {v.get('accent', '')} | {v.get('description', '')[:80]}" for v in found[:30]))
            if opts.get("text"):
                text = str(opts["text"])
                bits = arg.split(None, 1)
            else:
                bits = arg.split(None, 1)
                text = raw
            if not text.strip():
                raise ValueError("the body is the line to say")
            who = bits[0] if bits else "auto"
            role = str(opts.get("role") or (bits[1] if len(bits) > 1 else "") or "narrator")
            a = await voice.line(pid, text.strip(), who, role, str(opts.get("rate", "+0%")))
            at = float(opts.get("at", 0.3))
            from . import media_sources as ms
            if opts.get("place", True):
                ms.place_audio(pid, a["id"], "sfx", float(self.scene.get("start", 0)) + at, float(opts.get("gain", 1.0)))
            self.refresh()
            words = " ".join(f"{w['t']:.2f}:{w['w']}" for w in a["meta"]["words"][:40])
            return (f"line {a['id']} ({a['meta']['duration']:.2f}s, voice {a['meta']['voice']}) placed at scene {at:.2f}s. Word times from the line start: {words}\n"
                    f"Lip sync: talking-head or character with lipsync: '{a['id']}', lipsyncAt: {at}")
        if name in ("edit_image", "analyze_image"):
            bits = arg.split(None, 1)
            if not bits:
                raise ValueError("give an image asset id")
            a = self._asset(bits[0])
            if a.get("kind") != "image":
                raise ValueError(f"{bits[0]} is a {a.get('kind')}, not a raster image")
            if name == "analyze_image":
                info = await asyncio.to_thread(imaging.analyze, imaging.load(pid, a))
                return json.dumps({k: info[k] for k in ("width", "height", "transparent", "faces", "subject", "focus", "palette", "brightness") if k in info})
            ops = json.loads(raw) if raw.startswith("[") else (opts.get("ops") or ([opts] if opts.get("op") else []))
            if not ops:
                raise ValueError("body must be a JSON list of operations, for example [{\"op\": \"cutout\"}]. image_ops lists them")
            new = await asyncio.to_thread(imaging.edit, pid, a, ops, bits[1] if len(bits) > 1 else "")
            self.refresh()
            lines = [f"edited {a['id']} -> new asset {new['id']} ({new['meta']['width']}x{new['meta']['height']}{', transparent' if new['meta'].get('transparent') else ''}; ops {', '.join(new['meta']['ops'])})",
                     f"Use: AU.component('image', {{ src: '{new['id']}', fit: 'contain' }}) or your own <img>."]
            if self.vision:
                self._attach(imaging.to_jpeg_b64(imaging.load(pid, new)), "The result is attached (checkerboard = transparent).", lines)
            return "\n".join(lines)
        if name == "generate_image":
            prompt = (arg + " " + (raw if not raw.startswith("{") else "")).strip()
            if not prompt:
                raise ValueError("describe the image to generate")
            W, H = self.project.get("width", 1920), self.project.get("height", 1080)
            a = await ms.generate_image(pid, prompt, int(opts.get("width", min(1600, W))), int(opts.get("height", min(1600, H) if W >= H else 1600)), opts.get("seed"))
            self.refresh()
            mark = "" if a["meta"].get("clean") else " Free-tier images carry the provider's small pollinations.ai mark at the lower right; leave it intact (it is their attribution)."
            lines = [f"generated asset {a['id']} ({a['meta']['width']}x{a['meta']['height']}, seed {a['meta']['seed']}).{mark}"]
            if self.vision:
                self._attach(imaging.to_jpeg_b64(imaging.load(pid, a)), "The image is attached.", lines)
            return "\n".join(lines)
        if name == "search_footage":
            q = arg or raw
            if not q:
                raise ValueError("give what to search for")
            items = await ms.search_footage(q, str(opts.get("source", "auto")))
            if not items:
                return "no footage found; try other words (English, concrete events or places)"
            rows = self._remember(items[:14])
            return "\n".join(f"{n}. {it['id'][:60]} | {it['title'][:70]} ({it['source']}{', ' + str(it['year']) if it.get('year') else ''}) {it.get('about', '')[:80]}" for n, it in rows) + \
                "\nUse footage_info <number or id> to see its shots, then collect_footage <number or id> <start> <seconds>."
        if name in ("footage_info", "collect_footage"):
            bits = arg.split()
            if not bits:
                raise ValueError("give a result number or footage id")
            ref = bits[0]
            fid = self.found[int(ref)]["id"] if ref.isdigit() and int(ref) in self.found else ref
            info = await ms.resolve_footage(fid)
            if name == "footage_info":
                probe = await asyncio.to_thread(ms._probe, info["url"])
                cuts = await asyncio.to_thread(ms.scene_cuts, info["url"], min(420.0, probe["duration"] or 420.0))
                dur = probe["duration"] or 0
                times = ([0.5] + cuts)[:12] if cuts else [round(dur * k / 9, 1) for k in range(1, 9)]
                lines = [f"{info['title'][:90]}: {dur:.1f}s {probe.get('width')}x{probe.get('height')}{' with sound' if probe.get('audio') else ''}; licence {info.get('license')}",
                         "shot changes at: " + (", ".join(f"{c:.1f}" for c in cuts[:40]) or "none detected in the first minutes")]
                if self.vision:
                    sheet = await asyncio.to_thread(ms.frame_sheet, info["url"], times)
                    self._attach(sheet, "A contact sheet of frames (labelled with their times) is attached.", lines)
                return "\n".join(lines)
            if len(bits) < 3:
                raise ValueError("usage: collect_footage <id> <start seconds> <seconds> [name]")
            a = await asyncio.to_thread(ms.collect_footage, pid, info, float(bits[1]), float(bits[2]), min(1080, int(self.project.get("height", 1080))),
                                        bool(opts.get("audio")), " ".join(bits[3:]))
            self.refresh()
            return (f"footage clip {a['id']} ({a['meta']['duration']:.2f}s {a['meta']['width']}x{a['meta']['height']}); credit recorded.\n"
                    f"Use: AU.component('clip', {{ src: '{a['id']}', x: 0, y: 0, w: 100, h: 100 }}) or edit it with the media tools (grade, speed ramp, reframe).")
        if name == "search_audio":
            q = arg or (raw if not raw.startswith("{") else "")
            if not q:
                raise ValueError("give what to search for")
            items = await ms.search_audio(q, str(opts.get("kind", "sfx")), opts.get("max_seconds"))
            if not items:
                return "no audio found; try simpler words"
            rows = self._remember(items[:14])
            return "\n".join(f"{n}. {it['title'][:60]} | {it.get('duration') or '?'}s | {it.get('license', '')} | {it.get('source', '')} | {', '.join((it.get('tags') or [])[:4])}" for n, it in rows) + \
                "\nUse collect_audio <number> [start] [seconds], then place_audio."
        if name == "collect_audio":
            bits = arg.split()
            if not bits or not bits[0].isdigit() or int(bits[0]) not in self.found:
                raise ValueError("give a result number from search_audio")
            item = self.found[int(bits[0])]
            start = float(bits[1]) if len(bits) > 1 else 0.0
            dur = float(bits[2]) if len(bits) > 2 else None
            a = await ms.collect_audio(pid, item, start, dur)
            self.refresh()
            beats = a["meta"].get("beats") or []
            extra = f"; bpm {a['meta']['bpm']}, first beats {beats[:8]}" if a["meta"].get("bpm") else ""
            return f"audio asset {a['id']} ({a['meta'].get('duration', 0):.2f}s{extra}); credit recorded. Place it with place_audio {a['id']} sfx <scene seconds> or place_audio {a['id']} music"
        if name == "place_audio":
            bits = arg.split()
            if len(bits) < 2:
                raise ValueError("usage: place_audio <asset> <sfx|music> [scene seconds]")
            a = self._asset(bits[0])
            if a.get("kind") != "audio":
                raise ValueError(f"{bits[0]} is not audio")
            role = bits[1]
            t = float(self.scene.get("start", 0)) + (float(bits[2]) if len(bits) > 2 else 0.0)
            clip = ms.place_audio(pid, a["id"], role, t, float(opts.get("gain", 0.8)), float(opts.get("in", 0)), opts.get("dur"), float(opts.get("fade_in", 0)), float(opts.get("fade_out", 0)))
            self.refresh()
            return f"{a['id']} set as the film's music bed" if role == "music" else f"sound effect placed at {clip['t']:.2f}s of the film (scene time {t - float(self.scene.get('start', 0)):.2f}s)"
        if name == "wikidata":
            if not arg:
                raise ValueError("give an entity name or Q-id")
            d = await ms.wikidata(arg)
            facts = "\n".join(f"- {k}: {', '.join(v)}" for k, v in list(d["facts"].items())[:70])
            alts = ("\nOther matches: " + " | ".join(d["alternatives"])) if d["alternatives"] else ""
            return f"{d['label']} ({d['id']}): {d['description']}\n{facts}{alts}\nImages listed as commons.wikimedia.org/wiki/Special:FilePath/... can be collected with collect_image <url>."
        if name == "sparql":
            rows = await ms.sparql(raw or arg)
            return json.dumps(rows[:120], ensure_ascii=False)[:RESULT_LIMIT]
        if name in ("owid", "worldbank"):
            bits = arg.split(None, 1)
            if not bits:
                raise ValueError(f"usage: {name} <{'chart-slug' if name == 'owid' else 'indicator'}> [countries, comma separated]")
            countries = [c.strip() for c in (bits[1].split(",") if len(bits) > 1 else []) if c.strip()]
            if name == "owid":
                data = await ms.owid(bits[0], countries)
            else:
                ind = bits[0].replace("_", " ")
                data = await ms.worldbank(ind, countries or ["WLD"])
            a = ms.save_data(pid, data)
            self.refresh()
            return ms.summarize(data) + f"\nSaved as data asset {a['id']} (JSON: title, unit, source, series by country of [year, value]). " \
                "Put the numbers in bar-chart or line-chart components, or load them with fetch(ctx.asset('" + a["id"] + "')) inside AU.defer. Cite the source on screen."
        if name == "data_search":
            q = arg or raw
            rows = await webtools.web_search(f"site:ourworldindata.org/grapher {q}", 10)
            slugs = []
            for r in rows:
                m = re.search(r"ourworldindata\.org/grapher/([a-z0-9-]+)", r["url"])
                if m and m.group(1) not in slugs:
                    slugs.append(m.group(1))
                    if len(slugs) >= 8:
                        break
            from .media_sources import WB_ALIASES
            return ("Our World in Data charts: " + (", ".join(slugs) or "none found") + "\nUse owid <slug> <countries>.\nWorld Bank names: " + ", ".join(WB_ALIASES))
        raise ValueError(f"unknown tool {name}")

    def _remember(self, items: list[dict[str, Any]]) -> list[tuple[int, dict[str, Any]]]:
        out = []
        for it in items:
            n = self.found_next
            self.found_next += 1
            self.found[n] = it
            out.append((n, it))
        return out

    def _attach(self, b64: str | None, note: str, lines: list[str]) -> None:
        if self.vision and b64:
            self.images = [b64]
            lines.append(note)

    async def _web(self, name: str, arg: str, body: str) -> str:
        pid = self.project["id"]
        opts = toolkit.parse_params(body) if body.strip().startswith("{") else {}
        text = (arg + " " + (body if not body.strip().startswith("{") else "")).strip()
        if name == "web_search":
            if not text:
                raise ValueError("give a search query")
            rows = await webtools.web_search(text)
            if not rows:
                return "no results; try other words"
            return "\n".join(f"- {r['title'][:110]}\n  {r['url']}\n  {r.get('snippet', '')[:220]}" for r in rows)
        if name == "read_page":
            bits = text.split(None, 1)
            if not bits:
                raise ValueError("give a url")
            page = await webtools.read_page(bits[0], bits[1] if len(bits) > 1 else "")
            lines = [f"{page['title']} ({page['url']})", page.get("description", "")[:300], page["text"]]
            if page.get("image"):
                lines.append(f"Main image: {page['image']}")
            self._attach(page.get("frame"), "A screenshot of the page is attached.", lines)
            return "\n".join(l for l in lines if l)
        if name == "search_images":
            if not text:
                raise ValueError("give what to search for")
            items = await webtools.search_images(text, str(opts.get("style", "photo")), str(opts.get("source", "auto")))
            if not items:
                return "no images found; try simpler or English words, or another style"
            rows = self._remember(items[:16])
            return "\n".join(f"{n}. {webtools.describe(it)}" for n, it in rows) + "\nUse look <numbers> to see them, then collect_image <number>."
        if name == "search_icons":
            if not text:
                raise ValueError("give what to search for")
            data = await stock_icons(text, opts.get("prefix", ""))
            names = [i["name"] for i in data.get("icons", [])][:60]
            return ("Icons: " + ", ".join(names) + "\nSave one with collect_icon <name> [#hex colour]. Flags live under flag: and flagpack:, brand logos under logos: and simple-icons:.") if names else "no icons found"
        if name == "scrape_images":
            bits = text.split()
            if not bits:
                raise ValueError("give a page url")
            data = await webtools.capture(bits[0], {"images": True, "minImage": int(opts.get("min", 260)), "width": 1440, "height": 900})
            imgs = data.get("images") or []
            if not imgs:
                return f"no large images found on {data.get('url', bits[0])}"
            for im in imgs:
                im.setdefault("page", data.get("url"))
                im["title"] = im.get("alt") or data.get("title", "")
                im["width"], im["height"] = im.get("w"), im.get("h")
                im["thumb"] = im["url"]
                im["license"] = "check the page; credit the site"
            rows = self._remember(imgs[:30])
            return f"Images on {data.get('title', '')} ({data.get('url')}):\n" + "\n".join(f"{n}. {webtools.describe(it)} {it['url'][:120]}" for n, it in rows) + \
                "\nUse look <numbers> to check them and collect_image <number> to use one. Respect copyright: prefer free licences and credit the source."
        if name == "look":
            refs = [r for r in re.split(r"[\s,]+", text) if r][:12]
            if not refs:
                raise ValueError("give result numbers, asset ids or image urls")
            labels, urls, local = [], [], []
            for r in refs:
                if r.isdigit() and int(r) in self.found:
                    it = self.found[int(r)]
                    labels.append(f"{r}. {(it.get('title') or '')[:30]}")
                    urls.append(it.get("thumb") or it.get("url"))
                    local.append(None)
                elif r.startswith("as_"):
                    a = next((x for x in self.project.get("assets", []) if x.get("id") == r), None)
                    labels.append(r)
                    urls.append("")
                    path = project_dir(pid) / "assets" / a["file"] if a else None
                    local.append(path.read_bytes() if path and path.exists() and path.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp", ".gif") else None)
                elif r.startswith("http"):
                    labels.append(r[-30:])
                    urls.append(r)
                    local.append(None)
            fetched = await webtools.fetch_thumbs(urls)
            raws = [l if l is not None else f for l, f in zip(local, fetched)]
            details = []
            for lab, raw in zip(labels, raws):
                info = "could not load"
                if raw:
                    try:
                        from PIL import Image
                        import io as _io
                        with Image.open(_io.BytesIO(raw)) as im:
                            info = f"{im.size[0]}x{im.size[1]} {im.mode}{' with transparency' if im.mode in ('RGBA', 'LA', 'P') else ''}"
                    except Exception:
                        info = "svg or unreadable image"
                details.append(f"{lab}: {info}")
            lines = details
            if self.vision:
                self._attach(webtools.thumb_sheet(list(zip(labels, raws))), "A contact sheet of these images is attached.", lines)
            else:
                lines.append("Your model cannot see images; choose by title, size, source and licence.")
            return "\n".join(lines)
        if name == "collect_image":
            bits = text.split(None, 1)
            if bits and bits[0].isdigit() and int(bits[0]) in self.found and not self.found[int(bits[0])].get("url", "").startswith("http"):
                raise ValueError("that result is not an image")
            if not bits:
                raise ValueError("give a result number or an image url")
            ref = bits[0]
            if ref.isdigit():
                if int(ref) not in self.found:
                    raise ValueError(f"no result number {ref}; search again")
                item = self.found[int(ref)]
            elif ref.startswith("http"):
                item = {"url": ref, "title": bits[1] if len(bits) > 1 else "", "source": "", "page": ref}
            else:
                raise ValueError("give a result number or an image url")
            asset = await webtools.collect(pid, item, bits[1] if len(bits) > 1 else "")
            self.refresh()
            dims = f" {asset['meta'].get('width')}x{asset['meta'].get('height')}" if asset["meta"].get("width") else ""
            return (f"collected as asset {asset['id']} ({asset['kind']}{dims}); credit recorded: {asset['meta'].get('attribution', '')[:120]}\n"
                    f"Use: AU.component('image', {{ src: '{asset['id']}' }}) or <img src=\"${{ctx.asset('{asset['id']}')}}\"> in your own code.")
        if name == "collect_icon":
            bits = text.split()
            if not bits:
                raise ValueError("give an icon name like mdi:rocket")
            asset = await webtools.collect_icon(pid, bits[0], bits[1] if len(bits) > 1 else "")
            self.refresh()
            return f"saved icon {bits[0]} as svg asset {asset['id']}. Use it as an image src, or paste its markup inline to colour it with CSS variables:\n{asset['meta']['svg'][:1500]}"
        if name == "screenshot":
            bits = text.split()
            if not bits:
                raise ValueError("give a page url")
            out = await webtools.screenshot(pid, bits[0], opts)
            self.refresh()
            a, data = out["asset"], out["data"]
            lines = [f"screenshot saved as asset {a['id']} ({data['width']}x{data['height']} css px) of {data.get('title', '')[:100]} ({data.get('url')})"]
            for b in data.get("boxes") or []:
                if b["hits"]:
                    lines.append(f"phrase \"{b['phrase']}\": " + " | ".join(f"hit {i + 1} boxes {json.dumps(h)}" for i, h in enumerate(b["hits"])))
                else:
                    lines.append(f"phrase \"{b['phrase']}\": not visible in this capture (try full: true or a shorter phrase)")
            first = next((b["hits"][0] for b in data.get("boxes") or [] if b["hits"]), None)
            example = {"src": a["id"], "url": out["host"]}
            if first:
                example["highlights"] = [{"boxes": first, "at": 1.0}]
                example["focus"] = {"box": first[0], "at": 1.8}
            lines.append("Place it with: add_component webpage " + json.dumps(example))
            if self.vision:
                try:
                    from PIL import Image
                    import io as _io
                    im = Image.open(_io.BytesIO(out["raw"])).convert("RGB")
                    im.thumbnail((1200, 1600))
                    buf = _io.BytesIO()
                    im.save(buf, "JPEG", quality=72)
                    self._attach(base64.b64encode(buf.getvalue()).decode(), "The screenshot is attached.", lines)
                except Exception:
                    pass
            return "\n".join(lines)
        if name == "geocode":
            if not text:
                raise ValueError("give a place name")
            g = await webtools.maps.geocode(text)
            return json.dumps({k: g.get(k) for k in ("name", "lat", "lon", "bbox", "type", "class")}, ensure_ascii=False)
        if name == "make_map":
            spec = toolkit.parse_params(body) if body.strip() else {}
            if not spec:
                raise ValueError("the body must be a JSON map spec; read the maps-and-geography skill")
            dur = float(self.scene.get("duration") or 8)
            out = await webtools.make_map(self.project, spec, dur, lambda msg: self.tool_event("make_map", "", True, msg))
            self.refresh()
            a = out["asset"]
            notes = ("\nNotes: " + "; ".join(out["notes"])) if out["notes"] else ""
            return (f"map asset {a['id']} ({a['meta']['style']}, {out['tiles']} tiles, zoom {out['zoom'][0]} to {out['zoom'][1]}, {out['markers']} markers, {out['routes']} routes, "
                    f"{out['regions']} regions, {out['land']} countries drawn). Credit recorded: {a['meta']['credit']}.{notes}\n"
                    f"Place it with: add_component map {{\"src\": \"{a['id']}\"}} and layer titles, captions or your own animation above it.")
        raise ValueError(f"unknown tool {name}")

    def refresh(self) -> None:
        try:
            from .store import store
            fresh = store.get(self.project["id"])
            self.project = dict(fresh, scenes=self.project["scenes"])
        except Exception:
            pass

    async def run(self, command: str, seconds: int = 30, media: bool = False) -> str:
        if not _sandbox_ok():
            return "The terminal is unavailable in this environment (no user namespaces). Compute values in your head or in the scene script instead."
        nm = config.ROOT / "node_modules"
        media_dir = "-"
        if media:
            try:
                media_dir = str(project_dir(self.project["id"]) / "assets")
            except KeyError:
                media_dir = "-"
        engines = str(config.ROOT / "engines") if (config.ROOT / "engines").exists() else "-"
        proc = await asyncio.create_subprocess_exec("unshare", "-rnm", "--propagation", "private", "sh", str(SANDBOX), str(self.root), str(nm), command, media_dir, engines,
                                                    stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
                                                    env={"PATH": "/usr/bin:/bin", "SANDBOX_SECONDS": str(int(seconds))})
        try:
            out, _ = await asyncio.wait_for(proc.communicate(), timeout=seconds + 20)
        except asyncio.TimeoutError:
            proc.kill()
            return "command timed out"
        text = out.decode("utf-8", errors="replace")
        if len(text) > 5000:
            text = text[:2500] + f"\n... [{len(text) - 5000} characters trimmed] ...\n" + text[-2500:]
        return f"exit {proc.returncode}\n{text}"

    async def preview(self, times: list[float], quiet: bool = False) -> str:
        code = self.read()
        if not code.strip():
            return "scene.html does not exist yet; write it first"
        problems = qa.validate_fragment(code)
        D = float(self.scene["duration"])
        scene = dict(self.scene, code=code, source="agent")
        project = dict(self.project, scenes=[scene if s["id"] == scene["id"] else s for s in self.project["scenes"]])
        layout_times = times or [round(D * f, 2) for f in (0.12, 0.4, 0.7, 0.95)]
        self.previews += 1
        try:
            probe = await render.probe_scene(project, scene, layout_times=layout_times)
        except Exception as error:
            self.last_preview = {"blocking": True}
            return f"PREVIEW FAILED: {str(error)[:400]}"
        report = probe.get("report") or {}
        result = qa.evaluate(probe, D, qa.lint(code))
        energy = qa.motion_energy(probe.get("shots") or [])
        still = [f"{e['t0']:.1f}-{e['t1']:.1f}s" for e in energy if e["energy"] < 0.3]
        errors = (report.get("errors") or [])[:6]
        logs = [l for l in (probe.get("logs") or []) if "favicon" not in l][:6]
        issues = [i for i in result.get("issues", []) if i["severity"] in ("P0", "P1", "P2")][:10]
        blocking = bool(problems or errors or any(i["severity"] == "P0" for i in issues))
        self.last_preview = {"blocking": blocking, "score": result.get("score")}
        lines = [f"preview #{self.previews}: score {result.get('score')}, {'PASS' if result.get('pass') and not blocking else 'needs work'}"]
        if problems:
            lines.append("static problems:\n- " + "\n- ".join(problems))
        if errors:
            lines.append("runtime errors (fix first):\n- " + "\n- ".join(str(e)[:220] for e in errors))
        if logs:
            lines.append("console:\n- " + "\n- ".join(l[:200] for l in logs))
        if issues:
            lines.append("QA issues:\n" + "\n".join(f"- [{i['severity']}] {i['message'][:180]} -> {i.get('fix', '')[:160]}" for i in issues))
        lines.append(f"motion: {len(energy) - len(still)}/{len(energy)} half-second windows move" + (f"; still at {', '.join(still[:8])}" if still else ""))
        for snap in probe.get("layout") or []:
            items = "; ".join(f"{it['id']} [{it['x']},{it['y']} {it['w']}x{it['h']}]{(' ' + repr(it['text'])) if it['text'] else ''}" for it in snap["items"][:12])
            lines.append(f"layout at {snap['t']:.2f}s (frame {self.project['width']}x{self.project['height']}): {items or 'nothing visible'}")
        if self.vision and probe.get("shots") and not quiet:
            shots = probe["shots"][:: max(1, len(probe["shots"]) // 6)][:6]
            self.images = [qa.contact_sheet(shots)]
            lines.append("A contact sheet of the rendered frames is attached.")
        return "\n".join(lines)

    def save(self) -> None:
        try:
            dest = project_dir(self.project["id"]) / "work" / self.scene["id"]
            if dest.exists():
                shutil.rmtree(dest)
            shutil.copytree(self.root, dest, ignore=shutil.ignore_patterns("node_modules"), symlinks=False, ignore_dangling_symlinks=True)
        except (OSError, KeyError, shutil.Error):
            pass

    def close(self) -> None:
        shutil.rmtree(self.root, ignore_errors=True)


def _compact(history: list[dict[str, Any]], keep: int = 4) -> list[dict[str, Any]]:
    out = []
    cutoff = len(history) - keep
    for i, m in enumerate(history):
        m = dict(m)
        if 0 < i < cutoff:
            text = m["text"]
            if m["role"] == "assistant":
                text = re.sub(r"(```tool[ \t]+(?:write_file|append_file)[^\n]*\n)(.{1200,}?)(\n?```)",
                              lambda x: x.group(1) + f"[{len(x.group(2))} characters written; read_file to see it]" + x.group(3), text, flags=re.S)
            elif len(text) > 500:
                text = text[:400] + " ... [older result trimmed; re-run the tool if you need it]"
            m["text"] = text
            m["images"] = []
        out.append(m)
    return out


async def run(project: dict[str, Any], scene: dict[str, Any], emit: Callable[..., Any], *, feedback: str = "", previous_code: str = "", instruction: str = "",
              steps: int | None = None, topups: int | None = None) -> str:
    from . import agents
    model = llmmod.LLM("animator")
    if not model.available:
        raise llmmod.ProviderError("no model connected")
    idx = scene["index"]
    model.on_retry = lambda msg: emit("run.warning", {"message": f"scene {idx + 1}: {msg}"})
    if llmmod.read_settings().get("workshop_thinking", "off") == "off":
        model.force_thinking = "off"
    core, used = agents.animator_system(project, scene)
    emit("agent.skills", {"agent": "animator", "scene": idx, "skills": used})
    catalog = "\n".join(f"- {s.name}: {s.description[:160]}" for s in library.all() if s.enabled and s.name not in used)
    libs = ", ".join(compose.library_catalog().keys())
    system = (gated_system() + f"\n\nLibraries available with data-libs: {libs}.\nOther skills you can read_skill:\n{catalog}\n\n"
              + ("The terminal works.\n" if _sandbox_ok() else "The terminal is unavailable here; do not call run.\n") + "\n" + core)
    extra = ""
    if instruction:
        extra += f"\nUser direction for this scene (highest priority): {instruction}\n"
    if feedback:
        extra += f"\nQA found these problems in the current scene.html. Fix every one while keeping what works:\n{feedback}\n"
    task = agents.animator_user(project, scene, extra, harness=True)
    ws = Workshop(project, scene, emit, model, model.vision)
    ws.loaded = set(used)
    if previous_code:
        ws.path("scene.html").write_text(previous_code, encoding="utf-8")
        if feedback:
            ws.reading_turns = 4
        task += "\nscene.html already contains the current version of this scene. Read it, improve it, preview and finish."
    history: list[dict[str, Any]] = [{"role": "user", "text": task}]
    ref_images = reference_images(project, scene) if model.vision else []
    if ref_images:
        history[0]["images"] = ref_images
    on_token, flush = agents._tokens(emit, "animator", idx)
    started = time.time()
    try:
        max_topups = TOPUPS if topups is None else topups
        budget, topups, step = steps or MAX_STEPS, 0, -1
        while step + 1 < budget:
            step += 1
            reply = await model.chat(system, _compact(history), max_tokens=REPLY_TOKENS, temperature=0.8 if step < 3 else 0.6, on_token=on_token)
            flush()
            history.append({"role": "assistant", "text": reply or "(empty)"})
            calls, partial = parse_tools(reply)
            results = []
            reading = {"list_skills", "read_skill", "list_components", "component_info", "list_libraries", "list_files", "engines", "media_tools", "media_help", "list_media"}
            if calls and all(c[0] in reading for c in calls):
                ws.reading_turns += 1
            for name, arg, body in calls[:3]:
                if name in ("read_skill", "list_skills") and ws.reading_turns > 4:
                    results.append(f"[{name} {arg}]\nReading budget used up. Write scene.html now with what you know.")
                    continue
                out = await ws.call(name, arg, body)
                results.append(f"[{name} {arg}]\n{out[:RESULT_LIMIT]}")
                if ws.done:
                    break
            if partial and partial[0] in ("write_file", "append_file") and not ws.done:
                name, arg, body = partial
                out = await ws.call(name, arg, body)
                results.append(f"[{name} {arg}] (your block was cut off before the closing fence)\n{out}\nContinue with append_file {arg or 'scene.html'} from exactly where it stopped. The file currently ends with:\n{ws.read(arg or 'scene.html')[-300:]}")
            if ws.done:
                code = ws.read()
                ws.save()
                emit("agent.tool", {"agent": "animator", "scene": idx, "tool": "finish", "arg": "", "ok": True, "detail": f"finished in {step + 1} steps with {ws.previews} previews"})
                return code
            if not results:
                html_code = llmmod.extract_code(reply)
                if html_code:
                    ws.path("scene.html").write_text(html_code, encoding="utf-8")
                    results.append("You replied with an html block instead of a tool call. It was saved to scene.html. Next: ```tool preview``` then ```tool finish```.")
                else:
                    results.append("No tool call found. Reply with one to three ```tool <name> <arg>``` blocks (see the tool list).")
            if ws.reading_turns >= 2 and not ws.read().strip():
                results.append("You have read enough. Next reply: write scene.html (write_file, append_file for long files), then preview.")
            remaining = budget - step - 1
            if remaining == 0 and topups < max_topups and ws.read().strip():
                budget += TOPUP_STEPS
                topups += 1
                remaining = TOPUP_STEPS
                emit("run.warning", {"message": f"scene {idx + 1}: step budget extended by {TOPUP_STEPS} so the animator can finish properly"})
                results.append(f"Your step budget was extended by {TOPUP_STEPS} steps because the scene is not finished. Preview now, fix the most visible "
                               "problems with edit_file, preview again and finish. Do not start over.")
            elif remaining <= 4:
                results.append(f"Only {remaining} steps left: fix what matters most, preview once, then finish.")
            msg = {"role": "user", "text": "\n\n".join(results)}
            if ws.images:
                msg["images"] = ws.images
                ws.images = []
            history.append(msg)
        code = ws.read()
        if code and not qa.validate_fragment(code):
            ws.save()
            emit("run.warning", {"message": f"scene {idx + 1}: animator ran out of steps; using its last valid scene.html"})
            return code
        raise llmmod.ProviderError(f"animator harness did not finish in {budget} steps ({int(time.time() - started)} s)")
    finally:
        ws.close()
