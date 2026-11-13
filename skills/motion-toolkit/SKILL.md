---
name: motion-toolkit
description: How to build a scene with the full AuteurFrame toolkit instead of code alone - ready-made components (titles, lower thirds, callouts, highlights, charts, steps, chat, cursor, device, follow, particles, logo sting, split compare), 2D characters and mascots, sprites, real 3D models, Lottie, media editing tools and external engines - and how to combine them with bespoke GSAP code. Read first when planning any scene.
stage: animate
tags: [components, toolkit, tools, characters, 3d, models, media, engines, workflow, professional]
version: 1
---

# Motion toolkit

A professional motion designer does not hand-draw every lower third. They pull a tuned template, then spend their
craft on the one move that makes the shot unique. Work the same way.

## The instruments
| Need | Instrument | How |
|---|---|---|
| Headline, kicker, subtitle | `title` component | `add_component title {"text": "The ocean *breathes*", "style": "mask"}` |
| Name and role | `lower-third` | interviews, experts, places |
| Point at something | `callout`, `highlight`, `cursor` | callout a diagram part, circle a word, click a UI |
| Numbers | `stat`, `bar-chart`, `line-chart`, `donut`, `progress` | data with counting and growth built in |
| Explain a process | `steps`, `list`, `split-compare`, `quote` | sequences, comparisons, testimony |
| Product and UI | `device`, `chat`, `cursor`, `follow`, `logo-sting` | app demos, messages, CTAs, brand |
| People and creatures | `character`, `mascot`, `sprite` | acting, walking, talking explainers |
| Real objects | `model3d` + `search_models`/`import_model` | rigged characters walk/idle/run; props, vehicles, buildings |
| Atmosphere | `particles`, `light-sweep` | stars, dust, bokeh, embers, shine |
| Footage | `media` tools + `import_media` + `clip` | cut, reframe, ramp, grade real video, then composite |
| Precise math | `render_engine manim` + `clip` | equations as Text, graphs, constructions |
| Anything bespoke | your own GSAP/HTML/canvas/WebGL code | the signature move |

## Workflow
1. `list_components` with words from the shot ("data growth", "character explains", "ui demo").
2. `component_info <name>` for the exact parameters before using it. Never guess parameter names.
3. Lay out the scene with components (`add_component` or `AU.component(name, params)` inside your script).
   Components return `{ el, end }`: keep `el` to animate it further with `tl` (camera pushes, parallax, exits).
4. Write the bespoke part in the same `AU.scene` script: the transition into the next scene, a custom reveal,
   a drawn connection between components, a camera move across them.
5. `preview`, read the layout and QA issues, adjust positions (`x`, `y`, `w`, `h` in % of the frame), `finish`.

## Combining rules
- One hero per moment: if a character speaks, the chart waits; stagger component `at` times so the eye has one target.
- Place on a grid: keep components inside the safe area; leave the caption band free (bottom 18% vertical, 12% wide).
- Theme everything: components already use `--accent`, `--ink`, `--font-display`; pass colours as tokens (`"--accent-2"`).
- Time to speech: start components on the word that names them (word timings are in the task).
- Give every scene its own signature: never ship a scene that is only a stack of components with default timing.
- Reuse is fine inside a film (same lower-third style) but vary the hero device across scenes.

## Working method borrowed from the best agent video projects
- Prove one look first: get the hero frame right in preview before animating everything (anidoodle).
- Determinism is the contract: every frame is a pure function of `t`; seek out of order in preview to check (animlang, HyperFrames).
- Look at the result, do not trust the code: read preview layout and errors after every substantial change (ffmpeg-skill's check-then-look loop).
