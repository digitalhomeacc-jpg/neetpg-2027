// "Study now": a short get-ready countdown (breathe, open Marrow, find the video),
// then a timer. Stopping it marks the video watched with the real time it took.
import { S, BY, save, today, h, mins, sp, subjDot } from '../core.js';
import { toast, confetti, closeSheet, ICON } from '../ui.js';

let ticker = null;
const el = () => document.getElementById('watch-root');
export const active = () => !!S.watch;
const now = () => Date.now();
const clock = sec => { const s = Math.max(0, Math.floor(sec)); const hh = Math.floor(s / 3600), mm = Math.floor(s / 60) % 60, ss = s % 60; return hh ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${mm}:${String(ss).padStart(2, '0')}`; };
const elapsed = () => { const w = S.watch; return !w || w.phase !== 'run' ? 0 : w.elapsed + (w.running ? (now() - w.startedAt) / 1000 : 0); };
const readyLeft = () => S.watch ? Math.max(0, (S.watch.readyEnds - now()) / 1000) : 0;

function html() {
  const w = S.watch, v = BY[w.id];
  const head = `<button class="icon-btn fx" data-act="watch-min" aria-label="Minimise">${ICON.down}</button>
    <div class="f-kind">${subjDot(v.subject)}${h(v.subject)}</div>
    <div class="w-title">${h(v.title)}</div>`;
  if (w.phase === 'ready') {
    return `<div class="focus watch">${head}
      <div class="breath"><div class="b-orb"></div><div class="b-txt" id="w-breath">Breathe in</div></div>
      <div class="w-ready">Starting in <b class="num" id="w-ready">${clock(readyLeft())}</b></div>
      <p class="f-hint">Open Marrow and find this video. The timer starts on its own.</p>
      <div class="f-actions">
        <a class="btn" href="${h(S.settings.marrowUrl || 'https://www.marrow.com/')}" target="_blank" rel="noopener">${ICON.share}Open Marrow</a>
        <button class="btn primary" data-act="watch-go">Start now</button>
      </div>
      <button class="btn ghost danger" data-act="watch-cancel">Cancel</button></div>`;
  }
  const e = elapsed(), expect = v.mins / S.settings.speed * 60;
  return `<div class="focus watch">${head}
    <div class="ring"><svg viewBox="0 0 116 116"><circle class="track" cx="58" cy="58" r="48"/>
      <circle id="w-bar" class="bar" cx="58" cy="58" r="48" stroke-dasharray="${2 * Math.PI * 48}" stroke-dashoffset="${2 * Math.PI * 48 * (1 - Math.min(1, e / expect))}"/></svg>
      <div class="label"><div class="big num" id="w-clock">${clock(e)}</div><div class="of">of ~${mins(expect / 60)} at ${sp(S.settings.speed)}</div></div></div>
    <div class="w-meta num">${mins(v.mins)} runtime${w.running ? '' : ' · paused'}</div>
    <div class="f-actions">
      <button class="btn" data-act="watch-toggle">${w.running ? 'Pause' : 'Resume'}</button>
      <button class="btn primary" data-act="watch-done">Done · mark watched</button>
    </div>
    <button class="btn ghost danger" data-act="watch-cancel">Cancel</button></div>`;
}

function tick() {
  const w = S.watch; if (!w) return;
  if (w.phase === 'ready') {
    const left = readyLeft();
    const r = document.getElementById('w-ready'); if (r) r.textContent = clock(left);
    const b = document.getElementById('w-breath'); if (b) b.textContent = Math.floor(now() / 4000) % 2 ? 'Breathe out' : 'Breathe in';
    if (left <= 0) { start(); render(); }
    return;
  }
  const e = elapsed(), expect = BY[w.id].mins / S.settings.speed * 60;
  const c = document.getElementById('w-clock'); if (c) c.textContent = clock(e);
  const bar = document.getElementById('w-bar'); if (bar) bar.style.strokeDashoffset = 2 * Math.PI * 48 * (1 - Math.min(1, e / expect));
  const pill = document.getElementById('watch-pill-time'); if (pill) pill.textContent = w.phase === 'ready' ? '' : clock(e);
}
function start() { Object.assign(S.watch, { phase: 'run', startedAt: now(), elapsed: 0, running: true }); save(); }
function render() { if (S.ui.watchOpen && S.watch) { el().innerHTML = html(); document.body.classList.add('locked'); } }
function close() { S.ui.watchOpen = false; el().innerHTML = ''; document.body.classList.remove('locked'); }
export const renderWatch = render;
clearInterval(ticker); ticker = setInterval(tick, 500);

export function watchPill() {
  const w = S.watch; if (!w) return '';
  return `<button class="focus-pill" data-act="watch-open"><span class="pulse"></span><span class="grow">${w.phase === 'ready' ? 'Getting ready: ' : 'Watching: '}${h(BY[w.id].title)}${w.running === false ? ' (paused)' : ''}</span><span class="num" id="watch-pill-time">${w.phase === 'run' ? clock(elapsed()) : ''}</span></button>`;
}

export const actions = {
  'study-now': el => {
    if (S.watch && S.watch.id !== el.dataset.id && !confirm(`Stop timing “${BY[S.watch.id].title}” and start this one?`)) return;
    S.watch = { id: el.dataset.id, phase: 'ready', readyEnds: now() + (S.settings.breath ?? 120) * 1000, d: today() };
    if (!(S.settings.breath ?? 120)) start();
    S.ui.watchOpen = true; save(); closeSheet();
  },
  'watch-open': () => { S.ui.watchOpen = true; },
  'watch-min': () => close(),
  'watch-go': () => start(),
  'watch-toggle': () => { const w = S.watch; if (w.running) { w.elapsed = elapsed(); w.running = false; } else { w.startedAt = now(); w.running = true; } save(); },
  'watch-cancel': () => { if (S.watch.phase === 'run' && elapsed() > 60 && !confirm('Stop without marking it watched?')) return; S.watch = null; save(); close(); },
  'watch-done': () => {
    const w = S.watch, v = BY[w.id], m = Math.max(1, Math.round(elapsed() / 60));
    // The speed you effectively watched at: runtime over real time, kept to 1×–3×.
    const s = Math.min(3, Math.max(1, Math.round((v.mins / m) * 4) / 4));
    (S.progress[v.id] ||= {}).fr = { d: w.d || today(), t: new Date().toISOString(), s, m };
    S.watch = null; save(); close();
    setTimeout(confetti, 100);
    toast(`Watched: ${v.title} in ${mins(m)}`, () => { delete S.progress[v.id].fr; if (!Object.keys(S.progress[v.id]).length) delete S.progress[v.id]; save(); });
  },
};
