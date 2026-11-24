/* Weapons on foot (website only). G draws and switches, the right mouse button aims over the shoulder, a click
   shoots, R reloads. Shots are rays from the camera through the crosshair: they stop at the first person, car,
   range target, wall or the ground. People hit fall over; without the blood setting they get up and run off a
   few seconds later. Blood (red spray and a pool under someone who is down) needs the player's 16+ confirmation
   and the admin's approval, both checked on the server. Gunfire scares everyone nearby and the police hear it.
   Nothing here costs or earns coins: weapons are bought in the range's panel and checked on the server. */
import * as THREE from 'three/webgpu';
import { gunMesh, MUZZLE } from '../actors/guns.js';
import { sampleHeight } from '../world/plan.js';
import { T } from './i18n.js';

export const FAKE_ARMS = [
  { id: 'pistol', name: 'Pistol', price: 400, dmg: 34, rate: 0.32, mag: 12, range: 70, spread: 0.012 },
  { id: 'smg', name: 'SMG', price: 1800, dmg: 18, rate: 0.085, mag: 30, range: 55, spread: 0.035 },
  { id: 'shotgun', name: 'Shotgun', price: 2600, dmg: 14, rate: 0.9, mag: 6, range: 28, spread: 0.09, pellets: 8 },
  { id: 'rifle', name: 'Rifle', price: 4500, dmg: 40, rate: 0.14, mag: 25, range: 120, spread: 0.008 }
];
const AUTO = { smg: 1, rifle: 1 }, TWO = { smg: 1, shotgun: 1, rifle: 1 }, RELOAD = { pistol: 1.1, smg: 1.6, shotgun: 2.2, rifle: 1.9 };
const V = new THREE.Vector3(), Dv = new THREE.Vector3(), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S3 = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

/* a small pool of instances that fade out: puffs, sparks, blood drops */
class Bits {
  constructor(scene, geo, m, n) { this.m = new THREE.InstancedMesh(geo, m, n); this.m.frustumCulled = false; this.m.count = 0; scene.add(this.m); this.list = []; this.n = n; }
  add(b) { if (this.list.length >= this.n) this.list.shift(); this.list.push(b); }
  update(dt, grow = 1, grav = 0) {
    let i = 0;
    this.list = this.list.filter((b) => (b.a += dt) < b.life);
    for (const b of this.list) {
      if (grav) { b.vy -= grav * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; if (b.y < b.floor) { b.y = b.floor; b.vx *= 0.3; b.vz *= 0.3; b.vy = 0; } }
      const s = b.s * (1 + b.a * grow) * (grav ? 1 : 1 - b.a / b.life * 0.4);
      M4.makeScale(s, s, s); M4.setPosition(b.x, b.y, b.z); this.m.setMatrixAt(i++, M4);
    }
    this.m.count = i; this.m.instanceMatrix.needsUpdate = true;
  }
}

