// Offline cache for the app, plus daily reminders. Bump VERSION whenever any file changes.
const VERSION = 'pg27-v59';
const FILES = ['./', 'index.html', 'css/app.css', 'js/main.js', 'js/core.js', 'js/ui.js', 'js/notify.js',
  'js/views/today.js', 'js/views/plan.js', 'js/views/videos.js', 'js/views/tests.js', 'js/views/progress.js',
  'js/views/settings.js', 'js/views/video.js', 'js/views/revise.js', 'js/views/focus.js', 'js/history.js', 'js/views/planner.js', 'js/quotes.js', 'js/views/welcome.js', 'js/views/times.js', 'js/views/watch.js', 'js/views/health.js', 'js/views/pins.js', 'js/views/week.js', 'js/views/report.js', 'js/views/extras.js', 'js/views/revisions.js', 'js/views/backlog.js', 'js/sync.js', 'js/config.js', 'js/data-wor.js', 'js/data-anki.js', 'js/data-anki-lib.js', 'js/views/anki.js', 'js/views/ankilib.js', 'js/views/hello.js', 'js/views/duty.js', 'js/views/revtime.js', 'js/views/pyt.js', 'js/views/concepts.js', 'js/views/past.js', 'js/views/dayview.js', 'js/data-concepts.js', 'js/version.js', 'js/update.js', 'js/note.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'no-cache' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== 'pg27-data').map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Cache first: the app opens instantly from this version's saved copy, even on a slow or no
// connection. New versions arrive whole (a new service worker caches every file, then takes
// over), so files from two versions never mix. Version checks always go to the network.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.searchParams.has('check')) return;
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(e.request);
      if (res.ok) c.put(e.request, res.clone());
      return res;
    } catch {
      return (e.request.mode === 'navigate' && await c.match('index.html')) || Response.error();
    }
  }));
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
