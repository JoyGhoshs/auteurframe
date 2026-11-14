---
name: stop-motion-craft-looks
description: Make code-rendered films look handmade - felt, clay, paper and toy stop-motion - with stepped timing (on twos or threes), per-pose boil, tabletop lighting, macro framing, and a matching grade and sound. Use when the brief says felt, claymation, stop motion, handmade, paper craft, toy or cosy.
stage: design
tags: [stop-motion, felt, clay, claymation, paper craft, handmade, toy, boil, on twos, cozy, tabletop]
version: 1
---

# Stop-motion craft looks

## Timing

- Characters and effects move on twos (12 poses per second at 24 or 30 fps) for felt and clay, on threes for paper.
  `world3d` does this from its `look`; override with `steps: 1 | 2 | 3`.
- Keep the camera, focus pulls and fast flying objects smooth: a stepped camera reads as lag, not craft.
- Boil: each new pose gets a tiny seeded offset (1 to 2 px, under half a degree). `boil: 0` turns it off for calm holds.
- Snaps overshoot slightly and settle within about 0.17 s; hold key poses for 6 to 12 frames so they read.

## Materials

- Felt: matte, fibrous, soft sheen at grazing angles, dashed stitches on seams, brass button joints at shoulders.
- Clay: soft fingerprints, slightly glossy highlights, rounded forms with no sharp edges.
- Paper: flat cards with grain, visible layering and cast shadows between layers.
- Toy: glossy clearcoat, saturated plastic colours, crisp highlights.

## Set and light

- Build a tabletop set: a sofa, rug, lamp and plant for cosy interiors (world3d `living-room`), or a forest diorama.
- Warm key light from one side, soft fill, a practical lamp in frame. Macro framing: medium and close shots, low height.
- Grade with `stop-motion` (warm, slight fade, grain, vignette); never add grain inside the scene when the grade adds it.

## Sound

Soft foley over music: fabric rustle, tiny pops on snaps, wooden knocks. Keep music light (playful or chill moods).
