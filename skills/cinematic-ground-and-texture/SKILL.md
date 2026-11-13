---
name: cinematic-ground-and-texture
description: How to make the ground a lit, textured, living surface (grain, light, depth, ambient motion) instead of a flat swatch; use when designing backgrounds, style packs and holds.
stage: design
tags: [ground, texture, grain, light, ambient, background]
version: 1
---

# Cinematic Ground and Texture

A frame is ground + light + depth + texture, every time. A flat colour field reads as a slide; a ground
that is lit, slightly textured and quietly alive reads as a world. The ground must never compete with
the subject: rich outside the text pocket, calm inside it.

## When to use / not use
- Use: style packs, scene backgrounds, holds, end cards, any frame that would otherwise be still.
- Not for: math stage (clean, no grain: see math-explainer) unless the pack asks.

## Core rules
1. At least 2 surface layers per ground: e.g. a base gradient + a light source (horizon glow,
   spotlight, diagonal duotone, mesh blobs, layered sky) + texture (grain, paper tooth, dot grid).
2. Text pocket contrast: behind text the ground is dark (<= 25% luminance) or light (>= 80%), never
   busy mid-tone. Background elements inside the pocket: opacity <= 0.35, colour from the dark side of
   the palette; <= 40 bright elements visible at once.
3. One grain level per film (about 0.02-0.04 amplitude), animated per frame from a seeded set of tiles,
   never a static noise image. Grain sits above everything except captions.
4. Vignette: soft radial, 8-15% darkening at the corners; same across the film.
5. Light sweeps: a band at about -20 deg, 110-140 px wide (1080p), crossing in 0.8-0.9 s; on text use
   `mix-blend-mode: soft-light/overlay` clipped to the text; once per scene at most.
6. The ground is never static (R6), but it moves slower than the subject:
   - drift 1-3 px/frame or 0.02 W per ~3 s for grids and textures;
   - camera micro-drift: two sines, amplitude ~5 px, periods ~7 s and 2.7 s, rotation +-0.5 deg;
   - dot grid 64 px pitch at 6-10% opacity drifting ~36 px/s diagonally;
   - beat bump (music-led only): whole frame +1.2% scale per quarter note decaying as e^(-25 t);
   - stars twinkle with per-star phase at 1-3.5 rad/s.
7. Pick the ambient motion from a menu per film, and do not reuse the previous film's: moving
   gradient, floating blobs, living grain, light sweep per segment, slowly rotating big shape, rising
   particles, breathing grid, sliding ghost text, parallax layers. Horizontal streaks/lanes only when
   the subject is speed or flow.
8. Background colour may change between segments only with a visible cause: an object covers the
   lens, a push into a colour field, a sweeping band, a cut on a beat. Never a crossfade or white flash.
9. One blur grammar per film: render-time shutter blur (180 deg, 4-8 subframes) OR per-element smear
   OR crisp steps. Large CSS `filter: blur()` and blurred gradients are slow to capture: pre-render glows
   as gradients on a canvas or as images once and move them.
10. Glow belongs to objects (the product, a lamp), not to titles or UI chrome. Titles: clean ink with
    at most a thin shadow.
11. Depth cues: foreground elements slightly defocused (4-7 px) and moving 2-2.4x faster than the
    midground under camera moves.

## Do / Don't
| Do | Don't |
|---|---|
| vertical gradient: near-black top, lit horizon low | flat even blue |
| 300 short dark particles in palette tones | 520 long white warp lines brighter than the text |
| ground changes behind a cut or a wipe | ground crossfades between scenes |
| grain on every frame at one level | grain on some scenes only |
| glow on the hero object | 4-layer glow on every headline |

## Recipe: grainy gradient ground (CSS + seeded canvas grain)
```css
.ground { position:absolute; inset:0;
  background: radial-gradient(120% 80% at 50% 110%, color-mix(in srgb, var(--accent) 35%, var(--bg)) 0%, var(--bg) 55%),
              linear-gradient(180deg, var(--bg-2), var(--bg)); }
.vignette { position:absolute; inset:0; background: radial-gradient(closest-side, transparent 60%, rgba(0,0,0,.14)); }
```
```js
function grainTiles(n, size, seed) {
  let s = seed; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: n }, () => { const c = new OffscreenCanvas(size, size), g = c.getContext('2d'), d = g.createImageData(size, size);
    for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i+1] = d.data[i+2] = v; d.data[i+3] = 10; }
    g.putImageData(d, 0, 0); return c; });
}
```
Pick tile `floor(t * fps) % n` each frame.

## In AuteurFrame
- The runtime injects the pack's ground and grain (do not draw your own). Agents add scene-specific
  ambient life with `AU.ambient(el, kind)` (`float|breathe|sway|spin|drift|pulse`) on NON-text layers,
  `AU.particles(canvas, {kind:'dust'|'stars'|'snow'|'embers'|'bokeh'|'confetti', count, speed})`, and
  `data-depth` for parallax under `AU.camera`.
```js
AU.scene(({ D, $, particles, ambient, camera, onFrame }) => {
  particles('.dust', { kind: 'dust', count: 60, speed: 0.6, opacity: [0.08, 0.3] });
  ambient('.orb', 'drift', { amount: 2 });
  camera({ at: 0, duration: D, scale: 1.03, ease: 'au.linear' });
  const sweep = $('.sweep');
  onFrame((t) => { const p = Math.min(1, Math.max(0, (t - 1.0) / 0.85)); sweep.style.transform = `translateX(${-30 + 160 * p}%) rotate(-20deg)`; });
});
```
- Style packs declare: `ground` (layers), `grain` (0-0.05), `vignette`, `ambient` (menu choice),
  `blur_grammar` (`shutter|smear|crisp`). R6 is checked by probe motion energy on the ground layer.

## QA checklist
- [ ] Ground has >= 2 layers and visible texture at phone size.
- [ ] Text pockets measure <= 25% or >= 80% luminance; contrast >= 4.5:1 for body text.
- [ ] Ground motion present in every 0.5 s window, slower than the subject.
- [ ] Grain level constant across scenes; one blur grammar.
- [ ] No glow on titles or UI chrome; no ground crossfade.

## Sources
- Tejashmakwana/motionmaxxing references/world.md, motion.md R4.8 (shutter 180 deg, 8 subframes, grain 0.03), README "skincare = grain and light".
- bangtutorial/bang-motion references/techniques.md 1b, 7b-7d (text pocket luminance, <= 40 bright elements, opacity <= .35, ambient menu, surface menu).
- alchaincyf/huashu-art-motion y5 (two-sine camera drift, beat bump 1.2%, dot grid 64 px), y1 kurzgesagt (ambient star twinkle, environment always moves).
- Barty-Bart/motion-graphics explainer-high-energy (seeded grain tiles, pre-render glows: blur is slow to screenshot).
