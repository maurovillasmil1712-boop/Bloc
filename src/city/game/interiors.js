/* Places you can walk into: a café, a clothing shop, a garage, a gym and your own flat. Each room is built in code
   the first time you go in, far below the city, and its door in the street glows yellow. */
import * as THREE from 'three/webgpu';
import { positionWorld, floor, mod, mix, vec3, float, step, fract } from 'three/tsl';
import { Human } from '../actors/human.js';
import { homeLot, sampleHeight } from '../world/plan.js';

export const PLACES = [
  { id: 'cafe', w: 14, d: 11, near: [-330, -95] },
  { id: 'shop', w: 15, d: 12, near: [-455, -40] },
  { id: 'garage', w: 16, d: 14, near: [-610, 330] },
  { id: 'gym', w: 18, d: 14, near: [-210, 240] },
  { id: 'flat', w: 13, d: 10, near: null }
];
const M = new Map();
function mat(color, rough = 0.8, metal = 0, extra) {
  const k = color + '|' + rough + '|' + metal + (extra ? JSON.stringify(extra) : '');
  if (!M.has(k)) M.set(k, new THREE.MeshStandardNodeMaterial(Object.assign({ color, roughness: rough, metalness: metal }, extra || {})));
  return M.get(k);
}
/* floors drawn in the shader: planks, tiles, concrete, rubber */
function floorMat(kind) {
  const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.7 });
  const p = positionWorld.xz;
  if (kind === 'planks') {
    const row = floor(p.y.div(0.22)), u = fract(p.x.div(1.6).add(row.mul(0.37))), seam = step(0.985, u).max(step(0.96, fract(p.y.div(0.22))));
    const tone = fract(row.mul(0.618)).mul(0.25).add(0.75);
    m.colorNode = mix(vec3(0.42, 0.28, 0.17).mul(tone), vec3(0.18, 0.12, 0.08), seam);
    m.roughnessNode = float(0.55);
  } else if (kind === 'tiles') {
    const c = mod(floor(p.x.div(0.6)).add(floor(p.y.div(0.6))), 2), grout = step(0.97, fract(p.x.div(0.6))).max(step(0.97, fract(p.y.div(0.6))));
    m.colorNode = mix(mix(vec3(0.86, 0.85, 0.82), vec3(0.16, 0.17, 0.19), c), vec3(0.5, 0.5, 0.48), grout);
    m.roughnessNode = float(0.35);
  } else if (kind === 'rubber') {
    const grout = step(0.985, fract(p.x.div(1.0))).max(step(0.985, fract(p.y.div(1.0))));
    m.colorNode = mix(vec3(0.07, 0.075, 0.08), vec3(0.02, 0.02, 0.02), grout); m.roughnessNode = float(0.95);
  } else {
    const n = fract(p.x.mul(0.37).add(p.y.mul(0.11))).mul(0.04);
    m.colorNode = vec3(0.47, 0.47, 0.45).add(n); m.roughnessNode = float(0.85);
  }
  return m;
}

