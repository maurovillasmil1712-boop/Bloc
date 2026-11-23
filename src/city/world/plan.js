/* Bloc City v7: the map, generated from a fixed seed so every student drives the same streets.
   Pure JavaScript (no three.js): the engine, the tests and tools/plan-export.mjs all run it.
   Compass: north is -z, east is +x. The sea is to the west, so the sun sets over the water. */
import { rng, ihash, fbm2, noise2, clamp, lerp, smoothstep, hash32 } from '../core/rng.js';
import { dist, polyLen, pointInPoly, segClosest, segIntersect, smoothPath, densify, along, Grid } from '../core/geom.js';

export const SEED = 'bloc-city-7';
export const MAP = { x0: -3400, x1: 2600, z0: -2500, z1: 2400 };
export const ISLAND = { x: -2900, z: -150, r: 330, ring: 225 };
export const BRIDGE = { z: -150, x0: -1700, x1: -2600, w: 18, top: 24, pylons: [-1980, -2320] };
export const LAKE = { x: 500, z: -110, rx: 140, rz: 210 };
export const RUNWAY = { x0: 980, x1: 2460, z: 1760, w: 45 };
export const APRON = { x0: 1120, x1: 1820, z0: 1380, z1: 1640 };
export const BREAKWATER = { z: 2060, x0: -1690, x1: -2280, w: 14 };
export const BASINS = [[-1880, 1380, -1480, 1560], [-1880, 1690, -1480, 1870]];
const H_CELL = 4, O_CELL = 2;

/* ---------- coast, water, districts ---------- */
export function coastX(z) { return -1700 + 38 * Math.sin(z / 310) + 22 * Math.sin(z / 97 + 1.3) + (z > 1100 ? -60 * smoothstep(1100, 1300, z) : 0); }
export function onIsland(x, z, pad = 0) { return Math.hypot(x - ISLAND.x, z - ISLAND.z) < ISLAND.r + pad; }
export function onBreakwater(x, z) { return x <= BREAKWATER.x0 + 5 && x >= BREAKWATER.x1 - 25 && Math.abs(z - BREAKWATER.z) < BREAKWATER.w / 2 + (x < BREAKWATER.x1 + 10 ? 14 : 0); }
export function inBasin(x, z) { return BASINS.some((b) => x > b[0] && x < b[2] && z > b[1] && z < b[3]); }
export function inLake(x, z, pad = 0) { const dx = (x - LAKE.x) / (LAKE.rx + pad), dz = (z - LAKE.z) / (LAKE.rz + pad); return dx * dx + dz * dz < 1; }
export function isSea(x, z) { return x < coastX(z) && !onIsland(x, z) && !onBreakwater(x, z); }
export function isWater(x, z) { return isSea(x, z) || inBasin(x, z) || inLake(x, z); }

const OLDTOWN = [[-860, -470], [-460, -625], [-40, -575], [140, -320], [120, 130], [-190, 390], [-660, 345], [-920, 60]];
const PARK = [[210, -520], [800, -520], [820, 330], [175, 335]];
export const DISTRICTS = [
  { id: 'island', name: 'Lotus Island', test: (x, z) => onIsland(x, z, 60) },
  { id: 'beach', name: 'The Beach', test: (x, z) => x < -1250 && z > -1300 && z < 1060 },
  { id: 'port', name: 'The Port', test: (x, z) => x < -700 && z >= 1060 },
  { id: 'oldtown', name: 'Old Town', test: (x, z) => pointInPoly(x, z, OLDTOWN) },
  { id: 'park', name: 'The Park', test: (x, z) => pointInPoly(x, z, PARK) },
  { id: 'campus', name: 'Campus', test: (x, z) => x < -550 && z < -1440 },
  { id: 'downtown', name: 'Downtown', test: (x, z) => x >= -550 && x < 950 && z < -1440 },
  { id: 'hills', name: 'Pine Hills', test: (x, z) => x >= 950 && z < 800 },
  { id: 'airport', name: 'The Airport', test: (x, z) => x >= 950 && z >= 800 },
  { id: 'poligono', name: 'El Polígono', test: (x, z) => z >= 1350 },
  { id: 'barrio', name: 'Barrio Sur', test: (x, z) => z >= 1060 },
  { id: 'ensanche', name: 'Ensanche', test: () => true }
];
export function districtAt(x, z) { for (const d of DISTRICTS) if (d.test(x, z)) return d.id; return 'ensanche'; }
/* the garden's six places, and the district whose weather each one shares */
export const PLACE_OF = { oldtown: 'oldtown', beach: 'beach', campus: 'campus', hills: 'hills', downtown: 'downtown', island: 'island', ensanche: 'oldtown', park: 'oldtown', port: 'beach', poligono: 'oldtown', barrio: 'oldtown', airport: 'hills' };

/* ---------- natural terrain, before roads cut into it ---------- */
const HILLS = [[1900, -1180, 118, 620], [2250, -560, 84, 480], [1420, -1960, 70, 430], [2350, 260, 55, 420], [1550, -350, 45, 380]];
export const LAKE_LEVEL = 8.2;
function rawHeight(x, z) {
  if (inBasin(x, z)) return -5;
  if (inLake(x, z, 10)) { const dx = (x - LAKE.x) / LAKE.rx, dz = (z - LAKE.z) / LAKE.rz, r = Math.sqrt(dx * dx + dz * dz); return LAKE_LEVEL + 0.6 - smoothstep(1.08, 0.7, r) * 3.4; }
  if (onIsland(x, z)) { const d = Math.hypot(x - ISLAND.x, z - ISLAND.z) / ISLAND.r; return Math.max(-6, 11 * (1 - d * d) + fbm2(x / 90, z / 90, 2, 7) * 1.5 - 1); }
  const cx = coastX(z), inland = x - cx;
  if (inland < 0) return -2 + inland * 0.04;
  let h = 1.4 + smoothstep(0, 360, inland) * 5.5;
  h += smoothstep(-1300, 1200, x) * 9;
  if (x > 850) {
    let hill = 0;
    for (const [hx, hz, A, R] of HILLS) { const d2 = ((x - hx) ** 2 + (z - hz) ** 2) / (R * R); if (d2 < 9) hill += A * Math.exp(-d2 * 1.6); }
    hill *= 0.82 + 0.3 * fbm2(x / 260, z / 260, 2, 3);
    h += hill * smoothstep(850, 1250, x);
  }
  h += fbm2(x / 520, z / 520, 2, 11) * 3.2 + noise2(x / 150, z / 150, 5) * 0.8;
  /* flat zones */
  if (x > 900 && z > 850) h = lerp(h, 17, smoothstep(850, 1050, z) * smoothstep(900, 1100, x));
  if (z > 1060 && x < -700) h = lerp(h, 3.2, smoothstep(1060, 1200, z));
  if (z > 1350 && x > -700 && x < 950) h = lerp(h, 10, 0.75);
  return h;
}

/* ---------- roads ---------- */
const KIND = {
  ronda: { w: 24, lanes: 6, sw: 0, speed: 22, pr: 6, median: 3 },
  boulevard: { w: 30, lanes: 6, sw: 7, speed: 14, pr: 5, median: 7 },
  granvia: { w: 20, lanes: 4, sw: 7, speed: 14, pr: 5 },
  avenue: { w: 16, lanes: 4, sw: 5, speed: 14, pr: 4 },
  promenade: { w: 15, lanes: 4, sw: 6, speed: 14, pr: 4 },
  bridge: { w: 18, lanes: 4, sw: 2.5, speed: 20, pr: 4 },
  street: { w: 10, lanes: 2, sw: 4, speed: 11, pr: 2 },
  hill: { w: 8, lanes: 2, sw: 0.8, speed: 13, pr: 2 },
  service: { w: 9, lanes: 2, sw: 1.5, speed: 10, pr: 2 },
  ring: { w: 13, lanes: 2, sw: 3, speed: 9, pr: 3 },
  lane: { w: 6.4, lanes: 1, sw: 1.6, speed: 8, pr: 1 }
};

