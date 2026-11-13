---
name: multilingual-type
description: Typography and motion rules for Bangla, Hindi and other Indic scripts, Arabic, Urdu, Hebrew, Thai, Chinese, Japanese, Korean and Cyrillic in motion graphics and captions. Use whenever on-screen text or subtitles are not plain English.
roles: [director, art, animator, critic, editor]
tags: [bangla, bengali, hindi, devanagari, arabic, urdu, rtl, hebrew, cjk, chinese, japanese, korean, thai, i18n, fonts, captions, typography]
---

# Multilingual typography for motion

The studio ships local fonts for every major script. Theme variables `--font-display`, `--font-body` and `--font-caption`
already chain a Latin face with the matching script face, so text in any language renders with a real designed font.
Never hardcode a single Latin family on text that may contain another script; use the variables or a family from the catalog.

## Font catalog by script

- Bangla: Hind Siliguri (clean sans, captions, body), Anek Bangla (modern sans, many weights), Baloo Da 2 (rounded bold display),
  Tiro Bangla (editorial serif), Noto Serif Bengali (serif), Galada and Atma (hand lettering, playful), Mina (geometric).
- Hindi, Marathi, Nepali: Mukta, Hind (sans), Baloo 2 (bold display), Rozha One (high contrast display serif), Tiro Devanagari Hindi (serif).
- Arabic, Persian: Cairo (geometric sans, heavy weights), Tajawal (light modern sans), Amiri and Noto Naskh Arabic (classical serif),
  Reem Kufi (kufic display), Lalezar (poster display). Urdu: Noto Nastaliq Urdu.
- Hebrew: Heebo, Rubik (sans), Frank Ruhl Libre (serif).
- Thai: Prompt, Kanit (display), Sarabun (text).
- Chinese: Noto Sans SC or TC, ZCOOL KuaiLe (playful display). Japanese: Noto Sans JP, M PLUS Rounded 1c. Korean: Noto Sans KR, Black Han Sans.
- Tamil, Telugu, Kannada, Malayalam, Gurmukhi, Gujarati, Odia, Sinhala, Khmer, Lao, Myanmar, Ethiopic, Armenian, Georgian: Noto Sans for that script.
- Latin, Cyrillic, Greek, Vietnamese extras: Poppins, Montserrat, Roboto, Open Sans, Outfit, Sora, Lexend, Plus Jakarta Sans, Oswald,
  Barlow Condensed, Abril Fatface, Bungee, Righteous, Lobster, Pacifico, Merriweather, Lora, Cormorant Garamond, Noto Sans, Noto Serif.

## Hard rules

1. Bangla, Devanagari, other Indic scripts, Thai, Arabic and Hebrew must never be split into characters. Conjuncts, vowel signs
   and Arabic joining break when letters are wrapped in separate spans. Use `AU.split(el, { type: 'words' })`; the runtime
   automatically converts char splits into word splits for these scripts, but plan word level motion from the start.
2. No negative letter-spacing and no tracking on these scripts. The runtime forces letter-spacing to 0.
3. Line-height at least 1.3 for Bangla and Devanagari; their vowel signs sit above and below the line. Do not crop text boxes tightly.
4. Uppercase does not exist in these scripts. Emphasis comes from weight, colour, scale and a highlight bar instead.
5. Arabic, Urdu, Persian and Hebrew read right to left. Lay out hero text from the right, run reveals and wipes from right to left,
   and put list bullets on the right. Numbers stay left to right inside the sentence; `dir="auto"` handles that.
6. Chinese and Japanese have no spaces. Animate by character or short phrase; keep line breaks between phrases, never mid word.
7. Keep proper nouns and numbers that the narration says in the same script as the narration.
8. Captions show exactly the subtitle text in the original script. Never transliterate or translate a subtitle unless asked.

## Motion ideas that respect the script

- Bangla and Devanagari: the matra line (the headline stroke) is a beautiful motif. Draw a horizontal ink line first, then
  reveal words hanging from it with a downward settle. Highlight a key word with a soft brush swipe behind it.
- Arabic: reveal words from the right with a calligraphic underline that follows the baseline; kashida stretching is not available,
  so use scale and spacing between words for rhythm.
- CJK: drop characters in on a grid with a tiny overshoot; vertical text (`writing-mode: vertical-rl`) works well for titles in Japanese and Traditional Chinese.
- Mixed language films: give each language one consistent colour and keep the same position for each language across scenes.
