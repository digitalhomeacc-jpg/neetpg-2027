"""Place previous-year topics (PYTs) on WOR videos and chapters.

    python3 tools/pyt_map.py topics.json anki_export.jsonl.gz anki_mapping.json.gz js/data-wor.js out.json

topics.json: [{"topic": "...", "subject": "Pharmacology" | "Misc", ...}, ...]

Each topic is looked up in your Anki notes (question, answer and tags). The notes that mention
it were already placed on videos by tools/anki_map.py, so they vote: weighted by how sure that
placement was. Chapter titles that contain the topic vote too. The result for each topic is the
video (and chapter, when one is clear), with a confidence: the winning share of the votes.
"""
import gzip, json, re, sys, collections

topics_path, export, mapping_path, worjs, out = sys.argv[1:6]
topics = json.load(open(topics_path))
notes = [json.loads(l) for l in gzip.open(export, 'rt', encoding='utf-8')]
mapping = json.load(gzip.open(mapping_path, 'rt'))
W = json.loads(open(worjs, encoding='utf-8').read().split('=', 1)[1].strip().rstrip(';'))
V = W['videos']; BY = {v['id']: v for v in V}

def norm(s):
    s = re.sub(r'<[^>]+>|\[img\]', ' ', s)
    return re.sub(r'[^a-z0-9]+', ' ', s.lower()).strip()

STOP = set('the of and in with for to a an on by vs at from or is are its their type types'.split())
# Inverted index over note text: word -> note indexes.
docs = [' ' + norm(n['q'] + ' ' + n['a'] + ' ' + ' '.join(t.replace('::', ' ').replace('_', ' ') for t in n['tags'])) + ' ' for n in notes]
index = collections.defaultdict(set)
for i, d in enumerate(docs):
    for w in set(d.split()):
        if len(w) >= 3: index[w].add(i)

def fix_breaks(t):
    # Words split at a line end in the PDF ("pheochromoc ytoma"): join pieces that only make
    # sense together.
    ws = t.split()
    out = []
    for w in ws:
        if out:
            j = norm(out[-1] + w)
            if j and ' ' not in j and len(index.get(j, ())) >= 3 and (len(index.get(norm(w), ())) < 3 or len(index.get(norm(out[-1]), ())) < 3):
                out[-1] = out[-1] + w; continue
        out.append(w)
    return ' '.join(out)

def candidates(t):
    words = [w for w in norm(t).split() if w not in STOP]
    if not words: return []
    rare = sorted((w for w in words if len(w) >= 3), key=lambda w: len(index.get(w, ())))
    if not rare: return []
    pool = set(index.get(rare[0], ()))
    for w in rare[1:3]: pool &= index.get(w, set())
    phrase = ' ' + ' '.join(words) + ' '
    exact = [i for i in pool if phrase in docs[i]]
    return exact if exact else list(pool)

chap_norm = {v['id']: [c[1] for c in v.get('chapters', [])] for v in V}  # raw titles; split, then normalised
import difflib
GENERIC = set('miscellaneous summary introduction basics management classification anatomy treatment features diagnosis investigations overview presentation complications types other side effects disorders diseases'.split())
def parts(c):
    # A chapter title split at "&", ",", "/", "vs", "and": each part is a name on its own.
    return [norm(p) for p in re.split(r'\s+(?:vs\.?|and|or)\s+|\s*[,/&:]\s*', c, flags=re.I) if norm(p)]
squash = lambda s: re.sub(r'[^a-z0-9]', '', s)
def title_match(nt, c):
    # 3 = same name (ignoring spaces/apostrophes, small spelling slips), 2 = topic is a whole part
    # of the chapter title, 1 = a part of the title is the whole topic. 0 = no match.
    st = squash(nt)
    for p in parts(c) + [norm(c)]:
        if p in GENERIC: continue
        sp = squash(p)
        if not sp or len(sp) < 4: continue
        r_ = difflib.SequenceMatcher(None, st, sp).ratio()
        same_ends = st[:3] == sp[:3] and st[-3:] == sp[-3:]
        if st == sp or (same_ends and ((len(st) >= 6 and r_ >= 0.88) or (min(len(st), len(sp)) >= 12 and r_ >= 0.84))): return 3
    if re.search(r'\b' + re.escape(nt) + r'\b', norm(c)): return 2
    for p in parts(c):
        if p not in GENERIC and len(squash(p)) >= 6 and re.search(r'\b' + re.escape(p) + r'\b', nt): return 1
    return 0
