---
name: qa-critic
description: Use when reviewing a rendered scene or film (contact sheet, cut strips, probe report) to produce ranked, actionable repair notes and decide pass, repair or escalate.
stage: qa
tags: [qa, critique, review, repair, probe, gates, contact-sheet, verification]
version: 1
---

# QA Critic

The critic's job is to see the film the way a stranger sees it once at full speed on a phone, and
to turn each weakness into an exact change. It is not a scorer. Numbers come from deterministic
checks; eyes judge only what numbers cannot. The research is consistent on this:

- Predicate-level feedback beats pass/fail. In MoVer, final success was about 93.6% with
  predicate feedback, about 77.9% with pass/fail only, and about 71% with no feedback.
- Image pairs beat text alone. In LogoMotion, the repair solve rate by k=4 was 0.96 with image
  context versus 0.82 without.
- VLM judges track humans on design (r = 0.90) but not on coherence (r = 0.55) or flow
  (rho = 0.16). So layout is checked by the DOM probe, not by a model.

## When to use / not use

- Use it after every scene probe, after every scene render, and on the assembled film.
- Use a fresh critic, one that saw none of the building. It gets the storyboard, the sheets and
  the probe report only.
- Do not use it to rewrite the scene yourself. The critic writes notes, and the animator repairs.
- Do not score out of 10. A score finds nothing to fix.

## Core rules

1. **Deterministic first.** Read the probe report before looking at the images. Every
   measurable failure is a P0 or P1 with its number. Never estimate a number by eye.
