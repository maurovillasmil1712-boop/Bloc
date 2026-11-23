/* Bloc City materials, written in TSL so they run on WebGPU and WebGL2 alike.
   Surfaces sample KTX2 texture arrays (albedo, normal, AO/roughness/metalness) by a per-vertex layer index. */
import * as THREE from 'three/webgpu';
import {
  Fn, uniform, attribute, texture, uv, vec2, vec3, vec4, float, positionWorld, positionLocal, normalLocal, cameraPosition,
  mix, step, smoothstep, fract, floor, abs, max, min, clamp, dot, normalize, select, sin, cos, pow, length, normalMap, time, If, sign
} from 'three/tsl';
import { SETS, track } from './textures.js';

/* shared by every material: the sky and weather drive them */
export const U = {
  night: uniform(0),        /* 0 day, 1 night */
  daylight: uniform(1),     /* how bright interiors look by day */
  wet: uniform(0),          /* wetness of the ground, 0 to 1 */
  rain: uniform(0),         /* rain falling now */
  lit: uniform(0.45),       /* share of windows lit at night */
  sunDir: uniform(new THREE.Vector3(0.4, 0.8, 0.3)),
  far: uniform(0)           /* 1 on low: cheaper paths */
};

const hash2 = Fn(([p]) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453)));
const hash3 = Fn(([p]) => fract(sin(dot(p, vec3(127.1, 311.7, 74.7))).mul(43758.5453)));
const vnoise = Fn(([p]) => {
  const i = floor(p), f = fract(p), u2 = f.mul(f).mul(float(3).sub(f.mul(2)));
  const a = hash2(i), b = hash2(i.add(vec2(1, 0))), c = hash2(i.add(vec2(0, 1))), d = hash2(i.add(vec2(1, 1)));
  return mix(mix(a, b, u2.x), mix(c, d, u2.x), u2.y);
});
export const fbm = Fn(([p]) => vnoise(p).mul(0.5).add(vnoise(p.mul(2.03)).mul(0.25)).add(vnoise(p.mul(4.11)).mul(0.125)).div(0.875));
export { hash2, hash3, vnoise };

/* puddles: where the ground is wet and low, the surface turns into a mirror */
const puddle = Fn(([xz]) => smoothstep(0.52, 0.62, fbm(xz.mul(0.09))).mul(smoothstep(0.35, 0.95, U.wet)));

function arr(group, k, uvNode, layer) { const t = texture(SETS[group][k], uvNode); track(group, k, t); return t.depth(layer); }

/* ---------- terrain: grass, forest floor, sand, paving and dirt blended per vertex ---------- */
export function terrainMaterial(L) {
  const m = new THREE.MeshStandardNodeMaterial();
  const lw = attribute('lw', 'vec4');
  const wp = positionWorld.xz;
  const near = clamp(length(positionWorld.sub(cameraPosition)).div(140), 0, 1);
  const uvA = wp.div(4.5), uvB = wp.div(19);
  const samp = (layer) => mix(arr('ground', 'c', uvA, layer).rgb, arr('ground', 'c', uvB, layer).rgb, near.mul(0.55));
  const dirt = clamp(float(1).sub(lw.x).sub(lw.y).sub(lw.z).sub(lw.w), 0, 1);
  const col = samp(L.grass).mul(lw.x).add(samp(L.forest).mul(lw.y)).add(samp(L.sand).mul(lw.z)).add(samp(L.paved).mul(lw.w)).add(samp(L.dirt).mul(dirt));
  const macro = fbm(wp.div(160)).mul(0.35).add(0.82);
  m.colorNode = col.mul(macro).mul(mix(float(1), float(0.62), U.wet.mul(float(1).sub(lw.z))));
  const dom = select(lw.x.greaterThan(0.5), float(L.grass), select(lw.z.greaterThan(0.5), float(L.sand), select(lw.y.greaterThan(0.5), float(L.forest), select(lw.w.greaterThan(0.5), float(L.paved), float(L.dirt)))));
  const orm = arr('ground', 'm', uvA, dom);
  m.normalNode = normalMap(arr('ground', 'n', uvA, dom).rgb);
  m.roughnessNode = orm.g.mul(mix(float(1), float(0.55), U.wet));
  m.metalnessNode = float(0);
  m.aoNode = orm.r;
  return m;
}

