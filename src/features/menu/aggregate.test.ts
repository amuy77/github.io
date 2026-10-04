import { describe, expect, it } from 'vitest'
import { genreShares, notServedRecently, recipeFrequency } from './aggregate'
import type { MenuLogWithItems } from './api'
import type { GenreRow, RecipeRow } from '@/lib/supabase/database.types'
import { addDays, today } from '@/lib/dates'

const genre = (id: string, name: string): GenreRow => ({ id, user_id: 'u', name, color: 'brick', emoji: '', sort_order: 1, created_at: '', updated_at: '' } as GenreRow)
const recipe = (id: string, genre_id: string | null, purpose: RecipeRow['purpose'] = 'menu'): RecipeRow => ({ id, title: id, genre_id, status: 'published', purpose, ingredients: [], steps: [] } as unknown as RecipeRow)
const log = (date: string, items: [string, number | null][]): MenuLogWithItems => ({ id: date, user_id: 'u', log_date: date, note: '', created_at: '', updated_at: '', menu_log_items: items.map(([recipe_id, sold_count]) => ({ id: `${date}-${recipe_id}`, user_id: 'u', menu_log_id: date, recipe_id, sold_count, created_at: '' })) } as unknown as MenuLogWithItems)

const G = [genre('g1', 'サンド'), genre('g2', 'コーヒー')]
const R = [recipe('blt', 'g1'), recipe('egg', 'g1'), recipe('drip', 'g2'), recipe('old', 'g1'), recipe('ref', 'g1', 'reference')]
const t = today()
const L = [log(t, [['blt', 8], ['drip', 20]]), log(addDays(t, -1), [['blt', 10], ['egg', null]]), log(addDays(t, -30), [['old', 1]])]

describe('aggregate', () => {
  it('genreShares はジャンルごとの割合（合計 1、多い順）', () => {
    const s = genreShares(L, R, G)
    expect(s.map((x) => x.key)).toEqual(['g1', 'g2'])
    expect(s.reduce((a, b) => a + b.share, 0)).toBeCloseTo(1)
    expect(s[0].count).toBe(4)
  })
  it('知らないジャンルは「ジャンルなし」にまとめる', () => {
    const s = genreShares([log(t, [['x', null]])], [recipe('x', 'nope')], G)
    expect(s).toEqual([expect.objectContaining({ key: 'none', count: 1 })])
  })
  it('recipeFrequency は売数の多い順、売数が無ければ日数順', () => {
    const f = recipeFrequency(L, R)
    expect(f[0].recipe.id).toBe('drip')
    expect(f.find((x) => x.recipe.id === 'blt')).toMatchObject({ days: 2, sold: 18, lastServed: t })
    expect(f.find((x) => x.recipe.id === 'egg')).toMatchObject({ days: 1, sold: null })
  })
  it('notServedRecently はお店のメニューで、しばらく出していないものだけ', () => {
    const n = notServedRecently(L, R)
    expect(n.map((x) => x.recipe.id)).toEqual(['old'])
    expect(n[0].daysSince).toBe(30)
    // 一度も出していないお店のメニューは先頭に来る
    const n2 = notServedRecently(L, [...R, recipe('never', 'g1')])
    expect(n2[0].recipe.id).toBe('never')
    expect(n2[0].daysSince).toBeNull()
  })
})
