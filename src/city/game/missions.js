/* Missions (v7.5): Rosa stands outside the café and hands out short missions one after another. Each mission is a
   list of steps the game checks every frame (go somewhere, go in somewhere, take a car, hit targets, fly through
   rings, land). The finished ones go into result.missions with how long they took; the server pays each once, in
   order, and only if the time is believable. Range day is a side mission (website only), the rest are a chain. */
import * as THREE from 'three/webgpu';
import { Human } from '../actors/human.js';
import { sampleHeight } from '../world/plan.js';
import { T } from './i18n.js';

export const MISSIONS = [
  { id: 'm1', steps: [{ k: 'enter', place: 'shop' }, { k: 'enter', place: 'cafe' }, { k: 'rosa' }] },
  { id: 'm2', steps: [{ k: 'steal' }, { k: 'clean' }, { k: 'door', place: 'garage', car: true }] },
  { id: 'm3', side: true, web: true, steps: [{ k: 'enter', place: 'arms' }, { k: 'targets', n: 5 }] },
  { id: 'm4', steps: [{ k: 'go', at: [-1990, 2010], r: 10, label: 'port' }, { k: 'go', home: true, r: 8, car: true, limit: 300 }] },
  { id: 'm5', steps: [{ k: 'plane' }, { k: 'ring', at: [-1380, -620, 60] }, { k: 'ring', at: [-1460, 0, 70] }, { k: 'ring', at: [-1400, 620, 60] }, { k: 'ring', at: [-1150, 1250, 80] }, { k: 'land' }] }
];

