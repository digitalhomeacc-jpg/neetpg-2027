// Change history, like Dukaan Khata's बदल इतिहास: every change, when, and before → after.
// Nothing has to remember to log itself: after each redraw we compare the saved state
// with the last snapshot and record what's different.
import { S, BY, PASSES, PLABEL, REASONS, TEST_TYPES, FOCUS_KINDS, testScore, uid, save, fmtDay, sp, h } from './core.js';

const MAX = 5000;
const reasonName = Object.fromEntries(REASONS);
const typeName = Object.fromEntries(TEST_TYPES);
const kindName = Object.fromEntries(FOCUS_KINDS);
const SETTING = { start: 'Started on', target: 'WOR deadline', exam: 'Exam date', rest: 'Rest days', speed: 'Usual speed', theme: 'Theme', questions: 'Questions per test' };
const BADGE = { first: 'First video', v50: '50 videos', subject: 'Subject done', wor: 'WOR complete', rev1: 'First revision', rev100: '100 revisions', s7: '7-day streak', s30: '30-day streak', h100: '100 hours', gt: 'First GT', zone: 'In the zone', fix10: '10 fixed' };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const passText = (v, x, k) => !x ? null
  : `${fmtDay(x.d)}${x.m != null ? ` · ${x.m} min` : ''}${x.s && k === 'fr' ? ` · ${sp(x.s)}` : ''}${x.q ? ` · recalled ${['', 'blank', 'some', 'most', 'all'][x.q]}` : ''}`;

// A flat, readable picture of everything worth tracking.
function snapshot() {
  const recs = {};
  for (const [id, p] of Object.entries(S.progress)) {
    const v = BY[id]; if (!v) continue;
    const f = {};
    for (const k of PASSES) if (p[k]) f[PLABEL[k]] = passText(v, p[k], k);
    recs[`video:${id}`] = { kind: 'video', title: v.title, sub: v.subject, f };
  }
  for (const [id, m] of Object.entries(S.runtimes || {})) {
    const v = BY[id]; if (!v) continue;
    const r = (recs[`video:${id}`] ||= { kind: 'video', title: v.title, sub: v.subject, f: {} });
    r.f.Runtime = `${m} min (sheet ${Math.round(v.sheetMins)})`;
  }
  for (const t of S.tests) {
    const sc = testScore(t);
    recs[`test:${t.id}`] = { kind: 'test', title: t.name, f: {
      Type: typeName[t.type], Date: fmtDay(t.date), Questions: String(t.n), Right: String(t.c), Wrong: String(t.w),
      Score: `${sc.score}/${sc.max}`, Rank: t.rank || null, Notes: t.notes || null } };
  }
  for (const x of S.mistakes) {
    recs[`mistake:${x.id}`] = { kind: 'mistake', title: x.note || (x.video ? BY[x.video]?.title : x.subject), f: {
      Note: x.note || null, Why: reasonName[x.reason], Subject: x.subject, Video: x.video ? BY[x.video]?.title : null,
      Status: x.done ? 'Revisited' : 'Open' } };
  }
  for (const x of S.sessions) {
    recs[`session:${x.id}`] = { kind: 'session', title: `${kindName[x.kind] || x.kind} session`, f: { Date: fmtDay(x.d), Minutes: String(x.m) } };
  }
  for (const [d, ids] of Object.entries(S.plan || {})) recs[`plan:${d}`] = { kind: 'plan', title: `Plan for ${fmtDay(d)}`, f: Object.fromEntries(ids.map((id, i) => [`${i + 1}.`, BY[id]?.title || id])) };
  const st = S.settings, f = {};
  for (const k of Object.keys(SETTING)) f[SETTING[k]] = k === 'rest' ? st.rest.slice().sort().map(i => DAYS[i]).join(', ') || 'None' : k === 'speed' ? sp(st.speed) : String(st[k]);
  recs.settings = { kind: 'settings', title: 'Settings', f };
  for (const id of Object.keys(S.goals)) recs[`goal:${id}`] = { kind: 'goal', title: goalLabel(id), f: { Status: 'Done' } };
  for (const [id, d] of Object.entries(S.badges)) recs[`badge:${id}`] = { kind: 'badge', title: BADGE[id] || id, f: { Unlocked: fmtDay(d) } };
  return recs;
}
let goalLabels = {};
export const setGoalLabels = m => { goalLabels = m; };
const goalLabel = id => goalLabels[id] || id;

