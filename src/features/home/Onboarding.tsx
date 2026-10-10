import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Mascot } from '@/components/mascot/Mascot'
import { cx } from '@/lib/cx'
import { markOnboarded, onboardingDone } from './onboardingState'
import { Input } from '@/components/ui/Field'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/features/auth/useSession'
import { saveDisplayName, useShopMembers } from '@/features/settings/shopHooks'

/** はじめて開いたときだけ、LaRa が使い方を 4 枚で案内する。設定の「使い方」からもう一度見られる */
type Step = { emoji: string; title: string; body: string }
const NAME_STEP: Step = { emoji: '✏️', title: 'なんて呼んだらいい？', body: 'お店のメンバーに出る名前だよ。あとから設定でも変えられるよ' }
const STEPS: Step[] = [
  { emoji: '👋', title: 'はじめまして、LaRa だよ', body: 'お店のことを、いっしょに覚えていく係だよ。気になったこと、レシピ、毎日のメニューを残していこう。' },
  { emoji: '📷', title: '下の「＋」→「ネタ」→「撮る」', body: '気になるメニューやレシピは写真を撮るだけで OK。LaRa が読んで、ネタ帳かレシピかに仕分けするよ。' },
  { emoji: '📬', title: 'トレイで「OK」したら完成', body: '読み終わったら郵便受け（トレイ）に届くよ。中身を見て OK を押すと、ノートに入るよ。' },
  { emoji: '🗓️', title: '「きろく」で今日を記録', body: 'お店で出したメニューにチェックするだけ。続けると、売れ方や明日の仕込みの目安がわかるようになるよ。右上の 📅 で予定も見られるよ。' },
]

export function Onboarding() {
  const [open, setOpen] = useState(() => !onboardingDone())
  const [i, setI] = useState(0)
  const { userId } = useSession()
  const qc = useQueryClient()
  const me = useShopMembers().data?.find((m) => m.user_id === userId)
  // お店のメンバーで呼び名がまだなら、2 枚目に「なんて呼んだらいい？」を入れる（入れたあとも枚数が変わらないよう、入れた名前を覚えておく）
  const [name, setName] = useState('')
  const [saved, setSaved] = useState<string | null>(null)
  const askName = !!me && (!me.display_name || saved !== null)
  const steps: Step[] = askName ? [STEPS[0], NAME_STEP, ...STEPS.slice(1)] : STEPS
  const done = () => { markOnboarded(); setOpen(false) }
  const s = steps[Math.min(i, steps.length - 1)]
  const last = i >= steps.length - 1
  const next = () => {
    if (s === NAME_STEP && me && name.trim() && saved === null) {
      const n = name.trim()
      setSaved(n)
      void saveDisplayName(me.shop_id, me.user_id, n).then(() => qc.invalidateQueries({ queryKey: ['shop-members'] })).catch(() => { /* あとで設定から入れられる */ })
    }
    if (last) done(); else setI(i + 1)
  }
  return (
    <Sheet open={open} onClose={done} title="LaRa の使い方"
      footer={<div className="flex gap-2">{i > 0 ? <Button variant="ghost" onClick={() => setI(i - 1)}>もどる</Button> : <Button variant="ghost" onClick={done}>あとで</Button>}<Button full onClick={next}>{last ? 'はじめる' : 'つぎへ'}</Button></div>}>
      <div className="flex flex-col items-center gap-3 py-2 text-center" aria-live="polite">
        <div className="relative">
          <Mascot size={96} mood={i === 0 || saved ? 'happy' : 'idle'} />
          <span className="absolute -right-3 -top-1 text-[30px]" aria-hidden>{s.emoji}</span>
        </div>
        {s === STEPS[1] && saved && <p className="text-[15px] font-bold text-green-700">{saved} さん、よろしくね！</p>}
        <p className="text-[19px] font-bold">{s.title}</p>
        {s === NAME_STEP ? (
          <div className="flex w-full max-w-[28ch] flex-col gap-2">
            <p className="text-[15px] leading-relaxed text-espresso-700">{s.body}</p>
            <Input aria-label="呼び名" placeholder="例: 彩加" maxLength={20} value={saved ?? name} disabled={saved !== null} onChange={(e) => setName(e.target.value)} />
          </div>
        ) : <p className="max-w-[32ch] text-[15px] leading-relaxed text-espresso-700">{s.body}</p>}
        <div className="flex gap-1.5 pt-1" aria-label={`${i + 1} / ${steps.length}`}>
          {steps.map((_, k) => <span key={k} className={cx('size-2 rounded-full', k === i ? 'bg-green-600' : 'bg-line')} />)}
        </div>
      </div>
    </Sheet>
  )
}
