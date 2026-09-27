import { PageHeader, EmptyState } from '@/components/ui/Page'

export function MenuCalendarPage() {
  return (
    <>
      <PageHeader title="メニュー記録" sub="日別の記録と分析" />
      <EmptyState emoji="🗓️" title="準備中" body="日別のメニューを記録して、構成比や人気を見られるようになります。" />
    </>
  )
}
