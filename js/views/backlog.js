// Backlogs and self-improvement: what skipping costs, today and as a habit, what's piled up,
// and what your own data says to change. All numbers come from your plan and history.
import { S, VIDS, BY, PASSES, REV, prog, passMins, metrics, simulate, hoursNeeded, phases, roadmap, revisionsDue, studyDays, isRest, addDays, dayDiff, today, parse,
  DOW_LONG, h, mins, hrs, pct, fmtDay, fmtDayYear } from '../core.js';
import { sectionH, closeSheet } from '../ui.js';

// Memory model for the "what happens to recall" lines: each revision is timed for ~90% recall
// on its due day, and recall keeps falling the longer it waits (an exponential forgetting
// curve, R = 0.9^(elapsed / interval)). It's an estimate to show the trend, not a measurement.
const recall = (interval, late) => Math.pow(0.9, (interval + late) / Math.max(1, interval));

function dayRows(m, n) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    const d = addDays(m.t, -i);
    if (isRest(d) || d < S.settings.start) continue;
    const tgt = S.days[d]?.t, real = (m.byDay[d] || 0) + (m.sessDay[d] || 0);
    out.push({ d, tgt, real, met: tgt ? real >= tgt * 0.9 : real > 0, missed: tgt ? real < tgt * 0.5 : !real });
  }
  return out;
}

// This week: what your plan (and any extra you choose) does to the backlog and to later days.
// Extra time goes to overdue revisions first, then to new videos; new-video time beyond the
// daily target lowers the target for every study day after this week.
function weekData(m, overdueMins) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(m.t, i)).filter(d => !isRest(d) && d <= S.settings.target);
  const planned = days.map(d => {
    // Today's plan keeps the lectures you've already watched today: they're part of this week.
    const ids = (S.plan[d] || []).filter(id => BY[id] && (!prog(id).fr || (d === m.t && prog(id).fr.d === m.t)));
    return ids.length ? ids.reduce((a, id) => a + BY[id].mins / m.planSpeed, 0) : null;
  });
  const plannedDays = planned.filter(x => x != null).length;
  const weekPlan = planned.reduce((a, x) => a + (x ?? m.perDay), 0);
  const base = m.perDay * days.length;
  const behind = Math.max(0, m.behind) / m.planSpeed;
  return { days, plannedDays, weekPlan, base, planExtra: weekPlan - base, behind, overdueMins, backlog: behind + overdueMins,
    // What was left at the start of today: today's target is a share of this, so lectures
    // already watched today mustn't be taken off twice.
    remReal: (m.remaining + m.frToday) / m.planSpeed, left: m.daysLeft, T: m.perDay };
}
function pullOut(w, x) {
  const n = w.days.length, extraWeek = x * n;
  const toRev = Math.min(w.overdueMins, extraWeek), toNew = extraWeek - toRev;
  const cleared = Math.min(w.backlog, extraWeek), frac = w.backlog ? cleared / w.backlog : 1;
  const daysAfter = Math.max(0, w.left - n);
  const newLeft = Math.max(0, w.remReal - w.T * n - toNew);
  const tAfter = daysAfter ? newLeft / daysAfter : 0;
  const saved = w.T - tAfter;
  return `<div class="pull-res">
      <div class="pull-big num">${w.backlog > 1 ? pct(frac) : '—'}<span>of your backlog pulled back</span></div>
      <div class="bar-line" style="margin:8px 0 12px"><i style="width:${Math.round(frac * 100)}%"></i></div>
      <ul class="conseq">
        <li>${x ? `<b>+${mins(x)}</b> a day for ${n} study day${n > 1 ? 's' : ''} is <b>${hrs(extraWeek)}</b> extra this week.` : 'No extra this week: the backlog stays where it is.'}</li>
        ${toRev ? `<li>${mins(toRev)} of it clears ${toRev >= w.overdueMins ? 'all' : 'some'} overdue revisions first, so recall stops slipping.</li>` : ''}
        ${daysAfter && toNew > 0 ? `<li>${toRev ? 'The rest' : 'It'} finishes ${hrs(toNew)} of new videos early, so every later study day needs <b>${mins(tAfter)}</b> instead of ${mins(w.T)}: <b class="good-t">${mins(saved)} less a day</b> for ${daysAfter} days.</li>` : ''}
        ${frac >= 1 && w.backlog > 1 ? '<li class="good-t"><b>Backlog cleared by the end of this week.</b></li>' : w.backlog > 1 && x ? `<li>${hrs(w.backlog - cleared)} would still be left after this week.</li>` : ''}
      </ul></div>`;
}

