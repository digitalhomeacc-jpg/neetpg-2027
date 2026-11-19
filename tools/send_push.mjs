// Run by .github/workflows/reminders.yml. Needs two repository secrets:
// VAPID_PRIVATE_KEY (made with the public key in js/notify.js) and PUSH_SUBSCRIPTION
// (copied from the app: Settings → Reminders).
import webpush from 'web-push';
import { readFileSync } from 'node:fs';

const pub = readFileSync(new URL('../js/notify.js', import.meta.url), 'utf8').match(/VAPID_PUBLIC = '([^']+)'/)[1];
const { VAPID_PRIVATE_KEY: priv, PUSH_SUBSCRIPTION: sub, KIND: kind = 'morning' } = process.env;
if (!priv || !sub) {
  console.log('Reminders are not set up yet: add VAPID_PRIVATE_KEY and PUSH_SUBSCRIPTION as repository secrets.');
  process.exit(0);
}
webpush.setVapidDetails('https://github.com/digitalhomeacc-jpg/neetpg-2027', pub, priv.trim());
try {
  const res = await webpush.sendNotification(JSON.parse(sub), JSON.stringify({ kind }), { TTL: 6 * 3600, urgency: 'high' });
  console.log(`Sent ${kind} reminder: HTTP ${res.statusCode}`);
} catch (e) {
  console.error(`Push failed: HTTP ${e.statusCode} ${e.body || e.message}`);
  if (e.statusCode === 404 || e.statusCode === 410) console.error('The phone dropped this subscription. Turn reminders on again in the app and update PUSH_SUBSCRIPTION.');
  process.exit(1);
}
