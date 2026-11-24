/* Cameras. In a car: close chase, far chase, bonnet, cockpit (stage 4 adds the interior).
   The chase camera trails on a spring, leans into turns, looks where you steer and widens with speed. */
import * as THREE from 'three/webgpu';

const V = new THREE.Vector3(), T = new THREE.Vector3();
export const CAR_VIEWS = ['near', 'far', 'bonnet', 'cockpit'];
export class ChaseCam {
  constructor(camera) {
    this.cam = camera; this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.look = new THREE.Vector3();
    this.mode = localStorage.getItem('bloc:city:view'); if (CAR_VIEWS.indexOf(this.mode) < 0) this.mode = 'near'; this.shake = 0; this.lean = 0; this.fov = 62; this.yaw = 0; this.init = false;
    this.orbit = { yaw: 0, pitch: 0, t: 0 };
  }
  /* mouse look around the car (pointer locked): it springs back behind the car a second after you stop */
  mouse(dx, dy) { this.orbit.yaw = Math.max(-Math.PI, Math.min(Math.PI, this.orbit.yaw - dx)); this.orbit.pitch = Math.max(-0.12, Math.min(0.45, this.orbit.pitch + dy)); this.orbit.t = 1.1; }
  next() { this.mode = CAR_VIEWS[(CAR_VIEWS.indexOf(this.mode) + 1) % CAR_VIEWS.length]; try { localStorage.setItem('bloc:city:view', this.mode); } catch (e) { /* private mode */ } this.init = false; return this.mode; }
  update(dt, car, ground) {
    const sp = car.speed, fwd = car.vf || 0;
    const fx = Math.sin(car.h), fz = Math.cos(car.h);
    /* chase direction: the heading, pulled toward the direction of travel when sliding */
    const vDir = sp > 3 ? Math.atan2(car.vx, car.vz) : car.h;
    let diff = vDir - car.h; while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
    const want = car.h + (fwd < -1 ? 0 : diff * 0.15);
    let dy = want - this.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * Math.min(1, dt * (this.mode === 'far' ? 3.2 : 4.2));
    if (this.orbit.t > 0) this.orbit.t -= dt; else { this.orbit.yaw *= Math.exp(-dt * 2.5); this.orbit.pitch *= Math.exp(-dt * 2.5); }
    const yaw = this.yaw + this.orbit.yaw;
    const cfx = Math.sin(yaw), cfz = Math.cos(yaw);
    const L = car.T ? car.T.L : 4.2, H = car.T ? car.T.H : 1.45;
    if (this.mode === 'near' || this.mode === 'far') {
      const far = this.mode === 'far';
      const back = (far ? 7.2 : 4.4) + L * 0.5 + sp * (far ? 0.045 : 0.025), up = (far ? 2.6 : 1.45) + H * 0.45 + sp * 0.006 + this.orbit.pitch * 6;
      T.set(car.x - cfx * back, car.y + up, car.z - cfz * back);
      const gy = ground(T.x, T.z) + 0.8; if (T.y < gy) T.y = gy;
      if (!this.init) { this.pos.copy(T); this.vel.set(0, 0, 0); this.init = true; }
      /* critically damped spring */
      const k = far ? 36 : 64, c = 2 * Math.sqrt(k);
      this.vel.x += ((T.x - this.pos.x) * k - this.vel.x * c) * dt; this.vel.y += ((T.y - this.pos.y) * k - this.vel.y * c) * dt; this.vel.z += ((T.z - this.pos.z) * k - this.vel.z * c) * dt;
      this.pos.addScaledVector(this.vel, dt);
      this.cam.position.copy(this.pos);
      const ahead = 4 + sp * 0.15, side = (car.steer || 0) * -sp * 0.06;
      this.look.set(car.x + fx * ahead + Math.cos(car.h) * side, car.y + H * 0.6, car.z + fz * ahead - Math.sin(car.h) * side);
      this.cam.up.set(0, 1, 0);
      this.cam.lookAt(this.look);
      this.lean += ((car.steer || 0) * Math.min(1, sp / 25) * 0.035 - this.lean) * Math.min(1, dt * 3);
      this.cam.rotateZ(this.lean);
    } else {
      /* bonnet and cockpit sit on the car and move with its body */
      const seat = this.mode === 'bonnet' ? [0, H * 0.82, L * 0.18] : [0.36, H * 0.78, -0.05];
      const m = car.body.matrixWorld; car.group.updateMatrixWorld(true);
      this.cam.position.set(seat[0], seat[1], seat[2]).applyMatrix4(m);
      V.set(seat[0], seat[1] - 0.05, seat[2] + 20).applyMatrix4(m);
      this.cam.up.set(0, 1, 0).applyQuaternion(car.body.getWorldQuaternion(new THREE.Quaternion()));
      this.cam.lookAt(V);
      this.init = false;
    }
    if (this.shake > 0) { this.cam.position.x += (Math.random() - 0.5) * this.shake; this.cam.position.y += (Math.random() - 0.5) * this.shake * 0.6; this.shake = Math.max(0, this.shake - dt * 1.8); }
    const fov = (this.mode === 'cockpit' ? 70 : 58) + Math.min(10, sp * 0.2);
    if (Math.abs(this.cam.fov - fov) > 0.05) { this.cam.fov += (fov - this.cam.fov) * Math.min(1, dt * 2.5); this.cam.updateProjectionMatrix(); }
  }
}
