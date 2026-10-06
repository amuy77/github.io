import { useState } from 'react'
import { Sheet, Confirm } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { friendlyError } from '@/lib/errors'
import type { IngredientPriceRow } from '@/lib/supabase/database.types'
import { BUY_UNITS, perUnitLabel } from './cost'
import { useIngredientPriceMutations, useIngredientPrices } from './priceHooks'

const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`
/** 仕入れ値を 1 つ入れる・直すシート。name を渡すと、その名前で新しく作る */
export function IngredientPriceSheet({ target, onClose }: { target: IngredientPriceRow | { name: string } | null; onClose: () => void }) {
  return (
    <Sheet open={target !== null} onClose={onClose} title={target && 'id' in target ? '仕入れ値を直す' : '仕入れ値を入れる'}>
      {target && <PriceForm key={'id' in target ? target.id : target.name} target={target} onDone={onClose} />}
    </Sheet>
  )
}

function PriceForm({ target, onDone }: { target: IngredientPriceRow | { name: string }; onDone: () => void }) {
  const toast = useToast()
  const { save, remove } = useIngredientPriceMutations()
  const row = 'id' in target ? target : null
  const [name, setName] = useState(target.name)
  const [amount, setAmount] = useState(row ? String(row.buy_amount) : '')
  const [unit, setUnit] = useState(row?.buy_unit ?? 'g')
  const [price, setPrice] = useState(row ? String(row.buy_price) : '')
  const [confirm, setConfirm] = useState(false)
  const draft = { buy_amount: Number(amount), buy_unit: unit, buy_price: Number(price) }
  const ok = name.trim() && Number(amount) > 0 && price !== '' && Number(price) >= 0
  const submit = () => {
    if (!ok) return
    save.mutate({ id: row?.id, name: name.trim(), ...draft }, { onSuccess: () => { toast('仕入れ値を保存したよ', 'success'); onDone() }, onError: (e) => toast(friendlyError(e), 'error') })
  }
  return (
    <div className="flex flex-col gap-4">
      <Input label="材料の名前" placeholder="ベーコン" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1"><Input label="仕入れの量" inputMode="decimal" placeholder="1" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} /></div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-espresso-700">単位</span>
          <select value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="単位" className="h-11 rounded-chip border border-line bg-paper px-3 text-[16px] font-bold">
            {BUY_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
        <div className="min-w-0 flex-1"><Input label="値段（円）" inputMode="numeric" placeholder="1800" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ''))} /></div>
      </div>
      <p className="text-sm text-muted">{ok ? `→ ${perUnitLabel(draft)}` : '例: ベーコン 1 kg で 1800 円'}</p>
      <Button full disabled={!ok} loading={save.isPending} onClick={submit}>保存する</Button>
      {row && <Button variant="ghost" full onClick={() => setConfirm(true)}>この材料を消す</Button>}
      <Confirm open={confirm} onClose={() => setConfirm(false)} title={`「${row?.name}」の仕入れ値を消しますか？`} body="レシピの材料はそのまま残ります。原価が出なくなるだけです。" confirmLabel="消す" danger
        onConfirm={() => { if (row) remove.mutate(row.id, { onSuccess: () => { toast('消しました'); onDone() } }) }} />
    </div>
  )
}

/** 設定の「材料と仕入れ値」: 一覧と追加 */
export function IngredientPriceList({ filter = '' }: { filter?: string }) {
  const prices = useIngredientPrices()
  const [target, setTarget] = useState<IngredientPriceRow | { name: string } | null>(null)
  if (!prices.data) return null
  if (!prices.data.ready) return <p className="text-sm text-muted">データベースの更新（SQL の実行）のあとで使えるようになるよ</p>
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted">仕入れ値を入れておくと、レシピの原価と、分析の粗利が出るよ。名前はレシピの材料名と同じにしてね</p>
      {prices.data.rows.filter((p) => !filter.trim() || p.name.toLowerCase().includes(filter.trim().toLowerCase())).map((p) => (
        <button key={p.id} type="button" onClick={() => setTarget(p)} className="flex items-center gap-3 rounded-[12px] border border-line bg-paper px-3 py-2.5 text-left">
          <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{p.name}</span>
          <span className="text-xs text-muted">{p.buy_amount}{p.buy_unit} {yen(p.buy_price)}</span>
          <span className="text-xs font-bold text-green-700">{perUnitLabel(p)}</span>
        </button>
      ))}
      <Button variant="secondary" onClick={() => setTarget({ name: '' })}>＋ 材料を足す</Button>
      <IngredientPriceSheet target={target} onClose={() => setTarget(null)} />
    </div>
  )
}
