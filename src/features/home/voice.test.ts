import { describe, expect, it } from 'vitest'
import { CHAT_LINES, chatLine } from './chat/chatVoice'
import { VOICE_LINES } from './shop3d/voiceLines'

// セリフのデータが崩れていないか（smoke から移した。Playwright を起動せずに数秒で回る）
describe('LaRa のセリフ', () => {
  it('chat voice: every reply keeps its facts ({vars}) and the words the app looks for', () => {
    // 数や名前が入る場面は、どのセリフにも必ずその {変数} がある（口調を変えても中身が落ちない）
    const facts: Record<string, string[]> = {
      inboxSome: ['n'], pending: ['n'], todoInbox: ['n'], todoOld: ['title'], recordDone: ['streak'], recordNotYetStreak: ['streak'],
      recommendTop: ['title'], recommendOld: ['title'], idea: ['title', 'shop'], found: ['q'], notFound: ['q'], streakLine: ['streak'],
      consulted: ['time'], answerHead: ['q'],
    }
    const all = { n: 3, title: 'BLT', shop: '（店）', q: 'BLT', streak: 5, time: '9:00' }
    for (const [slot, list] of Object.entries(CHAT_LINES) as [keyof typeof CHAT_LINES, string[]][]) {
      expect(list.length, `${slot}: 2 通り以上`).toBeGreaterThanOrEqual(2)
      for (const line of list) {
        const used = [...line.matchAll(/\{(\w+)\}/g)].map((m) => m[1])
        expect(used.filter((v) => !(facts[slot] ?? []).includes(v)), `${slot}: 「${line}」 uses an unknown {var}`).toEqual([])
        for (const v of facts[slot] ?? []) expect(used, `${slot}: 「${line}」 drops {${v}}`).toContain(v)
      }
      for (let i = 0; i < list.length; i++) expect(chatLine(slot, all, () => i / list.length + 0.01)).not.toMatch(/[{}]/)
    }
    for (const l of CHAT_LINES.found) expect(l).toMatch(/「\{q\}」.*見つけた|見つけた.*「\{q\}」/)
    for (const l of CHAT_LINES.consulted) expect(l).toContain('預かった')
    for (const l of CHAT_LINES.answerHead) expect(l).toContain('「{q}」の相談')
  })

  it('LaRa voice: every scene has lines, and every bubble is short', () => {
    const awake = ['machine', 'mailbox', 'window', 'water', 'waterBanana', 'read', 'rest', 'sweep', 'wipe', 'chalkboard', 'shelf', 'dance', 'nap',
      'daze', 'snack', 'roll', 'ukulele', 'plantTalk', 'chase', 'peek', 'perch', 'wander', 'ballBounce', 'ballBelly', 'ballBalance', 'ballRoll']
    const lives = ['morning', 'day', 'evening', 'late']
    const need = [
      ...awake.map((a) => `activity.${a}`), ...lives.map((l) => `counter.${l}`), ...lives.map((l) => `greet.${l}`), 'greet.longAway', 'greet.soon',
      'musing.any', ...lives.map((l) => `musing.${l}`), 'sleep.talk', 'sleep.wake', 'tap.first', 'tap.again', 'tap.many', 'tap.walking', 'worried',
      'data.inbox', 'data.answers', 'data.recipes', 'data.clips', 'data.streak', 'data.streakZero', 'data.menuDone', 'nap.wake',
      ...Array.from({ length: 12 }, (_, i) => `month.${i + 1}`), ...Array.from({ length: 7 }, (_, i) => `weekday.${i}`),
      'outfit.moon', 'outfit.hoodie', 'outfit.pumpkin', 'outfit.baymax', 'outfit.rose', 'outfit.mermaid', 'outfit.blossom', 'outfit.apple', 'outfit.glass',
      'events.sneeze', 'events.trip', 'events.doze', 'events.foundBook', 'events.gull', 'events.star', 'events.yawn',
    ]
    expect(need.filter((k) => !VOICE_LINES[k]?.length), 'scenes without lines').toEqual([])
    const withN = new Set(['data.inbox', 'data.recipes', 'data.clips', 'data.streak'])
    for (const [key, list] of Object.entries(VOICE_LINES)) for (const seq of list) {
      expect(seq.length, `${key}: 1〜3 bubbles`).toBeGreaterThan(0)
      expect(seq.length, `${key}: 1〜3 bubbles`).toBeLessThanOrEqual(3)
      for (const b of seq) {
        expect([...b.replaceAll('{n}', 'NN')].length, `${key}: 「${b}」 is too long`).toBeLessThanOrEqual(22)
        if (!withN.has(key)) expect(b.includes('{n}'), `${key}: {n} only where a number goes`).toBe(false)
      }
      if (withN.has(key)) expect(seq.some((b) => b.includes('{n}')), `${key}: needs {n}`).toBe(true)
    }
  })
})
