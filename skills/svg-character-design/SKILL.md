---
name: svg-character-design
description: Create the story's own characters instead of reusing one stock rig - cast them with the toon component (presets, hats, hair, beards, outfits, props, expressions, zombies, crowds) or code a brand new rigged SVG character (pivoted limb groups, expressive face, mouth shapes for talking) and animate it like a cartoon (anticipation, overlap, arcs, holds). Use for any story, sketch, dialogue or explainer with people, creatures or mascots.
stage: animate
tags: [character, svg, cartoon, toon, rig, story, zombie, crowd, expression, acting, design, stick figure, animal, pet, dog, cat]
version: 1
---

# SVG character design

Every story deserves its own cast. Design each character from the script first (who they are, what they wear, what they
carry, how they feel), then build them. Never reuse the same default figure for different people.

## Style of the house cartoon (toon)

Bold story-channel look: big white round head (about a third of the height), thick ink outline `#221c22` at 6 px, dot eyes,
short thick brows that carry the emotion, small mouth, rounded coloured body, thin stick arms and legs with round hands, soft
contact shadow. Colour comes from clothes and hats; faces stay white (zombies green-grey).

## Casting with toon

```
AU.component('toon', { preset: 'teen-girl', x: 30, y: 88, h: 44, shirt: '#d94b3d', prop: 'flashlight',
  actions: [{ do: 'run', at: 0.3, duration: 1.8, to: 62, expression: 'scared' }, { do: 'look', dir: 'left', at: 2.2, duration: 1 }] });
```
- presets: kid, teen-girl, teen-boy, old-man, old-woman, police, soldier, doctor, scientist, businessman, chef, biker, beekeeper, thief, zombie, hero.
- hat: beanie, cap, police, military, helmet, beekeeper, cowboy, chef, crown, hood, tophat, hardhat, headband, party, none.
- hair: messy, bowl, spiky, side, ponytail, long, bun, curly, wild, bald-sides, mohawk, bald.
- beard: full, stubble, mustache. extras: backpack, cape, tie, badge, scarf, apron, stethoscope, vest, glasses, sunglasses, eyepatch, bandage, freckles, scar, earrings.
- prop in the front hand: flashlight, phone, money, radio, sign, torch, book, bag, cup, umbrella, map, key.
- expression: neutral, happy, sad, angry, worried, shocked, scared, smirk, laugh, determined, sleepy, zombie, love, thinking.
- actions: walk, run, shamble (with `to`), wave, point (dir), talk, look (dir), shock, jump, cheer, shrug, nod, shake, think, scared,
  cry, laugh, angry, crouch, fall, hold, raise, hug, turn, pull. Each action can set its own `expression`.
- `lipsync: 'voice'` or a line asset from `speak` makes the mouth follow real audio. `depth` 0 to 1 pushes a character back (blur, darker).
- Crowds and hordes: `AU.component('toon-crowd', { count: 16, zombie: true, rows: 3, move: 'shamble', dir: 'right' })`.

Give every main character a signature: one colour, one hat or hairstyle, one prop. Keep it identical in every scene (write the
same parameters each time) so the audience recognises them.

## Animals and pets (toon-animal)

```
AU.component('toon-animal', { species: 'dog', x: 70, color: '#C98B4E', collar: '#D32F2F',
  actions: [{ do: 'run', at: 0.4, duration: 1.6, to: 40 }, { do: 'wag', at: 2.2, duration: 1.5 }] });
```
- species: dog, cat, rabbit, fox, pig, bird; colour, color2 (belly or spots), collar, spots.
- actions: walk, run, sniff (with `to`), sit, lie, sleep, jump, wag, happy, bark, eat, look, sad, beg, shock.
- Never draw a pet with a human toon preset. Keep the same species, colours and collar in every scene.

## Custom parts

`parts` adds your own SVG in the rig's 240 x 480 space (head centre 120,96 radius 60; torso 76..164 x 150..302; hand at 0,0 of the prop group):
```
parts: { head: '<path d="M70 60 Q120 0 170 60" stroke="#221c22" stroke-width="6" fill="#6b4"/>', prop: '<rect x="-4" y="-50" width="8" height="60" fill="#888"/>' }
```
Head parts move with the head, prop parts with the hand, body parts with the torso.

## Coding a brand new character

When the story needs a creature, animal, robot or a very different human, write it yourself as an inline SVG rig:
1. Draw in a fixed viewBox (for example 0 0 240 480). Separate every moving part into its own `<g>`: root, torso, head, each upper limb,
   each lower limb (nested inside its upper limb), eyes, brows, mouth shapes.
2. Put the joint at a known point and rotate with `transform="rotate(a, jointX, jointY)"`; never rotate around the SVG origin.
3. Faces: brows are the strongest emotion signal (inner ends up = worried or sad, down = angry); eyes as dots, closed arcs for laughing,
   big whites for shock; mouth as alternative paths you show or hide (smile, frown, O, grin) plus an ellipse whose height follows speech.
4. Animate in `onFrame((t) => ...)` from pure functions of t: idle breathing (sine on torso scaleY 1 percent), blinks every 2 to 4 s,
   walk cycles (thigh angle sin(phase) * 26, knee max(0, -sin(phase)) * 24), arm swing opposite to legs.
5. Acting principles: anticipation (small counter move 0.1 to 0.15 s before the action), overlap (head and arms settle 2 to 4 frames after
   the body), follow through, arcs for hands, squash on landings, holds of 0.3 to 0.6 s on key poses so the audience reads them.
6. Ink outline, flat fills, one highlight colour; match the toon proportions when the custom character shares a scene with toons.

## Staging

- Two characters talking: face each other (`facing: 'left'` on the right one), the listener reacts (nod, worried, look).
- Big moments: shock jump with a camera shake and flash, then hold.
- Keep characters' feet on a ground line, cast a contact shadow, and keep faces out of the bottom caption band.
