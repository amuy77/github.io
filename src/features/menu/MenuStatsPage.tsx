import { PageHeader, EmptyState } from '@/components/ui/Page'

export function MenuStatsPage() {
  return (
    <>
      <PageHeader title="分析" back="/menu" />
      <EmptyState emoji="📊" title="準備中" />
    </>
  )
}
