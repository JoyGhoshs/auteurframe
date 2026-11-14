from __future__ import annotations

import base64
import io
import os
import re
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops, ImageDraw, ImageStat

LINT_RULES = [
    (r"\bsetTimeout\s*\(|\bsetInterval\s*\(", "timer", "Remove setTimeout/setInterval. Put the motion on tl at an absolute time, or use AU.onFrame((t)=>...)."),
    (r"\brequestAnimationFrame\s*\(", "raf", "Remove requestAnimationFrame. The renderer seeks time; use AU.onFrame((t)=>...)."),
    (r"\bDate\.now\s*\(|new Date\s*\(\s*\)|performance\.now\s*\(", "clock", "Do not read the wall clock. Derive everything from tl time or the t passed to AU.onFrame."),
    (r"https?://", "external-url", "No external URLs. Use AU.icon(), CSS shapes, inline SVG, or project assets through AU.asset(name)."),
    (r"\bfetch\s*\(|XMLHttpRequest|import\s*\(", "network", "No network access inside scenes."),
    (r"\.play\s*\(\s*\)", "autoplay", "Never call tl.play(); the timeline must stay paused for seeking."),
    (r"@keyframes", "css-keyframes", "Prefer tl tweens over CSS @keyframes; if kept, give them no infinite random delays."),
    (r"\bdocument\.write\b|\beval\s*\(", "unsafe", "Remove document.write and eval."),
    (r"\bwindow\s*\.\s*(top|parent|opener|frameElement)\b|(?<![\w.$])(top|parent|opener)\s*\.\s*(location|document|fetch|AU|postMessage|frames|open|eval|XMLHttpRequest|localStorage|sessionStorage|window)\b|"
     r"\bwindow\.open\s*\(|sendBeacon|\bWebSocket\b|\bEventSource\b|document\.cookie|localStorage|sessionStorage|indexedDB|"
     r"\b(window|document|self|globalThis)\.location\b|\blocation\s*\.\s*(href|assign|replace)|/api/",
     "unsafe", "Scenes may not reach outside their own frame: no parent/top/opener, window.open, location changes, storage, sockets or /api/ calls."),
]


def lint(code: str) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    if not code or "AU.scene" not in code:
        issues.append({"kind": "contract", "severity": "P0", "message": "Missing AU.scene(ctx => {...}) registration.", "fix": "Wrap all animation in AU.scene(({ tl, $, W, H, D }) => { ... })."})
        return issues
    script = " ".join(re.findall(r"(?is)<script[^>]*>(.*?)</script>", code))
    for pattern, kind, fix in LINT_RULES:
        target = code if kind == "external-url" else script
        if kind == "external-url":
            target = re.sub(r"xmlns(:\w+)?=\"http://www\.w3\.org/[^\"]+\"", "", target)
        if re.search(pattern, target):
            issues.append({"kind": kind, "severity": "P0" if kind in ("timer", "raf", "clock", "network", "autoplay", "unsafe") else "P1", "message": f"Found forbidden pattern: {kind}", "fix": fix})
    eases = re.findall(r"ease\s*:\s*['\"]([^'\"]+)['\"]", script)
    if len(eases) >= 6:
        top = max(set(eases), key=eases.count)
        if eases.count(top) / len(eases) > 0.7:
            issues.append({"kind": "ease-monoculture", "severity": "P2", "message": f"{eases.count(top)} of {len(eases)} tweens use {top}.", "fix": "Vary eases by role: landings au.softLand, accents au.snapSettle or au.pop, exits au.exit, ambient au.drift."})
        bouncy = sum(1 for e in eases if re.search(r"back|elastic|bounce|au\.pop", e))
        if bouncy / len(eases) > 0.34:
            issues.append({"kind": "overshoot", "severity": "P2", "message": f"{bouncy} of {len(eases)} tweens overshoot.", "fix": "Keep overshoot for one or two accent moments; use au.softLand elsewhere."})
    blurs = [int(b) for b in re.findall(r"blur\(\s*(\d+)px", code)]
    if any(b > 24 for b in blurs) or "backdrop-filter" in code:
        issues.append({"kind": "heavy-blur", "severity": "P1", "message": f"Large blur filters ({max(blurs) if blurs else 'backdrop'}px) make every frame 10x slower to render.",
                       "fix": "Replace big blurs with radial-gradient(closest-side, colour, transparent) glows; keep filter blur at 24px or less and only on small elements or brief transitions."})
    if "data-layer" not in code:
        issues.append({"kind": "layers", "severity": "P2", "message": "No data-layer attributes.", "fix": "Add data-layer=\"name\" to every element that animates so the editor and QA can address it."})
    if re.search(r"typewrite\(\s*['\"]\.?(title|headline|h1)", script):
        issues.append({"kind": "typewriter-headline", "severity": "P2", "message": "Typewriter on a headline reads slowly.", "fix": "Use a masked line rise or word stagger for headlines."})
    return issues


