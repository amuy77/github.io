import { useState } from 'react'
import { IconX } from '@/components/ui/icons'
import { SUGGEST, type LaraTalk } from './useLaraTalk'
import { openExternal } from '@/features/planner/api'
import { Mascot } from '@/components/mascot/Mascot'
import { Link } from 'react-router'
import { paths } from '@/app/routes'

const isExternal = (to: string) => /^https?:\/\//.test(to)

/** 吹き出しの中身: 店主の言葉、LaRa の返事、開ける画面・預ける・次の答えのボタン */
export function TalkBubbleBody({ talk, onLink }: { talk: LaraTalk; onLink: (to: string) => void }) {
  const l = talk.line
  if (!l) return null
  return (
    <>
      {l.q && <p className="mb-1 truncate text-[11px] font-bold text-muted">「{l.q}」</p>}
      <p className="whitespace-pre-wrap">{l.text}</p>
      {(!!l.links?.length || l.consultOf || !!l.more) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {l.links?.map((x) => <button key={x.to + x.label} type="button" onClick={() => (isExternal(x.to) ? openExternal(x.to) : onLink(x.to))} className="rounded-chip border border-green-600/40 bg-paper px-2.5 py-1 text-[12px] font-bold text-green-700">{x.label} →</button>)}
          {l.consultOf && !l.consulted && <button type="button" onClick={() => void talk.consult()} disabled={talk.busy} className="rounded-chip bg-mustard-400 px-3 py-1 text-[12px] font-bold text-espresso-900">預ける</button>}
          {!!l.more && <button type="button" onClick={() => talk.next()} className="rounded-chip border border-line bg-paper px-2.5 py-1 text-[12px] font-bold">次の答え（あと {l.more}）→</button>}
        </div>
      )}
    </>
  )
}

/** 話しかけている間、下に出す入力欄とすぐ送れる言葉 */
export function TalkBar({ talk, onClose }: { talk: LaraTalk; onClose: () => void }) {
  const [text, setText] = useState('')
  const send = (q: string) => { setText(''); void talk.send(q) }
  return (
    <div className="flex flex-col gap-2">
      <div className="scroll-x flex gap-1.5">
        {/* 探す・提案・味の相談は「LaRa に聞く」画面で */}
        <Link to={paths.ask} className="shrink-0 rounded-chip border border-green-600/40 bg-paper/95 px-3 py-1.5 text-[12px] font-bold text-green-700 shadow-card backdrop-blur">🔍 くわしく探す →</Link>
        {SUGGEST.map((s) => <button key={s} type="button" disabled={talk.busy} onClick={() => send(s)} className="shrink-0 rounded-chip border border-line bg-paper/95 px-3 py-1.5 text-[12px] font-bold shadow-card backdrop-blur">{s}</button>)}
      </div>
      <form className="flex items-center gap-2 rounded-card border border-line bg-paper/95 p-2 shadow-card backdrop-blur" onSubmit={(e) => { e.preventDefault(); send(text) }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="LaRa に聞く" aria-label="LaRa に聞く" enterKeyHint="send" autoFocus
          className="h-10 min-w-0 flex-1 rounded-chip border border-line bg-paper px-4 text-[15px] focus:border-green-600 focus:outline-none" />
        <button type="submit" disabled={!text.trim() || talk.busy} className="h-10 shrink-0 rounded-chip bg-green-600 px-4 text-[14px] font-bold text-white disabled:opacity-40">送る</button>
        <button type="button" onClick={onClose} aria-label="話すのをやめる" className="grid size-10 shrink-0 place-items-center rounded-full text-muted"><IconX /></button>
      </form>
    </div>
  )
}

/** ホームの案内カードに置く小さな「聞く」ボタン（その場で LaRa が吹き出しで答える）。相談の答えが届いていたら点を付ける */
export function TalkButton({ onClick, dot }: { onClick: () => void; dot?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label="LaRa に聞く" className="relative flex h-9 shrink-0 items-center gap-1 rounded-chip border border-line bg-paper py-0 pl-0.5 pr-3 text-[13px] font-bold">
      <Mascot size={28} /> 聞く
      {dot && <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-brick-500" aria-label="相談の答えが届いています" />}
    </button>
  )
}
