import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

out = Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)

BG = (5, 6, 10, 255)
INK = (245, 247, 250, 255)
BLUE = (27, 77, 255, 255)
A = [(64, 12.8), (106.4, 115.2), (87.6, 115.2), (64, 57.6), (40.4, 115.2), (21.6, 115.2)]
BAR = (18.4, 72.4, 109.6, 86.8)


def mark(size, ink=INK, ss=4):
    big = size * ss
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    k = big / 128
    d.polygon([(x * k, y * k) for x, y in A], fill=ink)
    d.rectangle([BAR[0] * k, BAR[1] * k, BAR[2] * k, BAR[3] * k], fill=BLUE)
    return img.resize((size, size), Image.LANCZOS)


def tile(size, pad=0.17, radius=0.23, ss=4):
    big = size * ss
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    ImageDraw.Draw(img).rounded_rectangle([0, 0, big - 1, big - 1], radius=int(big * radius), fill=BG)
    inner = int(big * (1 - pad * 2))
    img.alpha_composite(mark(inner, ss=1), (int(big * pad), int(big * pad)))
    return img.resize((size, size), Image.LANCZOS)


sizes = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256]
frames = [tile(s, pad=0.12 if s <= 24 else 0.17) for s in sizes]
frames[-1].save(out / "AuteurFrame.ico", sizes=[(s, s) for s in sizes], append_images=frames[:-1])
mark(192).save(out / "splash.png")
tile(512).save(out / "AuteurFrame-512.png")

side = Image.new("RGB", (164, 314))
for y in range(314):
    k = y / 313
    side.paste((int(5 + 18 * k), int(6 + 12 * k), int(10 + 44 * k)), (0, y, 164, y + 1))
m = mark(92)
side.paste(m, (36, 74), m)
d = ImageDraw.Draw(side)
try:
    font = ImageFont.truetype("segoeuib.ttf", 17)
    small = ImageFont.truetype("segoeui.ttf", 11)
except OSError:
    font = small = ImageFont.load_default()
d.text((82, 190), "AuteurFrame", fill=INK[:3], font=font, anchor="mm")
d.text((82, 211), "Motion, directed by agents", fill=(150, 156, 178), font=small, anchor="mm")
side.save(out / "wizard-side.bmp")
side.save(out / "wizard-side-preview.png")

small_img = Image.new("RGB", (55, 58), (255, 255, 255))
t = tile(48, pad=0.15)
small_img.paste(t, (3, 5), t)
small_img.save(out / "wizard-small.bmp")
print("assets ok")
