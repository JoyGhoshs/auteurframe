---
name: 3d-models
description: Find, import and animate real 3D models (free low-poly GLB from Polyfork, many rigged with Idle/Walk/Run clips) with search_models, import_model and the model3d component; picking models that belong together, camera and lighting choices, credits. Use when a real object, vehicle, building, animal or 3D character sells the idea better than a drawing.
stage: animate
tags: [3d, models, glb, gltf, polyfork, rigged, animation, three, camera, props, characters]
version: 1
---

# 3D models

## Finding
`search_models <words>` queries Polyfork (3,289 free low-poly models, real-world scale, flat-shaded, one shared
material). Optional JSON body: `{"class": "character|animal|prop|vehicle|building|terrain|attachment|hand", "rigged": true, "max_triangles": 8000}`.
- Use concrete nouns: "fox", "cargo ship", "server rack", "lighthouse". If coverage is weak, try a synonym or a class.
- Prefer rigged models for anything that should move on its own; their clips are usually `Idle`, `Walk`, `Run`.
- Models from the same kit share palette and scale: choose a hero, then pick neighbours from the same kit.

## Importing
`import_model <id>` downloads the GLB into the project and returns an asset id plus clip names. The credit line
(CC BY 4.0) is recorded on the project automatically; never remove it.

## Animating with model3d
```js
AU.component('model3d', { src: 'as_ce965716a9', clip: 'Walk', x: 5, y: 12, w: 60, h: 80, yaw: -30, orbit: 35, zoom: 1.12, at: 0.2 });
```
- `clip` plays the embedded animation frame-exactly (`clipSpeed` scales it). Empty plays the first clip.
- `yaw` sets the starting turn, `spin` (degrees per second) is a turntable, `orbit` swings the camera across the
  shot, `zoom` pushes in, `float` bobs, `enter` is rise, pop, spin or none, `ground` draws a soft contact shadow.
- The model is auto-fitted and framed; size and place the viewport with `x`, `y`, `w`, `h`.
- For custom 3D (several models in one scene, paths, physics) write your own `three(selector, (g) => ...)` setup: the
  bundle exposes `THREE.GLTFLoader` and `THREE.SkeletonUtils`; load with `defer(new THREE.GLTFLoader().loadAsync(AU.asset(id)))`
  and drive mixers with `mixer.setTime(t)` inside the returned update function. Never use clocks.

## Look
- Low-poly reads best with a clean background, one key light and a soft shadow; let the theme accent rim it.
- Move the camera, not the model, for cinematic shots: `orbit` 20 to 40 degrees and `zoom` 1.1 to 1.2 over the shot.
- Pair a 3D hero with 2D components: a `callout` pointing at part of the model, a `title` above, a `stat` beside it.
