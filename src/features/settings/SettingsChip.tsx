import { Link } from 'react-router'
import { IconSettings } from '@/components/ui/icons'
import { paths } from '@/app/routes'
import { cx } from '@/lib/cx'

/** ホーム右上の設定ボタン（スマホだけ。パソコンは左のメニューに設定がある） */
export function SettingsChip({ className }: { className?: string }) {
  return (
    <Link to={paths.settings} aria-label="設定" title="設定" className={cx('pointer-events-auto grid size-9 shrink-0 place-items-center rounded-full border border-line bg-paper/90 text-espresso-700 shadow-card backdrop-blur md:hidden', className)}>
      <IconSettings size={19} />
    </Link>
  )
}
