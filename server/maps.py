from __future__ import annotations

import asyncio
import hashlib
import json
import math
import os
import re
import shutil
import time
import uuid
from pathlib import Path
from typing import Any, Callable

import httpx

from . import config
from .store import project_dir, store

UA = {"User-Agent": "AuteurFrame/1.0 (+https://github.com/joyghoshs/auteurframe) map animation"}
CACHE = config.DATA / "cache"
TILE_CACHE = CACHE / "tiles"
GEO_CACHE = CACHE / "geocode"
NE_CACHE = CACHE / "naturalearth"
NE_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_{res}_admin_0_countries.geojson"
OSRM = "https://router.project-osrm.org/route/v1/driving/"
OSM = "© OpenStreetMap contributors"
ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/{v}/MapServer/tile/{z}/{y}/{x}"
ESRI_CANVAS = "Tiles © Esri (Esri, HERE, Garmin, © OpenStreetMap contributors, GIS community)"
STYLES: dict[str, dict[str, Any]] = {
    "light": {"url": ESRI.replace("{v}", "Canvas/World_Light_Gray_Base"), "labels": ESRI.replace("{v}", "Canvas/World_Light_Gray_Reference"), "size": 256, "max": 16,
              "credit": ESRI_CANVAS, "parallel": 12, "ext": "jpg"},
    "light-nolabels": {"url": ESRI.replace("{v}", "Canvas/World_Light_Gray_Base"), "size": 256, "max": 16, "credit": ESRI_CANVAS, "parallel": 12, "ext": "jpg"},
    "dark": {"url": ESRI.replace("{v}", "Canvas/World_Dark_Gray_Base"), "labels": ESRI.replace("{v}", "Canvas/World_Dark_Gray_Reference"), "size": 256, "max": 16,
             "credit": ESRI_CANVAS, "parallel": 12, "ext": "jpg"},
    "dark-nolabels": {"url": ESRI.replace("{v}", "Canvas/World_Dark_Gray_Base"), "size": 256, "max": 16, "credit": ESRI_CANVAS, "parallel": 12, "ext": "jpg"},
    "streets": {"url": ESRI.replace("{v}", "World_Street_Map"), "size": 256, "max": 19, "credit": "Tiles © Esri (Esri, HERE, Garmin, USGS, NGA, © OpenStreetMap contributors)", "parallel": 12, "ext": "jpg"},
    "topo": {"url": ESRI.replace("{v}", "World_Topo_Map"), "size": 256, "max": 19, "credit": "Tiles © Esri (Esri, HERE, Garmin, FAO, NOAA, USGS, © OpenStreetMap contributors)", "parallel": 12, "ext": "jpg"},
    "natgeo": {"url": ESRI.replace("{v}", "NatGeo_World_Map"), "size": 256, "max": 16, "credit": "Tiles © Esri, National Geographic, Garmin, HERE, UNEP-WCMC, USGS, NASA, ESA, GEBCO, NOAA", "parallel": 12, "ext": "jpg"},
    "relief": {"url": ESRI.replace("{v}", "World_Shaded_Relief"), "size": 256, "max": 13, "credit": "Tiles © Esri (Esri, USGS, NOAA)", "parallel": 12, "ext": "jpg"},
    "ocean": {"url": ESRI.replace("{v}", "Ocean/World_Ocean_Base"), "size": 256, "max": 13, "credit": "Tiles © Esri (Esri, GEBCO, NOAA, National Geographic, Garmin, HERE)", "parallel": 12, "ext": "jpg"},
    "satellite": {"url": ESRI.replace("{v}", "World_Imagery"), "size": 256, "max": 18, "credit": "Imagery © Esri, Maxar, Earthstar Geographics", "parallel": 12, "ext": "jpg"},
    "hybrid": {"url": ESRI.replace("{v}", "World_Imagery"), "labels": ESRI.replace("{v}", "Reference/World_Boundaries_and_Places"), "size": 256, "max": 18,
               "credit": "Imagery and labels © Esri, Maxar, Earthstar Geographics", "parallel": 12, "ext": "jpg"},
    "terrain": {"url": "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", "size": 256, "max": 17, "credit": OSM + ", SRTM, © OpenTopoMap (CC-BY-SA)", "parallel": 2, "subs": "abc"},
    "osm": {"url": "https://tile.openstreetmap.org/{z}/{x}/{y}.png", "size": 256, "max": 19, "credit": OSM, "parallel": 2},
    "humanitarian": {"url": "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", "size": 256, "max": 19, "credit": OSM + ", Humanitarian OpenStreetMap Team", "parallel": 2, "subs": "ab"},
    "vector": {"size": 0, "max": 9, "credit": "Made with Natural Earth"},
}
OFM = "https://tiles.openfreemap.org/styles/"
OFM_CREDIT = "© OpenFreeMap © OpenMapTiles, data © OpenStreetMap contributors"
GL_STYLES: dict[str, dict[str, Any]] = {
    "liberty": {"style": OFM + "liberty", "credit": OFM_CREDIT},
    "bright": {"style": OFM + "bright", "credit": OFM_CREDIT},
    "positron": {"style": OFM + "positron", "credit": OFM_CREDIT},
    "midnight": {"style": OFM + "dark", "credit": OFM_CREDIT},
    "fiord": {"style": OFM + "fiord", "credit": OFM_CREDIT},
    "satellite-3d": {"raster": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", "maxzoom": 18, "terrain": 1.4,
                     "credit": "Imagery © Esri, Maxar, Earthstar Geographics · terrain AWS Terrain Tiles"},
    "topo-3d": {"raster": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", "maxzoom": 18, "terrain": 1.3,
                "credit": "Tiles © Esri · terrain AWS Terrain Tiles"},
}
TERRARIUM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
ALIASES = {"voyager": "streets", "voyager-nolabels": "light-nolabels", "carto": "light", "positron": "light", "darkmatter": "dark", "street": "streets",
           "imagery": "satellite", "topographic": "topo", "nationalgeographic": "natgeo", "hot": "humanitarian", "world": "vector", "countries": "vector",
           "dark-vector": "midnight", "openfreemap": "liberty", "3d": "liberty", "globe": "liberty", "terrain3d": "topo-3d", "satellite3d": "satellite-3d"}
