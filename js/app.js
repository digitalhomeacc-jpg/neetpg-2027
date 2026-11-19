(() => {
'use strict';

const D = window.WOR;
const VIDS = D.videos;
const BY = Object.fromEntries(VIDS.map(v => [v.id, v]));
const SUBJECTS = D.subjects.filter(s => VIDS.some(v => v.subject === s));
const PASSES = ['fr', 'r1', 'r2', 'r3', 'r4'];
const PLABEL = { fr: 'First watch', r1: 'Revision 1', r2: 'Revision 2', r3: 'Revision 3', r4: 'Revision 4' };
const SPEEDS = [1, 1.25, 1.5, 1.75, 2];
const KEY = 'pg27.v1';
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* ---------- dates (local, as YYYY-MM-DD strings) ---------- */
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => iso(new Date());
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const dayDiff = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
const fmtDay = s => { const d = parse(s); return `${d.getDate()} ${MON[d.getMonth()]}`; };
const fmtDayLong = s => { const d = parse(s); return `${DOW_LONG[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}`; };
const fmtDayYear = s => { const d = parse(s); return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`; };

/* ---------- formatting ---------- */
const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mins = m => {
  m = Math.round(m);
  if (m < 60) return `${m} min`;
  const hh = Math.floor(m / 60), mm = m % 60;
  return mm ? `${hh}h ${mm}m` : `${hh}h`;
};
const hrs = m => `${(m / 60).toFixed(m >= 6000 ? 0 : 1)}h`;
const sp = s => `${s}×`;
const pct = x => `${Math.round(x * 100)}%`;

/* ---------- state ---------- */
function defaults() {
  const progress = {};
  VIDS.forEach(v => v.done.forEach((x, i) => {
    if (x) (progress[v.id] ||= {})[PASSES[i]] = { d: D.sheetDoneDate, s: 1.5 };
  }));
  return {
    v: 1,
    settings: { start: '2026-10-02', target: '2027-01-15', exam: '2027-08-29', rest: [0], speed: 1.5, theme: 'auto' },
    progress,
    ui: { tab: 'today', subject: null, q: '' },
  };
}
function load() {
  const base = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const s = JSON.parse(raw);
    return { ...base, ...s, settings: { ...base.settings, ...s.settings }, ui: { ...base.ui, ...s.ui } };
  } catch { return base; }
}
let S = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* private mode: keep working in memory */ } }
const prog = id => S.progress[id] || {};
const isRest = s => S.settings.rest.includes(parse(s).getDay());
function studyDays(a, b) {
  let n = 0;
  for (let d = a; d <= b; d = addDays(d, 1)) if (!isRest(d)) n++;
  return n;
}

/* ---------- numbers everything else is built on ---------- */
function metrics() {
  const t = today(), st = S.settings;
  let total = 0, done = 0, doneBefore = 0, frToday = 0, realToday = 0, realAll = 0, wSpeed = 0, wMins = 0, doneCount = 0;
  const recentFrom = addDays(t, -13);
  let recent = 0;
  const activeDays = new Set();
  for (const v of VIDS) {
    total += v.mins;
    const p = prog(v.id);
    if (p.fr) {
      done += v.mins; doneCount++;
      if (p.fr.d < t) doneBefore += v.mins; else if (p.fr.d === t) frToday += v.mins;
      if (p.fr.d >= recentFrom && p.fr.d <= t) { recent += v.mins; activeDays.add(p.fr.d); }
      wSpeed += v.mins * p.fr.s; wMins += v.mins;
    }
    for (const k of PASSES) if (p[k]) {
      realAll += v.mins / p[k].s;
      if (p[k].d === t) realToday += v.mins / p[k].s;
    }
  }
  const avgSpeed = wMins ? wSpeed / wMins : null;
  // Plan with what you actually do once there's 2h+ of history, otherwise with the default.
  const planSpeed = wMins >= 120 ? avgSpeed : st.speed;
  const remaining = total - done;
  const restToday = isRest(t);
  const daysLeft = t <= st.target ? studyDays(t, st.target) : 0;
  const overdue = t > st.target && remaining > 0;
  let target = 0;
  if (overdue) target = remaining / planSpeed;
  else if (daysLeft > 0 && !restToday) target = (remaining + frToday) / planSpeed / daysLeft;
  const totalDays = studyDays(st.start, st.target);
  const elapsed = t > st.start ? studyDays(st.start, addDays(t, -1)) : 0;
  const expected = total * Math.min(1, totalDays ? elapsed / totalDays : 1);
  const behind = expected - doneBefore;
  const recentDays = studyDays(recentFrom < st.start ? st.start : recentFrom, t);
  const recentRate = recentDays ? recent / recentDays : 0;
  let projected = null;
  // Only project once there are 3+ days of history; one day says nothing about pace.
  if (activeDays.size >= 3 && recentRate > 0 && remaining > 0) {
    let need = remaining, d = t;
    while (need > 0) { d = addDays(d, 1); if (!isRest(d)) need -= recentRate; if (dayDiff(t, d) > 3650) break; }
    projected = d;
  }
  return {
    t, total, done, doneCount, remaining, frToday, realToday, realAll, avgSpeed, planSpeed,
    restToday, daysLeft, overdue, target, totalDays, elapsed, expected, behind, recentRate, projected,
    examDays: dayDiff(t, st.exam),
  };
}

/* ---------- Anki search strings ---------- */
const ankiQuery = (tags, onlySuspended) => {
  if (!tags.length) return '';
  const q = tags.map(t => `"tag:${t.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(' OR ');
  return onlySuspended ? `(${q}) is:suspended` : q;
};

/* ---------- small pieces ---------- */
const CHECK = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
function ring(frac, big, of) {
  const r = 48, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, frac));
  return `<div class="ring"><svg viewBox="0 0 116 116"><circle class="track" cx="58" cy="58" r="${r}"/>
    <circle class="bar" cx="58" cy="58" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - f)}"${f === 0 ? ' style="opacity:0"' : ''}/></svg>
    <div class="label"><div class="big num">${big}</div><div class="of">${of}</div></div></div>`;
}
function revPill(p) {
  let n = 0; for (const k of PASSES.slice(1)) if (p[k]) n++;
  return n ? `<span class="pill good">R${n}</span>` : '';
}
function videoItem(v, { showSubject = false, showBlock = true } = {}) {
  const p = prog(v.id), done = !!p.fr;
  const real = done ? v.mins / p.fr.s : v.mins / S.settings.speed;
  const bits = [];
  if (showSubject) bits.push(h(v.subject));
  if (showBlock) bits.push(`Block ${v.block}`);
  bits.push(done ? `${fmtDay(p.fr.d)} at ${sp(p.fr.s)}` : `${mins(v.mins)} · ${mins(real)} at ${sp(S.settings.speed)}`);
  return `<li class="item${done ? ' done' : ''}">
    <button class="check${done ? ' on' : ''}" data-act="${done ? 'open' : 'mark'}" data-id="${v.id}" aria-label="${done ? 'Watched: open details' : 'Mark watched'}">${CHECK}</button>
    <button class="open" data-act="open" data-id="${v.id}"><div class="t">${h(v.title)}</div><div class="s num">${bits.join(' · ')}</div></button>
    <div class="end">${revPill(p)}</div>
  </li>`;
}

