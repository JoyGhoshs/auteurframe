from __future__ import annotations

import asyncio
import base64
import json
import re
import time
import uuid
from pathlib import Path
from typing import Any

import httpx
import numpy as np

from . import audio, config
from . import llm as llmmod
from .store import project_dir, store

VOICE_CACHE = config.DATA / "cache" / "tts_voices.json"
DEFAULTS = {"en": "en-US-AndrewNeural", "bn": "bn-BD-NabanitaNeural", "hi": "hi-IN-SwaraNeural", "ur": "ur-PK-AsadNeural", "ar": "ar-SA-HamedNeural",
            "es": "es-ES-AlvaroNeural", "fr": "fr-FR-DeniseNeural", "de": "de-DE-ConradNeural", "it": "it-IT-DiegoNeural", "pt": "pt-BR-AntonioNeural",
            "ru": "ru-RU-DmitryNeural", "tr": "tr-TR-AhmetNeural", "id": "id-ID-ArdiNeural", "ja": "ja-JP-NanamiNeural", "ko": "ko-KR-InJoonNeural",
            "zh": "zh-CN-XiaoxiaoNeural", "ta": "ta-IN-PallaviNeural", "te": "te-IN-MohanNeural", "ne": "ne-NP-HemkalaNeural", "fa": "fa-IR-FaridNeural",
            "th": "th-TH-PremwadeeNeural", "vi": "vi-VN-NamMinhNeural", "ms": "ms-MY-OsmanNeural", "sw": "sw-KE-ZuriNeural"}
LEAD = 0.3
TAIL = 0.55
ELEVEN = "https://api.elevenlabs.io"
_eleven_cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}


class VoiceDisabled(RuntimeError):
    pass


def settings() -> dict[str, Any]:
    return llmmod.media_settings()


def enabled() -> bool:
    return bool(settings().get("tts"))


def require() -> dict[str, Any]:
    s = settings()
    if not s.get("tts"):
        raise VoiceDisabled("text to speech is turned off; enable it in Settings > Voice and generation")
    if s.get("tts_provider") == "elevenlabs" and not s.get("elevenlabs_key"):
        raise VoiceDisabled("ElevenLabs is selected but no API key is saved in Settings")
    return s


def provider() -> str:
    s = settings()
    return "elevenlabs" if s.get("tts_provider") == "elevenlabs" and s.get("elevenlabs_key") else "edge"


async def voices(lang: str = "") -> list[dict[str, Any]]:
    data = None
    if VOICE_CACHE.exists() and time.time() - VOICE_CACHE.stat().st_mtime < 7 * 86400:
        data = json.loads(VOICE_CACHE.read_text(encoding="utf-8"))
    if data is None:
        import edge_tts
        data = [{"name": v["ShortName"], "locale": v["Locale"], "gender": v.get("Gender"), "styles": (v.get("VoiceTag") or {}).get("VoicePersonalities", [])}
                for v in await edge_tts.list_voices()]
        VOICE_CACHE.parent.mkdir(parents=True, exist_ok=True)
        VOICE_CACHE.write_text(json.dumps(data), encoding="utf-8")
    if lang:
        data = [v for v in data if v["locale"].lower().startswith(lang.lower())]
    return data


async def eleven_voices(key: str = "") -> list[dict[str, Any]]:
    key = key or settings().get("elevenlabs_key", "")
    if not key:
        raise VoiceDisabled("no ElevenLabs API key")
    hit = _eleven_cache.get(key)
    if hit and time.time() - hit[0] < 3600:
        return hit[1]
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(f"{ELEVEN}/v1/voices", headers={"xi-api-key": key})
    if r.status_code == 401:
        raise VoiceDisabled("ElevenLabs rejected the API key")
    r.raise_for_status()
    out = []
    for v in r.json().get("voices", []):
        lab = v.get("labels") or {}
        out.append({"id": v["voice_id"], "name": v.get("name", ""), "gender": lab.get("gender", ""), "age": lab.get("age", ""), "accent": lab.get("accent", ""),
                    "description": lab.get("description") or v.get("description") or "", "use_case": lab.get("use_case", ""), "category": v.get("category", ""),
                    "preview": v.get("preview_url", "")})
    _eleven_cache[key] = (time.time(), out)
    return out


async def catalog(lang: str = "") -> list[dict[str, Any]]:
    if provider() == "elevenlabs":
        return await eleven_voices()
    found = await voices(lang)
    if not found and lang:
        found = await voices("en")
    return [{"id": v["name"], "name": v["name"].split("-")[-1].replace("Neural", ""), "gender": v.get("gender", ""), "accent": v["locale"],
             "description": ", ".join(v.get("styles") or []), "use_case": "", "age": ""} for v in found]


