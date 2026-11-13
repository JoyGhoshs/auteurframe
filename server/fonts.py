from __future__ import annotations

import json
import re
from functools import lru_cache
from typing import Any

from . import config

LANGUAGES: list[dict[str, Any]] = [
    {"code": "en", "name": "English", "script": "latin"},
    {"code": "bn", "name": "Bangla", "script": "bengali"},
    {"code": "hi", "name": "Hindi", "script": "devanagari"},
    {"code": "mr", "name": "Marathi", "script": "devanagari"},
    {"code": "ne", "name": "Nepali", "script": "devanagari"},
    {"code": "ar", "name": "Arabic", "script": "arabic", "rtl": True},
    {"code": "ur", "name": "Urdu", "script": "arabic", "rtl": True},
    {"code": "fa", "name": "Persian", "script": "arabic", "rtl": True},
    {"code": "he", "name": "Hebrew", "script": "hebrew", "rtl": True},
    {"code": "zh-Hans", "name": "Chinese (Simplified)", "script": "han-sc"},
    {"code": "zh-Hant", "name": "Chinese (Traditional)", "script": "han-tc"},
    {"code": "ja", "name": "Japanese", "script": "japanese"},
    {"code": "ko", "name": "Korean", "script": "korean"},
    {"code": "th", "name": "Thai", "script": "thai"},
    {"code": "ta", "name": "Tamil", "script": "tamil"},
    {"code": "te", "name": "Telugu", "script": "telugu"},
    {"code": "kn", "name": "Kannada", "script": "kannada"},
    {"code": "ml", "name": "Malayalam", "script": "malayalam"},
    {"code": "pa", "name": "Punjabi", "script": "gurmukhi"},
    {"code": "gu", "name": "Gujarati", "script": "gujarati"},
    {"code": "or", "name": "Odia", "script": "oriya"},
    {"code": "si", "name": "Sinhala", "script": "sinhala"},
    {"code": "km", "name": "Khmer", "script": "khmer"},
    {"code": "lo", "name": "Lao", "script": "lao"},
    {"code": "my", "name": "Burmese", "script": "myanmar"},
    {"code": "am", "name": "Amharic", "script": "ethiopic"},
    {"code": "hy", "name": "Armenian", "script": "armenian"},
    {"code": "ka", "name": "Georgian", "script": "georgian"},
    {"code": "ru", "name": "Russian", "script": "cyrillic"},
    {"code": "uk", "name": "Ukrainian", "script": "cyrillic"},
    {"code": "el", "name": "Greek", "script": "greek"},
    {"code": "vi", "name": "Vietnamese", "script": "vietnamese"},
    {"code": "es", "name": "Spanish", "script": "latin"},
    {"code": "fr", "name": "French", "script": "latin"},
    {"code": "de", "name": "German", "script": "latin"},
    {"code": "pt", "name": "Portuguese", "script": "latin"},
    {"code": "it", "name": "Italian", "script": "latin"},
    {"code": "id", "name": "Indonesian", "script": "latin"},
    {"code": "ms", "name": "Malay", "script": "latin"},
    {"code": "tr", "name": "Turkish", "script": "latin"},
    {"code": "sw", "name": "Swahili", "script": "latin"},
    {"code": "tl", "name": "Filipino", "script": "latin"},
]
LANG = {x["code"]: x for x in LANGUAGES}

SCRIPT_RANGES = [
    ("bengali", r"[\u0980-\u09FF]"), ("devanagari", r"[\u0900-\u0963\u0966-\u097F]"), ("arabic", r"[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]"),
    ("hebrew", r"[\u0590-\u05FF\uFB1D-\uFB4F]"), ("thai", r"[\u0E00-\u0E7F]"), ("lao", r"[\u0E80-\u0EFF]"), ("myanmar", r"[\u1000-\u109F]"),
    ("khmer", r"[\u1780-\u17FF]"), ("tamil", r"[\u0B80-\u0BFF]"), ("telugu", r"[\u0C00-\u0C7F]"), ("kannada", r"[\u0C80-\u0CFF]"),
    ("malayalam", r"[\u0D00-\u0D7F]"), ("gurmukhi", r"[\u0A00-\u0A7F]"), ("gujarati", r"[\u0A80-\u0AFF]"), ("oriya", r"[\u0B00-\u0B7F]"),
    ("sinhala", r"[\u0D80-\u0DFF]"), ("ethiopic", r"[\u1200-\u137F]"), ("armenian", r"[\u0530-\u058F]"), ("georgian", r"[\u10A0-\u10FF]"),
    ("japanese", r"[\u3040-\u30FF]"), ("korean", r"[\uAC00-\uD7AF\u1100-\u11FF]"), ("han-sc", r"[\u4E00-\u9FFF\u3400-\u4DBF]"),
    ("cyrillic", r"[\u0400-\u04FF]"), ("greek", r"[\u0370-\u03FF]"), ("vietnamese", r"[\u1EA0-\u1EF9\u01A0\u01A1\u01AF\u01B0]"),
]
RTL_SCRIPTS = {"arabic", "hebrew"}
INDIC = {"bengali", "devanagari", "tamil", "telugu", "kannada", "malayalam", "gurmukhi", "gujarati", "oriya", "sinhala", "myanmar", "khmer", "lao", "thai"}
CJK = {"han-sc", "han-tc", "japanese", "korean"}

