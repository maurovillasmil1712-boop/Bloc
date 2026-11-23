/* Police on foot and in the air (v7.5). When a chasing patrol car stops near you while you're on foot, an officer
   gets out and runs at you: if they reach you and hold you for a moment, you're busted (no coins lost). With two
   stars or more and a weapon out, they shoot back. At three stars a helicopter circles overhead with a searchlight.
   Officers can be punched down or shot down like anyone else; they get back up unless blood is on. */
import * as THREE from 'three/webgpu';
import { Human } from '../actors/human.js';
import { sampleHeight } from '../world/plan.js';
import { T } from './i18n.js';

const UNIFORM = { skin: '#C98E66', hair: 'short', hairC: '#1B1714', top: { kind: 'shirt', c: '#1D2A44' }, bottom: { kind: 'jeans', c: '#151B2B' }, shoes: { kind: 'boot', c: '#111111' }, hat: { kind: 'cap', c: '#141C30' } };
const SKINS = ['#F6D7C3', '#E8B896', '#C98E66', '#9A6440', '#6B4228'];

export class FootCops {
  constructor(game) { this.g = game; this.list = []; this.cool = 0; }
  spawnFrom(car) {
    if (this.list.length >= 3) return;
    const g = this.g, look = Object.assign({}, UNIFORM, { skin: SKINS[Math.floor(Math.random() * SKINS.length)] });
    const h = new Human(look); const lx = Math.cos(car.h), lz = -Math.sin(car.h);
    const o = { h, x: car.x + lx * 1.4, z: car.z + lz * 1.4, y: car.y, a: car.h, hp: 100, state: 'run', t: 0, grab: 0, gunT: 1 + Math.random(), voice: Math.random() < 0.3 ? 'f' : 'm', car };
    o.y = sampleHeight(g.plan.height, o.x, o.z); h.group.position.set(o.x, o.y, o.z); g.scene.add(h.group);
    this.list.push(o); car.dropped = (car.dropped || 0) + 1;
    g.talk.say({ x: o.x, z: o.z }, g.talk.pick(g.arms && g.arms.cur ? 'cop_gun' : 'cop_chase', o.voice), { name: T('officer') });
  }
  clear() { for (const o of this.list) this.g.scene.remove(o.h.group); this.list = []; }
  /* someone hit an officer: fists (1 hit = 34) or bullets */
  hit(o, dmg, fx, fz, blood) {
    o.hp -= dmg; o.kx = fx; o.kz = fz;
    if (o.hp <= 0 && o.state !== 'down') { o.state = 'down'; o.t = 0; o.fall = 0; o.fallDir = Math.atan2(fx, fz) + Math.PI; o.gone = !!blood; this.g.police.crime('kill', o.x, o.z); return 'down'; }
    if (o.state !== 'down') { o.state = 'stagger'; o.t = 0; }
    return 'hit';
  }
  nearest(x, z, r) { let b = null, bd = r; for (const o of this.list) { if (o.state === 'down') continue; const d = Math.hypot(o.x - x, o.z - z); if (d < bd) { bd = d; b = o; } } return b; }
  update(dt) {
    const g = this.g, P = g.police, me = g.me(), W = g.world;
    for (const o of this.list) {
      o.t += dt;
      const dx = me.x - o.x, dz = me.z - o.z, d = Math.hypot(dx, dz);
      let speed = 0;
      if (o.state === 'down') {
        o.fall = Math.min(1, (o.fall || 0) + dt * 3);
        if (o.t > (o.gone ? 25 : 7)) { if (o.gone) o.remove = true; else { o.state = 'run'; o.hp = 100; o.fall = 0; } }
      } else if (o.state === 'stagger') {
        o.x += (o.kx || 0) * dt * 2; o.z += (o.kz || 0) * dt * 2; if (o.t > 0.5) { o.state = 'run'; o.t = 0; }
      } else if (P.stars === 0 || d > 120) {
        /* it's over: walk back to the car and go */
        const cx = o.car.x - o.x, cz = o.car.z - o.z, cd = Math.hypot(cx, cz);
        o.a = Math.atan2(cx, cz); speed = 1.6;
        if (cd < 2 || o.t > 25 || d > 150) o.remove = true;
      } else {
        o.a += angDiff(Math.atan2(dx, dz), o.a) * Math.min(1, dt * 6);
        const armed = g.arms && g.arms.cur && P.stars >= 2 && g.mode === 'foot';
        if (armed && d < 26 && d > 4) {
          /* stand and shoot */
          speed = 0; o.gunT -= dt;
          if (o.gunT <= 0) { o.gunT = 0.9 + Math.random() * 0.8; g.arms.copShot({ x: o.x - Math.cos(o.a) * 1.1, z: o.z + Math.sin(o.a) * 1.1, h: o.a, y: o.y - 0.2 }); }
        } else if (g.mode === 'foot') {
          speed = d > 1.1 ? 5.4 : 0;
          if (d < 1.3) { o.grab += dt; if (o.grab > 1.4) { P.busted(); this.clear(); return; } } else o.grab = Math.max(0, o.grab - dt);
        } else {
          /* you're back in a car: run back to theirs */
          const cx = o.car.x - o.x, cz = o.car.z - o.z; o.a = Math.atan2(cx, cz); speed = 5; if (Math.hypot(cx, cz) < 2) o.remove = true;
        }
      }
      if (speed) {
        o.x += Math.sin(o.a) * speed * dt; o.z += Math.cos(o.a) * speed * dt;
        const p = { x: o.x, z: o.z }; if (W.collide.resolve(p, 0.3, o.y + 0.9, { x: 0, z: 0 }) > 0.02) { o.x = p.x; o.z = p.z; }
      }
      o.y = sampleHeight(g.plan.height, o.x, o.z);
      const grp = o.h.group; grp.position.set(o.x, o.y, o.z); grp.rotation.set(0, o.a, 0);
      o.h.animate(dt, { speed: o.state === 'down' ? 0 : speed, guard: false });
      if (o.state === 'down') { grp.rotation.set(-1.45 * o.fall, o.fallDir || o.a, 0, 'YXZ'); grp.position.y -= 0.05 * o.fall; }
      if (o.state === 'stagger') grp.rotation.x = -0.25;
      /* arms out when they're about to grab you, gun arm up when they shoot */
      if (o.state === 'run' && g.arms && g.arms.cur && P.stars >= 2 && d < 26) { const R = o.h.arms.find((a) => a.sx === -1); R.upper.rotation.set(-1.5, 0, 0.1); R.fore.rotation.set(-0.05, 0, 0); }
      else if (o.state === 'run' && d < 2.5) for (const A of o.h.arms) { A.upper.rotation.set(-1.2, 0, A.sx * 0.15); A.fore.rotation.set(-0.3, 0, 0); }
    }
    for (const o of this.list) if (o.remove) g.scene.remove(o.h.group);
    this.list = this.list.filter((o) => !o.remove);
  }
}

