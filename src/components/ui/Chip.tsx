import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from '@/lib/cx'

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  icon?: ReactNode
  count?: number
}

export function Chip({ active, icon, count, className, children, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cx(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-chip border px-3 text-[13px] font-bold transition-colors',
        active ? 'border-green-600 bg-green-600 text-white' : 'border-line bg-paper text-espresso-900 hover:bg-oat-100',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
      {count !== undefined && <span className={cx('text-xs', active ? 'text-white/80' : 'text-muted')}>{count}</span>}
    </button>
  )
}

/** 小さなタグ（表示専用） */
export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('inline-block rounded-chip border border-line bg-oat-50 px-2 py-0.5 text-[11px] font-bold text-espresso-700', className)}>{children}</span>
}

/** 破線の円のスタンプ */
export function Stamp({ children, color = 'text-brick-500', className }: { children: ReactNode; color?: string; className?: string }) {
  return <span className={cx('stamp', color, className)}>{children}</span>
}

/** 数字バッジ */
export function CountBadge({ n, className }: { n: number; className?: string }) {
  if (n <= 0) return null
  return <span className={cx('inline-grid h-5 min-w-5 place-items-center rounded-chip bg-brick-500 px-1.5 text-[11px] font-bold text-white', className)}>{n > 99 ? '99+' : n}</span>
}
