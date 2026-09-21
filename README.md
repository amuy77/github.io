# Review Inbox — Airbnb / Booking.com レビュー管理 PWA

Gmail に届く Airbnb と Booking.com の通知メールを自動で仕分けし、
「ゲストへのレビュー投稿」「公開レビューへの返信」「ゲストメッセージ」を
期限つきで管理するスマホ向けアプリです。サーバー不要、GitHub Pages でそのまま動きます。

## できること

- **自動分類**: 差出人と件名・本文から次の種類に振り分けます
  - レビュー公開(星の数・本文・「特に感謝していること」を抽出)
  - レビュー到着(未公開)/ レビュー期限リマインド(残り時間を抽出)/ レビュー投稿依頼
  - ゲストメッセージ / 問い合わせ / 予約確定 / キャンセル / 入金 / 請求 / 宣伝
- **レビュー案件の集約**: 同じゲスト・同じ滞在の通知を 1 枚のカードにまとめ、
  「要投稿(期限つき)」→「返信推奨」→「完了」の流れで管理
- **期限管理**: Airbnb のリマインドメールの「残りあと N 時間」を使い、
  なければチェックアウト + 14 日で期限を計算。48 時間以内は赤表示、アプリアイコンにバッジ
- **文例**: レビュー文・返信文(日英併記)をワンタップで生成し、編集・コピー
- **取り込み方法は 3 つ**
  1. Gmail API と接続して「同期」(推奨)
  2. Android: 共有メニューからこのアプリを選ぶ(Web Share Target)
  3. 手動で件名・本文を貼り付け
- **データは端末内だけ**: localStorage に保存。JSON で書き出し・読み込み可

## セットアップ

### 1. GitHub Pages を有効にする

リポジトリの Settings → Pages → Branch を公開したいブランチ、フォルダを `/ (root)` にして保存。
公開 URL は `https://<ユーザー名>.github.io/<リポジトリ名>/` になります。

### 2. Gmail 連携(初回のみ・5 分)

1. [Google Cloud Console](https://console.cloud.google.com/apis/library/gmail.googleapis.com) でプロジェクトを作り、Gmail API を有効化
2. 「OAuth 同意画面」→ 外部 → アプリ名を入力 → テストユーザーに自分の Gmail を追加
3. 「認証情報」→「OAuth クライアント ID」→ 種類「ウェブ アプリケーション」
4. 「承認済みの JavaScript 生成元」に公開 URL のオリジン(例 `https://example.github.io`)を追加
5. 発行されたクライアント ID をアプリの「設定」タブに貼って保存 →「Gmail と接続」→「同期」

権限は `gmail.readonly`(読み取り専用)のみ。メールはブラウザ内で解析され、外部には送信されません。
アクセストークンはメモリにだけ保持し、約 1 時間で失効します(再接続で更新)。

### 3. スマホにインストール

- Android(Chrome): メニュー →「ホーム画面に追加」。以後、Gmail などの共有シートからこのアプリへ通知本文を送れます
- iPhone(Safari): 共有ボタン →「ホーム画面に追加」。共有ターゲットは非対応なので「追加」タブに貼り付け

> スマホの通知そのものは Web アプリから読めないため、通知の元になっている Gmail を同期する方式です。

## 開発

```bash
npm test            # 分類エンジンのテスト(node --test)
python3 -m http.server 8080   # ローカルで動作確認 → http://localhost:8080/
```

構成:

| ファイル | 役割 |
| --- | --- |
| `js/classifier.js` | メール → 種類/ゲスト/物件/滞在日/評価/期限の抽出、案件への集約(純粋関数) |
| `js/gmail.js` | Google Identity Services + Gmail API(一覧取得・本文デコード) |
| `js/templates.js` | レビュー文・返信文の文例 |
| `js/store.js` | localStorage 永続化、書き出し/読み込み |
| `js/app.js` | 画面(レビュー / 受信箱 / 追加 / 設定)、同期、共有ターゲット |
| `sw.js`, `manifest.webmanifest` | オフライン対応と PWA インストール、share_target |
| `tests/classifier.test.js` | 実際の通知メール形式を元にしたフィクスチャでの回帰テスト |

### 分類ルールを増やすには

`js/classifier.js` の `classifyAirbnb` / `classifyBooking` に件名の正規表現を追加し、
`tests/classifier.test.js` にフィクスチャを足してください。
Booking.com のクチコミ通知は受信サンプルが少ないため、件名に「クチコミ / レビュー / review」を含む
booking.com 発のメールを広めに拾う設計です。受信箱の種類セレクトで手動修正もできます。
