// Plan a whole week: see every day against what it needs, and fill the empty ones in one go.
import { S, VIDS, BY, SUBJECTS, prog, save, metrics, today, addDays, weekStart, isRest, h, mins, fmtDow, subjDot } from '../core.js';
import { openSheet, closeSheet, toast } from '../ui.js';
import { openPlanner } from './planner.js';

let ctx = null; // { start, mode }
// "Heavy" subjects have the most runtime; the rest are "light".
const runtime = s => VIDS.filter(v => v.subject === s).reduce((a, v) => a + v.mins, 0);
const HEAVY = SUBJECTS.filter(s => runtime(s) >= 12 * 60);

function body() {
  const m = metrics(), t = m.t;
  const days = Array.from({ length: 7 }, (_, i) => addDays(ctx.start, i));
  const rows = days.map(d => {
    const ids = (S.plan[d] || []).filter(id => BY[id]);
    const real = ids.reduce((a, id) => a + (prog(id).fr ? 0 : BY[id].mins / m.planSpeed), 0);
    const need = isRest(d) ? 0 : m.target, past = d < t;
    const subj = [...new Set(ids.map(id => BY[id].subject))];
    return `<li><button class="wk-day${past ? ' past' : ''}" data-act="wk-open" data-v="${d}" ${past ? 'disabled' : ''}>
      <span class="wk-l"><b>${d === t ? 'Today' : fmtDow(d)}</b>${isRest(d) ? '<span class="pill">rest</span>' : ''}</span>
      <span class="wk-m"><span class="bar-line"><i style="width:${need ? Math.min(100, (real / need) * 100) : real ? 100 : 0}%"></i></span>
        <span class="small muted num">${ids.length ? `${mins(real)} · ${subj.map(s => `${subjDot(s)}${h(s)}`).join(' ')}` : past ? '' : need ? `Empty · needs ${mins(need)}` : 'Rest'}</span></span>
    </button></li>`;
  }).join('');
  const label = ctx.start === weekStart(t) ? 'This week' : 'Next week';
  return `<h3>Plan the week</h3><div class="sub">Tap a day to pick its lectures, or fill every empty day at once.</div>
    <div class="seg" style="margin-bottom:12px">${[[weekStart(t), 'This week'], [addDays(weekStart(t), 7), 'Next week']].map(([v, l]) => `<button data-act="wk-week" data-v="${v}" aria-pressed="${v === ctx.start}">${l}</button>`).join('')}</div>
    <ul class="list wk-list">${rows}</ul>
    <div class="field"><span class="lbl">Fill empty days with</span><div class="seg">${[['order', 'Sheet order'], ['mix', 'Heavy + light']].map(([v, l]) => `<button data-act="wk-mode" data-v="${v}" aria-pressed="${ctx.mode === v}">${l}</button>`).join('')}</div>
      <p class="hint">${ctx.mode === 'mix' ? `Each day pairs a big subject (${HEAVY.slice(0, 3).join(', ')}…) with a lighter one, so no day is all one heavy subject.` : 'Continues from where you are in your sheet.'}</p></div>
    <div class="btns"><button class="btn primary" data-act="wk-fill">Fill ${label.toLowerCase()}</button><button class="btn danger" data-act="wk-clear">Clear</button></div>`;
}

export function openWeek(start) { ctx = { start: start || weekStart(today()), mode: S.ui.weekMode || 'mix' }; openSheet(body); }

function fill() {
  const m = metrics(), t = m.t, target = m.target || 120;
  const taken = new Set(Object.values(S.plan).flat());
  const pool = VIDS.filter(v => !prog(v.id).fr && !taken.has(v.id));
  const take = pred => { const i = pool.findIndex(pred); return i < 0 ? null : pool.splice(i, 1)[0]; };
  // Heavy + light: keep going with the current heavy and light subject until each runs out.
  let heavyS = null, lightS = null, n = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(ctx.start, i);
    if (d < t || isRest(d) || (S.plan[d] || []).length) continue;
    const ids = []; let real = 0;
    const add = v => { ids.push(v.id); real += v.mins / m.planSpeed; };
    if (ctx.mode === 'mix') {
      // About 60% of the day from the current heavy subject, the rest from the current light one.
      for (const [isHeavy, share] of [[true, 0.6], [false, 1]]) {
        let addedHere = 0;
        while (real < target * share) {
          const cur = isHeavy ? heavyS : lightS;
          let v = cur && take(x => x.subject === cur);
          if (!v) { v = take(x => HEAVY.includes(x.subject) === isHeavy); if (v) { if (isHeavy) heavyS = v.subject; else lightS = v.subject; } }
          if (!v) break;
          const r = v.mins / m.planSpeed;
          // Don't let one part crowd out the other; always allow at least one light video.
          const limit = isHeavy ? target * share : addedHere ? target * 1.15 : target * 1.4;
          if (ids.length && real + r > limit) { pool.unshift(v); break; }
          add(v); addedHere++;
        }
      }
    } else {
      while (pool.length) { const v = pool[0], r = v.mins / m.planSpeed; if (ids.length && real + r > target * 1.15) break; pool.shift(); add(v); if (real >= target) break; }
    }
    if (ids.length) { S.plan[d] = ids; n++; }
  }
  return n;
}

export const actions = {
  'plan-week': el => openWeek(el.dataset.v),
  'wk-week': el => { ctx.start = el.dataset.v; },
  'wk-mode': el => { ctx.mode = el.dataset.v; S.ui.weekMode = ctx.mode; },
  'wk-open': el => openPlanner(el.dataset.v),
  'wk-fill': () => { const was = JSON.parse(JSON.stringify(S.plan)); const n = fill(); save(); toast(n ? `Planned ${n} day${n > 1 ? 's' : ''}` : 'No empty study days left this week', n ? () => { S.plan = was; save(); } : null); },
  'wk-clear': () => {
    const was = JSON.parse(JSON.stringify(S.plan)), t = today();
    for (let i = 0; i < 7; i++) { const d = addDays(ctx.start, i); if (d >= t) delete S.plan[d]; }
    save(); toast('Week cleared', () => { S.plan = was; save(); });
  },
};
