/* What gameplay asks of the city: the surface under a point, ramps, collisions, water. */
import { sampleHeight, isSea, inBasin, inLake, BRIDGE, ISLAND, onIsland } from '../world/plan.js';
import { Collide } from '../world/collide.js';

export class World {
  constructor(plan) {
    this.plan = plan; this.F = plan.height; this.collide = new Collide(plan); this.wet = 0; this.h = 0;
    this.ramps = plan.ramps;
  }
  deck(x, z) {
    /* the bridge: a smooth arch from the beach to the island */
    if (Math.abs(z - BRIDGE.z) > BRIDGE.w / 2 + 3 || x > BRIDGE.x0 + 4 || x < BRIDGE.x1 - 14) return null;
    const t = (BRIDGE.x0 - x) / (BRIDGE.x0 - BRIDGE.x1), end = Math.min(t, 1 - t), s = Math.max(0, Math.min(1, end / 0.42));
    return 5.2 + (BRIDGE.top - 5.2) * s * s * (3 - 2 * s) + 0.05;
  }
  surface(x, z, yNow = 0, h = this.h) {
    let y = sampleHeight(this.F, x, z), bridge = false;
    const d = this.deck(x, z);
    if (d != null && (yNow > d - 3 || y < d - 3)) { y = d; bridge = true; }
    const occ = this.plan.occ.get(x, z), road = bridge || occ === 1 || occ === 4;
    const e = 1.5, gx = (sampleHeight(this.F, x + e, z) - sampleHeight(this.F, x - e, z)) / (2 * e), gz = (sampleHeight(this.F, x, z + e) - sampleHeight(this.F, x, z - e)) / (2 * e);
    const fx = Math.sin(h), fz = Math.cos(h), lx = Math.cos(h), lz = -Math.sin(h);
    const pitch = bridge ? 0 : -Math.atan(gx * fx + gz * fz), roll = bridge ? 0 : Math.atan(gx * lx + gz * lz) * 0.9;
    return { y, road, bridge, pitch, roll, water: !bridge && (isSea(x, z) || inBasin(x, z) || inLake(x, z)) && y < 0.4 + (inLake(x, z) ? 8 : 0) };
  }
  rampAt(x, z) {
    for (const r of this.ramps) {
      const c = Math.cos(r.dir), s = Math.sin(r.dir), dx = x - r.x, dz = z - r.z;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (Math.abs(lx) < r.w / 2 && lz > -r.len / 2 && lz < r.len / 2) return { r, h: (lz + r.len / 2) / r.len * r.h, slope: r.h / r.len, fx: s, fz: c };
    }
    return null;
  }
  inWater(x, z, y) {
    if (this.deck(x, z) != null && y > 2) return false;
    const g = sampleHeight(this.F, x, z);
    if (inLake(x, z)) return g < 7.8;
    return (isSea(x, z) || inBasin(x, z)) && g < 0.2 && !onIsland(x, z, -40);
  }
}
void ISLAND;
