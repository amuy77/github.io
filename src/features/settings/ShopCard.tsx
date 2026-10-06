import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { friendlyError } from '@/lib/errors'
import { saveDisplayName, useShopMembers } from './shopHooks'
import { useSession } from '@/features/auth/useSession'

/**
 * 設定の「お店とメンバー」。データ（ネタ・レシピ・記録）は人ごとに別々のまま。ここでは同じお店の人と、自分の呼び名だけ
 */
export function ShopCard() {
  const { userId } = useSession()
  const qc = useQueryClient()
  const toast = useToast()
  const members = useShopMembers()
  const me = members.data?.find((m) => m.user_id === userId)
  const [name, setName] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: (display_name: string) => saveDisplayName(me!.shop_id, me!.user_id, display_name),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['shop-members'] }); setName(null); toast('呼び名を保存したよ', 'success') },
    onError: (e) => toast(friendlyError(e), 'error'),
  })
  if (!members.data || !me) return null
  const value = name ?? me.display_name
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <p className="font-bold">🏠 {me.shops?.name ?? 'お店'}</p>
        <p className="text-[13px] text-muted">同じお店のメンバーだよ</p>
      </div>
      <ul className="flex flex-wrap gap-2">
        {members.data.map((m) => (
          <li key={m.user_id} className="rounded-chip border border-line bg-paper px-3 py-1.5 text-[13px] font-bold">
            {m.display_name || (m.user_id === userId ? 'わたし（名前がまだ）' : '名前がまだの人')}{m.role === 'owner' && <span className="ml-1 text-[11px] text-muted">オーナー</span>}{m.user_id === userId && <span className="ml-1 text-[11px] text-green-700">（自分）</span>}
          </li>
        ))}
      </ul>
      {members.data.some((m) => !m.display_name) && <p className="text-[13px] text-muted">それぞれ自分の 設定 → プロフィール で呼び名を入れると、ここに名前が出るよ</p>}
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1"><Input label="自分の呼び名" placeholder="例: 侑磨" maxLength={20} value={value} onChange={(e) => setName(e.target.value)} autoFocus={!me.display_name} /></div>
        <Button variant="secondary" disabled={name === null || name.trim() === me.display_name} loading={save.isPending} onClick={() => save.mutate((name ?? '').trim())}>保存</Button>
      </div>
    </Card>
  )
}
