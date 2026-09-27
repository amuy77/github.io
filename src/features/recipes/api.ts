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
  const { error } = await getSupabase().from('recipes').delete().eq('id', recipe.id)
  if (error) throw error
  if (recipe.hero_image) await deletePhotos([recipe.hero_image])
}
