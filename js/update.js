// Updates: the app checks the published version whenever it comes back on screen and every
// 30 minutes. A newer one installs by itself when that can't interrupt anything (no focus or
// lecture timer running, no sheet open, nothing being typed); otherwise a button offers it.
// All your data is saved as you go, so updating never loses anything.
import { S } from './core.js';
import { APP_VERSION } from './version.js';

export const upd = { latest: null, at: null, stuck: false };
const KEY = 'pg27.updating';

export async function latestVersion() {
  const r = await fetch(`js/version.js?check=${Date.now()}`, { cache: 'no-store' });
  const m = (await r.text()).match(/\bv:\s*(\d+)/);
  return m ? +m[1] : null;
}
const busy = () => !!(S.focus || S.watch || document.querySelector('#sheet-root .sheet') ||
  (document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)));

export async function applyUpdate() {
  try { localStorage.setItem(KEY, String(upd.latest || '')); } catch { /* ignore */ }
  // Second try in a row (the browser held on to old files): start the offline layer afresh.
  if (upd.stuck) { try { for (const r of await navigator.serviceWorker?.getRegistrations() || []) await r.unregister(); } catch { /* ignore */ } }
  try { const reg = await navigator.serviceWorker?.getRegistration(); await reg?.update(); } catch { /* offline */ }
  // Drop the old offline copy so nothing stale can come back; the reload fetches everything fresh.
  try { for (const k of await caches.keys()) if (k !== 'pg27-data') await caches.delete(k); } catch { /* ignore */ }
  location.reload();
}

// manual: true from the Settings button (always answers); false for the quiet automatic checks.
export async function checkForUpdate(manual = false) {
  let v = null;
  try { v = await latestVersion(); } catch { if (manual) return 'offline'; return null; }
  upd.latest = v; upd.at = new Date();
  if (!v || v <= APP_VERSION.v) { pill(false); return 'latest'; }
  if (manual || (!busy() && !upd.stuck)) { applyUpdate(); return 'updating'; }
  pill(true);
  return 'available';
}

function pill(show) {
  let el = document.getElementById('update-pill');
  if (!show) { el?.remove(); return; }
  if (!el) {
    el = document.createElement('button');
    el.id = 'update-pill'; el.type = 'button';
    el.addEventListener('click', () => { el.textContent = 'Updating…'; applyUpdate(); });
    document.body.append(el);
  }
  el.innerHTML = `<b>Version ${upd.latest} is ready</b><span>Update</span>`;
}

export function startUpdates() {
  // Say so once after an update finished.
  try {
    const was = localStorage.getItem(KEY);
    if (was != null) {
      localStorage.removeItem(KEY);
      // Still older than what we went to fetch: don't reload again by ourselves (no loops).
      if (+was > APP_VERSION.v) upd.stuck = true;
      else setTimeout(() => document.dispatchEvent(new CustomEvent('pg27:updated', { detail: APP_VERSION.v })), 600);
    }
  } catch { /* ignore */ }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkForUpdate(); });
  setInterval(() => { if (document.visibilityState === 'visible') checkForUpdate(); }, 30 * 60 * 1000);
  setTimeout(() => checkForUpdate(), 4000);
}
