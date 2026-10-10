import { describe, expect, it } from 'vitest'
import { fromSimple, isTop, toSimple } from './rating'

describe('★の 3 段階', () => {
  it('5 段階を 3 段階に丸める', () => {
    expect([1, 2, 3, 4, 5].map((v) => toSimple(v, 5))).toEqual([1, 1, 2, 3, 3])
    expect(toSimple(null, 5)).toBeNull()
  })
  it('3 段階はそのまま', () => {
    expect([1, 2, 3].map((v) => toSimple(v, 3))).toEqual([1, 2, 3])
    expect(toSimple(null, 3)).toBeNull()
  })
  it('3 段階から DB の値へ', () => {
    expect([1, 2, 3].map((l) => fromSimple(l, 5))).toEqual([1, 3, 5])
    expect([1, 2, 3].map((l) => fromSimple(l, 3))).toEqual([1, 2, 3])
    expect(fromSimple(9, 5)).toBe(5)
  })
  it('行って戻っても同じ段階', () => {
    for (const l of [1, 2, 3]) { expect(toSimple(fromSimple(l, 5), 5)).toBe(l); expect(toSimple(fromSimple(l, 3), 3)).toBe(l) }
  })
  it('「また食べたい」の判定', () => {
    expect(isTop(4, 5)).toBe(true); expect(isTop(3, 5)).toBe(false); expect(isTop(3, 3)).toBe(true); expect(isTop(null, 5)).toBe(false)
  })
})
