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
