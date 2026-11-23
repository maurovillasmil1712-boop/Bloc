/* Bloc: app logic. Vanilla JS, no build step.
   Each person's planner lives in their Bloc account (the /api server, stored in
   Cloudflare D1). This browser keeps a copy so the app opens offline. */
(function () {
  'use strict';

  /* =========================================================
     Helpers
     ========================================================= */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }
  var HEX = /^#[0-9a-f]{6}$/i;
  var DATE = /^\d{4}-\d{2}-\d{2}$/;
  var TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
  var ID = /^[\w-]{1,48}$/;
  /* the app's name on screen. Storage keys, the API header and the iPhone bridge keep the old myib names. */
  var BRAND = 'Bloc';
  var TYPES = ['deadline', 'exam', 'mock', 'holiday', 'grades', 'other'];
  var TYPE_ORDER = { exam: 0, deadline: 1, grades: 2, other: 3, mock: 4, holiday: 5 };
  var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var DAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  /* subject colours: vermilion, tangerine, marigold, fern, jade, lagoon, sky, cobalt, ink, plum, rose, clay, graphite */
  var PALETTE = ['#E4572E', '#F28C28', '#EDB21A', '#5DAA3A', '#1E9E6A', '#1597A8', '#3E9BD6', '#3B6FD4', '#3D5591', '#8C3B72', '#E0527D', '#A9714B', '#7D756C'];
  /* planners before Bloc used the iOS system colours: each one moves to its Bloc twin once (version 3) */
  var V2_COLORS = { '#FF3B30': '#E4572E', '#FF9500': '#F28C28', '#FFCC00': '#EDB21A', '#34C759': '#5DAA3A', '#00C7BE': '#1E9E6A', '#30B0C7': '#1597A8', '#32ADE6': '#3E9BD6', '#007AFF': '#3B6FD4', '#5856D6': '#3D5591', '#AF52DE': '#8C3B72', '#FF2D55': '#E0527D', '#A2845E': '#A9714B', '#8E8E93': '#7D756C' };
  /* v1 colours → iOS system colours (only applied to colours nobody changed) */
  var V1_COLORS = { '#EE7418': '#FF9500', '#F0C814': '#FFCC00', '#0FAE9B': '#00C7BE', '#3D8BF2': '#007AFF', '#5A3CC8': '#5856D6', '#1F7A36': '#34C759', '#64748B': '#8E8E93', '#E54F8B': '#FF2D55', '#74C442': '#32ADE6', '#B8B0A6': '#A2845E', '#B044D8': '#AF52DE', '#92400E': '#FF3B30' };

  function uid(prefix) {
    var rnd = '';
    try {
      var a = new Uint32Array(2); crypto.getRandomValues(a);
      rnd = a[0].toString(36) + a[1].toString(36).slice(0, 3);
    } catch (e) { rnd = Math.random().toString(36).slice(2, 10); }
    return (prefix || 'x') + '-' + rnd;
  }
  function clip(v, max, multiline) {
    var s = String(v == null ? '' : v);
    if (!multiline) s = s.replace(/\s+/g, ' ');
    return s.slice(0, max).trim();
  }
  function str(v, max) { return typeof v === 'string' ? v.slice(0, max) : ''; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function norm(s) { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }

  /* time (append ?now=2026-11-26T10:30 to the URL to preview another moment) */
  var OFFSET = 0;
  try {
    var qNow = new URLSearchParams(location.search).get('now');
    if (qNow) { var tNow = Date.parse(qNow); if (!isNaN(tNow)) OFFSET = tNow - Date.now(); }
  } catch (e) { /* ignore */ }
  function nowMs() { return Date.now() + OFFSET; }
  function now() { return new Date(nowMs()); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function toISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parts(s) { return s.split('-').map(Number); }
  function fromISO(s) { var p = parts(s); return new Date(p[0], p[1] - 1, p[2]); }
  function today() { return toISO(now()); }
  function addDays(s, n) { var p = parts(s); return toISO(new Date(p[0], p[1] - 1, p[2] + n)); }
  function dayNum(s) { var p = parts(s); return Date.UTC(p[0], p[1] - 1, p[2]) / 864e5; }
  function diff(a, b) { return Math.round(dayNum(b) - dayNum(a)); }
  function dow(s) { return (fromISO(s).getDay() + 6) % 7; }
  function toMin(t) { var p = t.split(':').map(Number); return p[0] * 60 + p[1]; }
  function minToTime(m) { m = Math.max(0, Math.min(1439, Math.round(m))); return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function nowMin() { var d = now(); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; }
  function fDay(s) { var d = fromISO(s); return DAYS[dow(s)] + ' ' + d.getDate() + ' ' + MON[d.getMonth()]; }
  function fLong(s) { var d = fromISO(s); return DAYS_LONG[dow(s)] + ' ' + d.getDate() + ' ' + MONTH_LONG[d.getMonth()]; }
  function fShort(s) { var d = fromISO(s); return d.getDate() + ' ' + MON[d.getMonth()]; }
  function rel(n) {
    if (n === 0) return 'Today';
    if (n === 1) return 'Tomorrow';
    if (n === -1) return 'Yesterday';
    if (n < 0) return (-n) + ' days ago';
    return 'in ' + n + ' days';
  }
  function dur(min) {
    min = Math.round(min);
    var h = Math.floor(min / 60), m = min % 60;
    if (!h) return m + 'm';
    return m ? h + 'h ' + m + 'm' : h + 'h';
  }
  function fmtClock(secs) { secs = Math.max(0, Math.round(secs)); return Math.floor(secs / 60) + ':' + pad(secs % 60); }
  /* the stopwatch: 4:05, then 1:04:05 past an hour */
  function fmtWatch(secs) { secs = Math.max(0, Math.floor(secs)); var h = Math.floor(secs / 3600); return h ? h + ':' + pad(Math.floor(secs / 60) % 60) + ':' + pad(secs % 60) : fmtClock(secs); }
  function onColor(hex) {
    var n = parseInt(hex.slice(1), 16);
    var ch = [n >> 16 & 255, n >> 8 & 255, n & 255].map(function (c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
    var L = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
    return L > 0.179 ? '#141722' : '#FFFFFF';
  }

  /* =========================================================
     Storage + data model
     ========================================================= */
  var LEGACY_KEY = 'ib-planner:data';   /* IB Planner kept everything here before accounts existed */
  var ADMIN_ID = 'mauro';
  var storageOK = true;
  function sget(k) { try { return localStorage.getItem(k); } catch (e) { storageOK = false; return null; } }
  function sset(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { storageOK = false; return false; } }
  function sdel(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  function sjson(k) { try { var v = JSON.parse(sget(k) || 'null'); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } }
  var DEFAULTS = window.IB_DEFAULTS;
  var BLANK = window.IB_BLANK;
  /* what you study: IB, Bachillerato, ESO or University (data.js). It picks the starting planner,
     the subject list and words like "IB subjects" or "Courses". */
  var LEVELS = window.LEVELS || { ib: { name: 'IB Diploma', short: 'IB', sub: '', group: 'IB subjects', one: 'IB subject', exams: 'IB exams', sl: true, blank: BLANK, common: [] } };
  var LEVEL_IDS = ['ib', 'bach', 'eso', 'uni'].filter(function (k) { return LEVELS[k]; });
  var LEVEL_TILE = { ib: 'IB', bach: 'Bach', eso: 'ESO', uni: 'Uni' };
  /* usernames for accounts outside Sociales 2 IB (the server checks the same rule) */
  var FREE_ID = /^[a-z0-9][a-z0-9_.]{1,18}[a-z0-9]$/;
  var GUIDE = ['new', 'on', 'done'];
  /* [setting value, name, swatch colour] (Bloc Plus) */
  /* the keys stay from MyIB so saved choices keep working; the colours are Bloc's */
  var ACCENTS = [['', 'Yellow', '#FFE14D'], ['green', 'Green', '#A8EC8E'], ['pink', 'Pink', '#FFAAD3'], ['orange', 'Orange', '#FFC273'], ['teal', 'Blue', '#9ADAFF'], ['purple', 'Violet', '#D3BCFF'], ['indigo', 'Mint', '#A3EBD5'], ['graphite', 'Pencil', '#D8DBE1']];
  var SESSIONS = { may: 'May', nov: 'November', spec: 'Specimen' };

  function cleanSubject(s) {
    if (!s || typeof s !== 'object' || !ID.test(s.id)) return null;
    var name = str(s.name, 60).trim() || 'Untitled';
    return {
      id: s.id,
      name: name,
      short: str(s.short, 18).trim() || shortFrom(name),
      color: HEX.test(s.color) ? s.color.toUpperCase() : '#8E8E93',
      group: ['ib', 'core', 'other'].indexOf(s.group) >= 0 ? s.group : 'ib',
      level: s.level === 'SL' || s.level === 'HL' ? s.level : '',
      teacher: str(s.teacher, 60).trim(),
      goal: Math.max(0, Math.min(2400, Math.round(Number(s.goal) || 0))),
      notes: str(s.notes, 4000)
    };
  }
  function iconInk(hex) {
    var n = parseInt(hex.slice(1), 16);
    var ch = [n >> 16 & 255, n >> 8 & 255, n & 255].map(function (c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2] > 0.45 ? '#1C1C1E' : '#FFFFFF';
  }
  function badge(s) { var sh = s.short.replace(/[^\p{L}\p{N}]/gu, ''); return /^[A-Z]{2,3}$/.test(sh) ? sh : (sh.charAt(0).toUpperCase() + sh.charAt(1).toLowerCase()); }
  function shortFrom(name) { return name.length <= 12 ? name : name.split(/\s+/)[0].slice(0, 18); }
  function cleanPeriod(p) {
    if (!p || typeof p !== 'object' || !ID.test(p.id) || !TIME.test(p.start) || !TIME.test(p.end) || toMin(p.end) <= toMin(p.start)) return null;
    return { id: p.id, start: p.start, end: p.end, kind: p.kind === 'break' ? 'break' : 'class', label: str(p.label, 40).trim() };
  }
  function cleanEvent(e, sid) {
    if (!e || typeof e !== 'object' || !ID.test(e.id) || !DATE.test(e.start)) return null;
    var o = {
      id: e.id,
      type: TYPES.indexOf(e.type) >= 0 ? e.type : 'other',
      subject: sid.has(e.subject) ? e.subject : null,
      title: str(e.title, 80).trim(),
      detail: str(e.detail, 80).trim(),
      start: e.start,
      end: DATE.test(e.end) && e.end > e.start ? e.end : null,
      at: TIME.test(e.at) ? e.at : null,
      dur: TIME.test(e.at) ? cleanDur(e.dur, 60) : null,
      note: str(e.note, 2000),
      done: !!e.done
    };
    /* its own reminder timeline (days before), instead of the one for its kind; [] = no reminders */
    if (Array.isArray(e.rem)) o.rem = remOffs(e.rem);
    if (typeof e.ext === 'string' && e.ext) o.ext = e.ext.slice(0, 160);
    return o;
  }
  /* reminders: days before a date (14 = two weeks, 0 = on the day) */
  var REM_OFFS = [14, 7, 3, 2, 1, 0];
  var REM_DEF = { exam: [7, 1, 0], mock: [7, 1, 0], deadline: [3, 1, 0], other: [1], grades: [], holiday: [] };
  function remOffs(v) { return Array.isArray(v) ? REM_OFFS.filter(function (o) { return v.map(Number).indexOf(o) >= 0; }) : null; }
  function cleanRem(r) {
    r = r && typeof r === 'object' ? r : {};
    var ev = {};
    Object.keys(REM_DEF).forEach(function (k) { ev[k] = (r.ev && remOffs(r.ev[k])) || REM_DEF[k].slice(); });
    return { ev: ev, eve: TIME.test(r.eve) ? r.eve : '19:00', morn: TIME.test(r.morn) ? r.morn : '07:30', plan: [-1, 0, 5, 15, 30].indexOf(r.plan) >= 0 ? r.plan : 0 };
  }
  /* a length in minutes for something on the hourly plan: 5 minutes to 12 hours */
  function cleanDur(v, def) { var d = Math.round(Number(v)); return d >= 5 && d <= 720 ? d : def; }
  function cleanTask(t, sid, eid) {
    if (!t || typeof t !== 'object' || !ID.test(t.id)) return null;
    var title = str(t.title, 200).trim();
    if (!title) return null;
    var est = Math.round(Number(t.est));
    var o = {
      id: t.id,
      title: title,
      subject: sid.has(t.subject) ? t.subject : null,
      due: DATE.test(t.due) ? t.due : null,
      at: DATE.test(t.due) && TIME.test(t.at) ? t.at : null,
      event: eid.has(t.event) ? t.event : null,
      est: est > 0 ? Math.min(1440, est) : null,
      notes: str(t.notes, 2000),
      done: !!t.done,
      doneAt: DATE.test(t.doneAt) ? t.doneAt : null,
      created: DATE.test(t.created) ? t.created : today()
    };
    /* a repeating task: the weekdays it happens on (0 = Monday), from its date until 'until',
       with each day ticked off on its own (doneOn) and days taken out (skip) */
    var days = Array.isArray(t.rep) ? t.rep.map(Number).filter(function (d, i, a) { return d >= 0 && d <= 6 && Math.floor(d) === d && a.indexOf(d) === i; }).sort() : [];
    if (days.length) {
      if (!o.due) o.due = o.created;
      o.rep = days;
      o.until = DATE.test(t.until) && t.until >= o.due ? t.until : null;
      o.doneOn = dateList(t.doneOn, 500);
      o.skip = dateList(t.skip, 300);
      o.done = false; o.doneAt = null;
    }
    if (typeof t.ext === 'string' && t.ext) o.ext = t.ext.slice(0, 160);
    return o;
  }
  function dateList(v, max) {
    return Array.isArray(v) ? v.filter(function (d, i, a) { return DATE.test(d) && a.indexOf(d) === i; }).sort().slice(-max) : [];
  }
  function cleanSession(x, sid) {
    if (!x || typeof x !== 'object' || !ID.test(x.id) || !DATE.test(x.date)) return null;
    var m = Math.round(Number(x.minutes));
    if (!(m >= 1 && m <= 720)) return null;
    return { id: x.id, subject: sid.has(x.subject) ? x.subject : null, date: x.date, minutes: m };
  }
  /* a study block on the hourly plan */
  function cleanPlan(x, sid) {
    if (!x || typeof x !== 'object' || !ID.test(x.id) || !DATE.test(x.date) || !TIME.test(x.at)) return null;
    return { id: x.id, date: x.date, at: x.at, dur: cleanDur(x.dur, 60), subject: sid.has(x.subject) ? x.subject : null, title: str(x.title, 80).trim() };
  }
  /* up: a stopwatch that counts up (at most 12 hours) instead of a countdown */
  function cleanTimer(t, sid) {
    if (!t || typeof t !== 'object') return null;
    var up = t.up === true, len = up ? 720 : Math.round(Number(t.len)), st = Number(t.startedAt);
    if (!(len >= 1 && len <= 240) && !up || !isFinite(st)) return null;
    var pa = t.pausedAt == null ? null : Number(t.pausedAt);
    var o = { subject: sid.has(t.subject) ? t.subject : null, len: len, startedAt: st, pausedAt: isFinite(pa) && pa !== null ? pa : null, pausedTotal: Math.max(0, Number(t.pausedTotal) || 0) };
    if (up) o.up = true;
    return o;
  }
  function cleanPaper(x, sid) {
    if (!x || typeof x !== 'object' || !ID.test(x.id)) return null;
    var max = Number(x.max), score = Number(x.score), yr = Math.round(Number(x.year));
    if (!(max > 0 && max <= 1000) || !(score >= 0 && score <= max)) return null;
    return {
      id: x.id,
      subject: sid.has(x.subject) ? x.subject : null,
      year: yr >= 1990 && yr <= 2100 ? yr : null,
      session: SESSIONS[x.session] ? x.session : '',
      paper: str(x.paper, 60).trim(),
      score: Math.round(score * 10) / 10,
      max: Math.round(max * 10) / 10,
      date: DATE.test(x.date) ? x.date : today()
    };
  }
  function uniq(list) {
    var seen = new Set();
    return list.filter(function (x) { if (!x || seen.has(x.id)) return false; seen.add(x.id); return true; });
  }

  /* Validate anything that comes from storage or an imported file before the app touches it. */
  function sanitize(input) {
    var D = clone(DEFAULTS);
    var src = input && typeof input === 'object' ? input : D;
    function pick(k) { return Object.prototype.hasOwnProperty.call(src, k) ? src[k] : D[k]; }
    var out = { version: 3 };
    var fromVersion = Number(src.version) || 1;
    var prof = pick('profile') || {};
    out.profile = { name: typeof prof.name === 'string' ? prof.name.slice(0, 40) : D.profile.name };
    var st = pick('settings') || {};
    out.settings = {
      theme: ['auto', 'light', 'dark'].indexOf(st.theme) >= 0 ? st.theme : 'auto',
      weekend: !!st.weekend,
      lastBackup: DATE.test(st.lastBackup) ? st.lastBackup : null,
      accent: ACCENTS.some(function (a) { return a[0] && a[0] === st.accent; }) ? st.accent : '',
      /* setup guide for empty planners: new = welcome sheet next, on = checklist on Today */
      guide: GUIDE.indexOf(st.guide) >= 0 ? st.guide : 'done',
      rem: cleanRem(st.rem),
      level: LEVEL_IDS.indexOf(st.level) >= 0 ? st.level : '',
      /* calendars linked by address, refreshed every 6 hours */
      feeds: cleanFeeds(st.feeds)
    };
    out.subjects = uniq((Array.isArray(pick('subjects')) ? pick('subjects') : []).map(cleanSubject));
    if (fromVersion < 2) out.subjects.forEach(function (x) { if (V1_COLORS[x.color]) x.color = V1_COLORS[x.color]; });
    if (fromVersion < 3) out.subjects.forEach(function (x) { if (V2_COLORS[x.color]) x.color = V2_COLORS[x.color]; });
    var sid = new Set(out.subjects.map(function (s) { return s.id; }));
    out.periods = uniq((Array.isArray(pick('periods')) ? pick('periods') : []).map(cleanPeriod))
      .sort(function (a, b) { return toMin(a.start) - toMin(b.start); });
    var pid = new Set(out.periods.map(function (p) { return p.id; }));
    out.slots = {};
    var slots = pick('slots');
    if (slots && typeof slots === 'object') {
      Object.keys(slots).forEach(function (k) {
        var bits = k.split('|'), day = Number(bits[1]), v = slots[k];
        if (bits.length !== 2 || !pid.has(bits[0]) || !(day >= 0 && day <= 6) || !v || typeof v !== 'object' || !sid.has(v.subject)) return;
        var c = { subject: v.subject };
        ['teacher', 'room', 'note'].forEach(function (f) { var x = str(v[f], 80).trim(); if (x) c[f] = x; });
        if (TIME.test(v.start) && TIME.test(v.end) && toMin(v.end) > toMin(v.start)) { c.start = v.start; c.end = v.end; }
        out.slots[bits[0] + '|' + day] = c;
      });
    }
    out.events = uniq((Array.isArray(pick('events')) ? pick('events') : []).map(function (e) { return cleanEvent(e, sid); }));
    var eid = new Set(out.events.map(function (e) { return e.id; }));
    out.tasks = uniq((Array.isArray(pick('tasks')) ? pick('tasks') : []).map(function (t) { return cleanTask(t, sid, eid); }));
    out.sessions = uniq((Array.isArray(pick('sessions')) ? pick('sessions') : []).map(function (x) { return cleanSession(x, sid); })).slice(-4000);
    out.papers = uniq((Array.isArray(pick('papers')) ? pick('papers') : []).map(function (x) { return cleanPaper(x, sid); })).slice(-1000);
    out.plans = uniq((Array.isArray(pick('plans')) ? pick('plans') : []).map(function (x) { return cleanPlan(x, sid); })).slice(-3000);
    out.timer = cleanTimer(pick('timer'), sid);
    out.pet = cleanPet(pick('pet'));
    return out;
  }

  /* =========================================================
     Account, server calls, sync
     ========================================================= */
  var MODE = 'boot';          /* boot, then auth (log in), then app */
  var ME = null;              /* { id, name, kind: class | free, admin, plus } */
  var CONF = blankConf();     /* what the server sends with your account: calendar link and Mauro's settings */
  var S = sanitize(clone(DEFAULTS));
  function plusOn() { return !!(ME && ME.plus); }
  /* an account outside Sociales 2 IB (free tier, own username) */
  function isFree() { return !!(ME && ME.kind === 'free'); }
  function startData() {
    if (!isFree()) return clone(DEFAULTS);
    var l = level(), d = clone((LEVELS[l] && LEVELS[l].blank) || BLANK);
    d.settings.level = l;
    return d;
  }
  /* the level this device picked on the log in screen */
  function deviceLevel() { var l = sget('myib:level'); return LEVEL_IDS.indexOf(l) >= 0 ? l : ''; }
  /* the planner's level; the class is IB; an older planner without one takes this device's pick */
  function level() { var l = S.settings.level; return LEVEL_IDS.indexOf(l) >= 0 ? l : ME && !isFree() ? 'ib' : deviceLevel() || 'ib'; }
  function LV() { return LEVELS[level()] || LEVELS.ib; }
  function isIB() { return level() === 'ib'; }

  function blankConf() { return { cal: null, bizum: null, price: null, papers: null, siri: null, assist: null }; }
  function setConf(d) {
    CONF.cal = d.cal || null;
    CONF.bizum = d.bizum || null;
    CONF.price = cleanPrice(d.price);
    CONF.papers = cleanPapersConf(d.papers);
    /* the iCloud link of the Add to Bloc Shortcut (Settings → Connect Siri) */
    CONF.siri = typeof d.siri === 'string' && /^https:\/\/www\.icloud\.com\/shortcuts\/[0-9a-f]{32}$/i.test(d.siri) ? d.siri : null;
    /* the assistant: on or off, and the daily limit (v5.3) */
    var as = d.assist && typeof d.assist === 'object' ? d.assist : null;
    var cn = function (v, lo, hi, d) { v = Number(v); return v >= lo && v <= hi ? Math.floor(v) : d; };
    CONF.assist = as ? { on: as.on !== false, ready: as.ready !== false, limit: cn(as.limit, 1, 1000, 15), extra: cn(as.extra, 1, 1000, 60),
      photos: cn(as.photos, 0, 50, 1), photosExtra: cn(as.photosExtra, 0, 200, 5), price: Number(as.price) >= 0.5 && Number(as.price) <= 50 ? Number(as.price) : 2 } : null;
  }
  function confForCache() { return { user: ME, cal: CONF.cal, bizum: CONF.bizum, price: CONF.price, papers: CONF.papers, siri: CONF.siri, assist: CONF.assist }; }
  var PRICE_DEFAULT = { month: 5, once: 15 };
  function cleanPrice(p) {
    if (!p || typeof p !== 'object') return null;
    var m = Number(p.month), o = Number(p.once);
    return m >= 0.5 && m <= 50 && o >= 1 && o <= 200 ? { month: m, once: o } : null;
  }
  function euro(n) { var c = Math.round(n * 100); return (c % 100 ? (c / 100).toFixed(2).replace('.', ',') : String(c / 100)) + ' €'; }
  function priceText() { var p = CONF.price || PRICE_DEFAULT; return euro(p.month) + ' a month, or ' + euro(p.once) + ' once for the whole school year'; }
  /* only plain web links (http or https) ever become an href */
  function webUrl(v) {
    if (typeof v !== 'string' || !v || v.length > 1000) return '';
    try {
      var u = new URL(v);
      return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname && !u.username && !u.password ? u.href : '';
    } catch (e) { return ''; }
  }
  function cleanPapersConf(p) {
    if (!p || typeof p !== 'object' || !Array.isArray(p.links)) return null;
    return {
      title: str(p.title, 40).trim(), intro: str(p.intro, 400).trim(), head: str(p.head, 60).trim(), foot: str(p.foot, 400).trim(),
      links: p.links.slice(0, 30).map(function (l) {
        var url = l && typeof l === 'object' ? webUrl(l.url) : '';
        var title = url ? str(l.title, 100).trim() : '';
        return title ? { title: title, sub: str(l.sub, 160).trim(), url: url, fresh: l.fresh === true } : null;
      }).filter(Boolean),
      updated: Number(p.updated) || 0
    };
  }

  /* Every server call goes through here. The server refuses changes without the X-MyIB header (CSRF check). */
  function api(method, path, body, opts) {
    opts = opts || {};
    var init = { method: method, credentials: 'same-origin', cache: 'no-store', headers: { 'X-MyIB': '1', 'Accept': 'application/json' } };
    if (body != null) { init.headers['Content-Type'] = 'application/json'; init.body = typeof body === 'string' ? body : JSON.stringify(body); }
    if (opts.keepalive) init.keepalive = true;
    var ctrl = !opts.keepalive && typeof AbortController === 'function' ? new AbortController() : null, timer = null;
    if (ctrl) { init.signal = ctrl.signal; timer = setTimeout(function () { ctrl.abort(); }, opts.timeout || 20000); }
    return fetch(path, init).then(function (res) {
      clearTimeout(timer);
      var ct = res.headers.get('Content-Type') || '';
      if (res.status === 204 || ct.indexOf('application/json') < 0) return { status: res.status, data: null, json: false };
      return res.json().then(function (d) { return { status: res.status, data: d, json: true }; }, function () { return { status: res.status, data: null, json: false }; });
    }, function (err) { clearTimeout(timer); throw err; });
  }

  /* This browser's copy of your planner, so Bloc opens offline and never loses an unsynced change. */
  function cacheKey(id) { return 'myib:cache:' + id; }
  function readCache(id) {
    var c = id ? sjson(cacheKey(id)) : null;
    return c && c.v === 1 && c.me && c.me.user && c.me.user.id === id && c.state && typeof c.state === 'object' ? c : null;
  }
  /* base = the planner as the server last had it (at rev); merges need it */
  function writeCache() {
    if (!ME) return;
    var ok = sset(cacheKey(ME.id), '{"v":1,"me":' + JSON.stringify(confForCache()) + ',"rev":' + SYNC.rev +
      ',"pending":' + SYNC.pending + ',"savedAt":' + SYNC.savedAt + ',"state":' + JSON.stringify(S) + ',"base":' + (SYNC.base || 'null') + '}');
    if (!ok) renderBanner();
  }
  function useCache(c) {
    S = sanitize(c.state);
    SYNC.rev = c.rev || 0; SYNC.pending = !!c.pending; SYNC.savedAt = c.savedAt || 0; SYNC.hadCache = true;
    SYNC.base = c.base && typeof c.base === 'object' ? JSON.stringify(c.base) : null;
  }

  function freshSync() {
    return { rev: 0, base: null, pending: false, gen: 0, savedAt: 0, inflight: false, pulling: false, checking: false, resolving: false, needRender: false, timer: null, online: true, lastPull: Date.now(), lastMe: Date.now(), retry: 0, wantPull: false, needsLoad: false, hadCache: false, tooBig: false };
  }

  /* Three-way merge, for when this device and another one both changed the planner since
     the last sync. Lists merge item by item (by id) and maps key by key, against the last
     copy both sides shared. When both sides changed the same item, this device wins. */
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function keyed(list) { var o = Object.create(null); (Array.isArray(list) ? list : []).forEach(function (x) { if (x && x.id != null) o[x.id] = x; }); return o; }
  function pick3(b, m, t) { return same(m, b) ? t : m; }
  function mergeList(base, mine, theirs) {
    var B = keyed(base), M = keyed(mine), T = keyed(theirs), out = [], seen = new Set();
    (Array.isArray(theirs) ? theirs : []).concat(Array.isArray(mine) ? mine : []).forEach(function (x) {
      if (!x || x.id == null || seen.has(x.id)) return;
      seen.add(x.id);
      var v = pick3(B[x.id], M[x.id], T[x.id]);
      if (v) out.push(v);
    });
    return out;
  }
  function mergeMap(base, mine, theirs) {
    function obj(x) { return x && typeof x === 'object' && !Array.isArray(x) ? x : {}; }
    base = obj(base); mine = obj(mine); theirs = obj(theirs);
    var out = {};
    Object.keys(theirs).concat(Object.keys(mine), Object.keys(base)).forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(out, k)) return;
      var v = pick3(base[k], mine[k], theirs[k]);
      if (v !== undefined) out[k] = v;
    });
    return out;
  }
  function mergeState(base, mine, theirs) {
    /* sanitize first: every copy gets the same key order, so equal items compare equal */
    base = base && typeof base === 'object' ? sanitize(base) : {};
    mine = sanitize(mine); theirs = sanitize(theirs);
    var out = { version: 3 };
    ['subjects', 'periods', 'events', 'tasks', 'sessions', 'papers', 'plans'].forEach(function (k) { out[k] = mergeList(base[k], mine[k], theirs[k]); });
    ['slots', 'settings', 'profile'].forEach(function (k) { out[k] = mergeMap(base[k], mine[k], theirs[k]); });
    out.timer = pick3(base.timer, mine.timer, theirs.timer) || null;
    out.pet = mergePet(base.pet || null, mine.pet || null, theirs.pet || null);
    return sanitize(out);
  }
  function parseBase() { try { return SYNC.base ? JSON.parse(SYNC.base) : null; } catch (e) { return null; } }
  /* take in the server's copy: merged with ours when we have unsynced changes */
  function takeServer(d) {
    var theirs = JSON.stringify(d.state);
    if (SYNC.pending || dirty) {
      S = mergeState(parseBase(), S, d.state);
      SYNC.pending = true; SYNC.gen++;
    } else {
      S = sanitize(d.state);
    }
    SYNC.rev = d.rev; SYNC.base = theirs; undoSnap = null;
    writeCache();
  }
  var SYNC = freshSync();

  var dirty = false, saveTimer = null, persistAsked = false;
  function save() { if (!ME) return; dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(flush, 150); }
  function flush() {
    clearTimeout(saveTimer); saveTimer = null;
    if (!dirty || !ME) return;
    dirty = false;
    SYNC.pending = true; SYNC.gen++; SYNC.savedAt = Date.now(); SYNC.tooBig = false;
    writeCache();
    schedulePush(1200);
    nativeSoon();
    petCardSoon();
    REM_CACHE.at = 0;
    pushPlanSoon();
    if (!persistAsked) {
      persistAsked = true;
      try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {}); } catch (e) { /* ignore */ }
    }
  }
  function schedulePush(ms) { clearTimeout(SYNC.timer); SYNC.timer = setTimeout(function () { SYNC.timer = null; push(); }, ms); }
  function retryPush() { SYNC.retry = Math.min(SYNC.retry + 1, 5); schedulePush(Math.min(60000, 2000 * Math.pow(2, SYNC.retry))); }

  /* Send the planner to the server. A 409 means another device saved in between:
     fetch its copy, merge, and send again. */
  function push(opts) {
    opts = opts || {};
    if (!ME || MODE !== 'app' || !SYNC.pending || SYNC.inflight || SYNC.resolving || SYNC.needsLoad || SYNC.tooBig) return Promise.resolve();
    clearTimeout(SYNC.timer); SYNC.timer = null;
    SYNC.inflight = true;
    var sync = SYNC, gen = SYNC.gen, sent = JSON.stringify(S);
    var body = '{"user":' + JSON.stringify(ME.id) + ',"state":' + sent + (opts.force ? ',"force":true}' : ',"rev":' + SYNC.rev + '}');
    return api('PUT', '/api/state', body, { keepalive: !!opts.keepalive && body.length < 60000 }).then(function (r) {
      sync.inflight = false;
      if (sync !== SYNC) return;
      if (r.status === 200 && r.data) {
        SYNC.rev = r.data.rev; SYNC.base = sent; SYNC.retry = 0;
        if (SYNC.gen === gen) SYNC.pending = false;
        setOnline(true); writeCache();
        if (SYNC.pending) schedulePush(600);
        return;
      }
      if (r.status === 409) { if ((opts.tries || 0) >= 3) { retryPush(); return; } return resolveConflict((opts.tries || 0) + 1); }
      if (r.status === 401) return sessionLost();
      if (r.status === 403 && r.data && r.data.error === 'wrong_user') return reconnect();
      if (r.status === 413) { SYNC.tooBig = true; renderBanner(); return; }
      if (r.status === 503 && r.data && r.data.error === 'setup') return setupNeeded();
      retryPush();
    }, function () {
      sync.inflight = false;
      if (sync !== SYNC) return;
      setOnline(false); retryPush();
    });
  }

  /* Bring in changes made on another device. Waits while a sheet is open or you're typing. */
  function pull() {
    if (!ME || MODE !== 'app' || SYNC.needsLoad || SYNC.pulling || SYNC.inflight || SYNC.pending || dirty) return Promise.resolve();
    if (dlg.open || !idle()) { SYNC.wantPull = true; return Promise.resolve(); }
    var sync = SYNC, rev = SYNC.rev;
    SYNC.pulling = true; SYNC.lastPull = Date.now(); SYNC.wantPull = false;
    return api('GET', '/api/state?since=' + rev + '&user=' + encodeURIComponent(ME.id)).then(function (r) {
      sync.pulling = false;
      if (sync !== SYNC) return;
      if (r.status === 401) return sessionLost();
      if (r.status === 403 && r.data && r.data.error === 'wrong_user') return reconnect();
      if (r.status === 204) { setOnline(true); return; }
      if (r.status !== 200 || !r.data) return;
      setOnline(true);
      if (SYNC.pending || dirty || SYNC.rev !== rev) return;
      if (dlg.open || !idle()) { SYNC.wantPull = true; return; }
      if (r.data.state == null) { if (rev > 0) return startFresh(); return; }
      takeServer(r.data);
      render();
    }, function () {
      sync.pulling = false;
      if (sync === SYNC) setOnline(false);
    });
  }
  /* A sheet keeps references into the planner, so the merge waits until it closes. */
  function resolveConflict(tries) {
    var sync = SYNC;
    SYNC.resolving = true;
    function later() { setTimeout(function () { if (sync === SYNC) resolveConflict(tries); }, 1500); }
    if (dlg.open) { later(); return Promise.resolve(); }
    return api('GET', '/api/state?user=' + encodeURIComponent(ME.id)).then(function (r) {
      if (sync !== SYNC || !ME) return;
      if (dlg.open && r.status === 200) { later(); return; }
      SYNC.resolving = false;
      if (r.status === 401) return sessionLost();
      if (r.status !== 200 || !r.data) { retryPush(); return; }
      if (r.data.state == null) { SYNC.rev = 0; SYNC.base = null; return push({ tries: tries }); }
      takeServer(r.data);
      softRender();
      return push({ tries: tries });
    }, function () { if (sync === SYNC) { SYNC.resolving = false; setOnline(false); retryPush(); } });
  }
  /* don't redraw under someone's typing or a moving scroll; the clock redraws once they stop */
  function softRender() { if (idle() && !scrolling()) render(); else SYNC.needRender = true; }
  function scrolling() { return !!UI.scrollAt && performance.now() - UI.scrollAt < 700; }

  function setOnline(on) {
    if (SYNC.online === on) return;
    SYNC.online = on;
    renderBanner();
    if (on && SYNC.pending && !SYNC.inflight) schedulePush(300);
  }

  /* First contact after logging in: settle this browser's copy against the server's. */
  function loadServerState() {
    var sync = SYNC;
    return api('GET', '/api/state?user=' + encodeURIComponent(ME.id)).then(function (r) {
      if (sync !== SYNC || !ME) return;
      if (r.status === 401) return sessionLost();
      if (r.status === 403 && r.data && r.data.error === 'wrong_user') { reconnect(); throw new Error('wrong_user'); }
      if (r.status === 503 && r.data && r.data.error === 'setup') return setupNeeded();
      if (r.status !== 200 || !r.data) throw new Error('state ' + r.status);
      SYNC.needsLoad = false;
      setOnline(true);
      var d = r.data;
      if (d.state == null) {
        /* never reached the server: upload this browser's copy. Synced before: it was erased on purpose. */
        if (SYNC.hadCache && SYNC.pending && SYNC.rev === 0) return push({ force: true });
        return startFresh();
      }
      if (SYNC.pending && d.rev === SYNC.rev) return push();
      takeServer(d);
      if (MODE === 'app') render();
      if (SYNC.pending) return push();
    });
  }

  /* A brand-new account: the class planner, an empty one for students outside the class,
     or for Mauro his own starting planner (or what this browser saved before accounts existed). */
  function firstState() {
    if (!ME.admin) return Promise.resolve(startData());
    var legacy = legacyData();
    if (legacy && !legacyDone(ME.id)) { markLegacy(ME.id); return Promise.resolve(legacy); }
    return api('GET', '/api/starter').then(function (r) {
      if (r.status !== 200 || !r.data) throw new Error('starter ' + r.status);
      return r.data.starter || clone(DEFAULTS);
    });
  }
  function startFresh() {
    var sync = SYNC;
    return firstState().then(function (st) {
      if (sync !== SYNC || !ME) return;
      S = sanitize(st);
      SYNC.rev = 0; SYNC.base = null; SYNC.pending = true; SYNC.gen++; SYNC.savedAt = Date.now();
      writeCache();
      if (MODE === 'app') { render(); return push(); }
    });
  }

  function reconnect() {
    if (!ME || SYNC.checking) return;
    var sync = SYNC;
    SYNC.checking = true;
    api('GET', '/api/me', null, { timeout: 10000 }).then(function (r) {
      sync.checking = false;
      if (sync !== SYNC || !ME) return;
      if (r.status === 200 && r.data && r.data.user) {
        if (r.data.user.id !== ME.id) return enterApp(r.data, true);
        applyMe(r.data); setOnline(true);
        if (SYNC.needsLoad) return loadServerState().catch(function () { setOnline(false); });
        return SYNC.pending ? push() : pull();
      }
      if (r.status === 401 || (r.status === 200 && r.data && r.data.user === null)) return sessionLost();
      if (r.status === 503 && r.data && r.data.error === 'setup') return setupNeeded();
      setOnline(false);
    }, function () {
      sync.checking = false;
      if (sync === SYNC) setOnline(false);
    });
  }
  function applyMe(d) {
    var had = plusOn(), before = JSON.stringify([CONF.price, CONF.papers]);
    ME = d.user; setConf(d); SYNC.lastMe = Date.now();
    writeCache();
    var changed = before !== JSON.stringify([CONF.price, CONF.papers]);
    if (had !== plusOn()) { applyTheme(); scheduleNag(); }
    /* never redraw under someone's typing: softRender waits until they stop */
    if ((had !== plusOn() || changed) && MODE === 'app' && !dlg.open) softRender();
  }

  window.addEventListener('pagehide', function () { flush(); push({ keepalive: true }); });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { flush(); push(); return; }
    if (MODE !== 'app') return;
    /* reconnect also picks up Mauro's latest settings (new past papers, prices) */
    if (!SYNC.online || SYNC.needsLoad || Date.now() - SYNC.lastMe > 10 * 60000) reconnect();
    else if (Date.now() - SYNC.lastPull > 15000) pull();
  });
  window.addEventListener('online', function () { if (MODE === 'app') reconnect(); });

  /* Planner saved in this browser before accounts existed (IB Planner v1/v2). */
  function legacyData() {
    var d = sjson(LEGACY_KEY);
    return d && Array.isArray(d.subjects) && Array.isArray(d.events) && Array.isArray(d.periods) ? d : null;
  }
  function legacyDone(id) { var l = sjson('myib:legacy'); return !!(l && l[id]); }
  function markLegacy(id) { var l = sjson('myib:legacy') || {}; l[id] = 1; sset('myib:legacy', JSON.stringify(l)); }

  /* view settings, per person and per device */
  function blankUI() { return { tab: 'today', calMonth: null, calSel: null, calMode: 'month', hidden: [], showPast: false, ttDay: null, taskFilter: 'all', showDone: false, focusSubject: null, focusLen: 25, focusUp: false, todayWhich: null, paperSubject: '' }; }
  var UI = blankUI();
  function loadUI(id) {
    var tab = UI.tab;
    UI = blankUI();
    UI.tab = tab;
    var u = sjson('myib:ui:' + id) || {};
    if (u.calMode === 'agenda') UI.calMode = 'agenda';
    if (Array.isArray(u.hidden)) UI.hidden = u.hidden.filter(function (x) { return typeof x === 'string' && ID.test(x); });
    UI.showPast = !!u.showPast;
    if (typeof u.taskFilter === 'string' && ID.test(u.taskFilter)) UI.taskFilter = u.taskFilter;
    UI.showDone = !!u.showDone;
    if (typeof u.focusSubject === 'string' && ID.test(u.focusSubject)) UI.focusSubject = u.focusSubject;
    if (Number.isInteger(u.focusLen) && u.focusLen >= 5 && u.focusLen <= 180) UI.focusLen = u.focusLen;
    UI.focusUp = u.focusUp === true;
    if (typeof u.paperSubject === 'string' && ID.test(u.paperSubject)) UI.paperSubject = u.paperSubject;
  }
  function saveUI() {
    if (!ME) return;
    sset('myib:ui:' + ME.id, JSON.stringify({ calMode: UI.calMode, hidden: UI.hidden, showPast: UI.showPast, taskFilter: UI.taskFilter, showDone: UI.showDone, focusSubject: UI.focusSubject, focusLen: UI.focusLen, focusUp: UI.focusUp, paperSubject: UI.paperSubject }));
  }

  /* lookups */
  function subj(id) { if (!id) return null; for (var i = 0; i < S.subjects.length; i++) if (S.subjects[i].id === id) return S.subjects[i]; return null; }
  function evById(id) { if (!id) return null; for (var i = 0; i < S.events.length; i++) if (S.events[i].id === id) return S.events[i]; return null; }
  function taskById(id) { for (var i = 0; i < S.tasks.length; i++) if (S.tasks[i].id === id) return S.tasks[i]; return null; }
  /* repeating tasks: a task with weekdays (rep) shows up on every one of those days from its date on */
  function isRep(x) { return !!(x && x.rep && x.rep.length); }
  function occurs(x, d) {
    if (!isRep(x)) return x.due === d;
    return d >= x.due && (!x.until || d <= x.until) && x.rep.indexOf(dow(d)) >= 0 && x.skip.indexOf(d) < 0;
  }
  /* one day of a repeating task, shaped like a normal task for that day */
  function occView(x, d) { var o = Object.assign({}, x); o.due = d; o.occ = d; o.done = x.doneOn.indexOf(d) >= 0; return o; }
  function tasksOn(d) { return S.tasks.filter(function (x) { return occurs(x, d); }).map(function (x) { return isRep(x) ? occView(x, d) : x; }); }
  function nextOcc(x, from, undone) {
    var d = from < x.due ? x.due : from;
    for (var i = 0; i < 400; i++, d = addDays(d, 1)) {
      if (x.until && d > x.until) return null;
      if (occurs(x, d) && (!undone || x.doneOn.indexOf(d) < 0)) return d;
    }
    return null;
  }
  function repText(r) {
    var k = r.join(',');
    return k === '0,1,2,3,4,5,6' ? 'Every day' : k === '0,1,2,3,4' ? 'Weekdays' : k === '5,6' ? 'Weekends' :
      r.length === 1 ? 'Every ' + DAYS_LONG[r[0]] : 'Every ' + r.map(function (i) { return DAYS[i]; }).join(', ');
  }
  function periodById(id) { for (var i = 0; i < S.periods.length; i++) if (S.periods[i].id === id) return S.periods[i]; return null; }
  function evEnd(e) { return e.end || e.start; }
  function covers(e, d) { return e.start <= d && evEnd(e) >= d; }
  function byStart(a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : evEnd(a) < evEnd(b) ? -1 : evEnd(a) > evEnd(b) ? 1 : (a.at || '') < (b.at || '') ? -1 : (a.at || '') > (b.at || '') ? 1 : 0; }
  function evOrder(a, b) { return (TYPE_ORDER[a.type] - TYPE_ORDER[b.type]) || byStart(a, b) || (evTitle(a) < evTitle(b) ? -1 : 1); }
  /* only a school holiday cancels classes: a holiday with a subject (a course, a trip) leaves the timetable alone */
  function holidayOn(d) { for (var i = 0; i < S.events.length; i++) { var e = S.events[i]; if (e.type === 'holiday' && !e.subject && covers(e, d)) return e; } return null; }
  function cvar(s) { return s ? '--c:' + s.color + ';--on:' + onColor(s.color) : ''; }
  function nameOrGeneral(id) { var s = subj(id); return s ? s.name : 'general study'; }

  /* event naming: subject · title, with the stage/paper as a separate detail */
  function evTitle(e) {
    var s = subj(e.subject), p = [];
    if (s) p.push(s.name);
    if (e.title) p.push(e.title);
    return p.join(' ') || e.detail || 'Untitled';
  }
  function evShort(e) {
    var s = subj(e.subject), p = [];
    if (s) p.push(s.short);
    if (e.title) p.push(e.title);
    return p.join(' ') || e.detail || 'Event';
  }
  function evDetail(e) { return evTitle(e) === e.detail ? '' : e.detail; }
  function evFull(e) { var d = evDetail(e); return evTitle(e) + (d ? ', ' + d : ''); }
  function evSwatch(e) {
    var s = subj(e.subject);
    if (s) return '<i class="sw" style="' + cvar(s) + '"></i>';
    var k = ['mock', 'holiday', 'grades'].indexOf(e.type) >= 0 ? e.type : 'none';
    return '<i class="sw ' + k + '"></i>';
  }
  function evLabel(e) { return '<span class="lbl">' + evSwatch(e) + '<span>' + esc(evTitle(e)) + '</span></span>'; }
  function evDetailHTML(e) {
    var d = evDetail(e);
    if (!d) return '';
    return e.type === 'exam' ? '<span class="minipill">' + esc(d) + '</span>' : '<span class="detail">' + esc(d) + '</span>';
  }
  function shortPaper(d) { return String(d || 'Exam').replace(/Papers? (\d)/g, 'P$1').replace(/ & (\d)/g, ' & P$1'); }

  /* timetable */
  function slotKey(pid, d) { return pid + '|' + d; }
  function slotTimes(p, sl) { return sl && sl.start ? { start: sl.start, end: sl.end } : { start: p.start, end: p.end }; }
  function blocksFor(d) {
    if (holidayOn(d)) return [];
    var wd = dow(d), out = [];
    S.periods.forEach(function (p) {
      if (p.kind === 'break') return;
      var sl = S.slots[slotKey(p.id, wd)];
      var s = sl && subj(sl.subject);
      if (!s) return;
      var t = slotTimes(p, sl);
      out.push({ p: p, sl: sl, s: s, start: t.start, end: t.end });
    });
    return out.sort(function (a, b) { return toMin(a.start) - toMin(b.start); });
  }
  function nextSchoolDay(from) {
    for (var i = 1; i <= 90; i++) { var d = addDays(from, i); if (blocksFor(d).length) return d; }
    return null;
  }
  function slotCounts() {
    var days = S.settings.weekend ? 7 : 5, c = {};
    var cls = new Set(S.periods.filter(function (p) { return p.kind === 'class'; }).map(function (p) { return p.id; }));
    Object.keys(S.slots).forEach(function (k) {
      var b = k.split('|');
      if (cls.has(b[0]) && Number(b[1]) < days) { var s = S.slots[k].subject; c[s] = (c[s] || 0) + 1; }
    });
    return c;
  }

  /* timer + study log */
  function timerState() {
    var t = S.timer;
    if (!t) return null;
    var n = nowMs();
    var elapsed = Math.max(0, (t.pausedAt != null ? t.pausedAt : n) - t.startedAt - t.pausedTotal);
    var total = t.len * 60000;
    return { subject: t.subject, len: t.len, up: !!t.up, elapsed: elapsed, total: total, remaining: Math.max(0, total - elapsed), running: t.pausedAt == null, startedAt: t.startedAt };
  }
  /* A timer's session id comes from its start time, so two open devices finishing the
     same synced timer log it once (the merge keeps one copy per id). */
  function timerId(st) { return 'ss-t' + Math.round(st.startedAt).toString(36); }
  function logSession(sid, minutes, date, id) {
    id = id || uid('ss');
    if (S.sessions.some(function (x) { return x.id === id; })) return;
    S.sessions.push({ id: id, subject: subj(sid) ? sid : null, date: DATE.test(date) ? date : today(), minutes: Math.max(1, Math.min(720, Math.round(minutes))) });
    if (S.sessions.length > 4000) S.sessions = S.sessions.slice(-4000);
    petOnSession(id);
  }

  /* =========================================================
     Icons (inline SVG, stroke = currentColor)
     ========================================================= */
  var IC = {
    today: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.4L12 4l8 6.4V19a1 1 0 0 1-1 1h-4.4v-5.6H9.4V20H5a1 1 0 0 1-1-1z"/></svg>',
    timetable: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M3 14.8h18M9 4v16M15 4v16"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4M7.5 14h2M11 14h2M14.5 14h2M7.5 17.5h2M11 17.5h2"/></svg>',
    tasks: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8 12.3l2.7 2.7L16 9.6"/></svg>',
    subjects: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.8C4 4.8 4.8 4 5.8 4H11v16H5.8C4.8 20 4 19.2 4 18.2z"/><path d="M13 4h5.2c1 0 1.8.8 1.8 1.8v12.4c0 1-.8 1.8-1.8 1.8H13z"/><path d="M6.8 8h1.8M15.4 8h1.8"/></svg>',
    settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>',
    moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.2A8 8 0 1 1 9.8 4a6.4 6.4 0 0 0 10.2 10.2z"/></svg>',
    sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5L8 12l6.5 6.5"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 5.5L16 12l-6.5 6.5"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.8v12.4L18 12z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 5.5v13M15.5 5.5v13"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/></svg>',
    upload: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5V4.5M7.5 9L12 4.5 16.5 9M5 19.5h14"/></svg>',
    updown: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 9.5l4-4 4 4M8 14.5l4 4 4-4"/></svg>',
    up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5.5M6.5 11L12 5.5 17.5 11"/></svg>',
    camera: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.6A1.6 1.6 0 0 1 5.6 7h2.2l1.5-2.2h5.4L16.2 7h2.2A1.6 1.6 0 0 1 20 8.6v8.8a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 17.4z"/><circle cx="12" cy="12.8" r="3.5"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v13.5M6.5 13l5.5 5.5 5.5-5.5"/></svg>',
    tick: '<svg class="tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    keyboard: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6 10h1M9.5 10h1M13 10h1M16.5 10h1M7 14h10"/></svg>',
    chev: '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 5.5L16 12l-6.5 6.5"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/></svg>',
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-10.1A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6.2a1.7 1.7 0 0 0-1.7-1.7H6.2a1.7 1.7 0 0 0-1.7 1.7v7.6a1.7 1.7 0 0 0 1.7 1.7h2.3"/></svg>',
    link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4.2 4.2 0 0 0 6 0l3-3a4.2 4.2 0 0 0-6-6l-1 1"/><path d="M14 10a4.2 4.2 0 0 0-6 0l-3 3a4.2 4.2 0 0 0 6 6l1-1"/></svg>',
    out: '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4.5h5.5V10M19.5 4.5L11 13M18 14v4.2a1.3 1.3 0 0 1-1.3 1.3H5.8a1.3 1.3 0 0 1-1.3-1.3V7.3A1.3 1.3 0 0 1 5.8 6H10"/></svg>',
    key: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="15.5" r="3.8"/><path d="M10.8 12.8L19 4.6M16 7.6l2.5 2.5M13.8 9.8l1.9 1.9"/></svg>',
    logout: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h7M10 12h10M16.5 8.5L20 12l-3.5 3.5"/></svg>',
    users: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8"/><circle cx="16.8" cy="9.4" r="2.5"/><path d="M16 14.4c2.4-.2 4 1.4 4.5 4"/></svg>',
    paper: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h7l4 4v12a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1z"/><path d="M13.5 3.5v4h4M8.5 12h7M8.5 15.5h7"/></svg>',
    palette: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.7 1.8-1.6 0-1.2-1-1.5-1-2.6 0-1 .8-1.6 1.8-1.6h2.2a3.7 3.7 0 0 0 3.7-3.7c0-4.3-3.8-7.5-8.5-7.5z"/><circle cx="7.8" cy="11.2" r="1"/><circle cx="10.6" cy="7.6" r="1"/><circle cx="15" cy="8.2" r="1"/></svg>',
    timer: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13.5" r="7"/><path d="M12 13.5V9.5M9.5 3h5M18.3 6.7l1.3-1.3"/></svg>',
    repeat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 2.5l3 3-3 3"/><path d="M4 11.5v-1a5 5 0 0 1 5-5h11M7 21.5l-3-3 3-3"/><path d="M20 12.5v1a5 5 0 0 1-5 5H4"/></svg>',
    skip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l9 7-9 7z"/><path d="M19 5v14"/></svg>',
    flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.3 2.2c.9 3.4-1.4 5.1-2.8 7.2C8.2 11.3 7.4 12.9 7.4 15a4.6 4.6 0 0 0 9.2 0c0-2.1-1-3.7-2.1-5 .1 1.5-.5 2.6-1.5 3 .6-3.6-.4-7.7-.7-10.8Z"/></svg>',
    watch: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5l3-2.5M10 2.5h4M12 2.5V6M4.8 7.3l1.4 1.2"/><circle cx="12" cy="13.5" r=".6" fill="currentColor"/></svg>',
    quiet: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.2 16.5V11a5.8 5.8 0 0 1 9.4-4.5M17.8 10.5v6l1.5 1.5H8M10 20.5a2.2 2.2 0 0 0 4 0M4 4l16 16"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4"/></svg>',
    chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5c4.7 0 8.5 3.1 8.5 7s-3.8 7-8.5 7c-1 0-2-.1-2.9-.4L5 19.5l1.2-3.5c-1.7-1.2-2.7-2.8-2.7-4.5 0-3.9 3.8-7 8.5-7z"/></svg>',
    compose: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V13"/><path d="M17.6 3.9a2 2 0 0 1 2.8 2.8l-7.9 7.9-3.6.8.8-3.6z"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.2"/></svg>',
    bulb: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.3 17.6h5.4M10.2 20.5h3.6"/><path d="M12 3.5a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2v1.3h5.2v-1.3c0-.8.4-1.5 1-2A6 6 0 0 0 12 3.5z"/></svg>',
    flag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 20.5V4.5M5.5 5h11.5l-2.4 4 2.4 4H5.5"/></svg>',
    block: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/></svg>',
    bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.2 16.5V11a5.8 5.8 0 0 1 11.6 0v5.5l1.5 1.5H4.7zM10 20.5a2.2 2.2 0 0 0 4 0"/></svg>',
    shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l7 2.8v5.2c0 4.4-3 7.8-7 9-4-1.2-7-4.6-7-9V6.3z"/><path d="M9 12l2.2 2.2L15.5 10"/></svg>',
    pet: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12.2c2.9 0 5.2 2.5 5.2 4.6 0 1.6-1.3 2.6-2.8 2.6-1 0-1.5-.5-2.4-.5s-1.4.5-2.4.5c-1.5 0-2.8-1-2.8-2.6 0-2.1 2.3-4.6 5.2-4.6z"/><ellipse cx="5.6" cy="10.2" rx="1.8" ry="2.2"/><ellipse cx="9.3" cy="6.4" rx="1.8" ry="2.3"/><ellipse cx="14.7" cy="6.4" rx="1.8" ry="2.3"/><ellipse cx="18.4" cy="10.2" rx="1.8" ry="2.2"/></svg>',
    'n-food': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 12.2h17c0 4.2-3.8 7.3-8.5 7.3s-8.5-3.1-8.5-7.3z"/><circle cx="8.8" cy="9.2" r="1.6"/><circle cx="12.3" cy="7.8" r="1.6"/><circle cx="15.6" cy="9.4" r="1.6"/></svg>',
    'n-water': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.8c3.2 4 5.6 7.1 5.6 10.1a5.6 5.6 0 0 1-11.2 0c0-3 2.4-6.1 5.6-10.1z"/><path d="M9.4 14.6a2.7 2.7 0 0 0 2.2 2.4"/></svg>',
    'n-ball': '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M5.3 8.3c3.5 1 5.8 4.4 5.4 11.5M18.7 15.7c-3.5-1-5.8-4.4-5.4-11.5"/></svg>',
    'n-fun': '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M5.3 8.3c3.5 1 5.8 4.4 5.4 11.5M18.7 15.7c-3.5-1-5.8-4.4-5.4-11.5"/></svg>',
    'n-bone': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.2 14.8l5.6-5.6"/><circle cx="6.9" cy="14.9" r="2.1"/><circle cx="9.1" cy="17.1" r="2.1"/><circle cx="14.9" cy="6.9" r="2.1"/><circle cx="17.1" cy="9.1" r="2.1"/></svg>',
    bow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.2 12L4 8v8zM13.8 12L20 8v8z"/><rect x="10.2" y="10" width="3.6" height="4" rx="1.2"/></svg>',
    more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6.5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="17.5" cy="12" r="1.4" fill="currentColor"/></svg>',
    /* the assistant: a marker that just drew a line (v6 replaced the sparkle) */
    spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.2 3.6l5.2 5.2-9.2 9.2L6 12.8z"/><path d="M12.9 5.9l5.2 5.2"/><path d="M6 12.8l-1.9 4.1 3 3 4.1-1.9"/><path d="M14 20.5h6"/></svg>',
    mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.8 11.5a6.2 6.2 0 0 0 12.4 0M12 17.7v2.8M9.2 20.5h5.6"/></svg>',
    nowifi: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 9.2a12.5 12.5 0 0 1 4.3-2.6M11.5 6a12.6 12.6 0 0 1 9 3.2M6.5 12.5a8 8 0 0 1 3.6-1.9M14.6 10.9a8 8 0 0 1 2.9 1.6M9.6 15.8a3.6 3.6 0 0 1 4.8 0M4 4l16 16"/><circle cx="12" cy="19" r=".9" fill="currentColor"/></svg>'
  };
  function icon(n) { return IC[n] || ''; }

  /* =========================================================
     Shell: nav, theme, banner, toast, dialog
     ========================================================= */
  var TABS = [['today', 'Today'], ['timetable', 'Timetable'], ['calendar', 'Calendar'], ['tasks', 'Tasks'], ['subjects', 'Subjects'], ['pet', 'Pet']];
  var mqDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  /* Before anyone logs in, use the look this device used last time. */
  function currentTheme() {
    var t = ME ? S.settings.theme : sget('myib:theme');
    return ['auto', 'light', 'dark'].indexOf(t) >= 0 ? t : 'auto';
  }
  function effectiveDark() { var t = currentTheme(); return t === 'dark' || (t === 'auto' && !!(mqDark && mqDark.matches)); }
  function applyTheme() {
    var t = currentTheme(), root = document.documentElement;
    if (t === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
    var acc = plusOn() ? S.settings.accent : '';
    if (acc) root.setAttribute('data-accent', acc); else root.removeAttribute('data-accent');
    $$('meta[name="theme-color"]').forEach(function (m) {
      var dark = t === 'auto' ? /dark/.test(m.getAttribute('media') || '') : t === 'dark';
      m.setAttribute('content', dark ? '#111318' : '#FFFFFF');
    });
    /* auto: the app follows the phone, so the page's prefers-color-scheme keeps working */
    toNative({ type: 'theme', mode: t, dark: effectiveDark() });
  }
  if (mqDark) {
    var onScheme = function () { if (MODE === 'app' && currentTheme() === 'auto') renderNav(); };
    if (mqDark.addEventListener) mqDark.addEventListener('change', onScheme); else if (mqDark.addListener) mqDark.addListener(onScheme);
  }
  /* Big screens: the app scales up with the window (styles.css, "big screens").
     --z grows slower than the window, so Ctrl + and Ctrl - still make the app bigger or smaller,
     and a short window keeps it smaller so pages still fit. --ih is the window height in px. */
  var uiZ = 0, uiH = 0, canZoom = !!(window.CSS && CSS.supports && CSS.supports('zoom', '1.5'));
  function uiScale() {
    var w = window.innerWidth || 0, h = window.innerHeight || 0, root = document.documentElement;
    var z = Math.min(Math.pow(w / 1440, 0.6), Math.pow(h / 820, 0.75));
    z = Math.round(Math.max(1, Math.min(1.6, z || 1)) * 100) / 100;
    if (z < 1.03 || !canZoom) z = 1;
    if (h !== uiH) { uiH = h; root.style.setProperty('--ih', h + 'px'); }
    if (z === uiZ) return;
    uiZ = z;
    root.style.setProperty('--z', String(z));
    root.classList.toggle('zoomed', z > 1);
  }
  uiScale();
  window.addEventListener('resize', uiScale);
  /* how much an element is scaled on screen: pointer positions come in screen pixels */
  function zoomOf(el) { var w = el && el.offsetWidth; return w ? el.getBoundingClientRect().width / w : 1; }
  var navBuilt = false;
  /* the pill under the current section slides there on a spring */
  function navPill(nav) {
    if (!nav) return;
    var cur = $('[aria-current="page"]', nav), pill = $('.nav-pill', nav);
    if (!pill) { pill = document.createElement('span'); pill.className = 'nav-pill'; pill.setAttribute('aria-hidden', 'true'); nav.insertBefore(pill, nav.firstChild); }
    if (!cur || !cur.offsetWidth) { pill.style.opacity = '0'; return; }
    var first = pill.dataset.on !== '1';
    pill.dataset.on = '1';
    if (first) pill.style.transition = 'none';
    pill.style.opacity = '1';
    pill.style.width = cur.offsetWidth + 'px';
    pill.style.height = cur.offsetHeight + 'px';
    pill.style.transform = 'translate(' + cur.offsetLeft + 'px,' + cur.offsetTop + 'px)';
    if (first) { void pill.offsetWidth; pill.style.transition = ''; }
  }
  window.addEventListener('resize', function () { navPill($('#top-nav')); navPill($('#tabbar')); });
  function renderNav() {
    if (!navBuilt) {
      var html = TABS.map(function (t) {
        return '<button type="button" data-act="tab" data-tab="' + t[0] + '">' + icon(t[0]) + '<span>' + t[1] + '</span></button>';
      }).join('');
      $('#top-nav').innerHTML = html;
      $('#tabbar').innerHTML = html;
      var sb = $('#settings-btn');
      sb.innerHTML = icon('settings');
      sb.title = 'Settings and backup';
      var cb = $('#chat-btn');
      if (cb) { cb.innerHTML = icon('chat'); cb.title = 'Chats'; }
      var ab = $('#assist-btn');
      if (ab) { ab.innerHTML = icon('spark'); ab.title = 'Assistant'; }
      navBuilt = true;
    }
    var asb = $('#assist-btn');
    if (asb) asb.hidden = !assistOn();
    var chb = $('#chat-btn');
    if (chb) { if (UI.tab === 'chat') chb.setAttribute('aria-current', 'page'); else chb.removeAttribute('aria-current'); }
    paintBadge();
    var hb = $('#settings-btn'), pfp = ME && ME.avatar ? ME.id + ':' + ME.avatar : '';
    if ((hb.dataset.pfp || '') !== pfp) {
      hb.dataset.pfp = pfp;
      hb.classList.toggle('has-pfp', !!pfp);
      hb.innerHTML = pfp ? '<img class="head-pfp" src="' + esc(avatarSrc(ME.id, ME.avatar)) + '" alt="">' : icon('settings');
    }
    $$('#top-nav [data-tab], #tabbar [data-tab]').forEach(function (b) {
      if (b.dataset.tab === UI.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
      if (b.dataset.tab === 'pet') {
        var n = GARDEN.invites.length;
        b.classList.toggle('has-dot', n > 0);
        b.setAttribute('aria-label', n ? 'Pet, ' + n + ' garden invite' + (n === 1 ? '' : 's') : 'Pet');
      }
    });
    navPill($('#top-nav')); navPill($('#tabbar'));
    var dark = effectiveDark(), tb = $('#theme-btn');
    tb.innerHTML = icon(dark ? 'sun' : 'moon');
    tb.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    tb.title = dark ? 'Light theme' : 'Dark theme';
  }
  function renderBanner() {
    var b = $('#banner'), msg = '';
    if (MODE === 'app') {
      if (!SYNC.online) msg = 'Offline. Your changes are saved on this device and sync when you’re back online.';
      else if (SYNC.tooBig) msg = 'Your planner is too big to sync. Delete some old tasks or study sessions.';
      else if (!storageOK) msg = 'This browser blocks storage, so Bloc can’t keep a copy here. Changes still save to your account while you’re online.';
    }
    if (msg) { b.innerHTML = '<span class="pillnote">' + esc(msg) + '</span>'; b.hidden = false; }
    else { b.hidden = true; b.innerHTML = ''; }
  }

  /* The toast is a popover where supported, so it shows above open sheets too. */
  var toastTimer = null, undoSnap = null;
  var toastEl = $('#toast'), toastPop = !!(toastEl && typeof toastEl.showPopover === 'function');
  if (toastPop) { toastEl.setAttribute('popover', 'manual'); toastEl.hidden = false; }
  function snapshot() { return JSON.stringify(S); }
  var toastAct = null;
  function toast(msg, snap, act, ms) {
    undoSnap = snap || null;
    toastAct = act || null;
    toastEl.innerHTML = '<span>' + esc(msg) + '</span>' + (snap ? '<button type="button" class="btn small" data-act="undo">Undo</button>' : '') +
      (act ? '<button type="button" class="btn small primary" data-act="toast-act">' + esc(act.label) + '</button>' : '');
    if (toastPop) {
      /* an open sheet makes the rest of the page inert: the toast goes inside it so Undo still works */
      var host = dlg && dlg.open ? dlg : document.body;
      try {
        if (toastEl.matches(':popover-open')) toastEl.hidePopover();
        if (toastEl.parentNode !== host) host.appendChild(toastEl);
        toastEl.showPopover();
      } catch (e) { /* ignore */ }
    } else toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, ms || (snap || act ? 6500 : 2800));
  }
  function hideToast() {
    if (toastPop) { try { if (toastEl.matches(':popover-open')) toastEl.hidePopover(); } catch (e) { /* ignore */ } }
    else toastEl.hidden = true;
    undoSnap = null;
  }
  /* brief confirmation on a button inside a sheet */
  function flash(el, label) {
    if (!el) return;
    var old = el.innerHTML;
    el.innerHTML = icon('check') + esc(label);
    el.classList.add('flashed');
    setTimeout(function () { if (el.isConnected) { el.innerHTML = old; el.classList.remove('flashed'); } }, 2000);
  }

  var dlg = $('#dlg');
  var dlgSubmit = null, dlgBack = null, curSheet = null;
  var coarse = window.matchMedia ? window.matchMedia('(pointer: coarse)') : { matches: false };
  function openDialog(o) {
    var left = o.back ? '<button type="button" class="nav-btn back" data-act="dlg-back">' + icon('left') + '<span>' + esc(o.backLabel || 'Back') + '</span></button>'
             : o.onSubmit ? '<button type="button" class="nav-btn" data-act="dlg-close">Cancel</button>' : '<span aria-hidden="true"></span>';
    var right = o.onSubmit ? '<button type="submit" class="nav-btn strong' + (o.submitDanger ? ' danger' : '') + '">' + esc(o.submitLabel || 'Save') + '</button>'
                           : '<button type="button" class="nav-btn strong" data-act="dlg-close">' + esc(o.doneLabel || 'Done') + '</button>';
    dlgBack = o.back || null;
    /* swap the sheet, keep anything else in the dialog (a toast) */
    $$(':scope > form.sheet', dlg).forEach(function (f) { f.remove(); });
    dlg.insertAdjacentHTML('afterbegin',
      '<form class="sheet" tabindex="-1" novalidate autocomplete="off">' +
        '<div class="grabber" aria-hidden="true"></div>' +
        '<header class="sheet-head">' + left + '<h2 id="dlg-title">' + esc(o.title) + '</h2>' + right + '</header>' +
        '<div class="sheet-body">' + o.body +
          (o.danger ? '<div class="group"><button type="button" class="row row-btn danger" data-act="' + o.danger.act + '" data-id="' + esc(o.danger.id) + '">' + esc(o.danger.label) + '</button></div>' : '') +
        '</div>' +
      '</form>');
    dlgSubmit = o.onSubmit || null;
    dlg.classList.toggle('wide', !!o.wide);
    if (!dlg.open) dlg.showModal();
    var first = $('.sheet-body [autofocus]', dlg);
    if (first && !coarse.matches) first.focus();
    else $('.sheet', dlg).focus({ preventScroll: true });
    $('.sheet-body', dlg).scrollTop = 0;
  }
  /* iOS-style grouped form rows */
  function grp(rows, head, foot) {
    return (head ? '<p class="group-head">' + head + '</p>' : '') + '<div class="group">' + rows + '</div>' + (foot ? '<p class="group-foot">' + foot + '</p>' : '');
  }
  function rField(o) {
    var af = o.autofocus ? ' autofocus' : '';
    if (o.area) return '<label class="row"><span class="sr">' + esc(o.label) + '</span><textarea class="row-field" name="' + o.name + '" id="' + o.id + '" maxlength="' + o.max + '" placeholder="' + esc(o.placeholder || o.label) + '"' + af + '>' + esc(o.value) + '</textarea></label>';
    return '<label class="row"><span class="sr">' + esc(o.label) + '</span><input class="row-field" type="text" name="' + o.name + '" id="' + o.id + '" maxlength="' + o.max + '" value="' + esc(o.value) + '" placeholder="' + esc(o.placeholder || o.label) + '"' + af + '></label>';
  }
  function rText(label, name, id, value, placeholder, max, attrs) {
    return '<label class="row"><span class="row-label">' + esc(label) + '</span><input class="row-field right" type="text" name="' + name + '" id="' + id + '" maxlength="' + max + '" value="' + esc(value || '') + '" placeholder="' + esc(placeholder || '') + '"' + (attrs || '') + '></label>';
  }
  function rPw(label, name, id, auto, autofocus) {
    return '<label class="row"><span class="sr">' + esc(label) + '</span><input class="row-field" type="password" name="' + name + '" id="' + id + '" maxlength="128" autocomplete="' + auto + '" autocapitalize="off" spellcheck="false" placeholder="' + esc(label) + '"' + (autofocus ? ' autofocus' : '') + '></label>';
  }
  /* a row that opens another sheet, with a value and a chevron on the right */
  function rNav(ic, label, act, value, attrs) {
    return '<button type="button" class="row row-btn nav-row" data-act="' + act + '"' + (attrs || '') + '>' + (ic ? icon(ic) : '') + '<span class="row-label">' + esc(label) + '</span>' +
      (value ? '<span class="row-meta">' + esc(value) + '</span>' : '') + icon('chev') + '</button>';
  }
  function rSelect(label, name, id, options, attrs) {
    return '<label class="row"><span class="row-label">' + esc(label) + '</span><span class="row-value"><span class="row-select-wrap"><select class="row-select" name="' + name + '" id="' + id + '"' + (attrs || '') + '>' + options + '</select>' + icon('updown') + '</span></span></label>';
  }
  function rPill(label, type, name, id, value, attrs) {
    return '<label class="row"><span class="row-label">' + esc(label) + '</span><input class="row-pill" type="' + type + '" name="' + name + '" id="' + id + '" value="' + esc(value || '') + '"' + (attrs || '') + '></label>';
  }
  function rSwitch(label, name, id, on) {
    return '<label class="row"><span class="row-label">' + esc(label) + '</span><input class="ios-switch" type="checkbox" role="switch" name="' + name + '" id="' + id + '"' + (on ? ' checked' : '') + '></label>';
  }
  function rButton(label, act, attrs, cls) {
    return '<button type="button" class="row row-btn ' + (cls || '') + '" data-act="' + act + '"' + (attrs || '') + '>' + label + '</button>';
  }
  function optionList(pairs, sel) {
    return pairs.map(function (o) { return '<option value="' + o[0] + '"' + (String(o[0]) === String(sel) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
  }
  function closeDialog() { if (dlg.open) dlg.close(); }
  dlg.addEventListener('close', function () {
    /* a toast shown inside the sheet moves back out and stays up */
    if (toastEl.parentNode === dlg) {
      var up = toastPop && toastEl.matches(':popover-open');
      document.body.appendChild(toastEl);
      if (up) { try { toastEl.showPopover(); } catch (e) { /* ignore */ } }
    }
    dlgSubmit = null; dlgBack = null; curSheet = null; dlg.innerHTML = '';
    if (PFP) { URL.revokeObjectURL(PFP.url); PFP = null; }
    if (PETUI.cruise) { PETUI.cruise = false; setTimeout(function () { if (PETUI.ctl && UI.tab === 'pet') PETUI.ctl.idle('cruise'); }, 350); }
    if (settingsTouched) { settingsTouched = false; render(); }
    if (SYNC.wantPull) setTimeout(pull, 60);
  });
  /* avatars: a coloured circle with the first letter */
  var KNOWN = ['alexia', 'ana', 'ariel', 'berta', 'carlota', 'cata', 'jorge', 'juan', 'luca', 'mauro', 'simon'];
  var AVATAR = ['#F28C28', '#E0527D', '#8C3B72', '#3D5591', '#3B6FD4', '#3E9BD6', '#1E9E6A', '#5DAA3A', '#A9714B', '#E4572E', '#1597A8', '#7D756C'];
  function avatarColor(id) {
    var i = KNOWN.indexOf(id);
    if (i < 0) { i = 0; for (var k = 0; k < id.length; k++) i = (i * 31 + id.charCodeAt(k)) >>> 0; }
    return AVATAR[i % AVATAR.length];
  }
  /* v = when the photo was uploaded; a new photo gets a new address, so browsers can keep the old one cached */
  function avatarSrc(id, v) { return v ? '/api/avatar/' + encodeURIComponent(id) + '?v=' + encodeURIComponent(v) : ''; }
  function avatar(id, name, size, v) {
    var c = avatarColor(String(id)), src = avatarSrc(id, v);
    return '<span class="avatar' + (size ? ' ' + size : '') + '" style="--c:' + c + ';color:' + iconInk(c) + '" aria-hidden="true">' + esc(Array.from(String(name || '?'))[0].toUpperCase()) +
      (src ? '<img class="avatar-img" src="' + esc(src) + '" alt="" decoding="async">' : '') + '</span>';
  }
  /* a photo that won't load (offline, or taken down) falls back to the letter */
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (!t || !t.classList) return;
    if (t.classList.contains('head-pfp')) { var hb = t.parentNode; hb.dataset.pfp = ''; hb.classList.remove('has-pfp'); hb.innerHTML = icon('settings'); }
    else if (t.classList.contains('avatar-img')) t.remove();
  }, true);
  dlg.addEventListener('click', function (e) { if (e.target === dlg) closeDialog(); });
  dlg.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!dlgSubmit) return;
    var r = dlgSubmit(new FormData(e.target), e.target);
    if (r !== false) closeDialog();
  });
  function fieldError(sel, msg) {
    var el = $(sel, dlg);
    if (!el) return;
    el.setAttribute('aria-invalid', 'true');
    var row = el.closest('.row');
    if (row) row.classList.add('invalid');
    var g = el.closest('.group');
    var m = g && g.nextElementSibling && g.nextElementSibling.classList.contains('err') ? g.nextElementSibling : null;
    if (!m) {
      m = document.createElement('p');
      m.className = 'group-foot err';
      m.setAttribute('role', 'alert');
      (g || el).after(m);
    }
    m.textContent = msg;
    el.focus();
  }
  function arm(el, label) {
    if (el.dataset.armed === '1') return true;
    var old = el.textContent;
    el.dataset.armed = '1';
    el.textContent = label || 'Press again to delete';
    el.classList.add('armed');
    setTimeout(function () { if (el.isConnected) { el.dataset.armed = ''; el.textContent = old; el.classList.remove('armed'); } }, 3500);
    return false;
  }
  function download(name, text, type) {
    var blob = new Blob([text], { type: type });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name; a.hidden = true;
    (dlg.open ? dlg : document.body).appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  /* =========================================================
     Render
     ========================================================= */
  var VIEWS = {};
  var FOCUS_ATTRS = ['data-act', 'data-change', 'data-id', 'data-tab', 'data-date', 'data-p', 'data-d', 'data-which', 'data-mode', 'data-len', 'data-step'];
  function cssEsc(v) { return window.CSS && CSS.escape ? CSS.escape(v) : String(v).replace(/["\\]/g, '\\$&'); }
  function focusKey(el) {
    var v = $('#view');
    if (!el || el === document.body || el === v || !v.contains(el)) return null;
    if (el.id) return '#' + cssEsc(el.id);
    var sel = FOCUS_ATTRS.filter(function (a) { return el.hasAttribute(a); }).map(function (a) { return '[' + a + '="' + cssEsc(el.getAttribute(a)) + '"]'; }).join('');
    return sel ? el.tagName.toLowerCase() + sel : null;
  }
  function render() {
    if (MODE !== 'app') return;
    applyTheme();
    renderNav();
    renderBanner();
    var v = $('#view');
    var fk = focusKey(document.activeElement);
    if (v.getAttribute('data-view') === 'chat') chatKeep();
    petKeep();
    tlKeep();
    v.innerHTML = (VIEWS[UI.tab] || VIEWS.today)();
    v.setAttribute('data-view', UI.tab);
    document.body.classList.toggle('chat-conv', UI.tab === 'chat' && !!CHAT.open && chatAgreed());
    if (fk) { var back = $(fk, v); if (back) back.focus({ preventScroll: true }); }
    if (UI.tab === 'chat' && chatAgreed()) chatMounted();
    if (UI.tab === 'pet') petMounted();
    if (UI.tab === 'calendar') { tlMounted(); dragTouchBind(v); }
    var entering = !!UI.enter;
    UI.enter = false;
    if (entering && !calm()) {
      v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter');
      clearTimeout(UI.enterT);
      UI.enterT = setTimeout(function () { v.classList.remove('enter'); }, 300);
    }
    ringMount(entering);
    updateTimerUI();
    nativeSoon();
  }
  function go(tab) {
    if (!isView(tab)) tab = 'today';
    var changed = UI.tab !== tab;
    if (changed) {
      var order = TABS.map(function (x) { return x[0]; }).concat('chat'), a = order.indexOf(UI.tab), b = order.indexOf(tab);
      $('#view').style.setProperty('--vt-dir', a < 0 || b < 0 ? '0' : b > a ? '1' : '-1');
      UI.enter = true;
    }
    /* phones open Chats on the list; big screens keep the chat you had open */
    if (tab === 'chat' && changed && !wideChat()) { CHAT.open = null; CHAT.pushed = false; }
    UI.tab = tab;
    var h = tab === 'chat' ? chatHash() : tab;
    if (location.hash.slice(1) !== h) { try { history.pushState(null, '', '#' + h); } catch (e) { location.hash = h; } }
    render();
    if (changed) {
      window.scrollTo(0, 0);
      $('#view').focus({ preventScroll: true });
      if (tab === 'chat') sizeChat();
      chatWake(tab === 'chat' ? 60 : null);
    }
  }
  var scrolledNow = false;
  window.addEventListener('scroll', function () {
    UI.scrollAt = performance.now();
    var on = window.scrollY > 6;
    if (on !== scrolledNow) { scrolledNow = on; document.body.classList.toggle('scrolled', on); }
  }, { passive: true });
  window.addEventListener('popstate', function () {
    var v = parseHash(location.hash.slice(1));
    UI.tab = v.tab;
    if (v.tab === 'chat') { CHAT.open = v.conv; CHAT.pushed = false; }
    closeDialog();
    render();
    if (MODE === 'app' && ME) chatWake(v.tab === 'chat' ? 60 : null);
  });

  /* ---------- shared bits ---------- */
  function subjectOptions(sel, noneLabel) {
    function grp(g, label) {
      var list = S.subjects.filter(function (s) { return s.group === g; });
      if (!list.length) return '';
      return '<optgroup label="' + label + '">' + list.map(function (s) {
        return '<option value="' + s.id + '"' + (s.id === sel ? ' selected' : '') + '>' + esc(s.name) + '</option>';
      }).join('') + '</optgroup>';
    }
    return '<option value="">' + esc(noneLabel) + '</option>' + grp('ib', LV().group) + grp('core', 'Core') + grp('other', 'Other');
  }
  function whenInfo(e, t) {
    if (e.end && e.start <= t && e.end >= t) return { txt: 'Until ' + fShort(e.end), cls: 'live' };
    var n = diff(t, e.start);
    return { txt: rel(n), cls: n < 0 ? '' : n <= 1 ? 'urgent' : n <= 7 ? 'soon' : '' };
  }
  function dateChip(d, t) {
    var x = fromISO(d);
    return '<span class="datechip' + (d === t ? ' today' : '') + '" aria-hidden="true"><span class="wd">' + DAYS[dow(d)] + '</span><b>' + x.getDate() + '</b><span class="mo">' + MON[x.getMonth()] + '</span></span>';
  }
  function upRow(e, t, o) {
    o = o || {};
    var w = whenInfo(e, t);
    var range = e.end ? '<span class="detail">' + esc(fShort(e.start)) + ' – ' + esc(fShort(e.end)) + '</span>' : '';
    return '<button type="button" class="up-row' + (e.done ? ' done' : '') + (o.past ? ' past' : '') + '" data-act="ev-open" data-id="' + e.id + '">' +
      (o.noDate ? '' : dateChip(e.start, t)) +
      '<span class="up-main">' + evLabel(e) + evDetailHTML(e) + range + '</span>' +
      '<span class="when ' + (e.done ? '' : w.cls) + '">' + esc(e.done ? 'Done' : w.txt) + '</span>' +
      '<span class="sr">, ' + esc(fLong(e.start)) + '</span>' +
    '</button>';
  }
  function taskSort(a, b) {
    if (a.done !== b.done) return a.done ? 1 : -1;
    var ad = a.due || '9999-99-99', bd = b.due || '9999-99-99';
    if (ad !== bd) return ad < bd ? -1 : 1;
    /* the same day: no time first, then by time */
    var at = a.at || '', bt = b.at || '';
    if (at !== bt) return at < bt ? -1 : 1;
    return a.created < b.created ? -1 : a.created > b.created ? 1 : 0;
  }
  function dueLabel(x, t) {
    if (!x.due) return null;
    var n = diff(t, x.due);
    if (x.done) return { txt: 'Due ' + fDay(x.due), cls: '' };
    if (n < 0) return { txt: n === -1 ? 'Overdue since yesterday' : 'Overdue since ' + fDay(x.due), cls: 'overdue' };
    if (n === 0) return { txt: 'Due today', cls: 'today' };
    if (n === 1) return { txt: 'Due tomorrow', cls: '' };
    if (n < 7) return { txt: 'Due ' + DAYS_LONG[dow(x.due)], cls: '' };
    return { txt: 'Due ' + fDay(x.due), cls: '' };
  }
  function taskRow(x, t, o) {
    var s = subj(x.subject), e = evById(x.event), due = dueLabel(x, t), meta = [];
    if (x.at) meta.push('<span class="m tm">' + x.at + '</span>');
    if (s) meta.push('<span class="m"><i class="sw" style="' + cvar(s) + '"></i>' + esc(s.short) + '</span>');
    if (due) meta.push('<span class="m ' + due.cls + '">' + esc(due.txt) + '</span>');
    if (e) meta.push('<span class="m">For ' + esc(evShort(e)) + (evDetail(e) ? ' · ' + esc(evDetail(e)) : '') + '</span>');
    if (x.est) meta.push('<span class="m">' + esc(dur(x.est)) + '</span>');
    if (isRep(x)) meta.push('<span class="m rep">' + icon('repeat') + esc(repText(x.rep)) + '</span>');
    var occ = x.occ ? ' data-date="' + x.occ + '"' : '';
    return '<li class="task' + (x.done ? ' done' : '') + (isRep(x) ? ' is-rep' : '') + '"' + (o && o.drag ? ' data-drag="task:' + x.id + '"' + occ : '') + '>' +
      '<label class="check" style="' + cvar(s) + '"><input type="checkbox" data-change="task-done" data-id="' + x.id + '"' + occ + (x.done ? ' checked' : '') + ' aria-label="Done: ' + esc(x.title) + '"><span class="box">' + icon('check') + '</span></label>' +
      '<button type="button" class="task-main" data-act="task-open" data-id="' + x.id + '"' + occ + '><span class="task-title">' + esc(x.title) + '</span>' +
      (meta.length ? '<span class="task-meta">' + meta.join('') + '</span>' : '') + '</button>' +
    '</li>';
  }

  /* ---------- Today ---------- */
  VIEWS.today = function () {
    var t = today(), h = now().getHours();
    var greet = h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 19 ? 'Good afternoon' : 'Good evening';
    var name = ME ? ME.name : S.profile.name.trim();
    var td = fromISO(t);
    return '<section class="hero">' +
        '<div>' +
          '<h1 class="display">' + DAYS_LONG[dow(t)] + ' ' + td.getDate() + ' ' + MONTH_LONG[td.getMonth()] + '</h1>' +
          '<p class="sub">' + esc(greet) + (name ? ', ' + esc(name) : '') + '</p>' +
          winsRow(t) + headsUp(t) + petNudge() +
        '</div>' +
        countdown(t) +
        guideCard() +
      '</section>' +
      '<div class="today-cols">' +
        '<div class="col">' + cardClasses(t) + cardFocus() + '</div>' +
        '<div class="col">' + cardComing(t) + cardTasksToday(t) + '</div>' +
      '</div>';
  };

  /* today's wins: how many of today's tasks are done, and how many days in a row you got something done */
  function streakDays(t) {
    var days = {};
    S.sessions.forEach(function (x) { days[x.date] = 1; });
    S.tasks.forEach(function (x) { if (x.doneAt) days[x.doneAt] = 1; if (x.doneOn) x.doneOn.forEach(function (d) { days[d] = 1; }); });
    var n = 0, d = days[t] ? t : addDays(t, -1);
    while (days[d] && n < 1000) { n++; d = addDays(d, -1); }
    return { n: n, today: !!days[t] };
  }
  function winsRow(t) {
    var list = tasksOn(t), n = list.length, done = list.filter(function (x) { return x.done; }).length, st = streakDays(t), out = '';
    if (n) {
      var full = done === n;
      out += '<button type="button" class="win' + (full ? ' full' : '') + '" data-act="tab" data-tab="tasks" aria-label="' + done + ' of ' + n + ' tasks done today">' +
        (full ? (n === 1 ? '<b>Today’s task</b> is done' : '<b>All ' + n + '</b> of today’s tasks done') : '<b>' + done + ' of ' + n + '</b> ' + (n === 1 ? 'task' : 'tasks') + ' done today') + '</button>';
    }
    if (st.n || n) {
      out += '<span class="win streak-win" title="Days in a row with a finished task or study time">' +
        (st.n ? '<b>' + st.n + (st.n === 1 ? ' day' : ' days') + '</b> in a row' + (st.today ? '' : ', finish one today to keep it going') : 'No streak yet. Finish a task to start one.') + '</span>';
    }
    return out ? '<div class="wins">' + out + '</div>' : '';
  }
  /* the ring fills from where it was (or from empty when Today opens) */
  var RING = { p: null };
  function ringMount(entering) {
    var c = $('#view .wring-fg');
    if (!c) { RING.p = null; return; }
    var p = Number(c.dataset.p), from = entering || RING.p == null ? 0 : RING.p;
    RING.p = p;
    if (calm() || from === p) return;
    c.style.transition = 'none';
    c.style.strokeDashoffset = String(97.4 * (1 - from));
    void c.getBoundingClientRect();
    c.style.transition = '';
    c.style.strokeDashoffset = '';
  }
  /* big numbers count up when a section opens */
  function countUp(el) {
    var to = parseInt(el.textContent, 10);
    if (!(to > 1) || calm() || String(to) !== el.textContent.trim()) return;
    var t0 = performance.now(), d = Math.min(1100, 420 + to * 3);
    el.textContent = '0';
    (function f(t) {
      var k = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - k, 3);
      el.textContent = String(Math.round(to * e));
      if (k < 1) requestAnimationFrame(f);
    })(t0);
  }

  /* ---------- setup guide (empty planners) ---------- */
  function hasIBSubjects() { return S.subjects.some(function (s) { return s.group === 'ib'; }); }
  function guideSteps() {
    return [
      { act: 'guide-subjects', done: hasIBSubjects(), title: 'Add your ' + (level() === 'uni' ? 'courses' : 'subjects'), sub: 'Pick yours from a list.' },
      { act: 'guide-timetable', done: Object.keys(S.slots).length > 0, title: 'Fill in your timetable', sub: 'Tap a slot, then pick the class.' },
      { act: 'guide-dates', done: S.events.length > 0, title: 'Add your dates', sub: 'Deadlines and exams. Type them in or import your calendar.' },
      { act: 'guide-task', done: S.tasks.length > 0, title: 'Add a task', sub: 'Something you need to do this week.' }
    ];
  }
  function guideOn() { return S.settings.guide === 'new' || S.settings.guide === 'on'; }
  /* while the guide still has steps left, the support pop-up waits */
  function guideBusy() { return guideOn() && guideSteps().some(function (x) { return !x.done; }); }
  function guideCard() {
    if (!guideOn()) return '';
    var steps = guideSteps(), n = steps.filter(function (x) { return x.done; }).length, all = n === steps.length;
    var list = steps.map(function (x, i) {
      return '<li><button type="button" class="guide-step' + (x.done ? ' done' : '') + '" data-act="' + x.act + '">' +
        '<span class="gs-num" aria-hidden="true">' + (x.done ? icon('check') : i + 1) + '</span>' +
        '<span class="two-line"><b>' + esc(x.title) + '</b><span>' + esc(x.done ? 'Done' : x.sub) + '</span></span>' + icon('chev') +
        (x.done ? '<span class="sr">, done</span>' : '') + '</button></li>';
    }).join('');
    return '<section class="card c-guide" aria-labelledby="h-guide">' +
        '<header class="card-head"><h2 id="h-guide">' + (all ? 'You’re all set' : 'Set up Bloc') + '</h2>' +
          '<button type="button" class="link" data-act="guide-hide">' + (all ? 'Close' : 'Hide') + '</button></header>' +
        '<div class="guide-progress"><div class="guide-bar" aria-hidden="true"><i style="width:' + Math.round(n / steps.length * 100) + '%"></i></div>' +
          '<span class="guide-count">' + n + ' of ' + steps.length + ' done</span></div>' +
        (all ? '<p class="empty">Your planner is ready. Settings has more: ' + (sellHere() || plusOn() ? 'a backup, calendar export and Bloc Plus.' : 'a backup and calendar export.') + '</p>' : '<ol class="guide-steps">' + list + '</ol>') +
      '</section>';
  }

  function headsUp(t) {
    var hol = holidayOn(t);
    if (hol) {
      var back = nextSchoolDay(evEnd(hol));
      return '<button type="button" class="heads-up calm" data-act="ev-open" data-id="' + hol.id + '">' + esc(evTitle(hol)) + (back ? ' · back ' + esc(fDay(back)) : '') + '</button>';
    }
    var soon = S.events.filter(function (e) { return !e.done && (e.type === 'deadline' || e.type === 'exam') && e.start >= t && diff(t, e.start) <= 2; }).sort(evOrder)[0];
    if (soon) {
      var n = diff(t, soon.start);
      return '<button type="button" class="heads-up" data-act="ev-open" data-id="' + soon.id + '">' + esc(evFull(soon)) + ' ' + (n === 0 ? 'is today' : n === 1 ? 'is tomorrow' : 'in 2 days') + '</button>';
    }
    var mock = S.events.filter(function (e) { return e.type === 'mock' && covers(e, t); })[0];
    if (mock) {
      return '<button type="button" class="heads-up" data-act="ev-open" data-id="' + mock.id + '">' + esc(evTitle(mock)) + ' · day ' + (diff(mock.start, t) + 1) + ' of ' + (diff(mock.start, evEnd(mock)) + 1) + '</button>';
    }
    return '';
  }

  function countdown(t) {
    var exams = S.events.filter(function (e) { return e.type === 'exam'; }).sort(byStart);
    var val, sub;
    function days(n) { return n + (n === 1 ? ' day' : ' days'); }
    if (!exams.length) { val = 'None yet'; sub = 'Add your exam dates in the calendar.'; }
    else if (!isIB()) {
      /* exams all year round: count down to the next one */
      var nx = exams.filter(function (e) { return !e.done && evEnd(e) >= t; })[0];
      if (!nx) { val = 'None'; sub = 'No exams coming up.'; }
      else {
        var dn = diff(t, nx.start);
        val = dn <= 0 ? 'Today' : days(dn);
        sub = evFull(nx) + ', ' + fDay(nx.start);
      }
    } else {
      var first = exams[0], last = exams[exams.length - 1];
      if (t < first.start) {
        val = days(diff(t, first.start));
        sub = 'First paper ' + fDay(first.start) + ', ' + (subj(first.subject) ? subj(first.subject).name : evTitle(first));
      } else if (t <= evEnd(last)) {
        var left = exams.filter(function (e) { return e.start >= t; });
        val = left.length + ' left';
        sub = left.length ? 'Next: ' + evFull(left[0]) + ', ' + fDay(left[0].start) : '';
      } else { val = 'Done'; sub = 'Exams are done.'; }
    }
    var mock = S.events.filter(function (e) { return e.type === 'mock' && evEnd(e) >= t; }).sort(byStart)[0];
    var mockVal = !mock ? '–' : mock.start <= t ? 'On now' : diff(t, mock.start) === 1 ? 'Tomorrow' : 'in ' + diff(t, mock.start) + ' days';
    var n14 = S.events.filter(function (e) { return e.type === 'deadline' && !e.done && e.start >= t && diff(t, e.start) <= 14; }).length;
    function row(what, note, v, cls) {
      return '<li' + (cls ? ' class="' + cls + '"' : '') + '><span class="cl-what"><b>' + esc(what) + '</b>' + (note ? '<span>' + esc(note) + '</span>' : '') + '</span><b class="cl-val">' + esc(v) + '</b></li>';
    }
    return '<div class="count" role="group" aria-labelledby="h-count">' +
        '<h2 class="count-cap" id="h-count">Countdowns</h2>' +
        '<ul class="count-list">' +
          row(LV().exams, sub, val, 'lead') +
          (mock ? row(evTitle(mock), mock.start <= t ? 'until ' + fDay(evEnd(mock)) : fDay(mock.start), mockVal) : '') +
          schoolEnds(t) +
          row('Deadlines', 'in the next 14 days', String(n14)) +
        '</ul>' +
      '</div>';
  }

  /* days until the last day of school, for each IB year (dates in data.js) */
  var SCHOOL_END = (Array.isArray(window.IB_SCHOOL_END) ? window.IB_SCHOOL_END : []).filter(function (x) { return Array.isArray(x) && typeof x[0] === 'string' && DATE.test(x[1]); });
  function schoolEnds(t) {
    if (!SCHOOL_END.length || isFree()) return '';
    return SCHOOL_END.map(function (x) {
      var n = diff(t, x[1]);
      var val = n > 1 ? n + ' days' : n === 1 ? 'Tomorrow' : n === 0 ? 'Today' : 'Done';
      return '<li><span class="cl-what"><b>School ends, ' + esc(x[0]) + '</b><span>' + esc(fDay(x[1])) + '</span></span><b class="cl-val">' + esc(val) + '</b></li>';
    }).join('');
  }

  function cardClasses(t) {
    var todays = blocksFor(t);
    var nm = nowMin();
    var overToday = !todays.length || nm >= toMin(todays[todays.length - 1].end);
    var nextDay = nextSchoolDay(t);
    var which = UI.todayWhich || (overToday && nextDay ? 'next' : 'today');
    if (which === 'next' && !nextDay) which = 'today';
    var d = which === 'today' ? t : nextDay;
    var gap = nextDay ? diff(t, nextDay) : 0;
    var nextLabel = !nextDay ? '' : gap === 1 ? 'Tomorrow' : gap < 7 ? DAYS_LONG[dow(nextDay)] : 'Next school day';
    var title = which === 'today' ? "Today's classes" : gap < 7 ? nextLabel + "'s classes" : 'Back to school';
    var hol = holidayOn(d), blocks = blocksFor(d), body;
    if (hol) body = '<p class="empty">No classes: <b>' + esc(evTitle(hol)) + '</b>.</p>';
    else if (!blocks.length) body = '<p class="empty">No classes ' + (which === 'today' ? 'today' : 'that day') + '.' + (nextDay && which === 'today' ? ' Next school day: <b>' + esc(fDay(nextDay)) + '</b>.' : '') + '</p>';
    else body = (which === 'today' && overToday ? '<p class="day-note">That\'s it for today.</p>' : '') + '<ol class="daylist">' + dayListHTML(d, which === 'today') + '</ol>';
    return '<section class="card c-classes" aria-labelledby="h-classes">' +
        '<header class="card-head"><h2 id="h-classes">' + esc(title) + '<span class="hint">' + esc(fDay(d)) + '</span></h2>' +
          (nextDay ? '<div class="seg" role="group" aria-label="Which day">' +
            '<button type="button" data-act="today-which" data-which="today" aria-pressed="' + (which === 'today') + '">Today</button>' +
            '<button type="button" data-act="today-which" data-which="next" aria-pressed="' + (which === 'next') + '">' + esc(nextLabel) + '</button>' +
          '</div>' : '') +
        '</header>' + body +
        '<button type="button" class="link more-link" data-act="tab" data-tab="timetable">Edit timetable</button>' +
      '</section>';
  }

  function dayListHTML(d, live) {
    var blocks = blocksFor(d);
    if (!blocks.length) return '';
    var nm = live ? nowMin() : -1;
    var first = toMin(blocks[0].start), last = toMin(blocks[blocks.length - 1].end);
    var items = blocks.map(function (b) { return { kind: 'b', b: b, st: toMin(b.start), en: toMin(b.end) }; });
    S.periods.forEach(function (p) {
      if (p.kind === 'break' && toMin(p.start) >= first && toMin(p.end) <= last) items.push({ kind: 'br', p: p, st: toMin(p.start), en: toMin(p.end) });
    });
    items.sort(function (a, b) { return a.st - b.st; });
    var html = '', prevEnd = null, nextMarked = false;
    items.forEach(function (it) {
      if (prevEnd != null && it.st - prevEnd >= 25) {
        html += '<li class="dl-row free"><span class="dl-time">' + minToTime(prevEnd) + '</span><div class="dl-block"><span class="dl-meta">Free for ' + esc(dur(it.st - prevEnd)) + '</span></div></li>';
      }
      if (it.kind === 'br') {
        html += '<li class="dl-row brk"><span class="dl-time">' + it.p.start + '</span><div class="dl-band">' + esc(it.p.label || 'Break') + ', ' + esc(dur(it.en - it.st)) + '</div></li>';
      } else {
        var b = it.b, cls = '', tag = '', fill = false;
        if (live) {
          if (nm >= it.en) { cls = 'past'; fill = true; }
          else if (nm >= it.st) {
            cls = 'now'; fill = true;
            tag = '<span class="now-tag">' + esc(dur(Math.max(1, Math.ceil(it.en - nm)))) + ' left</span>';
          } else if (!nextMarked) {
            nextMarked = true;
            tag = '<span class="next-tag">Next' + (it.st - nm <= 120 ? ', in ' + esc(dur(Math.max(1, Math.ceil(it.st - nm)))) : '') + '</span>';
          }
        }
        var meta = [b.sl.teacher || b.s.teacher, b.sl.room, b.sl.note].filter(Boolean).join(', ');
        var inner = '<span class="dl-top"><span class="dl-name">' + esc(b.s.name) + '</span>' + tag + '</span>' +
          (meta ? '<span class="dl-meta">' + esc(meta) + '</span>' : '');
        html += '<li class="dl-row ' + cls + '"><span class="dl-time">' + b.start + '<small>' + b.end + '</small></span>' +
          '<button type="button" class="dl-block" style="' + cvar(b.s) + '" data-act="tt-cell" data-p="' + b.p.id + '" data-d="' + dow(d) + '">' +
            inner + (fill ? fillBar(it.st, it.en, nm, inner) : '') +
          '</button></li>';
      }
      prevEnd = Math.max(prevEnd == null ? 0 : prevEnd, it.en);
    });
    return html;
  }

  /* The subject's colour bar grows to the right while the class goes on and fills the block once it's over.
     It carries a copy of the block's text in dark ink (light on the darkest colours), clipped to the bar,
     so every letter the bar passes stays readable. tick() moves it every second. */
  function fillBar(st, en, nm, inner) {
    var p = Math.max(0, Math.min(1, (nm - st) / (en - st)));
    return '<span class="fill-bar" data-st="' + st + '" data-en="' + en + '" style="--p:' + p.toFixed(4) + '" aria-hidden="true">' + (inner || '') + '</span>';
  }
  function moveFillBars() {
    var bars = $$('#view .fill-bar[data-st]');
    if (!bars.length) return;
    var nm = nowMin();
    bars.forEach(function (f) {
      var st = Number(f.dataset.st), en = Number(f.dataset.en), p = Math.max(0, Math.min(1, (nm - st) / (en - st))).toFixed(3);
      if (f.style.getPropertyValue('--p') !== p) f.style.setProperty('--p', p);
    });
  }

  function cardComing(t) {
    var list = S.events.filter(function (e) { return !e.done && evEnd(e) >= t; }).sort(byStart).slice(0, 6);
    return '<section class="card c-coming" aria-labelledby="h-coming">' +
        '<header class="card-head"><h2 id="h-coming">Coming up</h2><button type="button" class="link" data-act="cal-agenda">All dates</button></header>' +
        (list.length ? '<ul class="uplist">' + list.map(function (e) { return '<li>' + upRow(e, t) + '</li>'; }).join('') + '</ul>'
          : '<p class="empty">Nothing coming up. Add deadlines in the calendar.</p>') +
      '</section>';
  }

  /* every open task, with a repeating task as its next day not done yet */
  function openTasks(t) {
    var out = [];
    S.tasks.forEach(function (x) {
      if (isRep(x)) { var d = nextOcc(x, t, true); if (d) out.push(occView(x, d)); }
      else if (!x.done) out.push(x);
    });
    return out;
  }
  function cardTasksToday(t) {
    var soon = openTasks(t).filter(function (x) { return x.due && diff(t, x.due) <= 3; }).sort(taskSort);
    var undated = S.tasks.filter(function (x) { return !x.done && !x.due; }).length;
    return '<section class="card c-tasks" aria-labelledby="h-tasks">' +
        '<header class="card-head"><h2 id="h-tasks">Tasks<span class="hint">next 3 days</span></h2><button type="button" class="link" data-act="tab" data-tab="tasks">All tasks</button></header>' +
        '<form class="quick" data-form="quick-task" autocomplete="off">' +
          '<input type="text" name="title" id="quick-title" maxlength="200" placeholder="Add a task for today (#math sets the subject)" aria-label="New task for today">' +
          '<button type="submit" class="btn primary" aria-label="Add task">' + icon('plus') + '</button>' +
        '</form>' +
        (soon.length ? '<ul class="tasklist">' + soon.map(function (x) { return taskRow(x, t); }).join('') + '</ul>'
          : '<p class="empty">Nothing due in the next 3 days.' + (undated ? ' ' + undated + ' task' + (undated > 1 ? 's have' : ' has') + ' no date.' : '') + '</p>') +
      '</section>';
  }

  var RING_C = 2 * Math.PI * 66;
  function cardFocus() {
    var st = timerState();
    var sel = st ? st.subject : (subj(UI.focusSubject) ? UI.focusSubject : '');
    var up = st ? st.up : UI.focusUp, len = st ? st.len : UI.focusLen;
    var opts = '<option value="">General study</option>' + S.subjects.filter(function (s) { return s.group !== 'other'; }).map(function (s) {
      return '<option value="' + s.id + '"' + (sel === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>';
    }).join('');
    var go = !st ? '<button type="button" class="round-btn go" data-act="focus-start">Start</button>'
      : st.running ? '<button type="button" class="round-btn pause" data-act="focus-pause">Pause</button>'
      : '<button type="button" class="round-btn go" data-act="focus-resume">Resume</button>';
    return '<section class="card c-focus" aria-labelledby="h-focus">' +
        '<header class="card-head"><h2 id="h-focus">Focus</h2><button type="button" class="link" data-act="focus-log">Log time by hand</button></header>' +
        '<div class="focus-row">' +
          '<div class="ring' + (st && !st.running ? ' paused' : '') + '">' +
            '<svg viewBox="0 0 148 148" aria-hidden="true"><circle class="trk" cx="74" cy="74" r="66"/><circle class="arc" id="ring-arc" cx="74" cy="74" r="66" stroke-linecap="round" stroke-dasharray="' + RING_C.toFixed(2) + '" stroke-dashoffset="0"/></svg>' +
            '<div class="ring-num" role="timer" aria-live="off"><b id="ring-time">' + (up ? '0:00' : fmtClock(len * 60)) + '</b><span id="ring-sub">' + (st ? (st.running ? (up ? 'Stopwatch' : 'Focusing') : 'Paused') : up ? 'Stopwatch' : 'Ready') + '</span></div>' +
          '</div>' +
          '<div class="focus-controls">' +
            '<span class="select-pill"><select id="focus-subject" data-change="focus-subject" aria-label="Subject"' + (st ? ' disabled' : '') + '>' + opts + '</select>' + icon('updown') + '</span>' +
            '<div class="seg" role="group" aria-label="Session length">' + [25, 45, 60].map(function (m) {
              return '<button type="button" data-act="focus-len" data-len="' + m + '" aria-pressed="' + (!up && len === m) + '"' + (st ? ' disabled' : '') + '>' + m + ' min</button>';
            }).join('') +
              (plusOn() || sellHere() ? '<button type="button" data-act="focus-custom" aria-pressed="' + (!up && [25, 45, 60].indexOf(len) < 0) + '"' + (st ? ' disabled' : '') + '>' + ([25, 45, 60].indexOf(len) < 0 ? len + ' min' : 'Other') + '</button>' : '') +
              '<button type="button" class="seg-watch" data-act="focus-len" data-len="up" aria-pressed="' + !!up + '"' + (st ? ' disabled' : '') + ' aria-label="Stopwatch" title="Stopwatch: counts up until you stop it">' + icon('watch') + '</button>' +
            '</div>' +
            '<div class="btns">' +
              '<button type="button" class="round-btn stop" data-act="focus-cancel"' + (st ? '' : ' disabled') + '>Cancel</button>' + go +
            '</div>' +
            (st ? '<button type="button" class="link" data-act="focus-finish">' + (st.up ? 'Stop and log it' : 'Finish now and log it') + '</button>' : '') +
          '</div>' +
        '</div>' + weekBars() +
      '</section>';
  }

  function weekBars() {
    var t = today(), mon = addDays(t, -dow(t)), sun = addDays(mon, 6);
    var mins = {}, total = 0;
    S.sessions.forEach(function (x) {
      if (x.date >= mon && x.date <= sun) { var k = x.subject || ''; mins[k] = (mins[k] || 0) + x.minutes; total += x.minutes; }
    });
    var rows = [];
    S.subjects.forEach(function (s) { var m = mins[s.id] || 0; if (m > 0 || s.goal > 0) rows.push({ s: s, m: m, goal: s.goal }); });
    if (mins['']) rows.push({ s: null, m: mins[''], goal: 0 });
    rows.sort(function (a, b) { return b.m - a.m || b.goal - a.goal; });
    var max = Math.max.apply(null, [1].concat(rows.map(function (r) { return Math.max(r.m, r.goal); })));
    var anyGoal = rows.some(function (r) { return r.goal > 0; });
    var list = rows.map(function (r) {
      var tip = (r.s ? r.s.name : 'General study') + ': ' + dur(r.m) + (r.goal ? ' of a ' + dur(r.goal) + ' goal' : '') + ' this week';
      return '<li class="bar-row" title="' + esc(tip) + '">' +
          '<span class="bar-label"><i class="sw" style="' + cvar(r.s) + '"></i><span class="t">' + esc(r.s ? r.s.short : 'General') + '</span></span>' +
          '<span class="bar-track" role="img" aria-label="' + esc(tip) + '">' +
            (r.m ? '<span class="bar-fill" style="width:' + (r.m / max * 100).toFixed(1) + '%"></span>' : '') +
            (r.goal ? '<span class="bar-goal" style="left:' + (r.goal / max * 100).toFixed(1) + '%"></span>' : '') +
          '</span>' +
          '<span class="bar-val">' + esc(dur(r.m)) + '</span>' +
        '</li>';
    }).join('');
    return '<div class="focus-week">' +
        '<div class="fw-head"><h3>This week</h3><span>' + (total ? esc(dur(total)) + ' studied' : 'Nothing logged yet') + '</span></div>' +
        (rows.length ? '<ul class="bars">' + list + '</ul>' + (anyGoal ? '<p class="fw-legend"><i></i>Weekly goal (set it on the subject)</p>' : '')
          : '<p class="empty">Finish a focus session and your study time shows up here.</p>') +
      '</div>';
  }

  function updateTimerUI() {
    var st = timerState();
    var tEl = $('#ring-time'), arc = $('#ring-arc');
    if (st) {
      if (st.remaining <= 0) { completeTimer(); return; }
      var secs = Math.ceil(st.remaining / 1000), shown = st.up ? fmtWatch(st.elapsed / 1000) : fmtClock(secs);
      if (tEl) tEl.textContent = shown;
      /* the stopwatch ring fills once an hour */
      if (arc) arc.setAttribute('stroke-dashoffset', (RING_C * (st.up ? 1 - (st.elapsed % 3600000) / 3600000 : 1 - st.remaining / st.total)).toFixed(2));
      var pt = $('#pet-timer'); if (pt) pt.textContent = shown;
      document.title = shown + ' · ' + (subj(st.subject) ? subj(st.subject).short : 'Focus') + ' · Bloc';
    } else {
      if (arc) arc.setAttribute('stroke-dashoffset', UI.focusUp ? RING_C.toFixed(2) : '0');
      document.title = 'Bloc';
    }
  }
  function completeTimer() {
    var st = timerState();
    if (!st) return;
    S.timer = null;
    logSession(st.subject, st.len, toISO(new Date(st.startedAt)), timerId(st));
    save();
    if (st.up) { render(); toast('The stopwatch stopped at 12 hours: ' + dur(st.len) + ' of ' + nameOrGeneral(st.subject) + ' logged' + petNote()); return; }
    chime();
    try { if (navigator.vibrate) navigator.vibrate([180, 80, 180]); } catch (e) { /* ignore */ }
    render();
    toast('Session done: ' + dur(st.len) + ' of ' + nameOrGeneral(st.subject) + ' logged' + petNote());
    celebrate(null, st.len >= 25);
  }
  var actx = null;
  function unlockAudio() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      actx = actx || new AC();
      if (actx.state === 'suspended') actx.resume();
    } catch (e) { actx = null; }
  }
  function chime() {
    if (!actx) return;
    try {
      var t0 = actx.currentTime;
      [880, 1175, 1568].forEach(function (f, i) {
        var o = actx.createOscillator(), g = actx.createGain(), at = t0 + i * 0.22;
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(0.18, at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.38);
        o.connect(g); g.connect(actx.destination);
        o.start(at); o.stop(at + 0.4);
      });
    } catch (e) { /* ignore */ }
  }

  /* ---------- Timetable ---------- */
  VIEWS.timetable = function () {
    var days = S.settings.weekend ? 7 : 5, t = today(), td = dow(t), hol = holidayOn(t), nm = nowMin();
    var g = '<div class="tt-corner" aria-hidden="true"></div>';
    for (var d = 0; d < days; d++) g += '<div class="tt-dayhead' + (d === td && !hol ? ' today' : '') + '">' + DAYS[d] + '</div>';
    S.periods.forEach(function (p) {
      g += timeButton(p);
      if (p.kind === 'break') { g += '<div class="tt-break">' + esc(p.label || 'Break') + '</div>'; return; }
      for (var dd = 0; dd < days; dd++) g += ttCell(p, dd, td, nm, hol);
    });
    var counts = slotCounts(), filled = Object.keys(S.slots).length;
    var legend = S.subjects.filter(function (s) { return counts[s.id]; })
      .sort(function (a, b) { return counts[b.id] - counts[a.id]; })
      .map(function (s) { return '<span><i class="sw" style="' + cvar(s) + '"></i>' + esc(s.name) + ' <b>' + counts[s.id] + '</b></span>'; }).join('');
    /* an almost empty timetable shows a faint + in every free slot, so phones show where to tap */
    var sparse = filled < 5 ? ' tt-sparse' : '';
    var tip = filled ? '' : '<div class="card tip" role="note"><p><b>Your timetable is empty.</b> ' +
      (hasIBSubjects() ? 'Tap a slot to add a class. Tap a time to change it to your school’s times.' : 'Add your subjects first, then tap a slot to put a class in it.') + '</p>' +
      (hasIBSubjects() ? '' : '<button type="button" class="btn primary" data-act="guide-subjects">' + icon('plus') + 'Add Subjects</button>') + '</div>';
    return '<div class="page-head">' +
        '<div><h1 class="display">Timetable</h1><p class="sub">' + (isFree() ? 'Tap a slot to add a class. Tap a time to edit the row.' : '2º BI B. Tap a class to change it, or a time to edit the row.') + '</p></div>' +
        '<div class="actions">' +
          '<label class="switch"><input type="checkbox" id="tt-weekend" data-change="tt-weekend"' + (S.settings.weekend ? ' checked' : '') + '>Weekend</label>' +
          '<button type="button" class="btn" data-act="tt-add-row">' + icon('plus') + 'Add row</button>' +
        '</div>' +
      '</div>' + tip +
      '<div class="tt-desktop' + sparse + '"><div class="tt" style="--days:' + days + '">' + g + '</div></div>' +
      '<div class="tt-mobile' + sparse + '">' + ttMobile(days, td, nm, hol) + '</div>' +
      (legend ? '<div class="legend" aria-label="Slots per week">' + legend + '</div>' : '') +
      '<p class="tt-foot">' + (isFree() ? 'The rows start with the school’s bell times; tap a time to change one. Numbers show classes per week.' : 'Times come from the printed timetable; tap a time to fix one. Numbers show slots per week.') + '</p>';
  };
  function timeButton(p) {
    var brk = p.kind === 'break';
    return '<button type="button" class="tt-time' + (brk ? ' brk' : '') + '" data-act="tt-period" data-p="' + p.id + '" aria-label="Edit row ' + p.start + ' to ' + p.end + '">' +
      '<b>' + p.start + '</b><span>' + p.end + '</span>' + (p.label && !brk ? '<em>' + esc(p.label) + '</em>' : '') + '</button>';
  }
  function ttCell(p, d, td, nm, hol) {
    var sl = S.slots[slotKey(p.id, d)], s = sl && subj(sl.subject);
    if (!s) return '<button type="button" class="tt-cell empty" data-act="tt-cell" data-p="' + p.id + '" data-d="' + d + '" aria-label="Add a class on ' + DAYS_LONG[d] + ' at ' + p.start + '">' + icon('plus') + '</button>';
    var tm = slotTimes(p, sl);
    var live = !hol && d === td && nm >= toMin(tm.start) && nm < toMin(tm.end);
    var meta = [sl.teacher || s.teacher, sl.room].filter(Boolean).join(', ');
    var inner = '<span class="n">' + esc(s.short) + '</span>' +
      (meta ? '<span class="m">' + esc(meta) + '</span>' : '') +
      (sl.start ? '<span class="x">' + sl.start + '–' + sl.end + '</span>' : '') +
      (sl.note ? '<span class="m">' + esc(sl.note) + '</span>' : '');
    return '<button type="button" class="tt-cell' + (live ? ' now' : '') + '" style="' + cvar(s) + '" data-act="tt-cell" data-p="' + p.id + '" data-d="' + d + '" aria-label="' + esc(DAYS_LONG[d] + ' ' + tm.start + ', ' + s.name + (meta ? ', ' + meta : '')) + '">' +
      inner + (live ? fillBar(toMin(tm.start), toMin(tm.end), nm, inner) : '') +
    '</button>';
  }
  function ttMobile(days, td, nm, hol) {
    var day = UI.ttDay;
    if (day == null || day >= days) day = td < days ? td : 0;
    var tabs = '<div class="seg tt-days" style="--days:' + days + '" role="group" aria-label="Day">';
    for (var d = 0; d < days; d++) tabs += '<button type="button" class="' + (d === td ? 'today' : '') + '" data-act="tt-day" data-d="' + d + '" aria-pressed="' + (d === day) + '">' + DAYS[d] + '</button>';
    tabs += '</div>';
    var rows = S.periods.map(function (p) {
      if (p.kind === 'break') return '<li class="dl-row brk">' + timeButton(p) + '<div class="dl-band">' + esc(p.label || 'Break') + '</div></li>';
      return '<li class="dl-row">' + timeButton(p) + ttCell(p, day, td, nm, hol) + '</li>';
    }).join('');
    return tabs + '<ol class="daylist glass">' + rows + '</ol>';
  }

  /* ---------- Calendar ---------- */
  function visible(e) { return UI.hidden.indexOf(e.subject || '_school') < 0; }
  VIEWS.calendar = function () {
    var t = today();
    if (!UI.calMonth) UI.calMonth = t.slice(0, 7);
    if (!UI.calSel) UI.calSel = t;
    var ym = UI.calMonth.split('-').map(Number), y = ym[0], m = ym[1];
    var agenda = UI.calMode === 'agenda';
    var head = '<div class="page-head">' +
        '<div class="cal-title"><h1 class="display">' + (agenda ? 'All dates' : esc(MONTH_LONG[m - 1]) + ' <span>' + y + '</span>') + '</h1></div>' +
        '<div class="actions">' +
          '<div class="seg" role="group" aria-label="View"><button type="button" data-act="cal-mode" data-mode="month" aria-pressed="' + !agenda + '">Month</button><button type="button" data-act="cal-mode" data-mode="agenda" aria-pressed="' + agenda + '">List</button></div>' +
          (agenda ? '' :
            '<button type="button" class="icon-btn" data-act="cal-step" data-step="-1" aria-label="Previous month">' + icon('left') + '</button>' +
            '<button type="button" class="btn" data-act="cal-today">Today</button>' +
            '<button type="button" class="icon-btn" data-act="cal-step" data-step="1" aria-label="Next month">' + icon('right') + '</button>') +
          '<button type="button" class="btn primary" data-act="ev-new">' + icon('plus') + 'Event</button>' +
        '</div>' +
      '</div>';
    var panel = UI.calSel && UI.calSel.slice(0, 7) === UI.calMonth ? dayPanel(UI.calSel, t) : monthPanel(y, m, t);
    return head + filterChips() + (agenda ? agendaHTML(t) : '<div class="cal-layout">' + monthHTML(y, m, t) + panel + '</div>');
  };
  function monthPanel(y, m, t) {
    var first = y + '-' + pad(m) + '-01', last = toISO(new Date(y, m, 0));
    var evs = S.events.filter(function (e) { return visible(e) && e.start <= last && evEnd(e) >= first; }).sort(byStart);
    return '<aside class="daypanel" aria-labelledby="dp-h">' +
        '<h2 id="dp-h">' + MONTH_LONG[m - 1] + ' ' + y + '</h2>' +
        '<p class="dp-sub">' + (evs.length ? evs.length + ' date' + (evs.length > 1 ? 's' : '') + ' this month' : 'Nothing scheduled this month') + ' · pick a day for details</p>' +
        (evs.length ? '<ul class="dp-list dated">' + evs.map(function (e) { return '<li>' + upRow(e, t) + '</li>'; }).join('') + '</ul>' : '') +
        '<div class="dp-actions"><button type="button" class="btn small" data-act="ev-new" data-date="' + (t >= first && t <= last ? t : first) + '">' + icon('plus') + 'Event</button></div>' +
      '</aside>';
  }

  function filterChips() {
    var used = new Set(S.events.map(function (e) { return e.subject || '_school'; }));
    var items = S.subjects.filter(function (s) { return used.has(s.id); }).map(function (s) { return { id: s.id, name: s.short, style: cvar(s), cls: '' }; });
    if (used.has('_school')) items.push({ id: '_school', name: 'School dates', style: '', cls: 'mock' });
    if (items.length < 2) return '';
    var hidden = new Set(UI.hidden);
    return '<div class="filters" role="group" aria-label="Show or hide subjects">' + items.map(function (i) {
      return '<button type="button" class="chip" data-act="cal-filter" data-id="' + i.id + '" aria-pressed="' + !hidden.has(i.id) + '"><i class="sw ' + i.cls + '" style="' + i.style + '"></i>' + esc(i.name) + '</button>';
    }).join('') + (hidden.size ? '<button type="button" class="link" data-act="cal-filter-all">Show all</button>' : '') + '</div>';
  }

  function monthHTML(y, m, t) {
    var first = y + '-' + pad(m) + '-01';
    var start = addDays(first, -dow(first));
    var lastDay = toISO(new Date(y, m, 0));
    var end = addDays(lastDay, 6 - dow(lastDay));
    var evs = S.events.filter(visible);
    var multi = evs.filter(function (e) { return !!e.end; }).sort(byStart);
    var singles = evs.filter(function (e) { return !e.end; });
    var plans = S.plans.filter(function (p) { return !p.subject || UI.hidden.indexOf(p.subject) < 0; }).sort(function (a, b) { return toMin(a.at) - toMin(b.at); });
    var html = '<div class="month"><div class="mhead" aria-hidden="true">' + DAYS.map(function (d) { return '<span>' + d + '</span>'; }).join('') + '</div>';
    for (var ws = start; ws <= end; ws = addDays(ws, 7)) {
      var we = addDays(ws, 6);
      var segs = multi.filter(function (e) { return e.start <= we && evEnd(e) >= ws; }).map(function (e) {
        return { e: e, s: e.start < ws ? ws : e.start, en: evEnd(e) > we ? we : evEnd(e) };
      });
      var laneEnds = [];
      segs.forEach(function (sg) {
        var lane = -1;
        for (var i = 0; i < laneEnds.length; i++) if (laneEnds[i] < sg.s) { lane = i; break; }
        if (lane < 0) { lane = laneEnds.length; laneEnds.push(sg.en); } else laneEnds[lane] = sg.en;
        sg.lane = lane;
      });
      var lanes = laneEnds.length;
      var w = '<div class="wk" data-ws="' + ws + '" style="grid-template-rows:var(--num-h) ' + (lanes ? 'repeat(' + lanes + ',var(--lane-h)) ' : '') + 'minmax(var(--stack-h),auto)">';
      var i2, d;
      for (i2 = 0; i2 < 7; i2++) {
        d = addDays(ws, i2);
        var out = d.slice(0, 7) !== UI.calMonth;
        var dayItems = singles.filter(function (e) { return e.start === d; }).length + segs.filter(function (sg) { return sg.s <= d && sg.en >= d; }).length + monthTasks(d).length;
        w += '<button type="button" class="mday' + (i2 === 0 ? ' c1' : '') + (i2 >= 5 ? ' wknd' : '') + (d === UI.calSel ? ' sel' : '') + '" style="grid-column:' + (i2 + 1) + '" data-act="cal-sel" data-date="' + d + '" aria-label="' + esc(fLong(d) + (dayItems ? ', ' + dayItems + ' item' + (dayItems > 1 ? 's' : '') : '')) + '"' + (d === UI.calSel ? ' aria-current="date"' : '') + '></button>';
        w += '<span class="mnum' + (out ? ' out' : '') + (d === t ? ' today' : d === UI.calSel ? ' sel' : '') + '" style="grid-column:' + (i2 + 1) + '" aria-hidden="true">' + fromISO(d).getDate() + '</span>';
      }
      segs.forEach(function (sg) {
        var e = sg.e, c1 = diff(ws, sg.s) + 1, c2 = diff(ws, sg.en) + 2;
        var cls = ['bar', e.type === 'mock' ? 'mock' : e.type === 'holiday' ? 'holiday' : '', e.start < ws ? 'cont-l' : '', evEnd(e) > we ? 'cont-r' : '', e.done ? 'done' : ''].filter(Boolean).join(' ');
        w += '<button type="button" class="' + cls + '" style="grid-row:' + (2 + sg.lane) + ';grid-column:' + c1 + ' / ' + c2 + ';' + cvar(subj(e.subject)) + '" data-act="ev-open" data-id="' + e.id + '" data-drag="event:' + e.id + '" title="' + esc(evFull(e) + ' · ' + fShort(e.start) + ' – ' + fShort(evEnd(e))) + '">' + esc(evTitle(e)) + '</button>';
      });
      for (i2 = 0; i2 < 7; i2++) {
        d = addDays(ws, i2);
        var items = cellItems(d, singles, monthTasks(d), plans);
        var MAX = 3, cut = items.length > MAX ? MAX - 1 : MAX, st = '';
        items.forEach(function (it, idx) {
          var extra = idx >= cut;
          st += it.k === 'e' ? mpEvent(it.e, extra) : it.k === 't' ? mpTask(it.x, extra) : mpPlan(it.p, extra);
        });
        if (items.length > cut) st += '<button type="button" class="more" data-act="cal-sel" data-date="' + d + '">+' + (items.length - cut) + ' more</button>';
        w += '<div class="mstack" style="grid-row:' + (2 + lanes) + ';grid-column:' + (i2 + 1) + '">' + st + '</div>';
      }
      html += w + '</div>';
    }
    return html + '</div>';
  }
  /* one day in the month: things without a time first (exams, deadlines, tasks), then everything with a time, earliest first */
  function monthTasks(d) { return tasksOn(d).filter(function (x) { return !x.subject || UI.hidden.indexOf(x.subject) < 0; }); }
  function cellItems(d, singles, tasks, plans) {
    var allDay = singles.filter(function (e) { return e.start === d && !e.at; }).sort(evOrder).map(function (e) { return { k: 'e', e: e }; })
      .concat(tasks.filter(function (x) { return x.due === d && !x.at; }).sort(taskSort).map(function (x) { return { k: 't', x: x }; }));
    var timed = singles.filter(function (e) { return e.start === d && e.at; }).map(function (e) { return { k: 'e', e: e, m: toMin(e.at), o: 0 }; })
      .concat(tasks.filter(function (x) { return x.due === d && x.at; }).map(function (x) { return { k: 't', x: x, m: toMin(x.at), o: 1 }; }))
      .concat(plans.filter(function (p) { return p.date === d; }).map(function (p) { return { k: 'p', p: p, m: toMin(p.at), o: 2 }; }));
    timed.sort(function (a, b) { return a.m - b.m || a.o - b.o; });
    return allDay.concat(timed);
  }
  function mpEvent(e, extra) {
    var cls = ['mp', e.type === 'exam' ? 'exam' : '', e.type === 'grades' ? 'grades' : '', e.done ? 'done' : '', extra ? 'extra' : ''].filter(Boolean).join(' ');
    var d = evDetail(e);
    return '<button type="button" class="' + cls + '" style="' + cvar(subj(e.subject)) + '" data-act="ev-open" data-id="' + e.id + '" data-drag="event:' + e.id + '" title="' + esc(evFull(e)) + '">' +
      '<span class="t">' + (e.at ? e.at + ' ' : '') + esc(evShort(e)) + '</span>' + (d ? '<span class="d">' + esc(d) + '</span>' : '') + '</button>';
  }
  function mpTask(x, extra) {
    var occ = x.occ ? ' data-date="' + x.occ + '"' : '';
    return '<button type="button" class="mp task' + (x.done ? ' done' : '') + (isRep(x) ? ' rep' : '') + (extra ? ' extra' : '') + '" style="' + cvar(subj(x.subject)) + '" data-act="task-open" data-id="' + x.id + '"' + occ + ' data-drag="task:' + x.id + '" title="' + esc('Task: ' + x.title + (isRep(x) ? ' · ' + repText(x.rep) : '')) + '"><span class="t">' + (x.at ? x.at + ' ' : '') + esc(x.title) + '</span></button>';
  }
  function mpPlan(p, extra) {
    return '<button type="button" class="mp plan' + (extra ? ' extra' : '') + '" style="' + cvar(subj(p.subject)) + '" data-act="plan-open" data-id="' + p.id + '" data-drag="plan:' + p.id + '" title="' + esc('Study block: ' + planName(p) + ', ' + p.at + '–' + hm(toMin(p.at) + p.dur)) + '"><span class="t">' + p.at + ' ' + esc(planName(p)) + '</span></button>';
  }
  /* ---------- the day: things without a time, then the hourly plan ---------- */
  function dayPanel(d, t) {
    var evs = S.events.filter(function (e) { return covers(e, d) && visible(e); }).sort(evOrder);
    var tasks = tasksOn(d).sort(taskSort);
    var allEv = evs.filter(function (e) { return !(e.at && e.start === d); });
    var allT = tasks.filter(function (x) { return !x.at; });
    var blocks = blocksFor(d), n = diff(t, d);
    var sub = rel(n) + ' · ' + (holidayOn(d) ? 'no school' : blocks.length ? blocks.length + ' class' + (blocks.length > 1 ? 'es' : '') + ', ' + blocks[0].start + '–' + blocks[blocks.length - 1].end : 'no classes');
    return '<aside class="daypanel" aria-labelledby="dp-h">' +
        '<h2 id="dp-h">' + esc(fLong(d)) + '</h2><p class="dp-sub">' + esc(sub) + '</p>' +
        '<div class="dp-allday" data-date="' + d + '">' +
          (allEv.length ? '<ul class="dp-list">' + allEv.map(function (e) { return '<li data-drag="event:' + e.id + '">' + upRow(e, t, { noDate: true }) + (e.note ? '<p class="dp-note">' + esc(e.note) + '</p>' : '') + '</li>'; }).join('') + '</ul>'
            : '<p class="empty dp-h">No deadlines or exams.</p>') +
          (allT.length ? '<h3 class="eyebrow dp-h">Tasks due</h3><ul class="tasklist">' + allT.map(function (x) { return taskRow(x, t, { drag: true }); }).join('') + '</ul>' : '') +
        '</div>' +
        '<div class="tl-tools">' +
          '<button type="button" class="btn small tl-study" data-act="plan-new" data-date="' + d + '" data-drag="new:study">' + icon('timer') + 'Study Block</button>' +
          '<button type="button" class="btn small" data-act="task-new" data-date="' + d + '">' + icon('plus') + 'Task</button>' +
          '<button type="button" class="btn small" data-act="ev-new" data-date="' + d + '">' + icon('plus') + 'Event</button>' +
        '</div>' +
        '<div class="tl-scroll" id="tl-scroll" data-date="' + d + '">' + timeline(d, t) + '</div>' +
        '<p class="tl-hint">Tap a free time to plan it. Drag anything to move it, or drag its bottom edge to make it longer.</p>' +
      '</aside>';
  }

  /* the hourly plan: classes faded behind, then timed tasks, timed events and study blocks */
  var PXM = 0.8;   /* px per minute: 48 px an hour */
  function hm(min) { min = Math.max(0, Math.min(1439, Math.round(min))); return pad(Math.floor(min / 60)) + ':' + pad(min % 60); }
  function planById(id) { for (var i = 0; i < S.plans.length; i++) if (S.plans[i].id === id) return S.plans[i]; return null; }
  function planName(p) { var s = subj(p.subject); return p.title || (s ? 'Study ' + s.short : 'Study'); }
  /* official school dates keep their day: only your own events move */
  function evLocked(e) { return !isFree() && !/^ev-/.test(e.id); }
  function dayItems(d) {
    var out = [];
    tasksOn(d).forEach(function (x) { if (x.at) out.push({ k: 'task', id: x.id, occ: x.occ || '', start: toMin(x.at), dur: x.est || 30, title: x.title, s: subj(x.subject), done: x.done, what: isRep(x) ? 'Repeating task' : 'Task' }); });
    S.events.forEach(function (e) { if (e.start === d && e.at && visible(e)) out.push({ k: 'event', id: e.id, start: toMin(e.at), dur: e.dur || 60, title: evFull(e), s: subj(e.subject), done: e.done, what: e.type === 'exam' ? 'Exam' : e.type === 'deadline' ? 'Deadline' : 'Event' }); });
    S.plans.forEach(function (p) { if (p.date === d) out.push({ k: 'plan', id: p.id, start: toMin(p.at), dur: p.dur, title: planName(p), s: subj(p.subject), done: false, what: 'Study block' }); });
    return out.sort(function (a, b) { return a.start - b.start || b.dur - a.dur; });
  }
  function tlStart(items) {
    var first = items.length ? items[0].start : 1440;
    return Math.min(360, Math.floor(first / 60) * 60);
  }
  function timeline(d, t) {
    var items = dayItems(d), t0 = tlStart(items), h = '';
    function top(m) { return Math.round((m - t0) * PXM); }
    for (var m = t0; m < 1440; m += 60) h += '<div class="tl-hr" style="top:' + top(m) + 'px" aria-hidden="true"><span>' + hm(m) + '</span></div>';
    blocksFor(d).forEach(function (b) {
      var a = toMin(b.start), z = toMin(b.end);
      if (z <= t0) return;
      h += '<div class="tl-class" style="top:' + top(Math.max(a, t0)) + 'px;height:' + Math.max(10, Math.round((z - Math.max(a, t0)) * PXM) - 2) + 'px;' + cvar(b.s) + '" aria-hidden="true"><span>' + esc(b.s.short) + '</span></div>';
    });
    /* side by side when they overlap */
    var cl = [], end = -1;
    items.forEach(function (it) {
      if (it.start >= end) cl.push([]);
      var g = cl[cl.length - 1], col = 0;
      while (g.some(function (o) { return o.col === col && o.start + o.dur > it.start; })) col++;
      it.col = col; g.push(it);
      end = Math.max(end, it.start + it.dur);
    });
    cl.forEach(function (g) { var n = Math.max.apply(null, g.map(function (o) { return o.col; })) + 1; g.forEach(function (o) { o.cols = n; }); });
    var nowMin = d === t ? now().getHours() * 60 + now().getMinutes() : -1;
    items.forEach(function (it) {
      var y = top(Math.max(it.start, t0)), ht = Math.max(22, Math.round(it.dur * PXM) - 2);
      var w = 100 / it.cols, live = it.start <= nowMin && nowMin < it.start + it.dur;
      var go = it.k === 'plan' && d === t && nowMin < it.start + it.dur && !S.timer;
      h += '<div class="tl-item k-' + it.k + (it.done ? ' done' : '') + (ht < 36 ? ' short' : '') + (live ? ' live' : '') + '" style="top:' + y + 'px;height:' + ht + 'px;left:' + (it.col * w).toFixed(2) + '%;width:' + w.toFixed(2) + '%;' + cvar(it.s) + '" data-drag="' + it.k + ':' + it.id + '"' + (it.occ ? ' data-date="' + it.occ + '"' : '') + ' data-start="' + it.start + '" data-dur="' + it.dur + '">' +
        '<button type="button" class="tl-main" data-act="tl-open" data-kind="' + it.k + '" data-id="' + it.id + '"' + (it.occ ? ' data-date="' + it.occ + '"' : '') + ' aria-label=""' + esc(it.what + ': ' + it.title + ', ' + hm(it.start) + ' to ' + hm(it.start + it.dur)) + '">' +
          '<b>' + (it.k === 'plan' ? icon('timer') : it.occ ? icon('repeat') : '') + esc(it.title) + '</b><span class="tl-t">' + hm(it.start) + '–' + hm(it.start + it.dur) + '</span></button>' +
        (go ? '<button type="button" class="tl-go" data-act="plan-start" data-id="' + it.id + '">Start</button>' : '') +
        '<span class="tl-grip" aria-hidden="true"></span>' +
      '</div>';
    });
    if (nowMin >= t0) h += '<div class="tl-now" id="tl-now" style="top:' + top(nowMin) + 'px" aria-hidden="true"></div>';
    return '<div class="tl" data-act="tl-add" data-date="' + d + '" data-t0="' + t0 + '" style="height:' + top(1440) + 'px">' + h + '</div>';
  }
  /* keep the plan's scroll place across renders; a new day scrolls to its first plan, now, or 08:00 */
  var TLS = { date: null, top: 0 };
  function tlKeep() { var sc = $('#tl-scroll'); if (sc) { TLS.date = sc.dataset.date; TLS.top = sc.scrollTop; } }
  function tlMounted() {
    var sc = $('#tl-scroll'), tl = sc && $('.tl', sc);
    if (!sc || !tl) return;
    if (TLS.date === sc.dataset.date) { sc.scrollTop = TLS.top; return; }
    var t0 = Number(tl.dataset.t0), d = sc.dataset.date, items = dayItems(d), aim = 480;
    if (d === today()) aim = now().getHours() * 60 + now().getMinutes() - 60;
    else if (items.length) aim = items[0].start - 30;
    sc.scrollTop = Math.max(0, Math.round((aim - t0) * PXM));
    TLS.date = d; TLS.top = sc.scrollTop;
  }
  function tlNow() {
    var el = $('#tl-now'), tl = $('.tl');
    if (!el || !tl) return;
    el.style.top = Math.round((now().getHours() * 60 + now().getMinutes() - Number(tl.dataset.t0)) * PXM) + 'px';
  }

  /* add something at a time: a study block or a task */
  var LENGTHS = [[15, '15 min'], [30, '30 min'], [45, '45 min'], [60, '1 hour'], [90, '1 h 30'], [120, '2 hours'], [150, '2 h 30'], [180, '3 hours'], [240, '4 hours'], [300, '5 hours'], [360, '6 hours']];
  function lengthOptions(v) {
    var l = LENGTHS.slice();
    if (!l.some(function (o) { return o[0] === v; })) l.push([v, dur(v)]);
    return optionList(l.sort(function (a, b) { return a[0] - b[0]; }), v);
  }
  function freeTime(d) {
    if (d === today()) { var m = now().getHours() * 60 + now().getMinutes(); return hm(Math.min(1425, Math.ceil(m / 15) * 15)); }
    return '16:00';
  }
  function openPlan(id, preset) {
    preset = preset || {};
    var p = id ? planById(id) : null;
    if (id && !p) return;
    var kind = p ? 'plan' : preset.kind === 'task' ? 'task' : 'plan';
    var v = p || { date: DATE.test(preset.date) ? preset.date : UI.calSel || today(), at: TIME.test(preset.at) ? preset.at : null, dur: cleanDur(preset.dur, 60), subject: preset.subject || (subj(UI.focusSubject) ? UI.focusSubject : ''), title: preset.title || '' };
    if (!v.at) v.at = freeTime(v.date);
    var seg = p ? '' : '<div class="seg plan-seg" role="group" aria-label="What to add">' +
      '<button type="button" data-act="plan-kind" data-kind="plan" aria-pressed="' + (kind === 'plan') + '">Study Block</button>' +
      '<button type="button" data-act="plan-kind" data-kind="task" aria-pressed="' + (kind === 'task') + '">Task</button></div>';
    var when = grp(rPill('Day', 'date', 'date', 'pl-date', v.date, ' required') +
        rPill('Starts', 'time', 'at', 'pl-at', v.at, ' required') +
        rSelect('Length', 'dur', 'pl-dur', lengthOptions(v.dur)), '', kind === 'plan' ? 'When it starts, Bloc offers to start the focus timer.' : '');
    var body = kind === 'plan'
      ? seg + grp(rSelect('Subject', 'subject', 'pl-subject', subjectOptions(v.subject || '', 'General study')) +
          rField({ label: 'What', name: 'title', id: 'pl-title', value: v.title, max: 80, placeholder: 'What you’ll do (optional)' })) + when
      : seg + grp(rField({ label: 'Task', name: 'title', id: 'pl-title', value: v.title, max: 200, placeholder: 'Task (walk the dog, read chapter 3…)', autofocus: true }) +
          rSelect('Subject', 'subject', 'pl-subject', subjectOptions(v.subject || '', 'None'))) + when + repPicker(preset.rep || [], null, v.date);
    openDialog({
      title: p ? 'Study Block' : 'Plan ' + fDay(v.date),
      body: body,
      submitLabel: p ? 'Save' : 'Add',
      danger: p ? { label: 'Delete Study Block', act: 'plan-delete', id: p.id } : null,
      onSubmit: function (fd) {
        var date = fd.get('date'), at = fd.get('at'), len = cleanDur(fd.get('dur'), 60), sid = subj(fd.get('subject')) ? fd.get('subject') : null;
        if (!DATE.test(date)) { fieldError('#pl-date', 'Pick a day.'); return false; }
        if (!TIME.test(at)) { fieldError('#pl-at', 'Pick a time.'); return false; }
        if (kind === 'task') {
          var title = clip(fd.get('title'), 200);
          if (!title) { fieldError('#pl-title', 'Write what the task is.'); return false; }
          var nt = { id: uid('t'), title: title, subject: sid, due: date, at: at, event: null, est: len, notes: '', done: false, doneAt: null, created: today() }, rd = repFrom(fd);
          if (rd.length) { nt.rep = rd; nt.until = DATE.test(fd.get('until')) && fd.get('until') >= date ? fd.get('until') : null; nt.doneOn = []; nt.skip = []; }
          S.tasks.push(nt);
          save(); render(); toast(rd.length ? repText(rd) + ' at ' + at : 'Task added at ' + at);
          return;
        }
        var data = { date: date, at: at, dur: len, subject: sid, title: clip(fd.get('title'), 80) };
        if (p) Object.assign(p, data); else planAdd(data);
        save(); render();
        toast(p ? 'Study block saved' : 'Study block added: ' + at + '–' + hm(toMin(at) + len));
      }
    });
  }
  /* switching between Study Block and Task keeps what you typed */
  function planKind(kind) {
    var f = $('form', dlg);
    if (!f) return;
    var fd = new FormData(f);
    openPlan(null, { kind: kind, date: fd.get('date'), at: fd.get('at'), dur: fd.get('dur'), subject: fd.get('subject'), title: clip(fd.get('title'), 80), rep: repFrom(fd) });
  }
  /* a study block's timer: what is left of the block, or the stopwatch for blocks over 4 hours */
  function planStart(p) {
    if (!p) return;
    if (S.timer) { toast('A timer is already running'); return; }
    var nm = now().getHours() * 60 + now().getMinutes(), endM = toMin(p.at) + p.dur;
    var left = p.date === today() && nm >= toMin(p.at) ? endM - nm : p.dur;
    if (left < 1) { toast('This study block is over'); return; }
    if (S.pet && petGraveCheck(S.pet, nowMs())) save();
    unlockAudio();
    S.timer = left > 240 ? { subject: p.subject, len: 720, startedAt: nowMs(), pausedAt: null, pausedTotal: 0, up: true }
      : { subject: p.subject, len: Math.max(5, left), startedAt: nowMs(), pausedAt: null, pausedTotal: 0 };
    UI.focusSubject = p.subject;
    saveUI(); save(); render();
    toast(S.timer.up ? 'Stopwatch on for ' + nameOrGeneral(p.subject) : 'Timer on: ' + dur(S.timer.len) + ' of ' + nameOrGeneral(p.subject), null, { label: 'Open', fn: function () { go('today'); } });
  }
  /* when a study block starts, offer its timer once */
  function planWatch() {
    if (MODE !== 'app' || !ME || S.timer) return;
    var t = today(), nm = now().getHours() * 60 + now().getMinutes();
    var p = S.plans.filter(function (x) { var a = toMin(x.at); return x.date === t && a <= nm && nm < a + x.dur && nm - a <= 30; })[0];
    if (!p) return;
    var key = 'myib:nudge:' + ME.id, seen = sjson(key) || {};
    if (seen.d !== t) seen = { d: t, ids: [] };
    if (seen.ids.indexOf(p.id) >= 0) return;
    seen.ids.push(p.id);
    sset(key, JSON.stringify(seen));
    toast('Study block: ' + planName(p) + ' until ' + hm(toMin(p.at) + p.dur), null, { label: 'Start Timer', fn: function () { planStart(planById(p.id)); } }, 15000);
  }

  /* ---------- drag and drop: tasks, events and study blocks between days and times ---------- */
  var DRAG = null, eatClick = false;
  function dragLabel(kind, id) {
    var x = kind === 'task' ? taskById(id) : kind === 'event' ? evById(id) : kind === 'plan' ? planById(id) : null;
    if (kind === 'new') return 'Study block';
    return !x ? '' : kind === 'task' ? x.title : kind === 'event' ? evFull(x) : planName(x);
  }
  /* the edits behind dragging, the checkbox, the timer buttons and the plan sheet; the assistant's Approve uses the same ones */
  function planMoveTo(p, date, at) { p.date = date; if (at) p.at = at; }
  function taskMoveTo(x, date, at) { x.due = date; if (at) { x.at = at; if (!x.est) x.est = 30; } }
  function itemResize(kind, x, len) { if (kind === 'task') x.est = len; else x.dur = len; }
  function taskSetDone(x, od, on) {
    if (isRep(x)) {
      if (!DATE.test(od)) od = nextOcc(x, today(), !on) || today();
      var i = x.doneOn.indexOf(od);
      if (on && i < 0) { x.doneOn.push(od); x.doneOn.sort(); }
      if (!on && i >= 0) x.doneOn.splice(i, 1);
      if (x.doneOn.length > 500) x.doneOn = x.doneOn.slice(-500);
    } else {
      x.done = on;
      x.doneAt = on ? today() : null;
    }
    return od;
  }
  function timerStart(len, up, sid) {
    if (S.pet && petGraveCheck(S.pet, nowMs())) save();
    unlockAudio();
    S.timer = { subject: subj(sid) ? sid : null, len: up ? 720 : len, startedAt: nowMs(), pausedAt: null, pausedTotal: 0 };
    if (up) S.timer.up = true;
  }
  function planAdd(data) { var p = Object.assign({ id: uid('pl') }, data); S.plans.push(p); return p; }
  function dragItem(kind, id) { return kind === 'task' ? taskById(id) : kind === 'event' ? evById(id) : kind === 'plan' ? planById(id) : null; }
  function dragDur(kind, id) {
    var x = dragItem(kind, id);
    return kind === 'new' ? 60 : !x ? 60 : kind === 'task' ? x.est || 30 : x.dur || 60;
  }
  function inRect(r, x, y) { return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; }
  function dropAt(x, y) {
    var sc = $('#tl-scroll'), tl = sc && $('.tl', sc);
    if (tl && inRect(sc.getBoundingClientRect(), x, y)) {
      var r = tl.getBoundingClientRect(), k = zoomOf(tl) || 1;
      var m = Number(tl.dataset.t0) + (y - r.top) / k / PXM - DRAG.grab;
      m = Math.max(0, Math.min(1440 - 15, Math.round(m / 15) * 15));
      return { type: 'time', date: tl.dataset.date, min: m };
    }
    var ad = $('.dp-allday');
    if (ad && inRect(ad.getBoundingClientRect(), x, y)) return { type: 'allday', date: ad.dataset.date };
    var wks = $$('.month .wk');
    for (var i = 0; i < wks.length; i++) {
      var w = wks[i].getBoundingClientRect();
      if (inRect(w, x, y)) return { type: 'day', date: addDays(wks[i].dataset.ws, Math.max(0, Math.min(6, Math.floor((x - w.left) / (w.width / 7))))) };
    }
    return null;
  }
  function dragShow(tg) {
    $$('.mday.drop').forEach(function (b) { b.classList.remove('drop'); });
    var ad = $('.dp-allday'); if (ad) ad.classList.toggle('drop', !!tg && tg.type === 'allday');
    var tl = $('.tl'), box = tl && $('.tl-drop', tl);
    if (tg && tg.type === 'day') { var b = $('.mday[data-date="' + tg.date + '"]'); if (b) b.classList.add('drop'); }
    if (tg && tg.type === 'time' && tl) {
      if (!box) { box = document.createElement('div'); box.className = 'tl-drop'; tl.appendChild(box); }
      var len = DRAG.dur;
      box.style.top = Math.round((tg.min - Number(tl.dataset.t0)) * PXM) + 'px';
      box.style.height = Math.max(22, Math.round(len * PXM) - 2) + 'px';
      box.textContent = hm(tg.min) + '–' + hm(tg.min + len);
    } else if (box) box.remove();
  }
  function dragBegin() {
    var D = DRAG;
    D.on = true;
    clearTimeout(D.timer);
    document.body.classList.add('dragging');
    if (D.src.isConnected) D.src.classList.add('is-dragging');
    if (!D.grip) {
      var g = D.ghost = document.createElement('div');
      g.className = 'drag-ghost';
      g.textContent = dragLabel(D.kind, D.id);
      document.body.appendChild(g);
    }
    if (D.touch) { try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) { /* ignore */ } }
    /* hold near the top or bottom edge of the hours to scroll them */
    D.scroll = setInterval(function () {
      var sc = $('#tl-scroll');
      if (!sc || !DRAG) return;
      var r = sc.getBoundingClientRect(), dir = 0;
      if (DRAG.x >= r.left && DRAG.x <= r.right && DRAG.y >= r.top && DRAG.y <= r.bottom) dir = DRAG.y < r.top + 30 ? -1 : DRAG.y > r.bottom - 30 ? 1 : 0;
      if (!dir) { DRAG.edge = 0; return; }
      if (!DRAG.edge) { DRAG.edge = Date.now(); return; }
      if (Date.now() - DRAG.edge < 250) return;
      sc.scrollTop += dir * 10;
      if (!DRAG.grip && DRAG.ghost) { DRAG.target = dropAt(DRAG.x, DRAG.y); dragShow(DRAG.target); }
    }, 30);
  }
  function dragMove() {
    var D = DRAG;
    if (D.grip) {
      var it = D.src, tl = $('.tl'), k = zoomOf(tl) || 1;
      if (!it.isConnected || !tl) return;
      var r = tl.getBoundingClientRect(), endM = Number(tl.dataset.t0) + (D.y - r.top) / k / PXM;
      var len = Math.max(15, Math.min(720, Math.round((endM - D.start) / 15) * 15));
      D.len = len;
      it.style.height = Math.max(22, Math.round(len * PXM) - 2) + 'px';
      var lab = $('.tl-t', it); if (lab) lab.textContent = hm(D.start) + '–' + hm(D.start + len);
      return;
    }
    var z = zoomOf($('#view')) || 1;
    D.ghost.style.left = (D.x / z) + 'px';
    D.ghost.style.top = (D.y / z) + 'px';
    D.target = dropAt(D.x, D.y);
    dragShow(D.target);
  }
  function dragEnd() {
    var D = DRAG;
    DRAG = null;
    if (!D) return;
    clearTimeout(D.timer); clearInterval(D.scroll);
    if (!D.on) return;
    document.body.classList.remove('dragging');
    if (D.ghost) D.ghost.remove();
    if (D.src.isConnected) D.src.classList.remove('is-dragging');
    dragShow(null);
    eatClick = true;
    setTimeout(function () { eatClick = false; }, 0);
    return D;
  }
  function dragDrop(D) {
    var x = dragItem(D.kind, D.id), tg = D.target, snap = snapshot();
    if (D.grip) {
      if (!x || !D.len || D.len === D.dur) return;
      itemResize(D.kind, x, D.len);
      save(); render(); toast(hm(D.start) + '–' + hm(D.start + D.len), snap);
      return;
    }
    if (!tg) return;
    if (D.kind === 'new') {
      if (tg.type === 'time') openPlan(null, { date: tg.date, at: hm(tg.min) });
      else openPlan(null, { date: tg.date });
      return;
    }
    if (!x) return;
    var date = tg.date, at = tg.type === 'time' ? hm(tg.min) : null, was = D.kind === 'task' ? x.due : D.kind === 'event' ? x.start : x.date;
    if (D.kind === 'event') {
      if (date !== x.start && evLocked(x)) { toast('School dates stay on their day. Open it to change the date.'); render(); return; }
      if (tg.type === 'allday' && !x.at) return;
      if (tg.type === 'day' && date === x.start) return;
      if (date !== x.start) { var n = diff(x.start, date); if (x.end) x.end = addDays(x.end, n); x.start = date; }
      if (tg.type === 'time') { x.at = at; x.dur = x.dur || 60; } else if (tg.type === 'allday') { x.at = null; x.dur = null; }
    } else if (D.kind === 'task' && isRep(x)) {
      var from = D.src.dataset.date || '';
      if (tg.type === 'day' || date !== from) { toast('A repeating task stays on its days. Open it to change them.'); render(); return; }
      if (tg.type === 'time') { x.at = at; if (!x.est) x.est = 30; } else x.at = null;
      save(); render();
      toast(repText(x.rep) + (at ? ' · now at ' + at : ' · no set time'), snap);
      return;
    } else if (D.kind === 'task') {
      if (tg.type === 'day' && date === x.due) return;
      taskMoveTo(x, date, tg.type === 'time' ? at : null);
      if (tg.type === 'allday') x.at = null;
    } else {
      if (tg.type === 'allday') { toast('Study blocks need a time. Drag it onto the hours.'); return; }
      if (tg.type === 'day' && date === x.date) return;
      planMoveTo(x, date, tg.type === 'time' ? at : null);
    }
    save(); render();
    toast((date !== was ? 'Moved to ' + fDay(date) : 'Moved') + (at ? ' · ' + at : tg.type === 'allday' ? ' · no set time' : ''), snap);
  }
  document.addEventListener('pointerdown', function (e) {
    if (MODE !== 'app' || UI.tab !== 'calendar' || e.button > 0 || DRAG || dlg.open) return;
    var src = e.target.closest && e.target.closest('[data-drag]');
    if (!src || e.target.closest('.tl-go, .check, input, select, textarea')) return;
    var sp = src.dataset.drag.split(':'), grip = !!e.target.closest('.tl-grip');
    var D = DRAG = { src: src, kind: sp[0], id: sp[1], x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, touch: e.pointerType === 'touch', on: false, grip: grip, grab: 0, target: null };
    D.dur = dragDur(D.kind, D.id);
    if (src.classList.contains('tl-item')) {
      D.start = Number(src.dataset.start);
      D.grab = Math.max(0, (e.clientY - src.getBoundingClientRect().top) / (zoomOf(src) || 1) / PXM);
    }
    if (grip) { dragBegin(); e.preventDefault(); return; }
    if (D.touch) D.timer = setTimeout(function () { if (DRAG === D && !D.on) { dragBegin(); dragMove(); } }, 380);
  }, true);
  document.addEventListener('pointermove', function (e) {
    var D = DRAG;
    if (!D) return;
    D.x = e.clientX; D.y = e.clientY;
    var far = Math.hypot(D.x - D.x0, D.y - D.y0);
    if (!D.on) {
      if (D.touch) { if (far > 10) { clearTimeout(D.timer); DRAG = null; } return; }
      if (far < 6) return;
      dragBegin();
    }
    e.preventDefault();
    dragMove();
  }, true);
  document.addEventListener('pointerup', function () { var D = dragEnd(); if (D) dragDrop(D); }, true);
  document.addEventListener('pointercancel', function () { if (DRAG && DRAG.on) { dragEnd(); render(); } else dragEnd(); }, true);
  /* once a touch drag starts, the page stops scrolling under your finger. The listener sits on the
     draggable items only (dragTouchBind, after each calendar render): one on the whole document made
     every scroll anywhere in the app wait for JavaScript, which is what made scrolling feel stuck. */
  function dragTouchMove(e) { if (DRAG && DRAG.on) e.preventDefault(); }
  function dragTouchBind(root) {
    $$('[data-drag]', root).forEach(function (el) { el.addEventListener('touchmove', dragTouchMove, { passive: false }); });
  }
  document.addEventListener('click', function (e) { if (eatClick) { eatClick = false; e.preventDefault(); e.stopPropagation(); } }, true);
  document.addEventListener('contextmenu', function (e) { if (DRAG) e.preventDefault(); }, true);
  function agendaHTML(t) {
    var evs = S.events.filter(visible).filter(function (e) { return UI.showPast || evEnd(e) >= t; }).sort(byStart);
    var tools = '<div class="ag-tools"><label class="switch"><input type="checkbox" id="cal-past" data-change="cal-past"' + (UI.showPast ? ' checked' : '') + '>Show past dates</label></div>';
    if (!evs.length) return '<div class="agenda">' + tools + '<p class="empty">No dates to show.</p></div>';
    var groups = [], idx = {};
    evs.forEach(function (e) {
      var k = e.start.slice(0, 7);
      if (!(k in idx)) { idx[k] = groups.length; groups.push({ k: k, list: [] }); }
      groups[idx[k]].list.push(e);
    });
    return '<div class="agenda">' + tools + groups.map(function (g) {
      var p = g.k.split('-').map(Number);
      return '<section class="ag-month"><h2 class="eyebrow">' + MONTH_LONG[p[1] - 1] + ' ' + p[0] + '</h2><ul class="ag-list">' +
        g.list.map(function (e) { return '<li>' + upRow(e, t, { past: evEnd(e) < t }) + '</li>'; }).join('') + '</ul></section>';
    }).join('') + '</div>';
  }

  /* ---------- Tasks ---------- */
  VIEWS.tasks = function () {
    var t = today(), f = UI.taskFilter;
    if (f !== 'all' && f !== '_none' && !subj(f)) f = UI.taskFilter = 'all';
    function shown(x) { return f === 'all' || x.subject === f || (f === '_none' && !x.subject); }
    var all = S.tasks.filter(shown);
    var open = openTasks(t).filter(shown);
    var t1 = addDays(t, 1);
    var groups = [
      ['over', 'Overdue', function (x) { return x.due && x.due < t; }],
      ['today', 'Today', function (x) { return x.due === t; }],
      ['tomorrow', 'Tomorrow', function (x) { return x.due === t1; }],
      ['week', 'Next 7 days', function (x) { return x.due && x.due > t1 && diff(t, x.due) <= 7; }],
      ['later', 'Later', function (x) { return x.due && diff(t, x.due) > 7; }],
      ['nodate', 'No date', function (x) { return !x.due; }]
    ];
    var body = '';
    groups.forEach(function (g) {
      var list = open.filter(g[2]).sort(taskSort);
      if (list.length) body += '<section class="tgroup ' + g[0] + '"><h2 class="eyebrow">' + g[1] + '<span class="n">' + list.length + '</span></h2><ul class="tasklist glass">' + list.map(function (x) { return taskRow(x, t); }).join('') + '</ul></section>';
    });
    var done = all.filter(function (x) { return x.done && !isRep(x); }).sort(function (a, b) { return (b.doneAt || '') < (a.doneAt || '') ? -1 : (b.doneAt || '') > (a.doneAt || '') ? 1 : 0; });
    if (UI.showDone && done.length) body += '<section class="tgroup"><h2 class="eyebrow">Completed<span class="n">' + done.length + '</span></h2><ul class="tasklist glass">' + done.slice(0, 150).map(function (x) { return taskRow(x, t); }).join('') + '</ul></section>';
    if (!open.length) body = emptyTasks(t) + body;
    var dueWeek = open.filter(function (x) { return x.due && diff(t, x.due) <= 7; }).length;
    var pre = f !== 'all' && f !== '_none' ? f : '';
    return '<div class="page-head"><div><h1 class="display">Tasks</h1><p class="sub">' + open.length + ' open' + (dueWeek ? ', ' + dueWeek + ' due this week' : '') + '</p></div></div>' +
      '<form class="task-add" data-form="task-add" autocomplete="off">' +
        '<input class="ta-title" type="text" name="title" id="ta-title" maxlength="200" placeholder="New task (#math sets the subject)" aria-label="New task">' +
        '<span class="select-pill"><select name="subject" id="ta-subject" aria-label="Subject">' + subjectOptions(pre, 'No subject') + '</select>' + icon('updown') + '</span>' +
        '<input type="date" name="due" id="ta-due" value="' + t + '" aria-label="Due date">' +
        '<button type="submit" class="btn primary">' + icon('plus') + 'Add</button>' +
      '</form>' +
      '<div class="tfilters">' + taskFilterChips() + '<label class="switch"><input type="checkbox" id="tasks-done" data-change="tasks-done"' + (UI.showDone ? ' checked' : '') + '>Show completed</label></div>' +
      '<div class="tgroups">' + body + '</div>';
  };
  function taskFilterChips() {
    var used = new Set(S.tasks.map(function (x) { return x.subject || '_none'; }));
    var items = [{ id: 'all', name: 'All', s: null }].concat(S.subjects.filter(function (s) { return used.has(s.id); }).map(function (s) { return { id: s.id, name: s.short, s: s }; }));
    if (used.has('_none')) items.push({ id: '_none', name: 'No subject', s: null });
    return '<div class="filters flat" role="group" aria-label="Filter tasks by subject">' + items.map(function (i) {
      return '<button type="button" class="chip radio" data-act="task-filter" data-id="' + i.id + '" aria-pressed="' + (UI.taskFilter === i.id) + '">' + (i.s ? '<i class="sw" style="' + cvar(i.s) + '"></i>' : '') + esc(i.name) + '</button>';
    }).join('') + '</div>';
  }
  function emptyTasks(t) {
    var next = S.events.filter(function (e) { return !e.done && (e.type === 'deadline' || e.type === 'exam') && e.start >= t; }).sort(byStart).slice(0, 3);
    return '<div class="card"><p class="empty"><b>No open tasks.</b>' + (next.length ? ' Break your next deadlines into steps:' : '') + '</p>' +
      (next.length ? '<div class="suggest">' + next.map(function (e) {
        return '<button type="button" class="btn" data-act="task-new" data-event="' + e.id + '">' + icon('plus') + '<span>' + esc(evFull(e)) + ' <span class="detail">· ' + esc(fDay(e.start)) + '</span></span></button>';
      }).join('') + '</div>' : '') + '</div>';
  }

  /* ---------- Subjects ---------- */
  VIEWS.subjects = function () {
    var t = today(), counts = slotCounts(), mon = addDays(t, -dow(t)), sun = addDays(mon, 6), studied = {};
    S.sessions.forEach(function (x) { if (x.subject && x.date >= mon && x.date <= sun) studied[x.subject] = (studied[x.subject] || 0) + x.minutes; });
    function card(s) {
      var evs = S.events.filter(function (e) { return e.subject === s.id; }).sort(byStart);
      var next = evs.filter(function (e) { return !e.done && e.type !== 'exam' && evEnd(e) >= t; })[0];
      var exams = evs.filter(function (e) { return e.type === 'exam'; });
      var open = S.tasks.filter(function (x) { return x.subject === s.id && !x.done; }).length;
      var doneN = S.tasks.filter(function (x) { return x.subject === s.id && x.done; }).length;
      var n = counts[s.id] || 0;
      var slotsTxt = n ? (s.group === 'other' ? n + '× a week' : n + ' class' + (n > 1 ? 'es' : '') + ' a week') : '';
      var line = [s.teacher, slotsTxt].filter(Boolean).join(', ');
      var rows = [];
      if (next) {
        var what = [next.title, evDetail(next)].filter(Boolean).join(', ') || evTitle(next);
        rows.push('<span class="kv"><span class="k">Next</span><span>' + esc(what) + ', ' + esc(fDay(next.start)) + ' <em>' + esc(rel(diff(t, next.start)).toLowerCase()) + '</em></span></span>');
      }
      if (exams.length) rows.push('<span class="kv"><span class="k">Exams</span><span>' + exams.map(function (e) { return esc(shortPaper(e.detail) + ' ' + fDay(e.start)); }).join('<br>') + '</span></span>');
      if (open || doneN) rows.push('<span class="kv"><span class="k">Tasks</span><span>' + open + ' open' + (doneN ? ', ' + doneN + ' done' : '') + '</span></span>');
      if (s.goal) {
        var m = studied[s.id] || 0;
        rows.push('<span class="kv"><span class="k">Study</span><span>' + esc(dur(m)) + ' of ' + esc(dur(s.goal)) + ' this week<span class="meter" aria-hidden="true"><i style="width:' + Math.min(100, m / s.goal * 100).toFixed(0) + '%"></i></span></span></span>');
      }
      var pp = plusOn() ? S.papers.filter(function (x) { return x.subject === s.id; }) : [];
      if (pp.length) rows.push('<span class="kv"><span class="k">Papers</span><span>' + pp.length + ' done · ' + paperAvg(pp) + '% average</span></span>');
      return '<button type="button" class="scard" style="' + cvar(s) + '" data-act="subj-open" data-id="' + s.id + '">' +
          '<span class="sc-top"><span class="sc-icon" aria-hidden="true" style="color:' + iconInk(s.color) + '">' + esc(badge(s)) + '</span><span class="sc-name">' + esc(s.name) + '</span>' + (s.level ? '<span class="lvl">' + s.level + '</span>' : '') + '</span>' +
          (line ? '<span class="sc-line">' + esc(line) + '</span>' : '') + rows.join('') +
          (s.notes ? '<span class="sc-notes">' + esc(s.notes) + '</span>' : '') +
        '</button>';
    }
    function group(g, label) {
      var list = S.subjects.filter(function (s) { return s.group === g; });
      return list.length ? '<section class="sgroup"><h2 class="eyebrow">' + label + '</h2><div class="sgrid">' + list.map(card).join('') + '</div></section>' : '';
    }
    var L = LV(), many = L.group.toLowerCase();
    var tip = hasIBSubjects() ? '' : '<div class="card tip" role="note"><p><b>No ' + esc(many) + ' yet.</b> Pick yours from the list, then tap each one to set its ' + (L.sl ? 'level and ' : '') + 'teacher.</p>' +
      '<button type="button" class="btn primary" data-act="guide-subjects">' + icon('plus') + 'Pick ' + esc(L.group.replace(/^IB /, '')) + '</button></div>';
    return '<div class="page-head"><div><h1 class="display">' + (level() === 'uni' ? 'Courses' : 'Subjects') + '</h1><p class="sub">' + (L.sl ? 'Teachers, levels, dates and weekly study goals.' : 'Teachers, dates and weekly study goals.') + '</p></div>' +
        '<div class="actions">' + (isIB() ? '<button type="button" class="btn" data-act="papers">' + icon('paper') + 'Past papers' + (papersNew() ? '<span class="tag-new">New</span>' : '') + '</button>' : '') +
        '<button type="button" class="btn" data-act="subj-new">' + icon('plus') + 'Add ' + esc(L.one.replace(/^IB /, '').toLowerCase()) + '</button></div></div>' +
      tip + group('ib', L.group) + group('core', 'Core') + group('other', 'Other');
  };

  /* =========================================================
     Sheets
     ========================================================= */
  var settingsTouched = false;

  function openEvent(id, preset) {
    preset = preset || {};
    var e = id ? evById(id) : null;
    if (id && !e) return;
    var v = e || { type: 'deadline', subject: preset.subject || '', title: '', detail: '', start: preset.date || UI.calSel || today(), end: null, at: null, dur: null, note: '', done: false };
    var t = today();
    var typeOpts = optionList([['deadline', 'Deadline'], ['exam', 'Exam'], ['mock', 'Mock exams'], ['holiday', 'Holiday'], ['grades', 'Grades'], ['other', 'Other']], v.type);
    var linked = e ? S.tasks.filter(function (x) { return x.event === e.id; }).sort(taskSort) : [];
    var body =
      grp(rField({ label: 'Title', name: 'title', id: 'ev-title', value: v.title, max: 80, placeholder: 'Title (IA, Essay, Exam…)', autofocus: !e }) +
          rField({ label: 'Detail', name: 'detail', id: 'ev-detail', value: v.detail, max: 80, placeholder: 'Detail (Last draft, Paper 2…)' })) +
      grp(rSelect('Subject', 'subject', 'ev-subject', subjectOptions(v.subject || '', 'None (school date)')) +
          rSelect('Type', 'type', 'ev-type', typeOpts, ' data-change="ev-type"'), '', 'A holiday with no subject cancels your classes on its days.') +
      grp(rPill('Date', 'date', 'start', 'ev-start', v.start, ' required') +
          rPill('Last day', 'date', 'end', 'ev-end', v.end || ''), '', 'Add a last day for dates that run over several days, like mock exams or holidays.') +
      grp(rPill('Time', 'time', 'at', 'ev-at', v.at || '') +
          rSelect('Length', 'dur', 'ev-dur', lengthOptions(v.dur || 60)), '', 'Optional. A time puts it on the day’s hourly plan.') +
      evRemGroup(v) +
      grp(rField({ area: true, label: 'Notes', name: 'note', id: 'ev-note', value: v.note, max: 2000, placeholder: 'Notes' })) +
      grp(rSwitch('Done / handed in', 'done', 'ev-done', v.done)) +
      (!e ? grp(rNav('download', 'Import from Calendar', 'import-open'), '', 'Bring in every date from Apple Calendar, Google Calendar or your school’s calendar at once.') : '') +
      (e && e.type !== 'holiday' ? grp(
        (linked.length ? '<ul class="tasklist">' + linked.map(function (x) { return taskRow(x, t); }).join('') + '</ul>' : '') +
        rButton(icon('plus') + 'Add a task for this', 'task-new', ' data-event="' + e.id + '"'),
        'Tasks for this', linked.length ? '' : 'Break it into steps you can tick off.') : '');
    openDialog({
      title: e ? 'Edit Event' : 'New Event',
      body: body,
      submitLabel: e ? 'Save' : 'Add',
      danger: e ? { label: 'Delete Event', act: 'ev-delete', id: e.id } : null,
      onSubmit: function (fd) {
        var start = fd.get('start');
        if (!DATE.test(start)) { fieldError('#ev-start', 'Pick a date.'); return false; }
        var end = fd.get('end');
        if (end && DATE.test(end) && end < start) { fieldError('#ev-end', 'The last day can’t come before the first.'); return false; }
        var data = {
          type: TYPES.indexOf(fd.get('type')) >= 0 ? fd.get('type') : 'other',
          subject: subj(fd.get('subject')) ? fd.get('subject') : null,
          title: clip(fd.get('title'), 80), detail: clip(fd.get('detail'), 80),
          start: start, end: DATE.test(end) && end > start ? end : null,
          at: TIME.test(fd.get('at')) ? fd.get('at') : null, dur: TIME.test(fd.get('at')) ? cleanDur(fd.get('dur'), 60) : null,
          note: clip(fd.get('note'), 2000, true), done: fd.get('done') === 'on'
        };
        if (!data.subject && !data.title && !data.detail) { fieldError('#ev-title', 'Add a title or pick a subject.'); return false; }
        var rm = fd.get('remmode');
        if (rm === 'none') data.rem = [];
        else if (rm === 'custom') data.rem = remOffs(fd.getAll('evrem'));
        var handedIn = data.done && !(e && e.done);
        if (e) { Object.assign(e, data); if (rm !== 'none' && rm !== 'custom') delete e.rem; }
        else S.events.push(Object.assign({ id: uid('ev') }, data));
        save(); render();
        if (handedIn) celebrate(null, data.type === 'deadline' || data.type === 'exam');
        toast(e ? 'Event saved' : 'Event added');
      }
    });
  }

  /* an event's own reminders: the usual ones for its type, a timeline of its own, or none */
  function evRemGroup(v) {
    var own = Array.isArray(v.rem), mode = !own ? 'def' : v.rem.length ? 'custom' : 'none';
    var offs = own && v.rem.length ? v.rem : cleanRem(S.settings.rem).ev[v.type] || [];
    return '<div class="ev-rem">' + grp(
      rSelect('Remind me', 'remmode', 'ev-remmode', optionList([['def', 'As usual'], ['custom', 'Pick days'], ['none', 'Never']], mode), ' data-change="ev-remmode"') +
        '<div class="row rem-row ev-rem-custom"' + (mode === 'custom' ? '' : ' hidden') + '>' + remTrack('evrem', offs) + '</div>',
      '', '<span class="ev-rem-foot">' + esc(evRemFoot(mode, mode === 'def' ? offs : own ? v.rem : [], v.type)) + '</span>') + '</div>';
  }
  var TYPE_MANY = { deadline: 'deadlines', exam: 'exams', mock: 'mocks', holiday: 'holidays', grades: 'grade days', other: 'events' };
  function evRemFoot(mode, offs, type) {
    if (mode === 'none') return 'No reminders for this one.';
    if (mode === 'def') return offs.length ? remSay(offs) + ' Same as your other ' + TYPE_MANY[type] + '.' : 'Your ' + TYPE_MANY[type] + ' get no reminders. Pick days here, or change it in Settings.';
    return offs.length ? remSay(offs) : 'Tap the days you want a reminder.';
  }
  function evRemLabel(w) {
    w = w || $('.ev-rem', dlg);
    if (!w) return;
    var mode = ($('#ev-remmode', dlg) || {}).value || 'def', type = ($('#ev-type', dlg) || {}).value || 'other';
    var picked = remOffs($$('input[name="evrem"]:checked', w).map(function (c) { return c.value; }));
    var offs = mode === 'custom' ? picked : mode === 'none' ? [] : cleanRem(S.settings.rem).ev[type] || [];
    var f = $('.ev-rem-foot', w); if (f) f.textContent = evRemFoot(mode, offs, type);
  }

  /* the weekday chips for a repeating task (0 = Monday) */
  function repPicker(rep, until, start) {
    rep = rep || [];
    var chips = '<div class="rep-days" role="group" aria-label="Repeat on">' + DAYS_LONG.map(function (n, i) {
      return '<label class="rep-day" title="' + n + '"><input type="checkbox" name="rep" value="' + i + '" data-change="rep-day"' + (rep.indexOf(i) >= 0 ? ' checked' : '') + '><span aria-hidden="true">' + n.charAt(0) + '</span><span class="sr">' + n + '</span></label>';
    }).join('') + '</div>';
    var presets = '<span class="rep-presets"><button type="button" class="link" data-act="rep-preset" data-days="0,1,2,3,4,5,6">Every day</button>' +
      '<button type="button" class="link" data-act="rep-preset" data-days="0,1,2,3,4">Weekdays</button>' +
      '<button type="button" class="link" data-act="rep-preset" data-days="">Never</button></span>';
    return grp('<div class="row rep-row"><span class="row-label">Repeat</span><span class="row-meta rep-label" id="rep-label">' + esc(rep.length ? repText(rep) : 'Never') + '</span></div>' +
        '<div class="row rep-chips">' + chips + '</div>' +
        '<div class="row rep-tools">' + presets + '</div>' +
        '<div class="rep-ends"' + (rep.length ? '' : ' hidden') + '>' + rPill('Ends', 'date', 'until', 'tk-until', until || '', start ? ' min="' + start + '"' : '') + '</div>',
      '', 'Pick the days it comes back every week, starting on its date. Tick each day off on its own.');
  }
  /* the sheet's repeat label follows the chips */
  function repLabel() {
    var days = $$('input[name="rep"]:checked', dlg).map(function (c) { return Number(c.value); });
    var l = $('#rep-label', dlg); if (l) l.textContent = days.length ? repText(days) : 'Never';
    var e = $('.rep-ends', dlg); if (e) e.hidden = !days.length;
    var dl = $('#tk-due-label', dlg); if (dl) dl.textContent = days.length ? 'Starts' : 'Due';
  }
  /* confetti from what you tapped (or the middle of the screen), and a tap you can feel on a phone */
  var REDUCED = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function calm() { return !!REDUCED.matches; }
  function celebrate(el, big) {
    toNative({ type: 'haptic', kind: 'success' });
    try { if (navigator.vibrate && coarse.matches) navigator.vibrate(big ? [14, 60, 22] : 12); } catch (e) { /* ignore */ }
    if (el && el.closest) { var row = el.closest('.task, .guide-step'); if (row) { row.classList.remove('pop'); void row.offsetWidth; row.classList.add('pop'); } }
    /* v6: no confetti. The haptic tap says it; the task gets an ink line drawn through it. */
  }
  function repFrom(fd) { return fd.getAll('rep').map(Number).filter(function (d, i, a) { return d >= 0 && d <= 6 && a.indexOf(d) === i; }).sort(); }

  function openTask(id, preset) {
    preset = preset || {};
    var x = id ? taskById(id) : null;
    if (id && !x) return;
    var t = today();
    var pe = preset.event ? evById(preset.event) : null;
    var v = x || {
      title: '', subject: preset.subject || (pe && pe.subject) || '',
      due: preset.date || (pe ? addDays(pe.start, -1) : t), event: pe ? pe.id : '', est: null, notes: '', done: false
    };
    if (!x && pe && v.due < t) v.due = t;
    var occ = x && isRep(x) && DATE.test(preset.occ) ? preset.occ : '';
    var evOpts = S.events.filter(function (e) { return e.type !== 'holiday' && (evEnd(e) >= t || e.id === v.event); }).sort(byStart).map(function (e) {
      return '<option value="' + e.id + '"' + (e.id === v.event ? ' selected' : '') + '>' + esc(fDay(e.start) + ' · ' + evFull(e)) + '</option>';
    }).join('');
    var ests = [['', 'Not set'], [15, '15 min'], [30, '30 min'], [45, '45 min'], [60, '1 hour'], [90, '1 h 30'], [120, '2 hours'], [180, '3 hours'], [240, '4 hours']];
    if (!ests.some(function (o) { return String(o[0]) === String(v.est || ''); })) ests.push([v.est, dur(v.est)]);
    var rep = x && isRep(x) ? x.rep : [];
    var body =
      grp(rField({ label: 'Task', name: 'title', id: 'tk-title', value: v.title, max: 200, placeholder: 'Task', autofocus: !x }) +
          rField({ area: true, label: 'Notes', name: 'notes', id: 'tk-notes', value: v.notes, max: 2000, placeholder: 'Notes' })) +
      grp(rSelect('Subject', 'subject', 'tk-subject', subjectOptions(v.subject || '', 'None')) +
          rSelect('For deadline', 'event', 'tk-event', '<option value="">None</option>' + evOpts)) +
      grp('<label class="row"><span class="row-label" id="tk-due-label">' + (rep.length ? 'Starts' : 'Due') + '</span><input class="row-pill" type="date" name="due" id="tk-due" value="' + esc(v.due || '') + '"></label>' +
          rPill('Time', 'time', 'at', 'tk-at', v.at || preset.at || '') +
          rSelect('Time needed', 'est', 'tk-est', optionList(ests, v.est || '')), '', 'A time puts the task on the day’s hourly plan.') +
      repPicker(rep, x && x.until, v.due) +
      (occ ? grp(rButton(icon('skip') + 'Skip ' + esc(fDay(occ)) + ' Only', 'task-skip', ' data-id="' + x.id + '" data-date="' + occ + '"'), '', 'Takes this one day off the calendar. The other days stay.') : '') +
      (x && !isRep(x) ? grp(rSwitch('Done', 'done', 'tk-done', x.done)) : '');
    openDialog({
      title: x ? (isRep(x) ? 'Repeating Task' : 'Edit Task') : 'New Task',
      body: body,
      submitLabel: x ? 'Save' : 'Add',
      danger: x ? { label: isRep(x) ? 'Delete Every Day' : 'Delete Task', act: 'task-delete', id: x.id } : null,
      onSubmit: function (fd) {
        var title = clip(fd.get('title'), 200);
        if (!title) { fieldError('#tk-title', 'Write what the task is.'); return false; }
        var due = fd.get('due'), est = parseInt(fd.get('est'), 10), at = fd.get('at'), days = repFrom(fd), until = fd.get('until');
        if (days.length && !DATE.test(due)) due = t;
        if (TIME.test(at) && !DATE.test(due)) { fieldError('#tk-due', 'Pick a day for the time.'); return false; }
        if (days.length && DATE.test(until) && until < due) { fieldError('#tk-until', 'The last day can’t come before the first.'); return false; }
        var data = {
          title: title, subject: subj(fd.get('subject')) ? fd.get('subject') : null, due: DATE.test(due) ? due : null, at: DATE.test(due) && TIME.test(at) ? at : null,
          event: evById(fd.get('event')) ? fd.get('event') : null, est: est > 0 ? est : null, notes: clip(fd.get('notes'), 2000, true)
        };
        var target = x || { id: uid('t'), done: false, doneAt: null, created: t };
        var wasRep = isRep(target), was = target.done;
        Object.assign(target, data);
        if (days.length) {
          target.rep = days;
          target.until = DATE.test(until) ? until : null;
          target.doneOn = wasRep ? target.doneOn : [];
          target.skip = wasRep ? target.skip : [];
          target.done = false; target.doneAt = null;
        } else {
          delete target.rep; delete target.until; delete target.doneOn; delete target.skip;
          if (x && !wasRep) {
            target.done = fd.get('done') === 'on';
            if (target.done && !was) target.doneAt = t;
            if (!target.done) target.doneAt = null;
          }
        }
        if (!x) S.tasks.push(target);
        save(); render();
        toast(x ? 'Task saved' : days.length ? 'Repeating task added: ' + repText(days) : 'Task added');
      }
    });
  }

  function openCell(pid, d) {
    var p = periodById(pid);
    if (!p || !(d >= 0 && d <= 6)) return;
    var key = slotKey(pid, d), sl = S.slots[key] || null, cur = sl ? sl.subject : '', s = subj(cur);
    var pick = '<label class="row pick"><input type="radio" name="subject" value=""' + (!s ? ' checked' : '') + '><span class="dot none"></span><span class="row-label">Free</span>' + icon('tick') + '</label>' +
      S.subjects.map(function (x) {
        return '<label class="row pick" style="' + cvar(x) + '"><input type="radio" name="subject" value="' + x.id + '"' + (x.id === cur ? ' checked' : '') + '>' +
          '<span class="dot"></span><span class="row-label">' + esc(x.name) + '</span>' + (x.teacher ? '<span class="row-meta">' + esc(x.teacher) + '</span>' : '') + icon('tick') + '</label>';
      }).join('');
    var body =
      grp(pick, 'Subject') +
      grp(rText('Teacher', 'teacher', 'c-teacher', sl && sl.teacher, s && s.teacher ? s.teacher : 'Subject default', 60) +
          rText('Room', 'room', 'c-room', sl && sl.room, 'Optional', 40) +
          rText('Note', 'note', 'c-note', sl && sl.note, 'Optional', 80), 'Details') +
      grp(rPill('Starts', 'time', 'cstart', 'c-start', sl && sl.start) +
          rPill('Ends', 'time', 'cend', 'c-end', sl && sl.end), 'Own time', 'Leave both empty to use ' + p.start + '–' + p.end + '. An empty teacher uses the subject’s teacher.');
    openDialog({
      title: DAYS_LONG[d] + ' · ' + p.start,
      body: body,
      onSubmit: function (fd) {
        var sid = fd.get('subject');
        if (!sid || !subj(sid)) delete S.slots[key];
        else {
          var c = { subject: sid };
          var teacher = clip(fd.get('teacher'), 60), room = clip(fd.get('room'), 40), note = clip(fd.get('note'), 80);
          if (teacher) c.teacher = teacher;
          if (room) c.room = room;
          if (note) c.note = note;
          var cs = fd.get('cstart'), ce = fd.get('cend');
          if (cs || ce) {
            if (!TIME.test(cs) || !TIME.test(ce)) { fieldError(TIME.test(cs) ? '#c-end' : '#c-start', 'Set both times, or clear both.'); return false; }
            if (toMin(ce) <= toMin(cs)) { fieldError('#c-end', 'The end has to be after the start.'); return false; }
            c.start = cs; c.end = ce;
          }
          S.slots[key] = c;
        }
        save(); render();
        toast('Timetable updated');
      }
    });
  }

  function openPeriod(pid) {
    var p = pid ? periodById(pid) : null;
    if (pid && !p) return;
    var last = S.periods[S.periods.length - 1];
    var v = p || { start: last ? last.end : '16:00', end: last ? minToTime(Math.min(toMin(last.end) + 60, 1439)) : '17:00', kind: 'class', label: '' };
    var used = p ? Object.keys(S.slots).filter(function (k) { return k.indexOf(p.id + '|') === 0; }).length : 0;
    var body =
      grp(rPill('Starts', 'time', 'start', 'p-start', v.start, ' required autofocus') +
          rPill('Ends', 'time', 'end', 'p-end', v.end, ' required')) +
      grp(rText('Label', 'label', 'p-label', v.label, v.kind === 'break' ? 'Break' : 'Optional', 40) +
          rSelect('Row type', 'kind', 'p-kind', optionList([['class', 'Classes'], ['break', 'Break']], v.kind)), '',
          'Rows sort themselves by start time.' + (used ? ' This row has ' + used + ' slot' + (used > 1 ? 's' : '') + '; deleting it removes them.' : ''));
    openDialog({
      title: p ? 'Edit Row' : 'New Row',
      body: body,
      submitLabel: p ? 'Save' : 'Add',
      danger: p ? { label: 'Delete Row', act: 'period-delete', id: p.id } : null,
      onSubmit: function (fd) {
        var start = fd.get('start'), end = fd.get('end');
        if (!TIME.test(start)) { fieldError('#p-start', 'Pick a start time.'); return false; }
        if (!TIME.test(end) || toMin(end) <= toMin(start)) { fieldError('#p-end', 'The end has to be after the start.'); return false; }
        var data = { start: start, end: end, kind: fd.get('kind') === 'break' ? 'break' : 'class', label: clip(fd.get('label'), 40) };
        if (p) Object.assign(p, data); else S.periods.push(Object.assign({ id: uid('p') }, data));
        S.periods.sort(function (a, b) { return toMin(a.start) - toMin(b.start); });
        save(); render();
        toast(p ? 'Row saved' : 'Row added');
      }
    });
  }

  function openSubject(id) {
    var s = id ? subj(id) : null;
    if (id && !s) return;
    var freeColor = PALETTE.filter(function (c) { return !S.subjects.some(function (x) { return x.color === c; }); })[0] || PALETTE[0];
    var v = s || { name: '', short: '', color: freeColor, group: 'ib', level: '', teacher: '', goal: 0, notes: '' };
    var custom = PALETTE.indexOf(v.color) < 0;
    var sw = PALETTE.map(function (c) {
      return '<label class="swatch" style="--c:' + c + '"><input type="radio" name="color" value="' + c + '"' + (v.color === c ? ' checked' : '') + ' aria-label="Colour ' + c + '"><span></span></label>';
    }).join('') +
      '<label class="swatch custom"><input type="radio" name="color" value="custom"' + (custom ? ' checked' : '') + ' tabindex="-1" aria-hidden="true"><span></span></label>' +
      '<span class="colorpick-wrap"><input type="color" class="colorpick" name="customColor" id="s-color" value="' + (custom ? v.color.toLowerCase() : '#888888') + '" aria-label="Pick your own colour"></span>';
    var evs = s ? S.events.filter(function (e) { return e.subject === s.id; }).sort(byStart) : [];
    var body =
      grp(rField({ label: 'Name', name: 'name', id: 's-name', value: v.name, max: 60, placeholder: 'Name', autofocus: !s }) +
          rText('Short name', 'short', 's-short', v.short, 'Used where space is tight', 18)) +
      grp('<div class="swatches">' + sw + '</div>', 'Colour') +
      grp(rSelect('Group', 'group', 's-group', optionList([['ib', LV().one]].concat(isIB() || v.group === 'core' ? [['core', 'Core']] : []).concat([['other', 'Other']]), v.group)) +
          (LV().sl || v.level ? rSelect('Level', 'level', 's-level', optionList([['', 'Not set'], ['SL', 'SL'], ['HL', 'HL']], v.level)) : '') +
          rPill('Weekly goal (hours)', 'number', 'goal', 's-goal', v.goal ? String(+(v.goal / 60).toFixed(2)) : '', ' min="0" max="40" step="0.5" inputmode="decimal" placeholder="0"') +
          rText('Teacher', 'teacher', 's-teacher', v.teacher, 'Optional', 60)) +
      grp(rField({ area: true, label: 'Notes', name: 'notes', id: 's-notes', value: v.notes, max: 4000, placeholder: 'Notes: IA topic, research question, word counts…' })) +
      (s ? (evs.length ? grp('<ul class="dlg-list">' + evs.map(function (e) {
            return '<li><span>' + esc([e.title, evDetail(e)].filter(Boolean).join(' · ') || evTitle(e)) + '</span><span class="muted">' + esc(fDay(e.start)) + '</span></li>';
          }).join('') + '</ul>', 'Dates') : '<p class="group-head">Dates</p><p class="group-foot">No dates yet. Add them from the calendar.</p>') : '');
    openDialog({
      title: s ? s.name : 'New Subject',
      body: body,
      wide: true,
      submitLabel: s ? 'Save' : 'Add',
      danger: s ? { label: 'Delete Subject', act: 'subj-delete', id: s.id } : null,
      onSubmit: function (fd) {
        var name = clip(fd.get('name'), 60);
        if (!name) { fieldError('#s-name', 'Give the subject a name.'); return false; }
        var color = fd.get('color');
        if (color === 'custom') color = fd.get('customColor');
        if (!HEX.test(color || '')) color = '#8E8E93';
        var goalH = parseFloat(String(fd.get('goal') || '').replace(',', '.'));
        var data = {
          name: name, short: clip(fd.get('short'), 18) || shortFrom(name), color: color.toUpperCase(),
          group: ['ib', 'core', 'other'].indexOf(fd.get('group')) >= 0 ? fd.get('group') : 'ib',
          level: fd.get('level') === 'SL' || fd.get('level') === 'HL' ? fd.get('level') : '',
          teacher: clip(fd.get('teacher'), 60),
          goal: goalH > 0 ? Math.min(2400, Math.round(goalH * 60)) : 0,
          notes: clip(fd.get('notes'), 4000, true)
        };
        if (s) Object.assign(s, data); else S.subjects.push(Object.assign({ id: uid('s') }, data));
        save(); render();
        toast(s ? 'Subject saved' : 'Subject added');
      }
    });
  }

  function openLog() {
    var sel = subj(UI.focusSubject) ? UI.focusSubject : '';
    var opts = '<option value="">General study</option>' + S.subjects.filter(function (s) { return s.group !== 'other'; }).map(function (s) {
      return '<option value="' + s.id + '"' + (s.id === sel ? ' selected' : '') + '>' + esc(s.name) + '</option>';
    }).join('');
    var body = grp(rSelect('Subject', 'subject', 'lg-subject', opts) +
      rPill('Minutes', 'number', 'minutes', 'lg-min', '30', ' min="1" max="720" step="5" inputmode="numeric" autofocus') +
      rPill('Date', 'date', 'date', 'lg-date', today()), '', 'For study you did without the timer.');
    openDialog({
      title: 'Log Study Time', body: body, submitLabel: 'Log',
      onSubmit: function (fd) {
        var m = parseInt(fd.get('minutes'), 10);
        if (!(m >= 1 && m <= 720)) { fieldError('#lg-min', 'Enter between 1 and 720 minutes.'); return false; }
        var sid = subj(fd.get('subject')) ? fd.get('subject') : null;
        logSession(sid, m, DATE.test(fd.get('date')) ? fd.get('date') : today());
        save(); render();
        toast(dur(m) + ' of ' + nameOrGeneral(sid) + ' logged' + petNote());
      }
    });
  }

  function openSettings() {
    curSheet = openSettings;
    settingsTouched = false;
    var lb = S.settings.lastBackup, p = plusOn(), free = isFree();
    var who = (p ? plusLabel() : free ? 'Free account' : 'Bloc account') + (free ? ' · @' + ME.id : '');
    var body =
      grp('<button type="button" class="row row-btn acct" data-act="pfp-open" aria-label="Profile picture">' + avatar(ME.id, ME.name, '', ME.avatar) +
            '<span class="two-line"><b>' + esc(ME.name) + '</b><span>' + esc(who) + '</span></span><span class="acct-edit">' + (ME.avatar ? 'Edit' : 'Add photo') + '</span>' + icon('chev') + '</button>' +
          rNav('key', 'Change Password', 'pw-open') +
          '<button type="button" class="row row-btn danger-text" data-act="logout">' + icon('logout') + '<span class="row-label">Log Out</span></button>',
          'Account', syncText()) +
      shopGroup(p) +
      (free ? grp(rNav('subjects', 'Studies', 'level-open', LV().name), '', 'Sets the subject list and a few words around ' + BRAND + '.') : '') +
      remindGroup() +
      siriGroup() +
      grp('<div class="row wrap"><span class="row-label">Appearance</span><span class="row-value"><span class="seg" role="group" aria-label="Appearance">' +
        [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(function (o) {
          return '<button type="button" data-act="set-theme" data-theme="' + o[0] + '" aria-pressed="' + (S.settings.theme === o[0]) + '">' + o[1] + '</button>';
        }).join('') + '</span></span></div>') +
      accentGroup() +
      grp(rNav('download', 'Import from Calendar', 'import-open', S.settings.feeds.length ? S.settings.feeds.length + ' linked' : '') +
          rButton(icon('calendar') + 'Export to Calendar (.ics)', 'ics-export'), 'Apple and Google Calendar',
          'Import brings in dates from Apple Calendar, Google Calendar or your school’s calendar. Export makes a one-time copy of your dates for them, with a reminder the day before each deadline and exam.') +
      liveCalGroup() +
      grp(rButton(icon('download') + 'Export Backup', 'backup-export') + rButton(icon('upload') + 'Import Backup', 'backup-import') +
          '<input type="file" id="import-file" accept="application/json,.json" hidden>', 'Backup',
          'Your planner already saves to your account. A backup is an extra copy you keep as a file. ' + (lb ? 'Last backup: ' + esc(fDay(lb)) + '.' : 'No backup yet.')) +
      legacyGroup() +
      (ME.admin ? grp(rNav('users', 'Manage Accounts', 'admin-open') +
          rNav('flag', 'Chat Reports', 'admin-reports', CHAT.reports ? CHAT.reports + ' open' : 'None') +
          rNav('paper', 'Past Papers Section', 'admin-papers', CONF.papers ? 'Edited' : 'Default') +
          rNav('star', 'Plus Price', 'admin-price', euro((CONF.price || PRICE_DEFAULT).month) + ' a month') +
          rNav('heart', 'Bizum Number', 'admin-bizum', CONF.bizum || 'Not set') +
          rNav('mic', 'Siri Shortcut', 'admin-siri', CONF.siri ? 'Link added' : 'Not set') +
          rNav('spark', 'AI Assistant', 'admin-assist', CONF.assist && !CONF.assist.on ? 'Off' : ((CONF.assist && CONF.assist.limit) || 15) + ' a day'), 'Admin',
          'Only you see this. Manage accounts, check reported chat messages, change the Past Papers links and text, set the Plus price, your Bizum number, the link to the Siri Shortcut and the assistant’s limits.') : '') +
      (free ? grp(rNav('check', guideOn() ? 'Setup Guide' : 'Show Setup Guide', 'guide-show', guideOn() ? 'On Today' : '')) : '') +
      grp('<div class="row"><span class="row-label">Keyboard</span><span class="row-value"><span class="kbd">1</span>–<span class="kbd">5</span>&nbsp;sections · <span class="kbd">N</span>&nbsp;task · <span class="kbd">E</span>&nbsp;event</span></div>') +
      grp(rButton(free ? 'Start Over' : 'Reset to Starting Data', 'reset-all', '', 'danger'), '', free
        ? 'Empties your timetable, dates and tasks' + (isIB() ? ' and keeps only the IB core' : '') + '. Export a backup first if you want to keep your changes.'
        : 'Puts back the starting timetable, calendar and tasks. Export a backup first if you want to keep your changes.') +
      grp(legalLinks(), 'About') +
      (ME.admin ? '' : grp(rButton('Delete Account', 'account-delete', '', 'danger'), '', free ? 'Deletes your account, planner, photo and chats from Bloc for good.'
        : 'Deletes your planner, photo, chats and password from Bloc for good. Your name stays on the class list, locked until Mauro gives you a setup code.'));
    openDialog({ title: 'Settings', body: body });
  }
  function openLevel() {
    curSheet = openLevel;
    var cur = level();
    openDialog({
      title: 'Studies', back: openSettings, backLabel: 'Settings',
      body: grp(LEVEL_IDS.map(function (k) {
          var L = LEVELS[k];
          return '<button type="button" class="row row-btn nav-row level-row" data-act="level-set" data-level="' + k + '" aria-pressed="' + (cur === k) + '">' +
            '<span class="level-tile mini lv-' + k + '" aria-hidden="true">' + esc(LEVEL_TILE[k]) + '</span>' +
            '<span class="two-line"><b>' + esc(L.name) + '</b><span>' + esc(L.sub) + '</span></span>' + (cur === k ? icon('check') : '') + '</button>';
        }).join(''), 'What you study', 'Your subjects, dates and tasks stay as they are. The subject list and a few words change.')
    });
  }
  function plusLabel() { return ME.plus === 'admin' ? 'Bloc Plus, owner' : ME.plus === 'class' ? 'Bloc Plus, class code' : 'Bloc Plus'; }
  function syncText() {
    if (!SYNC.online) return 'Offline. Changes are saved on this device and sync when you’re back online.';
    if (SYNC.pending || dirty) return 'Saving your changes…';
    return 'Your planner saves to your account and syncs to every device where you log in.';
  }
  function accentGroup() {
    if (!plusOn() && !sellHere()) return '';
    var cur = plusOn() ? S.settings.accent || '' : '';
    return grp('<div class="swatches accents" role="group" aria-label="Highlighter colour">' + ACCENTS.map(function (a) {
        return '<button type="button" class="accent-sw" data-act="set-accent" data-accent="' + a[0] + '" style="--c:' + a[2] + '" aria-pressed="' + (cur === a[0]) + '" aria-label="' + a[1] + '" title="' + a[1] + '">' + icon('check') + '</button>';
      }).join('') + '</div>', 'Highlighter', plusOn() ? 'The mark on today, the class that’s on and your next exam.' : 'Highlighter colours come with Bloc Plus.');
  }
  function calUrl() { return CONF.cal && /^[A-Za-z0-9_-]{32}$/.test(CONF.cal) ? location.origin + '/api/cal/' + CONF.cal + '.ics' : ''; }
  function liveCalGroup() {
    if (!plusOn()) return sellHere() ? grp(rNav('star', 'Live Calendar with Plus', 'plus-open'), 'Live calendar', 'Plus puts your deadlines and exams in Apple or Google Calendar and keeps them up to date.') : '';
    var url = calUrl();
    if (!url) return grp(rButton(icon('calendar') + 'Turn On Live Calendar', 'cal-link'), 'Live calendar', 'Get a private link your calendar app checks every few hours, so new dates show up by themselves.');
    return grp('<a class="row row-btn" href="' + esc(url.replace(/^https?:/, 'webcal:')) + '">' + icon('calendar') + 'Subscribe in Calendar</a>' +
        rButton(icon('copy') + 'Copy Link', 'cal-copy') +
        rButton(icon('refresh') + 'Make a New Link', 'cal-link'),
      'Live calendar', 'Apple Calendar: tap Subscribe. Google Calendar: Other calendars → From URL, then paste the link. Anyone with the link can see your dates; a new link turns the old one off.');
  }
  function legacyGroup() {
    if (!legacyData() || legacyDone(ME.id)) return '';
    return grp(rButton(icon('upload') + 'Bring Back Old Planner', 'legacy-use') + rButton('Hide This', 'legacy-hide'), 'This browser',
      'This browser still has a planner saved before Bloc had accounts. Bringing it back replaces your current planner.');
  }

  function busyForm(form, on) {
    if (!form) return false;
    if (on && form.dataset.busy === '1') return true;
    form.dataset.busy = on ? '1' : '';
    var b = form.querySelector('[type="submit"]');
    if (b) b.disabled = !!on;
    return false;
  }

  /* Changing a password: the server checks the current one first (/api/reauth), then saves the new one. */
  function openPassword() {
    curSheet = openPassword;
    var body =
      '<input class="sr" type="text" name="username" value="' + esc(ME.id) + '" autocomplete="username" tabindex="-1" aria-hidden="true">' +
      grp(rPw('Current password', 'current', 'cp-cur', 'current-password', true)) +
      grp(rPw('New password', 'next', 'cp-new', 'new-password') + rPw('Repeat new password', 'again', 'cp-again', 'new-password'), '',
          'At least 6 characters. Your other devices get logged out.');
    openDialog({
      title: 'Change Password', body: body, submitLabel: 'Change', back: openSettings, backLabel: 'Settings',
      onSubmit: function (fd, form) {
        var cur = String(fd.get('current') || ''), nx = String(fd.get('next') || ''), again = String(fd.get('again') || '');
        if (!cur) { fieldError('#cp-cur', 'Enter your current password.'); return false; }
        if (failedBefore(ME.id, cur)) { $('#cp-cur', dlg).value = ''; fieldError('#cp-cur', SAME_PW); return false; }
        var curFilled = autofilled($('#cp-cur', dlg));
        if (Array.from(nx).length < 6) { fieldError('#cp-new', 'Use at least 6 characters.'); return false; }
        if (nx !== again) { fieldError('#cp-again', 'The new passwords don’t match.'); return false; }
        if (busyForm(form, true)) return false;
        api('POST', '/api/reauth', { password: cur }).then(function (r) {
          var d = r.data || {};
          if (r.status === 401 && d.error === 'wrong') { markFailed(ME.id, cur); throw { sel: '#cp-cur', clear: true, msg: wrongText(d, curFilled) }; }
          if (r.status === 401) { sessionLost(); throw { quiet: true }; }
          if (r.status === 429) throw { sel: '#cp-cur', msg: 'Too many tries. Wait ' + (d.wait || 15) + ' min.' };
          if (r.status !== 200) throw { sel: '#cp-cur', msg: 'Something went wrong. Try again.' };
          return api('POST', '/api/password', { password: nx });
        }).then(function (r) {
          var d = r.data || {};
          if (r.status === 400 && d.error === 'common') throw { sel: '#cp-new', msg: 'That password is too easy to guess. Try another.' };
          if (r.status !== 200) throw { sel: '#cp-new', msg: 'Something went wrong. Try again.' };
          closeDialog();
          toast('Password changed. Your other devices were logged out.');
        }).catch(function (e) {
          busyForm(form, false);
          if (e && e.quiet) return;
          if (e && e.sel) { if (e.clear && $(e.sel, dlg)) $(e.sel, dlg).value = ''; fieldError(e.sel, e.msg); }
          else fieldError('#cp-cur', 'Can’t reach Bloc. Check your connection.');
        });
        return false;
      }
    });
  }

  /* Accounts outside the class can delete themselves: password check first (/api/reauth), then /api/account/delete. */
  function openDeleteAccount() {
    curSheet = openDeleteAccount;
    var body =
      '<input class="sr" type="text" name="username" value="' + esc(ME.id) + '" autocomplete="username" tabindex="-1" aria-hidden="true">' +
      (isFree() ? '<div class="plus-hero"><h3>Delete @' + esc(ME.id) + '?</h3><p>Your account, your planner, your photo, your chats and your logins on every device go for good. Nobody can bring them back, not even Mauro.</p></div>'
                : '<div class="plus-hero"><h3>Delete your account?</h3><p>Your planner, your photo, your chats, your password and your logins on every device go for good. Nobody can bring them back, not even Mauro. ' + esc(ME.name) + ' stays on the class list; to use it again, ask Mauro for a setup code.</p></div>') +
      grp(rButton(icon('download') + 'Export Backup First', 'backup-export')) +
      grp(rPw('Password', 'current', 'da-pw', 'current-password', false), 'Type your password to confirm');
    openDialog({
      title: 'Delete Account', body: body, submitLabel: 'Delete', submitDanger: true, back: openSettings, backLabel: 'Settings',
      onSubmit: function (fd, form) {
        var pw = String(fd.get('current') || '');
        if (!pw) { fieldError('#da-pw', 'Enter your password.'); return false; }
        if (failedBefore(ME.id, pw)) { $('#da-pw', dlg).value = ''; fieldError('#da-pw', SAME_PW); return false; }
        var filled = autofilled($('#da-pw', dlg));
        if (busyForm(form, true)) return false;
        var id = ME.id;
        api('POST', '/api/reauth', { password: pw }).then(function (r) {
          var d = r.data || {};
          if (r.status === 401 && d.error === 'wrong') { markFailed(ME.id, pw); $('#da-pw', dlg).value = ''; throw { msg: wrongText(d, filled) }; }
          if (r.status === 401) { sessionLost(); throw { quiet: true }; }
          if (r.status === 429) throw { msg: 'Too many tries. Wait ' + (d.wait || 15) + ' min.' };
          if (r.status !== 200) throw { msg: 'Something went wrong. Try again.' };
          return api('POST', '/api/account/delete', {});
        }).then(function (r) {
          if (r.status !== 200) throw { msg: 'Couldn’t delete it (error ' + r.status + '). Try again.' };
          toNative({ type: 'logout' });
          stopApp();
          ['myib:ui:', 'myib:nag:', 'myib:papers:', 'myib:remind:', 'myib:chatok:'].forEach(function (k) { sdel(k + id); });
          sdel(cacheKey(id)); sdel('myib:last');
          showAuth({});
          toast('Your account is deleted');
        }).catch(function (e) {
          busyForm(form, false);
          if (e && e.quiet) return;
          fieldError('#da-pw', e && e.msg ? e.msg : 'Can’t reach Bloc. Check your connection.');
        });
        return false;
      }
    });
  }

  /* ---------- Profile picture ---------- */
  var PFP = null;   /* the photo being cropped: { url, img, w, h, S, base, z, x, y } */
  function openPfp() {
    curSheet = openPfp;
    var has = !!ME.avatar;
    var body =
      '<div class="pfp-hero">' + avatar(ME.id, ME.name, 'xxl', ME.avatar) + '<h3>' + esc(ME.name) + '</h3></div>' +
      grp(rButton(icon('camera') + (has ? 'Choose a New Photo' : 'Choose a Photo'), 'pfp-pick') +
          '<input type="file" id="pfp-file" accept="image/*" hidden>' +
          (has ? rButton('Remove Photo', 'pfp-remove', '', 'danger') : ''), '',
          'Anyone logged in to Bloc can see your photo. Mauro can take down photos.');
    openDialog({ title: 'Profile Picture', body: body, back: openSettings, backLabel: 'Settings' });
  }
  function pfpFile(input) {
    var file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    if (file.type && !/^image\//.test(file.type)) { toast('That file isn’t a picture'); return; }
    if (file.size > 30e6) { toast('That picture is too big. Pick one under 30 MB.'); return; }
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      if (!img.naturalWidth || !img.naturalHeight) { URL.revokeObjectURL(url); toast('Couldn’t open that picture'); return; }
      if (PFP) URL.revokeObjectURL(PFP.url);
      PFP = { url: url, img: img, w: img.naturalWidth, h: img.naturalHeight, S: 0, base: 1, z: 1, x: 0, y: 0 };
      openCrop();
    };
    img.onerror = function () { URL.revokeObjectURL(url); toast('Couldn’t open that picture. Try a JPG or PNG.'); };
    img.src = url;
  }
  function openCrop() {
    if (!PFP) return;
    curSheet = openCrop;
    var body = '<div class="crop" id="crop"><img id="crop-img" src="' + esc(PFP.url) + '" alt="" draggable="false"><span class="crop-ring" aria-hidden="true"></span></div>' +
      grp('<label class="row crop-zoom"><span class="sr">Zoom</span><span class="zoom-ic small" aria-hidden="true">' + icon('camera') + '</span>' +
          '<input type="range" id="crop-zoom" min="1" max="4" step="0.01" value="1"><span class="zoom-ic" aria-hidden="true">' + icon('camera') + '</span></label>', '',
          'Drag the photo to move it. Pinch or use the slider to zoom.');
    openDialog({ title: 'Move and Scale', body: body, submitLabel: 'Save', back: openPfp, backLabel: 'Back', onSubmit: function (fd, form) { savePfp(form); return false; } });
    cropSetup();
  }
  function cropSetup() {
    var stage = $('#crop', dlg);
    if (!stage || !PFP) return;
    PFP.S = stage.clientWidth;
    PFP.base = Math.max(PFP.S / PFP.w, PFP.S / PFP.h);
    PFP.z = 1; PFP.x = (PFP.S - PFP.w * PFP.base) / 2; PFP.y = (PFP.S - PFP.h * PFP.base) / 2;
    cropDraw();
    var pts = new Map(), gap = 0, k = 1;
    stage.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); gap = 0; k = zoomOf(stage) || 1;
    });
    stage.addEventListener('pointermove', function (e) {
      var prev = pts.get(e.pointerId);
      if (!prev) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { PFP.x += (e.clientX - prev.x) / k; PFP.y += (e.clientY - prev.y) / k; cropClamp(); cropDraw(); return; }
      var a = Array.from(pts.values()), d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
      if (gap) cropZoomTo(PFP.z * d / gap);
      gap = d;
    });
    function up(e) { pts.delete(e.pointerId); gap = 0; }
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
    stage.addEventListener('wheel', function (e) { e.preventDefault(); cropZoomTo(PFP.z * Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  }
  /* the photo always covers the whole square */
  function cropClamp() {
    var sc = PFP.base * PFP.z;
    PFP.x = Math.min(0, Math.max(PFP.S - PFP.w * sc, PFP.x));
    PFP.y = Math.min(0, Math.max(PFP.S - PFP.h * sc, PFP.y));
  }
  function cropDraw() {
    var img = $('#crop-img', dlg), r = $('#crop-zoom', dlg);
    if (!img || !PFP) return;
    var sc = PFP.base * PFP.z;
    img.style.width = (PFP.w * sc) + 'px'; img.style.height = (PFP.h * sc) + 'px';
    img.style.transform = 'translate(' + PFP.x + 'px,' + PFP.y + 'px)';
    if (r && document.activeElement !== r) r.value = String(PFP.z);
  }
  /* zoom around the middle of the square */
  function cropZoomTo(z) {
    if (!PFP) return;
    z = Math.max(1, Math.min(4, z));
    var sc0 = PFP.base * PFP.z, sc1 = PFP.base * z, c = PFP.S / 2;
    var ix = (c - PFP.x) / sc0, iy = (c - PFP.y) / sc0;
    PFP.z = z; PFP.x = c - ix * sc1; PFP.y = c - iy * sc1;
    cropClamp(); cropDraw();
  }
  /* the app makes a 320×320 JPEG (about 30 KB) and sends only that */
  function savePfp(form) {
    if (!PFP || busyForm(form, true)) return;
    var OUT = 320, sc = PFP.base * PFP.z, cv = document.createElement('canvas');
    cv.width = OUT; cv.height = OUT;
    var g = cv.getContext('2d');
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, OUT, OUT);
    g.imageSmoothingQuality = 'high';
    g.drawImage(PFP.img, -PFP.x / sc, -PFP.y / sc, PFP.S / sc, PFP.S / sc, 0, 0, OUT, OUT);
    var data = cv.toDataURL('image/jpeg', 0.86);
    api('PUT', '/api/avatar', { image: data }).then(function (r) {
      busyForm(form, false);
      if (r.status === 200 && r.data && r.data.avatar) {
        ME.avatar = r.data.avatar; writeCache(); renderNav(); settingsTouched = true;
        openPfp(); toast('Profile picture saved');
        return;
      }
      if (r.status === 401) return sessionLost();
      if (r.status === 429) return toast('Too many changes. Try again in a while.');
      toast('Couldn’t save it (error ' + r.status + ')');
    }, function () { busyForm(form, false); toast('Can’t reach Bloc. Check your connection.'); });
  }

  /* ---------- Welcome + subject picker (empty planners) ---------- */
  function openWelcome() {
    curSheet = openWelcome;
    /* shown once: from now on the checklist on Today takes over */
    S.settings.guide = 'on'; save();
    var first = String(ME.name || '').split(' ')[0];
    var steps = guideSteps().map(function (x, i) {
      return '<div class="row perk"><span class="perk-ic num" style="--c:' + ['#D9501F', '#1E9E6A', '#E8930C', '#8C3B72'][i] + '">' + (i + 1) + '</span><span class="two-line"><b>' + esc(x.title) + '</b><span>' + esc(x.sub) + '</span></span></div>';
    }).join('');
    var body =
      '<div class="plus-hero"><img class="welcome-logo" src="icons/icon-192.png" alt="" width="64" height="64"><h3>Welcome' + (first ? ', ' + esc(first) : '') + '!</h3>' +
        '<p>Bloc keeps your timetable, deadlines, exams and study time in one place. Your planner starts empty. Four steps get it ready:</p></div>' +
      grp(steps) +
      grp(rButton('Start With My Subjects', 'guide-subjects', '', 'center strong')) +
      '<p class="group-foot plus-fine">The steps stay on Today until you finish them.</p>';
    openDialog({ title: 'Welcome to Bloc', body: body, doneLabel: 'Later' });
  }

  /* Common IB subjects by group. [name, short name] */
  var IB_PICK = [
    ['Language and literature', [['English A: Language and Literature', 'English A'], ['English A: Literature', 'English Lit'], ['Spanish A: Language and Literature', 'Spanish A'], ['Spanish A: Literature', 'Spanish Lit']]],
    ['Language acquisition', [['English B', 'English B'], ['French B', 'French B'], ['German B', 'German B'], ['Spanish B', 'Spanish B'], ['French ab initio', 'French'], ['Italian ab initio', 'Italian']]],
    ['Individuals and societies', [['Business Management', 'Business'], ['Economics', 'Economics'], ['History', 'History'], ['Geography', 'Geography'], ['Psychology', 'Psychology'], ['Philosophy', 'Philosophy'], ['Global Politics', 'Politics'], ['Digital Society', 'Digital Soc']]],
    ['Sciences', [['Biology', 'Biology'], ['Chemistry', 'Chemistry'], ['Physics', 'Physics'], ['Computer Science', 'CS'], ['Environmental Systems and Societies', 'ESS'], ['Sports, Exercise and Health Science', 'SEHS'], ['Design Technology', 'Design Tech']]],
    ['Mathematics', [['Math: Analysis and Approaches', 'Math AA'], ['Math: Applications and Interpretation', 'Math AI']]],
    ['The arts', [['Visual Arts', 'Visual Arts'], ['Music', 'Music'], ['Theatre', 'Theatre'], ['Film', 'Film'], ['Dance', 'Dance']]]
  ];
  function pickList() { return isIB() ? IB_PICK : LV().pick || []; }
  function openSubjectPicker() {
    curSheet = openSubjectPicker;
    var have = new Set(S.subjects.map(function (s) { return norm(s.name); })), L = LV(), list = pickList();
    var one = L.one.replace(/^IB /, '').toLowerCase();
    /* the first time, the ones everyone takes come ticked */
    var tick = hasIBSubjects() ? [] : (L.common || []).map(norm);
    var body = list.map(function (g, gi) {
      return grp('<div class="pick-chips">' + g[1].map(function (x, i) {
        var got = have.has(norm(x[0])), on = got || tick.indexOf(norm(x[0])) >= 0;
        return '<button type="button" class="pick-chip' + (got ? ' have' : '') + '" data-act="pick-subj" data-i="' + gi + '.' + i + '" aria-pressed="' + on + '"' + (got ? ' disabled' : '') + '>' +
          (got ? icon('check') : '') + esc(x[0]) + '</button>';
      }).join('') + '</div>', isIB() ? 'Group ' + (gi + 1) + ' · ' + g[0] : g[0]);
    }).join('') +
      grp(rField({ label: 'Another ' + one, name: 'other', id: 'sp-other', value: '', max: 60, placeholder: 'Another ' + one + ' (type its name)', autofocus: !list.length }), list.length ? 'Not in the list?' : '',
          'After adding them, tap ' + (level() === 'uni' ? 'a course on the Courses' : 'a subject on the Subjects') + ' page to set its ' + (L.sl ? 'level (SL or HL), ' : '') + 'teacher and colour.');
    openDialog({
      title: level() === 'uni' ? 'Your Courses' : 'Your Subjects', body: body, wide: true, submitLabel: 'Add',
      onSubmit: function (fd) {
        var picked = $$('.pick-chip[aria-pressed="true"]:not(.have)', dlg).map(function (b) {
          var ix = b.dataset.i.split('.').map(Number), x = list[ix[0]] && list[ix[0]][1][ix[1]];
          return x ? { name: x[0], short: x[1] } : null;
        }).filter(Boolean);
        var other = clip(fd.get('other'), 60);
        if (other && !have.has(norm(other))) picked.push({ name: other, short: shortFrom(other) });
        if (!picked.length) { fieldError('#sp-other', list.length ? 'Tap the ' + one + 's you take, or type one here.' : 'Type the name of a ' + one + ' you take.'); return false; }
        var used = new Set(S.subjects.map(function (s) { return s.color; }));
        var free = PALETTE.filter(function (c) { return !used.has(c) && c !== '#8E8E93'; });
        picked.forEach(function (x, i) {
          S.subjects.push({ id: uid('s'), name: x.name, short: x.short, color: free[i] || PALETTE[i % PALETTE.length], group: 'ib', level: '', teacher: '', goal: 0, notes: '' });
        });
        save();
        var n = picked.length, toTimetable = guideOn() && !Object.keys(S.slots).length;
        if (toTimetable) { closeDialog(); go('timetable'); toast(n + ' ' + one + (n === 1 ? '' : 's') + ' added. Now tap a slot to add a class.'); celebrate(null); }
        else { render(); toast(n + ' ' + one + (n === 1 ? '' : 's') + ' added'); celebrate(null); }
      }
    });
  }

  /* ---------- Bloc Plus (price: Settings → Admin → Plus Price) ---------- */
  var PLUS_PERKS = [
    ['calendar', '#E4572E', 'Live calendar', 'Your deadlines and exams in Apple or Google Calendar, updating by themselves.'],
    ['paper', '#1597A8', 'Past-paper tracker', 'Log every past paper you do and see your average per subject.'],
    ['palette', '#E0527D', 'Highlighter colours', 'Pick your highlighter: green, pink, orange, blue and more, for today, the class that’s on and your next exam.'],
    ['timer', '#F28C28', 'Any timer length', 'Focus sessions from 5 to 180 minutes.'],
    ['quiet', '#1E9E6A', 'No more pop-ups', 'The support pop-up stops showing up.'],
    ['pet', '#E8930C', 'More for your puppy', 'Dalmatian, Husky and Corgi, plus a scarf, sunglasses, headphones and a crown.']
  ];
  var eggTaps = [];
  function openPlus(back) {
    /* the iPhone app sells nothing itself: it links to the website where Apple allows that */
    if (NATIVE && !plusOn()) { if (sellHere()) openWeb('plus'); return; }
    curSheet = function () { openPlus(back); };
    eggTaps = [];
    var p = plusOn();
    var perks = PLUS_PERKS.map(function (x) {
      return '<div class="row perk"><span class="perk-ic" style="--c:' + x[1] + '">' + icon(x[0]) + '</span><span class="two-line"><b>' + esc(x[2]) + '</b><span>' + esc(x[3]) + '</span></span></div>';
    }).join('');
    var how = isFree()
      ? (CONF.bizum ? 'Until online payments open, send Mauro a Bizum (' + esc(CONF.bizum) + ') with your username, @' + esc(ME.id) + ', in the message. He’ll switch Plus on for your account.'
                    : 'Until online payments open, ask Mauro to switch Plus on for your account (@' + esc(ME.id) + ').')
      : (CONF.bizum ? 'Until online payments open, send Mauro a Bizum (' + esc(CONF.bizum) + ') and he’ll switch Plus on for you.' : 'Until online payments open, ask Mauro to switch Plus on for you.');
    var buy = p ? '' :
      grp('<div class="row"><span class="row-label">Price</span><span class="row-value price">' + esc(priceText()) + '</span></div>' +
          '<button type="button" class="row row-btn center" disabled>Pay with PayPal · coming soon</button>', 'Get Plus', how);
    var body =
      '<div class="plus-hero"><span class="plus-badge">' + icon('star') + '</span><h3>Bloc Plus</h3><p>' + (p ? 'Plus is on. Everything below is unlocked.' : 'More tools for your school year.') + '</p></div>' +
      grp(perks) + buy +
      (NATIVE ? '<p class="group-foot plus-fine">Questions about your subscription? Ask Mauro.</p>' :
      '<p class="group-foot plus-fine">Questions about your <span class="egg" data-act="egg">subscription</span>? Ask Mauro.</p>' +
      '<div class="egg-box" id="egg-box" hidden>' +
        grp('<label class="row"><span class="sr">Class code</span><input class="row-field egg-field" type="text" name="code" id="egg-code" maxlength="120" placeholder="UNLOCK EVERYTHING" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false"></label>' +
            rButton('Unlock', 'egg-unlock', '', 'center strong')) +
      '</div>');
    openDialog({ title: 'Bloc Plus', body: body, back: back || null });
  }
  /* Tap "subscription" five times and the class-code box shows up. */
  function eggTap() {
    var t = Date.now();
    eggTaps = eggTaps.filter(function (x) { return t - x < 4000; });
    eggTaps.push(t);
    if (eggTaps.length < 5) return;
    eggTaps = [];
    var box = $('#egg-box', dlg);
    if (!box || !box.hidden) return;
    box.hidden = false;
    dlgSubmit = function () { eggUnlock(); return false; };
    var f = $('#egg-code', dlg);
    if (f) { f.focus(); f.scrollIntoView({ block: 'nearest' }); }
  }
  function eggUnlock() {
    var f = $('#egg-code', dlg), btn = $('[data-act="egg-unlock"]', dlg);
    if (!f || (btn && btn.disabled)) return;
    var code = f.value.trim();
    if (!code) { fieldError('#egg-code', 'Type the class code.'); return; }
    if (btn) btn.disabled = true;
    api('POST', '/api/unlock', { code: code }).then(function (r) {
      if (btn) btn.disabled = false;
      var d = r.data || {};
      if (r.status === 200 && d.user) {
        applyMe(d); closeDialog(); render();
        toast('Everything’s unlocked. Enjoy Bloc Plus!');
        return;
      }
      if (r.status === 401) return sessionLost();
      if (r.status === 403 && d.error === 'class_only') return fieldError('#egg-code', 'Class codes only work for Sociales 2 IB accounts.');
      if (r.status === 403) return fieldError('#egg-code', d.left ? 'That’s not the class code. ' + d.left + (d.left === 1 ? ' try' : ' tries') + ' left.' : 'That’s not the class code.');
      if (r.status === 429) return fieldError('#egg-code', 'Too many tries. Wait ' + (d.wait || 15) + ' min.');
      fieldError('#egg-code', 'Something went wrong. Try again.');
    }, function () {
      if (btn) btn.disabled = false;
      fieldError('#egg-code', 'Can’t reach Bloc. Check your connection.');
    });
  }

  /* ---------- Support the dev (also the pop-up) ---------- */
  var NAG_HOURS = 3, nagTimer = null;
  function openSupport(back, auto) {
    if (NATIVE) { if (sellHere()) openWeb('support'); return; }
    curSheet = function () { openSupport(back, auto); };
    var b = CONF.bizum;
    var body =
      '<div class="plus-hero"><span class="plus-badge heart">' + icon('heart') + '</span><h3>Support the dev!</h3>' +
        '<p>Bloc is free and has no ads. ' + (isFree() ? 'Mauro, an IB student, builds it in his spare time.' : 'Mauro builds it for your class in his spare time.') +
        ' If it saves you time, send him a Bizum. Any amount helps.</p></div>' +
      (b ? grp('<div class="row"><span class="row-label">Bizum</span><span class="row-value num">' + esc(b) + '</span></div>' + rButton(icon('copy') + 'Copy Number', 'copy-bizum'),
          'Send a Bizum', 'Open your bank app, tap Bizum, paste the number and send what you like.') : '') +
      grp(rNav('star', plusOn() ? 'Bloc Plus' : 'See Bloc Plus', 'plus-open', plusOn() ? 'On' : ''), '', plusOn() ? '' : 'Plus turns this pop-up off and unlocks the extra tools.') +
      (ME.admin ? '<p class="group-foot">This is what your classmates see.' + (b ? '' : ' Add your Bizum number in Settings → Admin.') + '</p>' : '');
    openDialog({ title: 'Support Bloc', body: body, back: back || null, doneLabel: auto ? 'Not Now' : 'Done' });
  }
  /* The pop-up: 45 s after opening, then at most every NAG_HOURS per device. Plus turns it off. */
  function scheduleNag() {
    clearTimeout(nagTimer); nagTimer = null;
    if (!ME || plusOn() || NATIVE) return;
    var key = 'myib:nag:' + ME.id, last = Number(sget(key)) || 0;
    var wait = Math.max(45000, last + NAG_HOURS * 3600000 - Date.now());
    nagTimer = setTimeout(function tryNag() {
      nagTimer = null;
      if (!ME || MODE !== 'app' || plusOn()) return;
      if (dlg.open || !idle() || document.hidden) { nagTimer = setTimeout(tryNag, 20000); return; }
      if (guideBusy()) { nagTimer = setTimeout(tryNag, 60000); return; }
      sset(key, String(Date.now()));
      openSupport(null, true);
      scheduleNag();
    }, Math.min(wait, 2147000000));
  }
  function copyText(text, el, label) {
    function done(ok) { if (ok) flash(el, label || 'Copied'); else toast('Couldn’t copy. Select it and copy it by hand.'); }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '0'; ta.style.opacity = '0';
      (dlg.open ? dlg : document.body).appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      done(ok);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
    else fallback();
  }

  /* ---------- Past papers ----------
     Mauro edits this sheet in Settings → Admin → Past Papers Section (the server keeps his version).
     Until he saves one, everyone sees this default. */
  var PAPERS_DEFAULT = {
    title: 'Past Papers', intro: '', head: 'Where to get them',
    foot: 'These are the IB’s own sources. Your teachers can also share the past papers the school has.',
    links: [
      { title: 'IB Store: exam prep', sub: 'Official exam packs, sold by subject', url: 'https://www.follettibstore.com/main/ib-exam-prep', fresh: false },
      { title: 'IB Questionbank', sub: 'Official practice questions with markschemes', url: 'https://questionbank.ibo.org/', fresh: false }
    ],
    updated: 0
  };
  function papersConf() { return CONF.papers || PAPERS_DEFAULT; }
  function papersSeenKey() { return 'myib:papers:' + (ME ? ME.id : ''); }
  /* the Past papers button says New until you open the sheet after Mauro adds links marked New */
  function papersNew() {
    var P = CONF.papers;
    return !!(ME && P && P.updated && P.links.some(function (l) { return l.fresh; }) && P.updated > (Number(sget(papersSeenKey())) || 0));
  }
  function lines(s) { return esc(s).replace(/\n/g, '<br>'); }
  function paperAvg(list) { return Math.round(list.reduce(function (a, x) { return a + x.score / x.max; }, 0) / list.length * 100); }
  function fmtNum(n) { return String(Math.round(n * 10) / 10); }
  function paperTitle(x) {
    var s = subj(x.subject);
    var when = x.session ? SESSIONS[x.session] + (x.year ? ' ' + x.year : '') : (x.year ? String(x.year) : '');
    return [s ? s.short : '', when, x.paper].filter(Boolean).join(' · ') || 'Past paper';
  }
  function openPapers() {
    curSheet = openPapers;
    var P = papersConf();
    if (papersNew()) settingsTouched = true;         /* redraw the page behind, so its New tag goes */
    if (P.updated) sset(papersSeenKey(), String(P.updated));
    var links = P.links.map(function (l) {
      var href = webUrl(l.url);
      if (!href) return '';
      return '<a class="row row-btn link-row" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + icon('link') +
        '<span class="two-line"><b>' + esc(l.title) + (l.fresh ? '<span class="tag-new">New</span>' : '') + '</b>' + (l.sub ? '<span>' + esc(l.sub) + '</span>' : '') + '</span>' + icon('out') + '</a>';
    }).join('');
    var body = (P.intro ? '<p class="papers-intro">' + lines(P.intro) + '</p>' : '') +
      (links ? grp(links, P.head ? esc(P.head) : '', P.foot ? lines(P.foot) : '') : P.foot ? '<p class="group-foot">' + lines(P.foot) + '</p>' : '') +
      (plusOn() ? papersLog() : !sellHere() ? '' : grp(rNav('star', 'Track Your Scores with Plus', 'plus-open'), 'Your papers', 'Log each past paper you do and see your average per subject.')) +
      (ME.admin ? grp(rNav('paper', 'Edit This Section', 'admin-papers'), '', 'Only you see this button.') : '');
    openDialog({ title: P.title || 'Past Papers', body: body, wide: true });
  }

  /* ---------- Admin: Past Papers editor ---------- */
  var PE = { back: null };
  function openPapersEditor(draft, focusSel) {
    var P = draft || clone(papersConf());
    curSheet = function () { openPapersEditor(P); };
    var n = P.links.length;
    var links = P.links.map(function (l, i) {
      var k = i + 1;
      return '<p class="group-head">Link ' + k + '</p><div class="group pe-link">' +
        rField({ label: 'Link ' + k + ' title', name: 'lt' + i, id: 'pe-lt-' + i, value: l.title, max: 100, placeholder: 'Title, like Math AA HL · May 2024' }) +
        rField({ label: 'Link ' + k + ' subtitle', name: 'ls' + i, id: 'pe-ls-' + i, value: l.sub, max: 160, placeholder: 'Subtitle (optional), like Paper 1 + markscheme' }) +
        '<label class="row"><span class="sr">Link ' + k + ' address</span><input class="row-field pe-url" type="url" name="lu' + i + '" id="pe-lu-' + i + '" maxlength="800" value="' + esc(l.url) +
          '" placeholder="Link, like https://drive.google.com/…" inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false"></label>' +
        rSwitch('“New” tag', 'ln' + i, 'pe-ln-' + i, l.fresh) +
        '<div class="row pe-tools">' +
          '<button type="button" class="btn small" data-act="pe-move" data-i="' + i + '" data-step="-1"' + (i === 0 ? ' disabled' : '') + ' aria-label="Move link ' + k + ' up">' + icon('up') + 'Up</button>' +
          '<button type="button" class="btn small" data-act="pe-move" data-i="' + i + '" data-step="1"' + (i === n - 1 ? ' disabled' : '') + ' aria-label="Move link ' + k + ' down">' + icon('down') + 'Down</button>' +
          '<button type="button" class="btn small danger" data-act="pe-remove" data-i="' + i + '" aria-label="Remove link ' + k + '">Remove</button>' +
        '</div></div>';
    }).join('');
    var body =
      grp(rText('Title', 'title', 'pe-title', P.title, 'Past Papers', 40) +
          rField({ area: true, label: 'Intro', name: 'intro', id: 'pe-intro', value: P.intro, max: 400, placeholder: 'Intro at the top (optional), like: New this month: Math and History.' }),
          'Top of the sheet') +
      grp(rText('Heading', 'head', 'pe-head', P.head, 'Where to get them', 60), 'Links', 'The small heading above the links.') +
      links +
      grp(rButton(icon('plus') + 'Add Link', 'pe-add', n >= 30 ? ' disabled' : ''), '', n ? '' : 'No links yet. Students then see only the intro and the text below.') +
      grp(rField({ area: true, label: 'Text under the links', name: 'foot', id: 'pe-foot', value: P.foot, max: 400, placeholder: 'Text under the links (optional)' }), 'Under the links',
          'Students see changes the next time they open Bloc. Links open in a new tab. Turn on “New” for this month’s papers: the Past papers button then shows a New tag until each student opens the sheet.');
    openDialog({
      title: 'Edit Past Papers', body: body, wide: true, submitLabel: 'Save',
      back: PE.back || openSettings, backLabel: PE.back === openPapers ? 'Papers' : 'Settings',
      danger: CONF.papers ? { label: 'Reset to Default', act: 'pe-reset', id: '' } : null,
      onSubmit: function (fd, form) { savePapers(form); return false; }
    });
    /* after adding, moving or removing a link, keep the keyboard where it was */
    [].concat(focusSel || []).some(function (sel) {
      var f = $(sel, dlg);
      if (!f) return false;
      f.focus({ preventScroll: true }); f.scrollIntoView({ block: 'center' });
      return true;
    });
  }
  function readPapersForm(form) {
    var fd = new FormData(form), links = [];
    for (var i = 0; i < $$('.pe-link', form).length; i++) {
      links.push({ title: String(fd.get('lt' + i) || ''), sub: String(fd.get('ls' + i) || ''), url: String(fd.get('lu' + i) || ''), fresh: fd.get('ln' + i) === 'on' });
    }
    return { title: String(fd.get('title') || ''), intro: String(fd.get('intro') || ''), head: String(fd.get('head') || ''), foot: String(fd.get('foot') || ''), links: links };
  }
  function savePapers(form) {
    var d = readPapersForm(form), links = [], at = [];
    for (var i = 0; i < d.links.length; i++) {
      var l = d.links[i], t = clip(l.title, 100), s = clip(l.sub, 160), u = l.url.trim();
      if (!t && !s && !u) continue;                    /* an empty link just goes */
      if (!t) return fieldError('#pe-lt-' + i, 'Give link ' + (i + 1) + ' a title.');
      if (!u) return fieldError('#pe-lu-' + i, 'Paste the link for “' + t + '”.');
      if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
      var href = webUrl(u);
      if (!href) return fieldError('#pe-lu-' + i, 'That isn’t a web link. Paste the full address, starting with https://');
      links.push({ title: t, sub: s, url: href, fresh: l.fresh });
      at.push(i);
    }
    var body = { title: clip(d.title, 40), intro: clip(d.intro, 400, true), head: clip(d.head, 60), foot: clip(d.foot, 400, true), links: links };
    if (busyForm(form, true)) return;
    api('POST', '/api/admin/config', { papers: body }).then(function (r) {
      busyForm(form, false);
      var e = r.data || {};
      if (r.status === 200 && r.data) { setConf(Object.assign({ cal: CONF.cal }, r.data)); writeCache(); PE.back = null; openPapers(); toast('Past Papers updated for everyone'); return; }
      if (r.status === 401) return sessionLost();
      if (r.status === 400 && e.error === 'papers') {
        var k = { title: 't', sub: 's', url: 'u', link: 't' }[e.field];
        if (e.at != null && k && at[e.at] != null) return fieldError('#pe-l' + k + '-' + at[e.at], e.field === 'url' ? 'That link isn’t allowed. Use a normal https:// address.' : 'Shorten this a little.');
        if (e.field === 'links') return fieldError('#pe-title', 'That’s too many links. The most is 30.');
        return fieldError('#pe-' + (['title', 'intro', 'head', 'foot'].indexOf(e.field) >= 0 ? e.field : 'title'), 'Shorten this a little.');
      }
      fieldError('#pe-title', 'Couldn’t save it (error ' + r.status + '). Try again.');
    }, function () { busyForm(form, false); fieldError('#pe-title', 'Can’t reach Bloc. Check your connection.'); });
  }

  /* ---------- Admin: Plus price ---------- */
  function openPrice() {
    curSheet = openPrice;
    var p = CONF.price || PRICE_DEFAULT;
    openDialog({
      title: 'Plus Price', submitLabel: 'Save', back: openSettings, backLabel: 'Settings',
      body: grp(rPill('A month (€)', 'number', 'month', 'pr-month', String(p.month), ' min="0.5" max="50" step="0.5" inputmode="decimal"') +
                rPill('Whole year, once (€)', 'number', 'once', 'pr-once', String(p.once), ' min="1" max="200" step="1" inputmode="decimal"'), '',
                'Shows on the Bloc Plus sheet: “' + esc(priceText()) + '”. People still pay you by Bizum, so this changes the text only.'),
      onSubmit: function (fd, form) {
        var m = parseFloat(String(fd.get('month') || '').replace(',', '.')), o = parseFloat(String(fd.get('once') || '').replace(',', '.'));
        if (!(m >= 0.5 && m <= 50)) { fieldError('#pr-month', 'Pick between 0,50 € and 50 €.'); return false; }
        if (!(o >= 1 && o <= 200)) { fieldError('#pr-once', 'Pick between 1 € and 200 €.'); return false; }
        if (busyForm(form, true)) return false;
        api('POST', '/api/admin/config', { price: { month: m, once: o } }).then(function (r) {
          busyForm(form, false);
          if (r.status === 200 && r.data) { setConf(Object.assign({ cal: CONF.cal }, r.data)); writeCache(); openSettings(); toast('Price saved: ' + priceText()); }
          else if (r.status === 401) sessionLost();
          else fieldError('#pr-month', 'Couldn’t save it. Try again.');
        }, function () { busyForm(form, false); fieldError('#pr-month', 'Can’t reach Bloc. Check your connection.'); });
        return false;
      }
    });
  }
  function papersLog() {
    var list = S.papers.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    var by = {}, order = [];
    list.forEach(function (x) { var k = x.subject || ''; if (!by[k]) { by[k] = []; order.push(k); } by[k].push(x); });
    var avgs = order.map(function (k) {
      var s = subj(k), arr = by[k];
      return '<div class="row"><span class="row-label lbl"><i class="sw" style="' + cvar(s) + '"></i><span>' + esc(s ? s.name : 'No subject') + '</span></span>' +
        '<span class="row-value">' + arr.length + ' paper' + (arr.length > 1 ? 's' : '') + ' · <b class="pct">' + paperAvg(arr) + '%</b></span></div>';
    }).join('');
    var rows = list.slice(0, 300).map(function (x) {
      var s = subj(x.subject);
      return '<button type="button" class="row row-btn paper-row" data-act="paper-open" data-id="' + x.id + '"><i class="sw" style="' + cvar(s) + '"></i>' +
        '<span class="two-line"><b>' + esc(paperTitle(x)) + '</b><span>' + esc(fDay(x.date) + ' · ' + fmtNum(x.score) + ' / ' + fmtNum(x.max)) + '</span></span>' +
        '<span class="row-value pct">' + Math.round(x.score / x.max * 100) + '%</span></button>';
    }).join('');
    return (avgs ? grp(avgs, 'Averages') : '') +
      grp(rows + rButton(icon('plus') + 'Log a Paper', 'paper-new'), 'Your papers', list.length ? '' : 'Log each past paper you do to see your average per subject.');
  }
  function openPaper(id) {
    var x = id ? S.papers.filter(function (p) { return p.id === id; })[0] : null;
    if (id && !x) return;
    curSheet = function () { openPaper(id); };
    var v = x || { subject: subj(UI.paperSubject) ? UI.paperSubject : '', year: null, session: 'may', paper: '', score: '', max: '', date: today() };
    var years = [['', 'Not set']];
    for (var y = now().getFullYear(); y >= 2010; y--) years.push([y, String(y)]);
    var body =
      grp(rSelect('Subject', 'subject', 'pp-subject', subjectOptions(v.subject || '', 'None')) +
          rSelect('Session', 'session', 'pp-session', optionList([['may', 'May'], ['nov', 'November'], ['spec', 'Specimen'], ['', 'Not set']], v.session)) +
          rSelect('Year', 'year', 'pp-year', optionList(years, v.year || '')) +
          rText('Paper', 'paper', 'pp-paper', v.paper, 'Paper 1, HL…', 60)) +
      grp(rPill('Your score', 'number', 'score', 'pp-score', v.score === '' ? '' : String(v.score), ' min="0" max="1000" step="0.5" inputmode="decimal"') +
          rPill('Out of', 'number', 'max', 'pp-max', v.max === '' ? '' : String(v.max), ' min="1" max="1000" step="0.5" inputmode="decimal"') +
          rPill('Done on', 'date', 'date', 'pp-date', v.date), '', 'Use the markscheme total for “Out of”.');
    openDialog({
      title: x ? 'Edit Paper' : 'Log a Paper', body: body, submitLabel: x ? 'Save' : 'Add', back: openPapers, backLabel: 'Papers',
      danger: x ? { label: 'Delete Paper', act: 'paper-delete', id: x.id } : null,
      onSubmit: function (fd) {
        var score = parseFloat(String(fd.get('score') || '').replace(',', '.')), max = parseFloat(String(fd.get('max') || '').replace(',', '.'));
        if (!(score >= 0)) { fieldError('#pp-score', 'Enter your score.'); return false; }
        if (!(max > 0 && max <= 1000)) { fieldError('#pp-max', 'Enter the total marks.'); return false; }
        if (score > max) { fieldError('#pp-score', 'Your score can’t be above the total.'); return false; }
        var data = {
          subject: subj(fd.get('subject')) ? fd.get('subject') : null,
          session: SESSIONS[fd.get('session')] ? fd.get('session') : '',
          year: parseInt(fd.get('year'), 10) || null,
          paper: clip(fd.get('paper'), 60),
          score: Math.round(score * 10) / 10, max: Math.round(max * 10) / 10,
          date: DATE.test(fd.get('date')) ? fd.get('date') : today()
        };
        if (x) Object.assign(x, data); else S.papers.push(Object.assign({ id: uid('pp') }, data));
        UI.paperSubject = data.subject || ''; saveUI();
        save(); render();
        openPapers();
        toast(x ? 'Paper saved' : 'Paper logged');
        return false;
      }
    });
  }

  function openFocusLen() {
    curSheet = openFocusLen;
    openDialog({
      title: 'Timer Length', submitLabel: 'Set',
      body: grp(rPill('Minutes', 'number', 'minutes', 'fl-min', String(UI.focusLen), ' min="5" max="180" step="5" inputmode="numeric" autofocus'), '', 'Anything from 5 to 180 minutes.'),
      onSubmit: function (fd) {
        var m = parseInt(fd.get('minutes'), 10);
        if (!(m >= 5 && m <= 180)) { fieldError('#fl-min', 'Pick between 5 and 180 minutes.'); return false; }
        UI.focusLen = m; UI.focusUp = false; saveUI(); render();
      }
    });
  }

  /* ---------- Admin (Mauro) ---------- */
  var ADMIN_LIST = null, ADMIN_OTHERS = [], RESET_CODES = {};
  function ago(ms) {
    if (!ms) return 'never';
    var d = new Date(ms), n = diff(toISO(d), toISO(new Date()));
    if (n <= 0) return 'today';
    if (n === 1) return 'yesterday';
    if (n < 30) return n + ' days ago';
    return fShort(toISO(d)) + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '');
  }
  function kb(n) { return n < 1024 ? n + ' B' : Math.round(n / 1024) + ' KB'; }
  function sheetMessage(html) { var b = $('.sheet-body', dlg); if (b) b.innerHTML = html; }
  function openAdmin() {
    curSheet = openAdmin;
    openDialog({ title: 'Accounts', body: '<div class="sheet-loading" role="status"><span class="spinner" aria-hidden="true"></span><span class="sr">Loading</span></div>', back: openSettings, backLabel: 'Settings' });
    api('GET', '/api/admin/users').then(function (r) {
      if (curSheet !== openAdmin) return;
      if (r.status === 401) return sessionLost();
      if (r.status !== 200 || !r.data || !Array.isArray(r.data.users)) return sheetMessage('<p class="group-foot err">Couldn’t load the accounts. Try again.</p>');
      ADMIN_LIST = r.data.users; ADMIN_OTHERS = Array.isArray(r.data.others) ? r.data.others : [];
      sheetMessage(adminListHTML());
    }, function () { if (curSheet === openAdmin) sheetMessage('<p class="group-foot err">Can’t reach Bloc. Check your connection.</p>'); });
  }
  function adminRow(u) {
    var st = u.admin ? 'You' : u.reset ? (u.last_login ? 'Waiting for reset code' : 'Waiting for setup code') : !u.claimed ? 'No password yet' : 'Last login ' + ago(u.last_login);
    var free = u.kind === 'free';
    return '<button type="button" class="row row-btn acct-row" data-act="admin-user" data-id="' + esc(u.id) + '"' + (free ? ' data-find="' + esc(norm(u.name + ' ' + u.id)) + '"' : '') + '>' + avatar(u.id, u.name, '', u.avatar) +
      '<span class="two-line"><b>' + esc(u.name) + '</b><span>' + esc((free ? '@' + u.id + ' · ' : '') + st) + '</span></span>' +
      (u.plus && !u.admin ? '<span class="tag-plus">Plus</span>' : '') + icon('chev') + '</button>';
  }
  function adminListHTML() {
    var claimed = ADMIN_LIST.filter(function (u) { return u.claimed; }).length, n = ADMIN_OTHERS.length;
    var find = n > 8 ? '<label class="row adm-find"><span class="sr">Find a student</span><input class="row-field" type="search" id="adm-q" placeholder="Find by name or username" autocomplete="off" autocapitalize="off" spellcheck="false"></label>' : '';
    return grp(ADMIN_LIST.map(adminRow).join(''), 'Sociales 2 IB · ' + claimed + ' of ' + ADMIN_LIST.length + ' set up',
        'Tap a name to download or restore their planner, reset their password or give them Plus.') +
      (n ? grp(find + ADMIN_OTHERS.map(adminRow).join(''), 'Other students · ' + n,
        'Free accounts made with “I’m not in Sociales 2 IB”, latest login first. If one pays by Bizum, tap them and Give Plus.')
         : '<p class="group-head">Other students</p><p class="group-foot">Nobody from outside the class has an account yet. They make one on the login screen with “I’m not in Sociales 2 IB”.</p>');
  }
  function filterAdmin(q) {
    q = norm(q.trim());
    $$('.acct-row[data-find]', dlg).forEach(function (b) { b.hidden = !!q && b.dataset.find.indexOf(q) < 0; });
  }
  function adminUser(id) { return (ADMIN_LIST || []).concat(ADMIN_OTHERS).filter(function (x) { return x.id === id; })[0] || null; }
  function reloadAdmin(id) {
    return api('GET', '/api/admin/users').then(function (r) {
      if (r.status === 200 && r.data && Array.isArray(r.data.users)) { ADMIN_LIST = r.data.users; ADMIN_OTHERS = Array.isArray(r.data.others) ? r.data.others : []; }
      if (dlg.open && id) openAdminUser(id);
    });
  }
  function openAdminUser(id) {
    var u = adminUser(id);
    if (!u) return;
    curSheet = function () { openAdminUser(id); };
    var free = u.kind === 'free';
    var plusTxt = u.plus === 'admin' ? 'Owner' : u.plus === 'class' ? 'Class code' : u.plus === 'gift' ? 'Given by you' : 'Off';
    var codeWord = u.last_login ? 'reset code' : 'setup code';
    var info =
      (free ? '<div class="row"><span class="row-label">Username</span><span class="row-value">@' + esc(u.id) + '</span></div>' +
              '<div class="row"><span class="row-label">Account made</span><span class="row-value">' + esc(u.created_at ? ago(u.created_at) : 'Unknown') + '</span></div>' : '') +
      '<div class="row"><span class="row-label">Password</span><span class="row-value">' + (u.claimed ? 'Set' : u.reset ? 'Waiting for ' + codeWord : 'Not set yet') + '</span></div>' +
      '<div class="row"><span class="row-label">Last login</span><span class="row-value">' + esc(u.last_login ? ago(u.last_login) : 'Never') + '</span></div>' +
      '<div class="row"><span class="row-label">Planner saved</span><span class="row-value">' + esc(u.updated_at ? ago(u.updated_at) + ' · ' + kb(u.size) : 'Nothing yet') + '</span></div>' +
      '<div class="row"><span class="row-label">Siri</span><span class="row-value">' + esc(u.siri == null ? 'Not set up' : u.siri ? 'Used ' + ago(u.siri) : 'Key made, not used yet') + '</span></div>' +
      '<div class="row"><span class="row-label">Bloc Plus</span><span class="row-value">' + esc(plusTxt) + '</span></div>' +
      (u.assist ? '<div class="row"><span class="row-label">Assistant</span><span class="row-value">' + esc(u.assist.today + ' message' + (u.assist.today === 1 ? '' : 's') + (u.assist.photos ? ', ' + u.assist.photos + ' photo' + (u.assist.photos === 1 ? '' : 's') : '') + ' today' + (u.assist.extra ? ' · extra messages' : '')) + '</span></div>' : '');
    var d = ' data-id="' + esc(u.id) + '"', code = RESET_CODES[u.id];
    var body = (u.avatar ? '<div class="pfp-hero">' + avatar(u.id, u.name, 'xxl', u.avatar) + '</div>' +
        grp(rButton('Remove Photo', 'admin-pfp-remove', d, 'danger'), '', 'Takes the photo down for everyone. ' + esc(u.name) + ' can upload a new one.') : '') +
      grp(info) +
      (code && u.reset ? grp('<div class="row"><span class="row-label">' + (u.last_login ? 'Reset code' : 'Setup code') + '</span><span class="row-value reset-code">' + esc(code) + '</span></div>' +
          rButton(icon('copy') + 'Copy Code', 'admin-copy-code', d), 'Give this to ' + esc(u.name),
          (free ? 'They tap “I’m not in Sociales 2 IB”, then Log In with @' + esc(u.id) + '. Bloc asks for this code and a new password.'
                : 'They pick their name, type this code and make a new password.') + ' It works once. Only you can see it, and only until you close Bloc.') : '') +
      grp((u.updated_at ? rButton(icon('download') + 'Download Planner', 'admin-export', d) : '') +
          rButton(icon('upload') + 'Restore From File', 'admin-import', d) +
          '<input type="file" id="admin-file" accept="application/json,.json" hidden' + d + '>', 'Planner',
          'Download saves their planner as a file you can send them; they open it with Settings → Import Backup. Restore puts a backup file back into their account.') +
      (u.admin ? '' :
        grp(rButton(icon('star') + (u.plus ? 'Remove Plus' : 'Give Plus'), 'admin-plus', d + ' data-on="' + (u.plus ? '0' : '1') + '"')) +
        (u.assist ? grp(rButton(icon('spark') + (u.assist.extra ? 'Remove Extra Messages' : 'Give Extra Messages'), 'admin-assist-extra', d + ' data-on="' + (u.assist.extra ? '0' : '1') + '"'), '',
          u.assist.extra ? esc(u.name) + ' gets the higher daily limit for the assistant.' : 'Only after they’ve paid: the assistant’s higher daily limit (set it in Settings → AI Assistant). Bloc Plus alone doesn’t change it.') : '') +
        (u.claimed ? grp(rButton(icon('chat') + (u.chat_off ? 'Turn On Chat' : 'Turn Off Chat'), 'admin-chat', d + ' data-off="' + (u.chat_off ? '0' : '1') + '"', u.chat_off ? '' : 'danger-text'), '',
          u.chat_off ? 'Chat is off: ' + esc(u.name) + ' can read chats but can’t send messages or start chats.' : 'Stops ' + esc(u.name) + ' from sending messages or starting chats. They can still read them.') : '') +
        (u.claimed || u.reset ?
          grp((u.claimed ? rButton('Reset Password', 'admin-reset', d, 'danger') : rButton('Make a New Code', 'admin-reset', d, 'danger')) +
              (u.updated_at ? rButton('Erase Planner', 'admin-erase', d, 'danger') : ''), '',
            'Reset Password logs ' + esc(u.name) + ' out and gives you a one-time code, so only they can make the new password. The planner stays.' +
            (u.updated_at ? ' Erase Planner deletes the saved planner for good and logs them out.' : ''))
        : grp(rButton(icon('key') + 'Make a Setup Code', 'admin-reset', d), 'Before they sign up',
            'Anyone who picks a name first can set its password. A setup code makes sure only ' + esc(u.name) + ' can: give it to them and they type it when they make their password.')) +
        (free ? grp(rButton('Delete Account', 'admin-delete', d, 'danger'), '', 'Deletes @' + esc(u.id) + ', their planner and their logins for good. The username becomes free again.') : ''));
    openDialog({ title: u.name, body: body, back: openAdmin, backLabel: 'Accounts' });
  }
  function adminImportFile(input) {
    var file = input.files && input.files[0], id = input.dataset.id;
    if (!file || !id) return;
    var btn = $('[data-act="admin-import"]', dlg);
    if (file.size > 5e6) { input.value = ''; toast('That file is too big to be a planner backup'); return; }
    var reader = new FileReader();
    reader.onload = function () {
      input.value = '';
      var obj;
      try { obj = JSON.parse(String(reader.result)); } catch (e) { toast('That file isn’t a Bloc backup'); return; }
      var data = obj && (obj.app === 'myib' || obj.app === 'ib-planner') && obj.data ? obj.data : obj;
      if (!data || !Array.isArray(data.subjects) || !Array.isArray(data.events) || !Array.isArray(data.periods)) { toast('That file isn’t a Bloc backup'); return; }
      api('PUT', '/api/admin/import', { user: id, data: sanitize(data) }).then(function (r) {
        if (r.status === 200) { flash(btn, 'Restored'); reloadAdmin(null); }
        else toast('Couldn’t restore it (error ' + r.status + ')');
      }, function () { toast('Can’t reach Bloc. Check your connection.'); });
    };
    reader.onerror = function () { input.value = ''; toast('Could not read that file'); };
    reader.readAsText(file);
  }

  function openBizum() {
    curSheet = openBizum;
    openDialog({
      title: 'Bizum Number', submitLabel: 'Save', back: openSettings, backLabel: 'Settings',
      body: grp(rText('Number', 'bizum', 'bz-num', CONF.bizum || '', '612 345 678', 20, ' inputmode="tel" autocomplete="off"'), '',
        'Shows in the Support the Dev pop-up and on the Plus sheet, for your class and for students outside it. Leave it empty to hide it.'),
      onSubmit: function (fd, form) {
        var v = clip(fd.get('bizum'), 20);
        if (v && !/^\+?[0-9 ]{6,20}$/.test(v)) { fieldError('#bz-num', 'Use digits only, like 612 345 678.'); return false; }
        if (busyForm(form, true)) return false;
        api('POST', '/api/admin/config', { bizum: v }).then(function (r) {
          busyForm(form, false);
          if (r.status === 200 && r.data) { setConf(Object.assign({ cal: CONF.cal }, r.data)); writeCache(); openSettings(); toast(CONF.bizum ? 'Bizum number saved' : 'Bizum number removed'); }
          else fieldError('#bz-num', 'Couldn’t save it. Try again.');
        }, function () { busyForm(form, false); fieldError('#bz-num', 'Can’t reach Bloc. Check your connection.'); });
        return false;
      }
    });
  }

  /* =========================================================
     Siri: "Hey Siri, add to Bloc". The Add to Bloc Shortcut talks to POST /api/siri/talk with
     the account's personal key (Settings → Connect Siri): Siri asks what, which day, what time
     and how long, and the task lands on the hourly plan. The key can only add tasks; the server
     reads the timetable to ask good questions. Mauro pastes the Shortcut's iCloud link in
     Settings → Admin, and the tutorial walks students through it the first time they open Connect Siri.
     ========================================================= */
  var SIRI_LINK = /^https:\/\/www\.icloud\.com\/shortcuts\/[0-9a-f]{32}$/i;
  var SIRI_NAME = 'Add to Bloc';       /* the Shortcut's name: students say "Hey Siri, add to Bloc" */
  var SIRI = siriBlank();
  function siriBlank() { return { data: null, busy: false, err: '', step: 0, test: null }; }
  function siriFresh() { SIRI = siriBlank(); }
  function onIPhone() { var ua = navigator.userAgent || ''; return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1); }
  function siriGuideSeen() { return !!(ME && sget('myib:siriguide:' + ME.id)); }
  function siriRunUrl() { return 'shortcuts://open-shortcut?name=' + encodeURIComponent(SIRI_NAME); }
  /* the language Siri starts in: this phone's, until the student picks one */
  function phoneLang() { return /^es\b/i.test(navigator.language || '') ? 'es' : 'en'; }
  function firstName() { return String((ME && ME.name) || '').trim().split(/\s+/)[0]; }

  /* your key: loaded when Connect Siri opens, made the first time (make = true) */
  function siriLoad(make) {
    if (SIRI.busy) return Promise.resolve(SIRI.data);
    SIRI.busy = true; SIRI.err = '';
    return api('GET', '/api/siri').then(function (r) {
      if (make && r.status === 200 && r.data && !r.data.key && !r.data.lost) return api('POST', '/api/siri/key', { lang: phoneLang() });
      return r;
    }).then(function (r) {
      SIRI.busy = false;
      if (r.status === 200 && r.data) { SIRI.data = r.data; return SIRI.data; }
      if (r.status === 401) { sessionLost(); return null; }
      SIRI.err = r.status === 503 && r.data && r.data.error === 'siri_setup' ? 'setup' : r.status === 429 ? 'slow' : 'server';
      return null;
    }, function () { SIRI.busy = false; SIRI.err = 'offline'; return null; });
  }
  function siriNewKey() {
    return api('POST', '/api/siri/key', { lang: phoneLang() }).then(function (r) {
      if (r.status === 200 && r.data && r.data.key) { SIRI.data = r.data; SIRI.err = ''; return true; }
      if (r.status === 401) sessionLost();
      SIRI.err = r.status === 503 ? 'setup' : r.status === 429 ? 'slow' : 'server';
      return false;
    }, function () { SIRI.err = 'offline'; return false; });
  }
  function siriErrText() {
    if (SIRI.err === 'setup') return ME && ME.admin ? 'Siri is off on the server: add the API_KEY_SECRET secret in Cloudflare, then upload Bloc again.' : 'Siri isn’t switched on yet. Mauro is still setting it up.';
    if (SIRI.err === 'offline') return 'Can’t reach Bloc. Check your connection.';
    if (SIRI.err === 'slow') return 'Too many new keys in a short time. Try again in an hour.';
    return 'Couldn’t load your key. Try again.';
  }
  function siriGroup() {
    var d = SIRI.data;
    return grp(rNav('mic', 'Connect Siri', 'siri-open', d && d.key ? (d.used ? 'On' : 'Key ready') : ''), '',
      'Add tasks from your iPhone without opening ' + BRAND + ': say “Hey Siri, add to Bloc” and answer a few quick questions.');
  }
  function siriLinkRow(cls) {
    return CONF.siri ? '<a class="' + (cls || 'row row-btn nav-row') + '" href="' + esc(CONF.siri) + '" target="_blank" rel="noopener noreferrer">' + icon('download') + '<span class="row-label">Get the Shortcut</span>' + icon('out') + '</a>' : '';
  }

  /* Settings → Connect Siri. The first time, the tutorial opens instead. */
  function openSiri() {
    if (!siriGuideSeen()) { sset('myib:siriguide:' + ME.id, '1'); openSiriGuide(0); return; }
    curSheet = openSiri;
    openDialog({ title: 'Connect Siri', back: openSettings, backLabel: 'Settings', body: siriBody() });
    if (!SIRI.data && !SIRI.busy) siriLoad(true).then(siriRepaint);
  }
  function siriRepaint() { if (curSheet === openSiri) sheetMessage(siriBody()); }
  function siriBody() {
    var d = SIRI.data, keyRows, foot = '';
    if (!d && (SIRI.busy || !SIRI.err)) keyRows = '<div class="sheet-loading" role="status"><span class="spinner" aria-hidden="true"></span><span class="sr">Loading your key</span></div>';
    else if (!d) keyRows = '<div class="row"><span class="siri-err">' + esc(siriErrText()) + '</span></div>' + rButton(icon('refresh') + 'Try Again', 'siri-retry');
    else if (!d.key) keyRows = '<div class="row"><span class="siri-msg">Your key can’t be shown any more. It still works; make a new one if you need to paste it again.</span></div>' +
      rButton(icon('refresh') + 'Make a New Key', 'siri-new');
    else {
      keyRows = '<div class="row siri-keyrow"><code class="siri-key">' + esc(d.key) + '</code></div>' +
        rButton(icon('copy') + 'Copy Key', 'siri-copy', '', 'strong') + rButton(icon('refresh') + 'Make a New Key', 'siri-new', '', 'danger-text');
      foot = ' ' + (d.used ? 'Siri last added a task ' + esc(ago(d.used)) + '.' : 'Siri hasn’t used it yet.');
    }
    var shortcut = siriLinkRow() || '<div class="row"><span class="siri-msg">' + (ME.admin ? 'Add the Shortcut link in Settings → Admin → Siri Shortcut.' : 'The Shortcut isn’t ready yet. Mauro is still setting it up.') + '</span></div>';
    var lang = d && d.lang === 'es' ? 'es' : d && d.lang === 'en' ? 'en' : '';
    var langRow = d && d.key ? grp('<div class="row wrap"><span class="row-label">Siri speaks</span><span class="row-value"><span class="seg" role="group" aria-label="Siri speaks">' +
        [['en', 'English'], ['es', 'Español']].map(function (o) {
          return '<button type="button" data-act="siri-lang" data-lang="' + o[0] + '" aria-pressed="' + (lang === o[0]) + '">' + o[1] + '</button>';
        }).join('') + '</span></span></div>', '', 'The language Siri greets you in. After that, Siri answers in the language you speak.') : '';
    return '<div class="plus-hero"><span class="siri-badge" aria-hidden="true">' + icon('mic') + '</span><h3>Add tasks with Siri</h3>' +
        '<p>Say “Hey Siri, add to Bloc”. Siri asks what, which day, what time and how long, and the task lands on your calendar’s hourly plan, even when ' + BRAND + ' is closed.</p></div>' +
      grp(keyRows, 'Your key', 'Your key works like a password just for Siri. It can add tasks to your planner, and it lets Siri check your timetable so it can warn you about a class. Nothing else. Don’t share it.' + foot) +
      langRow +
      grp(shortcut + rNav('bulb', 'How to Set It Up', 'siri-guide'), 'The Shortcut', CONF.siri ? 'Copy your key first: Shortcuts asks for it when you add the Shortcut.' : '');
  }

  /* ---------- the tutorial: one step per screen ---------- */
  function mkPhone(inner, cls) { return '<div class="mk-phone' + (cls ? ' ' + cls : '') + '"><span class="mk-island"></span><div class="mk-screen">' + inner + '</div></div>'; }
  function mkTap(inner, cls) { return '<span class="mk-tap' + (cls ? ' ' + cls : '') + '">' + inner + '</span>'; }
  function mkGlow() { return '<span class="mk-glow"></span>'; }
  function siriSteps() {
    var link = CONF.siri, key = '<span class="mk-key">bloc_7Kq2…x9Fa</span>', name = firstName();
    return [
      { title: 'Add tasks with your voice',
        pic: mkPhone('<span class="mk-bubble me">Hey Siri, add to Bloc</span><span class="mk-bubble siri">Hey' + (name ? ' ' + esc(name) : '') + '! What do you need to do?</span><span class="mk-bubble me">Buy notebooks for tomorrow</span><span class="mk-bubble siri">Got it. What time?</span>' + mkGlow(), 'chat'),
        text: '<p>Say “Hey Siri, add to Bloc” and talk to it like a friend. Siri asks what, which day and what time, and the task lands on your calendar’s hourly plan. Setting it up takes about 2 minutes.</p>' +
          (onIPhone() ? '' : '<p class="sg-note">You’re not on an iPhone right now. Open ' + BRAND + ' on your iPhone and go to Settings → Connect Siri.</p>') },
      { title: 'Copy your key',
        pic: mkPhone('<b class="mk-head">Connect Siri</b><span class="mk-card">' + key + '</span>' + mkTap('<span class="mk-btn">Copy Key</span>')),
        text: '<p>Your key is like a password just for Siri. It lets the Shortcut add tasks to your ' + BRAND + ', and nothing else. Don’t share it.</p>',
        act: '<div class="sg-keybox" id="sg-key">' + siriKeyHTML() + '</div>' },
      { title: 'Get the Shortcut',
        pic: mkPhone('<b class="mk-head">Connect Siri</b><span class="mk-card mk-rows"><span class="mk-row">Copy Key</span>' + mkTap('<span class="mk-row mk-accent">Get the Shortcut ↗</span>', 'wide') + '<span class="mk-row">How to Set It Up</span></span>'),
        text: '<p>Tap the button below. Your iPhone opens the Shortcuts app with “Add to Bloc”. If a web page opens instead, tap <b>Get Shortcut</b> there.</p>' +
          '<p class="sg-note">No Shortcuts app? Get it free from the App Store.</p>',
        act: link ? siriLinkRow('btn primary sg-btn') : '<p class="sg-note err">The Shortcut isn’t ready yet. ' + (ME.admin ? 'Add its link in Settings → Admin → Siri Shortcut.' : 'Mauro is still setting it up.') + '</p>' },
      { title: 'Tap “Set Up Shortcut”',
        pic: mkPhone('<span class="mk-sheet"><span class="mk-tile">' + icon('mic') + '</span><b class="mk-name">Add to Bloc</b><span class="mk-sub">Shortcut</span>' + mkTap('<span class="mk-btn big">Set Up Shortcut</span>', 'wide') + '</span>'),
        text: '<p>You’ll see “Add to Bloc” with a big button under it. Tap <b>Set Up Shortcut</b>. On some iPhones it says <b>Add Shortcut</b>.</p>' },
      { title: 'Paste your key',
        pic: mkPhone('<span class="mk-sheet"><b class="mk-q">Paste your Bloc key</b><span class="mk-callout">Paste</span>' + mkTap('<span class="mk-field">bloc_7Kq2…x9Fa</span>', 'wide') + '<span class="mk-btn big">Add Shortcut</span></span>'),
        text: '<p>Shortcuts asks for your Bloc key. Tap the box, tap <b>Paste</b>, then tap <b>Add Shortcut</b>.</p>' },
      { title: 'Turn on Siri',
        pic: mkPhone('<b class="mk-head">Talk &amp; Type to Siri</b><span class="mk-card mk-rows">' + mkTap('<span class="mk-row">“Siri” or “Hey Siri”<i class="mk-check">' + icon('check') + '</i></span>', 'wide') + '<span class="mk-row">“Hey Siri”</span><span class="mk-row">Off</span></span>'),
        text: '<p>Open the Settings app and tap <b>Apple Intelligence &amp; Siri</b> (on some iPhones it’s just <b>Siri</b>). Tap <b>Talk &amp; Type to Siri</b> and pick “Siri” or “Hey Siri”.</p><p class="sg-note">Already talk to Siri? Skip this step.</p>' },
      { title: 'Tap “Always Allow”',
        pic: mkPhone('<span class="mk-dim"></span><span class="mk-alert"><b>Allow “Add to Bloc” to connect to myib.app?</b><span class="mk-ab">Allow Once</span>' + mkTap('<span class="mk-ab strong">Always Allow</span>', 'wide') + '<span class="mk-ab">Don’t Allow</span></span>'),
        text: '<p>The first time you use it, your iPhone asks if Add to Bloc can connect to myib.app. Tap <b>Always Allow</b> so it doesn’t ask again.</p>' },
      { title: 'Try it',
        pic: mkPhone('<span class="mk-bubble siri">What do you need to do?</span><span class="mk-bubble me">Study for the history test</span><span class="mk-bubble siri">Got it. When do you need to do it?</span>' +
          '<span class="mk-bubble me">Tomorrow after school</span><span class="mk-bubble siri">How long will it take?</span><span class="mk-bubble me">About an hour</span><span class="mk-bubble siri">Done! It’s on your plan for tomorrow at 4 pm.</span>' + mkGlow(), 'tall chat'),
        text: '<p>Say “Hey Siri, add to Bloc” and answer Siri’s questions the way you’d tell a friend: “tomorrow after school”, “around 5”, “about an hour”. Say it all at once and Siri skips the questions.</p>' +
          '<p class="sg-note">Siri knows your timetable: it warns you if there’s a class at that time and can find you a free gap (“when I’m free”). Say “no time” to skip a question or “cancel” to stop. Spanish works too: “mañana después de clase”.</p>' },
      { title: 'If it doesn’t work',
        pic: '<span class="mk-trio"><span>' + icon('key') + '<b>Wrong key</b></span><span>' + icon('nowifi') + '<b>No internet</b></span><span>' + icon('chat') + '<b>Siri didn’t get it</b></span></span>',
        text: '<ul class="sg-list">' +
          '<li><b>Siri says your key didn’t work.</b> Go back to “Copy your key” and copy it again. Then open the Shortcut, paste the key into the box at the top and tap Done.</li>' +
          '<li><b>No internet.</b> Siri needs Wi‑Fi or mobile data to reach ' + BRAND + '. Try again once you’re online.</li>' +
          '<li><b>Siri doesn’t get “add to Bloc”.</b> Check that the Shortcut is called Add to Bloc in the Shortcuts app, and say it clearly. Still stuck? Rename it to something like “Bloc task” and say “Hey Siri, Bloc task”.</li>' +
          '<li><b>You tapped Don’t Allow.</b> In Shortcuts, tap ••• on Add to Bloc, tap ⓘ, then Privacy, then Reset Privacy. Try again and tap Always Allow.</li>' +
          '<li><b>Siri got a detail wrong.</b> Say “cancel” and start again, or open ' + BRAND + ' and tap the task to fix it.</li></ul>',
        act: onIPhone() ? '<a class="btn sg-btn" href="' + esc(siriRunUrl()) + '">' + icon('out') + 'Open the Shortcut</a>' : '' },
      { title: 'Send a test task',
        pic: mkPhone('<b class="mk-head">Today</b><span class="mk-card mk-rows"><span class="mk-row mk-task"><i class="mk-box"></i>Read chapter 4</span><span class="mk-row mk-task mk-new"><i class="mk-box"></i>Test task from the Siri setup</span></span>'),
        text: '<p>Check that everything works. ' + BRAND + ' adds a sample task to Today with your key, the same way Siri does.</p>',
        act: '<button type="button" class="btn primary sg-btn" data-act="sg-test">' + icon('check') + 'Send a Test Task</button><div class="sg-result" id="sg-test" role="status" aria-live="polite"></div>' }
    ];
  }
  function siriKeyHTML() {
    var d = SIRI.data;
    if (d && d.key) return '<code class="siri-key">' + esc(d.key) + '</code><button type="button" class="btn primary sg-btn" data-act="sg-copy">' + icon('copy') + 'Copy My Key</button>';
    if (d && d.lost) return '<p class="sg-note">Your old key can’t be shown any more. Make a new one, then paste it into the Shortcut.</p><button type="button" class="btn primary sg-btn" data-act="sg-newkey">' + icon('refresh') + 'Make a New Key</button>';
    if (SIRI.err && !SIRI.busy) return '<p class="sg-note err">' + esc(siriErrText()) + '</p><button type="button" class="btn sg-btn" data-act="sg-retry">' + icon('refresh') + 'Try Again</button>';
    return '<span class="spinner" aria-hidden="true"></span><span class="sr">Loading your key</span>';
  }
  function siriKeyPaint() { var b = $('#sg-key', dlg); if (b) b.innerHTML = siriKeyHTML(); }

  function openSiriGuide(step) {
    curSheet = function () { openSiriGuide(SIRI.step); };
    SIRI.test = null;
    var steps = siriSteps(), at = Math.max(0, Math.min(steps.length - 1, step || 0));
    SIRI.step = at;
    openDialog({
      title: 'Set Up Siri', back: openSiri, backLabel: 'Siri', doneLabel: 'Close',
      body: '<div class="sg">' + steps.map(function (s, i) {
          return '<section class="sg-step" id="sg-' + i + '"' + (i === at ? '' : ' hidden') + ' aria-labelledby="sg-h-' + i + '">' +
            '<figure class="sg-pic" aria-hidden="true">' + s.pic + '</figure>' +
            '<p class="sg-count">Step ' + (i + 1) + ' of ' + steps.length + '</p>' +
            '<h3 class="sg-title" id="sg-h-' + i + '" tabindex="-1">' + s.title + '</h3>' +
            '<div class="sg-text">' + s.text + '</div>' + (s.act || '') + '</section>';
        }).join('') +
        '<nav class="sg-nav" aria-label="Tutorial steps">' +
          '<button type="button" class="btn" data-act="sg-prev">' + icon('left') + 'Back</button>' +
          '<span class="sg-dots">' + steps.map(function (s, i) {
            return '<button type="button" class="sg-dot" data-act="sg-go" data-i="' + i + '" aria-label="Step ' + (i + 1) + ': ' + esc(s.title.replace(/[“”]/g, '')) + '"></button>';
          }).join('') + '</span>' +
          '<button type="button" class="btn primary" data-act="sg-next"></button>' +
        '</nav></div>'
    });
    /* Back, the dots and Next sit under the scrolling steps, so they never cover a button */
    var nav = $('.sg-nav', dlg), sheetEl = $('.sheet', dlg);
    if (nav && sheetEl) sheetEl.appendChild(nav);
    siriStepShow(at, false);
    if (!SIRI.data && !SIRI.busy) siriLoad(true).then(siriKeyPaint);
  }
  function siriStepShow(i, focus) {
    var secs = $$('.sg-step', dlg), n = secs.length;
    if (!n) return;
    i = Math.max(0, Math.min(n - 1, i));
    var dir = i >= SIRI.step ? 'in-r' : 'in-l', moved = i !== SIRI.step;
    SIRI.step = i;
    secs.forEach(function (sec, j) {
      sec.hidden = j !== i;
      sec.classList.remove('in-r', 'in-l');
      if (j === i && moved) { void sec.offsetWidth; sec.classList.add(dir); }
    });
    $$('.sg-dot', dlg).forEach(function (d, j) { if (j === i) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current'); });
    var prev = $('[data-act="sg-prev"]', dlg), next = $('[data-act="sg-next"]', dlg);
    if (prev) prev.disabled = i === 0;
    if (next) next.innerHTML = i === n - 1 ? 'Finish' : 'Next' + icon('right');
    var body = $('.sheet-body', dlg);
    if (body) body.scrollTop = 0;
    if (focus) { var h = $('#sg-h-' + i, dlg); if (h) h.focus({ preventScroll: true }); }
  }
  function siriGuideDone() {
    var added = SIRI.test && SIRI.test.ok;
    closeDialog();
    if (added) { go('today'); setTimeout(pull, 60); }
  }
  /* the last step: add a sample task through POST /api/tasks with the key, without the login cookie */
  function siriTest(el) {
    function show(html) { var b = $('#sg-test', dlg); if (b) { b.innerHTML = html; if (html.indexOf('sg-bubble') >= 0) b.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }
    function bubble(ok, text) { return '<div class="sg-bubble ' + (ok ? 'ok' : 'bad') + '">' + icon(ok ? 'check' : 'x') + '<span>' + esc(text) + '</span></div>'; }
    function done() { el.disabled = false; el.classList.remove('busy'); }
    function run(key) {
      show('<span class="spinner" aria-hidden="true"></span><span class="sr">Sending</span>');
      var ctrl = typeof AbortController === 'function' ? new AbortController() : null, timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 15000) : null;
      fetch('/api/tasks?format=json', {
        method: 'POST', credentials: 'omit', cache: 'no-store', signal: ctrl ? ctrl.signal : undefined,
        headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ text: 'Test task from the Siri setup today', today: today(), test: true })
      }).then(function (res) {
        return res.json().then(function (d) { return { status: res.status, d: d }; }, function () { return { status: res.status, d: null }; });
      }).then(function (r) {
        clearTimeout(timer); done();
        if (r.status === 201 && r.d && r.d.ok) {
          SIRI.test = { ok: true };
          show(bubble(true, r.d.say) + '<p class="sg-note">It works. The test task is in Today, and you can delete it there.</p>' +
            '<button type="button" class="btn sg-btn" data-act="sg-today">' + icon('today') + 'See It in Today</button>');
        } else show(bubble(false, (r.d && r.d.say) || 'Bloc couldn’t add the task (error ' + r.status + ').'));
      }, function () { clearTimeout(timer); done(); show(bubble(false, 'Can’t reach Bloc. Check your connection and try again.')); });
    }
    if (el.classList.contains('busy')) return;
    el.disabled = true; el.classList.add('busy');
    if (SIRI.data && SIRI.data.key) { run(SIRI.data.key); return; }
    siriLoad(true).then(function (d) {
      if (d && d.key) { run(d.key); return; }
      done();
      show('<p class="sg-note err">' + esc(d && d.lost ? 'Your key can’t be shown any more. Go back to “Copy your key” and make a new one first.' : siriErrText()) + '</p>');
    });
  }
  /* swipe between steps; arrow keys on a keyboard */
  (function () {
    var sx = 0, sy = 0, on = false;
    dlg.addEventListener('touchstart', function (e) {
      var t = e.touches[0], tg = e.target;
      on = !!(t && e.touches.length === 1 && tg.closest && tg.closest('.sg-step') && !tg.closest('.siri-key, a, button'));
      if (on) { sx = t.clientX; sy = t.clientY; }
    }, { passive: true });
    dlg.addEventListener('touchend', function (e) {
      if (!on) return;
      on = false;
      var t = e.changedTouches[0];
      if (!t) return;
      var dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) siriStepShow(SIRI.step + (dx < 0 ? 1 : -1), false);
    }, { passive: true });
    dlg.addEventListener('keydown', function (e) {
      if ((e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') || !$('.sg', dlg) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      e.preventDefault();
      siriStepShow(SIRI.step + (e.key === 'ArrowRight' ? 1 : -1), true);
    });
  })();

  /* Settings → Admin → Siri Shortcut: the iCloud link students get the Shortcut from */
  function openSiriLink() {
    curSheet = openSiriLink;
    openDialog({
      title: 'Siri Shortcut', submitLabel: 'Save', back: openSettings, backLabel: 'Settings',
      body: grp('<label class="row"><span class="sr">iCloud link</span><input class="row-field" type="url" name="siri" id="sl-link" maxlength="120" value="' + esc(CONF.siri || '') + '"' +
          ' placeholder="https://www.icloud.com/shortcuts/…" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" inputmode="url"></label>', 'iCloud link',
        'In Shortcuts, open Add to Bloc, tap the share button, then Copy iCloud Link, and paste it here. Students get it in Settings → Connect Siri. Leave it empty to hide the button.'),
      onSubmit: function (fd, form) {
        var v = String(fd.get('siri') || '').trim().replace(/\/+$/, '');
        if (v && !SIRI_LINK.test(v)) { fieldError('#sl-link', 'Paste the iCloud link of the Shortcut: https://www.icloud.com/shortcuts/ and 32 letters and numbers.'); return false; }
        if (busyForm(form, true)) return false;
        api('POST', '/api/admin/config', { siri: v }).then(function (r) {
          busyForm(form, false);
          if (r.status === 200 && r.data) { setConf(Object.assign({ cal: CONF.cal }, r.data)); writeCache(); openSettings(); toast(CONF.siri ? 'Shortcut link saved' : 'Shortcut link removed'); }
          else if (r.status === 401) sessionLost();
          else fieldError('#sl-link', 'Couldn’t save it. Try again.');
        }, function () { busyForm(form, false); fieldError('#sl-link', 'Can’t reach Bloc. Check your connection.'); });
        return false;
      }
    });
  }


  /* =========================================================
     The assistant (v5.3): a study chat in a sheet, opened from the sparkle button in the header.
     The last messages stay on this device (myib:assist:<id>) and go with each request: the server keeps nothing.
     The server answers with a reply and, sometimes, changes it suggests. They show as one card with
     Approve and Reject; Approve applies them with the same functions as dragging, the checkbox and the
     timer buttons, then saves like any edit, with Undo in the toast. Nothing changes before Approve.
     ========================================================= */
  var AS = { msgs: [], busy: false, usage: null, ready: true, on: true, loaded: false, admin: null, lastSnap: null, lastCard: null, img: null, imgBusy: false };
  var AS_KEEP = 40, AS_SEND = 10, AS_MAX = 1000;
  /* photos (v5.4): shrunk on this device to 1,400 px and at most about 250 KB before they go (smaller photos cost fewer Neurons); a small copy stays in the chat */
  var AS_IMG_SIDE = 1400, AS_IMG_MAX = 340000, AS_THUMB = 240, AS_THUMBS_KEPT = 8, AS_THUMB_RE = /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/;
  var AS_TRY = ['Quiz me on the Cold War', 'My week feels too packed', 'Start a 25 minute focus session'];
  function assistKey() { return 'myib:assist:' + (ME ? ME.id : ''); }
  /* students see the sparkle when it's on and set up; you see it whenever it's on, so you can check the setup */
  function assistOn() { return !!(ME && CONF.assist && CONF.assist.on && (CONF.assist.ready || ME.admin)); }
  function assistLoad() {
    var d = ME ? sjson(assistKey()) : null;
    AS.msgs = d && d.v === 1 && Array.isArray(d.msgs) ? d.msgs.filter(function (m) { return m && typeof m.text === 'string' && /^(user|assistant|note)$/.test(m.role); }).slice(-AS_KEEP) : [];
    AS.msgs.forEach(function (m) { if (m.img && !(typeof m.img === 'string' && AS_THUMB_RE.test(m.img))) delete m.img; });
    AS.loaded = true;
  }
  function assistSave() {
    if (!ME) return;
    /* only the newest photos keep their small copy; older ones show as "Photo" */
    var keep = AS.msgs.slice(-AS_KEEP), n = 0;
    for (var i = keep.length - 1; i >= 0; i--) if (keep[i].img && ++n > AS_THUMBS_KEPT) delete keep[i].img;
    sset(assistKey(), JSON.stringify({ v: 1, msgs: keep }));
  }
  function assistFresh() { AS = { msgs: [], busy: false, usage: null, ready: true, on: true, loaded: false, admin: null, lastSnap: null, lastCard: null, img: null, imgBusy: false }; }
  function assistUsageLoad() {
    return api('GET', '/api/assist').then(function (r) {
      if (r.status === 200 && r.data) { AS.usage = r.data.usage || null; AS.ready = r.data.ready !== false; AS.on = r.data.on !== false; AS.admin = r.data.admin || null; }
      else if (r.status === 401) sessionLost();
      return r;
    }, function () { return null; });
  }
  function openAssist() {
    if (!assistOn()) return;
    if (!AS.loaded) assistLoad();
    curSheet = openAssist;
    openDialog({ title: 'Assistant', body: '<div class="as-log" id="as-log">' + assistLogHTML() + '</div>', doneLabel: 'Done', wide: true });
    var f = $('form.sheet', dlg);
    f.classList.add('as-sheet');
    var left = $('.sheet-head > span[aria-hidden]', f);
    if (left) left.outerHTML = '<button type="button" class="nav-btn" data-act="assist-clear">New Chat</button>';
    assistClearBtn();
    f.insertAdjacentHTML('beforeend', '<div class="as-foot" id="as-foot">' + assistFootHTML() + '</div>' +
      '<input type="file" id="as-file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*" data-change="assist-file" hidden>');
    assistScroll(true);
    var inp = $('#as-input', dlg);
    if (inp && !coarse.matches) inp.focus();
    assistUsageLoad().then(function () { assistPaint(); });
  }
  function assistOpen() { return dlg.open && curSheet === openAssist && !!$('#as-log', dlg); }
  /* repaint the log and the footer, keeping what's typed */
  function assistPaint(keepScroll) {
    if (!assistOpen()) return;
    var log = $('#as-log', dlg), foot = $('#as-foot', dlg), inp = $('#as-input', dlg);
    var typed = inp ? inp.value : '', focused = inp && document.activeElement === inp;
    log.innerHTML = assistLogHTML();
    foot.innerHTML = assistFootHTML();
    var ni = $('#as-input', dlg);
    if (ni) { ni.value = typed; assistGrow(ni); if (focused) ni.focus(); }
    assistClearBtn();
    if (!keepScroll) assistScroll();
  }
  /* New Chat keeps its place when there's nothing to clear, so the title stays centred */
  function assistClearBtn() {
    var nb = $('[data-act="assist-clear"]', dlg), off = !AS.msgs.length;
    if (!nb) return;
    nb.style.visibility = off ? 'hidden' : '';
    nb.disabled = off;
    if (off) nb.setAttribute('aria-hidden', 'true'); else nb.removeAttribute('aria-hidden');
  }
  function assistScroll(now) {
    var b = $('.sheet-body', dlg);
    if (!b) return;
    var go = function () { b.scrollTop = b.scrollHeight; };
    go(); if (!now) requestAnimationFrame(go);
  }
  function assistGrow(t) { t.style.height = 'auto'; t.style.height = Math.min(140, t.scrollHeight) + 'px'; }
  /* the reply's words: plain text, with **bold** and "- " lists */
  function assistFmt(t) {
    return esc(t).replace(/\*\*([^*\n]{1,200})\*\*/g, '<b>$1</b>').replace(/`([^`\n]{1,120})`/g, '<code>$1</code>').replace(/^[ \t]*[-*•][ \t]+/gm, '• ').replace(/^#{1,4}\s+/gm, '');
  }
  function assistLogHTML() {
    if (!AS.msgs.length) {
      var name = firstName();
      return '<div class="as-hello"><span class="as-badge" aria-hidden="true">' + icon('spark') + '</span>' +
        '<b>Hi' + (name ? ' ' + esc(name) : '') + '! I’m your study assistant.</b>' +
        '<span>Ask me to explain a topic, quiz you or plan your revision. I can also move study blocks, add tasks or start a timer, after you approve.' +
          (assistPhotos().lim > 0 ? ' Send a photo of your timetable, exam dates or notes and I’ll add them or explain them.' : '') + '</span>' +
        '<div class="as-tries">' + AS_TRY.map(function (t) { return '<button type="button" class="as-try" data-act="assist-try" data-text="' + esc(t) + '">' + esc(t) + '</button>'; }).join('') + '</div></div>';
    }
    var h = AS.msgs.map(function (m, i) {
      if (m.role === 'note') return '<p class="msg-note as-note">' + esc(m.text) + '</p>' +
        (m.act === 'extra' && canBuyExtra() ? '<button type="button" class="btn small as-note-btn" data-act="extra-open">' + icon('spark') + 'Get More Messages</button>' : '');
      if (m.role === 'user') return '<div class="msg mine first last"><div class="bubble as-bub' + (m.photo ? ' as-has-photo' : '') + '">' +
        (m.img ? '<img class="as-photo" src="' + esc(m.img) + '" alt="Your photo">' : m.photo ? '<span class="as-photo-gone">' + icon('camera') + 'Photo</span>' : '') +
        (m.text ? '<span class="as-text">' + esc(m.text) + '</span>' : '') + '</div></div>';
      return '<div class="msg first last as-msg"><div class="bubble as-bub">' + assistFmt(m.text) + '</div></div>' + (m.actions && m.actions.length ? assistCardHTML(m, i) : '') +
        (m.skipped && m.skipped.length ? '<p class="msg-note as-note as-skip">' + esc(assistSkipText(m.skipped, !(m.actions && m.actions.length))) + '</p>' : '');
    }).join('');
    if (AS.busy) h += '<div class="msg first last as-msg" aria-label="The assistant is typing"><div class="bubble as-typing"><i></i><i></i><i></i></div></div>';
    return h;
  }
  /* photos today: used and the limit (0 = photos are off) */
  function assistPhotos() {
    var u = AS.usage, A = CONF.assist || {};
    return { used: u && u.photos || 0, lim: u && u.photoLimit != null ? u.photoLimit : A.photos != null ? A.photos : 1 };
  }
  /* the Get More Messages offer: on the website, or in the iPhone app where Apple allows the link, for anyone without extra messages */
  function canBuyExtra() { return !!(ME && CONF.assist && sellHere() && !(AS.usage && AS.usage.extra)); }
  function assistFootHTML() {
    var u = AS.usage, lim = u ? u.limit : (CONF.assist && CONF.assist.limit) || 15, used = u ? u.used : 0;
    var pct = Math.max(0, Math.min(100, Math.round(used / lim * 100))), full = used >= lim;
    var tone = full ? 'full' : used >= lim * 0.8 ? 'warn' : 'ok', ph = assistPhotos(), phFull = ph.lim > 0 && ph.used >= ph.lim;
    var more = !full && (tone === 'warn' || phFull) && canBuyExtra() ? '<button type="button" class="as-get" data-act="extra-open">Get more</button>' : '';
    var bar = '<div class="as-usage ' + tone + '"><span class="as-meter" role="progressbar" aria-label="Messages used today" aria-valuemin="0" aria-valuemax="' + lim + '" aria-valuenow="' + used + '"><i style="width:' + pct + '%"></i></span>' +
      '<span class="as-count">' + used + ' of ' + lim + ' today' + (ph.lim > 0 ? ' · ' + (ph.lim === 1 ? (ph.used ? 'photo used' : '1 photo') : ph.used + ' of ' + ph.lim + ' photos') : '') + (u && u.extra ? ' · extra' : '') + '</span>' + more + '</div>';
    if (!AS.on || !AS.ready) return bar.replace('as-usage', 'as-usage off') + '<p class="as-closed">' + (AS.on ? 'The assistant isn’t set up yet.' + (ME.admin ? ' Add the AI binding in Cloudflare (see the setup doc).' : '') : 'The assistant is switched off right now.') + '</p>';
    if (full) return bar + '<div class="as-closed"><p>You’ve used today’s ' + lim + ' messages. They come back at midnight' + (u && u.resets_at ? ' (in ' + esc(assistIn(u.resets_at)) + ')' : '') + '.</p>' +
      (canBuyExtra() ? '<button type="button" class="btn primary as-upsell" data-act="extra-open">' + icon('spark') + 'Get More Messages</button><span class="as-upsell-note">' + esc(assistExtraLine()) + '</span>' : '') + '</div>';
    var chip = AS.imgBusy ? '<div class="as-chip busy"><span class="spinner" aria-hidden="true"></span><span>Getting the photo ready…</span></div>'
      : AS.img ? '<div class="as-chip">' + (AS.img.thumb ? '<img src="' + esc(AS.img.thumb) + '" alt="">' : icon('camera')) + '<span>Photo ready to send</span>' +
        '<button type="button" class="as-chip-x" data-act="assist-photo-remove" aria-label="Remove the photo"' + (AS.busy ? ' disabled' : '') + '>' + icon('x') + '</button></div>' : '';
    var cam = ph.lim > 0 ? '<button type="button" class="as-cam' + (phFull ? ' used' : '') + '" data-act="assist-photo" aria-label="' + (phFull ? 'Photos used for today' : 'Add a photo') + '"' + (AS.busy || AS.imgBusy || AS.img ? ' disabled' : '') + '>' + icon('camera') + '</button>' : '';
    return bar + chip + '<div class="cm-compose as-compose">' + cam + '<label class="sr" for="as-input">Message the assistant</label>' +
      '<textarea id="as-input" rows="1" maxlength="' + AS_MAX + '" placeholder="' + (AS.img ? 'What should I do with it? (optional)' : 'Ask anything about your studies…') + '" enterkeyhint="send"' + (AS.busy ? ' disabled' : '') + '></textarea>' +
      '<button type="button" class="cm-send" data-act="assist-send" aria-label="Send"' + (AS.busy || AS.imgBusy ? ' disabled' : '') + '>' + icon('up') + '</button></div>';
  }
  function assistExtraLine() {
    var A = CONF.assist || {};
    return (A.extra || 60) + ' messages' + ((A.photosExtra || 0) > 0 ? ' and ' + A.photosExtra + ' photos' : '') + ' a day for ' + euro(A.price || 2) + ' a month';
  }

  /* ---------- photos ---------- */
  function assistPhotoTap() {
    var ph = assistPhotos();
    if (AS.busy || AS.imgBusy || AS.img || ph.lim <= 0) return;
    if (ph.used >= ph.lim) {
      assistNote('That’s today’s ' + (ph.lim === 1 ? 'photo' : ph.lim + ' photos') + '. More come back at midnight.', canBuyExtra() ? 'extra' : null);
      assistSave(); assistPaint();
      return;
    }
    var f = $('#as-file', dlg);
    if (f) f.click();
  }
  function assistImageLoad(file) {
    return new Promise(function (ok, no) {
      if (!file || (file.type && !/^image\//.test(file.type)) || file.size > 30 * 1024 * 1024) { no(new Error('type')); return; }
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); ok(img); };
      img.onerror = function () { URL.revokeObjectURL(url); no(new Error('read')); };
      img.src = url;
    });
  }
  /* a JPEG no longer than side px and no bigger than max characters: lower quality first, then smaller */
  function assistShrink(img, side, max, q0) {
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, out = null;
    if (!w || !h) return null;
    var k = Math.min(1, side / Math.max(w, h));
    for (var tries = 0; tries < 6; tries++) {
      var cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
      var c = document.createElement('canvas'); c.width = cw; c.height = ch;
      var g = c.getContext('2d');
      if (!g) return null;
      g.fillStyle = '#fff'; g.fillRect(0, 0, cw, ch);
      g.drawImage(img, 0, 0, cw, ch);
      for (var q = q0; q >= 0.5; q -= 0.12) { out = c.toDataURL('image/jpeg', q); if (out.length <= max && /^data:image\/jpeg;base64,/.test(out)) return out; }
      k *= 0.75;
    }
    return null;
  }
  function assistPickPhoto(file) {
    if (!file || !assistOpen()) return;
    AS.imgBusy = true; assistPaint(true);
    assistImageLoad(file).then(function (img) {
      var url = assistShrink(img, AS_IMG_SIDE, AS_IMG_MAX, 0.85);
      if (!url) throw new Error('read');
      AS.img = { url: url, thumb: assistShrink(img, AS_THUMB, 40000, 0.7) || '' };
      AS.imgBusy = false; assistPaint();
      var inp = $('#as-input', dlg); if (inp && !coarse.matches) inp.focus();
    }).catch(function () {
      AS.imgBusy = false; assistPaint(true);
      toast('Bloc couldn’t read that photo. Try a screenshot or a JPEG.');
    });
  }
  /* why a change the assistant talked about isn't on a card */
  var AS_WHY = {
    school: 'school dates and classes can’t be changed', repeat: 'repeating tasks can only be ticked off', class: 'study blocks can’t go during a class',
    exam: 'it would move study past its exam or deadline', deadline: 'it would move the task past its deadline', past: 'that day has already gone',
    date: 'Bloc needs a day from today on (up to 60 days ahead, or a year for exams and deadlines)', time: 'times go from 07:00 to 23:00', done: 'it’s already done', missing: 'Bloc couldn’t find that item',
    same: 'it’s already there', subject: 'Bloc couldn’t find that subject', length: 'that length doesn’t work (15 minutes to 4 hours)', kind: 'that change only works on another kind of item',
    timer: 'a timer is already running', many: 'one card holds up to 8 changes (15 from a photo, 70 classes in a timetable)', overlap: 'two classes overlapped, so one was left out', other: 'Bloc couldn’t understand it'
  };
  function assistSkipText(list, none) {
    var why = list.map(function (k) { return AS_WHY[k] || AS_WHY.other; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).slice(0, 2);
    return (none ? 'No change to approve: ' : 'Left out of the card: ') + why.join('; ') + '.';
  }
  function assistIn(ms) {
    var m = Math.max(1, Math.round((ms - Date.now()) / 60000)), h = Math.floor(m / 60);
    return h ? h + ' h ' + (m % 60) + ' min' : m + ' min';
  }

  /* ---------- the change card ---------- */
  function shortWhen(d, at) { return (d === today() ? 'Today' : d === addDays(today(), 1) ? 'Tomorrow' : DAYS[dow(d)] + ' ' + fromISO(d).getDate()) + (at ? ' ' + at : ''); }
  /* what each change does, in words from this device's planner (never the model's own words) */
  function assistDesc(a) {
    var p, x, s;
    if (a.type === 'move' && a.kind === 'plan') {
      p = planById(a.id); if (!p) return null;
      return { ic: 'calendar', text: 'Move ' + planLabel(p) + ': ' + (p.date === a.date ? shortWhen(p.date, p.at) + ' → ' + a.at : shortWhen(p.date, p.at) + ' → ' + shortWhen(a.date, a.at)) };
    }
    if (a.type === 'move') {
      x = taskById(a.id); if (!x || isRep(x) || x.done) return null;
      var from = x.due ? shortWhen(x.due, x.at) : 'No date', to = x.due === a.date && x.at && a.at ? a.at : shortWhen(a.date, a.at);
      return { ic: 'calendar', text: 'Move “' + x.title + '”: ' + from + ' → ' + to + (a.during ? ' (during ' + a.during + ')' : '') };
    }
    if (a.type === 'resize') { p = planById(a.id); if (!p) return null; return { ic: 'updown', text: upFirstWord(planLabel(p)) + ': ' + dur(p.dur) + ' → ' + dur(a.dur) }; }
    if (a.type === 'add_block') { s = subj(a.subject); return { ic: 'plus', text: 'Add a study block: ' + (a.title || (s ? 'Study ' + s.short : 'Study')) + ', ' + shortWhen(a.date, a.at) + '–' + hm(toMin(a.at) + a.dur) }; }
    if (a.type === 'add_task') return { ic: 'plus', text: 'Add task “' + a.title + '”' + (a.due ? ', ' + shortWhen(a.due, a.at) : '') + (a.during ? ' (during ' + a.during + ')' : '') };
    if (a.type === 'timer') { s = subj(a.subject); return { ic: 'timer', text: (a.mode === 'stopwatch' ? 'Start the stopwatch' : 'Start a ' + a.min + '-minute focus timer') + (s ? ' for ' + s.name : '') }; }
    if (a.type === 'done') { x = taskById(a.id); if (!x || (!isRep(x) && x.done)) return null; return { ic: 'check', text: 'Tick off “' + x.title + '”' + (isRep(x) ? ' for ' + (a.date === today() || !a.date ? 'today' : fDay(a.date)) : '') }; }
    if (a.type === 'add_event') {
      if (!DATE.test(a.date) || typeof a.title !== 'string' || !a.title || assistEventThere(a)) return null;
      s = subj(a.subject);
      return { ic: 'calendar', text: 'Add ' + (a.kind === 'exam' ? 'exam' : a.kind === 'deadline' ? 'deadline' : 'date') + ': ' + (s && normName(a.title).indexOf(normName(s.name)) < 0 ? s.name + ' ' : '') + a.title + ', ' + fDay(a.date) + (TIME.test(a.at) ? ' ' + a.at : '') };
    }
    if (a.type === 'timetable') {
      var cl = assistClasses(a);
      if (!cl.length) return null;
      var days = [], fresh = [];
      cl.forEach(function (c) {
        if (days.indexOf(c.wd) < 0) days.push(c.wd);
        if (!subj(c.subject) && !subjectNamed(c.name) && fresh.indexOf(c.name) < 0) fresh.push(c.name);
      });
      days.sort();
      var run = days.length > 2 && days[days.length - 1] - days[0] === days.length - 1;
      var lines = days.map(function (d) {
        return DAYS[d] + ': ' + cl.filter(function (c) { return c.wd === d; }).map(function (c) { var y = subj(c.subject) || subjectNamed(c.name); return c.start + ' ' + (y ? y.short || y.name : c.name); }).join(', ');
      });
      if (fresh.length) lines.push('New subject' + (fresh.length > 1 ? 's' : '') + ': ' + fresh.join(', '));
      return { ic: 'timetable', text: (a.replace ? 'Replace your timetable with ' : 'Add ') + cl.length + ' class' + (cl.length === 1 ? '' : 'es') + (a.replace ? '' : ' to your timetable') +
        ' (' + (run ? DAYS[days[0]] + '–' + DAYS[days[days.length - 1]] : days.map(function (d) { return DAYS[d]; }).join(', ')) + ')', lines: lines };
    }
    return null;
  }
  function normName(v) { return String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function subjectNamed(n) { var k = normName(n); return k ? S.subjects.filter(function (y) { return normName(y.name) === k || normName(y.short) === k; })[0] || null : null; }
  /* the timetable's classes that still make sense on this device */
  function assistClasses(a) {
    return (Array.isArray(a.classes) ? a.classes : []).filter(function (c) {
      return c && c.wd >= 0 && c.wd <= 6 && Math.floor(c.wd) === c.wd && TIME.test(c.start) && TIME.test(c.end) && toMin(c.end) > toMin(c.start) &&
        (subj(c.subject) || (typeof c.name === 'string' && normName(c.name)));
    }).slice(0, 70);
  }
  /* an exam or deadline that's already in the Calendar (the server checks too; this catches one added since) */
  function assistEventThere(a) {
    return S.events.some(function (e) {
      return e.start === a.date && (e.type === a.kind || (a.kind === 'exam' && e.type === 'mock')) &&
        (a.subject || e.subject ? e.subject === a.subject && normName([e.title, e.detail].join(' ')).replace(/\D/g, '') === normName(a.title).replace(/\D/g, '') : normName(e.title) === normName(a.title));
    });
  }
  /* fill the weekly timetable: the most common times become rows, others reuse a close row with their own times */
  function timetableApply(a) {
    var cl = assistClasses(a), made = {};
    if (!cl.length) return false;
    function sidOf(c) {
      if (subj(c.subject)) return c.subject;
      var hit = subjectNamed(c.name), key = normName(c.name);
      if (hit) return hit.id;
      if (made[key]) return made[key];
      var name = clip(c.name, 60), color = PALETTE.filter(function (col) { return !S.subjects.some(function (y) { return y.color === col; }); })[0] || PALETTE[S.subjects.length % PALETTE.length];
      var y = { id: uid('s'), name: name, short: name.slice(0, 18), color: color, group: 'ib', level: '', teacher: '', goal: 0, notes: '' };
      S.subjects.push(y); made[key] = y.id;
      return y.id;
    }
    if (a.replace) {
      S.slots = {};
      S.periods = S.periods.filter(function (p) { return p.kind === 'break' && !cl.some(function (c) { return toMin(c.start) < toMin(p.end) && toMin(c.end) > toMin(p.start); }); });
    }
    var freq = {};
    cl.forEach(function (c) { var k = c.start + '-' + c.end; freq[k] = (freq[k] || 0) + 1; });
    cl.slice().sort(function (x, y) { return (freq[y.start + '-' + y.end] - freq[x.start + '-' + x.end]) || toMin(x.start) - toMin(y.start) || x.wd - y.wd; }).forEach(function (c) {
      var sid = sidOf(c), s0 = toMin(c.start), e0 = toMin(c.end);
      /* a class there already that overlaps gives way */
      Object.keys(S.slots).forEach(function (k) {
        var b = k.split('|'), p = periodById(b[0]);
        if (Number(b[1]) !== c.wd || !p) return;
        var t = slotTimes(p, S.slots[k]);
        if (toMin(t.start) < e0 && toMin(t.end) > s0) delete S.slots[k];
      });
      var rows = S.periods.filter(function (p) { return p.kind === 'class'; });
      var p = rows.filter(function (q) { return q.start === c.start && q.end === c.end; })[0] ||
        rows.filter(function (q) { return Math.abs(toMin(q.start) - s0) <= 10 && !S.slots[slotKey(q.id, c.wd)]; })[0];
      if (!p) { p = { id: uid('p'), start: c.start, end: c.end, kind: 'class', label: '' }; S.periods.push(p); }
      var sl = { subject: sid };
      if (p.start !== c.start || p.end !== c.end) { sl.start = c.start; sl.end = c.end; }
      S.slots[slotKey(p.id, c.wd)] = sl;
    });
    S.periods.sort(function (x, y) { return toMin(x.start) - toMin(y.start); });
    if (cl.some(function (c) { return c.wd >= 5; })) S.settings.weekend = true;
    return true;
  }
  /* "Historia study block (Essay plan)", or "Study block (Essay plan)" with no subject */
  function upFirstWord(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function planLabel(p) { var s = subj(p.subject); return (s ? s.name + ' study block' : 'Study block') + (p.title ? ' (' + p.title + ')' : ''); }
  function assistCardHTML(m, i) {
    var st = m.status || 'pending', rows = m.actions.map(function (a) {
      var d = st === 'pending' ? assistDesc(a) : null;
      var text = d ? d.text : a.label || '', lines = d ? d.lines : a.lines;
      return text ? '<li>' + icon(d ? d.ic : a.ic || 'check') + '<span>' + esc(text) +
        (Array.isArray(lines) && lines.length ? '<small class="as-lines">' + lines.slice(0, 9).map(esc).join('<br>') + '</small>' : '') + '</span></li>' : '';
    }).join('');
    var n = m.actions.length, head = st === 'done' ? (n === 1 ? 'Change made' : 'Changes made') : st === 'rejected' ? 'Not changed' : st === 'stale' ? 'Can’t do this any more' : (n === 1 ? 'Suggested change' : n + ' suggested changes');
    var btns = st === 'pending' ? '<div class="as-card-btns"><button type="button" class="btn small" data-act="assist-reject" data-i="' + i + '">Reject</button>' +
      '<button type="button" class="btn small primary" data-act="assist-approve" data-i="' + i + '">' + icon('check') + 'Approve' + (n > 1 ? ' All' : '') + '</button></div>' : '';
    return '<div class="as-card ' + st + '" data-i="' + i + '"><p class="as-card-head">' + icon(st === 'done' ? 'check' : 'spark') + esc(head) + '</p>' + (rows ? '<ul>' + rows + '</ul>' : '') + btns + '</div>';
  }
  /* Approve: re-check each change against this device's planner, apply them all, save once, offer Undo */
  function assistApply(i) {
    var m = AS.msgs[i];
    if (!m || !m.actions || (m.status && m.status !== 'pending')) return;
    var snap = snapshot(), done = [], timer = false;
    m.actions.forEach(function (a) {
      var d = assistDesc(a), p, x;
      if (!d) return;
      if (a.type === 'move' && a.kind === 'plan') { p = planById(a.id); planMoveTo(p, a.date, a.at); }
      else if (a.type === 'move') { x = taskById(a.id); taskMoveTo(x, a.date, a.at); }
      else if (a.type === 'resize') { p = planById(a.id); itemResize('plan', p, cleanDur(a.dur, p.dur)); }
      else if (a.type === 'add_block') planAdd({ date: a.date, at: a.at, dur: cleanDur(a.dur, 60), subject: subj(a.subject) ? a.subject : null, title: clip(a.title, 80) });
      else if (a.type === 'add_task') { var nt = newTask(clip(a.title, 200), a.subject, a.due || null); if (a.at && a.due) { nt.at = a.at; nt.est = a.est || 30; } else if (a.est) nt.est = a.est; S.tasks.push(nt); }
      else if (a.type === 'timer') { if (S.timer) return; timerStart(a.min || 25, a.mode === 'stopwatch', a.subject); if (subj(a.subject)) { UI.focusSubject = a.subject; saveUI(); } timer = true; }
      else if (a.type === 'done') { x = taskById(a.id); taskSetDone(x, a.date || today(), true); }
      else if (a.type === 'add_event') {
        S.events.push({ id: uid('ev'), type: a.kind === 'exam' || a.kind === 'deadline' ? a.kind : 'other', subject: subj(a.subject) ? a.subject : null, title: clip(a.title, 80), detail: '',
          start: a.date, end: null, at: TIME.test(a.at) ? a.at : null, dur: TIME.test(a.at) ? cleanDur(a.dur, 60) : null, note: '', done: false });
      }
      else if (a.type === 'timetable') { if (!timetableApply(a)) return; }
      a.label = d.text; a.ic = d.ic; if (d.lines) a.lines = d.lines;
      done.push(a);
    });
    if (!done.length) { m.status = 'stale'; m.actions.forEach(function (a) { var d = assistDesc(a); a.label = a.label || (d && d.text) || ''; }); assistSave(); assistPaint(true); toast('Those items changed since, so nothing was applied'); return; }
    m.status = 'done';
    AS.lastSnap = snap; AS.lastCard = i;
    save(); render();
    assistSave(); assistPaint(true);
    var tt = done.some(function (a) { return a.type === 'timetable'; });
    toast((done.length === 1 ? done[0].label : done.length + ' changes made') + (done.length < m.actions.length ? ' (some were out of date)' : ''), snap,
      timer && UI.tab !== 'today' ? { label: 'Open Timer', fn: function () { closeDialog(); go('today'); } } : tt && UI.tab !== 'timetable' ? { label: 'Open Timetable', fn: function () { closeDialog(); go('timetable'); } } : null, 12000);
  }
  function assistReject(i) {
    var m = AS.msgs[i];
    if (!m || !m.actions || (m.status && m.status !== 'pending')) return;
    m.actions.forEach(function (a) { var d = assistDesc(a); a.label = d ? d.text : ''; a.ic = d ? d.ic : 'check'; if (d && d.lines) a.lines = d.lines; });
    m.status = 'rejected';
    assistSave(); assistPaint(true);
  }

  /* ---------- sending ---------- */
  function assistNote(text, act) { var n = { role: 'note', text: text, at: Date.now() }; if (act) n.act = act; AS.msgs.push(n); }
  /* earlier photos go back as "[photo]": the model sees what it said about them, not the picture */
  function assistHistory() {
    return AS.msgs.filter(function (m) { return (m.role === 'user' && !m.failed) || m.role === 'assistant'; }).slice(-AS_SEND).map(function (m) {
      var t = String(m.text || '');
      if (m.role === 'user' && m.photo) t = ('[photo] ' + t).trim();
      return { role: m.role, text: t.slice(0, 1500) };
    });
  }
  /* wait (a little) for unsynced edits, so the assistant sees the planner as it is now */
  function assistSynced() {
    if (dirty) flush();
    return new Promise(function (ok) {
      var t0 = Date.now();
      (function wait() { if (!SYNC.pending || Date.now() - t0 > 3000) ok(); else setTimeout(wait, 150); })();
    });
  }
  function assistSend(text) {
    text = String(text || '').replace(/\s+$/, '').replace(/^\s+/, '');
    var img = AS.img;
    if ((!text && !img) || AS.busy || AS.imgBusy) return;
    if (Array.from(text).length > AS_MAX) { toast('That’s too long. Keep it under ' + AS_MAX + ' characters.'); return; }
    if (!SYNC.online) { toast('You’re offline. The assistant needs a connection.'); return; }
    var history = assistHistory(), mine = { role: 'user', text: text, at: Date.now() };
    if (img) { mine.photo = true; if (img.thumb) mine.img = img.thumb; }
    AS.msgs.push(mine);
    AS.img = null;
    AS.busy = true;
    var inp = $('#as-input', dlg); if (inp) inp.value = '';
    assistSave(); assistPaint();
    assistSynced().then(function () {
      return api('POST', '/api/assist', img ? { text: text, history: history, image: img.url } : { text: text, history: history }, { timeout: img ? 70000 : 40000 });
    }).then(function (r) {
      AS.busy = false;
      var d = r.data || {};
      if (d.usage) AS.usage = d.usage;
      if (r.status === 200 && typeof d.reply === 'string') {
        var acts = Array.isArray(d.actions) ? d.actions.filter(function (a) { return a && typeof a.type === 'string'; }).slice(0, 15) : [];
        var skip = Array.isArray(d.skipped) ? d.skipped.filter(function (k) { return typeof k === 'string' && k.length < 20; }).slice(0, 4) : [];
        AS.msgs.push({ role: 'assistant', text: d.reply, at: Date.now(), actions: acts.length ? acts : undefined, status: acts.length ? 'pending' : undefined, skipped: skip.length ? skip : undefined });
      } else {
        mine.failed = true;
        if (r.status === 401) { sessionLost(); return; }
        var e = d.error, ph = assistPhotos();
        /* a photo that didn't go through can be sent again, unless photos are used up or it was the problem */
        if (img && e !== 'assist_photo' && e !== 'assist_image' && e !== 'assist_limit' && !AS.img) AS.img = img;
        assistNote(e === 'assist_limit' ? 'That’s all your messages for today. They come back at midnight.'
          : e === 'assist_photo' ? 'That’s today’s ' + (ph.lim === 1 ? 'photo' : ph.lim + ' photos') + '. More come back at midnight. That one didn’t count.'
          : e === 'assist_image' ? 'Bloc couldn’t use that photo. Try another one, or a screenshot. That one didn’t count.'
          : e === 'assist_cap' ? 'The assistant has had a busy day and is resting until midnight. Try again tomorrow.'
          : e === 'slow' ? 'That’s a lot of messages at once. Wait a minute and try again.'
          : e === 'assist_off' ? 'The assistant is switched off right now.'
          : e === 'assist_setup' ? 'The assistant isn’t set up yet.'
          : e === 'assist_long' ? 'That message is too long. Keep it under ' + AS_MAX + ' characters.'
          : 'The assistant couldn’t answer just now. Try again in a moment. That one didn’t count.', (e === 'assist_limit' || e === 'assist_photo') && canBuyExtra() ? 'extra' : null);
        if (e === 'assist_off') AS.on = false;
        if (e === 'assist_setup') AS.ready = false;
      }
      assistSave(); assistPaint();
    }, function () {
      AS.busy = false; mine.failed = true;
      if (img && !AS.img) AS.img = img;
      assistNote('Can’t reach Bloc. Check your connection and try again. That one didn’t count.');
      assistSave(); assistPaint();
    });
  }
  function assistClear() {
    AS.msgs = []; AS.lastSnap = null; AS.lastCard = null; AS.img = null;
    assistSave(); assistPaint();
    var inp = $('#as-input', dlg); if (inp && !coarse.matches) inp.focus();
  }

  /* ---------- admin: limits, the off switch, today's totals ---------- */
  function openAdminAssist() {
    curSheet = openAdminAssist;
    openDialog({ title: 'AI Assistant', back: openSettings, backLabel: 'Settings', body: '<div class="sheet-loading"><span class="spinner" aria-hidden="true"></span></div>' });
    assistUsageLoad().then(function () {
      if (curSheet !== openAdminAssist || !AS.admin) { if (curSheet === openAdminAssist) sheetMessage('<p class="group-foot">Couldn’t load the settings. Close this and try again.</p>'); return; }
      var A = AS.admin, c = A.conf, cost = Math.max(0, A.neurons - 10000) * 0.011 / 1000, phToday = A.photos || 0;
      var num = function (label, name, v, min, max) { return '<label class="row"><span class="row-label">' + esc(label) + '</span><input class="row-field right" type="number" inputmode="numeric" name="' + name + '" id="aa-' + name + '" min="' + min + '" max="' + max + '" step="1" value="' + v + '" required></label>'; };
      openDialog({
        title: 'AI Assistant', back: openSettings, backLabel: 'Settings', submitLabel: 'Save',
        body: grp(rSwitch('Assistant on', 'on', 'aa-on', c.on), '', 'Off hides the sparkle button for everyone.') +
          grp(num('Messages a day', 'limit', c.limit, 1, 200) + num('With extra messages', 'extra', c.extra, 1, 1000) +
              num('Photos a day', 'photos', c.photos != null ? c.photos : 1, 0, 50) + num('Photos with extra', 'photosExtra', c.photosExtra != null ? c.photosExtra : 5, 0, 200), 'Per student',
            'Extra messages is a switch per student in Manage Accounts: turn it on for someone after they pay. Bloc Plus doesn’t change the limits. 0 photos turns photos off.') +
          grp('<label class="row"><span class="row-label">Price a month (€)</span><input class="row-field right" type="number" inputmode="decimal" name="price" id="aa-price" min="0.5" max="50" step="0.5" value="' + (c.price != null ? c.price : 2) + '" required></label>', 'Extra messages',
            'What the Get More Messages offer shows when someone runs out. They pay you by Bizum (your number from Settings → Admin), then you switch Extra Messages on for them.') +
          grp(num('Messages a day, everyone', 'cap', c.cap, 1, 100000) + num('AI budget a day (Neurons)', 'budget', c.budget, 100, 10000000), 'Everyone together',
            'The assistant stops for the day at whichever comes first. Workers AI gives 10,000 free Neurons a day for your whole account (Siri’s helper uses them too); past that it’s about $0.011 per 1,000. One message is about 100–120 Neurons, a photo about 150–300.') +
          grp('<div class="row"><span class="row-label">Today</span><span class="row-value">' + A.today + ' message' + (A.today === 1 ? '' : 's') + (phToday ? ' · ' + phToday + ' photo' + (phToday === 1 ? '' : 's') : '') + ' · ' + (A.provider === 'workers-ai' ? A.neurons.toLocaleString('en') + ' Neurons' + (cost > 0 ? ' · ≈ $' + cost.toFixed(2) : '') : 'OpenAI') + '</span></div>' +
            '<div class="row"><span class="row-label">Model</span><span class="row-value as-model">' + esc(A.model || '') + '</span></div>' +
            (A.vision && A.vision !== A.model ? '<div class="row"><span class="row-label">Photos</span><span class="row-value as-model">' + esc(A.vision) + '</span></div>' : ''), 'Usage', 'Counts reset at midnight, Madrid time. Change the models in Cloudflare: see the setup doc.'),
        onSubmit: function (fd, form) {
          var v = { on: !!fd.get('on') };
          var bad = ['limit', 'extra', 'photos', 'photosExtra', 'cap', 'budget'].filter(function (k) {
            var n = Number(fd.get(k)), el = $('#aa-' + k); v[k] = n;
            return !(String(fd.get(k)).trim() !== '' && Math.floor(n) === n && n >= Number(el.min) && n <= Number(el.max));
          });
          if (bad.length) { fieldError('#aa-' + bad[0], 'Use a whole number from ' + $('#aa-' + bad[0]).min + ' to ' + $('#aa-' + bad[0]).max + '.'); return false; }
          v.price = Math.round(Number(String(fd.get('price')).replace(',', '.')) * 100) / 100;
          if (!(v.price >= 0.5 && v.price <= 50)) { fieldError('#aa-price', 'Use a price from 0.50 to 50 €.'); return false; }
          if (busyForm(form, true)) return false;
          api('POST', '/api/admin/config', { assist: v }).then(function (r) {
            busyForm(form, false);
            if (r.status === 200 && r.data) { setConf(Object.assign({ cal: CONF.cal }, r.data)); writeCache(); renderNav(); openSettings(); toast('Assistant settings saved'); }
            else if (r.status === 401) sessionLost();
            else toast('Couldn’t save them (error ' + r.status + ')');
          }, function () { busyForm(form, false); toast('Can’t reach Bloc. Check your connection.'); });
          return false;
        }
      });
    });
  }

  /* ---------- Extra Messages: the offer when the day's messages or photos run out ----------
     Separate from Bloc Plus. Paid by Bizum for now; Mauro then switches it on in Manage Accounts. */
  function openExtra(back) {
    /* the iPhone app sells nothing itself: it links to the website where Apple allows that */
    if (NATIVE) { if (sellHere()) openWeb('extra'); return; }
    var me = function () { openExtra(back); };
    curSheet = me;
    var A = CONF.assist || {}, u = AS.usage, on = !!(u && u.extra), b = CONF.bizum;
    var lim = A.limit || 15, more = A.extra || 60, ph = A.photos != null ? A.photos : 1, phx = A.photosExtra != null ? A.photosExtra : 5, price = A.price || 2;
    var perks = [['chat', '#3B6FD4', more + ' messages a day', 'Instead of ' + lim + '. They come back every midnight.']];
    if (phx > 0) perks.push(['camera', '#E0527D', phx + ' photo' + (phx === 1 ? '' : 's') + ' a day', ph > 0 ? 'Instead of ' + ph + '. Timetables, exam dates, homework and notes.' : 'Timetables, exam dates, homework and notes.']);
    perks.push(['spark', '#1E9E6A', 'The same assistant', 'Study help, quizzes and changes you approve.']);
    var how = b ? 'Send Mauro a Bizum of ' + euro(price) + ' (' + esc(b) + ') with your username, @' + esc(ME.id) + ', in the message. He’ll switch extra messages on for your account. Pay again each month to keep them.'
      : 'Ask Mauro to switch extra messages on for your account (@' + esc(ME.id) + '). It’s ' + euro(price) + ' a month.';
    var body =
      '<div class="plus-hero extra-hero"><span class="plus-badge spark">' + icon('spark') + '</span><h3>Extra Messages</h3><p>' +
        (on ? 'Extra messages are on. You get ' + more + ' messages' + (phx > 0 ? ' and ' + phx + ' photo' + (phx === 1 ? '' : 's') : '') + ' a day.' : 'For days when ' + lim + ' messages aren’t enough.') + '</p></div>' +
      grp(perks.map(function (x) { return '<div class="row perk"><span class="perk-ic" style="--c:' + x[1] + '">' + icon(x[0]) + '</span><span class="two-line"><b>' + esc(x[2]) + '</b><span>' + esc(x[3]) + '</span></span></div>'; }).join('')) +
      (on ? '' : grp('<div class="row"><span class="row-label">Price</span><span class="row-value price">' + esc(euro(price)) + ' a month</span></div>' +
          (b ? rButton(icon('copy') + 'Copy Bizum Number', 'copy-bizum') : ''), 'Get extra messages', how)) +
      '<p class="group-foot plus-fine">Extra messages are separate from Bloc Plus, so Plus doesn’t change your limit.</p>';
    openDialog({ title: 'Extra Messages', body: body, back: back || null, backLabel: back === openAssist ? 'Assistant' : undefined });
    /* opened from a link before the assistant loaded: check whether they have it already */
    if (!u && ME) assistUsageLoad().then(function () { if (curSheet === me && AS.usage) openExtra(back); });
  }

  /* =========================================================
     Backup, import, calendar export
     ========================================================= */
  function exportBackup() {
    var t = today();
    S.settings.lastBackup = t;
    save(); flush();
    download('bloc-backup-' + t + '.json', JSON.stringify({ app: 'myib', version: 3, user: ME ? ME.id : null, exported: new Date().toISOString(), data: S }, null, 2), 'application/json');
    toast('Backup downloaded');
  }
  function importFile(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    if (file.size > 5e6) { input.value = ''; toast('That file is too big to be a planner backup'); return; }
    var reader = new FileReader();
    reader.onload = function () {
      input.value = '';
      try {
        var obj = JSON.parse(String(reader.result));
        var data = obj && (obj.app === 'myib' || obj.app === 'ib-planner') && obj.data ? obj.data : obj;
        if (!data || !Array.isArray(data.subjects) || !Array.isArray(data.events) || !Array.isArray(data.periods)) throw new Error('not a backup');
        var snap = snapshot();
        S = sanitize(data);
        save(); flush();
        closeDialog(); render();
        toast('Backup restored', snap);
      } catch (err) {
        toast('That file isn’t a Bloc backup');
      }
    };
    reader.onerror = function () { input.value = ''; toast('Could not read that file'); };
    reader.readAsText(file);
  }
  function icsText(s) { return String(s).replace(/\r/g, '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); }
  function icsFold(line) {
    var out = [], cur = '', bytes = 0;
    Array.from(line).forEach(function (ch) {
      var cp = ch.codePointAt(0), b = cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
      if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; }
      cur += ch; bytes += b;
    });
    out.push(cur);
    return out.join('\r\n ');
  }
  function buildICS() {
    var stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Bloc//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Bloc'];
    S.events.slice().sort(byStart).forEach(function (e) {
      L.push('BEGIN:VEVENT', 'UID:' + e.id + '@myib.app', 'DTSTAMP:' + stamp);
      if (e.at && !e.end) {
        /* a time of day: floating local time, so the calendar shows it at that hour wherever you are */
        var endM = toMin(e.at) + (e.dur || 60), endD = addDays(e.start, Math.floor(endM / 1440));
        L.push('DTSTART:' + e.start.replace(/-/g, '') + 'T' + e.at.replace(':', '') + '00',
          'DTEND:' + endD.replace(/-/g, '') + 'T' + hm(endM % 1440).replace(':', '') + '00');
      } else {
        L.push('DTSTART;VALUE=DATE:' + e.start.replace(/-/g, ''), 'DTEND;VALUE=DATE:' + addDays(evEnd(e), 1).replace(/-/g, ''));
      }
      L.push('SUMMARY:' + icsText(evFull(e)));
      if (e.note) L.push('DESCRIPTION:' + icsText(e.note));
      var s = subj(e.subject);
      if (s) L.push('CATEGORIES:' + icsText(s.name));
      L.push('TRANSP:TRANSPARENT');
      if ((e.type === 'deadline' || e.type === 'exam') && !e.done) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsText(evFull(e)), 'TRIGGER:' + (e.at && !e.end ? '-P1D' : '-PT15H'), 'END:VALARM');
      L.push('END:VEVENT');
    });
    L.push('END:VCALENDAR');
    return L.map(icsFold).join('\r\n') + '\r\n';
  }

  /* =========================================================
     Import from Apple Calendar, Google Calendar or any calendar file (iCalendar, .ics).
     A file, a zip of them (Google's export) or a link the server fetches. Weekly and daily
     repeats become repeating tasks; other repeats become separate dates. A linked calendar
     can stay in sync: the app checks it again every 6 hours while it's open.
     ========================================================= */
  var ICS_PAST = 30, ICS_AHEAD = 400, ICS_MAX = 500, ICS_SERIES = 60, FEEDS_MAX = 5, FEED_EVERY = 6 * 3600000;
  var ICS_DAYS = { MO: 0, TU: 1, WE: 2, TH: 3, FR: 4, SA: 5, SU: 6 };
  /* Outlook writes Windows zone names; the common ones, as IANA names */
  var WIN_TZ = {
    'Romance Standard Time': 'Europe/Paris', 'W. Europe Standard Time': 'Europe/Berlin', 'Central Europe Standard Time': 'Europe/Budapest',
    'Central European Standard Time': 'Europe/Warsaw', 'GMT Standard Time': 'Europe/London', 'Greenwich Standard Time': 'Atlantic/Reykjavik',
    'E. Europe Standard Time': 'Europe/Bucharest', 'FLE Standard Time': 'Europe/Kiev', 'GTB Standard Time': 'Europe/Athens',
    'Eastern Standard Time': 'America/New_York', 'Central Standard Time': 'America/Chicago', 'Mountain Standard Time': 'America/Denver',
    'Pacific Standard Time': 'America/Los_Angeles', 'Canary Standard Time': 'Atlantic/Canary', 'UTC': 'UTC', 'Coordinated Universal Time': 'UTC'
  };

  function icsUnescape(v) { return String(v).replace(/\\([nN,;\\])/g, function (m, c) { return c === 'n' || c === 'N' ? '\n' : c; }); }
  /* NAME;PARAM=x;PARAM="a:b":VALUE (the first colon outside quotes ends the name) */
  function icsLine(line) {
    var q = false, i = 0;
    for (; i < line.length; i++) { var ch = line.charAt(i); if (ch === '"') q = !q; else if (ch === ':' && !q) break; }
    if (i >= line.length) return null;
    var parts = line.slice(0, i).match(/(?:[^;"]|"[^"]*")+/g) || [''], params = {};
    parts.slice(1).forEach(function (p) { var k = p.indexOf('='); if (k > 0) params[p.slice(0, k).toUpperCase()] = p.slice(k + 1).replace(/^"|"$/g, ''); });
    return { name: parts[0].toUpperCase(), params: params, value: line.slice(i + 1) };
  }
  function icsRaw(params, v) {
    var m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(String(v).trim());
    if (!m) return null;
    var date = params.VALUE === 'DATE' || !m[4];
    return { y: +m[1], mo: +m[2], d: +m[3], h: date ? 0 : +m[4], mi: date ? 0 : +m[5], s: date ? 0 : +(m[6] || 0), utc: !!m[7], tz: params.TZID || '', date: date };
  }
  function icsDur(v) {
    var m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(String(v).trim());
    if (!m) return null;
    var min = (+m[2] || 0) * 10080 + (+m[3] || 0) * 1440 + (+m[4] || 0) * 60 + (+m[5] || 0) + Math.round((+m[6] || 0) / 60);
    return m[1] === '-' ? -min : min;
  }
  function icsRule(v) {
    var r = {};
    String(v).split(';').forEach(function (p) { var k = p.indexOf('='); if (k > 0) r[p.slice(0, k).toUpperCase()] = p.slice(k + 1); });
    return {
      freq: (r.FREQ || '').toUpperCase(), interval: Math.max(1, parseInt(r.INTERVAL, 10) || 1),
      count: parseInt(r.COUNT, 10) || 0, until: r.UNTIL ? icsRaw({}, r.UNTIL) : null,
      byday: r.BYDAY ? r.BYDAY.toUpperCase().split(',').map(function (x) { var m = /^([+-]?\d{1,2})?(MO|TU|WE|TH|FR|SA|SU)$/.exec(x.trim()); return m ? { n: m[1] ? parseInt(m[1], 10) : 0, d: ICS_DAYS[m[2]] } : null; }).filter(Boolean) : [],
      bymonthday: r.BYMONTHDAY ? r.BYMONTHDAY.split(',').map(Number).filter(function (n) { return n && Math.abs(n) <= 31; }) : [],
      bymonth: r.BYMONTH ? r.BYMONTH.split(',').map(Number).filter(function (n) { return n >= 1 && n <= 12; }) : [],
      other: !!(r.BYSETPOS || r.BYWEEKNO || r.BYYEARDAY || r.BYHOUR || r.BYMINUTE)
    };
  }
  function parseICS(text) {
    var lines = String(text).replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
    var cal = { name: '', tz: '', events: [] }, stack = [], cur = null;
    lines.forEach(function (raw) {
      if (!raw) return;
      var l = icsLine(raw);
      if (!l) return;
      if (l.name === 'BEGIN') {
        var what = l.value.trim().toUpperCase();
        stack.push(what);
        if (what === 'VEVENT') cur = { ex: [], rd: [] };
        return;
      }
      if (l.name === 'END') {
        if (stack.pop() === 'VEVENT' && cur) { if (cal.events.length < 20000) cal.events.push(cur); cur = null; }
        return;
      }
      var top = stack[stack.length - 1];
      if (top === 'VCALENDAR') {
        if (l.name === 'X-WR-CALNAME') cal.name = icsUnescape(l.value).trim();
        else if (l.name === 'X-WR-TIMEZONE') cal.tz = l.value.trim();
        return;
      }
      if (top !== 'VEVENT' || !cur) return;
      var n = l.name;
      if (n === 'UID') cur.uid = l.value.trim();
      else if (n === 'SUMMARY') cur.summary = icsUnescape(l.value);
      else if (n === 'DESCRIPTION') cur.desc = icsUnescape(l.value);
      else if (n === 'LOCATION') cur.loc = icsUnescape(l.value);
      else if (n === 'STATUS') cur.status = l.value.trim().toUpperCase();
      else if (n === 'DTSTART') cur.start = icsRaw(l.params, l.value);
      else if (n === 'DTEND' || n === 'DUE') cur.end = icsRaw(l.params, l.value);
      else if (n === 'DURATION') cur.dur = icsDur(l.value);
      else if (n === 'RRULE') cur.rule = icsRule(l.value);
      else if (n === 'EXDATE' || n === 'RDATE') l.value.split(',').forEach(function (v) { var t = icsRaw(l.params, v); if (t) (n === 'EXDATE' ? cur.ex : cur.rd).push(t); });
      else if (n === 'RECURRENCE-ID') cur.rid = icsRaw(l.params, l.value);
    });
    return cal;
  }

  /* a wall-clock time in a time zone, as epoch ms; null when the browser doesn't know the zone */
  var TZ_FMT = {};
  function tzOffset(ms, tz) {
    var f = TZ_FMT[tz] || (TZ_FMT[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }));
    var p = {};
    f.formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000;
  }
  function zonedMs(t, tz) {
    tz = String(tz).replace(/^\/[^/]+\/[^/]+\//, '').replace(/^"|"$/g, '');
    tz = WIN_TZ[tz] || tz;
    try {
      var guess = Date.UTC(t.y, t.mo - 1, t.d, t.h, t.mi, t.s), off = tzOffset(guess, tz), ms = guess - off, off2 = tzOffset(ms, tz);
      return off2 === off ? ms : guess - off2;
    } catch (e) { return null; }
  }
  /* any calendar time as this device's local date and time */
  function icsLocal(t, calTz) {
    if (!t) return null;
    if (t.date) return { date: t.y + '-' + pad(t.mo) + '-' + pad(t.d), time: null, ms: new Date(t.y, t.mo - 1, t.d).getTime() };
    var ms = t.utc ? Date.UTC(t.y, t.mo - 1, t.d, t.h, t.mi, t.s) : null;
    if (ms == null && (t.tz || calTz)) ms = zonedMs(t, t.tz || calTz);
    if (ms == null) ms = new Date(t.y, t.mo - 1, t.d, t.h, t.mi, t.s).getTime();
    var d = new Date(ms);
    return { date: toISO(d), time: pad(d.getHours()) + ':' + pad(d.getMinutes()), ms: ms };
  }
  function icsHash(s) {
    var h1 = 0x811c9dc5, h2 = 0x01000193;
    for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 + c, 2246822519) ^ (h2 >>> 13); }
    return ((h1 >>> 0).toString(36) + (h2 >>> 0).toString(36)).slice(0, 12);
  }

  /* best guesses from the title: the kind of date and the subject */
  function icsType(text, allDay) {
    var t = norm(text);
    if (/\b(mock|mocks|simulacro)\b/.test(t)) return 'mock';
    if (/\b(exam|exams|examen|examenes|test|prueba|quiz|parcial|midterm|paper [123])\b/.test(t)) return 'exam';
    if (/\b(deadline|due|entrega|entregar|submit|submission|plazo|homework|deberes|tarea|assignment|essay|ensayo|trabajo|proyecto|project)\b/.test(t)) return 'deadline';
    if (allDay && /\b(holiday|holidays|vacaciones|festivo|fiesta|no lectivo|puente|break|half term|vacation|navidad|semana santa)\b/.test(t)) return 'holiday';
    if (/\b(notas|grades|boletin|evaluacion|report card)\b/.test(t)) return 'grades';
    return 'other';
  }
  function icsSubject(text) {
    var words = function (x) { return norm(x).replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); };
    var t = ' ' + words(text) + ' ', best = null;
    S.subjects.forEach(function (s) {
      [s.name, s.short].forEach(function (w) {
        var k = words(w);
        if (k.length >= 2 && t.indexOf(' ' + k + ' ') >= 0 && (!best || k.length > best.k.length)) best = { id: s.id, k: k, w: w };
      });
    });
    return best;
  }
  function icsTitle(summary, sub) {
    var title = String(summary || '').replace(/\s+/g, ' ').trim();
    if (sub) {
      var rest = title.replace(new RegExp('(^|[\\s:·,-])' + sub.w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=$|[\\s:·,-])', 'i'), '$1').replace(/^[\s:·,-]+|[\s:·,-]+$/g, '').replace(/\s{2,}/g, ' ');
      if (rest) title = rest.charAt(0).toUpperCase() + rest.slice(1);
      else title = '';
    }
    return title.slice(0, 80);
  }
  function icsNote(ev) {
    var desc = String(ev.desc || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
    var loc = String(ev.loc || '').trim();
    return ((loc ? 'Where: ' + loc + (desc ? '\n\n' : '') : '') + desc).slice(0, 2000);
  }

  /* the dates a repeat lands on between from and to (and the COUNT-th last date, to tell where it ends) */
  function icsDates(start, rule, from, to) {
    var out = [], n = 0, guard = 0, d = start, untilD = rule.until ? icsLocal(rule.until, '').date : null;
    function take(x) {
      if (untilD && x > untilD) return false;
      if (x < start) return true;
      n++;
      if (rule.count && n > rule.count) return false;
      if (x >= from && x <= to) out.push(x);
      return out.length < ICS_SERIES && x <= to;
    }
    var sp = start.split('-').map(Number), go = true;
    if (rule.freq === 'DAILY') {
      for (; go && guard < 4000; guard++) go = take(addDays(start, guard * rule.interval));
    } else if (rule.freq === 'WEEKLY') {
      var days = rule.byday.length ? rule.byday.map(function (b) { return b.d; }) : [dow(start)];
      var wk = addDays(start, -dow(start));
      for (; go && guard < 800; guard++) {
        var w = addDays(wk, guard * 7 * rule.interval);
        days.slice().sort().forEach(function (k) { if (go) go = take(addDays(w, k)); });
      }
    } else if (rule.freq === 'MONTHLY' || rule.freq === 'YEARLY') {
      var yearly = rule.freq === 'YEARLY';
      for (; go && guard < 600; guard++) {
        var y = sp[0] + (yearly ? guard * rule.interval : 0), m0 = (sp[1] - 1) + (yearly ? 0 : guard * rule.interval);
        y += Math.floor(m0 / 12); m0 = ((m0 % 12) + 12) % 12;
        var months = yearly && rule.bymonth.length ? rule.bymonth.map(function (m) { return m - 1; }) : [m0];
        months.forEach(function (mm) {
          if (!go) return;
          var len = new Date(y, mm + 1, 0).getDate(), list = [];
          if (rule.byday.length) {
            rule.byday.forEach(function (b) {
              var hits = [];
              for (var dd = 1; dd <= len; dd++) if ((new Date(y, mm, dd).getDay() + 6) % 7 === b.d) hits.push(dd);
              if (!b.n) list = list.concat(hits); else { var h = b.n > 0 ? hits[b.n - 1] : hits[hits.length + b.n]; if (h) list.push(h); }
            });
          } else if (rule.bymonthday.length) {
            rule.bymonthday.forEach(function (md) { var dd = md > 0 ? md : len + md + 1; if (dd >= 1 && dd <= len) list.push(dd); });
          } else if (sp[2] <= len) list.push(sp[2]);
          list.sort(function (a, b) { return a - b; }).forEach(function (dd) { if (go) go = take(y + '-' + pad(mm + 1) + '-' + pad(dd)); });
        });
      }
    }
    return out;
  }
  /* weekly or daily, every week, no fancy rules: a repeating task */
  function icsWeekly(rule) {
    return rule && !rule.other && rule.interval === 1 && (rule.freq === 'DAILY' && !rule.bymonth.length || rule.freq === 'WEEKLY' && !rule.bymonth.length && rule.byday.every(function (b) { return !b.n; }));
  }
  /* the last date of a weekly repeat with a COUNT */
  function icsCountEnd(start, days, count) {
    var n = 0;
    for (var i = 0; i < 3700; i++) { var d = addDays(start, i); if (days.indexOf(dow(d)) >= 0 && ++n >= count) return d; }
    return null;
  }

  /* everything in one or more calendars, as dates and repeating tasks for this planner */
  function icsPlan(cals, prefix) {
    var t = today(), from = addDays(t, -ICS_PAST), to = addDays(t, ICS_AHEAD);
    var out = { events: [], tasks: [], skipped: 0, past: 0, names: [] };
    cals.forEach(function (cal) {
      if (cal.name) out.names.push(cal.name);
      var masters = {}, overrides = [];
      cal.events.forEach(function (ev) {
        if (!ev.start) return;
        if (ev.rid) overrides.push(ev); else masters[ev.uid || icsHash((ev.summary || '') + JSON.stringify(ev.start))] = ev;
      });
      function shape(ev) {
        var s = icsLocal(ev.start, cal.tz), e = ev.end ? icsLocal(ev.end, cal.tz) : null;
        if (!s) return null;
        var all = !s.time, mins = e ? Math.round((e.ms - s.ms) / 60000) : ev.dur != null ? ev.dur : all ? 1440 : 60;
        var o = { date: s.date, at: s.time, dur: null, end: null };
        if (all) {
          var last = addDays(s.date, Math.max(1, Math.round(mins / 1440)) - 1);
          if (last > s.date) o.end = last;
        } else if (mins > 720) {
          /* a timed thing over 12 hours: shown as whole days */
          o.at = null;
          var lastT = toISO(new Date(s.ms + mins * 60000 - 1));
          if (lastT > s.date) o.end = lastT;
        } else o.dur = cleanDur(mins, 60);
        return o;
      }
      function base(ev, key) {
        var text = String(ev.summary || '').trim() || 'Untitled', sub = icsSubject(text), sh = shape(ev);
        if (!sh) return null;
        var title = icsTitle(text, sub), type = icsType(text, !sh.at);
        return { key: key, sh: sh, title: title || (sub ? '' : text.slice(0, 80)), subject: sub ? sub.id : null, type: type, note: icsNote(ev) };
      }
      function pushEvent(b, date, key) {
        var end = b.sh.end ? addDays(b.sh.end, diff(b.sh.date, date)) : null;
        if ((end || date) < from || date > to) { out.past++; return; }
        var ext = prefix + key;
        out.events.push({ id: 'x' + icsHash(ext), ext: ext, type: b.type, subject: b.subject, title: b.title, detail: '', start: date, end: end, at: b.sh.at, dur: b.sh.at ? b.sh.dur : null, note: b.note, done: false });
      }
      Object.keys(masters).forEach(function (uid) {
        var ev = masters[uid];
        if (ev.status === 'CANCELLED') return;
        var key = icsHash(uid), b = base(ev, key);
        if (!b) return;
        var mine = overrides.filter(function (o) { return (o.uid || '') === uid; });
        var exd = ev.ex.map(function (x) { var l = icsLocal(x, cal.tz); return l && l.date; }).filter(Boolean);
        mine.forEach(function (o) { var l = icsLocal(o.rid, cal.tz); if (l) exd.push(l.date); });
        if (!ev.rule) { pushEvent(b, b.sh.date, key); }
        else if (icsWeekly(ev.rule) && !b.sh.end) {
          var days = ev.rule.freq === 'DAILY' ? (ev.rule.byday.length ? ev.rule.byday.map(function (x) { return x.d; }) : [0, 1, 2, 3, 4, 5, 6]) : ev.rule.byday.length ? ev.rule.byday.map(function (x) { return x.d; }) : [dow(b.sh.date)];
          days = days.filter(function (d, i, a) { return a.indexOf(d) === i; }).sort();
          var until = ev.rule.until ? icsLocal(ev.rule.until, cal.tz).date : ev.rule.count ? icsCountEnd(b.sh.date, days, ev.rule.count) : null;
          if (until && until < from) { out.past++; }
          else {
            var ext = prefix + key, text = String(ev.summary || '').trim() || 'Untitled';
            out.tasks.push({
              id: 'x' + icsHash(ext), ext: ext, title: text.slice(0, 200), subject: b.subject, due: b.sh.date, at: b.sh.at, event: null,
              est: b.sh.at ? b.sh.dur : null, notes: b.note, done: false, doneAt: null, created: t,
              rep: days, until: until, doneOn: [], skip: exd.filter(function (d) { return d >= b.sh.date; }).sort().slice(-300)
            });
          }
        } else {
          icsDates(b.sh.date, ev.rule, from, to).forEach(function (d) { if (exd.indexOf(d) < 0) pushEvent(b, d, key + ':' + d.replace(/-/g, '')); });
        }
        ev.rd.forEach(function (x) { var l = icsLocal(x, cal.tz); if (l && exd.indexOf(l.date) < 0) pushEvent(b, l.date, key + ':' + l.date.replace(/-/g, '')); });
        /* a changed or moved single day of a repeat */
        mine.forEach(function (o) {
          if (o.status === 'CANCELLED') return;
          var l = icsLocal(o.rid, cal.tz), ob = base(o, key);
          if (l && ob) pushEvent(ob, ob.sh.date, key + ':r' + l.date.replace(/-/g, ''));
        });
      });
    });
    /* the same event twice (two calendars, or a file and its zip) counts once */
    var seen = {};
    out.events = out.events.filter(function (e) { if (seen[e.ext]) return false; seen[e.ext] = 1; return true; }).sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0; });
    out.tasks = out.tasks.filter(function (x) { if (seen[x.ext]) return false; seen[x.ext] = 1; return true; });
    if (out.events.length > ICS_MAX) { out.skipped += out.events.length - ICS_MAX; out.events = out.events.slice(0, ICS_MAX); }
    if (out.tasks.length > 60) { out.skipped += out.tasks.length - 60; out.tasks = out.tasks.slice(0, 60); }
    return out;
  }

  /* ---------- reading files: .ics, or a .zip of them (Google Calendar's export) ---------- */
  function readFileBytes(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(new Uint8Array(r.result)); };
      r.onerror = function () { reject(new Error('read')); };
      r.readAsArrayBuffer(file);
    });
  }
  function utf8(bytes) { return new TextDecoder('utf-8').decode(bytes); }
  function inflateRaw(bytes) {
    if (typeof DecompressionStream !== 'function') return Promise.reject(new Error('nozip'));
    var ds = new DecompressionStream('deflate-raw');
    var out = new Response(new Blob([bytes]).stream().pipeThrough(ds));
    return out.arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }
  /* the .ics files inside a zip, read from its central directory */
  function unzipICS(bytes) {
    var v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), eocd = -1;
    for (var i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) { if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
    if (eocd < 0) return Promise.reject(new Error('zip'));
    var count = v.getUint16(eocd + 10, true), at = v.getUint32(eocd + 16, true), jobs = [];
    for (var k = 0; k < count && at + 46 <= bytes.length; k++) {
      if (v.getUint32(at, true) !== 0x02014b50) break;
      var method = v.getUint16(at + 10, true), size = v.getUint32(at + 20, true), nameLen = v.getUint16(at + 28, true),
        extraLen = v.getUint16(at + 30, true), commentLen = v.getUint16(at + 32, true), local = v.getUint32(at + 42, true);
      var name = utf8(bytes.subarray(at + 46, at + 46 + nameLen));
      at += 46 + nameLen + extraLen + commentLen;
      if (!/\.ics$/i.test(name) || /(^|\/)__MACOSX\//.test(name) || size > 8e6) continue;
      var start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true), data = bytes.subarray(start, start + size);
      jobs.push(method === 0 ? Promise.resolve(data) : method === 8 ? inflateRaw(data) : Promise.reject(new Error('zip')));
      if (jobs.length >= 20) break;
    }
    if (!jobs.length) return Promise.reject(new Error('empty'));
    return Promise.all(jobs).then(function (list) { return list.map(utf8); });
  }
  function icsFromFile(file) {
    if (file.size > 20e6) return Promise.reject(new Error('big'));
    return readFileBytes(file).then(function (b) {
      if (b[0] === 0x50 && b[1] === 0x4b) return unzipICS(b);
      return [utf8(b)];
    }).then(function (texts) {
      var cals = texts.map(parseICS).filter(function (c) { return c.events.length; });
      if (!cals.length) throw new Error(texts.some(function (x) { return /BEGIN:VCALENDAR/i.test(x); }) ? 'empty' : 'notics');
      return cals;
    });
  }
  function icsFromLink(url) {
    return api('POST', '/api/ics', { url: url }, { timeout: 30000 }).then(function (r) {
      if (r.status === 200 && r.data && typeof r.data.text === 'string') {
        var cal = parseICS(r.data.text);
        if (!cal.events.length) throw new Error('empty');
        return [cal];
      }
      var code = r.data && r.data.error;
      throw new Error(code === 'link' ? 'link' : code === 'gone' ? 'gone' : code === 'private' ? 'private' : code === 'not_ics' ? 'notics' : code === 'too_big' ? 'big' : code === 'slow' ? 'slow' : 'fetch');
    }, function () { throw new Error('offline'); });
  }
  var ICS_ERR = {
    big: 'That calendar is too big. Export a single calendar, or a shorter range.',
    notics: 'That isn’t a calendar file. Look for a file that ends in .ics, or Google’s .zip.',
    empty: 'That calendar has no events in it.',
    zip: 'Couldn’t open that zip. Unzip it and pick the .ics file inside.',
    nozip: 'This browser can’t open zip files. Unzip it and pick the .ics file inside.',
    read: 'Couldn’t read that file.',
    link: 'That link doesn’t work here. Use a webcal:// or https:// calendar link.',
    gone: 'That calendar link no longer works. Get a new one from your calendar app.',
    private: 'That calendar is private. Make it public, or use Google’s secret address in iCal format.',
    slow: 'Too many tries. Wait a few minutes, then try again.',
    offline: 'You’re offline. Connect to the internet and try again.',
    fetch: 'Couldn’t get that calendar right now. Check the link and try again.'
  };
  function icsErr(e) { return ICS_ERR[e && e.message] || ICS_ERR.read; }

  /* ---------- applying an import ---------- */
  /* one-time imports skip what's already here; a linked calendar updates its own dates and
     removes the ones that left it, and keeps what you changed: the kind, subject, done, reminders */
  function icsApply(plan, feedId) {
    var tag = feedId ? 'f:' + feedId + ':' : null, have = {}, res = { added: 0, updated: 0, removed: 0, tasks: 0 };
    S.events.forEach(function (e) { if (e.ext) have[e.ext] = e; });
    S.tasks.forEach(function (x) { if (x.ext) have[x.ext] = x; });
    var keep = {};
    /* linking a calendar you imported as a file before: its dates join the link instead of doubling */
    function adopt(ext) {
      var o = tag && have['i:' + ext.slice(tag.length)];
      if (o) { o.ext = ext; have[ext] = o; }
      return o || null;
    }
    plan.events.forEach(function (e) {
      keep[e.ext] = 1;
      var old = have[e.ext] || adopt(e.ext);
      if (!old) { S.events.push(e); res.added++; return; }
      if (!tag) return;
      var before = JSON.stringify([old.title, old.start, old.end, old.at, old.dur, old.note]);
      old.title = e.title; old.start = e.start; old.end = e.end; old.at = e.at; old.dur = e.dur; old.note = e.note;
      if (before !== JSON.stringify([old.title, old.start, old.end, old.at, old.dur, old.note])) res.updated++;
    });
    plan.tasks.forEach(function (x) {
      keep[x.ext] = 1;
      var old = have[x.ext] || adopt(x.ext);
      if (!old) { S.tasks.push(x); res.tasks++; return; }
      if (!tag) return;
      var before = JSON.stringify([old.title, old.due, old.at, old.est, old.rep, old.until, old.skip]);
      old.title = x.title; old.due = x.due; old.at = x.at; old.est = x.est; old.rep = x.rep; old.until = x.until; old.skip = x.skip; old.notes = x.notes;
      if (before !== JSON.stringify([old.title, old.due, old.at, old.est, old.rep, old.until, old.skip])) res.updated++;
    });
    if (tag) {
      var t = addDays(today(), -ICS_PAST);
      S.events = S.events.filter(function (e) { var gone = e.ext && e.ext.indexOf(tag) === 0 && !keep[e.ext] && evEnd(e) >= t; if (gone) res.removed++; return !gone; });
      S.tasks = S.tasks.filter(function (x) { var gone = x.ext && x.ext.indexOf(tag) === 0 && !keep[x.ext]; if (gone) res.removed++; return !gone; });
    }
    return res;
  }
  function stateFits() {
    var n = JSON.stringify(S).length;
    return n < (isFree() ? 290000 : 580000);
  }

  /* ---------- the Import sheet ---------- */
  var IMPORT = { how: 'iphone', link: '', keep: true };
  var IMPORT_HOW = {
    iphone: ['iPhone', [
      'Open the Calendar app and tap <b>Calendars</b> at the bottom.',
      'Tap <b>ⓘ</b> next to the calendar you want.',
      'Turn on <b>Public Calendar</b>, tap <b>Share Link</b>, then <b>Copy</b>.',
      'Paste the link above and tap <b>Get Events</b>.'
    ], 'Only iCloud calendars can share a link. Leave Public Calendar on if you keep it updated here.'],
    mac: ['Mac', [
      'In the Calendar app, click the calendar in the sidebar.',
      'Choose <b>File → Export → Export…</b> and save the file.',
      'Tap <b>Choose a File</b> above and pick it.'
    ], 'A file is a one-time copy. For updates, use a link from iPhone or Google instead.'],
    google: ['Google', [
      'On a computer, open <b>calendar.google.com</b>, click the gear, then <b>Settings</b>.',
      'Click your calendar under <b>Settings for my calendars</b>.',
      'Under <b>Integrate calendar</b>, copy the <b>Secret address in iCal format</b>.',
      'Paste it above and tap <b>Get Events</b>.'
    ], 'Want every calendar at once? Settings → Import & export → Export gives you a .zip. Choose that file above.']
  };
  function openImport() {
    curSheet = openImport;
    var h = IMPORT_HOW[IMPORT.how], feeds = S.settings.feeds;
    var steps = '<ol class="how-steps">' + h[1].map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>';
    var body = '<div class="plus-hero import-hero"><span class="plus-badge cal">' + icon('calendar') + '</span><h3>Bring Your Calendar</h3>' +
        '<p>Exams, deadlines and plans from Apple Calendar, Google Calendar or your school’s calendar.</p></div>' +
      grp(rButton(icon('upload') + 'Choose a File (.ics or .zip)', 'imp-file') +
        '<input type="file" id="ics-file" accept=".ics,.ical,.icalendar,.zip,text/calendar,application/zip" hidden>', 'From a file') +
      grp('<label class="row"><span class="sr">Calendar link</span><input class="row-field" type="url" id="ics-link" inputmode="url" autocapitalize="off" spellcheck="false" maxlength="600" placeholder="webcal:// or https:// link" value="' + esc(IMPORT.link) + '"></label>' +
          rSwitch('Keep It Updated', 'keep', 'ics-keep', IMPORT.keep) +
          rButton(icon('download') + 'Get Events', 'imp-link', '', 'accent-text'),
        'From a link', 'Updated calendars refresh every 6 hours while ' + BRAND + ' is open.') +
      (feeds.length ? grp(feeds.map(function (f) {
          var info = f.err ? 'Couldn’t update · ' + (f.at ? agoText(f.at) : 'never') : f.at ? f.n + ' dates · updated ' + agoText(f.at) : 'Not updated yet';
          return '<div class="row feed-row"><span class="two-line"><b>' + esc(f.name) + '</b><span>' + esc(info) + '</span></span>' +
            '<button type="button" class="btn small" data-act="feed-sync" data-id="' + f.id + '">Update</button>' +
            '<button type="button" class="btn small danger-text" data-act="feed-del" data-id="' + f.id + '" aria-label="Remove ' + esc(f.name) + '">Remove</button></div>';
        }).join(''), 'Linked calendars', 'Remove takes out the link and the dates that came from it.') : '') +
      '<p class="group-head">How to get it</p><div class="group how-card"><div class="row"><span class="seg how-seg" role="group" aria-label="Where your calendar is">' +
        Object.keys(IMPORT_HOW).map(function (k) { return '<button type="button" data-act="imp-how" data-how="' + k + '" aria-pressed="' + (IMPORT.how === k) + '">' + IMPORT_HOW[k][0] + '</button>'; }).join('') +
        '</span></div><div class="row how-body">' + steps + '</div></div><p class="group-foot">' + esc(h[2]) + '</p>' +
      grp('<p class="row info-text">Weekly and daily repeats become repeating tasks. Other repeats become separate dates. ' + BRAND + ' guesses exams and deadlines from their titles; tap any date to change it.</p>', 'Good to know');
    openDialog({ title: 'Import Calendar', body: body, back: openSettings, backLabel: 'Settings' });
  }
  function agoText(ms) {
    var m = Math.round((Date.now() - ms) / 60000);
    return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago';
  }
  /* step two: what's in it, then Import */
  function openImportPreview(cals, src) {
    var pre = src.feed ? 'f:' + src.feed.id + ':' : 'i:', plan = icsPlan(cals, pre), have = {};
    S.events.forEach(function (e) { if (e.ext) have[e.ext] = 1; });
    S.tasks.forEach(function (x) { if (x.ext) have[x.ext] = 1; });
    function known(ext) { return have[ext] || (src.feed && have['i:' + ext.slice(pre.length)]); }
    var newEv = plan.events.filter(function (e) { return !known(e.ext); }), newTk = plan.tasks.filter(function (x) { return !known(x.ext); });
    var dup = plan.events.length - newEv.length + plan.tasks.length - newTk.length;
    var kinds = {};
    newEv.forEach(function (e) { kinds[e.type] = (kinds[e.type] || 0) + 1; });
    var name = src.feed ? src.feed.name : plan.names.join(', ') || src.name || 'Calendar';
    var rows = newEv.slice(0, 8).map(function (e) {
      var s = subj(e.subject);
      return '<li><span class="two-line"><b>' + esc(evFull(e)) + '</b><span>' + esc(fDay(e.start) + (e.at ? ' · ' + e.at : '')) + '</span></span><span class="type-chip t-' + e.type + '">' + esc(TYPE_ONE[e.type]) + '</span></li>';
    }).concat(newTk.slice(0, 4).map(function (x) {
      return '<li><span class="two-line"><b>' + esc(x.title) + '</b><span>' + esc(repText(x.rep) + (x.at ? ' · ' + x.at : '')) + '</span></span><span class="type-chip t-task">' + icon('repeat') + 'Repeats</span></li>';
    })).join('');
    var parts = [];
    if (newEv.length) parts.push(newEv.length + (newEv.length === 1 ? ' date' : ' dates'));
    if (newTk.length) parts.push(newTk.length + (newTk.length === 1 ? ' repeating task' : ' repeating tasks'));
    var notes = [];
    ['exam', 'mock', 'deadline', 'holiday'].forEach(function (k) { if (kinds[k]) notes.push(kinds[k] + ' ' + (kinds[k] === 1 ? TYPE_ONE[k].toLowerCase() : TYPE_MANY[k])); });
    var foot = [notes.length ? 'Looks like ' + notes.join(', ') + '.' : '', dup ? dup + ' already in your planner.' : '', plan.past ? plan.past + ' too old or too far ahead, left out.' : '', plan.skipped ? plan.skipped + ' more left out (too many).' : ''].filter(Boolean).join(' ');
    var nothing = !newEv.length && !newTk.length;
    openDialog({
      title: 'Import',
      body: '<div class="plus-hero import-hero"><span class="plus-badge cal">' + icon('calendar') + '</span><h3>' + esc(name) + '</h3><p>' +
          esc(nothing ? (src.feed ? 'It’s all here already. Linking keeps it up to date.' : 'Nothing new to add.') : parts.join(' and ') + ' to add.') + '</p></div>' +
        (rows ? grp('<ul class="dlg-list import-list">' + rows + '</ul>', 'First ones', foot) : grp('<p class="row info-text">' + esc(foot || 'Everything in it is already here.') + '</p>')),
      back: openImport, backLabel: 'Back',
      submitLabel: src.feed ? 'Link and Import' : nothing ? 'Done' : 'Import',
      onSubmit: function () {
        var snap = snapshot();
        if (src.feed) {
          var f = S.settings.feeds.filter(function (x) { return x.url === src.feed.url; })[0];
          if (!f) { f = src.feed; S.settings.feeds.push(f); }
          f.at = Date.now(); f.err = ''; f.n = plan.events.length + plan.tasks.length;
          src.feed = f;
        }
        var res = icsApply(plan, src.feed ? src.feed.id : null);
        if (!stateFits()) { S = sanitize(JSON.parse(snap)); toast('That’s more than your planner can hold. Import a smaller calendar.'); return false; }
        save(); render();
        toast(res.added || res.tasks ? 'Imported ' + [res.added ? res.added + (res.added === 1 ? ' date' : ' dates') : '', res.tasks ? res.tasks + (res.tasks === 1 ? ' repeating task' : ' repeating tasks') : ''].filter(Boolean).join(' and ') : src.feed ? 'Calendar linked' : 'Nothing new', snap);
        celebrate(null);
      }
    });
  }
  var TYPE_ONE = { deadline: 'Deadline', exam: 'Exam', mock: 'Mock', holiday: 'Holiday', grades: 'Grades', other: 'Event' };

  function importPicked(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    input.value = '';
    toast('Reading ' + file.name + '…');
    icsFromFile(file).then(function (cals) { openImportPreview(cals, { name: file.name.replace(/\.(ics|zip|ical)$/i, '') }); }, function (e) { toast(icsErr(e)); });
  }
  function importLink(btn) {
    var inp = $('#ics-link', dlg), url = (inp && inp.value || '').trim();
    IMPORT.link = url;
    IMPORT.keep = !!($('#ics-keep', dlg) || {}).checked;
    if (!/^(webcals?|https?):\/\/\S{4,}$/i.test(url)) { fieldError('#ics-link', 'Paste a webcal:// or https:// link.'); return; }
    if (IMPORT.keep && S.settings.feeds.length >= FEEDS_MAX && !S.settings.feeds.some(function (f) { return f.url === normLink(url); })) { fieldError('#ics-link', 'You can link up to ' + FEEDS_MAX + ' calendars. Remove one first.'); return; }
    if (btn) { btn.disabled = true; btn.classList.add('busy'); }
    icsFromLink(normLink(url)).then(function (cals) {
      var feed = IMPORT.keep ? S.settings.feeds.filter(function (f) { return f.url === normLink(url); })[0] || { id: uid('f'), url: normLink(url), name: (cals[0].name || hostOf(url)).slice(0, 60), at: 0, n: 0, err: '' } : null;
      IMPORT.link = '';
      openImportPreview(cals, { feed: feed, name: hostOf(url) });
    }, function (e) {
      if (btn && btn.isConnected) { btn.disabled = false; btn.classList.remove('busy'); }
      toast(icsErr(e));
    });
  }
  function normLink(u) { return String(u).trim().replace(/^webcals?:\/\//i, 'https://'); }
  function hostOf(u) { try { return new URL(normLink(u)).hostname.replace(/^www\./, ''); } catch (e) { return 'Calendar'; } }

  /* linked calendars: refresh one, or all that are due (every 6 hours while the app is open) */
  var FEED_BUSY = {};
  function feedSync(f, quiet) {
    if (!f || FEED_BUSY[f.id] || !SYNC.online) return Promise.resolve(null);
    FEED_BUSY[f.id] = true;
    return icsFromLink(f.url).then(function (cals) {
      var plan = icsPlan(cals, 'f:' + f.id + ':'), snap = snapshot();
      var res = icsApply(plan, f.id);
      if (!stateFits()) { S = sanitize(JSON.parse(snap)); throw new Error('big'); }
      f.at = Date.now(); f.err = ''; f.n = plan.events.length + plan.tasks.length;
      save();
      if (idle()) render(); else SYNC.needRender = true;
      if (!quiet) toast(res.added + res.updated + res.removed + res.tasks ? f.name + ' updated' : f.name + ' is up to date');
      return res;
    }, function (e) {
      f.at = Date.now(); f.err = (e && e.message) || 'fetch';
      save();
      if (!quiet) toast(icsErr(e));
      return null;
    }).then(function (r) {
      delete FEED_BUSY[f.id];
      if (dlg.open && curSheet === openImport) openImport();
      return r;
    });
  }
  function feedsDue() {
    if (MODE !== 'app' || !ME || !SYNC.online) return;
    var n = Date.now();
    S.settings.feeds.forEach(function (f) { if (n - (f.at || 0) > FEED_EVERY) feedSync(f, true); });
  }
  function cleanFeeds(v) {
    return (Array.isArray(v) ? v : []).filter(function (f) {
      return f && typeof f === 'object' && ID.test(f.id) && typeof f.url === 'string' && /^https?:\/\/\S{4,600}$/.test(f.url);
    }).slice(0, FEEDS_MAX).map(function (f) {
      return { id: f.id, url: f.url, name: str(f.name, 60).trim() || 'Calendar', at: Number(f.at) > 0 ? Math.round(Number(f.at)) : 0, n: Math.max(0, Math.round(Number(f.n)) || 0), err: typeof f.err === 'string' ? f.err.slice(0, 20) : '' };
    });
  }

  /* =========================================================
     Events
     ========================================================= */
  function parseTags(raw) {
    var subject = null;
    var title = raw.replace(/(^|\s)#([\p{L}\p{N}_-]+)/gu, function (m, sp, tag) {
      if (subject) return m;
      var q = norm(tag);
      var hit = S.subjects.filter(function (s) { return norm(s.id) === q || norm(s.short) === q || norm(s.name) === q; })[0] ||
        S.subjects.filter(function (s) { return norm(s.short).indexOf(q) === 0 || norm(s.name).split(/\s+/).some(function (w) { return w.indexOf(q) === 0; }); })[0];
      if (hit) { subject = hit.id; return sp; }
      return m;
    }).replace(/\s{2,}/g, ' ').trim();
    return { title: title || raw, subject: subject };
  }
  function newTask(title, sid, due) {
    return { id: uid('t'), title: title, subject: subj(sid) ? sid : null, due: due, event: null, est: null, notes: '', done: false, doneAt: null, created: today() };
  }
  function refocus(sel) { var el = $(sel); if (el) el.focus(); }

  /* =========================================================
     The iPhone app. Bloc for iOS shows this page and sets window.MyIBNative before it loads.
     This page sends it the timetable for the Home Screen widget and the dates for
     deadline reminders; the app sends back its answers through MyIBNativeReply.
     ========================================================= */
  var NATIVE = (function () {
    var n = window.MyIBNative, w = window.webkit;
    return n && typeof n === 'object' && w && w.messageHandlers && w.messageHandlers.myib ? n : null;
  })();
  function toNative(msg) {
    if (!NATIVE) return;
    try { window.webkit.messageHandlers.myib.postMessage(msg); } catch (e) { /* ignore */ }
  }
  /* Apple lets an app link to paying on the web only in some App Store countries (the app decides).
     The website always shows Plus and Support the Dev. */
  function sellHere() { return !NATIVE || NATIVE.links === true; }
  function openWeb(which) { toNative({ type: 'open', url: location.origin + '/?open=' + which }); }

  /* reminders: on or off per phone, and the time of day */
  var REMIND_TIMES = [['17:00', '17:00'], ['18:00', '18:00'], ['19:00', '19:00'], ['20:00', '20:00'], ['21:00', '21:00']];
  function remindPrefs() {
    var r = ME ? sjson('myib:remind:' + ME.id) || {} : {};
    return { on: r.on === true, asked: r.asked === true, time: REMIND_TIMES.some(function (x) { return x[0] === r.time; }) ? r.time : '19:00' };
  }
  function saveRemind(r) { if (ME) sset('myib:remind:' + ME.id, JSON.stringify({ on: !!r.on, asked: !!r.asked, time: r.time })); }

  var nativeTimer = null, nativeLast = '';
  function nativeSoon() {
    if (!NATIVE || !ME || MODE !== 'app') return;
    clearTimeout(nativeTimer);
    nativeTimer = setTimeout(nativeSync, 1200);
  }
  /* the next 8 days of classes, the next deadlines and exams, and every exam date (for the countdown) */
  function nativeSync(force) {
    clearTimeout(nativeTimer); nativeTimer = null;
    if (!NATIVE || !ME || MODE !== 'app') return;
    var t = today(), days = [];
    for (var i = 0; i < 8; i++) {
      var d = addDays(t, i);
      days.push({ date: d, lessons: blocksFor(d).map(function (b) { return { start: b.start, end: b.end, name: b.s.name, short: b.s.short, color: b.s.color }; }) });
    }
    var soon = S.events.filter(function (e) { return (e.type === 'deadline' || e.type === 'exam') && !e.done && e.start >= t; }).sort(byStart);
    function colorOf(e) { var s = subj(e.subject); return s ? s.color : '#8E8E93'; }
    var widget = {
      name: ME.name, updated: 0, days: days,
      due: soon.slice(0, 6).map(function (e) { return { date: e.start, title: evTitle(e), detail: evDetail(e) || '', type: e.type, color: colorOf(e) }; }),
      exams: S.events.filter(function (e) { return e.type === 'exam'; }).map(function (e) { return e.start; }).sort(),
      pet: petWidget()
    };
    var R = remindPrefs();
    var reminders = {
      on: R.on, time: cleanRem(S.settings.rem).eve,
      /* iOS keeps 64 at most: the soonest 60. An item with a date opens that day; the puppy's opens Pet. */
      items: !R.on ? [] : remItems(60).slice(0, 60).map(function (x) {
        var o = { id: x.id, at: x.at, title: x.title, body: x.body };
        if (x.date) o.date = x.date;
        return o;
      })
    };
    petImages();
    var key = JSON.stringify([widget, reminders]);
    if (key === nativeLast && !force) return;
    nativeLast = key;
    widget.updated = Date.now();
    toNative({ type: 'sync', widget: widget, reminders: reminders });
  }
  /* =========================================================
     Reminders. Each kind of date has a timeline (days before it), and any event can have its own.
     The list below becomes notifications: the iPhone app schedules them itself, the server sends
     them to browsers with Web Push, and an open app shows the ones that come due.
     ========================================================= */
  function remMs(d, hhmm) { var p = d.split('-').map(Number), q = hhmm.split(':').map(Number); return new Date(p[0], p[1] - 1, p[2], q[0], q[1]).getTime(); }
  function remWhen(off, type) {
    var due = type === 'deadline', n = off === 7 ? '1 week' : off === 14 ? '2 weeks' : off + ' days';
    if (off === 0) return due ? 'Due today' : 'Today';
    if (off === 1) return due ? 'Due tomorrow' : 'Tomorrow';
    return due ? 'Due in ' + n : 'In ' + n;
  }
  function remOffsFor(e, R) { return Array.isArray(e.rem) ? e.rem : R.ev[e.type] || []; }
  /* the reminders after 'from' (default: now) for the next 'days' days */
  function remItems(days, from) {
    var R = cleanRem(S.settings.rem), n = from || nowMs(), t = today(), last = addDays(t, days || 45), out = [];
    S.events.forEach(function (e) {
      if (e.done || e.start < t) return;
      remOffsFor(e, R).forEach(function (off) {
        var d = addDays(e.start, -off);
        if (d > last) return;
        var at = remMs(d, off === 0 ? R.morn : R.eve);
        /* on the day of something early, 30 minutes before it */
        if (off === 0 && e.at && remMs(d, e.at) - 1800000 < at) at = remMs(d, e.at) - 1800000;
        if (at <= n) return;
        var body = [remWhen(off, e.type), evDetail(e), e.at || ''].filter(Boolean).join(' · ');
        out.push({ id: 'e-' + e.id + '-' + off, at: at, date: e.start, title: evTitle(e), body: body, url: '/?open=day&d=' + e.start });
      });
    });
    if (R.plan >= 0) {
      var lead = R.plan ? 'In ' + R.plan + ' min · ' : 'Starts now · ';
      S.plans.forEach(function (p) {
        if (p.date < t || diff(t, p.date) > 7) return;
        var at = remMs(p.date, p.at) - R.plan * 60000;
        if (at > n) out.push({ id: 'p-' + p.id, at: at, date: p.date, title: 'Study block: ' + planName(p), body: lead + p.at + '–' + hm(toMin(p.at) + p.dur), url: '/?open=day&d=' + p.date });
      });
      for (var i = 0; i <= 7; i++) {
        var d = addDays(t, i);
        tasksOn(d).forEach(function (x) {
          if (x.done || !x.at) return;
          var at = remMs(d, x.at) - R.plan * 60000;
          if (at > n) out.push({ id: 't-' + x.id + '-' + d, at: at, date: d, title: x.title, body: lead + x.at + (x.est ? ' for ' + dur(x.est) : ''), url: '/?open=day&d=' + d });
        });
      }
    }
    var pr = petReminder();
    if (pr && pr.at > n) out.push(Object.assign({ url: '/?open=pet' }, pr));
    return out.sort(function (a, b) { return a.at - b.at; });
  }
  function remAtText(ms) {
    var d = new Date(ms), day = toISO(d), n = diff(today(), day);
    return (n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : fDay(day)) + ' · ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  /* ---------- notifications in browsers (Web Push) ---------- */
  var PUSH = { timer: null, key: null };
  function pushAble() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!window.isSecureContext && !NATIVE; }
  /* iPhone Safari gets notifications only from an app on the Home Screen */
  function pushNeedsHome() { return !NATIVE && /iP(hone|ad|od)/.test(navigator.userAgent) && !navigator.standalone && !(window.matchMedia && matchMedia('(display-mode: standalone)').matches); }
  function pushMine() { return ME ? sjson('myib:push:' + ME.id) : null; }
  function b64uBytes(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var raw = atob(s), out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function swReady() {
    return new Promise(function (resolve, reject) {
      if (!('serviceWorker' in navigator)) return reject(new Error('sw'));
      var done = false;
      navigator.serviceWorker.ready.then(function (r) { done = true; resolve(r); });
      setTimeout(function () { if (!done) reject(new Error('sw')); }, 8000);
    });
  }
  function pushOn() {
    if (!pushAble()) return Promise.resolve(false);
    var ask = Notification.permission === 'granted' ? Promise.resolve('granted') : Notification.requestPermission();
    return Promise.resolve(ask).then(function (perm) {
      if (perm !== 'granted') { toast('Notifications are blocked for this site. Allow them in your browser’s site settings, then try again.'); return false; }
      return Promise.all([swReady(), api('GET', '/api/push/key')]).then(function (a) {
        var reg = a[0], r = a[1];
        if (r.status !== 200 || !r.data || !r.data.key) throw new Error('key');
        var key = b64uBytes(r.data.key);
        return reg.pushManager.getSubscription().then(function (sub) {
          /* a subscription made with another key can't get our messages: make a new one */
          if (sub && sub.options && sub.options.applicationServerKey) {
            var old = new Uint8Array(sub.options.applicationServerKey);
            if (old.length !== key.length || old.some(function (b, i) { return b !== key[i]; })) return sub.unsubscribe().then(function () { return null; });
          }
          return sub;
        }).then(function (sub) {
          return sub || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
        });
      }).then(function (sub) {
        var j = sub.toJSON ? sub.toJSON() : sub;
        return api('POST', '/api/push/sub', { endpoint: j.endpoint, keys: j.keys }).then(function (r) {
          if (r.status !== 200) throw new Error('sub ' + r.status);
          sset('myib:push:' + ME.id, JSON.stringify({ endpoint: j.endpoint, at: Date.now() }));
          sdel('myib:pushplan:' + ME.id);
          pushPlan();
          return true;
        });
      });
    }).catch(function () { toast('Couldn’t turn on notifications in this browser. Try again later.'); return false; });
  }
  function pushOff() {
    var mine = pushMine();
    sdel('myib:push:' + ME.id);
    var gone = mine ? api('POST', '/api/push/unsub', { endpoint: mine.endpoint }).catch(function () {}) : Promise.resolve();
    return gone.then(function () {
      return swReady().then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) { return sub && sub.unsubscribe(); }).catch(function () {});
    });
  }
  /* the server keeps each person's next reminders and sends them on time; this keeps that list fresh */
  function pushPlanSoon() { if (!ME || MODE !== 'app') return; clearTimeout(PUSH.timer); PUSH.timer = setTimeout(pushPlan, 3000); }
  function pushPlan() {
    clearTimeout(PUSH.timer); PUSH.timer = null;
    if (!ME || MODE !== 'app' || !SYNC.online) return;
    var items = remItems(45).slice(0, 150).map(function (x) { return { id: x.id, at: x.at, title: x.title, body: x.body, url: x.url }; });
    var text = JSON.stringify(items), h = 0;
    for (var i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
    var key = 'myib:pushplan:' + ME.id, mark = String(h) + ':' + today();
    if (sget(key) === mark) return;
    api('PUT', '/api/push/plan', { items: items }).then(function (r) { if (r.status === 200) sset(key, mark); }, function () {});
  }
  /* an open app shows what comes due: a toast on screen, a notification when it's in the background
     (only where the server isn't sending them already) */
  var REM_SEEN = { last: 0 };
  function remWatch() {
    if (MODE !== 'app' || !ME) return;
    var n = nowMs(), from = Math.max(REM_SEEN.last || n - 60000, n - 10 * 60000);
    REM_SEEN.last = n;
    var key = 'myib:remseen:' + ME.id, seen = sjson(key) || [];
    var due = remItemsCache().filter(function (x) { return x.at > from && x.at <= n && seen.indexOf(x.id) < 0; });
    if (!due.length) return;
    seen = seen.concat(due.map(function (x) { return x.id; })).slice(-200);
    sset(key, JSON.stringify(seen));
    var x = due[due.length - 1];
    if (NATIVE || pushMine()) return;
    if (!document.hidden) {
      toast(x.title + (x.body ? ' · ' + x.body : ''), null, { label: 'Open', fn: function () { openUrl(x.url); } }, 9000);
    } else if (!pushMine() && 'Notification' in window && Notification.permission === 'granted') {
      try { new Notification(x.title, { body: x.body, tag: x.id, icon: 'icons/icon-192.png' }).onclick = function () { window.focus(); openUrl(x.url); this.close(); }; } catch (e) { /* ignore */ }
    }
  }
  var REM_CACHE = { at: 0, list: [] };
  /* includes the last 10 minutes, so one that just came due is still in the list */
  function remItemsCache() {
    if (Date.now() - REM_CACHE.at > 60000) REM_CACHE = { at: Date.now(), list: remItems(2, nowMs() - 10 * 60000) };
    return REM_CACHE.list;
  }
  /* a link from a notification or a reminder: /?open=day&d=2026-11-06, /?open=pet */
  function openUrl(u) {
    var q;
    try { q = new URL(u, location.origin).searchParams; } catch (e) { return; }
    var what = q.get('open'), d = q.get('d');
    if (MODE !== 'app' || !ME) return;
    closeDialog();
    if (what === 'day' && DATE.test(d || '')) { UI.calSel = d; UI.calMonth = d.slice(0, 7); go('calendar'); }
    else if (what === 'pet') go('pet');
    else if (what === 'today') go('today');
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'open' && typeof e.data.url === 'string') openUrl(e.data.url);
    });
  }

  /* ---------- the Reminders sheet ---------- */
  var REM_LABEL = { 14: '2 wk', 7: '1 wk', 3: '3 d', 2: '2 d', 1: '1 d', 0: 'Day' };
  function remSay(offs) {
    if (!offs.length) return 'No reminders.';
    var parts = offs.map(function (o) { return o === 0 ? 'on the day' : (o === 1 ? '1 day' : o === 7 ? '1 week' : o === 14 ? '2 weeks' : o + ' days') + ' before'; });
    return 'Reminds you ' + (parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0]) + '.';
  }
  function remText(offs) {
    if (!offs.length) return 'None';
    return offs.map(function (o) { return o === 0 ? 'on the day' : o === 1 ? '1 day' : o === 7 ? '1 week' : o === 14 ? '2 weeks' : o + ' days'; }).join(', ');
  }
  /* a timeline you tap: two weeks before on the left, the day itself on the right */
  function remTrack(name, offs, attrs) {
    return '<div class="rem-track" role="group" aria-label="Remind me"' + (attrs || '') + '>' + REM_OFFS.map(function (o) {
      return '<label class="rem-dot' + (o === 0 ? ' day' : '') + '"><input type="checkbox" name="' + name + '" value="' + o + '"' + (offs.indexOf(o) >= 0 ? ' checked' : '') + ' data-change="rem-dot">' +
        '<span class="rem-pip" aria-hidden="true"></span><span class="rem-cap">' + REM_LABEL[o] + '</span><span class="sr">' + esc(o === 0 ? 'On the day' : remText([o]) + ' before') + '</span></label>';
    }).join('') + '</div>';
  }
  function openReminders() {
    curSheet = openReminders;
    var R = cleanRem(S.settings.rem), next = remItems(45).slice(0, 6);
    var kinds = [['exam', 'Exams and mocks'], ['deadline', 'Deadlines'], ['other', 'Other events']];
    var body = '<div class="plus-hero rem-hero"><span class="plus-badge bell">' + icon('bell') + '</span><h3>Reminders</h3><p>Pick when ' + BRAND + ' reminds you before each date. It sends them to this device as notifications.</p></div>' +
      deviceGroup() +
      kinds.map(function (k) {
        return grp('<div class="row rem-row">' + remTrack('rem-' + k[0], R.ev[k[0]], ' data-kind="' + k[0] + '"') + '</div>', k[1], esc(remSay(R.ev[k[0]])));
      }).join('') +
      grp('<div class="row wrap"><span class="row-label">Remind me</span><span class="row-value"><span class="seg" role="group" aria-label="Study blocks and timed tasks">' +
        [[-1, 'Off'], [0, 'At start'], [5, '5 min'], [15, '15 min'], [30, '30 min']].map(function (o) {
          return '<button type="button" data-act="rem-plan" data-v="' + o[0] + '" aria-pressed="' + (R.plan === o[0]) + '">' + o[1] + '</button>';
        }).join('') + '</span></span></div>', 'Study blocks and timed tasks', R.plan > 0 ? 'Minutes before each one starts.' : '') +
      grp(rSelect('Days before, at', 'eve', 'rem-eve', optionList(['16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'].map(function (x) { return [x, x]; }), R.eve), ' data-change="rem-time"') +
          rSelect('On the day, at', 'morn', 'rem-morn', optionList(['06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '10:00'].map(function (x) { return [x, x]; }), R.morn), ' data-change="rem-time"'),
        'Times', 'Something early on the day gets its reminder 30 minutes before it starts.') +
      grp(next.length ? '<ul class="dlg-list rem-next">' + next.map(function (x) {
          return '<li><span class="two-line"><b>' + esc(x.title) + '</b><span>' + esc(x.body) + '</span></span><span class="muted">' + esc(remAtText(x.at)) + '</span></li>';
        }).join('') + '</ul>' : '<p class="row info-text">Nothing in the next 45 days.</p>', 'Coming up');
    openDialog({ title: 'Reminders', body: body, back: openSettings, backLabel: 'Settings' });
  }
  function deviceGroup() {
    if (NATIVE) {
      var R = remindPrefs();
      return grp(rSwitch('Notifications', 'remind', 's-remind', R.on), 'This iPhone', R.on ? 'On. Your iPhone shows them even when ' + BRAND + ' is closed.' : 'Off. Turn them on to get reminders on this iPhone.');
    }
    if (pushNeedsHome()) return grp('<p class="row info-text">On iPhone, notifications need the ' + BRAND + ' app, or this site added to your Home Screen (Share → Add to Home Screen).</p>', 'This device');
    if (!pushAble()) return grp('<p class="row info-text">This browser can’t show notifications. ' + BRAND + ' still shows reminders here while it’s open.</p>', 'This device');
    if (Notification.permission === 'denied') return grp('<p class="row info-text">Notifications are blocked for this site. Allow them in your browser’s site settings.</p>', 'This browser');
    var on = !!pushMine() && Notification.permission === 'granted';
    return grp(rSwitch('Notifications', 'push', 's-push', on) + (on ? rButton(icon('bell') + 'Send a Test', 'push-test') : ''), 'This browser',
      on ? 'On. They arrive even when ' + BRAND + ' is closed, as long as the browser runs.' : 'Turn them on to get reminders on this computer or phone.');
  }
  function remSave(fn) {
    var R = cleanRem(S.settings.rem);
    fn(R);
    S.settings.rem = R;
    save();
    REM_CACHE.at = 0;
    pushPlanSoon(); nativeSoon();
  }
  function remRefresh() {
    var b = $('.sheet-body', dlg), top = b ? b.scrollTop : 0;
    openReminders();
    var b2 = $('.sheet-body', dlg); if (b2) b2.scrollTop = top;
  }

  /* the puppy for its widget: needs as saved (the widget counts down from 'at'), and pictures when its look changes */
  function petWidget() {
    var p = S.pet;
    if (!p) return null;
    var s = petState(p), c = petClock(p, s.t, true);
    return { name: p.name, breed: (petBreed(p.breed) || {}).name || '', stage: petStageName(s.stage), food: p.food, water: p.water, fun: p.fun, at: p.at,
      rateFood: PET_RATE.food, rateWater: PET_RATE.water, rateFun: PET_RATE.fun, treats: s.treats,
      sadAt: p.grave ? null : c.sadAt, graveAt: p.grave ? null : c.graveAt, grave: p.grave || 0, revive: PET_REVIVE - (p.grave ? p.rev : 0) };
  }
  /* a reminder when the puppy starts to miss you in exam season (at most every 10 minutes it moves) */
  function petReminder() {
    var p = S.pet;
    if (!p || p.grave) return null;
    var s = petState(p);
    if (s.dead || !s.sadAt || s.sadAt <= s.t) return null;
    return { id: 'pet', at: Math.round(s.sadAt / 600000) * 600000, title: p.name + ' misses you', body: 'Study in the next 12 hours, or ' + p.name + ' turns into a ghost.' };
  }
  var PET_IMG = { key: '', busy: false };
  function petImages() {
    var p = S.pet;
    if (!NATIVE || !p || !PETE || PET_IMG.busy) return;
    var look = petLook(p), key = [look.breed, look.coat, look.stage, look.wear.neck, look.wear.head, look.wear.face, look.wear.mouth, p.name].join('|');
    if (key === PET_IMG.key) return;
    PET_IMG.busy = true;
    var out = {};
    Promise.all(['happy', 'sad', 'sleep', 'grave'].map(function (pose) { return petPNG(look, pose, p.name).then(function (u) { if (u) out[pose] = u; }); })).then(function () {
      PET_IMG.busy = false;
      if (Object.keys(out).length !== 4 || !S.pet) return;
      PET_IMG.key = key;
      toNative({ type: 'petimg', key: key, images: out });
    });
  }
  function petPNG(look, pose, name) {
    return new Promise(function (resolve) {
      var svg = PETE.svg({ breed: look.breed, coat: look.coat, stage: look.stage, wear: look.wear, pose: pose === 'grave' ? 'sit' : pose, grave: pose === 'grave', name: name || '', noCar: true, frame: 150, width: 360 });
      var m = /width="(\d+)" height="(\d+)"/.exec(svg), w = m ? Number(m[1]) : 360, h = m ? Number(m[2]) : 324;
      var img = new Image();
      img.onload = function () {
        try {
          var c = document.createElement('canvas');
          c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL('image/png'));
        } catch (e) { resolve(null); }
      };
      img.onerror = function () { resolve(null); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }
  /* the app answers here: the notification permission, or new info (like whether pay links are allowed) */
  window.MyIBNativeReply = function (m) {
    if (!NATIVE || !m || typeof m !== 'object') return;
    if (m.type === 'permission') {
      var R = remindPrefs();
      R.on = m.ok === true; R.asked = true;
      saveRemind(R);
      nativeSync(true);
      if (m.ok === true) toast('Reminders are on');
      else toast('Notifications are off for ' + BRAND + '. Turn them on in the Settings app, then try again.');
      if (dlg.open && curSheet === openSettings) openSettings();
      else if (dlg.open && curSheet === openReminders) remRefresh();
    } else if (m.type === 'info' && m.info && typeof m.info === 'object') {
      if (typeof m.info.links === 'boolean') NATIVE.links = m.info.links;
      if (MODE === 'app' && ME) { if (dlg.open && curSheet === openSettings) openSettings(); else if (!dlg.open) softRender(); }
    }
  };
  /* the widget and the reminders open a section: MyIBNativeOpen('calendar', '2027-05-13') */
  window.MyIBNativeOpen = function (tab, date) {
    if (MODE !== 'app' || !ME) return;
    tab = isView(tab) ? tab : 'today';
    if (tab === 'calendar' && typeof date === 'string' && DATE.test(date)) { UI.calSel = date; UI.calMonth = date.slice(0, 7); }
    closeDialog();
    go(tab);
  };
  function remindTurnOn() { toNative({ type: 'permission' }); }
  function remindAsk() {
    if (!NATIVE || !ME || remindPrefs().asked) return;
    var tries = 0;
    setTimeout(function tryAsk() {
      if (!ME || MODE !== 'app' || remindPrefs().asked) return;
      if (dlg.open || !idle() || guideBusy() || document.hidden) { if (++tries < 30) setTimeout(tryAsk, 5000); return; }
      var R = remindPrefs();
      R.asked = true; saveRemind(R);
      openDialog({
        title: 'Reminders',
        body: '<div class="plus-hero"><span class="plus-badge bell">' + icon('bell') + '</span><h3>Never miss a deadline</h3>' +
            '<p>' + BRAND + ' reminds you a week, a day and the morning before each exam, and before each deadline. You pick the days in Settings → Reminders.</p></div>' +
          grp('<p class="row info-text">Add the ' + BRAND + ' widget too: touch and hold your Home Screen, tap Edit, then Add Widget, and pick ' + BRAND + '. It shows your next class and the days left to your exams.</p>', 'Widget'),
        submitLabel: 'Turn On',
        onSubmit: function () { remindTurnOn(); return true; }
      });
    }, 2500);
  }
  function remindGroup() {
    var on = NATIVE ? remindPrefs().on : !!pushMine();
    return grp(rNav('bell', 'Reminders', 'rem-open', on ? 'On' : 'Off'), '', 'Exams, deadlines, study blocks: pick when ' + BRAND + ' reminds you.');
  }
  /* Plus and Support the Dev: in the app they open myib.app in Safari, where Apple allows it */
  function shopGroup(p) {
    if (!NATIVE) return grp(rNav('star', p ? 'Bloc Plus' : 'Get Bloc Plus', 'plus-open', p ? 'On' : '') + rNav('heart', 'Support the Dev', 'support-open'));
    var web = function (ic, label, act) {
      return '<button type="button" class="row row-btn nav-row" data-act="' + act + '">' + icon(ic) + '<span class="row-label">' + esc(label) + '</span><span class="row-meta">myib.app</span>' + icon('out') + '</button>';
    };
    var rows = (p ? rNav('star', 'Bloc Plus', 'plus-open', 'On') : sellHere() ? web('star', 'Get Bloc Plus', 'plus-open') : '') +
      (sellHere() ? web('heart', 'Support the Dev', 'support-open') : '');
    return rows ? grp(rows, '', sellHere() ? 'Opens the Bloc website in Safari.' : '') : '';
  }
  function legalLinks() {
    return '<a class="row row-btn nav-row" href="/privacy" target="_blank" rel="noopener">' + icon('shield') + '<span class="row-label">Privacy Policy</span>' + icon('out') + '</a>' +
      '<a class="row row-btn nav-row" href="/support" target="_blank" rel="noopener">' + icon('info') + '<span class="row-label">Help and Contact</span>' + icon('out') + '</a>';
  }

  /* chat rules: once per person and device, before the first chat */
  var CHAT_RULES = [
    'Be kind. No bullying, insults, hate, threats or sexual content.',
    'Don’t share other people’s photos, phone numbers or private details.',
    'Bloc blocks some offensive words.',
    'Report messages that break these rules. Mauro reads every report, deletes what breaks them and can turn off chat for anyone who does.',
    'Block anyone you don’t want to hear from.'
  ];
  function chatAgreed() { return !!(ME && sget('myib:chatok:' + ME.id)); }
  function chatRulesHTML() {
    return '<section class="card chat-rules" aria-labelledby="cr-h"><span class="plus-badge">' + icon('chat') + '</span><h1 id="cr-h">Chat rules</h1>' +
      '<ul class="cr-list">' + CHAT_RULES.map(function (r) { return '<li>' + icon('check') + '<span>' + esc(r) + '</span></li>'; }).join('') + '</ul>' +
      '<p class="cr-foot">Bloc has zero tolerance for objectionable content and abusive users.</p>' +
      '<button type="button" class="btn primary cr-go" data-act="chat-agree">I Agree</button>' +
      '<a class="link cr-more" href="/privacy#chat" target="_blank" rel="noopener">Read the full rules</a></section>';
  }

  /* =========================================================
     Chat: direct messages, groups and the Suggestions channel.
     The server can't push, so the app asks for news: every 3 s in an open chat while
     people are talking, slower when it goes quiet, once a minute elsewhere (for the
     badge), and never while Bloc is in the background.
     ========================================================= */
  var CHANNEL = 'suggestions';
  var CONV_RE = /^(dm:[a-z0-9_.]{1,20}:[a-z0-9_.]{1,20}|g:[A-Za-z0-9_-]{12}|suggestions)$/;
  var OFFLINE_MSG = 'Can’t reach Bloc. Check your connection.';
  var wideMq = window.matchMedia ? window.matchMedia('(min-width: 761px)') : { matches: true };
  var CHAT = freshChat(), tmpN = 0, MSG_SEL = null;
  function freshChat() {
    return {
      gen: (CHAT ? CHAT.gen : 0) + 1, list: null, listAt: 0, listErr: false, listing: null,
      open: null, pushed: false, rooms: {}, people: {}, blocked: [], dev: ADMIN_ID, off: false,
      unread: 0, reports: 0, timer: null, active: 0, drafts: {}, dir: null, dirAt: 0, keep: null
    };
  }
  function wideChat() { return wideMq.matches; }
  function isView(t) { return t === 'chat' || TABS.some(function (x) { return x[0] === t; }); }
  function parseHash(h) {
    if (h === 'chat') return { tab: 'chat', conv: null };
    if (h.indexOf('chat/') === 0) {
      var id = '';
      try { id = decodeURIComponent(h.slice(5)); } catch (e) { id = ''; }
      return { tab: 'chat', conv: CONV_RE.test(id) ? id : null };
    }
    return { tab: TABS.some(function (t) { return t[0] === h; }) ? h : 'today', conv: null };
  }
  function chatHash() { return CHAT.open ? 'chat/' + encodeURIComponent(CHAT.open) : 'chat'; }
  function room(id) {
    return CHAT.rooms[id] || (CHAT.rooms[id] = { id: id, msgs: [], last: 0, since: 0, more: false, loaded: false, loading: null, fetching: false, info: null, err: '', needInfo: true, older: false });
  }
  function listEntry(id) { return (CHAT.list || []).filter(function (c) { return c.id === id; })[0] || null; }
  function dmPartner(id) { var p = id.split(':'); return p[1] === ME.id ? p[2] : p[1]; }
  function blockedId(id) { return CHAT.blocked.some(function (p) { return p.id === id; }); }

  /* people: names and photos, as the server last sent them (name null: the account is gone) */
  function learn(p) {
    if (!p || typeof p.id !== 'string') return;
    var o = CHAT.people[p.id] || (CHAT.people[p.id] = { id: p.id, name: undefined, avatar: null, free: KNOWN.indexOf(p.id) < 0 });
    if (p.name !== undefined) o.name = p.name;
    if (p.avatar !== undefined) o.avatar = p.avatar || null;
    if (p.free !== undefined) o.free = !!p.free;
  }
  function who(id) { return CHAT.people[id] || { id: id, name: undefined, avatar: null, free: KNOWN.indexOf(id) < 0 }; }
  function whoName(id) {
    if (ME && id === ME.id) return ME.name;
    var p = who(id);
    return p.name || (p.name === null ? 'Deleted account' : '@' + id);
  }
  function youOr(id) { return ME && id === ME.id ? 'You' : whoName(id); }
  function devTag(id) { return id && id === CHAT.dev ? '<span class="tag-dev">Dev</span>' : ''; }
  function nameList(ids) {
    var n = (Array.isArray(ids) ? ids : []).map(youOr);
    return n.length < 2 ? n.join('') : n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1];
  }

  /* one chat as the list and the open chat both know it */
  function convOf(id) {
    var e = listEntry(id), rm = CHAT.rooms[id], i = rm && rm.info;
    var kind = i ? i.kind : e ? e.kind : id === CHANNEL ? 'channel' : id.indexOf('dm:') === 0 ? 'dm' : 'group';
    var people = (i ? i.people : e ? e.people : []).filter(function (p) { return p.id !== ME.id; });
    var c = { id: id, kind: kind, name: i ? i.name : e ? e.name : null, state: i ? i.state : e ? e.state : 'in', people: people, off: CHAT.off || !!(i && i.off) };
    if (kind === 'dm') { c.partner = dmPartner(id); c.blocked = i ? !!i.blocked : blockedId(c.partner); }
    return c;
  }
  function convTitle(c) {
    if (c.kind === 'channel') return 'Suggestions';
    if (c.kind === 'dm') return whoName(c.partner);
    if (c.name) return c.name;
    var ps = c.people.filter(function (p) { return p.state !== 'left'; }).map(function (p) { return whoName(p.id); });
    if (!ps.length) return 'Group';
    return ps.length <= 3 ? ps.join(', ') : ps.slice(0, 2).join(', ') + ' and ' + (ps.length - 2) + ' more';
  }
  function convAvatar(c, size) {
    if (c.kind === 'dm') return avatar(c.partner, whoName(c.partner), size, who(c.partner).avatar);
    var ic = c.kind === 'channel' ? 'bulb' : 'users';
    return '<span class="chat-ic ' + c.kind + (size ? ' ' + size : '') + '" aria-hidden="true">' + icon(ic) + '</span>';
  }
  function sysText(m) {
    var o = {};
    try { o = JSON.parse(m.body) || {}; } catch (e) { o = {}; }
    var by = youOr(m.user);
    if (o.t === 'new') return by + ' made ' + (o.name ? '“' + o.name + '”' : 'the group');
    if (o.t === 'add') return by + ' added ' + nameList(o.who);
    if (o.t === 'name') return o.name ? by + ' named the group “' + o.name + '”' : by + ' removed the group name';
    if (o.t === 'left') return by + ' left';
    if (o.t === 'join') return by + ' joined';
    return '';
  }
  function preview(c) {
    var l = c.last;
    if (!l) return c.state === 'req' ? 'Wants to chat' : 'No messages yet';
    if (l.sys) return sysText(l);
    var mine = l.user === ME.id, text = l.del ? 'Message deleted' : String(l.body || '').replace(/\s+/g, ' ');
    if (mine) return 'You: ' + text;
    if (c.kind !== 'dm') return (l.name ? String(l.name).split(' ')[0] : 'Deleted account') + ': ' + text;
    return text;
  }

  /* times */
  function isoOf(ms) { return toISO(new Date(ms)); }
  function fTime(ms) { var d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function listTime(ms) {
    var day = isoOf(ms), n = diff(day, isoOf(Date.now()));
    if (n <= 0) return fTime(ms);
    if (n === 1) return 'Yesterday';
    if (n < 7) return DAYS[dow(day)];
    return fShort(day) + (day.slice(0, 4) !== isoOf(Date.now()).slice(0, 4) ? ' ' + day.slice(0, 4) : '');
  }
  function dayLabel(day) {
    var n = diff(day, isoOf(Date.now()));
    if (n <= 0) return 'Today';
    if (n === 1) return 'Yesterday';
    if (n < 7) return DAYS_LONG[dow(day)];
    return fDay(day) + (day.slice(0, 4) !== isoOf(Date.now()).slice(0, 4) ? ' ' + day.slice(0, 4) : '');
  }

  /* ---------- asking the server ---------- */
  function chatWake(ms) {
    clearTimeout(CHAT.timer);
    CHAT.timer = setTimeout(chatPoll, ms == null ? chatDelay() : ms);
  }
  function chatDelay() {
    var quiet = Date.now() - CHAT.active;
    if (UI.tab !== 'chat') return 60000;
    if (CHAT.open) return quiet < 90000 ? 3000 : quiet < 300000 ? 8000 : 20000;
    return quiet < 300000 ? 10000 : 30000;
  }
  function chatPoll() {
    clearTimeout(CHAT.timer); CHAT.timer = null;
    if (MODE !== 'app' || !ME || document.hidden) return;
    var gen = CHAT.gen, jobs = [];
    if (UI.tab === 'chat' && chatAgreed()) {
      if (CHAT.open) jobs.push(roomPoll(CHAT.open));
      var every = !CHAT.open || wideChat() ? 12000 : 45000;
      if (Date.now() - CHAT.listAt > every) jobs.push(chatLoadList());
    } else jobs.push(chatUnread());
    Promise.all(jobs).then(next, next);
    function next() { if (gen === CHAT.gen && !CHAT.timer) chatWake(); }
  }
  function chatUnread() {
    var gen = CHAT.gen;
    return api('GET', '/api/chat/unread', null, { timeout: 10000 }).then(function (r) {
      if (gen !== CHAT.gen) return;
      if (r.status === 200 && r.data) setUnread(r.data.unread, r.data.reports);
      else if (r.status === 401) sessionLost();
    }, function () {});
  }
  function countUnread() {
    return (CHAT.list || []).filter(function (c) { return c.last_seq > c.read && (c.kind !== 'channel' || ME.admin); }).length;
  }
  function setUnread(n, reports) {
    CHAT.unread = Math.max(0, Number(n) || 0);
    if (typeof reports === 'number') CHAT.reports = reports;
    paintBadge();
  }
  function paintBadge() {
    var b = $('#chat-btn');
    if (!b) return;
    var n = ME ? CHAT.unread + (ME.admin ? CHAT.reports : 0) : 0, el = $('.chat-badge', b);
    if (n > 0) {
      if (!el) { el = document.createElement('span'); el.className = 'chat-badge'; el.setAttribute('aria-hidden', 'true'); b.appendChild(el); }
      el.textContent = n > 99 ? '99+' : String(n);
    } else if (el) el.remove();
    b.setAttribute('aria-label', n ? 'Chats, ' + n + ' new' : 'Chats');
    document.title = n ? '(' + n + ') Bloc' : 'Bloc';
  }
  function chatLoadList() {
    if (CHAT.listing) return CHAT.listing;
    var gen = CHAT.gen;
    CHAT.listing = api('GET', '/api/chat/list', null, { timeout: 15000 }).then(function (r) {
      if (gen !== CHAT.gen) return;
      CHAT.listing = null;
      if (r.status === 401) return sessionLost();
      if (r.status !== 200 || !r.data || !Array.isArray(r.data.convs)) { CHAT.listErr = true; paintChatList(); return; }
      var d = r.data;
      CHAT.listErr = false; CHAT.listAt = Date.now();
      CHAT.dev = d.dev || ADMIN_ID; CHAT.off = !!d.off;
      CHAT.blocked = Array.isArray(d.blocked) ? d.blocked : [];
      CHAT.blocked.forEach(learn);
      CHAT.list = d.convs.filter(function (c) { return c && typeof c.id === 'string' && CONV_RE.test(c.id); });
      CHAT.list.forEach(function (c) {
        (c.people || []).forEach(learn);
        if (c.last && c.last.user && c.kind !== 'dm') learn({ id: c.last.user, name: c.last.name });
        /* the open chat may know newer messages than the list */
        var rm = CHAT.rooms[c.id];
        if (rm && rm.loaded) syncEntry(c, rm);
      });
      setUnread(countUnread(), d.reports);
      paintChatList();
      if (CHAT.open) { paintRoomHead(); paintRoomFoot(); }
    }, function () {
      if (gen !== CHAT.gen) return;
      CHAT.listing = null; CHAT.listErr = true; paintChatList();
    });
    return CHAT.listing;
  }
  /* the list entry catches up with what the open chat has shown */
  function syncEntry(e, rm) {
    var top = null;
    rm.msgs.forEach(function (m) { if (m.seq && (!top || m.seq > top.seq)) top = m; });
    if (top && top.seq > e.last_seq) {
      e.last_seq = top.seq; e.last_at = top.at;
      e.last = { seq: top.seq, user: top.user, name: top.user ? whoName(top.user) : null, body: top.body, sys: top.sys, del: top.del };
    }
    if (rm.read > e.read) e.read = Math.min(rm.read, e.last_seq);
  }
  function syncList(id) {
    var e = listEntry(id), rm = CHAT.rooms[id];
    if (!rm) return;
    if (!e) { if (CHAT.list && !CHAT.listing) chatLoadList(); return; }
    syncEntry(e, rm);
    setUnread(countUnread());
    paintChatList();
  }
  function seeing(id) { return MODE === 'app' && UI.tab === 'chat' && CHAT.open === id && !document.hidden; }
  function msgsUrl(id, q) { return '/api/chat/msgs?conv=' + encodeURIComponent(id) + q + (seeing(id) ? '&read=1' : ''); }

  function roomLoad(id) {
    var rm = room(id);
    if (rm.loading) return rm.loading;
    var gen = CHAT.gen;
    rm.err = '';
    rm.loading = api('GET', msgsUrl(id, '&full=1'), null, { timeout: 15000 }).then(function (r) {
      rm.loading = null;
      if (gen !== CHAT.gen) return;
      if (r.status === 401) return sessionLost();
      if (r.status === 404) return roomGone(id, true);
      if (r.status !== 200 || !r.data || !Array.isArray(r.data.msgs)) { rm.err = 'load'; if (CHAT.open === id) paintMsgs(); return; }
      var d = r.data;
      rm.msgs = rm.msgs.filter(function (m) { return m.tmp && !m.seq; });
      rm.last = 0;
      takeMsgs(rm, d);
      rm.more = !!d.more; rm.loaded = true; rm.since = d.now; rm.read = d.read || 0;
      if (d.info) takeInfo(rm, d.info);
      syncList(id);
      if (CHAT.open === id && chatShown()) { paintRoomHead(); paintRoomFoot(); paintMsgs(); scrollRoom(); }
    }, function () {
      rm.loading = null;
      if (gen !== CHAT.gen) return;
      rm.err = 'load';
      if (CHAT.open === id) paintMsgs();
    });
    return rm.loading;
  }
  function roomPoll(id) {
    var rm = room(id);
    if (!rm.loaded) return roomLoad(id);
    if (rm.fetching || rm.loading) return Promise.resolve();
    var gen = CHAT.gen;
    rm.fetching = true;
    return api('GET', msgsUrl(id, '&after=' + rm.last + '&since=' + rm.since + (rm.needInfo ? '&full=1' : '')), null, { timeout: 15000 }).then(function (r) {
      rm.fetching = false;
      if (gen !== CHAT.gen) return;
      if (r.status === 401) return sessionLost();
      if (r.status === 404) return roomGone(id, true);
      if (r.status !== 200 || !r.data || !Array.isArray(r.data.msgs)) return;
      var d = r.data, count = rm.msgs.length, gone = false;
      takeMsgs(rm, d);
      (d.deleted || []).forEach(function (seq) {
        rm.msgs.forEach(function (m) { if (m.seq === seq && !m.del) { m.del = 1; m.body = ''; gone = true; } });
      });
      if (d.info) takeInfo(rm, d.info);
      rm.since = d.now;
      if (d.read > (rm.read || 0)) rm.read = d.read;
      var fresh = rm.msgs.length > count;
      if (fresh) CHAT.active = Date.now();
      if (CHAT.open === id && chatShown() && (fresh || gone || d.info)) {
        var end = nearBottom();
        if (d.info) { paintRoomHead(); paintRoomFoot(); }
        paintMsgs();
        if (end) scrollRoom(); else if (fresh) showJump();
      }
      if (fresh || gone || d.read) syncList(id);
    }, function () { rm.fetching = false; });
  }
  function takeMsgs(rm, d) {
    var ppl = d.people || {};
    Object.keys(ppl).forEach(function (k) { learn(ppl[k]); });
    var bySeq = {};
    rm.msgs.forEach(function (m) { if (m.seq) bySeq[m.seq] = m; });
    (d.msgs || []).forEach(function (m) {
      if (!m || !(m.seq > 0)) return;
      if (m.seq > rm.last) rm.last = m.seq;
      var have = bySeq[m.seq];
      if (have) { have.body = m.body; have.del = m.del ? 1 : 0; have.at = m.at; have.pending = false; have.failed = false; return; }
      if (!m.sys && m.user === ME.id) {
        /* your own message, back from the server before its send finished */
        var tmp = rm.msgs.filter(function (x) { return x.tmp && !x.seq && !x.failed && x.body === m.body; })[0];
        if (tmp) { tmp.seq = m.seq; tmp.at = m.at; tmp.pending = false; bySeq[m.seq] = tmp; return; }
      }
      var x = { seq: m.seq, user: m.user, body: String(m.body || ''), at: m.at, sys: m.sys ? 1 : 0, del: m.del ? 1 : 0 };
      rm.msgs.push(x); bySeq[m.seq] = x;
      if (m.sys) rm.needInfo = true;
    });
    sortMsgs(rm);
  }
  function sortMsgs(rm) { rm.msgs.sort(function (a, b) { return (a.seq || 1e15 + a.n) - (b.seq || 1e15 + b.n); }); }
  function takeInfo(rm, i) {
    rm.info = i; rm.needInfo = false;
    (i.people || []).forEach(learn);
    if (typeof i.off === 'boolean') CHAT.off = i.off;
    var e = listEntry(rm.id);
    if (e) { e.state = i.state; e.name = i.name; e.people = (i.people || []).filter(function (p) { return p.id !== ME.id; }); }
  }
  /* a chat you left, deleted or were removed from */
  function roomGone(id, quiet) {
    delete CHAT.rooms[id];
    if (CHAT.list) CHAT.list = CHAT.list.filter(function (c) { return c.id !== id; });
    setUnread(countUnread());
    if (CHAT.open === id) {
      CHAT.open = null; CHAT.pushed = false;
      if (UI.tab === 'chat') { try { history.replaceState(null, '', '#chat'); } catch (e) { /* ignore */ } }
      if (quiet) toast('That chat isn’t available any more');
      if (chatShown()) render();
    } else paintChatList();
  }

  /* ---------- sending ---------- */
  /* the same clean-up the server does, so your message matches its copy */
  function tidy(v) {
    var s = String(v).normalize('NFC').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]/g, '');
    return s.split('\n').map(function (l) { return l.replace(/\s+/g, ' ').trim(); }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  function chatSubmit() {
    var ta = $('#chat-input'), id = CHAT.open;
    if (!ta || !id) return;
    var body = tidy(ta.value);
    if (!body) { ta.focus(); return; }
    if (Array.from(body).length > 2000) { toast('That’s over 2,000 characters. Send it in two parts.'); return; }
    var rm = room(id);
    var m = { tmp: true, n: ++tmpN, seq: 0, user: ME.id, body: body, at: Date.now(), sys: 0, del: 0, pending: true };
    rm.msgs.push(m);
    ta.value = ''; CHAT.drafts[id] = ''; grow(ta);
    CHAT.active = Date.now();
    paintMsgs(); scrollRoom();
    postMsg(id, m, false);
    chatWake(2500);
  }
  function postMsg(id, m, retry) {
    var rm = room(id), gen = CHAT.gen;
    m.pending = true; m.failed = false; m.err = ''; m.lost = false;
    return api('POST', '/api/chat/send', { conv: id, body: m.body, retry: retry }, { timeout: 20000 }).then(function (r) {
      if (gen !== CHAT.gen) return;
      if (r.status === 200 && r.data && r.data.seq) {
        var twin = rm.msgs.filter(function (x) { return x !== m && x.seq === r.data.seq; })[0];
        if (twin) rm.msgs.splice(rm.msgs.indexOf(m), 1);
        else { m.seq = r.data.seq; m.at = r.data.at || m.at; }
        m.pending = false;
        rm.read = Math.max(rm.read || 0, r.data.seq);
        sortMsgs(rm);
        if (CHAT.open === id) paintMsgs();
        syncList(id);
        return;
      }
      m.pending = false; m.failed = true;
      var code = r.data && r.data.error;
      if (r.status === 401) return sessionLost();
      if (r.status === 404 && code === 'conv') return roomGone(id, true);
      if (code === 'words') {
        /* back into the typing box, so they can change it */
        rm.msgs = rm.msgs.filter(function (x) { return x !== m; });
        var ta = CHAT.open === id && $('#chat-input');
        if (ta && !ta.value) { ta.value = m.body; CHAT.drafts[id] = m.body; grow(ta); }
        if (CHAT.open === id) paintMsgs();
        toast('Bloc doesn’t allow some words in that message. Keep it kind.');
        return;
      }
      m.err = sendError(r, id);
      if (code === 'chat_off') CHAT.off = true;
      if (code === 'blocked' || code === 'chat_off' || code === 'request') { rm.needInfo = true; chatWake(300); }
      if (CHAT.open === id) paintMsgs();
    }, function () {
      if (gen !== CHAT.gen) return;
      m.pending = false; m.failed = true; m.lost = true;
      m.err = 'Not sent. Check your connection, then tap to try again.';
      if (CHAT.open === id) paintMsgs();
    });
  }
  function sendError(r, id) {
    var code = r.data && r.data.error, wait = r.data && r.data.wait;
    if (r.status === 429) return id === CHANNEL && wait > 15 ? 'You can post 10 suggestions an hour. Try again in ' + wait + ' min.' : 'Too many messages. Wait ' + (wait || 1) + ' min, then tap to try again.';
    if (code === 'blocked') return 'You can’t message ' + whoName(dmPartner(id)) + '.';
    if (code === 'chat_off') return 'Mauro turned off chat for your account.';
    if (code === 'request') return 'Accept the request first.';
    if (code === 'long') return 'Too long. A message can have up to 2,000 characters.';
    if (code === 'words') return 'Not sent: Bloc doesn’t allow some words in it. Keep it kind.';
    return 'Not sent. Tap to try again.';
  }

  /* ---------- drawing ---------- */
  function chatShown() { return MODE === 'app' && UI.tab === 'chat' && !!$('#chat'); }
  VIEWS.chat = function () {
    if (!chatAgreed()) return chatRulesHTML();
    return '<div class="chat' + (CHAT.open ? ' has-open' : '') + '" id="chat">' +
      '<section class="chat-side glass" aria-labelledby="chat-h">' +
        '<header class="chat-side-head"><h1 id="chat-h">Chats</h1><button type="button" class="btn small" data-act="chat-new">' + icon('compose') + 'New</button></header>' +
        '<div class="chat-list" id="chat-list">' + chatListHTML() + '</div>' +
      '</section>' +
      '<section class="chat-main glass" id="chat-main" aria-label="Chat">' + roomHTML() + '</section>' +
    '</div>';
  };
  function chatListHTML() {
    if (!CHAT.list) {
      return CHAT.listErr ? '<div class="cl-empty"><p>Can’t load your chats. Check your connection.</p><button type="button" class="btn small" data-act="chat-reload">Try Again</button></div>'
                          : '<div class="sheet-loading" role="status"><span class="spinner" aria-hidden="true"></span><span class="sr">Loading</span></div>';
    }
    var reqs = CHAT.list.filter(function (c) { return c.state === 'req'; });
    var rest = CHAT.list.filter(function (c) { return c.state !== 'req'; }).sort(function (a, b) {
      return (b.kind === 'channel') - (a.kind === 'channel') || (b.last_at || 0) - (a.last_at || 0);
    });
    var html = '';
    if (ME.admin && CHAT.reports) html += '<button type="button" class="cl-alert" data-act="admin-reports">' + icon('flag') + '<span>' + CHAT.reports + (CHAT.reports === 1 ? ' report to review' : ' reports to review') + '</span>' + icon('chev') + '</button>';
    if (CHAT.off) html += '<p class="cl-note">Mauro turned off chat for your account. You can still read your chats.</p>';
    if (reqs.length) html += '<p class="cl-head">Requests</p>' + reqs.map(clItem).join('') + '<p class="cl-head">Chats</p>';
    html += rest.map(clItem).join('');
    if (!rest.some(function (c) { return c.kind !== 'channel'; }) && !reqs.length) {
      html += '<div class="cl-empty"><p><b>No chats yet</b></p><p>Tap New to message someone from your class or start a group.</p></div>';
    }
    if (CHAT.blocked.length) html += '<button type="button" class="cl-blocked" data-act="chat-blocked">' + icon('block') + 'Blocked · ' + CHAT.blocked.length + '</button>';
    return html;
  }
  function clItem(e) {
    var c = convOf(e.id), unread = e.last_seq > e.read;
    return '<button type="button" class="cl-item' + (unread ? ' unread' : '') + '" data-act="chat-open" data-id="' + esc(e.id) + '"' + (e.id === CHAT.open ? ' aria-current="true"' : '') + '>' +
      convAvatar(c, 'md') +
      '<span class="cl-text"><span class="cl-top"><span class="cl-name">' + esc(convTitle(c)) + '</span>' + (c.kind === 'dm' ? devTag(c.partner) : '') +
        '<span class="cl-time">' + esc(e.last && e.last_at ? listTime(e.last_at) : '') + '</span></span>' +
      '<span class="cl-last"><span>' + esc(preview(e)) + '</span>' + (unread ? '<i class="cl-dot"><span class="sr">Unread</span></i>' : '') + '</span></span></button>';
  }
  function roomHTML() {
    var id = CHAT.open;
    if (!id) return '<div class="cm-empty">' + icon('chat') + '<p><b>Pick a chat</b></p><p>Or tap New to message someone from your class.</p></div>';
    var rm = room(id);
    return '<header class="cm-head" id="cm-head">' + roomHeadHTML(rm) + '</header>' +
      '<div class="cm-msgs" id="cm-msgs" role="log" aria-label="Messages">' + msgsHTML(rm) + '</div>' +
      '<button type="button" class="cm-jump" id="cm-jump" data-act="chat-jump" hidden>' + icon('down') + 'New messages</button>' +
      '<footer class="cm-foot" id="cm-foot">' + roomFootHTML(rm) + '</footer>';
  }
  function roomHeadHTML(rm) {
    var c = convOf(rm.id), sub;
    if (c.kind === 'channel') sub = 'Ideas for Bloc · everyone can read';
    else if (c.kind === 'dm') sub = who(c.partner).name === null ? 'Account deleted' : who(c.partner).free ? '@' + c.partner : 'Sociales 2 IB';
    else {
      var n = c.people.filter(function (p) { return p.state === 'in'; }).length + (c.state === 'in' ? 1 : 0);
      sub = n + (n === 1 ? ' person' : ' people');
    }
    return '<button type="button" class="icon-btn cm-back" data-act="chat-back" aria-label="Back to chats">' + icon('left') + '</button>' +
      '<button type="button" class="cm-title" data-act="chat-info" aria-label="' + esc(convTitle(c)) + ', chat info">' + convAvatar(c, 'sm') +
        '<span class="two-line"><b>' + esc(convTitle(c)) + (c.kind === 'dm' ? devTag(c.partner) : '') + '</b><span>' + esc(sub) + '</span></span></button>' +
      '<button type="button" class="icon-btn cm-info" data-act="chat-info" aria-label="Chat info" title="Chat info">' + icon('info') + '</button>';
  }
  function footKind(c) { return c.state === 'req' ? 'req' : c.off ? 'off' : c.kind === 'dm' && c.blocked ? 'blocked' : 'send'; }
  function roomFootHTML(rm) {
    var c = convOf(rm.id), k = footKind(c);
    if (k === 'req') {
      var p = c.kind === 'dm' ? c.partner : null;
      return '<div class="cm-bar" data-k="req"><p>' + (p ? '<b>' + esc(whoName(p)) + '</b>' + (who(p).free ? ' (@' + esc(p) + ')' : '') + ' wants to chat with you.' : 'You’re invited to this group.') + ' Accept to reply.</p>' +
        '<div class="cm-bar-btns"><button type="button" class="btn small danger" data-act="chat-decline">Delete</button>' +
        (p ? '<button type="button" class="btn small" data-act="chat-block" data-id="' + esc(p) + '">Block</button>' : '') +
        '<button type="button" class="btn small primary" data-act="chat-accept">Accept</button></div></div>';
    }
    if (k === 'off') return '<div class="cm-bar" data-k="off"><p>Mauro turned off chat for your account. You can still read your chats.</p></div>';
    if (k === 'blocked') {
      return '<div class="cm-bar" data-k="blocked"><p>You blocked ' + esc(whoName(c.partner)) + '.</p><div class="cm-bar-btns">' +
        '<button type="button" class="btn small" data-act="chat-unblock" data-id="' + esc(c.partner) + '">Unblock</button></div></div>';
    }
    return '<form class="cm-compose" data-form="chat-send" data-k="send" autocomplete="off">' +
      '<label class="sr" for="chat-input">Message</label>' +
      '<textarea id="chat-input" rows="1" maxlength="2000" placeholder="' + (c.kind === 'channel' ? 'Share an idea for Bloc' : 'Message') + '">' + esc(CHAT.drafts[rm.id] || '') + '</textarea>' +
      '<button type="submit" class="cm-send" aria-label="Send" title="Send">' + icon('up') + '</button></form>';
  }
  function emptyRoomHTML(c) {
    if (c.kind === 'channel') {
      return '<div class="cm-hello">' + convAvatar(c, 'lg') + '<p><b>Suggestions</b></p><p>Got an idea for Bloc? Post it here. Everyone with an account can read it and reply, and Mauro reads them all.</p></div>';
    }
    if (c.kind === 'dm') {
      var p = c.partner, req = who(p).free || isFree();
      return '<div class="cm-hello">' + avatar(p, whoName(p), 'lg', who(p).avatar) + '<p><b>' + esc(whoName(p)) + '</b></p><p>' +
        (req ? 'Your first message reaches ' + esc(whoName(p)) + ' as a request.' : 'Say hi to ' + esc(whoName(p)) + '.') + '</p></div>';
    }
    return '<div class="cm-hello"><p>No messages yet.</p></div>';
  }
  function msgsHTML(rm) {
    if (!rm.loaded) {
      return rm.err ? '<div class="cm-hello"><p>Couldn’t load this chat.</p><button type="button" class="btn small" data-act="chat-reload">Try Again</button></div>'
                    : '<div class="sheet-loading" role="status"><span class="spinner" aria-hidden="true"></span><span class="sr">Loading</span></div>';
    }
    var c = convOf(rm.id), group = c.kind !== 'dm', out = [];
    if (rm.more) out.push('<button type="button" class="cm-older" data-act="chat-older"' + (rm.older ? ' disabled' : '') + '>' + (rm.older ? 'Loading…' : 'Show Earlier Messages') + '</button>');
    /* in groups and Suggestions, messages from people you blocked stay hidden */
    var list = rm.msgs.filter(function (m) { return m.sys || !group || m.user === ME.id || !blockedId(m.user); });
    if (!list.some(function (m) { return !m.sys; }) && !rm.more) out.push(emptyRoomHTML(c));
    var prevDay = '', prev = null;
    list.forEach(function (m, i) {
      var day = isoOf(m.at);
      if (day !== prevDay) { out.push('<p class="msg-day">' + esc(dayLabel(day)) + '</p>'); prevDay = day; prev = null; }
      if (m.sys) { var t = sysText(m); if (t) out.push('<p class="msg-note">' + esc(t) + '</p>'); prev = null; return; }
      var next = list[i + 1], mine = m.user === ME.id;
      var first = !prev || prev.user !== m.user || m.at - prev.at > 300000;
      var last = !next || next.sys || next.user !== m.user || next.at - m.at > 300000 || isoOf(next.at) !== day || m.failed;
      var h = '';
      if (group && !mine && first) h += '<p class="msg-who">' + esc(whoName(m.user)) + devTag(m.user) + '</p>';
      h += '<div class="msg' + (mine ? ' mine' : '') + (first ? ' first' : '') + (last ? ' last' : '') + (m.del ? ' del' : '') + (m.pending ? ' pending' : '') + (m.failed ? ' failed' : '') + '">';
      if (group && !mine) {
        h += last && who(m.user).name !== null ? '<button type="button" class="msg-av" data-act="chat-person" data-id="' + esc(m.user) + '" aria-label="' + esc(whoName(m.user)) + '">' + avatar(m.user, whoName(m.user), 'sm', who(m.user).avatar) + '</button>'
                   : '<span class="msg-av" aria-hidden="true"></span>';
      }
      h += '<button type="button" class="bubble" data-act="chat-msg" data-seq="' + (m.seq || '') + '" data-tmp="' + (m.tmp ? m.n : '') + '">' +
        (m.del ? esc(mine ? 'You deleted this message' : 'Message deleted') : esc(m.body)) + '</button></div>';
      if (last) h += '<p class="msg-meta' + (mine ? ' mine' : '') + (m.failed ? ' err' : '') + (group && !mine ? ' indent' : '') + '">' + esc(m.failed ? m.err : m.pending ? 'Sending…' : fTime(m.at)) + '</p>';
      out.push(h);
      prev = m;
    });
    return out.join('');
  }
  function paintChatList() {
    var el = chatShown() && $('#chat-list');
    if (!el) return;
    var t = el.scrollTop;
    el.innerHTML = chatListHTML();
    el.scrollTop = t;
  }
  function paintMsgs() {
    var el = chatShown() && CHAT.open && $('#cm-msgs');
    if (el) el.innerHTML = msgsHTML(room(CHAT.open));
  }
  function paintRoomHead() {
    var el = chatShown() && CHAT.open && $('#cm-head');
    if (el) el.innerHTML = roomHeadHTML(room(CHAT.open));
  }
  /* the typing box is only swapped when the footer changes kind, so focus and text stay */
  function paintRoomFoot() {
    var el = chatShown() && CHAT.open && $('#cm-foot');
    if (!el) return;
    var cur = el.firstElementChild, k = footKind(convOf(CHAT.open));
    if (cur && cur.dataset.k === k && k === 'send') return;
    el.innerHTML = roomFootHTML(room(CHAT.open));
    var ta = $('#chat-input');
    if (ta) grow(ta);
  }
  function nearBottom() { var b = $('#cm-msgs'); return !b || b.scrollHeight - b.scrollTop - b.clientHeight < 90; }
  function scrollRoom() { var b = $('#cm-msgs'); if (b) b.scrollTop = b.scrollHeight; hideJump(); }
  function showJump() { var j = $('#cm-jump'); if (j) j.hidden = false; }
  function hideJump() { var j = $('#cm-jump'); if (j) j.hidden = true; }
  function grow(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, 140) + 'px'; }
  /* the chat fills the window: its height on big screens; on phones the open chat covers the screen above the keyboard */
  function sizeChat() {
    var el = $('#chat');
    if (!el) return;
    if (wideChat()) el.style.height = Math.max(440, Math.floor((window.innerHeight - (el.getBoundingClientRect().top + window.scrollY)) / zoomOf(el) - 20)) + 'px';
    else el.style.height = '';
    chatViewport();
  }
  function chatViewport() {
    var vv = window.visualViewport, root = document.documentElement;
    if (!vv) return;
    root.style.setProperty('--vv-h', Math.round(vv.height) + 'px');
    root.style.setProperty('--vv-top', Math.round(vv.offsetTop) + 'px');
    document.body.classList.toggle('kb-open', vv.height < window.innerHeight - 120);
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function () { if (chatShown()) chatViewport(); });
    window.visualViewport.addEventListener('scroll', function () { if (chatShown()) chatViewport(); });
  }
  window.addEventListener('resize', function () { if (chatShown()) sizeChat(); });
  if (wideMq.addEventListener) wideMq.addEventListener('change', function () { if (chatShown()) render(); });
  document.addEventListener('scroll', function (e) { if (e.target && e.target.id === 'cm-msgs' && nearBottom()) hideJump(); }, true);
  /* after the chat view is drawn */
  function chatMounted() {
    document.body.classList.toggle('chat-conv', !!CHAT.open);
    sizeChat();
    var ta = $('#chat-input');
    if (ta) { grow(ta); if (document.activeElement === ta) { var n = ta.value.length; ta.setSelectionRange(n, n); } }
    var box = $('#cm-msgs'), k = CHAT.keep;
    CHAT.keep = null;
    if (box) box.scrollTop = k && k.id === CHAT.open && !k.end ? k.top : box.scrollHeight;
    if (!CHAT.list || Date.now() - CHAT.listAt > 12000) chatLoadList();
    var rm = CHAT.open && room(CHAT.open);
    if (rm && !rm.loaded && !rm.loading) roomLoad(CHAT.open);
  }
  function chatKeep() {
    var box = $('#cm-msgs');
    CHAT.keep = box && CHAT.open ? { id: CHAT.open, top: box.scrollTop, end: nearBottom() } : null;
  }

  /* ---------- moving around ---------- */
  function chatOpen(id) {
    if (!id || !CONV_RE.test(id)) return;
    var wasOpen = CHAT.open;
    CHAT.open = id;
    CHAT.active = Date.now();
    UI.tab = 'chat';
    var h = '#' + chatHash();
    if (location.hash !== h) {
      try {
        /* phones: Back closes the chat; big screens swap chats in place */
        if (wideChat() || (wasOpen && CHAT.pushed)) history.replaceState(null, '', h);
        else { history.pushState(null, '', h); CHAT.pushed = true; }
      } catch (e) { /* ignore */ }
    }
    render();
    var rm = room(id);
    if (!rm.loaded) roomLoad(id);
    else { scrollRoom(); roomPoll(id); }
    var ta = $('#chat-input');
    if (ta && !coarse.matches) ta.focus({ preventScroll: true });
    chatWake();
  }
  function chatBack() {
    if (CHAT.pushed) { history.back(); return; }
    CHAT.open = null;
    try { history.replaceState(null, '', '#chat'); } catch (e) { /* ignore */ }
    render();
  }
  function chatStartDm(id) {
    api('POST', '/api/chat/dm', { user: id }).then(function (r) {
      if (r.status === 200 && r.data && r.data.conv) { closeDialog(); chatOpen(r.data.conv); chatLoadList(); return; }
      if (r.status === 401) return sessionLost();
      var code = r.data && r.data.error;
      toast(code === 'blocked' ? 'You can’t message ' + whoName(id) + '.' : code === 'chat_off' ? 'Mauro turned off chat for your account.' :
        r.status === 429 ? 'Too many new chats. Try again later.' : 'Couldn’t start the chat. Try again.');
    }, function () { toast(OFFLINE_MSG); });
  }
  function chatOlder() {
    var id = CHAT.open, rm = id && room(id);
    if (!rm || rm.older || !rm.more) return;
    var first = rm.msgs.filter(function (m) { return m.seq; })[0];
    if (!first) return;
    rm.older = true; paintMsgs();
    var gen = CHAT.gen;
    api('GET', '/api/chat/msgs?conv=' + encodeURIComponent(id) + '&before=' + first.seq).then(function (r) {
      rm.older = false;
      if (gen !== CHAT.gen) return;
      if (r.status === 200 && r.data && Array.isArray(r.data.msgs)) { takeMsgs(rm, r.data); rm.more = !!r.data.more; }
      else toast('Couldn’t load earlier messages. Try again.');
      var box = CHAT.open === id && $('#cm-msgs');
      if (!box) return;
      var h = box.scrollHeight, t = box.scrollTop;
      paintMsgs();
      box.scrollTop = box.scrollHeight - h + t;
    }, function () { rm.older = false; paintMsgs(); toast(OFFLINE_MSG); });
  }
  function findMsg(el) {
    var rm = CHAT.open && CHAT.rooms[CHAT.open];
    if (!rm) return null;
    var seq = Number(el.dataset.seq), n = Number(el.dataset.tmp);
    return rm.msgs.filter(function (m) { return seq ? m.seq === seq : m.tmp && m.n === n; })[0] || null;
  }
  function chatPost(path, body, okMsg, then) {
    return api('POST', path, body).then(function (r) {
      if (r.status === 200) { if (okMsg) toast(okMsg); if (then) then(r.data); return true; }
      if (r.status === 401) { sessionLost(); return false; }
      var code = r.data && r.data.error;
      toast(r.status === 429 ? 'Too many changes. Try again in ' + ((r.data && r.data.wait) || 1) + ' min.' :
        code === 'chat_off' ? 'Mauro turned off chat for your account.' : code === 'full' ? 'A group can have up to 50 people.' :
        code === 'users' ? 'You can’t add those people.' : code === 'words' ? 'Bloc doesn’t allow some words in that name.' : 'Something went wrong. Try again.');
      return false;
    }, function () { toast(OFFLINE_MSG); return false; });
  }

  /* ---------- sheets ---------- */
  function openMsg(el) {
    var m = findMsg(el), id = CHAT.open;
    if (!m || m.sys || m.del || m.pending) return;
    var c = convOf(id), mine = m.user === ME.id, rows;
    MSG_SEL = { conv: id, m: m };
    if (m.failed) rows = rButton(icon('refresh') + 'Try Again', 'chat-retry') + rButton('Delete', 'chat-drop', '', 'danger');
    else {
      rows = rButton(icon('copy') + 'Copy Text', 'chat-copy');
      if (!mine && c.kind !== 'dm' && who(m.user).name) rows += rButton(icon('chat') + 'Message ' + esc(whoName(m.user).split(' ')[0]), 'chat-dm', ' data-id="' + esc(m.user) + '"');
      if (mine || (ME.admin && c.kind === 'channel')) rows += rButton('Delete Message', 'chat-unsend', '', 'danger');
      if (!mine && !ME.admin) rows += rButton(icon('flag') + 'Report', 'chat-report', '', 'danger-text');
    }
    var d = new Date(m.at);
    openDialog({
      title: mine ? 'Your Message' : whoName(m.user),
      body: '<div class="msg-quote">' + esc(m.body) + '</div><p class="msg-quote-time">' + esc(dayLabel(isoOf(m.at)) + ', ' + fTime(m.at) + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '')) + '</p>' +
        grp(rows, '', m.failed ? '' : mine ? 'Deleting removes it for everyone in the chat.' : !ME.admin ? 'Report sends this message to Mauro. The sender doesn’t find out.' : '')
    });
  }
  function openChatInfo(id) {
    id = id || CHAT.open;
    if (!id) return;
    var c = convOf(id);
    curSheet = function () { openChatInfo(id); };
    var body;
    if (c.kind === 'channel') {
      body = '<div class="pfp-hero">' + convAvatar(c, 'xl') + '<p class="hero-name">Suggestions</p></div>' +
        grp('<p class="row info-text">Share ideas to make Bloc better. Everyone with a Bloc account can read them and reply. Keep it about Bloc and be kind. Mauro deletes messages that aren’t.</p>');
    } else if (c.kind === 'dm') {
      var p = c.partner, nm = whoName(p), gone = who(p).name === null;
      body = '<div class="pfp-hero">' + avatar(p, nm, 'xxl', who(p).avatar) + '<p class="hero-name">' + esc(nm) + devTag(p) + '</p>' +
          '<p class="hero-sub">' + esc(gone ? 'Account deleted' : who(p).free ? '@' + p : 'Sociales 2 IB') + '</p></div>' +
        (gone ? '' : grp(c.blocked ? rButton('Unblock ' + esc(nm), 'chat-unblock', ' data-id="' + esc(p) + '"', 'center')
                                   : rButton(icon('block') + 'Block ' + esc(nm), 'chat-block', ' data-id="' + esc(p) + '"', 'danger-text'), '',
          c.blocked ? '' : 'They can’t message you or add you to groups, and you stop seeing their messages in groups. Bloc doesn’t tell them.')) +
        grp(rButton('Delete Chat', 'chat-leave', '', 'danger'), '', 'Deletes the chat for you. ' + esc(nm) + ' keeps their copy.');
    } else {
      var inGroup = c.state === 'in' && !c.off;
      var ppl = c.people.filter(function (x) { return x.state !== 'left'; }).sort(function (a, b) { return whoName(a.id).localeCompare(whoName(b.id)); });
      var rows = (c.state === 'in' ? '<div class="row acct-row">' + avatar(ME.id, ME.name, '', ME.avatar) + '<span class="two-line"><b>You</b><span>' + esc(ME.name) + '</span></span></div>' : '') +
        ppl.map(function (x) {
          return '<button type="button" class="row row-btn acct-row" data-act="chat-person" data-id="' + esc(x.id) + '">' + avatar(x.id, whoName(x.id), '', who(x.id).avatar) +
            '<span class="two-line"><b>' + esc(whoName(x.id)) + devTag(x.id) + '</b><span>' + esc(x.state === 'req' ? 'Invited' : who(x.id).free ? '@' + x.id : 'Sociales 2 IB') + '</span></span>' + icon('chev') + '</button>';
        }).join('');
      body = '<div class="pfp-hero">' + convAvatar(c, 'xl') + '<p class="hero-name">' + esc(convTitle(c)) + '</p></div>' +
        (inGroup ? grp(rNav('', 'Group Name', 'chat-rename', c.name || 'None')) : '') +
        grp(rows, 'People · ' + (ppl.length + (c.state === 'in' ? 1 : 0))) +
        (inGroup ? grp(rButton(icon('plus') + 'Add People', 'chat-add')) : '') +
        grp(rButton(c.state === 'req' ? 'Delete Invite' : 'Leave Group', 'chat-leave', '', 'danger'), '',
          c.state === 'req' ? '' : 'You stop getting its messages. Someone in the group can add you back.');
    }
    openDialog({ title: c.kind === 'channel' ? 'About' : c.kind === 'dm' ? 'Chat Info' : 'Group Info', body: body });
  }
  function openChatPerson(id) {
    if (!id || id === ME.id) return;
    var p = who(id), nm = whoName(id), blocked = blockedId(id);
    curSheet = function () { openChatPerson(id); };
    openDialog({
      title: nm,
      body: '<div class="pfp-hero">' + avatar(id, nm, 'xxl', p.avatar) + '<p class="hero-name">' + esc(nm) + devTag(id) + '</p><p class="hero-sub">' + esc(p.free ? '@' + id : 'Sociales 2 IB') + '</p></div>' +
        (p.name === null ? '' :
          (blocked ? '' : grp(rButton(icon('chat') + 'Message', 'chat-dm', ' data-id="' + esc(id) + '"'))) +
          grp(blocked ? rButton('Unblock ' + esc(nm), 'chat-unblock', ' data-id="' + esc(id) + '"', 'center')
                      : rButton(icon('block') + 'Block ' + esc(nm), 'chat-block', ' data-id="' + esc(id) + '"', 'danger-text')))
    });
  }
  function openRename(id) {
    var c = convOf(id);
    openDialog({
      title: 'Group Name', back: function () { openChatInfo(id); }, backLabel: 'Group',
      body: grp(rField({ label: 'Group name', name: 'gname', id: 'gn-name', max: 40, value: c.name || '', placeholder: 'Group name', autofocus: true }), '', 'Everyone in the group sees the new name.'),
      submitLabel: 'Save',
      onSubmit: function (fd, form) {
        var name = clip(fd.get('gname'), 40);
        if (busyForm(form, true)) return false;
        chatPost('/api/chat/rename', { conv: id, name: name }, '', function () {
          room(id).needInfo = true; chatWake(100);
          var e = listEntry(id); if (e) e.name = name || null;
          if (room(id).info) room(id).info.name = name || null;
          paintChatList(); paintRoomHead();
          openChatInfo(id);
        }).then(function () { busyForm(form, false); });
        return false;
      }
    });
  }
  function openBlocked() {
    curSheet = openBlocked;
    var rows = CHAT.blocked.map(function (p) {
      return '<div class="row acct-row">' + avatar(p.id, whoName(p.id), '', p.avatar) + '<span class="two-line"><b>' + esc(whoName(p.id)) + '</b><span>' + esc(p.free ? '@' + p.id : 'Sociales 2 IB') + '</span></span>' +
        '<button type="button" class="btn small" data-act="chat-unblock" data-id="' + esc(p.id) + '">Unblock</button></div>';
    }).join('');
    openDialog({ title: 'Blocked', body: rows ? grp(rows, '', 'They can’t message you or add you to groups. Unblock someone to let them reach you again.') : '<p class="group-foot">You haven’t blocked anyone.</p>' });
  }

  /* New Chat, and Add People for a group */
  function openChatNew(opts) {
    opts = opts || {};
    var add = opts.add || null, skip = {};
    if (add) convOf(add).people.forEach(function (p) { if (p.state !== 'left') skip[p.id] = 1; });
    curSheet = function () { openChatNew(opts); };
    var body = '<div class="chat-pick">' +
      grp('<label class="row"><span class="sr">Search your class</span><input class="row-field" type="search" id="cn-q" placeholder="Search your class" autocomplete="off" autocapitalize="off" spellcheck="false"></label>') +
      '<div id="cn-people"><div class="sheet-loading" role="status"><span class="spinner" aria-hidden="true"></span><span class="sr">Loading</span></div></div>' +
      '<p class="group-head">Other students</p><div class="group" id="cn-found">' +
        '<div class="row cn-find"><span class="sr">Username</span><input class="row-field" type="text" id="cn-find" placeholder="Their username" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="21">' +
        '<button type="button" class="btn small" data-act="chat-find">Find</button></div></div>' +
      '<p class="group-foot" id="cn-find-msg">Find someone outside Sociales 2 IB by their exact username. Your first message reaches them as a request.</p>' +
      (add ? '' : '<div id="cn-name" hidden>' + grp(rField({ label: 'Group name', name: 'gname', id: 'cn-gname', max: 40, value: '', placeholder: 'Group name (optional)' }), 'Group') + '</div>') +
      '</div>';
    openDialog({
      title: add ? 'Add People' : 'New Chat', body: body, submitLabel: add ? 'Add' : 'Chat',
      back: add ? function () { openChatInfo(add); } : null, backLabel: 'Group',
      onSubmit: function (fd, form) { return chatNewSubmit(fd, form, add); }
    });
    pickChanged();
    var gen = CHAT.gen;
    loadDir().then(function (list) {
      var box = gen === CHAT.gen && dlg.open && $('#cn-people', dlg);
      if (!box) return;
      var ppl = list.filter(function (p) { return !skip[p.id]; });
      box.innerHTML = ppl.length ? grp(ppl.map(function (p) { return pickRow(p, false); }).join(''), 'Sociales 2 IB') :
        '<p class="group-head">Sociales 2 IB</p><p class="group-foot">' + (add ? 'Everyone from the class with an account is already here.' : 'Nobody else from the class has an account yet.') + '</p>';
      var q = $('#cn-q', dlg);
      if (q && q.value) filterPick(q.value);
    }, function () {
      var box = dlg.open && $('#cn-people', dlg);
      if (box) box.innerHTML = '<p class="group-foot err">' + esc(OFFLINE_MSG) + '</p>';
    });
  }
  function loadDir() {
    if (CHAT.dir && Date.now() - CHAT.dirAt < 300000) return Promise.resolve(CHAT.dir);
    return api('GET', '/api/chat/people').then(function (r) {
      if (r.status === 200 && r.data && Array.isArray(r.data.people)) {
        CHAT.dir = r.data.people; CHAT.dirAt = Date.now();
        if (r.data.dev) CHAT.dev = r.data.dev;
        CHAT.dir.forEach(learn);
        return CHAT.dir;
      }
      throw new Error('people ' + r.status);
    });
  }
  function pickRow(p, on) {
    var nm = p.name || p.id;
    return '<label class="row pick cn-row" data-find="' + esc(norm(nm + ' ' + p.id)) + '"><input type="checkbox" name="u" value="' + esc(p.id) + '"' + (on ? ' checked' : '') + '>' +
      avatar(p.id, nm, '', p.avatar) + '<span class="two-line"><b>' + esc(nm) + devTag(p.id) + '</b><span>' + esc(p.free ? '@' + p.id : 'Sociales 2 IB') + '</span></span>' + icon('tick') + '</label>';
  }
  function filterPick(q) {
    q = norm(String(q).trim());
    $$('#cn-people .cn-row', dlg).forEach(function (r) { r.hidden = !!q && r.dataset.find.indexOf(q) < 0; });
  }
  function pickChanged() {
    var n = $$('input[name="u"]:checked', dlg).length, add = $('#cn-name', dlg) === null;
    var b = $('.sheet-head [type="submit"]', dlg), pk = $('.chat-pick', dlg);
    if (pk && pk.dataset.mode === 'garden') { if (b) { b.disabled = !n; b.textContent = 'Invite'; } return; }
    if (b) { b.disabled = !n; b.textContent = add ? 'Add' : n > 1 ? 'Create' : 'Chat'; }
    var nm = $('#cn-name', dlg);
    if (nm) nm.hidden = n < 2;
  }
  function chatFindRun() {
    var inp = $('#cn-find', dlg), note = $('#cn-find-msg', dlg);
    if (!inp) return;
    var v = inp.value.trim().replace(/^@/, '').toLowerCase();
    if (!v) { inp.focus(); return; }
    function say(t, err) { if (note) { note.textContent = t; note.classList.toggle('err', !!err); } }
    say('Looking…');
    api('GET', '/api/chat/find?u=' + encodeURIComponent(v)).then(function (r) {
      if (!dlg.open || !$('#cn-find', dlg)) return;
      if (r.status === 429) return say('Too many searches. Try again later.', true);
      var p = r.status === 200 && r.data ? r.data.person : null;
      if (!p) return say(v === ME.id ? 'That’s you.' : 'Nobody has the username @' + v + '.', true);
      learn(p);
      var box = $('#cn-found', dlg), there = $$('input[name="u"]', dlg).filter(function (x) { return x.value === p.id; })[0];
      if (there) there.checked = true;
      else box.insertAdjacentHTML('beforeend', pickRow(p, true));
      inp.value = '';
      say((p.name || '@' + p.id) + ' is on the list.');
      pickChanged();
    }, function () { say(OFFLINE_MSG, true); });
  }
  function chatNewSubmit(fd, form, add) {
    var users = fd.getAll('u').map(String);
    if (!users.length || busyForm(form, true)) return false;
    function done() { busyForm(form, false); }
    if (add) {
      chatPost('/api/chat/add', { conv: add, users: users }, '', function (d) {
        var n = (d && d.added || []).length;
        toast(n === 1 ? 'Added ' + whoName(d.added[0]) : 'Added ' + n + ' people');
        room(add).needInfo = true; chatWake(100);
        openChatInfo(add);
      }).then(done);
    } else if (users.length === 1) {
      done(); chatStartDm(users[0]);
    } else {
      chatPost('/api/chat/group', { name: clip(fd.get('gname'), 40), users: users }, '', function (d) {
        closeDialog(); chatOpen(d.conv); chatLoadList();
      }).then(done);
    }
    return false;
  }

  /* ---------- Mauro: reported messages ---------- */
  function openReports(fromSettings) {
    curSheet = function () { openReports(fromSettings); };
    openDialog({ title: 'Chat Reports', body: '<div class="sheet-loading" role="status"><span class="spinner" aria-hidden="true"></span><span class="sr">Loading</span></div>', back: fromSettings ? openSettings : null, backLabel: 'Settings' });
    var mine = curSheet;
    api('GET', '/api/admin/reports').then(function (r) {
      if (curSheet !== mine) return;
      if (r.status === 401) return sessionLost();
      if (r.status !== 200 || !r.data || !Array.isArray(r.data.reports)) return sheetMessage('<p class="group-foot err">Couldn’t load the reports. Try again.</p>');
      CHAT.reports = r.data.reports.length; paintBadge(); paintChatList();
      sheetMessage(reportsHTML(r.data.reports));
    }, function () { if (curSheet === mine) sheetMessage('<p class="group-foot err">' + esc(OFFLINE_MSG) + '</p>'); });
  }
  function reportsHTML(list) {
    if (!list.length) return '<p class="group-foot">No reports. When someone reports a chat message, a puppy’s name or a garden’s name, it shows up here.</p>';
    return list.map(function (x, i) {
      var s = x.sender || {}, nm = s.name || 'Deleted account';
      var where = x.kind === 'channel' ? 'Suggestions' : x.kind === 'dm' ? 'a direct chat' : x.kind === 'group' ? (x.name ? '“' + x.name + '”' : 'a group') :
        x.kind === 'pet' ? 'a puppy’s name' : x.kind === 'garden' ? 'a garden’s name' : 'a deleted chat';
      var named = x.kind === 'pet' || x.kind === 'garden';
      var d = ' data-conv="' + esc(x.conv) + '" data-seq="' + esc(x.seq) + '"';
      var by = (x.by || []).map(function (p) { return p.name || 'Deleted account'; });
      return grp(
        (s.name ? '<button type="button" class="row row-btn acct-row" data-act="admin-user" data-id="' + esc(s.id) + '">' : '<div class="row acct-row">') + avatar(s.id || '?', nm, '', s.avatar) +
          '<span class="two-line"><b>' + esc(nm) + '</b><span>' + esc((s.free && s.name ? '@' + s.id + ' · ' : '') + 'in ' + where + ' · ' + ago(x.at)) + '</span></span>' + (s.name ? icon('chev') + '</button>' : '</div>') +
        '<p class="row rep-body">' + esc(x.body || '') + '</p>' +
        (x.gone ? '' : rButton(named ? (x.kind === 'pet' ? 'Rename to Puppy' : 'Rename to Study Garden') : 'Delete Message', 'admin-report-del', d, 'danger')) +
        rButton(x.gone ? 'Clear' : named ? 'Keep Name' : 'Keep Message', 'admin-report-ok', d, 'center'),
        i === 0 ? 'Reported · ' + list.length : '',
        'Reported by ' + esc(by.length < 2 ? by.join('') : by.slice(0, -1).join(', ') + ' and ' + by[by.length - 1]) + '.' +
          (x.gone ? (named ? ' The name already changed.' : ' The message is already gone.') : '') + (s.off ? ' Chat is off for ' + esc(nm) + '.' : ''));
    }).join('');
  }
  function adminReportAct(el, remove) {
    var named = /^(pet|gdn):/.test(el.dataset.conv || '');
    if (remove && !arm(el, named ? 'Press again to rename' : 'Press again to delete')) return;
    el.disabled = true;
    chatPost('/api/admin/report', { conv: el.dataset.conv, seq: Number(el.dataset.seq), remove: remove }, remove ? (named ? 'Name removed' : 'Message deleted') : 'Report cleared', function () {
      var rm = CHAT.rooms[el.dataset.conv];
      if (rm && remove) rm.msgs.forEach(function (m) { if (m.seq === Number(el.dataset.seq)) { m.del = 1; m.body = ''; } });
      if (rm && remove && CHAT.open === el.dataset.conv) paintMsgs();
      openReports(!!dlgBack);
    }).then(function () { if (el.isConnected) el.disabled = false; });
  }

  /* =========================================================
     Study pet: a puppy that grows with your study time.
     pet.js draws and animates it; this part keeps its stats in the planner (S.pet).
     Needs (0 to 100) are stored with the moment they were measured (at) and fall
     with time. Growth comes from logged study sessions, so it syncs with them.
     ========================================================= */
  var PETE = window.MyIBPetEngine || null;
  var PET_RATE = { food: 5, water: 100 / 14, fun: 100 / 24 };   /* points lost per hour: empty after 20 h, 14 h, 24 h */
  var PET_DAY_CAP = 480;                                           /* study minutes a day that count */
  /* Exam season: the 14 days before each exam or mock in the calendar, up to its last day.
     In exam season the puppy needs study at least every 48 hours: very sad at 36, a ghost at 48.
     25 minutes of study bring it back. Outside exam season nothing bad happens. */
  var PET_SEASON = 14, PET_SAD_H = 36, PET_GRAVE_H = 48, PET_REVIVE = 25, HOUR = 3600000;
  var PET_NAMES = ['Biscuit', 'Luna', 'Coco', 'Milo', 'Nala', 'Toby', 'Mochi', 'Pepper', 'Oreo', 'Rosie', 'Bruno', 'Kiwi', 'Maple', 'Churro'];
  var NEED_INFO = [['food', 'Food', '#F28C28'], ['water', 'Water', '#3E9BD6'], ['fun', 'Fun', '#E0527D']];
  var PET_SLOTS = ['neck', 'head', 'face', 'mouth', 'ride'];
  function petBreeds() { return PETE ? PETE.BREEDS : [{ id: 'golden', name: 'Golden Retriever', coats: [{ id: 'gold', name: 'Golden', base: '#EBA852' }] }]; }
  function petBreed(id) { var l = petBreeds(); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
  function petStages() { return PETE ? PETE.STAGES : [{ id: 'newborn', name: 'Newborn', hours: 0 }]; }
  function petItems() { return PETE ? PETE.ITEMS : []; }
  function petItem(id) { var l = petItems(); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
  function msTime(v, dflt) { v = Number(v); return v > 1.5e12 && v < 4e12 ? Math.round(v) : dflt; }
  function cleanWear(w) {
    w = w && typeof w === 'object' ? w : {};
    var o = {};
    PET_SLOTS.forEach(function (s) { var it = petItem(w[s]); o[s] = it && it.slot === s ? it.id : null; });
    return o;
  }
  function cleanPet(p) {
    if (!p || typeof p !== 'object' || !ID.test(p.id)) return null;
    var born = Number(p.born);
    if (!(born > 1.5e12 && born < 4e12)) return null;
    var br = petBreed(p.breed) || petBreeds()[0];
    var coat = br.coats.some(function (c) { return c.id === p.coat; }) ? p.coat : br.coats[0].id;
    var wear = cleanWear(p.wear);
    function need(v) { v = Number(v); return isFinite(v) ? Math.max(0, Math.min(100, Math.round(v * 10) / 10)) : 70; }
    var grave = msTime(p.grave, 0);
    return {
      id: p.id, name: str(p.name, 16).replace(/\s+/g, ' ').trim() || 'Buddy', breed: br.id, coat: coat,
      born: born, bornDate: DATE.test(p.bornDate) ? p.bornDate : toISO(new Date(born)), wear: wear,
      food: need(p.food), water: need(p.water), fun: need(p.fun), at: msTime(p.at, born),
      used: Math.max(0, Math.round(Number(p.used) || 0)),
      stage: Math.max(0, Math.min(petStages().length - 1, Math.round(Number(p.stage) || 0))),
      /* last study; a puppy from before this rule starts counting now */
      last: msTime(p.last, Math.max(born, nowMs())),
      grave: grave, rev: grave ? Math.max(0, Math.min(PET_REVIVE, Math.round(Number(p.rev) || 0))) : 0,
      /* Mauro's "Unlock Everything": the outfit to put back when he turns it off */
      trial: p.trial && typeof p.trial === 'object' ? { wear: cleanWear(p.trial.wear), at: msTime(p.trial.at, born) } : null
    };
  }
  /* both devices changed the pet: keep the most care (needs, as of the later of the two), the latest study,
     treat use and stage, and each side's look changes. A later ghost wins; study after the other side's ghost means it came back. */
  function mergePet(b, m, t) {
    if (same(m, b)) return t;
    if (same(t, b)) return m;
    if (!m || !t || m.id !== t.id) return m;
    var o = clone(m), tm = Math.max(m.at, t.at), nm = petNeeds(m, tm), nt = petNeeds(t, tm), bb = b && b.id === m.id ? b : null;
    ['name', 'breed', 'coat'].forEach(function (k) { o[k] = pick3(bb ? bb[k] : undefined, m[k], t[k]); });
    if (o.coat !== m.coat && o.breed !== t.breed) o.coat = m.coat;
    o.wear = mergeMap(bb ? bb.wear : {}, m.wear, t.wear);
    o.food = Math.max(nm.food, nt.food); o.water = Math.max(nm.water, nt.water); o.fun = Math.max(nm.fun, nt.fun); o.at = tm;
    o.used = Math.max(m.used, t.used); o.stage = Math.max(m.stage, t.stage);
    o.last = Math.max(m.last, t.last);
    var g = mergeGrave(m, t); o.grave = g[0]; o.rev = g[1];
    o.trial = pick3(bb ? bb.trial : null, m.trial, t.trial);
    return o;
  }
  function mergeGrave(m, t) {
    if (!m.grave && !t.grave) return [0, 0];
    if (m.grave && t.grave) return m.grave === t.grave ? [m.grave, Math.max(m.rev, t.rev)] : m.grave > t.grave ? [m.grave, m.rev] : [t.grave, t.rev];
    var dead = m.grave ? m : t, alive = m.grave ? t : m;
    return alive.last > dead.grave ? [0, 0] : [dead.grave, dead.rev];
  }

  function petNeeds(p, t) {
    var h = Math.max(0, ((t == null ? nowMs() : t) - p.at) / HOUR);
    return { food: Math.max(0, p.food - PET_RATE.food * h), water: Math.max(0, p.water - PET_RATE.water * h), fun: Math.max(0, p.fun - PET_RATE.fun * h) };
  }
  /* needs only change the puppy's face: a hungry puppy looks sad, but needs never cost growth */
  function needMood(n) {
    if (n.food <= 0 || n.water <= 0 || n.fun <= 0) return 'sad';
    var low = Math.min(n.food, n.water, n.fun);
    if (low < 25) return n.food === low ? 'hungry' : n.water === low ? 'thirsty' : 'bored';
    return 'happy';
  }
  /* exam season windows in ms, joined when they overlap; each keeps its exams */
  function examSeasons() {
    var iv = [];
    S.events.forEach(function (e) {
      if ((e.type !== 'exam' && e.type !== 'mock') || !DATE.test(e.start)) return;
      iv.push({ a: fromISO(addDays(e.start, -PET_SEASON)).getTime(), b: fromISO(addDays(evEnd(e), 1)).getTime(), ev: [e] });
    });
    iv.sort(function (x, y) { return x.a - y.a; });
    var out = [];
    iv.forEach(function (x) {
      var l = out[out.length - 1];
      if (l && x.a <= l.b) { if (x.b > l.b) l.b = x.b; l.ev.push(x.ev[0]); } else out.push(x);
    });
    return out;
  }
  /* the 48-hour rule at time t: the season you're in, the next one, and when the puppy gets very sad and turns into a ghost.
     A running focus timer counts as studying. */
  function petClock(p, t, noTimer) {
    var last = Math.max(p.last || 0, p.born), st = S.timer && !noTimer ? timerState() : null;
    if (st && st.running) last = Math.max(last, t - Math.max(0, st.elapsed - st.total));
    var seasons = examSeasons(), cur = null, next = null, due = null;
    for (var i = 0; i < seasons.length; i++) {
      var w = seasons[i];
      if (w.a <= t && t < w.b) cur = w;
      if (!next && w.a > t) next = w;
      if (!due && w.b > last) {
        var c = Math.max(last, w.a), d = c + PET_GRAVE_H * HOUR;
        if (d < w.b) due = { sadAt: c + PET_SAD_H * HOUR, graveAt: d };
      }
    }
    return { season: cur, next: next, sadAt: due ? due.sadAt : null, graveAt: due ? due.graveAt : null };
  }
  /* write down the grave once the 48 hours ran out before the moment 'at' */
  function petGraveCheck(p, at) {
    if (!p || p.grave) return false;
    var c = petClock(p, at);
    if (c.graveAt && c.graveAt <= at) { p.grave = c.graveAt; p.rev = 0; return true; }
    return false;
  }
  /* study minutes since adoption, at most 8 hours a day */
  function petStudy(p) {
    var day = {}, all = 0, k;
    S.sessions.forEach(function (x) { if (x.date >= p.bornDate) day[x.date] = (day[x.date] || 0) + x.minutes; });
    for (k in day) all += Math.min(PET_DAY_CAP, day[k]);
    return { all: all };
  }
  function stageMin(i) { return (petStages()[i] || petStages()[0]).hours * 60; }
  function petState(p) {
    var t = nowMs(), st = petStudy(p), stages = petStages(), c = petClock(p, t);
    var dead = !!p.grave || !!(c.graveAt && c.graveAt <= t);
    var xp = Math.max(stageMin(p.stage), st.all), si = p.stage;
    for (var i = 0; i < stages.length; i++) if (xp >= stages[i].hours * 60 && i > si) si = i;
    var needs = petNeeds(p, t);
    return { t: t, needs: needs, mood: dead ? 'grave' : c.sadAt && c.sadAt <= t ? 'lonely' : needMood(needs), dead: dead, rev: p.grave ? p.rev : 0,
      xp: xp, stage: si, next: stages[si + 1] || null, all: st.all, season: c.season, nextSeason: c.next, sadAt: c.sadAt, graveAt: c.graveAt,
      treats: Math.max(0, Math.floor(st.all / 20) - p.used), toTreat: 20 - st.all % 20 };
  }
  /* write down the needs as of now, before changing them */
  function petSettle(p) {
    var t = nowMs(), n = petNeeds(p, t);
    p.food = Math.round(n.food * 10) / 10; p.water = Math.round(n.water * 10) / 10; p.fun = Math.round(n.fun * 10) / 10; p.at = t;
  }
  function petStageName(i) { return (petStages()[i] || petStages()[0]).name; }
  function petLook(p) { return { breed: p.breed, coat: p.coat, stage: (petStages()[petState(p).stage] || petStages()[0]).id, wear: p.wear }; }
  /* a study session was logged: it counts as study now, or toward bringing a ghost back */
  function petOnSession(id) {
    var p = S.pet;
    if (!p) return;
    var ses = S.sessions.filter(function (x) { return x.id === id; })[0];
    if (!ses) return;
    var t = nowMs(), m = /^ss-t([0-9a-z]+)$/.exec(id), from = m ? parseInt(m[1], 36) : t - ses.minutes * 60000;
    if (!(from > 1.5e12 && from <= t)) from = t;
    petGraveCheck(p, from);
    if (p.grave) {
      p.rev = Math.min(PET_REVIVE, (p.rev || 0) + ses.minutes);
      if (p.rev >= PET_REVIVE) petRevive(p, t);
      else PETUI.note = ' · ' + (PET_REVIVE - p.rev) + ' more min to bring ' + p.name + ' back';
    } else p.last = Math.max(p.last, t);
    var s = petState(p);
    if (s.stage > p.stage) { p.stage = s.stage; PETUI.levelUp = s.stage; }
  }
  function petRevive(p, t) {
    petSettle(p);
    p.grave = 0; p.rev = 0; p.last = Math.max(p.last, t);
    p.food = Math.max(p.food, 80); p.water = Math.max(p.water, 80); p.fun = Math.max(p.fun, 80);
    PETUI.note = ' · ' + p.name + ' is back!';
  }
  /* added to the "logged" toast */
  function petNote() { var n = PETUI.note || ''; PETUI.note = ''; return n; }
  function hoursText(ms) { var h = Math.max(1, Math.ceil(ms / HOUR)); return h === 1 ? '1 hour' : h + ' hours'; }
  function whenText(ms) {
    var d = new Date(ms), iso = toISO(d), n = diff(today(), iso);
    return (n === 0 ? 'today' : n === 1 ? 'tomorrow' : DAYS_LONG[dow(iso)]) + ' at ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function moodText(p, s) {
    var nm = p.name;
    if (s.dead) return nm + ' turned into a ghost. Study ' + (PET_REVIVE - s.rev) + ' minutes to bring ' + nm + ' back.';
    if (s.mood === 'lonely') return nm + ' misses you. Study in the next ' + hoursText(s.graveAt - s.t) + ', or ' + nm + ' turns into a ghost.';
    if (s.mood === 'sad') {
      var n = s.needs;
      return nm + ' is sad and ' + (n.food <= 0 ? 'hungry' : n.water <= 0 ? 'thirsty' : 'bored') + '.';
    }
    if (s.mood === 'hungry') return nm + ' is hungry.';
    if (s.mood === 'thirsty') return nm + ' is thirsty.';
    if (s.mood === 'bored') return nm + ' wants to play.';
    if (PETE && PETE.isNight(now().getHours())) return nm + ' is sleepy.';
    return nm + ' is happy.';
  }
  /* one line about exam season, under the garden */
  function seasonText(p, s) {
    if (s.dead) return '';
    if (s.season) {
      var last = fShort(toISO(new Date(s.season.b - 1)));
      return 'Exam season until ' + last + '. Study at least every 2 days' + (s.sadAt && s.sadAt > s.t ? '. Next study by ' + whenText(s.sadAt) + '.' : '.');
    }
    if (s.nextSeason) return 'No exams in the next 2 weeks, so ' + p.name + ' won’t miss you. Exam season starts on ' + fShort(toISO(new Date(s.nextSeason.a))) + '.';
    return 'No exams coming up, so ' + p.name + ' won’t miss you.';
  }
  /* every minute: a puppy whose 48 hours ran out turns into a ghost */
  function petWatch() {
    var p = S.pet;
    if (!p || MODE !== 'app') return;
    var was = PETUI.mood;
    if (petGraveCheck(p, nowMs())) {
      save();
      if (UI.tab === 'pet' && PETUI.ctl) petSync();
      else if (idle()) render();
      return;
    }
    var m = petState(p).mood;
    PETUI.mood = m;
    if (was && m !== was && idle()) { if (UI.tab === 'pet' && PETUI.ctl) { petSync(); petPaint(); } else if (UI.tab === 'today') render(); }
  }

  /* ---------- the garden stays alive while other views redraw ---------- */
  function freshPetUI() { return { ctl: null, stage: null, id: null, levelUp: null, playing: false, pend: 0, pendT: null, meterT: null, pick: null, note: '', mood: '', dead: null }; }
  var PETUI = freshPetUI();
  function petStop() {
    if (PETUI.ctl) PETUI.ctl.destroy();
    if (typeof PET_IMG === 'object') PET_IMG.key = '';
    clearTimeout(PETUI.pendT); clearInterval(PETUI.meterT);
    PETUI = freshPetUI();
  }
  function petKeep() { var st = PETUI.stage; if (st && st.parentNode) st.parentNode.removeChild(st); }
  /* the ghost this device last showed (0: it showed a live puppy), so each change gets its animation once */
  function petSeen(p) { var v = Number(sget('myib:petseen:' + p.id)); return v > 0 ? v : 0; }
  function petSeenSet(p, v) { var k = 'myib:petseen:' + p.id, s = String(v || 0); if (sget(k) !== s) sset(k, s); }
  function engineMood(s) { return s.dead ? 'sad' : s.mood; }
  function petMounted() {
    var slot = $('#pet-slot'), p = S.pet;
    if (!slot || !p || !PETE) return;
    if (PETUI.ctl && PETUI.id !== p.id) petStop();
    if (petGraveCheck(p, nowMs())) save();
    var s = petState(p);
    if (s.stage > p.stage) { p.stage = s.stage; PETUI.levelUp = s.stage; save(); }
    if (!PETUI.stage) {
      var st = document.createElement('div');
      st.className = 'pet-stage'; st.tabIndex = 0; st.setAttribute('role', 'img');
      slot.replaceWith(st);
      PETUI.stage = st; PETUI.id = p.id;
      /* a change this device hasn't shown yet plays now: the dust cloud, or the puppy coming back */
      var seen = petSeen(p), start = s.dead ? seen === p.grave : seen > 0;
      PETUI.dead = start;
      PETUI.ctl = PETE.mount(st, {
        look: petLook(p), name: p.name, mood: start ? 'sad' : engineMood(s), needs: needsFrac(s.needs), now: nowMs, grave: start, sign: gardenSign(),
        onPet: petPetted, onFetch: petFetched, onGraveTap: function () { toast('Study ' + (PET_REVIVE - petState(p).rev) + ' minutes to bring ' + p.name + ' back'); }
      });
    } else {
      slot.replaceWith(PETUI.stage);
      PETUI.ctl.resume();
    }
    PETUI.stage.classList.toggle('playing', PETUI.playing);
    petSync();
    petGuests();
    clearInterval(PETUI.meterT);
    PETUI.meterT = setInterval(function () { if (UI.tab === 'pet' && S.pet && !document.hidden) { petSync(); petPaint(); petGuests(); } }, 20000);
    if (PETUI.levelUp != null && !s.dead) {
      var lv = PETUI.levelUp;
      PETUI.levelUp = null;
      setTimeout(function () { if (PETUI.ctl) PETUI.ctl.act('celebrate'); toast(p.name + ' grew into ' + (lv === 4 ? 'a Legend' : 'a ' + petStageName(lv)) + '!'); }, 450);
    }
    gardenPoll('mount');
  }
  function needsFrac(n) { return { food: n.food / 100, water: n.water / 100, fun: n.fun / 100 }; }
  function petSync() {
    var p = S.pet;
    if (!p || !PETUI.ctl) return;
    var s = petState(p);
    PETUI.ctl.setLook(petLook(p));
    PETUI.ctl.setName(p.name);
    PETUI.ctl.setMood(engineMood(s), needsFrac(s.needs));
    PETUI.mood = s.mood;
    if (PETUI.dead !== s.dead) {
      PETUI.dead = s.dead;
      if (PETUI.playing) petPlay();
      PETUI.ctl.setGrave(s.dead, true);
      /* the page switches between the care buttons and the ghost card once the animation ends */
      setTimeout(function () { if (UI.tab === 'pet' && idle()) render(); }, s.dead ? 3300 : 800);
    }
    petSeenSet(p, s.dead ? p.grave || 1 : 0);
    if (PETUI.stage) PETUI.stage.setAttribute('aria-label', p.name + ', a ' + (petBreed(p.breed) || {}).name + ' ' + petStageName(s.stage).toLowerCase() + '. ' + moodText(p, s) + (s.dead ? '' : ' Press Enter to pet.'));
  }
  /* meters and numbers, redrawn in place */
  function petPaint() {
    var p = S.pet;
    if (!p || UI.tab !== 'pet') return;
    var s = petState(p);
    NEED_INFO.forEach(function (x) {
      var v = x[0] === 'fun' ? Math.min(100, s.needs.fun + PETUI.pend) : s.needs[x[0]];
      var m = $('#need-' + x[0]);
      if (!m) return;
      m.querySelector('.need-fill').style.width = Math.max(0, Math.min(100, v)).toFixed(1) + '%';
      m.querySelector('.need-val').textContent = Math.round(v) + '%';
      m.classList.toggle('low', v < 25);
    });
    var mt = $('#pet-mood'); if (mt) mt.textContent = moodText(p, s);
    var se = $('#pet-season'); if (se) se.textContent = seasonText(p, s);
    var tb = $('#pet-treats'); if (tb) tb.textContent = s.treats;
  }
  /* petting adds fun: a point every half second, saved once the rubbing stops */
  function petPetted(sec) {
    if (!S.pet) return;
    PETUI.pend += sec * 2;
    petPaint();
    clearTimeout(PETUI.pendT);
    PETUI.pendT = setTimeout(petCommit, 1500);
  }
  function petCommit() {
    clearTimeout(PETUI.pendT); PETUI.pendT = null;
    var p = S.pet, add = PETUI.pend;
    PETUI.pend = 0;
    if (!p || !add) return;
    petSettle(p);
    p.fun = Math.min(100, p.fun + add);
    save(); petSync(); petPaint();
  }
  function petFetched() {
    var p = S.pet;
    if (!p) return;
    petSettle(p);
    p.fun = Math.min(100, p.fun + 25);
    save(); petSync(); petPaint();
  }
  function petCare(kind) {
    var p = S.pet;
    if (!p || !PETUI.ctl) return;
    var s = petState(p), nm = p.name;
    if (s.dead) { toast('Study ' + (PET_REVIVE - s.rev) + ' minutes to bring ' + nm + ' back'); return; }
    if (kind === 'feed' || kind === 'water') {
      var k = kind === 'feed' ? 'food' : 'water';
      if (s.needs[k] >= 90) { toast(nm + (kind === 'feed' ? ' is full' : ' isn’t thirsty')); return; }
      petSettle(p);
      p[k] = Math.min(100, p[k] + (kind === 'feed' ? 45 : 60));
    } else if (kind === 'treat') {
      if (s.treats < 1) { toast('Study ' + s.toTreat + ' more minute' + (s.toTreat === 1 ? '' : 's') + ' to earn a treat'); return; }
      petSettle(p);
      p.used += 1; p.food = Math.min(100, p.food + 15); p.fun = Math.min(100, p.fun + 25);
    }
    save();
    PETUI.ctl.act(kind);
    petSync(); petPaint();
  }
  function petPlay() {
    if (!S.pet || !PETUI.ctl) return;
    if (!PETUI.playing && petState(S.pet).dead) return;
    PETUI.playing = !PETUI.playing;
    PETUI.ctl.play(PETUI.playing);
    if (PETUI.stage) PETUI.stage.classList.toggle('playing', PETUI.playing);
    var b = $('[data-act="pet-play"]');
    if (b) { b.setAttribute('aria-pressed', PETUI.playing); b.querySelector('span').textContent = PETUI.playing ? 'Stop' : 'Play'; }
    var tb = $('[data-act="pet-throw"]'); if (tb) tb.hidden = !PETUI.playing;
    if (PETUI.playing && ME && !sget('myib:pethint:' + ME.id)) {
      sset('myib:pethint:' + ME.id, '1');
      toast('Drag the ball and let go, or tap the grass to throw it');
    }
  }
  /* a focus session from the Pet page (25 minutes brings a ghost back) */
  function petFocus(len) {
    if (S.timer) return;
    var p = S.pet;
    if (p && petGraveCheck(p, nowMs())) save();
    unlockAudio();
    S.timer = { subject: subj(UI.focusSubject) ? UI.focusSubject : null, len: len || UI.focusLen, startedAt: nowMs(), pausedAt: null, pausedTotal: 0 };
    save(); render();
  }

  /* =========================================================
     Gardens: friends' puppies play in one garden, each person looks after their own.
     Each puppy is a small card on the server, sent when it changes.
     ========================================================= */
  function freshGarden() { return { list: null, invites: [], max: 8, err: false, loading: null, loadedAt: 0, view: '', pets: {}, pollT: null, polling: null, card: '', cardT: null, cardBusy: false }; }
  var GARDEN = freshGarden();
  function gardenStop() { clearTimeout(GARDEN.pollT); clearTimeout(GARDEN.cardT); GARDEN = freshGarden(); }
  function gardenById(id) { return (GARDEN.list || []).filter(function (g) { return g.id === id; })[0] || null; }
  function gardenSign() { var g = GARDEN.view && gardenById(GARDEN.view); return g ? g.name : ''; }
  function gardenLoad() {
    if (!ME) return Promise.resolve();
    if (GARDEN.loading) return GARDEN.loading;
    var me = ME.id;
    GARDEN.loading = api('GET', '/api/garden', null, { timeout: 15000 }).then(function (r) {
      GARDEN.loading = null;
      if (!ME || ME.id !== me) return;
      if (r.status === 401) return sessionLost();
      if (r.status !== 200 || !r.data || !Array.isArray(r.data.gardens)) { GARDEN.err = true; return; }
      GARDEN.err = false; GARDEN.loadedAt = Date.now();
      GARDEN.list = r.data.gardens; GARDEN.invites = r.data.invites || []; GARDEN.max = r.data.max || 8;
      if (!GARDEN.view) GARDEN.view = sget('myib:petview:' + me) || '';
      if (GARDEN.view && !gardenById(GARDEN.view)) GARDEN.view = '';
      renderNav();
      if (GARDEN.list.length) petCardSoon(true);
      if (UI.tab === 'pet' && idle()) render();
    }, function () { GARDEN.loading = null; GARDEN.err = true; });
    return GARDEN.loading;
  }
  /* friends' puppies in the open garden: every 30 seconds while you look at it */
  function gardenPoll(now) {
    clearTimeout(GARDEN.pollT); GARDEN.pollT = null;
    if (!ME || UI.tab !== 'pet' || document.hidden) return;
    if (!GARDEN.list || Date.now() - GARDEN.loadedAt > (now ? 20000 : 120000)) gardenLoad();
    var id = GARDEN.view;
    if (id && !GARDEN.polling) {
      var box = GARDEN.pets[id];
      if (now === true || !box || Date.now() - box.at > (now === 'mount' ? 8000 : 25000)) {
        GARDEN.polling = api('GET', '/api/garden/pets?garden=' + encodeURIComponent(id), null, { timeout: 15000 }).then(function (r) {
          GARDEN.polling = null;
          if (r.status === 404) { gardenLoad(); return; }
          if (r.status !== 200 || !r.data || !Array.isArray(r.data.pets)) return;
          GARDEN.pets[id] = { at: Date.now(), list: r.data.pets };
          (r.data.pets || []).forEach(learn);
          if (UI.tab === 'pet' && GARDEN.view === id) { petGuests(); paintFriends(); }
        }, function () { GARDEN.polling = null; });
      }
    }
    GARDEN.pollT = setTimeout(function () { gardenPoll(false); }, 30000);
  }
  /* a friend's puppy card, as of now */
  function cardState(cd, t) {
    var needs = petNeeds({ food: cd.food, water: cd.water, fun: cd.fun, at: cd.at }, t);
    var dead = !!cd.grave || !!(cd.graveAt && cd.graveAt <= t);
    return { needs: needs, dead: dead, mood: dead ? 'grave' : cd.sadAt && cd.sadAt <= t ? 'lonely' : needMood(needs) };
  }
  function petGuests() {
    if (!PETUI.ctl) return;
    var id = GARDEN.view, box = id && gardenById(id) && GARDEN.pets[id], t = nowMs();
    var list = box ? box.list.filter(function (x) { return x.card; }).map(function (x) {
      var cd = x.card, st = cardState(cd, t);
      return { id: x.id, name: cd.name, look: { breed: cd.breed, coat: cd.coat, stage: cd.stage, wear: cd.wear || {} }, mood: st.dead ? 'sad' : st.mood, needs: needsFrac(st.needs), grave: st.dead };
    }) : [];
    PETUI.ctl.setGuests(list);
    PETUI.ctl.setSign(gardenSign());
  }
  /* my puppy's card for friends: its look, needs and the exam-season clock */
  function petCard() {
    var p = S.pet;
    if (!p) return null;
    var s = petState(p), c = petClock(p, s.t, true), look = petLook(p), min = function (v) { return v ? Math.round(v / 60000) * 60000 : null; };
    return { name: p.name, breed: p.breed, coat: p.coat, stage: look.stage, wear: p.wear, food: p.food, water: p.water, fun: p.fun, at: p.at,
      sadAt: p.grave ? null : min(c.sadAt), graveAt: p.grave ? null : min(c.graveAt), grave: p.grave || 0 };
  }
  function petCardSoon(now) {
    if (!ME || !GARDEN.list || !GARDEN.list.length) return;
    clearTimeout(GARDEN.cardT);
    GARDEN.cardT = setTimeout(petCardSend, now ? 200 : 3000);
  }
  function petCardSend() {
    if (!ME || !GARDEN.list || !GARDEN.list.length) return;
    if (GARDEN.cardBusy) { petCardSoon(); return; }
    var card = petCard(), key = card ? JSON.stringify(card) : 'none', me = ME.id;
    if (key === GARDEN.card || key === sget('myib:petcard:' + me)) { GARDEN.card = key; return; }
    GARDEN.cardBusy = true;
    api(card ? 'PUT' : 'DELETE', '/api/pet/card', card ? { card: card } : null).then(function (r) {
      GARDEN.cardBusy = false;
      if (r.status === 200 && ME && ME.id === me) { GARDEN.card = key; sset('myib:petcard:' + me, key); }
    }, function () { GARDEN.cardBusy = false; });
  }
  function gardenPost(path, body, okMsg, then) {
    return api('POST', path, body).then(function (r) {
      if (r.status === 200) { if (okMsg) toast(okMsg); if (then) then(r.data); return true; }
      if (r.status === 401) { sessionLost(); return false; }
      var code = r.data && r.data.error;
      toast(r.status === 429 ? 'Too many changes. Try again in ' + ((r.data && r.data.wait) || 1) + ' min.' :
        code === 'chat_off' ? 'Mauro turned off chat for your account, so you can’t invite people.' : code === 'full' ? 'A garden can have up to ' + GARDEN.max + ' people.' :
        code === 'gardens' ? 'You can be in up to ' + ((r.data && r.data.max) || 5) + ' gardens. Leave one first.' :
        code === 'users' ? 'You can’t invite those people.' : code === 'words' ? 'Bloc doesn’t allow some words in that name.' :
        code === 'garden' ? 'That garden is gone.' : 'Something went wrong. Try again.');
      if (code === 'garden') gardenLoad();
      return false;
    }, function () { toast(OFFLINE_MSG); return false; });
  }
  function gardenSetView(id) {
    if (id && !gardenById(id)) id = '';
    GARDEN.view = id;
    if (ME) sset('myib:petview:' + ME.id, id);
    render();
    gardenPoll(true);
  }

  /* ---------- the Pet view ---------- */
  function petThumb(breed, coat, stage, pose, wear, o) {
    return PETE ? PETE.svg(Object.assign({ breed: breed, coat: coat, stage: stage, pose: pose || 'sit', wear: wear || {}, frame: 118 }, o || {})) : '';
  }
  function petAdoptHTML() {
    return '<div class="page-head"><div><h1 class="display">Pet</h1><p class="sub">A puppy that grows while you study</p></div></div>' +
      '<section class="card pet-adopt">' +
        '<div class="pet-adopt-art" aria-hidden="true">' + petThumb('golden', 'gold', 'newborn', 'happy') + petThumb('shiba', 'red', 'newborn', 'sit') + petThumb('beagle', 'tri', 'newborn', 'sit') + '</div>' +
        '<h2>Adopt a puppy</h2>' +
        '<p>Your puppy grows with every minute you study. Feed it, give it water and play fetch. In the 2 weeks before an exam, it needs you to study at least every 2 days. Every 20 minutes of study earns a treat.</p>' +
        '<button type="button" class="btn primary" data-act="pet-adopt">' + icon('pet') + 'Adopt a Puppy</button>' +
      '</section>' + (GARDEN.invites.length ? '<div class="pet-cols">' + friendsHTML(null, null) + '</div>' : '');
  }
  function gardenSegHTML() {
    var gs = GARDEN.list || [];
    if (!gs.length) return '';
    return '<div class="pet-gardens"><div class="seg" role="group" aria-label="Garden">' +
      '<button type="button" data-act="pet-garden" data-id="" aria-pressed="' + !GARDEN.view + '">Just Me</button>' +
      gs.map(function (g) { return '<button type="button" data-act="pet-garden" data-id="' + esc(g.id) + '" aria-pressed="' + (GARDEN.view === g.id) + '">' + esc(g.name) + '</button>'; }).join('') +
      '</div></div>';
  }
  VIEWS.pet = function () {
    if (!PETE) return '<div class="page-head"><div><h1 class="display">Pet</h1></div></div><section class="card"><p class="empty">Your pet couldn’t load. Reload Bloc to try again.</p></section>';
    var p = S.pet;
    if (!p) return petAdoptHTML();
    var s = petState(p), br = petBreed(p.breed) || petBreeds()[0], st = timerState();
    var needs = NEED_INFO.map(function (x) {
      var v = x[0] === 'fun' ? Math.min(100, s.needs.fun + PETUI.pend) : s.needs[x[0]];
      return '<div class="need' + (v < 25 ? ' low' : '') + '" id="need-' + x[0] + '" style="--c:' + x[2] + '">' +
        '<span class="need-ic" aria-hidden="true">' + icon('n-' + x[0]) + '</span>' +
        '<span class="need-main"><span class="need-top"><b>' + x[1] + '</b><span class="need-val">' + Math.round(v) + '%</span></span>' +
        '<span class="need-bar" aria-hidden="true"><i class="need-fill" style="width:' + v.toFixed(1) + '%"></i></span></span></div>';
    }).join('');
    var nextTxt = s.next ? dur(Math.max(1, Math.ceil(s.next.hours * 60 - s.xp))) + ' of study to ' + s.next.name : 'Fully grown. A Legend!';
    var from = stageMin(s.stage), pct = s.next ? Math.min(100, (s.xp - from) / (s.next.hours * 60 - from) * 100) : 100;
    var nextItem = petItems().filter(function (it) { return (!it.plus || plusOn()) && it.hours * 60 > s.all; }).sort(function (a, b) { return a.hours - b.hours; })[0];
    var timing = st ? '<p class="pet-timer"><span class="pet-dot" aria-hidden="true"></span>' + esc(p.name) + (s.dead ? ' waits for you' : ' is studying with you') + ' · <b id="pet-timer">' + (st.up ? fmtWatch(st.elapsed / 1000) : fmtClock(Math.ceil(st.remaining / 1000))) + '</b>' + (st.up ? ' so far' : ' left') + '</p>' +
        '<button type="button" class="btn quiet" data-act="tab" data-tab="today">' + icon('timer') + 'Open Focus</button>' : '';
    var focus = timing || '<button type="button" class="btn primary" data-act="pet-focus">' + icon('timer') + 'Study ' + UI.focusLen + ' Minutes</button>';
    var care = s.dead ?
      '<div class="pet-revive"><div class="need-bar revive-bar" role="progressbar" aria-label="Study to bring ' + esc(p.name) + ' back" aria-valuemin="0" aria-valuemax="' + PET_REVIVE + '" aria-valuenow="' + s.rev + '"><i class="need-fill" style="width:' + (s.rev / PET_REVIVE * 100).toFixed(1) + '%"></i></div>' +
        '<p class="revive-txt">' + s.rev + ' of ' + PET_REVIVE + ' minutes</p>' +
        (timing || '<button type="button" class="btn primary" data-act="pet-revive">' + icon('timer') + 'Study ' + PET_REVIVE + ' Minutes</button>') + '</div>'
      : '<div class="pet-actions">' +
          '<button type="button" class="pet-act" data-act="pet-feed" style="--c:#F28C28">' + icon('n-food') + '<span>Feed</span></button>' +
          '<button type="button" class="pet-act" data-act="pet-water" style="--c:#3E9BD6">' + icon('n-water') + '<span>Water</span></button>' +
          '<button type="button" class="pet-act" data-act="pet-play" aria-pressed="' + PETUI.playing + '" style="--c:#1E9E6A">' + icon('n-ball') + '<span>' + (PETUI.playing ? 'Stop' : 'Play') + '</span></button>' +
          '<button type="button" class="pet-act" data-act="pet-treat" style="--c:#8C3B72">' + icon('n-bone') + '<span>Treat</span><b class="pet-count" id="pet-treats">' + s.treats + '</b></button>' +
        '</div>' +
        '<button type="button" class="btn quiet pet-throw" data-act="pet-throw"' + (PETUI.playing ? '' : ' hidden') + '>Throw the Ball</button>';
    var season = seasonText(p, s);
    return '<div class="page-head pet-head"><div><h1 class="display">' + esc(p.name) + '</h1><p class="sub">' + esc(br.name) + ', ' + esc(petStageName(s.stage).toLowerCase()) + '</p></div>' +
        '<div class="actions"><button type="button" class="btn" data-act="pet-wardrobe">' + icon('bow') + 'Wardrobe</button>' +
        '<button type="button" class="icon-btn" data-act="pet-more" aria-label="' + esc(p.name) + ' settings" title="Pet settings">' + icon('more') + '</button></div></div>' +
      '<div class="pet-layout"><section class="card pet-card' + (s.dead ? ' ghost' : '') + '" aria-label="' + esc(p.name) + '’s garden">' +
        gardenSegHTML() +
        '<div id="pet-slot" class="pet-stage"></div>' +
        '<p class="pet-mood" id="pet-mood" aria-live="polite">' + esc(moodText(p, s)) + '</p>' +
        (season ? '<p class="pet-season' + (s.season ? ' on' : '') + '" id="pet-season">' + esc(season) + '</p>' : '') +
        care +
      '</section>' +
      '<div class="pet-cols">' +
        '<section class="card pet-needs' + (s.dead ? ' paused' : '') + '" aria-labelledby="h-needs"><header class="card-head"><h2 id="h-needs">Needs</h2></header>' + needs +
          '<p class="pet-note">' + (s.dead ? 'Needs wait while ' + esc(p.name) + ' is a ghost.' : 'Needs drop over the day. A hungry, thirsty or bored puppy looks sad, but still grows when you study.') + '</p></section>' +
        '<section class="card pet-grow" aria-labelledby="h-grow"><header class="card-head"><h2 id="h-grow">Growing up</h2><span class="hint">' + esc(dur(s.all)) + ' studied</span></header>' +
          '<div class="grow-stages" aria-hidden="true">' + petStages().map(function (x, i) { return '<span class="' + (i <= s.stage ? 'on' : '') + (i === s.stage ? ' cur' : '') + '">' + esc(x.name) + '</span>'; }).join('') + '</div>' +
          '<div class="need-bar grow-bar" role="progressbar" aria-label="Growth to the next stage" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(pct) + '"><i class="need-fill" style="width:' + pct.toFixed(1) + '%"></i></div>' +
          '<p class="grow-next">' + esc(nextTxt) + '</p>' +
          (nextItem ? '<p class="pet-note">Next in the wardrobe: ' + esc(nextItem.name) + ' at ' + nextItem.hours + ' hours. Every 20 minutes of study earns a treat' + (s.treats ? '' : ', the next one in ' + s.toTreat + ' min') + '.</p>'
            : '<p class="pet-note">Every 20 minutes of study earns a treat' + (s.treats ? '' : ', the next one in ' + s.toTreat + ' min') + '.</p>') +
          (s.dead ? '' : '<div class="pet-focus">' + focus + '</div>') +
        '</section>' +
        friendsHTML(p, s) +
      '</div></div>';
  };
  /* the Friends card: invites, the people in the open garden, and a way to start one */
  function friendsHTML(p, s) {
    var inv = GARDEN.invites.map(function (x) {
      var who0 = x.from && x.from.name ? x.from.name : 'Someone';
      return '<div class="row garden-invite"><span class="gi-ic" aria-hidden="true">' + icon('pet') + '</span><span class="two-line"><b>' + esc(who0) + ' invited you</b><span>' + esc(x.name) + '</span></span>' +
        '<span class="gi-btns"><button type="button" class="btn small" data-act="garden-join" data-id="' + esc(x.id) + '">Join</button>' +
        '<button type="button" class="btn small quiet" data-act="garden-decline" data-id="' + esc(x.id) + '">Decline</button></span></div>';
    }).join('');
    var body = '', head = 'Friends', more = '';
    var g = GARDEN.view && gardenById(GARDEN.view);
    if (GARDEN.list === null) body = GARDEN.err ? '<p class="pet-note">Can’t load your gardens. Check your connection.</p>' : '<p class="pet-note">Loading…</p>';
    else if (g) {
      head = g.name;
      more = '<button type="button" class="icon-btn" data-act="garden-info" data-id="' + esc(g.id) + '" aria-label="About ' + esc(g.name) + '" title="Garden info">' + icon('more') + '</button>';
      body = '<div id="friend-list">' + friendRows(g) + '</div>';
    } else if (GARDEN.list.length) {
      body = '<p class="pet-note">Open a garden to play with your friends’ puppies.</p><div class="friend-gardens">' + GARDEN.list.map(function (x) {
        var n = x.people.filter(function (q) { return q.status === 'member'; }).length;
        return '<button type="button" class="row row-btn" data-act="pet-garden" data-id="' + esc(x.id) + '"><span class="two-line"><b>' + esc(x.name) + '</b><span>' + n + ' ' + (n === 1 ? 'puppy' : 'puppies') + '</span></span>' + icon('chev') + '</button>';
      }).join('') + '</div>';
    } else if (p) body = '<p class="pet-note">Invite classmates, and your puppies play together in one garden. Everyone looks after their own puppy.</p>';
    var btn = p && GARDEN.list !== null && !g ? '<button type="button" class="btn" data-act="garden-new">' + icon('plus') + 'Invite Friends</button>' : '';
    if (!inv && !body && !btn) return '';
    return '<section class="card pet-friends" id="pet-friends" aria-labelledby="h-friends"><header class="card-head"><h2 id="h-friends">' + esc(head) + '</h2>' + more + '</header>' +
      (inv ? '<div class="garden-invites">' + inv + '</div>' : '') + body + (btn ? '<div class="pet-focus">' + btn + '</div>' : '') + '</section>';
  }
  function friendRows(g) {
    var box = GARDEN.pets[g.id], t = nowMs();
    if (!box) return '<p class="pet-note">Loading your friends’ puppies…</p>';
    var rows = box.list.map(function (x) {
      var nm = x.name || '@' + x.id, cd = x.card;
      if (!cd) return '<button type="button" class="row row-btn friend-row" data-act="friend-pet" data-id="' + esc(x.id) + '">' + avatar(x.id, nm, '', x.avatar) +
        '<span class="two-line"><b>' + esc(nm) + '</b><span>No puppy yet</span></span>' + icon('chev') + '</button>';
      var st = cardState(cd, t);
      var line = st.dead ? 'A ghost' : st.mood === 'lonely' ? 'Misses ' + nm.split(' ')[0] : st.mood === 'happy' ? 'Happy' : st.mood === 'sad' ? 'Sad' : st.mood === 'hungry' ? 'Hungry' : st.mood === 'thirsty' ? 'Thirsty' : 'Bored';
      return '<button type="button" class="row row-btn friend-row" data-act="friend-pet" data-id="' + esc(x.id) + '"><span class="friend-art" aria-hidden="true">' +
        petThumb(cd.breed, cd.coat, cd.stage, st.dead ? 'sit' : st.mood === 'happy' ? 'sit' : 'sad', cd.wear, { grave: st.dead, name: cd.name, noCar: true, frame: 110 }) + '</span>' +
        '<span class="two-line"><b>' + esc(cd.name) + '</b><span>' + esc(nm + ' · ' + line) + '</span></span>' + icon('chev') + '</button>';
    }).join('');
    var inv = g.people.filter(function (q) { return q.status === 'invited'; }).length;
    return (rows || '<p class="pet-note">Nobody else has joined yet.</p>') + (inv ? '<p class="pet-note">' + inv + ' invite' + (inv === 1 ? '' : 's') + ' waiting.</p>' : '');
  }
  function paintFriends() {
    var box = $('#friend-list'), g = GARDEN.view && gardenById(GARDEN.view);
    if (box && g) box.innerHTML = friendRows(g);
  }
  /* Today: a nudge when the puppy needs you */
  function petNudge() {
    var p = S.pet;
    if (!p || !PETE) return '';
    var s = petState(p);
    var grew = PETUI.levelUp != null || s.stage > p.stage;
    if (s.mood === 'happy' && !grew && !s.dead) return '';
    var txt = s.dead ? p.name + ' turned into a ghost' : grew && s.mood === 'happy' ? p.name + ' grew! Come and see.' : s.mood === 'lonely' ? p.name + ' misses you. Study in the next ' + hoursText(s.graveAt - s.t) + '.' : moodText(p, s);
    var sub = s.dead ? 'Study ' + (PET_REVIVE - s.rev) + ' minutes to bring ' + p.name + ' back' : 'Open ' + p.name + '’s garden';
    var sad = s.dead || s.mood === 'sad' || s.mood === 'lonely';
    return '<button type="button" class="pet-nudge' + (sad ? ' sad' : '') + '" data-act="tab" data-tab="pet">' +
      '<span class="pet-nudge-art" aria-hidden="true">' + petThumb(p.breed, p.coat, petLook(p).stage, sad ? 'sad' : 'sit', p.wear, { grave: s.dead, name: p.name, noCar: true }) + '</span>' +
      '<span class="two-line"><b>' + esc(txt) + '</b><span>' + esc(sub) + '</span></span>' + icon('chev') + '</button>';
  }

  /* ---------- sheets: adopt, change look, wardrobe, settings ---------- */
  function breedAllowed(b) { return !b.plus || plusOn(); }
  function breedShown(b) { return !b.plus || plusOn() || sellHere(); }
  function openAdopt(change) {
    var p = S.pet;
    if (change && !p) return;
    if (!PETUI.pick || PETUI.pick.change !== !!change) PETUI.pick = change ? { breed: p.breed, coat: p.coat, change: true } : { breed: 'golden', coat: 'gold', change: false, name: '' };
    curSheet = function () { openAdopt(change); };
    var pk = PETUI.pick, stageId = change ? petLook(p).stage : 'newborn';
    var suggest = PET_NAMES[Math.floor(Math.random() * PET_NAMES.length)];
    var breeds = petBreeds().filter(breedShown).map(function (b) {
      var c0 = b.id === pk.breed ? pk.coat : b.coats[0].id;
      return '<button type="button" class="pet-breed" data-act="pet-breed" data-id="' + b.id + '" aria-pressed="' + (b.id === pk.breed) + '">' +
        '<span class="pb-art" aria-hidden="true">' + petThumb(b.id, c0, 'puppy', 'sit') + '</span><span class="pb-name">' + esc(b.name) + '</span>' +
        (b.plus && !plusOn() ? '<span class="tag-plus">Plus</span>' : '') + '</button>';
    }).join('');
    var body =
      '<div class="pet-preview" id="pet-preview">' + petThumb(pk.breed, pk.coat, stageId, 'happy', change ? p.wear : {}) + '</div>' +
      '<p class="group-head">Breed</p><div class="pet-breeds" role="group" aria-label="Breed">' + breeds + '</div>' +
      '<p class="group-head">Colour</p><div class="pet-coats" id="pet-coats" role="group" aria-label="Colour">' + coatButtons(pk) + '</div>' +
      (change ? '' : grp(rField({ label: 'Name', name: 'name', id: 'pa-name', max: 16, value: pk.name || '', placeholder: 'Name, like ' + suggest }), 'Name', 'You can change the name later.'));
    openDialog({
      title: change ? 'Change Look' : 'Adopt a Puppy', body: body, submitLabel: change ? 'Save' : 'Adopt',
      onSubmit: function (fd) {
        var b = petBreed(pk.breed);
        if (!b || !breedAllowed(b)) { openPlus(function () { openAdopt(change); }); return false; }
        if (change) {
          S.pet.breed = pk.breed; S.pet.coat = pk.coat; PETUI.pick = null;
          save(); render(); toast('New look saved');
          return;
        }
        var name = clip(fd.get('name'), 16) || suggest, t = nowMs();
        petStop();
        S.pet = cleanPet({ id: uid('pt'), name: name, breed: pk.breed, coat: pk.coat, born: t, bornDate: today(), wear: { neck: 'collar' }, food: 80, water: 80, fun: 80, at: t, used: 0, stage: 0, last: t, grave: 0, rev: 0 });
        PETUI.pick = null;
        save(); go('pet');
        toast('Say hi to ' + name + '!');
      }
    });
  }
  function coatButtons(pk) {
    var b = petBreed(pk.breed) || petBreeds()[0];
    return b.coats.map(function (c) {
      var second = c.saddle || c.spot || c.tan || c.light || c.base;
      return '<button type="button" class="pet-coat" data-act="pet-coat" data-id="' + c.id + '" aria-pressed="' + (c.id === pk.coat) + '">' +
        '<i style="background:linear-gradient(135deg,' + c.base + ' 0 55%,' + second + ' 55% 100%)"></i>' + esc(c.name) + '</button>';
    }).join('');
  }
  function adoptPick(kind, id) {
    var pk = PETUI.pick;
    if (!pk) return;
    if (kind === 'breed') {
      var b = petBreed(id);
      if (!b) return;
      if (!breedAllowed(b)) { var nf = $('#pa-name', dlg); if (nf) pk.name = nf.value; openPlus(function () { openAdopt(pk.change); }); return; }
      pk.breed = id; pk.coat = b.coats[0].id;
      $$('.pet-breed', dlg).forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.id === id); });
      $('#pet-coats', dlg).innerHTML = coatButtons(pk);
    } else pk.coat = id;
    $$('.pet-coat', dlg).forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.id === pk.coat); });
    var p = S.pet;
    $('#pet-preview', dlg).innerHTML = petThumb(pk.breed, pk.coat, pk.change && p ? petLook(p).stage : 'newborn', 'happy', pk.change && p ? p.wear : {});
  }
  var SLOT_NAMES = [['street', 'Street Style'], ['neck', 'Neck'], ['head', 'Head'], ['face', 'Face']];
  var STREET = ['snapback', 'chain', 'grillz', 'bucket', 'ice', 'car'];
  /* Mauro can unlock every item to try them, then put the old outfit back */
  function wardrobeFree() { return !!(ME && ME.admin && S.pet && S.pet.trial); }
  function itemLocked(it, s) { return !wardrobeFree() && (it.hours * 60 > s.all || (it.plus && !plusOn())); }
  function wearSub(it, p, s) {
    var on = p.wear[it.slot] === it.id, free = wardrobeFree();
    return on ? 'Wearing' : !free && it.plus && !plusOn() ? 'Plus' : !free && it.hours * 60 > s.all ? 'At ' + it.hours + ' h' : it.slot === 'ride' ? 'Tap to ride' : 'Tap to wear';
  }
  function petUnlock(on) {
    var p = S.pet;
    if (!p || !ME || !ME.admin) return;
    if (on && !p.trial) { p.trial = { wear: clone(p.wear), at: nowMs() }; toast('Everything is unlocked'); }
    else if (!on && p.trial) { p.wear = cleanWear(p.trial.wear); p.trial = null; toast('Outfit put back, and the items are locked again'); }
    else return;
    save(); petSync();
    openWardrobe();
  }
  function openWardrobe() {
    var p = S.pet;
    if (!p || !PETE) return;
    curSheet = openWardrobe;
    var s = petState(p), look = petLook(p);
    var groups = SLOT_NAMES.map(function (sl) {
      var items = petItems().filter(function (it) { return (sl[0] === 'street' ? STREET.indexOf(it.id) >= 0 : it.slot === sl[0] && STREET.indexOf(it.id) < 0) && (!it.plus || plusOn() || sellHere()); });
      if (!items.length) return '';
      return '<p class="group-head">' + sl[1] + '</p><div class="wear-grid">' + items.map(function (it) {
        var on = p.wear[it.slot] === it.id, locked = itemLocked(it, s);
        return '<button type="button" class="wear-item' + (locked ? ' locked' : '') + (it.slot === 'ride' ? ' ride' : '') + '" data-act="pet-wear" data-id="' + it.id + '" aria-pressed="' + on + '">' +
          '<span class="wi-art" aria-hidden="true">' + PETE.itemSVG(it.id) + '</span><b>' + esc(it.name) + '</b><span class="wi-sub">' + esc(wearSub(it, p, s)) + '</span></button>';
      }).join('') + '</div>';
    }).join('');
    var admin = ME && ME.admin ? grp(rSwitch('Unlock Everything', 'unlock', 'pw-unlock', !!p.trial), 'Admin',
      p.trial ? 'Everything is unlocked. Turn this off to put back the outfit ' + esc(p.name) + ' wore before, and lock the items again.'
              : 'Try every item without the study hours. Turn it off later to put back the outfit ' + esc(p.name) + ' wears now.') : '';
    openDialog({
      title: 'Wardrobe',
      body: '<div class="pet-preview" id="pet-preview">' + petThumb(p.breed, p.coat, look.stage, 'happy', p.wear) + '</div>' + admin + groups +
        '<p class="group-foot">You’ve studied ' + esc(dur(s.all)) + ' with ' + esc(p.name) + '. More study time unlocks more to wear.</p>'
    });
  }
  function petWear(id) {
    var p = S.pet, it = petItem(id);
    if (!p || !it) return;
    var s = petState(p);
    if (!wardrobeFree()) {
      if (it.plus && !plusOn()) { openPlus(openWardrobe); return; }
      if (it.hours * 60 > s.all) { toast(it.name + ' unlocks after ' + it.hours + ' hours of study'); return; }
    }
    p.wear[it.slot] = p.wear[it.slot] === id ? null : id;
    save();
    petSync();
    if (it.slot === 'ride' && p.wear.ride && PETUI.ctl && !s.dead) PETUI.cruise = true;
    /* redraw the sheet in place, so it keeps its scroll position */
    $$('.wear-item', dlg).forEach(function (b) {
      var x = petItem(b.dataset.id);
      if (!x) return;
      b.setAttribute('aria-pressed', p.wear[x.slot] === x.id);
      b.classList.toggle('locked', itemLocked(x, s));
      b.querySelector('.wi-sub').textContent = wearSub(x, p, s);
    });
    var pv = $('#pet-preview', dlg);
    if (pv) pv.innerHTML = petThumb(p.breed, p.coat, petLook(p).stage, 'happy', p.wear);
  }
  function openPetSettings() {
    var p = S.pet;
    if (!p) return;
    curSheet = openPetSettings;
    var s = petState(p), nm = esc(p.name);
    var body =
      grp(rField({ label: 'Name', name: 'name', id: 'ps-name', max: 16, value: p.name, placeholder: 'Name' }), 'Name') +
      grp(rNav('palette', 'Change Look', 'pet-look', (petBreed(p.breed) || {}).name)) +
      grp('<div class="row wrap pet-howto"><p><b>Growing up.</b> Every minute you log with the focus timer, or by hand, helps ' + nm + ' grow, up to 8 hours a day. Newborn, then Puppy at 3 hours, Junior at 12, Adult at 30 and Legend at 80.</p>' +
          '<p><b>Exam season.</b> In the 2 weeks before any exam or mock in your calendar, ' + nm + ' needs you to study at least every 2 days. After 36 hours without study ' + nm + ' misses you, and at 48 hours ' + nm + ' turns into a ghost. Study 25 minutes to bring ' + nm + ' back, with all its growth. Outside exam season nothing bad happens.</p>' +
          '<p><b>Needs.</b> Food lasts about 20 hours, water about 14 and fun about a day. Petting and fetch add fun, and a treat helps both food and fun. A hungry puppy looks sad, but needs never stop growth.</p>' +
          '<p><b>Friends.</b> Invite classmates to a garden, and your puppies play there together. Everyone looks after their own puppy.</p></div>', 'How it works') +
      '<div class="group"><button type="button" class="row row-btn danger" data-act="pet-goodbye">Say Goodbye to ' + nm + '</button></div>' +
      '<p class="group-foot">' + nm + ' goes away for good, with ' + esc(dur(s.all)) + ' of growth. A new puppy starts as a newborn.</p>';
    openDialog({
      title: 'Pet Settings', body: body, submitLabel: 'Save',
      onSubmit: function (fd) {
        var n2 = clip(fd.get('name'), 16);
        if (!n2) { fieldError('#ps-name', 'Give your puppy a name.'); return false; }
        if (n2 !== p.name) { p.name = n2; save(); render(); toast('Name saved'); }
      }
    });
  }

  /* ---------- sheets: gardens and friends' puppies ---------- */
  function pickerHTML(mode, placeholder) {
    return '<div class="chat-pick" data-mode="' + mode + '">' +
      grp('<label class="row"><span class="sr">Search your class</span><input class="row-field" type="search" id="cn-q" placeholder="Search your class" autocomplete="off" autocapitalize="off" spellcheck="false"></label>') +
      '<div id="cn-people"><div class="sheet-loading" role="status"><span class="spinner" aria-hidden="true"></span><span class="sr">Loading</span></div></div>' +
      '<p class="group-head">Other students</p><div class="group" id="cn-found">' +
        '<div class="row cn-find"><span class="sr">Username</span><input class="row-field" type="text" id="cn-find" placeholder="Their username" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="21">' +
        '<button type="button" class="btn small" data-act="chat-find">Find</button></div></div>' +
      '<p class="group-foot" id="cn-find-msg">' + esc(placeholder) + '</p></div>';
  }
  function fillPicker(skip, emptyMsg) {
    var gen = CHAT.gen;
    loadDir().then(function (list) {
      var box = gen === CHAT.gen && dlg.open && $('#cn-people', dlg);
      if (!box) return;
      var ppl = list.filter(function (p) { return !skip[p.id]; });
      box.innerHTML = ppl.length ? grp(ppl.map(function (p) { return pickRow(p, false); }).join(''), 'Sociales 2 IB') : '<p class="group-head">Sociales 2 IB</p><p class="group-foot">' + esc(emptyMsg) + '</p>';
      var q = $('#cn-q', dlg);
      if (q && q.value) filterPick(q.value);
    }, function () {
      var box = dlg.open && $('#cn-people', dlg);
      if (box) box.innerHTML = '<p class="group-foot err">' + esc(OFFLINE_MSG) + '</p>';
    });
  }
  function openGardenNew() {
    curSheet = openGardenNew;
    openDialog({
      title: 'Invite Friends', submitLabel: 'Invite',
      body: grp(rField({ label: 'Garden name', name: 'gname', id: 'gd-name', max: 30, value: '', placeholder: 'Garden name, like Study Squad' }), 'Garden') +
        pickerHTML('garden', 'Find someone outside Sociales 2 IB by their exact username.'),
      onSubmit: function (fd, form) {
        var users = fd.getAll('u').map(String);
        if (!users.length || busyForm(form, true)) return false;
        gardenPost('/api/garden/new', { name: clip(fd.get('gname'), 30) || 'Study Garden', users: users }, users.length === 1 ? 'Invite sent' : 'Invites sent', function (d) {
          closeDialog();
          GARDEN.view = d.id; if (ME) sset('myib:petview:' + ME.id, d.id);
          gardenLoad();
        }).then(function () { busyForm(form, false); });
        return false;
      }
    });
    pickChanged();
    fillPicker({}, 'Nobody else from the class has an account yet.');
  }
  function openGardenInvite(id) {
    var g = gardenById(id);
    if (!g) return;
    curSheet = function () { openGardenInvite(id); };
    var skip = {};
    g.people.forEach(function (p) { skip[p.id] = 1; });
    openDialog({
      title: 'Invite Friends', submitLabel: 'Invite', back: function () { openGardenInfo(id); }, backLabel: 'Garden',
      body: pickerHTML('garden', 'Find someone outside Sociales 2 IB by their exact username.'),
      onSubmit: function (fd, form) {
        var users = fd.getAll('u').map(String);
        if (!users.length || busyForm(form, true)) return false;
        gardenPost('/api/garden/invite', { garden: id, users: users }, users.length === 1 ? 'Invite sent' : 'Invites sent', function () { closeDialog(); gardenLoad(); }).then(function () { busyForm(form, false); });
        return false;
      }
    });
    pickChanged();
    fillPicker(skip, 'Everyone from the class with an account is already here.');
  }
  function openGardenInfo(id) {
    var g = gardenById(id);
    if (!g) return;
    curSheet = function () { openGardenInfo(id); };
    var ppl = g.people.slice().sort(function (a, b) { return (a.me ? -1 : b.me ? 1 : 0) || (a.status === b.status ? whoName(a.id).localeCompare(whoName(b.id)) : a.status === 'member' ? -1 : 1); });
    var rows = ppl.map(function (x) {
      var nm = x.me ? 'You' : x.name || '@' + x.id;
      return '<div class="row acct-row">' + avatar(x.id, x.me ? ME.name : nm, '', x.me ? ME.avatar : x.avatar) + '<span class="two-line"><b>' + esc(nm) + '</b><span>' +
        esc(x.status === 'invited' ? 'Invited' : x.pet ? 'In the garden' : 'No puppy yet') + '</span></span></div>';
    }).join('');
    openDialog({
      title: 'Garden',
      body: '<div class="pfp-hero"><span class="garden-hero" aria-hidden="true">' + icon('pet') + '</span><p class="hero-name">' + esc(g.name) + '</p></div>' +
        grp(rNav('', 'Garden Name', 'garden-rename', g.name)) +
        grp(rows, 'People · ' + ppl.length) +
        (ppl.length < GARDEN.max ? grp(rButton(icon('plus') + 'Invite Friends', 'garden-invite', ' data-id="' + esc(id) + '"')) : '') +
        grp(rButton('Leave Garden', 'garden-leave', ' data-id="' + esc(id) + '"', 'danger'), '', 'Your puppy leaves this garden. Someone in it can invite you back.') +
        grp(rButton(icon('flag') + 'Report Garden Name', 'garden-report', ' data-id="' + esc(id) + '"', 'danger-text'), '', 'Report sends the name to Mauro. Nobody else finds out.')
    });
  }
  function openGardenRename(id) {
    var g = gardenById(id);
    if (!g) return;
    openDialog({
      title: 'Garden Name', back: function () { openGardenInfo(id); }, backLabel: 'Garden', submitLabel: 'Save',
      body: grp(rField({ label: 'Garden name', name: 'gname', id: 'gd-rename', max: 30, value: g.name, placeholder: 'Garden name', autofocus: true }), '', 'Everyone in the garden sees the new name.'),
      onSubmit: function (fd, form) {
        var name = clip(fd.get('gname'), 30);
        if (!name) { fieldError('#gd-rename', 'Give the garden a name.'); return false; }
        if (busyForm(form, true)) return false;
        gardenPost('/api/garden/rename', { garden: id, name: name }, 'Name saved', function (d) {
          g.name = d && d.name || name;
          if (PETUI.ctl && GARDEN.view === id) PETUI.ctl.setSign(g.name);
          openGardenInfo(id);
          if (UI.tab === 'pet') render();
        }).then(function () { busyForm(form, false); });
        return false;
      }
    });
  }
  function openFriendPet(uid) {
    var g = GARDEN.view && gardenById(GARDEN.view), box = g && GARDEN.pets[g.id];
    var x = box && box.list.filter(function (y) { return y.id === uid; })[0];
    if (!x) return;
    curSheet = function () { openFriendPet(uid); };
    var nm = x.name || '@' + x.id, cd = x.card, first = nm.split(' ')[0], body;
    if (cd) {
      var st = cardState(cd, nowMs()), br = petBreed(cd.breed), sg = petStages().filter(function (q) { return q.id === cd.stage; })[0];
      var txt = st.dead ? cd.name + ' turned into a ghost. When ' + first + ' studies 25 minutes, ' + cd.name + ' comes back.' :
        st.mood === 'lonely' ? cd.name + ' misses ' + first + '. It’s exam season, and ' + first + ' hasn’t studied for a while.' :
        st.mood === 'happy' ? cd.name + ' is happy.' : st.mood === 'bored' ? cd.name + ' wants to play.' : cd.name + ' is ' + (st.mood === 'sad' ? 'sad' : st.mood) + '.';
      body = '<div class="pet-preview">' + petThumb(cd.breed, cd.coat, cd.stage, st.dead ? 'sit' : st.mood === 'happy' ? 'happy' : 'sad', cd.wear, { grave: st.dead, name: cd.name }) + '</div>' +
        grp('<div class="row"><span class="two-line"><b>' + esc(cd.name) + '</b><span>' + esc(nm + '’s ' + (br ? br.name : 'puppy') + (sg ? ' · ' + sg.name : '')) + '</span></span></div>' +
          '<p class="row info-text">' + esc(txt) + '</p>');
    } else body = '<p class="group-foot">' + esc(nm) + ' hasn’t adopted a puppy yet.</p>';
    body += grp(rButton(icon('block') + 'Block ' + esc(first), 'garden-block', ' data-id="' + esc(x.id) + '"', 'danger-text') +
        (cd ? rButton(icon('flag') + 'Report Name', 'garden-report', ' data-id="' + esc(g.id) + '" data-user="' + esc(x.id) + '"', 'danger-text') : ''), '',
      'Blocking hides ' + esc(first) + '’s puppy from you and stops their messages. Report sends the puppy’s name to Mauro. Nobody else finds out.');
    openDialog({ title: cd ? cd.name : nm, body: body });
  }
  var PET_ACT = {
    'pet-adopt': function () { openAdopt(false); },
    'pet-look': function () { openAdopt(true); },
    'pet-breed': function (el) { adoptPick('breed', el.dataset.id); },
    'pet-coat': function (el) { adoptPick('coat', el.dataset.id); },
    'pet-feed': function () { petCare('feed'); },
    'pet-water': function () { petCare('water'); },
    'pet-treat': function () { petCare('treat'); },
    'pet-play': function () { petPlay(); },
    'pet-throw': function () { if (PETUI.ctl) PETUI.ctl.throwBall(); },
    'pet-wardrobe': function () { openWardrobe(); },
    'pet-wear': function (el) { petWear(el.dataset.id); },
    'pet-more': function () { openPetSettings(); },
    'pet-focus': function () {
      if (S.timer) return;
      petFocus(UI.focusLen);
      toast(S.pet ? S.pet.name + ' grows when the session ends' : 'Focus timer started');
    },
    'pet-revive': function () {
      if (S.timer) return;
      petFocus(PET_REVIVE);
      toast(S.pet ? S.pet.name + ' comes back when the session ends' : 'Focus timer started');
    },
    'pet-goodbye': function (el) {
      if (!arm(el, 'Press again to say goodbye')) return;
      var nm = S.pet ? S.pet.name : '';
      petStop(); S.pet = null;
      closeDialog(); save(); render();
      petCardSoon(true);
      toast('You said goodbye to ' + nm);
    },
    'pet-garden': function (el) { gardenSetView(el.dataset.id || ''); },
    'garden-new': function () { openGardenNew(); },
    'garden-info': function (el) { openGardenInfo(el.dataset.id); },
    'garden-invite': function (el) { openGardenInvite(el.dataset.id); },
    'garden-rename': function () { var g = GARDEN.view && gardenById(GARDEN.view); if (g) openGardenRename(g.id); },
    'garden-join': function (el) {
      var id = el.dataset.id;
      el.disabled = true;
      gardenPost('/api/garden/answer', { garden: id, join: true }, 'You joined the garden', function () {
        GARDEN.view = id; if (ME) sset('myib:petview:' + ME.id, id);
        gardenLoad().then(function () { gardenPoll(true); });
      }).then(function () { if (el.isConnected) el.disabled = false; });
    },
    'garden-decline': function (el) {
      var id = el.dataset.id;
      el.disabled = true;
      gardenPost('/api/garden/answer', { garden: id, join: false }, 'Invite declined', function () {
        GARDEN.invites = GARDEN.invites.filter(function (x) { return x.id !== id; });
        renderNav(); if (UI.tab === 'pet') render();
      }).then(function () { if (el.isConnected) el.disabled = false; });
    },
    'garden-leave': function (el) {
      var id = el.dataset.id;
      if (!id || !arm(el, 'Press again to leave')) return;
      gardenPost('/api/garden/leave', { garden: id }, 'You left the garden', function () {
        closeDialog();
        delete GARDEN.pets[id];
        if (GARDEN.view === id) { GARDEN.view = ''; if (ME) sset('myib:petview:' + ME.id, ''); }
        gardenLoad();
      });
    },
    'garden-report': function (el) {
      if (!arm(el, 'Press again to report')) return;
      var body = { garden: el.dataset.id };
      if (el.dataset.user) body.user = el.dataset.user;
      gardenPost('/api/garden/report', body, 'Reported. Thanks for telling Mauro.', function () { closeDialog(); });
    },
    'garden-block': function (el) {
      var id = el.dataset.id;
      if (!id || !arm(el, 'Press again to block')) return;
      gardenPost('/api/chat/block', { user: id }, 'Blocked', function () {
        if (typeof CHAT === 'object' && CHAT.blocked && !blockedId(id)) CHAT.blocked.push({ id: id, name: who(id).name, avatar: who(id).avatar, free: who(id).free });
        closeDialog();
        Object.keys(GARDEN.pets).forEach(function (k) { GARDEN.pets[k].list = GARDEN.pets[k].list.filter(function (x) { return x.id !== id; }); });
        petGuests(); paintFriends();
        gardenLoad();
      });
    },
    'friend-pet': function (el) { openFriendPet(el.dataset.id); }
  };

  var ACT = {
    tab: function (el) { go(el.dataset.tab); },
    'theme-toggle': function () { S.settings.theme = effectiveDark() ? 'light' : 'dark'; sset('myib:theme', S.settings.theme); save(); render(); },
    settings: function () { openSettings(); },
    'today-which': function (el) { UI.todayWhich = el.dataset.which === 'next' ? 'next' : 'today'; render(); },
    'cal-agenda': function () { UI.calMode = 'agenda'; saveUI(); go('calendar'); },
    'cal-mode': function (el) { UI.calMode = el.dataset.mode === 'agenda' ? 'agenda' : 'month'; saveUI(); render(); },
    'cal-step': function (el) {
      var p = UI.calMonth.split('-').map(Number), d = new Date(p[0], p[1] - 1 + Number(el.dataset.step), 1);
      UI.calMonth = d.getFullYear() + '-' + pad(d.getMonth() + 1);
      UI.calSel = today().slice(0, 7) === UI.calMonth ? today() : null;
      render();
    },
    'cal-today': function () { var t = today(); UI.calMonth = t.slice(0, 7); UI.calSel = t; render(); },
    'cal-sel': function (el) {
      var d = el.dataset.date;
      if (!DATE.test(d)) return;
      UI.calSel = d;
      if (d.slice(0, 7) !== UI.calMonth) UI.calMonth = d.slice(0, 7);
      render();
      if (window.matchMedia && window.matchMedia('(max-width: 1080px)').matches) { var dp = $('.daypanel'); if (dp) dp.scrollIntoView({ block: 'nearest' }); }
    },
    'cal-filter': function (el) {
      var id = el.dataset.id, h = UI.hidden.slice(), i = h.indexOf(id);
      if (i >= 0) h.splice(i, 1); else h.push(id);
      UI.hidden = h; saveUI(); render();
    },
    'cal-filter-all': function () { UI.hidden = []; saveUI(); render(); },
    'ev-open': function (el) { openEvent(el.dataset.id); },
    'ev-new': function (el) { openEvent(null, { date: el.dataset.date }); },
    'ev-delete': function (el) {
      if (!arm(el)) return;
      var id = el.dataset.id, snap = snapshot();
      S.events = S.events.filter(function (e) { return e.id !== id; });
      S.tasks.forEach(function (x) { if (x.event === id) x.event = null; });
      closeDialog(); save(); render(); toast('Event deleted', snap);
    },
    'task-open': function (el) { openTask(el.dataset.id, { occ: el.dataset.date }); },
    'rem-open': function () { openReminders(); },
    'import-open': function () { openImport(); },
    'imp-file': function () { var f = $('#ics-file', dlg); if (f) f.click(); },
    'imp-link': function (el) { importLink(el); },
    'imp-how': function (el) {
      var l = $('#ics-link', dlg), k = $('#ics-keep', dlg), b = $('.sheet-body', dlg), top = b ? b.scrollTop : 0;
      if (l) IMPORT.link = l.value;
      if (k) IMPORT.keep = k.checked;
      IMPORT.how = IMPORT_HOW[el.dataset.how] ? el.dataset.how : 'iphone';
      openImport();
      var b2 = $('.sheet-body', dlg); if (b2) b2.scrollTop = top;
    },
    'feed-sync': function (el) {
      var f = S.settings.feeds.filter(function (x) { return x.id === el.dataset.id; })[0];
      if (!f) return;
      el.disabled = true; el.textContent = 'Updating…';
      feedSync(f, false);
    },
    'feed-del': function (el) {
      if (!arm(el, 'Remove?')) return;
      var id = el.dataset.id, tag = 'f:' + id + ':', snap = snapshot(), n = 0;
      S.settings.feeds = S.settings.feeds.filter(function (x) { return x.id !== id; });
      S.events = S.events.filter(function (e) { var mine = e.ext && e.ext.indexOf(tag) === 0; if (mine) n++; return !mine; });
      S.tasks = S.tasks.filter(function (x) { var mine = x.ext && x.ext.indexOf(tag) === 0; if (mine) n++; return !mine; });
      save(); render(); openImport();
      toast('Calendar removed' + (n ? ' with ' + n + (n === 1 ? ' date' : ' dates') : ''), snap);
    },
    'rem-plan': function (el) {
      var v = Number(el.dataset.v);
      remSave(function (R) { R.plan = v; });
      remRefresh();
    },
    'push-test': function (el) {
      el.disabled = true;
      api('POST', '/api/push/test', {}).then(function (r) {
        el.disabled = false;
        if (r.status === 200 && r.data && r.data.sent) toast('Sent. It shows up in a few seconds.');
        else if (r.status === 429) toast('Wait a minute before the next test.');
        else { toast('That didn’t go through. Turn notifications off and on, then try again.'); }
      }, function () { el.disabled = false; toast('You’re offline.'); });
    },
    'rep-preset': function (el) {
      var days = el.dataset.days ? el.dataset.days.split(',') : [];
      $$('input[name="rep"]', dlg).forEach(function (c) { c.checked = days.indexOf(c.value) >= 0; });
      repLabel();
    },
    'task-skip': function (el) {
      var x = taskById(el.dataset.id), d = el.dataset.date;
      if (!isRep(x) || !DATE.test(d)) return;
      var snap = snapshot();
      if (x.skip.indexOf(d) < 0) { x.skip.push(d); x.skip.sort(); }
      closeDialog(); save(); render(); toast('Skipped on ' + fDay(d), snap);
    },
    'tl-open': function (el) { var k = el.dataset.kind, id = el.dataset.id; if (k === 'task') openTask(id, { occ: el.dataset.date }); else if (k === 'event') openEvent(id); else openPlan(id); },
    'tl-add': function (el, e) {
      var r = el.getBoundingClientRect(), k = zoomOf(el) || 1;
      var m = Math.floor((Number(el.dataset.t0) + (e.clientY - r.top) / k / PXM) / 15) * 15;
      openPlan(null, { date: el.dataset.date, at: hm(Math.max(0, Math.min(1425, m))) });
    },
    'plan-new': function (el) { openPlan(null, { date: el.dataset.date }); },
    'plan-open': function (el) { openPlan(el.dataset.id); },
    'plan-kind': function (el) { planKind(el.dataset.kind); },
    'plan-start': function (el) { planStart(planById(el.dataset.id)); },
    'plan-delete': function (el) {
      if (!arm(el)) return;
      var id = el.dataset.id, snap = snapshot();
      S.plans = S.plans.filter(function (x) { return x.id !== id; });
      closeDialog(); save(); render(); toast('Study block deleted', snap);
    },
    'toast-act': function () { var a = toastAct; hideToast(); if (a && a.fn) a.fn(); },
    'task-new': function (el) { openTask(null, { date: el.dataset.date, event: el.dataset.event, subject: el.dataset.subject }); },
    'task-delete': function (el) {
      if (!arm(el)) return;
      var id = el.dataset.id, snap = snapshot();
      S.tasks = S.tasks.filter(function (x) { return x.id !== id; });
      closeDialog(); save(); render(); toast('Task deleted', snap);
    },
    'task-filter': function (el) { UI.taskFilter = el.dataset.id; saveUI(); render(); },
    'tt-cell': function (el) { openCell(el.dataset.p, Number(el.dataset.d)); },
    'tt-period': function (el) { openPeriod(el.dataset.p); },
    'tt-add-row': function () { openPeriod(null); },
    'tt-day': function (el) { UI.ttDay = Number(el.dataset.d); render(); },
    'period-delete': function (el) {
      if (!arm(el)) return;
      var id = el.dataset.id, snap = snapshot();
      S.periods = S.periods.filter(function (p) { return p.id !== id; });
      Object.keys(S.slots).forEach(function (k) { if (k.indexOf(id + '|') === 0) delete S.slots[k]; });
      closeDialog(); save(); render(); toast('Row deleted', snap);
    },
    'subj-open': function (el) { openSubject(el.dataset.id); },
    'subj-new': function () { openSubject(null); },
    'subj-delete': function (el) {
      if (!arm(el)) return;
      var id = el.dataset.id, snap = snapshot();
      S.subjects = S.subjects.filter(function (s) { return s.id !== id; });
      Object.keys(S.slots).forEach(function (k) { if (S.slots[k].subject === id) delete S.slots[k]; });
      S.events.forEach(function (e) { if (e.subject === id) e.subject = null; });
      S.tasks.forEach(function (x) { if (x.subject === id) x.subject = null; });
      S.sessions.forEach(function (x) { if (x.subject === id) x.subject = null; });
      S.papers.forEach(function (x) { if (x.subject === id) x.subject = null; });
      if (S.timer && S.timer.subject === id) S.timer.subject = null;
      S.plans.forEach(function (x) { if (x.subject === id) x.subject = null; });
      closeDialog(); save(); render(); toast('Subject deleted', snap);
    },
    'focus-len': function (el) {
      if (el.dataset.len === 'up') UI.focusUp = true;
      else { var m = Number(el.dataset.len); UI.focusLen = [25, 45, 60].indexOf(m) >= 0 ? m : 25; UI.focusUp = false; }
      saveUI(); render();
    },
    'focus-start': function () {
      timerStart(UI.focusLen, UI.focusUp, UI.focusSubject);
      save(); render();
    },
    'focus-pause': function () { if (!S.timer || S.timer.pausedAt != null) return; S.timer.pausedAt = nowMs(); save(); render(); },
    'focus-resume': function () {
      unlockAudio();
      if (!S.timer || S.timer.pausedAt == null) return;
      S.timer.pausedTotal += nowMs() - S.timer.pausedAt; S.timer.pausedAt = null;
      save(); render();
    },
    'focus-finish': function () {
      var st = timerState();
      if (!st) return;
      var m = Math.floor(st.elapsed / 60000);
      S.timer = null;
      if (m >= 1) { logSession(st.subject, m, toISO(new Date(st.startedAt)), timerId(st)); toast(dur(m) + ' of ' + nameOrGeneral(st.subject) + ' logged' + petNote()); if (m >= 10) celebrate(null, m >= 25); }
      else toast('Under a minute, so nothing was logged');
      save(); render();
    },
    'focus-cancel': function () { var snap = snapshot(); S.timer = null; save(); render(); toast('Timer cancelled', snap); },
    'focus-log': function () { openLog(); },
    'backup-export': function () { exportBackup(); },
    'backup-import': function () { var f = $('#import-file'); if (f) f.click(); },
    'ics-export': function () { download('bloc.ics', buildICS(), 'text/calendar;charset=utf-8'); toast('Calendar file downloaded'); },
    'reset-all': function (el) {
      if (!arm(el, isFree() ? 'Press again to empty your planner' : 'Press again to reset')) return;
      var snap = snapshot(), keep = { theme: S.settings.theme, accent: S.settings.accent, pet: S.pet };
      function apply(st) {
        S = sanitize(st);
        S.settings.theme = keep.theme; S.settings.accent = keep.accent; S.pet = keep.pet;
        if (isFree()) S.settings.guide = 'on';
        closeDialog(); save(); render(); toast(isFree() ? 'Your planner is empty again' : 'Starting data restored', snap);
      }
      if (!ME.admin) return apply(startData());
      api('GET', '/api/starter').then(function (r) {
        if (r.status === 200 && r.data) apply(r.data.starter || clone(DEFAULTS));
        else toast('Couldn’t load your starting data. Try again.');
      }, function () { toast('Can’t reach Bloc. Check your connection.'); });
    },
    'dlg-close': function () { closeDialog(); },
    'dlg-back': function () { var b = dlgBack; dlgBack = null; if (b) b(); else closeDialog(); },
    'set-theme': function (el) {
      var th = el.dataset.theme;
      if (['auto', 'light', 'dark'].indexOf(th) < 0) return;
      S.settings.theme = th; sset('myib:theme', th); save(); applyTheme(); renderNav(); settingsTouched = true;
      $$('[data-act="set-theme"]', dlg).forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.theme === th)); });
    },
    'set-accent': function (el) {
      var a = el.dataset.accent || '';
      if (!ACCENTS.some(function (x) { return x[0] === a; })) return;
      if (!plusOn()) { if (a) openPlus(openSettings); return; }
      S.settings.accent = a; save(); applyTheme(); settingsTouched = true;
      $$('[data-act="set-accent"]', dlg).forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.accent === a)); });
    },
    'focus-custom': function () { if (plusOn()) openFocusLen(); else openPlus(); },

    /* log in */
    'auth-pick': function (el) {
      if (!authUser(el.dataset.id)) return;
      AUTH.pick = el.dataset.id; AUTH.step = 'password'; AUTH.err = ''; AUTH.reason = ''; AUTH.show = false;
      renderAuth(true);
    },
    'auth-back': function () {
      AUTH.step = AUTH.step === 'other' && deviceLevel() !== 'ib' ? 'level' : 'names';
      AUTH.pick = null; AUTH.err = ''; AUTH.reason = ''; renderAuth();
    },
    'auth-levels': function () { AUTH.step = 'level'; AUTH.pick = null; AUTH.err = ''; AUTH.reason = ''; renderAuth(); },
    'auth-level': function (el) {
      var l = LEVEL_IDS.indexOf(el.dataset.level) >= 0 ? el.dataset.level : 'ib';
      sset('myib:level', l);
      AUTH.err = ''; AUTH.reason = '';
      if (l === 'ib') AUTH.step = 'names';
      else { AUTH.step = 'other'; AUTH.mode = sget('myib:last') && KNOWN.indexOf(sget('myib:last')) < 0 ? 'login' : 'join'; }
      renderAuth(true);
    },
    'level-open': function () { openLevel(); },
    'level-set': function (el) {
      var l = LEVEL_IDS.indexOf(el.dataset.level) >= 0 ? el.dataset.level : 'ib';
      if (l === level()) { openSettings(); return; }
      S.settings.level = l; sset('myib:level', l);
      save(); render();
      var bs = $('.brand-sub'); if (bs) bs.textContent = LV().short + ' · 2026–27';
      openSettings();
      toast('Set to ' + LV().name);
    },
    'auth-show': function (el) {
      AUTH.show = !AUTH.show;
      $$('#au-pw, #au-pw2').forEach(function (i) { i.type = AUTH.show ? 'text' : 'password'; });
      el.textContent = AUTH.show ? 'Hide' : 'Show';
      el.setAttribute('aria-pressed', String(AUTH.show));
    },
    'auth-retry': function () { checkSession(); },
    'auth-other': function () { AUTH.step = 'other'; AUTH.mode = 'join'; AUTH.err = ''; AUTH.reason = ''; AUTH.show = false; renderAuth(true); },
    'auth-mode': function (el) {
      var m = el.dataset.mode === 'login' ? 'login' : 'join';
      if (AUTH.mode === m) return;
      AUTH.mode = m; AUTH.err = ''; AUTH.reason = '';
      renderAuth(true);
    },

    /* account */
    'pw-open': function () { openPassword(); },
    logout: function (el) { logout(el); },
    'plus-open': function () { openPlus(dlg.open ? curSheet : null); },
    'support-open': function () { openSupport(dlg.open ? curSheet : null); },
    egg: function () { eggTap(); },
    'egg-unlock': function () { eggUnlock(); },
    /* the bank app wants the 9 national digits, without +34 or spaces */
    'copy-bizum': function (el) { if (CONF.bizum) copyText(CONF.bizum.replace(/\s+/g, '').replace(/^(\+|00)34(?=\d{9}$)/, ''), el, 'Copied'); },
    'cal-link': function (el) {
      if (CONF.cal && !arm(el, 'Press again: the old link stops working')) return;
      api('POST', '/api/calendar', {}).then(function (r) {
        if (r.status === 200 && r.data && r.data.cal) {
          CONF.cal = r.data.cal; writeCache();
          openSettings();
          var c = $('[data-act="cal-copy"]', dlg);
          if (c) c.scrollIntoView({ block: 'center' });
        } else if (r.status === 401) sessionLost();
        else toast('Couldn’t make a link. Try again.');
      }, function () { toast('Can’t reach Bloc. Check your connection.'); });
    },
    'cal-copy': function (el) { var u = calUrl(); if (u) copyText(u, el, 'Link copied'); },
    'legacy-use': function (el) {
      var d = legacyData();
      if (!d || !arm(el, 'Press again to replace your planner')) return;
      var snap = snapshot();
      S = sanitize(d); markLegacy(ME.id);
      closeDialog(); save(); render(); toast('Old planner is back', snap);
    },
    'legacy-hide': function () { markLegacy(ME.id); openSettings(); },
    'account-delete': function () { openDeleteAccount(); },
    'pfp-open': function () { openPfp(); },
    'pfp-pick': function () { var f = $('#pfp-file', dlg); if (f) f.click(); },
    'pfp-remove': function (el) {
      if (!arm(el, 'Press again to remove your photo')) return;
      api('DELETE', '/api/avatar', null).then(function (r) {
        if (r.status === 200) { ME.avatar = null; writeCache(); renderNav(); settingsTouched = true; openPfp(); toast('Photo removed'); }
        else if (r.status === 401) sessionLost();
        else toast('Couldn’t remove it (error ' + r.status + ')');
      }, function () { toast('Can’t reach Bloc. Check your connection.'); });
    },
    'admin-pfp-remove': function (el) {
      if (!arm(el, 'Press again to take the photo down')) return;
      var id = el.dataset.id;
      api('POST', '/api/admin/avatar', { user: id }).then(function (r) {
        if (r.status === 200) { reloadAdmin(id); toast('Photo taken down'); }
        else toast('Couldn’t remove it (error ' + r.status + ')');
      }, function () { toast('Can’t reach Bloc. Check your connection.'); });
    },

    /* setup guide */
    'guide-subjects': function () { openSubjectPicker(); },
    'guide-timetable': function () { closeDialog(); go('timetable'); },
    'guide-dates': function () { openEvent(null, {}); },
    'guide-task': function () {
      closeDialog();
      if (UI.tab !== 'today') go('today');
      var q = $('#quick-title');
      if (q) { q.scrollIntoView({ block: 'center' }); q.focus({ preventScroll: true }); toast('Type the task, then press Enter'); }
    },
    'guide-hide': function () {
      var all = !guideBusy();
      S.settings.guide = 'done'; save(); render();
      if (!all && isFree()) toast('Guide hidden. Settings → Show Setup Guide brings it back.');
    },
    'guide-show': function () { S.settings.guide = 'on'; save(); closeDialog(); go('today'); },
    'pick-subj': function (el) { el.setAttribute('aria-pressed', String(el.getAttribute('aria-pressed') !== 'true')); },

    /* past papers */
    papers: function () { openPapers(); },
    'paper-new': function () { openPaper(null); },
    'paper-open': function (el) { openPaper(el.dataset.id); },
    'paper-delete': function (el) {
      if (!arm(el)) return;
      var id = el.dataset.id, snap = snapshot();
      S.papers = S.papers.filter(function (x) { return x.id !== id; });
      save(); render(); openPapers(); toast('Paper deleted', snap);
    },

    /* Siri */
    'siri-open': function () { openSiri(); },
    'siri-guide': function () { openSiriGuide(0); },
    'siri-retry': function () { SIRI.err = ''; var p = siriLoad(true); siriRepaint(); p.then(siriRepaint); },
    'siri-copy': function (el) { if (SIRI.data && SIRI.data.key) copyText(SIRI.data.key, el, 'Key copied'); },
    'siri-new': function (el) {
      if (SIRI.data && SIRI.data.key && !arm(el, 'Press again: your Shortcut needs the new key')) return;
      siriNewKey().then(function (ok) { siriRepaint(); toast(ok ? 'New key ready. Copy it into the Shortcut.' : siriErrText()); });
    },
    'siri-lang': function (el) {
      var lang = el.dataset.lang === 'es' ? 'es' : 'en';
      if (!SIRI.data || SIRI.data.lang === lang) return;
      api('POST', '/api/siri/lang', { lang: lang }).then(function (r) {
        if (r.status === 200 && r.data) { SIRI.data.lang = r.data.lang; siriRepaint(); toast(lang === 'es' ? 'Siri te saludará en español' : 'Siri will greet you in English'); }
        else if (r.status === 401) sessionLost();
        else toast('Couldn’t change it. Try again.');
      }, function () { toast('Can’t reach Bloc. Check your connection.'); });
    },
    'sg-next': function () { if (SIRI.step >= $$('.sg-step', dlg).length - 1) siriGuideDone(); else siriStepShow(SIRI.step + 1, true); },
    'sg-prev': function () { siriStepShow(SIRI.step - 1, true); },
    'sg-go': function (el) { siriStepShow(Number(el.dataset.i), true); },
    'sg-copy': function (el) { if (SIRI.data && SIRI.data.key) copyText(SIRI.data.key, el, 'Key copied'); },
    'sg-newkey': function () { siriNewKey().then(siriKeyPaint); },
    'sg-retry': function () { SIRI.err = ''; var p = siriLoad(true); siriKeyPaint(); p.then(siriKeyPaint); },
    'sg-test': function (el) { siriTest(el); },
    'sg-today': function () { siriGuideDone(); },
    'admin-siri': function () { openSiriLink(); },
    'admin-assist': function () { openAdminAssist(); },
    'admin-assist-extra': function (el) {
      var id = el.dataset.id, on = el.dataset.on === '1';
      api('POST', '/api/admin/assist', { user: id, extra: on }).then(function (r) {
        if (r.status === 200) { reloadAdmin(id); toast(on ? 'Extra messages are on for them' : 'Extra messages removed'); }
        else toast('Couldn’t change it (error ' + r.status + ')');
      }, function () { toast('Can’t reach Bloc. Check your connection.'); });
    },
    'assist-open': function () { openAssist(); },
    'assist-send': function () { var t = $('#as-input', dlg); if (t) assistSend(t.value); },
    'assist-try': function (el) { assistSend(el.dataset.text); },
    'assist-approve': function (el) { assistApply(Number(el.dataset.i)); },
    'assist-reject': function (el) { assistReject(Number(el.dataset.i)); },
    'assist-clear': function () { assistClear(); },
    'assist-photo': function () { assistPhotoTap(); },
    'assist-photo-remove': function () { if (AS.busy) return; AS.img = null; assistPaint(true); },
    'extra-open': function () { openExtra(assistOpen() ? openAssist : curSheet === openSettings ? openSettings : null); },

    /* admin */
    'admin-open': function () { openAdmin(); },
    'admin-bizum': function () { openBizum(); },
    'admin-price': function () { openPrice(); },
    'admin-papers': function () { PE.back = curSheet === openPapers ? openPapers : null; openPapersEditor(null); },
    'pe-add': function () {
      var d = readPapersForm($('.sheet', dlg));
      if (d.links.length >= 30) return;
      d.links.push({ title: '', sub: '', url: '', fresh: true });
      openPapersEditor(d, '#pe-lt-' + (d.links.length - 1));
    },
    'pe-remove': function (el) {
      var i = Number(el.dataset.i), d = readPapersForm($('.sheet', dlg)), l = d.links[i];
      if (!l) return;
      if ((l.title || l.url) && !arm(el, 'Remove?')) return;
      d.links.splice(i, 1);
      openPapersEditor(d, d.links.length ? '#pe-lt-' + Math.min(i, d.links.length - 1) : '[data-act="pe-add"]');
    },
    'pe-move': function (el) {
      var i = Number(el.dataset.i), j = i + Number(el.dataset.step), d = readPapersForm($('.sheet', dlg));
      if (!d.links[i] || !d.links[j]) return;
      var t = d.links[i]; d.links[i] = d.links[j]; d.links[j] = t;
      openPapersEditor(d, ['[data-act="pe-move"][data-i="' + j + '"][data-step="' + el.dataset.step + '"]:not([disabled])', '#pe-lt-' + j]);
    },
    'pe-reset': function (el) {
      if (!arm(el, 'Press again: back to the default links')) return;
      api('POST', '/api/admin/config', { papers: null }).then(function (r) {
        if (r.status === 200 && r.data) { setConf(Object.assign({ cal: CONF.cal }, r.data)); writeCache(); openPapersEditor(null); toast('Past Papers are back to the default'); }
        else if (r.status === 401) sessionLost();
        else toast('Couldn’t reset it (error ' + r.status + ')');
      }, function () { toast('Can’t reach Bloc. Check your connection.'); });
    },
    'admin-delete': function (el) {
      if (!arm(el, 'Press again to delete for good')) return;
      var id = el.dataset.id;
      api('POST', '/api/admin/delete', { user: id }).then(function (r) {
        if (r.status === 200) { delete RESET_CODES[id]; toast('@' + id + ' deleted'); openAdmin(); }
        else if (r.status === 401) sessionLost();
        else toast('Couldn’t delete it (error ' + r.status + ')');
      }, function () { toast('Can’t reach Bloc. Check your connection.'); });
    },
    'admin-user': function (el) { if (adminUser(el.dataset.id)) openAdminUser(el.dataset.id); else reloadAdmin(el.dataset.id); },
    'admin-export': function (el) {
      var id = el.dataset.id;
      api('GET', '/api/admin/export?user=' + encodeURIComponent(id)).then(function (r) {
        if (r.status === 200 && r.data) { download('bloc-' + id + '-' + today() + '.json', JSON.stringify(r.data, null, 2), 'application/json'); flash(el, 'Downloaded'); }
        else if (r.status === 404) toast('There’s no saved planner yet');
        else toast('Couldn’t download it (error ' + r.status + ')');
      }, function () { toast('Can’t reach Bloc. Check your connection.'); });
    },
    'admin-import': function () { var f = $('#admin-file', dlg); if (f) f.click(); },
    'admin-copy-code': function (el) { var c = RESET_CODES[el.dataset.id]; if (c) copyText(c, el, 'Copied'); },
    'admin-plus': function (el) {
      var id = el.dataset.id, on = el.dataset.on === '1';
      api('POST', '/api/admin/plus', { user: id, on: on }).then(function (r) {
        if (r.status === 200) { reloadAdmin(id); toast(on ? 'Plus is on for them' : 'Plus removed'); }
        else toast('Couldn’t change it (error ' + r.status + ')');
      }, function () { toast('Can’t reach Bloc. Check your connection.'); });
    },
    'admin-reset': function (el) {
      var fresh = /Setup Code/.test(el.textContent);
      if (!fresh && !arm(el, 'Press again to reset the password')) return;
      var id = el.dataset.id;
      api('POST', '/api/admin/reset', { user: id }).then(function (r) {
        if (r.status === 200 && r.data && r.data.code) { RESET_CODES[id] = r.data.code; reloadAdmin(id); toast(fresh ? 'Setup code made. Give it to them.' : 'Password reset. Give them the code.'); }
        else toast('Couldn’t reset it (error ' + r.status + ')');
      }, function () { toast('Can’t reach Bloc. Check your connection.'); });
    },
    'admin-erase': function (el) {
      if (!arm(el, 'Press again to erase for good')) return;
      var id = el.dataset.id;
      api('POST', '/api/admin/erase', { user: id }).then(function (r) {
        if (r.status === 200) { reloadAdmin(id); toast('Planner erased'); }
        else toast('Couldn’t erase it (error ' + r.status + ')');
      }, function () { toast('Can’t reach Bloc. Check your connection.'); });
    },
    'chat-open': function (el) { chatOpen(el.dataset.id); },
    'chat-agree': function () { if (ME) { sset('myib:chatok:' + ME.id, '1'); render(); chatWake(60); } },
    'chat-back': function () { chatBack(); },
    'chat-new': function () { openChatNew({}); },
    'chat-find': function () { chatFindRun(); },
    'chat-info': function () { openChatInfo(CHAT.open); },
    'chat-person': function (el) { openChatPerson(el.dataset.id); },
    'chat-dm': function (el) { chatStartDm(el.dataset.id); },
    'chat-msg': function (el) { openMsg(el); },
    'chat-jump': function () { scrollRoom(); },
    'chat-older': function () { chatOlder(); },
    'chat-blocked': function () { openBlocked(); },
    'chat-rename': function () { if (CHAT.open) openRename(CHAT.open); },
    'chat-add': function () { if (CHAT.open) openChatNew({ add: CHAT.open }); },
    'chat-reload': function () {
      CHAT.listErr = false;
      if (!CHAT.list) { paintChatList(); chatLoadList(); }
      var rm = CHAT.open && room(CHAT.open);
      if (rm && !rm.loaded) { rm.err = ''; paintMsgs(); roomLoad(CHAT.open); }
    },
    'chat-copy': function (el) { if (MSG_SEL) copyText(MSG_SEL.m.body, el, 'Copied'); },
    'chat-unsend': function (el) {
      var s = MSG_SEL;
      if (!s || !s.m.seq || !arm(el, 'Press again to delete')) return;
      chatPost('/api/chat/unsend', { conv: s.conv, seq: s.m.seq }, '', function () {
        s.m.del = 1; s.m.body = '';
        closeDialog();
        if (CHAT.open === s.conv) paintMsgs();
        syncList(s.conv);
      });
    },
    'chat-report': function (el) {
      var s = MSG_SEL;
      if (!s || !s.m.seq || !arm(el, 'Press again to report')) return;
      chatPost('/api/chat/report', { conv: s.conv, seq: s.m.seq }, 'Reported. Thanks for telling Mauro.', function () { closeDialog(); });
    },
    'chat-retry': function () {
      var s = MSG_SEL;
      if (!s) return;
      closeDialog();
      postMsg(s.conv, s.m, !!s.m.lost);
      if (CHAT.open === s.conv) paintMsgs();
    },
    'chat-drop': function () {
      var s = MSG_SEL, rm = s && CHAT.rooms[s.conv];
      if (rm) rm.msgs = rm.msgs.filter(function (m) { return m !== s.m; });
      closeDialog();
      paintMsgs();
    },
    'chat-accept': function (el) {
      var id = CHAT.open;
      if (!id) return;
      el.disabled = true;
      chatPost('/api/chat/accept', { conv: id }, '', function () {
        var rm = room(id), e = listEntry(id);
        if (rm.info) rm.info.state = 'in';
        if (e) e.state = 'in';
        rm.needInfo = true;
        paintRoomFoot(); paintRoomHead(); paintChatList();
        chatWake(100);
      }).then(function () { if (el.isConnected) el.disabled = false; });
    },
    'chat-decline': function (el) {
      var id = CHAT.open;
      if (!id || !arm(el, 'Press again to delete')) return;
      chatPost('/api/chat/leave', { conv: id }, convOf(id).kind === 'dm' ? 'Request deleted' : 'Invite deleted', function () { roomGone(id); });
    },
    'chat-leave': function (el) {
      var id = CHAT.open;
      if (!id) return;
      var c = convOf(id), del = c.kind === 'dm' || c.state === 'req';
      if (!arm(el, del ? 'Press again to delete' : 'Press again to leave')) return;
      chatPost('/api/chat/leave', { conv: id }, c.kind === 'dm' ? 'Chat deleted' : c.state === 'req' ? 'Invite deleted' : 'You left the group', function () { closeDialog(); roomGone(id); });
    },
    'chat-block': function (el) {
      var id = el.dataset.id;
      if (!id || !arm(el, 'Press again to block')) return;
      chatPost('/api/chat/block', { user: id }, 'Blocked ' + whoName(id), function () {
        if (!blockedId(id)) CHAT.blocked.push({ id: id, name: who(id).name, avatar: who(id).avatar, free: who(id).free });
        closeDialog();
        var dm = 'dm:' + (ME.id < id ? ME.id + ':' + id : id + ':' + ME.id);
        if (CHAT.rooms[dm] || listEntry(dm)) roomGone(dm);
        else if (CHAT.open) paintMsgs();
        paintChatList();
        chatLoadList();
      });
    },
    'chat-unblock': function (el) {
      var id = el.dataset.id;
      if (!id) return;
      chatPost('/api/chat/block', { user: id, on: false }, 'Unblocked ' + whoName(id), function () {
        CHAT.blocked = CHAT.blocked.filter(function (p) { return p.id !== id; });
        var rm = CHAT.rooms['dm:' + (ME.id < id ? ME.id + ':' + id : id + ':' + ME.id)];
        if (rm && rm.info) rm.info.blocked = false;
        if (curSheet === openBlocked && CHAT.blocked.length) openBlocked(); else closeDialog();
        paintChatList();
        if (CHAT.open) { paintRoomFoot(); paintMsgs(); }
        chatLoadList();
      });
    },
    'admin-reports': function () { openReports(dlg.open && curSheet === openSettings); },
    'admin-report-del': function (el) { adminReportAct(el, true); },
    'admin-report-ok': function (el) { adminReportAct(el, false); },
    'admin-chat': function (el) {
      var id = el.dataset.id, off = el.dataset.off === '1', u = adminUser(id);
      if (off && !arm(el, 'Press again to turn off chat')) return;
      el.disabled = true;
      chatPost('/api/admin/chat', { user: id, off: off }, (off ? 'Chat off for ' : 'Chat on for ') + (u ? u.name : id), function () { reloadAdmin(id); })
        .then(function () { if (el.isConnected) el.disabled = false; });
    },
    undo: function () {
      if (!undoSnap) return;
      var fromAssist = undoSnap === AS.lastSnap;
      try { S = sanitize(JSON.parse(undoSnap)); } catch (e) { return; }
      undoSnap = null; save(); render();
      /* undoing the assistant's changes puts its card back to Approve / Reject */
      if (fromAssist) {
        var am = AS.msgs[AS.lastCard];
        if (am && am.actions) { am.status = 'pending'; am.actions.forEach(function (a) { delete a.label; delete a.ic; }); }
        AS.lastSnap = null; AS.lastCard = null; assistSave(); assistPaint(true);
      }
      if (dlg.open && (curSheet === openImport || curSheet === openReminders)) curSheet();
      toast('Undone');
    }
  };

  Object.keys(PET_ACT).forEach(function (k) { ACT[k] = PET_ACT[k]; });

  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!el || el.disabled) return;
    var fn = ACT[el.dataset.act];
    if (!fn) return;
    e.preventDefault();
    fn(el, e);
  });

  document.addEventListener('change', function (e) {
    var el = e.target, k = el.dataset ? el.dataset.change : null;
    if (k === 'task-done') {
      var x = taskById(el.dataset.id);
      if (!x) return;
      var snap = snapshot(), od = taskSetDone(x, el.dataset.date, el.checked);
      save();
      if (el.checked) {
        var tl = tasksOn(today()), all = tl.length > 1 && tl.every(function (y) { return y.done; });
        celebrate(el, all);
        toast(all ? 'Everything for today is done' : isRep(x) ? 'Done for ' + (od === today() ? 'today' : fDay(od)) : 'Nice, task done', snap);
      }
      setTimeout(render, 420);
    } else if (k === 'focus-subject') { UI.focusSubject = el.value || null; saveUI(); }
    else if (k === 'tt-weekend') { S.settings.weekend = el.checked; save(); render(); }
    else if (k === 'rep-day') repLabel();
    else if (k === 'cal-past') { UI.showPast = el.checked; saveUI(); render(); }
    else if (k === 'tasks-done') { UI.showDone = el.checked; saveUI(); render(); }
    else if (k === 'assist-file') { var pf = el.files && el.files[0]; el.value = ''; assistPickPhoto(pf); }
    else if (el.id === 'import-file') importFile(el);
    else if (el.id === 'ics-file') importPicked(el);
    else if (el.id === 'admin-file') adminImportFile(el);
    else if (el.id === 'pfp-file') pfpFile(el);
    else if (el.name === 'u' && el.closest('.chat-pick')) pickChanged();
    else if (el.id === 'pw-unlock') petUnlock(el.checked);
    else if (el.id === 's-remind') {
      var R = remindPrefs();
      if (el.checked) { el.checked = R.on; remindTurnOn(); }
      else { R.on = false; saveRemind(R); nativeSync(true); if (curSheet === openReminders) remRefresh(); }
    } else if (el.id === 's-push') {
      el.disabled = true;
      (el.checked ? pushOn() : pushOff().then(function () { return true; })).then(function (ok) {
        if (ok && el.checked) toast('Notifications are on');
        if (curSheet === openReminders) remRefresh();
      });
    } else if (k === 'rem-dot') {
      var tr2 = el.closest('.rem-track'), kind = tr2 && tr2.dataset.kind;
      if (kind) remSave(function (R) {
        R.ev[kind] = remOffs($$('input:checked', tr2).map(function (c) { return Number(c.value); }));
        if (kind === 'exam') R.ev.mock = R.ev.exam.slice();
      });
      if (kind) remRefresh();
      else { var w = el.closest('.ev-rem'); if (w) evRemLabel(w); }
    } else if (k === 'rem-time') {
      remSave(function (R) { if (TIME.test(el.value)) R[el.name === 'eve' ? 'eve' : 'morn'] = el.value; });
      remRefresh();
    } else if (k === 'ev-remmode') {
      var box = $('.ev-rem-custom', dlg); if (box) box.hidden = el.value !== 'custom';
      evRemLabel();
    } else if (k === 'ev-type') evRemLabel();
  });

  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.id === 'as-input') assistGrow(el);
    if (el.getAttribute && el.getAttribute('aria-invalid') === 'true') {
      el.removeAttribute('aria-invalid');
      var row = el.closest('.row'), g = el.closest('.group');
      if (row) row.classList.remove('invalid');
      if (g && g.nextElementSibling && g.nextElementSibling.classList.contains('err')) g.nextElementSibling.remove();
    }
    if (el.id && el.id.indexOf('au-') === 0) {
      var ae = $('#au-err'); if (ae) ae.hidden = true; AUTH.err = '';
      /* keep what's typed when the form switches between New Account and Log In */
      if (el.id === 'au-user') AUTH.uname = el.value;
      else if (el.id === 'au-name') AUTH.name = el.value;
    }
    if (el.id === 'adm-q') filterAdmin(el.value);
    if (el.id === 'chat-input') { grow(el); if (CHAT.open) CHAT.drafts[CHAT.open] = el.value; CHAT.active = Date.now(); }
    if (el.id === 'cn-q') filterPick(el.value);
    if (el.id === 'crop-zoom') cropZoomTo(Number(el.value));
    if (el.id === 's-color') {
      var r = $('input[name="color"][value="custom"]', dlg);
      if (r) { r.checked = true; r.closest('.swatch').style.setProperty('--c', el.value); }
    }
  });

  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f.closest('dialog')) return;
    e.preventDefault();
    if (f.dataset.form === 'auth') { authSubmit(f); return; }
    if (f.dataset.form === 'auth-other') { otherSubmit(f); return; }
    if (MODE !== 'app') return;
    if (f.dataset.form === 'chat-send') { chatSubmit(); return; }
    var fd = new FormData(f), raw = clip(fd.get('title'), 200), parsed;
    if (f.dataset.form === 'quick-task') {
      if (!raw) { refocus('#quick-title'); return; }
      parsed = parseTags(raw);
      S.tasks.push(newTask(parsed.title, parsed.subject, today()));
      save(); render(); refocus('#quick-title');
      toast('Task added');
    } else if (f.dataset.form === 'task-add') {
      if (!raw) { refocus('#ta-title'); return; }
      parsed = parseTags(raw);
      var sid = parsed.subject || fd.get('subject');
      var due = fd.get('due');
      S.tasks.push(newTask(parsed.title, sid, DATE.test(due) ? due : null));
      save(); render(); refocus('#ta-title');
      toast('Task added');
    }
  });

  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (!t || e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
    if (t.id === 'chat-input' && !e.shiftKey && !coarse.matches) { e.preventDefault(); chatSubmit(); }
    else if (t.id === 'as-input' && !e.shiftKey && !coarse.matches) { e.preventDefault(); assistSend(t.value); }
    else if (t.id === 'cn-find') { e.preventDefault(); chatFindRun(); }
  }, true);
  document.addEventListener('visibilitychange', function () {
    if (MODE !== 'app' || !ME) return;
    if (document.hidden) { clearTimeout(CHAT.timer); CHAT.timer = null; }
    else chatWake(UI.tab === 'chat' ? 200 : 1500);
  });

  document.addEventListener('keydown', function (e) {
    if (MODE !== 'app' || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || dlg.open) return;
    var tg = e.target;
    if (tg && (tg.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName))) return;
    var i = '123456'.indexOf(e.key);
    if (i >= 0 && e.key.length === 1) { e.preventDefault(); go(TABS[i][0]); return; }
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openTask(null, {}); }
    else if (e.key === 'e' || e.key === 'E') { e.preventDefault(); openEvent(null, {}); }
  });

  /* Another tab on this device: follow its logouts, and its synced changes when this tab has none of its own. */
  window.addEventListener('storage', function (e) {
    if (!ME || MODE !== 'app') return;
    if (e.key === 'myib:bye' && e.newValue) { stopApp(); showAuth({}); return; }
    if (e.key !== cacheKey(ME.id) || !e.newValue || dirty || SYNC.pending || dlg.open) return;
    try {
      var c = JSON.parse(e.newValue);
      if (!c || c.pending || !c.state || !(c.rev > SYNC.rev)) return;
      S = sanitize(c.state); SYNC.rev = c.rev; SYNC.base = c.base ? JSON.stringify(c.base) : null; undoSnap = null;
      render();
    } catch (err) { /* ignore */ }
  });

  /* clock: timer every second, live views every minute */
  var lastMinute = -1, lastDay = null;
  function idle() {
    var a = document.activeElement;
    var typing = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'checkbox' && $('#view').contains(a);
    return !dlg.open && !typing && !DRAG;
  }
  function tick() {
    if (MODE !== 'app') return;
    if (S.timer) updateTimerUI();
    if (UI.tab === 'today' || UI.tab === 'timetable') moveFillBars();
    if (SYNC.needRender && idle() && !scrolling()) { SYNC.needRender = false; render(); }
    var d = now(), m = d.getHours() * 60 + d.getMinutes(), day = toISO(d);
    if (day !== lastDay) {
      var prev = lastDay;
      lastDay = day;
      UI.todayWhich = null;
      if (prev && UI.calSel === prev) UI.calSel = day;
      REM_CACHE.at = 0;
      if (prev) pushPlanSoon();
      /* a new day always repaints: now if you're not typing, otherwise as soon as you stop */
      if (prev) softRender();
    }
    if (m !== lastMinute) {
      lastMinute = m;
      petWatch();
      planWatch();
      remWatch();
      feedsDue();
      if (UI.tab === 'calendar') tlNow();
      if (UI.tab === 'today' || UI.tab === 'timetable') softRender();
    }
  }

  /* =========================================================
     Log in, log out, offline start
     ========================================================= */
  /* step: names (the class), password (a class name), other (students outside the class: mode join, login or reset) */
  var AUTH = { step: 'names', users: null, pick: null, reason: '', err: '', busy: false, offline: false, show: false, mode: 'join', uname: '', name: '' };
  var authBox = $('#auth');

  function setMode(m) {
    MODE = m;
    var b = document.body;
    b.classList.remove('mode-boot', 'mode-auth', 'mode-app');
    b.classList.add('mode-' + m);
  }
  function brandHTML() {
    return '<div class="auth-brand"><img class="auth-logo" src="icons/icon-192.png" alt="" width="64" height="64"><p class="auth-name">' + BRAND + '</p><p class="auth-tag">Your school planner</p></div>';
  }
  function showSplash() {
    setMode('boot');
    authBox.innerHTML = '<div class="auth-card splash" role="status">' + brandHTML() + '<span class="spinner" aria-hidden="true"></span><span class="sr">Loading</span></div>';
  }
  function showNotice(title, html, action) {
    stopApp();
    setMode('auth');
    authBox.innerHTML = '<section class="auth-card" aria-labelledby="auth-h">' + brandHTML() +
      '<h1 class="auth-q" id="auth-h">' + esc(title) + '</h1><p class="auth-note">' + html + '</p>' +
      (action ? '<button type="button" class="btn primary auth-go" data-act="auth-retry">' + esc(action) + '</button>' : '') + '</section>';
  }
  function setupNeeded() {
    showNotice('Bloc isn’t connected to its database yet',
      'If you run Bloc: in Cloudflare, open this Pages project → Settings → Bindings, add a D1 database with the variable name <b>DB</b>, then deploy again.', 'Try Again');
  }
  function serverDown() { showNotice('Can’t reach Bloc right now', 'Check your connection and try again in a moment.', 'Try Again'); }

  /* Leave the app: save what's pending to this browser's copy, then clear the screen. */
  function stopApp() {
    flush();
    clearTimeout(SYNC.timer);
    clearTimeout(nagTimer); nagTimer = null;
    SYNC = freshSync();
    closeDialog(); hideToast();
    ME = null; CONF = blankConf(); siriFresh(); assistFresh();
    clearTimeout(CHAT.timer); CHAT = freshChat();
    petStop(); gardenStop();
    document.body.classList.remove('chat-conv', 'kb-open');
    paintBadge();
    S = sanitize(clone(DEFAULTS));
    document.documentElement.removeAttribute('data-accent');
    document.title = 'Bloc';
    $('#view').innerHTML = '';
    renderBanner();
  }
  function showApp(fresh) {
    setMode('app');
    var h = location.hash.slice(1), t = today();
    /* a fresh log in starts on Today; a reload keeps the section in the address */
    if (fresh) { UI.tab = 'today'; try { history.replaceState(null, '', '#today'); } catch (e) { /* ignore */ } }
    else if (h === 'chat' || h.indexOf('chat/') === 0) { UI.tab = 'chat'; CHAT.open = parseHash(h).conv; }
    else UI.tab = TABS.some(function (x) { return x[0] === h; }) ? h : UI.tab && UI.tab !== 'chat' ? UI.tab : 'today';
    UI.calMonth = t.slice(0, 7); UI.calSel = t; UI.todayWhich = null; UI.enter = true;
    if (!subj(UI.focusSubject)) {
      var nx = S.events.filter(function (e) { return e.subject && (e.type === 'deadline' || e.type === 'exam') && !e.done && e.start >= t; }).sort(byStart)[0];
      UI.focusSubject = nx ? nx.subject : null;
    }
    var bs = $('.brand-sub');
    if (bs) bs.textContent = isFree() ? LV().short + ' · 2026–27' : '2º BI · 2026–27';
    /* an older planner from outside the class takes the level picked on this device */
    if (!S.settings.level && isFree() && deviceLevel()) { S.settings.level = deviceLevel(); save(); }
    render();
    $('#view').focus({ preventScroll: true });
    scheduleNag();
    welcomeIfNew();
    chatWake(UI.tab === 'chat' ? 100 : 1500);
    setTimeout(gardenLoad, 1200);
    openFromLink();
    remindAsk();
    REM_SEEN.last = 0;
    pushPlanSoon();
    setTimeout(feedsDue, 4000);
  }
  /* myib.app/?open=plus, ?open=extra or ?open=support: the iPhone app sends people here to pay or support */
  function openFromLink() {
    var want = null;
    try { want = new URLSearchParams(location.search).get('open'); } catch (e) { want = null; }
    if (want === 'day' || want === 'pet' || want === 'today') {
      var u = location.href;
      try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* ignore */ }
      setTimeout(function () { openUrl(u); }, 300);
      return;
    }
    if (want !== 'plus' && want !== 'support' && want !== 'extra') return;
    try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* ignore */ }
    setTimeout(function () {
      if (MODE !== 'app' || !ME || dlg.open) return;
      if (want === 'extra') { if (CONF.assist) openExtra(null); return; }
      (want === 'plus' ? openPlus : openSupport)(null);
    }, 700);
  }
  /* a brand-new empty planner opens with the welcome sheet, once */
  function welcomeIfNew() {
    setTimeout(function () {
      if (MODE === 'app' && ME && S.settings.guide === 'new' && !dlg.open) openWelcome();
    }, 350);
  }

  function authUser(id) {
    id = id || AUTH.pick;
    return (AUTH.users || []).filter(function (u) { return u.id === id; })[0] || null;
  }
  function showAuth(o) {
    o = o || {};
    stopApp();
    setMode('auth');
    /* a username from outside the class goes to its own log in form */
    var outside = o.pick && KNOWN.indexOf(o.pick) < 0, lv = deviceLevel();
    /* first time on this device: what do you study? IB shows the class; the rest get their own account */
    AUTH.step = outside ? 'other' : o.pick ? 'password' : !lv ? 'level' : lv === 'ib' ? 'names' : 'other';
    AUTH.pick = outside ? null : o.pick || null;
    if (outside) { AUTH.mode = 'login'; AUTH.uname = o.pick; }
    else if (AUTH.step === 'other') AUTH.mode = sget('myib:last') ? 'login' : 'join';
    AUTH.reason = o.reason || ''; AUTH.err = ''; AUTH.busy = false; AUTH.show = false; AUTH.offline = false;
    renderAuth();
    loadUsers();
  }
  function loadUsers() {
    /* the outside-student form doesn't need the list, so it never redraws under someone's typing */
    function redraw() { if (MODE === 'auth' && !AUTH.busy && AUTH.step !== 'other') renderAuth(); }
    return api('GET', '/api/users', null, { timeout: 10000 }).then(function (r) {
      if (r.status === 503 && r.data && r.data.error === 'setup') return setupNeeded();
      if (r.status === 200 && r.data && Array.isArray(r.data.users)) { AUTH.users = r.data.users; AUTH.offline = false; }
      else if (!AUTH.users) AUTH.offline = true;
      redraw();
    }, function () {
      if (!AUTH.users) AUTH.offline = true;
      redraw();
    });
  }
  function renderAuth(fromTap) {
    if (MODE !== 'auth') return;
    if (AUTH.step === 'level') { authBox.innerHTML = authLevelHTML(); return; }
    if (AUTH.step === 'other') {
      authBox.innerHTML = authOtherHTML();
      var first = AUTH.mode === 'join' ? ['#au-name', '#au-user', '#au-pw'] : AUTH.mode === 'reset' ? ['#au-code'] : ['#au-user', '#au-pw'];
      var target = first.map(function (s) { return $(s); }).filter(function (el) { return el && !el.value; })[0];
      if (target && (fromTap || !coarse.matches)) target.focus();
      return;
    }
    var u = AUTH.step === 'password' ? authUser() : null;
    if (AUTH.step === 'password' && AUTH.users && !u) AUTH.step = 'names';
    var keep = u && $('#au-pw') ? $('#au-pw').value : '';
    authBox.innerHTML = u ? authPasswordHTML(u) : authNamesHTML();
    var f = u && $('#au-pw');
    if (f) {
      if (keep) f.value = keep;
      if (fromTap || !coarse.matches) f.focus();
    }
  }
  function authNamesHTML() {
    var list = AUTH.users, body;
    if (list) {
      body = '<ul class="who">' + list.map(function (u) {
        return '<li><button type="button" class="who-btn" data-act="auth-pick" data-id="' + esc(u.id) + '">' + avatar(u.id, u.name, 'lg') +
          '<span class="who-name">' + esc(u.name) + '</span>' + (u.claimed ? '' : '<span class="who-new">New</span>') + '</button></li>';
      }).join('') + '</ul>';
    } else if (AUTH.offline) {
      body = '<p class="auth-note">Can’t reach Bloc. Check your connection.</p><button type="button" class="btn primary auth-go" data-act="auth-retry">Try Again</button>';
    } else {
      body = '<div class="sheet-loading" role="status"><span class="spinner" aria-hidden="true"></span><span class="sr">Loading</span></div>';
    }
    return '<section class="auth-card" aria-labelledby="auth-h">' +
        '<button type="button" class="auth-back" data-act="auth-levels">' + icon('left') + '<span>Back</span></button>' + brandHTML() +
        '<h1 class="auth-q" id="auth-h">Who’s using ' + BRAND + '?</h1>' + body +
        '<button type="button" class="auth-alt" data-act="auth-other"><span class="two-line"><b>I’m not in Sociales 2 IB</b><span>Make your own free account</span></span>' + icon('chev') + '</button>' +
        '<p class="auth-foot">Your planner is private. Only you can open it, with your own password. <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a></p>' +
      '</section>';
  }

  /* the first screen: four big buttons */
  function authLevelHTML() {
    var cur = deviceLevel();
    return '<section class="auth-card level-card" aria-labelledby="auth-h">' + brandHTML() +
        '<h1 class="auth-q" id="auth-h">What do you study?</h1>' +
        '<ul class="levels">' + LEVEL_IDS.map(function (k, i) {
          var L = LEVELS[k];
          return '<li style="--i:' + i + '"><button type="button" class="level-btn lv-' + k + '" data-act="auth-level" data-level="' + k + '" aria-pressed="' + (cur === k) + '">' +
            '<span class="level-tile" aria-hidden="true">' + esc(LEVEL_TILE[k]) + '</span>' +
            '<span class="two-line"><b>' + esc(L.name) + '</b><span>' + esc(L.sub) + '</span></span>' + icon('chev') + '</button></li>';
        }).join('') + '</ul>' +
        '<p class="auth-foot">' + BRAND + ' sets up your planner for it. You can change it later in Settings. <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a></p>' +
      '</section>';
  }
  /* Students outside the class: New Account, Log In, or (after Mauro resets it) a new password with his code. */
  function authOtherHTML() {
    var m = AUTH.mode, join = m === 'join', reset = m === 'reset', type = AUTH.show ? 'text' : 'password';
    var title = join ? 'Create Your Account' : reset ? 'New password' : 'Welcome back';
    var sub = join ? 'Free, with no ads. A short guide helps you set up your planner.'
            : reset ? 'Enter the code Mauro gave you, then pick a new password.'
            : AUTH.reason || 'Log in with your username.';
    function field(label, name, id, auto, max, value, extra) {
      return '<label class="row stack"><span class="row-cap">' + label + '</span><input class="row-field" type="text" name="' + name + '" id="' + id + '" maxlength="' + max +
        '" autocomplete="' + auto + '" spellcheck="false" value="' + esc(value || '') + '"' + (extra || '') + '></label>';
    }
    function pw(label, name, id, auto, withShow) {
      return '<label class="row stack"><span class="row-cap">' + label + '</span><input class="row-field" type="' + type + '" name="' + name + '" id="' + id + '" maxlength="128" autocomplete="' + auto +
        '" autocapitalize="off" autocorrect="off" spellcheck="false">' +
        (withShow ? '<button type="button" class="show-pw" data-act="auth-show" aria-pressed="' + AUTH.show + '" aria-controls="' + id + '">' + (AUTH.show ? 'Hide' : 'Show') + '</button>' : '') + '</label>';
    }
    var lv = deviceLevel() || 'ib';
    return '<form class="auth-card" data-form="auth-other" novalidate aria-labelledby="auth-h">' +
        '<button type="button" class="auth-back" data-act="auth-back">' + icon('left') + '<span>' + (lv === 'ib' ? 'Names' : 'Back') + '</span></button>' +
        '<img class="auth-logo small" src="icons/icon-192.png" alt="" width="52" height="52">' +
        '<h1 class="auth-hi" id="auth-h">' + title + '</h1>' +
        (reset ? '' : '<button type="button" class="level-chip" data-act="auth-levels"><span class="level-tile mini lv-' + lv + '" aria-hidden="true">' + esc(LEVEL_TILE[lv]) + '</span>' + esc(LEVELS[lv].name) + '<span class="level-change">Change</span></button>') +
        '<p class="auth-sub">' + esc(sub) + '</p>' +
        (reset ? '' : '<div class="seg auth-seg" role="group" aria-label="Account">' +
          '<button type="button" data-act="auth-mode" data-mode="join" aria-pressed="' + join + '">New Account</button>' +
          '<button type="button" data-act="auth-mode" data-mode="login" aria-pressed="' + !join + '">Log In</button></div>') +
        '<div class="group auth-fields">' +
          (join ? field('First name', 'name', 'au-name', 'given-name', 30, AUTH.name, ' autocapitalize="words"') : '') +
          field('Username', 'username', 'au-user', 'username', 20, AUTH.uname, ' autocapitalize="none" autocorrect="off" inputmode="email"' + (reset ? ' readonly' : '')) +
          (reset ? field('Code from Mauro', 'code', 'au-code', 'off', 40, '', ' autocapitalize="characters" autocorrect="off"') : '') +
          pw(join || reset ? 'New password' : 'Password', 'password', 'au-pw', join || reset ? 'new-password' : 'current-password', true) +
          (join || reset ? pw('Repeat password', 'confirm', 'au-pw2', 'new-password', false) : '') +
        '</div>' +
        (join ? '<p class="auth-hint">Your username: 3 to 20 lowercase letters, numbers, dots or underscores. You log in with it on every device.</p>' : '') +
        '<p class="auth-err" id="au-err" role="alert"' + (AUTH.err ? '' : ' hidden') + '>' + esc(AUTH.err) + '</p>' +
        '<button type="submit" class="btn primary auth-go"' + (AUTH.busy ? ' disabled' : '') + '>' + (join ? 'Create Account' : reset ? 'Save New Password' : 'Log In') + '</button>' +
        '<p class="auth-foot">' + (join ? 'Your planner is private. Only you can open it, with your own password. <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a>' : 'Forgot your password? Ask Mauro to reset it. Your planner stays safe.') + '</p>' +
      '</form>';
  }
  function otherSubmit(form) {
    if (AUTH.busy) return;
    var fd = new FormData(form), m = AUTH.mode;
    /* Bloc shows usernames as @name, so people may type the @ too */
    var uname = String(fd.get('username') || '').trim().toLowerCase().replace(/^@+/, ''), pw = String(fd.get('password') || ''), name = '';
    AUTH.uname = uname;
    var au = $('#au-user'); if (au) au.value = uname;
    if (m === 'join') {
      name = clip(fd.get('name'), 30);
      AUTH.name = name;
      if (!name) return authError('Enter your first name.', '#au-name');
      if (!FREE_ID.test(uname)) return authError('Pick a username with 3 to 20 lowercase letters, numbers, dots or underscores.', '#au-user');
      if (KNOWN.indexOf(uname) >= 0) return authError('That username is taken. Try another.', '#au-user');
    } else if (!uname || !FREE_ID.test(uname)) {
      return authError(uname ? 'Check your username: it has 3 to 20 lowercase letters, numbers, dots or underscores.' : 'Enter your username.', '#au-user');
    }
    if (!pw) return authError(m === 'login' ? 'Enter your password.' : 'Pick a password.', '#au-pw');
    if (m === 'login' && failedBefore(uname, pw)) return authError(SAME_PW, '#au-pw', true);
    var filled = m === 'login' && autofilled($('#au-pw'));
    if (m !== 'login') {
      if (Array.from(pw).length < 6) return authError('Use at least 6 characters.', '#au-pw');
      if (pw !== String(fd.get('confirm') || '')) return authError('The two passwords don’t match.', '#au-pw2');
      if (m === 'reset' && !String(fd.get('code') || '').trim()) return authError('Enter the code Mauro gave you.', '#au-code');
    }
    authBusy(true);
    var req = m === 'join' ? api('POST', '/api/join', { user: uname, name: name, password: pw })
            : m === 'reset' ? api('POST', '/api/signup', { user: uname, password: pw, code: String(fd.get('code') || '') })
            : api('POST', '/api/login', { user: uname, password: pw });
    req.then(function (r) {
      authBusy(false);
      var d = r.data || {};
      if (r.status === 200 && d.user) {
        AUTH.err = ''; AUTH.name = '';
        /* a brand-new account: any copy this browser kept under the same username belonged to a deleted one */
        if (m === 'join') { sdel(cacheKey(d.user.id)); sdel('myib:ui:' + d.user.id); sdel('myib:papers:' + d.user.id); }
        return enterApp(d, true);
      }
      if (r.status === 400 && d.error === 'username') return authError('Pick a username with 3 to 20 lowercase letters, numbers, dots or underscores.', '#au-user');
      if (r.status === 400 && d.error === 'name') return authError('Enter your first name.', '#au-name');
      if (r.status === 400 && d.error === 'words') return authError('Bloc doesn’t allow that name or username. Pick another one.', '#au-user');
      if (r.status === 400 && d.error === 'user') return authError('Check your username.', '#au-user');
      if (r.status === 400 && d.error === 'common') return authError('That password is too easy to guess. Try another.', '#au-pw', true);
      if (r.status === 400 && (d.error === 'weak' || d.error === 'long')) return authError(d.error === 'weak' ? 'Use at least 6 characters.' : 'That password is too long.', '#au-pw');
      if (r.status === 409 && m === 'join') return authError('That username is taken. Try another.', '#au-user');
      if (r.status === 409) { AUTH.mode = 'login'; AUTH.err = 'This account already has a password. Log in with it.'; return renderAuth(true); }
      if (r.status === 404 && d.error === 'unknown') return authError('There’s no account called @' + uname + '. Check the spelling, or tap New Account.', '#au-user');
      if (r.status === 404 && d.error === 'unclaimed') {
        if (d.code) { AUTH.mode = 'reset'; AUTH.err = 'Mauro reset your password. Enter the code he gave you and pick a new one.'; return renderAuth(true); }
        return authError('That name has no password yet. Go back to Names and pick it to make one.', '#au-user');
      }
      if (r.status === 401 && d.error === 'wrong') { markFailed(uname, pw); return authError(wrongText(d, filled), '#au-pw', true); }
      if (r.status === 403 && d.error === 'reset_code') return authError('That code isn’t right. Ask Mauro for it again.', '#au-code', true);
      if (r.status === 429 && d.error === 'busy') return authError('Lots of people joined Bloc today. Try again in ' + (d.wait > 90 ? Math.round(d.wait / 60) + ' hours.' : d.wait + ' min.'), '#au-user');
      if (r.status === 429) return authError(d.error === 'slow' ? 'Too many new accounts from this network. Try again in ' + d.wait + ' min.' : 'Too many tries. Wait ' + d.wait + ' min, then try again.', m === 'join' ? '#au-user' : '#au-pw', m !== 'join');
      if (r.status === 503 && d.error === 'full') return authError('Bloc has no room for new accounts right now. Ask Mauro.', '#au-user');
      if (r.status === 503 && d.error === 'setup') return setupNeeded();
      authError('Something went wrong. Try again.', '#au-pw');
    }, function () {
      authBusy(false);
      authError('Can’t reach Bloc. Check your connection.', '#au-pw');
    });
  }
  function authPasswordHTML(u) {
    var create = !u.claimed, admin = u.id === ADMIN_ID, needCode = create && (admin || u.code), type = AUTH.show ? 'text' : 'password';
    var sub = !create ? (AUTH.reason || 'Enter your password.') : admin ? 'Create your password, then enter your setup code.' :
      u.code ? 'Enter the code Mauro gave you, then pick a password.' :
      'Create a password to keep your planner private. You’ll use it on every device.';
    return '<form class="auth-card" data-form="auth" novalidate aria-labelledby="auth-h">' +
        '<button type="button" class="auth-back" data-act="auth-back">' + icon('left') + '<span>Names</span></button>' +
        avatar(u.id, u.name, 'xl') +
        '<h1 class="auth-hi" id="auth-h">' + (create ? 'Welcome, ' : 'Hi, ') + esc(u.name) + '</h1>' +
        '<p class="auth-sub">' + esc(sub) + '</p>' +
        '<input class="sr" type="text" name="username" value="' + esc(u.id) + '" autocomplete="username" tabindex="-1" aria-hidden="true">' +
        '<div class="group auth-fields">' +
          '<label class="row"><span class="sr">' + (create ? 'New password' : 'Password') + '</span><input class="row-field" type="' + type + '" name="password" id="au-pw" maxlength="128" autocomplete="' + (create ? 'new-password' : 'current-password') + '" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="' + (create ? 'New password' : 'Password') + '">' +
            '<button type="button" class="show-pw" data-act="auth-show" aria-pressed="' + AUTH.show + '" aria-controls="au-pw">' + (AUTH.show ? 'Hide' : 'Show') + '</button></label>' +
          (create ? '<label class="row"><span class="sr">Repeat password</span><input class="row-field" type="' + type + '" name="confirm" id="au-pw2" maxlength="128" autocomplete="new-password" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Repeat password"></label>' : '') +
          (needCode ? '<label class="row"><span class="sr">' + (admin ? 'Setup code' : 'Code from Mauro') + '</span><input class="row-field" type="text" name="code" id="au-code" maxlength="40" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" placeholder="' + (admin ? 'Setup code' : 'Code from Mauro') + '"></label>' : '') +
        '</div>' +
        '<p class="auth-err" id="au-err" role="alert"' + (AUTH.err ? '' : ' hidden') + '>' + esc(AUTH.err) + '</p>' +
        '<button type="submit" class="btn primary auth-go"' + (AUTH.busy ? ' disabled' : '') + '>' + (create ? 'Create Password' : 'Log In') + '</button>' +
        '<p class="auth-foot">' + (create ? 'At least 6 characters. Pick something only you know.' : 'Forgot your password? Ask Mauro to reset it. Your planner stays safe.') + '</p>' +
      '</form>';
  }
  /* Saved passwords: Safari or iCloud Keychain can keep an old password, and then the one it fills in
     fails every time. Bloc spots a password the browser filled in, says so, and never sends a password
     that just failed again, so it doesn't use up your tries. Only a short fingerprint is kept, in memory. */
  var FAILED = [];
  function pwPrint(user, pw) {
    var h = 2166136261, s = user + '\n' + pw;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h + ':' + s.length;
  }
  function failedBefore(user, pw) { return FAILED.indexOf(pwPrint(user, pw)) >= 0; }
  function markFailed(user, pw) { FAILED.push(pwPrint(user, pw)); if (FAILED.length > 20) FAILED.shift(); }
  function autofilled(el) {
    if (!el) return false;
    try { if (el.matches(':autofill')) return true; } catch (e) { /* older browsers */ }
    try { return el.matches(':-webkit-autofill'); } catch (e) { return false; }
  }
  var SAME_PW = 'That’s the password that just failed, so Bloc didn’t send it again. If your browser filled it in, its saved password is out of date: type yours instead.';
  function wrongText(d, filled) {
    var tail = d.left ? d.left + (d.left === 1 ? ' try' : ' tries') + ' left.' : 'Wait ' + (d.wait || 15) + ' minutes, then try again.';
    return (filled ? 'The password your browser filled in is wrong, so its saved one is out of date. Type yours instead. ' : 'Wrong password. ') + tail;
  }
  function authError(msg, sel, clear) {
    AUTH.err = msg;
    var e = $('#au-err');
    if (e) { e.textContent = msg; e.hidden = false; }
    var f = sel ? $(sel) : null;
    if (f) { if (clear) f.value = ''; f.focus(); }
  }
  function authBusy(on) {
    AUTH.busy = on;
    var b = $('.auth-go', authBox);
    if (b) { b.disabled = on; b.classList.toggle('busy', on); }
  }
  function authSubmit(form) {
    if (AUTH.busy) return;
    var u = authUser();
    if (!u) return;
    var fd = new FormData(form), pw = String(fd.get('password') || ''), create = !u.claimed;
    if (!pw) return authError('Enter your password.', '#au-pw');
    if (!create && failedBefore(u.id, pw)) return authError(SAME_PW, '#au-pw', true);
    var filled = !create && autofilled($('#au-pw'));
    if (create) {
      if (Array.from(pw).length < 6) return authError('Use at least 6 characters.', '#au-pw');
      if (pw !== String(fd.get('confirm') || '')) return authError('The two passwords don’t match.', '#au-pw2');
      if ((u.id === ADMIN_ID || u.code) && !String(fd.get('code') || '').trim()) return authError(u.id === ADMIN_ID ? 'Enter your setup code.' : 'Enter the code Mauro gave you.', '#au-code');
    }
    authBusy(true);
    var req = create ? api('POST', '/api/signup', { user: u.id, password: pw, code: String(fd.get('code') || '') })
                     : api('POST', '/api/login', { user: u.id, password: pw });
    req.then(function (r) {
      authBusy(false);
      var d = r.data || {};
      if (r.status === 200 && d.user) { u.claimed = true; AUTH.err = ''; return enterApp(d, true); }
      if (r.status === 401 && d.error === 'wrong') { markFailed(u.id, pw); return authError(wrongText(d, filled), '#au-pw', true); }
      if (r.status === 429) return authError(d.error === 'slow' ? 'Too many new passwords from this network. Try again in ' + d.wait + ' min.' : 'Too many tries. Wait ' + d.wait + ' min, then try again.', '#au-pw', true);
      if (r.status === 404 && d.error === 'unclaimed') { u.claimed = false; AUTH.err = u.name + ' has no password yet. Create one.'; return renderAuth(); }
      if (r.status === 409 && d.error === 'taken') { u.claimed = true; AUTH.err = 'Someone already made a password for ' + u.name + '. If that wasn’t you, tell Mauro.'; return renderAuth(); }
      if (r.status === 400 && d.error === 'common') return authError('That password is too easy to guess. Try another.', '#au-pw', true);
      if (r.status === 400 && d.error === 'weak') return authError('Use at least 6 characters.', '#au-pw');
      if (r.status === 403 && d.error === 'setup_code') return authError('That setup code isn’t right.', '#au-code', true);
      if (r.status === 403 && d.error === 'reset_code') { u.code = true; if (!$('#au-code')) { AUTH.err = 'This name needs a code from Mauro. Ask him for it.'; return renderAuth(); } return authError('That code isn’t right. Ask Mauro for it again.', '#au-code', true); }
      if (r.status === 503 && d.error === 'setup') return setupNeeded();
      authError('Something went wrong. Try again.', '#au-pw');
    }, function () {
      authBusy(false);
      authError('Can’t reach Bloc. Check your connection.', '#au-pw');
    });
  }

  function enterApp(d, fresh) {
    sdel('myib:bye');
    FAILED = [];
    authBox.innerHTML = '';
    stopApp();
    ME = d.user; setConf(d);
    sset('myib:last', ME.id);
    loadUI(ME.id);
    var cache = readCache(ME.id);
    if (cache) {
      useCache(cache);
      showApp(fresh);
    } else {
      showSplash();
    }
    SYNC.needsLoad = true;
    var sync = SYNC;
    return loadServerState().then(function () {
      if (sync !== SYNC || !ME) return;
      if (MODE === 'boot') showApp(fresh);
      if (SYNC.pending && !SYNC.inflight) schedulePush(300);
    }, function () {
      if (sync !== SYNC || !ME) return;
      if (MODE === 'app') { setOnline(false); return; }
      showNotice('Couldn’t open your planner', 'Check your connection and try again.', 'Try Again');
    });
  }
  /* No connection at start-up: open the last account from this browser's copy. */
  function enterOffline(cache) {
    stopApp();
    ME = cache.me.user; setConf(cache.me);
    loadUI(ME.id);
    useCache(cache);
    SYNC.needsLoad = true; SYNC.online = false;
    showApp();
  }
  function sessionLost() {
    if (!ME) return;
    showAuth({ pick: ME.id, reason: 'You’ve been logged out on this device. Log in again to keep syncing.' });
  }
  function logout(el) {
    flush();
    if (SYNC.pending && !arm(el, 'Not synced yet. Press again to log out')) { push(); return; }
    var id = ME.id, mine = pushMine();
    sset('myib:bye', '1');
    /* this browser stops getting the account's reminders */
    api('POST', '/api/logout', mine ? { push: mine.endpoint } : {}).then(function (r) { if (r.status === 200) sdel('myib:bye'); }, function () {});
    if (mine) {
      sdel('myib:push:' + id); sdel('myib:pushplan:' + id);
      swReady().then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) { return sub && sub.unsubscribe(); }).catch(function () {});
    }
    toNative({ type: 'logout' });
    stopApp();
    sdel(cacheKey(id)); sdel('myib:last');
    showAuth({});
  }
  function checkSession() {
    showSplash();
    if (sget('myib:bye')) {
      /* a logout that didn't reach the server last time */
      api('POST', '/api/logout', {}).then(function (r) { if (r.status === 200) sdel('myib:bye'); }, function () {}).then(function () { showAuth({}); });
      return;
    }
    api('GET', '/api/me', null, { timeout: 9000 }).then(function (r) {
      if (r.status === 200 && r.data && r.data.user) return enterApp(r.data);
      if (r.status === 401 || (r.status === 200 && r.data && r.data.user === null)) {
        var last = sget('myib:last');
        return showAuth({ pick: last && readCache(last) ? last : null });
      }
      if (r.status === 503 && r.data && r.data.error === 'setup') return setupNeeded();
      serverDown();
    }, function () {
      var cache = readCache(sget('myib:last'));
      if (cache) return enterOffline(cache);
      showAuth({});
    });
  }
  /* new versions: ask for a fresh sw.js every 30 minutes and when Bloc comes back on screen */
  var updateReady = false, swReg = null, lastSwCheck = Date.now();
  function checkForUpdate() {
    if (!swReg || Date.now() - lastSwCheck < 30 * 60000) return;
    lastSwCheck = Date.now();
    swReg.update().catch(function () {});
  }
  /* never under an open sheet, someone's typing or a save on its way; unsaved changes go to this browser's copy first */
  function reloadWhenQuiet() {
    if (!updateReady) return;
    var a = document.activeElement, typing = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'checkbox';
    if (dlg.open || typing || AUTH.busy || SYNC.inflight || SYNC.resolving) { setTimeout(reloadWhenQuiet, 3000); return; }
    flush();
    location.reload();
  }
  function heartbeat() {
    if (MODE !== 'app' || !ME || document.hidden) return;
    if (!SYNC.online || SYNC.needsLoad || Date.now() - SYNC.lastMe > 30 * 60000) { reconnect(); return; }
    if (SYNC.pending && !SYNC.inflight && !SYNC.timer) { push(); return; }
    if (SYNC.wantPull || Date.now() - SYNC.lastPull > 120000) pull();
    if (Date.now() - GARDEN.loadedAt > 5 * 60000) gardenLoad();
  }

  /* =========================================================
     Boot
     ========================================================= */
  (function boot() {
    applyTheme();
    var nd = now();
    lastDay = today();
    lastMinute = nd.getHours() * 60 + nd.getMinutes();
    setInterval(tick, 1000);
    /* a phone that slept overnight wakes on yesterday's page: check the day the moment it shows again */
    document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
    window.addEventListener('pageshow', function () { tick(); });
    window.addEventListener('focus', function () { tick(); });
    setInterval(heartbeat, 30000);
    checkSession();
    if ('serviceWorker' in navigator) {
      /* After a new upload, its service worker takes over (sw.js skips waiting) and this page
         reloads at a quiet moment, so nobody has to reload by hand to get the new version. */
      var hadController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (!hadController) { hadController = true; return; }      /* first install: already up to date */
        updateReady = true;
        reloadWhenQuiet();
      });
      /* https only; local tests turn it on with myib:devsw */
      if (location.protocol === 'https:' || (/^(127\.0\.0\.1|localhost)$/.test(location.hostname) && sget('myib:devsw') === '1')) {
        window.addEventListener('load', function () {
          navigator.serviceWorker.register('sw.js').then(function (reg) { swReg = reg; }, function () {});
        });
      }
      setInterval(checkForUpdate, 5 * 60000);
      document.addEventListener('visibilitychange', function () { if (!document.hidden) checkForUpdate(); });
    }
  })();
})();
