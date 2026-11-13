from __future__ import annotations

import colorsys
import random
from typing import Any

FONTS = {
    "inter": "'Inter Variable', 'Inter', system-ui, sans-serif",
    "grotesk": "'Space Grotesk Variable', 'Inter Variable', sans-serif",
    "fraunces": "'Fraunces Variable', 'Newsreader Variable', Georgia, serif",
    "bricolage": "'Bricolage Grotesque Variable', 'Inter Variable', sans-serif",
    "mono": "'JetBrains Mono Variable', 'Space Mono', monospace",
    "dmserif": "'DM Serif Display', 'Fraunces Variable', Georgia, serif",
    "instrument": "'Instrument Serif', 'Newsreader Variable', Georgia, serif",
    "archivo": "'Archivo Black', 'Anton', sans-serif",
    "bebas": "'Bebas Neue', 'Anton', sans-serif",
    "caveat": "'Caveat Variable', 'Kalam', cursive",
    "marker": "'Permanent Marker', 'Kalam', cursive",
    "syne": "'Syne Variable', 'Inter Variable', sans-serif",
    "unbounded": "'Unbounded Variable', 'Inter Variable', sans-serif",
    "playfair": "'Playfair Display Variable', 'DM Serif Display', serif",
    "pixel": "'Press Start 2P', 'Space Mono', monospace",
    "manrope": "'Manrope Variable', 'Inter Variable', sans-serif",
    "anton": "'Anton', 'Bebas Neue', sans-serif",
    "dmsans": "'DM Sans Variable', 'Inter Variable', sans-serif",
    "newsreader": "'Newsreader Variable', 'Fraunces Variable', Georgia, serif",
    "kalam": "'Kalam', 'Caveat Variable', cursive",
    "spacemono": "'Space Mono', 'JetBrains Mono Variable', monospace",
    "shoulders": "'Big Shoulders Display Variable', 'Bebas Neue', sans-serif",
}

DISPLAY_SCALE = {
    "pixel": 0.5, "unbounded": 0.82, "archivo": 0.88, "syne": 0.95, "grotesk": 0.98, "anton": 1.12, "bebas": 1.18,
    "shoulders": 1.12, "caveat": 1.2, "kalam": 1.0, "marker": 0.92, "dmserif": 1.0, "instrument": 1.1,
}

MULTILINGUAL ="'Noto Sans Bengali', 'Noto Sans Devanagari', 'Noto Sans Arabic', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans SC'"