class Room {
  constructor(place, origin) {
    this.place = place; this.group = new THREE.Group(); this.group.position.copy(origin); this.o = origin;
    this.boxes = []; this.spots = []; this.floorY = origin.y; this.W = place.w; this.D = place.d; this.extra = [];
  }
  box(w, h, d, m, x, y, z, solid = true, ry = 0) {
    const g = new THREE.BoxGeometry(w, h, d), o = new THREE.Mesh(g, m);
    o.position.set(x, y + h / 2, z); o.rotation.y = ry; o.castShadow = true; o.receiveShadow = true; this.group.add(o);
    if (solid) { const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry)); this.boxes.push({ x, z, hw: (w * c + d * s) / 2, hd: (w * s + d * c) / 2 }); }
    return o;
  }
  cyl(r, h, m, x, y, z, solid = false, seg = 18) {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m); o.position.set(x, y + h / 2, z); o.castShadow = true; o.receiveShadow = true; this.group.add(o);
    if (solid) this.boxes.push({ x, z, hw: r, hd: r });
    return o;
  }
  light(x, y, z, color = '#FFE2B8', intensity = 18, dist = 12) { const l = new THREE.PointLight(color, intensity * 2.2, dist * 1.4, 2); l.position.set(x, y, z); this.group.add(l); return l; }
  shell(floorKind, wallColor, ceilColor = '#EDEBE6', h = 3.4) {
    const W = this.W, D = this.D;
    const f = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat(floorKind)); f.rotation.x = -Math.PI / 2; f.receiveShadow = true; this.group.add(f);
    const c = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(ceilColor, 0.9)); c.rotation.x = Math.PI / 2; c.position.y = h; c.castShadow = true; this.group.add(c);
    const wm = mat(wallColor, 0.9);
    const wall = (w, x, z, ry) => { const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wm); o.position.set(x, h / 2, z); o.rotation.y = ry; o.receiveShadow = true; o.castShadow = true; this.group.add(o); };
    wall(W, 0, D / 2, Math.PI); wall(D, W / 2, 0, -Math.PI / 2); wall(D, -W / 2, 0, Math.PI / 2);
    /* the street side has the door in the middle */
    const side = (W - 1.6) / 2; wall(side, -W / 2 + side / 2, -D / 2, 0); wall(side, W / 2 - side / 2, -D / 2, 0);
    const lintel = new THREE.Mesh(new THREE.PlaneGeometry(1.6, h - 2.3), wm); lintel.position.set(0, 2.3 + (h - 2.3) / 2, -D / 2); this.group.add(lintel);
    /* a bright doorway: daylight from the street */
    const dw = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.3), new THREE.MeshBasicNodeMaterial({ color: '#FFF3D6' })); dw.position.set(0, 1.15, -D / 2 - 0.05); this.group.add(dw);
    this.box(W, 0.12, 0.08, mat('#2A2D33', 0.6), 0, 0, D / 2 - 0.04, false);
    this.spots.push({ x: 0, z: -D / 2 + 0.9, r: 1.3, act: 'leave' });
    this.h = h;
  }
  /* keep a person inside the walls and out of the furniture (room-local coordinates) */
  collide(p) {
    const lx = p.x - this.o.x, lz = p.z - this.o.z, r = 0.32;
    let x = Math.max(-this.W / 2 + r, Math.min(this.W / 2 - r, lx)), z = Math.max(-this.D / 2 + r, Math.min(this.D / 2 - r, lz));
    for (const b of this.boxes) {
      const dx = x - b.x, dz = z - b.z, ox = b.hw + r - Math.abs(dx), oz = b.hd + r - Math.abs(dz);
      if (ox > 0 && oz > 0) { if (ox < oz) x += Math.sign(dx || 1) * ox; else z += Math.sign(dz || 1) * oz; }
    }
    p.x = x + this.o.x; p.z = z + this.o.z;
  }
}

