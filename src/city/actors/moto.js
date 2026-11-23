/* Motorbikes, built from boxes and cylinders in code, in the same parts format as buildCar() so traffic and the
   player's Vehicle can use them: paint, trim, light, tail, plate, chrome, tyre, rim, wheels, T. Traffic bikes also
   get a rider (rider: dark clothes, helmet merged into the paint so it takes the bike's colour). +z is forward. */
import * as THREE from 'three/webgpu';

export const MOTO_T = { L: 2.1, W: 0.8, H: 1.15, wb: 1.42, r: 0.31, cl: 0.25, top: 48, acc: 17, grip: 1.05, mass: 420, moto: true };

function merge(list) {
  if (!list.length) return null;
  const pos = [], nor = [], idx = []; let off = 0;
  for (const g0 of list) {
    const g = g0.index ? g0 : g0;
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); }
    if (g.index) for (const i of g.index.array) idx.push(i + off); else for (let i = 0; i < p.length / 3; i++) idx.push(i + off);
    off += p.length / 3;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
  return g;
}
const box = (w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) => new THREE.BoxGeometry(w, h, d).rotateX(rx).rotateY(ry).rotateZ(rz).translate(x, y, z);
const ball = (sx, sy, sz, x, y, z, seg = 12) => new THREE.SphereGeometry(1, seg, Math.max(6, seg - 4)).scale(sx, sy, sz).translate(x, y, z);
const rod = (r, len, x, y, z, rx = 0) => new THREE.CylinderGeometry(r, r, len, 8).rotateX(rx).translate(x, y, z);

export function buildMoto(rider = false) {
  const T = MOTO_T, axF = 0.71, axR = -0.71;
  const paint = [
    ball(0.17, 0.12, 0.27, 0, 0.86, 0.14),           /* tank */
    box(0.42, 0.36, 0.1, 0, 0.92, 0.6, -0.45),        /* front fairing */
    box(0.36, 0.14, 0.26, 0, 0.76, 0.5, -0.2),
    box(0.22, 0.1, 0.42, 0, 0.84, -0.46, 0.18),       /* tail */
    box(0.2, 0.04, 0.4, 0, 0.62, axF + 0.02, 0.15)    /* front mudguard */
  ];
  const trim = [
    box(0.07, 0.07, 1.05, 0, 0.6, 0.02, 0.12),        /* frame */
    box(0.3, 0.3, 0.42, 0, 0.42, 0.02),               /* engine */
    box(0.28, 0.08, 0.5, 0, 0.88, -0.2, 0.05),        /* seat */
    box(0.06, 0.06, 0.62, 0.12, 0.35, -0.38, 0.12), box(0.06, 0.06, 0.62, -0.12, 0.35, -0.38, 0.12),   /* swingarm */
    box(0.64, 0.03, 0.03, 0, 1.03, 0.5), box(0.05, 0.05, 0.12, 0.31, 1.03, 0.5), box(0.05, 0.05, 0.12, -0.31, 1.03, 0.5),
    box(0.03, 0.12, 0.02, 0.22, 1.08, 0.52), box(0.03, 0.12, 0.02, -0.22, 1.08, 0.52)
  ];
  const chrome = [
    box(0.04, 0.72, 0.04, 0.09, 0.66, 0.63, 0.38), box(0.04, 0.72, 0.04, -0.09, 0.66, 0.63, 0.38),   /* forks */
    rod(0.04, 0.6, 0.16, 0.32, -0.42, Math.PI / 2 - 0.1)    /* exhaust */
  ];
  const light = [box(0.15, 0.1, 0.05, 0, 0.96, 0.68, -0.4)];
  const tail = [box(0.14, 0.05, 0.04, 0, 0.86, -0.68)];
  const plate = [box(0.17, 0.11, 0.02, 0, 0.7, -0.7, 0.3)];
  let riderG = null;
  if (rider) {
    /* sitting, leaning onto the bars: torso, upper arms, forearms, thighs, shins, boots */
    riderG = merge([
      box(0.36, 0.56, 0.24, 0, 1.24, -0.08, 0.55),
      box(0.09, 0.32, 0.09, 0.2, 1.24, 0.17, 1.0), box(0.09, 0.32, 0.09, -0.2, 1.24, 0.17, 1.0),
      box(0.08, 0.3, 0.08, 0.27, 1.1, 0.38, 1.7), box(0.08, 0.3, 0.08, -0.27, 1.1, 0.38, 1.7),
      box(0.14, 0.14, 0.46, 0.15, 0.95, 0.0, -0.15), box(0.14, 0.14, 0.46, -0.15, 0.95, 0.0, -0.15),
      box(0.12, 0.44, 0.12, 0.2, 0.68, 0.18, 0.35), box(0.12, 0.44, 0.12, -0.2, 0.68, 0.18, 0.35),
      box(0.11, 0.09, 0.22, 0.21, 0.45, 0.28), box(0.11, 0.09, 0.22, -0.21, 0.45, 0.28)
    ]);
    paint.push(ball(0.15, 0.16, 0.17, 0, 1.64, 0.12, 14));     /* helmet */
    trim.push(box(0.2, 0.07, 0.03, 0, 1.64, 0.28, -0.1));      /* visor */
  }
  const P = merge(paint);
  P.setAttribute('cz', new THREE.Float32BufferAttribute(new Float32Array(P.attributes.position.count), 1));
  const parts = {
    paint: P, glass: null, trim: merge(trim), chrome: merge(chrome), light: merge(light), tail: merge(tail), plate: merge(plate), rider: riderG,
    tyre: new THREE.TorusGeometry(T.r - 0.06, 0.07, 10, 24).rotateY(Math.PI / 2),
    rim: new THREE.CylinderGeometry(T.r - 0.1, T.r - 0.1, 0.06, 14).rotateZ(Math.PI / 2),
    wheels: [[0, T.r, axF], [0, T.r, axR]], T
  };
  return parts;
}