/* the helicopter: body, tail boom, skids, two spinning rotors, a searchlight cone at dusk and night */
function buildHeli() {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardNodeMaterial({ color: '#E9ECF1', roughness: 0.35, metalness: 0.2 }), ink = new THREE.MeshStandardNodeMaterial({ color: '#1D2A44', roughness: 0.4 });
  const glass = new THREE.MeshStandardNodeMaterial({ color: '#16202C', roughness: 0.05, metalness: 0.4 });
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  const cab = new THREE.SphereGeometry(1, 18, 12); cab.scale(1.1, 1.05, 2.0); add(cab, body, 0, 0, 0);
  const nose = new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2); nose.scale(1.0, 0.9, 1.4); nose.rotateX(Math.PI / 2); add(nose, glass, 0, 0.1, 1.0);
  add(new THREE.BoxGeometry(2.24, 0.3, 2.6), ink, 0, -0.35, 0);
  const boom = new THREE.CylinderGeometry(0.18, 0.32, 5, 10); boom.rotateX(Math.PI / 2); add(boom, body, 0, 0.3, -4.2);
  add(new THREE.BoxGeometry(0.1, 1.3, 0.8), ink, 0, 0.8, -6.5);
  for (const sx of [-1, 1]) { add(new THREE.BoxGeometry(0.1, 0.1, 3.4), ink, sx * 0.95, -1.35, 0); add(new THREE.BoxGeometry(0.08, 0.6, 0.08), ink, sx * 0.8, -1.05, 0.8); add(new THREE.BoxGeometry(0.08, 0.6, 0.08), ink, sx * 0.8, -1.05, -0.8); }
  const rotor = new THREE.Group(); rotor.position.set(0, 1.25, 0); g.add(rotor);
  for (const a of [0, Math.PI / 2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(11, 0.05, 0.32), ink); b.rotation.y = a; rotor.add(b); }
  const tail = new THREE.Group(); tail.position.set(0.15, 0.8, -6.5); g.add(tail);
  const tb = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.8, 0.16), ink); tail.add(tb);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(9, 60, 24, 1, true).translate(0, -30, 0), new THREE.MeshBasicNodeMaterial({ color: '#FFF6D8', transparent: true, opacity: 0.09, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  beam.position.set(0, -0.6, 1.2); g.add(beam);
  const spot = new THREE.Mesh(new THREE.CircleGeometry(8, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicNodeMaterial({ color: '#FFF6D8', transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
  return { g, rotor, tail, beam, spot };
}

export class Heli {
  constructor(game) { this.g = game; this.on = false; this.a = 0; this.built = null; this.pos = new THREE.Vector3(); }
  update(dt) {
    const g = this.g, P = g.police, me = g.me();
    const want = P.stars >= 3;
    if (want && !this.built) { this.built = buildHeli(); g.scene.add(this.built.g); g.scene.add(this.built.spot); this.pos.set(me.x + 300, (me.y || 0) + 120, me.z + 300); }
    if (!this.built) return;
    const B = this.built;
    /* circle above you, or fly off and go when the stars are gone */
    this.a += dt * 0.22;
    const tx = want ? me.x + Math.cos(this.a) * 38 : this.pos.x + 60, tz = want ? me.z + Math.sin(this.a) * 38 : this.pos.z + 60, ty = (me.y || 0) + (want ? 46 : 140);
    const k = Math.min(1, dt * (want ? 0.6 : 0.3));
    const vx = (tx - this.pos.x) * k, vz = (tz - this.pos.z) * k;
    this.pos.x += vx; this.pos.y += (ty - this.pos.y) * k; this.pos.z += vz;
    B.g.position.copy(this.pos);
    const face = Math.atan2(me.x - this.pos.x, me.z - this.pos.z);
    B.g.rotation.set(Math.min(0.25, Math.hypot(vx, vz) * 0.4), face, 0, 'YXZ');
    B.rotor.rotation.y += dt * 38; B.tail.rotation.x += dt * 60;
    const night = g.sky.state ? g.sky.state.night : 0;
    B.beam.visible = B.spot.visible = want && night > 0.25;
    if (B.beam.visible) {
      B.beam.lookAt(me.x, me.y || 0, me.z); B.beam.rotateX(-Math.PI / 2);
      B.spot.position.set(me.x + Math.sin(this.a * 3) * 2, sampleHeight(g.plan.height, me.x, me.z) + 0.08, me.z + Math.cos(this.a * 3) * 2);
    }
    if (g.audio) g.audio.rotor(Math.hypot(this.pos.x - me.x, this.pos.y - (me.y || 0), this.pos.z - me.z));
    if (!want && Math.hypot(this.pos.x - me.x, this.pos.z - me.z) > 450) { g.scene.remove(B.g); g.scene.remove(B.spot); this.built = null; if (g.audio) g.audio.rotor(1e9); }
  }
}
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
