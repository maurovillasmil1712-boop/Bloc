/* The sky over Bloc City: the real sun and moon for Madrid at this minute, Preetham sky with clouds,
   stars at night, and an environment map rebuilt from the live sky so reflections match it. */
import * as THREE from 'three/webgpu';
import { SkyMesh } from 'three/addons/objects/SkyMesh.js';
import { Fn, positionLocal, normalize, vec3, float, fract, sin, dot, floor, step, smoothstep, uniform, max, pow, mix } from 'three/tsl';
import { U } from './materials.js';

const RAD = Math.PI / 180, LAT = 40.4168 * RAD, LNG = -3.7038 * RAD, DAY = 86400000, J1970 = 2440588, J2000 = 2451545;
const toDays = (ms) => ms / DAY - 0.5 + J1970 - J2000;
const E = RAD * 23.4397;
function eclipticDir(L, B = 0) { return { dec: Math.asin(Math.sin(B) * Math.cos(E) + Math.cos(B) * Math.sin(E) * Math.sin(L)), ra: Math.atan2(Math.sin(L) * Math.cos(E) - Math.tan(B) * Math.sin(E), Math.cos(L)) }; }
function horizontal(d, ra, dec) {
  const H = RAD * (280.16 + 360.9856235 * d) + LNG - ra;
  const alt = Math.asin(Math.sin(LAT) * Math.sin(dec) + Math.cos(LAT) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(LAT) - Math.tan(dec) * Math.cos(LAT));
  return { alt, az };
}
/* azimuth from the south, west positive; our world: north is -z, east is +x */
function toVec(alt, az, out) { return out.set(-Math.sin(az) * Math.cos(alt), Math.sin(alt), Math.cos(az) * Math.cos(alt)); }
export function sunAt(ms, out = new THREE.Vector3()) {
  const d = toDays(ms), M = RAD * (357.5291 + 0.98560028 * d);
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + RAD * 102.9372 + Math.PI, s = eclipticDir(L), h = horizontal(d, s.ra, s.dec);
  return { dir: toVec(h.alt, h.az, out), alt: h.alt };
}
export function moonAt(ms, out = new THREE.Vector3()) {
  const d = toDays(ms), L = RAD * (218.316 + 13.176396 * d), M = RAD * (134.963 + 13.064993 * d), F = RAD * (93.272 + 13.22935 * d);
  const l = L + RAD * 6.289 * Math.sin(M), b = RAD * 5.128 * Math.sin(F), s = eclipticDir(l, b), h = horizontal(d, s.ra, s.dec);
  const phase = ((d - 6.07) % 29.53 + 29.53) % 29.53 / 29.53;
  return { dir: toVec(h.alt, h.az, out), alt: h.alt, phase };
}
/* Madrid's clock, whatever the device's time zone */
export function madridNow(ms = Date.now()) { return ms; }

const starsFS = Fn(() => {
  const d = normalize(positionLocal);
  const g = floor(d.mul(220));
  const h = fract(sin(dot(g, vec3(12.9898, 78.233, 37.719))).mul(43758.5453));
  const tw = fract(sin(dot(g, vec3(3.1, 7.7, 1.3))).mul(9137.53));
  const star = step(0.9985, h).mul(smoothstep(0.02, 0.25, d.y)).mul(tw.mul(0.8).add(0.4));
  return vec3(star.mul(U.night).mul(2.4));
});

