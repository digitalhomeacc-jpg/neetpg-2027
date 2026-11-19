// A short welcome each time the app starts (or comes back after a long break): a greeting,
// the day ahead and the quote of the day. Tap anywhere to begin on Today.
import { S, metrics, today, dayDiff, h, mins, plural, fmtDayLong } from '../core.js';
import { QUOTES, quoteIndex } from '../quotes.js';

let open = false, hiddenAt = 0;
const root = () => document.getElementById('hello-root');

function greeting() {
  const hr = new Date().getHours();
  return hr < 4 ? 'Still up' : hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : hr < 22 ? 'Good evening' : 'Late night';
}

function body() {
  const m = metrics(), st = S.settings, t = today();
  const name = (st.name || '').trim();
  const toExam = dayDiff(t, st.exam);
  const q = QUOTES[quoteIndex(S.ui)];
  const doneToday = m.frRealToday >= m.target - 0.5 && m.target > 0;
  return `<div class="pgw-card">
    <div class="pgw-date">${fmtDayLong(t)}</div>
    <h1 class="pgw-hi">${greeting()}${name ? `,<br><span>${h(name)}</span>` : ''}</h1>
    <div class="pgw-count"><b class="num">${toExam}</b><span>${toExam === 1 ? 'day' : 'days'} to NEET PG</span></div>
    <ul class="pgw-today">
      <li><span class="hi-ic">🎯</span><span>${m.restToday ? 'Rest day today. Revisions only if you feel like it.' : doneToday ? '<b>Today’s target is done.</b> Anything more is a head start.' : `<b>${mins(Math.max(0, m.target - m.frRealToday))}</b> of new videos today`}</span></li>
      <li><span class="hi-ic">🧠</span><span>${m.due.length ? `<b>${plural(m.due.length, 'revision')}</b> due` : 'No revisions due'}</span></li>
      ${m.streak > 1 ? `<li><span class="hi-ic">🔥</span><span><b>${m.streak}-day</b> streak. Keep it going.</span></li>` : ''}
    </ul>
    <blockquote class="pgw-q">“${h(q.q)}”<cite>${h(q.who)}</cite></blockquote>
    <button class="btn primary block pgw-go" data-hello="go">Let’s begin</button>
  </div>`;
}

export function showHello() {
  if (open || !S.onboarded || (navigator.webdriver && !window.PG27_HELLO)) return; // automated tests skip it
  open = true;
  const r = root();
  r.innerHTML = `<div class="pgw" role="dialog" aria-label="Welcome">${body()}</div>`;
  requestAnimationFrame(() => r.firstElementChild?.classList.add('in'));
}

export function closeHello() {
  if (!open) return;
  open = false;
  const el = root().firstElementChild;
  if (!el) return;
  el.classList.remove('in'); el.classList.add('out');
  setTimeout(() => { if (!open) root().innerHTML = ''; }, 420);
}

// Start fresh on Today, unless a study timer is running (then stay where the timer is).
export function startScreen() {
  if (S.watch || S.focus) return false;
  S.ui.tab = 'today';
  return true;
}

document.addEventListener('click', e => { if (open && e.target.closest('#hello-root')) { e.stopPropagation(); closeHello(); } }, true);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
  // Back after half an hour or more feels like a fresh start.
  if (hiddenAt && Date.now() - hiddenAt > 30 * 60 * 1000 && startScreen()) {
    document.dispatchEvent(new Event('pg27:render'));
    showHello();
  }
});
