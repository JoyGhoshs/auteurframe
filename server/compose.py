from __future__ import annotations

import hashlib
import json
import re
from typing import Any

from . import config, styles

CSP = (
    "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'none'"
)
MAP_HOSTS = "https://tiles.openfreemap.org https://server.arcgisonline.com https://s3.amazonaws.com https://*.tile.opentopomap.org"
CSP_GL = CSP.replace("img-src 'self' data: blob:", f"img-src 'self' data: blob: {MAP_HOSTS}").replace("connect-src 'self'", f"connect-src 'self' {MAP_HOSTS}") + "; worker-src 'self' blob:"


def gl_map_ids(project: dict[str, Any]) -> set[str]:
    return {a["id"] for a in project.get("assets", []) or [] if a.get("kind") == "map" and (a.get("meta") or {}).get("engine") == "gl"}

EXTERNAL_TAG = re.compile(r"<(script|link|iframe)[^>]+(src|href)\s*=\s*[\"']?(https?:)?//[^>]*>(\s*</\1>)?", re.I)
EXTERNAL_URL = re.compile(r"url\(\s*[\"']?(https?:)?//[^)]*\)", re.I)
IMPORT_RULE = re.compile(r"@import[^;]+;", re.I)


def sanitize_fragment(fragment: str) -> str:
    text = fragment or ""
    text = re.sub(r"(?is)<!doctype[^>]*>|</?(html|head|body)[^>]*>|<meta[^>]*>|<title>.*?</title>", "", text)
    text = EXTERNAL_TAG.sub("", text)
    text = EXTERNAL_URL.sub("none", text)
    text = IMPORT_RULE.sub("", text)
    return text.strip()


def house_fragment(archetype: str) -> str:
    return (
        '<div class="scene ar-root" data-archetype="' + archetype + '"></div>\n'
        "<script>AU.scene(function (ctx) { AU_ARCH.run(" + json.dumps(archetype) + ", ctx); });</script>"
    )


def scene_cues(project: dict[str, Any], scene: dict[str, Any], handle: float = 0.0) -> list[dict[str, Any]]:
    synthetic = project.get("cues_synthetic") or all(c.get("synthetic") for c in (project.get("cues") or [{}]))
    if synthetic and not (project.get("captions") or {}).get("from_narration"):
        return []
    start = float(scene.get("start", 0.0))
    end = start + float(scene.get("duration", 4.0)) + max(0.0, handle)
    out = []
    for i, cue in enumerate(project.get("cues", []) or []):
        cs, ce = float(cue["start"]), float(cue["end"])
        if ce <= start + 0.001 or cs >= end - 0.001:
            continue
        words = []
        for word in cue.get("words") or []:
            wt = float(word.get("t", word.get("start", cs)))
            we = float(word.get("e", word.get("end", wt + 0.3)))
            words.append({"t": round(wt - start, 4), "e": round(we - start, 4), "w": word.get("w", word.get("word", ""))})
        out.append({"id": cue.get("id", i), "start": round(cs - start, 4), "end": round(ce - start, 4), "text": cue.get("text", ""), "words": words})
    return out


def overlay_cues(project: dict[str, Any]) -> list[dict[str, Any]]:
    cap = project.get("captions") or {}
    if cap.get("enabled") is False or not project.get("scenes"):
        return []
    total = sum(float(s["duration"]) for s in project["scenes"])
    return scene_cues(project, {"start": 0.0, "duration": total})


def caption_overlay(project: dict[str, Any]) -> bool:
    return bool(overlay_cues(project))


def build_captions_document(project: dict[str, Any], mode: str = "render") -> str:
    total = round(sum(float(s["duration"]) for s in project["scenes"]), 4)
    fake = {"id": "captions", "start": 0.0, "duration": total, "index": 0, "data": {}, "layers": [], "overrides": {}, "title": "", "narration": ""}
    cfg = scene_config(project, fake, mode, 0.0)
    cfg["cues"] = overlay_cues(project)
    cfg["layers"] = []
    cfg["ground"] = "none"
    cfg["texture"] = "none"
    cfg["captionsOnly"] = True
    return _document(project, cfg, "", house=False, uses_three=False, mode=mode,
                     extra_css="html,body,.au-body,.au-stage,#au-stage,#au-scene{background:transparent!important;background-image:none!important}#au-ground,#au-texture,.au-safe-guide{display:none!important}")