/* ---------- roads: asphalt with painted lines, worn edges and puddles ---------- */
export function roadMaterial(L) {
  const m = new THREE.MeshStandardNodeMaterial();
  const ra = attribute('ra', 'vec4');      /* layer, lanes, width, flags */
  const p = uv();                          /* x across (m, 0 at the centre), y along (m) */
  const wp = positionWorld.xz;
  const layer = ra.x, lanes = ra.y, w = ra.z, flags = ra.w;
  const tuv = vec2(p.x.div(4.0), p.y.div(4.0));
  const base = arr('ground', 'c', tuv, layer).rgb;
  const macro = fbm(wp.div(55)).mul(0.25).add(0.88);
  const half = w.mul(0.5), ax = abs(p.x);
  /* lines: solid edges, dashed lanes, a double line in the middle of two-way roads */
  const lineW = float(0.13);
  const edge = step(half.sub(0.45), ax).mul(step(ax, half.sub(0.45).add(lineW)));
  const laneW = w.div(max(lanes, 1));
  const dashOn = step(fract(p.y.div(9)), 0.38);
  const kLane = fract(p.x.add(half).div(laneW).add(1000));
  const laneLine = step(abs(kLane.sub(0)).min(abs(kLane.sub(1))), lineW.div(laneW).mul(0.5)).mul(dashOn).mul(step(1.5, lanes)).mul(step(ax, half.sub(0.8)));
  const centre = step(abs(ax.sub(0.12)), 0.065).mul(step(1.5, lanes)).mul(step(flags, 0.5));
  const paintMask = clamp(edge.mul(step(lanes, 5.5).max(1)).add(laneLine).add(centre), 0, 1).mul(step(0.9, lanes));
  const wear = smoothstep(0.25, 0.75, fbm(wp.mul(0.8)));
  const paint = paintMask.mul(mix(float(0.55), float(1), wear));
  const pud = puddle(wp);
  const wet = U.wet;
  const col = mix(base.mul(macro), vec3(0.86, 0.86, 0.84), paint);
  m.colorNode = col.mul(mix(float(1), float(0.5), wet)).mul(mix(float(1), float(0.6), pud));
  const orm = arr('ground', 'm', tuv, layer);
  m.normalNode = normalMap(arr('ground', 'n', tuv, layer).rgb, vec2(float(1).sub(pud).mul(float(1).sub(wet.mul(0.5)))));
  m.roughnessNode = mix(mix(orm.g, float(0.5), paint), float(0.04), max(pud, wet.mul(0.55)));
  m.metalnessNode = float(0);
  m.aoNode = orm.r;
  return m;
}
/* sidewalks and kerbs share one material: the layer picks the paving */
export function pavingMaterial() {
  const m = new THREE.MeshStandardNodeMaterial();
  const la = attribute('pl', 'vec2');      /* layer, tint */
  const wp = positionWorld.xz;
  const tuv = select(abs(normalLocal.y).greaterThan(0.5), wp.div(3.2), vec2(positionWorld.x.add(positionWorld.z), positionWorld.y).div(1.6));
  const base = arr('ground', 'c', tuv, la.x).rgb.mul(la.y);
  const pud = puddle(wp.add(31.0)).mul(0.6);
  m.colorNode = base.mul(fbm(wp.div(30)).mul(0.2).add(0.9)).mul(mix(float(1), float(0.6), U.wet)).mul(mix(float(1), float(0.75), pud));
  const orm = arr('ground', 'm', tuv, la.x);
  m.normalNode = normalMap(arr('ground', 'n', tuv, la.x).rgb);
  m.roughnessNode = mix(orm.g, float(0.08), max(pud, U.wet.mul(0.4)));
  m.metalnessNode = float(0);
  m.aoNode = orm.r;
  return m;
}

