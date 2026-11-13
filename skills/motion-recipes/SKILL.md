---
name: motion-recipes
description: A cookbook of concrete, tested motion ideas and code recipes to make every scene feel designed rather than generic; read before writing any scene.
stage: animate
tags: [ideas, recipes, choreography, creativity, gsap, signature move]
version: 1
---

# Motion recipes

Bland scenes come from one move per element: fade in, sit still. Great scenes have a concept, a signature
move, and a hand-off. Before writing code, write three lines:

1. Concept: the visual metaphor (for example "light is a runner that never arrives").
2. Signature move: one choreography a viewer would remember (pick from the bank below or invent one).
3. Hand-off: how the last frame sets up the next scene (shape, colour, position or motion direction).

## Idea bank
| Idea | What happens | When to use |
| --- | --- | --- |
| Mask rise | lines rise out of a clipped band, stagger 0.08 s | any headline |
| Word swap | a key word flips through 3 to 5 alternatives before landing | contrasts, lists |
| Shape becomes type | a circle morphs into the dot of an i, a bar becomes an underline | transitions inside a scene |
| Counter with context | number counts up while a bar or ring fills to the same value | statistics |
| Draw then fill | outline draws with DrawSVG, then fill fades in at 70 percent | diagrams, icons |
| Scale cascade | objects appear at 1x, 10x, 100x with a camera dive | scale comparisons |
| Orbit system | bodies orbit a centre on tilted ellipses, trails fade behind | space, ecosystems, networks |
| Split screen wipe | frame splits on a diagonal, two ideas slide into each half | versus, before and after |
| Kinetic grid | 3x3 grid fills cell by cell on the beat, one cell highlights | features, options |
| Cursor story | a cursor moves, clicks, a UI reacts with a ripple | products |
| Typewriter with caret | text types at 18 to 26 cps, caret blinks, a key word recolours | code, quotes |
| Stamp | a word slams in at 1.6x with a 2 px shake and a pop sound | hooks, emphasis |
| Parallax stack | 3 to 5 layers move at different speeds during a slow push | landscapes, depth |
| Particle gather | dust converges into a shape or word | reveals, titles |
| Light sweep | a soft highlight band passes over type or a card | premium, product |
| Liquid blob | a gooey blob grows behind the hero and wobbles slowly | friendly, soft brands |
| Path follow | an object travels along a drawn path with motionPath | journeys, timelines |
| Page turn | a card flips on Y with perspective to reveal the next fact | sequences |
| Ripple rings | concentric rings expand from an impact point | alerts, launches |
| Ticker tape | a band of words scrolls horizontally behind the hero | news, energy |

## Recipes (AU runtime)
```js
const s = split('.title', { type: 'lines,words', mask: 'lines' });
tl.from(s.lines, { yPercent: 115, duration: 0.8, stagger: 0.08, ease: 'au.softLand' }, 0.2);
```
```js
const words = ['faster', 'cheaper', 'greener'];
words.forEach((w, i) => tl.set('.swap', { textContent: w }, 0.6 + i * 0.28));
tl.fromTo('.swap', { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.25, ease: 'au.snapSettle', repeat: words.length - 1 }, 0.6);
```
```js
tl.to('.blob', { morphSVG: '.target-shape', duration: 0.7, ease: 'au.punch' }, 1.2);
```
```js
counter('.num', 84, { at: 0.5, duration: 1.6, suffix: '%' });
tl.fromTo('.ring circle', { drawSVG: '0%' }, { drawSVG: '84%', duration: 1.6, ease: 'au.softLand' }, 0.5);
```
```js
['.l1', '.l2', '.l3'].forEach((sel, i) => tl.to(sel, { x: -120 * (i + 1), duration: D, ease: 'none' }, 0));
```
```js
tl.fromTo('.sweep', { xPercent: -120 }, { xPercent: 220, duration: 1.1, ease: 'au.glide' }, 1.4);
```
```js
tl.fromTo('.stamp', { scale: 1.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'au.punch' }, 0.4);
tl.to('.scene', { x: 3, duration: 0.04, yoyo: true, repeat: 3, ease: 'none' }, 0.42);
```

## Timing rules
- Hook lands in the first 0.5 s of the first scene. Something new happens every 0.8 to 1.5 s.
- Sync accents to word timings when they are given: the visual accent lands 0 to 2 frames before the word.
- Leave 0.6 to 1.2 s of resolved hold at the end, with only ambient motion.
- Use at most two signature moves per scene; more reads as noise.

## Never
Identical fade-ins for every element, centred text on an empty field for the whole scene, bouncing everything,
random rotation, glow on everything, slow linear moves with no destination.
