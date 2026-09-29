-- ジャンルのアイコン（絵文字）。空なら名前から自動で選ぶ
alter table public.genres add column if not exists emoji text not null default '' check (length(emoji) <= 16);
