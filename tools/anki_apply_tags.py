# Add the PG 2027 tags to your Anki notes: one tag per WOR video, or per chapter when the
# card clearly belongs to one, and PG27::_Unsure::<Subject> where the video was a guess.
#
# How to run (Anki desktop, collection closed on other devices):
#   1. File → Create Backup (so you can go back).
#   2. Put pg27_tags.json.gz (from Claude) in your Downloads folder.
#   3. Tools → Debug Console (Ctrl+Shift+; on Windows/Linux, Cmd+Shift+; on Mac).
#   4. Paste everything below into the top box and press Ctrl+Enter (Cmd+Enter on Mac).
#
# It only adds or replaces tags that start with PG27:: — your own tags, cards, scheduling and
# suspensions are left exactly as they are. Running it again with a newer file replaces the
# old PG27 tags. To remove them all: Browse → search  tag:PG27::*  → select all → Notes →
# Remove Tags… → PG27::*

import gzip, json, os
from aqt import mw

path = os.path.join(os.path.expanduser('~'), 'Downloads', 'pg27_tags.json.gz')
new_tags = json.load(gzip.open(path, 'rt', encoding='utf-8'))
col = mw.col
notes, missing = [], 0
for nid, tags in new_tags.items():
    try:
        note = col.get_note(int(nid))
    except Exception:
        missing += 1  # deleted since the export
        continue
    keep = [t for t in note.tags if not t.startswith('PG27::')]
    if sorted(keep + tags) != sorted(note.tags):
        note.tags = keep + tags
        notes.append(note)
for i in range(0, len(notes), 2000):
    col.update_notes(notes[i:i + 2000])
mw.reset()
print(f'Tagged {len(notes)} notes. {missing} notes from the export no longer exist. Done.')
