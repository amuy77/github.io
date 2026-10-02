import { useState } from 'react'

// 旧「タブ置き場」（public/tabs/）のデータが、このホーム画面アプリの中に残っているときだけ出すお知らせ。
// 以前タブ置き場をホーム画面に追加していた場合、そのアイコンは今 LaRa を開くので、ここから /tabs/ へ案内して
// Planner への引っ越し（タブ置き場の「Planner へ引っ越す」）をしてもらう。引っ越したら二度と出ない。
function leftoverCount(): number {
  try {
    const s = JSON.parse(localStorage.getItem('tabokiba.v1') ?? 'null')
    if (!s || !Array.isArray(s.items) || s.movedAt) return 0
    return s.items.filter((i: { sample?: boolean }) => !i?.sample).length
  } catch {
    return 0
  }
}

export function TabokibaRescue() {
  const [n] = useState(leftoverCount)
  const [hidden, setHidden] = useState(false)
  if (!n || hidden) return null
  return (
    <div
      role="status"
      className="fixed inset-x-3 z-40 mx-auto flex max-w-md items-center gap-3 rounded-card border border-line bg-paper p-3 shadow-sheet md:bottom-6"
      style={{ bottom: 'calc(var(--tabbar-h) + var(--safe-bottom) + 12px)' }}
    >
      <div className="min-w-0 flex-1 text-[13px] leading-snug">
        <b className="block text-[14px]">タブ置き場のリンクが{n}件残っています</b>
        Planner に引っ越せます
      </div>
      <a
        href={`${import.meta.env.BASE_URL}tabs/`}
        className="shrink-0 rounded-full bg-green-600 px-3.5 py-2 text-[13px] font-bold text-white"
      >
        開いて引っ越す
      </a>
      <button type="button" onClick={() => setHidden(true)} aria-label="今は閉じる" className="shrink-0 px-1 text-lg text-muted">
        ×
      </button>
    </div>
  )
}
