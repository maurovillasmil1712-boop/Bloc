/* Bloc City: an open-world drive between study sessions.
   An original sunny coastal city (no real game's names, maps or art), generated from a fixed seed
   so every student drives the same streets. Fuel comes from studying; the server checks rewards.
   Built with three.js, bundled with esbuild:  npx esbuild drive.src.js --bundle --format=esm --minify --outfile=drive.js */
import * as THREE from 'three';

THREE.ColorManagement.enabled = false;

/* ---------- the map ---------- */
const STEP = 80, ROAD = 14, GX0 = -1440, GX1 = 1120, GZ0 = -1440, GZ1 = 1440;
const BLVD = 1200, SEA = 1300, LAND = { x0: -1500, x1: SEA, z0: -1500, z1: 1500 };
const ISLAND = { x: 1900, z: -320, r: 300, ring: 220 }, BRIDGE = { z: -320, x0: BLVD, x1: 1680, w: 16 };
const PAL = {
  downtown: ['#8FB8D8', '#6E8FB0', '#A9C7DE', '#4F6E8E', '#C2D6E6', '#5D7B9D'],
  midtown: ['#E9E2D3', '#D7CFC0', '#C9D2DA', '#E3D5C1', '#BFC7CF', '#F0E6D2'],
  oldtown: ['#E8B07A', '#D98E5F', '#F2D7A6', '#C76B4A', '#EBC394', '#DDA27A'],
  campus: ['#C76B4A', '#B85C3D', '#D9886A', '#E2D5C3'],
  beach: ['#FFD6E0', '#BDE0FE', '#FFF1C1', '#C8F7C5', '#FFE0C7', '#E7D9FF'],
  port: ['#E5383B', '#3E9BD6', '#F28C28', '#1E9E6A', '#FFC300', '#8C3B72'],
  hills: ['#C9A27A', '#B08A5A', '#D9B48F'],
  island: ['#FFF8EC', '#FFE0C7', '#F2F5FA']
};
const GROUND = { downtown: '#B9BEC6', midtown: '#C6C7C1', oldtown: '#E6D2B5', campus: '#A9D18E', beach: '#F2DDB4', port: '#B9BEC4', hills: '#8DBF79', sand: '#F2D7A6', park: '#9CCB7F' };

function rngFrom(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function district(x, z) {
  if (x >= GX1) return 'sand';
  if (x > 640 && z > 560) return 'port';
  if (x > 640) return 'beach';
  if (Math.abs(x) < 400 && z > -880 && z < -80) return 'downtown';
  if (Math.abs(x) < 400 && z > 80 && z < 880) return 'campus';
  if (x < -400 && x > -1120 && Math.abs(z) < 720) return 'oldtown';
  if (z < -960 || x < -1120) return 'hills';
  return 'midtown';
}
function onIsland(x, z) { return Math.hypot(x - ISLAND.x, z - ISLAND.z) < ISLAND.r; }
function onBridge(x, z) { return x >= BRIDGE.x0 - 10 && x <= BRIDGE.x1 + 10 && Math.abs(z - BRIDGE.z) < BRIDGE.w / 2 + 1; }
function isLand(x, z) { return (x > LAND.x0 && x < LAND.x1 && z > LAND.z0 && z < LAND.z1) || onIsland(x, z) || onBridge(x, z); }
function onRoad(x, z) {
  if (onBridge(x, z)) return true;
  if (onIsland(x, z)) { const d = Math.hypot(x - ISLAND.x, z - ISLAND.z); return Math.abs(d - ISLAND.ring) < 8 || (Math.abs(x - ISLAND.x) < 6 && d < ISLAND.ring) || (Math.abs(z - ISLAND.z) < 6 && d < ISLAND.ring); }
  if (Math.abs(x - BLVD) < 8 && z > GZ0 - 8 && z < GZ1 + 8) return true;
  if (z < GZ0 - ROAD / 2 || z > GZ1 + ROAD / 2 || x < GX0 - ROAD / 2) return false;
  const mx = ((x % STEP) + STEP) % STEP, mz = ((z % STEP) + STEP) % STEP;
  const nearV = (mx < ROAD / 2 || mx > STEP - ROAD / 2) && x <= GX1 + ROAD / 2;
  const nearH = (mz < ROAD / 2 || mz > STEP - ROAD / 2) && x <= BLVD;
  return nearV || nearH;
}

/* everything static in the city, from one seed */
function buildCity() {
  const R = rngFrom('bloc-city-1');
  const boxes = [], trees = [], blocks = [], ramps = [];
  const nx = Math.round((GX1 - GX0) / STEP), nz = Math.round((GZ1 - GZ0) / STEP);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x0 = GX0 + i * STEP + ROAD / 2, z0 = GZ0 + j * STEP + ROAD / 2, S = STEP - ROAD, cx = x0 + S / 2, cz = z0 + S / 2;
    let d = district(cx, cz);
    if (d === 'sand') continue;
    const park = d !== 'downtown' && d !== 'port' && R() < (d === 'hills' ? 0.55 : d === 'campus' ? 0.3 : 0.08);
    const b = { i, j, x0, z0, cx, cz, d: park && d !== 'hills' ? 'park' : d, district: d };
    blocks.push(b);
    const add = (x, z, w, dd, h, pal, kind) => boxes.push({ x, z, w, d: dd, h, c: pal[Math.floor(R() * pal.length)], kind: kind || d });
    if (park) {
      const n = d === 'hills' ? 26 : 14;
      for (let k = 0; k < n; k++) trees.push({ x: x0 + 4 + R() * (S - 8), z: z0 + 4 + R() * (S - 8), t: d === 'hills' ? 'pine' : R() < 0.5 ? 'round' : 'pine', s: 0.8 + R() * 0.6 });
      if (d === 'hills' && R() < 0.35) add(cx + (R() - 0.5) * 20, cz + (R() - 0.5) * 20, 8, 7, 5, PAL.hills, 'cabin');
      continue;
    }
    if (d === 'downtown') {
      const n = 1 + Math.floor(R() * 3);
      if (n === 1) add(cx, cz, 30 + R() * 16, 30 + R() * 16, 60 + R() * 110, PAL.downtown);
      else for (let k = 0; k < n; k++) { const q = k % 2, r2 = Math.floor(k / 2); add(x0 + 6 + q * 32 + 12, z0 + 6 + r2 * 32 + 12 + (n === 2 ? 10 : 0), 20 + R() * 6, 20 + R() * 6, 40 + R() * 110, PAL.downtown); }
    } else if (d === 'midtown') {
      for (let k = 0; k < 4; k++) { const q = k % 2, r2 = Math.floor(k / 2); if (R() < 0.15) continue; add(x0 + 4 + q * 31 + 14, z0 + 4 + r2 * 31 + 14, 22 + R() * 6, 22 + R() * 6, 12 + R() * 30, PAL.midtown); }
    } else if (d === 'oldtown') {
      /* perimeter blocks with a courtyard, like the centre of Madrid */
      const n = 4, w = S / n;
      for (let k = 0; k < n; k++) {
        add(x0 + w * k + w / 2, z0 + 6, w - 0.6, 12, 9 + R() * 9, PAL.oldtown);
        add(x0 + w * k + w / 2, z0 + S - 6, w - 0.6, 12, 9 + R() * 9, PAL.oldtown);
      }
      for (let k = 1; k < n - 1; k++) {
        add(x0 + 6, z0 + w * k + w / 2, 12, w - 0.6, 9 + R() * 9, PAL.oldtown);
        add(x0 + S - 6, z0 + w * k + w / 2, 12, w - 0.6, 9 + R() * 9, PAL.oldtown);
      }
      if (R() < 0.5) trees.push({ x: cx, z: cz, t: 'round', s: 1.1 });
    } else if (d === 'campus') {
      add(cx, cz - 12, 50, 22, 10 + R() * 8, PAL.campus);
      if (R() < 0.6) add(cx - 14, cz + 18, 22, 18, 9 + R() * 5, PAL.campus);
      for (let k = 0; k < 4; k++) trees.push({ x: x0 + 6 + R() * (S - 12), z: z0 + S - 6 - R() * 10, t: 'round', s: 0.9 + R() * 0.4 });
    } else if (d === 'beach') {
      for (let k = 0; k < 2; k++) if (R() < 0.8) add(x0 + 12 + k * 34 + R() * 6, cz + (R() - 0.5) * 30, 12 + R() * 4, 10 + R() * 4, 4 + R() * 4, PAL.beach);
      for (let k = 0; k < 5; k++) trees.push({ x: x0 + 4 + R() * (S - 8), z: z0 + 4 + R() * (S - 8), t: 'palm', s: 0.8 + R() * 0.5 });
    } else if (d === 'port') {
      for (let r2 = 0; r2 < 5; r2++) for (let k = 0; k < 4; k++) {
        if (R() < 0.25) continue;
        const stack = 1 + Math.floor(R() * 3);
        add(x0 + 9 + k * 15, z0 + 7 + r2 * 12, 13, 2.6, 2.7 * stack, PAL.port, 'box');
      }
    } else if (d === 'hills') {
      for (let k = 0; k < 10; k++) trees.push({ x: x0 + 4 + R() * (S - 8), z: z0 + 4 + R() * (S - 8), t: 'pine', s: 0.8 + R() * 0.6 });
      add(cx, cz, 10, 8, 5, PAL.hills, 'cabin');
    }
  }
  /* palms along the beach boulevard and the bridge approach */
  for (let z = GZ0; z <= GZ1; z += 26) { trees.push({ x: BLVD - 14, z, t: 'palm', s: 1.1 }); trees.push({ x: BLVD + 16, z: z + 13, t: 'palm', s: 1 }); }
  /* the island: villas inside the ring road, palms on the shore */
  const IR = rngFrom('bloc-island');
  for (let k = 0; k < 9; k++) {
    const a = k / 9 * Math.PI * 2 + 0.2, rr = 120 + IR() * 40;
    const x = ISLAND.x + Math.cos(a) * rr, z = ISLAND.z + Math.sin(a) * rr;
    if (Math.abs(x - ISLAND.x) < 14 || Math.abs(z - ISLAND.z) < 14) continue;
    boxes.push({ x, z, w: 16, d: 14, h: 7 + IR() * 5, c: PAL.island[k % 3], kind: 'villa' });
  }
  for (let k = 0; k < 70; k++) { const a = IR() * Math.PI * 2, rr = 244 + IR() * 44; trees.push({ x: ISLAND.x + Math.cos(a) * rr, z: ISLAND.z + Math.sin(a) * rr, t: 'palm', s: 0.9 + IR() * 0.5 }); }
  for (let k = 0; k < 16; k++) { const a = IR() * Math.PI * 2, rr = 40 + IR() * 50; trees.push({ x: ISLAND.x + Math.cos(a) * rr, z: ISLAND.z + Math.sin(a) * rr, t: 'palm', s: 1 }); }
  /* stunt ramps, mid-block on long straights */
  [[0, -440, 0], [-680, 0, Math.PI / 2], [BLVD, 520, Math.PI], [440, 1040, -Math.PI / 2], [-1040, -1160, 0], [1460, BRIDGE.z, Math.PI / 2]].forEach((r, id) => ramps.push({ id, x: r[0], z: r[1], dir: r[2], len: 16, h: 3.2, w: 8 }));
  /* trees never sit on a road */
  const T = trees.filter((t) => !onRoad(t.x, t.z) && isLand(t.x, t.z));
  return { boxes, trees: T, blocks, ramps };
}

