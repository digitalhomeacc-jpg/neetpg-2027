// Anki library: the whole collection by kind of card (all, PYQs, regular learning, frozen MCQs),
// each with its decks, your tags and the PG27 tags the app adds. Names and counts only.
import { S, ANKI, usePg, ankiQuery, h, pct } from '../core.js';
import { ICON } from '../ui.js';

const LIB = window.ANKI_LIB || null;
const SECTIONS = [
  ['all', 'All cards', 'Everything in your export.'],
  ['pyq', 'PYQs', 'Cards tagged or filed as previous-year questions: AIIMS, NEET, INICET and your PYQ decks. They also appear under Regular or Frozen.'],
  ['regular', 'Regular learning', 'Study cards outside the frozen deck.'],
  ['frozen', 'Frozen (MCQs)', "Question cards in \"_FROZEN_DON'T USE _\", kept for after your first read."],
];
const n = x => x.toLocaleString('en-IN');
const tagName = t => t.replace(/_/g, ' ');

function tagGroups(list, q) {
  return list.map(([g, c, kids, total]) => `<details class="lib-g"><summary><span class="grow">${h(tagName(g))}</span><span class="num muted">${n(c)}</span></summary>
    <ul class="lib-kids">${kids.map(([t, k]) => `<li><button class="lib-tag" data-act="copy" data-q="${h(ankiQuery([t], q))}" title="Copy an Anki search for this tag"><span class="grow mono">${h(t)}</span><span class="num faint">${n(k)}</span>${ICON.copy}</button></li>`).join('')}
    ${total > kids.length ? `<li class="small faint lib-more">+${total - kids.length} smaller tags</li>` : ''}</ul></details>`).join('');
}

export function view() {
  if (!LIB) return { title: 'Anki library', html: '<section class="card empty"><div class="e1">No Anki data yet</div></section>' };
  const open = S.ui.libOpen || 'pyq', susp = !!S.ui.libSusp;
  return {
    title: 'Anki library',
    meta: `From your export · ${ANKI ? ANKI.made : ''}`,
    html: `
  <div class="seg lib-seg"><button data-act="lib-susp" data-v="0" aria-pressed="${!susp}">Copy: all cards</button><button data-act="lib-susp" data-v="1" aria-pressed="${susp}">Copy: still suspended</button></div>
  <p class="hint" style="margin:6px 4px 12px">Tap any tag to copy its Anki search.</p>
  ${SECTIONS.map(([k, title, about]) => {
    const x = LIB[k];
    return `<details class="card lib-sec" ${open === k ? 'open' : ''} data-sec="${k}">
      <summary class="row"><span class="grow"><b class="lib-title">${title}</b><span class="small muted" style="display:block">${n(x.cards)} cards · ${n(x.notes)} notes · ${n(x.tagCount)} tags</span></span><span class="lib-chev">›</span></summary>
      <p class="small muted">${about}</p>
      <div class="stats" style="margin:8px 0 4px">
        <div class="stat"><div class="v num">${n(x.cards)}</div><div class="k">cards</div></div>
        <div class="stat"><div class="v num">${pct(x.susp / Math.max(1, x.cards))}</div><div class="k">suspended at export</div></div>
        <div class="stat warn"><div class="v num">${n(x.untagged)}</div><div class="k">untagged by the app</div></div>
      </div>
      <p class="small muted">${n(x.noTags)} cards have none of your own tags (the app's PG27 tags cover them).</p>
      <details class="lib-g lib-top"><summary><span class="grow"><b>PG27 tags (added by the app)</b></span><span class="num muted">${x.pg27.length} subjects</span></summary>
        ${x.pg27.map(([g, c, kids, total]) => `<details class="lib-g"><summary><span class="grow">${h(tagName(g.replace('PG27::', '')))}</span><span class="num muted">${n(c)}</span></summary>
          <ul class="lib-kids">${kids.map(([t, k]) => `<li><button class="lib-tag" data-act="copy" data-q="${h(ankiQuery([t + (t.split('::').length > 2 ? '*' : '')], susp))}"><span class="grow">${h(tagName(t.split('::').pop()))}</span><span class="num faint">${n(k)}</span>${ICON.copy}</button></li>`).join('')}</ul></details>`).join('')}
        ${usePg() ? '' : '<p class="hint">These searches work once you\'ve added the PG27 tags in Anki.</p>'}
      </details>
      <details class="lib-g lib-top"><summary><span class="grow"><b>Your tags</b></span><span class="num muted">${x.tags.length} groups</span></summary>${tagGroups(x.tags, susp)}</details>
      <details class="lib-g lib-top"><summary><span class="grow"><b>Decks</b></span><span class="num muted">${x.decks.length}</span></summary>
        <ul class="lib-kids">${x.decks.map(([d, c]) => `<li><button class="lib-tag" data-act="copy" data-q="${h(`"deck:${d.replace(/"/g, '\\"')}*"${susp ? ' is:suspended' : ''}`)}"><span class="grow mono">${h(d)}</span><span class="num faint">${n(c)}</span>${ICON.copy}</button></li>`).join('')}</ul></details>
    </details>`;
  }).join('')}`,
  };
}

export const actions = {
  ankilib: () => { S.ui.libBack = S.ui.tab === 'ankilib' ? S.ui.libBack : S.ui.tab; S.ui.tab = 'ankilib'; return 'enter'; },
  'lib-susp': el => { S.ui.libSusp = el.dataset.v === '1'; },
};

// Remember which section is open, so it's open again next time.
document.addEventListener('toggle', e => {
  const d = e.target; if (!d.classList?.contains('lib-sec') || !d.open) return;
  S.ui.libOpen = d.dataset.sec;
}, true);
