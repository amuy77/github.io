import { describe, expect, it } from 'vitest'
import { prepLines, prepText } from './prep'
import type { RecipeRow } from '@/lib/supabase/database.types'

const recipe = (title: string, ingredients: [string, string][]) => ({ id: title, title, ingredients: ingredients.map(([name, amount]) => ({ name, amount })) } as unknown as RecipeRow)

const BLT = recipe('BLT', [['食パン', '2枚'], ['ベーコン', '60g'], ['マヨ', '大さじ1'], ['塩', '少々']])
const EGG = recipe('エッグ', [['食パン', '2枚'], ['卵', '2個'], ['マヨ', '大さじ2']])

describe('prepLines', () => {
  it('adds amounts per ingredient across dishes', () => {
    const lines = prepLines([{ recipe: BLT, count: 5 }, { recipe: EGG, count: 3 }])
    const by = Object.fromEntries(lines.map((l) => [l.name, l]))
    expect(by['食パン'].total).toBe('16枚')
    expect(by['ベーコン'].total).toBe('300g')
    // 大さじ 1×5 + 大さじ 2×3 = 11 杯 = 165ml
    expect(by['マヨ'].total).toBe('165ml')
    expect(by['卵'].total).toBe('6個')
    // 読めないものは合計なし、何品ぶんかを並べる（並びは最後）
    expect(by['塩'].total).toBeNull()
    expect(by['塩'].uses).toEqual(['BLT×5（少々）'])
    expect(lines.at(-1)?.name).toBe('塩')
  })
  it('shows big amounts in kg / L and skips dishes with 0', () => {
    const lines = prepLines([{ recipe: BLT, count: 20 }, { recipe: EGG, count: 0 }])
    expect(lines.find((l) => l.name === 'ベーコン')?.total).toBe('1.2kg')
    expect(lines.find((l) => l.name === '卵')).toBeUndefined()
  })
  it('does not add pieces of different kinds (枚 and 個)', () => {
    const lines = prepLines([{ recipe: recipe('A', [['パン', '2枚']]), count: 1 }, { recipe: recipe('B', [['パン', '1個']]), count: 1 }])
    expect(lines[0].total).toBeNull()
    expect(lines[0].uses).toEqual(['A×1（2枚）', 'B×1（1個）'])
  })
  it('makes text to paste into LINE or notes', () => {
    const items = [{ recipe: BLT, count: 5 }]
    const t = prepText('2026-10-07', items, prepLines(items))
    expect(t).toContain('【10/7 の仕込み】')
    expect(t).toContain('・BLT 5')
    expect(t).toContain('□ 食パン 10枚')
    expect(t).toContain('□ 塩 （BLT×5（少々））')
  })
})