/* ---------- facades: walls, procedural windows with rooms behind them, shops, shutters ---------- */
/* attributes: uv = metres on the wall; fa = layer, bay width, floor height, ground floor height;
   fb = tint rgb, seed; fc = window width (share of bay), window height (share of floor), flags, wall top */
export function facadeMaterial() {
  const m = new THREE.MeshStandardNodeMaterial();
  const fa = attribute('fa', 'vec4'), fb = attribute('fb', 'vec4'), fc = attribute('fc', 'vec4');
  const p = uv(), u = p.x, v = p.y;
  const layer = fa.x, bay = fa.y, fh = fa.z, gf = fa.w, tint = fb.xyz, seed = fb.w;
  const ww = fc.x, wh = fc.y, flags = fc.z, top = fc.w;
  const f = (bit) => step(0.5, fract(flags.div(bit * 2)).mul(2).floor());
  const shutters = f(1), shop = f(2), balcony = f(4), glassy = f(8), bands = f(16), arcade = f(32), industrial = f(64);
  const tuv = vec2(u, v).div(3.0);
  const wallCol = arr('wall', 'c', tuv, layer).rgb.mul(tint);
  const wallOrm = arr('wall', 'm', tuv, layer);
  /* the grid of windows */
  const upper = step(gf, v).mul(step(v, top.sub(0.9)));
  const fy = v.sub(gf).div(fh), fl = floor(fy), fv = fract(fy);
  const fx = u.div(bay), bi = floor(fx), fu = fract(fx);
  const cell = vec3(bi, fl, seed);
  const rnd = hash3(cell);
  const sill = mix(float(0.22), float(0.0), bands);
  const wHeight = mix(wh, float(0.86), bands);
  const inX = step(abs(fu.sub(0.5)), ww.mul(0.5)), inY = step(sill, fv).mul(step(fv, sill.add(wHeight)));
  const win = inX.mul(inY).mul(upper).mul(float(1).sub(industrial.mul(step(fl, 100))).max(industrial.mul(step(fv, 0.35)).mul(step(0.12, fv))));
  /* frames: a band around each window */
  const fw = float(0.07);
  const inXf = step(abs(fu.sub(0.5)), ww.mul(0.5).add(fw.div(bay))), inYf = step(sill.sub(fw.div(fh)), fv).mul(step(fv, sill.add(wHeight).add(fw.div(fh))));
  const frame = inXf.mul(inYf).mul(upper).mul(float(1).sub(win));
  /* the ground floor: shop windows with a sign band, or a door in one bay */
  const gfZone = step(v, gf);
  const shopGlass = gfZone.mul(shop).mul(step(0.35, v)).mul(step(v, gf.sub(1.05))).mul(step(abs(fract(u.div(bay.mul(1.5))).sub(0.5)), 0.42));
  const signBand = gfZone.mul(shop).mul(step(gf.sub(0.95), v)).mul(step(v, gf.sub(0.25)));
  const door = gfZone.mul(float(1).sub(shop)).mul(step(v, 2.4)).mul(step(abs(fract(u.div(bay.mul(3))).sub(0.5)), 0.13));
  const arch = gfZone.mul(arcade).mul(step(length(vec2(fract(u.div(4.2)).sub(0.5).mul(4.2), max(v.sub(2.9), 0))), 1.55));
  /* rooms behind the glass: interior mapping */
  const N = normalLocal, T = vec3(N.z, 0, N.x.negate());
  const V = normalize(positionWorld.sub(cameraPosition));
  const winU = fu.sub(0.5).div(ww.mul(0.5)), winV = fv.sub(sill).div(wHeight).mul(2).sub(1);
  const gu = select(gfZone.greaterThan(0.5), fract(u.div(bay.mul(1.5))).sub(0.5).div(0.42), winU);
  const gv = select(gfZone.greaterThan(0.5), v.sub(0.35).div(gf.sub(1.4)).mul(2).sub(1), winV);
  const rw = select(gfZone.greaterThan(0.5), bay.mul(0.63), bay.mul(ww).mul(0.5));
  const rh = select(gfZone.greaterThan(0.5), gf.sub(1.4).mul(0.5), fh.mul(wHeight).mul(0.5));
  const depth = float(4.5);
  const d = vec3(dot(V, T).div(rw), V.y.div(rh), dot(V, N).div(depth).negate().max(0.02));
  const tx = sign(d.x).sub(gu).div(d.x), ty = sign(d.y).sub(gv).div(d.y), tz = float(1).div(d.z);
  const t = min(min(tx, ty), tz);
  const hit = vec3(gu.add(d.x.mul(t)), gv.add(d.y.mul(t)), d.z.mul(t));
  const isBack = step(tz, min(tx, ty)), isSide = step(tx, min(ty, tz)).mul(float(1).sub(isBack));
  const isFloor = float(1).sub(isBack).sub(isSide).mul(step(d.y, 0)), isCeil = float(1).sub(isBack).sub(isSide).sub(isFloor);
  const roomSeed = hash3(cell.add(vec3(0.37, 0.11, 0)));
  const wallTone = mix(vec3(0.82, 0.76, 0.66), vec3(0.62, 0.70, 0.74), step(0.6, roomSeed)).mul(mix(float(0.75), float(1.05), hash3(cell.add(3.1))));
  const floorTone = mix(vec3(0.42, 0.28, 0.18), vec3(0.55, 0.52, 0.48), step(0.5, roomSeed));
  let room = wallTone.mul(isBack.mul(0.9).add(isSide.mul(0.72))).add(floorTone.mul(isFloor)).add(vec3(0.9, 0.88, 0.84).mul(isCeil));
  /* furniture: a dark shape low on the back wall, a picture or shelves above */
  const furn = isBack.mul(step(hit.y, -0.35)).mul(step(abs(hit.x.sub(roomSeed.sub(0.5))), 0.45));
  const pic = isBack.mul(step(abs(hit.y.sub(0.25)), 0.18)).mul(step(abs(hit.x.add(0.3)), 0.2)).mul(step(0.4, roomSeed));
  room = mix(room, vec3(0.18, 0.15, 0.13), furn.mul(0.85));
  room = mix(room, vec3(0.6, 0.35, 0.25).mul(hash3(cell.add(9))), pic);
  room = room.mul(mix(float(1), float(0.45), clamp(hit.z, 0, 1)));
  /* curtains and blinds, different in every window */
  const curtain = step(0.55, rnd).mul(step(float(1).sub(abs(winU)), mix(float(0.15), float(0.45), hash3(cell.add(5)))));
  const blindDown = mix(float(0), float(0.9), step(0.62, hash3(cell.add(7))).mul(hash3(cell.add(8))));
  const blind = step(float(1).sub(blindDown.mul(2)), winV).mul(float(1).sub(gfZone));
  const slats = step(0.5, fract(v.mul(16)));
  /* lit at night: warm or cool, some rooms dark */
  const litRoom = step(rnd, U.lit.add(gfZone.mul(shop).mul(0.4))).mul(U.night);
  const lamp = mix(vec3(1.0, 0.72, 0.42), vec3(0.85, 0.9, 1.0), step(0.75, hash3(cell.add(2)))).mul(mix(float(2.2), float(3.6), hash3(cell.add(4))));
  const glassMask = clamp(win.add(shopGlass), 0, 1).mul(float(1).sub(arch.mul(0)));
  let interior = room.mul(lamp.mul(litRoom).add(vec3(U.daylight.mul(0.1))));
  interior = mix(interior, vec3(0.72, 0.62, 0.5).mul(litRoom.mul(1.8).add(U.daylight.mul(0.16))), curtain.mul(0.9));
  const blindCol = mix(vec3(0.62, 0.55, 0.46), vec3(0.75, 0.75, 0.72), step(0.5, seed.mul(13).fract())).mul(slats.mul(0.25).add(0.75));
  interior = mix(interior, blindCol.mul(U.daylight.mul(0.3).add(litRoom.mul(0.6)).add(0.03)), blind);
  /* shutters on old buildings: closed, half or open */
  const shutState = hash3(cell.add(11));
  const shutCol = mix(vec3(0.16, 0.30, 0.20), vec3(0.36, 0.22, 0.14), step(0.5, fract(seed.mul(7.3))));
  const sideShut = shutters.mul(step(0.45, shutState)).mul(step(ww.mul(0.5), abs(fu.sub(0.5)))).mul(step(abs(fu.sub(0.5)), ww.mul(0.5).add(ww.mul(0.42)))).mul(inY).mul(upper);
  const closed = shutters.mul(step(shutState, 0.18)).mul(win);
  const louvre = step(0.45, fract(v.mul(11)));
  /* balconies painted in at a distance: a slab and a railing shadow under the windows */
  const balc = balcony.mul(upper).mul(float(1).sub(glassy)).mul(step(abs(fv.sub(sill.sub(0.02))), 0.025).add(step(fv, sill).mul(step(sill.sub(0.24), fv)).mul(step(0.5, fract(u.mul(6)))).mul(0.6)));
  const band = bands.mul(upper).mul(step(fv, 0.12));
  /* ledge at every floor line on glass towers and bands */
  let col = wallCol;
  col = mix(col, vec3(0.92, 0.91, 0.88).mul(tint.mul(0.3).add(0.75)), frame.mul(float(1).sub(glassy)));
  col = mix(col, vec3(0.93, 0.93, 0.91), band);
  col = mix(col, vec3(0.08, 0.08, 0.08), balc.mul(0.75));
  col = mix(col, vec3(0.05, 0.05, 0.06), glassMask);
  col = mix(col, shutCol.mul(louvre.mul(0.3).add(0.7)), clamp(sideShut.add(closed), 0, 1));
  col = mix(col, vec3(0.20, 0.14, 0.10), door);
  col = mix(col, vec3(0.05, 0.05, 0.05), arch);
  const signHue = vec3(hash2(vec2(seed, 1.7)), hash2(vec2(seed, 2.9)), hash2(vec2(seed, 5.3)));
  col = mix(col, signHue.mul(0.6).add(0.15), signBand);
  m.colorNode = col.mul(mix(float(1), float(0.72), U.wet.mul(float(1).sub(glassMask))));
  const glassNow = glassMask.mul(float(1).sub(closed));
  m.emissiveNode = interior.mul(glassNow).add(signHue.mul(1.6).add(0.3).mul(signBand).mul(U.night).mul(step(0.35, hash2(vec2(seed, 9.1)))));
  m.roughnessNode = mix(mix(wallOrm.g, float(0.45), frame), float(0.04), glassNow);
  m.metalnessNode = mix(float(0), float(0.0), glassNow);
  m.normalNode = normalMap(arr('wall', 'n', tuv, layer).rgb, vec2(float(1).sub(glassMask).mul(0.9)));
  m.aoNode = mix(wallOrm.r, float(1), glassMask);
  return m;
}

