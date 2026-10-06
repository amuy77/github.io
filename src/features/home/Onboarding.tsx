import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Mascot } from '@/components/mascot/Mascot'
import { cx } from '@/lib/cx'
import { markOnboarded, onboardingDone } from './onboardingState'

/** はじめて開いたときだけ、LaRa が使い方を 4 枚で案内する。設定の「使い方」からもう一度見られる */
const STEPS: { emoji: string; title: string; body: string }[] = [
  { emoji: '👋', title: 'はじめまして、LaRa だよ', body: 'お店の秘書をするね。気になったこと、レシピ、毎日のメニューを、いっしょに残していこう。' },
  { emoji: '📷', title: '下の「＋」で、撮るだけ', body: '気になるメニューやレシピは写真を撮るだけで OK。LaRa が読んで、ネタ帳かレシピかに仕分けするよ。' },
  { emoji: '📬', title: 'トレイで「OK」したら完成', body: '読み終わったら郵便受け（トレイ）に届くよ。中身を見て OK を押すと、ノートに入るよ。' },
  { emoji: '🗓️', title: '「きろく」で今日を記録', body: 'お店で出したメニューにチェックするだけ。続けると、売れ方や明日の仕込みの目安がわかるようになるよ。右上の 📅 で予定も見られるよ。' },
]

export function Onboarding() {
  const [open, setOpen] = useState(() => !onboardingDone())
  const [i, setI] = useState(0)
  const done = () => { markOnboarded(); setOpen(false) }
  const s = STEPS[i]
  const last = i === STEPS.length - 1
  return (
    <Sheet open={open} onClose={done} title="LaRa の使い方"
      footer={<div className="flex gap-2">{i > 0 ? <Button variant="ghost" onClick={() => setI(i - 1)}>もどる</Button> : <Button variant="ghost" onClick={done}>あとで</Button>}<Button full onClick={() => (last ? done() : setI(i + 1))}>{last ? 'はじめる' : 'つぎへ'}</Button></div>}>
      <div className="flex flex-col items-center gap-3 py-2 text-center" aria-live="polite">
        <div className="relative">
          <Mascot size={96} mood={i === 0 ? 'happy' : 'idle'} />
          <span className="absolute -right-3 -top-1 text-[30px]" aria-hidden>{s.emoji}</span>
        </div>
        <p className="text-[19px] font-bold">{s.title}</p>
        <p className="max-w-[32ch] text-[15px] leading-relaxed text-espresso-700">{s.body}</p>
        <div className="flex gap-1.5 pt-1" aria-label={`${i + 1} / ${STEPS.length}`}>
          {STEPS.map((_, k) => <span key={k} className={cx('size-2 rounded-full', k === i ? 'bg-green-600' : 'bg-line')} />)}
        </div>
      </div>
    </Sheet>
  )
}
