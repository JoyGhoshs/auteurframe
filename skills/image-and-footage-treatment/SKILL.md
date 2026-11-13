---
name: image-and-footage-treatment
description: Use when a scene shows photos, screenshots, product UI or video footage and you must frame, grade, cut out, move or put type over them without it reading as a slideshow.
stage: animate
tags: [images, footage, screenshots, ui, collage, grading, cutout, ken-burns, captions-over-video]
version: 1
---

# Image and Footage Treatment

Real material (photos, screenshots, product UI, archival scans, footage) is the strongest proof
a film can show. It is also how most AI videos turn into slideshows: a full-bleed photo per scene,
a 1.0 to 1.05 Ken Burns on each, a fade between them. This skill sets out how to place real
material in a built world: how big, how cropped, how graded, how the camera reads it, and how
type sits on it. The material stays honest. Nothing generated is ever passed off as real.

## When to use / not use

- Use for any scene with an `<img>`, `<video>`, a screenshot or a photo cutout. Also use it when
  the brief supplies media, or when the research step returned images with licences.
- Use for text over footage and for "text behind the subject" layouts.
- Do not use for pure vector or illustrated scenes (see `hand-drawn-doodle`, `icon-and-shape-language`).
- Do not use to invent proof. If you have no real screenshot, rebuild the UI from components
  (see `composition-contract`) and declare it illustrative.

## Core rules

1. **Assets only from the asset list.** Every image or video comes from the scene's asset list,
   which the platform resolves to local files. Never hotlink, never use a URL, never base a
   claim on an image whose source you cannot name.
2. **Ken Burns alone is a slide.** A scale from 1.0 to 1.05 as the only motion is the top PPT tell
   (bang-motion). Every image scene needs at least two of the following:
   - parallax between at least 2 layers, with speed ratios of 2 to 2.4x;
   - a push to a region, timed to the word that names it;
   - an element entering;
   - a drawn annotation (a circle, an underline, a highlighter);
   - a cut to a closer framing of the same material.
3. **Screenshots are big.** A screenshot is at least 80% of the frame width in landscape and at
   least 90% in portrait (huashu t2). A small card floating on a void fails gate G1. The one
   exception is a wide establishing shot of under 1 s that is followed by a push-in.
4. **Fill without cropping.** Use `object-fit: contain` on the sharp copy. Behind it, place the
   same image at `cover`, scale 1.08, blurred 24 to 40 px and darkened 30 to 45%, so no letterbox
   shows. Crop with `cover` only when the crop is a deliberate framing.
5. **Pushes have two speeds.**
   - Default: an eased push to a region in about 0.9 s.
   - A snap push of 0.28 s is reserved for the reveal or the comparison result, once or twice per
     film.
   - After a push, pull back to the whole image or move across to the next region.
   - Push each image once or twice at most.
6. **UI as a magnified fragment.** Magnify a panel, modal or dashboard to 1.4 to 2x. Magnify a
   single card or button to 2.3 to 4.4x (motionmaxxing). Make exactly one object readable, at 4 to
   12% of H. Everything else is texture at 1.3 to 1.9% of H.
7. **No browser chrome.** No URL bar, no bezel, no OS menu and no three-dot window header unless
   the story is about the browser. The surface is a floating plane in a lit world.
8. **One camera group.** The UI and all its parts move as one transform (a lens). Backgrounds stay
   screen-fixed. Text is never zoomed on its own.
9. **Rack focus, not opacity.**
   - A background UI behind a headline blurs over about 0.7 s, peaking at 0.7 px, then 5.5 px,
     then 10 px, and never more than about 11 px. It darkens by 10%.
   - Focus returns as a blur from 4 to 0 px over about 0.46 s.
   - Large CSS blurs are slow to capture: keep animated `filter: blur()` under 12 px on elements
     larger than half the frame, and pre-blur static backgrounds once.
10. **Grade cheaply and consistently.** Build duotone, halftone, grain, tint and vignette from CSS
    blend modes (`multiply`, `screen`, `color`, `luminosity`) or a single SVG filter that is
    defined once.
    - Use one grade for the whole film, taken from the art bible.
    - Never use per-scene ad-hoc filters, and avoid `backdrop-filter` stacks.
