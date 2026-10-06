-- 新しく登録した人のジャンルを、最初から空にする（自分で一から作る）。
-- 1) これから登録する人には、最初のジャンル・ネタ帳のカテゴリを入れない（関数を「何もしない」に置き換える）
create or replace function public.seed_default_genres() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  return new;
end $$;
create or replace function public.seed_default_clip_categories() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  return new;
end $$;

-- 2) オーナー（侑磨）以外の人のジャンルと、昔のネタ帳のカテゴリを消して空にする（今は彩加さんだけ）。
--    ジャンルを付けていたネタ・レシピは「ジャンルなし」になるだけで、消えない。侑磨のデータには触らない
delete from public.genres
where user_id <> (select id from auth.users where lower(email) = 'take2it4easy5@gmail.com');
delete from public.clip_categories
where user_id <> (select id from auth.users where lower(email) = 'take2it4easy5@gmail.com');
