-- まだ仕分けていないレシピは「未分類」。AI が作ったものはここに入り、店主がメニューか参考に振り分ける
alter table public.recipes drop constraint if exists recipes_purpose_check;
alter table public.recipes add constraint recipes_purpose_check check (purpose in ('menu', 'reference', 'unsorted'));
alter table public.recipes alter column purpose set default 'unsorted';
-- これまで自動で「参考」にしていた AI のレシピは、未分類に戻して店主が仕分ける
update public.recipes set purpose = 'unsorted' where purpose = 'reference' and source_kind in ('ai_image', 'ai_text');
