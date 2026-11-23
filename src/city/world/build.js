/* Turns the plan into geometry, one 400 m chunk at a time: terrain, roads, sidewalks, junctions, buildings. */
import { Kit, wall, hexRGB } from './meshkit.js';
import { districtAt, isSea, onIsland, ISLAND, sampleHeight, BRIDGE, ROUNDABOUTS, PLAZAS, RUNWAY, APRON, inLake, coastX, STYLES } from './plan.js';
import { fbm2, ihash, smoothstep, clamp } from '../core/rng.js';
import { dist, along } from '../core/geom.js';
import { layerOf } from '../render/textures.js';

export const CHUNK = 400;
export const chunkKey = (i, j) => i + ',' + j;
export function chunkOf(x, z) { return [Math.floor(x / CHUNK), Math.floor(z / CHUNK)]; }

/* ---------- which things live in which chunk ---------- */
export function indexPlan(plan) {
  const C = new Map();
  const get = (x, z) => { const [i, j] = chunkOf(x, z), k = chunkKey(i, j); let c = C.get(k); if (!c) C.set(k, (c = { i, j, key: k, edges: [], nodes: [], lots: [], trees: [], props: [] })); return c; };
  for (const e of plan.edges) { const m = along(e.dense, e.len / 2); get(m.x, m.z).edges.push(e); }
  for (const n of plan.nodes) get(n.x, n.z).nodes.push(n);
  for (const l of plan.lots) get(l.x, l.z).lots.push(l);
  for (const t of plan.trees) get(t.x, t.z).trees.push(t);
  for (const p of plan.props) get(p.x, p.z).props.push(p);
  /* terrain needs chunks with nothing in them too, wherever there is land or shallow sea */
  for (let x = -3400; x < 2600; x += CHUNK) for (let z = -2400; z < 2400; z += CHUNK) {
    let land = false;
    for (let a = 0; a <= 4 && !land; a++) for (let b = 0; b <= 4 && !land; b++) { const px = x + a * 100, pz = z + b * 100; if (sampleHeight(plan.height, px, pz) > -9 || onIsland(px, pz, 120)) land = true; }
    if (land) get(x + 1, z + 1);
  }
  return C;
}

/* ---------- terrain ---------- */
const LU = {};
function lu() { if (!LU.grass) Object.assign(LU, { grass: layerOf('ground', 'leafy_grass'), forest: layerOf('ground', 'forest_ground_04'), sand: layerOf('ground', 'coast_sand_01'), paved: layerOf('ground', 'concrete_pavement'), dirt: layerOf('ground', 'park_dirt') }); return LU; }
export function terrainLayers() { return lu(); }
function landuse(plan, x, z) {
  if (isSea(x, z)) return [0, 0, 1, 0];
  if (onIsland(x, z)) { const d = Math.hypot(x - ISLAND.x, z - ISLAND.z); return d > ISLAND.ring + 30 ? [0, 0, 1, 0] : [1, 0, 0, 0]; }
  const d = districtAt(x, z), n = fbm2(x / 70, z / 70, 3, 21);
  if (x < coastX(z) + 330 && d === 'beach') return [0, 0, 1, 0];
  switch (d) {
    case 'park': return n > 0.32 ? [0, 0, 0, 0] : [1, 0, 0, 0];
    case 'hills': { const f = smoothstep(-0.25, 0.25, fbm2(x / 160, z / 160, 3, 9)); return [1 - f, f, 0, 0]; }
    case 'campus': return [0.9, 0, 0, 0.1];
    case 'airport': {
      if (x > APRON.x0 - 30 && x < APRON.x1 + 30 && z > APRON.z0 - 120 && z < APRON.z1) return [0, 0, 0, 1];
      if (Math.abs(z - RUNWAY.z) < RUNWAY.w) return [0, 0, 0, 1];
      return n > 0.4 ? [0, 0, 0, 0] : [0.85, 0, 0, 0];
    }
    case 'port': case 'poligono': return n > 0.35 ? [0, 0, 0, 0] : [0, 0, 0, 1];
    default: {
      const o = plan.occ.get(x, z);
      if (o === 0 && n > 0.15) return [0.75, 0, 0, 0.25];
      return [0, 0, 0, 1];
    }
  }
}
export function buildTerrain(plan, c, res) {
  const kit = new Kit([['lw', 4]]);
  const x0 = c.i * CHUNK, z0 = c.j * CHUNK, n = Math.round(CHUNK / res), F = plan.height;
  const H = (x, z) => sampleHeight(F, x, z);
  const row = n + 1, base = kit.count;
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    const x = x0 + i * res, z = z0 + j * res, y = H(x, z);
    const hx = H(x + 2, z) - H(x - 2, z), hz = H(x, z + 2) - H(x, z - 2);
    const l = Math.hypot(hx, 4, hz);
    kit.v(x, y, z, -hx / l, 4 / l, -hz / l, x, z, { lw: landuse(plan, x, z) });
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = base + j * row + i; kit.quad(a, a + row, a + row + 1, a + 1); }
  /* skirts hide gaps between chunks of different resolution */
  const skirt = (ia, ib) => { const pa = ia, pb = ib; const pos = kit.pos; const ya = pos[pa * 3 + 1], yb = pos[pb * 3 + 1]; const a2 = kit.v(pos[pa * 3], ya - 6, pos[pa * 3 + 2], 0, 1, 0, 0, 0, { lw: [0, 0, 0, 1] }); const b2 = kit.v(pos[pb * 3], yb - 6, pos[pb * 3 + 2], 0, 1, 0, 0, 0, { lw: [0, 0, 0, 1] }); kit.quad(pa, pb, b2, a2); kit.quad(pa, a2, b2, pb); };
  for (let i = 0; i < n; i++) { skirt(base + i, base + i + 1); skirt(base + n * row + i, base + n * row + i + 1); skirt(base + i * row, base + (i + 1) * row); skirt(base + i * row + n, base + (i + 1) * row + n); }
  return kit.build();
}

