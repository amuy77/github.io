import { describe, expect, it } from 'vitest'
import { parseAgendaDate } from './parseDate'

// 2026-10-05 は月曜
const T = '2026-10-05'

describe('parseAgendaDate', () => {
  it('今日・明日・明後日・昨日・N日後', () => {
    expect(parseAgendaDate('今日の予定は？', T)).toBe('2026-10-05')
    expect(parseAgendaDate('明日の予定', T)).toBe('2026-10-06')
    expect(parseAgendaDate('あしたは？', T)).toBe('2026-10-06')
    expect(parseAgendaDate('明後日のスケジュール', T)).toBe('2026-10-07')
    expect(parseAgendaDate('あさっての予定', T)).toBe('2026-10-07')
    expect(parseAgendaDate('昨日の予定', T)).toBe('2026-10-04')
    expect(parseAgendaDate('3日後の予定', T)).toBe('2026-10-08')
  })
  it('10/16・10月16日・全角・年つき', () => {
    expect(parseAgendaDate('10/16の予定を教えて', T)).toBe('2026-10-16')
    expect(parseAgendaDate('10月16日の予定', T)).toBe('2026-10-16')
    expect(parseAgendaDate('１０／１６の予定', T)).toBe('2026-10-16')
    expect(parseAgendaDate('2027/1/3の予定', T)).toBe('2027-01-03')
    expect(parseAgendaDate('2027年1月3日', T)).toBe('2027-01-03')
  })
  it('年が無くて2か月以上前なら来年、少し前なら今年', () => {
    expect(parseAgendaDate('1/5の予定', T)).toBe('2027-01-05')
    expect(parseAgendaDate('9/30の予定', T)).toBe('2026-09-30')
  })
  it('無い日は null', () => {
    expect(parseAgendaDate('2/30の予定', T)).toBeNull()
  })
  it('16日だけなら今月、過ぎていたら来月', () => {
    expect(parseAgendaDate('16日の予定', T)).toBe('2026-10-16')
    expect(parseAgendaDate('1日の予定', T)).toBe('2026-11-01')
  })
  it('曜日: 次のその曜日（今日を含む）、今週・来週・再来週', () => {
    expect(parseAgendaDate('金曜の予定', T)).toBe('2026-10-09')
    expect(parseAgendaDate('月曜日の予定', T)).toBe('2026-10-05')
    expect(parseAgendaDate('日曜の予定', T)).toBe('2026-10-11')
    expect(parseAgendaDate('今週の土曜', T)).toBe('2026-10-10')
    expect(parseAgendaDate('来週の金曜の予定', T)).toBe('2026-10-16')
    expect(parseAgendaDate('来週の日曜', T)).toBe('2026-10-18')
    expect(parseAgendaDate('再来週の月曜', T)).toBe('2026-10-19')
  })
  it('日付らしいものが無ければ null', () => {
    expect(parseAgendaDate('予定を教えて', T)).toBeNull()
    expect(parseAgendaDate('おすすめ教えて', T)).toBeNull()
  })
})
