import { S, VIDS, D, DOW, DOW_LONG, SPEEDS, save, today, h, hrs, sp, mergeState, replaceState, resetProgress } from '../core.js';
import { seg, sectionH, toast, copy, ICON } from '../ui.js';
import { pushSupported, isInstalled, isIOS, enablePush, testNotification, summaryLine } from '../notify.js';
import * as sync from '../sync.js';
import { APP_VERSION } from '../version.js';
import { healthSettings } from './health.js';

function syncCard() {
  if (!sync.configured()) {
    return `<p class="small muted" style="margin:0 0 10px">Sign in on your iPhone and iPad to keep them in step. This needs the app's sync server to be set up once.</p>
      <details class="setup"><summary>Set up sync (repo owner, once)</summary><ol class="small">
        <li>Create a free project at supabase.com.</li>
        <li>SQL Editor → paste <code>tools/supabase.sql</code> from the repo → Run.</li>
        <li>Authentication → Sign In / Providers → Email: turn <b>Confirm email</b> off (or confirm each new account from its email).</li>
        <li>Project Settings → API: copy the Project URL and the <b>anon public</b> key, and send them to Claude to put in <code>js/config.js</code>. Or enter them below on each device.</li></ol>
        <div class="field"><label for="sy-url">Project URL</label><input id="sy-url" class="inp" placeholder="https://xxxx.supabase.co" autocomplete="off"></div>
        <div class="field"><label for="sy-key">Anon public key</label><input id="sy-key" class="inp" autocomplete="off"></div>
        <button class="btn block" data-act="sync-config">Save server details</button></details>`;
  }
  const a = sync.account(), st = sync.status;
  if (!a) {
    const up = auth.mode === 'up';
    return `<div class="auth">
      <div class="seg auth-seg"><button data-act="auth-mode" data-v="in" aria-pressed="${!up}">Sign in</button><button data-act="auth-mode" data-v="up" aria-pressed="${up}">Create account</button></div>
      <p class="small muted auth-lead">${up ? 'One account for all your devices. Your progress on this phone becomes your starting point.' : 'Use the same email and password on iPhone and iPad. Edits on both are merged.'}</p>
      <label class="auth-field"><span>Email</span><input id="sy-email" class="inp" type="email" autocomplete="username" inputmode="email" autocapitalize="off" spellcheck="false" placeholder="you@example.com" value="${h(auth.email)}"></label>
      <label class="auth-field"><span>Password</span><div class="pw"><input id="sy-pass" class="inp" type="${auth.show ? 'text' : 'password'}" autocomplete="${up ? 'new-password' : 'current-password'}" placeholder="${up ? 'At least 6 characters' : 'Your password'}" value="${h(auth.pass)}">
        <button class="pw-eye" data-act="auth-show" aria-label="${auth.show ? 'Hide' : 'Show'} password">${auth.show ? 'Hide' : 'Show'}</button></div></label>
      ${up ? `<label class="auth-field"><span>Confirm password</span><input id="sy-pass2" class="inp" type="${auth.show ? 'text' : 'password'}" autocomplete="new-password" placeholder="Type it again" value="${h(auth.pass2)}"></label>` : ''}
      ${auth.error ? `<div class="auth-msg bad" role="alert">${h(auth.error)}</div>` : auth.note ? `<div class="auth-msg good" role="status">${h(auth.note)}</div>` : ''}
      <button class="btn primary block auth-go${auth.busy ? ' busy' : ''}" data-act="${up ? 'sync-up' : 'sync-in'}" ${auth.busy ? 'disabled' : ''}>${auth.busy ? `<span class="spin"></span>${up ? 'Creating account…' : 'Signing in…'}` : up ? 'Create account' : 'Sign in'}</button>
      ${up ? '' : `<button class="link auth-forgot" data-act="auth-forgot">Forgot password?</button>`}
    </div>`;
  }
  const pill = st.state === 'syncing' ? '<span class="sync-pill busy"><span class="spin"></span>Syncing…</span>'
    : st.state === 'error' ? '<span class="sync-pill bad">● Not synced</span>'
    : st.at ? `<span class="sync-pill good">● Synced ${st.at.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>` : '<span class="sync-pill good">● Connected</span>';
  return `<div class="acct"><div class="avatar">${h(a.email[0].toUpperCase())}</div>
      <div class="grow"><div class="t">${h(a.email)}</div>${pill}</div></div>
    ${st.state === 'error' ? `<div class="auth-msg bad">${h(st.error)}</div>` : '<p class="small muted" style="margin:10px 0 12px">Changes sync a few seconds after you make them, and when you open the app.</p>'}
    <div class="btns"><button class="btn" data-act="sync-now" ${st.state === 'syncing' ? 'disabled' : ''}>Sync now</button><button class="btn danger" data-act="sync-out">Sign out</button></div>`;
}