PACKS: list[dict[str, Any]] = [
    {
        "id": "editorial-paper", "name": "Editorial Paper", "category": "Editorial", "dark": False,
        "tagline": "Magazine layouts on warm paper, serif headlines, ink rules.",
        "palettes": [
            {"bg": "#F4EFE6", "bg-2": "#EAE2D3", "ink": "#1B1A17", "ink-2": "#3A3833", "muted": "#7C766A", "accent": "#E4572E", "accent-2": "#2E5EAA", "line": "rgba(27,26,23,0.16)"},
            {"bg": "#F3F0E8", "bg-2": "#E6E0D2", "ink": "#16181D", "ink-2": "#33363D", "muted": "#787469", "accent": "#C8372D", "accent-2": "#3F7D58", "line": "rgba(22,24,29,0.15)"},
            {"bg": "#F6F1EA", "bg-2": "#ECE3D6", "ink": "#1E1B18", "ink-2": "#40392F", "muted": "#857C6E", "accent": "#2B59C3", "accent-2": "#E0A100", "line": "rgba(30,27,24,0.15)"},
        ],
        "fonts": [("fraunces", "inter"), ("newsreader", "dmsans"), ("instrument", "inter")],
        "ground": ["paper"], "texture": ["paper", "grain"], "radius": 6, "stroke": 3,
        "caption": "boxed", "motion": "measured", "transitions": ["wipeleft", "smoothleft", "fade", "slideup"],
        "archetypes": ["kinetic-title", "quote", "versus", "timeline", "big-number", "list-reveal", "image-focus", "line-chart", "word-stack", "end-card"],
        "brief": "Editorial magazine spreads. Big serif headline, thin ink rules, small caps kickers, generous margins, one accent used for emphasis only. Motion is measured: rule lines draw, headline lines rise from masks, images reveal with clip wipes.",
    },
    {
        "id": "vox-collage", "name": "Vox Collage", "category": "Explainer", "dark": False,
        "tagline": "Paper cutouts, highlighter strokes, archival textures.",
        "palettes": [
            {"bg": "#EDE6D8", "bg-2": "#DDD3BF", "ink": "#141414", "ink-2": "#2B2B2B", "muted": "#6E675B", "accent": "#F2C14E", "accent-2": "#D7263D", "line": "rgba(20,20,20,0.18)"},
            {"bg": "#E9E4DA", "bg-2": "#D8CFBF", "ink": "#121212", "ink-2": "#2E2E2E", "muted": "#6B6457", "accent": "#FFD400", "accent-2": "#1E6FD9", "line": "rgba(18,18,18,0.18)"},
        ],
        "fonts": [("playfair", "dmsans"), ("instrument", "manrope"), ("dmserif", "inter")],
        "ground": ["paper"], "texture": ["halftone", "grain"], "radius": 2, "stroke": 3,
        "caption": "boxed", "motion": "snappy", "transitions": ["slideleft", "wipeup", "hlslice", "fade"],
        "archetypes": ["kinetic-title", "image-focus", "quote", "versus", "timeline", "big-number", "map-pins", "list-reveal", "doodle-explain", "end-card"],
        "brief": "Vox style collage explainer. Torn paper cards, yellow highlighter swipes behind key words, archival photos with halftone, red circles and underlines drawn on. Cards slide in with slight rotation and settle. Camera pushes slowly.",
    },
    {
        "id": "cosmic-flat", "name": "Cosmic Flat", "category": "Explainer", "dark": True,
        "tagline": "Flat vector worlds, deep navy space, warm glow accents.",
        "palettes": [
            {"bg": "#0E1A3A", "bg-2": "#1B2E63", "ink": "#F4F6FF", "ink-2": "#C9D3F5", "muted": "#8D9AC7", "accent": "#FFB648", "accent-2": "#FF5E7E", "line": "rgba(244,246,255,0.14)"},
            {"bg": "#10223F", "bg-2": "#1D3A66", "ink": "#F2F7FF", "ink-2": "#C5D6F2", "muted": "#8AA0C6", "accent": "#5CE1B9", "accent-2": "#FF8F5A", "line": "rgba(242,247,255,0.14)"},
            {"bg": "#1A1240", "bg-2": "#2C1F66", "ink": "#FAF5FF", "ink-2": "#D8CCF5", "muted": "#9D8FCB", "accent": "#FFCE4F", "accent-2": "#4FD1FF", "line": "rgba(250,245,255,0.14)"},
        ],
        "fonts": [("bricolage", "manrope"), ("syne", "manrope"), ("unbounded", "dmsans")],
        "ground": ["stars", "mesh"], "texture": ["grain"], "radius": 28, "stroke": 4,
        "caption": "pop", "motion": "bouncy", "transitions": ["circleopen", "smoothup", "zoomin", "fade"],
        "archetypes": ["scale-zoom", "icon-grid", "big-number", "process-flow", "donut", "kinetic-title", "bar-race", "equation", "end-card"],
        "brief": "Flat vector science explainer. Rounded geometric shapes, no outlines, soft inner glows, scale comparisons, orbiting elements, everything gently floating. Characters and icons pop in with small overshoot and keep breathing.",
    },
    {
        "id": "swiss-kinetic", "name": "Swiss Kinetic", "category": "Typography", "dark": False,
        "tagline": "Grid-locked kinetic type, red signal, hard cuts.",
        "palettes": [
            {"bg": "#F2F2F0", "bg-2": "#E4E4E1", "ink": "#0A0A0A", "ink-2": "#222222", "muted": "#737373", "accent": "#FF3B1F", "accent-2": "#1F4FFF", "line": "rgba(10,10,10,0.14)"},
            {"bg": "#FAFAF7", "bg-2": "#ECECE6", "ink": "#0B0B0B", "ink-2": "#262626", "muted": "#7A7A74", "accent": "#0057FF", "accent-2": "#FF4D00", "line": "rgba(11,11,11,0.14)"},
        ],
        "fonts": [("grotesk", "inter"), ("inter", "inter"), ("archivo", "grotesk")],
        "ground": ["grid", "solid"], "texture": ["none"], "radius": 0, "stroke": 4,
        "caption": "pop", "motion": "snappy", "transitions": ["slideleft", "slideup", "wipeleft", "squeezeh"],
        "archetypes": ["kinetic-title", "word-stack", "big-number", "list-reveal", "versus", "bar-race", "timeline", "end-card"],
        "brief": "International typographic style in motion. Strict grid, flush-left heavy grotesk, numbers as heroes, one red signal color. Words slam in on the beat with snap settle, masks and line splits, hard cuts and slides.",
    },
    {
        "id": "neon-night", "name": "Neon Night", "category": "Tech", "dark": True,
        "tagline": "Dark glass, aurora gradients, neon edges.",
        "palettes": [
            {"bg": "#07060D", "bg-2": "#1A1033", "ink": "#F2F0FF", "ink-2": "#C9C3EE", "muted": "#8C86B3", "accent": "#00F0FF", "accent-2": "#FF2BD6", "line": "rgba(242,240,255,0.14)"},
            {"bg": "#05080F", "bg-2": "#0F1E33", "ink": "#EEF6FF", "ink-2": "#C2D4EA", "muted": "#7F95B0", "accent": "#7CFF6B", "accent-2": "#6B8CFF", "line": "rgba(238,246,255,0.14)"},
        ],
        "fonts": [("unbounded", "manrope"), ("syne", "inter"), ("grotesk", "manrope")],
        "ground": ["aurora", "mesh"], "texture": ["grain"], "radius": 22, "stroke": 2,
        "caption": "pop", "motion": "smooth", "transitions": ["smoothleft", "fadeblack", "zoomin", "circleopen"],
        "archetypes": ["kinetic-title", "ui-mockup", "big-number", "icon-grid", "process-flow", "line-chart", "word-stack", "end-card"],
        "brief": "Futuristic product and AI aesthetic. Glassmorphism cards with blur and thin luminous borders, aurora gradient ground, neon accent glows, scramble text reveals, smooth glides and parallax depth.",
    },
    {
        "id": "whiteboard-doodle", "name": "Whiteboard Doodle", "category": "Hand-drawn", "dark": False,
        "tagline": "Hand-drawn marker doodles that draw themselves.",
        "palettes": [
            {"bg": "#FBFBF8", "bg-2": "#F0F0EA", "ink": "#22223B", "ink-2": "#3D3D5C", "muted": "#7D7D95", "accent": "#FF6B35", "accent-2": "#2A9D8F", "line": "rgba(34,34,59,0.14)"},
            {"bg": "#FFFDF6", "bg-2": "#F4F0E2", "ink": "#1D2433", "ink-2": "#384056", "muted": "#7A8296", "accent": "#E63946", "accent-2": "#457B9D", "line": "rgba(29,36,51,0.14)"},
        ],
        "fonts": [("caveat", "kalam"), ("marker", "kalam"), ("kalam", "kalam")],
        "ground": ["paper", "dots"], "texture": ["paper"], "radius": 12, "stroke": 4,
        "caption": "minimal", "motion": "hand", "transitions": ["wipeleft", "fade", "smoothright"],
        "archetypes": ["doodle-explain", "process-flow", "list-reveal", "versus", "big-number", "quote", "kinetic-title", "end-card"],
        "brief": "Whiteboard explainer drawn live. Wobbly rough marker lines that boil at 8 fps, shapes draw on stroke by stroke, handwritten labels, arrows connecting ideas, hachure fills. Nothing is perfectly straight.",
    },
    {
        "id": "blueprint", "name": "Blueprint", "category": "Technical", "dark": True,
        "tagline": "Engineering drawings, measured lines, annotations.",
        "palettes": [
            {"bg": "#0F3D7A", "bg-2": "#134A92", "ink": "#EAF2FF", "ink-2": "#BCD2F5", "muted": "#8FB0DD", "accent": "#FFD23F", "accent-2": "#FF7B54", "line": "rgba(234,242,255,0.2)"},
            {"bg": "#0B2E4F", "bg-2": "#103D66", "ink": "#E8F4FF", "ink-2": "#B5D3EE", "muted": "#86A9C9", "accent": "#4FF0C2", "accent-2": "#FFC857", "line": "rgba(232,244,255,0.2)"},
        ],
        "fonts": [("shoulders", "mono"), ("spacemono", "mono"), ("grotesk", "mono")],
        "ground": ["blueprint"], "texture": ["grain"], "radius": 0, "stroke": 2,
        "caption": "minimal", "motion": "measured", "transitions": ["wipeleft", "wiperight", "rectcrop", "fade"],
        "archetypes": ["process-flow", "ui-mockup", "timeline", "big-number", "line-chart", "doodle-explain", "kinetic-title", "end-card"],
        "brief": "Technical blueprint. Cyan white strokes on deep blue grid, dimension lines with arrowheads, monospace annotations, components drawn on with DrawSVG, callouts that snap to targets.",
    },
    {
        "id": "risograph", "name": "Risograph", "category": "Print", "dark": False,
        "tagline": "Two-ink riso print, misregistration, halftone grit.",
        "palettes": [
            {"bg": "#F6EEDC", "bg-2": "#EBDFC4", "ink": "#2B2B6E", "ink-2": "#3D3D85", "muted": "#7471A0", "accent": "#FF48B0", "accent-2": "#FFE800", "line": "rgba(43,43,110,0.2)"},
            {"bg": "#F4EFE3", "bg-2": "#E8DFCB", "ink": "#00664F", "ink-2": "#0E7A61", "muted": "#5C8C7E", "accent": "#FF6C2F", "accent-2": "#5EC8E5", "line": "rgba(0,102,79,0.2)"},
        ],
        "fonts": [("archivo", "grotesk"), ("anton", "spacemono"), ("bricolage", "grotesk")],
        "ground": ["halftone"], "texture": ["halftone"], "radius": 0, "stroke": 3,
        "caption": "pop", "motion": "snappy", "transitions": ["hlslice", "slideright", "pixelize", "wipeup"],
        "archetypes": ["kinetic-title", "word-stack", "big-number", "icon-grid", "versus", "list-reveal", "quote", "end-card"],
        "brief": "Risograph zine. Two flat inks overprinting with multiply, slight misregistration offsets, halftone dots, chunky condensed type, stamped shapes that pop and jitter a few pixels.",
    },
    {
        "id": "math-stage", "name": "Math Stage", "category": "Education", "dark": True,
        "tagline": "Equations write themselves on a dark stage.",
        "palettes": [
            {"bg": "#0C0C0F", "bg-2": "#17171D", "ink": "#ECECEC", "ink-2": "#BDBDC4", "muted": "#85858F", "accent": "#58C4DD", "accent-2": "#FC6255", "line": "rgba(236,236,236,0.14)"},
            {"bg": "#0E0F12", "bg-2": "#1A1C21", "ink": "#F0F0F0", "ink-2": "#C2C2C8", "muted": "#888892", "accent": "#FFFF00", "accent-2": "#83C167", "line": "rgba(240,240,240,0.14)"},
        ],
        "fonts": [("newsreader", "inter"), ("fraunces", "inter"), ("instrument", "dmsans")],
        "ground": ["spotlight", "solid"], "texture": ["none"], "radius": 10, "stroke": 4,
        "caption": "minimal", "motion": "smooth", "transitions": ["fadeblack", "fade", "dissolve"],
        "archetypes": ["equation", "line-chart", "process-flow", "big-number", "kinetic-title", "scale-zoom", "end-card"],
        "brief": "Mathematical animation on a black stage. Equations write on glyph by glyph, shapes are created stroke-first then filled, smooth transforms between states, color codes one concept per color, slow deliberate camera.",
    },
    {
        "id": "keynote-light", "name": "Keynote Light", "category": "Corporate", "dark": False,
        "tagline": "Clean product launch, bright and confident.",
        "palettes": [
            {"bg": "#FFFFFF", "bg-2": "#F3F4F7", "ink": "#0B0B0F", "ink-2": "#2A2C33", "muted": "#7C7F8A", "accent": "#2F6BFF", "accent-2": "#9B5CFF", "line": "rgba(11,11,15,0.1)"},
            {"bg": "#FBFBFD", "bg-2": "#EFF1F5", "ink": "#101114", "ink-2": "#2C2E35", "muted": "#7A7D88", "accent": "#00A86B", "accent-2": "#0A84FF", "line": "rgba(16,17,20,0.1)"},
        ],
        "fonts": [("inter", "inter"), ("manrope", "inter"), ("dmsans", "dmsans")],
        "ground": ["spotlight", "mesh"], "texture": ["none"], "radius": 28, "stroke": 2,
        "caption": "boxed", "motion": "smooth", "transitions": ["fade", "smoothleft", "zoomin", "slideup"],
        "archetypes": ["kinetic-title", "ui-mockup", "big-number", "icon-grid", "bar-race", "versus", "image-focus", "end-card"],
        "brief": "Apple style keynote. Huge confident headline, gradient-clipped hero word, floating device mockups with soft shadows, big stats counting up, generous whitespace, slow push-ins.",
    },
    {
        "id": "data-cinema", "name": "Data Cinema", "category": "Data", "dark": True,
        "tagline": "Cinematic dashboards, numbers as heroes.",
        "palettes": [
            {"bg": "#0B0F14", "bg-2": "#141B24", "ink": "#E8EEF5", "ink-2": "#B7C3D1", "muted": "#7D8B9C", "accent": "#FF6A3D", "accent-2": "#3DD6C6", "line": "rgba(232,238,245,0.12)"},
            {"bg": "#0A0D12", "bg-2": "#131A22", "ink": "#EDF2F7", "ink-2": "#BAC6D3", "muted": "#7E8C9B", "accent": "#FFC53D", "accent-2": "#7A8CFF", "line": "rgba(237,242,247,0.12)"},
        ],
        "fonts": [("shoulders", "dmsans"), ("bebas", "inter"), ("grotesk", "dmsans")],
        "ground": ["grid", "spotlight"], "texture": ["grain", "vignette"], "radius": 14, "stroke": 3,
        "caption": "karaoke", "motion": "measured", "transitions": ["smoothleft", "fadeblack", "wipeleft", "zoomin"],
        "archetypes": ["big-number", "bar-race", "line-chart", "donut", "map-pins", "timeline", "versus", "kinetic-title", "end-card"],
        "brief": "Data journalism cinema. Dark ground with fine grid, condensed numerals counting up, charts that draw on, annotation callouts, one hot accent marking the story number, slow camera drift.",
    },
    {
        "id": "brutalist", "name": "Brutalist", "category": "Typography", "dark": False,
        "tagline": "Raw blocks, thick borders, loud type.",
        "palettes": [
            {"bg": "#E9E5DC", "bg-2": "#D6D0C3", "ink": "#0D0D0D", "ink-2": "#1F1F1F", "muted": "#5E5A52", "accent": "#FF4F00", "accent-2": "#3A5BFF", "line": "rgba(13,13,13,0.9)"},
            {"bg": "#EFFF3D", "bg-2": "#DCEB2A", "ink": "#0B0B0B", "ink-2": "#1A1A1A", "muted": "#4D5310", "accent": "#0B0B0B", "accent-2": "#FF2E63", "line": "rgba(11,11,11,0.9)"},
        ],
        "fonts": [("anton", "spacemono"), ("archivo", "spacemono"), ("bebas", "mono")],
        "ground": ["solid"], "texture": ["grain"], "radius": 0, "stroke": 6,
        "caption": "pop", "motion": "snappy", "transitions": ["slideleft", "squeezev", "hrslice", "rectcrop"],
        "archetypes": ["word-stack", "kinetic-title", "big-number", "list-reveal", "versus", "end-card"],
        "brief": "Neo brutalist. Thick black borders, hard drop shadows offset 12px, condensed uppercase, boxes that slam in without easing softness, sticker labels, marquee text.",
    },
    {
        "id": "soft-clay", "name": "Soft Clay", "category": "Friendly", "dark": False,
        "tagline": "Puffy 3D shapes, pastel light, gentle bounce.",
        "palettes": [
            {"bg": "#F3E9E2", "bg-2": "#E9D7CB", "ink": "#3B2F2F", "ink-2": "#5A4A48", "muted": "#9A8783", "accent": "#FF8A65", "accent-2": "#7FB7BE", "line": "rgba(59,47,47,0.12)"},
            {"bg": "#E8EEF6", "bg-2": "#D6E0EE", "ink": "#25304A", "ink-2": "#435071", "muted": "#8590A8", "accent": "#7C6CFF", "accent-2": "#FF9EC4", "line": "rgba(37,48,74,0.12)"},
        ],
        "fonts": [("bricolage", "manrope"), ("syne", "manrope"), ("manrope", "manrope")],
        "ground": ["clay"], "texture": ["none"], "radius": 40, "stroke": 3,
        "caption": "boxed", "motion": "bouncy", "transitions": ["circleopen", "smoothup", "fade", "zoomin"],
        "archetypes": ["icon-grid", "process-flow", "big-number", "donut", "kinetic-title", "list-reveal", "ui-mockup", "end-card"],
        "brief": "Soft claymorphism. Pillowy rounded cards with inner highlights and long soft shadows, pastel ground, icons in puffy bubbles, everything springs in with gentle overshoot and keeps floating.",
    },
    {
        "id": "retro-pixel", "name": "Retro Pixel", "category": "Gaming", "dark": True,
        "tagline": "8-bit arcade, CRT scanlines, stepped motion.",
        "palettes": [
            {"bg": "#1B1E3C", "bg-2": "#2A2F5E", "ink": "#F8F4E3", "ink-2": "#D9D3BC", "muted": "#9C98B8", "accent": "#FF5A5F", "accent-2": "#FFD447", "line": "rgba(248,244,227,0.16)"},
            {"bg": "#0F2016", "bg-2": "#183421", "ink": "#D7FFD9", "ink-2": "#A9E6AE", "muted": "#6FA477", "accent": "#39FF14", "accent-2": "#FFB000", "line": "rgba(215,255,217,0.16)"},
        ],
        "fonts": [("pixel", "spacemono"), ("pixel", "mono")],
        "ground": ["dots"], "texture": ["scanlines"], "radius": 0, "stroke": 4,
        "caption": "typewriter", "motion": "stepped", "transitions": ["pixelize", "slideleft", "fadeblack"],
        "archetypes": ["kinetic-title", "big-number", "list-reveal", "icon-grid", "bar-race", "end-card"],
        "brief": "8-bit arcade. Pixel font, stepped eases (steps), blinking cursors, score counters, chunky pixel borders, CRT scanlines and slight glow, things blip in rather than slide.",
    },
    {
        "id": "luxury-serif", "name": "Luxury Serif", "category": "Brand", "dark": True,
        "tagline": "Black and gold, slow reveals, editorial italics.",
        "palettes": [
            {"bg": "#0E0D0B", "bg-2": "#1C1A16", "ink": "#F3EDE2", "ink-2": "#D4CCBD", "muted": "#958C7C", "accent": "#C8A96A", "accent-2": "#8C7B5A", "line": "rgba(243,237,226,0.14)"},
            {"bg": "#101413", "bg-2": "#1A201E", "ink": "#EFEDE6", "ink-2": "#CECBC0", "muted": "#8E8B80", "accent": "#B9A27A", "accent-2": "#6F8A7E", "line": "rgba(239,237,230,0.14)"},
        ],
        "fonts": [("dmserif", "manrope"), ("playfair", "manrope"), ("instrument", "dmsans")],
        "ground": ["spotlight"], "texture": ["grain", "vignette"], "radius": 2, "stroke": 1,
        "caption": "minimal", "motion": "slow", "transitions": ["fadeblack", "dissolve", "fade"],
        "archetypes": ["kinetic-title", "quote", "image-focus", "big-number", "word-stack", "end-card"],
        "brief": "Luxury brand film. Black and gold, high contrast serif with italic accents, letter-spaced small caps, very slow blur-to-sharp reveals, thin gold hairlines drawing, long holds.",
    },
    {
        "id": "gradient-product", "name": "Gradient Product", "category": "SaaS", "dark": False,
        "tagline": "Vivid mesh gradients, floating UI, startup energy.",
        "palettes": [
            {"bg": "#F7F7FB", "bg-2": "#ECEBFA", "ink": "#101018", "ink-2": "#2C2C3A", "muted": "#7A7A8C", "accent": "#6E56FF", "accent-2": "#FF6FB5", "line": "rgba(16,16,24,0.1)"},
            {"bg": "#F6FAF9", "bg-2": "#E3F3EF", "ink": "#0D1716", "ink-2": "#263532", "muted": "#74837F", "accent": "#00B386", "accent-2": "#FFB224", "line": "rgba(13,23,22,0.1)"},
        ],
        "fonts": [("syne", "inter"), ("bricolage", "inter"), ("manrope", "inter")],
        "ground": ["mesh"], "texture": ["grain"], "radius": 24, "stroke": 2,
        "caption": "pop", "motion": "smooth", "transitions": ["smoothleft", "zoomin", "slideup", "circleopen"],
        "archetypes": ["ui-mockup", "kinetic-title", "icon-grid", "big-number", "process-flow", "versus", "word-stack", "end-card"],
        "brief": "Modern SaaS launch. Colourful mesh gradient ground, frosted UI cards that float in 3D with parallax, cursor interactions, metric chips counting up, crisp sans type.",
    },
    {
        "id": "creator-bold", "name": "Creator Bold", "category": "Shorts", "dark": True,
        "tagline": "Viral shorts energy, punchy captions, fast cuts.",
        "palettes": [
            {"bg": "#0D0D0D", "bg-2": "#1C1C1C", "ink": "#FFFFFF", "ink-2": "#D9D9D9", "muted": "#8F8F8F", "accent": "#FFE500", "accent-2": "#FF3D3D", "line": "rgba(255,255,255,0.14)"},
            {"bg": "#0B0B12", "bg-2": "#191932", "ink": "#FFFFFF", "ink-2": "#D6D6EA", "muted": "#8C8CA8", "accent": "#3DFF8F", "accent-2": "#8C5CFF", "line": "rgba(255,255,255,0.14)"},
        ],
        "fonts": [("anton", "manrope"), ("bebas", "inter"), ("archivo", "manrope")],
        "ground": ["spotlight", "aurora"], "texture": ["grain"], "radius": 18, "stroke": 4,
        "caption": "pop", "motion": "punchy", "transitions": ["zoomin", "slideup", "smoothup", "hblur"],
        "archetypes": ["word-stack", "big-number", "kinetic-title", "versus", "list-reveal", "image-focus", "icon-grid", "end-card"],
        "brief": "Short-form creator style. Hook in the first second, massive condensed words that punch in with scale, shake on impact, yellow highlight on the key word, emoji-free icon stickers, cuts every 1 to 2 seconds.",
    },
    {
        "id": "paper-cut", "name": "Paper Cut", "category": "Craft", "dark": False,
        "tagline": "Layered paper worlds, soft shadows, storybook warmth.",
        "palettes": [
            {"bg": "#F6E7D2", "bg-2": "#EED3B0", "ink": "#2E2A3A", "ink-2": "#4A4459", "muted": "#8A7F86", "accent": "#E86A4E", "accent-2": "#F6B94B", "line": "rgba(46,42,58,0.14)"},
            {"bg": "#E6F0EA", "bg-2": "#C9DFD2", "ink": "#1F3A3D", "ink-2": "#3A5659", "muted": "#7C9396", "accent": "#2F8F83", "accent-2": "#F2C14E", "line": "rgba(31,58,61,0.14)"},
            {"bg": "#EEE8F6", "bg-2": "#D9CDEB", "ink": "#2C2448", "ink-2": "#4A4068", "muted": "#8B84A3", "accent": "#7A5CE0", "accent-2": "#FF9F80", "line": "rgba(44,36,72,0.14)"},
        ],
        "fonts": [("bricolage", "manrope"), ("fraunces", "dmsans"), ("caveat", "manrope")],
        "ground": ["paper"], "texture": ["paper", "grain"], "radius": 22, "stroke": 3,
        "caption": "boxed", "motion": "smooth", "transitions": ["smoothup", "circleopen", "wipeup", "fade"],
        "archetypes": ["paper-cut", "kinetic-title", "icon-grid", "process-flow", "doodle-explain", "photo-stack", "mascot-talk", "end-card"],
        "brief": "Handcrafted paper-cut diorama. Layered torn-edge paper hills and clouds with soft drop shadows, parallax depth, paper banners that swing in on strings, warm storybook palette, gentle settles.",
    },
    {
        "id": "documentary", "name": "Documentary", "category": "Cinematic", "dark": True,
        "tagline": "Footage-led, lower thirds, archival calm.",
        "palettes": [
            {"bg": "#111315", "bg-2": "#1E2124", "ink": "#F1EFEA", "ink-2": "#CFCBC2", "muted": "#8F8B83", "accent": "#E8B04A", "accent-2": "#6FA3C7", "line": "rgba(241,239,234,0.16)"},
            {"bg": "#14110F", "bg-2": "#221D19", "ink": "#F4EEE6", "ink-2": "#D2C9BD", "muted": "#958B7E", "accent": "#D9583B", "accent-2": "#9DB5A0", "line": "rgba(244,238,230,0.16)"},
        ],
        "fonts": [("newsreader", "inter"), ("instrument", "dmsans"), ("fraunces", "manrope")],
        "ground": ["spotlight"], "texture": ["grain", "vignette"], "radius": 4, "stroke": 2,
        "caption": "minimal", "motion": "slow", "transitions": ["fadeblack", "dissolve", "fade", "smoothleft"],
        "archetypes": ["image-focus", "lower-third", "quote", "timeline", "map-pins", "big-number", "kinetic-title", "end-card"],
        "brief": "Documentary film. Footage and stills lead with slow Ken Burns push, restrained lower thirds, serif titles, archival date stamps, map pins, measured fades to black between chapters.",
    },
]