11. **Cutouts.**
    - Photo cutouts get a white sticker border of 3 to 6 px at 1080p plus a soft drop shadow
      (offset 4 to 10 px, blur 8 to 16 px, opacity 0.18 to 0.3).
    - Torn edges are 5 to 8 px wide and run along only part of an edge.
    - Archival photos appear on the cut. They slide in only when the camera is following a
      timeline, tilted 5 to 15 degrees and landing flat, in about 0.8 s.
12. **Text over footage.** Choose the blend by the brightness behind the text, on a 0 to 255
    scale (HyperFrames):
    - under 60: `screen` or plain light ink;
    - 60 to 180: `overlay`, or add a scrim;
    - over 180: `normal` with opaque ink.

    Plain subtitles over brightness above 60 get a scrim sized to the text at 30 to 40% opacity,
    never a full-width bar.
13. **Text behind the subject.** The stacking order is plate, then type, then a cutout matte of
    the person.
    - Keep the word 30 to 55% covered. Under 15% it floats; over 65% it is eaten.
    - Re-lay it out if a content word is 80% covered.
    - Measure coverage over the caption's whole time window, because heads move.
14. **Video is seeked, never played.** The runtime seeks `<video>` on every frame. Never call
    `play()`, `pause()` or set `currentTime`. Never use `loop` or `autoplay`. Time the video
    element itself, not its wrapper.
15. **Honesty.**
    - Generated images may fill a missing surface (a texture, a sky, a plate).
    - They are never text, logos, product UI or people presented as real.
    - Every illustrative or generated asset is listed in the scene notes with `illustrative: true`.

## Footage treatment ladder (pick the lowest rung that works)

| Rung | Treatment | Cost | Use when |
|---|---|---|---|
| 0 | Cut on motion, no effect | free | footage is good and on-brand |
| 1 | Crop and reframe (scale 1.1 to 1.6 on a wrapper) | free | the subject is small or off-centre |
| 2 | Single grade (tint via `mix-blend-mode: color`, contrast) | cheap | mixed sources must match |
| 3 | Duotone or halftone via SVG filter or blend layer | cheap | collage or editorial packs |
| 4 | Speed ramp, freeze frame | medium | emphasise a moment |
| 5 | Cutout and text-behind | expensive | hero shot, once per film |
| 6 | Heavy blur or glow on full frame | slow to capture | avoid; pre-render instead |

## Do / Don't

| Do | Don't |
|---|---|
| Screenshot >= 80% W, then push to the region named in VO | 0.3 W card on a gradient void |
| contain + blurred self-fill behind | letterbox bars or a stretched image |
| One grade for the film, from the bible | a different filter per scene |
| Magnify one card 2.3-4.4x, keep the rest texture | inflate all UI text to make it readable |
| Rack-focus the background, cap ~11 px | fade the UI out to show a headline |
| Sticker border plus soft shadow on cutouts | hard rectangle photos with glow |
| Seek video by the timeline | `autoplay loop` clips on their own clock |
| Declare illustrative assets in notes | generated logos, UI or faces shown as real |
| Cut between images on motion | crossfade photo to photo |

## Recipe 1: contain with self-fill and a region push (plain HTML + GSAP)

```html
<div class="plate">
  <img class="fill" src="shot.png" alt="">
  <div class="lens"><img class="sharp" src="shot.png" alt=""></div>
</div>
<style>
.plate{position:absolute;inset:0;overflow:hidden;background:#111}
.fill{position:absolute;inset:-4%;width:108%;height:108%;object-fit:cover;filter:blur(32px) brightness(.6)}
.lens{position:absolute;inset:0;transform-origin:0 0}
.sharp{position:absolute;left:5%;top:8%;width:90%;height:84%;object-fit:contain}
</style>
<script>
const tl = gsap.timeline({paused:true});
function pushTo(rx, ry, scale, at, dur){
  tl.to('.lens', {x: -rx*scale + 960, y: -ry*scale + 540, scale, duration: dur, ease:'power2.inOut'}, at);
}
pushTo(1320, 610, 1.8, 1.4, 0.9);
pushTo(960, 540, 1.0, 4.2, 0.8);
</script>
```

## Recipe 2: text over footage, by luminance

