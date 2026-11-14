---
name: camera-and-audio-master
description: Editor-level controls the swarm can set without rewriting scene code - per-scene camera keyframes (zoom, focus point, rotation, easing) and presets (Ken Burns in and out, pans, punch-in, push-out, handheld drift, shake), plus the audio master (loudness target, music ducking under voice, voice clarity EQ, sound effects level, true peak ceiling). Use when finishing a film like an editor.
stage: edit
tags: [camera, zoom, pan, ken burns, keyframes, punch in, shake, audio, loudness, lufs, ducking, eq, mastering, editor]
version: 1
---

# Camera keyframes and audio master

## Scene camera

```json
"camera": { "preset": "punch-in", "intensity": 1.2 }
"camera": { "keys": [ { "t": 0, "zoom": 1, "x": 50, "y": 50 }, { "t": 2.4, "zoom": 1.35, "x": 62, "y": 40, "ease": "expo.out" } ], "shake": 0.3 }
```

- Zoom is around the focus point (x, y in percent of the frame); the frame edge never shows.
- Keyframes replace the preset. Eases are GSAP names (power2.inOut, sine.inOut, expo.out, back.out(1.6), none).
- The camera moves the whole scene but not the captions, so subtitles stay put.
- Motivate moves: punch in on a reveal or punchline, Ken Burns on stills and maps, drift for calm documentary, shake only on
  impacts and for a few frames. One camera idea per scene; do not combine with a lens move of the same kind.

## Audio master

```json
"audio": { "master": { "lufs": -14, "duck": 70, "voice_clarity": true, "music_eq": true, "sfx_db": -6, "true_peak": -1.5 } }
```

| target | lufs |
|---|---|
| social and streaming | -14 |
| web and podcast | -16 |
| speech heavy | -19 |
| broadcast | -23 |

- Ducking compresses the music while the narrator speaks (0 off, 100 strongest). 60 to 75 suits explainers.
- Voice clarity: high-pass at 80 Hz, a small cut at 250 Hz, presence at 3.2 kHz and gentle compression.
- Music EQ carves 2.5 kHz out of the music under the voice.
- Sound effects sit about 15 dB under the voice; land them on visual hits, never on every cut.
