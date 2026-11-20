"""Build the private PYT pack the app imports (Settings → PYT pack).

    python3 tools/build_pyt_pack.py tables_mapped.json recall_mapped.json out/pg27-pyt-pack.json

The pack holds the PYT tables (topic, importance, times repeated, source, section) and the
year-wise questions (topic, question, likely follow-ups), each with the lecture it's linked to
(`vid`, `ch`) when the evidence was clear, or a suggestion (`guess`) to confirm in the app.
It's built from your own book, so keep it out of the public repo: share it privately.
"""
import json, sys, datetime
tables_path, recall_path, out = sys.argv[1:4]
IMP = {'Most': 'M', 'Moderate': 'm', 'Least': 'L'}
tables = []
for r in json.load(open(tables_path)):
    tables.append({k: v for k, v in dict(k=r['k'], s=r['subject'], sec=r.get('section') or None, t=r['topic_clean'], imp=IMP.get(r['imp'], ''),
                                       times=r.get('times'), src=r.get('src') or None, vid=r.get('vid'), ch=r.get('ch'), chk=1 if r.get('reviewed') else None,
                                       guess=r.get('guess') if not r.get('vid') else None).items() if v not in (None, '')})
recall = []
for r in json.load(open(recall_path)):
    recall.append({k: v for k, v in dict(k=r['k'], s=r['subject'], y=r.get('y'), t=(r.get('t_raw') and r['topic_clean']) or '', q=r['q'], x=r.get('x') or None,
                                       vid=r.get('vid'), ch=r.get('ch'), guess=r.get('guess') if not r.get('vid') else None).items() if v not in (None, '')})
pack = dict(kind='pg27-pyt', v=1, made=datetime.date.today().isoformat(), source='ALL NEET PG PYTs (personal copy)', tables=tables, recall=recall)
json.dump(pack, open(out, 'w'), ensure_ascii=False, separators=(',', ':'))
print(f'{len(tables)} topics, {len(recall)} questions → {out}')
