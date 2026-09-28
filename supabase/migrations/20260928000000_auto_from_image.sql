-- 「＋」から写真だけ送ると AI がネタ帳かレシピかを判断する auto_from_image を ai_jobs.kind に追加
alter table public.ai_jobs drop constraint if exists ai_jobs_kind_check;
alter table public.ai_jobs add constraint ai_jobs_kind_check
  check (kind in ('recipe_from_image','recipe_from_text','clip_from_image','auto_from_image','weekly_insights'));
