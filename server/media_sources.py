from __future__ import annotations

import asyncio
import base64
import csv
import io
import json
import re
import subprocess
import time
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import quote

import httpx
import numpy as np

from . import config
from .store import project_dir, store

UA = {"User-Agent": "AuteurFrame/1.0 (+https://github.com/joyghoshs/auteurframe) httpx"}
OPEN_LICENSES = ("cc0", "by", "by-sa", "pdm", "publicdomain", "public domain", "cc-by", "cc by", "pd")
_pollinate = asyncio.Lock()


FILLER = {"historical", "historic", "archival", "archive", "photo", "photograph", "image", "picture", "footage", "video", "old", "vintage", "the", "of", "a", "an", "in", "at", "on"}


def relaxed(q: str, tail: bool = False) -> list[str]:
    q = re.sub(r"\s+", " ", (q or "").strip())
    out = [q]
    no_years = re.sub(r"\b(1[0-9]{3}|20[0-9]{2})s?\b", "", q).strip()
    words = [w for w in no_years.split() if w.lower() not in FILLER] or no_years.split()
    shorter = (" ".join(words[-2:]), words[-1] if words else "") if tail else (" ".join(words[:3]), " ".join(words[:2]), words[0] if words else "")
    for cand in (no_years, " ".join(words)) + shorter:
        cand = cand.strip()
        if cand and cand not in out:
            out.append(cand)
    return out


async def with_relaxation(fn: Any, q: str, *args: Any, want: int = 3, tail: bool = False) -> list[dict[str, Any]]:
    seen: set[str] = set()
    found: list[dict[str, Any]] = []
    for cand in relaxed(q, tail):
        try:
            rows = await fn(cand, *args)
        except Exception:
            rows = []
        for r in rows:
            key = r.get("url") or r.get("id")
            if key and key not in seen:
                seen.add(key)
                r.setdefault("matched", cand)
                found.append(r)
        if len(found) >= want:
            break
    return found


def _ok_license(text: str) -> bool:
    parts = set(re.split(r"[\s\-_/+]+", (text or "").lower()))
    return not (parts & {"nc", "nd", "noncommercial", "noderivatives", "noderivs"})


def _register(pid: str, path: Path, kind: str, mime: str, name: str, meta: dict[str, Any], role: str = "reference") -> dict[str, Any]:
    asset = {"id": path.stem, "name": name[:80], "file": path.name, "kind": kind, "mime": mime, "size": path.stat().st_size, "role": role,
             "url": f"/media/{pid}/assets/{path.name}", "meta": meta, "added": time.time()}

    def apply(p: dict[str, Any]) -> None:
        p.setdefault("assets", []).append(asset)
        credit = meta.get("attribution")
        if credit:
            credits = p.setdefault("credits", [])
            if credit not in credits:
                credits.append(credit)
    store.mutate(pid, apply)
    try:
        from .bus import bus
        bus.publish(pid, "asset.added", {"asset": asset})
    except Exception:
        pass
    return asset


def _probe(url_or_path: str) -> dict[str, Any]:
    proc = subprocess.run([config.FFPROBE, "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", url_or_path],
                          capture_output=True, text=True, timeout=60)
    try:
        data = json.loads(proc.stdout or "{}")
    except json.JSONDecodeError:
        data = {}
    v = next((s for s in data.get("streams", []) if s.get("codec_type") == "video"), {})
    return {"duration": float((data.get("format") or {}).get("duration") or 0), "width": v.get("width"), "height": v.get("height"),
            "audio": any(s.get("codec_type") == "audio" for s in data.get("streams", []))}


