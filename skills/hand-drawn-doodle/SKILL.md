---
name: hand-drawn-doodle
description: Use for whiteboard, sketchbook, doodle or crosshatch explainers where lines are drawn on, boil while held, and the hand paces the narration.
stage: animate
tags: [doodle, whiteboard, sketch, rough, boil, draw-on, hand-drawn]
version: 1
---

# Hand-Drawn Doodle

Doodle animation is alive because the line is never perfectly still and never simply fades in. Marks are made in the order a hand makes them (pencil, then ink, then colour), every held line boils on a stepped clock, and the drawing trails the narration slightly. This skill distils anidoodle (pen with wobble, boil and progress), cth9191 crosshatch and sketchbook styles, huashu y3 whiteboard measurements (RSA Animate, Minute Physics) and rough.js practice into deterministic rules for HTML/SVG.

## When to use / not use

- Use: explainers of ideas with metaphors that can be drawn (RSA style), friendly educational shorts, "plan then do" sequences, notebook-style product stories.
- Not: data that must be precise (use data-visualization-motion with clean strokes), math proofs (math-explainer, the one clean style), luxury/product launches.
- Choose one grammar and do not mix: **RSA board** (one huge board, camera travels ~5.3 moves/min) or **Minute Physics sheets** (camera still, hard cut to a fresh sheet ~8.1/min).

## Core rules

1. **Marks are made, never faded.** A stroke grows along its path (stroke-dashoffset or progress). Wash spreads from where it touched. Only reactions pop (a "!", a stamp, a hop): 0.3 s, overshoot capped < 9%.
2. **Medium order.** Pencil (graphite, light, two loose passes) for provisional/construction, ink (one confident stroke plus a thin second pass that does not quite agree) once decided, then colour as a quick scribble laid a few px off the line. Mess is graphite; settled results are ink.
3. **Boil on a stepped clock.** Re-jitter the line on a fixed step: every 2 frames at 24 fps (12 Hz, cth9191) or every 4 frames at 30 fps (7.5 Hz, anidoodle `b = floor(frame/4)`). Amplitude small: ~0.5-0.6 px boil, ~1.1 px base wobble at 1080p; structure (where a line goes) never moves, only the tremor. The seed is `hash(elementId) + boilIndex`, never random per frame. In math/data/UI scenes: no boil.
4. **Everything on the drawn layer steps; the camera stays smooth.** Drawn elements on 12 fps (on twos), camera/pan at full rate.
5. **Writing speed.** Body text ~16 characters/s; titles ~7.5 characters/s (half speed to "set the topic"). Narration is ~13 characters/s, so writing roughly equals speaking speed. Small icon 0.5-1 s, a head ~2 s. Each stroke: duration = length / pen speed, minimum 0.04 s, 0.02 s pen-lift between strokes, sineInOut inside a stroke (slow start and finish). Long strokes fast, fiddly ones slow.
6. **Trail the voice.** Start drawing 0.2-0.8 s after the matching phrase begins (median +0.5 s); finish within 1 s after the phrase ends. Exception: setup drawings (an arrow, a bottle) may be drawn a few seconds early and wait. Minute Physics style: the drawing lands with the noun, ~+0.3 s.
7. **Pen path.** Gap between strokes < 0.25 s: the pen tip arcs from end to next start (lifted ~30 px, sineInOut). Longer gap: pen leaves to bottom-right off frame in 0.35 s ease-in, re-enters 0.3 s before the next stroke ease-out. The pen leads the line; never animate all parts of a figure simultaneously with the pen wandering.
8. **Complex illustrations are not drawn on camera.** Pre-draw them and reveal by camera move, or cut them in whole and let the hand add colour. A zigzag reveal mask (8 rows, 0.7 s) can stand in for a drawn portrait.
9. **Drawing ink rate.** RSA adds about 0.25% of frame area per second of new ink (median). Speed-up factor of real whiteboard videos is 5-12x real drawing time.
10. **Board camera.** Pans 1.2-2.4 s easeInOutSine, ~0.23 W per move, 75% overlap with the previous block; whip 0.8 s with motion blur only during the whip; finish with a pull back to show the whole board (0.6 s fast, then hold).
11. **Text is less than half the board.** If over half the written words duplicate the narration, you are writing, not drawing. One handwritten line max per block; one highlighted word per caption.
12. **Page is the world.** Paper tone, tooth, a dot grid or ruled lines, smudges and ghosts of erased lines stay in view. Shading is hatching or scribble, never gradients; shadows are smudges.
13. **Rotate block templates.** "Year -> object -> label" used more than 3 times becomes a template; alternate comparison, flow with arrows, detail zoom, full-panel picture.
14. **Draw-on films end on the finished still.** The last stretch equals the final drawing pixel for pixel; held drawing still boils.

### rough.js settings

| Use | roughness | bowing | fill | other |
|---|---|---|---|---|
| ink outline | 1.0-1.4 | 0.8-1.2 | none | strokeWidth 2.5-3.5 px at 1080p |
| graphite construction | 1.8-2.5 | 1.5 | none | stroke opacity 0.45-0.6, strokeWidth 1.5 |
| colour scribble | 1.2 | 1 | 'zigzag' or 'hachure' | hachureGap 6-10, hachureAngle -41 to -60, fillWeight 1.5-2.5 |
| crosshatch shade | 1 | 1 | 'cross-hatch' | hachureGap 5-7 |

