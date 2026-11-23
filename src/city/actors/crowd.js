/* Pedestrians: dozens of people on the pavements, drawn with one instanced mesh per body part (about 15 draw calls
   for the whole crowd). One hidden rig poses each person in turn with the same walk as the player's character;
   colours come from per-instance attributes: clothes, skin, and how long sleeves and trousers are. */
import * as THREE from 'three/webgpu';
import { attribute, mix, step, vec3 } from 'three/tsl';
import { Human, limb, torsoGeo, mergeGeos } from './human.js';
import { along } from '../core/geom.js';
import { rng } from '../core/rng.js';
import { sampleHeight } from '../world/plan.js';

/* ---- part geometries, in their joint's space, tagged for the shader ---- */
function tag(g, zone, zd0 = 0, lk = 0, vc = [1, 1, 1]) {
  g = g.index ? g.toNonIndexed() : g;
  const n = g.attributes.position.count, zi = new Float32Array(n * 3), col = new Float32Array(n * 3), P = g.attributes.position.array;
  for (let i = 0; i < n; i++) { zi[i * 3] = zone; zi[i * 3 + 1] = zd0 - P[i * 3 + 1]; zi[i * 3 + 2] = lk; col[i * 3] = vc[0]; col[i * 3 + 1] = vc[1]; col[i * 3 + 2] = vc[2]; }
  g.setAttribute('zi', new THREE.BufferAttribute(zi, 3)); g.setAttribute('vc', new THREE.BufferAttribute(col, 3));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'zi', 'vc'].includes(k)) g.deleteAttribute(k);
  return g;
}
function join(list) {
  const out = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'zi', 'vc']) {
    const arrs = list.map((g) => g.attributes[k].array), len = arrs.reduce((a, b) => a + b.length, 0), buf = new Float32Array(len);
    let o = 0; for (const a of arrs) { buf.set(a, o); o += a.length; }
    out.setAttribute(k, new THREE.BufferAttribute(buf, 3));
  }
  return out;
}
const at = (g, x, y, z) => { g.translate(x, y, z); return g; };
const sph = (r, sx = 1, sy = 1, sz = 1, ws = 10, hs = 8) => { const g = new THREE.SphereGeometry(r, ws, hs); g.scale(sx, sy, sz); return g; };
const WHITE = [0.93, 0.92, 0.88], DARK = [0.06, 0.05, 0.045], BROW = [0.16, 0.11, 0.08], LIP = [0.45, 0.25, 0.22];
function parts() {
  void mergeGeos;
  const torso = join([tag(torsoGeo(1.0, 0.62), 0), tag(at(limb(0.07, 0.048, 0.05, 10), 0, 0.6, 0.005), 1)]);
  const head = join([tag(at(sph(0.104, 0.9, 1.1, 1, 16, 12), 0, 0.09, 0), 1), tag(at(sph(0.075, 1, 0.85, 1, 12, 9), 0, 0.03, 0.02), 1),
    tag(at(sph(0.022, 0.5, 1.2, 0.9, 6, 5), 0.092, 0.085, -0.005), 1), tag(at(sph(0.022, 0.5, 1.2, 0.9, 6, 5), -0.092, 0.085, -0.005), 1),
    tag(at(new THREE.ConeGeometry(0.014, 0.04, 6).rotateX(Math.PI * 0.42), 0, 0.075, 0.104), 1),
    ...[1, -1].flatMap((sx) => [tag(at(sph(0.0155, 1.2, 0.8, 0.5, 8, 6), sx * 0.034, 0.1, 0.091), 2, 0, 0, WHITE), tag(at(sph(0.0085, 1, 1, 1, 6, 5), sx * 0.034, 0.1, 0.0985), 2, 0, 0, DARK),
      tag(at(new THREE.BoxGeometry(0.032, 0.006, 0.01).rotateZ(sx * -0.12), sx * 0.035, 0.124, 0.094), 2, 0, 0, BROW)]),
    tag(at(new THREE.BoxGeometry(0.034, 0.005, 0.006), 0, 0.045, 0.092), 2, 0, 0, LIP)]);
  const upper = join([tag(at(sph(0.054, 1, 0.85, 0.9), 0, -0.01, 0), 0), tag(limb(0.28, 0.05, 0.042, 10), -1, 0, 0)]);
  const fore = join([tag(sph(0.042), -1, 0.28, 0), tag(limb(0.25, 0.041, 0.032, 10), -1, 0.28, 0)]);
  const hand = join([tag(at(sph(0.045, 0.62, 1.15, 0.95, 8, 6), 0, -0.045, 0.005), 1)]);
  const thigh = join([tag(limb(0.44, 0.08, 0.057, 12), -1, 0, 1)]);
  const shin = join([tag(sph(0.06), -1, 0.44, 1), tag(limb(0.42, 0.058, 0.042, 10), -1, 0.44, 1)]);
  const foot = join([tag(at(new THREE.CapsuleGeometry(0.045, 0.16, 3, 8).rotateX(Math.PI / 2).scale(1, 0.78, 1), 0, -0.035, 0.055), 0), tag(at(new THREE.BoxGeometry(0.094, 0.022, 0.27), 0, -0.072, 0.055), 2, 0, 0, WHITE)]);
  const pelvis = join([tag(at(limb(0.13, 0.15, 0.135, 14, 1, 0.66), 0, 0.06, 0), 0)]);
  const capS = () => { const g = new THREE.SphereGeometry(0.111, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.56); g.scale(0.93, 1.1, 1.04); return at(g, 0, 0.095, -0.006); };
  const hair = {
    short: join([tag(capS(), 0)]),
    long: join([tag(capS(), 0), tag(at(limb(0.2, 0.085, 0.07, 12, 1.05, 0.55), 0, 0.13, -0.05), 0)]),
    bun: join([tag(capS(), 0), tag(at(sph(0.045), 0, 0.2, -0.07), 0)]),
    curly: join([tag((() => { const g = capS(); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1.04 + 0.06 * Math.sin(x * 90) * Math.sin(y * 80 + 1) * Math.sin(z * 85 + 2); p.setXYZ(i, x * n, (y - 0.095) * n + 0.095, z * n); } g.computeVertexNormals(); return g; })(), 0)])
  };
  const hat = {
    cap: join([tag(at((() => { const g = new THREE.SphereGeometry(0.117, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5); g.scale(0.95, 0.9, 1.05); return g; })(), 0, 0.12, -0.005), 0), tag(at(new THREE.CylinderGeometry(0.075, 0.075, 0.008, 14, 1, false, -Math.PI / 2, Math.PI).scale(1.2, 1, 1.25), 0, 0.122, 0.085), 0)]),
    beanie: join([tag(at((() => { const g = new THREE.SphereGeometry(0.12, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.55); g.scale(0.95, 1.22, 1.04); return g; })(), 0, 0.1, -0.008), 0)])
  };
  return { torso, head, upper, fore, hand, thigh, shin, foot, pelvis, hair, hat };
}

