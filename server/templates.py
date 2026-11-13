from __future__ import annotations

import html
import json
import random
import re
from pathlib import Path
from typing import Any, Callable

from . import house

T = dict[str, Any]


def slot(key: str, label: str, kind: str = "text", required: bool = False, default: Any = "", help: str = "", max: int = 0) -> T:
    return {"key": key, "label": label, "kind": kind, "required": required, "default": default, "help": help, "max": max}


def lst(v: Any) -> list[str]:
    if isinstance(v, list):
        return [str(x).strip() for x in v if str(x).strip()]
    return [s.strip() for s in re.split(r"\n|;", str(v or "")) if s.strip()]


def one(v: Any) -> str | None:
    if isinstance(v, list):
        return v[0] if v else None
    return v or None


def sc(arch: str, dur: float, data: T, trans: str = "fade", title: str = "") -> T:
    return {"archetype": arch, "duration": dur, "data": data, "transition": trans, "title": title or (str(data.get("title") or data.get("name") or arch)).replace("*", "")[:60]}


def accent(text: str) -> str:
    return house.emphasize(text) if text and "*" not in text else text


def b_app(v: T, a: T) -> list[T]:
    feats = lst(v.get("features"))[:4] or ["Fast", "Private", "Beautiful"]
    return [
        sc("logo-reveal", 3.4, {"logo": one(a.get("logo")), "name": v.get("app_name"), "tagline": accent(v.get("tagline", ""))}, "zoomin"),
        sc("phone-showcase", 6.0, {"kicker": v.get("app_name"), "title": accent(v.get("tagline", "")), "subtitle": v.get("subtitle", ""), "screens": a.get("screens") or [], "features": feats}, "smoothleft"),
        sc("kinetic-beat", 3.6, {"words": [w.split()[0] for w in feats] + [v.get("app_name", "Now")], "bpm": 120}, "slideup"),
        sc("end-card", 3.4, {"title": accent(v.get("cta") or f"Get {v.get('app_name', 'it')} today"), "subtitle": v.get("url", ""), "cta": v.get("cta_button") or "Download now", "icon": "smartphone"}, "cut"),
    ]


def b_saas(v: T, a: T) -> list[T]:
    feats = lst(v.get("features"))[:6] or ["Realtime", "Secure", "Automated"]
    out = [
        sc("kinetic-title", 3.2, {"kicker": v.get("product"), "title": accent(v.get("headline", "")), "icon": "sparkles"}, "smoothleft"),
        sc("ui-cascade", 5.5, {"kicker": v.get("product"), "title": accent(v.get("headline", "")), "image": one(a.get("screenshot")), "url": v.get("url") or "app.example.com", "callouts": feats[:2]}, "slideup"),
    ]
    num = house.find_number(v.get("metric", "") or "")
    if num:
        out.append(sc("big-number", 3.6, {"kicker": "Impact", "value": num["value"], "prefix": num["prefix"], "suffix": num["suffix"], "decimals": num["decimals"], "label": accent(v.get("metric_label", "faster"))}, "zoomin"))
    out.append(sc("icon-grid", 4.2, {"kicker": "Features", "title": "Everything you *need*", "items": [{"label": f, "icon": house.icon_for(f, ["zap", "shield-check", "bot", "chart-line", "users", "globe"][i % 6])} for i, f in enumerate(feats)]}, "smoothup"))
    out.append(sc("end-card", 3.2, {"title": accent(v.get("cta") or "Start free today"), "cta": v.get("cta_button") or "Try it free", "icon": "rocket"}, "cut"))
    return out


def b_showreel(v: T, a: T) -> list[T]:
    words = lst(v.get("words"))[:8] or ["Type", "Shape", "Depth", "Data", "Motion"]
    name = v.get("name") or "Your Name"
    return [
        sc("kinetic-beat", 4.0, {"words": words, "bpm": 120}, "squeezeh"),
        sc("shape-morph", 3.0, {"words": words[:4]}, "zoomin"),
        sc("three-hero", 3.5, {"kicker": v.get("role", "Motion designer"), "title": accent(words[-1] if words else "Depth"), "mode": "shapes"}, "smoothleft"),
        sc("particles-type", 3.0, {"title": name.upper(), "subtitle": v.get("role", "")}, "fadewhite"),
        sc("end-card", 2.5, {"title": accent(name), "subtitle": v.get("contact", ""), "icon": "sparkle"}, "cut"),
    ]