MOTION = {
    "measured": {"tempo": 1.0, "enter": "au.softLand", "exit": "au.exit", "accent": "au.snapSettle", "stagger": 0.07},
    "snappy": {"tempo": 0.82, "enter": "au.snapSettle", "exit": "au.exit", "accent": "au.punch", "stagger": 0.05},
    "smooth": {"tempo": 1.1, "enter": "au.glide", "exit": "au.exit", "accent": "au.softLand", "stagger": 0.08},
    "bouncy": {"tempo": 0.95, "enter": "au.pop", "exit": "au.anticipate", "accent": "au.pop", "stagger": 0.08},
    "hand": {"tempo": 1.05, "enter": "au.softLand", "exit": "au.exit", "accent": "au.snapSettle", "stagger": 0.1},
    "stepped": {"tempo": 0.9, "enter": "steps(6)", "exit": "steps(4)", "accent": "steps(3)", "stagger": 0.09},
    "slow": {"tempo": 1.35, "enter": "au.glide", "exit": "au.exit", "accent": "au.softLand", "stagger": 0.12},
    "punchy": {"tempo": 0.72, "enter": "au.punch", "exit": "au.exit", "accent": "au.pop", "stagger": 0.04},
}

ASPECTS = {
    "16:9": (1920, 1080),
    "9:16": (1080, 1920),
    "1:1": (1080, 1080),
    "4:5": (1080, 1350),
}


