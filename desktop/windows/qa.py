import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STAGE = Path(sys.argv[1]) if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else ROOT / "build" / "AuteurFrame"
WORK = ROOT / "build" / "qa"
TESTS_SRC = Path(os.environ.get("AUTEUR_TESTS_SRC", ROOT.parent.parent))
RT = STAGE / "runtime"
PY = RT / "python" / "python.exe"
RESULTS = {}


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def env_for(data_dir, port, rport):
    env = {k: v for k, v in os.environ.items() if k not in ("PYTHONPATH", "PYTHONHOME", "NODE_OPTIONS", "VIRTUAL_ENV")}
    env.update({
        "AUTEUR_DATA": str(data_dir), "AUTEUR_HOST": "127.0.0.1", "AUTEUR_PORT": str(port), "AUTEUR_INTERNAL_URL": f"http://127.0.0.1:{port}",
        "RENDERER_HOST": "127.0.0.1", "RENDERER_PORT": str(rport), "RENDERER_URL": f"http://127.0.0.1:{rport}",
        "NODE_PATH_BIN": str(RT / "node" / "node.exe"), "FFMPEG_PATH": str(RT / "ffmpeg" / "ffmpeg.exe"), "FFPROBE_PATH": str(RT / "ffmpeg" / "ffprobe.exe"),
        "CHROME_PATH": str(RT / "chrome" / "chrome.exe"), "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8", "PYTHONDONTWRITEBYTECODE": "1", "PYTHONNOUSERSITE": "1",
    })
    env["PATH"] = ";".join([str(RT / "ffmpeg"), str(RT / "node"), str(RT / "python"), env.get("PATH", "")])
    tmp = Path(data_dir).parent / (Path(data_dir).name + "-tmp")
    tmp.mkdir(parents=True, exist_ok=True)
    (tmp / "package.json").write_text('{"name": "auteurframe-temp", "private": true}', encoding="utf-8")
    env["TEMP"] = env["TMP"] = str(tmp)
    return env


