import { describe, expect, it, vi } from 'vitest'
import { fetchAll } from './fetchAll'

const source = (n: number) => ({ range: vi.fn(async (from: number, to: number) => ({ data: Array.from({ length: Math.max(0, Math.min(n, to + 1) - from) }, (_, i) => from + i), error: null })) })

describe('fetchAll', () => {
  it('1000 件未満なら 1 回で終わる', async () => {
    const q = source(42)
    expect(await fetchAll(q)).toHaveLength(42)
    expect(q.range).toHaveBeenCalledTimes(1)
  })
  it('ちょうど 1000 件でも、2500 件でも全部返す（順番も保つ）', async () => {
    const a = source(1000)
    expect(await fetchAll(a)).toHaveLength(1000)
    expect(a.range).toHaveBeenCalledTimes(2)
    const b = source(2500)
    const rows = await fetchAll(b)
    expect(rows).toHaveLength(2500)
    expect(rows[0]).toBe(0); expect(rows[2499]).toBe(2499)
    expect(b.range).toHaveBeenCalledTimes(3)
  })
  it('失敗は投げる', async () => {
    const q = { range: async () => ({ data: null, error: { message: 'boom' } }) }
    await expect(fetchAll(q)).rejects.toMatchObject({ message: 'boom' })
  })
})
