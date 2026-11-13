from __future__ import annotations

import asyncio
import json
import re
from typing import Any, Callable

from . import llm as llmmod
from . import media_sources, stock, webtools
from .store import project_dir, store

IMAGE_KINDS = ("photo", "historical", "portrait", "illustration", "vector", "transparent")
KINDS = IMAGE_KINDS + ("icon", "footage", "sfx")

SYSTEM = """You are the Asset Scout of an animation studio. Before the animators start, you decide which REAL material each scene needs from free
libraries: photos, historical or archival pictures, portraits, illustrations, SVG vectors, transparent cut-out PNGs, icons, logos and flags,
archival video footage and sound effects. You also choose one background music search for the whole film.
Ask only for things that make the scene more truthful or richer: named people, places, landmarks, objects, events, documents, brands.
Abstract ideas, charts and typography are drawn by the animators, so skip them. Maps and statistics are handled by other tools, skip them.
Queries must be short, concrete and in English (for example "Dhaka Sadarghat river port", "1969 Apollo 11 launch", "rickshaw illustration").
Return JSON only."""


def _plan_prompt(project: dict[str, Any]) -> str:
    lines = []
    for s in project["scenes"]:
        lines.append(f"Scene {s['index'] + 1} ({float(s['duration']):.1f}s) {s.get('title', '')}\n  narration: {s.get('narration', '')[:300]}\n  on screen: {s.get('onscreen', '')[:120]}\n"
                     f"  visual: {s.get('visual', '')[:300]}\n  instruments: {', '.join(s.get('instruments') or [])}")
    return (f"Film brief: {project.get('brief', '')[:1200]}\nTone: {(project.get('options') or {}).get('tone') or 'auto'}\nLength: {sum(float(s['duration']) for s in project['scenes']):.0f}s\n\n"
            + "\n".join(lines)
            + '\n\nReturn {"scenes": [{"scene": number, "needs": [{"kind": "photo|historical|portrait|illustration|vector|transparent|icon|footage|sfx", "query": str, "why": str}]}],'
              ' "music": {"query": "2 to 4 words of genre and mood, for example calm cinematic piano", "mood": str}}.'
              " At most 3 needs per scene and 16 in total; scenes that need nothing can be left out.")


def heuristic_plan(project: dict[str, Any]) -> dict[str, Any]:
    from . import house
    out = []
    for s in project["scenes"]:
        if not set(s.get("instruments") or []) & {"web", "media"}:
            continue
        words = house.keywords(f"{s.get('title', '')} {s.get('narration', '')}", 3)
        if words:
            out.append({"scene": s["index"] + 1, "needs": [{"kind": "photo", "query": " ".join(words[:3]), "why": "scene subject"}]})
    return {"scenes": out, "music": {"query": "cinematic ambient", "mood": "neutral"}}


async def plan(project: dict[str, Any], on_token: Any = None) -> dict[str, Any]:
    model = llmmod.LLM("director")
    if not model.available:
        return heuristic_plan(project)
    try:
        data = await model.json(SYSTEM, _plan_prompt(project), on_token=on_token, max_tokens=3000)
    except Exception:
        return heuristic_plan(project)
    if not isinstance(data, dict):
        return heuristic_plan(project)
    return data


async def _pick_with_vision(need: dict[str, Any], cands: list[dict[str, Any]]) -> int:
    model = llmmod.LLM("critic")
    if not model.available or not model.vision or len(cands) < 2:
        return 0
    raws = await webtools.fetch_thumbs([c.get("thumb") or c.get("url") for c in cands[:6]])
    sheet = webtools.thumb_sheet([(f"{i + 1}. {(c.get('title') or '')[:28]}", r) for i, (c, r) in enumerate(zip(cands[:6], raws))], cols=3)
    try:
        reply = await model.complete("You pick the best image for a documentary shot. Answer with the number only.",
                                     f"Shot needs: {need['kind']} of {need['query']} ({need.get('why', '')}). Which numbered image fits best: sharp, relevant, uncluttered, "
                                     "no watermark or text overlay? Answer with one number.", images=[sheet], max_tokens=200, temperature=0)
        m = re.search(r"\d+", reply or "")
        if m and 1 <= int(m.group()) <= min(6, len(cands)):
            return int(m.group()) - 1
    except Exception:
        pass
    return 0