def pack(style_id: str) -> dict[str, Any]:
    for item in PACKS:
        if item["id"] == style_id:
            return item
    return PACKS[0]


def catalogue() -> list[dict[str, Any]]:
    out = []
    for item in PACKS:
        palette = item["palettes"][0]
        display, body = item["fonts"][0]
        out.append({
            "id": item["id"], "name": item["name"], "category": item["category"], "tagline": item["tagline"], "dark": item["dark"],
            "palette": palette, "palettes": item["palettes"], "display": FONTS[display], "body": FONTS[body], "caption": item["caption"],
            "motion": item["motion"], "transitions": item["transitions"], "archetypes": item["archetypes"], "brief": item["brief"],
            "ground": item["ground"][0], "texture": item["texture"][0],
        })
    return out


def _hex_rgb(value: str) -> tuple[float, float, float]:
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) / 255 for i in (0, 2, 4))


def _rgb_hex(rgb: tuple[float, float, float]) -> str:
    return "#" + "".join(f"{max(0, min(255, round(c * 255))):02X}" for c in rgb)


def shift_hue(value: str, degrees: float) -> str:
    if not value.startswith("#") or len(value) != 7:
        return value
    r, g, b = _hex_rgb(value)
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    return _rgb_hex(colorsys.hls_to_rgb((h + degrees / 360.0) % 1.0, l, s))