export function view() {
  const m = metrics(), st = S.settings, t = m.t;
  const T = m.perDay, remReal = (m.remaining + m.frToday) / m.planSpeed; // left at the start of today
  const left = m.daysLeft;
  // 1. Skip today
  const due = m.due;
  const perDayNow = left ? remReal / left : remReal;
  const perDaySkip = left > 1 ? remReal / (left - 1) : remReal;
  const dueRecallNow = due.length ? due.reduce((a, x) => a + recall(x.r.gap || 3, Math.max(0, x.r.overdue)), 0) / due.length : null;
  const dueRecallSkip = due.length ? due.reduce((a, x) => a + recall(x.r.gap || 3, Math.max(0, x.r.overdue) + 1), 0) / due.length : null;
  const dueRecallWeek = due.length ? due.reduce((a, x) => a + recall(x.r.gap || 3, Math.max(0, x.r.overdue) + 7), 0) / due.length : null;

  // 2. As a habit. Your own pattern: study days in the last 4 weeks (from your start date) with
  // nothing logged. Each scenario keeps each study day's share (what the deadline needs) and drops
  // that many study days a week, without making them up. WOR then needs ceil(left ÷ (share × kept
  // fraction)) study days from today, exactly as the roadmap counts them; R1 and BTR follow at the
  // roadmap's lengths, so "R2 starts" shows how far everything after slides.
  const studyPerWeek = 7 - st.rest.length;
  const RM = roadmap(), frS = RM.stages[0], r1S = RM.stages[1], btrS = RM.stages[2];
  const histFrom = [addDays(t, -28), st.start].sort()[1];
  let histDays = 0, histMissed = 0;
  for (let d = histFrom; d < t; d = addDays(d, 1)) if (!isRest(d)) { histDays++; if (!((m.byDay[d] || 0) + (m.sessDay[d] || 0))) histMissed++; }
  const myRate = histDays >= 5 ? Math.round((histMissed / histDays) * studyPerWeek * 2) / 2 : null;
  const nthStudyDay = (from, n) => { let d = from, k = 0, last = from; for (let g = 0; g < 4000 && k < n; d = addDays(d, 1), g++) if (!isRest(d)) { last = d; k++; } return last; };
  const startMins = frS.mins;  // left at the start of today, in real minutes at your speed
  const rates = [...new Set([0, ...(myRate ? [myRate] : []), (myRate ?? 0) + 1, ...(myRate ? [] : [2])])].filter(x => x < studyPerWeek).sort((x, y) => x - y);
  const scen = rates.map(s => {
    const share = (studyPerWeek - s) / studyPerWeek;
    const need = m.perDay * share;
    const n = startMins > 0 && need > 0 ? Math.ceil(startMins / need - 1e-6) : 0;
    const finish = n ? nthStudyDay(t, n) : t;
    const late = Math.max(0, dayDiff(st.target, finish));
    const r2 = nthStudyDay(addDays(finish, 1), r1S.days + btrS.days + 1);
    const catchUp = left ? remReal / (left * share) : 0;
    return { s, finish, late, r2, mine: s === myRate, catchUp };
  });
  // 3. Backlog right now
  const overdue = due.filter(x => x.r.overdue > 0);
  const overdueMins = overdue.reduce((a, x) => a + x.r.budget, 0);
  const oldest = overdue.reduce((a, x) => Math.max(a, x.r.overdue), 0);
  const carried = [...new Set(Object.keys(S.plan).filter(d => d < t).flatMap(d => S.plan[d]).filter(id => BY[id] && !prog(id).fr))];
  const carriedMins = carried.reduce((a, id) => a + BY[id].mins / m.planSpeed, 0);
  const rows14 = dayRows(m, 14), missed14 = rows14.filter(r => r.missed).length, met14 = rows14.filter(r => r.met).length;
  const deficit14 = rows14.reduce((a, r) => a + Math.max(0, (r.tgt || 0) - r.real), 0);
  const openMistakes = S.mistakes.filter(x => !x.done).length;
  const behind = Math.max(0, m.behind) / m.planSpeed;
  const backlogTotal = behind + overdueMins;

  // 4. Patterns
  const rows56 = dayRows(m, 56);
  const byDow = Array.from({ length: 7 }, () => ({ n: 0, f: 0 }));
  for (const r of rows56) if (r.tgt) { const w = parse(r.d).getDay(); byDow[w].n++; byDow[w].f += Math.min(1.5, r.real / r.tgt); }
  const dowStats = byDow.map((x, i) => ({ i, avg: x.n >= 2 ? x.f / x.n : null })).filter(x => x.avg != null);
  const worst = dowStats.sort((a, b) => a.avg - b.avg)[0];
  let best = 0, run = 0;
  for (let d = S.settings.start; d <= t; d = addDays(d, 1)) {
    const real = (m.byDay[d] || 0) + (m.sessDay[d] || 0);
    if (real) { run++; best = Math.max(best, run); } else if (!isRest(d) && d !== t) run = 0;
  }
  const revDone = VIDS.flatMap(v => PASSES.slice(1).filter(k => prog(v.id)[k]).map(k => ({ took: passMins(v, prog(v.id)[k]), lim: Math.max(2, Math.round(v.mins * REV[k].budget)) })));
  const overRatio = revDone.length ? revDone.reduce((a, x) => a + x.took, 0) / revDone.reduce((a, x) => a + x.lim, 0) : null;

  const tile = (v, k, cls = '') => `<div class="stat ${cls}"><div class="v num">${v}</div><div class="k">${k}</div></div>`;
  return {
    title: 'Backlogs',
    meta: 'and self-improvement',
    html: `
  ${sectionH('Your backlog now')}
  <section class="card">
    <div class="stats" style="margin:0">
      ${tile(behind > 0 ? hrs(behind) : '0h', 'behind schedule', behind > 60 ? 'bad' : behind > 0 ? 'warn' : 'good')}
      ${tile(`${overdue.length}`, `overdue revisions · ${mins(overdueMins)}`, overdue.length > 5 ? 'bad' : overdue.length ? 'warn' : 'good')}
      ${tile(`${missed14}`, `missed study days, last 2 wks`, missed14 > 3 ? 'bad' : missed14 ? 'warn' : 'good')}
    </div>
    <button class="btn block" data-act="past" style="margin-top:12px">See it day by day</button>
    <p class="hint">Schedule = the same share of WOR every study day from ${fmtDay(st.start)} (your start date) to ${fmtDay(st.target)}. Behind = hours of watching, at your speed, needed to catch up to it.</p>
    <ul class="conseq" style="margin-top:14px">
      ${overdue.length ? `<li>Oldest overdue revision: <b>${oldest} days</b>. Clear the oldest first: they've lost the most.</li>` : '<li>No overdue revisions. Keep it that way: do revisions before new videos.</li>'}
      ${carried.length ? `<li><b>${carried.length} planned lecture${carried.length > 1 ? 's' : ''}</b> (${mins(carriedMins)}) carried over from past days.</li>` : ''}
      ${deficit14 ? `<li>Over the last two weeks you were <b>${hrs(deficit14)}</b> short of your daily targets in total, and hit the target on ${met14} of ${rows14.length} study days.</li>` : rows14.length ? `<li>You hit the target on ${met14} of ${rows14.length} study days in the last two weeks.</li>` : ''}
      ${openMistakes ? `<li>${openMistakes} open mistake${openMistakes > 1 ? 's' : ''} in the diary not yet revisited.</li>` : ''}
    </ul>
    ${backlogTotal > 5 ? `<div class="recover">
      <div class="small muted">Clear it by adding a little each day:</div>
      <div class="rc-opts">${[7, 14, 21].map(n => `<div class="rc"><b class="num">+${mins(backlogTotal / n)}</b><span>a day for ${n} days</span></div>`).join('')}</div>
      <div class="btns" style="margin-top:10px"><button class="btn primary" data-act="plan-week">Plan this week</button><button class="btn" data-act="revisions" data-v="r1">Open revisions</button></div>
    </div>` : ''}
  </section>

  ${sectionH('If you skip today')}
  <section class="card skip">
    <p class="small" style="margin:0 0 12px">Today needs <b>${mins(m.goal)}</b>${due.length ? `: ${mins(T)} of new videos and ${due.length} revision${due.length > 1 ? 's' : ''} (${mins(m.dueMins)})` : ' of new videos'}. Skipping it means:</p>
    <ul class="conseq">
      <li><b>Every remaining study day gets heavier.</b> Your new-video target goes from ${mins(perDayNow)} to <b>${mins(perDaySkip)}</b> a day for the next ${Math.max(0, left - 1)} study days, until ${fmtDay(st.target)}.</li>
      ${due.length ? `<li><b>${due.length} revision${due.length > 1 ? 's' : ''} land on tomorrow</b> on top of tomorrow's own, and every later revision of ${due.length > 1 ? 'those videos' : 'that video'} slides a day too.</li>
      <li><b>Memory drops while they wait.</b> Estimated recall for today's revisions: about ${pct(dueRecallNow)} if done today, ${pct(dueRecallSkip)} tomorrow, ${pct(dueRecallWeek)} if they wait a week. The lower it gets, the longer the revision takes.</li>` : ''}
      <li><b>Your ${m.streak}-day streak resets</b>${m.streak >= 3 ? `. Your best so far is ${best} days` : ''}.</li>
      ${!isRest(t) ? `<li><b>Missing one day is fine; missing two in a row is how a habit breaks.</b> If today can't be a full day, ${mins(Math.min(30, m.goal))} still counts and keeps the streak.</li>` : ''}
    </ul>
  </section>

  ${sectionH('If it becomes a habit', 'skipping study days each week')}
  <section class="card">
    <p class="small" style="margin:0 0 10px">${myRate != null ? `Your pattern: <b>${histMissed} of ${histDays}</b> study days with nothing logged ${histFrom === st.start ? 'since you started' : 'in the last 4 weeks'}, about <b>${myRate} day${myRate === 1 ? '' : 's'} a week</b>.` : `Not enough history yet to see your pattern (${histDays} study day${histDays === 1 ? '' : 's'} so far); these are examples.`}</p>
    <div class="sc-table">
      <div class="sc-row sc-head"><span>Skip</span><span>WOR done</span><span>Late by</span><span>R2 starts</span></div>
      ${scen.map(x => `<div class="sc-row${x.mine ? ' mine' : ''}${x.s ? (x.late > 14 ? ' bad' : x.late ? ' warn' : '') : ' good'}"><span>${x.s ? `${x.s} day${x.s === 1 ? '' : 's'}/week` : 'None'}${x.mine ? '<em>your pattern</em>' : ''}</span><span class="num">${fmtDay(x.finish)}</span><span class="num">${x.late ? `${x.late} days` : 'on time'}</span><span class="num">${fmtDay(x.r2)}</span></div>`).join('')}
    </div>
    <p class="hint">Each study day at its share (${mins(m.perDay)}), with the skipped days not made up. R1 (${r1S.days} study days) and BTR (${btrS.days}) follow at your roadmap lengths, so every late day pushes R2 back too.</p>
    <ul class="conseq">
      ${(() => { const x = scen.find(y => y.mine) || scen.find(y => y.s); return x ? `<li><b>${x.mine ? 'At your current pattern' : `Skipping ${x.s} day${x.s === 1 ? '' : 's'} a week`}</b>, WOR ends ${fmtDay(x.finish)}${x.late ? `, ${x.late} days late` : ''}, and R2 starts ${fmtDay(x.r2)}. To keep skipping that often and still finish on time, the other days need <b>${mins(x.catchUp)}</b> each.</li>` : ''; })()}
      <li><b>Revisions compound.</b> Every video you watch adds four revisions. When days are skipped, they pile up, recall falls, and each revision takes longer: the time you save by skipping comes back with interest.</li>
      <li><b>The last weeks get squeezed.</b> Late starts mean shorter gaps between rounds and less time for grand tests before ${fmtDay(st.exam)}.</li>
    </ul>
  </section>


  ${(() => {
    const w = weekData(m, overdueMins);
    if (!w.days.length) return '';
    const max = 180, def = Math.max(0, Math.min(max, Math.round(Math.max(0, w.planExtra) / w.days.length / 5) * 5));
    const x = S.ui.pullX ?? def;
    return `${sectionH('Pull it back this week')}
  <section class="card pull">
    <p class="small" style="margin:0 0 10px">${w.plannedDays ? `You've planned ${w.plannedDays} of this week's ${w.days.length} study days: <b>${hrs(w.weekPlan)}</b> of new videos against <b>${hrs(w.base)}</b> needed.
      ${w.planExtra > 5 ? ` <span class="good-t">Finish this plan and you pull back <b>${hrs(Math.min(w.backlog, w.planExtra))}</b>${w.backlog > 1 ? ` (${pct(Math.min(1, w.planExtra / w.backlog))} of your backlog)` : ''}.</span>` : w.planExtra < -5 ? ` <span class="warn-t">The plan is ${hrs(-w.planExtra)} short of what the week needs, so the backlog would grow.</span>` : ' It covers what the week needs.'}`
      : `Nothing planned for this week yet. Each study day needs ${mins(w.T)} of new videos.`}</p>
    <label class="lbl" for="pull-x">Extra each study day this week: <b class="num" id="pull-v">+${mins(x)}</b></label>
    <input id="pull-x" type="range" min="0" max="${max}" step="5" value="${x}" class="pull-range">
    <div id="pull-out">${pullOut(w, x)}</div>
    <div class="btns" style="margin-top:10px"><button class="btn primary" data-act="plan-week">Plan this week</button><button class="btn" data-act="duty-open">Duty hours</button></div>
  </section>`;
  })()}

  ${sectionH('Self-improvement', 'from your own data')}
  <section class="card">
    <ul class="conseq">
      ${worst && worst.avg < 0.8 ? `<li><b>${DOW_LONG[worst.i]}s are your weakest day</b>: about ${pct(worst.avg)} of target on average over the last 8 weeks. Plan a lighter subject that day, or move a duty off it.</li>` : '<li>No weak weekday yet. Patterns show after a few weeks of data.</li>'}
      <li>Best streak so far: <b>${best} day${best === 1 ? '' : 's'}</b>${m.streak ? `; current ${m.streak}` : ''}.</li>
      ${overRatio ? `<li>Your revisions take <b>${pct(overRatio)}</b> of their time limits. ${overRatio > 1.15 ? 'In the recall step, revise only what you got wrong, not the whole video.' : 'Well inside the limits: good.'}</li>` : ''}
      <li>See <button class="link" data-act="tab" data-v="progress">Progress</button> for your best hours and how sleep affects your study.</li>
    </ul>
    <div class="tips">
      <div class="tip"><b>Start at a fixed time.</b> Deciding when to start each day is where most days get lost.</div>
      <div class="tip"><b>Revisions before new videos.</b> They're short and they protect what you've already learned.</div>
      <div class="tip"><b>On a busy duty day, do just one thing</b>: a single revision or 25 minutes of Anki. It keeps the habit alive.</div>
      <div class="tip"><b>Phone in another room</b> during Study now. The timer counts only real study time anyway.</div>
      <div class="tip"><b>Never miss twice.</b> One missed day is noise; two in a row starts a new habit.</div>
    </div>
  </section>`,
  };
}

export function backlogCard(m) {
  const overdue = m.due.filter(x => x.r.overdue > 0);
  const behind = Math.max(0, m.behind) / m.planSpeed;
  if (behind < 60 && overdue.length < 3) return '';
  return `<button class="card tomorrow" data-act="backlog"><span class="rbadge" style="--h:10">⚠️</span>
    <span class="grow"><span class="t">Backlog: ${behind >= 60 ? `${hrs(behind)} behind` : ''}${behind >= 60 && overdue.length ? ' · ' : ''}${overdue.length ? `${overdue.length} overdue revisions` : ''}</span>
    <span class="s">See what it costs and the quickest way back</span></span><span class="faint">›</span></button>`;
}

// The slider updates its results only, so dragging stays smooth.
export function onInput(e) {
  if (e.target.id !== 'pull-x') return false;
  const x = +e.target.value; S.ui.pullX = x;
  const m = metrics(), due = m.due.filter(d => d.r.overdue > 0);
  const w = weekData(m, due.reduce((a, d) => a + d.r.budget, 0));
  document.getElementById('pull-v').textContent = `+${mins(x)}`;
  document.getElementById('pull-out').innerHTML = pullOut(w, x);
  return true;
}

export const actions = {
  'backlog': () => { closeSheet(); S.ui.backlogBack = S.ui.tab === 'backlog' ? S.ui.backlogBack : S.ui.tab; S.ui.tab = 'backlog'; return 'enter'; },
};
