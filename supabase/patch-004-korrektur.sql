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
