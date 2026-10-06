import { cx } from '@/lib/cx'

/**
 * オン・オフのスイッチ（iPhone と同じ 51×31）。オフでも枠が見えるように少し濃い色にする。
 * label は読み上げ用（見た目のラベルは行の側に書く）
 */
export function Toggle({ checked, onChange, label, disabled, className }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; className?: string }) {
  return (
    <label className={cx('relative inline-flex min-h-11 shrink-0 cursor-pointer items-center', disabled && 'cursor-not-allowed opacity-50', className)}>
      <input type="checkbox" role="switch" aria-label={label} className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="h-[31px] w-[51px] rounded-full bg-[#cbbfae] transition-colors peer-checked:bg-green-600 peer-focus-visible:outline-2 peer-focus-visible:outline-mustard-400" aria-hidden />
      <span className="pointer-events-none absolute left-[2px] top-1/2 size-[27px] -translate-y-1/2 rounded-full bg-paper shadow transition-transform peer-checked:translate-x-5" aria-hidden />
    </label>
  )
}
