// Previous-year topics (PYTs) and questions, from your private PYT pack (imported in Settings,
// kept on this device only; never in the public repo). Each topic is linked to the WOR lecture
// that teaches it when the evidence was clear; the rest show a suggestion you confirm with a
// tap, or you link them yourself. Your links sync between devices.
import { S, VIDS, BY, SUBJECTS, prog, save, h, plural, subjDot, subjHue } from '../core.js';
import { openSheet, closeSheet, toast, sectionH } from '../ui.js';

const KEY = 'pg27.pyt';
let pack = null, loaded = false;
export function getPack() {
  if (!loaded) { loaded = true; try { pack = JSON.parse(localStorage.getItem(KEY)) || null; } catch { pack = null; } }
  return pack;
}
const IMP = { M: 'Most important', m: 'Moderately important', L: 'Least important' };
const IMPS = { M: 'Most', m: 'Moderate', L: 'Least' };
const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// The lecture (and chapter) a topic belongs to: your own link first, then the pack's.
export function linkOf(x) {
  const l = S.pytLinks?.[x.k];
  if (l === null) return null;                       // you unlinked it
  if (l) return l;
  return x.vid ? { vid: x.vid, ch: x.ch ?? null } : null;
}
const covered = x => { const l = linkOf(x); return !!(l && prog(l.vid).fr); };

export function forVideo(vid) {
  const p = getPack(); if (!p) return { tables: [], recall: [] };
  return { tables: p.tables.filter(x => linkOf(x)?.vid === vid), recall: p.recall.filter(x => linkOf(x)?.vid === vid) };
}
export function countFor(vid) { const f = forVideo(vid); return f.tables.length + f.recall.length; }
export function chapterCounts(vid) {
  const f = forVideo(vid), c = {};
  for (const x of [...f.tables, ...f.recall]) { const l = linkOf(x); if (l?.ch != null) c[l.ch] = (c[l.ch] || 0) + 1; }
  return c;
}

function linkHtml(x) {
  const l = linkOf(x);
  if (l) {
    const v = BY[l.vid], auto = !S.pytLinks?.[x.k] && !x.chk;
    return `<button class="pyt-link${prog(l.vid).fr ? ' done' : ''}" data-act="open-video" data-id="${l.vid}">${prog(l.vid).fr ? '✓ ' : ''}${h(v.title)}${l.ch != null && v.chapters?.[l.ch] ? ` › ${h(v.chapters[l.ch][1])}` : ''}</button>${auto ? ` <button class="pyt-auto" data-act="pyt-open" data-k="${x.k}" title="Linked automatically: tap to check or change">auto</button>` : ''}`;
  }
  if (x.guess && BY[x.guess] && S.pytLinks?.[x.k] !== null) return `<span class="pyt-sug">Suggested: ${h(BY[x.guess].title)} <button class="link" data-act="pyt-confirm" data-k="${x.k}">Link</button></span>`;
  return `<button class="link" data-act="pyt-open" data-k="${x.k}">Link to a lecture</button>`;
}
function tableRow(x) {
  return `<li class="pyt-row${covered(x) ? ' done' : ''}"><button class="open" data-act="pyt-open" data-k="${x.k}">
      <span class="pyt-imp ${x.imp || 'L'}">${IMPS[x.imp] || 'Not rated'}</span><span class="t">${h(x.t)}</span>
      <span class="s small muted">${x.times ? `asked ${x.times}× · ` : ''}${x.sec ? h(x.sec) + ' · ' : ''}${h(x.src || '')}</span></button>
    <div class="pyt-lk small">${linkHtml(x)}</div></li>`;
}
function recallRow(x) {
  return `<li class="pyt-row${covered(x) ? ' done' : ''}"><button class="open" data-act="pyt-open" data-k="${x.k}">
      <span class="pyt-year">NEET PG ${h(x.y || '')}</span><span class="t">${h(x.t || x.q.slice(0, 80))}</span>
      <span class="s small muted">${h(x.q.slice(0, 120))}${x.q.length > 120 ? '…' : ''}</span></button>
    <div class="pyt-lk small">${linkHtml(x)}</div></li>`;
}

