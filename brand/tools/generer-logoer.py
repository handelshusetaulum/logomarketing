# Genererer konturerede logofiler. Kør fra en mappe med fonts/ArchivoBlack.ttf og fonts/Bricolage.ttf (Google Fonts).
# pip install uharfbuzz fonttools brotli cairosvg
import uharfbuzz as hb, io, os
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
F='fonts/'
def load(path, loc=None):
    t=TTFont(path)
    if loc: t=instancer.instantiateVariableFont(t, loc)
    b=io.BytesIO(); t.save(b); data=b.getvalue()
    return TTFont(io.BytesIO(data)), data
cache={}
def font(name, loc=None):
    k=(name,tuple(sorted((loc or {}).items())))
    if k not in cache: cache[k]=load(F+name, loc)
    return cache[k]
def text_path(s, name, size, x, y, anchor='start', ls=0, loc=None):
    tt,data=font(name,loc); upm=tt['head'].unitsPerEm
    face=hb.Face(data); f=hb.Font(face); buf=hb.Buffer(); buf.add_str(s); buf.guess_segment_properties()
    hb.shape(f,buf,{"kern":True,"liga":True})
    sc=size/upm; gs=tt.getGlyphSet(); order=tt.getGlyphOrder()
    adv=sum(p.x_advance*sc+ls for p in buf.glyph_positions)
    x0 = x - (adv/2 if anchor=='middle' else 0)
    out=[]; cx=x0
    for info,pos in zip(buf.glyph_infos,buf.glyph_positions):
        g=order[info.codepoint]; pen=SVGPathPen(gs, ntos=lambda v: ('%.2f'%v).rstrip('0').rstrip('.'))
        gs[g].draw(TransformPen(pen,(sc,0,0,-sc,cx+pos.x_offset*sc,y-pos.y_offset*sc)))
        d=pen.getCommands()
        if d: out.append(d)
        cx+=pos.x_advance*sc+ls
    return ' '.join(out)
AB='ArchivoBlack.ttf'; BG='Bricolage.ttf'
INK='#0F1F2E'; WHITE='#FFFFFF'; CANVAS='#F4F5F1'
def bric(sz): return {'wght':500,'wdth':100,'opsz':max(12,min(96,sz))}
# Logo definitions: (viewBox, list of elements)  element = ('rect',attrs) | ('text', s, font, size, x, y, anchor, ls, fill, loc)
ICON_TXT=dict(size=22, x=44, y=37.8, ls=1)
L={
 'primaer': ('0 0 560 120',[('rect','x="6" y="18" width="176" height="84" rx="16" fill="%s"'%INK),
            ('text','LOGO',AB,46,95,75.5,'middle',2,WHITE,None),('text','Marketing',BG,52,204,79,'start',0,INK,bric(52))]),
 'hvid':    ('0 0 560 120',[('rect','x="6" y="18" width="176" height="84" rx="16" fill="%s"'%CANVAS),
            ('text','LOGO',AB,46,95,75.5,'middle',2,INK,None),('text','Marketing',BG,52,204,79,'start',0,WHITE,bric(52))]),
 'stablet': ('0 0 300 150',[('rect','x="62" y="10" width="176" height="84" rx="16" fill="%s"'%INK),
            ('text','LOGO',AB,46,151,67.5,'middle',2,WHITE,None),('text','Marketing',BG,30,150,130,'middle',0,INK,bric(30))]),
 'ikon':    ('0 0 88 60',[('rect','width="88" height="60" rx="12" fill="%s"'%INK),
            ('text','LOGO',AB,ICON_TXT['size'],ICON_TXT['x'],ICON_TXT['y'],'middle',ICON_TXT['ls'],WHITE,None)]),
 'mono-gravering': ('0 0 88 60',[('rect','x="1.5" y="1.5" width="85" height="57" rx="11" fill="none" stroke="#000000" stroke-width="3"'),
            ('text','LOGO',AB,ICON_TXT['size'],ICON_TXT['x'],ICON_TXT['y'],'middle',ICON_TXT['ls'],'#000000',None)]),
}
FAM={AB:'Archivo Black, Archivo, Arial Black, sans-serif', BG:'Bricolage Grotesque, Arial, sans-serif'}
def build(name, outline):
    vb,els=L[name]; parts=[]
    for e in els:
        if e[0]=='rect': parts.append('<rect %s/>'%e[1]); continue
        _,s,fn,sz,x,y,anc,ls,fill,loc=e
        if outline: parts.append('<path fill="%s" d="%s"/>'%(fill,text_path(s,fn,sz,x,y,anc,ls,loc)))
        else:
            a=' text-anchor="middle"' if anc=='middle' else ''
            w=' font-weight="500"' if fn==BG else ''
            l=' letter-spacing="%g"'%ls if ls else ''
            parts.append('<text x="%g" y="%g"%s font-family="%s"%s font-size="%g"%s fill="%s">%s</text>'%(x,y,a,FAM[fn],w,sz,l,fill,s))
    t='LogoMarketing' 
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s"><title>%s</title>%s</svg>'%(vb,t,''.join(parts))
import cairosvg
os.makedirs('brand/out/web',exist_ok=True); os.makedirs('brand/out/kontur',exist_ok=True); os.makedirs('brand/out/png',exist_ok=True)
for n in L:
    open('brand/out/web/logomarketing-%s.svg'%n,'w').write(build(n,False))
    k=build(n,True); open('brand/out/kontur/logomarketing-%s-kontur.svg'%n,'w').write(k)
    cairosvg.svg2pdf(bytestring=k.encode(), write_to='brand/out/kontur/logomarketing-%s-kontur.pdf'%n)
    w=int(L[n][0].split()[2]); scale=2000/w if w>200 else 1000/w
    cairosvg.svg2png(bytestring=k.encode(), write_to='brand/out/png/logomarketing-%s.png'%n, scale=scale)
print('ok')
