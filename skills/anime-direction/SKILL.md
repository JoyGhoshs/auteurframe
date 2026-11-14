---
name: anime-direction
description: Direct and draw 2D anime films in code - a closed colour script, cel painting (flat colour, one hard shadow shape, tapered line, big eyes with window catchlights, hair in masses with one sheen band), limited animation on twos with holds, one sakuga action shot per sequence with anticipation, smear and settle, cuts on action instead of zooms, colour-dip cuts and anime sets, weather and effects. Use with anime-face, anime-figure, anime-set and anime-fx whenever the brief asks for anime, manga, Japanese animation or a cel-animated look.
stage: animate
tags: [anime, manga, cel, limited animation, twos, sakuga, smear, colour script, japanese animation, shot sheet, close-up, action]
version: 1
---

# Anime in code

Anime reads as anime because of discipline, not detail: a small closed palette, flat cel paint with one hard shadow,
drawings that hold and snap instead of sliding, and cuts that do the work a zoom would do elsewhere. Every scene is
built from `anime-set`, `anime-figure`, `anime-face` and `anime-fx`, or your own SVG that follows the same rules.

## 1. The colour script is closed

The film has one colour script (indigo, ember, noon, sakura, festival, storm, dawn, neon). Pass the same
`script` to every anime component in every scene. Use only its named paints: sky, sky2, ink, moon, accent, practical,
iris, skin, hair, sclera, line, coat. For your own SVG read them with `AU_ANIME.paints('indigo').accent`.
Shade with opacity of those paints (ink at 20% for shadow), never with new hexes. The brightest shape in a shot is one
practical light: the moon, a window, a lamp or a blade.

## 2. Plan the sequence as a shot sheet

Write the scene list like a shot sheet whose times add up exactly to the runtime:

| shot | purpose | camera |
|---|---|---|
| establish | the place; figure small or absent, drawn as a silhouette | one push from 1.00 to 1.06 at most |
| approach | a closer cut on who is there | locked or the same small push |
| turn | four anticipation frames, then a hold on the decision | locked |
| sakuga | the verb of the story, the one expensive shot | locked; the drawings move |
| aftermath | the settled result, held at least half a second | locked |
| button | close-up or a return to wide, the line, then hold | fade the last 8 frames to ink only at the film's end |

One sakuga shot per 20 seconds of film. A longer film repeats the pattern per sequence; it never makes every shot
an action shot.

## 3. Paint a cel

- Flat local colour, then one hard shadow shape per character in ink at 20%, then line on top. No airbrush, no glow
  stacks, no blur on characters.
- Line is about 6 px on the outer contour and 3 px inside at 1080p; taper by drawing the shape, not with filters.
- Eyes: sclera, iris, pupil and at most two catchlights shaped like a window. Hair: two or three solid masses and one
  hard sheen band. The anime components already draw this way; keep your own SVG consistent with them.
- Depth back to front: sky, far silhouettes (ink at 40 to 60% with a few practical windows), ground and wide figures,
  weather, close figures, type. Weather can sit in front of a close figure to put the camera inside the rain.
- Wide shots show figures as silhouettes (anime-figure does this automatically under 32% of the frame height,
  with a rim of the script's line paint). Detail belongs to close-ups.
- One shot size per shot: a scene is a close-up (anime-face) or a figure shot (anime-figure), never the same
  character as a bust and a body in one frame. Two characters in a close-up shot are two anime-face busts.
- Keep the background a step lighter or darker than the characters so they read; prefer anime-set over custom
  gradient backgrounds, and keep dark costumes against the lit part of the sky or a practical light.

## 4. Animate in drawings

- Acting runs on twos (12 drawings a second), rain, sparks, slashes and speed lines on ones (24). Walk drawings hold
  for 6 frames, run drawings for 2. Use `ease: ctx.twos(duration)` on any GSAP tween that moves a character part, so it
  steps instead of sliding; `ctx.ones(d)` for effects; `ctx.held(t)` gives the time on the twos grid inside onFrame.
- After an action settles, hold the drawing at least 12 frames (0.5 s). Inside a hold only a 2-frame blink or a hair
  follow-through may change.
- Expressions and head turns change on a cut or a drawing, never tween. anime-face turns in three drawings and adds
  hair follow-through by itself.
- Never fade a character in from opacity 0. Characters are in the shot when it starts, or they cut in with it.
  Type may rise 24 px and fade in over 0.4 s.

## 5. The sakuga shot

1. Anticipation: 4 frames moving the opposite way (anime-figure's `strike` and `jump` draw a windup or crouch).
2. Action as drawing swaps, not one long ease.
3. One or two smear frames: a stretched silhouette along the path of travel. anime-figure draws it at
   `at + 0.17 s` of a strike; put `anime-fx` slash and impact at that same time so they land on the smear.
4. Settle and hold. `hold: true` keeps the follow-through drawing on screen.
5. Speed lines (`anime-fx` speedlines or focus) only in this shot.

## 6. Camera and cuts

- Cut on the action; the settle belongs to the first frames of the next scene.
- To get closer, cut to a tighter scene. The only camera move is a slow push to 1.06 on a hold (`anime-set` push), or
  the scene camera keyframes with the same limit.
- Place eyes on a third of the frame, leave room in front of the gaze, do not centre every face.
- Colour-dip cut: `ctx.dip(D, 'var(--accent)')` at the end of a scene and `ctx.dip(0, 'var(--accent)', 0, 0.35)` at
  the start of the next, or set the scene transition to `cut` and let the dip carry it. Use accent or ink.
- 16:9 composes on thirds; 9:16 puts the head in the upper half and type in the lower fifth. Never crop a wide
  composition into a tall frame.

## 7. Dialogue and type

Dialogue only when the brief or narration gives it, in one language. Close-ups talk with `lipsync: 'voice'` or a
`talk` action; place the line with `speech` above the speaker or as a lower-third card inside letterbox bars.
No titles, logos or credits unless the brief asks.

## Minimal scene

```js
AU.scene(({ component, D }) => {
  component('anime-set', { preset: 'rooftop', script: 'indigo', weather: 'rain', push: 1.06, letterbox: true });
  component('anime-face', { layer: 'ren', script: 'indigo', hair: 'messy', iris: '#e3a04b', outfit: 'coat', accessory: 'scarf',
    x: 34, h: 86, turn: 0.4, expression: 'determined', wind: 0.6,
    actions: [{ do: 'talk', at: 0.6, duration: 1.4 }, { do: 'turn', at: 2.4, to: -0.2 }, { do: 'shock', at: 2.6, duration: 0.6 }] });
});
```

Check the contact sheet as a stranger: name the place, the person and the action in each frame. If two frames look
the same, the drawings are not changing; if a frame looks soft or glowing, the cel rules were broken.
