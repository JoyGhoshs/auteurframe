from __future__ import annotations

from typing import Any


def _s(description: str = "", enum: list[str] | None = None) -> dict[str, Any]:
    out: dict[str, Any] = {"type": "string"}
    if description:
        out["description"] = description
    if enum:
        out["enum"] = enum
    return out


def _n(description: str = "") -> dict[str, Any]:
    return {"type": "number", "description": description} if description else {"type": "number"}


def _list(items: dict[str, Any], description: str = "") -> dict[str, Any]:
    out: dict[str, Any] = {"type": "array", "items": items}
    if description:
        out["description"] = description
    return out


def _obj(props: dict[str, Any], required: list[str] | None = None, description: str = "") -> dict[str, Any]:
    out: dict[str, Any] = {"type": "object", "properties": props}
    if required:
        out["required"] = required
    if description:
        out["description"] = description
    return out


SCENE = _obj({
    "title": _s(),
    "purpose": _s(enum=["hook", "context", "evidence", "turn", "payoff", "cta"]),
    "narration": _s("what the voice says in this scene"),
    "duration": _n("seconds"),
    "onscreen": _s("the few words that appear on screen"),
    "visual": _s("concrete visual concept: layout, hero element, motion, camera, hand-off to the next scene"),
    "archetype": _s("closest house archetype"),
    "data": {"type": "object", "description": "fields for that archetype"},
    "transition": _s(enum=["fade", "smoothleft", "slideup", "wipeleft", "circleopen", "zoomin", "fadeblack", "cut"]),
    "technique": _s(enum=["code", "archetype"]),
    "skills": _list(_s(), "skill names from the technique list"),
    "instruments": _list(_s(enum=["components", "character", "3d", "media", "manim", "libraries", "code", "web", "map", "sound", "data", "dialogue", "lens"])),
}, ["title", "narration", "duration", "visual", "archetype"])

DIRECTOR = _obj({"title": _s(), "logline": _s(), "tone": _s(), "scenes": _list(SCENE)}, ["title", "scenes"])

STYLE = _obj({
    "pack": _s("style pack id"),
    "reason": _s(),
    "palette": _obj({k: _s("hex colour") for k in ("bg", "bg-2", "ink", "ink-2", "muted", "accent", "accent-2")}),
    "display_font": _s("font key"),
    "body_font": _s("font key"),
    "display_family": _s("optional exact installed family name"),
    "body_family": _s("optional exact installed family name"),
    "ground": _s(),
    "texture": _s(),
    "caption": _s(enum=["pop", "karaoke", "boxed", "minimal", "typewriter"]),
    "motif": _s(),
    "notes": _s(),
}, ["pack", "palette"])

ART = _obj({
    "motif": _s("one recurring visual device used across scenes"),
    "notes": _s("3-5 short rules for this film's look"),
    "accent": _s("optional hex colour"),
    "caption": _s(enum=["pop", "karaoke", "boxed", "minimal", "typewriter"]),
}, ["motif", "notes"])

CRITIC = _obj({
    "frames": _list(_s(), "one short sentence per frame, as a stranger would describe it"),
    "stranger": _s("what a stranger thinks the scene is about"),
    "reads_clearly": _n("1 to 5"),
    "on_bible": _n("1 to 5"),
    "verdict": _s(enum=["pass", "repair"]),
    "notes": _list(_obj({
        "severity": _s(enum=["P0", "P1", "P2"]),
        "layer": _s("data-layer or element"),
        "time": _n("seconds"),
        "problem": _s(),
        "fix": _s("the change, with numbers"),
    }, ["severity", "problem", "fix"])),
}, ["verdict", "notes"])

QUERIES = _obj({"queries": _list(_s(), "3 precise search queries")}, ["queries"])

FACTS = _obj({"facts": _list(_obj({"claim": _s("short factual sentence with the number or date"), "source": _s("source title"), "url": _s()}, ["claim", "url"]))}, ["facts"])

VOICE = _obj({"voice": _s("voice id from the list"), "why": _s()}, ["voice"])
