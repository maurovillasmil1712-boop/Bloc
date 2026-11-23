/* Trees grown in code: plane trees for the streets, round broadleaf trees for parks and lawns,
   umbrella-shaped stone pines for the hills, palms by the sea. Bark and leaves are CC0 scans.
   Each species has three variants, a full mesh, a light mesh, and a flat impostor for far away. */
import * as THREE from 'three/webgpu';
import { attribute, texture, uv, vec2, vec3, float, positionLocal, time, sin, cos, normalMap, mix, smoothstep, clamp, positionWorld, cameraPosition, length, select, normalLocal } from 'three/tsl';
import { rng } from '../core/rng.js';
import { SETS, track, layerOf } from '../render/textures.js';
import { U } from '../render/materials.js';

const SP = {
  plane: { bark: 'bark_platanus', leaf: 0, h: [13, 17], trunk: 0.42, r0: 0.34, crown: [5.5, 7], branches: 7, sub: 5, cards: 150, card: 1.3, lean: 0.06 },
  oak: { bark: 'bark_platanus', leaf: 1, h: [8, 11], trunk: 0.35, r0: 0.3, crown: [4, 5.5], branches: 6, sub: 5, cards: 140, card: 1.1, lean: 0.08 },
  pine: { bark: 'pine_bark', leaf: 2, h: [11, 15], trunk: 0.62, r0: 0.3, crown: [5, 7], branches: 8, sub: 4, cards: 170, card: 1.5, lean: 0.12, umbrella: true },
  palm: { bark: 'palm_tree_bark', leaf: 3, h: [8, 12], trunk: 1, r0: 0.26, crown: [3.5, 4.5], fronds: 16, card: 4.6, lean: 0.16, palm: true }
};

