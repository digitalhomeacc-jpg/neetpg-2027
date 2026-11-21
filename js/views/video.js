// Video panels: quick "mark watched" and the full detail with passes, Anki tags and mistakes.
import { S, BY, PASSES, PLABEL, SPEEDS, REV, prog, save, today, h, mins, sp, fmtDay, fmtDow, fmtDayLong, subjDot, ankiQuery, REASONS, revInfo, passMins, passBudget, ratingName, plannedOn } from '../core.js';
import { openSheet, closeSheet, toast, seg, clockTime } from '../ui.js';
import { openMistake } from './tests.js';
import { pinBox } from './pins.js';
import { ankiBlock, chaptersList } from './anki.js';
import { getPack, countFor } from './pyt.js';
import { lectureCount } from './concepts.js';

let ctx = null; // { id, kind, speed, date }

function body() {
  const v = BY[ctx.id], p = prog(v.id);
  const speeds = seg('vs-speed', SPEEDS.map(s => [s, sp(s)]), ctx.speed);
  const head = `<h3>${h(v.title)}</h3>
    <div class="sub num">${subjDot(v.subject)}${h(v.subject)} · Block ${v.block} · <button class="link num" data-act="vs-rt">${mins(v.mins)} runtime${S.runtimes[v.id] ? ' (corrected)' : ''} ✎</button></div>
    ${ctx.rt ? `<div class="field rt-edit"><label for="vs-rt">Runtime in Marrow (minutes)</label>
      <div class="row"><input id="vs-rt" class="inp num" type="number" inputmode="numeric" min="1" max="300" value="${ctx.rtVal ?? Math.round(v.mins)}" style="max-width:110px">
      <button class="btn primary" data-act="vs-rt-save">Save</button><button class="btn ghost" data-act="vs-rt-cancel">Cancel</button></div>
      <p class="hint">Your sheet says ${mins(v.sheetMins)}.${S.runtimes[v.id] ? ` <button class="link" data-act="vs-rt-reset">Go back to ${mins(v.sheetMins)}</button>` : ''} Revision limits and plans follow the new runtime.</p></div>` : ''}
    ${p.fr ? `<div class="stamp-big">✓ Watched on ${fmtDayLong(p.fr.d)}${p.fr.t ? ` at ${clockTime(p.fr.t)}` : ''} · ${p.fr.m ? `${mins(p.fr.m)} studied` : sp(p.fr.s)}${p.fr.breaks ? `<span class="span-note">across ${mins(p.fr.span)} with ${p.fr.breaks} break${p.fr.breaks > 1 ? 's' : ''}</span>` : ''}</div>` : plannedOn(v.id) ? `<div class="stamp-big plan">Planned for ${fmtDayLong(plannedOn(v.id))}</div>` : ''}`;
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
      const lim = k === 'fr' ? null : passBudget(v, k, x.d);
      const took = passMins(v, x), over = lim && took > lim;
      info = ctx.editK === k
        ? `<span class="row" style="gap:8px"><input id="vs-min" class="inp num" type="number" inputmode="numeric" min="1" value="${Math.round(took)}" style="max-width:84px;min-height:38px;padding:6px 10px"> min
            <button class="btn ghost" data-act="vs-time-save" data-k="${k}">Save</button></span>`
        : `<span class="stamp">✓ ${fmtDow(x.d)}${x.t ? ` · ${clockTime(x.t)}` : ''}</span>
           <button class="time-chip${over ? ' over' : ''}" data-act="vs-time" data-k="${k}" aria-label="Edit time">${mins(took)}${lim ? ` / ${mins(lim)}` : ''}</button>${x.s && k === 'fr' ? ` at ${sp(x.s)}` : ''}${x.q ? ` · recalled ${ratingName(x.q).toLowerCase()}` : ''}${x.breaks ? ` · <span class="faint">over ${mins(x.span)}, ${x.breaks} break${x.breaks > 1 ? 's' : ''}</span>` : ''}`;
      const latest = PASSES.filter(kk => p[kk]).pop() === k;
      btn = latest ? `<button class="btn ghost danger" data-act="vs-unpass" data-k="${k}">Undo</button>` : '';
    } else if (k === 'fr') {
      info = 'Not watched yet';
      btn = `<button class="btn ghost" data-act="mark" data-id="${v.id}">Mark</button>`;
    } else if (r?.k === k) {
      info = r.waiting ? `<span class="faint">When all of ${h(v.subject)} has had ${k === 'r1' ? 'its first watch' : PASSES[PASSES.indexOf(k) - 1].toUpperCase()}</span> · ${mins(r.budget)} limit`
        : `<b class="${r.overdue > 0 ? 'bad-t' : r.overdue === 0 ? 'good-t' : ''}">${r.overdue > 0 ? `${r.overdue}d overdue` : r.overdue === 0 ? 'Due today' : `${r.block ? 'Planned' : 'Due'} ${fmtDay(r.due)}`}</b> · ${mins(r.budget)} limit${r.pulled ? ' · moved up by a mistake' : ''}`;
      btn = `<button class="btn ghost" data-act="revise" data-id="${v.id}">Revise</button>`;
    } else {
      info = `${mins(passBudget(v, k, today()))} limit`;
    }
    return `<div class="pass${r?.k === k ? ' next' : ''}"><div class="pn">${PLABEL[k]}</div><div class="pd num">${info}</div>${btn}</div>`;
  }).join('');
  const ms = S.mistakes.filter(x => x.video === v.id);
  const reason = Object.fromEntries(REASONS);
  return `${head}
    ${p.fr ? '' : `<button class="btn primary block" data-act="study-now" data-id="${v.id}" style="margin:0 0 14px">▶ Study now</button>`}
    ${getPack() ? `<button class="btn block pyt-btn" data-act="pyt-video" data-id="${v.id}">📚 PYTs & what was asked · ${countFor(v.id)}</button>` : ''}
    ${lectureCount(v.id) ? `<button class="btn block pyt-btn" data-act="cm-lecture" data-id="${v.id}">🧠 Concept map of this lecture · ${lectureCount(v.id)}</button>` : ''}
    ${v.chapters?.length ? chaptersList(v) : v.notes ? `<p class="small" style="margin:0 0 4px">${h(v.notes)}</p>` : ''}
    <div class="field"><label for="v-notes">My notes</label>
      <textarea id="v-notes" class="inp" rows="3" placeholder="High-yield points in your own words. They show up in this video's recall check.">${h(S.notes[v.id] || '')}</textarea>
      <p class="hint">Saved as you type. Tip: tap the 🎤 on the keyboard to dictate.</p>
      ${pinBox(v.id)}
      ${S.pins.filter(x => x.video === v.id).length ? `<button class="link" data-act="pins" style="margin-top:6px">📌 ${S.pins.filter(x => x.video === v.id).length} pinned from this video</button>` : ''}</div>
    <div class="field"><span class="lbl">Passes · each revision gets less time</span><div class="passes">${rows}</div></div>

    ${ankiBlock(v)}

    <p class="hint">Tap a time to correct it, including when a revision ran over its limit.</p>
    ${(() => { const hs = (S.history || []).filter(e => e.key === `video:${v.id}`).slice(0, 5);
      return hs.length ? `<div class="field"><span class="lbl">Recent history</span><ul class="list mini-list vh">${hs.map(e => `<li class="item"><span class="pill ${e.action === 'undone' ? 'bad' : e.action === 'edit' ? 'warn' : 'good'}">${{ done: 'Done', undone: 'Undone', edit: 'Changed', create: 'Added', delete: 'Deleted' }[e.action] || e.action}</span>
        <span class="grow small">${h(Object.entries(e.after || e.before || {}).filter(([, val]) => val).map(([kk]) => kk).slice(-1)[0] || '')}</span><span class="small faint num">${new Date(e.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span></li>`).join('')}</ul></div>`
        : `<div class="field"><span class="lbl">Recent history</span><p class="small faint" style="margin:0">Nothing recorded yet. Every tick, revision and time change will show here.</p></div>`; })()}
    <div class="btns" style="margin-top:14px"><button class="btn" data-act="times" data-v="${h(v.subject)}">Revision times</button><button class="btn" data-act="hist-open" data-v="video:${v.id}">History</button></div>

    <div class="field"><div class="row"><span class="lbl grow" style="margin:0">Mistakes on this video · ${ms.length}</span>
      <button class="btn ghost" data-act="vs-mistake">+ Log one</button></div>
      ${ms.length ? `<ul class="list mini-list">${ms.map(x => `<li class="item"><span class="pill ${x.done ? '' : 'bad'}">${reason[x.reason] || x.reason}</span>
        <div class="grow small">${h(x.note || 'No note')}</div><span class="small faint">${fmtDay(x.date)}</span></li>`).join('')}</ul>` : ''}
    </div>`;
}

