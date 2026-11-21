// Duty hours: enter each day's hospital duty for the next two weeks and see the free time
// you'll have against what that day needs (new videos + revisions due). It only informs:
// your targets and plan stay as they are. Move lectures yourself in the planner.
import { S, metrics, today, addDays, isRest, revisionsOn, revisionsDue, freeMinutes, save, h, mins, hrs, fmtDow, fmtDay } from '../core.js';
import { sectionH, closeSheet } from '../ui.js';

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
  return {
    title: 'Duty & free time',
    meta: 'Next two weeks',
    html: `
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
        ${r.duty != null && !CHIPS.includes(r.duty) ? `<button class="chip" aria-pressed="true" data-act="duty" data-d="${r.d}" data-v="${r.duty}">${r.duty}h</button>` : ''}
        <button class="chip" data-act="duty-other" data-d="${r.d}">Other…</button>
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
  'duty-other': el => {
    const v = prompt('Duty hours that day (0–24):', S.duty[el.dataset.d] ?? '');
    if (v == null) return;
    const n = Math.round(+v * 2) / 2;
    if (!(n >= 0 && n <= 24)) { alert('Enter hours between 0 and 24'); return; }
    S.duty[el.dataset.d] = n; save();
  },
};

export function onChange(e) {
  const k = e.target.dataset?.dutySet; if (!k) return false;
  const n = +e.target.value; if (!(n >= 0 && n <= 24)) return false;
  S.settings[k] = n; save(); return true;
}
