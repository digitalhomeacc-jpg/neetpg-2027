"""Build the concept map: every Marrow WOR chapter as a concept, merged across lectures,
with links between concepts.

    python3 tools/build_concepts.py js/data-wor.js anki_export.jsonl.gz js/data-concepts.js

Concepts: each chapter name is a concept. The same name in several lectures (Pheochromocytoma
in Physiology, Pathology, Medicine, Surgery) is one concept with several homes. Generic names
("Miscellaneous", "Investigations") stay tied to their lecture.

Links (the "mind map"):
  - same:     the concept appears in more than one lecture (shown as its homes)
  - contains: one name holds the other whole ("Hyperparathyroidism" / "Primary Hyperparathyroidism")
  - co:       your Anki notes mention both concepts together, more than chance would give.
Only names and counts are written; no card text.
"""
import difflib, gzip, json, math, re, sys, collections

worjs, export, out = sys.argv[1:4]
W = json.loads(open(worjs, encoding='utf-8').read().split('=', 1)[1].strip().rstrip(';'))
V = W['videos']
notes = [json.loads(l) for l in gzip.open(export, 'rt', encoding='utf-8')]

def norm(s):
    s = s.replace('&', ' and ').replace("'s", 's').replace('’s', 's')
    s = re.sub(r'\([^)]*\)', ' ', s)            # drop "(SIADH)"-style abbreviations for matching
    return re.sub(r'[^a-z0-9]+', ' ', s.lower()).strip()
squash = lambda s: s.replace(' ', '')
GENERIC = set('miscellaneous summary introduction basics management classification anatomy treatment features diagnosis '
              'investigations overview presentation complications types other side effects muscles proteins divisions '
              'infections anatomy of eyelids general features approach clinical presentation'.split())
VAGUE = {'early changes', 'late changes', 'regional injuries', 'normal parameters in newborn', 'divisions', 'fractures', 'stains', 'pigments'}
def generic(n):
    return n in GENERIC or n in VAGUE or all(w in GENERIC for w in n.split())

# ---------- concepts ----------
concepts = []            # {id, n (display name), k (match key), s (subject), h: [[vid, ch, at]]}
by_key = {}
for v in V:
    for ci, (at, title) in enumerate(v.get('chapters', [])):
        k = norm(title)
        if not k: continue
        if generic(k):
            # Tied to its lecture: "Glaucoma · Investigations".
            key = v['id'] + '|' + k
            name = f"{title} · {re.sub(r':.*', '', v['title'])}"
        else:
            key = k
            # Spelling variants of the same name merge (Pheochromocytoma / Phaeochromocytoma).
            for k2 in by_key:
                if '|' in k2 or abs(len(k2) - len(k)) > 2: continue
                a, b = squash(k), squash(k2)
                if a == b or (len(a) >= 8 and a[:3] == b[:3] and a[-3:] == b[-3:] and difflib.SequenceMatcher(None, a, b).ratio() >= 0.92):
                    key = k2; break
            name = title
        if key in by_key:
            c = by_key[key]
        else:
            c = {'id': f'c{len(concepts) + 1}', 'n': name, 'k': key.split('|')[-1], 's': v['subject'], 'h': [], 'g': '|' in key}
            concepts.append(c); by_key[key] = c
        c['h'].append([v['id'], ci, at])

# ---------- links ----------
links = collections.defaultdict(dict)
def link(a, b, kind, w):
    if a is b: return
    for x, y in ((a, b), (b, a)):
        cur = links[x['id']].get(y['id'])
        if not cur or cur[1] < w: links[x['id']][y['id']] = [kind, round(w, 3)]

# contains: whole-name containment between specific concepts
spec = [c for c in concepts if len(c['k']) >= 5]
for a in spec:
    pa = ' ' + a['k'] + ' '
    for b in spec:
        if a is b or len(b['k']) <= len(a['k']): continue
        if not a['g'] and not b['g'] and pa in ' ' + b['k'] + ' ': link(a, b, 'contains', 0.9)

# co: Anki notes that mention both names (whole words). Only names specific enough to match
# reliably: 5+ letters, not generic, and found in 3–1500 notes.
docs = [' ' + norm(re.sub(r'<[^>]+>', ' ', n['q'] + ' ' + n['a'])) + ' ' for n in notes]
index = collections.defaultdict(set)
for i, d in enumerate(docs):
    for w in set(d.split()): index[w].add(i)