function roundedRect(x0, z0, x1, z1, r) {
  const pts = [], arc = (cx, cz, a0) => { for (let k = 0; k <= 6; k++) { const a = a0 + (k / 6) * Math.PI / 2; pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); } };
  arc(x1 - r, z0 + r, -Math.PI / 2); arc(x1 - r, z1 - r, 0); arc(x0 + r, z1 - r, Math.PI / 2); arc(x0 + r, z0 + r, Math.PI);
  pts.push(pts[0].slice());
  return densify(pts, 20);
}
function circle(cx, cz, r, n = 32) { const p = []; for (let k = 0; k <= n; k++) { const a = (k / n) * Math.PI * 2; p.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); } return p; }
function line(x0, z0, x1, z1, step = 20) { return densify([[x0, z0], [x1, z1]], step); }

export const ROUNDABOUTS = [
  { id: 'central', name: 'Glorieta Central', x: 0, z: -760, r: 48 },
  { id: 'mar', name: 'Glorieta del Mar', x: -1335, z: -150, r: 40 },
  { id: 'ciencias', name: 'Glorieta de las Ciencias', x: -900, z: -1860, r: 36 },
  { id: 'puerto', name: 'Glorieta del Puerto', x: -1335, z: 1250, r: 38 },
  { id: 'sur', name: 'Glorieta del Sur', x: 420, z: 1250, r: 36 }
];
export const PLAZAS = [
  { id: 'mayor', name: 'Plaza Mayor', x: -380, z: -120, w: 96, d: 76, rot: 0.06 },
  { id: 'basilica', name: 'Plaza de la Basílica', x: -610, z: -300, w: 64, d: 52, rot: -0.2 },
  { id: 'chica', name: 'Plaza Chica', x: -150, z: 160, w: 42, d: 40, rot: 0.3 },
  { id: 'paseo', name: 'Plaza del Paseo', x: 0, z: -1950, w: 110, d: 90, rot: 0 }
];
function inPlaza(x, z, pad = 0) {
  for (const p of PLAZAS) {
    const c = Math.cos(-p.rot), s = Math.sin(-p.rot), dx = x - p.x, dz = z - p.z, lx = dx * c - dz * s, lz = dx * s + dz * c;
    if (Math.abs(lx) < p.w / 2 + pad && Math.abs(lz) < p.d / 2 + pad) return p;
  }
  return null;
}
function plazaLoop(p) {
  const c = Math.cos(p.rot), s = Math.sin(p.rot), hw = p.w / 2 + 6, hd = p.d / 2 + 6;
  return densify([[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd], [-hw, -hd]].map(([a, b]) => [p.x + a * c - b * s, p.z + a * s + b * c]), 12);
}

