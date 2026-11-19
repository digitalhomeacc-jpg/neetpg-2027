// Sync between your phones and tablets through your own Supabase project.
// Sign in with email + password; each account sees only its own row (row-level security).
// The whole study state is one JSON document per account. When two devices both changed
// it, the two are merged so nothing logged on either is lost.
import { S, save, onSave, replaceState, mergeState } from './core.js';
import { SYNC } from './config.js';
import { startHistory } from './history.js';

const AUTH_KEY = 'pg27.auth';
const conf = () => ({ url: (S.settings.syncUrl || SYNC.url || '').replace(/\/$/, ''), key: S.settings.syncKey || SYNC.anonKey || '' });
export const configured = () => !!(conf().url && conf().key);
let auth = null;
try { auth = JSON.parse(localStorage.getItem(AUTH_KEY)); } catch { auth = null; }
const saveAuth = a => { auth = a; try { a ? localStorage.setItem(AUTH_KEY, JSON.stringify(a)) : localStorage.removeItem(AUTH_KEY); } catch { /* ignore */ } };
export const account = () => auth ? { email: auth.email } : null;
export const status = { state: 'idle', at: null, error: '' };

async function call(path, { method = 'GET', body, token, headers = {} } = {}) {
  const { url, key } = conf();
  const res = await fetch(url + path, {
    method,
    headers: { apikey: key, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.msg || data?.error_description || data?.message || data?.error || `HTTP ${res.status}`);
  return data;
}
const keep = d => saveAuth({ token: d.access_token, refresh: d.refresh_token, exp: Date.now() + (d.expires_in - 60) * 1000, uid: d.user.id, email: d.user.email });

export async function signIn(email, password) { keep(await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } })); S.sync = { lastPulled: null, dirty: true }; save(); return syncNow(); }
export async function signUp(email, password) {
  const d = await call('/auth/v1/signup', { method: 'POST', body: { email, password } });
  if (!d.access_token) return 'confirm'; // the project asks new accounts to confirm their email first
  keep(d); S.sync = { lastPulled: null, dirty: true }; save(); await syncNow(); return 'ok';
}
export function signOut() { saveAuth(null); S.sync = null; save(); }

async function token() {
  if (!auth) throw new Error('Not signed in');
  if (Date.now() < auth.exp) return auth.token;
  try { keep(await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: auth.refresh } })); }
  catch (e) { saveAuth(null); throw new Error('Signed out. Please sign in again.'); }
  return auth.token;
}

// Things that only matter on this device: never sent, never overwritten.
const LOCAL = ['ui', 'sync', 'focus', 'watch', 'push'];
const strip = st => { const o = { ...st }; for (const k of LOCAL) delete o[k]; o.settings = { ...st.settings }; delete o.settings.syncUrl; delete o.settings.syncKey; delete o.settings.theme; return o; };

const byId = (a = [], b = []) => { const m = new Map(); for (const x of [...a, ...b]) m.set(x.id, { ...(m.get(x.id) || {}), ...x }); return [...m.values()]; };
const later = (x, y) => (x?.t || x?.d || '') >= (y?.t || y?.d || '') ? x : y;
// Merge two versions: union of everything, newer wins where both have the same thing.
export function merge(mine, theirs, theirsNewer) {
  const [older, newer] = theirsNewer ? [mine, theirs] : [theirs, mine];
  const out = { ...older, ...newer };
  out.progress = {};
  for (const id of new Set([...Object.keys(mine.progress || {}), ...Object.keys(theirs.progress || {})])) {
    const a = mine.progress?.[id] || {}, b = theirs.progress?.[id] || {}, p = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) p[k] = a[k] && b[k] ? later(a[k], b[k]) : a[k] || b[k];
    out.progress[id] = p;
  }
  for (const k of ['tests', 'mistakes', 'sessions', 'pins', 'pairs', 'rehearsals']) out[k] = byId(older[k], newer[k]);
  out.history = byId(older.history, newer.history).sort((x, y) => y.at.localeCompare(x.at)).slice(0, 5000);
  for (const k of ['plan', 'notes', 'health', 'days', 'goals', 'badges', 'reflect']) out[k] = { ...(older[k] || {}), ...(newer[k] || {}) };
  out.settings = { ...older.settings, ...newer.settings };
  return out;
}

let pushTimer = null, busy = false, quiet = false;
export async function syncNow() {
  if (!configured() || !auth || busy) return;
  busy = true; status.state = 'syncing'; status.error = '';
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
        const merged = sync.dirty ? merge(next, theirs, true) : { ...theirs };
        for (const k of LOCAL) merged[k] = S[k];
        merged.settings = { ...merged.settings, syncUrl: S.settings.syncUrl, syncKey: S.settings.syncKey, theme: S.settings.theme };
        merged.sync = { lastPulled: remote.updated_at, dirty: sync.dirty };
        next = merged;
      }
      stamp = remote?.updated_at || null;
      if (!(next.sync?.dirty ?? true) && remote) break;
      const at = new Date().toISOString();
      const body = { user_id: auth.uid, data: strip(next), updated_at: at };
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
    if (next !== S) { next.sync = finalSync; quiet = true; replaceState(next); startHistory(); quiet = false; document.dispatchEvent(new Event('pg27:render')); }
    else { S.sync = finalSync; saveQuiet(); }
    status.state = 'ok'; status.at = new Date();
  } catch (e) {
    status.state = 'error'; status.error = e.message;
  } finally { busy = false; document.dispatchEvent(new Event('pg27:sync')); }
}

function saveQuiet() { quiet = true; save(); quiet = false; }
onSave(() => {
  if (quiet || !auth || !configured()) return;
  if (!S.sync?.dirty) { S.sync = { ...(S.sync || {}), dirty: true }; saveQuiet(); }
  clearTimeout(pushTimer); pushTimer = setTimeout(syncNow, 2500);
});

export function startSync() {
  // Listen even when signed out, so signing in later still syncs on every reopen.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
  window.addEventListener('online', syncNow);
  syncNow();
}