def b_paper(v: T, a: T) -> list[T]:
    chapters = lst(v.get("chapters"))[:4] or ["Once there was a quiet valley.", "Then the river changed its course.", "And everyone learned to adapt."]
    out = [sc("paper-cut", 4.6, {"kicker": v.get("kicker") or "A short story", "title": accent(v.get("title", "")), "subtitle": v.get("subtitle", "")}, "smoothup")]
    for i, ch in enumerate(chapters):
        out.append(sc("paper-cut", 4.2, {"kicker": f"Chapter {i + 1}", "title": accent(house.headline(ch, 9).replace("*", "")), "variant": i + 1}, "wipeup"))
    out.append(sc("end-card", 3.2, {"title": accent(v.get("ending") or "The end"), "icon": "leaf"}, "cut"))
    return out


def b_vox(v: T, a: T) -> list[T]:
    photos = a.get("photos") or []
    facts = lst(v.get("facts"))[:4] or ["It started in 1569", "Nobody noticed for centuries"]
    out = [sc("vox-board", 5.2, {"kicker": v.get("kicker") or "The question", "title": accent(v.get("title", "")), "photo": photos[0] if photos else None, "notes": facts[:2]}, "slideleft")]
    for i, f in enumerate(facts[:2]):
        num = house.find_number(f)
        if num:
            out.append(sc("big-number", 3.8, {"kicker": "Evidence", "value": num["value"], "prefix": num["prefix"], "suffix": num["suffix"], "label": accent(re.sub(r"\s+", " ", f.replace(num["match"], " ")).strip())}, "hlslice"))
        elif len(house.years(f)) >= 1 and i == 0:
            out.append(sc("timeline", 4.4, house.build_data("timeline", f + " " + " ".join(facts), {"kicker": "Timeline"}), "wipeup"))
    if v.get("quote"):
        out.append(sc("quote", 4.6, {"quote": accent(v["quote"]), "author": v.get("quote_author", ""), "role": v.get("quote_role", "")}, "fade"))
    out.append(sc("vox-board", 4.6, {"kicker": "So what", "title": accent(v.get("answer") or v.get("title", "")), "photo": photos[1] if len(photos) > 1 else (photos[0] if photos else None), "notes": facts[2:4]}, "slideleft"))
    out.append(sc("end-card", 3.0, {"title": accent(v.get("cta") or "Follow for the next one"), "icon": "newspaper"}, "cut"))
    return out


def b_photos(v: T, a: T) -> list[T]:
    photos = a.get("photos") or []
    caps = lst(v.get("captions"))
    out = [sc("kinetic-title", 3.2, {"kicker": v.get("kicker", ""), "title": accent(v.get("title", "")), "subtitle": v.get("subtitle", ""), "icon": "camera"}, "smoothleft")]
    groups = [photos[i:i + 3] for i in range(0, max(3, len(photos)), 3)][:3] or [[]]
    for gi, grp in enumerate(groups):
        out.append(sc("photo-stack", 5.0, {"title": accent(caps[gi] if gi < len(caps) else v.get("title", "")), "photos": grp, "captions": caps[gi * 3:gi * 3 + 3]}, "smoothup"))
    if photos:
        out.append(sc("image-focus", 4.2, {"title": accent(v.get("closing") or v.get("title", "")), "image": photos[-1], "variant": 2}, "fade"))
    out.append(sc("end-card", 3.0, {"title": accent(v.get("closing") or "Until next time"), "icon": "heart"}, "cut"))
    return out


def b_music(v: T, a: T) -> list[T]:
    return [sc("music-visualizer", float(v.get("_audio_duration") or 30.0), {"title": accent(v.get("track", "")), "artist": v.get("artist", ""), "cover": one(a.get("cover")), "bpm": 112}, "cut")]


def b_code(v: T, a: T) -> list[T]:
    steps = lst(v.get("steps"))[:6] or ["Write", "Build", "Test", "Ship"]
    return [
        sc("kinetic-title", 3.0, {"kicker": v.get("language", "Code"), "title": accent(v.get("title", "")), "icon": "code-xml"}, "smoothleft"),
        sc("code-typing", 7.5, {"title": accent(v.get("title", "")), "language": v.get("language", "javascript"), "code": v.get("code", ""), "output": v.get("output", ""), "file": v.get("file", "")}, "slideup"),
        sc("diagram-build", 5.2, {"kicker": "How it works", "title": accent(v.get("diagram_title") or "The *flow*"), "nodes": steps}, "smoothup"),
        sc("end-card", 3.0, {"title": accent(v.get("cta") or "Try it yourself"), "icon": "terminal"}, "cut"),
    ]


