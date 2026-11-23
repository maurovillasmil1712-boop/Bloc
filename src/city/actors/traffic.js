/* NPC traffic on the road graph: cars keep to their lane, follow the car ahead with the Intelligent Driver
   Model (smooth gaps, no snapping), stop at red lights, pick a new road at each junction, and slow for you. */
import * as THREE from 'three/webgpu';
import { buildCar, carMaterials } from './carmesh.js';
import { along } from '../core/geom.js';
import { rng } from '../core/rng.js';

const TYPES = ['hatch', 'sedan', 'suv', 'hatch', 'sedan', 'van', 'taxi', 'police'];
const COLORS = ['#F3F4F6', '#1B1E24', '#8A9099', '#B8BCC2', '#7C1E22', '#1F3B66', '#2E4A3A', '#C9C2B0', '#E9E6DF', '#5B616B', '#A34A28', '#14161A'];
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1), UP = new THREE.Vector3(0, 1, 0), C = new THREE.Color();

function frame(e, s) {
  const a = along(e.dense, Math.max(0, Math.min(e.len, s))), i = Math.max(1, a.i);
  const s0 = e.sd ? e.sd[i - 1] : 0, s1 = e.sd ? e.sd[i] : 1, t = s1 > s0 ? Math.max(0, Math.min(1, (s - s0) / (s1 - s0))) : 0;
  return { x: a.x, z: a.z, y: e.ys[i - 1] + (e.ys[i] - e.ys[i - 1]) * t, dx: a.dx, dz: a.dz };
}
export function laneOffset(e, lane) { const lw = Math.min(3.5, e.w / Math.max(1, e.lanes)); return e.lanes <= 1 ? 1.4 : (e.median ? e.median / 2 : 0) + (lane + 0.5) * lw; }