2. **Describe before judging.** For each sheet frame, write one sentence as a stranger would,
   naming every object, and say what the hero is. An object you would have to explain ("those
   bars are mirrors") is a P0.
3. **Ask the fixed questions.**
   - Does each frame read as what it is?
   - Does the subject separate from the ground?
   - Are crops and contacts right?
   - Is every read long enough?
   - Is anything popping on without a move?
   - Is anything jumping at a cut?
   - Which slop tells are present?
   - With the words covered, do the pictures still tell the story?
   - Is every line readable at 360 px phone width?
4. **Note format.** One line per note:
   `t=4.2s . where . problem -> exact change . what stays`
   - The change is concrete: a selector, a value, a time or an ease.
   - "Make it pop" is not a note.
5. **Severity.**
   - P0: breaks the read or the contract (unreadable, wrong, overflow, a fact without a source, a
     slop tell in the hero shot).
   - P1: weakens the film (a dead stretch, a soft payoff, a seam that jumps, a hold that is too
     short).
   - P2: polish.

   Fix every P0, then the P1s worth their time.
6. **Fix order.**
   1. Broken or untrue.
   2. The idea.
   3. Connections between beats.
   4. Hierarchy and scale.
   5. Timing.
   6. Surface and finish.
   7. Sound.
7. **Repair scope escalates (Code2Video ScopeRefine).** Start with the failing element (selector
   or line, plus or minus 1). Then the block (one beat of the timeline). Then regenerate the whole
   scene from its storyboard. Without scoped repair, runs took 2.5 to 2.8x longer.
8. **Caps.**
   - At most 3 repair rounds per scene. Most gains come by round 2 to 3: in TheoremExplainAgent,
     success went 51% at N=1, 73% at N=2, 86% at N=3 and 93% at N=5.
   - Freeze a scene that passes. Never let a later round regress it.
   - After 3 rounds, escalate to the house archetype fallback and log it.
9. **Route failures to the owner** (Auto-Director). Send each note to the agent that owns it:
   - layout or motion goes to the Scene Animator;
   - a wrong fact goes to the Research Scout and the Screenwriter;
   - palette drift goes to the Art Director;
   - caption timing goes to Subtitle Sync.
10. **Pass threshold.** A scene passes when every gate passes, it has no P0, and it rates at least
    4 out of 5 on both "reads as intended" and "on bible". That is a gate decision, not a score
    to report.
11. **Critique, correct, verify (FilmAgent).** After a repair, the critic verifies that each note
    was addressed. The check compares before and after frames for that note only.
12. **Overflow gets variants, not rewrites (Paper2Video).** When text overflows or is cramped,
    render parametric variants (font scale 1.0, 0.92, 0.85, or figure scale 1.0, 0.75, 0.5) and
    pick the one that passes. Never shrink below `--fs-min`. If no variant passes, split the beat.

## Probe report fields and gates

| Field | Pass | Gate / rule |
|---|---|---|
| decodes, non-blank, length = plan +/- 1 frame | yes | G0 |
| readable proof text | >= 4% H, fragment >= 0.55 W | G1 |
| motion energy per 0.5 s window | > 0 every window; no run > 3 flat frames | G2, R4 |
| end hold | 0.6-1.4 s, final shot <= 25% of film | G3, R5 |
| hero count | 1; two panels only if >= 2x area or camera moves | G4, R1 |
| page chrome lint | no corner labels, counters, timecodes, kicker, progress bar | G5 |
| type levels / min type | <= 2 levels, >= `--fs-min` | R2 |
| ease audit | named eases only, overshoot < 9% | R3 |
| ambient on ground | ground moves | R6 |
| palette | <= 5 + accent from the bible | R7, R8 |
| plain fades between scenes | <= 2 per film | R9 |
| overflow / off-canvas | none unless `data-allow-offstage` | R10, R11 |
| contrast | >= 4.5:1 body text, >= 3:1 large | R7 |
| line_unread | life >= max(0.7 s, 0.5 s + 0.3 s/word) | captions |
| dead_stretch | nothing new for > 3 s (hold flagged `data-hold` exempt) | R4 |
| fingerprint | differs from the previous film on >= 2 axes | R12 |

## Do / Don't

| Do | Don't |
|---|---|
| Quote probe numbers in the note | "looks a bit crowded" |
| Name selector, time and value | "improve the typography" |
| One note per problem, ranked P0-P2 | a 30-item unranked wall |
| Send target-vs-actual crops with layout notes | text-only description of a visual bug |
| Freeze passing scenes | re-roll the whole film for one bad scene |
| Use a fresh critic each round | let the builder grade itself |
| Say what was not checked (sound was measured, not heard) | certify the film as good |

## Recipe 1: repair prompt template

```
SCENE {n} REPAIR ROUND {k}/3. Keep everything not listed below exactly as is.
FAILED PREDICATES (from probe, frames listed):
- overlap(.label-2, .bar-3) on frames 41-63 (t=1.37-2.10s), area 18%
- below_floor(.axis-note) 22px < fs-min 35px
- dead_window(t=3.5-4.0s): motion energy 0
CRITIC NOTES:
- t=2.0s . bar label . collides with bar 3 -> move label to cell C9, x+40px . keep bar timing
IMAGES: [target_vs_actual_t2.0.png]
SCOPE: element-level (selectors above). Do not change palette, copy or durations.
RETURN: the full corrected fragment.
```

## Recipe 2: qa:N output schema

```json
{"scene": 4, "round": 2, "verdict": "repair",
 "gates": {"G0": "pass", "G1": "pass", "G2": "fail", "G3": "pass", "G4": "pass", "G5": "pass"},
 "rules": {"R4": {"fail": [[3.5, 4.0]]}, "R11": "pass"},
 "frames": [{"t": 1.2, "describe": "Orange bar chart rising on cream paper; hero is the tallest bar."}],
 "notes": [{"sev": "P0", "t": 3.6, "where": ".world", "problem": "no motion 0.5 s",
            "change": "add AU.camera push scale 1.0->1.06 at 3.4 dur 0.9 au.glide",
            "keep": "chart timing", "owner": "animator"}],
 "verified_previous": [{"note": "label overlap", "fixed": true}],
 "unchecked": ["sound heard by a human"]}
```

## In AuteurFrame

- Inputs: the blackboard keys `scene:N` (fragment and storyboard row), `render:N` (sheet, strips,
  phone sheet) and `probe:N`. The output goes to `qa:N`. Use the schema above.
- `qa.py` runs static lint (URLs, timers, `Date.now`, missing `data-layer`, eases not registered as
  `au.*`) before any render. A lint fail never reaches the critic.
- Repairs keep the contract: all motion on `tl` or `AU.onFrame`, overshoot < 9%, landings on
  `au.softLand/au.snapSettle/au.glide`, exits on `au.exit`.
- Typical dead-window fix inside a scene:

```js
AU.scene(({ tl, D, $ }) => {
  AU.camera({ at: D * 0.55, scale: 1.06, duration: 0.9, ease: 'au.glide' });
  AU.ambient($('.ground'), 'drift');
});
```

## QA checklist

- [ ] The probe report was read first. Every failing metric is a note with its number.
- [ ] Every sheet frame has a one-sentence description.
- [ ] Notes use the `t . where . problem -> change . keep` format, ranked P0-P2, each with an owner.
- [ ] No numeric score is given anywhere.
- [ ] Previous-round notes are verified individually.
- [ ] The round count is <= 3; passing scenes are frozen.
- [ ] Unchecked items are listed honestly.

## Sources

- HyperFrames review.md (P0/P1/P2 note format, describe each beat, never score, fresh
  sub-agent): github.com/heygen-com/hyperframes
- motionmaxxing SKILL.md (gates G0-G5, fix order, self-certification ban): github.com/Tejashmakwana/motionmaxxing
- MoVer: arxiv.org/abs/2502.13372
- LogoMotion: arxiv.org/abs/2405.07065
- Code2Video ScopeRefine and critic: arxiv.org/abs/2510.01174
- TheoremExplainAgent retry curve: arxiv.org/abs/2502.19400
- FilmAgent Critique-Correct-Verify, 3 rounds: arxiv.org/abs/2501.12909
- PPTAgent PPTEval judge agreement: arxiv.org/abs/2501.03936
- Paper2Video tree-search layout variants: arxiv.org/abs/2510.05096
- Auto-Director critic threshold and freeze: arxiv.org/abs/2610.28346
- anidoodle review (fresh critic, max 3 rounds): github.com/alexgreensh/anidoodle
