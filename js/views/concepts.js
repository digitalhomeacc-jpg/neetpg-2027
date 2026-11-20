// Concepts: every Marrow WOR chapter as a concept (merged across lectures), with how often it was
// asked (from your PYT pack), its Anki cards, how well you know it, and links to related concepts.
// Three views: a mind map you can walk through (subject → lectures → concepts → related
// concepts), a searchable list, and "Fix next": weak or shaky concepts, high-yield first.
import { S, VIDS, BY, SUBJECTS, ANKI, prog, save, h, plural, subjDot, subjHue } from '../core.js';
import { openSheet, closeSheet, toast, sectionH } from '../ui.js';
import { getPack, linkOf } from './pyt.js';

const D = window.CONCEPTS || { concepts: [], rel: {} };
const C = Object.fromEntries(D.concepts.map(c => [c.id, c]));
const byLecture = {};
for (const c of D.concepts) for (const [vid, ci] of c.h) (byLecture[vid] ||= []).push([ci, c]);
for (const k in byLecture) byLecture[k].sort((a, b) => a[0] - b[0]);
const home = c => c.h[0];
const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// ---------- mastery ----------
const LV = { S: ['Strong', 150], h: ['Shaky', 38], W: ['Weak', 0] };
const lv = c => S.mastery?.[c.id] || null;
const hueOf = c => lv(c) ? LV[lv(c)][1] : 220;

// ---------- PYTs per concept (from the private pack) ----------
let pytKey = '', pytMap = {};
function pyts() {
  const p = getPack(); if (!p) return {};
  const key = `${p.made}|${JSON.stringify(S.pytLinks || {}).length}|${p.tables.length}`;
  if (key === pytKey) return pytMap;
  pytKey = key; pytMap = {};
  const add = (c, x, kind) => { const o = (pytMap[c.id] ||= { t: [], q: [], w: 0, M: 0 }); o[kind].push(x); o.w += kind === 't' ? (x.times || (x.imp === 'M' ? 4 : x.imp === 'm' ? 2 : 1)) : 2; if (x.imp === 'M') o.M++; };
  for (const [kind, list] of [['t', p.tables], ['q', p.recall]]) {
    for (const x of list) {
      const l = linkOf(x); if (!l) continue;
      const cs = byLecture[l.vid]; if (!cs) continue;
      let hit = l.ch != null ? cs.find(([ci]) => ci === l.ch)?.[1] : null;
      if (!hit) {
        // No chapter on the link: a chapter whose name contains the topic, or the other way round.
        const t = norm(x.t);
        if (t.length >= 4) hit = cs.map(([, c]) => c).find(c => { const n = norm(c.n); return n.includes(t) || (n.length >= 5 && t.includes(n)); });
      }
      if (hit) add(hit, x, kind);
    }
  }
  return pytMap;
}
const ankiCards = c => c.h.reduce((a, [vid, ci]) => a + (ANKI?.videos[vid]?.ch?.[ci] || 0), 0);
const watched = c => c.h.some(([vid]) => prog(vid).fr);

