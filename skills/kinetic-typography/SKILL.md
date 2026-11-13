---
name: kinetic-typography
description: Use when words are the picture: titles, claims, quotes, lists, numbers, chapter cards, lyric or voice-synced type.
stage: animate
tags: [typography, kinetic-type, titles, counters, emphasis]
version: 1
---

# Kinetic Typography

Type as an actor. Each key word lands on a stress (a beat or a spoken syllable), the main word is big enough to read in 0.3 s, supporting words rise from a slot to give the ear a counterpoint, and once a word lands it holds still while the camera, ground or the next element carries motion. This skill gives the size ladder, cadence, entrance menu, emphasis devices, holds and counters. Numbers are from huashu y5 (kinetic type card), motionmaxxing type.md, bang-motion techniques section 1 and HyperFrames motion.md. Base timing and eases are in motion-rules-core.

## When to use / not use

- Use for: openers, chapter cards, a quote or one-line conclusion, "3 reasons" structure, a single number, a stressed spoken word ("not code, **intent**").
- Do not use for: whole segments over 30-60 s (viewers read instead of listening); lists of more than 5 items (use an infographic); emotional story beats (use a character).
- Rule of thumb: every 2 type pages insert a non-type page (evidence object, number slam, image).

## Core rules

1. **One focal word per screen.** Main word <= 4 characters per "slot" is ideal (CJK 2 chars); support line <= 14 characters (CJK) or <= 6 words. Over the limit: split the page, never shrink the type.
2. **Size ladder main : support : label = 3.4 : 1 : 0.4** (huashu: 340 / 96 / 40 px at 1080p). In mixed frames: sentence 6.5-8% H vs number 22-29% H (~3.5x). Headlines 7-11% H (9% typical). Readable text >= 4% H; under 2% H is texture.
3. **Sentence case, weight 500-600.** ALL CAPS + 800 + wide face is allowed for ONE emphasis scene per film. Hierarchy by size, not by weight. No period on headlines of <= 4 words unless it changes meaning.
4. **Word cadence follows speech.** Whole words 2-12 f apart: 2-4 f hooks, 4-6 f headlines, 8-12 f voice-led. With no voice: base gap 0.07-0.12 s (hook), 0.12-0.20 s (headline), +/-40% jitter; never a metronome. Only a technical ident may use a constant 10 f interval.
5. **Whole words, never letter typing for headlines.** Letter-by-letter only inside a product's own input field, with a hand-authored rhythm (bursts of 1 f letters, 6-10 f pause after a space, a slower last word, caret steady during typing, blinking only at rest).
6. **Entrance by importance (huashu y5):**
   - main word SLAM: from 1.7x to 1.0, opacity 0 -> 1 in the first 0.06 s, damped spring settling in ~0.35 s with overshoot capped < 9% in AuteurFrame;
   - support and labels SLOT RISE: in a mask below the baseline from +1.2 line-height to 0, expo-out 0.30-0.35 s;
   - numbers, icons, bubbles POP: scale in 0.30-0.42 s (cap overshoot to < 9%; the source used 17-20%, too much for AuteurFrame);
   - cards SLIDE: from +700 px or +260 px below with 3.4 deg rotation returning, expo-out 0.40 s.
7. **Exits are faster than entries.** 0.18 s ease-in, 0.03 s stagger, scale to 0.6 and drop 60 px while fading (huashu); or one word per frame, 3-4 f each, up 0.07 H, overlapping the next entrance by ~2 f (motionmaxxing). Bang-motion asymmetry: in 0.7-1.3 s power4.out, out 0.35-0.55 s power2.in.
8. **Words do not float after landing.** Pin after ~0.35 s. Motion lives elsewhere: camera micro-drift (two sines, 5 px amplitude, periods ~7 s and 2.7 s, +/-0.5 deg), beat bump (whole frame +1.2% on each quarter beat, e^(-25t) decay ~0.12 s), dot-grid ground drifting 36 px/s.
9. **Accent colour on arrival.** A new word wears the single accent for 0.04-0.33 s (sweet spot 0.13-0.28 s) then decays to ink. Second signal colour only for "done" (green). Colour then means "arriving".
10. **Reveal-point offset (the most valuable sync rule).** A transition's stress is the frame the new picture appears, not its first frame. Start = barline - p x duration, where p is the reveal point (fillZoom p 0.55, bands p ~0.6, push p ~0.58 because the eye reads 90% displacement as "arrived"). Same for word slams: the word must be readable on the stressed syllable, so start the tween ~0.06-0.10 s early. Picture may lead sound by at most 1 frame (EBU R37: audio lead <= 40 ms, lag <= 60 ms).
11. **Holds.** Phrase hold after the last word is whole: 0.2 s per word for 2-5 words (3 words 0.6-0.9 s), 1.7-2.0 s for 6-8 words on two lines, single number 0.5-1.2 s; floor 0.45 s only when voice carries it. HyperFrames: 0.5 s + 0.3 s per word, film's last line >= 2 s. anidoodle: max(0.7 s, 0.3 s/word).
12. **Consecutive scenes differ** in at least size class, entry direction and position. Same page type at most 3 in a row.

### Emphasis menu (pick ONE per film; "none" is valid)

| Device | Feel | Fits | Build |
|---|---|---|---|
| none: dim-to-full, size, pause | calm | SaaS, AI, minimal | words grey -> ink 0.07-0.1 s apart |
| pill | firm, digital | apps, tech | block scaleX 0 -> 1 from left, 0.5 s power3.out |
| underline | editorial | finance, journalism | bar 0.14 em draws L -> R 0.30 s, 1-3 eighth notes after the word |
| marker | warm, human | education | skewed swipe (slope 0.18), 55% opacity, multiply |
| box | technical | dev tools | outline draws around word |
| color | luxury | fashion | only the word's colour changes |
| strike | ironic before/after | "not X but Y" | line crosses, replacement word lands |

