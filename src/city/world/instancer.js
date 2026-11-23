/* Draws thousands of repeated things (trees, lamps, benches, parked cars) with one instanced mesh per
   type and level of detail. Every few frames it picks what's in view and near enough, closest first. */
import * as THREE from 'three/webgpu';

const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const frustum = new THREE.Frustum(), proj = new THREE.Matrix4(), sphere = new THREE.Sphere();

export class Instancer {
  constructor(scene) { this.scene = scene; this.types = []; this.group = new THREE.Group(); this.group.name = 'instances'; scene.add(this.group); this.frame = 0; this.last = new THREE.Vector3(1e9, 0, 0); }
  /* lods: [{ meshes: [[geometry, material], ...], dist }], items: [{x, y, z, r, s}] */
  add(id, lods, items, opts = {}) {
    const cell = opts.cell || 64, grid = new Map();
    for (const it of items) { const k = Math.floor(it.x / cell) * 4096 + Math.floor(it.z / cell); let l = grid.get(k); if (!l) grid.set(k, (l = [])); l.push(it); }
    const T = { id, lods: [], grid, cell, radius: opts.radius || 6, cap: opts.cap || 2000, maxDist: lods[lods.length - 1].dist, cast: opts.cast !== false };
    for (const L of lods) {
      const parts = L.meshes.map(([g, m], pi) => {
        const im = new THREE.InstancedMesh(g, m, T.cap);
        im.userData.colored = opts.colors && (opts.colorPart == null || opts.colorPart === pi);
        im.count = 0; im.castShadow = T.cast && !L.noShadow; im.receiveShadow = true; im.frustumCulled = false;
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        if (im.userData.colored) { im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(T.cap * 3).fill(1), 3); im.instanceColor.setUsage(THREE.DynamicDrawUsage); }
        this.group.add(im); return im;
      });
      T.lods.push({ dist: L.dist, parts, d2: L.dist * L.dist });
    }
    T.colors = !!opts.colors;
    this.types.push(T);
    return T;
  }
  update(camera, force = false) {
    this.frame++;
    if (!force && this.frame % 4 && camera.position.distanceToSquared(this.last) < 9) return;
    this.last.copy(camera.position);
    proj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(proj);
    const cx = camera.position.x, cz = camera.position.z;
    for (const T of this.types) {
      const counts = T.lods.map(() => 0);
      const R = T.maxDist, c = T.cell;
      const i0 = Math.floor((cx - R) / c), i1 = Math.floor((cx + R) / c), j0 = Math.floor((cz - R) / c), j1 = Math.floor((cz + R) / c);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const l = T.grid.get(i * 4096 + j); if (!l) continue;
        for (const it of l) {
          const dx = it.x - cx, dz = it.z - cz, d2 = dx * dx + dz * dz;
          if (d2 > T.lods[T.lods.length - 1].d2) continue;
          sphere.center.set(it.x, it.y + T.radius * it.s * 0.5, it.z); sphere.radius = T.radius * it.s;
          if (!frustum.intersectsSphere(sphere)) continue;
          let li = 0; while (li < T.lods.length - 1 && d2 > T.lods[li].d2) li++;
          const L = T.lods[li], n = counts[li];
          if (n >= T.cap) continue;
          Q.setFromAxisAngle(UP, it.r); S.setScalar(it.s); P.set(it.x, it.y, it.z);
          M.compose(P, Q, S);
          for (const im of L.parts) { im.setMatrixAt(n, M); if (im.userData.colored && it.c) im.instanceColor.setXYZ(n, it.c[0], it.c[1], it.c[2]); }
          counts[li] = n + 1;
        }
      }
      T.lods.forEach((L, li) => { for (const im of L.parts) { im.count = counts[li]; im.instanceMatrix.needsUpdate = true; if (im.userData.colored) im.instanceColor.needsUpdate = true; } });
    }
  }
  stats() { let n = 0; for (const T of this.types) for (const L of T.lods) n += L.parts[0] ? L.parts[0].count : 0; return n; }
}
