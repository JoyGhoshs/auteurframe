---
name: stickman-direction
description: Direct stick figure animation with the stickman component - IK-planted feet, distance-driven walks, squash-and-stretch jumps, mood faces, impact bursts and stage shake - and write slapstick beats as action cards (setup, anticipation, contact, consequence, secondary motion, recovery). Use for stickman explainers, meme shorts, minimal line-art stories and fast comedy.
stage: animate
tags: [stickman, stick figure, line art, character, slapstick, comedy, explainer, meme, ik, walk cycle, impact]
version: 1
---

# Stick figure direction

Techniques adapted from the MIT-licensed stickman-video-director project, rebuilt for AuteurFrame's seekable runtime.

## The actor

```js
component('stickman', { x: 20, y: 84, h: 44, style: 'classic', hat: 'beanie', shirt: '#F2C12E',
  actions: [{ do: 'walk', at: 0.2, duration: 1.4, to: 42 }, { do: 'punch', at: 1.8, duration: 0.5 }],
  impacts: [{ at: 2.0, x: 52, y: 52 }] });
```

- Styles: classic (hollow head, ink on paper), filled (white head), chalk (light ink for dark boards), neon (glow), marker.
- Arms are posed by angle; legs are solved with IK, so feet stay planted and never slide during walks.
- Walk and run phase comes from distance travelled: a tween on x drives the feet correctly at any speed.
- Moods: flat, happy, sad, shock, curious, grit (expression names from toon map onto these).
- `fall` holds the body on the ground after the action ends; add `hold: true` to any action to keep its end pose.

## Beat grammar (action card)

Write every gag as: setup, anticipation, contact, exaggerated consequence, delayed secondary motion, recovery.
At 30 fps: anticipation 5 to 9 frames, contact 1 to 3 frames, follow-through 6 to 15 frames.

| beat | stickman actions |
|---|---|
| setup | walk to the mark, look, think |
| anticipation | crouch, small pull back (punch winds up automatically) |
| contact | punch, kick, jump landing, with an `impacts` entry at the contact time |
| consequence | shock or double-take on the receiver, fall |
| secondary | hat or head lags, a nod or shake, the other actor reacts |
| recovery | stand, shrug, cheer |

## Rules

- One event drives picture, camera accent and sound: put the impact time in `impacts` and add a matching sfx clip
  (punch, impact, pop) at the same time.
- Never leave a character idle; a visual change every 2 to 3 seconds.
- The deletion test: if removing a motion changes nothing in the story, remove it. No constant shake.
- Keep limbs readable: avoid arms crossing the face during dialogue; the listener reacts while the speaker talks.
- Minimal line-art look: paper #FDFDFC, faint 64 px grid, ink #1E1C1A, one accent #D7372C, hand-drawn titles.
