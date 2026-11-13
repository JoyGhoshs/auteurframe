from __future__ import annotations

import asyncio
import base64
import io
import json
import re
import time
import uuid
from pathlib import Path
from typing import Any

import httpx

from . import config, maps, research, stock
from .store import project_dir, store

STYLE_HINT = {"photo": "", "illustration": "illustration", "vector": "vector svg", "icon": "icon", "transparent": "transparent png", "drawing": "drawing", "map": "map",
              "historical": "historical photograph", "portrait": "portrait"}


def _add_asset(pid: str, path: Path, kind: str, mime: str, name: str, meta: dict[str, Any], role: str = "reference") -> dict[str, Any]:
    if kind == "image":
        try:
            from PIL import Image
            with Image.open(path) as im:
                meta["width"], meta["height"] = im.size
        except Exception:
            pass
    asset = {"id": path.stem, "name": (name or path.name)[:80], "file": path.name, "kind": kind, "mime": mime, "size": path.stat().st_size, "role": role,
             "url": f"/media/{pid}/assets/{path.name}", "meta": meta, "added": time.time()}

    def apply(p: dict[str, Any]) -> None:
        p.setdefault("assets", []).append(asset)
        credit = meta.get("attribution") or meta.get("credit")
        if credit:
            credits = p.setdefault("credits", [])
            if credit not in credits:
                credits.append(credit)
    store.mutate(pid, apply)
    try:
        from . import bus
        bus.publish(pid, "asset.added", {"asset": asset})
    except Exception:
        pass
    return asset


async def web_search(query: str, limit: int = 8) -> list[dict[str, Any]]:
    data = await research.search(query, limit)
    return data.get("results", [])[:limit]


async def read_page(url: str, query: str = "") -> dict[str, Any]:
    data = await research.browse(url, frames=1)
    text = data.get("text") or ""
    return {"title": data.get("title", ""), "url": data.get("url", url), "description": data.get("description", ""), "image": data.get("image", ""),
            "text": research.excerpt(text, query, 3600) if query else text[:3600], "links": (data.get("links") or [])[:15],
            "frame": (data.get("frames") or [{}])[-1].get("jpeg") if data.get("frames") else None}


async def search_images(query: str, style: str = "photo", source: str = "auto", page: int = 1) -> list[dict[str, Any]]:
    from .media_sources import with_relaxation
    return await with_relaxation(_search_images_once, query, style, source, page, want=4)


async def _search_images_once(query: str, style: str = "photo", source: str = "auto", page: int = 1) -> list[dict[str, Any]]:
    style = (style or "photo").lower()
    q = query.strip()
    if style in ("illustration", "vector", "transparent", "drawing", "icon") and STYLE_HINT.get(style) and STYLE_HINT[style] not in q.lower():
        q = f"{q} {STYLE_HINT[style]}"
    jobs = []
    if style in ("vector", "illustration", "transparent", "drawing", "icon"):
        jobs.append(_openverse_styled(query, style, page))
        if style in ("vector", "icon", "drawing"):
            jobs.append(_commons_svg(query))
    if source == "auto":
        keyed = [s for s in ("pexels", "unsplash", "pixabay") if stock.keys().get(s)]
        for src in keyed + ["openverse", "wikimedia"]:
            jobs.append(_stock_one(q, src, page))
    else:
        jobs.append(_stock_one(q, source, page))
    batches = await asyncio.gather(*jobs, return_exceptions=True)
    items: list[dict[str, Any]] = []
    seen: set[str] = set()
    for batch in batches:
        if isinstance(batch, BaseException):
            continue
        for it in batch:
            if it.get("url") and it["url"] not in seen:
                seen.add(it["url"])
                items.append(it)
    want = 1200 if style in ("photo", "historical", "portrait", "any") else 0

    def rank(pair: tuple[int, dict[str, Any]]) -> tuple[int, int]:
        i, it = pair
        w = it.get("width") or 0
        return (0 if (w >= want or (not w and it["url"].endswith(".svg"))) else 1, i)
    return [it for _, it in sorted(enumerate(items), key=rank)][:30]


