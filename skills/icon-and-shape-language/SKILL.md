---
name: icon-and-shape-language
description: One coherent vocabulary of icons, shapes, motifs and morphs per film (stroke weights, radii, sizes, press and check animations); use when a scene needs icons, diagrams, shapes or a recurring motif.
stage: design
tags: [icons, shapes, motif, morph, svg, lucide]
version: 1
---

# Icon and Shape Language

Icons and shapes are words in a small visual language. A film speaks one dialect: one icon set, one
stroke weight, a few radii, one motif derived from the subject or brand. Mixed strokes, random radii
and decorative icons read as clip art.

## When to use / not use
- Use: icon grids, process flows, UI-like elements, diagrams, motifs that carry across scenes, morphs.
- Not for: illustration with characters (hand-drawn-doodle) or data marks (data-visualization-motion).

## Core rules
1. One icon set (Lucide, 24 px grid) and one stroke weight per film: 1.5 for elegant/editorial, 2 for
   default, 2.5 for bold/kids. Scale icons uniformly; keep stroke visually constant
   (`vector-effect: non-scaling-stroke` or scale the stroke with the inverse).
2. Sizes at 1080 short side: meaningful icon >= ~100 px (>= 9% of short side); icon in a tile 96-160
   px; inline icon beside text = cap height x 1.1. Below 48 px an icon is texture.
3. Radii vocabulary: pick 2-3 and reuse: card 26, bubble 30, keycap 22 (at 1080p) or tokens
   `var(--radius)` and `calc(var(--radius) * .6)`. Numbers sit in perfect circles.
4. Every element has a one-line reason or it is not drawn. No decorative icons; no icon that is the
   name's first association (rocket for launch, bulb for idea) unless the story turns it.
5. One motif per film, derived from the subject's own shape (the logo's dot, a product's corner, a
   map pin). The motif carries across seams and may change scale up to 6x between scenes.
6. Entrances: identity objects arrive from 1.4-2x scale decelerating to 1 (`au.snapSettle`, 0.35-0.5 s)
   or slide from an edge; small items in a cascade may grow from ~0.3 with 1-3 frame stagger.
   Never grow a single hero icon from 0.
7. Drawn icons: stroke draw-on 0.4-0.8 s (`au.glide`), then optional fill 0.15 s. Checkmark: stroke
   by arc length in 0.22 s while its box goes 1 -> 1.25 -> 1; strike-through 0.08 s later.
8. Press: squeeze 2-6 f to 0.75-0.8, the target reacts 0-1 f after the cursor and brightens, release
   slower (0.3 s) with <= 5% rebound. No ripple rings, no white flash.
9. Morphs: one closed outline per object, resampled to the same point count, same winding, aligned
   start point (top-left, clockwise). Morph 0.6-1.0 s `au.glide`; keep colour and edge identical on
   both sides of a seam (within 2 px). MorphSVG `shapeIndex` set explicitly when auto fails.
10. Grids of icons: <= 7 moving at once; beyond that stagger groups. Ring layouts use an ellipse with
    depth by size, each item enters at its own slot.
11. Flow diagrams: arrows at least 2x head length; connectors leave along normals; labels a word or two.

## Do / Don't
| Do | Don't |
|---|---|
| one stroke weight film-wide | 1.5 and 2.5 stroke icons side by side |
| icons that act (a lock closes, a file slides into a folder) | icons that just sit next to bullets |
| motif from the subject's geometry | generic sparkles, stars and particle bursts |
| explicit morph start points | morphing a circle into a 9-point star without resampling |
| brighten the pressed target | ripple ring on every click |

## Recipe: icon tile pop + check (plain GSAP)
```js
tl.fromTo('.tile', { scale: 1.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.42, ease: 'expo.out', stagger: { each: 0.05, from: 'start' } }, 0.2);
tl.fromTo('.check path', { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.22, ease: 'power2.out' }, 1.1);
tl.fromTo('.check', { scale: 1 }, { keyframes: [{ scale: 1.25, duration: 0.1 }, { scale: 1, duration: 0.12 }] }, 1.1);
```

## In AuteurFrame
- `AU.icon(name, {size, stroke, color})` returns an inline Lucide SVG string (sprite vendored; no URL).
  Use `color: 'currentColor'` and set `color: var(--accent)` on the holder.
- Draw-on with `AU.draw(el, {at, duration})`; morph with MorphSVGPlugin on `tl`.
```js
AU.scene(({ tl, $, $$, icon, draw }) => {
  const names = ['file-text', 'search', 'git-branch', 'check-circle'];
  $$('.step').forEach((el, i) => { el.innerHTML = icon(names[i], { size: 140, stroke: 2 }); el.setAttribute('data-layer', 'step-' + i); });
  tl.fromTo($$('.step'), { scale: 1.45, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'au.snapSettle', stagger: { each: 0.09 } }, 0.15);
  draw('.flow path', { at: 0.5, duration: 0.7, stagger: 0.18 });
  tl.to($('.step:last-child'), { keyframes: [{ scale: 0.78, duration: 0.07, ease: 'au.glide' }, { scale: 1, duration: 0.3, ease: 'au.softLand' }] }, 2.0);
  tl.to($('.step:last-child'), { color: 'var(--accent)', duration: 0.12 }, 2.03);
});
```
- Style packs declare `icon_stroke`, `radii`, `motif` so every scene agent reads the same dialect from
  the bible (R8 continuity).

## QA checklist
- [ ] One icon family, one stroke weight across the film (lint stroke-width values).
- [ ] Meaningful icons >= 9% of the short side.
- [ ] Each icon has a reason stated in the scene plan.
- [ ] No hero icon starts at scale 0; no ripple rings.
- [ ] Morph seams match within 2 px and keep colour.

## Sources
- alchaincyf/huashu-art-motion y5_kinetic_type (radii 26/30/22, check 0.22 s, keycap press 14%).
- Tejashmakwana/motionmaxxing references/motion.md R3.6-R3.7, R7.2 (oversize arrival, cascade exception, press squeeze, no ripple), layout.md R6.2 (ring layouts).
- alexgreensh/anidoodle references/motion-grammar.md (persistent actor, 2 px seam check, handoff morph) and craft-bar.md (every element has a reason).
- cloveric/claude-drawing-skill docs/PRINCIPLES.md (shape morph: same point count, winding, aligned start).
- Barty-Bart/motion-graphics motion-broll (one icon set, one stroke weight).
- Lucide icons: lucide.dev (ISC).
