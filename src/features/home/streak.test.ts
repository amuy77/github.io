import { describe, expect, it } from 'vitest'
import { computeStreak } from './useCounts'
import { addDays } from '@/lib/dates'

const base = '2026-10-04'
const back = (n: number) => addDays(base, -n)

describe('computeStreak', () => {
  it('今日まで続いていれば日数', () => {
    expect(computeStreak([back(0), back(1), back(2)], base)).toBe(3)
  })
  it('昨日で終わっていてもまだ続いている扱い（今日はこれから）', () => {
    expect(computeStreak([back(1), back(2)], base)).toBe(2)
  })
  it('一昨日で途切れていたら 0', () => {
    expect(computeStreak([back(2), back(3)], base)).toBe(0)
  })
  it('途中に穴があればそこまで', () => {
    expect(computeStreak([back(0), back(1), back(3), back(4)], base)).toBe(2)
  })
  it('順番がばらばらでも、重複があっても同じ', () => {
    expect(computeStreak([back(2), back(0), back(1), back(1)], base)).toBe(3)
  })
  it('空なら 0', () => {
    expect(computeStreak([], base)).toBe(0)
  })
})