async def _stock_one(q: str, source: str, page: int) -> list[dict[str, Any]]:
    try:
        data = await asyncio.wait_for(stock.cached_search(q, "image", source, page), timeout=25)
    except Exception:
        return []
    return data.get("results", [])


async def _openverse_styled(query: str, style: str, page: int) -> list[dict[str, Any]]:
    params: dict[str, Any] = {"q": query, "page_size": 20, "page": page}
    if style in ("vector", "icon"):
        params["extension"] = "svg"
    elif style == "transparent":
        params["extension"] = "png"
    if style in ("illustration", "drawing"):
        params["category"] = "illustration,digitized_artwork"
    try:
        async with httpx.AsyncClient(timeout=20, headers=stock.UA) as client:
            r = await client.get("https://api.openverse.org/v1/images/", params=params)
            r.raise_for_status()
            rows = r.json().get("results", [])
    except Exception:
        return []
    return [{"id": "ov_" + it["id"], "source": "openverse", "kind": "image", "title": it.get("title") or query, "thumb": it.get("thumbnail") or it.get("url"), "url": it.get("url"),
             "width": it.get("width"), "height": it.get("height"), "author": it.get("creator") or "",
             "license": f"{(it.get('license') or '').upper()} {it.get('license_version') or ''}".strip(), "page": it.get("foreign_landing_url")} for it in rows if it.get("url")]


async def _commons_svg(query: str) -> list[dict[str, Any]]:
    params = {"action": "query", "format": "json", "generator": "search", "gsrsearch": f"{query} filetype:drawing", "gsrnamespace": 6, "gsrlimit": 12,
              "prop": "imageinfo", "iiprop": "url|size|extmetadata|mime", "iiurlwidth": 480}
    try:
        async with httpx.AsyncClient(timeout=20, headers=stock.UA) as client:
            r = await client.get("https://commons.wikimedia.org/w/api.php", params=params)
            pages = (r.json().get("query") or {}).get("pages", {})
    except Exception:
        return []
    out = []
    for pg in sorted(pages.values(), key=lambda p: p.get("index", 0)):
        info = (pg.get("imageinfo") or [{}])[0]
        meta = info.get("extmetadata") or {}
        if not info.get("url"):
            continue
        out.append({"id": f"wm_{pg['pageid']}", "source": "wikimedia", "kind": "image", "title": re.sub(r"^File:|\.\w+$", "", pg.get("title", "")), "thumb": info.get("thumburl") or info.get("url"),
                    "url": info.get("url"), "width": info.get("width"), "height": info.get("height"), "author": re.sub(r"<[^>]+>", "", (meta.get("Artist") or {}).get("value", ""))[:80],
                    "license": (meta.get("LicenseShortName") or {}).get("value", ""), "page": info.get("descriptionurl")})
    return out


async def collect(pid: str, item: dict[str, Any], name: str = "") -> dict[str, Any]:
    try:
        path, ctype = await stock.download(item["url"], project_dir(pid) / "assets", "image")
    except ValueError as error:
        raise ValueError(f"{error}; this image is no longer available at its source, collect another candidate") from error
    kind = "video" if ctype.startswith("video/") else ("svg" if path.suffix == ".svg" else "image")
    meta = {"attribution": stock.attribution(item) if item.get("source") else (f"Image from {item.get('page') or item['url']}"[:240]), "source": item.get("source") or "web",
            "page": item.get("page") or item.get("url"), "license": item.get("license", "")}
    return _add_asset(pid, path, kind, ctype, name or item.get("title") or path.name, meta)


async def collect_icon(pid: str, name: str, color: str = "") -> dict[str, Any]:
    svg = await stock.icon_svg(name, color)
    aid = "as_" + uuid.uuid4().hex[:10]
    path = project_dir(pid) / "assets" / f"{aid}.svg"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(svg, encoding="utf-8")
    return _add_asset(pid, path, "svg", "image/svg+xml", name, {"source": "iconify", "attribution": f"Icon {name} via Iconify", "svg": svg[:4000]})


