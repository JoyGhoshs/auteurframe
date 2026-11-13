---
name: composition-contract
description: The exact contract every scene fragment must satisfy to render deterministically in AuteurFrame (or any seek-driven HTML video renderer); read before writing or repairing scene code.
stage: animate
tags: [contract, gsap, determinism, runtime, scene, lint]
version: 1
---

# Composition Contract

A scene is an HTML fragment (markup + one `<style>` + one `<script>`) whose every visible pixel is a
pure function of time `t`. A headless browser seeks a paused timeline to `t = f / fps` for every frame
and screenshots it; the editor plays the same document live. If a frame depends on anything except
`t` and the seed, preview and render diverge, frames flicker, or the render stalls. This skill is the
contract, the reasons behind each clause, and a complete worked scene.

## When to use / not use
- Use: writing any scene, repairing a scene that failed lint or probe, reviewing generated code.
- Use: porting HyperFrames or Remotion ideas (same family: paused timeline, seek per frame).
- Not for: deciding what the scene says (storyboard-director) or how it moves (motion-rules-core).

## Core rules
1. Fragment only. No `<html>`, `<head>`, `<body>`, no `<link>`, no `<script src>`. One root
   `<div class="scene">`, then `<style>`, then `<script>`. The platform injects fonts, theme tokens,
   GSAP 3.13+ with SplitText, DrawSVG, MorphSVG, MotionPath, ScrambleText, CustomEase, rough.js,
   KaTeX, the Lucide sprite and the runtime `AU`.
2. No external URLs anywhere (`http`, `//`, `url(http...)`, `@import`). Media comes from
   `ctx.assets` / `AU.asset(name)`. Reason: renders run offline and must be reproducible.
3. No clocks: no `setTimeout`, `setInterval`, `requestAnimationFrame`, `Date.now`, `new Date()`,
   `performance.now`, CSS `@keyframes`/`transition` that you rely on for motion, `repeat: -1`.
   Use `ctx.rand()` (seeded), never bare `Math.random` for anything layout-relevant.
4. All motion lives on `ctx.tl` (paused, length D) or in an `AU.onFrame((t) => ...)` hook that is a
   pure function of `t`. Never integrate velocity frame to frame (`x += v`); compute `x = f(t)`.
5. Prefer `tl.fromTo` over `tl.from` for anything that can be re-seeked; set explicit start states.
   Use `immediateRender: false` on later `fromTo` tweens that target an element already tweened.
6. Every element that animates carries `data-layer="<short-id>"` (unique in the scene). The editor,
   probe and QA refer to layers by this id. Text that must be read gets a layer too.
7. Use theme tokens, never literal brand colours: `var(--bg) --bg-2 --ink --ink-2 --muted --accent
   --accent-2 --line`, fonts `var(--font-display|--font-body|--font-mono)`, sizes `var(--fs-xl|lg|md|sm|min)`,
   `var(--radius) var(--stroke) var(--safe-x) var(--safe-y)`. Palette is locked by the bible (R7, R8).
8. Stay inside the safe area: position with `ctx.safe {x,y,w,h}` or `var(--safe-x/--safe-y)`.
   Anything meant to leave the frame gets `data-allow-offstage`.
9. Type: no text below `var(--fs-min)` (3.2% of the short side, R2). Max two type levels per shot.
   Long strings get `data-fit` (auto-shrinks to fit its box, floor = fs-min).
10. One hero per frame (R1). If two things compete, one is >= 2x the other's area or the camera moves
    between them.
11. Timing: landing decelerates (`au.softLand`, `au.glide`, `au.snapSettle`), leaving accelerates
    (`au.exit`); overshoot < 9% (`au.pop` and `au.snapSettle` are already capped). Something moves in
    every 0.5 s window (R4). The last 0.6-1.4 s is a resolved hold with one living thing (R5).
12. Do not draw captions, grain, safe-area guides or a ground plate: the runtime injects captions from
    cues, grain and the ground. Keep the caption band free (bottom ~18% in 9:16, bottom ~12% in 16:9).
