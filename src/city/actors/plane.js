/* A small propeller plane at the airport: drawn in code, flown with arcade physics.
   W and S set the power, arrows (or touch up/down) pitch, A and D bank into turns. Take off above 30 m/s. */
import * as THREE from 'three/webgpu';
import { limb } from './human.js';

function buildPlane(color) {
  const g = new THREE.Group();
  const white = new THREE.MeshPhysicalNodeMaterial({ color: '#F2F3F5', roughness: 0.35, metalness: 0.1, clearcoat: 0.8, clearcoatRoughness: 0.1 });
  const hl = new THREE.MeshStandardNodeMaterial({ color: color || '#FFE14D', roughness: 0.5 }), ink = new THREE.MeshStandardNodeMaterial({ color: '#191D29', roughness: 0.5 });
  const glass = new THREE.MeshPhysicalNodeMaterial({ color: '#203040', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.75 });
  const add = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
  /* fuselage along +z (nose forward) */
  const pts = [[0.001, -4.6], [0.25, -4.4], [0.45, -3.2], [0.62, -1.2], [0.72, 0.2], [0.74, 1.4], [0.66, 2.6], [0.45, 3.4], [0.2, 3.75], [0.001, 3.8]].map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.LatheGeometry(pts, 20); body.rotateX(Math.PI / 2); body.scale(1, 1.05, 1); add(body, white, 0, 1.6, 0);
  const stripe = new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p.x * 1.005, p.y)).slice(2, 7), 20, -0.35, 0.7); stripe.rotateX(Math.PI / 2); add(stripe, hl, 0, 1.6, 0).rotation.z = Math.PI / 2;
  const can = new THREE.SphereGeometry(0.62, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2); can.scale(0.85, 0.75, 1.8); add(can, glass, 0, 2.1, 1.0);
  add(new THREE.BoxGeometry(10.4, 0.14, 1.55), white, 0, 1.75, 0.6);
  for (const sx of [1, -1]) add(new THREE.BoxGeometry(0.9, 0.15, 1.56), hl, sx * 4.8, 1.75, 0.6);
  add(new THREE.BoxGeometry(3.6, 0.1, 0.9), white, 0, 1.75, -4.0);
  const fin = new THREE.BoxGeometry(0.1, 1.5, 1.1); add(fin, white, 0, 2.45, -4.1).rotation.x = -0.25;
  add(new THREE.BoxGeometry(0.11, 0.5, 0.6), hl, 0, 3.0, -4.35).rotation.x = -0.25;
  const spinner = new THREE.ConeGeometry(0.22, 0.45, 14); spinner.rotateX(Math.PI / 2); add(spinner, ink, 0, 1.6, 4.0);
  const prop = new THREE.Group(); prop.position.set(0, 1.6, 4.15); g.add(prop);
  for (const a of [0, Math.PI]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.9, 0.04), ink); b.position.y = 0; b.rotation.z = a; prop.add(b); }
  /* gear */
  const tyre = new THREE.CylinderGeometry(0.28, 0.28, 0.16, 14).rotateZ(Math.PI / 2);
  for (const [x, z] of [[1.0, 0.8], [-1.0, 0.8], [0, 3.0]]) { add(limb(0.9, 0.04, 0.04, 6), ink, x * 0.6, 1.3, z); add(tyre, ink, x, 0.28, z); }
  return { group: g, prop };
}

