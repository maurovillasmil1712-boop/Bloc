/* Bloc service worker.
   Network first, cache as fallback: new uploads show up on the next load,
   and the app shell still opens offline. It never touches /api/, so account
   data is never cached here. It also shows the reminders the server sends. */
var CACHE = 'myib-v7-1-0';
var CORE = [
  './',
  'styles.css?v=7.1.0',
  'app.js?v=7.1.0',
  'pet.js?v=7.1.0',
  'data.js?v=7.1.0',
  'manifest.webmanifest',
  'icons/favicon.svg',
  'icons/icon-192.png',
  'icons/apple-touch-icon.png',
  'fonts/schibsted-grotesk-latin.woff2'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/api' || url.pathname.indexOf('/api/') === 0) return;
  /* Bloc City streams about 100 MB of textures and models: leave it to the browser's own cache */
  if (url.pathname === '/city' || url.pathname.indexOf('/city/') === 0) return;
  e.respondWith(
    fetch(req).then(function (res) {
      if (res.ok && res.type === 'basic' && !res.redirected) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        if (hit) return hit;
        if (req.mode === 'navigate') return caches.match('./');
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      });
    })
  );
});

/* ---------- reminders (Web Push) ---------- */
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  var title = typeof d.title === 'string' && d.title ? d.title : 'Bloc';
  var url = typeof d.url === 'string' && /^\/\?open=[a-z]+(&d=\d{4}-\d{2}-\d{2})?$/.test(d.url) ? d.url : '/';
  e.waitUntil(self.registration.showNotification(title, {
    body: typeof d.body === 'string' ? d.body : '',
    tag: typeof d.tag === 'string' ? d.tag : undefined,
    icon: 'icons/icon-192.png',
    badge: 'icons/badge-96.png',
    data: { url: url }
  }));
});

/* a tap opens the app on the right day: the open window if there is one, a new one if not */
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (new URL(c.url).origin === self.location.origin && 'focus' in c) {
        c.postMessage({ type: 'open', url: url });
        return c.focus();
      }
    }
    return self.clients.openWindow(url);
  }));
});

/* the browser renewed the subscription: tell the server the new one */
self.addEventListener('pushsubscriptionchange', function (e) {
  var old = e.oldSubscription && e.oldSubscription.endpoint;
  e.waitUntil(fetch('/api/push/key', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (k) {
    var s = String(k.key).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var raw = atob(s), key = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) key[i] = raw.charCodeAt(i);
    return self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  }).then(function (sub) {
    var j = sub.toJSON();
    return fetch('/api/push/sub', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-MyIB': '1' },
      body: JSON.stringify({ endpoint: j.endpoint, keys: j.keys, old: old || undefined })
    });
  }).catch(function () { /* the app makes a new one next time it opens */ }));
});
