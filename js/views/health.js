// Sleep and energy: a one-tap morning check-in, plus Apple Health data sent in by an
// iPhone Shortcut (web apps can't read Health directly, but a Shortcut can open this app
// with last night's numbers in the link).
import { S, save, today, addDays, parse, iso, MON, h, mins, hrs } from '../core.js';
import { toast, copy, sectionH } from '../ui.js';
import * as sync from '../sync.js';

const ENERGY = [[1, '😴'], [2, '😕'], [3, '🙂'], [4, '😊'], [5, '⚡']];
const num = (v, lo, hi) => { const n = parseFloat(v); return Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n * 10) / 10 : null; };

// Shortcuts sends a sleep total in many shapes depending on the phone's language and iOS version:
// "7.4", "7,4", "444", "26,640", "26640 s", "444 min", "7.4 hr", "7 hr 24 min", "7:24". Hours out.
export function sleepHours(raw) {
  if (raw == null) return null;
  let s = String(raw).toLowerCase().trim().replace(/\u00a0/g, ' ');
  if (!s) return null;
  const hm = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (hm) return +hm[1] + +hm[2] / 60;
  const hPart = s.match(/([\d.,]+)\s*(h|hr|hrs|hour|hours)\b/), mPart = s.match(/([\d.,]+)\s*(m|min|mins|minute|minutes)\b/);
  const n = x => { x = x.replace(/,(\d{3})(?!\d)/g, '$1'); return parseFloat(x.replace(',', '.')); };
  if (hPart || mPart) return (hPart ? n(hPart[1]) : 0) + (mPart ? n(mPart[1]) / 60 : 0);
  const v = n(s);
  if (!Number.isFinite(v)) return null;
  if (/\b(s|sec|secs|second|seconds)\b/.test(s)) return v / 3600;
  if (v > 1000) return v / 3600;   // seconds
  if (v > 24) return v / 60;       // minutes
  return v;
}

