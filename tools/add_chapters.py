"""Add Marrow's chapter list to every video in js/data-wor.js.

    python3 tools/add_chapters.py data/chapters_*.txt

Each file has "## <title>" or "## <video id> <title>" headers, then one "<start time> <chapter>"
line per chapter (start time like 12:30 or 1:02:05, or ? if it couldn't be read).
"""
import difflib, json, re, sys

path = 'js/data-wor.js'
src = open(path, encoding='utf-8').read()
head, body = src.split('window.WOR = ', 1)
d = json.loads(body.strip().rstrip(';'))
by_id = {v['id']: v for v in d['videos']}
norm = lambda s: re.sub(r'[^a-z0-9]', '', s.lower())
by_title = {norm(v['title']): v['id'] for v in d['videos']}

found = {}
for f in sys.argv[1:]:
    cur = None
    for line in open(f, encoding='utf-8'):
        line = line.rstrip('\n')
        if not line.strip() or line.startswith('# '):
            continue
        if line.startswith('## '):
            h = line[3:].strip()
            first = h.split(' ', 1)[0]
            if first in by_id:
                cur = first
            else:
                m = difflib.get_close_matches(norm(h), by_title, n=1, cutoff=0.75)
                if not m:
                    sys.exit(f'{f}: no video matches "{h}"')
                cur = by_title[m[0]]
            if cur in found:
                sys.exit(f'{f}: {cur} listed twice')
            found[cur] = []
            continue
        at, title = line.split(' ', 1)
        found[cur].append([at, title.strip()])

for v in d['videos']:
    if v['id'] in found:
        v['chapters'] = found[v['id']]
    else:
        v.pop('chapters', None)

with open(path, 'w', encoding='utf-8') as out:
    out.write(head + 'window.WOR = ' + json.dumps(d, ensure_ascii=False, separators=(',', ':')) + ';\n')
missing = [v['id'] for v in d['videos'] if v['id'] not in found]
print(f'{len(found)} videos have chapters; without: {", ".join(missing) or "none"}')