def b_3d(v: T, a: T) -> list[T]:
    return [
        sc("three-hero", 7.0, {"kicker": v.get("kicker", ""), "title": accent(v.get("title", "")), "subtitle": v.get("subtitle", ""), "mode": "gallery", "images": a.get("images") or []}, "fadewhite"),
        sc("three-hero", 4.6, {"kicker": v.get("kicker", ""), "title": accent(v.get("tagline") or v.get("title", "")), "mode": "shapes"}, "smoothup"),
        sc("end-card", 3.0, {"title": accent(v.get("cta") or v.get("title", "")), "icon": "box"}, "cut"),
    ]


def b_data(v: T, a: T) -> list[T]:
    rows = []
    for line in lst(v.get("data")):
        m = re.match(r"(.+?)[:=,\-]\s*([\d.,]+)", line)
        if m:
            rows.append({"label": m.group(1).strip(), "value": float(m.group(2).replace(",", ""))})
    rows = rows[:6] or [{"label": "North", "value": 42}, {"label": "South", "value": 28}, {"label": "East", "value": 19}, {"label": "West", "value": 11}]
    unit = v.get("unit", "")
    total = sum(r["value"] for r in rows) or 1
    out = [sc("kinetic-title", 3.0, {"kicker": v.get("kicker") or "The data", "title": accent(v.get("title", "")), "icon": "chart-line"}, "smoothleft")]
    num = house.find_number(v.get("headline_stat", "") or "")
    if num:
        out.append(sc("big-number", 3.8, {"kicker": "Headline", "value": num["value"], "prefix": num["prefix"], "suffix": num["suffix"], "decimals": num["decimals"], "label": accent(v.get("stat_label", ""))}, "zoomin"))
    out.append(sc("bar-race", 4.8, {"kicker": v.get("source", ""), "title": accent(v.get("chart_title") or v.get("title", "")), "items": rows, "unit": unit}, "smoothleft"))
    out.append(sc("donut", 4.4, {"kicker": "Share", "title": f"{rows[0]['label']} *leads*", "parts": [{"label": r["label"], "value": round(r["value"] / total * 100, 1)} for r in rows[:4]], "unit": "%"}, "circleopen"))
    out.append(sc("end-card", 3.0, {"title": accent(v.get("takeaway") or "Numbers tell the story"), "icon": "chart-pie"}, "cut"))
    return out


def b_logo(v: T, a: T) -> list[T]:
    return [sc("logo-reveal", float(v.get("duration") or 4.6), {"logo": one(a.get("logo")), "name": v.get("name", ""), "tagline": accent(v.get("tagline", ""))}, "cut")]


def b_mascot(v: T, a: T) -> list[T]:
    tips = lst(v.get("tips"))[:5] or ["Tip one", "Tip two", "Tip three"]
    name = v.get("mascot_name") or "Bolt"
    intro = [f"Hi! I am {name}.", v.get("title") or "Here are my tips."]
    out = [sc("mascot-talk", 4.4, {"title": v.get("title", ""), "lines": intro}, "smoothleft")]
    for i in range(0, len(tips), 2):
        out.append(sc("mascot-talk", 4.8, {"lines": tips[i:i + 2], "variant": i}, "smoothup"))
    out.append(sc("end-card", 3.0, {"title": accent(v.get("cta") or "Follow for more tips"), "icon": "smile"}, "cut"))
    return out


def b_particles(v: T, a: T) -> list[T]:
    return [sc("particles-type", float(v.get("duration") or 5.0), {"title": v.get("title", "IGNITE"), "subtitle": v.get("subtitle", "")}, "cut")]


def b_short(v: T, a: T) -> list[T]:
    points = lst(v.get("points"))[:4] or ["Point one", "Point two", "Point three"]
    bg = a.get("background") or []
    out = [sc("kinetic-beat", 3.0, {"words": house.keywords(v.get("hook", "Stop scrolling"), 6) or ["Stop", "Scrolling"], "bpm": 128}, "zoomin")]
    for i, p in enumerate(points):
        num = house.find_number(p)
        if num:
            out.append(sc("big-number", 3.0, {"value": num["value"], "prefix": num["prefix"], "suffix": num["suffix"], "label": accent(re.sub(r"\s+", " ", p.replace(num["match"], " ")).strip())}, "slideup"))
        elif bg and i == 0:
            out.append(sc("image-focus", 3.2, {"title": accent(p), "image": bg[0], "variant": 2}, "slideup"))
        else:
            out.append(sc("word-stack", 2.8, {"words": [w.upper() for w in house.keywords(p, 4)] or [p.upper()]}, "slideup"))
    out.append(sc("end-card", 2.8, {"title": accent(v.get("cta") or "Follow for part two"), "cta": "Follow", "icon": "user-plus"}, "cut"))
    return out


