import { describe, expect, it } from 'vitest'
import { EDGES, NODES, PLAN, SPOTS, lifePart, pathLength, shortestPath } from './shopLayout'

const isEdge = (a: string, b: string) => EDGES.some(([x, y]) => (x === a && y === b) || (x === b && y === a))

describe('shopLayout', () => {
  it('どの行動の場所も通り道の点にある', () => {
    for (const [act, spot] of Object.entries(SPOTS)) expect(NODES[spot.node], `${act} → ${spot.node}`).toBeDefined()
  })
  it('通り道のつながりは、両端とも点として存在する', () => {
    for (const [a, b] of EDGES) { expect(NODES[a], a).toBeDefined(); expect(NODES[b], b).toBeDefined() }
  })
  it('最短経路は、つながった点を順にたどる（どの 2 点の間も行ける）', () => {
    const names = Object.keys(NODES)
    for (const from of names) for (const to of names) {
      const p = shortestPath(from, to)
      expect(p[0]).toBe(from); expect(p[p.length - 1]).toBe(to)
      for (let i = 1; i < p.length; i++) expect(isEdge(p[i - 1], p[i]), `${from}→${to}: ${p[i - 1]}-${p[i]}`).toBe(true)
      expect(pathLength(p)).toBeGreaterThanOrEqual(0)
    }
  })
  it('同じ点なら動かない', () => { expect(shortestPath('counter', 'counter')).toEqual(['counter']) })
  it('時間割の重みは全部正で、行動が存在する', () => {
    for (const part of ['morning', 'day', 'evening', 'late', 'sleep'] as const) for (const [act, w] of PLAN[part]) { expect(SPOTS[act], act).toBeDefined(); expect(w).toBeGreaterThan(0) }
  })
  it('lifePart の境目（寝るのは 23 時〜6 時）', () => {
    expect(lifePart(23)).toBe('sleep'); expect(lifePart(5)).toBe('sleep'); expect(lifePart(6)).toBe('morning'); expect(lifePart(22)).toBe('late')
  })
})
