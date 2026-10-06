import { useMemo, useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import type { RecipeRow } from '@/lib/supabase/database.types'
import { cx } from '@/lib/cx'
import { prepLines, prepText, type PrepItem } from './prep'

/**
 * 仕込み表・買い物リスト。作る数は目安から始めて ＋／− で直せる。品を足すこともできる。
 * 材料はチェックしながら買い物に使えて、文字にしてコピー（LINE やメモに貼る）もできる
 */
export function PrepSheet({ open, onClose, date, initial, menu }: { open: boolean; onClose: () => void; date: string; initial: PrepItem[]; menu: RecipeRow[] }) {
  return (
    <Sheet open={open} onClose={onClose} title={`${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))} の仕込み表`} tall>
      {open && <PrepBody date={date} initial={initial} menu={menu} />}
    </Sheet>
  )
}

function PrepBody({ date, initial, menu }: { date: string; initial: PrepItem[]; menu: RecipeRow[] }) {
  const toast = useToast()
  const [items, setItems] = useState<PrepItem[]>(initial)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const lines = useMemo(() => prepLines(items), [items])
  const addable = menu.filter((r) => !items.some((i) => i.recipe.id === r.id))
  const setCount = (id: string, n: number) => setItems((xs) => xs.map((x) => (x.recipe.id === id ? { ...x, count: Math.max(0, n) } : x)))
  const copy = async () => {
    try { await navigator.clipboard.writeText(prepText(date, items, lines)); toast('コピーしたよ。LINE やメモに貼ってね', 'success') }
    catch { toast('コピーできなかったみたい', 'error') }
  }
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2" aria-label="作る数">
        <p className="text-[13px] font-bold text-espresso-700">作る数</p>
        {items.length === 0 && <p className="text-sm text-muted">下の「品を足す」から選んでね</p>}
        {items.map(({ recipe, count }) => (
          <div key={recipe.id} className="flex items-center gap-2 rounded-[12px] border border-line bg-paper py-1 pl-3 pr-1">
            <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{recipe.title}</span>
            <button type="button" aria-label={`${recipe.title} を減らす`} onClick={() => setCount(recipe.id, count - 1)} className="size-11 rounded-full text-[18px] hover:bg-oat-100">−</button>
            <span className="w-8 text-center text-[17px] font-bold tabular-nums" aria-label={`${recipe.title} の数`}>{count}</span>
            <button type="button" aria-label={`${recipe.title} を増やす`} onClick={() => setCount(recipe.id, count + 1)} className="size-11 rounded-full text-[18px] hover:bg-oat-100">＋</button>
          </div>
        ))}
        {addable.length > 0 && (
          <select aria-label="品を足す" value="" onChange={(e) => { const r = menu.find((x) => x.id === e.target.value); if (r) setItems((xs) => [...xs, { recipe: r, count: 1 }]) }}
            className="h-11 rounded-chip border border-dashed border-line bg-paper px-3 text-[15px] font-bold text-espresso-700">
            <option value="">＋ 品を足す</option>
            {addable.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
          </select>
        )}
      </section>

      <section className="flex flex-col gap-2" aria-label="材料">
        <p className="text-[13px] font-bold text-espresso-700">材料（買ったらチェック）</p>
        {lines.length === 0 ? <p className="text-sm text-muted">材料が書かれたレシピを選ぶと、ここに合計が出るよ</p> : (
          <ul className="flex flex-col gap-1.5">
            {lines.map((l) => {
              const on = checked.has(l.name)
              return (
                <li key={l.name}>
                  <label className={cx('flex cursor-pointer items-start gap-3 rounded-[12px] border border-line bg-paper px-3 py-2.5', on && 'opacity-50')}>
                    <input type="checkbox" checked={on} onChange={() => setChecked((s) => { const n = new Set(s); if (n.has(l.name)) n.delete(l.name); else n.add(l.name); return n })} className="mt-1 size-5 accent-green-600" />
                    <span className="min-w-0 flex-1">
                      <span className={cx('flex items-baseline gap-2 text-[15px] font-bold', on && 'line-through')}><span className="min-w-0 flex-1">{l.name}</span>{l.total && <span className="tabular-nums">{l.total}</span>}</span>
                      {!l.total && <span className="block text-xs text-muted">{l.uses.join('、')}</span>}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </section>
      <Button full variant="secondary" onClick={copy} disabled={!lines.length}>文字にしてコピー</Button>
    </div>
  )
}