// ---------- mind map ----------
function nodeSvg(x, y, r, label, hue, act, attrs, cls = '') {
  const lines = wrap(label, r > 30 ? 16 : 13, 3);
  return `<g class="cm-node ${cls}" data-act="${act}" ${attrs} transform="translate(${x.toFixed(1)},${y.toFixed(1)})" style="--h:${hue}">
    <circle r="${r}"></circle>
    <text text-anchor="middle" dy="${(-(lines.length - 1) * 6.5 + 4).toFixed(1)}">${lines.map((l, i) => `<tspan x="0" dy="${i ? 13 : 0}">${h(l)}</tspan>`).join('')}</text></g>`;
}
function wrap(s, n, max) {
  const out = []; let cur = '';
  for (const w of s.replace(/\s+/g, ' ').split(' ')) {
    if ((cur + ' ' + w).trim().length > n && cur) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) out.push(cur);
  if (out.length > max) { out.length = max; out[max - 1] = out[max - 1].replace(/.{0,2}$/, '…'); }
  return out;
}
// Nodes round a circle; with many nodes, alternate between two radii so labels don't collide.
function ring(items, R, cx, cy, R2 = R, start = -Math.PI / 2) {
  const n = items.length;
  return items.map((it, i) => { const r = i % 2 ? R2 : R, a = start + (2 * Math.PI * i) / n; return { ...it, x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }; });
}
const SHORT = { 'Obstetrics & Gynaecology': 'OBG', 'Community Medicine': 'PSM', 'Forensic Medicine': 'FMT', Ophthalmology: 'Ophthal', Paediatrics: 'Paeds', Orthopaedics: 'Ortho', Pharmacology: 'Pharma', Microbiology: 'Micro', Pathology: 'Patho', Physiology: 'Physio', Biochemistry: 'Biochem', Anaesthesia: 'Anaes', Dermatology: 'Derma', Psychiatry: 'Psych', Radiology: 'Radio' };
const lecName = v => v.title.replace(/Revision:?\s*/, '');
function mapView() {
  const f = S.ui.cmFocus || { t: 'root' };
  const W = 380, H = 380, cx = W / 2, cy = H / 2, P = pyts();
  let center, nodes = [], edges = [], crumbs = [], info = '', grid = null;
  if (f.t === 'root') {
    center = { label: 'WOR · all subjects', hue: 160 };
    nodes = ring(SUBJECTS.map(s => ({ label: SHORT[s] || s, hue: subjHue(s), act: 'cm-go', attrs: `data-t="subject" data-id="${h(s)}"`, r: 25 })), 118, cx, cy, 160);
    info = `<p class="small muted">${D.concepts.length.toLocaleString('en-IN')} concepts from Marrow's chapter lists. Tap a subject, then a lecture, then a concept. Lines between concepts mean they're related.</p>`;
  } else if (f.t === 'subject') {
    const vs = VIDS.filter(v => v.subject === f.id && byLecture[v.id]);
    center = { label: f.id, hue: subjHue(f.id) };
    const mk = v => ({ label: lecName(v), hue: prog(v.id).fr ? 150 : subjHue(f.id), act: 'cm-go', attrs: `data-t="lecture" data-id="${v.id}"`, r: vs.length > 10 ? 23 : 27, cls: prog(v.id).fr ? 'done' : '' });
    if (vs.length <= 16) nodes = ring(vs.map(mk), vs.length > 10 ? 108 : 132, cx, cy, vs.length > 10 ? 165 : 132);
    else grid = vs;
    crumbs = [['root', 'All subjects']];
    info = `<p class="small muted">${vs.length} lectures${grid ? ' (the number is how many concepts each has)' : ''}. Green = watched. Tap one to see its concepts.</p>`;
  } else if (f.t === 'lecture') {
    const v = BY[f.id], cs = (byLecture[f.id] || []).map(([, c]) => c);
    center = { label: v.title, hue: subjHue(v.subject) };
    const many = cs.length > 9;
    const mk = c => ({ label: c.n.replace(/ · .*/, ''), hue: hueOf(c), act: 'cm-go', attrs: `data-t="concept" data-id="${c.id}"`, r: Math.min(30, (many ? 21 : 24) + Math.sqrt(P[c.id]?.w || 0) * 1.5), cls: lv(c) ? 'rated' : '' });
    nodes = ring(cs.map(mk), many ? 105 : 135, cx, cy, many ? 162 : 135);
    crumbs = [['root', 'All subjects'], ['subject:' + v.subject, v.subject]];
    info = `<p class="small muted">${plural(cs.length, 'concept')} in this lecture. Bigger = asked more often in PYTs. Colour = how well you know it.</p>
      <button class="btn block" data-act="open-video" data-id="${v.id}">Open lecture</button>`;
  } else {
    const c = C[f.id]; if (!c) { S.ui.cmFocus = { t: 'root' }; return mapView(); }
    center = { label: c.n.replace(/ · .*/, ''), hue: hueOf(c) };
    const rel = (D.rel[c.id] || []).slice(0, 9);
    const lecs = c.h.map(([vid]) => vid).filter((x, i, a) => a.indexOf(x) === i);
    const items = [
      ...lecs.map(vid => ({ label: BY[vid].title, hue: subjHue(BY[vid].subject), act: 'cm-go', attrs: `data-t="lecture" data-id="${vid}"`, r: 22, kind: 'home', cls: 'lec' })),
      ...rel.map(([id, k]) => ({ label: C[id].n.replace(/ · .*/, ''), hue: hueOf(C[id]), act: 'cm-go', attrs: `data-t="concept" data-id="${id}"`, r: Math.min(29, 21 + Math.sqrt(P[id]?.w || 0) * 1.4), kind: k })),
    ];
    nodes = ring(items, items.length > 7 ? 112 : 138, cx, cy, items.length > 7 ? 160 : 138);
    edges = nodes.map(n => ({ x: n.x, y: n.y, kind: n.kind }));
    const v = BY[home(c)[0]];
    crumbs = [['root', 'All subjects'], ['subject:' + v.subject, v.subject], ['lecture:' + v.id, v.title]];
    const p = P[c.id];
    info = `<div class="cm-info"><div class="row"><div class="grow"><b>${h(c.n)}</b><div class="small muted">${p ? `${p.t.length} PYT topic${p.t.length !== 1 ? 's' : ''}${p.M ? ` · ${p.M} most important` : ''} · ${p.q.length} question${p.q.length !== 1 ? 's' : ''} asked` : 'No PYTs linked here'} · ${ankiCards(c)} Anki cards</div></div>
      <button class="btn small-btn" data-act="cm-open" data-id="${c.id}">Details</button></div>
      <p class="small faint" style="margin:8px 0 0">Lines: <span class="ek s"></span>related by your cards · <span class="ek c"></span>asked together · <span class="ek x"></span>part of it</p></div>`;
  }
  if (grid) return `<div class="cm-crumbs">${crumbs.map(([k, l]) => `<button class="link" data-act="cm-go" data-t="${k.split(':')[0]}" data-id="">${h(l)}</button>`).join(' › ')}</div>
    <section class="card cm-grid" style="--h:${center.hue}"><div class="cm-gh">${h(f.id)}</div>${grid.map(v => `<button class="cm-lec${prog(v.id).fr ? ' done' : ''}" data-act="cm-go" data-t="lecture" data-id="${v.id}"><span>${h(lecName(v))}</span><b>${(byLecture[v.id] || []).length}</b></button>`).join('')}</section>${info}`;
  const svg = `<svg class="cm-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Concept map">
    ${(f.t === 'concept' ? edges : nodes).map(n => `<line class="cm-edge ${n.kind || ''}" x1="${cx}" y1="${cy}" x2="${n.x.toFixed(1)}" y2="${n.y.toFixed(1)}"></line>`).join('')}
    ${nodes.map(n => nodeSvg(n.x, n.y, n.r, n.label, n.hue, n.act, n.attrs, n.cls)).join('')}
    ${nodeSvg(cx, cy, 40, center.label, center.hue, f.t === 'concept' ? 'cm-open' : 'cm-noop', f.t === 'concept' ? `data-id="${f.id}"` : '', 'center')}
  </svg>`;
  return `<div class="cm-crumbs">${crumbs.map(([k, l]) => `<button class="link" data-act="cm-go" data-t="${k.split(':')[0]}" data-id="${h(k.split(':').slice(1).join(':'))}">${h(l)}</button>`).join(' › ')}</div>
    <section class="card cm-card">${svg}</section>${info}`;
}

