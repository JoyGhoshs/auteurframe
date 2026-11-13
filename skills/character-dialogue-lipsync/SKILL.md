---
name: character-dialogue-lipsync
description: Make characters talk - cast voices (free neural or ElevenLabs) with voices and speak, lip sync 2D characters, mascots, 3D models and real portraits (talking-head) to narration or dialogue lines, stage conversations, presenters, interviews and historical figures. Use for any scene where someone speaks on screen.
stage: animate
tags: [character, dialogue, talking, lipsync, voice, tts, elevenlabs, presenter, portrait, avatar, conversation, acting]
version: 1
---

# Character dialogue and lip sync

Text to speech must be switched on by the user (Settings > Voice and generation). If `voices` answers that it is off,
animate talking with the word timings of the narration instead (the character `talk` action) and do not call `speak`.

## Casting

`voices deep calm male` lists voices that match a description (gender, age, accent, character). The film's cast is
remembered: once "old fisherman" has a voice, every later line for that role uses it. `speak auto old fisherman` casts
automatically from the brief, tone and language. Cast for contrast: two characters in a scene need clearly different
timbres (deep and bright, old and young, calm and excited).

## Lines

```
```tool speak auto old fisherman
{"text": "The river gave us everything. Then it took it back.", "at": 0.6}
```
```
The line is synthesised, placed on the film timeline at scene time 0.6 s, and returned with word times. Keep lines short
(one or two sentences), leave 0.3 to 0.6 s between speakers, and keep the whole exchange inside the scene duration.

## Lip sync targets

- Real portrait or illustration: `AU.component('talking-head', { src: 'as_portrait', lipsync: 'as_line01', lipsyncAt: 0.6, frame: 'card', x: 8, y: 8, w: 40, h: 84 })`.
  Use a front-facing, well lit face filling at least a third of the image; `rig_face` checks it first. `lipsync: 'voice'` follows the film narration.
  `motion` 0.3 for formal presenters, 0.8 for lively characters; `smile: 0.3` for friendly hosts.
- 2D explainer character: `AU.component('character', { x: 30, lipsync: 'as_line01', lipsyncAt: 0.6, actions: [{ do: 'talk', at: 0.6, duration: 2.8 }, { do: 'point', at: 1.4, duration: 1 }] })`.
- Mascot: `AU.component('mascot', { shape: 'blob', lipsync: 'voice' })`.
- 3D model: `AU.component('model3d', { src, clip: 'Idle', lipsync: 'as_line01', lipsyncAt: 0.6 })` drives a jawOpen or viseme morph target when the model has one; otherwise it bobs subtly while speaking.

## Staging conversations

- Two-shot: speakers left and right, facing each other (`facing: 'left'` on the right character), listener reacts (nod, think) while the other talks.
- Shot reverse shot: one scene per speaker, talking-head close-up with a lens push, cut on the line change.
- Presenter: talking-head in a card at one side, the topic visuals (map, photo, chart) on the other side, lower third with name and role.
- Historical figure: archival portrait as talking-head with lens type 'vintage' and a quote card; always label it as a dramatisation.
- Keep captions readable: never place faces in the bottom caption band.