TEMPLATES: list[T] = [
    {"id": "app-launch", "name": "App Launch", "category": "Phone", "style": "gradient-product", "aspect": "9:16", "mood": "upbeat", "icon": "smartphone",
     "description": "Logo sting, 3D phone with your screens sliding, beat-synced features, call to action.", "build": b_app,
     "slots": [slot("app_name", "App name", required=True, default="Pocket"), slot("tagline", "Tagline", default="Your money, *finally* calm"), slot("subtitle", "Subtitle", default="Budgets that build themselves."),
               slot("logo", "Logo", "logo"), slot("screens", "Phone screenshots", "images", max=4, help="Portrait screenshots, up to 4"), slot("features", "Features (one per line)", "list", default="Smart budgets\nInstant alerts\nBank-grade security"),
               slot("cta", "Closing line", default="Get *Pocket* today"), slot("cta_button", "Button text", default="Download free")]},
    {"id": "saas-film", "name": "SaaS Product Film", "category": "Product UI", "style": "keynote-light", "aspect": "16:9", "mood": "corporate", "icon": "app-window",
     "description": "Headline, browser hero with camera zoom onto your screenshot, impact stat, feature grid, CTA.", "build": b_saas,
     "slots": [slot("product", "Product name", required=True, default="Northstar"), slot("headline", "Headline", default="See every *metric* live"), slot("screenshot", "Product screenshot", "image", help="Landscape screenshot of your app"),
               slot("url", "Address bar text", default="app.northstar.io"), slot("metric", "Impact stat", default="3x"), slot("metric_label", "Stat label", default="faster *decisions*"),
               slot("features", "Features (one per line)", "list", default="Realtime dashboards\nAI alerts\nSSO and audit logs\nOne-click reports"), slot("cta", "Closing line", default="Start *free* today")]},
    {"id": "showreel", "name": "Motion Showreel", "category": "Kinetic type", "style": "swiss-kinetic", "aspect": "16:9", "mood": "upbeat", "icon": "clapperboard",
     "description": "120 BPM reel: kinetic type on every beat, shape morphs, a 3D moment, particle name, end title.", "build": b_showreel,
     "slots": [slot("name", "Your name or studio", required=True, default="AuteurFrame"), slot("role", "Role", default="Motion design"), slot("words", "Beat words (one per line)", "list", default="Type\nShape\nDepth\nData\nRhythm\nStory"),
               slot("contact", "Contact line", default="hello@studio.com")]},
    {"id": "paper-story", "name": "Paper Cut Story", "category": "Paper cut", "style": "paper-cut", "aspect": "16:9", "mood": "dreamy", "icon": "scissors",
     "description": "Layered paper landscapes with swinging banners, one chapter per scene.", "build": b_paper,
     "slots": [slot("title", "Title", required=True, default="A valley of *light*"), slot("subtitle", "Subtitle", default="where every hill tells a story"),
               slot("chapters", "Chapters (one per line)", "list", default="Once there was a quiet valley.\nThen the river changed its course.\nAnd the village learned to listen."), slot("ending", "Ending", default="The *end*")]},
    {"id": "vox-explainer", "name": "Vox Explainer", "category": "Explainer", "style": "vox-collage", "aspect": "16:9", "mood": "tense", "icon": "newspaper",
     "description": "Collage boards with taped photos, red marker circles, sticky notes, evidence and quotes.", "build": b_vox,
     "slots": [slot("title", "Question or title", required=True, default="Why the *map* lied"), slot("photos", "Archive photos", "images", max=3),
               slot("facts", "Facts (one per line)", "list", default="Drawn in 1569\nGreenland looks 14 times bigger\nSailors needed straight lines"),
               slot("quote", "Quote", default="Every map is a *choice*."), slot("quote_author", "Quote author", default="Mark Monmonier"), slot("answer", "Answer", default="It was built for *sailors*, not truth")]},
    {"id": "photo-memories", "name": "Photo Memories", "category": "Photos", "style": "editorial-paper", "aspect": "9:16", "mood": "dreamy", "icon": "images",
     "description": "Polaroids fly in and stack, slow Ken Burns, handwritten captions, warm ending.", "build": b_photos,
     "slots": [slot("title", "Title", required=True, default="Summer *2026*"), slot("subtitle", "Subtitle", default="Days we will remember"), slot("photos", "Photos", "images", max=9, help="3 to 9 photos"),
               slot("captions", "Captions (one per line)", "list", default="Lisbon\nThe coast\nHome"), slot("closing", "Closing line", default="Until next *summer*"), slot("music", "Music", "audio")]},
    {"id": "music-visualizer", "name": "Music Visualizer", "category": "Music", "style": "neon-night", "aspect": "1:1", "mood": None, "icon": "audio-waveform",
     "description": "Cover art and a spectrum that reacts to the real loudness of your track.", "build": b_music,
     "slots": [slot("track", "Track title", required=True, default="Midnight *Drive*"), slot("artist", "Artist", default="AuteurFrame Sessions"), slot("cover", "Cover art", "image"),
               slot("music", "Audio track", "audio", required=True, help="MP3, WAV or M4A. Up to 60 seconds are used.")]},
    {"id": "code-explainer", "name": "Code Explainer", "category": "Code", "style": "neon-night", "aspect": "16:9", "mood": "minimal", "icon": "code-xml",
     "description": "Syntax-highlighted code types itself, output pops, then the flow draws as a diagram.", "build": b_code,
     "slots": [slot("title", "Title", required=True, default="Render a film in *three* lines"), slot("language", "Language", default="javascript"),
               slot("code", "Code", "textarea", default="import { auteurframe } from 'auteurframe';\n\nconst film = await auteurframe.render({\n  brief: 'Why tides happen',\n  style: 'cosmic-flat',\n});\nconsole.log(film.url);"),
               slot("output", "Output line", default="Rendered 32s master in 41s"), slot("steps", "Flow steps (one per line)", "list", default="Brief\nSwarm\nRender\nMaster")]},
    {"id": "gallery-3d", "name": "3D Gallery", "category": "3D", "style": "gradient-product", "aspect": "16:9", "mood": "cinematic", "icon": "box",
     "description": "Your images on a curved 3D wall with a light wave, a crane-up camera, then glossy 3D forms.", "build": b_3d,
     "slots": [slot("title", "Title", required=True, default="Depth you can *feel*"), slot("subtitle", "Subtitle", default="A collection in three dimensions"), slot("images", "Images", "images", max=12),
               slot("tagline", "Second line", default="Made to *move*"), slot("cta", "Closing line", default="See the *collection*")]},
    {"id": "data-story", "name": "Data Story", "category": "Charts", "style": "data-cinema", "aspect": "16:9", "mood": "cinematic", "icon": "chart-column",
     "description": "Headline stat counts up, bars race in, a donut shows the share, one takeaway.", "build": b_data,
     "slots": [slot("title", "Title", required=True, default="Where the *energy* comes from"), slot("headline_stat", "Headline stat", default="42%"), slot("stat_label", "Stat label", default="now comes from *solar*"),
               slot("data", "Data rows (label: value)", "list", default="Solar: 42\nWind: 28\nHydro: 19\nGas: 11"), slot("unit", "Unit", default="%"), slot("source", "Source", default="Energy report 2026"), slot("takeaway", "Takeaway", default="The sun is *winning*")]},
    {"id": "logo-sting", "name": "Logo Sting", "category": "Shapes", "style": "luxury-serif", "aspect": "16:9", "mood": "cinematic", "icon": "badge",
     "description": "Four shapes converge, an iris opens on your logo, the name assembles letter by letter.", "build": b_logo,
     "slots": [slot("logo", "Logo", "logo"), slot("name", "Brand name", required=True, default="Northwind"), slot("tagline", "Tagline", default="Crafted for *the long road*")]},
    {"id": "mascot-tips", "name": "Mascot Tips", "category": "Characters", "style": "soft-clay", "aspect": "9:16", "mood": "playful", "icon": "smile",
     "description": "A blinking, talking blob character delivers your tips in speech bubbles.", "build": b_mascot,
     "slots": [slot("mascot_name", "Mascot name", default="Bolt"), slot("title", "Topic", required=True, default="Three battery tips"),
               slot("tips", "Tips (one per line)", "list", default="Charge to 80 percent.\nAvoid heat while charging.\nUpdate your phone.\nUse the original cable."), slot("cta", "Closing line", default="Follow for more *tips*")]},
    {"id": "particle-title", "name": "Particle Title", "category": "Particles", "style": "cosmic-flat", "aspect": "16:9", "mood": "dreamy", "icon": "sparkles",
     "description": "Thousands of particles fly in and assemble your title.", "build": b_particles,
     "slots": [slot("title", "Title", required=True, default="IGNITE"), slot("subtitle", "Subtitle", default="Every particle finds its place.")]},
    {"id": "creator-short", "name": "Creator Short", "category": "Kinetic type", "style": "creator-bold", "aspect": "9:16", "mood": "upbeat", "icon": "flame",
     "description": "Hook on the beat, one punchy point per cut, stats that count, follow card.", "build": b_short,
     "slots": [slot("hook", "Hook", required=True, default="Stop charging to 100 percent"), slot("points", "Points (one per line)", "list", default="Lithium hates sitting full\nStop at 80 percent\nIt can last 2 times longer"),
               slot("background", "Background photo", "images", max=1), slot("cta", "Closing line", default="Follow for *part two*")]},
]


