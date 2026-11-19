# PG 2027

A personal NEET PG 2027 tracker. It runs in the browser, works offline, and can be added to an iPhone home screen.

## What it does now

- **Today:** your bare minimum and full-day goal. The goal is revisions that are due plus new WOR videos. Below it: revisions due (most overdue first), a week strip, the next new videos, open mistakes, what's done today, and Anki searches for today's videos.
- **Spaced revisions with active recall:** every video gets five revisions after the first watch, each with less time than the last (50%, 35%, 25%, 15% and 10% of the runtime). They fall due after growing gaps (3, 10, 30, 60 and 90 days), squeezed to fit before the exam. Each session goes: recall from memory → check against the video's topics and your mistakes → rate yourself (which moves the next revision sooner or later) → revise against a countdown.
- **Plan:** a timeline of the four phases up to the exam, with goals to tick off. Also a "what if" slider (hours a day → finish date), the revision load for the next 8 weeks, and a day-by-day schedule of revisions and new videos.
- **Tests:** log grand tests, subject tests and PYQ sets (+4/−1). Shows a score trend against the rank <1,500 zone (~620/800, from unofficial 2025 tables). The mistakes diary sorts errors by cause, and a mistake tied to a video pulls that video's next revision forward.
- **Progress:** pace chart, activity heatmap, passes, and each subject's progress.
- **Reminders:** a 7 am "today: at least X, revise these" and a 9 pm "you're Y short" (see below).

Everything is stored on the device (`localStorage`). Export a backup from Settings.

## Reminders

GitHub Actions (`.github/workflows/reminders.yml`) sends a wake-up push twice a day. The service worker on the phone fills in the text from a summary the app keeps in its cache, so the repo never sees your progress. Setup:

1. Add the app to the iPhone home screen and open it from there (iOS 16.4+).
2. Settings → Reminders → **Turn on reminders**, then **Copy subscription code**.
3. In the repo: Settings → Secrets and variables → Actions. Add `PUSH_SUBSCRIPTION` (the copied code) and `VAPID_PRIVATE_KEY` (sent privately; it pairs with the public key in `js/notify.js`).
4. Actions → Daily reminders → Run workflow to test.

Times are in the workflow's cron lines, in UTC (01:30 and 15:30 UTC = 7 am and 9 pm IST).

## Install on iPhone

Once GitHub Pages is on (Settings → Pages → deploy from `main`, root folder), open the site in Safari, then Share → **Add to Home Screen**.

## Data

`js/data-wor.js` is generated from the EXAM_PREP sheet:

```
python3 tools/extract_sheet.py EXAM_PREP.xlsx wor.json
python3 tools/build_data.py wor.json js/data-wor.js
```

The Anki tags in it are a **draft**. They'll be replaced once the tag list from the real Anki collection has been mapped.

When any app file changes, bump `VERSION` in `sw.js` so phones fetch the new version.

## Next

1. Map Anki tags against the real collection (needs `anki_tags.tsv` from Anki desktop).
2. Add a topic list for each subject, with previous-year questions tagged by topic and year.
3. Readiness score for each topic, BTR videos.
