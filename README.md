# logomarketing.dk

Statisk site (HTML/CSS/JS, intet build-trin) + Supabase (database, login, filer) + Resend (mail).
Hostes på Nordicway (cPanel, konto `halsedis` på cp17.nordicway.dk).

- `index.html` – hele sitet (forside, telte, dogtags, merchandise, foreninger, vilkår) med hash-routing
- `admin.html` – CRM (kræver login)
- `t/` – kundens tilbuds- og ordreside (`/t/?k=KODE`)
- `assets/js/config.js` – Supabase-URL, offentlig anon-nøgle og **teltpriser** (ét sted)
- `supabase/` – databaseskema, patches og edge function `notify-lead` (deployes ikke til webhotellet)

## Deploy
Repo på serveren: `~/repos/logomarketing` → `./deploy.sh` (git pull + rsync til document root).
Uden SSH: cPanel → Git Version Control → Deploy HEAD (bruger `.cpanel.yml`).

Se `FLYTNING.md` for flytningen fra Simply og `OPSÆTNING.md` for Supabase/Resend.
