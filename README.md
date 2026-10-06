# logomarketing.dk

Statisk site (HTML/CSS/JS) + Supabase (database, login, filer) + Resend (mail).
Hostes på Nordicway (cPanel, konto `halsedis` på cp17.nordicway.dk).

- `tools/side-skabelon.html` – **ret her**: alle offentlige sider i én fil
- `tools/byg-sider.py` – kør `python3 tools/byg-sider.py` efter hver rettelse. Den skriver `index.html`,
  `reklametelte/`, `dogtags/`, `merchandise/`, `foreninger/`, `handelsbetingelser/` og `sitemap.xml`
  (hver side med egen titel, beskrivelse og canonical). Ret aldrig i de genererede filer.
- `admin.html` – CRM (kræver login)
- `t/` – kundens tilbuds- og ordreside (`/t/?k=KODE`)
- `assets/js/config.js` – Supabase-URL, offentlig anon-nøgle og **teltpriser** (ét sted)
- `supabase/` – databaseskema, patches og edge function `notify-lead` (deployes ikke til webhotellet)

## Deploy
Repo på serveren: `~/repos/logomarketing` → `./deploy.sh` (git pull + rsync til document root).
Uden SSH: cPanel → Git Version Control → Deploy HEAD (bruger `.cpanel.yml`).

Se `FLYTNING.md` for flytningen fra Simply og `OPSÆTNING.md` for Supabase/Resend.