export class Plane {
  /* own: a player's own plane (bought for 30,000 coins): their colour, more power and a higher top speed */
  constructor(world, own) {
    this.own = own || null; this.world = world; const p = buildPlane(own && own.c); this.group = p.group; this.prop = p.prop;
    this.pos = new THREE.Vector3(); this.q = new THREE.Quaternion(); this.v = 0; this.vy = 0; this.power = 0; this.bank = 0; this.pitch = 0; this.yaw = 0;
    this.ground = true; this.crashed = false;
  }
  place(x, z, yaw, y) { this.pos.set(x, y, z); this.yaw = yaw; this.pitch = 0; this.bank = 0; this.v = 0; this.vy = 0; this.power = 0; this.ground = true; this.crashed = false; this.sync(); }
  get x() { return this.pos.x; } get z() { return this.pos.z; } get y() { return this.pos.y; } get h() { return this.yaw; } get speed() { return this.v; }
  /* k: keys from Input (up, down, left, right, run, hand), pitchIn: -1..1 from the arrow keys */
  step(dt, k, pitchIn, touch) {
    const gy = this.world.surface(this.pos.x, this.pos.z, this.pos.y + 1).y;
    /* power: W and S on keyboards, the drift button boosts on phones */
    if (touch) this.power += ((k.hand ? 1 : 0.7) - this.power) * Math.min(1, dt * 0.8);
    else this.power = Math.max(0, Math.min(1, this.power + ((k.up ? 1 : 0) - (k.down ? 1 : 0)) * dt * 0.6));
    const turn = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    const stall = 26, top = this.own ? 84 : 64, pw = this.own ? 7.6 : 6.2;
    const thrust = this.power * pw - this.v * this.v * (pw / (top * top)) - (this.ground ? 0.5 : 0);
    this.v = Math.max(0, this.v + thrust * dt);
    if (this.ground) {
      this.bank += (0 - this.bank) * Math.min(1, dt * 5);
      this.yaw -= turn * dt * Math.min(1, this.v / 8) * 0.6;
      const lift = this.v > stall && pitchIn > 0.2;
      this.pitch += ((lift ? 0.18 : 0) - this.pitch) * Math.min(1, dt * 3);
      this.pos.y = gy; this.vy = 0;
      if (lift) { this.ground = false; this.vy = 2; }
    } else {
      this.bank += (turn * 0.75 - this.bank) * Math.min(1, dt * 2.2);
      const stallF = Math.max(0, Math.min(1, (this.v - stall * 0.7) / (stall * 0.5)));
      this.pitch += (pitchIn * 0.55 * stallF - (1 - stallF) * 0.4 - this.pitch * 0.3) * dt * 1.6;
      this.pitch = Math.max(-0.6, Math.min(0.42, this.pitch));
      this.yaw -= Math.tan(this.bank) * 9.81 / Math.max(15, this.v) * dt;
      /* climb follows the nose once you're flying; below stall it sinks */
      const targetVy = Math.sin(this.pitch) * this.v * stallF - (1 - stallF) * 9;
      this.vy += (targetVy - this.vy) * Math.min(1, dt * 1.5);
      this.v = Math.max(0, this.v - Math.sin(this.pitch) * 9.81 * dt * 0.9);
      if (this.pos.y + this.vy * dt <= gy + 0.02) {
        /* touchdown: gentle and level, or a crash */
        if (this.vy < -6.5 || Math.abs(this.bank) > 0.45 || this.world.inWater(this.pos.x, this.pos.z, gy)) { this.crashed = true; return 'crash'; }
        this.ground = true; this.pos.y = gy; this.vy = 0; this.pitch = 0;
      }
    }
    const fx = Math.sin(this.yaw) * Math.cos(this.pitch), fz = Math.cos(this.yaw) * Math.cos(this.pitch);
    this.pos.x += fx * this.v * dt; this.pos.z += fz * this.v * dt; this.pos.y += this.vy * dt;
    /* buildings */
    if (!this.ground || this.v > 6) {
      const p = { x: this.pos.x, z: this.pos.z };
      if (this.world.collide.resolve(p, 1.2, this.pos.y + 1, { x: 0, z: 0 }) > 0.2 && this.v > 8) { this.crashed = true; return 'crash'; }
      if (this.ground) { this.pos.x = p.x; this.pos.z = p.z; }
    }
    if (this.pos.y > 900) { this.pos.y = 900; this.vy = Math.min(0, this.vy); }
    this.sync(dt);
    return null;
  }
  sync(dt = 0) {
    this.group.position.copy(this.pos);
    this.group.rotation.set(-this.pitch, this.yaw, -this.bank, 'YXZ');
    this.prop.rotation.z += dt * (8 + this.power * 60);
  }
}

/* the camera behind the plane */
export class PlaneCam {
  constructor(camera) { this.cam = camera; this.pos = new THREE.Vector3(); this.init = false; }
  update(dt, p) {
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), back = 15 + p.v * 0.08, up = 4.5 + p.v * 0.02;
    const tx = p.pos.x - fx * back, tz = p.pos.z - fz * back, ty = p.pos.y + up - Math.sin(p.pitch) * back * 0.6;
    if (!this.init) { this.pos.set(tx, ty, tz); this.init = true; }
    const k = Math.min(1, dt * 3.5); this.pos.x += (tx - this.pos.x) * k; this.pos.y += (ty - this.pos.y) * k; this.pos.z += (tz - this.pos.z) * k;
    const g = p.world.surface(this.pos.x, this.pos.z, this.pos.y).y; if (this.pos.y < g + 1.5) this.pos.y = g + 1.5;
    this.cam.position.copy(this.pos);
    this.cam.up.set(Math.sin(p.bank) * Math.cos(p.yaw) * 0.3, 1, -Math.sin(p.bank) * Math.sin(p.yaw) * 0.3).normalize();
    this.cam.lookAt(p.pos.x + fx * 8, p.pos.y + 1.6, p.pos.z + fz * 8);
    const fov = 62 + Math.min(12, p.v * 0.15); if (Math.abs(this.cam.fov - fov) > 0.05) { this.cam.fov += (fov - this.cam.fov) * Math.min(1, dt * 2); this.cam.updateProjectionMatrix(); }
  }
}
