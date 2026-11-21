// One screen per revision pass (R1–R4): every video with its due or done date, time limit
// and the time it really took, plus totals. Times can be corrected right here.
import { S, VIDS, SUBJECTS, PASSES, REV, BLOCK_GAP, blockMode, prog, passMins, passBudget, revInfo, save, today, dayDiff, h, mins, hrs, fmtDay, fmtDow, subjDot } from '../core.js';
import { sectionH, openSheet, closeSheet, toast } from '../ui.js';

// The limit the plan gives a pass on a day (30% less in the last six weeks before the exam).
const limitOf = (v, k, d = today()) => passBudget(v, k, d);
let edit = null; // { id, k }

function rows(k) {
  const t = today();
  return VIDS.map(v => {
    const p = prog(v.id), x = p[k], lim = limitOf(v, k, x?.d);
    if (x) return { v, state: 'done', date: x.d, lim, took: passMins(v, x), x };
    const r = revInfo(v, t);
    if (r?.k === k && r.waiting) return { v, state: 'waiting', date: null, lim: r.budget, took: null };
    if (r?.k === k) return { v, state: r.due < t ? 'overdue' : r.due === t ? 'today' : 'due', date: r.due, lim: r.budget, took: null, over: r.overdue };
    return { v, state: p.fr ? 'later' : 'unwatched', date: null, lim, took: null };
  });
}

