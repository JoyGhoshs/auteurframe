---
name: motion-rules-core
description: Use before writing or reviewing any animated scene; the measured defaults for durations, eases, entries, exits, stagger, overshoot, holds and the G0-G5 gates.
stage: animate
tags: [motion, easing, timing, gates, fundamentals, qa]
version: 1
---

# Motion Rules Core

The measured baseline every other motion skill builds on. Numbers come from frame-by-frame analysis of 53 professional motion moments and about 4,300 distinct moves (motionmaxxing), cross-checked against HyperFrames launch-film measurements and the huashu/cth9191 style cards. Use it to choose a duration, an ease, an entry, an exit and a hold without guessing. It also defines the gates a render must pass. These are measured defaults, not taste. Depart from one only when you can say why in a sentence.

## When to use / not use

- Use: any scene with motion; choosing eases; reviewing a draft that "feels like slides" or "feels floaty".
- Use: as the shared vocabulary between director, animator and critic (name eases, frames and gates, never adjectives).
- Not alone for: type cadence (see kinetic-typography), camera (camera-and-parallax), seams (transitions-and-continuity).
- Exception: 3b1b-style math explainers deliberately rest during waits (see math-explainer). Character pose-to-pose shorts hold 0.4-0.7 s between 0.1 s pose snaps.

## Core rules

Frames are at 30 fps: 3 f = 0.10 s, 6 f = 0.20 s, 10 f = 0.33 s, 15 f = 0.50 s, 30 f = 1.0 s.

1. **Median move is 10 f (0.33 s).** Defaults by property:

| Property | Entry median | Exit median | p25 / p75 | Typical travel |
|---|---|---|---|---|
| translate x/y | 12 f (0.40 s) | 13-14 f | 6 / 22-24 f | 4.8% W / 8.5% H |
| scale | 11 f | 10 f | 5 / 22 f | delta 0.25 |
| rotation | 10 f | 10 f | 5 / 21 f | 25 deg |
| opacity | 6 f (0.20 s) | 7 f | 4 / 12 f | helper only |
| blur | 7-8 f | 7 f | 4 / 10 f | 5 px (2.5-10) |

   13% of moves are 2-3 f snaps; only 12% run longer than 1 s. A film built on 0.6 s ease-outs everywhere is slower than every pro sample.
2. **Landing decelerates, leaving accelerates.** Landings: 58% ease-out, 16% ease-in. Leavings: 37% ease-in (scale exits 42%, blur exits 63%). An exit across the frame ends at peak speed (peak velocity at t ~0.9). Do not make every exit ease-in: 23-29% still ease-out or run linear (shrink-to-centre, things swept by a camera).
3. **Things arrive by moving, not fading.** 3,392 transform entries vs 584 opacity fades. Entries: 71% transform, 16% hard 1-frame cut, 12% opacity-only, 8% blur-in. Opacity is a 4-6 f helper from 0.12-0.3 to 1, never the carrier.
4. **Overshoot is rare, late and small.** 8.8% of moves overshoot by more than 3%; 88% of those peak after 35% of the duration (median t 0.65-0.70): a slow lean past the mark, not a fast spring. Hard cap in AuteurFrame: overshoot < 9% of travel or scale. One visible spring per film at most, on the payoff.
5. **Stagger 1-3 f, uneven, overlapping.** 56% of sibling gaps are 1 f; group median 3 f. Make gaps uneven (3,2,2,2,2,2), not a constant timer. Each move runs about 2x its gap (overlap ratio interval/duration ~0.5) so tails run under the next entrance. Whole words: 2-5 f (8-12 f voice-led). CTA stacks widen to ~8 f.
6. **Arrive from oversize, never from zero.** Identity objects (logo, word, cursor, card) start 1.4-5x and scale down: logo 3.5x with 39% of the drop in frame 1, 86% by 6 f, rest at ~20 f. Growth from small is allowed only when growth is the content (a cascade of 13 tiles 1 f apart, a dot that becomes the next scene, identity objects starting no smaller than 0.30-0.60x). Spend scale once per film; the ending usually gets smaller.
7. **No dead frame.** Something visibly changes in every 0.5 s window (AuteurFrame R4; motionmaxxing G2 fails more than 3 consecutive flat frames). A held line keeps one living thing: 1-3 px/f drift, 0.5-1% scale creep, a caret, a counter tick, moving light on the ground. A designed breath of 0.6-1.5 s before a payoff is good if it has one living element and a stated reason.
8. **One frame clock per moment.** Smooth 30/60, or on-twos (poses hold 2 f, onsets on even frames), or 12 fps drawn layer on a smooth camera. Never mix step rates within a beat.
9. **One blur grammar per film.** Pick exactly one: per-element directional smear (blur along travel on frame 1, halving each frame over 2-4 f), crisp steps (no smear even at speed), or render-time shutter blur (180 deg, 8 subframes). Never combine shutter with smear or with on-twos.
10. **End in motion or on a designed stillness.** Clips cut mid-move. The film's resolved end hold is 0.6-1.4 s (R5), the last shot no more than 25% of the film.
11. **Anticipation is for the key move only.** 5% of moves have it: a 3 f drift opposite travel, or a 0.1 s still before a press.
12. **Press physics.** Squeeze 2-6 f to 0.71-0.90, target reacts 0-1 f after the cursor, release slower (~0.32 s) with at most +5% rebound. No ripple rings, no white flashes.

