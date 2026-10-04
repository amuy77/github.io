-- 写真バケットの「一覧」を公開しない。
-- 'photos' は public バケットなので、/storage/v1/object/public/… の配信にはポリシーが要らない。
-- ところが init.sql の photos_select_public（to public）があると、公開キーだけで storage.list() が通って
-- 全部のパスが取れてしまい、「URL は UUID だから推測できない」という前提が崩れる。
-- 本人の prefix だけ SELECT できるようにする（remove() は SELECT も要るので、これが無いと自分の写真を消せなくなる）。
drop policy if exists "photos_select_public" on storage.objects;
drop policy if exists "photos_select_own" on storage.objects;
create policy "photos_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid()::text));
