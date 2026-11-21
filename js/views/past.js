// Past days: every day from your start date, what the schedule asked for, what you did, and how
// much each day added to (or cleared from) your backlog. The day amounts add up exactly to the
// "behind schedule" number. Every entry can be corrected, moved to another day or removed right
// here, and anything forgotten can be added to the day it happened; all numbers follow at once.
import { S, VIDS, BY, PASSES, PLABEL, FOCUS_KINDS, metrics, prog, passMins, isRest, addDays, today, save, uid, h, mins, hrs, fmtDow, fmtDay } from '../core.js';
import { sectionH, openSheet, closeSheet, toast } from '../ui.js';

const KIND = Object.fromEntries(FOCUS_KINDS);

// Day rows, newest first. share = what the schedule asks of that day (runtime); watched = first
// watches that day (runtime). gap = share − watched; the gaps before today sum to "behind".
export function pastDays() {
  const m = metrics(), st = S.settings, t = m.t;
  const share = m.totalDays ? m.total / m.totalDays : 0;
  const byDay = {};
  const add = (d, x) => (byDay[d] ||= { items: [], watched: 0, real: 0 }).items.push(x);
  for (const v of VIDS) {
    const p = prog(v.id);
    for (const k of PASSES) {
      const x = p[k]; if (!x) continue;
      add(x.d, { type: 'pass', v, k, x, real: passMins(v, x) });
      byDay[x.d].real += passMins(v, x);
      if (k === 'fr') byDay[x.d].watched += v.mins;
    }
  }
  for (const s of S.sessions) { add(s.d, { type: 'session', s, real: s.m }); byDay[s.d].real += s.m; }
  const rows = [];
  let before = 0;
  for (const [d, x] of Object.entries(byDay)) if (d < st.start) before += x.watched;
  let expectedSoFar = 0;
  for (let d = st.start, g = 0; d <= t && g < 1500; d = addDays(d, 1), g++) {
    const x = byDay[d] || { items: [], watched: 0, real: 0 };
    let sh = 0;
    if (!isRest(d) && d <= st.target) sh = Math.max(0, Math.min(share, m.total - expectedSoFar));
    expectedSoFar += sh;
    rows.push({ d, share: sh, watched: x.watched, real: x.real, items: x.items, gap: sh - x.watched, rest: isRest(d), target: S.days[d]?.t ?? null, today: d === t });
  }
  // Running backlog after each finished day (today is still going, so it isn't counted yet).
  let run = -before;
  for (const r of rows) { if (!r.today) run += r.gap; r.after = run; }
  const extra = Object.entries(byDay).filter(([d]) => d < st.start).flatMap(([, x]) => x.items);
  return { rows: rows.reverse(), before, extra, speed: m.planSpeed, behind: m.behind };
}

const wh = (mm, speed) => hrs(mm / speed); // runtime → hours of watching at your speed
function itemRow(it) {
  if (it.type === 'session') return `<li class="item past-it"><span class="rbadge" style="--h:200">${(KIND[it.s.kind] || 'Study').slice(0, 2)}</span>
    <div class="grow"><div class="t">${h(KIND[it.s.kind] || 'Study')}</div><div class="s num">${mins(it.s.m)}${it.s.t ? ` · ended ${new Date(it.s.t).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}` : ''}</div></div>
    <button class="btn small-btn" data-act="pd-edit-s" data-id="${it.s.id}">Edit</button></li>`;
  return `<li class="item past-it"><span class="rbadge" style="--h:${it.k === 'fr' ? 160 : 260}">${it.k === 'fr' ? 'FW' : it.k.toUpperCase()}</span>
    <div class="grow"><div class="t">${h(it.v.title)}</div><div class="s num">${PLABEL[it.k]} · ${mins(it.real)}${it.k === 'fr' ? ` · ${mins(it.v.mins)} runtime` : ''}</div></div>
    <button class="btn small-btn" data-act="pd-edit-p" data-id="${it.v.id}" data-k="${it.k}">Edit</button></li>`;
}

