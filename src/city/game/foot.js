/* On foot: walking, running and jumping around the city, and the three cameras that follow you
   (behind, over the shoulder, first person). Drag with the mouse or a finger to look around. */
import * as THREE from 'three/webgpu';
import { Human } from '../actors/human.js';

export const FOOT_VIEWS = ['foot', 'shoulder', 'first'];
const G = 18, WALK = 1.75, RUN = 5.7, JUMP = 5.2;

export class OnFoot {
  constructor(world, look) {
    this.world = world; this.human = new Human(look);
    this.x = 0; this.z = 0; this.y = 0; this.vx = 0; this.vz = 0; this.vy = 0; this.a = 0; this.air = false; this.turn = 0;
    this.speed = 0; this.holdUp = 0; this.safe = null; this.indoor = null;
  }
  get group() { return this.human.group; }
  place(x, z, a, y) {
    this.x = x; this.z = z; this.a = a || 0; this.y = y != null ? y : this.world.surface(x, z, 50).y; this.vx = this.vz = this.vy = 0; this.air = false; this.sync();
  }
  /* inp: keys from Input, camYaw: where the camera looks, obstacles: extra circles {x, z, r} (cars) */
  step(dt, k, camYaw, obstacles, touch) {
    const fwd = (k.up ? 1 : 0) - (k.down ? 1 : 0), side = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    this.holdUp = k.up ? this.holdUp + dt : 0;
    let mx = 0, mz = 0;
    if (touch) {
      /* phones: left and right turn, up walks (and runs after a moment), down steps back */
      if (side) this.a -= side * dt * 2.4;
      if (fwd) { mx = Math.sin(this.a) * fwd; mz = Math.cos(this.a) * fwd; }
    } else if (fwd || side) {
      const fx = Math.sin(camYaw), fz = Math.cos(camYaw), rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
      mx = fx * fwd + rx * side; mz = fz * fwd + rz * side;
      const l = Math.hypot(mx, mz); mx /= l; mz /= l;
    }
    const running = (k.run || (touch && this.holdUp > 0.8)) && (mx || mz);
    const want = this.indoor ? Math.min(running ? 3.6 : WALK, 3.6) : running ? RUN : WALK;
    const accel = this.air ? 2.5 : 11;
    this.vx += (mx * want - this.vx) * Math.min(1, dt * accel); this.vz += (mz * want - this.vz) * Math.min(1, dt * accel);
    const sp = Math.hypot(this.vx, this.vz);
    if (sp > 0.25 && (mx || mz)) {
      const target = Math.atan2(this.vx, this.vz); let d = target - this.a;
      while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      const turn = Math.max(-1, Math.min(1, d * 6)) * dt * 10;
      this.a += Math.abs(turn) > Math.abs(d) ? d : turn; this.turn += (Math.max(-1, Math.min(1, d * 2)) - this.turn) * Math.min(1, dt * 6);
    } else this.turn *= Math.exp(-dt * 6);
    if (k.hand && !this.air && !this.jumpHeld) { this.vy = JUMP; this.air = true; this.jumpHeld = true; }
    if (!k.hand) this.jumpHeld = false;
    let nx = this.x + this.vx * dt, nz = this.z + this.vz * dt;
    /* walls, trees, props; cars as circles */
    const p = { x: nx, z: nz }, n = { x: 0, z: 0 };
    if (this.indoor) this.indoor.collide(p);
    else {
      this.world.collide.resolve(p, 0.32, this.y + 0.9, n);
      for (const o of obstacles) { const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), r = o.r + 0.32; if (d < r && d > 1e-4) { p.x = o.x + dx / d * r; p.z = o.z + dz / d * r; } }
    }
    nx = p.x; nz = p.z;
    const ground = this.indoor ? this.indoor.floorY : this.world.surface(nx, nz, this.y + 0.5).y;
    if (!this.air && ground > this.y + 0.55) { nx = this.x; nz = this.z; this.vx *= 0.2; this.vz *= 0.2; }
    this.x = nx; this.z = nz;
    this.vy -= G * dt; this.y += this.vy * dt;
    const gy = this.indoor ? this.indoor.floorY : this.world.surface(this.x, this.z, this.y + 0.5).y;
    if (this.y <= gy) { this.y = gy; this.vy = 0; this.air = false; }
    else if (!this.air && this.y - gy < 0.4) { this.y = gy; this.vy = 0; } /* stick to stairs and kerbs */
    else this.air = true;
    if (!this.indoor && !this.air) {
      if (this.world.inWater(this.x, this.z, this.y)) return 'water';
      if (!this.safeT || performance.now() - this.safeT > 500) { this.safe = { x: this.x, z: this.z, a: this.a }; this.safeT = performance.now(); }
    }
    this.speed = Math.hypot(this.vx, this.vz);
    return null;
  }
  sync(dt = 0) {
    this.human.group.position.set(this.x, this.y, this.z);
    this.human.group.rotation.y = this.a;
    this.human.animate(dt, { speed: this.speed, air: this.air, turn: this.turn, guard: this.guard });
  }
}

