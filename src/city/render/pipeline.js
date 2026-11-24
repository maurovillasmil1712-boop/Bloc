/* Renderer, quality presets and the post stack. WebGPU where the browser has it, WebGL2 otherwise.
   Ultra: GTAO into the lighting, SSR, bloom, TRAA with upscaling, AgX, colour grade.
   High: GTAO, SSR at half size, bloom, TRAA. Medium: bloom, SMAA. Low: FXAA. Every preset gets AgX and the grade. */
import * as THREE from 'three/webgpu';
import { texture3D, pass, mrt, output, normalView, metalness, roughness, velocity, emissive, vec2, vec3, vec4, float, screenUV, sample, packNormalToRGB, unpackRGBToNormal, builtinAOContext, renderOutput, uniform, max, pow, mix, clamp } from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { ssr } from 'three/addons/tsl/display/SSRNode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';
import { smaa } from 'three/addons/tsl/display/SMAANode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { lut3D } from 'three/addons/tsl/display/Lut3DNode.js';
import { motionBlur } from 'three/addons/tsl/display/MotionBlur.js';
import { CSMShadowNode } from 'three/addons/csm/CSMShadowNode.js';

export const PRESETS = {
  /* Lite: for old Intel laptops on Safari when Low still stutters. No shadows, no post AA, a short view and fewer people */
  lite: { scale: [0.6, 0.75], dpr: 1.0, shadow: 0, cascades: 1, shadowFar: 0, ao: false, ssr: false, bloom: false, aa: 'none', far: 1100, detail: 110, trees: 30, peds: 24, cars: 10, lamps: 8, terrainNear: 10, fog: 1.8 },
  low: { scale: [0.7, 0.85], dpr: 1.0, shadow: 1024, cascades: 1, shadowFar: 70, ao: false, ssr: false, bloom: false, aa: 'fxaa', far: 1600, detail: 160, trees: 60, peds: 40, cars: 16, lamps: 16, terrainNear: 8, fog: 1.4 },
  medium: { scale: [0.8, 1.0], dpr: 1.5, shadow: 2048, cascades: 2, shadowFar: 220, ao: false, ssr: false, bloom: true, aa: 'smaa', far: 2600, detail: 260, trees: 120, peds: 80, cars: 24, lamps: 48, terrainNear: 4, fog: 1.0 },
  high: { scale: [0.85, 1.0], dpr: 1.75, shadow: 2048, cascades: 3, shadowFar: 420, ao: true, aoScale: 0.5, ssr: true, ssrScale: 0.5, bloom: true, aa: 'traa', far: 4200, detail: 420, trees: 250, peds: 140, cars: 36, lamps: 128, terrainNear: 4, fog: 0.8 },
  ultra: { scale: [0.75, 1.0], dpr: 2, shadow: 4096, cascades: 4, shadowFar: 800, ao: true, aoScale: 0.75, ssr: true, ssrScale: 0.75, bloom: true, aa: 'traa', far: 6000, detail: 600, trees: 400, peds: 220, cars: 50, lamps: 256, terrainNear: 4, fog: 0.65, motion: true }
};

