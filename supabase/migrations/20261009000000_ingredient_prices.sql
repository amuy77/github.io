-- 材料の仕入れ値（原価・粗利の計算に使う）。例: ベーコン 1 kg で 1800 円。データは人ごと（ほかの表と同じ）。
-- 何度流しても同じ結果になる。
create table if not exists public.ingredient_prices (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name        text not null check (length(name) between 1 and 40),
  buy_amount  numeric not null check (buy_amount > 0),
  buy_unit    text not null check (length(buy_unit) between 1 and 8),
  buy_price   integer not null check (buy_price between 0 and 10000000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, name)
);
create index if not exists ingredient_prices_user_idx on public.ingredient_prices(user_id, name);
drop trigger if exists ingredient_prices_updated on public.ingredient_prices;
create trigger ingredient_prices_updated before update on public.ingredient_prices for each row execute function public.set_updated_at();

alter table public.ingredient_prices enable row level security;
drop policy if exists "ingredient_prices_select" on public.ingredient_prices;
drop policy if exists "ingredient_prices_insert" on public.ingredient_prices;
drop policy if exists "ingredient_prices_update" on public.ingredient_prices;
drop policy if exists "ingredient_prices_delete" on public.ingredient_prices;
create policy "ingredient_prices_select" on public.ingredient_prices for select to authenticated using ((select auth.uid()) = user_id);
create policy "ingredient_prices_insert" on public.ingredient_prices for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "ingredient_prices_update" on public.ingredient_prices for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "ingredient_prices_delete" on public.ingredient_prices for delete to authenticated using ((select auth.uid()) = user_id);
