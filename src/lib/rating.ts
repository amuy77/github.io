/**
 * ★の段階。表の画面は「いまいち／ふつう／また食べたい」の 3 段階だけ。
 * ネタとお店は DB に 1〜5 で入っている（Yuma 向けに設定の奥で 5 段階を出せる）ので、3 段階との行き来をここで 1 か所にまとめる。
 * レシピは DB も 1〜3。
 */
export const SIMPLE_MAX = 3
export const SIMPLE_WORDS = ['いまいち', 'ふつう', 'また食べたい'] as const

/** 細かい段階（設定で「★をくわしく」にしたとき）のひとこと */
export const DETAIL_WORDS: Record<3 | 5, readonly string[]> = {
  5: ['いまひとつ', 'ふつう', 'いい感じ', 'かなり好き', '最高'],
  3: ['要改善', 'いい', '看板にできる'],
}

/** DB の値（max 段階）→ 3 段階。5 段階は 1,2 → 1 / 3 → 2 / 4,5 → 3 */
export function toSimple(value: number | null, max: 3 | 5): number | null {
  if (value === null) return null
  if (max === 3) return Math.min(3, Math.max(1, value))
  return value <= 2 ? 1 : value === 3 ? 2 : 3
}

/** 3 段階 → DB の値（max 段階）。5 段階は 1 → 1 / 2 → 3 / 3 → 5 */
export function fromSimple(level: number, max: 3 | 5): number {
  const l = Math.min(3, Math.max(1, level))
  return max === 3 ? l : [1, 3, 5][l - 1]
}

/** 「また食べたい」以上か（しぼりこみ用。5 段階なら 4 以上） */
export function isTop(value: number | null, max: 3 | 5): boolean {
  return value !== null && toSimple(value, max) === 3
}
