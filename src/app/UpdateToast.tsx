import { useRegisterSW } from 'virtual:pwa-register/react'

/** 新しいバージョンがあるときだけ出る小さな案内（入力中に勝手にリロードしない）。置き場所は AppShell のボトムの積み重ね */
export function UpdateToast() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW()
  if (!needRefresh) return null
  return (
    <div className="flex items-center gap-3 rounded-card border border-line bg-paper p-3 shadow-sheet">
      <span className="text-xl" aria-hidden>✨</span>
      <p className="flex-1 text-[13px] font-bold">新しいバージョンがあります</p>
      <button type="button" className="h-9 rounded-chip bg-green-600 px-3 text-[13px] font-bold text-white" onClick={() => updateServiceWorker(true)}>更新</button>
      <button type="button" className="h-9 rounded-chip px-2 text-[13px] font-bold text-muted" onClick={() => setNeedRefresh(false)}>あとで</button>
    </div>
  )
}
