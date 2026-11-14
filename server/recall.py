from __future__ import annotations

import hashlib
import json
import math
import os
import re
import threading
import time
from collections import Counter
from pathlib import Path
from typing import Any

from . import config

ROOT = config.DATA / "recall"
FILE = ROOT / "scenes.jsonl"
ENABLED = os.environ.get("AUTEUR_RECALL", "1") != "0"
LIMIT = 800
CODE_LIMIT = 12000
FIELDS = {"visual": 2.0, "title": 1.5, "components": 1.5, "narration": 1.0, "onscreen": 0.8, "purpose": 0.5, "brief": 0.4}
STOP = set("a an the and or of to in on at for with from by is are was be it its this that as into over under then than so very just their his her our your "
           "we you they he she them us scene shot frame show shows showing while when where which who what each every one two".split())
K1, B = 1.2, 0.75

_lock = threading.RLock()
_cache: dict[str, Any] = {"mtime": None, "docs": [], "index": None}
_pending: dict[tuple[str, str], list[str]] = {}


def tokens(text: str) -> list[str]:
    return [w for w in re.findall(r"[a-z0-9][a-z0-9\-]+", str(text).lower()) if w not in STOP and len(w) > 1]


def trigrams(text: str) -> Counter:
    t = " " + re.sub(r"[^a-z0-9 ]+", " ", str(text).lower()) + " "
    t = re.sub(r"\s+", " ", t)
    return Counter(t[i:i + 3] for i in range(len(t) - 2))


def cosine(a: Counter, b: Counter) -> float:
    if not a or not b:
        return 0.0
    dot = sum(v * b.get(k, 0) for k, v in a.items())
    return dot / (math.sqrt(sum(v * v for v in a.values())) * math.sqrt(sum(v * v for v in b.values())) or 1)


def components_of(code: str) -> list[str]:
    return sorted(set(re.findall(r"component\(\s*['\"]([a-z0-9\-]+)['\"]", code or "")))


def medium_of(code: str) -> str:
    comps = set(components_of(code))
    if comps & {"world3d", "figure3d", "model-spec"}:
        return "3d"
    if comps & {"toon", "toon-crowd", "toon-animal"}:
        return "toon"
    if "stickman" in comps:
        return "stickman"
    return "graphic"


def aspect_of(project: dict[str, Any]) -> str:
    w, h = int(project.get("width") or 1920), int(project.get("height") or 1080)
    return "portrait" if h > w else ("square" if h == w else "landscape")


def clean_code(code: str) -> str:
    code = re.sub(r"data:[a-z]+/[a-z0-9.+\-]+;base64,[A-Za-z0-9+/=]{200,}", "data:,", code or "")
    return code[:CODE_LIMIT]


def _doc(project: dict[str, Any], scene: dict[str, Any], code: str, result: dict[str, Any]) -> dict[str, Any]:
    comps = components_of(code)
    return {
        "id": hashlib.sha1(code.encode("utf-8", "ignore")).hexdigest()[:16],
        "project": project.get("id", ""),
        "title": str(scene.get("title") or "")[:160],
        "visual": str(scene.get("visual") or "")[:600],
        "narration": str(scene.get("narration") or "")[:400],
        "onscreen": str(scene.get("onscreen") or "")[:200],
        "purpose": str(scene.get("purpose") or "")[:200],
        "brief": str(project.get("brief") or "")[:300],
        "components": comps,
        "medium": medium_of(code),
        "aspect": aspect_of(project),
        "duration": float(scene.get("duration") or 0),
        "score": float(result.get("score") or 0),
        "uses": 0,
        "wins": 0,
        "t": round(time.time()),
        "code": clean_code(code),
    }


def _load() -> list[dict[str, Any]]:
    try:
        mtime = FILE.stat().st_mtime
    except OSError:
        _cache.update(mtime=None, docs=[], index=None)
        return []
    if _cache["mtime"] == mtime:
        return _cache["docs"]
    docs = []
    for line in FILE.read_text(encoding="utf-8", errors="replace").splitlines():
        try:
            d = json.loads(line)
        except ValueError:
            continue
        if isinstance(d, dict) and d.get("id") and d.get("code"):
            docs.append(d)
    _cache.update(mtime=mtime, docs=docs, index=_build(docs))
    return docs