async def _ia_search(client: httpx.AsyncClient, q: str, media: str, rows: int = 12) -> list[dict[str, Any]]:
    query = f"({q}) AND mediatype:{media}"
    params = [("q", query), ("fl[]", "identifier"), ("fl[]", "title"), ("fl[]", "year"), ("fl[]", "licenseurl"), ("fl[]", "description"), ("fl[]", "downloads"),
              ("rows", str(rows)), ("output", "json"), ("sort[]", "downloads desc")]
    r = await client.get("https://archive.org/advancedsearch.php", params=params)
    r.raise_for_status()
    out = []
    for d in r.json().get("response", {}).get("docs", []):
        desc = d.get("description") or ""
        if isinstance(desc, list):
            desc = " ".join(desc)
        out.append({"id": "ia:" + d["identifier"], "source": "internet archive", "title": str(d.get("title") or d["identifier"])[:120], "year": d.get("year"),
                    "license": d.get("licenseurl") or "see archive.org item (much of it public domain)", "page": f"https://archive.org/details/{d['identifier']}",
                    "about": re.sub(r"<[^>]+>", " ", desc)[:200], "thumb": f"https://archive.org/services/img/{d['identifier']}"})
    return out


async def _nasa_search(client: httpx.AsyncClient, q: str, media: str = "video") -> list[dict[str, Any]]:
    r = await client.get("https://images-api.nasa.gov/search", params={"q": q, "media_type": media})
    r.raise_for_status()
    out = []
    for it in r.json().get("collection", {}).get("items", [])[:14]:
        d = (it.get("data") or [{}])[0]
        links = [l.get("href") for l in it.get("links") or [] if l.get("href")]
        out.append({"id": "nasa:" + d.get("nasa_id", ""), "source": "nasa", "title": str(d.get("title") or "")[:120], "year": (d.get("date_created") or "")[:4],
                    "license": "NASA media (generally not copyrighted)", "page": f"https://images.nasa.gov/details/{d.get('nasa_id', '')}", "about": (d.get("description") or "")[:200],
                    "thumb": links[0] if links else ""})
    return out


async def _commons_media(client: httpx.AsyncClient, q: str, ftype: str) -> list[dict[str, Any]]:
    params = {"action": "query", "format": "json", "generator": "search", "gsrsearch": f"{q} filetype:{ftype}", "gsrnamespace": 6, "gsrlimit": 12,
              "prop": "imageinfo", "iiprop": "url|size|extmetadata|mime", "iiurlwidth": 480}
    r = await client.get("https://commons.wikimedia.org/w/api.php", params=params)
    out = []
    for pg in sorted(((r.json().get("query") or {}).get("pages") or {}).values(), key=lambda p: p.get("index", 0)):
        info = (pg.get("imageinfo") or [{}])[0]
        meta = info.get("extmetadata") or {}
        if not info.get("url"):
            continue
        out.append({"id": "url:" + info["url"], "source": "wikimedia commons", "title": re.sub(r"^File:|\.\w+$", "", pg.get("title", ""))[:120],
                    "license": (meta.get("LicenseShortName") or {}).get("value", ""), "page": info.get("descriptionurl"), "url": info["url"],
                    "thumb": info.get("thumburl") or "", "author": re.sub(r"<[^>]+>", "", (meta.get("Artist") or {}).get("value", ""))[:80],
                    "duration": float(info.get("duration") or 0) or None})
    return out


async def search_footage(q: str, source: str = "auto") -> list[dict[str, Any]]:
    return await with_relaxation(_search_footage_once, q, source)


async def _search_footage_once(q: str, source: str = "auto") -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=30, headers=UA, follow_redirects=True) as client:
        jobs = []
        if source in ("auto", "archive", "ia"):
            jobs.append(_ia_search(client, q, "movies"))
        if source in ("auto", "nasa"):
            jobs.append(_nasa_search(client, q))
        if source in ("auto", "commons", "wikimedia"):
            jobs.append(_commons_media(client, q, "video"))
        got = await asyncio.gather(*jobs, return_exceptions=True)
    out = []
    for batch in got:
        if not isinstance(batch, BaseException):
            out += batch
    return out[:30]


