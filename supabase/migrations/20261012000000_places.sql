-- お気に入りのお店（ノートの「📍 お店」）。行って特に気に入ったお店を Google マップのリンクと一緒に溜める。
-- データは人ごと（ほかの表と同じ）。何度流しても同じ結果になる。
create table if not exists public.places (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name        text not null check (length(name) between 1 and 80),
  url         text check (url is null or length(url) <= 2000),
  maps_url    text check (maps_url is null or length(maps_url) <= 4000),
  lat         double precision check (lat is null or lat between -90 and 90),
  lng         double precision check (lng is null or lng between -180 and 180),
  address     text not null default '' check (length(address) <= 200),
  area        text not null default '' check (length(area) <= 40),
  cuisine     text not null default '' check (length(cuisine) <= 20),
  price_band  smallint check (price_band is null or price_band between 1 and 5),
  rating      smallint check (rating is null or rating between 1 and 5),
  revisit     boolean not null default false,
  note        text not null default '' check (length(note) <= 4000),
  images      jsonb not null default '[]'::jsonb,
  visited_on  date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists places_user_idx on public.places(user_id, created_at desc);
drop trigger if exists places_updated on public.places;
create trigger places_updated before update on public.places for each row execute function public.set_updated_at();

alter table public.places enable row level security;
drop policy if exists "places_select" on public.places;
drop policy if exists "places_insert" on public.places;
drop policy if exists "places_update" on public.places;
drop policy if exists "places_delete" on public.places;
create policy "places_select" on public.places for select to authenticated using ((select auth.uid()) = user_id);
create policy "places_insert" on public.places for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "places_update" on public.places for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "places_delete" on public.places for delete to authenticated using ((select auth.uid()) = user_id);
