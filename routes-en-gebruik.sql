-- =====================================================
--  ROAST ROUTE – routes bewaren en "waarvoor gebruik je de app?"
--  Plak alles in Supabase → SQL Editor → + New, en klik Run.
-- =====================================================

-- ---------- 1. Waarvoor gebruik je Roast Route? (koersen, ontspannen, werken) ----------
alter table profielen add column if not exists gebruik text[];


-- ---------- 2. Bewaarde routes ----------
create table if not exists routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade default auth.uid(),
  naam text not null check (char_length(naam) <= 80),
  punten jsonb not null,             -- de punten en bars van de route, in volgorde
  rondrit boolean default false,
  stijl text default 'fietspaden',
  km numeric,
  hoogtemeters int,
  gemaakt_op timestamptz default now()
);

alter table routes enable row level security;

-- Alleen jij ziet, bewaart en verwijdert je eigen routes
create policy "Eigen routes lezen"
  on routes for select to authenticated using (auth.uid() = user_id);
create policy "Eigen routes bewaren"
  on routes for insert to authenticated with check (auth.uid() = user_id);
create policy "Eigen routes verwijderen"
  on routes for delete to authenticated using (auth.uid() = user_id);
