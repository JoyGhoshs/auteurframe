from __future__ import annotations

import base64
import json
from typing import Any

T = dict[str, Any]
J = json.dumps

PALETTE = ["#e07a5f", "#3d405b", "#81b29a", "#f2cc8f", "#6d597a", "#457b9d", "#e63946", "#2a9d8f", "#f4a261"]


def placeholder(i: int, label: str = "") -> str:
    a, b = PALETTE[i % len(PALETTE)], PALETTE[(i + 3) % len(PALETTE)]
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
           f'<stop offset="0" stop-color="{a}"/><stop offset="1" stop-color="{b}"/></linearGradient></defs><rect width="1600" height="1000" fill="url(#g)"/>'
           f'<circle cx="{400 + i * 97 % 800}" cy="{300 + i * 53 % 300}" r="260" fill="#fff" opacity=".12"/><path d="M0 760 L380 520 L640 700 L980 420 L1600 820 L1600 1000 L0 1000 Z" fill="#000" opacity=".18"/>'
           f'<text x="80" y="920" font-family="sans-serif" font-size="64" font-weight="700" fill="#fff" opacity=".85">{label or "Photo " + str(i + 1)}</text></svg>')
    return "data:image/svg+xml;base64," + base64.b64encode(svg.encode()).decode()


def imgs(a: T, key: str, n: int) -> list[str]:
    got = list(a.get(key) or [])
    return got if got else [placeholder(i) for i in range(n)]


def code_scene(code: str, dur: float, title: str, trans: str = "fade") -> T:
    return {"archetype": "kinetic-title", "duration": dur, "data": {"title": title}, "transition": trans, "title": title[:60], "code": code}


def b_intro(v: T, a: T) -> list[T]:
    title, kicker, sub = v.get("title", ""), v.get("kicker", ""), v.get("subtitle", "")
    logo = (a.get("logo") or [None])[0]
    s1 = f"""<div class="scene ci"><div class="ci-bg" data-layer="bg"></div><div class="ci-glow" data-layer="glow"></div><div class="ci-line" data-layer="line"></div></div>
<style>.ci-bg{{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 62%, color-mix(in srgb, var(--accent) 26%, var(--bg)) 0%, var(--bg) 72%)}}
.ci-glow{{position:absolute;left:20%;top:20%;width:60%;height:60%;background:radial-gradient(closest-side, color-mix(in srgb, var(--accent) 55%, transparent), transparent);opacity:0}}
.ci-line{{position:absolute;left:50%;top:70%;width:0;height:3px;background:var(--accent);transform:translateX(-50%)}}</style>
<script>AU.scene(({{ tl, component }}) => {{
  tl.to('.ci-glow', {{ opacity: 0.85, scale: 1.15, duration: 3, ease: 'power2.inOut' }}, 0.1);
  tl.to('.ci-line', {{ width: '38%', duration: 1.1, ease: 'power3.inOut' }}, 2.2);
  component('particles', {{ kind: 'embers', count: 80, at: 0 }});
  component('title', {{ text: {J(title)}, kicker: {J(kicker)}, subtitle: {J(sub)}, style: 'mask', size: 'hero', at: 0.7 }});
  component('light-sweep', {{ target: '.auc-h', at: 2.6 }});
  component('lens', {{ type: 'anamorphic', move: 'push', zoom: 1.08, moveAt: 0, overlays: ['grain'], strength: 0.8 }});
}});</script>"""
    s2 = f"""<div class="scene"><div data-layer="bg" style="position:absolute;inset:0;background:var(--bg)"></div></div>
<script>AU.scene(({{ component }}) => {{
  component('particles', {{ kind: 'dust', count: 40, at: 0 }});
  component('logo-sting', {{ src: {J(logo or '')}, word: {J(v.get('name') or title.replace('*', ''))}, at: 0.2 }});
  component('lens', {{ type: 'anamorphic', overlays: ['flare'], flare: [70, 30], strength: 0.7 }});
}});</script>"""
    return [code_scene(s1, 6.0, "Title", "fadeblack"), code_scene(s2, 3.6, "Sting", "cut")]


