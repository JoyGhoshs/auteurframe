from __future__ import annotations

import io
import threading
import time
import uuid
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageChops, ImageEnhance, ImageFilter, ImageOps

from . import config
from .store import project_dir, store

MODELS = config.DATA / "cache" / "models"
REMBG = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/"
SEGMENTERS = {
    "general": {"file": "isnet-general-use.onnx", "size": 1024, "mean": (0.485, 0.456, 0.406), "std": (1.0, 1.0, 1.0)},
    "human": {"file": "u2net_human_seg.onnx", "size": 320, "mean": (0.485, 0.456, 0.406), "std": (0.229, 0.224, 0.225)},
    "fast": {"file": "u2netp.onnx", "size": 320, "mean": (0.485, 0.456, 0.406), "std": (0.229, 0.224, 0.225)},
}
YUNET = "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
_sessions: dict[str, Any] = {}
_lock = threading.Lock()


def ensure_model(name: str, url: str) -> Path:
    MODELS.mkdir(parents=True, exist_ok=True)
    path = MODELS / name
    if path.exists() and path.stat().st_size > 100_000:
        return path
    import httpx
    tmp = path.with_suffix(".part")
    with httpx.Client(timeout=600, follow_redirects=True, headers={"User-Agent": "AuteurFrame/1.0 (+https://github.com/joyghoshs/auteurframe)"}) as client:
        with client.stream("GET", url) as r:
            r.raise_for_status()
            with open(tmp, "wb") as handle:
                for chunk in r.iter_bytes(1 << 20):
                    handle.write(chunk)
    if tmp.stat().st_size < 100_000:
        tmp.unlink(missing_ok=True)
        raise RuntimeError(f"model download for {name} failed")
    tmp.replace(path)
    return path


def _session(kind: str) -> Any:
    import onnxruntime as ort
    with _lock:
        if kind not in _sessions:
            spec = SEGMENTERS[kind]
            path = ensure_model(spec["file"], REMBG + spec["file"])
            opts = ort.SessionOptions()
            opts.intra_op_num_threads = 4
            _sessions[kind] = ort.InferenceSession(str(path), opts, providers=["CPUExecutionProvider"])
        return _sessions[kind]


def mask(img: Image.Image, kind: str = "general") -> Image.Image:
    spec = SEGMENTERS.get(kind) or SEGMENTERS["general"]
    sess = _session(kind if kind in SEGMENTERS else "general")
    size = spec["size"]
    im = np.asarray(img.convert("RGB").resize((size, size), Image.LANCZOS), dtype=np.float32)
    im = im / max(float(im.max()), 1e-6)
    for c in range(3):
        im[:, :, c] = (im[:, :, c] - spec["mean"][c]) / spec["std"][c]
    feed = {sess.get_inputs()[0].name: np.expand_dims(im.transpose(2, 0, 1), 0).astype(np.float32)}
    pred = sess.run(None, feed)[0][:, 0, :, :]
    pred = (pred - pred.min()) / max(float(pred.max() - pred.min()), 1e-6)
    out = Image.fromarray((np.squeeze(pred) * 255).astype("uint8"), mode="L").resize(img.size, Image.LANCZOS)
    return out


def remove_bg(img: Image.Image, kind: str = "general", refine: bool = True) -> Image.Image:
    m = mask(img, kind)
    if refine:
        arr = np.asarray(m, dtype=np.float32) / 255.0
        arr = np.clip((arr - 0.12) / 0.76, 0, 1)
        m = Image.fromarray((arr * 255).astype("uint8"), mode="L").filter(ImageFilter.GaussianBlur(0.6))
    out = img.convert("RGBA")
    out.putalpha(ImageChops.multiply(m, out.getchannel("A")))
    return out


