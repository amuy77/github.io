import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cx } from '@/lib/cx'
import { IconChevronRight } from './icons'

/**
 * 設定の 1 グループ（iPhone の設定アプリと同じ形）: 見出し、角丸の箱に 1 行 1 項目、下に 1 行の補足
 */
export function SettingsGroup({ title, footer, children }: { title?: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2" aria-label={title}>
      {title && <h2 className="px-1 font-display text-[15px] font-bold text-espresso-700">{title}</h2>}
      <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-paper shadow-card">{children}</div>
      {footer && <p className="px-1 text-[13px] leading-relaxed text-muted">{footer}</p>}
    </section>
  )
}

interface RowProps {
  icon?: ReactNode
  title: string
  /** 名前の下の小さな説明 */
  sub?: ReactNode
  /** 右に出す今の値（灰色） */
  value?: ReactNode
  /** 押すと移る先（右に › が付く） */
  to?: string
  onClick?: () => void
  /** 右に置く部品（スイッチ・ボタン）。あれば › は出さない */
  trailing?: ReactNode
  /** ログアウトなど、取り消しにくい操作（赤） */
  danger?: boolean
}

/**
 * 設定の 1 行: アイコン・名前（＋説明）・右に今の値・›。行全体が押せる（高さ 52px 以上）
 */
export function SettingsRow({ icon, title, sub, value, to, onClick, trailing, danger }: RowProps) {
  const body = (
    <>
      {icon && <span className={cx('grid size-8 shrink-0 place-items-center rounded-[10px] text-[17px]', danger ? 'bg-brick-500/10 text-brick-500' : 'bg-oat-100')} aria-hidden>{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className={cx('block text-[16px] font-bold leading-snug', danger && 'text-center text-brick-500')}>{title}</span>
        {sub && <span className="block text-[13px] leading-snug text-muted">{sub}</span>}
      </span>
      {value !== undefined && <span className="max-w-[45%] shrink-0 truncate text-right text-[14px] text-muted">{value}</span>}
      {trailing ?? ((to || onClick) && !danger && <IconChevronRight size={18} className="shrink-0 text-muted" aria-hidden />)}
    </>
  )
  const cls = cx('flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 text-left', (to || onClick) && 'active:bg-oat-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-mustard-400', danger && 'justify-center')
  if (to) return <Link to={to} className={cls}>{body}</Link>
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{body}</button>
  return <div className={cls}>{body}</div>
}
