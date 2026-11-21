// Duty hours: enter each day's hospital duty for the next two weeks and see the free time
// you'll have against what that day needs (new videos + revisions due). It only informs:
// your targets and plan stay as they are. Move lectures yourself in the planner.
import { S, VIDS, PASSES, metrics, today, addDays, isRest, revisionsOn, revisionsDue, freeMinutes, dutyOn, dutyHours, shiftMins, passMins, iso, save, h, mins, hrs, fmtDow, fmtDay } from '../core.js';
import { sectionH, openSheet, closeSheet, toast } from '../ui.js';

/* ---------- where the day went: sleep, duty, study, everything else ---------- */
const minOfDay = (isoTime, d) => { const t = new Date(isoTime); return iso(t) === d ? t.getHours() * 60 + t.getMinutes() : null; };
// Study blocks with a clock time: each logged lecture, revision or focus session ends at its
// saved time and lasts its real minutes. Ones without a time still count in the total.
function studyOn(d) {
  const blocks = []; let total = 0;
  for (const v of VIDS) for (const k of PASSES) { const x = S.progress[v.id]?.[k]; if (x?.d === d) { const m = passMins(v, x); total += m; const e = x.t ? minOfDay(x.t, d) : null; if (e != null) blocks.push([Math.max(0, e - m), e]); } }
  for (const x of S.sessions) if (x.d === d) { total += x.m; const e = x.t ? minOfDay(x.t, d) : null; if (e != null) blocks.push([Math.max(0, e - x.m), e]); }
  return { blocks, total };
}
export function ledger(d, now = new Date()) {
  const upTo = d === iso(now) ? now.getHours() * 60 + now.getMinutes() : d > iso(now) ? 0 : 1440;
  const hl = S.health[d] || {}, du = dutyOn(d), st = studyOn(d);
  const slot = new Uint8Array(1440); // 0 other, 1 sleep, 2 duty, 3 study
  const paint = (segs, c) => { for (const [a, b] of segs) for (let i = Math.max(0, a); i < Math.min(upTo, b); i++) if (!slot[i]) slot[i] = c; };
  // Study is drawn before duty, so studying on a quiet shift shows (and counts) as study.
  paint(hl.slp || [], 1); paint(st.blocks, 3); paint(du.segs, 2);
  const placed = [0, 0, 0, 0]; for (let i = 0; i < upTo; i++) placed[slot[i]]++;
  // Totals with no clock times can't be drawn but still count: sleep from the check-in, duty
  // entered as hours, study without a saved time. Everything is capped so the day adds up.
  const sleep = hl.slp ? placed[1] : Math.min(upTo, hl.sleep != null ? Math.round(hl.sleep * 60) : 0);
  const study = Math.min(upTo - sleep, st.total);
  const dutyNet = Math.min(upTo - sleep - study, placed[2] + du.untimed);
  const other = Math.max(0, upTo - sleep - dutyNet - study);
  return { d, upTo, slot, sleep, duty: dutyNet, study, other, free: Math.max(0, upTo - sleep - dutyNet), sleepKnown: hl.sleep != null, timedSleep: !!hl.slp, dutyEntered: du.entered, dutyUntimed: du.untimed > 0 };
}
function bar(L) {
  // Runs of the same kind → one rectangle each.
  const COL = ['other', 'sleep', 'duty', 'study'], out = [];
  for (let i = 0; i < L.upTo;) { let j = i; while (j < L.upTo && L.slot[j] === L.slot[i]) j++; out.push(`<i class="tl-${COL[L.slot[i]]}" style="left:${(i / 14.4).toFixed(2)}%;width:${((j - i) / 14.4).toFixed(2)}%"></i>`); i = j; }
  return `<div class="tl">${out.join('')}${L.upTo < 1440 ? `<b class="tl-now" style="left:${(L.upTo / 14.4).toFixed(2)}%"></b>` : ''}</div>
    <div class="tl-ticks"><span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>12a</span></div>`;
}
const dutyLabel = x => x == null ? '' : typeof x === 'number' ? (x ? `${x}h` : 'Off') : `${x.from}–${x.to}${shiftMins(x) + +x.from.slice(0, 2) * 60 + +x.from.slice(3) > 1440 ? ' (next day)' : ''}`;
function pastRow(L, t) {
  const x = S.duty[L.d], ess = (S.settings.essentials ?? 3) * 60 * (L.upTo / 1440);
  return `<li class="duty-row past">
    <div class="row"><div class="grow"><div class="t">${L.d === t ? `Today <span class="faint small">so far</span>` : L.d === addDays(t, -1) ? `Yesterday <span class="faint small">${fmtDay(L.d)}</span>` : fmtDow(L.d)}</div></div>
      <button class="chip" data-act="du-edit" data-d="${L.d}">${x != null ? `Duty ${h(dutyLabel(x))}` : 'Add duty'}</button></div>
    ${bar(L)}
    <div class="tl-key num"><span class="k-sleep">${L.sleepKnown ? `Slept ${mins(L.sleep)}` : '<span class="faint">Sleep not in yet</span>'}</span><span class="k-duty">Duty ${mins(L.duty)}</span><span class="k-study">Studied ${mins(L.study)}</span>${L.sleepKnown ? `<span class="k-other">Other ${mins(L.other)}</span>` : ''}</div>
    ${L.sleepKnown || L.dutyEntered ? `<p class="small muted" style="margin:6px 0 0">Free (not asleep, not on duty): <b>${mins(L.free)}</b>. You studied <b>${mins(L.study)}</b> of it; <b>${mins(L.other)}</b> went elsewhere${L.other > ess + 30 ? `, ${mins(L.other - ess)} more than your ${mins(ess)} for meals, travel and rest` : ''}.</p>` : ''}
  </li>`;
}