def faces(img: Image.Image) -> list[dict[str, Any]]:
    import cv2
    try:
        cv2.utils.logging.setLogLevel(cv2.utils.logging.LOG_LEVEL_ERROR)
    except Exception:
        pass
    rgb = np.asarray(img.convert("RGB"))
    bgr = rgb[:, :, ::-1].copy()
    h, w = bgr.shape[:2]
    scale = min(1.0, 1280 / max(h, w))
    small = cv2.resize(bgr, (int(w * scale), int(h * scale))) if scale < 1 else bgr
    out: list[dict[str, Any]] = []
    try:
        model = ensure_model("face_detection_yunet_2023mar.onnx", YUNET)
        det = cv2.FaceDetectorYN.create(str(model), "", (small.shape[1], small.shape[0]), 0.72, 0.3, 50)
        _, found = det.detect(small)
        for f in found if found is not None else []:
            x, y, fw, fh = [float(v) / scale for v in f[:4]]
            eyes = ((f[4] + f[6]) / 2 / scale, (f[5] + f[7]) / 2 / scale)
            out.append({"box": [x / w * 100, y / h * 100, fw / w * 100, fh / h * 100], "eyes": [eyes[0] / w * 100, eyes[1] / h * 100], "score": float(f[-1])})
    except Exception:
        gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
        casc = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        for (x, y, fw, fh) in casc.detectMultiScale(gray, 1.1, 6, minSize=(40, 40)):
            x, y, fw, fh = x / scale, y / scale, fw / scale, fh / scale
            out.append({"box": [x / w * 100, y / h * 100, fw / w * 100, fh / h * 100], "eyes": [(x + fw / 2) / w * 100, (y + fh * 0.4) / h * 100], "score": 0.6})
    out.sort(key=lambda f: -f["box"][2] * f["box"][3])
    return [{k: ([round(v, 2) for v in val] if isinstance(val, list) else round(val, 3)) for k, val in f.items()} for f in out[:8]]


def subject_box(m: Image.Image) -> list[float] | None:
    arr = np.asarray(m) > 128
    if arr.mean() < 0.002:
        return None
    ys, xs = np.where(arr)
    h, w = arr.shape
    return [round(float(xs.min()) / w * 100, 2), round(float(ys.min()) / h * 100, 2), round(float(xs.max() - xs.min()) / w * 100, 2), round(float(ys.max() - ys.min()) / h * 100, 2)]


def palette(img: Image.Image, n: int = 5) -> list[str]:
    small = img.convert("RGB").resize((96, 96))
    q = small.quantize(colors=n, method=0)
    pal = q.getpalette()[: n * 3]
    counts = sorted(q.getcolors(), reverse=True)
    return ["#%02x%02x%02x" % tuple(pal[i * 3:i * 3 + 3]) for _, i in counts[:n]]


def analyze(img: Image.Image, with_subject: bool = True) -> dict[str, Any]:
    info: dict[str, Any] = {"width": img.width, "height": img.height, "mode": img.mode, "transparent": img.mode in ("RGBA", "LA") and img.getchannel("A").getextrema()[0] < 250}
    try:
        info["faces"] = faces(img)
    except Exception as error:
        info["faces"] = []
        info["face_error"] = str(error)[:120]
    if with_subject and not info["transparent"]:
        try:
            info["subject"] = subject_box(mask(img, "fast"))
        except Exception as error:
            info["subject"] = None
            info["subject_error"] = str(error)[:120]
    elif info["transparent"]:
        info["subject"] = subject_box(img.getchannel("A"))
    if info["faces"]:
        info["focus"] = info["faces"][0]["eyes"]
    elif info.get("subject"):
        b = info["subject"]
        info["focus"] = [round(b[0] + b[2] / 2, 2), round(b[1] + b[3] * 0.4, 2)]
    else:
        info["focus"] = [50.0, 45.0]
    info["palette"] = palette(img)
    gray = np.asarray(img.convert("L"), dtype=np.float32)
    info["brightness"] = round(float(gray.mean()) / 255, 3)
    return info


def _hex(c: str, default: str = "#000000") -> tuple[int, int, int]:
    c = (c or default).lstrip("#")
    if len(c) == 3:
        c = "".join(ch * 2 for ch in c)
    try:
        return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))
    except ValueError:
        return _hex(default)


def _alpha(img: Image.Image) -> Image.Image:
    return img.getchannel("A") if img.mode == "RGBA" else Image.new("L", img.size, 255)


def op_cutout(img: Image.Image, p: dict[str, Any]) -> Image.Image:
    return remove_bg(img, p.get("model", "general"))


