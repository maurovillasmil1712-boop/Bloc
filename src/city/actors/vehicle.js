/* The player's car: a bicycle model with tyre slip and grip limits, weight transfer, a handbrake for drifts,
   suspension that rolls, dips and squats, ramps and air time, and collisions that bounce and spin. */
import * as THREE from 'three/webgpu';
import { buildCar, carMaterials, makePaint, TYPES } from './carmesh.js';
import { buildMoto } from './moto.js';

const G = 9.81;
export class Vehicle {
  constructor(type, color, world) {
    this.type = TYPES[type] || type === 'moto' ? type : 'hatch';
    this.world = world;
    const parts = this.type === 'moto' ? buildMoto(false) : buildCar(this.type), M = carMaterials();
    this.moto = this.type === 'moto';
    this.T = parts.T;
    this.group = new THREE.Group(); this.body = new THREE.Group(); this.group.add(this.body);
    this.paint = makePaint(color || '#FFE14D');
    const add = (g, m) => { if (!g) return null; const o = new THREE.Mesh(g, m); o.castShadow = true; o.receiveShadow = true; this.body.add(o); return o; };
    this.paintMesh = add(parts.paint, this.paint); this.glassMesh = add(parts.glass, M.glass);
    /* the inside: the body seen from within, dashboard, gauges, wheel, seats */
    const T0 = parts.T;
    if (!this.moto) {
      /* door panels from the inside: the body below the window line, seen from within */
      const src = parts.paint.index ? parts.paint.toNonIndexed() : parts.paint, P = src.attributes.position.array, belt = T0.H * 0.62, keep = [];
      for (let i = 0; i < P.length; i += 9) if (P[i + 1] < belt && P[i + 4] < belt && P[i + 7] < belt) for (let k = 0; k < 9; k++) keep.push(P[i + k]);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3)); g.computeVertexNormals();
      this.body.add(new THREE.Mesh(g, new THREE.MeshStandardNodeMaterial({ color: '#2B2D31', roughness: 0.9, side: THREE.BackSide })));
    }
    const trimM = new THREE.MeshStandardNodeMaterial({ color: '#1C1D20', roughness: 0.7 }), seatM = new THREE.MeshStandardNodeMaterial({ color: '#3A3530', roughness: 0.95 });
    const box = (w, h, d, m, x, y, z, rx = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.x = rx; this.body.add(o); return o; };
    if (!this.moto) {
      box(T0.W * 0.84, 0.16, 0.42, trimM, 0, T0.H * 0.6, T0.L * 0.13, -0.15);
      for (const sx of [0.36, -0.36]) { box(0.46, 0.12, 0.48, seatM, sx, T0.H * 0.36, -0.18); box(0.46, 0.62, 0.1, seatM, sx, T0.H * 0.58, -0.44, -0.18); box(0.26, 0.16, 0.08, seatM, sx, T0.H * 0.95, -0.5, -0.1); }
      box(0.18, 0.2, 0.7, trimM, 0, T0.H * 0.42, 0.0);
      const gauge = new THREE.MeshBasicNodeMaterial({ color: '#3E7FB8' });
      for (const gx of [0.29, 0.43]) { const g = new THREE.Mesh(new THREE.CircleGeometry(0.016, 14), gauge); g.position.set(gx, T0.H * 0.655, T0.L * 0.13 - 0.215); g.rotation.set(-0.5, Math.PI, 0); this.body.add(g); }
      const col = new THREE.Group(); col.position.set(0.36, T0.H * 0.62, T0.L * 0.06); col.rotation.x = -1.1; this.body.add(col);
      this.wheelSpin = new THREE.Group(); col.add(this.wheelSpin);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.022, 8, 28), trimM); this.wheelSpin.add(ring);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12).rotateX(Math.PI / 2), trimM); this.wheelSpin.add(hub);
      for (const a of [0, 2.1, 4.2]) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.015), trimM); sp.position.set(Math.cos(a) * 0.08, Math.sin(a) * 0.08, 0); sp.rotation.z = a; this.wheelSpin.add(sp); }
    }
    this.base = { paint: parts.paint.attributes.position.array.slice(), glass: parts.glass ? parts.glass.attributes.position.array.slice() : null };
    this.dmg = 0; add(parts.trim, M.trim); add(parts.light, M.light); add(parts.tail, M.tail); add(parts.plate, M.plate); add(parts.chrome, M.chrome);
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
  /* a hit from the direction (nx, nz) (pointing from the obstacle to the car), strength in m/s:
     dent the body around the contact point, crack the glass, lose some performance, smoke when it's bad */
  damage(nx, nz, strength) {
    if (strength < 3.5) return;
    const T = this.T, fx = Math.sin(this.h), fz = Math.cos(this.h), lx = Math.cos(this.h), lz = -Math.sin(this.h);
    const df = -(nx * fx + nz * fz), dl = -(nx * lx + nz * lz), k = Math.max(Math.abs(df) / (T.L / 2), Math.abs(dl) / (T.W / 2)) || 1;
    const cx = dl / k, cz = df / k, cy = T.H * 0.42, depth = Math.min(0.2, (strength - 3) * 0.012), R = 0.55 + Math.min(0.6, strength * 0.03);
    const dent = (geo, base) => {
      if (!geo || !base) return;
      const P = geo.attributes.position.array;
      for (let i = 0; i < P.length; i += 3) {
        const dx = P[i] - cx, dy = (P[i + 1] - cy) * 0.8, dz = P[i + 2] - cz, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d > R) continue;
        const f = (1 - d / R) ** 2 * depth;
        /* push inward, toward the middle of the car, plus a little crumple noise */
        P[i] -= Math.sign(cx) * f * Math.min(1, Math.abs(cx) / (T.W / 2) + 0.2) * (Math.abs(dl) > Math.abs(df) * 0.6 ? 1 : 0.3);
        P[i + 2] -= Math.sign(cz) * f * (Math.abs(df) > Math.abs(dl) * 0.6 ? 1 : 0.3);
        P[i + 1] -= f * 0.25 * (0.5 + Math.sin(i * 12.9898) * 0.5);
        /* never more than 30 cm from the original shape */
        for (let a = 0; a < 3; a++) P[i + a] = Math.max(base[i + a] - 0.3, Math.min(base[i + a] + 0.3, P[i + a]));
      }
      geo.attributes.position.needsUpdate = true; geo.computeVertexNormals();
    };
    dent(this.paintMesh && this.paintMesh.geometry, this.base.paint);
    dent(this.glassMesh && this.glassMesh.geometry, this.base.glass);
    this.dmg = Math.min(1, this.dmg + (strength - 3) / 60);
  }
  repair() {
    for (const [mesh, base] of [[this.paintMesh, this.base.paint], [this.glassMesh, this.base.glass]]) { if (!mesh || !base) continue; mesh.geometry.attributes.position.array.set(base); mesh.geometry.attributes.position.needsUpdate = true; mesh.geometry.computeVertexNormals(); }
    this.dmg = 0;
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
      const topNow = P.top * (road ? 1 : 0.6) * (1 - this.dmg * 0.35);
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
    if (hit > 3) { this.lastHit = hit; this.lastN = { x: best.x, z: best.z }; this.damage(best.x, best.z, hit); }
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
    if (this.moto) {
      /* a bike leans into the turn instead of rolling out of it */
      const v = Math.hypot(this.vx, this.vz), want = this.air ? 0 : Math.max(-0.75, Math.min(0.75, -this.r * v / 9.81));
      this.lean = (this.lean || 0) + (want - (this.lean || 0)) * 0.18;
      this.body.rotation.set(this.air ? -this.vy * 0.012 + this.pitch * 0.5 : this.pitch * 0.5, 0, this.lean);
      this.body.position.y = 0;
    } else {
      this.body.rotation.set(this.air ? -this.vy * 0.012 + this.pitch : this.pitch, 0, this.roll);
      this.body.position.y = -Math.abs(this.roll) * 0.4;
    }
    if (this.wheelSpin) this.wheelSpin.rotation.z = -this.steer * 2.4;
    this.wheels.forEach((w, i) => {
      w.rotation.set(this.spin, (this.moto ? i < 1 : i < 2) ? -this.steer * (this.moto ? 0.5 : 0.85) : 0, this.moto ? this.lean || 0 : 0, 'YXZ');
      if (this.moto) { const b = w.userData.base; w.position.x = b.x - Math.sin(this.lean || 0) * b.y; w.position.y = b.y * Math.cos(this.lean || 0); }
      w.position.y = w.userData.base.y + (i % 2 ? 1 : -1) * this.roll * 0.15 * 0;
    });
  }
}
