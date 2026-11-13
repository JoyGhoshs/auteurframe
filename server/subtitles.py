from __future__ import annotations

import json
import re
from typing import Any

TIME = re.compile(r"(?:(\d+):)?(\d{1,2}):(\d{2})[,.](\d{1,3})")


def _t(match: re.Match) -> float:
    h, m, s, ms = match.groups()
    return int(h or 0) * 3600 + int(m) * 60 + int(s) + int(ms.ljust(3, "0")) / 1000.0


TAG = re.compile(r"^\s*(?:\[[^\]]{1,40}\]|\([^)]{0,20}(?:music|song|applause|laughs?|singing|instrumental|speaker[^)]*)\)|\u266a+|>>\s*)\s*", re.I)
SPEAKER = re.compile(r"^\s*(?:(?i:speaker)\s*\d+|[A-Z][A-Za-z .'-]{0,24})\s*:\s+")


def strip_tags(text: str) -> str:
    prev = None
    while prev != text:
        prev = text
        text = TAG.sub("", text)
    text = re.sub(r"\s*\[[^\]]{1,40}\]\s*$", "", text)
    text = SPEAKER.sub("", text)
    return text.replace("\u266a", "").strip()


def _clean(text: str) -> str:
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\{[^}]*\}", "", text)
    text = text.replace("\\N", " ").replace("\\n", " ")
    return strip_tags(re.sub(r"\s+", " ", text).strip())


def parse_srt(text: str) -> list[dict[str, Any]]:
    cues = []
    blocks = re.split(r"\n\s*\n", text.replace("\r\n", "\n").replace("\r", "\n").strip())
    for block in blocks:
        lines = [l for l in block.split("\n") if l.strip()]
        for i, line in enumerate(lines):
            if "-->" in line:
                parts = line.split("-->")
                a, b = TIME.search(parts[0]), TIME.search(parts[1])
                if a and b:
                    body = _clean(" ".join(lines[i + 1:]))
                    if body:
                        cues.append({"start": _t(a), "end": _t(b), "text": body})
                break
    return cues


def parse_ass(text: str) -> list[dict[str, Any]]:
    cues = []
    for line in text.splitlines():
        if not line.startswith("Dialogue:"):
            continue
        parts = line.split(",", 9)
        if len(parts) < 10:
            continue
        a, b = TIME.search(parts[1] + ".0" if "." not in parts[1] else parts[1]), TIME.search(parts[2])
        if a and b:
            cues.append({"start": _t(a), "end": _t(b), "text": _clean(parts[9])})
    return cues