def op_sticker(img: Image.Image, p: dict[str, Any]) -> Image.Image:
    if img.mode != "RGBA" or _alpha(img).getextrema()[0] > 250:
        img = remove_bg(img, p.get("model", "general"))
    border = int(p.get("border", max(6, round(min(img.size) * 0.018))))
    pad = border * 2 + int(p.get("shadow", 18))
    canvas = Image.new("RGBA", (img.width + pad * 2, img.height + pad * 2), (0, 0, 0, 0))
    a = Image.new("L", canvas.size, 0)
    a.paste(_alpha(img), (pad, pad))
    grown = a.filter(ImageFilter.MaxFilter(border * 2 + 1)).filter(ImageFilter.GaussianBlur(1.2))
    grown = grown.point(lambda v: 255 if v > 90 else int(v * 2.8))
    if p.get("shadow", 18):
        sh = grown.filter(ImageFilter.GaussianBlur(int(p.get("shadow", 18)) * 0.6)).point(lambda v: int(v * float(p.get("shadow_opacity", 0.35))))
        shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        shadow.putalpha(sh)
        canvas = Image.alpha_composite(canvas, ImageChops.offset(shadow, int(p.get("dx", 4)), int(p.get("dy", 10))))
    paper = Image.new("RGBA", canvas.size, _hex(p.get("color", "#ffffff")) + (0,))
    paper.putalpha(grown)
    canvas = Image.alpha_composite(canvas, paper)
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    layer.paste(img, (pad, pad), img)
    return Image.alpha_composite(canvas, layer)


def op_outline(img: Image.Image, p: dict[str, Any]) -> Image.Image:
    width = int(p.get("width", 6))
    a = _alpha(img)
    pad = width + 2
    canvas = Image.new("RGBA", (img.width + pad * 2, img.height + pad * 2), (0, 0, 0, 0))
    big = Image.new("L", canvas.size, 0)
    big.paste(a, (pad, pad))
    ring = big.filter(ImageFilter.MaxFilter(width * 2 + 1))
    line = Image.new("RGBA", canvas.size, _hex(p.get("color", "#ffffff")) + (0,))
    line.putalpha(ring)
    canvas = Image.alpha_composite(canvas, line)
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    layer.paste(img.convert("RGBA"), (pad, pad), img.convert("RGBA"))
    return Image.alpha_composite(canvas, layer)


def op_shadow(img: Image.Image, p: dict[str, Any]) -> Image.Image:
    blur = int(p.get("blur", 24))
    pad = blur * 2 + abs(int(p.get("dy", 16)))
    rgba = img.convert("RGBA")
    canvas = Image.new("RGBA", (img.width + pad * 2, img.height + pad * 2), (0, 0, 0, 0))
    a = Image.new("L", canvas.size, 0)
    a.paste(_alpha(rgba), (pad + int(p.get("dx", 0)), pad + int(p.get("dy", 16))))
    sh = Image.new("RGBA", canvas.size, _hex(p.get("color", "#000000")) + (0,))
    sh.putalpha(a.filter(ImageFilter.GaussianBlur(blur)).point(lambda v: int(v * float(p.get("opacity", 0.45)))))
    canvas = Image.alpha_composite(canvas, sh)
    canvas.paste(rgba, (pad, pad), rgba)
    return canvas


def op_trim(img: Image.Image, p: dict[str, Any]) -> Image.Image:
    box = _alpha(img).point(lambda v: 255 if v > 8 else 0).getbbox()
    if not box:
        return img
    m = int(p.get("margin", 0))
    return img.crop((max(0, box[0] - m), max(0, box[1] - m), min(img.width, box[2] + m), min(img.height, box[3] + m)))


