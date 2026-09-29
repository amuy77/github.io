-- ネタ帳のカテゴリを店主が追加・編集できるようにする。
-- clips.category にはカテゴリの key（'sandwich' などの既定の値、または追加したカテゴリの 'c_xxxx'）が入る
create table if not exists public.clip_categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  key         text not null check (key ~ '^[a-z0-9_]{1,40}$'),
  name        text not null check (length(name) between 1 and 30),
  emoji       text not null default '' check (length(emoji) <= 16),
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, key),
  unique (user_id, name)
);
create index if not exists clip_categories_user_idx on public.clip_categories(user_id, sort_order);
drop trigger if exists clip_categories_updated on public.clip_categories;
create trigger clip_categories_updated before update on public.clip_categories for each row execute function public.set_updated_at();

alter table public.clip_categories enable row level security;
drop policy if exists "clip_categories_select" on public.clip_categories;
drop policy if exists "clip_categories_insert" on public.clip_categories;
drop policy if exists "clip_categories_update" on public.clip_categories;
drop policy if exists "clip_categories_delete" on public.clip_categories;
create policy "clip_categories_select" on public.clip_categories for select to authenticated using ((select auth.uid()) = user_id);
create policy "clip_categories_insert" on public.clip_categories for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "clip_categories_update" on public.clip_categories for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "clip_categories_delete" on public.clip_categories for delete to authenticated using ((select auth.uid()) = user_id);

-- 既定のカテゴリ（今までの 7 つ）
create or replace function public.seed_default_clip_categories() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.clip_categories (user_id, key, name, emoji, sort_order) values
    (new.id, 'sandwich', 'サンド', '🥪', 1),
    (new.id, 'drink', 'ドリンク', '🥤', 2),
    (new.id, 'coffee', 'コーヒー', '☕', 3),
    (new.id, 'wine', 'ワイン', '🍷', 4),
    (new.id, 'beer', 'ビール', '🍺', 5),
    (new.id, 'shop', 'お店', '🏪', 6),
    (new.id, 'other', 'その他', '✨', 7)
  on conflict do nothing;
  return new;
end $$;
revoke execute on function public.seed_default_clip_categories() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_seed_clip_categories on auth.users;
create trigger on_auth_user_created_seed_clip_categories
  after insert on auth.users for each row execute function public.seed_default_clip_categories();

-- いまいるユーザーにも既定のカテゴリを入れる
insert into public.clip_categories (user_id, key, name, emoji, sort_order)
select u.id, d.key, d.name, d.emoji, d.sort_order
from auth.users u
cross join (values ('sandwich', 'サンド', '🥪', 1), ('drink', 'ドリンク', '🥤', 2), ('coffee', 'コーヒー', '☕', 3), ('wine', 'ワイン', '🍷', 4),
                   ('beer', 'ビール', '🍺', 5), ('shop', 'お店', '🏪', 6), ('other', 'その他', '✨', 7)) as d(key, name, emoji, sort_order)
on conflict do nothing;

-- clips.category は固定の 7 つから、カテゴリの key へ
alter table public.clips drop constraint if exists clips_category_check;
alter table public.clips add constraint clips_category_check check (category ~ '^[a-z0-9_]{1,40}$');
