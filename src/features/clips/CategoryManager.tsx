import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button, IconButton } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Input } from '@/components/ui/Field'
import { Confirm, Sheet } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { isEnter } from '@/lib/keys'
import { IconChevronLeft, IconChevronRight, IconEdit, IconPlus, IconTrash } from '@/components/ui/icons'
import type { ClipCategoryRow } from '@/lib/supabase/database.types'
import { CATEGORY_EMOJI_CHOICES, FALLBACK_KEY } from './categoryApi'
import { useCategoryList, useClipCategories, useClipCategoryMutations } from './categoryHooks'
import { cx } from '@/lib/cx'

/** ネタ帳のカテゴリの一覧（並び替え・編集・追加）。設定画面と、ネタ帳などから開くシートで使う */
export function CategoryManager() {
  const cats = useClipCategories()
  const { reorder } = useClipCategoryMutations()
  const [editing, setEditing] = useState<ClipCategoryRow | 'new' | null>(null)
  const list = cats.data ?? []

  const move = (i: number, dir: -1 | 1) => {
    const ids = list.map((c) => c.id)
    const j = i + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    reorder.mutate(ids)
  }

  return (
    <div className="flex flex-col gap-2">
      {list.map((c, i) => (
        <Card key={c.id} className="flex items-center gap-2 py-2">
          <button type="button" onClick={() => setEditing(c)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <span className="text-xl" aria-hidden>{c.emoji || '🏷️'}</span>
            <span className="truncate font-bold">{c.name}</span>
          </button>
          <IconButton label="上へ" onClick={() => move(i, -1)} disabled={i === 0}><IconChevronLeft size={16} className="rotate-90" /></IconButton>
          <IconButton label="下へ" onClick={() => move(i, 1)} disabled={i === list.length - 1}><IconChevronRight size={16} className="rotate-90" /></IconButton>
          <IconButton label={`${c.name} を編集`} onClick={() => setEditing(c)}><IconEdit size={16} /></IconButton>
        </Card>
      ))}
      <Button variant="secondary" icon={<IconPlus size={16} />} onClick={() => setEditing('new')}>カテゴリを追加</Button>
      <CategoryEditSheet category={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

/** カテゴリ 1 つの追加・編集（名前・アイコン・削除） */
export function CategoryEditSheet({ category, onClose, onCreated }: { category: ClipCategoryRow | 'new' | null; onClose: () => void; onCreated?: (c: ClipCategoryRow) => void }) {
  return (
    <Sheet open={category !== null} onClose={onClose} title={category === 'new' ? 'カテゴリを追加' : 'カテゴリを編集'}>
      {category !== null && <CategoryForm key={category === 'new' ? 'new' : category.id} category={category === 'new' ? null : category} onClose={onClose} onCreated={onCreated} />}
    </Sheet>
  )
}

function CategoryForm({ category, onClose, onCreated }: { category: ClipCategoryRow | null; onClose: () => void; onCreated?: (c: ClipCategoryRow) => void }) {
  const cats = useClipCategories()
  const { create, update, remove } = useClipCategoryMutations()
  const toast = useToast()
  const [name, setName] = useState(category?.name ?? '')
  const [emoji, setEmoji] = useState(category?.emoji || '🏷️')
  const [confirm, setConfirm] = useState(false)
  const busy = create.isPending || update.isPending
  const isFallback = category?.key === FALLBACK_KEY

  async function save() {
    const n = name.trim()
    if (!n) { toast('カテゴリ名を入れてね', 'error'); return }
    if ((cats.data ?? []).some((c) => c.name === n && c.id !== category?.id)) { toast('同じ名前のカテゴリがあります', 'error'); return }
    try {
      if (category) {
        await update.mutateAsync({ id: category.id, patch: { name: n, emoji } })
        toast('カテゴリを更新しました', 'success')
      } else {
        const c = await create.mutateAsync({ name: n, emoji, sort_order: (cats.data?.length ?? 0) + 1 })
        toast(`「${n}」を追加しました`, 'success')
        onCreated?.(c)
      }
      onClose()
    } catch (e) {
      toast(e instanceof Error && /duplicate|unique/i.test(e.message) ? '同じ名前のカテゴリがあります' : '保存できませんでした', 'error')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-3">
        <span className="grid size-14 shrink-0 place-items-center rounded-card bg-oat-100 text-3xl" aria-hidden>{emoji}</span>
        <div className="min-w-0 flex-1">
          <Input label="カテゴリ名" placeholder="例: スイーツ / パン屋さん / 器・雑貨" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (isEnter(e)) void save() }} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-bold text-espresso-700">アイコン</span>
        <div className="grid grid-cols-8 gap-1.5" role="radiogroup" aria-label="アイコン">
          {CATEGORY_EMOJI_CHOICES.map((e) => (
            <button key={e} type="button" role="radio" aria-checked={emoji === e} aria-label={e} onClick={() => setEmoji(e)}
              className={cx('h-10 rounded-[10px] border-2 text-xl', emoji === e ? 'border-green-600 bg-green-600/10' : 'border-transparent bg-oat-50')}>
              {e}
            </button>
          ))}
        </div>
      </div>
      <Button full size="lg" loading={busy} onClick={save}>{category ? '保存する' : '追加する'}</Button>
      {category && (isFallback
        ? <p className="text-center text-xs text-muted">「{category.name}」は、カテゴリを消したときのネタの行き先なので消せません（名前とアイコンは変えられます）。</p>
        : <Button variant="ghost" className="text-brick-500" icon={<IconTrash size={16} />} onClick={() => setConfirm(true)}>このカテゴリを削除</Button>)}
      <Confirm open={confirm} onClose={() => setConfirm(false)} title={`「${category?.name}」を削除しますか？`} body="このカテゴリのネタは「その他」に移ります（ネタ自体は消えません）。" confirmLabel="削除する" danger
        onConfirm={() => { if (category) remove.mutate(category, { onSuccess: () => { toast('削除しました'); onClose() }, onError: () => toast('削除できませんでした', 'error') }) }} />
    </div>
  )
}

/** ネタ帳などから開く「カテゴリの追加・編集」シート */
export function CategoryManagerSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="カテゴリの追加・編集">
      {open && <CategoryManager />}
    </Sheet>
  )
}

/** カテゴリを選ぶチップの並び ＋「新しいカテゴリ」「編集」 */
export function CategoryPicker({ value, onChange, disabled }: { value: string; onChange: (key: string) => void; disabled?: boolean }) {
  const list = useCategoryList()
  const [adding, setAdding] = useState(false)
  const [managing, setManaging] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-bold text-espresso-700">カテゴリ</span>
      <div className="flex flex-wrap gap-2">
        {list.map((c) => <Chip key={c.value} active={value === c.value} disabled={disabled} onClick={() => onChange(c.value)}>{c.emoji} {c.label}</Chip>)}
        <Chip onClick={() => setAdding(true)} disabled={disabled} icon={<IconPlus size={14} />} className="border-dashed">新しいカテゴリ</Chip>
        <Chip onClick={() => setManaging(true)} disabled={disabled} icon={<IconEdit size={14} />}>カテゴリを編集</Chip>
      </div>
      <CategoryEditSheet category={adding ? 'new' : null} onClose={() => setAdding(false)} onCreated={(c) => onChange(c.key)} />
      <CategoryManagerSheet open={managing} onClose={() => setManaging(false)} />
    </div>
  )
}