res = []
# How many notes each lecture holds: votes are scaled by this so a crowded lecture can't win
# on size alone.
vid_notes = collections.Counter(m[0] for m in mapping.values() if m[1] >= 45)
def tally(ids, subj):
    votes, chv = collections.Counter(), collections.Counter()
    for i in ids:
        m = mapping.get(str(notes[i]['id']))
        if not m or m[1] < 45: continue
        vid, conf, kind, ch = m[0], m[1], m[2], (m[3] if len(m) > 3 else None)
        if subj and BY[vid]['subject'] != subj: continue
        if BY[vid]['mins'] < 10: continue     # the short "Introduction to … Revision" overviews
        w = conf / 100 * (150 / max(150, vid_notes[vid])) ** 0.5
        votes[vid] += w
        if ch is not None: chv[(vid, ch)] += w
    return votes, chv

for tp in topics:
    for f in ('q', 'x'):
        if tp.get(f): tp[f] = fix_breaks(tp[f])
    t, subj = fix_breaks(tp['topic']), tp.get('subject')
    subj = None if subj in (None, 'Misc') else subj
    ids = candidates(t)
    votes, chv = tally(ids, subj)
    # Asked in one subject's paper but taught in another's lectures (HSV in a Medicine paper):
    # look across all subjects when this subject's lectures have nothing.
    cross = False
    if subj and sum(votes.values()) < 1:
        v2, c2 = tally(ids, None)
        if sum(v2.values()) >= 2: votes, chv, cross = v2, c2, True
    # Chapter titles that contain the whole topic. Only these decide the chapter: notes'
    # chapter guesses are too noisy for that.
    chv = collections.Counter()
    titled = titled_strong = False
    nt = norm(t)
    if len(nt) >= 4:
        best = 0; hits = []
        for v in V:
            if subj and not cross and v['subject'] != subj: continue
            if v['mins'] < 10: continue
            for ci, c in enumerate(chap_norm[v['id']]):
                sc = title_match(nt, c)
                if sc: hits.append((sc, v['id'], ci))
        if hits:
            top = max(h[0] for h in hits)
            tops = [h for h in hits if h[0] == top]
            if top == 1:
                # Only a word of the topic names a chapter ("cardiac" in "Cardiac & Smooth Muscles"):
                # a hint, not proof.
                for sc, vid_, ci in tops: votes[vid_] += 1.5; chv[(vid_, ci)] += 1.5
            elif len({h[1] for h in tops}) == 1:
                titled_strong = True
                # One lecture has a chapter named after the topic: that settles it.
                vid_ = tops[0][1]
                votes = collections.Counter({vid_: max(12, sum(votes.values()))}); chv = collections.Counter({(vid_, tops[0][2]): 1}); titled = True
            else:
                for sc, vid_, ci in tops: votes[vid_] += 12; chv[(vid_, ci)] += 12
                titled = True
    total = sum(votes.values())
    if not total:
        res.append({**tp, 'topic_clean': t, 'vid': None, 'guess': None, 'ch': None, 'conf': 0, 'notes': len(ids)}); continue
    vid, w = votes.most_common(1)[0]
    chs = [(k, x) for k, x in chv.items() if k[0] == vid]
    ch, cw = (max(chs, key=lambda kx: kx[1]) if chs else ((None, None), 0))
    ch_share = cw / sum(x for _, x in chs) if chs else 0
    share = w / total
    # Only link when the evidence is clear; otherwise leave it for you to link in the app.
    short = len(nt.replace(' ', '')) <= 4          # ART, TCA, CPR… mean too many things
    sure = titled_strong or (share >= 0.65 and total >= 2) or (w >= 3.5 and share >= 0.6)
    if cross: sure = share >= 0.75 and total >= 3
    if short and not titled: sure = False
    res.append({**tp, 'topic_clean': t, 'vid': vid if sure else None, 'guess': vid, 'ch': ch[1] if sure and chs and ch_share >= 0.5 else None,
                'conf': round(share, 2), 'votes': round(total, 1), 'notes': len(ids), 'cross': cross})
json.dump(res, open(out, 'w'), indent=0, ensure_ascii=False)
placed = [r for r in res if r['vid']]
print(f'{len(res)} topics, placed on a video: {len(placed)} ({len(placed)/max(1,len(res)):.0%}); '
      f'confident (≥60% of votes): {sum(1 for r in placed if r["conf"] >= 0.6)}; with a chapter: {sum(1 for r in placed if r["ch"] is not None)}')
