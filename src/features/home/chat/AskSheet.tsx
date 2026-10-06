import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Sheet } from '@/components/ui/Sheet'
import { MascotSays } from '@/components/mascot/Mascot'
import { useCounts, useStreak } from '@/features/home/useCounts'
import { TalkBar, TalkBubbleBody } from './LaraTalk'
import { useLaraTalk } from './useLaraTalk'

const EMPTY = { clips: 0, recipes: 0, menuLogs: 0, inbox: 0, drafts: 0, pendingJobs: 0 }

/**
 * どの画面からでも開ける「LaRa に聞く」。ホームの「聞く」と同じ会話（同じ答え方・すぐ送れる言葉・「くわしく探す」）を下から出すシートで。
 * 開いている間だけデータを読む
 */
export function AskSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="LaRa に聞く">
      {open && <AskBody onClose={onClose} />}
    </Sheet>
  )
}

function AskBody({ onClose }: { onClose: () => void }) {
  const nav = useNavigate()
  const counts = useCounts().data ?? EMPTY
  const streak = useStreak().data?.streak ?? 0
  const talk = useLaraTalk({ counts, streak, active: true })
  // 開いたら最初のひとこと（ホームの「聞く」を押したときと同じ）
  useEffect(() => { talk.start() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const go = (to: string) => { onClose(); talk.stop(); nav(to) }
  return (
    <div className="flex flex-col gap-3">
      <MascotSays mood={talk.thinking ? 'thinking' : 'happy'}>
        <div role="status" aria-label="LaRa の返事" className="text-[14px]">{talk.line ? <TalkBubbleBody talk={talk} onLink={go} /> : 'なあに？'}</div>
      </MascotSays>
      <TalkBar talk={talk} onClose={() => { talk.stop(); onClose() }} />
    </div>
  )
}