/* ---------- glass towers: curtain walls with mullions, floor slabs and offices ---------- */
export function curtainMaterial() {
  const m = new THREE.MeshPhysicalNodeMaterial();
  const fa = attribute('fa', 'vec4'), fb = attribute('fb', 'vec4'), fc = attribute('fc', 'vec4');
  const p = uv(), u = p.x, v = p.y;
  const fh = fa.z, gf = fa.w, tint = fb.xyz, seed = fb.w, top = fc.w;
  const mul = fa.y;                       /* mullion spacing */
  const fy = v.sub(gf).div(fh), fl = floor(fy), fv = fract(fy);
  const fx = u.div(mul), bi = floor(fx), fu = fract(fx);
  const cell = vec3(floor(bi.div(3)), fl, seed);
  const slab = step(fv, 0.13).add(step(0.97, fv));
  const mull = step(fu, 0.035).add(step(0.965, fu));
  const lobby = step(v, gf), crown = step(top.sub(4), v);
  const frameMask = clamp(slab.mul(float(1).sub(lobby)).add(mull.mul(0.9)), 0, 1);
  /* offices behind the glass */
  const rnd = hash3(cell);
  const lit = step(rnd, U.lit.add(0.15)).mul(U.night);
  const ceilLights = step(0.82, fract(u.div(2.4))).mul(step(0.86, fv)).mul(step(fv, 0.93));
  const deskBand = step(fv, 0.38).mul(step(0.24, fv)).mul(step(0.3, fract(u.div(3.6))));
  const office = vec3(0.55, 0.6, 0.62).mul(mix(float(0.35), float(0.9), hash3(cell.add(1))));
  let interior = office.mul(lit.mul(2.2).add(U.daylight.mul(0.12)));
  interior = interior.add(vec3(1.6, 1.55, 1.4).mul(ceilLights).mul(lit.max(U.night.mul(0.15))));
  interior = mix(interior, vec3(0.05), deskBand.mul(0.7));
  const lobbyLight = lobby.mul(vec3(1.4, 1.2, 0.95)).mul(U.night.mul(1.6).add(U.daylight.mul(0.2)));
  m.colorNode = mix(tint.mul(0.18), vec3(0.32, 0.33, 0.35), frameMask);
  m.emissiveNode = interior.mul(float(1).sub(frameMask)).mul(float(1).sub(crown)).add(lobbyLight.mul(float(1).sub(frameMask)));
  m.metalnessNode = mix(float(0.55), float(0.8), frameMask);
  m.roughnessNode = mix(float(0.035).add(hash3(cell.add(6)).mul(0.03)), float(0.4), frameMask);
  m.clearcoatNode = float(0);
  return m;
}

