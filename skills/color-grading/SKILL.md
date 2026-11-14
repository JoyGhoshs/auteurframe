---
name: color-grading
description: Choose and tune the colour grade of a film or a single scene - presets (clean, vivid, warm-film, teal-orange, golden-hour, cool-night, cyberpunk, bleach-bypass, vintage, matte, documentary, pastel, noir, kodak-day, stop-motion) and controls (exposure, contrast, saturation, temperature, tint, teal/orange split, shadows, midtones, highlights, fade, vignette, grain, sharpen, black and white). Use when setting the mood of a film, matching scenes, or when the brief names a look.
stage: edit
tags: [color, colour, grade, grading, lut, look, mood, film look, teal orange, noir, vintage, contrast]
version: 1
---

# Colour grading

The grade is applied by ffmpeg when the master is assembled, so it is exact and identical for every viewer.
The studio stage shows a close preview. Set it in the Look tab or through the project and scene `grade` fields:

```json
"grade": { "preset": "teal-orange", "amount": 85, "contrast": 20, "vignette": 25 }
```

Values run from -100 to 100 (0 is neutral). `amount` (0 to 100) blends the whole grade. A scene `grade` is applied first,
then the film grade.

## Choosing

| story | preset |
|---|---|
| action, trailer, battle | teal-orange |
| spy, horror, night, cold | cool-night |
| neon, tech, club, hacker | cyberpunk |
| history, archive, memories | vintage or documentary |
| romance, summer, sunsets | golden-hour |
| product launch, ads, creators | vivid or clean |
| felt, clay, handmade | stop-motion |
| kids, soft explainers | pastel |
| 1940s, detective, drama | noir |

## Rules

- Correct first (exposure, contrast), then add the creative look. Do not stack strong looks on scene and film.
- One consistent film grade; use scene grades only to match a scene that differs or for a deliberate flashback.
- Keep skin natural: temperature beyond +45 or saturation beyond +35 breaks faces.
- Grain belongs in the grade, not in the scene code: page grain makes every frame expensive to encode.
- Dark designs need less contrast; light designs can take more fade without looking washed out.
