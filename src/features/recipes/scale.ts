/**
 * 「作るモード」の倍量: 材料の量の中の数字だけを倍にする。
 * 「200g」→「400g」、「1/2個」→「1個」、「2〜3枚」→「4〜6枚」。数字の無い量（「少々」「適量」）はそのまま
 */
export function scaleAmount(amount: string, k: number): string {
  if (k === 1 || !amount) return amount
  const fmt = (n: number) => { const r = Math.round(n * 10) / 10; return Number.isInteger(r) ? String(r) : String(r) }
  // 分数と数字を 1 回で見る（分けると、分数を直した結果の数字をもう一度倍にしてしまう）
  return amount.replace(/(\d+)\s*\/\s*(\d+)|\d+(?:\.\d+)?/g, (m, a?: string, b?: string) => (a && b ? fmt((Number(a) * k) / Number(b)) : fmt(Number(m) * k)))
}

/** 倍量の選択肢 */
export const SCALES = [{ k: 0.5, label: '半分' }, { k: 1, label: '1 倍' }, { k: 2, label: '2 倍' }, { k: 3, label: '3 倍' }] as const
