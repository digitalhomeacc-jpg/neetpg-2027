import {
  today, S, VIDS, BY, PASSES, prog, metrics, forecast, currentPhase, isRest, addDays, weekStart, parse, DOW,
  h, mins, hrs, sp, pct, fmtDay, fmtDayLong, fmtDayYear, subjDot, subjHue, ankiQuery, vTags, ANKI, ankiOf, REASONS, plural,
} from '../core.js';
import { ring, miniRing, videoItem, sectionH, ICON, more } from '../ui.js';
import { focusPill } from './focus.js';
import { watchPill } from './watch.js';
import { checkinCard } from './health.js';
import { rehearsalCard, finalCard } from './extras.js';
import { backlogCard } from './backlog.js';
import { todayCard as dayCard } from './dayview.js';
import { account } from '../sync.js';
import { finishDate, studyDays, dayDiff, pace, hoursNeeded, blockMode } from '../core.js';
import { revTimeChips, upNextHtml } from './revtime.js';
import { todayCard } from './pyt.js';

// When your recent pace won't make the deadline, offer three concrete fixes.
function catchUp(m, st) {
  const p = pace();
  if (!p || m.remaining <= 0) return '';
  const proj = p.finish || st.exam;
  if (proj <= st.target) return '';
  const late = dayDiff(st.target, proj);
  // Both numbers are real study time a day, revisions included.
  const nowReal = p.perDay, needReal = (hoursNeeded() ?? 14) * 60;
  m = { ...m, projected: proj };
  const daysLeft = Math.max(1, studyDays(addDays(m.t, 1), st.target));
  const at2 = m.remaining / daysLeft / 2;
  return `<section class="card catchup">
    <div class="cu-h">⚠️ At your last two weeks' pace you finish WOR ${p.finish ? `on <b>${fmtDay(m.projected)}</b>` : '<b>after the exam</b>'}, ${late} day${late > 1 ? 's' : ''} after your deadline.</div>
    <div class="cu-opts">
      <button class="cu-opt" data-act="plan-day" data-v="${addDays(m.t, 1)}"><b>+${mins(Math.max(0, needReal - nowReal))} a day</b><span>Study ${mins(needReal)} a day in all, revisions included (now ${mins(nowReal)}), and keep ${fmtDay(st.target)}. Plan tomorrow →</span></button>
      ${m.projected < addDays(st.exam, -60) ? `<button class="cu-opt" data-act="cu-deadline" data-v="${m.projected}"><b>Move deadline to ${fmtDay(m.projected)}</b><span>Keep your current pace. Later phases shift too.</span></button>`
        : `<div class="cu-opt"><b>Moving the deadline won't fix it</b><span>At this pace the first watch ends ${p.finish ? `on ${fmtDay(p.finish)}, too close to the exam` : 'after the exam'}. Study time a day has to go up.</span></div>`}
      ${m.planSpeed < 2 ? `<button class="cu-opt" data-act="cu-speed"><b>Watch at 2×</b><span>New videos take ${Math.round((1 - m.planSpeed / 2) * 100)}% less time than at ${sp(m.planSpeed)}. Revision limits stay the same.</span></button>` : ''}
    </div></section>`;
}
function backupNudge() {
  if (account()) return '';
  const last = S.lastBackup ? dayDiff(S.lastBackup, today()) : 99;
  const has = Object.keys(S.progress).length > 5;
  if (!has || last < 7) return '';
  return `<button class="card tomorrow nudge" data-act="export"><span class="rbadge" style="--h:200">💾</span>
    <span class="grow"><span class="t">Back up your progress</span><span class="s">${S.lastBackup ? `Last backup ${last} days ago.` : 'You haven’t backed up yet.'} Save a copy to iCloud Drive, or turn on Sync in Settings.</span></span></button>`;
}
import { QUOTES, quoteIndex, nextQuote } from '../quotes.js';
import { save } from '../core.js';

function quoteStrip() {
  const x = QUOTES[quoteIndex(S.ui)];
  return `<button class="quote q2" data-act="quote-next" aria-label="Quote: ${h(x.q)} by ${h(x.who)}. Tap for another">
    <span class="q2-t">“${h(x.q)}”</span>
    <span class="q2-s">${h(x.who)} · ${h(x.src)}</span>
  </button>`;
}

export const actions = {
  'quote-next': () => { nextQuote(S.ui); save(); },
  'cu-deadline': el => {
    if (el.dataset.v >= S.settings.exam) { return; }
    const was = S.settings.target; S.settings.target = el.dataset.v; save();
    import('../ui.js').then(u => u.toast(`Deadline moved to ${fmtDay(el.dataset.v)}`, () => { S.settings.target = was; save(); }));
  },
  'cu-speed': () => { const was = S.settings.speed; S.settings.speed = 2; save(); import('../ui.js').then(u => u.toast('Usual speed set to 2×', () => { S.settings.speed = was; save(); })); },
};

function greeting() {
  const hr = new Date().getHours();
  return hr < 5 ? 'Late night' : hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
}

function weekStrip(m, fc) {
  const ws = weekStart(m.t);
  const plan = Object.fromEntries(fc.map(d => [d.date, d.planned ? d.total : d.cap]));
  let cells = '';
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i), real = (m.byDay[d] || 0) + (m.sessDay[d] || 0);
    const tgt = d === m.t ? m.target : d < m.t ? S.days[d]?.t : plan[d];
    const rest = isRest(d);
    const frac = tgt ? real / tgt : real ? 1 : 0;
    const cls = [d === m.t ? 'now' : '', d > m.t ? 'future' : '', rest ? 'rest' : ''].join(' ');
    const sub = rest && !real ? 'rest' : d > m.t ? (tgt ? mins(tgt).replace(' min', 'm') : '') : real ? mins(real).replace(' min', 'm') : d < m.t && tgt ? 'missed' : '';
    cells += `<button class="wd ${cls}" data-act="day" data-d="${d}" aria-label="Open ${d}"><div class="wl">${DOW[parse(d).getDay()]}</div>${miniRing(frac, rest ? 'restring' : '')}
      <div class="wn num">${parse(d).getDate()}</div><div class="ws num">${sub}</div></button>`;
  }
  return `<section class="card week">${cells}</section>`;
}

export function view() {
  const m = metrics(), st = S.settings;
  const fc = forecast(m);
  const phase = currentPhase(m.t);
  let status, line;
  const goal = m.goal, min = m.minimum, real = m.realToday;
  const frac = goal ? real / goal : (real ? 1 : 0);
  const nDue = m.due.length;
  if (m.remaining <= 0 && !nDue) { status = 'All caught up'; line = 'WOR is watched and no revisions are due today.'; }
  else if (m.restToday && !nDue) { status = 'Rest day'; line = real ? `You still put in ${mins(real)}.` : 'Nothing due today. Enjoy it.'; }
  else if (real >= goal) { status = 'Target done'; line = `${mins(real)} today. Anything extra lowers the days ahead.`; }
  else if (real > 0) { status = `${mins(goal - real)} to go`; line = `${mins(real)} of today's ${mins(goal)} done.`; }
  else { status = `${mins(goal)} today`; line = `${nDue ? `${nDue} revision${nDue > 1 ? 's' : ''} + ` : ''}${mins(m.target)} of new videos, to finish WOR by ${fmtDay(st.target)}.`; }

  const behindCls = m.behind / m.planSpeed > 60 ? 'bad' : m.behind > 0 ? 'warn' : 'good';
  // In hours of watching at your speed, like today's target and the Backlog card.
  const behindTxt = m.behind > 0 ? `${hrs(m.behind / m.planSpeed)}` : `+${hrs(-m.behind / m.planSpeed)}`;

  const mineToday = (S.plan[m.t] || []).length > 0;
  const todayPlan = fc[0] && fc[0].date === m.t ? fc[0].items : mineToday ? [] : (fc[0]?.items.slice(0, 2) || []);
  const bonus = !mineToday && !(fc[0] && fc[0].date === m.t);
  const tmr = addDays(m.t, 1);
  const tmrIds = (S.plan[tmr] || []).filter(id => BY[id] && !prog(id).fr);
  const tmrMins = tmrIds.reduce((a, id) => a + BY[id].mins / m.planSpeed, 0);
  let nextHtml = '', lastBlock = null, acc = 0;
  for (const { v, real, carried } of todayPlan) {
    nextHtml += videoItem(v, { showBlock: false, showSubject: true, real, note: carried ? 'carried over' : '' }); acc += real;
  }

  const doneToday = VIDS.filter(v => PASSES.some(k => prog(v.id)[k]?.d === m.t));
  const frTodayVids = doneToday.filter(v => prog(v.id).fr?.d === m.t);
  const tagsToday = [...new Set(frTodayVids.flatMap(v => vTags(v)))];
  const openMistakes = S.mistakes.filter(x => !x.done);
  const reason = Object.fromEntries(REASONS);
  const lastTest = [...S.tests].sort((a, b) => b.date.localeCompare(a.date))[0];

  return {
    title: 'Today',
    meta: fmtDayLong(m.t),
    html: `
  ${finalCard(m)}
  ${m.examDays <= 42 && m.examDays > 7 ? `<section class="card note-card"><b>Final sprint:</b> every revision now gets 30% less time. Revise only what you got wrong in recall.</section>` : ''}
  ${rehearsalCard()}
  ${watchPill()}
  ${focusPill()}
  <section class="card hero-card">
    <div class="hero-top">
      <span class="hello">${greeting()}</span>
      ${phase ? `<button class="pill accent" data-act="tab" data-v="plan">${h(phase.name)} · until ${fmtDay(phase.end)}</button>` : ''}
    </div>
    <div class="hero">
      ${ring(frac, goal ? pct(Math.min(frac, 9.99)) : mins(real), goal ? `of ${mins(goal)}` : 'today', 124)}
      <div class="hero-text grow">
        <p class="status">${status}</p>
        <p>${line}</p>
      </div>
    </div>
    <div class="hero-cta">
      ${nDue ? `<button class="btn primary" data-act="revise" data-id="${m.due[0].v.id}">${ICON.timer}Revise next</button>`
        : todayPlan[0] ? `<button class="btn primary" data-act="mark" data-id="${todayPlan[0].v.id}">Watched next video</button>` : ''}
      <button class="btn" data-act="focus-open">${ICON.timer}Focus</button>
    </div>
    <div class="stats">
      <button class="stat ${behindCls}" data-act="past"><div class="v num">${m.remaining > 0 ? behindTxt : 'Done'}</div><div class="k">${m.remaining <= 0 ? 'WOR watched' : m.behind > 0 ? 'behind schedule' : 'ahead of schedule'}</div></button>
      <div class="stat"><div class="v num">${mins(m.otherToday).replace(' min', 'm')}</div><div class="k">Anki & Qs today</div></div>
      <div class="stat ${m.streak ? 'good' : ''}"><div class="v num">${ICON.flame}${m.streak}</div><div class="k">day streak</div></div>
    </div>
  </section>

  ${weekStrip(m, fc)}

  ${catchUp(m, st)}
  ${checkinCard()}
  ${backupNudge()}
  ${new Date().getDay() === 0 ? `<button class="card tomorrow" data-act="report"><span class="rbadge" style="--h:250">📊</span><span class="grow"><span class="t">Your week in review</span><span class="s">Two minutes: what went well, what didn't, one change</span></span><span class="faint">›</span></button>` : ''}

  ${dayCard()}
  ${sectionH('Revise today', `${nDue ? `<span class="num">${nDue} due · ${mins(m.dueMins)}</span> · ` : ''}<button class="link" data-act="revisions" data-v="r1">All revisions</button>`)}
  ${nDue ? `<ul class="card flush list">${m.due.slice(0, 5).map(({ v, r }, i) => {
    const extra = false; // every due revision is part of today's target
    return `<li class="item rev${extra ? ' extra' : ''}"><span class="rbadge" style="--h:${subjHue(v.subject)}">${r.k.toUpperCase()}</span>
      <button class="open" data-act="revise" data-id="${v.id}"><div class="t">${h(v.title)}</div>
      <div class="s num">${subjDot(v.subject)}${mins(r.budget)} limit · ${r.overdue > 0 ? `<span class="bad-t">${r.overdue}d overdue</span>` : 'due today'}${r.pulled ? ' · from a mistake' : ''}${extra ? ' · if you have time' : ''}</div></button>
      <button class="btn small-btn" data-act="revise" data-id="${v.id}">Start</button></li>`;
  }).join('')}</ul>${nDue > 5 ? more('rev-all', `${nDue - 5} more due today`, `<ul class="card flush list">${m.due.slice(5).map(({ v, r }) => `<li class="item rev"><span class="rbadge" style="--h:${subjHue(v.subject)}">${r.k.toUpperCase()}</span>
      <button class="open" data-act="revise" data-id="${v.id}"><div class="t">${h(v.title)}</div><div class="s num">${subjDot(v.subject)}${mins(r.budget)} limit${r.overdue > 0 ? ` · <span class="bad-t">${r.overdue}d overdue</span>` : ''}</div></button>
      <button class="btn small-btn" data-act="revise" data-id="${v.id}">Start</button></li>`).join('')}</ul>`) : ''}` : `<section class="card empty small">${m.revDoneCount ? `<div class="ei">🎉</div><div class="e1">Revisions done for today</div>${m.revDoneCount} finished. Nice.` : `<div class="ei">🧠</div><div class="e1">Nothing to revise yet</div>${blockMode() ? 'A subject\'s R1 starts once all its videos are watched. Then it goes round by round, R1 to R4, at the revision time you set each day.' : 'Each video\'s R1 falls due 3 days after you first watch it. Later ones get longer gaps and shorter time limits.'}`}</section>`}

  ${m.remaining > 0 ? `
  ${sectionH(mineToday ? "Today's plan" : bonus ? 'Suggested · bonus' : 'Suggested for today',
    `<button class="link" data-act="plan-day" data-v="${m.t}">${mineToday ? 'Edit' : 'Choose myself'}</button>`)}
  ${todayPlan.length ? `<ul class="card flush list">${nextHtml}</ul>` : `<section class="card empty small"><div class="e1">${mineToday ? 'Everything planned is watched' : 'Nothing left for today'}</div>${mins(m.realToday)} done today.</section>`}
  ${!mineToday && todayPlan.length ? `<p class="small faint" style="margin:6px 4px 0">These follow your sheet's order. Tap “Choose myself” to pick your own lectures.</p>` : ''}
  ${todayCard([...new Set([...todayPlan.map(x => x.v.id), ...VIDS.filter(v => prog(v.id).fr?.d === m.t).map(v => v.id)])])}
  ${(() => { const ids = [...new Set([...todayPlan.map(x => x.v.id), ...VIDS.filter(v => prog(v.id).fr?.d === m.t).map(v => v.id)])];
    return ids.length ? `<button class="btn block anki-tmr" data-act="copy" data-q="${h(ankiQuery([...new Set(ids.flatMap(id => vTags(BY[id])))], false))}">${ICON.copy}Copy today's topics for Anki</button>` : ''; })()}

  <button class="card tomorrow" data-act="plan-day" data-v="${tmr}">
    <span class="rbadge" style="--h:215">${ICON.cal}</span>
    <span class="grow"><span class="t">${tmrIds.length ? `Tomorrow: ${tmrIds.length} lecture${tmrIds.length > 1 ? 's' : ''} · ${mins(tmrMins)}` : 'Plan tomorrow'}</span>
      <span class="s">${tmrIds.length ? tmrIds.slice(0, 2).map(id => h(BY[id].title)).join(', ') + (tmrIds.length > 2 ? ` +${tmrIds.length - 2}` : '') : `Pick lectures for ${fmtDay(tmr)} against the ${mins(m.perDay)} it needs`}</span></span>
    <span class="faint">${ICON.chev}</span>
  </button>
  ${tmrIds.length ? `<button class="btn block anki-tmr" data-act="copy" data-q="${h(ankiQuery([...new Set(tmrIds.flatMap(id => vTags(BY[id])))], false))}">${ICON.copy}Copy tomorrow's topics for Anki</button>` : ''}` : ''}

  ${more('today', 'More for today: revision time, extra time, mistakes, done today, totals', `
  ${backlogCard(m)}
  ${revTimeChips(m.t)}
  ${upNextHtml()}
  ${openMistakes.length ? `
  ${sectionH('Mistakes to revisit', `<button class="link" data-act="tab" data-v="tests">${plural(openMistakes.length, 'open')}</button>`)}
  <ul class="card flush list">${openMistakes.slice(0, 3).map(x => `<li class="item">
    <button class="check" data-act="mistake-done" data-id="${x.id}" aria-label="Mark revisited"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>
    <button class="open" data-act="${x.video ? 'open-video' : 'edit-mistake'}" data-id="${x.video || x.id}"><div class="t">${h(x.note || (x.video ? BY[x.video]?.title : x.subject))}</div>
    <div class="s">${subjDot(x.subject)}${h(x.subject)}${x.video && x.note ? ' · ' + h(BY[x.video]?.title) : ''}</div></button>
    <div class="end"><span class="pill">${reason[x.reason]}</span></div></li>`).join('')}</ul>` : ''}

  ${doneToday.length ? `
  ${sectionH('Done today', `<span class="num">${mins(m.realToday)}</span>`)}
  <ul class="card flush list">${doneToday.map(v => videoItem(v)).join('')}</ul>` : ''}

  ${frTodayVids.length ? `
  ${sectionH("Anki for today's videos", ANKI ? plural(frTodayVids.reduce((a, v) => a + (ankiOf(v)?.c || 0), 0), 'card') : plural(tagsToday.length, 'tag'))}
  <section class="card">
    <p class="small muted" style="margin:0 0 12px">Paste into Anki's Browse search, select all, then unsuspend (Ctrl/⌘+J on desktop).</p>
    <div class="btns">
      <button class="btn primary block" data-act="copy" data-q="${h(ankiQuery(tagsToday, false))}">${ICON.copy}Copy today's topics for Anki</button>
    </div>
    <div class="spacer"></div>
    <div class="note"><b>Draft mapping.</b> These tags come from the sheet and haven't been checked against your collection yet.</div>
  </section>` : ''}

  <section class="card tiles">
    <button class="tile" data-act="tab" data-v="plan"><div class="k">WOR done by</div><div class="v num">${fc.length ? fmtDay(fc[fc.length - 1].date) : '—'}</div><div class="s">if you hit each day's target</div></button>
    <button class="tile" data-act="tab" data-v="tests"><div class="k">Last test</div><div class="v num">${lastTest ? `${4 * lastTest.c - lastTest.w}/${4 * lastTest.n}` : '—'}</div><div class="s">${lastTest ? h(lastTest.name) : 'Log one from Tests'}</div></button>
    <div class="tile"><div class="k">Study days</div><div class="v num">${m.daysLeft}</div><div class="s">to ${fmtDay(st.target)} deadline</div></div>
  </section>
  <section class="card tiles" style="grid-template-columns:1fr;margin-top:-4px">
    <div class="tile"><div class="k">Exam</div><div class="v num">${m.examDays} days</div><div class="s">${fmtDayYear(st.exam)} (est.)</div></div>
  </section>

  ${(() => { const p = pace(); return p ? `<p class="small faint center">At your last two weeks' pace (${mins(p.perDay)} a study day, revisions included), WOR first watch finishes ${p.finish ? fmtDayYear(p.finish) : 'after the exam'}.</p>` : ''; })()}
`)}
  `,
  };
}
