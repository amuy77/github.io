-- LaRa 店主ノート: 初期スキーマ
-- 全テーブルは user_id で RLS。写真は public バケット 'photos'（パスは UUID で推測不能、書き込みは本人のみ）。

-- ===== helpers =====
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ===== サインアップ許可リスト（API からは見えない。ポリシー無しの RLS） =====
create table if not exists public.allowed_emails (
  email       text primary key,
  note        text,
  created_at  timestamptz not null default now()
);
alter table public.allowed_emails enable row level security;
insert into public.allowed_emails (email, note) values ('take2it4easy5@gmail.com', 'オーナー') on conflict do nothing;

create or replace function public.check_allowed_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is null or not exists (select 1 from public.allowed_emails a where lower(a.email) = lower(new.email)) then
    raise exception 'email not allowed: %', new.email using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists check_allowed_email_before_signup on auth.users;
create trigger check_allowed_email_before_signup
  before insert on auth.users for each row execute function public.check_allowed_email();

-- ===== genres（ジャンル。ユーザーが編集できる） =====
create table if not exists public.genres (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name        text not null,
  color       text not null default 'green' check (color in ('green','mustard','brick','plum','wood')),
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, name)
);
create index if not exists genres_user_idx on public.genres(user_id, sort_order);
drop trigger if exists genres_updated on public.genres;
create trigger genres_updated before update on public.genres for each row execute function public.set_updated_at();

-- 初回ログイン時に初期ジャンルを投入
create or replace function public.seed_default_genres() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.genres (user_id, name, color, sort_order) values
    (new.id, 'コーヒー', 'wood', 1),
    (new.id, 'アメリカンサンド', 'brick', 2),
    (new.id, 'クロワッサンサンド', 'mustard', 3),
    (new.id, 'ベバレッジ', 'green', 4)
  on conflict (user_id, name) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created_seed_genres on auth.users;
create trigger on_auth_user_created_seed_genres
  after insert on auth.users for each row execute function public.seed_default_genres();

-- ===== clips（ネタ帳） =====
create table if not exists public.clips (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  type        text not null check (type in ('photo','link','note','idea')),
  title       text not null default '',
  note        text not null default '',
  url         text,
  images      jsonb not null default '[]'::jsonb,   -- [{path, thumb_path, w, h, bytes}]
  preview     jsonb,                                -- {title, description, image, site_name, final_url, instagram_blocked, fetched_at}
  category    text not null default 'other' check (category in ('sandwich','drink','wine','beer','coffee','shop','other')),
  tags        text[] not null default '{}',
  shop_name   text,
  favorite    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists clips_user_created_idx on public.clips(user_id, created_at desc);
create index if not exists clips_user_cat_idx on public.clips(user_id, category);
create index if not exists clips_tags_gin on public.clips using gin(tags);
drop trigger if exists clips_updated on public.clips;
create trigger clips_updated before update on public.clips for each row execute function public.set_updated_at();

-- ===== recipes（レシピ図鑑） =====
create table if not exists public.recipes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title          text not null,
  genre_id       uuid references public.genres(id) on delete set null,
  hero_image     jsonb,                                -- {path, thumb_path, w, h, bytes}
  ingredients    jsonb not null default '[]'::jsonb,   -- [{name, amount}]
  steps          jsonb not null default '[]'::jsonb,   -- ["…"]
  notes          text not null default '',
  source_clip_id uuid references public.clips(id) on delete set null,
  source_kind    text not null default 'manual' check (source_kind in ('manual','ai_image','ai_text','text_paste')),
  source_job_id  uuid,
  status         text not null default 'published' check (status in ('draft','published')),
  favorite       boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists recipes_user_genre_idx on public.recipes(user_id, genre_id);
create index if not exists recipes_user_status_idx on public.recipes(user_id, status, created_at desc);
drop trigger if exists recipes_updated on public.recipes;
create trigger recipes_updated before update on public.recipes for each row execute function public.set_updated_at();

-- ===== menu_logs / menu_log_items（日別メニュー記録） =====
create table if not exists public.menu_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  log_date    date not null,
  note        text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, log_date)
);
create index if not exists menu_logs_user_date_idx on public.menu_logs(user_id, log_date desc);
drop trigger if exists menu_logs_updated on public.menu_logs;
create trigger menu_logs_updated before update on public.menu_logs for each row execute function public.set_updated_at();