function buildCafe(r) {
  r.shell('planks', '#E6D8C3', '#3A2C22');
  const wood = mat('#6B4A30', 0.55), dark = mat('#2B211B', 0.6), steel = mat('#B9BCC0', 0.25, 0.9), marble = mat('#EDE9E2', 0.25);
  r.box(6, 1.05, 0.8, wood, 1, 0, 3.6); r.box(6.1, 0.06, 0.95, marble, 1, 1.05, 3.6, false);
  r.box(0.7, 0.45, 0.5, steel, -0.6, 1.11, 3.7, false); r.box(0.35, 0.3, 0.35, dark, 0.3, 1.11, 3.7, false);
  r.box(6.8, 2.0, 0.4, dark, 0.8, 1.2, 5.25, false);
  for (let i = 0; i < 9; i++) r.cyl(0.05, 0.22, mat(['#E8DCC8', '#A9C6D6', '#D98E5A'][i % 3], 0.5), -1.8 + i * 0.6, 2.25, 5.15);
  r.box(2.2, 1.2, 0.05, mat('#1E2420', 0.9), 2.4, 2.0, 5.42, false);
  for (const [x, z] of [[-4.2, -1.5], [-4.2, 1.6], [-1.2, -2.6], [1.8, -2.6], [4.6, -1.0], [4.6, 1.6]]) {
    r.cyl(0.42, 0.04, marble, x, 0.74, z); r.cyl(0.05, 0.74, dark, x, 0, z, true);
    for (const a of [0, Math.PI]) { const cx = x + Math.cos(a) * 0.75, cz = z + Math.sin(a) * 0.75; r.box(0.42, 0.45, 0.42, wood, cx, 0, cz, false); r.box(0.42, 0.5, 0.05, wood, cx + Math.cos(a) * 0.2, 0.45, cz, false, Math.PI / 2); }
    r.cyl(0.04, 0.09, mat('#F4F1EA', 0.3), x + 0.1, 0.78, z);
  }
  for (const x of [-3, 0, 3]) { r.cyl(0.18, 0.22, mat('#C9A15A', 0.35, 0.6), x, 2.6, 0); r.light(x, 2.5, 0, '#FFD39A', 14, 9); }
  r.light(1, 2.6, 3.6, '#FFE2B8', 10, 7);
  const barista = new Human({ skin: '#C98E66', hair: 'bun', hairC: '#1B1714', top: { kind: 'shirt', c: '#2B211B' }, bottom: { kind: 'jeans', c: '#1E2026' }, shoes: { kind: 'sneaker', c: '#1A1B1F' }, hat: { kind: 'none', c: '#000' } });
  barista.group.position.set(1, 0, 4.4); barista.group.rotation.y = Math.PI; r.group.add(barista.group); r.extra.push(barista);
  r.spots.push({ x: 1, z: 2.9, r: 1.4, act: 'coffee' });
}
function buildShop(r) {
  r.shell('tiles', '#D9D6CF', '#CFCBC4');
  const rail = mat('#2A2D33', 0.3, 0.8), wood = mat('#BFA584', 0.6), cols = ['#F2F2EE', '#22262F', '#FFE14D', '#C8383C', '#8FB3D9', '#3F5E45', '#4A6A93', '#8D9096', '#7A1F2B', '#E7DCC6'];
  for (const [x, z, ry] of [[-5, 1, 0], [-5, -2.5, 0], [5, 1, 0], [5, -2.5, 0]]) {
    r.box(0.05, 1.6, 0.05, rail, x - 1.2, 0, z, false); r.box(0.05, 1.6, 0.05, rail, x + 1.2, 0, z, false); r.box(2.5, 0.04, 0.04, rail, x, 1.6, z, false);
    for (let i = 0; i < 9; i++) r.box(0.04, 0.75, 0.5, mat(cols[(i * 3 + Math.round(x)) % cols.length], 0.9), x - 1 + i * 0.25, 0.8, z, false, ry);
    r.boxes.push({ x, z, hw: 1.3, hd: 0.35 });
  }
  r.box(3, 1.0, 0.8, wood, 0, 0, 4.3); r.box(0.4, 0.3, 0.3, mat('#191D29', 0.5), 0.8, 1.0, 4.3, false);
  r.box(2.2, 2.4, 0.04, mat('#DDE3E8', 0.04, 1.0), -5.2, 0.3, 5.9, false);
  r.box(0.05, 2.6, 0.06, mat('#191D29', 0.5), -6.3, 0.2, 5.9, false); r.box(0.05, 2.6, 0.06, mat('#191D29', 0.5), -4.1, 0.2, 5.9, false);
  for (const [x, look] of [[2.5, { top: { kind: 'jacket', c: '#2A201C' }, bottom: { kind: 'jeans', c: '#1E2026' }, hat: { kind: 'cap', c: '#FFE14D' }, hair: 'none' }], [-2.5, { top: { kind: 'hoodie', c: '#3F5E45' }, bottom: { kind: 'joggers', c: '#7E8288' }, hair: 'none' }]]) {
    const m = new Human(Object.assign({ skin: '#D9D9D6', hairC: '#D9D9D6', shoes: { kind: 'sneaker', c: '#F4F4F2' }, hat: { kind: 'none', c: '#000' } }, look));
    m.group.position.set(x, 0.12, 2.6); m.group.rotation.y = Math.PI; r.group.add(m.group); r.box(0.6, 0.12, 0.6, wood, x, 0, 2.6); r.extra.push(m);
  }
  for (const x of [-4, 0, 4]) for (const z of [-2, 2]) r.light(x, 3.2, z, '#FFFFFF', 9, 8);
  r.spots.push({ x: 0, z: 3.4, r: 1.5, act: 'shop' });
  r.spots.push({ x: -5.2, z: 5.1, r: 1.3, act: 'mirror' });
}
function buildGarage(r) {
  r.shell('concrete', '#C9CCCF', '#9EA2A6', 4.2);
  const steel = mat('#3A3F45', 0.4, 0.8), red = mat('#B8323A', 0.45, 0.2), yellow = mat('#FFE14D', 0.6);
  r.box(16, 0.01, 0.15, yellow, 0, 0.005, 0, false); r.box(0.15, 0.01, 8, yellow, -3.5, 0.005, 2, false); r.box(0.15, 0.01, 8, yellow, 3.5, 0.005, 2, false);
  r.box(0.25, 2.2, 0.25, steel, -2.8, 0, 3.5); r.box(0.25, 2.2, 0.25, steel, 2.8, 0, 3.5); r.box(5.8, 0.15, 0.4, steel, 0, 2.2, 3.5, false);
  for (let i = 0; i < 3; i++) r.box(1.2, 1.0, 0.6, red, -6.6 + i * 1.3, 0, 6.5);
  r.box(4, 1.2, 0.05, mat('#5B6068', 0.8), 5.5, 1.3, 6.95, false);
  for (let i = 0; i < 12; i++) r.box(0.06, 0.3, 0.03, steel, 3.8 + i * 0.3, 1.6, 6.9, false);
  for (const [x, z] of [[-7, -4], [-7, -3.2], [7, -4]]) r.cyl(0.32, 0.9, mat('#2B6CB0', 0.5, 0.3), x, 0, z, true);
  for (const x of [-4, 0, 4]) { r.box(1.6, 0.06, 0.2, mat('#FFFFFF', 0.3, 0, { emissive: '#FFFFFF', emissiveIntensity: 2 }), x, 4.1, 1, false); r.light(x, 3.9, 1, '#F2F6FF', 22, 12); }
  r.spots.push({ x: 0, z: 1.2, r: 2.2, act: 'garage' });
}
function buildGym(r) {
  r.shell('rubber', '#2E3238', '#24272C', 4.0);
  const red = mat('#A3262E', 0.6), blue = mat('#1F4E8C', 0.6), rope = mat('#F2F2EE', 0.7), steel = mat('#8A8F96', 0.35, 0.8), black = mat('#16171A', 0.6);
  /* a boxing ring at the back */
  r.box(6, 0.6, 6, mat('#1C2B45', 0.8), 3.5, 0, 3.5);
  for (const [x, z] of [[0.6, 0.6], [6.4, 0.6], [0.6, 6.4], [6.4, 6.4]]) r.cyl(0.08, 1.6, steel, x, 0.6, z);
  for (const h of [1.0, 1.35, 1.7]) { r.box(5.8, 0.04, 0.04, rope, 3.5, h, 0.6, false); r.box(5.8, 0.04, 0.04, rope, 3.5, h, 6.4, false); r.box(0.04, 0.04, 5.8, rope, 0.6, h, 3.5, false); r.box(0.04, 0.04, 5.8, rope, 6.4, h, 3.5, false); }
  /* heavy bags that swing when you hit them */
  {
    r.bags = [];
    for (const [x, z, m] of [[-6, 2, red], [-3.5, 2, blue], [-6, -1.5, black]]) {
      const pivot = new THREE.Group(); pivot.position.set(x, 3.6, z); r.group.add(pivot);
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.6, 4), steel); chain.position.y = -0.3; pivot.add(chain);
      const bag = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.8, 4, 14), m); bag.position.y = -1.2; bag.castShadow = true; pivot.add(bag);
      r.bags.push({ pivot, x, z, vx: 0, vz: 0, ax: 0, az: 0 }); r.boxes.push({ x, z, hw: 0.24, hd: 0.24 });
    }
  }
  /* weights */
  r.box(3, 0.9, 0.6, steel, -5, 0, -5.4);
  for (let i = 0; i < 6; i++) r.cyl(0.07 + i * 0.012, 0.32, black, -6.2 + i * 0.48, 0.9, -5.4);
  r.box(2.2, 0.45, 0.6, black, 0, 0, -4.5); r.box(0.06, 1.5, 0.06, steel, -0.9, 0, -4.9, false); r.box(0.06, 1.5, 0.06, steel, 0.9, 0, -4.9, false);
  r.cyl(0.03, 2.2, steel, 0, 1.4, -4.9).rotation.z = Math.PI / 2;
  r.box(10, 2.4, 0.03, mat('#DDE3E8', 0.04, 1.0), -2, 0.4, -6.95, false);
  for (const x of [-5, 0, 5]) for (const z of [-3, 3]) r.light(x, 3.8, z, '#F5F7FF', 14, 10);
  r.spots.push({ x: -4.7, z: 0.4, r: 2.4, act: 'bag' });
  r.spots.push({ x: 0.2, z: 3.5, r: 1.2, act: 'ring' });
}
function buildFlat(r) {
  r.shell('planks', '#D8D1C5', '#CFC9BF');
  const sofa = mat('#5A6B7A', 0.9), wood = mat('#8C6A48', 0.55), white = mat('#F2F1EE', 0.5), dark = mat('#1C1E22', 0.4);
  r.box(2.4, 0.42, 0.95, sofa, -3.2, 0, 2.6); r.box(2.4, 0.5, 0.25, sofa, -3.2, 0.42, 3.0, false); r.box(0.25, 0.25, 0.95, sofa, -4.3, 0.42, 2.6, false); r.box(0.25, 0.25, 0.95, sofa, -2.1, 0.42, 2.6, false);
  r.box(1.2, 0.4, 0.6, wood, -3.2, 0, 1.2);
  r.box(1.8, 0.5, 0.4, wood, -3.2, 0, -1.2); r.box(1.6, 0.9, 0.05, dark, -3.2, 0.9, -1.3, false);
  /* the desk where the studying happens */
  r.box(1.5, 0.75, 0.7, white, 3.6, 0, 4.4); r.box(0.5, 0.02, 0.35, mat('#B9BCC0', 0.3, 0.8), 3.6, 0.76, 4.35, false);
  r.box(0.45, 0.3, 0.02, mat('#0E1116', 0.2, 0, { emissive: '#8FB8FF', emissiveIntensity: 0.6 }), 3.6, 0.78, 4.52, false);
  r.box(0.5, 0.45, 0.5, mat('#191D29', 0.6), 3.6, 0, 3.7, false);
  r.box(0.18, 0.12, 0.01, mat('#FFE14D', 0.8), 3.25, 1.2, 4.74, false); r.box(0.18, 0.12, 0.01, mat('#FFE14D', 0.8), 3.5, 1.32, 4.74, false); r.box(0.18, 0.12, 0.01, mat('#FFE14D', 0.8), 3.95, 1.15, 4.74, false);
  /* bed */
  r.box(1.6, 0.45, 2.1, wood, 4.9, 0, -2.6); r.box(1.5, 0.18, 2.0, white, 4.9, 0.45, -2.6, false); r.box(1.5, 0.1, 1.2, mat('#C9DCE8', 0.9), 4.9, 0.6, -2.2, false); r.box(1.5, 0.9, 0.08, wood, 4.9, 0.4, -3.6, false);
  r.cyl(0.25, 0.4, mat('#B07A52', 0.8), -5.7, 0, 4.2); r.cyl(0.45, 0.8, mat('#3F6E46', 0.9), -5.7, 0.4, 4.2);
  /* a window over the city at night */
  r.box(3, 1.6, 0.03, mat('#0B1424', 0.1, 0, { emissive: '#1C2F55', emissiveIntensity: 0.9 }), 0, 1.0, 4.97, false);
  r.light(-3, 2.6, 1.5, '#FFD9A8', 12, 9); r.light(3.6, 1.6, 4.0, '#FFF1D6', 6, 5); r.light(4.5, 2.6, -2, '#FFD9A8', 8, 7);
  r.spots.push({ x: 3.6, z: 3.4, r: 1.2, act: 'desk' });
  r.spots.push({ x: 4.9, z: -1.2, r: 1.2, act: 'bed' });
}
const BUILD = { cafe: buildCafe, shop: buildShop, garage: buildGarage, gym: buildGym, flat: buildFlat };

