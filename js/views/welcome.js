// First launch on a new phone: set your own dates, speed and what you've already watched.
import { S, VIDS, SUBJECTS, DOW, DOW_LONG, SPEEDS, save, today, studyDays, mergeState, replaceState, h, mins, sp, fmtDayYear, subjDot, subjHue } from '../core.js';
import { toast, confetti } from '../ui.js';
import { isInstalled, isIOS } from '../notify.js';

let step = 0;
let done = new Set();
const el = () => document.getElementById('welcome-root');
export const needed = () => !S.onboarded;

function perDay() {
  const st = S.settings;
  const left = VIDS.reduce((a, v) => a + (done.has(v.subject) ? 0 : v.mins), 0);
  const days = Math.max(1, studyDays(st.start > today() ? st.start : today(), st.target));
  return left / st.speed / days;
}

function screen() {
  const st = S.settings;
  const dots = `<div class="wl-dots">${[0, 1, 2, 3].map(i => `<i class="${i === step ? 'on' : i < step ? 'past' : ''}"></i>`).join('')}</div>`;
  if (step === 0) {
    return `<div class="wl-body">
      <div class="wl-logo"><svg viewBox="0 0 116 116"><circle cx="58" cy="58" r="44" class="track"/><circle cx="58" cy="58" r="44" class="bar" stroke-dasharray="276" stroke-dashoffset="70"/><path d="M40 60l12 12 26-28" class="tick"/></svg></div>
      <h1>PG 2027</h1>
      <p class="wl-lead">Your NEET PG plan: every Marrow WOR video, five spaced revisions of each, and a daily target you can actually finish.</p>
      <ul class="wl-feats">
        <li><b>📅</b><span><strong>Plan your days</strong>Pick the lectures for each day against the hours it needs.</span></li>
        <li><b>🧠</b><span><strong>Revise on schedule</strong>Recall first, then revise against a shrinking time limit.</span></li>
        <li><b>🎯</b><span><strong>Track tests and mistakes</strong>Every wrong answer pulls its topic back for revision.</span></li>
      </ul>
    </div>
    <div class="wl-foot">${dots}
      <button class="btn primary block" data-act="wl-next">Set up my plan</button>
      <label class="btn block ghost-btn" for="wl-import">Restore a backup instead</label><input id="wl-import" type="file" accept="application/json,.json" hidden>
    </div>`;
  }
  if (step === 1) {
    const pd = perDay();
    return `<div class="wl-body">
      <div class="wl-step">Step 1 of 2</div><h2>Your dates</h2>
      <div class="field"><label for="wl-start">Starting WOR on</label><input id="wl-start" type="date" value="${st.start}"></div>
      <div class="field"><label for="wl-target">Finish the first watch by</label><input id="wl-target" type="date" value="${st.target}"></div>
      <div class="field"><label for="wl-exam">Exam date (estimate)</label><input id="wl-exam" type="date" value="${st.exam}">
        <p class="hint">NBEMS hasn't announced NEET PG 2027 yet. You can change this any time.</p></div>
      <div class="field"><span class="lbl">Rest days</span><div class="days">${DOW.map((d, i) => `<button data-act="wl-rest" data-v="${i}" aria-pressed="${st.rest.includes(i)}" aria-label="${DOW_LONG[i]}">${d}</button>`).join('')}</div></div>
      <div class="field"><span class="lbl">Usual watching speed</span><div class="seg">${SPEEDS.map(s => `<button data-act="wl-speed" data-v="${s}" aria-pressed="${s === st.speed}">${sp(s)}</button>`).join('')}</div></div>
      <div class="wl-calc"><b class="num">${mins(pd)}</b><span>a study day of new videos to finish by ${fmtDayYear(st.target)}${pd > 360 ? ' — that\'s a lot. Try a later date.' : ''}</span></div>
    </div>
    <div class="wl-foot">${dots}<div class="btns"><button class="btn" data-act="wl-back">Back</button><button class="btn primary" data-act="wl-next">Next</button></div></div>`;
  }
  if (step === 2) {
    return `<div class="wl-body">
      <div class="wl-step">Step 2 of 2</div><h2>Already watched any?</h2>
      <p class="muted">Tap every subject you've finished. You can tick single videos in Library later.</p>
      <div class="wl-subjects">${SUBJECTS.map(s => `<button class="chip" data-act="wl-subject" data-v="${h(s)}" aria-pressed="${done.has(s)}" style="--h:${subjHue(s)}">${subjDot(s)}${h(s)}</button>`).join('')}</div>
      <div class="wl-calc"><b class="num">${mins(perDay())}</b><span>a study day after this</span></div>
    </div>
    <div class="wl-foot">${dots}<div class="btns"><button class="btn" data-act="wl-back">Back</button><button class="btn primary" data-act="wl-finish">${done.size ? `Finish · ${done.size} done` : 'Finish'}</button></div></div>`;
  }
  return `<div class="wl-body center-col">
      <div class="wl-big">🎉</div><h2>You're set</h2>
      <p class="wl-lead">Today now shows your target. Plan tomorrow's lectures from the card on Today.</p>
      ${isIOS() && !isInstalled() ? `<div class="note" style="text-align:left"><b>Add it to your home screen.</b> In Safari tap Share → Add to Home Screen, then open PG 2027 from there. It works offline and can send daily reminders.</div>` : ''}
    </div>
    <div class="wl-foot">${dots}<button class="btn primary block" data-act="wl-close">Let's go</button></div>`;
}

