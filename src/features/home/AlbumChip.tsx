import { useEffect, useMemo, useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Mascot } from '@/components/mascot/Mascot'
import { cx } from '@/lib/cx'
import { addDays, today, weekStart } from '@/lib/dates'
import { useMenuLogs } from '@/features/menu/hooks'
import { useRecipes } from '@/features/recipes/hooks'
import { useClips } from '@/features/clips/hooks'
import { readLetters, saveLetters, writeLetter, type Letter } from './letters'
import { readAlbum, TREASURES, type Album } from './album'
import { OUTFITS } from './shop3d/outfit'
import { SegmentedTabs } from '@/components/ui/Page'

/** 週のはじめに LaRa が手紙を書く（その週の分がまだなら、先週の記録がそろったところで書いて端末に取っておく） */
function useWeeklyLetter() {
  const week = weekStart(today())
  const [letters, setLetters] = useState<Letter[]>(readLetters)
  const has = letters.some((l) => l.id === week)
  const logs = useMenuLogs(addDays(week, -7), addDays(week, -1), !has)
  const recipes = useRecipes(!has)
  const clips = useClips(!has)
  const ready = !has && !!logs.data && !!recipes.data && !!clips.data
  // 書いた手紙は state ではなく計算で足す（effect の中で state を変えると描き直しが重なる）。端末への保存だけ effect で
  const fresh = useMemo(() => (ready ? writeLetter({ week, logs: logs.data!, recipes: recipes.data!, clips: clips.data! }) : null), [ready]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (fresh) saveLetters([fresh, ...readLetters().filter((l) => l.id !== fresh.id)]) }, [fresh])
  const all = fresh ? [fresh, ...letters.filter((l) => l.id !== fresh.id)] : letters
  const markRead = () => { const next = all.map((l) => ({ ...l, read: true })); saveLetters(next); setLetters(next) }
  return { letters: all, unread: all.some((l) => !l.read), markRead }
}

type Tab = 'letters' | 'outfits' | 'sayings' | 'treasures'

/** アルバムの中身が変わったら（服を見た・言った・拾った）読み直す */
function useAlbum(): Album {
  const [a, setA] = useState(readAlbum)
  useEffect(() => { const on = () => setA(readAlbum()); window.addEventListener('lara-album', on); return () => window.removeEventListener('lara-album', on) }, [])
  return a
}

/**
 * ホーム右上の 📔 LaRa のアルバム: 手紙・服の図鑑・語録・たからもの。
 * 未読の手紙があれば赤い点。どれも減らない・取り逃しても損がない
 */
