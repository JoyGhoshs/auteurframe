---
name: collage-and-vox
description: Vox-style editorial collage explainers (paper cutouts, archival material, red pen, highlighter, investigative camera on a desk); use for history, politics, journalism and evidence-driven explainers.
stage: design
tags: [style, collage, vox, editorial, explainer, camera]
version: 1
---

# Collage and Vox

The argument is laid out on a desk of real material: clippings, photos, documents, maps. The camera
moves like an investigator's eye; red pen, highlighter and typed labels are drawn on in steps.
Credibility comes from the feeling that these things were physically placed there. It must look like
a magazine spread, never like a movie still or a 3D render.

## When to use / not use
- Use: history, investigations, policy, "how did X happen", evidence chains, maps and timelines.
- Not for: product launches, pure math (math-explainer), emotional character stories.

## Core rules
1. Real material is the main picture: screenshots, document crops, archival photos at or near full
   width. A shot where material is < 60% of frame width, twice in a row, is a picture-frame layout.
2. Look kit (constant across the film): aged cream paper ground, cutouts with a 3-6 px white sticker
   border and a soft drop shadow, halftone dot accents, washi tape at corners, ONE accent colour
   (often red) carried through every frame, 1-2 flat geometric accents per frame max, bold condensed
   sans for titles, serif small caps for names and places.
3. Two frame rates: the camera moves smoothly (every frame); drawn elements (map fills, red lines,
   typing, hand circles, pops) step at 12 fps ("on twos" at 24 fps). Measured: 52% of moving frames
   in a reference show the move-hold-move fingerprint.
4. Camera (measured over 13 moves, none linear): duration median 1.29 s (0.71-1.96 s).
   - find the next card: easeInOutSine, 0.5-0.9 s;
   - push to a line to read: 1.0-1.5 s ease in-out; reveal push only once or twice: 0.28 s;
   - pull out to reveal the whole collage: ~1.0 s fast start, long tail `cubic-bezier(.33,0,.2,1)`;
   - follow a red line: 1.3-1.8 s long tail.
   When an element inside a card animates (line, highlight, typing), the camera holds still.
5. Entries: archival items mostly appear ON the cut (no pop, no drop). When tracking a timeline the
   next card slides in from off-frame tilted 5-15 deg and lands flat in ~0.8 s.
6. Pen work: red underline 0.5-1 s; red ellipse ~1 s in one stroke, ends not closed, slightly crossing;
   highlighter 1.5-3 s per line following the narration word by word; typed labels ~13 chars/s
   stepped; map region growth / route drawing 2.5-3.5 s with a solid red dot at the line head.
7. Pace tiers: slow (median shot 3.3 s, ~12 cuts/min, a card holds 3-7 s carried by pen work) or fast
   (1.4-1.8 s, 25-33 cuts/min, pictures nearly still). Pick one per section.
8. Rotate the reveal vocabulary: appear-on-cut, push, pan to next card, highlighter, red line connect,
   stamp, tear-off. The same reveal sequence (slide-in -> typed label -> red circle) at most 3 times.
9. Readable text is always on the top layer and drawn last; later cards must never cover it.
10. Compute camera targets from the bbox of what must be read plus a margin, never hand-typed
    coordinates; push half-visible neighbour labels fully out of frame.
11. Each time a new card lands, read all on-screen text in reading order: adjacent fragments must not
    form a false sentence.
12. An event's formal action happens once: do not re-perform in close-up what the wide shot showed.
13. Never fabricate archival documents, signatures, newspaper mastheads or quotes. Illustrative
    reconstructions are labelled as such in the notes.

## Do / Don't
| Do | Don't |
|---|---|
| slow 2D push (3-5% over a shot) and layer parallax | 3D dolly, orbit, camera shake |
| one living element in a held collage (smoke, water, a flag) | faces animating, text warping |
| hard cut on narration punctuation | torn-paper transitions (absent from every studied Vox sample) |
| present-tense, concrete narration ("two million people") | "in this video we will" |
| one accent colour for the whole film | a new accent per scene |

## Recipe: sticker cutout CSS
```css
.cut { filter: drop-shadow(0 0 0 #fff) drop-shadow(0 6px 10px rgba(0,0,0,.25)); }
.cut img { outline: 5px solid #fff; outline-offset: -1px; }
.halftone { background: radial-gradient(circle, var(--ink) 30%, transparent 32%) 0 0 / 9px 9px; opacity: .18; mix-blend-mode: multiply; }
.tape { width: 120px; height: 34px; background: color-mix(in srgb, var(--accent-2) 55%, transparent); transform: rotate(-8deg); }
```
Note: for an outline that follows a PNG's alpha use stacked `drop-shadow(0 0 2px #fff)` x3 (costly;
pre-bake when possible).

## In AuteurFrame
- Style pack: Vox Collage. Archetypes: image-focus, timeline, map-pins, quote, scale-zoom.
- Step drawn layers at 12 fps by quantising their own time inside `AU.onFrame`, while `AU.camera`
  stays smooth:
```js
AU.scene(({ tl, D, $, camera, onFrame }) => {
  const line = $('.red-line path'), len = line.getTotalLength();
  line.style.strokeDasharray = len;
  onFrame((t) => {
    const ts = Math.floor(t * 12) / 12;
    const p = Math.min(1, Math.max(0, (ts - 1.2) / 1.6));
    line.style.strokeDashoffset = len * (1 - p);
  });
  camera({ at: 0.0, duration: 1.3, x: 0, y: 0, scale: 1.18, ease: 'au.glide' });
  camera({ at: 3.0, duration: 1.6, x: 420, y: 60, scale: 1.18, ease: 'au.drift' });
  tl.fromTo($('.card-2'), { x: 900, rotation: 11 }, { x: 0, rotation: 0, duration: 0.8, ease: 'au.softLand' }, 3.2);
});
```
- Give drawn layers `data-layer` names like `pen-underline`, `pen-circle`, `hl-line-2` so QA can
  check the reveal rotation (rule 8).
- Assets: `AU.asset('clip-1985-times')`; the research agent must store each archival asset with its
  source and licence in the fact store.

## QA checklist
- [ ] Material >= 60% frame width in most shots; no two consecutive picture-frame layouts.
- [ ] One accent colour across all scenes; sticker border, halftone and tape constant.
- [ ] Drawn layers step at 12 fps; camera smooth; camera still while pen work runs.
- [ ] No reveal sequence repeated more than 3 times.
- [ ] No text occluded by a later card; no accidental sentences across fragments.
- [ ] Every archival asset has a source; nothing fabricated.

## Sources
- CK42BB/vox-explainer-skill references/vox-style-guide.md (arc, sticker borders 3-6 px, halftone, tape, single accent, motion do/don't).
- alchaincyf/huashu-art-motion references/动画语法/y2_vox.md (two frame rates, 13 measured camera moves, pen timings, pace tiers, no torn-paper).
- bangtutorial/bang-motion references/explainer.md (collage camera recipe close-up -> glide -> zoom out; 3-5 elements per scene).
- Johnny Harris quote via huashu y2: each word corresponds to a movement.