/* the camera on foot: a yaw/pitch orbit you drag, with walls pulling it in */
export class FootCam {
  constructor(camera, root) {
    this.cam = camera; this.yaw = 0; this.pitch = 0.12; this.dist = 3.3; this.lastLook = -10;
    this.mode = localStorage.getItem('bloc:city:footview'); if (FOOT_VIEWS.indexOf(this.mode) < 0) this.mode = 'foot';
    this.pos = new THREE.Vector3(); this.init = false; this.active = false;
    let drag = null;
    root.addEventListener('pointerdown', (e) => {
      if (!this.active || e.target.closest('button, [data-in], .bc-sheet, .bc-map')) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 };
    });
    window.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id || this.locked) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
      this.yaw -= dx * 0.006; this.pitch = Math.max(-0.5, Math.min(1.1, this.pitch + dy * 0.004)); this.lastLook = performance.now() / 1000;
    });
    /* v7.9: on a computer the mouse is locked to the game (click to start, Esc to free it), like any shooter:
       moving it turns the camera, and the player's head follows */
    window.addEventListener('mousemove', (e) => {
      if (!this.active || !this.locked) return;
      const s = this.sens || 1;
      this.yaw -= e.movementX * 0.0024 * s; this.pitch = Math.max(-0.75, Math.min(1.15, this.pitch + e.movementY * 0.002 * s)); this.lastLook = performance.now() / 1000;
    });
    const up = (e) => { if (drag && e.pointerId === drag.id) { this.clicked = drag.moved < 6; drag = null; } };
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  }
  next() { this.mode = FOOT_VIEWS[(FOOT_VIEWS.indexOf(this.mode) + 1) % FOOT_VIEWS.length]; try { localStorage.setItem('bloc:city:footview', this.mode); } catch (e) { /* ignore */ } return this.mode; }
  update(dt, f, blocked) {
    const h = f.human, now = performance.now() / 1000;
    /* drift back behind you while walking, unless you looked around a moment ago */
    const aim = this.aim || 0;
    if (!this.locked && f.speed > 0.5 && now - this.lastLook > 1.6 && this.mode !== 'first' && aim < 0.1) {
      let d = f.a - this.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      this.yaw += d * Math.min(1, dt * 1.6);
    }
    if (!this.init) { this.yaw = f.a; this.init = true; }
    const head = (this._head || (this._head = new THREE.Vector3())).set(f.x, f.y + 1.62, f.z);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    h.head.visible = this.mode !== 'first';
    if (this.mode === 'first') {
      this.cam.position.set(f.x + Math.sin(f.a) * 0.12, f.y + 1.66 + (h.hips.position.y - 0.94) * 0.6, f.z + Math.cos(f.a) * 0.12);
      if (f.speed > 0.3 || now - this.lastLook > 0.1) { /* look where you walk unless dragging */ }
      /* mouse locked: you face where you look; otherwise the view follows your walk unless you just dragged */
      if (this.locked) { f.a = this.yaw; h.group.rotation.y = f.a; }
      const yaw = this.locked || now - this.lastLook < 1.2 ? this.yaw : (this.yaw = f.a);
      this.cam.lookAt(this.cam.position.x + Math.sin(yaw) * Math.cos(this.pitch - 0.1), this.cam.position.y - Math.sin(this.pitch - 0.1), this.cam.position.z + Math.cos(yaw) * Math.cos(this.pitch - 0.1));
      this.setFov(dt, 72);
      return;
    }
    const shoulder = this.mode === 'shoulder';
    /* the head turns toward where the camera looks (up to about 70° each way) */
    let hd = this.yaw - f.a; while (hd > Math.PI) hd -= Math.PI * 2; while (hd < -Math.PI) hd += Math.PI * 2;
    if (Math.abs(hd) < 2.4) { h.head.rotation.y = Math.max(-1.2, Math.min(1.2, hd)) * 0.75; h.neck.rotation.y += Math.max(-1.2, Math.min(1.2, hd)) * 0.25; h.head.rotation.x = Math.max(-0.4, Math.min(0.5, this.pitch - 0.12)) * 0.6; }
    /* aiming: in tight over the right shoulder, narrower view */
    let dist = (shoulder ? 1.7 : this.dist + Math.min(1.2, f.speed * 0.12)) * (1 - aim) + 1.35 * aim;
    /* with a weapon out the camera sits over the right shoulder, so the gun hand is in view */
    const side = this.armed ? -0.55 * (1 - aim) - 0.62 * aim : (shoulder ? 0.55 : 0) * (1 - aim) - 0.62 * aim;
    const rx = -Math.cos(this.yaw), rz = Math.sin(this.yaw);
    /* pull in when a wall is between you and the camera */
    for (let t = 0.6; t <= dist; t += 0.3) {
      const px = head.x - fx * t * Math.cos(this.pitch) - rx * side, pz = head.z - fz * t * Math.cos(this.pitch) - rz * side;
      if (blocked(px, pz, head.y + Math.sin(this.pitch) * t)) { dist = Math.max(0.6, t - 0.35); break; }
    }
    const tx = head.x - fx * dist * Math.cos(this.pitch) - rx * side, tz = head.z - fz * dist * Math.cos(this.pitch) - rz * side, ty = head.y + 0.1 + Math.sin(this.pitch) * dist;
    if (!this.placed) { this.pos.set(tx, ty, tz); this.placed = true; }
    const k = Math.min(1, dt * 14);
    this.pos.x += (tx - this.pos.x) * k; this.pos.y += (ty - this.pos.y) * k; this.pos.z += (tz - this.pos.z) * k;
    this.cam.position.copy(this.pos);
    this.cam.lookAt(head.x - rx * side * 0.9 + fx * 2, head.y - 0.05 + (shoulder ? 0.02 : 0) - Math.sin(this.pitch) * 0.6, head.z - rz * side * 0.9 + fz * 2);
    this.setFov(dt, (shoulder ? 62 : 58 + Math.min(6, f.speed)) * (1 - aim) + 50 * aim);
  }
  setFov(dt, fov) { if (Math.abs(this.cam.fov - fov) > 0.05) { this.cam.fov += (fov - this.cam.fov) * Math.min(1, dt * 5); this.cam.updateProjectionMatrix(); } }
}
