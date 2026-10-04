// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('scheduleDelete / undoDelete', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())
  it('待ち時間が過ぎたら本当に消す', async () => {
    const { scheduleDelete, UNDO_MS } = await import('./undoDelete')
    const run = vi.fn(async () => {}), restore = vi.fn()
    scheduleDelete(run, restore)
    vi.advanceTimersByTime(UNDO_MS - 1); expect(run).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1); expect(run).toHaveBeenCalledOnce(); expect(restore).not.toHaveBeenCalled()
  })
  it('元に戻すを押したら消さずに restore', async () => {
    const { scheduleDelete, undoDelete, UNDO_MS } = await import('./undoDelete')
    const run = vi.fn(async () => {}), restore = vi.fn()
    const id = scheduleDelete(run, restore)
    expect(undoDelete(id)).toBe(true)
    vi.advanceTimersByTime(UNDO_MS * 2)
    expect(run).not.toHaveBeenCalled(); expect(restore).toHaveBeenCalledOnce()
    expect(undoDelete(id)).toBe(false)   // 二度は戻せない
  })
  it('flushDeletes は待たずに全部実行する', async () => {
    const { scheduleDelete, flushDeletes, undoDelete } = await import('./undoDelete')
    const a = vi.fn(async () => {}), b = vi.fn(async () => {})
    const id = scheduleDelete(a, () => {}); scheduleDelete(b, () => {})
    flushDeletes()
    expect(a).toHaveBeenCalledOnce(); expect(b).toHaveBeenCalledOnce()
    expect(undoDelete(id)).toBe(false)
  })
})
