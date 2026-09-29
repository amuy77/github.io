import type { ClipPurpose } from '@/lib/supabase/database.types'
import { cx } from '@/lib/cx'

/** 選べる 2 つ（未分類は「まだ選んでいない」状態なので選択肢には出さない） */
export const CLIP_PURPOSES: { value: Exclude<ClipPurpose, 'unsorted'>; emoji: string; label: string; sub: string }[] = [
  { value: 'idea', emoji: '💡', label: 'アイデア', sub: 'うちでやりたいこと・ヒント' },
  { value: 'reference', emoji: '📚', label: '参考', sub: '他のお店・商品・情報' },
]

/** アイデアか参考かを選ぶ 2 択 */
export function ClipPurposePicker({ value, onChange, disabled }: { value: ClipPurpose; onChange: (v: ClipPurpose) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-bold text-espresso-700">どっちのネタ？{value === 'unsorted' && <span className="ml-1.5 font-normal text-muted">（まだ未分類）</span>}</span>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="ネタの種類">
        {CLIP_PURPOSES.map((p) => (
          <button key={p.value} type="button" role="radio" aria-checked={value === p.value} disabled={disabled} onClick={() => onChange(p.value)}
            className={cx('flex flex-col items-start gap-0.5 rounded-card border-2 px-3 py-2.5 text-left',
              value === p.value ? (p.value === 'idea' ? 'border-mustard-400 bg-mustard-400/15' : 'border-plum-400 bg-plum-400/10') : 'border-line bg-paper')}>
            <span className="text-[14px] font-bold">{p.emoji} {p.label}</span>
            <span className="text-[11px] text-muted">{p.sub}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** カードに付ける小さな印 */
export function ClipPurposeBadge({ value, className }: { value: ClipPurpose; className?: string }) {
  const style = { idea: 'bg-mustard-400 text-espresso-900', reference: 'bg-plum-400/15 text-plum-400', unsorted: 'border border-dashed border-line bg-paper/90 text-muted' }[value]
  const text = { idea: '💡 アイデア', reference: '📚 参考', unsorted: '未分類' }[value]
  return <span className={cx('whitespace-nowrap rounded-chip px-1.5 py-0.5 text-[10px] font-bold', style, className)}>{text}</span>
}
