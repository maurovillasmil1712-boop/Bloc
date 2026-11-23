"""Builds site/city/talk/lines.json from lines_a.py (single lines) and lines_b.py (pairs and conversations)."""
import json, os, sys
here = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, here)
from lines_a import SINGLE
from lines_b import PAIRS, CONVOS
try:
    from lines_c import SINGLE2, PAIRS2, CONVOS2
    for k, v in SINGLE2.items(): k = k[:-1] if k.endswith('2') else k; SINGLE[k] = SINGLE.get(k, []) + v
    PAIRS = PAIRS + PAIRS2; CONVOS = CONVOS + CONVOS2
except ImportError: pass
# later batches (lines_d.py, lines_e.py, ...): SINGLE adds to categories, PAIRS and CONVOS append
import glob, importlib
for path in sorted(glob.glob(os.path.join(here, 'lines_[d-z].py'))):
    m = importlib.import_module(os.path.basename(path)[:-3])
    for k, v in getattr(m, 'SINGLE', {}).items(): SINGLE[k] = SINGLE.get(k, []) + v
    PAIRS = PAIRS + getattr(m, 'PAIRS', []); CONVOS = CONVOS + getattr(m, 'CONVOS', [])
lines, cats, pairs, convos = {}, {}, [], []
def add(prefix, n, v, en, es):
    k = '%s%03d' % (prefix, n); lines[k] = {'v': v, 'en': en, 'es': es}; return k
used = {}
for cat, items in SINGLE.items():
    pre = cat[:2] + cat[-1]
    if pre in used and used[pre] != cat: pre = cat[:3] + cat[-1] if (cat[:3] + cat[-1]) not in used else cat[:4] + cat[-1]
    used[pre] = cat
    cats[cat] = [add(pre, i, v, en, es) for i, (v, en, es) in enumerate(items)]
for i, d in enumerate(PAIRS):
    pairs.append([add('pr%02d_' % i, k, v, en, es) for k, (v, en, es) in enumerate(d)])
for i, (v, (oen, oes), choices) in enumerate(CONVOS):
    c = {'v': v, 'open': add('cv%02d_' % i, 0, v, oen, oes), 'choices': []}
    for k, ((cen, ces), (ren, res)) in enumerate(choices):
        c['choices'].append({'en': cen, 'es': ces, 'reply': add('cv%02d_' % i, k + 1, v, ren, res)})
    convos.append(c)
out = os.path.join(here, '../../../site/city/talk/lines.json')
json.dump({'cats': cats, 'lines': lines, 'pairs': pairs, 'convos': convos}, open(out, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('voiced lines per language:', len(lines), '| single', sum(len(x) for x in cats.values()), '| pairs', len(pairs), '| convos', len(convos), '| choices', sum(len(c['choices']) for c in convos))