function reminders() {
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  if (isIOS() && !isInstalled()) {
    return `<p class="small" style="margin:0">On iPhone, reminders only work from the home-screen app. In Safari tap <b>Share → Add to Home Screen</b>, open PG 2027 from there, and come back here.</p>`;
  }
  if (!pushSupported()) return `<p class="small muted" style="margin:0">This browser can't receive push notifications.</p>`;
  if (!S.push || perm !== 'granted') {
    return `<p class="small muted" style="margin:0 0 12px">A notification at 7 am with today's bare minimum and what to revise, and one at 9 pm if you're short.</p>
      <button class="btn primary block" data-act="push-on">Turn on reminders</button>
      ${perm === 'denied' ? '<p class="hint">Notifications are blocked. Allow them for PG 2027 in iPhone Settings → Notifications.</p>' : ''}`;
  }
  return `<p class="small" style="margin:0 0 4px"><b>On for this device.</b> Today: ${summaryLine()}.</p>
    <div class="btns" style="margin:12px 0"><button class="btn" data-act="push-test" data-v="morning">Test morning</button><button class="btn" data-act="push-test" data-v="evening">Test evening</button></div>
    <button class="btn block" data-act="push-copy">Copy my reminder code</button>
    <p class="hint">Reminders reach a phone only once its code is saved in the app's GitHub repo. Friends: send this code to whoever runs the repo. It contains no study data.</p>
    <details class="setup"><summary>Repo owner: adding codes on GitHub</summary>
      <ol class="small">
        <li>In GitHub, open the <b>neetpg-2027</b> repo → Settings → Secrets and variables → Actions.</li>
        <li>Edit <code>PUSH_SUBSCRIPTION</code>. Paste <b>every</b> code, yours and your friends', <b>one per line</b>. GitHub doesn't show the old value, so keep all the codes together somewhere (a note or a WhatsApp chat to yourself).</li>
        <li><code>VAPID_PRIVATE_KEY</code> stays as it is. One key works for everyone.</li>
        <li>Actions tab → Daily reminders → <b>Run workflow</b>. The log shows a line per phone.</li>
      </ol>
    </details>`;
}

