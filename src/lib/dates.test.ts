import { describe, expect, it } from 'vitest'
import { addDays, dateOf, dayPartOfHour, formatMD, isoDate, monthEnd, monthStart, parseIso, relativeDay, today, weekStart } from './dates'

describe('dates', () => {
  it('addDays は月末・年末をまたぐ', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('weekStart は月曜始まり', () => {
    expect(weekStart('2026-10-04')).toBe('2026-09-28')   // 日曜 → 前の月曜
    expect(weekStart('2026-09-28')).toBe('2026-09-28')   // 月曜はそのまま
  })
  it('monthStart / monthEnd（うるう年も）', () => {
    expect(monthStart('2026-10-04')).toBe('2026-10-01')
    expect(monthEnd('2026-02-10')).toBe('2026-02-28')
    expect(monthEnd('2028-02-10')).toBe('2028-02-29')
  })
  it('parseIso ↔ isoDate が往復する', () => {
    expect(isoDate(parseIso('2026-10-04'))).toBe('2026-10-04')
  })
  it('dateOf はタイムスタンプを端末の日付にする（UTC で切らない）', () => {
    const d = new Date(2026, 9, 5, 0, 30)   // 端末時刻の 10/5 0:30
    expect(dateOf(d.toISOString())).toBe('2026-10-05')
    expect(d.toISOString().slice(0, 10) === '2026-10-05' || new Date().getTimezoneOffset() === 0).toBe(new Date().getTimezoneOffset() <= 0 ? d.toISOString().slice(0, 10) === '2026-10-05' : false)
  })
  it('relativeDay', () => {
    expect(relativeDay(today())).toBe('今日')
    expect(relativeDay(addDays(today(), -1))).toBe('昨日')
    expect(relativeDay(addDays(today(), -3))).toBe('3日前')
    expect(relativeDay('2020-01-05')).toBe('1/5')
  })
  it('formatMD は曜日つき', () => {
    expect(formatMD('2026-10-04')).toBe('10/4（日）')
  })
  it('dayPartOfHour の境目（夜は 20 時から 6 時まで）', () => {
    expect(dayPartOfHour(5)).toBe('night')
    expect(dayPartOfHour(6)).toBe('morning')
    expect(dayPartOfHour(10)).toBe('day')
    expect(dayPartOfHour(17)).toBe('evening')
    expect(dayPartOfHour(19)).toBe('evening')
    expect(dayPartOfHour(20)).toBe('night')
    expect(dayPartOfHour(23)).toBe('night')
  })
})
