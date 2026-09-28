import { Link } from 'react-router'
import { Mascot } from '@/components/mascot/Mascot'
import { paths } from '@/app/routes'
import { cx } from '@/lib/cx'

/** ホーム上部の「LaRa に聞く」ボタン */
export function AskChip({ className }: { className?: string }) {
  return (
    <Link to={paths.ask} aria-label="LaRa に聞く" className={cx('pointer-events-auto flex items-center gap-1 rounded-chip border border-line bg-paper/90 py-0.5 pl-0.5 pr-3 text-[13px] font-bold shadow-card backdrop-blur md:hidden', className)}>
      <Mascot size={30} /> 聞く
    </Link>
  )
}
