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