def asset_map(project: dict[str, Any], base: str = "", scene: dict[str, Any] | None = None) -> dict[str, str]:
    out = {}
    used = None
    if scene is not None:
        used = json.dumps([scene.get("code") or "", scene.get("data") or {}, scene.get("layers") or [], scene.get("overrides") or {}], default=str)
    for item in project.get("assets", []) or []:
        if used is not None and item.get("id") not in used and not (item.get("name") and item["name"] in used):
            continue
        url = item.get("url") or f"{base}/media/{project['id']}/assets/{item.get('file')}"
        out[item.get("id")] = url
        if item.get("name"):
            out[item["name"]] = url
    return out


def _lang(project: dict[str, Any]) -> dict[str, Any]:
    from . import fonts
    fi = fonts.info(project)
    return {"lang": fi["lang"], "rtl": fi["rtl"], "scripts": fi["scripts"], "complex": fi["complex"], "cjk": fi["cjk"]}


def scene_config(project: dict[str, Any], scene: dict[str, Any], mode: str = "render", handle: float = 0.0) -> dict[str, Any]:
    width, height = project["width"], project["height"]
    bible = project.get("bible") or styles.build_bible(project.get("style", "editorial-paper"), project.get("seed", 1), width, height)
    caption_cfg = dict(project.get("captions") or {})
    caption_cfg.setdefault("enabled", True)
    caption_cfg.setdefault("style", bible.get("caption", "pop"))
    caption_cfg.setdefault("position", "bottom")
    data = dict(scene.get("data") or {})
    data.setdefault("title", scene.get("title", ""))
    data.setdefault("narration", scene.get("narration", ""))
    data.setdefault("motion", bible.get("motion", {}))
    data.setdefault("variant", scene.get("variant", 0))
    return {
        "W": width, "H": height, "D": round(float(scene.get("duration", 4.0)) + handle, 3), "fps": project.get("fps", 30),
        "seed": int(project.get("seed", 1)) + int(scene.get("index", 0)) * 101 + int(scene.get("reseed", 0)) * 7,
        "mode": mode, "theme": {"palette": bible["palette"], "motion": bible.get("motion", {}), "radius": bible.get("radius"), "dark": bible.get("dark")},
        "cues": scene_cues(project, scene, handle) if caption_cfg.get("enabled", True) and not (mode == "render" and caption_overlay(project)) else [],
        "data": data, "assets": asset_map(project, scene=scene if scene.get("id") != "captions" else {}), "captions": caption_cfg, "layers": scene.get("layers") or [],
        "overrides": scene.get("overrides") or {}, "ground": scene.get("ground") or bible.get("ground", "paper"),
        "texture": scene.get("texture") or bible.get("texture", "grain"), "sceneIndex": scene.get("index", 0),
        "globalStart": scene.get("start", 0.0), "contentDuration": scene.get("duration", 4.0),
        **_lang(project),
        "captionsOn": bool(overlay_cues(project)) and (project.get("captions") or {}).get("position", "bottom") == "bottom",
        **actor_data(project, scene, handle),
        "lens": scene.get("lens") or project.get("lens") or None,
        "camera": scene.get("camera") or None,
    }


_LEVELS: dict[str, tuple[float, list[float]]] = {}


def _asset_levels(project: dict[str, Any], asset: dict[str, Any]) -> list[float]:
    meta = asset.get("meta") or {}
    if meta.get("levels"):
        return meta["levels"]
    from . import audio, voice
    path = config.PROJECTS / project["id"] / "assets" / asset["file"]
    if not path.exists():
        return []
    key = str(path)
    mtime = path.stat().st_mtime
    hit = _LEVELS.get(key)
    if hit and hit[0] == mtime:
        return hit[1]
    try:
        vals = voice.levels_of(audio.load_wav(path)[: int(900 * audio.SR)], 30)
    except Exception:
        vals = []
    _LEVELS[key] = (mtime, vals)
    return vals


