/* Parked cars along the kerbs of streets and avenues, instanced with two levels of detail and one paint colour each. */
import { buildCar, carMaterials } from '../actors/carmesh.js';
import { wheelsGeo } from '../actors/traffic.js';
import { along } from '../core/geom.js';
import { rng } from '../core/rng.js';
import { sampleHeight } from './plan.js';
import * as THREE from 'three/webgpu';

const KINDS = { street: 0.62, avenue: 0.5, hill: 0.35, service: 0.45, boulevard: 0.3 };
const PALETTE = ['#E9E9E6', '#1D1F24', '#8E9399', '#5A6068', '#2E4B6B', '#7A1F24', '#C8C2B4', '#33473B', '#B6B9BD', '#0F2238', '#9C6B3C', '#D9D4C7'];
const MODELS = ['hatch', 'sedan', 'suv', 'hatch', 'sedan', 'van'];

export function parkedSpots(plan) {
  const R = rng('parked'), out = MODELS.map(() => []);
  for (const e of plan.edges) {
    const p = KINDS[e.kind]; if (!p || e.bridge || e.plaza || e.len < 45 || e.w < 8.5) continue;
    for (const side of [1, -1]) {
      for (let s = 16; s < e.len - 16; s += 6.1 + R() * 0.8) {
        if (R() > p) continue;
        const a = along(e.dense, s), off = e.w / 2 - 1.15;
        const x = a.x - a.dz * side * off, z = a.z + a.dx * side * off;
        if (plan.occ.get(x, z) !== 1) continue;
        const m = Math.floor(R() * MODELS.length), col = new THREE.Color(PALETTE[Math.floor(R() * PALETTE.length)]);
        out[m].push({ x, y: sampleHeight(plan.height, x, z), z, r: Math.atan2(a.dx, a.dz) + (side > 0 ? Math.PI : 0) + (R() - 0.5) * 0.04, s: 1, c: [col.r, col.g, col.b] });
      }
    }
  }
  return out;
}
export function setupParked(inst, plan, P) {
  const M = carMaterials(), spots = parkedSpots(plan), cars = [];
  const near = Math.max(70, P.detail * 0.32), far = Math.max(160, P.detail * 0.85);
  MODELS.forEach((t, i) => {
    if (!spots[i].length || cars.some((c) => c.t === t)) { if (spots[i].length) cars.find((c) => c.t === t).items.push(...spots[i]); return; }
    cars.push({ t, items: spots[i] });
  });
  for (const c of cars) {
    const p = buildCar(c.t), wh = wheelsGeo(p);
    const full = [[p.paint, M.paint], [p.glass, M.glass], [p.trim, M.trim], [p.light, M.light], [p.tail, M.tail], [p.plate, M.plate], [wh, M.tyre]].filter(([g]) => g);
    const lite = [[p.paint, M.paint], [p.glass, M.glass], [wh, M.tyre]];
    inst.add('parked-' + c.t, [{ meshes: full, dist: near }, { meshes: lite, dist: far, noShadow: P.shadow < 2048 }], c.items, { radius: 3, cap: 900, colors: true, colorPart: 0 });
  }
  return cars.reduce((n, c) => n + c.items.length, 0);
}
