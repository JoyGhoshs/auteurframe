---
name: sound-and-rhythm
description: Beat grids, voice-led timing, sound-effect placement and mix targets for motion graphics; use when timing picture to music or narration or when placing SFX and mixing.
stage: edit
tags: [audio, music, sfx, beat-grid, mix, sync]
version: 1
---

# Sound and Rhythm

The clock of a film is either the music grid or the voice. Picture changes land on that clock, sound
effects mark the few events that deserve them, and the mix is measured, never judged by "feel". You
cannot hear the result: measure it and hand a human the riskiest timestamps.

## When to use / not use
- Use: choosing the film clock, snapping cuts and hits, writing the cue list, mixing.
- Not for caption timing (subtitle-sync) or visual transition design (transitions-and-continuity).

## Core rules
1. One clock per film section: music grid OR voice. With narration the voice is the clock and the
   music sits 20-25 dB under it; the beat grid is dropped.
2. Beat math: frames per beat = fps * 60 / BPM. Compute beat k as `round(k * fps * 60 / BPM)`; never
   add a rounded beat repeatedly (128 BPM at 30 fps drifts 2 frames in 32 beats).
3. Whole-frame grids: 24 fps + 120 BPM -> beat 12 f, 8th 6 f, 16th 3 f. 30 fps -> 112.5 BPM gives a
   16 f beat, 8 f 8th. 60 fps + 120 BPM -> 8th 15 f (stay on 8ths; a 16th is 7.5 f).
4. Cut on the beat, change layout on the bar. Big hits on downbeats, type on 8ths/16ths.
5. Transition reveal on the bar: start = barline - p_reveal * duration (p_reveal = the progress at which
   the new picture is visibly in place, about 0.55-0.6 for zoom-through/bands, ~0.58 for an
   expoInOut push measured at 90% travel).
6. Voice-led: a picture change starts ~0.2-0.4 s after a sentence ends, or on the stressed word.
   On-screen words land 0-2 frames BEFORE they are heard; picture early beats picture late
   (broadcast tolerance EBU R37: audio may lead by <= 40 ms, lag by <= 60 ms).
7. Payoff: silence (a 15-35 dB drop for 0.5-4 s on a held picture) before the loudest single hit. The
   busiest moment is not the loudest; the loudest hit marks the turn. With VO, land the payoff hit
   in the pause before the line that names it.
8. SFX: one sound per cue, real recorded files (no oscillator beeps as SFX), vary takes. At most one
   riser and one big impact per film.
9. Mix priority voice > SFX > music. Music bed ~-12 dB under SFX, ducked 8-12 dB under VO (sidechain).
10. Loudness: social/web master -16 LUFS integrated, true peak <= -1 dBTP (safer -2 to -4 dBTP for
    AAC on phone speakers); streaming platforms normalise near -14 LUFS. Measure the exported MP4.
11. Never write "it sounds good". Report LUFS, true peak, cut-to-beat error per cut in ms, and the 5
    riskiest timestamps (largest beat error, risers, typing loops, the payoff) for a human to check.

## SFX cue table
| Visual event | Category | Placement |
|---|---|---|
| camera move, slide, whip | whoosh | starts 2 frames early, length matches the move |
| scene cut | short whoosh or none | 2 frames early |
| element appears (pop) | pop | on the frame |
| cursor click / press | click | on the squeeze frame |
| typing | typing loop | trimmed to the typing span, quiet |
| build-up | riser | ENDS on the next hit |
| reveal / payoff | impact (sub + noise) | the loudest SFX, on the frame |
| success / check | soft pop or ding | on the frame |
| small UI tick | tick | very quiet |

## Do / Don't
| Do | Don't |
|---|---|
| derive grid from tempo measured on the actual track | trust a beat tracker blindly (it can lock to the off-beat) |
| low-pass the music < 120 Hz and overlay beat lines for 4 bars to verify | assume beat 1 is at 0.0 s |
| shift the music start to minimise cut-to-beat error when timing is locked | stretch the picture to fit a wrong grid |
| hard stop before silence (all events end, dry sends) | let a reverb tail fill the silence |
| measure stereo and mono loudness | judge a mix from the WAV before AAC encode |

## Recipes
Beat times and nearest-beat snapping:
```js
const beatF = (k, fps, bpm) => Math.round(k * fps * 60 / bpm);
const snap = (tSec, fps, bpm) => { const k = Math.round(tSec * bpm / 60); return beatF(k, fps, bpm) / fps; };
```
ffmpeg ducking and loudness:
```sh
ffmpeg -i vo.wav -i music.wav -filter_complex "[1:a]volume=-12dB[m];[m][0:a]sidechaincompress=threshold=0.05:ratio=8:attack=20:release=300[d];[0:a][d]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11" -ar 48000 mix.wav
ffmpeg -nostats -i final.mp4 -af ebur128=peak=true -f null - 2>&1 | tail -12
```

## In AuteurFrame
- Scenes expose their sound events as timeline labels so `audio.py` can place SFX without guessing:
  `tl.addLabel('sfx:pop:title', 0.12)`, `tl.addLabel('sfx:impact:stat', 2.4)`. The editor reads labels
  with the `sfx:` prefix; names are `sfx:<category>:<layer>`.
- `ctx.cues` gives scene-local word times; land key motion on `cue.words[i].t - 1/fps`.
- Music-led scenes receive `data.bpm` and `data.beat0` (seconds); compute beats with rule 2.
```js
AU.scene(({ tl, data, cues, $ }) => {
  const fps = 30, bpm = data.bpm || 120, b = (k) => (data.beat0 || 0) + Math.round(k * fps * 60 / bpm) / fps;
  tl.fromTo($('.word'), { scale: 1.6 }, { scale: 1, duration: 0.35, ease: 'au.snapSettle' }, b(0));
  tl.addLabel('sfx:impact:word', b(0));
  const w = cues[0] && cues[0].words.find((x) => /million/i.test(x.w));
  if (w) { tl.fromTo($('.num'), { y: 50 }, { y: 0, duration: 0.4, ease: 'au.softLand' }, w.t - 1 / fps); tl.addLabel('sfx:pop:num', w.t); }
});
```
- Assembly: xfade transitions sit on cue boundaries; the music bed is one track for the film with
  sidechain ducking under VO; loudnorm runs once on the master.

## QA checklist
- [ ] Every hard cut within 1 frame of a beat (music-led) or within 0.4 s after a sentence end (voice-led).
- [ ] Cut-to-beat error table printed in ms.
- [ ] Silence precedes the loudest hit; only one riser and one impact.
- [ ] Integrated loudness -16 +-1 LUFS, true peak <= -1 dBTP on the exported MP4, mono checked.
- [ ] 5 riskiest timestamps listed for a human listener.

## Sources
- Barty-Bart/motion-graphics skills/sound-effects SKILL.md (cue categories, 2-frame early whoosh, -16 LUFS, TP < -4 dBFS, 5 timestamps, librosa off-beat check).
- cth9191/animate craft.md and grammar/STORY.md (silence before payoff, 15-35 dB drops, voice is the clock, 24 fps + 120 BPM grid).
- alchaincyf/huashu-art-motion y5_kinetic_type (reveal-point offset, EBU R37 +40/-60 ms).
- heygen-com/hyperframes references/motion.md (beat grid rounding), references/sound.md.
- Tejashmakwana/motionmaxxing references/sound-sync.md (-14 LUFS / -1 dBTP mix, words 0-2 f before heard).
- CK42BB/vox-explainer-skill (VO-first timing, music ducked -12 to -15 dB).
