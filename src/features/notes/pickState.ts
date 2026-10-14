import { useSyncExternalStore } from 'react'

// いまえらぶモードかどうか（AppShell が浮いている「聞く」を下の帯と重ねないために見る）
let picking = false
const subs = new Set<() => void>()
export function setPicking(v: boolean) { if (picking === v) return; picking = v; for (const f of subs) f() }
export function useIsPicking() { return useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb) } }, () => picking) }
