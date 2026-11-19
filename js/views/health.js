// Sleep and energy: a one-tap morning check-in, plus Apple Health data sent in by an
// iPhone Shortcut (web apps can't read Health directly, but a Shortcut can open this app
// with last night's numbers in the link).
import { S, save, today, addDays, parse, MON, h, mins, hrs } from '../core.js';
import { toast, copy, sectionH } from '../ui.js';

const ENERGY = [[1, '😴'], [2, '😕'], [3, '🙂'], [4, '😊'], [5, '⚡']];
const num = (v, lo, hi) => { const n = parseFloat(v); return Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n * 10) / 10 : null; };

// ?health=1&date=2026-11-19&sleep=7.4&hrv=55&rhr=58&steps=9000
export function ingestFromUrl() {
  const q = new URLSearchParams(location.search);
  if (!q.has('health')) return false;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(q.get('date') || '') ? q.get('date') : today();
  const rec = { ...(S.health[d] || {}), src: 'health' };
  // Shortcuts sometimes send sleep in minutes or seconds; convert anything that can't be hours.
  let sl = parseFloat(q.get('sleep'));
  if (sl > 1000) sl /= 3600; else if (sl > 24) sl /= 60;
  const sleep = num(sl, 0, 16), hrv = num(q.get('hrv'), 1, 300), rhr = num(q.get('rhr'), 20, 200), steps = num(q.get('steps'), 0, 100000);
  if (sleep != null) rec.sleep = sleep;
  if (hrv != null) rec.hrv = hrv;
  if (rhr != null) rec.rhr = rhr;
  if (steps != null) rec.steps = Math.round(steps);
  S.health[d] = rec; save();
  history.replaceState(null, '', location.pathname); // tidy the link so a refresh doesn't re-import
  toast(`Health data saved${sleep != null ? `: ${sleep}h sleep` : ''}${hrv != null ? `, HRV ${hrv}` : ''}`);
  return true;
}

export function checkinCard() {
  const t = today(), x = S.health[t] || {};
  if (x.energy && x.sleep != null && !S.ui.editCheckin) {
    return `<button class="checkin done" data-act="ci-edit"><span>🌙 <b class="num">${x.sleep}h</b> sleep${x.hrv ? ` · HRV <b class="num">${x.hrv}</b>` : ''} · energy ${ENERGY[x.energy - 1][1]}</span><span class="faint small">Edit</span></button>`;
  }
  return `<section class="card checkin">
    <div class="ci-q">How did you sleep?${x.src === 'health' ? ' <span class="pill accent">from Health</span>' : ''}</div>
    <div class="chips">${[5, 6, 7, 8, 9].map(n => `<button class="chip" data-act="ci-sleep" data-v="${n}" aria-pressed="${Math.round(x.sleep ?? -1) === n}">${n}h${n === 9 ? '+' : ''}</button>`).join('')}</div>
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

export function healthSettings() {
  const base = location.origin + location.pathname;
  return `<p class="small muted" style="margin:0 0 10px">Apps on the web can't read Apple Health, but an iPhone Shortcut can send last night's sleep (and HRV and resting heart rate from your Watch) to PG 2027 every morning.</p>
    <details class="setup"><summary>Set up the Shortcut (5 minutes)</summary><ol class="small">
      <li><b>First, sign in to Sync in Safari too.</b> A Shortcut can only open links in Safari, which keeps its data apart from the home-screen app, so sync is what carries the numbers across. Open this site in Safari once, skip through the welcome, and sign in under Settings → Sync.</li>
      <li>Shortcuts app → <b>+</b> → Add Action → <b>Find Health Samples</b>: Type <i>Sleep</i>, Start Date <i>is in the last 1 day</i>. Add <b>Calculate Statistics</b> → <i>Sum</i> of those samples. Rename that result to <code>Sleep</code>.</li>
      <li>Optional: another <b>Find Health Samples</b> for <i>Heart Rate Variability</i> (last 1 day) → <b>Calculate Statistics</b> → <i>Average</i>, renamed <code>HRV</code>. Same for <i>Resting Heart Rate</i> → <code>RHR</code>.</li>
      <li>Add <b>Text</b> with the link below, putting the <i>Sleep</i>, <i>HRV</i> and <i>RHR</i> results in place of the words in capitals. Then add <b>Open URLs</b>.</li>
      <li>Automation tab → <b>+</b> → <i>Time of Day</i> (e.g. 7:00 am) → <i>Run Immediately</i> → this Shortcut.</li></ol>
      <div class="tag" style="margin:8px 0">${h(base)}?health=1&amp;sleep=SLEEP&amp;hrv=HRV&amp;rhr=RHR</div>
      <button class="btn block" data-act="health-copy">Copy the link</button>
      <p class="hint">Sleep can be in hours, minutes or seconds; the app works out which.</p></details>`;
}

export const actions = {
  'ci-sleep': el => { const t = today(); S.health[t] = { ...(S.health[t] || {}), sleep: +el.dataset.v, src: S.health[t]?.src || 'checkin' }; save(); },
  'ci-energy': el => { const t = today(); S.health[t] = { ...(S.health[t] || {}), energy: +el.dataset.v }; S.ui.editCheckin = false; save(); },
  'ci-edit': () => { S.ui.editCheckin = true; },
  'health-copy': () => copy(`${location.origin + location.pathname}?health=1&sleep=SLEEP&hrv=HRV&rhr=RHR`, 'Link copied. Paste it into the Shortcut’s Text action.'),
};
