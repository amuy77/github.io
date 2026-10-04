/** Asia/Tokyo 前提の日付ヘルパー（お店は日本、端末も日本時間） */

const pad = (n: number) => String(n).padStart(2, '0')

/** Date → 'YYYY-MM-DD'（端末ローカル） */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function today(): string {
  return isoDate(new Date())
}

/** created_at などのタイムスタンプ → その日の 'YYYY-MM-DD'（端末ローカル）。`slice(0, 10)` だと UTC の日付になって朝 9 時まで 1 日ずれる */
export function dateOf(ts: string): string {
  return isoDate(new Date(ts))
}

export function addDays(iso: string, days: number): string {
  const d = parseIso(iso)
  d.setDate(d.getDate() + days)
  return isoDate(d)
}

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** 月曜始まりの週頭 */
export function weekStart(iso: string): string {
  const d = parseIso(iso)
  const dow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dow)
  return isoDate(d)
}

export function monthStart(iso: string): string {
  return iso.slice(0, 7) + '-01'
}

export function monthEnd(iso: string): string {
  const d = parseIso(monthStart(iso))
  d.setMonth(d.getMonth() + 1)
  d.setDate(0)
  return isoDate(d)
}

const WD = ['日', '月', '火', '水', '木', '金', '土']

/** '9/27（土）' */
export function formatMD(iso: string): string {
  const d = parseIso(iso)
  return `${d.getMonth() + 1}/${d.getDate()}（${WD[d.getDay()]}）`
}

/** '2026年9月' */
export function formatYM(iso: string): string {
  const d = parseIso(iso)
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
}

/** 相対表示: '今日' '昨日' '3日前' '9/20' */
export function relativeDay(isoOrTs: string): string {
  const d = isoOrTs.length > 10 ? new Date(isoOrTs) : parseIso(isoOrTs)
  const diff = Math.floor((parseIso(today()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000)
  if (diff <= 0) return '今日'
  if (diff === 1) return '昨日'
  if (diff < 7) return `${diff}日前`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export type DayPart = 'morning' | 'day' | 'evening' | 'night'

export function dayPart(d = new Date()): DayPart {
  const h = d.getHours()
  if (h < 6) return 'night'
  if (h < 10) return 'morning'
  if (h < 17) return 'day'
  if (h < 20) return 'evening'
  return 'night'
}

export function greeting(d = new Date()): string {
  const p = dayPart(d)
  return p === 'morning' ? 'おはよう！' : p === 'day' ? 'こんにちは！' : p === 'evening' ? 'おつかれさま！' : 'こんばんは。'
}