def type_scale(width: int, height: int) -> dict[str, str]:
    short = min(width, height)
    portrait = height > width
    base = short * (1.0 if not portrait else 1.08)
    return {
        "--fs-hero": f"{round(base * 0.2)}px",
        "--fs-xl": f"{round(base * 0.125)}px",
        "--fs-lg": f"{round(base * 0.082)}px",
        "--fs-md": f"{round(base * 0.056)}px",
        "--fs-sm": f"{round(base * 0.04)}px",
        "--fs-min": f"{round(base * 0.032)}px",
    }


def build_bible(style_id: str, seed: int, width: int, height: int, overrides: dict[str, Any] | None = None, reference_palette: list[str] | None = None) -> dict[str, Any]:
    item = pack(style_id)
    rnd = random.Random(seed * 7919 + len(style_id))
    palette = dict(rnd.choice(item["palettes"]))
    if rnd.random() < 0.35:
        palette["accent"] = shift_hue(palette["accent"], rnd.uniform(-14, 14))
    if reference_palette:
        refs = [c for c in reference_palette if isinstance(c, str) and c.startswith("#") and len(c) == 7]
        if refs:
            palette["accent"] = refs[0]
            if len(refs) > 1:
                palette["accent-2"] = refs[1]
    display, body = rnd.choice(item["fonts"])
    ground = rnd.choice(item["ground"])
    texture = rnd.choice(item["texture"])
    transitions = list(item["transitions"])
    rnd.shuffle(transitions)
    motion = MOTION[item["motion"]]
    bible = {
        "style": item["id"], "name": item["name"], "brief": item["brief"], "dark": item["dark"], "palette": palette,
        "fonts": {"display": FONTS[display], "body": FONTS[body], "mono": FONTS["mono"], "caption": FONTS[display]},
        "font_keys": {"display": display, "body": body},
        "ground": ground, "texture": texture, "radius": item["radius"], "stroke": item["stroke"], "caption": item["caption"],
        "motion": dict(motion, name=item["motion"]), "transitions": transitions, "archetypes": list(item["archetypes"]),
        "grain": 0.08 if item["dark"] else 0.05, "seed": seed,
    }
    if overrides:
        for key, value in overrides.items():
            if key == "palette" and isinstance(value, dict):
                bible["palette"].update({k: v for k, v in value.items() if isinstance(v, str)})
            elif key == "fonts" and isinstance(value, dict):
                bible["fonts"].update({k: v for k, v in value.items() if isinstance(v, str)})
            elif value is not None:
                bible[key] = value
    return bible


