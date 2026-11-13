from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path
from typing import Any

from . import config


def probe(path: Path) -> dict[str, Any]:
    proc = subprocess.run([config.FFPROBE, "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,r_frame_rate", "-of", "json", str(path)],
                          capture_output=True, text=True)
    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError:
        data = {}
    out: dict[str, Any] = {"duration": float(data.get("format", {}).get("duration", 0) or 0), "has_audio": False, "width": 0, "height": 0, "fps": 30.0}
    for s in data.get("streams", []):
        if s.get("codec_type") == "video" and not out["width"]:
            out["width"], out["height"] = s.get("width", 0), s.get("height", 0)
            try:
                n, d = s.get("r_frame_rate", "30/1").split("/")
                out["fps"] = round(float(n) / float(d or 1), 3)
            except (ValueError, ZeroDivisionError):
                pass
        if s.get("codec_type") == "audio":
            out["has_audio"] = True
    return out


def silences(path: Path, noise_db: float = -34.0, min_dur: float = 0.35) -> list[tuple[float, float]]:
    proc = subprocess.run([config.FFMPEG, "-hide_banner", "-nostats", "-i", str(path), "-af", f"silencedetect=n={noise_db}dB:d={min_dur}", "-f", "null", "-"],
                          capture_output=True, text=True)
    out, start = [], None
    for line in proc.stderr.splitlines():
        m = re.search(r"silence_start: (-?[\d.]+)", line)
        if m:
            start = max(0.0, float(m.group(1)))
        m = re.search(r"silence_end: ([\d.]+)", line)
        if m and start is not None:
            out.append((start, float(m.group(1))))
            start = None
    return out


def keep_ranges(duration: float, quiet: list[tuple[float, float]], pad: float = 0.12, min_gap: float = 0.45, min_keep: float = 0.4) -> list[list[float]]:
    cuts = [(a + pad, b - pad) for a, b in quiet if (b - a) >= min_gap and b - pad > a + pad]
    ranges, cur = [], 0.0
    for a, b in cuts:
        if a - cur >= min_keep:
            ranges.append([round(cur, 3), round(a, 3)])
        cur = max(cur, b)
    if duration - cur >= min_keep:
        ranges.append([round(cur, 3), round(duration, 3)])
    return ranges or [[0.0, round(duration, 3)]]


class Timeline:
    def __init__(self, ranges: list[list[float]]) -> None:
        self.ranges = ranges
        self.offsets = []
        t = 0.0
        for a, b in ranges:
            self.offsets.append(t)
            t += b - a
        self.duration = round(t, 4)

    def to_out(self, src: float) -> float | None:
        for (a, b), o in zip(self.ranges, self.offsets):
            if a - 1e-6 <= src <= b + 1e-6:
                return round(o + (src - a), 4)
        return None

    def to_src(self, out: float) -> float:
        for (a, b), o in zip(self.ranges, self.offsets):
            if out <= o + (b - a) + 1e-6:
                return round(a + max(0.0, out - o), 4)
        a, b = self.ranges[-1]
        return b

    def boundaries(self) -> list[float]:
        return [round(o, 4) for o in self.offsets[1:]]
