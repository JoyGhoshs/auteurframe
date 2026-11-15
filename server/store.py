from __future__ import annotations

import json
import os
import random
import re
import shutil
import threading
import time
import uuid
from pathlib import Path
from typing import Any

from . import config, styles

_lock = threading.RLock()


SCENE_KEYS = ("id", "duration", "code", "data", "archetype", "overrides", "layers", "variant", "reseed", "transition", "ground", "texture")


def content_key(project: dict[str, Any]) -> str:
    import hashlib
    body = {
        "scenes": [{k: s.get(k) for k in SCENE_KEYS} for s in project.get("scenes") or []],
        "audio": project.get("audio"), "captions": project.get("captions"), "cues": project.get("cues"),
        "format": [project.get("width"), project.get("height"), project.get("fps")], "bible": project.get("bible"),
        "edit": (project.get("edit") or {}).get("ranges"), "lang": (project.get("options") or {}).get("language"),
    }
    return hashlib.sha1(json.dumps(body, sort_keys=True, default=str).encode("utf-8")).hexdigest()[:16]


def now() -> float:
    return round(time.time(), 3)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def project_dir(pid: str) -> Path:
    if not re.fullmatch(r"prj_[a-f0-9]{10}", pid or ""):
        raise KeyError(pid)
    return config.PROJECTS / pid


def _atomic_write(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + f".{os.getpid()}.{threading.get_ident()}.tmp")
    with open(tmp, "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=1)
    os.replace(tmp, path)


def default_project(title: str = "Untitled film", brief: str = "", aspect: str = "16:9", style: str = "editorial-paper",
                    duration: float = 30.0, fps: int = 30) -> dict[str, Any]:
    width, height = styles.ASPECTS.get(aspect, styles.ASPECTS["16:9"])
    seed = random.randint(1000, 999999)
    pid = "prj_" + uuid.uuid4().hex[:10]
    project = {
        "id": pid, "title": title, "brief": brief, "created": now(), "updated": now(), "version": 2,
        "aspect": aspect, "width": width, "height": height, "fps": fps, "duration_target": duration,
        "style": style, "seed": seed, "bible": styles.build_bible(style, seed, width, height),
        "captions": {"enabled": True, "style": None, "position": "bottom", "size": 1, "from_narration": False},
        "cues": [], "subtitle_file": None, "assets": [], "scenes": [],
        "audio": {"music": "auto", "voice": None, "sfx": True, "music_gain": -18.0},
        "options": {"research": False, "mode": "auto", "quality": "final", "language": "en", "audience": "", "tone": ""},
        "status": "draft", "outputs": {}, "memory": {}, "runs": [], "fingerprint": {}, "references": [],
    }
    return project


class ProjectStore:
    def list(self) -> list[dict[str, Any]]:
        out = []
        for folder in sorted(config.PROJECTS.glob("prj_*"), key=lambda p: p.stat().st_mtime, reverse=True):
            path = folder / "project.json"
            if not path.exists():
                continue
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            out.append({
                "id": data["id"], "title": data.get("title"), "brief": data.get("brief", "")[:240], "aspect": data.get("aspect"),
                "style": data.get("style"), "status": data.get("status"), "updated": data.get("updated"), "created": data.get("created"),
                "scenes": len(data.get("scenes", [])), "duration": round(sum(s.get("duration", 0) for s in data.get("scenes", [])), 2),
                "poster": data.get("outputs", {}).get("poster"), "master": data.get("outputs", {}).get("master"),
                "palette": (data.get("bible") or {}).get("palette", {}), "workspace": data.get("workspace"),
            })
        return out

    def create(self, **kwargs: Any) -> dict[str, Any]:
        project = default_project(**kwargs)
        for sub in ("assets", "renders", "out", "revisions", "docs"):
            (project_dir(project["id"]) / sub).mkdir(parents=True, exist_ok=True)
        self.save(project, revision=False)
        return project

    def get(self, pid: str) -> dict[str, Any]:
        path = project_dir(pid) / "project.json"
        if not path.exists():
            raise KeyError(pid)
        with _lock:
            return json.loads(path.read_text(encoding="utf-8"))

    def save(self, project: dict[str, Any], revision: bool = False, reason: str = "") -> dict[str, Any]:
        with _lock:
            project["updated"] = now()
            project["content_key"] = content_key(project)
            folder = project_dir(project["id"])
            if revision:
                stamp = time.strftime("%Y%m%d-%H%M%S")
                rev = folder / "revisions" / f"{stamp}.json"
                _atomic_write(rev, {"reason": reason, "project": project})
                revs = sorted((folder / "revisions").glob("*.json"))
                for old in revs[:-40]:
                    old.unlink(missing_ok=True)
            _atomic_write(folder / "project.json", project)
        return project

    def mutate(self, pid: str, fn, revision: bool = False, reason: str = "") -> dict[str, Any]:
        with _lock:
            project = self.get(pid)
            result = fn(project)
            if isinstance(result, dict) and result.get("id") == pid:
                project = result
            self.save(project, revision=revision, reason=reason)
            return project

    def update_scene(self, pid: str, scene_id: str, patch: dict[str, Any], revision: bool = False) -> dict[str, Any]:
        def apply(project: dict[str, Any]) -> None:
            for scene in project["scenes"]:
                if scene["id"] == scene_id:
                    scene.update(patch)
                    return
            raise KeyError(scene_id)
        project = self.mutate(pid, apply, revision=revision, reason=f"scene {scene_id}")
        return next(s for s in project["scenes"] if s["id"] == scene_id)

    def delete(self, pid: str) -> None:
        folder = project_dir(pid)
        trash = config.DATA / "trash"
        trash.mkdir(exist_ok=True)
        shutil.move(str(folder), str(trash / f"{pid}-{int(time.time())}"))

    def revisions(self, pid: str) -> list[dict[str, Any]]:
        out = []
        for rev in sorted((project_dir(pid) / "revisions").glob("*.json"), reverse=True)[:40]:
            try:
                data = json.loads(rev.read_text(encoding="utf-8"))
                out.append({"id": rev.stem, "reason": data.get("reason", ""), "scenes": len(data["project"].get("scenes", []))})
            except (OSError, json.JSONDecodeError, KeyError):
                continue
        return out

    def restore(self, pid: str, rev_id: str) -> dict[str, Any]:
        if not re.fullmatch(r"[0-9-]+", rev_id):
            raise KeyError(rev_id)
        path = project_dir(pid) / "revisions" / f"{rev_id}.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        project = data["project"]
        return self.save(project, revision=True, reason=f"restore {rev_id}")


store = ProjectStore()
