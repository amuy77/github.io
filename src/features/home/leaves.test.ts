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
