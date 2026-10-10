import type { RecipePurpose } from '@/lib/supabase/database.types'
import { cx } from '@/lib/cx'

/** 選べる 3 つ（未分類は「まだ選んでいない」状態なので選択肢には出さない） */
export const PURPOSES: { value: Exclude<RecipePurpose, 'unsorted'>; emoji: string; label: string; short: string; sub: string }[] = [
  { value: 'menu', emoji: '🍽️', label: 'お店のメニュー', short: 'メニュー', sub: 'いまお店で出している' },
  { value: 'idea', emoji: '🧪', label: 'ためしたい', short: 'ためしたい', sub: '試作中・これから作る' },
  { value: 'reference', emoji: '📚', label: 'お手本', short: 'お手本', sub: '本・他のお店のレシピ' },
]

/** お店のメニュー・ためしたい・お手本から選ぶ 3 択 */
export function PurposePicker({ value, onChange, disabled }: { value: RecipePurpose; onChange: (v: RecipePurpose) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[14px] font-bold text-espresso-700">どのレシピ？{value === 'unsorted' && <span className="ml-1.5 font-normal text-muted">（まだ決めてない）</span>}</span>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="レシピの種類">
        {PURPOSES.map((p) => (
          <button key={p.value} type="button" role="radio" aria-checked={value === p.value} disabled={disabled} onClick={() => onChange(p.value)}
            className={cx('flex min-h-[52px] flex-col items-start gap-0.5 rounded-card border-2 px-2.5 py-2.5 text-left', value === p.value ? 'border-green-600 bg-green-600/10' : 'border-line bg-paper')}>
            <span className="text-[13px] font-bold leading-tight">{p.emoji} {p.label}</span>
            <span className="text-[12px] leading-snug text-muted">{p.sub}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** カードや見出しに付ける小さな印 */
export function PurposeBadge({ value, className }: { value: RecipePurpose; className?: string }) {
  const style = { menu: 'bg-green-600 text-white', idea: 'bg-green-600/10 text-green-700', reference: 'bg-plum-400/15 text-plum-400', unsorted: 'border border-dashed border-line text-muted' }[value]
  const text = { menu: '🍽️ メニュー', idea: '🧪 ためしたい', reference: '📚 お手本', unsorted: 'まだ' }[value]
  return <span className={cx('whitespace-nowrap rounded-chip px-1.5 py-0.5 text-[11px] font-bold', style, className)}>{text}</span>
}