const PRESETS = [['09:00', '21:00', '9a–9p'], ['08:00', '16:00', '8a–4p'], ['08:00', '14:00', '8a–2p'], ['21:00', '09:00', 'Night 9p–9a'], ['08:00', '08:00', '24h from 8a']];
let edit = null, dAlarm = null;
const ALARMS = [[null, 'None'], [0, 'At start'], [30, '30 min before'], [60, '1 hour'], [90, '1½ hours'], [120, '2 hours']];
function editSheet() {
  const x = S.duty[edit], tm = x && typeof x === 'object' ? x : { from: '09:00', to: '21:00' };
  return `<h3>Duty · ${fmtDow(edit)}</h3><div class="sub">Times place it on the day's timeline; a shift that ends before it starts runs into the next day.</div>
    <div class="field"><span class="lbl">Wake-up alarm before the shift</span><div class="chips">${ALARMS.map(([v, l]) => `<button class="chip" data-act="du-alarm" data-v="${v ?? ''}" aria-pressed="${dAlarm === v}">${l}</button>`).join('')}</div>
      <p class="hint">A real alarm in the Clock app, so it rings even if you're asleep at an odd hour. Your Shortcut creates it (Settings → Apple Health & alarms). Applies to shifts with times.</p></div>
    <div class="field"><span class="lbl">Quick</span><div class="chips">${PRESETS.map(([a, b, l]) => `<button class="chip" data-act="du-preset" data-a="${a}" data-b="${b}" aria-pressed="${x?.from === a && x?.to === b}">${l}</button>`).join('')}</div></div>
    <div class="field"><span class="lbl">Shift times</span><div class="row" style="gap:8px"><input id="du-from" class="inp num" type="time" value="${tm.from}"><span class="muted">to</span><input id="du-to" class="inp num" type="time" value="${tm.to}"></div>
      <button class="btn primary block" data-act="du-save" style="margin-top:10px">Save times</button></div>

    <div class="field"><span class="lbl">Or just hours</span><div class="chips">${CHIPS.map(c => `<button class="chip" data-act="du-hours" data-v="${c}" aria-pressed="${x === c}">${c === 0 ? 'Off' : `${c}h`}</button>`).join('')}<button class="chip" data-act="duty-other" data-d="${edit}">Other…</button></div></div>
    ${x != null ? '<button class="btn ghost danger block" data-act="du-clear">Clear this day</button>' : ''}`;
}

const CHIPS = [0, 4, 6, 8, 10, 12, 24];

function needOn(m, d) {
  // Today: what's still due plus what you've already revised today (the whole day's need).
  const rev = d === m.t ? m.dueMins + m.revDoneToday : revisionsOn(d).reduce((a, x) => a + x.r.budget, 0);
  const fresh = isRest(d) ? 0 : m.target;
  return { rev, fresh, total: rev + fresh };
}

