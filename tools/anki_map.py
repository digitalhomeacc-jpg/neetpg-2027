"""Map every Anki note to a subject and a Marrow WOR video.

    python tools/anki_map.py pg27_anki_export.jsonl.gz js/data-wor.js OUTDIR

Writes to OUTDIR:
  mapping.json.gz   note id -> [video id, confidence 0-100, kind]   (kind: s = study card, q = question card)
  data-anki.js      per-video card counts and PYQ years, for the app
  report.txt        how every note was placed

How a note is placed:
  1. Subject: the deck name first (your NEETPG "<subject> master deck"s), then tags, then a text
     classifier trained on the notes whose subject is already certain.
  2. Video: within that subject, a classifier trained on "seed" notes (ones carrying a tag that
     belongs to just one or two videos) using the card text, tags and deck path, combined with how
     closely the text matches each video's topics.
Every note gets a video; the confidence says how sure.
"""
import gzip, json, re, sys, collections
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import normalize

export, worjs, out = sys.argv[1:4]
notes = [json.loads(l) for l in gzip.open(export, 'rt', encoding='utf-8')]
wor = json.loads(open(worjs, encoding='utf-8').read().split('=', 1)[1].strip().rstrip(';'))
VIDS = wor['videos']
SUBJECTS = wor['subjects']

# ---------- subject keywords (checked against deck names and every tag segment) ----------
SUBJ_KEYS = [
    ('Anatomy', r'anatom|embryo|histolog|neuroanat|osteolog|\bgross\b|upper.?limb|lower.?limb|thorax|abdomen_and|pelvis|head.?(and|&)?.?neck|brachial'),
    ('Biochemistry', r'bioche|biochem|metabolism|vitamin|enzym|molecular.?bio|genetics_bio|pixorize.?bioch'),
    ('Physiology', r'physio(?!therap)'),
    ('Pharmacology', r'pharma|drug(?!.?of.?choice)'),
    ('Microbiology', r'micro(?!scop)|immunolog|bacteri|virolog|mycolog|parasit|\bbugs\b|antimicrob'),
    ('Pathology', r'patho(?!gen)|hemat|haemat|oncolog|neoplas|pathoma'),
    ('Community Medicine', r'psm|community|preventive|social.?med|biostat|epidemiol|cm_'),
    ('Forensic Medicine', r'forensic|fmt|toxicolog|jurisprud'),
    ('Ophthalmology', r'ophth|optha|\beye\b|ophtha'),
    ('ENT', r'\bent\b|otorhin|otolaryng|\bear\b|\bnose\b|larynx|pharynx'),
    ('Anaesthesia', r'an(a)?esth'),
    ('Dermatology', r'derm|skin|leprosy|\bstd\b'),
    ('Psychiatry', r'psych'),
    ('Radiology', r'radio(?!logy.?inv)|imaging'),
    ('Medicine', r'medicine|cardio|gastro|neurolog|nephro|pulmo|respir|endocrin|rheum|infectious|emergency|hepatol|internal'),
    ('Surgery', r'surg|urolog|trauma(?!tology)|breast|vascular_surg'),
    ('Orthopaedics', r'ortho(?!dont)|fracture|bone.?tumou?r'),
    ('Paediatrics', r'pa?ediatr|peds|neonat|\bpeds\b'),
    ('Obstetrics & Gynaecology', r'obg|obgy|obstet|gyna?ec|obgyn|reproductive.?sci'),
]
SUBJ_RE = [(s, re.compile(p, re.I)) for s, p in SUBJ_KEYS]
GENERIC = re.compile(r'^(1_legend|\$i_anki|i_anki|ankihub.*|#ak_.*|!ak_.*|ak_.*|dope|lightyear|bab|medschool|mangomedic|pyqs?|lastminuterevisiontopics|'
                     r'phase|\d+|my_.*|zz_.*|marrow|neetpg|neet|inicet|aiims.*|default|master|deck|.*_master|e_gurukul.*|#pathoma|#pance|zanki|.*fmd.*|leftover)$', re.I)

