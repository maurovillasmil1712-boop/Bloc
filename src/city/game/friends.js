/* Friends in the city at the same time: every 2.5 s you send where you are and get back friends seen in the last
   12 s. They show up as their car, their character on foot or the plane, with their name, gliding between updates. */
import * as THREE from 'three/webgpu';
import { buildCar, carMaterials, makePaint } from '../actors/carmesh.js';
import { wheelsGeo } from '../actors/traffic.js';
import { Human } from '../actors/human.js';
import { Plane } from '../actors/plane.js';

export class Friends {
  constructor(game) { this.g = game; this.map = new Map(); this.t = 1; this.busy = false; this.off = false; }
  build(f) {
    const M = carMaterials();
    if (f.m === 'foot') { const h = new Human(f.look); return { obj: h.group, human: h }; }
    if (f.m === 'plane') { const p = new Plane(this.g.world); return { obj: p.group, plane: p }; }
    const type = { hatch: 'hatch', buggy: 'buggy', van: 'van', gt: 'gt' }[f.car] || 'hatch', p = buildCar(type), grp = new THREE.Group();
    for (const [geo, m] of [[p.paint, makePaint(f.color)], [p.glass, M.glass], [p.trim, M.trim], [p.light, M.light], [p.tail, M.tail], [wheelsGeo(p), M.tyre]]) { if (!geo) continue; const o = new THREE.Mesh(geo, m); o.castShadow = true; grp.add(o); }
    return { obj: grp };
  }
  async poll() {
    const g = this.g, me = g.me(), look = g.data.look || null;
    const pos = g.mode === 'plane' ? { x: g.plane.x, y: g.plane.y, z: g.plane.z, h: g.plane.yaw } : g.mode === 'car' ? { x: g.car.x, y: g.car.y, z: g.car.z, h: g.car.h } : { x: me.x, y: g.foot.y, z: me.z, h: g.foot.a };
    try {
      const r = await fetch('/api/farm/presence', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-MyIB': '1' }, body: JSON.stringify(Object.assign(pos, { m: g.rooms.inside ? 'foot' : g.mode, look })) });
      if (r.status === 400 || r.status === 401) { this.off = true; return; }
      if (!r.ok) return;
      const d = await r.json(), seen = new Set();
      for (const f of d.friends || []) {
        seen.add(f.id);
        let e = this.map.get(f.id);
        if (e && e.mode !== f.m) { this.g.scene.remove(e.obj); if (e.label) e.label.remove(); this.map.delete(f.id); e = null; }
        if (!e) {
          const b = this.build(f); e = Object.assign(b, { mode: f.m, x: f.x, y: f.y, z: f.z, h: f.h, tx: f.x, ty: f.y, tz: f.z, th: f.h, seen: 0 });
          this.g.scene.add(e.obj);
          e.label = document.createElement('div'); e.label.className = 'bc-label friend'; e.label.textContent = String(f.name).split(' ')[0]; this.g.ui.el.appendChild(e.label);
          this.map.set(f.id, e);
        }
        Object.assign(e, { tx: f.x, ty: f.y, tz: f.z, th: f.h, last: performance.now() });
      }
      for (const [id, e] of this.map) if (!seen.has(id) && performance.now() - e.last > 15000) { this.g.scene.remove(e.obj); e.label.remove(); this.map.delete(id); }
    } catch (e) { /* offline: try again later */ }
  }
  update(dt) {
    if (this.off) return;
    this.t -= dt;
    if (this.t <= 0 && !this.busy) { this.t = 2.5; this.busy = true; this.poll().finally(() => { this.busy = false; }); }
    for (const e of this.map.values()) {
      const k = Math.min(1, dt * 2.5);
      const sp = Math.hypot(e.tx - e.x, e.tz - e.z) / Math.max(0.016, dt);
      e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k; e.z += (e.tz - e.z) * k;
      let dh = e.th - e.h; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2; e.h += dh * k;
      e.obj.position.set(e.x, e.y, e.z); e.obj.rotation.y = e.h;
      if (e.human) e.human.animate(dt, { speed: Math.min(6, sp * k * 0.4) });
      this.g.label(e.label, e.x, e.y + (e.mode === 'foot' ? 2.2 : 2.6), e.z, 400);
    }
  }
}
