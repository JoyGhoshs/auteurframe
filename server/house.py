from __future__ import annotations

import random
import re
from typing import Any

from . import locale, subtitles

STOP = set("""a an the and or but if then so of to in on at by for with from into onto over under about as is are was were be been being it its this that these those there here
we you they he she i me my our your their his her them us not no yes do does did done have has had will would can could should may might must just very really more most
less least than too also only even ever never what which who whom whose when where why how all any each every some such own same other another much many few
get gets got make makes made happen happens happened toward towards pull pulls form forms come comes came take takes took see sees saw look looks want wants need needs
say says start starts keep keeps give gives put puts line lines thing things way ways time times next first second third back like just still while""".split())

ICONS = {
    "ocean": "waves", "sea": "waves", "water": "droplets", "fish": "fish", "money": "banknote", "cost": "banknote", "price": "tag", "dollar": "dollar-sign",
    "invest": "trending-up", "growth": "trending-up", "grow": "sprout", "decline": "trending-down", "fall": "trending-down", "data": "database", "chart": "chart-line",
    "ai": "brain-circuit", "model": "brain-circuit", "brain": "brain", "think": "brain", "idea": "lightbulb", "time": "clock", "year": "calendar", "history": "history",
    "world": "globe", "global": "globe", "country": "flag", "city": "building-2", "home": "house", "house": "house", "people": "users", "user": "user", "team": "users",
    "energy": "zap", "power": "zap", "battery": "battery-charging", "climate": "thermometer", "heat": "flame", "fire": "flame", "sun": "sun", "solar": "sun", "wind": "wind",
    "tree": "trees", "forest": "trees", "plant": "sprout", "food": "utensils", "health": "heart-pulse", "doctor": "stethoscope", "medicine": "pill", "science": "flask-conical",
    "research": "microscope", "space": "rocket", "rocket": "rocket", "planet": "globe-2", "star": "star", "phone": "smartphone", "app": "app-window", "code": "code-xml",
    "software": "code-xml", "security": "shield-check", "risk": "triangle-alert", "danger": "triangle-alert", "law": "scale", "rule": "gavel", "vote": "vote", "school": "graduation-cap",
    "learn": "book-open", "book": "book-open", "music": "music", "video": "clapperboard", "film": "film", "camera": "camera", "car": "car", "travel": "plane", "ship": "ship",
    "factory": "factory", "mine": "pickaxe", "mining": "pickaxe", "metal": "gem", "gold": "coins", "market": "store", "shop": "shopping-cart", "sell": "shopping-bag",
    "chat": "message-circle", "message": "message-square", "search": "search", "question": "circle-help", "answer": "circle-check", "win": "trophy", "goal": "target",
    "speed": "gauge", "fast": "gauge", "slow": "hourglass", "network": "network", "internet": "wifi", "cloud": "cloud", "lock": "lock", "key": "key-round", "map": "map",
    "location": "map-pin", "light": "lightbulb", "dark": "moon", "life": "heart", "love": "heart", "animal": "paw-print", "species": "bug", "job": "briefcase", "work": "briefcase",
}

TRANSITION_DUR = 0.5


def words(text: str) -> list[str]:
    return re.findall(r"[A-Za-z][A-Za-z'\-]+|\d[\d.,]*%?", text)


def keywords(text: str, n: int = 5) -> list[str]:
    if not re.search(r"[A-Za-z]", text or "") and not NOSPACE.search(text or ""):
        toks = [re.sub("[.,;:!?\"'()\u0964\u0965\u060C\u061F\u06D4]", "", w) for w in (text or "").split()]
        toks = [w for w in toks if len(w) >= 3]
        ranked = sorted(dict.fromkeys(toks), key=lambda w: -len(w))[:n]
        return [w for w in dict.fromkeys(toks) if w in ranked]
    seen, out = set(), []
    for w in sorted(words(text), key=lambda x: (-(x[0].isupper()) * 0.5 - len(x))):
        lw = w.lower().strip("'")
        if lw in STOP or len(lw) < 3 or lw in seen or lw[0].isdigit():
            continue
        seen.add(lw)
        out.append(w)
        if len(out) >= n:
            break
    order = {w: i for i, w in enumerate(words(text))}
    return sorted(out, key=lambda w: order.get(w, 0))


