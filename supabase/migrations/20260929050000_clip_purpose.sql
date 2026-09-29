-- ネタ帳の用途: 自分のアイデア（idea）か、参考にしたいもの（reference）か。まだ仕分けていないものは unsorted
alter table public.clips add column if not exists purpose text not null default 'unsorted'
  check (purpose in ('idea', 'reference', 'unsorted'));
create index if not exists clips_user_purpose_idx on public.clips(user_id, purpose, created_at desc);
-- ひらめき（付箋）は最初からアイデア
update public.clips set purpose = 'idea' where type = 'idea' and purpose = 'unsorted';