async def pick(lang: str, voice: str = "", gender: str = "") -> str:
    if voice:
        return voice
    lang = (lang or "en").split("-")[0].lower()
    if provider() == "elevenlabs":
        found = await eleven_voices()
        if gender:
            found = [v for v in found if v["gender"].lower() == gender.lower()] or found
        return found[0]["id"] if found else ""
    if not gender and lang in DEFAULTS:
        return DEFAULTS[lang]
    found = await voices(lang)
    if gender:
        found = [v for v in found if (v.get("gender") or "").lower() == gender.lower()] or found
    return found[0]["name"] if found else DEFAULTS["en"]


def project_lang(project: dict[str, Any]) -> str:
    lang = (project.get("options") or {}).get("language") or "en"
    if lang == "auto":
        from . import fonts
        lang = fonts.info(project).get("lang") or "en"
    return lang


async def choose(project: dict[str, Any], role: str = "narrator", brief: str = "") -> dict[str, Any]:
    s = settings()
    cast = (project.get("audio") or {}).get("cast") or {}
    if role in cast:
        return {"voice": cast[role], "why": "already cast for this film"}
    if role == "narrator" and s.get("default_voice"):
        return {"voice": s["default_voice"], "why": "default voice from Settings"}
    lang = project_lang(project)
    options = await catalog(lang)
    if not options:
        return {"voice": await pick(lang), "why": "fallback"}
    model = llmmod.LLM("director")
    choice = None
    if model.available:
        listing = "\n".join(f"- {v['id']}: {v['name']} | {v.get('gender', '')} {v.get('age', '')} | {v.get('accent', '')} | {v.get('description', '')} | {v.get('use_case', '')}"
                            for v in options[:80])
        prompt = (f"Film brief: {project.get('brief', '')[:800]}\nTone: {(project.get('options') or {}).get('tone') or 'auto'}\nStyle: {(project.get('bible') or {}).get('name', '')}\n"
                  f"Language: {lang}\nRole to cast: {role}. {brief}\n\nAvailable voices:\n{listing}\n\n"
                  "Pick the single voice whose timbre fits this role and film best (for example deep and grave for history and war, warm and smooth for "
                  "nature and wellness, bright and energetic for tech and shorts, young or old to match a character). The voice must be able to speak the language. "
                  'Return JSON {"voice": "<id from the list>", "why": "short reason"}.')
        try:
            data = await model.json("You are a casting director for voice-over. Return JSON only.", prompt, max_tokens=600)
            if isinstance(data, dict) and any(v["id"] == data.get("voice") for v in options):
                choice = {"voice": data["voice"], "why": str(data.get("why", ""))[:160]}
        except Exception:
            choice = None
    if not choice:
        choice = {"voice": await pick(lang), "why": "language default"}

    def apply(doc: dict[str, Any]) -> None:
        doc.setdefault("audio", {}).setdefault("cast", {})[role] = choice["voice"]
    store.mutate(project["id"], apply)
    return choice


def _attach_punctuation(text: str, words: list[dict[str, Any]]) -> list[dict[str, Any]]:
    tokens = text.split()
    out = []
    j = 0
    for w in words:
        word = dict(w)
        core = re.sub(r"\W", "", word["w"]).lower()
        for k in range(j, min(len(tokens), j + 4)):
            if re.sub(r"\W", "", tokens[k]).lower() == core and core:
                word["w"] = tokens[k]
                j = k + 1
                break
        word["t"], word["e"] = round(word["t"], 3), round(word["e"], 3)
        out.append(word)
    return out


async def speak_edge(text: str, voice: str, rate: str = "+0%", pitch: str = "+0Hz") -> tuple[bytes, list[dict[str, Any]]]:
    import edge_tts
    last: Exception | None = None
    for attempt in range(3):
        try:
            com = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, boundary="WordBoundary")
            data = bytearray()
            words: list[dict[str, Any]] = []
            sentences: list[dict[str, Any]] = []
            async for chunk in com.stream():
                if chunk["type"] == "audio":
                    data += chunk["data"]
                elif chunk["type"] in ("WordBoundary", "SentenceBoundary"):
                    item = {"t": chunk["offset"] / 1e7, "e": (chunk["offset"] + chunk["duration"]) / 1e7, "w": chunk["text"]}
                    (words if chunk["type"] == "WordBoundary" else sentences).append(item)
            if not data:
                raise RuntimeError("the voice service returned no audio")
            if not words and sentences:
                for s in sentences:
                    toks = s["w"].split()
                    span = (s["e"] - s["t"]) / max(1, len(toks))
                    words += [{"t": s["t"] + i * span, "e": s["t"] + (i + 1) * span, "w": w} for i, w in enumerate(toks)]
            return bytes(data), _attach_punctuation(text, words)
        except Exception as error:
            last = error
            await asyncio.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"text to speech failed: {last}")


