from __future__ import annotations

import math
import wave
from pathlib import Path
from typing import Any

import numpy as np

SR = 44100

MODES = {
    "minor": [0, 2, 3, 5, 7, 8, 10], "major": [0, 2, 4, 5, 7, 9, 11], "dorian": [0, 2, 3, 5, 7, 9, 10], "lydian": [0, 2, 4, 6, 7, 9, 11],
}
MOOD = {
    "editorial-paper": ("dorian", 92, 0), "vox-collage": ("dorian", 96, 2), "cosmic-flat": ("lydian", 84, 5), "swiss-kinetic": ("minor", 112, 7),
    "neon-night": ("minor", 108, 9), "whiteboard-doodle": ("major", 100, 0), "blueprint": ("dorian", 96, 4), "risograph": ("major", 110, 2),
    "math-stage": ("lydian", 76, 3), "keynote-light": ("major", 98, 5), "data-cinema": ("minor", 90, 9), "brutalist": ("minor", 118, 1),
    "soft-clay": ("major", 94, 7), "retro-pixel": ("major", 124, 0), "luxury-serif": ("minor", 72, 3), "gradient-product": ("lydian", 104, 2),
    "creator-bold": ("minor", 120, 4), "documentary": ("dorian", 78, 9),
}


def _env(n: int, attack: float, release: float) -> np.ndarray:
    t = np.arange(n) / SR
    a = np.clip(t / max(1e-3, attack), 0, 1)
    r = np.exp(-t / max(1e-3, release))
    return a * r


def _tone(freq: float, dur: float, kind: str = "pad") -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    if kind == "pad":
        sig = sum(np.sin(2 * np.pi * freq * k * t + k * 0.7) / (k ** 1.6) for k in range(1, 6))
        sig *= 0.5 + 0.5 * np.sin(2 * np.pi * 0.25 * t)
        env = np.clip(t / 0.6, 0, 1) * np.clip((dur - t) / 0.8, 0, 1)
    elif kind == "bass":
        sig = np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(4 * np.pi * freq * t)
        env = _env(n, 0.01, dur * 0.5)
    else:
        sig = np.sin(2 * np.pi * freq * t) * (0.6 + 0.4 * np.sin(2 * np.pi * freq * 2.01 * t))
        env = _env(n, 0.005, 0.35)
    return (sig * env).astype(np.float32)


def _place(buf: np.ndarray, sig: np.ndarray, at: float, gain: float) -> None:
    i = int(at * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i] * gain


MOODS = {
    "upbeat": ("major", 122, 2, "Bright pop pulse"), "chill": ("dorian", 86, 5, "Laid back lo-fi bed"), "cinematic": ("minor", 78, 9, "Slow epic swell"),
    "corporate": ("major", 104, 0, "Clean optimistic drive"), "dreamy": ("lydian", 80, 3, "Floating pads"), "tense": ("minor", 112, 1, "Dark ticking tension"),
    "playful": ("major", 128, 7, "Bouncy plucks"), "minimal": ("dorian", 96, 4, "Sparse modern pulse"),
}


