/* Police. Patrol cars live in the traffic. Now and then one pulls a driver over: they talk, and the driver either
   takes the warning or floors it and gets chased. You get wanted stars for crimes a patrol sees (knocking someone
   over, ramming a police car, fighting); patrols then leave the road graph and come after you. Stop near them and
   you're busted; get 160 m clear for 12 s and you've lost them. Neither costs coins. v7.8: up to five stars; at four and
   five more patrols come, they drive faster and you need to get further away for longer. */
import * as THREE from 'three/webgpu';
import { T } from './i18n.js';
import { FootCops, Heli } from './cops.js';

export class Police {
  constructor(game, traffic, scene) {
    this.g = game; this.tr = traffic; this.stars = 0; this.calm = 0; this.close = 0; this.stopT = 25 + Math.random() * 20; this.stops = [];
    /* flashing beacons on cars with sirens on */
    this.bustAt = -1; this.hotT = 0; try { this.hotBest = +localStorage.getItem('bloc:city:mw') || 0; } catch (e) { this.hotBest = 0; }
    this.M = new THREE.Matrix4(); this.cR = new THREE.Color(5, 0.3, 0.3); this.cB = new THREE.Color(0.3, 0.6, 6); this.cD = new THREE.Color(0.05, 0.05, 0.06);
    const geo = new THREE.BoxGeometry(0.28, 0.12, 0.22);
    this.beacons = new THREE.InstancedMesh(geo, new THREE.MeshBasicNodeMaterial({ color: '#FFFFFF' }), 64); this.beacons.count = 0; this.beacons.frustumCulled = false;
    scene.add(this.beacons);
    this.foot = new FootCops(game); this.heli = new Heli(game);
    const el = document.createElement('div'); el.className = 'bc-wanted'; el.setAttribute('aria-live', 'polite'); game.ui.el.appendChild(el); this.el = el;
  }
  get cops() { return this.tr.cars.filter((c) => c.alive && c.type === 'police'); }
  /* a crime at (x, z): only counts if a patrol is close enough to see it */
  crime(kind, x, z) {
    /* gunfire is heard much further away than a fight is seen; shooting someone down is worth two stars */
    const reach = kind === 'shoot' || kind === 'kill' ? 220 : kind === 'steal' ? 70 : 95;
    const seen = kind === 'ram' || this.cops.some((c) => Math.hypot(c.x - x, c.z - z) < reach);
    if (!seen) return;
    const before = this.stars;
    if (kind === 'shoot' && this.stars >= 1) { this.calm = 0; return; }
    this.stars = Math.min(5, this.stars + (kind === 'kill' ? 2 : 1)); this.calm = 0;
    if (this.stars !== before) { this.g.say(T('wanted'), '★'.repeat(this.stars)); this.pursue(); }
  }
  pursue() {
    const me = this.g.me(), want = this.stars * 2;
    let n = 0;
    for (const c of this.cops) {
      if (n >= want) break;
      if (c.mode === 'free') { n++; continue; }
      if (Math.hypot(c.x - me.x, c.z - me.z) < 450) { this.free(c); n++; }
    }
    /* not enough patrols around: send more from further away */
    for (const c of this.tr.cars) {
      if (n >= want) break;
      if (!c.alive || c.type !== 'police' || c.mode === 'free') continue;
      this.free(c); n++;
    }
  }
  free(c) { if (c.target) { c.target.mode = 'lane'; c.target = null; } c.mode = 'free'; c.v = Math.max(c.v, 8); c.siren = true; }
  release() {
    const me = this.g.me();
    for (const c of this.tr.cars) if (c.mode === 'free') { c.siren = false; c.dropped = 0; this.tr.spawn(c, me.x, me.z, true); }
  }
  update(dt) {
    const g = this.g, me = g.me(), tr = this.tr, W = g.world;
    /* patrols chasing you: drive straight at you, around buildings */
    let nearest = 1e9, closeCop = false;
    for (const c of tr.cars) {
      if (c.mode !== 'free') continue;
      const dx = me.x - c.x, dz = me.z - c.z, d = Math.hypot(dx, dz);
      nearest = Math.min(nearest, d);
      const want = Math.atan2(dx, dz); let dh = want - c.h; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
      c.h += Math.max(-1, Math.min(1, dh)) * dt * (1.2 + Math.min(1, c.v / 20));
      const vT = d < 6.5 ? 0 : Math.min(33 + Math.max(0, this.stars - 3) * 3, Math.max(4, (d - 5) * 1.1)) * (Math.abs(dh) > 1.2 ? 0.5 : 1);
      c.v += Math.max(-14, Math.min(7, vT - c.v)) * dt;
      if (d < 6.5) c.h -= Math.max(-1, Math.min(1, dh)) * dt * (1.2 + Math.min(1, c.v / 20));
      c.x += Math.sin(c.h) * c.v * dt; c.z += Math.cos(c.h) * c.v * dt;
      const p = { x: c.x, z: c.z }, pen = W.collide.resolve(p, 1.4, c.y + 0.8, { x: 0, z: 0 });
      if (pen > 0.05) { c.x = p.x; c.z = p.z; c.v *= 0.92; c.h += dh > 0 ? 0.04 : -0.04; }
      c.y = W.surface(c.x, c.z, c.y + 1).y + 0.02;
      if (d < 7) closeCop = true;
      /* stopped near you on foot: an officer gets out (two at three stars) */
      if (g.mode === 'foot' && this.stars > 0 && d < 14 && c.v < 2.5 && (c.dropped || 0) < (this.stars >= 3 ? 2 : 1)) this.foot.spawnFrom(c);
      /* at two stars or more, officers shoot at you when you're on foot and they can see you */
      if (this.stars >= 2 && g.mode === 'foot' && g.arms && !g.arms.off && d < 34 && d > 3) {
        c.gunT = (c.gunT == null ? 0.8 + Math.random() : c.gunT) - dt;
        if (c.gunT <= 0) { c.gunT = 1.1 + Math.random() * 0.9; if (this.sees(c, me)) g.arms.copShot(c); }
      }
      /* contact with your car: a nudge */
      if (g.mode === 'car' && d < 3.4 && d > 0.01) { const nx = -dx / d, nz = -dz / d; g.car.x -= nx * (3.4 - d) * 0.5; g.car.z -= nz * (3.4 - d) * 0.5; }
    }
    if (this.stars > 0) {
      const slow = g.mode !== 'car' || g.car.speed < 2.5;
      /* on foot it's the officers who arrest you (see cops.js); in a car, boxing you in does it */
      this.close = closeCop && slow && g.mode !== 'foot' ? this.close + dt : Math.max(0, this.close - dt * 2);
      if (this.close > 2.5) this.busted();
      const hot = Math.max(0, this.stars - 3);
      this.calm = nearest > 160 + hot * 50 ? this.calm + dt : 0;
      if (this.stars >= 4) this.hotT += dt;
      if (this.calm > 12 + hot * 6) { this.stars = 0; this.calm = 0; g.say(T('lost_them'), T('lost_them_sub')); this.release(); this.mostWanted(); }
      if (g.audio) g.audio.siren(nearest);
    } else if (g.audio) g.audio.siren(1e9);
    this.stopsTick(dt);
    this.foot.update(dt); this.heli.update(dt);
    this.draw();
    const txt = this.stars ? '★'.repeat(this.stars) + '☆'.repeat(5 - this.stars) : '';
    if (this.el.textContent !== txt) { this.el.textContent = txt; this.el.classList.toggle('on', !!txt); }
  }
  /* a clear line from the patrol car to you (no building in between) */
  sees(c, me) {
    const W = this.g.world, d = Math.hypot(me.x - c.x, me.z - c.z), P = { x: 0, z: 0 };
    for (let t = 2; t < d - 1; t += 1.5) { P.x = c.x + (me.x - c.x) * t / d; P.z = c.z + (me.z - c.z) * t / d; if (W.collide.resolve(P, 0.05, c.y + 1.3, { x: 0, z: 0 }) > 0) return false; }
    return true;
  }
  busted() {
    const g = this.g; this.stars = 0; this.close = 0; this.calm = 0; this.foot.clear(); this.bustAt = performance.now() / 1000; this.hotT = 0;
    g.ui.fade.classList.add('on'); g.say(T('busted'), T('busted_sub'));
    g.talk.say(null, g.talk.pick('cop_bust'), { name: T('officer') });
    if (g.mode === 'car') { g.car.vx = g.car.vz = 0; }
    this.release();
    setTimeout(() => g.ui.fade.classList.remove('on'), 700);
  }
  /* the Most wanted challenge: how long you stayed at four stars or more before losing them */
  mostWanted() {
    const t = this.hotT; this.hotT = 0; if (t < 5) return;
    if (t > this.hotBest) { this.hotBest = t; try { localStorage.setItem('bloc:city:mw', String(Math.round(t))); } catch (e) { /* private mode */ } }
    const f = (s) => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');
    setTimeout(() => this.g.say(T('mw_title'), T('mw_sub', { t: f(t), b: f(this.hotBest) })), 2600);
  }
  /* police pulling over other drivers, near you so you can watch */
  stopsTick(dt) {
    const g = this.g, me = g.me();
    this.stopT -= dt;
    if (this.stopT <= 0 && this.stars === 0) {
      this.stopT = 35 + Math.random() * 30;
      const cop = this.cops.find((c) => c.mode === 'lane' && Math.hypot(c.x - me.x, c.z - me.z) < 160);
      if (cop) {
        let best = null, bd = 1e9;
        for (const c of this.tr.cars) { if (!c.alive || c === cop || c.type === 'police' || c.mode !== 'lane' || c.e !== cop.e || c.dir !== cop.dir) continue; const ahead = c.s - cop.s; if (ahead > 6 && ahead < 70 && ahead < bd) { bd = ahead; best = c; } }
        if (best) { best.mode = 'pull'; cop.mode = 'pull'; cop.target = best; cop.siren = true; this.stops.push({ cop, car: best, t: 0, phase: 0, flee: Math.random() < 0.3 }); }
      }
    }
    for (const s of this.stops) {
      s.t += dt;
      const { cop, car } = s, near = Math.hypot(car.x - me.x, car.z - me.z) < 32;
      if (s.phase === 0 && car.mode === 'stop' && (cop.mode === 'stop' || s.t > 14)) { s.phase = 1; s.t = 0; }
      if (s.phase === 1) {
        if (!s.talked && near) { s.talked = true; this.dialogue(s); }
        if (s.t > (s.flee ? 6 : 13)) {
          if (s.flee) { car.mode = 'flee'; car.chaser = cop; cop.mode = 'chase'; cop.target = null; cop.route = []; cop.siren = true; s.phase = 2; s.t = 0; if (near) g.talk.say(car, g.talk.pick('civ_flee'), { name: T('driver') }); }
          else { car.mode = 'lane'; cop.mode = 'lane'; cop.target = null; cop.siren = false; s.done = true; }
        }
      }
      if (s.phase === 2) {
        if (s.t > 8 && Math.random() < dt * 0.15 || s.t > 28) {
          car.mode = 'lane'; car.chaser = null; cop.mode = 'lane'; cop.route = []; cop.siren = false; s.done = true;
          if (Math.hypot(cop.x - me.x, cop.z - me.z) < 40) g.talk.say(cop, g.talk.pick(Math.random() < 0.5 ? 'cop_lost' : 'cop_bust'), { name: T('officer') });
        } else if (!s.yelled && s.t > 2 && Math.hypot(cop.x - me.x, cop.z - me.z) < 45) { s.yelled = true; g.talk.say(cop, g.talk.pick('cop_chase'), { name: T('officer') }); }
      }
      if (!car.alive || !cop.alive || cop.mode === 'free') { if (car.mode !== 'free') car.mode = 'lane'; s.done = true; }
    }
    this.stops = this.stops.filter((s) => !s.done);
  }
  async dialogue(s) {
    const t = this.g.talk, cop = s.cop, car = s.car;
    await t.say(cop, t.pick('cop_stop'), { name: T('officer'), range: 34 });
    await t.say(car, t.pick(s.flee ? 'civ_flee' : 'civ_comply'), { name: T('driver'), range: 34 });
    if (!s.flee) await t.say(cop, t.pick('cop_ok'), { name: T('officer'), range: 34 });
  }
  draw() {
    const M = this.M, on = Math.floor(performance.now() / 160) % 2, R = this.cR, B = this.cB, D = this.cD;
    let i = 0;
    for (const c of this.tr.cars) {
      if (!c.alive || c.type !== 'police' || i > 62) continue;
      const fx = Math.cos(c.h), fz = -Math.sin(c.h), y = c.y + 1.56;
      for (const side of [1, -1]) {
        M.makeRotationY(c.h); M.setPosition(c.x + fx * side * 0.33 - Math.sin(c.h) * 0.1, y, c.z + fz * side * 0.33 - Math.cos(c.h) * 0.1);
        this.beacons.setMatrixAt(i, M);
        this.beacons.setColorAt(i, c.siren ? ((on ? side > 0 : side < 0) ? (side > 0 ? R : B) : D) : D); i++;
      }
    }
    this.beacons.count = i; this.beacons.instanceMatrix.needsUpdate = true; if (this.beacons.instanceColor) this.beacons.instanceColor.needsUpdate = true;
  }
}
