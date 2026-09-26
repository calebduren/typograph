"""Generate hand kerning for Typograph's serif headings.

Finds every `<Kern>` string in apps/playground/src, shapes it with HarfBuzz (Hedvig Letters
Serif at opsz 24, font kerning and ligatures on, zero tracking), and measures the clear space
between each pair of adjacent letter outlines. Display type set at text spacing reads loose, so
each pair is pulled toward a common clearance in proportion to how far it sits from it: loose
pairs such as `Yo` or `he` tighten most, and no pair ends closer than 0.02em. Ligatures are
never split. Writes apps/playground/src/kerning.ts.

    python3 -m venv .venv && .venv/bin/pip install fonttools brotli uharfbuzz shapely
    .venv/bin/python scripts/measure-hedvig-kerning.py
"""
import uharfbuzz as hb, sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.recordingPen import DecomposingRecordingPen
from shapely.geometry import Polygon, MultiPolygon
from shapely.ops import unary_union
import io
path=str(__import__('pathlib').Path(__file__).resolve().parents[1] / 'apps/playground/public/fonts/HedvigLettersSerif.woff2')
f=TTFont(path); f.flavor=None
inst=instantiateVariableFont(f,{'opsz':24})
buf=io.BytesIO(); inst.save(buf); data=buf.getvalue()
upm=inst['head'].unitsPerEm
face=hb.Face(data); font=hb.Font(face)
gs=inst.getGlyphSet(); order=inst.getGlyphOrder()
cache={}
def flatten(cmds, steps=12):
    polys=[]; cur=[]; pt=None
    for op,args in cmds:
        if op=='moveTo': cur=[args[0]]; pt=args[0]
        elif op=='lineTo': cur.append(args[0]); pt=args[0]
        elif op=='qCurveTo':
            pts=list(args)
            # implied on-curve points
            p0=pt
            offs=pts[:-1]; end=pts[-1]
            seq=[]
            for i,o in enumerate(offs):
                nxt = end if i==len(offs)-1 else ((o[0]+offs[i+1][0])/2,(o[1]+offs[i+1][1])/2)
                seq.append((o,nxt))
            for o,n in seq:
                for t in range(1,steps+1):
                    t/=steps
                    x=(1-t)**2*p0[0]+2*(1-t)*t*o[0]+t*t*n[0]; y=(1-t)**2*p0[1]+2*(1-t)*t*o[1]+t*t*n[1]
                    cur.append((x,y))
                p0=n
            pt=end
        elif op=='curveTo':
            c1,c2,e=args; p0=pt
            for t in range(1,steps+1):
                t/=steps
                x=(1-t)**3*p0[0]+3*(1-t)**2*t*c1[0]+3*(1-t)*t*t*c2[0]+t**3*e[0]
                y=(1-t)**3*p0[1]+3*(1-t)**2*t*c1[1]+3*(1-t)*t*t*c2[1]+t**3*e[1]
                cur.append((x,y))
            pt=e
        elif op in('closePath','endPath'):
            if len(cur)>2: polys.append(Polygon(cur).buffer(0))
            cur=[]
    return polys
def shape(g):
    if g in cache: return cache[g]
    pen=DecomposingRecordingPen(gs); gs[order[g]].draw(pen)
    polys=flatten(pen.value)
    # even-odd: outer minus holes approximated by symmetric difference union
    geom=None
    for p in polys:
        geom = p if geom is None else geom.symmetric_difference(p)
    cache[g]=geom
    return geom
from shapely import affinity
import html, pathlib, re, json
root = pathlib.Path(__file__).resolve().parents[1]
src = root / 'apps/playground/src'
texts = sorted({html.unescape(m) for f in src.glob('*.tsx') for m in re.findall(r'<Kern>([^<{}]+)</Kern>', f.read_text())})

def shaped(text, **features):
    b = hb.Buffer(); b.add_str(text); b.guess_segment_properties()
    hb.shape(font, b, {'kern': True, 'liga': True, 'calt': True, **features})
    return b

def advance(text):
    return sum(p.x_advance for p in shaped(text, liga=False).glyph_positions)

kern = lambda pair: round((advance(pair) - advance(pair[0]) - advance(pair[1])) / upm, 3)
# Two letters that shape to one glyph are a ligature; splitting them into spans would break it.
ligatures = sorted({t[i:i+2] for t in texts for i in range(len(t) - 1)
                    if t[i:i+2].isalpha() and len(shaped(t[i:i+2]).glyph_infos) == 1})

# Clearance between adjacent letter outlines, measured in context (the tightest occurrence).
res = {}
for text in texts:
    b = shaped(text, liga=False)
    x = 0; placed = []
    for info, pos in zip(b.glyph_infos, b.glyph_positions):
        geom = shape(info.codepoint)
        if geom is not None and not geom.is_empty:
            placed.append((info.cluster, affinity.translate(geom, x + pos.x_offset, pos.y_offset)))
        x += pos.x_advance
    for (c1, a), (c2, bb) in zip(placed, placed[1:]):
        if c2 != c1 + 1: continue  # across a space
        key = text[c1] + text[c2]
        d = a.distance(bb) / upm
        if key not in res or d < res[key]: res[key] = d

# Pull each pair toward the common clearance by a share of its distance from it, never below
# the floor and never more than the cap.
common, share, floor, cap = 0.05, 0.3, 0.02, 0.035
def adjustment(d):
    return max(max(-share * (d - common), -cap), floor - d)

protected = {c for pair in ligatures for c in pair}
def splittable(text, i):
    # A letter inside a ligature stays in its run.
    return not (text[i-1:i+1] in ligatures or text[i:i+2] in ligatures)

# A span with letter-spacing starts a new shaping run, so the browser drops the font's kern on
# both sides of it. Each value therefore restores the font's kern for the pair it starts, and
# pairs that end at a span get their kern restored the same way, until none is dropped.
table = {}
for k, d in res.items():
    if k in ligatures: continue
    adj = adjustment(d)
    if abs(adj) >= 0.002: table[k] = round(kern(k) + adj, 3)
changed = True
while changed:
    changed = False
    for text in texts:
        for i in range(1, len(text) - 1):
            before = text[i-1:i+1]
            if (text[i:i+2] in table and splittable(text, i) and before not in table
                    and before not in ligatures and kern(before)):
                table[before] = kern(before); changed = True

print(f'{len(texts)} headings, {len(res)} letter pairs, {len(table)} kerned, ligatures: {" ".join(ligatures)}')
for k in ['Yo', 'ou', 'it', 'po', 'ol', 'he']:
    if k in res: print(f'  {k}: clearance {res[k]:.3f}em -> {res[k] + adjustment(res[k]):.3f}em')

lines = ['// Generated by scripts/measure-hedvig-kerning.py. Do not edit by hand.', '',
         '/** Letter-spacing, in em, after the first glyph of each pair (see Kern.tsx). */',
         'export const kerning: Record<string, number> = {']
for k, v in sorted(table.items()):
    lines.append(f'  {json.dumps(k, ensure_ascii=False)}: {v},')
lines += ['};', '', '/** Pairs Hedvig sets as one ligature glyph; never split them. */',
          f'export const ligatures = new Set({json.dumps(ligatures)});', '']
(src / 'kerning.ts').write_text('\n'.join(lines))
