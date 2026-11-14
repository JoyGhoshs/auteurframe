from __future__ import annotations

import math
from typing import Any

FIELDS = ("exposure", "contrast", "saturation", "temperature", "tint", "split", "lift", "gamma", "gain", "fade", "vignette", "grain", "sharpen", "bw")
RANGE = (-100.0, 100.0)

PRESETS: dict[str, dict[str, Any]] = {
    "none": {"label": "No grade", "values": {}},
    "clean": {"label": "Clean", "values": {"contrast": 6, "saturation": 6}},
    "vivid": {"label": "Vivid pop", "values": {"contrast": 14, "saturation": 30, "exposure": 3}},
    "warm-film": {"label": "Warm film", "values": {"temperature": 28, "contrast": 10, "saturation": -6, "fade": 18, "grain": 18, "vignette": 22}},
    "teal-orange": {"label": "Teal and orange", "values": {"contrast": 16, "saturation": 10, "split": 60, "temperature": 6, "vignette": 18}},
    "golden-hour": {"label": "Golden hour", "values": {"temperature": 42, "tint": 8, "exposure": 4, "contrast": 8, "saturation": 12, "fade": 8}},
    "cool-night": {"label": "Cool night", "values": {"temperature": -38, "tint": -6, "exposure": -8, "contrast": 14, "saturation": -12, "vignette": 30}},
    "cyberpunk": {"label": "Neon cyberpunk", "values": {"temperature": -18, "tint": 34, "contrast": 20, "saturation": 26, "split": 24, "lift": -10, "vignette": 26}},
    "bleach-bypass": {"label": "Bleach bypass", "values": {"contrast": 34, "saturation": -48, "exposure": -2, "grain": 14, "vignette": 20}},
    "vintage": {"label": "Vintage print", "values": {"temperature": 22, "saturation": -24, "contrast": -6, "fade": 34, "grain": 30, "vignette": 30}},
    "matte": {"label": "Soft matte", "values": {"contrast": -8, "fade": 30, "saturation": -8}},
    "documentary": {"label": "Documentary", "values": {"contrast": 12, "saturation": -18, "temperature": 8, "grain": 12, "vignette": 16}},
    "pastel": {"label": "Pastel", "values": {"exposure": 8, "contrast": -14, "saturation": -14, "fade": 22, "tint": 6}},
    "noir": {"label": "Noir black and white", "values": {"bw": 100, "contrast": 30, "grain": 22, "vignette": 34}},
    "kodak-day": {"label": "Bright day stock", "values": {"temperature": 12, "contrast": 12, "saturation": 16, "gain": 10, "split": 14, "grain": 8}},
    "stop-motion": {"label": "Stop-motion warmth", "values": {"temperature": 18, "contrast": 6, "saturation": 8, "fade": 10, "grain": 16, "vignette": 26}},
}

STYLE_DEFAULTS = {
    "editorial-paper": "clean", "vox-collage": "warm-film", "cosmic-flat": "clean", "swiss-kinetic": "none", "neon-night": "cyberpunk",
    "whiteboard-doodle": "none", "blueprint": "clean", "risograph": "none", "math-stage": "none", "keynote-light": "clean",
    "data-cinema": "teal-orange", "brutalist": "none", "soft-clay": "pastel", "retro-pixel": "none", "luxury-serif": "warm-film",
    "gradient-product": "vivid", "creator-bold": "vivid", "paper-cut": "stop-motion", "documentary": "documentary",
}


def _num(v: Any) -> float:
    try:
        x = float(v)
    except (TypeError, ValueError):
        return 0.0
    if math.isnan(x) or math.isinf(x):
        return 0.0
    return max(RANGE[0], min(RANGE[1], x))


