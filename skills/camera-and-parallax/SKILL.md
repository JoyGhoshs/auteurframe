---
name: camera-and-parallax
description: Use when a scene needs a virtual camera: push-ins, pulls, reframes, pans across a world, whips, scale dives or layered parallax depth.
stage: animate
tags: [camera, parallax, zoom, pan, depth, world]
version: 1
---

# Camera and Parallax

The camera is what turns a sequence of panels into one film. Put the whole world in one group, move that one transform, and let layers travel at different speeds for depth. This skill gives the measured camera vocabulary: one-frame snaps with tails, push and pull multipliers sized by duration, two-push pans, parallax ratios, log-scale dives and the per-genre camera habits (Vox, Kurzgesagt, RSA whiteboard, 3b1b, keynote, storytime). Base eases are defined in motion-rules-core (au.glide, au.softLand, au.exit, au.whip, au.drift).

## When to use / not use

- Use: revealing a detail on a screenshot or chart, travelling between stations on one large drawing, scale journeys (cell to planet), making a static frame feel lensed.
- Use the camera as an EVENT: hold, move to the next thing to look at, hold.
- Not: a uniform slow push in every shot "to fill time" (all style cards flag this as the old, wrong habit). Not: zooming text separately from its world.
- 3b1b math: camera stays still during waits; moves only to look at the next object.

## Core rules

1. **One camera group.** All world content lives in the scene root (`#au-scene`, called the world); `AU.camera` moves only its transform, and `data-depth` children get parallax. Ground textures that prove scale (dot grid) may stay screen-fixed; cursor and captions live on a top layer outside the camera. Text is never zoomed on its own.
2. **Reveal snap.** To reveal or reframe: one-frame scale step with ratio 0.56-0.77, then a 0.3-0.6 s decelerating tail (au.softLand, 9-18 f). It punches like a cut, then lets the frame be read. Example: 2.50 -> 1.41 in 1 f, settle to 1.0 over 0.56 s.
3. **Size the move by its duration.** Punch <= 6 f: 1.25x. 12-18 f: 1.4x. 20-45 f: 1.5x. Slow drift 46+ f: up to 2.4x. Reveal pull: ~1.8x with an ease-in. One hero scale move per moment, median ~4x.
4. **Pushes ease out (48%) or in (31%); pulls ease in (62%).** Push = au.glide; pull-off = au.exit; drift = au.linear/au.drift.
5. **Pan = two pushes, never one ease.** Push 1 fast at frame 0, slow drift, push 2 accelerating, settle (e.g. x 1.09 -> 0.87 in 0.25 s, drift to 0.74 by 1.08 s, peak 0.025 W/f at 1.6 s, settle by 2.1 s). One ease reads as a keyframe; two pushes read as an operator.
6. **Parallax at 2-2.4x speed ratios** between layers (foreground > mid > far). Some layers never scale. Stagger their exits (text clipped first, grid later).
7. **Zoom in log space.** Interpolate log(scale): `scale = exp(lerp(ln s0, ln s1, e))` so perceived speed is constant. Dives: constant octave rate x1.5-2 per 2 f at 30 fps, accelerate 0.4 s then decelerate to ~1.1 s. Aim at a feature (not the centre) so it exits a frame edge. Vector or oversampled sources only past 4x.
8. **Never reveal the stage edge.** A whip or pan that exposes blank beyond the world reads as "page turn". Build the world >= 1.3x the frame in the travel direction, or clamp.
9. **Hold before diving in.** The target holds >= 0.3 s and lights up (stroke turns accent) so the viewer knows which door you enter.
10. **Shot-size changes beat micro-breathing.** A camera "breath" of a few % is invisible. When a scene feels static, change shot size: push to the element that is speaking at 1.4-2.2x over 0.6-0.9 s ease-in-out, then pull back to wide. Not on every click.
11. **Whips.** Median 8 f; entry half au.whip (7-8 f), departing half au.exit (6-10 f), cut at peak speed, new content continuing on the same vector, an anchor riding the pan (cursor, card) at constant size. Smear films add blur on the last 3 f; crisp films change content inside the whip instead.
12. **Micro-drift when the camera appears to hold.** >= 1 px/f (0.003 H/f), or move something else. Exception: the designed still of 3b1b and Vox desk holds; then something inside the frame must act.
13. **End a moment still accelerating** (pan ending hard, pull-off at peak), unless it is the film's resolved end hold.
14. **Prove scale.** A 2x zoom must read as 2x: a fixed texture (grid pitch doubling, stroke thickening) confirms it.

### Genre camera habits (measured)

| Genre | Habit |
|---|---|
| Vox collage desk | push 0.6-1.5 s sineInOut toward the line to read; pull-out ~1.0 s fast-start long tail (cubic-bezier(.33,0,.2,1)); trace along a red line 1.3-1.8 s; camera stops dead during holds; elements on 12 fps steps, camera smooth |
| Kurzgesagt | ~1/3 of time zooming, pans ~10%, rotation ~5%, more pull-outs than pushes; standard move 50 f@60 (0.83 s) cubic-bezier(.75,0,.25,1); call-out: hold, 0.9 s push, hold; node to node 0.7 s; reveal 0.28 s fast push; scale transition ~1.4 s accelerate then decelerate; fast pull reveal 0.2-2 s |
| RSA whiteboard | board pans 1.2-2.4 s easeInOutSine, ~0.23 W per move, 75% overlap with previous block, ~5.3 moves/min; whip 0.8 s cubicInOut for 0.5-1.2 W jumps; end: pull back to reveal the whole board, 0.6 s fast then slow scan |
| Minute Physics | camera does not move; hard cut to a new sheet ~8.1/min |
| 3b1b | still during waits; smooth (6t^5-15t^4+10t^3) push ~1 s to the next object; fast 0.28 s push 18-32% only on the conclusion, once or twice per segment; 3D orbit 0.5-3 deg/s only for spatial ideas |
| Keynote/product | screenshot >= 80% W (>= 90% on 9:16); push ~0.9 s to the region being discussed, 0.7 s to the next; 0.28 s snap only for the reveal; at most 1-2 pushes per screenshot |
| Storytime | locked frame; jump-in hard cut to ~2x on the punchline; smash cut from 1.22x spring back |
| Data | chart holds after landing; ~1 s push to the datum being named |

