# PG 2027

A personal NEET PG 2027 tracker. It runs in the browser, works offline, and can be added to an iPhone home screen.

## What it does now

- **Today:** a daily target in real minutes that adjusts as you go. It spreads the remaining Marrow WOR runtime over the study days left before your first-watch deadline, at the speed you actually watch. Below it you get the next videos in your sheet's block order, what you've done today, and a ready-to-paste Anki search for today's videos.
- **Videos:** all 271 WOR videos with runtimes, grouped by subject, with search. Mark a video watched at 1×–2×, then track revisions R1–R4.
- **Progress:** watched against an even pace (chart), an activity heatmap, revision passes, and how far along each subject is.
- **Settings:** plan dates, rest days, usual speed, theme, and backup export/import.

Progress is stored on the device (`localStorage`). Export a backup from Settings to keep a copy or move devices.

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
3. Readiness score for each topic, grand-test log and mistakes diary, BTR videos, and a phase planner up to the exam.
