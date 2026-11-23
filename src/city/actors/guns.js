/* The four weapons, built from boxes and cylinders in code (no models, no brands). Gun space: the barrel points
   along +z, up is +y and the origin sits where the hand holds the grip. MUZZLE is the barrel tip in that space. */
import * as THREE from 'three/webgpu';

const M = new Map();
function mat(color, rough, metal) {
  const k = color + rough + metal;
  if (!M.has(k)) M.set(k, new THREE.MeshStandardNodeMaterial({ color, roughness: rough, metalness: metal }));
  return M.get(k);
}
const steel = () => mat('#18191C', 0.45, 0.4), poly = () => mat('#222428', 0.75, 0.02), wood = () => mat('#6B4A30', 0.55, 0), worn = () => mat('#33363B', 0.4, 0.45);

export const MUZZLE = { pistol: [0, 0.052, 0.17], smg: [0, 0.05, 0.34], shotgun: [0, 0.06, 0.7], rifle: [0, 0.055, 0.66] };

export function gunMesh(kind) {
  const g = new THREE.Group();
  const box = (w, h, d, m, x, y, z, rx = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.x = rx; o.castShadow = true; g.add(o); return o; };
  const tube = (r, len, m, x, y, z) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), m); o.rotation.x = Math.PI / 2; o.position.set(x, y, z + len / 2); o.castShadow = true; g.add(o); return o; };
  if (kind === 'pistol') {
    box(0.03, 0.034, 0.19, steel(), 0, 0.052, 0.07);
    box(0.026, 0.02, 0.16, poly(), 0, 0.028, 0.06);
    box(0.027, 0.105, 0.042, poly(), 0, -0.03, 0, 0.22);
    box(0.006, 0.012, 0.03, steel(), 0, 0.012, 0.035);
    box(0.012, 0.012, 0.012, worn(), 0, 0.073, 0.155);
  } else if (kind === 'smg') {
    box(0.044, 0.065, 0.26, steel(), 0, 0.045, 0.1);
    tube(0.011, 0.11, worn(), 0, 0.055, 0.23);
    box(0.03, 0.17, 0.038, poly(), 0, -0.06, 0.13, 0.12);
    box(0.03, 0.1, 0.04, poly(), 0, -0.03, -0.01, 0.25);
    box(0.012, 0.03, 0.17, steel(), 0, 0.04, -0.14);
    box(0.03, 0.06, 0.012, steel(), 0, 0.02, -0.225);
  } else if (kind === 'shotgun') {
    tube(0.014, 0.58, steel(), 0, 0.065, 0.11);
    tube(0.012, 0.42, worn(), 0, 0.035, 0.12);
    box(0.045, 0.045, 0.14, wood(), 0, 0.035, 0.36);
    box(0.045, 0.06, 0.2, steel(), 0, 0.05, 0.03);
    box(0.03, 0.09, 0.04, wood(), 0, -0.03, -0.03, 0.35);
    box(0.04, 0.07, 0.28, wood(), 0, 0.01, -0.2, -0.12);
  } else {
    box(0.046, 0.075, 0.36, poly(), 0, 0.045, 0.1);
    tube(0.01, 0.3, steel(), 0, 0.055, 0.28);
    box(0.034, 0.05, 0.22, steel(), 0, 0.05, 0.36);
    box(0.028, 0.16, 0.05, steel(), 0, -0.06, 0.13, 0.3);
    box(0.03, 0.095, 0.04, poly(), 0, -0.03, -0.01, 0.25);
    box(0.036, 0.075, 0.26, poly(), 0, 0.03, -0.2);
    tube(0.017, 0.15, steel(), 0, 0.11, 0.03);
    box(0.01, 0.03, 0.01, steel(), 0, 0.095, 0.08);
  }
  return g;
}