function tube(B, path, radii, seg, layer, v0 = 0) {
  /* rings along a path, uv: u around the trunk, v up the bark in metres */
  const base = B.pos.length / 3;
  let v = v0;
  for (let i = 0; i < path.length; i++) {
    const p = path[i], q = path[Math.min(path.length - 1, i + 1)], o = path[Math.max(0, i - 1)];
    const t = new THREE.Vector3(q.x - o.x, q.y - o.y, q.z - o.z).normalize();
    const a = Math.abs(t.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const n1 = new THREE.Vector3().crossVectors(t, a).normalize(), n2 = new THREE.Vector3().crossVectors(t, n1).normalize();
    if (i > 0) v += path[i].distanceTo(path[i - 1]);
    for (let k = 0; k <= seg; k++) {
      const ang = (k / seg) * Math.PI * 2, c = Math.cos(ang), s = Math.sin(ang), r = radii[i];
      const nx = n1.x * c + n2.x * s, ny = n1.y * c + n2.y * s, nz = n1.z * c + n2.z * s;
      B.pos.push(p.x + nx * r, p.y + ny * r, p.z + nz * r); B.nor.push(nx, ny, nz); B.uv.push(k / seg * Math.max(1, Math.round(r * 6)), v * 0.8); B.lay.push(layer);
    }
  }
  for (let i = 0; i < path.length - 1; i++) for (let k = 0; k < seg; k++) {
    const a = base + i * (seg + 1) + k, b = a + seg + 1;
    B.idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
}
function card(L, c, size, dirOut, R, tilt = 0.6, layer) {
  /* a leaf card centred at c, facing roughly outward; normals point away from the crown centre */
  const up = new THREE.Vector3(R() - 0.5, 1.2, R() - 0.5).normalize();
  const side = new THREE.Vector3().crossVectors(up, dirOut).normalize();
  if (side.lengthSq() < 0.01) side.set(1, 0, 0);
  const rot = (R() - 0.5) * Math.PI * tilt;
  const s2 = side.clone().applyAxisAngle(dirOut, rot), u2 = up.clone().applyAxisAngle(dirOut, rot);
  const w = size * 0.5, h = size * 0.5, base = L.pos.length / 3;
  const corners = [[-w, -h, 0, 1], [w, -h, 1, 1], [w, h, 1, 0], [-w, h, 0, 0]];
  for (const [a, b, u, v] of corners) {
    const p = c.clone().addScaledVector(s2, a).addScaledVector(u2, b);
    const n = dirOut.clone().multiplyScalar(0.8).add(new THREE.Vector3(0, 0.45, 0)).normalize();
    L.pos.push(p.x, p.y, p.z); L.nor.push(n.x, n.y, n.z); L.uv.push(u, v); L.lay.push(layer); L.wind.push(Math.max(0, p.y));
  }
  L.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}
function geo(B, extra) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(B.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(B.nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(B.uv, 2));
  g.setAttribute('lay', new THREE.Float32BufferAttribute(B.lay, 1));
  if (extra) g.setAttribute('wind', new THREE.Float32BufferAttribute(B.wind, 1));
  g.setIndex(B.idx); g.computeBoundingSphere();
  return g;
}
export function growTree(kind, seed, lite) {
  const S = SP[kind], R = rng('tree:' + kind + ':' + seed);
  const bark = { pos: [], nor: [], uv: [], lay: [], idx: [] }, leaf = { pos: [], nor: [], uv: [], lay: [], idx: [], wind: [] };
  const bl = layerOf('bark', S.bark), H = S.h[0] + R() * (S.h[1] - S.h[0]);
  const lean = new THREE.Vector3((R() - 0.5) * S.lean, 1, (R() - 0.5) * S.lean).normalize();
  const trunkH = S.palm ? H : H * S.trunk, seg = lite ? 5 : 8;
  const path = [], radii = [];
  const steps = S.palm ? 10 : 6;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, bend = S.palm ? Math.sin(t * Math.PI * 0.7) * H * S.lean * 1.6 : Math.sin(t * 3 + seed) * 0.25;
    path.push(new THREE.Vector3(lean.x * trunkH * t + bend, trunkH * t, lean.z * trunkH * t + bend * 0.4));
    radii.push(S.r0 * (S.palm ? 1.15 - 0.3 * t : 1.25 - 0.55 * t) * (i === 0 ? 1.35 : 1));
  }
  tube(bark, path, radii, seg, bl);
  const top = path[path.length - 1];
  if (S.palm) {
    /* fronds: long bent cards around the top */
    const n = lite ? 9 : S.fronds;
    for (let f = 0; f < n; f++) {
      const az = (f / n) * Math.PI * 2 + R() * 0.3, el = 0.25 + R() * 0.5;
      const dir = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
      const len = S.card * (0.8 + R() * 0.35), base = leaf.pos.length / 3, w = len * 0.42;
      const side = new THREE.Vector3(-Math.sin(az), 0, Math.cos(az));
      for (let k = 0; k <= 3; k++) {
        const t = k / 3, droop = -t * t * len * 0.75;
        const c = top.clone().addScaledVector(dir, t * len).add(new THREE.Vector3(0, droop, 0));
        const nrm = new THREE.Vector3(0, 1, 0).addScaledVector(dir, 0.3).normalize();
        for (const s of [-1, 1]) { const p = c.clone().addScaledVector(side, s * w * 0.5); leaf.pos.push(p.x, p.y, p.z); leaf.nor.push(nrm.x, nrm.y, nrm.z); leaf.uv.push(s < 0 ? 0 : 1, 1 - t); leaf.lay.push(S.leaf); leaf.wind.push(t * 3); }
      }
      for (let k = 0; k < 3; k++) { const a = base + k * 2; leaf.idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    }
    return { bark: geo(bark), leaf: geo(leaf, true), h: H + 1, r: S.card };
  }
  /* branches: primaries from the upper trunk, secondaries along them, leaf cards at the ends */
  const crownR = S.crown[0] + R() * (S.crown[1] - S.crown[0]);
  const centre = top.clone().add(new THREE.Vector3(0, S.umbrella ? crownR * 0.15 : crownR * 0.55, 0));
  const nb = lite ? Math.ceil(S.branches * 0.6) : S.branches;
  const cards = lite ? Math.round(S.cards * 0.28) : S.cards;
  const tips = [];
  for (let b = 0; b < nb; b++) {
    const az = (b / nb) * Math.PI * 2 + R() * 0.6;
    const el = S.umbrella ? 0.35 + R() * 0.25 : 0.55 + R() * 0.55;
    const start = path[Math.max(2, steps - 1 - Math.floor(R() * 2))].clone();
    const dir = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
    const len = crownR * (S.umbrella ? 1.0 : 0.85) * (0.75 + R() * 0.4);
    const bp = [], br = [];
    for (let i = 0; i <= 4; i++) { const t = i / 4; bp.push(start.clone().addScaledVector(dir, len * t).add(new THREE.Vector3(0, -t * t * len * (S.umbrella ? 0.05 : 0.15), 0))); br.push(S.r0 * 0.55 * (1 - t * 0.8)); }
    tube(bark, bp, br, lite ? 4 : 6, bl);
    for (let k = 0; k < (lite ? 2 : S.sub); k++) {
      const t = 0.45 + 0.55 * (k / Math.max(1, S.sub - 1)), sp = bp[Math.min(4, Math.round(t * 4))];
      const d2 = dir.clone().add(new THREE.Vector3(R() - 0.5, R() * 0.6 - 0.1, R() - 0.5)).normalize();
      const l2 = len * 0.45 * (0.7 + R() * 0.5), e = sp.clone().addScaledVector(d2, l2);
      if (!lite) tube(bark, [sp, e], [S.r0 * 0.22, S.r0 * 0.06], 4, bl);
      tips.push(e);
    }
    tips.push(bp[4]);
  }
  /* leaf cards fill an ellipsoid crown, denser near the branch tips */
  for (let c = 0; c < cards; c++) {
    let p;
    if (R() < 0.6 && tips.length) { const tp = tips[Math.floor(R() * tips.length)]; p = tp.clone().add(new THREE.Vector3((R() - 0.5) * 2.4, (R() - 0.5) * 1.6, (R() - 0.5) * 2.4)); }
    else {
      const a = R() * Math.PI * 2, u = R() * 2 - 1, rr = Math.cbrt(R());
      p = centre.clone().add(new THREE.Vector3(Math.cos(a) * Math.sqrt(1 - u * u) * crownR * rr, u * crownR * (S.umbrella ? 0.32 : 0.62) * rr, Math.sin(a) * Math.sqrt(1 - u * u) * crownR * rr));
    }
    const out = p.clone().sub(centre); if (S.umbrella) out.y *= 2.5; out.normalize();
    card(leaf, p, S.card * (lite ? 1.7 : 1) * (0.8 + R() * 0.45), out, R, S.umbrella ? 0.3 : 0.8, S.leaf);
  }
  return { bark: geo(bark), leaf: geo(leaf, true), h: centre.y + crownR, r: crownR + 1 };
}

let mats = null;
export function treeMaterials() {
  if (mats) return mats;
  const barkM = new THREE.MeshStandardNodeMaterial();
  const lay = attribute('lay', 'float');
  const tb = texture(SETS.bark.c, uv()); track('bark', 'c', tb);
  const tn = texture(SETS.bark.n, uv()); track('bark', 'n', tn);
  const tm = texture(SETS.bark.m, uv()); track('bark', 'm', tm);
  barkM.colorNode = tb.depth(lay).rgb.mul(0.9);
  barkM.normalNode = normalMap(tn.depth(lay).rgb);
  barkM.roughnessNode = tm.depth(lay).g; barkM.aoNode = tm.depth(lay).r; barkM.metalnessNode = float(0);
  const leafM = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide, alphaTest: 0.45 });
  const tl = texture(SETS.leaf.c, uv()); track('leaf', 'c', tl);
  const w = attribute('wind', 'float');
  const sway = sin(time.mul(1.6).add(positionLocal.x.mul(0.35)).add(positionLocal.z.mul(0.27))).mul(0.06).add(sin(time.mul(3.7).add(positionLocal.y.mul(1.3))).mul(0.025)).mul(w.mul(0.12)).mul(float(1).add(U.rain.mul(1.5)));
  leafM.positionNode = positionLocal.add(vec3(sway, sway.mul(0.3), sway.mul(0.7)));
  const leafTex = tl.depth(attribute('lay', 'float'));
  leafM.colorNode = leafTex.rgb;
  leafM.opacityNode = leafTex.a;
  leafM.roughnessNode = float(0.72); leafM.metalnessNode = float(0);
  /* light passing through the leaves when the sun is behind them */
  leafM.emissiveNode = leafTex.rgb.mul(0.06).mul(float(1).sub(U.night));
  mats = { bark: barkM, leaf: leafM };
  void cos; void mix; void smoothstep; void clamp; void positionWorld; void cameraPosition; void length; void vec2; void normalLocal;
  return mats;
}

