---
name: documentary-assets
description: Research and collect real material from the internet for documentary, Vox-style, news, history and explainer films - photos, illustrations, SVG vectors, icons, logos, flags, website screenshots with highlighted sentences, scraped images - then stage them with the image and webpage components and your own GSAP. Use whenever a scene is about something real that a drawing would cheapen.
stage: animate
tags: [documentary, vox, research, images, screenshots, scraping, icons, logos, flags, archival, evidence, assets, credits, web]
version: 1
---

# Documentary assets

A documentary feels true because the viewer sees the real thing: the actual person, the building, the
headline, the document, the place. When a scene names something real, go and get it instead of drawing
a weak imitation. Collecting is part of animating: search, look, choose, collect, then stage it with motion.

## When to collect and when to draw

Collect: named people, places, landmarks, buildings, artworks, products, brands and logos, flags, news
headlines, quotes from articles, official documents, historical photos, maps.
Draw or code: abstract ideas, diagrams, charts, metaphors, transitions, typography.
Mix them: a real photo cut out on paper with a drawn red circle and a typed label is the Vox look.

## The workflow (tools)

1. Find candidates
   - `search_images <query>` for photos; body `{"style": "historical"}`, `"portrait"`, `"illustration"`,
     `"vector"` (SVG), or `"transparent"` (PNG cut-outs). Sources: Openverse, Wikimedia Commons, and Pexels,
     Unsplash or Pixabay when the user added keys. Search in English with concrete nouns
     ("Dhaka skyline night", "Apollo 11 Buzz Aldrin bootprint", "1971 Bangladesh liberation war photograph").
   - `search_icons <query>` for pictograms, brand logos (`logos:`, `simple-icons:`) and flags (`flag:bd-4x3`,
     `flagpack:`). `collect_icon flag:bd-4x3` saves it as SVG.
   - `web_search <query>` then `read_page <url> <focus words>` to find the real source of a fact, the article
     to screenshot, or a page full of relevant pictures.
   - `scrape_images <url>` lists the large images a page shows (Wikipedia articles, museum and agency pages are
     ideal).
2. Look before you choose: `look 3,5,9` shows a contact sheet (vision models) or sizes and licences.
   Prefer large (at least 1200 px wide for full-frame use), sharp, uncluttered pictures with the subject clear.
3. Collect: `collect_image 5` (or an image URL). The asset id comes back; the credit is stored for the end card.
4. Stage it (below), preview, and check the frame.

Licences: prefer CC0, CC BY, CC BY-SA, public domain, Pexels/Unsplash/Pixabay licences. Scraped images from
news sites may be copyrighted; use them like a documentary would (small, as evidence, credited), and prefer a
free alternative when one exists.

## Website screenshots: the evidence move

```
```tool screenshot https://en.wikipedia.org/wiki/Moon
{"find": ["about one-quarter the diameter of Earth"], "width": 1440, "height": 900}
```
```
The tool scrolls the phrase into view, captures the page with the headless browser (cookie banners removed),
and returns boxes for each phrase as [x, y, w, h] in % of the screenshot, one box per text line. Then:

```
AU.component('webpage', { src: 'as_shot01', url: 'en.wikipedia.org/wiki/Moon', frame: 'browser', tilt: 8,
  highlights: [{ boxes: [[12.5, 41.2, 38.0, 3.1], [12.5, 44.6, 21.4, 3.1]], at: 1.2, style: 'marker' }],
  focus: { box: [12.5, 41.2, 38.0, 6.5], at: 2.2, duration: 1.4 }, dim: 0.35 });
```
Styles: `marker` (yellow highlighter sweep), `box`, `underline`, `circle` (hand-drawn ring). `full: true` captures
the whole page; then use `scroll: { to: 40, at: 0.5, duration: 3 }` to travel down it. Use `frame: 'paper'`
for printed-document looks and `'none'` to composite the page yourself.

## Staging real photos (Vox and documentary grammar)

- Ken Burns with intent: push toward the subject's eyes or the key detail, never a random drift.
  `AU.component('image', { src, kenburns: 1.12, reveal: 'wipe' })`, or your own `tl.fromTo(img, {scale:1.04, xPercent:-2}, {scale:1.14, xPercent:1, ease:'none', duration: D})`.
