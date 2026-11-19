// Lookalike concepts, GT rehearsals at exam time, and the final-week plan.
import { S, BY, SUBJECTS, VIDS, save, today, uid, addDays, dayDiff, testScore, h, mins, fmtDay, fmtDow, fmtDayLong, subjDot } from '../core.js';
import { openSheet, closeSheet, toast, sectionH, CHECK } from '../ui.js';

/* ---------- lookalike pairs ---------- */
let pctx = null;
function pairBody() {
  const x = pctx;
  return `<h3>${x.id ? 'Edit pair' : 'Add a lookalike pair'}</h3><div class="sub">Two things you keep mixing up, and the one detail that tells them apart.</div>
    <div class="grid2"><div class="field"><label for="pr-a">This</label><input id="pr-a" class="inp" value="${h(x.a || '')}" placeholder="e.g. Nephritic"></div>
    <div class="field"><label for="pr-b">vs that</label><input id="pr-b" class="inp" value="${h(x.b || '')}" placeholder="Nephrotic"></div></div>
    <div class="field"><label for="pr-how">How to tell them apart</label><textarea id="pr-how" class="inp" rows="3" placeholder="Haematuria + hypertension vs proteinuria > 3.5 g/day + oedema">${h(x.how || '')}</textarea></div>
    <div class="field"><label for="pr-s">Subject</label><select id="pr-s" class="inp">${SUBJECTS.map(s => `<option${s === x.subject ? ' selected' : ''}>${h(s)}</option>`).join('')}</select></div>
    <button class="btn primary block" data-act="pr-save">${x.id ? 'Save' : 'Add pair'}</button>
    ${x.id ? `<button class="btn ghost danger block" data-act="pr-del" style="margin-top:6px">Delete</button>` : ''}`;
}
export function pairsView() {
  const q = (S.ui.pairQ || '').toLowerCase();
  const list = S.pairs.filter(p => !q || `${p.a} ${p.b} ${p.how}`.toLowerCase().includes(q));
  return {
    title: 'Lookalikes',
    meta: `${S.pairs.length} pair${S.pairs.length === 1 ? '' : 's'} you mix up`,
    html: `<button class="btn primary block" data-act="pr-new">+ Add a pair</button>
    ${list.length ? `<div class="pairs">${list.map(p => `<button class="pair" data-act="pr-edit" data-id="${p.id}">
      <div class="pr-top"><span class="pr-a">${h(p.a)}</span><span class="pr-vs">vs</span><span class="pr-b">${h(p.b)}</span></div>
      ${p.how ? `<div class="pr-how">${h(p.how)}</div>` : ''}<div class="pr-s">${subjDot(p.subject)}${h(p.subject)}</div></button>`).join('')}</div>`
      : `<section class="card empty"><div class="ei">🔀</div><div class="e1">No pairs yet</div>When a mistake comes from confusing two similar things, add them here side by side. You can also make one from any mistake in the diary.</section>`}`,
  };
}
export function openPair(pre = {}) { pctx = { subject: SUBJECTS[0], ...pre }; openSheet(pairBody); }

/* ---------- GT rehearsal at exam time ---------- */
const CHECKS = [
  ['sleep', 'Asleep by 10:30 pm the night before'],
  ['wake', 'Up by 6:30, light breakfast'],
  ['start', 'Start at 9:00 sharp, exam hours (9:00–12:30)'],
  ['nophone', 'Phone in another room, no breaks beyond the real ones'],
  ['review', 'Review every wrong answer within 24 hours'],
];
export function rehearsalCard() {
  const t = today();
  const r = S.rehearsals.find(x => x.date === t) || S.rehearsals.find(x => x.date === addDays(t, 1));
  if (!r) return '';
  const tomorrow = r.date !== t;
  return `<section class="card rehearsal"><div class="rh-h">🎯 ${tomorrow ? 'Tomorrow' : 'Today'}: GT rehearsal at exam time</div>
    <ul class="list goals">${CHECKS.filter(([k]) => !tomorrow || ['sleep', 'wake'].includes(k)).map(([k, l]) => `<li><button class="goal" data-act="rh-check" data-id="${r.id}" data-v="${k}">
      <span class="check sm${r.checks?.[k] ? ' on' : ''}">${CHECK}</span><span>${l}</span></button></li>`).join('')}</ul>
    ${tomorrow ? '' : `<button class="btn primary block" data-act="new-test" style="margin-top:10px">Log this GT</button>`}</section>`;
}
function rehearsalBody() {
  const next = S.rehearsals.filter(x => x.date >= today()).sort((a, b) => a.date.localeCompare(b.date));
  let d = today(); while (new Date(d).getDay() !== 0) d = addDays(d, 1);
  return `<h3>GT rehearsals</h3><div class="sub">Grand tests taken exactly like the exam: same hours, same routine. The app reminds you the night before and walks you through the day.</div>
    <div class="field"><label for="rh-date">Date</label><input id="rh-date" type="date" value="${d}" min="${today()}"></div>
    <button class="btn primary block" data-act="rh-add">Schedule rehearsal</button>
    ${next.length ? `<ul class="list mini-list" style="margin-top:14px">${next.map(x => `<li class="item"><div class="grow">🎯 ${fmtDayLong(x.date)}</div><button class="icon-mini danger" data-act="rh-del" data-id="${x.id}">✕</button></li>`).join('')}</ul>` : ''}`;
}

