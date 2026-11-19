// Offline cache for the app, plus daily reminders. Bump VERSION whenever any file changes.
const VERSION = 'pg27-v3';
const FILES = ['./', 'index.html', 'css/app.css', 'js/main.js', 'js/core.js', 'js/ui.js', 'js/notify.js',
  'js/views/today.js', 'js/views/plan.js', 'js/views/videos.js', 'js/views/tests.js', 'js/views/progress.js',
  'js/views/settings.js', 'js/views/video.js', 'js/views/revise.js', 'js/data-wor.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== 'pg27-data').map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Network first so updates show straight away; the cache when offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(res => {
    const copy = res.clone();
    caches.open(VERSION).then(c => c.put(e.request, copy));
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});

/* ---------- reminders ---------- */
const pad = n => String(n).padStart(2, '0');
const isoToday = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const mins = m => { m = Math.round(m); if (m < 60) return `${m} min`; const h = Math.floor(m / 60), r = m % 60; return r ? `${h}h ${r}m` : `${h}h`; };
const list = (xs, n) => xs.slice(0, 3).join(', ') + (n > 3 ? ` +${n - 3} more` : '');

async function buildNote(kind) {
  const fallback = { title: 'PG 2027', body: "Open the app to see today's plan." };
  const res = await caches.open('pg27-data').then(c => c.match('summary.json')).catch(() => null);
  if (!res) return fallback;
  const s = await res.json();
  const t = isoToday(), d = s.days?.[t];
  if (!d) return { title: 'PG 2027', body: "It's been a while. Open the app and pick up where you left off." };
  const revs = list(d.rev.map(r => `${r.title} (${r.k})`), d.revN);
  const news = list(d.news, d.newN);
  if (kind === 'evening') {
    const real = s.today === t ? (s.real?.[t] || 0) : 0;
    if (d.min && real >= d.min) {
      return { title: `Minimum done: ${mins(real)} today`, body: real >= d.goal ? 'Full day done too. Rest well.' : `${mins(d.goal - real)} more would make it a full day.` };
    }
    return {
      title: real ? `${mins(d.min - real)} short of today's minimum` : `Not started today. Minimum is ${mins(d.min)}`,
      body: d.revN ? `Revisions still due: ${revs}` : (news ? `Next up: ${news}` : 'Even 30 minutes keeps the streak going.'),
    };
  }
  if (!d.min && !d.revN) return { title: 'Rest day', body: 'Nothing is due today.' };
  return {
    title: `Today: at least ${mins(d.min)}`,
    body: [d.revN ? `Revise: ${revs}` : '', d.newN ? `New: ${news}` : ''].filter(Boolean).join('\n') || `Full day ${mins(d.goal)}.`,
  };
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
