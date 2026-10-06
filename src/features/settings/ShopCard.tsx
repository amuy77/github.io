import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { friendlyError } from '@/lib/errors'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'
import { useSession } from '@/features/auth/useSession'

interface Member { shop_id: string; user_id: string; role: 'owner' | 'staff'; display_name: string; shops: { name: string } | null }

/** 自分が入っているお店と、同じお店のメンバー。SQL（段階 1）を流す前は表が無いので null（カードを出さない） */
async function listMembers(): Promise<Member[] | null> {
  const { data, error } = await getSupabase().from('shop_members').select('shop_id, user_id, role, display_name, shops(name)').order('created_at')
  if (error) return null
  return data as unknown as Member[]
}

/**
 * 設定の「お店とメンバー」。データ（ネタ・レシピ・記録）は人ごとに別々のまま。ここでは同じお店の人と、自分の呼び名だけ
 */
export function ShopCard() {
  const { userId } = useSession()
  const qc = useQueryClient()
  const toast = useToast()
  const members = useQuery({ queryKey: ['shop-members'], queryFn: listMembers, enabled: isSupabaseConfigured, staleTime: 5 * 60_000 })
  const me = members.data?.find((m) => m.user_id === userId)
  const [name, setName] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: async (display_name: string) => {
      const { error } = await getSupabase().from('shop_members').update({ display_name }).eq('shop_id', me!.shop_id).eq('user_id', me!.user_id)
      if (error) throw error
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['shop-members'] }); setName(null); toast('呼び名を保存したよ', 'success') },
    onError: (e) => toast(friendlyError(e), 'error'),
  })
  if (!members.data || !me) return null
  const value = name ?? me.display_name
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <p className="font-bold">🏠 {me.shops?.name ?? 'お店'}</p>
        <p className="text-xs text-muted">同じお店のメンバー。ネタ・レシピ・記録は、それぞれ自分のページに別々に入るよ</p>
      </div>
      <ul className="flex flex-wrap gap-2">
        {members.data.map((m) => (
          <li key={m.user_id} className="rounded-chip border border-line bg-paper px-3 py-1.5 text-[13px] font-bold">
            {m.display_name || (m.user_id === userId ? 'わたし' : 'メンバー')}{m.role === 'owner' && <span className="ml-1 text-[11px] text-muted">オーナー</span>}{m.user_id === userId && <span className="ml-1 text-[11px] text-green-700">（自分）</span>}
          </li>
        ))}
      </ul>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1"><Input label="自分の呼び名" placeholder="例: 侑磨" maxLength={20} value={value} onChange={(e) => setName(e.target.value)} /></div>
        <Button variant="secondary" disabled={name === null || name.trim() === me.display_name} loading={save.isPending} onClick={() => save.mutate((name ?? '').trim())}>保存</Button>
      </div>
    </Card>
  )
}
