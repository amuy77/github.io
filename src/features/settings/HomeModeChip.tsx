import { cx } from '@/lib/cx'
import { webglAvailable } from '@/features/home/webgl'
import { updateSettings } from './useSettings'

/**
 * ホーム右上の 3D / 2D の切り替え（設定ボタンの横）。押すと反対側のホームになる。
 * 3D が使えない端末では出さない（押しても 3D にならないので）
 */
export function HomeModeChip({ showing, className }: { showing: '3d' | '2d'; className?: string }) {
  if (!webglAvailable()) return null
  const to = showing === '3d' ? '2d' : '3d'
  return (
    <button type="button" onClick={() => updateSettings({ home3d: to === '3d' })} aria-label={to === '3d' ? '3D のホームにする' : '2D のホームにする'} title={to === '3d' ? '3D のホームにする' : '2D のホームにする'}
      className={cx('pointer-events-auto grid size-9 shrink-0 place-items-center rounded-full border border-line bg-paper/90 text-[12px] font-extrabold tracking-wide text-espresso-700 shadow-card backdrop-blur', className)}>
      {to === '3d' ? '3D' : '2D'}
    </button>
  )
}
