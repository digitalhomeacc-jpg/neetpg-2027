// Anki: every WOR video has its own tag (PG27::NN_Subject::NN_Title). A video you've watched
// counts its tag, and all the cards under it, as hit. Card counts come from your Anki export
// (js/data-anki.js, made by tools/anki_map.py); the mapping is automatic, so some cards sit
// under a neighbouring video. Fix those in Anki as you meet them.
import { S, VIDS, SUBJECTS, ANKI, ankiOf, pgTag, usePg, prog, save, ankiQuery, h, pct, plural, fmtDayYear, subjDot, subjHue } from '../core.js';
import { ICON } from '../ui.js';
import { chapterCounts } from './pyt.js';

const tagShort = v => pgTag(v).split('::').slice(1).join(' › ').replace(/_/g, ' ');
const fmtAt = s => s === '?' ? '—' : s;

export function chaptersList(v) {
  const a = ankiOf(v), ch = a?.ch || [], pc = chapterCounts(v.id);
  return `<div class="field"><span class="lbl">In this video · ${v.chapters.length} chapters</span>
    <ol class="chapters">${v.chapters.map(([at, t], i) => `<li><span class="num at">${h(fmtAt(at))}</span><span class="grow">${h(t)}${pc[i] ? ` <span class="pyt-badge" title="Previous-year topics linked here">PYT ${pc[i]}</span>` : ''}</span>${ch[i] ? `<span class="ch-n num" title="Anki cards placed on this chapter">${ch[i]}</span>` : ''}</li>`).join('')}</ol>
    ${ch.some(Boolean) ? '<p class="hint">Numbers are Anki cards placed on that chapter. Cards that fit no single chapter count for the whole video only.</p>' : ''}</div>`;
}

