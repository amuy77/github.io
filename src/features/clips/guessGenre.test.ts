import { describe, expect, it } from 'vitest'
import { guessGenreId } from './guessGenre'

const genres = [
  { id: 'g-coffee', name: 'コーヒー' },
  { id: 'g-am', name: 'アメリカンサンド' },
  { id: 'g-cr', name: 'クロワッサンサンド' },
  { id: 'g-wine', name: 'ワイン' },
]

describe('guessGenreId', () => {
  it('picks the genre with the matching name', () => {
    expect(guessGenreId('自家焙煎のエスプレッソ', genres)).toBe('g-coffee')
    expect(guessGenreId('Natural Wine bar', genres)).toBe('g-wine')
  })
  it('falls back to the next candidate name', () => {
    expect(guessGenreId('クロワッサンのサンド', genres)).toBe('g-cr')
    expect(guessGenreId('ホットドッグ', genres)).toBe('g-am')
  })
  it('returns null when no genre has that name', () => {
    expect(guessGenreId('クラフトビール', genres)).toBeNull()
    expect(guessGenreId('', genres)).toBeNull()
  })
})
