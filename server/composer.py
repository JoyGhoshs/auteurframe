from __future__ import annotations

import hashlib
import math
import re
from pathlib import Path
from typing import Any

import numpy as np

SR = 44100

SCALES = {
    "major": [0, 2, 4, 5, 7, 9, 11], "minor": [0, 2, 3, 5, 7, 8, 10], "dorian": [0, 2, 3, 5, 7, 9, 10], "lydian": [0, 2, 4, 6, 7, 9, 11],
    "mixolydian": [0, 2, 4, 5, 7, 9, 10], "phrygian": [0, 1, 3, 5, 7, 8, 10], "harmonic": [0, 2, 3, 5, 7, 8, 11],
}
PENTA = {"major": [0, 2, 4, 7, 9], "minor": [0, 3, 5, 7, 10]}

PROGRESSIONS = [
    [0, 5, 3, 4], [0, 3, 4, 3], [0, 4, 5, 3], [5, 3, 0, 4], [0, 5, 1, 4], [0, 2, 3, 4], [0, 3, 0, 4], [0, 6, 5, 4],
    [0, 0, 3, 3], [5, 4, 3, 4], [0, 4, 3, 3], [1, 4, 0, 0], [0, 3, 5, 4], [3, 4, 5, 5],
]

GENRES: dict[str, dict[str, Any]] = {
    "pulse": {"bpm": (112, 126), "modes": ["minor", "dorian"], "chords": "pad", "chord_rhythm": "bar", "bass": "saw8", "lead": "arp", "drums": "four", "swing": 0.5, "sidechain": True, "label": "Pulsing electronic"},
    "lofi": {"bpm": (72, 86), "modes": ["dorian", "major"], "chords": "epiano", "chord_rhythm": "half", "bass": "sub", "lead": "epiano", "drums": "boombap", "swing": 0.6, "crackle": True, "sevenths": True, "label": "Lo-fi"},
    "cinematic": {"bpm": (68, 88), "modes": ["minor", "lydian", "harmonic"], "chords": "strings", "chord_rhythm": "bar", "bass": "ostinato", "lead": "strings", "drums": "boom", "swing": 0.5, "label": "Cinematic"},
    "ambient": {"bpm": (60, 76), "modes": ["lydian", "major"], "chords": "pad", "chord_rhythm": "two", "bass": "drone", "lead": "bell", "drums": "none", "swing": 0.5, "label": "Ambient"},
    "corporate": {"bpm": (100, 116), "modes": ["major", "mixolydian"], "chords": "piano", "chord_rhythm": "quarter", "bass": "pluck", "lead": "pluck", "drums": "pop", "swing": 0.5, "label": "Bright corporate"},
    "tension": {"bpm": (96, 120), "modes": ["minor", "phrygian", "harmonic"], "chords": "strings", "chord_rhythm": "two", "bass": "pulse16", "lead": "bell", "drums": "tick", "swing": 0.5, "label": "Tension"},
    "playful": {"bpm": (112, 134), "modes": ["major", "mixolydian"], "chords": "marimba", "chord_rhythm": "quarter", "bass": "pizz", "lead": "marimba", "drums": "clap", "swing": 0.56, "label": "Playful"},
    "synthwave": {"bpm": (94, 110), "modes": ["minor", "dorian"], "chords": "pad", "chord_rhythm": "bar", "bass": "saw8", "lead": "square", "drums": "gated", "swing": 0.5, "sidechain": True, "label": "Synthwave"},
    "piano": {"bpm": (66, 88), "modes": ["major", "minor", "lydian"], "chords": "broken", "chord_rhythm": "bar", "bass": "none", "lead": "piano", "drums": "none", "swing": 0.5, "label": "Solo piano"},
    "hiphop": {"bpm": (82, 96), "modes": ["minor", "dorian"], "chords": "epiano", "chord_rhythm": "bar", "bass": "sub", "lead": "bell", "drums": "boombap", "swing": 0.58, "sevenths": True, "label": "Hip-hop"},
    "taiko": {"bpm": (88, 108), "modes": ["minor"], "penta": True, "chords": "strings", "chord_rhythm": "two", "bass": "drone", "lead": "flute", "drums": "taiko", "swing": 0.5, "label": "Taiko and flute"},
    "chiptune": {"bpm": (120, 140), "modes": ["major", "minor"], "chords": "square", "chord_rhythm": "arp", "bass": "square8", "lead": "square", "drums": "noise", "swing": 0.5, "label": "Chiptune"},
    "documentary": {"bpm": (70, 84), "modes": ["dorian", "minor", "major"], "chords": "strings", "chord_rhythm": "bar", "bass": "none", "lead": "piano", "drums": "none", "swing": 0.5, "label": "Documentary"},
}