/* a guess from what the browser tells us; the frame-rate watcher corrects it */
export function detectPreset(info) {
  const ua = navigator.userAgent || '', mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (navigator.maxTouchPoints > 1 && /Mac/.test(ua));
  const mem = navigator.deviceMemory || 8, cores = navigator.hardwareConcurrency || 4;
  /* a drive that ran slow on Auto leaves a lower start for next time */
  let cap = null; try { cap = localStorage.getItem('bloc:city:autocap'); } catch (e) { /* private mode */ }
  const order = ['lite', 'low', 'medium', 'high', 'ultra'], capped = (p) => (cap && order.indexOf(cap) >= 0 && order.indexOf(cap) < order.indexOf(p) ? cap : p);
  if (mobile) return capped(mem >= 6 && cores >= 6 && info.webgpu ? 'medium' : 'low');
  if (cap === 'lite') return 'lite';
  const gpu = (info.gpu || '').toLowerCase(), mac = /Mac/.test(ua), safari = /Safari\//.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox/.test(ua);
  if (/swiftshader|llvmpipe|software/.test(gpu)) return 'low';
  /* Safari hides the GPU name, and on Intel Macs its WebGPU and WebGL run slower than Chrome: start low, the frame-rate watcher handles the rest */
  if (mac && safari) return capped('low');
  /* Intel Macs (Radeon Pro or Intel graphics) and integrated GPUs can't carry the full post stack */
  if (mac && !/apple/.test(gpu)) return capped(/intel|uhd|iris/.test(gpu) ? 'low' : 'medium');
  if (/intel|uhd|iris|adreno|mali/.test(gpu)) return capped('low');
  if (/rtx [2-9]0[6-9]0|rtx [4-9]0[7-9]0|radeon rx [6-9][7-9]|apple m[2-9] (pro|max|ultra)|apple m1 (max|ultra)/.test(gpu)) return capped('high');
  return capped('medium');
}

export async function makeRenderer(canvas, opts) {
  let forceWebGL = opts.forceWebGL || !('gpu' in navigator);
  try { if (localStorage.getItem('bloc:city:gl') === '1') forceWebGL = true; } catch (e) { /* private mode */ }
  let renderer = new THREE.WebGPURenderer({ canvas, antialias: false, powerPreference: 'high-performance', forceWebGL, alpha: false });
  try { await renderer.init(); }
  catch (e) {
    /* a GPU that offers WebGPU but fails to start it gets the WebGL2 path instead */
    if (forceWebGL) throw e;
    try { renderer.dispose(); } catch (x) { /* ignore */ }
    renderer = new THREE.WebGPURenderer({ canvas, antialias: false, powerPreference: 'high-performance', forceWebGL: true, alpha: false });
    await renderer.init();
  }
  const webgpu = !!(renderer.backend && renderer.backend.isWebGPUBackend);
  let gpu = '';
  try {
    if (webgpu && renderer.backend.adapter && renderer.backend.adapter.info) { const i = renderer.backend.adapter.info; gpu = [i.vendor, i.architecture, i.description].join(' '); }
    else { const gl = renderer.backend.gl; const ext = gl && gl.getExtension('WEBGL_debug_renderer_info'); gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ''; }
  } catch (e) { /* not important */ }
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 0.85;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  return { renderer, webgpu, gpu };
}

/* the warm Madrid grade: lifted warm highlights, slightly teal shadows, a gentle S-curve */
function makeLut(size = 32) {
  const data = new Uint8Array(size * size * size * 4);
  const curve = (x) => { const s = x * x * (3 - 2 * x); return x * 0.55 + s * 0.45; };
  for (let b = 0; b < size; b++) for (let g = 0; g < size; g++) for (let r = 0; r < size; r++) {
    let R = r / (size - 1), G = g / (size - 1), B = b / (size - 1);
    const l = 0.2126 * R + 0.7152 * G + 0.0722 * B;
    R = curve(R); G = curve(G); B = curve(B);
    const hi = Math.max(0, l - 0.45) / 0.55, lo = Math.max(0, 0.4 - l) / 0.4;
    R += hi * 0.035 - lo * 0.015; G += hi * 0.012 + lo * 0.004; B += -hi * 0.03 + lo * 0.025;
    const L2 = 0.2126 * R + 0.7152 * G + 0.0722 * B, sat = 1.08;
    R = L2 + (R - L2) * sat; G = L2 + (G - L2) * sat; B = L2 + (B - L2) * sat;
    const i = (b * size * size + g * size + r) * 4;
    data[i] = Math.max(0, Math.min(255, R * 255)); data[i + 1] = Math.max(0, Math.min(255, G * 255)); data[i + 2] = Math.max(0, Math.min(255, B * 255)); data[i + 3] = 255;
  }
  const t = new THREE.Data3DTexture(data, size, size, size);
  t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType; t.minFilter = t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = t.wrapR = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
  return t;
}

