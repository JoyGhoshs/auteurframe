---
name: layout-and-safe-areas
description: Use when placing anything on a 16:9, 9:16, 1:1 or 4:5 stage - safe areas, type sizes, named grid anchors, density, hero rules and re-layout between aspect ratios.
stage: design
tags: [layout, safe-area, grid, typography-size, aspect-ratio, vertical, hierarchy, composition]
version: 1
---

# Layout and Safe Areas

Most layout bugs in generated video are measurable: text under the platform UI, a label off the
canvas, two equal panels fighting each other, a headline block held on the left like a slide.
This skill gives fixed numbers for each format, a named anchor grid so that agents place things
by cell instead of guessing pixels (Code2Video gained +27 points from anchors), and rules for
re-laying out, not cropping, when a film ships in several shapes.

## When to use / not use

- Use it before writing any scene markup, when converting a scene to another aspect, and when
  reading a probe report about overflow, overlap or off-canvas elements.
- Do not use it to justify cramming. When content does not fit, split the scene. Never shrink
  type below the floor.

## Core rules

1. **Safe areas (AuteurFrame R10).**
   - 16:9: 6% inset on all sides.
   - 9:16: 10% top, 18% bottom and 6% sides. Platform UI (handles, captions, buttons) covers the
     rest.
   - Industry cross-check: action-safe is 90% of the frame and title-safe is 80% (HyperFrames).
     Captions and key text must sit inside title-safe.
2. **Phone-safe content box for 9:16 at 1080x1920:** x 60-940, y 250-1500 (cth9191). Anything that
   matters is at least about 100 px. Captions are at least 50 px.
3. **Type floor (R2).**
   - Readable type is at least 3.2% of the short side: about 35 px at 1080 short side.
   - Text the viewer must read is at least 4% of H (motionmaxxing G1).
   - Text under 2% of H is texture and nobody is asked to read it.
   - At most 2 type levels per shot.
4. **Size by role (fractions of H, 16:9).**

   | Role | Size |
   |---|---|
   | Headline | 7-11% (9% typical) |
   | Supporting line | 5-7% |
   | Statement next to a figure | 6.5-8%, with the figure at 22-29% (about 3.5x) |
   | Hero number | 22-29%, spent once |
   | Wordmark | 0.22-0.38 W |

   Make hierarchy with size. Weight rises only about 20%.
5. **Placement.**
   - A centred one-line statement has its baseline at y 0.52-0.54. Its ink spans 0.30-0.56 W for
     3-5 words.
   - A final title sits slightly off-centre, at x 0.46-0.47 and y 0.50-0.53.
   - An exact-centre title reads as a template.
6. **One hero per frame (R1).** Show 1 hero plus at most 2 supporting elements. Hook peaks may
   show up to 4 groups for under 0.5 s. A fourth element must replace one.
7. **Two-panel rule (G4).** Two panels may share a frame only if one has at least 2x the area of
   the other, or the camera moves between them. The single exception is a true comparison: equal
   height, a shared baseline.
8. **Density.** Ink plus objects cover 5-44% of the frame. Statement frames leave 85-95% free.
   "Free" is a lit or textured ground, not a flat swatch.
9. **Deck layouts are banned.** These fail:
   - a held left-aligned headline block with ink-left at x < 0.2 beside right-side media;
   - a kicker above a headline;
   - a header, body and footer stack;
   - three text levels.

   A left-anchored phrase is allowed at x 0.10-0.14 if it is one line, has no sub-line, and moves
   or cuts within 1.2 s.
10. **Overflow.** Nothing overflows the stage and nothing sits off-canvas (R11), unless it is
    flagged `data-allow-offstage` with a reason. Deliberate cropping counts as a feature (a
    0.90 W card with its lower half cropped implies a larger system). Absolutely positioned text
    gets `white-space: nowrap`, or a measured max width.
11. **Re-layout, never crop.** Each aspect gets its own arrangement from the same content:
    - 16:9 places things side by side;
    - 9:16 stacks them, with the hero in the upper-middle band and the caption band low;
    - 1:1 and 4:5 centre-weight them and drop to one supporting element.
12. **Named anchor grid.** Place by cell names, not raw pixels:
    - 16:9: 12 columns x 6 rows, columns 1-12 and rows A-F, inside the safe area.
    - 9:16: 6 columns x 12 rows, rows A-L.
    - A small object takes one cell (B4). A large object takes a region (A1:C6).
    - The probe reports an occupancy table from cell to element to source line.

## Format table

| Format | Stage px | Safe inset (x, top, bottom) | Caption band (y) | Readable floor | Grid |
|---|---|---|---|---|---|
| 16:9 | 1920x1080 | 115, 65, 65 | 880-1000 | 43 px (4% H) | 12 x 6 |
| 9:16 | 1080x1920 | 65, 192, 346 | 1300-1500 | 50 px | 6 x 12 |
| 1:1 | 1080x1080 | 65, 65, 86 | 860-960 | 43 px | 8 x 8 |
| 4:5 | 1080x1350 | 65, 81, 108 | 1080-1200 | 48 px | 8 x 10 |

The 16:9 caption band sits 80-120 px above the bottom edge. The 9:16 band sits about 420-620 px
above the bottom edge, clear of platform buttons and the description. Never place captions over
a face.