export function view() {
  const st = S.settings;
  return {
    title: 'Settings',
    meta: '',
    html: `
  ${sectionH('Plan')}
  <section class="card">
    <div class="field" style="margin-top:0"><label for="s-name">Your name</label><input id="s-name" class="inp" data-set="name" value="${h(st.name || '')}" placeholder="For the welcome screen, e.g. Dr. Sanket" autocomplete="off">
      <p class="hint">Shown when the app opens. Leave it empty for a plain greeting.</p></div>
    <div class="field"><label for="s-start">Started on</label><input id="s-start" type="date" data-set="start" value="${st.start}">
      <p class="hint">"Behind/ahead" is measured from this date. Set it to today for a fresh start.</p></div>
    <div class="field"><label for="s-target">Finish WOR first watch by</label><input id="s-target" type="date" data-set="target" value="${st.target}"></div>
    <div class="field"><label for="s-exam">Exam date</label><input id="s-exam" type="date" data-set="exam" value="${st.exam}">
      <p class="hint">NBEMS hasn't announced NEET PG 2027. This estimate is based on 30 Aug 2026. Phases in Plan follow this date.</p></div>
    <div class="field"><span class="lbl">Rest days</span><div class="days">${DOW.map((d, i) => `<button data-act="rest" data-v="${i}" aria-pressed="${st.rest.includes(i)}" aria-label="${DOW_LONG[i]}">${d}</button>`).join('')}</div></div>
    <div class="field"><span class="lbl">Usual watching speed</span>${seg('speed', SPEEDS.map(s => [s, sp(s)]), st.speed)}
      <p class="hint">Pre-selected when you mark a video. After 2 hours logged, plans use your real average.</p></div>
    <div class="field" style="margin-bottom:0"><span class="lbl">Questions in a full test</span>${seg('questions', [[200, '200'], [180, '180']], st.questions)}
      <p class="hint">Reports conflict on whether 2026 had 180 or 200 questions. This only sets the default when you log a test.</p></div>
  </section>

  ${sectionH('Daily targets')}
  <section class="card">
    <div class="field" style="margin-top:0"><span class="lbl">Most revision per day</span>${seg('revcap', [[60, '1h'], [90, '1.5h'], [120, '2h'], [180, '3h'], [0, 'No cap']], st.revCap ?? 120)}
      <p class="hint">When more revisions than this fall on one day, some R2–R5 move a few days earlier so they don't pile up.</p></div>
    <div class="field"><span class="lbl">Get-ready time before Study now</span>${seg('breath', [[0, 'None'], [60, '1 min'], [120, '2 min'], [180, '3 min']], st.breath ?? 120)}</div>
    <div class="field" style="margin-bottom:0"><label for="s-marrow">“Open Marrow” link</label><input id="s-marrow" class="inp" data-set="marrowUrl" value="${h(st.marrowUrl || 'https://www.marrow.com/')}" autocomplete="off">
      <p class="hint">Opens Marrow during the get-ready time. If it opens Safari instead of the app, try the link your Marrow app uses.</p></div>
  </section>

  <section class="card flush"><ul class="list"><li class="item"><span class="rbadge" style="--h:30">🕘</span>
    <button class="open" data-act="history"><div class="t">Change history</div><div class="s">Every change, with the exact time and what it was before</div></button><span class="faint">${ICON.chev}</span></li></ul></section>

  ${sectionH('Sync between devices')}
  <section class="card">${syncCard()}</section>

  ${sectionH('Apple Health')}
  <section class="card">${healthSettings()}</section>

  ${sectionH('Share with friends')}
  <section class="card">
    <p class="small muted" style="margin:0 0 12px">Friends open the same link and get their own plan. Their progress stays on their phone, and nobody sees anyone else's.</p>
    <button class="btn primary block" data-act="share-app">${ICON.share}Share PG 2027</button>
  </section>

  ${sectionH('Reminders')}
  <section class="card">${reminders()}</section>

  ${sectionH('Appearance')}
  <section class="card">${seg('theme', [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']], st.theme)}</section>

  ${sectionH('Backup')}
  <section class="card">
    <p class="small muted" style="margin:0 0 12px">Everything is saved on this device only. Export a backup now and then; import it to move to another phone or browser.</p>
    <div class="btns">
      <button class="btn" data-act="export">Export backup</button>
      <label class="btn" for="import-file">Import backup</label>
      <input id="import-file" type="file" accept="application/json,.json" hidden>
    </div>
    <div class="spacer"></div>
    <button class="btn ghost danger" data-act="reset">Reset all progress</button>
  </section>

  <p class="small faint center">${VIDS.length} ${h(D.source)} videos · ${hrs(VIDS.reduce((a, v) => a + v.mins, 0))} runtime · from your EXAM_PREP sheet</p>
  <p class="small faint center version-stamp">PG 2027 · version ${APP_VERSION.v} · updated ${new Date(APP_VERSION.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>`,
  };
}