export const POST = { motion: uniform(0), grade: uniform(1) };

export function makePipeline(renderer, scene, camera, preset, sunLight) {
  const P = PRESETS[preset];
  /* shadows: hard-edged and cheap on Low */
  if (preset === 'low') renderer.shadowMap.type = THREE.BasicShadowMap;
  if (!P.shadow) { renderer.shadowMap.enabled = false; sunLight.castShadow = false; }
  else sunLight.shadow.mapSize.set(P.shadow, P.shadow);
  sunLight.shadow.bias = -0.0004; sunLight.shadow.normalBias = 0.6;
  if (P.cascades > 1) {
    const cam = sunLight.shadow.camera;
    cam.near = 1; cam.far = 2400; cam.left = -1000; cam.right = 1000; cam.top = 1000; cam.bottom = -1000;
    const csm = new CSMShadowNode(sunLight, { cascades: P.cascades, maxFar: P.shadowFar, mode: 'practical', lightMargin: 300 });
    csm.fade = true;
    sunLight.shadow.shadowNode = csm;
  } else {
    const cam = sunLight.shadow.camera, r = P.shadowFar;
    cam.near = 1; cam.far = 1400; cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r;
  }
  const pipe = new THREE.RenderPipeline(renderer);
  const lut = makeLut();
  let color, depth, vel, prePass = null;
  if (P.ao) {
    prePass = pass(scene, camera);
    prePass.transparent = false;
    prePass.setMRT(mrt({ output: packNormalToRGB(normalView), velocity }));
    prePass.getTexture('output').type = THREE.UnsignedByteType;
    const pNormal = sample((u) => unpackRGBToNormal(prePass.getTextureNode().sample(u)));
    depth = prePass.getTextureNode('depth'); vel = prePass.getTextureNode('velocity');
    const aoPass = ao(depth, pNormal, camera);
    aoPass.resolutionScale = P.aoScale;
    aoPass.radius.value = 0.6; aoPass.thickness.value = 1.2; aoPass.distanceExponent.value = 1.6; aoPass.scale.value = 1.1;
    const scenePass = pass(scene, camera);
    scenePass.contextNode = builtinAOContext(aoPass.getTextureNode().sample(screenUV).r);
    scenePass.setMRT(mrt({ output, mr: vec2(max(metalness, pow(float(1).sub(roughness), 4).mul(0.85)), roughness) }));
    scenePass.getTexture('mr').type = THREE.UnsignedByteType;
    color = scenePass.getTextureNode('output');
    if (P.ssr) {
      const mr = scenePass.getTextureNode('mr');
      const s = ssr(color, depth, pNormal, { metalnessNode: mr.r, roughnessNode: mr.g });
      s.resolutionScale = P.ssrScale; s.maxDistance.value = 0.6; s.thickness.value = 0.02; s.quality.value = preset === 'ultra' ? 0.55 : 0.35; s.blurQuality = 2;
      color = color.add(s.rgb);
    }
  } else {
    const scenePass = pass(scene, camera);
    color = scenePass.getTextureNode('output');
    depth = scenePass.getTextureNode('depth');
  }
  if (P.bloom) color = color.add(bloom(color, preset === 'medium' ? 0.18 : 0.24, 0.55, 1.15));
  if (P.aa === 'traa') color = traa(color, depth, vel, camera);
  pipe.outputColorTransform = false;
  let out = renderOutput(color);
  out = lut3D(out, texture3D(lut), 32, POST.grade);
  if (P.aa === 'smaa') out = smaa(out);
  if (P.aa === 'fxaa') out = fxaa(out);
  pipe.outputNode = out;
  return { pipe, render: () => pipe.render(), preset, P };
}
void emissive; void vec3; void vec4;
