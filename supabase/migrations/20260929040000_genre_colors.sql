-- ジャンルの色を 5 色から 18 色へ（src/lib/genreColors.ts と同じ並び）
alter table public.genres drop constraint if exists genres_color_check;
alter table public.genres add constraint genres_color_check check (color in (
  'green','sage','olive','teal','sky','navy','plum','lavender','rose',
  'brick','coral','orange','mustard','lemon','wood','cocoa','charcoal','stone'));
