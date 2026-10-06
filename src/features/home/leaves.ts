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
