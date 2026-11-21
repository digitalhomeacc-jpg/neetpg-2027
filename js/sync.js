// Sync between your phones and tablets through your own Supabase project.
// Sign in with email + password; each account sees only its own row (row-level security).
// The whole study state is one JSON document per account. When two devices both changed
// it, the two are merged so nothing logged on either is lost.
import { S, save, onSave, replaceState, mergeState } from './core.js';
import { SYNC } from './config.js';
import { startHistory } from './history.js';

const AUTH_KEY = 'pg27.auth';
const conf = () => ({ url: (S.settings.syncUrl || SYNC.url || '').trim().replace(/\/+(rest|auth)\/v1\/?$/, '').replace(/\/$/, ''), key: S.settings.syncKey || SYNC.anonKey || '' });
export const configured = () => !!(conf().url && conf().key);
let auth = null;
try { auth = JSON.parse(localStorage.getItem(AUTH_KEY)); } catch { auth = null; }
const saveAuth = a => { auth = a; try { a ? localStorage.setItem(AUTH_KEY, JSON.stringify(a)) : localStorage.removeItem(AUTH_KEY); } catch { /* ignore */ } };
export const account = () => auth ? { email: auth.email } : null;
export const status = { state: 'idle', at: null, error: '', packError: '', health: null, healthError: '' };

async function call(path, { method = 'GET', body, token, headers = {} } = {}) {
  const { url, key } = conf();
  const res = await fetch(url + path, {
    method,
    headers: { apikey: key, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; } // e.g. a Wi-Fi login page instead of the server
  if (!res.ok || (text && data === null)) {
    const err = new Error(data?.msg || data?.error_description || data?.message || data?.error || `HTTP ${res.status}`);
    err.status = res.ok ? 0 : res.status;
    throw err;
  }
  return data;
}
const keep = d => saveAuth({ token: d.access_token, refresh: d.refresh_token, exp: Date.now() + (d.expires_in - 60) * 1000, uid: d.user.id, email: d.user.email });

export async function signIn(email, password) { keep(await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } })); S.sync = { lastPulled: null, dirty: true }; save(); return syncNow(); }
export async function signUp(email, password) {
  const d = await call('/auth/v1/signup', { method: 'POST', body: { email, password } });
  if (!d.access_token) return 'confirm'; // the project asks new accounts to confirm their email first
  keep(d); S.sync = { lastPulled: null, dirty: true }; save(); await syncNow(); return 'ok';
}
export const resetPassword = email => call('/auth/v1/recover', { method: 'POST', body: { email } });
export function signOut() { saveAuth(null); S.sync = null; save(); }

// The sign-in lasts an hour and is renewed with a one-time refresh code. Only the server saying
// "this sign-in is no longer valid" signs you out. No connection, a slow network, the app being
// put away mid-request, a Wi-Fi login page or a server hiccup keep you signed in; it simply tries
// again on the next sync. Only one renewal runs at a time (each refresh code works once).
let refreshing = null;
export const lastEmail = () => { try { return localStorage.getItem('pg27.lastEmail') || ''; } catch { return ''; } };
async function token() {
  if (!auth) throw new Error('Not signed in');
  if (Date.now() < auth.exp) return auth.token;
  refreshing ||= (async () => {
    const used = auth.refresh;
    try { keep(await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: used } })); }
    catch (e) {
      if (auth && auth.refresh !== used) return; // renewed meanwhile
      if (e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429) {
        try { localStorage.setItem('pg27.lastEmail', auth.email); } catch { /* ignore */ }
        saveAuth(null); throw new Error('Signed out. Please sign in again.');
      }
      throw e; // offline or server trouble: stay signed in
    } finally { refreshing = null; }
  })();
  await refreshing;
  return auth.token;
}

// Things that only matter on this device: never sent, never overwritten.
const LOCAL = ['ui', 'sync', 'focus', 'watch', 'push'];
const strip = st => { const o = { ...st }; for (const k of LOCAL) delete o[k]; o.settings = { ...st.settings }; delete o.settings.syncUrl; delete o.settings.syncKey; delete o.settings.theme; return o; };

