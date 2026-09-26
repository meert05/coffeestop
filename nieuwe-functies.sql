-- =====================================================
--  KOFFIESTOP – database voor de nieuwe functies
--  Plak alles in Supabase → SQL Editor → + New, en klik Run.
-- =====================================================

-- ---------- 1. Openingsuren (en kenmerken, voor het geval die nog ontbreekt) ----------
alter table stops add column if not exists openingsuren jsonb;
alter table stops add column if not exists kenmerken text[] default '{}';


-- ---------- 2. Reviews ----------
create table if not exists reviews (
  stop_id text references stops(id) on delete cascade,
  user_id uuid references auth.users on delete cascade default auth.uid(),
  score int not null check (score between 1 and 5),
  tekst text check (char_length(tekst) <= 500),
  voornaam text,
  gemaakt_op timestamptz default now(),
  primary key (stop_id, user_id)          -- één review per gebruiker per bar
);

alter table reviews enable row level security;

-- Iedereen mag reviews lezen
create policy "Iedereen leest reviews"
  on reviews for select using (true);

-- Je mag alleen je eigen review schrijven en aanpassen
create policy "Eigen review schrijven"
  on reviews for insert to authenticated with check (auth.uid() = user_id);
create policy "Eigen review aanpassen"
  on reviews for update to authenticated using (auth.uid() = user_id);

-- Je eigen review verwijderen; de beheerder mag ongepaste reviews verwijderen
create policy "Review verwijderen"
  on reviews for delete to authenticated
  using (auth.uid() = user_id or (auth.jwt() ->> 'email') = 'meertmilan@gmail.com');


-- ---------- 3. Bars voorstellen ----------
create table if not exists voorstellen (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade default auth.uid(),
  naam text not null check (char_length(naam) <= 100),
  adres text not null check (char_length(adres) <= 200),
  info text check (char_length(info) <= 500),
  gemaakt_op timestamptz default now()
);

alter table voorstellen enable row level security;

-- Ingelogde gebruikers mogen een voorstel indienen
create policy "Voorstel indienen"
  on voorstellen for insert to authenticated with check (auth.uid() = user_id);

-- Je ziet je eigen voorstellen; de beheerder ziet ze allemaal
create policy "Voorstellen lezen"
  on voorstellen for select to authenticated
  using (auth.uid() = user_id or (auth.jwt() ->> 'email') = 'meertmilan@gmail.com');

-- Alleen de beheerder verwijdert voorstellen (na overnemen of weigeren)
create policy "Beheerder verwijdert voorstellen"
  on voorstellen for delete to authenticated
  using ((auth.jwt() ->> 'email') = 'meertmilan@gmail.com');


-- ---------- 4. Account verwijderen (GDPR) ----------
-- Een gebruiker mag zijn eigen account verwijderen. Door "on delete cascade"
-- verdwijnen dan ook zijn profiel, favorieten, reviews en voorstellen.
create or replace function verwijder_mijn_account()
returns void
language plpgsql
security definer                -- draait met extra rechten, maar wist ALLEEN de ingelogde gebruiker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Niet ingelogd';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- Alleen ingelogde gebruikers mogen deze functie gebruiken
revoke execute on function verwijder_mijn_account() from public, anon;
grant execute on function verwijder_mijn_account() to authenticated;
