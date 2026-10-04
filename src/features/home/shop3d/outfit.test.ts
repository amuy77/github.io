import { describe, expect, it } from 'vitest'
import { OUTFITS, outfitFor } from './outfit'
import { addDays } from '@/lib/dates'

const days = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDays(from, i))

describe('outfitFor', () => {
  it('固定の服はそのまま', () => {
    expect(outfitFor('hoodie', '2026-10-04')).toBe('hoodie')
  })
  it('知らない値はおまかせと同じ扱い', () => {
    expect(outfitFor('nope', '2026-10-04')).toBe(outfitFor('auto', '2026-10-04'))
  })
  it('おまかせは日付だけで決まる（端末が違っても同じ）', () => {
    expect(outfitFor('auto', '2026-10-04')).toBe(outfitFor('auto', '2026-10-04'))
    expect(OUTFITS.some((o) => o.id === outfitFor('auto', '2026-10-04'))).toBe(true)
  })
  it('同じ服は 3 日より続かない', () => {
    const seq = days('2026-01-01', 400).map((d) => outfitFor('auto', d))
    let run = 1
    for (let i = 1; i < seq.length; i++) {
      run = seq[i] === seq[i - 1] ? run + 1 : 1
      expect(run, `${seq[i]} が ${run} 日続いた（${days('2026-01-01', 400)[i]}）`).toBeLessThanOrEqual(3)
    }
  })
  it('かぼちゃは 10 月だけ', () => {
    for (const d of [...days('2026-11-01', 30), ...days('2026-09-01', 30)]) expect(outfitFor('auto', d)).not.toBe('pumpkin')
    expect(days('2026-10-01', 31).some((d) => outfitFor('auto', d) === 'pumpkin')).toBe(true)
  })
  it('どの服もそれなりに着る（1 年で 1 回も着ない服が無い）', () => {
    const year = days('2026-01-01', 365).map((d) => outfitFor('auto', d))
    for (const o of OUTFITS) expect(year.filter((x) => x === o.id).length, o.id).toBeGreaterThan(0)
  })
})
