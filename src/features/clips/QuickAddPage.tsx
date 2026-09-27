import { useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { PageHeader } from '@/components/ui/Page'
import { Card } from '@/components/ui/Card'
import { IconBook, IconBulb, IconCamera, IconClipboard, IconImage, IconLink, IconNote } from '@/components/ui/icons'
import { useToast } from '@/components/ui/Toast'
import { MascotSays } from '@/components/mascot/Mascot'
import { paths } from '@/app/routes'
import { ClipEditorSheet, type ClipDraft } from './ClipEditorSheet'
import { cx } from '@/lib/cx'

const URL_RE = /https?:\/\/[^\s]+/

function draftFromText(text: string, title = ''): ClipDraft {
  const m = text.match(URL_RE)
  return { type: m ? 'link' : 'note', url: m?.[0] ?? '', note: m ? text.replace(m[0], '').trim() : text, title }
}

/**
 * 「＋」の入口。写真 / URL / メモ / ひらめき / レシピ。
 * iOS ショートカットからは #/add?url=…&text=… で開かれる。
 */
export function QuickAddPage() {
  const nav = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const [draft, setDraft] = useState<ClipDraft | null>(() => {
    const url = params.get('url') ?? ''
    const text = params.get('text') ?? ''
    return url || text ? draftFromText(`${url} ${text}`.trim(), params.get('title') ?? '') : null
  })
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
    if (files.length) setDraft({ type: 'photo', files })
  }

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
    { id: 'camera', icon: <IconCamera />, label: 'カメラで撮る', sub: '他店のメニュー、気になる一皿', color: 'bg-brick-500 text-white' },
    { id: 'library', icon: <IconImage />, label: '写真から選ぶ', sub: 'スクショやカメラロール', color: 'bg-mustard-400 text-espresso-900' },
    { id: 'paste', icon: <IconClipboard />, label: 'クリップボードから', sub: 'Instagram の「リンクをコピー」の後に', color: 'bg-plum-400 text-white' },
    { id: 'note', icon: <IconLink />, label: 'URL・メモを書く', sub: 'リンクや短いメモ', color: 'bg-green-600 text-white' },
    { id: 'idea', icon: <IconBulb />, label: 'ひらめき', sub: '新メニューの種、思いつき', color: 'bg-[#FFF2C2] text-espresso-900' },
    { id: 'recipe', icon: <IconBook />, label: 'レシピを作る', sub: '手入力・テキスト貼り付け・写真から', color: 'bg-wood-300 text-espresso-900' },
  ]

  return (
    <>
      <PageHeader title="すぐメモ" back={paths.home} />
      <input ref={cam} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={onFiles} />
      <input ref={lib} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={onFiles} />
      <div className="flex flex-col gap-4">
        <MascotSays mood="happy">何を残しておく？</MascotSays>
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
      <ClipEditorSheet open={!!draft} onClose={() => setDraft(null)} draft={draft ?? undefined} onSaved={(c) => nav(paths.clip(c.id), { replace: true })} />
    </>
  )
}
