import { useCallback, useState } from 'react'
import type { RecipePurpose } from '@/lib/supabase/database.types'
import type { SortKey } from '@/components/ui/SortSelect'

/**
 * 図鑑の「いま見ている並び」を覚えておく（タブ・★・検索・表示順。ジャンルはネタ帳と共通で notes.ts）。スクロール位置は AppShell が全画面共通で戻す。
 * レシピを開いて戻ってきても、仕分けの途中から続けられるように。タブを閉じるまでの一時的な記憶。
 */
export interface RecipeListView {
  purpose: RecipePurpose | 'all' | null
  favOnly: boolean
  minRating: 0 | 3 | 2 | -1
  q: string
  /** 並び順（新しい順・名前順・評価順） */
  sort: SortKey
  /** 一覧に並んでいた順のレシピ id（詳細画面の「次へ」用） */
  order: string[]
  /** その並びの呼び名（メニューのタブから開いたとき「お店のメニュー」。空なら purpose のタブ名） */
  orderLabel: string
}

const KEY = 'lara.recipes.view'
const EMPTY: RecipeListView = { purpose: null, favOnly: false, minRating: 0, q: '', sort: 'new', order: [], orderLabel: '' }

export function readListView(): RecipeListView {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<RecipeListView>) } : EMPTY
  } catch { return EMPTY }
}

export function writeListView(patch: Partial<RecipeListView>) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ ...readListView(), ...patch })) } catch { /* 保存できなくても一覧は使える */ }
}

/** useState と同じ使い方で、値を覚えておく */
export function useListViewState<K extends 'purpose' | 'favOnly' | 'minRating' | 'q' | 'sort'>(key: K): [RecipeListView[K], (v: RecipeListView[K]) => void] {
  const [value, setValue] = useState<RecipeListView[K]>(() => readListView()[key])
  const set = useCallback((v: RecipeListView[K]) => { setValue(v); writeListView({ [key]: v } as Partial<RecipeListView>) }, [key])
  return [value, set]
}

export const PURPOSE_TAB_LABEL: Record<RecipePurpose | 'all', string> = { menu: 'メニュー', idea: 'アイデア', reference: '参考', unsorted: '未分類', all: 'すべて' }

/** 保存したときのトーストなどで使う呼び名 */
export const PURPOSE_NAME: Record<RecipePurpose, string> = { menu: 'お店のメニュー', idea: 'アイデア', reference: '参考レシピ', unsorted: '図鑑（未分類）' }
