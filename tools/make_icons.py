import sys
from PIL import Image, ImageDraw
out = sys.argv[1]
def icon(size, path):
    S = size * 4
    im = Image.new('RGB', (S, S), '#0d1117')
    d = ImageDraw.Draw(im)
    c, r, w = S / 2, S * 0.33, int(S * 0.075)
    d.arc([c - r, c - r, c + r, c + r], 0, 360, fill='#26303b', width=w)
    d.arc([c - r, c - r, c + r, c + r], -90, 200, fill='#3fc08b', width=w)
    # check mark in the middle
    pts = [(c - S*0.13, c + S*0.0), (c - S*0.035, c + S*0.095), (c + S*0.14, c - S*0.1)]
    d.line(pts, fill='#e8edf3', width=int(S*0.06), joint='curve')
    for p in (pts[0], pts[2]):
        rr = S*0.03; d.ellipse([p[0]-rr, p[1]-rr, p[0]+rr, p[1]+rr], fill='#e8edf3')
    im.resize((size, size), Image.LANCZOS).save(path)
icon(192, f'{out}/icon-192.png'); icon(512, f'{out}/icon-512.png'); icon(180, f'{out}/apple-touch-icon.png')
