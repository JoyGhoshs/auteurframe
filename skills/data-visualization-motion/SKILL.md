---
name: data-visualization-motion
description: Use when a scene shows numbers: bar, line, donut, ranking race, big number or comparison, and it must animate honestly and readably.
stage: animate
tags: [data, charts, numbers, infographics, counters]
version: 1
---

# Data Visualization Motion

A chart in a video has one job: make one finding land at the moment the voice names it. Build the frame of reference first, let the data grow out of it, mark exactly one thing, and never let animation change what the numbers say. Staging, timing and honesty rules below come from huashu t3 (finance chart card), Heer and Robertson 2007 (animated transitions in statistical graphics), Amini et al. 2015 (data video structure), motionmaxxing counters and Barty-Bart's "never invent numbers" rule.

## When to use / not use

- Use: a sourced number, trend, ranking, share or comparison that the narration states.
- Not: when you have no sourced data. Use relative bars without values, a skeleton, or a different visual. Never invent figures.
- Not: more than one finding per chart. Write the finding as the chart title; if you cannot, use a single big number instead.

## Core rules

1. **One finding per chart.** The title is the conclusion ("Revenue grew to 8.7x in five years"), the subtitle is metric and unit ("annual revenue, $bn"), the source sits bottom-left. Ratios in the title must be computable from the numbers shown (107.9 / 12.4 = 8.70). "Grew to" vs "grew by" are different claims.
2. **Staging order.** Layout 0-0.5 s -> gridlines draw L -> R (lag 0.12, ease-out-quint) -> axis labels fade-rise in sequence -> data -> accent colour change -> annotation. Each stage 0.5-1.3 s; about 1 s per step for a complex change (Heer and Robertson: stage complex transitions, ease in and out).
3. **Bars** grow from the zero baseline, ease-out-quint, staggered (lag 0.22, whole set ~1.3 s); value labels ride the bar tops and count in sync. If the voice names bars one by one, each bar grows when named, not all at second 0.
4. **Lines** draw by x (time), not by arc length: time flows evenly so a steep segment draws fast and reads as a surge. 1.5-2 s in video (D3's 5 s linear is for standalone pages). A 9 px head dot with a tabular value label follows the tip; area fill at alpha 0.14 -> 0.
5. **Annotate one thing.** Trigger the annotation when the line head passes the event (compute tHit from the inverse ease): dot pops (no overshoot over 9%), pulse ring, leader line draws 0.12 s later, text fades in 0.3 s after that.
6. **Count-up** 0.9-1.3 s ease-out-expo (or one value per frame with decaying steps, 15-23 steps), tabular figures (`font-variant-numeric: tabular-nums`), and the number must be at its final value exactly when the voice says it: count start = spoken time - count duration. Hold >= 0.5 s after landing. Count each number once.
7. **Colour.** One accent for the protagonist series, everything else grey (`--muted`). Same entity, same colour across every chart in the film.
8. **Honesty.** Bars start at 0. A non-zero axis is stated in the subtitle. Units and source on the chart. Do not morph between different metrics (revenue bars into a share-price line implies one scale). Rescale axes first (old ticks out, new in), then move the data. When the same data changes form (bars -> dots -> line) move first, then change shape.
9. **Ranking race.** Keyframe every 250 ms with ~10 interpolated frames between, show ~12 bars, rank swaps take ~0.5 s, stagger swaps so not all bars jump at once.
10. **Chart lives in the film's world.** Same ground and ink as neighbouring scenes; a white report chart in a night film breaks continuity. Better: draw the chart onto a surface in the world (a screen, a board, a page).
11. **Camera holds after the data lands** (no linear creep); push ~1 s to the datum the voice names; a 0.28 s fast push only for the single most important number.
12. **Do not repeat the same layout > 2 charts in a row**; interleave a big number slam, a zoom-through to a detail or real footage.
13. **Big number slide.** Hero numerals 22-29% H with label 6.5-8% H; claim ends on a round value, product data on an un-round one. Two compared quantities share height and baseline.
14. **Data video arc** (Amini 2015, 50 professional data videos): establisher -> initial -> peak -> release.

## Do / Don't

| Don't | Do |
|---|---|
| Title + all bars grow at t=0 + no annotation | Axes, then data on cue, then one annotation |
| Rainbow series | One accent, rest grey |
| Draw a line by stroke-dasharray at constant arc speed | Reveal by x with a clip rect |
| Counter tween with proportional digits (jitter) | Tabular figures, final value on the spoken word |
| Morph revenue into stock price | Cut or wipe between different metrics |
| Truncated y-axis without saying so | Bars from 0; disclose non-zero baselines |
| Invented "+312%" | Only sourced numbers with a fact id |

## Recipe: bars and line by x (plain SVG + GSAP)

```js
const bars = [...document.querySelectorAll('.bar')];          // rects with transform-origin at baseline
tl.fromTo('.grid line', { scaleX: 0, transformOrigin: '0 50%' }, { scaleX: 1, duration: 0.5, stagger: 0.12, ease: 'power4.out' }, 0.2);
bars.forEach((b, i) => tl.fromTo(b, { scaleY: 0, transformOrigin: '50% 100%' }, { scaleY: 1, duration: 0.8, ease: 'power4.out' }, 0.9 + i * 0.22));
// line by x: animate a clipPath rect width, head dot follows f(x)
const clip = document.querySelector('#clip rect'), head = document.querySelector('#head');
const p = { x: 0 };
tl.to(p, { x: 1, duration: 1.6, ease: 'sine.inOut', onUpdate: () => {
  clip.setAttribute('width', p.x * plotW);
  const y = yAt(p.x);                                    // interpolate data at this x
  head.setAttribute('cx', x0 + p.x * plotW); head.setAttribute('cy', y);
} }, 2.4);
```

## In AuteurFrame

- Use `AU.chart.bar(el, data, opts)`, `AU.chart.line(el, data, opts)`, `AU.chart.donut(el, data, opts)`; they return element groups (axes, grid, marks, labels) for you to sequence on `tl`. Use `AU.counter(el, to, { from, decimals, prefix, suffix, at, duration })` with `at = spokenT - duration`.
- `ctx.data` carries `{ values, unit, source, factIds }`. If `factIds` is empty, the chart must not show absolute values (research-and-fact-grounding).
- Spoken time of the number: find the word in `ctx.cues[].words` whose text matches the digits/words of the value.

```html
<figure class="chart" data-layer="chart"><svg class="plot" data-layer="plot"></svg>
<figcaption class="src" data-layer="src"></figcaption></figure>
<div class="big" data-layer="big">0</div>
<script>
AU.scene(({ tl, D, data, cues, $ }) => {
  const c = AU.chart.bar($('.plot'), data.values, { unit: data.unit, highlight: data.highlight, grey: 'var(--muted)', accent: 'var(--accent)' });
  $('.src').textContent = 'Source: ' + data.source;
  tl.fromTo(c.grid, { scaleX: 0 }, { scaleX: 1, duration: 0.5, stagger: 0.12, ease: 'au.softLand' }, 0.2);
  tl.fromTo(c.bars, { scaleY: 0 }, { scaleY: 1, duration: 0.8, stagger: 0.22, ease: 'au.softLand' }, 0.8);
  const w = cues.flatMap(q => q.words).find(x => /8\.7|eight/i.test(x.w));
  const say = w ? w.t : 2.6;
  AU.counter($('.big'), 8.7, { from: 1, decimals: 1, suffix: 'x', at: say - 1.1, duration: 1.1 });
  AU.camera({ at: say + 0.2, x: c.highlightX, y: c.highlightY, scale: 1.35, duration: 1.0, ease: 'au.glide' });
});
</script>
```

## QA checklist

- [ ] Title is the finding; unit and source visible; every absolute number has a fact id.
- [ ] Axes/grid appear before data; data appears on its spoken cue.
- [ ] Bars from 0 or baseline disclosed; no morph between different metrics.
- [ ] One annotation per chart; one accent series.
- [ ] Counters tabular, land on the spoken word (+/- 1 frame), hold >= 0.5 s.
- [ ] Ratios in titles reproducible from shown values (critic recomputes).
- [ ] Chart ground matches neighbour scenes.

## Sources

- huashu-art-motion references/动画语法/t3_finance_chart.md (staging, lags, line by x, annotation timing, honesty) - github.com/alchaincyf/huashu-art-motion
- Heer and Robertson, Animated Transitions in Statistical Data Graphics, IEEE InfoVis 2007
- Amini et al., Understanding Data Videos, CHI 2015
- motionmaxxing references/type.md R8.1-R8.9 (counters), layout.md R4.2
- D3 bar chart race example (250 ms keyframes): observablehq.com/@d3/bar-chart-race
- Barty-Bart/motion-graphics explainer-high-energy (never invent numbers)
- CountUp.js default easeOutExpo