from .templates2 import TEMPLATES2

TEMPLATES += TEMPLATES2


def get(tid: str) -> T:
    for t in TEMPLATES:
        if t["id"] == tid:
            return t
    raise KeyError(tid)


def public() -> list[T]:
    return [{k: v for k, v in t.items() if k != "build"} for t in TEMPLATES]


def defaults(t: T) -> T:
    return {s["key"]: s["default"] for s in t["slots"] if s["kind"] in ("text", "textarea", "list")}


def build(t: T, values: T, assets: T, fps: int, shorts: bool) -> list[T]:
    vals = defaults(t)
    vals.update({k: v for k, v in values.items() if v not in (None, "")})
    scenes = t["build"](vals, assets)
    rnd = random.Random(hash(t["id"]) & 0xFFFF)
    out, start = [], 0.0
    for i, s in enumerate(scenes):
        d = round(float(s["duration"]) * (0.9 if shorts and s["archetype"] not in ("music-visualizer",) else 1.0) * fps) / fps
        data = dict(s["data"])
        data.setdefault("variant", rnd.randrange(12))
        out.append({
            "id": f"sc_{i:03d}_{rnd.randrange(16 ** 4):04x}", "index": i, "title": s["title"], "purpose": "template", "start": round(start, 4), "duration": d,
            "narration": "", "onscreen": str(data.get("title", "")), "visual": f"{t['name']} template: {s['archetype']}", "archetype": s["archetype"], "data": data,
            "variant": data["variant"], "code": s.get("code"), "source": "template", "status": "planned", "layers": [], "overrides": {},
            "transition": {"type": "cut" if i == len(scenes) - 1 else s["transition"], "duration": 0.35 if shorts else 0.45},
        })
        start += d
    return out