async def fulfil(pid: str, scene: dict[str, Any], need: dict[str, Any], used: set[str], vision: bool) -> dict[str, Any] | None:
    kind = need.get("kind", "photo")
    query = str(need.get("query") or "").strip()[:100]
    if not query or kind not in KINDS:
        return None
    rec: dict[str, Any] = {"kind": kind, "query": query, "why": need.get("why", "")}
    if kind in IMAGE_KINDS:
        found = await webtools.search_images(query, kind)
        min_w = 1000 if kind in ("photo", "historical", "portrait") else 0
        cands = [c for c in found if c["url"] not in used and ((c.get("width") or 0) >= min_w or c["url"].lower().endswith(".svg") or not c.get("width"))][:8]
        if not cands:
            return None
        order = list(range(len(cands)))
        if vision:
            first = await _pick_with_vision(need, cands)
            order = [first] + [i for i in order if i != first]
        for i in order[:4]:
            try:
                asset = await webtools.collect(pid, cands[i], f"{query}")
            except Exception:
                continue
            used.add(cands[i]["url"])
            if asset["kind"] == "image":
                try:
                    from . import imaging
                    img = imaging.load(pid, asset)
                    info = await asyncio.to_thread(imaging.analyze, img, True)
                    focus = {"focus": info["focus"], "faces": len(info["faces"])}
                    store.mutate(pid, lambda p, aid=asset["id"], f=focus: [a.setdefault("meta", {}).update(f) for a in p["assets"] if a["id"] == aid])
                    asset["meta"].update(focus)
                except Exception:
                    pass
            rec.update(asset=asset["id"], title=cands[i].get("title", ""), license=cands[i].get("license", ""), size=f"{asset['meta'].get('width')}x{asset['meta'].get('height')}",
                       focus=asset["meta"].get("focus"), alternates=[{"title": c.get("title", "")[:60], "url": c["url"], "license": c.get("license", "")} for j, c in enumerate(cands[:5]) if j != i][:3])
            return rec
        return None
    if kind == "icon":
        data = await stock.icons(query, 12)
        names = [i["name"] for i in data.get("icons", [])]
        if not names:
            return None
        asset = await webtools.collect_icon(pid, names[0])
        rec.update(asset=asset["id"], title=names[0], alternates=[{"title": n} for n in names[1:5]])
        return rec
    if kind == "footage":
        found = await media_sources.search_footage(query)
        if not found:
            return None
        rec.update(candidates=[{"id": f["id"], "title": f["title"][:80], "year": f.get("year"), "source": f["source"]} for f in found[:5]])
        return rec
    if kind == "sfx":
        found = await media_sources.search_audio(query, "sfx", 10)
        for item in found[:4]:
            try:
                asset = await media_sources.collect_audio(pid, item)
            except Exception:
                continue
            rec.update(asset=asset["id"], title=item.get("title", ""), license=item.get("license", ""), seconds=asset["meta"].get("duration"))
            return rec
        return None
    return None


async def music(pid: str, query: str, total: float) -> dict[str, Any] | None:
    found = await media_sources.search_audio(query or "cinematic ambient", "music")
    need = min(60.0, total * 0.8)
    exact = [f for f in found if f.get("matched") == (query or "cinematic ambient")]
    pick = [f for f in exact + found if (f.get("duration") or 0) >= need] or sorted(found, key=lambda f: -(f.get("duration") or 0))
    for item in pick[:4]:
        try:
            asset = await media_sources.collect_audio(pid, item, 0, min(600, total + 8))
        except Exception:
            continue
        media_sources.place_audio(pid, asset["id"], "music")
        return {"asset": asset["id"], "title": item.get("title", ""), "license": item.get("license", ""), "bpm": asset["meta"].get("bpm")}
    return None