STYLE_GENRES = {
    "editorial-paper": ["piano", "lofi", "documentary"], "vox-collage": ["hiphop", "lofi", "tension"], "cosmic-flat": ["ambient", "synthwave", "cinematic"],
    "swiss-kinetic": ["pulse", "corporate", "hiphop"], "neon-night": ["synthwave", "pulse", "tension"], "whiteboard-doodle": ["playful", "corporate", "piano"],
    "blueprint": ["pulse", "documentary", "ambient"], "risograph": ["lofi", "playful", "hiphop"], "math-stage": ["ambient", "piano", "pulse"],
    "keynote-light": ["corporate", "pulse", "piano"], "data-cinema": ["cinematic", "tension", "pulse"], "brutalist": ["hiphop", "tension", "pulse"],
    "soft-clay": ["playful", "lofi", "corporate"], "retro-pixel": ["chiptune", "playful", "synthwave"], "luxury-serif": ["piano", "ambient", "cinematic"],
    "gradient-product": ["corporate", "pulse", "ambient"], "creator-bold": ["hiphop", "pulse", "synthwave"], "documentary": ["documentary", "cinematic", "piano"],
    "paper-cut": ["playful", "piano", "lofi"], "stop-motion": ["playful", "lofi", "piano"],
}
MOOD_GENRES = {
    "upbeat": ["corporate", "pulse", "playful"], "chill": ["lofi", "hiphop", "ambient"], "cinematic": ["cinematic", "taiko", "documentary"],
    "corporate": ["corporate", "pulse", "piano"], "dreamy": ["ambient", "piano", "lofi"], "tense": ["tension", "synthwave", "cinematic"],
    "playful": ["playful", "corporate", "chiptune"], "minimal": ["pulse", "ambient", "piano"],
}
KEYWORDS = [
    (r"epic|battle|war|hero|duel|fight|sword|army|legend", ["cinematic", "taiko"]),
    (r"samurai|japan|anime|ninja|shrine|kyoto", ["taiko", "cinematic", "piano"]),
    (r"horror|mystery|tense|crime|thriller|hack|spy|danger|zombie", ["tension", "synthwave"]),
    (r"kid|kids|funny|cute|comedy|cartoon|silly|pet|dog|cat", ["playful", "lofi"]),
    (r"tech|ai|startup|saas|product|app|software|launch|feature", ["pulse", "corporate"]),
    (r"calm|relax|sleep|nature|meditation|ocean|forest|space|stars", ["ambient", "piano"]),
    (r"retro|80s|synth|cyber|neon|night city", ["synthwave", "pulse"]),
    (r"game|gaming|pixel|8-bit|arcade", ["chiptune", "playful"]),
    (r"history|documentary|biography|archive|war over|century", ["documentary", "cinematic"]),
    (r"hip ?hop|street|urban|rap|sneaker", ["hiphop", "lofi"]),
    (r"study|lofi|cozy|coffee|rain", ["lofi", "piano"]),
    (r"love|wedding|emotional|sad|memory|memories|grief|tribute", ["piano", "documentary"]),
    (r"finance|money|market|data|chart|economy", ["pulse", "documentary", "corporate"]),
]


def _seed_of(*parts: Any) -> int:
    return int(hashlib.sha1("|".join(str(p) for p in parts).encode()).hexdigest()[:8], 16)


