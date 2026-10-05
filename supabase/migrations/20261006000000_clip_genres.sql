-- ネタ帳のカテゴリを図鑑の「ジャンル」に統一する（1 件に 1 つ）。
-- clips.genre_id で genres を指す。今までの clip_categories と clips.category は消さずに残す（使わなくなるだけ。戻したいときのため）。
-- 何度流しても同じ結果になる。

alter table public.clips add column if not exists genre_id uuid references public.genres(id) on delete set null;
create index if not exists clips_user_genre_idx on public.clips(user_id, genre_id);

-- 1) ネタ帳のカテゴリ（「その他」以外）をジャンルへ。同じ名前のジャンルがあればそれにまとめる
insert into public.genres (user_id, name, emoji, color, sort_order)
select cc.user_id, cc.name, cc.emoji,
       case cc.key when 'sandwich' then 'orange' when 'drink' then 'sky' when 'coffee' then 'cocoa' when 'wine' then 'plum'
                   when 'beer' then 'lemon' when 'shop' then 'teal' else 'sage' end,
       coalesce((select max(g.sort_order) from public.genres g where g.user_id = cc.user_id), 0) + cc.sort_order
from public.clip_categories cc
where cc.key <> 'other'
on conflict (user_id, name) do nothing;

-- 2) ネタに、カテゴリと同じ名前のジャンルを付ける（「その他」は「ジャンルなし」のまま）
update public.clips c set genre_id = g.id
from public.clip_categories cc
join public.genres g on g.user_id = cc.user_id and g.name = cc.name
where c.user_id = cc.user_id and c.category = cc.key and cc.key <> 'other' and c.genre_id is null;

-- 3) 他人のジャンルをネタに付けられないように（レシピと同じ見張りを clips にも）
create or replace function public.check_same_user_refs() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'menu_log_items' then
    if not exists (select 1 from public.recipes r where r.id = new.recipe_id and r.user_id = new.user_id) then raise exception 'recipe belongs to another user' using errcode = 'P0001'; end if;
    if not exists (select 1 from public.menu_logs l where l.id = new.menu_log_id and l.user_id = new.user_id) then raise exception 'menu log belongs to another user' using errcode = 'P0001'; end if;
  elsif tg_table_name = 'recipes' then
    if new.genre_id is not null and not exists (select 1 from public.genres g where g.id = new.genre_id and g.user_id = new.user_id) then raise exception 'genre belongs to another user' using errcode = 'P0001'; end if;
    if new.family_id is not null and not exists (select 1 from public.recipes r where r.id = new.family_id and r.user_id = new.user_id) then raise exception 'family belongs to another user' using errcode = 'P0001'; end if;
    if new.source_clip_id is not null and not exists (select 1 from public.clips c where c.id = new.source_clip_id and c.user_id = new.user_id) then raise exception 'clip belongs to another user' using errcode = 'P0001'; end if;
  elsif tg_table_name = 'clips' then
    if new.genre_id is not null and not exists (select 1 from public.genres g where g.id = new.genre_id and g.user_id = new.user_id) then raise exception 'genre belongs to another user' using errcode = 'P0001'; end if;
  elsif tg_table_name = 'ai_preferences' then
    if new.source_job_id is not null and not exists (select 1 from public.ai_jobs j where j.id = new.source_job_id and j.user_id = new.user_id) then raise exception 'job belongs to another user' using errcode = 'P0001'; end if;
  end if;
  return new;
end $$;
revoke execute on function public.check_same_user_refs() from public, anon, authenticated;
drop trigger if exists clips_same_user on public.clips;
create trigger clips_same_user before insert or update of genre_id on public.clips for each row execute function public.check_same_user_refs();
