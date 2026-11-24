/* Your phone in Bloc City (v7.6): press P or tap Phone. Apps: Missions (what's next, and call Rosa from anywhere),
   Camera (photo mode: the HUD hides, the world pauses, drag to move around you, the shutter saves a PNG), Map, Radio,
   and Help with the keys. */
import { T } from './i18n.js';
import { MISSIONS } from './missions.js';

export class Phone {
  constructor(game) {
    this.g = game; this.el = null; this.photo = null;
    game.input.on('KeyP', () => (this.el ? this.close() : this.open()));
    const btns = game.ui.el.querySelector('.bc-btns');
    if (btns) { const b = document.createElement('button'); b.type = 'button'; b.className = 'bc-btn'; b.textContent = T('phone'); b.addEventListener('click', (e) => { e.stopPropagation(); this.el ? this.close() : this.open(); }); btns.insertBefore(b, btns.firstChild); }
  }
  open(app) {
    const g = this.g; if (g.sheets.el || this.photo) return;
    this.close();
    const el = document.createElement('div'); el.className = 'bc-phone';
    g.ui.el.appendChild(el); this.el = el; g.paused = true;
    el.addEventListener('click', (e) => {
      const a = e.target.closest('[data-app]'); if (a) { this.app(a.dataset.app); return; }
      if (e.target.closest('[data-home]')) { this.home(); return; }
      if (e.target.closest('[data-x]')) this.close();
      const call = e.target.closest('[data-call]'); if (call) { this.close(); this.callRosa(); }
      const shot = e.target.closest('[data-shot]'); if (shot) { this.close(); this.photoMode(); }
    });
    app ? this.app(app) : this.home();
  }
  close() { if (this.el) { this.el.remove(); this.el = null; this.g.paused = false; } }
  frame(title, body) {
    const now = new Date(), hh = String(now.getHours()).padStart(2, '0'), mm = String(now.getMinutes()).padStart(2, '0');
    this.el.innerHTML = `<div class="bc-phone-in" role="dialog" aria-label="${T('phone')}"><div class="bc-phone-top"><span>${hh}:${mm}</span><b>${title}</b><button type="button" data-x aria-label="${T('close')}">✕</button></div><div class="bc-phone-body">${body}</div><button type="button" class="bc-phone-home" data-home aria-label="${T('home_screen')}"></button></div>`;
  }
  home() {
    const apps = [['missions', '◎'], ['camera', '◉'], ['map', '⌖'], ['radio', '♫'], ['help', '?']];
    this.frame('Bloc', `<div class="bc-apps">${apps.map(([id, ic]) => `<button type="button" data-app="${id}"><i>${ic}</i><span>${T('app_' + id)}</span></button>`).join('')}</div>`);
  }
  app(id) {
    const g = this.g;
    if (id === 'map') { this.close(); g.toggleMap(); return; }
    if (id === 'radio') { this.close(); if (g.radio) g.openWheel(); return; }
    if (id === 'camera') { this.frame(T('app_camera'), `<p>${T('cam_sub')}</p><button type="button" class="bc-btn wide" data-shot>${T('cam_go')}</button>`); return; }
    if (id === 'help') {
      const keys = [['WASD', 'k_move'], ['Shift', 'k_run'], ['Space', 'k_drift'], ['F', 'k_car'], ['E', 'k_use'], ['J', 'k_punch'], ['G', 'k_gun'], ['Tab', 'k_wheel'], ['+ −', 'k_zoom'], ['Q', 'k_radio'], ['V', 'k_view'], ['M', 'k_map'], ['P', 'k_phone']];
      this.frame(T('app_help'), `<ul class="bc-keys">${keys.filter(([, k]) => !(g.native && (k === 'k_gun' || k === 'k_wheel'))).map(([a, k]) => `<li><kbd>${a}</kbd><span>${T(k)}</span></li>`).join('')}</ul>`); return;
    }
    if (id === 'missions') {
      const M = g.missions, list = MISSIONS.filter((m) => !(m.web && g.native));
      const rows = list.map((m) => { const done = M.done.has(m.id), cur = M.cur && M.cur.id === m.id;
        return `<li class="${done ? 'done' : cur ? 'on' : ''}"><b>${T('mi_' + m.id)}</b><small>${done ? T('mi_state_done') : cur ? M.objective() : m.side ? T('mi_state_side') : T('mi_state_open')}</small></li>`; }).join('');
      this.frame(T('app_missions'), `<ul class="bc-mis">${rows}</ul><button type="button" class="bc-btn wide" data-call>${T('call_rosa')}</button>`);
    }
  }
  /* Rosa on the phone: she gives you the next mission wherever you are (or tells you what you're doing) */
  callRosa() {
    const M = this.g.missions;
    if (M.cur) { M.line('mi_busy'); return; }
    const m = MISSIONS.find((x) => !M.done.has(x.id) && !x.side) || M.side();
    if (!m) { M.line('mi_all'); return; }
    if (m.steps[0].k === 'rosa') { M.line('mi_come'); return; }
    M.start(m);
  }
  /* photo mode */
  photoMode() {
    const g = this.g, cam = g.camera, f = g.focus();
    this.photo = { yaw: Math.atan2(cam.position.x - f.x, cam.position.z - f.z), pitch: 0.25, dist: Math.max(4, Math.hypot(cam.position.x - f.x, cam.position.z - f.z)), f };
    g.paused = true; g.ui.el.classList.add('photo');
    const bar = document.createElement('div'); bar.className = 'bc-photo';
    bar.innerHTML = `<button type="button" class="bc-btn" data-out>${T('cam_exit')}</button><button type="button" class="bc-shutter" data-snap aria-label="${T('cam_snap')}"></button><span>${T('cam_drag')}</span>`;
    g.ui.el.appendChild(bar); this.bar = bar;
    let drag = null;
    const down = (e) => { if (e.target.closest('button')) return; drag = { x: e.clientX, y: e.clientY }; };
    const move = (e) => { if (!drag) return; const P = this.photo; P.yaw -= (e.clientX - drag.x) * 0.006; P.pitch = Math.max(-0.1, Math.min(1.3, P.pitch + (e.clientY - drag.y) * 0.004)); drag = { x: e.clientX, y: e.clientY }; this.place(); };
    const up = () => { drag = null; };
    const wheel = (e) => { this.photo.dist = Math.max(2, Math.min(40, this.photo.dist * (e.deltaY > 0 ? 1.1 : 0.9))); this.place(); };
    g.root.addEventListener('pointerdown', down); window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); g.root.addEventListener('wheel', wheel, { passive: true });
    this.unbind = () => { g.root.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); g.root.removeEventListener('wheel', wheel); };
    bar.addEventListener('click', (e) => { if (e.target.closest('[data-out]')) this.photoEnd(); else if (e.target.closest('[data-snap]')) this.snap(); });
    this.place();
  }
  place() {
    const P = this.photo, cam = this.g.camera, y = (P.f.y || 0) + 1.2;
    cam.position.set(P.f.x + Math.sin(P.yaw) * Math.cos(P.pitch) * P.dist, y + Math.sin(P.pitch) * P.dist, P.f.z + Math.cos(P.yaw) * Math.cos(P.pitch) * P.dist);
    cam.lookAt(P.f.x, y, P.f.z);
  }
  /* the next frame the renderer draws is read back into a PNG (see main.js) */
  snap() {
    const g = this.g; g.wantShot = (blob) => {
      if (!blob) { g.say(T('try_again')); return; }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'bloc-city-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.png';
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      if (g.audio) g.audio.click('reload');
      this.bar.classList.add('flash'); setTimeout(() => this.bar && this.bar.classList.remove('flash'), 200);
    };
  }
  photoEnd() {
    const g = this.g; if (!this.photo) return;
    this.unbind(); this.bar.remove(); this.bar = null; this.photo = null;
    g.ui.el.classList.remove('photo'); g.paused = false; g.cam.init = false; g.fcam.placed = false;
  }
}
