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
    const type = { hatch: 'hatch', buggy: 'buggy', van: 'van', gt: 'gt' }[carInfo.id] || carInfo.id || 'hatch';
    this.car = new Vehicle(type, d.color || '#FFE14D', this.world);
    this.scene.add(this.car.group);
    this.result = { v: 7, secs: 0, notes: [], crates: [], jumps: [], visits: [], trial: null };
    this.fuel = Math.max(0, d.fuel || 0); this.fuel0 = Math.max(1, d.fuel || 1); this.driven = 0; this.coinsRun = 0; this.ended = false; this.paused = false;
    this.notes = this.plan.notes; this.taken = new Set(Array.isArray(d.drive && d.drive.notes) ? d.drive.notes : []);
    this.crates = cratePoints(this.plan, d.seed || 'today', (cat.rules && cat.rules.crateN) || 10);
    this.crateTaken = new Set(Array.isArray(d.drive && d.drive.crates) ? d.drive.crates : []);
    this.trials = (cat.trials && cat.trials.length && cat.trials[0].id.endsWith('7') ? cat.trials : this.plan.trials.map((t) => withTimes(t))).map((t) => Object.assign({}, t));
    this.homes = (d.homes || []).map((h) => { const l = homeLot(this.plan, h.id, h.loc); return Object.assign({}, h, { x: l.x - l.fx * (l.d / 2 + 6), z: l.z - l.fz * (l.d / 2 + 6), lot: l }); });
    this.visited = new Set(this.homes.filter((h) => h.visited).map((h) => h.id));
    this.trial = null; this.trialEnd = -10; this.msgT = 0;
    this.buildMarkers();
    this.buildHud();
    this.startPos();
    this.safe = { x: this.car.x, z: this.car.z, h: this.car.h };
    this.input.on('KeyM', () => this.toggleMap());
    this.input.on('KeyV', () => this.say(TEXT('view_' + this.cam.next())));
    this.input.on('Escape', () => { if (this.mapOpen) this.toggleMap(); else this.finish('exit'); });
    this.input.on('KeyN', () => this.cycleSky());
  }
  startPos() {
    const me = this.homes.find((h) => h.me);
    let x = me ? me.x : -380, z = me ? me.z : -40;
    /* nearest road point, facing along it */
    let best = null, bd = 1e9;
    for (const e of this.plan.edges) {
      if (e.bridge || e.kind === 'ronda' || e.kind === 'lane') continue;
      for (let i = 0; i < e.dense.length - 1; i += 2) { const p = e.dense[i], d = Math.hypot(p[0] - x, p[1] - z); if (d < bd) { bd = d; best = { e, i }; } }
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
    this.placeCrates();
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
      `<div class="bc-btns"><button type="button" class="bc-btn" data-k="view">${t('view')}</button><button type="button" class="bc-btn" data-k="sky">${t('sky_live')}</button><button type="button" class="bc-btn" data-k="map">${t('map')}</button><button type="button" class="bc-btn x" data-k="exit">${t('done')}</button></div></div>` +
      `<canvas class="bc-mini" width="320" height="320" aria-hidden="true"></canvas><div class="bc-place"></div>` +
      `<div class="bc-trial" hidden></div><div class="bc-msg"></div>` +
      `<div class="bc-speed"><b>0</b><span>km/h</span></div>` +
      `<div class="bc-touch${coarse ? ' on' : ''}"><div class="bc-pad"><button type="button" class="bc-key" data-in="left" aria-label="${t('left')}">◀</button><button type="button" class="bc-key" data-in="right" aria-label="${t('right')}">▶</button></div>` +
      `<div class="bc-pad"><button type="button" class="bc-key small" data-in="hand">${t('drift')}</button><button type="button" class="bc-key" data-in="down" aria-label="${t('brake')}">▼</button><button type="button" class="bc-key" data-in="up" aria-label="${t('gas')}">▲</button></div></div>` +
      `<div class="bc-map"><canvas></canvas><p>${t('map_hint')}</p></div><div class="bc-fade"></div>`;
    r.appendChild(el);
    const $ = (s) => el.querySelector(s);
    this.ui = { el, fuel: $('.bc-f'), sub: $('.bc-sub'), bar: $('.bc-bar i'), speed: $('.bc-speed b'), msg: $('.bc-msg'), trial: $('.bc-trial'), mini: $('.bc-mini'), map: $('.bc-map'), fade: $('.bc-fade'), place: $('.bc-place'), sky: $('[data-k="sky"]') };
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-k]'); if (!b) return;
      const k = b.dataset.k;
      if (k === 'exit') this.finish('exit'); else if (k === 'map') this.toggleMap(); else if (k === 'view') this.say(t('view_' + this.cam.next())); else if (k === 'sky') this.cycleSky();
    });
    this.ui.map.addEventListener('click', () => this.toggleMap());
    this.labels = this.homes.map((h) => { const d = document.createElement('div'); d.className = 'bc-label' + (h.me ? ' home' : ''); d.textContent = h.me ? t('home') : h.name; el.appendChild(d); return d; });
    this.trialLabels = this.trials.map((tr) => { const d = document.createElement('div'); d.className = 'bc-label'; d.textContent = tr.name; el.appendChild(d); return d; });
    this.mapImg = drawMapImage(this.plan, 1.25);
    this.say('Bloc City', coarse ? t('hint_touch') : t('hint_keys'));
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
    if (this.mapOpen || this.paused) return;
    this.driven += dt; this.fuel -= dt;
    const car = this.car;
    car.input = this.input.car();
    this.world.h = car.h; this.world.wet = U.wet.value;
    const sub = Math.max(1, Math.ceil(dt / (1 / 120)));
    for (let k = 0; k < sub; k++) car.step(dt / sub);
    /* other cars push back */
    if (this.traffic) {
      for (const o of this.traffic.near(car.x, car.z, 6)) {
        const dx = car.x - o.x, dz = car.z - o.z, d = Math.hypot(dx, dz);
        if (d < 3.6 && d > 0.01) { const nx = dx / d, nz = dz / d, pen = 3.6 - d; car.x += nx * pen; car.z += nz * pen; const vn = car.vx * nx + car.vz * nz; if (vn < 0) { car.vx -= 1.3 * vn * nx; car.vz -= 1.3 * vn * nz; if (-vn > 4) { this.cam.shake = Math.min(0.5, -vn / 25); if (this.audio) this.audio.hit(-vn); } } o.v = 0; }
      }
      this.traffic.update(dt, { x: car.x, z: car.z, forwardSpeed: car.vf });
    }
    if (car.lastHit > 4) { this.cam.shake = Math.min(0.6, car.lastHit / 25); if (this.audio) this.audio.hit(car.lastHit); car.lastHit = 0; }
    if (car.landed) { if (car.landed > 0.9) this.jumped(car.landed); car.landed = 0; this.cam.shake = 0.25; }
    /* the sea: back to the last safe road */
    if (!car.air && this.world.inWater(car.x, car.z, car.y)) {
      this.ui.fade.classList.add('on');
      car.place(this.safe.x, this.safe.z, this.safe.h, sampleHeight(this.plan.height, this.safe.x, this.safe.z));
      this.say(TEXT('splash'), TEXT('back_on_road'));
      setTimeout(() => this.ui.fade.classList.remove('on'), 380);
    } else if (!car.air && Math.abs(car.vf || 0) > 2 && this.world.surface(car.x, car.z, car.y).road) this.safe = { x: car.x, z: car.z, h: car.h };
    car.sync();
    this.pickups();
    this.cam.update(dt, car, (x, z) => sampleHeight(this.plan.height, x, z));
    POST.motion.value = Math.max(0, Math.min(1, (car.speed - 22) / 30));
    this.hud(dt);
    if (this.fuel <= 0) this.finish('fuel');
  }
  jumped(airT) {
    const id = this.car.jumpId;
    if (this.result.jumps.indexOf(id) < 0) this.result.jumps.push(id);
    const first = (this.data.jumps || []).indexOf(id) < 0;
    this.say(TEXT('stunt'), TEXT('air', { s: airT.toFixed(1) }) + (first ? ', +100' : ''));
    if (this.audio) this.audio.chime(1320);
  }
  pickups() {
    const car = this.car, A = this.audio;
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
      for (const t of this.trials) if (this.driven - this.trialEnd > 4 && Math.hypot(t.pts[0][0] - car.x, t.pts[0][1] - car.z) < 7.5) { this.trial = { t, i: 1, at: this.driven }; this.say(t.name, TEXT('trial_go')); if (A) A.chime(660); this.placeCp(); break; }
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
  placeCp() {
    const p = this.trial.t.pts[this.trial.i], q = this.trial.t.pts[this.trial.i - 1];
    this.cp.position.set(p[0], sampleHeight(this.plan.height, p[0], p[1]) + 7.5, p[1]);
    this.cp.rotation.set(0, Math.atan2(p[0] - q[0], p[1] - q[1]), 0);
    this.cp.visible = true; this.ui.trial.hidden = false;
  }
  hud(dt) {
    const U2 = this.ui, car = this.car, t = TEXT;
    U2.speed.textContent = Math.round(car.speed * 3.6);
    U2.fuel.textContent = fmt(this.fuel);
    U2.sub.textContent = this.result.notes.length ? t('fuel_notes', { n: this.result.notes.length }) : t('fuel');
    U2.bar.style.width = Math.max(0, Math.min(100, this.fuel / this.fuel0 * 100)).toFixed(1) + '%';
    if (this.trial) U2.trial.textContent = this.trial.t.name + '  ' + fmtMs((this.driven - this.trial.at) * 1000) + '  ' + this.trial.i + '/' + (this.trial.t.pts.length - 1);
    if (this.msgT > 0) { this.msgT -= dt; if (this.msgT <= 0) U2.msg.classList.remove('on'); }
    /* notes spin and bob near the car */
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), Y = new THREE.Vector3(0, 1, 0), tt = performance.now() / 1000;
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
  label(el, x, y, z, maxD) {
    const d = Math.hypot(x - this.car.x, z - this.car.z);
    if (d > maxD) { el.style.display = 'none'; return; }
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) { el.style.display = 'none'; return; }
    el.style.display = 'block'; el.style.transform = `translate(${((v.x + 1) / 2 * innerWidth).toFixed(0)}px, ${((1 - v.y) / 2 * innerHeight).toFixed(0)}px) translate(-50%, -100%)`;
  }
  drawMini() {
    const c = this.ui.mini, g = c.getContext('2d'), W = c.width, half = W / 2, img = this.mapImg, car = this.car;
    const zoom = 1.6 + Math.min(1.2, car.speed / 30) * -0.5;
    g.save(); g.fillStyle = '#1f5f86'; g.fillRect(0, 0, W, W);
    g.translate(half, half * 1.25); g.rotate(Math.PI + car.h); g.scale(zoom, zoom);
    const mx = (car.x - MAP.x0) * img.s, mz = (car.z - MAP.z0) * img.s;
    g.drawImage(img.c, -mx, -mz);
    const dot = (x, z, col, r) => { g.fillStyle = col; g.beginPath(); g.arc((x - MAP.x0) * img.s - mx, (z - MAP.z0) * img.s - mz, r / zoom, 0, 7); g.fill(); };
    this.crates.forEach((p, i) => { if (!this.crateTaken.has(i)) dot(p.x, p.z, '#C98A50', 6); });
    this.homes.forEach((h) => dot(h.x, h.z, h.me ? '#FFE14D' : '#9ADAFF', 7));
    this.trials.forEach((t) => dot(t.pts[0][0], t.pts[0][1], '#FFE14D', 5));
    if (this.trial) { const p = this.trial.t.pts[this.trial.i]; dot(p[0], p[1], '#FF5A5F', 8); }
    g.restore();
    g.fillStyle = '#FFFFFF'; g.strokeStyle = '#191D29'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(half, half * 1.25 - 13); g.lineTo(half + 9, half * 1.25 + 10); g.lineTo(half, half * 1.25 + 5); g.lineTo(half - 9, half * 1.25 + 10); g.closePath(); g.fill(); g.stroke();
    const d = districtAt(car.x, car.z), name = (DISTRICTS.find((q) => q.id === d) || {}).name || '';
    if (this.ui.place.textContent !== name) this.ui.place.textContent = name;
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
    this.crates.forEach((p, i) => { if (!this.crateTaken.has(i)) pin(p.x, p.z, '#C98A50'); });
    this.trials.forEach((t) => pin(t.pts[0][0], t.pts[0][1], '#FFE14D', t.name));
    this.homes.forEach((h) => pin(h.x, h.z, h.me ? '#FFE14D' : '#9ADAFF', h.me ? TEXT('home') : String(h.name).split(' ')[0]));
    const [a, b] = P(this.car.x, this.car.z);
    g.save(); g.translate(a, b); g.rotate(Math.PI + this.car.h); g.fillStyle = '#FF5A5F'; g.strokeStyle = '#fff'; g.lineWidth = 3;
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
      (r.jumps.length ? `<li><span>${t('jumps')}</span><b>${r.jumps.length}</b></li>` : '') + (r.visits.length ? `<li><span>${t('visits')}</span><b>${r.visits.length}</b></li>` : '') +
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
