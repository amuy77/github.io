import { IconStar } from './icons'
import { cx } from '@/lib/cx'

/**
 * 星の評価。max=5（ネタ）/ 3（レシピ）。value=null は「保留」。
 * 同じ星をもう一度押すと保留に戻る。
 */
export function RatingInput({ value, onChange, max, label, disabled }: { value: number | null; onChange: (v: number | null) => void; max: 3 | 5; label?: string; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <span className="text-[13px] font-bold text-espresso-700">{label}</span>}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center" role="radiogroup" aria-label={label ?? '評価'}>
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
            const on = value !== null && n <= value
            return (
              <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} つ星`} disabled={disabled}
                onClick={() => onChange(value === n ? null : n)}
                className={cx('grid size-11 place-items-center rounded-full transition-transform active:scale-90', on ? 'text-mustard-400' : 'text-line hover:text-mustard-300')}>
                <IconStar size={30} filled={on} />
              </button>
            )
          })}
        </div>
        <button type="button" disabled={disabled} onClick={() => onChange(null)} aria-pressed={value === null}
          className={cx('h-9 rounded-chip border px-3 text-[13px] font-bold', value === null ? 'border-espresso-700 bg-espresso-900 text-white' : 'border-line bg-paper text-muted hover:bg-oat-100')}>
          保留
        </button>
      </div>
      <p className="text-xs text-muted">{value === null ? 'まだ決めなくて OK。あとで付けられます' : RATING_WORDS[max][value - 1]}</p>
    </div>
  )
}

const RATING_WORDS: Record<3 | 5, string[]> = {
  5: ['いまひとつ', 'ふつう', 'いい感じ', 'かなり好き', '絶対やりたい / 最高'],
  3: ['要改善', 'いい', '看板にできる'],
}

/** 表示専用の小さい星。null は「保留」バッジ */
export function RatingStars({ value, max, size = 12, showHold = true, className }: { value: number | null; max: 3 | 5; size?: number; showHold?: boolean; className?: string }) {
  if (value === null) return showHold ? <span className={cx('inline-flex shrink-0 items-center whitespace-nowrap rounded-chip bg-oat-100 px-1.5 py-0.5 text-[10px] font-bold text-muted', className)}>保留</span> : null
  return (
    <span className={cx('inline-flex items-center text-mustard-400', className)} aria-label={`${max} 段階中 ${value}`}>
      {Array.from({ length: max }, (_, i) => <IconStar key={i} size={size} filled={i < value} className={i < value ? '' : 'text-line'} />)}
    </span>
  )
}
