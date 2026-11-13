---
name: math-explainer
description: Use when a scene explains a formula, proof, function, geometry or algorithm in the 3Blue1Brown/manim grammar on the web (Create, Write, Transform, LaggedStart, colour-coded variables).
stage: animate
tags: [math, manim, 3b1b, equation, katex, transform, geometry]
version: 1
---

# Math Explainer (manim grammar on the web)

Manim films work because every move is a step of the argument: drawing a side defines it, a square appearing is squaring, a Transform is a substitution. This skill ports manim's animation vocabulary, timing defaults and colour conventions to HTML/SVG/GSAP so any agent can reproduce the look without Python.

## When to use / not use

- Use for formulas, proofs, functions, vectors, matrices, probability, algorithms, neural nets drawn as math.
- Use when the narration contains action verbs ("flatten this", "multiply each pixel").
- Not for product launches, emotional stories, or real-world data trends (data-visualization-motion).
- Not for fast cuts: native pace is 1-3 s per animation plus about 1 s wait.

## Core rules

1. Write "who becomes whom" for every shot; the shot's first frame is the object (axes, grid, curve), not a title.
2. Ease: smooth = 6t^5 - 15t^4 + 10t^3 (3b1b); ManimCE uses a sigmoid. Linear only for Write progress, constant rotation and ShowPassingFlash travel.
3. Default run_time 1 s, wait 1 s. In 3b1b source the most common explicit run_time is 2 s, then 3 s, 1 s, 4 s.
4. Create / ShowCreation: stroke sweeps from start 0.5-1.0 s; closed shapes draw border then fill fades (DrawBorderThenFill). Axes before ticks, ticks before labels.
5. Write: outline draws over each glyph's first half, fill fades over the second half, lag = min(4/(n+1), 0.2) between sub-objects; < 15 sub-objects 1 s, otherwise 2 s. Formulas are written, never typed or popped.
6. Transform / TransformMatchingTex: terms matched by id glide to new positions; unmatched terms cross-fade while moving; 0.8-1 s (3b1b TransformMatchingTex default 2 s). A term that changes identity keeps its colour.
7. Shape morph: resample both outlines to the same point count, same winding, aligned start (top-left, clockwise), interpolate points linearly plus colour.
8. FadeIn/FadeOut with shift 24-40 px (in from below, out upward), 0.3-0.5 s.
9. LaggedStart: lag_ratio 0.05 default, 0.1 common; 0.5 across sibling objects (three squares); dense sets 0.01 (100 items over 1.1 s).
10. Indicate: there_and_back scale 1.2 plus tint yellow, about 0.6 s. ShowPassingFlash: a copy of the stroke, 1.5x width, yellow, visible window time_width 2 sliding along.
11. Camera moves only as events: hold, push to next object (smooth, about 1 s), hold. One fast push (0.28 s, 18-32%) for the conclusion at most twice per scene. Holds are still in this grammar; keep ambient life to the number plane only.
12. At most 2 text points on screen; at most 4 semantic colours; one colour = one quantity everywhere (formula, figure, label, readout, caption).
13. The equation and the picture agree: readouts are computed from the same tracker that moves the figure; rounded values must still add up as shown.

## Palette and units

| Token | 3b1b | Use |
|---|---|---|
| background | #000000 (ManimCE demos #0E0E10) | stage, flat, no gradient |
| BLUE_C | #58C4DD | quantity / positive weight |
| RED_C | #FC6255 | quantity / negative weight |
| YELLOW | #FFFF00 (CE YELLOW_C #F7D96F) | result, highlight, Flash |
| GREEN_C | #83C167 | quantity 2 |
| TEAL_C | #5CD0B3 | extra quantity |
| GREY A-E | #DDD #BBB #888 #444 #222 | axes, ticks, guides |

- 3b1b exports with saturation x1.5; flat manim constants look grey without it.
- Frame height = 8 units; at 1080p 1 unit = 135 px. Default stroke 4 px; axes/edges 2 px; grid main 2 px, sub 1 px at 25% opacity.
- Fills = stroke colour at 14-35% opacity. Captions on a black backing rect at 75%.
- Type: CMU Serif / Latin Modern for math and prose; variables italic, digits and function names upright, true minus sign, superscript 0.6 size.
- Sizes at 1080x1920: main formula 90-110 px, second line 60-70, figure labels 40-52, ticks 28-32, nothing under 28.
- No glow, bloom, grain, wobble or drop shadow: brightness comes from saturated thin lines on black.

## Layout: named anchor grid

Code2Video gave the LLM a 6x6 anchor grid (rows A-F, columns 1-6) instead of coordinates; removing it cost -26.8 TeachQuiz. Use the same: formula pinned in the top 1/8 (does not move with the camera), figure in the middle cells, readouts low-left, caption band reserved. Place objects by anchor names (point-level "B2", region-level "A1:C3").

## Do / Don't

