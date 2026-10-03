import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { paths } from '@/app/routes'
import { FRIENDS, VISIT_FREQS, callFriend } from '@/characters'
import { updateSettings, useSettings } from './useSettings'

/** 設定の「LaRa の友達」: 名簿の友達ごとに、紹介・遊びに来る頻度・今すぐ呼ぶ */
export function FriendsCard() {
  const nav = useNavigate()
  const { friends, home3d } = useSettings()
  const [comic, setComic] = useState<string | null>(null)
  return (
    <>
      {FRIENDS.map((f) => {
        const freq = friends[f.id] ?? 'sometimes'
        return (
          <Card key={f.id} className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <img src={f.image} alt="" className="size-20 shrink-0 object-contain" />
              <div className="min-w-0 flex-1">
                <p className="font-display text-[17px] font-bold">{f.name} <span className="text-xs text-muted">（{f.kana}）</span></p>
                <p className="text-xs leading-relaxed text-muted">{f.profile}</p>
                {f.comic && <button type="button" onClick={() => setComic(f.comic!)} className="mt-1 text-xs font-bold text-green-700">4コマを見る ›</button>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label={`${f.name} が遊びに来る頻度`}>
              {VISIT_FREQS.map((v) => <Chip key={v.value} active={freq === v.value} onClick={() => updateSettings({ friends: { ...friends, [f.id]: v.value } })}>{v.label}</Chip>)}
            </div>
            <div className="flex items-center gap-2">
              <p className="flex-1 text-xs text-muted">{home3d ? '昼間（10〜20 時）に、ホームのお店へときどき遊びに来ます' : '3D のお店ホームをオンにすると遊びに来ます'}</p>
              <button type="button" disabled={!home3d} onClick={() => { callFriend(f.id); nav(paths.home) }}
                className="h-9 shrink-0 rounded-chip bg-green-600 px-3 text-[13px] font-bold text-white disabled:opacity-40">今すぐ呼ぶ</button>
            </div>
          </Card>
        )
      })}
      {comic && (
        <button type="button" className="fixed inset-0 z-[80] grid place-items-center bg-espresso-900/90 p-4" onClick={() => setComic(null)} aria-label="閉じる">
          <img src={comic} alt="" className="max-h-full max-w-full rounded-card object-contain" />
        </button>
      )}
    </>
  )
}