```js
function blendFor(luma){
  if (luma < 60) return {mode:'screen', scrim:0};
  if (luma <= 180) return {mode:'overlay', scrim:0.35};
  return {mode:'normal', scrim:0.3};
}
```

The probe samples the mean luma of the text box's background before choosing.

## In AuteurFrame

- Assets: `ctx.assets` maps names to local files that the platform has already copied. Use
  `ctx.assets.hero` for `src`. The lint rejects any `http`.
- Video: put `<video data-layer="clip" muted playsinline>` with `src=ctx.assets.clip`. The
  runtime seeks it. Never call play.
- Camera: keep the plate inside the scene root. `AU.camera({at, x, y, scale, duration, ease})` does the
  pushes:
  - `ease:'au.glide'`, duration 0.9 for a push;
  - `'au.punch'`, duration 0.28 for a snap;
  - `'au.exit'` for a pull-off into a cut.
- Grain and ambient life on plates come from `AU.ambient(el, 'grain')`. Grain is never baked per
  scene.
- Annotations come from `AU.draw('.circle', {at, duration: 0.65})` for a red circle and
  `AU.rough(svg, shapes, {boil: true})` for a hand-drawn ring in doodle packs.

```html
<div class="scene">
  <div class="world">
    <img class="fill" data-layer="fill">
    <img class="sharp" data-layer="shot">
  </div>
  <svg class="ann" data-layer="ann" viewBox="0 0 1920 1080">
    <ellipse class="ring" cx="1320" cy="610" rx="180" ry="70" fill="none"
      stroke="var(--accent)" stroke-width="6"/>
  </svg>
</div>
<style>
.fill{position:absolute;inset:-4%;width:108%;height:108%;object-fit:cover;filter:blur(32px) brightness(.55)}
.sharp{position:absolute;left:var(--safe-x);right:var(--safe-x);top:var(--safe-y);bottom:var(--safe-y);
  width:calc(100% - 2*var(--safe-x));height:calc(100% - 2*var(--safe-y));object-fit:contain}
</style>
<script>
AU.scene(({ tl, D, assets, $ }) => {
  $('.fill').src = assets.shot; $('.sharp').src = assets.shot;
  tl.fromTo($('.sharp'), {scale:1.12, y:40}, {scale:1, y:0, duration:0.45, ease:'au.softLand'}, 0);
  AU.camera({ at: 1.2, x: -360, y: -70, scale: 1.8, duration: 0.9, ease: 'au.glide' });
  AU.draw('.ring', { at: 2.2, duration: 0.65 });
  AU.camera({ at: D - 1.6, x: 0, y: 0, scale: 1.05, duration: 0.8, ease: 'au.glide' });
  AU.ambient($('.fill'), 'drift');
});
</script>
```

## QA checklist

- [ ] No `http`, `//` or `data:` loaded from outside the asset list.
- [ ] The readable screenshot area is >= 80% W (16:9) or >= 90% W (9:16), or the frame is a < 1 s
      establishing shot.
- [ ] One readable object per frame, at 4-12% H.
- [ ] The motion is more than Ken Burns: at least 2 of parallax, push, entry, annotation, cut.
- [ ] Animated blur on large elements is <= 12 px.
- [ ] Every text box over footage passes the contrast probe (>= 4.5:1, or a scrim is present).
- [ ] Text-behind-subject coverage is 30-55% for every frame of its window.
- [ ] No `play()`, `autoplay` or `loop` on media.
- [ ] Illustrative and generated assets are declared in the notes.

## Sources

- bang-motion anti-PPT rules (Ken Burns, miniature zoom): github.com/bangtutorial/bang-motion
- huashu-art-motion t2 keynote UI and y2 Vox (screenshot >= 80% W, push 0.9 s, snap 0.28 s,
  archival photos on the cut): github.com/alchaincyf/huashu-art-motion
- motionmaxxing layout.md and motion.md (fragment magnification, rack focus <= 11 px, one
  camera group): github.com/Tejashmakwana/motionmaxxing
- HyperFrames captions.md (blend by luminance, scrim 30-40%, text behind subject 30-55%):
  github.com/heygen-com/hyperframes
- CK42BB vox-explainer (sticker borders 3-6 px, halftone, tape): github.com/CK42BB/vox-explainer-skill