// Sign-in form state lives here, so redraws (like switching tabs) keep what was typed.
const auth = { mode: 'in', email: '', pass: '', pass2: '', show: false, busy: false, error: '', note: '' };
const friendly = m => /invalid login credentials/i.test(m) ? 'Wrong email or password.'
  : /already registered|already exists/i.test(m) ? 'This email already has an account. Sign in instead.'
  : /email not confirmed/i.test(m) ? 'Confirm your email first (check your inbox), then sign in.'
  : /password should be at least|weak password/i.test(m) ? 'Choose a password with at least 6 characters.'
  : /rate limit|too many/i.test(m) ? 'Too many tries. Wait a minute and try again.'
  : /failed to fetch|network/i.test(m) ? 'No connection. Check your internet and try again.'
  : m;
const rerender = () => document.dispatchEvent(new Event('pg27:render'));

function authAct(kind) {
  const email = auth.email.trim(), pass = auth.pass;
  auth.error = ''; auth.note = '';
  if (!/^\S+@\S+\.\S+$/.test(email)) { auth.error = 'Enter a valid email.'; return; }
  if (pass.length < 6) { auth.error = 'Passwords have at least 6 characters.'; return; }
  if (kind === 'up' && pass !== auth.pass2) { auth.error = "The two passwords don't match."; return; }
  auth.busy = true; sync.status.error = '';
  (kind === 'in' ? sync.signIn(email, pass) : sync.signUp(email, pass))
    .then(r => {
      auth.busy = false;
      if (r === 'confirm') { auth.mode = 'in'; auth.note = `Account created. Open the email sent to ${email} to confirm it, then sign in here.`; }
      else { auth.pass = auth.pass2 = ''; toast(kind === 'up' ? 'Account created. Syncing…' : 'Signed in. Syncing…'); }
      rerender();
    })
    .catch(e => { auth.busy = false; auth.error = friendly(e.message); rerender(); });
}

