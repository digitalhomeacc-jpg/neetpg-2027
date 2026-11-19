import {
  S, VIDS, SUBJECTS, PASSES, prog, metrics, isRest, addDays, dayDiff, parse, studyDays,
  h, mins, hrs, sp, pct, fmtDay, MON, subjDot, subjHue, level, achievements,
} from '../core.js';
import { ring, sectionH } from '../ui.js';

function paceChart(m) {
  const st = S.settings;
  const days = dayDiff(st.start, st.target) + 1;
  if (days < 2) return '';
  const W = 360, H = 190, L = 30, R = 6, T = 10, B = 22;
  const x = i => L + (i / (days - 1)) * (W - L - R);
  const totH = m.total / 60;
  const y = v => T + (1 - v / totH) * (H - T - B);
  const byDate = {};
  for (const v of VIDS) { const p = prog(v.id); if (p.fr) byDate[p.fr.d] = (byDate[p.fr.d] || 0) + v.mins; }
  const plan = [], act = [];
  let cumPlan = 0, cumAct = 0;
  const perDay = m.total / (m.totalDays || 1);
  for (const [d, val] of Object.entries(byDate)) if (d < st.start) cumAct += val;
  for (let i = 0; i < days; i++) {
    const d = addDays(st.start, i);
    if (!isRest(d)) cumPlan += perDay;
    plan.push(`${x(i).toFixed(1)},${y(cumPlan / 60).toFixed(1)}`);
    if (d <= m.t) { cumAct += byDate[d] || 0; act.push(`${x(i).toFixed(1)},${y(cumAct / 60).toFixed(1)}`); }
  }
  const ticks = [0, .25, .5, .75, 1].map(f => {
    const v = totH * f;
    return `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${Math.round(v)}</text>`;
  }).join('');
  const months = [];
  for (let i = 0; i < days; i++) { const d = addDays(st.start, i); if (d.endsWith('-01') || i === 0) months.push(`<text x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : 'middle'}">${MON[parse(d).getMonth()]}</text>`); }
  const nowI = dayDiff(st.start, m.t);
  const nowLine = nowI >= 0 && nowI < days ? `<line class="now" x1="${x(nowI)}" x2="${x(nowI)}" y1="${T}" y2="${H - B}"/>` : '';
  const area = act.length ? `<polygon class="area" points="${x(0)},${y(0)} ${act.join(' ')} ${act[act.length - 1].split(',')[0]},${y(0)}"/>` : '';
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Hours of WOR watched against the plan">
    ${ticks}${months.join('')}${nowLine}<polyline class="plan" points="${plan.join(' ')}"/>${area}
    ${act.length ? `<polyline class="actual" points="${act.join(' ')}"/>` : ''}</svg>
  <div class="legend"><span><i></i>Watched (runtime hours)</span><span><i class="plan"></i>Even pace to ${fmtDay(st.target)}</span></div>`;
}

function heatmap(m) {
  const weeks = 15;
  const end = addDays(m.t, 6 - parse(m.t).getDay());
  const start = addDays(end, -(weeks * 7) + 1);
  let cells = '';
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const val = (m.byDay[d] || 0) + (m.sessDay[d] || 0), ref = S.days[d]?.t || m.target || 180;
    const l = val <= 0 ? 0 : val < ref * .35 ? 1 : val < ref * .7 ? 2 : val < ref ? 3 : 4;
    const cls = [d > m.t ? 'future' : '', isRest(d) && !val ? 'rest' : '', d === m.t ? 'today' : ''].filter(Boolean).join(' ');
    cells += `<i data-l="${l}"${cls ? ` class="${cls}"` : ''} title="${fmtDay(d)}: ${mins(val)}"></i>`;
  }
  return `<div class="heat">${cells}</div>
    <div class="legend"><span>Last ${weeks} weeks · darker = closer to that day's target · dashed = rest day</span></div>`;
}

