/* Cars built from cross-sections: a smooth body lofted along its length, glass where the cabin is,
   wheel arches, bumpers, lights and plates. No real brand: every shape comes from these numbers. */
import * as THREE from 'three/webgpu';
import { attribute, float, vec3, positionLocal, mix, step, abs, fract, sin, dot, smoothstep, uniform, normalLocal, materialColor } from 'three/tsl';
import { U } from '../render/materials.js';

/* L length, W width, H height, wb wheelbase, r wheel radius, cl clearance, hood/trunk heights,
   cabin: windshield base (fraction of length from the front), roof start/end, rear window base, roof width */
export const TYPES = {
  hatch: { L: 4.05, W: 1.78, H: 1.47, wb: 2.52, r: 0.31, cl: 0.15, hood: 0.86, tail: 0.98, ws: 0.31, rs: 0.47, re: 0.86, rw: 0.97, rwW: 0.78, top: 33, acc: 13, grip: 1.0, mass: 1150 },
  sedan: { L: 4.65, W: 1.82, H: 1.44, wb: 2.78, r: 0.32, cl: 0.15, hood: 0.84, tail: 0.92, ws: 0.33, rs: 0.46, re: 0.7, rw: 0.84, rwW: 0.76, top: 38, acc: 14, grip: 1.05, mass: 1450 },
  suv: { L: 4.6, W: 1.9, H: 1.7, wb: 2.75, r: 0.37, cl: 0.21, hood: 1.02, tail: 1.12, ws: 0.32, rs: 0.45, re: 0.9, rw: 0.97, rwW: 0.82, top: 36, acc: 13, grip: 0.95, mass: 1850 },
  van: { L: 4.95, W: 1.95, H: 1.98, wb: 3.0, r: 0.34, cl: 0.17, hood: 1.0, tail: 1.9, ws: 0.17, rs: 0.27, re: 0.98, rw: 0.995, rwW: 0.88, top: 31, acc: 12, grip: 0.9, mass: 2100 },
  gt: { L: 4.55, W: 1.92, H: 1.26, wb: 2.68, r: 0.34, cl: 0.12, hood: 0.78, tail: 0.86, ws: 0.4, rs: 0.55, re: 0.74, rw: 0.88, rwW: 0.7, top: 45, acc: 19, grip: 1.2, mass: 1400 },
  super: { L: 4.5, W: 1.98, H: 1.14, wb: 2.66, r: 0.35, cl: 0.1, hood: 0.66, tail: 0.92, ws: 0.3, rs: 0.43, re: 0.62, rw: 0.92, rwW: 0.64, top: 54, acc: 24, grip: 1.3, mass: 1350 },
  buggy: { L: 3.7, W: 1.9, H: 1.35, wb: 2.3, r: 0.38, cl: 0.25, hood: 0.92, tail: 0.95, ws: 0.32, rs: 0.36, re: 0.62, rw: 0.66, rwW: 0.6, top: 35, acc: 16, grip: 1.1, mass: 900, open: true },
  taxi: { L: 4.65, W: 1.82, H: 1.44, wb: 2.78, r: 0.32, cl: 0.15, hood: 0.84, tail: 0.92, ws: 0.33, rs: 0.46, re: 0.7, rw: 0.84, rwW: 0.76, top: 36, acc: 13, grip: 1.0, mass: 1450, taxi: true },
  police: { L: 4.7, W: 1.86, H: 1.48, wb: 2.8, r: 0.33, cl: 0.16, hood: 0.86, tail: 0.94, ws: 0.33, rs: 0.46, re: 0.72, rw: 0.85, rwW: 0.77, top: 46, acc: 18, grip: 1.15, mass: 1600, police: true }
};
const ST = 30, RING = 11;