function buildRoads(R) {
  const raw = [];
  const add = (pts, kind, extra = {}) => { const k = KIND[kind]; raw.push(Object.assign({ pts, kind, w: k.w, lanes: k.lanes, sw: k.sw, speed: k.speed, pr: k.pr, median: k.median || 0, name: '' }, extra)); };
  /* La Ronda, the ring road around the centre */
  add(roundedRect(-1180, -1420, 930, 1060, 190), 'ronda', { name: 'La Ronda', loop: true });
  /* El Paseo from Old Town to Downtown, through Glorieta Central */
  add(line(0, -585, 0, -2380), 'boulevard', { name: 'El Paseo' });
  /* Gran Vía, a slight curve into Glorieta Central */
  add(smoothPath([[-1000, -330], [-660, -470], [-320, -610], [0, -760]], 12), 'granvia', { name: 'Gran Vía' });
  /* the sea front */
  add(line(-1335, -1300, -1335, 1250), 'promenade', { name: 'Paseo Marítimo' });
  add(smoothPath([[-1335, -1300], [-1380, -1600], [-1430, -1950], [-1460, -2380]], 14), 'avenue', { name: 'Carretera de la Costa' });
  add(smoothPath([[-1335, -1300], [-1260, -1380], [-1180, -1440]], 10), 'avenue', { name: '' });
  /* Avenida del Sur, from the port to the airport */
  add(smoothPath([[-1335, 1250], [-600, 1250], [420, 1250], [1100, 1260], [1440, 1300]], 16), 'avenue', { name: 'Avenida del Sur' });
  /* to Lotus Island: across the sand, then the bridge, then the island ring */
  add(line(-1335, BRIDGE.z, BRIDGE.x0, BRIDGE.z), 'bridge', { name: 'Puente del Loto' });
  add(line(BRIDGE.x0, BRIDGE.z, BRIDGE.x1 - 10, BRIDGE.z, 10), 'bridge', { name: 'Puente del Loto', bridge: true });
  add(circle(ISLAND.x, ISLAND.z, ISLAND.ring, 48), 'street', { name: 'Anillo del Loto', loop: true });
  add(line(BRIDGE.x1 - 10, BRIDGE.z, ISLAND.x + ISLAND.ring, ISLAND.z), 'street');
  add(line(ISLAND.x, ISLAND.z - ISLAND.ring, ISLAND.x, ISLAND.z + ISLAND.ring), 'lane');
  /* roundabouts */
  for (const g of ROUNDABOUTS) add(circle(g.x, g.z, g.r, 28), 'ring', { name: g.name, loop: true, round: g.id });
  /* Downtown grid */
  for (let x = -450; x <= 600; x += 150) if (x !== 0) add(line(x, -1440, x, -2360), 'avenue');
  for (let z = -1580; z >= -2360; z -= 140) add(line(-550, z, 940, z), 'avenue');
  /* Campus loop and the science roundabout */
  add(smoothPath([[-1180, -1440], [-1200, -1700], [-1150, -2050], [-900, -2200], [-650, -2100], [-560, -1800], [-640, -1500], [-900, -1440], [-1180, -1440]], 14), 'street', { name: 'Avenida de la Universidad' });
  add(line(-1380, -1860, -560, -1860), 'street');
  add(line(-900, -1440, -900, -2200), 'street');
  /* Ensanche grid, kept out of Old Town, the Park and the Paseo corridor */
  const ensOk = (x, z) => { const d = districtAt(x, z); return d === 'ensanche' && !pointInPoly(x, z, grow(OLDTOWN, 14)) && !pointInPoly(x, z, grow(PARK, 14)); };
  for (let x = -1105; x <= 900; x += 110) { if (Math.abs(x) < 45) continue; for (const run of runs((t) => [x, -1420 + t], 2480, (p) => ensOk(p[0], p[1]))) add(run, 'street'); }
  for (let z = -1365; z <= 1040; z += 110) for (const run of runs((t) => [-1180 + t, z], 2110, (p) => ensOk(p[0], p[1]) && !(Math.abs(p[0]) < 40 && p[1] < -700))) add(run, 'street');
  /* Old Town: the line of the old wall, then crooked lanes */
  add(smoothPath(grow(OLDTOWN, 6).concat([grow(OLDTOWN, 6)[0]]), 10, false), 'street', { name: 'Ronda de la Muralla', loop: true });
  oldTownLanes(R, add);
  for (const p of PLAZAS.slice(0, 3)) add(plazaLoop(p), 'lane', { loop: true, plaza: p.id });
  add(plazaLoop(PLAZAS[3]), 'street', { loop: true, plaza: 'paseo' });
  /* the Park: one road around it */
  add(smoothPath(grow(PARK, 10).concat([grow(PARK, 10)[0]]), 12, false), 'street', { name: 'Paseo del Parque', loop: true });
  /* Barrio Sur */
  for (let x = -1100; x <= 900; x += 130) add(line(x, 1060, x, 1350), 'street');
  add(line(-1180, 1150, 930, 1150), 'street'); add(line(-700, 1350, 940, 1350), 'avenue');
  /* El Polígono */
  for (let x = -650; x <= 900; x += 170) add(line(x, 1350, x, 2230), 'service');
  for (let z = 1520; z <= 2230; z += 170) add(line(-700, z, 940, z), 'service');
  /* the Port */
  add(line(-1335, 1250, -1335, 2120), 'service', { name: 'Muelle Principal' });
  for (const z of [1300, 1625, 1960]) add(line(-1900, z, -700, z), 'service');
  add(line(BREAKWATER.x0, BREAKWATER.z, BREAKWATER.x1, BREAKWATER.z, 12), 'service', { name: 'Espigón' });
  add(line(-1335, 2060, BREAKWATER.x0, BREAKWATER.z), 'service');
  /* the Airport */
  add(smoothPath([[1440, 1300], [1440, 1360], [1880, 1360], [2150, 1420], [2300, 1560]], 12), 'service', { name: 'Terminal' });
  add(line(930, 900, 1250, 1255), 'avenue');
  /* Pine Hills: the Sierra road up to the lookout and down to the airport */
  const sierraUp = smoothPath([[930, -500], [1060, -540], [1240, -690], [1330, -930], [1520, -1010], [1620, -1240], [1830, -1330], [1960, -1170]], 9);
  add(sierraUp, 'hill', { name: 'Carretera de la Sierra' });
  const sierraDown = smoothPath([[1960, -1170], [2070, -960], [2180, -640], [2010, -310], [1820, -40], [1680, 260], [1520, 600], [1460, 900], [1440, 1300]], 9);
  add(sierraDown, 'hill', { name: 'Carretera de la Sierra' });
  add(smoothPath([[930, 400], [1100, 420], [1300, 360], [1520, 600]], 10), 'hill');
  add(smoothPath([[930, -1420], [1080, -1500], [1300, -1520], [1420, -1700], [1380, -1960]], 10), 'hill');
  /* villa lanes branching off the Sierra road */
  const spurs = [];
  for (const path of [sierraUp, sierraDown]) {
    const L = polyLen(path);
    for (let s = 180; s < L - 120; s += 230) {
      const a = along(path, s), side = ihash(Math.round(a.x), Math.round(a.z)) < 0.5 ? 1 : -1;
      const nx = -a.dz * side, nz = a.dx * side, len = 110 + ihash(Math.round(s)) * 90;
      const end = [a.x + nx * len + a.dx * 30, a.z + nz * len + a.dz * 30];
      if (districtAt(end[0], end[1]) !== 'hills') continue;
      spurs.push(smoothPath([[a.x, a.z], [a.x + nx * len * 0.5 + a.dx * 10, a.z + nz * len * 0.5 + a.dz * 10], end], 8));
    }
  }
  for (const s of spurs) add(s, 'lane', { villa: true });
  return raw;
}
function grow(poly, d) {
  let cx = 0, cz = 0; for (const p of poly) { cx += p[0]; cz += p[1]; } cx /= poly.length; cz /= poly.length;
  return poly.map(([x, z]) => { const l = Math.hypot(x - cx, z - cz); return [x + (x - cx) / l * d, z + (z - cz) / l * d]; });
}
/* sample a parametric line and keep the stretches where ok() holds */
function runs(f, len, ok, step = 5) {
  const out = []; let cur = null;
  for (let t = 0; t <= len; t += step) {
    const p = f(t);
    if (ok(p)) { if (!cur) cur = []; cur.push(p); }
    else if (cur) { if (cur.length > 4) out.push(cur); cur = null; }
  }
  if (cur && cur.length > 4) out.push(cur);
  return out.map((r) => densify([r[0], r[r.length - 1]], 20));
}
function oldTownLanes(R, add) {
  const C = 52, inner = grow(OLDTOWN, -18), P = new Map();
  for (let i = -20; i <= 20; i++) for (let j = -20; j <= 20; j++) {
    const x = -380 + i * C + (R() - 0.5) * 26, z = -100 + j * C + (R() - 0.5) * 26;
    if (pointInPoly(x, z, inner) && !inPlaza(x, z, 14)) P.set(i + ',' + j, [x, z]);
  }
  const lane = (a, b) => {
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), o = (R() - 0.5) * 12;
    add(smoothPath([a, [mx - dz / L * o, mz + dx / L * o], b], 6), 'lane');
  };
  for (const [k, p] of P) {
    const [i, j] = k.split(',').map(Number);
    const r = P.get((i + 1) + ',' + j), d = P.get(i + ',' + (j + 1)), dg = P.get((i + 1) + ',' + (j + 1));
    if (r && R() < 0.82) lane(p, r);
    if (d && R() < 0.82) lane(p, d);
    if (dg && R() < 0.12) lane(p, dg);
  }
  /* lanes out to the old wall road so the maze connects */
  for (const [, p] of P) {
    let best = null, bd = 1e9;
    for (let i = 0; i < OLDTOWN.length; i++) { const a = grow(OLDTOWN, 6)[i], b = grow(OLDTOWN, 6)[(i + 1) % OLDTOWN.length]; const c = segClosest(p[0], p[1], a[0], a[1], b[0], b[1]); if (c[1] < bd) { bd = c[1]; best = [c[2], c[3]]; } }
    if (bd < 40 && R() < 0.7) add(densify([p, best], 8), 'lane');
  }
}

/* split every road where it crosses another and build the graph */
function buildGraph(raw) {
  const segs = [];
  raw.forEach((e, ei) => { for (let i = 1; i < e.pts.length; i++) segs.push({ ei, i, a: e.pts[i - 1], b: e.pts[i] }); });
  const g = new Grid(60);
  segs.forEach((s) => g.add(s, Math.min(s.a[0], s.b[0]), Math.min(s.a[1], s.b[1]), Math.max(s.a[0], s.b[0]), Math.max(s.a[1], s.b[1])));
  const cuts = raw.map(() => []);
  for (const s of segs) {
    const near = g.query(Math.min(s.a[0], s.b[0]), Math.min(s.a[1], s.b[1]), Math.max(s.a[0], s.b[0]), Math.max(s.a[1], s.b[1]));
    for (const o of near) {
      if (o === s || o.ei < s.ei || (o.ei === s.ei && Math.abs(o.i - s.i) < 2)) continue;
      if (raw[s.ei].bridge !== raw[o.ei].bridge) continue;
      const r = segIntersect(s.a, s.b, o.a, o.b);
      if (!r) continue;
      const x = s.a[0] + (s.b[0] - s.a[0]) * r[0], z = s.a[1] + (s.b[1] - s.a[1]) * r[0];
      cuts[s.ei].push({ i: s.i, t: r[0], x, z }); cuts[o.ei].push({ i: o.i, t: r[1], x, z });
    }
  }
  /* nodes, merged within 3 m */
  const nodes = [], ng = new Grid(10);
  const node = (x, z) => {
    const near = ng.query(x - 3, z - 3, x + 3, z + 3);
    for (const n of near) if (Math.hypot(n.x - x, n.z - z) < 3) return n.id;
    const n = { id: nodes.length, x, z, edges: [] }; nodes.push(n); ng.add(n, x, z, x, z); return n.id;
  };
  const edges = [];
  raw.forEach((e, ei) => {
    const cs = cuts[ei].sort((p, q) => p.i - q.i || p.t - q.t);
    const pts = [], marks = [];
    let ci = 0;
    pts.push(e.pts[0]); marks.push(true);
    for (let i = 1; i < e.pts.length; i++) {
      while (ci < cs.length && cs[ci].i === i) { pts.push([cs[ci].x, cs[ci].z]); marks.push(true); ci++; }
      pts.push(e.pts[i]); marks.push(i === e.pts.length - 1);
    }
    let start = 0;
    for (let k = 1; k < pts.length; k++) {
      if (!marks[k]) continue;
      const piece = pts.slice(start, k + 1);
      if (polyLen(piece) > 2.5) {
        const a = node(piece[0][0], piece[0][1]), b = node(piece[piece.length - 1][0], piece[piece.length - 1][1]);
        if (a !== b || piece.length > 3) {
          const ed = Object.assign({}, e, { pts: piece, a, b }); delete ed.loop;
          ed.id = edges.length; edges.push(ed); nodes[a].edges.push(ed.id); nodes[b].edges.push(ed.id);
        }
      }
      start = k;
    }
  });
  /* snap pieces back onto merged node positions */
  for (const e of edges) { e.pts[0] = [nodes[e.a].x, nodes[e.a].z]; e.pts[e.pts.length - 1] = [nodes[e.b].x, nodes[e.b].z]; e.len = polyLen(e.pts); }
  return { nodes, edges };
}
/* inside roundabouts, the spokes stop at the ring */
function trimRoundabouts(G) {
  for (const e of G.edges) {
    if (e.round) continue;
    for (const r of ROUNDABOUTS) {
      const mid = along(e.pts, e.len / 2);
      if (Math.hypot(mid.x - r.x, mid.z - r.z) < r.r - 2) e.dead = true;
    }
    if (isWater(along(e.pts, e.len / 2).x, along(e.pts, e.len / 2).z) && !e.bridge) e.dead = true;
  }
  const alive = G.edges.filter((e) => !e.dead);
  G.nodes.forEach((n) => { n.edges = n.edges.filter((id) => !G.edges[id].dead); });
  /* renumber */
  const map = new Map(); alive.forEach((e, i) => { map.set(e.id, i); e.id = i; });
  G.nodes.forEach((n) => { n.edges = n.edges.map((id) => map.get(id)); });
  G.edges = alive;
}

