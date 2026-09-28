import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Mascot } from '@/components/mascot/Mascot'
import { paths } from '@/app/routes'

/** 「LaRa に相談」— 質問の下書きと、相談したいレシピを持って /ask を開く */
export function AskLaraButton({ q, recipeId, compareWithId, full }: { q?: string; recipeId?: string; compareWithId?: string; full?: boolean }) {
  const nav = useNavigate()
  const go = () => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (recipeId) p.set('recipe', recipeId)
    if (compareWithId) p.set('vs', compareWithId)
    nav(`${paths.ask}?${p.toString()}`)
  }
  return (
    <Button variant="secondary" full={full} onClick={go} icon={<Mascot size={22} />}>LaRa に相談</Button>
  )
}