def _save(docs: list[dict[str, Any]]) -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    tmp = FILE.with_suffix(".tmp")
    tmp.write_text("".join(json.dumps(d, ensure_ascii=False) + "\n" for d in docs), encoding="utf-8")
    os.replace(tmp, FILE)
    _cache["mtime"] = None


def _terms(d: dict[str, Any]) -> Counter:
    tf: Counter = Counter()
    for field, weight in FIELDS.items():
        value = " ".join(d.get(field) or []) if field == "components" else d.get(field, "")
        for w in tokens(value):
            tf[w] += weight
    return tf


def _build(docs: list[dict[str, Any]]) -> dict[str, Any]:
    tfs = [_terms(d) for d in docs]
    df: Counter = Counter()
    for tf in tfs:
        df.update(tf.keys())
    lengths = [sum(tf.values()) for tf in tfs]
    avg = (sum(lengths) / len(lengths)) if lengths else 1.0
    tris = [trigrams(d.get("title", "") + " " + d.get("visual", "")) for d in docs]
    return {"tf": tfs, "df": df, "len": lengths, "avg": avg or 1.0, "tri": tris, "n": len(docs)}


def _bm25(ix: dict[str, Any], i: int, query: list[str]) -> float:
    tf, n, score = ix["tf"][i], ix["n"], 0.0
    for q in set(query):
        f = tf.get(q)
        if not f:
            continue
        idf = math.log(1 + (n - ix["df"][q] + 0.5) / (ix["df"][q] + 0.5))
        score += idf * f * (K1 + 1) / (f + K1 * (1 - B + B * ix["len"][i] / ix["avg"]))
    return score


def prior(d: dict[str, Any]) -> float:
    return 0.6 * min(1.0, d.get("score", 0) / 100) + 0.4 * (d.get("wins", 0) + 1) / (d.get("uses", 0) + 2)


def search(query: dict[str, Any], k: int = 2, medium: str | None = None, aspect: str | None = None, exclude_project: str = "") -> list[dict[str, Any]]:
    with _lock:
        docs = _load()
        ix = _cache["index"]
    if not docs or not ix:
        return []
    text = " ".join(str(query.get(f) or "") for f in ("title", "visual", "narration", "onscreen", "purpose"))
    qt = tokens(text) + tokens(" ".join(query.get("components") or []))
    qtri = trigrams(str(query.get("title") or "") + " " + str(query.get("visual") or ""))
    qset = set(qt)
    cands = []
    for i, d in enumerate(docs):
        if exclude_project and d.get("project") == exclude_project:
            continue
        if medium and medium != "graphic" and d.get("medium") not in (medium, "graphic"):
            continue
        tri = cosine(qtri, ix["tri"][i])
        cover = sum(1 for q in qset if ix["tf"][i].get(q)) / len(qset) if qset else 0.0
        if cover < 0.4 and tri < 0.35:
            continue
        cands.append((i, _bm25(ix, i, qt), tri))
    if not cands:
        return []
    top = max(c[1] for c in cands) or 1.0
    scored = []
    for i, bm, tri in cands:
        d = docs[i]
        s = 0.6 * bm / top + 0.25 * tri + 0.15 * prior(d)
        if medium and d.get("medium") == medium:
            s += 0.1
        if aspect and d.get("aspect") == aspect:
            s += 0.05
        if bm > 0 or tri > 0.2:
            scored.append((s, i))
    scored.sort(reverse=True)
    pool = scored[: max(12, k * 4)]
    picked: list[tuple[float, int]] = []
    while pool and len(picked) < k:
        best, best_val = None, -1e9
        for s, i in pool:
            sim = max((_similar(docs[i], docs[j], ix, i, j) for _, j in picked), default=0.0)
            val = 0.7 * s - 0.3 * sim
            if val > best_val:
                best, best_val = (s, i), val
        picked.append(best)
        pool.remove(best)
    return [dict(docs[i], rank=round(s, 3)) for s, i in picked if s >= 0.25]


