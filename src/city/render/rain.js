/* Falling rain: thin streaks in a box that follows the camera, moved entirely on the GPU. */
import * as THREE from 'three/webgpu';
import { attribute, cameraPosition, time, vec3, mod, normalize } from 'three/tsl';
import { U } from './materials.js';

export function makeRain(scene, count = 6000) {
  const N = count, seed = new Float32Array(N * 12), corner = new Float32Array(N * 8), idx = new Uint32Array(N * 6);
  for (let i = 0; i < N; i++) {
    const sx = Math.random() * 80, sy = Math.random() * 36, sz = Math.random() * 80;
    for (let k = 0; k < 4; k++) { const j = i * 4 + k; seed[j * 3] = sx; seed[j * 3 + 1] = sy; seed[j * 3 + 2] = sz; corner[j * 2] = k & 1 ? 1 : -1; corner[j * 2 + 1] = k >> 1; }
    const b = i * 4; idx.set([b, b + 1, b + 2, b + 2, b + 1, b + 3], i * 6);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 12), 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seed, 3));
  g.setAttribute('corner', new THREE.BufferAttribute(corner, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false });
  const s = attribute('seed', 'vec3'), c = attribute('corner', 'vec2'), cam = cameraPosition;
  const x = mod(s.x.sub(cam.x), 80).sub(40).add(cam.x), z = mod(s.z.sub(cam.z), 80).sub(40).add(cam.z);
  const y = mod(s.y.sub(time.mul(13)), 36).add(cam.y).sub(14);
  const toCam = normalize(vec3(cam.x.sub(x), 0.001, cam.z.sub(z)));
  const right = vec3(toCam.z, 0, toCam.x.negate());
  m.positionNode = vec3(x, y, z).add(right.mul(c.x.mul(0.011))).add(vec3(0, c.y.mul(0.75), 0));
  m.colorNode = vec3(0.72, 0.78, 0.84);
  m.opacityNode = U.rain.mul(0.32);
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 10; mesh.name = 'rain';
  scene.add(mesh);
  return mesh;
}