def theme_css(bible: dict[str, Any], width: int, height: int, scripts: list[str] | None = None, caption_font: str | None = None) -> str:
    from . import fonts as fontlib
    tokens: dict[str, str] = {}
    for key, value in bible["palette"].items():
        tokens[f"--{key}"] = value
    keys = bible.get("font_keys") or {}
    picks = bible.get("font_family") or {}
    scripts = scripts or []
    dcat = fontlib.KEY_CATEGORY.get(keys.get("display", ""), "display")
    bcat = fontlib.KEY_CATEGORY.get(keys.get("body", ""), "sans")
    tokens["--font-display"] = fontlib.stack_for(bible["fonts"]["display"], dcat, scripts, picks.get("display"))
    tokens["--font-body"] = fontlib.stack_for(bible["fonts"]["body"], bcat if bcat != "display" else "sans", scripts, picks.get("body"))
    tokens["--font-mono"] = bible["fonts"]["mono"]
    tokens["--font-caption"] = fontlib.stack_for(bible["fonts"].get("caption", bible["fonts"]["display"]), dcat, scripts, caption_font or picks.get("caption") or picks.get("display"))
    tokens["--radius"] = f"{bible.get('radius', 12)}px"
    tokens["--stroke"] = f"{bible.get('stroke', 3)}px"
    tokens["--grain"] = str(bible.get("grain", 0.06))
    tokens["--tempo"] = str(bible["motion"].get("tempo", 1.0))
    tokens["--display-scale"] = str(DISPLAY_SCALE.get(bible.get("font_keys", {}).get("display", ""), 1.0)) if not scripts or scripts[0] in ("cyrillic", "greek", "vietnamese") else "1"
    scale = type_scale(width, height)
    tall = {"bengali", "devanagari", "tamil", "telugu", "kannada", "malayalam", "gurmukhi", "gujarati", "oriya", "sinhala", "myanmar", "khmer", "lao", "thai"}
    factor = 0.84 if any(s in tall for s in scripts[:1]) else 0.9 if any(s in ("han-sc", "han-tc", "japanese", "korean", "arabic", "hebrew") for s in scripts[:1]) else 1.0
    if factor != 1.0:
        scale = {k: f"{round(float(v[:-2]) * factor)}px" for k, v in scale.items()}
    tokens.update(scale)
    body = ";".join(f"{k}:{v}" for k, v in tokens.items())
    return f":root{{{body}}}"


