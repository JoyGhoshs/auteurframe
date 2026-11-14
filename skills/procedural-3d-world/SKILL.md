---
name: procedural-3d-world
description: Build stylised 3D cartoon films entirely in code with the world3d and figure3d components - characters made from primitives (no model files, no Blender) with painted faces, sets (lab, battlefield, suburb, living room, forest, city at night, space, studio), effects (lightning, fireball, explosion, tornado, debris, confetti, weather) and a directed camera. Use for low-poly 3D story shorts, felt or clay stop-motion, toy-like product mascots, and any brief that asks for 3D characters.
stage: animate
tags: [3d, character, lowpoly, felt, clay, toy, stop-motion, world3d, figure3d, procedural, cartoon, roblox, shorts, lightning, tornado, battle]
version: 1
---

# Procedural 3D worlds

`world3d` renders one three.js world per scene: set, cast, effects and camera, all a pure function of time, so every
frame is exact and seekable. `figure3d` drops a single 3D character on a transparent background over any 2D scene.

## When to choose it

- The brief asks for 3D characters, a "3D cartoon", low-poly, Roblox-like, toy, felt, clay or stop-motion look.
- A story needs physical comedy in space: something flies at the camera, a character is blown away, a lab explodes.
- Use `model3d` instead when a real downloaded model (animal, vehicle, building) sells the idea better.
- Use `toon` or `stickman` for flat 2D stories. Never mix world3d and toon in one shot unless the brief asks for mixed media.

## Minimal scene

```js
AU.scene(({ component }) => {
  component('world3d', {
    set: 'lab', look: 'lowpoly',
    cast: [{ id: 'doc', preset: 'scientist', x: -0.4, z: 0.8, facing: 25,
             actions: [{ do: 'shock', at: 1.0, duration: 2.4 }] }],
    fx: [{ type: 'lightning', at: 0.6, duration: 3.5 }],
    camera: { shot: 'medium', target: 'doc', yaw: -22, push: 1.12 }
  });
});
```

## Looks

| look | reads as | motion |
|---|---|---|
| lowpoly | faceted 3D cartoon, bold flat colour | every frame |
| felt | fabric with fibres, stitched seams, brass button joints | on twos with gentle boil |
| clay | plasticine with fingerprints | on twos with boil |
| toy | glossy plastic figure | every frame |
| paper | cardstock cut-outs | on threes |

Stop-motion looks step the characters and effects (`steps`), keep the camera smooth, and add a per-step jitter (`boil`).
Pair felt and clay with the `stop-motion` colour grade and warm interior light.

## Cast

- Presets: scientist, soldier, knight, kid, teen-girl, teen-boy, businessman, chef, old-man, hero, astronaut, zombie, farmer, robot.
- Override anything: skin, hair (short, side, spiky, messy, ponytail, bun, long, curly, bald), hat (helmet, cap, hardhat, chef,
  beanie, crown, tophat, straw, space), outfit (casual, labcoat, armor, hoodie, suit, overalls, suit-space, robot), extras
  (goggles, glasses, backpack, cape, beard, mustache), prop and propL (sword, shield, wrench, phone, book, cup, torch,
  flashlight, sign, umbrella, briefcase, flask).
- Give every recurring character the same parameters in every scene so the audience recognises them.
- Place the cast in metres: x left to right, z toward the camera. Keep the hero within x -2 to 2 for medium shots.

## Acting

Actions share the toon vocabulary: walk, run, march, sneak (with `to: x` or `[x, z]`), wave, point, talk, look, shock, jump,
cheer, shrug, nod, shake, think, scared, cry, laugh, angry, yell, crouch, brace, block, attack, punch, throw, fall, fly,
tumble, blown-away (with `height`), hold, raise, hug, sit, dance, turn, type, zap. Each action can set an `expression`
(neutral, happy, sad, angry, worried, shocked, scared, smirk, laugh, determined, sleepy, zombie, love, thinking, yell, excited).

Write every beat as an action card: setup, anticipation (0.15 to 0.3 s), contact, exaggerated consequence, delayed
secondary motion, recovery. Never leave a character idle for more than 2 seconds on screen; give listeners reactions.

## Animals, vehicles and objects

People come from the cast presets. Everything else is a ModelSpec (model-spec-3d skill):
- cast members: `{ id: 'rex', model: 'dog', x: 1, z: 0.5, actions: [{ do: 'walk', at: 0.4, duration: 2, to: [3, 0.5] }, { do: 'wag', at: 2.6, duration: 1 }] }`
- set dressing: `props: [{ model: 'car', x: 3, z: -2, yaw: -70 }, { model: 'tree', x: -3, z: -2, scale: 1.3 }]`
- library: dog, cat, bird, car, tree, house, chair, table, desk-lamp, sofa; write a spec for anything else (a fox, a bicycle, a lighthouse).
Give library models the film's colours with `colors: { coat: '#c98b4e' }`.

## Effects

- lightning: from the Tesla coil by default; `to: 'doc'` zaps a character (pair it with the `zap` action).
- fireball: from the catapult to the castle by default, with trail, impact explosion and catapult swing.
- tornado and debris: cars, rocks, boards, bikes and barrels orbit a funnel; pair with `blown-away`.
- explosion, sparks, confetti, rain, snow, dust, embers.
Effects shake the camera automatically on impacts; set `camera.shake: 0` for calm scenes.

## Camera

`camera: { shot, target, yaw, orbit, push, moves: [{ at, duration, shot, target, yaw }] }`.
Shots: extreme, wide, full, medium, close, extremeclose, low, high, ots. Motivate every move: push in on realisation,
cut wide for scale, low angle for power. In 9:16 the framing widens automatically; keep faces in the upper half.

## Quality bar

- One clear silhouette per shot; the hero faces the camera within 40 degrees for emotional beats.
- Light tells the time: lab (cold blue with coil flashes), sunset battle (warm key, purple sky), day suburb, warm interior.
- Check a contact sheet before rendering: faces readable, no limbs through bodies, effects inside the frame.
