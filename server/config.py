from __future__ import annotations

import os
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
DATA = Path(os.environ.get("AUTEUR_DATA", ROOT / "data"))
PROJECTS = DATA / "projects"
SKILLS_BUILTIN = ROOT / "skills"
SKILLS_USER = DATA / "skills"
SETTINGS = DATA / "settings.json"
RENDERER_DIR = ROOT / "renderer"

HOST = os.environ.get("AUTEUR_HOST", "127.0.0.1")
PORT = int(os.environ.get("AUTEUR_PORT", "8800"))
PUBLIC_URL = os.environ.get("AUTEUR_INTERNAL_URL", f"http://127.0.0.1:{PORT}")
RENDERER_URL = os.environ.get("RENDERER_URL", "http://127.0.0.1:8790")
RENDERER_AUTOSTART = os.environ.get("RENDERER_AUTOSTART", "1") != "0"
NODE = os.environ.get("NODE_PATH_BIN", shutil.which("node") or "node")
FFMPEG = os.environ.get("FFMPEG_PATH", shutil.which("ffmpeg") or "ffmpeg")
FFPROBE = os.environ.get("FFPROBE_PATH", shutil.which("ffprobe") or "ffprobe")

MAX_UPLOAD_MB = int(os.environ.get("AUTEUR_MAX_UPLOAD_MB", "512"))
SCENE_CONCURRENCY = int(os.environ.get("AUTEUR_SCENE_CONCURRENCY", "4"))
RENDER_CONCURRENCY = int(os.environ.get("AUTEUR_RENDER_CONCURRENCY", "3"))
RELAY = os.environ.get("AUTEUR_RELAY", "1") != "0"
POLISH = os.environ.get("AUTEUR_POLISH", "1") != "0"
MAX_REPAIR_ROUNDS = int(os.environ.get("AUTEUR_MAX_REPAIRS", "2"))
REPAIR_STEPS = int(os.environ.get("AUTEUR_REPAIR_STEPS", "12"))
SCENE_SECONDS = int(os.environ.get("AUTEUR_SCENE_SECONDS", "540"))
ACCEPT_SCORE = int(os.environ.get("AUTEUR_ACCEPT_SCORE", "80"))

for folder in (DATA, PROJECTS, SKILLS_USER):
    folder.mkdir(parents=True, exist_ok=True)
