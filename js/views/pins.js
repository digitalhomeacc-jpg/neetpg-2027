// Your high-yield sheet: facts you pinned while watching or revising, for the final weeks.
import { S, BY, SUBJECTS, save, today, uid, h, fmtDay, subjDot } from '../core.js';
import { sectionH, toast, CHECK } from '../ui.js';

export function pinBox(videoId) {
  return `<div class="pinbox"><input id="pin-text" class="inp" placeholder="Pin a high-yield fact…" autocomplete="off" enterkeyhint="done">
    <button class="btn" data-act="pin-add" data-id="${videoId}">📌 Pin</button></div>`;
}

export function view() {
  const q = (S.ui.pinQ || '').trim().toLowerCase();
  const hide = S.ui.pinHide;
  let list = S.pins.filter(p => !q || (p.text + ' ' + (BY[p.video]?.title || '')).toLowerCase().includes(q));
  if (hide) list = list.filter(p => !p.done);
  const groups = SUBJECTS.map(sj => [sj, list.filter(p => BY[p.video]?.subject === sj)]).filter(([, l]) => l.length);
  return {
    title: 'High-yield sheet',
    meta: `${S.pins.length} pinned fact${S.pins.length === 1 ? '' : 's'}`,
    html: `
  <div class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>
    <input id="pin-q" type="search" placeholder="Search your pins" value="${h(S.ui.pinQ || '')}" autocomplete="off"></div>
  <div class="chips" style="margin:8px 0"><button class="chip" data-act="pin-hide" aria-pressed="${!!hide}">Hide learned</button></div>
  ${groups.length ? groups.map(([sj, l]) => `${sectionH(`${subjDot(sj)}${h(sj)}`, `${l.length}`)}
    <ul class="card flush list">${l.map(p => `<li class="item${p.done ? ' done' : ''}">
      <button class="check${p.done ? ' on' : ''}" data-act="pin-done" data-id="${p.id}" aria-label="Learned">${CHECK}</button>
      <div class="grow"><div class="t pin-t">${h(p.text)}</div><div class="s">${h(BY[p.video]?.title || '')} · ${fmtDay(p.d)}</div></div>
      <button class="icon-mini danger" data-act="pin-del" data-id="${p.id}" aria-label="Delete">✕</button></li>`).join('')}</ul>`).join('')
    : `<section class="card empty"><div class="ei">📌</div><div class="e1">${S.pins.length ? 'Nothing matches' : 'No pins yet'}</div>Pin a fact from any video's panel or during a revision. They collect here, by subject, for the last weeks before the exam.</section>`}`,
  };
}

export const actions = {
  'pins': () => { S.ui.pinsBack = S.ui.tab === 'pins' ? S.ui.pinsBack : S.ui.tab; S.ui.tab = 'pins'; return 'enter'; },
  'pin-add': el => {
    const i = document.getElementById('pin-text'), text = i?.value.trim();
    if (!text) { toast('Type the fact first'); return; }
    S.pins.unshift({ id: uid(), video: el.dataset.id, text, d: today(), done: false }); save();
    toast('Pinned to your high-yield sheet');
  },
  'pin-done': el => { const p = S.pins.find(x => x.id === el.dataset.id); if (p) { p.done = !p.done; save(); } },
  'pin-del': el => { const p = S.pins.find(x => x.id === el.dataset.id); S.pins = S.pins.filter(x => x.id !== el.dataset.id); save(); toast('Pin deleted', () => { S.pins.unshift(p); save(); }); },
  'pin-hide': () => { S.ui.pinHide = !S.ui.pinHide; },
};

export function onInput(e) {
  if (e.target.id !== 'pin-q') return false;
  S.ui.pinQ = e.target.value; save();
  const html = view().html, doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  // Redraw everything below the search box only, so the keyboard stays open.
  const view_ = document.getElementById('view'), box = view_.querySelector('.search');
  while (box.nextSibling) box.nextSibling.remove();
  [...doc.body.firstChild.childNodes].slice(1).filter(n => !(n.classList?.contains('search'))).forEach(n => view_.appendChild(n));
  return true;
}
