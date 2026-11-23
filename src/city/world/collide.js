/* What the car can hit: buildings as rotated boxes, poles and trees as circles, bridge rails as boxes.
   Stored in a 40 m grid so a query touches only a few shapes. */
import { BRIDGE } from './plan.js';

const CELL = 40;
export class Collide {
  constructor(plan) {
    this.g = new Map();
    for (const l of plan.lots) this.addBox(l.x, l.z, l.w / 2 + 0.05, l.d / 2 + 0.05, l.rot, l.y + l.h);
    const R = { lamp: 0.22, lampOld: 0.2, lampHigh: 0.3, lampB: 0.22, bin: 0.35, bench: 0.6, hydrant: 0.25, utility: 0.5, signal: 0.18 };
    for (const p of plan.props) if (R[p.t]) this.addCircle(p.x, p.z, R[p.t], p.y + 3);
    for (const t of plan.trees) this.addCircle(t.x, t.z, t.sp === 'palm' ? 0.35 : 0.45 * t.s, t.y + 6);
    for (let x = BRIDGE.x1; x < BRIDGE.x0; x += 10) for (const s of [-1, 1]) this.addBox(x + 5, BRIDGE.z + s * (BRIDGE.w / 2 + 2.6), 5.2, 0.3, 0, 40);
  }
  key(i, j) { return i * 8192 + j; }
  put(o, x0, z0, x1, z1) {
    for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) {
      const k = this.key(i, j); let l = this.g.get(k); if (!l) this.g.set(k, (l = [])); l.push(o);
    }
  }
  addBox(x, z, hw, hd, rot, top) { const r = Math.hypot(hw, hd); this.put({ b: 1, x, z, hw, hd, c: Math.cos(rot), s: Math.sin(rot), top }, x - r, z - r, x + r, z + r); }
  addCircle(x, z, r, top) { this.put({ b: 0, x, z, r, top }, x - r, z - r, x + r, z + r); }
  /* push a circle (px, pz, radius) out of everything it overlaps; returns the deepest contact normal */
  resolve(p, radius, y, out) {
    let hit = 0;
    const l = this.g.get(this.key(Math.floor(p.x / CELL), Math.floor(p.z / CELL)));
    const near = [l];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) near.push(this.g.get(this.key(Math.floor(p.x / CELL) + di, Math.floor(p.z / CELL) + dj)));
    for (const list of near) {
      if (!list) continue;
      for (const o of list) {
        if (y > o.top) continue;
        let nx, nz, pen;
        if (o.b) {
          const dx = p.x - o.x, dz = p.z - o.z, lx = dx * o.c + dz * o.s, lz = -dx * o.s + dz * o.c;
          const cx = Math.max(-o.hw, Math.min(o.hw, lx)), cz = Math.max(-o.hd, Math.min(o.hd, lz));
          let ex = lx - cx, ez = lz - cz, d = Math.hypot(ex, ez);
          if (d >= radius) continue;
          if (d < 1e-5) { const ax = o.hw - Math.abs(lx), az = o.hd - Math.abs(lz); if (ax < az) { ex = Math.sign(lx) || 1; ez = 0; d = -ax; } else { ex = 0; ez = Math.sign(lz) || 1; d = -az; } pen = radius - d; }
          else { pen = radius - d; ex /= d; ez /= d; }
          nx = ex * o.c - ez * o.s; nz = ex * o.s + ez * o.c;
        } else {
          const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz);
          if (d >= radius + o.r || d < 1e-6) continue;
          nx = dx / d; nz = dz / d; pen = radius + o.r - d;
        }
        p.x += nx * pen; p.z += nz * pen;
        if (pen > hit) { hit = pen; if (out) { out.x = nx; out.z = nz; } }
      }
    }
    return hit;
  }
}
