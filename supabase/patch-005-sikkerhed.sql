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
