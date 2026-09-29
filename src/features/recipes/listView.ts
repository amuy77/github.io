import { useCallback, useState } from 'react'
import type { RecipePurpose } from '@/lib/supabase/database.types'

/**
 * 図鑑の「いま見ている並び」を覚えておく（タブ・ジャンル・★・検索・スクロール位置・表示順）。
 * レシピを開いて戻ってきても、仕分けの途中から続けられるように。タブを閉じるまでの一時的な記憶。
 */
export interface RecipeListView {
  purpose: RecipePurpose | 'all' | null
  genreId: string
  favOnly: boolean
  minRating: 0 | 3 | 2 | -1
  q: string
  scrollY: number
  /** 一覧に並んでいた順のレシピ id（詳細画面の「次へ」用） */
  order: string[]
}

const KEY = 'lara.recipes.view'
const EMPTY: RecipeListView = { purpose: null, genreId: 'all', favOnly: false, minRating: 0, q: '', scrollY: 0, order: [] }

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
export function useListViewState<K extends 'purpose' | 'genreId' | 'favOnly' | 'minRating' | 'q'>(key: K): [RecipeListView[K], (v: RecipeListView[K]) => void] {
  const [value, setValue] = useState<RecipeListView[K]>(() => readListView()[key])
  const set = useCallback((v: RecipeListView[K]) => { setValue(v); writeListView({ [key]: v } as Partial<RecipeListView>) }, [key])
  return [value, set]
}

export const PURPOSE_TAB_LABEL: Record<RecipePurpose | 'all', string> = { menu: 'メニュー', reference: '参考', unsorted: '未分類', all: 'すべて' }
