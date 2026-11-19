import { S, VIDS, D, DOW, DOW_LONG, SPEEDS, save, today, h, hrs, sp, mergeState, replaceState, resetProgress } from '../core.js';
import { seg, sectionH, toast, copy, ICON } from '../ui.js';
import { pushSupported, isInstalled, isIOS, enablePush, testNotification, summaryLine } from '../notify.js';

function reminders() {
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  if (isIOS() && !isInstalled()) {
    return `<p class="small" style="margin:0">On iPhone, reminders only work from the home-screen app. In Safari tap <b>Share → Add to Home Screen</b>, open PG 2027 from there, and come back here.</p>`;
  }
  if (!pushSupported()) return `<p class="small muted" style="margin:0">This browser can't receive push notifications.</p>`;
  if (!S.push || perm !== 'granted') {
    return `<p class="small muted" style="margin:0 0 12px">A notification at 7 am with today's bare minimum and what to revise, and one at 9 pm if you're short.</p>
      <button class="btn primary block" data-act="push-on">Turn on reminders</button>
      ${perm === 'denied' ? '<p class="hint">Notifications are blocked. Allow them for PG 2027 in iPhone Settings → Notifications.</p>' : ''}`;
  }
  return `<p class="small" style="margin:0 0 4px"><b>On for this device.</b> Today: ${summaryLine()}.</p>
    <div class="btns" style="margin:12px 0"><button class="btn" data-act="push-test" data-v="morning">Test morning</button><button class="btn" data-act="push-test" data-v="evening">Test evening</button></div>
    <details class="setup"><summary>One-time GitHub setup (3 minutes)</summary>
      <ol class="small">
        <li>In GitHub, open the <b>neetpg-2027</b> repo → Settings → Secrets and variables → Actions → <b>New repository secret</b>.</li>
        <li>Name <code>PUSH_SUBSCRIPTION</code>, value: tap the button below and paste.</li>
        <li>Add another secret named <code>VAPID_PRIVATE_KEY</code> with the key from the file Claude sent you.</li>
        <li>Actions tab → Daily reminders → <b>Run workflow</b> to test it.</li>
      </ol>
      <button class="btn block" data-act="push-copy">Copy subscription code</button>
    </details>`;
}

export function view() {
  const st = S.settings;
  return {
    title: 'Settings',
    meta: '',
    html: `
  ${sectionH('Plan')}
  <section class="card">
    <div class="field" style="margin-top:0"><label for="s-start">Started on</label><input id="s-start" type="date" data-set="start" value="${st.start}">
      <p class="hint">"Behind/ahead" is measured from this date. Set it to today for a fresh start.</p></div>
    <div class="field"><label for="s-target">Finish WOR first watch by</label><input id="s-target" type="date" data-set="target" value="${st.target}"></div>
    <div class="field"><label for="s-exam">Exam date</label><input id="s-exam" type="date" data-set="exam" value="${st.exam}">
      <p class="hint">NBEMS hasn't announced NEET PG 2027. This estimate is based on 30 Aug 2026. Phases in Plan follow this date.</p></div>
    <div class="field"><span class="lbl">Rest days</span><div class="days">${DOW.map((d, i) => `<button data-act="rest" data-v="${i}" aria-pressed="${st.rest.includes(i)}" aria-label="${DOW_LONG[i]}">${d}</button>`).join('')}</div></div>
    <div class="field"><span class="lbl">Usual watching speed</span>${seg('speed', SPEEDS.map(s => [s, sp(s)]), st.speed)}
      <p class="hint">Pre-selected when you mark a video. After 2 hours logged, plans use your real average.</p></div>
    <div class="field" style="margin-bottom:0"><span class="lbl">Questions in a full test</span>${seg('questions', [[200, '200'], [180, '180']], st.questions)}
      <p class="hint">Reports conflict on whether 2026 had 180 or 200 questions. This only sets the default when you log a test.</p></div>
  </section>

  <section class="card flush"><ul class="list"><li class="item"><span class="rbadge" style="--h:30">🕘</span>
    <button class="open" data-act="history"><div class="t">Change history</div><div class="s">Every change, with the exact time and what it was before</div></button><span class="faint">${ICON.chev}</span></li></ul></section>

  ${sectionH('Reminders')}
  <section class="card">${reminders()}</section>

  ${sectionH('Appearance')}
  <section class="card">${seg('theme', [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']], st.theme)}</section>

  ${sectionH('Backup')}
  <section class="card">
    <p class="small muted" style="margin:0 0 12px">Everything is saved on this device only. Export a backup now and then; import it to move to another phone or browser.</p>
    <div class="btns">
      <button class="btn" data-act="export">Export backup</button>
      <label class="btn" for="import-file">Import backup</label>
      <input id="import-file" type="file" accept="application/json,.json" hidden>
    </div>
    <div class="spacer"></div>
    <button class="btn ghost danger" data-act="reset">Reset all progress</button>
  </section>

  <p class="small faint center">${VIDS.length} ${h(D.source)} videos · ${hrs(VIDS.reduce((a, v) => a + v.mins, 0))} runtime · from your EXAM_PREP sheet</p>`,
  };
}

