import type { RecipePurpose } from '@/lib/supabase/database.types'
import { cx } from '@/lib/cx'

export const PURPOSES: { value: RecipePurpose; emoji: string; label: string; sub: string }[] = [
  { value: 'menu', emoji: '🍽️', label: 'お店のメニュー', sub: '確定して出しているレシピ' },
  { value: 'reference', emoji: '📚', label: '参考レシピ', sub: '本・他のお店・研究用' },
]

export const purposeOf = (v: RecipePurpose) => PURPOSES.find((p) => p.value === v) ?? PURPOSES[1]

/** 確定メニューか参考レシピかを選ぶ 2 択 */
export function PurposePicker({ value, onChange, disabled }: { value: RecipePurpose; onChange: (v: RecipePurpose) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-bold text-espresso-700">どっちのレシピ？</span>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="レシピの種類">
        {PURPOSES.map((p) => (
          <button key={p.value} type="button" role="radio" aria-checked={value === p.value} disabled={disabled} onClick={() => onChange(p.value)}
            className={cx('flex flex-col items-start gap-0.5 rounded-card border-2 px-3 py-2.5 text-left',
              value === p.value ? (p.value === 'menu' ? 'border-green-600 bg-green-600/10' : 'border-plum-400 bg-plum-400/10') : 'border-line bg-paper')}>
            <span className="text-[14px] font-bold">{p.emoji} {p.label}</span>
            <span className="text-[11px] text-muted">{p.sub}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** カードや見出しに付ける小さな印 */
export function PurposeBadge({ value, className }: { value: RecipePurpose; className?: string }) {
  return (
    <span className={cx('whitespace-nowrap rounded-chip px-1.5 py-0.5 text-[10px] font-bold', value === 'menu' ? 'bg-green-600 text-white' : 'bg-plum-400/15 text-plum-400', className)}>
      {value === 'menu' ? '🍽️ メニュー' : '📚 参考'}
    </span>
  )
}
