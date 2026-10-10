import { describe, expect, it } from 'vitest'
import type { PlaceRow } from '@/lib/supabase/database.types'
import { laraTrendWords, placeTrends } from './trends'

let n = 0
const place = (p: Partial<PlaceRow>): PlaceRow => ({
  id: `p${++n}`, user_id: 'u', name: `店${n}`, url: null, maps_url: null, lat: null, lng: null, address: '', area: '', cuisine: '', price_band: null,
  rating: null, revisit: false, note: '', images: [], visited_on: null, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', ...p,
})

describe('placeTrends', () => {
  it('counts cuisines, prices, areas and finds the best-rated cuisine', () => {
    const rows = [
      place({ cuisine: 'カフェ', rating: 4, price_band: 2, area: '渋谷区', revisit: true }),
      place({ cuisine: 'カフェ', rating: 3, price_band: 2, area: '渋谷区' }),
      place({ cuisine: 'カフェ', rating: 4, price_band: 1, area: '目黒区', revisit: true }),
      place({ cuisine: 'イタリアン', rating: 5, price_band: 4, area: '渋谷区', revisit: true }),
      place({ cuisine: 'イタリアン', rating: 5, price_band: 2 }),
      place({ cuisine: '' }),
    ]
    const t = placeTrends(rows)
    expect(t.total).toBe(6)
    expect(t.cuisines.map((c) => [c.name, c.count])).toEqual([['カフェ', 3], ['イタリアン', 2], ['ジャンルなし', 1]])
    expect(t.cuisines[0].share).toBeCloseTo(0.5)
    expect(t.bestCuisine).toBe('イタリアン')
    expect(t.usualPrice).toBe(2)
    expect(t.areas[0]).toEqual({ name: '渋谷区', count: 3 })
    expect(t.revisit).toBe(3)
    expect(t.avgRating).toBeCloseTo(4.2)
    expect(laraTrendWords(t)).toBe('カフェが一番多いね（50%）。★が高いのはイタリアン。だいたい ¥1,000〜2,000。渋谷区が多め。また行きたいお店がたくさん！')
  })
  it('groups the sixth cuisine onward into ほか', () => {
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((c) => place({ cuisine: c }))
    const t = placeTrends(rows)
    expect(t.cuisines).toHaveLength(6)
    expect(t.cuisines[5]).toMatchObject({ name: 'ほか', count: 2 })
  })
  it('cheers you on while there are only a few', () => {
    expect(laraTrendWords(placeTrends([]))).toContain('溜めていく')
    expect(laraTrendWords(placeTrends([place({})]))).toContain('いま 1 軒')
  })
})