def music_bed(duration: float, style: str, seed: int, out: Path, mood: str | None = None) -> Path:
    mode, bpm, root = MOODS[mood][:3] if mood in MOODS else MOOD.get(style, ("dorian", 96, 0))
    rng = np.random.default_rng(seed)
    scale = MODES[mode]
    beat = 60.0 / bpm
    bar = beat * 4
    total = duration + 1.5
    buf = np.zeros(int(total * SR) + SR, dtype=np.float32)
    progressions = [[0, 5, 3, 4], [0, 3, 4, 3], [0, 4, 5, 3], [5, 3, 0, 4]]
    prog = progressions[int(rng.integers(len(progressions)))]
    base = 110.0 * 2 ** (root / 12)
    bars = int(math.ceil(total / bar))
    for b in range(bars):
        degree = prog[b % len(prog)]
        chord = [scale[(degree + k) % 7] + 12 * ((degree + k) // 7) for k in (0, 2, 4)]
        t0 = b * bar
        for note in chord:
            _place(buf, _tone(base * 2 ** (note / 12), bar + 0.6, "pad"), t0, 0.07)
        _place(buf, _tone(base / 2 * 2 ** (chord[0] / 12), beat * 1.8, "bass"), t0, 0.22)
        _place(buf, _tone(base / 2 * 2 ** (chord[0] / 12), beat * 1.2, "bass"), t0 + beat * 2.5, 0.14)
        for s in range(8):
            if rng.random() < 0.55:
                note = scale[int(rng.integers(7))] + 12
                _place(buf, _tone(base * 2 * 2 ** (note / 12), 0.4, "pluck"), t0 + s * beat / 2, 0.035)
        for k in range(4):
            n = int(0.09 * SR)
            click = (rng.standard_normal(n).astype(np.float32) * _env(n, 0.001, 0.02)) * (0.05 if k % 2 else 0.08)
            _place(buf, click, t0 + k * beat, 1.0)
    fade = int(1.2 * SR)
    end = int(duration * SR)
    buf[end - fade:end] *= np.linspace(1, 0, fade, dtype=np.float32)
    buf[end:] = 0
    buf[: int(0.4 * SR)] *= np.linspace(0, 1, int(0.4 * SR), dtype=np.float32)
    return _write(buf[:end], out)


def whoosh(dur: float = 0.45, rng: np.random.Generator | None = None) -> np.ndarray:
    rng = rng or np.random.default_rng(1)
    n = int(dur * SR)
    noise = rng.standard_normal(n).astype(np.float32)
    t = np.linspace(0, 1, n, dtype=np.float32)
    cutoff = 0.02 + 0.25 * np.sin(np.pi * t) ** 2
    out = np.zeros(n, dtype=np.float32)
    acc = 0.0
    for i in range(n):
        acc += cutoff[i] * (noise[i] - acc)
        out[i] = acc
    env = np.clip(np.sin(np.pi * t), 0.0, None) ** 1.5
    return out * env * 0.9


def impact(dur: float = 0.6) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    freq = 70 * np.exp(-t * 6) + 38
    sig = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t * 7)
    return (sig * 0.8).astype(np.float32)


def _env_noise(n: int, rng: np.random.Generator, attack: float, release: float) -> np.ndarray:
    return rng.standard_normal(n).astype(np.float32) * _env(n, attack, release)


def _sweep(f0: float, f1: float, dur: float, curve: float = 1.0) -> np.ndarray:
    n = int(dur * SR)
    t = np.linspace(0, 1, n, dtype=np.float32) ** curve
    freq = f0 + (f1 - f0) * t
    return np.sin(2 * np.pi * np.cumsum(freq) / SR).astype(np.float32)


def _lowpass(x: np.ndarray, a: float) -> np.ndarray:
    out = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += a * (x[i] - acc)
        out[i] = acc
    return out


def _lp_fast(x: np.ndarray, k: int) -> np.ndarray:
    if k <= 1:
        return x
    c = np.cumsum(np.concatenate([[0.0], x.astype(np.float64)]))
    y = (c[k:] - c[:-k]) / k
    return np.concatenate([y, np.full(k - 1, y[-1] if len(y) else 0.0)]).astype(np.float32)


def _noise(n: int, rng: np.random.Generator) -> np.ndarray:
    return rng.standard_normal(n).astype(np.float32)


def _norm(x: np.ndarray, peak: float = 0.9) -> np.ndarray:
    m = float(np.max(np.abs(x))) or 1.0
    return (x / m * peak).astype(np.float32)


def synth_extra(name: str, rng: np.random.Generator, length: float | None) -> np.ndarray | None:
    if name in ("footsteps", "running"):
        dur = length or (2.0 if name == "footsteps" else 1.6)
        buf = np.zeros(int(dur * SR), dtype=np.float32)
        step = 0.52 if name == "footsteps" else 0.28
        tt = 0.02
        while tt < dur - 0.1:
            n = int(0.09 * SR)
            hit = _lp_fast(_noise(n, rng), 6) * _env(n, 0.002, 0.025) + _sweep(120, 60, 0.09) * _env(n, 0.002, 0.03) * 0.6
            _place(buf, hit, tt + rng.uniform(-0.02, 0.02), 0.6 + rng.random() * 0.3)
            tt += step
        return _norm(buf, 0.8)
    if name == "glass":
        n = int(1.2 * SR)
        t = np.arange(n) / SR
        crash = _noise(n, rng) * _env(n, 0.001, 0.08)
        tink = sum(np.sin(2 * np.pi * f * t + rng.random()) * np.exp(-t * rng.uniform(5, 12)) * (t > d) for f, d in
                   ((rng.uniform(2500, 5200), rng.uniform(0, 0.5)) for _ in range(14)))
        return _norm(crash - _lp_fast(crash, 8) + tink * 0.3)
    if name == "door-slam":
        n = int(0.9 * SR)
        t = np.arange(n) / SR
        thud = np.sin(2 * np.pi * np.cumsum(90 * np.exp(-t * 9) + 45) / SR) * np.exp(-t * 9)
        return _norm(thud + _lp_fast(_noise(n, rng), 20) * _env(n, 0.001, 0.05) * 0.8)
    if name == "heartbeat":
        dur = length or 2.4
        buf = np.zeros(int(dur * SR), dtype=np.float32)
        tt = 0.05
        while tt < dur - 0.3:
            for off, g in ((0, 1.0), (0.18, 0.7)):
                n = int(0.16 * SR)
                tb = np.arange(n) / SR
                _place(buf, (np.sin(2 * np.pi * np.cumsum(55 * np.exp(-tb * 18) + 38) / SR) * np.exp(-tb * 20)).astype(np.float32), tt + off, g)
            tt += 0.85
        return _norm(buf, 0.85)
    if name in ("siren", "alarm"):
        dur = length or 3.0
        n = int(dur * SR)
        t = np.arange(n) / SR
        f = 700 + 300 * np.sin(2 * np.pi * (0.35 if name == "siren" else 2.0) * t)
        sig = np.sin(2 * np.pi * np.cumsum(f) / SR)
        if name == "alarm":
            sig = np.sign(sig) * 0.6
        return _norm(sig * np.clip(t / 0.2, 0, 1) * np.clip((dur - t) / 0.4, 0, 1), 0.6)
    if name == "radio-static":
        dur = length or 1.6
        n = int(dur * SR)
        hiss = _noise(n, rng) - _lp_fast(_noise(n, rng), 3)
        crackle = (rng.random(n) > 0.9993).astype(np.float32) * rng.uniform(-1, 1, n).astype(np.float32) * 3
        warble = np.sin(2 * np.pi * np.cumsum(900 + 400 * np.sin(2 * np.pi * 0.7 * np.arange(n) / SR)) / SR) * 0.08
        return _norm(hiss * 0.4 + crackle + warble, 0.6)
    if name == "zombie-groan":
        dur = length or 1.8
        n = int(dur * SR)
        t = np.arange(n) / SR
        f0 = 85 + 15 * np.sin(2 * np.pi * 0.8 * t) + rng.uniform(-8, 8)
        src = np.sign(np.sin(2 * np.pi * np.cumsum(f0) / SR)) * 0.5 + _noise(n, rng) * 0.25
        voiced = _lp_fast(src, 18) * 1.4 - _lp_fast(src, 70)
        return _norm(voiced * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.6, 0.8)
    if name == "gate-creak":
        dur = length or 2.2
        n = int(dur * SR)
        t = np.arange(n) / SR
        f = 180 + 120 * np.sin(2 * np.pi * 0.4 * t) + 40 * rng.standard_normal(n).cumsum() / np.sqrt(n)
        pulses = (np.sin(2 * np.pi * np.cumsum(f) / SR) > 0.97).astype(np.float32)
        body = _lp_fast(pulses * 4 + _noise(n, rng) * 0.05, 4)
        return _norm(body * np.clip(t / 0.1, 0, 1) * np.clip((dur - t) / 0.3, 0, 1), 0.7)
    if name in ("wind", "rain", "fire", "city", "bees", "crowd", "ocean"):
        dur = length or 4.0
        n = int(dur * SR)
        t = np.arange(n) / SR
        fade = np.clip(t / 0.6, 0, 1) * np.clip((dur - t) / 0.6, 0, 1)
        if name == "wind":
            base = _lp_fast(_noise(n, rng), 40) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.13 * t + rng.random() * 6))
            return _norm(base * fade, 0.5)
        if name == "rain":
            drops = (rng.random(n) > 0.997).astype(np.float32) * rng.uniform(0.2, 1, n).astype(np.float32)
            return _norm((_noise(n, rng) - _lp_fast(_noise(n, rng), 4)) * 0.25 + _lp_fast(drops, 3) * 2, 0.45) * fade
        if name == "fire":
            crack = (rng.random(n) > 0.9985).astype(np.float32) * rng.uniform(0.3, 1, n).astype(np.float32)
            roar = _lp_fast(_noise(n, rng), 60) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.5 * t))
            return _norm(roar + crack * 1.5, 0.5) * fade
        if name == "bees":
            f = 220 + 18 * np.sin(2 * np.pi * 3 * t) + 10 * np.sin(2 * np.pi * 7.3 * t)
            buzz = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.4 + np.sign(np.sin(2 * np.pi * np.cumsum(f * 1.07) / SR)) * 0.3
            return _norm(_lp_fast(buzz, 6) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.4 * t)), 0.4) * fade
        if name == "city":
            rumble = _lp_fast(_noise(n, rng), 120) * 1.5
            horns = np.zeros(n, dtype=np.float32)
            for _ in range(int(dur / 3) + 1):
                st = rng.uniform(0, max(0.1, dur - 0.5))
                _place(horns, _tone(rng.choice([392, 440, 466]), 0.35, "bass") * 0.2, st, 0.5)
            return _norm(rumble + horns, 0.45) * fade
        if name == "crowd":
            mur = sum(_lp_fast(np.sign(np.sin(2 * np.pi * np.cumsum(rng.uniform(110, 240) + 20 * np.sin(2 * np.pi * rng.uniform(1, 4) * t)) / SR)) * _noise(n, rng) * 0.3, 25)
                      for _ in range(6))
            return _norm(mur, 0.45) * fade
        if name == "ocean":
            swell = 0.5 + 0.5 * np.sin(2 * np.pi * 0.11 * t) ** 2
            return _norm(_lp_fast(_noise(n, rng), 30) * swell + (_noise(n, rng) - _lp_fast(_noise(n, rng), 3)) * 0.1 * swell, 0.5) * fade
    if name == "thunder":
        n = int(3.5 * SR)
        t = np.arange(n) / SR
        crack = _noise(n, rng) * _env(n, 0.002, 0.15)
        rumble = _lp_fast(_noise(n, rng), 150) * _env(n, 0.05, 1.2) * 3
        return _norm(crack * 0.5 + rumble)
    if name == "bell":
        n = int(2.2 * SR)
        t = np.arange(n) / SR
        sig = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * d) * a for f, d, a in ((392, 1.2, 1), (784.6, 1.8, 0.5), (1036, 2.5, 0.35), (1568, 3.5, 0.2)))
        return _norm(sig, 0.6)
    if name == "punch":
        n = int(0.35 * SR)
        t = np.arange(n) / SR
        return _norm(np.sin(2 * np.pi * np.cumsum(140 * np.exp(-t * 25) + 50) / SR) * np.exp(-t * 14) + _noise(n, rng) * _env(n, 0.001, 0.02) * 0.6)
    if name == "shimmer":
        n = int(1.6 * SR)
        t = np.arange(n) / SR
        sig = sum(np.sin(2 * np.pi * f * t) * np.exp(-((t - d) ** 2) / 0.05) for f, d in zip((1568, 1976, 2349, 2637, 3136), (0.1, 0.3, 0.5, 0.7, 0.9)))
        return _norm(sig, 0.5)
    if name == "reverse-swoosh":
        return whoosh(0.6, rng)[::-1].copy() * np.linspace(0.2, 1, int(0.6 * SR), dtype=np.float32)
    if name == "bass-hit":
        n = int(1.2 * SR)
        t = np.arange(n) / SR
        return _norm(np.sin(2 * np.pi * np.cumsum(60 * np.exp(-t * 4) + 32) / SR) * np.exp(-t * 3.5))
    if name == "tick":
        n = int(0.05 * SR)
        return (_sweep(3200, 2600, 0.05) * _env(n, 0.0005, 0.01) * 0.6).astype(np.float32)
    if name == "cash":
        out = np.zeros(int(0.9 * SR), dtype=np.float32)
        _place(out, synth_sfx("click", 3), 0, 0.8)
        _place(out, _tone(2093, 0.6, "pluck"), 0.06, 0.6)
        _place(out, _tone(2637, 0.6, "pluck"), 0.06, 0.5)
        return out
    if name == "splash":
        n = int(1.0 * SR)
        return _norm((_noise(n, rng) - _lp_fast(_noise(n, rng), 5)) * _env(n, 0.005, 0.25) + _lp_fast(_noise(n, rng), 12) * _env(n, 0.002, 0.1))
    if name == "magic":
        out = np.zeros(int(1.4 * SR), dtype=np.float32)
        for i, f in enumerate((1046.5, 1318.5, 1568, 2093, 2637)):
            _place(out, _tone(f, 0.5, "pluck"), i * 0.07, 0.5)
        return out
    return None