def choose(project: dict[str, Any], mood: str | None = None) -> dict[str, Any]:
    audio = project.get("audio") or {}
    score = audio.get("score")
    if isinstance(score, dict) and score.get("genre") in GENRES and (mood is None or score.get("mood") == mood):
        return score
    opts = project.get("options") or {}
    text = " ".join(str(x) for x in (project.get("title"), project.get("brief"), opts.get("tone"))).lower()
    seed = _seed_of(project.get("id", ""), project.get("seed", 1), project.get("title", ""))
    cands: list[str] = []
    why = []
    if mood and mood in MOOD_GENRES:
        cands += MOOD_GENRES[mood]
        why.append(f"mood {mood}")
    hits = sorted(((len(re.findall(r"(?<![a-z])(?:" + rx + r")(?![a-z])", text)), -i, genres) for i, (rx, genres) in enumerate(KEYWORDS)), reverse=True)
    for count, _, genres in hits[:2]:
        if count:
            cands += [g for g in genres if g not in cands]
            if "brief" not in why:
                why.append("brief")
    medium = ((project.get("cast2d") or {}).get("medium")) or ("3d" if project.get("cast3d") else "")
    if medium == "anime":
        cands = [g for g in ["taiko", "cinematic", "piano"] if g not in cands] + cands
        why.append("anime")
    style = project.get("style") or ""
    cands += [g for g in STYLE_GENRES.get(style, ["pulse", "corporate", "piano", "lofi"]) if g not in cands]
    pool = cands[:3] if mood or len(why) else cands
    genre = pool[seed % len(pool)]
    g = GENRES[genre]
    rng = np.random.default_rng(seed)
    mode = g["modes"][int(rng.integers(len(g["modes"])))]
    bpm = int(rng.integers(g["bpm"][0], g["bpm"][1] + 1))
    root = int(rng.integers(0, 12))
    prog = int(rng.integers(len(PROGRESSIONS)))
    prog2 = int((prog + 1 + rng.integers(len(PROGRESSIONS) - 1)) % len(PROGRESSIONS))
    return {"genre": genre, "label": g["label"], "mode": mode, "bpm": bpm, "root": root, "prog": prog, "prog_b": prog2, "seed": seed % 100000,
            "mood": mood, "why": ", ".join(why) or f"style {style or 'default'}"}


def _t(n: int) -> np.ndarray:
    return np.arange(n, dtype=np.float32) / SR


def _adsr(n: int, a: float, d: float, s: float, r: float) -> np.ndarray:
    t = _t(n)
    dur = n / SR
    env = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    rel = np.clip((dur - t) / max(r, 1e-4), 0, 1)
    return (env * rel).astype(np.float32)


def _harm(freq: float, n: int, amps: list[float], detune: float = 0.0, vib: float = 0.0) -> np.ndarray:
    t = _t(n)
    ph = 2 * np.pi * freq * t
    if vib:
        ph = ph + vib * np.sin(2 * np.pi * 5.2 * t) * np.clip(t / 0.4, 0, 1)
    out = np.zeros(n, dtype=np.float32)
    for k, a in enumerate(amps, start=1):
        if a and freq * k < SR / 2.2:
            out += a * np.sin(ph * k * (1 + detune * (k % 3 - 1))).astype(np.float32)
    return out