async def run(pid: str, emit: Callable[[str, dict[str, Any]], None], on_token: Any = None) -> dict[str, Any]:
    project = store.get(pid)
    wishlist = await plan(project, on_token)
    vision = llmmod.LLM("critic").vision and llmmod.LLM("critic").available
    used: set[str] = {a.get("meta", {}).get("original", "") for a in project.get("assets", [])}
    sem = asyncio.Semaphore(4)
    by_index = {s["index"]: s for s in project["scenes"]}
    tasks = []
    count = 0
    for entry in (wishlist.get("scenes") or []) if isinstance(wishlist, dict) else []:
        try:
            idx = int(entry.get("scene")) - 1
        except (TypeError, ValueError):
            continue
        scene = by_index.get(idx)
        if not scene:
            continue
        for need in (entry.get("needs") or [])[:3]:
            if count >= 16 or not isinstance(need, dict):
                break
            count += 1

            async def one(sc=scene, nd=need) -> tuple[int, dict[str, Any] | None]:
                async with sem:
                    emit("scout.need", {"scene": sc["index"], "kind": nd.get("kind"), "query": nd.get("query")})
                    try:
                        return sc["index"], await fulfil(pid, sc, nd, used, vision)
                    except Exception as error:
                        emit("run.warning", {"message": f"scout: {nd.get('query')}: {str(error)[:120]}"})
                        return sc["index"], None
            tasks.append(one())
    results = await asyncio.gather(*tasks)
    per_scene: dict[int, list[dict[str, Any]]] = {}
    for idx, rec in results:
        if rec:
            per_scene.setdefault(idx, []).append(rec)
    music_rec = None
    p = store.get(pid)
    opts = p.get("options") or {}
    choice = (p.get("audio") or {}).get("music", "auto")
    if opts.get("library_music", True) and (choice in (None, "auto") or str(choice).startswith("mood:")):
        mq = ((wishlist.get("music") or {}).get("query") if isinstance(wishlist, dict) else "") or "cinematic ambient"
        try:
            music_rec = await music(pid, mq, sum(float(s["duration"]) for s in p["scenes"]))
        except Exception as error:
            emit("run.warning", {"message": f"scout music: {str(error)[:120]}"})

    def apply(doc: dict[str, Any]) -> None:
        for sc in doc["scenes"]:
            if sc["index"] in per_scene:
                sc["scouted"] = per_scene[sc["index"]]
                inst = sc.setdefault("instruments", [])
                if "web" not in inst and any(r.get("asset") and r["kind"] != "sfx" for r in per_scene[sc["index"]]):
                    inst.append("web")
                if "media" not in inst and any(r["kind"] == "footage" for r in per_scene[sc["index"]]):
                    inst.append("media")
    store.mutate(pid, apply)
    return {"scenes": len(per_scene), "items": sum(len(v) for v in per_scene.values()), "music": music_rec, "wishlist": wishlist}


def describe_for_animator(scene: dict[str, Any]) -> str:
    recs = scene.get("scouted") or []
    if not recs:
        return ""
    lines = ["The asset scout already collected real material for this scene (use it unless it clearly does not fit; you can still search for more):"]
    for r in recs:
        if r["kind"] == "footage":
            lines.append(f"- footage candidates for '{r['query']}': " + "; ".join(f"{c['id']} {c['title'][:50]} ({c['source']}{', ' + str(c['year']) if c.get('year') else ''})" for c in r.get("candidates", [])[:4])
                         + " -> footage_info <id> then collect_footage")
        elif r["kind"] == "sfx":
            lines.append(f"- sound effect {r['asset']} '{r.get('title', '')[:50]}' ({r.get('seconds') or '?'}s) for '{r['query']}' -> place_audio {r['asset']} sfx <scene seconds>")
        else:
            focus = f", focus point {r['focus'][0]:.0f}% {r['focus'][1]:.0f}%" if r.get("focus") and r["focus"] != [50.0, 45.0] else ""
            lines.append(f"- {r['kind']} {r['asset']} '{r.get('title', '')[:60]}' {r.get('size', '')}{focus} for '{r['query']}' ({r.get('why', '')[:60]})")
    return "\n".join(lines)
