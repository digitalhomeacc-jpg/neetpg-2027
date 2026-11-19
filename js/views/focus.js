// Full-screen focus timer for study that isn't a video: Anki, Q-bank, PYQs, notes.
// The running session lives in state (timestamps), so it survives closing the app.
import { S, save, today, uid, FOCUS_KINDS, h, mins } from '../core.js';
import { toast, ICON } from '../ui.js';

const KIND = Object.fromEntries(FOCUS_KINDS);
const LENGTHS = [[25, '25 min'], [50, '50 min'], [0, 'Open']];
let ticker = null;
let pick = { kind: 'anki', goal: 50 };

const el = () => document.getElementById('focus-root');
export const running = () => S.focus && S.focus.startedAt != null;
const elapsed = () => { const f = S.focus; return f ? f.elapsed + (f.running ? (Date.now() - f.startedAt) / 1000 : 0) : 0; };
const clock = sec => { const s = Math.max(0, Math.floor(sec)); const hh = Math.floor(s / 3600), mm = Math.floor(s / 60) % 60, ss = s % 60; return hh ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${mm}:${String(ss).padStart(2, '0')}`; };

function ringSvg(frac) {
  const r = 48, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, frac));
  return `<svg viewBox="0 0 116 116"><circle class="track" cx="58" cy="58" r="${r}"/>
    <circle id="f-bar" class="bar" cx="58" cy="58" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - f)}"/></svg>`;
}

function html() {
  const f = S.focus;
  if (!running()) {
    return `<div class="focus enter">
      <button class="icon-btn fx" data-act="focus-close" aria-label="Close">${ICON.x}</button>
      <div class="f-kind">Focus session</div>
      <div class="large-title" style="text-align:center;margin:0"><h1>What are you doing?</h1></div>
      <div class="f-chips">${FOCUS_KINDS.map(([k, l]) => `<button class="chip" data-act="focus-kind" data-v="${k}" aria-pressed="${pick.kind === k}">${l}</button>`).join('')}</div>
      <div class="f-chips">${LENGTHS.map(([g, l]) => `<button class="chip" data-act="focus-len" data-v="${g}" aria-pressed="${pick.goal === g}">${l}</button>`).join('')}</div>
      <p class="f-hint">Time logged here counts toward your day and your streak. Videos and revisions are timed on their own screens.</p>
      <div class="f-actions"><button class="btn primary" data-act="focus-start">Start</button></div>
    </div>`;
  }
  const e = elapsed(), goal = f.goal * 60;
  const big = goal ? (e <= goal ? clock(goal - e) : `+${clock(e - goal)}`) : clock(e);
  return `<div class="focus">
    <button class="icon-btn fx" data-act="focus-close" aria-label="Minimise">${ICON.down}</button>
    <div class="f-kind">${h(KIND[f.kind])}${f.running ? '' : ' · paused'}</div>
    <div class="ring">${ringSvg(goal ? e / goal : (e % 3600) / 3600)}
      <div class="label"><div class="big num" id="f-clock">${big}</div><div class="of">${goal ? `of ${mins(f.goal)}` : 'open session'}</div></div></div>
    <div class="f-actions">
      <button class="btn" data-act="focus-toggle">${f.running ? 'Pause' : 'Resume'}</button>
      <button class="btn primary" data-act="focus-finish">Finish</button>
    </div>
    <button class="btn ghost danger" data-act="focus-discard">Discard</button>
  </div>`;
}

function tick() {
  if (!running()) return;
  const f = S.focus, e = elapsed(), goal = f.goal * 60;
  const c = document.getElementById('f-clock');
  if (c) c.textContent = goal ? (e <= goal ? clock(goal - e) : `+${clock(e - goal)}`) : clock(e);
  const bar = document.getElementById('f-bar');
  if (bar) { const len = 2 * Math.PI * 48; bar.style.strokeDashoffset = len * (1 - Math.min(1, goal ? e / goal : (e % 3600) / 3600)); }
  const pill = document.getElementById('focus-pill-time');
  if (pill) pill.textContent = clock(e);
  if (goal && !f.alerted && e >= goal) {
    f.alerted = true; save();
    toast(`${mins(f.goal)} done. Finish, or keep going.`);
    navigator.serviceWorker?.ready.then(r => r.showNotification('Focus session done', { body: `${mins(f.goal)} of ${KIND[f.kind]}. Nice work.`, tag: 'pg27-focus', icon: 'icons/icon-192.png' })).catch(() => {});
  }
}

export function openFocus() { el().innerHTML = html(); S.ui.focusOpen = true; document.body.classList.add('locked'); }
export function renderFocus() { if (S.ui.focusOpen) el().innerHTML = html().replace('focus enter', 'focus'); }
function closeFocus() { S.ui.focusOpen = false; el().innerHTML = ''; document.body.classList.remove('locked'); }
clearInterval(ticker); ticker = setInterval(tick, 500);

export function focusPill() {
  if (!running()) return '';
  return `<button class="focus-pill" data-act="focus-open"><span class="pulse"></span><span class="grow">${h(KIND[S.focus.kind])} session${S.focus.running ? '' : ' (paused)'}</span><span class="num" id="focus-pill-time">${clock(elapsed())}</span></button>`;
}

export const actions = {
  'focus-open': () => openFocus(),
  'focus-close': () => closeFocus(),
  'focus-kind': e => { pick.kind = e.dataset.v; renderFocus(); },
  'focus-len': e => { pick.goal = +e.dataset.v; renderFocus(); },
  'focus-start': () => { S.focus = { kind: pick.kind, goal: pick.goal, startedAt: Date.now(), elapsed: 0, running: true, d: today() }; save(); renderFocus(); },
  'focus-toggle': () => {
    const f = S.focus;
    if (f.running) { f.elapsed = elapsed(); f.running = false; } else { f.startedAt = Date.now(); f.running = true; }
    save(); renderFocus();
  },
  'focus-finish': () => {
    const m = Math.round(elapsed() / 60);
    if (m >= 1) { S.sessions.push({ id: uid(), d: S.focus.d || today(), t: new Date().toISOString(), m, kind: S.focus.kind }); toast(`Logged ${mins(m)} of ${KIND[S.focus.kind]}`); }
    else toast('Under a minute, so nothing was logged');
    S.focus = null; save(); closeFocus();
  },
  'focus-discard': () => { if (confirm('Discard this session without logging it?')) { S.focus = null; save(); closeFocus(); } },
};
