#!/usr/bin/env python3
"""Pack Bloc City's CC0 surface textures into KTX2 array textures, one set per quality tier.

Usage: python3 textures.py SRC OUT [--tiers 512,1024,2048] [--groups ground,wall,roof,bark]

SRC is the folder fetch.py filled. OUT is site/city/tex. For every group and tier this writes
  <group>-c-<tier>.ktx2   colour (sRGB, ETC1S)
  <group>-n-<tier>.ktx2   normal (linear, UASTC + zstd), half the colour size
  <group>-m-<tier>.ktx2   AO, roughness, metalness (linear, ETC1S), half the colour size
and index.json with the layer order the engine reads. Needs toktx on PATH (KTX-Software 4.4)."""
import json, os, shutil, subprocess, sys, tempfile, concurrent.futures as cf
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
M = json.load(open(os.path.join(HERE, 'manifest.json')))
TOKTX = shutil.which('toktx') or '/home/claude/work/bin/toktx'


def arg(name, default):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


def layer_png(src_file, size, dst, mode):
    im = Image.open(src_file)
    im = im.convert('RGB')
    if im.size != (size, size):
        im = im.resize((size, size), Image.LANCZOS)
    im.save(dst, compress_level=1)
    return dst


def pack_arm(folder, dst):
    """AO in red, roughness in green, metalness in blue, from separate maps (white AO, 0 metal by default)."""
    rough = Image.open(os.path.join(folder, 'rough.jpg')).convert('L')
    ao = Image.open(os.path.join(folder, 'ao.jpg')).convert('L') if os.path.exists(os.path.join(folder, 'ao.jpg')) else Image.new('L', rough.size, 255)
    metal = Image.open(os.path.join(folder, 'metal.jpg')).convert('L') if os.path.exists(os.path.join(folder, 'metal.jpg')) else Image.new('L', rough.size, 0)
    Image.merge('RGB', (ao.resize(rough.size), rough, metal.resize(rough.size))).save(dst, compress_level=1)
    return dst


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(' '.join(cmd[:6]) + ' ... ' + r.stderr[-400:])


def build(group, ids, tier, src, out, tmp):
    jobs = []
    n_size = max(128, tier // 2)
    sets = {
        'c': ('diff', tier, ['--encode', 'etc1s', '--clevel', '2', '--qlevel', '190', '--assign_oetf', 'srgb']),
        'n': ('nor', n_size, ['--encode', 'uastc', '--uastc_quality', '1', '--uastc_rdo_l', '1.2', '--zcmp', '18', '--assign_oetf', 'linear']),
        'm': ('arm', n_size, ['--encode', 'etc1s', '--clevel', '2', '--qlevel', '150', '--assign_oetf', 'linear']),
    }
    for key, (mapname, size, enc) in sets.items():
        files = []
        for i, aid in enumerate(ids):
            f = os.path.join(src, 'polyhaven', 'tex', aid, mapname + '.jpg')
            if not os.path.exists(f) and mapname == 'arm':
                f = pack_arm(os.path.join(src, 'polyhaven', 'tex', aid), os.path.join(tmp, f'{aid}-arm.png'))
            if not os.path.exists(f):
                raise RuntimeError('missing ' + f)
            files.append(layer_png(f, size, os.path.join(tmp, f'{group}-{key}-{tier}-{i:02d}.png'), key))
        dst = os.path.join(out, f'{group}-{key}-{tier}.ktx2')
        cmd = [TOKTX, '--t2', '--genmipmap', '--threads', '2', '--layers', str(len(files))] + enc + [dst] + files
        jobs.append((dst, cmd))
    for dst, cmd in jobs:
        run(cmd)
    return [(os.path.basename(d), os.path.getsize(d)) for d, _ in jobs]


def main():
    src, out = sys.argv[1], sys.argv[2]
    tiers = [int(t) for t in arg('--tiers', '512,1024,2048').split(',')]
    groups = arg('--groups', ','.join(M['polyhaven_textures'].keys())).split(',')
    os.makedirs(out, exist_ok=True)
    index_path = os.path.join(out, 'index.json')
    index = json.load(open(index_path)) if os.path.exists(index_path) else {'tiers': tiers, 'groups': {}}
    tmp = tempfile.mkdtemp(prefix='bloc-tex-')
    try:
        for g in groups:
            ids = M['polyhaven_textures'][g]
            index['groups'][g] = ids
            for t in tiers:
                for name, size in build(g, ids, t, src, out, tmp):
                    print(f'{name:28s} {size / 1048576:6.2f} MB', flush=True)
        index['tiers'] = sorted(set(index.get('tiers', []) + tiers))
        json.dump(index, open(index_path, 'w'), indent=1)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
