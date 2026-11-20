// Revision time for a day (by-subject mode): chips to set it, what's coming up next if you
// have extra time, and which subjects are still waiting to open their next round.
import { S, VIDS, SUBJECTS, PASSES, prog, revInfo, revTimeOn, blockMode, save, today, h, mins, fmtDay, subjDot, subjHue } from '../core.js';
import { ICON } from '../ui.js';

const OPTS = [0, 30, 60, 90, 120, 180];

export function revTimeChips(d) {
  if (!blockMode()) return '';
  const cur = revTimeOn(d), set = S.revTime[d] != null;
  return `<div class="revtime"><span class="small muted">Revision time${d === today() ? ' today' : ''}:</span>
    <div class="chips scroll-x">${OPTS.map(o => `<button class="chip" data-act="rev-time" data-d="${d}" data-v="${o}" aria-pressed="${cur === o}">${o ? mins(o) : 'None'}</button>`).join('')}
    ${!OPTS.includes(cur) ? `<button class="chip" aria-pressed="true">${mins(cur)}</button>` : ''}
    ${set ? `<button class="chip" data-act="rev-time-reset" data-d="${d}">Default</button>` : ''}</div></div>`;
}

// The next revisions after today's, in order: for when you have extra time.
export function upNext(n = 6) {
  const t = today();
  return VIDS.map(v => ({ v, r: revInfo(v) })).filter(x => x.r?.k && x.r.due && x.r.due > t)
    .sort((a, b) => a.r.due.localeCompare(b.r.due) || PASSES.indexOf(a.r.k) - PASSES.indexOf(b.r.k)).slice(0, n);
}

// Subjects whose next round can't open yet, and why.
export function waiting() {
  const out = [];
  for (const s of SUBJECTS) {
    const vs = VIDS.filter(v => v.subject === s), watched = vs.filter(v => prog(v.id).fr).length;
    if (watched && watched < vs.length) out.push({ s, why: `R1 opens when all ${vs.length} videos are watched (${watched} done)` });
  }
  return out;
}

export function upNextHtml() {
  if (!blockMode()) return '';
  const nx = upNext(), w = waiting();
  if (!nx.length && !w.length) return '';
  return `<details class="card upnext"><summary class="row"><span class="grow"><b>Have extra time?</b><span class="small muted" style="display:block">${nx.length ? `Revise ahead: next up is ${h(nx[0].v.subject)} ${nx[0].r.k.toUpperCase()}` : 'See which subjects are waiting'}</span></span><span class="faint">›</span></summary>
    ${nx.length ? `<ul class="list mini-list">${nx.map(({ v, r }) => `<li class="item rev"><span class="rbadge" style="--h:${subjHue(v.subject)}">${r.k.toUpperCase()}</span>
      <button class="open" data-act="revise" data-id="${v.id}"><div class="t">${h(v.title)}</div><div class="s num">${subjDot(v.subject)}${mins(r.budget)} · planned ${fmtDay(r.due)}</div></button>
      <button class="btn small-btn" data-act="revise" data-id="${v.id}">Start</button></li>`).join('')}</ul>
      <p class="hint">Revising ahead counts like any other revision, and the plan moves everything else up.</p>` : ''}
    ${w.length ? `<ul class="conseq small">${w.map(x => `<li>${subjDot(x.s)}<b>${h(x.s)}</b>: ${x.why}.</li>`).join('')}</ul>` : ''}
  </details>`;
}

export const actions = {
  'rev-time': el => { const d = el.dataset.d, v = +el.dataset.v; S.revTime[d] = v; save(); },
  'rev-time-reset': el => { delete S.revTime[el.dataset.d]; save(); },
};
