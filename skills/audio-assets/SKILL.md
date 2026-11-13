---
name: audio-assets
description: Find, collect and place free sound effects, ambience and music (Freesound, Jamendo, ccMixter, Wikimedia, Internet Archive; commercial-use licences only) with search_audio, collect_audio and place_audio; beat-synced cuts from detected bpm; works with the free AI narration. Use whenever a scene has an on-screen event that deserves a sound or the film needs a real music bed.
stage: animate
tags: [audio, sound, sfx, music, ambience, foley, beats, narration, tts, freesound]
version: 1
---

# Audio assets

Sound makes motion feel physical. A whoosh sells a fast move, a paper rustle sells a collage, a camera
shutter sells a photo landing, a crowd murmur sells an archival street. Use few sounds, exactly on the frame.

## Workflow

```
```tool search_audio paper rustle
{"kind": "sfx", "max_seconds": 4}
```
```
Results are numbered with title, length, licence and tags. Collect one:
`collect_audio 3` (optional start and length: `collect_audio 3 0.4 1.5`), then place it in scene time:
`place_audio as_abc123 sfx 1.20` with an optional body `{"gain": 0.6, "fade_out": 0.1}`.
The editor shows the clip on the timeline; the user can move it.

Music for the whole film: `search_audio calm cinematic piano` with `{"kind": "music"}`, `collect_audio 2 0 90`,
then `place_audio as_xyz music`. Music assets report `bpm` and beat times; put big moves and cuts on beats.
The asset scout usually picks the film's music already; only replace it when the brief asks for a different mood.

## Sound grammar

| on screen | sound | gain |
|---|---|---|
| fast move, transition, swipe | whoosh, swish, air | 0.5 |
| photo or card lands | paper slap, shutter, thud | 0.6 |
| number counts up | soft ticks, digital blips | 0.35 |
| map pin drops | pop, drop, click | 0.5 |
| reveal, title hit | impact, boom, riser before it | 0.7 |
| typing, UI | keyboard, mouse click | 0.4 |
| nature, places | ambience loop (rain, city, wind, birds) at low gain under the scene | 0.2 |

Rules: place the sound 1 to 2 frames before the visual hit; never more than one sound per beat; keep ambience under
narration (gain 0.15 to 0.25); trim long files with collect_audio start and length; prefer CC0 and CC BY.

## Narration

When the film has AI narration (Narrator agent), the voice track and word timings already exist; your scene's word
timings are in the brief. Time picture to words, never the other way round.
