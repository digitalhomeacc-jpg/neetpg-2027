// A revision session: recall from memory, check against the topics, rate yourself, then revise against the clock.
import {
  S, BY, PASSES, REV, RATINGS, prog, save, today, revInfo, ankiQuery, REASONS,
  h, mins, fmtDay, fmtDayYear, subjDot,
} from '../core.js';
import { openSheet, closeSheet, toast } from '../ui.js';
import { pinBox } from './pins.js';

let ctx = null; // { id, k, step, dump, q, startedAt, elapsed, running }
let timer = null;
const reasonName = Object.fromEntries(REASONS);

const elapsed = () => ctx.elapsed + (ctx.running ? (Date.now() - ctx.startedAt) / 1000 : 0);
const clock = sec => { const s = Math.max(0, Math.round(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function tick() {
  const el = document.getElementById('rv-clock'); if (!el || !ctx) return;
  const r = revInfo(BY[ctx.id]), left = r.budget * 60 - elapsed();
  el.textContent = left >= 0 ? clock(left) : `+${clock(-left)}`;
  el.classList.toggle('over', left < 0);
  const bar = document.getElementById('rv-bar');
  if (bar) bar.style.width = `${Math.min(100, (elapsed() / (r.budget * 60)) * 100)}%`;
}

function topics(v) {
  return v.notes ? v.notes.split(/,\s*|\s+&\s+|;\s*/).map(x => x.trim()).filter(Boolean) : [];
}

function body() {
  const v = BY[ctx.id], r = revInfo(v);
  if (!r?.k) return `<h3>${h(v.title)}</h3><p class="muted">All five revisions are done.</p>`;
  const n = PASSES.indexOf(r.k);
  const steps = ['Recall', 'Check', 'Revise'];
  const si = { recall: 0, rate: 1, timer: 2, log: 2 }[ctx.step];
  const head = `<div class="rv-steps">${steps.map((s, i) => `<span class="${i === si ? 'on' : i < si ? 'done' : ''}">${i + 1}. ${s}</span>`).join('')}</div>
    <h3>${h(v.title)}</h3>
    <div class="sub num">${subjDot(v.subject)}${h(v.subject)} · Revision ${n} of 5 · ${mins(r.budget)} limit${r.overdue > 0 ? ` · <span class="bad-t">${r.overdue}d overdue</span>` : ''}</div>`;

  if (ctx.step === 'recall') {
    return `${head}
      <div class="recall-card">
        <div class="rc-k">Active recall</div>
        <p>Before you look at anything, write or say out loud everything you remember about this topic. Key facts, numbers, drugs of choice, classic presentations.</p>
      </div>
      <div class="field"><label for="rv-dump">Brain dump (optional, only you see it)</label>
        <textarea id="rv-dump" class="inp" rows="5" placeholder="Type what comes to mind…">${h(ctx.dump)}</textarea>
        <p class="hint">Faster: tap the 🎤 on the keyboard and say it out loud.</p></div>
      <button class="btn primary block" data-act="rv-reveal">I've recalled what I can · show the topics</button>`;
  }

  if (ctx.step === 'rate') {
    const ms = S.mistakes.filter(x => x.video === v.id && !x.done);
    const tp = topics(v);
    return `${head}
      ${ctx.dump ? `<div class="field"><span class="lbl">What you recalled</span><div class="dump">${h(ctx.dump)}</div></div>` : ''}
      <div class="field"><span class="lbl">What this video covers</span>
        ${tp.length ? `<ul class="topics">${tp.map(t => `<li>${h(t)}</li>`).join('')}</ul>` : '<p class="small muted">No topic notes for this video yet.</p>'}</div>
      ${S.notes[v.id] ? `<div class="field"><span class="lbl">Your notes</span><div class="dump">${h(S.notes[v.id])}</div></div>` : ''}
      <div class="field"><span class="lbl">Missed something important?</span>${pinBox(v.id)}</div>
      ${ms.length ? `<div class="field"><span class="lbl">Your open mistakes here</span><ul class="topics bad">${ms.map(x => `<li>${h(x.note || 'No note')} <span class="faint">· ${reasonName[x.reason]}</span></li>`).join('')}</ul></div>` : ''}
      <div class="field"><span class="lbl">How much did you recall?</span>
        <div class="rate">${RATINGS.map(([q, l]) => `<button data-act="rv-rate" data-v="${q}" class="q${q}"><b>${l}</b><span>${['Next one sooner', 'A bit sooner', 'On schedule', 'Later'][q - 1]}</span></button>`).join('')}</div></div>`;
  }

  if (ctx.step === 'log') {
    return `${head}
      <div class="field"><label for="rv-min">How long did this revision really take? Over the limit is fine, enter the real time.</label>
        <div class="row"><input id="rv-min" class="inp num" type="number" inputmode="numeric" min="1" value="${ctx.spent}" style="max-width:120px"><span class="muted">minutes · limit ${mins(r.budget)}</span></div>
        <div class="chips" style="margin-top:10px">${[-5, -1, 1, 5, 10, 15, 30].map(d => `<button class="chip" data-act="rv-time" data-v="${d}">${d > 0 ? '+' : '−'}${Math.abs(d)}</button>`).join('')}</div>
        <p class="hint">${ctx.elapsed >= 45 ? `From the timer: ${mins(ctx.elapsed / 60)}.` : 'The timer wasn’t used, so this starts at the limit. Change it to what it really took.'}</p></div>
      <button class="btn primary block" data-act="rv-save">Save ${r.k.toUpperCase()}</button>`;
  }
  const left = r.budget * 60 - elapsed();
  return `${head}
    <div class="timer">
      <div id="rv-clock" class="clock num${left < 0 ? ' over' : ''}">${left >= 0 ? clock(left) : `+${clock(-left)}`}</div>
      <div class="bar-line"><i id="rv-bar" style="width:${Math.min(100, (elapsed() / (r.budget * 60)) * 100)}%"></i></div>
      <p class="small muted">Revise only what you missed or were unsure of. Use the video at 2× or your notes, and stop when the time's up.</p>
    </div>
    <div class="btns">
      <button class="btn${ctx.running ? '' : ' primary'}" data-act="rv-toggle">${ctx.running ? 'Pause' : elapsed() ? 'Resume' : 'Start timer'}</button>
      <button class="btn${ctx.running || elapsed() ? ' primary' : ''}" data-act="rv-finish">Finish revision</button>
    </div>
    ${v.tags.length ? `<div class="spacer"></div><button class="btn block" data-act="copy" data-q="${h(ankiQuery(v.tags, false))}">Copy Anki search for this video</button>` : ''}`;
}

export function openRevise(id) {
  ctx = { id, step: 'recall', dump: '', q: null, startedAt: 0, elapsed: 0, running: false };
  clearInterval(timer); timer = setInterval(tick, 500);
  openSheet(body);
}

export const actions = {
  'revise': el => openRevise(el.dataset.id),
  'rv-reveal': () => { ctx.dump = document.getElementById('rv-dump')?.value.trim() || ''; ctx.step = 'rate'; },
  'rv-rate': el => { ctx.q = +el.dataset.v; ctx.step = 'timer'; ctx.startedAt = Date.now(); ctx.first = Date.now(); ctx.breaks = 0; ctx.running = true; },
  'rv-toggle': () => {
    if (ctx.running) { ctx.elapsed = elapsed(); ctx.running = false; ctx.breaks = (ctx.breaks || 0) + 1; }
    else { ctx.startedAt = Date.now(); ctx.running = true; }
  },
  'rv-finish': () => {
    // Confirm the time: the timer's reading if it ran, otherwise the limit, editable either way.
    const r = revInfo(BY[ctx.id]);
    ctx.elapsed = elapsed(); ctx.running = false;
    ctx.spent = ctx.elapsed >= 45 ? Math.round(ctx.elapsed / 60) : r.budget;
    ctx.step = 'log';
  },
  'rv-time': el => { const i = document.getElementById('rv-min'); ctx.spent = Math.max(1, (+i.value || 0) + +el.dataset.v); },
  'rv-save': () => {
    const v = BY[ctx.id], r = revInfo(v);
    const spent = Math.max(1, Math.round(+document.getElementById('rv-min').value || ctx.spent));
    const span = ctx.first ? Math.round((Date.now() - ctx.first) / 60000) : null;
    (S.progress[v.id] ||= {})[r.k] = { d: today(), t: new Date().toISOString(), m: spent, q: ctx.q ?? 3, ...(ctx.breaks && span ? { span, breaks: ctx.breaks } : {}) };
    save(); clearInterval(timer); closeSheet();
    const nx = revInfo(v);
    toast(nx?.k ? `${r.k.toUpperCase()} done in ${mins(spent)}. ${nx.k.toUpperCase()} due ${fmtDay(nx.due)}` : `All 5 revisions done for ${v.title}`,
      () => { delete S.progress[v.id][r.k]; save(); });
  },
};

export function onSheetClose() { clearInterval(timer); }
