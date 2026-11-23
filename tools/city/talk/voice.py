"""Voices every line of site/city/talk/lines.json with Kokoro (kokoro-onnx, Apache-2.0) into MP3 bundles of 25 lines
per language: site/city/talk/audio/<lang>-<n>.mp3, plus index.json with [bundle, start, duration] per line.
Usage: python3 voice.py <model.onnx> <voices.bin> [lang ...]. Re-running only redoes bundles whose text changed."""
import json, os, sys, hashlib, subprocess, tempfile
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
here = os.path.dirname(os.path.abspath(__file__)); site = os.path.join(here, '../../../site/city/talk')
model, voices = sys.argv[1], sys.argv[2]; langs = sys.argv[3:] or ['en', 'es']
k = Kokoro(model, voices)
VO = {'en': {'f': ['af_heart', 'af_bella', 'bf_emma', 'af_nicole'], 'm': ['am_michael', 'am_adam', 'bm_george', 'bm_lewis']},
      'es': {'f': ['ef_dora'], 'm': ['em_alex', 'em_santa']}}
LANG = {'en': 'en-us', 'es': 'es'}
data = json.load(open(os.path.join(site, 'lines.json'), encoding='utf-8'))
order_path = os.path.join(here, 'order.json')
order = json.load(open(order_path)) if os.path.exists(order_path) else []
ids = [i for i in order if i in data['lines']] + sorted(i for i in data['lines'] if i not in set(order))
json.dump(ids, open(order_path, 'w'))
os.makedirs(os.path.join(site, 'audio'), exist_ok=True)
ipath = os.path.join(site, 'audio', 'index.json')
index = json.load(open(ipath)) if os.path.exists(ipath) else {}
meta_path = os.path.join(here, '.voice-meta.json'); meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
SR = 24000; GAP = np.zeros(int(SR * 0.12), dtype=np.float32); N = 25
for lang in langs:
    index.setdefault(lang, {})
    for b in range(0, len(ids), N):
        chunk = ids[b:b + N]; bn = b // N
        sig = hashlib.sha1(json.dumps([[i, data['lines'][i]['v'], data['lines'][i][lang]] for i in chunk], ensure_ascii=False).encode()).hexdigest()
        key = '%s-%d' % (lang, bn); out = os.path.join(site, 'audio', key + '.mp3')
        if meta.get(key) == sig and os.path.exists(out): continue
        parts, pos = [], 0.0
        for i in chunk:
            L = data['lines'][i]; vs = VO[lang][L['v']]; v = vs[int(hashlib.md5(i.encode()).hexdigest(), 16) % len(vs)]
            speed = 1.05 if lang == 'en' else 1.0
            samples, sr = k.create(L[lang], voice=v, speed=speed, lang=LANG[lang])
            samples = samples.astype(np.float32)
            # trim silence at the ends
            nz = np.where(np.abs(samples) > 0.01)[0]
            if len(nz): samples = samples[max(0, nz[0] - 600): nz[-1] + 1200]
            peak = np.max(np.abs(samples)) or 1; samples = samples / peak * 0.85
            index[lang][i] = [bn, round(pos, 3), round(len(samples) / SR, 3)]
            parts += [samples, GAP]; pos += (len(samples) + len(GAP)) / SR
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as t: sf.write(t.name, np.concatenate(parts), SR)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', t.name, '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '40k', out], check=True)
        os.unlink(t.name); meta[key] = sig
        json.dump(index, open(ipath, 'w'), separators=(',', ':')); json.dump(meta, open(meta_path, 'w'))
        print(key, 'done', flush=True)
print('all done', flush=True)