function profile(T, t) {
  /* t: 0 rear bumper -> 1 front bumper */
  const front = 1 - t, nose = smooth01(Math.min(1, front / 0.06)), rear = smooth01(Math.min(1, t / 0.05));
  const end = Math.min(nose, rear);
  const wb = T.W / 2 * (0.86 + 0.14 * end);
  const yb = T.cl + 0.06 * (1 - end);
  /* top of the body outside the cabin: hood at the front, deck at the back */
  const zf = 1 - T.ws, zr = 1 - T.re;
  let ytop, glass = 0, wr = wb * 0.98;
  const belt = Math.min(T.hood, T.tail) + 0.04 + (T.H - Math.min(T.hood, T.tail)) * 0.02;
  if (t > zf) { const u = (t - zf) / T.ws; ytop = lerp(belt + 0.04, T.hood * (0.86 + 0.1 * nose), smooth01(u)) * (0.75 + 0.25 * nose); }
  else if (t < zr) { const u = t / Math.max(0.001, zr); ytop = lerp(T.tail * (0.8 + 0.2 * rear), belt + 0.04, smooth01(u)); if (T.tail > T.H * 0.9) ytop = T.tail * (0.85 + 0.15 * rear); }
  else {
    const rs = 1 - T.rs, rb = 1 - T.rw;
    if (t > rs) { const u = (t - rs) / (zf - rs); ytop = lerp(T.H, belt + 0.05, smooth01(u)); glass = 1; }
    else if (t < rb) { const u = (t - zr) / Math.max(0.001, rb - zr); ytop = lerp(belt + 0.05, T.H, smooth01(u)); glass = 1; }
    else { ytop = T.H - 0.01; glass = 1; }
    wr = wb * T.rwW / 0.86 * (0.9 + 0.1 * Math.min(1, (ytop - belt) / 0.3));
  }
  if (T.open && glass) { ytop = belt + 0.08; glass = 0; }
  return { yb, belt: Math.min(belt, ytop - 0.02), ytop, wb, wr: Math.min(wr, wb * 0.95), glass };
}
/* which way triangle (a, b, c) faces compared with n: positive when its front face points along n */
function faces(a, b, c, n) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  return (uy * vz - uz * vy) * n[0] + (uz * vx - ux * vz) * n[1] + (ux * vy - uy * vx) * n[2];
}
function smooth01(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
function lerp(a, b, t) { return a + (b - a) * t; }

export function buildCar(type) {
  const T = TYPES[type] || TYPES.hatch;
  const paint = { p: [], n: [], z: [], i: [] }, glass = { p: [], n: [], i: [] }, trim = { p: [], n: [], i: [] };
  const axF = T.L / 2 - (T.L - T.wb) * 0.5 * 0.92, axR = axF - T.wb;
  /* rings of points around the half section, mirrored */
  const rings = [];
  for (let s = 0; s <= ST; s++) {
    const t = s / ST, z = -T.L / 2 + t * T.L, P = profile(T, t);
    /* wheel arches lift the lower edge */
    let yb = P.yb;
    for (const az of [axF, axR]) { const d = Math.abs(z - az), R = T.r + 0.07; if (d < R) yb = Math.max(yb, T.r + Math.sqrt(R * R - d * d) * 0.98); }
    const pts = [
      [0, P.yb], [P.wb * 0.86, P.yb], [P.wb * 0.99, yb + 0.03], [P.wb, yb + 0.16], [P.wb * 1.0, P.belt - 0.12], [P.wb * 0.97, P.belt],
      [lerp(P.wb * 0.95, P.wr, 0.25), P.belt + 0.02], [P.wr, P.ytop - 0.07], [P.wr * 0.88, P.ytop - 0.01], [P.wr * 0.45, P.ytop], [0, P.ytop + 0.005]
    ];
    if (!P.glass) { for (let k = 6; k < RING; k++) { const u = (k - 5) / (RING - 6); pts[k] = [P.wb * 0.97 * (1 - u * u * 0.98), lerp(P.belt, P.ytop, Math.sin(u * Math.PI / 2))]; } }
    rings.push({ z, pts, glass: P.glass, yb });
  }
  const push = (B, p, n, zz) => { B.p.push(...p); B.n.push(...n); if (B.z) B.z.push(zz); return B.p.length / 3 - 1; };
  for (const side of [1, -1]) {
    for (let s = 0; s < ST; s++) {
      const A = rings[s], Bq = rings[s + 1];
      for (let k = 0; k < RING - 1; k++) {
        const isGlass = (k === 6 || k === 7) && A.glass && Bq.glass;
        const isLow = k === 0 || k === 1;
        const target = isGlass ? glass : isLow ? trim : paint;
        const q = [[A, k], [Bq, k], [Bq, k + 1], [A, k + 1]].map(([R, kk]) => [R.pts[kk][0] * side, R.pts[kk][1], R.z]);
        const e1 = [q[1][0] - q[0][0], q[1][1] - q[0][1], q[1][2] - q[0][2]], e2 = [q[3][0] - q[0][0], q[3][1] - q[0][1], q[3][2] - q[0][2]];
        let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        const l = Math.hypot(...n) || 1; n = n.map((v) => v / l);
        /* outward: away from the car's centre line */
        const cx = (q[0][0] + q[2][0]) / 2, cy = (q[0][1] + q[2][1]) / 2 - T.H * 0.45;
        if (n[0] * cx + n[1] * cy < 0) n = n.map((v) => -v);
        const ids = q.map((p) => push(target, p, n, (p[2] / T.L) + 0.5));
        /* wind the quad so its front face points the same way as the outward normal */
        if (faces(q[0], q[1], q[2], n) >= 0) target.i.push(ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]);
        else target.i.push(ids[0], ids[2], ids[1], ids[0], ids[3], ids[2]);
      }
    }
  }
  /* end caps: front and rear faces */
  for (const [s, dir] of [[0, -1], [ST, 1]]) {
    const R = rings[s], c = push(paint, [0, (R.pts[0][1] + R.pts[RING - 1][1]) / 2, R.z], [0, 0, dir], s / ST);
    for (const side of [1, -1]) for (let k = 0; k < RING - 1; k++) {
      const pa = [R.pts[k][0] * side, R.pts[k][1], R.z], pb = [R.pts[k + 1][0] * side, R.pts[k + 1][1], R.z];
      const a = push(paint, pa, [0, 0, dir], s / ST), b = push(paint, pb, [0, 0, dir], s / ST);
      if (faces([0, (R.pts[0][1] + R.pts[RING - 1][1]) / 2, R.z], pa, pb, [0, 0, dir]) >= 0) paint.i.push(c, a, b); else paint.i.push(c, b, a);
    }
  }
  const mk = (B, z) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(B.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(B.n, 3)); if (z) g.setAttribute('cz', new THREE.Float32BufferAttribute(B.z, 1)); g.setIndex(B.i); g.computeBoundingSphere(); return g; };
  const parts = { paint: mk(paint, true), glass: mk(glass), trim: mk(trim) };
  /* bumpers, lights, plates, mirrors as boxes merged per material */
  const boxes = { trim: [], light: [], tail: [], plate: [], chrome: [] };
  const fz = T.L / 2, rz = -T.L / 2, hw = T.W / 2;
  const fP = profile(T, 0.97), rP = profile(T, 0.03);
  boxes.trim.push([0, T.cl + 0.16, fz - 0.03, T.W * 0.92, 0.2, 0.12], [0, T.cl + 0.16, rz + 0.03, T.W * 0.92, 0.2, 0.12]);
  boxes.trim.push([0, fP.belt * 0.62, fz + 0.005, T.W * 0.42, 0.14, 0.03]);
  for (const s of [-1, 1]) {
    boxes.light.push([s * hw * 0.66, fP.belt * 0.86, fz - 0.02, hw * 0.42, 0.1, 0.05]);
    boxes.tail.push([s * hw * 0.7, rP.belt * 0.9, rz + 0.02, hw * 0.4, 0.11, 0.05]);
    if (!T.open) boxes.trim.push([s * (hw + 0.07), profile(T, 1 - T.ws).belt + 0.12, T.L / 2 - T.L * T.ws - 0.05, 0.12, 0.1, 0.16]);
  }
  boxes.plate.push([0, T.cl + 0.36, fz + 0.03, 0.52, 0.11, 0.02], [0, rP.belt * 0.7, rz - 0.03, 0.52, 0.11, 0.02]);
  if (T.taxi) boxes.light.push([0, T.H + 0.08, -0.15, 0.5, 0.14, 0.2]);
  if (T.police) { boxes.tail.push([-0.35, T.H + 0.06, -0.1, 0.6, 0.1, 0.24]); boxes.plate.push([0.35, T.H + 0.06, -0.1, 0.6, 0.1, 0.24]); }
  if (T.open) boxes.chrome.push([0, T.H, -0.25, T.W * 0.8, 0.06, 0.06], [-hw * 0.78, T.H * 0.82, -0.25, 0.06, T.H * 0.4, 0.06], [hw * 0.78, T.H * 0.82, -0.25, 0.06, T.H * 0.4, 0.06]);
  for (const [k, list] of Object.entries(boxes)) parts[k] = mergeBoxes(list);
  /* wheels: a tyre and a rim, one geometry each, placed by the vehicle */
  parts.tyre = new THREE.CylinderGeometry(T.r, T.r, 0.24, 20, 1, false).rotateZ(Math.PI / 2);
  parts.rim = rimGeometry(T.r * 0.68, 0.25);
  parts.wheels = [[hw - 0.12, T.r, axF], [-hw + 0.12, T.r, axF], [hw - 0.12, T.r, axR], [-hw + 0.12, T.r, axR]];
  parts.T = T;
  return parts;
}
function mergeBoxes(list) {
  if (!list.length) return null;
  const geos = list.map(([x, y, z, w, h, d]) => new THREE.BoxGeometry(w, h, d).translate(x, y, z));
  const pos = [], nor = [], idx = []; let off = 0;
  for (const g of geos) { const p = g.attributes.position.array, n = g.attributes.normal.array, ii = g.index.array; for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); } for (const i of ii) idx.push(i + off); off += p.length / 3; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx); return g;
}
function rimGeometry(r, w) {
  const g = new THREE.CylinderGeometry(r, r * 0.92, w, 10, 1, false).rotateZ(Math.PI / 2);
  return g;
}

