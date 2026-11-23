/* Sound made in code, so it is all ours: the engine (pitch follows rpm through a simple gearbox), tyre squeal,
   wind, impacts, chimes. The radio (stage 8) plugs into the same graph. Audio starts on the first tap or key. */
export class Audio {
  constructor() {
    this.ctx = null; this.on = true; this.vol = 0.8;
    try { this.on = localStorage.getItem('bloc:city:sound') !== '0'; } catch (e) { /* private mode */ }
    const start = () => { this.start(); window.removeEventListener('pointerdown', start, true); window.removeEventListener('keydown', start, true); };
    window.addEventListener('pointerdown', start, true); window.addEventListener('keydown', start, true);
  }
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.on ? this.vol : 0;
    this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 3;
    this.master.connect(this.comp).connect(c.destination);
    this.sfx = c.createGain(); this.sfx.connect(this.master);
    this.music = c.createGain(); this.music.connect(this.master);
    /* engine: two saws a fifth apart and a sub, shaped by a resonant lowpass */
    this.eng = c.createGain(); this.eng.gain.value = 0;
    this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.Q.value = 4;
    this.o1 = c.createOscillator(); this.o1.type = 'sawtooth';
    this.o2 = c.createOscillator(); this.o2.type = 'sawtooth';
    this.o3 = c.createOscillator(); this.o3.type = 'square';
    const g2 = c.createGain(); g2.gain.value = 0.5; const g3 = c.createGain(); g3.gain.value = 0.35;
    this.o1.connect(this.lp); this.o2.connect(g2).connect(this.lp); this.o3.connect(g3).connect(this.lp);
    this.lp.connect(this.eng).connect(this.sfx);
    [this.o1, this.o2, this.o3].forEach((o) => o.start());
    /* noise bed for wind and squeal */
    const n = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = n;
    const src = c.createBufferSource(); src.buffer = n; src.loop = true;
    this.windF = c.createBiquadFilter(); this.windF.type = 'lowpass'; this.windF.frequency.value = 500;
    this.wind = c.createGain(); this.wind.gain.value = 0;
    this.sqF = c.createBiquadFilter(); this.sqF.type = 'bandpass'; this.sqF.frequency.value = 1900; this.sqF.Q.value = 9;
    this.sq = c.createGain(); this.sq.gain.value = 0;
    src.connect(this.windF).connect(this.wind).connect(this.sfx);
    src.connect(this.sqF).connect(this.sq).connect(this.sfx);
    src.start();
    this.gear = 1;
  }
  setOn(v) { this.on = v; try { localStorage.setItem('bloc:city:sound', v ? '1' : '0'); } catch (e) { /* ignore */ } if (this.master) this.master.gain.setTargetAtTime(v ? this.vol : 0, this.ctx.currentTime, 0.05); }
  /* called every frame with the player's car */
  car(car, throttle, dt) {
    if (!this.ctx || !car) return;
    const t = this.ctx.currentTime, v = Math.abs(car.vf || 0), top = car.p ? car.p.top : 50;
    const ratios = [0, 0.22, 0.38, 0.55, 0.74, 1.0];
    let g = this.gear;
    const rpmOf = (gear) => Math.min(1.05, v / (top * ratios[gear]));
    if (rpmOf(g) > 0.92 && g < 5) g++; else if (g > 1 && rpmOf(g - 1) < 0.62) g--;
    this.gear = g;
    const rpm = 0.12 + Math.max(0, Math.min(1, rpmOf(g))) * 0.88, base = 38 + rpm * 120;
    this.o1.frequency.setTargetAtTime(base, t, 0.03); this.o2.frequency.setTargetAtTime(base * 1.5, t, 0.03); this.o3.frequency.setTargetAtTime(base * 0.5, t, 0.03);
    this.lp.frequency.setTargetAtTime(380 + rpm * 1800 + throttle * 900, t, 0.05);
    this.eng.gain.setTargetAtTime(car.air ? 0.07 : 0.05 + throttle * 0.06 + rpm * 0.03, t, 0.06);
    this.wind.gain.setTargetAtTime(Math.min(0.2, v * v / 9000), t, 0.2); this.windF.frequency.setTargetAtTime(300 + v * 25, t, 0.2);
    const slip = Math.abs(car.vl || 0), sq = !car.air && v > 6 ? Math.max(0, Math.min(1, (slip - 2.2) / 5)) : 0;
    this.sq.gain.setTargetAtTime(sq * 0.12, t, 0.04);
    void dt;
  }
  chime(f = 880) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g).connect(this.sfx); o.start(t); o.stop(t + 0.55);
  }
  hit(strength) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = 'lowpass'; f.frequency.value = 260 + strength * 40;
    const a = Math.min(0.9, 0.15 + strength / 30);
    g.gain.setValueAtTime(a, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35 + strength / 60);
    s.connect(f).connect(g).connect(this.sfx); s.start(t, Math.random()); s.stop(t + 0.8);
    /* a metallic ring on harder crashes */
    if (strength > 8) { const o = c.createOscillator(), og = c.createGain(); o.type = 'square'; o.frequency.value = 180 + Math.random() * 90; og.gain.setValueAtTime(0.06, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(og).connect(this.sfx); o.start(t); o.stop(t + 0.32); }
  }
  /* a two-tone wail that gets louder as the patrol gets closer */
  siren(dist) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    if (!this.sir) {
      const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(); o.type = 'sawtooth'; f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 1.4; g.gain.value = 0;
      o.connect(f).connect(g).connect(this.sfx); o.start(); this.sir = { o, g };
    }
    const vol = dist > 260 ? 0 : Math.min(0.11, 0.11 * (1 - dist / 260) + 0.01);
    this.sir.g.gain.setTargetAtTime(vol, t, 0.2);
    if (vol > 0) this.sir.o.frequency.setTargetAtTime(Math.floor(t / 0.55) % 2 ? 960 : 720, t, 0.06);
  }
  honk() {
    if (!this.ctx || performance.now() - (this.lastHonk || 0) < 900) return; this.lastHonk = performance.now();
    const c = this.ctx, t = c.currentTime, g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.02); g.gain.setValueAtTime(0.12, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800; f.connect(g); g.connect(this.sfx);
    for (const fr of [392, 494]) { const o = c.createOscillator(); o.type = 'square'; o.frequency.value = fr; o.connect(f); o.start(t); o.stop(t + 0.42); }
  }
  /* a gunshot made from noise: a sharp crack, a body thump and a tail that rings off the buildings.
     kind changes the colour (pistol, smg, shotgun, rifle); dist (m) makes far shots duller and quieter. */
  shot(kind = 'pistol', dist = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime, P = { pistol: [2600, 0.45, 0.5], smg: [3400, 0.32, 0.32], shotgun: [1400, 0.75, 0.9], rifle: [3000, 0.6, 0.7] }[kind] || [2600, 0.45, 0.5];
    const far = Math.max(0.05, 1 - dist / 320), cut = P[0] * (0.35 + 0.65 * far);
    const crack = c.createBufferSource(), cf = c.createBiquadFilter(), cg = c.createGain();
    crack.buffer = this.noise; cf.type = 'highpass'; cf.frequency.value = Math.min(cut, 1800) * 0.6;
    cg.gain.setValueAtTime(0.9 * P[1] * far, t); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    crack.connect(cf).connect(cg).connect(this.sfx); crack.start(t, Math.random()); crack.stop(t + 0.1);
    const body = c.createBufferSource(), bf = c.createBiquadFilter(), bg = c.createGain();
    body.buffer = this.noise; bf.type = 'lowpass'; bf.frequency.value = cut * 0.35;
    bg.gain.setValueAtTime(1.1 * P[1] * far, t); bg.gain.exponentialRampToValueAtTime(0.0001, t + P[2]);
    body.connect(bf).connect(bg).connect(this.sfx); body.start(t, Math.random()); body.stop(t + P[2] + 0.05);
    const o = c.createOscillator(), og = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    og.gain.setValueAtTime(0.5 * P[1] * far, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); o.connect(og).connect(this.sfx); o.start(t); o.stop(t + 0.18);
    /* a slap back from the street a moment later */
    const echo = c.createBufferSource(), ef = c.createBiquadFilter(), eg = c.createGain();
    echo.buffer = this.noise; ef.type = 'bandpass'; ef.frequency.value = 700; ef.Q.value = 0.8;
    eg.gain.setValueAtTime(0.0001, t); eg.gain.exponentialRampToValueAtTime(0.18 * P[1] * far, t + 0.09); eg.gain.exponentialRampToValueAtTime(0.0001, t + 0.09 + P[2] * 1.4);
    echo.connect(ef).connect(eg).connect(this.sfx); echo.start(t, Math.random()); echo.stop(t + 0.15 + P[2] * 1.4);
  }
  /* a helicopter overhead: low noise chopped about 17 times a second, louder as it gets closer */
  rotor(dist) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    if (!this.rot) {
      const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
      const chop = c.createGain(); chop.gain.value = 0.5; const lfo = c.createOscillator(); lfo.frequency.value = 17; const depth = c.createGain(); depth.gain.value = 0.5; lfo.connect(depth).connect(chop.gain);
      const g = c.createGain(); g.gain.value = 0; s.connect(f).connect(chop).connect(g).connect(this.sfx); s.start(); lfo.start(); this.rot = { g };
    }
    const vol = dist > 400 ? 0 : Math.min(0.32, 0.32 * (1 - dist / 400));
    this.rot.g.gain.setTargetAtTime(vol, t, 0.3);
  }
  /* small mechanical sounds: reload, empty click, a bullet hitting metal */
  click(kind = 'empty') {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const parts = kind === 'reload' ? [[0, 1400, 0.12], [0.35, 900, 0.16], [0.62, 2200, 0.14]] : kind === 'metal' ? [[0, 3200, 0.1]] : [[0, 2600, 0.08]];
    for (const [d, f, a] of parts) {
      const s = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noise; bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 6;
      g.gain.setValueAtTime(a, t + d); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.05);
      s.connect(bp).connect(g).connect(this.sfx); s.start(t + d, Math.random()); s.stop(t + d + 0.07);
      if (kind === 'metal') { const o = c.createOscillator(), og = c.createGain(); o.type = 'triangle'; o.frequency.value = 1700 + Math.random() * 900; og.gain.setValueAtTime(0.05, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.25); o.connect(og).connect(this.sfx); o.start(t); o.stop(t + 0.26); }
    }
  }
  /* the engine fades while a menu or the map is open */
  duck(on) { if (this.eng) this.eng.gain.setTargetAtTime(on ? 0 : 0.05, this.ctx.currentTime, 0.1); }
}
