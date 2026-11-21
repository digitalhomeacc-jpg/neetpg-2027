// Day planner: one day at a time on a 24-hour timeline, for any past, present or future day.
// Two lanes: what you planned (study blocks you schedule) and what happened (every lecture,
// revision, Study now and Focus session at its real time, a running timer live). Sleep from
// Apple Health and duty shifts are drawn behind both. The summary compares plan with reality,
// including how much of your study happened at the times you planned it.
import { S, VIDS, BY, PASSES, PLABEL, FOCUS_KINDS, prog, passMins, dutyOn, addDays, today, iso, isRest, save, uid, h, mins, fmtDow, fmtDayLong, metrics, revisionsOn } from '../core.js';
import { sectionH, openSheet, closeSheet, toast } from '../ui.js';
import { ledger } from './duty.js';

const PX = 1.1;                       // pixels per minute on the timeline
const KIND = Object.fromEntries([['lectures', 'New lectures'], ['revision', 'Revision'], ...FOCUS_KINDS]);
const toMin = s => { const [a, b] = String(s).split(':').map(Number); return a * 60 + (b || 0); };
const hhmm = m => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const clock = m => { const hh = Math.floor(m / 60) % 24, mm = m % 60; return `${hh % 12 || 12}${mm ? `:${String(mm).padStart(2, '0')}` : ''}${hh < 12 ? 'a' : 'p'}`; };
const minOf = (t, d) => { const x = new Date(t); return iso(x) === d ? x.getHours() * 60 + x.getMinutes() : null; };
const blocksOn = d => (S.blocks?.[d] || []).slice().sort((a, b) => toMin(a.from) - toMin(b.from));

// What happened on day d, with clock times where they were saved.
export function actual(d) {
  const timed = [], untimed = [];
  for (const v of VIDS) for (const k of PASSES) {
    const x = prog(v.id)[k]; if (x?.d !== d) continue;
    const m = passMins(v, x), e = x.t ? minOf(x.t, d) : null;
    const it = { label: v.title, sub: PLABEL[k], m, k, id: v.id, kind: k === 'fr' ? 'lectures' : 'revision' };
    if (e != null) timed.push({ ...it, a: Math.max(0, e - m), b: e }); else untimed.push(it);
  }
  for (const s of S.sessions) {
    if (s.d !== d) continue;
    const e = s.t ? minOf(s.t, d) : null, it = { label: KIND[s.kind] || 'Study', sub: 'Focus', m: s.m, sid: s.id, kind: s.kind };
    if (e != null) timed.push({ ...it, a: Math.max(0, e - s.m), b: e }); else untimed.push(it);
  }
  // A timer running right now shows live.
  const now = new Date();
  if (d === iso(now)) {
    const n = now.getHours() * 60 + now.getMinutes();
    if (S.watch?.phase === 'run' && S.watch.first) { const a = minOf(new Date(S.watch.first).toISOString(), d); if (a != null) timed.push({ a, b: Math.max(a + 1, n), label: BY[S.watch.id]?.title || 'Lecture', sub: 'Watching now', live: true, kind: 'lectures' }); }
    if (S.focus?.startedAt) { const a = minOf(new Date(S.focus.startedAt).toISOString(), d); if (a != null) timed.push({ a, b: Math.max(a + 1, n), label: KIND[S.focus.kind] || 'Focus', sub: 'Focus now', live: true, kind: S.focus.kind }); }
  }
  return { timed: timed.sort((x, y) => x.a - y.a), untimed };
}

// Minutes of real study that fell inside planned blocks.
function onPlan(d, act) {
  const plan = new Uint8Array(1440);
  for (const b of blocksOn(d)) for (let i = toMin(b.from); i < Math.min(1440, toMin(b.from) + b.mins); i++) plan[i] = 1;
  const did = new Uint8Array(1440);
  for (const x of act.timed) for (let i = x.a; i < Math.min(1440, x.b); i++) did[i] = 1;
  let n = 0; for (let i = 0; i < 1440; i++) if (plan[i] && did[i]) n++;
  return n;
}