export function view() {
  const p = getPack();
  if (!p) return {
    title: 'PYTs', html: `<section class="card empty"><div class="ei">📚</div><div class="e1">Import your PYT pack</div>
      Topics asked in NEET PG and INICET (2020–2025) by importance, and the questions asked each year, linked to your lectures.
      <div class="spacer"></div><label class="btn primary" for="pyt-file">Import PYT pack</label><input id="pyt-file" type="file" accept=".json,application/json" hidden>
      <p class="hint">It stays on this device. Import it on each device you use.</p></section>`,
  };
  const subjects = SUBJECTS.filter(s => p.tables.some(x => x.s === s) || p.recall.some(x => x.s === s));
  const subj = subjects.includes(S.ui.pytSubj) ? S.ui.pytSubj : subjects[0];
  const tab = S.ui.pytTab || 'M';
  const tbl = p.tables.filter(x => x.s === subj), rec = p.recall.filter(x => x.s === subj);
  const impOf = x => x.imp || 'L';   // a few topics are unrated in the book: listed with the least important
  const list = tab === 'Q' ? rec.slice().sort((a, b) => (b.y || '').localeCompare(a.y || '')) : tbl.filter(x => impOf(x) === tab);
  const cnt = k => k === 'Q' ? rec.length : tbl.filter(x => impOf(x) === k).length;
  const cov = xs => xs.filter(covered).length;
  const most = tbl.filter(x => x.imp === 'M');
  return {
    title: 'PYTs',
    meta: 'NEET PG & INICET · 2020–2025',
    html: `
  <div class="chips scroll-x" style="margin:4px 0 10px">${subjects.map(s => `<button class="chip" data-act="pyt-subj" data-v="${h(s)}" aria-pressed="${s === subj}" style="--h:${subjHue(s)}">${subjDot(s)}${h(s)}</button>`).join('')}</div>
  <section class="card">
    <div class="stats" style="margin:0">
      <div class="stat good"><div class="v num">${cov(most)}/${most.length}</div><div class="k">most important covered</div></div>
      <div class="stat"><div class="v num">${cov(tbl)}/${tbl.length}</div><div class="k">all topics covered</div></div>
      <div class="stat"><div class="v num">${rec.length}</div><div class="k">questions asked 2021–25</div></div>
    </div>
    <p class="hint">"Covered" = the lecture it's linked to is watched. Most important topics were checked by hand; links marked <span class="pyt-auto">auto</span> were made automatically (about 9 in 10 right): tap one to check or change it.</p>
  </section>
  <div class="seg pyt-tabs">${[['M', 'Most'], ['m', 'Moderate'], ['L', 'Least'], ['Q', 'Asked']].map(([k, l]) => `<button data-act="pyt-tab" data-v="${k}" aria-pressed="${tab === k}">${l} <span class="num faint">${cnt(k)}</span></button>`).join('')}</div>
  ${list.length ? `<ul class="card flush pyt-list">${list.map(x => tab === 'Q' ? recallRow(x) : tableRow(x)).join('')}</ul>` : '<section class="card empty small">Nothing here for this subject.</section>'}`,
  };
}

// ---------- detail sheet: a topic, its questions, and its lecture link ----------
let ctx = null;
const find = k => { const p = getPack(); return p && (p.tables.find(x => x.k === k) || p.recall.find(x => x.k === k)); };
function related(x) {
  const p = getPack(), t = norm(x.t);
  if (!t) return [];
  return p.recall.filter(r => r.k !== x.k && norm(r.t) && (norm(r.t) === t || norm(r.t).includes(t) || t.includes(norm(r.t))));
}
// Options (A–D), "Answer:" and numbered follow-ups each on their own line.
const lines = t => h(t).replace(/\s+(Options:|Answer:|A:|Q:)/g, '\n$1').replace(/([a-z0-9.,)])([B-E]\))/g, '$1\n$2').replace(/\s+([A-E][).])\s+/g, '\n$1 ').replace(/\s+(\d{1,2}\.)\s+(?=\D)/g, '\n$1 ').trim();
function qaHtml(r) {
  return `<div class="pyt-q"><div class="pyt-year">NEET PG ${h(r.y || '')}${r.t ? ` · ${h(r.t)}` : ''}</div><p>${lines(r.q)}</p>
    ${r.x ? `<details><summary>Likely follow-up questions</summary><p class="small">${lines(r.x)}</p></details>` : ''}</div>`;
}
function sheet() {
  const x = find(ctx.k); if (!x) return '<p>Not found.</p>';
  const l = linkOf(x), isQ = !!x.q;
  const vs = VIDS.filter(v => v.subject === (ctx.subj || (l ? BY[l.vid].subject : x.s)));
  const sel = ctx.pick ?? l?.vid ?? x.guess ?? '';
  const chs = BY[sel]?.chapters || [];
  return `<h3>${h(x.t || 'Question')}</h3>
    <div class="sub">${subjDot(x.s)}${h(x.s)}${x.imp ? ` · <span class="pyt-imp ${x.imp}">${IMP[x.imp]}</span>` : ''}${x.times ? ` · asked ${x.times}× in 2020–25` : ''}${x.y ? ` · NEET PG ${h(x.y)}` : ''}</div>
    ${x.src ? `<p class="small muted">Suggested source: ${h(x.src)}</p>` : ''}
    ${isQ ? qaHtml(x) : ''}
    ${(() => { const rel = related(x); return rel.length ? `<div class="field"><span class="lbl">Asked on this topic</span>${rel.map(qaHtml).join('')}</div>` : ''; })()}
    <div class="field"><span class="lbl">Lecture</span>
      ${l ? `<p class="small">${linkHtml(x)}</p>` : '<p class="small muted">Not linked to a lecture yet.</p>'}
      <div class="row" style="gap:8px;margin-top:6px"><select id="pyt-subj" class="inp">${SUBJECTS.map(s => `<option ${s === (ctx.subj || (BY[sel]?.subject || x.s)) ? 'selected' : ''}>${h(s)}</option>`).join('')}</select></div>
      <select id="pyt-vid" class="inp" style="margin-top:8px"><option value="">Choose the lecture…</option>${vs.map(v => `<option value="${v.id}" ${v.id === sel ? 'selected' : ''}>${h(v.title)}</option>`).join('')}</select>
      ${chs.length ? `<select id="pyt-ch" class="inp" style="margin-top:8px"><option value="">Whole lecture</option>${chs.map((c, i) => `<option value="${i}" ${(ctx.ch ?? l?.ch) === i ? 'selected' : ''}>${h(c[1])}</option>`).join('')}</select>` : ''}
      <div class="btns" style="margin-top:10px"><button class="btn primary" data-act="pyt-save">Save link</button>${l ? '<button class="btn danger" data-act="pyt-unlink">Unlink</button>' : ''}</div></div>`;
}
export function openTopic(k) { ctx = { k }; openSheet(sheet); }