// A date as Shortcuts writes it: ISO 8601 ("2026-11-21T03:12:00+05:30", from Format Date →
// ISO 8601) or the phone's medium style ("21 Nov 2026 at 3:12 AM", "Nov 21, 2026 at 3:12 AM").
const MONS = 'jan feb mar apr may jun jul aug sep oct nov dec'.split(' ');
// Day before month (India, UK) or month before day (US), as this phone writes dates.
const DAY_FIRST = (() => { try { const p = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'numeric' }).formatToParts(new Date(2026, 10, 20)); return p.findIndex(x => x.type === 'day') < p.findIndex(x => x.type === 'month'); } catch { return true; } })();
const NUM_RE = /(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4}),?\s*(?:at\s+)?(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?\s*([ap]\.?\s?m\.?)?/i;
export function parseWhen(s) {
  s = String(s || '').trim().replace(/\u202f|\u00a0/g, ' ');
  if (!s) return NaN;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return Date.parse(s);
  const n = s.match(NUM_RE);
  if (n) {
    let [, a, b, y, hh, mm, ap] = n; a = +a; b = +b; y = +y; if (y < 100) y += 2000;
    // Whichever can't be a month settles it; otherwise follow the phone's own order.
    const dayFirst = a > 12 ? true : b > 12 ? false : DAY_FIRST;
    const day = dayFirst ? a : b, mon = dayFirst ? b : a;
    hh = +hh; if (ap) { const pm = /p/i.test(ap); if (pm && hh < 12) hh += 12; if (!pm && hh === 12) hh = 0; }
    return new Date(y, mon - 1, day, hh, +mm).getTime();
  }
  let m = s.match(/(\d{1,2})[\s\-/.]+([A-Za-z]{3})[A-Za-z]*\.?[\s\-/.,]+(\d{4}),?\s+(?:at\s+)?(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?\s*([ap]\.?m\.?)?/i)
    || s.match(/([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{1,2}),?\s+(\d{4}),?\s+(?:at\s+)?(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?\s*([ap]\.?m\.?)?/i);
  if (!m) return NaN;
  let [, a, b, y, hh, mm, ap] = m;
  const [day, mon] = /\d/.test(a) ? [+a, b] : [+b, a];
  const mi = MONS.indexOf(mon.slice(0, 3).toLowerCase()); if (mi < 0) return NaN;
  hh = +hh; if (ap) { const pm = /p/i.test(ap); if (pm && hh < 12) hh += 12; if (!pm && hh === 12) hh = 0; }
  return new Date(+y, mi, day, hh, +mm).getTime();
}
// Every date in a list, however it was joined (commas, new lines, spaces).
const ISO_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?/g;
const MED_RE = /\d{1,2}[\s\-/.]+[A-Za-z]{3}[A-Za-z]*\.?[\s\-/.,]+\d{4},?\s+(?:at\s+)?\d{1,2}[:.]\d{2}(?:[:.]\d{2})?\s*(?:[ap]\.?m\.?)?|[A-Za-z]{3}[A-Za-z]*\.?\s+\d{1,2},?\s+\d{4},?\s+(?:at\s+)?\d{1,2}[:.]\d{2}(?:[:.]\d{2})?\s*(?:[ap]\.?m\.?)?/gi;
export function listWhens(s) {
  s = String(s || '').replace(/\u202f|\u00a0/g, ' ');
  const iso = s.match(ISO_RE);
  const parts = iso && iso.length ? iso : (s.match(MED_RE) || s.match(new RegExp(NUM_RE.source, 'gi')) || []);
  const bits = s.split(/[,;\n]+/).map(x => x.trim()).filter(Boolean);
  return { list: parts.map(parseWhen), found: parts.length, guess: bits[0] || '' };
}
const dayStart = d => parse(d).getTime();
// Sleep segments (start and end lists, in the same order) → minutes asleep in each calendar day.
// Overlapping samples (Watch and iPhone both tracking, or stages) are merged first, so nothing
// counts twice. The run time `at` decides which days are complete: the day it ran and the day
// before (the Shortcut looks back 2 days, so both are fully covered).
export function sleepByDay(ss, se, at) {
  const A = listWhens(ss), B = listWhens(se);
  if (!A.found && !B.found) return { err: String(ss || se || '').trim() ? `couldn't read the times (it sent "${String(ss || se).slice(0, 30)}")` : 'no sleep samples were sent (check the filters, or nothing was recorded)' };
  if (A.found !== B.found) return { err: `${A.found} start times but ${B.found} end times` };
  const iv = [];
  for (let i = 0; i < A.found; i++) {
    const a = A.list[i], b = Math.min(B.list[i], at);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return { err: 'couldn\'t read one of the times' };
    if (b > a) iv.push([a, b]);
  }
  iv.sort((x, y) => x[0] - y[0]);
  const merged = [];
  for (const x of iv) { const l = merged[merged.length - 1]; if (l && x[0] <= l[1]) l[1] = Math.max(l[1], x[1]); else merged.push([...x]); }
  const runDay = iso(new Date(at)), days = {};
  for (const d of [addDays(runDay, -1), runDay]) {
    const d0 = dayStart(d), d1 = dayStart(addDays(d, 1));
    const segs = merged.map(([a, b]) => [Math.max(a, d0), Math.min(b, d1)]).filter(([a, b]) => b > a).map(([a, b]) => [Math.round((a - d0) / 60000), Math.round((b - d0) / 60000)]);
    days[d] = { mins: segs.reduce((t, [a, b]) => t + b - a, 0), segs, upTo: d === runDay ? Math.round((at - d0) / 60000) : 1440 };
  }
  return { days };
}
// Apply what a Shortcut sent: sleep segments (ss/se) or a single total (sleep), plus HRV and RHR.
// Returns a line for the toast.
export function applyHealth(q, at = Date.now()) {
  const g = k => q[k] ?? null;
  const hrv = num(g('hrv'), 1, 300), rhr = num(g('rhr'), 20, 200), runDay = iso(new Date(at));
  if (g('ss') != null || g('se') != null) {
    const r = sleepByDay(g('ss'), g('se'), at);
    const rec = { ...(S.health[runDay] || {}), src: 'health' };
    if (r.err) { rec.err = r.err; rec.raw = String(g('ss') || '').slice(0, 40); }
    else {
      for (const [d, x] of Object.entries(r.days)) {
        const o = d === runDay ? rec : { ...(S.health[d] || {}), src: 'health' };
        o.sleep = Math.round(x.mins / 6) / 10; o.slp = x.segs; o.upTo = x.upTo; delete o.err; delete o.raw;
        if (d !== runDay) S.health[d] = o;
      }
    }
    if (hrv != null) rec.hrv = hrv;
    if (rhr != null) rec.rhr = rhr;
    S.health[runDay] = rec; save();
    return r.err ? `Health data arrived, but sleep couldn't be read: ${r.err}` : `Sleep updated: ${S.health[addDays(runDay, -1)].sleep}h yesterday, ${rec.sleep}h today so far`;
  }
  return null;
}

// ?health=1&ss=…&se=…&hrv=55&rhr=58   (sleep segments)
// ?health=1&date=2026-11-19&sleep=7.4&hrv=55&rhr=58&steps=9000   (a total)
export function ingestFromUrl() {
  const q = new URLSearchParams(location.search);
  if (!q.has('health')) return false;
  if (q.has('ss') || q.has('se')) {
    const msg = applyHealth(Object.fromEntries(q));
    history.replaceState(null, '', location.pathname);
    toast(msg); return true;
  }
  const d = /^\d{4}-\d{2}-\d{2}$/.test(q.get('date') || '') ? q.get('date') : today();
  const rec = { ...(S.health[d] || {}), src: 'health' };
  const raw = q.get('sleep');
  let sl = sleepHours(raw);
  if (sl != null && sl < 0.5) sl = NaN; // 0h: the Shortcut's filters most likely removed every sample
  const sleep = num(sl, 0, 16), hrv = num(q.get('hrv'), 1, 300), rhr = num(q.get('rhr'), 20, 200), steps = num(q.get('steps'), 0, 100000);
  // Keep what arrived and, if it couldn't be used, why: shown on Today, not only in a toast.
  rec.raw = raw == null ? null : String(raw).slice(0, 40);
  rec.err = raw == null ? 'no sleep value in the link' : Number.isNaN(sl) ? '0h (the filters probably removed every sample)' : sleep == null ? `couldn't read "${String(raw).slice(0, 24)}"` : null;
  if (!rec.err) delete rec.err;
  if (sleep != null) rec.sleep = sleep;
  if (hrv != null) rec.hrv = hrv;
  if (rhr != null) rec.rhr = rhr;
  if (steps != null) rec.steps = Math.round(steps);
  S.health[d] = rec; save();
  history.replaceState(null, '', location.pathname); // tidy the link so a refresh doesn't re-import
  toast(raw && Number.isNaN(sl) ? 'The Shortcut sent 0h of sleep, so nothing was saved. Its filters probably removed every sample: see Settings → Apple Health.'
    : raw && sleep == null ? `Couldn't read the sleep value "${String(raw).slice(0, 24)}". Check the Shortcut steps in Settings → Apple Health.`
    : `Health data saved${sleep != null ? `: ${sleep}h sleep` : ''}${hrv != null ? `, HRV ${hrv}` : ''}`);
  return true;
}

const hm = x => { const t = Math.round(x * 60); return `${Math.floor(t / 60)}h ${String(t % 60).padStart(2, '0')}m`; };
export function checkinCard() {
  const t = today(), x = S.health[t] || {};
  if (x.energy && x.sleep != null && !S.ui.editCheckin) {
    return `<button class="checkin done" data-act="ci-edit"><span>🌙 <b class="num">${hm(x.sleep)}</b> sleep${x.hrv ? ` · HRV <b class="num">${x.hrv}</b>` : ''} · energy ${ENERGY[x.energy - 1][1]}</span><span class="faint small">Edit</span></button>`;
  }
  return `<section class="card checkin">
    <div class="ci-q">How did you sleep?${x.src === 'health' ? ` <span class="pill accent">from Health${x.sleep != null ? `: ${hm(x.sleep)}` : ''}</span>` : ''}</div>
    ${x.src === 'health' && x.err ? `<p class="small warn-t" style="margin:4px 0 8px">The Shortcut ran, but sleep wasn't saved: ${h(x.err)}${x.raw != null && !/it sent/.test(x.err) ? ` (it sent "${h(x.raw)}")` : ''}. Pick your hours below, and see Settings → Apple Health.</p>` : ''}
    <div class="chips">${[5, 6, 7, 8, 9].map(n => `<button class="chip" data-act="ci-sleep" data-v="${n}" aria-pressed="${x.sleep != null && Math.min(9, Math.max(5, Math.round(x.sleep))) === n}">${n === 5 ? '≤5h' : n === 9 ? '9h+' : `${n}h`}</button>`).join('')}</div>
    <div class="ci-q" style="margin-top:12px">Energy right now?</div>
    <div class="chips energy">${ENERGY.map(([n, e]) => `<button class="chip" data-act="ci-energy" data-v="${n}" aria-pressed="${x.energy === n}">${e}</button>`).join('')}</div>
  </section>`;
}

// Study hours against sleep for the last 14 days, and what the difference has been.
export function sleepCard(m) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(m.t, i - 13));
  const study = d => ((m.byDay[d] || 0) + (m.sessDay[d] || 0)) / 60;
  const have = days.filter(d => S.health[d]?.sleep != null);
  if (have.length < 3) {
    return `<section class="card empty small"><div class="ei">🌙</div><div class="e1">Sleep and study</div>Check in on Today for a few days (or connect Apple Health in Settings) to see how sleep affects your study.</section>`;
  }
  const W = 360, H = 150, L = 24, B = 20, T = 8, bw = (W - L) / 14;
  const maxS = Math.max(6, ...days.map(study));
  const y = (v, max) => T + (1 - v / max) * (H - T - B);
  const bars = days.map((d, i) => `<rect x="${L + i * bw + 3}" width="${bw - 6}" y="${y(study(d), maxS)}" height="${H - B - y(study(d), maxS)}" rx="3" class="sbar"/>`).join('');
  const pts = days.map((d, i) => S.health[d]?.sleep != null ? [L + i * bw + bw / 2, y(S.health[d].sleep, 12)] : null);
  const line = pts.filter(Boolean).map(p => p.join(',')).join(' ');
  const labels = days.map((d, i) => i % 3 === 0 ? `<text x="${L + i * bw + bw / 2}" y="${H - 5}" text-anchor="middle">${parse(d).getDate()} ${MON[parse(d).getMonth()]}</text>` : '').join('');
  const good = have.filter(d => S.health[d].sleep >= 7), poor = have.filter(d => S.health[d].sleep < 7);
  const avg = ds => ds.reduce((a, d) => a + study(d), 0) / ds.length;
  const insight = good.length >= 2 && poor.length >= 2
    ? `After 7h+ of sleep you studied <b>${hrs(avg(good) * 60)}</b> a day, against <b>${hrs(avg(poor) * 60)}</b> after less.`
    : `Average sleep: <b>${(have.reduce((a, d) => a + S.health[d].sleep, 0) / have.length).toFixed(1)}h</b> over ${have.length} nights.`;
  return `<section class="card"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Study hours and sleep, last 14 days">${bars}
    ${line ? `<polyline class="sleep-line" points="${line}"/>` : ''}${pts.filter(Boolean).map(p => `<circle class="sleep-pt" cx="${p[0]}" cy="${p[1]}" r="3"/>`).join('')}${labels}</svg>
    <div class="legend"><span><i class="bar-key"></i>Study hours</span><span><i class="sleep-key"></i>Sleep (0–12h)</span></div>
    <p class="small" style="margin:10px 0 0">${insight}</p></section>`;
}

function alarmSetup(c) {
  const up = (S.alarmsOut || []).filter(a => Date.parse(a.at) > Date.now());
  const when = a => new Date(a.at).toLocaleString('en-IN', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  return `<div class="hk-sec"><b>Alarms</b>
    <p class="small muted" style="margin:4px 0 8px">Duty shifts and study blocks with an alarm (set them in the Day planner or Duty & free time) become real alarms in the Clock app, so they ring even through silent mode and sleep.</p>
    ${up.length ? `<ul class="list mini-list">${up.slice(0, 6).map(a => `<li class="item"><span class="grow small">⏰ <b>${h(when(a))}</b> · ${h(a.label)}</span></li>`).join('')}</ul>` : '<p class="small faint" style="margin:0 0 8px">No alarms set for the next two days.</p>'}
    <div class="btns" style="margin:4px 0 10px"><button class="btn" data-act="hk-test-alarm">Test alarm (in 3 min)</button><button class="btn" data-act="hk-resend">Send upcoming again</button></div>
    <div class="hk-row"><span class="hk-l">Alarms URL</span><code class="hk-v">${h(c.url)}/rest/v1/rpc/pg27_alarms</code><button class="btn small-btn" data-act="hk-copy" data-k="alarms">Copy</button></div>
    <details class="setup"><summary>Add alarms to your Shortcut (5 minutes, once)</summary><ol class="small">
      <li>In the <b>Sleep</b> Shortcut, at the end, add another <b>Get Contents of URL</b>: paste the Alarms URL, <b>›</b> → Method <b>POST</b>, header <code>apikey</code> (same as before), Request Body <b>JSON</b> with one Text field <code>k</code> = your key.</li>
      <li>Add <b>Repeat with Each</b>; it repeats with each item in <i>Contents of URL</i>.</li>
      <li>Inside the repeat: <b>Get Dictionary Value</b> → Value for <code>local</code> in <i>Repeat Item</i>. Then <b>Get Dates from Input</b>.</li>
      <li>Still inside: <b>Get Dictionary Value</b> → Value for <code>label</code> in <i>Repeat Item</i>.</li>
      <li>Still inside: <b>Create Alarm</b>. Tap its time and <b>don't type</b>: tap <b>Select Variable</b> (or the blue <i>Dates</i> chip above the keyboard) so it becomes a blue <i>Dates</i> pill. Do the same for the label with the second <i>Dictionary Value</i>. Turn off repeating.</li>
      <li>Your automations already run this Shortcut a few times a day, so each new alarm reaches the Clock app within hours of you setting it. Run it by hand after planning if the alarm is soon.</li>
    </ol><p class="hint">Each alarm is sent once, so running the Shortcut often never duplicates it. If you change or remove a block after its alarm was created, delete that alarm in the Clock app yourself: Shortcuts can't remove alarms.</p></details>
    <p class="hint">The account owner runs <code>tools/supabase_alarms.sql</code> once in Supabase first.</p></div>`;
}
export function healthSettings() {
  if (sync.account()) sync.healthCheck(false);
  const st = sync.status, acct = sync.account(), c = sync.syncConf();
  const rpc = `${c.url}/rest/v1/rpc/pg27_health_push`;
  const field = (label, val, k) => `<div class="hk-row"><span class="hk-l">${label}</span><code class="hk-v">${h(val)}</code><button class="btn small-btn" data-act="hk-copy" data-k="${k}">Copy</button></div>`;
  let top;
  if (!acct) top = `<p class="small">Sign in under <b>Sync between devices</b> above first. Health data travels through your account, so it reaches every device without opening Safari.</p>`;
  else if (st.healthError === 'needs-sql') top = `<p class="small warn-t">One-time setup: the account owner runs the "Apple Health without Safari" part at the end of <code>tools/supabase.sql</code> in Supabase (SQL Editor → Run).</p>
      ${st.healthErrorText ? `<p class="small faint" style="margin:0 0 10px">Supabase says: <code>${h(st.healthErrorText.slice(0, 220))}</code></p>` : ''}
      <button class="btn block" data-act="hk-check">I've run it: check again</button>`;
  else if (st.healthError) top = `<p class="small warn-t">Couldn't reach the Health table. Supabase says: <code>${h((st.healthErrorText || st.healthError).slice(0, 220))}</code></p><button class="btn block" data-act="hk-check">Check again</button>`;
  else if (!st.healthKey) top = `<p class="small" style="margin:0 0 10px">Your iPhone sends sleep (with exact times) to your account in the background, every time the Shortcut runs. The app picks it up whenever it's open, and every 15 minutes while it stays open.</p>
      <button class="btn primary block" data-act="hk-setup">Turn on automatic Health</button>`;
  else top = `<p class="small" style="margin:0 0 10px">${st.health?.at ? `Last delivery: <b>${new Date(st.health.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</b>.` : 'Waiting for the first delivery from your Shortcut.'} Copy these three into the Shortcut (they're yours: don't share the key).</p>
      ${field('URL', rpc, 'url')}${field('apikey', c.key, 'apikey')}${field('k (your key)', st.healthKey, 'key')}
      <details class="setup" open><summary>Build the Shortcut (10 minutes, once)</summary><ol class="small">
        <li><b>Find Health Samples</b>: Type <i>Sleep</i>, Start Date <i>is in the last</i> <b>2 days</b>. With an Apple Watch, add two filters <i>Value · is not</i> and type <code>In Bed</code> and <code>Awake</code>. Without a Watch, no filters.</li>
        <li><b>Get Details of Health Samples</b> → <i>Start Date</i>. Then <b>Format Date</b> → Date Format <i>ISO 8601</i>, <i>Include Time</i> on. Then <b>Combine Text</b> → <i>Custom</i>, type a comma <code>,</code>. Then <b>Set Variable</b> named <code>Starts</code>.</li>
        <li>Again for the end: <b>Get Details of Health Samples</b> → <i>End Date</i> (tap its input and pick the <i>Health Samples</i> from step 1), <b>Format Date</b> ISO 8601, <b>Combine Text</b> with <code>,</code>, <b>Set Variable</b> <code>Ends</code>.</li>
        <li><b>Get Contents of URL</b>: paste the URL above. Tap <i>Show More</i>: Method <b>POST</b>. Headers: add <code>apikey</code> with the apikey above. Request Body <b>JSON</b>: add Text fields <code>k</code> (your key), <code>ss</code> = variable <i>Starts</i>, <code>se</code> = variable <i>Ends</i>.</li>
        <li>Run it once. Add <b>Show Result</b> at the end the first time: it should say <code>ok</code>. Then open this app: Today shows the sleep, and Duty & free time shows when you slept.</li>
        <li><b>Run it by itself</b>: Automation tab → <b>+</b> → <i>Time of Day</i> → pick a time → <i>Daily</i> → <b>Run Immediately</b> (turn off <i>Notify When Run</i>) → this Shortcut. Make a few: e.g. 9 am, 1 pm, 6 pm, 11 pm. Also <b>+</b> → <i>Sleep</i> → <i>Waking Up</i> for right after you wake.</li>
      </ol><p class="hint">iPhone only lets Shortcuts read Health while the phone is unlocked, so a run while it's locked may send nothing; the next one catches up (each run covers the last 2 days).</p></details>`;
  return `<p class="small muted" style="margin:0 0 10px">Apps on the web can't read Apple Health directly, but an iPhone Shortcut can send your sleep (from your Watch or iPhone) to PG 2027.</p>
    ${top}
    ${st.healthKey ? alarmSetup(c) : ''}
    <details class="setup"><summary>Other way: open a link in Safari</summary><ol class="small">
      <li>Same as above up to <i>Set Variable Ends</i>, then a <b>Text</b> action with this link, putting <i>Starts</i> and <i>Ends</i> in place of the capitals, then <b>Open URLs</b>. It opens Safari each time, and Safari needs you signed in to Sync too.</li></ol>
      <div class="tag" style="margin:8px 0">${h(location.origin + location.pathname)}?health=1&amp;ss=STARTS&amp;se=ENDS</div>
      <button class="btn block" data-act="health-copy">Copy the link</button></details>`;
}

export const actions = {
  'ci-sleep': el => { const t = today(); const x = { ...(S.health[t] || {}), sleep: +el.dataset.v, src: S.health[t]?.src || 'checkin' }; delete x.err; S.health[t] = x; save(); },
  'ci-energy': el => { const t = today(); S.health[t] = { ...(S.health[t] || {}), energy: +el.dataset.v }; S.ui.editCheckin = false; save(); },
  'ci-edit': () => { S.ui.editCheckin = true; },
  'health-copy': () => copy(`${location.origin + location.pathname}?health=1&ss=STARTS&se=ENDS`, 'Link copied. Paste it into the Shortcut’s Text action.'),
  'hk-setup': async () => {
    try { await sync.healthSetup(); toast('Automatic Health is on. Copy the three values into your Shortcut.'); }
    catch (e) { toast(/pg27_health/i.test(e.message) ? 'Run the Apple Health part of tools/supabase.sql in Supabase first' : `Couldn't turn it on: ${e.message}`); }
    document.dispatchEvent(new Event('pg27:render'));
  },
  'hk-check': async () => { toast('Checking…'); await sync.healthCheck(true); document.dispatchEvent(new Event('pg27:render')); toast(sync.status.healthError === 'needs-sql' ? 'Still not found. Make sure the whole Apple Health block ran without errors, then try again in a minute.' : 'Found it. Tap Turn on automatic Health.'); },
  'hk-test-alarm': async () => {
    const at = new Date(Date.now() + 3 * 60000); at.setSeconds(0, 0);
    S.testAlarm = { at: at.toISOString() }; save();
    await sync.syncNow();
    toast(`Test alarm set for ${at.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}. Now run your Sleep Shortcut, then look in Clock → Alarms.`);
  },
  'hk-resend': async () => {
    try { await sync.syncNow(); await sync.resendAlarms(); toast('Done. The next Shortcut run creates all upcoming alarms again.'); }
    catch (e) { toast(/alarms_sent/.test(e.message) ? 'Run tools/supabase_alarms.sql in Supabase first' : `Couldn't do that: ${e.message}`); }
  },
  'hk-copy': el => { const c = sync.syncConf(), k = el.dataset.k; copy(k === 'url' ? `${c.url}/rest/v1/rpc/pg27_health_push` : k === 'alarms' ? `${c.url}/rest/v1/rpc/pg27_alarms` : k === 'apikey' ? c.key : sync.status.healthKey, 'Copied'); },
};
