/* What people say: subtitles in English or Spanish, voices from pre-recorded bundles (made with Kokoro, Apache-2.0),
   chats between strangers, and conversations where you pick what to answer.
   Data: city/talk/lines.json. Audio: city/talk/audio/<lang>-<n>.mp3 with an index of offsets. */
import { LANG, T } from './i18n.js';

const BASE = new URL('./', import.meta.url).href;
const NAMES = { f: ['Lucía', 'Carmen', 'Sofía', 'Marta', 'Paula', 'Elena', 'Nuria', 'Inés', 'Alba', 'Rocío', 'Julia', 'Sara', 'Irene', 'Claudia', 'Noa', 'Vera', 'Aitana', 'Olivia'],
  m: ['Javi', 'Dani', 'Pablo', 'Álvaro', 'Hugo', 'Marcos', 'Rubén', 'Sergio', 'Diego', 'Iván', 'Adrián', 'Mario', 'Óscar', 'Raúl', 'Nico', 'Leo', 'Gonzalo', 'Bruno'] };

export class Talk {
  constructor(game) {
    this.g = game; this.data = null; this.index = null; this.bufs = new Map(); this.recent = []; this.busy = 0; this.convo = null;
    const el = document.createElement('div'); el.className = 'bc-subtitle'; el.setAttribute('aria-live', 'polite'); game.ui.el.appendChild(el); this.el = el;
    this.load();
  }
  async load() {
    try {
      const [d, idx] = await Promise.all([fetch(BASE + 'talk/lines.json?v=' + __V__).then((r) => r.json()), fetch(BASE + 'talk/audio/index.json?v=' + __V__).then((r) => (r.ok ? r.json() : null)).catch(() => null)]);
      this.data = d; this.index = idx;
    } catch (e) { this.data = null; }
  }
  nameOf(p) { if (p.i == null) return null; if (!p.name) { const list = NAMES[p.voice] || NAMES.f; p.name = list[(p.i * 7 + 3) % list.length]; } return p.name; }
  pick(cat, voice) {
    const d = this.data; if (!d || !d.cats[cat]) return null;
    let ids = d.cats[cat].filter((id) => !voice || d.lines[id].v === voice);
    if (!ids.length) ids = d.cats[cat];
    const fresh = ids.filter((id) => !this.recent.includes(id));
    const id = (fresh.length ? fresh : ids)[Math.floor(Math.random() * (fresh.length ? fresh : ids).length)];
    this.recent.push(id); if (this.recent.length > 60) this.recent.shift();
    return id;
  }
  text(id) { const l = this.data.lines[id]; return l ? l[LANG.v] || l.en : ''; }
  /* play one line from a person (or a position), with a subtitle; resolves when it's done */
  say(who, id, opts = {}) {
    if (!id || !this.data) return Promise.resolve();
    const line = this.data.lines[id], text = line[LANG.v] || line.en, name = opts.name || (who && who.i != null ? this.nameOf(who) : null);
    const me = this.g.me(), dist = who ? Math.hypot(who.x - me.x, who.z - me.z) : 0;
    if (dist > (opts.range || 22)) return Promise.resolve();
    this.show(name, text);
    const dur = this.play(id, dist, line.v);
    const wait = Math.max(1.4, dur || 0.9 + text.length * 0.055);
    return new Promise((ok) => setTimeout(() => { this.hide(text); ok(); }, wait * 1000));
  }
  show(name, text) { this.el.textContent = ''; if (name) { const b = document.createElement('b'); b.textContent = name + ': '; this.el.appendChild(b); } this.el.appendChild(document.createTextNode(text)); this.el.classList.add('on'); this.shown = text; }
  hide(text) { if (this.shown === text) this.el.classList.remove('on'); }
  play(id, dist, voice) {
    const A = this.g.audio; if (!A || !A.ctx || !this.index) return 0;
    const ent = this.index[LANG.v] && this.index[LANG.v][id]; if (!ent) return 0;
    const [b, start, dur] = ent, key = LANG.v + '-' + b;
    const go = (buf) => {
      const src = A.ctx.createBufferSource(), g = A.ctx.createGain();
      src.buffer = buf; g.gain.value = Math.max(0.15, 1 - dist / 24) * 1.3;
      src.connect(g).connect(A.sfx); src.start(0, start, dur);
    };
    if (this.bufs.get(key) instanceof AudioBuffer) go(this.bufs.get(key));
    else if (!this.bufs.has(key)) {
      this.bufs.set(key, fetch(BASE + 'talk/audio/' + key + '.mp3?v=' + __V__).then((r) => r.arrayBuffer()).then((ab) => A.ctx.decodeAudioData(ab)).then((buf) => { this.bufs.set(key, buf); return buf; }).catch(() => null));
      this.bufs.get(key).then((buf) => buf && go(buf));
    } else this.bufs.get(key).then((buf) => buf && go(buf));
    void voice;
    return dur;
  }
  /* one remark from a passer-by, rate-limited so the street isn't a chorus */
  remark(p, cat) { const now = performance.now(); if (now < this.busy) return; this.busy = now + 2500; this.say(p, this.pick(cat, p.voice)); }
  /* two strangers chatting: a short scripted exchange, only voiced if you're close */
  async pair(a, b) {
    if (!this.data || this.convo) return;
    const me = this.g.me(); if (Math.hypot(a.x - me.x, a.z - me.z) > 16 || performance.now() < this.busy) return;
    const list = this.data.pairs, d = list[Math.floor(Math.random() * list.length)];
    this.busy = performance.now() + 30000;
    /* each line has a voice; give it to whichever of the two matches, else alternate */
    for (const [k, id] of d.entries()) {
      const v = this.data.lines[id].v, who = a.voice === b.voice ? (k % 2 ? b : a) : (a.voice === v ? a : b);
      if (a.state !== 'talk') break;
      await this.say(who, id, { range: 18 });
      await new Promise((ok) => setTimeout(ok, 250));
    }
    this.busy = performance.now() + 4000;
  }
  /* you talk to someone: their opener, three answers, their reply */
  converse(p) {
    if (!this.data || this.convo) return;
    const pool = this.data.convos.filter((x) => x.v === p.voice), c = (pool.length ? pool : this.data.convos)[Math.floor(Math.random() * (pool.length || this.data.convos.length))];
    p.state = 'chat'; p.t = 0; const me = this.g.me(); p.face = Math.atan2(me.x - p.x, me.z - p.z);
    this.convo = { p, c };
    this.say(p, c.open).then(() => {
      if (!this.convo || this.convo.p !== p) return;
      const box = document.createElement('div'); box.className = 'bc-choices';
      box.innerHTML = c.choices.map((ch, i) => `<button type="button" data-ch="${i}"><kbd>${i + 1}</kbd> ${escapeHtml(ch[LANG.v] || ch.en)}</button>`).join('');
      this.g.ui.el.appendChild(box); this.box = box;
      const choose = (i) => { const ch = c.choices[i]; if (!ch) return; this.closeBox(); this.say(p, ch.reply).then(() => this.end()); };
      box.addEventListener('click', (e) => { const b = e.target.closest('[data-ch]'); if (b) choose(+b.dataset.ch); });
      this.keys = (e) => { if (/^Digit[123]$/.test(e.code)) { e.preventDefault(); choose(+e.code.slice(5) - 1); } };
      window.addEventListener('keydown', this.keys, true);
      this.timer = setTimeout(() => { this.closeBox(); this.end(); }, 14000);
    });
  }
  closeBox() { if (this.box) { this.box.remove(); this.box = null; } if (this.keys) { window.removeEventListener('keydown', this.keys, true); this.keys = null; } clearTimeout(this.timer); }
  end() { if (this.convo) { const p = this.convo.p; if (p.state === 'chat') p.state = 'walk'; p.face = null; } this.convo = null; }
  cancel() { this.closeBox(); this.end(); }
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
void T;