// Which tags to put in this video's Anki search (all of them until you untick some).
let pick = { vid: null, off: new Set(), susp: true };
const pickFor = v => { if (pick.vid !== v.id) pick = { vid: v.id, off: new Set(), susp: pick.susp }; return pick; };
const shortTag = t => t.split('::').filter(x => !/^(1_legend|\$?i_anki|ankihub_subdeck|#ak_step1_v12|dope|phase|\d+)$/i.test(x)).slice(-2).join(' › ').replace(/_/g, ' ') || t;
function pickItems(v) {
  const a = ankiOf(v) || {}, out = [];
  if (usePg()) {
    out.push({ k: 'pg', label: 'This video (PG27 tag)', tag: pgTag(v).replace(/::(\d+)_[^:]*$/, '::$1_*'), n: a.c || 0, pg: true });
    (v.chapters || []).forEach(([, t], i) => { if (a.ch?.[i]) out.push({ k: `ch${i}`, label: t, tag: `${pgTag(v)}::${String(i + 1).padStart(2, '0')}_*`, n: a.ch[i], sub: true }); });
  }
  (a.top || []).forEach(([t, n], i) => out.push({ k: `t${i}`, label: shortTag(t), full: t, tag: t, n }));
  return out;
}

function pyqLine(a) {
  if (!a?.pyq) return '';
  const by = {};
  for (const [k, n] of Object.entries(a.pyq)) { const ex = k.split(':')[0]; by[ex] = (by[ex] || 0) + n; }
  const parts = Object.entries(by).filter(([ex]) => ex !== 'PYQ').sort((x, y) => y[1] - x[1]).map(([ex, n]) => `${ex} ${n}`);
  const total = Object.values(by).reduce((x, y) => x + y, 0);
  return total ? `<div class="small muted">PYQ-tagged notes: <b class="num">${total}</b>${parts.length ? ` · ${parts.join(' · ')}` : ''}</div>` : '';
}

export function ankiBlock(v) {
  const a = ankiOf(v), done = !!prog(v.id).fr;
  if (!ANKI) {
    return `<div class="field"><span class="lbl">Anki tags · ${v.tags.length}</span>
      ${v.tags.length ? `<div class="tags">${v.tags.map(t => `<div class="tag">${h(t)}</div>`).join('')}</div>
      <div class="btns"><button class="btn primary" data-act="copy" data-q="${h(ankiQuery([v], true))}">Copy search · still suspended</button>
      <button class="btn" data-act="copy" data-q="${h(ankiQuery([v], false))}">Copy search · all cards</button></div>` : '<p class="small muted">No tags mapped yet.</p>'}</div>`;
  }
  const pk = pickFor(v), items = pickItems(v), on = items.filter(x => !pk.off.has(x.k));
  return `<div class="field"><span class="lbl">Anki</span>
    <div class="anki-v${done ? ' hit' : ''}">
      <div class="row"><div class="grow"><div class="t">${done ? '✓ Tag hit' : 'Tag not hit yet'}</div><div class="small faint mono">${h(pgTag(v))}</div></div>
        <div class="anki-n num"><b>${(a?.c || 0).toLocaleString('en-IN')}</b><span>cards</span></div></div>
      <div class="small muted">${plural(a?.n || 0, 'note')}${a?.su ? ` · ${a.su.toLocaleString('en-IN')} were suspended when you exported` : ''}${a?.q ? ` · ${plural(a.qc, 'MCQ card')} in the frozen deck` : ''}</div>
      ${pyqLine(a)}
    </div>
    ${items.length ? `<div class="pick">
      <div class="row pick-head"><span class="lbl grow" style="margin:0">Tags to search · ${on.length} of ${items.length}</span>
        <button class="link" data-act="ak-all">${on.length === items.length ? 'Select none' : 'Select all'}</button></div>
      <ul class="pick-list">${items.map(x => `<li><button class="pick-row${pk.off.has(x.k) ? '' : ' on'}${x.sub ? ' sub' : ''}" data-act="ak-pick" data-v="${x.k}" aria-pressed="${!pk.off.has(x.k)}">
        <span class="box">${pk.off.has(x.k) ? '' : '✓'}</span><span class="grow"><span class="pl">${h(x.label)}</span>${x.full ? `<span class="pf mono">${h(x.full)}</span>` : ''}</span><span class="num faint">${x.n}</span></button></li>`).join('')}</ul>
      <div class="seg pick-seg"><button data-act="ak-susp" data-v="1" aria-pressed="${pk.susp}">Only still suspended</button><button data-act="ak-susp" data-v="0" aria-pressed="${!pk.susp}">All cards</button></div>
      <button class="btn primary block" data-act="copy" data-q="${h(on.length ? ankiQuery(on.map(x => x.tag), pk.susp) : '')}" ${on.length ? '' : 'disabled'}>Copy Anki search · ${plural(on.length, 'tag')}</button>
      <p class="hint">${pk.susp ? '"Only still suspended" finds just the cards you haven\'t unsuspended yet, so after you unsuspend them they no longer show up. Use it to get new cards ready.' : '"All cards" finds every card under these tags, suspended or not. Use it to review or browse.'}
        Paste it in Anki's Browse search.${usePg() ? '' : ' The video and chapter tags appear here once you\'ve added the PG27 tags in Anki (Progress → Anki tags).'}</p>
    </div>` : ''}</div>`;
}

// One search for many videos: a subject that's fully included becomes one wildcard.
function bulkQuery(vs, suspended) {
  if (!usePg()) return ankiQuery(vs, suspended);
  const ids = new Set(vs.map(v => v.id)), parts = [];
  for (const s of SUBJECTS) {
    const sv = VIDS.filter(v => v.subject === s), mine = sv.filter(v => ids.has(v.id));
    if (!mine.length) continue;
    if (mine.length === sv.length) parts.push(pgTag(sv[0]).split('::').slice(0, 2).join('::') + '::*');
    else parts.push(...mine.map(v => pgTag(v).replace(/::(\d+)_[^:]*$/, '::$1_*')));
  }
  return ankiQuery(parts, suspended);
}

export function view() {
  if (!ANKI) return { title: 'Anki tags', html: `<section class="card empty"><div class="ei">🗂️</div><div class="e1">No Anki data yet</div>Export your collection with tools/anki_export.py, then run tools/anki_map.py.</section>` };
  const subj = S.ui.ankiSubj || '';
  const all = VIDS.map(v => ({ v, a: ankiOf(v) || {}, done: !!prog(v.id).fr }));
  const sum = (xs, k) => xs.reduce((t, x) => t + (x.a[k] || 0), 0);
  const hit = all.filter(x => x.done);
  const cards = sum(all, 'c'), cardsHit = sum(hit, 'c');
  const qs = sum(all, 'qc'), qsHit = sum(hit, 'qc');
  const frac = cards ? cardsHit / cards : 0;
  const list = subj ? all.filter(x => x.v.subject === subj) : all;
  const groups = SUBJECTS.map(s => list.filter(x => x.v.subject === s)).filter(g => g.length);
  return {
    title: 'Anki tags',
    meta: `Mapped from your export · ${fmtDayYear(ANKI.made)}`,
    html: `
  <section class="card anki-sum">
    <div class="row" style="gap:16px">
      <div class="ak-ring" style="--p:${frac * 100}"><b class="num">${Math.round(frac * 100)}%</b><span>of cards</span></div>
      <div class="grow">
        <div class="t"><b class="num">${hit.length}</b> of ${VIDS.length} tags hit</div>
        <div class="small muted num">${cardsHit.toLocaleString('en-IN')} of ${cards.toLocaleString('en-IN')} study cards are under videos you've watched</div>
        <div class="small muted num">${qsHit.toLocaleString('en-IN')} of ${qs.toLocaleString('en-IN')} MCQ cards (frozen deck) unlocked</div>
      </div>
    </div>
    <div class="btns" style="margin-top:12px">
      ${hit.length ? `<button class="btn primary" data-act="copy" data-q="${h(bulkQuery(hit.map(x => x.v), true))}">${ICON.copy}Suspended cards of everything watched</button>` : ''}
    </div>
    <p class="hint">Marking a video watched marks its tag hit. Cards were placed on videos automatically from the card text, your tags and Marrow's chapter list, so a few sit under a neighbouring video. Retag those in Anki when you meet them.</p>
  </section>

  ${(() => {
    const u = Object.entries(ANKI.untagged || {}).sort((x, y) => (y[1].c + y[1].qc) - (x[1].c + x[1].qc));
    const tot = u.reduce((t, [, x]) => ({ n: t.n + x.n + x.q, c: t.c + x.c + x.qc }), { n: 0, c: 0 });
    return tot.n ? `<details class="card untagged">
      <summary class="row"><span class="grow"><b>Untagged: ${tot.c.toLocaleString('en-IN')} cards</b><span class="small muted" style="display:block">${tot.n.toLocaleString('en-IN')} notes where the video was too unsure to tag. Tap to see them by subject.</span></span><span class="faint">›</span></summary>
      <ul class="list mini-list">${u.map(([s, x]) => `<li class="item">${subjDot(s)}<span class="grow">${h(s)}</span><span class="num small muted">${(x.c + x.qc).toLocaleString('en-IN')} cards${x.qc ? ` · ${x.qc} MCQ` : ''}</span></li>`).join('')}</ul>
      <p class="hint">In Anki they get the tag <span class="mono">PG27::_Unsure::&lt;subject&gt;</span>, so you can sort them as you study.</p>
      ${usePg() ? `<button class="btn block" data-act="copy" data-q="${h(ankiQuery(['PG27::_Unsure::*'], false))}">Copy search · all untagged</button>` : ''}
    </details>` : '';
  })()}

  <button class="card tomorrow" data-act="ankilib">
    <span class="rbadge" style="--h:45">📚</span>
    <span class="grow"><span class="t">Anki library</span><span class="s">Every deck and tag: PYQs (AIIMS, NEET, INICET), regular learning, frozen MCQs</span></span>
    <span class="faint">›</span>
  </button>

  <section class="card">
    <label class="row" style="gap:12px"><input type="checkbox" data-act="ak-tagged" ${S.settings.ankiTagged ? 'checked' : ''}>
      <span class="grow"><b>I've added the PG27 tags in Anki</b><br><span class="small muted">Then every search in the app uses one tag per video. Before that, searches use the old draft tags.</span></span></label>
  </section>

  <div class="chips scroll-x" style="margin:6px 0">${[['', 'All'], ...SUBJECTS.map(s => [s, s])].map(([val, l]) =>
    `<button class="chip" data-act="ak-subj" data-v="${h(val)}" aria-pressed="${subj === val}"${val ? ` style="--h:${subjHue(val)}"` : ''}>${val ? subjDot(val) : ''}${h(l)}</button>`).join('')}</div>

  ${groups.map(g => {
    const s = g[0].v.subject, c = sum(g, 'c'), ch = sum(g.filter(x => x.done), 'c');
    return `<section class="card flush ak-group">
      <div class="ak-head">${subjDot(s)}<b class="grow">${h(s)}</b><span class="small num muted">${g.filter(x => x.done).length}/${g.length} tags · ${pct(c ? ch / c : 0)} of ${c.toLocaleString('en-IN')} cards</span></div>
      <div class="bar-line" style="margin:0 14px 6px"><i style="width:${c ? (ch / c) * 100 : 0}%"></i></div>
      <ul class="list">${g.map(x => `<li class="item ak-row${x.done ? ' done' : ''}">
        <span class="ak-check">${x.done ? '✓' : ''}</span>
        <button class="open" data-act="open-video" data-id="${x.v.id}"><div class="t">${h(x.v.title)}</div>
          <div class="s small faint">${h(tagShort(x.v))}</div></button>
        <span class="ak-c num"><b>${(x.a.c || 0).toLocaleString('en-IN')}</b>${x.a.qc ? `<span>+${x.a.qc} MCQ</span>` : ''}</span></li>`).join('')}</ul>
    </section>`;
  }).join('')}`,
  };
}

export const actions = {
  'ak-pick': el => { const k = el.dataset.v; pick.off.has(k) ? pick.off.delete(k) : pick.off.add(k); },
  'ak-all': () => { const v = VIDS.find(x => x.id === pick.vid); const items = pickItems(v); pick.off = pick.off.size ? new Set() : new Set(items.map(x => x.k)); },
  'ak-susp': el => { pick.susp = el.dataset.v === '1'; },
  anki: () => { S.ui.ankiBack = S.ui.tab === 'anki' ? S.ui.ankiBack : S.ui.tab; S.ui.tab = 'anki'; return 'enter'; },
  'ak-subj': el => { S.ui.ankiSubj = el.dataset.v; },
  'ak-tagged': el => { S.settings.ankiTagged = el.checked; save(); },
};
