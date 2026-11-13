import asyncio
import hashlib
import json
import re
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "fonts-intl" / "files"
CSS_OUT = ROOT / "assets" / "fonts-intl" / "fonts-intl.css"
CATALOG = ROOT / "assets" / "fonts-intl" / "fonts-catalog.json"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

FAMILIES = [
    ("Poppins", "sans", ["latin"], "300;400;500;600;700;800;900"),
    ("Montserrat", "sans", ["latin", "cyrillic", "vietnamese"], "100..900"),
    ("Roboto", "sans", ["latin", "cyrillic", "greek", "vietnamese"], "100..900"),
    ("Open Sans", "sans", ["latin", "cyrillic", "greek", "hebrew", "vietnamese"], "300..800"),
    ("Noto Sans", "sans", ["latin", "cyrillic", "greek", "vietnamese"], "100..900"),
    ("Noto Serif", "serif", ["latin", "cyrillic", "greek", "vietnamese"], "100..900"),
    ("Raleway", "sans", ["latin", "cyrillic", "vietnamese"], "100..900"),
    ("Nunito", "sans", ["latin", "cyrillic", "vietnamese"], "200..1000"),
    ("Outfit", "sans", ["latin"], "100..900"),
    ("Sora", "sans", ["latin"], "100..800"),
    ("Lexend", "sans", ["latin", "vietnamese"], "100..900"),
    ("Plus Jakarta Sans", "sans", ["latin", "cyrillic", "vietnamese"], "200..800"),
    ("Oswald", "display", ["latin", "cyrillic", "vietnamese"], "200..700"),
    ("Barlow Condensed", "display", ["latin", "vietnamese"], "400;600;700;800;900"),
    ("Abril Fatface", "display", ["latin"], "400"),
    ("Righteous", "display", ["latin"], "400"),
    ("Bungee", "display", ["latin", "vietnamese"], "400"),
    ("Lobster", "hand", ["latin", "cyrillic", "vietnamese"], "400"),
    ("Pacifico", "hand", ["latin", "cyrillic", "vietnamese"], "400"),
    ("Merriweather", "serif", ["latin", "cyrillic", "vietnamese"], "300..900"),
    ("Lora", "serif", ["latin", "cyrillic", "vietnamese"], "400..700"),
    ("Cormorant Garamond", "serif", ["latin", "cyrillic", "vietnamese"], "300..700"),
    ("Hind Siliguri", "sans", ["bengali", "latin"], "300;400;500;600;700"),
    ("Noto Sans Bengali", "sans", ["bengali"], "100..900"),
    ("Noto Serif Bengali", "serif", ["bengali"], "100..900"),
    ("Anek Bangla", "sans", ["bengali", "latin"], "100..800"),
    ("Baloo Da 2", "display", ["bengali", "latin", "vietnamese"], "400..800"),
    ("Tiro Bangla", "serif", ["bengali", "latin"], "400"),
    ("Galada", "hand", ["bengali", "latin"], "400"),
    ("Atma", "hand", ["bengali", "latin"], "300;400;500;600;700"),
    ("Mina", "sans", ["bengali", "latin"], "400;700"),
    ("Noto Sans Devanagari", "sans", ["devanagari"], "100..900"),
    ("Hind", "sans", ["devanagari", "latin"], "300;400;500;600;700"),
    ("Mukta", "sans", ["devanagari", "latin"], "200;300;400;500;600;700;800"),
    ("Baloo 2", "display", ["devanagari", "latin", "vietnamese"], "400..800"),
    ("Tiro Devanagari Hindi", "serif", ["devanagari", "latin"], "400"),
    ("Rozha One", "display", ["devanagari", "latin"], "400"),
    ("Noto Sans Arabic", "sans", ["arabic"], "100..900"),
    ("Cairo", "sans", ["arabic", "latin"], "200..1000"),
    ("Tajawal", "sans", ["arabic", "latin"], "200;300;400;500;700;800;900"),
    ("Noto Naskh Arabic", "serif", ["arabic"], "400..700"),
    ("Amiri", "serif", ["arabic", "latin"], "400;700"),
    ("Reem Kufi", "display", ["arabic", "latin"], "400..700"),
    ("Lalezar", "display", ["arabic", "latin", "vietnamese"], "400"),
    ("Noto Nastaliq Urdu", "serif", ["arabic"], "400..700"),
    ("Heebo", "sans", ["hebrew", "latin"], "100..900"),
    ("Rubik", "sans", ["hebrew", "arabic", "cyrillic", "latin"], "300..900"),
    ("Frank Ruhl Libre", "serif", ["hebrew", "latin"], "300..900"),
    ("Noto Sans Thai", "sans", ["thai"], "100..900"),
    ("Prompt", "sans", ["thai", "latin", "vietnamese"], "300;400;500;600;700;800;900"),
    ("Kanit", "display", ["thai", "latin", "vietnamese"], "300;400;500;600;700;800;900"),
    ("Sarabun", "sans", ["thai", "latin", "vietnamese"], "300;400;500;600;700"),
    ("Noto Sans SC", "sans", ["chinese-simplified"], "100..900"),
    ("Noto Sans TC", "sans", ["chinese-traditional"], "100..900"),
    ("Noto Sans JP", "sans", ["japanese"], "100..900"),
    ("Noto Sans KR", "sans", ["korean"], "100..900"),
    ("ZCOOL KuaiLe", "display", ["chinese-simplified"], "400"),
    ("M PLUS Rounded 1c", "display", ["japanese"], "400;700;800"),
    ("Black Han Sans", "display", ["korean"], "400"),
    ("Noto Sans Tamil", "sans", ["tamil"], "100..900"),
    ("Noto Sans Telugu", "sans", ["telugu"], "100..900"),
    ("Noto Sans Kannada", "sans", ["kannada"], "100..900"),
    ("Noto Sans Malayalam", "sans", ["malayalam"], "100..900"),
    ("Noto Sans Gurmukhi", "sans", ["gurmukhi"], "100..900"),
    ("Noto Sans Gujarati", "sans", ["gujarati"], "100..900"),
    ("Noto Sans Oriya", "sans", ["oriya"], "100..900"),
    ("Noto Sans Sinhala", "sans", ["sinhala"], "100..900"),
    ("Noto Sans Khmer", "sans", ["khmer"], "100..900"),
    ("Noto Sans Lao", "sans", ["lao"], "100..900"),
    ("Noto Sans Myanmar", "sans", ["myanmar"], "100..900"),
    ("Noto Sans Ethiopic", "sans", ["ethiopic"], "100..900"),
    ("Noto Sans Armenian", "sans", ["armenian"], "100..900"),
    ("Noto Sans Georgian", "sans", ["georgian"], "100..900"),
]