### The 12 measured eases and their AuteurFrame names

| motionmaxxing | Shape (% done at 10/25/50/75% of time) | Frames | AuteurFrame ease | Use |
|---|---|---|---|---|
| softLand | 30/59/85/95 (expo-out k 3.4) | 12 (6-21) | `au.softLand` | text rises, panels, scale-ins; the workhorse landing |
| snapSettle | 54/84/96/98 | 11 (6-29) | `au.snapSettle` | hero entries, CTA (23% of CTA moves), logo drop from oversize |
| glide | 16/39/69/91 (power 1.7 out) | 10 | `au.glide` | medium x/y/scale lands, camera push |
| whip | 23/52/83/97 (power 2.5 out) | 7-8 | `au.whip` | big fast moves, whip entries |
| accelExit / gentleIn | 0/3/16/47 (power 2.6 in) / power 2.07 in | 13 / 9 | `au.exit` | every leaving move, pulls, defocus-out |
| crashIn | peak 1.18 at t 0.27 (source) | 10 | `au.punch` | slams; in AuteurFrame au.punch is a fast-snap bezier (.12,.9,.18,1) with no overshoot, so add a separate <= 8% scale lean if a slam must pass its mark |
| popOver | 10/46/96/108, peak 1.08 at t 0.72 | 15 | `au.pop` | the late lean, at most 1 in 8 moves in hooks |
| cruise | linear | 9 / 26+ for drift | `au.linear`, `au.drift` | fades, counters, drifts, creeps |
| softInOut | 4/17/50/83 (S) | 9 | `au.breathe`, `au.float` | ambient loops, ground and colour ramps, opacity |
| (wind-up) | 3 f opposite travel then go | 3 + move | `au.anticipate` | the one key move per scene |

bounceHard (peak 1.48) and crashOut (power 4 in) have no AuteurFrame name: they break the <9% overshoot rule or are covered by `au.exit`.

## Do / Don't

| Don't (AI default) | Do |
|---|---|
| One ease (power2.out, 0.6 s) on every tween | Pick by role: au.softLand 12 f lands, au.exit 13 f leaves, au.linear 6 f helper fades |
| Fade every element in over 0.5 s | Move it (offset 0.03-0.07 H, scale, blur decaying over 12 f); opacity 4-6 f helper |
| back.out(1.7) on every pop | Overshoot on < 9% of moves, late (au.pop), one visible spring per film |
| Constant stagger 0.1 s | 1-3 f uneven, overlapping at ratio ~0.5 |
| Grow logo from scale 0 | Start 1.4-5x, au.snapSettle 18-30 f |
| Hold a settled frame 1-2 s | One living thing on every hold; still only < 1 s after a payoff |
| Mix 12 and 30 fps steps in a beat | One clock per moment |
| Ease-out exits | Exits accelerate, end at peak speed on the cut |
| Reverse the entry to exit | Exit with new motion (the tail pushes out, curls smaller) |

## Recipe: land, live, leave (plain GSAP)

```js
const tl = gsap.timeline({ paused: true });
const f = n => n / 30;
// land: offset + blur + short opacity helper, decelerating
tl.fromTo('#title', { y: 54, filter: 'blur(6px)', opacity: 0.2 },
  { y: 0, filter: 'blur(0px)', duration: f(12), ease: 'expo.out' }, 0.2);
tl.to('#title', { opacity: 1, duration: f(5), ease: 'none' }, 0.2);
// live: 1.5 px/f linear drift while held (no dead frame)
tl.to('#title', { x: -40, duration: 0.9, ease: 'none' }, 0.2 + f(12));
// leave: accelerate, end at peak speed on the cut
tl.to('#title', { y: -120, duration: f(13), ease: 'power2.in' }, 1.5);
```

## Recipe: uneven stagger

```js
const gaps = [0, 3, 5, 7, 9, 11, 13].map(x => x / 30);   // uneven, 1-3 f apart
items.forEach((el, i) => tl.fromTo(el, { yPercent: 60 },
  { yPercent: 0, duration: 0.2, ease: 'expo.out' }, start + gaps[i]));
```