def b_slideshow(v: T, a: T) -> list[T]:
    photos = imgs(a, "photos", 5)
    caps = [c.strip() for c in str(v.get("captions") or "").split("\n") if c.strip()]
    out = [code_scene(f"""<div class="scene"><div data-layer="bg" style="position:absolute;inset:0;background:var(--bg)"></div></div>
<script>AU.scene(({{ component }}) => {{
  component('image', {{ src: {J(photos[0])}, x: 0, y: 0, w: 100, h: 100, radius: 0, reveal: 'zoom', kenburns: 1.12, exit: false }});
  component('title', {{ text: {J(v.get('title', ''))}, kicker: {J(v.get('date', ''))}, subtitle: {J(v.get('subtitle', ''))}, style: 'rise', size: 'xl', at: 0.5 }});
  component('lens', {{ type: 'documentary', overlays: ['vignette'], strength: 0.7 }});
}});</script>""", 3.6, "Opening", "fade")]
    reveals = ["wipe", "iris", "zoom", "rise"]
    for i, ph in enumerate(photos[:12]):
        cap = caps[i] if i < len(caps) else ""
        focus = [35, 45] if i % 2 else [65, 40]
        code = f"""<div class="scene"><div data-layer="bg" style="position:absolute;inset:0;background:var(--bg)"></div></div>
<script>AU.scene(({{ component }}) => {{
  component('image', {{ src: {J(ph)}, x: 0, y: 0, w: 100, h: 100, radius: 0, reveal: {J(reveals[i % 4])}, kenburns: {1.1 + (i % 3) * 0.03}, focus: {J(focus)}, exit: false }});
  {f"component('lower-third', {{ name: {J(cap)}, role: {J(v.get('date', ''))}, side: {J('left' if i % 2 == 0 else 'right')}, at: 0.7 }});" if cap else ''}
  component('lens', {{ type: 'documentary', overlays: ['vignette'], strength: 0.6 }});
}});</script>"""
        out.append(code_scene(code, 3.6, cap or f"Photo {i + 1}", ["smoothleft", "fade", "slideup", "circleopen"][i % 4]))
    out.append(code_scene(f"""<div class="scene"><div data-layer="bg" style="position:absolute;inset:0;background:var(--bg)"></div></div>
<script>AU.scene(({{ component }}) => {{
  component('particles', {{ kind: 'bokeh', count: 40 }});
  component('title', {{ text: {J(v.get('closing') or 'Thank you')}, style: 'mask', size: 'xl', at: 0.3 }});
}});</script>""", 3.0, "Closing", "cut"))
    return out


