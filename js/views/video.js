// Video panels: quick "mark watched" and the full detail with passes, Anki tags and mistakes.
import { S, BY, PASSES, PLABEL, SPEEDS, REV, prog, save, today, h, mins, sp, fmtDay, subjDot, ankiQuery, REASONS, revInfo, passMins, ratingName } from '../core.js';
import { openSheet, closeSheet, toast, seg } from '../ui.js';
import { openMistake } from './tests.js';

let ctx = null; // { id, kind, speed, date }

function body() {
  const v = BY[ctx.id], p = prog(v.id);
  const speeds = seg('vs-speed', SPEEDS.map(s => [s, sp(s)]), ctx.speed);
  const head = `<h3>${h(v.title)}</h3>
    <div class="sub num">${subjDot(v.subject)}${h(v.subject)} · Block ${v.block} · ${mins(v.mins)} runtime</div>`;
  if (ctx.kind === 'mark') {
    return `${head}
      <div class="field"><span class="lbl">Watched at</span>${speeds}</div>
      <div class="field"><label for="vs-date">On</label><input id="vs-date" type="date" value="${ctx.date}" max="${today()}"></div>
      <button class="btn primary block" data-act="vs-confirm">Mark watched · ${mins(v.mins / ctx.speed)}</button>`;
  }
  const r = revInfo(v);
  const rows = PASSES.map(k => {
    const x = p[k];
    let info, btn = '';
    if (x) {
      info = `${fmtDay(x.d)} · ${mins(passMins(v, x))}${x.s && k === 'fr' ? ` at ${sp(x.s)}` : ''}${x.q ? ` · recalled ${ratingName(x.q).toLowerCase()}` : ''}`;
      const latest = PASSES.filter(kk => p[kk]).pop() === k;
      btn = latest ? `<button class="btn ghost danger" data-act="vs-unpass" data-k="${k}">Undo</button>` : '';
    } else if (k === 'fr') {
      info = 'Not watched yet';
      btn = `<button class="btn ghost" data-act="mark" data-id="${v.id}">Mark</button>`;
    } else if (r?.k === k) {
      info = `<b class="${r.overdue > 0 ? 'bad-t' : r.overdue === 0 ? 'good-t' : ''}">${r.overdue > 0 ? `${r.overdue}d overdue` : r.overdue === 0 ? 'Due today' : `Due ${fmtDay(r.due)}`}</b> · ${mins(r.budget)} limit${r.pulled ? ' · moved up by a mistake' : ''}`;
      btn = `<button class="btn ghost" data-act="revise" data-id="${v.id}">Revise</button>`;
    } else {
      info = `${mins(Math.max(2, Math.round(v.mins * REV[k].budget)))} limit`;
    }
    return `<div class="pass${r?.k === k ? ' next' : ''}"><div class="pn">${PLABEL[k]}</div><div class="pd num">${info}</div>${btn}</div>`;
  }).join('');
  const ms = S.mistakes.filter(x => x.video === v.id);
  const reason = Object.fromEntries(REASONS);
  return `${head}
    ${v.notes ? `<p class="small" style="margin:0 0 4px">${h(v.notes)}</p>` : ''}
    <div class="field"><span class="lbl">Passes · each revision gets less time</span><div class="passes">${rows}</div></div>

    <div class="field"><span class="lbl">Anki tags · ${v.tags.length}</span>
      ${v.tags.length ? `<div class="tags">${v.tags.map(t => `<div class="tag">${h(t)}</div>`).join('')}</div>
      <div class="btns"><button class="btn primary" data-act="copy" data-q="${h(ankiQuery(v.tags, true))}">Copy suspended</button>
      <button class="btn" data-act="copy" data-q="${h(ankiQuery(v.tags, false))}">Copy all</button></div>
      <div class="spacer"></div>` : '<p class="small muted">No tags mapped yet.</p>'}
      <div class="note"><b>Draft mapping.</b> This gets replaced with your checked tags once your Anki tag list is in.</div>
    </div>

    <button class="btn block" style="margin-top:14px" data-act="hist-open" data-v="video:${v.id}">History of this video</button>

    <div class="field"><div class="row"><span class="lbl grow" style="margin:0">Mistakes on this video · ${ms.length}</span>
      <button class="btn ghost" data-act="vs-mistake">+ Log one</button></div>
      ${ms.length ? `<ul class="list mini-list">${ms.map(x => `<li class="item"><span class="pill ${x.done ? '' : 'bad'}">${reason[x.reason] || x.reason}</span>
        <div class="grow small">${h(x.note || 'No note')}</div><span class="small faint">${fmtDay(x.date)}</span></li>`).join('')}</ul>` : ''}
    </div>`;
}

export function openMark(id) { ctx = { id, kind: 'mark', speed: S.settings.speed, date: today() }; openSheet(body); }
export function openVideo(id) { ctx = { id, kind: 'detail', speed: S.settings.speed }; openSheet(body); }

export const actions = {
  'mark': el => openMark(el.dataset.id),
  'open-video': el => openVideo(el.dataset.id),
  'vs-speed': el => { ctx.speed = +el.dataset.v; const d = document.getElementById('vs-date'); if (d?.value) ctx.date = d.value; },
  'vs-confirm': () => {
    const d = document.getElementById('vs-date').value || today();
    (S.progress[ctx.id] ||= {}).fr = { d, s: ctx.speed };
    save(); const id = ctx.id, title = BY[id].title; closeSheet();
    toast(`Watched: ${title}`, () => { delete S.progress[id].fr; if (!Object.keys(S.progress[id]).length) delete S.progress[id]; save(); });
  },
  'unmark': el => {
    const id = el.dataset.id, p = S.progress[id];
    if (!p?.fr) return;
    // With revisions logged, open the details so only the latest pass can be undone.
    if (PASSES.slice(1).some(k => p[k])) return openVideo(id);
    const was = p.fr;
    delete p.fr; if (!Object.keys(p).length) delete S.progress[id];
    save();
    toast(`Unmarked: ${BY[id].title}`, () => { (S.progress[id] ||= {}).fr = was; save(); });
  },
  'vs-unpass': el => {
    const id = ctx.id, k = el.dataset.k, p = S.progress[id], was = p[k];
    delete p[k]; if (!Object.keys(p).length) delete S.progress[id];
    save();
    toast(`${PLABEL[k]} undone`, () => { (S.progress[id] ||= {})[k] = was; save(); });
  },
  'vs-mistake': () => openMistake({ video: ctx.id, subject: BY[ctx.id].subject }),
};