const TOPS = ['#F2F2EE', '#22262F', '#8D9096', '#3F5E45', '#4A6A93', '#7A1F2B', '#C8383C', '#E7DCC6', '#8FB3D9', '#2A201C', '#D9692B', '#5B4A7A', '#E8C547', '#1D1F24', '#B7C4C9'];
const BOTTOMS = ['#3B5578', '#1E2026', '#C4B08A', '#7E8288', '#283A5A', '#202227', '#4B5135', '#6E5A44', '#2F3E56'];
const SHOES = ['#F4F4F2', '#1A1B1F', '#5A3A24', '#8E8F94', '#B8323A', '#2B4F81'];
const SKINS = ['#F6D7C3', '#E8B896', '#D9A47E', '#C98E66', '#9A6440', '#6B4228', '#3F2718'];
const HAIRC = ['#1B1714', '#2A1E16', '#3B2A1E', '#6A4A2E', '#A7763F', '#D9B26B', '#8E8E8E', '#D6D6D2'];
const HAIRS = ['short', 'short', 'short', 'long', 'long', 'bun', 'curly', 'curly', 'none'];
const hex3 = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };

export class Crowd {
  constructor(scene, plan, count) {
    this.plan = plan; this.N = count; this.R = rng('crowd'); this.scene = scene; this.t = 0;
    this.walkable = plan.edges.filter((e) => e.sw >= 2.5 && !e.bridge && e.kind !== 'ronda' && e.len > 25);
    this.poser = new Human(null, { rigOnly: true });
    const P = parts(), cap = (k) => count * k;
    const mat = new THREE.MeshStandardNodeMaterial({ roughness: 0.75, metalness: 0 });
    const zi = attribute('zi', 'vec3'), vc = attribute('vc', 'vec3'), cloth = attribute('cloth', 'vec3'), skin = attribute('skin', 'vec3'), lim = attribute('lim', 'vec2');
    const limbSkin = step(mix(lim.x, lim.y, zi.z), zi.y), isLimb = step(zi.x, -0.5);
    const skinAmt = mix(zi.x.clamp(0, 1), limbSkin, isLimb);
    mat.colorNode = mix(mix(cloth, skin, skinAmt), vc, step(1.5, zi.x));
    mat.roughnessNode = mix(mix(0.85, 0.55, skinAmt), 0.4, step(1.5, zi.x));
    this.parts = [];
    const add = (name, geo, k, joint, colorOf) => {
      const g = geo.clone(), n = cap(k);
      g.setAttribute('cloth', new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3));
      g.setAttribute('skin', new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3));
      g.setAttribute('lim', new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2));
      const m = new THREE.InstancedMesh(g, mat, n); m.count = 0; m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; m.name = 'crowd-' + name;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(m);
      this.parts.push({ name, m, g, joint, colorOf, k, n: 0 });
    };
    const pose = this.poser;
    add('torso', P.torso, 1, () => [pose.chest], (p) => p.top);
    add('pelvis', P.pelvis, 1, () => [pose.hips], (p) => p.bottom);
    add('head', P.head, 1, () => [pose.head], (p) => p.top);
    add('upper', P.upper, 2, () => pose.arms.map((a) => a.upper), (p) => p.top);
    add('fore', P.fore, 2, () => pose.arms.map((a) => a.fore), (p) => p.top);
    add('hand', P.hand, 2, () => pose.arms.map((a) => a.hand), (p) => p.top);
    add('thigh', P.thigh, 2, () => pose.legs.map((l) => l.thigh), (p) => p.bottom);
    add('shin', P.shin, 2, () => pose.legs.map((l) => l.shin), (p) => p.bottom);
    add('foot', P.foot, 2, () => pose.legs.map((l) => l.ankle), (p) => p.shoes);
    for (const h of ['short', 'long', 'bun', 'curly']) add('hair-' + h, P.hair[h], 1, (p) => (p.hair === h && !(p.hat && h !== 'long' && h !== 'bun') ? [pose.head] : []), (p) => p.hairC);
    for (const h of ['cap', 'beanie']) add('hat-' + h, P.hat[h], 1, (p) => (p.hat === h ? [pose.head] : []), (p) => p.hatC);
    this.people = [];
    for (let i = 0; i < count; i++) this.people.push(this.makePerson(i));
    this.M = new THREE.Matrix4();
  }
  makePerson(i) {
    const R = this.R, pick = (a) => a[Math.floor(R() * a.length)];
    const shorts = R() < 0.18, longS = R() < 0.55;
    const p = {
      i, alive: false, e: null, s: 0, dir: 1, side: 1, x: 0, y: 0, z: 0, h: 0, v: 1.1 + R() * 0.5, state: 'walk', t: 0, phase: R() * 6, rt: R() * 10,
      scale: 0.9 + R() * 0.18, top: hex3(pick(TOPS)), bottom: hex3(pick(BOTTOMS)), shoes: hex3(pick(SHOES)), skin: hex3(pick(SKINS)), hairC: hex3(pick(HAIRC)),
      hair: pick(HAIRS), hat: R() < 0.16 ? (R() < 0.6 ? 'cap' : 'beanie') : null, hatC: hex3(pick(TOPS)), sleeve: longS ? 1 : 0.14, leg: shorts ? 0.27 : 1,
      voice: R() < 0.5 ? 'f' : 'm', name: null, look: 0, lean: 0, fall: 0, hp: 3 + Math.floor(R() * 3), anger: 0, punchT: 0, punchSide: 1, nextPunch: 0
    };
    p.hairS = p.hair === 'none' ? null : p.hair;
    p.hair = p.hairS;
    return p;
  }
  spawn(p, px, pz, far) {
    /* somewhere on a pavement 40 to 140 m away, out of the way */
    for (let tries = 0; tries < 12; tries++) {
      const e = this.walkable[Math.floor(this.R() * this.walkable.length)];
      const mid = e.dense[Math.floor(e.dense.length / 2)], d = Math.hypot(mid[0] - px, mid[1] - pz);
      if (d > 170 || (far && d < 45) || (!far && d < 6)) continue;
      p.e = e; p.s = this.R() * e.len; p.dir = this.R() < 0.5 ? 1 : -1; p.side = this.R() < 0.5 ? 1 : -1; p.off = e.w / 2 + e.sw * (0.45 + this.R() * 0.25);
      p.alive = true; p.state = 'walk'; p.t = 0; p.fall = 0; p.hp = 3 + Math.floor(this.R() * 3); p.anger = 0; this.place(p); return true;
    }
    p.alive = false; return false;
  }
  place(p) {
    const a = along(p.e.dense, Math.max(0, Math.min(p.e.len, p.s)));
    p.x = a.x - a.dz * p.side * p.off; p.z = a.z + a.dx * p.side * p.off;
    p.y = sampleHeight(this.plan.height, p.x, p.z) + 0.12;
    if (p.state === 'walk') { const h = Math.atan2(a.dx * p.dir, a.dz * p.dir); p.h += angDiff(h, p.h) * 0.25; }
  }
  /* me: { x, z } of the player on foot (or null), car: { x, z, vx, vz, speed } when driving; returns events for the game */
  update(dt, me, car, hooks) {
    this.t += dt;
    const fx = me ? me.x : car.x, fz = me ? me.z : car.z;
    for (const p of this.people) {
      if (!p.alive) { this.spawn(p, fx, fz, this.t > 2); continue; }
      const d = Math.hypot(p.x - fx, p.z - fz);
      if (d > 190) { this.spawn(p, fx, fz, true); continue; }
      p.t += dt;
      /* cars coming at you: jump out of the way, or get knocked over */
      if (car && car.speed > 5 && p.state !== 'down') {
        const rx = p.x - car.x, rz = p.z - car.z, dist = Math.hypot(rx, rz);
        if (dist < 14) {
          const cvx = car.vx / car.speed, cvz = car.vz / car.speed, ahead = rx * cvx + rz * cvz, side = rx * cvz - rz * cvx;
          if (dist < 1.6) { p.state = 'down'; p.t = 0; p.fall = 0; p.fallDir = Math.atan2(cvx, cvz); if (hooks.hit) hooks.hit(p, car.speed); }
          else if (ahead > 0 && ahead < 4 + car.speed * 0.6 && Math.abs(side) < 2.6 && p.state !== 'flee') { p.state = 'flee'; p.t = 0; p.fleeH = Math.atan2(cvz * Math.sign(side || 1), -cvx * Math.sign(side || 1)); if (hooks.scared) hooks.scared(p); }
        }
      }
      if (p.state === 'walk') {
        p.s += p.v * dt * p.dir;
        if (p.s < 0 || p.s > p.e.len) this.turnCorner(p);
        this.place(p);
        if (p.rt < this.t && this.R() < 0.02) { p.rt = this.t + 6 + this.R() * 10; if (this.R() < 0.35) { p.state = 'idle'; p.t = 0; p.idleFor = 3 + this.R() * 7; } }
      } else if (p.state === 'idle' || p.state === 'talk' || p.state === 'chat') {
        if (p.state === 'idle' && p.t > p.idleFor) p.state = 'walk';
        if (p.state === 'talk' && p.t > p.talkFor) { p.state = 'walk'; if (p.partner) { p.partner.state = 'walk'; p.partner.partner = null; } p.partner = null; }
        if (p.face != null) p.h += angDiff(p.face, p.h) * Math.min(1, dt * 5);
      } else if (p.state === 'stagger') {
        p.x += p.kx * dt * 2.2 * Math.max(0, 1 - p.t * 2.5); p.z += p.kz * dt * 2.2 * Math.max(0, 1 - p.t * 2.5);
        p.y = sampleHeight(this.plan.height, p.x, p.z) + 0.12;
        if (p.t > 0.5) {
          p.t = 0;
          if (p.anger >= 2 || this.R() < 0.35) { p.state = 'fight'; p.nextPunch = this.t + 0.8; if (hooks.taunt) hooks.taunt(p); }
          else { p.state = 'flee'; p.fleeH = Math.atan2(p.kx, p.kz); if (hooks.scared) hooks.scared(p); }
        }
      } else if (p.state === 'fight') {
        /* square up to you, close in, throw a punch every second or so */
        if (!me || Math.hypot(me.x - p.x, me.z - p.z) > 14 || p.t > 40) { p.state = 'walk'; this.snap(p); }
        else {
          const dx = me.x - p.x, dz = me.z - p.z, d = Math.hypot(dx, dz);
          p.h += angDiff(Math.atan2(dx, dz), p.h) * Math.min(1, dt * 8);
          if (d > 1.05) { const sp = Math.min(2.6, (d - 1.0) * 3); p.x += dx / d * sp * dt; p.z += dz / d * sp * dt; p.y = sampleHeight(this.plan.height, p.x, p.z) + 0.12; }
          if (this.t > p.nextPunch && d < 1.5) {
            p.nextPunch = this.t + 0.9 + this.R() * 0.8; p.punchSide = -p.punchSide; p.punchT = 0.32;
            setTimeout(() => { if (p.state === 'fight' && me && Math.hypot(hooks.meNow().x - p.x, hooks.meNow().z - p.z) < 1.45 && hooks.punchPlayer) hooks.punchPlayer(p); }, 140);
          }
        }
        if (p.punchT > 0) p.punchT -= dt;
      } else if (p.state === 'flee') {
        const sp = 4.6; p.x += Math.sin(p.fleeH) * sp * dt; p.z += Math.cos(p.fleeH) * sp * dt; p.h += angDiff(p.fleeH, p.h) * Math.min(1, dt * 8);
        /* run around buildings, not through them */
        if (this.collide) { const q = { x: p.x, z: p.z }; if (this.collide.resolve(q, 0.3, p.y + 0.9, { x: 0, z: 0 }) > 0.02) { p.x = q.x; p.z = q.z; p.fleeH += (p.i % 2 ? 1 : -1) * dt * 3; } }
        p.y = sampleHeight(this.plan.height, p.x, p.z) + 0.12;
        if (p.t > (p.fleeFor || 1.6)) { p.state = 'walk'; p.fleeFor = 0; this.snap(p); }
      } else if (p.state === 'down') {
        p.fall = Math.min(1, p.fall + dt * 3);
        if (p.t > (p.downFor || 3.2)) {
          /* shot with blood on: they're taken away (a new person walks in somewhere else); otherwise they get up */
          if (p.gone) { p.alive = false; p.gone = false; p.downFor = 0; }
          else { p.state = p.downFor ? 'flee' : 'walk'; p.fleeFor = p.downFor ? 5 : 0; p.t = 0; p.downFor = 0; p.fall = 0; if (p.state === 'walk') this.snap(p); if (hooks.up) hooks.up(p); }
        }
      }
      /* step around the player on foot */
      if (me && p.state !== 'down') { const dx = p.x - me.x, dz = p.z - me.z, dd = Math.hypot(dx, dz); if (dd < 0.75 && dd > 1e-3) { p.x = me.x + dx / dd * 0.75; p.z = me.z + dz / dd * 0.75; if (hooks.bump && p.state === 'walk' && this.R() < dt * 3) hooks.bump(p); } }
    }
    /* now and then two people stop for a chat */
    if (Math.floor(this.t * 2) !== Math.floor((this.t - dt) * 2)) {
      for (const a of this.people) {
        if (!a.alive || a.state !== 'walk' || this.R() > 0.08) continue;
        for (const b of this.people) {
          if (b === a || !b.alive || b.state !== 'walk' || Math.abs(b.x - a.x) > 2.5 || Math.abs(b.z - a.z) > 2.5) continue;
          const len = 9 + this.R() * 8;
          a.state = b.state = 'talk'; a.t = b.t = 0; a.talkFor = b.talkFor = len; a.partner = b; b.partner = a;
          a.face = Math.atan2(b.x - a.x, b.z - a.z); b.face = Math.atan2(a.x - b.x, a.z - b.z);
          if (hooks.pair) hooks.pair(a, b);
          break;
        }
      }
    }
  }
  /* you landed a punch on p from direction (fx, fz) */
  hitPerson(p, fx, fz) {
    p.hp -= 1; p.anger += 1; p.kx = fx; p.kz = fz;
    if (p.hp <= 0) { p.state = 'down'; p.t = 0; p.fall = 0; p.fallDir = Math.atan2(fx, fz) + Math.PI; p.hp = 3; p.anger = 0; return 'down'; }
    if (p.state === 'fight') { p.x += fx * 0.35; p.z += fz * 0.35; return 'hit'; }
    p.state = 'stagger'; p.t = 0; return 'hit';
  }
  /* a bullet hit p for dmg from direction (fx, fz). blood: whether the player has blood on (they stay down) */
  shoot(p, dmg, fx, fz, blood) {
    if (p.state === 'down') { if (blood) p.downFor = Math.max(p.downFor || 0, p.t + 10); return 'down'; }
    p.life = (p.life == null ? 100 : p.life) - dmg; p.kx = fx; p.kz = fz;
    if (p.life <= 0) {
      p.state = 'down'; p.t = 0; p.fall = 0; p.fallDir = Math.atan2(fx, fz) + Math.PI; p.life = 100; p.anger = 0;
      p.downFor = blood ? 18 : 6; p.gone = !!blood; p.fleeH = Math.atan2(fx, fz);
      return 'down';
    }
    p.state = 'flee'; p.t = 0; p.fleeH = Math.atan2(fx, fz) + (this.R() - 0.5); p.fleeFor = 6;
    return 'hit';
  }
  /* gunfire at (x, z): everyone within r runs away from it */
  panic(x, z, r, each) {
    for (const p of this.people) {
      if (!p.alive || p.state === 'down') continue;
      const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz); if (d > r) continue;
      if (p.state !== 'flee' && each) each(p);
      if (p.partner) { p.partner.partner = null; p.partner = null; }
      p.state = 'flee'; p.t = 0; p.fleeH = Math.atan2(dx, dz) + (this.R() - 0.5) * 0.8; p.fleeFor = 4 + this.R() * 4;
    }
  }
  /* someone in front of you, close enough to hit */
  inReach(x, z, a, r = 1.15) {
    let best = null, bd = r;
    for (const p of this.people) {
      if (!p.alive || p.state === 'down') continue;
      const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz);
      if (d > bd || d < 1e-3) continue;
      const cosA = (dx * Math.sin(a) + dz * Math.cos(a)) / d; if (cosA < 0.45) continue;
      bd = d; best = p;
    }
    return best;
  }
  turnCorner(p) {
    const atEnd = p.s > p.e.len, node = this.plan.nodes[atEnd ? p.e.b : p.e.a];
    const opts = node.edges.map((id) => this.plan.edges[id]).filter((x) => x !== p.e && x.sw >= 2.5 && !x.bridge && x.kind !== 'ronda');
    if (!opts.length) { p.dir = -p.dir; p.s = Math.max(0, Math.min(p.e.len, p.s)); return; }
    const ne = opts[Math.floor(this.R() * opts.length)];
    p.e = ne; p.dir = ne.a === node.id ? 1 : -1; p.s = p.dir > 0 ? 0.5 : ne.len - 0.5; p.off = ne.w / 2 + ne.sw * (0.45 + this.R() * 0.25);
  }
  /* back onto the nearest point of the pavement after running off */
  snap(p) {
    const a = along(p.e.dense, Math.max(0, Math.min(p.e.len, p.s)));
    const sx = a.x - a.dz * p.side * p.off, sz = a.z + a.dx * p.side * p.off;
    if (Math.hypot(sx - p.x, sz - p.z) > 6) { p.side = -p.side; }
  }
  /* the nearest person you could talk to */
  nearest(x, z, r = 2.3) {
    let best = null, bd = r;
    for (const p of this.people) { if (!p.alive || p.state === 'down' || p.state === 'flee') continue; const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  draw(dt, camera) {
    for (const part of this.parts) part.n = 0;
    const pose = this.poser, M = this.M, cx = camera.position.x, cz = camera.position.z;
    for (const p of this.people) {
      if (!p.alive || Math.hypot(p.x - cx, p.z - cz) > 140) continue;
      pose.phase = p.phase; pose.t = p.t;
      const g = pose.group; g.position.set(p.x, p.y - 0.12, p.z); g.rotation.set(0, p.h, 0); pose.root.scale.setScalar(p.scale);
      const speed = p.state === 'walk' ? p.v : p.state === 'flee' ? 4.6 : p.state === 'fight' ? 0.6 : 0;
      pose.punchT = p.punchT || 0; pose.punchSide = p.punchSide || 1;
      pose.animate(dt, { speed, guard: p.state === 'fight' });
      if (p.state === 'stagger') { g.rotation.x = -0.25 * Math.max(0, 1 - p.t * 2); }
      if (p.state === 'talk' || p.state === 'chat') { /* talking: a hand moves now and then */ const k = Math.sin(p.t * 3.1 + p.i) * 0.5 + 0.5; pose.arms[0].upper.rotation.x = -0.35 * k; pose.arms[0].fore.rotation.x = -1.2 * k - 0.2; }
      if (p.state === 'down') { const f = p.fall; g.rotation.set(-1.45 * f, p.fallDir || p.h, 0, 'YXZ'); g.position.y -= 0.05 * f; }
      p.phase = pose.phase;
      g.updateMatrixWorld(true);
      for (const part of this.parts) {
        const joints = part.joint(p);
        for (const j of joints) {
          if (part.n >= part.m.instanceMatrix.count) break;
          const i = part.n++;
          part.m.setMatrixAt(i, j.matrixWorld);
          const c = part.colorOf(p);
          part.g.attributes.cloth.setXYZ(i, c[0], c[1], c[2]);
          part.g.attributes.skin.setXYZ(i, p.skin[0], p.skin[1], p.skin[2]);
          part.g.attributes.lim.setXY(i, p.sleeve, p.leg);
        }
      }
    }
    for (const part of this.parts) {
      part.m.count = part.n; part.m.instanceMatrix.needsUpdate = true;
      for (const k of ['cloth', 'skin', 'lim']) part.g.attributes[k].needsUpdate = true;
    }
  }
}
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
