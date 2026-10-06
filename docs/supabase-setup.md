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

オーナーの選択で **A: LaRa をこの URL で公開し、タブ置き場は `/github.io/tabs/` に同居させる** ことにした。

- タブ置き場の `index.html` と `icon.png` を `public/tabs/` にコピーした。ビルド後は `https://amuy77.github.io/github.io/tabs/` で開ける。データは `localStorage`（同じオリジン）なので、そのまま引き継がれる
- LaRa の Service Worker がタブ置き場をキャッシュしたり画面を横取りしたりしないよう、`vite.config.ts` の workbox に `globIgnores: ['tabs/**']` と `navigateFallbackDenylist: [/\/tabs\//]` を追加した
- `claude/lara-management-app-ny75zm` を `main` にマージすると、Actions が `dist/` を Pages にデプロイする。リポジトリの Settings → Pages の Source が「Deploy from a branch」のままだとデプロイが失敗するので、その場合は「GitHub Actions」に切り替える
- iPhone のホーム画面にタブ置き場を追加していた場合、そのアイコンは LaRa を開くようになる。タブ置き場は `/github.io/tabs/` から追加し直す

公開できたら:

1. 公開 URL を開き、`take2it4easy5@gmail.com` とパスワードでサインアップする（メール確認は不要。すぐログインできる）
2. 初回ログイン時に初期ジャンル 4 件が自動で入っている
3. 他のメールアドレスは `allowed_emails` に無い限りサインアップできない。追加したいときは SQL で `insert into public.allowed_emails (email) values ('…')`

Dashboard で確認したい場合: <https://supabase.com/dashboard/project/bzwwprtctvwinkesdfks>

## 追加（2026-10-09）: 材料の仕入れ値（原価・粗利）

- マイグレーション `20261009000000_ingredient_prices.sql` を **SQL エディタで実行する**。
  `ingredient_prices`（材料名・仕入れの量と単位・値段）を追加。データは人ごと。レシピの原価・原価率・粗利と、分析の粗利に使う。
  流す前は原価の欄が出ないだけ（アプリは今まで通り動く）。

## 追加（2026-10-08）: 段階 1（価格・お店とメンバー）

- マイグレーション `20261008000000_stage1_price_shop.sql` を **SQL エディタで実行する**（アプリの更新より先に）。
  - `recipes.price`（税込・円）を追加。お店のメニューの編集画面で入れると、分析に売上が出る。
  - `shops` / `shop_members` を追加し、いまいる人を 1 つのお店（LaRa）のメンバーに（許可リストで「オーナー」の人がオーナー）。データ（ネタ・レシピ・記録）は今まで通り人ごとに別々。
  - これから登録する人（許可リストにいる人）も自動でそのお店に入る。
- 何度流しても同じ結果。DELETE はしない。

## 追加（2026-10-07）: レシピの種類に「アイデア」

- マイグレーション `20261007000000_recipe_purpose_idea.sql` を **SQL エディタで実行する**（アプリの更新より先に）。
  `recipes.purpose` に `'idea'` を足すだけ（データは変えない）。お店のメニューはノートの「メニュー」タブに、図鑑は アイデア／参考／未分類 になる。
  当てる前に「アイデア」で保存すると「SQL の実行がまだみたい」と出る。

## 追加（2026-10-06）: ネタ帳のカテゴリを「ジャンル」に統一

- マイグレーション `20261006000000_clip_genres.sql` を **SQL エディタで実行する**（アプリの更新より先に）。
  ネタに `genre_id` が付き、今までのネタ帳のカテゴリ（その他を除く）がジャンルに移る（同じ名前はまとめる）。各ネタも同じ名前のジャンルに付け替わる。
  `clip_categories` と `clips.category` は消さずに残してある（使わなくなるだけ）。何度流しても同じ結果。
- Edge Function `lara-chat` も更新あり（ネタのジャンル名を読む）: SQL を流した **あとで** `supabase functions deploy lara-chat`（任意。しなくても今まで通り動く）

## 追加（2026-10-05）: 書き込みを DB 関数に・他人の行を指せないように

- マイグレーション `20261005000000_atomic_writes.sql` を **SQL エディタで実行する**。
  メニュー記録の保存・レシピ削除・採用中の切り替え・カテゴリ削除・並び替えが DB 関数 1 回になる（途中で止まって不整合、が無くなる）。
  当てる前でもアプリは今までのやり方で動く（関数が無ければ自動で戻る）。
  同時に、他人のレシピやジャンルを自分の行から指せないチェック（2 人目を迎える準備）と、`activity_days` の日付のずれも直る。
- Edge Function `link-preview` と `lara-chat` も更新あり（DNS の検査強化、エラー文面）: `supabase functions deploy link-preview` / `lara-chat`

## 2 人目を足す（彩加さん）

データは最初から「ログインした本人の分しか見えない」（RLS）ので、同じアプリ・同じプロジェクトのまま、アカウントを足すだけでよい。

1. SQL エディタで許可リストに入れる: `insert into public.allowed_emails (email, note) values ('<彩加さんのメール>', '彩加') on conflict do nothing;`
2. 本人が公開 URL を開いて「はじめての登録」→ ジャンル・カテゴリ入りの空っぽのお店ができる（ネタ帳・図鑑・記録・写真は完全に別）
3. Planner も同じメールで登録すれば、ホームの「今日の予定」も本人の分が出る
4. AI の裏方（Routine）はジョブの `user_id` ごとに処理するので、本人の写真も届く（`routines/ai-worker.md`）
5. 店名やキャラは共通。本人用に変えたくなったら「プロフィール設定」として別途

## 追加（2026-10-04）: 写真バケットの一覧を非公開に

- マイグレーション `20261004000000_photos_select_own.sql` を **SQL エディタで実行する**（Dashboard → SQL Editor に貼り付けて Run）。
  `photos_select_public`（誰でも `storage.list()` で全パスが取れていた）を外し、本人の prefix だけ SELECT できるようにする。
  写真の URL（`/object/public/…`）は public バケットなので今まで通り見える。当てるまでアプリは今まで通り動く。
- Edge Function `lara-chat` も更新あり（レシピを新しい順に読む）: `supabase functions deploy lara-chat`

## 追加（2026-09-28）: 確認画面・★評価・レシピの版・LaRa に聞く

- マイグレーション `20260928010000_review_rating_versions.sql` を適用済み（`clips.rating` / `clips.needs_review`、`recipes.rating` / `family_id` / `variant_label` / `is_main`、`ai_jobs.kind` に `consult`）
- Edge Function `lara-chat` をデプロイ済み（`verify_jwt = true`）。Claude API（`claude-opus-5`、effort medium、プロンプトキャッシュあり）で、呼び出した本人のレシピとネタだけを読んで答える
- **リアルタイムの「LaRa に聞く」には Claude API キーが必要（未設定）。** 未設定のあいだは、アプリが相談を `ai_jobs`（`consult`）に預け、定期処理（8:00〜23:00 の毎時）が答えて受信トレイに返す
- キーを入れる手順: Anthropic Console（https://console.anthropic.com）で API キーを作る → Supabase ダッシュボード → Edge Functions → Secrets に `ANTHROPIC_API_KEY` を追加。再デプロイ不要
- 料金の目安: 相談 1 回あたり数円〜十数円（データ量と回答の長さで変わる）。Console で月の上限を設定しておくと安心
