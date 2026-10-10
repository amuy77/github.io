import type { ClipPurpose } from '@/lib/supabase/database.types'
import { cx } from '@/lib/cx'

/** 選べる 2 つ（「まだ」= unsorted は選択肢には出さない） */
export const CLIP_PURPOSES: { value: Exclude<ClipPurpose, 'unsorted'>; emoji: string; label: string; sub: string }[] = [
  { value: 'idea', emoji: '🏠', label: 'うちでやりたい', sub: 'ひらめき・試したいこと' },
  { value: 'reference', emoji: '👀', label: 'よそで見た', sub: '他のお店・SNS・商品' },
]

/** ネタに聞く質問はこれ 1 つだけ: うちでやりたい？ よそで見た？ */
export function ClipPurposePicker({ value, onChange, disabled }: { value: ClipPurpose; onChange: (v: ClipPurpose) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[14px] font-bold text-espresso-700">どっちのネタ？{value === 'unsorted' && <span className="ml-1.5 font-normal text-muted">（まだ決めてない）</span>}</span>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="ネタの種類">
        {CLIP_PURPOSES.map((p) => (
          <button key={p.value} type="button" role="radio" aria-checked={value === p.value} disabled={disabled} onClick={() => onChange(p.value)}
            className={cx('flex min-h-[52px] flex-col items-start gap-0.5 rounded-card border-2 px-3 py-2.5 text-left', value === p.value ? 'border-green-600 bg-green-600/10' : 'border-line bg-paper')}>
            <span className="text-[15px] font-bold">{p.emoji} {p.label}</span>
            <span className="text-[12px] text-muted">{p.sub}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** カードに付ける小さな印 */
export function ClipPurposeBadge({ value, className }: { value: ClipPurpose; className?: string }) {
  const style = { idea: 'bg-green-600/10 text-green-700', reference: 'bg-plum-400/15 text-plum-400', unsorted: 'border border-dashed border-line bg-paper/90 text-muted' }[value]
  const text = { idea: '🏠 うち', reference: '👀 よそ', unsorted: 'まだ' }[value]
  return <span className={cx('whitespace-nowrap rounded-chip px-1.5 py-0.5 text-[11px] font-bold', style, className)}>{text}</span>
}