export const actions = {
  'speed': el => { S.settings.speed = +el.dataset.v; save(); },
  'questions': el => { S.settings.questions = +el.dataset.v; save(); },
  'minpct': el => { S.settings.minPct = +el.dataset.v; save(); },
  'revcap': el => { S.settings.revCap = +el.dataset.v; save(); },
  'breath': el => { S.settings.breath = +el.dataset.v; save(); },
  'theme': el => { S.settings.theme = el.dataset.v; save(); },
  'rest': el => {
    const i = +el.dataset.v, r = S.settings.rest;
    const next = r.includes(i) ? r.filter(x => x !== i) : [...r, i];
    if (next.length > 6) { toast('Keep at least one study day'); return; }
    S.settings.rest = next; save();
  },
  'sync-config': () => {
    const url = document.getElementById('sy-url').value.trim(), key = document.getElementById('sy-key').value.trim();
    if (!/^https:\/\/.+/.test(url) || key.length < 20) { toast('Check the URL and key'); return; }
    S.settings.syncUrl = url; S.settings.syncKey = key; save(); toast('Server saved. Now sign in.');
  },
  'sync-in': () => authAct('in'),
  'sync-up': () => authAct('up'),
  'auth-mode': el => { auth.mode = el.dataset.v; auth.error = auth.note = ''; },
  'auth-show': () => { auth.show = !auth.show; },
  'auth-forgot': () => {
    auth.error = auth.note = '';
    if (!/^\S+@\S+\.\S+$/.test(auth.email.trim())) { auth.error = 'Type your email above first.'; return; }
    sync.resetPassword(auth.email.trim()).then(() => { auth.note = `If ${auth.email.trim()} has an account, a reset link is on its way.`; rerender(); })
      .catch(e => { auth.error = friendly(e.message); rerender(); });
  },
  'sync-now': () => { sync.syncNow(); },
  'sync-out': () => { if (confirm('Sign out on this device? Your progress stays here, and in your account.')) { sync.signOut(); toast('Signed out'); } },
  'push-on': () => {
    enablePush().then(() => { toast('Reminders on. Finish the GitHub setup below.'); document.dispatchEvent(new Event('pg27:render')); })
      .catch(e => toast(e.message === 'denied' ? 'Notifications were not allowed' : "Couldn't turn on reminders here"));
  },
  'push-test': el => {
    testNotification(el.dataset.v)
      .then(n => toast(`Sent: “${n.title}”. Check your notifications.`))
      .catch(e => toast(e.message || "Couldn't show a notification"));
  },
  'push-copy': () => copy(S.push, 'Copied. Send it to the repo owner, or add it to PUSH_SUBSCRIPTION yourself.'),
  'share-app': () => {
    const url = location.origin + location.pathname;
    const data = { title: 'PG 2027', text: 'My NEET PG 2027 planner: WOR videos, spaced revisions, tests and daily targets. Add it to your home screen.', url };
    if (navigator.share) navigator.share(data).catch(() => {});
    else copy(url, 'Link copied. Send it to your friends.');
  },
  'export': () => {
    const blob = new Blob([JSON.stringify({ app: 'pg27', exported: new Date().toISOString(), state: S }, null, 1)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `pg27-backup-${today()}.json`;
    S.lastBackup = today(); save();
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  'reset': () => {
    if (!confirm('Delete all progress, tests and mistakes on this device? Export a backup first if you might want it back.')) return;
    resetProgress(); S.ui.tab = 'settings'; save(); toast('Progress reset');
  },
};

// Text settings save as you type, so closing the app with the keyboard up loses nothing.
let typeTimer = null, pending = null;
const flush = () => { clearTimeout(typeTimer); if (pending) { const f = pending; pending = null; f(); } };
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
export function onInput(e) {
  if (e.target.id === 's-name' || e.target.id === 's-marrow') {
    const el = e.target, key = el.dataset.set;
    pending = () => { S.settings[key] = el.value.trim(); save(); };
    clearTimeout(typeTimer); typeTimer = setTimeout(flush, 300);
    return true;
  }
  const k = { 'sy-email': 'email', 'sy-pass': 'pass', 'sy-pass2': 'pass2' }[e.target.id];
  if (!k) return false;
  auth[k] = e.target.value; return true;
}

export function onChange(e) {
  const el = e.target;
  if (el.dataset.set === 'name') { S.settings.name = el.value.trim(); save(); return true; }
  if (el.dataset.set && el.value) {
    if (!['start', 'target', 'exam'].includes(el.dataset.set)) { S.settings[el.dataset.set] = el.value.trim(); save(); return true; }
    const next = { ...S.settings, [el.dataset.set]: el.value };
    if (next.target <= next.start) { toast('The WOR deadline has to be after the start date'); return true; }
    if (next.exam <= next.target) { toast('The exam has to be after the WOR deadline'); return true; }
    S.settings[el.dataset.set] = el.value; save(); return true;
  }
  if (el.id === 'import-file' && el.files[0]) {
    el.files[0].text().then(txt => {
      const data = JSON.parse(txt);
      if (data.app !== 'pg27' || !data.state?.progress) throw new Error('bad file');
      if (!confirm(`Replace everything on this device with the backup from ${data.exported?.slice(0, 10) || 'that file'}?`)) return;
      const n = mergeState(data.state); n.ui.tab = 'today';
      replaceState(n); document.dispatchEvent(new Event('pg27:render')); toast('Backup imported');
    }).catch(() => toast("That file isn't a PG 2027 backup")).finally(() => { el.value = ''; });
    return false;
  }
  return false;
}

// Return / "Go" on the keyboard submits the sign-in form.
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && ['sy-email', 'sy-pass', 'sy-pass2'].includes(e.target.id)) { e.preventDefault(); document.querySelector('.auth-go')?.click(); }
});
