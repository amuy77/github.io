import { useEffect, useMemo, useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Mascot } from '@/components/mascot/Mascot'
import { cx } from '@/lib/cx'
import { addDays, today, weekStart } from '@/lib/dates'
import { useMenuLogs } from '@/features/menu/hooks'
import { useRecipes } from '@/features/recipes/hooks'
import { useClips } from '@/features/clips/hooks'
import { readLetters, saveLetters, writeLetter, type Letter } from './letters'

/** 週のはじめに LaRa が手紙を書く（その週の分がまだなら、先週の記録がそろったところで書いて端末に取っておく） */
function useWeeklyLetter() {
  const week = weekStart(today())
  const [letters, setLetters] = useState<Letter[]>(readLetters)
  const has = letters.some((l) => l.id === week)
  const logs = useMenuLogs(addDays(week, -7), addDays(week, -1), !has)
  const recipes = useRecipes(!has)
  const clips = useClips(!has)
  const ready = !has && !!logs.data && !!recipes.data && !!clips.data
  // 書いた手紙は state ではなく計算で足す（effect の中で state を変えると描き直しが重なる）。端末への保存だけ effect で
  const fresh = useMemo(() => (ready ? writeLetter({ week, logs: logs.data!, recipes: recipes.data!, clips: clips.data! }) : null), [ready]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (fresh) saveLetters([fresh, ...readLetters().filter((l) => l.id !== fresh.id)]) }, [fresh])
  const all = fresh ? [fresh, ...letters.filter((l) => l.id !== fresh.id)] : letters
  const markRead = () => { const next = all.map((l) => ({ ...l, read: true })); saveLetters(next); setLetters(next) }
  return { letters: all, unread: all.some((l) => !l.read), markRead }
}

/** ホーム右上の ✉️。未読の手紙があれば赤い点。押すと手紙を開く（これまでの手紙も読み返せる） */
export function LetterChip({ className }: { className?: string }) {
  const { letters, unread, markRead } = useWeeklyLetter()
  const [open, setOpen] = useState(false)
  const [shown, setShown] = useState(0)
  if (!letters.length) return null
  const letter = letters[shown] ?? letters[0]
  return (
    <>
      <button type="button" onClick={() => { setShown(0); setOpen(true); markRead() }} aria-label={unread ? 'LaRa からの手紙（未読）' : 'LaRa からの手紙'} title="LaRa からの手紙"
        className={cx('pointer-events-auto relative grid size-9 shrink-0 place-items-center rounded-full border border-line bg-paper/90 text-[17px] shadow-card backdrop-blur', className)}>
        ✉️
        {unread && <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-brick-500" aria-hidden />}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="LaRa からの手紙">
        <div className="flex flex-col gap-4">
          <article className="relative rounded-card border border-mustard-300 bg-[#FFF8E6] p-4 pb-5 shadow-card" aria-label={`${letter.week} の手紙`}>
            <div className="flex flex-col gap-2 text-[15px] leading-relaxed text-espresso-900">
              {letter.lines.map((t, i) => <p key={i} className={i === letter.lines.length - 1 ? 'text-right font-bold' : ''}>{t}</p>)}
            </div>
            <Mascot size={44} className="absolute -bottom-3 -left-2" />
          </article>
          {letters.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-[13px] font-bold text-espresso-700">これまでの手紙</p>
              <div className="flex flex-wrap gap-2">
                {letters.map((l, i) => (
                  <button key={l.id} type="button" onClick={() => setShown(i)} aria-pressed={i === shown}
                    className={cx('rounded-chip border px-3 py-1.5 text-[13px] font-bold', i === shown ? 'border-green-600 bg-green-600 text-white' : 'border-line bg-paper')}>
                    {Number(l.week.slice(5, 7))}/{Number(l.week.slice(8, 10))} の週
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Sheet>
    </>
  )
}
