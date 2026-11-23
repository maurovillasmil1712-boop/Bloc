/* Poly Haven props -> game-ready GLB: textures shrunk and compressed to KTX2 (ETC1S colour, UASTC normals),
   geometry quantised and meshopt-compressed, plus a simplified second level of detail.
   Usage: node models.mjs SRC OUT     (SRC = fetch.py folder, OUT = site/city/models) */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRTextureBasisu } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, meshopt, quantize, reorder, resample, cloneDocument } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const [SRC, OUT] = process.argv.slice(2);
const TOKTX = existsSync('/home/claude/work/bin/toktx') ? '/home/claude/work/bin/toktx' : 'toktx';
/* game id -> Poly Haven id, max texture size, LOD1 ratio */
export const PROPS = {
  lamp: ['street_lamp_01', 512, 3000, 600], lampOld: ['street_lamp_02', 512, 3000, 600], bin: ['metal_trash_can', 256, 2000, 400], bench: ['painted_wooden_bench', 512, 2000, 400],
  hydrant: ['fire_hydrant', 256, 2000, 300], utility: ['utility_box_01', 256, 2000, 400], ac: ['exterior_aircon_unit', 256, 2000, 400], barrier: ['concrete_road_barrier', 512, 1500, 300],
  planter: ['planter_box_01', 256, 2000, 400], pot: ['potted_plant_01', 256, 3000, 600], terrace: ['outdoor_table_chair_set_01', 512, 6000, 1500], coveredCar: ['covered_car', 512, 6000, 1500],
  poles: ['modular_electricity_poles', 512, 4000, 1000], cctv: ['security_camera_01', 256, 1500, 300], shutter: ['rollershutter_door', 512, 1200, 400], manhole: ['water_manhole_cover', 256, 600, 120],
  shrub: ['shrub_01', 512, 5000, 1200], grass: ['grass_medium_01', 512, 3000, 800], grassB: ['grass_bermuda_01', 256, 1000, 400], seating: ['modular_street_seating', 512, 5000, 1200]
};

async function ktx2(bytes, size, kind, tmp, name) {
  const png = join(tmp, name + '.png'), out = join(tmp, name + '.ktx2');
  const img = sharp(bytes).resize(size, size, { fit: 'fill' });
  await img.png().toFile(png);
  const enc = kind === 'normal' ? ['--encode', 'uastc', '--uastc_quality', '1', '--uastc_rdo_l', '1.5', '--zcmp', '18', '--assign_oetf', 'linear'] : ['--encode', 'etc1s', '--clevel', '2', '--qlevel', '170', '--assign_oetf', kind === 'color' ? 'srgb' : 'linear'];
  execFileSync(TOKTX, ['--t2', '--genmipmap', '--threads', '2', ...enc, out, png]);
  return readFileSync(out);
}

async function processOne(id, [ph, maxTex, t0, t1], io, tmp) {
  const dir = join(SRC, 'polyhaven', 'models', ph);
  const file = readdirSync(dir).find((f) => f.endsWith('.gltf'));
  const doc = await io.read(join(dir, file));
  const root = doc.getRoot();
  /* which texture is which: colour, normal or packed AO/roughness/metal */
  const kinds = new Map();
  for (const m of root.listMaterials()) {
    if (m.getBaseColorTexture()) kinds.set(m.getBaseColorTexture(), 'color');
    if (m.getNormalTexture()) kinds.set(m.getNormalTexture(), 'normal');
    if (m.getMetallicRoughnessTexture()) kinds.set(m.getMetallicRoughnessTexture(), 'data');
    if (m.getOcclusionTexture()) kinds.set(m.getOcclusionTexture(), 'data');
  }
  doc.createExtension(KHRTextureBasisu).setRequired(true);
  let k = 0;
  for (const t of root.listTextures()) {
    const kind = kinds.get(t) || 'color';
    const size = kind === 'normal' ? Math.max(128, maxTex / 2) : maxTex;
    t.setImage(await ktx2(Buffer.from(t.getImage()), size, kind, tmp, id + '-' + (k++))).setMimeType('image/ktx2').setURI(id + '-' + k + '.ktx2');
  }
  await doc.transform(dedup(), prune(), weld(), resample());
  const tris = () => { let n = 0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) n += (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3; return n; };
  const n0 = tris();
  if (n0 > t0) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: t0 / n0, error: 0.004 }));
  await doc.transform(reorder({ encoder: MeshoptEncoder }));
  const lod0 = cloneDocument(doc);
  const lodRatio = Math.min(1, t1 / Math.max(1, tris()));
  await lod0.transform(quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const b0 = await io.writeBinary(lod0);
  writeFileSync(join(OUT, id + '.glb'), b0);
  await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: lodRatio, error: 0.01, lockBorder: false }), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const b1 = await io.writeBinary(doc);
  writeFileSync(join(OUT, id + '.lod1.glb'), b1);
  let tris0 = 0; for (const m of lod0.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris0 += (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3;
  return [id, b0.length, b1.length, tris0];
}

await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
mkdirSync(OUT, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const tmp = mkdtempSync(join(tmpdir(), 'bloc-models-'));
const only = process.argv[4] ? process.argv[4].split(',') : null;
for (const [id, spec] of Object.entries(PROPS)) {
  if (only && !only.includes(id)) continue;
  try { const [n, a, b, t] = await processOne(id, spec, io, tmp); console.log(`${n.padEnd(11)} ${(a / 1024).toFixed(0).padStart(5)} KB  lod1 ${(b / 1024).toFixed(0).padStart(5)} KB  ${Math.round(t)} tris`); }
  catch (e) { console.log('FAILED', id, e.message.slice(0, 200)); }
}
rmSync(tmp, { recursive: true, force: true });
