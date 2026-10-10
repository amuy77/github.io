import { useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { SettingsRow } from '@/components/ui/Settings'
import { friendlyError } from '@/lib/errors'
import { buildBackup, downloadText } from './backup'

/** 設定の「データを保存する」。ネタ帳・図鑑・記録などを 1 つのファイルにして手元に保存する（写真は含まない） */
export function BackupRow() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      const { filename, json } = await buildBackup()
      downloadText(filename, json)
      toast('データを保存したよ', 'success')
    } catch (e) { toast(friendlyError(e, '保存できませんでした'), 'error') } finally { setBusy(false) }
  }
  return (
    <SettingsRow icon="💾" title="データを保存する" sub="ネタ帳・レシピ・記録を 1 つのファイルに（写真は入らないよ）"
      trailing={<button type="button" disabled={busy} onClick={() => void run()} className="h-11 shrink-0 rounded-chip border border-line bg-paper px-4 text-[14px] font-bold disabled:opacity-50">{busy ? '保存中…' : '保存する'}</button>} />
  )
}
