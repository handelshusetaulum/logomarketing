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
