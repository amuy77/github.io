import { PageHeader, EmptyState } from '@/components/ui/Page'

export function QuickAddPage() {
  return (
    <>
      <PageHeader title="すぐメモ" back />
      <EmptyState emoji="📝" title="準備中" body="写真・URL・ひらめきをサッと保存する入口になります。" />
    </>
  )
}
