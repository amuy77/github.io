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
npm run build && npm run preview   # http://127.0.0.1:4173/github.io/
npm run smoke      # preview を起動した状態で（Supabase はスタブ）
npm run gen:icons  # public/brand/lara.png から PWA アイコンを生成
```

## 構成

- `src/` — Vite + React 19 + TypeScript + Tailwind v4。`features/` に機能ごと、`components/ui/` に共通部品
- `src/features/home/shop3d/` — three.js のお店ジオラマ
- `supabase/migrations/` — DB スキーマ（RLS 込み）。`supabase/functions/link-preview` — URL プレビュー取得
- `src/features/planner/` — 兄弟アプリ Planner（予定・ToDo、https://planner-mu-lovat.vercel.app）との連携。ログイン中のアクセストークンで Planner の `GET /api/v1/agenda?date=` を読み、ホームのひとこと・案内カードと「今日の予定は？」の返事に使う（同じ Supabase・同じアカウントなので本人の分だけ読める。Planner 側は CORS で `https://amuy77.github.io` だけ許可）。届かないときは何も出さない
- `routines/` — Claude Code Routine（AI 裏方）のプロンプト
- `.github/workflows/deploy.yml` — GitHub Pages への自動デプロイ

## 初回セットアップ（1 回だけ）

1. Supabase プロジェクトを作り、`.env` に `VITE_SUPABASE_URL` と `VITE_SUPABASE_PUBLISHABLE_KEY` を入れる
2. `supabase/migrations/20260927000000_init.sql` を適用（`allowed_emails` に登録したメールだけがサインアップできる）
3. GitHub → Settings → Pages → Source を **GitHub Actions** にする
4. `main` に push するとデプロイされる。iPhone の Safari で開いて「ホーム画面に追加」