def icon_for(text: str, fallback: str = "sparkles") -> str:
    for w in words(text.lower()):
        base = w.rstrip("s")
        if w in ICONS:
            return ICONS[w]
        if base in ICONS:
            return ICONS[base]
    return fallback


def trim_stop(text: str) -> str:
    toks = text.strip(" ,;:.").split()
    while toks and toks[-1].lower().strip(",.;:") in STOP | {"could", "would", "said", "says"}:
        toks.pop()
    while toks and toks[0].lower().strip(",.;:") in {"and", "but", "so", "or", "then", "which"}:
        toks.pop(0)
    return " ".join(toks)


def iconic(text: str) -> list[str]:
    out = []
    for w in keywords(text, 10):
        if icon_for(w, "") and w.capitalize() not in out:
            out.append(w.capitalize())
    return out


SENT_END = "[.!?;:\u0964\u0965\u06D4\u061F\u3002\uFF01\uFF1F]"
CLAUSE = "[,\u060C\u3001\uFF0C]"
NOSPACE = re.compile("[\u0E00-\u0EFF\u1000-\u109F\u1780-\u17FF\u3040-\u30FF\u3400-\u9FFF]")
LATIN = re.compile("[A-Za-z]")


def headline(text: str, max_words: int = 8) -> str:
    text = re.sub(r"\s+", " ", text).strip().rstrip(".\u0964\u3002")
    first = re.split("(?<=" + SENT_END + r")\s*", text)[0].strip()
    first = re.sub(SENT_END + "$", "", first).strip() or text
    if NOSPACE.search(first) and " " not in first.strip():
        if len(first) > 14:
            first = re.split(CLAUSE, first)[0][:14]
        return emphasize(first)
    toks = first.split(" ")
    if len(toks) <= max(max_words, 12) and (LATIN.search(first) or len(toks) <= 6):
        return emphasize(trim_stop(first) or first)
    if len(toks) > max_words or not LATIN.search(first):
        clause = re.split(CLAUSE + r"\s*|\s+(?:but|because|while|which|that|so)\s+", first)
        clause = [c for c in clause if len(c.split()) >= 3]
        cand = clause[0] if clause else first
        toks = cand.split(" ")
        limit = max_words if LATIN.search(first) else 5
        if len(toks) > limit:
            toks = toks[:limit]
    out = trim_stop(" ".join(toks))
    return emphasize(out or text[:40])


def emphasize(text: str) -> str:
    if "*" in text:
        return text
    cands = [w for w in re.findall(r"[A-Za-z][A-Za-z'\-]{3,}|\d[\d.,]*%?", text) if w.lower() not in STOP]
    if not cands and not LATIN.search(text):
        words_ = [w.strip(".,;:!?\u0964\u060C\u3001") for w in text.split(" ") if len(w.strip(".,;:!?\u0964\u060C\u3001")) >= 3]
        if not words_:
            return text
        best = max(words_, key=len)
        return text.replace(best, f"*{best}*", 1)
    if not cands:
        return text
    best = max(cands, key=lambda w: (w[0].isdigit()) * 10 + len(w))
    return re.sub(rf"\b{re.escape(best)}\b", f"*{best}*", text, count=1)


NUMBER = re.compile(r"(?P<pre>[$€£¥])?\s?(?P<num>\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(?:\s?(?P<unit>%|percent|per cent|k\b|thousand|million|billion|trillion|bn\b|x\b|times|metres|meters|km\b|kilometres|kilometers|kg\b|tonnes|tons|years|hours|days|degrees|mm\b|cm\b|m\b))?", re.I)
UNIT_SHORT = {"percent": "%", "per cent": "%", "thousand": "K", "k": "K", "million": "M", "billion": "B", "bn": "B", "trillion": "T", "times": "x",
              "metres": " m", "meters": " m", "m": " m", "km": " km", "kilometres": " km", "kilometers": " km", "kg": " kg", "tonnes": " t", "tons": " t",
              "years": " yrs", "hours": " h", "days": " days", "degrees": "°", "mm": " mm", "cm": " cm"}


