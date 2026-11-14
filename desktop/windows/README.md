# AuteurFrame for Windows (desktop package)

This folder turns the unmodified AuteurFrame release into a self-contained Windows desktop app and installer,
`dist\AuteurFrame-Setup-<version>.exe`. Users install it like any desktop program; nothing else (Python, Node.js,
FFmpeg, Chrome, Git, Docker or WSL) has to be installed.

## How it works

```
AuteurFrame.exe (launcher, .NET Framework 4.8 + WebView2)
 ├─ starts runtime\python\python.exe app\run.py on 127.0.0.1 (hidden, inside a Windows Job Object)
 │    └─ AuteurFrame server ── starts runtime\node\node.exe app\renderer\src\server.mjs
 │                               └─ drives runtime\chrome\chrome.exe (headless) and runtime\ffmpeg\ffmpeg.exe
 └─ shows the studio UI in a native window (Edge WebView2; falls back to the bundled Chrome in app mode)
```

- The launcher passes everything through AuteurFrame's own environment variables (`AUTEUR_DATA`, `AUTEUR_PORT`,
  `RENDERER_PORT`, `NODE_PATH_BIN`, `FFMPEG_PATH`, `FFPROBE_PATH`, `CHROME_PATH`), so the application code is not changed.
- The server listens on 127.0.0.1 only, on port 48800 when free (a stable origin keeps UI preferences) or a random port.
- Every child process (Python, Node, Chrome, FFmpeg) runs inside a Job Object with kill-on-close: closing or crashing
  the launcher never leaves background processes behind.
- User data (projects, settings, API keys) lives in `%LOCALAPPDATA%\AuteurFrame\data`; logs in `...\logs`;
  the WebView2 profile in `...\webview`. Upgrades and reinstalls never touch it; the uninstaller asks before deleting it.
- Closing the window while a film is being generated asks for confirmation.
- Single instance: starting AuteurFrame again brings the open window to the front.
- The render pool is sized to the PC (two Chrome render nodes on 8 GB machines, up to six on 32 GB), so idle memory stays reasonable.
- AuteurFrame gets a private temp folder, so files other programs leave in `%TEMP%` (such as a stray `package.json`) cannot break Node.

## Layout of an installation

| Path | Contents |
|---|---|
| `AuteurFrame.exe` | launcher |
| `app\` | the AuteurFrame release, plus `web\vendor` and production `node_modules` built at package time |
| `runtime\python\` | CPython embeddable distribution with all packages from `requirements.txt` (Windows wheels) |
| `runtime\node\` | `node.exe` |
| `runtime\ffmpeg\` | `ffmpeg.exe`, `ffprobe.exe` |
| `runtime\chrome\` | Chrome for Testing (headless rendering, and the fallback app window) |
| `licenses\` | AuteurFrame and all bundled component licences |
| `python-packages.txt`, `desktop-build.json` | exact package and runtime versions in this build |

## Building

Requirements on the build machine (not needed by users): Windows 10/11 x64, Python 3.13 (`py -3.13`, used only to
download Windows wheels), .NET SDK 8 or newer, Inno Setup 6, internet access.

```powershell
powershell -ExecutionPolicy Bypass -File build.ps1                 # full build: stage + smoke test + installer
powershell -ExecutionPolicy Bypass -File build.ps1 -SkipInstaller  # stage only
py -3.13 qa.py [install dir]                                # QA: full test suite on the bundled Python + end-to-end renders
powershell -File tools\check_install.ps1 -Phase install     # silent install to %USERPROFILE%\AuteurFrame-QA-install + smoke test
powershell -File tools\check_ui.ps1                          # open the real window, capture it, close it, check nothing is left running
powershell -File tools\check_install.ps1 -Phase uninstall   # silent uninstall and leftovers check
```

`versions.json` pins every runtime by version and SHA-256; the build refuses a download whose checksum does not match.
To update a runtime, change its version and URL, clear its `sha256`, build once, then pin the printed checksum.

The application source is copied from `app_source` in `versions.json` (the release repository); pass
`-AppSource <path>` to build another checkout and `-Version <x.y.z>` to change the installer version.

## Signing

Unsigned installers trigger Windows SmartScreen ("Windows protected your PC"). Sign both the launcher and the
installer with a code-signing certificate before publishing:

```powershell
signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 /a build\AuteurFrame\AuteurFrame.exe
# then rebuild the installer and sign dist\AuteurFrame-Setup-<version>.exe the same way
```
Inno Setup can also sign the installer and uninstaller automatically with a `SignTool=` entry.

## Known platform differences

- The animators' optional sandboxed shell tool (`run`) needs Linux namespaces and is disabled on Windows by
  AuteurFrame itself; every other agent tool, preview and render path works.
- Optional engines (for example Manim) are not bundled.