STACKS: dict[str, dict[str, list[str]]] = {
    "bengali": {"sans": ["Hind Siliguri", "Anek Bangla", "Noto Sans Bengali"], "serif": ["Tiro Bangla", "Noto Serif Bengali"], "display": ["Baloo Da 2", "Anek Bangla", "Hind Siliguri"], "hand": ["Galada", "Atma"]},
    "devanagari": {"sans": ["Mukta", "Hind", "Noto Sans Devanagari"], "serif": ["Tiro Devanagari Hindi", "Noto Sans Devanagari"], "display": ["Baloo 2", "Rozha One", "Mukta"], "hand": ["Baloo 2"]},
    "arabic": {"sans": ["Cairo", "Tajawal", "Noto Sans Arabic"], "serif": ["Amiri", "Noto Naskh Arabic"], "display": ["Reem Kufi", "Lalezar", "Cairo"], "hand": ["Lalezar", "Cairo"]},
    "hebrew": {"sans": ["Heebo", "Rubik"], "serif": ["Frank Ruhl Libre"], "display": ["Rubik", "Heebo"], "hand": ["Rubik"]},
    "thai": {"sans": ["Prompt", "Sarabun", "Noto Sans Thai"], "serif": ["Sarabun", "Noto Sans Thai"], "display": ["Kanit", "Prompt"], "hand": ["Kanit"]},
    "han-sc": {"sans": ["Noto Sans SC"], "serif": ["Noto Sans SC"], "display": ["ZCOOL KuaiLe", "Noto Sans SC"], "hand": ["ZCOOL KuaiLe"]},
    "han-tc": {"sans": ["Noto Sans TC"], "serif": ["Noto Sans TC"], "display": ["Noto Sans TC"], "hand": ["Noto Sans TC"]},
    "japanese": {"sans": ["Noto Sans JP"], "serif": ["Noto Sans JP"], "display": ["M PLUS Rounded 1c", "Noto Sans JP"], "hand": ["M PLUS Rounded 1c"]},
    "korean": {"sans": ["Noto Sans KR"], "serif": ["Noto Sans KR"], "display": ["Black Han Sans", "Noto Sans KR"], "hand": ["Noto Sans KR"]},
    "cyrillic": {"sans": ["Montserrat", "Roboto", "Noto Sans"], "serif": ["Lora", "Noto Serif"], "display": ["Oswald", "Montserrat"], "hand": ["Lobster", "Pacifico"]},
    "greek": {"sans": ["Roboto", "Noto Sans"], "serif": ["Noto Serif"], "display": ["Roboto", "Noto Sans"], "hand": ["Noto Sans"]},
    "vietnamese": {"sans": ["Montserrat", "Lexend", "Noto Sans"], "serif": ["Lora", "Noto Serif"], "display": ["Oswald", "Barlow Condensed"], "hand": ["Lobster", "Pacifico"]},
}
for _s, _f in (("tamil", "Noto Sans Tamil"), ("telugu", "Noto Sans Telugu"), ("kannada", "Noto Sans Kannada"), ("malayalam", "Noto Sans Malayalam"),
               ("gurmukhi", "Noto Sans Gurmukhi"), ("gujarati", "Noto Sans Gujarati"), ("oriya", "Noto Sans Oriya"), ("sinhala", "Noto Sans Sinhala"),
               ("khmer", "Noto Sans Khmer"), ("lao", "Noto Sans Lao"), ("myanmar", "Noto Sans Myanmar"), ("ethiopic", "Noto Sans Ethiopic"),
               ("armenian", "Noto Sans Armenian"), ("georgian", "Noto Sans Georgian")):
    STACKS[_s] = {"sans": [_f], "serif": [_f], "display": [_f], "hand": [_f]}

KEY_CATEGORY = {
    "inter": "sans", "grotesk": "sans", "fraunces": "serif", "bricolage": "sans", "mono": "sans", "dmserif": "serif", "instrument": "serif",
    "archivo": "display", "bebas": "display", "caveat": "hand", "marker": "hand", "syne": "display", "unbounded": "display", "playfair": "serif",
    "pixel": "display", "manrope": "sans", "anton": "display", "dmsans": "sans", "newsreader": "serif", "kalam": "hand", "spacemono": "sans",
    "shoulders": "display",
}
FALLBACK_ORDER = ["bengali", "devanagari", "arabic", "hebrew", "thai", "tamil", "telugu", "kannada", "malayalam", "gurmukhi", "gujarati", "oriya",
                  "sinhala", "khmer", "lao", "myanmar", "ethiopic", "armenian", "georgian", "japanese", "korean", "han-sc", "han-tc", "cyrillic", "greek"]


