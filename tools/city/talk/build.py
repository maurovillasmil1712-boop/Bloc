"""Builds site/city/talk/lines.json from lines_a.py (single lines) and lines_b.py (pairs and conversations)."""
import json, os, sys
here = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, here)
from lines_a import SINGLE
from lines_b import PAIRS, CONVOS
lines, cats, pairs, convos = {}, {}, [], []
def add(prefix, n, v, en, es):
    k = '%s%03d' % (prefix, n); lines[k] = {'v': v, 'en': en, 'es': es}; return k
for cat, items in SINGLE.items():
    cats[cat] = [add(cat[:2] + cat[-1], i, v, en, es) for i, (v, en, es) in enumerate(items)]
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
