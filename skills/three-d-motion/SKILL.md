---
name: three-d-motion
description: Use when a scene needs real 3D (objects, product forms, galleries, depth moments) rendered deterministically with three.js inside a seekable composition.
stage: animate
tags: [3d, three.js, webgl, camera, materials, lighting, determinism]
version: 1
---

# 3D motion with three.js

A 3D moment works when it reads as designed, not as a tech demo. Direction distilled from the
prompt-motion realtime template and studio practice.

## Rules
| Do | Do not |
| --- | --- |
| MeshPhysicalMaterial with varied roughness (0.05 glass-like to 0.6 matte) and clearcoat on hero objects | Default MeshBasic/MeshNormal materials or one roughness for everything |
| Key + fill + rim lights, a PMREM environment for reflections, ACES tone mapping | A single ambient light, flat colour |
| Soft shadows on a shadow-catcher floor (ShadowMaterial opacity 0.15 to 0.25) | Floating objects with no grounding |
| One named camera move per shot: dolly, crane, orbit, push-in, rack focus, eased in and out | Orbit controls, constant linear spin as the only idea |
| Every value computed from time t; seeded randomness | Clock reads, Math.random without seed, physics that accumulate state |
| Fog for depth, tight near/far planes (0.1 to 120) | Distant surfaces flickering, z-fighting |
| Shadow bias around -0.0004 | Shadow acne stripes |
| Colours from the style tokens (accent, accent-2, ink, bg-2) | Random rainbow palettes |

Timing: let objects arrive (scale from 0 with ease-out over 0.6 to 0.9 s, staggered 0.1 s), then breathe
(slow float 0.1 to 0.2 units, gentle rotation). Land the camera move by D minus 0.8 s so the cut lands on a
resolved frame. Text stays in HTML on top of the canvas, never as floating 3D labels.

## In AuteurFrame
`three(selector, setup, opts)` creates a WebGL renderer sized to the element, a scene with a room
environment map, key, fill and rim lights, ACES tone mapping and soft shadows. `setup(g)` receives
`{ THREE, scene, camera, lights, color('var(--accent)'), material(colour, extra), ease, rand, D }` and must
return an update function `(t) => {}` that positions everything from `t`. The runtime calls it on every
seek and renders the frame, so preview and render are identical.

```html
<div class="scene"><div class="stage3d" data-layer="three" data-allow-offstage></div>
<h1 class="title" data-layer="title">Depth you can <em>feel</em></h1></div>
<style>.stage3d{position:absolute;inset:0}.title{position:absolute;left:var(--safe-x);bottom:var(--safe-y);margin:0;font:800 var(--fs-xl)/.95 var(--font-display);color:var(--ink)}</style>
<script>
AU.scene(({ tl, three, split, D }) => {
  three('.stage3d', (g) => {
    const T = g.THREE;
    const floor = new T.Mesh(new T.PlaneGeometry(60, 60), new T.ShadowMaterial({ opacity: 0.2 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -1.6; floor.receiveShadow = true; g.scene.add(floor);
    const knot = new T.Mesh(new T.TorusKnotGeometry(1, 0.34, 220, 32), g.material('var(--accent)', { roughness: 0.18 }));
    knot.castShadow = true; g.scene.add(knot);
    return (t) => {
      const s = g.ease(Math.min(1, t / 0.9)); knot.scale.setScalar(Math.max(0.001, s));
      knot.rotation.set(t * 0.4, t * 0.6, 0); knot.position.y = Math.sin(t * 1.2) * 0.15;
      const p = g.ease(Math.min(1, t / (D - 0.8)));
      g.camera.position.set(Math.sin(p * 0.6) * 9, 1.2 + p * 1.5, Math.cos(p * 0.6) * 9);
      g.camera.lookAt(0, 0, 0);
    };
  });
  const s = split('.title', { type: 'lines,words', mask: 'lines' });
  tl.from(s.lines, { yPercent: 110, duration: 0.8, stagger: 0.08, ease: 'au.softLand' }, 0.5);
});
</script>
```

The house archetype `three-hero` offers two modes: `shapes` (glossy hero forms with an orbit camera) and
`gallery` (images on a curved wall with a light wave and a crane pull-back).

Render cost: software WebGL in headless Chrome renders about 3 to 6 frames per second at 1080p; keep
geometry under 200k triangles and shadow maps at 1024.