create table if not exists public.menu_log_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade default auth.uid(),
  menu_log_id  uuid not null references public.menu_logs(id) on delete cascade,
  recipe_id    uuid not null references public.recipes(id) on delete cascade,
  sold_count   int check (sold_count is null or sold_count >= 0),
  created_at   timestamptz not null default now(),
  unique (menu_log_id, recipe_id)
);
create index if not exists menu_log_items_log_idx on public.menu_log_items(menu_log_id);
create index if not exists menu_log_items_recipe_idx on public.menu_log_items(user_id, recipe_id);

-- ===== ai_jobs（Claude Code Routine が処理するトレイ） =====
create table if not exists public.ai_jobs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade default auth.uid(),
  kind         text not null check (kind in ('recipe_from_image','recipe_from_text','clip_from_image','weekly_insights')),
  status       text not null default 'pending' check (status in ('pending','processing','done','failed','cancelled')),
  payload      jsonb not null default '{}'::jsonb,   -- {image_paths[], text, hint, genre_id, clip_id, week_start}
  result       jsonb,
  error        text,
  attempts     int not null default 0,
  started_at   timestamptz,
  finished_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists ai_jobs_status_idx on public.ai_jobs(status, created_at);
create index if not exists ai_jobs_user_idx on public.ai_jobs(user_id, created_at desc);

-- ===== ai_insights（週次レポート） =====
create table if not exists public.ai_insights (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  week_start  date not null,
  insights    jsonb not null,            -- [{kind, emoji, title, body}]
  model       text not null default 'claude-code',
  created_at  timestamptz not null default now(),
  unique (user_id, week_start)
);

-- ===== RLS =====
alter table public.genres         enable row level security;
alter table public.clips          enable row level security;
alter table public.recipes        enable row level security;
alter table public.menu_logs      enable row level security;
alter table public.menu_log_items enable row level security;
alter table public.ai_jobs        enable row level security;
alter table public.ai_insights    enable row level security;

do $$ declare t text;
begin
  foreach t in array array['genres','clips','recipes','menu_logs','menu_log_items','ai_jobs','ai_insights'] loop
    execute format('drop policy if exists "%1$s_select" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_insert" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_update" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_delete" on public.%1$s', t);
    execute format('create policy "%1$s_select" on public.%1$s for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s_insert" on public.%1$s for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s_update" on public.%1$s for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s_delete" on public.%1$s for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

-- ===== 連続記録用: 活動日（JST） =====
create or replace function public.activity_days(since date) returns setof date
language sql stable security invoker set search_path = '' as $$
  select distinct d from (
    select (created_at at time zone 'Asia/Tokyo')::date as d from public.clips where created_at >= since
    union all select (created_at at time zone 'Asia/Tokyo')::date from public.recipes where created_at >= since and status = 'published'
    union all select log_date from public.menu_logs where log_date >= since
  ) x order by 1
$$;
grant execute on function public.activity_days(date) to authenticated;

-- ===== Storage: 'photos' は公開読み取り（URL は UUID）、書き込み・削除は本人の prefix のみ =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "photos_select_public" on storage.objects;
drop policy if exists "photos_insert_own" on storage.objects;
drop policy if exists "photos_update_own" on storage.objects;
drop policy if exists "photos_delete_own" on storage.objects;
create policy "photos_select_public" on storage.objects for select to public using (bucket_id = 'photos');
create policy "photos_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "photos_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "photos_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid()::text));
