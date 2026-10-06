-- 段階 1: お店のメニューの価格（売上の分析に使う）と、お店とメンバーの土台。
-- データは今まで通り人ごと（侑磨・彩加それぞれ）。shops / shop_members は「同じお店の人」を表すだけで、レシピなどの見える範囲は変えない。
-- 何度流しても同じ結果になる。

-- ===== 価格（税込・円）。null は未設定 =====
alter table public.recipes add column if not exists price integer check (price is null or price between 0 and 1000000);

-- ===== お店とメンバー =====
create table if not exists public.shops (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'LaRa' check (length(name) between 1 and 40),
  created_at  timestamptz not null default now()
);
create table if not exists public.shop_members (
  shop_id       uuid not null references public.shops(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null default 'staff' check (role in ('owner', 'staff')),
  display_name  text not null default '' check (length(display_name) <= 20),
  created_at    timestamptz not null default now(),
  primary key (shop_id, user_id)
);
create index if not exists shop_members_user_idx on public.shop_members(user_id);

-- 自分が入っているお店（RLS の中で shop_members を読むと自分自身のポリシーで回り続けるので、関数で引く）
create or replace function public.my_shop_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select shop_id from public.shop_members where user_id = auth.uid()
$$;
revoke execute on function public.my_shop_ids() from public, anon;
grant execute on function public.my_shop_ids() to authenticated;

alter table public.shops enable row level security;
alter table public.shop_members enable row level security;
drop policy if exists "shops_select" on public.shops;
drop policy if exists "shops_update" on public.shops;
drop policy if exists "shop_members_select" on public.shop_members;
drop policy if exists "shop_members_update_self" on public.shop_members;
-- 同じお店のメンバーなら、お店とメンバー一覧（名前）が見える。お店の名前はオーナーだけ変えられる。自分の表示名は自分で変えられる
create policy "shops_select" on public.shops for select to authenticated using (id in (select public.my_shop_ids()));
create policy "shops_update" on public.shops for update to authenticated
  using (exists (select 1 from public.shop_members m where m.shop_id = id and m.user_id = (select auth.uid()) and m.role = 'owner'))
  with check (exists (select 1 from public.shop_members m where m.shop_id = id and m.user_id = (select auth.uid()) and m.role = 'owner'));
create policy "shop_members_select" on public.shop_members for select to authenticated using (shop_id in (select public.my_shop_ids()));
create policy "shop_members_update_self" on public.shop_members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- 役割（owner / staff）は自分で変えられないように、表示名だけ更新できる
revoke update on public.shop_members from authenticated;
grant update (display_name) on public.shop_members to authenticated;
revoke update on public.shops from authenticated;
grant update (name) on public.shops to authenticated;

-- お店がまだ無ければ 1 つ作り、いまいる人を全員メンバーに（許可リストで「オーナー」の人がオーナー）
insert into public.shops (name) select 'LaRa' where not exists (select 1 from public.shops);
insert into public.shop_members (shop_id, user_id, role)
select (select id from public.shops order by created_at limit 1), u.id,
       case when exists (select 1 from public.allowed_emails a where lower(a.email) = lower(u.email) and a.note = 'オーナー') then 'owner' else 'staff' end
from auth.users u
on conflict do nothing;

-- これから登録する人（許可リストにいる人）も、最初のお店にスタッフとして入る
create or replace function public.join_first_shop() returns trigger
language plpgsql security definer set search_path = '' as $$
declare sid uuid;
begin
  select id into sid from public.shops order by created_at limit 1;
  if sid is not null and exists (select 1 from public.allowed_emails a where lower(a.email) = lower(new.email)) then
    insert into public.shop_members (shop_id, user_id, role) values (sid, new.id, 'staff') on conflict do nothing;
  end if;
  return new;
end $$;
revoke execute on function public.join_first_shop() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_join_shop on auth.users;
create trigger on_auth_user_created_join_shop after insert on auth.users for each row execute function public.join_first_shop();