let last = null;
export function startHistory() { S.history ||= []; last = snapshot(); }

export function recordChanges() {
  if (!last) return startHistory();
  const now = snapshot();
  const ev = [];
  const at = new Date().toISOString();
  for (const key of new Set([...Object.keys(last), ...Object.keys(now)])) {
    const a = last[key], b = now[key];
    if (JSON.stringify(a?.f) === JSON.stringify(b?.f)) continue;
    const r = b || a;
    let action = !a ? 'create' : !b ? 'delete' : 'edit';
    const before = a?.f || null, after = b?.f || null;
    // Videos: a pass added reads better as "done", a pass removed as "undone".
    if (r.kind === 'video' && a && b) {
      const ka = Object.keys(a.f).filter(k => a.f[k]), kb = Object.keys(b.f).filter(k => b.f[k]);
      if (kb.length > ka.length) action = 'done'; else if (kb.length < ka.length) action = 'undone';
    }
    if (r.kind === 'video' && !a) action = 'done';
    if (r.kind === 'video' && !b) action = 'undone';
    if (r.kind === 'goal') action = b ? 'done' : 'undone';
    if (r.kind === 'badge') { if (!b) continue; action = 'unlock'; }
    ev.push({ id: uid(), at, key, kind: r.kind, action, title: r.title, sub: r.sub || '', before, after });
  }
  last = now;
  if (!ev.length) return;
  // A reset or backup import changes everything at once: keep it as one line.
  if (ev.length > 30) {
    const count = k => ev.filter(e => e.kind === k).length;
    const bits = [['video', 'videos'], ['test', 'tests'], ['mistake', 'mistakes'], ['session', 'sessions']].map(([k, l]) => count(k) ? `${count(k)} ${l}` : '').filter(Boolean);
    S.history.unshift({ id: uid(), at, key: 'bulk', kind: 'other', action: 'bulk', title: 'Many changes at once', sub: bits.join(' · '), before: null, after: null, n: ev.length });
  } else {
    S.history.unshift(...ev.reverse());
  }
  if (S.history.length > MAX) S.history.length = MAX;
  save();
}

/* ---------- the screen ---------- */
const ACTION = {
  create: ['Added', 'good', '＋'], done: ['Done', 'good', '✓'], edit: ['Changed', 'warn', '✎'],
  delete: ['Deleted', 'bad', '✕'], undone: ['Undone', 'bad', '↺'], unlock: ['Unlocked', 'accent', '★'], bulk: ['Bulk change', 'warn', '⇅'],
};
const KIND = { plan: 'Day plan', video: 'Video', test: 'Test', mistake: 'Mistake', session: 'Focus session', settings: 'Settings', goal: 'Phase goal', badge: 'Achievement', other: 'Other' };
const FILTERS = [['all', 'All'], ['video', 'Videos'], ['test', 'Tests'], ['mistake', 'Mistakes'], ['other', 'Other']];
const pad = n => String(n).padStart(2, '0');
const stamp = iso => { const d = new Date(iso); return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
const dayHead = iso => { const d = new Date(iso); return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }); };

function table(e) {
  const keys = [...new Set([...Object.keys(e.before || {}), ...Object.keys(e.after || {})])];
  if (e.action === 'create' || (e.action === 'done' && !e.before)) {
    const rows = keys.filter(k => e.after[k]).map(k => `<tr><th>${h(k)}</th><td>${h(e.after[k])}</td></tr>`).join('');
    return rows ? `<table class="ht">${rows}</table>` : '';
  }
  if (e.action === 'delete' || (e.action === 'undone' && !e.after)) {
    const rows = keys.filter(k => e.before[k]).map(k => `<tr><th>${h(k)}</th><td class="gone">${h(e.before[k])}</td></tr>`).join('');
    return rows ? `<table class="ht">${rows}</table>` : '';
  }
  const changed = keys.filter(k => (e.before?.[k] ?? null) !== (e.after?.[k] ?? null));
  if (!changed.length) return '';
  return `<table class="ht diff"><tr><th></th><th class="cap">Before</th><th class="cap">After</th></tr>${changed.map(k =>
    `<tr><th>${h(k)}</th><td class="was">${h(e.before?.[k] ?? '–')}</td><td class="now">${h(e.after?.[k] ?? '–')}</td></tr>`).join('')}</table>`;
}

