/* Stunt combos (v7.8). In a car, air time, drifts and near misses (flying past traffic at speed) chain into a combo:
   each new trick raises the multiplier (up to ×8), and the combo banks when nothing happens for 2.5 seconds. A crash
   loses it. Your best combo is kept on this device; banked combos feed the Stunt show mission. No coins: those only
   come from things the server can check. */
import { T } from './i18n.js';

export class Stunts {
  constructor(game) {
    this.g = game; this.c = null; this.banks = []; this.lastV = 0; this.seen = new Map();
    try { this.best = +localStorage.getItem('bloc:city:combo') || 0; } catch (e) { this.best = 0; }
    const el = document.createElement('div'); el.className = 'bc-combo'; el.hidden = true; game.ui.el.appendChild(el); this.el = el;
  }
  banked(n, since) { return this.banks.some((b) => b.pts >= n && b.t >= since); }
  add(kind, pts) {
    let c = this.c; if (!c) c = this.c = { pts: 0, mult: 1, kinds: [], idle: 0, last: '' };
    if (c.last !== kind) { c.mult = Math.min(8, c.mult + (c.kinds.length ? 1 : 0)); c.kinds.push(kind); c.last = kind; }
    c.pts += pts; c.idle = 0;
  }
  update(dt) {
    const g = this.g, car = g.car;
    if (g.mode !== 'car' || g.rooms.inside) { if (this.c) this.bank(); this.lastV = 0; return; }
    const v = car.speed;
    /* a crash: speed drops hard in one frame */
    if (this.c && this.lastV - v > 9) { this.lose(); }
    this.lastV = v;
    if (car.air) { this.add('air', 140 * dt); this.airT = (this.airT || 0) + dt; }
    else if (this.airT) { if (this.airT > 1.1) this.add('jump', Math.round(this.airT * 200)); this.airT = 0; }
    /* drift: the car slides sideways at speed */
    if (!car.air && v > 12) {
      const fwd = (car.vx * Math.sin(car.h) + car.vz * Math.cos(car.h)) / v, slip = Math.acos(Math.max(-1, Math.min(1, fwd)));
      if (slip > 0.32 && slip < 1.6) this.add('drift', 55 * dt * v / 12);
    }
    /* near misses */
    if (v > 15 && g.traffic) {
      const now = performance.now();
      for (const o of g.traffic.near(car.x, car.z, 6)) {
        const d = Math.hypot(o.x - car.x, o.z - car.z), rel = Math.hypot(car.vx - Math.sin(o.h) * o.v, car.vz - Math.cos(o.h) * o.v);
        if (d > 2.6 && d < 4.2 && rel > 14 && now - (this.seen.get(o) || 0) > 3000) { this.seen.set(o, now); this.add('near', 150); }
      }
    }
    const c = this.c;
    if (c) { c.idle += dt; if (c.idle > 2.5) this.bank(); }
    const txt = this.c ? T('combo_' + this.c.last) + ' ×' + this.c.mult + '  ' + Math.round(this.c.pts * this.c.mult) : '';
    if (this.el.textContent !== txt) { this.el.textContent = txt; this.el.hidden = !txt; }
  }
  bank() {
    const c = this.c; this.c = null; if (!c) return;
    const pts = Math.round(c.pts * c.mult); if (pts < 150) return;
    this.banks.push({ pts, t: performance.now() / 1000 });
    const pb = pts > this.best; if (pb) { this.best = pts; try { localStorage.setItem('bloc:city:combo', String(pts)); } catch (e) { /* private mode */ } }
    this.g.say(T('combo') + ' +' + pts.toLocaleString(), pb ? T('combo_best') : T('combo_best_was', { n: this.best.toLocaleString() }));
    if (this.g.audio) this.g.audio.chime(pb ? 1320 : 880);
  }
  lose() { this.c = null; this.el.hidden = true; this.el.textContent = ''; this.g.say(T('combo_lost'), ''); }
}
