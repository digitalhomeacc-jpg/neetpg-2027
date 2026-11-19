// State, dates and the numbers every screen is built on.

export const D = window.WOR;
export const VIDS = D.videos;
export const BY = Object.fromEntries(VIDS.map(v => [v.id, v]));
export const SUBJECTS = D.subjects.filter(s => VIDS.some(v => v.subject === s));
export const PASSES = ['fr', 'r1', 'r2', 'r3', 'r4', 'r5'];
export const PLABEL = { fr: 'First watch', r1: 'R1', r2: 'R2', r3: 'R3', r4: 'R4', r5: 'R5' };
// Each revision gets less time than the last, and comes after a longer gap.
// budget = share of the video's runtime; gap = days after the previous pass.
export const REV = {
  r1: { budget: 0.50, gap: 3 },
  r2: { budget: 0.35, gap: 10 },
  r3: { budget: 0.25, gap: 30 },
  r4: { budget: 0.15, gap: 60 },
  r5: { budget: 0.10, gap: 90 },
};
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
  const progress = {};
  VIDS.forEach(v => v.done.forEach((x, i) => {
    if (x) (progress[v.id] ||= {})[PASSES[i]] = { d: D.sheetDoneDate, s: 1.5 };
  }));
  return {
    v: 2,
    settings: { start: '2026-10-02', target: '2027-01-15', exam: '2027-08-29', rest: [0], speed: 1.5, theme: 'auto', questions: 200 },
    progress,
    tests: [],     // {id, name, type, date, n, c, w, rank, notes}
    mistakes: [],  // {id, date, subject, video, reason, note, test, done}
    days: {},      // date -> {t: target minutes that day}
    goals: {},     // goal id -> true
    sessions: [],  // focus sessions: {id, d, m, kind}
    badges: {},    // achievement id -> date unlocked
    ui: { tab: 'today', subject: null, q: '', whatif: null, phase: null },
  };
}
export function mergeState(raw) {
  const base = defaults();
  if (!raw) return base;
  return {
    ...base, ...raw, v: 2,
    settings: { ...base.settings, ...raw.settings },
    ui: { ...base.ui, ...raw.ui },
    tests: raw.tests || [], mistakes: raw.mistakes || [], days: raw.days || {}, goals: raw.goals || {},
    sessions: raw.sessions || [], badges: raw.badges || {},
  };
}
function load() {
  try { return mergeState(JSON.parse(localStorage.getItem(KEY))); } catch { return defaults(); }
}
export let S = load();
export function replaceState(n) { S = n; save(); }
export function resetProgress() {
  const keep = S.settings, hist = S.history; S = defaults(); S.progress = {}; S.settings = keep; S.history = hist; save();
}
export function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* private mode: keep going in memory */ } }

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
export function revInfo(v, t = today()) {
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
  return { k, due, pulled, budget: Math.max(2, Math.round(v.mins * REV[k].budget)), overdue: dayDiff(due, t) };
}
export function revisionsDue(t = today()) {
  return VIDS.map(v => ({ v, r: revInfo(v, t) })).filter(x => x.r?.k && x.r.due <= t)
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
      wSpeed += v.mins * p.fr.s; wMins += v.mins;
    }
    for (const k of PASSES) if (p[k]) realAll += passMins(v, p[k]);
  }
  const byDay = realByDay();
  const realToday = byDay[t] || 0;
  const sessDay = sessionsByDay();
  const otherToday = sessDay[t] || 0;
  const otherAll = S.sessions.reduce((a, x) => a + x.m, 0);
  const avgSpeed = wMins ? wSpeed / wMins : null;
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
  const minimum = (restToday ? 0 : target * 0.5) + Math.min(MUST_REV_CAP, mustMins + revDoneToday);
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
    t, total, done, doneCount, remaining, frToday, realToday, realAll, avgSpeed, planSpeed, byDay, sessDay, otherToday, otherAll,
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
export function forecast(m, realPerDay = m.target) {
  const days = [];
  const pending = VIDS.filter(v => !prog(v.id).fr);
  if (!pending.length || realPerDay <= 0) return days;
  let d = m.t, cap = m.restToday ? 0 : Math.max(0, realPerDay - m.realToday);
  let cur = { date: d, cap, items: [], total: 0 };
  const push = () => { if (cur.items.length) days.push(cur); };
  for (const v of pending) {
    const real = v.mins / m.planSpeed;
    // Start a new day when this video would push the day more than 15% over.
    while (cur.items.length ? cur.total + real > cur.cap * 1.15 : cur.cap < Math.min(real, realPerDay) * 0.5) {
      push();
      do { d = addDays(d, 1); } while (isRest(d));
      cur = { date: d, cap: realPerDay, items: [], total: 0 };
      if (days.length > 2000) return days;
    }
    cur.items.push({ v, real }); cur.total += real;
  }
  push();
  return days;
}

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
export const ankiQuery = (tags, onlySuspended) => {
  if (!tags.length) return '';
  const q = tags.map(t => `"tag:${t.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(' OR ');
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