- Paper cut-out: wrap the photo in a white border (`padding: 10px; background: #fff`), a soft drop shadow, a 2 to
  4 degree rotation, and tape strips (rotated rectangles with 60% opacity). Drop it in with a small overshoot.
- Duotone archival: `filter: grayscale(1) contrast(1.15)` plus a multiply layer of `var(--accent)` for a printed look;
  add a grain layer from the cinematic-ground-and-texture skill.
- Evidence board: three to five collected images pinned on a textured ground, connected by drawn red string
  (SVG lines drawn with `ctx.draw`), the camera panning from one to the next on the narration beats.
- Red-pen annotation: hand-drawn circle or arrow (SVG path with stroke-dashoffset draw) and a typed label in
  `var(--font-mono)` on the detail that matters.
- Source caption: small `Source: Wikimedia Commons / NASA` text in the lower left, 0.6 opacity, for every real
  image and screenshot. Documentaries show their sources.
- Cut-out subject: search with `{"style": "transparent"}` for PNG cut-outs, or place the photo inside a
  `clip-path` mask shape.

## Archival footage

`search_footage apollo 11 launch` searches the Internet Archive (Prelinger and government films, much of it public domain),
NASA and Wikimedia Commons. `footage_info 2` shows duration, shot changes and a frame contact sheet; pick a clean shot between
two cuts, then `collect_footage 2 31.0 4.5` cuts 4.5 s from 31.0 s into a 1080p clip asset. Place it with
`AU.component('clip', { src, x: 0, y: 0, w: 100, h: 100 })`, or inside a paper frame, a TV set or a split screen. Grade old
footage consistently (media tool color or a CSS filter) and add a `Source:` line. Keep archival clips short (2 to 5 s).

## Editing collected images (local, free, no key)

`edit_image <asset>` with a JSON list of operations makes a new asset:
- `[{"op": "cutout"}]` removes the background (people: `{"op": "cutout", "model": "human"}`), giving a transparent PNG.
- `[{"op": "sticker"}]` turns a photo into a paper cut-out with a white border and shadow, the classic collage piece.
- `[{"op": "crop", "aspect": "9:16"}]` smart-crops around faces or the subject for vertical films.
- `[{"op": "duotone", "dark": "#1b1b3a", "light": "#f6e7c1"}, {"op": "grain"}]` archival print look; also `sepia`, `halftone`,
  `grayscale`, `sketch` (pencil), `posterize`, `tint`, `vignette`.
- `[{"op": "blur_bg", "radius": 16}]` keeps the subject sharp and blurs the rest, for a depth-of-field push.
- `[{"op": "upscale", "factor": 2}]` for small archival scans; `shape` (circle, rounded, torn paper), `outline`, `shadow`, `trim`.
Combine: cut out a portrait, sticker it, then animate it in front of a duotone background made from the same photo.

## Smart camera

`analyze_image <asset>` returns faces, the subject box and a focus point. Pass it to the image component:
`AU.component('image', { src, focus: [62, 30], kenburns: 1.15 })` so the crop centres on the face and the slow push moves
toward the eyes, not the middle of the frame. Assets collected by the scout already carry their focus point.

## When nothing real exists

`generate_image <prompt>` makes a free AI illustration (Pollinations, no key) for imagined scenes, metaphors, the
distant past or the future. Never generate real people, real places or real events as if they were documents. Generated
images on the free tier carry Pollinations' small attribution mark at the lower right; leave it intact. A Pollinations key in Settings
gives clean images. Image generation is off unless the user enables it in Settings.

## Icons, logos and flags

`search_icons bangladesh flag` then `collect_icon flag:bd-4x3`. Brand marks: `logos:google`, `logos:tesla`,
`simple-icons:x`. The SVG markup is returned too; paste it inline when you want to colour it with CSS variables
or animate its paths.

## Checklist

- Every real thing named in the narration is shown with real material, not a placeholder shape.
- Images are large enough for their size on screen; no upscaled thumbnails.
- Every collected image has motion (reveal plus a slow push) and depth (shadow, border or layering).
- Highlights land on the spoken word (use the word timings).
- Credits are recorded automatically; add a visible `Source:` line on screen for screenshots and archival photos.
