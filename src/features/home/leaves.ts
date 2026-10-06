/**
 * お店の鉢植えの葉。記録した日の数だけ増えて（最大 14 枚）、減らない。
 * 連続記録で数えると、1 日休んだだけで葉が落ちて罰のように見えるので、今まで育った一番多い枚数を端末に覚えておく
 */
export const MAX_LEAVES = 14
const KEY = 'lara.home.leaves'

export function grownLeaves(activeDays: number, remembered: number): number {
  return Math.min(MAX_LEAVES, Math.max(remembered, activeDays))
}

export function readLeaves(): number {
  try { return Math.max(0, Number(localStorage.getItem(KEY)) || 0) } catch { return 0 }
}

/** 今の記録日数から葉の数を決めて、増えていれば覚える */
export function useLeavesFrom(activeDays: number): number {
  const leaves = grownLeaves(activeDays, readLeaves())
  try { if (leaves > readLeaves()) localStorage.setItem(KEY, String(leaves)) } catch { /* 覚えられなくても表示はできる */ }
  return leaves
}

/** お店の改装: 記録・ネタ・レシピの累計で 10 / 30 / 60 を超えるたびに飾りが 1 つ増える（最大 3。減らない） */
export const DECOR_STEPS = [10, 30, 60] as const
export function decorTier(total: number): number {
  return DECOR_STEPS.filter((n) => total >= n).length
}
const DECOR_KEY = 'lara.home.decor'
export function useDecorFrom(total: number): number {
  let remembered = 0
  try { remembered = Math.max(0, Number(localStorage.getItem(DECOR_KEY)) || 0) } catch { /* 覚えていなくても今の数で出す */ }
  const tier = Math.max(remembered, decorTier(total))
  try { if (tier > remembered) localStorage.setItem(DECOR_KEY, String(tier)) } catch { /* 表示はできる */ }
  return tier
}