/* ---------- final 7 days ---------- */
function weakest() {
  const score = {};
  for (const x of S.mistakes.filter(m => !m.done)) score[x.subject] = (score[x.subject] || 0) + 1;
  for (const t of S.tests.slice(-5)) for (const [sj, [, w]] of Object.entries(t.subj || {})) score[sj] = (score[sj] || 0) + w;
  return Object.entries(score).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([s]) => s);
}
export function finalPlan(examDays) {
  const weak = weakest();
  const day = n => n === 1
    ? [['Morning', 'High-yield sheet and lookalikes, once through'], ['Afternoon', 'Light: images and formulas only. No new topics, no GT'], ['Evening', 'Admit card, ID, route and timing ready'], ['10 pm', 'Sleep']]
    : [['6:30', 'Wake at exam time'],
      ['9:00–12:30', [7, 5, 3].includes(n) ? 'GT rehearsal at exam hours' : `Weakest subjects: ${weak.slice(0, 2).join(' and ') || 'from your mistakes diary'}`],
      ['2–5 pm', [7, 5, 3].includes(n) ? 'Review every wrong answer from the morning GT' : 'Mistakes diary: every open mistake once'],
      ['5–7 pm', 'High-yield sheet (your pins) and lookalike pairs'],
      ['7–9 pm', 'Anki reviews only, nothing new'],
      ['10:30 pm', 'Sleep']];
  const days = [7, 6, 5, 4, 3, 2, 1].filter(n => examDays == null || n <= Math.max(1, examDays));
  return `<div class="final">${weak.length ? `<p class="small" style="margin:0 0 10px">Weakest right now: ${weak.map(s => `${subjDot(s)}<b>${h(s)}</b>`).join(', ')} (open mistakes and GT losses).</p>` : ''}
    ${days.map(n => `<div class="fd"><div class="fd-h">${n === 1 ? 'The day before' : `${n} days to go`}</div>${day(n).map(([tm, what]) => `<div class="fd-r"><span class="num">${tm}</span><span>${h(what)}</span></div>`).join('')}</div>`).join('')}</div>`;
}
export function finalCard(m) {
  if (m.examDays > 7 || m.examDays < 0) return '';
  return `<section class="card final-card"><div class="rh-h">🏁 Final ${m.examDays} day${m.examDays === 1 ? '' : 's'}: nothing new, only what you already know</div>${finalPlan(m.examDays)}</section>`;
}

export const actions = {
  'pairs': () => { closeSheet(); S.ui.pairsBack = S.ui.tab === 'pairs' ? S.ui.pairsBack : S.ui.tab; S.ui.tab = 'pairs'; return 'enter'; },
  'pr-new': () => openPair(),
  'pr-edit': el => { pctx = { ...S.pairs.find(p => p.id === el.dataset.id) }; openSheet(pairBody); },
  'pr-save': () => {
    const g = id => document.getElementById(id).value.trim();
    const p = { ...pctx, a: g('pr-a'), b: g('pr-b'), how: g('pr-how'), subject: g('pr-s') };
    if (!p.a || !p.b) { toast('Fill in both sides'); return; }
    if (p.id) S.pairs = S.pairs.map(x => x.id === p.id ? p : x); else S.pairs.unshift({ ...p, id: uid(), d: today() });
    save(); closeSheet(); toast('Pair saved');
  },
  'pr-del': () => { const gone = S.pairs.find(x => x.id === pctx.id); S.pairs = S.pairs.filter(x => x.id !== pctx.id); save(); closeSheet(); toast('Pair deleted', () => { S.pairs.unshift(gone); save(); }); },
  'mistake-pair': () => {
    const note = document.getElementById('m-note')?.value.trim() || '', subject = document.getElementById('m-subject')?.value;
    openPair({ a: note.slice(0, 60), subject });
  },
  'rehearsals': () => openSheet(rehearsalBody),
  'rh-add': () => { const d = document.getElementById('rh-date').value; if (!d) return; if (S.rehearsals.some(x => x.date === d)) { toast('Already scheduled that day'); return; } S.rehearsals.push({ id: uid(), date: d, checks: {} }); save(); toast(`GT rehearsal on ${fmtDow(d)}`); },
  'rh-del': el => { S.rehearsals = S.rehearsals.filter(x => x.id !== el.dataset.id); save(); },
  'rh-check': el => { const r = S.rehearsals.find(x => x.id === el.dataset.id); r.checks ||= {}; r.checks[el.dataset.v] = !r.checks[el.dataset.v]; save(); },
  'final-preview': () => openSheet(() => `<h3>Final 7 days</h3><div class="sub">This becomes your Today screen in the last week. Rehearsal GTs on days 7, 5 and 3.</div>${finalPlan(null)}`),
};
