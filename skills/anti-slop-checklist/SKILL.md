---
name: anti-slop-checklist
description: Ranked list of the tells that make AI motion graphics read as a slide deck or a template, each with a machine check and the fix; run on every storyboard, scene and contact sheet.
stage: qa
tags: [qa, slop, lint, critique, uniqueness]
version: 1
---

# Anti-Slop Checklist

AI video fails in a recognisable way: nobody decided anything. A corner label, a headline on the left,
a card on a flat colour, a fade between every beat. This list merges the slop autopsies of
motionmaxxing (25 ranked default patterns), bang-motion's mechanical PPT tests, cth9191's banned
defaults, HyperFrames' "defaults that look generated" and huashu's per-grammar cautions. Each item has
a test that a linter, the DOM probe or a critic can run, and the fix.

## When to use / not use
- Use: after the storyboard (structural items), after each scene build (code items), on the contact
  sheet (visual items), and before delivery.
- Not a style guide: a deliberate style pack may enable an item (see "Allowed by style" below).

## Core rules
1. A fail is fixed, not argued. Fix the skill or the prompt that caused it when the same tell recurs.
2. Captions are not page chrome. Runtime captions in the caption band are allowed; agent-drawn
   labels in corners are not.
3. Rank: P0 tells (1-8) block delivery; P1 tells (9-20) need a fix or a written reason.

## The ranked list
| # | Tell | Machine test | Fix |
|---|---|---|---|
| 1 | Page chrome: brand name in a corner, "02 / 05" counter, timecode, corner brackets, progress bar, scene label | probe: text box within 12% of two edges and < 3% H tall; regex `/\b\d{2}\s*\/\s*\d{2}\b/`, `REC`, `:\d{2}:\d{2}` | delete; put the information in the picture or the voice |
| 2 | Deck layout: kicker above headline, held left headline block (x < 0.2 W) beside right-side media | probe: two text nodes stacked, smaller one above; text bbox left < 0.2 W held > 1.2 s with media right | one statement + one object; move the camera between them |
| 3 | Three text levels in a shot (eyebrow + title + body/credit) | count distinct font sizes per frame > 2 | max two levels (R2) |
| 4 | Scenes as sections toggled by opacity (>= 3 `<section>`s faded in turn) | lint: >= 3 sibling blocks with only autoAlpha/opacity tweens | the world or camera moves; carry an object across |
| 5 | Everything fades in (opacity-only entries) | lint: share of entry tweens with only opacity > 30% | move: offset/scale/blur decaying over ~12 f; opacity only as a 4-6 f helper |
| 6 | Invented stats, quotes, testimonials, logos | facts check: every number on screen has a fact id | relative bars, skeleton lines, or remove (research-and-fact-grounding) |
| 7 | Dead frames: > 3 consecutive flat frames, or a 0.5 s window without motion | probe motion energy per 0.5 s window (R4) | one living thing: drift 1-3 px/f, creep, caret, light sweep |
| 8 | Unwatched film / self-certified quality | QA report has no frame descriptions | describe every sheet frame in one sentence before judging |
| 9 | Same transition on every cut (fade, scale bump, light leak, zoom-through) | edit plan: one transition kind > 50% of seams, or > 2 plain fades per film (R9) | 3-5 kinds, each caused by something on screen |
| 10 | Ken Burns (scale 1.0 -> 1.05) as the only motion | lint: scene whose only tweens are one scale on an image | parallax layers, a move with a reason, an event on the VO |
| 11 | Every element overshoots (`back.out(1.7)` everywhere) | lint: count of back/elastic eases > 1 in 9 moves | overshoot < 9% of moves, late lean; one visible spring per film |
| 12 | One ease and one duration everywhere (`power2.out`, 0.5-0.6 s) | lint: > 70% of tweens share ease and duration | pick by role from the named eases; median move 0.33 s |
| 13 | Logo or word grows from scale 0 | lint: `scale: 0` start on a `data-layer` with text or logo | arrive from 1.4-5x and decelerate down, or slide in from an edge |
| 14 | Letter-typed headlines with a caret | lint: `typewrite` on an element with font-size >= fs-lg | whole words at speech rhythm; typing only inside a product input |
| 15 | Vibe-coded UI card: rounded card, status dot, "label . value", zinc greys, "Good morning" | probe: card < 0.35 W with dot + two text spans | real product UI, magnified fragment 1.4-4x, or no card |
| 16 | Flat swatch ground per scene, or small card on a void (0.3 W object, 1 s read) | probe: ground luminance variance ~0 and hero area < 9% | ground = light + depth + texture; hero >= 0.55 W or cropped |
| 17 | Name's first association (stars for "Stellar", rocket for "launch", glow for "Spark") | critic question | pick the second or third idea; cover-the-logo test |
| 18 | Slogan copy: one-word triplets, "Not just X. It's Y.", "Unlock", "the future of" | regex on copy | concrete claim with a number or a named thing |
| 19 | Pinned object: same pill or dock at the same coordinates in >= 3 shots | probe across scenes: same bbox +-2% in 3 scenes | a carried object travels and changes scale |
| 20 | Web-footer ending: logo + tagline + button + URL, or end card held > 1.4 s | probe end hold (G3) | end gets smaller; hold 0.6-1.4 s |
| 21 | Breathing, floating or pulsing loops standing in for motion on titles | lint: `ambient(... 'breathe'|'float')` on text layers | titles land and stay dead still; motion moves to the world |
| 22 | Slow creeping push late in a scene with nothing new | camera tween starting after 60% of D with scale delta < 3% | event push (0.9 s ease) on a VO word, or nothing |
| 23 | Click ripple rings and white flashes | lint: expanding circle + opacity 0 within 0.4 s of a press | squeeze 2-6 f to 0.75, target reacts 0-1 f later and brightens |
| 24 | Every title enters the same way (fade + slide up) | lint: identical entry recipe on > 3 consecutive scenes | vary size, entry direction and position scene to scene |
| 25 | Glass card + bokeh blobs + gradient text + blur-in + float: all five | count those five in the film | at most two of the five per film |
| 26 | Same page type >= 3 in a row (big word + sub + tag) | archetype sequence check | insert a number slam, an evidence object, or a camera move into colour |
| 27 | Generic particle burst, glows on UI chrome, centred title on a gradient | lint: particles in > 2 scenes; text-shadow glow on UI | particles only where the subject is particulate; glow only on objects |
| 28 | Miniature: camera so wide the subject is thumb-sized (zoom < 1.08 into a big map) | probe hero area < 4% | stage-sized worlds; shot size changes to the element speaking |
| 29 | Template skeleton: hook text zoom -> 3 feature tiles -> typed input -> promise -> logo -> CTA | storyboard check: >= 2 of these with no concept reason | re-pick the film shape (storyboard-director) |
| 30 | Film fingerprint equals the previous film on < 2 axes | uniqueness fingerprint (R12) | rotate archetypes, transitions, palette accent, type pair |