export const actions = {
  'speed': el => { S.settings.speed = +el.dataset.v; save(); },
  'questions': el => { S.settings.questions = +el.dataset.v; save(); },
  'theme': el => { S.settings.theme = el.dataset.v; save(); },
  'rest': el => {
    const i = +el.dataset.v, r = S.settings.rest;
    const next = r.includes(i) ? r.filter(x => x !== i) : [...r, i];
    if (next.length > 6) { toast('Keep at least one study day'); return; }
    S.settings.rest = next; save();
  },
  'push-on': () => {
    enablePush().then(() => { toast('Reminders on. Finish the GitHub setup below.'); document.dispatchEvent(new Event('pg27:render')); })
      .catch(e => toast(e.message === 'denied' ? 'Notifications were not allowed' : "Couldn't turn on reminders here"));
  },
  'push-test': el => {
    testNotification(el.dataset.v)
      .then(n => toast(`Sent: “${n.title}”. Check your notifications.`))
      .catch(e => toast(e.message || "Couldn't show a notification"));
  },
  'push-copy': () => copy(S.push, 'Copied. Paste it as the PUSH_SUBSCRIPTION secret.'),
  'export': () => {
    const blob = new Blob([JSON.stringify({ app: 'pg27', exported: new Date().toISOString(), state: S }, null, 1)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `pg27-backup-${today()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  'reset': () => {
    if (!confirm('Delete all progress, tests and mistakes on this device? Export a backup first if you might want it back.')) return;
    resetProgress(); S.ui.tab = 'settings'; save(); toast('Progress reset');
  },
};

export function onChange(e) {
  const el = e.target;
  if (el.dataset.set && el.value) {
    const next = { ...S.settings, [el.dataset.set]: el.value };
    if (next.target <= next.start) { toast('The WOR deadline has to be after the start date'); return true; }
    if (next.exam <= next.target) { toast('The exam has to be after the WOR deadline'); return true; }
    S.settings[el.dataset.set] = el.value; save(); return true;
  }
  if (el.id === 'import-file' && el.files[0]) {
    el.files[0].text().then(txt => {
      const data = JSON.parse(txt);
      if (data.app !== 'pg27' || !data.state?.progress) throw new Error('bad file');
      if (!confirm(`Replace everything on this device with the backup from ${data.exported?.slice(0, 10) || 'that file'}?`)) return;
      const n = mergeState(data.state); n.ui.tab = 'today';
      replaceState(n); document.dispatchEvent(new Event('pg27:render')); toast('Backup imported');
    }).catch(() => toast("That file isn't a PG 2027 backup")).finally(() => { el.value = ''; });
    return false;
  }
  return false;
}
