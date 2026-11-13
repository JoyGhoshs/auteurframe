---
name: explainer-grammar
description: Use when choosing the structure and visual grammar of an explainer (Vox, Kurzgesagt, 3Blue1Brown, whiteboard, keynote, storytime) before writing beats or scenes.
stage: direct
tags: [explainer, structure, vox, kurzgesagt, 3b1b, whiteboard, keynote, storytime, formats]
version: 1
---

# Explainer Grammar

An explainer is a grammar (how the next picture comes out of the last one) plus a format (what drives the plot) plus a medium (the style pack) plus a true subject. Pick the grammar first: it fixes shot length, transition type, camera behaviour and how text appears. Mixing two grammars inside one film reads as two authors. This skill gives six measured grammars as cards, the eight short-form formats, the invariants every format shares, and a mapping to AuteurFrame style packs and archetypes.

## When to use / not use

- Use at the start of any explainer, documentary short, tutorial or educational piece, before the storyboard.
- Use when a draft "feels like slides": usually the grammar was never chosen.
- Do not use for a 6-15 s brand sting or hype reel (use kinetic-typography and motion-rules-core).
- Do not use for pure data stories with one chart (use data-visualization-motion), though t3 below still applies.

## Core rules

1. Choose ONE grammar per film; a second grammar may appear only as a declared chapter card or quote insert.
2. Write the one-sentence device before any scene ("the spark gains a ray each era"). If you cannot, stop.
3. Every narration sentence gets at least one state change on screen (pop, morph, push, draw, cut). Two consecutive sentences with no change = add an event, never a slow drift.
4. Speaking rate default 150 wpm (2.5 words/s) for documentary pace; 160-180 wpm max for fast formats.
5. Word budget per beat 25-35 words (10-14 s of speech); one idea per beat; split when a second concept appears.
6. Colour means one thing for the whole film (the hero, a variable, "AI acting"). Never spend it on decoration.
7. Silence before the payoff, loudest on the payoff: a 0.5-4 s drop (15-35 dB) on a held image, then the single loudest hit.
8. The end is the start, changed: return to the opening image or framing with the difference the story made.
9. One constant the eye can hold in every frame: a hero, a stage, a page, axes.
10. Same page layout never more than 3 times in a row (title+line+label four times = a deck).

## The six grammar cards

### Vox (editorial collage, argument on a desk)
- Arc: cold open (1 beat, a concrete surprising fact, never "today we...") -> turn to context (1 beat, "to understand X, go back to...") -> escalating explanation (50-70% of beats, one throughline) -> complication (1-2 beats) -> resolution that reframes the cold open (1-2 beats, quotable last line).
- Beat budget: 45-60 s = 6-8 beats, ~200 words; 90 s = 10-12 beats, ~330 words; 3 min = 16-22 beats, ~650 words.
- Present tense for history, concrete numbers over abstractions, vary rhythm (long sentence then a three-word one).
- Shots: slow tier median 3.3 s (about 12 cuts/min), fast tier 1.4-1.8 s (25-33 cuts/min). Hard cuts on narration punctuation. See collage-and-vox.

### Kurzgesagt (flat science, metaphor object in a scalable world)
- Write the visual metaphor object for every beat first (cell, gear, pipe, city, droplet). No object = no beat.
- Hard cuts are rare (about 5/min), median shot 7-9 s, but the visual unit changes every 4.6-6.7 s through designed 0.3-0.6 s transitions.
- Camera: about 1/3 of time zooming, 10% panning, 5% rotating; zoom through scales with log interpolation; hold the target 0.3 s and light it before diving in.
- Pop-ins: reach 90% in 0.25 s; source overshoot 108% is above our cap, so use au.pop at <= 1.08.
- Stagger: same-kind elements 10-20 frames apart, limbs 3-4 frames, pause 20 frames between actions. Action default 50 frames at 60 fps (0.83 s), crisp 10-30 frames.
- Labels: thin leader line draws, then text types at about 40 cps, holds about 3 s.
- Ambient layer always alive (stars twinkle 1-3.5 rad/s, particles drift); subject and labels still once landed.