function card(e, single) {
  const [label, tone, icon] = ACTION[e.action] || ACTION.edit;
  const story = S.history.filter(x => x.key === e.key && x.at > e.at);
  const removedLater = e.action !== 'delete' && e.action !== 'undone' ? story.find(x => x.action === 'delete') : null;
  const editsLater = story.filter(x => x.action === 'edit' || x.action === 'undone' || x.action === 'done').length;
  const tap = !single && e.key !== 'bulk' ? `data-act="hist-open" data-v="${h(e.key)}"` : '';
  return `<li class="hcard ${tone}" ${tap}>
    <div class="hc-top"><span class="hc-act ${tone}"><b>${icon}</b>${label}</span><span class="hc-kind">${KIND[e.kind] || ''}</span><span class="hc-time num">${stamp(e.at)}</span></div>
    <div class="hc-title">${h(e.title)}</div>${e.sub ? `<div class="hc-sub">${h(e.sub)}</div>` : ''}
    ${table(e)}
    ${removedLater || editsLater ? `<div class="hc-badges">${removedLater ? `<span class="pill bad">Deleted later · ${stamp(removedLater.at)}</span>` : ''}${editsLater ? `<span class="pill warn">Changed ${editsLater}× later</span>` : ''}</div>` : ''}
  </li>`;
}

export function view() {
  const ui = S.ui, single = ui.histKey;
  let list = S.history || [];
  if (single) list = list.filter(e => e.key === single).slice().reverse();
  else {
    const f = ui.histFilter || 'all', q = (ui.histQ || '').trim().toLowerCase();
    list = list.filter(e => {
      const g = ['video', 'test', 'mistake'].includes(e.kind) ? e.kind : 'other';
      if (f !== 'all' && f !== g) return false;
      return !q || JSON.stringify([e.title, e.sub, e.before, e.after, e.action]).toLowerCase().includes(q);
    });
  }
  let body = '', lastDay = '';
  for (const e of list.slice(0, 400)) {
    const d = e.at.slice(0, 10);
    if (!single && d !== lastDay) { body += `<li class="hday">${dayHead(e.at)}</li>`; lastDay = d; }
    body += card(e, single);
  }
  const first = single && list[0];
  return {
    title: single ? 'History' : 'Change history',
    meta: single ? h(first?.title || '') : `${(S.history || []).length} changes`,
    html: `
  ${single ? '' : `<div class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>
    <input id="hist-q" type="search" placeholder="Search changes" value="${h(ui.histQ || '')}" autocomplete="off"></div>
  <div class="chips" style="margin:8px 0 4px">${FILTERS.map(([k, l]) => `<button class="chip" data-act="hist-filter" data-v="${k}" aria-pressed="${(ui.histFilter || 'all') === k}">${l}</button>`).join('')}</div>`}
  ${single && first?.key.startsWith('video:') ? `<button class="btn block" style="margin:6px 0" data-act="open-video" data-id="${first.key.slice(6)}">Open this video</button>` : ''}
  <div id="hist-list">${list.length ? `<ul class="list hlist">${body}</ul>${list.length > 400 ? `<p class="small faint center">Showing the latest 400 of ${list.length}. Search to find older ones.</p>` : ''}`
    : `<section class="card empty"><div class="ei">🕘</div><div class="e1">${single ? 'No history yet' : 'Nothing here yet'}</div>Every change you make, big or small, shows up here with the exact time and what it was before.</section>`}</div>`,
  };
}

export const actions = {
  'history': () => { S.ui.histBack = S.ui.tab; S.ui.tab = 'history'; S.ui.histKey = null; return 'enter'; },
  'hist-open': el => { S.ui.histKey = el.dataset.v; S.ui.histFromList = S.ui.tab === 'history'; if (S.ui.tab !== 'history') S.ui.histBack = S.ui.tab; S.ui.tab = 'history'; return 'enter'; },
  'hist-filter': el => { S.ui.histFilter = el.dataset.v; },
};