// ---------- list + fix next ----------
function row(c) {
  const p = pyts()[c.id], v = BY[home(c)[0]], l = lv(c);
  return `<li class="item pyt-item"><span class="rbadge cm-badge" style="--h:${hueOf(c)}">${l ? LV[l][0][0] : p?.M ? '★' : '·'}</span>
    <button class="open" data-act="cm-open" data-id="${c.id}"><div class="t">${h(c.n)}</div>
      <div class="s">${subjDot(c.s)}${h(v.title)}${c.h.length > 1 ? ` +${c.h.length - 1}` : ''}${p ? ` · ${p.t.length + p.q.length} PYT${p.M ? `, ${p.M} most imp.` : ''}` : ''}</div></button>
    <span class="faint chev">›</span></li>`;
}
let q = '';
function listView() {
  const subj = S.ui.cmSubj || '';
  let xs = D.concepts.filter(c => !subj || c.s === subj);
  if (q) { const t = norm(q); xs = D.concepts.filter(c => norm(c.n).includes(t)); }
  const P = pyts();
  xs = xs.slice().sort((a, b) => (P[b.id]?.w || 0) - (P[a.id]?.w || 0) || 0);
  const LIM = 120;
  return `<div class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>
      <input id="cm-q" type="search" placeholder="Search ${D.concepts.length.toLocaleString('en-IN')} concepts" value="${h(q)}" autocomplete="off"></div>
    ${q ? '' : `<div class="chips scroll-x" style="margin:8px 0"><button class="chip" data-act="cm-subj" data-v="" aria-pressed="${!subj}">All</button>${SUBJECTS.map(s => `<button class="chip" data-act="cm-subj" data-v="${h(s)}" aria-pressed="${subj === s}" style="--h:${subjHue(s)}">${subjDot(s)}${h(s)}</button>`).join('')}</div>`}
    <div id="cm-results"><ul class="card flush list">${xs.slice(0, LIM).map(row).join('') || '<li class="item small muted">No concepts match.</li>'}</ul>
    ${xs.length > LIM ? `<p class="hint center">Showing the ${LIM} most asked of ${xs.length}. Search to find others.</p>` : ''}</div>`;
}
function fixView() {
  const P = pyts();
  const rated = D.concepts.filter(c => lv(c) === 'W' || lv(c) === 'h').sort((a, b) => (lv(a) === 'W' ? 0 : 1) - (lv(b) === 'W' ? 0 : 1) || (P[b.id]?.w || 0) - (P[a.id]?.w || 0));
  const check = D.concepts.filter(c => !lv(c) && watched(c) && P[c.id]?.M).sort((a, b) => (P[b.id]?.w || 0) - (P[a.id]?.w || 0)).slice(0, 30);
  const counts = { S: 0, h: 0, W: 0 }; for (const k of Object.values(S.mastery || {})) counts[k] = (counts[k] || 0) + 1;
  return `<section class="card"><div class="stats" style="margin:0">
      <div class="stat good"><div class="v num">${counts.S}</div><div class="k">strong</div></div>
      <div class="stat warn"><div class="v num">${counts.h}</div><div class="k">shaky</div></div>
      <div class="stat bad"><div class="v num">${counts.W}</div><div class="k">weak</div></div></div>
    <p class="hint">Rate a concept from its details after you revise it or solve questions on it. Weak ones come first here, most asked first.</p></section>
    ${rated.length ? `${sectionH('Fix next', 'weak, then shaky')}<ul class="card flush list">${rated.slice(0, 60).map(row).join('')}</ul>` : ''}
    ${check.length ? `${sectionH('High-yield, not rated yet', 'from lectures you\'ve watched')}<ul class="card flush list">${check.map(row).join('')}</ul>` : ''}
    ${!rated.length && !check.length ? '<section class="card empty small"><div class="e1">Nothing to fix yet</div>Watch lectures and rate their concepts; weak, high-yield ones will show up here.</section>' : ''}`;
}

