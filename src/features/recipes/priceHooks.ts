import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'
import type { IngredientPriceRow } from '@/lib/supabase/database.types'

const KEY = ['ingredient-prices'] as const

/**
 * 材料の仕入れ値の一覧。SQL（20261009000000）を流す前は表が無いので、空のまま（ready: false）にして原価の欄を出さない
 */
async function listPrices(): Promise<{ rows: IngredientPriceRow[]; ready: boolean }> {
  const { data, error } = await getSupabase().from('ingredient_prices').select('*').order('name')
  if (error) return { rows: [], ready: false }
  return { rows: (data ?? []) as IngredientPriceRow[], ready: true }
}

export function useIngredientPrices() {
  return useQuery({ queryKey: KEY, queryFn: listPrices, enabled: isSupabaseConfigured, staleTime: 5 * 60_000 })
}

export function useIngredientPriceMutations() {
  const qc = useQueryClient()
  const invalidate = () => { void qc.invalidateQueries({ queryKey: KEY }) }
  /** 同じ名前があれば上書き、無ければ追加 */
  const save = useMutation({
    mutationFn: async (row: Pick<IngredientPriceRow, 'name' | 'buy_amount' | 'buy_unit' | 'buy_price'> & { id?: string }) => {
      const sb = getSupabase()
      const { id, ...body } = row
      const { error } = id
        ? await sb.from('ingredient_prices').update(body).eq('id', id)
        : await sb.from('ingredient_prices').upsert(body, { onConflict: 'user_id,name' })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await getSupabase().from('ingredient_prices').delete().eq('id', id); if (error) throw error },
    onSuccess: invalidate,
  })
  return { save, remove }
}
