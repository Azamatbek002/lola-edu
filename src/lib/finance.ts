import type { Charge, Course, Enrollment, Expense, Group, Lesson, Payment, Profile, SalaryPayout } from './types'
import { lessonDatesInMonth, scheduledDaysInMonth } from './schedule'

export function groupPrice(group: Pick<Group, 'monthly_price' | 'course_id'>, courses: Pick<Course, 'id' | 'monthly_price'>[]): number {
  if (group.monthly_price != null && group.monthly_price > 0) return group.monthly_price
  return courses.find((c) => c.id === group.course_id)?.monthly_price ?? 0
}

/** Chegirmadan keyingi oylik summa */
export function applyDiscount(price: number, e: Pick<Enrollment, 'discount_percent' | 'discount_amount'>): number {
  const p = Math.min(100, Math.max(0, e.discount_percent || 0))
  return Math.max(0, Math.round(price * (1 - p / 100) - (e.discount_amount || 0)))
}

/**
 * Oy uchun hisoblanadigan to'lov. O'quvchi oy o'rtasida qo'shilsa yoki ketsa,
 * faqat qatnashadigan darslar ulushi hisoblanadi (proporsional).
 */
export function chargeForMonth(
  enrollment: Pick<Enrollment, 'start_date' | 'end_date' | 'status' | 'discount_percent' | 'discount_amount'>,
  group: Pick<Group, 'days' | 'start_date' | 'end_date' | 'monthly_price' | 'course_id'>,
  courses: Pick<Course, 'id' | 'monthly_price'>[],
  month: string,
): { amount: number; discount: number; lessons: number; total: number } {
  const full = groupPrice(group, courses)
  const all = scheduledDaysInMonth(group.days, month)
  const groupDates = lessonDatesInMonth(group, month)
  const mine = groupDates.filter(
    (d) => d >= enrollment.start_date && (!enrollment.end_date || d <= enrollment.end_date),
  )
  if (enrollment.status === 'frozen' || all.length === 0 || mine.length === 0) {
    return { amount: 0, discount: 0, lessons: 0, total: all.length }
  }
  const base = Math.round((full * mine.length) / all.length)
  const net = applyDiscount(base, enrollment)
  return { amount: roundTo(net, 1000), discount: base - net, lessons: mine.length, total: all.length }
}

export function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step
}

export function sumPayments(payments: Pick<Payment, 'amount' | 'status'>[]): number {
  return payments.reduce((s, p) => s + (p.status === 'completed' ? p.amount : 0), 0)
}

export function sumCharges(charges: Pick<Charge, 'amount'>[]): number {
  return charges.reduce((s, c) => s + c.amount, 0)
}

/** Balans: musbat — oldindan to'lagan, manfiy — qarzdor */
export function studentBalance(studentId: string, payments: Payment[], charges: Charge[]): number {
  return (
    sumPayments(payments.filter((p) => p.student_id === studentId)) -
    sumCharges(charges.filter((c) => c.student_id === studentId))
  )
}

export function balancesByStudent(payments: Payment[], charges: Charge[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const p of payments) if (p.status === 'completed') m.set(p.student_id, (m.get(p.student_id) || 0) + p.amount)
  for (const c of charges) m.set(c.student_id, (m.get(c.student_id) || 0) - c.amount)
  return m
}

export interface SalaryCalc {
  fixed: number
  percentPart: number
  lessonPart: number
  collected: number
  lessons: number
  total: number
}

/**
 * O'qituvchi maoshini hisoblash:
 *  - fixed: belgilangan oylik
 *  - percent: o'z guruhlaridan shu oyda tushgan to'lovlarning foizi
 *  - per_lesson: o'tilgan darslar soni × stavka
 *  - mixed: hammasi birga
 */
export function calcTeacherSalary(
  teacher: Pick<Profile, 'id' | 'salary_type' | 'salary_fixed' | 'salary_percent' | 'salary_per_lesson'>,
  month: string,
  groups: Pick<Group, 'id' | 'teacher_id'>[],
  payments: Payment[],
  lessons: Pick<Lesson, 'group_id' | 'date' | 'status' | 'teacher_id'>[],
): SalaryCalc {
  const myGroups = new Set(groups.filter((g) => g.teacher_id === teacher.id).map((g) => g.id))
  const collected = sumPayments(
    payments.filter((p) => p.group_id && myGroups.has(p.group_id) && (p.month || p.paid_at.slice(0, 7)) === month),
  )
  const lessonCount = lessons.filter(
    (l) =>
      l.status === 'done' &&
      l.date.startsWith(month) &&
      (l.teacher_id ? l.teacher_id === teacher.id : myGroups.has(l.group_id)),
  ).length
  const t = teacher.salary_type || 'fixed'
  const fixed = t === 'fixed' || t === 'mixed' ? teacher.salary_fixed || 0 : 0
  const percentPart = t === 'percent' || t === 'mixed' ? Math.round((collected * (teacher.salary_percent || 0)) / 100) : 0
  const lessonPart = t === 'per_lesson' || t === 'mixed' ? lessonCount * (teacher.salary_per_lesson || 0) : 0
  return { fixed, percentPart, lessonPart, collected, lessons: lessonCount, total: fixed + percentPart + lessonPart }
}

export interface MonthPnL {
  month: string
  revenue: number
  expenses: number
  salaries: number
  profit: number
}

export function monthlyPnL(
  months: string[],
  payments: Payment[],
  expenses: Expense[],
  payouts: SalaryPayout[],
): MonthPnL[] {
  return months.map((month) => {
    const revenue = sumPayments(payments.filter((p) => p.paid_at.startsWith(month)))
    const exp = expenses.filter((e) => e.date.startsWith(month)).reduce((s, e) => s + e.amount, 0)
    const sal = payouts.filter((s) => s.month === month && s.status === 'paid').reduce((s, p) => s + p.total, 0)
    return { month, revenue, expenses: exp, salaries: sal, profit: revenue - exp - sal }
  })
}

export function sumBy<T>(items: T[], key: (t: T) => string, val: (t: T) => number): { key: string; value: number }[] {
  const m = new Map<string, number>()
  for (const i of items) m.set(key(i), (m.get(key(i)) || 0) + val(i))
  return [...m.entries()].map(([k, value]) => ({ key: k, value })).sort((a, b) => b.value - a.value)
}

// ─── Onlayn to'lov havolalari ────────────────────────────────────────────────

/** Payme checkout havolasi. Summa tiyinlarda yuboriladi. */
export function paymeCheckoutUrl(merchantId: string, studentId: string, amount: number, returnUrl?: string): string {
  const params = [`m=${merchantId}`, `ac.student_id=${studentId}`, `a=${Math.round(amount * 100)}`]
  if (returnUrl) params.push(`c=${returnUrl}`)
  const b64 = btoa(params.join(';'))
  return `https://checkout.paycom.uz/${b64}`
}

export function clickCheckoutUrl(
  serviceId: string,
  merchantId: string,
  studentId: string,
  amount: number,
  returnUrl?: string,
): string {
  const q = new URLSearchParams({
    service_id: serviceId,
    merchant_id: merchantId,
    amount: String(amount),
    transaction_param: studentId,
  })
  if (returnUrl) q.set('return_url', returnUrl)
  return `https://my.click.uz/services/pay?${q.toString()}`
}