export function AlbumChip({ className }: { className?: string }) {
  const { letters, unread, markRead } = useWeeklyLetter()
  const album = useAlbum()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('letters')
  const [shown, setShown] = useState(0)
  const letter = letters[shown] ?? letters[0]
  const seen = OUTFITS.filter((o) => album.outfits[o.id]).length
  const found = TREASURES.filter((t) => album.treasures[t.id]).length
  return (
    <>
      <button type="button" onClick={() => { setShown(0); setTab('letters'); setOpen(true); markRead() }} aria-label={unread ? 'LaRa のアルバム（新しい手紙）' : 'LaRa のアルバム'} title="LaRa のアルバム"
        className={cx('pointer-events-auto relative flex h-9 shrink-0 items-center gap-1 rounded-full border border-line bg-paper/90 pl-2 pr-2.5 text-[11px] font-bold text-espresso-700 shadow-card backdrop-blur', className)}>
        <span className="text-[15px]" aria-hidden>📔</span>アルバム
        {unread && <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-brick-500" aria-hidden />}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="LaRa のアルバム" tall>
        <div className="flex flex-col gap-4">
          <SegmentedTabs value={tab} onChange={setTab} className="self-start"
            options={[{ value: 'letters', label: '✉️ 手紙' }, { value: 'outfits', label: '👗 服' }, { value: 'sayings', label: '💬 語録' }, { value: 'treasures', label: '💎 たから' }]} />

          {tab === 'letters' && (!letter ? <p className="text-sm text-muted">週のはじめに LaRa が手紙を書くよ</p> : (
            <>
              <article className="relative rounded-card border border-mustard-300 bg-[#FFF8E6] p-4 pb-5 shadow-card" aria-label={`${letter.week} の手紙`}>
                <div className="flex flex-col gap-2 text-[15px] leading-relaxed text-espresso-900">
                  {letter.lines.map((t, i) => <p key={i} className={i === letter.lines.length - 1 ? 'text-right font-bold' : ''}>{t}</p>)}
                </div>
                <Mascot size={44} className="absolute -bottom-3 -left-2" />
              </article>
              {letters.length > 1 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-[13px] font-bold text-espresso-700">これまでの手紙</p>
                  <div className="flex flex-wrap gap-2">
                    {letters.map((l, i) => (
                      <button key={l.id} type="button" onClick={() => setShown(i)} aria-pressed={i === shown}
                        className={cx('rounded-chip border px-3 py-1.5 text-[13px] font-bold', i === shown ? 'border-green-600 bg-green-600 text-white' : 'border-line bg-paper')}>
                        {Number(l.week.slice(5, 7))}/{Number(l.week.slice(8, 10))} の週
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ))}

          {tab === 'outfits' && (
            <section aria-label="服の図鑑" className="flex flex-col gap-2">
              <p className="text-xs text-muted">LaRa が着ているのを見た服が載るよ（{seen} / {OUTFITS.length}）。季節の服は、その季節に会えるかも</p>
              <div className="grid grid-cols-3 gap-2">
                {OUTFITS.map((o) => {
                  const at = album.outfits[o.id]
                  return (
                    <div key={o.id} className={cx('flex flex-col items-center gap-1 rounded-card border p-3 text-center', at ? 'border-line bg-paper' : 'border-dashed border-line bg-oat-50')}>
                      <span className={cx('text-[30px]', !at && 'opacity-25 grayscale')} aria-hidden>{o.emoji}</span>
                      <span className="text-[12px] font-bold leading-tight">{at ? o.label : '？？？'}</span>
                      {at && <span className="text-[10px] text-muted">{Number(at.slice(5, 7))}/{Number(at.slice(8, 10))} に見た</span>}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {tab === 'sayings' && (
            <section aria-label="LaRa 語録" className="flex flex-col gap-2">
              <p className="text-xs text-muted">LaRa が言ったことが、ここにたまっていくよ（{album.sayings.length} こ）</p>
              {album.sayings.length === 0 ? <p className="text-sm text-muted">まだないよ。ホームで LaRa のひとことを聞いてみてね</p> : (
                <ul className="flex flex-col gap-1.5">
                  {album.sayings.slice(0, 120).map((x) => (
                    <li key={x.text} className="rounded-[12px] border border-line bg-paper px-3 py-2 text-[14px] leading-snug">「{x.text}」<span className="ml-1 text-[10px] text-muted">{Number(x.date.slice(5, 7))}/{Number(x.date.slice(8, 10))}</span></li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {tab === 'treasures' && (
            <section aria-label="たからもの" className="flex flex-col gap-2">
              <p className="text-xs text-muted">ホームに 1 日 1 つ、何かが落ちてるよ（{found} / {TREASURES.length} しゅるい）。拾い忘れても大丈夫</p>
              <div className="grid grid-cols-4 gap-2">
                {TREASURES.map((t) => {
                  const n = album.treasures[t.id] ?? 0
                  return (
                    <div key={t.id} className={cx('flex flex-col items-center gap-0.5 rounded-card border p-2 text-center', n ? 'border-line bg-paper' : 'border-dashed border-line bg-oat-50')}>
                      <span className={cx('text-[26px]', !n && 'opacity-25 grayscale')} aria-hidden>{t.emoji}</span>
                      <span className="text-[11px] font-bold leading-tight">{n ? t.name : '？？？'}</span>
                      {n > 0 && <span className="text-[10px] tabular-nums text-muted">× {n}</span>}
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      </Sheet>
    </>
  )
}
