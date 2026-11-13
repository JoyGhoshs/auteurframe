---
name: paper-cut-craft
description: Use for paper-cut, cut-paper diorama or storybook scenes built from layered torn-edge shapes with soft shadows and parallax.
stage: design
tags: [paper cut, craft, diorama, parallax, storybook, layers]
version: 1
---

# Paper-cut craft

Paper-cut reads as handmade when four things are true: layers, irregular edges, cast shadows and gentle
physical motion.

## Construction
- 4 to 6 depth layers, back to front, each one tone deeper. Mix the accent into the paper colour for the
  middle layers so the palette stays unified.
- Edges are never perfect curves: add 6 to 12 px jitter and small straight "scissor" segments every few
  points.
- Every layer casts a soft shadow upward or downward: duplicate the shape, fill rgba(0,0,0,0.18 to 0.25),
  offset 8 to 12 px. Do not use CSS blur filters on full-frame layers; they are slow to render.
- Props (sun, clouds, trees, houses, characters) are flat shapes with one shadow each. Clouds are 3
  overlapping circles.
- Type sits on paper: banners with a notched tail, tags on strings, labels cut from a contrasting sheet.

## Motion
| Element | Motion | Ease and timing |
| --- | --- | --- |
| Layers | rise from below in order back to front | ease-out, 0.8 to 1.1 s, stagger 0.1 to 0.15 s |
| Sun or moon | slow rise or arc | ease-out over 1.2 to 1.6 s |
| Clouds | drift sideways 4 to 8 percent of width across the scene | linear |
| Banner | drops from above and swings to rest like it hangs on a string | soft land, then sine sway of 1 to 2 degrees |
| Camera | slow push of 3 to 5 percent with parallax by depth | linear across the shot |

Avoid: bouncy overshoot on big layers, perfect geometric hills, glossy gradients, drop shadows that blur.

## In AuteurFrame
Use the house archetype `paper-cut` (data: kicker, title, subtitle) or the Paper Cut style pack. In custom
code, give each layer `data-depth` between 0.15 and 1.0 and move the camera with
`camera({ at: 0, x: W * 0.02, scale: 1.04, duration: D, ease: 'none' })`; the runtime applies parallax.