/* ---------- roads ---------- */
const RL = {};
function rl() {
  if (!RL.asphalt) Object.assign(RL, {
    asphalt: layerOf('ground', 'asphalt_02'), worn: layerOf('ground', 'worn_asphalt'), clean: layerOf('ground', 'clean_asphalt'), cobble: layerOf('ground', 'cobblestone_floor_04'),
    square: layerOf('ground', 'cobblestone_square'), pave: layerOf('ground', 'concrete_pavement'), herring: layerOf('ground', 'herringbone_pavement'), hex: layerOf('ground', 'hexagonal_concrete_paving'),
    grass: layerOf('ground', 'leafy_grass'), concrete: layerOf('ground', 'concrete_floor_worn_001')
  });
  return RL;
}
function surfaceFor(e) {
  const L = rl();
  if (e.kind === 'lane') return L.cobble;
  if (e.kind === 'ronda' || e.kind === 'bridge') return L.clean;
  if (e.kind === 'service') return L.worn;
  if (e.kind === 'street') return ihash(e.id, 3) < 0.5 ? L.worn : L.asphalt;
  return L.asphalt;
}
function pavingFor(e) {
  const L = rl(), d = districtAt(e.pts[0][0], e.pts[0][1]);
  if (e.kind === 'promenade') return L.herring;
  if (d === 'oldtown' || e.plaza) return L.square;
  if (e.kind === 'boulevard' || e.kind === 'granvia') return L.hex;
  return L.pave;
}
/* how far each road stops short of a junction so the junction patch fits */
export function prepareJunctions(plan) {
  for (const n of plan.nodes) {
    const es = n.edges.map((id) => plan.edges[id]);
    n.r = 0;
    if (es.length >= 3 || (es.length === 2 && es[0].kind !== es[1].kind)) {
      let r = 0; for (const e of es) r = Math.max(r, e.w / 2 + e.sw);
      n.r = Math.min(r * 1.15 + 1.5, 40);
    } else if (es.length === 2) {
      const a = dirAt(es[0], n.id), b = dirAt(es[1], n.id), dot = a[0] * b[0] + a[1] * b[1];
      if (dot > -0.94) n.r = Math.max(es[0].w, es[1].w) / 2 + Math.max(es[0].sw, es[1].sw);
    }
  }
  for (const e of plan.edges) {
    const ra = plan.nodes[e.a].r, rb = plan.nodes[e.b].r;
    const lim = e.len * 0.42;
    e.ta = Math.min(ra, lim); e.tb = Math.min(rb, lim);
  }
}
function dirAt(e, nodeId) {
  const p = e.a === nodeId ? [e.dense[0], e.dense[1]] : [e.dense[e.dense.length - 1], e.dense[e.dense.length - 2]];
  const dx = p[1][0] - p[0][0], dz = p[1][1] - p[0][1], l = Math.hypot(dx, dz) || 1;
  return [dx / l, dz / l];
}
/* height and frame of a road at distance s */
function frameAt(e, s) {
  const a = along(e.dense, s), i = Math.max(1, a.i);
  const s0 = e.sd ? e.sd[i - 1] : 0, s1 = e.sd ? e.sd[i] : 1;
  const t = s1 > s0 ? clamp((s - s0) / (s1 - s0), 0, 1) : 0;
  const y = e.ys[i - 1] + (e.ys[i] - e.ys[i - 1]) * t;
  return { x: a.x, z: a.z, y, dx: a.dx, dz: a.dz, nx: -a.dz, nz: a.dx };
}
export function roadSamples(e) {
  const s0 = e.ta || 0, s1 = e.len - (e.tb || 0), out = [];
  if (s1 - s0 < 0.5) return out;
  const step = e.kind === 'ronda' || e.kind === 'boulevard' ? 8 : 5;
  const k = Math.max(1, Math.ceil((s1 - s0) / step));
  for (let i = 0; i <= k; i++) { const s = s0 + (s1 - s0) * i / k; const f = frameAt(e, s); f.s = s - s0; out.push(f); }
  return out;
}
export function buildRoads(plan, edges, nodes) {
  const road = new Kit([['ra', 4], ['rb', 4]]), pave = new Kit([['pl', 2]]), bridge = new Kit([['wl', 4]]);
  for (const e of edges) {
    const S = roadSamples(e);
    if (S.length < 2) continue;
    const len = S[S.length - 1].s, layer = surfaceFor(e), pl = pavingFor(e);
    const zA = plan.nodes[e.a].edges.length >= 3 && e.kind !== 'ronda' && e.kind !== 'lane' ? 1 : 0;
    const zB = plan.nodes[e.b].edges.length >= 3 && e.kind !== 'ronda' && e.kind !== 'lane' ? 1 : 0;
    const lift = 0.03, kerb = e.sw > 0 ? 0.15 : 0.06;
    const ribbon = (o0, o1, lanes, flags, ww) => {
      const base = road.count;
      for (const f of S) {
        for (const o of [o0, o1]) road.v(f.x + f.nx * o, f.y + lift, f.z + f.nz * o, 0, 1, 0, o - (o0 + o1) / 2, f.s, { ra: [layer, lanes, ww, flags], rb: [0, len, zA, zB] });
      }
      for (let i = 0; i < S.length - 1; i++) { const a = base + i * 2; road.quad(a, a + 1, a + 3, a + 2); }
    };
    const hw = e.w / 2;
    if (e.median > 0) {
      const m = e.median / 2, cw = hw - m;
      ribbon(-hw, -m, e.lanes / 2, 1, cw); ribbon(m, hw, e.lanes / 2, 1, cw);
      /* raised median: grass on boulevards, concrete on the ring road */
      strip(pave, S, -m, m, lift + kerb, e.kind === 'ronda' ? rl().concrete : rl().grass, 1);
      kerbFace(pave, S, -m, lift, lift + kerb, -1, rl().pave); kerbFace(pave, S, m, lift, lift + kerb, 1, rl().pave);
    } else ribbon(-hw, hw, e.lanes, e.lanes <= 1 ? 1 : 0, e.w);
    if (e.sw > 0) {
      for (const side of [-1, 1]) {
        strip(pave, S, side * hw, side * (hw + e.sw), lift + kerb, pl, 1);
        kerbFace(pave, S, side * hw, lift, lift + kerb, side, rl().pave);
        skirtFace(pave, S, side * (hw + e.sw), lift + kerb, -1.2, side, pl);
      }
    } else {
      for (const side of [-1, 1]) skirtFace(pave, S, side * hw, lift, -1.2, side, rl().pave);
    }
    if (e.bridge) bridgeDeck(bridge, S, hw + e.sw);
  }
  for (const n of nodes) junction(plan, n, road, pave);
  return { road: road.build(), pave: pave.build(), bridge: bridge.build() };
}
function strip(kit, S, o0, o1, dy, layer, tint) {
  const base = kit.count;
  for (const f of S) for (const o of [o0, o1]) kit.v(f.x + f.nx * o, f.y + dy, f.z + f.nz * o, 0, 1, 0, 0, 0, { pl: [layer, tint] });
  for (let i = 0; i < S.length - 1; i++) { const a = base + i * 2; if (o1 > o0) kit.quad(a, a + 1, a + 3, a + 2); else kit.quad(a, a + 2, a + 3, a + 1); }
}
function kerbFace(kit, S, o, y0, y1, side, layer) {
  const base = kit.count;
  for (const f of S) { const nx = -f.nx * side, nz = -f.nz * side; kit.v(f.x + f.nx * o, f.y + y0, f.z + f.nz * o, nx, 0, nz, 0, 0, { pl: [layer, 0.85] }); kit.v(f.x + f.nx * o, f.y + y1, f.z + f.nz * o, nx, 0, nz, 0, 0, { pl: [layer, 0.85] }); }
  for (let i = 0; i < S.length - 1; i++) { const a = base + i * 2; if (side > 0) kit.quad(a, a + 1, a + 3, a + 2); else kit.quad(a, a + 2, a + 3, a + 1); }
}
function skirtFace(kit, S, o, y0, y1, side, layer) {
  const base = kit.count;
  for (const f of S) { const nx = f.nx * side, nz = f.nz * side; kit.v(f.x + f.nx * o, f.y + y0, f.z + f.nz * o, nx, 0, nz, 0, 0, { pl: [layer, 0.8] }); kit.v(f.x + f.nx * o, f.y + y1, f.z + f.nz * o, nx, 0, nz, 0, 0, { pl: [layer, 0.8] }); }
  for (let i = 0; i < S.length - 1; i++) { const a = base + i * 2; if (side > 0) kit.quad(a, a + 2, a + 3, a + 1); else kit.quad(a, a + 1, a + 3, a + 2); }
}
function bridgeDeck(kit, S, hw) {
  const stone = [layerOf('wall', 'concrete_wall_006'), 0.85, 0.85, 0.85];
  const base = kit.count;
  for (const f of S) {
    for (const o of [-hw, hw]) { kit.v(f.x + f.nx * o, f.y - 1.6, f.z + f.nz * o, 0, -1, 0, 0, 0, { wl: stone }); }
  }
  for (let i = 0; i < S.length - 1; i++) { const a = base + i * 2; kit.quad(a, a + 2, a + 3, a + 1); }
  for (const side of [-1, 1]) {
    const b2 = kit.count;
    for (const f of S) { const o = side * hw, nx = f.nx * side, nz = f.nz * side; kit.v(f.x + f.nx * o, f.y + 1.1, f.z + f.nz * o, nx, 0, nz, 0, 0, { wl: stone }); kit.v(f.x + f.nx * o, f.y - 1.6, f.z + f.nz * o, nx, 0, nz, 0, 0, { wl: stone }); }
    for (let i = 0; i < S.length - 1; i++) { const a = b2 + i * 2; if (side > 0) kit.quad(a, a + 2, a + 3, a + 1); else kit.quad(a, a + 1, a + 3, a + 2); }
  }
}
/* junction patch: asphalt in the middle, sidewalk corners between the roads */
function junction(plan, n, road, pave) {
  if (!n.r) return;
  const arms = [];
  for (const id of n.edges) {
    const e = plan.edges[id], atA = e.a === n.id, s = atA ? e.ta : e.len - e.tb;
    const f = frameAt(e, s), sgn = atA ? 1 : -1;
    const dx = f.dx * sgn, dz = f.dz * sgn, nx = -dz, nz = dx;   /* pointing away from the node */
    const hw = e.w / 2, sw = e.sw;
    arms.push({ ang: Math.atan2(dz, dx), y: f.y, L: [f.x + nx * hw, f.z + nz * hw], R: [f.x - nx * hw, f.z - nz * hw], LO: [f.x + nx * (hw + sw), f.z + nz * (hw + sw)], RO: [f.x - nx * (hw + sw), f.z - nz * (hw + sw)], sw, e });
  }
  if (arms.length < 2) return;
  arms.sort((a, b) => a.ang - b.ang);
  const y = n.y + 0.03, L = rl();
  const layer = arms.some((a) => a.e.kind !== 'lane') ? L.asphalt : L.cobble;
  const c = road.v(n.x, y, n.z, 0, 1, 0, 0, 0, { ra: [layer, 0, 1, 3], rb: [0, 0, 0, 0] });
  const ring = [];
  for (const a of arms) { ring.push(a.R, a.L); }
  const ids = ring.map((p, i) => road.v(p[0], arms[Math.floor(i / 2)].y + 0.03, p[1], 0, 1, 0, 0, 0, { ra: [layer, 0, 1, 3], rb: [0, 0, 0, 0] }));
  for (let i = 0; i < ids.length; i++) road.tri(c, ids[(i + 1) % ids.length], ids[i]);
  /* sidewalk corners */
  for (let i = 0; i < arms.length; i++) {
    const a = arms[i], b = arms[(i + 1) % arms.length];
    if (!a.sw && !b.sw) continue;
    const kerbH = 0.15, ya = a.y + 0.03, yb = b.y + 0.03, pl = pavingFor(a.e);
    const p0 = a.L, p1 = a.LO, p2 = b.RO, p3 = b.R;
    const i0 = pave.v(p0[0], ya + kerbH, p0[1], 0, 1, 0, 0, 0, { pl: [pl, 1] });
    const i1 = pave.v(p1[0], ya + kerbH, p1[1], 0, 1, 0, 0, 0, { pl: [pl, 1] });
    const i2 = pave.v(p2[0], yb + kerbH, p2[1], 0, 1, 0, 0, 0, { pl: [pl, 1] });
    const i3 = pave.v(p3[0], yb + kerbH, p3[1], 0, 1, 0, 0, 0, { pl: [pl, 1] });
    const cx = (p0[0] + p3[0]) / 2, cz = (p0[1] + p3[1]) / 2;
    const outer = pave.v(cx + (cx - n.x) * 0.0 + ((p1[0] + p2[0]) / 2 - cx) * 1.0, (ya + yb) / 2 + kerbH, cz + ((p1[1] + p2[1]) / 2 - cz) * 1.0, 0, 1, 0, 0, 0, { pl: [pl, 1] });
    pave.tri(i0, i1, outer); pave.tri(i0, outer, i3); pave.tri(outer, i2, i3);
    /* kerb face from a.L to b.R */
    const k0 = pave.v(p0[0], ya, p0[1], 0, 0, 0, 0, 0, { pl: [L.pave, 0.85] }), k1 = pave.v(p3[0], yb, p3[1], 0, 0, 0, 0, 0, { pl: [L.pave, 0.85] });
    const k2 = pave.v(p3[0], yb + kerbH, p3[1], 0, 0, 0, 0, 0, { pl: [L.pave, 0.85] }), k3 = pave.v(p0[0], ya + kerbH, p0[1], 0, 0, 0, 0, 0, { pl: [L.pave, 0.85] });
    const fx = n.x - cx, fz = n.z - cz, fl = Math.hypot(fx, fz) || 1;
    for (const k of [k0, k1, k2, k3]) { pave.nor[k * 3] = fx / fl; pave.nor[k * 3 + 2] = fz / fl; }
    pave.quad(k0, k1, k2, k3); pave.quad(k0, k3, k2, k1);
  }
}

