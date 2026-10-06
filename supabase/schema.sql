-- ============================================================
--  LogoMarketing – databaseskema
--  Kør hele filen i Supabase → SQL Editor → New query → Run.
--  Kan køres igen uden at ødelægge noget (idempotent).
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- Hvem må se admin-data? ----------
create table if not exists public.admins (
  email text primary key,
  created_at timestamptz default now()
);
insert into public.admins (email) values ('info@logomarketing.dk') on conflict do nothing;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

-- ---------- Leads (forespørgsler fra formularen) ----------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  stage text not null default 'ny' check (stage in ('ny','kontakt','tilbud','vundet','tabt')),
  org text not null,
  name text not null,
  email text not null,
  phone text,
  event_name text,
  event_date date,
  color text,
  tent_qty int default 0,
  tent_size text,
  tent_walls int,
  items text[] default '{}',
  message text,
  sponsor text,
  logo_path text,
  est_value numeric default 0,
  notes text default '',
  follow_up date,
  source text default 'logomarketing.dk'
);
create index if not exists leads_stage_idx on public.leads (stage);
create index if not exists leads_created_idx on public.leads (created_at desc);

-- ---------- Aktivitetslog pr. lead ----------
create table if not exists public.lead_events (
  id bigserial primary key,
  lead_id uuid not null references public.leads(id) on delete cascade,
  created_at timestamptz not null default now(),
  message text not null,
  actor text default 'system'
);
create index if not exists lead_events_lead_idx on public.lead_events (lead_id, created_at);

-- ---------- Tilbud med egen URL (logomarketing.dk/t/?k=KODE) ----------
create table if not exists public.quotes (
  code text primary key,                 -- kort, ugætbar kode
  lead_id uuid references public.leads(id) on delete set null,
  created_at timestamptz not null default now(),
  valid_until date,
  org text not null,
  contact_name text,
  intro text,                            -- personlig tekst øverst
  lines jsonb not null default '[]',     -- [{"title":"3×3 telt, tag + bagvæg","qty":1,"unit":4999}]
  shipping numeric default 0,
  delivery_text text,                    -- "Typisk 4–6 uger efter godkendt korrektur"
  mockup_url text,                       -- link til mockup-billede (Supabase Storage eller ekstern)
  status text not null default 'sendt' check (status in ('kladde','sendt','set','accepteret','afvist','udloebet')),
  accepted_at timestamptz,
  accepted_by text,
  seen_at timestamptz
);

-- updated_at automatik
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists leads_touch on public.leads;
create trigger leads_touch before update on public.leads for each row execute function public.touch_updated_at();

-- Log automatisk når et lead oprettes / skifter status
create or replace function public.log_lead_change() returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    insert into public.lead_events (lead_id, message, actor) values (new.id, 'Forespørgsel modtaget via ' || coalesce(new.source,'web'), 'system');
  elsif tg_op = 'UPDATE' and new.stage is distinct from old.stage then
    insert into public.lead_events (lead_id, message, actor) values (new.id, 'Status ændret til ' || new.stage, coalesce(auth.jwt() ->> 'email','system'));
  end if;
  return new;
end $$;
drop trigger if exists leads_log on public.leads;
create trigger leads_log after insert or update on public.leads for each row execute function public.log_lead_change();

-- ---------- Sikkerhed (RLS) ----------
alter table public.leads enable row level security;
alter table public.lead_events enable row level security;
alter table public.quotes enable row level security;
alter table public.admins enable row level security;

-- Alle (anon) må OPRETTE et lead – det er formularen. Ingen andre må læse dem.
drop policy if exists "anon can insert lead" on public.leads;
create policy "anon can insert lead" on public.leads for insert to anon, authenticated with check (true);
-- Formularen må opdatere logo_path på det lead, den lige har oprettet (kun den kolonne, kun kort tid efter)
drop policy if exists "anon can set logo shortly after" on public.leads;
create policy "anon can set logo shortly after" on public.leads for update to anon
  using (created_at > now() - interval '10 minutes') with check (created_at > now() - interval '10 minutes');

-- Admin må alt
drop policy if exists "admin all leads" on public.leads;
create policy "admin all leads" on public.leads for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin all events" on public.lead_events;
create policy "admin all events" on public.lead_events for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin all quotes" on public.quotes;
create policy "admin all quotes" on public.quotes for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin read admins" on public.admins;
create policy "admin read admins" on public.admins for select to authenticated using (public.is_admin());

