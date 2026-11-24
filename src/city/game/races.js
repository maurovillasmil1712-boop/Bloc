/* Street races (v7.8). Four races with a pink ring at the start: stop in it and a 3-2-1 countdown starts, with three
   rivals on the grid. Rivals follow the road route (the same A* as Drive to), slow for corners and rubber-band a
   little so a race stays close. You have to pass every checkpoint in order. First place goes into result.races
   with the time; the server pays 300 the first win and 60 once a day after that. */
import * as THREE from 'three/webgpu';
import { Vehicle } from '../actors/vehicle.js';
import { route, progress, nearestNode } from './route.js';
import { sampleHeight } from '../world/plan.js';
import { T } from './i18n.js';

export const RACES = [
  { id: 'r1', a: [-720, -860], b: [-640, 700] },
  { id: 'r2', a: [-900, -1520], b: [620, -2050] },
  { id: 'r3', a: [-300, 1120], b: [520, 1760] },
  { id: 'r4', a: [1000, -300], b: [1820, -1000] }
];
const RIVALS = [{ type: 'gt', color: '#FF5A5F', name: 'Dani', pace: 0.8 }, { type: 'sedan', color: '#7CE3FF', name: 'Nadia', pace: 0.75 }, { type: 'hatch', color: '#5CD68A', name: 'Leo', pace: 0.7 }];
const CP_GAP = 160;