def actor_data(project: dict[str, Any], scene: dict[str, Any], handle: float = 0.0) -> dict[str, Any]:
    code = scene.get("code") or ""
    if not any(k in code for k in ("lipsync", "talking-head", "talk")):
        return {}
    assets = {a["id"]: a for a in project.get("assets", []) or []}
    speech: dict[str, Any] = {}
    rigs: dict[str, Any] = {}
    voice_id = (project.get("audio") or {}).get("voice")
    if voice_id in assets:
        vals = _asset_levels(project, assets[voice_id])
        a = int(round(float(scene.get("start", 0)) * 30))
        b = a + int((float(scene.get("duration", 4)) + handle) * 30) + 2
        start, end = float(scene.get("start", 0)), float(scene.get("start", 0)) + float(scene.get("duration", 4)) + handle
        words = [{"t": round(w["t"] - start, 3), "e": round(w.get("e", w["t"] + 0.3) - start, 3)} for c in project.get("cues") or [] for w in (c.get("words") or [])
                 if start <= w["t"] < end]
        speech["voice"] = {"fps": 30, "levels": vals[a:b], "words": words}
    for aid, a in assets.items():
        if aid not in code:
            continue
        if a.get("kind") == "audio":
            meta = a.get("meta") or {}
            speech[aid] = {"fps": 30, "levels": _asset_levels(project, a), "words": [{"t": w["t"], "e": w.get("e", w["t"] + 0.3)} for w in meta.get("words") or []]}
        elif a.get("kind") == "image" and "talking-head" in code:
            rig = (a.get("meta") or {}).get("rig")
            if rig is None:
                try:
                    from . import imaging
                    rig = imaging.rig_asset(project["id"], a) or {}
                except Exception:
                    rig = {}
            if rig:
                rigs[aid] = rig
    return {"speech": speech, "rigs": rigs}


def build_document(project: dict[str, Any], scene: dict[str, Any], mode: str = "render", handle: float = 0.0) -> str:
    width, height = project["width"], project["height"]
    bible = project.get("bible") or styles.build_bible(project.get("style", "editorial-paper"), project.get("seed", 1), width, height)
    cfg = scene_config(project, scene, mode, handle)
    fragment = scene.get("code") or house_fragment(scene.get("archetype") or "kinetic-title")
    fragment = sanitize_fragment(fragment)
    house = "AU_ARCH" in fragment
    layer_comps = {str(L.get("component")) for L in (scene.get("layers") or []) if isinstance(L, dict) and L.get("kind") == "component"}
    uses_three = "three(" in fragment or "THREE" in fragment or "model3d" in fragment or "world3d" in fragment or "figure3d" in fragment or "model-spec" in fragment or (house and (scene.get("archetype") == "three-hero")) \
        or bool(layer_comps & {"model3d", "world3d", "figure3d", "model-spec"})
    uses_gl = any(i in fragment for i in gl_map_ids(project))
    return _document(project, cfg, fragment, house=house, uses_three=uses_three, mode=mode, libs=scene_libs(fragment), uses_gl=uses_gl)


_LIB_CACHE: dict[str, Any] = {}


def library_catalog() -> dict[str, dict[str, Any]]:
    from . import config
    path = config.WEB / "vendor" / "libraries.json"
    key = path.stat().st_mtime if path.exists() else 0
    if _LIB_CACHE.get("key") != key:
        items = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
        _LIB_CACHE.update(key=key, items={x["id"]: x for x in items})
    return _LIB_CACHE["items"]


LIBS_ATTR = re.compile(r"""data-libs\s*=\s*["']([^"']+)["']""")


def declared_libs(fragment: str) -> list[str]:
    m = LIBS_ATTR.search(fragment or "")
    return [n for n in re.split(r"[\s,]+", m.group(1).strip().lower()) if n] if m else []


def scene_libs(fragment: str) -> list[str]:
    cat = library_catalog()
    out = []
    for name in declared_libs(fragment):
        if name in cat and name not in out and name != "three":
            out.append(name)
    return out