def b_gallery3d(v: T, a: T) -> list[T]:
    photos = imgs(a, "images", 8)
    carousel = f"""<div class="scene p3"><div class="p3-bg" data-layer="bg"></div><div class="p3-stage" data-layer="stage"><div class="p3-ring"></div></div>
<div class="p3-floor" data-layer="floor"></div><h2 class="p3-t" data-layer="title">{v.get('title', '').replace('*', '')}</h2></div>
<style>.p3-bg{{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 38%, var(--bg-2), var(--bg) 72%)}}
.p3-stage{{position:absolute;inset:0;perspective:1700px;perspective-origin:50% 36%}}
.p3-ring{{position:absolute;left:50%;top:44%;width:0;height:0;transform-style:preserve-3d}}
.p3-card{{position:absolute;border-radius:16px;background-size:cover;background-position:center;border:6px solid #fff;box-shadow:0 30px 70px rgba(0,0,0,.35);backface-visibility:hidden;-webkit-box-reflect:below 14px linear-gradient(transparent 62%, rgba(255,255,255,.22))}}
.p3-floor{{position:absolute;left:-10%;right:-10%;bottom:-6%;height:34%;background:radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 70%)}}
.p3-t{{position:absolute;left:0;right:0;bottom:8%;margin:0;text-align:center;font:800 var(--fs-xl)/1 var(--font-display);color:var(--ink);letter-spacing:-0.02em}}</style>
<script>AU.scene(({{ tl, D, W, H, onFrame, asset }}) => {{
  const list = {J(photos)}.map((s) => asset(s));
  const ring = document.querySelector('.p3-ring');
  const n = Math.max(7, list.length);
  const cw = Math.min(W * 0.24, H * 0.42 * 1.4), ch = cw * 0.7, R = cw * n / (2 * Math.PI) * 1.18;
  for (let i = 0; i < n; i++) {{
    const c = document.createElement('div');
    c.className = 'p3-card';
    c.setAttribute('data-layer', 'card-' + i);
    Object.assign(c.style, {{ width: cw + 'px', height: ch + 'px', marginLeft: -cw / 2 + 'px', marginTop: -ch / 2 + 'px', backgroundImage: `url("${{list[i % list.length]}}")`,
      transform: `rotateY(${{i * 360 / n}}deg) translateZ(${{R}}px)` }});
    ring.appendChild(c);
  }}
  onFrame((t) => {{ const k = t / D; ring.style.transform = `translateZ(${{-R * 0.55}}px) rotateX(${{(-5 + Math.sin(t * 0.6) * 2).toFixed(2)}}deg) rotateY(${{(-20 - 160 * k - 30 * k * k).toFixed(2)}}deg)`; }});
  tl.fromTo('.p3-card', {{ autoAlpha: 0, y: 90 }}, {{ autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.07, ease: 'power3.out' }}, 0.1);
  tl.fromTo('.p3-t', {{ autoAlpha: 0, y: 40, letterSpacing: '0.2em' }}, {{ autoAlpha: 1, y: 0, letterSpacing: '-0.02em', duration: 0.9, ease: 'power3.out' }}, 1.0);
}});</script>"""
    tunnel = f"""<div class="scene p4"><div class="p4-bg" data-layer="bg"></div><div class="p4-stage" data-layer="stage"></div></div>
<style>.p4-bg{{position:absolute;inset:0;background:radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--accent) 18%, var(--bg)), var(--bg) 70%)}}
.p4-stage{{position:absolute;inset:0;perspective:900px;transform-style:preserve-3d}}
.p4-card{{position:absolute;left:50%;top:50%;border-radius:12px;background-size:cover;background-position:center;border:5px solid #fff;box-shadow:0 20px 50px rgba(0,0,0,.35)}}</style>
<script>AU.scene(({{ D, W, H, onFrame, asset, component }}) => {{
  const list = {J(photos)}.map((s) => asset(s));
  const stage = document.querySelector('.p4-stage');
  const cards = [];
  const n = 18, depth = 5200, cw = W * 0.2, ch = cw * 0.7;
  for (let i = 0; i < n; i++) {{
    const c = document.createElement('div');
    c.className = 'p4-card';
    c.setAttribute('data-layer', 'fly-' + i);
    const ang = i * 2.399, rad = 0.55 + (i % 3) * 0.18;
    Object.assign(c.style, {{ width: cw + 'px', height: ch + 'px', marginLeft: -cw / 2 + 'px', marginTop: -ch / 2 + 'px', backgroundImage: `url("${{list[i % list.length]}}")` }});
    stage.appendChild(c);
    cards.push({{ c, x: Math.cos(ang) * W * 0.32 * rad, y: Math.sin(ang) * H * 0.3 * rad, z: -i * depth / n, r: (i % 5 - 2) * 4 }});
  }}
  onFrame((t) => {{
    const travel = t * depth / D * 0.95;
    cards.forEach((k) => {{
      let z = k.z + travel;
      while (z > 400) z -= depth;
      const fade = Math.min(1, Math.max(0, (z + depth) / 1200)) * Math.min(1, Math.max(0, (420 - z) / 300));
      k.c.style.transform = `translate3d(${{k.x.toFixed(1)}}px, ${{k.y.toFixed(1)}}px, ${{z.toFixed(1)}}px) rotate(${{k.r}}deg)`;
      k.c.style.opacity = fade.toFixed(3);
    }});
  }});
  component('title', {{ text: {J(v.get('tagline') or v.get('title', ''))}, style: 'blur', size: 'xl', at: 1.2 }});
}});</script>"""
    end = f"""<div class="scene"><div data-layer="bg" style="position:absolute;inset:0;background:var(--bg)"></div></div>
<script>AU.scene(({{ component }}) => {{ component('particles', {{ kind: 'stars', count: 60 }}); component('title', {{ text: {J(v.get('cta') or 'See more')}, style: 'mask', size: 'xl', at: 0.3 }}); }});</script>"""
    return [code_scene(carousel, 9.0, "3D carousel", "zoomin"), code_scene(tunnel, 7.0, "Fly through", "fadewhite"), code_scene(end, 3.0, "End", "cut")]