function dayStrip(d) {
  const t = today(), start = addDays(d, -3);
  return `<div class="dv-strip">${Array.from({ length: 7 }, (_, i) => addDays(start, i)).map(x => {
    const p = blocksOn(x).reduce((a, b) => a + b.mins, 0);
    return `<button class="dv-d${x === d ? ' on' : ''}${x === t ? ' today' : ''}" data-act="dv-go" data-d="${x}"><span>${fmtDow(x).split(' ')[0]}</span><b class="num">${+x.slice(8)}</b><i>${p ? mins(p).replace(' min', 'm') : ''}</i></button>`;
  }).join('')}</div>`;
}

function timeline(d) {
  const L = ledger(d), act = actual(d), hl = S.health[d] || {}, du = dutyOn(d), t = today();
  const y = m => (m * PX).toFixed(1), H = (b, a) => Math.max(14, (b - a) * PX).toFixed(1);
  const bands = [
    ...(hl.slp || []).map(([a, b]) => `<div class="dv-band sleep" style="top:${y(a)}px;height:${H(b, a)}px"><span>Sleep ${mins(b - a)}</span></div>`),
    ...du.segs.map(([a, b]) => `<div class="dv-band duty" style="top:${y(a)}px;height:${H(b, a)}px"><span>Duty ${clock(a)}–${clock(b % 1440)}</span></div>`),
  ].join('');
  const planned = blocksOn(d).map(b => { const a = toMin(b.from), e = Math.min(1440, a + b.mins);
    return `<button class="dv-blk plan k-${b.kind}" data-act="dv-edit" data-id="${b.id}" style="top:${y(a)}px;height:${H(e, a)}px"><b>${b.alarm != null ? '⏰ ' : ''}${h(KIND[b.kind] || 'Study')}</b><span>${clock(a)}–${clock(e)}${b.ids?.length ? ` · ${b.ids.length} lecture${b.ids.length > 1 ? 's' : ''}` : ''}${b.note ? ` · ${h(b.note)}` : ''}</span></button>`; }).join('');
  const done = act.timed.map(x => `<button class="dv-blk done k-${x.kind}${x.live ? ' live' : ''}" ${x.live ? '' : x.sid ? `data-act="pd-edit-s" data-id="${x.sid}"` : `data-act="pd-edit-p" data-id="${x.id}" data-k="${x.k}"`} style="top:${y(x.a)}px;height:${H(x.b, x.a)}px"><b>${h(x.label)}</b><span>${x.sub} · ${clock(x.a)}–${clock(x.b)}</span></button>`).join('');
  const nowLine = d === t ? (() => { const n = new Date(); const m = n.getHours() * 60 + n.getMinutes(); return `<div class="dv-now" id="dv-now" style="top:${y(m)}px"><span>${clock(m)}</span></div>`; })() : '';
  const hours = Array.from({ length: 25 }, (_, i) => `<div class="dv-hr" style="top:${y(i * 60)}px"><span>${i === 24 ? '' : clock(i * 60)}</span></div>`).join('');
  return { L, act, html: `<div class="dv-lanes"><span>Planned</span><span>Done</span></div>
    <div class="dv-tl" style="height:${y(1440)}px">${hours}<div class="dv-slots">${Array.from({ length: 24 }, (_, i) => `<button class="dv-slot" data-act="dv-new" data-at="${i * 60}" style="top:${y(i * 60)}px" aria-label="Plan ${clock(i * 60)}"></button>`).join('')}</div>${bands}<div class="dv-lane l">${planned}</div><div class="dv-lane r">${done}</div>${nowLine}</div>` };
}

