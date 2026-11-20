import { S, VIDS, SUBJECTS, prog, save, h, hrs, subjDot, subjHue } from '../core.js';
import { videoItem, sectionH } from '../ui.js';
import { libraryCard } from './pyt.js';

export function results() {
  const ui = S.ui;
  const q = ui.q.trim().toLowerCase();
  const grid = SUBJECTS.map(s => {
    const vs = VIDS.filter(v => v.subject === s);
    const tot = vs.reduce((a, v) => a + v.mins, 0);
    const dn = vs.reduce((a, v) => a + (prog(v.id).fr ? v.mins : 0), 0);
    return `<button class="subj" data-act="subject" data-s="${h(s)}" aria-pressed="${ui.subject === s}" style="--h:${subjHue(s)}">
      <div class="n">${h(s)}</div><span class="pc num">${tot ? Math.round((dn / tot) * 100) : 0}%</span>
      <div class="m num">${vs.filter(v => prog(v.id).fr).length}/${vs.length} · ${tot - dn > 0 ? `${hrs(tot - dn)} left` : 'Done'}</div>
      <div class="bar-line subj-bar"><i style="width:${tot ? (dn / tot) * 100 : 0}%"></i></div>
    </button>`;
  }).join('');

  let list = '';
  if (q) {
    const hits = VIDS.filter(v => (v.title + ' ' + v.subject + ' ' + v.notes + ' ' + v.tags.join(' ') + ' ' + (S.notes[v.id] || '')).toLowerCase().includes(q));
    list = sectionH('Results', `<span class="num">${hits.length}</span>`) +
      (hits.length ? `<ul class="card flush list">${hits.map(v => videoItem(v, { showSubject: true })).join('')}</ul>`
        : `<div class="card empty"><div class="e1">No videos match “${h(ui.q)}”</div>Try a shorter word, like “thyroid”.</div>`);
  } else if (ui.subject) {
    const vs = VIDS.filter(v => v.subject === ui.subject);
    const tot = vs.reduce((a, v) => a + v.mins, 0);
    list = `<div id="subject-list">${sectionH(`${subjDot(ui.subject)}${h(ui.subject)}`, `<span class="num">${vs.length} videos · ${hrs(tot)}</span>`)}</div>
      <ul class="card flush list">${vs.map(v => videoItem(v)).join('')}</ul>`;
  }

  return q ? list : `${S.pins.length ? `<button class="card tomorrow" data-act="pins"><span class="rbadge" style="--h:45">📌</span><span class="grow"><span class="t">High-yield sheet</span><span class="s">${S.pins.length} pinned fact${S.pins.length > 1 ? 's' : ''}, by subject</span></span><span class="faint">›</span></button>` : ''}${sectionH('Marrow WOR', 'tap a subject')}<div class="subjects">${grid}</div>${list}`;
}

export function view() {
  return {
    title: 'Library',
    meta: `<span class="num">${VIDS.filter(v => prog(v.id).fr).length} / ${VIDS.length}</span> watched`,
    html: `
  <div class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>
    <input id="q" type="search" placeholder="Search videos, topics, tags" value="${h(S.ui.q)}" autocomplete="off" enterkeyhint="search"></div>
  ${S.ui.q ? '' : libraryCard()}
  <div id="lib-results">${results()}</div>`,
  };
}

export const actions = {
  'subject': el => {
    S.ui.subject = S.ui.subject === el.dataset.s ? null : el.dataset.s; save();
    return () => S.ui.subject && document.getElementById('subject-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
};