/* ---------- views ---------- */
function setHeader(title, meta) {
  document.getElementById('title').textContent = title;
  document.getElementById('top-meta').innerHTML = meta || '';
}

function viewToday() {
  const m = metrics(), st = S.settings;
  setHeader('Today', `${fmtDayLong(m.t)}`);
  let status, line;
  const frac = m.target ? m.realToday / m.target : (m.realToday ? 1 : 0);
  if (m.remaining <= 0) { status = 'First watch complete'; line = 'Every WOR video is done. Revisions are next.'; }
  else if (m.restToday) { status = 'Rest day'; line = m.realToday ? `You still put in ${mins(m.realToday)}.` : 'Nothing is due today. Your target spreads over study days only.'; }
  else if (m.realToday >= m.target) { status = 'Target met'; line = `${mins(m.realToday)} done. Anything more lowers tomorrow's target.`; }
  else if (m.realToday > 0) { status = `${mins(m.target - m.realToday)} to go`; line = `${mins(m.realToday)} of ${mins(m.target)} done.`; }
  else { status = `${mins(m.target)} today`; line = `Real time at ${sp(+m.planSpeed.toFixed(2))} to finish WOR by ${fmtDay(st.target)}.`; }

  const behindCls = m.behind > 60 ? 'bad' : m.behind > 0 ? 'warn' : 'good';
  const behindTxt = m.behind > 0 ? `${hrs(m.behind)} behind` : `${hrs(-m.behind)} ahead`;
  const ringBig = m.target ? pct(Math.min(frac, 9.99)) : mins(m.realToday);
  const ringOf = m.target ? `of ${mins(m.target)}` : 'today';

  // Up next: fill the rest of today's target, in sheet (block) order.
  const left = Math.max(0, m.target - m.realToday);
  const pending = VIDS.filter(v => !prog(v.id).fr);
  const next = [];
  let acc = 0;
  for (const v of pending) {
    if (next.length >= 10) break;
    if (next.length && acc >= left) break;
    next.push(v); acc += v.mins / m.planSpeed;
  }
  if (left === 0 && next.length > 2) next.length = 2;
  let nextHtml = '', lastBlock = null;
  for (const v of next) {
    if (v.block !== lastBlock) { nextHtml += `<li class="group-h">Block ${v.block} · ${h(v.subject)}</li>`; lastBlock = v.block; }
    nextHtml += videoItem(v, { showBlock: false });
  }

  const doneToday = VIDS.filter(v => PASSES.some(k => prog(v.id)[k]?.d === m.t));
  const frTodayVids = doneToday.filter(v => prog(v.id).fr?.d === m.t);
  const tagsToday = [...new Set(frTodayVids.flatMap(v => v.tags))];

  return `
  <section class="card">
    <div class="hero">
      ${ring(frac, ringBig, ringOf)}
      <div class="hero-text grow">
        <p class="status">${status}</p>
        <p>${line}</p>
      </div>
    </div>
    <div class="stats">
      <div class="stat ${behindCls}"><div class="v num">${m.remaining > 0 ? behindTxt : 'Done'}</div><div class="k">vs. even pace from ${fmtDay(st.start)}</div></div>
      <div class="stat"><div class="v num">${m.daysLeft}</div><div class="k">study days to ${fmtDay(st.target)}</div></div>
      <div class="stat"><div class="v num">${m.examDays}</div><div class="k">days to exam (est.)</div></div>
    </div>
  </section>

  ${m.remaining > 0 ? `
  <div class="section-h"><h2>${left > 0 ? 'Up next' : 'Bonus, if you want it'}</h2><span class="aside num">${mins(acc)} real time</span></div>
  <ul class="card flush list">${nextHtml}</ul>` : ''}

  ${doneToday.length ? `
  <div class="section-h"><h2>Done today</h2><span class="aside num">${mins(m.realToday)}</span></div>
  <ul class="card flush list">${doneToday.map(v => videoItem(v)).join('')}</ul>` : ''}

  ${frTodayVids.length ? `
  <div class="section-h"><h2>Anki for today's videos</h2><span class="aside">${tagsToday.length} tags</span></div>
  <section class="card">
    <p class="small muted" style="margin:0 0 10px">Paste into the Anki browser search, select all, then unsuspend (Ctrl/⌘+J on desktop).</p>
    <div class="btns">
      <button class="btn primary" data-act="copy" data-q="${h(ankiQuery(tagsToday, true))}">Copy suspended cards</button>
      <button class="btn" data-act="copy" data-q="${h(ankiQuery(tagsToday, false))}">Copy all cards</button>
    </div>
    <div class="spacer"></div>
    <div class="note"><b>Draft mapping.</b> These tags come from the sheet and haven't been checked against your Anki collection yet.</div>
  </section>` : ''}

  ${m.projected ? `<p class="small faint" style="text-align:center;margin-top:20px">At your last two weeks' pace, WOR first watch finishes ${fmtDayYear(m.projected)}.</p>` : ''}
  `;
}

function viewVideos() {
  const ui = S.ui;
  setHeader('Videos', `<span class="num">${VIDS.filter(v => prog(v.id).fr).length} / ${VIDS.length}</span> watched`);
  const q = ui.q.trim().toLowerCase();
  const grid = SUBJECTS.map(s => {
    const vs = VIDS.filter(v => v.subject === s);
    const tot = vs.reduce((a, v) => a + v.mins, 0);
    const dn = vs.reduce((a, v) => a + (prog(v.id).fr ? v.mins : 0), 0);
    return `<button class="subj" data-act="subject" data-s="${h(s)}" aria-pressed="${ui.subject === s}">
      <div class="n">${h(s)}</div>
      <div class="m num">${vs.filter(v => prog(v.id).fr).length}/${vs.length} · ${hrs(tot - dn)} left</div>
      <div class="bar-line"><i style="width:${tot ? (dn / tot) * 100 : 0}%"></i></div>
    </button>`;
  }).join('');

  let list = '';
  if (q) {
    const hits = VIDS.filter(v => (v.title + ' ' + v.subject + ' ' + v.notes).toLowerCase().includes(q));
    list = `<div class="section-h"><h2>Results</h2><span class="aside num">${hits.length}</span></div>` +
      (hits.length ? `<ul class="card flush list">${hits.map(v => videoItem(v, { showSubject: true })).join('')}</ul>`
        : `<div class="card empty"><div class="e1">No videos match “${h(ui.q)}”</div>Try a shorter word, like “thyroid”.</div>`);
  } else if (ui.subject) {
    const vs = VIDS.filter(v => v.subject === ui.subject);
    const tot = vs.reduce((a, v) => a + v.mins, 0);
    list = `<div class="section-h" id="subject-list"><h2>${h(ui.subject)}</h2><span class="aside num">${vs.length} videos · ${hrs(tot)}</span></div>
      <ul class="card flush list">${vs.map(v => videoItem(v)).join('')}</ul>`;
  }

  return `
  <div class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>
    <input id="q" type="search" placeholder="Search videos and topics" value="${h(ui.q)}" autocomplete="off" enterkeyhint="search"></div>
  ${q ? list : `<div class="section-h"><h2>Subjects</h2><span class="aside">Tap one to see its videos</span></div>
  <div class="subjects">${grid}</div>${list}`}`;
}

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
  let plan = [], act = [], cumPlan = 0, cumAct = 0;
  const perDay = m.total / (m.totalDays || 1);
  // Anything logged before the start date counts on day one.
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
  for (let i = 0; i < days; i++) { const d = addDays(st.start, i); if (d.endsWith('-01') || i === 0) months.push(`<text x="${x(i)}" y="${H - 8}" text-anchor="${i === 0 ? 'start' : 'middle'}">${MON[parse(d).getMonth()]}</text>`); }
  const nowI = dayDiff(st.start, m.t);
  const nowLine = nowI >= 0 && nowI < days ? `<line class="now" x1="${x(nowI)}" x2="${x(nowI)}" y1="${T}" y2="${H - B}"/>` : '';
  const area = act.length ? `<polygon class="area" points="${x(0)},${y(0)} ${act.join(' ')} ${act[act.length - 1].split(',')[0]},${y(0)}"/>` : '';
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Hours of WOR watched against the plan">
    ${ticks}${months.join('')}${nowLine}
    <polyline class="plan" points="${plan.join(' ')}"/>${area}
    ${act.length ? `<polyline class="actual" points="${act.join(' ')}"/>` : ''}
  </svg>
  <div class="legend"><span><i></i>Watched (runtime hours)</span><span><i class="plan"></i>Even pace to ${fmtDay(st.target)}</span></div>`;
}

