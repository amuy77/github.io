import { PageHeader, EmptyState } from '@/components/ui/Page'

export function RecipesPage() {
  return (
    <>
      <PageHeader title="レシピ図鑑" sub="ジャンル別に集める" />
      <EmptyState emoji="📖" title="図鑑はまだ空っぽ" body="次のステップで、レシピカードを作れるようになります。" />
    </>
  )
}
