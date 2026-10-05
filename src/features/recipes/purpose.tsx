import type { RecipePurpose } from '@/lib/supabase/database.types'
import { cx } from '@/lib/cx'

/** 選べる 3 つ（未分類は「まだ選んでいない」状態なので選択肢には出さない） */
export const PURPOSES: { value: Exclude<RecipePurpose, 'unsorted'>; emoji: string; label: string; short: string; sub: string }[] = [
  { value: 'menu', emoji: '🍽️', label: 'お店のメニュー', short: 'メニュー', sub: '確定して出しているレシピ' },
  { value: 'idea', emoji: '💡', label: 'アイデア', short: 'アイデア', sub: '試作中・うちでやりたい' },
  { value: 'reference', emoji: '📚', label: '参考レシピ', short: '参考', sub: '本・他のお店・研究用' },
]

const PICKED: Record<Exclude<RecipePurpose, 'unsorted'>, string> = {
  menu: 'border-green-600 bg-green-600/10',
  idea: 'border-mustard-400 bg-mustard-400/15',
  reference: 'border-plum-400 bg-plum-400/10',
}

/** お店のメニュー・アイデア・参考レシピから選ぶ 3 択 */
export function PurposePicker({ value, onChange, disabled }: { value: RecipePurpose; onChange: (v: RecipePurpose) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-bold text-espresso-700">どのレシピ？{value === 'unsorted' && <span className="ml-1.5 font-normal text-muted">（まだ未分類）</span>}</span>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="レシピの種類">
        {PURPOSES.map((p) => (
          <button key={p.value} type="button" role="radio" aria-checked={value === p.value} disabled={disabled} onClick={() => onChange(p.value)}
            className={cx('flex flex-col items-start gap-0.5 rounded-card border-2 px-2.5 py-2.5 text-left', value === p.value ? PICKED[p.value] : 'border-line bg-paper')}>
            <span className="text-[13px] font-bold leading-tight">{p.emoji} {p.label}</span>
            <span className="text-[11px] leading-snug text-muted">{p.sub}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** カードや見出しに付ける小さな印 */
export function PurposeBadge({ value, className }: { value: RecipePurpose; className?: string }) {
  const style = { menu: 'bg-green-600 text-white', idea: 'bg-mustard-400/25 text-espresso-900', reference: 'bg-plum-400/15 text-plum-400', unsorted: 'border border-dashed border-line text-muted' }[value]
  const text = { menu: '🍽️ メニュー', idea: '💡 アイデア', reference: '📚 参考', unsorted: '未分類' }[value]
  return <span className={cx('whitespace-nowrap rounded-chip px-1.5 py-0.5 text-[10px] font-bold', style, className)}>{text}</span>
}
