import openpyxl, json, re, sys, datetime
src, out = sys.argv[1], sys.argv[2]
wb = openpyxl.load_workbook(src)
ws = wb['Main Tracker']
mp = {}
for r in wb['Comprehensive Tag Mapping'].iter_rows(min_row=7, values_only=True):
    if r[1]:
        tags = [t.strip().replace('Tag: ', '') for t in str(r[4] or '').split('\n') if t.strip()]
        mp[(r[1], r[2])] = dict(tags=tags, notes=r[7] or '')
excluded = []
for r in wb['Comprehensive Tag Mapping'].iter_rows(min_row=7, values_only=True):
    if r[9]:
        excluded.append(dict(tag=str(r[9]).replace('Tag: ', '').strip(), source=r[10] or '', reason=r[11] or ''))
videos, pending, block = [], [], 1
def slug(s): return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
SUBJ = {}
for r in ws.iter_rows(min_row=6, max_row=367, values_only=True):
    s, t, d = r[1], r[2], r[3]
    if not s: continue
    if 'Total' in str(s):
        m = re.search(r'Block (\d+)', s); b = int(m.group(1))
        for v in pending: v['block'] = b
        pending = []; block = b + 1; continue
    code = SUBJ.setdefault(s, len(SUBJ))
    n = sum(1 for v in videos if v['subject'] == s) + 1
    m = mp.get((s, t), dict(tags=[], notes=''))
    passes = [bool(x) for x in r[4:9]]
    ov = r[10]
    v = dict(id=f"wor-{slug(s)[:6]}-{n:02d}", subject=s, title=t, mins=float(d or 0), block=None,
             tags=m['tags'], notes=m['notes'], passes=passes,
             date=(ov.date().isoformat() if isinstance(ov, datetime.datetime) else None))
    videos.append(v); pending.append(v)
for v in pending: v['block'] = block
json.dump(dict(subjects=list(SUBJ), videos=videos, excluded=excluded), open(out, 'w'), indent=1, ensure_ascii=False)
print(len(videos), 'videos', max(v['block'] for v in videos), 'blocks', sum(v['mins'] for v in videos)/60, 'h',
      sum(1 for v in videos if any(v['passes'])), 'done', len(excluded), 'excluded')
