import {
  S, VIDS, PASSES, metrics, forecast, simulate, finishDate, roundsPlan, hoursNeeded, phases, currentPhase, save, dayDiff, addDays, weekStart, studyDays, revInfo,
  h, mins, hrs, sp, fmtDay, fmtDow, fmtDayYear, subjDot, MON, parse,
} from '../core.js';
import { sectionH, CHECK, seg, more, tools } from '../ui.js';

function timeline(t) {
  const ps = phases(), start = ps[0].start, end = ps[ps.length - 1].end;
  const span = Math.max(1, dayDiff(start, end));
  const x = d => Math.max(0, Math.min(100, (dayDiff(start, d) / span) * 100));
  const segs = ps.map((p, i) => `<div class="tl-seg p${i + 1}${t >= p.start && t <= p.end ? ' cur' : ''}" style="left:${x(p.start)}%;width:${x(addDays(p.end, 1)) - x(p.start)}%"></div>`).join('');
  const months = [];
  for (let d = start; d <= end; d = addDays(d, 1)) if (d.endsWith('-01')) months.push(`<span style="left:${x(d)}%">${MON[parse(d).getMonth()]}</span>`);
  return `<div class="tl"><div class="tl-bar">${segs}<div class="tl-now" style="left:${x(t)}%"></div></div>
    <div class="tl-months">${months.join('')}</div></div>`;
}

