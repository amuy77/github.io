import { useState } from 'react'
import { PageHeader, SectionTitle, EmptyState, SegmentedTabs, Skeleton } from '@/components/ui/Page'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip, Tag, Stamp, CountBadge } from '@/components/ui/Chip'
import { Input, Textarea, Select } from '@/components/ui/Field'
import { Sheet, Confirm } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { Mascot, MascotSays, type Mood } from '@/components/mascot/Mascot'
import { IconCamera, IconStar, IconTrash } from '@/components/ui/icons'

/** 開発時だけのコンポーネント一覧（/dev/ui） */
export function DevUiPage() {
  const toast = useToast()
  const [sheet, setSheet] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [tab, setTab] = useState<'week' | 'month'>('week')
  const [mood, setMood] = useState<Mood>('idle')
  return (
    <>
      <PageHeader title="UI ギャラリー" sub="開発用" />
      <div className="flex flex-col gap-5">
        <SectionTitle>ボタン</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <Button>プライマリ</Button><Button variant="secondary">セカンダリ</Button><Button variant="ghost">ゴースト</Button><Button variant="danger" icon={<IconTrash size={16} />}>削除</Button><Button variant="mustard">マスタード</Button><Button loading>保存中</Button><Button size="sm">小</Button><Button size="lg">大</Button>
          <IconButton label="カメラ"><IconCamera /></IconButton>
        </div>
        <SectionTitle>チップ・タグ・スタンプ</SectionTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Chip active>すべて</Chip><Chip count={6}>🥪 サンド</Chip><Chip>🍷 ワイン</Chip><Tag>Instagram</Tag><Tag>価格メモ</Tag><Stamp>人気</Stamp><Stamp color="text-green-600">NEW</Stamp><CountBadge n={3} />
        </div>
        <SectionTitle>カード</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <Card accent="green" pressable onClick={() => toast('タップした')}><p className="font-bold">BLT サンド</p><p className="text-xs text-muted">ベーコン・レタス・トマト</p><IconStar size={16} filled className="mt-2 text-mustard-400" /></Card>
          <Card accent="mustard"><p className="font-bold">ハンドドリップ</p><p className="text-xs text-muted">15g / 240ml / 92℃</p></Card>
          <Card accent="brick"><Skeleton className="h-4 w-2/3" /><Skeleton className="mt-2 h-3 w-1/2" /></Card>
          <Card accent="plum"><p className="font-bold">アイデア</p><hr className="receipt-line my-2" /><p className="text-xs text-muted">レシート風の区切り</p></Card>
        </div>
        <SectionTitle>フォーム</SectionTitle>
        <Card className="flex flex-col gap-3">
          <Input label="タイトル" placeholder="クロックムッシュ" />
          <Textarea label="メモ" placeholder="軽くて昼向き" />
          <Select label="カテゴリ"><option>サンド</option><option>ドリンク</option></Select>
          <SegmentedTabs value={tab} onChange={setTab} options={[{ value: 'week', label: '週' }, { value: 'month', label: '月' }]} />
        </Card>
        <SectionTitle>マスコット</SectionTitle>
        <Card className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">{(['idle', 'happy', 'thinking', 'sleepy', 'party', 'worried'] as Mood[]).map((m) => <Chip key={m} active={mood === m} onClick={() => setMood(m)}>{m}</Chip>)}</div>
          <MascotSays mood={mood}>今日は何を仕込む？</MascotSays>
          <div className="flex gap-3"><Mascot mood={mood} size={48} /><Mascot mood={mood} size={96} /></div>
        </Card>
        <SectionTitle>オーバーレイ</SectionTitle>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setSheet(true)}>シート</Button>
          <Button variant="secondary" onClick={() => setConfirm(true)}>確認</Button>
          <Button variant="secondary" onClick={() => toast('保存しました', 'success')}>トースト</Button>
          <Button variant="secondary" onClick={() => toast('失敗しました', 'error')}>エラー</Button>
        </div>
        <EmptyState emoji="🥐" title="空の状態" body="こんな感じで案内します。" action={<Button size="sm">はじめる</Button>} />
      </div>
      <Sheet open={sheet} onClose={() => setSheet(false)} title="シートの例" footer={<Button full onClick={() => setSheet(false)}>閉じる</Button>}>
        <p className="text-sm text-muted">下からせり上がるフォーム用。</p>
      </Sheet>
      <Confirm open={confirm} onClose={() => setConfirm(false)} onConfirm={() => toast('削除した', 'success')} title="削除しますか？" body="元に戻せません。" confirmLabel="削除" danger />
    </>
  )
}
