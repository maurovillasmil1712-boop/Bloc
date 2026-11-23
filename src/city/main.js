/* Bloc City v7: boot. The app opens /city/ in a full-screen frame after /api/farm/drive says go and hands over the
   run by postMessage. Opened on its own, the page starts the run itself. ?test=1 runs on made-up data for tests. */
import * as THREE from 'three/webgpu';
import { makeRenderer, makePipeline, detectPreset, PRESETS, POST } from './render/pipeline.js';
import { SkySystem } from './render/sky.js';
import { loadSet, tiersFor, loadIndex, RAW } from './render/textures.js';
import { makePlan, adoptPlan, groundAt } from './world/plan.js';
import { City } from './world/city.js';
import { U } from './render/materials.js';
import { Instancer } from './world/instancer.js';
import { setupTrees } from './world/trees.js';
import { setupProps } from './world/props.js';
import { setupParked } from './world/parked.js';
import { Traffic } from './actors/traffic.js';
import { Crowd } from './actors/crowd.js';
import { Game } from './game/game.js';
import { Audio } from './audio/audio.js';
import { initLang, T } from './game/i18n.js';
import { makeRain } from './render/rain.js';

const Q = new URLSearchParams(location.search);
const TEST = Q.get('test') === '1';
const ui = document.getElementById('bc');
const bar = document.querySelector('.bc-load i'), loadText = document.querySelector('.bc-load span');
function progress(f, text) { if (bar) bar.style.width = Math.round(f * 100) + '%'; if (text && loadText) loadText.textContent = text; }
const tick = () => new Promise((r) => setTimeout(r, 0));
const inFrame = window.parent !== window;
const post = (msg) => { try { window.parent.postMessage(msg, location.origin); } catch (e) { /* closed */ } };

