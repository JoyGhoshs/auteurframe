---
name: art-direction-bible
description: How to write and lock a film's visual bible (palette with meanings, type pair, motif, ground, texture, motion signature, uniqueness fingerprint) before any scene is animated.
stage: design
tags: [art-direction, palette, typography, style, uniqueness, bible]
version: 1
---

# Art Direction Bible

The bible is the single source of visual truth that every scene agent reads. It is written once,
locked at the outline barrier, and changed only through a logged decision. Its job: make 20 scenes
built by 8 parallel agents look like one author made them, and make this film different from the
last one.

## When to use / not use
- Use: after the brief and research, before storyboarding visuals; when a style drifts; when importing
  a brand.
- Not for: per-scene layout decisions (layout-and-safe-areas) or motion timings (motion-rules-core).

## Core rules
1. Palette: <= 5 colours + 1 accent (R7): bg, bg-2, ink, ink-2, muted, line, accent, optional accent-2.
   Every colour has a written meaning. The accent means ONE thing for the whole film (the hero, "the
   AI acting", "done") and is never spent on decoration. A second signal colour only for a second
   meaning (e.g. green = done).
2. Contrast: body text >= 4.5:1 on its ground, large type >= 3:1 (probe flags < 3). Check ink on bg
   AND ink on bg-2.
3. Type pair: one display + one body (+ mono if code/data). Sentence case, weight 400-600; heavy caps
   only for one emphasis scene. Use the brand's face if there is one. Emphasis by size, colour on one
   word or a second face; not by bold.
4. Type scale at the short side S: xl 9-11%, lg 6-7%, md 4.5-5%, sm 3.6%, min 3.2% (R2). Hero numbers
   may go to 22-29% of H once per film.
5. Motif: one shape from the subject or brand (a dot, a corner radius, a stroke, a pin) that recurs and
   carries across seams. Write it in one sentence ("the full stop becomes the switch").
6. Ground and texture: name the ground layers, grain level (0-0.05), vignette, light direction (one
   named light, e.g. upper left) and the ambient-motion choice (cinematic-ground-and-texture).
7. Motion signature: frame clock (smooth 30/60 or on-twos), blur grammar (shutter, smear or crisp),
   overshoot policy (none, or one visible spring per film), the 2-3 eases that dominate, the 3-5
   transition kinds the film may use, the one signature move spent once.
8. Medium: a style is a way of making marks, not a palette swap. State the mark (cut paper edge, ink
   line with boil, halftone, flat vector) and its order of making.
9. Constants: one thing the eye can hold across the film (a hero, a stage, a page). Record it.
10. Banned list: name the defaults this film must not use (from anti-slop-checklist), plus anything the
    user dislikes.
11. Uniqueness fingerprint (R12): {pack, palette hue family, type pair, motif, ground, transition set,
    archetype sequence hash}. Must differ from the previous film on >= 2 axes; vary via the seed:
    accent hue rotation within the pack's range, alternate type pair, archetype rotation.
12. Lock: after the outline barrier the bible is read-only (R8). A change needs a decision log entry
    with reason, and all affected scenes are re-queued.

## Do / Don't
| Do | Don't |
|---|---|
| derive palette from the subject (logo, product UI, era, place) | default purple-blue-cyan glow |
| write meaning per colour | pick colours "because they look nice" |
| alternate dark and light grounds only when mood changes | a different flat swatch per scene |
| take rhythm and energy from a reference | copy a reference's palette, fonts and layouts |
| show 2-4 full-size style frames before building | approve a style from a paragraph |

## Recipe: bible JSON (writes to blackboard key `bible`)
```json
{
  "version": 3, "locked": true, "pack": "Editorial Paper", "seed": 48213,
  "palette": {
    "bg": {"hex": "#F3EEE4", "means": "the page"}, "bg-2": {"hex": "#E7DFD0", "means": "recessed panels"},
    "ink": {"hex": "#1C1A17", "means": "settled facts"}, "ink-2": {"hex": "#4A453D", "means": "secondary text"},
    "muted": {"hex": "#9A9184", "means": "guides, ticks"}, "line": {"hex": "#CFC5B4", "means": "rules"},
    "accent": {"hex": "#D2452B", "means": "the money trail, only"}
  },
  "type": {"display": "Fraunces 600", "body": "Inter 450", "mono": "JetBrains Mono 500", "case": "sentence"},
  "scale": {"xl": 0.10, "lg": 0.065, "md": 0.048, "sm": 0.036, "min": 0.032},
  "motif": "a red thread that ties each document to the next",
  "constant": "the desk seen from above",
  "ground": {"layers": ["paper tooth", "top-left lamp glow"], "grain": 0.03, "vignette": 0.12, "ambient": "slow paper drift"},
  "motion": {"clock": "camera 30fps, drawn layers 12fps", "blur": "crisp", "overshoot": "none",
             "eases": ["au.softLand", "au.glide", "au.exit"], "transitions": ["cut", "pan-along-thread", "push-into-photo", "pull-reveal"],
             "signature": "pull back to reveal the whole wall at 85%"},
  "banned": ["page chrome", "glow on titles", "torn paper wipe", "typed headlines"],
  "fingerprint": {"hue": "red-orange", "pair": "serif+grotesk", "motif": "thread", "ground": "paper", "transitions": "cut/pan/push", "archetypes": "h:3f2a"}
}
```

## In AuteurFrame
- `styles.py` packs supply defaults; the Art Director agent writes the bible from pack + brief + seed,
  then `compose.py` turns it into the CSS tokens every fragment receives (`--bg ... --safe-y`) and
  `ctx.theme`. Scene code reads tokens only.
- Scene agents may read meanings at build time to choose colours semantically:
```js
AU.scene(({ tl, theme, $ }) => {
  const isMoney = (theme.meanings || {}).accent === 'the money trail, only';
  tl.fromTo($('.thread'), { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: 'au.glide', transformOrigin: '0 50%' }, 0.2);
  if (isMoney) tl.to($('.amount'), { color: 'var(--accent)', duration: 0.2 }, 1.0);
});
```
- QA checks R7 by scanning computed colours of all `data-layer` nodes against the bible (+- dE 3).

## QA checklist
- [ ] <= 5 colours + accent, each with a meaning; accent used only for its meaning.
- [ ] Contrast pairs pass (4.5:1 body, 3:1 large).
- [ ] Type pair and scale match tokens; no third family.
- [ ] Motif and constant appear in >= 60% of scenes.
- [ ] Fingerprint differs from the previous film on >= 2 axes.
- [ ] Bible locked before animators start; changes logged.

## Sources
- cth9191/animate craft.md and grammar/FRAME.md (colour means one thing, one constant, the medium shows).
- Tejashmakwana/motionmaxxing SKILL.md law 9 (one system per film), references/brand.md, world.md.
- bangtutorial/bang-motion SKILL.md Hukum #3 (style born from the theme, not the starter or the reference), anti-ppt.md.
- alexgreensh/anidoodle references/styles.md (a style is a way of making marks), craft-bar.md.
- alchaincyf/huashu-art-motion y5 palette per chapter, t2 (colours follow the product).
- WCAG 2.2 contrast minimums: w3.org/TR/WCAG22/#contrast-minimum.
