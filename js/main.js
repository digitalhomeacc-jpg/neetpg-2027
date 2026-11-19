import { S, save, today, metrics, achievements, h } from './core.js';
import { closeSheet, openSheet, renderSheet, sheetOpen, copy, toast, confetti, runToastUndo, ICON } from './ui.js';
import * as todayV from './views/today.js';
import * as planV from './views/plan.js';
import * as videosV from './views/videos.js';
import * as testsV from './views/tests.js';
import * as progressV from './views/progress.js';
import * as settingsV from './views/settings.js';
import * as videoS from './views/video.js';
import * as reviseS from './views/revise.js';
import * as focusS from './views/focus.js';
import * as plannerS from './views/planner.js';
import * as welcomeV from './views/welcome.js';
import * as timesV from './views/times.js';
import * as watchS from './views/watch.js';
import * as healthS from './views/health.js';
import * as pinsV from './views/pins.js';
import * as weekS from './views/week.js';
import * as reportV from './views/report.js';
import * as extrasV from './views/extras.js';
import * as revisionsV from './views/revisions.js';
import * as backlogV from './views/backlog.js';
import * as ankiV from './views/anki.js';
import * as ankiLibV from './views/ankilib.js';
import { writeSummary } from './notify.js';
import { startSync } from './sync.js';
import * as historyV from './history.js';
import { phases } from './core.js';

const VIEWS = { today: todayV, plan: planV, videos: videosV, tests: testsV, progress: progressV, settings: settingsV, history: historyV, times: timesV, pins: pinsV, report: reportV, pairs: { view: extrasV.pairsView }, revisions: revisionsV, backlog: backlogV, anki: ankiV, ankilib: ankiLibV };
const MODULES = [todayV, planV, videosV, testsV, progressV, settingsV, videoS, reviseS, focusS, historyV, plannerS, welcomeV, timesV, watchS, healthS, pinsV, weekS, reportV, extrasV, revisionsV, backlogV, ankiV, ankiLibV];

function quickActions() {
  return `<h3>Quick add</h3><div class="sub">Log what you just did.</div>
    <ul class="list">
      <li class="item"><span class="rbadge" style="--h:160">${ICON.timer}</span><button class="open" data-act="qa-focus"><div class="t">Start a focus session</div><div class="s">Time Anki, Q-bank, PYQs or notes</div></button></li>
      <li class="item"><span class="rbadge" style="--h:215">${ICON.test}</span><button class="open" data-act="qa-test"><div class="t">Log a test</div><div class="s">Grand test, subject test or PYQ set</div></button></li>
      <li class="item"><span class="rbadge" style="--h:0">${ICON.bug}</span><button class="open" data-act="qa-mistake"><div class="t">Log a mistake</div><div class="s">Pulls that video's next revision forward</div></button></li>
      <li class="item"><span class="rbadge" style="--h:45">📌</span><button class="open" data-act="qa-pins"><div class="t">High-yield sheet</div><div class="s">Facts you've pinned, by subject</div></button></li>
      <li class="item"><span class="rbadge" style="--h:160">🔁</span><button class="open" data-act="revisions" data-v="r1"><div class="t">Revisions</div><div class="s">R1–R5 with dates, limits and time taken</div></button></li>
      <li class="item"><span class="rbadge" style="--h:10">⚠️</span><button class="open" data-act="backlog"><div class="t">Backlogs and self-improvement</div><div class="s">What skipping costs, and how to get back</div></button></li>
      <li class="item"><span class="rbadge" style="--h:200">🗂️</span><button class="open" data-act="qa-anki"><div class="t">Anki tags</div><div class="s">Tags and cards hit, video by video</div></button></li>
      <li class="item"><span class="rbadge" style="--h:300">🔀</span><button class="open" data-act="pairs"><div class="t">Lookalikes</div><div class="s">Things you mix up, side by side</div></button></li>
      <li class="item"><span class="rbadge" style="--h:250">📊</span><button class="open" data-act="qa-report"><div class="t">Weekly report</div><div class="s">Your week, three questions, a card to share</div></button></li>
      <li class="item"><span class="rbadge" style="--h:30">🕘</span><button class="open" data-act="qa-history"><div class="t">Change history</div><div class="s">Every change, with what it was before</div></button></li>
      <li class="item"><span class="rbadge" style="--h:275">${ICON.search}</span><button class="open" data-act="qa-search"><div class="t">Find a video</div><div class="s">Search titles, topics and tags</div></button></li>
    </ul>`;
}