def find_number(text: str) -> dict[str, Any] | None:
    best = None
    for m in NUMBER.finditer(text):
        raw = m.group("num").replace(",", "").replace(" ", "")
        try:
            value = float(raw)
        except ValueError:
            continue
        unit = (m.group("unit") or "").lower()
        if not unit and not m.group("pre") and 1000 <= value <= 2100 and float(value).is_integer():
            continue
        score = (2 if unit else 0) + (2 if m.group("pre") else 0) + min(3, len(raw) / 2)
        if not best or score > best[0]:
            suffix = UNIT_SHORT.get(unit, unit)
            decimals = 1 if "." in raw and value < 100 else 0
            best = (score, {"value": value, "prefix": m.group("pre") or "", "suffix": suffix, "decimals": decimals, "match": m.group(0)})
    return best[1] if best and best[0] >= 1 else None


def years(text: str) -> list[str]:
    return list(dict.fromkeys(re.findall(r"\b(1[5-9]\d\d|20\d\d)\b", text)))


def clauses(text: str, n: int = 4) -> list[str]:
    parts = re.split(r"[;,]\s+|\s+(?:and then|then|and|while|but)\s+|(?<=[.!?])\s+", text)
    parts = [p.strip(" .") for p in parts if len(p.strip()) > 3]
    return [short(p, 6) for p in parts[:n]]


def short(text: str, n: int) -> str:
    toks = text.split()
    return " ".join(toks[:n]) + ("" if len(toks) <= n else "")


def classify(text: str, index: int, total: int, affinity: list[str], rnd: random.Random, previous: list[str]) -> str:
    low = text.lower()
    if index == 0:
        return "kinetic-title" if "kinetic-title" in affinity or True else affinity[0]
    if index == total - 1 and total > 2:
        return "end-card"
    options: list[str] = []
    vs_parts = re.split(r"\b(?:vs\.?|versus|compared to|compared with|instead of|rather than|but|while)\b", text, maxsplit=1, flags=re.I)
    if len(vs_parts) == 2 and len(vs_parts[0].split()) >= 3 and len(vs_parts[1].split()) >= 3:
        options.append("versus")
    if len(years(text)) >= 2:
        options.append("timeline")
    num = find_number(text)
    if num:
        options += ["big-number", "big-number"]
        if num["suffix"] == "%":
            options.append("donut")
    if re.search(r"[\"“”]", text) or re.search(r"\b(said|says|wrote|according to)\b", low):
        options.append("quote")
    if len(re.findall(r",", text)) >= 2:
        options += ["list-reveal", "icon-grid"]
    if re.search(r"\b(step|first|then|next|finally|process|how)\b", low):
        options += ["process-flow", "doodle-explain"]
    if re.search(r"\b(grow|rise|fell|drop|trend|increase|decrease|over time)\b", low):
        options.append("line-chart")
    if re.search(r"\b(equation|formula|math|probability|physics)\b", low):
        options.append("equation")
    if re.search(r"\b(scale|tiny|huge|size|bigger|smaller|universe|atom)\b", low):
        options.append("scale-zoom")
    if len(iconic(text)) < 3:
        options = [o for o in options if o != "icon-grid"]
    if len(clauses(text, 5)) < 3:
        options = [o for o in options if o not in ("process-flow", "list-reveal")]
    options = [o for o in options if o in affinity] or [o for o in options if o in ("big-number", "versus", "timeline", "list-reveal")]
    if not options:
        generic = ("kinetic-title", "word-stack", "doodle-explain")
        pool = [a for a in affinity if a in generic]
        if len(text.split()) <= 7 and "word-stack" not in pool and not NOSPACE.search(text):
            pool.append("word-stack")
        if len(iconic(text)) >= 3 and "icon-grid" not in pool:
            pool.append("icon-grid")
        if len(text.split()) > 9:
            pool = [a for a in pool if a != "word-stack"]
        options = pool or ["kinetic-title"]
    fresh = [o for o in options if o not in previous[-2:]]
    if not fresh and previous and previous[-1] == "kinetic-title":
        fresh = ["word-stack"] if len(keywords(text, 4)) >= 3 and not NOSPACE.search(text) else (["icon-grid"] if len(iconic(text)) >= 3 else [])
    return rnd.choice(fresh or options)


