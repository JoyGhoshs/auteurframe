import argparse
import datetime
import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHANGELOG = ROOT / "changelog.txt"
EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"
HEADER = "AuteurFrame changelog\n=====================\n\nNewest first. The release bot adds an entry for every change merged into main.\n"
PLACEHOLDER = "  No changes yet."
VERSION_LINE = re.compile(r"^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)? \(\d{4}-\d{2}-\d{2}\)$")
GROUPS = [("skills/", "Skills"), ("server/", "Server"), ("web/", "Studio"), ("renderer/", "Renderer"), ("docker/", "Docker"),
          (".github/", "Automation"), ("scripts/", "Scripts"), ("docs/", "Docs"), ("README.md", "Docs"), ("CONTRIBUTING.md", "Docs"),
          ("requirements.txt", "Dependencies"), ("package.json", "Dependencies"), ("package-lock.json", "Dependencies"), ("assets/", "Assets"),
          ("brand/", "Brand"), ("LICENSE", "Legal"), ("NOTICE.txt", "Legal"), ("COMMERCIAL.md", "Legal"), ("TRADEMARKS.md", "Legal"),
          ("THIRD_PARTY_NOTICES.md", "Legal"), ("templates/", "Templates")]
SELF_MANAGED = {"release.json", "changelog.txt"}


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, check=True).stdout


def show(ref: str, path: str) -> str | None:
    if not ref or set(ref) == {"0"}:
        return None
    proc = subprocess.run(["git", "show", f"{ref}:{path}"], cwd=ROOT, capture_output=True, text=True)
    return proc.stdout if proc.returncode == 0 else None


def changed(before: str, after: str) -> list[tuple[str, str, str]]:
    base = before if before and set(before) != {"0"} else EMPTY_TREE
    out = []
    for line in git("diff", "--name-status", "-M", base, after).splitlines():
        parts = line.split("\t")
        status = parts[0][0]
        old, new = (parts[1], parts[2]) if status == "R" else (parts[1], parts[1])
        out.append((status, old, new))
    return out


def pack_info(text: str | None) -> dict:
    try:
        d = json.loads(text or "")
        return {"id": str(d.get("id", "")), "name": str(d.get("name", "")), "version": int(d.get("version", 1)), "author": str(d.get("author", ""))}
    except (ValueError, TypeError):
        return {}


def version_of(text: str | None) -> str:
    try:
        return str(json.loads(text or "").get("version", ""))
    except ValueError:
        return ""


def entries(before: str, after: str) -> list[str]:
    out, groups = [], {}
    for status, old, new in changed(before, after):
        if new in SELF_MANAGED:
            continue
        if new.startswith("templates/") and new.endswith(".json"):
            now = pack_info(show(after, new)) if status != "D" else {}
            was = pack_info(show(before, old)) if status != "A" else {}
            if status == "D":
                out.append(f"Template removed: {was.get('name') or old} ({was.get('id') or old})")
            elif not was:
                by = f", by {now['author']}" if now.get("author") else ""
                out.append(f"Template added: {now.get('name')} ({now.get('id')} v{now.get('version')}{by})")
            elif now.get("version") != was.get("version"):
                out.append(f"Template updated: {now.get('name')} ({now.get('id')} v{was.get('version')} to v{now.get('version')})")
            else:
                out.append(f"Template edited without a version bump: {now.get('name')} ({now.get('id')} v{now.get('version')})")
            continue
        label = next((g for prefix, g in GROUPS if new == prefix or new.startswith(prefix)), "Other")
        groups.setdefault(label, []).append(new)
    for label, files in groups.items():
        shown = ", ".join(files[:4]) + (f" and {len(files) - 4} more" if len(files) > 4 else "")
        out.append(f"{label}: {shown}")
    return out


def load_changelog() -> str:
    if CHANGELOG.exists():
        text = CHANGELOG.read_text(encoding="utf-8")
        if "\nUnreleased\n" in "\n" + text:
            return text
        return text.rstrip("\n") + "\n\nUnreleased\n" + PLACEHOLDER + "\n"
    return HEADER + "\nUnreleased\n" + PLACEHOLDER + "\n"


def split_unreleased(text: str) -> tuple[str, list[str], str]:
    lines = text.split("\n")
    i = lines.index("Unreleased")
    j = i + 1
    while j < len(lines) and not VERSION_LINE.match(lines[j]):
        j += 1
    body = [x for x in lines[i + 1:j] if x.strip() and x != PLACEHOLDER]
    return "\n".join(lines[:i]), body, "\n".join(lines[j:])


def join(head: str, unreleased: list[str], tail: str, released: list[str] | None = None) -> str:
    parts = [head.rstrip("\n"), "", "Unreleased", *(unreleased or [PLACEHOLDER]), ""]
    if released:
        parts += released + [""]
    if tail.strip():
        parts.append(tail.strip("\n"))
    return "\n".join(parts).rstrip("\n") + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description="Keep release.json and changelog.txt current after a merge into main.")
    ap.add_argument("--before", required=True)
    ap.add_argument("--after", default="HEAD")
    ap.add_argument("--pr", default="")
    ap.add_argument("--title", default="")
    ap.add_argument("--author", default="")
    ap.add_argument("--date", default=datetime.date.today().isoformat())
    ap.add_argument("--notes-out", default="")
    args = ap.parse_args()

    publish = subprocess.run([sys.executable, str(ROOT / "scripts/publish_templates.py")], cwd=ROOT, capture_output=True, text=True)
    print(publish.stdout.strip())
    if publish.returncode != 0:
        print(publish.stderr.strip() or "template validation failed")
        return 1

    ref = ""
    if args.pr:
        ref = f" (#{args.pr}" + (f" by @{args.author}" if args.author else "") + ")"
    elif args.author:
        ref = f" (@{args.author})"
    found = entries(args.before, args.after)
    if found and args.title and not any(e.startswith("Template ") for e in found):
        found = [f"{args.title}: " + "; ".join(found)]
    new_lines = [f"  {args.date}  {e}{ref}" for e in found]

    head, unreleased, tail = split_unreleased(load_changelog())
    unreleased = new_lines + unreleased
    old_version = version_of(show(args.before, "release.json"))
    new_version = version_of((ROOT / "release.json").read_text(encoding="utf-8"))
    released = None
    if new_version and old_version and new_version != old_version:
        release = json.loads((ROOT / "release.json").read_text(encoding="utf-8"))
        notes = [f"  * {n}" for n in release.get("notes") or []]
        released = [f"{new_version} ({release.get('released') or args.date})", *notes, *unreleased]
        unreleased = []
        if args.notes_out:
            Path(args.notes_out).write_text("\n".join(x.strip() for x in released[1:]) + "\n", encoding="utf-8")
    CHANGELOG.write_text(join(head, unreleased, tail, released), encoding="utf-8")

    out = os.environ.get("GITHUB_OUTPUT")
    result = {"version": new_version, "version_changed": "true" if released else "false", "entries": str(len(new_lines))}
    if out:
        with open(out, "a", encoding="utf-8") as fh:
            for k, v in result.items():
                fh.write(f"{k}={v}\n")
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