const ACTIONS = Object.assign({
  tab: el => { const changed = S.ui.tab !== el.dataset.v; S.ui.tab = el.dataset.v; closeSheet(); return changed ? 'enter' : 'top'; },
  close: () => closeSheet(),
  copy: el => copy(el.dataset.q),
  settings: () => { S.ui.back = S.ui.tab; S.ui.tab = 'settings'; return 'enter'; },
  back: () => {
    if (S.ui.tab === 'times') { S.ui.tab = S.ui.timesBack || 'progress'; return 'enter'; }
    if (S.ui.tab === 'pins') { S.ui.tab = S.ui.pinsBack || 'videos'; return 'enter'; }
    if (S.ui.tab === 'revisions') { S.ui.tab = S.ui.revBack || 'today'; return 'enter'; }
    if (S.ui.tab === 'ankilib') { S.ui.tab = S.ui.libBack || 'anki'; return 'enter'; }
    if (S.ui.tab === 'anki') { S.ui.tab = S.ui.ankiBack || 'progress'; return 'enter'; }
    if (S.ui.tab === 'backlog') { S.ui.tab = S.ui.backlogBack || 'today'; return 'enter'; }
    if (S.ui.tab === 'report') { S.ui.tab = S.ui.reportBack || 'progress'; return 'enter'; }
    if (S.ui.tab === 'pairs') { S.ui.tab = S.ui.pairsBack || 'tests'; return 'enter'; }
    if (S.ui.tab === 'history') {
      if (S.ui.histKey && S.ui.histFromList) { S.ui.histKey = null; return 'enter'; }
      S.ui.histKey = null; S.ui.tab = S.ui.histBack || 'settings'; return 'enter';
    }
    S.ui.tab = S.ui.back && S.ui.back !== 'settings' ? S.ui.back : 'today'; return 'enter';
  },
  'toast-undo': () => runToastUndo(),
  quick: () => openSheet(quickActions),
  'qa-focus': () => { closeSheet(); focusS.openFocus(); },
  'qa-test': el => testsV.actions['new-test'](el),
  'qa-mistake': el => testsV.actions['new-mistake'](el),
  'qa-report': () => { closeSheet(); return reportV.actions.report(); },
  'qa-anki': () => { closeSheet(); return ankiV.actions.anki(); },
  'qa-pins': () => { closeSheet(); return pinsV.actions.pins(); },
  'qa-history': () => { closeSheet(); return historyV.actions.history(); },
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
  document.getElementById('nav-btns').innerHTML = ['settings', 'history', 'times', 'pins', 'report', 'pairs', 'revisions', 'backlog', 'anki', 'ankilib'].includes(tab)
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
  watchS.renderWatch();
  welcomeV.renderWelcome();
  checkBadges(m);
  historyV.recordChanges(); // compare with the last snapshot and log what changed
  writeSummary(); // keeps the next reminder current
}

const keyOf = el => `${el.dataset.act}|${el.dataset.id || ''}|${el.dataset.v || ''}|${el.dataset.k || ''}`;
const sigOf = el => `${el.className}|${el.getAttribute('aria-pressed') || ''}|${el.getAttribute('aria-current') || ''}`;
function stateOf() {
  const m = new Map();
  for (const el of document.querySelectorAll('#view [data-act], #sheet-root [data-act], #tabs [data-act]')) m.set(keyOf(el), sigOf(el));
  return m;
}
function animateChanges(before) {
  for (const el of document.querySelectorAll('#view [data-act], #sheet-root [data-act], #tabs [data-act]')) {
    const was = before.get(keyOf(el));
    if (was !== undefined && was !== sigOf(el)) {
      el.classList.add('changed');
      const row = el.closest('.item'); if (row) row.classList.add('row-changed');
    }
  }
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACTIONS[el.dataset.act];
  if (!fn) return;
  const r = fn(el, e);
  save();
  // Redraws replace the markup, so CSS transitions can't run on their own. Note each control's
  // state first, then animate the ones that changed (a tick, a chip, a tab), so taps feel smooth.
  const before = r === 'enter' ? null : stateOf();
  render({ top: r === 'top', enter: r === 'enter' });
  if (before) animateChanges(before);
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
  // Searches redraw only their results, so the keyboard stays open while typing.
  if (e.target.id === 'q') {
    S.ui.q = e.target.value;
    clearTimeout(qTimer);
    qTimer = setTimeout(() => { save(); const r = document.getElementById('lib-results'); if (r) r.innerHTML = videosV.results(); }, 140);
    return;
  }
  if (e.target.id === 'hist-q') {
    S.ui.histQ = e.target.value;
    clearTimeout(qTimer);
    qTimer = setTimeout(() => {
      save();
      const html = historyV.view().html, box = document.getElementById('hist-list');
      if (box) box.innerHTML = new DOMParser().parseFromString(html, 'text/html').getElementById('hist-list').innerHTML;
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

// App-like touch: no pinch zoom. (Double-tap zoom is off via touch-action in the CSS,
// which doesn't swallow quick taps the way a touchend hack would.)
document.addEventListener('gesturestart', e => e.preventDefault());

document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheetOpen()) { closeSheet(); render(); } });
document.addEventListener('pg27:render', () => render());

// Redraw when the app comes back, so "today" rolls over after midnight.
let lastDay = today();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { if (today() !== lastDay) lastDay = today(); render(); }
});

if (S.ui.focusOpen) S.ui.focusOpen = false;
if (S.ui.watchOpen && !S.watch) S.ui.watchOpen = false;
historyV.setGoalLabels(Object.fromEntries(phases().flatMap(p => p.goals)));
healthS.ingestFromUrl();
historyV.startHistory();
render({ top: true, enter: true });
startSync();
document.addEventListener('pg27:sync', () => { if (S.ui.tab === 'settings') render(); });

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  // When a new version takes over, reload once so the whole app is the new version.
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !reloaded) { reloaded = true; location.reload(); }
  });
  navigator.serviceWorker.register('sw.js').then(r => r.update()).catch(() => {});
}
