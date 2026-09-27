import { useParams } from 'react-router'
import { PageHeader, EmptyState } from '@/components/ui/Page'
import { formatMD } from '@/lib/dates'

export function MenuDayPage() {
  const { date = '' } = useParams()
  return (
    <>
      <PageHeader title={date ? formatMD(date) : 'メニュー'} back="/menu" />
      <EmptyState emoji="🗓️" title="準備中" />
    </>
  )
}
