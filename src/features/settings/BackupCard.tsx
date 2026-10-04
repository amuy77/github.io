import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { friendlyError } from '@/lib/errors'
import { buildBackup, downloadText } from './backup'

/** 設定の「バックアップ」。全部のデータを JSON 1 つにして手元に保存する */
export function BackupCard() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      const { filename, json } = await buildBackup()
      downloadText(filename, json)
      toast('バックアップを保存しました', 'success')
    } catch (e) { toast(friendlyError(e, 'バックアップできませんでした'), 'error') } finally { setBusy(false) }
  }
  return (
    <Card className="flex items-center gap-3">
      <div className="flex-1">
        <p className="font-bold">バックアップ</p>
        <p className="text-xs text-muted">ネタ帳・図鑑・メニュー記録・ジャンル・カテゴリ・LaRa が覚えたことを 1 つのファイルに。写真は URL だけ入ります</p>
      </div>
      <Button variant="secondary" size="sm" loading={busy} onClick={() => void run()}>書き出す</Button>
    </Card>
  )
}