export function view() {
  const m = metrics(), st = S.settings, t = m.t;
  const ps = phases(), cur = currentPhase(t);
  const open = S.ui.phase || cur?.id || 'p1';

  const phaseList = ps.map((p, i) => {
    const isCur = cur?.id === p.id, isOpen = open === p.id, past = t > p.end;
    const doneGoals = p.goals.filter(([id]) => S.goals[id]).length;
    const left = t < p.start ? `starts in ${dayDiff(t, p.start)} days` : past ? 'done' : `${dayDiff(t, p.end)} days left`;
    return `<li class="phase${isCur ? ' cur' : ''}${past ? ' past' : ''}">
      <button class="phase-h" data-act="phase" data-v="${p.id}" aria-expanded="${isOpen}">
        <span class="pnum p${i + 1}"><b>${i + 1}</b></span>
        <span class="grow"><span class="t">${h(p.name)}</span><span class="s num">${fmtDay(p.start)} – ${fmtDay(p.end)} · ${left}</span></span>
        <span class="small faint num">${doneGoals}/${p.goals.length}</span>
      </button>
      ${isOpen ? `<div class="phase-b"><p class="small muted">${h(p.blurb)}</p>
        <ul class="list goals">${p.goals.map(([id, label]) => `<li><button class="goal" data-act="goal" data-v="${id}">
          <span class="check sm${S.goals[id] ? ' on' : ''}">${CHECK}</span><span>${h(label)}</span></button></li>`).join('')}</ul></div>` : ''}
    </li>`;
  }).join('');

  // What-if: hours a day you can give, and when that gets WOR done.
  const whatif = S.ui.whatif ?? (Math.round((m.perDay / 60) * 4) / 4 || 3);
  // Revisions come out of the same hours, so simulate day by day rather than divide.
  const withRev = S.ui.whatifRev !== false;
  // New videos only: every hour goes to first watches (runtime at your speed), no revisions.
  const sim = m.remaining > 0 ? (withRev ? simulate(whatif * 60) : { finish: finishDate(whatif * 60 * m.planSpeed), newOnly: true }) : null;
  const wEnd = sim ? (sim.finish || st.exam) : t;
  const wDiff = dayDiff(st.target, wEnd);
  const wMsg = !m.remaining ? 'WOR is done.' : wDiff <= 0
    ? `Done <b>${fmtDayYear(wEnd)}</b>, ${wDiff === 0 ? 'right on' : `${-wDiff} days before`} your ${fmtDay(st.target)} deadline.`
    : `Done <b>${fmtDayYear(wEnd)}</b>, ${wDiff} days after your ${fmtDay(st.target)} deadline.`;

  // Day-by-day schedule at today's target.
  const fc = forecast(m);
  const soon = fc.slice(0, 14);
  const later = fc.slice(14);
  const weeks = [];
  for (const d of later) {
    const w = weekStart(d.date);
    let wk = weeks[weeks.length - 1];
    if (!wk || wk.w !== w) { wk = { w, total: 0, subjects: [], n: 0 }; weeks.push(wk); }
    wk.total += d.total; wk.n += d.items.length;
    for (const { v } of d.items) if (!wk.subjects.includes(v.subject)) wk.subjects.push(v.subject);
  }

  // Revisions by due date (overdue ones count as today).
  const revBy = {};
  for (const v of VIDS) { const r = revInfo(v, t); if (r?.k && r.due) { const d = r.due < t ? t : r.due; (revBy[d] ||= []).push({ v, r }); } }
  const revWeeks = Array.from({ length: 8 }, (_, i) => {
    const w = addDays(weekStart(t), i * 7);
    let tot = 0, n = 0;
    for (let j = 0; j < 7; j++) for (const x of revBy[addDays(w, j)] || []) { tot += x.r.budget; n++; }
    return { w, tot, n };
  });
  const maxW = Math.max(60, ...revWeeks.map(w => w.tot));

  const dayRow = d => { const rv = revBy[d.date] || []; const rvMins = rv.reduce((a, x) => a + x.r.budget, 0); return `<li class="day">
    <div class="day-h"><span class="t num">${d.date === t ? 'Today' : fmtDow(d.date)} ${d.planned ? '<span class="pill accent">Your plan</span>' : '<span class="pill">Suggested</span>'}</span>
      <span class="row" style="gap:10px"><span class="small faint num">${mins(d.total + rvMins)}</span><button class="link" data-act="plan-day" data-v="${d.date}">Edit</button></span></div>
    ${rv.length ? `<ul class="list">${rv.map(({ v, r }) => `<li><button class="day-v" data-act="revise" data-id="${v.id}"><span class="rtag">${r.k.toUpperCase()}</span><span class="grow">${h(v.title)}</span><span class="small faint num">${mins(r.budget)}</span></button></li>`).join('')}</ul>` : ''}
    <ul class="list">${d.items.map(({ v, real }) => `<li><button class="day-v" data-act="open-video" data-id="${v.id}">${subjDot(v.subject)}<span class="grow">${h(v.title)}</span><span class="small faint num">${mins(real)}</span></button></li>`).join('')}</ul>
  </li>`; };
  const dayHtml = soon.slice(0, 4).map(dayRow).join(''), dayHtmlLater = soon.slice(4).map(dayRow).join('');

  return {
    title: 'Plan',
    meta: fc.length ? `WOR done by ${fmtDay(fc[fc.length - 1].date)}` : '',
    html: `
  <section class="card">
    <div class="row" style="margin-bottom:12px"><div class="grow"><div class="small muted">Now</div><div class="status">${cur ? h(cur.name) : 'Exam done'}</div></div>
      <div style="text-align:right"><div class="small muted">Exam (est.)</div><div class="status num">${m.examDays} days</div></div></div>
    ${timeline(t)}
  </section>

  ${sectionH('Phases', 'tap to see goals')}
  <ul class="card flush list phases">${phaseList}</ul>

  ${m.remaining > 0 ? `
  ${(() => { const R = roundsPlan(); return `${sectionH('Rounds', 'you pick the dates')}
  <section class="card rounds-card">
    <p class="small muted" style="margin:0 0 6px">Choose when each round happens. The time it takes comes from the lectures: first read 100% of the runtime, R1 50%, R2 35%, R3 25%, R4 15% (at your ${m.planSpeed.toFixed(2).replace(/0$/, '')}×). BTR: enter its total hours.</p>
    ${R.rows.map(r => `<div class="rd-row">
      <div class="rd-h"><b>${r.label}</b><span class="small muted num">${r.k === 'btr' ? (r.total ? `${hrs(r.total)} total` : 'enter hours') : `${Math.round(r.pct * 100)}% · ${hrs(r.total)}`}${r.left !== r.total && r.total ? ` · ${hrs(r.left)} left` : ''}</span></div>
      <div class="rd-d">${r.k === 'fr' ? `<span class="small num">${fmtDay(r.from)} – ${fmtDay(r.to)}</span><span class="small muted">set in Settings</span>` : `<input type="date" class="num" data-round="${r.k}" data-edge="from" value="${r.from}" aria-label="${r.label} from"><span class="muted">to</span><input type="date" class="num" data-round="${r.k}" data-edge="to" value="${r.to}" aria-label="${r.label} to">${r.k === 'btr' ? `<input type="number" class="inp num rd-hrs" inputmode="decimal" min="0" step="1" data-round="btr" data-edge="hours" value="${r.hours}" placeholder="hours">` : ''}`}</div>
      <div class="rd-n small num">${r.late ? `<span class="bad-t">Ended with ${hrs(r.left)} not done</span>` : r.left <= 0 && r.total ? '<span class="good-t">Done</span>' : r.perDay != null ? `<b>${mins(r.perDay)}</b> a study day for ${r.days} days` : r.set ? '' : '<span class="faint">Pick dates</span>'}</div>
    </div>`).join('')}
    ${R.peak.mins ? `<p class="small" style="margin:10px 0 0">Busiest study day: <b class="${R.peak.mins > 8 * 60 ? 'bad-t' : ''}">${mins(R.peak.mins)}</b> on ${fmtDay(R.peak.d)} (${R.peak.ks.join(' + ')}).</p>` : ''}
    <p class="hint">Rounds can overlap; the busiest day adds them up. The phases above follow these dates. Revisions are still scheduled for you subject by subject on Today; these dates are your targets for finishing each round.</p>
  </section>`; })()}

  ${sectionH('What if', 'real hours a day')}
  <section class="card">
    <div class="row"><input type="range" id="whatif" min="1" max="8" step="0.25" value="${whatif}" aria-label="Hours a day"><span class="whatif-v num">${whatif}h</span></div>
    <p class="small" style="margin:10px 0 0">${sim?.finish ? wMsg : `At ${whatif}h a day the first watch doesn't finish before the exam.`}</p>
    ${seg('whatif-rev', [['1', 'Revisions included'], ['0', 'New videos only']], withRev ? '1' : '0')}
    ${sim?.newOnly ? '<p class="small muted" style="margin:6px 0 0">Every hour goes to new videos here. In reality revisions also need time, so switch back to see the honest date.</p>' : ''}
    ${sim && !sim.newOnly ? `<p class="small muted" style="margin:6px 0 0">Counts revisions too: they come out of the same ${whatif}h, up to <b class="num">${mins(sim.revPeak)}</b> on the busiest day. Over the whole plan, revisions take <b class="num">${hrs(sim.revTotal)}</b> and new videos <b class="num">${hrs(sim.newTotal)}</b>.</p>` : ''}
    ${(() => { const need = hoursNeeded(); return `<p class="small" style="margin:8px 0 0">${need ? `To finish by ${fmtDay(st.target)} you need about <b class="num">${need}h</b> every study day, revisions included` : `Your ${fmtDay(st.target)} deadline can't be met even at 14h a day`}. Each study day's new-video share alone is ${mins(m.perDay)}; revisions come on top.</p>`; })()}
    ${sim && !sim.newOnly ? `<div class="rounds">${[['First watch', sim.finish, 0], ...PASSES.slice(1).map(k => [k.toUpperCase(), sim.passDone[k], sim.passLeft[k]])].map(([l, d, left]) => `<div class="round${d ? '' : ' miss'}"><span>${l}</span><b class="num">${d ? fmtDay(d) : 'Not by the exam'}</b>${d ? '' : `<em class="num">${left} left</em>`}</div>`).join('')}</div>
    <p class="hint">When every video has had each round, at ${whatif}h a day. A round "not by the exam" means some videos won't get it in time: add hours, start revisions earlier, or accept fewer rounds for weak-yield topics.</p>` : ''}
    <p class="small faint" style="margin:4px 0 0">Change the deadline or rest days in Settings.</p>
  </section>

  ${sectionH('Next two weeks', `<button class="link" data-act="plan-day" data-v="${addDays(t, 1)}">Plan a day</button>`)}
  <button class="btn primary block" data-act="plan-week" style="margin:0 0 10px">Plan the week</button>
  ${tools([['day', '🗓', 'Day planner'], ['duty-open', '🏥', 'Duty'], ['revisions', '🔁', 'Revisions', 'data-v="r1"'], ['backlog', '⚠️', 'Backlogs'], ['ics', '📅', 'Calendar'], ['rehearsals', '🎯', 'GT rehearsal'], ['final-preview', '🏁', 'Final 7 days'], ['past', '📈', 'Past days']])}
  <p class="small faint" style="margin:0 4px 8px">Days you plan keep exactly your lectures. The rest are filled in sheet order at ${mins(m.perDay)} a study day.</p>
  <ul class="card flush list daylist">${dayHtml}</ul>
  ${dayHtmlLater ? more('plan-days', `The ${soon.length - 4} study days after that`, `<ul class="card flush list daylist">${dayHtmlLater}</ul>`) : ''}

  ${more('plan', 'More: revision load by week, and the weeks after', `  ${sectionH('Revision load', 'next 8 weeks')}
  <section class="card">
    <div class="wbars">${revWeeks.map(w => `<div class="wbar"><span class="wb" style="height:${Math.max(3, (w.tot / maxW) * 100)}%" title="${w.n} revisions"></span><span class="wv num">${w.tot ? hrs(w.tot) : ''}</span><span class="wl num">${fmtDay(w.w)}</span></div>`).join('')}</div>
    <p class="small faint" style="margin:10px 0 0">Every video you watch adds 4 revisions, each shorter than the last. This load grows as you watch more, so keep clearing what's due.</p>
  </section>

  ${weeks.length ? `${sectionH('After that')}
  <ul class="card flush list">${weeks.map(w => `<li class="item"><div class="grow"><div class="t num">Week of ${fmtDay(w.w)}</div>
    <div class="s">${w.subjects.map(s => `${subjDot(s)}${h(s)}`).join(' · ')}</div></div><div class="end num">${hrs(w.total)}<br>${w.n} videos</div></li>`).join('')}</ul>` : ''}
  `)}
  ` : ''}`,
  };
}

// One all-day event per study day, with what's planned and a 7 am alert.
function icsFile(days, revBy) {
  const esc = x => String(x).replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const ev = days.slice(0, 14).map(d => {
    const rv = revBy[d.date] || [], ymd = d.date.replace(/-/g, ''), next = addDays(d.date, 1).replace(/-/g, '');
    const total = d.total + rv.reduce((a, x) => a + x.r.budget, 0);
    const lines = [...rv.map(x => `${x.r.k.toUpperCase()} ${x.v.title} (${mins(x.r.budget)})`), ...d.items.map(x => `${x.v.title} (${mins(x.real)})`)];
    return ['BEGIN:VEVENT', `UID:pg27-${ymd}@neetpg-2027`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${ymd}`, `DTEND;VALUE=DATE:${next}`,
      `SUMMARY:${esc(`PG 2027 · ${mins(total)}${rv.length ? ` · ${rv.length} revision${rv.length > 1 ? 's' : ''}` : ''}`)}`,
      `DESCRIPTION:${esc(lines.join('\n'))}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc('PG 2027: today\'s plan')}`, 'TRIGGER:PT7H', 'END:VALARM', 'END:VEVENT'].join('\r\n');
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PG 2027//EN', 'CALSCALE:GREGORIAN', ...ev, 'END:VCALENDAR'].join('\r\n');
}

export function onChange(e) {
  const k = e.target.dataset?.round; if (!k) return false;
  const edge = e.target.dataset.edge, v = e.target.value;
  const R = (S.settings.rounds ||= {}), r = (R[k] ||= {});
  if (edge === 'hours') r.hours = v === '' ? '' : Math.max(0, +v);
  else if (v) r[edge] = v; else delete r[edge];
  save(); return true;
}

export const actions = {
  'whatif-rev': el => { S.ui.whatifRev = el.dataset.v === '1'; },
  'ics': () => {
    const m = metrics(), t = m.t, revBy = {};
    for (const v of VIDS) { const r = revInfo(v, t); if (r?.k && r.due) { const d = r.due < t ? t : r.due; (revBy[d] ||= []).push({ v, r }); } }
    const blob = new Blob([icsFile(forecast(m), revBy)], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'pg27-next-14-days.ics'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },
  'phase': el => { S.ui.phase = S.ui.phase === el.dataset.v ? '' : el.dataset.v; save(); },
  'goal': el => { const id = el.dataset.v; if (S.goals[id]) delete S.goals[id]; else S.goals[id] = true; save(); },
};