## Do / Don't

| Do | Don't |
|---|---|
| Place by cell names (B4, A1:C6) | guess `left: 1234px` per element |
| One readable object per frame | 3 equal cards side by side |
| Size contrast for hierarchy (3:1 or more) | bold everything at the same size |
| Baseline y 0.52-0.54 for a centred line | dead-centre title on a gradient |
| Re-stack for 9:16 | crop the 16:9 master to 9:16 |
| Flag intended overflow with `data-allow-offstage` | silent overflow the probe flags |
| Keep captions inside title-safe | captions at y 1800 under the platform UI |
| Leave 85-95% free around a statement | fill emptiness with decoration |

## Recipe 1: anchor grid to pixels

```js
function grid(W, H, safe, cols, rows){
  const cw = safe.w / cols, rh = safe.h / rows, R = 'ABCDEFGHIJKL';
  const cell = (name) => {
    const r = R.indexOf(name[0]), c = parseInt(name.slice(1), 10) - 1;
    return {x: safe.x + c*cw, y: safe.y + r*rh, w: cw, h: rh};
  };
  const region = (a, b) => {
    const p = cell(a), q = cell(b);
    return {x: p.x, y: p.y, w: q.x + q.w - p.x, h: q.y + q.h - p.y};
  };
  return {cell, region, cw, rh};
}
```

## Recipe 2: occupancy table (probe output)

```json
{"occupancy":[
  {"layer":"title","cells":"B3:B10","box":[345,245,1230,150],"src":"scene.html:4"},
  {"layer":"chart","cells":"C2:F11","box":[240,425,1440,540],"src":"scene.html:7"}],
 "collisions":[], "offCanvas":[], "belowFloor":[]}
```

The critic quotes cells and source lines in its repair notes.

## In AuteurFrame

- `ctx.safe` is `{x, y, w, h}` in stage pixels for the current format. CSS has `--safe-x` and
  `--safe-y`. Size type with `--fs-xl/--fs-lg/--fs-md/--fs-sm`, which the platform derives per
  format. Never go below `--fs-min`.
- Build layout from `ctx.safe` and a grid helper. Scenes must work at every stage size, so use
  `W` and `H`, never hard-coded 1920.
- Use `data-allow-offstage` only on elements that enter or exit through the edge, or a deliberate
  crop.

```html
<div class="scene">
  <h1 class="claim" data-layer="claim">Rivers move 40% less sediment</h1>
  <div class="fig" data-layer="figure"></div>
</div>
<style>
.claim{position:absolute;font:600 var(--fs-lg)/1.05 var(--font-display);color:var(--ink);white-space:nowrap}
.fig{position:absolute}
</style>
<script>
AU.scene(({ tl, W, H, safe, $ }) => {
  const portrait = H > W;
  const cols = portrait ? 6 : 12, rows = portrait ? 12 : 6;
  const cw = safe.w / cols, rh = safe.h / rows;
  const place = (el, c0, r0, c1, r1) => Object.assign(el.style, {
    left: safe.x + c0*cw + 'px', top: safe.y + r0*rh + 'px',
    width: (c1 - c0 + 1)*cw + 'px', height: (r1 - r0 + 1)*rh + 'px' });
  if (portrait) { place($('.claim'), 0, 1, 5, 2); place($('.fig'), 0, 3, 5, 8); }
  else { place($('.claim'), 1, 0, 10, 0); place($('.fig'), 2, 1, 9, 5); }
  tl.fromTo($('.claim'), {y: 40}, {y: 0, duration: 0.4, ease: 'au.softLand'}, 0.1);
  tl.fromTo($('.fig'), {scale: 1.15}, {scale: 1, duration: 0.45, ease: 'au.softLand'}, 0.35);
});
</script>
```

## QA checklist

- [ ] Every element box is inside `ctx.safe`, or flagged `data-allow-offstage`.
- [ ] 9:16 content of importance sits within x 60-940 and y 250-1500.
- [ ] No text is below `--fs-min`; readable text is >= 4% H; there are <= 2 type levels.
- [ ] One hero plus <= 2 supporting elements; the two-panel rule is met.
- [ ] Ink coverage is 5-44%.
- [ ] No deck layout: no kicker over a headline, no left block at x < 0.2 with right media.
- [ ] No overlap between text boxes. The occupancy table has no collisions.
- [ ] Each format has its own arrangement, verified on a contact sheet per format.

## Sources

- AuteurFrame PLAN.md section 6 (R1, R2, R10, R11)
- motionmaxxing layout.md (sizes by role, density 5-44%, G1, G4, D1): github.com/Tejashmakwana/motionmaxxing
- HyperFrames SKILL.md and captions.md (90% action-safe, 80% title-safe, caption heights):
  github.com/heygen-com/hyperframes
- cth9191 animate FRAME.md (phone-safe x 60-940, y 250-1500): github.com/cth9191/animate
- Code2Video visual anchors (6x6 grid, ablation -9.8 aesthetics / -26.8 TeachQuiz without
  anchors): arxiv.org/abs/2510.01174
- TheoremExplainAgent scene layout fields (safe margins, min spacing): arxiv.org/abs/2502.19400