def fingerprint(bible: dict[str, Any], archetypes: list[str]) -> dict[str, Any]:
    return {
        "style": bible.get("style"), "accent": bible["palette"].get("accent"), "display": bible.get("font_keys", {}).get("display"),
        "ground": bible.get("ground"), "rhythm": "-".join(a[:3] for a in archetypes[:6]),
    }


AUTO_RULES = [
    (("space", "planet", "galaxy", "universe", "star", "orbit", "cosmic", "science", "atom"), "cosmic-flat"),
    (("math", "equation", "proof", "theorem", "physics", "calculus"), "math-stage"),
    (("data", "statistic", "percent", "market", "economy", "chart", "revenue", "growth"), "data-cinema"),
    (("code", "developer", "api", "software", "ai ", "machine learning", "hacker", "terminal"), "neon-night"),
    (("app", "saas", "startup", "product", "dashboard", "launch"), "gradient-product"),
    (("history", "war", "documentary", "investigation", "archive", "politics"), "documentary"),
    (("luxury", "fashion", "perfume", "jewel", "premium", "watch"), "luxury-serif"),
    (("kids", "children", "friendly", "cute", "tips", "health", "wellness"), "soft-clay"),
    (("story", "fairy", "village", "journey", "once upon"), "paper-cut"),
    (("explain", "why ", "how ", "map", "evidence"), "vox-collage"),
    (("game", "retro", "pixel", "arcade"), "retro-pixel"),
    (("tutorial", "lesson", "learn", "whiteboard", "step by step"), "whiteboard-doodle"),
    (("engineering", "blueprint", "architecture", "machine", "design system"), "blueprint"),
    (("shorts", "tiktok", "reel", "viral", "hook"), "creator-bold"),
]


def auto_pack(brief: str, portrait: bool = False) -> str:
    text = " " + (brief or "").lower() + " "
    best, score = None, 0
    for words, pid in AUTO_RULES:
        s = sum(text.count(w) for w in words)
        if s > score:
            best, score = pid, s
    return best or ("creator-bold" if portrait else "editorial-paper")
