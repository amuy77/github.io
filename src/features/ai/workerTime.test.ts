import { describe, expect, it } from 'vitest'
import { nextWorkerTime, WORKER_REDO_MINUTE } from './api'

// JST の時刻で Date を作る（テストの端末のタイムゾーンに関係なく）
const jst = (h: number, m: number) => new Date(Date.UTC(2026, 9, 10, h - 9, m))

describe('次に LaRa が読みに来る時刻', () => {
  it('毎時 0 分の回: 次の正時', () => {
    expect(nextWorkerTime(jst(14, 5))).toBe('15:00')
    expect(nextWorkerTime(jst(7, 30))).toBe('8:00')
    expect(nextWorkerTime(jst(23, 10))).toBe('明日の 8:00')
  })
  it('直してもらう（毎時 20 分の回）: まだ 20 分前なら同じ時間の 20 分', () => {
    expect(nextWorkerTime(jst(14, 5), WORKER_REDO_MINUTE)).toBe('14:20')
    expect(nextWorkerTime(jst(14, 25), WORKER_REDO_MINUTE)).toBe('15:20')
    expect(nextWorkerTime(jst(23, 10), WORKER_REDO_MINUTE)).toBe('23:20')
    expect(nextWorkerTime(jst(23, 30), WORKER_REDO_MINUTE)).toBe('明日の 8:20')
    expect(nextWorkerTime(jst(6, 0), WORKER_REDO_MINUTE)).toBe('8:20')
  })
})