13. Camera: `AU.camera({at,x,y,scale,rotate,duration,ease})` transforms the scene root as one lens.
    Elements with `data-depth="0.2..1"` get parallax against camera x/y automatically. Never also
    tween the root's transform yourself.
14. Scenes start already moving (first motion at t <= 0.15 s) and end mid-gesture or on a living hold;
    no fade-to-black, no empty first frame (thumbnail).
15. Code style for AuteurFrame sources: no comments and no emoji in the scene code.

## Reply format (enforced by the validator before anything is rendered)
1. Up to three short plan lines (CONCEPT, SIGNATURE MOVE, HAND-OFF), then exactly ONE fenced ```html block. Nothing after it.
2. The block starts with `<div class="scene">`, then one `<style>`, then one `<script>` that calls `AU.scene(({ tl, ... }) => { ... })`.
3. Planning, reasoning and notes never go inside the block. Markup holds only short on-screen words; a block whose markup
   carries hundreds of characters of prose is rejected.
4. The script must parse (it is checked with `node --check`) and must contain real motion: tweens on `tl`, helper calls
   (`draw`, `split`, `counter`, `camera`, `three`, `ambient`, `particles`) or an `onFrame((t) => ...)` that redraws from t.
   The probe then measures motion energy in every 0.5 s window.
5. Keep the whole fragment under about 9000 characters so the reply is never cut off mid-script; a truncated `<script>`
   is rejected. Prefer loops and data arrays over repeating near-identical markup.
6. A rejected reply is regenerated from scratch with the validator's messages, so fix the cause, do not patch around it.

## Do / Don't
| Do | Don't |
|---|---|
| `tl.fromTo(el,{yPercent:110},{yPercent:0,duration:.4,ease:'au.softLand'},.1)` | `el.animate(...)`, CSS `animation:` for motion |
| `AU.onFrame(t => el.style.setProperty('--p', Math.sin(t*2)))` | `requestAnimationFrame(loop)` |
| `const r = ctx.rand()` | `Math.random()` for positions |
| `ctx.counter('.n', 42, {at:1, duration:.9})` | tween `innerText` with your own interval |
| measure layout once at build time | measure in `onUpdate` (stutter, drift) |
| `data-layer="title"` on every animated node | anonymous animated nodes |
| `var(--accent)` | `#FF5A1F` literal |
| `tl.set(el,{autoAlpha:0}, end)` hard kill after an exit | leaving a stale element at opacity .01 |
| images via `AU.asset('photo1')` | `<img src="https://...">` |

## Recipe: generic seek-safe pattern (any renderer)
```js
const tl = gsap.timeline({ paused: true });
tl.fromTo('#t', { y: 60, opacity: 0.2 }, { y: 0, opacity: 1, duration: 0.4, ease: 'expo.out' }, 0.1);
window.seek = (t) => { tl.time(t, false); drawCanvas(t); };
function drawCanvas(t) { const x = 200 + 80 * Math.sin(t * 1.3); }
```
Any frame must render correctly when seeked in any order (0, 5.2, 1.1, ...). Test by seeking to
random times twice and comparing pixels.