STOPW = set('of the and in with for to a an on by vs at from or is are its their type types part'.split())
# Whole words, plural or not ("fracture"/"fractures"), in any order.
def stem(w):
    for suf in ('ies', 'es', 's'):
        if len(w) > 4 and w.endswith(suf): return w[:-len(suf)] + ('y' if suf == 'ies' else '')
    return w
sidx = collections.defaultdict(set)
for i, d in enumerate(docs):
    for w in set(d.split()):
        if len(w) >= 3: sidx[stem(w)].add(i)
# Notes the card sorting already placed on each chapter (tools/anki_map.py output), if given.
placed = collections.defaultdict(set)
if len(sys.argv) > 4:
    M = json.load(gzip.open(sys.argv[4], 'rt'))
    pos = {str(n['id']): i for i, n in enumerate(notes)}
    for nid, m in M.items():
        if len(m) > 3 and m[3] is not None and m[1] >= 75: placed[(m[0], m[3])].add(pos[nid])
def hits(c):
    ws = [w for w in c['k'].split() if w not in STOPW and len(w) >= 3]
    out = set()
    if ws and len(ws) <= 4 and not c['g']:
        rare = sorted({stem(w) for w in ws}, key=lambda w: len(sidx.get(w, ())))
        pool = set(sidx.get(rare[0], ()))
        for w in rare[1:]: pool &= sidx.get(w, set())
        out |= pool
    for vid, ci, _ in c['h']: out |= placed.get((vid, ci), set())
    return out
H = {}
for c in spec:
    h = hits(c)
    if 3 <= len(h) <= 1500: H[c['id']] = h
byid = {c['id']: c for c in concepts}
cnt = collections.Counter()
inv = collections.defaultdict(list)
for cid, h in H.items():
    for i in h: inv[i].append(cid)
for i, cids in inv.items():
    if len(cids) > 12: continue        # long summary cards mention everything
    for a in cids:
        for b in cids:
            if a < b: cnt[(a, b)] += 1
N = len(notes)
for (a, b), k in cnt.items():
    if k < 3: continue
    na, nb = len(H[a]), len(H[b])
    pmi = math.log(k * N / (na * nb))
    cos = k / math.sqrt(na * nb)
    if pmi > 1.5 and cos >= 0.08:
        link(byid[a], byid[b], 'co', min(0.85, cos))

# sim: concepts whose cards talk about the same things. Each concept's "context" is the words
# of the notes that mention it; concepts with similar contexts are related (Myasthenia gravis /
# Lambert-Eaton). TF-IDF over those contexts, cosine similarity.
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import normalize
ids = [cid for cid in H]
ctx = [' '.join(docs[i] for i in sorted(H[cid])[:300]) for cid in ids]
tf = TfidfVectorizer(min_df=2, max_df=0.08, sublinear_tf=True, stop_words='english', max_features=40000)
X = normalize(tf.fit_transform(ctx))
SIM = (X @ X.T).toarray()
for i, a in enumerate(ids):
    row = SIM[i]; row[i] = 0
    for j in row.argsort()[::-1][:6]:
        if row[j] < 0.3: break
        link(byid[a], byid[ids[j]], 'sim', min(0.8, float(row[j])))

# Keep the strongest links per concept.
rel = {}
for cid, d in links.items():
    best = sorted(d.items(), key=lambda kv: -kv[1][1])[:10]
    rel[cid] = [[o, {'contains': 'x', 'co': 'c', 'sim': 's'}[kind], w] for o, (kind, w) in best]

data = {'concepts': [{k: v for k, v in c.items() if k not in ('k', 'g')} | ({'g': 1} if c['g'] else {}) | ({'m': len(H.get(c['id'], ()))} if H.get(c['id']) else {}) for c in concepts], 'rel': rel}
with open(out, 'w', encoding='utf-8') as f:
    f.write('// Generated by tools/build_concepts.py: WOR chapters as concepts, and links between them.\n')
    f.write('window.CONCEPTS = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
multi = sum(1 for c in concepts if len(c['h']) > 1)
kinds = collections.Counter(x[1] for r in rel.values() for x in r)
print(f'{len(concepts)} concepts ({multi} taught in more than one lecture); with links: {len(rel)}; link ends by kind: {dict(kinds)}')
