-- レシピの種類に「アイデア」（試作中・うちでやりたい）を足す。
-- 「お店のメニュー」はノートの「メニュー」タブに独立し、図鑑は アイデア／参考／未分類 になる。データは変えない
alter table public.recipes drop constraint if exists recipes_purpose_check;
alter table public.recipes add constraint recipes_purpose_check check (purpose in ('menu', 'idea', 'reference', 'unsorted'));
