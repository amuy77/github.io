import { useEffect } from 'react'
import { Link } from 'react-router'
import { paths } from '@/app/routes'
import { cx } from '@/lib/cx'
import { writeNotesSide, type NotesSide } from './notes'

/** 「ノート」の一番上の切り替え: 📌 ネタ帳 ｜ 📖 図鑑。見た方を覚えておき、次にノートのタブを押したらそちらを開く */
export function NotesSwitch({ current }: { current: NotesSide }) {
  useEffect(() => { writeNotesSide(current) }, [current])
  const item = (side: NotesSide, label: string, to: string) => (
    <Link to={to} replace role="tab" aria-selected={current === side}
      className={cx('flex h-10 flex-1 items-center justify-center rounded-chip text-[14px] font-bold transition-colors', current === side ? 'bg-espresso-900 text-oat-50' : 'text-espresso-900 hover:bg-oat-100')}>
      {label}
    </Link>
  )
  return (
    <div className="mb-2 flex gap-1 rounded-chip border border-line bg-paper p-1" role="tablist" aria-label="ノート">
      {item('clips', '📌 ネタ帳', paths.clips)}
      {item('recipes', '📖 図鑑', paths.recipes)}
    </div>
  )
}