MAX_TILES = 1400
FPS = 30
LAT_MAX = 85.05112878
_geo_lock = asyncio.Lock()
_geo_last = [0.0]
_ne: dict[str, list[dict[str, Any]]] = {}


def project(lat: float, lon: float) -> tuple[float, float]:
    lat = max(-LAT_MAX, min(LAT_MAX, float(lat)))
    s = math.sin(math.radians(lat))
    return (float(lon) + 180.0) / 360.0, 0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)


def unproject(x: float, y: float) -> tuple[float, float]:
    return math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y)))), x * 360.0 - 180.0


def latlon(value: Any) -> tuple[float, float] | None:
    if isinstance(value, (list, tuple)) and len(value) == 2 and all(isinstance(v, (int, float)) for v in value):
        return float(value[0]), float(value[1])
    if isinstance(value, dict) and "lat" in value and ("lon" in value or "lng" in value):
        return float(value["lat"]), float(value.get("lon", value.get("lng")))
    if isinstance(value, str):
        m = re.fullmatch(r"\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*", value)
        if m:
            return float(m.group(1)), float(m.group(2))
    return None


def _key(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:20]


async def geocode(query: str, polygon: bool = False) -> dict[str, Any]:
    query = (query or "").strip()[:200]
    if not query:
        raise ValueError("empty place")
    ll = latlon(query)
    if ll:
        return {"name": query, "lat": ll[0], "lon": ll[1], "bbox": None, "type": "point"}
    GEO_CACHE.mkdir(parents=True, exist_ok=True)
    path = GEO_CACHE / f"{_key(query.lower() + ('|poly' if polygon else ''))}.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    params: dict[str, Any] = {"q": query, "format": "jsonv2", "limit": 1, "accept-language": "en"}
    if polygon:
        params.update({"polygon_geojson": 1, "polygon_threshold": 0.005})
    async with _geo_lock:
        wait = 1.1 - (time.time() - _geo_last[0])
        if wait > 0:
            await asyncio.sleep(wait)
        try:
            async with httpx.AsyncClient(timeout=30, headers=UA) as client:
                r = await client.get("https://nominatim.openstreetmap.org/search", params=params)
        finally:
            _geo_last[0] = time.time()
    if r.status_code >= 400:
        raise ValueError(f"geocoder answered {r.status_code}")
    rows = r.json()
    if not rows:
        raise ValueError(f"no place found for '{query}'")
    row = rows[0]
    bb = [float(v) for v in row.get("boundingbox") or []]
    out: dict[str, Any] = {"name": row.get("display_name") or query, "lat": float(row["lat"]), "lon": float(row["lon"]),
                           "bbox": [bb[0], bb[2], bb[1], bb[3]] if len(bb) == 4 else None, "type": row.get("type"), "class": row.get("category") or row.get("class")}
    geo = row.get("geojson") or {}
    if polygon and geo.get("type") in ("Polygon", "MultiPolygon"):
        out["geojson"] = geo
    path.write_text(json.dumps(out), encoding="utf-8")
    return out