export class Arms {
  constructor(g) {
    this.g = g;
    const d = g.data || {}, a = d.arms || {};
    this.cat = d.cat && Array.isArray(d.cat.arms) && d.cat.arms.length ? d.cat.arms : FAKE_ARMS;
    this.off = !!g.native;
    this.own = this.off ? [] : g.test ? this.cat.map((x) => x.id) : (Array.isArray(a.own) ? a.own : []).filter((id) => this.cat.some((x) => x.id === id));
    this.armour = !this.off && (g.test ? true : !!a.armour);
    this.blood = !this.off && (g.test ? /blood=1/.test(location.search) : !!a.blood);
    this.ap = this.armour ? 100 : 0;
    this.cur = null; this.mag = {}; this.cool = 0; this.reloadT = 0; this.aim = false; this.trigger = false; this.aimK = 0; this.kick = 0; this.trim = 0;
    for (const w of this.cat) this.mag[w.id] = w.mag;
    const S = g.scene;
    /* the flash at the muzzle and short tracers */
    const flashGeo = new THREE.PlaneGeometry(0.34, 0.34), flashMat = new THREE.MeshBasicNodeMaterial({ color: '#FFD27A', transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    this.flash = new THREE.Group(); for (const r of [0, Math.PI / 2]) { const p = new THREE.Mesh(flashGeo, flashMat); p.rotation.z = r; this.flash.add(p); }
    const star = new THREE.Mesh(flashGeo, flashMat); star.rotation.y = Math.PI / 2; this.flash.add(star);
    this.flash.visible = false; S.add(this.flash); this.flashT = 0;
    const trGeo = new THREE.BoxGeometry(0.018, 0.018, 1).translate(0, 0, 0.5), trMat = new THREE.MeshBasicNodeMaterial({ color: '#FFE9A8', transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending });
    this.tracers = []; for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(trGeo, trMat); m.visible = false; m.frustumCulled = false; S.add(m); this.tracers.push({ m, t: 0 }); }
    this.dust = new Bits(S, new THREE.SphereGeometry(0.09, 6, 4), new THREE.MeshBasicNodeMaterial({ color: '#BDB6AA', transparent: true, opacity: 0.55, depthWrite: false }), 60);
    this.sparks = new Bits(S, new THREE.SphereGeometry(0.025, 4, 3), new THREE.MeshBasicNodeMaterial({ color: '#FFD27A' }), 60);
    if (this.blood) {
      this.drops = new Bits(S, new THREE.SphereGeometry(0.03, 5, 4), new THREE.MeshStandardNodeMaterial({ color: '#6E0B10', roughness: 0.3 }), 160);
      const pg = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
      this.poolMesh = new THREE.InstancedMesh(pg, new THREE.MeshStandardNodeMaterial({ color: '#4A0609', roughness: 0.18, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2 }), 24);
      this.poolMesh.frustumCulled = false; this.poolMesh.count = 0; S.add(this.poolMesh); this.pools = [];
    }
    this.rehand();
    this.hud();
    /* keys and mouse */
    g.input.on('KeyG', () => this.cycle());
    g.input.on('KeyR', () => this.reload());
    /* hold Tab for the weapon wheel (time slows down), let go to pick */
    window.addEventListener('keydown', (e) => { if (e.code === 'Tab') { e.preventDefault(); if (!e.repeat && !this.wheel) this.openWheel(); } }, true);
    window.addEventListener('keyup', (e) => { if (e.code === 'Tab' && this.wheel) { e.preventDefault(); this.closeWheel(true); } }, true);
    const root = g.root;
    root.addEventListener('contextmenu', (e) => { if (g.mode === 'foot') e.preventDefault(); });
    root.addEventListener('pointerdown', (e) => {
      if (g.mode !== 'foot' || e.target.closest('button, [data-in], .bc-sheet, .bc-map, .bc-wheel')) return;
      /* the click that locks the mouse doesn't shoot */
      if (g.lockable && !g.locked) return;
      if (e.button === 2) this.aim = true;
      else if (e.button === 0 && this.cur) { this.trigger = true; this.pull(); }
    });
    window.addEventListener('pointerup', (e) => { if (e.button === 2) this.aim = false; else if (e.button === 0) this.trigger = false; });
    window.addEventListener('blur', () => { this.aim = false; this.trigger = false; });
  }
  get w() { return this.cur ? this.cat.find((x) => x.id === this.cur) : null; }
  /* the guns live in the right hand; the player's model is rebuilt when clothes change */
  rehand() {
    const R = this.g.foot.human.arms.find((x) => x.sx === -1);
    this.guns = {};
    for (const w of this.cat) { const m = gunMesh(w.id); m.rotation.x = Math.PI / 2; m.position.set(0, -0.075, 0.012); m.visible = w.id === this.cur; R.hand.add(m); this.guns[w.id] = m; }
    this.handR = R; this.handL = this.g.foot.human.arms.find((x) => x.sx === 1);
  }
  hud() {
    const el = document.createElement('div'); el.className = 'bc-arms';
    el.innerHTML = '<div class="bc-cross" hidden><i></i><i></i><i></i><i></i></div><div class="bc-ammo" hidden><b></b><span></span></div><div class="bc-ap" hidden><i></i></div>';
    this.g.ui.el.appendChild(el);
    this.ui = { cross: el.querySelector('.bc-cross'), ammo: el.querySelector('.bc-ammo'), name: el.querySelector('.bc-ammo b'), count: el.querySelector('.bc-ammo span'), ap: el.querySelector('.bc-ap') };
    const fuel = this.g.ui.el.querySelector('.bc-fuel'); if (fuel) fuel.appendChild(this.ui.ap);
    const pad = this.g.ui.el.querySelector('.bc-touch');
    if (pad && !this.off) {
      const b = document.createElement('div'); b.className = 'bc-pad bc-fire-pad';
      b.innerHTML = `<button type="button" class="bc-key small" data-k="arm">${T('arm')}</button><button type="button" class="bc-key" data-in="fire" aria-label="${T('fire')}">✦</button>`;
      pad.appendChild(b); this.firePad = b;
      b.querySelector('[data-k="arm"]').addEventListener('click', () => this.cycle());
    }
  }
  allowedHere() { const r = this.g.rooms.inside; return !r || r.door.id === 'arms'; }
  /* G: fists → each weapon you own → fists */
  cycle() {
    const g = this.g; if (g.mode !== 'foot' || g.sheets.el) return;
    if (this.off) { g.say(T('web_arms')); return; }
    if (!this.own.length) { g.say(T('no_arms'), T('no_arms_sub')); return; }
    if (!this.allowedHere() && !this.cur) { g.say(T('not_here'), T('not_here_sub')); return; }
    const list = [null, ...this.cat.filter((x) => this.own.includes(x.id)).map((x) => x.id)];
    this.set(list[(list.indexOf(this.cur) + 1) % list.length]);
    const w = this.w; g.say(w ? w.name : T('holster'), w ? (matchMedia('(pointer: coarse)').matches ? T('aim_touch') : T('aim_hint')) : '');
    if (g.audio) g.audio.click('reload');
  }
  openWheel() {
    const g = this.g; if (g.mode !== 'foot' || g.sheets.el || g.wheel || g.ended) return;
    if (this.off) { g.say(T('web_arms')); return; }
    if (!this.own.length) { g.say(T('no_arms'), T('no_arms_sub')); return; }
    if (!this.allowedHere()) { g.say(T('not_here'), T('not_here_sub')); return; }
    const list = [{ id: null, name: T('holster') }, ...this.cat.filter((x) => this.own.includes(x.id))];
    const el = document.createElement('div'); el.className = 'bc-wheel bc-gunwheel';
    const R = Math.min(150, Math.min(innerWidth, innerHeight) * 0.3);
    el.innerHTML = `<div class="bc-wheel-in" style="width:${R * 2 + 140}px;height:${R * 2 + 140}px">` + list.map((w, i) => {
      const a = -Math.PI / 2 + i / list.length * Math.PI * 2, x = Math.cos(a) * R, y = Math.sin(a) * R, m = w.id ? (this.mag[w.id] == null ? w.mag : this.mag[w.id]) : '';
      return `<button type="button" data-w="${w.id || ''}" class="${w.id === this.cur ? 'on' : ''}" style="transform:translate(calc(-50% + ${x.toFixed(0)}px), calc(-50% + ${y.toFixed(0)}px))">${w.name}${w.id ? `<small>${m} / ${w.mag}</small>` : ''}</button>`;
    }).join('') + `<div class="bc-wheel-mid"><b>${this.w ? this.w.name : T('holster')}</b><small>${T('wheel_hint')}</small></div></div>`;
    g.ui.el.appendChild(el); this.wheel = { el, pick: this.cur }; g.timeScale = 0.25;
    const mark = (id) => { this.wheel.pick = id || null; el.querySelectorAll('[data-w]').forEach((b) => b.classList.toggle('hi', (b.dataset.w || null) === (id || null))); };
    el.addEventListener('pointermove', (e) => {
      const r = el.querySelector('.bc-wheel-in').getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      if (Math.hypot(dx, dy) < 40) return;
      let a = Math.atan2(dy, dx) + Math.PI / 2; if (a < 0) a += Math.PI * 2;
      mark(list[Math.round(a / (Math.PI * 2) * list.length) % list.length].id);
    });
    el.addEventListener('click', (e) => { const b = e.target.closest('[data-w]'); if (b) { mark(b.dataset.w); this.closeWheel(true); } else if (e.target === el) this.closeWheel(false); });
  }
  closeWheel(apply) {
    const w = this.wheel; if (!w) return;
    w.el.classList.add('out'); setTimeout(() => w.el.remove(), 180); this.wheel = null; this.g.timeScale = 1;
    if (apply && w.pick !== this.cur) { this.set(w.pick); this.g.say(this.w ? this.w.name : T('holster')); if (this.g.audio) this.g.audio.click('reload'); }
  }
  set(id) {
    this.cur = id; this.reloadT = 0; this.cool = 0.25;
    for (const k in this.guns) this.guns[k].visible = k === id;
  }
  reload() {
    const w = this.w; if (!w || this.reloadT > 0 || this.mag[w.id] === w.mag) return;
    this.reloadT = RELOAD[w.id] || 1.5; if (this.g.audio) this.g.audio.click('reload');
  }
  /* armour takes most of a hit until it runs out */
  absorb(n) { if (this.ap <= 0) return n; const take = Math.min(this.ap, n * 0.7); this.ap -= take; return n - take; }
  refill() { this.ap = this.armour ? 100 : 0; }
  pull() {
    const g = this.g, w = this.w; if (!w || g.mode !== 'foot' || g.sheets.el || g.paused || g.koT > 0) return;
    if (this.cool > 0 || this.reloadT > 0) return;
    if (this.mag[w.id] <= 0) { if (g.audio) g.audio.click('empty'); this.reload(); return; }
    this.fire(w);
  }
  fire(w) {
    const g = this.g, f = g.foot, cam = g.camera;
    this.mag[w.id]--; this.cool = w.rate; this.kick = 1;
    const moving = f.speed > 0.6 ? 1.6 : 1, hip = this.aimK > 0.6 ? 1 : 2.4;
    /* face where the shot goes */
    cam.getWorldDirection(Dv); f.a = Math.atan2(Dv.x, Dv.z); g.fcam.lastLook = performance.now() / 1000;
    const mz = this.muzzle();
    const inside = !!g.rooms.inside;
    for (let k = 0; k < (w.pellets || 1); k++) {
      const d = Dv.clone();
      const sp = w.spread * moving * hip;
      d.x += (Math.random() - 0.5) * 2 * sp; d.y += (Math.random() - 0.5) * 2 * sp; d.z += (Math.random() - 0.5) * 2 * sp; d.normalize();
      const hit = this.trace(cam.position, d, w.range);
      this.tracer(mz, hit.p);
      this.impact(hit, w, d);
    }
    this.showFlash(mz);
    if (g.audio) g.audio.shot(w.id, 0);
    g.cam.shake = Math.max(g.cam.shake || 0, w.id === 'shotgun' ? 0.12 : 0.05);
    g.fcam.pitch = Math.max(-0.5, g.fcam.pitch - (w.id === 'shotgun' ? 0.03 : w.id === 'pistol' ? 0.015 : 0.008));
    if (!inside) {
      if (g.crowd) g.crowd.panic(f.x, f.z, 45, (p) => { if (Math.random() < 0.2) g.talk.remark(p, 'panic'); });
      if (g.traffic) for (const c of g.traffic.near(f.x, f.z, 30)) if (c.type !== 'police' && c.mode === 'lane' && Math.random() < 0.5) c.mode = 'flee';
      if (g.police) g.police.crime('shoot', f.x, f.z);
    }
  }
  muzzle() {
    const w = this.cur, m = this.guns[w]; m.updateMatrixWorld(true);
    return new THREE.Vector3(...MUZZLE[w]).applyMatrix4(m.matrixWorld);
  }
  /* what a ray from the camera hits first, within range of the player */
  trace(o, d, range) {
    const g = this.g, f = g.foot;
    const t0 = Math.max(0, (f.x - o.x) * d.x + (f.y + 1.4 - o.y) * d.y + (f.z - o.z) * d.z);
    let best = { t: t0 + range, kind: 'air' };
    const r = g.rooms.inside;
    if (r) {
      const room = r.room, lo = room.o;
      /* the room's walls, floor and ceiling */
      for (const [axis, half, base] of [['x', room.W / 2, lo.x], ['z', room.D / 2, lo.z]]) {
        const dv = d[axis]; if (Math.abs(dv) < 1e-6) continue;
        const t = (base + Math.sign(dv) * half - o[axis]) / dv; if (t > t0 && t < best.t) best = { t, kind: 'wall' };
      }
      if (d.y < 0) { const t = (lo.y - o.y) / d.y; if (t > t0 && t < best.t) best = { t, kind: 'ground' }; }
      if (room.staff && !room.staff.down) { const S = room.staff, t = rayCyl(o, d, lo.x + S.x, lo.z + S.z, 0.32, lo.y, lo.y + 1.8); if (t != null && t > t0 && t < best.t) best = { t, kind: 'staff', who: S }; }
      if (room.targets) for (const tg of room.targets) {
        const t = slab(o, d, tg.x + lo.x - tg.w / 2, lo.y + tg.y - tg.h / 2, tg.z + lo.z - 0.06, tg.x + lo.x + tg.w / 2, lo.y + tg.y + tg.h / 2, tg.z + lo.z + 0.06);
        if (t != null && t > t0 && t < best.t) best = { t, kind: 'target', tg };
      }
      for (const b of room.boxes) {
        const t = slab(o, d, lo.x + b.x - b.hw, lo.y, lo.z + b.z - b.hd, lo.x + b.x + b.hw, lo.y + 1.05, lo.z + b.z + b.hd);
        if (t != null && t > t0 && t < best.t) best = { t, kind: 'wall' };
      }
    } else {
      /* people */
      const C = g.crowd;
      if (C) for (const p of C.people) {
        if (!p.alive || Math.abs(p.x - f.x) > range + 4 || Math.abs(p.z - f.z) > range + 4) continue;
        const rad = 0.3 * p.scale, ox = o.x - p.x, oz = o.z - p.z, a = d.x * d.x + d.z * d.z;
        if (p.state === 'down') {
          /* lying down: a low box along the fall direction */
          const sg = p.rag ? 1 : -1, cx = p.x + sg * Math.sin(p.fallDir || 0) * 0.85, cz = p.z + sg * Math.cos(p.fallDir || 0) * 0.85;
          const t = slab(o, d, cx - 0.55, p.y - 0.1, cz - 0.55, cx + 0.55, p.y + 0.3, cz + 0.55);
          if (t != null && t > t0 && t < best.t) best = { t, kind: 'person', who: p, head: false };
          continue;
        }
        if (a < 1e-6) continue;
        const b = ox * d.x + oz * d.z, c = ox * ox + oz * oz - rad * rad, disc = b * b - a * c; if (disc < 0) continue;
        const t = (-b - Math.sqrt(disc)) / a; if (t <= t0 || t >= best.t) continue;
        const y = o.y + d.y * t, top = p.y + 1.78 * p.scale;
        if (y < p.y - 0.15 || y > top) continue;
        /* v7.9.4 hit zones: head (and neck), arms (out to the side above the hips), legs (below the hips), torso */
        const hy = (y - p.y) / p.scale, hx = o.x + d.x * t - p.x, hz = o.z + d.z * t - p.z, lat = (hx * Math.cos(p.h) - hz * Math.sin(p.h)) / p.scale;
        const zone = hy > 1.5 ? 'head' : hy > 0.92 ? (Math.abs(lat) > 0.17 ? 'arm' : 'torso') : 'leg';
        best = { t, kind: 'person', who: p, head: zone === 'head', zone, side: lat > 0 ? 1 : -1 };
      }
      /* officers on foot */
      if (g.police) for (const cop of g.police.foot.list) {
        const down = cop.state === 'down';
        const t = rayCyl(o, d, cop.x, cop.z, down ? 0.8 : 0.32, cop.y - 0.1, cop.y + (down ? 0.35 : 1.78));
        if (t != null && t > t0 && t < best.t) best = { t, kind: 'cop', who: cop, head: !down && o.y + d.y * t > cop.y + 1.5 };
      }
      /* cars: a box in each car's own frame */
      const cars = (g.traffic ? g.traffic.near(f.x, f.z, range + 4) : []).concat([g.car]);
      for (const c of cars) {
        const ch = Math.cos(c.h), sh = Math.sin(c.h), hl = c.T ? c.T.L / 2 : 2.25, hw = c.T ? c.T.W / 2 : 0.95, hh = c.T ? c.T.H : 1.5;
        const dx = o.x - c.x, dz = o.z - c.z;
        const lo2 = { x: dx * ch - dz * sh, y: o.y - c.y, z: dx * sh + dz * ch }, ld = { x: d.x * ch - d.z * sh, y: d.y, z: d.x * sh + d.z * ch };
        const t = slab(lo2, ld, -hw, 0.15, -hl, hw, hh, hl);
        if (t != null && t > t0 && t < best.t) best = { t, kind: 'car', c };
      }
      /* buildings, walls and the ground, marching along the ray */
      const W = g.world, H = g.plan.height, P = { x: 0, z: 0 };
      for (let t = t0 + 0.4; t < best.t; t += 0.6) {
        const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
        if (y < sampleHeight(H, x, z)) { best = { t: t - 0.3, kind: 'ground' }; break; }
        P.x = x; P.z = z; if (W.collide.resolve(P, 0.04, y, { x: 0, z: 0 }) > 0) { best = { t: t - 0.3, kind: 'wall' }; break; }
      }
    }
    best.p = new THREE.Vector3(o.x + d.x * best.t, o.y + d.y * best.t, o.z + d.z * best.t);
    return best;
  }
  impact(hit, w, d) {
    const g = this.g, p = hit.p;
    if (hit.kind === 'staff') { g.hitStaff(w.dmg * 1.5, d.x, d.z); this.bleed(hit.p, d, 8); return; }
    if (hit.kind === 'cop') { g.police.foot.hit(hit.who, w.dmg * (hit.head ? 2.5 : 1), d.x, d.z, this.blood); this.bleed(hit.p, d, 8); return; }
    if (hit.kind === 'person') this.hitPerson(hit, w, d);
    else if (hit.kind === 'car') {
      for (let i = 0; i < 5; i++) this.sparks.add({ x: p.x, y: p.y, z: p.z, vx: (Math.random() - 0.5) * 4 - d.x * 2, vy: Math.random() * 3, vz: (Math.random() - 0.5) * 4 - d.z * 2, a: 0, life: 0.35, s: 1, floor: p.y - 2 });
      if (g.audio && Math.random() < 0.6) g.audio.click('metal');
      const c = hit.c;
      if (c === g.car) c.damage(-d.x, -d.z, 0.4);
      else if (c.type === 'police') { if (g.police) g.police.crime('ram', c.x, c.z); }
      else if (c.mode === 'lane' || c.mode === 'stop') c.mode = 'flee';
    } else if (hit.kind === 'target') {
      const tg = hit.tg, room = g.rooms.inside.room, lx = p.x - room.o.x - tg.x, ly = p.y - room.o.y - tg.y;
      const ring = Math.hypot(lx, ly) / (tg.w / 2);
      tg.v = (tg.v || 0) + 3.5; if (g.missions && g.missions.cur) g.missions.targets++;
      g.say(ring < 0.15 ? T('bullseye') : T('target_hit'), (ring > 1 ? 0 : 10 - Math.min(9, Math.floor(ring * 10))) + ' / 10');
      this.dust.add({ x: p.x, y: p.y, z: p.z, a: 0, life: 0.3, s: 0.6 });
    } else if (hit.kind !== 'air') {
      for (let i = 0; i < 3; i++) this.dust.add({ x: p.x - d.x * 0.1, y: p.y + i * 0.05, z: p.z - d.z * 0.1, a: 0, life: 0.45 + i * 0.1, s: 0.7 + i * 0.3 });
      this.sparks.add({ x: p.x, y: p.y, z: p.z, vx: -d.x * 2, vy: 1.5, vz: -d.z * 2, a: 0, life: 0.2, s: 1, floor: p.y - 2 });
    }
  }
  hitPerson(hit, w, d) {
    const g = this.g, who = hit.who, dmg = w.dmg;
    const before = who.state;
    const res = g.crowd.shoot(who, dmg, d.x, d.z, this.blood, hit.zone, hit.side);
    this.bleed(hit.p, d, hit.head ? 14 : 8);
    if (res === 'down' && before !== 'down') {
      this.pool(who); g.deathNear(who);
      if (g.police) g.police.crime('kill', who.x, who.z);
    } else if (res === 'hit' && Math.random() < 0.7) { g.talk.busy = 0; g.talk.remark(who, 'shot'); }
  }
  /* blood: a spray of drops away from the shooter, and a pool once they're down */
  bleed(pt, d, n) {
    if (!this.blood) { for (let i = 0; i < 2; i++) this.dust.add({ x: pt.x, y: pt.y, z: pt.z, a: 0, life: 0.35, s: 0.5 + i * 0.3 }); return; }
    const floor = sampleHeight(this.g.plan.height, pt.x, pt.z) + 0.01;
    for (let i = 0; i < n; i++) this.drops.add({ x: pt.x, y: pt.y, z: pt.z, vx: d.x * (1 + Math.random() * 3) + (Math.random() - 0.5) * 1.5, vy: Math.random() * 1.8, vz: d.z * (1 + Math.random() * 3) + (Math.random() - 0.5) * 1.5, a: 0, life: 0.9, s: 0.6 + Math.random() * 0.8, floor });
  }
  pool(p) {
    if (!this.blood || this.pools.some((q) => q.p === p)) return;
    if (this.pools.length >= 24) this.pools.shift();
    this.pools.push({ p, x: p.x - Math.sin(p.fallDir || 0) * 0.7, z: p.z - Math.cos(p.fallDir || 0) * 0.7, y: sampleHeight(this.g.plan.height, p.x, p.z) + 0.015, a: 0, max: 0.55 + Math.random() * 0.35 });
  }
  /* a police officer shoots at you (the police module decides when) */
  copShot(c) {
    const g = this.g, f = g.foot; if (g.mode !== 'foot' || g.rooms.inside) return;
    const from = new THREE.Vector3(c.x + Math.cos(c.h) * 1.1, c.y + 1.3, c.z - Math.sin(c.h) * 1.1), to = new THREE.Vector3(f.x, f.y + 1.2, f.z);
    const dist = from.distanceTo(to), hitIt = Math.random() < Math.max(0.12, 0.5 - dist / 80);
    if (!hitIt) to.add(new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.3) * 1.5, (Math.random() - 0.5) * 3));
    this.tracer(from, to); this.flash.position.copy(from); this.flash.visible = true; this.flashT = 0.04;
    if (g.audio) g.audio.shot('pistol', dist);
    if (Math.random() < 0.3) g.talk.remark({ x: c.x, z: c.z, voice: Math.random() < 0.5 ? 'f' : 'm', i: null }, 'cop_gun');
    if (hitIt) { g.hurt(9, null); this.bleed(to, to.clone().sub(from).normalize(), 5); }
    else this.dust.add({ x: to.x, y: Math.max(f.y + 0.05, to.y), z: to.z, a: 0, life: 0.4, s: 0.6 });
  }
  showFlash(at) {
    this.flash.position.copy(at); this.flash.lookAt(this.g.camera.position); this.flash.rotation.z = Math.random() * Math.PI;
    const s = this.cur === 'shotgun' ? 1.5 : this.cur === 'pistol' ? 0.8 : 1; this.flash.scale.setScalar(s * (0.8 + Math.random() * 0.4));
    this.flash.visible = true; this.flashT = 0.05;
  }
  tracer(a, b) {
    const t = this.tracers.find((x) => x.t <= 0) || this.tracers[0];
    const len = a.distanceTo(b); if (len < 0.3) return;
    t.m.position.copy(a); t.m.lookAt(b); t.m.scale.set(1, 1, len); t.m.visible = true; t.t = 0.06;
  }
  /* every frame: timers, effects, auto fire, the HUD */
  update(dt) {
    const g = this.g;
    if (this.cool > 0) this.cool -= dt;
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0 && this.w) this.mag[this.w.id] = this.w.mag; }
    if (this.cur && (g.mode !== 'foot' || !this.allowedHere())) this.set(null);
    const fire = this.trigger || g.input.k.fire;
    if (this.cur && fire) { if (AUTO[this.cur] || g.input.k.fire) this.pull(); }
    const wantAim = this.cur && (this.aim || g.input.k.fire) ? 1 : 0;
    this.aimK += Math.max(-dt * 8, Math.min(dt * 8, wantAim - this.aimK));
    g.fcam.aim = this.aimK; g.fcam.armed = !!this.cur;
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.flash.visible = false; }
    for (const t of this.tracers) if (t.t > 0) { t.t -= dt; if (t.t <= 0) t.m.visible = false; }
    this.dust.update(dt, 2.2); this.sparks.update(dt, 0, 9.8);
    if (this.blood) {
      this.drops.update(dt, 0, 9.8);
      let i = 0;
      this.pools = this.pools.filter((q) => q.p.alive && q.p.state === 'down');
      for (const q of this.pools) { q.a += dt; const s = q.max * Math.min(1, Math.sqrt(q.a / 5)); M4.makeScale(s, 1, s * 0.8); M4.setPosition(q.x, q.y, q.z); this.poolMesh.setMatrixAt(i++, M4); }
      this.poolMesh.count = i; this.poolMesh.instanceMatrix.needsUpdate = true;
    } else if (this.poolMesh && this.poolMesh.count) { this.poolMesh.count = 0; this.drops.m.count = 0; this.drops.list = []; }
    if (this.kick > 0) this.kick = Math.max(0, this.kick - dt * 12);
    /* HUD */
    const w = this.w, on = g.mode === 'foot';
    const hid = (el, v) => { if (el.hidden !== v) el.hidden = v; }, txt = (el, v) => { if (el.textContent !== v) el.textContent = v; };
    hid(this.ui.cross, !(on && w));
    if (on && w) this.ui.cross.classList.toggle('aim', this.aimK > 0.6);
    hid(this.ui.ammo, !(on && w));
    if (on && w) { txt(this.ui.name, w.name); txt(this.ui.count, this.reloadT > 0 ? T('reload') : this.mag[w.id] + ' / ' + w.mag); }
    hid(this.ui.ap, !(on && this.armour && this.ap > 0));
    if (!this.ui.ap.hidden) { const pw = this.ap + '%'; if (this.ui.ap.firstChild.style.width !== pw) this.ui.ap.firstChild.style.width = pw; }
    if (this.firePad) this.firePad.classList.toggle('on', on && !!this.own.length);
  }
  /* the arms after the body animated: point the gun along the camera */
  pose() {
    const w = this.cur, g = this.g; if (!w || g.mode !== 'foot') return;
    const k = Math.max(this.aimK, this.kick > 0 ? 1 : 0), f = g.foot;
    if (this.aimK > 0.3) { g.camera.getWorldDirection(Dv); const want = Math.atan2(Dv.x, Dv.z); let da = want - f.a; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; f.a += da * Math.min(1, 0.25 + this.aimK * 0.5); f.human.group.rotation.y = f.a; }
    g.camera.getWorldDirection(Dv);
    const elev = Math.asin(Math.max(-0.9, Math.min(0.9, Dv.y)));
    const R = this.handR, L = this.handL, kick = this.kick * (w === 'shotgun' ? 0.25 : 0.1);
    /* held low while walking around, raised when aiming or shooting */
    const pitch = -0.35 + (-(Math.PI / 2) - elev + 0.35 + this.trim) * k - kick;
    R.upper.rotation.set(pitch, 0, 0.12 * k + R.sx * 0.1 * (1 - k));
    R.fore.rotation.set(-0.5 * (1 - k) - 0.05, 0, 0); R.hand.rotation.set(0.5 * (1 - k), 0, 0);
    if (TWO[w]) {
      L.upper.rotation.set(pitch + 0.15, 0, -0.55 * k + 0.1 * (1 - k));
      L.fore.rotation.set(-0.9 - 0.3 * (1 - k), 0, 0.4 * k); L.hand.rotation.set(0, 0, 0);
    }
    /* the body leans and bends, so measure where the barrel really points and trim the arm to the crosshair */
    if (k > 0.5) {
      f.human.group.updateMatrixWorld(true);
      const m = this.guns[w].matrixWorld, a = V.set(0, 0.05, 0).applyMatrix4(m).clone(), b = new THREE.Vector3(...MUZZLE[w]).applyMatrix4(m);
      const by = (b.y - a.y) / Math.max(1e-3, b.distanceTo(a));
      this.trim = Math.max(-0.9, Math.min(0.9, this.trim + (Math.asin(Math.max(-1, Math.min(1, by))) - elev) * 0.5));
    }
  }
}

/* ray against an axis-aligned box: the entry distance, or null */
function slab(o, d, x0, y0, z0, x1, y1, z1) {
  let tn = -1e9, tf = 1e9;
  for (const [oo, dd, a, b] of [[o.x, d.x, x0, x1], [o.y, d.y, y0, y1], [o.z, d.z, z0, z1]]) {
    if (Math.abs(dd) < 1e-8) { if (oo < a || oo > b) return null; continue; }
    let t1 = (a - oo) / dd, t2 = (b - oo) / dd; if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tn) tn = t1; if (t2 < tf) tf = t2; if (tn > tf) return null;
  }
  return tf < 0 ? null : tn;
}
void V; void Q; void S3; void UP;
/* ray against an upright cylinder (centre x, z, radius r, from y0 to y1): the entry distance, or null */
function rayCyl(o, d, cx, cz, r, y0, y1) {
  const ox = o.x - cx, oz = o.z - cz, a = d.x * d.x + d.z * d.z; if (a < 1e-8) return null;
  const b = ox * d.x + oz * d.z, c = ox * ox + oz * oz - r * r, disc = b * b - a * c; if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / a, y = o.y + d.y * t;
  return y < y0 || y > y1 ? null : t;
}
