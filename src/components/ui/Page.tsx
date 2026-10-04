import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { IconArrowLeft } from './icons'
import { IconButton } from './Button'
import { cx } from '@/lib/cx'

/**
 * ページ共通ヘッダー。明朝の見出し + 右側にアクション。
 * back に文字列を渡すと、開いた元の画面があればそこへ（履歴を 1 つ戻る＝スクロール位置も戻る）、
 * 直リンクで開いたときだけその文字列の画面へ。onBack を渡すと戻るの動きを差し替えられる（未保存の確認など）
 */
export function PageHeader({ title, sub, back, onBack, actions, className }: { title: ReactNode; sub?: ReactNode; back?: boolean | string; onBack?: () => void; actions?: ReactNode; className?: string }) {
  const nav = useNavigate()
  const fromApp = useLocation().key !== 'default'
  const goBack = () => { if (onBack) onBack(); else if (typeof back === 'string' && !fromApp) nav(back); else nav(-1) }
  return (
    <header className={cx('sticky top-0 z-20 -mx-4 mb-3 flex items-center gap-2 bg-oat-50/90 px-4 pb-2 pt-[calc(10px+var(--safe-top))] backdrop-blur', className)}>
      {(back || onBack) && <IconButton label="戻る" className="-ml-2" onClick={goBack}><IconArrowLeft /></IconButton>}
      <div className="min-w-0 flex-1">
        <h1 className="font-display truncate text-[22px] font-extrabold leading-tight">{title}</h1>
        {sub && <p className="text-xs text-muted">{sub}</p>}
      </div>
      {actions}
    </header>
  )
}

export function SectionTitle({ children, count, right, className }: { children: ReactNode; count?: number | string; right?: ReactNode; className?: string }) {
  return (
    <div className={cx('mt-2 flex items-baseline gap-2', className)}>
      <h2 className="font-display text-[17px] font-bold">{children}</h2>
      {count !== undefined && <span className="text-xs text-muted">{count}</span>}
      <div className="ml-auto">{right}</div>
    </div>
  )
}

export function EmptyState({ emoji, title, body, action }: { emoji: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-line px-6 py-10 text-center">
      <span className="text-4xl" aria-hidden>{emoji}</span>
      <p className="font-display text-base font-bold">{title}</p>
      {body && <p className="max-w-xs text-sm text-muted">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/** 読み込みに失敗したとき。「無い」と区別して、やり直せるようにする */
export function LoadError({ onRetry, body }: { onRetry: () => void; body?: string }) {
  return (
    <EmptyState emoji="📡" title="読み込めませんでした" body={body ?? 'つながりが悪いのかも。もう一度試してみてね'}
      action={<button type="button" onClick={onRetry} className="h-10 rounded-chip border border-line bg-paper px-4 text-sm font-bold">もう一度</button>} />
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-[10px] bg-oat-100', className)} aria-hidden />
}

export function SegmentedTabs<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <div className={cx('inline-flex rounded-chip border border-line bg-paper p-0.5', className)} role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={o.value === value} onClick={() => onChange(o.value)}
          className={cx('h-10 rounded-chip px-3 text-[13px] font-bold transition-colors', o.value === value ? 'bg-green-600 text-white' : 'text-espresso-900 hover:bg-oat-100')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
