// supabase/migrations/20260927000000_init.sql に対応する型。
// プロジェクト作成後は MCP の generate_typescript_types で置き換えてよい（構造は同じ）。

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type ClipType = 'photo' | 'link' | 'note' | 'idea'
export type ClipCategory = 'sandwich' | 'drink' | 'wine' | 'beer' | 'coffee' | 'shop' | 'other'
export type RecipeStatus = 'draft' | 'published'
export type RecipeSourceKind = 'manual' | 'ai_image' | 'ai_text' | 'text_paste'
export type AiJobKind = 'recipe_from_image' | 'recipe_from_text' | 'clip_from_image' | 'auto_from_image' | 'weekly_insights'
export type AiJobStatus = 'pending' | 'processing' | 'done' | 'failed' | 'cancelled'
export type GenreColor = 'green' | 'mustard' | 'brick' | 'plum' | 'wood'

export interface ImageRef { path: string; thumb_path: string; w: number; h: number; bytes: number }
export interface Ingredient { name: string; amount: string }
export interface LinkPreview { title?: string; description?: string; image?: string; site_name?: string; final_url?: string; instagram_blocked?: boolean; fetched_at?: string }
export interface Insight { kind: 'praise' | 'bias' | 'popular' | 'suggestion' | 'reminder'; emoji: string; title: string; body: string }

type Timestamps = { created_at: string; updated_at: string }

export type GenreRow = Timestamps & { id: string; user_id: string; name: string; color: GenreColor; sort_order: number }
export type ClipRow = Timestamps & {
  id: string; user_id: string; type: ClipType; title: string; note: string; url: string | null
  images: ImageRef[]; preview: LinkPreview | null; category: ClipCategory; tags: string[]; shop_name: string | null; favorite: boolean
}
export type RecipeRow = Timestamps & {
  id: string; user_id: string; title: string; genre_id: string | null; hero_image: ImageRef | null
  ingredients: Ingredient[]; steps: string[]; notes: string; source_clip_id: string | null; source_kind: RecipeSourceKind
  source_job_id: string | null; status: RecipeStatus; favorite: boolean
}
export type MenuLogRow = Timestamps & { id: string; user_id: string; log_date: string; note: string }
export type MenuLogItemRow = { id: string; user_id: string; menu_log_id: string; recipe_id: string; sold_count: number | null; created_at: string }
export type AiJobRow = {
  id: string; user_id: string; kind: AiJobKind; status: AiJobStatus; payload: Json; result: Json | null; error: string | null
  attempts: number; started_at: string | null; finished_at: string | null; created_at: string
}
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
      recipes: Table<RecipeRow, 'title'>
      menu_logs: Table<MenuLogRow, 'log_date'>
      menu_log_items: Table<MenuLogItemRow, 'menu_log_id' | 'recipe_id'>
      ai_jobs: Table<AiJobRow, 'kind'>
      ai_insights: Table<AiInsightRow, 'week_start' | 'insights' | 'model'>
    }
    Views: { [_ in never]: never }
    Functions: {
      activity_days: { Args: { since: string }; Returns: string[] }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
