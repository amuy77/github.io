-- 確認画面・評価・レシピの版管理・LaRa への相談
-- clips.rating: 1〜5（null = 保留 / 未評価）。needs_review: AI が作って、まだ店主が確認していないネタ
alter table public.clips add column if not exists rating smallint check (rating between 1 and 5);
alter table public.clips add column if not exists needs_review boolean not null default false;

-- recipes.rating: 1〜3（null = 保留 / 未評価）
-- family_id: 同じ料理の別レシピ・試作をまとめる。グループの最初のレシピの id を指す（最初のレシピ自身は null）
-- variant_label: 「試作2」「A案」など。is_main: そのグループで今の本命（採用中）
alter table public.recipes add column if not exists rating smallint check (rating between 1 and 3);
alter table public.recipes add column if not exists family_id uuid references public.recipes(id) on delete set null;
alter table public.recipes add column if not exists variant_label text not null default '';
alter table public.recipes add column if not exists is_main boolean not null default false;
create index if not exists recipes_family_idx on public.recipes(family_id) where family_id is not null;
create index if not exists clips_needs_review_idx on public.clips(user_id) where needs_review;

-- consult: API キーが無いときに LaRa への相談を定期処理に回す
alter table public.ai_jobs drop constraint if exists ai_jobs_kind_check;
alter table public.ai_jobs add constraint ai_jobs_kind_check
  check (kind in ('recipe_from_image','recipe_from_text','clip_from_image','auto_from_image','consult','weekly_insights'));