def _similar(a: dict[str, Any], b: dict[str, Any], ix: dict[str, Any], i: int, j: int) -> float:
    ca, cb = set(a.get("components") or []), set(b.get("components") or [])
    jac = len(ca & cb) / len(ca | cb) if ca | cb else 0.0
    return 0.5 * jac + 0.5 * cosine(ix["tri"][i], ix["tri"][j])


def remember(project: dict[str, Any], scene: dict[str, Any], code: str, result: dict[str, Any]) -> bool:
    if not ENABLED or not code or not result.get("pass"):
        return False
    if any(i.get("severity") == "P0" for i in result.get("issues") or []) or float(result.get("score") or 0) < 85:
        return False
    if project.get("options", {}).get("recall") is False:
        return False
    doc = _doc(project, scene, code, result)
    with _lock:
        docs = list(_load())
        if any(d["id"] == doc["id"] for d in docs):
            return False
        same = [d for d in docs if d.get("project") == doc["project"]]
        if len(same) >= 12:
            weakest = min(same, key=prior)
            if prior(weakest) >= prior(doc):
                return False
            docs.remove(weakest)
        docs.append(doc)
        if len(docs) > LIMIT:
            docs.sort(key=lambda d: (prior(d), d.get("t", 0)), reverse=True)
            docs = docs[:LIMIT]
        _save(docs)
    return True


def feedback(pid: str, scene_id: str, passed: bool) -> None:
    ids = _pending.pop((pid, scene_id), None)
    if not ids:
        return
    with _lock:
        docs = list(_load())
        hit = False
        for d in docs:
            if d["id"] in ids:
                d["uses"] = d.get("uses", 0) + 1
                d["wins"] = d.get("wins", 0) + (1 if passed else 0)
                hit = True
        if hit:
            _save(docs)


def seed_from_projects(limit: int = 200) -> int:
    added = 0
    for path in sorted(config.PROJECTS.glob("*/project.json")):
        try:
            project = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        for scene in project.get("scenes") or []:
            qa = scene.get("qa") or {}
            if scene.get("source") == "agent" and scene.get("code") and remember(project, scene, scene["code"], qa):
                added += 1
                if added >= limit:
                    return added
    return added


def ensure_seeded() -> None:
    if not ENABLED or FILE.exists():
        return
    with _lock:
        if FILE.exists():
            return
        ROOT.mkdir(parents=True, exist_ok=True)
        if not seed_from_projects():
            FILE.write_text("", encoding="utf-8")


def text_for_animator(project: dict[str, Any], scene: dict[str, Any]) -> str:
    if not ENABLED or project.get("options", {}).get("recall") is False:
        return ""
    try:
        ensure_seeded()
        from . import continuity
        b = continuity.bible(project)
        medium = b["medium"] if b else None
        k = 1 if scene.get("relay_code") or scene.get("reference_code") else 2
        hits = search(scene, k=k, medium=medium, aspect=aspect_of(project), exclude_project=project.get("id", ""))
    except Exception:
        return ""
    if not hits:
        return ""
    _pending[(project.get("id", ""), scene.get("id", ""))] = [h["id"] for h in hits]
    parts = []
    for h in hits:
        code = h["code"]
        if len(code) > 2600:
            code = code[:2600] + "\n... (trimmed)"
        parts.append(f"Example (score {int(h['score'])}, {h['medium']}, {', '.join(h['components'][:6]) or 'custom'}) for the beat \"{h['title'] or h['visual'][:80]}\":\n```html\n{code}\n```")
    return ("Accepted scenes from earlier films that solved a similar beat. Learn their structure, layering, timing and component use; never copy their "
            "text, characters or colours (this film's bible and cast win):\n" + "\n".join(parts))


def stats() -> dict[str, Any]:
    with _lock:
        docs = _load()
    by: Counter = Counter(d.get("medium") for d in docs)
    return {"enabled": ENABLED, "scenes": len(docs), "by_medium": dict(by), "file": str(FILE)}
