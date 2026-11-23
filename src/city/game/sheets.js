/* The panels inside places: the clothing shop (clothes, body, hair) and the garage (cars and paint).
   Purchases go to POST /api/farm/act; the server checks coins and ownership. ?test=1 works offline. */
import { T } from './i18n.js';

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
  cars: [{ id: 'hatch', name: 'Hatchback', cost: 0, house: 0 }, { id: 'buggy', name: 'Beach Buggy', cost: 1500, house: 1 }, { id: 'van', name: 'Garden Van', cost: 2500, house: 2 }, { id: 'gt', name: 'Sunset GT', cost: 6000, house: 3 }],
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
  /* ---- the garage ---- */
  async garage() {
    const el = this.frame(T('place_garage'), `<h4>${T('cars')}</h4><div class="bc-grid cars"></div><h4>${T('paint')}</h4><div class="bc-sw paint"></div>`);
    try { await this.load(); } catch (e) { this.say(T('try_again')); return; }
    const draw = () => {
      this.coins();
      const f = this.farm, cat = this.cat;
      el.querySelector('.cars').innerHTML = cat.cars.map((c) => { const own = f.cars.includes(c.id), on = f.car === c.id, locked = !own && f.house < c.house;
        return `<button type="button" class="bc-item${on ? ' on' : ''}" data-car="${c.id}"${locked ? ' disabled' : ''}><span>${esc(c.name)}</span><small>${on ? T('driving') : own ? T('owned') : locked ? T('need_house') : c.cost + ' ' + T('cash')}</small></button>`; }).join('');
      el.querySelector('.paint').innerHTML = cat.colors.map((c) => `<button type="button" aria-label="${c}" aria-pressed="${f.color === c}" data-c="${c}" style="background:${c}"></button>`).join('');
    };
    draw();
    el.addEventListener('click', async (e) => {
      const car = e.target.closest('[data-car]'), col = e.target.closest('[data-c]');
      if (!car && !col) return;
      try { await this.act(car ? { a: 'car', id: car.dataset.car } : { a: 'color', c: col.dataset.c }); this.g.setCar(this.farm.car, this.farm.color); draw(); this.say(''); }
      catch (x) { this.err(x); }
    });
  }
}
