import { useEffect, useRef, useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Field'
import { Chip, Tag } from '@/components/ui/Chip'
import { PhotoPicker } from '@/components/ui/PhotoPicker'
import { ImageThumb } from '@/components/ui/ImageThumb'
import { useToast } from '@/components/ui/Toast'
import { IconX } from '@/components/ui/icons'
import type { ClipCategory, ClipRow, ClipType, ImageRef, LinkPreview } from '@/lib/supabase/database.types'
import { uploadPhoto, photoUrl, deletePhotos } from '@/lib/images/upload'
import { useSession } from '@/features/auth/useSession'
import { celebrateFrom } from '@/features/game/celebrate'
import { CATEGORIES, SUGGESTED_TAGS } from './categories'
import { fetchLinkPreview, FunctionError } from './api'
import { useCreateClip, useUpdateClip } from './hooks'

export interface ClipDraft {
  type?: ClipType
  title?: string
  note?: string
  url?: string
  category?: ClipCategory
  tags?: string[]
  shop_name?: string
  files?: File[]
}

interface Props {
  open: boolean
  onClose: () => void
  /** 編集対象。無ければ新規 */
  clip?: ClipRow | null
  /** 新規のときの初期値（QuickAdd から） */
  draft?: ClipDraft
  onSaved?: (clip: ClipRow) => void
}

const URL_RE = /https?:\/\/[^\s]+/

function guessCategory(text: string): ClipCategory | null {
  const t = text.toLowerCase()
  if (/ワイン|wine|ヴァン|vin\b/.test(t)) return 'wine'
  if (/ビール|beer|エール|ale\b|ipa\b|ラガー/.test(t)) return 'beer'
  if (/コーヒー|珈琲|coffee|エスプレッソ|ラテ|ドリップ/.test(t)) return 'coffee'
  if (/サンド|sand|バゲット|クロワッサン|ホットドッグ|パニーニ/.test(t)) return 'sandwich'
  if (/ジュース|ソーダ|スムージー|ティー|紅茶|drink|レモネード/.test(t)) return 'drink'
  return null
}

/** 開くたびにフォームを作り直す（key で初期化） */
export function ClipEditorSheet({ open, onClose, clip, draft, onSaved }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title={clip ? 'ネタを編集' : 'ネタ帳に追加'} tall footer={<div id="clip-editor-footer" />}>
      {open && <ClipForm key={`${clip?.id ?? 'new'}-${draft ? 'd' : 'n'}`} clip={clip} draft={draft} onClose={onClose} onSaved={onSaved} />}
    </Sheet>
  )
}