def b_cartoon(v: T, a: T) -> list[T]:
    lines = [c.strip() for c in str(v.get("lines") or "").split("\n") if c.strip()][:4] or ["Wait. Did you hear that?", "It is just the wind.", "The wind does not knock."]
    hero, friend = v.get("hero") or "teen-boy", v.get("friend") or "teen-girl"
    sky = "linear-gradient(180deg,#2b4a7a 0%,#5b7fb0 55%,#f0b46a 100%)"
    bg = f"""<div data-layer="sky" style="position:absolute;inset:0;background:{sky}"></div>
<div data-layer="hills" class="hills" style="position:absolute;left:-5%;right:-5%;bottom:20%;height:30%;background:#3d5a4a;border-radius:50% 50% 0 0/40% 40% 0 0;border-top:6px solid #221c22"></div>
<div data-layer="ground" style="position:absolute;left:0;right:0;bottom:0;height:22%;background:#c9a978;border-top:6px solid #221c22"></div>"""
    title = f"""<div class="scene">{bg}<h1 class="ct" data-layer="title" style="position:absolute;left:0;right:0;top:9%;margin:0;text-align:center;font:900 calc(var(--fs-hero) * 0.9)/1 var(--font-display);color:#fff;-webkit-text-stroke:7px #221c22;paint-order:stroke">{v.get('title', '').replace('*', '')}</h1></div>
<script>AU.scene(({{ tl, component, onFrame }}) => {{
  tl.fromTo('.ct', {{ scale: 1.6, rotation: -6, autoAlpha: 0 }}, {{ scale: 1, rotation: -2, autoAlpha: 1, duration: 0.45, ease: 'back.out(2.2)' }}, 0.2);
  onFrame((t) => {{ document.querySelector('.hills').style.transform = `translateX(${{(-t * 6).toFixed(1)}}px)`; }});
  component('toon', {{ preset: {J(hero)}, x: 35, h: 46, actions: [{{ do: 'wave', at: 0.8, duration: 1.4, expression: 'happy' }}] }});
  component('toon', {{ preset: {J(friend)}, x: 65, h: 46, facing: 'left', actions: [{{ do: 'cheer', at: 1.0, duration: 1.2 }}] }});
  component('lens', {{ type: 'documentary', move: 'push', zoom: 1.06, strength: 0.5 }});
}});</script>"""
    out = [code_scene(title, 3.6, "Title", "smoothleft")]
    moods = [("worried", "shock"), ("smirk", "talk"), ("scared", "scared"), ("laugh", "laugh")]
    for i, line in enumerate(lines):
        speaker_left = i % 2 == 0
        expr, act = moods[i % len(moods)]
        code = f"""<div class="scene">{bg}<div class="bubble" data-layer="bubble" style="position:absolute;{'left:12%' if speaker_left else 'right:12%'};top:10%;max-width:46%;padding:22px 30px;background:#fff;border:6px solid #221c22;border-radius:28px;font:800 var(--fs-lg)/1.15 var(--font-display);color:#221c22">{line}</div></div>
<script>AU.scene(({{ tl, component, D }}) => {{
  tl.fromTo('.bubble', {{ scale: 0.4, autoAlpha: 0, transformOrigin: '{'0% 100%' if speaker_left else '100% 100%'}' }}, {{ scale: 1, autoAlpha: 1, duration: 0.35, ease: 'back.out(2)' }}, 0.3);
  component('toon', {{ preset: {J(hero)}, x: 33, h: 50, actions: [{{ do: {J('talk' if speaker_left else act)}, at: 0.3, duration: D - 0.6, expression: {J(expr if speaker_left else 'neutral')} }}] }});
  component('toon', {{ preset: {J(friend)}, x: 67, h: 50, facing: 'left', actions: [{{ do: {J('talk' if not speaker_left else act)}, at: 0.5, duration: D - 0.8, expression: {J(expr if not speaker_left else 'worried')} }}] }});
  component('lens', {{ type: 'documentary', move: 'push', zoom: 1.08, focus: [{35 if speaker_left else 65}, 45], strength: 0.5 }});
}});</script>"""
        out.append(code_scene(code, 4.2, line[:40], "smoothleft" if i % 2 else "smoothright"))
    end = f"""<div class="scene">{bg}</div>
<script>AU.scene(({{ component }}) => {{
  component('title', {{ text: {J(v.get('ending') or 'The *end*')}, style: 'slam', size: 'xl', at: 0.3 }});
  component('toon', {{ preset: {J(hero)}, x: 30, h: 40, actions: [{{ do: 'cheer', at: 0.5, duration: 2 }}] }});
  component('toon', {{ preset: {J(friend)}, x: 70, h: 40, facing: 'left', actions: [{{ do: 'cheer', at: 0.7, duration: 2 }}] }});
}});</script>"""
    out.append(code_scene(end, 3.2, "The end", "cut"))
    return out