function heatmap(m) {
  const weeks = 15;
  const end = addDays(m.t, 6 - parse(m.t).getDay());
  const startD = addDays(end, -(weeks * 7) + 1);
  const real = {};
  for (const v of VIDS) { const p = prog(v.id); for (const k of PASSES) if (p[k]) real[p[k].d] = (real[p[k].d] || 0) + v.mins / p[k].s; }
  const ref = Math.max(60, m.target || 180);
  let cells = '';
  for (let d = startD; d <= end; d = addDays(d, 1)) {
    const val = real[d] || 0;
    const l = val <= 0 ? 0 : val < ref * .35 ? 1 : val < ref * .7 ? 2 : val < ref ? 3 : 4;
    const cls = [d > m.t ? 'future' : '', isRest(d) && !val ? 'rest' : ''].filter(Boolean).join(' ');
    cells += `<i data-l="${l}"${cls ? ` class="${cls}"` : ''} title="${fmtDay(d)}: ${mins(val)}"></i>`;
  }
  return `<div class="heat">${cells}</div>
    <div class="legend"><span>Last ${weeks} weeks · darker = closer to that day's target · dashed = rest day</span></div>`;
}

function viewProgress() {
  const m = metrics();
  setHeader('Progress', `${pct(m.done / m.total)} of WOR`);
  const subj = SUBJECTS.map(s => {
    const vs = VIDS.filter(v => v.subject === s);
    const tot = vs.reduce((a, v) => a + v.mins, 0);
    const dn = vs.reduce((a, v) => a + (prog(v.id).fr ? v.mins : 0), 0);
    const cnt = vs.filter(v => prog(v.id).fr).length;
    return `<li class="item"><button class="open" data-act="goto-subject" data-s="${h(s)}">
      <div class="row"><div class="t grow">${h(s)}</div><div class="small muted num">${cnt}/${vs.length} · ${hrs(dn)} / ${hrs(tot)}</div></div>
      <div class="bar-line" style="margin-top:8px"><i style="width:${(dn / tot) * 100}%"></i></div></button></li>`;
  }).join('');
  const revCounts = PASSES.map(k => VIDS.filter(v => prog(v.id)[k]).length);
  return `
  <section class="card">
    <div class="hero">
      ${ring(m.done / m.total, pct(m.done / m.total), 'watched')}
      <div class="hero-text grow">
        <p class="status num">${hrs(m.done)} of ${hrs(m.total)}</p>
        <p class="num">${m.doneCount} of ${VIDS.length} videos · ${hrs(m.remaining)} runtime left</p>
        <p class="num">${hrs(m.remaining / m.planSpeed)} real time left at ${sp(+m.planSpeed.toFixed(2))}</p>
      </div>
    </div>
    <div class="stats">
      <div class="stat"><div class="v num">${hrs(m.realAll)}</div><div class="k">time spent watching</div></div>
      <div class="stat"><div class="v num">${m.avgSpeed ? sp(+m.avgSpeed.toFixed(2)) : '–'}</div><div class="k">your average speed</div></div>
      <div class="stat"><div class="v num">${m.recentRate ? mins(m.recentRate) : '–'}</div><div class="k">runtime per study day, last 2 wks</div></div>
    </div>
  </section>

  <div class="section-h"><h2>Pace</h2><span class="aside">${fmtDay(S.settings.start)} – ${fmtDay(S.settings.target)}</span></div>
  <section class="card">${paceChart(m)}</section>

  <div class="section-h"><h2>Activity</h2></div>
  <section class="card">${heatmap(m)}</section>

  <div class="section-h"><h2>Passes</h2></div>
  <section class="card"><div class="stats" style="grid-template-columns:repeat(5,1fr);margin:0">
    ${PASSES.map((k, i) => `<div class="stat"><div class="v num">${revCounts[i]}</div><div class="k">${k === 'fr' ? 'First' : k.toUpperCase()}</div></div>`).join('')}
  </div></section>

  <div class="section-h"><h2>Subjects</h2></div>
  <ul class="card flush list">${subj}</ul>`;
}