def build_data(arch: str, text: str, ctx: dict[str, Any]) -> dict[str, Any]:
    kw = keywords(text, 6)
    kick = ctx.get("kicker", "")
    head = headline(text)
    num = find_number(text)
    if arch == "kinetic-title":
        hw = head.replace("*", "").split()
        tw = text.split()
        idx = next((i for i in range(len(tw)) if " ".join(tw[i:i + len(hw)]).strip(",.") == " ".join(hw).strip(",.")), 0)
        rest = " ".join(tw[idx + len(hw):]).strip(" .,")
        return {"kicker": kick, "title": head, "subtitle": short(rest, 12) if len(rest.split()) > 3 and not ctx.get("captioned") else "", "icon": icon_for(text) if ctx.get("index", 0) == 0 else None}
    if arch == "word-stack":
        return {"words": [w.upper() for w in kw[:4]] or ([w for w in head.replace("*", "").split()[:3]] if ctx.get("lang", "en") != "en" else ["WATCH", "THIS"])}
    if arch == "big-number" and num:
        label = re.sub(r"\s+", " ", text.replace(num["match"], " ")).strip(" .,:")
        return {"kicker": kick, "value": num["value"], "prefix": num["prefix"], "suffix": num["suffix"], "decimals": num["decimals"], "label": emphasize(short(label, 8)), "context": ""}
    if arch == "donut" and num:
        v = min(100, num["value"])
        return {"kicker": kick, "title": headline(text.replace(num["match"], "").strip(), 6), "parts": [{"label": kw[0] if kw else "Share", "value": v}, {"label": "Rest", "value": round(100 - v, 1)}], "unit": "%"}
    if arch == "versus":
        parts = re.split(r"\b(?:vs\.?|versus|compared to|compared with|instead of|rather than|but|while)\b", text, maxsplit=1, flags=re.I)
        left, right = (parts + [""])[:2]
        lk, rk = keywords(left, 4), keywords(right, 4)
        lpoint = trim_stop(re.sub(r"^\s*\w+\s+(say|says|said|claim|claims|warn|warns|argue|argues)\s+(that\s+)?", "", left.strip(" ,."), flags=re.I))
        rpoint = trim_stop(re.sub(r"^\s*\w+\s+(say|says|said|claim|claims|warn|warns|argue|argues)\s+(that\s+)?", "", right.strip(" ,."), flags=re.I))
        llabel = (left.split()[0] if left.split() else (lk[0] if lk else "One side")).strip(",.").title()
        rlabel = (right.split()[0] if right.split() else (rk[0] if rk else "Other side")).strip(",.").title()
        return {"kicker": kick, "title": f"{llabel} vs *{rlabel}*", "left": {"label": llabel, "points": [short(lpoint, 7)]},
                "right": {"label": rlabel, "points": [short(rpoint, 7)]}}
    if arch == "timeline":
        ys = years(text)
        segs = re.split(r"\b(?:1[5-9]\d\d|20\d\d)\b", text)
        events = []
        for i, y in enumerate(ys[:5]):
            before = trim_stop(" ".join(segs[i].replace(",", " ").split()[-5:]))
            kws = [w for w in before.split() if w.lower() not in STOP]
            label = " ".join(kws[-3:]) if kws else trim_stop(short(segs[i + 1] if i + 1 < len(segs) else "", 4))
            events.append({"date": y, "label": label.capitalize() if label else y})
        return {"kicker": kick, "title": "How it *unfolded*" if len(ys) > 1 else headline(text, 6), "events": events}
    if arch == "quote":
        q = re.search(r"[\"“](.+?)[\"”]", text)
        author = re.search(r"(?:said|says|wrote|according to)\s+([A-Z][\w.\- ]{2,40})", text)
        return {"quote": emphasize(q.group(1) if q else text), "author": author.group(1).strip() if author else ctx.get("title", ""), "role": ""}
    if arch in ("list-reveal",):
        items = clauses(text, 4)
        return {"kicker": kick, "title": headline(text, 5), "items": [emphasize(i) if n == len(items) - 1 else i for n, i in enumerate(items)][:4] or kw}
    if arch == "icon-grid":
        items = iconic(text)[:6] or kw[:6]
        return {"kicker": kick, "title": headline(text, 5), "items": [{"icon": icon_for(i), "label": i.capitalize()} for i in items]}
    if arch == "process-flow":
        steps = clauses(text, 4)
        if len(steps) < 3:
            steps = [w.capitalize() for w in kw[:4]]
        return {"kicker": kick, "title": headline(text, 5), "steps": [{"label": short(s, 3), "icon": icon_for(s, "circle-dot")} for s in steps]}
    if arch == "doodle-explain":
        nodes = [w.capitalize() for w in kw[:4]] if len(kw) >= 3 else clauses(text, 3)
        return {"kicker": kick, "title": headline(text, 6), "nodes": nodes}
    if arch == "line-chart":
        rnd = random.Random(len(text))
        up = not re.search(r"\b(fall|fell|drop|decline|decrease|shrink)\b", text.lower())
        base = [rnd.uniform(2, 4)]
        for _ in range(7):
            base.append(max(0.5, base[-1] + (rnd.uniform(0.2, 1.2) if up else -rnd.uniform(0.1, 0.8)) + rnd.uniform(-0.4, 0.4)))
        return {"kicker": kick, "title": headline(text, 6), "series": [round(v, 2) for v in base], "callout": (num["prefix"] + str(num["value"]) + num["suffix"]) if num else ""}
    if arch == "equation":
        return {"title": headline(text, 6), "tex": ctx.get("tex") or "f(x) = \\sum_{n=0}^{\\infty} a_n x^n", "note": short(text, 12)}
    if arch == "scale-zoom":
        return {"kicker": kick, "title": headline(text, 6), "levels": [w.capitalize() for w in kw[:4]] or ["Small", "Bigger", "Huge"]}
    if arch == "end-card":
        return {"title": headline(text, 6), "subtitle": "", "cta": ctx.get("cta") if ctx.get("cta") is not None else locale.follow(ctx.get("lang", "en")), "icon": icon_for(text, "sparkle")}
    if arch == "image-focus":
        return {"kicker": kick, "title": headline(text, 6), "caption": short(text, 12), "image": ctx.get("image"), "icon": icon_for(text, "image")}
    return {"kicker": kick, "title": head}


