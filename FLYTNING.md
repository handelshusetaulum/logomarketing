# Flytning af logomarketing.dk: Simply → Nordicway

Princip: byg nyt → test → skift trafik → test igen → luk gammelt.

## 1. Før nameserver-skiftet (i Nordicways cPanel)
- [ ] Domæner → logomarketing.dk oprettet med egen document root (ikke delt med halsedissen.dk)
- [ ] E-mail-konti → info@logomarketing.dk oprettet
- [ ] E-mailruting → logomarketing.dk = **Lokal**
- [ ] E-mail-leverbarhed → SPF og DKIM installeret for logomarketing.dk
- [ ] Zone Editor:
  - `logomarketing.dk` A → `94.231.103.23` (Simply – indtil sitet er deployet på Nordicway)
  - `www` A/CNAME → som ovenfor
  - `resend._domainkey` TXT → (kopiér fra Resend → Domains → logomarketing.dk)
  - `send` CNAME → `send.forge.rmta.net`
  - `_dmarc` TXT → `v=DMARC1; p=none; rua=mailto:info@logomarketing.dk`
  - `logomarketing.dk` TXT → `google-site-verification=QTHl1xW4j4NLdGnjyp_izG1p-J-IzpLVfc_-ChFjzV4`
  - MX → som cPanel har oprettet (Nordicway)

## 2. Efter nameserver-skiftet
- [ ] NS svarer med Nordicway
- [ ] Test-mail til og fra info@
- [ ] Testforespørgsel fra formularen → mail til info@ + kvittering (Resend verificeret i dashboardet)
- [ ] Gammel mail kopieret fra Simply-postkassen (IMAP)

## 3. Sitet på Nordicway
- [ ] SSH/Git virker → `~/repos/logomarketing` klonet → `./deploy.sh`
- [ ] Test mod serverens IP før A-record skiftes
- [ ] A-records → Nordicways IP (`188.40.215.228`)
- [ ] AutoSSL udstedt for logomarketing.dk og www
- [ ] http → https og www → uden www redirecter
- [ ] Gamle WordPress-adresser redirecter (se .htaccess)

## 4. Supabase (samme dag som A-record skiftes)
- [ ] Authentication → URL Configuration: Site URL `https://logomarketing.dk/`
- [ ] Redirect URLs: tilføj `https://logomarketing.dk/admin.html` (fjern /ny/-varianten efter test)
- [ ] Edge Functions → Secrets: `ADMIN_URL = https://logomarketing.dk/admin.html`
- [ ] Log ind i admin, lav tilbud, åbn kundelink, godkend korrektur

## 5. Oprydning (tidligst 14 dage efter)
- [ ] DMARC strammes: `p=quarantine`, senere `p=reject`
- [ ] Search Console: indsend sitemap.xml
- [ ] Simply-webhotel og -mail opsiges