SAMPLE_FN: dict[str, Callable] = {}


KNOWN_ARCHETYPES = ["kinetic-title", "word-stack", "big-number", "bar-race", "line-chart", "donut", "versus", "timeline", "quote", "list-reveal", "process-flow",
                    "icon-grid", "doodle-explain", "equation", "image-focus", "scale-zoom", "map-pins", "ui-mockup", "lower-third", "end-card", "phone-showcase",
                    "ui-cascade", "code-typing", "shape-morph", "particles-type", "photo-stack", "music-visualizer", "paper-cut", "vox-board", "three-hero",
                    "logo-reveal", "kinetic-beat", "diagram-build", "mascot-talk", "line-art"]
SLOT_KINDS = {"text", "textarea", "list", "image", "images", "logo", "audio"}
PACK_ID = re.compile(r"^[a-z0-9][a-z0-9-]{1,48}$")
SLOT_KEY = re.compile(r"^[a-z][a-z0-9_]{0,31}$")
HOLE = re.compile(r"\{\{\s*([a-z][a-z0-9_]{0,31})(?:\.(\d+))?\s*\}\}")
BUILTIN_IDS: set[str] = {t["id"] for t in TEMPLATES}
UNSAFE_CODE = re.compile(
    r"\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts|\bimport\s*\(|\beval\b|\bFunction\s*\(|\bconstructor\b|"
    r"document\.(cookie|domain|write)|localStorage|sessionStorage|indexedDB|caches\.|serviceWorker|navigator\.|window\.open|\b(top|parent|opener)\s*\.|"
    r"postMessage|\blocation\b|\b(window|self|globalThis|document|frames)\s*\[|\bReflect\b|\batob\s*\(|fromCharCode|\\\\u00|\\\\x[0-9a-f]{2}|"
    r"https?:|wss?:|data:text|javascript:|//[a-z0-9-]+\.[a-z]{2,}|<\s*(iframe|object|embed|link|base|meta|form|img|video|audio|source|script\s+src)\b|"
    r"\bsrcdoc\b|\bon[a-z]+\s*=\s*['\"]|\[\s*['\"`][^'\"`\]]*['\"`]\s*\+",
    re.I)