export function view() {
  const t = today(), d = S.ui.dvDay || t, m = metrics();
  const tl = timeline(d), L = tl.L, act = tl.act;
  const plannedMin = blocksOn(d).reduce((a, b) => a + b.mins, 0);
  const studied = L.study, on = onPlan(d, act);
  const past = d < t, future = d > t;
  const need = d === t ? m.goal : future ? (isRest(d) ? 0 : m.target) + revisionsOn(d).reduce((a, x) => a + x.r.budget, 0) : S.days[d]?.t;
  const lecturesPlanned = (S.plan[d] || []).filter(id => BY[id]);
  return {
    title: d === t ? 'Your day' : fmtDow(d),
    meta: d === t ? fmtDayLong(d) : past ? 'Looking back' : 'Planning ahead',
    html: `${dayStrip(d)}
  <div class="row dv-nav"><button class="btn small-btn" data-act="dv-go" data-d="${addDays(d, -1)}">‹ ${fmtDow(addDays(d, -1)).split(' ')[0]}</button>
    ${d !== t ? `<button class="btn small-btn" data-act="dv-go" data-d="${t}">Today</button>` : ''}<span class="grow"></span>
    <button class="btn small-btn" data-act="dv-go" data-d="${addDays(d, 1)}">${fmtDow(addDays(d, 1)).split(' ')[0]} ›</button></div>
  <section class="card">
    <div class="stats" style="margin:0">
      <div class="stat"><div class="v num">${plannedMin ? mins(plannedMin) : '—'}</div><div class="k">planned study${need ? ` · day needs ${mins(need)}` : ''}</div></div>
      ${future ? `<div class="stat"><div class="v num">${lecturesPlanned.length}</div><div class="k">lecture${lecturesPlanned.length === 1 ? '' : 's'} planned</div></div>`
        : `<div class="stat good"><div class="v num">${mins(studied)}</div><div class="k">studied${plannedMin ? ` · ${Math.round(Math.min(1, studied / plannedMin) * 100)}% of plan` : ''}</div></div>`}
      ${future ? `<div class="stat"><div class="v num">${revisionsOn(d).length}</div><div class="k">revisions due</div></div>`
        : `<div class="stat"><div class="v num">${plannedMin ? `${Math.round((on / Math.max(1, act.timed.reduce((a, x) => a + x.b - x.a, 0))) * 100) || 0}%` : '—'}</div><div class="k">of study at planned times</div></div>`}
    </div>
    ${!future ? `<div class="tl-key num" style="margin-top:12px"><span class="k-sleep">${L.sleepKnown ? `Slept ${mins(L.sleep)}` : 'Sleep not in'}</span><span class="k-duty">Duty ${mins(L.duty)}</span><span class="k-study">Studied ${mins(L.study)}</span>${L.sleepKnown ? `<span class="k-other">Other ${mins(L.other)}</span>` : ''}</div>` : ''}
    ${past && plannedMin && studied < plannedMin * 0.8 ? `<p class="hint">You planned ${mins(plannedMin)} and studied ${mins(studied)}. Look at where the planned blocks sit against what happened: that's usually the lesson.</p>` : ''}
  </section>
  <div class="btns"><button class="btn primary" data-act="dv-new" data-at="${d === t ? Math.ceil((new Date().getHours() * 60 + new Date().getMinutes()) / 30) * 30 : 19 * 60}">+ Plan a block</button>
    <button class="btn" data-act="du-edit" data-d="${d}">${S.duty[d] != null ? '🏥 Duty' : '+ Duty'}</button>
    <button class="btn" data-act="dv-copy" data-d="${d}">Copy ${fmtDow(addDays(d, -1)).split(' ')[0]}’s</button></div>
  <section class="card flush dv-card">${tl.html}</section>
  ${act.untimed.length ? `${sectionH('Logged without a time', 'counted, not drawn')}<ul class="card flush list">${act.untimed.map(x => `<li class="item"><span class="rbadge" style="--h:${x.kind === 'lectures' ? 160 : 260}">${x.k ? (x.k === 'fr' ? 'FW' : x.k.toUpperCase()) : 'F'}</span><div class="grow"><div class="t">${h(x.label)}</div><div class="s">${x.sub} · ${mins(x.m)}</div></div><button class="btn small-btn" ${x.sid ? `data-act="pd-edit-s" data-id="${x.sid}"` : `data-act="pd-edit-p" data-id="${x.id}" data-k="${x.k}"`}>Edit</button></li>`).join('')}</ul>` : ''}
  <p class="hint center" style="margin-top:12px">Tap an empty hour to plan it. Lectures and revisions you time with <b>Study now</b>, and Focus sessions, appear in “Done” at the real times.</p>`,
  };
}

/* ---------- planning blocks ---------- */
let ed = null;
function sheet() {
  const b = ed.b, d = ed.d, lectures = (S.plan[d] || []).filter(id => BY[id] && !prog(id).fr);
  return `<h3>${ed.isNew ? 'Plan a study block' : 'Study block'}</h3><div class="sub">${fmtDayLong(d)}</div>
    <div class="field"><span class="lbl">What</span><div class="chips">${Object.entries(KIND).map(([k, l]) => `<button class="chip" data-act="dv-kind" data-v="${k}" aria-pressed="${b.kind === k}">${l}</button>`).join('')}</div></div>
    <div class="field"><label for="dv-from">Starts</label><input id="dv-from" type="time" value="${b.from}"></div>
    <div class="field"><span class="lbl">How long</span><div class="chips">${[30, 45, 60, 90, 120, 180, 240].map(n => `<button class="chip" data-act="dv-len" data-v="${n}" aria-pressed="${b.mins === n}">${mins(n)}</button>`).join('')}</div></div>
    ${b.kind === 'lectures' && lectures.length ? `<div class="field"><span class="lbl">Lectures planned for this day</span><div class="chips">${lectures.map(id => `<button class="chip" data-act="dv-lec" data-v="${id}" aria-pressed="${(b.ids || []).includes(id)}">${h(BY[id].title)}</button>`).join('')}</div></div>` : ''}
    <div class="field"><span class="lbl">Alarm</span><div class="chips">${[[null, 'None'], [0, 'At start'], [5, '5 min before'], [10, '10 min'], [15, '15 min'], [30, '30 min']].map(([v, l]) => `<button class="chip" data-act="dv-alarm" data-v="${v ?? ''}" aria-pressed="${(b.alarm ?? null) === v}">${l}</button>`).join('')}</div>
      ${b.alarm != null ? '<p class="hint">Your Shortcut puts it in the Clock app as a real alarm (Settings → Apple Health & alarms).</p>' : ''}</div>
    <div class="field"><label for="dv-note">Note (optional)</label><input id="dv-note" class="inp" value="${h(b.note || '')}" placeholder="e.g. library, after duty"></div>
    ${ed.err ? `<p class="small bad-t" style="margin:0 0 10px">${h(ed.err)}</p>` : ''}
    <button class="btn primary block" data-act="dv-save">${ed.isNew ? 'Add to the day' : 'Save'}</button>
    ${ed.isNew ? '' : `<div class="btns" style="margin-top:8px">${ed.d === today() ? '<button class="btn" data-act="dv-start">Start now</button>' : ''}<button class="btn danger" data-act="dv-del">Remove</button></div>`}`;
}
const keep = () => { ed.b.from = document.getElementById('dv-from')?.value || ed.b.from; ed.b.note = document.getElementById('dv-note')?.value ?? ed.b.note; };
const overlaps = (d, b) => blocksOn(d).find(x => x.id !== b.id && toMin(x.from) < toMin(b.from) + b.mins && toMin(b.from) < toMin(x.from) + x.mins);

export const actions = {
  day: el => { closeSheet(); if (S.ui.tab !== 'day') S.ui.dayBack = S.ui.tab; S.ui.tab = 'day'; S.ui.dvDay = el?.dataset?.d || today(); return () => setTimeout(scrollToFocus, 30); },
  'dv-go': el => { S.ui.dvDay = el.dataset.d; return () => setTimeout(scrollToFocus, 30); },
  'dv-new': el => { const at = Math.min(1410, +el.dataset.at || 19 * 60); ed = { isNew: true, d: S.ui.dvDay || today(), b: { id: uid(), from: hhmm(at), mins: 60, kind: 'lectures', ids: [] } }; openSheet(sheet); },
  'dv-edit': el => { const d = S.ui.dvDay || today(); ed = { d, b: JSON.parse(JSON.stringify(blocksOn(d).find(x => x.id === el.dataset.id))) }; openSheet(sheet); },
  'dv-kind': el => { keep(); ed.b.kind = el.dataset.v; },
  'dv-len': el => { keep(); ed.b.mins = +el.dataset.v; },
  'dv-alarm': el => { keep(); if (el.dataset.v === '') delete ed.b.alarm; else ed.b.alarm = +el.dataset.v; },
  'dv-lec': el => { keep(); const s = new Set(ed.b.ids || []); s.has(el.dataset.v) ? s.delete(el.dataset.v) : s.add(el.dataset.v); ed.b.ids = [...s]; },
  'dv-save': () => {
    keep();
    ed.err = '';
    if (!/^\d{2}:\d{2}$/.test(ed.b.from)) { ed.err = 'Pick a start time.'; return; }
    if (toMin(ed.b.from) + ed.b.mins > 1440) { ed.err = 'That runs past midnight: plan the rest on the next day.'; return; }
    const clash = overlaps(ed.d, ed.b);
    if (clash) { ed.err = `Overlaps your ${KIND[clash.kind]} block at ${clock(toMin(clash.from))}–${clock(toMin(clash.from) + clash.mins)}. Pick another time or length.`; return; }
    const list = (S.blocks ||= {})[ed.d] = (S.blocks[ed.d] || []).filter(x => x.id !== ed.b.id);
    list.push(ed.b); save(); closeSheet();
    toast(`${KIND[ed.b.kind]} ${clock(toMin(ed.b.from))}–${clock(toMin(ed.b.from) + ed.b.mins)} planned`);
  },
  'dv-del': () => {
    const d = ed.d, was = S.blocks[d];
    S.blocks[d] = was.filter(x => x.id !== ed.b.id); if (!S.blocks[d].length) delete S.blocks[d];
    save(); closeSheet(); toast('Block removed', () => { S.blocks[d] = was; save(); });
  },
  'dv-start': () => {
    const b = ed.b; closeSheet();
    const id = (b.ids || []).find(x => !prog(x).fr);
    if (b.kind === 'lectures' && id) { startLecture(id); return; }
    import('./focus.js').then(f => f.openFocus());
  },
  'dv-copy': el => {
    const d = el.dataset.d, from = addDays(d, -1), src = blocksOn(from);
    if (!src.length) { toast(`Nothing planned on ${fmtDow(from)}`); return; }
    const was = S.blocks?.[d];
    const mine = blocksOn(d), add = src.map(b => ({ ...b, id: uid(), ids: [] })).filter(b => !mine.some(x => toMin(x.from) < toMin(b.from) + b.mins && toMin(b.from) < toMin(x.from) + x.mins));
    if (!add.length) { toast('Those times are already planned'); return; }
    (S.blocks ||= {})[d] = [...mine, ...add]; save();
    toast(`Copied ${add.length} block${add.length > 1 ? 's' : ''} from ${fmtDow(from)}`, () => { if (was) S.blocks[d] = was; else delete S.blocks[d]; save(); });
  },
};
function startLecture(id) {
  const btn = document.createElement('button'); btn.dataset.act = 'study-now'; btn.dataset.id = id; btn.hidden = true;
  document.body.append(btn); btn.click(); btn.remove();
}
function scrollToFocus() {
  const d = S.ui.dvDay || today(), now = document.getElementById('dv-now');
  const first = document.querySelector('.dv-blk');
  const target = now || first;
  if (!target) { const tl = document.querySelector('.dv-tl'); if (tl) window.scrollTo({ top: tl.getBoundingClientRect().top + scrollY + 7 * 60 * PX - 120 }); return; }
  window.scrollTo({ top: target.getBoundingClientRect().top + scrollY - 220, behavior: 'auto' });
}

export function todayCard() {
  const t = today(), b = blocksOn(t), n = new Date(), nowM = n.getHours() * 60 + n.getMinutes();
  const next = b.find(x => toMin(x.from) + x.mins > nowM);
  const total = b.reduce((a, x) => a + x.mins, 0);
  return `<button class="card tomorrow" data-act="day"><span class="rbadge" style="--h:190">🗓</span>
    <span class="grow"><span class="t">Your day</span><span class="s">${next ? `${toMin(next.from) <= nowM ? 'Now' : `Next at ${clock(toMin(next.from))}`}: ${h(KIND[next.kind])} for ${mins(next.mins)}` : total ? `${mins(total)} planned today, all past` : 'Plan today’s study hours on a timeline'}</span></span><span class="faint">›</span></button>`;
}