ACT_LABELS = ["Hook", "Context", "Context", "Evidence", "Evidence", "Turn", "Stakes", "Resolution", "Payoff"]


def kicker_for(index: int, total: int) -> str:
    if index == 0:
        return ""
    pos = index / max(1, total - 1)
    labels = ["Context", "The problem", "Evidence", "Why it matters", "The turn", "What now"]
    return labels[min(len(labels) - 1, int(pos * len(labels)))]


def brief_beats(brief: str, count: int, title: str) -> list[str]:
    text = re.sub(r"\s+", " ", brief).strip()
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if len(s.strip()) > 2]
    if not sentences:
        sentences = [title or "A story worth telling"]
    beats = list(sentences)
    while len(beats) < count:
        longest = max(range(len(beats)), key=lambda i: len(beats[i].split()))
        sentence = beats[longest]
        if len(sentence.split()) < 10:
            break
        cuts = [m.start() for m in re.finditer(r",\s+(?:but|and|while|so|yet)?\s*|;\s+|\s+(?:but|while|whereas)\s+", sentence)]
        if not cuts:
            break
        mid = len(sentence) / 2
        cut = min(cuts, key=lambda c: abs(c - mid))
        a, b = sentence[:cut].strip(" ,;"), sentence[cut:].strip(" ,;")
        if len(a.split()) < 4 or len(b.split()) < 4:
            break
        beats[longest:longest + 1] = [a, b[0].upper() + b[1:]]
    topic = (title or " ".join(keywords(text, 2)) or "this").strip()
    filler = [
        f"Here is what most people miss about {topic.lower() if len(topic.split()) > 1 else topic}.",
        f"The numbers tell a sharper story.",
        f"So what changes now?",
        f"Remember this one idea.",
    ]
    fi = 0
    while len(beats) < count:
        beats.insert(len(beats) - 1 if len(beats) > 1 else len(beats), filler[fi % len(filler)])
        fi += 1
    if len(beats) > count:
        head, tail = beats[: count - 1], beats[count - 1:]
        beats = head + [" ".join(tail[-1:])]
    return beats[:count]