## In AuteurFrame

- Use only named eases. Lint rejects raw `power2.out`-style strings in agent code; map them through the table above.
- Every animated element carries `data-layer`. The probe measures motion energy per 0.5 s window (R4) and end hold (R5: 0.6-1.4 s).
- R3: landing decelerates, leaving accelerates, overshoot < 9%: au.pop (back.out 1.32) and au.snapSettle (back.out 1.1) stay under 9%; au.punch does not overshoot.
- Durations in frames: `fr = n => n / fps` from ctx so the scene is correct at 24, 30 or 60 fps.

```html
<div class="world"><h1 class="hero" data-layer="hero">Cities sink</h1><span class="tag" data-layer="tag">2 cm a year</span></div>
<style>.hero{font:600 var(--fs-xl)/1 var(--font-display);color:var(--ink)}
.tag{font:500 var(--fs-md)/1 var(--font-body);color:var(--muted)}</style>
<script>
AU.scene(({ tl, D, fps, $ }) => {
  const fr = n => n / fps;
  tl.fromTo($('.hero'), { scale: 1.6, opacity: 0.25 }, { scale: 1, duration: fr(14), ease: 'au.snapSettle' }, 0.15);
  tl.to($('.hero'), { opacity: 1, duration: fr(5), ease: 'au.linear' }, 0.15);
  tl.fromTo($('.tag'), { y: 30 }, { y: 0, duration: fr(12), ease: 'au.softLand' }, 0.15 + fr(10));
  tl.to($('.world'), { scale: 1.03, duration: D - 1.2, ease: 'au.drift' }, 0.6);
  tl.to($('.tag'), { y: -60, opacity: 0, duration: fr(13), ease: 'au.exit' }, D - 1.0 - fr(13));
});
</script>
```

## Gates (motionmaxxing G0-G5, adopted)

| Gate | Pass condition | AuteurFrame check |
|---|---|---|
| G0 render exists | decodes, not blank, picture moves, length matches plan, audio present if planned | render.py ffprobe + frame variance |
| G1 proof readable | UI/proof text >= 0.04 H; fragment >= 0.55 W or cropped by frame edge; lit; magnified by camera | probe min type + bbox; critic on contact sheet |
| G2 no empty frame | no run of > 3 consecutive flat frames (dips <= 3 f inside a dive ignored) | probe motion energy (R4 stricter: every 0.5 s) |
| G3 end card short | end hold <= 1.4 s; final shot <= 25% of film | R5 0.6-1.4 s |
| G4 one hero per frame | two panels only if one >= 2x the other's area or the camera moves between them | R1, probe area ratio |
| G5 no page chrome | no corner labels, tracked-caps labels, counters ("02 / 07"), timecodes, header/footer bars, kicker above headline, left headline block x < 0.2 with right media, progress bars, letter-typed headlines, vibe-coded UI cards | qa.py static lint on DOM |

A gate that fails is fixed, never argued. Quote the numbers.

## QA checklist

- [ ] No tween uses an unnamed ease; median duration of all tweens within 6-24 f.
- [ ] Every exit across the frame uses au.exit; every landing uses an out-ease.
- [ ] Opacity-only entries < 20% of entries.
- [ ] Max overshoot < 9%; at most one visible spring in the film.
- [ ] Staggers uneven, gaps 1-3 f for siblings, 2-12 f for words.
- [ ] No 0.5 s window with zero motion energy; no > 3 flat frames.
- [ ] One clock and one blur grammar declared in the scene plan.
- [ ] End hold 0.6-1.4 s; nothing grows from scale 0 unless growth is the content.
- [ ] G5 lint clean.

## Sources

- motionmaxxing: SKILL.md (laws, gates), references/motion.md (MEAS tables, R1-R7), runtime/motion.js (ease constants) - github.com/Tejashmakwana/motionmaxxing
- HyperFrames skills/hyperframes/references/motion.md (exits 40-50% shorter, springs by damping ratio, overlap 30-50%) - github.com/heygen-com/hyperframes
- huashu-art-motion references/动画语法 y1-y5, t1-t3 (kurzgesagt 50 f moves, 3b1b smooth, storytime 0.1 s pose snaps) - github.com/alchaincyf/huashu-art-motion
- cth9191/animate craft.md (springs, on 2s, something new every 2-4 s)
- bangtutorial/bang-motion references/anti-ppt.md (in 0.7-1.3 s power4.out, out 0.35-0.55 s power2.in)
- MoVer (arxiv 2502.13372): predicate-level motion verification feedback
