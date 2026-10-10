import { useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { PageHeader } from '@/components/ui/Page'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { IconBook, IconCamera, IconChevronRight, IconClipboard, IconEdit, IconImage, IconSparkles, IconX } from '@/components/ui/icons'
import { Confirm } from '@/components/ui/Sheet'
import { today } from '@/lib/dates'
import { useToast } from '@/components/ui/Toast'
import { friendlyError } from '@/lib/errors'
import { MascotSays } from '@/components/mascot/Mascot'
import { paths } from '@/app/routes'
import { useSession } from '@/features/auth/useSession'
import { useEnqueueJob } from '@/features/ai/hooks'
import { nextWorkerTime } from '@/features/ai/api'
import { uploadPhoto } from '@/lib/images/upload'
import type { ImageRef } from '@/lib/supabase/database.types'
import { ClipEditorSheet, type ClipDraft } from './ClipEditorSheet'
import { cx } from '@/lib/cx'

const URL_RE = /https?:\/\/[^\s]+/

function draftFromText(text: string, title = ''): ClipDraft {
  const m = text.match(URL_RE)
  return { type: m ? 'link' : 'note', url: m?.[0] ?? '', note: m ? text.replace(m[0], '').trim() : text, title }
}

type Pending = { file: File; url: string }

/**
 * 「＋」の入口。何を足すかで 3 つ: ネタ（撮る／書く）・お店・今日を記録。
 * 写真は LaRa に渡す（ネタ帳かレシピかを LaRa が決めて保存し、トレイで確認）。
 * iOS ショートカットからは #/add?url=…&text=… で開かれる。
 */
export function QuickAddPage() {
  const nav = useNavigate()
  const toast = useToast()
  const { userId } = useSession()
  const enqueue = useEnqueueJob()
  const [params] = useSearchParams()
  const [draft, setDraft] = useState<ClipDraft | null>(() => {
    const url = params.get('url') ?? ''
    const text = params.get('text') ?? ''
    return url || text ? draftFromText(`${url} ${text}`.trim(), params.get('title') ?? '') : null
  })
  const [photos, setPhotos] = useState<Pending[]>([])
  const [hint, setHint] = useState('')
  const [sending, setSending] = useState(false)
  const [askClear, setAskClear] = useState(false)
  const cam = useRef<HTMLInputElement>(null)
  const lib = useRef<HTMLInputElement>(null)

  async function paste() {
    try {
      const text = await navigator.clipboard.readText()
      if (!text.trim()) { toast('クリップボードは空でした'); return }
      setDraft(draftFromText(text))
    } catch {
      toast('貼り付けができなかった。メモの欄に直接ペーストしてね')
      setDraft({ type: 'note' })
    }
  }

  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length) setPhotos((p) => [...p, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))])
  }
  const clearPhotos = () => { photos.forEach((p) => URL.revokeObjectURL(p.url)); setPhotos([]); setHint('') }
  const removePhoto = (i: number) => setPhotos((p) => { URL.revokeObjectURL(p[i].url); return p.filter((_, k) => k !== i) })

  /** 写真を Storage に上げて、AI の振り分けジョブを 1 件作る */
  async function sendToAi() {
    if (!userId || photos.length === 0) return
    setSending(true)
    try {
      const refs: ImageRef[] = []
      for (const p of photos) refs.push(await uploadPhoto(p.file, userId))
      await enqueue.mutateAsync({ kind: 'auto_from_image', payload: { images: refs, image_paths: refs.map((r) => r.path), hint: hint.trim() || undefined } })
      clearPhotos()
      toast(`受け取ったよ！${nextWorkerTime()} ごろに読んで、トレイに届けるね`, 'success')
      nav(paths.inbox, { replace: true })
    } catch (e) {
      toast(friendlyError(e, '送れませんでした'), 'error')
    } finally {
      setSending(false)
    }
  }

  /** AI を使わず、いつものネタ帳フォームで書く */
  const writeMyself = () => { const files = photos.map((p) => p.file); clearPhotos(); setDraft({ type: 'photo', files }) }

  type ActionId = 'camera' | 'library' | 'paste' | 'note' | 'recipe'
  const handle = (id: ActionId) => {
    switch (id) {
      case 'camera': cam.current?.click(); break
      case 'library': lib.current?.click(); break
      case 'paste': void paste(); break
      case 'note': setDraft({ type: 'note' }); break
      case 'recipe': nav(paths.recipeNew); break
    }
  }
  const actions: { id: ActionId; icon: React.ReactNode; label: string; sub: string; color: string }[] = [
    { id: 'library', icon: <IconImage />, label: '写真から選ぶ', sub: 'スクショやカメラロール。LaRa が読む', color: 'bg-mustard-400 text-espresso-900' },
    { id: 'paste', icon: <IconClipboard />, label: 'クリップボードから', sub: 'Instagram の「リンクをコピー」の後に', color: 'bg-plum-400 text-white' },
    { id: 'recipe', icon: <IconBook />, label: 'レシピを作る', sub: '手入力・テキスト貼り付け', color: 'bg-wood-300 text-espresso-900' },
  ]
  const big = 'flex h-[72px] flex-1 flex-col items-center justify-center gap-1 rounded-card text-center shadow-card active:scale-[0.98]'

  return (
    <>
      <PageHeader title="足す" back={paths.home} />
      <input ref={cam} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={onFiles} />
      <input ref={lib} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={onFiles} />
      <div className="flex flex-col gap-4">
        <MascotSays mood="happy">何を足す？</MascotSays>
        {/* 「何を足すか」で 3 つ。ネタは撮る／書くの 2 つのボタン、お店と記録はそれぞれの画面へ */}
        <section className="flex flex-col gap-2 rounded-card border border-line bg-paper p-3 shadow-card" aria-label="ネタ">
          <p className="text-[16px] font-bold">📌 ネタ</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => handle('camera')} className={cx(big, 'bg-brick-500 text-white')}>
              <IconCamera /><span className="text-[15px] font-bold">撮る</span><span className="text-[11px] opacity-85">LaRa が読んでトレイへ</span>
            </button>
            <button type="button" onClick={() => handle('note')} className={cx(big, 'bg-green-600 text-white')}>
              <IconEdit /><span className="text-[15px] font-bold">書く</span><span className="text-[11px] opacity-85">そのままネタ帳へ</span>
            </button>
          </div>
        </section>
        <button type="button" onClick={() => nav(`${paths.places}?add=1`)} className="flex min-h-[64px] items-center gap-3 rounded-card border border-line bg-paper px-4 py-3 text-left shadow-card active:scale-[0.98]">
          <span className="text-[26px]" aria-hidden>📍</span>
          <span className="min-w-0 flex-1"><span className="block text-[16px] font-bold">お店</span><span className="block text-[12px] text-muted">行って気に入ったお店を、Google マップのリンクで</span></span>
          <IconChevronRight size={18} className="text-muted" />
        </button>
        <button type="button" onClick={() => nav(paths.menuDay(today()))} className="flex min-h-[64px] items-center gap-3 rounded-card border border-line bg-paper px-4 py-3 text-left shadow-card active:scale-[0.98]">
          <span className="text-[26px]" aria-hidden>🗓️</span>
          <span className="min-w-0 flex-1"><span className="block text-[16px] font-bold">今日を記録</span><span className="block text-[12px] text-muted">今日出したメニューにチェック</span></span>
          <IconChevronRight size={18} className="text-muted" />
        </button>
        <section className="flex flex-col gap-2" aria-label="ほかの方法">
          <p className="text-[13px] font-bold text-muted">ほかの方法</p>
          <div className="grid grid-cols-2 gap-2">
            {actions.map((a) => (
              <button key={a.id} type="button" onClick={() => handle(a.id)} className="flex min-h-14 items-center gap-2 rounded-card border border-line bg-paper px-3 py-2 text-left active:scale-[0.98]">
                <span className={cx('grid size-9 shrink-0 place-items-center rounded-full [&>svg]:size-5', a.color)}>{a.icon}</span>
                <span className="min-w-0"><span className="block text-[14px] font-bold leading-tight">{a.label}</span><span className="block truncate text-[11px] text-muted">{a.sub}</span></span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <Sheet open={photos.length > 0} onClose={() => { if (!sending) setAskClear(true) }} title="写真を LaRa に渡す">
        <div className="flex flex-col gap-4 pb-2">
          <MascotSays mood="thinking">レシピなら下書きカードに、他店のメニューやラベルならネタ帳に。読み取った名前とメモも付けておくね。</MascotSays>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p, i) => (
              <div key={p.url} className="relative">
                <img src={p.url} alt="" className="aspect-square w-full rounded-[10px] object-cover" />
                {!sending && <button type="button" aria-label="写真を外す" onClick={() => removePhoto(i)} className="absolute -right-1 -top-1 grid size-7 place-items-center rounded-full bg-espresso-900 text-white before:absolute before:-inset-2 before:content-['']"><IconX size={14} /></button>}
              </div>
            ))}
            {!sending && (
              <button type="button" onClick={() => lib.current?.click()} className="grid aspect-square place-items-center rounded-[10px] border-2 border-dashed border-line text-muted">
                <IconImage />
              </button>
            )}
          </div>
          <Input label="ヒント（任意）" placeholder="例: ○○カフェ 渋谷 / うちのメニュー / 2 枚目は裏面" hint="店名（できれば地名も）を入れると、住所・営業時間・看板メニューなどを Web で調べてネタに書き足すよ。レシピなら「うちのメニュー」と書くとお店のメニューに、書かなければ参考レシピに入るよ" value={hint} onChange={(e) => setHint(e.target.value)} disabled={sending} />
          <Button variant="mustard" size="lg" full icon={<IconSparkles />} loading={sending} onClick={sendToAi}>LaRa にまかせる（自動で仕分け）</Button>
          <p className="text-center text-xs text-muted">読んだらトレイに届けるよ。次に読むのは {nextWorkerTime()} ごろ。</p>
          <Button variant="ghost" full disabled={sending} onClick={writeMyself}>自分で書く</Button>
        </div>
      </Sheet>

      <Confirm open={askClear} onClose={() => setAskClear(false)} title="写真をやめる？" body="選んだ写真は送らないよ。" confirmLabel="やめる" danger onConfirm={() => { setAskClear(false); clearPhotos() }} />
      <ClipEditorSheet open={!!draft} onClose={() => setDraft(null)} draft={draft ?? undefined} onSaved={(c) => nav(paths.clip(c.id), { replace: true })} />
    </>
  )
}