export function openMark(id) { ctx = { id, kind: 'mark', speed: S.settings.speed, date: today() }; openSheet(body); }
export function openVideo(id) { ctx = { id, kind: 'detail', speed: S.settings.speed, editK: null }; openSheet(body); }

export const actions = {
  'vs-rt': () => { ctx.rt = true; ctx.rtVal = null; return () => document.getElementById('vs-rt')?.select(); },
  'vs-rt-cancel': () => { ctx.rt = false; },
  'vs-rt-save': () => {
    const v = BY[ctx.id], n = Math.round(+document.getElementById('vs-rt').value);
    if (!(n >= 1 && n <= 300)) { toast('Enter the runtime in minutes'); return; }
    if (n === Math.round(v.mins)) { ctx.rt = false; return; }
    ctx.rtVal = n; // keep the typed number if the panel redraws
    if (!confirm(`Change the runtime of "${v.title}" from ${mins(v.mins)} to ${mins(n)}?\n\nIts revision limits and your plans will use ${mins(n)}.`)) return;
    const was = S.runtimes[v.id];
    if (n === Math.round(v.sheetMins)) delete S.runtimes[v.id]; else S.runtimes[v.id] = n;
    ctx.rt = false; ctx.rtVal = null; save();
    toast(`Runtime set to ${mins(n)}`, () => { if (was) S.runtimes[v.id] = was; else delete S.runtimes[v.id]; save(); });
  },
  'vs-rt-reset': () => {
    const v = BY[ctx.id], was = S.runtimes[v.id];
    if (!confirm(`Go back to the sheet's runtime, ${mins(v.sheetMins)}?`)) return;
    delete S.runtimes[v.id]; ctx.rt = false; save();
    toast(`Runtime back to ${mins(v.sheetMins)}`, () => { S.runtimes[v.id] = was; save(); });
  },
  'mark': el => openMark(el.dataset.id),
  'open-video': el => openVideo(el.dataset.id),
  'vs-speed': el => { ctx.speed = +el.dataset.v; const d = document.getElementById('vs-date'); if (d?.value) ctx.date = d.value; },
  'vs-confirm': () => {
    const d = document.getElementById('vs-date').value || today();
    (S.progress[ctx.id] ||= {}).fr = { d, s: ctx.speed, ...(d === today() ? { t: new Date().toISOString() } : {}) };
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
  'vs-time': el => { ctx.editK = el.dataset.k; return () => document.getElementById('vs-min')?.select(); },
  'vs-time-save': el => {
    const k = el.dataset.k, x = S.progress[ctx.id][k], n = Math.round(+document.getElementById('vs-min').value);
    if (n >= 1) { x.m = n; save(); }
    ctx.editK = null;
  },
  'vs-unpass': el => {
    const id = ctx.id, k = el.dataset.k, p = S.progress[id], was = p[k];
    delete p[k]; if (!Object.keys(p).length) delete S.progress[id];
    save();
    toast(`${PLABEL[k]} undone`, () => { (S.progress[id] ||= {})[k] = was; save(); });
  },
  'vs-mistake': () => openMistake({ video: ctx.id, subject: BY[ctx.id].subject }),
};

let noteTimer;
export function onInput(e) {
  if (e.target.id !== 'v-notes' || !ctx) return false;
  const id = ctx.id, val = e.target.value;
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => { if (val.trim()) S.notes[id] = val; else delete S.notes[id]; save(); }, 500);
  return true;
}
