// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { noteOutfit, noteSaying, pickTreasure, readAlbum, treasureOf } from './album'

beforeEach(() => localStorage.clear())

describe('album', () => {
  it('remembers the first day each outfit was seen', () => {
    noteOutfit('moon', '2026-10-01')
    noteOutfit('moon', '2026-10-05')
    expect(readAlbum().outfits).toEqual({ moon: '2026-10-01' })
  })
  it('keeps each saying once, newest first, and skips schedule readouts', () => {
    noteSaying('おはよう！', '2026-10-01')
    noteSaying('今日のメニュー、黒板に書いといたよ', '2026-10-02')
    noteSaying('おはよう！', '2026-10-03')
    noteSaying('今日は 9:30 から仕入れ', '2026-10-03')
    expect(readAlbum().sayings.map((s) => s.text)).toEqual(['今日のメニュー、黒板に書いといたよ', 'おはよう！'])
  })
  it('lets you pick one treasure a day, and the same date always has the same one', () => {
    expect(treasureOf('2026-10-06').id).toBe(treasureOf('2026-10-06').id)
    const t = pickTreasure('2026-10-06')
    expect(t).not.toBeNull()
    expect(pickTreasure('2026-10-06')).toBeNull()
    pickTreasure('2026-10-07')
    const a = readAlbum()
    expect(Object.values(a.treasures).reduce((x, y) => x + y, 0)).toBe(2)
    expect(a.pickedOn).toBe('2026-10-07')
  })
  it('only drops seasonal treasures in their months', () => {
    for (let d = 1; d <= 28; d++) {
      const t = treasureOf(`2026-06-${String(d).padStart(2, '0')}`)
      expect(['leaf', 'pumpkin', 'snow', 'sakura', 'shaved']).not.toContain(t.id)
    }
  })
})
