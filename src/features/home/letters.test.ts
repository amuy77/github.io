import { describe, expect, it } from 'vitest'
import { writeLetter } from './letters'
import type { MenuLogWithItems } from '@/features/menu/api'
import type { RecipeRow } from '@/lib/supabase/database.types'

const recipe = (id: string, title: string, extra: Partial<RecipeRow> = {}) => ({ id, title, family_id: null, is_main: false, status: 'published', purpose: 'menu', created_at: '2026-01-01T00:00:00Z', ...extra } as unknown as RecipeRow)
const log = (date: string, items: [string, number | null][]) => ({ id: date, log_date: date, menu_log_items: items.map(([recipe_id, sold_count]) => ({ recipe_id, sold_count })) } as unknown as MenuLogWithItems)

const week = '2026-10-05' // 月曜。先週は 9/28〜10/4
const R = [recipe('blt1', 'BLT サンド'), recipe('blt2', 'BLT サンド', { family_id: 'blt1', is_main: true }), recipe('egg', 'エッグサラダ'), recipe('new', '栗のラテ', { created_at: '2026-10-01T03:00:00Z' })]

describe('writeLetter', () => {
  it('sums up last week: days, the top dish (versions together), and what was added', () => {
    const logs = [log('2026-09-28', [['blt1', 3], ['egg', 1]]), log('2026-10-02', [['blt2', 5]]), log('2026-10-05', [['egg', 99]])]
    const l = writeLetter({ week, logs, recipes: R, clips: [{ created_at: '2026-09-30T01:00:00Z' }, { created_at: '2026-08-01T00:00:00Z' }], seed: 0 })
    expect(l.id).toBe(week)
    expect(l.read).toBe(false)
    const text = l.lines.join('\n')
    expect(text).toContain('9/28〜10/4')
    expect(text).toContain('記録したのは 2 日')
    // 今週（10/5）の記録は数えない。BLT の 2 つの版は合わせて 8 個
    expect(text).toContain('いちばん出たのは「BLT サンド」。8 個も出たよ！')
    expect(text).toContain('レシピが 1 品、ネタが 1 件ふえたよ')
    expect(l.lines.at(-1)).toBe('LaRa より')
  })

  it('is gentle when nothing was recorded', () => {
    const l = writeLetter({ week, logs: [], recipes: [], clips: [], seed: 0.5 })
    expect(l.lines.join('\n')).toContain('お休みだったね')
    expect(l.lines.join('\n')).not.toContain('ふえたよ')
  })
})
