import { IconStar } from './icons'
import { cx } from '@/lib/cx'
import { DETAIL_WORDS, SIMPLE_MAX, SIMPLE_WORDS, fromSimple, toSimple } from '@/lib/rating'
import { useSettings } from '@/features/settings/useSettings'

/**
 * ★の評価。表の画面はいつも 3 段階（いまいち／ふつう／また食べたい）。
 * max は DB の段階（ネタ・お店 5、レシピ 3）。設定で「★をくわしく」にすると max 段階で出す（Yuma 向け）。
 * value=null は「まだ」。同じ★をもう一度押しても消えない（確かめるつもりで押して消えないように）。消すのは小さな「消す」。
 */
export function RatingInput({ value, onChange, max, label, disabled, words }: { value: number | null; onChange: (v: number | null) => void; max: 3 | 5; label?: string; disabled?: boolean
  /** くわしい段階のときの ★ ごとのひとこと（無ければ共通のもの） */
  words?: readonly string[] }) {
  const detail = useSettings().ratingDetail
  const shownMax = detail ? max : SIMPLE_MAX
  const shown = detail ? value : toSimple(value, max)
  const pick = (n: number) => onChange(detail ? n : fromSimple(n, max))
  const text = shown === null ? 'まだ付けてないよ。あとでも OK' : (detail ? (words ?? DETAIL_WORDS[max]) : SIMPLE_WORDS)[shown - 1]
  return (
    <div className="flex flex-col gap-1.5">
      {label && <span className="text-[14px] font-bold text-espresso-700">{label}</span>}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center" role="radiogroup" aria-label={label ?? '評価'}>
          {Array.from({ length: shownMax }, (_, i) => i + 1).map((n) => {
            const on = shown !== null && n <= shown
            return (
              <button key={n} type="button" role="radio" aria-checked={shown === n} aria-label={`${n} つ星`} disabled={disabled} onClick={() => pick(n)}
                className={cx('grid size-11 place-items-center rounded-full transition-transform active:scale-90', on ? 'text-mustard-400' : 'text-line hover:text-mustard-300')}>
                <IconStar size={30} filled={on} />
              </button>
            )
          })}
        </div>
        {shown !== null && <button type="button" disabled={disabled} onClick={() => onChange(null)} className="text-[14px] font-bold text-muted underline underline-offset-2">消す</button>}
      </div>
      <p className="text-[14px] text-muted">{text}</p>
    </div>
  )
}

/** 表示専用の小さい星。null は「まだ」の札（showHold=false なら何も出さない） */
export function RatingStars({ value, max, size = 12, showHold = true, className }: { value: number | null; max: 3 | 5; size?: number; showHold?: boolean; className?: string }) {
  const detail = useSettings().ratingDetail
  const shownMax = detail ? max : SIMPLE_MAX
  const shown = detail ? value : toSimple(value, max)
  if (shown === null) return showHold ? <span className={cx('inline-flex shrink-0 items-center whitespace-nowrap rounded-chip bg-oat-100 px-1.5 py-0.5 text-[11px] font-bold text-muted', className)}>まだ</span> : null
  return (
    <span className={cx('inline-flex items-center text-mustard-400', className)} aria-label={`${shownMax} 段階中 ${shown}`}>
      {Array.from({ length: shownMax }, (_, i) => <IconStar key={i} size={size} filled={i < shown} className={i < shown ? '' : 'text-line'} />)}
    </span>
  )
}