def normalize(spec: Any) -> dict[str, Any] | None:
    if not isinstance(spec, dict):
        return None
    preset = str(spec.get("preset") or "none")
    if preset not in PRESETS:
        preset = "none"
    values = dict(PRESETS[preset]["values"])
    for k in FIELDS:
        if k in spec and spec[k] is not None:
            values[k] = _num(spec[k])
    amount = spec.get("amount", 100)
    try:
        amount = max(0.0, min(100.0, float(amount)))
    except (TypeError, ValueError):
        amount = 100.0
    scaled = {k: round(_num(v) * amount / 100.0, 3) for k, v in values.items() if abs(_num(v)) > 1e-6}
    return {"preset": preset, "amount": amount, "values": scaled}


def is_identity(g: dict[str, Any] | None) -> bool:
    return not g or not any(abs(v) > 1e-6 for v in (g.get("values") or {}).values())


def ffmpeg_chain(spec: Any, width: int = 1920, height: int = 1080) -> str:
    g = spec if isinstance(spec, dict) and "values" in spec else normalize(spec)
    if is_identity(g):
        return ""
    v = g["values"]
    out: list[str] = []
    if v.get("exposure"):
        out.append(f"exposure=exposure={v['exposure'] / 100 * 1.2:.4f}")
    t = v.get("temperature", 0)
    if t:
        out.append(f"colortemperature=temperature={max(1000, min(40000, 6500 - t * 44)):.0f}:mix={min(1.0, 0.35 + abs(t) / 160):.3f}:pl=0.6")
    rs = gs = bs = rm = gm = bm = rh = gh = bh = 0.0
    lift, gamma, gain, tint, split = v.get("lift", 0), v.get("gamma", 0), v.get("gain", 0), v.get("tint", 0), v.get("split", 0)
    if lift:
        k = lift / 100 * 0.2
        rs, gs, bs = k, k, k
    if gain:
        k = gain / 100 * 0.18
        rh, gh, bh = k, k, k
    if gamma:
        k = gamma / 100 * 0.12
        rm, gm, bm = k, k, k
    if split:
        k = split / 100
        rs, gs, bs = rs - k * 0.12, gs + k * 0.03, bs + k * 0.16
        rh, gh, bh = rh + k * 0.14, gh + k * 0.04, bh - k * 0.12
    if tint:
        k = tint / 100 * 0.16
        rm += k * 0.5
        gm -= k
        bm += k * 0.5
    if any(abs(x) > 1e-6 for x in (rs, gs, bs, rm, gm, bm, rh, gh, bh)):
        c = lambda x: f"{max(-1.0, min(1.0, x)):.4f}"
        out.append(f"colorbalance=rs={c(rs)}:gs={c(gs)}:bs={c(bs)}:rm={c(rm)}:gm={c(gm)}:bm={c(bm)}:rh={c(rh)}:gh={c(gh)}:bh={c(bh)}:pl=1")
    contrast, sat = v.get("contrast", 0), v.get("saturation", 0)
    if v.get("bw"):
        sat = -100 * min(1.0, v["bw"] / 100) + sat * (1 - min(1.0, v["bw"] / 100))
    if contrast or sat:
        out.append(f"eq=contrast={1 + contrast / 100 * 0.6:.4f}:saturation={max(0.0, 1 + sat / 100):.4f}")
    fade = v.get("fade", 0)
    if fade > 0:
        lo = fade / 100 * 0.16
        hi = 1 - fade / 100 * 0.04
        out.append(f"curves=all='0/{lo:.4f} 0.5/{0.5 + lo * 0.25:.4f} 1/{hi:.4f}'")
    if v.get("sharpen", 0) > 0:
        out.append(f"unsharp=5:5:{v['sharpen'] / 100 * 1.2:.3f}:5:5:0")
    if v.get("vignette", 0) > 0:
        out.append(f"vignette=angle={math.pi / 7 + v['vignette'] / 100 * math.pi / 4:.4f}")
    if v.get("grain", 0) > 0:
        out.append(f"noise=c0s={v['grain'] / 100 * 16:.2f}:c0f=t+u:c1s=0:c2s=0")
    return ",".join(out)