export class SkySystem {
  constructor(renderer, scene, preset) {
    this.renderer = renderer; this.scene = scene; this.preset = preset;
    this.sky = new SkyMesh();
    this.sky.scale.setScalar(4500);
    this.sky.frustumCulled = false;
    this.sky.material.depthWrite = false;
    scene.add(this.sky);
    this.stars = new THREE.Mesh(new THREE.SphereGeometry(4300, 32, 16), new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending }));
    this.stars.material.colorNode = starsFS();
    this.stars.frustumCulled = false; this.stars.renderOrder = -1;
    scene.add(this.stars);
    /* the moon: a soft disc */
    const mm = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.moonPhase = uniform(0.5);
    mm.colorNode = Fn(() => { const uvp = positionLocal.xy.mul(2); const r = uvp.length(); const lit = smoothstep(1.0, 0.92, r).mul(smoothstep(-1.0, 1.0, uvp.x.mul(this.moonPhase.sub(0.5).mul(-4)).add(0.6))); return vec3(0.9, 0.92, 1.0).mul(lit).mul(U.night.mul(1.6)); })();
    this.moon = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mm);
    this.moon.scale.setScalar(140); this.moon.frustumCulled = false;
    scene.add(this.moon);
    /* the sun light and the night light share one shadow-casting light */
    this.light = new THREE.DirectionalLight(0xffffff, 3);
    this.light.castShadow = true;
    scene.add(this.light, this.light.target);
    this.sunDir = new THREE.Vector3(); this.moonDir = new THREE.Vector3();
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene = new THREE.Scene();
    this.envSky = new SkyMesh();
    for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG', 'sunPosition', 'cloudScale', 'cloudSpeed', 'cloudCoverage', 'cloudDensity', 'cloudElevation']) this.envSky[k] = this.sky[k];
    this.envSky.material.dispose(); this.envSky.material = this.sky.material.clone();
    this.envSky.scale.setScalar(800);
    this.envScene.add(this.envSky);
    this.env = null; this.lastEnv = -1e9; this.envSun = new THREE.Vector3(9, 9, 9);
    this.mode = 'live'; this.override = null; this.weather = 0;
    this.fogColor = new THREE.Color();
    this.state = { alt: 0, night: 0 };
  }
  /* time: live Madrid time, or a fixed sunset or night like v6.1 */
  update(nowMs, camPos, weather = 0) {
    let ms = nowMs;
    if (this.override != null) ms = this.override;
    let s = sunAt(ms, this.sunDir);
    if (this.mode === 'sunset') { const t = new Date(ms); t.setUTCHours(18, 30); s = sunAt(t.getTime(), this.sunDir); this.sunDir.set(-0.85, 0.06, 0.52).normalize(); s.alt = 0.06; }
    else if (this.mode === 'night') { this.sunDir.set(0.3, -0.35, -0.88).normalize(); s.alt = -0.36; }
    const m = moonAt(ms, this.moonDir);
    const alt = s.alt, night = THREE.MathUtils.smoothstep(-alt, -0.02, 0.16);
    this.state.alt = alt; this.state.night = night; this.weather = weather;
    U.night.value = night;
    U.daylight.value = THREE.MathUtils.smoothstep(alt, -0.05, 0.35);
    U.sunDir.value.copy(this.sunDir);
    /* sky look: clearer at noon, hazier at golden hour, grey and heavy in rain */
    const golden = 1 - THREE.MathUtils.smoothstep(alt, 0.02, 0.3);
    this.sky.turbidity.value = THREE.MathUtils.lerp(2.2 + golden * 3.5, 9, weather);
    this.sky.rayleigh.value = THREE.MathUtils.lerp(1.0 + golden * 1.6, 0.5, weather);
    this.sky.mieCoefficient.value = THREE.MathUtils.lerp(0.004 + golden * 0.006, 0.02, weather);
    this.sky.mieDirectionalG.value = 0.82;
    this.sky.cloudCoverage.value = THREE.MathUtils.lerp(0.32, 0.92, weather);
    this.sky.cloudDensity.value = THREE.MathUtils.lerp(0.42, 0.85, weather);
    this.sky.cloudScale.value = 0.00022;
    this.sky.cloudSpeed.value = 0.00003;
    this.sky.cloudElevation.value = 0.55;
    const sp = this.sunDir.clone().multiplyScalar(4000);
    this.sky.sunPosition.value.copy(sp);
    this.sky.position.copy(camPos); this.stars.position.copy(camPos);
    /* the moon sits on the sky dome, facing the camera */
    this.moon.position.copy(camPos).addScaledVector(this.moonDir, 4000); this.moon.lookAt(camPos);
    this.moon.visible = night > 0.05 && this.moonDir.y > -0.05;
    this.moonPhase.value = m.phase;
    /* the shadow light follows the sun by day, the moon at night */
    const useMoon = alt < -0.04;
    const dir = useMoon ? (this.moonDir.y > 0.08 ? this.moonDir : new THREE.Vector3(0.25, 0.9, 0.35).normalize()) : this.sunDir;
    const warm = new THREE.Color().setRGB(1, THREE.MathUtils.lerp(0.95, 0.62, golden), THREE.MathUtils.lerp(0.9, 0.38, golden));
    const sunI = THREE.MathUtils.smoothstep(alt, -0.03, 0.12) * THREE.MathUtils.lerp(4.4, 0.7, weather);
    this.light.color.copy(useMoon ? new THREE.Color(0.55, 0.65, 1.0) : warm);
    this.light.intensity = useMoon ? 0.22 * (1 - weather * 0.7) : sunI;
    this.light.position.copy(camPos).addScaledVector(dir, 600);
    this.light.target.position.copy(camPos);
    this.light.target.updateMatrixWorld();
    /* fog colour: the horizon */
    const day = new THREE.Color(0.66, 0.74, 0.84), gold = new THREE.Color(0.92, 0.64, 0.45), nightC = new THREE.Color(0.035, 0.045, 0.08), grey = new THREE.Color(0.52, 0.55, 0.58);
    this.fogColor.copy(day).lerp(gold, golden * (1 - night)).lerp(nightC, night).lerp(grey.clone().multiplyScalar(1 - night * 0.85), weather * 0.75);
    /* rebuild the environment map when the sun has moved enough */
    const every = this.preset === 'low' || this.preset === 'lite' ? 30000 : this.preset === 'medium' ? 8000 : 3000;
    if (this.envSun.distanceTo(this.sunDir) > 0.01 || performance.now() - this.lastEnv > every * 10) {
      if (performance.now() - this.lastEnv > every || !this.env) this.rebuildEnv();
    }
  }
  rebuildEnv() {
    if (typeof location !== 'undefined' && /nopmrem=1/.test(location.search)) { this.lastEnv = performance.now(); this.env = this.env || {}; return; }
    this.lastEnv = performance.now(); this.envSun.copy(this.sunDir);
    this.sky.showSunDisc.value = 0;
    const rt = this.pmrem.fromScene(this.envScene, 0, 1, 2000);
    this.sky.showSunDisc.value = 1;
    if (this.env) this.env.dispose();
    this.env = rt;
    this.scene.environment = rt.texture;
    const night = this.state.night;
    this.scene.environmentIntensity = THREE.MathUtils.lerp(0.17, 0.09, night) * THREE.MathUtils.lerp(1, 1.6, this.weather);
  }
}
void float; void max; void pow; void mix;
