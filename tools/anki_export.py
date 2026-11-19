# Paste this whole file into Anki desktop's debug console
# (Tools menu → Debug Console, or Ctrl+Shift+; / Cmd+Shift+;) and press Ctrl+Enter / Cmd+Enter.
#
# It only READS your collection. It writes one file to your home folder:
#   pg27_anki_export.jsonl.gz   (one line per note: id, deck path, tags, short text, card states)
# Upload that file to Claude so every note can be mapped to a WOR video / topic.

import gzip, json, os, re, html as _html

col = mw.col
deck_name = {d.id: d.name for d in col.decks.all_names_and_ids()}

def clean(s, n=400):
    s = re.sub(r"<(br|div|p|li)[^>]*>", " ", s, flags=re.I)
    s = re.sub(r"<img[^>]*>", " [img] ", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = re.sub(r"\[sound:[^\]]+\]", "", s)
    s = _html.unescape(s)
    s = re.sub(r"\{\{c\d+::(.*?)(::[^}]*)?\}\}", r"\1", s)  # cloze → plain text
    s = re.sub(r"\s+", " ", s).strip()
    return s[:n]

notes = {}
for nid, mid, tags, flds in col.db.execute("select id, mid, tags, flds from notes"):
    f = flds.split("\x1f")
    notes[nid] = {
        "id": nid,
        "tags": tags.split(),
        "q": clean(f[0]),
        "a": clean(f[1], 250) if len(f) > 1 else "",
        "decks": set(), "cards": 0, "susp": 0, "new": 0, "mature": 0,
    }

for nid, did, odid, queue, ctype, ivl in col.db.execute("select nid, did, odid, queue, type, ivl from cards"):
    n = notes.get(nid)
    if not n:
        continue
    n["decks"].add(deck_name.get(odid or did, "?"))  # odid = home deck when the card sits in a filtered deck
    n["cards"] += 1
    if queue == -1: n["susp"] += 1
    if ctype == 0: n["new"] += 1
    if ivl >= 21: n["mature"] += 1

path = os.path.expanduser("~/pg27_anki_export.jsonl.gz")
with gzip.open(path, "wt", encoding="utf-8") as out:
    for n in notes.values():
        n["decks"] = sorted(n["decks"])
        out.write(json.dumps(n, ensure_ascii=False) + "\n")

print(f"Wrote {len(notes):,} notes to {path} ({os.path.getsize(path) / 1e6:.1f} MB)")
