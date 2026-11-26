import { describe, expect, it } from 'vitest'
import { levelFor, maxTotal, parseSpeakingSettings, scoresComplete, totalOf } from './grading'

const C = [
  { id: 'a', name: 'Ravonlik', max: 10 },
  { id: 'b', name: 'Grammatika', max: 10 },
  { id: 'c', name: 'Talaffuz', max: 5 },
]

describe('baholash', () => {
  it("jami ball: har mezon 0..max oralig'ida", () => {
    expect(totalOf(C, { a: 8, b: '7.5', c: 9 })).toBe(20.5) // c 5 dan oshmaydi
    expect(totalOf(C, { a: -3, b: '', c: null })).toBe(0)
    expect(maxTotal(C)).toBe(25)
  })
  it("daraja: eng katta chegara ≤ ball", () => {
    const L = [{ name: 'B2', min: 51 }, { name: 'B1', min: 38 }, { name: 'C1', min: 65 }]
    expect(levelFor(37, L)).toBeNull()
    expect(levelFor(38, L)).toBe('B1')
    expect(levelFor(64.5, L)).toBe('B2')
    expect(levelFor(75, L)).toBe('C1')
    expect(levelFor(null, L)).toBeNull()
  })
  it("to'liqlik", () => {
    expect(scoresComplete(C, { a: 1, b: 0, c: 3 })).toBe(true)
    expect(scoresComplete(C, { a: 1, b: '', c: 3 })).toBe(false)
  })
})

describe('sozlamalar', () => {
  it("bo'sh yoki buzilgan qiymat — xavfsiz standartlar", () => {
    const s = parseSpeakingSettings(null)
    expect(s.criteria).toEqual([])
    expect(s.retention_days_after_grading).toBe(2)
    expect(s.intro_seconds).toBe(15)
  })
  it("mezonlar tozalanadi, darajalar tartiblanadi", () => {
    const s = parseSpeakingSettings({
      criteria: [{ id: 'x', name: ' Ravonlik ', max: '12' }, { name: '' }, { name: 'Lug‘at', max: 0 }],
      levels: [{ name: 'B2', min: 51 }, { name: 'B1', min: 38 }],
      retention_days_after_grading: 500,
    })
    expect(s.criteria).toEqual([{ id: 'x', name: 'Ravonlik', max: 12 }, { id: 'c2', name: 'Lug‘at', max: 1 }])
    expect(s.levels.map((l) => l.name)).toEqual(['B1', 'B2'])
    expect(s.retention_days_after_grading).toBe(60)
  })
})
