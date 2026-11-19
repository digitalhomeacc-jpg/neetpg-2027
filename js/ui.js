// Shared bits of UI: rings, list rows, the bottom sheet, toasts.
import { S, prog, PASSES, h, mins, sp, fmtDay, fmtDow, subjDot } from './core.js';
export const clockTime = iso => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }).toLowerCase();

export const CHECK = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
export const ICON = {
  flame: '<svg viewBox="0 0 24 24" class="ic"><path d="M12 3c.5 3-2 4.5-2 7a2 2 0 0 0 4 0c0-.8-.3-1.5-.6-2 2.3 1.2 4.1 3.8 4.1 6.5A5.5 5.5 0 0 1 12 20a5.5 5.5 0 0 1-5.5-5.5C6.5 9.5 11 8 12 3z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" class="ic"><path d="M12 5v14M5 12h14"/></svg>',
  chev: '<svg viewBox="0 0 24 24" class="ic"><path d="M9 6l6 6-6 6"/></svg>',
  gear: '<svg viewBox="0 0 24 24" class="ic"><circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4L18 18M6 18l1.6-1.6M16.4 7.6L18 6"/></svg>',
  back: '<svg viewBox="0 0 24 24" class="ic"><path d="M15 6l-6 6 6 6"/></svg>',
  cal: '<svg viewBox="0 0 24 24" class="ic"><rect x="4" y="5.5" width="16" height="14.5" rx="3"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/></svg>',
  share: '<svg viewBox="0 0 24 24" class="ic"><path d="M12 3.5v12M7.5 8L12 3.5 16.5 8"/><path d="M5.5 12.5v5a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-5"/></svg>',
  play: '<svg viewBox="0 0 24 24" class="ic"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/></svg>',
  x: '<svg viewBox="0 0 24 24" class="ic"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  down: '<svg viewBox="0 0 24 24" class="ic"><path d="M6 9l6 6 6-6"/></svg>',
  timer: '<svg viewBox="0 0 24 24" class="ic"><circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 1.5M9.5 2.5h5"/></svg>',
  test: '<svg viewBox="0 0 24 24" class="ic"><path d="M8 4.5h8M9 4.5v5.2L4.8 17.4A2 2 0 0 0 6.6 20.5h10.8a2 2 0 0 0 1.8-3.1L15 9.7V4.5"/></svg>',
  bug: '<svg viewBox="0 0 24 24" class="ic"><path d="M12 20a6 6 0 0 1-6-6v-3a6 6 0 0 1 12 0v3a6 6 0 0 1-6 6zM12 9v11M6 13H3M21 13h-3M7 6.5L5 4.5M17 6.5l2-2"/></svg>',
  search: '<svg viewBox="0 0 24 24" class="ic"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>',
  copy: '<svg viewBox="0 0 24 24" class="ic"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8"/></svg>',
};