def _rate_to_speed(rate: str) -> float:
    m = re.match(r"([+-]?\d+)%", rate or "")
    return max(0.7, min(1.2, 1 + (int(m.group(1)) / 100 if m else 0)))


async def speak_eleven(text: str, voice: str, rate: str = "+0%", style: str = "") -> tuple[bytes, list[dict[str, Any]]]:
    s = settings()
    key = s.get("elevenlabs_key", "")
    body: dict[str, Any] = {"text": text, "model_id": s.get("elevenlabs_model") or "eleven_multilingual_v2",
                            "voice_settings": {"stability": 0.45, "similarity_boost": 0.8, "style": 0.25 if style else 0.0, "use_speaker_boost": True, "speed": _rate_to_speed(rate)}}
    last = ""
    async with httpx.AsyncClient(timeout=120) as client:
        for attempt in range(3):
            r = await client.post(f"{ELEVEN}/v1/text-to-speech/{voice}/with-timestamps", headers={"xi-api-key": key, "content-type": "application/json"}, json=body)
            if r.status_code == 200:
                break
            last = f"{r.status_code} {r.text[:200]}"
            if r.status_code in (400, 401, 402, 403, 404, 422):
                raise RuntimeError(f"ElevenLabs: {last}")
            await asyncio.sleep(2 * (attempt + 1))
        else:
            raise RuntimeError(f"ElevenLabs: {last}")
    data = r.json()
    raw = base64.b64decode(data.get("audio_base64") or "")
    al = data.get("alignment") or data.get("normalized_alignment") or {}
    chars, starts, ends = al.get("characters") or [], al.get("character_start_times_seconds") or [], al.get("character_end_times_seconds") or []
    words: list[dict[str, Any]] = []
    cur, t0, t1 = "", None, 0.0
    for ch, a, b in zip(chars, starts, ends):
        if ch.isspace():
            if cur:
                words.append({"t": t0, "e": t1, "w": cur})
            cur, t0 = "", None
            continue
        if t0 is None:
            t0 = a
        cur += ch
        t1 = b
    if cur:
        words.append({"t": t0 or 0.0, "e": t1, "w": cur})
    return raw, _attach_punctuation(text, words)


async def speak(text: str, voice: str, rate: str = "+0%", pitch: str = "+0Hz") -> tuple[bytes, list[dict[str, Any]]]:
    if voice and not voice.endswith("Neural") and provider() == "elevenlabs":
        return await speak_eleven(text, voice, rate)
    return await speak_edge(text, voice if voice.endswith("Neural") else await pick("en"), rate, pitch)


def _snap(v: float, fps: int) -> float:
    return round(round(v * fps) / fps, 4)


def levels_of(sig: np.ndarray, fps: int = 30) -> list[float]:
    hop = audio.SR // fps
    frames = len(sig) // hop
    if frames <= 0:
        return []
    rms = np.sqrt(np.mean(sig[: frames * hop].reshape(frames, hop) ** 2, axis=1))
    ref = float(np.percentile(rms, 95)) or 1.0
    return [round(float(v), 3) for v in np.clip(rms / ref, 0, 1.2)]


async def line(pid: str, text: str, voice: str = "", role: str = "", rate: str = "+0%") -> dict[str, Any]:
    require()
    p = store.get(pid)
    chosen = voice if voice and voice != "auto" else (await choose(p, role or "narrator", f"Character: {role}" if role else ""))["voice"]
    raw, words = await speak(text, chosen, rate)
    tmp = project_dir(pid) / "assets" / f"tmp_{uuid.uuid4().hex[:6]}.mp3"
    tmp.parent.mkdir(parents=True, exist_ok=True)
    tmp.write_bytes(raw)
    sig = audio.load_wav(tmp)
    tmp.unlink(missing_ok=True)
    aid = "as_" + uuid.uuid4().hex[:10]
    out = project_dir(pid) / "assets" / f"{aid}.wav"
    audio._write(sig, out)
    dur = len(sig) / audio.SR
    asset = {"id": aid, "name": f"{role or 'line'}: {text[:40]}", "file": out.name, "kind": "audio", "mime": "audio/wav", "size": out.stat().st_size, "role": "dialogue",
             "url": f"/media/{pid}/assets/{out.name}", "added": time.time(),
             "meta": {"source": provider(), "voice": chosen, "text": text, "words": words, "duration": dur, "levels": levels_of(sig), "generated": True,
                      "attribution": f"Voice {chosen} ({'ElevenLabs' if provider() == 'elevenlabs' else 'Microsoft neural TTS'})"}}
    store.mutate(pid, lambda doc: doc.setdefault("assets", []).append(asset))
    return asset