/* materials: clearcoat paint with metallic flakes and painted door lines, dark tinted glass, rubber, lights */
let MATS = null;
/* clearcoat paint with metallic flakes and door shut lines; each car that needs its own colour gets its own copy */
export function makePaint(color) {
  const paint = new THREE.MeshPhysicalNodeMaterial({ metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.04 });
  const cz = attribute('cz', 'float');
  const flake = fract(sin(dot(positionLocal.mul(420).floor(), vec3(12.9898, 78.233, 45.164))).mul(43758.5453));
  const door = step(abs(cz.sub(0.56)), 0.0018).add(step(abs(cz.sub(0.37)), 0.0018)).mul(step(0.2, normalLocal.x.abs()));
  paint.colorNode = materialColor.mul(mix(float(1), float(0.25), door)).mul(flake.mul(0.08).add(0.96));
  paint.roughnessNode = float(0.3).add(flake.mul(0.12)).sub(U.wet.mul(0.15));
  if (color) paint.color = new THREE.Color(color);
  return paint;
}
export function carMaterials() {
  if (MATS) return MATS;
  const paint = makePaint();
  const glass = new THREE.MeshPhysicalNodeMaterial({ color: 0x0b0f14, metalness: 0.1, roughness: 0.03, clearcoat: 0.6 });
  const trim = new THREE.MeshStandardNodeMaterial({ color: 0x15171a, roughness: 0.55, metalness: 0.1 });
  const chrome = new THREE.MeshStandardNodeMaterial({ color: 0xcfd3d8, roughness: 0.12, metalness: 1 });
  const tyre = new THREE.MeshStandardNodeMaterial({ color: 0x141414, roughness: 0.9 });
  const rim = new THREE.MeshStandardNodeMaterial({ color: 0xa8adb3, roughness: 0.25, metalness: 0.9 });
  const lightU = uniform(0), brakeU = uniform(0);
  const light = new THREE.MeshStandardNodeMaterial({ color: 0xf2f4f6, roughness: 0.1, metalness: 0.2 });
  light.emissiveNode = vec3(1.0, 0.95, 0.85).mul(U.night.mul(6).add(0.25));
  const tail = new THREE.MeshStandardNodeMaterial({ color: 0x6a0a0a, roughness: 0.2 });
  tail.emissiveNode = vec3(1.0, 0.05, 0.03).mul(U.night.mul(2.5).add(0.15).add(brakeU.mul(4)));
  const plate = new THREE.MeshStandardNodeMaterial({ color: 0xf4f4f0, roughness: 0.4 });
  MATS = { paint, glass, trim, chrome, tyre, rim, light, tail, plate, lightU, brakeU };
  void smoothstep;
  return MATS;
}