def _document(project: dict[str, Any], cfg: dict[str, Any], fragment: str, house: bool, uses_three: bool, mode: str, extra_css: str = "", libs: list[str] | None = None,
              uses_gl: bool = False) -> str:
    width, height = project["width"], project["height"]
    bible = project.get("bible") or styles.build_bible(project.get("style", "editorial-paper"), project.get("seed", 1), width, height)
    theme = styles.theme_css(bible, width, height, cfg.get("scripts"), (cfg.get("captions") or {}).get("font_family")) + extra_css
    cfg_json = json.dumps(cfg, ensure_ascii=False).replace("</", "<\\/")
    guide = '<div class="au-safe-guide"></div>' if mode == "edit" else ""
    parts = [
        f"<!doctype html><html lang=\"{cfg.get('lang', 'en')}\"><head><meta charset=\"utf-8\">",
        f'<meta http-equiv="Content-Security-Policy" content="{CSP_GL if uses_gl else CSP}">',
        f'<meta name="viewport" content="width={width}, height={height}">',
        '<link rel="stylesheet" href="/vendor/fonts.css"><link rel="stylesheet" href="/vendor/fonts-intl.css">',
        '<link rel="stylesheet" href="/vendor/katex/katex.min.css">',
        '<link rel="stylesheet" href="/runtime/auteur.css"><link rel="stylesheet" href="/runtime/components.css">',
        '<link rel="stylesheet" href="/runtime/archetypes.css"><link rel="stylesheet" href="/runtime/archetypes2.css"><link rel="stylesheet" href="/runtime/archetypes3.css">' if house else "",
        f'<style id="au-theme">{theme}</style>',
        '<script src="/vendor/gsap.bundle.js"></script>',
        '<script src="/vendor/rough.js"></script>',
        '<script src="/vendor/katex/katex.min.js"></script>',
        '<script src="/vendor/lucide.js"></script>',
        '<script src="/vendor/three.min.js"></script>' if uses_three or "three" in declared_libs(fragment) else "",
        '<link rel="stylesheet" href="/vendor/maplibre/maplibre-gl.css"><script src="/vendor/maplibre/maplibre-gl.js"></script>' if uses_gl else "",
        "".join(f'<script src="/vendor/lib/{name}.js"></script>' for name in (libs or [])),
        f"<script>window.AU_CONFIG={cfg_json};</script>",
        '<script src="/runtime/auteur.js"></script><script src="/runtime/components.js"></script><script src="/runtime/characters.js"></script><script src="/runtime/models.js"></script><script src="/runtime/documentary.js"></script><script src="/runtime/actors.js"></script><script src="/runtime/lens.js"></script><script src="/runtime/toons.js"></script><script src="/runtime/sets.js"></script><script src="/runtime/world3d.js"></script><script src="/runtime/modelspec.js"></script><script src="/runtime/modellib.js"></script><script src="/runtime/stickman.js"></script><script src="/runtime/animals.js"></script><script src="/runtime/anime.js"></script>',
        '<script src="/runtime/archetypes.js"></script><script src="/runtime/archetypes2.js"></script><script src="/runtime/archetypes3.js"></script>' if house else "",
        "</head><body class=\"au-body\">",
        '<div id="au-stage" class="au-stage">',
        '<div id="au-ground" class="au-ground"></div>',
        '<div id="au-scene">',
        fragment,
        "</div>",
        '<div id="au-user"></div>',
        '<div id="au-captions"></div>',
        '<div id="au-texture" class="au-texture"></div>',
        guide,
        "</div>",
        "<script>AU.boot();</script>",
        "</body></html>",
    ]
    return "\n".join(p for p in parts if p)


_runtime_cache: dict[str, Any] = {"key": None, "sig": ""}


def runtime_signature() -> str:
    from . import config
    runtime = config.WEB / "runtime"
    files = sorted([f for f in runtime.iterdir() if f.is_file() and f.suffix in (".js", ".css")] if runtime.exists() else [])
    files.append(config.ROOT / "renderer" / "src" / "capture.mjs")
    key = tuple((f.stat().st_mtime_ns, f.stat().st_size) for f in files if f.exists())
    if key != _runtime_cache["key"]:
        digest = hashlib.sha1()
        for f in files:
            if f.exists():
                digest.update(f.read_bytes())
        _runtime_cache.update(key=key, sig=digest.hexdigest()[:12])
    return _runtime_cache["sig"]


def document_hash(document: str, fps: int, width: int, height: int) -> str:
    return hashlib.sha1(f"{fps}|{width}x{height}|v2|{runtime_signature()}|".encode() + document.encode("utf-8")).hexdigest()[:16]
