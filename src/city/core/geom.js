/* 2D geometry on the ground plane (x, z). Points are [x, z] arrays. */
export function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
export function polyLen(p) { let d = 0; for (let i = 1; i < p.length; i++) d += dist(p[i - 1], p[i]); return d; }
export function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
/* closest point on segment ab to p: returns [t, distance, x, z] */
export function segClosest(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
  let t = L2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / L2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const x = ax + dx * t, z = az + dz * t;
  return [t, Math.hypot(px - x, pz - z), x, z];
}
/* proper intersection of segments p1p2 and p3p4: [t, u] or null */
export function segIntersect(p1, p2, p3, p4) {
  const d1x = p2[0] - p1[0], d1z = p2[1] - p1[1], d2x = p4[0] - p3[0], d2z = p4[1] - p3[1];
  const den = d1x * d2z - d1z * d2x;
  if (Math.abs(den) < 1e-9) return null;
  const ex = p3[0] - p1[0], ez = p3[1] - p1[1];
  const t = (ex * d2z - ez * d2x) / den, u = (ex * d1z - ez * d1x) / den;
  if (t <= 1e-6 || t >= 1 - 1e-6 || u <= 1e-6 || u >= 1 - 1e-6) return null;
  return [t, u];
}
/* Catmull-Rom through points, about one sample every `step` metres */
export function smoothPath(pts, step = 8, closed = false) {
  const out = [], n = pts.length;
  const P = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const k = Math.max(2, Math.ceil(dist(p1, p2) / step));
    for (let j = 0; j < k; j++) {
      const t = j / k, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  if (!closed) out.push(pts[n - 1].slice());
  else out.push(out[0].slice());
  return out;
}
/* resample a polyline so no piece is longer than `step` */
export function densify(pts, step) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], k = Math.max(1, Math.ceil(dist(a, b) / step));
    for (let j = 1; j <= k; j++) out.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]);
  }
  return out;
}
/* point and tangent at distance s along a polyline */
export function along(pts, s) {
  for (let i = 1; i < pts.length; i++) {
    const L = dist(pts[i - 1], pts[i]);
    if (s <= L || i === pts.length - 1) {
      const t = L > 0 ? Math.min(1, s / L) : 0, a = pts[i - 1], b = pts[i];
      const dx = (b[0] - a[0]) / (L || 1), dz = (b[1] - a[1]) / (L || 1);
      return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, dx, dz, i };
    }
    s -= L;
  }
  const a = pts[pts.length - 1];
  return { x: a[0], z: a[1], dx: 1, dz: 0, i: pts.length - 1 };
}
/* spatial hash of anything with a bounding box */
export class Grid {
  constructor(cell) { this.cell = cell; this.map = new Map(); }
  key(i, j) { return i * 65536 + j; }
  add(item, x0, z0, x1, z1) {
    const c = this.cell, i0 = Math.floor(x0 / c), i1 = Math.floor(x1 / c), j0 = Math.floor(z0 / c), j1 = Math.floor(z1 / c);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = this.key(i, j); let l = this.map.get(k); if (!l) this.map.set(k, (l = [])); l.push(item);
    }
  }
  query(x0, z0, x1, z1, out = [], seen = new Set()) {
    const c = this.cell, i0 = Math.floor(x0 / c), i1 = Math.floor(x1 / c), j0 = Math.floor(z0 / c), j1 = Math.floor(z1 / c);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const l = this.map.get(this.key(i, j)); if (!l) continue;
      for (const it of l) if (!seen.has(it)) { seen.add(it); out.push(it); }
    }
    return out;
  }
}
