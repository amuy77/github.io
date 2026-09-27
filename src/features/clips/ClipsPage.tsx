import { PageHeader, EmptyState } from '@/components/ui/Page'

export function ClipsPage() {
  return (
    <>
      <PageHeader title="ネタ帳" sub="気になったもの、ぜんぶここに" />
      <EmptyState emoji="📌" title="まだネタがありません" body="次のステップで、写真・URL・メモを保存できるようになります。" />
    </>
  )
}