export class Interiors {
  constructor(scene, plan, homes) {
    this.scene = scene; this.plan = plan; this.rooms = new Map(); this.inside = null;
    this.doors = [];
    const used = new Set();
    for (const [i, p] of PLACES.entries()) {
      let lot = null;
      if (p.id === 'flat') { const me = homes.find((h) => h.me); if (me) lot = me.lot || homeLot(plan, me.id, me.loc); }
      else {
        let best = 1e18;
        for (const l of plan.lots) {
          if (used.has(l) || l.glass || l.villa || !l.shop || l.floors > 9 || Math.max(l.w, l.d) > 40) continue;
          const d = (l.x - p.near[0]) ** 2 + (l.z - p.near[1]) ** 2; if (d < best) { best = d; lot = l; }
        }
      }
      if (!lot) continue;
      used.add(lot);
      const dx = lot.x - lot.fx * (lot.d / 2 + 0.7), dz = lot.z - lot.fz * (lot.d / 2 + 0.7), out = Math.atan2(-lot.fx, -lot.fz);
      this.doors.push({ id: p.id, place: p, x: dx, z: dz, y: sampleHeight(plan.height, dx, dz), a: out, origin: new THREE.Vector3(-20000 + i * 60, -600, 0) });
    }
    /* glowing door frames and floor arrows in the street */
    const glow = new THREE.MeshStandardNodeMaterial({ color: '#FFE14D', emissive: '#FFE14D', emissiveIntensity: 2.2, roughness: 0.5 });
    for (const d of this.doors) {
      const g = new THREE.Group(); g.position.set(d.x, d.y, d.z); g.rotation.y = d.a;
      const frame = new THREE.BoxGeometry(0.1, 2.5, 0.1);
      for (const sx of [-0.85, 0.85]) { const m = new THREE.Mesh(frame, glow); m.position.set(sx, 1.25, -0.55); g.add(m); }
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.1), glow); top.position.set(0, 2.5, -0.55); g.add(top);
      const pad = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicNodeMaterial({ color: '#FFE14D', transparent: true, opacity: 0.7 })); pad.position.y = 0.04; g.add(pad);
      scene.add(g); d.marker = g;
    }
  }
  room(door) {
    if (!this.rooms.has(door.id)) { const r = new Room(door.place, door.origin); BUILD[door.id](r); r.group.visible = false; this.scene.add(r.group); this.rooms.set(door.id, r); }
    return this.rooms.get(door.id);
  }
  near(x, z, r = 1.9) { return this.doors.find((d) => Math.hypot(d.x - x, d.z - z) < r) || null; }
  enter(door) { const r = this.room(door); r.group.visible = true; this.inside = { door, room: r }; return r; }
  leave() { if (!this.inside) return null; const d = this.inside.door; this.inside.room.group.visible = false; this.inside = null; return d; }
  /* the interaction spot you're standing on, in room-local metres */
  spotAt(x, z) {
    if (!this.inside) return null; const r = this.inside.room, lx = x - r.o.x, lz = z - r.o.z;
    return r.spots.find((s) => Math.hypot(s.x - lx, s.z - lz) < s.r) || null;
  }
  update(dt) {
    if (!this.inside) return;
    const r = this.inside.room;
    for (const h of r.extra) h.animate(dt, { speed: 0 });
    if (r.bags) for (const b of r.bags) { b.vx += (-b.ax * 14 - b.vx * 1.2) * dt; b.vz += (-b.az * 14 - b.vz * 1.2) * dt; b.ax += b.vx * dt; b.az += b.vz * dt; b.pivot.rotation.set(b.az, 0, -b.ax); }
  }
  hitBag(x, z, dirx, dirz) {
    const r = this.inside && this.inside.room; if (!r || !r.bags) return false;
    const lx = x - r.o.x, lz = z - r.o.z;
    for (const b of r.bags) if (Math.hypot(b.x - lx, b.z - lz) < 1.0) { b.vx += dirx * 1.6; b.vz += dirz * 1.6; return true; }
    return false;
  }
}
