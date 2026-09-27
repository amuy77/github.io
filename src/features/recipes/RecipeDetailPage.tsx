import { PageHeader, EmptyState } from '@/components/ui/Page'

export function RecipeDetailPage() {
  return (
    <>
      <PageHeader title="レシピ" back />
      <EmptyState emoji="📖" title="準備中" />
    </>
  )
}