def deck_subject(deck):
    p = deck.split('::')
    if p[0] == 'NEETPG' and len(p) > 1:
        head = p[1].lower()
        if 'integrated' in head:
            sub = (p[2] if len(p) > 2 else '').lower()
            for k, s in [('immunolog', 'Microbiology'), ('hematolog', 'Pathology'), ('neuropath', 'Pathology'), ('respiratory path', 'Pathology'),
                         ('renal', 'Pathology'), ('msk', 'Pathology'), ('reproductive physiology', 'Physiology'), ('cardiovascular', 'Pathology'),
                         ('gi(fmd)', 'Pathology'), ('endocrine', 'Pathology')]:
                if k in sub: return s, 'deck-integrated'
            return None, None
        for s, rx in SUBJ_RE:
            if rx.search(head): return s, 'deck'
        return None, None
    if p[0].startswith('_FROZEN'):
        rest = '::'.join(p[1:]).lower()
        if rest.startswith(('pyqs', 'neet pg')): return None, None
        for s, rx in SUBJ_RE:
            if rx.search(rest): return s, 'deck-frozen'
    if p[0] == 'AnKing':
        rest = '::'.join(p[1:]).lower()
        for s, rx in SUBJ_RE:
            if rx.search(rest): return s, 'deck-anking'
    return None, None

def tag_votes(tags):
    v = collections.Counter()
    for t in tags:
        segs = [x for x in re.split(r'::', t) if x]
        for i, seg in enumerate(segs):
            for s, rx in SUBJ_RE:
                if rx.search(seg.replace('_', ' ')):
                    v[s] += 1 + 0.3 * i  # deeper = more specific
                    break
    return v

def words(s):
    s = re.sub(r'([a-z])([A-Z])', r'\1 \2', s)
    return re.sub(r'[^A-Za-z0-9]+', ' ', s).lower()

def tag_text(n):
    bits = []
    for t in n['tags']:
        for seg in t.split('::'):
            if not GENERIC.match(seg): bits.append(words(seg))
    for d in n['decks']:
        # Skip the deck's subject-level name ("forensic medicine and toxicology master deck"):
        # its words say nothing about the topic and would match keywords on every card in it.
        parts = d.split('::')
        skip = 2 if parts[0] in ('NEETPG', 'AnKing') or parts[0].startswith('_FROZEN') else 1
        for seg in parts[skip:]:
            if not GENERIC.match(seg) and not seg.startswith(('!', '@')) and 'master' not in seg.lower(): bits.append(words(seg))
    return ' '.join(bits)

def text_of(n): return words(n['q'] + ' ' + n['a']).replace(' img ', ' ')

kind = {}
for n in notes:
    frozen = all(d.startswith('_FROZEN') for d in n['decks'])
    kind[n['id']] = 'q' if frozen else 's'

# ---------- 1. subject ----------
subj, how = {}, {}
for n in notes:
    ds = [deck_subject(d) for d in n['decks']]
    ds = [x for x in ds if x[0]]
    tv = tag_votes(n['tags'])
    if ds:
        s, src = ds[0]
        # A deck from your own master decks wins, unless every tag clearly says otherwise.
        if tv and tv.most_common(1)[0][0] != s and tv.most_common(1)[0][1] >= 3 * (tv.get(s, 0) + 1) and src != 'deck':
            s, src = tv.most_common(1)[0][0], 'tags-over-deck'
        subj[n['id']], how[n['id']] = s, src
    elif tv:
        top = tv.most_common(2)
        if len(top) == 1 or top[0][1] >= 1.5 * top[1][1]:
            subj[n['id']], how[n['id']] = top[0][0], 'tags'

# Text classifier for the rest, trained on the notes already placed.
docs = {n['id']: text_of(n) + ' ' + tag_text(n) for n in notes}
known = [n['id'] for n in notes if n['id'] in subj]
unknown = [n['id'] for n in notes if n['id'] not in subj]
vec = TfidfVectorizer(ngram_range=(1, 2), min_df=3, max_features=80000, sublinear_tf=True, dtype=np.float32)
Xk = vec.fit_transform([docs[i] for i in known])
clf = LogisticRegression(max_iter=300, C=4)
clf.fit(Xk, [subj[i] for i in known])
if unknown:
    P = clf.predict_proba(vec.transform([docs[i] for i in unknown]))
    for i, row in zip(unknown, P):
        subj[i], how[i] = clf.classes_[row.argmax()], f'text:{int(row.max() * 100)}'

# ---------- 2. video within subject ----------
draft = collections.defaultdict(set)  # tag (lower) -> videos it was drafted for
for v in VIDS:
    for t in v['tags']: draft[t.lower()].add(v['id'])

def seed_for(n, cands):
    w = collections.Counter()
    for t in n['tags']:
        parts = t.lower().split('::')
        for k in range(1, len(parts) + 1):  # the tag itself and every parent of it
            vs = draft.get('::'.join(parts[:k]))
            if not vs: continue
            vs = vs & cands
            if vs and len(vs) <= 2:
                for vid in vs: w[vid] += (1 / len(vs)) * k
    if not w: return None
    (best, a), *rest = w.most_common(2) + [(None, 0)]
    return best if a >= 2 * (rest[0][1] if rest else 0) else None