export function videoSheet(vid) {
  const f = forVideo(vid), v = BY[vid];
  const order = { M: 0, m: 1, L: 2 };
  openSheet(() => `<h3>PYTs in ${h(v.title)}</h3><div class="sub">${plural(f.tables.length, 'topic')} from the PYT lists · ${plural(f.recall.length, 'question')} asked 2021–25</div>
    ${f.tables.length ? `<ul class="card flush pyt-list">${f.tables.slice().sort((a, b) => order[a.imp] - order[b.imp]).map(tableRow).join('')}</ul>` : ''}
    ${f.recall.length ? `<div class="field"><span class="lbl">What was asked</span>${f.recall.slice().sort((a, b) => (b.y || '').localeCompare(a.y || '')).map(qaHtml).join('')}</div>` : ''}
    ${!f.tables.length && !f.recall.length ? '<p class="muted">No PYTs linked to this lecture yet.</p>' : ''}`);
}

export const actions = {
  pyts: () => { closeSheet(); S.ui.pytBack = S.ui.tab === 'pyts' ? S.ui.pytBack : S.ui.tab; S.ui.tab = 'pyts'; return 'enter'; },
  'pyt-subj': el => { S.ui.pytSubj = el.dataset.v; },
  'pyt-tab': el => { S.ui.pytTab = el.dataset.v; },
  'pyt-open': el => openTopic(el.dataset.k),
  'pyt-video': el => videoSheet(el.dataset.id),
  'pyt-confirm': el => { const x = find(el.dataset.k); (S.pytLinks ||= {})[x.k] = { vid: x.guess, ch: null }; save(); toast(`Linked to ${BY[x.guess].title}`, () => { delete S.pytLinks[x.k]; save(); }); },
  'pyt-save': () => {
    const vid = document.getElementById('pyt-vid')?.value, chv = document.getElementById('pyt-ch')?.value;
    if (!vid) { toast('Choose the lecture'); return; }
    (S.pytLinks ||= {})[ctx.k] = { vid, ch: chv === '' || chv == null ? null : +chv }; save(); closeSheet(); toast('Link saved');
  },
  'pyt-unlink': () => { (S.pytLinks ||= {})[ctx.k] = null; save(); closeSheet(); toast('Unlinked'); },
};

export function onChange(e) {
  if (e.target.id === 'pyt-subj') { ctx.subj = e.target.value; ctx.pick = ''; ctx.ch = null; return 'sheet'; }
  if (e.target.id === 'pyt-vid') { ctx.pick = e.target.value; ctx.ch = null; return 'sheet'; }
  if (e.target.id === 'pyt-file' && e.target.files[0]) {
    e.target.files[0].text().then(txt => {
      try {
        const p = JSON.parse(txt);
        if (!p || p.kind !== 'pg27-pyt' || !Array.isArray(p.tables) || !Array.isArray(p.recall)) throw new Error('not a PYT pack');
        localStorage.setItem(KEY, JSON.stringify(p)); pack = p; loaded = true;
        toast(`PYT pack imported: ${p.tables.length} topics, ${p.recall.length} questions`);
        document.dispatchEvent(new Event('pg27:render'));
      } catch (err) { toast(err.message === 'not a PYT pack' ? "That file isn't a PYT pack" : "Couldn't read that file (it may be too big for this browser)"); }
    });
    return true;
  }
  return false;
}
