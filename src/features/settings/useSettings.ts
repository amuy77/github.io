import { useSyncExternalStore } from 'react'
import type { OutfitPref } from '@/features/home/shop3d/outfit'

export interface Settings {
  home3d: boolean
  /** LaRa の服: おまかせ（日替わり）/ 三日月 / 黒猫パーカー */
  outfit: OutfitPref
}
const KEY = 'lara.settings'
const DEFAULTS: Settings = { home3d: true, outfit: 'auto' }
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