/* ---------- heights: roads get smooth profiles, terrain bends to meet them ---------- */
function roadProfiles(G) {
  for (const e of G.edges) {
    e.dense = densify(e.pts, 6);
    const ys = e.dense.map(([x, z]) => rawHeight(x, z));
    const win = e.kind === 'ronda' || e.kind === 'boulevard' || e.kind === 'promenade' ? 14 : e.kind === 'hill' ? 5 : 9;
    let sm = ys.slice();
    for (let pass = 0; pass < 3; pass++) sm = sm.map((_, i) => { let s = 0, n = 0; for (let k = -win; k <= win; k++) { const j = i + k; if (j >= 0 && j < sm.length) { s += sm[j]; n++; } } return s / n; });
    if (e.bridge) {
      const L = e.dense.length - 1;
      sm = e.dense.map((p, i) => { const t = i / L, end = Math.min(t, 1 - t); return lerp(5.2, BRIDGE.top, smoothstep(0, 0.42, end)); });
    }
    e.ys = sm;
  }
  /* nodes take the average of the road ends that meet there, and roads ease into it */
  for (const n of G.nodes) {
    let s = 0, k = 0;
    for (const id of n.edges) { const e = G.edges[id]; s += e.a === n.id ? e.ys[0] : e.ys[e.ys.length - 1]; k++; }
    n.y = k ? s / k : rawHeight(n.x, n.z);
  }
  for (const e of G.edges) {
    if (e.bridge) continue;
    const ya = G.nodes[e.a].y, yb = G.nodes[e.b].y, L = e.dense.length;
    let acc = 0; const sd = [0];
    for (let i = 1; i < L; i++) { acc += dist(e.dense[i - 1], e.dense[i]); sd.push(acc); }
    const ease = Math.min(40, acc / 2);
    e.ys = e.ys.map((y, i) => {
      const wa = 1 - smoothstep(0, ease, sd[i]), wb = 1 - smoothstep(0, ease, acc - sd[i]);
      return y + (ya - e.ys[0]) * wa + (yb - e.ys[L - 1]) * wb;
    });
    e.sd = sd;
  }
}
export function makeHeightField(G) {
  const W = Math.ceil((MAP.x1 - MAP.x0) / H_CELL) + 1, H = Math.ceil((MAP.z1 - MAP.z0) / H_CELL) + 1;
  const h = new Float32Array(W * H), wt = new Float32Array(W * H), tg = new Float32Array(W * H);
  const W2 = Math.ceil(W / 2) + 1, H2 = Math.ceil(H / 2) + 1, coarse = new Float32Array(W2 * H2);
  for (let j = 0; j < H2; j++) for (let i = 0; i < W2; i++) coarse[j * W2 + i] = rawHeight(MAP.x0 + i * H_CELL * 2, MAP.z0 + j * H_CELL * 2);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const ci = i >> 1, cj = j >> 1, tx = (i & 1) * 0.5, tz = (j & 1) * 0.5, k = cj * W2 + ci;
    const a = coarse[k], b = coarse[Math.min(k + 1, coarse.length - 1)], c = coarse[Math.min(k + W2, coarse.length - 1)], d = coarse[Math.min(k + W2 + 1, coarse.length - 1)];
    h[j * W + i] = (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  }
  for (const e of G.edges) {
    if (e.bridge) continue;
    const half = e.w / 2 + e.sw + 1.5, fall = e.kind === 'hill' || e.kind === 'lane' ? 16 : 22, R = half + fall;
    for (let k = 1; k < e.dense.length; k++) {
      const a = e.dense[k - 1], b = e.dense[k], ya = e.ys[k - 1], yb = e.ys[k];
      const i0 = Math.floor((Math.min(a[0], b[0]) - R - MAP.x0) / H_CELL), i1 = Math.ceil((Math.max(a[0], b[0]) + R - MAP.x0) / H_CELL);
      const j0 = Math.floor((Math.min(a[1], b[1]) - R - MAP.z0) / H_CELL), j1 = Math.ceil((Math.max(a[1], b[1]) + R - MAP.z0) / H_CELL);
      for (let j = Math.max(0, j0); j <= Math.min(H - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(W - 1, i1); i++) {
        const x = MAP.x0 + i * H_CELL, z = MAP.z0 + j * H_CELL, c = segClosest(x, z, a[0], a[1], b[0], b[1]);
        if (c[1] > R) continue;
        const w = 1 - smoothstep(half, R, c[1]), idx = j * W + i;
        if (w > wt[idx]) { wt[idx] = w; tg[idx] = ya + (yb - ya) * c[0] - 0.08; }
      }
    }
  }
  for (let k = 0; k < h.length; k++) if (wt[k] > 0) h[k] = lerp(h[k], tg[k], wt[k]);
  return { W, H, cell: H_CELL, x0: MAP.x0, z0: MAP.z0, data: h };
}
export function sampleHeight(F, x, z) {
  const fx = (x - F.x0) / F.cell, fz = (z - F.z0) / F.cell;
  let i = Math.floor(fx), j = Math.floor(fz);
  if (i < 0 || j < 0 || i >= F.W - 1 || j >= F.H - 1) return -4;
  const tx = fx - i, tz = fz - j, d = F.data, W = F.W, k = j * W + i;
  return (d[k] * (1 - tx) + d[k + 1] * tx) * (1 - tz) + (d[k + W] * (1 - tx) + d[k + W + 1] * tx) * tz;
}

/* ---------- what stands on the land ---------- */
export class Occ {
  constructor() { this.W = Math.ceil((MAP.x1 - MAP.x0) / O_CELL); this.H = Math.ceil((MAP.z1 - MAP.z0) / O_CELL); this.a = new Uint8Array(this.W * this.H); }
  idx(x, z) { const i = Math.floor((x - MAP.x0) / O_CELL), j = Math.floor((z - MAP.z0) / O_CELL); return i < 0 || j < 0 || i >= this.W || j >= this.H ? -1 : j * this.W + i; }
  get(x, z) { const k = this.idx(x, z); return k < 0 ? 255 : this.a[k]; }
  /* rotated rectangle: test (returns true if all free) or mark */
  rect(cx, cz, w, d, rot, mark = 0) {
    const c = Math.cos(rot), s = Math.sin(rot), R = Math.hypot(w, d) / 2;
    for (let z = cz - R; z <= cz + R; z += O_CELL) for (let x = cx - R; x <= cx + R; x += O_CELL) {
      const dx = x - cx, dz = z - cz, lx = dx * c + dz * s, lz = -dx * s + dz * c;
      if (Math.abs(lx) > w / 2 || Math.abs(lz) > d / 2) continue;
      const k = this.idx(x, z);
      if (k < 0) { if (!mark) return false; continue; }
      if (mark) this.a[k] = mark; else if (this.a[k]) return false;
    }
    return true;
  }
}

/* building styles by district: widths, depths, floors, palette, roof */
const PAL = {
  madrid: ['#E7C9A0', '#D9A77A', '#C98763', '#EED9B6', '#E3B98F', '#F2E6CF', '#D7B48C', '#CC9E85', '#E9D3A8', '#BF7E5F'],
  pastel: ['#F4EEE4', '#EDE3D3', '#E8DCCB', '#F6F1E8', '#E2D6C4', '#EFE6DA'],
  white: ['#F6F4EF', '#F1EEE7', '#ECE8E0', '#F8F6F2'],
  brick: ['#B6765A', '#A9694F', '#C08368', '#9C624B'],
  stone: ['#DDD3C2', '#D2C6B2', '#E6DDCF', '#CFC3AE'],
  industrial: ['#B9BCC0', '#A8ADB3', '#C9CCCE', '#8E959C', '#7A8A97', '#9DA8B0'],
  beach: ['#FBF8F2', '#F4EFE6', '#EAF1F4', '#F7EFE1']
};
export const STYLES = {
  oldtown: { w: [7, 15], d: [11, 17], fl: [3, 6], fh: 3.3, gf: 4.0, gap: 0, pal: 'madrid', walls: ['painted_plaster_wall', 'clay_plaster', 'damaged_plaster', 'white_plaster_02'], roof: 'tile', balc: 0.8, shop: 0.6, shutters: 0.7, cornice: 1 },
  plaza: { w: [9, 13], d: [12, 15], fl: [4, 4], fh: 3.4, gf: 4.6, gap: 0, pal: 'madrid', walls: ['painted_plaster_wall'], roof: 'tile', balc: 1, shop: 1, arcade: true, shutters: 0.9, cornice: 1 },
  ensanche: { w: [13, 26], d: [15, 22], fl: [6, 8], fh: 3.3, gf: 4.4, gap: 0, pal: 'madrid', walls: ['painted_plaster_wall', 'painted_brick', 'white_plaster_02', 'clay_plaster', 'brick_wall_10'], roof: 'mansard', balc: 0.9, shop: 0.8, shutters: 0.6, cornice: 1 },
  granvia: { w: [18, 34], d: [18, 28], fl: [8, 13], fh: 3.6, gf: 5.2, gap: 0, pal: 'stone', walls: ['large_sandstone_blocks', 'granite_tile', 'painted_plaster_wall'], roof: 'mansard', balc: 0.8, shop: 1, shutters: 0.2, cornice: 2, dome: 0.12 },
  paseo: { w: [20, 36], d: [18, 26], fl: [9, 15], fh: 3.5, gf: 5, gap: 0, pal: 'stone', walls: ['large_sandstone_blocks', 'concrete_tile_facade', 'rectangular_facade_tiles', 'painted_plaster_wall'], roof: 'flat', balc: 0.4, shop: 0.9, shutters: 0.1, cornice: 1 },
  tower: { w: [26, 46], d: [24, 42], fl: [12, 62], fh: 3.7, gf: 7, gap: 14, pal: 'industrial', walls: ['glass'], roof: 'flat', balc: 0, shop: 0.3, tower: true },
  office: { w: [22, 40], d: [20, 34], fl: [8, 18], fh: 3.6, gf: 6, gap: 8, pal: 'stone', walls: ['glass', 'granite_tile', 'rectangular_facade_tiles', 'concrete_wall_006'], roof: 'flat', balc: 0, shop: 0.5, tower: true },
  beachtower: { w: [22, 30], d: [13, 17], fl: [12, 28], fh: 3.1, gf: 4.6, gap: 16, pal: 'beach', walls: ['white_plaster_02', 'concrete_wall_006'], roof: 'flat', balc: 1, bands: true, shop: 0.8, shutters: 0.3 },
  beach: { w: [10, 18], d: [10, 15], fl: [2, 4], fh: 3.1, gf: 3.6, gap: 4, pal: 'white', walls: ['white_plaster_02', 'painted_plaster_wall'], roof: 'flat', balc: 0.6, shop: 0.5, shutters: 0.8 },
  bloque: { w: [22, 46], d: [12, 15], fl: [6, 10], fh: 2.9, gf: 3.4, gap: 6, pal: 'brick', walls: ['brick_wall_10', 'concrete_tile_facade', 'painted_brick'], roof: 'flat', balc: 1, terraces: true, shop: 0.4, shutters: 0.9 },
  campus: { w: [36, 70], d: [18, 30], fl: [3, 5], fh: 3.8, gf: 4.4, gap: 14, pal: 'brick', walls: ['brick_wall_10', 'painted_brick'], roof: 'flat', balc: 0, shop: 0, shutters: 0 },
  warehouse: { w: [40, 90], d: [26, 42], fl: [1, 2], fh: 6, gf: 6, gap: 10, pal: 'industrial', walls: ['corrugated_iron_02', 'concrete_wall_006', 'rusty_metal_02'], roof: 'shed', balc: 0, shop: 0, industrial: true },
  factory: { w: [30, 70], d: [24, 44], fl: [1, 3], fh: 5, gf: 5, gap: 12, pal: 'industrial', walls: ['concrete_wall_006', 'corrugated_iron_02', 'brick_wall_10'], roof: 'shed', balc: 0, shop: 0, industrial: true },
  villa: { w: [12, 20], d: [11, 16], fl: [2, 2], fh: 3.2, gf: 3.4, gap: 20, pal: 'white', walls: ['white_plaster_02', 'clay_plaster'], roof: 'tile', balc: 0.5, shop: 0, shutters: 0.6, villa: true },
  islandvilla: { w: [18, 28], d: [14, 20], fl: [2, 3], fh: 3.4, gf: 3.6, gap: 22, pal: 'white', walls: ['white_plaster_02', 'concrete_wall_006'], roof: 'flat', balc: 0.6, shop: 0, shutters: 0, villa: true, modern: true }
};
function styleFor(district, edge) {
  if (edge.plaza && edge.plaza !== 'paseo') return 'plaza';
  if (edge.name === 'Gran Vía') return 'granvia';
  if (edge.name === 'El Paseo') return district === 'downtown' ? 'tower' : 'paseo';
  if (edge.name === 'Paseo Marítimo') return 'beachtower';
  switch (district) {
    case 'oldtown': return 'oldtown';
    case 'downtown': return edge.kind === 'avenue' ? (ihash(Math.round(edge.pts[0][0]), Math.round(edge.pts[0][1])) < 0.55 ? 'tower' : 'office') : 'office';
    case 'beach': return 'beach';
    case 'barrio': return 'bloque';
    case 'campus': return 'campus';
    case 'port': return 'warehouse';
    case 'poligono': return 'factory';
    case 'hills': return edge.villa ? 'villa' : null;
    case 'island': return 'islandvilla';
    case 'airport': case 'park': return null;
    default: return 'ensanche';
  }
}

function placeLots(G, R, occ, F) {
  const lots = [];
  /* roads, sidewalks, water, plazas, parks, airport fields first */
  for (const e of G.edges) {
    const half = e.w / 2 + e.sw;
    for (let k = 1; k < e.dense.length; k++) {
      const a = e.dense[k - 1], b = e.dense[k], L = dist(a, b), rot = Math.atan2(b[1] - a[1], b[0] - a[0]);
      occ.rect((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, L + half * 1.2, half * 2, rot, e.bridge ? 0 : 1);
    }
  }
  const W = occ.W, H = occ.H, B = 4;
  for (let bj = 0; bj < H; bj += B) for (let bi = 0; bi < W; bi += B) {
    const x = MAP.x0 + (bi + B / 2) * O_CELL, z = MAP.z0 + (bj + B / 2) * O_CELL;
    let code = 0;
    if (isWater(x, z) || inLake(x, z, 12)) code = 2;
    else if (inPlaza(x, z, 2)) code = 4;
    else {
      const d = districtAt(x, z);
      if (d === 'park' || d === 'airport') code = 3;
      else if (d === 'beach' && x < -1350) code = 3;
    }
    if (!code) continue;
    for (let j = bj; j < Math.min(H, bj + B); j++) for (let i = bi; i < Math.min(W, bi + B); i++) { const k = j * W + i; if (!occ.a[k]) occ.a[k] = code; }
  }
  const order = G.edges.slice().sort((p, q) => q.pr - p.pr || q.len - p.len);
  for (const e of order) {
    if (e.bridge || e.kind === 'ronda' || e.kind === 'ring') continue;
    for (const side of [1, -1]) {
      const pts = e.dense, sd = e.sd || [0];
      const total = sd[sd.length - 1] || polyLen(pts);
      let s = 4;
      while (s < total - 6) {
        const p0 = along(pts, s), dmid = districtAt(p0.x - p0.dz * side * 20, p0.z + p0.dx * side * 20);
        const st = styleFor(dmid, e);
        if (!st) { s += 20; continue; }
        const S = STYLES[st], r = ihash(Math.round(p0.x * 3), Math.round(p0.z * 3), side + 7);
        let w = lerp(S.w[0], S.w[1], r), d = lerp(S.d[0], S.d[1], ihash(Math.round(p0.z), Math.round(p0.x), 3));
        const a = along(pts, Math.min(total, s + w)), dirx = a.x - p0.x, dirz = a.z - p0.z, chord = Math.hypot(dirx, dirz);
        if (chord < w * 0.9) w = Math.max(S.w[0], chord); /* curved street: narrower building */
        if (chord < 5) { s += 6; continue; }
        const ux = dirx / chord, uz = dirz / chord, nx = -uz * side, nz = ux * side;
        const off = e.w / 2 + e.sw + 0.4 + (S.gap ? 3 + ihash(Math.round(s), side) * 6 : 0);
        let placed = false;
        for (const dd of [d, d * 0.75, d * 0.55]) {
          const cx = p0.x + ux * w / 2 + nx * (off + dd / 2), cz = p0.z + uz * w / 2 + nz * (off + dd / 2);
          const rot = Math.atan2(uz, ux);
          if (occ.rect(cx, cz, w - 0.2, dd - 0.2, rot)) {
            occ.rect(cx, cz, w, dd, rot, 5);
            lots.push(makeLot(st, cx, cz, w, dd, rot, nx, nz, e, F, lots.length));
            placed = true; break;
          }
        }
        s += placed ? w + (S.gap ? S.gap * (0.6 + ihash(Math.round(s)) * 0.8) : 0) : 5;
      }
    }
  }
  /* fill the corners of perimeter blocks */
  for (const n of G.nodes) {
    if (n.edges.length < 2) continue;
    const d = districtAt(n.x, n.z);
    if (d !== 'ensanche' && d !== 'oldtown' && d !== 'barrio') continue;
    for (let q = 0; q < 4; q++) {
      const ang = q * Math.PI / 2 + Math.PI / 4 + (G.edges[n.edges[0]] ? edgeAngle(G.edges[n.edges[0]], n.id) : 0);
      for (const off of [17, 21]) {
        const cx = n.x + Math.cos(ang) * off, cz = n.z + Math.sin(ang) * off, sz = d === 'oldtown' ? 10 : 15;
        const rot = ang - Math.PI / 4;
        if (occ.rect(cx, cz, sz, sz, rot)) { occ.rect(cx, cz, sz + 0.4, sz + 0.4, rot, 5); lots.push(makeLot(d === 'oldtown' ? 'oldtown' : d === 'barrio' ? 'bloque' : 'ensanche', cx, cz, sz, sz, rot, Math.cos(ang + Math.PI), Math.sin(ang + Math.PI), { kind: 'street', name: '' }, F, lots.length, true)); break; }
      }
    }
  }
  return lots;
}
function edgeAngle(e, nodeId) { const p = e.a === nodeId ? [e.pts[0], e.pts[1]] : [e.pts[e.pts.length - 1], e.pts[e.pts.length - 2]]; return Math.atan2(p[1][1] - p[0][1], p[1][0] - p[0][0]); }

function makeLot(style, cx, cz, w, d, rot, fx, fz, e, F, idx, corner) {
  const S = STYLES[style], h0 = ihash(Math.round(cx), Math.round(cz), 11), h1 = ihash(Math.round(cz), Math.round(cx), 13);
  let fl = Math.round(lerp(S.fl[0], S.fl[1], Math.pow(h0, style === 'tower' ? 2.4 : S.tower ? 1.4 : 1)));
  if (style === 'ensanche') fl += Math.round(smoothstep(900, 200, Math.hypot(cx, cz + 600)) * 2);
  if (style === 'tower') fl = Math.round(fl * (0.6 + 0.6 * smoothstep(1100, 200, Math.hypot(cx, cz + 1900))));
  const pal = PAL[S.pal];
  const ys = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => {
    const c = Math.cos(rot), s = Math.sin(rot), lx = a * w / 2, lz = b * d / 2;
    return sampleHeight(F, cx + lx * c - lz * s, cz + lx * s + lz * c);
  });
  const base = Math.min(...ys), top = Math.max(...ys);
  const height = S.gf + (fl - 1) * S.fh + (S.tower ? 2.5 : 1.2);
  const lot = {
    i: idx, style, x: +cx.toFixed(2), z: +cz.toFixed(2), w: +w.toFixed(2), d: +d.toFixed(2), rot: +rot.toFixed(4),
    fx, fz, y: base, plinth: top - base, floors: fl, h: height, fh: S.fh, gf: S.gf,
    wall: S.walls[Math.floor(h1 * S.walls.length)], tint: pal[Math.floor(ihash(idx, 3) * pal.length)],
    roof: S.roof, balc: ihash(idx, 5) < (S.balc || 0), shop: ihash(idx, 7) < (S.shop || 0) && (e.kind !== 'lane' || style === 'oldtown'),
    shutters: ihash(idx, 9) < (S.shutters || 0), cornice: S.cornice || 0, seed: hash32(SEED + ':' + idx),
    district: districtAt(cx, cz), street: e.name || '', corner: !!corner
  };
  if (S.tower) {
    lot.glass = lot.wall === 'glass';
    lot.crown = ['flat', 'slant', 'spire', 'stepped', 'flat'][Math.floor(ihash(idx, 21) * 5)];
    lot.setback = fl > 22 ? Math.floor(ihash(idx, 23) * 3) : 0;
  }
  if (style === 'granvia' && ihash(idx, 31) < S.dome && fl > 9) lot.dome = true;
  if (S.bands) lot.bands = true;
  if (S.terraces) lot.terraces = true;
  if (S.arcade) lot.arcade = true;
  if (S.villa) lot.villa = true;
  if (S.modern) lot.modern = true;
  if (S.industrial) lot.industrial = true;
  return lot;
}

/* ---------- trees, props and gameplay spots ---------- */
function placeTrees(G, R, occ, F, lots) {
  const trees = [];
  const tree = (x, z, sp, s) => { if (occ.get(x, z) === 2) return; trees.push({ x: +x.toFixed(2), z: +z.toFixed(2), y: sampleHeight(F, x, z), sp, s: +s.toFixed(2), r: R() * 6.283 }); };
  for (const e of G.edges) {
    const d = districtAt(e.pts[0][0], e.pts[0][1]);
    let sp = null, step = 10.5;
    if (e.kind === 'boulevard' || (e.kind === 'street' && (d === 'ensanche' || d === 'barrio'))) sp = 'plane';
    if (e.kind === 'promenade' || d === 'island' || d === 'beach') { sp = 'palm'; step = 13; }
    if (e.kind === 'avenue' && (d === 'downtown' || d === 'campus')) { sp = 'plane'; step = 12; }
    if (!sp || e.sw < 3.4 || e.bridge) continue;
    for (let s = 6; s < e.len - 6; s += step) {
      const a = along(e.dense, s);
      for (const side of [1, -1]) {
        const off = e.w / 2 + e.sw - 1.3, x = a.x - a.dz * side * off, z = a.z + a.dx * side * off;
        if (occ.get(x, z) !== 1) continue;
        tree(x, z, sp, 0.85 + R() * 0.35);
      }
      if (e.median >= 6) tree(a.x, a.z, 'plane', 1 + R() * 0.2);
    }
  }
  /* the Park, the hills, the beach, the island, campus lawns, courtyards */
  const scatter = (x0, z0, x1, z1, spacing, fn) => {
    for (let z = z0; z < z1; z += spacing) for (let x = x0; x < x1; x += spacing) {
      const px = x + (R() - 0.5) * spacing * 0.9, pz = z + (R() - 0.5) * spacing * 0.9;
      const sp = fn(px, pz); if (sp) tree(px, pz, sp, 0.8 + R() * 0.5);
    }
  };
  scatter(160, -540, 840, 350, 14, (x, z) => (districtAt(x, z) === 'park' && occ.get(x, z) === 3 && !inLake(x, z, 14) && fbm2(x / 90, z / 90, 2, 4) > -0.25 ? (R() < 0.2 ? 'pine' : R() < 0.5 ? 'oak' : 'plane') : null));
  scatter(950, -2400, 2550, 820, 13, (x, z) => (districtAt(x, z) === 'hills' && occ.get(x, z) === 0 && fbm2(x / 160, z / 160, 3, 9) > -0.15 ? (R() < 0.85 ? 'pine' : 'oak') : null));
  scatter(ISLAND.x - 320, ISLAND.z - 320, ISLAND.x + 320, ISLAND.z + 320, 16, (x, z) => (onIsland(x, z) && occ.get(x, z) === 0 ? 'palm' : null));
  scatter(-1700, -1250, -1360, 1050, 30, (x, z) => (x > coastX(z) + 40 && occ.get(x, z) === 3 && R() < 0.25 ? 'palm' : null));
  scatter(-1250, -2300, -560, -1450, 18, (x, z) => (districtAt(x, z) === 'campus' && occ.get(x, z) === 0 && R() < 0.5 ? 'oak' : null));
  scatter(-1180, -1420, 930, 1060, 24, (x, z) => (occ.get(x, z) === 0 && R() < 0.22 ? 'oak' : null));
  for (const g of ROUNDABOUTS) for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283; tree(g.x + Math.cos(a) * g.r * 0.45, g.z + Math.sin(a) * g.r * 0.45, g.id === 'mar' ? 'palm' : 'plane', 1); }
  return trees;
}
function placeProps(G, R, occ, F) {
  const props = [];
  const put = (type, x, z, rot) => props.push({ t: type, x: +x.toFixed(2), z: +z.toFixed(2), y: sampleHeight(F, x, z), r: +rot.toFixed(3) });
  for (const e of G.edges) {
    if (e.bridge) {
      for (let s = 20; s < e.len; s += 40) { const a = along(e.dense, s); for (const side of [1, -1]) put('lampB', a.x - a.dz * side * (e.w / 2 + 1.5), a.z + a.dx * side * (e.w / 2 + 1.5), Math.atan2(a.dz, a.dx) + (side > 0 ? 0 : Math.PI)); }
      continue;
    }
    const d = districtAt(e.pts[0][0], e.pts[0][1]);
    const lamp = d === 'oldtown' || e.plaza ? 'lampOld' : e.kind === 'ronda' ? 'lampHigh' : 'lamp';
    const step = e.kind === 'ronda' ? 42 : e.kind === 'lane' ? 22 : 30;
    for (let s = step / 2; s < e.len - 4; s += step) {
      const a = along(e.dense, s), rot = Math.atan2(a.dz, a.dx);
      const side = (Math.floor(s / step) % 2) ? 1 : -1;
      const off = e.kind === 'ronda' ? 0 : e.w / 2 + Math.min(e.sw, 2.4) - 0.5;
      if (e.kind === 'ronda') { put('lampHigh', a.x, a.z, rot); continue; }
      const x = a.x - a.dz * side * off, z = a.z + a.dx * side * off;
      if (occ.get(x, z) === 1 || e.kind === 'lane') put(lamp, x, z, rot + (side > 0 ? -Math.PI / 2 : Math.PI / 2));
      if (e.sw >= 3 && ihash(Math.round(s), e.id) < 0.25) { const x2 = a.x + a.dz * side * (e.w / 2 + e.sw - 0.8), z2 = a.z - a.dx * side * (e.w / 2 + e.sw - 0.8); put(ihash(e.id, Math.round(s), 3) < 0.5 ? 'bin' : 'bench', x2, z2, rot + (side > 0 ? Math.PI / 2 : -Math.PI / 2)); }
      if (e.sw >= 3 && ihash(Math.round(s), e.id, 9) < 0.05) put('hydrant', a.x - a.dz * side * (e.w / 2 + 0.6), a.z + a.dx * side * (e.w / 2 + 0.6), rot);
      if (e.sw >= 4 && ihash(Math.round(s), e.id, 13) < 0.04) put('utility', a.x + a.dz * side * (e.w / 2 + e.sw - 0.6), a.z - a.dx * side * (e.w / 2 + e.sw - 0.6), rot);
    }
  }
  /* traffic lights where two bigger roads meet */
  for (const n of G.nodes) {
    if (n.edges.length < 3) continue;
    const big = n.edges.map((id) => G.edges[id]).filter((e) => e.pr >= 3 && e.kind !== 'ring');
    if (big.length < 2 || big.some((e) => e.kind === 'ronda' && false)) continue;
    for (const id of n.edges) { const e = G.edges[id], ang = edgeAngle(e, n.id), off = e.w / 2 + 1, back = 12; put('signal', n.x + Math.cos(ang) * back - Math.sin(ang) * off, n.z + Math.sin(ang) * back + Math.cos(ang) * off, ang + Math.PI); }
    n.signal = true;
  }
  return props;
}