export function view() {
  const P = pastDays(), sp = P.speed, open = S.ui.pastOpen || {};
  const worst = P.rows.filter(r => !r.today && r.gap > 0).sort((a, b) => b.gap - a.gap).slice(0, 3);
  return {
    title: 'Past days',
    meta: 'Where your backlog came from',
    html: `
  <section class="card">
    <div class="stats" style="margin:0">
      <div class="stat ${P.behind > 0 ? 'bad' : 'good'}"><div class="v num">${P.behind > 0 ? wh(P.behind, sp) : `+${wh(-P.behind, sp)}`}</div><div class="k">${P.behind > 0 ? 'behind schedule' : 'ahead of schedule'}</div></div>
      <div class="stat"><div class="v num">${P.rows.filter(r => !r.today && r.share > 0 && r.watched < r.share * 0.5).length}</div><div class="k">days well short</div></div>
      <div class="stat"><div class="v num">${P.rows.filter(r => !r.today && r.share > 0 && r.watched >= r.share).length}</div><div class="k">days on or over</div></div>
    </div>
    <p class="hint">Each study day the schedule asks for the same share of WOR (${wh(P.rows.find(r => r.share > 0)?.share || 0, sp)} of watching at ${sp.toFixed(2).replace(/0$/, '')}×). The red and green amounts below are each day's shortfall or extra; together they make up the number above. Tap a day to see, fix or add what you did.${worst.length ? ` Most came from ${worst.map(r => fmtDow(r.d)).join(', ')}.` : ''}</p>
  </section>
  ${sectionH('Day by day', 'newest first')}
  <ul class="card flush list past-list">${P.rows.map(r => {
    const o = open[r.d] ?? r.today;
    const tone = r.today ? '' : r.gap > 1 ? 'bad-t' : r.gap < -1 ? 'good-t' : 'muted';
    return `<li class="past-day${o ? ' open' : ''}">
      <button class="past-h" data-act="pd-toggle" data-d="${r.d}">
        <span class="grow"><span class="t">${r.today ? 'Today' : r.d === addDays(today(), -1) ? 'Yesterday' : fmtDow(r.d)}${r.rest ? ' <span class="pill">rest</span>' : ''}</span>
          <span class="s num">${r.share ? `Schedule ${wh(r.share, sp)} · watched ${wh(r.watched, sp)}` : `Watched ${wh(r.watched, sp)}`} · studied ${mins(r.real)} in all</span></span>
        <span class="past-gap num ${tone}">${r.today ? '<span class="faint small">in progress</span>' : Math.abs(r.gap) < 1 ? '±0' : `${r.gap > 0 ? '+' : '−'}${wh(Math.abs(r.gap), sp)}`}${!r.today ? `<small>backlog ${r.after > 0 ? wh(r.after, sp) : '0h'}</small>` : ''}</span>
      </button>
      ${o ? `<div class="past-body">
        ${r.items.length ? `<ul class="list">${r.items.map(itemRow).join('')}</ul>` : `<p class="small muted" style="margin:4px 0 10px">Nothing logged ${r.rest ? 'on this rest day' : 'this day'}.</p>`}
        <div class="btns"><button class="btn small-btn" data-act="pd-add-w" data-d="${r.d}">+ Lecture watched</button><button class="btn small-btn" data-act="pd-add-s" data-d="${r.d}">+ Study time</button></div>
      </div>` : ''}
    </li>`;
  }).join('')}</ul>
  ${P.before ? `<p class="hint">${wh(P.before, sp)} watched before your start date (${fmtDay(S.settings.start)}) counts toward the total too.</p>` : ''}`,
  };
}

/* ---------- edit sheets ---------- */
let ed = null;
function passSheet() {
  const v = BY[ed.id], p = prog(v.id), x = p[ed.k], i = PASSES.indexOf(ed.k);
  const prev = i > 0 ? p[PASSES[i - 1]]?.d : null, next = PASSES.slice(i + 1).map(k => p[k]?.d).find(Boolean);
  const latest = !PASSES.slice(i + 1).some(k => p[k]);
  return `<h3>${h(v.title)}</h3><div class="sub">${PLABEL[ed.k]}</div>
    <div class="field"><label for="pd-date">Day</label><input id="pd-date" type="date" value="${x.d}" ${prev ? `min="${prev}"` : ''} max="${next && next < today() ? next : today()}"></div>
    <div class="field"><label for="pd-min">Time it took (minutes)</label><input id="pd-min" class="inp num" type="number" inputmode="numeric" min="1" value="${Math.round(passMins(v, x))}"></div>
    <button class="btn primary block" data-act="pd-save-p">Save</button>
    <button class="btn ghost danger block" data-act="pd-del-p" style="margin-top:8px"${latest ? '' : ' disabled'}>${latest ? `Remove this ${ed.k === 'fr' ? 'watch' : 'revision'}` : `Remove ${PASSES.slice(i + 1).filter(k => p[k]).map(k => PLABEL[k]).join(', ')} first`}</button>`;
}
function sessionSheet() {
  const s = ed.s;
  return `<h3>${ed.isNew ? 'Add study time' : 'Study time'}</h3><div class="sub">${fmtDow(s.d)}</div>
    <div class="field"><span class="lbl">What</span><div class="chips">${FOCUS_KINDS.map(([k, l]) => `<button class="chip" data-act="pd-kind" data-v="${k}" aria-pressed="${s.kind === k}">${l}</button>`).join('')}</div></div>
    <div class="field"><label for="pd-sd">Day</label><input id="pd-sd" type="date" value="${s.d}" max="${today()}"></div>
    <div class="field"><label for="pd-sm">Minutes</label><input id="pd-sm" class="inp num" type="number" inputmode="numeric" min="1" value="${s.m || ''}"></div>
    <button class="btn primary block" data-act="pd-save-s">${ed.isNew ? 'Add' : 'Save'}</button>
    ${ed.isNew ? '' : '<button class="btn ghost danger block" data-act="pd-del-s" style="margin-top:8px">Remove</button>'}`;
}
function watchSheet() {
  const opts = VIDS.filter(v => !prog(v.id).fr);
  const subj = [...new Set(opts.map(v => v.subject))];
  return `<h3>Add a lecture you watched</h3><div class="sub">${fmtDow(ed.d)}</div>
    <div class="field"><label for="pd-v">Lecture</label><select id="pd-v" class="inp">${subj.map(s => `<optgroup label="${h(s)}">${opts.filter(v => v.subject === s).map(v => `<option value="${v.id}">${h(v.title)} · ${mins(v.mins)}</option>`).join('')}</optgroup>`).join('')}</select></div>
    <div class="field"><label for="pd-vm">Time it took (minutes, optional)</label><input id="pd-vm" class="inp num" type="number" inputmode="numeric" min="1" placeholder="runtime ÷ ${S.settings.speed}×"></div>
    <button class="btn primary block" data-act="pd-save-w">Add to ${fmtDay(ed.d)}</button>`;
}
const val = id => document.getElementById(id)?.value;

