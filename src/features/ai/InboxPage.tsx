import { PageHeader, EmptyState } from '@/components/ui/Page'

export function InboxPage() {
  return (
    <>
      <PageHeader title="受信トレイ" sub="AI が作ったカードが届く場所" />
      <EmptyState emoji="📬" title="まだ何も届いていません" body="写真をトレイに入れると、Claude が 1 日数回まとめてレシピカードにして届けます。" />
    </>
  )
}