def inst(name: str, freq: float, dur: float, vel: float = 1.0) -> np.ndarray:
    n = max(1, int(dur * SR))
    if name == "pad":
        sig = _harm(freq, n, [1 / k for k in range(1, 10)], 0.0) + _harm(freq * 1.006, n, [1 / k for k in range(1, 8)]) * 0.8
        return sig * _adsr(n, 0.5, 1.5, 0.8, 0.7) * 0.18 * vel
    if name == "strings":
        sig = _harm(freq, n, [1 / k ** 1.1 for k in range(1, 12)], vib=0.004 * freq / 10) + _harm(freq * 0.997, n, [1 / k ** 1.2 for k in range(1, 10)]) * 0.7
        return sig * _adsr(n, 0.7, 2.0, 0.85, 0.9) * 0.14 * vel
    if name == "epiano":
        t = _t(n)
        mod = 1.6 * np.exp(-t * 2.5) * np.sin(2 * np.pi * freq * t)
        sig = np.sin(2 * np.pi * freq * t + mod) + 0.25 * np.sin(2 * np.pi * freq * 3 * t) * np.exp(-t * 6)
        return (sig * _adsr(n, 0.005, 0.9, 0.3, 0.25) * 0.32 * vel).astype(np.float32)
    if name == "piano":
        t = _t(n)
        sig = sum((np.sin(2 * np.pi * freq * k * (1 + 0.0004 * k * k) * t) * np.exp(-t * (1.1 + k * 0.9)) / k ** 1.3) for k in range(1, 9))
        click = np.random.default_rng(int(freq)).standard_normal(n).astype(np.float32) * np.exp(-t * 300) * 0.05
        return ((sig + click) * _adsr(n, 0.003, 9, 1.0, 0.2) * 0.36 * vel).astype(np.float32)
    if name == "pluck":
        t = _t(n)
        sig = sum(np.sin(2 * np.pi * freq * k * t) * np.exp(-t * (3 + k * 4)) / k for k in range(1, 9))
        return (sig * _adsr(n, 0.002, 9, 1, 0.08) * 0.34 * vel).astype(np.float32)
    if name == "marimba":
        t = _t(n)
        sig = np.sin(2 * np.pi * freq * t) * np.exp(-t * 6) + 0.35 * np.sin(2 * np.pi * freq * 4 * t) * np.exp(-t * 18) + 0.08 * np.sin(2 * np.pi * freq * 10 * t) * np.exp(-t * 40)
        return (sig * _adsr(n, 0.002, 9, 1, 0.05) * 0.42 * vel).astype(np.float32)
    if name == "bell":
        t = _t(n)
        sig = sum(a * np.sin(2 * np.pi * freq * r * t) * np.exp(-t * dcy) for r, a, dcy in ((1, 1, 1.4), (2.76, 0.5, 2.5), (5.4, 0.3, 4), (8.93, 0.15, 6)))
        return (sig * _adsr(n, 0.002, 9, 1, 0.3) * 0.22 * vel).astype(np.float32)
    if name == "flute":
        t = _t(n)
        sig = _harm(freq, n, [1, 0.12, 0.05], vib=0.004 * freq / 8)
        breath = np.random.default_rng(int(freq * 3)).standard_normal(n).astype(np.float32)
        breath = np.convolve(breath, np.ones(24) / 24, mode="same") * 0.15
        return ((sig + breath) * _adsr(n, 0.08, 1.0, 0.85, 0.15) * 0.3 * vel).astype(np.float32)
    if name == "square":
        sig = _harm(freq, n, [1, 0, 1 / 3, 0, 1 / 5, 0, 1 / 7, 0, 1 / 9])
        return sig * _adsr(n, 0.003, 0.3, 0.6, 0.05) * 0.16 * vel
    if name in ("saw", "saw8"):
        sig = _harm(freq, n, [1 / k for k in range(1, 9)])
        return sig * _adsr(n, 0.004, 0.25, 0.5, 0.06) * 0.3 * vel
    if name == "sub":
        t = _t(n)
        return (np.sin(2 * np.pi * freq * t) * _adsr(n, 0.01, 0.6, 0.7, 0.1) * 0.5 * vel).astype(np.float32)
    if name == "pizz":
        t = _t(n)
        sig = sum(np.sin(2 * np.pi * freq * k * t) * np.exp(-t * (8 + k * 6)) / k for k in range(1, 6))
        return (sig * 0.45 * vel).astype(np.float32)
    if name == "drone":
        sig = _harm(freq, n, [1, 0.5, 0.3, 0.12], vib=0.002)
        return sig * _adsr(n, 1.5, 3, 0.9, 1.5) * 0.16 * vel
    return np.zeros(n, dtype=np.float32)


