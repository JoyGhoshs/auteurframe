---
name: subtitle-sync
description: Use when parsing SRT/VTT/JSON subtitles, deriving word timings, grouping cues into scene windows, and styling readable or word-level captions for long form and shorts.
stage: write
tags: [subtitles, captions, srt, vtt, timing, cps, shorts, word-level, readability]
version: 1
---

# Subtitle Sync

Subtitles are the master clock. Scene windows are built from cue groups, picture changes land on words, and captions must be readable at platform speed. Numbers below come from the Netflix Timed Text Style Guide, BBC guidelines, eye-tracking studies (Szarkowska, Romero-Fresco) and production caption systems (HyperFrames).

## When to use / not use

- Use whenever narration, an SRT/VTT, or word-level JSON exists; before storyboard timing is locked.
- Use when designing caption style for shorts (word-highlight) or long form (phrase blocks).
- Not for on-screen kinetic headlines (kinetic-typography) or in-world labels.

## Core rules

1. Parse to one model: `{start, end, text, words: [{t, e, w}]}` in seconds; one word per timed entry, never two.
2. Missing word times: distribute the cue span across words weighted by character count + 1 (space), with 40 ms minimum per word; mark `estimated: true` (error about +-0.2 s).
3. Match transcript words to caption words by position, not text, or repeated words get the wrong time.
4. Reading speed: <= 17 CPS default, 20 CPS hard max (adult), 17 for children; equivalently 160-180 wpm (BBC); minimum 0.3 s per word.
5. Block limits: 42 characters per line, 2 lines max (16:9); 9:16 about 25 characters per line, up to 3 lines.
6. Duration: min 5/6 s (0.833 s, 20 frames at 24 fps) for 1-2 word events, max 7 s.
7. Gaps between events: exactly 2 frames, or >= 0.5 s. Close gaps of 3-11 frames to 2 frames.
8. Shot changes: in-time within 12 frames after a cut snaps to the cut; out-time within 0.5 s before a cut extends to 2 frames before it.
9. Audio sync: in on the first audio frame (+-2 frames); out >= 0.5 s after audio ends when nothing follows.
10. Line breaks: after punctuation, before conjunctions/prepositions; bottom-heavy; never split article+noun, adjective+noun, first+last name, pronoun+verb, verb+auxiliary/negation, phrasal verb.
11. Captions that start at 0.0 s look pre-existing: first caption 0.1-0.3 s in.
12. Every caption group exits with a hard kill (opacity 0 then hidden) at its end.

## Scene windows from cues

```
groups = split cues where: gap >= 0.15 s  OR  sentence end (. ? !)  OR  group text > budget
scene window = [first_cue.start - lead, last_cue.end + tail]   lead 0.1-0.3 s, tail 0.2-0.5 s
snap boundaries to frame grid: round(t * fps) / fps
adjacent windows meet exactly (no gap): boundary = midpoint of the inter-group silence
minimum scene = 1.5 s (shorts) / 3 s (long form): merge short groups forward
picture change lands 0.2-0.4 s after a sentence ends (voice clock), or 0-2 frames before the key word
```

## Caption styles

| Style | Group size | Use | Mechanics |
|---|---|---|---|
| Phrase block | 4-6 words, 1-2 lines | long form, calm | whole block in, hard swap, no animation |
| Conversational | 3-5 words | explainers, shorts | block in 0.12 s, active word tinted accent |
| High energy | 2-3 words | hype shorts | block pops 1.15 -> 1.0 in 0.15 s, active word scale 1.08 |
| Karaoke highlight | full phrase visible | learning content | colour wipe follows word times |

Prefer highlighting the active word inside a fully visible phrase over revealing words one by one: scrolling word-by-word captions pull about 87.5% of gaze onto text (Romero-Fresco); keyword highlight within full captions ranked best for learning. Keep emotive/kinetic effects to keywords only.

## Readability research to remember

- Szarkowska and Gerber-Moron 2018: 12, 16, 20 CPS gave no comprehension difference; 12 CPS caused more revisits and frustration. Viewers keep up at 20 CPS, so do not slow captions below 12.
- At 17-18 CPS viewers spend about 80% of time on subtitles; at 120 wpm about 40%. Faster captions steal the picture: keep on-screen hero text away from caption times when possible.
- Viewers over 180 wpm report frustration, older viewers especially.

## Placement

- 16:9: baseline 80-120 px from bottom at 1080p, inside 80% title-safe, centred full-width container (never left 50% + translate).
- 9:16 (1080x1920): about 600-700 px from bottom, inside x 60-940, y 250-1500; platform UI covers the right rail and bottom 18%.
- Over footage: brightness behind text < 60 screen, 60-180 overlay, > 180 normal with scrim 30-40% sized to text, never a full-width bar.
- Fade the group or its words, never both (opacities multiply).
- Caption size: base 78 px landscape, min 42 px, fit by measured width (max 1600 px landscape, 900 px portrait); never below --fs-min.