/* far away: one quad per tree showing a picture of it, baked at load */
export function bakeImpostor(renderer, g, mats, size = 256) {
  const sc = new THREE.Scene();
  sc.add(new THREE.Mesh(g.bark, mats.bark), new THREE.Mesh(g.leaf, mats.leaf));
  const l = new THREE.DirectionalLight(0xffffff, 2.6); l.position.set(0.4, 1, 0.8); sc.add(l, new THREE.AmbientLight(0xbfd2ff, 1.4));
  const h = g.h, r = Math.max(g.r, h / 2);
  const cam = new THREE.OrthographicCamera(-r, r, h + 0.5, -0.5, 0.1, 200);
  cam.position.set(0, 0, 80); cam.lookAt(0, 0, 0);
  const rt = new THREE.RenderTarget(size, size, { samples: 0 });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const prevT = renderer.getRenderTarget(), prevC = renderer.getClearColor(new THREE.Color()), prevA = renderer.getClearAlpha();
  renderer.setRenderTarget(rt); renderer.setClearColor(0x405030, 0); renderer.clear(); renderer.render(sc, cam);
  renderer.setRenderTarget(prevT); renderer.setClearColor(prevC, prevA);
  const m = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide, alphaTest: 0.5, transparent: false, roughness: 0.85 });
  m.map = rt.texture;
  const geoQ = new THREE.BufferGeometry();
  const w = r, pos = [], uvs = [], nor = [], idx = [];
  for (let k = 0; k < 2; k++) {
    const a = k * Math.PI / 2, cx = Math.cos(a), cz = Math.sin(a), b = pos.length / 3;
    pos.push(-w * cx, -0.5, -w * cz, w * cx, -0.5, w * cz, w * cx, h + 0.5, w * cz, -w * cx, h + 0.5, -w * cz);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1); for (let i = 0; i < 4; i++) nor.push(0, 1, 0);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  geoQ.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geoQ.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geoQ.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geoQ.setIndex(idx);
  return { geometry: geoQ, material: m };
}