const byId = (a = [], b = []) => { const m = new Map(); for (const x of [...a, ...b]) m.set(x.id, { ...(m.get(x.id) || {}), ...x }); return [...m.values()]; };
const later = (x, y) => (x?.t || x?.d || '') >= (y?.t || y?.d || '') ? x : y;
// Merge this device's state with the other device's. With `base` (what both last agreed on,
// saved after every sync) it's a three-way merge: for each plan day, note, setting, pass…
// whichever side changed it since the last sync wins, so an edit here is never undone by a
// stale copy there, and deletions (removing a lecture, undoing a tick) stick.
// Without a base it falls back to: union of everything, the other side wins on clashes.
const same = (x, y) => JSON.stringify(x ?? null) === JSON.stringify(y ?? null);
function pick3(mine, theirs, base) {
  if (base === undefined) return theirs !== undefined ? theirs : mine;
  if (!same(mine, base)) return mine;       // changed here: keep it (even if that's a deletion)
  return theirs;                             // unchanged here: take theirs (their edit or deletion)
}
function dict3(mine = {}, theirs = {}, base) {
  const out = {};
  for (const k of new Set([...Object.keys(mine), ...Object.keys(theirs), ...Object.keys(base || {})])) {
    const v = base ? pick3(mine[k], theirs[k], base[k]) : (theirs[k] !== undefined ? theirs[k] : mine[k]);
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out;
}
export function merge(mine, theirs, theirsNewer, base = null) {
  const [older, newer] = theirsNewer ? [mine, theirs] : [theirs, mine];
  const out = { ...older, ...newer };
  if (base) for (const k of Object.keys(out)) if (typeof out[k] !== 'object' || out[k] === null) out[k] = pick3(mine[k], theirs[k], base[k]);
  out.progress = {};
  for (const id of new Set([...Object.keys(mine.progress || {}), ...Object.keys(theirs.progress || {})])) {
    const a = mine.progress?.[id] || {}, b = theirs.progress?.[id] || {}, o = base?.progress?.[id], p = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (o && (o[k] !== undefined) && (a[k] === undefined || b[k] === undefined)) {
        // Present at the last sync, now gone on one side: an undo there. Keep it only if the other side changed it.
        const v = pick3(a[k], b[k], o[k]); if (v) p[k] = v; continue;
      }
      p[k] = a[k] && b[k] ? later(a[k], b[k]) : a[k] || b[k];
    }
    if (Object.keys(p).length) out.progress[id] = p;
  }
  for (const k of ['tests', 'mistakes', 'sessions', 'pins', 'pairs', 'rehearsals']) {
    const u = byId(older[k], newer[k]);
    // Deleted on one side since the last sync (and not edited on the other): stays deleted.
    const baseIds = new Set((base?.[k] || []).map(x => x.id)), mi = new Set((mine[k] || []).map(x => x.id)), ti = new Set((theirs[k] || []).map(x => x.id));
    out[k] = base ? u.filter(x => !(baseIds.has(x.id) && (!mi.has(x.id) || !ti.has(x.id)))) : u;
  }
  out.history = byId(older.history, newer.history).sort((x, y) => y.at.localeCompare(x.at)).slice(0, 5000);
  for (const k of ['plan', 'notes', 'health', 'days', 'goals', 'badges', 'reflect', 'runtimes', 'duty', 'revTime', 'pytLinks', 'mastery']) out[k] = base ? dict3(mine[k], theirs[k], base[k]) : { ...(older[k] || {}), ...(newer[k] || {}) };
  out.settings = base ? dict3(mine.settings, theirs.settings, base.settings) : { ...older.settings, ...newer.settings };
  return out;
}

// What both devices last agreed on (the copy this device last pushed or pulled).
const BASE_KEY = 'pg27.syncbase';
const readBase = () => { try { return JSON.parse(localStorage.getItem(BASE_KEY)); } catch { return null; } };
const writeBase = d => { try { localStorage.setItem(BASE_KEY, JSON.stringify(d)); } catch { /* full or private: falls back to two-way */ } };

