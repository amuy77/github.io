import { describe, expect, it } from 'vitest'
import { parseIngredientLine, parseRecipeText } from './recipeParser'

describe('parseIngredientLine', () => {
  it('名前と量を分ける', () => {
    expect(parseIngredientLine('食パン 2枚')).toEqual({ name: '食パン', amount: '2枚' })
    expect(parseIngredientLine('砂糖 大さじ2')).toEqual({ name: '砂糖', amount: '大さじ2' })
    expect(parseIngredientLine('塩 少々')).toEqual({ name: '塩', amount: '少々' })
    expect(parseIngredientLine('ベーコン…3枚')).toEqual({ name: 'ベーコン', amount: '3枚' })
  })
  it('量が先でもよい', () => {
    expect(parseIngredientLine('200g 砂糖')).toEqual({ name: '砂糖', amount: '200g' })
  })
  it('全角の数字も読む', () => {
    expect(parseIngredientLine('卵 ２個')).toEqual({ name: '卵', amount: '2個' })
  })
  it('量が無ければ null', () => {
    expect(parseIngredientLine('ベーコンをカリカリに焼く')).toBeNull()
    expect(parseIngredientLine('')).toBeNull()
  })
})

describe('parseRecipeText', () => {
  it('見出しでタイトル・材料・作り方・メモに分ける', () => {
    const p = parseRecipeText(['BLT サンド', '材料', '食パン 2枚', 'ベーコン 3枚', '作り方', '1. ベーコンをカリカリに焼く', '2. パンをトーストして具をはさむ', 'メモ', '夏はトマト多め'].join('\n'))
    expect(p.title).toBe('BLT サンド')
    expect(p.ingredients).toEqual([{ name: '食パン', amount: '2枚' }, { name: 'ベーコン', amount: '3枚' }])
    expect(p.steps).toEqual(['ベーコンをカリカリに焼く', 'パンをトーストして具をはさむ'])
    expect(p.notes).toContain('夏はトマト多め')
  })
  it('①②が 1 行にまとまっていても手順に分ける', () => {
    const p = parseRecipeText('作り方\n①ベーコンを焼く ②パンをトーストする')
    expect(p.steps).toEqual(['ベーコンを焼く', 'パンをトーストする'])
  })
})
