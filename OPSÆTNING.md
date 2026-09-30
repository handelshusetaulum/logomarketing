# LogoMarketing.dk – opsætning fra nul til live

Regn med ca. 45 minutter i alt. Alt er gratis at starte med.

Sådan hænger det sammen:

```
Kunde udfylder formular  →  Supabase (database + logo-upload)
                                  ↓ webhook
                            Edge Function "notify-lead"  →  Resend  →  mail til info@logomarketing.dk (+ kvittering til kunden)
Du åbner /admin.html     →  login med mail-link  →  CRM læser/skriver i Supabase
Du laver et tilbud       →  kunden får link /t/?k=KODE  →  kan acceptere med ét klik
```

---

## 1. GitHub (5 min)

1. Opret et nyt, **privat** repository, fx `logomarketing`.
2. Upload hele indholdet af denne mappe (eller `git push`). Strukturen skal være:
   ```
   index.html
   admin.html
   t/index.html
   assets/css/site.css
   assets/js/config.js  site.js  admin.js
   assets/img/…
   supabase/schema.sql
   supabase/functions/notify-lead/index.ts
   _headers  _redirects
   ```

## 2. Supabase (15 min)

1. Gå til https://supabase.com → **New project**. Vælg region **EU (Frankfurt)** – så bliver data i EU. Gem database-kodeordet et sikkert sted.
2. **SQL Editor → New query** → indsæt hele `supabase/schema.sql` → **Run**. Der skal stå "Success".
3. **Project Settings → API**: kopiér **Project URL** og **anon public**-nøglen ind i `assets/js/config.js`.
4. **Authentication → Providers → Email**: slå *Confirm email* fra, behold *Enable email provider*. Under **URL Configuration** sæt *Site URL* til `https://logomarketing.dk` og tilføj `https://logomarketing.dk/admin.html` under *Redirect URLs* (plus jeres `*.pages.dev`-adresse, mens I tester).
5. **Authentication → Users → Add user**: opret `info@logomarketing.dk` (uden kodeord – login sker via mail-link). Mailen er allerede på admin-listen i databasen. Vil du logge ind med en anden mail, så tilføj den i tabellen `admins`.

> Supabases indbyggede login-mails er begrænset til få pr. time. Det er nok til dig, men vil du have pænere mails, kan du under *Authentication → SMTP* sætte Resend ind (samme nøgle som nedenfor).

## 3. Resend – mails (10 min)

1. Opret konto på https://resend.com. Gratis: 3.000 mails/md.
2. **Domains → Add domain** → `logomarketing.dk`. Resend viser 3–4 DNS-poster (DKIM/SPF), som skal oprettes hos jeres domæneudbyder. Det tager typisk 10–30 min, før de er verificeret.
3. **API Keys → Create** → kopiér nøglen (starter med `re_`).

## 4. Edge Function – mail-notifikation (10 min)

Kræver Supabase CLI (én gang: `npm i -g supabase`, derefter `supabase login`).

```bash
supabase link --project-ref DIT-PROJEKT-REF        # ref står i Project Settings → General
supabase secrets set RESEND_API_KEY=re_xxx NOTIFY_TO=info@logomarketing.dk \
  NOTIFY_FROM="LogoMarketing <info@logomarketing.dk>" \
  ADMIN_URL=https://logomarketing.dk/admin.html WEBHOOK_SECRET=vaelg-et-langt-tilfaeldigt-kodeord
supabase functions deploy notify-lead --no-verify-jwt
```

Kobl den til databasen: **Database → Webhooks → Create a new hook**
- Name: `notify-lead` · Table: `leads` · Events: **Insert**
- Type: *Supabase Edge Functions* → vælg `notify-lead`
- HTTP Headers: tilføj `x-webhook-secret` = det samme kodeord som `WEBHOOK_SECRET`

Test: send en forespørgsel via formularen på sitet. Du skal have en mail inden for et minut, og kunden en kvittering.

## 5. Cloudflare Pages – hosting (5 min)

1. https://dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git** → vælg repoet.
2. Build settings: *Framework preset: None*, *Build command:* (tom), *Output directory:* `/`.
3. Deploy. I får en adresse som `logomarketing.pages.dev` – test alt der først.
4. **Custom domains → Add** `logomarketing.dk` og `www.logomarketing.dk`. Cloudflare fortæller, hvilke DNS-poster der skal ændres hos jeres nuværende webhotel (typisk en CNAME). Den gamle Divi-side kører, indtil DNS er skiftet – så der er ingen nedetid.

Hver gang du pusher til GitHub, deployer Cloudflare automatisk på ca. 30 sekunder.

## 6. Tjekliste før go-live

- [ ] `config.js` har rigtig URL og anon-key
- [ ] Formular sender → lead vises i admin → mail modtaget
- [ ] Logo-upload virker (link "Hent logo" i admin)
- [ ] Login-link til admin virker fra `logomarketing.dk/admin.html`
- [ ] Lav et testtilbud, åbn kundelinket, tryk "accepter" → status skifter til vundet
- [ ] Priserne i `assets/js/site.js` (PRICES) og `admin.js` er rettet til jeres faktiske priser
- [ ] Handelsbetingelserne (forsiden → Info → Handelsbetingelser) er læst igennem
- [ ] Google Search Console tilføjet, når domænet peger rigtigt

## Hvor ligger hvad, når du vil rette noget

| Vil du …                           | Ret her                                        |
|------------------------------------|------------------------------------------------|
| Ændre tekster på sitet             | `index.html`                                   |
| Ændre teltpriser                   | `PRICES` øverst i `assets/js/site.js` og `admin.js` |
| Tilføje et merch-produkt           | `index.html` (merch-siden + formularens knapper) |
| Skifte et billede                  | `assets/img/` – samme filnavn, så virker det   |
| Ændre mail-teksterne               | `supabase/functions/notify-lead/index.ts` → deploy igen |
| Give en anden adgang til admin     | Supabase → Table editor → `admins` → tilføj mail |
