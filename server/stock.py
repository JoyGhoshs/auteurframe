from __future__ import annotations

import ipaddress
import re
import socket
import time
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlparse

import httpx

from . import llm

UA = {"User-Agent": "AuteurFrame/1.0 (+https://github.com/joyghoshs/auteurframe) httpx/0.27"}
MAX_BYTES = 40 * 1024 * 1024
SOURCES = ["openverse", "wikimedia", "pexels", "pixabay", "unsplash"]


def keys() -> dict[str, str]:
    return dict(llm.read_settings().get("stock", {}))


def _safe_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https") or not parsed.hostname:
            return False
        for info in socket.getaddrinfo(parsed.hostname, None):
            ip = ipaddress.ip_address(info[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                return False
        return True
    except Exception:
        return False


async def _openverse(client: httpx.AsyncClient, q: str, page: int, kind: str) -> list[dict[str, Any]]:
    if kind != "image":
        return []
    r = await client.get("https://api.openverse.org/v1/images/", params={"q": q, "page_size": 20, "page": page}, headers=UA)
    r.raise_for_status()
    out = []
    for it in r.json().get("results", []):
        out.append({"id": "ov_" + it["id"], "source": "openverse", "kind": "image", "title": it.get("title") or q, "thumb": it.get("thumbnail") or it.get("url"),
                    "url": it.get("url"), "width": it.get("width"), "height": it.get("height"), "author": it.get("creator") or "",
                    "license": f"{(it.get('license') or '').upper()} {it.get('license_version') or ''}".strip(), "page": it.get("foreign_landing_url")})
    return out


async def _wikimedia(client: httpx.AsyncClient, q: str, page: int, kind: str) -> list[dict[str, Any]]:
    ftype = "bitmap" if kind == "image" else "video"
    params = {"action": "query", "format": "json", "generator": "search", "gsrsearch": f"{q} filetype:{ftype}", "gsrnamespace": 6, "gsrlimit": 20,
              "gsroffset": (page - 1) * 24, "prop": "imageinfo", "iiprop": "url|size|extmetadata|mime", "iiurlwidth": 480}
    r = await client.get("https://commons.wikimedia.org/w/api.php", params=params, headers=UA)
    r.raise_for_status()
    pages = (r.json().get("query") or {}).get("pages", {})
    out = []
    for pg in sorted(pages.values(), key=lambda p: p.get("index", 0)):
        info = (pg.get("imageinfo") or [{}])[0]
        meta = info.get("extmetadata") or {}
        mime = info.get("mime", "")
        if kind == "image" and not mime.startswith("image/"):
            continue
        if kind == "video" and not mime.startswith("video/"):
            continue
        out.append({"id": f"wm_{pg['pageid']}", "source": "wikimedia", "kind": kind, "title": re.sub(r"^File:|\.\w+$", "", pg.get("title", "")),
                    "thumb": info.get("thumburl") or info.get("url"), "url": info.get("url"), "width": info.get("width"), "height": info.get("height"),
                    "author": re.sub(r"<[^>]+>", "", (meta.get("Artist") or {}).get("value", ""))[:80], "license": (meta.get("LicenseShortName") or {}).get("value", ""),
                    "page": info.get("descriptionurl")})
    return out


async def _pexels(client: httpx.AsyncClient, q: str, page: int, kind: str, key: str) -> list[dict[str, Any]]:
    if kind == "video":
        r = await client.get("https://api.pexels.com/videos/search", params={"query": q, "per_page": 24, "page": page}, headers={"Authorization": key})
        out = []
        for v in r.json().get("videos", []):
            files = sorted([f for f in v.get("video_files", []) if f.get("file_type") == "video/mp4" and (f.get("width") or 0) <= 1920], key=lambda f: -(f.get("width") or 0))
            if files:
                out.append({"id": f"px_{v['id']}", "source": "pexels", "kind": "video", "title": q, "thumb": v.get("image"), "url": files[0]["link"], "width": files[0].get("width"),
                            "height": files[0].get("height"), "author": (v.get("user") or {}).get("name", ""), "license": "Pexels License", "page": v.get("url")})
        return out
    r = await client.get("https://api.pexels.com/v1/search", params={"query": q, "per_page": 24, "page": page}, headers={"Authorization": key})
    return [{"id": f"px_{p['id']}", "source": "pexels", "kind": "image", "title": p.get("alt") or q, "thumb": p["src"]["medium"], "url": p["src"]["large2x"],
             "width": p.get("width"), "height": p.get("height"), "author": p.get("photographer", ""), "license": "Pexels License", "page": p.get("url")} for p in r.json().get("photos", [])]


async def _pixabay(client: httpx.AsyncClient, q: str, page: int, kind: str, key: str) -> list[dict[str, Any]]:
    if kind == "video":
        r = await client.get("https://pixabay.com/api/videos/", params={"key": key, "q": q, "per_page": 24, "page": page, "safesearch": "true"})
        out = []
        for v in r.json().get("hits", []):
            vid = (v.get("videos") or {}).get("medium") or (v.get("videos") or {}).get("small") or {}
            out.append({"id": f"pb_{v['id']}", "source": "pixabay", "kind": "video", "title": v.get("tags") or q, "thumb": vid.get("thumbnail") or "", "url": vid.get("url"),
                        "width": vid.get("width"), "height": vid.get("height"), "author": v.get("user", ""), "license": "Pixabay License", "page": v.get("pageURL")})
        return out
    r = await client.get("https://pixabay.com/api/", params={"key": key, "q": q, "per_page": 24, "page": page, "safesearch": "true", "image_type": "photo"})
    return [{"id": f"pb_{h['id']}", "source": "pixabay", "kind": "image", "title": h.get("tags") or q, "thumb": h.get("webformatURL"), "url": h.get("largeImageURL"),
             "width": h.get("imageWidth"), "height": h.get("imageHeight"), "author": h.get("user", ""), "license": "Pixabay License", "page": h.get("pageURL")} for h in r.json().get("hits", [])]


async def _unsplash(client: httpx.AsyncClient, q: str, page: int, kind: str, key: str) -> list[dict[str, Any]]:
    if kind != "image":
        return []
    r = await client.get("https://api.unsplash.com/search/photos", params={"query": q, "per_page": 24, "page": page}, headers={"Authorization": f"Client-ID {key}"})
    return [{"id": f"us_{p['id']}", "source": "unsplash", "kind": "image", "title": p.get("alt_description") or q, "thumb": p["urls"]["small"], "url": p["urls"]["regular"],
             "width": p.get("width"), "height": p.get("height"), "author": (p.get("user") or {}).get("name", ""), "license": "Unsplash License", "page": (p.get("links") or {}).get("html")} for p in r.json().get("results", [])]


async def search(q: str, kind: str = "image", source: str = "auto", page: int = 1) -> dict[str, Any]:
    q = (q or "").strip()[:120]
    if not q:
        return {"results": [], "sources": []}
    k = keys()
    order = [source] if source != "auto" else [s for s in ("pexels", "unsplash", "pixabay") if k.get(s)] + ["openverse", "wikimedia"]
    results: list[dict[str, Any]] = []
    tried = []
    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        for src in order:
            try:
                if src == "openverse":
                    found = await _openverse(client, q, page, kind)
                elif src == "wikimedia":
                    found = await _wikimedia(client, q, page, kind)
                elif src in ("pexels", "pixabay", "unsplash"):
                    if not k.get(src):
                        tried.append({"source": src, "error": "add an API key in Models settings"})
                        continue
                    found = await {"pexels": _pexels, "pixabay": _pixabay, "unsplash": _unsplash}[src](client, q, page, kind, k[src])
                else:
                    continue
                tried.append({"source": src, "count": len(found)})
                results += [r for r in found if r.get("url")]
            except Exception as error:
                tried.append({"source": src, "error": str(error)[:120]})
            if source == "auto" and len(results) >= 18:
                break
    return {"results": results[:48], "sources": tried, "query": q}


async def download(url: str, dest_dir: Path, prefer: str = "image") -> tuple[Path, str]:
    if not _safe_url(url):
        raise ValueError("that address is not allowed")
    async with httpx.AsyncClient(timeout=60, follow_redirects=True, headers=UA) as client:
        async with client.stream("GET", url) as r:
            if r.status_code >= 400:
                raise ValueError(f"download failed with {r.status_code}")
            ctype = r.headers.get("content-type", "").split(";")[0].strip()
            if not (ctype.startswith("image/") or ctype.startswith("video/") or ctype == "application/octet-stream"):
                raise ValueError(f"not a media file ({ctype})")
            ext = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif", "image/svg+xml": ".svg", "video/mp4": ".mp4", "video/webm": ".webm"}.get(ctype)
            if not ext:
                m = re.search(r"\.(jpe?g|png|webp|gif|svg|mp4|webm)(\?|$)", url, re.I)
                ext = "." + (m.group(1).lower() if m else ("jpg" if prefer == "image" else "mp4"))
            aid = "as_" + uuid.uuid4().hex[:10]
            path = dest_dir / f"{aid}{ext}"
            size = 0
            with open(path, "wb") as handle:
                async for chunk in r.aiter_bytes(1 << 16):
                    size += len(chunk)
                    if size > MAX_BYTES:
                        handle.close()
                        path.unlink(missing_ok=True)
                        raise ValueError("file too large")
                    handle.write(chunk)
    return path, ctype


async def icons(q: str, limit: int = 96, prefix: str = "") -> dict[str, Any]:
    q = (q or "").strip()[:60]
    if not q:
        return {"icons": []}
    params: dict[str, Any] = {"query": q, "limit": limit}
    if prefix:
        params["prefixes"] = prefix
    async with httpx.AsyncClient(timeout=15, headers=UA) as client:
        r = await client.get("https://api.iconify.design/search", params=params)
        names = r.json().get("icons", [])
    return {"icons": [{"name": n, "svg": f"https://api.iconify.design/{n.replace(':', '/')}.svg"} for n in names]}


async def icon_svg(name: str, color: str = "") -> str:
    if not re.fullmatch(r"[a-z0-9-]+:[a-z0-9-]+", name or ""):
        raise ValueError("bad icon name")
    prefix, icon = name.split(":")
    url = f"https://api.iconify.design/{prefix}/{icon}.svg?height=512" + (f"&color={quote(color)}" if color else "")
    async with httpx.AsyncClient(timeout=15, headers=UA) as client:
        r = await client.get(url)
        if r.status_code >= 400 or "<svg" not in r.text:
            raise ValueError("icon not found")
        return r.text


def attribution(item: dict[str, Any]) -> str:
    bits = [item.get("title") or "", item.get("author") and f"by {item['author']}", item.get("license"), item.get("source")]
    return " · ".join(b for b in bits if b)[:240]


_cache: dict[str, tuple[float, Any]] = {}


async def cached_search(q: str, kind: str, source: str, page: int) -> dict[str, Any]:
    key = f"{q}|{kind}|{source}|{page}"
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < 600:
        return hit[1]
    data = await search(q, kind, source, page)
    _cache[key] = (time.time(), data)
    return data