function placeNotes(G, R) {
  const pool = G.edges.filter((e) => !e.bridge && e.kind !== 'ronda' && e.kind !== 'ring' && e.len > 40);
  const out = [], used = new Set();
  const NR = rng(SEED + ':notes');
  let guard = 0;
  while (out.length < 160 && guard++ < 20000) {
    const e = pool[Math.floor(NR() * pool.length)];
    const s = 10 + NR() * (e.len - 20), a = along(e.dense, s), side = NR() < 0.5 ? 1 : -1;
    const off = Math.max(1.8, e.w / 2 - 1.8);
    const x = a.x - a.dz * side * off, z = a.z + a.dx * side * off, key = Math.round(x / 40) + ',' + Math.round(z / 40);
    if (used.has(key)) continue;
    used.add(key); out.push([+x.toFixed(1), +z.toFixed(1)]);
  }
  return out;
}
function placeRamps(G) {
  /* 12 ramps on straight roads, spread over the map: at least 450 m apart, one area at a time */
  const areas = ['beach', 'downtown', 'ensanche', 'barrio', 'poligono', 'port', 'campus', 'hills', 'island', 'airport', 'ensanche', 'downtown', 'oldtown', 'park'];
  const out = [], taken = [];
  const mid = (e) => { const m = along(e.dense, e.len * 0.55); return [m.x, m.z]; };
  const cands = G.edges.filter((e) => !e.bridge && e.kind !== 'ring' && e.kind !== 'lane' && e.kind !== 'ronda' && e.len > 70).map((e) => {
    const a = e.pts[0], b = e.pts[e.pts.length - 1], straight = dist(a, b) / e.len, m = mid(e);
    return { e, straight, m, d: districtAt(m[0], m[1]) };
  }).filter((c) => c.straight > (c.e.len > 120 ? 0.985 : 0.97)).sort((p, q) => q.e.len - p.e.len);
  const free = (c, gap) => !taken.some((t) => dist(t, c.m) < gap);
  for (const area of areas) {
    if (out.length >= 12) break;
    const c = cands.find((q) => q.d === area && free(q, 450));
    if (!c) continue;
    taken.push(c.m);
    const m = along(c.e.dense, c.e.len * 0.55), lane = c.e.lanes >= 4 ? 3.5 : 0;
    out.push({ id: out.length, x: +(m.x + m.dz * lane).toFixed(1), z: +(m.z - m.dx * lane).toFixed(1), dir: +Math.atan2(m.dx, m.dz).toFixed(4), len: 16, h: 3.2, w: 8, district: c.d });
  }
  for (const c of cands) { if (out.length >= 12) break; if (!free(c, 450)) continue; taken.push(c.m); const m = along(c.e.dense, c.e.len * 0.55), lane = c.e.lanes >= 4 ? 3.5 : 0; out.push({ id: out.length, x: +(m.x + m.dz * lane).toFixed(1), z: +(m.z - m.dx * lane).toFixed(1), dir: +Math.atan2(m.dx, m.dz).toFixed(4), len: 16, h: 3.2, w: 8, district: c.d }); }
  return out;
}
/* time trials: checkpoints along named roads */
function routePts(G, names, opts = {}) {
  const pts = [];
  for (const nm of names) {
    const es = G.edges.filter((e) => e.name === nm);
    for (const e of es) for (const p of e.dense) pts.push(p);
  }
  return pts;
}
function placeTrials(G) {
  const pick = (path, every) => { const L = polyLen(path), out = []; for (let s = 0; s <= L; s += every) { const a = along(path, s); out.push([Math.round(a.x), Math.round(a.z)]); } const last = path[path.length - 1]; if (dist(out[out.length - 1], last) > every * 0.4) out.push([Math.round(last[0]), Math.round(last[1])]); return out; };
  const beach = pick([[-1335, 1150], [-1335, -1290], [-1380, -1600], [-1430, -1950], [-1455, -2300]], 300);
  const downtown = [[0, -1500], [0, -1860], [300, -1860], [300, -2280], [-300, -2280], [-300, -1580], [0, -1580]];
  const bridge = [[-1250, -150], [-1335, -150], [BRIDGE.x0 - 20, -150], [-2150, -150], [BRIDGE.x1 - 40, -150], [ISLAND.x, ISLAND.z - ISLAND.ring], [ISLAND.x - ISLAND.ring, ISLAND.z], [ISLAND.x, ISLAND.z + ISLAND.ring], [ISLAND.x + ISLAND.ring, ISLAND.z], [-2150, -150]].map((p) => p.map(Math.round));
  const sierraEdges = G.edges.filter((e) => e.name === 'Carretera de la Sierra');
  const up = sierraEdges.filter((e) => Math.min(...e.dense.map((p) => p[1])) < -900 || e.dense.some((p) => p[0] < 1300 && p[1] < -400));
  const climbPath = smoothPath([[930, -500], [1060, -540], [1240, -690], [1330, -930], [1520, -1010], [1620, -1240], [1830, -1330], [1960, -1170]], 9);
  const sierra = pick(climbPath, 260);
  const runway = [[1440, 1330], [1700, 1360], [1880, 1360], [2150, 1420], [2300, 1560], [2400, RUNWAY.z], [1800, RUNWAY.z], [1100, RUNWAY.z], [1300, 1620], [1600, 1500]];
  void up; void routePts;
  return [
    { id: 'beach7', name: 'Beach Run', pts: beach },
    { id: 'downtown7', name: 'Downtown Dash', pts: downtown },
    { id: 'bridge7', name: 'Bridge Sprint', pts: bridge },
    { id: 'sierra7', name: 'Sierra Climb', pts: sierra },
    { id: 'runway7', name: 'Runway Rush', pts: runway }
  ];
}

