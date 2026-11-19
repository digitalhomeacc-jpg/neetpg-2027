// Reminders. The phone keeps a small summary of the next two weeks in the cache.
// A daily push from GitHub Actions wakes the service worker (sw.js), which turns
// that summary into "today: revise these, at least this much". No server holds your data.
import { S, VIDS, metrics, forecast, revInfo, addDays, today, mins, save } from './core.js';

export const VAPID_PUBLIC = 'BFKylOuFRAn3heoYUOXzrYXdJvk-8uJgZDkLbbeE-gkhvU5Guokxo8Ny6_gdwJgXDGuMM-etVowG4VXVy8rohnU';

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);

export function buildSummary() {
  const m = metrics(), t = m.t;
  const fc = forecast(m);
  const revBy = {};
  for (const v of VIDS) {
    const r = revInfo(v, t);
    if (r?.k) { const d = r.due < t ? t : r.due; (revBy[d] ||= []).push({ title: v.title, k: r.k.toUpperCase(), m: r.budget }); }
  }
  const days = {};
  for (let i = 0; i < 14; i++) {
    const d = addDays(t, i);
    const fd = fc.find(x => x.date === d);
    const rev = revBy[d] || [];
    const revM = rev.reduce((a, x) => a + x.m, 0);
    const newM = fd ? fd.total : 0;
    days[d] = {
      min: i === 0 ? Math.round(m.minimum) : Math.round(newM * 0.5 + Math.min(120, revM)),
      goal: i === 0 ? Math.round(m.goal) : Math.round(newM + revM),
      rev: rev.slice(0, 6), revN: rev.length,
      news: fd ? fd.items.slice(0, 4).map(x => x.v.title) : [], newN: fd ? fd.items.length : 0,
    };
  }
  return { updated: new Date().toISOString(), today: t, real: { [t]: Math.round(m.realToday) }, streak: m.streak, days };
}

let timer;
export function writeSummary() {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      const c = await caches.open('pg27-data');
      await c.put('summary.json', new Response(JSON.stringify(buildSummary()), { headers: { 'Content-Type': 'application/json' } }));
    } catch { /* no cache storage here (e.g. plain http) */ }
  }, 400);
}

const b64ToBytes = s => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
};

export async function enablePush() {
  if (!pushSupported()) throw new Error('unsupported');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('denied');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC) });
  S.push = JSON.stringify(sub.toJSON()); save();
  writeSummary();
  return S.push;
}

export async function testNotification(kind = 'morning') {
  if (!('Notification' in window) || Notification.permission !== 'granted') throw new Error('Notifications are not allowed for PG 2027');
  const sum = buildSummary();
  await caches.open('pg27-data').then(c => c.put('summary.json', new Response(JSON.stringify(sum)))).catch(() => {});
  const n = window.PG27Note.build(sum, kind);
  const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((_, rej) => setTimeout(() => rej(new Error('Background worker not running. Close and reopen the app.')), 4000))]);
  await reg.showNotification(n.title, { body: n.body, tag: `pg27-test-${kind}`, icon: 'icons/icon-192.png', data: { url: './' } });
  return n;
}

export function summaryLine() {
  const s = buildSummary().days[today()];
  return `${mins(s.goal)} target · ${s.revN} revisions · ${s.newN} new videos`;
}