/* sticky notes: the same 160 places for everyone, on road edges between crossings */
function notePoints(n) {
  const R = rngFrom('bloc-notes-1'), out = [];
  while (out.length < n) {
    const vertical = R() < 0.5;
    const line = Math.round((vertical ? GX0 : GZ0) / STEP + R() * ((vertical ? GX1 - GX0 : GZ1 - GZ0) / STEP)) * STEP;
    const along = (Math.floor(((vertical ? GZ0 : GX0) + R() * ((vertical ? GZ1 - GZ0 : GX1 - GX0))) / STEP) + 0.5) * STEP;
    const side = R() < 0.5 ? -3.5 : 3.5;
    const x = vertical ? line + side : along, z = vertical ? along : line + side;
    if (district(x, z) === 'sand') continue;
    out.push({ x, z });
  }
  return out;
}
/* seed crates move every day */
function cratePoints(n, seed, blocks) {
  const R = rngFrom('bloc-crates:' + seed), out = [], pool = blocks.filter((b) => b.d === 'park' || b.district === 'hills' || b.district === 'beach');
  for (let k = 0; k < n; k++) {
    const b = pool[Math.floor(R() * pool.length)];
    out.push({ x: b.x0 - ROAD / 2 + 3 + R() * 3, z: b.cz + (R() - 0.5) * 40 });
  }
  return out;
}
const LOC_DISTRICT = { oldtown: 'oldtown', beach: 'beach', campus: 'campus', hills: 'hills', downtown: 'downtown', island: 'island' };
function homePoint(id, loc, blocks) {
  const h = hashStr(id + ':' + loc);
  if (loc === 'island') { const a = (h % 360) * Math.PI / 180; return { x: ISLAND.x + Math.cos(a) * (ISLAND.ring + 14), z: ISLAND.z + Math.sin(a) * (ISLAND.ring + 14) }; }
  const want = LOC_DISTRICT[loc] || 'oldtown';
  const pool = blocks.filter((b) => b.district === want);
  const b = pool.length ? pool[h % pool.length] : blocks[h % blocks.length];
  return { x: b.cx, z: b.z0 - 1.5 };
}