async def resolve_footage(item_id: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=30, headers=UA, follow_redirects=True) as client:
        if item_id.startswith("ia:"):
            ident = item_id[3:]
            m = (await client.get(f"https://archive.org/metadata/{quote(ident)}")).json()
            files = m.get("files") or []
            vids = [f for f in files if f.get("name", "").lower().endswith((".mp4", ".m4v", ".ogv", ".webm", ".mpeg", ".mpg", ".avi", ".mov"))]
            if not vids:
                raise ValueError("this archive item has no video file")

            def score(f: dict[str, Any]) -> tuple[int, float]:
                name, fmt = f.get("name", "").lower(), (f.get("format") or "").lower()
                pref = 0 if ("h.264" in fmt or "mpeg4" in fmt) and name.endswith(".mp4") else 1 if name.endswith(".mp4") else 2
                return (pref, -float(f.get("size") or 0) if "512kb" not in name else -float(f.get("size") or 0) * 0.5)
            pick = sorted(vids, key=score)[0]
            md = m.get("metadata") or {}
            return {"url": f"https://archive.org/download/{quote(ident)}/{quote(pick['name'])}", "title": str(md.get("title") or ident)[:120],
                    "license": md.get("licenseurl") or "see archive.org", "page": f"https://archive.org/details/{ident}", "duration": float(pick.get("length") or 0) or None,
                    "credit": f"{md.get('title') or ident} (Internet Archive{', ' + str(md.get('creator')) if md.get('creator') else ''})"}
        if item_id.startswith("nasa:"):
            nid = item_id[5:]
            items = (await client.get(f"https://images-api.nasa.gov/asset/{quote(nid)}")).json().get("collection", {}).get("items", [])
            hrefs = [i["href"] for i in items]
            pick = next((h for k in ("~large.mp4", "~medium.mp4", "~orig.mp4", "~small.mp4", "~mobile.mp4") for h in hrefs if h.endswith(k)), None)
            if not pick:
                raise ValueError("no mp4 for this NASA item")
            return {"url": pick.replace("http://", "https://"), "title": nid, "license": "NASA media", "page": f"https://images.nasa.gov/details/{nid}", "duration": None,
                    "credit": f"NASA ({nid})"}
        if item_id.startswith("url:") or item_id.startswith("http"):
            url = item_id[4:] if item_id.startswith("url:") else item_id
            return {"url": url, "title": url.rsplit("/", 1)[-1][:80], "license": "see source", "page": url, "duration": None, "credit": f"Footage from {url.split('/')[2]}"}
    raise ValueError("unknown footage id; use an id from search_footage")


def scene_cuts(url: str, limit_seconds: float = 600) -> list[float]:
    cmd = [config.FFMPEG, "-hide_banner", "-nostats", "-t", str(limit_seconds), "-i", url, "-an", "-vf", "scale=160:-2,select='gt(scene,0.33)',showinfo", "-f", "null", "-"]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=240)
    return [round(float(m), 2) for m in re.findall(r"pts_time:([0-9.]+)", proc.stderr)][:80]