MOTION_CALLS = re.compile(r"\b(?:tl\.(?:to|from|fromTo|set|add|call)|draw|split|counter|camera|onFrame|ambient|particles|typewrite|scramble|chart\.\w+|three|rough|math|component)\s*\(")


def validate_fragment(code: str) -> list[str]:
    import subprocess
    import tempfile
    from . import config
    problems: list[str] = []
    if not code or not code.strip():
        return ["The reply contained no html code block."]
    if not re.search(r"<div[^>]*class=[\"'][^\"']*\bscene\b", code):
        problems.append("There is no root <div class=\"scene\"> element.")
    scripts = re.findall(r"(?is)<script[^>]*>(.*?)</script>", code)
    if "<script" in code and not scripts:
        problems.append("The <script> block is not closed; the reply was cut off. Write a shorter, complete fragment.")
    script = "\n".join(scripts)
    if "AU.scene" not in script:
        problems.append("The script does not call AU.scene(({ tl, ... }) => { ... }).")
    elif not MOTION_CALLS.findall(script):
        problems.append("The script has no motion: put tweens on tl (tl.fromTo/tl.to) or drive libraries from onFrame((t) => ...).")
    markup = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", code)
    prose = re.sub(r"<[^>]+>", " ", markup)
    prose = re.sub(r"\s+", " ", prose).strip()
    if len(prose) > 700:
        problems.append(f"The markup contains {len(prose)} characters of plain text, which looks like planning notes. Put only short on-screen words in the markup.")
    if re.search(r"(?m)^\s*(Let me|Let's|I will|I'll|Now,|Hmm|Actually|Okay|First,)\b", markup):
        problems.append("The fragment contains planning prose. Output only the final code.")
    if script.strip():
        import shutil
        work = tempfile.mkdtemp(prefix="auteur-check-")
        try:
            Path(work, "package.json").write_text('{"name": "auteur-scene-check", "private": true, "type": "commonjs"}', encoding="utf-8")
            path = os.path.join(work, "scene.js")
            Path(path).write_text(script, encoding="utf-8")
            proc = subprocess.run([config.NODE, "--check", path], capture_output=True, text=True, timeout=20, cwd=work)
            if proc.returncode != 0 and "SyntaxError" in proc.stderr:
                lines = [l for l in proc.stderr.splitlines() if l.strip() and not l.startswith("    at ") and "node:internal" not in l]
                problems.append("JavaScript syntax error: " + " ".join(lines[-4:])[:400])
        except (OSError, subprocess.SubprocessError):
            pass
        finally:
            shutil.rmtree(work, ignore_errors=True)
    return problems


def decode(jpeg_b64: str) -> Image.Image:
    return Image.open(io.BytesIO(base64.b64decode(jpeg_b64))).convert("L")


