import { cx } from '@/lib/cx'
import { webglAvailable } from '@/features/home/webgl'
import { updateSettings } from './useSettings'

/**
 * ホーム右上の 3D / 2D の切り替え（設定ボタンの横）。「2D にする」のように、押した後の名前で書く。
 * 3D が使えない端末では出さない（押しても 3D にならないので）
 */
export function HomeModeChip({ showing, className }: { showing: '3d' | '2d'; className?: string }) {
  if (!webglAvailable()) return null
  const to = showing === '3d' ? '2d' : '3d'
  return (
    <button type="button" onClick={() => updateSettings({ home3d: to === '3d' })} aria-label={to === '3d' ? '3D のホームにする' : '2D のホームにする'} title={to === '3d' ? '3D のホームにする' : '2D のホームにする'}
      className={cx('pointer-events-auto flex h-9 shrink-0 items-center gap-1 rounded-full border border-line bg-paper/90 pl-2 pr-2.5 text-[11px] font-bold text-espresso-700 shadow-card backdrop-blur', className)}>
      <span className="font-extrabold tracking-wide">{to === '3d' ? '3D' : '2D'}</span>にする
    </button>
  )
}