export function view() {
  const m = metrics(), st = S.settings, t = m.t;
  const days = Array.from({ length: 14 }, (_, i) => addDays(t, i));
  const rows = days.map(d => ({ d, duty: S.duty[d], free: freeMinutes(d), need: needOn(m, d) }));
  const wk = rows.slice(0, 7), entered = wk.filter(r => r.free != null);
  const freeWk = entered.reduce((a, r) => a + r.free, 0), needWk = entered.reduce((a, r) => a + r.need.total, 0);
  const short = rows.filter(r => r.free != null && r.need.total > r.free + 5);
  const now = new Date(), past = Array.from({ length: 7 }, (_, i) => ledger(addDays(t, -i), now));
  const sum = k => past.reduce((a, L) => a + L[k], 0);
  const known = past.filter(L => L.sleepKnown);
  return {
    title: 'Duty & free time',
    meta: 'Where your time goes',
    html: `
  ${sectionH('Last 7 days', 'sleep · duty · study · other')}
  <section class="card">
    <div class="stats" style="margin:0 0 4px">
      <div class="stat"><div class="v num">${known.length ? mins(known.reduce((a, L) => a + L.sleep, 0) / known.length) : '—'}</div><div class="k">sleep a day${known.length && known.length < 7 ? ` (${known.length} day${known.length > 1 ? 's' : ''} known)` : ''}</div></div>
      <div class="stat"><div class="v num">${hrs(sum('duty'))}</div><div class="k">duty</div></div>
      <div class="stat good"><div class="v num">${hrs(sum('study'))}</div><div class="k">studied</div></div>
      <div class="stat warn"><div class="v num">${known.length ? hrs(known.reduce((a, L) => a + L.other, 0)) : '—'}</div><div class="k">other: awake, off duty, not studying${known.length && known.length < 7 ? ` (days with sleep known)` : ''}</div></div>
    </div>
    <p class="hint">Sleep comes from Apple Health (Settings → Apple Health) or your morning check-in; duty from what you enter; study from the lectures, revisions and focus sessions you log. "Other" is everything else: meals, travel, rest, phone.</p>
  </section>
  <ul class="card flush list duty-list">${past.map(L => pastRow(L, t)).join('')}</ul>

  ${sectionH('Next two weeks', 'free time vs what each day needs')}
  <section class="card">
    <p class="small" style="margin:0 0 10px">Enter each day's hospital duty. Free time = <b>${st.awake ?? 16}h awake</b> − duty − <b>${st.essentials ?? 3}h</b> for meals, travel and rest.</p>
    <div class="row duty-set"><label class="grow small" for="du-awake">Hours awake</label><input id="du-awake" class="inp num" type="number" inputmode="numeric" min="8" max="20" value="${st.awake ?? 16}" data-duty-set="awake"></div>
    <div class="row duty-set"><label class="grow small" for="du-ess">Meals, travel, rest</label><input id="du-ess" class="inp num" type="number" inputmode="numeric" min="0" max="8" value="${st.essentials ?? 3}" data-duty-set="essentials"></div>
    ${entered.length ? `<div class="stats" style="margin:12px 0 0">
      <div class="stat"><div class="v num">${hrs(freeWk)}</div><div class="k">free this week (${entered.length} day${entered.length > 1 ? 's' : ''} entered)</div></div>
      <div class="stat ${needWk > freeWk ? 'warn' : 'good'}"><div class="v num">${hrs(needWk)}</div><div class="k">those days need</div></div>
    </div>
    <p class="hint">${needWk > freeWk + 5 ? `${hrs(needWk - freeWk)} short on the days you entered. Put fewer lectures on duty days and more on free ones (Plan the week), or it becomes backlog.` : 'Your free time covers what those days need.'} Your targets don't change here.</p>` : '<p class="hint">Nothing entered yet. Your targets don\'t change here; this only shows where time is tight.</p>'}
  </section>

  ${sectionH('Day by day', short.length ? `<span class="bad-t">${short.length} day${short.length > 1 ? 's' : ''} short</span>` : '')}
  <ul class="card flush list duty-list">${rows.map(r => {
    const over = r.free != null && r.need.total > r.free + 5;
    const frac = r.free != null && r.need.total ? Math.min(1, r.free / r.need.total) : 1;
    return `<li class="duty-row${over ? ' over' : ''}">
      <div class="row"><div class="grow"><div class="t">${r.d === t ? `Today <span class="faint small">${fmtDay(r.d)}</span>` : r.d === addDays(t, 1) ? `Tomorrow <span class="faint small">${fmtDay(r.d)}</span>` : fmtDow(r.d)}${isRest(r.d) ? ' <span class="pill">rest day</span>' : ''}</div>
        <div class="s small muted num">Needs ${mins(r.need.total)}${r.need.rev ? ` (${mins(r.need.fresh)} new + ${mins(r.need.rev)} revisions)` : ''}${r.free != null ? ` · <b class="${over ? 'bad-t' : 'good-t'}">${mins(r.free)} free</b>${over ? ` · ${mins(r.need.total - r.free)} short` : ''}` : ''}</div></div></div>
      ${r.free != null ? `<div class="bar-line duty-bar"><i style="width:${frac * 100}%"></i></div>` : ''}
      <div class="chips scroll-x duty-chips">${CHIPS.map(c => `<button class="chip" data-act="duty" data-d="${r.d}" data-v="${c}" aria-pressed="${r.duty === c}">${c === 0 ? 'Off' : `${c}h`}</button>`).join('')}
        ${typeof r.duty === 'number' && !CHIPS.includes(r.duty) ? `<button class="chip" aria-pressed="true" data-act="duty" data-d="${r.d}" data-v="${r.duty}">${r.duty}h</button>` : ''}
        <button class="chip" data-act="du-edit" data-d="${r.d}" aria-pressed="${r.duty != null && typeof r.duty === 'object'}">${r.duty != null && typeof r.duty === 'object' ? h(dutyLabel(r.duty)) : 'Times / other…'}</button>
        ${r.duty != null ? `<button class="chip" data-act="duty-clear" data-d="${r.d}">Clear</button>` : ''}</div>
    </li>`;
  }).join('')}</ul>
  <div class="btns" style="margin-top:4px"><button class="btn primary" data-act="plan-week">Plan the week</button></div>`,
  };
}

export const actions = {
  'duty-open': () => { closeSheet(); S.ui.dutyBack = S.ui.tab === 'duty' ? S.ui.dutyBack : S.ui.tab; S.ui.tab = 'duty'; return 'enter'; },
  duty: el => { S.duty[el.dataset.d] = +el.dataset.v; save(); },
  'duty-clear': el => { delete S.duty[el.dataset.d]; save(); },
  'du-edit': el => { edit = el.dataset.d; const x = S.duty[edit]; dAlarm = x && typeof x === 'object' ? (x.alarm ?? null) : (S.settings.dutyAlarm ?? 60); openSheet(editSheet); },
  'du-alarm': el => { dAlarm = el.dataset.v === '' ? null : +el.dataset.v; const x = S.duty[edit]; if (x && typeof x === 'object') { if (dAlarm == null) delete x.alarm; else x.alarm = dAlarm; save(); } S.settings.dutyAlarm = dAlarm; },
  'du-preset': el => { S.duty[edit] = { from: el.dataset.a, to: el.dataset.b, ...(dAlarm != null ? { alarm: dAlarm } : {}) }; save(); closeSheet(); toast(`Duty ${fmtDow(edit)}: ${dutyLabel(S.duty[edit])}`); },
  'du-save': () => {
    const a = document.getElementById('du-from').value, b = document.getElementById('du-to').value;
    if (!/^\d{2}:\d{2}$/.test(a) || !/^\d{2}:\d{2}$/.test(b)) { toast('Pick both times'); return; }
    S.duty[edit] = { from: a, to: b, ...(dAlarm != null ? { alarm: dAlarm } : {}) }; save(); closeSheet(); toast(`Duty ${fmtDow(edit)}: ${dutyLabel(S.duty[edit])} · ${mins(shiftMins(S.duty[edit]))}`);
  },
  'du-hours': el => { S.duty[edit] = +el.dataset.v; save(); closeSheet(); },
  'du-clear': () => { delete S.duty[edit]; save(); closeSheet(); },
  'duty-other': el => {
    const v = prompt('Duty hours that day (0–24):', S.duty[el.dataset.d] ?? '');
    if (v == null) return;
    const n = Math.round(+v * 2) / 2;
    if (!(n >= 0 && n <= 24)) { alert('Enter hours between 0 and 24'); return; }
    S.duty[el.dataset.d] = n; save(); closeSheet();
  },
};

export function onChange(e) {
  const k = e.target.dataset?.dutySet; if (!k) return false;
  const n = +e.target.value; if (!(n >= 0 && n <= 24)) return false;
  S.settings[k] = n; save(); return true;
}
