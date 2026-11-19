// Run by .github/workflows/reminders.yml. Needs two repository secrets:
//   VAPID_PRIVATE_KEY  made with the public key in js/notify.js
//   PUSH_SUBSCRIPTION  subscription codes copied from the app (Settings → Reminders),
//                      one per line, so friends' phones get reminders too.
// Each phone builds its own reminder text from its own plan; this only wakes it up.
import webpush from 'web-push';
import { readFileSync } from 'node:fs';

const pub = readFileSync(new URL('../js/notify.js', import.meta.url), 'utf8').match(/VAPID_PUBLIC = '([^']+)'/)[1];
const { VAPID_PRIVATE_KEY: priv, PUSH_SUBSCRIPTION: raw, KIND: kind = 'morning' } = process.env;
if (!priv || !raw) {
  console.log('Reminders are not set up yet: add VAPID_PRIVATE_KEY and PUSH_SUBSCRIPTION as repository secrets.');
  process.exit(0);
}

// Accept one code, a JSON list of codes, or one code per line.
function parse(text) {
  const t = text.trim();
  try { const j = JSON.parse(t); return Array.isArray(j) ? j : [j]; } catch { /* fall through to lines */ }
  return t.split(/\n+/).map(l => l.trim()).filter(Boolean).map((l, i) => {
    try { return JSON.parse(l); } catch { throw new Error(`Line ${i + 1} of PUSH_SUBSCRIPTION isn't a subscription code. Copy it again from the app.`); }
  });
}

webpush.setVapidDetails('https://github.com/digitalhomeacc-jpg/neetpg-2027', pub, priv.trim());
const subs = parse(raw);
let sent = 0;
for (const [i, sub] of subs.entries()) {
  // Only the end of the endpoint goes in the log, so it can tell phones apart without exposing them.
  const tag = `phone ${i + 1} (…${String(sub.endpoint || '').slice(-6)})`;
  try {
    const res = await webpush.sendNotification(sub, JSON.stringify({ kind }), { TTL: 6 * 3600, urgency: 'high' });
    console.log(`${tag}: sent ${kind} reminder, HTTP ${res.statusCode}`);
    sent++;
  } catch (e) {
    console.error(`${tag}: failed, HTTP ${e.statusCode} ${e.body || e.message}`);
    if (e.statusCode === 404 || e.statusCode === 410) console.error(`  ${tag} dropped its subscription. That person should turn reminders on again and send you a new code.`);
  }
}
console.log(`${sent} of ${subs.length} reminders sent.`);
if (!sent) process.exit(1);
