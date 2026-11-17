import type { Charge, Course, Enrollment, Expense, Group, Lesson, Payment, Profile, SalaryPayout } from './types'
import { lessonDatesInMonth, scheduledDaysInMonth } from './schedule'

export function groupPrice(group: Pick<Group, 'monthly_price' | 'course_id'>, courses: Pick<Course, 'id' | 'monthly_price'>[]): number {
  if (group.monthly_price != null && group.monthly_price > 0) return group.monthly_price
  return courses.find((c) => c.id === group.course_id)?.monthly_price ?? 0
}

/** O'quvchining to'liq oy uchun narxi: shaxsiy narx → guruh → kurs, so'ng chegirma */
export function monthlyPriceFor(
  e: Pick<Enrollment, 'monthly_price' | 'discount_percent' | 'discount_amount'>,
  group: Pick<Group, 'monthly_price' | 'course_id'>,
  courses: Pick<Course, 'id' | 'monthly_price'>[],
): number {
  return roundTo(applyDiscount(e.monthly_price != null ? e.monthly_price : groupPrice(group, courses), e), 1000)
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
  enrollment: Pick<Enrollment, 'start_date' | 'end_date' | 'status' | 'discount_percent' | 'discount_amount' | 'monthly_price'>,
  group: Pick<Group, 'days' | 'start_date' | 'end_date' | 'monthly_price' | 'course_id'>,
  courses: Pick<Course, 'id' | 'monthly_price'>[],
  month: string,
): { amount: number; discount: number; lessons: number; total: number } {
  const full = enrollment.monthly_price != null ? enrollment.monthly_price : groupPrice(group, courses)
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

// ─── To'lov kunlari va muddatlar ────────────────────────────────────────────

function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** Ikki sana orasidagi kunlar: b − a */
export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number)
  const [y2, m2, d2] = b.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000)
}

/** Har oygi to'lov kuni: o'quvchining shaxsiy kuni → guruh kuni → markaz sozlamasi */
export function paymentDayFor(
  e: Pick<Enrollment, 'payment_day'> | null | undefined,
  g: Pick<Group, 'payment_day'> | null | undefined,
  centerDay?: number | null,
): number {
  const d = e?.payment_day || g?.payment_day || centerDay || 10
  return Math.min(31, Math.max(1, Math.round(d)))
}

/**
 * Oy uchun to'lov sanasi. Oyda bunday kun bo'lmasa (masalan 31) — oyning oxirgi kuni.
 * O'quvchi muddatdan keyin qo'shilgan bo'lsa — qo'shilgan kuni (SQL: due_date_for bilan bir xil).
 */
export function dueDateFor(month: string, day: number, startDate?: string | null): string {
  const iso = `${month}-${String(Math.min(day, daysInMonth(month))).padStart(2, '0')}`
  return startDate && startDate > iso ? startDate : iso
}

export type ChargeState = 'paid' | 'upcoming' | 'today' | 'overdue'

export interface ChargeInfo {
  charge: Charge
  paid: number
  left: number
  state: ChargeState
  /** Muddatgacha qolgan kunlar (musbat) yoki o'tib ketgan kunlar (manfiy) */
  days: number
}

const chargeOrder = (a: Charge, b: Charge) => a.due_date.localeCompare(b.due_date) || a.month.localeCompare(b.month) || a.id.localeCompare(b.id)

/**
 * To'lovlarni hisoblarga taqsimlaydi (eng eski muddatdan boshlab):
 *  1) guruh ko'rsatilgan to'lov — avval o'sha guruh hisoblariga;
 *  2) guruhsiz to'lovlar va ortib qolgan summa — qolgan hisoblarga muddat tartibida.
 * Hisob to'liq yopilmagan bo'lsa va muddati o'tgan bo'lsa — "overdue".
 * SQL'dagi public.charge_status ko'rinishi aynan shunday hisoblaydi.
 */
