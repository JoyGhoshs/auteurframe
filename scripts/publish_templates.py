import argparse
import datetime
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from server import templates

FIELDS = ("id", "name", "version", "description", "file", "sha256")


def base_version(ref: str, rel: str) -> int | None:
    proc = subprocess.run(["git", "show", f"{ref}:{rel}"], cwd=ROOT, capture_output=True, text=True)
    if proc.returncode != 0:
        return None
    try:
        return int(json.loads(proc.stdout).get("version", 1))
    except (ValueError, TypeError):
        return None


def changed_files(ref: str) -> set[str]:
    proc = subprocess.run(["git", "diff", "--name-only", f"{ref}...HEAD"], cwd=ROOT, capture_output=True, text=True)
    return set(proc.stdout.split()) if proc.returncode == 0 else set()


def main() -> int:
    ap = argparse.ArgumentParser(description="Validate templates/*.json and list them in release.json with checksums.")
    ap.add_argument("--version", help="set the AuteurFrame release version, for example 1.1.0")
    ap.add_argument("--note", action="append", default=[], help="replace the release notes; repeat for several lines")
    ap.add_argument("--check", action="store_true", help="change nothing; fail if a template is invalid or release.json is out of date")
    ap.add_argument("--base", help="git ref to compare against, for example origin/main; changed templates must raise their version")
    ap.add_argument("--skip-manifest", action="store_true", help="with --check, do not require release.json to list the templates; the release bot updates it after merge")
    args = ap.parse_args()
    release_path = ROOT / "release.json"
    release = json.loads(release_path.read_text(encoding="utf-8"))
    previous = {t["id"]: t for t in release.get("templates", [])}
    rows, errors, notes, seen = [], [], [], set()
    changed = changed_files(args.base) if args.base else set()
    for f in sorted((ROOT / "templates").glob("*.json")):
        rel = f"templates/{f.name}"
        raw = f.read_bytes()
        try:
            pack = templates.validate_pack(json.loads(raw))
        except ValueError as error:
            errors.append(f"{rel}: {error}")
            continue
        if f.name != f"{pack['id']}.json":
            errors.append(f"{rel}: the file must be named {pack['id']}.json")
        if pack["id"] in seen:
            errors.append(f"{rel}: id {pack['id']} is used twice")
        seen.add(pack["id"])
        if args.base and rel in changed:
            old = base_version(args.base, rel)
            if old is not None and pack.get("version", 1) <= old:
                errors.append(f"{rel}: changed but version is still {pack.get('version', 1)}; raise it above {old}")
        if any(s.get("code") for s in pack["scenes"]) and (not args.base or rel in changed):
            notes.append(f"::warning file={rel}::{pack['id']} contains code scenes; a maintainer must read the code before merging")
        old = previous.get(pack["id"], {})
        rows.append({"id": pack["id"], "name": pack["name"], "version": pack.get("version", 1), "description": pack["description"],
                     "file": rel, "sha256": hashlib.sha256(raw).hexdigest(), "added": old.get("added") or datetime.date.today().isoformat()})
    for n in notes:
        print(n)
    if args.check and args.base:
        proc = subprocess.run(["git", "show", f"{args.base}:release.json"], cwd=ROOT, capture_output=True, text=True)
        if proc.returncode == 0:
            old_v, new_v = json.loads(proc.stdout).get("version", "0.0.0"), release.get("version", "0.0.0")
            parse = lambda v: tuple(int(x) for x in (str(v).split("-")[0].split(".") + ["0", "0"])[:3])
            try:
                if new_v != old_v and parse(new_v) <= parse(old_v):
                    errors.append(f"release.json version {new_v} must be higher than {old_v}")
            except ValueError:
                errors.append(f"release.json version {new_v} is not a semantic version such as 1.2.0")
    if args.check:
        if not (ROOT / "changelog.txt").exists():
            errors.append("changelog.txt is missing; restore it from main")
        listed = [{k: t.get(k) for k in FIELDS} for t in release.get("templates", [])]
        wanted = [{k: t.get(k) for k in FIELDS} for t in rows]
        if listed != wanted and not args.skip_manifest:
            errors.append("release.json is out of date: run  python3 scripts/publish_templates.py  and commit release.json")
    if errors:
        print("\n".join(f"::error::{e}" if args.check else e for e in errors))
        return 1
    if args.check:
        print(f"ok: {len(rows)} templates valid" + ("" if args.skip_manifest else " and release.json is current"))
        return 0
    release["templates"] = rows
    if args.version:
        release["version"] = args.version
        release["released"] = datetime.date.today().isoformat()
    if args.note:
        release["notes"] = args.note
    release_path.write_text(json.dumps(release, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"release {release['version']}: {len(rows)} templates listed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