Start any highlight only after the line is readable (0.4-0.6 s after entry). Emphasised keyword may scale to 1.35x on the stress beat and pin there.

### Counters

- Hero number: one value per frame, step sizes decaying, 15-23 steps over 0.5-0.9 s; or ease-out-expo 0.9-1.3 s. Tabular figures always.
- Hero claim lands on a round value (10%, 100); product data on an un-round value (522.14) - round reads as claim, un-round as real.
- Proof-texture numbers appear complete, no count-up. Count each number once; reuse it later without recounting.
- A finale counter may park on 99 for ~5 f before 100.

## Do / Don't

| Don't | Do |
|---|---|
| Every title ALL CAPS 800 centred with the same letter stagger | Sentence case 500-600, vary size/direction/position per scene |
| Type the headline with a caret | Whole words on speech rhythm |
| Words drift and breathe while being read | Land, pin, move the camera or ground instead |
| Highlight on every sentence | One device per film, not every line |
| Kicker + title + body (3 text levels) | Max 2 levels: one big line + one label |
| Fade + slide-up on every title | Rotate entrances: blur-per-word, grey-to-ink, slot rise, slam, slot-machine roll |
| Glow on titles | Clean ink, thin shadow; glow only on objects |

## Recipe: slot rise and slam (plain GSAP + CSS)

```html
<h1 class="line"><span class="slot"><span class="w">Ship</span></span> <span class="slot"><span class="w">faster</span></span></h1>
<style>.slot{display:inline-block;overflow:hidden;vertical-align:bottom}.w{display:inline-block}</style>
<script>
const tl = gsap.timeline({ paused: true });
const ws = document.querySelectorAll('.w'), gaps = [0, 0.14];
ws.forEach((w, i) => tl.fromTo(w, { yPercent: 120 }, { yPercent: 0, duration: 0.32, ease: 'expo.out' }, 0.3 + gaps[i]));
tl.fromTo('.hero', { scale: 1.7, opacity: 0 }, { scale: 1, duration: 0.35, ease: 'expo.out' }, 1.0);
tl.to('.hero', { opacity: 1, duration: 0.06, ease: 'none' }, 1.0);
</script>
```

## In AuteurFrame

- `AU.split(el, { type: 'words' })` (or 'chars', 'lines') returns spans; give the parent `data-layer`. Use `AU.counter(el, to, { from, decimals, prefix, suffix, at, duration })` for counts; `AU.typewrite` only for in-product input fields; `AU.scramble` for one ident per film at most.
- Word onsets come from `ctx.cues[i].words[j].t` (scene-local seconds). Land each stressed word at `t - 0.08`.
- Sizes from tokens: main `--fs-xl`, support `--fs-md`, label `--fs-sm`; never below `--fs-min` (R2: >= 3.2% of short side, max two type levels per shot).
- Captions are injected by the runtime; never duplicate the caption as on-screen type in the same window.

```html
<h1 class="claim" data-layer="claim">Rivers move <span class="k">cities</span></h1>
<style>.claim{font:560 var(--fs-xl)/1.02 var(--font-display);color:var(--ink);letter-spacing:-.015em}.k{color:var(--ink)}</style>
<script>
AU.scene(({ tl, D, cues, $ }) => {
  const words = AU.split($('.claim'), { type: 'words' });
  const ts = (cues[0] && cues[0].words.length >= words.length) ? cues[0].words.map(w => Math.max(0, w.t - 0.08)) : words.map((_, i) => 0.2 + i * 0.13);
  words.forEach((w, i) => tl.fromTo(w, { yPercent: 70, opacity: 0.2 }, { yPercent: 0, opacity: 1, duration: 0.4, ease: 'au.softLand' }, ts[i]));
  const k = $('.k');
  tl.fromTo(k, { color: 'var(--accent)' }, { color: 'var(--ink)', duration: 0.24, ease: 'au.linear' }, ts[2] + 0.4);
  tl.to($('.claim'), { x: -24, duration: D - 2, ease: 'au.drift' }, 1.2);
  tl.to(words, { yPercent: -80, opacity: 0, duration: 0.14, stagger: 0.03, ease: 'au.exit' }, D - 0.9);
});
</script>
```

## QA checklist

- [ ] Main word readable in 0.3 s (<= 4 chars or 1-2 words) and >= 3x the support line.
- [ ] Every stressed word lands within 1 frame before its spoken syllable or beat.
- [ ] Transitions timed by reveal point, not first frame.
- [ ] No word moves after landing except with the camera group.
- [ ] Hold per phrase >= 0.2 s/word (>= 0.5 s + 0.3 s/word for sentences).
- [ ] One emphasis device in the film; one accent colour.
- [ ] No headline typed letter by letter; no kicker over headline.
- [ ] Counters use tabular figures and land round for claims, un-round for data.

## Sources

- huashu-art-motion references/动画语法/y5_kinetic_type.md (size ladder, slam, slot rise, reveal-point offset, EBU R37) - github.com/alchaincyf/huashu-art-motion
- motionmaxxing references/type.md R2-R11 (cadence, accent, typing, counters, holds)
- bangtutorial/bang-motion references/techniques.md section 1, anti-ppt.md (emphasis menu, asymmetric in/out)
- HyperFrames skills/hyperframes/references/motion.md (title entrance variants, holds)
- anidoodle references/craft-bar.md (max(0.7 s, 0.3 s/word))
- School of Motion kinetic typography parts 2-3; Lee, Forlizzi, Hudson, The Kinetic Typography Engine (UIST 2002)
- Netflix Timed Text Style Guide (20 CPS adult reading ceiling)
