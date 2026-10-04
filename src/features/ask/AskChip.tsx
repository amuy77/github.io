import { Link } from 'react-router'
import { paths } from '@/app/routes'
import { cx } from '@/lib/cx'

/** ホーム下の案内カードに置く小さな「LaRa に聞く」ボタン */
export function AskChip({ className }: { className?: string }) {
  return (
    <Link to={paths.ask} aria-label="LaRa に聞く" className={cx('flex h-9 shrink-0 items-center rounded-chip border border-line bg-paper px-2.5 text-[12px] font-bold md:hidden', className)}>
      🔍 聞く
    </Link>
  )
}
