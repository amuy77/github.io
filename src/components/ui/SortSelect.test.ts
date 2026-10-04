import { describe, expect, it } from 'vitest'
import { sortRows } from './SortSelect'

const rows = [
  { id: 'b', created_at: '2026-10-02T00:00:00Z', rating: 3, title: 'ベーコン' },
  { id: 'a', created_at: '2026-10-03T00:00:00Z', rating: null, title: 'アボカド' },
  { id: 'c', created_at: '2026-10-01T00:00:00Z', rating: 5, title: 'クロワッサン' },
]
describe('sortRows', () => {
  it('新しい順', () => { expect(sortRows(rows, 'new', (r) => r.title).map((r) => r.id)).toEqual(['a', 'b', 'c']) })
  it('名前順（五十音）', () => { expect(sortRows(rows, 'name', (r) => r.title).map((r) => r.id)).toEqual(['a', 'c', 'b']) })
  it('評価順（未評価は最後）', () => { expect(sortRows(rows, 'rating', (r) => r.title).map((r) => r.id)).toEqual(['c', 'b', 'a']) })
  it('元の配列は変えない', () => { sortRows(rows, 'name', (r) => r.title); expect(rows[0].id).toBe('b') })
})
