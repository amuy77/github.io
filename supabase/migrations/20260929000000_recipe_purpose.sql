-- レシピの用途: お店で出す確定メニュー（menu）か、参考にしたいレシピ（reference）か。
-- AI が本や他店から起こしたものは参考が基本なので、既定は reference。手入力はアプリ側で menu を既定にする。
alter table public.recipes add column if not exists purpose text not null default 'reference'
  check (purpose in ('menu', 'reference'));
create index if not exists recipes_user_purpose_idx on public.recipes(user_id, purpose, created_at desc);