function viewSettings() {
  const st = S.settings;
  setHeader('Settings', '');
  const seg = (act, opts, cur, lab = x => x) => `<div class="seg">${opts.map(o => `<button data-act="${act}" data-v="${o}" aria-pressed="${String(o) === String(cur)}">${lab(o)}</button>`).join('')}</div>`;
  return `
  <div class="section-h"><h2>Plan</h2></div>
  <section class="card">
    <div class="field" style="margin-top:0"><label for="s-start">Started on</label><input id="s-start" type="date" data-set="start" value="${st.start}"></div>
    <div class="field"><label for="s-target">Finish WOR first watch by</label><input id="s-target" type="date" data-set="target" value="${st.target}"></div>
    <div class="field"><label for="s-exam">Exam date</label><input id="s-exam" type="date" data-set="exam" value="${st.exam}">
      <p class="small faint" style="margin:6px 0 0">NBEMS hasn't announced NEET PG 2027 yet. This is an estimate based on 30 Aug 2026.</p></div>
    <div class="field"><span class="lbl">Rest days</span><div class="days">${DOW.map((d, i) => `<button data-act="rest" data-v="${i}" aria-pressed="${st.rest.includes(i)}" aria-label="${DOW_LONG[i]}">${d}</button>`).join('')}</div></div>
    <div class="field" style="margin-bottom:0"><span class="lbl">Usual watching speed</span>${seg('speed', SPEEDS, st.speed, sp)}
      <p class="small faint" style="margin:6px 0 0">Pre-selected when you mark a video. Once you've logged 2 hours, plans use your real average instead.</p></div>
  </section>

  <div class="section-h"><h2>Appearance</h2></div>
  <section class="card">${seg('theme', ['auto', 'light', 'dark'], st.theme, x => x[0].toUpperCase() + x.slice(1))}</section>

  <div class="section-h"><h2>Backup</h2></div>
  <section class="card">
    <p class="small muted" style="margin:0 0 12px">Progress is saved on this device only. Export a backup now and then, and import it to move to another phone or browser.</p>
    <div class="btns">
      <button class="btn" data-act="export">Export backup</button>
      <label class="btn" for="import-file">Import backup</label>
      <input id="import-file" type="file" accept="application/json,.json" hidden>
    </div>
    <div class="spacer"></div>
    <button class="btn ghost danger" data-act="reset">Reset all progress</button>
  </section>

  <p class="small faint" style="text-align:center;margin-top:20px">${VIDS.length} ${h(D.source)} videos · ${hrs(VIDS.reduce((a, v) => a + v.mins, 0))} runtime · from your EXAM_PREP sheet</p>`;
}

