import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { IconCheck } from '@/components/ui/icons'
import { cx } from '@/lib/cx'

/** えらぶモード（まとめて動かす）: on = えらんでいる、toggle = 押したとき */
export interface Pick { on: boolean; toggle: () => void }

/**
 * カードや行の「押せる部分」。ふだんはリンク（開く）、えらぶモードではボタン（えらぶ／外す）。
 * えらぶモードでは ○（えらぶと緑の ✓）を重ねる。カードは右上（左上のジャンル札と重ならないように）、行は左
 */
export function Pressable({ to, pick, corner = 'right', className, children }: { to: string; pick?: Pick; corner?: 'left' | 'right'; className: string; children: ReactNode }) {
  if (!pick) return <Link to={to} className={className}>{children}</Link>
  return (
    <button type="button" aria-pressed={pick.on} onClick={pick.toggle} className={cx(className, 'w-full text-left')}>
      {children}
      <span aria-hidden className={cx('absolute top-2 z-10 grid size-7 place-items-center rounded-full border-2 shadow-card', corner === 'left' ? 'left-2' : 'right-2', pick.on ? 'border-green-600 bg-green-600 text-white' : 'border-line bg-paper/95')}>
        {pick.on && <IconCheck size={16} />}
      </span>
    </button>
  )
}
