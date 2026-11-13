---
name: story-animation-direction
description: Direct animated story films like the big cartoon story channels - beat structure, one setup per idea, 2 to 4 second shots, painted backgrounds with parallax, constant camera drift and push-ins, whip transitions, impacts as burst plus shake plus flash, characters that act on every line, sound effects on word times. Use for fiction, survival stories, sketches, fables, what-if films and any narrated story.
stage: animate
tags: [story, narrative, cartoon, cinematic, shots, camera, whip, impact, pacing, beats, fiction, zombie, adventure]
version: 1
---

# Story animation direction

## Beats

Hook (action on frame 1, the stakes in one line), setup, rising trouble, a turn ("but"), the low point, the payoff that answers
the hook. One idea per sentence; a new idea gets a new setup. Each scene of the film is a small sequence: establish, act, react.

## Inside one scene

- Background first: a painted environment, never a flat colour. Sky gradient, silhouettes of buildings or hills in two or three depth
  layers moving at different speeds (parallax), ground line with texture, light sources (street lights, fire, sun) with glows.
- Characters perform the narration: when the voice says "ran", someone runs; "whispered", the face changes and the camera pushes in.
  Use toon characters or your own SVG characters (svg-character-design skill), with props and expressions from the script.
- Constant camera life: slow push-in (scale 1 to 1.06 across the shot) plus a tiny handheld drift (two sines, 2 to 4 px); push harder on
  emotional lines. A crash zoom or a whip pan for surprises.
- Impacts are three things at once: a burst (radial lines or particles), a 0.25 s camera shake (decaying random offsets), a white flash
  (opacity 0.6 to 0 over 0.15 s). Add a sound effect on the same frame.
- Day counters, place names and time stamps as stamped titles that slam in (scale 1.4 to 1, rotate -4 deg) and hold.
- Atmosphere moves: smoke and ash particles, flickering lights (opacity noise), rain, fog layers drifting.
- Text on screen is short (1 to 4 words); captions carry the narration.

## Transitions

Whip: the last 0.2 s of a shot blurs and slides out fast (motion blur via filter blur 8 to 12 px) while the next one slides in from the
opposite side. Match cuts on shape or motion. Fade to black only for time skips or endings. Let the scene's own motion lead into the cut.

## Pacing

Shots of 2 to 4 s inside scenes, something new on screen at least every 3 s, the biggest animation at the payoff, at least two moments of
stillness (a held face, a quiet skyline) so the loud moments land.

## Sound

Place sound effects on word times: footsteps on runs, glass on breaks, groans for zombies, radio static, sirens, wind for empty streets,
a low riser under rising tension, an impact on reveals. Music stays under the voice.

## Checklist

Every scene: painted background with depth, at least one character acting, camera moving, one atmosphere layer, an impact or reveal
timed to a word, no static frame longer than 1 s, faces out of the caption band.
