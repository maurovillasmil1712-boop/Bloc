/* Small helpers to accumulate geometry with custom attributes, then turn it into a BufferGeometry. */
import * as THREE from 'three/webgpu';

export class Kit {
  constructor(attrs) { this.attrs = attrs; this.pos = []; this.nor = []; this.uv = []; this.ext = {}; for (const [k] of attrs) this.ext[k] = []; this.idx = []; }
  get count() { return this.pos.length / 3; }
  v(x, y, z, nx, ny, nz, u, w, extra) {
    this.pos.push(x, y, z); this.nor.push(nx, ny, nz); this.uv.push(u, w);
    for (const [k, n] of this.attrs) { const a = extra[k]; for (let i = 0; i < n; i++) this.ext[k].push(a[i]); }
    return this.count - 1;
  }
  tri(a, b, c) { this.idx.push(a, b, c); }
  quad(a, b, c, d) { this.idx.push(a, b, c, a, c, d); }
  /* a flat quad from four corners with one normal; uv per corner */
  q4(p, n, uvs, extra, flip) {
    const i = this.v(p[0][0], p[0][1], p[0][2], n[0], n[1], n[2], uvs[0][0], uvs[0][1], extra);
    this.v(p[1][0], p[1][1], p[1][2], n[0], n[1], n[2], uvs[1][0], uvs[1][1], extra);
    this.v(p[2][0], p[2][1], p[2][2], n[0], n[1], n[2], uvs[2][0], uvs[2][1], extra);
    this.v(p[3][0], p[3][1], p[3][2], n[0], n[1], n[2], uvs[3][0], uvs[3][1], extra);
    if (flip) this.quad(i, i + 3, i + 2, i + 1); else this.quad(i, i + 1, i + 2, i + 3);
  }
  build() {
    if (!this.idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    for (const [k, n] of this.attrs) g.setAttribute(k, new THREE.Float32BufferAttribute(this.ext[k], n));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }
}
/* vertical wall quad from (x0,z0) to (x1,z1), bottom y0 to top y1; the outward side is to the left of the direction (normal = (-dz, dx)) */
export function wall(kit, x0, z0, x1, z1, y0, y1, extra, u0 = 0, v0 = 0) {
  const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz);
  const nx = -dz / L, nz = dx / L;
  const i = kit.v(x0, y0, z0, nx, 0, nz, u0, v0, extra);
  kit.v(x1, y0, z1, nx, 0, nz, u0 + L, v0, extra);
  kit.v(x1, y1, z1, nx, 0, nz, u0 + L, v0 + (y1 - y0), extra);
  kit.v(x0, y1, z0, nx, 0, nz, u0, v0 + (y1 - y0), extra);
  kit.quad(i, i + 1, i + 2, i + 3);
  return L;
}
export function hexRGB(h) { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map((c) => Math.pow(c, 2.2)); }
