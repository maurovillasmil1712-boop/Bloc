/* A reflection probe that follows your car (High and Ultra): a small cube camera captures the street around you
   a few times a second, and your car's paint and glass reflect it, so buildings, lights and other cars show in the
   bodywork from any angle, not only what's on screen. The car itself is hidden while the probe looks around. */
import * as THREE from 'three/webgpu';

export class Probe {
  constructor(renderer, scene, preset) {
    this.on = preset === 'high' || preset === 'ultra';
    if (!this.on) return;
    this.r = renderer; this.scene = scene;
    this.rt = new THREE.CubeRenderTarget(preset === 'ultra' ? 256 : 128, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    this.cam = new THREE.CubeCamera(0.6, preset === 'ultra' ? 500 : 300, this.rt);
    this.t = 0; this.every = preset === 'ultra' ? 0.25 : 0.5; this.bound = null;
  }
  /* point the player's car materials at the probe */
  bind(car) {
    if (!this.on || this.bound === car) return;
    this.bound = car;
    for (const m of [car.paint, car.glassMesh && car.glassMesh.material].filter(Boolean)) {
      if (m === car.paint) { m.envMap = this.rt.texture; m.envMapIntensity = 0.8; m.needsUpdate = true; }
    }
  }
  update(dt, car, active) {
    if (!this.on || !car) return;
    this.bind(car);
    this.t -= dt; if (this.t > 0 || !active) return;
    this.t = this.every;
    const hide = [car.group]; for (const o of hide) o.visible = false;
    this.cam.position.set(car.x, car.y + 1.1, car.z);
    try { this.cam.update(this.r, this.scene); } catch (e) { this.on = false; console.warn('probe', e); }
    for (const o of hide) o.visible = true;
  }
}
