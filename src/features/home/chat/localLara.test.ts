import { describe, expect, it } from 'vitest'
import { localReply, plannerDateOf, type LaraContext } from './localLara'
import { paths } from '@/app/routes'
import { addDays, today } from '@/lib/dates'
import type { Agenda } from '@/features/planner/agendaLine'

const agenda = (date: string, over: Partial<Agenda> = {}): Agenda => ({
  date, today: today(), url: '', tasks: [],
  events: [{ title: '打ち合わせ', all_day: false, start: '10:00', end: '11:00', location: null, calendar: 'Planner' }], ...over,
})

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
    const r = localReply('今日の予定は？', ctx({ planner: { date: today(), agenda: null, error: 'login' } }))
    expect(r.text).toContain('ログイン')
    expect(r.links?.[0].label).toBe('Planner を開く')
    expect(localReply('今日の予定は？', ctx({ planner: { date: today(), agenda: null, error: 'network' } })).text).toContain('つながらなかった')
  })
  it('予定: 聞かれた日（10/16 など）の分を、その日付つきで答える', () => {
    const d = plannerDateOf('10/16の予定は？', today())!
    expect(d).toMatch(/-10-16$/)
    const r = localReply('10/16の予定は？', ctx({ planner: { date: d, agenda: agenda(d) } }))
    expect(r.text).toMatch(/^10\/16（.）の予定は 1 件だよ。/)
    expect(r.text).toContain('10:00 打ち合わせ')
  })
  it('予定: 明日は「明日」と言う。別の日の分しか無ければ読めなかった扱い', () => {
    const tm = addDays(today(), 1)
    expect(localReply('明日の予定は？', ctx({ planner: { date: tm, agenda: agenda(tm) } })).text).toContain('明日の予定は 1 件')
    expect(localReply('明日の予定は？', ctx({ planner: { date: today(), agenda: agenda(today()) } })).text).toContain('読めなかった')
  })
  it('予定かどうか: 日付つきの「なにかある？」も予定、「今日なにしよう」は違う', () => {
    expect(plannerDateOf('明日なにかある？', today())).toBe(addDays(today(), 1))
    expect(plannerDateOf('今日なにしよう？', today())).toBeNull()
    expect(plannerDateOf('おすすめ教えて', today())).toBeNull()
    expect(plannerDateOf('スケジュール教えて', today())).toBe(today())
  })
  it('長い相談は預かる（consult）', () => {
    const r = localReply('新しい秋メニューを考えたいんだけど、栗を使って何か良い案はある？', ctx())
    expect(r.consult).toBe(true)
  })
})