-- Kunden må se SIT tilbud via koden (koden er ugætbar – 10 tilfældige tegn)
drop policy if exists "anyone with code can read quote" on public.quotes;
create policy "anyone with code can read quote" on public.quotes for select to anon, authenticated using (true);

-- Kunden accepterer via en funktion (så de ikke kan ændre andet end status)
create or replace function public.accept_quote(p_code text, p_name text)
returns json language plpgsql security definer set search_path = public as $$
declare q public.quotes;
begin
  select * into q from public.quotes where code = p_code;
  if q.code is null then return json_build_object('ok', false, 'error', 'Tilbuddet findes ikke'); end if;
  if q.status in ('accepteret') then return json_build_object('ok', true, 'already', true); end if;
  if q.valid_until is not null and q.valid_until < current_date then return json_build_object('ok', false, 'error', 'Tilbuddet er udløbet – skriv til os, så fornyer vi det'); end if;
  update public.quotes set status = 'accepteret', accepted_at = now(), accepted_by = p_name where code = p_code;
  if q.lead_id is not null then
    update public.leads set stage = 'vundet' where id = q.lead_id;
    insert into public.lead_events (lead_id, message, actor) values (q.lead_id, 'Tilbud ' || p_code || ' accepteret af ' || coalesce(p_name,'kunden'), 'kunde');
  end if;
  return json_build_object('ok', true);
end $$;
grant execute on function public.accept_quote(text, text) to anon, authenticated;

-- Marker tilbud som "set" første gang det åbnes
create or replace function public.mark_quote_seen(p_code text)
returns void language sql security definer set search_path = public as $$
  update public.quotes set seen_at = coalesce(seen_at, now()), status = case when status = 'sendt' then 'set' else status end where code = p_code;
$$;
grant execute on function public.mark_quote_seen(text) to anon, authenticated;

-- ---------- Storage: bucket til logoer ----------
insert into storage.buckets (id, name, public) values ('logos', 'logos', false) on conflict (id) do nothing;
drop policy if exists "anon upload logo" on storage.objects;
create policy "anon upload logo" on storage.objects for insert to anon, authenticated with check (bucket_id = 'logos');
drop policy if exists "admin read logos" on storage.objects;
create policy "admin read logos" on storage.objects for select to authenticated using (bucket_id = 'logos' and public.is_admin());
drop policy if exists "admin delete logos" on storage.objects;
create policy "admin delete logos" on storage.objects for delete to authenticated using (bucket_id = 'logos' and public.is_admin());

-- Bucket til mockups (offentlig læsning – linkes fra tilbudssiden)
insert into storage.buckets (id, name, public) values ('mockups', 'mockups', true) on conflict (id) do nothing;
drop policy if exists "public read mockups" on storage.objects;
create policy "public read mockups" on storage.objects for select to anon, authenticated using (bucket_id = 'mockups');
drop policy if exists "admin write mockups" on storage.objects;
create policy "admin write mockups" on storage.objects for insert to authenticated with check (bucket_id = 'mockups' and public.is_admin());

-- Færdig. Næste: Database → Webhooks → ny webhook på public.leads (INSERT) → Edge Function notify-lead.
-- ============================================================
--  Patch 001: formularen opretter leads via en funktion
--  Kør i Supabase → SQL Editor → New query → Run.
-- ============================================================

-- Fjern de to anon-policies på leads (formularen bruger funktionen herunder i stedet)
drop policy if exists "anon can insert lead" on public.leads;
drop policy if exists "anon can set logo shortly after" on public.leads;

-- Funktion: opret et lead. Kører med ejer-rettigheder, men kan KUN indsætte – ikke læse.
create or replace function public.submit_lead(p jsonb)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  -- simpel værn mod misbrug
  if coalesce(p->>'org','') = '' or coalesce(p->>'name','') = '' or coalesce(p->>'email','') !~ '^.+@.+\..+$' then
    raise exception 'Manglende felter';
  end if;
  if length(p->>'message') > 4000 then raise exception 'Besked for lang'; end if;

  v_id := coalesce((p->>'id')::uuid, gen_random_uuid());
  insert into public.leads (id, org, name, email, phone, event_name, event_date, color, tent_qty, tent_size, tent_walls, items, message, sponsor, logo_path, est_value, source)
  values (
    v_id,
    left(p->>'org',200), left(p->>'name',200), left(p->>'email',200), left(p->>'phone',50),
    left(p->>'event_name',200), nullif(p->>'event_date','')::date, left(p->>'color',50),
    coalesce((p->>'tent_qty')::int,0), left(p->>'tent_size',10), nullif(p->>'tent_walls','')::int,
    coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p->'items','[]'::jsonb)) x), '{}'),
    p->>'message', left(p->>'sponsor',200), left(p->>'logo_path',300),
    coalesce((p->>'est_value')::numeric,0), coalesce(left(p->>'source',100),'logomarketing.dk')
  );
  return v_id;
