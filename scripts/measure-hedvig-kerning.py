"""Measure the clear space between adjacent glyphs in Typograph's serif headings.

Shapes each heading with HarfBuzz (Hedvig Letters Serif at opsz 24, font kerning and ligatures
on, zero tracking), then reports every pair whose outlines come within 0.03em. Pairs under
0.02em get the printed hand-kerning value in apps/playground/src/Kern.tsx.

    python3 -m venv .venv && .venv/bin/pip install fonttools brotli uharfbuzz shapely
    .venv/bin/python scripts/measure-hedvig-kerning.py "Your AI writes," "typograph polishes"
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
texts=sys.argv[1:]
res={}
for text in texts:
    b=hb.Buffer(); b.add_str(text); b.guess_segment_properties()
    hb.shape(font,b,{'kern':True,'liga':True,'calt':True})
    x=0; placed=[]
    for info,pos in zip(b.glyph_infos,b.glyph_positions):
        geom=shape(info.codepoint)
        if geom is not None and not geom.is_empty:
            placed.append((info.cluster, affinity.translate(geom, x+pos.x_offset, pos.y_offset)))
        x+=pos.x_advance
    for (c1,a),(c2,bb) in zip(placed,placed[1:]):
        pair=text[c1:c2+1] if c2>c1 else text[c1]
        d=a.distance(bb)/upm
        key=text[c1]+text[c2] if c2<len(text) else pair
        if key not in res or d<res[key]: res[key]=d
def advance(text):
    b=hb.Buffer(); b.add_str(text); b.guess_segment_properties()
    hb.shape(font,b,{'kern':True,'liga':False})
    return sum(p.x_advance for p in b.glyph_positions)

# A span with letter-spacing starts a new shaping run, so the browser drops the font's kern on
# both sides of it. Each hand value restores the font's kern for the pair it starts and adds any
# missing clearance; pairs that end at a span get their kern restored the same way, repeated
# until no dropped kern remains.
target=0.02
kern=lambda pair: round((advance(pair)-advance(pair[0])-advance(pair[1]))/upm, 3)
table={k: round(kern(k)+target-d, 3) for k,d in res.items() if len(k)==2 and d<target}
changed=True
while changed:
    changed=False
    for text in texts:
        for i in range(1, len(text)-1):
            before=text[i-1:i+1]
            if text[i:i+2] in table and before not in table and kern(before):
                table[before]=kern(before)
                changed=True
print('pair  clearance  font-kern')
for k,d in sorted(res.items(), key=lambda kv: kv[1]):
    if d<0.03 and len(k)==2: print(f"{k!r:5} {d:9.4f}  {kern(k):9.3f}")
print()
print('export const kerning: Record<string, number> = {')
for k,v in sorted(table.items(), key=lambda kv: -kv[1]):
    key=k if k.isalpha() else repr(k)
    print(f"  {key}: {v},")
print('};')
