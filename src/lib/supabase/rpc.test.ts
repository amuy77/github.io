import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
vi.mock('./client', () => ({ getSupabase: () => ({ rpc }) }))
const { callRpc } = await import('./rpc')

describe('callRpc', () => {
  beforeEach(() => rpc.mockReset())
  it('関数があればその結果', async () => {
    rpc.mockResolvedValue({ data: 'log-1', error: null })
    const fallback = vi.fn()
    expect(await callRpc('save_menu_log', { p_date: '2026-10-04', p_note: '', p_items: [] }, fallback)).toBe('log-1')
    expect(fallback).not.toHaveBeenCalled()
  })
  it('関数が無い（PGRST202）ときだけ今までのやり方に戻る', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } })
    const fallback = vi.fn(async () => 'log-2')
    expect(await callRpc('save_menu_log', { p_date: '2026-10-04', p_note: '', p_items: [] }, fallback)).toBe('log-2')
    expect(fallback).toHaveBeenCalledOnce()
  })
  it('それ以外の失敗はそのまま投げる（握りつぶさない）', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } })
    const fallback = vi.fn()
    await expect(callRpc('delete_recipe', { p_id: 'x' }, fallback)).rejects.toMatchObject({ code: '42501' })
    expect(fallback).not.toHaveBeenCalled()
  })
})