def css_filter(spec: Any) -> dict[str, Any]:
    g = spec if isinstance(spec, dict) and "values" in spec else normalize(spec)
    if is_identity(g):
        return {"filter": "", "vignette": 0, "tint": None}
    v = g["values"]
    parts = []
    if v.get("exposure"):
        parts.append(f"brightness({1 + v['exposure'] / 100 * 0.7:.3f})")
    if v.get("contrast"):
        parts.append(f"contrast({1 + v['contrast'] / 100 * 0.6:.3f})")
    sat = v.get("saturation", 0)
    if v.get("bw"):
        parts.append(f"grayscale({min(1.0, v['bw'] / 100):.2f})")
    if sat:
        parts.append(f"saturate({max(0.0, 1 + sat / 100):.3f})")
    t = v.get("temperature", 0)
    if t > 0:
        parts.append(f"sepia({min(0.6, t / 100 * 0.45):.3f})")
    if v.get("fade", 0) > 0:
        parts.append(f"contrast({1 - v['fade'] / 100 * 0.18:.3f}) brightness({1 + v['fade'] / 100 * 0.06:.3f})")
    tint = None
    tv = v.get("tint", 0)
    if t < 0 and -t >= abs(tv):
        tint = f"rgba(60,120,255,{min(0.22, -t / 100 * 0.2):.3f})"
    elif tv:
        tint = f"rgba(255,60,200,{min(0.18, abs(tv) / 100 * 0.15):.3f})" if tv > 0 else f"rgba(60,255,120,{min(0.18, abs(tv) / 100 * 0.15):.3f})"
    return {"filter": " ".join(parts), "vignette": v.get("vignette", 0), "tint": tint}


def describe() -> list[dict[str, Any]]:
    return [{"id": k, "label": p["label"], "values": p["values"]} for k, p in PRESETS.items()]


def scene_grade(project: dict[str, Any], scene: dict[str, Any]) -> dict[str, Any] | None:
    sg = scene.get("grade")
    if isinstance(sg, dict) and sg:
        return normalize(sg)
    return None


def film_grade(project: dict[str, Any]) -> dict[str, Any] | None:
    return normalize(project.get("grade")) if isinstance(project.get("grade"), dict) else None


MOOD_WORDS = [
    (("noir", "black and white", "monochrome", "1940s", "detective"), "noir"),
    (("night", "neon", "cyber", "hacker", "midnight", "club"), "cyberpunk"),
    (("horror", "scary", "zombie", "dark", "spooky", "thriller", "spy", "cold war", "surveillance"), "cool-night"),
    (("sunset", "golden", "summer", "beach", "romance", "warm"), "golden-hour"),
    (("vintage", "retro", "history", "historical", "archive", "old film", "1960s", "1970s", "war"), "vintage"),
    (("documentary", "investigation", "true story", "news"), "documentary"),
    (("action", "blockbuster", "epic", "battle", "trailer", "hero", "lightning", "laboratory", "lab", "electric", "sci-fi", "science fiction", "explosion"), "teal-orange"),
    (("felt", "stop-motion", "stop motion", "claymation", "clay", "handmade", "paper craft"), "stop-motion"),
    (("kids", "children", "cute", "pastel", "soft", "baby"), "pastel"),
    (("product", "launch", "app", "startup", "saas", "ad", "promo", "commercial"), "vivid"),
]


def choose_for(project: dict[str, Any]) -> tuple[dict[str, Any], str]:
    import re
    brief = f"{project.get('title', '')} {project.get('brief', '')}".lower()
    for words, preset in MOOD_WORDS:
        hit = next((w for w in words if re.search(r"(?<![a-z])" + re.escape(w) + r"(?![a-z])", brief)), None)
        if hit:
            return {"preset": preset, "amount": 85}, f"brief mentions '{hit}'"
    preset = STYLE_DEFAULTS.get(project.get("style", ""), "clean")
    return {"preset": preset, "amount": 80}, f"default grade for the {project.get('style', '')} style"
