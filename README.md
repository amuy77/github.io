# LaRa 店主ノート

サンドイッチ＆ドリンクカフェ **LaRa** の管理アプリ。iPhone と Mac の両方で使える PWA（ホーム画面に追加できる Web アプリ）。

- 🏠 **3D のお店ホーム** — 小さなジオラマのお店。小物をタップして各機能へ。レシピや記録が増えるとお店が育つ
- 📌 **ネタ帳** — 気になったお店のメニュー写真、SNS の投稿、ワイン・ビール・コーヒーのメモ
- 📖 **レシピ図鑑** — ジャンル別のレシピカード。写真は AI（Claude Code の定期実行）がカード化して受信トレイに届ける
- 🗓️ **メニュー記録** — 日別のメニュー、週・月の構成比、AI 相棒の週次コメント

公開 URL: https://amuy77.github.io/github.io/

## 開発

```bash
npm ci
npm run dev        # http://localhost:5173/github.io/
npm run typecheck
npm run lint
npm test           # 単体テスト（日付・連続記録・服・セリフ・レシピの読み取り・集計）。数秒
npm run gen:icons  # public/brand/lara.png から PWA アイコンを生成
```

画面のスモークテスト（Playwright。Supabase は route でスタブするので、**スタブ用の URL でビルドする**こと）:

```bash
VITE_SUPABASE_URL=https://lara-smoke.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_smoke npm run build
npm run preview    # http://127.0.0.1:4173/github.io/ を別ターミナルで
npm run smoke      # phone / desktop の 2 プロジェクトで全部走る（10 分弱）。-g '<テスト名>' で絞れる
```

CI（`.github/workflows/deploy.yml`）は push のたびに typecheck・lint・単体テスト・ビルドと、スモークテストを並行して走らせ、全部通ったときだけ `main` を公開する。

## 構成

- `src/` — Vite + React 19 + TypeScript + Tailwind v4。`features/` に機能ごと、`components/ui/` に共通部品
- `src/features/home/shop3d/` — three.js のお店ジオラマ
- `supabase/migrations/` — DB スキーマ（RLS 込み）。`supabase/functions/link-preview` — URL プレビュー取得
- `src/features/planner/` — 兄弟アプリ Planner（予定・ToDo、https://planner-mu-lovat.vercel.app）との連携。ログイン中のアクセストークンで Planner の `GET /api/v1/agenda?date=` を読み、ホームのひとこと・案内カードと「今日の予定は？」の返事に使う（同じ Supabase・同じアカウントなので本人の分だけ読める。Planner 側は CORS で `https://amuy77.github.io` だけ許可）。届かないときは何も出さない
- `src/characters/` — キャラの名簿（LaRa と、幼なじみの LuRu）。友達は `role: 'friend'` で、設定の「LaRa の友達」に並び、昼間（10〜20 時）にホームの 3D のお店へ遊びに来る（LaRa を「わっ！」と驚かせて、しばらく遊んで帰る。セリフは `luru/lines.ts`、宮崎弁）。3D の体は `laraFigure.ts` の `FigureKind`（体・仕草は共通で、頭・顔・しっぽだけ変える）。LuRu の透過画像は `node scripts/luru-cutout.mjs` で `public/brand/luru-source.jpg` から作る。新しい友達の足し方は `src/characters/index.ts` の先頭
- `routines/` — Claude Code Routine（AI 裏方）のプロンプト
- `.github/workflows/deploy.yml` — GitHub Pages への自動デプロイ

## 初回セットアップ（1 回だけ）

1. Supabase プロジェクトを作り、`.env` に `VITE_SUPABASE_URL` と `VITE_SUPABASE_PUBLISHABLE_KEY` を入れる
2. `supabase/migrations/20260927000000_init.sql` を適用（`allowed_emails` に登録したメールだけがサインアップできる）
3. GitHub → Settings → Pages → Source を **GitHub Actions** にする
4. `main` に push するとデプロイされる。iPhone の Safari で開いて「ホーム画面に追加」
