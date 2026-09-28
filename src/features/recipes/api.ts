import { getSupabase } from '@/lib/supabase/client'
import type { Database, RecipeRow } from '@/lib/supabase/database.types'
import { deletePhotos } from '@/lib/images/upload'

export type RecipeInsert = Database['public']['Tables']['recipes']['Insert']
export type RecipeUpdate = Database['public']['Tables']['recipes']['Update']

export async function listRecipes(): Promise<RecipeRow[]> {
  const { data, error } = await getSupabase().from('recipes').select('*').order('created_at', { ascending: false }).limit(1000)
  if (error) throw error
  return data as RecipeRow[]
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

export async function deleteRecipe(recipe: RecipeRow): Promise<void> {
  const sb = getSupabase()
  // グループの最初のレシピを消すときは、次に古い版を新しい先頭にしてグループを保つ
  if (!recipe.family_id) {
    const { data: kids } = await sb.from('recipes').select('id, created_at').eq('family_id', recipe.id).order('created_at')
    if (kids && kids.length) {
      const [head, ...rest] = kids as { id: string }[]
      await sb.from('recipes').update({ family_id: null }).eq('id', head.id)
      if (rest.length) await sb.from('recipes').update({ family_id: head.id }).in('id', rest.map((k) => k.id))
    }
  }
  const { error } = await sb.from('recipes').delete().eq('id', recipe.id)
  if (error) throw error
  if (recipe.hero_image) await deletePhotos([recipe.hero_image])
}
