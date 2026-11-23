#!/usr/bin/env python3
"""Compose leaf cards for Bloc City's trees from CC0 ambientCG leaf scans, then pack them as a KTX2 array.
Layers: 0 plane tree twig, 1 broadleaf twig, 2 pine twig, 3 palm frond, 4 grass tuft.
Usage: python3 foliage.py SRC OUT   (SRC = fetch.py folder, OUT = site/city/tex)"""
import json, math, os, random, shutil, subprocess, sys, tempfile
from PIL import Image, ImageDraw, ImageFilter

SRC, OUT = sys.argv[1], sys.argv[2]
TOKTX = shutil.which('toktx') or '/home/claude/work/bin/toktx'
A = os.path.join(SRC, 'ambientcg')
R = random.Random(7)

def rgba(name):
    c = Image.open(f'{A}/{name}/{name}_2K-JPG_Color.jpg').convert('RGB')
    o = Image.open(f'{A}/{name}/{name}_2K-JPG_Opacity.jpg').convert('L')
    im = c.copy(); im.putalpha(o); return im

def cells(im, cols, rows):
    W, H = im.size; out = []
    for j in range(rows):
        for i in range(cols):
            c = im.crop((i * W // cols, j * H // rows, (i + 1) * W // cols, (j + 1) * H // rows))
            bb = c.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
            if bb: out.append(c.crop(bb))
    return out

def twig(leaves, size=1024, n=16, stem=(70, 52, 34), spread=0.9, scale=0.34, droop=0.25):
    """a stem up the middle of the card with leaves along it, alternating sides"""
    card = Image.new('RGBA', (size, size), (0, 0, 0, 0)); d = ImageDraw.Draw(card)
    base = (size * 0.5, size * 0.98); tip = (size * 0.5 + R.uniform(-60, 60), size * 0.08)
    pts = [(base[0] + (tip[0] - base[0]) * t + math.sin(t * 3) * 18, base[1] + (tip[1] - base[1]) * t) for t in [k / 20 for k in range(21)]]
    d.line(pts, fill=stem + (255,), width=max(3, size // 120))
    for k in range(n):
        t = 0.12 + 0.86 * k / (n - 1)
        x, y = pts[int(t * 20)]
        side = -1 if k % 2 else 1
        leaf = R.choice(leaves)
        s = scale * (1.0 - 0.35 * t) * R.uniform(0.85, 1.15)
        lw = int(size * s * leaf.size[0] / max(leaf.size)); lh = int(size * s * leaf.size[1] / max(leaf.size))
        L = leaf.resize((max(8, lw), max(8, lh)), Image.LANCZOS)
        ang = side * R.uniform(35, 70) + R.uniform(-10, 10) - droop * 20 * side
        L = L.rotate(ang, expand=True, resample=Image.BICUBIC)
        dx = side * spread * L.size[0] * 0.45
        card.alpha_composite(L, (int(x + dx - L.size[0] / 2), int(y - L.size[1] * 0.6)))
        d.line([(x, y), (x + dx * 0.6, y - L.size[1] * 0.25)], fill=stem + (255,), width=max(2, size // 200))
    top = R.choice(leaves); s = scale * 0.7
    T = top.resize((int(size * s * top.size[0] / max(top.size)), int(size * s * top.size[1] / max(top.size))), Image.LANCZOS)
    card.alpha_composite(T, (int(tip[0] - T.size[0] / 2), int(max(0, tip[1] - T.size[1] * 0.5))))
    return card

def palm(size=1024):
    """a palm frond: a curved rachis with long thin leaflets, drawn"""
    card = Image.new('RGBA', (size, size), (0, 0, 0, 0)); d = ImageDraw.Draw(card)
    rach = [(size * 0.5 + math.sin(t * 1.6) * size * 0.06, size * (0.98 - 0.92 * t)) for t in [k / 40 for k in range(41)]]
    for k in range(2, 40):
        x, y = rach[k]; t = k / 40
        for side in (-1, 1):
            L = size * 0.42 * math.sin(math.pi * min(1, t * 1.1)) * R.uniform(0.85, 1.05)
            ang = math.radians(90 - 55 * side + R.uniform(-6, 6) + t * 25 * side)
            ex, ey = x + math.cos(ang) * L * side * -1 * -1, y - math.sin(ang) * L * 0.35 - L * 0.1
            ex = x + side * L * 0.95; ey = y + L * 0.18 * (0.5 - t) + R.uniform(-8, 8)
            g = int(R.uniform(95, 125)); col = (int(g * 0.55), g, int(g * 0.38), 255)
            w = max(2, int(size * 0.012 * (1.1 - t)))
            d.polygon([(x, y - w), (ex, ey), (x, y + w)], fill=col)
    d.line(rach, fill=(120, 110, 60, 255), width=max(3, size // 110))
    return card.filter(ImageFilter.SMOOTH)

def pinecard(size=1024):
    """stone-pine twigs: tufts of green needles along a few short brown twigs"""
    card = Image.new('RGBA', (size, size), (0, 0, 0, 0)); d = ImageDraw.Draw(card)
    for t in range(6):
        x0, y0 = R.uniform(0.2, 0.8) * size, R.uniform(0.55, 0.95) * size
        ang = math.radians(R.uniform(-120, -60)); L = R.uniform(0.35, 0.55) * size
        x1, y1 = x0 + math.cos(ang) * L, y0 + math.sin(ang) * L
        d.line([(x0, y0), (x1, y1)], fill=(88, 62, 40, 255), width=max(3, size // 150))
        for k in range(10):
            f = 0.3 + 0.7 * k / 9; cx, cy = x0 + (x1 - x0) * f, y0 + (y1 - y0) * f
            for n in range(26):
                a = R.uniform(0, math.pi * 2); l = R.uniform(0.05, 0.11) * size
                g = int(R.uniform(70, 110))
                d.line([(cx, cy), (cx + math.cos(a) * l, cy + math.sin(a) * l * 0.8)], fill=(int(g * 0.5), g, int(g * 0.42), 255), width=max(1, size // 400))
    return card

def grass(size=1024):
    src = cells(rgba('Foliage003'), 4, 2)
    card = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    for k in range(7):
        g = R.choice(src); s = R.uniform(0.75, 1.0)
        G = g.resize((int(size * 0.32 * s), int(size * s)), Image.LANCZOS)
        card.alpha_composite(G, (int(R.uniform(0, size - G.size[0])), size - G.size[1]))
    return card

def main():
    os.makedirs(OUT, exist_ok=True)
    plane = cells(rgba('LeafSet010'), 2, 2)
    broad = cells(rgba('LeafSet009'), 3, 2)
    pine = cells(rgba('PineNeedles001'), 2, 4)
    layers = [
        twig(plane, n=12, scale=0.38, stem=(92, 76, 50)),
        twig(broad, n=18, scale=0.24, stem=(70, 55, 38)),
        Image.new('RGBA', (1024, 1024)),
        palm(),
        grass()
    ]
    layers[2] = pinecard()
    from PIL import ImageEnhance
    def tone(im, mul):
        r, g, b, a = im.split()
        r = r.point(lambda v: int(v * mul[0])); g = g.point(lambda v: int(v * mul[1])); b = b.point(lambda v: int(v * mul[2]))
        return Image.merge('RGBA', (r, g, b, a))
    layers[0] = tone(layers[0], (0.62, 0.78, 0.5)); layers[1] = tone(layers[1], (0.55, 0.8, 0.45))
    tmp = tempfile.mkdtemp()
    for tier in (512, 1024):
        files = []
        for i, L in enumerate(layers):
            im = L.resize((tier, tier), Image.LANCZOS)
            # bleed colour into transparent pixels so mipmaps don't fringe white
            rgb = Image.new('RGB', im.size, (52, 72, 30)); rgb.paste(im.convert('RGB'), (0, 0), im.getchannel('A'))
            bl = rgb.filter(ImageFilter.GaussianBlur(6)); out = bl.copy(); out.paste(rgb, (0, 0), im.getchannel('A').point(lambda v: 255 if v > 8 else 0))
            out.putalpha(im.getchannel('A'))
            f = os.path.join(tmp, f'leaf-{tier}-{i}.png'); out.save(f); files.append(f)
            if tier == 512: out.save(f'/home/claude/work/leaf-{i}.png')
        dst = os.path.join(OUT, f'leaf-c-{tier}.ktx2')
        subprocess.run([TOKTX, '--t2', '--genmipmap', '--threads', '2', '--layers', str(len(files)), '--encode', 'uastc', '--uastc_quality', '1', '--uastc_rdo_l', '2', '--zcmp', '18', '--assign_oetf', 'srgb', dst] + files, check=True)
        print(dst, os.path.getsize(dst) // 1024, 'KB')
    idx_path = os.path.join(OUT, 'index.json'); idx = json.load(open(idx_path))
    idx['groups']['leaf'] = ['plane', 'broad', 'pine', 'palm', 'grass']
    json.dump(idx, open(idx_path, 'w'), indent=1)
    shutil.rmtree(tmp)

main()
