import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { SectionTitle } from '@/components/ui/Page'
import type { IngredientPriceRow, RecipeRow } from '@/lib/supabase/database.types'
import { cx } from '@/lib/cx'
import { recipeCost } from './cost'
import { useIngredientPrices } from './priceHooks'
import { IngredientPriceSheet } from './IngredientPrices'

const REASON = { 'no-price': '仕入れ値を入れる', 'no-amount': '量が読めない', 'unit-mismatch': '単位がちがう' } as const

/**
 * レシピの原価。仕入れ値がわかる材料だけ足し、わからない材料は「仕入れ値を入れる」から足せる。
 * 価格が入っていれば、原価率と粗利も。SQL を流す前（表が無い）や材料が無いときは出さない
 */
export function CostCard({ recipe }: { recipe: RecipeRow }) {
  const prices = useIngredientPrices()
  const [target, setTarget] = useState<IngredientPriceRow | { name: string } | null>(null)
  if (!prices.data?.ready || recipe.ingredients.length === 0) return null
  const c = recipeCost(recipe.ingredients, prices.data.rows)
  const price = recipe.price ?? null
  return (
    <Card className="flex flex-col gap-3">
      <SectionTitle className="mt-0" count={c.unknown ? `わかった材料 ${c.known} / ${c.known + c.unknown}` : undefined}>原価</SectionTitle>
      <div className="flex flex-wrap items-end gap-x-5 gap-y-1">
        <p><span className="text-xs text-muted">原価 </span><b className="font-display text-[26px] tabular-nums">¥{c.total.toLocaleString()}</b>{c.unknown > 0 && <span className="text-xs text-muted"> 〜</span>}</p>
        {price != null && price > 0 && c.known > 0 && (
          <>
            <p><span className="text-xs text-muted">原価率 </span><b className="text-[18px] tabular-nums">{Math.round((c.total / price) * 100)}%</b></p>
            <p><span className="text-xs text-muted">粗利 </span><b className="text-[18px] tabular-nums text-green-700">¥{(price - c.total).toLocaleString()}</b></p>
          </>
        )}
      </div>
      {c.unknown > 0 && <p className="text-xs text-muted">わからない材料があるので、本当の原価はもう少し上かも</p>}
      <ul className="flex flex-col">
        {c.lines.map((l, i) => (
          <li key={i} className="flex items-center gap-2 border-b border-dashed border-line py-2 text-[14px] last:border-b-0">
            <span className="min-w-0 flex-1 truncate">{l.ingredient.name} <span className="text-xs text-muted">{l.ingredient.amount}</span></span>
            {l.yen !== null ? <span className="tabular-nums">¥{Math.round(l.yen).toLocaleString()}</span> : (
              <button type="button" onClick={() => setTarget(l.price ?? { name: l.ingredient.name })}
                className={cx('rounded-chip border px-2.5 py-1 text-[12px] font-bold', l.reason === 'no-price' ? 'border-green-600/40 text-green-700' : 'border-line text-muted')}>
                {REASON[l.reason ?? 'no-price']}
              </button>
            )}
          </li>
        ))}
      </ul>
      <IngredientPriceSheet target={target} onClose={() => setTarget(null)} />
    </Card>
  )
}