export const actions = {
  past: () => { closeSheet(); if (S.ui.tab !== 'past') S.ui.pastBack = S.ui.tab; S.ui.tab = 'past'; return 'enter'; },
  'pd-toggle': el => { const d = el.dataset.d, o = (S.ui.pastOpen ||= {}); o[d] = !(o[d] ?? d === today()); },
  'pd-edit-p': el => { ed = { id: el.dataset.id, k: el.dataset.k }; openSheet(passSheet); },
  'pd-save-p': () => {
    const x = S.progress[ed.id][ed.k], d = val('pd-date'), n = Math.round(+val('pd-min'));
    const el = document.getElementById('pd-date');
    if (!d || (el.min && d < el.min) || (el.max && d > el.max)) { toast(`Pick a day between ${fmtDay(el.min || d)} and ${fmtDay(el.max)}`); return; }
    if (!(n >= 1)) { toast('Enter the minutes it took'); return; }
    const was = { ...x };
    x.d = d; x.m = n; if (x.t && d !== was.d) delete x.t;
    save(); closeSheet(); toast('Saved. Every number has been updated.', () => { S.progress[ed.id][ed.k] = was; save(); });
  },
  'pd-del-p': () => {
    const p = S.progress[ed.id], was = p[ed.k], id = ed.id, k = ed.k;
    delete p[k]; if (!Object.keys(p).length) delete S.progress[id];
    save(); closeSheet(); toast(`${PLABEL[k]} removed`, () => { (S.progress[id] ||= {})[k] = was; save(); });
  },
  'pd-edit-s': el => { const s = S.sessions.find(x => x.id === el.dataset.id); ed = { s: { ...s } }; openSheet(sessionSheet); },
  'pd-add-s': el => { ed = { isNew: true, s: { id: uid(), d: el.dataset.d, m: 0, kind: 'anki' } }; openSheet(sessionSheet); },
  'pd-kind': el => { ed.s.kind = el.dataset.v; ed.s.d = val('pd-sd') || ed.s.d; ed.s.m = +val('pd-sm') || ed.s.m; },
  'pd-save-s': () => {
    const d = val('pd-sd'), n = Math.round(+val('pd-sm'));
    if (!d || d > today()) { toast('Pick a day up to today'); return; }
    if (!(n >= 1 && n <= 1440)) { toast('Enter the minutes (1–1440)'); return; }
    const s = { ...ed.s, d, m: n };
    if (ed.isNew) S.sessions.push(s); else S.sessions = S.sessions.map(x => x.id === s.id ? s : x);
    save(); closeSheet(); toast(ed.isNew ? `Added ${mins(n)} on ${fmtDay(d)}` : 'Saved');
  },
  'pd-del-s': () => {
    const s = S.sessions.find(x => x.id === ed.s.id);
    S.sessions = S.sessions.filter(x => x.id !== ed.s.id); save(); closeSheet();
    toast('Removed', () => { S.sessions.push(s); save(); });
  },
  'pd-add-w': el => { ed = { d: el.dataset.d }; openSheet(watchSheet); },
  'pd-save-w': () => {
    const id = val('pd-v'), n = Math.round(+val('pd-vm'));
    if (!id || !BY[id] || prog(id).fr) { toast('Pick a lecture'); return; }
    (S.progress[id] ||= {}).fr = { d: ed.d, s: S.settings.speed, ...(n >= 1 ? { m: n } : {}) };
    save(); closeSheet(); toast(`${BY[id].title} added to ${fmtDay(ed.d)}`, () => { delete S.progress[id].fr; if (!Object.keys(S.progress[id]).length) delete S.progress[id]; save(); });
  },
};
