import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { EmojiPicker } from '@/components/ui/EmojiPicker'
import { ReorderRow } from '@/components/ui/ReorderRow'
import { Chip } from '@/components/ui/Chip'
import { Input } from '@/components/ui/Field'
import { Confirm, Sheet } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { isEnter } from '@/lib/keys'
import { IconEdit, IconPlus, IconTrash } from '@/components/ui/icons'
import type { GenreColor, GenreRow } from '@/lib/supabase/database.types'
import { autoEmoji, GENRE_EMOJI_CHOICES, genreEmoji } from './api'
import { GENRE_PALETTE, genreColor } from '@/lib/genreColors'
import { useGenreMutations, useGenres } from './hooks'
import { cx } from '@/lib/cx'

const hexOf = (c: GenreColor) => genreColor(c).hex

/** ジャンルの一覧（並び替え・編集・追加）。設定画面と、図鑑などから開くシートで使う */
export function GenreManager() {
  const genres = useGenres()
  const { reorder } = useGenreMutations()
  const [editing, setEditing] = useState<GenreRow | 'new' | null>(null)
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
      {list.length === 0 && <p className="rounded-[10px] bg-oat-50 px-3 py-3 text-center text-sm text-muted">ジャンルはまだないよ</p>}
      {list.map((g, i) => (
        <ReorderRow key={g.id} name={g.name} index={i} count={list.length} onMove={(dir) => move(i, dir)} onEdit={() => setEditing(g)}>
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: hexOf(g.color) }} aria-hidden />
          <span className="text-xl" aria-hidden>{genreEmoji(g)}</span>
          <span className="truncate font-bold">{g.name}</span>
        </ReorderRow>
      ))}
      <Button variant="secondary" icon={<IconPlus size={16} />} onClick={() => setEditing('new')}>ジャンルを追加</Button>
      <GenreEditSheet genre={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

/** ジャンル 1 つの追加・編集（名前・アイコン・色・削除） */
export function GenreEditSheet({ genre, onClose, onCreated }: { genre: GenreRow | 'new' | null; onClose: () => void; onCreated?: (g: GenreRow) => void }) {
  return (
    <Sheet open={genre !== null} onClose={onClose} title={genre === 'new' ? 'ジャンルを追加' : 'ジャンルを編集'}>
      {genre !== null && <GenreForm key={genre === 'new' ? 'new' : genre.id} genre={genre === 'new' ? null : genre} onClose={onClose} onCreated={onCreated} />}
    </Sheet>
  )
}

function GenreForm({ genre, onClose, onCreated }: { genre: GenreRow | null; onClose: () => void; onCreated?: (g: GenreRow) => void }) {
  const genres = useGenres()
  const { create, update, remove } = useGenreMutations()
  const toast = useToast()
  const [name, setName] = useState(genre?.name ?? '')
  const [emoji, setEmoji] = useState(genre?.emoji ?? '')
  const [color, setColor] = useState<GenreColor>(genre?.color ?? 'green')
  const [confirm, setConfirm] = useState(false)
  const busy = create.isPending || update.isPending
  const shown = emoji || autoEmoji(name)

  async function save() {
    const n = name.trim()
    if (!n) { toast('ジャンル名を入れてね', 'error'); return }
    if ((genres.data ?? []).some((g) => g.name === n && g.id !== genre?.id)) { toast('同じ名前のジャンルがもうあるよ', 'error'); return }
    try {
      if (genre) {
        await update.mutateAsync({ id: genre.id, patch: { name: n, emoji, color } })
        toast('ジャンルを保存したよ', 'success')
      } else {
        const g = await create.mutateAsync({ name: n, emoji, color, sort_order: (genres.data?.length ?? 0) + 1 })
        toast(`「${n}」を追加したよ`, 'success')
        onCreated?.(g)
      }
      onClose()
    } catch (e) {
      toast(e instanceof Error && /duplicate|unique/i.test(e.message) ? '同じ名前のジャンルがあります' : '保存できませんでした', 'error')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-3">
        <span className="grid size-14 shrink-0 place-items-center rounded-card text-3xl" style={{ background: hexOf(color) }} aria-hidden>{shown}</span>
        <div className="min-w-0 flex-1">
          <Input label="ジャンル名" placeholder="例: デザート / ホットサンド" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (isEnter(e)) void save() }} />
        </div>
      </div>

      <EmojiPicker value={emoji} onChange={setEmoji} choices={GENRE_EMOJI_CHOICES} lead={
        <button type="button" role="radio" aria-checked={emoji === ''} aria-label="名前から自動" onClick={() => setEmoji('')}
          className={cx('col-span-2 h-10 whitespace-nowrap rounded-[10px] border-2 text-[12px] font-bold', emoji === '' ? 'border-green-600 bg-green-600/10' : 'border-line bg-paper')}>
          自動 {autoEmoji(name)}
        </button>
      } />

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-bold text-espresso-700">色 <span className="font-normal text-muted">（{genreColor(color).label}）</span></span>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-9" role="radiogroup" aria-label="色">
          {GENRE_PALETTE.map((c) => (
            <button key={c.value} type="button" role="radio" aria-checked={color === c.value} aria-label={c.label} title={c.label} onClick={() => setColor(c.value)}
              className={cx('grid aspect-square place-items-center rounded-full border-2', color === c.value ? 'border-espresso-900' : 'border-transparent')}>
              <span className="size-[80%] rounded-full" style={{ background: c.hex }} />
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>やめる</Button>
        <Button full size="lg" loading={busy} onClick={save}>保存する</Button>
      </div>
      {genre && (
        <Button variant="ghost" className="text-brick-500" icon={<IconTrash size={16} />} onClick={() => setConfirm(true)}>このジャンルを削除</Button>
      )}
      <Confirm open={confirm} onClose={() => setConfirm(false)} title={`「${genre?.name}」を削除する？`} body="このジャンルのネタとレシピは「ジャンルなし」になるよ（ネタやレシピ自体は消えないよ）。" confirmLabel="削除する" danger
        onConfirm={() => { if (genre) remove.mutate(genre.id, { onSuccess: () => { toast('削除したよ'); onClose() } }) }} />
    </div>
  )
}

/** ネタ帳・図鑑やその編集から開く「ジャンルの追加・編集」シート */
export function GenreManagerSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="ジャンルの追加・編集">
      {open && <GenreManager />}
    </Sheet>
  )
}

/** ジャンルを選ぶチップの並び ＋「新しいジャンル」「編集」 */
export function GenrePicker({ value, onChange, label = 'ジャンル' }: { value: string | null; onChange: (id: string | null) => void; label?: string }) {
  const genres = useGenres()
  const [adding, setAdding] = useState(false)
  const [managing, setManaging] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-bold text-espresso-700">{label}</span>
      <div className="flex flex-wrap gap-2">
        {(genres.data ?? []).map((g) => <Chip key={g.id} active={value === g.id} onClick={() => onChange(value === g.id ? null : g.id)}>{genreEmoji(g)} {g.name}</Chip>)}
        <Chip onClick={() => setAdding(true)} icon={<IconPlus size={14} />} className="border-dashed">新しいジャンル</Chip>
        {(genres.data?.length ?? 0) > 0 && <Chip onClick={() => setManaging(true)} icon={<IconEdit size={14} />}>ジャンルを編集</Chip>}
      </div>
      <GenreEditSheet genre={adding ? 'new' : null} onClose={() => setAdding(false)} onCreated={(g) => onChange(g.id)} />
      <GenreManagerSheet open={managing} onClose={() => setManaging(false)} />
    </div>
  )
}
