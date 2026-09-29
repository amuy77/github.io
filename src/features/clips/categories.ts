import type { ClipType } from '@/lib/supabase/database.types'

export const TYPE_LABEL: Record<ClipType, { label: string; emoji: string }> = {
  photo: { label: '写真', emoji: '📷' },
  link: { label: 'リンク', emoji: '🔗' },
  note: { label: 'メモ', emoji: '📝' },
  idea: { label: 'ひらめき', emoji: '💡' },
}

export const SUGGESTED_TAGS = ['価格メモ', '見せ方', '仕入れ候補', '真似したい', '季節', 'テイクアウト', '盛り付け', '接客']
