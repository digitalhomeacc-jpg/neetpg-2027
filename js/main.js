import { S, save, today, metrics, achievements, h } from './core.js';
import { closeSheet, openSheet, renderSheet, sheetOpen, copy, toast, confetti, ICON } from './ui.js';
import * as todayV from './views/today.js';
import * as planV from './views/plan.js';
import * as videosV from './views/videos.js';
import * as testsV from './views/tests.js';
import * as progressV from './views/progress.js';
import * as settingsV from './views/settings.js';
import * as videoS from './views/video.js';
import * as reviseS from './views/revise.js';
import * as focusS from './views/focus.js';
import { writeSummary } from './notify.js';

const VIEWS = { today: todayV, plan: planV, videos: videosV, tests: testsV, progress: progressV, settings: settingsV };
const MODULES = [todayV, planV, videosV, testsV, progressV, settingsV, videoS, reviseS, focusS];

function quickActions() {
  return `<h3>Quick add</h3><div class="sub">Log what you just did.</div>
    <ul class="list">
      <li class="item"><span class="rbadge" style="--h:160">${ICON.timer}</span><button class="open" data-act="qa-focus"><div class="t">Start a focus session</div><div class="s">Time Anki, Q-bank, PYQs or notes</div></button></li>
      <li class="item"><span class="rbadge" style="--h:215">${ICON.test}</span><button class="open" data-act="qa-test"><div class="t">Log a test</div><div class="s">Grand test, subject test or PYQ set</div></button></li>
      <li class="item"><span class="rbadge" style="--h:0">${ICON.bug}</span><button class="open" data-act="qa-mistake"><div class="t">Log a mistake</div><div class="s">Pulls that video's next revision forward</div></button></li>
      <li class="item"><span class="rbadge" style="--h:275">${ICON.search}</span><button class="open" data-act="qa-search"><div class="t">Find a video</div><div class="s">Search titles, topics and tags</div></button></li>
    </ul>`;
}

const ACTIONS = Object.assign({
  tab: el => { const changed = S.ui.tab !== el.dataset.v; S.ui.tab = el.dataset.v; closeSheet(); return changed ? 'enter' : 'top'; },
  close: () => closeSheet(),
  copy: el => copy(el.dataset.q),
  settings: () => { S.ui.back = S.ui.tab; S.ui.tab = 'settings'; return 'enter'; },
  back: () => { S.ui.tab = S.ui.back && S.ui.back !== 'settings' ? S.ui.back : 'today'; return 'enter'; },
  quick: () => openSheet(quickActions),
  'qa-focus': () => { closeSheet(); focusS.openFocus(); },
  'qa-test': el => testsV.actions['new-test'](el),
  'qa-mistake': el => testsV.actions['new-mistake'](el),
  'qa-search': () => { closeSheet(); S.ui.tab = 'videos'; S.ui.subject = null; return () => document.getElementById('q')?.focus(); },
}, ...MODULES.map(m => m.actions || {}));

function applyTheme() {
  const t = S.settings.theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

function checkBadges(m) {
  const fresh = achievements(m).filter(a => a.got && !S.badges[a.id]);
  if (!fresh.length) return;
  const first = !Object.keys(S.badges).length;
  for (const a of fresh) S.badges[a.id] = today();
  save();
  // Don't celebrate everything at once on the very first launch.
  if (first && fresh.length > 1) return;
  setTimeout(() => { confetti(); toast(`${fresh[0].icon} Unlocked: ${fresh[0].name}`); }, 250);
}

function render({ top = false, enter = false } = {}) {
  applyTheme();
  const y = window.scrollY;
  const tab = VIEWS[S.ui.tab] ? S.ui.tab : 'today';
  const { title, meta, html } = VIEWS[tab].view();
  document.getElementById('nav-title').textContent = title;
  document.getElementById('nav-btns').innerHTML = tab === 'settings'
    ? `<button class="icon-btn" data-act="back" aria-label="Back">${ICON.back}</button>`
    : `<button class="icon-btn" data-act="settings" aria-label="Settings">${ICON.gear}</button>
       <button class="icon-btn accent" data-act="quick" aria-label="Quick add">${ICON.plus}</button>`;
  const view = document.getElementById('view');
  view.innerHTML = `<div class="large-title">${meta ? `<div class="eyebrow">${meta}</div>` : ''}<h1>${h(title)}</h1></div>${html}`;
  if (enter) { view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter'); }
  const m = metrics();
  document.querySelectorAll('#tabs button').forEach(b => {
    b.setAttribute('aria-current', b.dataset.v === tab ? 'page' : 'false');
    b.querySelector('.badge-n')?.remove();
    if (b.dataset.v === 'today' && m.due.length) b.insertAdjacentHTML('beforeend', `<span class="badge-n">${m.due.length > 99 ? '99+' : m.due.length}</span>`);
  });
  window.scrollTo(0, top || enter ? 0 : y);
  onScroll();
  if (sheetOpen()) renderSheet();
  focusS.renderFocus();
  checkBadges(m);
  writeSummary(); // keeps the next reminder current
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACTIONS[el.dataset.act];
  if (!fn) return;
  const r = fn(el, e);
  save();
  render({ top: r === 'top', enter: r === 'enter' });
  if (typeof r === 'function') r();
});

document.addEventListener('change', e => {
  for (const m of MODULES) {
    const r = m.onChange?.(e);
    if (r === 'sheet') { renderSheet(); return; }
    if (r) { render(); return; }
  }
  if (e.target.id === 'whatif') render();
});

let qTimer;
document.addEventListener('input', e => {
  if (e.target.id === 'q') {
    S.ui.q = e.target.value;
    clearTimeout(qTimer);
    qTimer = setTimeout(() => {
      save(); render();
      const q = document.getElementById('q');
      if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
    }, 160);
    return;
  }
  if (e.target.id === 'whatif') {
    // Update the number while dragging; the plan redraws when you let go.
    S.ui.whatif = +e.target.value; save();
    const v = document.querySelector('.whatif-v'); if (v) v.textContent = `${e.target.value}h`;
    return;
  }
  for (const m of MODULES) if (m.onInput?.(e)) return;
});

// Large title collapses into the bar as you scroll.
function onScroll() { document.body.classList.toggle('scrolled', window.scrollY > 38); }
window.addEventListener('scroll', onScroll, { passive: true });

// App-like touch: no pinch zoom, no double-tap zoom.
document.addEventListener('gesturestart', e => e.preventDefault());
let lastTouch = 0;
document.addEventListener('touchend', e => {
  const now = Date.now();
  if (now - lastTouch < 320 && !e.target.closest('input, textarea, select')) e.preventDefault();
  lastTouch = now;
}, { passive: false });

document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheetOpen()) { closeSheet(); render(); } });
document.addEventListener('pg27:render', () => render());

// Redraw when the app comes back, so "today" rolls over after midnight.
let lastDay = today();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { if (today() !== lastDay) lastDay = today(); render(); }
});

if (S.ui.focusOpen) S.ui.focusOpen = false;
render({ top: true, enter: true });

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
