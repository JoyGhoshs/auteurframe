from __future__ import annotations

import re
import time
from pathlib import Path
from typing import Any

import httpx

from . import config

STAGES = ["direct", "research", "write", "design", "animate", "qa", "edit", "any"]
ROLE_STAGES = {
    "director": ["direct", "write", "any"], "writer": ["write", "direct", "any"], "art": ["design", "any"],
    "animator": ["animate", "design", "any"], "critic": ["qa", "animate", "any"], "research": ["research", "any"], "editor": ["edit", "any"],
}


def parse_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    meta: dict[str, Any] = {}
    body = text
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", text, re.S)
    if match:
        body = match.group(2)
        for line in match.group(1).splitlines():
            if ":" not in line:
                continue
            key, value = line.split(":", 1)
            value = value.strip()
            if value.startswith("[") and value.endswith("]"):
                meta[key.strip()] = [v.strip().strip("'\"") for v in value[1:-1].split(",") if v.strip()]
            else:
                meta[key.strip()] = value.strip("'\"")
    return meta, body.strip()


class Skill:
    def __init__(self, path: Path, origin: str) -> None:
        self.path = path
        self.origin = origin
        text = path.read_text(encoding="utf-8", errors="ignore")
        self.meta, self.body = parse_frontmatter(text)
        self.name = self.meta.get("name") or path.parent.name
        self.description = self.meta.get("description", "")
        self.stage = self.meta.get("stage", "any")
        tags = self.meta.get("tags", [])
        self.tags = tags if isinstance(tags, list) else [t.strip() for t in str(tags).split(",") if t.strip()]
        self.enabled = not (path.parent / ".disabled").exists()

    def summary(self) -> dict[str, Any]:
        return {"name": self.name, "description": self.description, "stage": self.stage, "tags": self.tags, "origin": self.origin,
                "enabled": self.enabled, "lines": self.body.count("\n") + 1, "source": self.meta.get("source", "")}

    def section(self, title: str) -> str:
        match = re.search(rf"(?ims)^##+\s*{re.escape(title)}.*?$(.*?)(?=^##\s|\Z)", self.body)
        return match.group(1).strip() if match else ""


