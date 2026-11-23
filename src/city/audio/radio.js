/* The radio: Bloc FM (Mauro's own songs, website only), two stations made in code (Lo-Fi Study, Night Drive),
   and off. Stations run on a shared clock, so tuning back finds them further along, like real radio.
   Switching crossfades over 1.2 s. The radio plays in cars and the plane, and fades out when you get out. */
const BASE = new URL('./', import.meta.url).href;

export class Radio {
  constructor(audio, native) {
    this.A = audio; this.native = native; this.cur = 'off'; this.fm = null; this.on = true; this.vol = 0.55;
    try { const s = localStorage.getItem('bloc:city:radio'); if (s) this.cur = s; } catch (e) { /* ignore */ }
    this.list = [{ id: 'off', name: 'Radio off' }, { id: 'lofi', name: 'Lo-Fi Study' }, { id: 'night', name: 'Night Drive' }];
    if (!native) fetch(BASE + 'radio/blocfm/list.json?v=' + __V__).then((r) => (r.ok ? r.json() : null)).then((d) => { if (d && d.tracks && d.tracks.length) { this.fm = d; this.list.splice(1, 0, { id: 'blocfm', name: 'Bloc FM' }); } }).catch(() => {});
    this.st = {}; this.inVehicle = false; this.epoch = Date.UTC(2026, 0, 1);
  }
  ensure() {
    const c = this.A.ctx; if (!c || this.bus) return !!this.bus;
    this.bus = c.createGain(); this.bus.gain.value = 0; this.bus.connect(this.A.music);
    /* radio speakers: a little band-limited, like a car stereo */
    return true;
  }
  stationName(id) { const s = this.list.find((x) => x.id === id); return s ? s.name : ''; }
  nowPlaying() {
    if (this.cur === 'blocfm' && this.st.blocfm && this.st.blocfm.track) return this.st.blocfm.track.title;
    return '';
  }
  tune(id) {
    if (!this.ensure()) { this.cur = id; return; }
    if (id === this.cur && this.st[id]) return;
    const old = this.st[this.cur], t = this.A.ctx.currentTime;
    if (old) { old.g.gain.cancelScheduledValues(t); old.g.gain.setTargetAtTime(0, t, 0.35); const o = old; setTimeout(() => this.stop(o), 1600); delete this.st[this.cur]; }
    this.cur = id; try { localStorage.setItem('bloc:city:radio', id); } catch (e) { /* ignore */ }
    if (id === 'off') return;
    const s = this.st[id] = this.start(id);
    if (s) { s.g.gain.value = 0; s.g.gain.setTargetAtTime(1, t + 0.1, 0.4); }
  }
  start(id) {
    const c = this.A.ctx, g = c.createGain(); g.connect(this.bus);
    if (id === 'blocfm') return this.startFM(g);
    return this.startGen(id, g);
  }
  stop(s) { try { if (s.el) { s.el.pause(); s.el.src = ''; } if (s.timer) clearInterval(s.timer); if (s.nodes) s.nodes.forEach((n) => { try { n.stop ? n.stop() : n.disconnect(); } catch (e) { /* gone */ } }); s.g.disconnect(); } catch (e) { /* ignore */ } }
  /* ---- Bloc FM: the shared clock picks the song and the second ---- */
  startFM(g) {
    const d = this.fm; if (!d) return null;
    const el = new Audio(); el.crossOrigin = 'anonymous'; el.preload = 'auto';
    const src = this.A.ctx.createMediaElementSource(el); src.connect(g);
    const s = { g, el, track: null };
    const total = d.tracks.reduce((a, t) => a + t.dur + 2, 0);
    const pick = () => {
      let pos = ((Date.now() - this.epoch) / 1000) % total, i = 0;
      while (pos > d.tracks[i].dur + 2) { pos -= d.tracks[i].dur + 2; i = (i + 1) % d.tracks.length; }
      return { i, at: Math.min(pos, d.tracks[i].dur - 1) };
    };
    const play = (i, at) => { const t = d.tracks[i]; s.track = t; s.i = i; el.src = BASE + 'radio/blocfm/' + t.file + '?v=' + __V__; el.currentTime = at; el.play().catch(() => {}); if (this.onTrack) this.onTrack(t.title); };
    const p = pick(); el.addEventListener('loadedmetadata', function f() { el.removeEventListener('loadedmetadata', f); try { el.currentTime = p.at; } catch (e) { /* ignore */ } });
    play(p.i, p.at);
    el.addEventListener('ended', () => setTimeout(() => play((s.i + 1) % d.tracks.length, 0), 1500));
    return s;
  }
  /* ---- stations made in code: drums, bass and chords scheduled a bar ahead ---- */
  startGen(id, g) {
    const c = this.A.ctx, lofi = id === 'lofi', bpm = lofi ? 78 : 104, beat = 60 / bpm, bar = beat * 4;
    const s = { g, nodes: [], bar: 0 };
    const master = c.createBiquadFilter(); master.type = 'lowpass'; master.frequency.value = lofi ? 3800 : 9000; master.connect(g);
    /* vinyl crackle on lo-fi, a long reverb-ish delay on night drive */
    if (lofi) {
      const n = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() < 0.0009 ? (Math.random() - 0.5) * 0.6 : (Math.random() - 0.5) * 0.012;
      const src = c.createBufferSource(); src.buffer = n; src.loop = true; const cg = c.createGain(); cg.gain.value = 0.5; src.connect(cg).connect(master); src.start(); s.nodes.push(src);
    }
    const delay = c.createDelay(1); delay.delayTime.value = beat * 0.75; const fb = c.createGain(); fb.gain.value = lofi ? 0.18 : 0.35; const wet = c.createGain(); wet.gain.value = lofi ? 0.15 : 0.28;
    delay.connect(fb).connect(delay); delay.connect(wet).connect(master);
    const noise = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate), nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const kick = (t, v = 1) => { const o = c.createOscillator(), e = c.createGain(); o.frequency.setValueAtTime(lofi ? 110 : 140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); e.gain.setValueAtTime(0.9 * v, t); e.gain.exponentialRampToValueAtTime(0.001, t + 0.38); o.connect(e).connect(master); o.start(t); o.stop(t + 0.4); };
    const snare = (t, v = 1) => { const b = c.createBufferSource(), f = c.createBiquadFilter(), e = c.createGain(); b.buffer = noise; f.type = 'bandpass'; f.frequency.value = lofi ? 1700 : 2200; f.Q.value = 0.7; e.gain.setValueAtTime(0.5 * v, t); e.gain.exponentialRampToValueAtTime(0.001, t + (lofi ? 0.18 : 0.22)); b.connect(f).connect(e).connect(master); e.connect(delay); b.start(t); b.stop(t + 0.25); };
    const hat = (t, v = 1) => { const b = c.createBufferSource(), f = c.createBiquadFilter(), e = c.createGain(); b.buffer = noise; f.type = 'highpass'; f.frequency.value = 7500; e.gain.setValueAtTime(0.14 * v, t); e.gain.exponentialRampToValueAtTime(0.001, t + 0.05); b.connect(f).connect(e).connect(master); b.start(t); b.stop(t + 0.06); };
    const note = (t, f, dur, type, vol, cut, send) => { const o = c.createOscillator(), o2 = c.createOscillator(), fl = c.createBiquadFilter(), e = c.createGain(); o.type = type; o2.type = type; o.frequency.value = f; o2.frequency.value = f * 1.004; fl.type = 'lowpass'; fl.frequency.value = cut; e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.08, dur * 0.3)); e.gain.setTargetAtTime(0.0001, t + dur * 0.7, dur * 0.25); o.connect(fl); o2.connect(fl); fl.connect(e).connect(master); if (send) e.connect(delay); o.start(t); o2.start(t); o.stop(t + dur * 1.4); o2.stop(t + dur * 1.4); };
    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    /* chord progressions (MIDI roots and 7th-chord shapes) */
    const prog = lofi ? [[57, [0, 3, 7, 10]], [62, [0, 3, 7, 10]], [55, [0, 4, 7, 11]], [60, [0, 4, 7, 9]]] : [[57, [0, 3, 7]], [53, [0, 4, 7]], [60, [0, 4, 7]], [55, [0, 4, 7]]];
    let rnd = Math.floor((Date.now() - this.epoch) / (bar * 1000));
    const R = () => { rnd = (rnd * 1103515245 + 12345) & 0x7fffffff; return rnd / 0x7fffffff; };
    let next = c.currentTime + 0.1;
    const sched = () => {
      while (next < c.currentTime + bar * 1.2) {
        const t0 = next, k = s.bar % prog.length, [root, shape] = prog[k], swing = lofi ? beat * 0.08 : 0;
        for (let b = 0; b < 4; b++) {
          const tb = t0 + b * beat;
          if (b === 0 || (b === 2 && (lofi ? R() < 0.5 : true))) kick(tb);
          if (lofi && b === 2 && R() < 0.4) kick(tb + beat * 0.5, 0.7);
          if (b === 1 || b === 3) snare(tb, lofi ? 0.8 : 1);
          for (let h = 0; h < (lofi ? 2 : 4); h++) hat(tb + h * beat / (lofi ? 2 : 4) + (h % 2 ? swing : 0), h % 2 ? 0.6 : 1);
        }
        /* chords */
        for (const iv of shape) note(t0, hz(root + iv), bar * 0.95, lofi ? 'triangle' : 'sawtooth', lofi ? 0.045 : 0.03, lofi ? 1400 : 2400, true);
        /* bass */
        for (let b = 0; b < 4; b++) if (b !== 1 || !lofi) note(t0 + b * beat, hz(root - 24 + (b === 3 && R() < 0.5 ? 7 : 0)), beat * 0.9, lofi ? 'sine' : 'square', lofi ? 0.16 : 0.07, lofi ? 500 : 700, false);
        /* melody: lo-fi keys, night drive arpeggio */
        if (lofi) { for (let b = 0; b < 4; b++) if (R() < 0.45) note(t0 + b * beat + (R() < 0.5 ? beat / 2 : 0), hz(root + 12 + shape[Math.floor(R() * shape.length)]), beat * 0.8, 'sine', 0.05, 2600, true); }
        else for (let n8 = 0; n8 < 8; n8++) note(t0 + n8 * beat / 2, hz(root + 12 + [0, 7, 12, 7, 3, 7, 12, 15][n8] - (shape[1] === 4 && [4, 12].includes(n8) ? 0 : 0)), beat / 2 * 0.9, 'square', 0.022, 3200, true);
        next += bar; s.bar++;
      }
    };
    sched(); s.timer = setInterval(sched, 250);
    return s;
  }
  /* in a vehicle the radio plays; on foot it fades out */
  setVehicle(v) {
    if (!this.ensure()) return;
    this.inVehicle = v; const t = this.A.ctx.currentTime;
    this.bus.gain.setTargetAtTime(v ? this.vol : 0, t, v ? 0.5 : 0.3);
    if (v && this.cur !== 'off' && !this.st[this.cur]) { const id = this.cur; this.cur = 'off'; this.tune(id); }
  }
}
