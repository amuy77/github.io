-- ===== 多段の書き込みを DB 関数 1 本に（途中で止まって不整合、を無くす） =====
-- どれも security invoker: 呼んだ本人の権限で動くので RLS が今まで通り効く。アプリは関数が無ければ今までのやり方に自動で戻る。

-- 日別のメニュー記録を保存（無ければ作る）。items は全置き換え: [{recipe_id, sold_count}]
create or replace function public.save_menu_log(p_date date, p_note text, p_items jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.menu_logs (user_id, log_date, note) values ((select auth.uid()), p_date, coalesce(p_note, ''))
  on conflict (user_id, log_date) do update set note = excluded.note
  returning id into v_id;
  delete from public.menu_log_items i
  where i.menu_log_id = v_id and not exists (select 1 from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e where (e->>'recipe_id')::uuid = i.recipe_id);
  insert into public.menu_log_items (user_id, menu_log_id, recipe_id, sold_count)
  select (select auth.uid()), v_id, (e->>'recipe_id')::uuid, nullif(e->>'sold_count', '')::int
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e
  on conflict (menu_log_id, recipe_id) do update set sold_count = excluded.sold_count;
  return v_id;
end $$;
grant execute on function public.save_menu_log(date, text, jsonb) to authenticated;

-- グループの「採用中」を 1 件にする（p_main が null なら全部外す）
create or replace function public.set_main_recipe(p_ids uuid[], p_main uuid) returns void
language sql security invoker set search_path = '' as $$
  update public.recipes set is_main = (id = p_main) where id = any(p_ids) and user_id = (select auth.uid());
$$;
grant execute on function public.set_main_recipe(uuid[], uuid) to authenticated;

-- レシピを消す。グループの先頭を消すときは、次に古い版を新しい先頭にしてグループを保つ
create or replace function public.delete_recipe(p_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare v_head uuid;
begin
  select id into v_head from public.recipes where family_id = p_id and user_id = (select auth.uid()) order by created_at limit 1;
  if v_head is not null then
    update public.recipes set family_id = null where id = v_head;
    update public.recipes set family_id = v_head where family_id = p_id and id <> v_head and user_id = (select auth.uid());
  end if;
  delete from public.recipes where id = p_id and user_id = (select auth.uid());
end $$;
grant execute on function public.delete_recipe(uuid) to authenticated;

-- ネタ帳のカテゴリを消す。そのカテゴリのネタは「その他」へ
create or replace function public.delete_clip_category(p_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare v_key text;
begin
  select key into v_key from public.clip_categories where id = p_id and user_id = (select auth.uid());
  if v_key is null then return; end if;
  if v_key = 'other' then raise exception 'cannot delete the fallback category' using errcode = 'P0001'; end if;
  update public.clips set category = 'other' where category = v_key and user_id = (select auth.uid());
  delete from public.clip_categories where id = p_id and user_id = (select auth.uid());
end $$;
grant execute on function public.delete_clip_category(uuid) to authenticated;

-- 並び替え（渡した順に sort_order 1, 2, 3…）
create or replace function public.reorder_genres(p_ids uuid[]) returns void
language sql security invoker set search_path = '' as $$
  update public.genres g set sort_order = o.n from unnest(p_ids) with ordinality as o(id, n) where g.id = o.id and g.user_id = (select auth.uid());
$$;
grant execute on function public.reorder_genres(uuid[]) to authenticated;

create or replace function public.reorder_clip_categories(p_ids uuid[]) returns void
language sql security invoker set search_path = '' as $$
  update public.clip_categories c set sort_order = o.n from unnest(p_ids) with ordinality as o(id, n) where c.id = o.id and c.user_id = (select auth.uid());
$$;
grant execute on function public.reorder_clip_categories(uuid[]) to authenticated;

-- ===== 他人の行を指せないように（RLS は「見える行」を絞るが、id を知っていれば他人の行を参照に入れられた） =====
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
  elsif tg_table_name = 'ai_preferences' then
    if new.source_job_id is not null and not exists (select 1 from public.ai_jobs j where j.id = new.source_job_id and j.user_id = new.user_id) then raise exception 'job belongs to another user' using errcode = 'P0001'; end if;
  end if;
  return new;
end $$;
revoke execute on function public.check_same_user_refs() from public, anon, authenticated;
drop trigger if exists menu_log_items_same_user on public.menu_log_items;
create trigger menu_log_items_same_user before insert or update on public.menu_log_items for each row execute function public.check_same_user_refs();
drop trigger if exists recipes_same_user on public.recipes;
create trigger recipes_same_user before insert or update on public.recipes for each row execute function public.check_same_user_refs();
drop trigger if exists ai_preferences_same_user on public.ai_preferences;
create trigger ai_preferences_same_user before insert or update on public.ai_preferences for each row execute function public.check_same_user_refs();

-- ===== activity_days: 「since 以降」の比較も日本時間の日付で（UTC の深夜 0〜9 時がずれていた） =====
create or replace function public.activity_days(since date) returns setof date
language sql stable security invoker set search_path = '' as $$
  select distinct d from (
    select (created_at at time zone 'Asia/Tokyo')::date as d from public.clips where (created_at at time zone 'Asia/Tokyo')::date >= since
    union all select (created_at at time zone 'Asia/Tokyo')::date from public.recipes where (created_at at time zone 'Asia/Tokyo')::date >= since and status = 'published'
    union all select log_date from public.menu_logs where log_date >= since
  ) x order by 1
$$;