## Do / Don't

| Don't | Do |
|---|---|
| Tween every element separately to fake a camera | One camera transform on the scene root via `AU.camera` |
| Linear 2.6 s push 1.00 -> 1.10 on every shot | Hold, event push, hold |
| Zoom about the frame centre and lose the subject under captions | Put a world point on a screen point (compute translate from target bbox) |
| Linear interpolate scale on a 20x dive | Log-scale interpolation |
| Whip that shows blank stage edges | Oversized world, cut at peak speed |
| 3D yaw/roll shocks on every cut | Camera breath as base layer + motivated moves 1x per video |

## Recipe: frame a target, then snap-reveal (plain GSAP)

```js
function frameTo(world, el, W, H, pad = 0.15) {
  const b = el.getBBox ? el.getBBox() : { x: el.offsetLeft, y: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight };
  const s = Math.min(W / (b.width * (1 + 2 * pad)), H / (b.height * (1 + 2 * pad)));
  return { scale: s, x: W / 2 - (b.x + b.width / 2) * s, y: H / 2 - (b.y + b.height / 2) * s };
}
const tgt = frameTo(world, detail, 1920, 1080);
tl.to(world, { ...tgt, duration: 0.9, ease: 'sine.inOut', transformOrigin: '0 0' }, 2.0);   // event push
tl.set(world, { scale: tgt.scale * 0.66 }, 4.0);                                              // 1-frame snap, ratio 0.66
tl.to(world, { scale: 1, x: 0, y: 0, duration: 0.5, ease: 'expo.out' }, 4.0 + 1 / 30);       // tail
```

## Recipe: log-scale dive

```js
const s0 = 1, s1 = 22, prog = { e: 0 };
tl.to(prog, { e: 1, duration: 1.1, ease: 'power2.inOut',
  onUpdate: () => gsap.set(world, { scale: Math.exp(Math.log(s0) + (Math.log(s1) - Math.log(s0)) * prog.e) }) }, 3);
```

## In AuteurFrame

- `AU.camera({ at, x, y, scale, rotate, duration, ease })` moves the scene root (`#au-scene`) on `tl`; x/y are world coordinates placed at screen centre. Use au.glide for pushes, au.exit for pulls, au.softLand for snap tails, au.whip for whips, au.drift for creeps.
- Content must stay inside `ctx.safe` at every camera state: the probe checks off-canvas per sampled frame. Elements meant to leave carry `data-allow-offstage`.
- Parallax: give layers `data-depth` (0 far ... 1 near) and drive them from one progress value on `tl`, with speed ratios 2-2.4x between neighbours.

```html
<div class="world" data-layer="world">
  <div class="far" data-layer="far"></div><div class="mid" data-layer="mid"></div>
  <div class="chip" data-layer="chip">Pressure 4.2 kPa</div>
</div>
<script>
AU.scene(({ tl, D, W, $ }) => {
  AU.camera({ at: 0.6, x: 1240, y: 520, scale: 1.4, duration: 0.9, ease: 'au.glide' });
  tl.to($('.far'), { x: -W * 0.02, duration: D, ease: 'au.drift' }, 0);
  tl.to($('.mid'), { x: -W * 0.045, duration: D, ease: 'au.drift' }, 0);
  AU.camera({ at: D - 1.6, x: 960, y: 540, scale: 1, duration: 0.6, ease: 'au.exit' });
});
</script>
```

## QA checklist

- [ ] Exactly one camera transform per scene; no independently zoomed text.
- [ ] Each camera move has a stated target and a hold (>= 0.3 s) before and after, except whips.
- [ ] Move scale matches duration table (6 f ~1.25x, 12-18 f ~1.4x, 20-45 f ~1.5x).
- [ ] Zooms beyond 3x interpolate in log space.
- [ ] No sampled frame shows the stage edge or a hero outside `ctx.safe`.
- [ ] Parallax layers differ by 2-2.4x in speed.
- [ ] Not every scene uses the same move (vary push, pull, pan, snap, still).

## Sources

- motionmaxxing references/motion.md section 6 (R6.1-R6.15), layout.md R5.4 - github.com/Tejashmakwana/motionmaxxing
- huashu-art-motion y1_kurzgesagt, y2_vox, y3_whiteboard, y4_storytime, t1_3b1b, t2_keynote_ui, t3_finance_chart (measured camera times)
- bangtutorial/bang-motion references/anti-ppt.md, techniques.md section 3b (shot size 1.4-2.2x, 0.6-0.9 s)
- cth9191/animate craft.md (cameras put a world point on a screen point)
- HyperFrames references/motion.md (wrapper punch-ins, slow orbit 3-5 deg/s)
- 3b1b/manim MovingCameraScene, rate_functions.py smooth
