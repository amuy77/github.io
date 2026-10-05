import { addDays, isoDate, parseIso, weekStart } from '@/lib/dates'

const WD = '日月火水木金土'

/** 全角の数字・記号を半角に（「１０／１６」も読めるように） */
const half = (s: string) => s.replace(/[０-９／]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))

/** 実在する日なら 'YYYY-MM-DD'、2/30 などは null */
function ymd(y: number, m: number, d: number): string | null {
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? isoDate(dt) : null
}

/**
 * 話しかけられた文の中の日付を 'YYYY-MM-DD' に直す。日付らしいものが無ければ null。
 * 読めるもの: 今日・明日・明後日・昨日・N日後・10/16・10月16日・2026/10/16・16日・金曜（日）・今週／来週／再来週の金曜。
 * 年が無い日付は、2か月以上前なら来年のこととみなす（12 月に「1/5 の予定」と聞かれたとき用）。
 * 「16日」だけなら今月、もう過ぎていれば来月。曜日だけなら今日から数えて次のその曜日（今日も含む）
 */
export function parseAgendaDate(input: string, todayIso: string): string | null {
  const t = half(input)
  if (/明後日|あさって/.test(t)) return addDays(todayIso, 2)
  if (/明日|あした|あす/.test(t)) return addDays(todayIso, 1)
  if (/昨日|きのう/.test(t)) return addDays(todayIso, -1)
  if (/今日|きょう|本日/.test(t)) return todayIso

  const after = t.match(/(\d{1,3})\s*日後/)
  if (after) return addDays(todayIso, Number(after[1]))

  const [ty, tm] = todayIso.split('-').map(Number)
  const full = t.match(/(\d{4})\s*[/年]\s*(\d{1,2})\s*[/月]\s*(\d{1,2})/)
  if (full) return ymd(Number(full[1]), Number(full[2]), Number(full[3]))

  const md = t.match(/(\d{1,2})\s*(?:\/|月)\s*(\d{1,2})/)
  if (md) {
    const m = Number(md[1]), d = Number(md[2])
    const thisYear = ymd(ty, m, d)
    if (!thisYear) return ymd(ty + 1, m, d)
    return thisYear < addDays(todayIso, -60) ? ymd(ty + 1, m, d) : thisYear
  }

  const dOnly = t.match(/(\d{1,2})\s*日/)
  if (dOnly) {
    const d = Number(dOnly[1])
    const thisMonth = ymd(ty, tm, d)
    if (thisMonth && thisMonth >= todayIso) return thisMonth
    const next = parseIso(`${ty}-${String(tm).padStart(2, '0')}-01`)
    next.setMonth(next.getMonth() + 1)
    return ymd(next.getFullYear(), next.getMonth() + 1, d)
  }

  const wd = t.match(new RegExp(`([${WD}])曜`))
  if (wd) {
    const target = WD.indexOf(wd[1])
    const weeks = /再来週/.test(t) ? 2 : /来週/.test(t) ? 1 : /今週/.test(t) ? 0 : null
    if (weeks !== null) {
      // 週は月曜から日曜まで
      return addDays(weekStart(todayIso), weeks * 7 + (target + 6) % 7)
    }
    const dow = parseIso(todayIso).getDay()
    return addDays(todayIso, (target - dow + 7) % 7)
  }
  return null
}