export function view() {
  const mode = S.ui.cmMode || 'map';
  return {
    title: 'Concepts',
    meta: `${D.concepts.length.toLocaleString('en-IN')} concepts · mind map`,
    html: `<div class="seg pyt-mode">${[['map', 'Mind map'], ['list', 'All concepts'], ['fix', 'Fix next']].map(([k, l]) => `<button data-act="cm-mode" data-v="${k}" aria-pressed="${mode === k}">${l}</button>`).join('')}</div>
      ${mode === 'map' ? mapView() : mode === 'list' ? listView() : fixView()}`,
  };
}

// ---------- concept details ----------
let ctx = null;
function sheet() {
  const c = C[ctx]; if (!c) return '';
  const P = pyts()[c.id], l = lv(c);
  const rel = (D.rel[c.id] || []);
  const KIND = { s: 'related', c: 'asked together', x: 'part of it' };
  return `<h3>${h(c.n)}</h3><div class="sub">${subjDot(c.s)}${h(c.s)}${c.h.length > 1 ? ` · taught in ${c.h.length} lectures` : ''}</div>
    <div class="field"><span class="lbl">How well do you know it?</span>
      <div class="seg cm-lv">${Object.entries(LV).map(([k, [name]]) => `<button data-act="cm-rate" data-v="${k}" aria-pressed="${l === k}" class="lv-${k}">${name}</button>`).join('')}</div>
      ${l ? '<button class="link" data-act="cm-rate" data-v="" style="margin-top:6px">Clear</button>' : ''}</div>
    <div class="field"><span class="lbl">Where it's taught</span>
      <ul class="list mini-list">${c.h.map(([vid, ci, at]) => `<li class="item"><span class="rbadge" style="--h:${subjHue(BY[vid].subject)}">${prog(vid).fr ? '✓' : '▶'}</span>
        <button class="open" data-act="open-video" data-id="${vid}"><div class="t">${h(BY[vid].title)}</div><div class="s num">${h(at)} · ${h(BY[vid].chapters[ci][1])}${ANKI?.videos[vid]?.ch?.[ci] ? ` · ${ANKI.videos[vid].ch[ci]} Anki cards` : ''}</div></button></li>`).join('')}</ul></div>
    ${P ? `<div class="field"><span class="lbl">PYTs · ${P.t.length} topic${P.t.length !== 1 ? 's' : ''}, ${P.q.length} question${P.q.length !== 1 ? 's' : ''}</span>
      <ul class="list mini-list">${[...P.t.sort((a, b) => (b.times || 0) - (a.times || 0)), ...P.q].slice(0, 12).map(x => `<li class="item"><span class="rbadge pyt-count" style="--h:${x.q ? 200 : { M: 150, m: 38, L: 220 }[x.imp || 'L']}">${x.q ? `'${String(x.y || '').slice(2)}` : x.times ? `${x.times}×` : '–'}</span>
        <button class="open" data-act="pyt-open" data-k="${x.k}"><div class="t">${h(x.t || x.q.slice(0, 60))}</div><div class="s">${x.q ? `NEET PG ${h(x.y || '')}` : { M: 'Most important', m: 'Moderately important', L: 'Least important' }[x.imp] || ''}</div></button></li>`).join('')}</ul></div>`
      : `<p class="small muted">${getPack() ? 'No PYT topic linked to this concept.' : 'Import your PYT pack (Library → PYTs) to see what was asked here.'}</p>`}
    ${rel.length ? `<div class="field"><span class="lbl">Related concepts</span><div class="cm-rel">${rel.map(([id, k]) => `<button class="chip" data-act="cm-open" data-id="${id}" style="--h:${hueOf(C[id])}">${h(C[id].n.replace(/ · .*/, ''))} <span class="faint small">${KIND[k]}</span></button>`).join('')}</div></div>` : ''}
    <button class="btn block" data-act="cm-show" data-id="${c.id}" style="margin-top:12px">Show on the mind map</button>`;
}
export function openConcept(id) { ctx = id; openSheet(sheet); }
export const lectureCount = vid => (byLecture[vid] || []).length;
export const conceptAt = (vid, ci) => (byLecture[vid] || []).find(([i]) => i === ci)?.[1] || null;

export const actions = {
  concepts: () => { closeSheet(); S.ui.cmBack = S.ui.tab === 'concepts' ? S.ui.cmBack : S.ui.tab; S.ui.tab = 'concepts'; return 'enter'; },
  'cm-lecture': el => { closeSheet(); if (S.ui.tab !== 'concepts') S.ui.cmBack = S.ui.tab; S.ui.tab = 'concepts'; S.ui.cmMode = 'map'; S.ui.cmFocus = { t: 'lecture', id: el.dataset.id }; return 'enter'; },
  'cm-mode': el => { S.ui.cmMode = el.dataset.v; },
  'cm-go': el => { const t = el.dataset.t; S.ui.cmFocus = t === 'root' ? { t: 'root' } : { t, id: el.dataset.id }; },
  'cm-noop': () => {},
  'cm-subj': el => { S.ui.cmSubj = el.dataset.v; },
  'cm-open': el => openConcept(el.dataset.id),
  'cm-show': el => { closeSheet(); S.ui.tab = 'concepts'; S.ui.cmMode = 'map'; S.ui.cmFocus = { t: 'concept', id: el.dataset.id }; return 'top'; },
  'cm-rate': el => {
    const v = el.dataset.v, was = S.mastery?.[ctx];
    S.mastery ||= {};
    if (v) S.mastery[ctx] = v; else delete S.mastery[ctx];
    save();
    if (v) toast(`${C[ctx].n.replace(/ · .*/, '')}: ${LV[v][0].toLowerCase()}`, () => { if (was) S.mastery[ctx] = was; else delete S.mastery[ctx]; save(); });
  },
};

export function onInput(e) {
  if (e.target.id !== 'cm-q') return false;
  q = e.target.value;
  const box = document.getElementById('cm-results');
  if (box) { const tmp = document.createElement('div'); tmp.innerHTML = listView(); box.innerHTML = tmp.querySelector('#cm-results').innerHTML; }
  return true;
}

export function libraryCard() {
  const n = Object.keys(S.mastery || {}).length;
  return `<button class="card tomorrow pyt-entry" data-act="concepts"><span class="rbadge" style="--h:320">🧠</span>
    <span class="grow"><span class="t">Concepts · mind map</span><span class="s">${D.concepts.length.toLocaleString('en-IN')} concepts, how they connect, what was asked${n ? ` · ${n} rated` : ''}</span></span><span class="faint">›</span></button>`;
}