export function setupTrees(renderer, inst, plan, P) {
  const m = treeMaterials();
  const kinds = ['plane', 'oak', 'pine', 'palm'];
  for (const kind of kinds) {
    const items = plan.trees.filter((t) => t.sp === kind);
    for (let v = 0; v < 3; v++) {
      const mine = items.filter((_, i) => i % 3 === v).map((t) => ({ x: t.x, y: t.y - 0.1, z: t.z, r: t.r, s: t.s, c: kind === 'palm' ? null : [0.85 + ((t.x * 7) % 1 + 1) % 1 * 0.3, 0.9 + ((t.z * 3) % 1 + 1) % 1 * 0.2, 0.85] }));
      if (!mine.length) continue;
      const full = growTree(kind, v, false), lite = growTree(kind, v, true), imp = bakeImpostor(renderer, lite, m, P.trees > 200 ? 256 : 128);
      inst.add('tree-' + kind + v, [
        { meshes: [[full.bark, m.bark], [full.leaf, m.leaf]], dist: Math.min(P.trees * 0.45, 140) },
        { meshes: [[lite.bark, m.bark], [lite.leaf, m.leaf]], dist: P.trees },
        { meshes: [[imp.geometry, imp.material]], dist: P.far * 0.55, noShadow: true }
      ], mine, { radius: full.r, cap: 6000, colors: kind !== 'palm' });
    }
  }
}