## Allowed by style (explicit opt-in only)
- HUD frame with corner brackets and a timecode: only when the style pack declares `hud: true`
  (showreel/high-energy promo look); never in explainers.
- Typed headline: only in a "terminal" or "prompt" concept where typing is the subject.
- Heavy overshoot: only in a character/storytime pack, on props and reactions, never on UI.
- Crossfades: calm-brand or "memory/forgetting" meaning, at most 2 plain fades per film (R9).

## Do / Don't
| Do | Don't |
|---|---|
| ask "could this frame be a corporate slide unchanged?" | ship a frame that passes that test |
| know where the eye goes in 0.2 s | put two competing heroes |
| hide all text: ground still interesting but not noisy | let the background beat the type for contrast |
| fix the source prompt when a tell repeats | scold the agent and re-roll |

## In AuteurFrame
- `qa.py` runs items 1-5, 7, 9-16, 19-24 as static lint over the fragment and as probe metrics
  (`AU.probe` already reports off-canvas, outside-safe, text-overlap, low-contrast, minFont).
- Items 6, 17, 18, 25-30 are critic questions on the storyboard and contact sheet.
- Store hits as `qa:N.slop = [{id:13, layer:'title', t:0.2, fix:'start 1.6x, au.snapSettle'}]`.
```js
AU.scene(({ tl, $ }) => {
  tl.fromTo($('.logo'), { scale: 1.8, filter: 'blur(8px)' },
    { scale: 1, filter: 'blur(0px)', duration: 0.6, ease: 'au.snapSettle' }, 0.1);
});
```

## QA checklist
- [ ] No P0 tell (1-8) present.
- [ ] Every P1 tell present has a written reason in the scene note.
- [ ] Uniqueness fingerprint differs from the previous film on >= 2 axes.
- [ ] Each frame described in one sentence before any verdict.

## Sources
- Tejashmakwana/motionmaxxing SKILL.md never-ship list, references/slop.md, gate G5 lint (page chrome C1-C7, D1, P1, T1, V1-V5).
- bangtutorial/bang-motion SKILL.md "Larangan struktural" (8 mechanical PPT tests), references/anti-ppt.md.
- cth9191/animate craft.md banned defaults.
- heygen-com/hyperframes skills/hyperframes/references/motion.md "Defaults that look generated".
- alchaincyf/huashu-art-motion t2_keynote_ui (five-wrapper template warning), y5 (same page type <= 3).
- alexgreensh/anidoodle references/craft-bar.md.