### 3Blue1Brown (math stage, nothing cuts)
- For every shot write "who becomes whom" (grid -> circle, pixels -> neurons). If no transform object exists, choose another grammar.
- Black stage, one object being explained, smooth ease 6t^5 - 15t^4 + 10t^3, run_time 1-3 s then wait about 1 s (stillness during waits is correct here).
- LaggedStart lag 0.05-0.1; at most 2 text points on screen; at most 4 semantic colours.
- Camera moves only as events (hold, push to next object, hold). See math-explainer.

### Whiteboard (RSA Animate vs Minute Physics, pick one)
- RSA: one giant board, camera travels it about 5.3 moves/min, median 6.6 s between moves, pans 1.2-2.4 s easeInOutSine, each pan about 0.23 W with 75% overlap; final pull-out reveals the whole argument.
- Minute Physics: one sheet per shot, hard cuts about 8.1/min, camera locked, median shot 7.1 s.
- Writing 16 cps (titles 7.5 cps); start writing 0.2-0.8 s after the phrase begins (median +0.5 s), finish within 1 s of the phrase end; never ahead of speech. Icons 0.5-1 s, a head about 2 s.
- RSA has no music under speech; Minute Physics bed about 9 dB under voice. See hand-drawn-doodle.

### Keynote (product truth, one thing per screen)
- One noun, number or card per screen; screenshots >= 80% of frame width (>= 90% in 9:16), push in to the part being discussed.
- Nouns begin to appear 0.2-0.3 s before spoken; numbers land exactly when spoken (count start = spoken time - count duration).
- Springs: bounce 0 default, 0.15 crisp, never above 0.3 for UI. Screens hold 5-8 s on stage, 1.5-3 s in product cuts.
- Ban the five-piece template (glow blobs + glass card + gradient text + centred blur-in + floating cards); use at most two of them per film.

### Storytime (character, voice is the show)
- One sentence about one shot; ASL 1.9-2.4 s (TheOdd1sOut), longer 3-6 s for slower creators.
- Poses switch in 0.1 s then hold 0.4-0.7 s; 70% of frames can be static when the voice carries.
- Reaction shots sit in silence between lines: leave 0.8-1.5 s for the face; hold after a punchline >= 0.9 s.
- Cuts land in the breath between sentences, never mid-phrase; smash cut = 1.22x scale settling, whip 0.26 s.

## Formats (what drives the plot) and the four-choice formula

A piece = plot engine x stage x clock x medium.
- Engines: chronology, token through stations, call -> catalogue, goal + helper, fixed subject N variations, claims -> proof.
- Stages: beat-cut, one sheet with follow camera, morph chain, locked-off build.
- Clocks: music grid (120 BPM, 8ths = 0.25 s), voice (change lands 0.2-0.4 s after sentence end), even stations (7-8 s).
- Couplings: spatial plots get a follow camera; chronologies transition from the scene (morphs, draw-offs); characters and lists cut on the beat; a voice takes over the clock (music -20 to -25 dB).

| Format | Engine | Signature numbers |
|---|---|---|
| F1 Machine | token through stations | stations 7-9 s, ~1.0 s pans, zoom-out reveal in last 4-7 s |
| F2 Chronology morph chain | dated eras | scenes 1.5-4 s, morph bridge 1.2 s, <= 3 morphs under 30 s |
| F3 Call -> catalogue | question answered by list | cards 0.5 s x 8, one 1.0 s, 0.25 s x 4, gather ~2 s |
| F4 Mission | goal + helper | vignettes 3-4 s, rush 4 x 0.5 s, payoff held ~2 s |
| F5 Fixed-hero journey | hero holds screen spot | cuts accelerate 0.5 -> 0.25 -> 0.125 s |
| F6 Process loop | result -> blank -> making -> result | early stages ~1.3 s, last frame = frame 0 |
| F7 Variation reel | same armature N ways | exactly 1.00 s each, silhouette overlap >= 95% |
| F8 Trailer | claim card -> proof | crops ~1.3 s, cards 1.2-2.5 s |

## Do / Don't

| Do | Don't |
|---|---|
| Pick one grammar, name it in the storyboard header | Blend 3b1b black stage with Vox paper in one film |
| Write the metaphor object or "who becomes whom" per beat | Put a glowing orb plus label pills for every concept |
| Land changes on spoken words or beat grid | Animate on arbitrary timestamps |
| Let chapter colour or ground change carry structure | Add "01 / 05" counters or corner labels |
| Close by returning to the opening image changed | End on a held logo card longer than 1.4 s |
| Keep 3b1b waits still, keep Kurzgesagt ambient alive | Fill every hold with a slow uniform push-in |

