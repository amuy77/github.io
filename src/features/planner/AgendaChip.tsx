import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { SegmentedTabs } from '@/components/ui/Page'
import { Button } from '@/components/ui/Button'
import { cx } from '@/lib/cx'
import { IconCalendar } from '@/components/ui/icons'
import { PLANNER_URL, openExternal, usePlannerAgenda } from './api'
import type { Agenda } from './agendaLine'

const t = (s: string) => s.replace(/^0(\d)/, '$1')

/** 1 日分の予定と ToDo（読むだけ。追加・チェックは Planner で） */
function DayAgenda({ agenda, label }: { agenda: Agenda; label: string }) {
  const events = [...agenda.events].sort((a, b) => Number(!a.all_day) - Number(!b.all_day) || (a.start ?? '').localeCompare(b.start ?? ''))
  const tasks = [...agenda.tasks].sort((a, b) => Number(b.overdue) - Number(a.overdue) || Number(b.starred) - Number(a.starred))
  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2" aria-label={`${label}の予定`}>
        <p className="text-[13px] font-bold text-espresso-700">📅 予定</p>
        {events.length === 0 ? <p className="text-sm text-muted">予定はないよ</p> : events.map((e, i) => (
          <div key={i} className="flex items-start gap-3 rounded-[12px] border border-line bg-paper px-3 py-2.5">
            <span className="w-14 shrink-0 pt-0.5 text-[13px] font-bold tabular-nums text-green-700">{e.all_day || !e.start ? '終日' : t(e.start)}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold leading-snug">{e.title}</p>
              {(e.location || (e.end && !e.all_day)) && <p className="truncate text-xs text-muted">{[e.end && !e.all_day ? `〜${t(e.end)}` : '', e.location ?? ''].filter(Boolean).join(' ・ ')}</p>}
            </div>
          </div>
        ))}
      </section>
      <section className="flex flex-col gap-2" aria-label={`${label}の ToDo`}>
        <p className="text-[13px] font-bold text-espresso-700">✅ ToDo</p>
        {tasks.length === 0 ? <p className="text-sm text-muted">ToDo はないよ</p> : tasks.map((x, i) => (
          <div key={i} className="flex items-center gap-3 rounded-[12px] border border-line bg-paper px-3 py-2.5">
            <span className={cx('size-4 shrink-0 rounded-full border-2', x.overdue ? 'border-brick-500' : 'border-line')} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold leading-snug">{x.starred && '⭐ '}{x.title}</p>
              <p className="truncate text-xs text-muted">{[x.list, x.overdue ? '期限すぎ' : x.due_time ? `${t(x.due_time)} まで` : ''].filter(Boolean).join(' ・ ')}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}

/**
 * ホーム右上の 📅。ふだんはしまっておいて、押すと今日・明日の予定と ToDo を見られる（Planner と連携。書き込みは Planner で）。
 * Planner につながらないときは出さない
 */
export function AgendaChip({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const [day, setDay] = useState<'today' | 'tomorrow'>('today')
  const today = usePlannerAgenda('today').data
  const tomorrow = usePlannerAgenda('tomorrow', open).data
  if (!today) return null
  const n = today.events.length + today.tasks.length
  const shown = day === 'today' ? today : tomorrow
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`今日の予定と ToDo（${n} 件）`} title="今日の予定と ToDo"
        className={cx('pointer-events-auto relative flex h-9 shrink-0 items-center gap-1 rounded-full border border-line bg-paper/90 px-2 text-[11px] font-bold text-espresso-700 shadow-card backdrop-blur', className)}>
        <IconCalendar size={15} />予定
        {n > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-green-600 px-1 text-[10px] font-bold leading-none text-white" aria-hidden>{n}</span>}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="予定と ToDo">
        <div className="flex flex-col gap-4">
          <SegmentedTabs value={day} onChange={setDay} options={[{ value: 'today', label: '今日' }, { value: 'tomorrow', label: '明日' }]} className="self-start" />
          {shown ? <DayAgenda agenda={shown} label={day === 'today' ? '今日' : '明日'} /> : <p className="text-sm text-muted">読み込み中…</p>}
          <Button variant="secondary" full onClick={() => openExternal(PLANNER_URL)}>Planner で開く ↗</Button>
          <p className="text-center text-xs text-muted">予定や ToDo の追加・チェックは Planner で。ここには自動で反映されるよ</p>
        </div>
      </Sheet>
    </>
  )
}
