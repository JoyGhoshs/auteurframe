---
name: character-animation
description: Directing 2D characters, mascots and sprites in explainer scenes - actions (walk, run, wave, point, present, talk, think, celebrate, shrug, nod, shake, look, sad), staging, timing actions to dialogue, acting principles, and playing sprite-gen atlases. Use whenever a person, mascot or creature acts on screen.
stage: animate
tags: [character, mascot, sprite, acting, explainer, walk, talk, lipsync, rig, 2d]
version: 1
---

# Character animation

For story films and any cast of distinct people, prefer the `toon` component and the svg-character-design skill: it builds each
character from the script (presets, hats, hair, outfits, props, expressions, zombies, crowds) instead of reusing one figure.
The `character` rig below is the plain explainer person; use it only for neutral corporate explainers.

## The rigs
- `character`: vector person with jointed arms and legs, head, eyes, brows, mouth. Styling: `skin` (light, tan,
  brown, dark, deep or a colour), `hairStyle` (short, long, bun, curly, none), `hair`, `shirt`, `pants`, `shoes`
  (tokens like `--accent` or colours), `accessory` (glasses, tie), `outline`.
- `mascot`: blob, drop, star or robot body with eyes and mouth; squash-and-stretch `hop`, `talk`, `spin`, `look`,
  `celebrate`, `shake`.
- `sprite`: frame-by-frame sheet. Give `src` (image asset) and either `manifest` (JSON asset or inline object, e.g. a
  sprite-gen `manifest.json` with `frame_layout` states and per-state fps) or `grid: [cols, rows, count]`.
- `model3d` with a rigged Polyfork character plays real Idle, Walk and Run clips (see 3d-models skill).

## Actions
Actions are `{do, at, duration, ...}` and blend, so `talk` can run while `walk` or `point` plays.
- `walk` / `run` with `to` (x %): the character turns to face the direction and stays there.
- `wave`, `point` (`dir`: left, right, up), `present` (open-hand gesture), `think` (hand to chin), `shrug`, `nod`,
  `shake`, `look` (`dir`), `sad`, `celebrate` (arms up and jumps).
- `talk`: the mouth follows word timings from the subtitles when they overlap the action; otherwise it flaps naturally.

## Staging and acting
- Enter with purpose: walk in from the frame edge to a mark, then act. Two characters face each other when they talk.
- Anticipation and follow-through: precede a big gesture with a small opposite one (a short `think` before `present`,
  a `nod` after a statement).
- Overlap: start the next action 0.2 to 0.4 s before the previous one ends; robots act on beats, people overlap.
- One speaker at a time: the listener does small `nod`s or `look`s, never full gestures.
- Point at what you explain: `point` towards a `callout`, chart or 3D model; start the point on the word that names it.
- Scale: characters at 40 to 55% of frame height for dialogue, 20 to 30% when they share the frame with a big diagram.
- Keep feet on a ground line (`y` 85 to 92%); give the ground a `particles` dust or a drawn line so the figure does not float.

## Example
```js
AU.component('character', { x: 12, skin: 'brown', hairStyle: 'curly', shirt: '--accent', actions: [
  { do: 'walk', at: 0.1, duration: 1.6, to: 32 }, { do: 'wave', at: 1.8, duration: 1.1 },
  { do: 'talk', at: 2.0, duration: 3.0 }, { do: 'point', dir: 'right', at: 3.1, duration: 1.4 } ] });
AU.component('callout', { text: 'Tidal *bulge*', tx: 70, ty: 50, lx: 78, ly: 26, at: 3.2 });
```