export function view() {
  const m = metrics();
  const subj = SUBJECTS.map(s => {
    const vs = VIDS.filter(v => v.subject === s);
    const tot = vs.reduce((a, v) => a + v.mins, 0);
    const dn = vs.reduce((a, v) => a + (prog(v.id).fr ? v.mins : 0), 0);
    const cnt = vs.filter(v => prog(v.id).fr).length;
    return `<li class="item"><button class="open" data-act="goto-subject" data-s="${h(s)}" style="--h:${subjHue(s)}">
      <div class="row"><div class="t grow">${subjDot(s)}${h(s)}</div><div class="small muted num">${cnt}/${vs.length} · ${hrs(dn)} / ${hrs(tot)}</div></div>
      <div class="bar-line subj-bar" style="margin-top:8px"><i style="width:${(dn / tot) * 100}%"></i></div></button></li>`;
  }).join('');
  const passCounts = PASSES.map(k => VIDS.filter(v => prog(v.id)[k]).length);
  const weekReal = Array.from({ length: 7 }, (_, i) => (m.byDay[addDays(m.t, -i)] || 0) + (m.sessDay[addDays(m.t, -i)] || 0)).reduce((a, b) => a + b, 0);
  const lv = level(m.realAll + m.otherAll);
  const badges = achievements(m);
  const mosaic = SUBJECTS.map(s => `<div class="mz-row" style="--h:${subjHue(s)}"><div class="mz-name">${h(s)}</div><div class="mz-tiles">${
    VIDS.filter(v => v.subject === s).map(v => { const p = prog(v.id); const l = PASSES.filter(k => p[k]).length;
      return `<button data-act="open-video" data-id="${v.id}" data-l="${l}" aria-label="${h(v.title)}"></button>`; }).join('')}</div></div>`).join('');
  return {
    title: 'Progress',
    meta: `${pct(m.done / m.total)} of WOR`,
    html: `
  <section class="card level">
    <div class="lvl-badge"><div style="text-align:center"><small>LEVEL</small>${lv.lv}</div></div>
    <div class="grow">
      <div class="status num">${hrs(m.realAll + m.otherAll)} studied</div>
      <div class="small muted num" style="margin:2px 0 8px">${hrs(lv.to - (m.realAll + m.otherAll))} to level ${lv.lv + 1}</div>
      <div class="bar-line"><i style="width:${Math.max(2, lv.frac * 100)}%"></i></div>
    </div>
  </section>

  <section class="card">
    <div class="hero">
      ${ring(m.done / m.total, pct(m.done / m.total), 'watched')}
      <div class="hero-text grow">
        <p class="status num">${hrs(m.done)} of ${hrs(m.total)}</p>
        <p class="num">${m.doneCount} of ${VIDS.length} videos</p>
        <p class="num">${hrs(m.remaining / m.planSpeed)} real time left at ${sp(m.planSpeed)}</p>
      </div>
    </div>
    <div class="stats">
      <div class="stat"><div class="v num">${hrs(weekReal)}</div><div class="k">studied, last 7 days</div></div>
      <div class="stat"><div class="v num">${m.avgSpeed ? sp(m.avgSpeed) : '—'}</div><div class="k">your average speed</div></div>
      <div class="stat"><div class="v num">${hrs(m.realAll)}</div><div class="k">total time watching</div></div>
    </div>
  </section>

  ${sectionH('Syllabus map', 'every video, by pass')}
  <section class="card"><div class="mosaic">${mosaic}</div>
    <div class="mz-key"><span>Not watched</span><i style="opacity:.15"></i><i style="opacity:.35"></i><i style="opacity:.55"></i><i style="opacity:.75"></i><i style="opacity:.9"></i><i></i><span>All 5 revisions</span></div></section>

  ${sectionH('Achievements', `${badges.filter(b => b.got).length} of ${badges.length}`)}
  <section class="card"><div class="badges">${badges.map(b => `<div class="badge${b.got ? ' got' : ''}"><div class="bi">${b.icon}</div><div class="bn">${h(b.name)}</div><div class="bd">${h(b.desc)}</div></div>`).join('')}</div></section>

  ${sectionH('Pace', `${fmtDay(S.settings.start)} – ${fmtDay(S.settings.target)}`)}
  <section class="card">${paceChart(m)}</section>

  ${sectionH('Activity')}
  <section class="card">${heatmap(m)}</section>

  ${sectionH('Passes', 'videos watched in each pass')}
  <section class="card"><div class="stats five" style="margin:0">
    ${PASSES.map((k, i) => `<div class="stat"><div class="v num">${passCounts[i]}</div><div class="k">${k === 'fr' ? 'First' : k.toUpperCase()}</div></div>`).join('')}
  </div></section>

  ${sectionH('Subjects')}
  <ul class="card flush list">${subj}</ul>`,
  };
}

export const actions = {
  'goto-subject': el => {
    S.ui.tab = 'videos'; S.ui.subject = el.dataset.s; S.ui.q = '';
    return () => document.getElementById('subject-list')?.scrollIntoView({ block: 'start' });
  },
};