async def capture(url: str, opts: dict[str, Any]) -> dict[str, Any]:
    if not stock._safe_url(url):
        raise ValueError("only public http and https pages can be captured")
    job = {"url": url}
    for k in ("width", "height", "scale", "full", "selector", "find", "scrollTo", "dark", "hide", "wait", "clean", "images", "minImage", "maxHeight"):
        if k in opts:
            job[k] = opts[k]
    if isinstance(job.get("find"), str):
        job["find"] = [job["find"]]
    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(config.RENDERER_URL + "/capture", json=job)
    data = r.json()
    if r.status_code >= 400 or data.get("error"):
        raise RuntimeError(data.get("error") or f"renderer answered {r.status_code}")
    return data


async def screenshot(pid: str, url: str, opts: dict[str, Any]) -> dict[str, Any]:
    data = await capture(url, opts)
    raw = base64.b64decode(data["png"])
    aid = "as_" + uuid.uuid4().hex[:10]
    path = project_dir(pid) / "assets" / f"{aid}.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(raw)
    host = re.sub(r"^www\.", "", re.sub(r"^https?://([^/]+).*$", r"\1", data.get("url") or url))
    meta = {"source": "screenshot", "page": data.get("url") or url, "title": data.get("title", ""), "attribution": f"Screenshot of {host}", "boxes": data.get("boxes", [])}
    asset = _add_asset(pid, path, "image", "image/png", f"{host} {data.get('title', '')}"[:80], meta)
    return {"asset": asset, "data": data, "host": host, "raw": raw}


def thumb_sheet(items: list[tuple[str, bytes | None]], cols: int = 4, cell: int = 300) -> str:
    from PIL import Image, ImageDraw
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell, rows * cell), (245, 245, 245))
    draw = ImageDraw.Draw(sheet)
    for i, (label, raw) in enumerate(items):
        x, y = (i % cols) * cell, (i // cols) * cell
        if raw:
            try:
                im = Image.open(io.BytesIO(raw)).convert("RGB")
                im.thumbnail((cell - 8, cell - 30))
                sheet.paste(im, (x + (cell - im.width) // 2, y + 4 + (cell - 30 - im.height) // 2))
            except Exception:
                draw.text((x + 10, y + 120), "not an image", fill=(150, 0, 0))
        draw.rectangle([x, y + cell - 24, x + cell, y + cell], fill=(20, 20, 20))
        draw.text((x + 6, y + cell - 19), label[:44], fill=(255, 255, 255))
    out = io.BytesIO()
    sheet.save(out, "JPEG", quality=78)
    return base64.b64encode(out.getvalue()).decode()


async def fetch_thumbs(urls: list[str]) -> list[bytes | None]:
    async def one(client: httpx.AsyncClient, u: str) -> bytes | None:
        if not u or not stock._safe_url(u):
            return None
        try:
            r = await client.get(u)
            if r.status_code == 200 and len(r.content) < 15 * 1024 * 1024:
                return r.content
        except Exception:
            return None
        return None
    async with httpx.AsyncClient(timeout=20, headers=stock.UA, follow_redirects=True) as client:
        return await asyncio.gather(*(one(client, u) for u in urls))


async def make_map(project: dict[str, Any], spec: dict[str, Any], duration: float, on_progress: Any = None) -> dict[str, Any]:
    return await maps.build(project, spec, duration, on_progress)


def describe(item: dict[str, Any]) -> str:
    size = f"{item.get('width')}x{item.get('height')}" if item.get("width") else "size unknown"
    bits = [item.get("title") or item.get("alt") or "", size, item.get("license") or "", item.get("source") or item.get("kind") or ""]
    return " · ".join(str(b)[:90] for b in bits if b)


def jdump(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False)
