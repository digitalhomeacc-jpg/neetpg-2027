import { S, save, today } from './core.js';
import { closeSheet, renderSheet, sheetOpen, copy, ICON } from './ui.js';
import * as todayV from './views/today.js';
import * as planV from './views/plan.js';
import * as videosV from './views/videos.js';
import * as testsV from './views/tests.js';
import * as progressV from './views/progress.js';
import * as settingsV from './views/settings.js';
import * as videoS from './views/video.js';
import * as reviseS from './views/revise.js';
import { writeSummary } from './notify.js';

const VIEWS = { today: todayV, plan: planV, videos: videosV, tests: testsV, progress: progressV, settings: settingsV };
const MODULES = [todayV, planV, videosV, testsV, progressV, settingsV, videoS, reviseS];
const ACTIONS = Object.assign({
  tab: el => { S.ui.tab = el.dataset.v; closeSheet(); return 'top'; },
  close: () => closeSheet(),
  copy: el => copy(el.dataset.q),
  settings: () => { S.ui.back = S.ui.tab; S.ui.tab = 'settings'; return 'top'; },
  back: () => { S.ui.tab = S.ui.back && S.ui.back !== 'settings' ? S.ui.back : 'today'; return 'top'; },
}, ...MODULES.map(m => m.actions || {}));

function applyTheme() {
  const t = S.settings.theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

function render({ top = false } = {}) {
  applyTheme();
  const y = window.scrollY;
  const tab = VIEWS[S.ui.tab] ? S.ui.tab : 'today';
  const { title, meta, html } = VIEWS[tab].view();
  document.getElementById('title').textContent = title;
  document.getElementById('top-meta').innerHTML = meta || '';
  document.getElementById('top-btn').innerHTML = tab === 'settings'
    ? `<button class="icon-btn" data-act="back" aria-label="Back">${ICON.back}</button>`
    : `<button class="icon-btn" data-act="settings" aria-label="Settings">${ICON.gear}</button>`;
  document.getElementById('view').innerHTML = html;
  document.querySelectorAll('#tabs button').forEach(b => b.setAttribute('aria-current', b.dataset.v === tab ? 'page' : 'false'));
  window.scrollTo(0, top ? 0 : y);
  if (sheetOpen()) renderSheet();
  writeSummary(); // keeps tomorrow morning's reminder current
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACTIONS[el.dataset.act];
  if (!fn) return;
  const r = fn(el, e);
  save();
  render({ top: r === 'top' });
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
    // Update the number while dragging; the full plan redraws when you let go.
    S.ui.whatif = +e.target.value; save();
    const v = document.querySelector('.whatif-v'); if (v) v.textContent = `${e.target.value}h`;
    return;
  }
  for (const m of MODULES) if (m.onInput?.(e)) return;
});

document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheetOpen()) closeSheet(); });
document.addEventListener('pg27:render', () => render());

// Redraw when the app comes back, so "today" rolls over after midnight.
let lastDay = today();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && today() !== lastDay) { lastDay = today(); render(); }
});

render({ top: true });

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
