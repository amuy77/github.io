import type { KeyboardEvent } from 'react'

/**
 * 「決定の Enter」かどうか。日本語入力の変換を確定する Enter（isComposing）と Shift+Enter（改行）は除く。
 * 変換中の Enter で保存や追加が走ると、打ちかけの文字で保存されてしまう
 */
export function isEnter(e: KeyboardEvent): boolean {
  return e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing
}