async def narrate(pid: str, voice: str = "", rate: str = "+0%", pitch: str = "+0Hz", fit_scenes: bool = True, on_step: Any = None) -> dict[str, Any]:
    from . import subtitles
    p = store.get(pid)
    if not voice:
        voice = (await choose(p, "narrator"))["voice"]
    chosen = voice
    fps = int(p.get("fps", 30))
    scenes = [dict(s) for s in p["scenes"]]
    clips: list[tuple[int, np.ndarray, list[dict[str, Any]]]] = []
    tmp = project_dir(pid) / "renders"
    tmp.mkdir(parents=True, exist_ok=True)
    for s in scenes:
        text = (s.get("narration") or "").strip()
        if not text:
            continue
        if on_step:
            on_step(f"voicing scene {s['index'] + 1}")
        raw, words = await speak(text, chosen, rate, pitch)
        mp3 = tmp / f"tts_{s['id']}.mp3"
        mp3.write_bytes(raw)
        sig = audio.load_wav(mp3)
        mp3.unlink(missing_ok=True)
        nz = np.where(np.abs(sig) > 0.003)[0]
        if len(nz):
            sig = sig[: nz[-1] + int(0.08 * audio.SR)]
        clips.append((s["index"], sig, words))
    if not clips:
        raise ValueError("no scene has narration text to voice")
    speech = {i: len(sig) / audio.SR for i, sig, _ in clips}
    if fit_scenes:
        t = 0.0
        for s in scenes:
            need = speech.get(s["index"])
            if need is not None:
                s["duration"] = _snap(max(2.0, LEAD + need + TAIL), fps)
            s["start"] = _snap(t, fps)
            t += float(s["duration"])
    total = sum(float(s["duration"]) for s in scenes)
    buf = np.zeros(int((total + 1) * audio.SR), dtype=np.float32)
    all_words: list[dict[str, Any]] = []
    by_index = {s["index"]: s for s in scenes}
    for idx, sig, words in clips:
        at = float(by_index[idx]["start"]) + LEAD
        a = int(at * audio.SR)
        seg = sig[: max(0, len(buf) - a)]
        buf[a:a + len(seg)] += seg
        all_words += [{"t": round(at + w["t"], 3), "e": round(at + w["e"], 3), "w": w["w"], "scene": idx} for w in words]
    peak = float(np.max(np.abs(buf))) or 1.0
    buf = buf / peak * 0.92
    aid = "as_" + uuid.uuid4().hex[:10]
    out = project_dir(pid) / "assets" / f"{aid}.wav"
    final = buf[: int(total * audio.SR)]
    audio._write(final, out)
    cues = []
    for idx in sorted({w["scene"] for w in all_words}):
        part = [w for w in all_words if w["scene"] == idx]
        cues += subtitles.words_to_cues([{k: w[k] for k in ("t", "e", "w")} for w in part], max_words=7, pause=0.45)
    for i, c in enumerate(cues):
        c["id"] = i
    vendor = "ElevenLabs" if not chosen.endswith("Neural") else "Microsoft neural TTS"
    asset = {"id": aid, "name": f"AI narration ({chosen})", "file": out.name, "kind": "audio", "mime": "audio/wav", "size": out.stat().st_size, "role": "voice",
             "url": f"/media/{pid}/assets/{out.name}", "added": time.time(),
             "meta": {"source": vendor, "voice": chosen, "duration": total, "attribution": f"Narration voice {chosen} ({vendor})", "generated": True,
                      "levels": levels_of(final)}}

    def apply(doc: dict[str, Any]) -> None:
        doc.setdefault("assets", []).append(asset)
        a = doc.setdefault("audio", {})
        a["voice"] = aid
        a["tts_voice"] = chosen
        if fit_scenes:
            durations = {s["id"]: (s["start"], s["duration"]) for s in scenes}
            for sc in doc["scenes"]:
                if sc["id"] in durations:
                    sc["start"], sc["duration"] = durations[sc["id"]]
        doc["cues"] = cues
        doc["cues_synthetic"] = False
        doc["cues_source"] = "tts"
    store.mutate(pid, apply, revision=True, reason="AI narration")
    return {"asset": asset, "voice": chosen, "duration": round(total, 2), "cues": len(cues), "words": len(all_words), "scenes": len(clips)}