## Do / Don't

| Do | Don't |
|---|---|
| One caption group visible at a time | Stack groups in a flex column (hidden ones keep space) |
| Snap scenes to cue groups | Cut picture mid-phrase |
| Drop words starting inside final silence (silencedetect -35 dB, 0.6 s) | Trust whisper over silence ("Thank you.") |
| Retry transcription if > 20% junk tokens | Burn captions over the speaker's face |
| Re-time captions after VO re-takes | Keep a 0.4 s gap (illegal: 2 frames or >= 0.5 s) |

## Recipe: SRT/VTT parse (generic JS)

```js
function parseSubs(src) {
  const ts = s => { const m = s.trim().replace(',', '.').split(':').map(Number);
    return m.length === 3 ? m[0]*3600 + m[1]*60 + m[2] : m[0]*60 + m[1]; };
  return src.replace(/\r/g, '').split(/\n\n+/).map(b => {
    const lines = b.split('\n').filter(l => l && !/^WEBVTT/.test(l) && !/^\d+$/.test(l));
    const i = lines.findIndex(l => l.includes('-->'));
    if (i < 0) return null;
    const [a, z] = lines[i].split('-->');
    const text = lines.slice(i + 1).join(' ').replace(/<[^>]+>/g, '').trim();
    return { start: ts(a), end: ts(z.split(' ')[1] ? z.trim().split(' ')[0] : z), text };
  }).filter(Boolean);
}
function estimateWords(cue) {
  const ws = cue.text.split(/\s+/), weights = ws.map(w => w.length + 1);
  const total = weights.reduce((a, b) => a + b, 0), span = cue.end - cue.start;
  let t = cue.start;
  return ws.map((w, i) => { const d = Math.max(0.04, span * weights[i] / total);
    const o = { t, e: Math.min(cue.end, t + d), w }; t += d; return o; });
}
```

## Recipe: CPS check

```js
const cps = c => c.text.replace(/\s+/g, ' ').length / (c.end - c.start);
const bad = cues.filter(c => cps(c) > 20 || c.end - c.start < 0.833 || c.end - c.start > 7);
```

## In AuteurFrame

`subtitles.py` produces film cues; `swarm` slices them per scene and the runtime exposes scene-local `ctx.cues` (start/end relative to scene start). Captions are injected by the runtime in the style pack's caption style: agents must NOT render narration captions, and must keep the caption band free (bottom `--safe-y` band in 16:9; y 1500-1700 band in 9:16 per style). Agents use cues to time picture:

```html
<div class="scene"><h2 class="kw" data-layer="kw">doubled</h2></div>
<style>.kw{font:800 var(--fs-lg)/1 var(--font-display);color:var(--accent);position:absolute;left:var(--safe-x);top:30%;}</style>
<script>
AU.scene(({ tl, D, cues, $ }) => {
  const w = cues.flatMap(c => c.words).find(x => /doubled/i.test(x.w));
  const at = w ? Math.max(0.1, w.t - 0.05) : 0.3;
  tl.from($('.kw'), { y: 40, opacity: 0, duration: 0.4, ease: 'au.softLand' }, at);
  tl.to($('.kw'), { x: 30, duration: Math.max(0.5, D - at - 1.2), ease: 'au.drift' }, at + 0.4);
});
</script>
```

## QA checklist

- All cues: CPS <= 20 (warn > 17), duration 0.833-7 s, gaps 2 frames or >= 0.5 s, lines <= 42 chars (25 in 9:16), <= 2 lines (3 in 9:16).
- Scene boundaries equal cue group boundaries within 1 frame; no scene starts mid-word.
- Probe: caption box does not overlap any data-layer element during its window; caption inside title-safe.
- Word times monotonic, each word e > t, no duplicate word entries.
- First caption >= 0.1 s; every group hidden after its end.

## Sources

- Netflix English Timed Text Style Guide https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977 ; timing https://partnerhelp.netflixstudios.com/hc/en-us/articles/360051554394
- BBC subtitle guidelines https://www.bbc.co.uk/accessibility/forproducts/guides/subtitles/
- Szarkowska and Gerber-Moron 2018 https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0199331
- Romero-Fresco live subtitling report https://www.w3.org/community/texttracks/wiki/images/9/96/Live_captioning_report.PDF
- "Useful but Distracting" https://dl.acm.org/doi/10.1145/3701571.3701574
- heygen-com/hyperframes skills/hyperframes/references/captions.md ; cth9191/animate craft.md (captions >= 1.25 s, <= 3.5 words/s)
