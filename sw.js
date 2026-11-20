// Offline cache for the app, plus daily reminders. Bump VERSION whenever any file changes.
const VERSION = 'pg27-v35';
const FILES = ['./', 'index.html', 'css/app.css', 'js/main.js', 'js/core.js', 'js/ui.js', 'js/notify.js',
  'js/views/today.js', 'js/views/plan.js', 'js/views/videos.js', 'js/views/tests.js', 'js/views/progress.js',
  'js/views/settings.js', 'js/views/video.js', 'js/views/revise.js', 'js/views/focus.js', 'js/history.js', 'js/views/planner.js', 'js/quotes.js', 'js/views/welcome.js', 'js/views/times.js', 'js/views/watch.js', 'js/views/health.js', 'js/views/pins.js', 'js/views/week.js', 'js/views/report.js', 'js/views/extras.js', 'js/views/revisions.js', 'js/views/backlog.js', 'js/sync.js', 'js/config.js', 'js/data-wor.js', 'js/data-anki.js', 'js/data-anki-lib.js', 'js/views/anki.js', 'js/views/ankilib.js', 'js/views/hello.js', 'js/views/duty.js', 'js/views/revtime.js', 'js/views/pyt.js', 'js/version.js', 'js/note.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'no-cache' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== 'pg27-data').map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Network first so updates show straight away; the cache when offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(res => {
    const copy = res.clone();
    caches.open(VERSION).then(c => c.put(e.request, copy));
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});

/* ---------- reminders ---------- */
importScripts('js/note.js');
async function buildNote(kind) {
  const res = await caches.open('pg27-data').then(c => c.match('summary.json')).catch(() => null);
  return self.PG27Note.build(res ? await res.json() : null, kind);
}
async function show(kind) {
  const n = await buildNote(kind);
  return self.registration.showNotification(n.title, {
    body: n.body, tag: `pg27-${kind}`, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: './' },
  });
}
self.addEventListener('push', e => {
  let kind = 'morning';
  try { kind = e.data?.json()?.kind || kind; } catch { /* plain or empty payload */ }
  e.waitUntil(show(kind));
});
self.addEventListener('message', e => { if (e.data?.type === 'test-notification') e.waitUntil(show(e.data.kind || 'morning')); });
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    const c = cs.find(x => 'focus' in x);
    return c ? c.focus() : self.clients.openWindow('./');
  }));
});
