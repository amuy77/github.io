import { describe, expect, it } from 'vitest'
import { findPrice, parseQty, recipeCost, unitCost, type IngredientPrice } from './cost'

const p = (name: string, buy_amount: number, buy_unit: string, buy_price: number): IngredientPrice => ({ id: name, name, buy_amount, buy_unit, buy_price })

describe('parseQty', () => {
  it('reads numbers and units written in many ways', () => {
    expect(parseQty('3枚')).toMatchObject({ amount: 3, kind: 'count', base: 3 })
    expect(parseQty('200g')).toMatchObject({ kind: 'g', base: 200 })
    expect(parseQty('１.５ｋｇ')).toMatchObject({ kind: 'g', base: 1500 })
    expect(parseQty('大さじ2')).toMatchObject({ kind: 'ml', base: 30 })
    expect(parseQty('小さじ1/2')).toMatchObject({ kind: 'ml', base: 2.5 })
    expect(parseQty('1/2個')).toMatchObject({ kind: 'count', base: 0.5 })
    expect(parseQty('2〜3枚')).toMatchObject({ base: 3 })
    expect(parseQty('240ml')).toMatchObject({ kind: 'ml', base: 240 })
  })
  it('gives up on things it cannot read', () => {
    expect(parseQty('少々')).toBeNull()
    expect(parseQty('適量')).toBeNull()
    expect(parseQty('')).toBeNull()
    expect(parseQty('3つまみ')).toBeNull()
  })
})

describe('cost', () => {
  const prices = [p('ベーコン', 1, 'kg', 1800), p('食パン', 8, '枚', 400), p('卵', 10, '個', 300), p('マヨネーズ', 450, 'g', 350)]
  it('unitCost is the price per gram / ml / piece', () => {
    expect(unitCost(prices[0])).toEqual({ kind: 'g', perBase: 1.8 })
    expect(unitCost(prices[1])).toEqual({ kind: 'count', perBase: 50 })
  })
  it('findPrice matches the same name, then a name that contains it', () => {
    expect(findPrice('食パン', prices)?.id).toBe('食パン')
    expect(findPrice('厚切りベーコン', prices)?.id).toBe('ベーコン')
    expect(findPrice('レタス', prices)).toBeNull()
  })
  it('adds up what it knows and counts what it does not', () => {
    const c = recipeCost([
      { name: '食パン', amount: '2枚' },
      { name: 'ベーコン', amount: '60g' },
      { name: '卵', amount: '1個' },
      { name: 'マヨネーズ', amount: '大さじ1' },
      { name: 'レタス', amount: '2枚' },
    ], prices)
    // 100 + 108 + 30 = 238。マヨは g で買って大さじで使う（かさと重さは換算しない）のでわからない
    expect(c.total).toBe(238)
    expect(c.known).toBe(3)
    expect(c.unknown).toBe(2)
    expect(c.lines.find((l) => l.ingredient.name === 'マヨネーズ')?.reason).toBe('unit-mismatch')
    expect(c.lines.find((l) => l.ingredient.name === 'レタス')?.reason).toBe('no-price')
  })
})
