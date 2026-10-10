import { Link } from 'react-router'
import { IconSettings } from '@/components/ui/icons'
import { paths } from '@/app/routes'
import { cx } from '@/lib/cx'

/** ホーム右上の設定ボタン（スマホだけ。パソコンは左のメニューに設定がある） */
export function SettingsChip({ className }: { className?: string }) {
  return (
    <Link to={paths.settings} aria-label="設定" title="設定" className={cx('pointer-events-auto flex h-9 shrink-0 items-center gap-1 rounded-full border border-line bg-paper/90 pl-2 pr-2.5 text-[11px] font-bold text-espresso-700 shadow-card backdrop-blur md:hidden', className)}>
      <IconSettings size={16} />設定
    </Link>
  )
}