export function view() {
  const k = S.ui.revTab || 'r1';
  const all = rows(k);
  const show = S.ui.revShow || 'active';
  const list = all.filter(r => show === 'all' ? true : show === 'done' ? r.state === 'done' : ['overdue', 'today', 'due', 'waiting', 'done'].includes(r.state));
  const order = { overdue: 0, today: 1, due: 2, waiting: 3, done: 4, later: 5, unwatched: 6 };
  list.sort((a, b) => order[a.state] - order[b.state] || (a.date || '9').localeCompare(b.date || '9') || (a.state === 'done' ? (b.date || '').localeCompare(a.date || '') : 0));
  const done = all.filter(r => r.state === 'done');
  const totalLimit = all.reduce((a, r) => a + r.lim, 0);
  const doneLimit = done.reduce((a, r) => a + r.lim, 0);
  const taken = done.reduce((a, r) => a + r.took, 0);
  const pending = all.filter(r => ['overdue', 'today', 'due'].includes(r.state));
  const over = done.filter(r => r.took > r.lim * 1.15).length;
  const counts = Object.fromEntries(PASSES.slice(1).map(kk => [kk, VIDS.filter(v => prog(v.id)[kk]).length]));
  const stateTxt = r => r.state === 'done' ? `<span class="good-t">✓ ${fmtDow(r.date)}</span>`
    : r.state === 'overdue' ? `<span class="bad-t">${r.over}d overdue</span>`
    : r.state === 'today' ? '<b>Due today</b>' : r.state === 'due' ? `Planned ${fmtDay(r.date)}` : r.state === 'waiting' ? `<span class="faint">When ${h(r.v.subject)} is ready</span>` : r.state === 'later' ? '<span class="faint">After the pass before</span>' : '<span class="faint">Not watched</span>';
  return {
    title: 'Revisions',
    meta: `${PASSES.slice(1).map(kk => `${kk.toUpperCase()} ${counts[kk]}`).join(' · ')} of ${VIDS.length}`,
    html: `
  <div class="seg rv-tabs">${PASSES.slice(1).map(kk => `<button data-act="rv-tab" data-v="${kk}" aria-pressed="${kk === k}">${kk.toUpperCase()}</button>`).join('')}</div>
  <section class="card">
    <div class="stats" style="margin:0">
      <div class="stat"><div class="v num">${hrs(totalLimit)}</div><div class="k">total time limit (all ${VIDS.length})</div></div>
      <div class="stat ${taken > doneLimit * 1.15 ? 'warn' : 'good'}"><div class="v num">${hrs(taken)}</div><div class="k">total time taken (${done.length} done)</div></div>
      <div class="stat"><div class="v num">${hrs(pending.reduce((a, r) => a + r.lim, 0))}</div><div class="k">${pending.length} due now or soon</div></div>
    </div>
    <p class="hint">${k.toUpperCase()} gets ${Math.round(REV[k].budget * 100)}% of each video's runtime. ${blockMode() ? `Revised by subject: a subject's ${k.toUpperCase()} opens ${BLOCK_GAP[k]} days after it finished ${k === 'r1' ? 'its first watch' : PASSES[PASSES.indexOf(k) - 1].toUpperCase()}. Start any one early to revise ahead.` : ''} ${done.length ? `Done ones used ${Math.round((taken / Math.max(1, doneLimit)) * 100)}% of their limits${over ? `, ${over} ran over` : ''}.` : ''} Tap a time to enter what it really took.</p>
  </section>
  <div class="chips" style="margin:6px 0">${[['active', 'Due & done'], ['done', 'Done only'], ['all', 'All videos']].map(([v, l]) => `<button class="chip" data-act="rv-show" data-v="${v}" aria-pressed="${show === v}">${l}</button>`).join('')}</div>
  ${list.length ? `<div class="card flush rtable">
    <div class="rt-row rt-head"><span>Topic</span><span>Date</span><span class="num">Limit</span><span class="num">Taken</span></div>
    ${list.map(r => `<div class="rt-row ${r.state}">
      <button class="rt-topic" data-act="open-video" data-id="${r.v.id}">${subjDot(r.v.subject)}<span>${h(r.v.title)}</span></button>
      <span class="rt-date">${stateTxt(r)}</span>
      <span class="num rt-lim">${mins(r.lim)}</span>
      ${r.state === 'done' ? `<button class="num rt-took${r.took > r.lim * 1.15 ? ' over' : ''}" data-act="rv-edit" data-id="${r.v.id}">${mins(r.took)}</button>`
        : ['overdue', 'today', 'due', 'waiting'].includes(r.state) ? `<button class="rt-go" data-act="revise" data-id="${r.v.id}">Start</button>` : '<span class="faint">—</span>'}
    </div>`).join('')}
    <div class="rt-row rt-foot"><span>Total (${list.length})</span><span></span><span class="num">${hrs(list.reduce((a, r) => a + r.lim, 0))}</span><span class="num">${hrs(list.reduce((a, r) => a + (r.took || 0), 0))}</span></div>
  </div>` : `<section class="card empty"><div class="ei">🧠</div><div class="e1">No ${k.toUpperCase()}s yet</div>${k === 'r1' ? 'R1 falls due 3 days after you first watch a video.' : `${k.toUpperCase()} comes after ${PASSES[PASSES.indexOf(k) - 1].toUpperCase()}.`}</section>`}`,
  };
}

function editBody() {
  const v = VIDS.find(x => x.id === edit.id), x = S.progress[v.id][edit.k], lim = limitOf(v, edit.k, x?.d);
  return `<h3>${h(v.title)}</h3><div class="sub">${edit.k.toUpperCase()} on ${fmtDow(x.d)} · limit ${mins(lim)}</div>
    <div class="field"><label for="rv-real">How long did it really take?</label>
      <div class="row"><input id="rv-real" class="inp num" type="number" inputmode="numeric" min="1" value="${edit.val ?? Math.round(passMins(v, x))}" style="max-width:120px"><span class="muted">minutes</span></div>
      <div class="chips" style="margin-top:10px">${[5, 10, 15, 30].map(d => `<button class="chip" data-act="rv-plus" data-v="${d}">+${d}</button>`).join('')}</div></div>
    <button class="btn primary block" data-act="rv-edit-save">Save</button>`;
}

export const actions = {
  'revisions': el => { S.ui.revBack = S.ui.tab === 'revisions' ? S.ui.revBack : S.ui.tab; S.ui.tab = 'revisions'; if (el?.dataset?.v) S.ui.revTab = el.dataset.v; closeSheet(); return 'enter'; },
  'rv-tab': el => { S.ui.revTab = el.dataset.v; },
  'rv-show': el => { S.ui.revShow = el.dataset.v; },
  'rv-edit': el => { edit = { id: el.dataset.id, k: S.ui.revTab || 'r1', val: null }; openSheet(editBody); },
  // Keep the number in state: every tap redraws the panel.
  'rv-plus': el => { const i = document.getElementById('rv-real'); edit.val = Math.max(1, (+i.value || 0) + +el.dataset.v); },
  'rv-edit-save': () => {
    const n = Math.round(+document.getElementById('rv-real').value);
    if (!(n >= 1)) { toast('Enter the minutes'); return; }
    const x = S.progress[edit.id][edit.k], was = x.m;
    x.m = n; save(); closeSheet();
    toast(`Saved ${mins(n)}`, () => { x.m = was; save(); });
  },
};
