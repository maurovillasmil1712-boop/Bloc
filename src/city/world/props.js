/* Street furniture from Poly Haven (CC0), loaded as compressed GLB and drawn instanced with two levels of detail. */
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { ktx2 } from '../render/textures.js';

const BASE = new URL('./', import.meta.url).href;
let loader = null;
function gltf(renderer) {
  if (!loader) { loader = new GLTFLoader(); loader.setKTX2Loader(ktx2(renderer)); loader.setMeshoptDecoder(MeshoptDecoder); }
  return loader;
}
/* flatten a glTF scene into [geometry, material] pairs with transforms baked in */
function flatten(root) {
  const out = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
    const m = o.material;
    if (m && m.map) m.map.anisotropy = 4;
    out.push([g, m]);
  });
  return out;
}
export async function loadProp(renderer, id) {
  const L = gltf(renderer);
  const [a, b] = await Promise.all([L.loadAsync(`${BASE}models/${id}.glb`), L.loadAsync(`${BASE}models/${id}.lod1.glb`)]);
  return [flatten(a.scene), flatten(b.scene)];
}
/* which plan props use which model, how far each level shows, and a bounding radius */
const USE = {
  lamp: ['lamp', 70, 260, 4], lampOld: ['lampOld', 60, 220, 4], lampHigh: ['lamp', 80, 400, 6], lampB: ['lamp', 80, 400, 5],
  bin: ['bin', 30, 90, 1.2], bench: ['bench', 30, 90, 1.5], hydrant: ['hydrant', 20, 60, 0.8], utility: ['utility', 30, 90, 1.2]
};
export async function setupProps(renderer, inst, plan, P, onProgress) {
  const byModel = new Map();
  for (const p of plan.props) {
    const u = USE[p.t]; if (!u) continue;
    if (!byModel.has(u[0])) byModel.set(u[0], { items: [], near: u[1], far: u[2], r: u[3] });
    const s = p.t === 'lampHigh' ? 1.5 : 1;
    byModel.get(u[0]).items.push({ x: p.x, y: p.y + 0.15, z: p.z, r: p.r, s });
  }
  const scale = P.detail / 420;
  let n = 0;
  for (const [id, T] of byModel) {
    try {
      const [lod0, lod1] = await loadProp(renderer, id);
      inst.add('prop-' + id, [{ meshes: lod0, dist: T.near * Math.max(0.6, scale) }, { meshes: lod1, dist: T.far * Math.max(0.5, scale) }], T.items, { radius: T.r, cap: 3000 });
    } catch (e) { console.warn('prop', id, e && e.message); }
    if (onProgress) onProgress(++n / byModel.size);
  }
}