def synth_sfx(name: str, seed: int = 7, length: float | None = None) -> np.ndarray:
    rng = np.random.default_rng(seed)
    extra = synth_extra(name, rng, length)
    if extra is not None:
        return extra.astype(np.float32)
    if name == "whoosh":
        return whoosh(0.5, rng)
    if name == "swoosh":
        return whoosh(0.28, rng) * 0.9
    if name == "pop":
        n = int(0.12 * SR)
        return (_sweep(900, 220, 0.12, 0.5) * _env(n, 0.002, 0.04) * 0.9).astype(np.float32)
    if name == "click":
        n = int(0.03 * SR)
        return (_env_noise(n, rng, 0.0005, 0.006) * 0.8 + _sweep(2400, 1800, 0.03) * _env(n, 0.0005, 0.008) * 0.4).astype(np.float32)
    if name == "ding":
        n = int(1.1 * SR)
        t = np.arange(n) / SR
        sig = sum(np.sin(2 * np.pi * f * t) / (i + 1) for i, f in enumerate((1318.5, 2637, 3951)))
        return (sig * np.exp(-t * 4) * 0.5).astype(np.float32)
    if name == "impact":
        return impact(0.8)
    if name == "boom":
        n = int(1.6 * SR)
        t = np.arange(n) / SR
        return ((np.sin(2 * np.pi * np.cumsum(45 * np.exp(-t * 2) + 28) / SR) * np.exp(-t * 2.2) + _env_noise(n, rng, 0.002, 0.08) * 0.3) * 0.9).astype(np.float32)
    if name == "riser":
        n = int(2.0 * SR)
        t = np.linspace(0, 1, n, dtype=np.float32)
        noise = rng.standard_normal(n).astype(np.float32)
        return ((_sweep(180, 1400, 2.0, 2.0) * 0.35 + noise * 0.25 * t) * t ** 2).astype(np.float32)
    if name == "typing":
        buf = np.zeros(int(1.2 * SR), dtype=np.float32)
        tt = 0.0
        while tt < 1.1:
            _place(buf, synth_sfx("click", int(tt * 1000)), tt, 0.5 + rng.random() * 0.4)
            tt += 0.06 + rng.random() * 0.07
        return buf
    if name == "shutter":
        a = _env_noise(int(0.05 * SR), rng, 0.001, 0.012)
        out = np.zeros(int(0.25 * SR), dtype=np.float32)
        _place(out, a, 0, 1.0)
        _place(out, a, 0.11, 0.8)
        return out
    if name == "glitch":
        n = int(0.4 * SR)
        sq = np.sign(np.sin(2 * np.pi * np.cumsum(np.repeat(rng.uniform(80, 900, 20), n // 20 + 1)[:n]) / SR)).astype(np.float32)
        return (sq * 0.35 * _env(n, 0.002, 0.25)).astype(np.float32)
    if name == "notify":
        out = np.zeros(int(0.6 * SR), dtype=np.float32)
        _place(out, _tone(1046.5, 0.25, "pluck"), 0, 0.8)
        _place(out, _tone(1568, 0.35, "pluck"), 0.12, 0.8)
        return out
    return whoosh(0.4, rng)


SFX_LIBRARY = {
    "whoosh": "Air whoosh for cuts and slides", "swoosh": "Short fast swoosh", "pop": "Bubble pop for icons and stickers", "click": "UI click",
    "ding": "Bright bell ding", "impact": "Deep hit for reveals", "boom": "Cinematic boom", "riser": "Two second build-up", "typing": "Keyboard typing",
    "shutter": "Camera shutter", "glitch": "Digital glitch", "notify": "Two-tone notification",
    "footsteps": "Walking footsteps (length = duration)", "running": "Running footsteps (length = duration)", "glass": "Glass breaking", "door-slam": "Door slam or heavy thud",
    "heartbeat": "Tense heartbeat loop", "siren": "Wailing siren", "alarm": "Harsh alarm", "radio-static": "Radio static and crackle", "zombie-groan": "Low monster or zombie groan",
    "gate-creak": "Creaking metal gate or door", "wind": "Wind ambience", "rain": "Rain ambience", "fire": "Crackling fire ambience", "city": "City traffic ambience",
    "bees": "Buzzing bees or insects", "crowd": "Crowd murmur", "ocean": "Ocean waves", "thunder": "Thunder crack and rumble", "bell": "Church bell or big bell",
    "punch": "Punch or hit", "shimmer": "Magical shimmer", "reverse-swoosh": "Reverse swoosh into a cut", "bass-hit": "Deep bass hit on a cut", "tick": "Clock tick",
    "cash": "Cash register", "splash": "Water splash", "magic": "Magic sparkle arpeggio",
}
AMBIENCES = {"wind", "rain", "fire", "city", "bees", "crowd", "ocean", "heartbeat", "siren", "alarm", "footsteps", "running", "radio-static", "zombie-groan", "gate-creak"}


def sfx_file(name: str, folder: Path) -> Path:
    path = folder / f"{name}.wav"
    if not path.exists():
        _write(synth_sfx(name), path)
    return path


def load_wav(path: Path) -> np.ndarray:
    import subprocess
    from . import config
    proc = subprocess.run([config.FFMPEG, "-v", "error", "-i", str(path), "-f", "s16le", "-ac", "1", "-ar", str(SR), "-"], capture_output=True)
    return np.frombuffer(proc.stdout, dtype=np.int16).astype(np.float32) / 32768.0


def levels(path: Path, fps: int, max_seconds: float = 120.0) -> list[float]:
    data = load_wav(path)[: int(max_seconds * SR)]
    if not len(data):
        return []
    hop = SR // fps
    frames = len(data) // hop
    rms = np.sqrt(np.mean(data[: frames * hop].reshape(frames, hop) ** 2, axis=1))
    ref = float(np.percentile(rms, 96)) or 1.0
    smooth = np.convolve(np.clip(rms / ref, 0, 1.2), np.ones(2) / 2, mode="same")
    return [round(float(v), 3) for v in smooth]


def sfx_track(duration: float, cuts: list[float], payoff: float | None, fps: int, out: Path, seed: int = 1,
              clips: list[dict] | None = None, resolve=None, auto: bool = True) -> Path:
    rng = np.random.default_rng(seed)
    buf = np.zeros(int((duration + 2) * SR), dtype=np.float32)
    if auto:
        w = whoosh(0.42, rng)
        for cut in cuts:
            _place(buf, w, max(0.0, cut - 0.21 - 2 / fps), 0.16)
        if payoff is not None:
            _place(buf, impact(), payoff, 0.32)
    for clip in clips or []:
        sig = None
        if clip.get("sfx") in SFX_LIBRARY:
            sig = synth_sfx(clip["sfx"], int(clip.get("seed", 7)), float(clip["dur"]) if clip.get("dur") and clip["sfx"] in AMBIENCES else None)
        elif resolve and clip.get("asset"):
            path = resolve(clip["asset"])
            if path:
                sig = load_wav(path)
        if sig is not None and len(sig):
            sig = clip_signal(sig, clip)
            if clip.get("mute"):
                continue
            _place(buf, sig, max(0.0, float(clip.get("t", 0))), float(clip.get("gain", 0.8)))
    return _write(buf[: int(duration * SR)], out)


def clip_signal(sig: np.ndarray, clip: dict) -> np.ndarray:
    a = max(0, int(float(clip.get("in", 0) or 0) * SR))
    dur = clip.get("dur")
    b = len(sig) if not dur else min(len(sig), a + int(float(dur) * SR))
    sig = np.array(sig[a:b], dtype=np.float32)
    if not len(sig):
        return sig
    fi = min(len(sig) // 2, int(max(0.004, float(clip.get("fade_in", 0) or 0)) * SR))
    fo = min(len(sig) // 2, int(max(0.004, float(clip.get("fade_out", 0) or 0)) * SR))
    if fi:
        sig[:fi] *= np.linspace(0, 1, fi, dtype=np.float32)
    if fo:
        sig[-fo:] *= np.linspace(1, 0, fo, dtype=np.float32)
    return sig


def _write(buf: np.ndarray, out: Path) -> Path:
    buf = np.nan_to_num(buf, nan=0.0, posinf=0.0, neginf=0.0)
    peak = float(np.max(np.abs(buf))) or 1.0
    data = np.clip(buf / max(1.0, peak * 1.05), -1, 1)
    pcm = (data * 32767).astype(np.int16)
    out.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(out), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(SR)
        handle.writeframes(pcm.tobytes())
    return out


MASTER_DEFAULTS = {"lufs": -16.0, "true_peak": -1.5, "duck": 60.0, "voice_clarity": True, "sfx_db": -6.0, "music_eq": True}


def master_settings(project: dict) -> dict:
    m = dict(MASTER_DEFAULTS)
    src = ((project or {}).get("audio") or {}).get("master") or {}
    for k, v in src.items():
        if k in m and v is not None:
            m[k] = v
    m["lufs"] = max(-30.0, min(-8.0, float(m["lufs"])))
    m["true_peak"] = max(-6.0, min(0.0, float(m["true_peak"])))
    m["duck"] = max(0.0, min(100.0, float(m["duck"])))
    m["sfx_db"] = max(-30.0, min(6.0, float(m["sfx_db"])))
    m["voice_clarity"] = bool(m["voice_clarity"])
    m["music_eq"] = bool(m["music_eq"])
    return m


def mix_filter(has_voice: bool, has_music: bool, has_sfx: bool, music_gain_db: float, inputs_start: int, master: dict | None = None) -> tuple[str, str]:
    m = master or dict(MASTER_DEFAULTS)
    chains = []
    labels = []
    idx = inputs_start
    voice = music = sfx = None
    if has_voice:
        voice = idx
        idx += 1
    if has_music:
        music = idx
        idx += 1
    if has_sfx:
        sfx = idx
        idx += 1
    if music is not None:
        meq = ",equalizer=f=2500:t=q:w=1.2:g=-3" if (m.get("music_eq") and has_voice) else ""
        chains.append(f"[{music}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume={music_gain_db}dB{meq}[mus]")
    if voice is not None:
        veq = ",highpass=f=80,equalizer=f=250:t=q:w=1:g=-2,equalizer=f=3200:t=q:w=1:g=2.5,acompressor=threshold=0.12:ratio=2.5:attack=8:release=120:makeup=1.4" if m.get("voice_clarity") else ""
        chains.append(f"[{voice}:a]aformat=sample_rates=48000:channel_layouts=stereo{veq},asplit=2[vo][vokey]")
        if music is not None:
            duck = float(m.get("duck", 60))
            if duck <= 0:
                chains.append("[vokey]anullsink")
                labels += ["[vo]", "[mus]"]
            else:
                ratio = 1.5 + duck / 100 * 10
                chains.append(f"[mus][vokey]sidechaincompress=threshold=0.03:ratio={ratio:.2f}:attack=20:release=400[musd]")
                labels += ["[vo]", "[musd]"]
        else:
            chains.append("[vokey]anullsink")
            labels.append("[vo]")
    elif music is not None:
        labels.append("[mus]")
    if sfx is not None:
        chains.append(f"[{sfx}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume={float(m.get('sfx_db', -6)):.1f}dB[sfx]")
        labels.append("[sfx]")
    if not labels:
        return "", ""
    lim = 10 ** (float(m.get("true_peak", -1.5)) / 20)
    chains.append(f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0:dropout_transition=0,loudnorm=I={float(m.get('lufs', -16)):.1f}:TP={float(m.get('true_peak', -1.5)):.1f}:LRA=11,alimiter=limit={lim:.4f}:level=0[aout]")
    return ";".join(chains), "[aout]"


def _fit(sig: np.ndarray, n: int, loop: bool) -> np.ndarray:
    if len(sig) >= n:
        return sig[:n]
    if loop and len(sig) > SR // 2:
        reps = int(np.ceil(n / len(sig)))
        return np.tile(sig, reps)[:n]
    return np.concatenate([sig, np.zeros(n - len(sig), dtype=np.float32)])


def preview_mix(project: dict, folder: Path, out: Path) -> Path:
    scenes = project.get("scenes", [])
    total = max(1.0, sum(float(s["duration"]) for s in scenes))
    n = int(total * SR)
    cfg = project.get("audio") or {}
    assets = {a["id"]: folder / "assets" / a["file"] for a in project.get("assets", [])}
    mix = np.zeros(n, dtype=np.float32)
    voice = None
    if cfg.get("voice") and cfg["voice"] in assets and not cfg.get("voice_mute"):
        voice = _fit(load_wav(assets[cfg["voice"]]), n, False)
    edit = project.get("edit") or {}
    if edit.get("source") and edit["source"] in assets and edit.get("ranges"):
        src = load_wav(assets[edit["source"]])
        parts = [src[int(a * SR):int(b * SR)] for a, b in edit["ranges"]]
        voice = _fit(np.concatenate(parts) if parts else src, n, False)
    music_choice = cfg.get("music", "auto")
    music = None
    if music_choice and music_choice in assets:
        music = _fit(load_wav(assets[music_choice]), n, True)
    elif music_choice == "auto" or (isinstance(music_choice, str) and music_choice.startswith("mood:")):
        tmp = out.parent / "preview_bed.wav"
        music_bed(total, project.get("style", ""), int(project.get("seed", 1)), tmp, mood=music_choice[5:] if music_choice.startswith("mood:") else None)
        music = _fit(load_wav(tmp), n, False)
    if music is not None:
        gain = 10 ** ((float(cfg.get("music_gain", -18.0)) + 12) / 20)
        if voice is not None:
            hop = SR // 20
            frames = len(voice) // hop
            env = np.sqrt(np.mean(voice[: frames * hop].reshape(frames, hop) ** 2, axis=1)) if frames else np.zeros(1)
            duck = np.where(env > 0.02, 0.35, 1.0).astype(np.float32)
            duck = np.convolve(duck, np.ones(6) / 6, mode="same")
            duck = np.repeat(duck, hop)
            duck = _fit(duck.astype(np.float32), n, False)
            duck[duck == 0] = 1.0
            music = music * duck
        mix += music * gain
    if voice is not None:
        mix += voice
    cuts, t = [], 0.0
    for s in scenes[:-1]:
        t += float(s["duration"])
        cuts.append(t)
    clips = cfg.get("clips") or []
    auto = bool(cfg.get("sfx", True)) and len(scenes) > 1
    if auto or clips:
        tmp = out.parent / "preview_sfx.wav"
        sfx_track(total, cuts, None, project.get("fps", 30), tmp, int(project.get("seed", 1)), clips=clips, resolve=assets.get, auto=auto)
        mix += _fit(load_wav(tmp), n, False) * 0.7
    peak = float(np.max(np.abs(mix))) or 1.0
    if peak > 0.98:
        mix = mix / peak * 0.98
    out.parent.mkdir(parents=True, exist_ok=True)
    pcm = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(out), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(SR)
        handle.writeframes(pcm.tobytes())
    return out