def frame_sheet(url: str, times: list[float], cols: int = 4, width: int = 1600) -> str:
    from PIL import Image, ImageDraw
    frames = []
    for t in times[:12]:
        proc = subprocess.run([config.FFMPEG, "-hide_banner", "-loglevel", "error", "-ss", f"{t:.2f}", "-i", url, "-frames:v", "1", "-vf", "scale=400:-2", "-f", "image2", "-c:v", "mjpeg", "-"],
                              capture_output=True, timeout=60)
        if proc.stdout:
            try:
                frames.append((t, Image.open(io.BytesIO(proc.stdout)).convert("RGB")))
            except Exception:
                pass
    if not frames:
        return ""
    cw = width // cols
    ch = int(cw * frames[0][1].height / frames[0][1].width)
    rows = (len(frames) + cols - 1) // cols
    sheet = Image.new("RGB", (cw * cols, ch * rows), "black")
    d = ImageDraw.Draw(sheet)
    for i, (t, im) in enumerate(frames):
        x, y = (i % cols) * cw, (i // cols) * ch
        sheet.paste(im.resize((cw - 4, ch - 4)), (x + 2, y + 2))
        d.rectangle([x + 2, y + 2, x + 70, y + 20], fill=(0, 0, 0))
        d.text((x + 6, y + 5), f"{t:.1f}s", fill=(255, 255, 255))
    buf = io.BytesIO()
    sheet.save(buf, "JPEG", quality=75)
    return base64.b64encode(buf.getvalue()).decode()


def collect_footage(pid: str, info: dict[str, Any], start: float, duration: float, height: int = 1080, keep_audio: bool = False, name: str = "") -> dict[str, Any]:
    aid = "as_" + uuid.uuid4().hex[:10]
    out = project_dir(pid) / "assets" / f"{aid}.mp4"
    out.parent.mkdir(parents=True, exist_ok=True)
    duration = max(0.5, min(60.0, float(duration)))
    cmd = [config.FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{max(0.0, start):.3f}", "-i", info["url"], "-t", f"{duration:.3f}",
           "-vf", f"scale=-2:'min({height},ih)':flags=lanczos,fps=30,format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-movflags", "+faststart"]
    cmd += ["-c:a", "aac", "-b:a", "160k"] if keep_audio else ["-an"]
    cmd.append(str(out))
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    if proc.returncode != 0 or not out.exists() or out.stat().st_size < 1000:
        out.unlink(missing_ok=True)
        raise RuntimeError(f"could not cut that footage: {proc.stderr[-300:]}")
    probe = _probe(str(out))
    meta = {"source": "footage", "page": info.get("page"), "license": info.get("license"), "attribution": info.get("credit") or info.get("title"),
            "in": start, "duration": probe["duration"], "width": probe["width"], "height": probe["height"], "original": info["url"]}
    return _register(pid, out, "video", "video/mp4", name or info.get("title") or "footage", meta)


async def search_audio(q: str, kind: str = "sfx", max_seconds: float | None = None) -> list[dict[str, Any]]:
    return await with_relaxation(_search_audio_once, q, kind, max_seconds, tail=True)


async def _search_audio_once(q: str, kind: str = "sfx", max_seconds: float | None = None) -> list[dict[str, Any]]:
    params: dict[str, Any] = {"q": q, "page_size": 20, "license_type": "commercial"}
    if kind == "sfx":
        params["source"] = "freesound"
    elif kind == "music":
        params["source"] = "jamendo,ccmixter,wikimedia_audio,freesound"
    out: list[dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=30, headers=UA, follow_redirects=True) as client:
        async def ov() -> list[dict[str, Any]]:
            r = await client.get("https://api.openverse.org/v1/audio/", params=params)
            if r.status_code >= 400:
                r = await client.get("https://api.openverse.org/v1/audio/", params={"q": q, "page_size": 20})
            rows = []
            for it in r.json().get("results", []):
                lic = f"{it.get('license', '')} {it.get('license_version', '')}".strip()
                if not _ok_license(it.get("license", "")):
                    continue
                rows.append({"id": "url:" + it["url"], "url": it["url"], "source": it.get("source") or "openverse", "title": str(it.get("title") or "")[:100],
                             "duration": round((it.get("duration") or 0) / 1000, 2) or None, "license": lic.upper(), "author": it.get("creator") or "",
                             "page": it.get("foreign_landing_url"), "tags": [t.get("name") for t in (it.get("tags") or [])][:8],
                             "credit": it.get("attribution") or f"{it.get('title')} by {it.get('creator')} ({lic.upper()})"})
            return rows

        async def commons() -> list[dict[str, Any]]:
            rows = await _commons_media(client, q, "audio")
            for r in rows:
                r["credit"] = f"{r['title']} ({r.get('author') or 'Wikimedia Commons'}, {r.get('license')})"
            return [r for r in rows if _ok_license(r.get("license", ""))]
        jobs = [ov()] + ([commons()] if kind != "sfx" else [])
        if kind in ("music", "ambience"):
            async def ia() -> list[dict[str, Any]]:
                rows = await _ia_search(client, q + (" AND (licenseurl:*publicdomain* OR licenseurl:*by/* OR licenseurl:*by-sa/* OR licenseurl:*zero*)"), "audio", 8)
                for r in rows:
                    r["credit"] = f"{r['title']} (Internet Archive)"
                return rows
            jobs.append(ia())
        got = await asyncio.gather(*jobs, return_exceptions=True)
    for batch in got:
        if not isinstance(batch, BaseException):
            out += batch
    out = [o for o in out if not re.search(r"^LL-Q|pronunciation|^[A-Z]{2}-[A-Z]{2} ", o.get("title") or "", re.I)]
    if max_seconds:
        out = [o for o in out if not o.get("duration") or o["duration"] <= max_seconds]
    return out[:30]


async def _ia_audio_url(ident: str) -> str:
    async with httpx.AsyncClient(timeout=30, headers=UA, follow_redirects=True) as client:
        m = (await client.get(f"https://archive.org/metadata/{quote(ident)}")).json()
    files = [f for f in m.get("files") or [] if f.get("name", "").lower().endswith((".mp3", ".ogg", ".flac", ".wav"))]
    if not files:
        raise ValueError("no audio file in that archive item")
    files.sort(key=lambda f: (0 if f["name"].lower().endswith(".mp3") else 1, float(f.get("size") or 0)))
    return f"https://archive.org/download/{quote(ident)}/{quote(files[0]['name'])}"


def beats(path: Path) -> dict[str, Any]:
    from . import audio
    sig = audio.load_wav(path)
    sr = audio.SR
    if len(sig) < sr:
        return {"bpm": None, "beats": []}
    hop = 512
    frames = len(sig) // hop
    energy = np.sqrt(np.mean(sig[: frames * hop].reshape(frames, hop) ** 2, axis=1))
    onset = np.maximum(0, np.diff(energy, prepend=energy[0]))
    onset = onset - onset.mean()
    fps = sr / hop
    lags = np.arange(int(fps * 60 / 190), int(fps * 60 / 60))
    ac = np.array([np.dot(onset[:-l], onset[l:]) for l in lags]) if len(onset) > lags.max() + 2 else np.zeros(1)
    if not ac.any():
        return {"bpm": None, "beats": []}
    lag = int(lags[int(np.argmax(ac))])
    bpm = 60 * fps / lag
    best, phase = -1.0, 0
    for p in range(lag):
        s = float(onset[p::lag].sum())
        if s > best:
            best, phase = s, p
    times = [round((phase + k * lag) / fps, 3) for k in range(int((frames - phase) / lag) + 1)]
    peaks = np.argsort(energy)[-6:]
    return {"bpm": round(bpm, 1), "beats": times[:400], "loudest": sorted(round(float(p) / fps, 2) for p in peaks)}


async def collect_audio(pid: str, item: dict[str, Any], start: float = 0, duration: float | None = None, name: str = "") -> dict[str, Any]:
    url = item.get("url") or ""
    if item.get("id", "").startswith("ia:"):
        url = await _ia_audio_url(item["id"][3:])
    if not url:
        raise ValueError("no audio url")
    aid = "as_" + uuid.uuid4().hex[:10]
    out = project_dir(pid) / "assets" / f"{aid}.m4a"
    out.parent.mkdir(parents=True, exist_ok=True)
    cmd = [config.FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-user_agent", UA["User-Agent"], "-ss", f"{max(0.0, start):.3f}", "-i", url]
    if duration:
        cmd += ["-t", f"{float(duration):.3f}"]
    cmd += ["-vn", "-ac", "2", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", str(out)]
    proc = await asyncio.to_thread(subprocess.run, cmd, capture_output=True, text=True, timeout=300)
    if proc.returncode != 0 or not out.exists() or out.stat().st_size < 500:
        out.unlink(missing_ok=True)
        raise RuntimeError(f"could not fetch that audio: {proc.stderr[-240:]}")
    probe = _probe(str(out))
    meta = {"source": item.get("source"), "page": item.get("page"), "license": item.get("license"), "attribution": item.get("credit") or item.get("title"),
            "duration": probe["duration"], "tags": item.get("tags")}
    if probe["duration"] >= 8:
        try:
            meta.update(await asyncio.to_thread(beats, out))
        except Exception:
            pass
    return _register(pid, out, "audio", "audio/mp4", name or item.get("title") or "audio", meta)


def place_audio(pid: str, asset_id: str, role: str, t: float = 0, gain: float = 0.8, cut_in: float = 0, dur: float | None = None, fade_in: float = 0, fade_out: float = 0) -> dict[str, Any]:
    clip = {"id": "ac_" + uuid.uuid4().hex[:8], "asset": asset_id, "t": round(max(0.0, t), 3), "gain": gain, "in": cut_in, "fade_in": fade_in, "fade_out": fade_out, "by": "agent"}
    if dur:
        clip["dur"] = dur

    def apply(p: dict[str, Any]) -> None:
        a = p.setdefault("audio", {})
        if role == "music":
            a["music"] = asset_id
            a["music_gain"] = float(a.get("music_gain", -18.0))
        else:
            a.setdefault("clips", []).append(clip)
    store.mutate(pid, apply)
    return clip


async def wikidata(entity: str, lang: str = "en") -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=40, headers=UA, follow_redirects=True) as client:
        qid = entity if re.fullmatch(r"Q\d+", entity) else None
        if not qid:
            r = await client.get("https://www.wikidata.org/w/api.php", params={"action": "wbsearchentities", "search": entity, "language": lang, "format": "json", "limit": 5})
            hits = r.json().get("search") or []
            if not hits:
                raise ValueError(f"nothing on Wikidata for '{entity}'")
            qid = hits[0]["id"]
            alts = [f"{h['id']} {h.get('label', '')}: {h.get('description', '')}" for h in hits[1:4]]
        else:
            alts = []
        query = f"""SELECT ?propLabel ?valLabel ?val WHERE {{
  wd:{qid} ?p ?statement . ?statement ?ps ?val . ?prop wikibase:claim ?p ; wikibase:statementProperty ?ps .
  FILTER(?prop NOT IN (wd:P31, wd:P910, wd:P1343, wd:P373))
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "{lang},en". }} }} LIMIT 900"""
        r = await client.get("https://query.wikidata.org/sparql", params={"query": query, "format": "json"})
        r.raise_for_status()
        rows = r.json().get("results", {}).get("bindings", [])
        r2 = await client.get("https://www.wikidata.org/w/api.php", params={"action": "wbgetentities", "ids": qid, "props": "labels|descriptions", "languages": f"{lang}|en", "format": "json"})
        ent = (r2.json().get("entities") or {}).get(qid, {})
    facts: dict[str, list[str]] = {}
    for row in rows:
        prop = row.get("propLabel", {}).get("value", "")
        val = row.get("valLabel", {}).get("value", "")
        if not prop or not val or re.fullmatch(r"(Q|P|L)\d+", val) or len(val) > 160:
            continue
        if re.fullmatch(r"https?://\S+", val) and "commons.wikimedia.org" not in val:
            continue
        if re.match(r"^[+-]?\d{4}-\d\d-\d\dT", val):
            val = val[:10].lstrip("+")
        bucket = facts.setdefault(prop, [])
        if val not in bucket and len(bucket) < 6:
            bucket.append(val)
    label = (ent.get("labels", {}).get(lang) or ent.get("labels", {}).get("en") or {}).get("value", entity)
    desc = (ent.get("descriptions", {}).get(lang) or ent.get("descriptions", {}).get("en") or {}).get("value", "")
    return {"id": qid, "label": label, "description": desc, "facts": facts, "alternatives": alts, "page": f"https://www.wikidata.org/wiki/{qid}"}


async def sparql(query: str) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=60, headers=UA) as client:
        r = await client.get("https://query.wikidata.org/sparql", params={"query": query, "format": "json"})
        if r.status_code >= 400:
            raise ValueError(f"SPARQL error {r.status_code}: {r.text[:300]}")
        rows = r.json().get("results", {}).get("bindings", [])
    return [{k: v.get("value") for k, v in row.items()} for row in rows[:300]]


WB_ALIASES = {"population": "SP.POP.TOTL", "gdp": "NY.GDP.MKTP.CD", "gdp per capita": "NY.GDP.PCAP.CD", "life expectancy": "SP.DYN.LE00.IN", "co2 per capita": "EN.GHG.CO2.PC.CE.AR5",
              "inflation": "FP.CPI.TOTL.ZG", "unemployment": "SL.UEM.TOTL.ZS", "literacy": "SE.ADT.LITR.ZS", "internet users": "IT.NET.USER.ZS", "urban population": "SP.URB.TOTL.IN.ZS",
              "fertility": "SP.DYN.TFRT.IN", "electricity access": "EG.ELC.ACCS.ZS", "poverty": "SI.POV.DDAY", "exports": "NE.EXP.GNFS.CD", "gdp growth": "NY.GDP.MKTP.KD.ZG",
              "infant mortality": "SP.DYN.IMRT.IN", "forest area": "AG.LND.FRST.ZS", "renewable energy": "EG.FEC.RNEW.ZS", "military spending": "MS.MIL.XPND.GD.ZS",
              "remittances": "BX.TRF.PWKR.CD.DT", "mobile subscriptions": "IT.CEL.SETS.P2"}


async def worldbank(indicator: str, countries: list[str], years: str = "1990:2024") -> dict[str, Any]:
    code = WB_ALIASES.get(indicator.lower().strip(), indicator.strip())
    ctry = ";".join(c.strip() for c in countries if c.strip()) or "WLD"
    url = f"https://api.worldbank.org/v2/country/{quote(ctry)}/indicator/{quote(code)}"
    last = None
    async with httpx.AsyncClient(timeout=40, headers=UA, follow_redirects=True) as client:
        for attempt in range(4):
            try:
                r = await client.get(url, params={"format": "json", "per_page": 2000, "date": years})
                if r.status_code < 500:
                    break
                last = f"World Bank API answered {r.status_code}"
            except httpx.HTTPError as error:
                last = f"World Bank API {type(error).__name__} {error}".strip()
            await asyncio.sleep(1.5 * (attempt + 1))
        else:
            raise RuntimeError(f"{last}; try the owid tool instead (Our World in Data republishes most World Bank series)")
    data = r.json()
    if not isinstance(data, list) or len(data) < 2 or not data[1]:
        raise ValueError(f"no World Bank data for {code} in {ctry}: {str(data)[:200]}")
    series: dict[str, list[list[Any]]] = {}
    name = ""
    for row in data[1]:
        if row.get("value") is None:
            continue
        name = row.get("indicator", {}).get("value", name)
        series.setdefault(row.get("country", {}).get("value", "?"), []).append([int(row["date"]), row["value"]])
    for k in series:
        series[k].sort()
    return {"title": name or code, "unit": "", "source": f"World Bank ({code})", "page": f"https://data.worldbank.org/indicator/{code}", "series": series}


async def owid(slug: str, countries: list[str]) -> dict[str, Any]:
    slug = slug.strip().rstrip("/").rsplit("/", 1)[-1]
    params = {"v": "1", "csvType": "filtered", "useColumnShortNames": "true"}
    if countries:
        params["country"] = "~".join(c.strip() for c in countries if c.strip())
    async with httpx.AsyncClient(timeout=40, headers=UA, follow_redirects=True) as client:
        r = await client.get(f"https://ourworldindata.org/grapher/{quote(slug)}.csv", params=params)
        if r.status_code >= 400:
            raise ValueError(f"Our World in Data has no chart '{slug}' ({r.status_code}); find the slug with data_search")
        meta = {}
        try:
            meta = (await client.get(f"https://ourworldindata.org/grapher/{quote(slug)}.metadata.json")).json()
        except Exception:
            pass
    return parse_owid(r.text, slug, meta)


def parse_owid(text: str, slug: str, meta: dict[str, Any] | None = None) -> dict[str, Any]:
    rows = list(csv.reader(io.StringIO(text)))
    if len(rows) < 2:
        raise ValueError("empty data")
    head = rows[0]
    ent_i = head.index("entity") if "entity" in head else 0
    year_i = head.index("year") if "year" in head else (head.index("day") if "day" in head else 2)
    cols = [i for i, h in enumerate(head) if i not in (ent_i, year_i, head.index("code") if "code" in head else -1)]
    col = cols[0] if cols else len(head) - 1
    series: dict[str, list[list[Any]]] = {}
    for row in rows[1:]:
        try:
            v = float(row[col])
        except (ValueError, IndexError):
            continue
        y = row[year_i]
        series.setdefault(row[ent_i], []).append([int(y) if y.isdigit() else y, v])
    cm = ((meta or {}).get("columns") or {}).get(head[col], {}) if meta else {}
    return {"title": (meta or {}).get("chart", {}).get("title") or cm.get("titleShort") or slug.replace("-", " "), "unit": cm.get("unit", ""),
            "source": f"Our World in Data ({cm.get('citationShort') or 'ourworldindata.org'})", "page": f"https://ourworldindata.org/grapher/{slug}", "series": series,
            "column": head[col]}


def summarize(data: dict[str, Any], points: int = 12) -> str:
    lines = [f"{data['title']} {('(' + data['unit'] + ')') if data.get('unit') else ''} source: {data['source']}"]
    for name, pts in list(data["series"].items())[:8]:
        step = max(1, len(pts) // points)
        sample = pts[::step]
        if pts and sample[-1] != pts[-1]:
            sample.append(pts[-1])
        lines.append(f"{name}: " + ", ".join(f"{y} {v:,.4g}" if isinstance(v, (int, float)) else f"{y} {v}" for y, v in sample))
    return "\n".join(lines)


def save_data(pid: str, data: dict[str, Any], name: str = "") -> dict[str, Any]:
    aid = "as_" + uuid.uuid4().hex[:10]
    path = project_dir(pid) / "assets" / f"{aid}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return _register(pid, path, "data", "application/json", name or data.get("title", "data"), {"source": data.get("source"), "page": data.get("page"), "attribution": f"Data: {data.get('source')}"})


class GenerationDisabled(RuntimeError):
    pass


async def generate_image(pid: str, prompt: str, width: int = 1280, height: int = 720, seed: int | None = None, model: str = "flux", name: str = "") -> dict[str, Any]:
    from . import llm as llmmod
    media = llmmod.media_settings()
    if not media.get("image_gen"):
        raise GenerationDisabled("image generation is turned off; enable it in Settings > Voice and generation")
    key = media.get("pollinations_key", "")
    seed = int(seed if seed is not None else uuid.uuid4().int % 100000)
    params = {"width": max(256, min(2048, int(width))), "height": max(256, min(2048, int(height))), "seed": seed, "nologo": "true", "model": model, "private": "true"}
    attempts = []
    if key:
        attempts.append((f"https://gen.pollinations.ai/image/{quote(prompt[:900])}", params, dict(UA, Authorization=f"Bearer {key}"), True))
        attempts.append((f"https://image.pollinations.ai/prompt/{quote(prompt[:900])}", dict(params, token=key), UA, True))
    attempts.append((f"https://image.pollinations.ai/prompt/{quote(prompt[:900])}", params, UA, False))
    clean = False
    async with _pollinate:
        async with httpx.AsyncClient(timeout=180, follow_redirects=True) as client:
            last = ""
            r = None
            for url, prm, headers, keyed in attempts:
                for attempt in range(3):
                    r = await client.get(url, params=prm, headers=headers)
                    if r.status_code == 200 and r.headers.get("content-type", "").startswith("image"):
                        break
                    last = f"{r.status_code} {r.text[:160]}"
                    if r.status_code in (401, 402, 403):
                        break
                    await asyncio.sleep(4 * (attempt + 1) if r.status_code == 429 else 2)
                if r is not None and r.status_code == 200 and r.headers.get("content-type", "").startswith("image"):
                    clean = keyed
                    break
            else:
                raise RuntimeError(f"image generator failed: {last}")
    ext = ".png" if "png" in r.headers.get("content-type", "") else ".jpg"
    aid = "as_" + uuid.uuid4().hex[:10]
    path = project_dir(pid) / "assets" / f"{aid}{ext}"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(r.content)
    from PIL import Image
    with Image.open(path) as im:
        w, h = im.size
    meta = {"source": "pollinations", "generated": True, "prompt": prompt[:400], "seed": seed, "model": model, "width": w, "height": h, "clean": clean,
            "attribution": "AI-generated illustration (Pollinations)"}
    return _register(pid, path, "image", r.headers.get("content-type", "image/jpeg"), name or ("generated: " + prompt[:60]), meta, role="generated")