def _plain_strings(value: Any, where: str) -> None:
    if isinstance(value, dict):
        for k, x in value.items():
            _plain_strings(x, where)
    elif isinstance(value, list):
        for x in value:
            _plain_strings(x, where)
    elif isinstance(value, str) and ("<" in value or ">" in value):
        raise PackError(f"{where} may not contain < or >; use plain text and *asterisks* for accents")


class PackError(ValueError):
    pass


def _text(d: T, key: str, limit: int, required: bool = True) -> str:
    v = d.get(key, "")
    if not isinstance(v, str) or (required and not v.strip()) or len(v) > limit:
        raise PackError(f"{key} must be text up to {limit} characters")
    return v


def validate_pack(d: Any) -> T:
    from . import audio, render, styles
    if not isinstance(d, dict) or d.get("format") != 1:
        raise PackError("format must be 1")
    pid = d.get("id", "")
    if not isinstance(pid, str) or not PACK_ID.match(pid):
        raise PackError("id must be lowercase letters, digits and dashes")
    if pid in BUILTIN_IDS:
        raise PackError(f"id {pid} is used by a built-in template")
    version = d.get("version", 1)
    if not isinstance(version, int) or version < 1:
        raise PackError("version must be a positive integer")
    _text(d, "name", 60)
    _text(d, "category", 30)
    _text(d, "description", 300)
    _text(d, "icon", 40, required=False)
    if d.get("style") not in {s["id"] for s in styles.PACKS}:
        raise PackError("style must be one of the built-in style packs")
    if d.get("aspect") not in styles.ASPECTS:
        raise PackError("aspect must be one of " + ", ".join(styles.ASPECTS))
    if d.get("mood") and d["mood"] not in audio.MOODS:
        raise PackError("mood must be one of " + ", ".join(audio.MOODS))
    slots = d.get("slots") or []
    if not isinstance(slots, list) or len(slots) > 16:
        raise PackError("slots must be a list of up to 16 inputs")
    keys = set()
    for s in slots:
        if not isinstance(s, dict) or not isinstance(s.get("key"), str) or not SLOT_KEY.match(s["key"]) or s["key"] in keys:
            raise PackError("every slot needs a unique key of lowercase letters, digits and underscores")
        if s.get("kind", "text") not in SLOT_KINDS:
            raise PackError(f"slot {s['key']} has an unknown kind")
        _text(s, "label", 60)
        _plain_strings(s, f"slot {s['key']}")
        keys.add(s["key"])
    _plain_strings({k: d.get(k) for k in ("name", "category", "description", "icon", "author")}, "template details")
    scenes = d.get("scenes") or []
    if not isinstance(scenes, list) or not 1 <= len(scenes) <= 20:
        raise PackError("scenes must hold 1 to 20 scenes")
    for i, item in enumerate(scenes):
        if not isinstance(item, dict):
            raise PackError(f"scene {i + 1} must be an object")
        dur = item.get("duration")
        if not isinstance(dur, (int, float)) or not 0.5 <= dur <= 30:
            raise PackError(f"scene {i + 1} duration must be 0.5 to 30 seconds")
        code = item.get("code")
        _plain_strings({k: x for k, x in item.items() if k != "code"}, f"scene {i + 1}")
        if code is not None:
            if not isinstance(code, str) or len(code) > 24000 or '<div class="scene"' not in code or "AU.scene(" not in code:
                raise PackError(f"scene {i + 1} code must be a scene fragment under 24000 characters")
            bad = UNSAFE_CODE.search(code)
            if bad:
                raise PackError(f"scene {i + 1} code uses '{bad.group(0)[:40]}', which templates may not use (no network, storage, navigation, external media or dynamic code)")
        elif item.get("archetype") not in KNOWN_ARCHETYPES:
            raise PackError(f"scene {i + 1} needs a known archetype or code")
        trans = item.get("transition", "fade")
        if trans != "cut" and trans not in render.XFADE:
            raise PackError(f"scene {i + 1} has an unknown transition")
        for name, _ in HOLE.findall(json.dumps(item)):
            if name not in keys and name != "item":
                raise PackError(f"scene {i + 1} uses a placeholder named {name} but no slot has that key")
    return d