def _num(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    match = TIME.search(str(value))
    if match:
        return _t(match)
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _word(item: dict[str, Any]) -> dict[str, Any] | None:
    w = item.get("word", item.get("w", item.get("text", item.get("token"))))
    s = _num(item.get("start", item.get("t", item.get("s", item.get("startTime", item.get("start_time", item.get("start_ms")))))))
    e = _num(item.get("end", item.get("e", item.get("endTime", item.get("end_time", item.get("end_ms"))))))
    if item.get("start_ms") is not None and item.get("start") is None and s is not None:
        s /= 1000.0
        e = e / 1000.0 if e is not None else None
    if w is None or s is None:
        return None
    if item.get("type") in ("spacing", "audio_event") or not str(w).strip() or TAG.fullmatch(str(w).strip() + " ") or re.fullmatch(r"\[[^\]]*\]|\([^)]*\)", str(w).strip()):
        return None
    if s > 10000:
        s /= 1000.0
        e = e / 1000.0 if e else None
    return {"t": round(s, 3), "e": round(e if e is not None else s + 0.3, 3), "w": str(w).strip()}


def words_to_cues(words: list[dict[str, Any]], max_words: int = 7, pause: float = 0.45) -> list[dict[str, Any]]:
    cues: list[dict[str, Any]] = []
    current: list[dict[str, Any]] = []
    for word in words:
        if current:
            gap = word["t"] - current[-1]["e"]
            ends = re.search(r"[.!?;:]$", current[-1]["w"])
            if gap > pause or len(current) >= max_words or (ends and len(current) >= 3):
                cues.append(current)
                current = []
        current.append(word)
    if current:
        cues.append(current)
    return [{"start": c[0]["t"], "end": c[-1]["e"], "text": " ".join(w["w"] for w in c), "words": c} for c in cues]


def parse_json(text: str) -> list[dict[str, Any]]:
    data = json.loads(text)
    if isinstance(data, dict):
        for key in ("segments", "cues", "subtitles", "captions", "items", "results", "data"):
            if isinstance(data.get(key), list):
                data = data[key]
                break
        else:
            if isinstance(data.get("words"), list):
                data = data["words"]
    if not isinstance(data, list):
        raise ValueError("json subtitles must be a list or contain segments/cues/words")
    if data and all(isinstance(i, dict) and ("word" in i or "w" in i or i.get("type") in ("word", "spacing", "audio_event")) and "segments" not in i and not isinstance(i.get("words"), list) for i in data):
        words = [w for w in (_word(i) for i in data) if w]
        return words_to_cues(words)
    cues = []
    for item in data:
        if not isinstance(item, dict):
            continue
        s = _num(item.get("start", item.get("from", item.get("startTime", item.get("start_time", item.get("s"))))))
        e = _num(item.get("end", item.get("to", item.get("endTime", item.get("end_time", item.get("e"))))))
        text = _clean(str(item.get("text", item.get("caption", item.get("content", "")))))
        words = [w for w in (_word(x) for x in item.get("words", []) or []) if w]
        if s is None and words:
            s = words[0]["t"]
        if e is None and words:
            e = words[-1]["e"]
        if s is None or e is None:
            continue
        if words and not text:
            text = " ".join(w["w"] for w in words)
        if words:
            s = min(s, words[0]["t"]) if text else s
        cue = {"start": s, "end": e, "text": text}
        if words:
            cue["words"] = words
        cues.append(cue)
    return cues


def parse(text: str, filename: str = "") -> dict[str, Any]:
    name = filename.lower()
    text = text.lstrip("﻿")
    stripped = text.strip()
    if name.endswith(".json") or stripped.startswith(("[", "{")):
        cues = parse_json(stripped)
        fmt = "json"
    elif name.endswith((".ass", ".ssa")) or "[Events]" in text:
        cues = parse_ass(text)
        fmt = "ass"
    else:
        cues = parse_srt(re.sub(r"^WEBVTT.*?\n", "", text, flags=re.S) if stripped.startswith("WEBVTT") else text)
        fmt = "vtt" if stripped.startswith("WEBVTT") else "srt"
    cues = sorted((c for c in cues if c["end"] > c["start"] and c["text"]), key=lambda c: c["start"])
    for i, cue in enumerate(cues):
        cue["id"] = i
        cue["start"] = round(cue["start"], 3)
        cue["end"] = round(cue["end"], 3)
    return {"format": fmt, "cues": cues, "duration": round(cues[-1]["end"], 3) if cues else 0.0, "words": sum(len(c["text"].split()) for c in cues), "lint": lint(cues)}


def lint(cues: list[dict[str, Any]]) -> list[dict[str, Any]]:
    issues = []
    for cue in cues:
        dur = cue["end"] - cue["start"]
        cps = len(cue["text"]) / max(0.05, dur)
        if cps > 20:
            issues.append({"cue": cue["id"], "kind": "fast", "message": f"{cps:.0f} characters per second; viewers read 17 to 20"})
        if dur < 0.83:
            issues.append({"cue": cue["id"], "kind": "short", "message": f"shown for {dur:.2f}s; minimum is 0.83s"})
        if dur > 7.0:
            issues.append({"cue": cue["id"], "kind": "long", "message": f"shown for {dur:.1f}s; split above 7s"})
    for a, b in zip(cues, cues[1:]):
        if b["start"] < a["end"] - 0.01:
            issues.append({"cue": b["id"], "kind": "overlap", "message": "overlaps the previous cue"})
    return issues[:60]


def snap(value: float, fps: int) -> float:
    return round(round(value * fps) / fps, 4)


def group_scenes(cues: list[dict[str, Any]], fps: int = 30, target: float = 4.5, max_len: float = 7.5, min_len: float = 2.2,
                 end_hold: float = 1.0, shorts: bool = False) -> list[dict[str, Any]]:
    if not cues:
        return []
    if shorts:
        target, max_len, min_len = 2.8, 4.5, 1.4
    groups: list[list[dict[str, Any]]] = []
    current: list[dict[str, Any]] = []
    for cue in cues:
        if current:
            span = cue["end"] - current[0]["start"]
            gap = cue["start"] - current[-1]["end"]
            sentence_end = bool(re.search(r"[.!?]$", current[-1]["text"]))
            length = current[-1]["end"] - current[0]["start"]
            if span > max_len or gap > 0.9 or (length >= target and sentence_end) or (length >= target * 1.3):
                groups.append(current)
                current = []
        current.append(cue)
    if current:
        groups.append(current)
    merged: list[list[dict[str, Any]]] = []
    for group in groups:
        length = group[-1]["end"] - group[0]["start"]
        if merged and length < min_len and (merged[-1][-1]["end"] - merged[-1][0]["start"]) + length < max_len * 1.15:
            merged[-1].extend(group)
        else:
            merged.append(group)
    scenes = []
    for i, group in enumerate(merged):
        start = 0.0 if i == 0 else snap(group[0]["start"] - 0.12, fps)
        scenes.append({"start": start, "cues": [c["id"] for c in group], "text": " ".join(c["text"] for c in group)})
    for i, scene in enumerate(scenes):
        end = scenes[i + 1]["start"] if i + 1 < len(scenes) else snap(merged[-1][-1]["end"] + end_hold, fps)
        scene["duration"] = round(max(0.8, end - scene["start"]), 4)
    return scenes


def estimate_words_seconds(text: str, wpm: float = 155.0) -> float:
    return max(1.6, len(re.findall(r"\w+", text)) / wpm * 60.0 + 0.6)


def synth_cues(scenes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cues = []
    for scene in scenes:
        text = (scene.get("narration") or "").strip()
        if not text:
            continue
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
        start = float(scene["start"]) + 0.25
        avail = max(0.8, float(scene["duration"]) - 0.6)
        total = sum(len(s) for s in sentences) or 1
        for sentence in sentences:
            dur = avail * len(sentence) / total
            cues.append({"id": len(cues), "start": round(start, 3), "end": round(start + dur - 0.05, 3), "text": sentence, "synthetic": True})
            start += dur
    return cues


def to_srt(cues: list[dict[str, Any]]) -> str:
    def fmt(t: float) -> str:
        ms = int(round(t * 1000))
        return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"
    return "\n".join(f"{i + 1}\n{fmt(c['start'])} --> {fmt(c['end'])}\n{c['text']}\n" for i, c in enumerate(cues))