| Do | Don't |
|---|---|
| Build the figure in the order of the argument | Show the finished diagram then talk over it |
| Colour `a` red in formula, side, label and readout | Recolour a term after a Transform |
| Write formulas glyph by glyph | Type formulas like a terminal or pop them |
| Keep labels off strokes, on the outside of segments | Let tick labels sit where the curve crosses |
| Hold still during waits | Add slow uniform push-ins to fill time |
| Use pure yellow only for Flash | Use dark-navy gradient "tech" backgrounds |

## Recipe: smooth and lagged in GSAP

```js
const smooth = t => t * t * t * (t * (t * 6 - 15) + 10);
gsap.registerEase && CustomEase; // smooth is a plain function: pass as ease
function lagged(i, n, lag) { const total = 1 + (n - 1) * lag; return { start: i * lag / total, len: 1 / total }; }
// Write: draw outline then fill per glyph path
function write(tl, paths, at, dur) {
  const n = paths.length, lag = Math.min(4 / (n + 1), 0.2);
  paths.forEach((p, i) => {
    const L = p.getTotalLength(), s = lagged(i, n, lag);
    gsap.set(p, { strokeDasharray: L, strokeDashoffset: L, fillOpacity: 0 });
    tl.to(p, { strokeDashoffset: 0, duration: dur * s.len * 0.5, ease: 'none' }, at + dur * s.start);
    tl.to(p, { fillOpacity: 1, strokeOpacity: 0, duration: dur * s.len * 0.5, ease: smooth }, at + dur * (s.start + s.len * 0.5));
  });
}
```

## Recipe: TransformMatchingTex by id

```
render both equations with per-term spans: <span data-id="a">a</span>^2 + ...
for id in union(ids):
  if in both: tween old span to new span's bounding box (x, y, scale), colour kept
  if only old: fade out while moving toward nearest matched neighbour
  if only new: fade in at final position, shift 24 px
swap DOM at end: hide old equation, show new one at identical positions (no visible jump)
```

## In AuteurFrame

Use the Math Stage pack (tokens map --bg to #000 or #0E0E10, --accent to YELLOW, --accent-2 to BLUE_C). `AU.math(el, tex)` renders KaTeX; wrap terms with `\htmlData{id=a}{a}` or `\class{q-a}{a}` so each term is addressable and colourable. `AU.draw(sel, {at, duration})` is ShowCreation for SVG strokes.

```html
<div class="scene">
  <div class="eq" data-layer="eq"></div>
  <svg class="fig" data-layer="fig" viewBox="0 0 800 600">
    <path class="side a" d="M100 500 L500 500"/><path class="side b" d="M500 500 L500 200"/>
    <path class="side c" d="M100 500 L500 200"/>
  </svg>
</div>
<style>
.eq{position:absolute;top:var(--safe-y);width:100%;text-align:center;font-size:var(--fs-lg);color:var(--ink);}
.fig{position:absolute;left:50%;top:55%;width:50%;transform:translate(-50%,-50%);}
.side{fill:none;stroke-width:4;} .a{stroke:#FC6255;} .b{stroke:#83C167;} .c{stroke:#FFFF00;}
.q-a{color:#FC6255;} .q-b{color:#83C167;} .q-c{color:#FFFF00;}
</style>
<script>
AU.scene(({ tl, D, $, $$ }) => {
  AU.draw('.side.a', { at: 0.2, duration: 0.6 });
  AU.draw('.side.b', { at: 0.5, duration: 0.6 });
  AU.draw('.side.c', { at: 0.8, duration: 0.7 });
  AU.math($('.eq'), '\\class{q-a}{a}^2+\\class{q-b}{b}^2=\\class{q-c}{c}^2');
  tl.from($$('.eq .q-a, .eq .q-b, .eq .q-c'), { y: 30, opacity: 0, duration: 0.5, stagger: 0.1, ease: 'au.glide' }, 1.6);
  tl.to($('.side.c'), { strokeWidth: 7, duration: 0.3, ease: 'au.softLand', yoyo: true, repeat: 1 }, 2.6);
  tl.to($('.fig'), { scale: 0.96, duration: Math.max(0.5, D - 3.6), ease: 'au.drift' }, 3.2);
});
</script>
```

## QA checklist

- Each quantity has exactly one colour across formula, figure, labels, readouts, captions.
- Numbers shown are computed, not typed; displayed rounding sums correctly.
- No label crosses a stroke or another label; formula stays in top band; nothing under --fs-min.
- <= 2 text points visible; <= 4 semantic colours; no glow/grain/gradient.
- Every move maps to a narration verb; nothing moves without a purpose.
- Last frame of a Transform shot equals the first frame of the next shot (pixel diff 0 when chained).

## Sources

- https://github.com/3b1b/manim (rate_functions.py, creation.py, default_config.yml); https://github.com/3b1b/videos custom_config.yml
- https://github.com/ManimCommunity/manim ; https://www.3blue1brown.com/faq
- alchaincyf/huashu-art-motion t1_3b1b.md ; cth9191/animate styles/math/STYLE.md
- Code2Video https://arxiv.org/html/2510.01174 (6x6 visual anchors) ; TheoremExplainAgent https://arxiv.org/html/2502.19400
