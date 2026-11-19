import {
  S, VIDS, BY, SUBJECTS, save, today, uid, testScore, TARGET_PCT, REASONS, TEST_TYPES,
  h, pct, fmtDay, fmtDayYear, subjDot, plural,
} from '../core.js';
import { openSheet, closeSheet, toast, seg, sectionH, CHECK, ICON } from '../ui.js';

const typeName = Object.fromEntries(TEST_TYPES);
const reasonName = Object.fromEntries(REASONS);
const sorted = () => [...S.tests].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

function trend(tests) {
  const pts = [...tests].reverse().slice(-20);
  if (pts.length < 2) return '';
  const W = 360, H = 150, L = 30, R = 8, T = 10, B = 20;
  const vals = pts.map(t => testScore(t).frac * 100);
  const lo = Math.max(0, Math.floor(Math.min(...vals, TARGET_PCT * 100) / 10) * 10 - 10), hi = 100;
  const x = i => L + (i / (pts.length - 1)) * (W - L - R);
  const y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const grid = [lo, (lo + hi) / 2, hi].map(v => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${Math.round(v)}</text>`).join('');
  const tgt = TARGET_PCT * 100;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Test scores over time">
    ${grid}<line class="target" x1="${L}" x2="${W - R}" y1="${y(tgt)}" y2="${y(tgt)}"/>
    <polyline class="actual" points="${vals.map((v, i) => `${x(i)},${y(v)}`).join(' ')}"/>
    ${vals.map((v, i) => `<circle class="pt${v >= tgt ? ' hit' : ''}" cx="${x(i)}" cy="${y(v)}" r="3.5"/>`).join('')}
  </svg>
  <div class="legend"><span><i></i>Score, % of max</span><span><i class="target"></i>Rank &lt;1,500 zone (~${pct(TARGET_PCT)})</span></div>`;
}

// Where the marks go, how guessing pays, and timing, from the tests that have the data.
function insights(tests) {
  let out = '';
  const withSubj = tests.filter(t => t.subj && Object.keys(t.subj).length).slice(0, 5);
  if (withSubj.length) {
    const agg = {};
    for (const t of withSubj) for (const [sj, [c, w]] of Object.entries(t.subj)) { const a = (agg[sj] ||= { c: 0, w: 0 }); a.c += c; a.w += w; }
    // Each wrong answer costs 5: the 4 you'd have got, plus the 1 taken away.
    const rows = Object.entries(agg).map(([sj, a]) => ({ sj, lost: a.w * 5, acc: a.c + a.w ? a.c / (a.c + a.w) : 0 })).sort((a, b) => b.lost - a.lost);
    const max = Math.max(1, ...rows.map(r => r.lost));
    out += `${sectionH('Where your marks go', `last ${withSubj.length} test${withSubj.length > 1 ? 's' : ''} with a breakdown`)}
    <section class="card">${rows.slice(0, 8).map(r => `<div class="hbar wide"><span class="hl">${subjDot(r.sj)}${h(r.sj)}</span><span class="hb"><i style="width:${(r.lost / max) * 100}%"></i></span><span class="hn num">−${r.lost}</span><span class="ha num">${pct(r.acc)}</span></div>`).join('')}
      <p class="hint">Marks lost to wrong answers (5 each: the 4 you'd have got plus the 1 deducted), and accuracy. Fix the top two first.</p></section>`;
  }
  const g = tests.filter(t => t.g > 0 && t.gr != null);
  const timed = tests.filter(t => t.time > 0);
  if (g.length || timed.length) {
    const G = g.reduce((a, t) => a + t.g, 0), R = g.reduce((a, t) => a + t.gr, 0), net = 4 * R - (G - R);
    const spq = timed.length ? timed.reduce((a, t) => a + t.time * 60 / t.n, 0) / timed.length : 0;
    out += `<section class="card"><div class="stats" style="margin:0">
      ${g.length ? `<div class="stat ${net >= 0 ? 'good' : 'bad'}"><div class="v num">${net >= 0 ? '+' : ''}${net}</div><div class="k">marks from guessing (${pct(R / G)} right)</div></div>` : ''}
      ${timed.length ? `<div class="stat ${spq > 63 ? 'warn' : ''}"><div class="v num">${Math.round(spq)}s</div><div class="k">per question (paper allows ~63s)</div></div>` : ''}
    </div>${g.length ? `<p class="hint">With +4/−1, a guess pays off on average once you can rule out ${net >= 0 ? 'one option, which you seem to be doing' : 'at least one option. Yours are costing marks, so guess only after eliminating two'}.</p>` : ''}</section>`;
  }
  return out;
}

export function view() {
  const tests = sorted();
  const open = S.mistakes.filter(x => !x.done);
  const recent = tests.slice(0, 3).map(t => testScore(t).frac);
  const avg3 = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : null;
  const best = tests.length ? Math.max(...tests.map(t => testScore(t).frac)) : null;
  const gts = tests.filter(t => t.type === 'gt').length;

  const byReason = REASONS.map(([k, l]) => [l, S.mistakes.filter(x => x.reason === k).length]);
  const bySubject = SUBJECTS.map(s => [s, open.filter(x => x.subject === s).length]).filter(([, n]) => n).sort((a, b) => b[1] - a[1]);
  const maxR = Math.max(1, ...byReason.map(([, n]) => n));

  const testRows = tests.map(t => {
    const sc = testScore(t), hit = sc.frac >= TARGET_PCT;
    return `<li class="item"><button class="open" data-act="edit-test" data-id="${t.id}">
      <div class="t">${h(t.name)}</div><div class="s num">${typeName[t.type]} · ${fmtDay(t.date)} · ${t.c} right, ${t.w} wrong, ${sc.skipped} skipped${t.rank ? ` · AIR ${h(t.rank)}` : ''}${t.time ? ` · ${Math.round(t.time * 60 / t.n)} s/question` : ''}</div></button>
      <div class="end"><div class="score num">${sc.score}<span class="faint">/${sc.max}</span></div><span class="pill ${hit ? 'good' : sc.frac >= TARGET_PCT - 0.1 ? 'warn' : ''}">${pct(sc.frac)}</span></div></li>`;
  }).join('');

  const mistakeRows = open.map(x => `<li class="item">
    <button class="check" data-act="mistake-done" data-id="${x.id}" aria-label="Mark revisited">${CHECK}</button>
    <button class="open" data-act="edit-mistake" data-id="${x.id}">
      <div class="t">${h(x.note || (x.video ? BY[x.video]?.title : 'No note'))}</div>
      <div class="s">${subjDot(x.subject)}${h(x.subject)}${x.video ? ` · ${h(BY[x.video]?.title)}` : ''} · ${fmtDay(x.date)}</div></button>
    <div class="end"><span class="pill">${reasonName[x.reason]}</span></div></li>`).join('');

  return {
    title: 'Tests',
    meta: tests.length ? `${plural(tests.length, 'test')} · ${plural(gts, 'GT')}` : '',
    html: `
  <section class="card">
    <div class="stats" style="margin:0">
      <div class="stat ${avg3 != null && avg3 >= TARGET_PCT ? 'good' : ''}"><div class="v num">${avg3 != null ? pct(avg3) : '—'}</div><div class="k">last 3 average</div></div>
      <div class="stat"><div class="v num">${best != null ? pct(best) : '—'}</div><div class="k">best</div></div>
      <div class="stat"><div class="v num">${pct(TARGET_PCT)}</div><div class="k">rank &lt;1,500 zone</div></div>
    </div>
    ${tests.length >= 2 ? `<div class="spacer"></div>${trend(tests)}` : ''}
    <div class="spacer"></div>
    <button class="btn primary block" data-act="new-test">${ICON.plus}Log a test</button>
    <p class="small faint" style="margin:10px 0 0">Zone = about 620/800, which was roughly rank 1,500 in 2025 (third-party estimates, not official). It's an unofficial yardstick, not a rank prediction.</p>
  </section>

  ${insights(tests)}
  ${tests.length ? `${sectionH('All tests')}<ul class="card flush list">${testRows}</ul>` : `
  <section class="card empty"><div class="e1">No tests yet</div>Log grand tests, subject tests or previous-year question sets after you take them. Score, accuracy and trend appear here.</section>`}

  ${sectionH('Mistakes diary', `<button class="link" data-act="new-mistake">+ Add</button>`)}
  ${S.mistakes.length ? `
  <section class="card">
    <div class="small muted" style="margin-bottom:10px">Why you got them wrong (all ${S.mistakes.length})</div>
    ${byReason.map(([l, n]) => `<div class="hbar"><span class="hl">${l}</span><span class="hb"><i style="width:${(n / maxR) * 100}%"></i></span><span class="hn num">${n}</span></div>`).join('')}
    ${bySubject.length ? `<div class="small muted" style="margin:14px 0 8px">Open, by subject</div><div class="chips">${bySubject.map(([s, n]) => `<span class="chip">${subjDot(s)}${h(s)} <b class="num">${n}</b></span>`).join('')}</div>` : ''}
  </section>
  ${open.length ? `<ul class="card flush list">${mistakeRows}</ul>` : `<section class="card empty"><div class="e1">All revisited</div>New mistakes show up here and on Today until you tick them off.</section>`}
  ` : `<section class="card empty"><div class="e1">Your mistakes diary</div>After each test, log the questions you got wrong and why. They stay on Today until you've revisited them. AIR 19 in 2025 credited this habit.</section>`}
  `,
  };
}

/* ---------- test form ---------- */
let tctx = null;
function testBody() {
  const t = tctx;
  const sc = testScore({ n: t.n || 0, c: t.c || 0, w: t.w || 0 });
  const num = (id, label, val, extra = '') => `<div class="field"><label for="${id}">${label}</label><input id="${id}" class="inp num" type="number" inputmode="numeric" min="0" value="${val ?? ''}" ${extra}></div>`;
  return `<h3>${t.id ? 'Edit test' : 'Log a test'}</h3><div class="sub">Marks: +4 right, −1 wrong.</div>
    <div class="field"><label for="t-name">Name</label><input id="t-name" class="inp" type="text" placeholder="e.g. Marrow GT 3" value="${h(t.name || '')}"></div>
    <div class="field"><span class="lbl">Type</span>${seg('t-type', TEST_TYPES, t.type)}</div>
    <div class="grid2">
      <div class="field"><label for="t-date">Date</label><input id="t-date" type="date" value="${t.date}" max="${today()}"></div>
      ${num('t-n', 'Questions', t.n)}
      ${num('t-c', 'Right', t.c)}
      ${num('t-w', 'Wrong', t.w)}
    </div>
    <div class="grid2">
      <div class="field"><label for="t-time">Minutes taken</label><input id="t-time" class="inp num" type="number" inputmode="numeric" min="0" value="${t.time ?? ''}" placeholder="210"></div>
      <div class="field"><label for="t-rank">Rank in test</label><input id="t-rank" class="inp" type="text" inputmode="numeric" value="${h(t.rank || '')}" placeholder="optional"></div>
      <div class="field"><label for="t-g">Guessed</label><input id="t-g" class="inp num" type="number" inputmode="numeric" min="0" value="${t.g ?? ''}" placeholder="how many"></div>
      <div class="field"><label for="t-gr">Guesses right</label><input id="t-gr" class="inp num" type="number" inputmode="numeric" min="0" value="${t.gr ?? ''}" placeholder="of those"></div>
    </div>
    <details class="setup"${t.subj && Object.keys(t.subj).length ? ' open' : ''}><summary>Subject breakdown (optional)</summary>
      <p class="hint" style="margin-top:0">Right and wrong per subject, from the test's analysis. Shows where you lose the most marks.</p>
      <div class="sgrid"><span></span><span class="cap">Right</span><span class="cap">Wrong</span>
      ${SUBJECTS.map((sj, i) => `<span class="sn">${subjDot(sj)}${h(sj)}</span><input class="inp num" id="ts-c-${i}" type="number" inputmode="numeric" min="0" value="${t.subj?.[sj]?.[0] ?? ''}"><input class="inp num" id="ts-w-${i}" type="number" inputmode="numeric" min="0" value="${t.subj?.[sj]?.[1] ?? ''}">`).join('')}</div>
    </details>
    <div class="field"><label for="t-notes">Notes (optional)</label><textarea id="t-notes" class="inp" rows="2" placeholder="Weak areas, timing, what to change">${h(t.notes || '')}</textarea></div>
    <div class="score-preview num" id="t-preview">${sc.max ? `${sc.score} / ${sc.max} · ${pct(sc.frac)} · ${sc.skipped} skipped` : ''}</div>
    <button class="btn primary block" data-act="save-test">${t.id ? 'Save' : 'Log test'}</button>
    ${t.id ? `<button class="btn block" style="margin-top:8px" data-act="quick-review" data-id="${t.id}">⚡ Review wrong answers fast</button>
      <div class="btns" style="margin-top:8px"><button class="btn" data-act="new-mistake" data-test="${t.id}">+ One mistake</button>
      <button class="btn danger" data-act="del-test">Delete</button></div>` : ''}`;
}
function readTest() {
  const g = id => document.getElementById(id)?.value ?? '';
  const opt = id => g(id) === '' ? null : Math.max(0, +g(id));
  const subj = {};
  SUBJECTS.forEach((sj, i) => { const c = opt(`ts-c-${i}`), w = opt(`ts-w-${i}`); if (c != null || w != null) subj[sj] = [c || 0, w || 0]; });
  return { ...tctx, name: g('t-name').trim(), date: g('t-date') || today(), n: +g('t-n') || 0, c: +g('t-c') || 0, w: +g('t-w') || 0,
    rank: g('t-rank').trim(), notes: g('t-notes').trim(), time: opt('t-time'), g: opt('t-g'), gr: opt('t-gr'), subj };
}

/* ---------- fast review of a test's wrong answers ---------- */
let qctx = null;
function quickBody() {
  const t = S.tests.find(x => x.id === qctx.test);
  const vids = VIDS.filter(v => v.subject === qctx.subject);
  return `<h3>Review: ${h(t?.name || 'test')}</h3><div class="sub">One wrong answer at a time: subject, why, one line. Each becomes a mistake and pulls its topic's revision forward.</div>
    <div class="qr-count num">${qctx.added} added${t ? ` · ${t.w} wrong in this test` : ''}</div>
    <div class="chips scroll-x">${SUBJECTS.map(sj => `<button class="chip" data-act="qr-subject" data-v="${h(sj)}" aria-pressed="${sj === qctx.subject}">${subjDot(sj)}${h(sj)}</button>`).join('')}</div>
    <div class="field"><span class="lbl">Why</span>${seg('qr-reason', REASONS, qctx.reason)}</div>
    <div class="field"><label for="qr-note">What you missed</label><input id="qr-note" class="inp" placeholder="e.g. Ethosuximide for absence seizures" autocomplete="off" enterkeyhint="next"></div>
    <div class="field"><label for="qr-video">Video (optional)</label><select id="qr-video" class="inp"><option value="">Not sure</option>${vids.map(v => `<option value="${v.id}"${v.id === qctx.video ? ' selected' : ''}>${h(v.title)}</option>`).join('')}</select></div>
    <div class="btns"><button class="btn primary" data-act="qr-add">Add &amp; next</button><button class="btn" data-act="qr-done">Done</button></div>`;
}

/* ---------- mistake form ---------- */
let mctx = null;
function mistakeBody() {
  const x = mctx;
  const vids = VIDS.filter(v => v.subject === x.subject);
  const tests = sorted();
  return `<h3>${x.id ? 'Edit mistake' : 'Log a mistake'}</h3><div class="sub">What went wrong, and where it lives in your syllabus.</div>
    <div class="field"><label for="m-note">The point you missed</label><textarea id="m-note" class="inp" rows="2" placeholder="e.g. Drug of choice for absence seizures: ethosuximide">${h(x.note || '')}</textarea></div>
    <div class="field"><span class="lbl">Why</span>${seg('m-reason', REASONS, x.reason)}</div>
    <div class="field"><label for="m-subject">Subject</label><select id="m-subject" class="inp">${SUBJECTS.map(s => `<option${s === x.subject ? ' selected' : ''}>${h(s)}</option>`).join('')}</select></div>
    <div class="field"><label for="m-video">WOR video (optional)</label><select id="m-video" class="inp"><option value="">Not sure</option>${vids.map(v => `<option value="${v.id}"${v.id === x.video ? ' selected' : ''}>${h(v.title)}</option>`).join('')}</select></div>
    ${tests.length ? `<div class="field"><label for="m-test">From test (optional)</label><select id="m-test" class="inp"><option value="">None</option>${tests.map(t => `<option value="${t.id}"${t.id === x.test ? ' selected' : ''}>${h(t.name)} · ${fmtDay(t.date)}</option>`).join('')}</select></div>` : ''}
    <button class="btn primary block" data-act="save-mistake">${x.id ? 'Save' : 'Add to diary'}</button>
    ${x.id ? `<div class="btns" style="margin-top:8px"><button class="btn" data-act="mistake-toggle">${x.done ? 'Mark as open again' : 'Mark revisited'}</button><button class="btn danger" data-act="del-mistake">Delete</button></div>` : ''}`;
}
function readMistake() {
  const g = id => document.getElementById(id)?.value ?? '';
  return { ...mctx, note: g('m-note').trim(), subject: g('m-subject') || mctx.subject, video: g('m-video') || null, test: g('m-test') || mctx.test || null };
}
export function openMistake(pre = {}) {
  mctx = { reason: 'unknown', subject: SUBJECTS[0], video: null, test: null, ...pre };
  openSheet(mistakeBody);
}

export const actions = {
  'quick-review': el => { qctx = { test: el.dataset.id, subject: SUBJECTS[0], reason: 'unknown', video: '', added: 0 }; openSheet(quickBody); },
  'qr-subject': el => { qctx.subject = el.dataset.v; qctx.video = ''; },
  'qr-reason': el => { qctx.reason = el.dataset.v; qctx.video = document.getElementById('qr-video')?.value || ''; },
  'qr-add': () => {
    const note = document.getElementById('qr-note').value.trim(), video = document.getElementById('qr-video').value || null;
    if (!note && !video) { toast('Add a line or pick a video'); return; }
    S.mistakes.unshift({ id: uid(), date: today(), subject: qctx.subject, video, reason: qctx.reason, note, test: qctx.test, done: false });
    qctx.added++; qctx.video = ''; save();
    return () => document.getElementById('qr-note')?.focus();
  },
  'qr-done': () => { const n = qctx.added; closeSheet(); if (n) toast(`${n} mistake${n > 1 ? 's' : ''} added to your diary`); },
  'new-test': () => { tctx = { type: 'gt', date: today(), n: S.settings.questions }; openSheet(testBody); },
  'edit-test': el => { tctx = { ...S.tests.find(t => t.id === el.dataset.id) }; openSheet(testBody); },
  't-type': el => { tctx = { ...readTest(), type: el.dataset.v }; },
  'save-test': () => {
    const t = readTest();
    if (!t.name) t.name = `${typeName[t.type]} ${fmtDay(t.date)}`;
    if (!t.n || t.c + t.w > t.n) { toast('Check the numbers: right + wrong can’t be more than questions'); return; }
    if (t.g != null && t.gr != null && t.gr > t.g) { toast('Guesses right can’t be more than guesses'); return; }
    if (t.id) S.tests = S.tests.map(x => x.id === t.id ? t : x); else S.tests.push({ ...t, id: uid() });
    save(); closeSheet(); toast(`${t.name}: ${testScore(t).score}/${testScore(t).max}`);
  },
  'del-test': () => {
    if (!confirm('Delete this test?')) return;
    const gone = S.tests.find(x => x.id === tctx.id);
    S.tests = S.tests.filter(x => x.id !== tctx.id); save(); closeSheet();
    toast('Test deleted', () => { S.tests.push(gone); save(); });
  },
  'new-mistake': el => openMistake(el.dataset.test ? { test: el.dataset.test } : {}),
  'edit-mistake': el => { mctx = { ...S.mistakes.find(x => x.id === el.dataset.id) }; openSheet(mistakeBody); },
  'm-reason': el => { mctx = { ...readMistake(), reason: el.dataset.v }; },
  'save-mistake': () => {
    const x = readMistake();
    if (!x.note && !x.video) { toast('Add a note or pick a video'); return; }
    if (x.id) S.mistakes = S.mistakes.map(y => y.id === x.id ? x : y);
    else S.mistakes.unshift({ ...x, id: uid(), date: today(), done: false });
    save(); closeSheet(); toast('Added to your mistakes diary');
  },
  'mistake-toggle': () => { const x = S.mistakes.find(y => y.id === mctx.id); x.done = !x.done; save(); closeSheet(); },
  'mistake-done': el => { const x = S.mistakes.find(y => y.id === el.dataset.id); if (x) { x.done = true; save(); toast('Marked revisited', () => { x.done = false; save(); }); } },
  'del-mistake': () => {
    const gone = S.mistakes.find(y => y.id === mctx.id);
    S.mistakes = S.mistakes.filter(y => y.id !== mctx.id); save(); closeSheet();
    toast('Mistake deleted', () => { S.mistakes.unshift(gone); save(); });
  },
};

export function onChange(e) {
  if (e.target.id === 'm-subject' && mctx) { mctx = { ...readMistake(), subject: e.target.value, video: null }; return 'sheet'; }
  return false;
}
export function onInput(e) {
  if (!tctx || !['t-n', 't-c', 't-w'].includes(e.target.id)) return false;
  const t = readTest(), sc = testScore(t), el = document.getElementById('t-preview');
  if (el) el.textContent = sc.max ? `${sc.score} / ${sc.max} · ${pct(sc.frac)} · ${sc.skipped} skipped` : '';
  return true;
}
