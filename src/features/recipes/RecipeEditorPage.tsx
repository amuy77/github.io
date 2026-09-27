import { PageHeader, EmptyState } from '@/components/ui/Page'

export function RecipeEditorPage() {
  return (
    <>
      <PageHeader title="レシピを作る" back />
      <EmptyState emoji="✍️" title="準備中" />
    </>
  )
}