def _fill(value: Any, v: T, a: T, item: Any = None, html_safe: bool = False) -> Any:
    if isinstance(value, dict):
        if "$map" in value:
            name = value["$map"]
            src = a.get(name) if name in a else v.get(name)
            items = src if isinstance(src, list) else lst(src)
            items = items[: int(value.get("limit", 12))]
            icons = [str(x) for x in value.get("icons") or [] if isinstance(x, str)] or ["sparkles"]
            out = []
            for i, it in enumerate(items):
                row = _fill(value.get("to", "{{item}}"), v, a, it)
                if isinstance(row, dict) and row.get("icon") == "auto":
                    row["icon"] = house.icon_for(str(it), icons[i % len(icons)])
                out.append(row)
            return out
        return {k: _fill(x, v, a, item, html_safe) for k, x in value.items()}
    if isinstance(value, list):
        return [_fill(x, v, a, item, html_safe) for x in value]
    if not isinstance(value, str):
        return value

    def lookup(name: str, idx: str | None) -> Any:
        if name == "item":
            return item
        if name in a:
            got = a.get(name) or []
            if idx:
                return got[int(idx)] if int(idx) < len(got) else None
            return got[0] if len(got) == 1 else got
        got = v.get(name, "")
        if idx:
            parts = lst(got)
            return parts[int(idx)] if int(idx) < len(parts) else ""
        return got

    whole = HOLE.fullmatch(value.strip())
    if whole and not html_safe:
        return lookup(whole.group(1), whole.group(2))

    def sub(m: re.Match) -> str:
        got = lookup(m.group(1), m.group(2))
        text = ", ".join(map(str, got)) if isinstance(got, list) else ("" if got is None else str(got))
        return html.escape(text) if html_safe else text
    return HOLE.sub(sub, value)


def pack_builder(pack: T) -> Callable[[T, T], list[T]]:
    def build_pack(v: T, a: T) -> list[T]:
        out = []
        for s in pack["scenes"]:
            title = str(_fill(s.get("title", ""), v, a))
            if s.get("code"):
                out.append({"archetype": s.get("archetype", "kinetic-title"), "duration": float(s["duration"]), "data": {"title": title or pack["name"]},
                            "transition": s.get("transition", "fade"), "title": (title or pack["name"])[:60], "code": _fill(s["code"], v, a, html_safe=True)})
            else:
                out.append(sc(s["archetype"], float(s["duration"]), _fill(s.get("data") or {}, v, a), s.get("transition", "fade"), title))
        return out
    return build_pack


def pack_template(pack: T, source: str) -> T:
    slots_ = [slot(s["key"], s["label"], s.get("kind", "text"), bool(s.get("required")), s.get("default", ""), s.get("help", ""), int(s.get("max", 0) or 0))
              for s in pack.get("slots", [])]
    return {"id": pack["id"], "name": pack["name"], "category": pack["category"], "style": pack["style"], "aspect": pack["aspect"], "mood": pack.get("mood", ""),
            "icon": pack.get("icon") or "layout-template", "description": pack["description"], "slots": slots_, "build": pack_builder(pack),
            "version": pack.get("version", 1), "source": source, "author": str(pack.get("author", ""))[:60]}


def load_packs(folders: list[tuple[Any, str]]) -> list[str]:
    best: dict[str, tuple[int, T, str]] = {}
    for folder, source in folders:
        folder = Path(folder)
        if not folder.is_dir():
            continue
        for f in sorted(folder.glob("*.json")):
            try:
                pack = validate_pack(json.loads(f.read_text(encoding="utf-8")))
            except (ValueError, OSError):
                continue
            if pack["id"] not in best or pack.get("version", 1) > best[pack["id"]][0]:
                best[pack["id"]] = (pack.get("version", 1), pack, source)
    TEMPLATES[:] = [t for t in TEMPLATES if t["id"] in BUILTIN_IDS]
    for _, pack, source in sorted(best.values(), key=lambda x: x[1]["name"]):
        TEMPLATES.append(pack_template(pack, source))
    return sorted(best)
