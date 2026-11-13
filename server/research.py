from __future__ import annotations

import asyncio
import html as htmllib
import re
import time
from typing import Any, Callable
from urllib.parse import parse_qs, unquote, urlparse

import httpx

from . import config

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36"
HEADERS = {"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", "Accept": "text/html,application/xhtml+xml"}
ENGINES = ["duckduckgo", "duckduckgo_lite", "wikipedia", "bing", "brave"]
_last: dict[str, float] = {}


def clean(text: str) -> str:
    text = re.sub(r"(?is)<(script|style|noscript|svg).*?</\1>", " ", text or "")
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", htmllib.unescape(text)).strip()


async def _get(client: httpx.AsyncClient, url: str, params: dict[str, Any] | None = None) -> str:
    host = urlparse(url).netloc
    wait = 1.1 - (time.time() - _last.get(host, 0))
    if wait > 0:
        await asyncio.sleep(wait)
    _last[host] = time.time()
    r = await client.get(url, params=params, headers=HEADERS, timeout=20, follow_redirects=True)
    if r.status_code >= 400:
        raise RuntimeError(f"{host} {r.status_code}")
    return r.text


def _unwrap(url: str) -> str:
    if "bing.com/ck/a" in url:
        import base64
        q = parse_qs(urlparse(url).query)
        u = (q.get("u") or [""])[0]
        if u.startswith("a1"):
            raw = u[2:]
            try:
                return base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4)).decode("utf-8", "ignore")
            except Exception:
                return url
    if "duckduckgo.com/l/" in url or "uddg=" in url:
        q = parse_qs(urlparse(url if url.startswith("http") else "https:" + url).query)
        if "uddg" in q:
            return unquote(q["uddg"][0])
    if url.startswith("//"):
        return "https:" + url
    return url


async def search_duckduckgo(client, query, limit):
    page = await _get(client, "https://html.duckduckgo.com/html/", {"q": query})
    out = []
    for m in re.finditer(r'(?is)<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)</a>.*?(?:class="result__snippet"[^>]*>(.*?)</a>)?', page):
        url = _unwrap(htmllib.unescape(m.group(1)))
        if url.startswith("http") and "duckduckgo.com" not in url:
            out.append({"title": clean(m.group(2)), "url": url, "snippet": clean(m.group(3) or "")})
    return out[:limit]


async def search_duckduckgo_lite(client, query, limit):
    page = await _get(client, "https://lite.duckduckgo.com/lite/", {"q": query})
    out = []
    for m in re.finditer(r'(?is)<a[^>]+href="([^"]+)"[^>]*class=.result-link.[^>]*>(.*?)</a>', page):
        url = _unwrap(htmllib.unescape(m.group(1)))
        if url.startswith("http"):
            out.append({"title": clean(m.group(2)), "url": url, "snippet": ""})
    return out[:limit]


async def search_brave(client, query, limit):
    page = await _get(client, "https://search.brave.com/search", {"q": query, "source": "web"})
    out = []
    for m in re.finditer(r'(?is)<a[^>]+href="(https?://[^"]+)"[^>]*class="[^"]*(?:heading-serpresult|l1)[^"]*"[^>]*>(.*?)</a>', page):
        url = m.group(1)
        if "brave.com" in url:
            continue
        out.append({"title": clean(m.group(2))[:160], "url": url, "snippet": ""})
    if not out:
        for m in re.finditer(r'(?is)<div class="snippet[^"]*"[^>]*>.*?<a[^>]+href="(https?://[^"]+)".*?<div class="title[^"]*"[^>]*>(.*?)</div>', page):
            if "brave.com" not in m.group(1):
                out.append({"title": clean(m.group(2)), "url": m.group(1), "snippet": ""})
    return out[:limit]


async def search_bing(client, query, limit):
    page = await _get(client, "https://www.bing.com/search", {"q": query, "setlang": "en"})
    out = []
    for m in re.finditer(r'(?is)<li class="b_algo".*?<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>.*?(?:<p[^>]*>(.*?)</p>)?', page):
        url = _unwrap(htmllib.unescape(m.group(1)))
        if url.startswith("http"):
            out.append({"title": clean(m.group(2)), "url": url, "snippet": clean(m.group(3) or "")[:300]})
    return out[:limit]


async def search_mojeek(client, query, limit):
    page = await _get(client, "https://www.mojeek.com/search", {"q": query})
    out = []
    for m in re.finditer(r'(?is)<a[^>]+class="ob"[^>]+href="([^"]+)"[^>]*>(.*?)</a>.*?<p class="s">(.*?)</p>', page):
        out.append({"title": clean(m.group(2)), "url": htmllib.unescape(m.group(1)), "snippet": clean(m.group(3))[:300]})
    if not out:
        for m in re.finditer(r'(?is)<h2>\s*<a[^>]+href="(https?://[^"]+)"[^>]*>(.*?)</a>', page):
            out.append({"title": clean(m.group(2)), "url": m.group(1), "snippet": ""})
    return out[:limit]


