---
name: motion-libraries
description: Load and drive extra JS libraries in a scene (d3, PixiJS, p5, anime.js, Matter physics, Lottie, chroma, simplex noise, Paper.js, flubber morphs, three.js) deterministically, so every frame is a pure function of time. Use when a shot needs data layouts, GPU particles, generative drawing, physics, shape morphing or organic noise beyond GSAP.
stage: animate
tags: [libraries, d3, pixi, p5, anime, matter, physics, lottie, chroma, noise, paper, flubber, three, generative, particles, morph]
version: 1
---

# Motion libraries

GSAP on `tl` stays the backbone. Libraries add capabilities; they never own the clock.
The renderer seeks to arbitrary times in any order, so every library must be drawn from `t`, never from its own
ticker, `requestAnimationFrame`, `Date` or accumulated state.

## Loading
Declare libraries on the scene root. Only these ids load (bundled locally, no network):
`d3 pixi p5 anime matter lottie chroma simplex paper flubber three`
```html
<div class="scene" data-libs="d3 simplex">...</div>
```
Globals: `d3`, `PIXI`, `p5`, `anime`, `Matter`, `lottie`, `chroma`, `SimplexNoise`, `paper`, `flubber`, `THREE`.
Use `onFrame((t) => ...)` (from the ctx) for per-frame drawing; it runs on every seek with scene time `t`.
Build everything once inside `AU.scene`, then only update in `onFrame`.

## d3 (scales, shapes, layouts)
```js
const svg = d3.select('.chart').append('svg').attr('viewBox', '0 0 1000 500').attr('data-layer', 'chart');
const x = d3.scaleBand().domain(data.rows.map((r) => r.k)).range([40, 960]).padding(0.25);
const y = d3.scaleLinear().domain([0, d3.max(data.rows, (r) => r.v)]).range([460, 40]);
svg.selectAll('rect').data(data.rows).join('rect')
  .attr('x', (r) => x(r.k)).attr('width', x.bandwidth()).attr('y', 460).attr('height', 0).attr('fill', 'var(--accent)')
  .each(function (r, i) { tl.to(this, { attr: { y: y(r.v), height: 460 - y(r.v) }, duration: 0.6, ease: 'au.softLand' }, 0.3 + i * 0.08); });
```
Force layouts: run `simulation.stop(); simulation.tick(300)` at build time, then tween to the final positions.

## PixiJS (GPU sprites, particles, filters)
```js
const app = new PIXI.Application({ width: W, height: H, backgroundAlpha: 0, antialias: true, autoStart: false, preserveDrawingBuffer: true });
app.ticker.stop();
$('.gpu').appendChild(app.view);
const dots = Array.from({ length: 400 }, (_, i) => {
  const g = new PIXI.Graphics(); g.beginFill(cssColor('--accent')); g.drawCircle(0, 0, 3 + rand() * 4); g.endFill();
  app.stage.addChild(g); return { g, a: rand() * Math.PI * 2, r: 80 + rand() * 420, s: 0.2 + rand() };
});
onFrame((t) => { dots.forEach((d) => { d.g.x = W / 2 + Math.cos(d.a + t * d.s) * d.r; d.g.y = H / 2 + Math.sin(d.a + t * d.s) * d.r * 0.6; }); app.render(); });
```
Give the canvas holder a `data-layer` and `position:absolute; inset:0`.

## p5 (generative drawing)
```js
let T = 0;
const sketch = new p5((p) => {
  p.setup = () => { p.createCanvas(W, H).parent($('.gen')); p.noLoop(); p.noiseSeed(seed); p.randomSeed(seed); };
  p.draw = () => { p.clear(); p.noFill(); p.stroke(cssColor('--accent')); for (let i = 0; i < 60; i++) p.circle(W / 2, H / 2, 40 + i * 12 + 20 * p.noise(i * 0.1, T)); };
});
onFrame((t) => { T = t; sketch.redraw(); });
```
Never use `frameCount`, `millis()` or `deltaTime`; use `T`.

## anime.js
```js
const a = anime({ targets: '.dot', translateX: 320, delay: anime.stagger(80), duration: 1200, easing: 'easeOutExpo', autoplay: false });
onFrame((t) => a.seek(Math.max(0, t - 0.4) * 1000));
```

## Matter.js (physics, pre-simulated)
```js
const { Engine, Bodies, Composite } = Matter;
const engine = Engine.create();
const els = $$('.ball');
const bodies = els.map((_, i) => Bodies.circle(200 + i * 90, -60 - i * 50, 36, { restitution: 0.6 }));
Composite.add(engine.world, [...bodies, Bodies.rectangle(W / 2, H * 0.8, W, 40, { isStatic: true })]);
const FPS = 60, frames = [];
for (let f = 0; f <= Math.ceil(D * FPS); f++) { frames.push(bodies.map((b) => [b.position.x, b.position.y, b.angle])); Engine.update(engine, 1000 / FPS); }
onFrame((t) => { const fr = frames[Math.min(frames.length - 1, Math.round(t * FPS))]; els.forEach((el, i) => { el.style.transform = `translate(${fr[i][0] - 36}px, ${fr[i][1] - 36}px) rotate(${fr[i][2]}rad)`; }); });
```

## Lottie
```js
const anim = lottie.loadAnimation({ container: $('.lottie'), renderer: 'svg', loop: false, autoplay: false, animationData: data.lottie });
onFrame((t) => anim.goToAndStop(Math.min(anim.totalFrames - 1, t * anim.frameRate), true));
```
Pass the JSON inline through `data`; do not fetch it.

## chroma (colour from tokens)
```js
const scale = chroma.scale([cssColor('--bg-2'), cssColor('--accent')]).mode('oklch');
rows.forEach((el, i) => { el.style.background = scale(i / (rows.length - 1)).hex(); });
```

## simplex noise
```js
const noise = new SimplexNoise(rand);
onFrame((t) => { $$('.blob').forEach((el, i) => { el.style.transform = `translate(${noise.noise2D(i, t * 0.4) * 40}px, ${noise.noise2D(i + 9, t * 0.4) * 40}px)`; }); });
```

## Paper.js (vector scene on canvas)
```js
const canvas = $('.paper'); canvas.width = W; canvas.height = H;
paper.setup(canvas); paper.view.autoUpdate = false;
const wave = new paper.Path({ strokeColor: cssColor('--accent'), strokeWidth: 6 });
for (let i = 0; i <= 24; i++) wave.add(new paper.Point(i * W / 24, H / 2));
onFrame((t) => { wave.segments.forEach((s, i) => { s.point.y = H / 2 + Math.sin(i * 0.5 + t * 2) * 60; }); wave.smooth(); paper.view.update(); });
```

## flubber (shape morphs)
```js
const interp = flubber.interpolate(data.fromPath, data.toPath, { maxSegmentLength: 4 });
onFrame((t) => $('.morph path').setAttribute('d', interp(clamp((t - 1) / 1.2, 0, 1))));
```

## three.js
Prefer `three(selector, (g) => { ...; return (t) => { ... }; })` from the three-d-motion skill; it renders per frame.

## Rules
- Pick libraries only when they add something GSAP cannot; one or two per scene.
- Seed everything with `rand` or `seed`; no `Math.random` for anything visible.
- Canvas and WebGL holders need explicit pixel size (`W`, `H`) and a `data-layer`.
- Keep particle counts sane (under 2000 sprites in Pixi, under 300 DOM nodes).
- Colours from tokens via `cssColor('--accent')`, never literals.