/* ---------- sheets (bottom panels) ---------- */
let sheet = null; // { kind, id, speed, date }
function openSheet(s) { sheet = s; renderSheet(); }
function closeSheet() { sheet = null; document.getElementById('sheet-root').innerHTML = ''; }
function renderSheet() {
  const root = document.getElementById('sheet-root');
  if (!sheet) { root.innerHTML = ''; return; }
  const v = BY[sheet.id], p = prog(v.id);
  const speedSeg = `<div class="seg">${SPEEDS.map(s => `<button data-act="sheet-speed" data-v="${s}" aria-pressed="${s === sheet.speed}">${sp(s)}</button>`).join('')}</div>`;
  let body;
  if (sheet.kind === 'mark') {
    body = `
      <h3>${h(v.title)}</h3>
      <div class="sub num">${h(v.subject)} · Block ${v.block} · ${mins(v.mins)} runtime</div>
      <div class="field"><span class="lbl">Watched at</span>${speedSeg}</div>
      <div class="field"><label for="sheet-date">On</label><input id="sheet-date" type="date" value="${sheet.date}" max="${today()}"></div>
      <button class="btn primary block" data-act="confirm-mark">Mark watched · ${mins(v.mins / sheet.speed)}</button>`;
  } else {
    const rows = PASSES.map(k => {
      const x = p[k];
      return `<div class="pass"><div class="pn">${PLABEL[k].replace('Revision ', 'R')}</div>
        <div class="pd num">${x ? `${fmtDay(x.d)} · ${sp(x.s)} · ${mins(v.mins / x.s)}` : 'Not yet'}</div>
        ${x ? `<button class="btn ghost danger" data-act="unpass" data-k="${k}">Undo</button>`
            : `<button class="btn ghost" data-act="pass" data-k="${k}">Mark</button>`}</div>`;
    }).join('');
    body = `
      <h3>${h(v.title)}</h3>
      <div class="sub num">${h(v.subject)} · Block ${v.block} · ${mins(v.mins)} runtime</div>
      ${v.notes ? `<p class="small" style="margin:0 0 4px">${h(v.notes)}</p>` : ''}
      <div class="field"><span class="lbl">Speed for new marks (today)</span>${speedSeg}</div>
      <div class="passes">${rows}</div>
      <div class="field"><span class="lbl">Anki tags · ${v.tags.length}</span>
        ${v.tags.length ? `<div class="tags">${v.tags.map(t => `<div class="tag">${h(t)}</div>`).join('')}</div>
        <div class="btns"><button class="btn primary" data-act="copy" data-q="${h(ankiQuery(v.tags, true))}">Copy suspended</button>
        <button class="btn" data-act="copy" data-q="${h(ankiQuery(v.tags, false))}">Copy all</button></div>
        <div class="spacer"></div>` : '<p class="small muted">No tags mapped yet.</p>'}
        <div class="note"><b>Draft mapping.</b> We'll replace this with your checked tags once your Anki tag list is in.</div>
      </div>`;
  }
  root.innerHTML = `<div class="scrim" data-act="close"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${h(v.title)}"><div class="grab"></div>${body}</div>`;
}

