/* The sea, the port basins and the park lake: waves from layered noise, sky reflections from the
   environment map (and SSR on High and Ultra), turquoise over sand, foam where it meets the beach. */
import * as THREE from 'three/webgpu';
import { Fn, positionWorld, vec2, vec3, float, time, normalize, cross, mix, smoothstep, clamp, uniform, texture, sin, cos, dot, exp } from 'three/tsl';
import { fbm, U } from './materials.js';

export function makeWater(heightTex, map) {
  const m = new THREE.MeshPhysicalNodeMaterial({ transparent: false });
  const wp = positionWorld.xz;
  const t = time.mul(0.6);
  const wave = (p) => fbm(p.mul(0.035).add(vec2(t.mul(0.05), t.mul(0.03)))).mul(0.6).add(fbm(p.mul(0.11).sub(vec2(t.mul(0.09), t.mul(-0.04)))).mul(0.3)).add(fbm(p.mul(0.42).add(vec2(t.mul(0.21), 0))).mul(0.1));
  const e = float(0.6);
  const h0 = wave(wp), hx = wave(wp.add(vec2(e, 0))), hz = wave(wp.add(vec2(0, e)));
  const choppy = mix(float(1.4), float(3.0), U.rain);
  const n = normalize(vec3(h0.sub(hx).mul(choppy), e.mul(0.35), h0.sub(hz).mul(choppy)));
  m.normalNode = Fn(() => { void cross; return n.transformDirection ? n : n; })();
  /* depth from the terrain height map: shallow water is clear turquoise, deep water is navy */
  const uvH = wp.sub(vec2(map.x0, map.z0)).div(vec2(map.W * map.cell, map.H * map.cell));
  const ground = texture(heightTex, uvH).r;
  const depth = clamp(ground.negate(), 0, 40);
  const shallow = vec3(0.18, 0.55, 0.55), deep = vec3(0.02, 0.10, 0.17);
  const col = mix(shallow, deep, smoothstep(0, 18, depth));
  const foam = smoothstep(1.4, 0.2, depth).mul(smoothstep(0.45, 0.7, h0.add(sin(t.mul(2).add(wp.x.mul(0.15))).mul(0.15))));
  m.colorNode = mix(col.mul(mix(float(1), float(0.25), U.night)), vec3(0.85, 0.88, 0.9), foam.mul(0.8));
  m.roughnessNode = mix(float(0.03), float(0.5), foam).add(U.rain.mul(0.08));
  m.metalnessNode = float(0);
  m.transmission = 0;
  void exp; void dot; void cos; void uniform;
  return m;
}

/* the height map as a float texture, so the water shader knows how deep it is */
export function heightTexture(F) {
  const W = Math.ceil(F.W / 4), H = Math.ceil(F.H / 4), d = new Uint16Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) d[j * W + i] = THREE.DataUtils.toHalfFloat(F.data[Math.min(F.H - 1, j * 4) * F.W + Math.min(F.W - 1, i * 4)]);
  const t = new THREE.DataTexture(d, W, H, THREE.RedFormat, THREE.HalfFloatType);
  t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  return { tex: t, map: { x0: F.x0, z0: F.z0, W, H, cell: F.cell * 4 } };
}

export function waterMeshes(F) {
  const ht = heightTexture(F);
  const mat = makeWater(ht.tex, ht.map);
  const g = new THREE.PlaneGeometry(14000, 12000, 1, 1); g.rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(g, mat);
  sea.position.set(-1500, 0, 0); sea.receiveShadow = true;
  sea.frustumCulled = false;
  return [sea];
}