def motion_energy(shots: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    prev = None
    for shot in shots:
        img = decode(shot["jpeg"]).resize((160, 90))
        if prev is not None:
            diff = ImageChops.difference(img, prev[1])
            energy = ImageStat.Stat(diff).mean[0]
            out.append({"t0": prev[0], "t1": shot["t"], "energy": round(energy, 3)})
        prev = (shot["t"], img)
    return out


def contact_sheet(shots: list[dict[str, Any]], cols: int = 3, width: int = 1200) -> str:
    imgs = [Image.open(io.BytesIO(base64.b64decode(s["jpeg"]))).convert("RGB") for s in shots]
    if not imgs:
        return ""
    w0, h0 = imgs[0].size
    cell_w = width // cols
    cell_h = int(cell_w * h0 / w0)
    rows = (len(imgs) + cols - 1) // cols
    sheet = Image.new("RGB", (cell_w * cols, cell_h * rows), "white")
    draw = ImageDraw.Draw(sheet)
    for i, (img, shot) in enumerate(zip(imgs, shots)):
        x, y = (i % cols) * cell_w, (i // cols) * cell_h
        sheet.paste(img.resize((cell_w - 4, cell_h - 4)), (x + 2, y + 2))
        draw.rectangle([x + 6, y + 6, x + 74, y + 26], fill="black")
        draw.text((x + 10, y + 9), f"t={shot['t']:.1f}s", fill="white")
    buf = io.BytesIO()
    sheet.save(buf, "JPEG", quality=78)
    return base64.b64encode(buf.getvalue()).decode()


def evaluate(probe: dict[str, Any], duration: float, lint_issues: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    report = probe.get("report") or {}
    issues: list[dict[str, Any]] = list(lint_issues or [])
    for err in (report.get("errors") or [])[:6]:
        issues.append({"kind": "runtime-error", "severity": "P0", "message": err[:240], "fix": "Fix the JavaScript error; the scene must run without exceptions."})
    for log in (probe.get("logs") or [])[:4]:
        if "favicon" in log:
            continue
        if "Content Security Policy" in log or "request failed" in log:
            issues.append({"kind": "blocked-request", "severity": "P1", "message": log[:200], "fix": "Remove the external or missing resource."})
    seen = set()
    for frame in report.get("frames", []):
        for item in frame.get("issues", []):
            key = (item["kind"], item.get("layer") or item.get("text") or item.get("a"))
            if key in seen:
                continue
            seen.add(key)
            kind = item["kind"]
            sev = {"off-canvas": "P0", "overflow": "P0", "text-overlap": "P1", "tiny-text": "P1", "low-contrast": "P1", "outside-safe": "P2",
                   "text-over-face": "P1", "text-outside-box": "P1", "oversized-text": "P1", "off-scale-text": "P2", "tiny-actor": "P2"}.get(kind, "P2")
            fix = {
                "off-canvas": "Keep text inside the stage: position within var(--safe-x)/var(--safe-y) and reduce font size or width.",
                "overflow": "Allow wrapping or reduce font-size so the text fits its box.",
                "text-overlap": "Separate the two text blocks with layout (flex/grid gap) or sequence them in time so they never share the frame.",
                "tiny-text": "Raise font-size to at least var(--fs-min).",
                "low-contrast": "Use var(--ink) on var(--bg), or put the text on a solid panel; aim for 4.5:1.",
                "outside-safe": "Move the element inside the safe area.",
                "text-over-face": "Never cover a character's face: put cards in the top third or the lower band away from heads, or use AU.component('speech', { target, text }) which sits above the speaker.",
                "text-outside-box": "The text is bigger than the card, pill or bubble it sits in. Give the text element data-fit (and data-fit-min) so it shrinks to the box, widen the box, or cut words; never let text spill over its container.",
                "oversized-text": "Cap headlines at var(--fs-hero); use var(--fs-xl) for most titles so text never dominates or crops.",
                "tiny-actor": "The characters are too small for a story shot: make the hero 35 to 60 percent of the frame height (toon h 40 to 55) and fill the set to the edges.",
                "off-scale-text": "Use the film's type scale for every text: var(--fs-xl) titles, var(--fs-lg) headlines, var(--fs-md) cards and speech, var(--fs-sm) labels.",
            }.get(kind, "Fix layout.")
            desc = item.get("text") or f"{item.get('a', '')} / {item.get('b', '')}"
            extra = f" ratio {item['ratio']}" if "ratio" in item else (f" size {item['size']}px" if "size" in item else "")
            where = f" in data-layer \"{item['layer']}\"" if item.get("layer") else ""
            issues.append({"kind": kind, "severity": sev, "message": f"{kind} at t={frame['t']:.1f}s{where} on \"{desc}\"{extra}", "fix": fix, "t": frame["t"], "layer": item.get("layer", "")})
    energy = motion_energy(probe.get("shots") or []) if probe.get("shots") else []
    dead = [e for e in energy if e["energy"] < 0.06 and e["t0"] < duration - 1.5]
    if len(dead) >= 2:
        issues.append({"kind": "dead-frames", "severity": "P1", "message": f"No visible motion between {dead[0]['t0']:.1f}s and {dead[-1]['t1']:.1f}s.",
                       "fix": "Keep something alive every half second: ambient drift on the hero, a slow camera push, a stagger that lands later, or a ground light sweep."})
    total_energy = sum(e["energy"] for e in energy)
    if energy and total_energy < 0.6:
        issues.append({"kind": "static", "severity": "P0", "message": "The scene barely moves.", "fix": "Animate the entrance of every element and add continuous ambient motion."})
    if report.get("textNodes", 0) == 0 and report.get("layers", 0) < 2:
        issues.append({"kind": "empty", "severity": "P0", "message": "Nothing visible on stage.", "fix": "Build the scene DOM inside .scene and make sure it is visible after its entrance."})
    weights = {"P0": 30, "P1": 10, "P2": 3}
    penalty = sum(weights.get(i["severity"], 3) for i in issues)
    score = max(0, 100 - penalty)
    blocking = [i for i in issues if i["severity"] == "P0"]
    return {"score": score, "pass": not blocking and score >= 70, "issues": issues[:24], "energy": energy, "minFont": report.get("minFont"), "layers": probe.get("layers", 0)}


def repair_brief(result: dict[str, Any]) -> str:
    lines = []
    for issue in result["issues"][:12]:
        lines.append(f"- [{issue['severity']}] {issue['message']}. Fix: {issue['fix']}")
    return "\n".join(lines)


def sample_times(duration: float, n: int = 6) -> list[float]:
    d = max(0.5, duration)
    return [round(min(d - 0.05, 0.25 + (d - 0.5) * i / max(1, n - 1)), 3) for i in range(n)]


def energy_times(duration: float, step: float = 0.5) -> list[float]:
    out, t = [], 0.1
    while t < duration - 0.05:
        out.append(round(t, 3))
        t += step
    return out
