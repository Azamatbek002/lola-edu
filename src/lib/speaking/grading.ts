// Gapirish imtihoni: mezonlar, ball va daraja (sof mantiq, testlar: grading.test.ts)
import type { SpeakingPart } from '../types'

export interface Criterion {
  id: string
  name: string
  max: number
}
export interface LevelBand {
  name: string
  /** Shu darajadan boshlanadigan eng kam ball */
  min: number
}
export interface SpeakingSettings {
  criteria: Criterion[]
  levels: LevelBand[]
  retention_days_after_grading: number
  intros: Partial<Record<SpeakingPart, string>>
  /** Har bo'lim oldidagi yo'riqnoma (soniya) */
  intro_seconds: number
}

export const DEFAULT_SPEAKING: SpeakingSettings = { criteria: [], levels: [], retention_days_after_grading: 5, intros: {}, intro_seconds: 15 }

const num = (v: unknown, d: number, lo: number, hi: number) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d
}

export function parseSpeakingSettings(value: unknown): SpeakingSettings {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const criteria = Array.isArray(v.criteria)
    ? (v.criteria as Record<string, unknown>[])
        .filter((c) => c && String(c.name ?? '').trim())
        .map((c, i) => ({ id: String(c.id || `c${i + 1}`), name: String(c.name).trim(), max: num(c.max, 10, 1, 1000) }))
    : []
  const levels = Array.isArray(v.levels)
    ? (v.levels as Record<string, unknown>[])
        .filter((l) => l && String(l.name ?? '').trim())
        .map((l) => ({ name: String(l.name).trim(), min: num(l.min, 0, 0, 100000) }))
        .sort((a, b) => a.min - b.min)
    : []
  return {
    criteria,
    levels,
    retention_days_after_grading: num(v.retention_days_after_grading, 5, 1, 60),
    intros: (v.intros && typeof v.intros === 'object' ? v.intros : {}) as SpeakingSettings['intros'],
    intro_seconds: num(v.intro_seconds, 15, 0, 120),
  }
}

/** Mezonlar bo'yicha jami (har mezon 0..max oralig'ida) */
export function totalOf(criteria: Criterion[], scores: Record<string, number | string | null | undefined>): number {
  let sum = 0
  for (const c of criteria) {
    const n = Number(scores[c.id])
    if (Number.isFinite(n)) sum += Math.min(c.max, Math.max(0, n))
  }
  return Math.round(sum * 100) / 100
}

export const maxTotal = (criteria: Criterion[]) => criteria.reduce((s, c) => s + c.max, 0)

/** Ball bo'yicha daraja: eng katta "min" ≤ ball */
export function levelFor(total: number | null | undefined, levels: LevelBand[]): string | null {
  if (total == null || !Number.isFinite(total)) return null
  let hit: string | null = null
  for (const l of [...levels].sort((a, b) => a.min - b.min)) if (total >= l.min) hit = l.name
  return hit
}

/** Hamma mezon to'ldirilganmi */
export function scoresComplete(criteria: Criterion[], scores: Record<string, number | string | null | undefined>): boolean {
  return criteria.every((c) => scores[c.id] !== '' && scores[c.id] != null && Number.isFinite(Number(scores[c.id])))
}