export class Races {
  constructor(game) {
    this.g = game; this.cur = null; this.cool = 0; this.wins = []; this.list = RACES;
    const S = game.scene, plan = game.plan;
    for (const r of RACES) { const n = plan.nodes[nearestNode(plan, r.a[0], r.a[1])]; r.s = [n.x, n.z]; const m = plan.nodes[nearestNode(plan, r.b[0], r.b[1])]; r.e = [m.x, m.z]; }
    this.rings = RACES.map((r) => {
      const m = new THREE.Mesh(new THREE.RingGeometry(6.2, 7.6, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicNodeMaterial({ color: '#FF5AD7', transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
      m.position.set(r.s[0], sampleHeight(plan.height, r.s[0], r.s[1]) + 0.13, r.s[1]); S.add(m); return m;
    });
    this.cp = new THREE.Mesh(new THREE.TorusGeometry(7, 0.35, 8, 40), new THREE.MeshBasicNodeMaterial({ color: '#FF5AD7' })); this.cp.visible = false; S.add(this.cp);
    const el = document.createElement('div'); el.className = 'bc-race'; el.hidden = true; game.ui.el.appendChild(el); this.el = el;
  }
  won(id, since) { return this.wins.some((w) => w.id === id && w.t >= since); }
  /* lines the rivals say: subtitles only */
  line(name, key) { const g = this.g, txt = T(key); g.talk.show(name, txt); clearTimeout(this.lt); this.lt = setTimeout(() => g.talk.hide(txt), Math.max(2400, txt.length * 70)); }
  start(r) {
    const g = this.g, car = g.car, rt = route(g.plan, r.s[0], r.s[1], r.e[0], r.e[1]);
    if (!rt || rt.total < 300) return;
    const cum = [0]; for (let i = 1; i < rt.pts.length; i++) cum.push(cum[i - 1] + Math.hypot(rt.pts[i][0] - rt.pts[i - 1][0], rt.pts[i][1] - rt.pts[i - 1][1]));
    const cps = []; for (let s = CP_GAP; s < rt.total - 40; s += CP_GAP) cps.push(this.at(rt.pts, cum, s)); cps.push(this.at(rt.pts, cum, rt.total));
    const top = (car.T && car.T.top) || 36;
    const h0 = this.at(rt.pts, cum, 6).h;
    car.place(r.s[0], r.s[1], h0, car.y);
    const rivals = RIVALS.map((R, i) => {
      if (!this.cars) this.cars = [];
      let v = this.cars[i]; if (!v) { v = new Vehicle(R.type, R.color, g.world); g.scene.add(v.group); this.cars[i] = v; }
      v.group.visible = true;
      return { v, R, s: [2, 2, -9][i], lat: [-3.1, 3.1, 0][i], spd: 0, vmax: Math.max(24, Math.min(44, top * R.pace + 4)), done: 0 };
    });
    this.cur = { r, rt, cum, cps, i: 0, t: -3.5, rivals, place: 0, off: 0, out: 0 };
    g.setWaypoint(null);
    g.say(T('race_' + r.id), T('race_ready')); this.line(RIVALS[0].name, 'race_trash');
    if (g.audio) g.audio.chime(660);
  }
  /* point and heading at distance s along the route, nudged sideways by lat */
  at(pts, cum, s, lat = 0) {
    s = Math.max(0, Math.min(cum[cum.length - 1], s));
    let lo = 0, hi = cum.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    const a = pts[lo], b = pts[hi], L = cum[hi] - cum[lo] || 1, k = (s - cum[lo]) / L, dx = b[0] - a[0], dz = b[1] - a[1], d = Math.hypot(dx, dz) || 1;
    const nx = dz / d, nz = -dx / d;
    return { x: a[0] + dx * k + nx * lat, z: a[1] + dz * k + nz * lat, h: Math.atan2(dx, dz) };
  }
  end(place, ms) {
    const c = this.cur, g = this.g; this.cur = null; this.cool = 8; this.cp.visible = false; this.el.hidden = true;
    for (const x of c.rivals) x.v.group.visible = false;
    if (place === 0) { g.say(T('race_off'), T('race_off_sub')); return; }
    if (place === 1) {
      this.wins.push({ id: c.r.id, t: performance.now() / 1000 });
      g.result.races = (g.result.races || []).concat([{ id: c.r.id, ms, place }]);
      g.say(T('race_win'), fmt(ms)); this.line(RIVALS[0].name, 'race_lost_line'); if (g.audio) g.audio.chime(1320);
    } else { g.say(T('race_place', { n: place }), fmt(ms)); this.line(RIVALS[0].name, 'race_won_line'); }
  }
  update(dt) {
    const g = this.g, car = g.car, plan = g.plan;
    this.cool -= dt;
    for (let i = 0; i < RACES.length; i++) this.rings[i].visible = !this.cur && !g.rooms.inside;
    if (!this.cur) {
      if (this.cool > 0 || g.mode !== 'car' || g.trial || (g.missions && g.missions.cur && g.missions.cur.steps[g.missions.step].k !== 'race')) return;
      for (const r of RACES) if (Math.hypot(car.x - r.s[0], car.z - r.s[1]) < 7.5 && car.speed < 6) { this.start(r); break; }
      return;
    }
    const c = this.cur; c.t += dt;
    /* countdown: everyone holds still */
    if (c.t < 0) {
      car.vx *= 0.8; car.vz *= 0.8;
      const n = Math.ceil(-c.t); if (n !== c.shown && n <= 3) { c.shown = n; g.say(String(n), ''); if (g.audio) g.audio.chime(523); }
    } else if (!c.go) { c.go = true; g.say(T('race_go'), ''); if (g.audio) g.audio.chime(1046); }
    /* rivals */
    const total = c.rt.total, pr = progress(c.rt, car.x, car.z), meS = c.cum[pr.i] || 0;
    for (const x of c.rivals) {
      if (c.t > 0 && !x.done) {
        const a = this.at(c.rt.pts, c.cum, x.s + 4), b = this.at(c.rt.pts, c.cum, x.s + 40);
        let turn = Math.abs(b.h - a.h); if (turn > Math.PI) turn = Math.PI * 2 - turn;
        let want = x.vmax * Math.max(0.35, 1 - turn * 0.6);
        const gap = x.s - meS; if (gap > 120) want *= 0.85; else if (gap < -150) want *= 1.12;
        x.spd += Math.max(-12 * dt, Math.min(6 * dt, want - x.spd));
        x.s += x.spd * dt;
        if (x.s >= total) { x.done = c.t; }
      }
      /* traffic ahead in your line: swing to the other side of the road */
      if (c.t > 0 && g.traffic && (x.look = (x.look || 0) - dt) <= 0) {
        x.look = 0.25; const ah = this.at(c.rt.pts, c.cum, x.s + 9 + x.spd * 0.5, x.lat);
        if (g.traffic.near(ah.x, ah.z, 3.2).length) x.latT = x.lat > 0 ? -3.1 : 3.1;
      }
      if (x.latT != null) { x.lat += Math.max(-dt * 4, Math.min(dt * 4, x.latT - x.lat)); if (Math.abs(x.latT - x.lat) < 0.05) x.latT = null; }
      const p = this.at(c.rt.pts, c.cum, Math.max(0, x.s), x.lat), v = x.v;
      /* bumping into you: both get pushed apart and the rival loses speed */
      const dx = car.x - p.x, dz = car.z - p.z, d = Math.hypot(dx, dz);
      if (d < 2.7 && d > 0.01 && g.mode === 'car' && c.t > 0) { car.x += dx / d * (2.7 - d) * 0.5; car.z += dz / d * (2.7 - d) * 0.5; x.spd *= 0.97; }
      const y = g.world.surface(p.x, p.z, (v.y || 0) + 1).y;
      let dh = p.h - v.h; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
      v.x = p.x; v.z = p.z; v.y = y; v.h += dh * Math.min(1, dt * 8); v.vx = Math.sin(v.h) * x.spd; v.vz = Math.cos(v.h) * x.spd; v.steer = Math.max(-0.5, Math.min(0.5, dh * 2)); v.spin = (v.spin || 0) + x.spd * dt / 0.33; v.roll = -dh * 0.1;
      v.sync();
    }
    /* checkpoints in order */
    const cp = c.cps[c.i];
    this.cp.visible = !g.rooms.inside; this.cp.position.set(cp.x, sampleHeight(plan.height, cp.x, cp.z) + 4, cp.z); this.cp.rotation.y = cp.h;
    if (Math.hypot(car.x - cp.x, car.z - cp.z) < 14 && c.t > 0) {
      c.i++; if (g.audio) g.audio.chime(c.i >= c.cps.length ? 988 : 784);
      if (c.i >= c.cps.length) { const place = 1 + c.rivals.filter((x) => x.done && x.done < c.t).length; this.end(place, Math.round(c.t * 1000)); return; }
    }
    /* quitting: out of the car, or far off the route for a while */
    c.out = g.mode !== 'car' ? c.out + dt : 0; c.off = pr.off > 220 ? c.off + dt : 0;
    if (c.out > 6 || c.off > 12 || c.t > 600) { this.why = [c.out, c.off, c.t, g.mode]; this.end(0); return; }
    const place = 1 + c.rivals.filter((x) => x.done ? true : x.s > total - pr.left).length;
    const txt = c.t < 0 ? T('race_' + c.r.id) : T('race_pos', { p: place, n: c.rivals.length + 1 }) + ' · ' + T('race_cp', { i: Math.min(c.i + 1, c.cps.length), n: c.cps.length }) + ' · ' + fmt(c.t * 1000);
    if (this.el.textContent !== txt) this.el.textContent = txt; this.el.hidden = false;
  }
  /* for the maps */
  pins() { return RACES.map((r) => ({ x: r.s[0], z: r.s[1], id: r.id })); }
}
function fmt(ms) { const s = Math.max(0, ms) / 1000, m = Math.floor(s / 60); return m + ':' + (s - m * 60).toFixed(1).padStart(4, '0'); }
