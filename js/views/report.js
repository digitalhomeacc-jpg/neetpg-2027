// Weekly report with three reflection questions, a shareable progress image,
// and your best hours of the day.
import { S, VIDS, PASSES, prog, passMins, metrics, level, save, today, addDays, weekStart, dayDiff, testScore, h, mins, hrs, pct, fmtDay, fmtDow } from '../core.js';
import { sectionH, toast } from '../ui.js';

function weekStats(ws) {
  const we = addDays(ws, 6), inW = d => d >= ws && d <= we;
  let study = 0, videos = 0, revs = 0;
  const byDay = {};
  for (const v of VIDS) {
    const p = prog(v.id);
    for (const k of PASSES) { const x = p[k]; if (x && inW(x.d)) { const mm = passMins(v, x); study += mm; byDay[x.d] = (byDay[x.d] || 0) + mm; if (k === 'fr') videos++; else revs++; } }
  }
  for (const x of S.sessions) if (inW(x.d)) { study += x.m; byDay[x.d] = (byDay[x.d] || 0) + x.m; }
  const tests = S.tests.filter(t => inW(t.date));
  const avg = tests.length ? tests.reduce((a, t) => a + testScore(t).frac, 0) / tests.length : null;
  const logged = S.mistakes.filter(x => inW(x.date)).length;
  const best = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];
  const sleep = Array.from({ length: 7 }, (_, i) => S.health[addDays(ws, i)]?.sleep).filter(x => x != null);
  return { study, videos, revs, tests: tests.length, avg, logged, best, sleep: sleep.length ? sleep.reduce((a, b) => a + b, 0) / sleep.length : null, active: Object.keys(byDay).length };
}
const delta = (a, b, f = x => x) => b == null || a == null ? '' : a === b ? '<span class="faint">same as last week</span>' : `<span class="${a > b ? 'good-t' : 'bad-t'}">${a > b ? '▲' : '▼'} ${f(Math.abs(a - b))}</span>`;

const QUESTIONS = [['went', 'What went well?'], ['hard', 'What got in the way?'], ['change', 'One thing to change next week']];

export function view() {
  const t = today(), thisW = weekStart(t);
  const ws = S.ui.reportWeek || (dayDiff(thisW, t) >= 5 ? thisW : addDays(thisW, -7));
  const w = weekStats(ws), prev = weekStats(addDays(ws, -7));
  const r = S.reflect?.[ws] || {};
  return {
    title: 'Weekly report',
    meta: `${fmtDay(ws)} – ${fmtDay(addDays(ws, 6))}`,
    html: `
  <div class="seg" style="margin:4px 0 8px">${[[addDays(thisW, -7), 'Last week'], [thisW, 'This week']].map(([v, l]) => `<button data-act="rp-week" data-v="${v}" aria-pressed="${v === ws}">${l}</button>`).join('')}</div>
  <section class="card hero-card">
    <div class="stats" style="margin:0">
      <div class="stat"><div class="v num">${hrs(w.study)}</div><div class="k">studied ${delta(w.study, prev.study, hrs)}</div></div>
      <div class="stat"><div class="v num">${w.videos}</div><div class="k">new videos ${delta(w.videos, prev.videos)}</div></div>
      <div class="stat"><div class="v num">${w.revs}</div><div class="k">revisions ${delta(w.revs, prev.revs)}</div></div>
    </div>
    <div class="stats">
      <div class="stat"><div class="v num">${w.active}/7</div><div class="k">days you studied</div></div>
      <div class="stat"><div class="v num">${w.avg != null ? pct(w.avg) : '—'}</div><div class="k">${w.tests ? `avg of ${w.tests} test${w.tests > 1 ? 's' : ''}` : 'no tests'}</div></div>
      <div class="stat"><div class="v num">${w.sleep != null ? `${w.sleep.toFixed(1)}h` : '—'}</div><div class="k">average sleep</div></div>
    </div>
    ${w.best ? `<p class="small muted" style="margin:14px 0 0">Best day: <b>${fmtDow(w.best[0])}</b> with ${mins(w.best[1])}. ${w.logged ? `${w.logged} mistake${w.logged > 1 ? 's' : ''} logged.` : ''}</p>` : ''}
  </section>
  ${sectionH('Reflect', 'two minutes, every Sunday')}
  <section class="card">${QUESTIONS.map(([k, q]) => `<div class="field"${k === 'went' ? ' style="margin-top:0"' : ''}><label for="rf-${k}">${q}</label>
    <textarea id="rf-${k}" class="inp" rows="2" data-week="${ws}" data-k="${k}">${h(r[k] || '')}</textarea></div>`).join('')}
    <p class="hint">Saved as you type. Next week's report shows what you said you'd change.</p></section>
  ${S.reflect?.[addDays(ws, -7)]?.change ? `<section class="card note-card"><b>Last week you planned to change:</b> ${h(S.reflect[addDays(ws, -7)].change)}</section>` : ''}
  <button class="btn primary block" data-act="share-card">Share my progress card</button>`,
  };
}