def b_top5(v: T, a: T) -> list[T]:
    items = [c.strip() for c in str(v.get("items") or "").split("\n") if c.strip()][:5]
    while len(items) < 5:
        items.append(f"Item {len(items) + 1}")
    out = [code_scene(f"""<div class="scene"><div data-layer="bg" style="position:absolute;inset:0;background:var(--bg)"></div></div>
<script>AU.scene(({{ component }}) => {{ component('particles', {{ kind: 'embers', count: 50 }}); component('title', {{ text: {J(v.get('title', ''))}, kicker: 'Top 5', style: 'slam', size: 'hero', at: 0.2 }}); component('lens', {{ type: 'documentary', move: 'crash', zoom: 1.15, moveAt: 0.2 }}); }});</script>""",
                      3.0, "Top 5", "zoomin")]
    for rank in range(5, 0, -1):
        item = items[5 - rank]
        code = f"""<div class="scene t5"><div data-layer="bg" style="position:absolute;inset:0;background:radial-gradient(ellipse at 30% 50%, color-mix(in srgb, var(--accent) 25%, var(--bg)), var(--bg) 70%)"></div>
<div class="t5-n" data-layer="number" style="position:absolute;left:6%;top:12%;font:900 calc(var(--fs-hero) * 2.4)/1 var(--font-display);color:var(--accent);-webkit-text-stroke:6px var(--ink);paint-order:stroke">{rank}</div>
<div class="t5-i" data-layer="item" style="position:absolute;left:42%;top:38%;width:52%;font:800 var(--fs-xl)/1.05 var(--font-display);color:var(--ink)">{item}</div>
<div class="t5-bar" data-layer="bar" style="position:absolute;left:42%;top:30%;width:0;height:10px;background:var(--accent)"></div></div>
<script>AU.scene(({{ tl, onFrame, D }}) => {{
  tl.fromTo('.t5-n', {{ scale: 2.2, autoAlpha: 0, rotation: -12 }}, {{ scale: 1, autoAlpha: 1, rotation: -4, duration: 0.4, ease: 'back.out(2.4)' }}, 0.05);
  tl.to('.t5-bar', {{ width: '30%', duration: 0.5, ease: 'power3.out' }}, 0.3);
  tl.fromTo('.t5-i', {{ x: 80, autoAlpha: 0 }}, {{ x: 0, autoAlpha: 1, duration: 0.5, ease: 'power3.out' }}, 0.35);
  onFrame((t) => {{ document.querySelector('.t5-n').style.translate = `0 ${{(Math.sin(t * 2.4) * 6).toFixed(1)}}px`; }});
}});</script>"""
        out.append(code_scene(code, 2.8 if rank > 1 else 3.6, f"#{rank} {item}"[:40], "slideup" if rank > 1 else "circleopen"))
    out.append(code_scene(f"""<div class="scene"><div data-layer="bg" style="position:absolute;inset:0;background:var(--bg)"></div></div>
<script>AU.scene(({{ component }}) => {{ component('title', {{ text: {J(v.get('cta') or 'Follow for *more*')}, style: 'rise', size: 'xl', at: 0.2 }}); }});</script>""", 2.6, "Follow", "cut"))
    return out