Fix `seed` per element (deterministic). Boil by regenerating with `seed + boilIndex` every 2-4 frames, cycling 2-4 variants (cache them; do not regenerate unbounded).

## Do / Don't

| Don't | Do |
|---|---|
| Finished picture fades in | Pencil, ink, colour, in that order, pen leading |
| Still, vector-perfect held line | Boil every 2-4 frames, tremor only |
| Math.random jitter per frame | Seeded jitter by element id + boil index |
| Write whole narration sentences on the board | Draw the metaphor; one short handwritten line |
| Draw ahead of the voice | Trail by ~0.5 s, finish within 1 s of the phrase |
| Gradient shading, drop shadows | Hatching, scribble fills, smudges |
| Second accent colour | Graphite + ink + one accent (hero only) + highlighter for the one word |

## Recipe: draw-on with boil (plain SVG + GSAP, deterministic)

```js
const fps = 30, STEP = 4;                                    // boil every 4 frames
paths.forEach(p => { const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; p.dataset.len = L; });
let t0 = 0.6;
paths.forEach(p => { const d = Math.max(0.04, p.dataset.len / 2600); tl.to(p, { strokeDashoffset: 0, duration: d, ease: 'sine.inOut' }, t0); t0 += d + 0.02; });
// boil: swap among 3 pre-jittered variants of each path by stepped time
tl.eventCallback('onUpdate', () => {
  const b = Math.floor(tl.time() * fps / STEP) % 3;
  boilGroups.forEach(g => g.children.forEach((v, i) => v.style.visibility = i === b ? 'visible' : 'hidden'));
});
```

## In AuteurFrame

- `AU.rough(svgEl, shapes, { boil })` draws rough.js shapes with a seed derived from `ctx.seed` + element index; `boil: { every: 4, variants: 3 }` swaps variants on the frame clock (seek-safe). `AU.draw(sel, { at, duration })` draws strokes on along their length.
- Timing: for each cue phrase, `at = phrase.start + 0.5`, finish by `phrase.end + 1.0`.
- Use the Whiteboard Doodle style pack tokens: `--bg` paper, `--ink` ink, `--muted` graphite, `--accent` the hero only.
- Every drawn group carries `data-layer`; boil counts as motion energy for R4, but the probe still requires a new event every 2-4 s in the story.

```html
<svg class="board" data-layer="board" viewBox="0 0 1920 1080"></svg>
<p class="hand" data-layer="label">water finds the low road</p>
<style>.hand{font:500 var(--fs-md)/1.1 var(--font-display);color:var(--ink)}</style>
<script>
AU.scene(({ tl, D, cues, $ }) => {
  const ph = cues[0] || { start: 0.3, end: 2.4 };
  const g = AU.rough($('.board'), [
    { type: 'path', d: 'M300 700 C 600 520, 900 760, 1300 600', roughness: 1.2, stroke: 'var(--ink)', strokeWidth: 3 },
    { type: 'circle', x: 1420, y: 590, r: 70, roughness: 1.4, fill: 'var(--accent)', fillStyle: 'hachure', hachureGap: 8 }
  ], { boil: { every: 4, variants: 3 } });
  AU.draw(g.strokes, { at: ph.start + 0.5, duration: Math.min(1.6, ph.end - ph.start + 0.5) });
  const words = AU.split($('.hand'), { type: 'chars' });
  tl.fromTo(words, { opacity: 0 }, { opacity: 1, duration: 0.01, stagger: 1 / 16, ease: 'au.linear' }, ph.end + 0.2);
  AU.camera({ at: D - 1.8, x: 960, y: 540, scale: 0.9, duration: 0.8, ease: 'au.glide' });
});
</script>
```

## QA checklist

- [ ] No drawn element appears by opacity alone (except handwriting char reveal and pops for reactions).
- [ ] Drawing starts 0.2-0.8 s after its phrase and finishes within 1 s of the phrase end.
- [ ] Held lines boil on a stepped clock; seeds deterministic (same frame, same pixels across renders).
- [ ] Writing speed 13-16 cps body, ~7.5 cps titles.
- [ ] One grammar (board camera or sheet cuts); camera smooth, drawings stepped.
- [ ] Board text under half of narration words; one accent colour.
- [ ] Final frames equal the finished drawing.

## Sources

- alexgreensh/anidoodle skills/anidoodle: SKILL.md, references/craft-bar.md, references/workflows/drawing-process.md, engine/src/canvas-core/core.ts (pen wobble 1.1, boil 0.55, boil index floor(frame/4)) - github.com/alexgreensh/anidoodle
- cth9191/animate styles/crosshatch/STYLE.md, styles/sketchbook/STYLE.md, craft.md (boil on 2s at 24 fps)
- huashu-art-motion references/动画语法/y3_whiteboard.md (RSA and Minute Physics measurements: 16 / 7.5 cps, +0.5 s lag, pan 1.2-2.4 s)
- cloveric/claude-drawing-skill docs/PRINCIPLES.md (boil only ink, keep pencil and colour still; medium order)
- rough.js: roughjs.com (roughness, bowing, hachureGap, fillStyle, seed)
- VideoScribe and Doodly docs (0.5 s post-draw hold, 1 s camera move, 3 s default draw)