/* ---------- buildings ---------- */
const BAY = { oldtown: 3.4, plaza: 3.5, ensanche: 3.6, granvia: 4.2, paseo: 4.0, tower: 1.5, office: 3.6, beachtower: 3.8, beach: 3.6, bloque: 3.4, campus: 4.4, warehouse: 9, factory: 7, villa: 3.9, islandvilla: 4.8 };
const WW = { oldtown: 0.42, plaza: 0.45, ensanche: 0.46, granvia: 0.5, paseo: 0.56, office: 0.62, beachtower: 0.72, beach: 0.45, bloque: 0.5, campus: 0.56, warehouse: 0.7, factory: 0.6, villa: 0.42, islandvilla: 0.78 };
function lotCorners(l, shrink = 0) {
  const c = Math.cos(l.rot), s = Math.sin(l.rot), hw = l.w / 2 - shrink, hd = l.d / 2 - shrink;
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([a, b]) => [l.x + a * c - b * s, l.z + a * s + b * c]);
}
export function lotPoly(l) { return lotCorners(l); }
/* walls of a box, each with its facade parameters; attached side walls stay blank */
function boxWalls(kit, l, poly, y0, y1, P, opts = {}) {
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length, cz = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  for (let i = 0; i < poly.length; i++) {
    let a = poly[i], b = poly[(i + 1) % poly.length];
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, dx = b[0] - a[0], dz = b[1] - a[1];
    if ((-dz) * (mx - cx) + dx * (mz - cz) < 0) { const t = a; a = b; b = t; }
    const L = Math.hypot(dx, dz);
    const nx = -(b[1] - a[1]) / L, nz = (b[0] - a[0]) / L;
    const front = nx * -l.fx + nz * -l.fz > 0.7, back = nx * l.fx + nz * l.fz > 0.7, side = !front && !back;
    const attached = side && !(STYLES[l.style] && STYLES[l.style].gap) && !l.corner;
    const bay0 = P.bay, bays = Math.max(1, Math.round(L / bay0)), bay = L / bays;
    let flags = 0;
    if (l.shutters) flags |= 1;
    if (front && l.shop && !opts.upperOnly) flags |= 2;
    if (l.balc && (front || back)) flags |= 4;
    if (P.glass) flags |= 8;
    if (l.bands && (front || back)) flags |= 16;
    if (l.arcade && front) flags |= 32;
    if (l.industrial) flags |= 64;
    const ww = attached ? 0 : P.ww;
    wall(kit, a[0], a[1], b[0], b[1], y0, y1, { fa: [P.layer, bay, l.fh, opts.gf != null ? opts.gf : l.gf], fb: [P.tint[0], P.tint[1], P.tint[2], (l.seed % 997) / 997 + i * 0.13], fc: [ww, P.wh, flags, y1 - l.y] }, 0, y0 - l.y);
  }
}
function cap(kit, poly, y, layer, tint, uvScale = 1) {
  const n = poly.length, base = kit.count;
  for (const p of poly) kit.v(p[0], y, p[1], 0, 1, 0, p[0] * uvScale, p[1] * uvScale, { ro: [layer, tint[0], tint[1], tint[2]] });
  for (let i = 1; i < n - 1; i++) kit.tri(base, base + i + 1, base + i);
}
function hipRoof(kit, l, poly, y, h, layer, tint) {
  /* ridge along the longer side, eaves sticking out 0.45 m */
  const o = 0.45, c = Math.cos(l.rot), s = Math.sin(l.rot);
  const long = l.w >= l.d, hw = l.w / 2 + o, hd = l.d / 2 + o, r = long ? Math.max(0, hw - hd) : Math.max(0, hd - hw);
  const P = (a, b, yy) => [l.x + a * c - b * s, yy, l.z + a * s + b * c];
  const e0 = P(-hw, -hd, y), e1 = P(hw, -hd, y), e2 = P(hw, hd, y), e3 = P(-hw, hd, y);
  const r0 = long ? P(-r, 0, y + h) : P(0, -r, y + h), r1 = long ? P(r, 0, y + h) : P(0, r, y + h);
  const faces = long ? [[e0, e1, r1, r0], [e2, e3, r0, r1], [e1, e2, r1], [e3, e0, r0]] : [[e1, e2, r1, r0], [e3, e0, r0, r1], [e0, e1, r0], [e2, e3, r1]];
  for (const f of faces) {
    const ax = f[1][0] - f[0][0], ay = f[1][1] - f[0][1], az = f[1][2] - f[0][2], bx = f[2][0] - f[0][0], by = f[2][1] - f[0][1], bz = f[2][2] - f[0][2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    const flip = ny < 0; if (flip) { nx = -nx; ny = -ny; nz = -nz; }
    const ex = f[1][0] - f[0][0], ez = f[1][2] - f[0][2], el = Math.hypot(ex, ez) || 1;
    const uvOf = (p) => [((p[0] - f[0][0]) * ex + (p[2] - f[0][2]) * ez) / el, Math.hypot(p[0] - f[0][0] - ((p[0] - f[0][0]) * ex + (p[2] - f[0][2]) * ez) / el * ex / el, p[2] - f[0][2] - ((p[0] - f[0][0]) * ex + (p[2] - f[0][2]) * ez) / el * ez / el) * 1.1];
    const ids = f.map((p) => { const t = uvOf(p); return kit.v(p[0], p[1], p[2], nx, ny, nz, t[0], t[1], { ro: [layer, tint[0], tint[1], tint[2]] }); });
    if (ids.length === 4) { if (flip) kit.quad(ids[0], ids[3], ids[2], ids[1]); else kit.quad(ids[0], ids[1], ids[2], ids[3]); }
    else if (flip) kit.tri(ids[0], ids[2], ids[1]); else kit.tri(ids[0], ids[1], ids[2]);
  }
  /* soffit under the eaves */
  const sof = [e0, e1, e2, e3].map((p) => [p[0], p[2]]);
  cap(kit, sof.slice().reverse(), y - 0.02, layer, [0.5, 0.45, 0.4]);
}
function ring(kit, poly, y0, y1, out, layer, tint) {
  /* a band around the building (cornice, plinth, parapet), outset by `out` */
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length, cz = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  const P = poly.map(([x, z]) => { const dx = x - cx, dz = z - cz, l = Math.hypot(dx, dz) || 1; return [x + dx / l * out * 1.41, z + dz / l * out * 1.41]; });
  const wl = [layer, tint[0], tint[1], tint[2]];
  for (let i = 0; i < P.length; i++) {
    let a = P[i], b = P[(i + 1) % P.length];
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, dx = b[0] - a[0], dz = b[1] - a[1];
    if ((-dz) * (mx - cx) + dx * (mz - cz) < 0) { const t = a; a = b; b = t; }
    wall(kit, a[0], a[1], b[0], b[1], y0, y1, { wl });
  }
  const top = kit.count;
  for (const p of P) kit.v(p[0], y1, p[1], 0, 1, 0, 0, 0, { wl });
  for (let i = 1; i < P.length - 1; i++) kit.tri(top, top + i + 1, top + i);
}
const RLY = {};
function rly() { if (!RLY.tile) Object.assign(RLY, { tile: layerOf('roof', 'clay_roof_tiles'), tile2: layerOf('roof', 'clay_roof_tiles_02'), grey: layerOf('roof', 'grey_roof_tiles'), slate: layerOf('roof', 'roof_tiles'), gravel: layerOf('roof', 'gravel_concrete'), metal: layerOf('roof', 'corrugated_iron') }); return RLY; }

export function buildBuildings(plan, lots) {
  const fac = new Kit([['fa', 4], ['fb', 4], ['fc', 4]]), glass = new Kit([['fa', 4], ['fb', 4], ['fc', 4]]);
  const roofs = new Kit([['ro', 4]]), blocks = new Kit([['wl', 4]]);
  const R = rly(), stone = layerOf('wall', 'large_sandstone_blocks'), conc = layerOf('wall', 'concrete_wall_006');
  for (const l of lots) {
    const poly = lotCorners(l), tint = hexRGB(l.tint), y0 = l.y - 1.5, top = l.y + l.h;
    const P = { layer: l.wall === 'glass' ? conc : layerOf('wall', l.wall), bay: BAY[l.style] || 3.6, ww: WW[l.style] || 0.5, wh: l.balc ? 0.74 : 0.6, tint, glass: false };
    if (l.glass) {
      /* glass tower: optional podium, tiers with setbacks, a crown */
      const GT = [[0.45, 0.62, 0.72], [0.35, 0.5, 0.45], [0.55, 0.55, 0.52], [0.42, 0.58, 0.62], [0.62, 0.52, 0.38]][l.seed % 5].map((c) => c * c);
      let curTop = l.y + l.gf, poly2 = poly, shrink = 0;
      const tiers = 1 + (l.setback || 0), body = l.h - l.gf;
      boxWalls(fac, l, lotCorners(l, -1.2), y0, l.y + l.gf, { layer: stone, bay: 6, ww: 0.75, wh: 0.7, tint: [0.85, 0.83, 0.8], glass: false }, { gf: l.gf });
      for (let t = 0; t < tiers; t++) {
        const tierH = t === tiers - 1 ? l.y + l.h - curTop : body * (t === 0 ? 0.6 : 0.25);
        poly2 = lotCorners(l, shrink);
        boxWallsGlass(glass, l, poly2, curTop, curTop + tierH, GT);
        if (t < tiers - 1) { cap(roofs, poly2, curTop + tierH, R.gravel, [0.8, 0.8, 0.8]); shrink += Math.min(l.w, l.d) * 0.12; }
        curTop += tierH;
      }
      crown(roofs, blocks, l, poly2, curTop, R, conc);
      continue;
    }
    if (l.style === 'tower' || l.style === 'office') P.wh = 0.62;
    const wallTop = l.roof === 'flat' || l.roof === 'shed' ? top : top;
    boxWalls(fac, l, poly, y0, wallTop, P);
    /* roofs */
    if (l.roof === 'tile') hipRoof(roofs, l, poly, top, Math.min(l.w, l.d) * 0.22, ihash(l.i, 4) < 0.5 ? R.tile : R.tile2, [1, 1, 1]);
    else if (l.roof === 'mansard') {
      hipRoof(roofs, l, lotCorners(l, 0.6), top, Math.min(3.2, Math.min(l.w, l.d) * 0.3), R.grey, [0.75, 0.78, 0.82]);
    } else if (l.roof === 'shed') { cap(roofs, poly, top + 0.05, R.metal, [0.8, 0.82, 0.84]); }
    else {
      cap(roofs, lotCorners(l, 0.35), top - 0.7, R.gravel, [0.9, 0.9, 0.88]);
      /* parapet inner faces so the roof doesn't look hollow */
      const inner = lotCorners(l, 0.35);
      for (let i = 0; i < 4; i++) { const a = inner[(i + 1) % 4], b = inner[i]; wall(blocks, a[0], a[1], b[0], b[1], top - 0.7, top, { wl: [P.layer, tint[0] * 0.9, tint[1] * 0.9, tint[2] * 0.9] }); }
    }
    /* cornices and the stone plinth */
    if (l.cornice) {
      ring(blocks, poly, top - 0.65, top - 0.05, 0.38, l.cornice === 2 ? stone : P.layer, tint.map((c) => Math.min(1, c * 1.1 + 0.05)));
      if (l.cornice === 2 || l.style === 'ensanche') ring(blocks, poly, l.y + l.gf - 0.35, l.y + l.gf + 0.05, 0.22, stone, [0.85, 0.82, 0.78]);
    }
    if (l.plinth > 0.4 || l.style === 'granvia' || l.style === 'ensanche') ring(blocks, poly, y0, l.y + Math.max(0.6, l.plinth), 0.08, stone, [0.7, 0.68, 0.64]);
    if (l.dome) dome(roofs, blocks, l, top, R, stone);
    if (l.style === 'tower' || l.style === 'office' || l.style === 'beachtower' || l.style === 'bloque') rooftop(blocks, l, top, conc);
  }
  return { facade: fac.build(), glass: glass.build(), roofs: roofs.build(), blocks: blocks.build() };
}
function boxWallsGlass(kit, l, poly, y0, y1, tint) {
  const cx = l.x, cz = l.z;
  for (let i = 0; i < poly.length; i++) {
    let a = poly[i], b = poly[(i + 1) % poly.length];
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, dx = b[0] - a[0], dz = b[1] - a[1];
    if ((-dz) * (mx - cx) + dx * (mz - cz) < 0) { const t = a; a = b; b = t; }
    wall(kit, a[0], a[1], b[0], b[1], y0, y1, { fa: [0, 1.55, l.fh, l.gf], fb: [tint[0], tint[1], tint[2], (l.seed % 991) / 991 + i * 0.17], fc: [0, 0, 8, l.h] }, 0, y0 - l.y);
  }
}
function crown(roofs, blocks, l, poly, top, R, conc) {
  const k = l.crown, cl = [conc, 0.75, 0.76, 0.78];
  cap(roofs, poly, top, R.gravel, [0.7, 0.7, 0.7]);
  ring(blocks, poly, top - 0.2, top + 1.2, 0.05, conc, [0.6, 0.62, 0.64]);
  if (k === 'spire') {
    const h = 18 + (l.seed % 7) * 4;
    ring(blocks, [[l.x - 2, l.z - 2], [l.x + 2, l.z - 2], [l.x + 2, l.z + 2], [l.x - 2, l.z + 2]], top, top + h * 0.35, 0, conc, [0.8, 0.8, 0.82]);
    ring(blocks, [[l.x - 0.5, l.z - 0.5], [l.x + 0.5, l.z - 0.5], [l.x + 0.5, l.z + 0.5], [l.x - 0.5, l.z + 0.5]], top + h * 0.35, top + h, 0, conc, [0.9, 0.9, 0.92]);
  } else if (k === 'slant' || k === 'stepped') {
    const inner = poly.map(([x, z]) => [l.x + (x - l.x) * 0.62, l.z + (z - l.z) * 0.62]);
    ring(blocks, inner, top, top + (k === 'slant' ? 9 : 6), 0, conc, [0.5, 0.55, 0.6]);
    if (k === 'stepped') ring(blocks, inner.map(([x, z]) => [l.x + (x - l.x) * 0.55, l.z + (z - l.z) * 0.55]), top + 6, top + 11, 0, conc, [0.55, 0.58, 0.62]);
  } else rooftop(blocks, l, top, conc);
  void cl;
}
function rooftop(kit, l, top, conc) {
  /* plant rooms, water tanks and an antenna or two */
  const n = 1 + (l.seed % 3);
  for (let k = 0; k < n; k++) {
    const ox = (ihash(l.i, k, 1) - 0.5) * l.w * 0.5, oz = (ihash(l.i, k, 2) - 0.5) * l.d * 0.5, s = 2 + ihash(l.i, k, 3) * 3;
    const c = Math.cos(l.rot), sn = Math.sin(l.rot), x = l.x + ox * c - oz * sn, z = l.z + ox * sn + oz * c;
    ring(kit, [[x - s, z - s], [x + s, z - s], [x + s, z + s], [x - s, z + s]], top - 0.7, top + 1.5 + ihash(l.i, k, 4) * 1.5, 0, conc, [0.78, 0.78, 0.76]);
  }
  if (l.h > 60) ring(kit, [[l.x - 0.15, l.z - 0.15], [l.x + 0.15, l.z - 0.15], [l.x + 0.15, l.z + 0.15], [l.x - 0.15, l.z + 0.15]], top, top + 9, 0, conc, [0.5, 0.5, 0.5]);
}
function dome(roofs, blocks, l, top, R, stone) {
  /* a drum, a dome of dark zinc, a lantern and a gilded figure, like the old Gran Vía corners */
  const r = Math.min(l.w, l.d) * 0.28, seg = 20, drumH = 5;
  const P = []; for (let k = 0; k < seg; k++) { const a = k / seg * Math.PI * 2; P.push([l.x + Math.cos(a) * r, l.z + Math.sin(a) * r]); }
  ring(blocks, P, top - 0.5, top + drumH, 0, stone, [0.92, 0.9, 0.86]);
  const base = roofs.count, rings = 8;
  for (let j = 0; j <= rings; j++) {
    const phi = j / rings * Math.PI / 2, rr = r * 1.05 * Math.cos(phi), yy = top + drumH + r * 1.1 * Math.sin(phi);
    for (let k = 0; k <= seg; k++) { const a = k / seg * Math.PI * 2, nx = Math.cos(a) * Math.cos(phi), ny = Math.sin(phi), nz = Math.sin(a) * Math.cos(phi); roofs.v(l.x + Math.cos(a) * rr, yy, l.z + Math.sin(a) * rr, nx, ny, nz, k / seg * r * 6, j * 1.5, { ro: [R.grey, 0.35, 0.37, 0.4] }); }
  }
  for (let j = 0; j < rings; j++) for (let k = 0; k < seg; k++) { const a = base + j * (seg + 1) + k; roofs.quad(a, a + seg + 1, a + seg + 2, a + 1); }
  const lt = top + drumH + r * 1.1;
  ring(blocks, P.map(([x, z]) => [l.x + (x - l.x) * 0.18, l.z + (z - l.z) * 0.18]), lt - 0.3, lt + 2.4, 0, stone, [0.9, 0.88, 0.84]);
  ring(blocks, [[l.x - 0.4, l.z - 0.4], [l.x + 0.4, l.z - 0.4], [l.x + 0.4, l.z + 0.4], [l.x - 0.4, l.z + 0.4]], lt + 2.4, lt + 5.5, 0, stone, [1.0, 0.78, 0.35]);
}

/* ---------- plazas, roundabout islands, the runway ---------- */
export function buildSpecial(plan) {
  const pave = new Kit([['pl', 2]]), road = new Kit([['ra', 4], ['rb', 4]]);
  const L = rl();
  for (const p of PLAZAS) {
    const c = Math.cos(p.rot), s = Math.sin(p.rot), hw = p.w / 2 + 1, hd = p.d / 2 + 1, y = sampleHeight(plan.height, p.x, p.z) + 0.12;
    const pts = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([a, b]) => [p.x + a * c - b * s, p.z + a * s + b * c]);
    const ids = pts.map((q) => pave.v(q[0], y, q[1], 0, 1, 0, 0, 0, { pl: [p.id === 'paseo' ? L.herring : L.square, 1] }));
    pave.quad(ids[0], ids[3], ids[2], ids[1]);
  }
  for (const g of ROUNDABOUTS) {
    const y = sampleHeight(plan.height, g.x, g.z) + 0.18, r = g.r - 7.5, seg = 28, base = pave.count;
    pave.v(g.x, y, g.z, 0, 1, 0, 0, 0, { pl: [L.grass, 1] });
    for (let k = 0; k < seg; k++) { const a = k / seg * Math.PI * 2; pave.v(g.x + Math.cos(a) * r, y, g.z + Math.sin(a) * r, 0, 1, 0, 0, 0, { pl: [L.grass, 1] }); }
    for (let k = 0; k < seg; k++) pave.tri(base, base + 1 + ((k + 1) % seg), base + 1 + k);
    const kb = pave.count;
    for (let k = 0; k <= seg; k++) { const a = k / seg * Math.PI * 2, x = g.x + Math.cos(a) * r, z = g.z + Math.sin(a) * r; pave.v(x, y - 0.25, z, Math.cos(a), 0, Math.sin(a), 0, 0, { pl: [L.pave, 0.8] }); pave.v(x, y, z, Math.cos(a), 0, Math.sin(a), 0, 0, { pl: [L.pave, 0.8] }); }
    for (let k = 0; k < seg; k++) { const a = kb + k * 2; pave.quad(a, a + 1, a + 3, a + 2); }
  }
  /* runway and apron: concrete with markings drawn by the road shader */
  const ry = sampleHeight(plan.height, (RUNWAY.x0 + RUNWAY.x1) / 2, RUNWAY.z) + 0.06;
  const rw = RUNWAY.w / 2, rlen = RUNWAY.x1 - RUNWAY.x0;
  const r0 = road.v(RUNWAY.x0, ry, RUNWAY.z - rw, 0, 1, 0, -rw, 0, { ra: [L.clean, 2, RUNWAY.w, 4], rb: [0, rlen, 0, 0] });
  road.v(RUNWAY.x0, ry, RUNWAY.z + rw, 0, 1, 0, rw, 0, { ra: [L.clean, 2, RUNWAY.w, 4], rb: [0, rlen, 0, 0] });
  road.v(RUNWAY.x1, ry, RUNWAY.z + rw, 0, 1, 0, rw, rlen, { ra: [L.clean, 2, RUNWAY.w, 4], rb: [0, rlen, 0, 0] });
  road.v(RUNWAY.x1, ry, RUNWAY.z - rw, 0, 1, 0, -rw, rlen, { ra: [L.clean, 2, RUNWAY.w, 4], rb: [0, rlen, 0, 0] });
  road.quad(r0, r0 + 1, r0 + 2, r0 + 3);
  const ay = sampleHeight(plan.height, (APRON.x0 + APRON.x1) / 2, (APRON.z0 + APRON.z1) / 2) + 0.05;
  const a0 = road.v(APRON.x0, ay, APRON.z0, 0, 1, 0, 0, 0, { ra: [L.concrete, 0, 1, 3], rb: [0, 0, 0, 0] });
  road.v(APRON.x0, ay, APRON.z1, 0, 1, 0, 0, 0, { ra: [L.concrete, 0, 1, 3], rb: [0, 0, 0, 0] });
  road.v(APRON.x1, ay, APRON.z1, 0, 1, 0, 0, 0, { ra: [L.concrete, 0, 1, 3], rb: [0, 0, 0, 0] });
  road.v(APRON.x1, ay, APRON.z0, 0, 1, 0, 0, 0, { ra: [L.concrete, 0, 1, 3], rb: [0, 0, 0, 0] });
  road.quad(a0, a0 + 1, a0 + 2, a0 + 3);
  void inLake; void dist; void BRIDGE;
  return { pave: pave.build(), road: road.build() };
}
