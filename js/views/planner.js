// Plan a day: pick the lectures you'll watch, against the time that day needs.
import {
  S, VIDS, BY, SUBJECTS, prog, save, metrics, today, addDays, isRest, revInfo, plannedOn,
  h, mins, sp, fmtDay, fmtDow, fmtDayLong, subjDot, subjHue, ankiQuery, vTags,
} from '../core.js';
import { openSheet, closeSheet, toast, ICON } from '../ui.js';

let ctx = null; // { date, subject, q }

function needed(m, d) {
  // New-video time is the same every study day; revisions depend on what's due that day.
  const rev = VIDS.map(v => revInfo(v, m.t)).filter(r => r?.k && (d === m.t ? r.due <= d : r.due === d));
  return { newMins: isRest(d) ? 0 : m.target, revMins: rev.reduce((a, r) => a + r.budget, 0), revN: rev.length };
}

function candidates(m) {
  const q = ctx.q.trim().toLowerCase();
  const mine = new Set(S.plan[ctx.date] || []);
  let vs = VIDS.filter(v => !prog(v.id).fr && !mine.has(v.id));
  if (q) vs = vs.filter(v => (v.title + ' ' + v.subject + ' ' + v.notes).toLowerCase().includes(q));
  else if (ctx.subject) vs = vs.filter(v => v.subject === ctx.subject);
  else vs = vs.slice(0, 12);
  return vs.slice(0, 60).map(v => {
    const other = plannedOn(v.id);
    return `<li class="item pick"><button class="addbtn" data-act="pl-add" data-id="${v.id}" aria-label="Add">${ICON.plus}</button>
      <button class="open" data-act="pl-add" data-id="${v.id}"><div class="t">${h(v.title)}</div>
      <div class="s num">${subjDot(v.subject)}${h(v.subject)} · ${mins(v.mins / m.planSpeed)} at ${sp(m.planSpeed)}${other ? ` · <span class="warn-t">planned ${fmtDow(other)}</span>` : ''}</div></button></li>`;
  }).join('') || `<li class="empty small">${q ? 'No unwatched videos match.' : 'Everything here is watched or planned.'}</li>`;
}