/* ---------- time of day: the real clock in Madrid, or a fixed sunset ---------- */
const SKY_KEYS = {
  night: { top: '#0B1030', hor: '#26305A', sun: '#5A6FB8', amb: 0.42, sunI: 0.35 },
  dawn: { top: '#2E3F78', hor: '#F2A36C', sun: '#FFB27A', amb: 0.62, sunI: 0.8 },
  morning: { top: '#4B8FD9', hor: '#CFE8F8', sun: '#FFF1D6', amb: 0.9, sunI: 1.25 },
  day: { top: '#3A88DB', hor: '#D9EEFA', sun: '#FFFFFF', amb: 1, sunI: 1.4 },
  afternoon: { top: '#4C7CC0', hor: '#F8D7A6', sun: '#FFE2B0', amb: 0.92, sunI: 1.3 },
  golden: { top: '#5A4A8C', hor: '#FF9C5B', sun: '#FFB06A', amb: 0.78, sunI: 1.25 },
  dusk: { top: '#28296B', hor: '#E2477D', sun: '#FF7A6A', amb: 0.6, sunI: 0.75 }
};
function sunTimes(now) {
  const d = new Date(now), doy = Math.floor((now - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400000);
  const sunset = (19 * 60 + 50 + 125 * Math.sin(2 * Math.PI * (doy - 80) / 365)) / 60;
  const m = d.getMonth(), noon = m >= 3 && m <= 9 ? 14.2 : 13.2;
  return { sunset, sunrise: 2 * noon - sunset, noon };
}
function hexC(h) { return new THREE.Color(h); }
function skyAt(hour, mode, now) {
  let keys;
  if (mode === 'sunset') return mixSky(SKY_KEYS.golden, SKY_KEYS.dusk, 0.3, 0.05, 0.98);
  if (mode === 'night') return mixSky(SKY_KEYS.night, SKY_KEYS.night, 0, -0.6);
  const t = sunTimes(now), sr = t.sunrise, ss = t.sunset;
  keys = [[0, 'night'], [sr - 1, 'night'], [sr - 0.2, 'dawn'], [sr + 0.8, 'morning'], [t.noon, 'day'], [ss - 1.6, 'afternoon'], [ss - 0.45, 'golden'], [ss + 0.3, 'dusk'], [ss + 1.1, 'night'], [24, 'night']];
  let i = 0;
  while (i < keys.length - 2 && hour >= keys[i + 1][0]) i++;
  const a = keys[i], b = keys[i + 1], f = Math.max(0, Math.min(1, (hour - a[0]) / Math.max(0.01, b[0] - a[0])));
  const e = Math.sin(Math.PI * Math.max(0, Math.min(1, (hour - sr) / (ss - sr))));
  const elev = hour < sr || hour > ss ? -0.35 : 0.06 + e * 0.75;
  return mixSky(SKY_KEYS[a[1]], SKY_KEYS[b[1]], f, elev, (hour - sr) / (ss - sr));
}
function mixSky(A, B, f, elev, along) {
  const top = hexC(A.top).lerp(hexC(B.top), f), hor = hexC(A.hor).lerp(hexC(B.hor), f), sun = hexC(A.sun).lerp(hexC(B.sun), f);
  const amb = A.amb + (B.amb - A.amb) * f, sunI = A.sunI + (B.sunI - A.sunI) * f;
  /* the sun crosses from the hills (-x) to set over the sea (+x) */
  const az = along == null ? 0.9 : Math.max(-0.2, Math.min(1.2, along));
  const ang = Math.PI * (1 - az);
  const dir = new THREE.Vector3(Math.cos(ang) * Math.cos(Math.max(elev, -0.3)), Math.sin(elev), -0.35).normalize();
  const night = Math.max(0, Math.min(1, (0.08 - elev) / 0.3));
  return { top, hor, sun, amb, sunI, dir, night, elev };
}

/* ---------- shaders ---------- */
const buildingVS = `
  varying vec3 vCol; varying vec3 vPos; varying vec3 vNrm; varying float vDepth; varying float vSeed;
  void main() {
    #ifdef USE_INSTANCING_COLOR
      vCol = instanceColor;
    #else
      vCol = vec3(0.85);
    #endif
    mat4 m = modelMatrix * instanceMatrix;
    vec4 wp = m * vec4(position, 1.0);
    vPos = wp.xyz;
    vNrm = normalize(mat3(m) * normal);
    vSeed = fract(sin(dot(vec2(instanceMatrix[3][0], instanceMatrix[3][2]), vec2(12.9898, 78.233))) * 43758.5453);
    vec4 mv = viewMatrix * wp;
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const buildingFS = `
  uniform vec3 sunDir; uniform vec3 sunCol; uniform vec3 skyCol; uniform vec3 gndCol; uniform vec3 fogCol;
  uniform float fogNear; uniform float fogFar; uniform float night; uniform float sunI; uniform float amb;
  varying vec3 vCol; varying vec3 vPos; varying vec3 vNrm; varying float vDepth; varying float vSeed;
  float h21(vec2 p) { p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
  void main() {
    vec3 n = normalize(vNrm);
    float side = 1.0 - step(0.5, abs(n.y));
    float u = abs(n.x) > 0.5 ? vPos.z : vPos.x;
    vec2 cell = vec2(u / 3.4, vPos.y / 3.6);
    vec2 f = fract(cell); vec2 id = floor(cell);
    float tall = step(3.0, vPos.y);
    float win = step(0.2, f.x) * step(f.x, 0.8) * step(0.3, f.y) * step(f.y, 0.82) * step(1.4, vPos.y) * side;
    float lit = step(0.5, h21(id + floor(vSeed * 97.0) * 7.0));
    vec3 base = vCol;
    vec3 glass = mix(base * 0.5, skyCol, 0.4);
    vec3 col = mix(base, glass, win * 0.85);
    float diff = max(dot(n, normalize(sunDir)), 0.0);
    vec3 ambient = mix(gndCol, skyCol, n.y * 0.5 + 0.5);
    col *= ambient * (0.55 * amb) + sunCol * diff * 0.62 * sunI + 0.18;
    col *= mix(1.0, 0.9, step(0.5, n.y));
    col += win * lit * night * vec3(1.0, 0.8, 0.48) * 0.95;
    float fog = smoothstep(fogNear, fogFar, vDepth);
    gl_FragColor = vec4(mix(col, fogCol, fog), 1.0);
  }`;
const skyVS = `varying vec3 vDir; void main() { vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;
const skyFS = `
  uniform vec3 top; uniform vec3 hor; uniform vec3 sunCol; uniform vec3 sunDir; uniform float night;
  varying vec3 vDir;
  float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec3 d = normalize(vDir);
    float t = pow(clamp(d.y, 0.0, 1.0), 0.55);
    vec3 col = mix(hor, top, t);
    float s = max(dot(d, normalize(sunDir)), 0.0);
    col += sunCol * (pow(s, 900.0) * 1.4 + pow(s, 12.0) * 0.32) * (1.0 - night * 0.6);
    if (d.y < 0.0) col = mix(hor, hor * 0.85, clamp(-d.y * 4.0, 0.0, 1.0));
    vec2 g = floor(d.xz / (d.y + 0.25) * 140.0);
    float star = step(0.9975, h21(g)) * night * smoothstep(0.05, 0.3, d.y);
    col += vec3(star);
    gl_FragColor = vec4(col, 1.0);
  }`;
const waterVS = `varying vec3 vPos; varying float vDepth; void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vPos = wp.xyz; vec4 mv = viewMatrix * wp; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`;
const waterFS = `
  uniform vec3 deep; uniform vec3 shallow; uniform vec3 sunCol; uniform vec3 sunDir; uniform vec3 fogCol; uniform float fogNear; uniform float fogFar; uniform float time; uniform vec3 cam;
  varying vec3 vPos; varying float vDepth;
  void main() {
    float w = sin(vPos.x * 0.05 + time * 0.9) * 0.5 + sin(vPos.z * 0.07 - time * 1.1) * 0.5 + sin((vPos.x + vPos.z) * 0.13 + time * 1.7) * 0.3;
    vec3 col = mix(deep, shallow, 0.45 + w * 0.12);
    vec3 v = normalize(cam - vPos);
    vec3 r = reflect(-v, vec3(0.0, 1.0, 0.0) + vec3(w * 0.04, 0.0, w * 0.03));
    float spec = pow(max(dot(r, normalize(sunDir)), 0.0), 60.0);
    col += sunCol * spec * 0.8;
    float fog = smoothstep(fogNear, fogFar * 1.4, vDepth);
    gl_FragColor = vec4(mix(col, fogCol, fog), 1.0);
  }`;

/* ---------- small helpers ---------- */
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}
function boxGeo() { const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0); return g; }
function stripGeo(rects) {
  /* rects: [x0, z0, x1, z1, vertical]; v runs along the road, one texture repeat per block */
  const pos = [], uv = [], idx = [];
  rects.forEach((r, k) => {
    const [x0, z0, x1, z1, vert] = r, y = 0.03, base = k * 4;
    pos.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1);
    if (vert) uv.push(0, z0 / STEP, 1, z0 / STEP, 1, z1 / STEP, 0, z1 / STEP);
    else uv.push(0, x0 / STEP, 0, x1 / STEP, 1, x1 / STEP, 1, x0 / STEP);
    idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function frondGeo() {
  const pos = [], idx = [];
  for (let k = 0; k < 7; k++) {
    const a = k / 7 * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), b = pos.length / 3;
    const L = 3.4, W = 0.7;
    pos.push(0, 0, 0, ca * L * 0.5 - sa * W, -0.3, sa * L * 0.5 + ca * W, ca * L, -1.6, sa * L, ca * L * 0.5 + sa * W, -0.3, sa * L * 0.5 - ca * W);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function rampGeo(len, h, w) {
  const g = new THREE.BufferGeometry();
  const L = len / 2, W = w / 2;
  const p = [-W, 0, -L, W, 0, -L, W, h, L, -W, h, L, -W, 0, L, W, 0, L];
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setIndex([0, 2, 1, 0, 3, 2, 3, 5, 2, 3, 4, 5, 0, 1, 5, 0, 5, 4, 0, 4, 3, 1, 2, 5]);
  g.computeVertexNormals();
  return g;
}
function fmt(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function fmtMs(ms) { const s = ms / 1000, m = Math.floor(s / 60); return m + ':' + (s - m * 60).toFixed(2).padStart(5, '0'); }
function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } return v; }

const CSS = `
.bc-root{position:fixed;inset:0;z-index:2147483000;background:#0B1030;color:#fff;font-family:inherit;user-select:none;-webkit-user-select:none;touch-action:none;overflow:hidden}
.bc-root canvas.bc-gl{position:absolute;inset:0;width:100%;height:100%;display:block}
.bc-top{position:absolute;left:12px;right:12px;top:calc(10px + env(safe-area-inset-top,0px));display:flex;justify-content:space-between;align-items:flex-start;gap:10px;pointer-events:none}
.bc-panel{background:rgba(17,19,24,.62);border-radius:12px;padding:8px 12px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);pointer-events:auto}
.bc-fuel b{display:block;font-size:20px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.bc-fuel span{font-size:12px;opacity:.75}
.bc-bar{height:3px;background:rgba(255,255,255,.2);margin-top:5px;border-radius:2px;overflow:hidden}.bc-bar i{display:block;height:100%;background:#FFE14D}
.bc-btns{display:flex;gap:6px;pointer-events:auto}
.bc-btn{appearance:none;border:0;border-radius:10px;background:rgba(17,19,24,.62);color:#fff;font:inherit;font-weight:700;font-size:13px;height:38px;min-width:38px;padding:0 12px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);cursor:pointer}
.bc-btn.x{background:#FFE14D;color:#191D29}
.bc-mini{position:absolute;right:12px;top:calc(58px + env(safe-area-inset-top,0px));width:150px;height:150px;border-radius:50%;overflow:hidden;box-shadow:0 0 0 2px rgba(255,255,255,.85);background:#26305A}
.bc-speed{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(18px + env(safe-area-inset-bottom,0px));text-align:center;pointer-events:none;text-shadow:0 1px 6px rgba(0,0,0,.45)}
.bc-speed b{display:block;font-size:40px;line-height:1;font-weight:800;font-variant-numeric:tabular-nums}.bc-speed span{font-size:12px;opacity:.8}
.bc-msg{position:absolute;left:50%;top:22%;transform:translateX(-50%);text-align:center;pointer-events:none;font-weight:800;font-size:22px;text-shadow:0 2px 10px rgba(0,0,0,.5);transition:opacity .25s;white-space:nowrap}
.bc-msg small{display:block;font-size:14px;font-weight:600;opacity:.9}
.bc-trial{position:absolute;left:50%;top:calc(12px + env(safe-area-inset-top,0px));transform:translateX(-50%);font-size:22px;font-weight:800;font-variant-numeric:tabular-nums;pointer-events:none;text-shadow:0 2px 8px rgba(0,0,0,.5)}
.bc-label{position:absolute;transform:translate(-50%,-100%);padding:3px 8px;border-radius:8px;background:rgba(17,19,24,.72);font-size:12px;font-weight:700;white-space:nowrap;pointer-events:none}
.bc-label.home{background:#FFE14D;color:#191D29}
.bc-touch{position:absolute;inset:auto 0 calc(14px + env(safe-area-inset-bottom,0px)) 0;display:none;justify-content:space-between;padding:0 14px;pointer-events:none}
.bc-touch.on{display:flex}
.bc-pad{display:flex;gap:10px;pointer-events:auto}
.bc-key{width:74px;height:74px;border-radius:18px;border:0;background:rgba(255,255,255,.2);color:#fff;font-size:26px;font-weight:800;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);touch-action:none}
.bc-key.on{background:rgba(255,225,77,.85);color:#191D29}
.bc-key.small{width:56px;font-size:13px}
.bc-map{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(11,16,48,.86);pointer-events:auto}
.bc-map.on{display:flex}.bc-map canvas{max-width:94vw;max-height:84vh;border-radius:14px}
.bc-end{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(11,16,48,.7);pointer-events:auto}
.bc-card{background:#fff;color:#191D29;border-radius:16px;padding:22px 22px 18px;width:min(360px,88vw)}
.bc-card h2{margin:0 0 4px;font-size:24px;font-weight:800}.bc-card p{margin:0 0 14px;color:#535A69}
.bc-card ul{list-style:none;margin:0 0 16px;padding:0}.bc-card li{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #E2E5EA;font-size:15px}
.bc-card button{width:100%;height:46px;border:0;border-radius:12px;background:#191D29;color:#fff;font:inherit;font-weight:700;font-size:16px}
.bc-fade{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;transition:opacity .35s}
.bc-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px}
@media (max-width:640px){.bc-mini{width:110px;height:110px}.bc-speed b{font-size:32px}.bc-speed{bottom:calc(104px + env(safe-area-inset-bottom,0px))}.bc-btn{height:34px;min-width:34px;padding:0 9px;font-size:12px}}
`;

/* ---------- the game ---------- */
export function start(opts) {
  const data = opts.data, cat = data.cat || {}, rules = cat.rules || { noteN: 160, crateN: 10 };
  const car0 = data.car || { id: 'hatch', top: 33, acc: 13, turn: 1 };
  const root = document.createElement('div');
  root.className = 'bc-root';
  root.innerHTML = '<style>' + CSS + '</style><div class="bc-loading">Building Bloc City…</div>';
  document.body.appendChild(root);
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  let ended = false, raf = 0;
  const result = { secs: 0, notes: [], crates: [], jumps: [], visits: [], trial: null };
  function finish(reason) {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    detach();
    audioStop();
    result.secs = Math.round(driven);
    try { opts.onEnd && opts.onEnd(result); } catch (e) { /* the app handles its own errors */ }
    showEnd(reason);
  }
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: (window.devicePixelRatio || 1) < 1.6, powerPreference: 'high-performance' });
  } catch (e) {
    root.innerHTML = '<style>' + CSS + '</style><div class="bc-end"><div class="bc-card"><h2>Bloc City can’t start</h2><p>This browser has 3D graphics (WebGL) turned off.</p><button type="button">Back to Bloc</button></div></div>';
    root.querySelector('button').onclick = () => { root.remove(); document.body.style.overflow = prevOverflow; };
    ended = true;
    try { opts.onEnd && opts.onEnd(result); } catch (e2) { /* ignore */ }
    return { stop() {} };
  }
  const coarse = matchMedia('(pointer: coarse)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.domElement.className = 'bc-gl';
  root.insertBefore(renderer.domElement, root.firstChild.nextSibling);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.5, 5000);
  const FOG_NEAR = coarse ? 220 : 320, FOG_FAR = coarse ? 1100 : 1500;
  scene.fog = new THREE.Fog(0xD9EEFA, FOG_NEAR, FOG_FAR);

  /* lights */
  const hemi = new THREE.HemisphereLight(0xD9EEFA, 0x8A9A7A, 1.6);
  const sunL = new THREE.DirectionalLight(0xFFFFFF, 2.2);
  /* a soft light from the camera, so the car you follow never turns into a dark block */
  const fill = new THREE.DirectionalLight(0xFFFFFF, 1.2);
  scene.add(hemi, sunL, sunL.target, fill, fill.target);

  /* sky */
  const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunCol: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, night: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), new THREE.ShaderMaterial({ uniforms: skyU, vertexShader: skyVS, fragmentShader: skyFS, side: THREE.BackSide, depthWrite: false, fog: false }));
  sky.frustumCulled = false; sky.renderOrder = -1;
  scene.add(sky);

  /* sea */
  const waterU = { deep: { value: hexC('#1F78A8') }, shallow: { value: hexC('#52B9D8') }, sunCol: skyU.sunCol, sunDir: skyU.sunDir, fogCol: { value: new THREE.Color() }, fogNear: { value: FOG_NEAR }, fogFar: { value: FOG_FAR }, time: { value: 0 }, cam: { value: new THREE.Vector3() } };
  const water = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000), new THREE.ShaderMaterial({ uniforms: waterU, vertexShader: waterVS, fragmentShader: waterFS }));
  water.rotation.x = -Math.PI / 2; water.position.y = -0.6;
  scene.add(water);

  const city = buildCity();

  /* ground: one texture for the whole land, a block per pixel group */
  const GW = LAND.x1 - LAND.x0, GH = LAND.z1 - LAND.z0;
  const groundTex = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#9CCB7F'; g.fillRect(0, 0, w, h);
    const sx = w / GW, sz = h / GH;
    city.blocks.forEach((b) => { g.fillStyle = GROUND[b.d] || GROUND.midtown; g.fillRect((b.x0 - LAND.x0) * sx, (b.z0 - LAND.z0) * sz, (STEP - ROAD) * sx + 0.5, (STEP - ROAD) * sz + 0.5); });
    g.fillStyle = GROUND.sand; g.fillRect((GX1 - LAND.x0) * sx, 0, (SEA - GX1) * sx, h);
    g.fillStyle = '#EAD3A6'; g.fillRect((SEA - 18 - LAND.x0) * sx, 0, 18 * sx, h);
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(GW, GH), new THREE.MeshLambertMaterial({ map: groundTex }));
  ground.rotation.x = -Math.PI / 2; ground.position.set((LAND.x0 + LAND.x1) / 2, 0, (LAND.z0 + LAND.z1) / 2);
  scene.add(ground);
  const islandGround = new THREE.Mesh(new THREE.CircleGeometry(ISLAND.r, 64), new THREE.MeshLambertMaterial({ color: '#F2D7A6' }));
  islandGround.rotation.x = -Math.PI / 2; islandGround.position.set(ISLAND.x, 0.005, ISLAND.z);
  const islandGrass = new THREE.Mesh(new THREE.CircleGeometry(ISLAND.ring - 10, 64), new THREE.MeshLambertMaterial({ color: '#9CCB7F' }));
  islandGrass.rotation.x = -Math.PI / 2; islandGrass.position.set(ISLAND.x, 0.01, ISLAND.z);
  const pond = new THREE.Mesh(new THREE.CircleGeometry(36, 40), new THREE.MeshLambertMaterial({ color: '#57B6C9' }));
  pond.rotation.x = -Math.PI / 2; pond.position.set(ISLAND.x + 60, 0.02, ISLAND.z + 60);
  scene.add(islandGround, islandGrass, pond);

  /* roads */
  const roadTex = canvasTex(64, 256, (g, w, h) => {
    g.fillStyle = '#4A4F5C'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 400; k++) { g.fillStyle = 'rgba(255,255,255,' + (Math.random() * 0.05) + ')'; g.fillRect(Math.random() * w, Math.random() * h, 1, 1); }
    g.fillStyle = '#E9ECEF'; g.fillRect(2, 0, 2, h); g.fillRect(w - 4, 0, 2, h);
    g.fillStyle = '#FFE14D';
    for (let y = 40; y < h - 40; y += 34) g.fillRect(w / 2 - 1.5, y, 3, 18);
  });
  roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
  const rects = [];
  for (let x = GX0; x <= GX1; x += STEP) rects.push([x - ROAD / 2, GZ0 - ROAD / 2, x + ROAD / 2, GZ1 + ROAD / 2, true]);
  for (let z = GZ0; z <= GZ1; z += STEP) rects.push([GX0 - ROAD / 2, z - ROAD / 2, BLVD, z + ROAD / 2, false]);
  rects.push([BLVD - 8, GZ0 - ROAD / 2, BLVD + 8, GZ1 + ROAD / 2, true]);
  const roads = new THREE.Mesh(stripGeo(rects), new THREE.MeshLambertMaterial({ map: roadTex, polygonOffset: true, polygonOffsetFactor: -1 }));
  scene.add(roads);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(BRIDGE.x1 - BRIDGE.x0 + 20, 1.2, BRIDGE.w), new THREE.MeshLambertMaterial({ color: '#5B606C' }));
  deck.position.set((BRIDGE.x0 + BRIDGE.x1) / 2, -0.58, BRIDGE.z);
  const rails = new THREE.Mesh(new THREE.BoxGeometry(BRIDGE.x1 - BRIDGE.x0, 1, 0.5), new THREE.MeshLambertMaterial({ color: '#E9ECEF' }));
  rails.position.set((BRIDGE.x0 + BRIDGE.x1) / 2, 0.5, BRIDGE.z - BRIDGE.w / 2);
  const rails2 = rails.clone(); rails2.position.z = BRIDGE.z + BRIDGE.w / 2;
  const ring = new THREE.Mesh(new THREE.RingGeometry(ISLAND.ring - 7, ISLAND.ring + 7, 96), new THREE.MeshLambertMaterial({ color: '#4A4F5C' }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(ISLAND.x, 0.03, ISLAND.z);
  const spokes = new THREE.Mesh(stripGeo([[ISLAND.x - 6, ISLAND.z - ISLAND.ring, ISLAND.x + 6, ISLAND.z + ISLAND.ring, true], [ISLAND.x - ISLAND.ring, ISLAND.z - 6, ISLAND.x + ISLAND.ring, ISLAND.z + 6, false]]), roads.material);
  spokes.position.y = 0.002;
  scene.add(deck, rails, rails2, ring, spokes);

  /* buildings: one draw call */
  const bU = { sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() }, skyCol: { value: new THREE.Color() }, gndCol: { value: hexC('#8A9A7A') }, fogCol: { value: new THREE.Color() }, fogNear: { value: FOG_NEAR }, fogFar: { value: FOG_FAR }, night: { value: 0 }, sunI: { value: 1 }, amb: { value: 1 } };
  const bMesh = new THREE.InstancedMesh(boxGeo(), new THREE.ShaderMaterial({ uniforms: bU, vertexShader: buildingVS, fragmentShader: buildingFS }), city.boxes.length);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3(), C = new THREE.Color();
  city.boxes.forEach((b, i) => { M.compose(V.set(b.x, 0, b.z), Q.identity(), SC.set(b.w, b.h, b.d)); bMesh.setMatrixAt(i, M); bMesh.setColorAt(i, C.set(b.c)); });
  bMesh.instanceMatrix.needsUpdate = true; if (bMesh.instanceColor) bMesh.instanceColor.needsUpdate = true;
  bMesh.frustumCulled = false;
  scene.add(bMesh);

  /* trees: trunks, palm fronds, pine cones, round crowns */
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 1, 5); trunkGeo.translate(0, 0.5, 0);
  const coneGeo = new THREE.ConeGeometry(1, 1, 7); coneGeo.translate(0, 0.5, 0);
  const crownGeo = new THREE.IcosahedronGeometry(1, 0);
  const palms = city.trees.filter((t) => t.t === 'palm'), pines = city.trees.filter((t) => t.t === 'pine'), rounds = city.trees.filter((t) => t.t === 'round');
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: '#8D6E4C' }), city.trees.length);
  const fronds = new THREE.InstancedMesh(frondGeo(), new THREE.MeshLambertMaterial({ color: '#3E9F4A', side: THREE.DoubleSide }), palms.length);
  const cones = new THREE.InstancedMesh(coneGeo, new THREE.MeshLambertMaterial({ color: '#2E7D3A' }), pines.length);
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshLambertMaterial({ color: '#4E9A58', flatShading: true }), rounds.length);
  let ti = 0;
  palms.forEach((t, i) => {
    const h = 7.5 * t.s;
    Q.setFromAxisAngle(V.set(1, 0, 0), 0.08);
    M.compose(V.set(t.x, 0, t.z), Q, SC.set(t.s, h, t.s)); trunks.setMatrixAt(ti++, M);
    Q.setFromAxisAngle(V.set(0, 1, 0), (i * 1.7) % 6.28);
    M.compose(V.set(t.x, h - 0.2, t.z + h * 0.08), Q, SC.set(t.s, t.s, t.s)); fronds.setMatrixAt(i, M);
  });
  pines.forEach((t, i) => {
    Q.identity();
    M.compose(V.set(t.x, 0, t.z), Q, SC.set(t.s * 0.8, 2 * t.s, t.s * 0.8)); trunks.setMatrixAt(ti++, M);
    M.compose(V.set(t.x, 1.4 * t.s, t.z), Q, SC.set(2.6 * t.s, 7.5 * t.s, 2.6 * t.s)); cones.setMatrixAt(i, M);
  });
  rounds.forEach((t, i) => {
    Q.identity();
    M.compose(V.set(t.x, 0, t.z), Q, SC.set(t.s, 3 * t.s, t.s)); trunks.setMatrixAt(ti++, M);
    M.compose(V.set(t.x, 4.2 * t.s, t.z), Q, SC.set(3.2 * t.s, 2.8 * t.s, 3.2 * t.s)); crowns.setMatrixAt(i, M);
  });
  [trunks, fronds, cones, crowns].forEach((m) => { m.instanceMatrix.needsUpdate = true; m.frustumCulled = false; scene.add(m); });

  /* ramps */
  const rampMat = new THREE.MeshLambertMaterial({ map: canvasTex(64, 64, (g, w, h) => { for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#191D29' : '#FFE14D'; g.fillRect(k * 8, 0, 8, h); } }) });
  city.ramps.forEach((r) => { const m = new THREE.Mesh(rampGeo(r.len, r.h, r.w), rampMat); m.position.set(r.x, 0.02, r.z); m.rotation.y = r.dir; scene.add(m); });

  /* colliders in an 80 m grid */
  const cells = new Map();
  const cellKey = (x, z) => Math.floor(x / STEP) + ',' + Math.floor(z / STEP);
  function addCol(o) {
    const x0 = Math.floor((o.x0 !== undefined ? o.x0 : o.x - o.r) / STEP), x1 = Math.floor((o.x1 !== undefined ? o.x1 : o.x + o.r) / STEP);
    const z0 = Math.floor((o.z0 !== undefined ? o.z0 : o.z - o.r) / STEP), z1 = Math.floor((o.z1 !== undefined ? o.z1 : o.z + o.r) / STEP);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const k = i + ',' + j; if (!cells.has(k)) cells.set(k, []); cells.get(k).push(o); }
  }
  city.boxes.forEach((b) => addCol({ x0: b.x - b.w / 2, x1: b.x + b.w / 2, z0: b.z - b.d / 2, z1: b.z + b.d / 2, h: b.h }));
  city.trees.forEach((t) => addCol({ x: t.x, z: t.z, r: 0.6 * Math.max(1, t.s) }));
  for (let x = BRIDGE.x0 + 4; x < BRIDGE.x1 - 4; x += 8) { addCol({ x0: x - 4, x1: x + 4, z0: BRIDGE.z - BRIDGE.w / 2 - 0.4, z1: BRIDGE.z - BRIDGE.w / 2 + 0.2, h: 1 }); addCol({ x0: x - 4, x1: x + 4, z0: BRIDGE.z + BRIDGE.w / 2 - 0.2, z1: BRIDGE.z + BRIDGE.w / 2 + 0.4, h: 1 }); }

  /* the player's car */
  const carGroup = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: data.color || '#FFE14D' });
  paint.emissive = new THREE.Color(data.color || '#FFE14D').multiplyScalar(0.22);
  const glassM = new THREE.MeshLambertMaterial({ color: '#25324A' }), darkM = new THREE.MeshLambertMaterial({ color: '#191D29' });
  const lightM = new THREE.MeshBasicMaterial({ color: '#FFF6D6' }), tailM = new THREE.MeshBasicMaterial({ color: '#FF3B3B' });
  const dims = { hatch: [1.9, 0.75, 4.1, 1.6, 0.62, 2.1], buggy: [1.95, 0.6, 3.7, 1.7, 0.08, 1.4], van: [2, 1.1, 4.6, 1.85, 0.75, 3.2], gt: [2.0, 0.55, 4.5, 1.6, 0.48, 1.8] }[car0.id] || [1.9, 0.75, 4.1, 1.6, 0.62, 2.1];
  const body = new THREE.Mesh(new THREE.BoxGeometry(dims[0], dims[1], dims[2]), paint); body.position.y = 0.42 + dims[1] / 2;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(dims[3], Math.max(0.08, dims[4]), dims[5]), car0.id === 'buggy' ? darkM : glassM); cab.position.set(0, 0.42 + dims[1] + Math.max(0.08, dims[4]) / 2, car0.id === 'van' ? -0.4 : -0.25);
  carGroup.add(body, cab);
  if (car0.id === 'buggy') { const bar = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.07, 6, 12, Math.PI), darkM); bar.position.set(0, 0.42 + dims[1], -0.5); carGroup.add(bar); }
  const wGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.32, 12); wGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach((p) => { const w = new THREE.Mesh(wGeo, darkM); w.position.set(p[0] * (dims[0] / 2 - 0.05), 0.4, p[1] * (dims[2] / 2 - 0.75)); carGroup.add(w); wheels.push(w); });
  [[-0.6, 1], [0.6, 1]].forEach((p) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.06), lightM); l.position.set(p[0], 0.42 + dims[1] * 0.65, dims[2] / 2 + 0.01); carGroup.add(l); const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.06), tailM); tl.position.set(p[0], 0.42 + dims[1] * 0.65, -dims[2] / 2 - 0.01); carGroup.add(tl); });
  const shadowTex = canvasTex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(32, 32, 4, 32, 32, 31); gr.addColorStop(0, 'rgba(0,0,0,.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(dims[0] * 1.9, dims[2] * 1.35), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  scene.add(carGroup, shadow);

  /* traffic */
  const TN = coarse ? 18 : 28;
  const tBody = new THREE.InstancedMesh(new THREE.BoxGeometry(1.9, 0.8, 4.2), new THREE.MeshLambertMaterial({ color: '#FFFFFF' }), TN);
  const tCab = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 0.6, 2), glassM, TN);
  const TCOL = ['#FF5A5F', '#3E9BD6', '#F3F4F6', '#191D29', '#1E9E6A', '#F28C28', '#E9E2D3', '#8C3B72'];
  const traffic = [];
  for (let k = 0; k < TN; k++) { traffic.push({ x: 0, z: 0, dir: 0, v: 10, wait: 0, alive: false }); tBody.setColorAt(k, C.set(TCOL[k % TCOL.length])); }
  tBody.instanceColor.needsUpdate = true;
  tBody.frustumCulled = false; tCab.frustumCulled = false;
  scene.add(tBody, tCab);

  /* sticky notes and seed crates */
  const notes = notePoints(rules.noteN || 160);
  const taken = new Set(Array.isArray(data.drive && data.drive.notes) ? data.drive.notes : []);
  const noteMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 1.3, 0.1), new THREE.MeshBasicMaterial({ color: '#FFE14D' }), notes.length);
  noteMesh.frustumCulled = false;
  scene.add(noteMesh);
  const crates = cratePoints(rules.crateN || 10, data.seed || 'today', city.blocks);
  const crateTaken = new Set(Array.isArray(data.drive && data.drive.crates) ? data.drive.crates : []);
  const crateMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), new THREE.MeshLambertMaterial({ map: canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#C98A50'; g.fillRect(0, 0, w, h); g.strokeStyle = '#8D5A2E'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6); g.beginPath(); g.moveTo(3, 3); g.lineTo(w - 3, h - 3); g.stroke(); }) }), crates.length);
  const beamGeo = new THREE.CylinderGeometry(1.2, 1.2, 60, 10, 1, true); beamGeo.translate(0, 30, 0);
  const beamMesh = new THREE.InstancedMesh(beamGeo, new THREE.MeshBasicMaterial({ color: '#FFE14D', transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide, fog: false }), crates.length);
  crateMesh.frustumCulled = false; beamMesh.frustumCulled = false;
  scene.add(crateMesh, beamMesh);
  function placeCrates() {
    crates.forEach((p, i) => {
      const gone = crateTaken.has(i);
      M.compose(V.set(p.x, gone ? -50 : 0.8, p.z), Q.identity(), SC.set(1, 1, 1)); crateMesh.setMatrixAt(i, M);
      M.compose(V.set(p.x, gone ? -500 : 0, p.z), Q.identity(), SC.set(1, 1, 1)); beamMesh.setMatrixAt(i, M);
    });
    crateMesh.instanceMatrix.needsUpdate = true; beamMesh.instanceMatrix.needsUpdate = true;
  }
  placeCrates();

  /* homes: yours and your friends', with a beam and a name */
  const homes = (data.homes || []).map((h) => Object.assign({}, h, homePoint(h.id, h.loc, city.blocks)));
  const homeBeams = new THREE.InstancedMesh(beamGeo, new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide, fog: false }), Math.max(1, homes.length));
  homes.forEach((h, i) => { M.compose(V.set(h.x, 0, h.z), Q.identity(), SC.set(1.4, 0.6, 1.4)); homeBeams.setMatrixAt(i, M); homeBeams.setColorAt(i, C.set(h.me ? '#FFE14D' : '#9ADAFF')); });
  homeBeams.instanceMatrix.needsUpdate = true; if (homeBeams.instanceColor) homeBeams.instanceColor.needsUpdate = true;
  homeBeams.frustumCulled = false;
  scene.add(homeBeams);
  const visited = new Set(homes.filter((h) => h.visited).map((h) => h.id));

  /* time trials: a flat yellow ring at each start, standing rings as checkpoints */
  const trials = (cat.trials || []).map((t) => Object.assign({}, t));
  const startRingGeo = new THREE.RingGeometry(6.2, 7.6, 40); startRingGeo.rotateX(-Math.PI / 2);
  trials.forEach((t) => { const m = new THREE.Mesh(startRingGeo, new THREE.MeshBasicMaterial({ color: '#FFE14D', transparent: true, opacity: 0.9, side: THREE.DoubleSide })); m.position.set(t.pts[0][0], 0.06, t.pts[0][1]); scene.add(m); t.mark = m; });
  const cpMesh = new THREE.Mesh(new THREE.TorusGeometry(7, 0.45, 8, 40), new THREE.MeshBasicMaterial({ color: '#FFE14D' }));
  cpMesh.visible = false;
  scene.add(cpMesh);

  /* ---------- HUD ---------- */
  root.querySelector('.bc-loading').remove();
  const hud = document.createElement('div');
  hud.innerHTML =
    '<div class="bc-top"><div class="bc-panel bc-fuel"><b class="bc-f">0:00</b><span class="bc-sub">fuel</span><div class="bc-bar"><i></i></div></div>' +
    '<div class="bc-btns"><button type="button" class="bc-btn" data-k="sky" aria-label="Change the sky">Sky</button><button type="button" class="bc-btn" data-k="snd" aria-label="Sound">Sound</button><button type="button" class="bc-btn" data-k="map" aria-label="Map">Map</button><button type="button" class="bc-btn x" data-k="exit">Done</button></div></div>' +
    '<canvas class="bc-mini" width="300" height="300" aria-hidden="true"></canvas>' +
    '<div class="bc-trial" hidden></div><div class="bc-msg" style="opacity:0"></div>' +
    '<div class="bc-speed"><b>0</b><span>km/h</span></div>' +
    '<div class="bc-touch' + (coarse ? ' on' : '') + '"><div class="bc-pad"><button type="button" class="bc-key" data-in="left" aria-label="Steer left">◀</button><button type="button" class="bc-key" data-in="right" aria-label="Steer right">▶</button></div>' +
    '<div class="bc-pad"><button type="button" class="bc-key small" data-in="hand" aria-label="Handbrake">Drift</button><button type="button" class="bc-key" data-in="down" aria-label="Brake">▼</button><button type="button" class="bc-key" data-in="up" aria-label="Gas">▲</button></div></div>' +
    '<div class="bc-map"><canvas width="900" height="960"></canvas></div><div class="bc-fade"></div>';
  while (hud.firstChild) root.appendChild(hud.firstChild);
  const $ = (s) => root.querySelector(s);
  const elFuel = $('.bc-f'), elSub = $('.bc-sub'), elBar = $('.bc-bar i'), elSpeed = $('.bc-speed b'), elMsg = $('.bc-msg'), elTrial = $('.bc-trial'), mini = $('.bc-mini'), mapBox = $('.bc-map'), fade = $('.bc-fade');
  const labels = homes.map((h) => { const d = document.createElement('div'); d.className = 'bc-label' + (h.me ? ' home' : ''); d.textContent = h.me ? 'Home' : h.name; d.style.display = 'none'; root.appendChild(d); return d; });
  const trialLabels = trials.map((t) => { const d = document.createElement('div'); d.className = 'bc-label'; d.textContent = t.name; d.style.display = 'none'; root.appendChild(d); return d; });

  /* the map, drawn once */
  const MAP_S = 900 / 3600;
  const mapCanvas = document.createElement('canvas'); mapCanvas.width = 900; mapCanvas.height = 960;
  (function drawMap() {
    const g = mapCanvas.getContext('2d'), mx = (x) => (x + 1500) * MAP_S, mz = (z) => (z + 1560) * MAP_S;
    g.fillStyle = '#2F7FB0'; g.fillRect(0, 0, 900, 960);
    g.fillStyle = '#9CCB7F'; g.fillRect(mx(LAND.x0), mz(LAND.z0), (LAND.x1 - LAND.x0) * MAP_S, (LAND.z1 - LAND.z0) * MAP_S);
    city.blocks.forEach((b) => { g.fillStyle = GROUND[b.d] || GROUND.midtown; g.fillRect(mx(b.x0), mz(b.z0), (STEP - ROAD) * MAP_S, (STEP - ROAD) * MAP_S); });
    g.fillStyle = GROUND.sand; g.fillRect(mx(GX1 + ROAD / 2), mz(LAND.z0), (SEA - GX1 - ROAD / 2) * MAP_S, (LAND.z1 - LAND.z0) * MAP_S);
    g.fillStyle = '#F2D7A6'; g.beginPath(); g.arc(mx(ISLAND.x), mz(ISLAND.z), ISLAND.r * MAP_S, 0, 7); g.fill();
    g.fillStyle = '#9CCB7F'; g.beginPath(); g.arc(mx(ISLAND.x), mz(ISLAND.z), (ISLAND.ring - 10) * MAP_S, 0, 7); g.fill();
    g.strokeStyle = '#5E6370'; g.lineWidth = ROAD * MAP_S;
    for (let x = GX0; x <= GX1; x += STEP) { g.beginPath(); g.moveTo(mx(x), mz(GZ0)); g.lineTo(mx(x), mz(GZ1)); g.stroke(); }
    for (let z = GZ0; z <= GZ1; z += STEP) { g.beginPath(); g.moveTo(mx(GX0), mz(z)); g.lineTo(mx(BLVD), mz(z)); g.stroke(); }
    g.lineWidth = 16 * MAP_S; g.beginPath(); g.moveTo(mx(BLVD), mz(GZ0)); g.lineTo(mx(BLVD), mz(GZ1)); g.stroke();
    g.beginPath(); g.moveTo(mx(BRIDGE.x0), mz(BRIDGE.z)); g.lineTo(mx(BRIDGE.x1), mz(BRIDGE.z)); g.stroke();
    g.beginPath(); g.arc(mx(ISLAND.x), mz(ISLAND.z), ISLAND.ring * MAP_S, 0, 7); g.stroke();
  })();
  const toMap = (x, z) => [(x + 1500) * MAP_S, (z + 1560) * MAP_S];

  /* ---------- input ---------- */
  const keys = { up: 0, down: 0, left: 0, right: 0, hand: 0 };
  const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'hand' };
  function onKey(e) {
    const k = KEYMAP[e.code];
    if (k) { keys[k] = e.type === 'keydown' ? 1 : 0; e.preventDefault(); e.stopPropagation(); return; }
    if (e.type !== 'keydown') return;
    if (e.code === 'KeyM') { toggleMap(); e.preventDefault(); }
    else if (e.code === 'Escape') { e.preventDefault(); if (mapBox.classList.contains('on')) toggleMap(); else finish('exit'); }
  }
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('keyup', onKey, true);
  root.querySelectorAll('.bc-key').forEach((b) => {
    const k = b.dataset.in;
    const on = (e) => { e.preventDefault(); keys[k] = 1; b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } };
    const off = (e) => { e.preventDefault(); keys[k] = 0; b.classList.remove('on'); };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
  });
  let skyMode = store('bloc:city:sky') || 'live', sound = store('bloc:city:snd') !== 'off';
  const skyNames = { live: 'Sky: Now', sunset: 'Sky: Sunset', night: 'Sky: Night' };
  $('[data-k="sky"]').textContent = skyNames[skyMode] || 'Sky';
  $('[data-k="snd"]').textContent = sound ? 'Sound on' : 'Sound off';
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]');
    if (!b) return;
    const k = b.dataset.k;
    if (k === 'exit') finish('exit');
    else if (k === 'map') toggleMap();
    else if (k === 'sky') { skyMode = skyMode === 'live' ? 'sunset' : skyMode === 'sunset' ? 'night' : 'live'; store('bloc:city:sky', skyMode); b.textContent = skyNames[skyMode]; lastSky = -1; }
    else if (k === 'snd') { sound = !sound; store('bloc:city:snd', sound ? 'on' : 'off'); b.textContent = sound ? 'Sound on' : 'Sound off'; if (sound) audioStart(); else audioStop(); }
  });
  mapBox.addEventListener('click', () => toggleMap());
  function toggleMap() { mapBox.classList.toggle('on'); if (mapBox.classList.contains('on')) drawBigMap(); }
  function onVis() { paused = document.hidden; if (!paused) last = performance.now(); }
  function onBlur() { Object.keys(keys).forEach((k) => { keys[k] = 0; }); root.querySelectorAll('.bc-key.on').forEach((b) => b.classList.remove('on')); }
  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onVis);
  function onResize() { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  window.addEventListener('resize', onResize);
  onResize();
  function detach() {
    window.removeEventListener('keydown', onKey, true); window.removeEventListener('keyup', onKey, true);
    window.removeEventListener('resize', onResize); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('blur', onBlur);
  }

  /* ---------- sound: a small engine and a chime ---------- */
  let actx = null, osc = null, gain = null, filt = null;
  function audioStart() {
    if (!sound || osc) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      actx = actx || new AC();
      if (actx.state === 'suspended') actx.resume();
      osc = actx.createOscillator(); filt = actx.createBiquadFilter(); gain = actx.createGain();
      osc.type = 'sawtooth'; osc.frequency.value = 50; filt.type = 'lowpass'; filt.frequency.value = 420; gain.gain.value = 0.0001;
      osc.connect(filt); filt.connect(gain); gain.connect(actx.destination); osc.start();
    } catch (e) { osc = null; }
  }
  function audioStop() { try { if (osc) { osc.stop(); osc.disconnect(); } } catch (e) { /* ignore */ } osc = null; }
  function chime(f) {
    if (!sound || !actx) return;
    try {
      const o = actx.createOscillator(), g = actx.createGain(), t0 = actx.currentTime;
      o.type = 'sine'; o.frequency.value = f || 880; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
      o.connect(g); g.connect(actx.destination); o.start(t0); o.stop(t0 + 0.32);
    } catch (e) { /* ignore */ }
  }
  window.addEventListener('pointerdown', audioStart, { once: true });
  window.addEventListener('keydown', audioStart, { once: true });

  /* ---------- state ---------- */
  const me = homes.find((h) => h.me);
  const startPos = me ? { x: me.x + 6, z: me.z - 4 } : { x: 0, z: 0 };
  /* start on the road in front of home, facing along it */
  const sx = Math.round(startPos.x / STEP) * STEP, sz = startPos.z;
  const car = { x: Math.abs(sx - startPos.x) < 30 ? sx : startPos.x, z: Math.round(sz / STEP) * STEP + 3.5, y: 0, vy: 0, h: Math.PI / 2, vx: 0, vz: 0, air: false, airT: 0, ramp: null, steer: 0 };
  if (!onRoad(car.x, car.z)) { car.x = Math.round(car.x / STEP) * STEP + 3.5; car.z = Math.round(car.z / STEP) * STEP; car.h = 0; }
  let safe = { x: car.x, z: car.z, h: car.h };
  let fuel = Math.max(0, data.fuel || 0), driven = 0, paused = false, last = performance.now(), msgT = 0, shake = 0, lastSky = -1, coinsRun = 0;
  let trial = null, trialEnd = -10;
  const camPos = new THREE.Vector3(car.x - Math.sin(car.h) * 12, 6, car.z - Math.cos(car.h) * 12);
  camera.position.copy(camPos);

  function say(big, small) {
    elMsg.innerHTML = '';
    const b = document.createElement('div'); b.textContent = big; elMsg.appendChild(b);
    if (small) { const s = document.createElement('small'); s.textContent = small; elMsg.appendChild(s); }
    elMsg.style.opacity = '1'; msgT = 2.6;
  }

  function spawnTraffic(t, near) {
    for (let tries = 0; tries < 20; tries++) {
      const vertical = Math.random() < 0.5;
      const ang = Math.random() * Math.PI * 2, dist = near ? 160 + Math.random() * 260 : 120 + Math.random() * 360;
      let x = car.x + Math.cos(ang) * dist, z = car.z + Math.sin(ang) * dist;
      if (x < GX0 || x > GX1 || z < GZ0 || z > GZ1) continue;
      if (vertical) x = Math.round(x / STEP) * STEP; else z = Math.round(z / STEP) * STEP;
      t.dir = vertical ? (Math.random() < 0.5 ? 0 : 2) : (Math.random() < 0.5 ? 1 : 3);
      t.x = x; t.z = z; t.v = 8 + Math.random() * 6; t.alive = true; t.wait = 0;
      laneSnap(t);
      return;
    }
    t.alive = false;
  }
  /* dir: 0 = +z, 1 = +x, 2 = -z, 3 = -x; cars keep right */
  function laneSnap(t) {
    if (t.dir === 0) t.x = Math.round(t.x / STEP) * STEP - 3.5;
    else if (t.dir === 2) t.x = Math.round(t.x / STEP) * STEP + 3.5;
    else if (t.dir === 1) t.z = Math.round(t.z / STEP) * STEP + 3.5;
    else t.z = Math.round(t.z / STEP) * STEP - 3.5;
  }
  traffic.forEach((t) => spawnTraffic(t, false));
  function stepTraffic(dt) {
    traffic.forEach((t, i) => {
      if (!t.alive || Math.hypot(t.x - car.x, t.z - car.z) > 520) spawnTraffic(t, true);
      if (!t.alive) return;
      const dx = [0, 1, 0, -1][t.dir], dz = [1, 0, -1, 0][t.dir];
      const dc = Math.hypot(t.x - car.x, t.z - car.z);
      /* slow down behind the player */
      const ahead = (car.x - t.x) * dx + (car.z - t.z) * dz;
      let v = t.v;
      if (ahead > 0 && ahead < 14 && dc < 8) v = 0;
      if (t.wait > 0) { t.wait -= dt; v = 0; }
      const along = dx ? t.x : t.z, nextAlong = along + (dx || dz) * v * dt;
      const cross = Math.floor((along - (dx || dz) * 3.5 * 0) / STEP) !== Math.floor(nextAlong / STEP);
      t.x += dx * v * dt; t.z += dz * v * dt;
      if (cross) {
        const r = Math.random();
        if (r < 0.22) t.dir = (t.dir + 1) % 4; else if (r < 0.44) t.dir = (t.dir + 3) % 4;
        if (t.x < GX0 + 10) t.dir = 1; if (t.x > GX1 - 10) t.dir = 3; if (t.z < GZ0 + 10) t.dir = 0; if (t.z > GZ1 - 10) t.dir = 2;
        laneSnap(t);
      }
      const yaw = [0, Math.PI / 2, Math.PI, -Math.PI / 2][t.dir];
      Q.setFromAxisAngle(V.set(0, 1, 0), yaw);
      M.compose(V.set(t.x, 0.82, t.z), Q, SC.set(1, 1, 1)); tBody.setMatrixAt(i, M);
      M.compose(V.set(t.x - Math.sin(yaw) * 0.2, 1.52, t.z - Math.cos(yaw) * 0.2), Q, SC.set(1, 1, 1)); tCab.setMatrixAt(i, M);
    });
    tBody.instanceMatrix.needsUpdate = true; tCab.instanceMatrix.needsUpdate = true;
  }

  /* ---------- physics ---------- */
  const RADIUS = 1.6;
  function collide() {
    const cx = Math.floor(car.x / STEP), cz = Math.floor(car.z / STEP);
    let hit = 0;
    for (let i = cx - 1; i <= cx + 1; i++) for (let j = cz - 1; j <= cz + 1; j++) {
      const list = cells.get(i + ',' + j);
      if (!list) continue;
      for (const o of list) {
        if (o.h !== undefined && car.y > o.h + 0.3) continue;
        let nx, nz, d;
        if (o.r !== undefined) {
          const dx = car.x - o.x, dz = car.z - o.z; d = Math.hypot(dx, dz);
          if (d >= RADIUS + o.r || d === 0) continue;
          nx = dx / d; nz = dz / d; d = RADIUS + o.r - d;
        } else {
          const px = Math.max(o.x0, Math.min(car.x, o.x1)), pz = Math.max(o.z0, Math.min(car.z, o.z1));
          let dx = car.x - px, dz = car.z - pz; d = Math.hypot(dx, dz);
          if (d >= RADIUS) continue;
          if (d < 1e-4) {
            const l = car.x - o.x0, r = o.x1 - car.x, t = car.z - o.z0, b = o.z1 - car.z, m = Math.min(l, r, t, b);
            if (m === l) { nx = -1; nz = 0; d = l + RADIUS; } else if (m === r) { nx = 1; nz = 0; d = r + RADIUS; } else if (m === t) { nx = 0; nz = -1; d = t + RADIUS; } else { nx = 0; nz = 1; d = b + RADIUS; }
          } else { nx = dx / d; nz = dz / d; d = RADIUS - d; }
        }
        car.x += nx * d; car.z += nz * d;
        const vn = car.vx * nx + car.vz * nz;
        if (vn < 0) { car.vx -= 1.3 * vn * nx; car.vz -= 1.3 * vn * nz; hit = Math.max(hit, -vn); }
      }
    }
    traffic.forEach((t) => {
      if (!t.alive) return;
      const dx = car.x - t.x, dz = car.z - t.z, d = Math.hypot(dx, dz);
      if (d < 3.4 && d > 0) {
        const nx = dx / d, nz = dz / d; car.x += nx * (3.4 - d); car.z += nz * (3.4 - d);
        const vn = car.vx * nx + car.vz * nz; if (vn < 0) { car.vx -= 1.4 * vn * nx; car.vz -= 1.4 * vn * nz; hit = Math.max(hit, -vn); }
        t.wait = 1.5;
      }
    });
    if (hit > 5) { car.vx *= 0.75; car.vz *= 0.75; shake = Math.min(0.6, hit / 30); }
  }
  function rampAt(x, z) {
    for (const r of city.ramps) {
      const c = Math.cos(r.dir), s = Math.sin(r.dir), dx = x - r.x, dz = z - r.z;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (Math.abs(lx) < r.w / 2 && lz > -r.len / 2 && lz < r.len / 2) return { r, h: (lz + r.len / 2) / r.len * r.h, slope: r.h / r.len, fx: s, fz: c };
    }
    return null;
  }
  function physics(dt) {
    const top = car0.top || 33, acc = car0.acc || 13, turn = car0.turn || 1;
    const road = onRoad(car.x, car.z), land = isLand(car.x, car.z);
    const T = keys.up - keys.down, target = keys.right - keys.left;
    car.steer += (target - car.steer) * Math.min(1, dt * (target ? 6 : 9));
    const fx = Math.sin(car.h), fz = Math.cos(car.h), rx = Math.cos(car.h), rz = -Math.sin(car.h);
    let fwd = car.vx * fx + car.vz * fz, lat = car.vx * rx + car.vz * rz;
    const topNow = road ? top : top * 0.55;
    if (!car.air) {
      if (T > 0) { if (fwd < -0.5) fwd += 30 * dt; else fwd += acc * (1 - Math.max(0, fwd) / topNow) * dt; }
      else if (T < 0) { if (fwd > 0.5) fwd -= 28 * dt; else fwd -= acc * 0.55 * dt * (1 + fwd / 9); }
      else { const drag = (road ? 1.6 : 3.5) + 0.01 * fwd * fwd; fwd -= Math.sign(fwd) * Math.min(Math.abs(fwd), drag * dt); }
      if (fwd > topNow) fwd -= (fwd - topNow) * Math.min(1, dt * 2);
      const sp = Math.abs(fwd);
      const rate = car.steer * 2.25 * turn * Math.min(1, sp / 5) / (1 + sp / 30) * (keys.hand ? 1.55 : 1);
      car.h -= rate * dt * (fwd >= 0 ? 1 : -1);
      const grip = keys.hand ? 1.4 : road ? 9 : 5.5;
      lat *= Math.exp(-grip * dt);
      if (keys.hand) fwd -= Math.sign(fwd) * Math.min(Math.abs(fwd), 6 * dt);
    }
    const nfx = Math.sin(car.h), nfz = Math.cos(car.h), nrx = Math.cos(car.h), nrz = -Math.sin(car.h);
    car.vx = nfx * fwd + nrx * lat; car.vz = nfz * fwd + nrz * lat;
    car.x += car.vx * dt; car.z += car.vz * dt;
    /* ramps and air */
    const ra = car.air ? null : rampAt(car.x, car.z);
    if (ra) { car.y = ra.h; car.ramp = ra; }
    else if (car.ramp && !car.air) {
      const along = car.vx * car.ramp.fx + car.vz * car.ramp.fz;
      if (along > 6 && car.y > 1) { car.air = true; car.vy = along * car.ramp.slope * 1.25; car.airT = 0; car.jumpId = car.ramp.r.id; }
      else car.y = 0;
      car.ramp = null;
    }
    if (car.air) {
      car.vy -= 21 * dt; car.y += car.vy * dt; car.airT += dt;
      if (car.y <= 0) {
        car.y = 0; car.air = false;
        if (car.airT > 0.9) {
          if (result.jumps.indexOf(car.jumpId) < 0) result.jumps.push(car.jumpId);
          const first = (data.jumps || []).indexOf(car.jumpId) < 0;
          say('Stunt jump!', car.airT.toFixed(1) + ' s in the air' + (first ? ', +100 coins' : ''));
          chime(1320);
        }
        shake = 0.3;
      }
    }
    collide();
    /* the sea: back to the last safe road */
    if (!land && !car.air) {
      fade.style.opacity = '1';
      car.x = safe.x; car.z = safe.z; car.h = safe.h; car.vx = car.vz = 0;
      say('Splash!', 'Back on the road');
      setTimeout(() => { fade.style.opacity = '0'; }, 380);
    } else if (road && !car.air && Math.abs(fwd) > 2) { safe = { x: car.x, z: car.z, h: car.h }; }
    return fwd;
  }

  /* ---------- pickups, homes and trials ---------- */
  function pickups() {
    for (let i = 0; i < notes.length; i++) {
      if (taken.has(i)) continue;
      const p = notes[i];
      if (Math.abs(p.x - car.x) < 3.2 && Math.abs(p.z - car.z) < 3.2 && car.y < 3) {
        taken.add(i); result.notes.push(i); coinsRun += 3; chime(1046);
        say('Sticky note', '+3 coins');
      }
    }
    for (let i = 0; i < crates.length; i++) {
      if (crateTaken.has(i)) continue;
      const p = crates[i];
      if (Math.hypot(p.x - car.x, p.z - car.z) < 3.6) { crateTaken.add(i); result.crates.push(i); placeCrates(); chime(784); setTimeout(() => chime(1175), 120); say('Seed crate!', 'A seed for your garden'); }
    }
    homes.forEach((h) => {
      if (h.me || visited.has(h.id)) return;
      if (Math.hypot(h.x - car.x, h.z - car.z) < 10) { visited.add(h.id); result.visits.push(h.id); chime(988); say('You drove past ' + h.name.split(' ')[0] + '’s house', '+10 coins for you both'); }
    });
    if (!trial) {
      for (const t of trials) {
        if (driven - trialEnd > 4 && Math.hypot(t.pts[0][0] - car.x, t.pts[0][1] - car.z) < 7.5) { trial = { t, i: 1, at: driven }; say(t.name, 'Go! Drive through the rings'); chime(660); placeCp(); break; }
      }
    } else {
      const p = trial.t.pts[trial.i];
      if (Math.hypot(p[0] - car.x, p[1] - car.z) < 9.5) {
        trial.i++; chime(880);
        if (trial.i >= trial.t.pts.length) {
          const ms = Math.round((driven - trial.at) * 1000), t = trial.t;
          const medal = ms <= t.gold ? 'Gold' : ms <= t.silver ? 'Silver' : ms <= t.bronze ? 'Bronze' : null;
          if (!result.trial || (result.trial.id === t.id ? ms < result.trial.ms : true)) result.trial = { id: t.id, ms };
          say(t.name + ': ' + fmtMs(ms), medal ? medal + ' medal' : 'No medal this time. Gold is ' + fmtMs(t.gold));
          trial = null; trialEnd = driven; cpMesh.visible = false; elTrial.hidden = true;
        } else placeCp();
      }
      if (trial && driven - trial.at > 600) { trial = null; cpMesh.visible = false; elTrial.hidden = true; }
    }
  }
  function placeCp() {
    const p = trial.t.pts[trial.i], q = trial.t.pts[trial.i - 1];
    cpMesh.position.set(p[0], 7.5, p[1]);
    cpMesh.rotation.set(0, Math.atan2(p[0] - q[0], p[1] - q[1]), 0);
    cpMesh.visible = true; elTrial.hidden = false;
  }

  /* ---------- drawing ---------- */
  function applySky() {
    const d = new Date(), hour = d.getHours() + d.getMinutes() / 60, key = skyMode + ':' + Math.floor(hour * 12);
    if (key === lastSky) return;
    lastSky = key;
    const s = skyAt(hour, skyMode, Date.now());
    skyU.top.value.copy(s.top); skyU.hor.value.copy(s.hor); skyU.sunCol.value.copy(s.sun); skyU.sunDir.value.copy(s.dir); skyU.night.value = s.night;
    scene.fog.color.copy(s.hor); waterU.fogCol.value.copy(s.hor);
    bU.sunDir.value.copy(s.dir); bU.sunCol.value.copy(s.sun); bU.skyCol.value.copy(s.top).lerp(s.hor, 0.5); bU.fogCol.value.copy(s.hor); bU.night.value = s.night; bU.sunI.value = s.sunI; bU.amb.value = s.amb;
    hemi.color.copy(s.top).lerp(new THREE.Color('#FFFFFF'), 0.5); hemi.groundColor.set(s.night > 0.5 ? '#3A4060' : '#8A9A7A'); hemi.intensity = 1.1 * s.amb + 0.75;
    sunL.color.copy(s.sun); sunL.intensity = 2.2 * s.sunI * (s.elev > 0 ? 1 : 0.4);
    waterU.deep.value.set(s.night > 0.5 ? '#0E2F4E' : '#1F78A8').lerp(s.hor, 0.12); waterU.shallow.value.set(s.night > 0.5 ? '#1D4E70' : '#52B9D8').lerp(s.hor, 0.18);
  }
  let noteSpin = 0;
  function drawNotes(dt) {
    noteSpin += dt * 2.2;
    for (let i = 0; i < notes.length; i++) {
      const p = notes[i], gone = taken.has(i), far = Math.abs(p.x - car.x) > 700 || Math.abs(p.z - car.z) > 700;
      Q.setFromAxisAngle(V.set(0, 1, 0), noteSpin + i);
      M.compose(V.set(p.x, gone || far ? -50 : 1.6 + Math.sin(noteSpin * 1.3 + i) * 0.25, p.z), Q, SC.set(1, 1, 1));
      noteMesh.setMatrixAt(i, M);
    }
    noteMesh.instanceMatrix.needsUpdate = true;
  }
  const P3 = new THREE.Vector3();
  function placeLabel(el, x, y, z, maxD) {
    const d = Math.hypot(x - car.x, z - car.z);
    if (d > maxD) { el.style.display = 'none'; return; }
    P3.set(x, y, z).project(camera);
    if (P3.z > 1 || P3.x < -1.1 || P3.x > 1.1 || P3.y < -1.1 || P3.y > 1.1) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.style.left = ((P3.x + 1) / 2 * window.innerWidth).toFixed(0) + 'px';
    el.style.top = ((1 - P3.y) / 2 * window.innerHeight).toFixed(0) + 'px';
  }
  let miniT = 0;
  function drawMini() {
    const g = mini.getContext('2d'), W = 300, half = W / 2, zoom = 3.2;
    g.save();
    g.fillStyle = '#2F7FB0'; g.fillRect(0, 0, W, W);
    g.translate(half, half); g.rotate(Math.PI + car.h); g.scale(zoom, zoom);
    const [mx, mz] = toMap(car.x, car.z);
    g.drawImage(mapCanvas, -mx, -mz);
    const dot = (x, z, col, r) => { const [a, b] = toMap(x, z); g.fillStyle = col; g.beginPath(); g.arc(a - mx, b - mz, r / zoom, 0, 7); g.fill(); };
    crates.forEach((p, i) => { if (!crateTaken.has(i)) dot(p.x, p.z, '#C98A50', 7); });
    homes.forEach((h) => dot(h.x, h.z, h.me ? '#FFE14D' : '#9ADAFF', 8));
    trials.forEach((t) => dot(t.pts[0][0], t.pts[0][1], '#FFE14D', 6));
    if (trial) { const p = trial.t.pts[trial.i]; dot(p[0], p[1], '#FF5A5F', 9); }
    g.restore();
    g.fillStyle = '#FFFFFF'; g.strokeStyle = '#191D29'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(half, half - 14); g.lineTo(half + 10, half + 11); g.lineTo(half, half + 5); g.lineTo(half - 10, half + 11); g.closePath(); g.fill(); g.stroke();
  }
  function drawBigMap() {
    const c = mapBox.querySelector('canvas'), g = c.getContext('2d');
    g.drawImage(mapCanvas, 0, 0);
    g.font = '700 22px system-ui, sans-serif'; g.textAlign = 'center';
    const pin = (x, z, col, label) => { const [a, b] = toMap(x, z); g.fillStyle = col; g.beginPath(); g.arc(a, b, 9, 0, 7); g.fill(); g.strokeStyle = '#191D29'; g.lineWidth = 3; g.stroke(); if (label) { g.fillStyle = '#FFFFFF'; g.strokeStyle = 'rgba(17,19,24,.8)'; g.lineWidth = 5; g.strokeText(label, a, b - 16); g.fillText(label, a, b - 16); } };
    crates.forEach((p, i) => { if (!crateTaken.has(i)) pin(p.x, p.z, '#C98A50'); });
    trials.forEach((t) => pin(t.pts[0][0], t.pts[0][1], '#FFE14D', t.name));
    homes.forEach((h) => pin(h.x, h.z, h.me ? '#FFE14D' : '#9ADAFF', h.me ? 'Home' : h.name.split(' ')[0]));
    const [a, b] = toMap(car.x, car.z);
    g.save(); g.translate(a, b); g.rotate(Math.PI + car.h); g.fillStyle = '#FF5A5F'; g.strokeStyle = '#FFFFFF'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, -16); g.lineTo(12, 12); g.lineTo(0, 6); g.lineTo(-12, 12); g.closePath(); g.fill(); g.stroke(); g.restore();
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    let dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (paused || mapBox.classList.contains('on')) { renderer.render(scene, camera); return; }
    driven += dt; fuel -= dt;
    let fwd = 0;
    const sub = Math.ceil(dt / (1 / 120));
    for (let k = 0; k < sub; k++) fwd = physics(dt / sub);
    stepTraffic(dt);
    pickups();
    applySky();
    drawNotes(dt);
    waterU.time.value += dt; waterU.cam.value.copy(camera.position);
    /* car pose */
    carGroup.position.set(car.x, car.y, car.z);
    carGroup.rotation.set(car.air ? -car.vy * 0.015 : 0, car.h, -car.steer * Math.min(1, Math.abs(fwd) / 20) * 0.05);
    wheels.forEach((w, i) => { w.rotation.x += fwd * dt / 0.4; if (i < 2) w.rotation.y = car.steer * 0.4; });
    shadow.position.set(car.x, 0.05, car.z); shadow.rotation.z = -car.h; shadow.material.opacity = Math.max(0.2, 1 - car.y / 8);
    /* chase camera */
    const fx = Math.sin(car.h), fz = Math.cos(car.h), sp = Math.abs(fwd);
    const back = 10 + sp * 0.06, up = 4.4 + sp * 0.03;
    V.set(car.x - fx * back, car.y + up, car.z - fz * back);
    camPos.lerp(V, 1 - Math.exp(-dt * 4.2));
    camera.position.copy(camPos);
    if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; shake = Math.max(0, shake - dt * 1.5); }
    camera.lookAt(car.x + fx * 6, car.y + 1.4, car.z + fz * 6);
    const fov = 60 + Math.min(18, sp * 0.42);
    if (Math.abs(camera.fov - fov) > 0.1) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix(); }
    sky.position.copy(camera.position);
    fill.position.copy(camera.position); fill.target.position.set(car.x, car.y + 1, car.z);
    sunL.position.set(car.x + bU.sunDir.value.x * 300, bU.sunDir.value.y * 300 + 50, car.z + bU.sunDir.value.z * 300); sunL.target.position.set(car.x, 0, car.z);
    /* HUD */
    elSpeed.textContent = Math.round(sp * 3.6);
    elFuel.textContent = fmt(fuel);
    elSub.textContent = coinsRun ? 'fuel, ' + result.notes.length + (result.notes.length === 1 ? ' note' : ' notes') : 'fuel';
    elBar.style.width = Math.max(0, Math.min(100, fuel / Math.max(1, data.fuel) * 100)).toFixed(1) + '%';
    if (trial) elTrial.textContent = trial.t.name + '  ' + fmtMs((driven - trial.at) * 1000) + '  ' + (trial.i) + '/' + (trial.t.pts.length - 1);
    if (msgT > 0) { msgT -= dt; if (msgT <= 0) elMsg.style.opacity = '0'; }
    homes.forEach((h, i) => placeLabel(labels[i], h.x, 14, h.z, 600));
    trials.forEach((t, i) => placeLabel(trialLabels[i], t.pts[0][0], 4, t.pts[0][1], 300));
    miniT -= dt; if (miniT <= 0) { miniT = 0.08; drawMini(); }
    if (osc && gain) { osc.frequency.value = 46 + sp * 3.2 + (keys.up ? 10 : 0); gain.gain.value = 0.035; filt.frequency.value = 300 + sp * 22; }
    renderer.render(scene, camera);
    if (fuel <= 0) finish('fuel');
  }
  say('Bloc City', coarse ? 'Steer on the left, gas and brake on the right' : 'W A S D to drive, Space to drift, M for the map');
  applySky();
  raf = requestAnimationFrame(frame);

  function showEnd(reason) {
    const card = document.createElement('div');
    card.className = 'bc-end';
    const t = result.trial;
    card.innerHTML = '<div class="bc-card"><h2>' + (reason === 'fuel' ? 'Out of fuel' : 'Drive over') + '</h2><p>' + (reason === 'fuel' ? 'Study 5 minutes for another minute of driving.' : 'Your fuel waits for next time.') + '</p><ul>' +
      '<li><span>Time driven</span><b>' + fmt(driven) + '</b></li><li><span>Sticky notes</span><b>' + result.notes.length + '</b></li><li><span>Seed crates</span><b>' + result.crates.length + '</b></li>' +
      (result.jumps.length ? '<li><span>Stunt jumps</span><b>' + result.jumps.length + '</b></li>' : '') + (result.visits.length ? '<li><span>Friends visited</span><b>' + result.visits.length + '</b></li>' : '') +
      (t ? '<li><span>Best trial</span><b>' + fmtMs(t.ms) + '</b></li>' : '') + '</ul><button type="button">Back to Bloc</button></div>';
    root.appendChild(card);
    const btn = card.querySelector('button');
    btn.focus();
    btn.onclick = destroy;
  }
  function destroy() {
    cancelAnimationFrame(raf);
    try {
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); } });
      renderer.dispose();
      if (renderer.forceContextLoss) renderer.forceContextLoss();
    } catch (e) { /* ignore */ }
    root.remove();
    document.body.style.overflow = prevOverflow;
  }
  const handle = { stop: () => finish('exit') };
  /* local testing only: lets a test script move the car (never set in the app) */
  if (store('bloc:city:debug') === '1') window.__blocCity = { car, keys, result, camPos, get fuel() { return fuel; } };
  return handle;
}