def slot(key: str, label: str, kind: str = "text", required: bool = False, default: Any = "", help: str = "", max: int = 0) -> T:
    return {"key": key, "label": label, "kind": kind, "required": required, "default": default, "help": help, "max": max}


TEMPLATES2: list[T] = [
    {"id": "cinematic-intro", "name": "Cinematic Intro", "category": "Intro", "style": "documentary", "aspect": "16:9", "mood": "cinematic", "icon": "film",
     "description": "Embers and a glow build, the title unmasks with a light sweep through an anamorphic lens, then a logo sting with a flare.", "build": b_intro,
     "slots": [slot("title", "Title", required=True, default="The *Last* Signal"), slot("kicker", "Kicker", default="A short film"), slot("subtitle", "Subtitle", default="Coming soon"),
               slot("name", "Name for the sting", default="AuteurFrame Pictures"), slot("logo", "Logo", "logo")]},
    {"id": "photo-slideshow", "name": "Photo Slideshow", "category": "Photos", "style": "editorial-paper", "aspect": "16:9", "mood": "dreamy", "icon": "gallery-horizontal",
     "description": "Full-bleed photos with Ken Burns toward the subject, varied reveals, captions as lower thirds, warm closing title.", "build": b_slideshow,
     "slots": [slot("title", "Title", required=True, default="Our *summer*"), slot("subtitle", "Subtitle", default="A year in pictures"), slot("date", "Date or place", default="2026"),
               slot("photos", "Photos", "images", max=12, help="3 to 12 photos"), slot("captions", "Captions (one per line)", "list", default="The beach\nOld town\nFriends\nSunset\nHome"),
               slot("closing", "Closing line", default="Until *next* time"), slot("music", "Music", "audio")]},
    {"id": "photo-3d", "name": "3D Photo Gallery", "category": "3D", "style": "gradient-product", "aspect": "16:9", "mood": "cinematic", "icon": "rotate-3d",
     "description": "Your photos on a reflective rotating 3D carousel, then a fly-through tunnel of photos toward the camera.", "build": b_gallery3d,
     "slots": [slot("title", "Title", required=True, default="Moments in *motion*"), slot("images", "Photos", "images", max=12), slot("tagline", "Second line", default="Every frame a *memory*"),
               slot("cta", "Closing line", default="See the *collection*"), slot("music", "Music", "audio")]},
    {"id": "cartoon-story", "name": "Cartoon Story", "category": "Characters", "style": "soft-clay", "aspect": "16:9", "mood": "playful", "icon": "users",
     "description": "Two cartoon characters act out your lines in speech bubbles on a painted set, with a title slam and a happy ending.", "build": b_cartoon,
     "slots": [slot("title", "Title", required=True, default="THE KNOCK"), slot("lines", "Lines (one per line, speakers alternate)", "list", default="Wait. Did you hear that?\nIt is just the wind.\nThe wind does not knock.\nOkay. Now I am scared."),
               slot("hero", "First character (preset)", default="teen-boy", help="kid, teen-girl, teen-boy, old-man, old-woman, police, soldier, doctor, scientist, businessman, chef, biker, beekeeper, thief, zombie, hero"),
               slot("friend", "Second character (preset)", default="teen-girl"), slot("ending", "Ending", default="The *end*")]},
    {"id": "top5-countdown", "name": "Top 5 Countdown", "category": "Kinetic type", "style": "creator-bold", "aspect": "9:16", "mood": "upbeat", "icon": "list-ordered",
     "description": "Crash-zoom title, then numbers 5 to 1 slam in with your items, a beat each, and a follow card.", "build": b_top5,
     "slots": [slot("title", "Title", required=True, default="Top 5 *survival* tips"), slot("items", "Items from 5 to 1 (one per line)", "list", default="Carry water\nStay quiet\nMove at noon\nTrust no radio\nNever split up"),
               slot("cta", "Closing line", default="Follow for *more*")]},
]