export function renderWelcome() {
  if (!needed() && step < 3) { el().innerHTML = ''; return; }
  const first = !el().firstElementChild;
  el().innerHTML = `<div class="welcome${first ? ' enter' : ''}">${screen()}</div>`;
  document.body.classList.add('locked');
}

function readDates() {
  const g = id => document.getElementById(id)?.value;
  const st = S.settings, n = { start: g('wl-start') || st.start, target: g('wl-target') || st.target, exam: g('wl-exam') || st.exam };
  if (n.target <= n.start) { toast('The finish date has to be after the start'); return false; }
  if (n.exam <= n.target) { toast('The exam has to be after the finish date'); return false; }
  Object.assign(st, n); return true;
}

export const actions = {
  'wl-next': () => { if (step === 1 && !readDates()) return; step++; },
  'wl-back': () => { if (step === 1) readDates(); step = Math.max(0, step - 1); },
  'wl-rest': e => { readDates(); const i = +e.dataset.v, r = S.settings.rest; const n = r.includes(i) ? r.filter(x => x !== i) : [...r, i]; if (n.length <= 6) S.settings.rest = n; },
  'wl-speed': e => { readDates(); S.settings.speed = +e.dataset.v; },
  'wl-subject': e => { const s = e.dataset.v; done.has(s) ? done.delete(s) : done.add(s); },
  'wl-finish': () => {
    for (const v of VIDS) if (done.has(v.subject)) (S.progress[v.id] ||= {}).fr = { d: S.settings.start < today() ? S.settings.start : today(), s: S.settings.speed };
    S.onboarded = true; S.ui.tab = 'today'; step = 3; save();
    setTimeout(confetti, 150);
  },
  'wl-close': () => { step = 0; el().innerHTML = ''; document.body.classList.remove('locked'); return 'top'; },
};

export function onChange(e) {
  if (['wl-start', 'wl-target', 'wl-exam'].includes(e.target.id)) { readDates(); save(); renderWelcome(); return 'handled'; }
  if (e.target.id === 'wl-import' && e.target.files[0]) {
    e.target.files[0].text().then(txt => {
      const data = JSON.parse(txt);
      if (data.app !== 'pg27' || !data.state?.progress) throw new Error();
      const n = mergeState(data.state); n.onboarded = true; n.ui.tab = 'today';
      replaceState(n); el().innerHTML = ''; document.body.classList.remove('locked');
      document.dispatchEvent(new Event('pg27:render')); toast('Backup restored');
    }).catch(() => toast("That file isn't a PG 2027 backup"));
    return 'handled';
  }
  return false;
}
