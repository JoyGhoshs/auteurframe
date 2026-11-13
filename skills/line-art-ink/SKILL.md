---
name: line-art-ink
description: Use for hand-inked line-art illustration scenes (one thin pen on paper, figures, villages, objects) that draw themselves and move with physical, non-sine motion.
stage: animate
tags: [line art, ink, illustration, pen, paper, draw on, springs, pendulum]
version: 1
source: distilled from github.com/JDhruv14/line-art-animation (MIT)
---

# Line-art ink

A single thin pen on warm paper. Everything is drawn live in SVG, so it stays sharp and can be stepped frame
by frame. The look survives only if a few rules hold.

## Core rules
| Rule | Detail |
| --- | --- |
| One pen | stroke width 2 to 3 px at 1080p, round caps and joins, ink is one colour (currentColor) |
| Lines curve | nothing is ruler-straight; bow edges slightly, round every joint |
| Limbs are two open strokes | draw a limb as two pen lines that stop short at the far end, filled with paper colour between them |
| Paper is a card | the illustration sits on a paper card; the page around it never changes colour |
| Accent sparingly | one or two flat accent fills (a red scarf, a lit window), never gradients |
| Feet are planted | a walking figure moves exactly gait speed times scale per second so the stance foot does not slide |
| No free sines | hanging things swing as pendulums, cloth and bags follow springs, gestures use keyed poses |
| Day and night | time of day changes the palette: dark ink on warm paper by day, pale ink on indigo at night with warm windows |
| New means new | when asked for something like a reference, keep the pen, proportions and timing feel but invent new characters and props |

## Motion
- Draw on: reveal strokes with DrawSVG in reading order, 0.3 to 0.8 s each, overlapping by 40 percent.
- Pendulum: angle = A * e^(-k t) * cos(w t), with A 6 to 14 degrees, k 0.4, w 2.6 rad/s for a lantern.
- Spring follow: a scarf tip lags its anchor with stiffness 120 and damping 14.
- Birds: wing strokes flap as a keyed two-pose loop at 3 to 4 Hz, the flock drifts on a curved path.
- Wind: grass and cloth lean together in one direction; strength changes slowly over seconds.
- Hold: once drawn, keep life with breathing chimneys, swaying lanterns, drifting clouds, never full stillness.

## Verification
Step the timeline frame by frame at 2x zoom: no sliding feet, no straight segments, no strokes that pop in
without drawing, palette identical across scenes.

## In AuteurFrame
Use the house archetype `line-art` (data: kicker, title, subtitle, night) or write a scene with an inline SVG,
`stroke="var(--ink)"`, `fill="var(--bg)"` for paper fills, and reveal paths with
`draw(paths, { at, duration, stagger })`. Drive pendulums from `onFrame((t) => el.setAttribute('transform', ...))`
so they stay deterministic. Pair with the Editorial Paper or Paper Cut packs.
