---
name: motion-craft-rules
description: Ten non-negotiable motion rules for professional animation in any style - eased motion only, multi-property entrances, staggering, fast exits, a five-layer stack, Ken Burns on stills, micro motion on idle elements, time from D and fps, colours from theme variables, preview before finishing - plus SVG animation techniques (path drawing, morphs, masks, gradients). Read for every scene.
stage: animate
tags: [motion, rules, easing, stagger, layers, svg, polish, quality, timing]
version: 1
---

# Motion craft rules

1. Never linear for movement. Use ease curves (power2/3, back.out for pops, au.softLand, au.snapSettle) or springs. Linear only for
   continuous drifts (clouds, parallax, counters ticking).
2. Entrances animate two or three properties together (opacity plus y plus scale, or clip plus x). A lone fade is not an entrance.
3. Stagger everything that arrives in a group: 0.06 to 0.2 s between items, words or letters.
4. Exits are faster than entrances (about 0.35 s against 0.6 s) and leave in a direction that matches the next shot.
5. Five-layer stack in every scene: background (gradient or painting), assets (photos, characters, maps), graphics and type, colour grade
   (a soft overlay or vignette), texture (grain). Depth sells production value.
6. Every still image moves: Ken Burns scale 1 to 1.08 with a small pan, toward the subject (the image focus point).
7. Anything visible longer than 2 s keeps breathing: sine micro motion (1 to 3 px, 0.3 to 0.8 Hz), flicker, sway, idle loops.
8. Time comes from the scene: positions in seconds relative to D, accents on word timings, nothing hard-coded beyond D.
9. Colours and fonts from CSS variables only; one hero colour per frame, used on the one thing that matters.
10. Preview, look at the frames, fix, preview again. Never finish an unchecked scene.

Pacing: something moves in the first 0.5 s, a new element at least every 3 s, hit then hold (15 to 20 frames) then build, the biggest
move at the payoff.

## SVG techniques

- Draw lines on: `ctx.draw(path)` or `stroke-dasharray` plus `stroke-dashoffset` from `getTotalLength()` to 0; stagger several paths.
- Rotate SVG parts around their joint: set `transform-origin` or use `rotate(a, x, y)`; SVG transforms default to the origin.
- Morph between shapes only when both paths have the same command structure (or use the MorphSVG plugin).
- Masks and clip paths for reveals (circle iris, wipe), gradients in `<defs>` for skies and glows, `feGaussianBlur` only on small elements.
- Animate a group's transform separately from its children's to layer motion (body travels, limbs swing).
- Prefer transform and opacity; animating `d` or many filters on large areas is slow.
- `stroke-linecap: round` and `stroke-linejoin: round` for friendly cartoon lines.
