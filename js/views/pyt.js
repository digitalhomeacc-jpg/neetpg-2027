// Previous-year topics (PYTs) and questions, from your private PYT pack (imported in Settings,
// kept on this device only; never in the public repo). Each topic is linked to the WOR lecture
// that teaches it when the evidence was clear; the rest show a suggestion you confirm with a
// tap, or you link them yourself. Your links sync between devices.
import { S, VIDS, BY, SUBJECTS, prog, save, h, plural, subjDot, subjHue } from '../core.js';
import { openSheet, closeSheet, toast, sectionH } from '../ui.js';

const KEY = 'pg27.pyt';
let pack = null, loaded = false;
// One file box for the whole app, outside the screen that gets redrawn. Android leaves the app
// for its file picker, and the app redraws when it comes back; a box inside the screen would be
// thrown away before it could hand over the file, and the import would silently do nothing.
function readText(f) {
  if (f.text) return f.text();
  return new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => bad(r.error); r.readAsText(f); });
}
function importFile(f) {
  toast('Importing PYT pack…');
  readText(f).then(txt => {
    try {
      const p = JSON.parse(txt);
      if (!p || p.kind !== 'pg27-pyt' || !Array.isArray(p.tables) || !Array.isArray(p.recall)) throw new Error('not a PYT pack');
      p.at = Date.now(); setPack(p);
      toast(`PYT pack imported: ${p.tables.length} topics, ${p.recall.length} questions`);
      document.dispatchEvent(new Event('pg27:pack'));
    } catch (err) { toast(err.message === 'not a PYT pack' ? "That file isn't a PYT pack" : "Couldn't read that file. Pick pg27-pyt-pack.json (if it came on WhatsApp, save it to Files/Downloads first)"); }
  }, () => toast("Couldn't open that file. Save it to Files/Downloads first, then import it from there"));
}
const picker = Object.assign(document.createElement('input'), { type: 'file', id: 'pyt-file', hidden: true });
picker.addEventListener('change', () => { const f = picker.files?.[0]; if (f) importFile(f); picker.value = ''; });
document.body.append(picker);

// Store a pack on this device (from an import, or pulled from your synced account).
export function setPack(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage full: keep it in memory for now */ }
  pack = p; loaded = true; document.dispatchEvent(new Event('pg27:render'));
}
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
const HUE = { M: 150, m: 38, L: 220 };
const lectureLine = x => {
  const l = linkOf(x);
  if (!l) return x.guess && BY[x.guess] ? `<span class="faint">Suggested: ${h(BY[x.guess].title)}</span>` : '<span class="faint">Not linked to a lecture</span>';
  const v = BY[l.vid];
  return `${prog(l.vid).fr ? '<span class="good-t">✓</span> ' : ''}${h(v.title)}${l.ch != null && v.chapters?.[l.ch] ? ` › ${h(v.chapters[l.ch][1])}` : ''}${!S.pytLinks?.[x.k] && !x.chk ? ' <span class="pyt-auto">auto</span>' : ''}`;
};
function tableRow(x, { subj = false } = {}) {
  const imp = x.imp || 'L';
  return `<li class="item pyt-item${covered(x) ? ' done' : ''}">
    <span class="rbadge pyt-count" style="--h:${HUE[imp]}">${x.times ? `${x.times}×` : '–'}</span>
    <button class="open" data-act="pyt-open" data-k="${x.k}"><div class="t">${h(x.t)}</div>
      <div class="s">${subj ? `${subjDot(x.s)}${h(x.s)} · ` : ''}${lectureLine(x)}</div></button>
    <span class="faint chev">›</span></li>`;
}
function recallRow(x, { subj = false } = {}) {
  return `<li class="item pyt-item${covered(x) ? ' done' : ''}">
    <span class="rbadge pyt-count" style="--h:200">'${String(x.y || '').slice(2)}</span>
    <button class="open" data-act="pyt-open" data-k="${x.k}"><div class="t">${h(x.t || x.q.slice(0, 70))}</div>
      <div class="s">${subj ? `${subjDot(x.s)}${h(x.s)} · ` : ''}${h(x.q.slice(0, 90))}${x.q.length > 90 ? '…' : ''}</div></button>
    <span class="faint chev">›</span></li>`;
}

