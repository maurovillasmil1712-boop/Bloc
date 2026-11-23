/* Keyboard, touch buttons and gamepads, merged into one set of controls. */
const KEYS = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'hand', ShiftLeft: 'run', ShiftRight: 'run' };
export class Input {
  constructor(root) {
    this.k = { up: 0, down: 0, left: 0, right: 0, hand: 0, run: 0 };
    this.pressed = new Set(); this.handlers = new Map(); this.raw = {};
    this.onKey = (e) => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      this.raw[e.code] = e.type === 'keydown' ? 1 : 0;
      const k = KEYS[e.code];
      if (k) { this.k[k] = e.type === 'keydown' ? 1 : 0; e.preventDefault(); return; }
      if (e.type === 'keydown' && !e.repeat) { const h = this.handlers.get(e.code); if (h) { e.preventDefault(); h(); } }
    };
    window.addEventListener('keydown', this.onKey, true); window.addEventListener('keyup', this.onKey, true);
    window.addEventListener('blur', () => { for (const key in this.k) this.k[key] = 0; this.raw = {}; });
    root.addEventListener('pointerdown', (e) => this.touchStart(e), { passive: false });
  }
  on(code, fn) { this.handlers.set(code, fn); }
  /* touch buttons carry data-in="up|down|left|right|hand" */
  touchStart(e) {
    const b = e.target.closest('[data-in]'); if (!b) return;
    e.preventDefault();
    const k = b.dataset.in; this.k[k] = 1; b.classList.add('on');
    try { b.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
    const off = () => { this.k[k] = 0; b.classList.remove('on'); b.removeEventListener('pointerup', off); b.removeEventListener('pointercancel', off); b.removeEventListener('lostpointercapture', off); };
    b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
  }
  /* analogue steering from a gamepad when one is plugged in */
  poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && pads[0];
    if (!p) return null;
    const ax = Math.abs(p.axes[0]) > 0.12 ? p.axes[0] : 0;
    return { steer: ax, throttle: p.buttons[7] ? p.buttons[7].value : 0, brake: p.buttons[6] ? p.buttons[6].value : 0, hand: p.buttons[0] && p.buttons[0].pressed ? 1 : 0 };
  }
  car() {
    const g = this.poll();
    const steer = (this.k.right - this.k.left) || (g ? g.steer : 0);
    return { steer, throttle: Math.max(this.k.up, g ? g.throttle : 0), brake: Math.max(this.k.down, g ? g.brake : 0), hand: this.k.hand || (g ? g.hand : 0) };
  }
  dispose() { window.removeEventListener('keydown', this.onKey, true); window.removeEventListener('keyup', this.onKey, true); }
}
