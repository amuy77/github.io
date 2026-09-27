# LaRa Supabase 本番セットアップ記録

実施日: 2026-09-27（JST 2026-09-28 未明）
対象プロジェクト: `bzwwprtctvwinkesdfks`（Region: Tokyo）
URL: `https://bzwwprtctvwinkesdfks.supabase.co`

すべて Supabase Management API（`curl`）と Supabase CLI（`npx supabase@latest`）だけで行いました。
Dashboard の手作業はゼロです。秘密の値（アクセストークン、`service_role` / `sb_secret_` キー）はどこにも書いていません。

## やったこと

| # | 作業 | 結果 |
|---|------|------|
| 1 | Management API 疎通確認（`GET /v1/projects/…`） | OK（200） |
| 2 | `supabase/migrations/20260927000000_init.sql` を `database/query` で一括適用 | OK。public に 8 テーブル、`photos` バケット（public / 5 MB / jpeg・png・webp）、全テーブル RLS 有効 |
| 3 | Auth 設定（`PATCH /config/auth`） | OK。`mailer_autoconfirm=true`、`site_url=https://amuy77.github.io/github.io/`、リダイレクト許可 = 公開 URL + `localhost:5173` + `127.0.0.1:4173` |
| 4 | Edge Function `link-preview` を `functions deploy --use-api` でデプロイ | OK。`ACTIVE`、`verify_jwt=true`、version 1 |
| 5 | API キー取得 | publishable キー（`sb_publishable_…`）を取得 |
| 6 | `.env` 更新 | `VITE_SUPABASE_URL` と `VITE_SUPABASE_PUBLISHABLE_KEY` を記入 |
| 7 | 本番プロジェクトでのスモークテスト（下記） | すべて OK。テストユーザーは削除済み |
| 8 | セキュリティ確認（Security Advisor + `pg_policies`） | WARN 3 件をマイグレーションに 3 行追記して解消。残りは想定内の INFO 1 件 |
| 9 | `npm ci` → `npm run typecheck` → `npm run build` | OK。バンドルに本番 URL が焼き込まれていることを確認 |

`.env` の中身（公開してよい値のみ）:

```
VITE_SUPABASE_URL=https://bzwwprtctvwinkesdfks.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_OOcz5nBTO7X8dVHrHtBizQ_DBia_AW-
```

## スモークテスト結果

テスト用メール `lara-smoke@example.com` を `allowed_emails` に一時登録して実施。オーナーのアカウントは作っていません。

| テスト | 期待 | 結果 |
|--------|------|------|
| 許可リストにあるメールでサインアップ | `access_token` と `user.id` が返る | OK（200） |
| 許可リストに無いメール（`nobody@example.com`）でサインアップ | 拒否される | OK（トリガーが `P0001 email not allowed` で拒否。HTTP は 500 で返る） |
| `POST /rest/v1/clips`（JWT 付き） | 201 | OK |
| `GET /rest/v1/genres` | 初期ジャンル 4 件（コーヒー / アメリカンサンド / クロワッサンサンド / ベバレッジ） | OK。順序も `sort_order` どおり |
| `POST /rest/v1/rpc/activity_days` (`since=2026-01-01`) | 今日の日付（JST） | OK（`2026-09-28`） |
| JWT なしで `GET /rest/v1/clips` | 何も見えない | OK（空配列） |
| Storage: 自分の prefix へ 1×1 PNG をアップロード | 200 | OK |
| Storage: 認証なしで public URL を取得 | 200 / `image/png` | OK |
| Storage: 他人の prefix へアップロード | 拒否 | OK（RLS 違反で `AccessDenied`） |
| Edge Function `OPTIONS`（`Origin: https://amuy77.github.io`） | 2xx + CORS ヘッダ | OK（200、`access-control-allow-origin` が Origin を返す） |
| Edge Function `POST` JWT なし | 401 | OK |
| Edge Function `POST` `{"url":"https://example.com"}` | 200 + `title` | OK（`"Example Domain"`） |
| Edge Function `POST` `{"url":"http://169.254.169.254/"}` | 400 系 `URL_BLOCKED` | OK（400） |
| `updated_at` トリガー（genres を PATCH） | `updated_at > created_at` | OK |
| 後片付け | `auth.users` 0 件、Storage 0 件、`allowed_emails` はオーナー 1 件 | OK |

