import type { ReactNode } from 'react'
import { Card } from './Card'
import { IconButton } from './Button'
import { IconChevronLeft, IconChevronRight, IconEdit } from './icons'

/** 並び替えできる一覧の 1 行: 中身（押すと編集）＋ 上へ・下へ・編集 */
export function ReorderRow({ name, children, index, count, onMove, onEdit }: { name: string; children: ReactNode; index: number; count: number; onMove: (dir: -1 | 1) => void; onEdit: () => void }) {
  return (
    <Card className="flex items-center gap-2 py-2">
      <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-2 text-left">{children}</button>
      <IconButton label="上へ" onClick={() => onMove(-1)} disabled={index === 0}><IconChevronLeft size={16} className="rotate-90" /></IconButton>
      <IconButton label="下へ" onClick={() => onMove(1)} disabled={index === count - 1}><IconChevronRight size={16} className="rotate-90" /></IconButton>
      <IconButton label={`${name} を編集`} onClick={onEdit}><IconEdit size={16} /></IconButton>
    </Card>
  )
}