function body() {
  const m = metrics(), d = ctx.date;
  const ids = (S.plan[d] || []).filter(id => BY[id]);
  const real = ids.reduce((a, id) => a + (prog(id).fr ? 0 : BY[id].mins / m.planSpeed), 0);
  const need = needed(m, d);
  const target = need.newMins;
  const frac = target ? Math.min(1, real / target) : real ? 1 : 0;
  const diff = real - target;
  const days = Array.from({ length: 8 }, (_, i) => addDays(m.t, i));
  const label = x => x === m.t ? 'Today' : x === addDays(m.t, 1) ? 'Tomorrow' : fmtDow(x);
  const recent = [...new Set(ids.map(id => BY[id].subject))];
  const subjects = [...recent, ...SUBJECTS.filter(s => !recent.includes(s))];
  return `<h3>Plan ${label(d) === 'Today' ? 'today' : label(d) === 'Tomorrow' ? 'tomorrow' : fmtDayLong(d)}</h3>
    <div class="sub">${isRest(d) ? 'This is a rest day, but you can still plan something.' : `Pick the lectures you'll watch. Revisions due that day are added on top.`}</div>
    <div class="chips scroll-x">${days.map(x => `<button class="chip" data-act="pl-day" data-v="${x}" aria-pressed="${x === d}">${label(x)}${(S.plan[x] || []).length ? ' •' : ''}</button>`).join('')}</div>

    <div class="plan-meter">
      <div class="row"><div class="grow"><div class="pm-big num">${mins(real)} <span class="faint">/ ${mins(target)}</span></div>
        <div class="small ${diff >= 0 ? 'good-t' : 'muted'}">${!target ? 'No new-video target on a rest day' : diff >= -1 ? (diff > 15 ? `${mins(diff)} over the day's need` : 'Covers what the day needs') : `${mins(-diff)} more to cover the day`}</div></div>
        ${need.revN ? `<div class="pm-rev"><b class="num">${mins(need.revMins)}</b><span>${need.revN} revision${need.revN > 1 ? 's' : ''}</span></div>` : ''}</div>
      <div class="bar-line"><i style="width:${frac * 100}%"></i></div>
    </div>

    ${ids.length ? `<ul class="list plan-list">${ids.map((id, i) => {
      const v = BY[id], done = !!prog(id).fr;
      return `<li class="item${done ? ' done' : ''}"><span class="pl-n num">${i + 1}</span>
        <div class="grow"><div class="t">${h(v.title)}</div><div class="s num">${subjDot(v.subject)}${done ? `<span class="stamp">✓ Watched ${fmtDow(prog(id).fr.d)}</span>` : `${mins(v.mins / m.planSpeed)} · ${h(v.subject)}`}</div></div>
        ${i > 0 ? `<button class="icon-mini" data-act="pl-up" data-id="${id}" aria-label="Move up">↑</button>` : ''}
        <button class="icon-mini danger" data-act="pl-remove" data-id="${id}" aria-label="Remove">${ICON.x}</button></li>`;
    }).join('')}</ul>` : `<div class="card empty small" style="margin:12px 0"><div class="e1">Nothing planned yet</div>Add lectures below, or let the app fill the day for you.</div>`}

    ${ids.length ? (() => { const tags = [...new Set(ids.flatMap(id => vTags(BY[id])))]; return tags.length ? `<div class="anki-day">
      <div class="small muted">Get these cards ready in Anki: paste in the Browse search, select all, unsuspend. "Still suspended" finds only the ones you haven't unsuspended yet.</div>
      <div class="btns"><button class="btn primary" data-act="copy" data-q="${h(ankiQuery(tags, true))}">Copy search · still suspended</button>
      <button class="btn" data-act="copy" data-q="${h(ankiQuery(tags, false))}">Copy search · all cards</button></div></div>` : ''; })() : ''}
    <div class="btns" style="margin:10px 0 4px">
      <button class="btn" data-act="pl-fill">${ICON.plus}Fill to ${mins(target || 60)}</button>
      ${ids.length ? `<button class="btn danger" data-act="pl-clear">Clear day</button>` : ''}
    </div>

    <div class="field"><span class="lbl">Add lectures</span>
      <div class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>
        <input id="pl-q" type="search" placeholder="Search unwatched videos" value="${h(ctx.q)}" autocomplete="off"></div>
      <div class="chips scroll-x" style="margin:8px 0">${[['', 'Up next'], ...subjects.map(s => [s, s])].map(([v, l]) =>
        `<button class="chip" data-act="pl-subject" data-v="${h(v)}" aria-pressed="${(ctx.subject || '') === v}"${v ? ` style="--h:${subjHue(v)}"` : ''}>${v ? subjDot(v) : ''}${h(l)}</button>`).join('')}</div>
      <ul class="list pick-list" id="pl-cands">${candidates(m)}</ul>
    </div>
    <button class="btn primary block" data-act="pl-done" style="margin-top:12px">Done</button>`;
}

export function openPlanner(date) {
  const t = today();
  ctx = { date: date || addDays(t, new Date().getHours() >= 17 ? 1 : 0), subject: '', q: '' };
  openSheet(body);
}

const list = () => (S.plan[ctx.date] ||= []);
const tidy = () => { if (!S.plan[ctx.date]?.length) delete S.plan[ctx.date]; save(); };

export const actions = {
  'plan-day': el => openPlanner(el.dataset.v),
  'pl-day': el => { ctx.date = el.dataset.v; },
  'pl-subject': el => { ctx.subject = el.dataset.v; ctx.q = ''; },
  'pl-add': el => {
    const id = el.dataset.id;
    // A lecture lives on one day: adding it here takes it off any other day.
    for (const d of Object.keys(S.plan)) if (d !== ctx.date) { S.plan[d] = S.plan[d].filter(x => x !== id); if (!S.plan[d].length) delete S.plan[d]; }
    list().push(id); tidy();
  },
  'pl-remove': el => { S.plan[ctx.date] = list().filter(x => x !== el.dataset.id); tidy(); },
  'pl-up': el => { const l = list(), i = l.indexOf(el.dataset.id); if (i > 0) [l[i - 1], l[i]] = [l[i], l[i - 1]]; tidy(); },
  'pl-clear': () => { const was = [...list()], d = ctx.date; delete S.plan[d]; save(); toast('Day cleared', () => { S.plan[d] = was; save(); }); },
  'pl-fill': () => {
    const m = metrics(), target = needed(m, ctx.date).newMins || 60, l = list();
    let real = l.reduce((a, id) => a + (prog(id).fr ? 0 : BY[id].mins / m.planSpeed), 0);
    const taken = new Set(Object.values(S.plan).flat());
    const pool = VIDS.filter(v => !prog(v.id).fr && !taken.has(v.id) && (!ctx.subject || v.subject === ctx.subject));
    for (const v of pool) {
      const r = v.mins / m.planSpeed;
      if (real && real + r > target * 1.15) break;
      l.push(v.id); real += r;
      if (real >= target) break;
    }
    tidy();
  },
  'pl-done': () => {
    const n = (S.plan[ctx.date] || []).length;
    closeSheet();
    if (n) toast(`${n} lecture${n > 1 ? 's' : ''} planned for ${ctx.date === today() ? 'today' : fmtDow(ctx.date)}`);
  },
};

export function onInput(e) {
  if (e.target.id !== 'pl-q' || !ctx) return false;
  ctx.q = e.target.value;
  const box = document.getElementById('pl-cands');
  if (box) box.innerHTML = candidates(metrics());
  return true;
}
