/* Texture arrays (KTX2) per quality tier. The city starts on the small tier, then sharpens while you drive. */
import * as THREE from 'three/webgpu';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

const BASE = new URL('./', import.meta.url).href;
let ktx = null, index = null;
export const SETS = {};
export const RAW = { on: false };
const NODES = {};
/* materials register the texture nodes that sample a set, so a sharper tier can replace it in place */
export function track(group, k, node) { (NODES[group + k] || (NODES[group + k] = [])).push(node); return node; }      /* SETS.wall = { c, n, m, layers: [...ids], tier } */
const listeners = new Set();

/* the decoder runs in lib/basis/ktx2-worker.js (a real file with its own CSP) instead of a blob */
class FileWorkerKTX2Loader extends KTX2Loader {
  init() {
    if (!this.transcoderPending) {
      this.transcoderPending = fetch(BASE + 'lib/basis/basis_transcoder.wasm').then((r) => { if (!r.ok) throw new Error('decoder ' + r.status); return r.arrayBuffer(); }).then((bin) => {
        this.transcoderBinary = bin;
        this.workerPool.setWorkerCreator(() => {
          const worker = new Worker(BASE + 'lib/basis/ktx2-worker.js?v=' + __V__);
          const transcoderBinary = this.transcoderBinary.slice(0);
          worker.postMessage({ type: 'init', config: this.workerConfig, transcoderBinary }, [transcoderBinary]);
          return worker;
        });
      });
    }
    return this.transcoderPending;
  }
}
export function ktx2(renderer) {
  if (!ktx) {
    ktx = new FileWorkerKTX2Loader().setTranscoderPath(BASE + 'lib/basis/').setWorkerLimit(2); ktx.detectSupport(renderer);
    /* software GPUs (tests) and the safe mode take plain RGBA instead of a compressed format */
    if (RAW.on) for (const k of Object.keys(ktx.workerConfig)) if (k.endsWith('Supported')) ktx.workerConfig[k] = false;
  }
  return ktx;
}
export async function loadIndex() {
  if (!index) index = await (await fetch(BASE + 'tex/index.json')).json();
  return index;
}
function prep(t, srgb) {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}
function load(renderer, url, srgb) {
  return new Promise((res, rej) => ktx2(renderer).load(url, (t) => res(prep(t, srgb)), undefined, rej));
}
/* load one group at one tier; the first load creates the textures, later tiers swap image data in place */
const ONLY_C = { leaf: [512, 1024] };
export async function loadSet(renderer, group, tier, onBytes) {
  const idx = await loadIndex();
  if (ONLY_C[group]) tier = ONLY_C[group].filter((t) => t <= tier).pop() || 512;
  const keys = ONLY_C[group] ? ['c'] : ['c', 'n', 'm'];
  const [c, n, m] = await Promise.all(keys.map((k) => load(renderer, `${BASE}tex/${group}-${k}-${tier}.ktx2`, k === 'c')));
  if (onBytes) onBytes(group, tier);
  const prev = SETS[group];
  if (!prev) { SETS[group] = { c, n, m, layers: idx.groups[group], tier }; }
  else if (tier > prev.tier) {
    /* point every material's texture node at the sharper texture, then free the old one */
    const fresh = { c, n, m };
    for (const k of keys) {
      const old = prev[k];
      for (const node of NODES[group + k] || []) node.value = fresh[k];
      prev[k] = fresh[k];
      old.dispose();
    }
    prev.tier = tier;
  } else { c.dispose(); if (n) n.dispose(); if (m) m.dispose(); }
  listeners.forEach((f) => f(group, tier));
  return SETS[group];
}
export function layerOf(group, id) { const s = SETS[group] || (index && { layers: index.groups[group] }); const i = s ? s.layers.indexOf(id) : -1; return i < 0 ? 0 : i; }
export function onUpgrade(f) { listeners.add(f); return () => listeners.delete(f); }
export function tiersFor(preset) { return preset === 'low' || preset === 'lite' ? [512] : [512, 1024]; }

/* small textures drawn in code: noise for water and puddles, signs */
export function canvasTexture(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
