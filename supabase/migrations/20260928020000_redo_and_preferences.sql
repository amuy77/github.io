-- AI への修正依頼（redo）と、修正指示から学んだ「店主の好み・ルール」
alter table public.ai_jobs drop constraint if exists ai_jobs_kind_check;
alter table public.ai_jobs add constraint ai_jobs_kind_check
  check (kind in ('recipe_from_image','recipe_from_text','clip_from_image','auto_from_image','redo','consult','weekly_insights'));

-- LaRa が覚えたこと。AI ワーカーは毎回これを読んでから仕事をする。店主はアプリで確認・停止・削除できる
create table if not exists public.ai_preferences (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  rule        text not null check (length(rule) between 1 and 500),
  example     text not null default '',           -- 元になった修正指示（原文）
  source_job_id uuid references public.ai_jobs(id) on delete set null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists ai_preferences_user_idx on public.ai_preferences(user_id, active, created_at desc);
drop trigger if exists ai_preferences_updated on public.ai_preferences;
create trigger ai_preferences_updated before update on public.ai_preferences for each row execute function public.set_updated_at();

alter table public.ai_preferences enable row level security;
drop policy if exists "ai_preferences_select" on public.ai_preferences;
drop policy if exists "ai_preferences_insert" on public.ai_preferences;
drop policy if exists "ai_preferences_update" on public.ai_preferences;
drop policy if exists "ai_preferences_delete" on public.ai_preferences;
create policy "ai_preferences_select" on public.ai_preferences for select to authenticated using ((select auth.uid()) = user_id);
create policy "ai_preferences_insert" on public.ai_preferences for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "ai_preferences_update" on public.ai_preferences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "ai_preferences_delete" on public.ai_preferences for delete to authenticated using ((select auth.uid()) = user_id);