async def countries(res: str = "110m") -> list[dict[str, Any]]:
    if res in _ne:
        return _ne[res]
    NE_CACHE.mkdir(parents=True, exist_ok=True)
    path = NE_CACHE / f"{res}.geojson"
    if not path.exists() or path.stat().st_size < 1000:
        async with httpx.AsyncClient(timeout=180, headers=UA, follow_redirects=True) as client:
            r = await client.get(NE_URL.format(res=res))
            r.raise_for_status()
            path.write_bytes(r.content)
    _ne[res] = json.loads(path.read_text(encoding="utf-8")).get("features", [])
    return _ne[res]


def country_names(props: dict[str, Any]) -> set[str]:
    keys = ("NAME", "NAME_LONG", "ADMIN", "NAME_EN", "FORMAL_EN", "SOVEREIGNT", "BRK_NAME", "GEOUNIT", "NAME_BN", "NAME_SORT", "ABBREV")
    names = {str(props.get(k) or "").strip().lower() for k in keys}
    for k in ("ISO_A2", "ISO_A3", "ADM0_A3", "ISO_A2_EH", "ISO_A3_EH"):
        v = str(props.get(k) or "").strip().lower()
        if v and v != "-99":
            names.add(v)
    names.discard("")
    return names


def find_country(features: list[dict[str, Any]], name: str) -> dict[str, Any] | None:
    q = (name or "").strip().lower().rstrip(".")
    q = re.sub(r"^the\s+", "", q)
    for f in features:
        if q in country_names(f.get("properties") or {}):
            return f
    return None


def rings_of(geometry: dict[str, Any]) -> list[list[list[float]]]:
    t = (geometry or {}).get("type")
    c = (geometry or {}).get("coordinates") or []
    if t == "Polygon":
        return [r for r in c]
    if t == "MultiPolygon":
        return [r for poly in c for r in poly]
    if t == "LineString":
        return [c]
    if t == "MultiLineString":
        return list(c)
    return []


def simplify(points: list[tuple[float, float]], tol: float) -> list[tuple[float, float]]:
    if len(points) < 4 or tol <= 0:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    tol2 = tol * tol
    while stack:
        a, b = stack.pop()
        ax, ay = points[a]
        bx, by = points[b]
        dx, dy = bx - ax, by - ay
        den = dx * dx + dy * dy
        best, idx = -1.0, -1
        for i in range(a + 1, b):
            px, py = points[i]
            if den == 0:
                d = (px - ax) ** 2 + (py - ay) ** 2
            else:
                u = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / den))
                d = (ax + u * dx - px) ** 2 + (ay + u * dy - py) ** 2
            if d > best:
                best, idx = d, i
        if best > tol2 and idx > 0:
            keep[idx] = True
            stack += [(a, idx), (idx, b)]
    return [p for p, k in zip(points, keep) if k]


def project_rings(rings: list[list[list[float]]], tol: float, closed: bool = True) -> list[list[list[float]]]:
    out = []
    for ring in rings:
        pts = [project(pt[1], pt[0]) for pt in ring if len(pt) >= 2]
        pts = simplify(pts, tol)
        if len(pts) >= (3 if closed else 2):
            out.append([[round(x, 8), round(y, 8)] for x, y in pts])
    return out


def ring_bounds(rings: list[list[list[float]]]) -> list[float] | None:
    xs = [p[0] for r in rings for p in r]
    ys = [p[1] for r in rings for p in r]
    return [min(xs), min(ys), max(xs), max(ys)] if xs else None


def anchor_of(rings: list[list[list[float]]]) -> list[float]:
    best = max(rings, key=lambda r: abs(_area(r)))
    a = _area(best)
    if abs(a) < 1e-14:
        xs, ys = [p[0] for p in best], [p[1] for p in best]
        return [sum(xs) / len(xs), sum(ys) / len(ys)]
    cx = cy = 0.0
    for (x0, y0), (x1, y1) in zip(best, best[1:] + best[:1]):
        f = x0 * y1 - x1 * y0
        cx += (x0 + x1) * f
        cy += (y0 + y1) * f
    return [round(cx / (6 * a), 8), round(cy / (6 * a), 8)]


def _area(r: list[list[float]]) -> float:
    return sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(r, r[1:] + r[:1])) / 2


def great_circle(a: tuple[float, float], b: tuple[float, float], n: int = 96) -> list[tuple[float, float]]:
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    d = 2 * math.asin(math.sqrt(math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2))
    if d < 1e-9:
        return [a, b]
    out = []
    for i in range(n + 1):
        f = i / n
        A = math.sin((1 - f) * d) / math.sin(d)
        B = math.sin(f * d) / math.sin(d)
        x = A * math.cos(la1) * math.cos(lo1) + B * math.cos(la2) * math.cos(lo2)
        y = A * math.cos(la1) * math.sin(lo1) + B * math.cos(la2) * math.sin(lo2)
        z = A * math.sin(la1) + B * math.sin(la2)
        out.append((math.degrees(math.atan2(z, math.hypot(x, y))), math.degrees(math.atan2(y, x))))
    return out