end $$;
revoke all on function public.submit_lead(jsonb) from public;
grant execute on function public.submit_lead(jsonb) to anon, authenticated;

-- Storage: anonyme må kun uploade til logos/<uuid>/<fil>, ikke overskrive eller liste
drop policy if exists "anon upload logo" on storage.objects;
create policy "anon upload logo" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$');
-- ============================================================
--  Patch 002: produktionsflow efter "vundet"
--  Kør i Supabase → SQL Editor → New query → Run.
-- ============================================================

alter table public.leads add column if not exists prod_step text
  check (prod_step in ('korrektur','godkendt','bestilt','modtaget','leveret','faktureret'));
alter table public.leads add column if not exists ordered_at date;   -- bestilt hos leverandør
alter table public.leads add column if not exists eta_date date;     -- forventet modtagelse i Aulum

-- Når et lead bliver "vundet" (manuelt eller via accepteret tilbud), starter produktionen ved "korrektur"
create or replace function public.default_prod_step() returns trigger language plpgsql as $$
begin
  if new.stage = 'vundet' and new.prod_step is null then new.prod_step := 'korrektur'; end if;
  if new.prod_step = 'bestilt' and new.ordered_at is null then new.ordered_at := current_date; end if;
  return new;
end $$;
drop trigger if exists leads_prod_default on public.leads;
create trigger leads_prod_default before insert or update on public.leads for each row execute function public.default_prod_step();

-- Log også produktionsskridt i aktivitetsloggen
create or replace function public.log_lead_change() returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    insert into public.lead_events (lead_id, message, actor) values (new.id, 'Forespørgsel modtaget via ' || coalesce(new.source,'web'), 'system');
  elsif tg_op = 'UPDATE' then
    if new.stage is distinct from old.stage then
      insert into public.lead_events (lead_id, message, actor) values (new.id, 'Status ændret til ' || new.stage, coalesce(auth.jwt() ->> 'email','system'));
    end if;
    if new.prod_step is distinct from old.prod_step and new.prod_step is not null then
      insert into public.lead_events (lead_id, message, actor) values (new.id, 'Produktion: ' ||
        case new.prod_step when 'korrektur' then 'korrektur sendt til kunden' when 'godkendt' then 'korrektur godkendt'
          when 'bestilt' then 'bestilt hos leverandør' when 'modtaget' then 'varer modtaget i Aulum'
          when 'leveret' then 'leveret til kunden' when 'faktureret' then 'faktureret – ordren er afsluttet' else new.prod_step end,
        coalesce(auth.jwt() ->> 'email','system'));
    end if;
  end if;
  return new;
end $$;
-- ============================================================
--  Patch 003: kunden kan følge ordren på tilbudslinket
--  Kør i Supabase → SQL Editor → New query → Run.
-- ============================================================

-- Udleverer KUN status og datoer for den ordre, der hører til tilbudskoden.
-- Ingen noter, ingen kontaktoplysninger, ingen priser – dem har kunden i forvejen.
create or replace function public.quote_status(p_code text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'accepted_at', q.accepted_at,
    'prod_step',   l.prod_step,
    'ordered_at',  l.ordered_at,
    'eta_date',    l.eta_date,
    'event_date',  l.event_date,
    'updated_at',  greatest(l.updated_at, q.accepted_at)
  )
  from public.quotes q
  left join public.leads l on l.id = q.lead_id
  where q.code = p_code and q.status = 'accepteret';
$$;
revoke all on function public.quote_status(text) from public;
grant execute on function public.quote_status(text) to anon, authenticated;
-- ============================================================
--  Patch 004: korrektur-godkendelse på kundens link
--  Kør i Supabase → SQL Editor → New query → Run.
-- ============================================================

