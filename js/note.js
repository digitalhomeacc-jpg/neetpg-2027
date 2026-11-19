// Turns the cached day summary into reminder text. Plain script (no modules) so both
// the page and the service worker (via importScripts) use exactly the same wording.
(function (root) {
  const pad = n => String(n).padStart(2, '0');
  const isoToday = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const mins = m => { m = Math.round(m); if (m < 60) return `${m} min`; const h = Math.floor(m / 60), r = m % 60; return r ? `${h}h ${r}m` : `${h}h`; };
  const list = (xs, n) => xs.slice(0, 3).join(', ') + (n > 3 ? ` +${n - 3} more` : '');

  function build(s, kind) {
    if (!s) return { title: 'PG 2027', body: "Open the app to see today's plan." };
    const t = isoToday(), d = s.days && s.days[t];
    if (!d) return { title: 'PG 2027', body: "It's been a while. Open the app and pick up where you left off." };
    const revs = list(d.rev.map(r => `${r.title} (${r.k})`), d.revN);
    const news = list(d.news, d.newN);
    if (kind === 'evening') {
      const real = s.today === t ? ((s.real && s.real[t]) || 0) : 0;
      if (d.goal && real >= d.goal) return { title: `Target done: ${mins(real)} today`, body: 'Rest well.' };
      return {
        title: real ? `${mins(d.goal - real)} short of today's target` : `Not started today. Target is ${mins(d.goal)}`,
        body: d.revN ? `Revisions still due: ${revs}` : (news ? `Next up: ${news}` : 'Even 30 minutes keeps the streak going.'),
      };
    }
    if (!d.goal && !d.revN) return { title: 'Rest day', body: 'Nothing is due today.' };
    return {
      title: `Today: ${mins(d.goal)}`,
      body: [d.revN ? `Revise: ${revs}` : '', d.newN ? `New: ${news}` : ''].filter(Boolean).join('\n') || `Full day ${mins(d.goal)}.`,
    };
  }
  root.PG27Note = { build };
})(typeof self !== 'undefined' ? self : window);
