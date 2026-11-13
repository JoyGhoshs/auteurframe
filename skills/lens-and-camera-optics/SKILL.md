---
name: lens-and-camera-optics
description: Choose and animate lens looks for a scene with the lens component - fisheye, wide, telephoto, anamorphic letterbox and streak flares, tilt-shift miniature, macro, vintage film, VHS, CRT, security camera, camcorder viewfinder, dreamy, night vision - plus lens moves (push in, pull out, crash zoom, dolly zoom, rack focus) and overlays (vignette, chromatic aberration, flares, light leaks, dust, grain, bokeh, scanlines, letterbox, REC frame).
stage: animate
tags: [lens, camera, fisheye, anamorphic, tilt-shift, zoom, dolly zoom, rack focus, vhs, film look, overlay, flare, cinematic]
version: 1
---

# Lens and camera optics

A lens is a point of view. Pick it for meaning, not decoration, and keep one family of looks per film.

```
AU.component('lens', { type: 'anamorphic', move: 'push', zoom: 1.12, moveAt: 0.3, focus: [42, 45] });
```
Call it once per scene, after building the scene. The editor's Lens designer can also set a lens for the whole film or a single
scene; a lens called in code takes precedence for that scene.

| type | meaning | use |
|---|---|---|
| documentary | honest, slight weave and grain | journalism, history, interviews |
| anamorphic | cinema, epic scale | trailers, reveals, landscapes, hero moments |
| telephoto | compressed, intimate, watching | portraits, a detail in a crowd |
| wide | space, context | establishing shots, interiors, maps |
| fisheye | playful, distorted, POV | skate, kids, comic beats, peephole |
| tilt-shift | miniature world | cities, logistics, crowds, maps from above |
| macro | tiny worlds, texture | science, products, nature details |
| vintage | memory, archive | flashbacks, history, nostalgia |
| vhs / crt | 80s and 90s, found footage | retro tech, internet culture, music |
| security / night-vision | surveillance, secrecy | crime, privacy, war, investigations |
| viewfinder | someone is filming | behind the scenes, citizen journalism |
| dreamy | soft, hopeful | wellness, love, endings |

## Moves

- `push` slowly toward `focus` across the scene (zoom 1.08 to 1.2): builds attention.
- `pull` reveals context at the end of a scene.
- `crash` (zoom 1.4 to 1.8, 0.3 s) for punchlines and shocking numbers; put it on the spoken word.
- `dolly` (vertigo) for realisations and dread: the frame zooms in while the perspective bends.
- `rack` with `focusA` and `focusB` CSS selectors shifts focus from one element to another at `moveAt`.

## Overlays

Add with `overlays: ['flare', 'leaks']`. Flares need a light source (`flare: [x%, y%]`) consistent with the scene's
highlight. Chromatic aberration and scanlines read as digital or broken media; dust and grain read as film.

## Rules

- Moderate strength (0.6 to 1.0) for most films; 1.5 to 2 only for stylised moments.
- Do not stack fisheye with tilt-shift; do not combine VHS with anamorphic.
- Keep text out of the strongest distortion (edges in fisheye) and away from letterbox bars.
- Lens looks are rendered per frame; heavy looks (tilt-shift blur, fisheye) add render time.
