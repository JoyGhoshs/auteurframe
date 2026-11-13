---
name: transitions-and-continuity
description: Use when planning or building the join between two scenes or beats: match cuts, morph bridges, wipes, whips, ffmpeg xfade choice, handles and seam checks.
stage: edit
tags: [transitions, continuity, seams, match-cut, xfade, editing]
version: 1
---

# Transitions and Continuity

A film of individually good scenes still reads as a slideshow if nothing carries across the joins. This skill makes the next picture come out of the current one: plan both sides of every seam together, carry one concrete thing across, cut on motion at peak speed, and choose a small family of transition kinds that each have a cause on screen. It also covers the render-side mechanics (tail handles, xfade, opaque stage) and caption behaviour at shot changes. Base eases in motion-rules-core.

## When to use / not use

- Use at storyboard time (fill the handoff table before animating) and at assembly time (choose xfade and handles).
- Use when a critic says "feels like slides", "jump at the cut", or "white flash at the seam".
- Not: inside a single held scene where state changes are better as hard plateaus (0.3-0.4 s with a 1 f gap, never cross-fades).

## Core rules

1. **Plan both sides.** For each seam write A's last 6 frames and B's first 6 frames together: object, position (within 0.02 W), scale, colour, blur, ground, velocity. Something concrete must be identical across the cut.
2. **Cut on motion.** Cut at the fastest frame of a move, same direction and speed on both sides. Scenes start already moving (frame 0 is mid-move); clips end on a peak (max velocity, still-shrinking lockup), not at rest.
3. **3-5 transition kinds per film**, each caused by something on screen. At most 1/3 of beat seams are plain hard cuts (hard cuts belong inside scenes as punch-ins). AuteurFrame R9: cuts on motion, <= 2 plain fades per film. Worlds never crossfade into each other.
4. **Morph bridges cost time.** A shape-morph bridge costs ~1.2 s (0.4 s of it on blank paper). Under 30 s films: <= 3 morphs, or shorten to 0.8 s. Bridge object >= 200 px at the boundary and inside the frame (pull back push-ins first). Morph on the style's blank sheet, never on a blend of two wall colours.
5. **Ground changes need a cause.** The effect of A's last action (a burst, a growing disk, a band, a flood) becomes B's ground. Never a white flash. A theme flip hides inside a 4 f grey dip or a fast move.
6. **Reveal point, not start.** The seam's stress is the frame the new picture appears: start = beat - p x duration (push p ~0.58, fill-zoom p 0.55, bands p ~0.6).
7. **Transitions use the film's own shapes** (the brand dot, a cell grid in palette colour, the logo's notch), not generic wipes. Same transition on every cut is a "PPT template, expensive version".
8. **One grammar.** A crisp film uses cuts, wipes, masks, morphs; a smear film adds blur-matched whips. Do not mix.
9. **Overlap kills dead time.** Start the wipe in A 0.1-0.2 s before the voice ends; finish it in B's first 3 frames.
10. **Callbacks.** Late shots reuse early framings exactly, changed. The end is the start, changed.
11. **Captions at shot changes (Netflix, 24 fps reference).** Caption starting within 12 frames (0.5 s) after a cut snaps its in-time to the cut. Out-times within 0.5 s before a cut extend to 2 frames before it. Gaps between events are 2 frames or >= 0.5 s.

### Link types (why a cut happens; cth9191)

| Link | Reason | Recipe |
|---|---|---|
| next-step | the process continues | hard cut on the grid |
| match-position | hero holds its spot, world changes | cut/wipe; hero drawn identically |
| shape morph | this becomes that | close in on one object, morph, open out |
| iris in/out | into or out of the hero | circle on the hero over 2-4 f |
| scale-in/out | inside it / around it | same subject 5-20x bigger or smaller |
| pov | what the hero sees | cut to its view, same moment |
| cause-effect | this made that happen | build shot, then the effect on the grid |
| time-cut | later | flicker on 2s, or light changes on same framing |
| callback | back to an earlier image, changed | reuse framing exactly |

### Transition table (HyperFrames measured + anidoodle mechanisms)

| Transition | Build |
|---|---|
| Zoom through an object | camera tracks to it 0.6 s, object scales ~8% -> 250% frame in 0.35 s strong ease-in; its fill is B's ground |
| Object becomes the world | pill/card grows past frame 0.65 s in-out, radius shrinking; surroundings blur ~15 px and fade 0.3 s |
| Morph container | icon card widens into prompt box (~110 -> 880 px, 0.2 s, power3.out) with horizontal blur 12 -> 0 |
| Carry across | result shrinks 1 -> 0.6, blur peaking 6 px mid-move, lands inside B as B builds around it |
| Colour flood | hero stays, ground changes colour ~0.4 s in-out |
| Whip | 0.13-0.3 s smear; arriving element lands blurred and sharpens in ~0.13 s |
| Iris from click | clip-path circle opens from the click point, 0.15 s |
| Dip cut | outgoing darkens ~40% for 3 f before a hard cut |
| Blur swap | out: opacity -> 0 with ~8 px blur 0.13-0.2 s; in: blur -> 0 0.13 s; ground never cuts |
| Bands | 3 skewed colour bands relay L -> R, staggered 12%, last band is B's ground, 0.5 s |
| Persistent actor | one object keeps identity; same screen position and size on both sides within 2 px |
| Selection to expansion | one card of a set grows until it IS B; B's first frame framed exactly like the card |
| Continuous canvas | A and B are regions of one larger layout; camera travels |

