#!/usr/bin/env python3
"""Download Bloc City's CC0 source assets (Poly Haven, ambientCG) with curl.
Usage: python3 fetch.py OUTDIR [--only textures|models|ambientcg]
Files land in OUTDIR/<source>/<kind>/<id>/. Nothing here goes into git."""
import json, os, subprocess, sys, concurrent.futures as cf, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
M = json.load(open(os.path.join(HERE, 'manifest.json')))

def curl(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return dest
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    tmp = dest + '.part'
    r = subprocess.run(['curl', '-sS', '-L', '--fail', '--retry', '3', '--max-time', '600', '-o', tmp, url], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f'{url}: {r.stderr.strip()[:200]}')
    os.replace(tmp, dest)
    return dest

def api(path):
    r = subprocess.run(['curl', '-sS', '--fail', '--max-time', '60', 'https://api.polyhaven.com' + path], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(path + ': ' + r.stderr[:200])
    return json.loads(r.stdout)

def ph_texture(out, aid, res='2k'):
    files = api('/files/' + aid)
    jobs = []
    keys = [('Diffuse', 'diff'), ('nor_gl', 'nor'), ('arm', 'arm'), ('Displacement', 'disp')]
    if 'arm' not in files:  # some textures ship separate maps: textures.py packs them
        keys += [('Rough', 'rough'), ('AO', 'ao'), ('Metal', 'metal')]
    for key, name in keys:
        node = files.get(key, {}).get(res, {}).get('jpg')
        if node:
            jobs.append((node['url'], os.path.join(out, 'polyhaven', 'tex', aid, f'{name}.jpg')))
    for u, d in jobs:
        curl(u, d)
    return aid, len(jobs)

def ph_model(out, aid, res='1k'):
    files = api('/files/' + aid)
    g = files['gltf'][res]['gltf']
    base = os.path.join(out, 'polyhaven', 'models', aid)
    curl(g['url'], os.path.join(base, os.path.basename(urllib.parse.urlparse(g['url']).path)))
    for rel, node in g.get('include', {}).items():
        curl(node['url'], os.path.join(base, rel))
    return aid, 1 + len(g.get('include', {}))

def acg(out, aid):
    url = f'https://ambientcg.com/get?file={aid}_2K-JPG.zip'
    dest = os.path.join(out, 'ambientcg', aid, f'{aid}_2K-JPG.zip')
    curl(url, dest)
    d = os.path.dirname(dest)
    subprocess.run(['unzip', '-o', '-q', dest, '-d', d], check=True)
    return aid, 1

def main():
    out = sys.argv[1]
    only = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else None
    tasks = []
    if only in (None, 'textures'):
        for group, ids in M['polyhaven_textures'].items():
            tasks += [(ph_texture, (out, a)) for a in ids]
    if only in (None, 'models'):
        tasks += [(ph_model, (out, a)) for a in M['polyhaven_models']]
    if only in (None, 'ambientcg'):
        tasks += [(acg, (out, a)) for a in M['ambientcg']]
    ok = bad = 0
    with cf.ThreadPoolExecutor(max_workers=6) as ex:
        futs = {ex.submit(f, *a): a[1] for f, a in tasks}
        for fu in cf.as_completed(futs):
            try:
                aid, n = fu.result(); ok += 1
            except Exception as e:
                bad += 1; print('FAILED', futs[fu], e, flush=True)
    print(f'done: {ok} ok, {bad} failed', flush=True)

if __name__ == '__main__':
    main()