function ClipForm({ clip, draft, onClose, onSaved }: Omit<Props, 'open'>) {
  const toast = useToast()
  const { userId } = useSession()
  const create = useCreateClip()
  const update = useUpdateClip()
  const [title, setTitle] = useState(clip?.title ?? draft?.title ?? '')
  const [note, setNote] = useState(clip?.note ?? draft?.note ?? '')
  const [url, setUrl] = useState(clip?.url ?? draft?.url ?? '')
  const [category, setCategory] = useState<ClipCategory>(() => clip?.category ?? draft?.category ?? guessCategory(`${draft?.title ?? ''} ${draft?.note ?? ''} ${draft?.url ?? ''}`) ?? 'other')
  const [tags, setTags] = useState<string[]>(clip?.tags ?? draft?.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [shop, setShop] = useState(clip?.shop_name ?? draft?.shop_name ?? '')
  const [isIdea, setIsIdea] = useState((clip?.type ?? draft?.type) === 'idea')
  const [images, setImages] = useState<ImageRef[]>(clip?.images ?? [])
  const [pending, setPending] = useState<{ file: File; url: string }[]>(() => (draft?.files ?? []).map((file) => ({ file, url: URL.createObjectURL(file) })))
  const [preview, setPreview] = useState<LinkPreview | null>(clip?.preview ?? null)
  const [previewState, setPreviewState] = useState<'idle' | 'loading' | 'blocked' | 'error'>('idle')
  const [saving, setSaving] = useState(false)
  const saveBtn = useRef<HTMLButtonElement>(null)

  // URL が入ったらプレビュー取得（500ms デバウンス）
  useEffect(() => {
    const m = url.match(URL_RE)
    if (!m) return
    const target = m[0]
    if (preview?.final_url && (preview.final_url === target || target.startsWith(preview.final_url))) return
    let alive = true
    const t = window.setTimeout(async () => {
      setPreviewState('loading')
      try {
        const p = await fetchLinkPreview(target)
        if (!alive) return
        setPreview(p)
        setPreviewState(p.instagram_blocked ? 'blocked' : 'idle')
        if (p.title && !p.instagram_blocked) setTitle((cur) => cur || p.title || '')
      } catch (e) {
        if (!alive) return
        setPreviewState('error')
        if (e instanceof FunctionError && e.code === 'URL_BLOCKED') toast('その URL は取得できません', 'error')
      }
    }, 500)
    return () => { alive = false; window.clearTimeout(t) }
    // preview を依存に入れると取得のたびに再実行されるので url だけを見る
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  const addTag = (t: string) => { const v = t.trim(); if (v && !tags.includes(v)) setTags([...tags, v]); setTagInput('') }
  const addFiles = (files: File[]) => setPending((p) => [...p, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))])
  const removePending = (i: number) => setPending((p) => { URL.revokeObjectURL(p[i].url); return p.filter((_, k) => k !== i) })
  const removeImage = (i: number) => setImages((im) => im.filter((_, k) => k !== i))

  async function save() {
    if (!userId) return
    const hasUrl = URL_RE.test(url)
    const type: ClipType = isIdea ? 'idea' : pending.length + images.length > 0 ? 'photo' : hasUrl ? 'link' : 'note'
    if (!title.trim() && !note.trim() && !hasUrl && pending.length + images.length === 0) { toast('何か 1 つ入れてね（写真・URL・メモ）', 'error'); return }
    setSaving(true)
    try {
      const uploaded: ImageRef[] = []
      for (const p of pending) uploaded.push(await uploadPhoto(p.file, userId))
      const allImages = [...images, ...uploaded]
      const row = { type, title: title.trim(), note: note.trim(), url: hasUrl ? url.trim() : null, images: allImages, preview: hasUrl ? preview : null, category, tags, shop_name: shop.trim() || null }
      let saved: ClipRow
      if (clip) {
        saved = await update.mutateAsync({ id: clip.id, patch: row })
        const removed = (clip.images ?? []).filter((im) => !allImages.some((a) => a.path === im.path))
        if (removed.length) void deletePhotos(removed)
        toast('更新しました', 'success')
      } else {
        saved = await create.mutateAsync(row)
        celebrateFrom(saveBtn.current)
        toast('ネタ帳に保存！', 'success')
      }
      pending.forEach((p) => URL.revokeObjectURL(p.url))
      onSaved?.(saved)
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : '保存できませんでした', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-2">
      <div className="flex gap-2">
        <Chip active={!isIdea} onClick={() => setIsIdea(false)}>📌 ネタ</Chip>
        <Chip active={isIdea} onClick={() => setIsIdea(true)}>💡 ひらめき</Chip>
      </div>

      {!isIdea && (
        <div className="flex flex-col gap-2">
          {(images.length > 0 || pending.length > 0) && (
            <div className="grid grid-cols-3 gap-2">
              {images.map((im, i) => (
                <div key={im.path} className="relative">
                  <ImageThumb src={photoUrl(im, 'thumb')} className="aspect-square rounded-[10px]" />
                  <button type="button" aria-label="写真を外す" onClick={() => removeImage(i)} className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full bg-espresso-900 text-white"><IconX size={14} /></button>
                </div>
              ))}
              {pending.map((p, i) => (
                <div key={p.url} className="relative">
                  <img src={p.url} alt="" className="aspect-square w-full rounded-[10px] object-cover" />
                  <button type="button" aria-label="写真を外す" onClick={() => removePending(i)} className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full bg-espresso-900 text-white"><IconX size={14} /></button>
                </div>
              ))}
            </div>
          )}
          <PhotoPicker onFiles={addFiles} compact={images.length + pending.length > 0} disabled={saving} />
        </div>
      )}

      <Input label={isIdea ? 'ひとこと（任意）' : 'タイトル'} placeholder={isIdea ? '秋メニュー案' : 'クロックムッシュ ¥980'} value={title} onChange={(e) => setTitle(e.target.value)} />
      <Textarea label={isIdea ? 'ひらめき' : 'メモ'} placeholder={isIdea ? '栗とマスカルポーネのクロワッサン。はちみつ少し。' : '軽くて昼向き。BLT と合いそう'} value={note} onChange={(e) => setNote(e.target.value)} />

      {!isIdea && (
        <div className="flex flex-col gap-2">
          <Input label="URL（Instagram など）" type="url" inputMode="url" placeholder="https://www.instagram.com/p/…" value={url} onChange={(e) => setUrl(e.target.value)} />
          {previewState === 'loading' && <p className="text-xs text-muted">プレビューを取得中…</p>}
          {previewState === 'blocked' && <p className="rounded-[10px] bg-mustard-300/30 px-3 py-2 text-xs font-bold text-mustard-500">Instagram はプレビューを出してくれないので、スクショを添付しておくと後で見やすいよ。</p>}
          {previewState === 'error' && <p className="text-xs text-muted">プレビューは取れなかったけど、URL は保存できます。</p>}
          {preview && !preview.instagram_blocked && (preview.title || preview.image) && (
            <div className="flex gap-3 rounded-[10px] border border-line bg-oat-50 p-2">
              {preview.image && <ImageThumb src={preview.image} className="size-16 shrink-0 rounded-[8px]" />}
              <div className="min-w-0"><p className="line-clamp-2 text-[13px] font-bold">{preview.title}</p><p className="truncate text-[11px] text-muted">{preview.site_name ?? preview.final_url}</p></div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-bold text-espresso-700">カテゴリ</span>
        <div className="flex flex-wrap gap-2">{CATEGORIES.map((c) => <Chip key={c.value} active={category === c.value} onClick={() => setCategory(c.value)}>{c.emoji} {c.label}</Chip>)}</div>
      </div>

      {!isIdea && <Input label="お店の名前（任意）" placeholder="コーヒースタンド Y" value={shop} onChange={(e) => setShop(e.target.value)} />}

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-bold text-espresso-700">タグ</span>
        {tags.length > 0 && <div className="flex flex-wrap gap-1.5">{tags.map((t) => <button key={t} type="button" onClick={() => setTags(tags.filter((x) => x !== t))} className="inline-flex items-center gap-1 rounded-chip bg-green-600 px-2.5 py-1 text-[12px] font-bold text-white">{t} <IconX size={12} /></button>)}</div>}
        <div className="flex gap-2">
          <Input placeholder="タグを追加" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput) } }} />
          <Button variant="secondary" onClick={() => addTag(tagInput)}>追加</Button>
        </div>
        <div className="flex flex-wrap gap-1.5">{SUGGESTED_TAGS.filter((t) => !tags.includes(t)).map((t) => <button key={t} type="button" onClick={() => addTag(t)}><Tag className="hover:bg-oat-100">+ {t}</Tag></button>)}</div>
      </div>

      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-line bg-paper px-4 pb-[calc(12px+var(--safe-bottom))] pt-3 md:pb-3">
        <Button variant="secondary" onClick={onClose} disabled={saving}>やめる</Button>
        <Button ref={saveBtn} full loading={saving} onClick={save}>{clip ? '更新する' : '保存する'}</Button>
      </div>
    </div>
  )
}
