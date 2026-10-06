#!/usr/bin/env python3
"""Bygger de offentlige sider ud fra tools/side-skabelon.html.

Ret ALTID i skabelonen og kør derefter:   python3 tools/byg-sider.py
Scriptet skriver index.html, reklametelte/, dogtags/, merchandise/, foreninger/,
handelsbetingelser/ og sitemap.xml. Ret aldrig i de genererede filer.
"""
import re, os, datetime, html
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://logomarketing.dk"

# key i skabelonen -> (sti, titel, beskrivelse, og-titel)
PAGES = {
 "home": ("/", "LogoMarketing – reklametelte, dogtags og merchandise med jeres logo",
   "Reklametelte med jeres logo til én pris uden tillæg, lasergraverede dogtags fra Aulum og merchandise til foreninger og virksomheder. Gratis mockup inden 2 hverdage.",
   "LogoMarketing – Dit logo. Ude i virkeligheden."),
 "telte": ("/reklametelte/", "Reklametelte med jeres logo – 3×3 og 3×6 m | LogoMarketing",
   "Reklametelt 3×3 eller 3×6 m med jeres design på tag og vægge. Fra 4.999 kr. ekskl. moms med transporttaske og designopsætning. Gratis mockup inden 2 hverdage.",
   "Reklametelte med jeres logo – én pris, ingen tillæg"),
 "laser": ("/dogtags/", "Dogtags med logo – lasergraveret i Aulum | LogoMarketing",
   "Dogtags i rustfrit stål, lasergraveret på egne maskiner i Aulum. Logo, navn og nummer på hvert stykke uden merpris. Fra 20 stk. Korrektur inden 2 hverdage.",
   "Dogtags med logo – graveret her, ikke trykt derude"),
 "merch": ("/merchandise/", "Merchandise med logo til foreninger og virksomheder | LogoMarketing",
   "Patches, halsedisser, solbriller, beachflag, roll-ups, kuglepenne og meget mere med jeres logo. Én kontakt, én mockup og ét samlet tilbud.",
   "Merchandise med logo – kan det bære et logo, kan vi skaffe det"),
 "foreninger": ("/foreninger/", "Reklametelt til foreninger – få det betalt af en sponsor | LogoMarketing",
   "Få foreningens telt betalt af en lokal sponsor: jeres logo på taget, sponsorens på sidevæggen. Gratis mockup med begge logoer og et færdigt sponsorbrev.",
   "Til foreninger: få teltet betalt, behold logoet"),
 "vilkaar": ("/handelsbetingelser/", "Handelsbetingelser og privatliv | LogoMarketing",
   "Handelsbetingelser for LogoMarketing: tilbud, korrektur, betaling, levering, reklamation og hvordan vi behandler jeres oplysninger.",
   "Handelsbetingelser og privatliv – LogoMarketing"),
}
LINKS = {"#/": "/", "#/telte": "/reklametelte/", "#/laser": "/dogtags/", "#/merch": "/merchandise/",
         "#/foreninger": "/foreninger/", "#/vilkaar": "/handelsbetingelser/"}

src = open(os.path.join(ROOT, "tools/side-skabelon.html"), encoding="utf-8").read()
block = lambda k: re.compile(r'<div class="page" data-page="%s"[^>]*>.*?</div><!-- /%s -->\n?' % (k, k), re.S)
for k in PAGES: assert block(k).search(src), "mangler side i skabelonen: " + k

def meta(s, pattern, value):
    new, n = re.subn(pattern, lambda m: m.group(1) + html.escape(value, quote=True) + m.group(2), s, count=1)
    assert n == 1, pattern
    return new

for key, (path, title, desc, ogt) in PAGES.items():
    s = src
    for other in PAGES:
        if other != key: s = block(other).sub("", s)
    s = s.replace('<div class="page" data-page="%s" hidden>' % key, '<div class="page" data-page="%s">' % key)
    s = s.replace("<body>", '<body data-page="%s">' % key, 1)
    url = BASE + path
    s = meta(s, r'(<title>).*?(</title>)', title)
    s = meta(s, r'(<meta name="description" content=")[^"]*(">)', desc)
    s = meta(s, r'(<meta property="og:title" content=")[^"]*(">)', ogt)
    s = meta(s, r'(<meta property="og:description" content=")[^"]*(">)', desc)
    s = meta(s, r'(<meta property="og:url" content=")[^"]*(">)', url)
    s = meta(s, r'(<link rel="canonical" href=")[^"]*(">)', url)
    for a, b in LINKS.items(): s = s.replace('href="%s"' % a, 'href="%s"' % b)
    s = re.sub(r'(href|src)="(assets/|admin\.html)', r'\1="/\2', s)
    # aktivt menupunkt uden JS
    s = s.replace('data-nav="%s"' % key, 'data-nav="%s" aria-current="page"' % key)
    assert "#/" not in re.sub(r'<script.*?</script>', '', s, flags=re.S), key + ": hash-link tilbage"
    out = os.path.join(ROOT, path.strip("/"), "index.html") if path != "/" else os.path.join(ROOT, "index.html")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, "w", encoding="utf-8").write("<!-- GENERERET af tools/byg-sider.py – ret i tools/side-skabelon.html -->\n" + s)
    print("skrev", os.path.relpath(out, ROOT))

today = datetime.date.today().isoformat()
pri = {"/": "1.0", "/reklametelte/": "0.9", "/dogtags/": "0.8", "/merchandise/": "0.7", "/foreninger/": "0.8", "/handelsbetingelser/": "0.2"}
xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for key, (path, *_ ) in PAGES.items():
    xml.append("  <url><loc>%s%s</loc><lastmod>%s</lastmod><priority>%s</priority></url>" % (BASE, path, today, pri[path]))
xml.append("</urlset>\n")
open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8").write("\n".join(xml))
print("skrev sitemap.xml")
