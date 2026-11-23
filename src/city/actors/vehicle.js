/* The player's car: a bicycle model with tyre slip and grip limits, weight transfer, a handbrake for drifts,
   suspension that rolls, dips and squats, ramps and air time, and collisions that bounce and spin. */
import * as THREE from 'three/webgpu';
import { buildCar, carMaterials, makePaint, TYPES } from './carmesh.js';

const G = 9.81;
export class Vehicle {
  constructor(type, color, world) {
    this.type = TYPES[type] ? type : 'hatch';
    this.world = world;
    const parts = buildCar(this.type), M = carMaterials();
    this.T = parts.T;
    this.group = new THREE.Group(); this.body = new THREE.Group(); this.group.add(this.body);
    this.paint = makePaint(color || '#FFE14D');
    const add = (g, m) => { if (!g) return null; const o = new THREE.Mesh(g, m); o.castShadow = true; o.receiveShadow = true; this.body.add(o); return o; };
    add(parts.paint, this.paint); add(parts.glass, M.glass); add(parts.trim, M.trim); add(parts.light, M.light); add(parts.tail, M.tail); add(parts.plate, M.plate); add(parts.chrome, M.chrome);
    this.wheels = parts.wheels.map(([x, y, z]) => {
      const w = new THREE.Group(); w.position.set(x, y, z);
      const t = new THREE.Mesh(parts.tyre, M.tyre), r = new THREE.Mesh(parts.rim, M.rim);
      t.castShadow = true; r.position.x = Math.sign(x) * 0.005; w.add(t, r); this.group.add(w); w.userData.base = new THREE.Vector3(x, y, z);
      return w;
    });
    this.brakeU = M.brakeU;
    /* state */
    this.x = 0; this.z = 0; this.y = 0; this.h = 0; this.vx = 0; this.vz = 0; this.vy = 0; this.r = 0;
    this.steer = 0; this.air = false; this.airT = 0; this.ramp = null; this.jumpId = -1;
    this.roll = 0; this.pitch = 0; this.rollV = 0; this.pitchV = 0; this.spin = 0; this.lastHit = 0; this.ax = 0; this.ay = 0;
    this.input = { throttle: 0, brake: 0, steer: 0, hand: 0 };
    const T = this.T;
    this.p = { m: T.mass, a: T.wb * 0.48, b: T.wb * 0.52, hcg: 0.5 + (T.H - 1.4) * 0.3, top: T.top, F: T.mass * T.acc, mu: 1.05 * T.grip, C: T.mass * 42 * T.grip, maxSteer: 0.62 };
    this.p.Iz = this.p.m * (T.L * T.L + T.W * T.W) / 12 * 1.1;
  }
  place(x, z, h, y) { this.x = x; this.z = z; this.h = h; this.y = y; this.vx = this.vz = this.r = 0; }
  get speed() { return Math.hypot(this.vx, this.vz); }
  get forward() { return this.vx * Math.sin(this.h) + this.vz * Math.cos(this.h); }
  step(dt) {
    const P = this.p, I = this.input, W = this.world;
    const fx = Math.sin(this.h), fz = Math.cos(this.h), lx = Math.cos(this.h), lz = -Math.sin(this.h);
    let vf = this.vx * fx + this.vz * fz, vl = this.vx * lx + this.vz * lz;
    const surf = W.surface(this.x, this.z, this.y);
    const road = surf.road, grip = (road ? 1 : 0.72) * (1 - W.wet * 0.18);
    /* steering eases in, and less at speed */
    const target = I.steer * P.maxSteer / (1 + Math.abs(vf) / 22);
    this.steer += (target - this.steer) * Math.min(1, dt * (I.steer ? 5 : 8));
    const d = -this.steer;
    if (!this.air) {
      const L = P.a + P.b;
      const Nf = P.m * G * P.b / L - P.m * this.ax * P.hcg / L, Nr = P.m * G * P.a / L + P.m * this.ax * P.hcg / L;
      let Fx = 0;
      const topNow = P.top * (road ? 1 : 0.6);
      if (I.throttle > 0) Fx += vf < -0.5 ? P.m * 9 : P.F * I.throttle * Math.max(0, 1 - Math.max(0, vf) / topNow);
      if (I.brake > 0) Fx += vf > 0.5 ? -P.m * 9.5 * I.brake : -P.F * 0.5 * I.brake * Math.max(0, 1 + vf / 10);
      Fx -= vf * Math.abs(vf) * 0.42 + vf * (road ? 12 : 60) * P.m / 1000;
      if (I.hand) Fx -= Math.sign(vf) * Math.min(Math.abs(vf) * P.m * 4, P.m * 3);
      let Fyf, Fyr;
      if (Math.abs(vf) < 2.5) {
        /* parking speeds: follow the wheels */
        const r = vf * Math.tan(d) / L; this.r += (r - this.r) * Math.min(1, dt * 12); vl *= Math.exp(-12 * dt);
        Fyf = Fyr = 0;
      } else {
        const af = Math.atan2(vl + P.a * this.r, Math.abs(vf)) - d * Math.sign(vf), ar = Math.atan2(vl - P.b * this.r, Math.abs(vf));
        const muF = P.mu * grip, muR = P.mu * grip * (I.hand ? 0.38 : 1);
        Fyf = -muF * Nf * Math.tanh(P.C * af / (muF * Nf + 1));
        Fyr = -muR * Nr * Math.tanh(P.C * ar / (muR * Nr + 1));
        const rdot = (P.a * Fyf * Math.cos(d) - P.b * Fyr) / P.Iz;
        this.r += rdot * dt;
        this.r *= Math.exp(-0.6 * dt);
      }
      const axl = (Fx - Fyf * Math.sin(d)) / P.m, ayl = (Fyr + Fyf * Math.cos(d)) / P.m;
      vf += (axl + vl * this.r) * dt; vl += (ayl - vf * this.r) * dt;
      /* tyres that bite: bleed off sideways sliding unless the handbrake is on */
      if (!I.hand) vl *= Math.exp(-dt * 3.2 * grip);
      if (Math.abs(vf) > 2.5 || I.steer) this.h += this.r * dt;
      this.ax += (axl - this.ax) * Math.min(1, dt * 8); this.ay += (ayl - this.ay) * Math.min(1, dt * 8);
      if (vf > topNow * 1.02) vf -= (vf - topNow) * Math.min(1, dt * 1.5);
    }
    const nfx = Math.sin(this.h), nfz = Math.cos(this.h), nlx = Math.cos(this.h), nlz = -Math.sin(this.h);
    this.vx = nfx * vf + nlx * vl; this.vz = nfz * vf + nlz * vl;
    this.x += this.vx * dt; this.z += this.vz * dt;
    /* the ground, ramps and air */
    const ra = this.air ? null : W.rampAt(this.x, this.z);
    const g = W.surface(this.x, this.z, this.y).y;
    if (ra) { this.y = g + ra.h; this.ramp = ra; }
    else if (this.ramp && !this.air) {
      const along = this.vx * this.ramp.fx + this.vz * this.ramp.fz;
      if (along > 6 && this.y - g > 1) { this.air = true; this.vy = along * this.ramp.slope * 1.25; this.airT = 0; this.jumpId = this.ramp.r.id; }
      this.ramp = null;
    }
    if (this.air) {
      this.vy -= 21 * dt; this.y += this.vy * dt; this.airT += dt; this.r *= Math.exp(-1.5 * dt);
      if (this.y <= g) { this.y = g; this.air = false; this.landed = this.airT; this.pitchV -= Math.min(4, Math.abs(this.vy) * 0.15); this.vy = 0; }
    } else if (!ra) {
      /* follow the ground with a little suspension lag so kerbs and slopes don't snap */
      const dy = g - this.y;
      this.y = dy > 0.6 || dy < -1.5 ? g : this.y + dy * Math.min(1, dt * 18);
    }
    /* walls, poles, trees: push out of every contact, then one soft impulse for the deepest. Cars crumple, they don't bounce */
    const hitN = { x: 0, z: 0 }, best = { x: 0, z: 0, pen: 0, o: 0 };
    for (const o of [-1, 0, 1]) {
      const bx = this.x + nfx * o * this.T.L * 0.33, bz = this.z + nfz * o * this.T.L * 0.33, c = { x: bx, z: bz };
      const pen = W.collide.resolve(c, this.T.W * 0.5, this.y + 0.5, hitN);
      if (pen > 0) { this.x += c.x - bx; this.z += c.z - bz; if (pen > best.pen) { best.x = hitN.x; best.z = hitN.z; best.pen = pen; best.o = o; } }
    }
    let hit = 0;
    if (best.pen > 0) {
      const vn = this.vx * best.x + this.vz * best.z;
      if (vn < 0) {
        hit = -vn;
        /* kill the speed into the wall (8% comes back), scrub some speed along it, a little spin off corners */
        this.vx -= 1.08 * vn * best.x; this.vz -= 1.08 * vn * best.z;
        const scrub = Math.max(0.55, 1 - hit * 0.025);
        const tx = this.vx - (this.vx * best.x + this.vz * best.z) * best.x, tz = this.vz - (this.vx * best.x + this.vz * best.z) * best.z;
        this.vx += (tx * scrub - tx); this.vz += (tz * scrub - tz);
        this.r += best.o * vn * 0.04 * Math.sign(best.x * nlx + best.z * nlz);
        this.r = Math.max(-2.5, Math.min(2.5, this.r));
      }
    }
    if (hit > 3) this.lastHit = hit;
    /* body: roll into turns, dip on brakes, squat on the gas, with springs */
    const rollT = Math.max(-0.09, Math.min(0.09, -this.ay * 0.011)) + surf.roll, pitchT = Math.max(-0.07, Math.min(0.07, -this.ax * 0.008)) + surf.pitch;
    this.rollV += ((rollT - this.roll) * 90 - this.rollV * 12) * dt; this.roll += this.rollV * dt;
    this.pitchV += ((pitchT - this.pitch) * 80 - this.pitchV * 11) * dt; this.pitch += this.pitchV * dt;
    this.spin += vf * dt / this.T.r;
    this.vf = vf; this.vl = vl;
    this.brakeU.value = I.brake > 0 && vf > 1 ? 1 : 0;
  }
  sync() {
    this.group.position.set(this.x, this.y, this.z);
    this.group.rotation.set(0, this.h, 0);
    this.body.rotation.set(this.air ? -this.vy * 0.012 + this.pitch : this.pitch, 0, this.roll);
    this.body.position.y = -Math.abs(this.roll) * 0.4;
    this.wheels.forEach((w, i) => {
      w.rotation.set(this.spin, i < 2 ? -this.steer * 0.85 : 0, 0, 'YXZ');
      w.position.y = w.userData.base.y + (i % 2 ? 1 : -1) * this.roll * 0.15 * 0;
    });
  }
}