# Every note is scored against all 271 videos at once, so a breast card sitting in the
# medicine deck can still land on Surgery's Breast video. Its subject from step 1 is a
# strong hint, not a rule.
from scipy.sparse import vstack
vid_ids = [v['id'] for v in VIDS]
vid_subj = np.array([v['subject'] for v in VIDS])
vdoc = [words(v['title'] + ' ' + v['title'] + ' ' + v['notes'] + ' ' + ' '.join(c[1] for c in v.get('chapters', [])) * 2) + ' ' + tag_text({'tags': v['tags'], 'decks': []}) for v in VIDS]
ndoc = [text_of(n) + ' ' + ' '.join([tag_text(n)] * 3) for n in notes]  # tags count three times
tf = TfidfVectorizer(ngram_range=(1, 2), min_df=3, max_features=80000, sublinear_tf=True, stop_words='english', dtype=np.float32)
tf.fit(ndoc + vdoc * 5)
N, V = tf.transform(ndoc), tf.transform(vdoc)
sim = (normalize(N) @ normalize(V).T).toarray().astype(np.float32)
# Tags alone against video titles + topics: a tag naming the topic is a strong signal.
tt = TfidfVectorizer(ngram_range=(1, 2), min_df=2, max_features=60000, sublinear_tf=True, stop_words='english', dtype=np.float32).fit(vdoc + [tag_text(n) for n in notes])
tsim = (normalize(tt.transform([tag_text(n) for n in notes])) @ normalize(tt.transform(vdoc)).T).toarray().astype(np.float32)

# Priors: the note's subject, and video length (longer videos carry more cards; intros few).
S_IDX = {s: np.where(vid_subj == s)[0] for s in set(vid_subj)}
mins_ = np.array([v['mins'] for v in VIDS], float)
rt_prior = (mins_ / mins_.mean()) ** 0.08  # only a tie-breaker
rt_prior[[i for i, v in enumerate(VIDS) if v['title'].lower().startswith('introduction')]] *= 0.55
strength = {'deck': 1.0, 'deck-integrated': 0.8, 'deck-frozen': 0.9, 'deck-anking': 0.7, 'tags': 0.7, 'tags-over-deck': 0.7, 'text': 0.5}
def subj_prior(i, n):
    pr = np.full(len(VIDS), 1.0)
    st = strength.get(how[n['id']].split(':')[0], 0.5)
    pr[:] = 1 - st * 0.85          # other subjects
    pr[S_IDX[subj[n['id']]]] = 1.0  # this note's subject
    return pr

all_ids = set(vid_ids)
seeds = {}
for i, n in enumerate(notes):
    sd = seed_for(n, all_ids)
    if sd and vid_subj[vid_ids.index(sd)] == subj[n['id']]: seeds[i] = vid_ids.index(sd); continue
    r = np.sort(tsim[i])[::-1]
    j = int(tsim[i].argmax())
    if r[0] > 0.30 and r[0] >= 1.8 * r[1] and vid_subj[j] == subj[n['id']]: seeds[i] = j; continue
    r = np.sort(sim[i])[::-1]
    j = int(sim[i].argmax())
    if r[0] > 0.15 and r[0] >= 2 * r[1] and vid_subj[j] == subj[n['id']]: seeds[i] = j
print('seeds', len(seeds), 'videos with seeds', len(set(seeds.values())))

PRS = np.vstack([subj_prior(i, n) for i, n in enumerate(notes)]).astype(np.float32)  # subject prior only
PRI = (PRS * rt_prior).astype(np.float32)
def norm_rows(M): return M / (M.max(axis=1, keepdims=True) + 1e-9)

# Keyword evidence from tools/wor_keywords.py: specific terms for each video.
sys.path.insert(0, __import__('os').path.dirname(__file__))
from wor_keywords import KW
# Marrow's chapter names are keywords too: the specific ones (not "Miscellaneous", "Summary"…),
# split on "vs", "&", "/" and commas so "Bartter Syndrome" and "Gitelman Syndrome" count apart.
GENERIC_CH = re.compile(r'^(miscellaneous|summary|introduction|basics|management|classification|anatomy|treatment|features|diagnosis|'
                        r'investigations|overview|presentation|complications|recent updates|recent advances|types|side effects|histology|'
                        r'fractures|instruments|clinical presentation|approach|other|others|definitions?|terminologies)( of .*)?$')
