// State, dates and the numbers every screen is built on.

export const D = window.WOR;
export const VIDS = D.videos;
for (const v of VIDS) v.sheetMins = v.mins;
export const BY = Object.fromEntries(VIDS.map(v => [v.id, v]));
export const SUBJECTS = D.subjects.filter(s => VIDS.some(v => v.subject === s));
// First read + 4 revisions.
export const PASSES = ['fr', 'r1', 'r2', 'r3', 'r4'];
export const PLABEL = { fr: 'First watch', r1: 'R1', r2: 'R2', r3: 'R3', r4: 'R4' };
// Each revision gets less time than the last, and comes after a longer gap.
// budget = share of the video's runtime; gap = days after the previous pass.
export const REV = {
  r1: { budget: 0.50, gap: 3 },
  r2: { budget: 0.35, gap: 10 },
  r3: { budget: 0.25, gap: 30 },
  r4: { budget: 0.15, gap: 60 },
};
// "By subject" mode: a subject's next round opens this many days after its previous round
// finished for every video of that subject (R1 once the whole subject is watched).
export const BLOCK_GAP = { r1: 2, r2: 14, r3: 30, r4: 45 };
// How much you recalled before revising stretches or shrinks the next gap.
export const RATINGS = [[1, 'Blank', 0.5], [2, 'Some', 0.75], [3, 'Most', 1], [4, 'All', 1.4]];
const RATE_MULT = Object.fromEntries(RATINGS.map(([q, , m]) => [q, m]));
export const ratingName = q => (RATINGS.find(r => r[0] === q) || [])[1] || '';
const MUST_REV_CAP = 120; // minutes of revision that count toward the day's bare minimum
export const SPEEDS = [1, 1.25, 1.5, 1.75, 2];
export const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const REASONS = [
  ['unknown', "Didn't know"], ['forgot', 'Forgot'], ['misread', 'Misread'], ['silly', 'Silly slip'], ['guess', 'Lucky guess'],
];
export const TEST_TYPES = [['gt', 'Grand test'], ['subject', 'Subject test'], ['pyq', 'PYQ set'], ['custom', 'Custom']];
// About 620/800 was rank ~1,500 in NEET PG 2025 (aggregator marks-vs-rank tables, not official).
export const TARGET_PCT = 0.775;
const KEY = 'pg27.v1';