## Recipe: grammar decision table

```
if subject is a transformation of a mathematical object      -> 3b1b
elif subject has real documents/photos/quotes as evidence     -> vox
elif subject is a mechanism at several scales (cells, cities) -> kurzgesagt
elif subject is an argument built step by step by a narrator  -> whiteboard (RSA if one map of ideas, MP if discrete steps)
elif subject is a product, feature, launch, number            -> keynote
elif subject is a first-person story with a punchline         -> storytime
```

## Recipe: beat budget calculator

```
words_total = duration_s * wpm / 60          # wpm 150 default
beats       = round(words_total / 30)        # 25-35 words per beat
escalation  = round(beats * 0.6)             # 50-70% of beats
hook = 1; context = 1; complication = 1 or 2; reframe = 1 or 2
```

## In AuteurFrame

| Grammar | Style pack(s) | Archetypes that fit |
|---|---|---|
| Vox | Vox Collage, Editorial Paper, Risograph | image-focus, quote, map-pins, timeline, scale-zoom |
| Kurzgesagt | Kurzgesagt Flat, Soft Clay | scale-zoom, icon-grid, process-flow, big-number |
| 3b1b | Math Stage, Blueprint | equation, line-chart, process-flow |
| Whiteboard | Whiteboard Doodle | doodle-explain, process-flow, list-reveal |
| Keynote | Keynote Light, Gradient Product, Swiss Kinetic | ui-mockup, big-number, versus, end-card |
| Storytime | Soft Clay, Retro Pixel, Whiteboard Doodle | doodle-explain, quote, lower-third |

Write the grammar to the blackboard as `bible.grammar` before OutlineBarrier; animators read it. Example: a Kurzgesagt beat where the label line draws then text types, while the ground stays alive.

```html
<div class="scene"><div class="world" data-layer="world">
  <svg class="cell" data-layer="cell" viewBox="0 0 400 400"><circle cx="200" cy="200" r="160"/></svg>
  <svg class="lead" data-layer="lead"><path d="M560 540 L760 420"/></svg>
  <p class="label" data-layer="label">Mitochondria make ATP</p>
</div></div>
<style>.cell circle{fill:var(--accent);} .label{font:600 var(--fs-md)/1.1 var(--font-body);color:var(--ink);position:absolute;left:62%;top:34%;}</style>
<script>
AU.scene(({ tl, D, $ }) => {
  AU.ambient($('.world'), 'stars');
  tl.from($('.cell'), { scale: 1.4, opacity: 0, duration: 0.5, ease: 'au.softLand' }, 0.15);
  AU.draw('.lead path', { at: 0.7, duration: 0.4 });
  AU.typewrite($('.label'), { at: 1.1, cps: 40 });
  AU.camera({ at: 2.4, scale: 1.12, x: -60, duration: 0.9, ease: 'au.glide' });
  tl.to($('.world'), { scale: 1.6, opacity: 0, duration: 0.45, ease: 'au.exit' }, D - 0.45);
});
</script>
```

## QA checklist

- Storyboard header names exactly one grammar and one format; device sentence present.
- Every narration sentence maps to >= 1 state change; no 2 consecutive sentences without one.
- Same layout type never > 3 in a row; hard-cut rate matches grammar (Kurzgesagt ~5/min, MP ~8/min, Vox 12-33/min).
- Accent colour used for one meaning only across all scenes.
- Silence-before-payoff exists if the film has a turn; ending callbacks the opening image.
- 3b1b films: <= 2 text points visible, <= 4 semantic colours.

## Sources

- alchaincyf/huashu-art-motion references/动画语法 y1_kurzgesagt, y2_vox, y3_whiteboard, y4_storytime, t1_3b1b, t2_keynote_ui, y5_kinetic_type
- cth9191/animate grammar/STORY.md, FORMATS.md, FRAME.md, craft.md
- CK42BB/vox-explainer-skill references/vox-style-guide.md
- https://www.3blue1brown.com/faq ; https://github.com/3b1b/manim