def call(base, method, path, body=None, timeout=60):
    req = urllib.request.Request(base + path, data=json.dumps(body).encode() if body is not None else None, method=method, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def kill_tree(proc):
    subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"], capture_output=True)


def test_suite():
    print("== AuteurFrame test suite on the bundled Windows Python")
    qa_app = WORK / "suite-app"
    if qa_app.exists():
        shutil.rmtree(qa_app)
    shutil.copytree(STAGE / "app", qa_app)
    if not (TESTS_SRC / "tests").exists():
        print(f"   skipped: no tests folder at {TESTS_SRC} (set AUTEUR_TESTS_SRC to a development checkout)")
        RESULTS["test_suite"] = {"exit": None, "summary": "skipped"}
        return
    shutil.copytree(TESTS_SRC / "tests", qa_app / "tests", ignore=shutil.ignore_patterns("__pycache__"))
    if (TESTS_SRC / "samples").exists():
        shutil.copytree(TESTS_SRC / "samples", qa_app / "samples", dirs_exist_ok=True)
    shutil.copy(TESTS_SRC / "pytest.ini", qa_app / "pytest.ini")
    lib = WORK / "pylib"
    if not (lib / "pytest").exists():
        subprocess.run([sys.executable, "-m", "pip", "install", "--disable-pip-version-check", "-q", "--only-binary=:all:", "--platform", "win_amd64",
                        "--python-version", "3.12", "--implementation", "cp", "--target", str(lib), "pytest"], check=True)
    env = env_for(WORK / "suite-data", free_port(), free_port())
    code = f"import sys; sys.path.insert(0, r'{lib}'); sys.path.insert(0, r'{qa_app}'); import pytest; sys.exit(pytest.main(['-q', '-p', 'no:cacheprovider', 'tests']))"
    r = subprocess.run([str(PY), "-c", code], cwd=qa_app, env=env, capture_output=True, text=True, encoding="utf-8", errors="replace")
    tail = "\n".join((r.stdout + r.stderr).strip().splitlines()[-25:])
    print(tail)
    RESULTS["test_suite"] = {"exit": r.returncode, "summary": tail.splitlines()[-1] if tail else ""}
    (WORK / "suite.log").write_text(r.stdout + r.stderr, encoding="utf-8")


def end_to_end():
    print("== End-to-end film render with the bundled runtimes")
    data = WORK / "e2e-data"
    if data.exists():
        shutil.rmtree(data)
    port, rport = free_port(), free_port()
    base = f"http://127.0.0.1:{port}/api"
    log = open(WORK / "e2e-server.log", "w", encoding="utf-8")
    proc = subprocess.Popen([str(PY), "-X", "utf8", str(STAGE / "app" / "run.py"), "--host", "127.0.0.1", "--port", str(port)], cwd=STAGE / "app",
                            env=env_for(data, port, rport), stdout=log, stderr=subprocess.STDOUT, creationflags=0x08000000)
    try:
        t0 = time.time()
        while time.time() - t0 < 180:
            try:
                health = call(base, "GET", "/health", timeout=5)
                break
            except Exception:
                time.sleep(1)
        else:
            raise RuntimeError("backend never became healthy")
        print(f"   healthy in {time.time() - t0:.1f}s; renderer chrome {(health.get('renderer') or {}).get('chrome', 'starts on first render')}")
        RESULTS["startup_seconds"] = round(time.time() - t0, 1)
        RESULTS["renderer"] = health.get("renderer")
        tpls = call(base, "GET", "/templates")["templates"]
        print(f"   {len(tpls)} templates available")
        RESULTS["templates"] = len(tpls)
        pick = next((t for t in tpls if t["id"] == "logo-sting"), tpls[0])
        p = call(base, "POST", "/projects", {"title": "QA template film", "brief": "qa", "aspect": "16:9", "style": pick.get("style", "neon-night"), "duration": 10, "fps": 30})
        pid = p["id"]
        call(base, "PATCH", f"/projects/{pid}", {"grade": {"preset": "teal-orange"}})
        call(base, "POST", f"/projects/{pid}/template", {"template": pick["id"], "values": {}, "render": True})
        films = [(pid, pick["id"])]
        p2 = call(base, "POST", "/projects", {"title": "QA world3d", "brief": "qa", "aspect": "9:16", "style": "soft-clay", "duration": 3, "fps": 30, "captions": {"enabled": False}})
        call(base, "POST", f"/projects/{p2['id']}/scenes", {"at": 0, "title": "Felt", "duration": 3, "narration": ""})
        sid = call(base, "GET", f"/projects/{p2['id']}")["scenes"][0]["id"]
        code = ('<div class="scene"></div><script>AU.scene(({ component }) => { component("world3d", { set: "living-room", look: "felt", '
                'cast: [{ id: "boy", preset: "kid", actions: [{ do: "shock", at: 0.8, duration: 1.5 }] }], camera: { shot: "medium", target: "boy" } }); '
                'component("speech", { target: "boy", text: "It works on Windows!", at: 0.5, duration: 2 }); });</script>')
        call(base, "PATCH", f"/projects/{p2['id']}/scenes/{sid}", {"code": code, "duration": 3, "locked": True})
        call(base, "PATCH", f"/projects/{p2['id']}", {"grade": {"preset": "stop-motion"}, "audio": {"music": "mood:playful"}})
        call(base, "POST", f"/projects/{p2['id']}/run", {"mode": "render"})
        films.append((p2["id"], "world3d felt"))
        for fid, label in films:
            t1 = time.time()
            while time.time() - t1 < 600:
                run = call(base, "GET", f"/projects/{fid}/run").get("run") or {}
                if run.get("status") not in ("running", "starting", None):
                    break
                time.sleep(3)
            proj = call(base, "GET", f"/projects/{fid}")
            out = proj.get("outputs") or {}
            master = data / "projects" / fid / "out" / "master.mp4"
            ok = master.exists()
            info = {}
            if ok:
                pr = subprocess.run([str(RT / "ffmpeg" / "ffprobe.exe"), "-v", "error", "-count_frames", "-show_entries", "stream=codec_type,codec_name,width,height,nb_read_frames",
                                     "-show_entries", "format=duration", "-of", "json", str(master)], capture_output=True, text=True)
                info = json.loads(pr.stdout or "{}")
                shutil.copy(master, WORK / f"{label.replace(' ', '-')}.mp4")
                frame = WORK / f"{label.replace(' ', '-')}.jpg"
                subprocess.run([str(RT / "ffmpeg" / "ffmpeg.exe"), "-v", "error", "-y", "-ss", str(max(0.5, float(out.get('duration') or 2) * 0.6)), "-i", str(master), "-frames:v", "1", "-vf", "scale=640:-2", str(frame)])
            streams = [(s.get("codec_type"), s.get("codec_name"), s.get("nb_read_frames")) for s in info.get("streams", [])]
            print(f"   {label}: run {run.get('status')} in {time.time() - t1:.0f}s, master {'ok' if ok else 'MISSING'} {out.get('duration')}s {streams}")
            RESULTS[f"film:{label}"] = {"status": run.get("status"), "master": ok, "duration": out.get("duration"), "streams": streams, "error": run.get("error")}
    finally:
        kill_tree(proc)
        log.close()
        time.sleep(2)
        left = subprocess.run(["powershell", "-NoProfile", "-Command",
                               f"Get-Process | Where-Object {{ $_.Path -like '{STAGE}*' }} | Select-Object -ExpandProperty Name"], capture_output=True, text=True).stdout.split()
        RESULTS["leftover_processes"] = left
        print(f"   leftover processes after shutdown: {left or 'none'}")


if __name__ == "__main__":
    WORK.mkdir(parents=True, exist_ok=True)
    if "--no-suite" not in sys.argv:
        test_suite()
    if "--no-e2e" not in sys.argv:
        end_to_end()
    (WORK / "qa-results.json").write_text(json.dumps(RESULTS, indent=2), encoding="utf-8")
    print(json.dumps(RESULTS, indent=2))
