import type { Group } from './types'
import { parseISO, todayISO } from './format'

/** ISO hafta kuni: 1 = Dushanba ... 7 = Yakshanba */
export function isoWeekday(iso: string): number {
  const d = parseISO(iso).getDay()
  return d === 0 ? 7 : d
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd)
}

/** Guruh shu kuni dars o'tadimi */
export function hasLessonOn(group: Pick<Group, 'days' | 'start_date' | 'end_date'>, iso: string): boolean {
  if (iso < group.start_date) return false
  if (group.end_date && iso > group.end_date) return false
  return group.days.includes(isoWeekday(iso))
}

/** Oy ichidagi dars kunlari (YYYY-MM) */
export function lessonDatesInMonth(group: Pick<Group, 'days' | 'start_date' | 'end_date'>, month: string): string[] {
  const [y, m] = month.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const out: string[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${month}-${String(d).padStart(2, '0')}`
    if (hasLessonOn(group, iso)) out.push(iso)
  }
  return out
}

/** Barcha kunlar bo'yicha (start_date dan cheklanmagan) oy ichidagi hafta kunlari soni */
export function scheduledDaysInMonth(days: number[], month: string): string[] {
  return lessonDatesInMonth({ days, start_date: '0000-01-01', end_date: null }, month)
}

export interface Conflict {
  type: 'room' | 'teacher'
  a: Group
  b: Group
}

const ACTIVE: Group['status'][] = ['forming', 'active']

/** Xona yoki o'qituvchi bo'yicha jadval to'qnashuvlarini topadi */
export function findConflicts(groups: Group[]): Conflict[] {
  const list = groups.filter((g) => ACTIVE.includes(g.status))
  const out: Conflict[] = []
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]
      const b = list[j]
      if (!a.days.some((d) => b.days.includes(d))) continue
      if (!timesOverlap(a.start_time, a.end_time, b.start_time, b.end_time)) continue
      if (a.end_date && b.start_date > a.end_date) continue
      if (b.end_date && a.start_date > b.end_date) continue
      if (a.room_id && a.room_id === b.room_id) out.push({ type: 'room', a, b })
      if (a.teacher_id && a.teacher_id === b.teacher_id) out.push({ type: 'teacher', a, b })
    }
  }
  return out
}

/** Bitta guruhni boshqalar bilan tekshirish (formada saqlashdan oldin) */
export function conflictsFor(candidate: Group, others: Group[]): Conflict[] {
  return findConflicts([candidate, ...others.filter((g) => g.id !== candidate.id)]).filter(
    (c) => c.a.id === candidate.id || c.b.id === candidate.id,
  )
}

/** Haftaning dushanbasi */
export function weekStart(iso = todayISO()): string {
  const d = parseISO(iso)
  const wd = isoWeekday(iso)
  d.setDate(d.getDate() - (wd - 1))
  return todayISO(d)
}
