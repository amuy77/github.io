import { describe, expect, it } from 'vitest'
import { grownLeaves, MAX_LEAVES } from './leaves'

describe('grownLeaves', () => {
  it('grows with the recorded days', () => {
    expect(grownLeaves(3, 0)).toBe(3)
  })
  it('never shrinks when fewer days are seen later', () => {
    expect(grownLeaves(1, 9)).toBe(9)
  })
  it('stops at the max', () => {
    expect(grownLeaves(40, 0)).toBe(MAX_LEAVES)
  })
})

describe('decorTier', () => {
  it('adds one decoration at 10, 30 and 60', async () => {
    const { decorTier } = await import('./leaves')
    expect([0, 9, 10, 29, 30, 59, 60, 500].map(decorTier)).toEqual([0, 0, 1, 1, 2, 2, 3, 3])
  })
})