let pushTimer = null, busy = false, quiet = false;
export async function syncNow() {
  if (!configured() || !auth || busy) return;
  busy = true; status.state = 'syncing'; status.error = '';
  const startVersion = saveCount;
  const startSnap = JSON.parse(JSON.stringify(strip(S))); // the common ancestor if you edit during this sync
  let pushed = null;
  try {
    const tk = await token();
    let next = S, stamp = null;
    // Read, merge, then write only if nobody wrote in between; otherwise go round again.
    for (let attempt = 0; attempt < 4; attempt++) {
      const rows = await call(`/rest/v1/pg27_state?user_id=eq.${auth.uid}&select=data,updated_at`, { token: tk });
      const remote = rows?.[0];
      const sync = next.sync || { lastPulled: null, dirty: true };
      if (remote && remote.updated_at !== sync.lastPulled) {
        // Your other device saved since this one last looked.
        const theirs = mergeState({ ...remote.data, ui: S.ui });
        const merged = sync.dirty ? merge(next, theirs, true, readBase()) : { ...theirs };
        for (const k of LOCAL) merged[k] = S[k];
        merged.settings = { ...merged.settings, syncUrl: S.settings.syncUrl, syncKey: S.settings.syncKey, theme: S.settings.theme };
        merged.sync = { lastPulled: remote.updated_at, dirty: sync.dirty };
        next = merged;
      }
      stamp = remote?.updated_at || null;
      if (!(next.sync?.dirty ?? true) && remote) break;
      const at = new Date().toISOString();
      const body = { user_id: auth.uid, data: strip(next), updated_at: at };
      pushed = JSON.parse(JSON.stringify(body.data)); // a frozen copy: later edits mustn't change it
      if (!remote) {
        await call('/rest/v1/pg27_state', { method: 'POST', token: tk, headers: { Prefer: 'return=minimal' }, body });
      } else {
        const done = await call(`/rest/v1/pg27_state?user_id=eq.${auth.uid}&updated_at=eq.${encodeURIComponent(remote.updated_at)}`,
          { method: 'PATCH', token: tk, headers: { Prefer: 'return=representation' }, body: { data: body.data, updated_at: at } });
        if (!done?.length) continue; // someone wrote first: re-read and merge
      }
      stamp = at;
      break;
    }
    const finalSync = { lastPulled: stamp, dirty: false };
    if (saveCount === startVersion) writeBase(pushed || strip(next));
    if (saveCount !== startVersion) {
      // You changed something while this sync was talking to the server. Don't overwrite it:
      // keep your copy and sync again right away. If the server copy has the other device's
      // changes, the next round pulls it and merges, with this sync's starting point as the base.
      writeBase(next !== S ? startSnap : (pushed || strip(next)));
      S.sync = { lastPulled: next !== S ? null : stamp, dirty: true }; saveQuiet();
      clearTimeout(pushTimer); pushTimer = setTimeout(syncNow, 300);
    } else if (next !== S) { next.sync = finalSync; quiet = true; replaceState(next); startHistory(); quiet = false; document.dispatchEvent(new Event('pg27:render')); }
    else { S.sync = finalSync; saveQuiet(); }
    status.state = 'ok'; status.at = new Date();
    await syncPack(tk);
    await syncHealth(tk);
  } catch (e) {
    status.state = 'error';
    status.error = /failed to fetch|load failed|network|HTTP 5|HTTP 0|timed out/i.test(e.message) || e.status === 0 || e.status >= 500 ? 'No connection. It will sync when you\'re back online.'
      : /signed out/i.test(e.message) ? e.message
      : /permission denied for table/i.test(e.message)
      ? 'The sync table needs access rights. In Supabase (this app\'s project), open SQL Editor and run the "grant" lines at the end of tools/supabase.sql, then tap Sync now.'
      : e.message;
  } finally { busy = false; document.dispatchEvent(new Event('pg27:sync')); }
}

