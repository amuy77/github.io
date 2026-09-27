import type { ClipCategory, ClipType } from '@/lib/supabase/database.types'

export const CATEGORIES: { value: ClipCategory; label: string; emoji: string }[] = [
  { value: 'sandwich', label: 'サンド', emoji: '🥪' },
  { value: 'drink', label: 'ドリンク', emoji: '🥤' },
  { value: 'coffee', label: 'コーヒー', emoji: '☕' },
  { value: 'wine', label: 'ワイン', emoji: '🍷' },
  { value: 'beer', label: 'ビール', emoji: '🍺' },
  { value: 'shop', label: 'お店', emoji: '🏪' },
  { value: 'other', label: 'その他', emoji: '✨' },
]

export const categoryOf = (v: ClipCategory) => CATEGORIES.find((c) => c.value === v) ?? CATEGORIES[CATEGORIES.length - 1]

export const TYPE_LABEL: Record<ClipType, { label: string; emoji: string }> = {
  photo: { label: '写真', emoji: '📷' },
  link: { label: 'リンク', emoji: '🔗' },
  note: { label: 'メモ', emoji: '📝' },
  idea: { label: 'ひらめき', emoji: '💡' },
}

export const SUGGESTED_TAGS = ['価格メモ', '見せ方', '仕入れ候補', '真似したい', '季節', 'テイクアウト', '盛り付け', '接客']