@lru_cache(maxsize=1)
def catalog() -> list[dict[str, Any]]:
    path = config.WEB / "vendor" / "fonts-catalog.json"
    items = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
    base = config.WEB / "vendor" / "fonts.json"
    names = {x["family"] for x in items}
    if base.exists():
        for fam in json.loads(base.read_text(encoding="utf-8")):
            if fam not in names:
                items.append({"family": fam, "category": "display" if fam in ("Anton", "Bebas Neue", "Archivo Black", "Unbounded Variable", "Syne Variable", "Big Shoulders Display Variable", "Press Start 2P")
                              else "serif" if any(k in fam for k in ("Serif", "Fraunces", "Playfair", "Newsreader")) else "hand" if fam in ("Caveat Variable", "Kalam", "Permanent Marker") else "sans",
                              "scripts": ["latin"], "weights": [100, 900] if "Variable" in fam else [400, 400], "files": 2})
    return items


def families() -> set[str]:
    return {x["family"] for x in catalog()}


def detect_scripts(text: str) -> list[str]:
    found = []
    for name, pattern in SCRIPT_RANGES:
        if re.search(pattern, text or ""):
            found.append(name)
    if "japanese" in found and "han-sc" in found:
        found.remove("han-sc")
    return found


def project_text(project: dict[str, Any]) -> str:
    parts = [project.get("brief", ""), project.get("title", "")]
    parts += [c.get("text", "") for c in (project.get("cues") or [])[:400]]
    for s in project.get("scenes") or []:
        parts.append(s.get("narration", ""))
        parts.append(json.dumps(s.get("data") or {}, ensure_ascii=False))
        parts += [L.get("text", "") for L in s.get("layers") or [] if isinstance(L, dict)]
    return " ".join(p for p in parts if isinstance(p, str))


def language_of(project: dict[str, Any]) -> str:
    code = (project.get("options") or {}).get("language") or "auto"
    if code in LANG and code != "en":
        return code
    scripts = detect_scripts(project_text(project))
    for s in scripts:
        if s in ("cyrillic", "greek", "vietnamese"):
            continue
        match = next((x["code"] for x in LANGUAGES if x["script"] == s), None)
        if match:
            return match
    return code if code in LANG else "en"


def scripts_for(project: dict[str, Any]) -> list[str]:
    lang = language_of(project)
    primary = LANG.get(lang, {}).get("script", "latin")
    found = detect_scripts(project_text(project))
    out = [primary] if primary != "latin" else []
    out += [s for s in found if s not in out]
    return out


def quote(name: str) -> str:
    return "'" + name.replace("'", "") + "'"


def stack_for(latin_stack: str, category: str, scripts: list[str], override: str | None = None) -> str:
    names: list[str] = []
    if override:
        names.append(override)
    for s in scripts:
        names += STACKS.get(s, {}).get(category, [])
    for s in FALLBACK_ORDER:
        names += STACKS.get(s, {}).get("sans", [])[-1:]
    seen, out = set(), []
    for n in names:
        if n not in seen:
            seen.add(n)
            out.append(quote(n))
    head = (quote(override) + ", ") if override and override not in latin_stack else ""
    tail = ", ".join(q for q in out if q.strip("'") != override)
    generic = ""
    m = re.search(r",\s*(serif|sans-serif|monospace|cursive|system-ui)\s*$", latin_stack)
    base = latin_stack[: m.start()] if m else latin_stack
    if m:
        generic = ", " + m.group(1)
    return head + base + (", " + tail if tail else "") + generic


def info(project: dict[str, Any]) -> dict[str, Any]:
    lang = language_of(project)
    scripts = scripts_for(project)
    return {"lang": lang, "scripts": scripts, "rtl": bool(LANG.get(lang, {}).get("rtl")) or any(s in RTL_SCRIPTS for s in scripts[:1]),
            "complex": any(s in INDIC or s in RTL_SCRIPTS for s in scripts), "cjk": any(s in CJK for s in scripts)}


def describe_for_agents(scripts: list[str]) -> str:
    rows = []
    wanted = set(scripts) | {"latin"}
    for f in catalog():
        if wanted & set(f.get("scripts", [])) or (not scripts and "latin" in f.get("scripts", [])):
            rows.append(f"{f['family']} ({f['category']}, {'/'.join(f['scripts'])})")
    return "; ".join(rows[:80])
