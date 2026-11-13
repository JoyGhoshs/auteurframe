# Contributing to AuteurFrame

Thank you for helping. This guide covers the most common contribution, a new template, and then code changes.

- [Licensing of contributions](#licensing-of-contributions)
- [Publish a template](#publish-a-template)
- [Template rules](#template-rules)
- [How a template reaches every studio](#how-a-template-reaches-every-studio)
- [Code contributions](#code-contributions)
- [Maintainer guide](#maintainer-guide)

## Licensing of contributions

AuteurFrame is open source under the [GNU AGPL v3](LICENSE) with the terms in
[LICENSE-EXCEPTIONS.md](LICENSE-EXCEPTIONS.md), and the author also offers [commercial licenses](COMMERCIAL.md). By
opening a pull request you agree that:

1. your contribution is your own original work, or you have the right to submit it under these terms;
2. your contribution is licensed to everyone under the same GNU AGPL v3 and additional terms as the rest of the
   project;
3. you also grant Joy Ghosh a perpetual, worldwide, irrevocable, royalty-free license to use, change, sublicense and
   relicense your contribution, including under commercial licenses, so the project can stay under one set of terms;
4. you keep the copyright in your contribution, and your name stays in the git history and, for templates, in the
   `author` field and the changelog.

If you cannot agree to this, please open an issue instead of a pull request.

## Publish a template

Templates are JSON files in `templates/`. When a pull request with a template is merged into `main`, every AuteurFrame
studio that checks for updates shows it under **Templates → Add to studio**. No release or reinstall is needed.

### 1. Fork and clone

```bash
git clone https://github.com/<your-username>/auteurframe.git
cd auteurframe
git remote add upstream https://github.com/joyghoshs/auteurframe.git
git checkout -b template/<your-template-id>
```

### 2. Write the template

Create `templates/<your-template-id>.json`. The file name must match the `id` inside it. Start from one of the
existing files in `templates/` and read [docs/templates.md](docs/templates.md) for every field, archetype and
placeholder.

### 3. Try it in your own studio

Start AuteurFrame from your fork (`python3 run.py`). Bundled templates load at startup, so yours appears under
**Templates**. Fill the slots, switch formats and styles, render it, and fix anything that looks wrong.

### 4. Validate it

Run the same check the pull request runs:

```bash
git fetch upstream
python3 scripts/publish_templates.py --check --skip-manifest --base upstream/main
```

Fix any error it prints. You do not need to edit `release.json` or `changelog.txt`: after your pull request is merged,
the release bot adds your template to `release.json` with its checksum and records it in `changelog.txt`.

### 5. Open the pull request

```bash
git add templates/<your-template-id>.json
git commit -m "Template: <Your Template Name>"
git push origin template/<your-template-id>
```

Open a pull request against `joyghoshs/auteurframe:main`. The pull request template asks for a short checklist and a few
preview frames or a short render. The **Check** workflow runs automatically; a maintainer reviews the result, reads any
code scenes line by line, and merges.

### Updating your template later

Change the file, raise its `version` by one and open a new pull request. Studios that installed the old version are
offered the update, and the changelog records the new version. The check fails if a changed template keeps its old
version.

## Template rules

A pull request is merged only when it follows all of these rules. The validator enforces the first group automatically;
reviewers check the rest.

**Enforced by the validator**

1. `format` is `1`; `id` is lowercase letters, digits and dashes and is not used by a built-in or another template.
2. The file is named `templates/<id>.json`. The release bot lists it in `release.json` with its checksum after the merge.
3. `style`, `aspect`, `mood`, archetypes and transitions are ones AuteurFrame ships.
4. 1 to 20 scenes, each 0.5 to 30 seconds; at most 16 slots; every `{{placeholder}}` refers to a slot.
5. No `<` or `>` in names, descriptions, slot labels, defaults or scene data. Use `*asterisks*` for accent words.
6. Code scenes are composition fragments under 24,000 characters and do not use network access (`fetch`, XHR, sockets,
   beacons), storage (cookies, local or session storage, IndexedDB), navigation (`location`, `window.open`, `top`,
   `parent`), external URLs or media tags, inline event handlers, or dynamic code (`eval`, `Function`, `constructor`,
   computed `window[...]` access, encoded strings).
7. A changed template has a higher `version` than the one on `main`.

**Checked by reviewers**

8. The template is original work, or its content is free to use. No trademarks, logos, real people or copyrighted text
   in defaults unless you have the rights.
9. Defaults read well: a stranger can render it unchanged and get a film that makes sense.
10. It renders cleanly at its default aspect and at least one other: nothing overflows, overlaps or sits outside the
    safe area.
11. Code scenes follow the [composition contract](skills/composition-contract/SKILL.md): theme tokens instead of literal
    colours, every animated element has a `data-layer`, all motion on the timeline or in `onFrame`, no comments.
12. One template per pull request, with no unrelated changes.

The validator is a safety net, not a sandbox. Scenes run in the studio's own origin, so maintainers read every line of a
code scene before merging, and templates with code scenes are flagged in the check output.

## How a template reaches every studio

```
your pull request ──▶ Check workflow (Validate templates) ──▶ review by @joyghoshs ──▶ merge into main
                                                                             │
   Release bot: adds the template and its SHA-256 checksum to release.json and a dated line to changelog.txt
                                                                             │
             raw.githubusercontent.com/joyghoshs/auteurframe/main/release.json
                                                                             │
   every studio checks the feed (at most every 6 hours) ──▶ "N new templates" ──▶ Add to studio
                                                                             │
   the studio downloads templates/<id>.json from the same host, verifies the SHA-256 checksum,
   validates it again with the same rules, and adds it to the gallery
```

GitHub is the update server: the studio reads `release.json` and template files straight from `main` over HTTPS. Nothing
else is deployed.

## Code contributions

1. Open an issue first for anything larger than a small fix, so we can agree on the approach.
2. Fork, create a branch, and keep the change focused.
3. Follow the code style of the project: no comments and no emoji in source files, clear names, small functions.
4. Run the studio and check your change in the browser. Include screenshots for UI changes.
5. Open a pull request against `main` and fill in the template.

## Maintainer guide

### Branch protection (optional)

Without any ruleset, the release bot commits with GitHub's built-in token and everything works. Only you can push to
`main` anyway; contributors work through forks and pull requests, and the **Check** workflow runs on every one.

Allow the bot to write once: **Settings → Actions → General → Workflow permissions → Read and write permissions**.

If you later want stricter protection, the repository includes a ruleset in
[.github/rulesets/main.json](.github/rulesets/main.json). Import it under
**Settings → Rules → Rulesets → New ruleset → Import a ruleset**. It blocks force pushes and deletion of `main`,
requires a reviewed pull request and a passing **Validate templates** check, lets admins merge their own pull requests,
and lets deploy keys push. Because personal accounts cannot exempt the GitHub Actions app, the bot then needs a deploy
key:

```bash
ssh-keygen -t ed25519 -N "" -C "auteurframe release bot" -f release_bot_key
```

1. **Settings → Deploy keys → Add deploy key**: paste `release_bot_key.pub`, name it *release bot*, tick
   **Allow write access**.
2. **Settings → Secrets and variables → Actions → New repository secret**: name it `RELEASE_BOT_KEY` and paste the
   whole private key file `release_bot_key`.
3. Delete both key files from your machine.

The release workflow uses `RELEASE_BOT_KEY` automatically when it exists. The bot's commits end with `[skip ci]`, so
they do not start another run.

### Automation

| Workflow | Trigger | Job |
|---|---|---|
| **Check** | every pull request | Validates templates, safety rules and version bumps, compiles Python, parses JavaScript and writes a summary of what changed. |
| **Release bot** | every push to `main` | Updates the template list and checksums in `release.json`, adds dated entries to `changelog.txt`, and when the app `version` changed, tags `vX.Y.Z` and publishes the GitHub release. |

`changelog.txt` always exists. The bot keeps an **Unreleased** section at the top and moves its entries under a version
heading when you release. Do not edit it by hand except to fix wording; the bot preserves existing lines.

### Reviewing a template pull request

1. Read the check output. A warning means the template has code scenes.
2. Read every code scene completely. Reject anything obfuscated, minified or doing more than drawing and animating.
3. Check the content rules (8 to 12) and the attached previews; render it yourself if anything is unclear.
4. Squash and merge. The release bot lists the template, and it is live for every studio within six hours.

### Releasing a new version of the app

Open a pull request that raises the version and sets the notes:

```bash
git checkout -b release/1.1.0
python3 scripts/publish_templates.py --version 1.1.0 --note "What changed" --note "Another change"
git commit -am "Release 1.1.0"
git push origin release/1.1.0
```

Merge it once the check passes. The release bot then moves the unreleased changelog entries under `1.1.0`, tags
`v1.1.0` and publishes the GitHub release with the notes and entries. Studios show **AuteurFrame 1.1.0 available** on
their next check.