async def search_wikipedia(client, query, limit):
    r = await client.get("https://en.wikipedia.org/w/api.php", params={"action": "query", "list": "search", "srsearch": query, "format": "json", "srlimit": limit},
                         headers={"User-Agent": "AuteurFrame/1.0 (+https://github.com/joyghoshs/auteurframe) httpx/0.27"}, timeout=20)
    out = []
    for item in r.json().get("query", {}).get("search", []):
        title = item["title"]
        out.append({"title": title, "url": "https://en.wikipedia.org/wiki/" + title.replace(" ", "_"), "snippet": clean(item.get("snippet", ""))})
    return out


async def search_github(client, query, limit):
    r = await client.get("https://api.github.com/search/repositories", params={"q": query, "per_page": limit, "sort": "stars"},
                         headers={"Accept": "application/vnd.github+json", "User-Agent": "AuteurFrame"}, timeout=20)
    return [{"title": i["full_name"] + " — " + (i.get("description") or "")[:120], "url": i["html_url"], "snippet": f"{i.get('stargazers_count', 0)} stars"} for i in r.json().get("items", [])]


FUNCS = {
    "duckduckgo": search_duckduckgo, "duckduckgo_lite": search_duckduckgo_lite, "brave": search_brave, "bing": search_bing,
    "mojeek": search_mojeek, "wikipedia": search_wikipedia, "github": search_github,
}


async def search(query: str, limit: int = 8, engines: list[str] | None = None, on_event: Callable[[str, dict], None] | None = None) -> dict[str, Any]:
    order = engines or ENGINES
    results: list[dict[str, Any]] = []
    seen: set[str] = set()
    tried = []
    async with httpx.AsyncClient() as client:
        for engine in order:
            fn = FUNCS.get(engine)
            if not fn:
                continue
            try:
                found = await fn(client, query, limit)
                tried.append({"engine": engine, "count": len(found)})
            except Exception as error:
                tried.append({"engine": engine, "error": str(error)[:120]})
                continue
            for item in found:
                key = re.sub(r"[#?].*$", "", item["url"]).rstrip("/")
                if key in seen:
                    continue
                seen.add(key)
                item["engine"] = engine
                results.append(item)
            if on_event:
                on_event("search.engine", {"engine": engine, "query": query, "count": len(found)})
            if len(results) >= limit and engine != "wikipedia":
                break
    return {"query": query, "results": results[:limit + 4], "engines": tried}


async def browse(url: str, frames: int = 2, on_frame: Callable[[str], None] | None = None) -> dict[str, Any]:
    if not re.match(r"^https?://", url or ""):
        raise ValueError("only http and https pages can be browsed")
    host = urlparse(url).hostname or ""
    if host in ("localhost", "127.0.0.1", "0.0.0.0") or host.startswith(("10.", "192.168.", "169.254.")):
        raise ValueError("private addresses cannot be browsed")
    try:
        async with httpx.AsyncClient(timeout=45) as client:
            r = await client.post(config.RENDERER_URL + "/browse", json={"url": url, "frames": frames, "width": 1280, "height": 800})
            data = r.json()
            if "error" in data:
                raise RuntimeError(data["error"])
            for frame in data.get("frames", []):
                if on_frame and frame.get("jpeg"):
                    on_frame(frame["jpeg"])
            data["text"] = (data.get("text") or "")[:20000]
            data["via"] = "browser"
            return data
    except Exception:
        async with httpx.AsyncClient(timeout=25, follow_redirects=True) as client:
            r = await client.get(url, headers=HEADERS)
            body = r.text
            title = clean((re.search(r"(?is)<title>(.*?)</title>", body) or [None, ""])[1]) if "<title" in body.lower() else ""
            return {"url": str(r.url), "title": title, "text": clean(body)[:20000], "links": [], "frames": [], "via": "http"}


def excerpt(text: str, query: str, size: int = 1600) -> str:
    words = [w for w in re.findall(r"[a-z0-9]{4,}", query.lower())]
    paras = [p.strip() for p in re.split(r"\n{2,}|(?<=[.!?])\s{2,}", text) if len(p.strip()) > 60]
    scored = sorted(paras, key=lambda p: -sum(p.lower().count(w) for w in words))
    out, total = [], 0
    for p in scored[:8]:
        if total + len(p) > size:
            break
        out.append(p)
        total += len(p)
    return "\n".join(out) if out else text[:size]