/* ---------- render ---------- */
const VIEWS = { today: viewToday, videos: viewVideos, progress: viewProgress, settings: viewSettings };
function applyTheme() {
  const t = S.settings.theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}
function render({ keepScroll = true } = {}) {
  const y = window.scrollY;
  const tab = VIEWS[S.ui.tab] ? S.ui.tab : 'today';
  document.getElementById('view').innerHTML = VIEWS[tab]();
  document.querySelectorAll('#tabs button').forEach(b => b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false'));
  if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
  if (sheet) renderSheet();
}

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
  }
  toast('Copied. Paste it into Anki search.');
}

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const tabBtn = e.target.closest('#tabs button');
  if (tabBtn) { S.ui.tab = tabBtn.dataset.tab; save(); closeSheet(); render({ keepScroll: false }); return; }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const a = el.dataset.act, id = el.dataset.id;
  switch (a) {
    case 'mark': openSheet({ kind: 'mark', id, speed: S.settings.speed, date: today() }); break;
    case 'open': openSheet({ kind: 'detail', id, speed: S.settings.speed }); break;
    case 'close': closeSheet(); break;
    case 'sheet-speed': sheet.speed = +el.dataset.v; renderSheet(); break;
    case 'confirm-mark': {
      const d = document.getElementById('sheet-date').value || today();
      (S.progress[sheet.id] ||= {}).fr = { d, s: sheet.speed };
      save(); const title = BY[sheet.id].title; closeSheet(); render();
      toast(`Watched: ${title}`); break;
    }
    case 'pass': (S.progress[sheet.id] ||= {})[el.dataset.k] = { d: today(), s: sheet.speed }; save(); render(); break;
    case 'unpass': {
      const p = S.progress[sheet.id]; delete p[el.dataset.k];
      if (!Object.keys(p).length) delete S.progress[sheet.id];
      save(); render(); break;
    }
    case 'copy': copy(el.dataset.q); break;
    case 'subject': {
      S.ui.subject = S.ui.subject === el.dataset.s ? null : el.dataset.s; save(); render();
      if (S.ui.subject) document.getElementById('subject-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      break;
    }
    case 'goto-subject': S.ui.tab = 'videos'; S.ui.subject = el.dataset.s; S.ui.q = ''; save(); render({ keepScroll: false });
      document.getElementById('subject-list')?.scrollIntoView({ block: 'start' }); break;
    case 'speed': S.settings.speed = +el.dataset.v; save(); render(); break;
    case 'theme': S.settings.theme = el.dataset.v; save(); applyTheme(); render(); break;
    case 'rest': {
      const i = +el.dataset.v, r = S.settings.rest;
      S.settings.rest = r.includes(i) ? r.filter(x => x !== i) : [...r, i];
      if (S.settings.rest.length > 6) S.settings.rest = r;
      save(); render(); break;
    }
    case 'export': {
      const blob = new Blob([JSON.stringify({ app: 'pg27', exported: new Date().toISOString(), state: S }, null, 1)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `pg27-backup-${today()}.json`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      break;
    }
    case 'reset':
      if (confirm('Delete all progress on this device? Export a backup first if you might want it back.')) {
        const keep = S.settings; S = defaults(); S.progress = {}; S.settings = keep; S.ui.tab = 'settings'; save(); render(); toast('Progress reset');
      }
      break;
  }
});

document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.set && el.value) {
    S.settings[el.dataset.set] = el.value; save(); render(); return;
  }
  if (el.id === 'import-file' && el.files[0]) {
    el.files[0].text().then(txt => {
      const data = JSON.parse(txt);
      if (data.app !== 'pg27' || !data.state?.progress) throw new Error('bad file');
      if (!confirm(`Replace progress on this device with the backup from ${data.exported?.slice(0, 10) || 'that file'}?`)) return;
      const base = defaults();
      S = { ...base, ...data.state, settings: { ...base.settings, ...data.state.settings }, ui: { ...base.ui, tab: 'today' } };
      save(); applyTheme(); render({ keepScroll: false }); toast('Backup imported');
    }).catch(() => toast("That file isn't a PG 2027 backup")).finally(() => { el.value = ''; });
  }
});

let qTimer;
document.addEventListener('input', e => {
  if (e.target.id !== 'q') return;
  S.ui.q = e.target.value;
  clearTimeout(qTimer);
  qTimer = setTimeout(() => {
    save(); render();
    const q = document.getElementById('q');
    if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  }, 150);
});

document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheet) closeSheet(); });

// Re-render when the app comes back, so "today" rolls over at midnight.
let lastDay = today();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && today() !== lastDay) { lastDay = today(); render(); }
});

applyTheme();
render({ keepScroll: false });

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
})();
