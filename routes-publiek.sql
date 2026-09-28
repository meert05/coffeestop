-- =====================================================
--  ROAST ROUTE – GPX-routes bewaren en routes publiceren
--  Plak alles in Supabase → SQL Editor → + New, en klik Run.
-- =====================================================

-- Soort route: 'gepland' (zelf geklikt) of 'import' (eigen GPX)
alter table routes add column if not exists soort text default 'gepland';

-- Gepubliceerd door de beheerder: iedereen ziet de route
alter table routes add column if not exists publiek boolean default false;

-- Iedereen mag gepubliceerde routes lezen
create policy "Publieke routes lezen"
  on routes for select to anon, authenticated using (publiek = true);

-- Bewaren: gewone gebruikers alleen privé, de beheerder mag ook publiek bewaren
drop policy if exists "Eigen routes bewaren" on routes;
create policy "Eigen routes bewaren"
  on routes for insert to authenticated
  with check (auth.uid() = user_id and (publiek = false or (auth.jwt() ->> 'email') = 'meertmilan@gmail.com'));

-- Alleen de beheerder mag zijn eigen routes publiceren of weer privé maken
create policy "Beheerder publiceert routes"
  on routes for update to authenticated
  using (auth.uid() = user_id and (auth.jwt() ->> 'email') = 'meertmilan@gmail.com')
  with check (auth.uid() = user_id and (auth.jwt() ->> 'email') = 'meertmilan@gmail.com');