KW = {k: list(v) for k, v in KW.items()}
for v in VIDS:
    for _, ch in v.get('chapters', []):
        for part in re.split(r'\s+vs\.?\s+|\s*[&/,]\s*|\s+and\s+|:\s*', re.sub(r'\([^)]*\)', '', ch), flags=re.I):
            t = words(part).strip()
            if len(t) >= 6 and not GENERIC_CH.match(t) and len(t.split()) <= 5:
                KW.setdefault(v['id'], []).append(t)
term_vids = collections.defaultdict(set)
for vid, terms in KW.items():
    for t in terms:
        k = words(t).strip()
        if k: term_vids[k].add(vid)
vix = {v: i for i, v in enumerate(vid_ids)}
pattern = re.compile(r'\b(' + '|'.join(sorted((re.escape(t) for t in term_vids), key=len, reverse=True)) + r')\b')
KWS = np.zeros((len(notes), len(VIDS)), np.float32)
for i, n in enumerate(notes):
    for txt, w in ((' ' + text_of(n) + ' ', 1.0), (' ' + tag_text(n) + ' ', 1.6)):
        for m_ in set(pattern.findall(txt)):
            vs = term_vids[m_]
            weight = w * (1 + 0.4 * (m_.count(' ') > 0)) / len(vs)
            for vid in vs: KWS[i, vix[vid]] += weight
# Video descriptions gain their keyword lists too, so the text models learn them.
vdoc_kw = [d + ' ' + ' '.join(words(t) for t in KW.get(v['id'], [])) for d, v in zip(vdoc, VIDS)]
Vk = tf.transform(vdoc_kw)
simk = (normalize(N) @ normalize(Vk).T).toarray().astype(np.float32)

for i, n in enumerate(notes):
    if i in seeds: continue
    r = np.sort(KWS[i] * PRS[i])[::-1]
    j = int((KWS[i] * PRS[i]).argmax())
    if r[0] >= 1.0 and r[0] >= 1.8 * r[1] and vid_subj[j] == subj[n['id']]: seeds[i] = j
print('seeds with keywords', len(seeds), 'videos with seeds', len(set(seeds.values())))

X = vstack([N[list(seeds)], Vk, Vk, Vk])
y = [seeds[i] for i in seeds] + list(range(len(VIDS))) * 3
model = LogisticRegression(max_iter=600, C=6).fit(X, y)
P = np.zeros((len(notes), len(VIDS)), np.float32)
for a_ in range(0, len(notes), 8000): P[a_:a_ + 8000][:, model.classes_] = model.predict_proba(N[a_:a_ + 8000])
# A card filed under the wrong subject's deck (a breast card in the medicine deck) can cross
# over when its keywords point clearly at another subject's video.
for i, n in enumerate(notes):
    own = S_IDX[subj[n['id']]]
    best_own = KWS[i, own].max() if len(own) else 0
    j = int(KWS[i].argmax())
    if vid_subj[j] != subj[n['id']] and KWS[i, j] >= 1.5 and KWS[i, j] >= 2.5 * max(best_own, 0.2):
        PRS[i, S_IDX[vid_subj[j]]] = np.maximum(PRS[i, S_IDX[vid_subj[j]]], 0.95)
PRI = (PRS * rt_prior).astype(np.float32)
kwn = KWS / (KWS.max(axis=1, keepdims=True) + 1e-9)
# Keywords use the subject prior only; video length and the intro penalty only shape the text models.
score = 0.55 * kwn * PRS + (0.25 * norm_rows(P) + 0.20 * norm_rows(np.maximum(simk, tsim))) * PRI
# Clear keyword evidence decides on its own.
KP = KWS * PRS
srt_k = np.sort(KP, axis=1)
decisive = (srt_k[:, -1] >= 0.9) & (srt_k[:, -1] >= 2 * srt_k[:, -2])  # one specific term is enough
score[decisive] = score[decisive] + 2 * (KP[decisive] == srt_k[decisive, -1:])
assign = {}
srt = np.sort(score, axis=1)
for i, n in enumerate(notes):
    j = int(score[i].argmax())
    margin = (srt[i, -1] - srt[i, -2]) / (srt[i, -1] + 1e-9)
    c = 95 if seeds.get(i) == j else int(min(90, 20 + 150 * margin))
    assign[n['id']] = (vid_ids[j], c)
    subj[n['id']] = vid_subj[j]  # the chosen video decides the final subject