export function allocateCharges(charges: Charge[], payments: Payment[], today: string): Map<string, ChargeInfo> {
  const byStudent = new Map<string, Charge[]>()
  const hasGroup = new Set<string>()
  for (const c of charges) {
    const list = byStudent.get(c.student_id)
    if (list) list.push(c)
    else byStudent.set(c.student_id, [c])
    hasGroup.add(c.student_id + '|' + c.group_id)
  }
  const toGroup = new Map<string, number>()
  const pool = new Map<string, number>()
  for (const p of payments) {
    if (p.status !== 'completed') continue
    const key = p.student_id + '|' + (p.group_id || '')
    if (p.group_id && hasGroup.has(key)) toGroup.set(key, (toGroup.get(key) || 0) + p.amount)
    else pool.set(p.student_id, (pool.get(p.student_id) || 0) + p.amount)
  }

  const out = new Map<string, ChargeInfo>()
  for (const [sid, list] of byStudent) {
    list.sort(chargeOrder)
    const paid = new Map<string, number>()
    let free = pool.get(sid) || 0
    // 1) guruhga atalgan to'lovlar
    const avail = new Map<string, number>()
    for (const c of list) {
      const key = sid + '|' + c.group_id
      if (!avail.has(key)) avail.set(key, toGroup.get(key) || 0)
      const a = avail.get(key)!
      const x = Math.min(c.amount, a)
      paid.set(c.id, x)
      avail.set(key, a - x)
    }
    for (const a of avail.values()) free += a
    // 2) umumiy qoldiq
    for (const c of list) {
      const p1 = paid.get(c.id) || 0
      const x = Math.min(c.amount - p1, free)
      free -= x
      const total = p1 + x
      const left = c.amount - total
      const days = daysBetween(today, c.due_date)
      const state: ChargeState = left <= 0 ? 'paid' : days > 0 ? 'upcoming' : days === 0 ? 'today' : 'overdue'
      out.set(c.id, { charge: c, paid: total, left: Math.max(0, left), state, days })
    }
  }
  return out
}

export interface StudentDue {
  /** Muddati o'tgan qarz */
  overdue: number
  /** Eng eski to'lanmagan muddat (muddati o'tganlar orasida) */
  overdueSince: string | null
  /** Keyingi to'lov (bugun yoki kelajakda) */
  next: ChargeInfo | null
}

export function dueByStudent(infos: Iterable<ChargeInfo>): Map<string, StudentDue> {
  const m = new Map<string, StudentDue>()
  for (const i of infos) {
    const sid = i.charge.student_id
    let d = m.get(sid)
    if (!d) m.set(sid, (d = { overdue: 0, overdueSince: null, next: null }))
    if (i.state === 'overdue') {
      d.overdue += i.left
      if (!d.overdueSince || i.charge.due_date < d.overdueSince) d.overdueSince = i.charge.due_date
    } else if (i.state !== 'paid' && (!d.next || i.charge.due_date < d.next.charge.due_date)) {
      d.next = i
    }
  }
  return m
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

/** Payme checkout havolasi. account — o'quvchining 6 xonali to'lov raqami. Summa tiyinlarda yuboriladi. */
export function paymeCheckoutUrl(merchantId: string, account: string, amount: number, returnUrl?: string): string {
  const params = [`m=${merchantId}`, `ac.student_id=${account}`, `a=${Math.round(amount * 100)}`]
  if (returnUrl) params.push(`c=${returnUrl}`)
  const b64 = btoa(params.join(';'))
  return `https://checkout.paycom.uz/${b64}`
}

export function clickCheckoutUrl(
  serviceId: string,
  merchantId: string,
  account: string,
  amount: number,
  returnUrl?: string,
): string {
  const q = new URLSearchParams({
    service_id: serviceId,
    merchant_id: merchantId,
    amount: String(Math.round(amount)),
    transaction_param: account,
  })
  if (returnUrl) q.set('return_url', returnUrl)
  return `https://my.click.uz/services/pay?${q.toString()}`
}
