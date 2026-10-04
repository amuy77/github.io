# AI 裏方（Routine）の権限をしぼる — 裏方専用の DB ユーザー

## なぜ
今の Routine は Management API のアクセストークンで SQL を実行している。これはプロジェクトの**管理者権限**で、RLS も通らない。
Routine が読む写真や Web ページに「〜を削除しろ」のような指示が紛れ込んでも（プロンプト注入）、手順書で禁じている以外の
歯止めが無い。**裏方専用の DB ユーザー**を作って「触っていい表と操作」を DB 側で決めておけば、何が紛れ込んでも
それ以上のことはできない。

## 1. 専用ユーザーを作る（SQL Editor で 1 回）
`<PASSWORD>` を長いランダムな文字列に置き換えてから実行（1Password などで作る。SQL は実行後に閉じる）。

```sql
-- ロール（RLS は通さない: 許可した表の全ユーザー分を扱う。表と操作は下の grant で絞る）
create role lara_worker login password '<PASSWORD>' bypassrls;
grant usage on schema public to lara_worker;

-- 読む
grant select on public.ai_jobs, public.ai_preferences, public.recipes, public.clips, public.clip_categories,
  public.genres, public.menu_logs, public.menu_log_items, public.ai_insights to lara_worker;
-- 書く（手順書に書かれた範囲）
grant insert, update on public.ai_jobs, public.recipes, public.clips, public.ai_preferences, public.ai_insights to lara_worker;
-- redo で作り直したときの、対象 1 件だけの delete
grant delete on public.recipes, public.clips to lara_worker;
-- 既定値（gen_random_uuid など）とシーケンスのため
grant usage on all sequences in schema public to lara_worker;

-- 念のため、それ以外には何もできないことを確認
select grantee, table_name, string_agg(privilege_type, ',') from information_schema.role_table_grants
where grantee = 'lara_worker' group by 1, 2 order by 2;
```

やり直すとき: `drop role lara_worker;`（権限を先に外す必要があれば `drop owned by lara_worker;`）。

## 2. 接続文字列を取る
Dashboard → **Connect**（上のボタン）→ **Session pooler** の URI をコピーして、`[YOUR-PASSWORD]` を上のパスワードに、
ユーザー名 `postgres.<ref>` を `lara_worker.<ref>` に変える。例:

```
postgresql://lara_worker.bzwwprtctvwinkesdfks:<PASSWORD>@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres
```

手元の Mac で確認（psql があれば）:
```
psql "postgresql://lara_worker.…" -c "select count(*) from public.ai_jobs"
psql "postgresql://lara_worker.…" -c "delete from public.genres"   # permission denied になれば OK
```

## 3. Routine に渡す
Claude Code の環境（Routine が動く環境）の **環境変数** に `LARA_WORKER_DB_URL` = 上の接続文字列を入れる。
`SUPABASE_ACCESS_TOKEN` はこの時点ではまだ消さない。

## 4. 手順書を切り替える
`routines/ai-worker.md` の「SQL の実行方法」のヘルパー（`/tmp/sq.sh`、Management API に curl）を、
`routines/sq-psql.sh` の中身に差し替える（select は JSON の行配列で返るので、以降の SQL はそのまま使える）。
`update_trigger` で Routine 2 つ（一次・精読）のプロンプトを更新 → 次の毎時の実行ログで、ジョブが今まで通り処理されることを確認。

## 5. 古い鍵を外す
数回うまく動いたら、Routine の環境変数から `SUPABASE_ACCESS_TOKEN` を消し、Supabase の Account → Access Tokens で
そのトークンを revoke する。これで裏方は「許可した表と操作」以外に手が届かなくなる。
