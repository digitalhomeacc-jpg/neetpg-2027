import {
  S, VIDS, metrics, forecast, phases, currentPhase, save, dayDiff, addDays, weekStart, studyDays, revInfo,
  h, mins, hrs, sp, fmtDay, fmtDow, fmtDayYear, subjDot, MON, parse,
} from '../core.js';
import { sectionH, CHECK } from '../ui.js';

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
  const whatif = S.ui.whatif ?? (Math.round((m.target / 60) * 4) / 4 || 3);
  const wfc = m.remaining > 0 ? forecast(m, whatif * 60) : [];
  const wEnd = wfc.length ? wfc[wfc.length - 1].date : t;
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
  for (const v of VIDS) { const r = revInfo(v, t); if (r?.k) { const d = r.due < t ? t : r.due; (revBy[d] ||= []).push({ v, r }); } }
  const revWeeks = Array.from({ length: 8 }, (_, i) => {
    const w = addDays(weekStart(t), i * 7);
    let tot = 0, n = 0;
    for (let j = 0; j < 7; j++) for (const x of revBy[addDays(w, j)] || []) { tot += x.r.budget; n++; }
    return { w, tot, n };
  });
  const maxW = Math.max(60, ...revWeeks.map(w => w.tot));

  const dayHtml = soon.map(d => { const rv = revBy[d.date] || []; const rvMins = rv.reduce((a, x) => a + x.r.budget, 0); return `<li class="day">
    <div class="day-h"><span class="t num">${d.date === t ? 'Today' : fmtDow(d.date)} ${d.planned ? '<span class="pill accent">Your plan</span>' : '<span class="pill">Suggested</span>'}</span>
      <span class="row" style="gap:10px"><span class="small faint num">${mins(d.total + rvMins)}</span><button class="link" data-act="plan-day" data-v="${d.date}">Edit</button></span></div>
    ${rv.length ? `<ul class="list">${rv.map(({ v, r }) => `<li><button class="day-v" data-act="revise" data-id="${v.id}"><span class="rtag">${r.k.toUpperCase()}</span><span class="grow">${h(v.title)}</span><span class="small faint num">${mins(r.budget)}</span></button></li>`).join('')}</ul>` : ''}
    <ul class="list">${d.items.map(({ v, real }) => `<li><button class="day-v" data-act="open-video" data-id="${v.id}">${subjDot(v.subject)}<span class="grow">${h(v.title)}</span><span class="small faint num">${mins(real)}</span></button></li>`).join('')}</ul>
  </li>`; }).join('');

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
  ${sectionH('What if', 'real hours a day')}
  <section class="card">
    <div class="row"><input type="range" id="whatif" min="1" max="8" step="0.25" value="${whatif}" aria-label="Hours a day"><span class="whatif-v num">${whatif}h</span></div>
    <p class="small" style="margin:10px 0 0">${wMsg}</p>
    <p class="small faint" style="margin:4px 0 0">You need <b class="num">${mins(m.target)}</b> a study day to make the deadline. Change the deadline or rest days in Settings.</p>
  </section>

  ${sectionH('Revision load', 'next 8 weeks')}
  <section class="card">
    <div class="wbars">${revWeeks.map(w => `<div class="wbar"><span class="wb" style="height:${Math.max(3, (w.tot / maxW) * 100)}%" title="${w.n} revisions"></span><span class="wv num">${w.tot ? hrs(w.tot) : ''}</span><span class="wl num">${fmtDay(w.w)}</span></div>`).join('')}</div>
    <p class="small faint" style="margin:10px 0 0">Every video you watch adds 5 revisions, each shorter than the last. This load grows as you watch more, so keep clearing what's due.</p>
  </section>

  ${sectionH('Next two weeks', `<button class="link" data-act="plan-day" data-v="${addDays(t, 1)}">Plan a day</button>`)}
  <div class="btns" style="margin:0 0 8px"><button class="btn primary" data-act="plan-week">🗓️ Plan the week</button><button class="btn" data-act="ics">📅 To Calendar</button></div>
  <div class="btns" style="margin:0 0 8px"><button class="btn" data-act="rehearsals">🎯 GT rehearsals</button><button class="btn" data-act="final-preview">🏁 Final 7 days</button></div>
  <p class="small faint" style="margin:0 4px 8px">Days you plan keep exactly your lectures. The rest are filled in sheet order at ${mins(m.target)} a day.</p>
  <ul class="card flush list daylist">${dayHtml}</ul>

  ${weeks.length ? `${sectionH('After that')}
  <ul class="card flush list">${weeks.map(w => `<li class="item"><div class="grow"><div class="t num">Week of ${fmtDay(w.w)}</div>
    <div class="s">${w.subjects.map(s => `${subjDot(s)}${h(s)}`).join(' · ')}</div></div><div class="end num">${hrs(w.total)}<br>${w.n} videos</div></li>`).join('')}</ul>` : ''}
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

export const actions = {
  'ics': () => {
    const m = metrics(), t = m.t, revBy = {};
    for (const v of VIDS) { const r = revInfo(v, t); if (r?.k) { const d = r.due < t ? t : r.due; (revBy[d] ||= []).push({ v, r }); } }
    const blob = new Blob([icsFile(forecast(m), revBy)], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'pg27-next-14-days.ics'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },
  'phase': el => { S.ui.phase = S.ui.phase === el.dataset.v ? '' : el.dataset.v; save(); },
  'goal': el => { const id = el.dataset.v; if (S.goals[id]) delete S.goals[id]; else S.goals[id] = true; save(); },
};