export class Missions {
  constructor(game) {
    this.g = game; const d = game.data;
    this.done = new Set(game.test ? [] : (Array.isArray(d.missions) ? d.missions : []));
    this.cur = null; this.step = 0; this.t = 0; this.stepT = 0; this.targets = 0;
    /* fixed points snap to the nearest real road so you can always drive there */
    for (const m of MISSIONS) for (const st of m.steps) if (st.at && st.k === 'go') {
      let best = null, bd = 1e9;
      for (const e of game.plan.edges) { if (e.bridge || e.kind === 'ronda') continue; for (const p of e.dense) { const dd = Math.hypot(p[0] - st.at[0], p[1] - st.at[1]); if (dd < bd) { bd = dd; best = p; } } }
      if (best) st.at = [best[0], best[1]];
    }
    /* Rosa, a few metres along the pavement from the café door */
    const cafe = game.rooms.doors.find((x) => x.id === 'cafe');
    const base = cafe || { x: game.car.x + 4, z: game.car.z + 4, a: 0 };
    const ox = Math.cos(base.a) * 3.2, oz = -Math.sin(base.a) * 3.2;
    this.rosa = { x: base.x + ox + Math.sin(base.a) * 1.2, z: base.z + oz + Math.cos(base.a) * 1.2, a: base.a, voice: 'f', i: null };
    this.rosa.y = sampleHeight(game.plan.height, this.rosa.x, this.rosa.z);
    this.rosaH = new Human({ skin: '#9A6440', hair: 'long', hairC: '#1B1714', top: { kind: 'jacket', c: '#B8323A' }, bottom: { kind: 'jeans', c: '#1E2026' }, shoes: { kind: 'boot', c: '#2A201C' }, hat: { kind: 'none', c: '#000' } });
    this.rosaH.group.position.set(this.rosa.x, this.rosa.y, this.rosa.z); this.rosaH.group.rotation.y = base.a; game.scene.add(this.rosaH.group);
    /* a violet beam marks Rosa or the current objective */
    const beam = new THREE.CylinderGeometry(0.8, 0.8, 70, 14, 1, true).translate(0, 35, 0);
    this.beam = new THREE.Mesh(beam, new THREE.MeshBasicNodeMaterial({ color: '#B38CFF', transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }));
    this.beam.frustumCulled = false; game.scene.add(this.beam);
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(12, 0.7, 10, 48), new THREE.MeshStandardNodeMaterial({ color: '#B38CFF', emissive: '#B38CFF', emissiveIntensity: 1.4 }));
    this.ring.visible = false; game.scene.add(this.ring);
    const el = document.createElement('div'); el.className = 'bc-obj'; el.hidden = true; game.ui.el.appendChild(el); this.el = el;
  }
  next() { return MISSIONS.find((m) => !this.done.has(m.id) && !m.side) || MISSIONS.find((m) => !this.done.has(m.id) && m.side && !(m.web && this.g.native)) || null; }
  side() { return MISSIONS.find((m) => m.side && !this.done.has(m.id) && this.done.has('m1') && !(m.web && this.g.native)); }
  nearRosa() { const f = this.g.foot; return this.g.mode === 'foot' && !this.g.rooms.inside && Math.hypot(f.x - this.rosa.x, f.z - this.rosa.z) < 2.6; }
  /* lines Rosa (or the mission) says: subtitles, no voice */
  line(key, name) { const g = this.g, txt = T(key); g.talk.show(name === undefined ? 'Rosa' : name, txt); clearTimeout(this.lt); this.lt = setTimeout(() => g.talk.hide(txt), Math.max(2600, txt.length * 70)); }
  talk() {
    if (this.cur) { if (this.cur.steps[this.step].k === 'rosa') return; this.line('mi_busy'); return; }
    const chain = MISSIONS.find((m) => !this.done.has(m.id) && !m.side), s = this.side();
    const m = chain && (chain.id !== 'm2' || !s || Math.random() < 0.6) ? chain : s;
    if (!m) { this.line('mi_all'); return; }
    this.start(m);
  }
  start(m) {
    this.cur = m; this.step = 0; this.t = 0; this.stepT = 0; this.targets = 0; this.startStars = this.g.police ? this.g.police.stars : 0; this.carAtStart = this.g.car;
    this.line('mi_' + m.id + '_go'); this.g.say(T('mi_' + m.id), T('mi_new'));
    this.show();
  }
  objective() {
    const st = this.cur.steps[this.step];
    if (st.k === 'enter' || st.k === 'door') return T('mi_o_' + st.k, { p: T('place_' + st.place) });
    if (st.k === 'targets') return T('mi_o_targets', { n: Math.max(0, st.n - this.targets) });
    if (st.k === 'go') return T(st.home ? 'mi_o_home' : 'mi_o_' + st.label) + (st.limit ? ' (' + Math.max(0, Math.ceil(st.limit - this.stepT)) + ' s)' : '');
    return T('mi_o_' + st.k);
  }
  show() { if (!this.cur) { this.el.hidden = true; return; } const txt = T('mi_' + this.cur.id) + ': ' + this.objective(); if (this.el.textContent !== txt) this.el.textContent = txt; this.el.hidden = false; }
  target() { const st = this.cur && this.cur.steps[this.step]; if (!st) return null; const g = this.g;
    if (st.k === 'enter' || st.k === 'door') { const d = g.rooms.doors.find((x) => x.id === st.place); return d ? [d.x, d.z] : null; }
    if (st.k === 'rosa') return [this.rosa.x, this.rosa.z];
    if (st.k === 'go') { if (st.home) { const d = g.rooms.doors.find((x) => x.id === 'flat') || g.rooms.doors.find((x) => x.id === 'garage'); return d ? [d.x, d.z] : null; } return st.at; }
    if (st.k === 'plane') return [g.plane.x, g.plane.z];
    if (st.k === 'ring') return [st.at[0], st.at[1]];
    if (st.k === 'land') return [g.planeHome.x, g.planeHome.z];
    return null;
  }
  advance() {
    this.step++; this.stepT = 0;
    if (this.g.audio) this.g.audio.chime(this.step >= this.cur.steps.length ? 988 : 784);
    if (this.step >= this.cur.steps.length) {
      const m = this.cur; this.done.add(m.id); this.cur = null;
      this.g.result.missions = (this.g.result.missions || []).concat([{ id: m.id, ms: Math.round(this.t * 1000) }]);
      this.line('mi_' + m.id + '_done'); this.g.say(T('mi_done'), T('mi_done_sub'));
    }
    this.show();
  }
  fail(why) { this.line('mi_fail_' + why, null); this.g.say(T('mi_failed'), T('mi_fail_' + why)); this.cur = null; this.show(); }
  update(dt) {
    const g = this.g;
    this.rosaH.animate(dt, { speed: 0 });
    const tgt = this.cur ? this.target() : (this.next() ? [this.rosa.x, this.rosa.z] : null);
    const me0 = g.me();
    this.beam.visible = !!tgt && !g.rooms.inside && Math.hypot(me0.x - tgt[0], me0.z - tgt[1]) > 6;
    if (tgt) this.beam.position.set(tgt[0], sampleHeight(g.plan.height, tgt[0], tgt[1]), tgt[1]);
    if (!this.cur) { this.ring.visible = false; return; }
    this.t += dt; this.stepT += dt;
    const st = this.cur.steps[this.step], me = g.me();
    this.ring.visible = st.k === 'ring';
    if (st.k === 'enter') { if (g.rooms.inside && g.rooms.inside.door.id === st.place) this.advance(); }
    else if (st.k === 'rosa') { if (this.nearRosa()) this.advance(); }
    else if (st.k === 'door') { const d = g.rooms.doors.find((x) => x.id === st.place); if (d && Math.hypot(me.x - d.x, me.z - d.z) < 9 && (!st.car || g.mode === 'car')) this.advance(); }
    else if (st.k === 'steal') { if (g.car !== this.carAtStart && g.car.stolen && g.mode === 'car') this.advance(); }
    else if (st.k === 'clean') { if (!g.police || g.police.stars === 0) this.advance(); }
    else if (st.k === 'targets') { if (this.targets >= st.n) this.advance(); }
    else if (st.k === 'go') {
      const p = this.target(); if (p && Math.hypot(me.x - p[0], me.z - p[1]) < st.r && (!st.car || g.mode !== 'foot')) this.advance();
      else if (st.limit && this.stepT > st.limit) this.fail('late');
    }
    else if (st.k === 'plane') { if (g.mode === 'plane') this.advance(); }
    else if (st.k === 'ring') {
      this.ring.position.set(st.at[0], sampleHeight(g.plan.height, st.at[0], st.at[1]) + st.at[2], st.at[1]); this.ring.lookAt(me.x, this.ring.position.y, me.z);
      if (g.mode === 'plane' && Math.hypot(g.plane.x - st.at[0], g.plane.z - st.at[1]) < 14 && Math.abs(g.plane.y - this.ring.position.y) < 14) this.advance();
      if (g.mode !== 'plane' && this.stepT > 2) this.fail('plane');
    }
    else if (st.k === 'land') { if (g.mode === 'plane' && g.plane.ground && g.plane.v < 3) this.advance(); if (g.mode !== 'plane' && this.stepT > 2) this.fail('plane'); }
    if (Math.floor(this.stepT * 2) !== Math.floor((this.stepT - dt) * 2)) this.show();
  }
}