export function ring(frac, big, of, size = 116, mark = 0) {
  const r = 48, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, frac));
  // `mark` draws a notch on the ring, e.g. where the bare minimum sits.
  const a = mark * 2 * Math.PI, mx = 58 + r * Math.cos(a), my = 58 + r * Math.sin(a);
  const notch = mark > 0 && mark < 1 ? `<circle class="notch" cx="${mx}" cy="${my}" r="4"/>` : '';
  return `<div class="ring" style="width:${size}px;height:${size}px"><svg viewBox="0 0 116 116"><circle class="track" cx="58" cy="58" r="${r}"/>
    <circle class="bar" cx="58" cy="58" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - f)}"${f === 0 ? ' style="opacity:0"' : ''}/>${notch}</svg>
    <div class="label"><div class="big num">${big}</div><div class="of">${of}</div></div></div>`;
}
export function miniRing(frac, cls = '') {
  const r = 9, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, frac));
  return `<svg class="mini ${cls}" viewBox="0 0 24 24"><circle class="track" cx="12" cy="12" r="${r}"/>
    ${f > 0 ? `<circle class="bar" cx="12" cy="12" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - f)}"/>` : ''}
    ${f >= 1 ? `<path class="tick" d="M8 12.3l2.6 2.6L16 9.5"/>` : ''}</svg>`;
}

export function revPill(p) {
  let n = 0; for (const k of PASSES.slice(1)) if (p[k]) n++; // R1–R5 done
  return n ? `<span class="pill good">R${n}</span>` : '';
}

export function videoItem(v, { showSubject = false, showBlock = true, real = null, note = '' } = {}) {
  const p = prog(v.id), done = !!p.fr;
  const bits = [];
  if (showSubject) bits.push(h(v.subject));
  if (showBlock && !done) bits.push(`Block ${v.block}`);
  if (done) bits.push(`<span class="stamp">✓ Watched ${fmtDow(p.fr.d)}${p.fr.t ? ` · ${clockTime(p.fr.t)}` : ''}</span> ${sp(p.fr.s)}`);
  else bits.push(`${mins(v.mins)} · ${mins(real ?? v.mins / S.settings.speed)} at ${sp(S.settings.speed)}`);
  if (note) bits.push(`<span class="warn-t">${h(note)}</span>`);
  const open = S.mistakes.filter(x => x.video === v.id && !x.done).length;
  return `<li class="item${done ? ' done' : ''}">
    <button class="check${done ? ' on' : ''}" data-act="${done ? 'unmark' : 'mark'}" data-id="${v.id}" aria-label="${done ? 'Watched: tap to undo' : 'Mark watched'}">${CHECK}</button>
    <button class="open" data-act="open-video" data-id="${v.id}">
      <div class="t">${h(v.title)}</div>
      <div class="s num">${showSubject ? subjDot(v.subject) : ''}${bits.join(' · ')}</div></button>
    <div class="end">${open ? `<span class="pill bad">${open}</span>` : ''}${revPill(p)}${done ? '' : `<button class="play" data-act="study-now" data-id="${v.id}" aria-label="Study now">${ICON.play}</button>`}</div>
  </li>`;
}

/* ---------- bottom sheet ---------- */
let sheetFn = null;
export function openSheet(fn) { sheetFn = fn; renderSheet(true); }
export function closeSheet() { sheetFn = null; document.getElementById('sheet-root').innerHTML = ''; document.body.classList.remove('locked'); }
export const sheetOpen = () => !!sheetFn;
export function renderSheet(first = false) {
  const root = document.getElementById('sheet-root');
  if (!sheetFn) { root.innerHTML = ''; return; }
  const old = root.querySelector('.sheet');
  const scroll = old ? old.scrollTop : 0;
  root.innerHTML = `<div class="scrim${first ? ' enter' : ''}" data-act="close"></div>
    <div class="sheet${first ? ' enter' : ''}" role="dialog" aria-modal="true"><div class="grab"></div>${sheetFn()}</div>`;
  const sh = root.querySelector('.sheet');
  sh.scrollTop = scroll;
  document.body.classList.add('locked');
  dragToClose(sh);
}

// Swipe a sheet down to dismiss it, like a native iOS sheet.
function dragToClose(sh) {
  let y0 = null, dy = 0;
  sh.addEventListener('touchstart', e => {
    if (sh.scrollTop > 0 || e.target.closest('input, textarea, select, input[type=range]')) return;
    y0 = e.touches[0].clientY; dy = 0;
  }, { passive: true });
  sh.addEventListener('touchmove', e => {
    if (y0 == null) return;
    dy = e.touches[0].clientY - y0;
    if (dy > 0) { sh.classList.add('dragging'); sh.style.transform = `translateY(${dy}px)`; e.preventDefault(); }
  }, { passive: false });
  sh.addEventListener('touchend', () => {
    if (y0 == null) return;
    sh.classList.remove('dragging');
    if (dy > 110) { sh.style.transform = 'translateY(100%)'; setTimeout(() => { closeSheet(); document.dispatchEvent(new Event('pg27:render')); }, 220); }
    else sh.style.transform = '';
    y0 = null;
  });
}

export function confetti() {
  const box = document.createElement('div');
  box.className = 'confetti';
  const colors = ['#34d399', '#2dd4bf', '#60a5fa', '#fbbf5a', '#f472b6', '#a78bfa'];
  for (let i = 0; i < 70; i++) {
    const c = document.createElement('i');
    c.style.left = `${Math.random() * 100}%`;
    c.style.background = colors[i % colors.length];
    c.style.animationDelay = `${Math.random() * 0.35}s`;
    c.style.setProperty('--dx', `${(Math.random() - 0.5) * 160}px`);
    c.style.setProperty('--rot', `${Math.random() * 720 - 360}deg`);
    box.appendChild(c);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 2600);
}

/* ---------- toast + clipboard ---------- */
let toastTimer, toastUndo = null;
// toast('Saved') or toast('Unmarked', () => putItBack()) for a toast with an Undo button.
let queued = null;
export function toast(msg, undo = null) {
  const el = document.getElementById('toast');
  // Never cover an Undo that's still on screen: show plain messages after it.
  if (!undo && toastUndo && el.classList.contains('show')) { queued = msg; return; }
  toastUndo = undo;
  el.innerHTML = `<span>${String(msg).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</span>${undo ? '<button data-act="toast-undo">Undo</button>' : ''}`;
  el.classList.toggle('has-undo', !!undo);
  el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.classList.remove('show'); toastUndo = null; flushQueued(); }, undo ? 5000 : 2400);
}
function flushQueued() { if (queued) { const m = queued; queued = null; setTimeout(() => toast(m), 300); } }
export function runToastUndo() {
  const fn = toastUndo; toastUndo = null;
  document.getElementById('toast').classList.remove('show');
  clearTimeout(toastTimer);
  if (fn) fn();
  flushQueued();
}
export async function copy(text, msg = 'Copied. Paste it into Anki search.') {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
  }
  toast(msg);
}

export const seg = (act, opts, cur, extra = '') =>
  `<div class="seg">${opts.map(([v, l]) => `<button type="button" data-act="${act}" data-v="${h(v)}" ${extra} aria-pressed="${String(v) === String(cur)}">${l}</button>`).join('')}</div>`;

export const sectionH = (title, aside = '') => `<div class="section-h"><h2>${title}</h2>${aside ? `<span class="aside">${aside}</span>` : ''}</div>`;
