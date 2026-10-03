/** Planner（予定・ToDo のアプリ）から届くその日のまとめ。Planner の GET /api/v1/agenda の形 */
export interface AgendaEvent { title: string; all_day: boolean; start: string | null; end: string | null; location: string | null; calendar: string }
/** planned_for は Planner の「明日」ボタンで入れた、やる日（古い Planner は返さない） */
export interface AgendaTask { title: string; due_date: string | null; due_time: string | null; overdue: boolean; starred: boolean; list: string; planned_for?: string | null }
export interface Agenda { date: string; today: string; events: AgendaEvent[]; tasks: AgendaTask[]; url: string }

const pick = <T>(a: T[], r: () => number) => a[Math.floor(r() * a.length)]
const hm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
/** 「明日」ボタンの印: その日の分は「今日やる／明日やる」、前の日から残っているものは「持ち越し」 */
function plannedTag(x: AgendaTask, date: string, which: 'today' | 'tomorrow') {
  if (!x.planned_for) return ''
  return x.planned_for < date ? '（持ち越し）' : which === 'today' ? '（今日やる）' : '（明日やる）'
}

/** 「09:30」→「9:30」 */
const t = (s: string) => s.replace(/^0(\d)/, '$1')

/** まだ終わっていない予定（終日・日をまたぐものも含む）。時刻のあるものを先に */
export function remainingEvents(a: Agenda, now: Date): AgendaEvent[] {
  const cur = hm(now)
  return a.events.filter((e) => e.all_day || !e.end || e.end > cur)
}

function eventPhrase(e: AgendaEvent) {
  return e.all_day || !e.start ? `『${e.title}』` : ` ${t(e.start)} から『${e.title}』`
}

/**
 * ホームを開いたときの LaRa のひとこと。予定も ToDo も無ければ null（いつものあいさつのまま）。
 * 夕方（17 時〜）以降で今日の予定がもう残っていなければ、明日の予定を言う
 */
export function agendaLine(today: Agenda | undefined, tomorrow: Agenda | undefined, now: Date, r: () => number = Math.random): string | null {
  if (!today) return null
  const ev = remainingEvents(today, now)
  const timed = ev.filter((e) => !e.all_day && e.start)
  const first = timed.find((e) => e.start! >= hm(now)) ?? timed[0] ?? ev[0]
  const tasks = today.tasks.length
  const taskTail = tasks ? pick([`ToDo は ${tasks} 件！`, `ToDo も ${tasks} 件あるよ`, `ToDo が ${tasks} 件待ってる`], r) : ''
  if (first) {
    const more = ev.length > 1 ? `ほかに ${ev.length - 1} 件。` : ''
    const head = pick([`今日は${eventPhrase(first)}があるよ。`, `このあと${eventPhrase(first)}だね。`, `今日の予定は${eventPhrase(first)}。`], r)
    return head + more + taskTail
  }
  if (now.getHours() >= 17 && tomorrow?.events.length) {
    const e = tomorrow.events.find((x) => !x.all_day && x.start) ?? tomorrow.events[0]
    const more = tomorrow.events.length > 1 ? `ほかに ${tomorrow.events.length - 1} 件。` : ''
    return pick([`明日は${eventPhrase(e)}があるよ。`, `明日は${eventPhrase(e)}。忘れないでね`], r) + more + (tasks ? `今日の ToDo はあと ${tasks} 件` : '')
  }
  if (tasks) {
    const top = today.tasks.find((x) => x.planned_for) ?? today.tasks.find((x) => x.starred) ?? today.tasks[0]
    return pick([`今日の ToDo は ${tasks} 件。まずは『${top.title}』から！`, `ToDo が ${tasks} 件あるよ。『${top.title}』はどう？`], r)
  }
  return null
}

/** 話しかけられたときの返事: その日の予定と ToDo を並べる */
export function agendaReply(a: Agenda, which: 'today' | 'tomorrow', part: 'all' | 'events' | 'tasks' = 'all'): string {
  const day = which === 'today' ? '今日' : '明日'
  const lines: string[] = []
  if (part !== 'tasks') {
    if (a.events.length) {
      lines.push(`${day}の予定は ${a.events.length} 件だよ。`)
      for (const e of a.events) lines.push(`・${e.all_day || !e.start ? '終日' : t(e.start)} ${e.title}${e.location ? `（${e.location}）` : ''}`)
    } else lines.push(`${day}の予定は入ってないよ。`)
  }
  if (part !== 'events') {
    const ts = a.tasks
    if (ts.length) {
      if (lines.length) lines.push('')
      lines.push(`${which === 'today' ? '' : '明日までの'}ToDo は ${ts.length} 件。`)
      for (const x of ts.slice(0, 8)) lines.push(`・${x.title}${plannedTag(x, a.date, which)}${x.starred ? '（進行中）' : ''}${x.due_time ? `（${t(x.due_time)}）` : ''}${x.overdue ? '（期限すぎ）' : ''}`)
      if (ts.length > 8) lines.push(`…ほか ${ts.length - 8} 件`)
    } else lines.push(`ToDo は${which === 'today' ? '' : '明日まで'}ぜんぶ片付いてる！`)
  }
  return lines.join('\n')
}