def plan(project: dict[str, Any]) -> list[dict[str, Any]]:
    rnd = random.Random(project.get("seed", 1))
    bible = project.get("bible") or {}
    affinity = bible.get("archetypes") or ["kinetic-title", "word-stack", "big-number", "list-reveal", "end-card"]
    fps = project.get("fps", 30)
    shorts = project.get("height", 1080) > project.get("width", 1920)
    cues = project.get("cues") or []
    images = [a for a in project.get("assets", []) if a.get("kind") in ("image", "video") and a.get("role", "reference") != "logo"]
    from . import sync, fonts as fontlib
    lang = fontlib.language_of(project)
    captioned = bool(cues) and (project.get("captions") or {}).get("enabled", True) is not False and not all(c.get("synthetic") for c in cues)
    planned = sync.scene_windows(project, shorts)
    if planned:
        windows = planned
        beats = [w["text"] or w.get("beat", "") for w in windows]
    else:
        target = float(project.get("duration_target") or 30)
        per = 3.2 if shorts else 4.6
        count = max(3, min(24, round(target / per)))
        beats = brief_beats(project.get("brief", ""), count, project.get("title", ""))
        durations = [max(2.4, min(7.5, subtitles.estimate_words_seconds(b) * (0.9 if shorts else 1.0))) for b in beats]
        scale = target / sum(durations)
        durations = [round(d * scale * fps) / fps for d in durations]
        windows, t = [], 0.0
        for b, d in zip(beats, durations):
            windows.append({"start": round(t, 4), "duration": d, "text": b, "cues": []})
            t += d
    scenes, previous = [], []
    transitions = bible.get("transitions") or ["fade"]
    for i, (w, text) in enumerate(zip(windows, beats)):
        arch = classify(text, i, len(windows), affinity, rnd, previous)
        if arch == "word-stack" and NOSPACE.search(text):
            arch = "kinetic-title"
        if images and i in (1, 2) and "image-focus" not in previous and i < len(windows) - 1:
            arch = "image-focus"
        ctx = {"index": i, "kicker": locale.kicker(lang, i, len(windows)), "title": project.get("title", ""), "image": images[min(len(images) - 1, i // 2)]["id"] if images else None,
               "lang": lang, "captioned": captioned}
        data = build_data(arch, text, ctx)
        if arch in ("big-number", "donut") and "value" not in data and "parts" not in data:
            arch = "kinetic-title"
            data = build_data(arch, text, ctx)
        previous.append(arch)
        scenes.append({
            "id": f"sc_{i:03d}_{rnd.randrange(16 ** 4):04x}", "index": i, "title": re.sub(r"\*", "", data.get("title") or headline(text, 5))[:80],
            "purpose": ACT_LABELS[min(len(ACT_LABELS) - 1, int(i / max(1, len(windows) - 1) * (len(ACT_LABELS) - 1)))],
            "start": round(w["start"], 4), "duration": round(w["duration"], 4), "narration": text, "onscreen": data.get("title", ""),
            "visual": f"{arch} in {bible.get('name', 'house')} style", "archetype": arch, "data": data, "variant": rnd.randrange(12),
            "code": None, "source": "house", "status": "planned", "layers": [], "overrides": {}, "cue_ids": w.get("cues", []),
            "transition": {"type": "cut" if i == len(windows) - 1 else transitions[i % len(transitions)], "duration": TRANSITION_DUR if shorts is False else 0.35},
        })
    return scenes
