import { describe, expect, it } from 'vitest'
import { genreShares, notServedRecently, prepForecast, recipeFrequency, salesSummary, weekdayAverages } from './aggregate'
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
  it('notServedRecently は同じ料理の版を 1 品として数える', () => {
    const v1 = { ...recipe('blt1', 'g1'), created_at: '2026-01-01' } as RecipeRow
    const v2 = { ...recipe('blt2', 'g1'), family_id: 'blt1', is_main: true, created_at: '2026-02-01' } as RecipeRow
    // 新しい版（blt2）だけ出していても、古い版（blt1）を「まだ一度も」と言わない
    const n = notServedRecently([log(t, [['blt2', 3]])], [v1, v2])
    expect(n).toEqual([])
    // しばらく出していなければ、代表の版で 1 回だけ出る
    const m = notServedRecently([log(addDays(t, -20), [['blt1', 1]])], [v1, v2])
    expect(m.map((x) => x.recipe.id)).toEqual(['blt2'])
    expect(m[0].daysSince).toBe(20)
  })
})

describe('sales and forecasts', () => {
  const priced = (id: string, price: number | null, extra: Partial<RecipeRow> = {}) => ({ ...recipe(id, 'g1'), price, family_id: null, is_main: false, created_at: '2026-01-01', ...extra } as RecipeRow)
  it('salesSummary multiplies sold by price and lists items without a price', () => {
    const rs = [priced('blt', 900), priced('egg', null), priced('drip', 500)]
    const s = salesSummary([log('2026-09-28', [['blt', 3], ['egg', 2], ['drip', null]]), log('2026-09-29', [['blt', 1]])], rs)
    expect(s.total).toBe(3600)
    expect(s.items).toBe(4)
    expect(s.days).toBe(2)
    expect(s.missingPrice.map((r) => r.id)).toEqual(['egg'])
  })
  it('salesSummary uses the current version\'s price for days recorded with an older version', () => {
    const rs = [priced('v1', null), priced('v2', 1000, { family_id: 'v1', is_main: true } as Partial<RecipeRow>)]
    expect(salesSummary([log('2026-09-28', [['v1', 2]])], rs).total).toBe(2000)
  })
  it('weekdayAverages averages sold per day by weekday (Monday first)', () => {
    // 2026-09-28 と 10-05 は月曜、09-29 は火曜
    const w = weekdayAverages([log('2026-09-28', [['a', 4], ['b', 2]]), log('2026-10-05', [['a', 2]]), log('2026-09-29', [['a', null]])])
    expect(w[0]).toEqual({ day: '月', days: 2, avgSold: 4 })
    expect(w[1].avgSold).toBeNull()
  })
  it('prepForecast uses the same weekday and puts versions of a dish together', () => {
    const rs = [priced('v1', 900), priced('v2', 900, { family_id: 'v1', is_main: true, title: 'BLT' } as Partial<RecipeRow>), priced('egg', 500)]
    const logs = [log('2026-09-21', [['v1', 6], ['egg', 1]]), log('2026-09-28', [['v2', 4]]), log('2026-09-29', [['egg', 99]])]
    const f = prepForecast(logs, rs, '2026-10-05')
    expect(f[0]).toMatchObject({ avg: 5, samples: 2 })
    expect(f[0].recipe.id).toBe('v2')
    expect(f[1]).toMatchObject({ avg: 0.5 })
    expect(prepForecast(logs, rs, '2026-10-07')).toEqual([])
  })
})