FACE = re.compile(r"(/\*\s*([^*]+?)\s*\*/\s*)?@font-face\s*\{(.*?)\}", re.S)


def css_url(family: str, weights: str) -> str:
    return "https://fonts.googleapis.com/css2?family=" + family.replace(" ", "+") + ":wght@" + weights + "&display=block"


async def fetch_css(client: httpx.AsyncClient, family: str, weights: str) -> str:
    for spec in (weights, "400;700", "400"):
        r = await client.get(css_url(family, spec))
        if r.status_code == 200 and "@font-face" in r.text:
            return r.text
    raise RuntimeError(f"no css for {family}")


async def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    only = set(sys.argv[1:])
    sem = asyncio.Semaphore(16)
    css_parts: list[str] = []
    catalog = []
    total = 0
    async with httpx.AsyncClient(headers={"User-Agent": UA}, timeout=60, follow_redirects=True) as client:
        for family, category, scripts, weights in FAMILIES:
            if only and family not in only:
                continue
            css = await fetch_css(client, family, weights)
            faces = FACE.findall(css)
            jobs = []
            blocks = []
            for _, subset, body in faces:
                m = re.search(r"url\((https://[^)]+)\)", body)
                if not m:
                    continue
                url = m.group(1)
                name = re.sub(r"[^a-z0-9]+", "-", family.lower()).strip("-") + "-" + hashlib.sha1(url.encode()).hexdigest()[:10] + ".woff2"
                target = OUT / name
                jobs.append((url, target))
                local = body.replace(m.group(0), f"url(/vendor/fonts/intl/{name})")
                local = re.sub(r"font-display:\s*\w+;", "font-display: block;", local)
                blocks.append(f"/* {family} {subset or ''} */\n@font-face {{{local}}}")

            async def get(url: str, target: Path) -> int:
                if target.exists() and target.stat().st_size > 0:
                    return target.stat().st_size
                async with sem:
                    r = await client.get(url)
                    r.raise_for_status()
                    target.write_bytes(r.content)
                    return len(r.content)
            sizes = await asyncio.gather(*(get(u, t) for u, t in jobs))
            total += sum(sizes)
            css_parts.extend(blocks)
            ws = sorted({int(x) for x in re.findall(r"font-weight:\s*(\d+)", css)} | {int(x) for b in re.findall(r"font-weight:\s*(\d+)\s+(\d+)", css) for x in b})
            catalog.append({"family": family, "category": category, "scripts": scripts, "weights": [min(ws), max(ws)] if ws else [400, 400], "files": len(jobs)})
            print(f"{family:28s} {len(jobs):4d} files {sum(sizes) / 1e6:7.2f} MB", flush=True)
    if not only:
        CSS_OUT.write_text("\n".join(css_parts) + "\n", encoding="utf-8")
        CATALOG.write_text(json.dumps(catalog, indent=1), encoding="utf-8")
    print(f"total {total / 1e6:.1f} MB")


asyncio.run(main())