export class Traffic {
  constructor(scene, plan, count) {
    this.plan = plan; this.count = count; this.cars = []; this.R = rng('traffic');
    this.edges = plan.edges.filter((e) => !e.bridge && e.kind !== 'lane' && e.len > 30);
    this.meshes = {}; const M = carMaterials();
    for (const t of new Set(TYPES)) {
      const p = buildCar(t), parts = [[p.paint, M.paint], [p.glass, M.glass], [p.trim, M.trim], [p.light, M.light], [p.tail, M.tail], [p.plate, M.plate], [wheelsGeo(p), M.tyre]].filter(([g]) => g);
      this.meshes[t] = parts.map(([g, m], i) => { const im = new THREE.InstancedMesh(g, m, count); im.count = 0; im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; if (i === 0) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3); scene.add(im); return im; });
      this.meshes[t].T = p.T;
    }
    this.signalT = 0;
  }
  spawn(c, px, pz, near) {
    c.mode = 'lane'; c.kerb = 0; c.siren = false; c.target = null; c.chaser = null;
    for (let tries = 0; tries < 60; tries++) {
      const e = this.edges[Math.floor(this.R() * this.edges.length)];
      const s = 10 + this.R() * Math.max(1, e.len - 20), f = frame(e, s), d = Math.hypot(f.x - px, f.z - pz);
      if (d < (near ? 140 : 40) || d > 380) continue;
      Object.assign(c, { mode: 'lane', kerb: 0, target: null, route: [], e, dir: this.R() < 0.5 ? 1 : -1, s, lane: Math.floor(this.R() * Math.max(1, Math.floor(e.lanes / 2))), v: e.speed * 0.6, v0: e.speed * (0.85 + this.R() * 0.3), turning: null, alive: true, wait: 0 });
      return true;
    }
    c.alive = false; return false;
  }
  init(px, pz) {
    for (let i = 0; i < this.count; i++) {
      const t = TYPES[i % TYPES.length];
      const c = { type: t, color: t === 'taxi' ? '#F6F5F0' : t === 'police' ? '#F3F4F6' : COLORS[Math.floor(this.R() * COLORS.length)], x: 0, z: 0, y: 0, h: 0, mode: 'lane', kerb: 0 };
      this.spawn(c, px, pz, false); this.cars.push(c);
    }
  }
  /* position on the lane: the right-hand side of travel */
  pose(c) {
    const e = c.e, s = c.dir > 0 ? c.s : e.len - c.s, f = frame(e, s), dx = f.dx * c.dir, dz = f.dz * c.dir;
    const off = laneOffset(e, c.lane) + (c.kerb || 0) * Math.max(0, e.w / 2 - 1.3 - laneOffset(e, c.lane));
    c.x = f.x - dz * off * -1 * -1 + 0; c.z = f.z;
    /* right of travel direction (dx, dz) is (-dz, dx) rotated: for heading h = atan2(dx, dz), right = (-cos h, sin h) */
    const h = Math.atan2(dx, dz);
    c.x = f.x - Math.cos(h) * off; c.z = f.z + Math.sin(h) * off; c.y = f.y + 0.02; c.h = h;
  }
  /* the traffic lights you can see: a pole at the right of every approach to a signalled junction, three lamps
     that follow the same phases as signalRed (green, amber for the last 3 s, red) */
  buildLights(scene) {
    const poles = [], items = [];
    for (const n of this.plan.nodes) {
      if (!n.signal) continue;
      for (const id of n.edges) {
        const e = this.plan.edges[id]; if (!e || e.kind === 'lane' || e.bridge) continue;
        const atB = e.b === n.id, s = atB ? e.len - (e.tb || 0) - 1.5 : (e.ta || 0) + 1.5;
        if (s < 2 || s > e.len - 2) continue;
        const f = frame(e, s), dx = atB ? f.dx : -f.dx, dz = atB ? f.dz : -f.dz, h = Math.atan2(dx, dz);
        const off = e.w / 2 + 0.7, x = f.x - Math.cos(h) * off, z = f.z + Math.sin(h) * off;
        const ang = Math.atan2(e.pts[1][1] - e.pts[0][1], e.pts[1][0] - e.pts[0][0]), group = Math.abs(Math.cos(ang)) > 0.7 ? 0 : 1;
        items.push({ x, y: f.y, z, h, node: n, group });
      }
    }
    this.lights = items;
    const N = items.length; if (!N) return;
    const poleG = new THREE.CylinderGeometry(0.06, 0.07, 3.4, 8).translate(0, 1.7, 0);
    const headG = new THREE.BoxGeometry(0.32, 0.9, 0.24).translate(0, 3.3, 0);
    const dark = new THREE.MeshStandardNodeMaterial({ color: '#202327', roughness: 0.5, metalness: 0.4 });
    const pole = new THREE.InstancedMesh(poleG, dark, N), head = new THREE.InstancedMesh(headG, dark, N);
    const lampG = new THREE.CircleGeometry(0.095, 14);
    this.lamps = [0, 1, 2].map((k) => { const m = new THREE.InstancedMesh(lampG, new THREE.MeshBasicNodeMaterial({ color: '#FFFFFF' }), N); m.frustumCulled = false; return m; });
    pole.castShadow = head.castShadow = true; pole.frustumCulled = head.frustumCulled = false;
    const L = new THREE.Matrix4(), off = new THREE.Vector3();
    items.forEach((it, i) => {
      Q.setFromAxisAngle(UP, it.h + Math.PI); P.set(it.x, it.y, it.z); M4.compose(P, Q, S1);
      pole.setMatrixAt(i, M4); head.setMatrixAt(i, M4);
      for (let k = 0; k < 3; k++) { off.set(0, 3.6 - k * 0.29, 0.125); L.copy(M4).multiply(new THREE.Matrix4().makeTranslation(off.x, off.y, off.z)); this.lamps[k].setMatrixAt(i, L); }
    });
    scene.add(pole, head, ...this.lamps);
    this.lightT = 0; this.updateLights(true);
  }
  updateLights(force) {
    if (!this.lights || !this.lamps) return;
    if (!force && (this.lightT += 1) % 6) return;
    const cols = [new THREE.Color(4, 0.25, 0.15), new THREE.Color(3.5, 1.9, 0.1), new THREE.Color(0.2, 3.2, 1.2)], dim = new THREE.Color(0.05, 0.05, 0.05);
    this.lights.forEach((it, i) => {
      const t = (this.signalT + it.node.id * 7.3) % 26;
      const green = it.group === 0 ? t <= 11 : t > 13 && t <= 24, amber = green && (it.group === 0 ? t > 8 : t > 21);
      this.lamps[0].setColorAt(i, !green ? cols[0] : dim);
      this.lamps[1].setColorAt(i, amber ? cols[1] : dim);
      this.lamps[2].setColorAt(i, green && !amber ? cols[2] : dim);
    });
    for (const m of this.lamps) m.instanceColor.needsUpdate = true;
  }
  signalRed(node, e) {
    if (!node.signal) return false;
    const cyc = 26, t = (this.signalT + node.id * 7.3) % cyc;
    const ang = Math.atan2(e.pts[1][1] - e.pts[0][1], e.pts[1][0] - e.pts[0][0]);
    const group = Math.abs(Math.cos(ang)) > 0.7 ? 0 : 1;
    return group === 0 ? t > 11 : t < 13 || t > 24;
  }
  update(dt, player) {
    this.signalT += dt;
    this.updateLights();
    const px = player.x, pz = player.z;
    for (const c of this.cars) {
      if (c.mode === 'free') continue;
      if (!c.alive || (Math.hypot(c.x - px, c.z - pz) > 430 && c.mode === 'lane')) { this.spawn(c, px, pz, true); if (c.alive) this.pose(c); continue; }
      if (c.mode === 'stop') { c.v = 0; this.pose(c); continue; }
      const e = c.e, end = e.len - (c.dir > 0 ? e.tb || 0 : e.ta || 0);
      /* the car ahead: same edge, direction and lane */
      let gap = 1e9, vLead = c.v;
      for (const o of this.cars) { if (o === c || !o.alive || o.e !== e || o.dir !== c.dir || o.lane !== c.lane) continue; const g = o.s - c.s - 5; if (g > -2 && g < gap) { gap = Math.max(0.1, g); vLead = o.v; } }
      /* the player in our lane ahead */
      const fx = Math.sin(c.h), fz = Math.cos(c.h), dxp = px - c.x, dzp = pz - c.z, aheadP = dxp * fx + dzp * fz, sideP = Math.abs(dxp * Math.cos(c.h) - dzp * Math.sin(c.h));
      if (aheadP > 0 && aheadP < 30 && sideP < 2.2) { const g = aheadP - 5; if (g < gap) { gap = Math.max(0.1, g); vLead = Math.max(0, player.forwardSpeed || 0); } }
      /* red light at the end of the road */
      const node = this.plan.nodes[c.dir > 0 ? e.b : e.a];
      if (this.signalRed(node, e) && c.mode !== 'flee' && c.mode !== 'chase') { const g = end - c.s - 3; if (g > -1 && g < gap) { gap = Math.max(0.1, g); vLead = 0; } }
      /* pulling over: ease to the kerb and stop (the police car stops behind its target) */
      if (c.mode === 'pull') { c.kerb = Math.min(1, c.kerb + dt * 0.6); const stopAt = c.target ? c.target.s - (c.target.e === c.e && c.target.dir === c.dir ? 9 : -1e9) : c.s + Math.max(4, c.v * 1.5); const g = stopAt - c.s; if (g < gap) { gap = Math.max(0.1, g); vLead = 0; } if (c.v < 0.3 && c.kerb >= 1 && (!c.target || g < 2 || g > 40)) { c.mode = 'stop'; c.v = 0; } }
      else if (c.kerb > 0) c.kerb = Math.max(0, c.kerb - dt * 0.4);
      /* IDM */
      const a = 2.2, b = 3.4, s0 = 2.5, T = 1.3, dv = c.v - vLead;
      const ss = s0 + Math.max(0, c.v * T + c.v * dv / (2 * Math.sqrt(a * b)));
      const v0 = c.mode === 'flee' ? c.v0 * 1.8 + 6 : c.mode === 'chase' ? c.v0 * 1.8 + 8 : c.v0;
      const acc = a * (c.mode === 'flee' || c.mode === 'chase' ? 1.8 : 1) * (1 - Math.pow(c.v / Math.max(1, v0), 4) - (gap < 1e8 ? (ss / gap) ** 2 : 0));
      c.v = Math.max(0, c.v + Math.max(-9, acc) * dt);
      c.s += c.v * dt;
      if (c.s >= end) {
        /* pick the next road at the junction, not back the way we came */
        const n = node, opts = n.edges.map((id) => this.plan.edges[id]).filter((x) => x !== e && !x.bridge && x.kind !== 'lane' && x.len > 30);
        if (!opts.length) { c.dir = -c.dir; c.s = e.len - c.s; continue; }
        let ne = opts[Math.floor(this.R() * opts.length)];
        if (c.mode === 'chase' && c.route.length) { const want = c.route.shift(); if (opts.includes(want)) ne = want; }
        if (c.mode === 'flee' && c.chaser) c.chaser.route.push(ne);
        c.e = ne; c.dir = ne.a === n.id ? 1 : -1; c.s = c.dir > 0 ? ne.ta || 0 : ne.tb || 0; c.v0 = ne.speed * (0.85 + this.R() * 0.3);
        c.lane = Math.min(c.lane, Math.max(0, Math.floor(ne.lanes / 2) - 1));
      }
      const ox = c.x, oz = c.z, oh = c.h;
      this.pose(c);
      /* ease the heading through junction swaps */
      let dh = c.h - oh; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
      if (Math.abs(dh) > 0.02 && Math.hypot(c.x - ox, c.z - oz) < 6) c.h = oh + dh * Math.min(1, dt * 6);
    }
    this.draw();
  }
  draw() {
    const counts = {};
    for (const t in this.meshes) counts[t] = 0;
    for (const c of this.cars) {
      if (!c.alive) continue;
      const ms = this.meshes[c.type], i = counts[c.type]++;
      Q.setFromAxisAngle(UP, c.h); P.set(c.x, c.y, c.z); M4.compose(P, Q, S1);
      for (const im of ms) im.setMatrixAt(i, M4);
      ms[0].setColorAt(i, C.set(c.color));
    }
    for (const t in this.meshes) for (const im of this.meshes[t]) { im.count = counts[t]; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  }
  /* circles for collisions with the player */
  near(x, z, r) { return this.cars.filter((c) => c.alive && Math.abs(c.x - x) < r && Math.abs(c.z - z) < r); }
}
export function wheelsGeo(p) {
  const pos = [], nor = [], idx = []; let off = 0;
  for (const [x, y, z] of p.wheels) for (const g of [p.tyre, p.rim]) {
    const a = g.attributes.position.array, n = g.attributes.normal.array, ii = g.index.array;
    for (let i = 0; i < a.length; i += 3) { pos.push(a[i] * (g === p.rim ? 1.02 : 1) + x, a[i + 1] + y, a[i + 2] + z); nor.push(n[i], n[i + 1], n[i + 2]); }
    for (const i of ii) idx.push(i + off); off += a.length / 3;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx); return g;
}
