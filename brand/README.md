# LogoMarketing – logofiler

| Mappe | Indhold | Brug |
|---|---|---|
| `../assets/img/logomarketing-*.svg` | SVG med levende tekst | Kun hjemmesiden (kræver webskrifterne) |
| `logo/kontur/*-kontur.svg` | SVG, al tekst lavet om til konturer | Telte, tryk, laser, Canva/Illustrator |
| `logo/kontur/*-kontur.pdf` | Samme som PDF (vektor) | Send til trykkeri / teltleverandør |
| `logo/png/*.png` | Transparent PNG, 2000 px (ikon/mono 1000 px) | Word, PowerPoint, mails, sociale medier |

Versioner: primær (lys bund), hvid (mørk bund), stablet (kvadratiske flader), ikon (små flader), mono-gravering (laser, én farve).

Filerne er genereret af `tools/generer-logoer.py` med Archivo Black og Bricolage Grotesque (vægt 500). Mappen `brand/` bliver ikke lagt på webserveren.