## In AuteurFrame: full worked example (9 s, 16:9 or 9:16)
`data` = `{ "kicker": "Ocean floor", "title": "Deep sea mining", "stat": 4000, "unit": "m" }`
```html
<div class="scene">
  <svg class="rule" data-layer="rule" viewBox="0 0 1000 10" preserveAspectRatio="none"><path d="M0 5 H1000"/></svg>
  <h1 class="title" data-layer="title" data-fit></h1>
  <div class="stat" data-layer="stat"><span class="n">0</span><span class="u"></span></div>
  <div class="glyph" data-layer="glyph" data-depth="0.4"></div>
</div>
<style>
.scene { position:absolute; inset:0; }
.title { position:absolute; left:var(--safe-x); right:var(--safe-x); top:34%; margin:0;
  font:600 var(--fs-xl)/.95 var(--font-display); color:var(--ink); letter-spacing:-.02em; }
.rule { position:absolute; left:var(--safe-x); top:30%; width:38%; height:10px; }
.rule path { stroke:var(--accent); stroke-width:var(--stroke); fill:none; }
.stat { position:absolute; left:var(--safe-x); top:58%; font:500 var(--fs-lg)/1 var(--font-mono); color:var(--ink-2); }
.stat .u { color:var(--accent); margin-left:.15em; }
.glyph { position:absolute; right:var(--safe-x); top:22%; color:var(--accent); }
</style>
<script>
AU.scene(({ tl, D, data, $, split, draw, counter, camera, icon, ambient }) => {
  $('.title').textContent = data.title;
  $('.stat .u').textContent = data.unit;
  $('.glyph').innerHTML = icon('waves', { size: 220, stroke: 1.5 });
  draw('.rule', { at: 0.05, duration: 0.5, ease: 'au.glide' });
  const s = split('.title', { type: 'words' });
  tl.fromTo(s.words, { yPercent: 70, opacity: 0.2 }, { yPercent: 0, opacity: 1, duration: 0.42, ease: 'au.softLand', stagger: { each: 0.07 } }, 0.12);
  tl.fromTo('.glyph', { scale: 1.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'au.snapSettle' }, 0.5);
  counter('.n', data.stat, { at: 1.4, duration: 1.0, ease: 'au.softLand' });
  tl.fromTo('.stat', { y: 40 }, { y: 0, duration: 0.4, ease: 'au.softLand' }, 1.35);
  camera({ at: 0, duration: D, scale: 1.04, ease: 'au.linear' });
  ambient('.glyph', 'sway', { amount: 0.6, period: 4 });
  tl.to(s.words, { yPercent: -60, opacity: 0, duration: 0.3, ease: 'au.exit', stagger: 0.03 }, D - 0.45);
});
</script>
```
Why it passes: first move at 0.05 s; words land on softLand with uneven tails; the glyph arrives
from 1.5x (never from 0); the count lands at 2.4 s; the camera creep and sway keep every 0.5 s
window alive through the 6.5 s hold; the exit accelerates into the cut so the next scene inherits
momentum; tokens only; every animated node has `data-layer`.

## Context object (`ctx`) reference
`tl W H D fps seed rand pick range clamp lerp theme cues data assets safe portrait index globalStart
$ $$ icon split counter draw rough camera chart math typewrite scramble onFrame particles ambient fit asset`.
`cues` are scene-local: `[{start,end,text,words:[{t,e,w}]}]`. `AU.split(el,{type:'chars,words,lines'})`
returns `{chars,words,lines}`. `AU.rough(svg, shapes, {boil:true, boilFps:8, variants:3})`.
`AU.chart.bar(sel,[{label,value}],{at,stagger,duration,highlight,unit})`, `.line(sel,series,opts)`,
`.donut(sel,parts,opts)`. `AU.math(sel, tex, {at,duration,write})`.

## QA checklist
- [ ] grep finds no `http`, `setTimeout`, `setInterval`, `requestAnimationFrame`, `Date.now`, `Math.random`, `@keyframes`, `repeat: -1`.
- [ ] Every element touched by `tl`/`onFrame` has `data-layer`; ids unique.
- [ ] Seeking 0 -> D/2 -> 0.3 -> D gives the same pixels as sequential play (determinism probe).
- [ ] No text under `--fs-min`; nothing outside safe area unless `data-allow-offstage`.
- [ ] Motion energy > 0 in every 0.5 s window; final hold 0.6-1.4 s.
- [ ] No literal colours outside tokens; no caption or grain markup.
- [ ] Probe: zero `off-canvas`, `text-overlap`, `low-contrast` (< 3:1) issues.

## Sources
- AuteurFrame PLAN.md sections 3, 5, 6; runtime `web/runtime/auteur.js` (ctx, eases, probe).
- HeyGen HyperFrames contract: github.com/heygen-com/hyperframes skills/hyperframes/SKILL.md, references/format.md (fromTo not from, register paused timeline, no timers, hard-kill visibility).
- Barty-Bart/motion-graphics explainer-high-energy page contract (seek is a pure function of time; bake history once).
- Tejashmakwana/motionmaxxing runtime selfTest (seek equals play); bang-motion Hukum #2 (deterministic or die).
- Remotion determinism rules: remotion.dev/docs/flickering (no Math.random, use random(seed); everything from useCurrentFrame).
