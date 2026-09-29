import { useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { PageHeader } from '@/components/ui/Page'
import { Card } from '@/components/ui/Card'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { IconBook, IconBulb, IconCamera, IconClipboard, IconImage, IconLink, IconNote, IconSparkles, IconX } from '@/components/ui/icons'
import { useToast } from '@/components/ui/Toast'
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
 * 「＋」の入口。写真 / URL / メモ / ひらめき / レシピ。
 * 写真は AI に渡すのが既定（ネタ帳かレシピかを AI が判断して保存する）。
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
  const cam = useRef<HTMLInputElement>(null)
  const lib = useRef<HTMLInputElement>(null)

  async function paste() {
    try {
      const text = await navigator.clipboard.readText()
      if (!text.trim()) { toast('クリップボードは空でした'); return }
      setDraft(draftFromText(text))
    } catch {
      toast('貼り付けが許可されませんでした。メモの欄に直接ペーストしてね')
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
      toast(`AI に渡しました。次の処理は ${nextWorkerTime()} ごろ`, 'success')
      nav(paths.inbox, { replace: true })
    } catch (e) {
      toast(e instanceof Error ? e.message : '送れませんでした', 'error')
    } finally {
      setSending(false)
    }
  }

  /** AI を使わず、いつものネタ帳フォームで書く */
  const writeMyself = () => { const files = photos.map((p) => p.file); clearPhotos(); setDraft({ type: 'photo', files }) }

  type ActionId = 'camera' | 'library' | 'paste' | 'note' | 'idea' | 'recipe'
  const handle = (id: ActionId) => {
    switch (id) {
      case 'camera': cam.current?.click(); break
      case 'library': lib.current?.click(); break
      case 'paste': void paste(); break
      case 'note': setDraft({ type: 'note' }); break
      case 'idea': setDraft({ type: 'idea' }); break
      case 'recipe': nav(paths.recipeNew); break
    }
  }
  const actions: { id: ActionId; icon: React.ReactNode; label: string; sub: string; color: string }[] = [
    { id: 'camera', icon: <IconCamera />, label: 'カメラで撮る', sub: '撮るだけ。ネタ帳かレシピかは AI が判断', color: 'bg-brick-500 text-white' },
    { id: 'library', icon: <IconImage />, label: '写真から選ぶ', sub: 'スクショやカメラロール。AI が振り分け', color: 'bg-mustard-400 text-espresso-900' },
    { id: 'paste', icon: <IconClipboard />, label: 'クリップボードから', sub: 'Instagram の「リンクをコピー」の後に', color: 'bg-plum-400 text-white' },
    { id: 'note', icon: <IconLink />, label: 'URL・メモを書く', sub: 'リンクや短いメモ', color: 'bg-green-600 text-white' },
    { id: 'idea', icon: <IconBulb />, label: 'ひらめき', sub: '新メニューの種、思いつき', color: 'bg-[#FFF2C2] text-espresso-900' },
    { id: 'recipe', icon: <IconBook />, label: 'レシピを作る', sub: '手入力・テキスト貼り付け', color: 'bg-wood-300 text-espresso-900' },
  ]

  return (
    <>
      <PageHeader title="すぐメモ" back={paths.home} />
      <input ref={cam} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={onFiles} />
      <input ref={lib} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={onFiles} />
      <div className="flex flex-col gap-4">
        <MascotSays mood="happy">何を残しておく？写真なら、あとは AI にまかせて OK。</MascotSays>
        <div className="grid grid-cols-2 gap-3">
          {actions.map((a) => (
            <Card key={a.id} pressable padded={false} className="overflow-hidden" onClick={() => handle(a.id)} onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') handle(a.id) }}>
              <div className={cx('flex h-14 items-center gap-2 px-4 font-bold', a.color)}>{a.icon}<span className="text-[14px]">{a.label}</span></div>
              <p className="px-4 py-3 text-[12px] text-muted">{a.sub}</p>
            </Card>
          ))}
        </div>
        <p className="text-center text-xs text-muted"><IconNote size={12} className="inline" /> iPhone の「写真からテキストをコピー」→「クリップボードから」で、手書きメモも読み込めるよ</p>
      </div>

      <Sheet open={photos.length > 0} onClose={() => { if (!sending) clearPhotos() }} title="写真を AI に渡す">
        <div className="flex flex-col gap-4 pb-2">
          <MascotSays mood="thinking">レシピなら下書きカードに、他店のメニューやラベルならネタ帳に。読み取った名前とメモも付けておくね。</MascotSays>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p, i) => (
              <div key={p.url} className="relative">
                <img src={p.url} alt="" className="aspect-square w-full rounded-[10px] object-cover" />
                {!sending && <button type="button" aria-label="写真を外す" onClick={() => removePhoto(i)} className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full bg-espresso-900 text-white"><IconX size={14} /></button>}
              </div>
            ))}
            {!sending && (
              <button type="button" onClick={() => lib.current?.click()} className="grid aspect-square place-items-center rounded-[10px] border-2 border-dashed border-line text-muted">
                <IconImage />
              </button>
            )}
          </div>
          <Input label="ヒント（任意）" placeholder="例: ○○カフェ 渋谷 / うちのメニュー / 2 枚目は裏面" hint="店名（できれば地名も）を入れると、住所・営業時間・看板メニューなどを Web で調べてネタに書き足すよ。レシピなら「うちのメニュー」と書くとお店のメニューに、書かなければ参考レシピに入るよ" value={hint} onChange={(e) => setHint(e.target.value)} disabled={sending} />
          <Button variant="mustard" size="lg" full icon={<IconSparkles />} loading={sending} onClick={sendToAi}>AI にまかせる（自動で振り分け）</Button>
          <p className="text-center text-xs text-muted">結果は受信トレイに届きます。次の処理は {nextWorkerTime()} ごろ。</p>
          <Button variant="ghost" full disabled={sending} onClick={writeMyself}>AI を使わず自分で書く</Button>
        </div>
      </Sheet>

      <ClipEditorSheet open={!!draft} onClose={() => setDraft(null)} draft={draft ?? undefined} onSaved={(c) => nav(paths.clip(c.id), { replace: true })} />
    </>
  )
}
