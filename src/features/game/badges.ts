import type { HomeCounts } from '@/features/home/useCounts'

export interface BadgeDef { key: string; emoji: string; title: string; body: string; unlocked: (c: HomeCounts, streak: number) => boolean }

export const BADGES: BadgeDef[] = [
  { key: 'first_clip', emoji: '📌', title: 'はじめてのネタ', body: '最初のネタを保存した', unlocked: (c) => c.clips >= 1 },
  { key: 'first_recipe', emoji: '📖', title: '図鑑スタート', body: '最初のレシピを登録した', unlocked: (c) => c.recipes >= 1 },
  { key: 'clips_10', emoji: '🗂️', title: 'ネタコレクター', body: 'ネタが 10 件になった', unlocked: (c) => c.clips >= 10 },
  { key: 'recipes_10', emoji: '📚', title: '本棚が埋まってきた', body: 'レシピが 10 品になった', unlocked: (c) => c.recipes >= 10 },
  { key: 'clips_30', emoji: '🧭', title: 'リサーチャー', body: 'ネタが 30 件になった', unlocked: (c) => c.clips >= 30 },
  { key: 'recipes_24', emoji: '🏆', title: '本棚コンプリート', body: 'お店の本棚がいっぱいになった（24 品）', unlocked: (c) => c.recipes >= 24 },
  { key: 'menu_1', emoji: '🗓️', title: '営業日誌', body: 'はじめてメニューを記録した', unlocked: (c) => c.menuLogs >= 1 },
  { key: 'menu_7', emoji: '🌿', title: '一週間つけた', body: 'メニュー記録が 7 日分になった', unlocked: (c) => c.menuLogs >= 7 },
  { key: 'streak_3', emoji: '🔥', title: '3 日連続', body: '3 日続けて記録した', unlocked: (_c, s) => s >= 3 },
  { key: 'streak_7', emoji: '🔥', title: '7 日連続', body: '1 週間続けて記録した', unlocked: (_c, s) => s >= 7 },
  { key: 'streak_30', emoji: '💎', title: '30 日連続', body: 'ひと月続けて記録した', unlocked: (_c, s) => s >= 30 },
]

export function unlockedBadges(c: HomeCounts, streak: number): BadgeDef[] {
  return BADGES.filter((b) => b.unlocked(c, streak))
}

const KEY = 'lara.seenBadges'
export function readSeen(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]) } catch { return new Set() }
}
export function writeSeen(keys: Set<string>) {
  try { localStorage.setItem(KEY, JSON.stringify([...keys])) } catch { /* private mode */ }
}