def op_crop(img: Image.Image, p: dict[str, Any]) -> Image.Image:
    w, h = img.size
    if p.get("box"):
        x, y, bw, bh = [float(v) for v in p["box"]]
        return img.crop((int(x / 100 * w), int(y / 100 * h), int((x + bw) / 100 * w), int((y + bh) / 100 * h)))
    if p.get("aspect"):
        a, b = [float(v) for v in str(p["aspect"]).replace("/", ":").split(":")]
        ratio = a / b
        fx, fy = p.get("focus") or analyze(img, with_subject=bool(p.get("smart", True)))["focus"]
        cw, ch = (w, w / ratio) if w / h < ratio else (h * ratio, h)
        cx = min(max(fx / 100 * w - cw / 2, 0), w - cw)
        cy = min(max(fy / 100 * h - ch / 2, 0), h - ch)
        return img.crop((int(cx), int(cy), int(cx + cw), int(cy + ch)))
    if p.get("subject"):
        info = analyze(img)
        b = info.get("subject") or [0, 0, 100, 100]
        pad = float(p.get("pad", 6))
        return op_crop(img, {"box": [max(0, b[0] - pad), max(0, b[1] - pad), min(100, b[2] + pad * 2), min(100, b[3] + pad * 2)]})
    return img


def op_resize(img: Image.Image, p: dict[str, Any]) -> Image.Image:
    w, h = img.size
    if p.get("scale"):
        s = float(p["scale"])
        return img.resize((max(1, int(w * s)), max(1, int(h * s))), Image.LANCZOS)
    tw, th = p.get("width"), p.get("height")
    if tw and th:
        return ImageOps.fit(img, (int(tw), int(th)), Image.LANCZOS) if p.get("fill", True) else _contain(img, int(tw), int(th))
    if tw:
        return img.resize((int(tw), max(1, int(h * int(tw) / w))), Image.LANCZOS)
    if th:
        return img.resize((max(1, int(w * int(th) / h)), int(th)), Image.LANCZOS)
    return img


def _contain(img: Image.Image, tw: int, th: int) -> Image.Image:
    s = min(tw / img.width, th / img.height)
    return img.resize((max(1, int(img.width * s)), max(1, int(img.height * s))), Image.LANCZOS)


def op_upscale(img: Image.Image, p: dict[str, Any]) -> Image.Image:
    f = max(1.0, min(4.0, float(p.get("factor", 2))))
    big = img.resize((int(img.width * f), int(img.height * f)), Image.LANCZOS)
    return big.filter(ImageFilter.UnsharpMask(radius=1.6 * f, percent=int(p.get("sharpen", 70)), threshold=2))


def _keep_alpha(src: Image.Image, out: Image.Image) -> Image.Image:
    if src.mode == "RGBA":
        out = out.convert("RGBA")
        out.putalpha(src.getchannel("A"))
    return out


def op_duotone(img: Image.Image, p: dict[str, Any]) -> Image.Image:
    g = ImageOps.autocontrast(img.convert("L"), cutoff=1)
    return _keep_alpha(img, ImageOps.colorize(g, _hex(p.get("dark", "#1b1b3a")), _hex(p.get("light", "#f6e7c1")), mid=_hex(p["mid"]) if p.get("mid") else None))


def op_grayscale(img: Image.Image, p: dict[str, Any]) -> Image.Image:
    return _keep_alpha(img, ImageOps.autocontrast(img.convert("L"), cutoff=float(p.get("cutoff", 0.5))).convert("RGB"))


def op_sepia(img: Image.Image, p: dict[str, Any]) -> Image.Image:
    return op_duotone(img, {"dark": p.get("dark", "#2b1d0e"), "light": p.get("light", "#f3e3c3"), "mid": p.get("mid", "#a0784a")})