def drum(name: str, rng: np.random.Generator, vel: float = 1.0) -> np.ndarray:
    if name == "kick":
        n = int(0.42 * SR); t = _t(n)
        f = 48 + 90 * np.exp(-t * 28)
        return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) * 0.9 * vel).astype(np.float32)
    if name == "snare":
        n = int(0.25 * SR); t = _t(n)
        noise = rng.standard_normal(n).astype(np.float32)
        noise = noise - np.convolve(noise, np.ones(6) / 6, mode="same")
        return ((noise * np.exp(-t * 18) * 0.5 + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 25) * 0.4) * vel).astype(np.float32)
    if name == "hat":
        n = int(0.06 * SR); t = _t(n)
        noise = rng.standard_normal(n).astype(np.float32)
        noise = noise - np.convolve(noise, np.ones(3) / 3, mode="same")
        return (noise * np.exp(-t * 70) * 0.22 * vel).astype(np.float32)
    if name == "openhat":
        n = int(0.25 * SR); t = _t(n)
        noise = rng.standard_normal(n).astype(np.float32)
        noise = noise - np.convolve(noise, np.ones(3) / 3, mode="same")
        return (noise * np.exp(-t * 12) * 0.16 * vel).astype(np.float32)
    if name == "clap":
        n = int(0.22 * SR); t = _t(n)
        noise = rng.standard_normal(n).astype(np.float32)
        env = sum(np.exp(-np.clip(t - d, 0, None) * 60) * (t >= d) for d in (0, 0.012, 0.024)) * np.exp(-t * 10)
        return (noise * env * 0.35 * vel).astype(np.float32)
    if name == "shaker":
        n = int(0.08 * SR); t = _t(n)
        noise = rng.standard_normal(n).astype(np.float32)
        noise = noise - np.convolve(noise, np.ones(2) / 2, mode="same")
        return (noise * np.sin(np.pi * np.clip(t / 0.08, 0, 1)) * 0.1 * vel).astype(np.float32)
    if name == "taiko":
        n = int(1.1 * SR); t = _t(n)
        f = 62 + 40 * np.exp(-t * 20)
        body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.5)
        skin = rng.standard_normal(n).astype(np.float32) * np.exp(-t * 40) * 0.3
        return ((body + np.convolve(skin, np.ones(30) / 30, mode="same")) * 0.9 * vel).astype(np.float32)
    if name == "boom":
        n = int(2.2 * SR); t = _t(n)
        f = 38 + 50 * np.exp(-t * 6)
        body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6)
        noise = np.convolve(rng.standard_normal(n).astype(np.float32), np.ones(60) / 60, mode="same") * np.exp(-t * 4) * 1.5
        return ((body + noise) * 0.8 * vel).astype(np.float32)
    if name == "tick":
        n = int(0.03 * SR); t = _t(n)
        return (np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 200) * 0.12 * vel).astype(np.float32)
    if name == "noise":
        n = int(0.09 * SR); t = _t(n)
        return (np.sign(rng.standard_normal(n)).astype(np.float32) * np.exp(-t * 40) * 0.12 * vel).astype(np.float32)
    return np.zeros(1, dtype=np.float32)


def riser(dur: float, rng: np.random.Generator) -> np.ndarray:
    n = int(dur * SR); t = _t(n)
    noise = rng.standard_normal(n).astype(np.float32)
    k = np.clip(t / dur, 0, 1)
    smooth = np.convolve(noise, np.ones(8) / 8, mode="same")
    sig = (noise - smooth) * k ** 2 * 0.25 + np.sin(2 * np.pi * np.cumsum(200 + 1400 * k ** 2) / SR) * k ** 3 * 0.06
    return sig.astype(np.float32)


def _place(buf: np.ndarray, sig: np.ndarray, at: float, gain: float = 1.0) -> None:
    i = int(at * SR)
    if i < 0:
        sig = sig[-i:]
        i = 0
    if i >= len(buf) or not len(sig):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i] * gain


def energy_curve(duration: float, cuts: list[float]) -> list[tuple[float, float, float]]:
    bounds = [0.0] + sorted(c for c in cuts if 0.5 < c < duration - 0.5) + [duration]
    if len(bounds) < 3:
        step = duration / max(1, round(duration / 8))
        bounds = [0.0] + [step * i for i in range(1, int(round(duration / step)))] + [duration]
    peak = duration * 0.72
    out = []
    for i in range(len(bounds) - 1):
        a, b = bounds[i], bounds[i + 1]
        mid = (a + b) / 2
        if i == 0:
            e = 0.35
        elif i == len(bounds) - 2 and len(bounds) > 3:
            e = 0.5
        elif a <= peak <= b:
            e = 1.0
        else:
            e = 0.45 + 0.5 * min(1.0, mid / peak)
        out.append((a, b, round(e, 3)))
    return out


