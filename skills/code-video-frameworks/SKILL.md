---
name: code-video-frameworks
description: Knowledge base of the main programmatic video frameworks - Remotion, HyperFrames, Motion Canvas, Revideo and Manim - their authoring and timing models, idioms, rendering, licences and typical LLM mistakes, plus how to port their best patterns into an AuteurFrame scene (spring, interpolate, sequences, generator-style timing) and when to render with Manim as an engine. Use when a brief references one of these tools or when choosing an animation technique.
stage: animate
tags: [remotion, hyperframes, motion canvas, revideo, manim, engines, spring, interpolate, sequence, timing, generators]
version: 1
---

# Code video frameworks

All five share one idea: a frame is a function of time. AuteurFrame scenes follow the same contract (paused GSAP timeline,
`onFrame((t) => ...)`), so their patterns port directly. Only Manim runs as an engine here (`render_engine manim`).

## Remotion (React)
- Model: React components; `const frame = useCurrentFrame(); const { fps } = useVideoConfig();` everything derives from `frame`.
- Timing: `interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' })`, `spring({ frame, fps, config: { damping: 200 } })`,
  `<Sequence from={30} durationInFrames={60}>`, `<Series>`, `@remotion/transitions` `<TransitionSeries>`.
- Render: `npx remotion render <entry> <CompositionId> out.mp4` (Node, bundled Chrome, ffmpeg).
- Licence: free for individuals and companies of up to 3 people; larger companies need a company licence.
- LLM mistakes: using CSS animations or `useEffect` timers (flicker in renders), `Math.random()` instead of `random(seed)`.
- Port to AuteurFrame: `AU.interpolate(t, [0, 1], [0, 1], { clamp: true, ease: 'power2.out' })` and
  `AU.spring(t, { at: 0.4, from: 0, to: 1, stiffness: 120, damping: 14 })` inside `onFrame`; a Sequence is a time offset on `tl`.

## HyperFrames (HeyGen)
- Model: plain HTML compositions with clips described by data attributes (start, duration, track), animated with paused
  GSAP timelines registered on a known global; a headless browser seeks the timeline per frame.
- Same family as AuteurFrame: fromTo with explicit start values, finite repeats, hard-kill visibility after exits, no timers.

## Motion Canvas (TypeScript generators)
- Model: `makeScene2D(function* (view) { view.add(<Circle ref={c} size={320} fill="#e13238" />); yield* c().scale(2, 0.6); yield* all(c().fill('#e6a700', 1), c().position.x(300, 1)); yield* waitFor(1); })`.
- Timing reads like a script: `yield*` waits, `all`/`any`/`chain`/`sequence` compose; signals make values reactive.
- Rendering is through its editor in a browser; MIT licence.
- Port to AuteurFrame: build a time cursor and add tweens sequentially:
  `let T = 0.2; const step = (fn, d) => { fn(T); T += d; };` then `tl.to(..., T)`; use `tl.add` labels for `chain`, the same position for `all`.

## Revideo
- A Motion Canvas fork for headless, programmatic rendering: `renderVideo({ projectFile: './src/project.ts', settings: { outFile: 'out.mp4' } })`;
  adds `<Video>` and `<Audio>` nodes and parameterised projects. MIT licence.
- Port: same as Motion Canvas; footage goes through the media tools and the clip component.

## Manim Community (Python)
- Model: `class S(Scene): def construct(self): c = Circle(); self.play(Create(c), run_time=1); self.play(c.animate.shift(RIGHT), run_time=0.8); self.wait(0.5)`.
- Strengths: equations, graphs (`Axes`, `NumberPlane`, `FunctionGraph`), geometry, `Transform`/`ReplacementTransform`,
  `ValueTracker` with `always_redraw` for live values. Text works; `MathTex`/`Tex` need LaTeX, which is not installed here.
- In AuteurFrame: write `scene.py` with one Scene class whose total run time equals the shot, then
  `render_engine manim scene.py` with body `{"scene": "S"}`. The clip is transparent at project size and fps; place it with
  `AU.component('clip', { src: id })` and build captions, titles and transitions around it in scene.html.
- LLM mistakes: run time not matching the shot, using `MathTex` without LaTeX, forgetting `self.wait` at the end, colours that
  ignore the film palette (pass hex colours from the style bible).

## Choosing
| Shot | Best technique |
|---|---|
| Typography, UI, data, transitions | AuteurFrame scene with components and GSAP |
| Mathematical construction, proofs, graphs | Manim engine clip plus AuteurFrame titles |
| Physics, generative fields | scene with matter, simplex, p5 or pixi from motion-libraries |
| Real objects and characters | model3d and character components |
| Footage-led shorts | media tools plus clip, captions and punch-ins |