alter table public.leads add column if not exists proof_url text;            -- seneste korrektur (billede i bucket "mockups")
alter table public.leads add column if not exists proof_version int default 0;
alter table public.leads add column if not exists proof_sent_at timestamptz;
alter table public.leads add column if not exists proof_approved_at timestamptz;
alter table public.leads add column if not exists proof_approved_by text;

-- Status til kundens side – nu også med korrektur
create or replace function public.quote_status(p_code text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'accepted_at',       q.accepted_at,
    'prod_step',         l.prod_step,
    'ordered_at',        l.ordered_at,
    'eta_date',          l.eta_date,
    'event_date',        l.event_date,
    'proof_url',         l.proof_url,
    'proof_version',     l.proof_version,
    'proof_sent_at',     l.proof_sent_at,
    'proof_approved_at', l.proof_approved_at,
    'proof_approved_by', l.proof_approved_by,
    'updated_at',        greatest(l.updated_at, q.accepted_at)
  )
  from public.quotes q
  left join public.leads l on l.id = q.lead_id
  where q.code = p_code and q.status = 'accepteret';
$$;
revoke all on function public.quote_status(text) from public;
grant execute on function public.quote_status(text) to anon, authenticated;

-- Kunden godkender korrekturen via koden. Kan KUN flytte fra 'korrektur' til 'godkendt' – intet andet.
create or replace function public.approve_proof(p_code text, p_name text)
returns json language plpgsql security definer set search_path = public as $$
declare q public.quotes; l public.leads;
begin
  select * into q from public.quotes where code = p_code and status = 'accepteret';
  if q.code is null or q.lead_id is null then return json_build_object('ok', false, 'error', 'Ordren blev ikke fundet'); end if;
  select * into l from public.leads where id = q.lead_id;
  if l.proof_url is null then return json_build_object('ok', false, 'error', 'Der er ikke sendt en korrektur endnu'); end if;
  if l.prod_step is distinct from 'korrektur' then return json_build_object('ok', true, 'already', true); end if;
  if coalesce(trim(p_name),'') = '' then return json_build_object('ok', false, 'error', 'Skriv dit navn'); end if;
  update public.leads set prod_step = 'godkendt', proof_approved_at = now(), proof_approved_by = left(trim(p_name), 120) where id = l.id;
  insert into public.lead_events (lead_id, message, actor)
    values (l.id, 'Korrektur v' || coalesce(l.proof_version,1) || ' godkendt af ' || left(trim(p_name),120) || ' via kundelinket', 'kunde');
  return json_build_object('ok', true);
end $$;
revoke all on function public.approve_proof(text, text) from public;
grant execute on function public.approve_proof(text, text) to anon, authenticated;
-- ============================================================
--  Patch 005: luk for at alle kan liste tilbud og mockups
--  Kør i Supabase → SQL Editor → New query → Run.
--  (Kør den EFTER at den nye version af sitet er deployet.)
-- ============================================================

-- 1) Tilbud: ingen må længere læse hele tabellen. Kunden henter KUN sit eget tilbud via koden.
drop policy if exists "anyone with code can read quote" on public.quotes;

create or replace function public.get_quote(p_code text)
returns json language sql stable security definer set search_path = public as $$
  select row_to_json(q) from (
    select code, created_at, valid_until, org, contact_name, intro, lines, shipping,
           delivery_text, mockup_url, status, accepted_at, accepted_by, seen_at
    from public.quotes where code = p_code and length(p_code) >= 8
  ) q;
$$;
revoke all on function public.get_quote(text) from public;
grant execute on function public.get_quote(text) to anon, authenticated;

-- 2) Mockups/korrekturer: filerne kan stadig vises via deres direkte link (offentlig bucket),
--    men ingen udefra kan længere liste, hvad der ligger i bucketten.
drop policy if exists "public read mockups" on storage.objects;
drop policy if exists "admin read mockups" on storage.objects;
create policy "admin read mockups" on storage.objects for select to authenticated
  using (bucket_id = 'mockups' and public.is_admin());
drop policy if exists "admin update mockups" on storage.objects;
create policy "admin update mockups" on storage.objects for update to authenticated
  using (bucket_id = 'mockups' and public.is_admin()) with check (bucket_id = 'mockups' and public.is_admin());
drop policy if exists "admin delete mockups" on storage.objects;
create policy "admin delete mockups" on storage.objects for delete to authenticated
  using (bucket_id = 'mockups' and public.is_admin());

-- 3) is_admin må kaldes fra admin-siden, så den kan afvise forkerte mails pænt
grant execute on function public.is_admin() to authenticated;