# ---------- 3. PYQ years ----------
def pyq_of(n):
    hits = []
    for t in n['tags']:
        m = re.match(r'pyqs?::(neet|inicet|aiims)[^:]*(?:::(\d{4}|[a-z]{3}\d{2}))?', t, re.I)
        if m: hits.append((m.group(1).upper(), m.group(2) or ''))
        if re.search(r'aiims_previous_year', t, re.I): hits.append(('AIIMS', ''))
    for d in n['decks']:
        if 'AIIMS_previous_year' in d: hits.append(('AIIMS', ''))
        elif '::PYQs' in d and not hits: hits.append(('PYQ', ''))
    return hits

# ---------- outputs ----------
import os
os.makedirs(out, exist_ok=True)
mapping = {str(n['id']): [assign[n['id']][0], assign[n['id']][1], kind[n['id']]] for n in notes}
with gzip.open(f'{out}/mapping.json.gz', 'wt', encoding='utf-8') as f: json.dump(mapping, f, separators=(',', ':'))

per = {v['id']: {'n': 0, 'c': 0, 'su': 0, 'mat': 0, 'q': 0, 'qc': 0, 'lo': 0, 'pyq': collections.Counter(), 'tags': collections.Counter()} for v in VIDS}
for n in notes:
    vid, c = assign[n['id']]
    p = per[vid]
    if kind[n['id']] == 's':
        p['n'] += 1; p['c'] += n['cards']; p['su'] += n['susp']; p['mat'] += n['mature']
        if c < 45: p['lo'] += 1
    else:
        p['q'] += 1; p['qc'] += n['cards']
    for ex, yr in pyq_of(n): p['pyq'][f'{ex}{":" + yr if yr else ""}'] += 1
    if kind[n['id']] == 's':
        for t in n['tags']:
            if re.match(r'(pyqs?|aiims_previous_year|\$i_anki::aiims)', t, re.I) or t.upper().startswith('PG27::'): continue
            segs = [x for x in t.split('::') if not GENERIC.match(x)]
            if segs: p['tags'][' › '.join(segs[-2:]).replace('_', ' ')] += n['cards']
# Your own tags per video: the ones with the most cards there (tag names and counts only, no card text).
for p in per.values():
    p['top'] = [[t, c] for t, c in p['tags'].most_common(6) if c >= 2]
    del p['tags']
data = {vid: {k: (dict(v) if k == 'pyq' else v) for k, v in p.items() if v} for vid, p in per.items()}
with open(f'{out}/data-anki.js', 'w', encoding='utf-8') as f:
    f.write('// Generated by tools/anki_map.py from the Anki export. Re-run it after a new export.\n')
    f.write('window.ANKI = ' + json.dumps({'made': __import__('datetime').date.today().isoformat(), 'notes': len(notes), 'videos': data}, separators=(',', ':')) + ';\n')

hc = collections.Counter(how[n['id']].split(':')[0] for n in notes)
cc = collections.Counter('high (75+)' if assign[n['id']][1] >= 75 else 'medium (45-74)' if assign[n['id']][1] >= 45 else 'low (<45)' for n in notes)
with open(f'{out}/report.txt', 'w', encoding='utf-8') as f:
    f.write(f'notes {len(notes)}  study {sum(1 for n in notes if kind[n["id"]] == "s")}  question {sum(1 for n in notes if kind[n["id"]] == "q")}\n')
    f.write(f'subject decided by: {dict(hc)}\n')
    f.write(f'video confidence: {dict(cc)}\n')
    f.write('per subject: ' + json.dumps(collections.Counter(subj.values()), indent=0) + '\n')
print(open(f'{out}/report.txt').read())

# Debug: PG27_DEBUG="cross-examination" prints how matching notes were scored.
dbg = __import__('os').environ.get('PG27_DEBUG')
if dbg:
    for i, n in enumerate(notes):
        if dbg.lower() in (n['q'] + n['a']).lower():
            top = np.argsort(-score[i])[:4]
            print('NOTE', n['q'][:80], '| subj', subj[n['id']], how[n['id']], '| decks', n['decks'])
            print('  kw terms', sorted(set(pattern.findall(' ' + text_of(n) + ' ')) | set(pattern.findall(' ' + tag_text(n) + ' '))))
            for j in top: print(f'  {vid_ids[j]:15} score {score[i, j]:.2f} kw {KWS[i, j]:.2f} pri {PRI[i, j]:.2f} P {P[i, j]:.2f} sim {simk[i, j]:.2f}')
