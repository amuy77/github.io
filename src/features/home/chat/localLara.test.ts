import { describe, expect, it } from 'vitest'
import { localReply, type LaraContext } from './localLara'
import { paths } from '@/app/routes'
import { today } from '@/lib/dates'

const ctx = (over: Partial<LaraContext> = {}): LaraContext => ({
  hour: 9, counts: { clips: 3, recipes: 5, menuLogs: 2, inbox: 0, drafts: 0, pendingJobs: 0 }, streak: 4, todayLogged: true,
  recipes: [], clips: [], notServed: [], random: () => 0.01, ...over,
})

describe('localReply', () => {
  it('あいさつには中身のある返事（{変数} が残らない）', () => {
    for (const q of ['おはよう', 'こんにちは', 'こんばんは', 'ありがとう', 'おやすみ']) {
      const r = localReply(q, ctx())
      expect(r.text.length).toBeGreaterThan(0)
      expect(r.text).not.toMatch(/[{}]/)
      expect(r.consult).toBeFalsy()
    }
  })
  it('おつかれ: 今日の記録がまだなら、記録へのリンクを添える', () => {
    expect(localReply('おつかれ', ctx({ todayLogged: true })).links).toBeUndefined()
    expect(localReply('おつかれ', ctx({ todayLogged: false })).links).toEqual([{ label: '今日のメニューを記録', to: paths.menuDay(today()) }])
  })
  it('予定: Planner が読めなければそう言って Planner へのリンク', () => {
    const r = localReply('今日の予定は？', ctx({ planner: { today: null } }))
    expect(r.text).toContain('Planner')
    expect(r.links?.[0].label).toBe('Planner を開く')
  })
  it('長い相談は預かる（consult）', () => {
    const r = localReply('新しい秋メニューを考えたいんだけど、栗を使って何か良い案はある？', ctx())
    expect(r.consult).toBe(true)
  })
})