/* ---------- the run: from the app, from the server, or made up ---------- */
function fakeData() {
  return {
    data: { now: Date.now(), run: { id: 'test' }, fuel: +(Q.get('fuel') || 900), car: { id: Q.get('car') || 'hatch' }, color: Q.get('color') ? '#' + Q.get('color') : '#FFE14D',
      homes: [{ id: 'me', name: 'Home', me: true, loc: 'oldtown' }, { id: 'luca', name: 'Luca', loc: 'beach' }, { id: 'sofia', name: 'Sofía', loc: 'ensanche' }],
      drive: { notes: [], crates: [], visits: [] }, jumps: [], cat: null, seed: 'test', coins: 2000,
      look: { skin: '#C98E66', hair: 'curly', hairC: '#1B1714', top: { kind: 'hoodie', c: '#1D1F24' }, bottom: { kind: 'joggers', c: '#7E8288' }, shoes: { kind: 'sneaker', c: '#F4F4F2' }, hat: { kind: 'none', c: '#000000' } } },
    me: 'me', native: Q.get('native') === '1', lang: Q.get('lang')
  };
}
async function startData() {
  if (TEST) return fakeData();
  if (inFrame) {
    return new Promise((res, rej) => {
      const to = setTimeout(() => rej(new Error('No answer from Bloc. Close and try again.')), 15000);
      const on = (e) => { if (e.origin !== location.origin || !e.data || e.data.type !== 'bloc-city-data') return; clearTimeout(to); window.removeEventListener('message', on); res(e.data); };
      window.addEventListener('message', on);
      post({ type: 'bloc-city-ready' });
    });
  }
  const r = await fetch('/api/farm/drive', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-MyIB': '1' }, body: JSON.stringify({ a: 'start' }) });
  if (r.status === 401) { location.href = '/'; throw new Error('Signed out'); }
  const data = await r.json().catch(() => ({}));
  if (r.status !== 200 || !data.run) throw new Error(data.error === 'fuel' ? 'Not enough fuel yet. Study a little to fill the tank.' : 'The drive couldn’t start. Try again in a moment.');
  return { data, me: null, native: false, lang: null, standalone: true };
}
async function sendEnd(start, result) {
  if (TEST) { window.__cityResult = result; return; }
  if (inFrame) { post({ type: 'bloc-city-end', result }); return; }
  const d = start.data;
  await fetch('/api/farm/drive', { method: 'POST', credentials: 'same-origin', keepalive: true, headers: { 'Content-Type': 'application/json', 'X-MyIB': '1' },
    body: JSON.stringify({ a: 'end', run: d.run.id, secs: result.secs, notes: result.notes, crates: result.crates, jumps: result.jumps, visits: result.visits, trial: result.trial, jobs: result.jobs }) }).catch(() => {});
}
/* the plan: in a worker when we can, so the bar keeps moving */
function planInWorker() {
  return new Promise((res) => {
    let w;
    try { w = new Worker(new URL('./plan.js?v=' + __V__, import.meta.url), { type: 'module' }); } catch (e) { res(null); return; }
    const to = setTimeout(() => { w.terminate(); res(null); }, 30000);
    w.onmessage = (e) => { clearTimeout(to); w.terminate(); res(e.data && e.data.plan ? adoptPlan(e.data.plan) : null); };
    w.onerror = () => { clearTimeout(to); w.terminate(); res(null); };
    w.postMessage('go');
  });
}

async function boot() {
  progress(0.02, 'Bloc City');
  const startP = startData();
  const planP = planInWorker();
  const canvas = document.createElement('canvas'); canvas.className = 'bc-gl'; ui.prepend(canvas);
  const { renderer, webgpu, gpu } = await makeRenderer(canvas, { forceWebGL: Q.get('gl') === '1' });
  RAW.on = Q.get('ktx') === 'raw' || /swiftshader|llvmpipe/i.test(gpu) || localStorage.getItem('bloc:city:safe') === '1';
  const start = await startP;
  initLang(start.lang);
  progress(0.05, T('loading'));
  const saved = localStorage.getItem('bloc:city:q');
  const preset = Q.get('preset') || (saved && saved !== 'auto' && PRESETS[saved] ? saved : detectPreset({ webgpu, gpu }));
  const P = PRESETS[preset];
  const scale0 = Q.get('scale') ? +Q.get('scale') : 1;
  const dprBase = Math.min(window.devicePixelRatio || 1, P.dpr);
  renderer.setPixelRatio(dprBase * scale0);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.25, P.far + 4000);
  progress(0.08, T('loading_tex'));
  await loadIndex();
  const tiers = tiersFor(preset);
  if (Q.get('notex') !== '1') await Promise.all(['ground', 'wall', 'roof'].map((g) => loadSet(renderer, g, tiers[0])));
  progress(0.3, T('loading_city'));
  const plan = (await planP) || makePlan();
  await tick();
  const sky = new SkySystem(renderer, scene, preset);
  try { const m = localStorage.getItem('bloc:city:sky'); if (m === 'sunset' || m === 'night') sky.mode = m; } catch (e) { /* ignore */ }
  const city = new City(plan, scene, preset, P);
  if (Q.get('layers')) city.layers = Q.get('layers').split(',');
  if (Q.get('exp')) renderer.toneMappingExposure = +Q.get('exp');
  const pipeline = makePipeline(renderer, scene, camera, preset, sky.light);
  const { fog, densityFogFactor, uniform: un, positionWorld, exp, max: tmax } = await import('three/tsl');
  const fogCol = un(new THREE.Color()), fogDen = un(0.00028 * P.fog);
  scene.fogNode = fog(fogCol, densityFogFactor(fogDen).mul(exp(tmax(positionWorld.y, 0).mul(-0.004))));

  const rain = Q.get('rain') ? +Q.get('rain') : +(start.data.weather || 0);
  U.wet.value = rain; U.rain.value = rain;
  if (rain > 0) makeRain(scene, preset === 'low' ? 2500 : 6000);
  if (Q.get('time')) sky.override = Date.parse(Q.get('time'));

  /* the game: the player's car first, so the city warms up around it */
  const audio = TEST && Q.get('sound') !== '1' ? null : new Audio();
  const game = new Game({ renderer, scene, camera, plan, city, sky, data: start.data, root: ui, lang: start.lang, native: !!start.native, audio, test: TEST });
  const freeCam = Q.get('cam');
  if (Q.get('at')) { const a = Q.get('at').split(',').map(Number); game.car.place(a[0], a[1], a[2] || 0, groundAt(plan, a[0], a[1])); game.safe = { x: a[0], z: a[1], h: a[2] || 0 }; }
  game.car.sync();
  progress(0.4, T('loading_city'));
  const warmAt = new THREE.Vector3(game.car.x, game.car.y, game.car.z);
  if (freeCam) { const c = freeCam.split(',').map(Number); warmAt.set(c[0], 0, c[2]); }
  city.warm(warmAt, +(Q.get('warm') || Math.min(900, P.far * 0.7)));
  await tick();
  /* trees, street furniture, parked cars and traffic, all instanced */
  const inst = new Instancer(scene);
  if (Q.get('trees') !== '0') {
    progress(0.55, T('loading_trees'));
    await Promise.all(['bark', 'leaf'].map((g) => loadSet(renderer, g, tiers[0])));
    setupTrees(renderer, inst, plan, P); await tick();
  }
  /* street furniture streams in after the drive starts (about 11 MB of models), except in tests */
  if (Q.get('props') !== '0') {
    progress(0.65, T('loading_props'));
    const propsP = setupProps(renderer, inst, plan, P, TEST ? (f) => progress(0.65 + f * 0.15) : null).catch((e) => console.warn('props', e));
    if (TEST) await propsP;
  }
  progress(0.82, T('loading_cars'));
  if (Q.get('parked') !== '0') {
    setupParked(inst, plan, P);
    for (const t of inst.types) if (t.id.startsWith('parked-')) for (const cells of t.grid.values()) for (const it of cells) game.world.collide.addBox(it.x, it.z, 0.95, 2.15, -it.r, it.y + 1.6);
  }
  if (Q.get('peds') !== '0' && P.peds > 0) game.crowd = new Crowd(scene, plan, Math.round(P.peds * 0.6));
  if (Q.get('traffic') !== '0' && P.cars > 0) { game.traffic = new Traffic(scene, plan, P.cars); game.traffic.init(game.car.x, game.car.z); game.traffic.buildLights(scene); }
  if (Q.get('view')) game.cam.mode = Q.get('view');
  if (Q.get('plane')) {
    game.toggleCar(); game.foot.place(game.plane.x + 3, game.plane.z, 0); game.enterPlane();
    if (Q.get('plane') === 'air') { const a = (Q.get('pat') || '600,900,-0.9,180').split(',').map(Number); game.plane.place(a[0], a[1], a[2], a[3]); game.plane.ground = false; game.plane.v = 42; game.plane.power = 0.7; }
  }
  /* tests: start on foot, or inside a place */
  if (Q.get('foot') === '1' || Q.get('room')) game.toggleCar();
  if (Q.get('room')) { const d = game.rooms.doors.find((x) => x.id === Q.get('room')); if (d) { game.foot.place(d.x, d.z, d.a, d.y); game.interact(); } }
  progress(0.92, T('loading_light'));
  sky.update(Date.now(), camera.position, rain);
  fogCol.value.copy(sky.fogColor);
  if (Q.get('notex') !== '1') for (const t of tiers.slice(1)) for (const g of ['ground', 'wall', 'roof', 'bark', 'leaf']) loadSet(renderer, g, t).catch(() => {});

  /* ending: report to the app or server, then close on Back */
  game.onEnd = (result) => { sendEnd(start, result); };
  game.onClose = () => { if (inFrame) post({ type: 'bloc-city-close' }); else if (!TEST) location.href = '/#pet'; };
  window.addEventListener('pagehide', () => { if (!game.ended && !TEST) game.finish('exit'); });

  let frames = 0, last = performance.now(), slow = 0, fast = 0, scale = 1, floorT = 0;
  const auto = !Q.get('preset') && !(saved && saved !== 'auto' && PRESETS[saved]);
  const target = matchMedia('(pointer: coarse)').matches ? 1000 / 30 : 1000 / 60;
  window.__city = { renderer, scene, camera, sky, city, plan, preset, webgpu, gpu, game, inst, frames: () => frames, info: () => renderer.info,
    tp: (x, z, h = 0) => { game.car.place(x, z, h, groundAt(plan, x, z)); game.cam.init = false; },
    snap: async () => { pipeline.render(); await renderer.backend.device?.queue?.onSubmittedWorkDone?.(); pipeline.render(); return canvas.toDataURL('image/png'); } };
  window.addEventListener('resize', () => { renderer.setSize(window.innerWidth, window.innerHeight, false); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); });
  progress(1, '');
  document.querySelector('.bc-load').classList.add('gone');
  setTimeout(() => { const l = document.querySelector('.bc-load'); if (l) l.remove(); }, 600);
  if (inFrame) post({ type: 'bloc-city-started' });

  renderer.setAnimationLoop(() => {
    const now = performance.now(), dtMs = Math.min(100, now - last); last = now;
    const dt = TEST && Q.get('dt') ? +Q.get('dt') : dtMs / 1000;
    sky.update(Date.now(), camera.position, rain);
    fogCol.value.copy(sky.fogColor);
    if (freeCam) {
      const c = freeCam.split(',').map(Number), gy = (x, z) => (Q.get('rel') === '0' ? 0 : groundAt(plan, x, z));
      camera.position.set(c[0], c[1] + gy(c[0], c[2]), c[2]); camera.lookAt(c[3], c[4] + gy(c[3], c[5]), c[5]);
    } else {
      game.update(Math.min(dt, 0.05));
      if (audio) audio.car(game.car, game.mode === 'car' ? game.car.input.throttle || 0 : 0, dt);
    }
    const fo = game.focus(); city.update(freeCam ? camera.position : new THREE.Vector3(fo.x, fo.y, fo.z), 3);
    inst.update(camera);
    if (game.traffic) game.traffic.draw();
    pipeline.render();
    frames++;
    /* dynamic resolution: hold the frame rate on phones and laptops */
    if (!TEST && frames > 30) {
      if (dtMs > target * 1.2) { slow++; fast = 0; } else if (dtMs < target * 0.8) { fast++; slow = 0; } else { slow = Math.max(0, slow - 1); fast = Math.max(0, fast - 1); }
      if (slow > 45 && scale > 0.5) { scale = Math.max(0.5, scale - 0.1); renderer.setPixelRatio(dprBase * scale); slow = 0; }
      /* still slow at the smallest size on Auto: start one preset lower next time */
      if (auto && scale <= 0.5 && dtMs > target * 1.2) { floorT += dtMs; if (floorT > 6000) { const lower = { ultra: 'high', high: 'medium', medium: 'low' }[preset]; if (lower) { try { localStorage.setItem('bloc:city:autocap', lower); } catch (e) { /* ignore */ } } floorT = -1e12; } }
      if (fast > 240 && scale < 1) { scale = Math.min(1, scale + 0.1); renderer.setPixelRatio(dprBase * scale); fast = 0; }
    }
  });
  void POST;
}
boot().catch((e) => {
  console.error(e);
  if (loadText) loadText.textContent = (e && e.message) || 'Bloc City couldn’t start.';
  const l = document.querySelector('.bc-load');
  if (l && !l.querySelector('button')) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'bc-btn'; b.textContent = 'Back';
    b.onclick = () => { if (inFrame) post({ type: 'bloc-city-close' }); else location.href = '/#pet'; };
    l.appendChild(b);
  }
  if (inFrame) post({ type: 'bloc-city-error', message: String(e && e.message || e) });
});