## マイグレーションへの変更点（1 か所）

Security Advisor が WARN を 3 種類出したので、`supabase/migrations/20260927000000_init.sql` の末尾に次の 3 行を追記しました。動作は変わりません（トリガーの発火に EXECUTE 権限は不要）。追記後にファイル全体を再適用し、サインアップ・初期ジャンル投入・`updated_at` 更新が引き続き動くことを再テストしました。

```sql
alter function public.set_updated_at() set search_path = '';
revoke execute on function public.check_allowed_email() from public, anon, authenticated;
revoke execute on function public.seed_default_genres() from public, anon, authenticated;
```

- `function_search_path_mutable`（`set_updated_at`）→ 解消
- `anon/authenticated_security_definer_function_executable`（`check_allowed_email`, `seed_default_genres`）→ 解消。`/rest/v1/rpc/seed_default_genres` は 404 になることを確認
- 残る `rls_enabled_no_policy`（`allowed_emails`）は INFO で、設計どおり（API からは一切見えない）

Performance Advisor は INFO のみ（FK の未インデックス 3 件、未使用インデックス 4 件）。データが無い今は対応不要です。

## RLS ポリシー一覧（確認済み）

- `public.genres / clips / recipes / menu_logs / menu_log_items / ai_jobs / ai_insights`: それぞれ select / insert / update / delete の 4 本（`auth.uid() = user_id`）
- `public.allowed_emails`: RLS 有効・ポリシー無し（意図どおり）
- `storage.objects`: `photos_select_public`（誰でも読める）、`photos_insert_own` / `photos_update_own` / `photos_delete_own`（自分の UUID prefix のみ）

## 困ったこと・気づき

- 許可リスト外のサインアップは、Auth サーバーがトリガーの例外をそのまま 500 で返します。拒否自体は確実ですが、UI 側で「このメールは使えません」と出したい場合は 500 も拒否として扱う必要があります。
- `activity_days` は JST 基準なので、UTC の深夜に実行すると翌日の日付が返ります（今回がそれ。仕様どおり）。
- それ以外は SQL・Edge Function・設定ともに一発で通りました。

## オーナーが次にやること

**注意: 2026-09-27 時点で LaRa はまだ公開されていない。** 公開 URL `https://amuy77.github.io/github.io/` には、以前作った「タブ置き場」（ブランチ `claude/safari-page-manager-gardrk` の `index.html`）が表示される。
`.github/workflows/deploy.yml` は feature ブランチではビルドだけ行い、Pages へのデプロイは `main` に push されたときだけ実行する設計。LaRa のブランチはまだ `main` にマージされていない。

公開するには次のどちらかを選ぶ:

- **A. LaRa をこの URL で公開する**: `claude/lara-management-app-ny75zm` を `main` にマージする。Actions が `dist/` を Pages にデプロイする。リポジトリの Settings → Pages の Source が「Deploy from a branch」になっていたら「GitHub Actions」に切り替える。この場合タブ置き場は同じ URL から消えるので、残したければ LaRa の `public/` 配下（例: `public/tabs/index.html` → `/github.io/tabs/`）に移す
- **B. タブ置き場をこのまま残す**: LaRa は別リポジトリ（例: `amuy77/lara`）で公開する。その場合は Supabase の Auth 設定（`site_url` と `uri_allow_list`）と `vite.config` の `base` を新しい URL に合わせて更新する

公開できたら:

1. 公開 URL を開き、`take2it4easy5@gmail.com` とパスワードでサインアップする（メール確認は不要。すぐログインできる）
2. 初回ログイン時に初期ジャンル 4 件が自動で入っている
3. 他のメールアドレスは `allowed_emails` に無い限りサインアップできない。追加したいときは SQL で `insert into public.allowed_emails (email) values ('…')`

Dashboard で確認したい場合: <https://supabase.com/dashboard/project/bzwwprtctvwinkesdfks>