// ---------- analysis ----------
function hbar(rows, max, fmt) {
  return `<div class="hbars">${rows.map(([label, val, sub, act]) => `<button class="hbar" ${act || ''}><span class="hb-l">${label}</span>
    <span class="hb-t"><i style="width:${max ? Math.max(2, (val / max) * 100) : 0}%"></i></span><span class="hb-v num">${fmt(val)}</span>${sub ? `<span class="hb-s">${sub}</span>` : ''}</button>`).join('')}</div>`;
}
function analysis(p) {
  const T = p.tables, Q = p.recall;
  const score = x => x.times || (x.imp === 'M' ? 4 : x.imp === 'm' ? 2 : 1);
  // Subjects by how much they were asked (sum of times repeated).
  const subs = SUBJECTS.map(s => { const xs = T.filter(x => x.s === s); return { s, w: xs.reduce((a, x) => a + score(x), 0), n: xs.length, M: xs.filter(x => x.imp === 'M'), cov: xs.filter(x => x.imp === 'M' && covered(x)).length, q: Q.filter(x => x.s === s).length }; })
    .filter(x => x.n || x.q).sort((a, b) => b.w - a.w);
  const maxW = Math.max(...subs.map(x => x.w));
  // Lectures that carry the most asked topics.
  const lec = {};
  for (const x of T) { const l = linkOf(x); if (l) (lec[l.vid] ||= { w: 0, n: 0, m: 0 }), lec[l.vid].w += score(x), lec[l.vid].n++, lec[l.vid].m += x.imp === 'M' ? 1 : 0; }
  for (const x of Q) { const l = linkOf(x); if (l) (lec[l.vid] ||= { w: 0, n: 0, m: 0 }), lec[l.vid].w += 2, lec[l.vid].n++; }
  const topLec = Object.entries(lec).sort((a, b) => b[1].w - a[1].w).slice(0, 15);
  const maxL = topLec.length ? topLec[0][1].w : 1;
  const top = T.filter(x => x.times).sort((a, b) => b.times - a.times || (a.imp === 'M' ? -1 : 1)).slice(0, 25);
  // Asked in more than one NEET PG year.
  const byTopic = {};
  for (const x of Q) { const k = norm(x.t); if (k.length < 3) continue; (byTopic[k] ||= { t: x.t, s: x.s, years: new Set(), items: [] }).years.add(x.y); byTopic[k].items.push(x); }
  const again = Object.values(byTopic).filter(x => x.years.size > 1).sort((a, b) => b.years.size - a.years.size);
  const years = ['2021', '2022', '2023', '2024', '2025'];
  const ysub = SUBJECTS.filter(s => Q.some(x => x.s === s));
  const totM = T.filter(x => x.imp === 'M'), covM = totM.filter(covered).length;
  return `
  <section class="card pyt-hero">
    <div class="row" style="gap:16px">
      <div class="ak-ring" style="--p:${totM.length ? (covM / totM.length) * 100 : 0}"><b class="num">${covM}</b><span>of ${totM.length}</span></div>
      <div class="grow"><div class="t"><b>Most important topics covered</b></div>
        <div class="small muted">${T.length.toLocaleString('en-IN')} topics from 6 NEET PG and 12 INICET papers (2020–25) · ${Q.length} questions from NEET PG 2021–25</div></div>
    </div>
  </section>

  ${sectionH('Where the questions come from', 'times asked, all topics')}
  <section class="card">${hbar(subs.map(x => [`${subjDot(x.s)}${h(x.s)}`, x.w, `${x.M.length} most important · ${x.cov}/${x.M.length} covered`, `data-act="pyt-subj-go" data-v="${h(x.s)}"`]), maxW, v => v)}
    <p class="hint">Bars add up how many times each topic was asked. Tap a subject to see its topics.</p></section>

  ${sectionH('Most asked topics', 'top 25')}
  <ul class="card flush list">${top.map(x => tableRow(x, { subj: true })).join('')}</ul>

  ${sectionH('Lectures that carry the most PYTs')}
  <section class="card">${hbar(topLec.map(([vid, o]) => [`${prog(vid).fr ? '<span class="good-t">✓</span> ' : ''}${h(BY[vid].title)}`, o.w, `${subjDot(BY[vid].subject)}${h(BY[vid].subject)} · ${o.n} PYTs${o.m ? ` · ${o.m} most important` : ''}`, `data-act="pyt-video" data-id="${vid}"`]), maxL, v => v)}
    <p class="hint">Watch and revise these well: each carries many asked topics. Tap one to see them.</p></section>

  ${again.length ? `${sectionH('Asked again and again', 'NEET PG, more than one year')}
  <ul class="card flush list">${again.slice(0, 20).map(x => `<li class="item pyt-item"><span class="rbadge pyt-count" style="--h:0">${x.years.size}×</span>
    <button class="open" data-act="pyt-open" data-k="${x.items[0].k}"><div class="t">${h(x.t)}</div><div class="s">${subjDot(x.s)}${h(x.s)} · ${[...x.years].sort().join(', ')}</div></button><span class="faint chev">›</span></li>`).join('')}</ul>` : ''}

  ${sectionH('Questions by year', 'NEET PG recall')}
  <section class="card flush"><div class="ytable"><div class="yrow yhead"><span>Subject</span>${years.map(y => `<span class="num">'${y.slice(2)}</span>`).join('')}</div>
    ${ysub.map(s => `<button class="yrow" data-act="pyt-subj-go" data-v="${h(s)}" data-tab="Q"><span>${subjDot(s)}${h(s)}</span>${years.map(y => { const n = Q.filter(x => x.s === s && x.y === y).length; return `<span class="num${n ? '' : ' faint'}">${n || '·'}</span>`; }).join('')}</button>`).join('')}
  </div></section>`;
}

export function view() {
  const p = getPack();
  if (!p) return {
    title: 'PYTs', html: `<section class="card empty"><div class="ei">📚</div><div class="e1">Import your PYT pack</div>
      Topics asked in NEET PG and INICET (2020–2025) by importance, and the questions asked each year, linked to your lectures.
      <div class="spacer"></div><button class="btn primary" data-act="pyt-import">Import PYT pack</button>
      <p class="hint">If you've signed in to sync, import it on one device and your other devices get it too.</p></section>`,
  };
  const mode = S.ui.pytMode || 'analysis';
  const subjects = SUBJECTS.filter(s => p.tables.some(x => x.s === s) || p.recall.some(x => x.s === s));
  const subj = S.ui.pytSubj && (S.ui.pytSubj === 'all' || subjects.includes(S.ui.pytSubj)) ? S.ui.pytSubj : 'all';
  const tab = S.ui.pytTab || 'M';
  const inS = x => subj === 'all' || x.s === subj;
  const tbl = p.tables.filter(inS), rec = p.recall.filter(inS);
  const impOf = x => x.imp || 'L';
  const cnt = k => k === 'Q' ? rec.length : tbl.filter(x => impOf(x) === k).length;
  let list = tab === 'Q' ? rec.slice().sort((a, b) => (b.y || '').localeCompare(a.y || '')) : tbl.filter(x => impOf(x) === tab).sort((a, b) => (b.times || 0) - (a.times || 0));
  const most = tbl.filter(x => x.imp === 'M'), cov = most.filter(covered).length;
  const LIMIT = 150, more = list.length > LIMIT && !S.ui.pytAll;
  if (more) list = list.slice(0, LIMIT);
  return {
    title: 'PYTs',
    meta: 'NEET PG & INICET · 2020–2025',
    html: `
  <div class="seg pyt-mode">${[['analysis', 'Analysis'], ['topics', 'Topics']].map(([k, l]) => `<button data-act="pyt-mode" data-v="${k}" aria-pressed="${mode === k}">${l}</button>`).join('')}</div>
  ${mode === 'analysis' ? analysis(p) : `
  <div class="chips scroll-x" style="margin:4px 0 10px"><button class="chip" data-act="pyt-subj" data-v="all" aria-pressed="${subj === 'all'}">All subjects</button>${subjects.map(s => `<button class="chip" data-act="pyt-subj" data-v="${h(s)}" aria-pressed="${s === subj}" style="--h:${subjHue(s)}">${subjDot(s)}${h(s)}</button>`).join('')}</div>
  <section class="card pyt-sum"><div class="row" style="gap:14px">
    <div class="grow"><div class="t"><b class="num">${cov}/${most.length}</b> most important covered</div><div class="bar-line" style="margin-top:8px"><i style="width:${most.length ? (cov / most.length) * 100 : 0}%"></i></div></div>
    <div class="small muted num" style="text-align:right">${tbl.length} topics<br>${rec.length} questions</div></div></section>
  <div class="seg pyt-tabs">${[['M', 'Most'], ['m', 'Moderate'], ['L', 'Least'], ['Q', 'Asked']].map(([k, l]) => `<button data-act="pyt-tab" data-v="${k}" aria-pressed="${tab === k}">${l} <span class="num faint">${cnt(k)}</span></button>`).join('')}</div>
  ${list.length ? `<ul class="card flush list">${list.map(x => tab === 'Q' ? recallRow(x, { subj: subj === 'all' }) : tableRow(x, { subj: subj === 'all' })).join('')}</ul>
  ${more ? `<button class="btn block" data-act="pyt-all">Show all ${cnt(tab)}</button>` : ''}` : '<section class="card empty small">Nothing here for this subject.</section>'}
  <p class="hint center">Badges show how many times a topic was asked (green most, amber moderately, grey least important). Links marked <span class="pyt-auto">auto</span> were made automatically: tap to check.</p>`}`,
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
// Same topic in the other PYT lists (it can appear under two subjects).
const sameTopic = x => { const t = norm(x.t); return t ? getPack().tables.filter(y => y.k !== x.k && norm(y.t) === t) : []; };
function sheet() {
  const x = find(ctx.k); if (!x) return '<p>Not found.</p>';
  const l = linkOf(x), isQ = !!x.q, imp = x.imp || 'L';
  const vs = VIDS.filter(v => v.subject === (ctx.subj || (l ? BY[l.vid].subject : x.s)));
  const sel = ctx.pick ?? l?.vid ?? x.guess ?? '';
  const chs = BY[sel]?.chapters || [];
  const rel = related(x), twins = sameTopic(x);
  const edit = ctx.edit || !l;
  return `<h3>${h(x.t || 'Question')}</h3>
    <div class="sub">${subjDot(x.s)}${h(x.s)}${x.y ? ` · NEET PG ${h(x.y)}` : ''}</div>
    ${isQ ? '' : `<div class="pyt-facts">
      <div class="pf"><span class="rbadge pyt-count" style="--h:${HUE[imp]}">${x.times ? `${x.times}×` : '–'}</span><span>${x.times ? `asked ${x.times} time${x.times > 1 ? 's' : ''}` : 'times asked not given'}<small>NEET PG + INICET, 2020–25</small></span></div>
      <div class="pf"><span class="pyt-imp ${imp}">${IMPS[x.imp] || 'Not rated'}</span><span>${IMP[x.imp] || 'Not rated in the book'}</span></div>
      ${x.src ? `<div class="pf"><span class="pf-ic">📖</span><span>${h(x.src)}<small>source the book suggests</small></span></div>` : ''}
    </div>`}
    ${isQ ? qaHtml(x) : ''}
    ${rel.length ? `<div class="field"><span class="lbl">Questions asked on this topic · ${rel.length}</span>${rel.map(qaHtml).join('')}</div>` : isQ ? '' : '<p class="small muted">No NEET PG 2021–25 recall question on this exact topic in the book.</p>'}
    ${twins.length ? `<p class="small muted">Also listed under ${twins.map(t => `<button class="link" data-act="pyt-open" data-k="${t.k}">${h(t.s)} (${IMPS[t.imp] || 'not rated'}${t.times ? `, ${t.times}×` : ''})</button>`).join(', ')}.</p>` : ''}
    <div class="field"><span class="lbl">Lecture</span>
      ${l ? `<button class="item pyt-lec" data-act="open-video" data-id="${l.vid}"><span class="rbadge" style="--h:${subjHue(BY[l.vid].subject)}">${prog(l.vid).fr ? '✓' : '▶'}</span>
        <span class="grow"><span class="t">${h(BY[l.vid].title)}</span><span class="s">${l.ch != null && BY[l.vid].chapters?.[l.ch] ? `${h(BY[l.vid].chapters[l.ch][0])} · ${h(BY[l.vid].chapters[l.ch][1])}` : 'Whole lecture'}${!S.pytLinks?.[x.k] && !x.chk ? ' · <span class="pyt-auto">auto</span>' : x.chk && !S.pytLinks?.[x.k] ? ' · checked' : ''}</span></span><span class="faint">›</span></button>
        ${edit ? '' : '<button class="link" data-act="pyt-edit" style="margin-top:6px">Change lecture</button>'}`
      : `<p class="small muted">Not linked to a lecture yet${x.guess && BY[x.guess] ? `. Suggested: <b>${h(BY[x.guess].title)}</b> <button class="link" data-act="pyt-confirm" data-k="${x.k}">Link it</button>` : ''}.</p>`}
      ${edit ? `<div class="pyt-editor">
      <select id="pyt-subj" class="inp">${SUBJECTS.map(s2 => `<option ${s2 === (ctx.subj || (BY[sel]?.subject || x.s)) ? 'selected' : ''}>${h(s2)}</option>`).join('')}</select>
      <select id="pyt-vid" class="inp" style="margin-top:8px"><option value="">Choose the lecture…</option>${vs.map(v => `<option value="${v.id}" ${v.id === sel ? 'selected' : ''}>${h(v.title)}</option>`).join('')}</select>
      ${chs.length ? `<select id="pyt-ch" class="inp" style="margin-top:8px"><option value="">Whole lecture</option>${chs.map((c, i) => `<option value="${i}" ${(ctx.ch ?? l?.ch) === i ? 'selected' : ''}>${h(c[1])}</option>`).join('')}</select>` : ''}
      <div class="btns" style="margin-top:10px"><button class="btn primary" data-act="pyt-save">Save link</button>${l ? '<button class="btn danger" data-act="pyt-unlink">Unlink</button>' : ''}</div></div>` : ''}</div>`;
}
export function openTopic(k) { ctx = { k }; openSheet(sheet); }

// Cards for other screens.
export function libraryCard() {
  const p = getPack();
  if (!p) return `<button class="card tomorrow pyt-entry" data-act="pyts"><span class="rbadge" style="--h:280">📚</span>
    <span class="grow"><span class="t">PYTs</span><span class="s">Add your PYT pack: topics asked 2020–25 by priority, linked to these lectures</span></span><span class="faint">›</span></button>`;
  const M = p.tables.filter(x => x.imp === 'M'), cov = M.filter(covered).length;
  return `<button class="card tomorrow pyt-entry" data-act="pyts"><span class="rbadge" style="--h:280">📚</span>
    <span class="grow"><span class="t">PYTs · ${cov}/${M.length} most important covered</span>
      <span class="s">${p.tables.length.toLocaleString('en-IN')} topics and ${p.recall.length} questions · analysis by subject and lecture</span>
      <span class="bar-line" style="display:block;margin-top:8px"><i style="width:${M.length ? (cov / M.length) * 100 : 0}%"></i></span></span><span class="faint">›</span></button>`;
}
export function todayCard(ids) {
  const p = getPack(); if (!p || !ids.length) return '';
  const rows = ids.map(id => { const f = forVideo(id); return { id, n: f.tables.length + f.recall.length, m: f.tables.filter(x => x.imp === 'M').length, top: f.tables.filter(x => x.imp === 'M' || x.imp === 'm').sort((a, b) => (b.times || 0) - (a.times || 0)).slice(0, 3) }; }).filter(r => r.n);
  if (!rows.length) return '';
  return `${sectionH("PYTs in today's lectures")}
  <ul class="card flush list">${rows.map(r => `<li class="item pyt-item"><span class="rbadge pyt-count" style="--h:${r.m ? 150 : 38}">${r.n}</span>
    <button class="open" data-act="pyt-video" data-id="${r.id}"><div class="t">${h(BY[r.id].title)}</div>
      <div class="s">${r.m ? `<b class="good-t">${r.m} most important</b> · ` : ''}${r.top.map(x => h(x.t)).join(', ') || 'see what was asked'}</div></button><span class="faint chev">›</span></li>`).join('')}</ul>`;
}

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
  'pyt-subj': el => { S.ui.pytSubj = el.dataset.v; S.ui.pytAll = false; },
  'pyt-subj-go': el => { S.ui.pytSubj = el.dataset.v; S.ui.pytMode = 'topics'; if (el.dataset.tab) S.ui.pytTab = el.dataset.tab; S.ui.pytAll = false; return 'top'; },
  'pyt-edit': () => { ctx.edit = true; },
  'pyt-mode': el => { S.ui.pytMode = el.dataset.v; },
  'pyt-all': () => { S.ui.pytAll = true; },
  'pyt-tab': el => { S.ui.pytTab = el.dataset.v; S.ui.pytAll = false; },
  'pyt-import': () => picker.click(),
  'pyt-open': el => openTopic(el.dataset.k),
  'pyt-video': el => videoSheet(el.dataset.id),
  'pyt-confirm': el => { const x = find(el.dataset.k); (S.pytLinks ||= {})[x.k] = { vid: x.guess, ch: null }; save(); if (ctx) ctx.edit = false; toast(`Linked to ${BY[x.guess].title}`, () => { delete S.pytLinks[x.k]; save(); }); },
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
  return false;
}
