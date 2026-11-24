/* The drive itself: fuel from study, sticky notes, seed crates, stunt ramps, time trials, friends' houses,
   the HUD and maps, and the report the server checks at the end. */
import * as THREE from 'three/webgpu';
import { Vehicle } from '../actors/vehicle.js';
import { ChaseCam } from './camera.js';
import { Input } from './input.js';
import { World } from './world.js';
import { cratePoints, homeLot, MAP, isWater, districtAt, DISTRICTS, sampleHeight, ISLAND, LAKE, RUNWAY, APRON, coastX } from '../world/plan.js';
import { POST } from '../render/pipeline.js';
import { U } from '../render/materials.js';
import { T as TEXT } from './i18n.js';
import { OnFoot, FootCam } from './foot.js';
import { Interiors } from './interiors.js';
import { Sheets } from './sheets.js';
import { Arms } from './arms.js';
import { Missions } from './missions.js';
import { Phone } from './phone.js';
import { route as findRoute, progress as routeProgress } from './route.js';
import { Races } from './races.js';
import { Stunts } from './stunts.js';
import { Talk } from './talk.js';
import { Plane, PlaneCam } from '../actors/plane.js';
import { Human } from '../actors/human.js';
import { Radio } from '../audio/radio.js';
import { Friends } from './friends.js';

function qNow() { let q = null; try { q = localStorage.getItem('bloc:city:q'); } catch (e) { /* ignore */ } return ['lite', 'low', 'medium', 'high', 'ultra'].indexOf(q) >= 0 ? q : 'auto'; }
const fmt = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const fmtMs = (ms) => { const s = ms / 1000, m = Math.floor(s / 60); return m + ':' + (s - m * 60).toFixed(2).padStart(5, '0'); };

