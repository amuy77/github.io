import { describe, expect, it } from 'vitest'
import { scaleAmount } from './scale'

describe('倍量', () => {
  it('数字だけを倍にする', () => {
    expect(scaleAmount('200g', 2)).toBe('400g')
    expect(scaleAmount('2枚', 3)).toBe('6枚')
    expect(scaleAmount('2〜3枚', 2)).toBe('4〜6枚')
    expect(scaleAmount('1.5カップ', 2)).toBe('3カップ')
  })
  it('分数は分子を倍にして、整数になれば整数', () => {
    expect(scaleAmount('1/2個', 2)).toBe('1個')
    expect(scaleAmount('1/4個', 2)).toBe('0.5個')
    expect(scaleAmount('3/4本', 1)).toBe('3/4本')
  })
  it('半分', () => {
    expect(scaleAmount('200g', 0.5)).toBe('100g')
    expect(scaleAmount('3枚', 0.5)).toBe('1.5枚')
  })
  it('数字が無ければそのまま', () => {
    expect(scaleAmount('少々', 2)).toBe('少々')
    expect(scaleAmount('', 2)).toBe('')
  })
})