def op_halftone(img: Image.Image, p: dict[str, Any]) -> Image.Image:
    from PIL import ImageDraw
    cell = int(p.get("cell", 10))
    g = img.convert("L")
    w, h = g.size
    small = g.resize((max(1, w // cell), max(1, h // cell)), Image.BOX)
    out = Image.new("RGB", (w, h), _hex(p.get("paper", "#f4efe4")))
    d = ImageDraw.Draw(out)
    ink = _hex(p.get("ink", "#161616"))
    arr = np.asarray(small, dtype=np.float32) / 255
    for j in range(arr.shape[0]):
        for i in range(arr.shape[1]):
            r = (1 - arr[j, i]) * cell * 0.62
            if r > 0.4:
                cx, cy = i * cell + cell / 2, j * cell + cell / 2
                d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=ink)
    return _keep_alpha(img, out)


def op_posterize(img: Image.Image, p: dict[str, Any]) -> Image.Image:
    return _keep_alpha(img, ImageOps.posterize(img.convert("RGB"), int(p.get("bits", 3))))


def op_sketch(img: Image.Image, p: dict[str, Any]) -> Image.Image:
    import cv2
    gray = cv2.cvtColor(np.asarray(img.convert("RGB")), cv2.COLOR_RGB2GRAY)
    inv = 255 - gray
    blur = cv2.GaussianBlur(inv, (0, 0), float(p.get("soft", 8)))
    sketch = cv2.divide(gray, 255 - blur, scale=256)
    if p.get("lines_only"):
        edges = cv2.Canny(gray, 60, 140)
        sketch = 255 - edges
    return _keep_alpha(img, Image.fromarray(sketch).convert("RGB"))


def op_blur_bg(img: Image.Image, p: dict[str, Any]) -> Image.Image:
    m = mask(img, p.get("model", "general"))
    blurred = img.convert("RGB").filter(ImageFilter.GaussianBlur(float(p.get("radius", 14))))
    if p.get("dim"):
        blurred = ImageEnhance.Brightness(blurred).enhance(1 - float(p["dim"]))
    return Image.composite(img.convert("RGB"), blurred, m)


def op_adjust(img: Image.Image, p: dict[str, Any]) -> Image.Image:
    out = img.convert("RGBA") if img.mode == "RGBA" else img.convert("RGB")
    rgb = out.convert("RGB")
    for key, cls in (("brightness", ImageEnhance.Brightness), ("contrast", ImageEnhance.Contrast), ("saturation", ImageEnhance.Color), ("sharpness", ImageEnhance.Sharpness)):
        if p.get(key) is not None:
            rgb = cls(rgb).enhance(float(p[key]))
    return _keep_alpha(img, rgb)


def op_tint(img: Image.Image, p: dict[str, Any]) -> Image.Image:
    color = Image.new("RGB", img.size, _hex(p.get("color", "#ff3b30")))
    mode = p.get("mode", "multiply")
    base = img.convert("RGB")
    mixed = ImageChops.multiply(base, color) if mode == "multiply" else ImageChops.screen(base, color) if mode == "screen" else color
    return _keep_alpha(img, Image.blend(base, mixed, float(p.get("amount", 0.5))))


def op_vignette(img: Image.Image, p: dict[str, Any]) -> Image.Image:
    w, h = img.size
    y, x = np.ogrid[:h, :w]
    d = np.sqrt(((x - w / 2) / (w / 2)) ** 2 + ((y - h / 2) / (h / 2)) ** 2)
    k = np.clip(1 - float(p.get("strength", 0.45)) * np.clip(d - 0.35, 0, 1) ** 1.4, 0, 1)
    arr = np.asarray(img.convert("RGB"), dtype=np.float32) * k[:, :, None]
    return _keep_alpha(img, Image.fromarray(arr.clip(0, 255).astype("uint8")))


def op_grain(img: Image.Image, p: dict[str, Any]) -> Image.Image:
    rng = np.random.default_rng(int(p.get("seed", 3)))
    arr = np.asarray(img.convert("RGB"), dtype=np.float32)
    noise = rng.normal(0, float(p.get("amount", 0.06)) * 255, arr.shape[:2])[:, :, None]
    return _keep_alpha(img, Image.fromarray((arr + noise).clip(0, 255).astype("uint8")))


def op_shape(img: Image.Image, p: dict[str, Any]) -> Image.Image:
    from PIL import ImageDraw
    w, h = img.size
    m = Image.new("L", (w * 2, h * 2), 0)
    d = ImageDraw.Draw(m)
    kind = p.get("shape", "rounded")
    if kind == "circle":
        s = min(w, h) * 2
        d.ellipse([(w * 2 - s) / 2, (h * 2 - s) / 2, (w * 2 + s) / 2, (h * 2 + s) / 2], fill=255)
    elif kind == "torn":
        rng = np.random.default_rng(int(p.get("seed", 5)))
        inset = min(w, h) * 0.06
        pts = []
        steps = 90
        for side in range(4):
            for i in range(steps):
                u = i / steps
                j = rng.uniform(-1, 1) * inset * 0.3
                if side == 0:
                    pts.append((inset + u * (w * 2 - 2 * inset), inset + j))
                elif side == 1:
                    pts.append((w * 2 - inset + j, inset + u * (h * 2 - 2 * inset)))
                elif side == 2:
                    pts.append((w * 2 - inset - u * (w * 2 - 2 * inset), h * 2 - inset + j))
                else:
                    pts.append((inset + j, h * 2 - inset - u * (h * 2 - 2 * inset)))
        d.polygon(pts, fill=255)
    else:
        d.rounded_rectangle([0, 0, w * 2 - 1, h * 2 - 1], radius=int(p.get("radius", 40)) * 2, fill=255)
    m = m.resize((w, h), Image.LANCZOS)
    out = img.convert("RGBA")
    out.putalpha(ImageChops.multiply(m, _alpha(out)))
    return out


def op_border(img: Image.Image, p: dict[str, Any]) -> Image.Image:
    return ImageOps.expand(img.convert("RGBA"), border=int(p.get("width", 16)), fill=_hex(p.get("color", "#ffffff")) + (255,))


def op_flip(img: Image.Image, p: dict[str, Any]) -> Image.Image:
    return ImageOps.mirror(img) if p.get("axis", "h") == "h" else ImageOps.flip(img)


def op_rotate(img: Image.Image, p: dict[str, Any]) -> Image.Image:
    return img.convert("RGBA").rotate(-float(p.get("degrees", 0)), resample=Image.BICUBIC, expand=True)


def op_pixelate(img: Image.Image, p: dict[str, Any]) -> Image.Image:
    c = int(p.get("cell", 16))
    return img.resize((max(1, img.width // c), max(1, img.height // c)), Image.BOX).resize(img.size, Image.NEAREST)


def op_invert(img: Image.Image, p: dict[str, Any]) -> Image.Image:
    return _keep_alpha(img, ImageOps.invert(img.convert("RGB")))


OPS = {"cutout": op_cutout, "remove_bg": op_cutout, "sticker": op_sticker, "outline": op_outline, "shadow": op_shadow, "trim": op_trim, "crop": op_crop,
       "resize": op_resize, "upscale": op_upscale, "duotone": op_duotone, "grayscale": op_grayscale, "sepia": op_sepia, "halftone": op_halftone,
       "posterize": op_posterize, "sketch": op_sketch, "blur_bg": op_blur_bg, "adjust": op_adjust, "tint": op_tint, "vignette": op_vignette, "grain": op_grain,
       "shape": op_shape, "border": op_border, "flip": op_flip, "rotate": op_rotate, "pixelate": op_pixelate, "invert": op_invert}

OPS_HELP = """cutout {model: general|human|fast} remove the background (local AI model, transparent PNG)
sticker {border, color, shadow} paper cut-out: removes the background if needed, adds a white border and a soft drop shadow
outline {width, color} | shadow {blur, dy, opacity, color} | trim {margin} (crop away transparent edges)
crop {box: [x,y,w,h] %} | crop {aspect: "16:9", smart: true} (keeps faces or the subject in frame) | crop {subject: true, pad}
resize {width|height|scale, fill} | upscale {factor: 2} | rotate {degrees} | flip {axis: h|v} | border {width, color}
duotone {dark, light, mid} | grayscale | sepia | halftone {cell, ink, paper} | posterize {bits} | sketch {soft, lines_only} | invert | pixelate {cell}
blur_bg {radius, dim} (keeps the subject sharp) | adjust {brightness, contrast, saturation, sharpness} (1 = unchanged) | tint {color, amount, mode}
vignette {strength} | grain {amount} | shape {shape: circle|rounded|torn, radius}"""


def load(pid: str, asset: dict[str, Any]) -> Image.Image:
    path = project_dir(pid) / "assets" / asset["file"]
    img = Image.open(path)
    img.load()
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA" if "A" in img.getbands() or img.mode == "P" else "RGB")
    return img


def apply_ops(img: Image.Image, ops: list[dict[str, Any]]) -> tuple[Image.Image, list[str]]:
    done = []
    for op in ops:
        name = str(op.get("op") or "").strip()
        fn = OPS.get(name)
        if not fn:
            raise ValueError(f"unknown image operation '{name}'. Available:\n{OPS_HELP}")
        img = fn(img, op)
        done.append(name)
    return img, done


def save_new(pid: str, img: Image.Image, name: str, meta: dict[str, Any]) -> dict[str, Any]:
    aid = "as_" + uuid.uuid4().hex[:10]
    folder = project_dir(pid) / "assets"
    folder.mkdir(parents=True, exist_ok=True)
    has_alpha = img.mode == "RGBA" and img.getchannel("A").getextrema()[0] < 255
    if has_alpha:
        path = folder / f"{aid}.png"
        img.save(path, "PNG", optimize=True)
        mime = "image/png"
    else:
        path = folder / f"{aid}.jpg"
        img.convert("RGB").save(path, "JPEG", quality=92)
        mime = "image/jpeg"
    meta = dict(meta, width=img.width, height=img.height, transparent=has_alpha)
    asset = {"id": aid, "name": name[:80], "file": path.name, "kind": "image", "mime": mime, "size": path.stat().st_size, "role": "generated",
             "url": f"/media/{pid}/assets/{path.name}", "meta": meta, "added": time.time()}
    store.mutate(pid, lambda p: p.setdefault("assets", []).append(asset))
    return asset


def edit(pid: str, asset: dict[str, Any], ops: list[dict[str, Any]], name: str = "") -> dict[str, Any]:
    img = load(pid, asset)
    out, done = apply_ops(img, ops)
    meta = {k: v for k, v in (asset.get("meta") or {}).items() if k in ("attribution", "source", "page", "license", "credit")}
    meta["edited_from"] = asset["id"]
    meta["ops"] = done
    return save_new(pid, out, name or f"{asset.get('name', 'image')} ({', '.join(done)})", meta)


def to_jpeg_b64(img: Image.Image, box: int = 900) -> str:
    import base64
    im = img.copy()
    if im.mode == "RGBA":
        checker = np.indices((im.height // 16 + 1, im.width // 16 + 1)).sum(axis=0) % 2
        bg = Image.fromarray((np.kron(checker, np.ones((16, 16))) * 40 + 200).astype("uint8")[: im.height, : im.width]).convert("RGBA")
        bg.alpha_composite(im)
        im = bg
    im = im.convert("RGB")
    im.thumbnail((box, box))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=78)
    return base64.b64encode(buf.getvalue()).decode()


FACE_TASK = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
RIG = {
    "lips_out": [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146],
    "lips_in": [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95],
    "up_in": [191, 80, 81, 82, 13, 312, 311, 310, 415], "lo_in": [95, 88, 178, 87, 14, 317, 402, 318, 324],
    "up_out": [185, 40, 39, 37, 0, 267, 269, 270, 409], "lo_out": [146, 91, 181, 84, 17, 314, 405, 321, 375],
    "eye_r_up": [246, 161, 160, 159, 158, 157, 173], "eye_r_lo": [7, 163, 144, 145, 153, 154, 155], "eye_r_c": [33, 133],
    "eye_l_up": [398, 384, 385, 386, 387, 388, 466], "eye_l_lo": [382, 381, 380, 374, 373, 390, 249], "eye_l_c": [362, 263],
    "brow_r": [70, 63, 105, 66, 107, 55, 65, 52, 53, 46], "brow_l": [300, 293, 334, 296, 336, 285, 295, 282, 283, 276],
    "oval": [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109],
    "nose": [1, 2, 98, 327, 168, 6, 197, 195, 5, 4, 129, 358],
    "cheeks": [50, 280, 205, 425, 187, 411, 214, 434, 192, 416, 147, 376, 123, 352, 118, 347, 101, 330],
}


def _delaunay(pts: list[tuple[float, float]]) -> list[tuple[int, int, int]]:
    n = len(pts)
    big = 10.0
    P = list(pts) + [(-big, -big), (big * 2, -big), (0.5, big * 2)]
    tris = [(n, n + 1, n + 2)]

    def circ(t: tuple[int, int, int]) -> tuple[float, float, float]:
        (ax, ay), (bx, by), (cx, cy) = P[t[0]], P[t[1]], P[t[2]]
        d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by)) or 1e-12
        ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d
        uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d
        return ux, uy, (ax - ux) ** 2 + (ay - uy) ** 2
    cache = {tris[0]: circ(tris[0])}
    for i in range(n):
        x, y = P[i]
        bad = [t for t in tris if (x - cache[t][0]) ** 2 + (y - cache[t][1]) ** 2 < cache[t][2]]
        edges: dict[tuple[int, int], int] = {}
        for t in bad:
            for e in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])):
                k = tuple(sorted(e))
                edges[k] = edges.get(k, 0) + 1
        tris = [t for t in tris if t not in bad]
        for (a, b), c in edges.items():
            if c == 1:
                t = (a, b, i)
                cache[t] = circ(t)
                tris.append(t)
    return [t for t in tris if max(t) < n]


def face_rig(img: Image.Image) -> dict[str, Any] | None:
    import mediapipe as mp
    from mediapipe.tasks.python import BaseOptions, vision
    model = ensure_model("face_landmarker.task", FACE_TASK)
    opts = vision.FaceLandmarkerOptions(base_options=BaseOptions(model_asset_path=str(model)), num_faces=1)
    rgb = np.ascontiguousarray(np.asarray(img.convert("RGB")))
    with vision.FaceLandmarker.create_from_options(opts) as det:
        res = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
    if not res.face_landmarks:
        return None
    lm = res.face_landmarks[0]
    order: list[int] = []
    for key in ("oval", "lips_out", "lips_in", "eye_r_up", "eye_r_lo", "eye_r_c", "eye_l_up", "eye_l_lo", "eye_l_c", "brow_r", "brow_l", "nose", "cheeks"):
        for i in RIG[key]:
            if i not in order:
                order.append(i)
    pts = [(float(lm[i].x), float(lm[i].y)) for i in order]
    idx = {lmi: k for k, lmi in enumerate(order)}
    cx = sum(p[0] for p in pts[:36]) / 36
    cy = sum(p[1] for p in pts[:36]) / 36
    fixed_start = len(pts)
    for i in RIG["oval"]:
        x, y = lm[i].x, lm[i].y
        pts.append((min(1.0, max(0.0, cx + (x - cx) * 1.45)), min(1.0, max(0.0, cy + (y - cy) * 1.45))))
    for x, y in ((0, 0), (0.5, 0), (1, 0), (1, 0.5), (1, 1), (0.5, 1), (0, 1), (0, 0.5)):
        pts.append((float(x), float(y)))
    tris = _delaunay(pts)
    inner = {idx[i] for i in RIG["lips_in"]}
    poly = [pts[idx[i]] for i in RIG["lips_in"]]

    def inside(px: float, py: float) -> bool:
        c = False
        for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
            if (y1 > py) != (y2 > py) and px < (x2 - x1) * (py - y1) / ((y2 - y1) or 1e-12) + x1:
                c = not c
        return c
    mouth = [k for k, t in enumerate(tris) if all(v in inner for v in t) and inside(sum(pts[v][0] for v in t) / 3, sum(pts[v][1] for v in t) / 3)]
    groups = {k: [idx[i] for i in v] for k, v in RIG.items()}
    face_w = max(p[0] for p in pts[:36]) - min(p[0] for p in pts[:36])
    return {"points": [[round(x, 5), round(y, 5)] for x, y in pts], "tris": tris, "mouth_tris": mouth, "groups": groups, "fixed": fixed_start,
            "center": [round(cx, 5), round(cy, 5)], "face_w": round(face_w, 5), "chin": idx[152], "top": idx[10], "aspect": round(img.width / img.height, 5)}


def rig_asset(pid: str, asset: dict[str, Any]) -> dict[str, Any] | None:
    rig = face_rig(load(pid, asset))
    if rig:
        store.mutate(pid, lambda p: [a.setdefault("meta", {}).__setitem__("rig", rig) for a in p["assets"] if a["id"] == asset["id"]])
    return rig