// The PYT pack (about 600 KB) lives in its own column, so the everyday sync stays small.
// The newer import wins; each device downloads it only when the stamp differs.
async function syncPack(tk) {
  try {
    const pyt = await import('./views/pyt.js');
    const mine = pyt.getPack();
    const rows = await call(`/rest/v1/pg27_state?user_id=eq.${auth.uid}&select=pyt_at:pyt->at`, { token: tk });
    if (!rows?.length) return;
    const theirs = +rows[0].pyt_at || 0, at = mine ? +mine.at || 0 : 0;
    if (mine && (!theirs || at > theirs)) {
      if (!at) { mine.at = Date.now(); pyt.setPack(mine); }
      await call(`/rest/v1/pg27_state?user_id=eq.${auth.uid}`, { method: 'PATCH', token: tk, headers: { Prefer: 'return=minimal' }, body: { pyt: mine } });
    } else if (theirs && theirs !== at) {
      const got = await call(`/rest/v1/pg27_state?user_id=eq.${auth.uid}&select=pyt`, { token: tk });
      const p = got?.[0]?.pyt;
      if (p?.kind === 'pg27-pyt') pyt.setPack(p);
    }
    status.packError = '';
  } catch (e) {
    status.packError = /pyt/i.test(e.message) && /column|schema/i.test(e.message)
      ? 'To sync the PYT pack, the account owner runs the "pyt" line at the end of tools/supabase.sql once in Supabase (SQL Editor). Until then, import the pack on each device.'
      : '';
  }
}
document.addEventListener('pg27:pack', () => syncNow());

// Apple Health sent in the background: the Shortcut writes sleep times to your own health row
// (with a private key); the app applies them here, once per new delivery.
const HEALTH_AT = 'pg27.healthAt';
const missingHealth = e => /pg27_health/i.test(e.message) && /exist|schema|relation|could not find/i.test(e.message);
async function syncHealth(tk) {
  try {
    const rows = await call(`/rest/v1/pg27_health?user_id=eq.${auth.uid}&select=key,data,updated_at`, { token: tk });
    const r = rows?.[0];
    status.healthKey = r?.key || null; status.healthError = '';
    if (!r?.data) return;
    let seen = null; try { seen = localStorage.getItem(HEALTH_AT); } catch { /* ignore */ }
    status.health = { at: r.updated_at };
    if (seen === r.updated_at) return;
    const { applyHealth } = await import('./views/health.js');
    status.health.msg = applyHealth(r.data, Date.parse(r.data.at || r.updated_at));
    try { localStorage.setItem(HEALTH_AT, r.updated_at); } catch { /* ignore */ }
    document.dispatchEvent(new Event('pg27:render'));
  } catch (e) {
    status.healthError = missingHealth(e) ? 'needs-sql' : /failed to fetch|load failed|network/i.test(e.message) ? '' : e.message;
  }
}
// Look again now (Settings open, or "Check again"). Quietly at most every 20 seconds.
let lastHealthCheck = 0, checking = false;
export async function healthCheck(force) {
  if (!auth || checking || (!force && Date.now() - lastHealthCheck < 20000)) return;
  lastHealthCheck = Date.now(); checking = true;
  const before = JSON.stringify([status.healthError, status.healthKey]);
  try { await syncHealth(await token()); } catch { /* offline: try later */ } finally { checking = false; }
  if (!force && JSON.stringify([status.healthError, status.healthKey]) !== before) document.dispatchEvent(new Event('pg27:sync'));
}
// Turn on background Health: make (or keep) your private key.
export async function healthSetup() {
  const tk = await token();
  const rows = await call(`/rest/v1/pg27_health?user_id=eq.${auth.uid}&select=key`, { token: tk });
  if (rows?.[0]?.key) return (status.healthKey = rows[0].key);
  const b = crypto.getRandomValues(new Uint8Array(18));
  const key = btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  await call('/rest/v1/pg27_health', { method: 'POST', token: tk, headers: { Prefer: 'return=minimal' }, body: { user_id: auth.uid, key } });
  return (status.healthKey = key);
}
export const syncConf = () => conf();

function saveQuiet() { quiet = true; save(); quiet = false; }
let saveCount = 0;
onSave(() => {
  if (quiet || !auth || !configured()) return;
  saveCount++;
  if (!S.sync?.dirty) { S.sync = { ...(S.sync || {}), dirty: true }; saveQuiet(); }
  clearTimeout(pushTimer); pushTimer = setTimeout(syncNow, 2500);
});

export function startSync() {
  // Listen even when signed out, so signing in later still syncs on every reopen.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
  window.addEventListener('online', syncNow);
  // While the app stays open, look for new Health data (and other devices' edits) every 15 minutes.
  setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 15 * 60 * 1000);
  syncNow();
}