export class Game {
  constructor(ctx) {
    Object.assign(this, ctx);           /* renderer, scene, camera, plan, city, sky, data, root, lang, native, audio */
    const d = this.data, cat = d.cat || {};
    this.world = new World(this.plan);
    this.input = new Input(this.root);
    this.cam = new ChaseCam(this.camera);
    const carInfo = d.car || { id: 'hatch' };
    const type = { hatch: 'hatch', buggy: 'buggy', van: 'van', gt: 'gt', moto: 'moto' }[carInfo.id] || carInfo.id || 'hatch';
    this.car = new Vehicle(type, d.color || '#FFE14D', this.world);
    this.scene.add(this.car.group);
    this.result = { v: 7, secs: 0, notes: [], crates: [], jumps: [], visits: [], trial: null, jobs: [] };
    this.fuel = Math.max(0, d.fuel || 0); this.fuel0 = Math.max(1, d.fuel || 1); this.driven = 0; this.coinsRun = 0; this.ended = false; this.paused = false;
    this.notes = this.plan.notes; this.taken = new Set(Array.isArray(d.drive && d.drive.notes) ? d.drive.notes : []);
    this.crates = cratePoints(this.plan, d.seed || 'today', (cat.rules && cat.rules.crateN) || 10);
    this.crateTaken = new Set(Array.isArray(d.drive && d.drive.crates) ? d.drive.crates : []);
    this.trials = (cat.trials && cat.trials.length && cat.trials[0].id.endsWith('7') ? cat.trials : this.plan.trials.map((t) => withTimes(t))).map((t) => Object.assign({}, t));
    this.homes = (d.homes || []).map((h) => { const l = homeLot(this.plan, h.id, h.loc); return Object.assign({}, h, { x: l.x - l.fx * (l.d / 2 + 6), z: l.z - l.fz * (l.d / 2 + 6), lot: l }); });
    this.visited = new Set(this.homes.filter((h) => h.visited).map((h) => h.id));
    this.trial = null; this.trialEnd = -10; this.msgT = 0;
    /* side jobs: today's offer from the server (or the first six in tests) */
    this.jobsAll = cat.jobs && cat.jobs.length ? cat.jobs : this.plan.jobs || [];
    const offer = Array.isArray(d.jobs) ? d.jobs : this.jobsAll.slice(0, 6).map((j) => j.id);
    this.jobs = this.jobsAll.filter((j) => offer.includes(j.id)); this.job = null;
    this.buildMarkers();
    this.buildHud();
    this.startPos();
    this.safe = { x: this.car.x, z: this.car.z, h: this.car.h };
    /* on foot, places to go in, and their panels */
    this.mode = 'car';
    this.foot = new OnFoot(this.world, d.look);
    this.foot.group.visible = false; this.scene.add(this.foot.group);
    if (this.car.moto) this.ride();
    this.fcam = new FootCam(this.camera, this.root);
    this.rooms = new Interiors(this.scene, this.plan, this.homes, this.native);
    this.rooms.pool();
    this.rooms.setFurn(ctx.test ? ['rug', 'neon', 'console', 'plants'] : d.furn);
    { const ds = this.rooms.doors.filter((x) => x.id !== 'flat'); if (ds.length) { const cx = ds.reduce((a, x) => a + x.x, 0) / ds.length, cz = ds.reduce((a, x) => a + x.z, 0) / ds.length; const near = ds.reduce((b, x) => (Math.hypot(x.x - cx, x.z - cz) < Math.hypot(b.x - cx, b.z - cz) ? x : b)); this.startPos(near.x, near.z); this.safe = { x: this.car.x, z: this.car.z, h: this.car.h }; } }
    let mz0 = 3; try { mz0 = +localStorage.getItem('bloc:city:mz') || 3; } catch (e) { /* private mode */ }
    this.mz = mz0; this.wp = null; this.route = null; this.routeT = 0;
    let mh = ''; try { mh = localStorage.getItem('bloc:city:maphide') || ''; } catch (e) { /* private mode */ }
    this.mapHide = new Set(mh ? mh.split(',') : []);
    this.coins = typeof d.coins === 'number' ? d.coins : (ctx.test ? 5000 : 0);
    this.car.own = true; this.parked = []; this.mods = d.mods || (ctx.test ? { spoiler: true, glow: '#7CE3FF', rims: 'gold', tint: true } : {}); this.car.setMods(this.mods);
    this.missions = new Missions(this);
    this.races = new Races(this); this.stunts = new Stunts(this);
    if (this.crowd) this.crowd.native = this.native;
    this.phone = new Phone(this);
    this.sheets = new Sheets(this, !!ctx.test);
    this.arms = new Arms(this);
    this.talk = new Talk(this); this.remarkT = 4; this.timeScale = 1;
    if (!ctx.test) this.friends = new Friends(this);
    /* the radio and its wheel: hold Q (or tap Radio), pick a station, let go */
    if (this.audio) {
      this.radio = new Radio(this.audio, this.native);
      this.radio.onTrack = (title) => { if (this.mode !== 'foot') this.say(this.radio.stationName(this.radio.cur), title); };
      window.addEventListener('keydown', (e) => { if (e.code === 'KeyQ' && !e.repeat && !this.wheel) { e.preventDefault(); this.openWheel(); } }, true);
      window.addEventListener('keyup', (e) => { if (e.code === 'KeyQ' && this.wheel) { e.preventDefault(); this.closeWheel(true); } }, true);
    }
    /* the flight-school plane waits on the airport apron */
    this.plane = new Plane(this.world, d.plane && d.plane.own ? d.plane : null); this.planeHome = { x: 1210, z: 1590, yaw: 0 };
    this.plane.place(this.planeHome.x, this.planeHome.z, this.planeHome.yaw, sampleHeight(this.plan.height, this.planeHome.x, this.planeHome.z));
    this.scene.add(this.plane.group); this.pcam = new PlaneCam(this.camera);
    this.input.on('KeyM', () => this.toggleMap());
    this.input.on('KeyV', () => this.nextView());
    this.input.on('KeyF', () => this.toggleCar());
    this.input.on('KeyE', () => this.interact());
    this.input.on('KeyJ', () => this.punch());
    this.input.on('Escape', () => { if (performance.now() - (this.unlockAt || -1e9) < 450) return; if (this.phone && this.phone.photo) this.phone.photoEnd(); else if (this.phone && this.phone.el) this.phone.close(); else if (this.talk.convo) this.talk.cancel(); else if (this.sheets.el) this.sheets.close(); else if (this.mapOpen) this.toggleMap(); else this.finish('exit'); });
    this.root.addEventListener('pointerup', () => setTimeout(() => { if (this.fcam.clicked && this.mode === 'foot') { this.fcam.clicked = false; if (performance.now() - (this.lockClickAt || -1e9) > 700) this.punch(); } }, 0));
    this.input.on('KeyN', () => this.cycleSky());
    this.mouseLook();
    /* minimap zoom: + and - (and the two buttons on the map), remembered */
    const zoomBy = (k) => { this.mz = Math.max(1, Math.min(9, this.mz * (k > 0 ? 1.3 : 1 / 1.3))); try { localStorage.setItem('bloc:city:mz', String(this.mz)); } catch (e) { /* private mode */ } };
    for (const c of ['Equal', 'NumpadAdd']) this.input.on(c, () => zoomBy(1));
    for (const c of ['Minus', 'NumpadSubtract']) this.input.on(c, () => zoomBy(-1));
    this.ui.el.querySelector('.bc-mz').addEventListener('click', (e) => { const b = e.target.closest('[data-z]'); if (b) { e.stopPropagation(); zoomBy(+b.dataset.z); } });
    /* the big map: tap or click to set a waypoint, tap it again to clear it; the legend switches pins on and off */
    const mc = this.ui.map.querySelector('canvas');
    mc.addEventListener('click', (e) => {
      const r = mc.getBoundingClientRect(), img = this.mapImg, cx = (e.clientX - r.left) / r.width * mc.width, cy = (e.clientY - r.top) / r.height * mc.height;
      const x = cx / img.s + MAP.x0, z = cy / img.s + MAP.z0;
      if (this.wp && Math.hypot(this.wp.x - x, this.wp.z - z) < 60) this.setWaypoint(null); else this.setWaypoint({ x, z });
      this.drawBigMap();
    });
    this.ui.map.querySelector('.bc-legend').addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (!b) return; e.stopPropagation(); const f = b.dataset.f; this.mapHide.has(f) ? this.mapHide.delete(f) : this.mapHide.add(f); try { localStorage.setItem('bloc:city:maphide', [...this.mapHide].join(',')); } catch (err) { /* private mode */ } this.drawBigMap(); });
  }
  startPos(tx, tz) {
    /* v7.4: start in the middle of the shops (café, clothes, range, gym, garage), not at home */
    let x = tx != null ? tx : -720, z = tz != null ? tz : -920;
    /* nearest road point, facing along it */
    let best = null, bd = 1e9;
    for (const e of this.plan.edges) {
      if (e.bridge || e.kind === 'ronda' || e.kind === 'service') continue;
      for (let i = 0; i < e.dense.length - 1; i += 1) { const p = e.dense[i], d = Math.hypot(p[0] - x, p[1] - z) + (e.kind === 'lane' ? 12 : 0); if (d < bd) { bd = d; best = { e, i }; } }
    }
    if (best) {
      const p = best.e.dense[best.i], q = best.e.dense[best.i + 1], h = Math.atan2(q[0] - p[0], q[1] - p[1]), off = Math.min(1.8, best.e.w / 4);
      x = p[0] - Math.cos(h) * off; z = p[1] + Math.sin(h) * off;
      this.car.place(x, z, h, sampleHeight(this.plan.height, x, z));
    } else this.car.place(x, z, 0, sampleHeight(this.plan.height, x, z));
  }
  buildMarkers() {
    const S = this.scene;
    /* sticky notes: small yellow squares that spin */
    this.noteMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 1.1, 0.06), new THREE.MeshStandardNodeMaterial({ color: '#FFE14D', emissive: '#FFE14D', emissiveIntensity: 0.6, roughness: 0.6 }), this.notes.length);
    this.noteMesh.frustumCulled = false; S.add(this.noteMesh);
    /* seed crates with a beam of light */
    const crateMat = new THREE.MeshStandardNodeMaterial({ color: '#B98450', roughness: 0.8 });
    this.crateMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 1.3, 1.3), crateMat, this.crates.length); this.crateMesh.frustumCulled = false; S.add(this.crateMesh);
    const beam = new THREE.CylinderGeometry(1.1, 1.1, 80, 12, 1, true).translate(0, 40, 0);
    const beamMat = new THREE.MeshBasicNodeMaterial({ color: '#FFE14D', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
    this.beams = new THREE.InstancedMesh(beam, beamMat, this.crates.length + this.homes.length); this.beams.frustumCulled = false; S.add(this.beams);
    /* stunt ramps: yellow and ink stripes */
    const rampMat = new THREE.MeshStandardNodeMaterial({ color: '#FFE14D', roughness: 0.6 });
    for (const r of this.world.ramps) {
      const g = rampGeo(r.len, r.h, r.w), m = new THREE.Mesh(g, rampMat);
      m.position.set(r.x, sampleHeight(this.plan.height, r.x, r.z) + 0.02, r.z); m.rotation.y = r.dir; m.castShadow = true; m.receiveShadow = true; S.add(m);
    }
    /* trials: a flat ring at each start, a standing ring for the next checkpoint */
    this.trialRings = this.trials.map((t) => { const m = new THREE.Mesh(new THREE.RingGeometry(6.2, 7.6, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicNodeMaterial({ color: '#FFE14D', transparent: true, opacity: 0.85, side: THREE.DoubleSide })); m.position.set(t.pts[0][0], sampleHeight(this.plan.height, t.pts[0][0], t.pts[0][1]) + 0.12, t.pts[0][1]); S.add(m); return m; });
    this.cp = new THREE.Mesh(new THREE.TorusGeometry(7, 0.4, 10, 48), new THREE.MeshStandardNodeMaterial({ color: '#FFE14D', emissive: '#FFE14D', emissiveIntensity: 1.2 })); this.cp.visible = false; S.add(this.cp);
    const jb = new THREE.CylinderGeometry(0.9, 0.9, 60, 12, 1, true).translate(0, 30, 0);
    this.jobBeams = new THREE.InstancedMesh(jb, new THREE.MeshBasicNodeMaterial({ color: '#7CE3FF', transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }), 8);
    this.jobBeams.frustumCulled = false; S.add(this.jobBeams);
    this.placeCrates();
  }
  placeJobs() {
    const M = new THREE.Matrix4(); let i = 0;
    if (this.job) { const b = this.job.j.b; M.makeTranslation(b[0], sampleHeight(this.plan.height, b[0], b[1]), b[1]); this.jobBeams.setMatrixAt(i++, M); }
    else for (const j of this.jobs) { if (this.result.jobs.some((r) => r.id === j.id)) continue; M.makeTranslation(j.a[0], sampleHeight(this.plan.height, j.a[0], j.a[1]), j.a[1]); this.jobBeams.setMatrixAt(i++, M); }
    this.jobBeams.count = i; this.jobBeams.instanceMatrix.needsUpdate = true;
  }
  placeCrates() {
    const M = new THREE.Matrix4();
    this.crates.forEach((p, i) => {
      const gone = this.crateTaken.has(i);
      M.makeTranslation(p.x, gone ? -500 : p.y + 0.7, p.z); this.crateMesh.setMatrixAt(i, M);
      M.makeTranslation(p.x, gone ? -500 : p.y, p.z); this.beams.setMatrixAt(i, M);
    });
    this.homes.forEach((h, i) => { M.makeTranslation(h.x, sampleHeight(this.plan.height, h.x, h.z), h.z); M.scale(new THREE.Vector3(1.3, 0.5, 1.3)); this.beams.setMatrixAt(this.crates.length + i, M); });
    this.crateMesh.instanceMatrix.needsUpdate = true; this.beams.instanceMatrix.needsUpdate = true;
  }
  /* ---------- HUD ---------- */
  buildHud() {
    const r = this.root, t = TEXT, coarse = matchMedia('(pointer: coarse)').matches;
    const el = document.createElement('div'); el.className = 'bc-hud';
    el.innerHTML =
      `<div class="bc-top"><div class="bc-panel bc-fuel"><b class="bc-f">0:00</b><span class="bc-sub">${t('fuel')}</span><div class="bc-bar"><i></i></div></div>` +
      `<div class="bc-btns"><button type="button" class="bc-btn" data-k="view">${t('view')}</button><button type="button" class="bc-btn" data-k="sky">${t('sky_live')}</button><button type="button" class="bc-btn" data-k="q">${t('quality')}: ${t('q_' + qNow())}</button><button type="button" class="bc-btn" data-k="radio">${t('radio')}</button><button type="button" class="bc-btn" data-k="map">${t('map')}</button><button type="button" class="bc-btn x" data-k="exit">${t('done')}</button></div></div>` +
      `<canvas class="bc-mini" width="320" height="320" aria-hidden="true"></canvas><div class="bc-mz"><button type="button" data-z="1" aria-label="${t('zoom_in')}">+</button><button type="button" data-z="-1" aria-label="${t('zoom_out')}">−</button></div><div class="bc-place"></div><div class="bc-coins"></div><div class="bc-wp" hidden></div><div class="bc-edge" hidden></div>` +
      `<div class="bc-trial" hidden></div><div class="bc-msg"></div><button type="button" class="bc-act" data-k="act" hidden></button>` +
      `<div class="bc-speed"><b>0</b><span>km/h</span></div>` +
      `<div class="bc-touch${coarse ? ' on' : ''}"><div class="bc-pad"><button type="button" class="bc-key" data-in="left" aria-label="${t('left')}">◀</button><button type="button" class="bc-key" data-in="right" aria-label="${t('right')}">▶</button></div>` +
      `<div class="bc-pad"><button type="button" class="bc-key small" data-in="hand">${t('drift')}</button><button type="button" class="bc-key" data-in="down" aria-label="${t('brake')}">▼</button><button type="button" class="bc-key" data-in="up" aria-label="${t('gas')}">▲</button></div></div>` +
      `<div class="bc-map"><canvas></canvas><div class="bc-legend"></div><p>${t('map_hint2')}</p></div><div class="bc-fade"></div>`;
    r.appendChild(el);
    const $ = (s) => el.querySelector(s);
    this.ui = { wp: $('.bc-wp'), edge: $('.bc-edge'), el, fuel: $('.bc-f'), sub: $('.bc-sub'), bar: $('.bc-bar i'), speed: $('.bc-speed b'), msg: $('.bc-msg'), trial: $('.bc-trial'), mini: $('.bc-mini'), map: $('.bc-map'), fade: $('.bc-fade'), place: $('.bc-place'), sky: $('[data-k="sky"]'), act: $('.bc-act'), speedBox: $('.bc-speed') };
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-k]'); if (!b) return;
      const k = b.dataset.k;
      if (k === 'exit') this.finish('exit'); else if (k === 'map') this.toggleMap(); else if (k === 'view') this.nextView(); else if (k === 'act') this.contextAct(); else if (k === 'radio') { if (this.wheel) this.closeWheel(false); else this.openWheel(); } else if (k === 'sky') this.cycleSky(); else if (k === 'q') this.cycleQuality(b);
    });
    this.ui.map.addEventListener('click', () => this.toggleMap());
    this.labels = this.homes.map((h) => { const d = document.createElement('div'); d.className = 'bc-label' + (h.me ? ' home' : ''); d.textContent = h.me ? t('home') : h.name; el.appendChild(d); return d; });
    this.trialLabels = this.trials.map((tr) => { const d = document.createElement('div'); d.className = 'bc-label'; d.textContent = tr.name; el.appendChild(d); return d; });
    this.mapImg = drawMapImage(this.plan, 1.25);
    this.say('Bloc City', coarse ? t('hint_touch') : t('hint_keys'));
  }
  cycleQuality(b) {
    const order = ['auto', 'lite', 'low', 'medium', 'high', 'ultra'], next = order[(order.indexOf(qNow()) + 1) % order.length];
    try { localStorage.setItem('bloc:city:q', next); if (next === 'auto') localStorage.removeItem('bloc:city:autocap'); } catch (e) { /* ignore */ }
    b.textContent = TEXT('quality') + ': ' + TEXT('q_' + next);
    this.say(TEXT('quality') + ': ' + TEXT('q_' + next), TEXT('q_next'));
  }
  cycleSky() {
    const modes = ['live', 'sunset', 'night'], i = (modes.indexOf(this.sky.mode) + 1) % 3;
    this.sky.mode = modes[i]; this.sky.lastEnv = -1e9;
    try { localStorage.setItem('bloc:city:sky', modes[i]); } catch (e) { /* ignore */ }
    this.ui.sky.textContent = TEXT('sky_' + modes[i]);
  }
  say(big, small) {
    const m = this.ui.msg; m.textContent = '';
    const b = document.createElement('b'); b.textContent = big; m.appendChild(b);
    if (small) { const s = document.createElement('small'); s.textContent = small; m.appendChild(s); }
    m.classList.add('on'); this.msgT = 2.8;
  }
  toggleMap() { this.mapOpen = !this.mapOpen; this.ui.map.classList.toggle('on', this.mapOpen); if (this.audio) this.audio.duck(this.mapOpen); if (this.mapOpen) this.drawBigMap(); }
  /* ---------- the frame ---------- */
  update(dt) {
    if (this.ended) return;
    if (this.rooms) this.rooms.update(dt);
    if (this.mapOpen || this.paused) { if (this.mode === 'foot') this.foot.sync(dt); return; }
    this.driven += dt; this.fuel -= dt;
    this.world.wet = U.wet.value;
    if (this.radio && this.audio.ctx) { const v = this.mode !== 'foot' && !this.rooms.inside; if (v !== this.radio.inVehicle || !this.radio.bus) this.radio.setVehicle(v); }
    if (this.mode === 'car') this.updateCar(dt); else if (this.mode === 'plane') this.updatePlane(dt); else this.updateFoot(dt);
    if (this.arms) this.arms.update(dt);
    if (this.missions) this.missions.update(dt);
    if (this.races) this.races.update(dt);
    /* far-away things off: each is a draw call or fifty (Rosa alone is 54 meshes), which is what slows Safari on older Macs */
    if ((this.cullT = (this.cullT || 0) - dt) <= 0) {
      this.cullT = 0.4; const me = this.me(), far = (x, z, r) => Math.abs(x - me.x) > r || Math.abs(z - me.z) > r;
      this.trialRings.forEach((m, i) => { m.visible = !far(m.position.x, m.position.z, 450); });
      if (this.plane && this.mode !== 'plane') this.plane.group.visible = !far(this.plane.x, this.plane.z, 700);
      else if (this.plane) this.plane.group.visible = true;
      if (this.missions && this.missions.rosaH) this.missions.rosaH.group.visible = !this.rooms.inside && !far(this.missions.rosa.x, this.missions.rosa.z, 90);
    }
    if (this.stunts) this.stunts.update(dt);
    this.routeTick(dt);
    /* a bus at its stop near you: the driver announces it */
    if (this.traffic && !this.rooms.inside) { const me = this.me(); for (const c of this.traffic.cars) if (c.busStop && c.mode === 'stop' && !c.announced && Math.hypot(c.x - me.x, c.z - me.z) < 26) { c.announced = true; setTimeout(() => { c.announced = false; }, 20000); this.talk.say({ x: c.x, z: c.z }, this.talk.pick('bus'), { name: TEXT('bus_driver') }); } }
    this.updateCrowd(dt);
    if (this.police && !this.rooms.inside) this.police.update(dt);
    if (this.friends) this.friends.update(dt);
    this.pickups();
    this.prompt();
    this.hud(dt);
    if (this.fuel <= 0) this.finish('fuel');
  }
  updateCrowd(dt) {
    const C = this.crowd; if (!C) return;
    if (this.rooms.inside) { if (!C.hidden) { for (const p of C.parts) p.m.count = 0; C.hidden = true; } return; }
    C.hidden = false;
    const car = this.car, T2 = this.talk;
    const me = this.mode === 'foot' ? { x: this.foot.x, z: this.foot.z } : null;
    const drive = this.mode === 'car' ? { x: car.x, z: car.z, vx: car.vx, vz: car.vz, speed: car.speed } : null;
    C.update(dt, me, drive, {
      scared: (p) => T2.remark(p, 'dodge'), bump: (p) => T2.remark(p, 'bump'), pair: (a, b) => T2.pair(a, b),
      hit: (p, sp) => { this.cam.shake = Math.min(0.3, sp / 40); if (this.audio) this.audio.hit(sp * 0.5); if (this.police) this.police.crime(p.dead ? 'kill' : 'hit', p.x, p.z); if (p.dead) { this.deathNear(p); if (this.arms) this.arms.pool(p); } },
      up: (p) => T2.say(p, T2.pick('up', p.voice)),
      taunt: (p) => T2.say(p, T2.pick('fight_taunt', p.voice)),
      meNow: () => this.me(),
      punchPlayer: (p) => this.hurt(12, p)
    });
    C.draw(dt, this.camera);
    /* now and then someone nearby says something */
    this.remarkT -= dt;
    if (this.remarkT <= 0 && this.mode === 'foot') {
      this.remarkT = 5 + Math.random() * 6;
      const p = C.nearest(this.foot.x, this.foot.z, 6);
      if (p && p.state === 'walk') {
        const night = this.sky.state && this.sky.state.night > 0.5, rain = U.rain.value > 0.2;
        const r = Math.random(), look = this.data.look || {}, fancy = look.top && ['jacket'].includes(look.top.kind) || look.shoes && look.shoes.c === '#D4A93C';
        const cat = rain && r < 0.3 ? 'weather_rain' : night && r < 0.25 ? 'weather_night' : fancy && r < 0.12 ? 'outfit' : r < 0.32 ? 'greet' : r < 0.52 ? 'mutter' : r < 0.66 ? 'study' : r < 0.82 ? 'phone' : r < 0.92 ? 'tourist' : 'vendor';
        T2.remark(p, cat);
      }
    }
  }
  /* where the world should stream and traffic should gather: you, or the door you went in by */
  focus() {
    if (this.rooms.inside) { const d = this.rooms.inside.door; return { x: d.x, y: d.y, z: d.z }; }
    if (this.mode === 'plane') return { x: this.plane.x, y: this.plane.y, z: this.plane.z };
    return this.mode === 'car' ? { x: this.car.x, y: this.car.y, z: this.car.z } : { x: this.foot.x, y: this.foot.y, z: this.foot.z };
  }
  stepCar(dt, input) {
    const car = this.car;
    car.input = input;
    this.world.h = car.h;
    const sub = Math.max(1, Math.ceil(dt / (1 / 120)));
    for (let k = 0; k < sub; k++) car.step(dt / sub);
  }
  updateCar(dt) {
    const car = this.car;
    this.stepCar(dt, this.input.car());
    /* other cars push back */
    if (this.traffic) {
      const myR = car.T.moto ? 0.9 : 1.85;
      for (const v of this.parked) { const dx = car.x - v.x, dz = car.z - v.z, d = Math.hypot(dx, dz), R = myR + 1.8; if (d < R && d > 0.01) { const nx = dx / d, nz = dz / d; car.x += nx * (R - d); car.z += nz * (R - d); const vn = car.vx * nx + car.vz * nz; if (vn < 0) { car.vx -= 1.1 * vn * nx; car.vz -= 1.1 * vn * nz; car.damage(nx, nz, -vn); } } }
      for (const o of this.traffic.near(car.x, car.z, 10)) for (const [ox, oz, orr] of this.traffic.circles(o)) {
        const dx = car.x - ox, dz = car.z - oz, d = Math.hypot(dx, dz), R = myR + orr;
        if (d < R && d > 0.01) { const nx = dx / d, nz = dz / d, pen = R - d; car.x += nx * pen; car.z += nz * pen; const vn = car.vx * nx + car.vz * nz; if (vn < 0) { car.damage(nx, nz, -vn); car.vx -= 1.1 * vn * nx; car.vz -= 1.1 * vn * nz; car.vx *= 0.9; car.vz *= 0.9; if (-vn > 4) { this.cam.shake = Math.min(0.3, -vn / 45); if (this.audio) { this.audio.hit(-vn); this.audio.honk(); } this.talk.remark({ x: o.x, z: o.z, voice: Math.random() < 0.5 ? 'f' : 'm', i: null }, o.type === 'police' ? 'cop_chase' : o.type === 'moto' ? 'biker' : o.type === 'bus' ? 'bus' : 'rage'); if (o.type === 'police' && this.police) this.police.crime('ram', car.x, car.z); } } o.v = 0; }
      }
      this.traffic.update(dt, { x: car.x, z: car.z, forwardSpeed: car.vf });
    }
    if (car.lastHit > 4) { this.cam.shake = Math.min(0.35, car.lastHit / 40); if (this.audio) this.audio.hit(car.lastHit); car.lastHit = 0; }
    if (car.landed) { if (car.landed > 0.9) this.jumped(car.landed); car.landed = 0; this.cam.shake = 0.25; }
    /* the sea: back to the last safe road */
    if (!car.air && this.world.inWater(car.x, car.z, car.y)) {
      this.ui.fade.classList.add('on');
      car.place(this.safe.x, this.safe.z, this.safe.h, sampleHeight(this.plan.height, this.safe.x, this.safe.z));
      this.say(TEXT('splash'), TEXT('back_on_road'));
      setTimeout(() => this.ui.fade.classList.remove('on'), 380);
    } else if (!car.air && Math.abs(car.vf || 0) > 2 && this.world.surface(car.x, car.z, car.y).road) this.safe = { x: car.x, z: car.z, h: car.h };
    car.sync();
    if (this.riding) this.ridePose(dt);
    this.smoke(dt);
    this.cam.update(dt, car, (x, z) => sampleHeight(this.plan.height, x, z));
    POST.motion.value = Math.max(0, Math.min(1, (car.speed - 22) / 30));
  }
  updateFoot(dt) {
    const f = this.foot, car = this.car;
    /* the parked car settles with the handbrake on */
    /* the empty car rolls on and slows down by itself; the handbrake only goes on once it has nearly stopped */
    /* the empty car glides to a stop in a second or two: handbrake on, speed bleeding off, never into reverse */
    if (!this.rooms.inside) { this.stepCar(dt, { throttle: 0, brake: 0, steer: 0, hand: car.speed < 1.5 ? 1 : 0 }); const k = Math.exp(-dt * (car.speed > 3 ? 0.9 : 2.5)); car.vx *= k; car.vz *= k; if (car.speed < 0.15) { car.vx = 0; car.vz = 0; } car.sync(); }
    const obstacles = [];
    if (!this.rooms.inside) {
      const fx = Math.sin(car.h), fz = Math.cos(car.h);
      for (const o of [-1.3, 0, 1.3]) obstacles.push({ x: car.x + fx * o, z: car.z + fz * o, r: 0.95 });
      if (this.traffic) for (const o of this.traffic.near(f.x, f.z, 9)) for (const [ox, oz, orr] of this.traffic.circles(o)) obstacles.push({ x: ox, z: oz, r: orr });
      for (const v of this.parked) { const fx2 = Math.sin(v.h), fz2 = Math.cos(v.h); for (const o of [-1.3, 0, 1.3]) obstacles.push({ x: v.x + fx2 * o, z: v.z + fz2 * o, r: 0.95 }); }
      if (this.traffic) this.traffic.update(dt, { x: f.x, z: f.z, forwardSpeed: 0 });
    }
    const touch = this.ui.el.querySelector('.bc-touch.on') != null;
    const res = f.step(dt, this.jack ? {} : this.input.k, this.fcam.yaw, obstacles, touch);
    if (res === 'water') {
      this.ui.fade.classList.add('on');
      const sf = f.safe || { x: car.x + 2, z: car.z, a: car.h };
      f.place(sf.x, sf.z, sf.a); this.say(TEXT('splash'), TEXT('back_on_land'));
      setTimeout(() => this.ui.fade.classList.remove('on'), 380);
    }
    if (this.koT > 0) this.koT -= dt;
    if (this.jack) this.jackTick(dt);
    if (this.bout) this.boutTick(dt);
    if (this.hp != null && this.hp < 100 && !this.bout && this.koT <= 0) this.hp = Math.min(100, this.hp + dt * 4);
    f.guard = !!this.bout || (this.crowd && this.crowd.people.some((p) => p.state === 'fight' && Math.hypot(p.x - f.x, p.z - f.z) < 4));
    f.sync(dt);
    if (this.arms) this.arms.pose();
    this.fcam.update(dt, f, (x, z, y) => {
      if (this.rooms.inside) { const r = this.rooms.inside.room; return Math.abs(x - r.o.x) > r.W / 2 - 0.2 || Math.abs(z - r.o.z) > r.D / 2 - 0.2 || y > r.o.y + r.h - 0.2; }
      const p = { x, z }; return this.world.collide.resolve(p, 0.2, y, { x: 0, z: 0 }) > 0;
    });
    POST.motion.value = 0;
  }
  /* a damaged engine smokes: grey puffs from the bonnet, darker as it gets worse */
  smoke(dt) {
    const car = this.car;
    if (!this.puffs) {
      const g = new THREE.SphereGeometry(0.35, 8, 6), m = new THREE.MeshBasicNodeMaterial({ color: '#6E6E6E', transparent: true, opacity: 0.35, depthWrite: false });
      this.puffs = { mesh: new THREE.InstancedMesh(g, m, 40), list: [], t: 0 }; this.puffs.mesh.frustumCulled = false; this.puffs.mesh.count = 0; this.scene.add(this.puffs.mesh);
    }
    const P = this.puffs;
    if (car.dmg > 0.45) {
      P.t -= dt;
      if (P.t <= 0 && P.list.length < 40) {
        P.t = 0.12 / car.dmg;
        const fx = Math.sin(car.h), fz = Math.cos(car.h);
        P.list.push({ x: car.x + fx * car.T.L * 0.32, y: car.y + car.T.H * 0.75, z: car.z + fz * car.T.L * 0.32, a: 0, s: 0.4 });
      }
    }
    const M = this._pm || (this._pm = new THREE.Matrix4()); let n = 0;
    P.list = P.list.filter((q) => (q.a += dt) < 2.2);
    for (const q of P.list) { q.y += dt * 1.1; q.s += dt * 0.9; M.makeScale(q.s, q.s, q.s); M.setPosition(q.x, q.y, q.z); P.mesh.setMatrixAt(n++, M); }
    P.mesh.count = n; P.mesh.instanceMatrix.needsUpdate = true;
  }
  updatePlane(dt) {
    const P = this.plane, k = this.input.k, raw = this.input.raw, touch = this.ui.el.querySelector('.bc-touch.on') != null;
    const keys = touch ? k : { up: raw.KeyW, down: raw.KeyS, left: k.left, right: k.right, hand: k.hand };
    const pitchIn = touch ? (k.up ? 1 : 0) - (k.down ? 1 : 0) : (raw.ArrowUp ? 1 : 0) - (raw.ArrowDown ? 1 : 0);
    const res = P.step(dt, keys, pitchIn, touch);
    if (res === 'crash') {
      this.ui.fade.classList.add('on'); this.say(TEXT('crash'), TEXT('crash_sub')); if (this.audio) this.audio.hit(25);
      const h = this.planeHome; P.place(h.x, h.z, h.yaw, sampleHeight(this.plan.height, h.x, h.z));
      this.leavePlane(true);
      setTimeout(() => this.ui.fade.classList.remove('on'), 500);
      return;
    }
    if (this.wasGround !== P.ground) { if (this.wasGround != null && Math.random() < 0.8) this.talk.say(null, this.talk.pick('atc'), { name: TEXT('tower') }); this.wasGround = P.ground; }
    if (this.traffic) this.traffic.update(dt, { x: P.x, z: P.z, forwardSpeed: 0 });
    this.pcam.update(dt, P);
    if (this.audio) this.audio.car({ vf: P.v * 0.6, p: { top: 45 }, air: !P.ground, vl: 0 }, P.power, dt);
  }
  enterPlane() {
    this.mode = 'plane'; this.foot.group.visible = false; this.fcam.active = false; this.pcam.init = false;
    this.say(TEXT(this.plane.own ? 'own_plane' : 'plane'), TEXT(this.ui.el.querySelector('.bc-touch.on') ? 'plane_touch' : 'plane_keys'));
    if (this.audio) this.audio.duck(false);
  }
  leavePlane(crashed) {
    const P = this.plane, fx = Math.cos(P.yaw), fz = -Math.sin(P.yaw);
    this.foot.place(P.x + fx * 3, P.z + fz * 3, P.yaw);
    this.mode = 'foot'; this.foot.group.visible = true; this.fcam.active = true; this.fcam.init = false; this.fcam.placed = false; this.fcam.yaw = P.yaw;
    this.camera.up.set(0, 1, 0);
    if (!crashed && this.audio) this.audio.duck(true);
  }
  nextView() {
    if (this.mode === 'car') this.say(TEXT('view_' + this.cam.next()));
    else this.say(TEXT('view_' + this.fcam.next()));
  }
  /* F: get out of the car or back in */
  toggleCar() {
    if (this.sheets.el || this.rooms.inside) return;
    if (this.mode === 'plane') { if (this.plane.ground && this.plane.v < 3) this.leavePlane(); else this.say(TEXT('land_first')); return; }
    const car = this.car, f = this.foot;
    if (this.mode === 'car') {
      if (car.speed > 17) { this.say(TEXT('slow_down')); return; }
      /* step out on the driver's side, or the other side if that's blocked */
      const lx = Math.cos(car.h), lz = -Math.sin(car.h);
      let px = car.x + lx * 1.5, pz = car.z + lz * 1.5;
      const test = { x: px, z: pz };
      if (this.world.collide.resolve(test, 0.4, car.y + 0.9, { x: 0, z: 0 }) > 0.05) { px = car.x - lx * 1.5; pz = car.z - lz * 1.5; }
      this.unride();
      /* jumping out of a moving car: you roll on the road, the car keeps going */
      if (car.speed > 5) { const k = Math.min(1, car.speed / 17); px += car.vx * 0.12; pz += car.vz * 0.12; this.cam.shake = 0.25 * k; if (this.audio) this.audio.hit(4 + k * 6); this.koT = 0; setTimeout(() => this.hurt(Math.round(k * 12), null), 50); }
      f.place(px, pz, car.h);
      this.mode = 'foot'; f.group.visible = true; this.fcam.active = true; this.fcam.init = false; this.fcam.placed = false; this.fcam.yaw = car.h;
      if (this.audio) this.audio.duck(true);
    } else {
      if (this.jack) { this.jackPress(); return; }
      if (Math.hypot(f.x - car.x, f.z - car.z) > 3.6) {
        /* one of your parked cars, or someone else's */
        const mine = this.parked.find((v) => Math.hypot(f.x - v.x, f.z - v.z) < 3.6);
        if (mine) { this.swapTo(mine); return; }
        const c = this.jackable(); if (c) { this.jackStart(c); return; }
        const pk = this.parkedNear(); if (pk) { this.stealParked(pk); return; }
        this.say(TEXT('too_far'), TEXT('find_car')); return;
      }
      this.mode = 'car'; f.group.visible = false; this.fcam.active = false; this.cam.init = false;
      if (car.moto) this.ride();
      this.camera.fov = 60; this.camera.updateProjectionMatrix();
      if (this.audio) this.audio.duck(false);
    }
  }
  /* ---------- mouse look (v7.9): pointer lock on computers ---------- */
  mouseLook() {
    const root = this.root, coarse = matchMedia('(pointer: coarse)').matches;
    if (coarse || !root.requestPointerLock) return;
    let sens = 1; try { sens = +localStorage.getItem('bloc:city:sens') || 1; } catch (e) { /* private mode */ }
    this.fcam.sens = sens; this.lockable = true;
    const busy = () => this.ended || this.mapOpen || this.wheel || (this.arms && this.arms.wheel) || this.sheets.el || (this.phone && (this.phone.el || this.phone.photo)) || this.talk.convo;
    root.addEventListener('mousedown', (e) => {
      if (document.pointerLockElement || busy() || e.target.closest('button, a, input, [data-in], .bc-sheet, .bc-map, .bc-wheel, .bc-phone, .bc-talk')) return;
      this.lockClickAt = performance.now();
      /* the system's own mouse speed and acceleration are kept (raw input felt far too slow on Mac trackpads) */
      try { const p = root.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (x) { /* not allowed */ }
    });
    document.addEventListener('pointerlockchange', () => {
      const on = document.pointerLockElement === root;
      this.fcam.locked = on; this.locked = on;
      if (!on) this.unlockAt = performance.now();
      else if (!this.lockTold) { this.lockTold = true; this.say(TEXT('look_on'), TEXT('look_sub2')); }
    });
    window.addEventListener('mousemove', (e) => { if (this.locked && this.mode !== 'foot') this.cam.mouse(e.movementX * 0.006 * this.fcam.sens, e.movementY * 0.004 * this.fcam.sens); });
    /* [ and ] change the mouse speed, remembered */
    const setSens = (k) => { const v = Math.max(0.25, Math.min(5, this.fcam.sens * k)); this.fcam.sens = v; try { localStorage.setItem('bloc:city:sens', v.toFixed(2)); } catch (e) { /* private mode */ } this.say(TEXT('sens'), Math.round(v * 100) + '%'); };
    this.input.on('BracketRight', () => setSens(1.25)); this.input.on('BracketLeft', () => setSens(0.8));
    /* menus, the map and wheels need the cursor back */
    setInterval(() => { if (this.locked && busy()) document.exitPointerLock(); }, 150);
    setTimeout(() => { if (!this.locked && !this.ended) this.say(TEXT('look_hint'), ''); }, 4500);
  }
  /* ---------- Drive to: a waypoint and a route along the roads ---------- */
  setWaypoint(p, quiet) {
    this.wp = p ? { x: p.x, z: p.z, auto: !!p.auto } : null; this.route = null; this.routeT = 0;
    if (!this.wpBeam) {
      const geo = new THREE.CylinderGeometry(0.9, 0.9, 80, 14, 1, true).translate(0, 40, 0);
      this.wpBeam = new THREE.Mesh(geo, new THREE.MeshBasicNodeMaterial({ color: '#FFE14D', transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide })); this.wpBeam.frustumCulled = false; this.scene.add(this.wpBeam);
    }
    this.wpBeam.visible = !!p;
    if (p) { this.wpBeam.position.set(p.x, sampleHeight(this.plan.height, p.x, p.z), p.z); if (!quiet && !p.auto) this.say(TEXT('wp_set'), TEXT('wp_sub')); }
  }
  routeTick(dt) {
    /* a mission objective gets a route by itself when you haven't set your own waypoint */
    const mt = this.missions && this.missions.cur ? this.missions.target() : null;
    if ((!this.wp || this.wp.auto) && mt) { if (!this.wp || Math.hypot(this.wp.x - mt[0], this.wp.z - mt[1]) > 5) this.setWaypoint({ x: mt[0], z: mt[1], auto: true }); }
    else if (this.wp && this.wp.auto && !mt) this.setWaypoint(null);
    const U2 = this.ui;
    if (!this.wp || this.rooms.inside) { if (!U2.wp.hidden) U2.wp.hidden = true; if (!U2.edge.hidden) U2.edge.hidden = true; if (this.wpBeam) this.wpBeam.visible = !!this.wp && !this.rooms.inside; return; }
    this.wpBeam.visible = true;
    const me = this.me();
    this.routeT -= dt;
    let pr = this.route ? routeProgress(this.route, me.x, me.z) : null;
    if (!this.route || (this.routeT <= 0 && pr.off > 30)) { this.route = this.mode === 'plane' ? { pts: [[me.x, me.z], [this.wp.x, this.wp.z]], total: Math.hypot(this.wp.x - me.x, this.wp.z - me.z) } : findRoute(this.plan, me.x, me.z, this.wp.x, this.wp.z); this.routeT = 1.5; pr = this.route ? routeProgress(this.route, me.x, me.z) : null; }
    const left = pr ? pr.left : Math.hypot(this.wp.x - me.x, this.wp.z - me.z);
    if (Math.hypot(this.wp.x - me.x, this.wp.z - me.z) < 16 && !this.wp.auto) { if (this.audio) this.audio.chime(988); this.say(TEXT('wp_here')); this.setWaypoint(null); return; }
    const txt = left > 950 ? (left / 1000).toFixed(1) + ' km' : Math.round(left / 10) * 10 + ' m';
    if (U2.wp.hidden) U2.wp.hidden = false; if (U2.wp.textContent !== txt) U2.wp.textContent = txt;
    /* an arrow at the edge of the screen when the waypoint is off screen */
    const v = (this._wpv || (this._wpv = new THREE.Vector3())).set(this.wp.x, sampleHeight(this.plan.height, this.wp.x, this.wp.z) + 3, this.wp.z).project(this.camera);
    const behind = v.z > 1, on = !behind && Math.abs(v.x) < 0.92 && Math.abs(v.y) < 0.88;
    if (U2.edge.hidden !== on) U2.edge.hidden = on;
    if (!on) {
      let ax = behind ? -v.x : v.x, ay = behind ? -v.y : v.y; if (behind && Math.abs(ax) < 0.2 && Math.abs(ay) < 0.2) ay = -1;
      const m = Math.max(Math.abs(ax) / 0.9, Math.abs(ay) / 0.85) || 1; ax /= m; ay /= m;
      sty(U2.edge, 'left', (50 + ax * 50).toFixed(1) + '%'); sty(U2.edge, 'top', (50 - ay * 50).toFixed(1) + '%'); sty(U2.edge, 'transform', `translate(-50%,-50%) rotate(${Math.atan2(ax, ay).toFixed(2)}rad)`);
    }
  }
  /* someone was killed: people around scream and run, and someone says something about it */
  deathNear(p) {
    if (!this.crowd) return;
    let said = false;
    this.crowd.panic(p.x, p.z, 32, (q) => { if (!said && q !== p && Math.random() < 0.6) { said = true; setTimeout(() => this.talk.say(q, this.talk.pick('dead_react', q.voice)), 500); } else if (Math.random() < 0.15) this.talk.remark(q, 'panic'); });
  }
  /* staff inside a place: punched or shot down, the police get called and the place shuts until your next drive */
  hitStaff(n, fx, fz) {
    const r = this.rooms.inside; if (!r || !r.room.staff) return;
    const S = r.room.staff; if (S.down) return;
    S.hp -= n; S.flinch = 0.4;
    if (this.audio) this.audio.hit(5);
    if (S.hp <= 0 && !this.native) {
      S.down = true; S.fall = 0; S.fallDir = Math.atan2(fx || 0, fz || 1) + Math.PI;
      this.say(TEXT('closed'), TEXT('closed_sub'));
      if (this.police) this.police.crime('kill', r.door.x, r.door.z);
    } else if (S.hp <= 0) { S.hp = 100; this.talk.say(null, this.talk.pick('bump', 'm'), { name: TEXT('staff_' + S.role) }); }
    else this.talk.say(null, this.talk.pick('shot', S.role === 'clerk' || S.role === 'barista' ? 'f' : 'm'), { name: TEXT('staff_' + S.role) });
  }
  /* ---------- stealing cars ---------- */
  jackable() {
    if (!this.traffic || this.native === 'nojack') return null;
    const f = this.foot; let best = null, bd = 4.2;
    for (const c of this.traffic.near(f.x, f.z, 8)) {
      if (c.mode === 'free' || c.jacked) continue;
      const d = Math.hypot(c.x - f.x, c.z - f.z) - (c.type === 'bus' ? 3 : 0);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  /* a parked car next to you (the instanced ones along the kerbs) */
  parkedNear() {
    if (!this.inst) return null;
    const f = this.foot; let best = null, bd = 3.3;
    for (const T of this.inst.types) {
      if (!T.id.startsWith('parked-')) continue;
      const c = T.cell, i0 = Math.floor((f.x - 6) / c), i1 = Math.floor((f.x + 6) / c), j0 = Math.floor((f.z - 6) / c), j1 = Math.floor((f.z + 6) / c);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const l = T.grid.get(i * 4096 + j); if (!l) continue; for (const it of l) { const d = Math.hypot(it.x - f.x, it.z - f.z); if (d < bd) { bd = d; best = { T, it, list: l }; } } }
    }
    return best;
  }
  /* no driver to argue with: the alarm goes off and you drive away */
  stealParked(p) {
    const { T, it, list } = p, i = list.indexOf(it); if (i >= 0) list.splice(i, 1);
    this.world.collide.removeBoxAt(it.x, it.z);
    if (this.inst) { this.inst.last.set(1e9, 0, 1e9); this.inst.update(this.camera, true); }
    const hex = '#' + [0, 1, 2].map((k) => Math.round(Math.max(0, Math.min(1, it.c ? it.c[k] : 0.8)) * 255).toString(16).padStart(2, '0')).join('');
    const c = { type: T.id.slice(7), color: hex, x: it.x, z: it.z, h: it.r, y: it.y, parked: true };
    this.talk.say(null, this.talk.pick('me_jack', 'm'), { name: TEXT('me') });
    if (this.audio) { this.audio.honk(); setTimeout(() => this.audio && (this.audio.lastHonk = 0, this.audio.honk()), 450); setTimeout(() => this.audio && (this.audio.lastHonk = 0, this.audio.honk()), 900); }
    if (this.police) this.police.crime('steal', c.x, c.z);
    this.takeCar(c);
  }
  jackStart(c) {
    if (c.v > 4.5) { this.say(TEXT('too_fast'), TEXT('too_fast_sub')); return; }
    const f = this.foot, lx = Math.cos(c.h), lz = -Math.sin(c.h), side = (c.T ? c.T.W / 2 : 0.9) + 0.45;
    c.prevMode = c.mode; c.mode = 'stop'; c.v = 0; c.jacked = true; c.voice = c.voice || (Math.random() < 0.5 ? 'f' : 'm');
    const door = { x: c.x + lx * side + Math.sin(c.h) * (c.type === 'bus' ? 4 : 0.3), z: c.z + lz * side + Math.cos(c.h) * (c.type === 'bus' ? 4 : 0.3) };
    f.place(door.x, door.z, Math.atan2(c.x - door.x, c.z - door.z)); f.vx = f.vz = 0;
    /* a bus driver, a cop or a third of drivers hold on to the wheel */
    const fight = c.type === 'police' || c.type === 'bus' || Math.random() < 0.33;
    this.jack = { c, t: 0, phase: 'door', fight, bar: 0, door, said: 0 };
    const who = { x: c.x, z: c.z, voice: c.voice };
    this.talk.say(who, this.talk.pick('jacked', c.voice), { name: TEXT(c.type === 'police' ? 'officer' : 'driver') });
    if (this.police) this.police.crime(c.type === 'police' ? 'kill' : 'steal', c.x, c.z);
  }
  jackPress() { const J = this.jack; if (J && J.phase === 'fight') { J.bar = Math.min(100, J.bar + 11); this.foot.human.punch(); } }
  jackTick(dt) {
    const J = this.jack, c = J.c, f = this.foot; J.t += dt;
    if (!c.alive) { this.jackEnd(); return; }
    c.v = 0; c.mode = 'stop';
    f.a = Math.atan2(c.x - f.x, c.z - f.z);
    if (J.phase === 'door') {
      if (J.t > 0.9) {
        if (J.fight) { J.phase = 'fight'; J.t = 0; this.jackUI(true); this.talk.say(null, this.talk.pick('me_jack_fight', 'm'), { name: TEXT('me') }); }
        else { J.phase = 'out'; J.t = 0; this.talk.say(null, this.talk.pick('me_jack', 'm'), { name: TEXT('me') }); }
      }
    } else if (J.phase === 'fight') {
      /* hold F (or tap it, or tap Pull) faster than the driver pulls back */
      if (this.input.raw.KeyF || this.jackHold) J.bar = Math.min(100, J.bar + dt * 40);
      J.bar = Math.max(0, J.bar - dt * 18);
      if (this.jackEl) this.jackEl.querySelector('i').style.width = J.bar + '%';
      J.said += dt;
      if (J.said > 1.7) { J.said = 0; if (Math.random() < 0.5) this.talk.say({ x: c.x, z: c.z, voice: c.voice }, this.talk.pick('jack_fight', c.voice), { name: TEXT(c.type === 'police' ? 'officer' : 'driver') }); else this.talk.say(null, this.talk.pick('me_jack_fight', 'm'), { name: TEXT('me') }); }
      if (J.bar >= 95) { J.phase = 'out'; J.t = 0; this.jackUI(false); this.talk.say(null, this.talk.pick('me_jack', 'm'), { name: TEXT('me') }); }
      else if (J.t > 8) {
        /* the driver wins: a shove, and they drive off */
        this.jackUI(false); const who = { x: c.x, z: c.z, voice: c.voice };
        this.talk.say(who, this.talk.pick('jack_win', c.voice), { name: TEXT('driver') }).then(() => this.talk.say(null, this.talk.pick('me_jack_fail', 'm'), { name: TEXT('me') }));
        f.place(f.x + (f.x - c.x) * 0.5, f.z + (f.z - c.z) * 0.5, f.a); this.hurt(8, null);
        c.mode = 'flee'; c.jacked = false; c.v = 4; this.jack = null; return;
      }
    } else if (J.phase === 'out' && J.t > 0.6) {
      /* out they come: the driver lands on the pavement, gets up and runs */
      if (this.crowd) {
        const p = this.crowd.people.filter((q) => q.alive && q.state === 'walk').sort((a, b) => Math.hypot(b.x - f.x, b.z - f.z) - Math.hypot(a.x - f.x, a.z - f.z))[0];
        if (p) { p.x = J.door.x + Math.cos(c.h) * 1.1; p.z = J.door.z - Math.sin(c.h) * 1.1; p.y = sampleHeight(this.plan.height, p.x, p.z) + 0.12; p.state = 'down'; p.t = 0; p.fall = 0; p.fallDir = c.h + Math.PI / 2; p.downFor = 1.6; p.gone = false; p.fleeH = Math.atan2(p.x - c.x, p.z - c.z); p.voice = c.voice; setTimeout(() => this.talk.say(p, this.talk.pick('jack_lose', c.voice), { name: TEXT('driver') }), 900); }
      }
      this.takeCar(c);
      this.jackEnd();
    }
  }
  jackEnd() { this.jackUI(false); if (this.jack && this.jack.c) this.jack.c.jacked = false; this.jack = null; this.jackHold = false; }
  jackUI(on) {
    if (!on) { if (this.jackEl) { this.jackEl.remove(); this.jackEl = null; } return; }
    const touch = !!this.ui.el.querySelector('.bc-touch.on');
    const el = document.createElement('div'); el.className = 'bc-jack';
    el.innerHTML = `<b>${TEXT('jack_title')}</b><div class="bc-jack-bar"><i></i></div><small>${TEXT(touch ? 'jack_touch' : 'jack_keys')}</small>` + (touch ? `<button type="button" class="bc-key" data-jack>${TEXT('jack_btn')}</button>` : '');
    this.ui.el.appendChild(el); this.jackEl = el;
    const btn = el.querySelector('[data-jack]');
    if (btn) { btn.addEventListener('pointerdown', (e) => { e.preventDefault(); this.jackPress(); this.jackHold = true; }); const up = () => { this.jackHold = false; }; btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up); }
  }
  /* drive away in it: your own car stays parked where you left it */
  takeCar(c) {
    const old = this.car, type = c.type;
    this.unride();
    if (old.own) { if (!this.parked.includes(old)) this.parked.push(old); } else this.scene.remove(old.group);
    const v = new Vehicle(type, c.color, this.world); v.place(c.x, c.z, c.h, c.y); this.scene.add(v.group); v.sync(); v.stolen = type;
    this.car = v; if (!c.parked && this.traffic) this.traffic.spawn(c, c.x, c.z, true);
    const f = this.foot; this.mode = 'car'; f.group.visible = false; this.fcam.active = false; this.cam.init = false;
    this.camera.fov = 60; this.camera.updateProjectionMatrix();
    if (this.audio) this.audio.duck(false);
    if (v.moto) this.ride();
    this.say(TEXT('stolen'), TEXT(type === 'police' ? 'stolen_cop' : 'stolen_sub'));
  }
  /* back into a car you left parked */
  swapTo(v) {
    const old = this.car; this.parked = this.parked.filter((x) => x !== v);
    if (old.own) this.parked.push(old); else this.scene.remove(old.group);
    this.car = v; this.toggleCar();
  }
  /* a plane you just bought replaces the flight-school one on the apron */
  ownPlane(pl) {
    if (this.mode === 'plane') return;
    this.scene.remove(this.plane.group);
    this.plane = new Plane(this.world, pl); const h = this.planeHome;
    this.plane.place(h.x, h.z, h.yaw, sampleHeight(this.plan.height, h.x, h.z)); this.scene.add(this.plane.group);
  }
  /* on a motorbike you can see yourself: the player's body sits on the bike and leans with it */
  ride() {
    const h = this.foot.human; this.riding = true;
    this.car.body.add(h.group); h.group.position.set(0, -0.06, -0.22); h.group.rotation.set(0, 0, 0); h.group.visible = true; h.head.visible = true;
  }
  unride() {
    if (!this.riding) return;
    const h = this.foot.human; this.riding = false; this.scene.add(h.group);
  }
  ridePose(dt) {
    const h = this.foot.human, car = this.car;
    h.animate(dt, { speed: 0 });
    h.hips.position.y = 0.96; h.spine.rotation.set(0.5, 0, 0); h.neck.rotation.set(-0.4, 0, 0); h.head.rotation.set(-0.1, -car.steer * 0.3, 0);
    for (const L of h.legs) { L.thigh.rotation.set(-1.25, 0, L.sx * 0.22); L.shin.rotation.set(1.55, 0, 0); L.ankle.rotation.set(-0.35, 0, 0); }
    for (const A of h.arms) { A.upper.rotation.set(-1.05, 0, A.sx * 0.28); A.fore.rotation.set(-0.55, 0, 0); A.hand.rotation.set(0.2, 0, 0); }
  }
  /* E: go in, come out, or use what you're standing next to */
  interact() {
    if (this.sheets.el) { this.sheets.close(); return; }
    if (this.mode !== 'foot') return;
    const f = this.foot;
    if (this.rooms.inside) {
      const s = this.rooms.spotAt(f.x, f.z); if (!s) return;
      if (s.act === 'leave') {
        if (this.bout) this.endBout(false);
        const d = this.rooms.leave(); f.indoor = null;
        f.place(d.x + Math.sin(d.a) * 0.9, d.z + Math.cos(d.a) * 0.9, d.a, d.y);
        this.fcam.init = false; this.fcam.placed = false; this.fcam.yaw = d.a;
        this.fade();
      } else if (this.rooms.inside.room.staff && this.rooms.inside.room.staff.down && ['coffee', 'shop', 'garage', 'arms', 'ring'].includes(s.act)) this.say(TEXT('closed'), TEXT('closed_sub'));
      else if (s.act === 'shop') this.sheets.shop();
      else if (s.act === 'garage') this.sheets.garage();
      else if (s.act === 'arms') this.sheets.arms();
      else if (s.act === 'desk') this.sheets.flat();
      else if (s.act === 'lane') this.say(TEXT('p_lane'), this.arms.own.length ? TEXT('aim_hint') : TEXT('no_arms_sub'));
      else if (s.act === 'coffee') this.talk.say(null, this.talk.pick('barista'), { name: TEXT('staff_barista') });
      else if (s.act === 'bag') this.talk.say(null, this.talk.pick('coach'), { name: TEXT('staff_coach') });
      else if (s.act === 'ring') { if (this.native) this.say(TEXT('do_ring'), TEXT('web_only')); else this.startBout(); }
      else this.say(TEXT('do_' + s.act), TEXT('do_' + s.act + '_sub'));
      return;
    }
    const d = this.rooms.near(f.x, f.z);
    if (!d && this.missions && this.missions.nearRosa()) { this.missions.talk(); return; }
    if (!d && this.plane.ground && Math.hypot(this.plane.x - f.x, this.plane.z - f.z) < 7) { this.enterPlane(); return; }
    if (!d && this.crowd) { const p = this.crowd.nearest(f.x, f.z); if (p) { this.talk.converse(p); return; } }
    if (d) {
      const r = this.rooms.enter(d); f.indoor = r;
      const staff = { cafe: 'barista', shop: 'clerk', garage: 'mechanic', gym: 'coach' }[d.id];
      if (staff) setTimeout(() => { if (this.rooms.inside) this.talk.say(null, this.talk.pick(staff), { name: TEXT('staff_' + staff) }); }, 900);
      if (d.id === 'arms') setTimeout(() => { if (this.rooms.inside) this.talk.say(null, this.talk.pick('gunsmith'), { name: TEXT('staff_gunsmith') }); }, 900);
      f.place(r.o.x, r.o.z - r.D / 2 + 1.2, 0, r.o.y);
      this.fcam.init = false; this.fcam.placed = false; this.fcam.yaw = 0;
      this.fade(); this.say(TEXT('place_' + d.id));
    }
  }
  /* sparring in the gym ring: first to land five clean punches wins */
  startBout() {
    if (this.bout) return;
    const r = this.rooms.inside.room, h = new Human({ skin: '#9A6440', hair: 'buzz', hairC: '#1B1714', top: { kind: 'tee', c: '#A3262E' }, bottom: { kind: 'shorts', c: '#1C2B45' }, shoes: { kind: 'sneaker', c: '#1A1B1F' }, hat: { kind: 'none', c: '#000' } });
    const x = r.o.x + 3.5, z = r.o.z + 4.6; h.group.position.set(x, r.o.y + 0.6, z); this.scene.add(h.group);
    this.foot.place(r.o.x + 3.5, r.o.z + 2.4, 0, r.o.y + 0.6); this.foot.indoor = { ...r, floorY: r.o.y + 0.6, collide: (p) => { p.x = Math.max(r.o.x + 0.9, Math.min(r.o.x + 6.1, p.x)); p.z = Math.max(r.o.z + 0.9, Math.min(r.o.z + 6.1, p.z)); }, o: r.o, W: r.W, D: r.D, h: r.h };
    this.bout = { h, x, z, y: r.o.y + 0.6, hp: 5, mine: 0, next: 1.5, t: 0, a: Math.PI, room: r };
    this.hp = 100; this.say(TEXT('bout'), TEXT('bout_sub'));
    this.talk.say(null, this.talk.pick('coach'), { name: TEXT('staff_coach') });
  }
  boutHit() {
    const b = this.bout; b.hp -= 1; b.stagger = 0.4; if (this.audio) this.audio.hit(6);
    if (b.hp <= 0) this.endBout(true); else this.talk.say(null, this.talk.pick('fight_hit', 'm'), { name: TEXT('sparring') });
  }
  boutTick(dt) {
    const b = this.bout, f = this.foot; if (!b) return;
    b.t += dt; const dx = f.x - b.x, dz = f.z - b.z, d = Math.hypot(dx, dz);
    let want = Math.atan2(dx, dz), da = want - b.a; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; b.a += da * Math.min(1, dt * 6);
    if (b.stagger > 0) { b.stagger -= dt; b.x -= dx / d * dt * 1.2; b.z -= dz / d * dt * 1.2; }
    else if (d > 1.05) { b.x += dx / d * Math.min(2, d - 1) * dt; b.z += dz / d * Math.min(2, d - 1) * dt; }
    b.x = Math.max(b.room.o.x + 0.9, Math.min(b.room.o.x + 6.1, b.x)); b.z = Math.max(b.room.o.z + 0.9, Math.min(b.room.o.z + 6.1, b.z));
    if (b.t > b.next && d < 1.45 && !(b.stagger > 0)) { b.next = b.t + 1.1 + Math.random() * 0.7; b.h.punch(); setTimeout(() => { if (this.bout && Math.hypot(this.foot.x - this.bout.x, this.foot.z - this.bout.z) < 1.45) this.hurt(14, null); }, 140); }
    b.h.group.position.set(b.x, b.y, b.z); b.h.group.rotation.y = b.a; b.h.animate(dt, { speed: d > 1.1 ? 0.8 : 0.2, guard: true });
  }
  endBout(won) {
    const b = this.bout; if (!b) return;
    this.scene.remove(b.h.group); this.bout = null;
    const r = this.rooms.inside && this.rooms.inside.room; if (r) { this.foot.indoor = r; this.foot.place(r.o.x - 1, r.o.z + 1, 0, r.o.y); }
    this.say(won ? TEXT('bout_won') : TEXT('bout_lost'), won ? TEXT('bout_won_sub') : TEXT('bout_lost_sub'));
    this.talk.say(null, this.talk.pick(won ? 'fight_lose' : 'fight_win', 'm'), { name: TEXT('sparring') });
    this.hp = 100;
  }
  openWheel() {
    if (!this.radio || this.wheel || this.ended || this.sheets.el) return;
    if (this.audio) this.audio.start();
    const list = this.radio.list, el = document.createElement('div'); el.className = 'bc-wheel';
    const R = Math.min(170, Math.min(innerWidth, innerHeight) * 0.34);
    el.innerHTML = `<div class="bc-wheel-in" style="width:${R * 2 + 140}px;height:${R * 2 + 140}px">` + list.map((st, i) => {
      const a = -Math.PI / 2 + i / list.length * Math.PI * 2, x = Math.cos(a) * R, y = Math.sin(a) * R;
      return `<button type="button" data-st="${st.id}" class="${st.id === this.radio.cur ? 'on' : ''}" style="transform:translate(calc(-50% + ${x.toFixed(0)}px), calc(-50% + ${y.toFixed(0)}px))">${st.id === 'off' ? TEXT('radio_off') : st.name}</button>`;
    }).join('') + `<div class="bc-wheel-mid"><b>${this.radio.stationName(this.radio.cur) === 'Radio off' ? TEXT('radio_off') : this.radio.stationName(this.radio.cur)}</b><small>${this.radio.nowPlaying() || ''}</small></div></div>`;
    this.ui.el.appendChild(el); this.wheel = { el, pick: this.radio.cur };
    this.timeScale = 0.25; if (this.audio) this.audio.duck(true);
    const mark = (id) => { this.wheel.pick = id; el.querySelectorAll('[data-st]').forEach((b) => b.classList.toggle('hi', b.dataset.st === id)); };
    el.addEventListener('pointermove', (e) => {
      const r = el.querySelector('.bc-wheel-in').getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      if (Math.hypot(dx, dy) < 40) return;
      let a = Math.atan2(dy, dx) + Math.PI / 2; if (a < 0) a += Math.PI * 2;
      mark(list[Math.round(a / (Math.PI * 2) * list.length) % list.length].id);
    });
    el.addEventListener('click', (e) => { const b = e.target.closest('[data-st]'); if (b) { mark(b.dataset.st); this.closeWheel(true); } else if (e.target === el) this.closeWheel(false); });
  }
  closeWheel(apply) {
    const w = this.wheel; if (!w) return;
    w.el.classList.add('out'); setTimeout(() => w.el.remove(), 180);
    this.wheel = null; this.timeScale = 1; if (this.audio && this.mode !== 'foot') this.audio.duck(false);
    if (apply && w.pick !== this.radio.cur) { this.radio.tune(w.pick); const st = this.radio.stationName(w.pick); this.say(w.pick === 'off' ? TEXT('radio_off') : st, this.radio.nowPlaying()); }
  }
  contextAct() { const a = this.ui.act.dataset.a; if (a === 'car') this.toggleCar(); else if (a === 'use') this.interact(); }
  fade() { this.ui.fade.classList.add('on'); setTimeout(() => this.ui.fade.classList.remove('on'), 320); }
  /* you got hit: lose health; at zero you're knocked out (no coins lost) */
  hurt(n, by) {
    if (this.mode !== 'foot' || this.koT > 0) return;
    if (this.arms) n = this.arms.absorb(n);
    this.hp = Math.max(0, (this.hp == null ? 100 : this.hp) - n); this.hpShow = 4;
    this.cam.shake = 0.2; this.fcam.lastLook = -10; if (this.audio) this.audio.hit(6);
    if (this.hp <= 0) {
      this.koT = 3; this.ui.fade.classList.add('on'); this.say(TEXT('ko'), TEXT('ko_sub'));
      if (by && this.talk) this.talk.say(by, this.talk.pick('fight_win', by.voice));
      if (this.police && this.police.stars > 0) setTimeout(() => this.police.busted(), 1200);
      setTimeout(() => { this.hp = 100; this.ui.fade.classList.remove('on'); if (this.crowd) for (const p of this.crowd.people) if (p.state === 'fight') { p.state = 'walk'; this.crowd.snap(p); } if (this.bout) this.endBout(false); }, 1600);
    }
  }
  punch() {
    if (this.mode !== 'foot' || this.sheets.el || (this.arms && this.arms.cur)) return;
    if (!this.foot.human.punch()) return;
    const f = this.foot;
    /* combat is website only (off in the iPhone app) */
    if (!this.native) setTimeout(() => {
      const fx = Math.sin(f.a), fz = Math.cos(f.a);
      if (this.bout) { const b = this.bout; if (Math.hypot(b.x - f.x, b.z - f.z) < 1.3) this.boutHit(); return; }
      if (this.rooms.inside) { const r = this.rooms.inside.room, S = r.staff; if (S && !S.down && Math.hypot(r.o.x + S.x - (f.x + fx * 0.6), r.o.z + S.z - (f.z + fz * 0.6)) < 1.0) this.hitStaff(34, fx, fz); return; }
      if (!this.crowd) return;
      if (this.police) { const cop = this.police.foot.nearest(f.x + fx * 0.6, f.z + fz * 0.6, 1.0); if (cop) { const r = this.police.foot.hit(cop, 34, fx, fz, false); if (this.audio) this.audio.hit(r === 'down' ? 9 : 5); this.police.crime('fight', cop.x, cop.z); return; } }
      const p = this.crowd.inReach(f.x, f.z, f.a); if (!p) return;
      const r = this.crowd.hitPerson(p, fx, fz);
      if (this.audio) this.audio.hit(r === 'down' ? 9 : 5);
      this.talk.say(p, this.talk.pick(r === 'down' ? 'fight_lose' : 'fight_hit', p.voice));
      if (this.police) this.police.crime('fight', p.x, p.z);
    }, 140);
    setTimeout(() => { if (this.rooms.hitBag(f.x + Math.sin(f.a) * 0.6, f.z + Math.cos(f.a) * 0.6, Math.sin(f.a), Math.cos(f.a)) && this.audio) this.audio.hit(5); }, 140);
  }
  /* what E or F would do right now, shown as a button (and a hint on keyboards) */
  prompt() {
    let label = null, a = null;
    const keys = !this.ui.el.querySelector('.bc-touch.on');
    if (this.mode === 'car') { if (this.car.speed < 5) { label = TEXT('get_out'); a = 'car'; } }
    else if (this.mode === 'plane') { if (this.plane.ground && this.plane.v < 3) { label = TEXT('get_out'); a = 'car'; } }
    else if (this.rooms.inside) { const s = this.rooms.spotAt(this.foot.x, this.foot.z); if (s) { label = TEXT('p_' + s.act); a = 'use'; } }
    else {
      const d = this.rooms.near(this.foot.x, this.foot.z);
      if (d) { label = TEXT('enter') + ': ' + TEXT('place_' + d.id); a = 'use'; }
      else if (this.missions && this.missions.nearRosa()) { label = TEXT('mi_talk'); a = 'use'; }
      else if (this.plane.ground && Math.hypot(this.plane.x - this.foot.x, this.plane.z - this.foot.z) < 7) { label = TEXT('fly'); a = 'use'; }
      else if (this.crowd && !this.talk.convo && this.crowd.nearest(this.foot.x, this.foot.z)) { const p = this.crowd.nearest(this.foot.x, this.foot.z); label = TEXT('talk') + ': ' + this.talk.nameOf(p); a = 'use'; }
      else if (Math.hypot(this.foot.x - this.car.x, this.foot.z - this.car.z) < 3.6 || this.parked.some((v) => Math.hypot(this.foot.x - v.x, this.foot.z - v.z) < 3.6)) { label = TEXT('get_in'); a = 'car'; }
      else if (!this.jack && (this.jackable() || this.parkedNear())) { label = TEXT('steal'); a = 'car'; }
    }
    const b = this.ui.act;
    if (!label) { if (!b.hidden) b.hidden = true; return; }
    const text = (keys ? (a === 'car' ? 'F  ' : 'E  ') : '') + label;
    if (b.textContent !== text) b.textContent = text;
    b.dataset.a = a; if (b.hidden) b.hidden = false;
  }
  setLook(look) { this.foot.human.setLook(look); this.data.look = look; if (this.arms) this.arms.rehand(); }
  setCar(id, color) {
    const old = this.car, type = { hatch: 'hatch', buggy: 'buggy', van: 'van', gt: 'gt', moto: 'moto' }[id] || 'hatch';
    this.unride();
    const ownParked = this.parked.find((v) => v.own); if (ownParked) { this.scene.remove(ownParked.group); this.parked = this.parked.filter((v) => v !== ownParked); }
    const c = new Vehicle(type, color, this.world); c.own = true; c.setMods(this.mods);
    c.place(old.x, old.z, old.h, old.y); this.scene.remove(old.group); this.scene.add(c.group); c.sync(); this.car = c;
    if (this.mode === 'car' && c.moto) this.ride();
  }
  jumped(airT) {
    const id = this.car.jumpId;
    if (this.result.jumps.indexOf(id) < 0) this.result.jumps.push(id);
    const first = (this.data.jumps || []).indexOf(id) < 0;
    this.say(TEXT('stunt'), TEXT('air', { s: airT.toFixed(1) }) + (first ? ', +100' : ''));
    if (this.audio) this.audio.chime(1320);
  }
  pickups() {
    if (this.rooms && this.rooms.inside) return;
    this.jobTick();
    const car = this.mode === 'car' ? this.car : { x: this.foot.x, z: this.foot.z, air: this.foot.air }, A = this.audio;
    for (let i = 0; i < this.notes.length; i++) {
      if (this.taken.has(i)) continue;
      const p = this.notes[i];
      if (Math.abs(p[0] - car.x) < 3.2 && Math.abs(p[1] - car.z) < 3.2 && !car.air) { this.taken.add(i); this.result.notes.push(i); this.coinsRun += 3; if (A) A.chime(1046); this.say(TEXT('note'), '+3'); }
    }
    for (let i = 0; i < this.crates.length; i++) {
      if (this.crateTaken.has(i)) continue;
      const p = this.crates[i];
      if (Math.hypot(p.x - car.x, p.z - car.z) < 3.6) { this.crateTaken.add(i); this.result.crates.push(i); this.placeCrates(); if (A) { A.chime(784); setTimeout(() => A.chime(1175), 120); } this.say(TEXT('crate'), TEXT('crate_sub')); }
    }
    for (const h of this.homes) {
      if (h.me || this.visited.has(h.id)) continue;
      if (Math.hypot(h.x - car.x, h.z - car.z) < 12) { this.visited.add(h.id); this.result.visits.push(h.id); if (A) A.chime(988); this.say(TEXT('visit', { n: String(h.name).split(' ')[0] }), TEXT('visit_sub')); }
    }
    if (!this.trial) {
      for (const t of this.trials) if (this.driven - this.trialEnd > 4 && !(this.races && this.races.cur) && Math.hypot(t.pts[0][0] - car.x, t.pts[0][1] - car.z) < 7.5) { this.trial = { t, i: 1, at: this.driven }; this.say(t.name, TEXT('trial_go')); if (A) A.chime(660); this.placeCp(); break; }
    } else {
      const p = this.trial.t.pts[this.trial.i];
      if (Math.hypot(p[0] - car.x, p[1] - car.z) < 10) {
        this.trial.i++; if (A) A.chime(880);
        if (this.trial.i >= this.trial.t.pts.length) {
          const ms = Math.round((this.driven - this.trial.at) * 1000), t = this.trial.t;
          const medal = ms <= t.gold ? 'gold' : ms <= t.silver ? 'silver' : ms <= t.bronze ? 'bronze' : null;
          if (!this.result.trial || (this.result.trial.id === t.id ? ms < this.result.trial.ms : true)) this.result.trial = { id: t.id, ms };
          this.say(t.name + ': ' + fmtMs(ms), medal ? TEXT('medal_' + medal) : TEXT('no_medal', { t: fmtMs(t.gold) }));
          this.trial = null; this.trialEnd = this.driven; this.cp.visible = false; this.ui.trial.hidden = true;
        } else this.placeCp();
      }
      if (this.trial && this.driven - this.trial.at > 600) { this.trial = null; this.cp.visible = false; this.ui.trial.hidden = true; }
    }
  }
  jobTick() {
    if (this.jobBeams && !this.jobsPlaced) { this.placeJobs(); this.jobsPlaced = true; }
    const pos = this.me(), inCar = this.mode === 'car';
    if (!this.job) {
      for (const j of this.jobs) {
        if (this.result.jobs.some((r) => r.id === j.id) || Math.hypot(j.a[0] - pos.x, j.a[1] - pos.z) > 5) continue;
        const foot = j.type === 'errand';
        if (foot === inCar) { if (!this.jobHint || this.driven - this.jobHint > 6) { this.jobHint = this.driven; this.say(TEXT('job_' + j.type), TEXT(foot ? 'need_foot' : 'need_car')); } continue; }
        const limit = foot ? j.d / 2.6 + 25 : j.d / 11 + 35;
        this.job = { j, at: this.driven, limit }; this.placeJobs();
        this.say(TEXT('job_' + j.type) + ', ' + j.pay + ' ' + TEXT('cash'), TEXT('job_go'));
        if (j.type === 'taxi') { this.job.voice = Math.random() < 0.5 ? 'f' : 'm'; setTimeout(() => this.talk.say(null, this.talk.pick('taxi_in', this.job && this.job.voice), { name: TEXT('passenger') }), 700); }
        if (this.audio) this.audio.chime(740);
        break;
      }
      return;
    }
    const J = this.job, j = J.j, left = J.limit - (this.driven - J.at);
    if (!this.trial) { this.ui.trial.hidden = false; this.ui.trial.textContent = TEXT('job_' + j.type) + '  ' + fmt(left) + '  ' + Math.round(Math.hypot(j.b[0] - pos.x, j.b[1] - pos.z)) + ' m'; }
    if (left <= 0) { this.job = null; this.placeJobs(); this.ui.trial.hidden = true; this.say(TEXT('job_late')); return; }
    if (Math.hypot(j.b[0] - pos.x, j.b[1] - pos.z) < 6 && (j.type === 'errand') !== inCar) {
      this.result.jobs.push({ id: j.id, ms: Math.round((this.driven - J.at) * 1000) });
      this.say(TEXT('job_done', { n: j.pay }));
      this.talk.say(null, this.talk.pick(j.type === 'taxi' ? 'taxi_out' : 'job_done', J.voice), { name: TEXT(j.type === 'taxi' ? 'passenger' : 'customer') });
      if (this.audio) { this.audio.chime(988); setTimeout(() => this.audio.chime(1319), 140); }
      this.job = null; this.placeJobs(); this.ui.trial.hidden = true;
    }
  }
  placeCp() {
    const p = this.trial.t.pts[this.trial.i], q = this.trial.t.pts[this.trial.i - 1];
    this.cp.position.set(p[0], sampleHeight(this.plan.height, p[0], p[1]) + 7.5, p[1]);
    this.cp.rotation.set(0, Math.atan2(p[0] - q[0], p[1] - q[1]), 0);
    this.cp.visible = true; this.ui.trial.hidden = false;
  }
  /* the body you're in right now, for the HUD and maps */
  me() {
    if (this.mode === 'car') return this.car;
    if (this.mode === 'plane') return { x: this.plane.x, z: this.plane.z, h: this.plane.yaw, speed: this.plane.v };
    const fo = this.rooms.inside ? this.rooms.inside.door : null;
    return fo ? { x: fo.x, z: fo.z, h: fo.a, speed: 0 } : { x: this.foot.x, z: this.foot.z, h: this.foot.a, speed: this.foot.speed };
  }
  hud(dt) {
    const U2 = this.ui, car = this.me(), t = TEXT;
    sty(U2.speedBox, 'display', this.mode === 'foot' ? 'none' : '');
    if (!U2.hp) { U2.hp = document.createElement('div'); U2.hp.className = 'bc-hp'; U2.hp.innerHTML = '<i></i>'; this.ui.el.querySelector('.bc-fuel').appendChild(U2.hp); }
    const hpOn = this.mode === 'foot' && this.hp != null && (this.hp < 100 || this.bout); sty(U2.hp, 'display', hpOn ? 'block' : 'none'); if (hpOn) sty(U2.hp.firstChild, 'width', this.hp + '%');
    sty(U2.mini, 'display', this.rooms.inside ? 'none' : ''); sty(U2.place, 'display', this.rooms.inside ? 'none' : '');
    { const ct = (this.sheets.farm && typeof this.sheets.farm.coins === 'number' ? this.sheets.farm.coins : this.coins).toLocaleString() + ' ' + TEXT('cash'); if (!U2.coinsEl) U2.coinsEl = U2.el.querySelector('.bc-coins'); if (U2.coinsEl.textContent !== ct) U2.coinsEl.textContent = ct; }
    U2.speed.textContent = Math.round(car.speed * 3.6);
    U2.fuel.textContent = fmt(this.fuel);
    U2.sub.textContent = this.result.notes.length ? t('fuel_notes', { n: this.result.notes.length }) : t('fuel');
    U2.bar.style.width = Math.max(0, Math.min(100, this.fuel / this.fuel0 * 100)).toFixed(1) + '%';
    if (this.trial) U2.trial.textContent = this.trial.t.name + '  ' + fmtMs((this.driven - this.trial.at) * 1000) + '  ' + this.trial.i + '/' + (this.trial.t.pts.length - 1);
    if (this.msgT > 0) { this.msgT -= dt; if (this.msgT <= 0) U2.msg.classList.remove('on'); }
    /* notes spin and bob near the car */
    const TMP = this._tmp || (this._tmp = { M: new THREE.Matrix4(), Q: new THREE.Quaternion(), P: new THREE.Vector3(), S: new THREE.Vector3(1, 1, 1), Y: new THREE.Vector3(0, 1, 0) });
    const M = TMP.M, Q = TMP.Q, P = TMP.P, S = TMP.S, Y = TMP.Y, tt = performance.now() / 1000;
    for (let i = 0; i < this.notes.length; i++) {
      const p = this.notes[i], far = Math.abs(p[0] - car.x) > 500 || Math.abs(p[1] - car.z) > 500;
      Q.setFromAxisAngle(Y, tt * 2.2 + i); P.set(p[0], this.taken.has(i) || far ? -500 : sampleHeight(this.plan.height, p[0], p[1]) + 1.5 + Math.sin(tt * 2.8 + i) * 0.2, p[1]);
      M.compose(P, Q, S); this.noteMesh.setMatrixAt(i, M);
    }
    this.noteMesh.instanceMatrix.needsUpdate = true;
    this.homes.forEach((h, i) => this.label(this.labels[i], h.x, sampleHeight(this.plan.height, h.x, h.z) + 14, h.z, 700));
    this.trials.forEach((tr, i) => this.label(this.trialLabels[i], tr.pts[0][0], sampleHeight(this.plan.height, tr.pts[0][0], tr.pts[0][1]) + 4, tr.pts[0][1], 300));
    this.miniT = (this.miniT || 0) - dt;
    if (this.miniT <= 0) { this.miniT = 0.06; this.drawMini(); }
  }
  /* floating labels: only touch the DOM when something changed (Safari recalculates styles on every write) */
  label(el, x, y, z, maxD) {
    const m = this.me(), d = Math.hypot(x - m.x, z - m.z), hide = () => { if (el._on !== false) { el._on = false; el.style.display = 'none'; } };
    if (this.rooms.inside || d > maxD) { hide(); return; }
    const v = (this._lv || (this._lv = new THREE.Vector3())).set(x, y, z).project(this.camera);
    if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) { hide(); return; }
    if (el._on !== true) { el._on = true; el.style.display = 'block'; }
    const tf = `translate(${((v.x + 1) / 2 * innerWidth).toFixed(0)}px, ${((1 - v.y) / 2 * innerHeight).toFixed(0)}px) translate(-50%, -100%)`;
    if (el._tf !== tf) { el._tf = tf; el.style.transform = tf; }
  }
  drawMini() {
    const c = this.ui.mini, g = c.getContext('2d'), W = c.width, half = W / 2, img = this.mapImg, car = this.me();
    const zoom = this.mz * (this.mode === 'foot' ? 1.5 : 1) * (1 - Math.min(0.35, (car.speed || 0) / 80));
    g.save(); g.fillStyle = '#1f5f86'; g.fillRect(0, 0, W, W);
    /* the map turns with the camera, like what you see; the arrow shows which way you face within that */
    const cd = this.camera.getWorldDirection(this._v3 || (this._v3 = new THREE.Vector3())), view = Math.atan2(cd.x, cd.z);
    g.translate(half, half * 1.25); g.rotate(Math.PI + view); g.scale(zoom, zoom);
    const mx = (car.x - MAP.x0) * img.s, mz = (car.z - MAP.z0) * img.s;
    g.drawImage(img.c, -mx, -mz);
    const dot = (x, z, col, r) => { g.fillStyle = col; g.beginPath(); g.arc((x - MAP.x0) * img.s - mx, (z - MAP.z0) * img.s - mz, r / zoom, 0, 7); g.fill(); };
    this.crates.forEach((p, i) => { if (!this.crateTaken.has(i)) dot(p.x, p.z, '#C98A50', 6); });
    this.homes.forEach((h) => dot(h.x, h.z, h.me ? '#FFE14D' : '#9ADAFF', 7));
    this.trials.forEach((t) => dot(t.pts[0][0], t.pts[0][1], '#FFE14D', 5));
    if (this.races && !this.races.cur) this.races.pins().forEach((r) => dot(r.x, r.z, '#FF5AD7', 6));
    if (this.rooms) this.rooms.doors.forEach((d) => dot(d.x, d.z, '#FFFFFF', 5));
    if (this.mode !== 'plane') dot(this.plane.x, this.plane.z, '#C9A0FF', 7);
    if (this.job) dot(this.job.j.b[0], this.job.j.b[1], '#FF5A5F', 9); else this.jobs.forEach((j) => { if (!this.result.jobs.some((r) => r.id === j.id)) dot(j.a[0], j.a[1], '#7CE3FF', 6); });
    if (this.trial) { const p = this.trial.t.pts[this.trial.i]; dot(p[0], p[1], '#FF5A5F', 8); }
    /* the route to your waypoint */
    if (this.route && this.wp) {
      g.strokeStyle = this.wp.auto ? '#B38CFF' : '#FFE14D'; g.lineWidth = 7 / zoom; g.lineJoin = 'round'; g.lineCap = 'round'; g.beginPath();
      const pr = routeProgress(this.route, car.x, car.z);
      g.moveTo((car.x - MAP.x0) * img.s - mx, (car.z - MAP.z0) * img.s - mz);
      for (let i = pr.i + 1; i < this.route.pts.length; i++) { const p = this.route.pts[i]; g.lineTo((p[0] - MAP.x0) * img.s - mx, (p[1] - MAP.z0) * img.s - mz); }
      g.stroke();
    }
    if (this.wp) dot(this.wp.x, this.wp.z, this.wp.auto ? '#B38CFF' : '#FFE14D', 11);
    if (this.missions && !this.missions.cur && this.missions.next()) dot(this.missions.rosa.x, this.missions.rosa.z, '#B38CFF', 8);
    g.restore();
    /* health and armour around the edge */
    const hp = this.mode === 'foot' ? (this.hp == null ? 100 : this.hp) : 100 - Math.round((this.car.dmg || 0) * 100), ap = this.arms ? this.arms.ap : 0;
    g.lineWidth = 12; g.lineCap = 'butt';
    g.strokeStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.arc(half, half, half - 7, Math.PI * 0.55, Math.PI * 1.45); g.stroke(); g.beginPath(); g.arc(half, half, half - 7, Math.PI * 1.55, Math.PI * 2.45); g.stroke();
    g.strokeStyle = hp > 35 ? '#5CD68A' : '#FF5A5F'; g.beginPath(); g.arc(half, half, half - 7, Math.PI * 1.45 - Math.PI * 0.9 * Math.max(0, hp) / 100, Math.PI * 1.45); g.stroke();
    if (ap > 0) { g.strokeStyle = '#7CC4FF'; g.beginPath(); g.arc(half, half, half - 7, Math.PI * 1.55, Math.PI * 1.55 + Math.PI * 0.9 * ap / 100); g.stroke(); }
    g.fillStyle = '#FFFFFF'; g.strokeStyle = '#191D29'; g.lineWidth = 3;
    { const th = Math.PI + view, ax = Math.sin(car.h), az = Math.cos(car.h), sx = ax * Math.cos(th) - az * Math.sin(th), sy = ax * Math.sin(th) + az * Math.cos(th);
      g.save(); g.translate(half, half * 1.25); g.rotate(Math.atan2(sx, -sy));
      g.beginPath(); g.moveTo(0, -13); g.lineTo(9, 10); g.lineTo(0, 5); g.lineTo(-9, 10); g.closePath(); g.fill(); g.stroke(); g.restore(); }
    const d = districtAt(car.x, car.z), name = (DISTRICTS.find((q) => q.id === d) || {}).name || '';
    const label = this.mode === 'plane' ? name + ', ' + Math.round(this.plane.y - sampleHeight(this.plan.height, this.plane.x, this.plane.z)) + ' m' : name;
    if (this.ui.place.textContent !== label) this.ui.place.textContent = label;
  }
  drawBigMap() {
    const c = this.ui.map.querySelector('canvas'), img = this.mapImg;
    c.width = img.c.width; c.height = img.c.height;
    const g = c.getContext('2d'); g.drawImage(img.c, 0, 0);
    const P = (x, z) => [(x - MAP.x0) * img.s, (z - MAP.z0) * img.s];
    g.font = '700 26px "Schibsted Grotesk", system-ui, sans-serif'; g.textAlign = 'center';
    const pin = (x, z, col, label) => { const [a, b] = P(x, z); g.fillStyle = col; g.beginPath(); g.arc(a, b, 10, 0, 7); g.fill(); g.strokeStyle = '#191D29'; g.lineWidth = 3; g.stroke(); if (label) { g.lineWidth = 6; g.strokeStyle = 'rgba(17,19,24,.85)'; g.strokeText(label, a, b - 18); g.fillStyle = '#fff'; g.fillText(label, a, b - 18); } };
    for (const dd of DISTRICTS) { const at = DISTRICT_LABELS[dd.id]; if (at) { const [a, b] = P(at[0], at[1]); g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '800 30px "Schibsted Grotesk", system-ui'; g.fillText(dd.name, a, b); } }
    g.font = '700 24px "Schibsted Grotesk", system-ui';
    const H = this.mapHide, on = (k) => !H.has(k);
    if (this.route && this.wp) { g.lineJoin = 'round'; g.lineCap = 'round'; g.beginPath(); this.route.pts.forEach((p, i) => { const [x, y] = P(p[0], p[1]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.strokeStyle = 'rgba(17,19,24,.7)'; g.lineWidth = 18; g.stroke(); g.strokeStyle = this.wp.auto ? '#B38CFF' : '#FFE14D'; g.lineWidth = 11; g.stroke(); }
    if (on('crates')) this.crates.forEach((p, i) => { if (!this.crateTaken.has(i)) pin(p.x, p.z, '#C98A50'); });
    if (on('trials')) this.trials.forEach((t) => pin(t.pts[0][0], t.pts[0][1], '#FFE14D', t.name));
    if (on('races') && this.races) this.races.pins().forEach((r) => pin(r.x, r.z, '#FF5AD7', TEXT('race_' + r.id)));
    if (on('shops')) this.rooms.doors.forEach((d) => pin(d.x, d.z, '#FFFFFF', TEXT('place_' + d.id)));
    if (on('shops')) pin(this.plane.x, this.plane.z, '#C9A0FF', TEXT('plane'));
    if (on('jobs')) { if (this.job) pin(this.job.j.b[0], this.job.j.b[1], '#FF5A5F', TEXT('job_' + this.job.j.type)); else this.jobs.forEach((j) => { if (!this.result.jobs.some((r) => r.id === j.id)) pin(j.a[0], j.a[1], '#7CE3FF', TEXT('job_' + j.type) + ' ' + j.pay); }); }
    if (on('friends')) this.homes.forEach((h) => pin(h.x, h.z, h.me ? '#FFE14D' : '#9ADAFF', h.me ? TEXT('home') : String(h.name).split(' ')[0]));
    if (on('missions') && this.missions) { const M = this.missions, t = M.cur ? M.target() : null; if (t) pin(t[0], t[1], '#B38CFF', TEXT('mi_' + M.cur.id)); else if (M.next()) pin(M.rosa.x, M.rosa.z, '#B38CFF', 'Rosa'); }
    if (this.wp) pin(this.wp.x, this.wp.z, this.wp.auto ? '#B38CFF' : '#FFE14D', TEXT('wp'));
    const lg = this.ui.map.querySelector('.bc-legend'), cats = [['shops', '#FFFFFF'], ['missions', '#B38CFF'], ['jobs', '#7CE3FF'], ['friends', '#9ADAFF'], ['trials', '#FFE14D'], ['races', '#FF5AD7'], ['crates', '#C98A50']];
    lg.innerHTML = cats.map(([k, c]) => `<button type="button" data-f="${k}" aria-pressed="${on(k)}"><i style="background:${c}"></i>${TEXT('lg_' + k)}</button>`).join('');
    const me = this.me(), [a, b] = P(me.x, me.z);
    /* north is up here, so the arrow turns by the heading itself (it used to point the mirror way) */
    g.save(); g.translate(a, b); g.rotate(Math.PI - me.h); g.fillStyle = '#FF5A5F'; g.strokeStyle = '#fff'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, -18); g.lineTo(13, 13); g.lineTo(0, 6); g.lineTo(-13, 13); g.closePath(); g.fill(); g.stroke(); g.restore();
  }
  finish(reason) {
    if (this.ended) return;
    this.ended = true;
    this.result.secs = Math.round(this.driven);
    if (this.onEnd) this.onEnd(this.result, reason);
    this.showEnd(reason);
  }
  showEnd(reason) {
    const t = TEXT, r = this.result, card = document.createElement('div');
    card.className = 'bc-end';
    card.innerHTML = `<div class="bc-card"><h2>${reason === 'fuel' ? t('out_of_fuel') : t('drive_over')}</h2><p>${reason === 'fuel' ? t('study_more') : t('fuel_waits')}</p><ul>` +
      `<li><span>${t('time_driven')}</span><b>${fmt(this.driven)}</b></li><li><span>${t('notes')}</span><b>${r.notes.length}</b></li><li><span>${t('crates')}</span><b>${r.crates.length}</b></li>` +
      (r.jumps.length ? `<li><span>${t('jumps')}</span><b>${r.jumps.length}</b></li>` : '') + (r.visits.length ? `<li><span>${t('visits')}</span><b>${r.visits.length}</b></li>` : '') + (r.jobs.length ? `<li><span>${t('jobs')}</span><b>${r.jobs.length}</b></li>` : '') +
      (r.trial ? `<li><span>${t('best_trial')}</span><b>${fmtMs(r.trial.ms)}</b></li>` : '') + `</ul><button type="button">${t('back')}</button></div>`;
    this.ui.el.appendChild(card);
    const b = card.querySelector('button'); b.focus(); b.onclick = () => this.onClose && this.onClose();
  }
}
function withTimes(t) {
  let L = 0; for (let i = 1; i < t.pts.length; i++) L += Math.hypot(t.pts[i][0] - t.pts[i - 1][0], t.pts[i][1] - t.pts[i - 1][1]);
  return Object.assign({}, t, { bronze: Math.round(L / 15 * 1000), silver: Math.round(L / 20 * 1000), gold: Math.round(L / 25 * 1000) });
}
function rampGeo(len, h, w) {
  const g = new THREE.BufferGeometry(), L = len / 2, W = w / 2;
  g.setAttribute('position', new THREE.Float32BufferAttribute([-W, 0, -L, W, 0, -L, W, h, L, -W, h, L, -W, 0, L, W, 0, L], 3));
  g.setIndex([0, 2, 1, 0, 3, 2, 3, 5, 2, 3, 4, 5, 0, 1, 5, 0, 5, 4, 0, 4, 3, 1, 2, 5]); g.computeVertexNormals(); return g;
}
/* set a style only when it changes: every write makes Safari recalculate styles */
function sty(el, k, v) { const c = el._sty || (el._sty = {}); if (c[k] !== v) { c[k] = v; el.style[k] = v; } }
const DISTRICT_LABELS = { oldtown: [-380, -60], ensanche: [-700, 600], downtown: [50, -2050], campus: [-900, -1700], beach: [-1550, 300], port: [-1400, 1700], poligono: [150, 1800], barrio: [-200, 1200], hills: [1700, -800], airport: [1700, 1500], island: [-2900, -150], park: [500, 150] };
/* the whole city as a picture: water, parks, roads */
export function drawMapImage(plan, s) {
  s = s / 4;
  const W = Math.ceil((MAP.x1 - MAP.x0) * s), H = Math.ceil((MAP.z1 - MAP.z0) * s);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#1f5f86'; g.fillRect(0, 0, W, H);
  const step = 8;
  for (let z = MAP.z0; z < MAP.z1; z += step) for (let x = MAP.x0; x < MAP.x1; x += step) {
    if (isWater(x, z)) continue;
    const d = districtAt(x, z);
    g.fillStyle = d === 'park' || d === 'hills' || d === 'campus' ? '#7FAE6A' : d === 'beach' && x < coastX(z) + 330 ? '#E6D3A3' : d === 'island' ? '#D9C89A' : d === 'airport' ? '#B9C2A8' : '#C9C4BA';
    g.fillRect((x - MAP.x0) * s, (z - MAP.z0) * s, step * s + 0.6, step * s + 0.6);
  }
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const pass of [0, 1]) for (const e of plan.edges) {
    g.strokeStyle = pass ? (e.kind === 'ronda' ? '#FFE9A8' : e.kind === 'boulevard' || e.kind === 'granvia' || e.kind === 'avenue' || e.kind === 'promenade' ? '#FFFFFF' : '#F2F0EA') : '#8C8778';
    g.lineWidth = Math.max(1.2, (e.w + (pass ? 0 : 3)) * s);
    g.beginPath(); e.dense.forEach((p, i) => { const x = (p[0] - MAP.x0) * s, z = (p[1] - MAP.z0) * s; if (i) g.lineTo(x, z); else g.moveTo(x, z); }); g.stroke();
  }
  g.fillStyle = '#9D9A92';
  g.fillRect((RUNWAY.x0 - MAP.x0) * s, (RUNWAY.z - RUNWAY.w / 2 - MAP.z0) * s, (RUNWAY.x1 - RUNWAY.x0) * s, RUNWAY.w * s);
  g.fillRect((APRON.x0 - MAP.x0) * s, (APRON.z0 - MAP.z0) * s, (APRON.x1 - APRON.x0) * s, (APRON.z1 - APRON.z0) * s);
  void ISLAND; void LAKE;
  return { c, s };
}
