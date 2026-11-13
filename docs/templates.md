# Template format

Templates are directed films with blanks. A template file is JSON in `templates/`. AuteurFrame loads every valid file at
startup, and studios that follow the template feed download new ones from `release.json`.

## File

| Field | Required | Description |
|---|---|---|
| `format` | yes | Always `1`. |
| `id` | yes | Unique id: lowercase letters, digits and dashes, 2 to 49 characters. Must not match a built-in template. |
| `version` | yes | Positive integer. Raise it whenever you change the file so studios update their copy. |
| `name` | yes | Title shown in the gallery, up to 60 characters. |
| `category` | yes | Gallery filter, up to 30 characters. Existing categories group together. |
| `description` | yes | One or two sentences, up to 300 characters. |
| `style` | yes | A style pack id such as `gradient-product`, `neon-night`, `keynote-light`, `paper-cut`, `documentary`, `vox-collage`. |
| `aspect` | yes | `16:9`, `9:16`, `1:1` or `4:5`. Users can change it later. |
| `mood` | no | Music mood: `upbeat`, `chill`, `cinematic`, `corporate`, `dreamy`, `tense`, `playful` or `minimal`. |
| `icon` | no | A Lucide icon name. |
| `author` | no | Credit shown with the template. |
| `slots` | no | Up to 16 inputs, described below. |
| `scenes` | yes | 1 to 20 scenes, described below. |

## Slots

```json
{"key": "headline", "label": "Headline", "kind": "text", "required": true, "default": "Meet the *new* Northstar", "help": "Short and punchy"}
```

| Kind | Input | Value inside scenes |
|---|---|---|
| `text` | single line | string |
| `textarea` | several lines | string |
| `list` | one item per line | list of strings |
| `image` | one image | asset id |
| `images` | several images (`max` limits the count) | list of asset ids |
| `logo` | one logo image | asset id |
| `audio` | one music file | asset id; it becomes the film's music |

Wrap a word in `*asterisks*` in any text to give it the accent treatment of the style pack.

## Scenes

Each scene is either a built-in **archetype** with data, or your own **code**.

```json
{"title": "Headline", "archetype": "kinetic-title", "duration": 3.2, "transition": "smoothleft",
 "data": {"kicker": "{{brand}}", "title": "{{headline}}", "icon": "megaphone"}}
```

- `duration` is 0.5 to 30 seconds.
- `transition` is `cut` or an ffmpeg xfade name such as `fade`, `fadewhite`, `smoothleft`, `slideup`, `zoomin`,
  `circleopen` or `wipeleft`. The last scene's transition is ignored.
- `archetype` is one of: `kinetic-title`, `word-stack`, `big-number`, `bar-race`, `line-chart`, `donut`, `versus`,
  `timeline`, `quote`, `list-reveal`, `process-flow`, `icon-grid`, `doodle-explain`, `equation`, `image-focus`,
  `scale-zoom`, `map-pins`, `ui-mockup`, `lower-third`, `end-card`, `phone-showcase`, `ui-cascade`, `code-typing`,
  `shape-morph`, `particles-type`, `photo-stack`, `music-visualizer`, `paper-cut`, `vox-board`, `three-hero`,
  `logo-reveal`, `kinetic-beat`, `diagram-build`, `mascot-talk`, `line-art`.

Common data fields by archetype:

| Archetype | Data |
|---|---|
| `kinetic-title` | `kicker`, `title`, `subtitle`, `icon` |
| `word-stack` | `words` (list) |
| `big-number` | `kicker`, `value` (number), `prefix`, `suffix`, `decimals`, `label` |
| `quote` | `quote`, `author`, `role` |
| `list-reveal` | `kicker`, `title`, `items` (list of strings) |
| `process-flow` | `kicker`, `title`, `steps` (list of `{label, icon}`) |
| `icon-grid` | `kicker`, `title`, `items` (list of `{label, icon}`) |
| `timeline` | `kicker`, `title`, `events` (list of `{date, label}`) |
| `logo-reveal` | `logo` (asset), `name`, `tagline` |
| `ui-cascade` | `kicker`, `title`, `image` (asset), `url`, `callouts` |
| `end-card` | `title`, `subtitle`, `cta`, `icon` |

The built-in templates in `server/templates.py` show every archetype in use.

## Placeholders

- `"{{key}}"` as the whole value inserts the slot value with its type: a string, a list or an asset id.
- `"Get {{brand}} today"` inside a longer string inserts the value as text.
- `"{{key.0}}"` picks the first line of a list slot or the first file of an images slot.
- `{"$map": "key", "to": ..., "limit": 6}` turns a list slot into a list of anything. Inside `to`, `{{item}}` is the
  current line. Set `"icon": "auto"` to pick a matching Lucide icon, and add `"icons": ["zap", "eye"]` as fallbacks used
  in turn when no match is found.

Every placeholder must refer to a slot key; validation rejects unknown names.

## Code scenes

A code scene replaces `archetype` and `data` with `code`: a fragment that follows the
[composition contract](../skills/composition-contract/SKILL.md). One `<div class="scene">`, one `<style>`, one `<script>`
calling `AU.scene(...)`, theme tokens instead of literal colours, all motion on the timeline, no external URLs. Up to
24,000 characters. Placeholders in code are HTML-escaped.

```json
{"title": "Version badge", "duration": 3.4, "code": "<div class=\"scene\"><div class=\"badge\" data-layer=\"badge\">{{version}}</div></div><style>.badge{position:absolute;inset:0;display:grid;place-items:center;font:700 var(--fs-xl)/1 var(--font-display);color:var(--ink)}</style><script>AU.scene(({ tl }) => { tl.fromTo('.badge', { scale: 1.4, opacity: 0 }, { scale: 1, opacity: 1, duration: .7, ease: 'au.pop' }, .2); });</script>"}
```

## Publishing

Check your template with the same rules the pull request check uses:

```bash
python3 scripts/publish_templates.py --check --skip-manifest
```

Then open a pull request with only the template file. After it is merged, the release bot adds the template and its
SHA-256 checksum to `release.json`, records it in `changelog.txt`, and studios pick it up on their next update check.
The full process is in [CONTRIBUTING.md](../CONTRIBUTING.md).
