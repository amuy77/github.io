// supabase/migrations/20260927000000_init.sql に対応する型。
// プロジェクト作成後は MCP の generate_typescript_types で置き換えてよい（構造は同じ）。

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type ClipType = 'photo' | 'link' | 'note' | 'idea'
/** idea = 自分のアイデア、reference = 参考、unsorted = まだ仕分けていない */
export type ClipPurpose = 'idea' | 'reference' | 'unsorted'
/** ネタ帳のカテゴリの key（既定の 'sandwich' 'drink' 'wine' 'beer' 'coffee' 'shop' 'other' か、追加した 'c_xxxx'） */
export type ClipCategory = string
export type RecipeStatus = 'draft' | 'published'
/** menu = お店で出す確定メニュー、reference = 参考にしたいレシピ、unsorted = まだ仕分けていない */
export type RecipePurpose = 'menu' | 'idea' | 'reference' | 'unsorted'
export type RecipeSourceKind = 'manual' | 'ai_image' | 'ai_text' | 'text_paste'
export type AiJobKind = 'recipe_from_image' | 'recipe_from_text' | 'clip_from_image' | 'auto_from_image' | 'redo' | 'consult' | 'weekly_insights'
export type AiJobStatus = 'pending' | 'processing' | 'done' | 'failed' | 'cancelled'
export type { GenreColor } from '@/lib/genreColors'
import type { GenreColor } from '@/lib/genreColors'

export interface ImageRef { path: string; thumb_path: string; w: number; h: number; bytes: number }
export interface Ingredient { name: string; amount: string }
export interface LinkPreview { title?: string; description?: string; image?: string; site_name?: string; final_url?: string; instagram_blocked?: boolean; fetched_at?: string }
export interface Insight { kind: 'praise' | 'bias' | 'popular' | 'suggestion' | 'reminder'; emoji: string; title: string; body: string }

type Timestamps = { created_at: string; updated_at: string }

export type GenreRow = Timestamps & { id: string; user_id: string; name: string; color: GenreColor; sort_order: number
  /** アイコンの絵文字。空なら名前から自動 */
  emoji: string }
/** ネタ帳のカテゴリ（店主が追加・編集できる） */
export type ClipCategoryRow = Timestamps & { id: string; user_id: string; key: string; name: string; emoji: string; sort_order: number }
export type ClipRow = Timestamps & {
  id: string; user_id: string; type: ClipType; title: string; note: string; url: string | null
  images: ImageRef[]; preview: LinkPreview | null; category: ClipCategory; tags: string[]; shop_name: string | null; favorite: boolean
  /** 1〜5。null は保留（未評価） */
  rating: number | null
  /** AI が作って、まだ確認していない */
  needs_review: boolean
  /** アイデアか参考か */
  purpose: ClipPurpose
  /** ジャンル（図鑑と共通）。null はジャンルなし */
  genre_id: string | null
}
export type RecipeRow = Timestamps & {
  id: string; user_id: string; title: string; genre_id: string | null; hero_image: ImageRef | null
  ingredients: Ingredient[]; steps: string[]; notes: string; source_clip_id: string | null; source_kind: RecipeSourceKind
  source_job_id: string | null; status: RecipeStatus; favorite: boolean
  /** 1〜3。null は保留（未評価） */
  rating: number | null
  /** 同じ料理のグループ。グループ最初のレシピの id（最初のレシピ自身は null） */
  family_id: string | null
  /** 「試作2」「A案」など */
  variant_label: string
  /** グループ内の本命（採用中） */
  is_main: boolean
  /** 確定メニューか参考レシピか */
  purpose: RecipePurpose
}
export type MenuLogRow = Timestamps & { id: string; user_id: string; log_date: string; note: string }
export type MenuLogItemRow = { id: string; user_id: string; menu_log_id: string; recipe_id: string; sold_count: number | null; created_at: string }
export type AiJobRow = {
  id: string; user_id: string; kind: AiJobKind; status: AiJobStatus; payload: Json; result: Json | null; error: string | null
  attempts: number; started_at: string | null; finished_at: string | null; created_at: string
}
export type AiPreferenceRow = Timestamps & { id: string; user_id: string; rule: string; example: string; source_job_id: string | null; active: boolean }
export type AiInsightRow = { id: string; user_id: string; week_start: string; insights: Insight[]; model: string; created_at: string }

type GeneratedKeys = 'id' | 'user_id' | 'created_at' | 'updated_at'
type Table<Row extends object, Required extends keyof Row> = {
  Row: Row
  Insert: Partial<Omit<Row, Extract<GeneratedKeys, keyof Row>>> & Pick<Row, Required> & Partial<Pick<Row, Extract<GeneratedKeys, keyof Row>>>
  Update: Partial<Row>
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      genres: Table<GenreRow, 'name'>
      clips: Table<ClipRow, 'type'>
      clip_categories: Table<ClipCategoryRow, 'key' | 'name'>
      recipes: Table<RecipeRow, 'title'>
      menu_logs: Table<MenuLogRow, 'log_date'>
      menu_log_items: Table<MenuLogItemRow, 'menu_log_id' | 'recipe_id'>
      ai_jobs: Table<AiJobRow, 'kind'>
      ai_insights: Table<AiInsightRow, 'week_start' | 'insights' | 'model'>
      ai_preferences: Table<AiPreferenceRow, 'rule'>
    }
    Views: { [_ in never]: never }
    Functions: {
      activity_days: { Args: { since: string }; Returns: string[] }
      save_menu_log: { Args: { p_date: string; p_note: string; p_items: { recipe_id: string; sold_count: number | null }[] }; Returns: string }
      set_main_recipe: { Args: { p_ids: string[]; p_main: string | null }; Returns: null }
      delete_recipe: { Args: { p_id: string }; Returns: null }
      delete_clip_category: { Args: { p_id: string }; Returns: null }
      reorder_genres: { Args: { p_ids: string[] }; Returns: null }
      reorder_clip_categories: { Args: { p_ids: string[] }; Returns: null }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