/* ---------- dates: local YYYY-MM-DD strings ---------- */
const pad = n => String(n).padStart(2, '0');
export const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const today = () => iso(new Date());
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
export const dayDiff = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
export const dow = s => parse(s).getDay();
export const fmtDay = s => { const d = parse(s); return `${d.getDate()} ${MON[d.getMonth()]}`; };
export const fmtDow = s => { const d = parse(s); return `${DOW_SHORT[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`; };
export const fmtDayLong = s => { const d = parse(s); return `${DOW_LONG[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}`; };
export const fmtDayYear = s => { const d = parse(s); return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`; };
export const weekStart = s => addDays(s, -((dow(s) + 6) % 7)); // Monday

/* ---------- formatting ---------- */
export const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const mins = m => {
  m = Math.round(m);
  if (m < 60) return `${m} min`;
  const hh = Math.floor(m / 60), mm = m % 60;
  return mm ? `${hh}h ${mm}m` : `${hh}h`;
};
export const hrs = m => `${(m / 60).toFixed(m >= 6000 ? 0 : 1)}h`;
export const sp = s => `${+(+s).toFixed(2)}×`;
export const pct = x => `${Math.round(x * 100)}%`;
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

/* ---------- subject colours: one hue each, spaced around the wheel ---------- */
export const subjHue = s => Math.round((SUBJECTS.indexOf(s) * 360 / SUBJECTS.length + 155) % 360);
export const subjDot = s => `<i class="dot" style="--h:${subjHue(s)}"></i>`;

/* ---------- state ---------- */
function defaults() {
  // A fresh install starts empty; the welcome screen sets the dates.
  const t = iso(new Date());
  return {
    v: 2,
    onboarded: false,
    settings: { start: t, target: addDays(t, 75), exam: '2027-08-29', rest: [0], speed: 1.5, theme: 'auto', questions: 200, minPct: 0.5, revCap: 120, breath: 120, marrowUrl: 'https://www.marrow.com/', revMode: 'block', revDaily: 90, revRest: 0 },
    progress: {},
    tests: [],     // {id, name, type, date, n, c, w, rank, notes}
    mistakes: [],  // {id, date, subject, video, reason, note, test, done}
    days: {},      // date -> {t: target minutes that day}
    goals: {},     // goal id -> true
    sessions: [],  // focus sessions: {id, d, m, kind}
    plan: {},      // date -> [video ids] you picked for that day
    notes: {},     // video id -> your own notes
    pins: [],      // pinned facts: {id, video, text, d, done}
    health: {},    // date -> {sleep, hrv, rhr, steps, energy, src}
    reflect: {},   // week start -> {went, hard, change}
    pairs: [],     // lookalike concepts: {id, a, b, how, subject, d}
    rehearsals: [], // GT rehearsals: {id, date, checks}
    duty: {},      // date -> hospital duty hours that day
    revTime: {},   // date -> minutes for revision that day (else the default)
    mastery: {},   // concept id -> 'S' strong, 'h' shaky, 'W' weak
    pytLinks: {},  // PYT key -> {vid, ch} you linked (null = you unlinked it)
    runtimes: {},  // video id -> runtime in minutes you corrected (from Marrow)
    badges: {},    // achievement id -> date unlocked
    ui: { tab: 'today', subject: null, q: '', whatif: null, phase: null },
  };
}
export function mergeState(raw) {
  const base = defaults();
  if (!raw) return base;
  return {
    ...base, ...raw, v: 2,
    onboarded: raw.onboarded ?? true, // anyone who used the app before this screen existed skips it
    settings: { ...base.settings, ...raw.settings },
    ui: { ...base.ui, ...raw.ui },
    tests: raw.tests || [], mistakes: raw.mistakes || [], days: raw.days || {}, goals: raw.goals || {},
    sessions: raw.sessions || [], badges: raw.badges || {}, plan: raw.plan || {}, notes: raw.notes || {}, pins: raw.pins || [], health: raw.health || {}, reflect: raw.reflect || {}, pairs: raw.pairs || [], rehearsals: raw.rehearsals || [], runtimes: raw.runtimes || {}, duty: raw.duty || {}, revTime: raw.revTime || {}, pytLinks: raw.pytLinks || {}, mastery: raw.mastery || {},
  };
}
function load() {
  try { return mergeState(JSON.parse(localStorage.getItem(KEY))); } catch { return defaults(); }
}
export let S = load();
// A corrected runtime replaces the sheet's everywhere: plans, revision limits, totals.
export function applyRuntimes() { for (const v of VIDS) v.mins = S.runtimes?.[v.id] || v.sheetMins; }
applyRuntimes();
export function replaceState(n) { S = n; save(); }
export function resetProgress() {
  const keep = S.settings, hist = S.history; S = defaults(); S.settings = keep; S.history = hist; S.onboarded = true; save();
}
let saveVersion = 0;
const saveHooks = [];
export const onSave = fn => saveHooks.push(fn);
export function save() {
  saveVersion++;
  applyRuntimes();
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* private mode: keep going in memory */ }
  for (const fn of saveHooks) { try { fn(); } catch { /* a hook must never break saving */ } }
}

export const prog = id => S.progress[id] || {};
export const isRest = s => S.settings.rest.includes(dow(s));
export function studyDays(a, b) {
  let n = 0;
  for (let d = a; d <= b; d = addDays(d, 1)) if (!isRest(d)) n++;
  return n;
}

/* ---------- metrics ---------- */
export function realByDay() {
  const out = {};
  for (const v of VIDS) {
    const p = prog(v.id);
    for (const k of PASSES) if (p[k]) out[p[k].d] = (out[p[k].d] || 0) + passMins(v, p[k]);
  }
  return out;
}
export const FOCUS_KINDS = [['anki', 'Anki'], ['qbank', 'Q-bank'], ['pyq', 'PYQs'], ['notes', 'Notes'], ['other', 'Other']];
export function sessionsByDay() {
  const out = {};
  for (const x of S.sessions) out[x.d] = (out[x.d] || 0) + x.m;
  return out;
}
export const passMins = (v, x) => x.m != null ? x.m : v.mins / (x.s || 1);

/* ---------- spaced revisions ---------- */
export const nextPass = p => PASSES.find(k => !p[k]);
function rawRev(v, t) {
  const p = prog(v.id);
  if (!p.fr) return null;
  const k = nextPass(p);
  if (!k) return { k: null, complete: true };
  const i = PASSES.indexOf(k), prev = p[PASSES[i - 1]];
  // Squeeze the remaining gaps so the last revision still lands before the exam.
  const latest = addDays(S.settings.exam, -5);
  const left = PASSES.slice(i).reduce((a, kk) => a + REV[kk].gap, 0);
  const room = Math.max(i, dayDiff(prev.d, latest));
  const squeeze = Math.min(1, room / left);
  let gap = Math.max(1, Math.round(REV[k].gap * squeeze * (RATE_MULT[prev.q] ?? 1)));
  let due = addDays(prev.d, gap);
  // A mistake on this video since the last pass pulls the revision forward.
  const m = S.mistakes.filter(x => x.video === v.id && !x.done && x.date >= prev.d).map(x => addDays(x.date, 2)).sort()[0];
  const pulled = m && m < due;
  if (pulled) due = m;
  // Final six weeks: every revision gets 30% less time.
  const tight = dayDiff(t, S.settings.exam) <= 42 ? 0.7 : 1;
  return { k, due, pulled, gap, prev: prev.d, tight: tight < 1, budget: Math.max(2, Math.round(v.mins * REV[k].budget * tight)), overdue: dayDiff(due, t) };
}

// Smoothing: when too many revisions land on one day, move some R2–R4 up to a quarter
// of their gap earlier (or at most 2 days later) so no day goes over the revision cap.
let smoothKey = '', smoothMap = {};
function smoothing(t) {
  const key = `${saveVersion}|${t}`;
  if (key === smoothKey) return smoothMap;
  smoothKey = key; smoothMap = {};
  const cap = S.settings.revCap || 120;
  if (!cap) return smoothMap;
  const load = {}, add = (d, m) => { load[d] = (load[d] || 0) + m; };
  const items = [];
  for (const v of VIDS) {
    const r = rawRev(v, t);
    if (!r?.k) continue;
    if (r.due <= t) add(t, r.budget);
    else if (r.k === 'r1' || dayDiff(t, r.due) > 150) add(r.due, r.budget);
    else items.push({ v, r });
  }
  items.sort((a, b) => a.r.due.localeCompare(b.r.due) || b.r.budget - a.r.budget);
  const tomorrow = addDays(t, 1);
  for (const { v, r } of items) {
    const fits = d => (load[d] || 0) + r.budget <= cap;
    let d = r.due;
    if (!fits(d)) {
      let found = null;
      const back = Math.max(1, Math.floor(r.gap * 0.25));
      for (let o = 1; o <= back && !found; o++) { const c = addDays(r.due, -o); if (c >= tomorrow && c > r.prev && fits(c)) found = c; }
      for (let o = 1; o <= 2 && !found; o++) { const c = addDays(r.due, o); if (fits(c)) found = c; }
      // Nothing fits: use the least-busy day in the window rather than piling onto the due date.
      if (!found) {
        const opts = [];
        for (let o = -back; o <= 2; o++) { const c = addDays(r.due, o); if (c >= tomorrow && c > r.prev) opts.push(c); }
        found = opts.sort((a, b) => (load[a] || 0) - (load[b] || 0) || Math.abs(dayDiff(r.due, a)) - Math.abs(dayDiff(r.due, b)))[0];
      }
      if (found && found !== r.due) { d = found; smoothMap[v.id] = { k: r.k, due: d, from: r.due }; }
    }
    add(d, r.budget);
  }
  return smoothMap;
}
/* ---------- revising by subject (blocks) ---------- */
export const blockMode = () => (S.settings.revMode || 'block') === 'block';
// Minutes for revision on a day: what you set for that day, else your default.
export function revTimeOn(d) {
  if (S.revTime?.[d] != null) return S.revTime[d];
  return isRest(d) ? (S.settings.revRest ?? 0) : (S.settings.revDaily ?? 90);
}
const passBudget = (v, k, d) => Math.max(2, Math.round(v.mins * REV[k].budget * (dayDiff(d, S.settings.exam) <= 42 ? 0.7 : 1)));
// Lays revisions out day by day. Each subject goes round by round (R1 for all its videos,
// then later R2 …); a round opens BLOCK_GAP days after the previous round finished for the
// whole subject. Each day takes items, oldest open round first, until its revision time is
// used. With `watch` (a queue of videos still to watch and a function for the day's new-video
// time) it also plays out future first watches — that's the what-if simulation.
export function runBlocks({ from, until, revCap, watch = null, record = false }) {
  const st = S.settings, done = {}, last = {};
  for (const v of VIDS) { const p = prog(v.id); let i = -1; for (const k of PASSES) if (p[k]) i = PASSES.indexOf(k); done[v.id] = i; if (i >= 0) last[v.id] = p[PASSES[i]].d; }
  const subjVids = Object.fromEntries(SUBJECTS.map(s => [s, VIDS.filter(v => v.subject === s)]));
  const openAt = {};   // subject -> { r, at } the next round and the date it opens
  const refresh = s => {
    const vs = subjVids[s], r = Math.min(...vs.map(v => done[v.id])) + 1;
    if (r < 1 || r >= PASSES.length) { delete openAt[s]; return; }
    const prevDone = vs.reduce((a, v) => (last[v.id] && last[v.id] > a ? last[v.id] : a), '');
    // Videos already revised ahead for this round don't hold it back.
    openAt[s] = { r, at: addDays(prevDone || from, BLOCK_GAP[PASSES[r]]) };
  };
  SUBJECTS.forEach(refresh);
  const due = {}, passDone = {}, passLeft = {};
  for (const k of PASSES.slice(1)) { passLeft[k] = VIDS.filter(v => done[v.id] < PASSES.indexOf(k)).length; if (!passLeft[k]) passDone[k] = from; }
  let finish = VIDS.every(v => done[v.id] >= 0) ? from : null, revTotal = 0, newTotal = 0, revPeak = 0;
  const queue = watch ? [...watch.queue] : [];
  for (let d = from, g = 0; d <= until && g < 1500; d = addDays(d, 1), g++) {
    let cap = revCap(d), used = 0;
    for (;;) {
      const open = Object.entries(openAt).filter(([, o]) => o.at <= d).sort((a, b) => a[1].at.localeCompare(b[1].at) || a[1].r - b[1].r || SUBJECTS.indexOf(a[0]) - SUBJECTS.indexOf(b[0]));
      if (!open.length) break;
      const [s, o] = open[0], k = PASSES[o.r];
      const v = subjVids[s].find(x => done[x.id] === o.r - 1);
      if (!v) { refresh(s); continue; }
      const b = passBudget(v, k, d);
      if (cap - used < b && !(cap - used >= b * 0.5)) break;
      used += b; done[v.id] = o.r; last[v.id] = d;
      if (record && !due[v.id]) due[v.id] = { k, due: d, budget: b };
      if (--passLeft[k] === 0) passDone[k] = d;
      if (subjVids[s].every(x => done[x.id] >= o.r)) refresh(s);
    }
    revTotal += used; revPeak = Math.max(revPeak, used);
    if (watch && !isRest(d)) {
      let avail = watch.newCap(d, used);
      while (queue.length && avail > 0) {
        const v = queue[0], real = v.mins / watch.speed;
        if (real > avail && avail < real * 0.5) break;
        queue.shift(); avail -= real; newTotal += real; done[v.id] = 0; last[v.id] = d;
        if (subjVids[v.subject].every(x => done[x.id] >= 0)) refresh(v.subject);
        if (!queue.length) finish = d;
      }
    }
    if (!watch && !Object.keys(openAt).length) break;
  }
  return { due, passDone, passLeft, finish, revTotal, newTotal, revPeak };
}
let blockKey = '', blockPlan = {};
function blockDue() {
  const t = today(), key = `${saveVersion}|${t}`;
  if (key === blockKey) return blockPlan;
  blockKey = key;
  // Today's revision time, less what you've already revised today.
  let revisedToday = 0;
  for (const v of VIDS) { const p = prog(v.id); for (const k of PASSES.slice(1)) if (p[k]?.d === t) revisedToday += passMins(v, p[k]); }
  const cap = d => d === t ? Math.max(0, revTimeOn(d) - revisedToday) : revTimeOn(d);
  blockPlan = runBlocks({ from: t, until: addDays(S.settings.exam, 30), revCap: cap, record: true }).due;
  return blockPlan;
}
function blockRev(v, t) {
  const p = prog(v.id);
  if (!p.fr) return null;
  const k = nextPass(p);
  if (!k) return { k: null, complete: true };
  const i = PASSES.indexOf(k), prev = p[PASSES[i - 1]];
  const plan = blockDue()[v.id];
  const budget = passBudget(v, k, t);
  if (!plan || plan.k !== k) {
    // Its subject hasn't finished the round before (or isn't fully watched yet).
    return { k, due: null, waiting: true, gap: 0, prev: prev.d, budget, overdue: -999 };
  }
  return { k, due: plan.due, gap: dayDiff(prev.d, plan.due), prev: prev.d, budget, overdue: dayDiff(plan.due, t), block: true };
}

export function revInfo(v, t = today()) {
  if (blockMode()) return blockRev(v, t);
  const r = rawRev(v, t);
  if (!r?.k) return r;
  const adj = smoothing(today())[v.id];
  if (adj && adj.k === r.k && !r.pulled) { r.due = adj.due; r.moved = adj.from; r.overdue = dayDiff(r.due, t); }
  return r;
}
export function revisionsDue(t = today()) {
  return VIDS.map(v => ({ v, r: revInfo(v, t) })).filter(x => x.r?.k && x.r.due && x.r.due <= t)
    .sort((a, b) => a.r.due.localeCompare(b.r.due) || PASSES.indexOf(a.r.k) - PASSES.indexOf(b.r.k));
}
export function revisionsOn(d) {
  return VIDS.map(v => ({ v, r: revInfo(v) })).filter(x => x.r?.k && x.r.due === d);
}

export function metrics() {
  const t = today(), st = S.settings;
  let total = 0, done = 0, doneBefore = 0, frToday = 0, realAll = 0, wSpeed = 0, wMins = 0, doneCount = 0, recent = 0;
  const recentFrom = addDays(t, -13);
  const activeDays = new Set();
  for (const v of VIDS) {
    total += v.mins;
    const p = prog(v.id);
    if (p.fr) {
      done += v.mins; doneCount++;
      if (p.fr.d < t) doneBefore += v.mins; else if (p.fr.d === t) frToday += v.mins;
      if (p.fr.d >= recentFrom && p.fr.d <= t) { recent += v.mins; activeDays.add(p.fr.d); }
      // Effective speed = runtime ÷ real time (an average of speeds would overstate it).
      wSpeed += v.mins / (p.fr.s || st.speed || 1); wMins += v.mins;
    }
    for (const k of PASSES) if (p[k]) realAll += passMins(v, p[k]);
  }
  const byDay = realByDay();
  const realToday = byDay[t] || 0;
  const frRealToday = VIDS.reduce((a, v) => { const f = prog(v.id).fr; return a + (f?.d === t ? passMins(v, f) : 0); }, 0);
  const sessDay = sessionsByDay();
  const otherToday = sessDay[t] || 0;
  const otherAll = S.sessions.reduce((a, x) => a + x.m, 0);
  const avgSpeed = wMins ? wMins / wSpeed : null;
  // Plan with the speed you really watch at once there's 2h+ of history.
  const planSpeed = wMins >= 120 ? avgSpeed : st.speed;
  const remaining = total - done;
  const restToday = isRest(t);
  const daysLeft = t <= st.target ? studyDays(t, st.target) : 0;
  const overdue = t > st.target && remaining > 0;
  let target = 0;
  if (overdue) target = Math.min(remaining / planSpeed, 6 * 60);
  else if (daysLeft > 0 && !restToday) target = (remaining + frToday) / planSpeed / daysLeft;
  // Revisions: everything due today or overdue, plus what you've already revised today.
  const due = revisionsDue(t);
  let revDoneToday = 0, revDoneCount = 0;
  for (const v of VIDS) { const p = prog(v.id); for (const k of PASSES.slice(1)) if (p[k]?.d === t) { revDoneToday += passMins(v, p[k]); revDoneCount++; } }
  const dueMins = due.reduce((a, x) => a + x.r.budget, 0);
  const must = []; let mustMins = 0;
  for (const x of due) { if (must.length && mustMins + x.r.budget > MUST_REV_CAP - Math.min(revDoneToday, MUST_REV_CAP)) break; must.push(x); mustMins += x.r.budget; }
  const goal = target + dueMins + revDoneToday;
  const minPct = st.minPct ?? 0.5;
  const minimum = (restToday ? 0 : target * minPct) + Math.min(MUST_REV_CAP, mustMins + revDoneToday);
  // Remember the day's numbers so the week strip can show how past days went.
  if (goal && (!S.days[t] || Math.abs(S.days[t].t - goal) > 0.5 || Math.abs((S.days[t].min || 0) - minimum) > 0.5)) {
    S.days[t] = { t: Math.round(goal), min: Math.round(minimum) }; save();
  }

  const totalDays = studyDays(st.start, st.target);
  const elapsed = t > st.start ? studyDays(st.start, addDays(t, -1)) : 0;
  const expected = total * Math.min(1, totalDays ? elapsed / totalDays : 1);
  const behind = expected - doneBefore;
  const recentDays = studyDays(recentFrom < st.start ? st.start : recentFrom, t);
  const recentRate = recentDays ? recent / recentDays : 0;
  let projected = null;
  if (activeDays.size >= 3 && recentRate > 0 && remaining > 0) projected = finishDate(recentRate);

  // Streak: study days in a row with any watching. Rest days don't break it; today counts once you start.
  let streak = 0;
  const any = d => byDay[d] || sessDay[d];
  for (let d = any(t) ? t : addDays(t, -1), i = 0; i < 400; d = addDays(d, -1), i++) {
    if (any(d)) streak++;
    else if (!isRest(d)) break;
  }

  return {
    t, total, done, doneCount, remaining, frToday, realToday, frRealToday, realAll, avgSpeed, planSpeed, byDay, sessDay, otherToday, otherAll,
    due, dueMins, must, mustMins, revDoneToday, revDoneCount, goal, minimum,
    restToday, daysLeft, overdue, target, totalDays, elapsed, expected, behind, recentRate, projected, streak,
    examDays: dayDiff(t, st.exam),
  };
}

// Finish date if you cover `runtimePerDay` minutes of runtime every study day from tomorrow.
export function finishDate(runtimePerDay, from = today()) {
  let need = metricsRemaining(), d = from;
  if (need <= 0) return from;
  while (need > 0) { d = addDays(d, 1); if (!isRest(d)) need -= runtimePerDay; if (dayDiff(from, d) > 3650) return null; }
  return d;
}
const metricsRemaining = () => VIDS.reduce((a, v) => a + (prog(v.id).fr ? 0 : v.mins), 0);

/* ---------- forecast: lay the remaining videos out over study days ---------- */
// Lectures you've planned for a day go on that day. Planned ones you didn't get to
// carry over to the front of the queue. Days you haven't planned are filled with
// suggestions in sheet order, up to the day's required time.
export function forecast(m, realPerDay = m.target) {
  const t = m.t, days = [];
  const watched = id => !!prog(id).fr;
  const plannedAhead = new Set();
  for (const [d, ids] of Object.entries(S.plan)) if (d >= t) for (const id of ids) if (BY[id] && !watched(id)) plannedAhead.add(id);
  const carried = [];
  for (const d of Object.keys(S.plan).sort()) if (d < t) for (const id of S.plan[d]) if (BY[id] && !watched(id) && !plannedAhead.has(id) && !carried.includes(id)) carried.push(id);
  const pool = [...carried.map(id => BY[id]), ...VIDS.filter(v => !watched(v.id) && !plannedAhead.has(v.id) && !carried.includes(v.id))];
  let ahead = plannedAhead.size;
  for (let d = t, guard = 0; (pool.length || ahead) && guard < 1500; d = addDays(d, 1), guard++) {
    const rest = isRest(d);
    const mine = (S.plan[d] || []).filter(id => BY[id] && !watched(id));
    const cap = rest ? 0 : d === t ? Math.max(0, realPerDay - m.frRealToday) : realPerDay; // new-video time already spent today (revisions don't count)
    const day = { date: d, cap, items: [], total: 0, planned: (S.plan[d] || []).length > 0 };
    for (const id of mine) { const v = BY[id], real = v.mins / m.planSpeed; day.items.push({ v, real, planned: true }); day.total += real; ahead--; }
    if (!day.planned && !rest && realPerDay > 0) {
      while (pool.length) {
        const v = pool[0], real = v.mins / m.planSpeed;
        // Start the next day when this video would push the day more than 15% over.
        if (day.items.length ? day.total + real > cap * 1.15 : cap < Math.min(real, realPerDay) * 0.5) break;
        pool.shift(); day.items.push({ v, real, carried: carried.includes(v.id) }); day.total += real;
      }
    }
    if (day.items.length) days.push(day);
    if (!pool.length && ahead <= 0) break;
  }
  return days;
}
// Day-by-day simulation with a fixed amount of study time a day (minutes, real time).
// Each day: revisions that are due go first (oldest first), then new videos with what's left.
// This is what "can I finish by X on Y hours a day?" needs: revisions grow as you watch more,
// and together they take more time than the first watch itself. Days with duty hours entered
// (S.duty) use that day's free time instead, when it's smaller.
export function simulate(capMin, { until = S.settings.exam } = {}) {
  const m = metrics(), t = m.t, exam = S.settings.exam, latest = addDays(exam, -5);
  if (blockMode()) {
    // Each day: up to that day's revision time for revisions (by subject), the rest of the
    // day's hours for new videos.
    const dayCap = d => { let c = isRest(d) ? 0 : Math.min(capMin, freeMinutes(d) ?? capMin); if (d === t) c = Math.max(0, c - m.realToday); return c; };
    const revCap = d => isRest(d) ? Math.min(revTimeOn(d), freeMinutes(d) ?? revTimeOn(d)) : Math.min(revTimeOn(d), dayCap(d));
    const queue = forecast(m, Math.max(30, capMin)).flatMap(d => d.items.map(x => x.v));
    const r = runBlocks({ from: t, until, revCap, watch: { queue, speed: m.planSpeed, newCap: (d, used) => Math.max(0, dayCap(d) - used) } });
    return { finish: r.finish, revPeak: r.revPeak, revTotal: r.revTotal, newTotal: r.newTotal, revLeft: Object.values(r.passLeft).reduce((a, x) => a + x, 0), lateMax: 0, passDone: r.passDone, passLeft: r.passLeft };
  }
  const revs = [];
  for (const v of VIDS) { const r = rawRev(v, t); if (r?.k) revs.push({ due: r.due, v, i: PASSES.indexOf(r.k) }); }
  const queue = forecast(m, Math.max(30, capMin)).flatMap(d => d.items.map(x => x.v));
  // When each round (R1…R4) is done for every video. Rounds already complete count from today.
  const passDone = {}, passLeft = {};
  for (const k of PASSES.slice(1)) { passLeft[k] = VIDS.filter(v => !prog(v.id)[k]).length; if (!passLeft[k]) passDone[k] = t; }
  let finish = m.remaining <= 0 ? t : null, revPeak = 0, revTotal = 0, newTotal = 0, days = 0, lateMax = 0;
  for (let d = t, g = 0; d <= until && g < 1200; d = addDays(d, 1), g++) {
    let avail = isRest(d) ? 0 : Math.min(capMin, freeMinutes(d) ?? capMin);
    if (d === t) avail = Math.max(0, avail - m.realToday);
    const tight = dayDiff(d, exam) <= 42 ? 0.7 : 1;
    const due = revs.filter(r => r.due <= d).sort((a, b) => a.due.localeCompare(b.due));
    let revToday = 0;
    for (const r of due) {
      const b = Math.max(2, Math.round(r.v.mins * REV[PASSES[r.i]].budget * tight));
      if (avail < b && !(avail > 0 && b > capMin)) continue;
      avail -= b; revToday += b; lateMax = Math.max(lateMax, dayDiff(r.due, d));
      const kk = PASSES[r.i]; if (--passLeft[kk] === 0) passDone[kk] = d;
      revs.splice(revs.indexOf(r), 1);
      const k = r.i + 1;
      if (k < PASSES.length) {
        const left = PASSES.slice(k).reduce((a, kk) => a + REV[kk].gap, 0), room = Math.max(k, dayDiff(d, latest));
        revs.push({ due: addDays(d, Math.max(1, Math.round(REV[PASSES[k]].gap * Math.min(1, room / left)))), v: r.v, i: k });
      }
    }
    revPeak = Math.max(revPeak, revToday); revTotal += revToday;
    while (queue.length && avail > 0 && !isRest(d)) {
      const v = queue[0], real = v.mins / m.planSpeed;
      if (real > avail && avail < real * 0.5) break;
      queue.shift(); avail -= real; newTotal += real;
      const room = Math.max(1, dayDiff(d, latest)), sq = Math.min(1, room / PASSES.slice(1).reduce((a, kk) => a + REV[kk].gap, 0));
      revs.push({ due: addDays(d, Math.max(1, Math.round(REV.r1.gap * sq))), v, i: 1 });
      if (!queue.length) finish = d;
    }
    days++;
  }
  return { finish, revPeak, revTotal, newTotal, revLeft: revs.length, lateMax, passDone, passLeft };
}
// Study hours a day (revisions included) needed to finish the first watch by a date.
let needKey = '', needVal = null;
export function hoursNeeded(by = S.settings.target) {
  const key = `${saveVersion}|${today()}|${by}`;
  if (key === needKey) return needVal;
  let lo = 0.5, hi = 14;
  if ((simulate(hi * 60, { until: by }).finish || '9') > by) { needKey = key; return (needVal = null); }
  for (let i = 0; i < 7; i++) { const mid = (lo + hi) / 2; if ((simulate(mid * 60, { until: by }).finish || '9') <= by) hi = mid; else lo = mid; }
  needKey = key; return (needVal = Math.ceil(hi * 4) / 4);
}
// When the first watch finishes if you keep studying as much as in the last two weeks
// (real time a study day, revisions included). Revisions grow, so this is simulated too.
export function pace() {
  const m = metrics(), from = addDays(m.t, -13), st = S.settings;
  let sum = 0, days = 0, active = 0;
  for (let d = from < st.start ? st.start : from; d <= m.t; d = addDays(d, 1)) {
    if (isRest(d)) continue;
    days++; const x = m.byDay[d] || 0; sum += x; if (x) active++;
  }
  const perDay = days ? sum / days : 0;
  if (active < 3 || !perDay || m.remaining <= 0) return null;
  return { perDay, finish: simulate(perDay).finish };
}
// Free study time on a day from the duty hours you entered (null if none entered).
export function freeMinutes(d) {
  const x = S.duty?.[d];
  if (x == null) return null;
  const st = S.settings;
  return Math.max(0, ((st.awake ?? 16) - x - (st.essentials ?? 3)) * 60);
}

export const plannedOn = id => Object.keys(S.plan).filter(d => d >= today() && S.plan[d].includes(id)).sort()[0] || null;

/* ---------- phases from now to the exam ---------- */
export function phases() {
  const st = S.settings;
  const exam = st.exam, p1end = st.target;
  const p3start = addDays(exam, -120), p4start = addDays(exam, -42);
  return [
    {
      id: 'p1', name: 'WOR first watch', start: st.start, end: p1end,
      blurb: 'Watch every WOR video once and unsuspend its Anki cards the same day.',
      goals: [
        ['p1-wor', 'Finish all 271 WOR videos'],
        ['p1-anki', 'Unsuspend Anki cards for each video on the day you watch it'],
        ['p1-reviews', 'Clear Anki reviews every day (FSRS, ~0.90 retention)'],
        ['p1-pyq', 'Do the previous-year questions for each subject after its last video'],
      ],
    },
    {
      id: 'p2', name: 'BTR + PYQs + R1', start: addDays(p1end, 1), end: addDays(p3start, -1),
      blurb: 'Second source, topic-wise previous-year questions, first revision.',
      goals: [
        ['p2-btr', 'Finish BTR videos'],
        ['p2-pyq', 'Previous-year questions for every subject, topic-wise'],
        ['p2-r1', 'R1 of every subject'],
        ['p2-gt', 'One grand test a month, reviewed within 24 hours'],
      ],
    },
    {
      id: 'p3', name: 'Grand tests + R2/R3', start: p3start, end: addDays(p4start, -1),
      blurb: 'Test weekly, then twice a week. Reviewing each test matters more than taking it.',
      goals: [
        ['p3-gt', 'A grand test every week, then two a week'],
        ['p3-review', 'Log every wrong answer in the mistakes diary'],
        ['p3-r2', 'R2 of every subject'],
        ['p3-r3', 'R3 of weak subjects'],
      ],
    },
    {
      id: 'p4', name: 'Final sprint', start: p4start, end: exam,
      blurb: 'Fast revision, mistakes diary, and tests every few days. Nothing new.',
      goals: [
        ['p4-r4', 'R4: last fast pass of everything'],
        ['p4-diary', 'Go through the whole mistakes diary twice'],
        ['p4-gt', 'A grand test every 3 days, at exam time of day'],
        ['p4-sleep', 'Fix sleep to the exam schedule in the last 2 weeks'],
      ],
    },
  ];
}
export const currentPhase = (t = today()) => phases().find(p => t >= p.start && t <= p.end) || (t < S.settings.start ? phases()[0] : null);

/* ---------- tests ---------- */
export function testScore(t) {
  const n = +t.n, c = +t.c, w = +t.w;
  const score = 4 * c - w, max = 4 * n;
  return { score, max, frac: max ? score / max : 0, acc: c + w ? c / (c + w) : 0, skipped: Math.max(0, n - c - w) };
}

/* ---------- Anki search ---------- */
// Every video gets its own Anki tag, PG27::01_Anatomy::02_Embryology_Part_1 (added in Anki with
// tools/anki_apply_tags.py). Until that's done in Anki, searches fall back to the draft tags.
export const ANKI = window.ANKI || null;
const tagWord = s => s.replace(/&/g, 'and').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
export function pgTag(v) {
  const si = D.subjects.indexOf(v.subject) + 1, n = v.id.split('-').pop();
  return `PG27::${String(si).padStart(2, '0')}_${tagWord(v.subject)}::${n}_${tagWord(v.title)}`;
}
const pgPrefix = v => pgTag(v).replace(/::(\d+)_[^:]*$/, '::$1_*');
export const usePg = () => !!(ANKI && S.settings.ankiTagged);
// Without the PG27 tags in Anki, searches use your own tags that hold this video's cards
// (from the export), falling back to the sheet's draft tags.
export const vTags = v => {
  if (usePg()) return [pgPrefix(v)];
  const a = ANKI?.videos[v.id];
  const terms = [...(a?.top || []).slice(0, 8).map(t => t[0]), ...(a?.decks || []).map(d => 'deck:' + d[0])];
  return terms.length ? terms : v.tags;
};
export const ankiOf = v => ANKI?.videos[v.id] || null;
export const ankiQuery = (tags, onlySuspended) => {
  tags = tags.flatMap(t => typeof t === 'string' ? [t] : vTags(t));
  if (!tags.length) return '';
  // Entries starting "deck:" search a deck (and its subdecks); everything else is a tag.
  const esc = t => t.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const q = tags.map(t => t.startsWith('deck:') ? `"deck:${esc(t.slice(5))}"` : `"tag:${esc(t)}"`).join(' OR ');
  return onlySuspended ? `(${q}) is:suspended` : q;
};

/* ---------- levels and achievements ---------- */
// Level from total hours studied: L2 at 3h, L5 at 48h, L10 at 243h.
export function level(totalMins) {
  const h = totalMins / 60;
  const lv = Math.floor(Math.sqrt(h / 3)) + 1;
  const at = l => 3 * (l - 1) ** 2 * 60;
  return { lv, from: at(lv), to: at(lv + 1), frac: (totalMins - at(lv)) / (at(lv + 1) - at(lv)) };
}
export function achievements(m) {
  const passes = VIDS.reduce((a, v) => a + PASSES.slice(1).filter(k => prog(v.id)[k]).length, 0);
  const subjectDone = SUBJECTS.some(s => VIDS.filter(v => v.subject === s).every(v => prog(v.id).fr));
  const best = Math.max(0, ...S.tests.map(t => testScore(t).frac));
  const fixed = S.mistakes.filter(x => x.done).length;
  const hours = (m.realAll + m.otherAll) / 60;
  const list = [
    ['first', '🎬', 'First video', 'Watch one WOR video', m.doneCount >= 1],
    ['v50', '📚', '50 videos', 'Watch 50 WOR videos', m.doneCount >= 50],
    ['subject', '✅', 'Subject done', 'Finish every video in a subject', subjectDone],
    ['wor', '🏁', 'WOR complete', 'Watch all 271 videos', m.doneCount >= VIDS.length],
    ['rev1', '🔁', 'First revision', 'Finish an R1', passes >= 1],
    ['rev100', '🧠', '100 revisions', 'Finish 100 revision passes', passes >= 100],
    ['s7', '🔥', '7-day streak', 'Study 7 study days in a row', m.streak >= 7],
    ['s30', '⚡', '30-day streak', 'Study 30 study days in a row', m.streak >= 30],
    ['h100', '⏱️', '100 hours', 'Log 100 hours of study', hours >= 100],
    ['gt', '📝', 'First GT', 'Log a grand test', S.tests.some(t => t.type === 'gt')],
    ['zone', '🎯', 'In the zone', `Score ${Math.round(TARGET_PCT * 100)}%+ in a test`, best >= TARGET_PCT],
    ['fix10', '🩹', '10 fixed', 'Revisit 10 mistakes', fixed >= 10],
  ];
  return list.map(([id, icon, name, desc, got]) => ({ id, icon, name, desc, got: got || !!S.badges[id] }));
}
