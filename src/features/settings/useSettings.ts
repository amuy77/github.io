import { useSyncExternalStore } from 'react'
import type { OutfitPref } from '@/features/home/shop3d/outfit'
import type { CharacterId, VisitFreq } from '@/characters'

export interface Settings {
  home3d: boolean
  /** LaRa の服: おまかせ（日替わり）か、outfit.ts の一覧のどれかに固定 */
  outfit: OutfitPref
  /** 友達（LuRu など）が遊びに来る頻度。書いていない友達は「ときどき」 */
  friends: Partial<Record<CharacterId, VisitFreq>>
}
const KEY = 'lara.settings'
const DEFAULTS: Settings = { home3d: true, outfit: 'auto', friends: {} }
const listeners = new Set<() => void>()
let cache: Settings | null = null

function read(): Settings {
  if (cache) return cache
  try { cache = { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>) } } catch { cache = { ...DEFAULTS } }
  return cache
}

export function updateSettings(patch: Partial<Settings>) {
  cache = { ...read(), ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(cache)) } catch { /* private mode */ }
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb) } }

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, read, read)
}