def compose(duration: float, plan: dict[str, Any], out: Path, cuts: list[float] | None = None) -> Path:
    g = GENRES[plan["genre"]]
    rng = np.random.default_rng(int(plan.get("seed", 1)))
    scale = PENTA["minor" if plan["mode"] in ("minor", "phrygian", "harmonic", "dorian") else "major"] if g.get("penta") else SCALES[plan["mode"]]
    bpm = float(plan["bpm"])
    beat = 60.0 / bpm
    bar = beat * 4
    total = duration + 2.0
    n = int(total * SR) + SR
    bus = {k: np.zeros(n, dtype=np.float32) for k in ("chords", "bass", "lead", "drums", "fx")}
    base = 55.0 * 2 ** (plan["root"] / 12)
    sections = energy_curve(duration, cuts or [])

    def energy(t: float) -> float:
        for a, b, e in sections:
            if a <= t < b:
                return e
        return sections[-1][2]

    def note_freq(degree: int, octave: int) -> float:
        L = len(scale)
        semis = scale[degree % L] + 12 * (degree // L)
        return base * 2 ** (octave + semis / 12)

    def chord_degrees(deg: int) -> list[int]:
        ch = [deg, deg + 2, deg + 4]
        if g.get("sevenths"):
            ch.append(deg + 6)
        return ch

    prog_a = PROGRESSIONS[plan["prog"] % len(PROGRESSIONS)]
    prog_b = PROGRESSIONS[plan.get("prog_b", plan["prog"]) % len(PROGRESSIONS)]
    motif_len = 8
    motif = []
    deg = int(rng.integers(0, 5))
    for i in range(motif_len):
        deg = max(-2, min(9, deg + int(rng.choice([-2, -1, 1, 2, 0, 3, -3], p=[0.2, 0.25, 0.25, 0.15, 0.05, 0.05, 0.05]))))
        motif.append(deg if rng.random() > 0.2 else None)
    rhythm = [1 if rng.random() < 0.7 else 2 for _ in range(motif_len)]
    sw = g.get("swing", 0.5)

    def eighth(t0: float, k: int) -> float:
        return t0 + (k // 2) * beat + (beat * sw if k % 2 else 0)

    bars = int(math.ceil(total / bar))
    peak_t = duration * 0.72
    for b in range(bars):
        t0 = b * bar
        if t0 > duration + 0.5:
            break
        e = energy(t0)
        in_b = e >= 0.95
        prog = prog_b if in_b else prog_a
        degree = prog[b % 4]
        chord = chord_degrees(degree)
        cr = g["chord_rhythm"]
        cname = {"broken": "piano", "square": "square"}.get(g["chords"], g["chords"])
        if g["chords"] == "broken":
            for k in range(8):
                d = chord[[0, 1, 2, 1, 3 % len(chord), 1, 2, 1][k] % len(chord)]
                _place(bus["chords"], inst("piano", note_freq(d, 2), beat * 1.6, 0.7 + 0.3 * e), eighth(t0, k))
        elif cr == "arp":
            for k in range(16):
                d = chord[k % len(chord)] + (len(scale) if k % 8 >= 4 else 0)
                _place(bus["chords"], inst("square", note_freq(d, 2), beat / 4 * 0.9, 0.8), t0 + k * beat / 4)
        else:
            hits = {"bar": [(0, bar + 0.4)], "half": [(0, beat * 2), (beat * 2, beat * 2)], "two": [(0, bar * 2 + 0.6)] if b % 2 == 0 else [],
                    "quarter": [(k * beat, beat * 0.9) for k in range(4)]}[cr]
            for at, dur in hits:
                for d in chord:
                    _place(bus["chords"], inst(cname, note_freq(d, 2), dur, 0.6 + 0.4 * e), t0 + at)
        root_f = note_freq(degree, 0 if g["bass"] != "drone" else 0)
        bk = g["bass"]
        if e >= 0.4 or bk in ("drone",):
            if bk == "saw8":
                for k in range(8):
                    _place(bus["bass"], inst("saw", root_f * (2 if k % 2 and e > 0.8 else 1), beat / 2 * 0.85), t0 + k * beat / 2)
            elif bk == "square8":
                for k in range(8):
                    _place(bus["bass"], inst("square", root_f * 2, beat / 2 * 0.7, 1.4), t0 + k * beat / 2)
            elif bk == "sub":
                _place(bus["bass"], inst("sub", root_f, beat * 1.5), t0)
                _place(bus["bass"], inst("sub", root_f, beat * 0.9), eighth(t0, 5))
            elif bk == "pluck":
                for k in (0, 3, 4, 6):
                    _place(bus["bass"], inst("pluck", root_f * 2, beat * 0.6), eighth(t0, k))
            elif bk == "pizz":
                for k in (0, 4):
                    _place(bus["bass"], inst("pizz", root_f * 2, beat), t0 + k * beat / 2 * 2)
                _place(bus["bass"], inst("pizz", note_freq(degree + 4, 1), beat), t0 + beat * 1)
                _place(bus["bass"], inst("pizz", note_freq(degree + 4, 1), beat), t0 + beat * 3)
            elif bk == "ostinato":
                if e >= 0.55:
                    for k in range(8):
                        d = [degree, degree, degree + 4, degree][k % 4]
                        _place(bus["bass"], inst("strings", note_freq(d, 1), beat / 2 * 0.9, 0.9), t0 + k * beat / 2)
                else:
                    _place(bus["bass"], inst("strings", root_f * 2, bar + 0.4, 0.7), t0)
            elif bk == "pulse16":
                for k in range(16):
                    _place(bus["bass"], inst("sub", root_f * 2, beat / 4 * 0.6, 0.5 + 0.5 * e), t0 + k * beat / 4)
            elif bk == "drone" and b % 2 == 0:
                _place(bus["bass"], inst("drone", root_f, bar * 2 + 1.0), t0)
        if e >= 0.55 and g["lead"]:
            phrase = (b // 2) % 4
            for i, d in enumerate(motif):
                pos = (b % 2) * 8 + i
                if pos >= 16 or d is None:
                    continue
                if phrase == 3 and i >= 5:
                    d = chord[0] + len(scale)
                dur = beat / 2 * rhythm[i] * (0.9 if g["lead"] not in ("strings", "flute") else 1.8)
                _place(bus["lead"], inst(g["lead"] if g["lead"] != "arp" else "pluck", note_freq(d + (2 if phrase == 2 else 0), 3 if g["lead"] in ("bell", "marimba", "square", "arp") else 2), dur, 0.7 + 0.3 * e), eighth(t0, i))
        dk = g["drums"]
        if dk != "none":
            for k in range(16):
                at = t0 + k * beat / 4 + ((sw - 0.5) * beat / 2 if k % 2 else 0)
                if dk == "four" and e >= 0.5:
                    if k % 4 == 0: _place(bus["drums"], drum("kick", rng), at)
                    if k % 4 == 2: _place(bus["drums"], drum("openhat" if e > 0.9 else "hat", rng), at)
                    if e > 0.8 and k % 2: _place(bus["drums"], drum("hat", rng, 0.6), at)
                    if k in (4, 12) and e > 0.7: _place(bus["drums"], drum("clap", rng, 0.8), at)
                elif dk == "boombap" and e >= 0.45:
                    if k in (0, 7, 10): _place(bus["drums"], drum("kick", rng, 0.9), at)
                    if k in (4, 12): _place(bus["drums"], drum("snare", rng, 0.8), at)
                    if k % 2 == 0: _place(bus["drums"], drum("hat", rng, 0.5 + 0.3 * (k % 4 == 0)), at)
                elif dk == "pop" and e >= 0.45:
                    if k in (0, 8, 10): _place(bus["drums"], drum("kick", rng), at)
                    if k in (4, 12): _place(bus["drums"], drum("clap", rng), at)
                    if k % 2 == 0: _place(bus["drums"], drum("shaker", rng), at)
                elif dk == "clap" and e >= 0.45:
                    if k in (0, 8): _place(bus["drums"], drum("kick", rng, 0.7), at)
                    if k in (4, 12): _place(bus["drums"], drum("clap", rng, 0.8), at)
                    if k % 4 == 2: _place(bus["drums"], drum("shaker", rng, 1.2), at)
                elif dk == "gated" and e >= 0.5:
                    if k in (0, 8): _place(bus["drums"], drum("kick", rng), at)
                    if k in (4, 12): _place(bus["drums"], drum("snare", rng, 1.2), at)
                    if k % 2 == 0: _place(bus["drums"], drum("hat", rng, 0.6), at)
                elif dk == "tick" and e >= 0.4:
                    _place(bus["drums"], drum("tick", rng, 0.6 + 0.4 * (k % 4 == 0)), at)
                    if k == 0 and e > 0.7: _place(bus["drums"], drum("kick", rng, 0.7), at)
                elif dk == "taiko" and e >= 0.45:
                    if k in (0, 6, 8) or (e > 0.9 and k in (12, 14)): _place(bus["drums"], drum("taiko", rng, 0.7 + 0.3 * (k == 0)), at)
                elif dk == "noise" and e >= 0.45:
                    if k in (0, 8): _place(bus["drums"], drum("kick", rng, 0.8), at)
                    if k in (4, 12): _place(bus["drums"], drum("noise", rng, 1.6), at)
                    if k % 2 == 0: _place(bus["drums"], drum("noise", rng, 0.5), at)
                elif dk == "boom" and k == 0 and b % 2 == 0 and e >= 0.7:
                    _place(bus["drums"], drum("taiko", rng, 0.8), at)
        if g.get("crackle"):
            seg = int(bar * SR)
            crack = (rng.random(seg) < 0.0009).astype(np.float32) * rng.standard_normal(seg).astype(np.float32) * 0.25
            _place(bus["fx"], crack, t0)
    prev = None
    for a, b, e in sections:
        if prev is not None and e > prev + 0.1 and a > 1.5:
            r = riser(min(2.0, beat * 4), rng)
            _place(bus["fx"], r, a - len(r) / SR, 0.9)
        if prev is not None and (e >= 0.95 or (g["drums"] in ("boom", "none") and e > prev)):
            _place(bus["fx"], drum("boom", rng), a, 0.7 if e >= 0.95 else 0.45)
        prev = e
    if g.get("sidechain"):
        duck = np.ones(n, dtype=np.float32)
        shape = 1 - 0.55 * np.exp(-_t(int(beat * SR)) * 9)
        for k in range(int(total / beat)):
            i = int(k * beat * SR)
            j = min(n, i + len(shape))
            if energy(k * beat) >= 0.5:
                duck[i:j] = shape[: j - i]
        bus["chords"] *= duck
        bus["bass"] *= np.minimum(1, duck + 0.25)
    mix = bus["chords"] * 0.9 + bus["bass"] * 0.85 + bus["lead"] * 0.75 + bus["drums"] * 0.8 + bus["fx"] * 0.6
    end = int(duration * SR)
    mix = mix[:end]
    peak = float(np.max(np.abs(mix))) or 1.0
    mix = np.tanh(mix / peak * 1.25) * 0.85
    fi = int(0.35 * SR)
    mix[:fi] *= np.linspace(0, 1, fi, dtype=np.float32)
    fo = int(min(2.0, duration * 0.12) * SR)
    mix[end - fo:end] *= np.linspace(1, 0, fo, dtype=np.float32) ** 1.5
    return _write(mix.astype(np.float32), out)


def _write(buf: np.ndarray, out: Path) -> Path:
    import wave
    out.parent.mkdir(parents=True, exist_ok=True)
    data = np.clip(buf, -1, 1)
    stereo = np.stack([data, np.roll(data, int(0.0007 * SR)) * 0.96], axis=1)
    pcm = (stereo * 32767).astype("<i2")
    with wave.open(str(out), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    return out