/* ---------- the whole plan ---------- */
let cached = null;
/* a plan built in the worker comes back as plain data: give the grid its methods back */
export function adoptPlan(p) { Object.setPrototypeOf(p.occ, Occ.prototype); cached = p; return p; }
export function makePlan(opts = {}) {
  if (cached && !opts.fresh) return cached;
  const t0 = Date.now();
  const R = rng(SEED);
  const raw = buildRoads(R);
  const G = buildGraph(raw);
  trimRoundabouts(G);
  roadProfiles(G);
  const F = makeHeightField(G);
  const occ = new Occ();
  const lots = placeLots(G, R, occ, F);
  const trees = placeTrees(G, R, occ, F, lots);
  const props = placeProps(G, R, occ, F);
  const notes = placeNotes(G, R);
  const ramps = placeRamps(G);
  const trials = placeTrials(G);
  for (const r of ramps) r.y = sampleHeight(F, r.x, r.z);
  cached = { seed: SEED, nodes: G.nodes, edges: G.edges, height: F, occ, lots, trees, props, notes, ramps, trials, ms: Date.now() - t0 };
  return cached;
}
/* friends' houses: the same lot for the same person and place, every time */
export function homeLot(plan, id, loc) {
  const want = loc === 'island' ? 'island' : loc;
  const pool = plan.lots.filter((l) => l.district === want && !l.industrial && l.h < 40);
  const list = pool.length ? pool : plan.lots;
  return list[hash32(id + ':' + loc) % list.length];
}
/* the day's seed crates: parks, hills, beach, port yards */
export function cratePoints(plan, seed, n = 10) {
  const R = rng('bloc-crates-7:' + seed), out = [];
  const zones = [[160, -540, 840, 350, 'park'], [1000, -2300, 2500, 700, 'hills'], [-1690, -1200, -1380, 1000, 'beach'], [-1880, 1100, -760, 2150, 'port'], [-650, 1360, 900, 2200, 'poligono'], [ISLAND.x - 250, ISLAND.z - 250, ISLAND.x + 250, ISLAND.z + 250, 'island']];
  let guard = 0;
  while (out.length < n && guard++ < 5000) {
    const z = zones[Math.floor(R() * zones.length)], x = lerp(z[0], z[2], R()), y = lerp(z[1], z[3], R());
    const o = plan.occ.get(x, y);
    if (districtAt(x, y) !== z[4] || isWater(x, y) || o === 5 || o === 2) continue;
    out.push({ x: +x.toFixed(1), z: +y.toFixed(1), y: sampleHeight(plan.height, x, y) });
  }
  return out;
}
export function groundAt(plan, x, z) { return sampleHeight(plan.height, x, z); }
