// How long each pass really took: first watch and R1–R4, per video and per subject, against the limits.
import { S, VIDS, SUBJECTS, PASSES, PLABEL, REV, prog, passMins, h, mins, hrs, subjDot, subjHue } from '../core.js';
import { sectionH, closeSheet } from '../ui.js';

const limit = (v, k) => k === 'fr' ? v.mins / S.settings.speed : Math.max(2, Math.round(v.mins * REV[k].budget));

function stats(vs) {
  return PASSES.map(k => {
    let n = 0, took = 0, lim = 0;
    for (const v of vs) { const x = prog(v.id)[k]; if (x) { n++; took += passMins(v, x); lim += limit(v, k); } }
    return { k, n, took, lim, ratio: lim ? took / lim : 0 };
  });
}
const tone = r => !r ? '' : r > 1.15 ? 'over' : r < 0.85 ? 'under' : 'ok';

function passGrid(st) {
  return `<div class="tgrid">${st.map(x => `<div class="tcell ${x.n ? tone(x.ratio) : 'none'}">
    <div class="tk">${PLABEL[x.k] === 'First watch' ? 'First' : PLABEL[x.k]}</div>
    <div class="tv num">${x.n ? hrs(x.took) : '—'}</div>
    <div class="ts num">${x.n ? `${x.n} · ${x.k === 'fr' ? 'real time' : `${Math.round(x.ratio * 100)}% of limit`}` : 'none yet'}</div></div>`).join('')}</div>`;
}

export function view() {
  const all = stats(VIDS);
  const open = S.ui.timesOpen;
  // Where revisions run over their limits the most.
  const slow = SUBJECTS.map(s => {
    const st = stats(VIDS.filter(v => v.subject === s)).slice(1).filter(x => x.n);
    const took = st.reduce((a, x) => a + x.took, 0), lim = st.reduce((a, x) => a + x.lim, 0);
    return { s, ratio: lim ? took / lim : 0, n: st.reduce((a, x) => a + x.n, 0) };
  }).filter(x => x.n >= 3 && x.ratio > 1.15).sort((a, b) => b.ratio - a.ratio).slice(0, 3);

  const subjects = SUBJECTS.map(s => {
    const vs = VIDS.filter(v => v.subject === s);
    const st = stats(vs);
    const any = st.some(x => x.n);
    const isOpen = open === s;
    const rows = isOpen ? vs.map(v => {
      const p = prog(v.id);
      return `<li class="trow"><button class="open" data-act="open-video" data-id="${v.id}"><div class="t">${h(v.title)}</div>
        <div class="tchips">${PASSES.map(k => { const x = p[k]; if (!x) return `<span class="tchip none">${PLABEL[k] === 'First watch' ? 'FW' : PLABEL[k]}</span>`;
          const took = passMins(v, x), lim = limit(v, k);
          return `<span class="tchip ${k === 'fr' ? 'ok' : tone(took / lim)}"><b>${PLABEL[k] === 'First watch' ? 'FW' : PLABEL[k]}</b> ${mins(took)}${k === 'fr' ? '' : `<i>/${Math.round(lim)}</i>`}</span>`; }).join('')}</div></button></li>`;
    }).join('') : '';
    return `<li class="tsub${isOpen ? ' open' : ''}" style="--h:${subjHue(s)}">
      <button class="tsub-h" data-act="times-subject" data-v="${h(s)}" aria-expanded="${isOpen}">
        <span class="grow"><span class="t">${subjDot(s)}${h(s)}</span>
        <span class="s num">${any ? st.map(x => x.n ? `${x.k === 'fr' ? 'FW' : x.k.toUpperCase()} ${hrs(x.took)}` : '').filter(Boolean).join(' · ') : 'Nothing logged yet'}</span></span>
        <span class="faint">${isOpen ? '▾' : '▸'}</span></button>
      ${isOpen ? `${passGrid(st)}<ul class="list">${rows}</ul>` : ''}</li>`;
  }).join('');

  return {
    title: 'Revision times',
    meta: 'how long each pass really took',
    html: `
  <section class="card">${passGrid(all)}
    <p class="hint">Revisions show the share of their time limit you used: <span class="good-t">green</span> under, <span class="warn-t">orange</span> over by more than 15%. First watch is the real time at the speed you watched. Tap any time in a video's panel to correct it.</p></section>
  ${slow.length ? `<section class="card note-card"><b>Running over:</b> ${slow.map(x => `${h(x.s)} revisions take ${Math.round(x.ratio * 100)}% of their limits`).join('; ')}. Revise only what you got wrong in the recall step, or plan more time for these.</section>` : ''}
  ${sectionH('By subject', 'tap to see every video')}
  <ul class="card flush list tsubs">${subjects}</ul>`,
  };
}

export const actions = {
  'times': el => { closeSheet(); S.ui.timesBack = S.ui.tab === 'times' ? S.ui.timesBack : S.ui.tab; S.ui.tab = 'times'; if (el.dataset.v) S.ui.timesOpen = el.dataset.v; return 'enter'; },
  'times-subject': el => { S.ui.timesOpen = S.ui.timesOpen === el.dataset.v ? null : el.dataset.v; },
};
