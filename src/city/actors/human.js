/* People, drawn in code: a jointed body with smooth lathed limbs, clothes as shells over the skin, hair and hats,
   and a procedural walk, run, idle, jump and punch. The look is a plain object the server checks:
   { skin, hair, hairC, top: {kind, c}, bottom: {kind, c}, shoes: {kind, c}, hat: {kind, c} } */
import * as THREE from 'three/webgpu';

const V2 = (x, y) => new THREE.Vector2(x, y);
const MATS = new Map();
function mat(color, rough = 0.8, extra) {
  const k = color + rough + (extra ? JSON.stringify(extra) : '');
  if (!MATS.has(k)) MATS.set(k, new THREE.MeshStandardNodeMaterial(Object.assign({ color, roughness: rough, metalness: 0 }, extra || {})));
  return MATS.get(k);
}
/* a tapered capsule hanging down from its joint: radius r0 at the top, r1 at the bottom */
export function limb(len, r0, r1, seg = 14, sx = 1, sz = 1) {
  const pts = [];
  for (let i = 0; i <= 5; i++) { const a = Math.PI / 2 * (1 - i / 5); pts.push(V2(Math.cos(a) * r0 + 1e-4, Math.sin(a) * r0 * 0.7)); }
  for (let i = 1; i < 8; i++) { const t = i / 8, bulge = Math.sin(t * Math.PI) * 0.08; pts.push(V2((r0 + (r1 - r0) * t) * (1 + bulge), -t * len)); }
  for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 * (i / 5); pts.push(V2(Math.cos(a) * r1 + 1e-4, -len + Math.sin(a) * r1 * 0.7)); }
  const g = new THREE.LatheGeometry(pts, seg);
  if (sx !== 1 || sz !== 1) g.scale(sx, 1, sz);
  return g;
}
/* the torso as a lathe with an elliptical section: hips, waist, chest, shoulders */
export function torsoGeo(scale = 1, depth = 0.62, hood = false) {
  const p = [[0.001, -0.02], [0.15, -0.02], [0.165, 0.05], [0.15, 0.16], [0.155, 0.26], [0.175, 0.36], [0.185, 0.43], [0.16, 0.49], [0.09, 0.535], [0.055, 0.545], [0.001, 0.55]];
  const g = new THREE.LatheGeometry(p.map(([r, y]) => V2(r * scale, y)), 20);
  g.scale(1, 1, depth);
  if (hood) {
    const h = new THREE.SphereGeometry(0.11, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6); h.scale(1.05, 0.7, 0.8); h.translate(0, 0.53, -0.07);
    return mergeGeos([g, h]);
  }
  return g;
}
export function mergeGeos(list) {
  const pos = [], nor = [], idx = []; let base = 0;
  for (const g0 of list) {
    const g = g0.index ? g0 : g0; const P = g.attributes.position.array, N = g.attributes.normal.array;
    pos.push(...P); nor.push(...N);
    if (g.index) for (const i of g.index.array) idx.push(i + base); else for (let i = 0; i < P.length / 3; i++) idx.push(i + base);
    base += P.length / 3;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setIndex(idx);
  return out;
}
let RIG_ONLY = false;
function mesh(g, m, parent, x = 0, y = 0, z = 0) {
  if (RIG_ONLY) { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o; }
  const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
}
function joint(parent, x, y, z) { const j = new THREE.Object3D(); j.position.set(x, y, z); parent.add(j); return j; }
function shade(hex, f) { const c = new THREE.Color(hex); c.multiplyScalar(f); return '#' + c.getHexString(); }

export const DEFAULT_LOOK = { skin: '#E8B896', hair: 'short', hairC: '#3B2A1E', top: { kind: 'tee', c: '#F2F2EE' }, bottom: { kind: 'jeans', c: '#3B5578' }, shoes: { kind: 'sneaker', c: '#F4F4F2' }, hat: { kind: 'none', c: '#000000' } };

export class Human {
  constructor(look, opts = {}) {
    this.group = new THREE.Group(); this.group.name = 'human';
    this.h = opts.height || 1;      /* overall scale: 1 is 1.76 m */
    this.phase = Math.random() * 6; this.t = 0; this.punchT = 0; this.punchSide = 1;
    this.rigOnly = !!opts.rigOnly;
    this.build(Object.assign({}, DEFAULT_LOOK, look || {}));
  }
  setLook(look) {
    const keep = { x: this.group.position.x, y: this.group.position.y, z: this.group.position.z, r: this.group.rotation.y };
    while (this.group.children.length) this.group.remove(this.group.children[0]);
    this.build(Object.assign({}, DEFAULT_LOOK, look || {}));
    this.group.position.set(keep.x, keep.y, keep.z); this.group.rotation.y = keep.r;
  }
  build(L) {
    this.look = L; RIG_ONLY = this.rigOnly;
    const root = new THREE.Group(); root.scale.setScalar(this.h); this.group.add(root); this.root = root;
    const skin = mat(L.skin, 0.55), top = mat(L.top.c, L.top.kind === 'jacket' && L.top.c === '#2A201C' ? 0.45 : 0.85), bot = mat(L.bottom.c, 0.88), shoe = mat(L.shoes.c, 0.6), sole = mat('#E9E6E0', 0.7);
    const hair = mat(L.hairC, 0.7), dark = mat('#15120F', 0.4), white = mat('#F4F1EA', 0.3);
    const long = L.top.kind !== 'tee', hoodie = L.top.kind === 'hoodie', jacket = L.top.kind === 'jacket';
    const shorts = L.bottom.kind === 'shorts';
    /* hips sit at 0.94 m; everything hangs from them */
    const hips = this.hips = joint(root, 0, 0.94, 0);
    mesh(limb(0.13, 0.15, 0.135, 18, 1, 0.66), bot, hips, 0, 0.06, 0);
    const spine = this.spine = joint(hips, 0, 0.02, 0);
    const chest = this.chest = joint(spine, 0, 0, 0);
    mesh(torsoGeo(hoodie || jacket ? 1.07 : 1.0, 0.62, hoodie), top, chest, 0, 0, 0);
    if (jacket) { /* open front: a darker shirt panel and a collar */
      const panel = new THREE.BoxGeometry(0.11, 0.38, 0.02); mesh(panel, mat(shade(L.top.c, 0.55) === L.top.c ? '#333' : '#E9E6DF', 0.85), chest, 0, 0.24, 0.112);
      const collar = new THREE.TorusGeometry(0.075, 0.022, 6, 16, Math.PI * 1.3); collar.rotateX(Math.PI / 2); collar.rotateZ(Math.PI * 0.85); mesh(collar, top, chest, 0, 0.52, 0.0);
    }
    if (L.top.kind === 'shirt') { const collar = new THREE.TorusGeometry(0.068, 0.016, 6, 16, Math.PI * 1.2); collar.rotateX(Math.PI / 2); collar.rotateZ(Math.PI * 0.9); mesh(collar, top, chest, 0, 0.535, 0.005); }
    /* neck and head */
    const neck = this.neck = joint(chest, 0, 0.53, 0.005);
    mesh(limb(0.07, 0.048, 0.05, 10), skin, neck, 0, 0.07, 0);
    const head = this.head = joint(neck, 0, 0.09, 0.01);
    const skull = new THREE.SphereGeometry(0.104, 22, 16); skull.scale(0.9, 1.1, 1.0); mesh(skull, skin, head, 0, 0.09, 0);
    const jaw = new THREE.SphereGeometry(0.075, 16, 12); jaw.scale(1.0, 0.85, 1.0); mesh(jaw, skin, head, 0, 0.03, 0.02);
    const ear = new THREE.SphereGeometry(0.022, 8, 6); ear.scale(0.5, 1.2, 0.9);
    mesh(ear, skin, head, 0.092, 0.085, -0.005); mesh(ear, skin, head, -0.092, 0.085, -0.005);
    const nose = new THREE.ConeGeometry(0.014, 0.04, 8); nose.rotateX(Math.PI * 0.42); mesh(nose, skin, head, 0, 0.075, 0.104);
    const eyeW = new THREE.SphereGeometry(0.0155, 10, 8); eyeW.scale(1.2, 0.8, 0.5); const eyeP = new THREE.SphereGeometry(0.0085, 8, 6);
    for (const sx of [1, -1]) {
      mesh(eyeW, white, head, sx * 0.034, 0.1, 0.091); mesh(eyeP, dark, head, sx * 0.034, 0.1, 0.0985);
      const brow = new THREE.BoxGeometry(0.032, 0.006, 0.01); const b = mesh(brow, hair, head, sx * 0.035, 0.124, 0.094); b.rotation.z = sx * -0.12;
    }
    mesh(new THREE.BoxGeometry(0.034, 0.005, 0.006), mat(shade(L.skin, 0.62), 0.5), head, 0, 0.045, 0.092);
    this.buildHair(L, head, hair);
    this.buildHat(L, head);
    /* arms */
    this.arms = [];
    for (const sx of [1, -1]) {
      const sh = joint(chest, sx * 0.19, 0.465, -0.005);
      const cap = new THREE.SphereGeometry(0.054, 12, 10); cap.scale(1, 0.85, 0.9); mesh(cap, top, sh, -sx * 0.01, -0.01, 0);
      const upper = joint(sh, 0, 0, 0);
      mesh(limb(0.28, 0.047, 0.039), skin, upper);
      if (long) mesh(limb(0.285, 0.056, 0.047), top, upper); else mesh(limb(0.14, 0.058, 0.052), top, upper);
      const fore = joint(upper, 0, -0.28, 0);
      mesh(new THREE.SphereGeometry(long ? 0.044 : 0.036, 10, 8), long ? top : skin, fore);
      mesh(limb(0.25, 0.038, 0.03), skin, fore);
      if (long) mesh(limb(0.235, 0.047, 0.04), top, fore);
      const hand = joint(fore, 0, -0.25, 0);
      mesh(new THREE.SphereGeometry(long ? 0.04 : 0.03, 8, 6), long ? top : skin, hand, 0, 0.005, 0);
      const palm = new THREE.SphereGeometry(0.045, 10, 8); palm.scale(0.62, 1.15, 0.95); mesh(palm, skin, hand, 0, -0.045, 0.005);
      const thumb = limb(0.04, 0.012, 0.01, 6); mesh(thumb, skin, hand, sx * -0.022, -0.02, 0.025).rotation.set(0.6, 0, sx * 0.5);
      this.arms.push({ sh, upper, fore, hand, sx });
    }
    /* legs */
    this.legs = [];
    for (const sx of [1, -1]) {
      const hip = joint(hips, sx * 0.09, 0, 0);
      const thigh = joint(hip, 0, 0, 0);
      mesh(limb(0.44, 0.075, 0.053), skin, thigh);
      if (shorts) mesh(limb(0.26, 0.085, 0.072), bot, thigh); else mesh(limb(0.445, L.bottom.kind === 'joggers' ? 0.086 : 0.082, 0.06), bot, thigh);
      const shin = joint(thigh, 0, -0.44, 0);
      mesh(new THREE.SphereGeometry(shorts ? 0.05 : 0.057, 12, 10), shorts ? skin : bot, shin);
      mesh(limb(0.42, 0.052, 0.036), skin, shin);
      if (!shorts) mesh(limb(0.41, 0.06, L.bottom.kind === 'joggers' ? 0.042 : 0.05), bot, shin);
      const ankle = joint(shin, 0, -0.42, 0);
      const boot = L.shoes.kind === 'boot';
      const sh = new THREE.CapsuleGeometry(0.045, 0.16, 4, 10); sh.rotateX(Math.PI / 2); sh.scale(1, boot ? 0.95 : 0.78, 1); mesh(sh, shoe, ankle, 0, -0.035, 0.055);
      const so = new THREE.BoxGeometry(0.094, 0.022, 0.27); mesh(so, boot ? mat('#2A1D14', 0.8) : sole, ankle, 0, -0.072, 0.055);
      if (boot) mesh(limb(0.1, 0.052, 0.05), shoe, ankle, 0, 0.06, 0);
      this.legs.push({ hip, thigh, shin, ankle, sx });
    }
    RIG_ONLY = false;
  }
  buildHair(L, head, hair) {
    const kind = L.hair;
    if (kind === 'none' || (L.hat.kind !== 'none' && kind !== 'long' && kind !== 'bun')) { if (L.hat.kind !== 'none' && kind !== 'none') { const s = new THREE.SphereGeometry(0.108, 18, 10, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.2); s.scale(0.92, 1.1, 1.02); mesh(s, hair, head, 0, 0.09, -0.004); } return; }
    const r = kind === 'buzz' ? 0.106 : kind === 'curly' ? 0.116 : 0.111;
    const cap = new THREE.SphereGeometry(r, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.56);
    cap.scale(0.93, 1.1, 1.04);
    if (kind === 'curly') {
      const p = cap.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1 + 0.07 * Math.sin(x * 90) * Math.sin(y * 80 + 1) * Math.sin(z * 85 + 2); p.setXYZ(i, x * n, y * n, z * n); }
      cap.computeVertexNormals();
    }
    mesh(cap, hair, head, 0, 0.095, -0.006);
    /* a fringe line over the forehead */
    if (kind === 'short' || kind === 'long') { const f = new THREE.SphereGeometry(0.11, 16, 6, -Math.PI * 0.35, Math.PI * 0.7, Math.PI * 0.32, Math.PI * 0.12); f.scale(0.95, 1.1, 1.05); mesh(f, hair, head, 0, 0.095, 0.004); }
    if (kind === 'long') { const back = limb(0.2, 0.085, 0.07, 14, 1.05, 0.55); mesh(back, hair, head, 0, 0.13, -0.05); }
    if (kind === 'bun') mesh(new THREE.SphereGeometry(0.045, 12, 10), hair, head, 0, 0.2, -0.07);
  }
  buildHat(L, head) {
    if (L.hat.kind === 'none') return;
    const m = mat(L.hat.c, 0.85);
    if (L.hat.kind === 'cap') {
      const crown = new THREE.SphereGeometry(0.117, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5); crown.scale(0.95, 0.9, 1.05); mesh(crown, m, head, 0, 0.12, -0.005);
      const brim = new THREE.CylinderGeometry(0.075, 0.075, 0.008, 18, 1, false, -Math.PI / 2, Math.PI); brim.scale(1.2, 1, 1.25); mesh(brim, m, head, 0, 0.122, 0.085).rotation.x = 0.12;
      mesh(new THREE.SphereGeometry(0.012, 8, 6), m, head, 0, 0.225, 0);
    } else {
      const b = new THREE.SphereGeometry(0.12, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55); b.scale(0.95, 1.22, 1.04); mesh(b, m, head, 0, 0.1, -0.008);
      const band = new THREE.TorusGeometry(0.112, 0.016, 8, 24); band.rotateX(Math.PI / 2); band.scale(0.95, 1, 1.04); mesh(band, mat(shade(L.hat.c, 0.85), 0.9), head, 0, 0.115, -0.006);
    }
  }
  /* st: { speed (m/s), air, vy, turn, crouch } */
  animate(dt, st) {
    this.t += dt;
    const v = Math.min(8, st.speed || 0), run = Math.max(0, Math.min(1, (v - 2.2) / 2.8)), moving = Math.min(1, v / 0.6);
    const freq = 0.9 + v * 0.27;
    this.phase += dt * freq * Math.PI * 2 * (v > 0.05 ? 1 : 0);
    const p = this.phase, sp = Math.sin(p), cp = Math.cos(p);
    const breathe = Math.sin(this.t * 1.7) * 0.012;
    /* hips: bob twice per stride, sway */
    const bob = (Math.abs(Math.sin(p)) * -0.035 - 0.005) * moving * (1 + run * 0.9);
    this.hips.position.y = 0.94 + bob - run * 0.03 + (st.air ? 0.02 : 0);
    this.hips.rotation.set(0, sp * 0.08 * moving, -sp * 0.03 * moving * (1 - run));
    this.spine.rotation.set(0.05 * moving + run * 0.2 + (st.air ? -0.08 : 0), -sp * 0.14 * moving, (st.turn || 0) * -0.25 * run);
    this.chest.scale.set(1 + breathe * 0.5, 1 + breathe, 1 + breathe);
    this.neck.rotation.set(-0.05 * moving - run * 0.12, sp * 0.06 * moving, 0);
    this.head.rotation.set(Math.sin(this.t * 0.6) * 0.03 * (1 - moving), Math.sin(this.t * 0.37) * 0.12 * (1 - moving), 0);
    const hipA = (0.42 + run * 0.5) * moving;
    for (const L of this.legs) {
      const s = L.sx > 0 ? sp : -sp, c = L.sx > 0 ? cp : -cp;
      if (st.air) {
        L.thigh.rotation.set(-0.5 - (L.sx > 0 ? 0.3 : -0.1), 0, 0); L.shin.rotation.set(0.9 + (L.sx > 0 ? 0.3 : 0), 0, 0); L.ankle.rotation.set(0.2, 0, 0);
        continue;
      }
      const thigh = -s * hipA - 0.04 * moving;
      /* the knee folds while the leg swings forward, and a little on landing */
      const swing = Math.max(0, c);
      const knee = (0.05 + swing * (0.75 + run * 0.75) + Math.max(0, -s) * 0.12 * run) * moving + (1 - moving) * 0.04;
      L.thigh.rotation.set(thigh, 0, L.sx * 0.02);
      L.shin.rotation.set(knee, 0, 0);
      L.ankle.rotation.set(-thigh * 0.4 - knee * 0.35 + Math.max(0, s) * 0.25 * moving, 0, 0);
    }
    const armA = (0.38 + run * 0.55) * moving;
    for (const A of this.arms) {
      const s = A.sx > 0 ? -sp : sp;
      let pitch = s * armA + 0.05 + run * -0.15, elbow = -(0.15 + run * 1.15 + Math.max(0, -s) * 0.2 * moving), out = A.sx * (0.12 + (1 - moving) * 0.02);
      if (st.air) { pitch = -1.1; elbow = -0.6; out = A.sx * 0.5; }
      /* a jab with the right hand, then the left */
      if (this.punchT > 0 && A.sx === this.punchSide) {
        const k = Math.sin(Math.min(1, (0.32 - this.punchT) / 0.32) * Math.PI);
        pitch = -1.45 * k + pitch * (1 - k); elbow = -0.2 * k + -1.7 * (1 - k); out = A.sx * (0.1 - 0.15 * k);
      } else if (st.guard) { pitch = -0.9; elbow = -1.9; out = A.sx * 0.25; }
      A.upper.rotation.set(pitch, 0, out);
      A.fore.rotation.set(elbow, 0, 0);
      A.hand.rotation.set(-0.1, 0, 0);
    }
    if (this.punchT > 0) { this.punchT -= dt; this.spine.rotation.y += this.punchSide * -0.35 * Math.sin(Math.max(0, this.punchT) / 0.32 * Math.PI); }
  }
  punch() { if (this.punchT > 0.08) return false; this.punchSide = -this.punchSide; this.punchT = 0.32; return true; }
  /* hand position in world space, for hits */
  fist() { const A = this.arms.find((a) => a.sx === this.punchSide); const v = new THREE.Vector3(0, -0.06, 0); A.hand.localToWorld(v); return v; }
}
