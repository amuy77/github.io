import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button, IconButton } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Confirm } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { IconCheck, IconChevronLeft, IconChevronRight, IconEdit, IconPlus, IconTrash } from '@/components/ui/icons'
import type { GenreColor, GenreRow } from '@/lib/supabase/database.types'
import { GENRE_COLORS, genreEmoji } from './api'
import { useGenreMutations, useGenres } from './hooks'
import { cx } from '@/lib/cx'

/** ジャンルの追加・名前変更・色・並び替え・削除 */
export function GenreManager() {
  const genres = useGenres()
  const { create, update, remove, reorder } = useGenreMutations()
  const toast = useToast()
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState<GenreColor>('green')
  const [confirm, setConfirm] = useState<GenreRow | null>(null)
  const list = genres.data ?? []

  const move = (i: number, dir: -1 | 1) => {
    const ids = list.map((g) => g.id)
    const j = i + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    reorder.mutate(ids)
  }

  return (
    <div className="flex flex-col gap-2">
      {list.map((g, i) => (
        <Card key={g.id} className="flex items-center gap-2 py-2">
          <span className="text-xl" aria-hidden>{genreEmoji(g.name)}</span>
          {editing === g.id ? (
            <>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" aria-label="ジャンル名" onKeyDown={(e) => { if (e.key === 'Enter') { update.mutate({ id: g.id, patch: { name: name.trim() } }); setEditing(null) } }} />
              <IconButton label="保存" onClick={() => { if (name.trim()) update.mutate({ id: g.id, patch: { name: name.trim() } }); setEditing(null) }}><IconCheck /></IconButton>
            </>
          ) : (
            <>
              <span className="flex-1 truncate font-bold">{g.name}</span>
              <div className="flex gap-1">
                {GENRE_COLORS.map((c) => (
                  <button key={c.value} type="button" aria-label={c.label} aria-pressed={g.color === c.value} onClick={() => update.mutate({ id: g.id, patch: { color: c.value } })}
                    className={cx('size-5 rounded-full border-2', c.swatch, g.color === c.value ? 'border-espresso-900' : 'border-transparent opacity-60')} />
                ))}
              </div>
              <IconButton label="上へ" className="size-8" onClick={() => move(i, -1)} disabled={i === 0}><IconChevronLeft size={16} className="rotate-90" /></IconButton>
              <IconButton label="下へ" className="size-8" onClick={() => move(i, 1)} disabled={i === list.length - 1}><IconChevronRight size={16} className="rotate-90" /></IconButton>
              <IconButton label="名前を変える" className="size-8" onClick={() => { setEditing(g.id); setName(g.name) }}><IconEdit size={16} /></IconButton>
              <IconButton label="削除" className="size-8 text-brick-500" onClick={() => setConfirm(g)}><IconTrash size={16} /></IconButton>
            </>
          )}
        </Card>
      ))}
      <Card className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Input placeholder="新しいジャンル（例: デザート）" value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="新しいジャンル名" />
          <Button icon={<IconPlus size={16} />} disabled={!newName.trim() || create.isPending} onClick={async () => {
            try { await create.mutateAsync({ name: newName.trim(), color: newColor, sort_order: list.length + 1 }); setNewName(''); toast('ジャンルを追加しました', 'success') } catch (e) { toast(e instanceof Error && /duplicate|unique/i.test(e.message) ? '同じ名前のジャンルがあります' : '追加できませんでした', 'error') }
          }}>追加</Button>
        </div>
        <div className="flex gap-1.5">{GENRE_COLORS.map((c) => <button key={c.value} type="button" aria-label={c.label} aria-pressed={newColor === c.value} onClick={() => setNewColor(c.value)} className={cx('size-6 rounded-full border-2', c.swatch, newColor === c.value ? 'border-espresso-900' : 'border-transparent opacity-60')} />)}</div>
      </Card>
      <Confirm open={!!confirm} onClose={() => setConfirm(null)} title={`「${confirm?.name}」を削除しますか？`} body="このジャンルのレシピは「ジャンルなし」になります（レシピ自体は消えません）。" confirmLabel="削除する" danger onConfirm={() => confirm && remove.mutate(confirm.id)} />
    </div>
  )
}
