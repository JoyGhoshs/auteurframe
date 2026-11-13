---
name: storyboard-director
description: Use when turning a brief or script into acts, scenes and beats with timings, roles, layouts and transitions, for shorts or long-form, before any scene code is written.
stage: direct
tags: [storyboard, structure, beats, scenes, acts, hook, shorts, long-form, planning]
version: 1
---

# Storyboard Director

The storyboard is the contract between the writer, the art director and every animator. Research on agentic video (Code2Video, TheoremExplainAgent, MovieAgent, VideoDirectorGPT) is consistent: removing the planner is the single largest quality loss (Code2Video: -40.9 aesthetics, -41.5 TeachQuiz), and planning quality is high while execution is the bottleneck. So the plan must be specific enough to verify: every beat names what it buys, its hero, its layout cells, its entry and exit, and checkable motion predicates.

## When to use / not use

- Use after the brief/research and before the art bible is locked and animators start.
- Use to re-plan a film that reads as a slideshow or overruns its length.
- Do not use for a single scene repair (use qa-critic) or a one-shot sting under 6 s (one beat; skip acts).

## Core rules

1. Hierarchy: scenario -> acts (2-5) -> scenes (one place, one layout system) -> beats (one belief each). Long films add chapters.
2. Every beat buys one belief: write "Buys: the viewer ___." If you cannot finish it, cut the beat.
3. Roles per beat: hook, context, build, turn, proof, payoff, cta, breath. At most 25% of beats are "the point" (importance budget).
4. Hook within the first 2.0 s: frame 0 is never empty, the first motion starts 0.1-0.3 s in, the hero is identifiable by 1.0 s.
5. Scene lengths: shorts 1.5-3 s per shot; explainers 4-8 s per scene with a visual change every 2-4 s; keynote 5-8 s; montage 0.13-0.8 s; narrated: scene = its cue group span.
6. Subtitles are the master clock: scene boundaries snap to cue group edges (see subtitle-sync), never mid-phrase.
7. Shots hand off: for each seam name the carried object (shape, position, colour, direction) and author A's last 6 frames with B's first 6 frames.
8. Cut on motion: at most 2 plain fades per film; at most 1/3 of seams are hard cuts between unrelated scenes.
9. End hold 0.6-1.4 s; final shot <= 25% of the film; the end returns to the opening image, changed.
10. Generate three storylines that are three different films (different engine or grammar), in words only; pick one and write one line on why.
11. Scene layout must state safe margins and minimum spacing (TheoremExplainAgent's layout field); place via named grid cells, never raw pixels (Code2Video anchor grid).
12. Same layout type never more than 2 scenes in a row; scale varies across the board including one extreme close-up.

## Shorts vs long form

| | Shorts (9:16) | Long form (16:9) |
|---|---|---|
| Length | 15-60 s | 2-20 min |
| Hook | <= 2 s, payoff promise in first line | <= 10 s cold open, then the turn to context |
| Shot | 1.5-3 s, change every <= 1 s | 4-8 s scenes, visual unit every 4.6-6.7 s |
| Structure | hook -> 3-5 escalating beats -> payoff -> loop | chapters every 2-3 min, each with mini hook and payoff |
| Captions | word-level groups, 2-5 words | phrase blocks, 2 lines max |
| Ending | last frame flows into frame 0 (loop) | reframe of the cold open, end hold 0.6-1.4 s |
| Safe area | x 60-940, y 250-1500 of 1080x1920 | 6% margins |

## Film shapes (pick one)

- claim -> cut -> proof -> cta (launch)
- cold open -> context -> escalation -> complication -> reframe (Vox)
- result -> blank -> making steps -> result (process loop)
- question -> catalogue -> gather -> reversal
- setup -> journey (fastest) -> turn (silence then slam) -> connection -> callback

## Beat table schema

```json
{
  "id": "s03b2",
  "act": 1,
  "scene": 3,
  "role": "proof",
  "buys": "the viewer sees the cost doubled in 4 years",
  "vo": "By 2024 the price had doubled.",
  "cue_ids": [7, 8],
  "start": 14.20,
  "end": 18.65,
  "archetype": "big-number",
  "hero": "#price",
  "supporting": ["#year-label"],
  "carried_in": {"object": "accent dot", "pos": "C3", "velocity": "left"},
  "carried_out": {"object": "#price", "pos": "C4"},
  "transition_in": "match-position",
  "transition_out": "object-becomes-ground",
  "layout": {"grid": "6x6", "hero_cells": "B2:D5", "caption_band": "F1:F6", "margin": "safe"},
  "motion": [
    "appearsBy(#price, 0.5)",
    "before(#price, #year-label)",
    "staysInFrame(#price)",
    "keepsMoving(.scene, window=0.5)",
    "lands(#price, ease=decelerate, overshoot<0.09)"
  ],
  "sound": {"hit": 14.35, "type": "impact"},
  "importance": "point"
}
```

Motion predicates follow MoVer: object refs plus Allen temporal relations (before, meets, overlaps, during) and rectangle relations (left, top, inside, intersect). QA evaluates them per frame and reports the predicate and frames that failed.

## Validation rules (run before OutlineBarrier)

- Sum of beat durations = film duration within 1 frame; no gaps or overlaps.
- Every beat has buys, hero, layout cells, transition_in/out, >= 2 motion predicates.
- Hook beat starts at 0 and lands hero by 1.0 s; first frame non-empty.
- importance=point on <= 25% of beats; roles include at most one cta.
- No beat shorter than its caption read time (0.5 s + 0.3 s per word for on-screen text).
- No 3 consecutive beats with the same archetype or same transition.
- Fades counted <= 2; carried object listed for every seam.
- End beat: hold 0.6-1.4 s and references the opening (callback field).

## Do / Don't

| Do | Don't |
|---|---|
| Plan per beat what the viewer will believe | Plan per slide what text appears |
| Snap scenes to cue groups | Cut mid-sentence because a scene "is 5 s" |
| Name grid cells for hero and caption band | Write "centered title, image on right" |
| Draw seams as pairs (A out, B in) | Add transitions after animating |
| Spend scale and the one visible spring once | Start every beat with a giant word |
| Write three storylines, pick one | Polish the first idea |

## Recipe: storyboard worksheet

```
FILM: <title>  GRAMMAR: <vox|kurz|3b1b|...>  FORMAT: <F1-F8>  FORMAT SIZE: 1920x1080
DEVICE (one sentence): ...
PAGE: Problem / Audience / Goal / Emotion
STORYLINES: A ... | B ... | C ...   CHOSEN: B because ...
ACT 1 (0.0-12.4)  ground, light, texture, sound
  beat | role | buys | vo | start-end | archetype | hero | in -> out | carried
HERO MOMENT (screenshot-worthy): beat s05b1 at 31.2 s
PICTURES WITH TEXT COVERED: do they still tell the story? yes/no per act
```

## In AuteurFrame

The Producer writes `outline` to the blackboard; Screenwriter and Subtitle Sync fill `vo`, `cue_ids`, `start`, `end`; Art Director adds `bible` refs; the OutlineBarrier locks both. Each animator receives one scene with `ctx.data` = its beats and `ctx.cues` = its scene-local cues. Use `ctx.safe` for cells:

```html
<div class="scene"><div class="num" data-layer="price">2x</div></div>
<style>.num{position:absolute;font:800 var(--fs-xl)/1 var(--font-display);color:var(--ink);}</style>
<script>
AU.scene(({ tl, D, data, safe, $ }) => {
  const cell = (c, r) => ({ x: safe.x + safe.w * c / 6, y: safe.y + safe.h * r / 6 });
  const p = cell(1, 1);
  const el = $('.num');
  gsap.set(el, { left: p.x, top: p.y });
  const b = data.beats[0];
  tl.from(el, { scale: 1.4, opacity: 0, duration: 0.45, ease: 'au.snapSettle' }, 0.15);
  tl.to(el, { x: 24, duration: b.end - b.start - 1.2, ease: 'au.drift' }, 0.6);
  tl.to(el, { x: -400, opacity: 0, duration: 0.35, ease: 'au.exit' }, D - 0.35);
});
</script>
```

## QA checklist

- Barrier validation passes (rules above); durations match the cue clock within 1 frame.
- Contact sheet with text covered still tells the storyline.
- No two equal panels without a 2x hero or a camera move between them.
- Each seam has a carried object; fades <= 2; end hold 0.6-1.4 s.
- Shorts: hook <= 2 s, content inside y 250-1500, loop seam checked (last frame vs frame 0).

## Sources

- Code2Video https://arxiv.org/html/2510.01174 ; TheoremExplainAgent https://arxiv.org/html/2502.19400
- MovieAgent https://arxiv.org/html/2503.07314 ; VideoDirectorGPT https://arxiv.org/html/2309.15091 ; MoVer https://arxiv.org/html/2502.13372
- Tejashmakwana/motionmaxxing SKILL.md, references/director.md, transitions.md (handoff table, G3)
- heygen-com/hyperframes skills/hyperframes references/story.md, motion.md (.motion.json assertions)
- cth9191/animate grammar/FORMATS.md

## Choosing technique and skills per scene
- Each scene gets `technique`: `code` (an animator writes a bespoke composition) or `archetype` (reuse a house layout as is).
  Use `code` for almost every scene; that is where the film becomes unique. Use `archetype` only when a house layout is
  precisely right, such as a data chart that must be exact.
- Each scene also gets 1 to 3 `skills` from the technique list. Match the skill to the visual you describe, not to the brief
  in general: a drawn eye with clouds wants `line-art-ink` and `camera-and-parallax`; a planet orbit wants `three-d-motion`;
  numbers want `data-visualization-motion`; a paper diorama wants `paper-cut-craft`; a word-led hook wants `kinetic-typography`.
- Vary the skills across scenes so the film does not repeat one look, but keep the style bible, palette and motif constant.
- Write `visual` as a shot an animator can build: hero element, layout position, the signature move timed to a sung or
  spoken word, and how the last frame hands off to the next scene.