/* ---------- shareable image ---------- */
function card() {
  const m = metrics(), w = weekStats(weekStart(today())), lv = level(m.realAll + m.otherAll);
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1350;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 1080, 1350); bg.addColorStop(0, '#062a1f'); bg.addColorStop(.55, '#05070b'); bg.addColorStop(1, '#0b1a33');
  g.fillStyle = bg; g.fillRect(0, 0, 1080, 1350);
  const font = (w, s) => `${w} ${s}px -apple-system, "SF Pro Rounded", system-ui, sans-serif`;
  g.fillStyle = '#34d399'; g.font = font(800, 40); g.fillText('PG 2027', 90, 150);
  g.fillStyle = '#f1f4f9'; g.font = font(800, 92); g.fillText('My week', 90, 260);
  // progress ring
  const frac = m.done / m.total, cx = 780, cy = 230, r = 120;
  g.lineWidth = 26; g.strokeStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
  const rg = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r); rg.addColorStop(0, '#34d399'); rg.addColorStop(1, '#60a5fa');
  g.strokeStyle = rg; g.lineCap = 'round'; g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(.01, frac)); g.stroke();
  g.fillStyle = '#f1f4f9'; g.font = font(800, 64); g.textAlign = 'center'; g.fillText(pct(frac), cx, cy + 22); g.font = font(600, 26); g.fillStyle = '#9aa4b5'; g.fillText('of WOR', cx, cy + 62); g.textAlign = 'left';
  const tiles = [[hrs(w.study), 'studied this week'], [`${m.streak}`, 'day streak'], [`${w.revs}`, 'revisions'], [`L${lv.lv}`, 'level']];
  tiles.forEach(([v, k], i) => {
    const x = 90 + (i % 2) * 460, y = 440 + Math.floor(i / 2) * 300;
    g.fillStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.roundRect(x, y, 420, 250, 40); g.fill();
    g.fillStyle = i === 1 ? '#34d399' : '#f1f4f9'; g.font = font(800, 96); g.fillText(v, x + 44, y + 140);
    g.fillStyle = '#9aa4b5'; g.font = font(600, 32); g.fillText(k, x + 44, y + 200);
  });
  g.fillStyle = '#646e80'; g.font = font(600, 30); g.fillText(`${m.examDays} days to NEET PG`, 90, 1230);
  // Built synchronously so the share sheet still counts as a response to your tap.
  const bin = atob(c.toDataURL('image/png').split(',')[1]);
  return new Blob([Uint8Array.from(bin, ch => ch.charCodeAt(0))], { type: 'image/png' });
}

/* ---------- best hours ---------- */
export function bestHours() {
  const bands = Array.from({ length: 12 }, () => ({ m: 0, q: 0, qn: 0 }));
  const add = (iso, mm, q) => { if (!iso || !mm) return; const start = new Date(new Date(iso).getTime() - mm * 60000); const b = Math.floor(start.getHours() / 2); bands[b].m += mm; if (q) { bands[b].q += q; bands[b].qn++; } };
  for (const v of VIDS) { const p = prog(v.id); for (const k of PASSES) { const x = p[k]; if (x?.t) add(x.t, passMins(v, x), k === 'fr' ? 0 : x.q); } }
  for (const x of S.sessions) if (x.t) add(x.t, x.m, 0);
  const total = bands.reduce((a, b) => a + b.m, 0);
  if (total < 120) return `<section class="card empty small"><div class="ei">🕰️</div><div class="e1">Your best hours</div>After a few days of using the timers, this shows when you study most and when you recall best.</section>`;
  const max = Math.max(...bands.map(b => b.m));
  const top = bands.map((b, i) => ({ i, m: b.m })).sort((a, b) => b.m - a.m)[0];
  const recall = bands.map((b, i) => ({ i, q: b.qn >= 2 ? b.q / b.qn : 0 })).filter(x => x.q).sort((a, b) => b.q - a.q)[0];
  const lab = i => { const s = i * 2; return `${s % 12 || 12}${s < 12 ? 'am' : 'pm'}`; };
  return `<section class="card"><div class="hours">${bands.map((b, i) => `<div class="hr"><span class="hb2" style="height:${max ? Math.max(2, (b.m / max) * 100) : 2}%"></span><span class="hl2">${i % 2 ? '' : lab(i)}</span></div>`).join('')}</div>
    <p class="small" style="margin:10px 0 0">You study most between <b>${lab(top.i)}–${lab(top.i + 1)}</b>${recall ? `, and recall best when revising around <b>${lab(recall.i)}</b>` : ''}. Put the hardest subjects there.</p></section>`;
}

export const actions = {
  'report': () => { S.ui.reportBack = S.ui.tab === 'report' ? S.ui.reportBack : S.ui.tab; S.ui.tab = 'report'; S.ui.reportWeek = null; return 'enter'; },
  'rp-week': el => { S.ui.reportWeek = el.dataset.v; },
  'share-card': () => {
    const blob = card(), file = new File([blob], 'pg27-progress.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) { navigator.share({ files: [file], title: 'PG 2027' }).catch(() => {}); return; }
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'pg27-progress.png'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000); toast('Progress card saved');
  },
};
let rfTimer;
export function onInput(e) {
  const el = e.target; if (!el.dataset?.week) return false;
  clearTimeout(rfTimer);
  rfTimer = setTimeout(() => { S.reflect ||= {}; (S.reflect[el.dataset.week] ||= {})[el.dataset.k] = el.value; save(); }, 500);
  return true;
}
