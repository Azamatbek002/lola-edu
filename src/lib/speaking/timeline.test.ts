import { describe, expect, it } from 'vitest'
import { buildSteps, fmtClock, partStage, remaining, resume, totalMinutes } from './timeline'
import type { SpeakingItem } from '../types'

const item = (id: string, part: SpeakingItem['part'], position: number, prep: number, answer: number, extra: Partial<SpeakingItem> = {}): SpeakingItem => ({
  id,
  variant_id: 'v',
  part,
  position,
  prompt: id,
  bullets: [],
  pros: [],
  cons: [],
  images: [],
  prep_seconds: prep,
  answer_seconds: answer,
  ...extra,
})

// Namunaviy video bo'yicha vaqtlar
const ITEMS = [
  item('q3', '1.1', 3, 5, 30),
  item('q1', '1.1', 1, 5, 30),
  item('q2', '1.1', 2, 5, 30),
  item('q4', '1.2', 4, 10, 45),
  item('q5', '1.2', 5, 5, 30),
  item('q6', '1.2', 6, 5, 30),
  item('q7', '2', 7, 60, 120),
  item('q8', '3', 8, 60, 120),
]
const T = 1_800_000_000_000

describe('qadamlar', () => {
  const steps = buildSteps(ITEMS, 15)
  it("bo'limlar tartibi va har bo'lim oldidan yo'riqnoma", () => {
    expect(steps.filter((s) => s.kind === 'intro').map((s) => s.part)).toEqual(['1.1', '1.2', '2', '3'])
    expect(steps.filter((s) => s.kind === 'answer').map((s) => s.itemId)).toEqual(['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8'])
    expect(steps.filter((s) => s.kind === 'answer').map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })
  it('vaqtlar va jami davomiylik', () => {
    const q4 = steps.filter((s) => s.itemId === 'q4')
    expect(q4.map((s) => [s.kind, s.seconds])).toEqual([['prep', 10], ['answer', 45]])
    expect(totalMinutes(ITEMS, 15)).toBe(11) // 435 s javob + 155 s tayyorlanish + 4 × 15 s yo'riqnoma = 650 s
  })
  it("tayyorlanishsiz savol va savol ovozi/videosi", () => {
    const s = buildSteps([item('a', '1.1', 1, 0, 30, { media_path: 'x.mp3', media_kind: 'audio' })], 0)
    expect(s.map((x) => x.kind)).toEqual(['intro', 'media', 'answer'])
  })
  it('bosqich chizig\'i: 1.1 va 1.2 — 1-bosqich', () => {
    expect([partStage('1.1'), partStage('1.2'), partStage('2'), partStage('3')]).toEqual([1, 1, 2, 3])
  })
})

describe('davom etish (soat to\'xtamaydi)', () => {
  const steps = buildSteps(ITEMS, 15)
  const idx = (kind: string, itemId?: string) => steps.findIndex((s) => s.kind === kind && s.itemId === itemId)

  it("saqlangan holat yo'q — boshidan", () => {
    expect(resume(steps, null, T)).toEqual({ step: 0, startedAt: T })
  })
  it('tayyorlanish paytida yangilandi — qolgan vaqt bilan davom etadi', () => {
    const p = idx('prep', 'q7')
    const r = resume(steps, { step: p, startedAt: T }, T + 20_000)
    expect(r.step).toBe(p)
    expect(remaining(steps[r.step], r.startedAt, T + 20_000)).toBe(40)
  })
  it('tayyorlanish vaqti o\'tib ketgan — javob vaqtining qolgan qismida yozish', () => {
    const p = idx('prep', 'q7')
    const r = resume(steps, { step: p, startedAt: T }, T + 90_000)
    expect(steps[r.step]).toMatchObject({ kind: 'answer', itemId: 'q7' })
    expect(remaining(steps[r.step], r.startedAt, T + 90_000)).toBe(90)
    expect(r.interruptedItemId).toBeUndefined()
  })
  it('javob yozilayotganda yangilandi — yozilgani saqlanadi, darhol keyingi savol (qayta yozish yo\'q)', () => {
    const a = idx('answer', 'q2')
    const r = resume(steps, { step: a, startedAt: T }, T + 12_000)
    expect(r.interruptedItemId).toBe('q2')
    expect(steps[r.step]).toMatchObject({ kind: 'prep', itemId: 'q3' })
    expect(r.startedAt).toBe(T + 12_000)
  })
  it('savol videosi paytida yangilandi — video qayta qo\'yilmaydi', () => {
    const s = buildSteps([item('a', '1.1', 1, 5, 30, { media_path: 'v.mp4', media_kind: 'video' })], 0)
    const r = resume(s, { step: 1, startedAt: T }, T + 3_000)
    expect(s[r.step].kind).toBe('prep')
    expect(r.startedAt).toBe(T + 3_000)
  })
  it("uzoq yo'q bo'lsa — o'tgan savollar javobsiz qoladi, imtihon tugaydi", () => {
    const r = resume(steps, { step: 0, startedAt: T }, T + 3_600_000)
    expect(r.step).toBe(steps.length)
  })
  it("javob vaqtidan 1 soniyadan kam qolgan bo'lsa — o'tkazib yuboriladi", () => {
    const p = idx('prep', 'q1')
    const r = resume(steps, { step: p, startedAt: T }, T + 5_000 + 29_500)
    expect(steps[r.step]).toMatchObject({ kind: 'prep', itemId: 'q2' })
  })
})

describe("telefon uxlab qolsa (sahifa yangilanmagan)", () => {
  const steps = buildSteps(ITEMS, 15)
  it("joriy javob tugagan — keyingi qadamlar soat bo'yicha", () => {
    const a = steps.findIndex((s) => s.kind === 'answer' && s.itemId === 'q1')
    // q1 javobi 30 s; 40 s o'tdi → q2 tayyorlanishi (5 s) ham o'tgan → q2 javobi, 25 s qolgan
    const r = resume(steps, { step: a, startedAt: T }, T + 40_000, false)
    expect(steps[r.step]).toMatchObject({ kind: 'answer', itemId: 'q2' })
    expect(remaining(steps[r.step], r.startedAt, T + 40_000)).toBe(25)
    expect(r.interruptedItemId).toBeUndefined()
  })
})

describe('soat', () => {
  it('format', () => {
    expect(fmtClock(120)).toBe('02:00')
    expect(fmtClock(45)).toBe('00:45')
  })
})
