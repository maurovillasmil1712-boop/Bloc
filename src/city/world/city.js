/* The city in the scene: builds chunks around the camera a few milliseconds at a time,
   swaps terrain resolution by distance, and keeps far chunks as cheap as possible. */
import * as THREE from 'three/webgpu';
import { indexPlan, CHUNK, buildTerrain, buildRoads, buildBuildings, buildSpecial, prepareJunctions, terrainLayers } from './build.js';
import { terrainMaterial, roadMaterial, pavingMaterial, facadeMaterial, curtainMaterial, roofMaterial, wallBlockMaterial } from '../render/materials.js';
import { LAKE, LAKE_LEVEL } from './plan.js';
import { waterMeshes } from '../render/water.js';

export class City {
  constructor(plan, scene, preset, P) {
    this.plan = plan; this.scene = scene; this.preset = preset; this.P = P;
    prepareJunctions(plan);
    this.chunks = indexPlan(plan);
    this.group = new THREE.Group(); this.group.name = 'city'; scene.add(this.group);
    this.mats = {
      terrain: terrainMaterial(terrainLayers()), road: roadMaterial(), pave: pavingMaterial(), facade: facadeMaterial(),
      glass: curtainMaterial(), roofs: roofMaterial(), blocks: wallBlockMaterial()
    };
    this.queue = []; this.built = new Map(); this.focus = new THREE.Vector3();
    this.stats = { chunks: 0, tris: 0 };
    this.waterOn = !(typeof location !== 'undefined' && /layers=(?![^&]*water)/.test(location.search));
    if (this.waterOn) for (const m of waterMeshes(plan.height)) this.group.add(m);
    if (this.waterOn) {
      const lake = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), this.group.children[0].material);
      lake.scale.set(LAKE.rx + 6, 1, LAKE.rz + 6); lake.position.set(LAKE.x, LAKE_LEVEL, LAKE.z);
      this.group.add(lake);
    }
    if (!(typeof location !== 'undefined' && /notex=1/.test(location.search))) { const sp = buildSpecial(plan); this.add(sp.pave, this.mats.pave, true, false); this.add(sp.road, this.mats.road, true, false); }
  }
  add(geo, mat, receive = true, cast = true, parent = this.group) {
    if (!geo) return null;
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = receive; m.castShadow = cast; m.matrixAutoUpdate = false; m.updateMatrix();
    parent.add(m);
    this.stats.tris += (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
    return m;
  }
  /* what each chunk should hold at this distance */
  want(c, d) {
    const far = this.P.far;
    if (d > far + CHUNK) return null;
    return { terrain: d < 900 ? this.P.terrainNear : d < 1800 ? 16 : 32, detail: d < this.P.detail + CHUNK * 0.7 };
  }
  update(camPos, budgetMs = 6) {
    this.focus.copy(camPos);
    const t0 = performance.now();
    const order = [];
    for (const c of this.chunks.values()) {
      const cx = (c.i + 0.5) * CHUNK, cz = (c.j + 0.5) * CHUNK, d = Math.hypot(cx - camPos.x, cz - camPos.z);
      order.push([d, c]);
    }
    order.sort((a, b) => a[0] - b[0]);
    for (const [d, c] of order) {
      const w = this.want(c, d), b = this.built.get(c.key);
      if (!w) { if (b) this.drop(c); continue; }
      if (!b || b.terrainRes !== w.terrain || (!b.base && performance.now() - t0 < budgetMs)) {
        if (performance.now() - t0 > budgetMs && b) continue;
        this.buildChunk(c, w, b);
        if (performance.now() - t0 > budgetMs) break;
      }
    }
  }
  buildChunk(c, w, b) {
    const L = this.layers || null;
    if (!b) { b = { group: new THREE.Group(), terrainRes: 0, base: false, terrain: null }; this.group.add(b.group); this.built.set(c.key, b); this.stats.chunks++; }
    if (b.terrainRes !== w.terrain) {
      if (b.terrain) { b.group.remove(b.terrain); b.terrain.geometry.dispose(); }
      if (!L || L.includes('terrain')) b.terrain = this.add(buildTerrain(this.plan, c, w.terrain), this.mats.terrain, true, false, b.group);
      b.terrainRes = w.terrain;
    }
    if (!b.base) {
      const r = !L || L.includes('roads') ? buildRoads(this.plan, c.edges, c.nodes) : {};
      this.add(r.road, this.mats.road, true, false, b.group);
      this.add(r.pave, this.mats.pave, true, true, b.group);
      this.add(r.bridge, this.mats.blocks, true, true, b.group);
      const bl = !L || L.includes('buildings') ? buildBuildings(this.plan, c.lots) : {};
      this.add(bl.facade, this.mats.facade, true, true, b.group);
      this.add(bl.glass, this.mats.glass, true, true, b.group);
      this.add(bl.roofs, this.mats.roofs, true, true, b.group);
      this.add(bl.blocks, this.mats.blocks, true, true, b.group);
      b.base = true;
    }
  }
  drop(c) {
    const b = this.built.get(c.key);
    if (!b) return;
    b.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.group.remove(b.group); this.built.delete(c.key); this.stats.chunks--;
  }
  /* build everything near a point before the first frame */
  warm(camPos, radius) {
    for (const c of this.chunks.values()) {
      const cx = (c.i + 0.5) * CHUNK, cz = (c.j + 0.5) * CHUNK, d = Math.hypot(cx - camPos.x, cz - camPos.z);
      if (d < radius) { const w = this.want(c, d); if (w) this.buildChunk(c, w, this.built.get(c.key)); }
    }
  }
}
