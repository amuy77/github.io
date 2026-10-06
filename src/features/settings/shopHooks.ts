import { useQuery } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'

export interface Member { shop_id: string; user_id: string; role: 'owner' | 'staff'; display_name: string; shops: { name: string } | null }

/** 自分が入っているお店と、同じお店のメンバー。SQL（段階 1）を流す前は表が無いので null */
async function listMembers(): Promise<Member[] | null> {
  const { data, error } = await getSupabase().from('shop_members').select('shop_id, user_id, role, display_name, shops(name)').order('created_at')
  if (error) return null
  return data as unknown as Member[]
}

export function useShopMembers() {
  return useQuery({ queryKey: ['shop-members'], queryFn: listMembers, enabled: isSupabaseConfigured, staleTime: 5 * 60_000 })
}

/** 自分の呼び名を保存する（表示名は本人だけが変えられる） */
export async function saveDisplayName(shopId: string, userId: string, displayName: string) {
  const { error } = await getSupabase().from('shop_members').update({ display_name: displayName }).eq('shop_id', shopId).eq('user_id', userId)
  if (error) throw error
}
