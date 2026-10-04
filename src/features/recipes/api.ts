import { getSupabase } from '@/lib/supabase/client'
import type { Database, RecipeRow } from '@/lib/supabase/database.types'
import { deleteUnusedPhotos } from '@/lib/images/upload'
import { callRpc } from '@/lib/supabase/rpc'
import { fetchAll } from '@/lib/supabase/fetchAll'

export type RecipeInsert = Database['public']['Tables']['recipes']['Insert']
export type RecipeUpdate = Database['public']['Tables']['recipes']['Update']

export async function listRecipes(): Promise<RecipeRow[]> {
  return fetchAll<RecipeRow>(getSupabase().from('recipes').select('*').order('created_at', { ascending: false }))
}

export async function getRecipe(id: string): Promise<RecipeRow | null> {
  const { data, error } = await getSupabase().from('recipes').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as RecipeRow | null
}

export async function insertRecipe(row: RecipeInsert): Promise<RecipeRow> {
  const { data, error } = await getSupabase().from('recipes').insert(row).select('*').single()
  if (error) throw error
  return data as RecipeRow
}

export async function updateRecipe(id: string, patch: RecipeUpdate): Promise<RecipeRow> {
  const { data, error } = await getSupabase().from('recipes').update(patch).eq('id', id).select('*').single()
  if (error) throw error
  return data as RecipeRow
}

/** グループの「採用中」を 1 件に（id が null なら全部外す）。DB 関数で 1 回（無ければ版ごとに update） */
export async function setMainRecipe(ids: string[], id: string | null): Promise<void> {
  await callRpc('set_main_recipe', { p_ids: ids, p_main: id }, async () => {
    const sb = getSupabase()
    for (const rid of ids) { const { error } = await sb.from('recipes').update({ is_main: rid === id }).eq('id', rid); if (error) throw error }
    return null
  })
}

export async function deleteRecipe(recipe: RecipeRow): Promise<void> {
  const sb = getSupabase()
  // グループの最初のレシピを消すときは、次に古い版を新しい先頭にしてグループを保つ。DB 関数なら 1 トランザクション
  await callRpc('delete_recipe', { p_id: recipe.id }, async () => {
    if (!recipe.family_id) {
      const { data: kids, error: e0 } = await sb.from('recipes').select('id, created_at').eq('family_id', recipe.id).order('created_at')
      if (e0) throw e0
      if (kids && kids.length) {
        const [head, ...rest] = kids as { id: string }[]
        const { error: e1 } = await sb.from('recipes').update({ family_id: null }).eq('id', head.id); if (e1) throw e1
        if (rest.length) { const { error: e2 } = await sb.from('recipes').update({ family_id: head.id }).in('id', rest.map((k) => k.id)); if (e2) throw e2 }
      }
    }
    const { error } = await sb.from('recipes').delete().eq('id', recipe.id)
    if (error) throw error
    return null
  })
  // 同じ写真を他の版やネタが使っていることがある（AI が 1 枚から複数作る）ので、使われていないときだけ消す
  if (recipe.hero_image) await deleteUnusedPhotos([recipe.hero_image])
}
