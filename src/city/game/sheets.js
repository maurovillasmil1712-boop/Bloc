/* The panels inside places: the clothing shop (clothes, body, hair) and the garage (cars and paint).
   Purchases go to POST /api/farm/act; the server checks coins and ownership. ?test=1 works offline. */
import { T } from './i18n.js';
import { FAKE_ARMS } from './arms.js';
import { FURN_IDS } from './interiors.js';

const FAKE = {
  outfits: [
    { id: 'tee-white', slot: 'top', kind: 'tee', c: '#F2F2EE', name: 'White tee', price: 0 }, { id: 'tee-yellow', slot: 'top', kind: 'tee', c: '#FFE14D', name: 'Highlighter tee', price: 60 },
    { id: 'hoodie-black', slot: 'top', kind: 'hoodie', c: '#1D1F24', name: 'Black hoodie', price: 260 }, { id: 'jacket-leather', slot: 'top', kind: 'jacket', c: '#2A201C', name: 'Leather jacket', price: 1200 },
    { id: 'jeans-blue', slot: 'bottom', kind: 'jeans', c: '#3B5578', name: 'Blue jeans', price: 0 }, { id: 'joggers-grey', slot: 'bottom', kind: 'joggers', c: '#7E8288', name: 'Grey joggers', price: 140 },
    { id: 'shorts-navy', slot: 'bottom', kind: 'shorts', c: '#283A5A', name: 'Navy shorts', price: 90 }, { id: 'shoes-white', slot: 'shoes', kind: 'sneaker', c: '#F4F4F2', name: 'White sneakers', price: 0 },
    { id: 'boots-brown', slot: 'shoes', kind: 'boot', c: '#5A3A24', name: 'Brown boots', price: 380 }, { id: 'hat-none', slot: 'hat', kind: 'none', c: '#000000', name: 'No hat', price: 0 },
    { id: 'cap-yellow', slot: 'hat', kind: 'cap', c: '#FFE14D', name: 'Bloc cap', price: 150 }, { id: 'beanie-orange', slot: 'hat', kind: 'beanie', c: '#D9692B', name: 'Orange beanie', price: 120 }
  ],
  skins: ['#F6D7C3', '#E8B896', '#C98E66', '#9A6440', '#6B4228', '#3F2718'], hairs: ['short', 'buzz', 'curly', 'long', 'bun', 'none'],
  hairColors: ['#1B1714', '#3B2A1E', '#6A4A2E', '#A7763F', '#D9B26B', '#B8433A', '#8E8E8E', '#EDEDED'],
  cars: [{ id: 'hatch', name: 'Hatchback', cost: 0, house: 0 }, { id: 'buggy', name: 'Beach Buggy', cost: 1500, house: 1 }, { id: 'van', name: 'Garden Van', cost: 2500, house: 2 }, { id: 'gt', name: 'Sunset GT', cost: 6000, house: 3 }, { id: 'moto', name: 'Street Bike', cost: 2200, house: 1 }],
  colors: ['#FFE14D', '#FF5A5F', '#3E9BD6', '#1E9E6A', '#F28C28', '#8C3B72', '#191D29', '#F3F4F6']
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class Sheets {
  constructor(game, test) {
    this.g = game; this.test = test; this.el = null; this.farm = null;
  }
  get cat() { return (this.g.data.cat && this.g.data.cat.outfits) ? this.g.data.cat : FAKE; }
  async load() {
    if (this.test) { if (!this.farm) this.farm = { coins: 2000, wardrobe: FAKE.outfits.filter((x) => !x.price).map((x) => x.id), outfit: { top: 'tee-white', bottom: 'jeans-blue', shoes: 'shoes-white', hat: 'hat-none' }, avatar: { skin: '#E8B896', hair: 'short', hairC: '#3B2A1E' }, cars: ['hatch'], car: this.g.data.car ? this.g.data.car.id : 'hatch', color: this.g.data.color || '#FFE14D', house: 3 }; return this.farm; }
    const r = await fetch('/api/farm', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('farm');
    const d = await r.json(); this.farm = d.farm || d; return this.farm;
  }
  async act(body) {
    if (this.test) {
      const f = this.farm, cat = this.cat;
      if (body.a === 'outfit') { const it = cat.outfits.find((x) => x.id === body.id); if (!f.wardrobe.includes(it.id)) { if (f.coins < it.price) throw new Error('coins'); f.coins -= it.price; f.wardrobe.push(it.id); } f.outfit[it.slot] = it.id; }
      if (body.a === 'avatar') Object.assign(f.avatar, Object.fromEntries(Object.entries(body).filter(([k]) => k !== 'a')));
      if (body.a === 'car') { const c = cat.cars.find((x) => x.id === body.id); if (!f.cars.includes(c.id)) { if (f.coins < c.cost) throw new Error('coins'); f.coins -= c.cost; f.cars.push(c.id); } f.car = c.id; }
      if (body.a === 'color') f.color = body.c;
      if (body.a === 'furn') { f.furn = f.furn || [...(this.g.rooms.furn || [])]; if (!f.furn.includes(body.id)) { if (f.coins < 200) throw new Error('coins'); f.coins -= 200; f.furn.push(body.id); } }
      if (body.a === 'plane') { if (!f.plane || !f.plane.own) { if (f.coins < 30000) throw new Error('coins'); f.coins -= 30000; } f.plane = { own: true, c: body.c }; }
      if (body.a === 'arm' || body.a === 'armour' || body.a === 'gore') {
        const A = f.arms = f.arms || { own: this.g.arms.own.slice(), armour: this.g.arms.armour, blood: false, asked: false };
        if (body.a === 'arm') { const w = FAKE_ARMS.find((x) => x.id === body.id); if (!A.own.includes(w.id)) { if (f.coins < w.price) throw new Error('coins'); f.coins -= w.price; A.own.push(w.id); } }
        if (body.a === 'armour' && !A.armour) { if (f.coins < 1200) throw new Error('coins'); f.coins -= 1200; A.armour = true; }
        if (body.a === 'gore') { A.asked = !!body.on; A.blood = false; }
      }
      f.look = this.lookOf(f); return f;
    }
    const r = await fetch('/api/farm/act', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-MyIB': '1' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'error');
    this.farm = d.farm || d; return this.farm;
  }
  lookOf(f) {
    const out = { skin: f.avatar.skin, hair: f.avatar.hair, hairC: f.avatar.hairC };
    for (const slot of ['top', 'bottom', 'shoes', 'hat']) { const it = this.cat.outfits.find((x) => x.id === f.outfit[slot]); if (it) out[slot] = { kind: it.kind, c: it.c }; }
    return out;
  }
  close() { if (this.el) { this.el.remove(); this.el = null; this.g.paused = false; } }
  frame(title, body) {
    this.close();
    const el = document.createElement('div'); el.className = 'bc-sheet';
    el.innerHTML = `<div class="bc-sheet-in" role="dialog" aria-label="${esc(title)}"><div class="bc-sheet-h"><b>${esc(title)}</b><span class="bc-coins"></span><button type="button" class="bc-btn" data-x>${T('close')}</button></div><div class="bc-sheet-b">${body}</div><p class="bc-sheet-msg" aria-live="polite"></p></div>`;
    el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('[data-x]')) this.close(); });
    this.g.ui.el.appendChild(el); this.el = el; this.g.paused = true;
    return el;
  }
  coins() { if (this.el && this.farm) this.el.querySelector('.bc-coins').textContent = this.farm.coins + ' ' + T('cash'); }
  say(t) { if (this.el) this.el.querySelector('.bc-sheet-msg').textContent = t; }
  err(e) { this.say(e.message === 'coins' ? T('no_coins') : e.message === 'house' ? T('need_house') : T('try_again')); }
  /* ---- the clothing shop ---- */
  async shop(tab = 'top') {
    const el = this.frame(T('place_shop'), `<div class="bc-tabs" role="tablist"></div><div class="bc-grid"></div>`);
    try { await this.load(); } catch (e) { this._err = String(e); this.say(T('try_again')); return; }
    const tabs = ['top', 'bottom', 'shoes', 'hat', 'body'];
    const draw = () => {
      this.coins();
      el.querySelector('.bc-tabs').innerHTML = tabs.map((t) => `<button type="button" role="tab" aria-selected="${t === tab}" data-tab="${t}">${T('slot_' + t)}</button>`).join('');
      const f = this.farm, cat = this.cat, grid = el.querySelector('.bc-grid');
      if (tab === 'body') {
        grid.innerHTML = `<h4>${T('skin')}</h4><div class="bc-sw">${cat.skins.map((c) => `<button type="button" aria-label="${c}" aria-pressed="${f.avatar.skin === c}" data-skin="${c}" style="background:${c}"></button>`).join('')}</div>` +
          `<h4>${T('hair')}</h4><div class="bc-chips">${cat.hairs.map((h) => `<button type="button" aria-pressed="${f.avatar.hair === h}" data-hair="${h}">${T('hair_' + h)}</button>`).join('')}</div>` +
          `<h4>${T('hair_colour')}</h4><div class="bc-sw">${cat.hairColors.map((c) => `<button type="button" aria-label="${c}" aria-pressed="${f.avatar.hairC === c}" data-hairc="${c}" style="background:${c}"></button>`).join('')}</div><p class="bc-free">${T('body_free')}</p>`;
      } else {
        grid.innerHTML = cat.outfits.filter((x) => x.slot === tab).map((x) => {
          const own = f.wardrobe.includes(x.id), wearing = f.outfit[x.slot] === x.id;
          return `<button type="button" class="bc-item${wearing ? ' on' : ''}" data-id="${x.id}"><i style="background:${x.kind === 'none' ? 'transparent' : x.c}"></i><span>${esc(x.name)}</span><small>${wearing ? T('wearing') : own ? T('owned') : x.price + ' ' + T('cash')}</small></button>`;
        }).join('');
      }
    };
    draw();
    el.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; draw(); return; }
      const b = e.target.closest('[data-id],[data-skin],[data-hair],[data-hairc]'); if (!b) return;
      const body = b.dataset.id ? { a: 'outfit', id: b.dataset.id } : { a: 'avatar', skin: b.dataset.skin, hair: b.dataset.hair, hairC: b.dataset.hairc };
      const it = b.dataset.id && this.cat.outfits.find((x) => x.id === b.dataset.id);
      try { await this.act(body); this.g.setLook(this.farm.look || this.lookOf(this.farm)); this.say(it && !it.price ? '' : it ? T('bought', { n: it.name }) : ''); draw(); }
      catch (x) { this.err(x); }
    });
  }
  /* ---- your flat: order furniture from the laptop on the desk ---- */
  async flat() {
    const el = this.frame(T('furn_title'), `<p class="bc-note">${T('furn_sub')}</p><div class="bc-grid furn"></div>`);
    try { await this.load(); } catch (e) { this.say(T('try_again')); return; }
    const cat = (this.g.data.cat && this.g.data.cat.furn) || FURN_IDS.map((id, i) => ({ id, name: T('furn_' + id), price: [220, 150, 200, 350, 280, 300, 450, 800, 650, 700, 900, 2000][i] }));
    const draw = () => {
      this.coins();
      const own = this.farm.furn || [...(this.g.rooms.furn || [])];
      el.querySelector('.furn').innerHTML = cat.map((x) => `<button type="button" class="bc-item${own.includes(x.id) ? ' on' : ''}" data-furn="${x.id}"><span>${esc(T('furn_' + x.id))}</span><small>${own.includes(x.id) ? T('furn_home') : T('arms_buy', { p: x.price })}</small></button>`).join('');
    };
    draw();
    el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-furn]'); if (!b) return;
      const own = this.farm.furn || [...(this.g.rooms.furn || [])]; if (own.includes(b.dataset.furn)) return;
      try { await this.act({ a: 'furn', id: b.dataset.furn }); this.g.rooms.setFurn(this.farm.furn); this.say(T('bought', { n: T('furn_' + b.dataset.furn) })); this.g.talk.say(null, this.g.talk.pick('furn_delivery'), { name: T('courier') }); draw(); }
      catch (x) { this.err(x); }
    });
  }
  /* ---- Bullseye Range: weapons, armour and the blood setting (website only) ---- */
  async arms() {
    const A = this.g.arms;
    if (A.off) { this.g.say(T('web_arms')); return; }
    const el = this.frame(T('arms_title'), `<h4>${T('arms_weapons')}</h4><div class="bc-grid arms"></div><h4>${T('arms_armour')}</h4><div class="bc-grid armour"></div><h4>${T('arms_blood')}</h4><div class="bc-blood"></div>`);
    try { await this.load(); } catch (e) { this.say(T('try_again')); return; }
    const cat = (this.g.data.cat && this.g.data.cat.arms) || FAKE_ARMS, price = (this.g.data.cat && this.g.data.cat.armour) || 1200;
    const bar = (v) => `<em class="bc-stat"><i style="width:${Math.round(Math.max(0.08, Math.min(1, v)) * 100)}%"></i></em>`;
    const draw = () => {
      this.coins();
      const f = this.farm, fa = f.arms || { own: A.own, armour: A.armour, blood: A.blood, asked: false }, own = fa.own || [], gore = { asked: fa.asked, ok: fa.blood };
      el.querySelector('.arms').innerHTML = cat.map((w) => {
        const have = own.includes(w.id), dps = w.dmg * (w.pellets || 1) / w.rate;
        return `<button type="button" class="bc-item bc-arm${have ? ' on' : ''}" data-arm="${w.id}"><span>${esc(w.name)}</span>` +
          `<small>${have ? T('arms_owned_draw') : T('arms_buy', { p: w.price })}</small>` +
          `<span class="bc-stats"><small>${T('arms_dmg')}</small>${bar(w.dmg * (w.pellets || 1) / 110)}<small>${T('arms_rate')}</small>${bar(dps / 320)}<small>${T('arms_range')}</small>${bar(w.range / 120)}</span></button>`;
      }).join('');
      const armour = !!fa.armour;
      el.querySelector('.armour').innerHTML = `<button type="button" class="bc-item${armour ? ' on' : ''}" data-armour><span>${T('arms_armour')}</span><small>${armour ? T('arms_owned') : T('arms_buy', { p: price })}</small><small>${T('arms_armour_sub')}</small></button>`;
      const b = el.querySelector('.bc-blood');
      if (gore.ok && gore.asked) b.innerHTML = `<p>${T('arms_blood_on')}</p><button type="button" class="bc-btn" data-gore="0">${T('arms_blood_stop')}</button>`;
      else if (gore.asked) b.innerHTML = `<p>${T('arms_blood_wait')}</p><button type="button" class="bc-btn" data-gore="0">${T('arms_blood_stop')}</button>`;
      else b.innerHTML = `<p>${T('arms_blood_off')}</p><button type="button" class="bc-btn" data-gore="1">${T('arms_blood_ask')}</button>`;
    };
    draw();
    el.addEventListener('click', async (e) => {
      const w = e.target.closest('[data-arm]'), ar = e.target.closest('[data-armour]'), go = e.target.closest('[data-gore]');
      if (!w && !ar && !go) return;
      if (go && go.dataset.gore === '1' && !go.dataset.armed) { go.dataset.armed = '1'; go.textContent = T('arms_confirm'); return; }
      try {
        if (w) {
          const it = cat.find((x) => x.id === w.dataset.arm), had = A.own.includes(it.id);
          await this.act({ a: 'arm', id: it.id });
          if (!A.own.includes(it.id)) A.own.push(it.id);
          A.mag[it.id] = it.mag;
          this.say(had ? T('arms_equip') : T('bought', { n: it.name }));
        } else if (ar) {
          await this.act({ a: 'armour' }); if (!A.armour) { A.armour = true; A.refill(); this.say(T('bought', { n: T('arms_armour') })); }
        } else {
          await this.act({ a: 'gore', on: go.dataset.gore === '1' });
          /* turning it off takes effect now; turning it on waits for the admin (and the next drive) */
          if (go.dataset.gore !== '1') A.blood = false;
        }
        draw();
      } catch (x) { this.err(x); }
    });
  }
  /* ---- the garage ---- */
  async garage() {
    const el = this.frame(T('place_garage'), `<button type="button" class="bc-item" data-fix><span>${T('repair')}</span><small>${T('repair_sub')}</small></button><h4>${T('cars')}</h4><div class="bc-grid cars"></div><h4>${T('paint')}</h4><div class="bc-sw paint"></div><h4>${T('your_plane')}</h4><div class="bc-plane"></div>`);
    try { await this.load(); } catch (e) { this.say(T('try_again')); return; }
    const draw = () => {
      this.coins();
      const f = this.farm, cat = this.cat;
      el.querySelector('.cars').innerHTML = cat.cars.map((c) => { const own = f.cars.includes(c.id), on = f.car === c.id, locked = !own && f.house < c.house;
        return `<button type="button" class="bc-item${on ? ' on' : ''}" data-car="${c.id}"${locked ? ' disabled' : ''}><span>${esc(c.name)}</span><small>${on ? T('driving') : own ? T('owned') : locked ? T('need_house') : c.cost + ' ' + T('cash')}</small></button>`; }).join('');
      el.querySelector('.paint').innerHTML = cat.colors.map((c) => `<button type="button" aria-label="${c}" aria-pressed="${f.color === c}" data-c="${c}" style="background:${c}"></button>`).join('');
      const pl = f.plane || { own: false }, price = cat.plane || 30000;
      el.querySelector('.bc-plane').innerHTML = pl.own
        ? `<p class="bc-note">${T('plane_owned')}</p><div class="bc-sw">${cat.colors.map((c) => `<button type="button" aria-label="${c}" aria-pressed="${pl.c === c}" data-pc="${c}" style="background:${c}"></button>`).join('')}</div>`
        : `<button type="button" class="bc-item" data-plane><span>${T('plane_buy')}</span><small>${price} ${T('cash')}</small><small>${T('plane_sub')}</small></button>`;
    };
    draw();
    el.addEventListener('click', async (e) => {
      if (e.target.closest('[data-fix]')) { this.g.car.repair(); this.say(T('repaired')); return; }
      const pb = e.target.closest('[data-plane],[data-pc]');
      if (pb) {
        try { await this.act({ a: 'plane', c: pb.dataset.pc || this.farm.color }); const pl = this.farm.plane; if (pl && pl.own) this.g.ownPlane(pl); this.say(pb.dataset.plane ? T('plane_bought') : ''); draw(); }
        catch (x) { this.err(x); }
        return;
      }
      const car = e.target.closest('[data-car]'), col = e.target.closest('[data-c]');
      if (!car && !col) return;
      try { await this.act(car ? { a: 'car', id: car.dataset.car } : { a: 'color', c: col.dataset.c }); this.g.setCar(this.farm.car, this.farm.color); draw(); this.say(''); }
      catch (x) { this.err(x); }
    });
  }
}
