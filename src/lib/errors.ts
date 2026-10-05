/**
 * エラーを店主向けのひとことにする。Supabase や fetch のメッセージは英語なのでそのまま出さない。
 * 同じ失敗はどこで起きても同じ文面になるので、トーストの重複よけ（同じ文面は重ねない）が効く
 */
export function friendlyError(e: unknown, fallback = '保存できませんでした'): string {
  const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'つながらないみたい。あとでもう一度'
  if (/fetch|network|load failed|timeout|ECONN/i.test(msg)) return 'つながらないみたい。あとでもう一度'
  if (/JWT|session|not authenticated|401/i.test(msg)) return 'ログインが切れたみたい。もう一度ログインしてね'
  // 新しい列がまだ DB に無い（Supabase の SQL をまだ流していない）
  if (/PGRST204|column .* (does not exist|of '.*' in the schema cache)|schema cache/i.test(msg)) return 'データベースの更新（SQL の実行）がまだみたい。設定の手順を見てね'
  // 日本語で書かれたメッセージ（アプリ側で付けたもの）はそのまま
  if (/[぀-ヿ一-龯]/.test(msg)) return msg
  return fallback
}
