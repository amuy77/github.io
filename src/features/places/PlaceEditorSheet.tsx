import { useEffect, useRef, useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Field'
import { Chip } from '@/components/ui/Chip'
import { PhotoPicker } from '@/components/ui/PhotoPicker'
import { ImageThumb } from '@/components/ui/ImageThumb'
import { RatingInput } from '@/components/ui/Rating'
import { Toggle } from '@/components/ui/Toggle'
import { useToast } from '@/components/ui/Toast'
import { IconClipboard, IconX } from '@/components/ui/icons'
import { useDiscardGuard } from '@/components/ui/useDiscardGuard'
import type { ImageRef, PlaceRow } from '@/lib/supabase/database.types'
import { uploadPhoto, photoUrl, deleteUnusedPhotos } from '@/lib/images/upload'
import { friendlyError } from '@/lib/errors'
import { today } from '@/lib/dates'
import { useSession } from '@/features/auth/useSession'
import { celebrateFrom } from '@/features/game/celebrate'
import { fetchLinkPreview } from '@/features/clips/api'
import { areaOf, isGoogleMapsUrl, mapsInfoFrom, type MapsInfo } from './mapsUrl'
import { CUISINES, PRICE_BANDS } from './trends'
import { MapBox } from './MapBox'
import { useCreatePlace, usePlaces, useUpdatePlace } from './hooks'
import { geocodeAddress } from './api'

interface Props { open: boolean; onClose: () => void; place?: PlaceRow | null; onSaved?: (p: PlaceRow) => void }

const URL_RE = /https?:\/\/[^\s]+/
/** お店の ★ のひとこと（設定で「★をくわしく」にしたとき） */
const PLACE_WORDS = ['いまひとつ', 'ふつう', 'いい感じ', 'かなり好き', '最高！何度でも行きたい']

/** 気に入ったお店の追加・編集。開くたびにフォームを作り直す。入力途中で閉じようとしたら確認する */
export function PlaceEditorSheet({ open, onClose, place, onSaved }: Props) {
  const [dirty, setDirty] = useState(false)
  const { requestLeave, dialog } = useDiscardGuard(dirty)
  const requestClose = () => requestLeave(onClose)
  return (
    <>
      <Sheet open={open} onClose={requestClose} title={place ? 'お店を編集' : '気に入ったお店を追加'} tall>
        {open && <PlaceForm key={place?.id ?? 'new'} place={place} onClose={onClose} onCancel={requestClose} onSaved={onSaved} onDirtyChange={setDirty} />}
      </Sheet>
      {dialog}
    </>
  )
}

type LinkState = 'idle' | 'loading' | 'locating' | 'done' | 'geocoded' | 'nocoords' | 'noname' | 'notmaps' | 'error'
/** 読めた中身から、出す文言を決める（店名も場所も／店名だけ／場所だけ／どちらも無し） */
const linkStateOf = (info: MapsInfo): LinkState => (info.name ? (info.lat !== undefined ? 'done' : 'nocoords') : info.lat !== undefined ? 'noname' : 'error')

function PlaceForm({ place, onClose, onCancel, onSaved, onDirtyChange }: Omit<Props, 'open'> & { onCancel: () => void; onDirtyChange: (d: boolean) => void }) {
  const toast = useToast()
  const { userId } = useSession()
  const create = useCreatePlace()
  const update = useUpdatePlace()
  const others = usePlaces().data?.rows.filter((p) => p.lat !== null && p.id !== place?.id) ?? []
  const [url, setUrl] = useState(place?.url ?? '')
  const [mapsUrl, setMapsUrl] = useState<string | null>(place?.maps_url ?? null)
  const [name, setName] = useState(place?.name ?? '')
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(place?.lat != null && place.lng != null ? { lat: place.lat, lng: place.lng } : null)
  const [address, setAddress] = useState(place?.address ?? '')
  const [area, setArea] = useState(place?.area ?? '')
  const areaTouched = useRef(!!place?.area)
  const [cuisine, setCuisine] = useState(place?.cuisine ?? '')
  const [price, setPrice] = useState<number | null>(place?.price_band ?? null)
  const [rating, setRating] = useState<number | null>(place?.rating ?? null)
  const [revisit, setRevisit] = useState(place?.revisit ?? false)
  const [visited, setVisited] = useState(place ? place.visited_on ?? '' : today())
  const [note, setNote] = useState(place?.note ?? '')
  const [images, setImages] = useState<ImageRef[]>(place?.images ?? [])
  const [pending, setPending] = useState<{ file: File; url: string }[]>([])
  const [link, setLink] = useState<LinkState>('idle')
  // 読めなかったとき用: リンクをたどった先（原因を調べられるように小さく出す）
  const [seen, setSeen] = useState('')
  const [saving, setSaving] = useState(false)
  const saveBtn = useRef<HTMLButtonElement>(null)

  const snapshot = JSON.stringify({ url, name, pos, address, area, cuisine, price, rating, revisit, visited, note, images, pending: pending.length })
  const initial = useRef(snapshot)
  useEffect(() => { onDirtyChange(snapshot !== initial.current) }, [snapshot, onDirtyChange])
  useEffect(() => () => onDirtyChange(false), [onDirtyChange])

  // 住所の欄から場所を探す（リンクが無いお店や、ピンがずれていたとき用）
  const [locating, setLocating] = useState(false)
  async function locateFromAddress() {
    setLocating(true)
    const spot = await geocodeAddress(address)
    setLocating(false)
    if (spot) { setPos(spot); toast('📍 住所から場所を入れたよ', 'success') }
    else toast('住所から場所が見つからなかった。地図を押してピンを置いてね', 'error')
  }
  const changeAddress = (v: string) => { setAddress(v); if (!areaTouched.current) setArea(areaOf(v)) }
  // 分かったことは、まだ空いているところにだけ入れる（自分で書いたものは上書きしない）
  const apply = (info: MapsInfo) => {
    if (info.name) setName((cur) => cur || info.name!)
    if (info.lat !== undefined && info.lng !== undefined) setPos((cur) => cur ?? { lat: info.lat!, lng: info.lng! })
    if (info.address) setAddress((cur) => cur || info.address!)
    if (info.area && !areaTouched.current) setArea((cur) => cur || info.area!)
    if (info.mapsUrl) setMapsUrl(info.mapsUrl)
  }

  // リンクが入ったら、店名と場所を読む（500ms 待ってから）。短縮リンクは link-preview でたどる
  useEffect(() => {
    const m = url.match(URL_RE)
    if (!m || (place && m[0] === place.url)) return
    const target = m[0]
    if (!isGoogleMapsUrl(target)) return
    let alive = true
    const t = window.setTimeout(async () => {
      const local = mapsInfoFrom(target)
      apply(local)
      setLink('loading')
      setSeen('')
      try {
        const preview = await fetchLinkPreview(target)
        if (!alive) return
        const info = mapsInfoFrom(target, preview)
        apply(info)
        setSeen(preview.final_url ?? '')
        // リンクに座標が無くても、住所が分かればそこから場所を探してピンを置く（iPhone の共有リンクはこの形）
        if (info.lat === undefined && info.address) {
          setLink('locating')
          const spot = await geocodeAddress(info.address)
          if (!alive) return
          if (spot) { setPos((cur) => cur ?? spot); setLink('geocoded'); return }
        }
        setLink(linkStateOf(info))
      } catch {
        if (alive) setLink(linkStateOf(local))
      }
    }, 500)
    return () => { alive = false; window.clearTimeout(t) }
    // url だけを見る（apply は毎回作り直されるが、中身は setState だけ）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  const typed = url.match(URL_RE)
  const shown: LinkState = !typed ? 'idle' : !isGoogleMapsUrl(typed[0]) ? 'notmaps' : link
  const canPaste = typeof navigator !== 'undefined' && !!navigator.clipboard?.readText
  async function paste() {
    try {
      const text = await navigator.clipboard.readText()
      const m = text.match(URL_RE)
      if (m) setUrl(m[0])
      else toast('コピーした中にリンクが見つからなかったよ', 'error')
    } catch { toast('貼り付けできなかったので、長押しで貼り付けてね', 'error') }
  }

  const addFiles = (files: File[]) => setPending((p) => [...p, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))])
  const removePending = (i: number) => setPending((p) => { URL.revokeObjectURL(p[i].url); return p.filter((_, k) => k !== i) })

  async function save() {
    if (!userId) return
    if (!name.trim()) { toast('お店の名前を入れてね', 'error'); return }
    setSaving(true)
    try {
      const uploaded: ImageRef[] = []
      for (const p of pending) uploaded.push(await uploadPhoto(p.file, userId))
      const allImages = [...images, ...uploaded]
      const hasUrl = URL_RE.test(url)
      const row = {
        name: name.trim().slice(0, 80), url: hasUrl ? url.trim() : null, maps_url: hasUrl ? mapsUrl : null,
        lat: pos?.lat ?? null, lng: pos?.lng ?? null, address: address.trim().slice(0, 200), area: area.trim().slice(0, 40),
        cuisine: cuisine.trim().slice(0, 20), price_band: price, rating, revisit, note: note.trim(), images: allImages, visited_on: visited || null,
      }
      let saved: PlaceRow
      if (place) {
        saved = await update.mutateAsync({ id: place.id, patch: row })
        const removed = (place.images ?? []).filter((im) => !allImages.some((a) => a.path === im.path))
        if (removed.length) void deleteUnusedPhotos(removed)
        toast('保存したよ', 'success')
      } else {
        saved = await create.mutateAsync(row)
        celebrateFrom(saveBtn.current)
        toast('お気に入りのお店に保存！', 'success')
      }
      pending.forEach((p) => URL.revokeObjectURL(p.url))
      onSaved?.(saved)
      onClose()
    } catch (e) {
      toast(friendlyError(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  const removeBtn = "absolute -right-1 -top-1 grid size-7 place-items-center rounded-full bg-espresso-900 text-white before:absolute before:-inset-2 before:content-['']"
  return (
    <div className="flex flex-col gap-4 pb-2">
      <div className="flex flex-col gap-2">
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1"><Input label="Google マップのリンク" type="url" inputMode="url" placeholder="https://maps.app.goo.gl/…" value={url} onChange={(e) => setUrl(e.target.value)} /></div>
          {canPaste && <Button variant="secondary" icon={<IconClipboard size={16} />} onClick={paste}>貼り付け</Button>}
        </div>
        <p className="text-xs text-muted" aria-live="polite">
          {{
            idle: 'Google マップでお店を開いて「共有 → リンクをコピー」。貼ると店名と場所が入るよ',
            loading: 'お店の情報を読んでいるよ…',
            locating: '住所から場所を探しているよ…',
            done: '📍 店名と場所を入れたよ。違っていたら直してね',
            geocoded: '📍 住所から場所を入れたよ（だいたいの位置。ずれていたら地図を押して直してね）',
            nocoords: '店名は分かったけど、場所までは取れなかった。下の地図を押してピンを置いてね',
            noname: '📍 場所は入れたよ。お店の名前を入れてね',
            notmaps: 'Google マップのリンクじゃないみたい。リンクはそのまま保存できるよ',
            error: 'リンクから読み取れなかった。店名を入れて、下の地図を押してピンを置いてね',
          }[shown]}
        </p>
        {seen && !['done', 'geocoded', 'loading', 'locating'].includes(shown) && <p className="break-all text-[11px] text-muted/80">読み取った先: {seen}</p>}
      </div>

      <Input label="お店の名前" placeholder="コーヒースタンド Y" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-bold text-espresso-700">場所</span>
        <MapBox pick={pos} onPick={(lat, lng) => setPos({ lat, lng })} center={others[0] ? [others[0].lat!, others[0].lng!] : null} className="h-48 w-full overflow-hidden rounded-card border border-line" />
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="flex-1">{pos ? '地図を押すと、ピンを動かせるよ' : '地図を押すと、そこにピンを置くよ'}</span>
          {pos && <button type="button" className="font-bold underline underline-offset-2" onClick={() => setPos(null)}>ピンを外す</button>}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Input label="住所（任意）" placeholder="東京都渋谷区…" value={address} maxLength={200} onChange={(e) => changeAddress(e.target.value)} />
        {address.trim() && <Button size="sm" variant="secondary" className="self-start" loading={locating} onClick={locateFromAddress}>📍 住所から場所を探す</Button>}
      </div>
      <Input label="エリア" hint="一覧や傾向で使うよ（渋谷区・鎌倉市など）" placeholder="渋谷区" value={area} maxLength={40} onChange={(e) => { areaTouched.current = true; setArea(e.target.value) }} />

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-bold text-espresso-700">ジャンル</span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="ジャンル">
          {CUISINES.map((c) => <Chip key={c.name} active={cuisine === c.name} onClick={() => setCuisine(cuisine === c.name ? '' : c.name)}>{c.emoji} {c.name}</Chip>)}
        </div>
        <Input aria-label="ジャンル（自由に書く）" placeholder="ほかのジャンル（例: ベトナム料理）" value={CUISINES.some((c) => c.name === cuisine) ? '' : cuisine} maxLength={20} onChange={(e) => setCuisine(e.target.value)} />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-bold text-espresso-700">価格帯（1 人あたり）</span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="価格帯">
          {PRICE_BANDS.map((p) => <Chip key={p.value} active={price === p.value} onClick={() => setPrice(price === p.value ? null : p.value)}>{p.label}</Chip>)}
        </div>
      </div>

      <RatingInput label="評価" max={5} value={rating} onChange={setRating} words={PLACE_WORDS} />
      <div className="flex items-center gap-3 rounded-card border border-line bg-paper px-4 py-1">
        <span className="flex-1 text-[15px] font-bold">🔁 また行きたい</span>
        <Toggle checked={revisit} onChange={setRevisit} label="また行きたい" />
      </div>
      <Input label="行った日" type="date" value={visited} max={today()} onChange={(e) => setVisited(e.target.value)} />
      <Textarea label="メモ（食べたもの・感想）" placeholder="カルボナーラが絶品。窓際の席が気持ちいい" value={note} onChange={(e) => setNote(e.target.value)} />

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-bold text-espresso-700">写真</span>
        {(images.length > 0 || pending.length > 0) && (
          <div className="grid grid-cols-3 gap-2">
            {images.map((im, i) => (
              <div key={im.path} className="relative">
                <ImageThumb src={photoUrl(im, 'thumb')} className="aspect-square rounded-[10px]" />
                <button type="button" aria-label="写真を外す" onClick={() => setImages((x) => x.filter((_, k) => k !== i))} className={removeBtn}><IconX size={14} /></button>
              </div>
            ))}
            {pending.map((p, i) => (
              <div key={p.url} className="relative">
                <img src={p.url} alt="" className="aspect-square w-full rounded-[10px] object-cover" />
                <button type="button" aria-label="写真を外す" onClick={() => removePending(i)} className={removeBtn}><IconX size={14} /></button>
              </div>
            ))}
          </div>
        )}
        <PhotoPicker onFiles={addFiles} compact={images.length + pending.length > 0} disabled={saving} />
      </div>

      {/* シートの下の余白（16px）の分も下げて、保存の帯の下から中身が見えないように */}
      <div className="sticky -bottom-4 z-10 -mx-4 -mb-4 flex gap-2 border-t border-line bg-paper px-4 pb-[calc(12px+var(--safe-bottom))] pt-3 md:pb-3">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>やめる</Button>
        <Button ref={saveBtn} full loading={saving} onClick={save}>保存する</Button>
      </div>
    </div>
  )
}