def unwrap_lons(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    out = []
    prev = None
    for lat, lon in points:
        if prev is not None:
            while lon - prev > 180:
                lon -= 360
            while lon - prev < -180:
                lon += 360
        out.append((lat, lon))
        prev = lon
    return out


def fit_zoom(bounds: list[float], vw: float, vh: float, fill: float = 0.78) -> float:
    bw = max(bounds[2] - bounds[0], 1e-9) * 512
    bh = max(bounds[3] - bounds[1], 1e-9) * 512
    return math.log2(min(vw * fill / bw, vh * fill / bh))


def ease(u: float) -> float:
    u = max(0.0, min(1.0, u))
    return 4 * u ** 3 if u < 0.5 else 1 - (-2 * u + 2) ** 3 / 2


def camera_track(keys: list[dict[str, Any]], duration: float, vw: float, vh: float, drift: float = 0.04, fps: int = FPS, orbit: float = 0.0) -> list[list[float]]:
    keys = [dict(k) for k in sorted(keys, key=lambda k: k["at"])]
    arrive, (x, y, z) = 0.0, (keys[0]["x"], keys[0]["y"], keys[0]["z"])
    for k in keys[1:]:
        start = max(k["at"], arrive)
        z0 = z + drift * (start - arrive)
        if not k.get("duration"):
            k["duration"] = max(1.2, min(5.0, 1.6 + 0.45 * abs(k["z"] - z0) + 3.0 * math.hypot(k["x"] - x, k["y"] - y)))
        x, y, z = k["x"], k["y"], k["z"]
        arrive = start + k["duration"]
    pb = [(float(k.get("pitch") or 0), float(k.get("bearing") or 0)) for k in keys]
    base = camera_track_xyz(keys, duration, vw, vh, drift, fps)
    if not any(p or b for p, b in pb) and not orbit:
        return base
    times = [k["at"] for k in keys]
    ends = []
    arrive = 0.0
    for i, k in enumerate(keys):
        if i == 0:
            ends.append(0.0)
            continue
        start = max(k["at"], arrive)
        dur = k.get("duration") or 2.5
        ends.append(start + dur)
        arrive = start + dur
    out = []
    for i, row in enumerate(base):
        t = i / fps
        pitch, bearing = pb[0]
        for j in range(1, len(keys)):
            t0 = max(times[j], ends[j - 1])
            t1 = ends[j]
            if t >= t1:
                pitch, bearing = pb[j]
            elif t >= t0:
                e = ease((t - t0) / max(1e-6, t1 - t0))
                db = ((pb[j][1] - pb[j - 1][1] + 180) % 360) - 180
                pitch, bearing = pb[j - 1][0] + (pb[j][0] - pb[j - 1][0]) * e, pb[j - 1][1] + db * e
                break
        out.append(row + [round(pitch, 3), round((bearing + orbit * t) % 360, 3)])
    return out


def camera_track_xyz(keys: list[dict[str, Any]], duration: float, vw: float, vh: float, drift: float = 0.04, fps: int = FPS) -> list[list[float]]:
    keys = sorted(keys, key=lambda k: k["at"])
    first = keys[0]
    segs = []
    arrive = 0.0
    x, y, z = first["x"], first["y"], first["z"]
    for k in keys[1:]:
        start = max(k["at"], arrive)
        z0 = z + drift * (start - arrive)
        dur = k.get("duration") or max(1.2, min(5.0, 1.6 + 0.45 * abs(k["z"] - z0) + 3.0 * math.hypot(k["x"] - x, k["y"] - y)))
        segs.append({"t0": start, "t1": start + dur, "a": (x, y, z0), "b": (k["x"], k["y"], k["z"]), "hold_from": arrive, "hz": z})
        x, y, z = k["x"], k["y"], k["z"]
        arrive = start + dur
    out = []
    total = max(1, int(math.ceil(duration * fps)))
    for i in range(total + 1):
        t = i / fps
        cur = (first["x"], first["y"], first["z"] + drift * t)
        hold_start, hold_z, hx, hy = 0.0, first["z"], first["x"], first["y"]
        for s in segs:
            if t < s["t0"]:
                break
            if t <= s["t1"]:
                e = ease((t - s["t0"]) / (s["t1"] - s["t0"]))
                (x0, y0, z0), (x1, y1, z1) = s["a"], s["b"]
                d = math.hypot(x1 - x0, y1 - y0) * 512
                zmin = min(z0, z1)
                arc = max(0.0, zmin - math.log2(0.75 * vw / d)) if d > 0 else 0.0
                cur = (x0 + (x1 - x0) * e, y0 + (y1 - y0) * e, z0 + (z1 - z0) * e - arc * math.sin(math.pi * e))
                hold_start = None
                break
            hold_start, hold_z, hx, hy = s["t1"], s["b"][2], s["b"][0], s["b"][1]
        if hold_start is not None:
            cur = (hx, hy, hold_z + drift * (t - hold_start))
        out.append([round(cur[0], 10), round(cur[1], 10), round(cur[2], 5)])
    return out


def tiles_for(track: list[list[float]], vw: float, vh: float, style: dict[str, Any]) -> set[tuple[int, int, int]]:
    tp = style["size"]
    off = math.log2(512 / tp)
    top = style["max"]
    need: set[tuple[int, int, int]] = set()
    samples = track[::2] + [track[-1]]
    for row in samples:
        x, y, z = row[0], row[1], row[2]
        n = z + off - 0.15
        c = max(0, min(top, math.ceil(n)))
        levels = {c, max(0, c - 1)}
        if n > c - 0.2 and c + 1 <= top:
            levels.add(c + 1)
        world = 512 * 2 ** z
        hw, hh = vw / 2 / world * 1.03, vh / 2 / world * 1.03
        for lv in levels:
            m = 2 ** lv
            for tx in range(math.floor((x - hw) * m), math.floor((x + hw) * m) + 1):
                for ty in range(max(0, math.floor((y - hh) * m)), min(m - 1, math.floor((y + hh) * m)) + 1):
                    need.add((lv, tx, ty))
    return need


async def fetch_tiles(style_name: str, tiles: set[tuple[int, int, int]], dest: Path, on_progress: Callable[[int, int], None] | None = None) -> dict[tuple[int, int, int], str]:
    style = STYLES[style_name]
    ext = style.get("ext", "png")
    sem = asyncio.Semaphore(style.get("parallel", 2))
    dest.mkdir(parents=True, exist_ok=True)
    result: dict[tuple[int, int, int], str] = {}
    done = [0]

    async def one(client: httpx.AsyncClient, key: tuple[int, int, int]) -> None:
        z, x, y = key
        xw = x % (2 ** z)
        cached = TILE_CACHE / style_name / str(z) / str(xw) / f"{y}.{ext}"
        if not cached.exists() or cached.stat().st_size < 64:
            subs = style.get("subs") or ""
            sub = subs[(xw + y) % len(subs)] if subs else ""
            async with sem:
                base = await _get_tile(client, style["url"].format(z=z, x=xw, y=y, s=sub))
                labels = await _get_tile(client, style["labels"].format(z=z, x=xw, y=y, s=sub)) if base and style.get("labels") else None
            if base:
                cached.parent.mkdir(parents=True, exist_ok=True)
                cached.write_bytes(_composite(base, labels) if labels else base)
        if cached.exists():
            name = f"{z}_{xw}_{y}.{ext}"
            target = dest / name
            if not target.exists():
                try:
                    os.link(cached, target)
                except OSError:
                    shutil.copyfile(cached, target)
            result[key] = name
        done[0] += 1
        if on_progress and done[0] % 20 == 0:
            on_progress(done[0], len(tiles))

    async with httpx.AsyncClient(timeout=30, headers=UA, follow_redirects=True) as client:
        await asyncio.gather(*(one(client, k) for k in sorted(tiles)))
    return result


async def _get_tile(client: httpx.AsyncClient, url: str) -> bytes | None:
    for attempt in range(3):
        try:
            r = await client.get(url)
            if r.status_code == 200 and r.headers.get("content-type", "").startswith("image"):
                return r.content
            if r.status_code in (404, 403):
                return None
        except httpx.HTTPError:
            pass
        await asyncio.sleep(0.8 * (attempt + 1))
    return None


def _composite(base: bytes, labels: bytes) -> bytes:
    import io
    from PIL import Image
    try:
        b = Image.open(io.BytesIO(base)).convert("RGBA")
        lab = Image.open(io.BytesIO(labels)).convert("RGBA")
        if lab.size != b.size:
            lab = lab.resize(b.size)
        b.alpha_composite(lab)
        out = io.BytesIO()
        b.convert("RGB").save(out, "JPEG", quality=90)
        return out.getvalue()
    except Exception:
        return base


def placeholder_levels(got: dict[tuple[int, int, int], str], dest: Path) -> set[int]:
    bad = set()
    for lv in {k[0] for k in got}:
        files = [dest / f for (z, _, _), f in got.items() if z == lv]
        if len(files) < 6:
            continue
        digests = {hashlib.sha1(p.read_bytes()).hexdigest() for p in files if p.exists()}
        if len(digests) == 1:
            bad.add(lv)
    return bad


async def road_route(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    coords = ";".join(f"{lon:.6f},{lat:.6f}" for lat, lon in points)
    async with httpx.AsyncClient(timeout=30, headers=UA) as client:
        r = await client.get(OSRM + coords, params={"overview": "full", "geometries": "geojson"})
        r.raise_for_status()
        routes = r.json().get("routes") or []
    if not routes:
        raise ValueError("no road route found")
    return [(c[1], c[0]) for c in routes[0]["geometry"]["coordinates"]]


class Resolver:
    def __init__(self) -> None:
        self.cache: dict[str, dict[str, Any]] = {}
        self.notes: list[str] = []

    async def place(self, value: Any) -> dict[str, Any]:
        ll = latlon(value)
        if ll:
            return {"name": str(value), "lat": ll[0], "lon": ll[1], "bbox": None, "type": "point"}
        key = str(value).strip().lower()
        if key not in self.cache:
            self.cache[key] = await geocode(str(value))
        return self.cache[key]


def place_bounds(p: dict[str, Any]) -> list[float]:
    if p.get("bbox"):
        s, w, n, e = p["bbox"]
        x0, y1 = project(s, w)
        x1, y0 = project(n, e)
        if x1 - x0 > 1e-7 and y1 - y0 > 1e-7:
            return [x0, y0, x1, y1]
    x, y = project(p["lat"], p["lon"])
    return [x, y, x, y]


def union(boxes: list[list[float] | None]) -> list[float] | None:
    boxes = [b for b in boxes if b]
    if not boxes:
        return None
    return [min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes)]


async def build(project_doc: dict[str, Any], spec: dict[str, Any], duration: float, on_progress: Callable[[str], None] | None = None) -> dict[str, Any]:
    style_name = str(spec.get("style") or "light").lower()
    style_name = ALIASES.get(style_name, style_name)
    gl = GL_STYLES.get(style_name)
    if style_name not in STYLES and not gl:
        raise ValueError(f"unknown style {style_name}; use one of {', '.join(list(STYLES) + list(GL_STYLES))}")
    style = STYLES.get(style_name) or {"size": 0, "max": 18, "credit": gl["credit"]}
    W, H = project_doc["width"], project_doc["height"]
    box = {k: float(spec.get(k, d)) for k, d in (("x", 0), ("y", 0), ("w", 100), ("h", 100))}
    vw, vh = W * box["w"] / 100, H * box["h"] / 100
    duration = float(spec.get("duration") or duration or 8)
    res = Resolver()
    detail_res = "50m"
    feats_small: list[dict[str, Any]] | None = None

    async def ne(resn: str) -> list[dict[str, Any]]:
        try:
            return await countries(resn)
        except Exception as error:
            res.notes.append(f"Natural Earth download failed: {error}")
            return []

    markers = []
    for m in spec.get("markers") or []:
        p = await res.place(m.get("place") or m.get("where") or m.get("label"))
        x, y = project(p["lat"], p["lon"])
        markers.append({"x": round(x, 10), "y": round(y, 10), "label": m.get("label", ""), "at": float(m.get("at", 0.4)), "style": m.get("style", "pin"),
                        "color": m.get("color", ""), "duration": m.get("duration"), "_b": [x, y, x, y]})
    routes = []
    for rt in spec.get("routes") or []:
        if rt.get("path"):
            pts = [latlon(v) for v in rt["path"]]
            pts = [v for v in pts if v]
        else:
            stops = [rt.get("from")] + list(rt.get("via") or []) + [rt.get("to")]
            stops = [s for s in stops if s is not None]
            pts = []
            for s in stops:
                p = await res.place(s)
                pts.append((p["lat"], p["lon"]))
        if len(pts) < 2:
            continue
        kind = rt.get("kind") or ("arc" if rt.get("style") == "flight" else "straight")
        if kind == "road":
            try:
                pts = await road_route(pts)
            except Exception as error:
                res.notes.append(f"road routing failed ({error}); drew a straight line")
        elif kind == "arc":
            arc = []
            for a, b in zip(pts, pts[1:]):
                seg = great_circle(a, b)
                arc += seg if not arc else seg[1:]
            pts = arc
        pts = unwrap_lons(pts)
        proj = [project(a, b) for a, b in pts]
        proj = simplify(proj, 0.3 / (512 * 2 ** 14))
        routes.append({"pts": [[round(x, 9), round(y, 9)] for x, y in proj], "at": float(rt.get("at", 0.6)), "duration": float(rt.get("duration", 2.2)),
                       "style": rt.get("style", "solid"), "color": rt.get("color", ""), "width": float(rt.get("width", 5)), "label": rt.get("label", ""),
                       "_b": [min(p[0] for p in proj), min(p[1] for p in proj), max(p[0] for p in proj), max(p[1] for p in proj)]})
    regions_src = []
    for rg in spec.get("regions") or []:
        name = rg.get("name") or rg.get("place")
        if not name:
            continue
        geom = None
        feats_small = feats_small if feats_small is not None else await ne(detail_res)
        f = find_country(feats_small, name) if feats_small else None
        if f:
            geom = f.get("geometry")
        else:
            try:
                g = await geocode(str(name), polygon=True)
                geom = g.get("geojson")
                if not geom:
                    res.notes.append(f"no outline for {name}; marked it with a pin instead")
                    x, y = project(g["lat"], g["lon"])
                    markers.append({"x": x, "y": y, "label": rg.get("label", ""), "at": float(rg.get("at", 0.6)), "style": "pulse", "color": rg.get("fill", ""), "duration": None, "_b": [x, y, x, y]})
            except Exception as error:
                res.notes.append(f"region {name}: {error}")
        if geom:
            regions_src.append((rg, geom))

    keys = []
    views = spec.get("camera") or spec.get("views") or []
    for i, v in enumerate(views):
        bounds = None
        if v.get("fit"):
            bounds = union([place_bounds(await res.place(p)) for p in v["fit"]])
        elif v.get("bbox"):
            s, w_, n, e = v["bbox"]
            bounds = place_bounds({"bbox": [s, w_, n, e], "lat": (s + n) / 2, "lon": (w_ + e) / 2})
        elif v.get("center") is not None or v.get("place") is not None:
            p = await res.place(v.get("center") if v.get("center") is not None else v.get("place"))
            bounds = place_bounds(p)
            if v.get("center") is not None or v.get("zoom") is not None:
                x, y = project(p["lat"], p["lon"])
                bounds = [x, y, x, y]
        if not bounds:
            continue
        cx, cy = (bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2
        if v.get("zoom") is not None:
            z = float(v["zoom"])
        elif bounds[2] - bounds[0] > 1e-7 or bounds[3] - bounds[1] > 1e-7:
            z = fit_zoom(bounds, vw, vh, float(v.get("fill", 0.78)))
        else:
            z = 11.0
        keys.append({"x": cx, "y": cy, "z": z, "at": float(v.get("at", 0 if i == 0 else 1.0 + i * 2.5)), "duration": v.get("duration"),
                     "pitch": v.get("pitch", spec.get("pitch", 0)), "bearing": v.get("bearing", spec.get("bearing", 0))})
    region_boxes = []
    for rg, geom in regions_src:
        rings = project_rings(rings_of(geom), 0)
        region_boxes.append(ring_bounds(rings))
    if not keys:
        content = union([m["_b"] for m in markers] + [r["_b"] for r in routes] + region_boxes)
        if not content:
            raise ValueError("give the map a camera (a place to look at) or something to show (markers, routes, regions)")
        cx, cy = (content[0] + content[2]) / 2, (content[1] + content[3]) / 2
        z = fit_zoom(content, vw, vh, 0.62) if content[2] - content[0] > 1e-7 or content[3] - content[1] > 1e-7 else 10.0
        keys = [{"x": cx, "y": cy, "z": z, "at": 0.0, "pitch": spec.get("pitch", 0), "bearing": spec.get("bearing", 0)}]
    zmin_world = math.log2(vh / 512)
    top = (style["max"] + (0 if style["size"] == 512 else -1)) if style["size"] else (18 if gl else 12)
    for k in keys:
        k["z"] = max(zmin_world, min(float(top), k["z"]))
    keys[0]["at"] = 0.0
    drift = float(spec.get("drift", 0.04))
    track = camera_track(keys, duration, vw, vh, drift, orbit=float(spec.get("orbit", 0)) if gl else 0.0)
    zmax = max(t[2] for t in track)
    tol = 0.6 / (512 * 2 ** zmax)

    aid = f"as_{uuid.uuid4().hex[:10]}"
    folder = f"map_{aid[3:]}"
    dest = project_dir(project_doc["id"]) / "assets" / folder
    dest.mkdir(parents=True, exist_ok=True)
    layers = []
    if style["size"] and not gl:
        need = tiles_for(track, vw, vh, style)
        if len(need) > MAX_TILES:
            shutil.rmtree(dest, ignore_errors=True)
            raise ValueError(f"this camera path needs {len(need)} map tiles (limit {MAX_TILES}); use fewer or shorter close-up moves, or the vector style for world-scale flights")
        if on_progress:
            on_progress(f"fetching {len(need)} {style_name} tiles")
        got = await fetch_tiles(style_name, need, dest, (lambda d, n: on_progress(f"tiles {d}/{n}")) if on_progress else None)
        if not got:
            shutil.rmtree(dest, ignore_errors=True)
            raise ValueError(f"could not download {style_name} map tiles (network or provider problem)")
        missing = len(need) - len(got)
        if missing:
            res.notes.append(f"{missing} tiles could not be downloaded")
        bad = placeholder_levels(got, dest)
        if bad:
            got = {k: v for k, v in got.items() if k[0] not in bad}
            res.notes.append(f"the {style_name} provider returned placeholder tiles at zoom {sorted(bad)}; those levels were dropped")
            if not got:
                shutil.rmtree(dest, ignore_errors=True)
                raise ValueError(f"the {style_name} tile provider returned only placeholder tiles; try another style (light, streets, topo, natgeo, satellite, osm, vector)")
        for lv in sorted({k[0] for k in got}):
            items = [(x, y, got[(z, x, y)]) for (z, x, y) in got if z == lv]
            x0, y0 = min(i[0] for i in items), min(i[1] for i in items)
            layers.append({"z": lv, "x0": x0, "y0": y0, "tiles": [[x - x0, y - y0, f] for x, y, f in sorted(items)]})
    land = []
    if style_name == "vector" or spec.get("borders"):
        world = await ne("110m" if zmax < 3.2 else "50m")
        hw = max(vw / (512 * 2 ** t[2]) for t in track) * 0.7
        hh = max(vh / (512 * 2 ** t[2]) for t in track) * 0.7
        view = [min(t[0] for t in track) - hw, min(t[1] for t in track) - hh, max(t[0] for t in track) + hw, max(t[1] for t in track) + hh]
        for f in world:
            rings = project_rings(rings_of(f.get("geometry")), tol)
            b = ring_bounds(rings)
            if not b or b[2] < view[0] or b[0] > view[2] or b[3] < view[1] or b[1] > view[3]:
                continue
            props = f.get("properties") or {}
            land.append({"name": props.get("NAME") or props.get("ADMIN"), "iso": props.get("ISO_A3") or props.get("ADM0_A3"), "rings": rings})
    regions = []
    for rg, geom in regions_src:
        rings = project_rings(rings_of(geom), tol)
        if not rings:
            continue
        regions.append({"name": rg.get("name") or rg.get("place"), "label": rg.get("label", ""), "at": float(rg.get("at", 0.6)), "fill": rg.get("fill", ""),
                        "opacity": float(rg.get("opacity", 0.55)), "spotlight": bool(rg.get("spotlight", False)), "duration": rg.get("duration"), "rings": rings,
                        "anchor": anchor_of(rings)})
    for m in markers:
        m.pop("_b", None)
    for r in routes:
        r.pop("_b", None)
    gl_cfg = None
    if gl:
        gl_cfg = {"style": gl.get("style"), "raster": gl.get("raster"), "maxzoom": gl.get("maxzoom", 18), "terrain": float(spec.get("terrain", gl.get("terrain", 0)) or 0),
                  "dem": TERRARIUM, "buildings": bool(spec.get("buildings", True)), "palette": spec.get("palette", ""), "labels": spec.get("labels", True),
                  "hillshade": bool(spec.get("hillshade", bool(spec.get("terrain", gl.get("terrain", 0)))))}
    data = {"version": 1, "engine": "gl" if gl else "raster", "gl": gl_cfg, "style": style_name, "tile": style["size"], "fps": FPS, "view": {"w": vw, "h": vh}, "box": box, "duration": duration,
            "camera": track, "layers": layers, "land": land, "regions": regions, "routes": routes, "markers": markers,
            "credit": style["credit"] + (" · Natural Earth" if land and style_name != "vector" else ""), "tint": spec.get("tint", "none")}
    (dest / "map.json").write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
    size = sum(p.stat().st_size for p in dest.iterdir())
    title = spec.get("title") or "map " + ", ".join(str(v.get("place") or v.get("center") or "") for v in views[:3] if v.get("place") or v.get("center"))
    asset = {"id": aid, "name": (title or "map")[:80], "file": f"{folder}/map.json", "kind": "map", "mime": "application/json", "size": size, "role": "generated",
             "url": f"/media/{project_doc['id']}/assets/{folder}/map.json", "added": time.time(),
             "meta": {"source": "openstreetmap" if style_name != "vector" else "naturalearth", "style": style_name, "engine": "gl" if gl else "raster", "credit": data["credit"], "tiles": sum(len(l["tiles"]) for l in layers),
                      "duration": duration}}

    def apply(p: dict[str, Any]) -> None:
        p.setdefault("assets", []).append(asset)
        credits = p.setdefault("credits", [])
        if data["credit"] not in credits:
            credits.append(data["credit"])
    store.mutate(project_doc["id"], apply)
    return {"asset": asset, "notes": res.notes, "zoom": [round(min(t[2] for t in track), 2), round(zmax, 2)], "tiles": asset["meta"]["tiles"],
            "markers": len(markers), "routes": len(routes), "regions": len(regions), "land": len(land), "keys": len(keys)}
