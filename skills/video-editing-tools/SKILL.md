---
name: video-editing-tools
description: Edit real footage inside a scene with the 42 media tools (ffmpeg-skill) - probe, cut and jump cuts, fit and reframe 16:9 to 9:16, speed ramps, freeze, reverse, colour and LUT grading, stabilize, denoise, audio clean-up and ducking, loudness, overlays, b-roll, joins with transitions, contact sheets - then composite the result with the clip component and motion graphics. Use for shorts, talking heads, product footage and any scene built on video.
stage: edit
tags: [video, editing, ffmpeg, shorts, reframe, cut, speedramp, grade, lut, captions, broll, audio, ducking, stabilize]
version: 1
---

# Video editing tools

## Workflow (probe, edit, check, look)
1. `list_media` shows footage and its sandbox path (`/mnt/media/<file>`).
2. `media probe /mnt/media/<file>` before editing: never guess frame rate, size, rotation or audio streams.
3. Edit with typed tools, writing outputs under `out/`: `media <tool> <input> [flags] -o out/<name>.mp4`.
   `media_tools <words>` finds a tool, `media_help <tool>` lists its flags. Prefer stream copy; re-encode only when needed.
4. Check: `media look out/<name>.mp4` makes a contact sheet; `media verify` confirms duration, streams and sync.
5. `import_media out/<name>.mp4` returns an asset id; place it with `AU.component('clip', { src: id })`.

## Recipes
| Goal | Tool call |
|---|---|
| Vertical short from wide footage | `media fit /mnt/media/a.mp4 --aspect 9:16 --fit crop -o out/v.mp4` (or `--fit blur` to keep the whole frame) |
| Exact length | `media fit in.mp4 --duration 30 --method trim --from-center -o out/t.mp4` |
| Remove silences | `media silence in.mp4` to find gaps, then `media cut in.mp4 --segments 0:00-0:12,0:15-0:40 -o out/c.mp4` |
| Speed ramp | `media speedramp in.mp4 --segment 2-4:0.4 --segment 6-7:2 -o out/r.mp4` |
| Freeze on a beat | `media freeze in.mp4 --at 3.2 --hold 1.0 -o out/f.mp4` |
| Grade | `media color in.mp4 --lut look.cube` or typed primary correction (`--correct`) |
| Clean voice, music under speech | `media audio in.mp4 --voice` then `media audio in.mp4 --music bed.mp3 --duck` |
| Platform loudness | `media loudness in.mp4 -I -14 --tp -1 -o out/l.mp4` |
| Stabilize handheld | `media stabilize in.mp4 -o out/s.mp4` |
| Join with transitions | `media join a.mp4 b.mp4 --transition fade -o out/j.mp4` |

Flags differ per tool: always confirm with `media_help`.

## Motion on top of footage
Do the photographic work with media tools, the motion design in the scene:
- Punch-ins: place the clip with `AU.component('clip', ...)`, keep `el`, then `tl.to(el, { scale: 1.18, duration: 0.25, ease: 'au.snapSettle' }, wordTime)` and ease back.
- Kinetic captions are automatic from subtitles; add word stamps with the `title` component (`style: 'slam'`, upper third).
- Callouts and highlights point at things in the footage; `follow` CTA in the last two seconds.
- Keep faces clear: graphics in the upper third or beside the subject; never over the mouth.
- Hook in the first second, a visual change every 1 to 2 seconds, sound on every visual hit.
