// Gapirish imtihoni — vaqt jadvali (sof mantiq, testlar: src/lib/speaking/timeline.test.ts).
//
// Imtihon qadamlari: har bo'lim oldidan yo'riqnoma (intro), har savolda: savol ovozi/videosi (bo'lsa, bir marta),
// tayyorlanish sanog'i va javob (avtomatik ovoz yozish). Soat to'xtamaydi: sahifa yangilansa yoki internet uzilsa,
// imtihon vaqt bo'yicha qayerda bo'lishi kerak bo'lsa, o'sha joydan davom etadi. Qayta yozish va qayta ko'rish yo'q.
import type { SpeakingItem, SpeakingPart } from '../types'

export type StepKind = 'intro' | 'media' | 'prep' | 'answer'
export interface Step {
  kind: StepKind
  part: SpeakingPart
  /** Savol (intro uchun — yo'q) */
  itemId?: string
  /** Variant ichidagi savol tartibi (1 dan) */
  number?: number
  /** Davomiylik, soniya (media uchun 0 — fayl tugaguncha) */
  seconds: number
}

export const PART_ORDER: SpeakingPart[] = ['1.1', '1.2', '2', '3']
/** Yuqori qismdagi 3 bosqichli chiziq: 1-bo'lim (1.1 + 1.2), 2-bo'lim, 3-bo'lim */
export const partStage = (p: SpeakingPart): 1 | 2 | 3 => (p === '2' ? 2 : p === '3' ? 3 : 1)

export function sortItems(items: SpeakingItem[]): SpeakingItem[] {
  return [...items].sort((a, b) => PART_ORDER.indexOf(a.part) - PART_ORDER.indexOf(b.part) || a.position - b.position)
}

export function buildSteps(items: SpeakingItem[], introSeconds: number): Step[] {
  const steps: Step[] = []
  let lastPart: SpeakingPart | null = null
  sortItems(items).forEach((it, i) => {
    if (it.part !== lastPart) {
      steps.push({ kind: 'intro', part: it.part, seconds: Math.max(0, introSeconds) })
      lastPart = it.part
    }
    const base = { part: it.part, itemId: it.id, number: i + 1 }
    if (it.media_path) steps.push({ ...base, kind: 'media', seconds: 0 })
    if (it.prep_seconds > 0) steps.push({ ...base, kind: 'prep', seconds: it.prep_seconds })
    steps.push({ ...base, kind: 'answer', seconds: it.answer_seconds })
  })
  return steps
}

export interface Saved {
  step: number
  startedAt: number
}
export interface Resume {
  /** Davom etiladigan qadam (steps.length — imtihon tugagan) */
  step: number
  /** Shu qadam boshlangan vaqt (qolgan vaqt = seconds − (now − startedAt)) */
  startedAt: number
  /** Yozish uzilib qolgan savol: yozilgan qismi javob sifatida saqlanadi, qayta yozilmaydi */
  interruptedItemId?: string
}

/**
 * Yangilangandan keyin qayerdan davom etish.
 *  • yo'riqnoma va tayyorlanish — soat davom etadi (qolgan vaqt bilan);
 *  • savol ovozi/videosi — qayta qo'yilmaydi, keyingi qadamga o'tiladi;
 *  • javob yozilayotganda uzilgan bo'lsa — yozilgani saqlanadi va darhol keyingi savolga o'tiladi;
 *  • javob vaqti o'quvchi yo'qligida boshlangan bo'lsa — qolgan vaqtda javob berishi mumkin.
 * `interrupted = false` — sahifa yangilanmagan, faqat telefon uxlab qolgan: joriy javob oddiy qadamdek hisoblanadi.
 */
export function resume(steps: Step[], saved: Saved | null | undefined, now: number, interrupted = true): Resume {
  if (!saved || saved.step == null || !saved.startedAt) return { step: 0, startedAt: now }
  let i = Math.max(0, saved.step)
  let t0 = saved.startedAt
  let interruptedItemId: string | undefined
  while (i < steps.length) {
    const s = steps[i]
    if (interrupted && s.kind === 'answer' && i === saved.step) {
      // Yozish jarayonida uzildi
      interruptedItemId = s.itemId
      i += 1
      t0 = now
      continue
    }
    if (s.kind === 'media') {
      // Savol bir marta ko'rsatiladi: yangilangandan keyin qayta qo'yilmaydi
      i += 1
      t0 = i - 1 === saved.step ? now : t0
      continue
    }
    const end = t0 + s.seconds * 1000
    if (now < end) {
      // Javob vaqtiga yo'qligida kirib qolgan bo'lsa, 1 soniyadan kam qolgan bo'lsa — o'tkazib yuboriladi
      if (s.kind === 'answer' && end - now < 1000) {
        i += 1
        t0 = end
        continue
      }
      return { step: i, startedAt: t0, interruptedItemId }
    }
    i += 1
    t0 = end
  }
  return { step: steps.length, startedAt: now, interruptedItemId }
}

/** Qadam uchun qolgan soniyalar (butun, pastga yaxlitlangan emas — 0.2 s ham "1" ko'rinadi) */
export function remaining(step: Step, startedAt: number, now: number): number {
  return Math.max(0, Math.ceil((startedAt + step.seconds * 1000 - now) / 1000))
}

export function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Imtihonning taxminiy davomiyligi (daqiqa, yuqoriga yaxlitlangan) */
export function totalMinutes(items: SpeakingItem[], introSeconds: number): number {
  const parts = new Set(items.map((i) => i.part)).size
  const sec = items.reduce((s, i) => s + i.prep_seconds + i.answer_seconds, 0) + parts * introSeconds
  return Math.ceil(sec / 60)
}