class SkillLibrary:
    def __init__(self) -> None:
        self.cache: list[Skill] = []
        self.loaded = 0.0

    def all(self) -> list[Skill]:
        if time.time() - self.loaded > 5:
            items = []
            for origin, root in (("builtin", config.SKILLS_BUILTIN), ("user", config.SKILLS_USER)):
                if root.exists():
                    for path in sorted(root.glob("*/SKILL.md")):
                        try:
                            items.append(Skill(path, origin))
                        except OSError:
                            continue
            self.cache = items
            self.loaded = time.time()
        return self.cache

    def get(self, name: str) -> Skill | None:
        return next((s for s in self.all() if s.name == name), None)

    def search(self, query: str, role: str | None = None, limit: int = 6) -> list[Skill]:
        words = set(re.findall(r"[a-z0-9]{3,}", (query or "").lower()))
        stages = ROLE_STAGES.get(role or "", STAGES)
        scored = []
        for skill in self.all():
            if not skill.enabled:
                continue
            score = 0.0
            if skill.stage in stages:
                score += 3 - stages.index(skill.stage) * 0.6
            hay = (skill.name + " " + skill.description + " " + " ".join(skill.tags)).lower()
            score += sum(2.0 for w in words if w in hay)
            score += sum(0.15 for w in words if w in skill.body.lower()[:6000])
            if skill.name in ("composition-contract", "motion-rules-core") and role == "animator":
                score += 20
            if skill.name in ("qa-critic", "anti-slop-checklist") and role == "critic":
                score += 20
            if skill.name in ("storyboard-director", "explainer-grammar") and role in ("director", "writer"):
                score += 12
            if skill.name == "subtitle-sync" and role == "writer":
                score += 8
            if skill.name in ("art-direction-bible",) and role == "art":
                score += 20
            if skill.name in ("research-and-fact-grounding",) and role == "research":
                score += 20
            if score > 0:
                scored.append((score, skill))
        scored.sort(key=lambda x: -x[0])
        return [s for _, s in scored[:limit]]

    def inject(self, query: str, role: str, budget: int = 9000, must: list[str] | None = None) -> tuple[str, list[str]]:
        chosen: list[Skill] = []
        must = list(dict.fromkeys(must or []))
        for name in must:
            skill = self.get(name)
            if skill and skill.enabled and skill not in chosen:
                chosen.append(skill)
        for skill in self.search(query, role, limit=7):
            if skill not in chosen:
                chosen.append(skill)
        musts = [s for s in chosen if s.name in (must or [])]
        alloc: dict[str, int] = {}
        if musts:
            need = {s.name: len(s.body) for s in musts}
            left = int(budget * 0.85)
            pending = sorted(musts, key=lambda s: need[s.name])
            while pending:
                share = left // len(pending)
                s = pending.pop(0)
                alloc[s.name] = min(need[s.name], max(600, share))
                left -= alloc[s.name]
        parts, used, total = [], [], 0
        for skill in chosen:
            body = skill.body
            cap = alloc.get(skill.name, budget - total - sum(v for k, v in alloc.items() if k not in used and k != skill.name))
            room = min(budget - total, cap)
            if room < 600:
                if skill.name in alloc:
                    room = 600
                else:
                    continue
            if len(body) > room:
                body = body[:room].rsplit("\n", 1)[0] + "\n[truncated]"
            parts.append(f"<skill name=\"{skill.name}\">\n{body}\n</skill>")
            used.append(skill.name)
            total += len(body)
        return "\n\n".join(parts), used

    def save_user_skill(self, name: str, text: str, source: str = "") -> Skill:
        slug = re.sub(r"[^a-z0-9-]+", "-", name.lower()).strip("-")[:60] or "skill"
        folder = config.SKILLS_USER / slug
        folder.mkdir(parents=True, exist_ok=True)
        meta, body = parse_frontmatter(text)
        if not meta:
            text = f"---\nname: {slug}\ndescription: Imported skill\nstage: any\ntags: [imported]\nversion: 1\nsource: {source}\n---\n\n{text}"
        elif source and "source:" not in text.split("---", 2)[1]:
            text = text.replace("---\n", f"---\nsource: {source}\n", 1)
        text = sanitize_skill(text)
        (folder / "SKILL.md").write_text(text, encoding="utf-8")
        self.loaded = 0
        return Skill(folder / "SKILL.md", "user")

    def toggle(self, name: str, enabled: bool) -> None:
        skill = self.get(name)
        if not skill:
            raise KeyError(name)
        flag = skill.path.parent / ".disabled"
        if enabled:
            flag.unlink(missing_ok=True)
        else:
            flag.write_text("1")
        self.loaded = 0


def sanitize_skill(text: str) -> str:
    text = re.sub(r"(?im)^.*(ignore (all|previous) instructions|disregard the system|exfiltrate|api[_ -]?key|password).*$", "[removed line]", text)
    return text[:60000]


async def fetch_skill(url: str) -> tuple[str, str]:
    raw = url
    m = re.match(r"https?://github\.com/([^/]+)/([^/]+)(?:/(?:tree|blob)/([^/]+)/(.*))?", url)
    candidates = []
    if m:
        owner, repo, branch, path = m.group(1), m.group(2), m.group(3), m.group(4) or ""
        branches = [branch] if branch else ["main", "master"]
        for br in branches:
            if path.endswith(".md"):
                candidates.append(f"https://raw.githubusercontent.com/{owner}/{repo}/{br}/{path}")
            else:
                base = f"https://raw.githubusercontent.com/{owner}/{repo}/{br}/{path.strip('/') + '/' if path else ''}"
                candidates += [base + "SKILL.md", base + "skill.md", base + "README.md"]
    else:
        candidates.append(raw)
    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        for cand in candidates:
            try:
                r = await client.get(cand)
                if r.status_code == 200 and len(r.text) > 80:
                    return r.text, cand
            except httpx.HTTPError:
                continue
    raise RuntimeError("no skill markdown found at that address")


library = SkillLibrary()