## Assembly: handles and ffmpeg xfade

- Every rendered segment carries a tail handle equal to the outgoing transition duration (AuteurFrame: segment length = scene D + handle). The incoming scene starts at its cue boundary; the overlap lives in A's handle.
- Prefer in-composition transitions (both sides authored in one HTML seam) for designed seams; use ffmpeg xfade only for simple joins.
- xfade choice by intent, 0.2-0.6 s:

| Intent | xfade | Duration |
|---|---|---|
| same world, small change | `fade` (counts toward the 2-fade budget) or `dissolve` | 0.2-0.3 s |
| direction of travel | `slideleft` / `slideright` / `slideup` / `slidedown` | 0.3-0.4 s |
| push into next page | `smoothleft` / `smoothright` | 0.35-0.5 s |
| reveal from a point | `circleopen` / `circleclose` (iris) | 0.25-0.4 s |
| wipe with edge | `wipeleft` / `wiperight` | 0.3-0.5 s |
| dip | `fadeblack` (dip cut) | 0.2 s |
| zoom energy | `zoomin` | 0.3-0.4 s |
| scale/grid dissolve | `pixelize` | 0.3-0.6 s |

  `ffmpeg -i a.mp4 -i b.mp4 -filter_complex "[0][1]xfade=transition=slideleft:duration=0.35:offset=<lenA-0.35>,format=yuv420p" out.mp4` - offset is A's length minus duration, exact to the frame.
- Seam white-flash guard: any window where summed opacity < 1 shows the page background. The stage root must be opaque (`background: var(--bg)`), and xfade inputs must not carry alpha.
- Audio: crossfade with the same duration (`acrossfade=d=0.35`); a whoosh starts 2 frames early.

## Do / Don't

| Don't | Do |
|---|---|
| Fade + scale bump + light leak on every cut | 3-5 caused kinds, each used where the story asks |
| Generic diagonal colour block wiping | Mask in a brand shape, object wipe near the lens |
| Cut on rest | Cut at peak speed, B continues the vector |
| Torn-paper transition by default (absent in measured Vox films) | Hard cut on the narration's pause |
| Plan A, then improvise B | Handoff row per seam before animating |
| Crossfade between worlds | Wipe in B's ground colour, feather 0.31-0.42 |

## Recipe: carried object across a seam (plain GSAP, two scenes on one master timeline)

```js
// A ends: the dot accelerates to its seam pose; B begins: same dot, same pose, keeps moving.
const seam = 4.0, pose = { x: 1210, y: 610, scale: 0.6 };
tlA.to('#a-dot', { ...pose, duration: 0.35, ease: 'power2.in' }, seam - 0.35);
tlB.fromTo('#b-dot', pose, { x: 960, y: 540, scale: 9, duration: 0.6, ease: 'power3.out' }, 0); // dot floods into B ground
```

## In AuteurFrame

- The scene plan stores a handoff row per seam: `{from, to, carried, a_last:{x,y,scale,color,v}, b_first:{...}, kind, frame}`. The animator of scene N+1 reads scene N's `b_first` from the blackboard (`scene:N` key) before writing.
- Scenes end on a peak: put the exit tween so it is still moving at `D` (exempt from end-hold only when the scene is not the last; the film's last scene holds 0.6-1.4 s).
- Mark intentional off-canvas travel with `data-allow-offstage`.
- The editor assembles with xfade at exact cue boundaries; a scene requests its join with `data.transition = {kind, duration}`; default is a cut on motion.

```html
<div class="dot" data-layer="carrier"></div>
<script>
AU.scene(({ tl, D, W, H, $ }) => {
  tl.fromTo($('.dot'), { x: W * 0.63, y: H * 0.56, scale: 0.6 }, { x: W / 2, y: H / 2, scale: 1, duration: 0.35, ease: 'au.softLand' }, 0);
  tl.to($('.dot'), { scale: 24, duration: 0.5, ease: 'au.exit' }, D - 0.5);
});
</script>
```

## QA checklist

- [ ] Every seam has a handoff row and a named link type.
- [ ] Probe frame D-1/fps of A vs frame 0 of B: carried element within 0.02 W and same colour.
- [ ] 3-5 transition kinds in the film; <= 2 plain fades; <= 1/3 plain hard cuts between beats.
- [ ] No whole-scene crossfade between different worlds; no white or black flash unless authored.
- [ ] Handles rendered equal to transition length; offsets frame-exact.
- [ ] Captions snapped to cuts within 0.5 s.

## Sources

- motionmaxxing references/transitions.md (R1-R15, R3.2.x), motion.md R6.9-R6.11 - github.com/Tejashmakwana/motionmaxxing
- cth9191/animate grammar/STORY.md (link types), craft.md (morph budget)
- HyperFrames references/motion.md (transition table), .claude/skills/seam-craft (opaque stage guard, overlap injector)
- anidoodle references/motion-grammar.md (six mechanisms, 2 px relay check)
- huashu y5 (reveal-point offset), y2_vox (no torn paper)
- bangtutorial/bang-motion anti-ppt.md (transition menu, PPT template tells)
- Netflix Timing Guidelines: partnerhelp.netflixstudios.com/hc/en-us/articles/360051554394
- ffmpeg xfade filter documentation: ffmpeg.org/ffmpeg-filters.html#xfade