/* ---------- roofs ---------- */
export function roofMaterial() {
  const m = new THREE.MeshStandardNodeMaterial();
  const ro = attribute('ro', 'vec4');      /* layer, tint rgb packed later */
  const tuv = uv().div(3.0);
  const col = arr('roof', 'c', tuv, ro.x).rgb.mul(vec3(ro.y, ro.z, ro.w));
  m.colorNode = col.mul(mix(float(1), float(0.6), U.wet));
  const orm = arr('roof', 'm', tuv, ro.x);
  m.normalNode = normalMap(arr('roof', 'n', tuv, ro.x).rgb);
  m.roughnessNode = orm.g.mul(mix(float(1), float(0.5), U.wet));
  m.metalnessNode = orm.b;
  m.aoNode = orm.r;
  return m;
}

/* ---------- simple colours for things drawn in code ---------- */
export function plainMaterial(color, rough = 0.8, metal = 0, emissive = null) {
  const m = new THREE.MeshStandardNodeMaterial({ color, roughness: rough, metalness: metal });
  if (emissive) { m.emissive = new THREE.Color(emissive); }
  return m;
}
/* wall-array material for kerbs, plinths, cornices and props built in code */
export function wallBlockMaterial() {
  const m = new THREE.MeshStandardNodeMaterial();
  const wl = attribute('wl', 'vec4');      /* layer, tint rgb */
  const ny = abs(normalLocal.y);
  const tuv = select(ny.greaterThan(0.5), positionWorld.xz.div(3), vec2(positionWorld.x.add(positionWorld.z), positionWorld.y).div(3));
  m.colorNode = arr('wall', 'c', tuv, wl.x).rgb.mul(wl.yzw).mul(mix(float(1), float(0.7), U.wet));
  const orm = arr('wall', 'm', tuv, wl.x);
  m.normalNode = normalMap(arr('wall', 'n', tuv, wl.x).rgb);
  m.roughnessNode = orm.g; m.metalnessNode = orm.b; m.aoNode = orm.r;
  return m;
}
