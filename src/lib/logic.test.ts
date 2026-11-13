import { describe, expect, it } from 'vitest'
import { applyDiscount, calcTeacherSalary, chargeForMonth, paymeCheckoutUrl, studentBalance } from './finance'
import { findConflicts, isoWeekday, lessonDatesInMonth } from './schedule'
import { absenceStreak, conversionRate, leadFunnel } from './analytics'
import { addMonths, money, normalizePhone } from './format'
import type { Group, Payment, Charge } from './types'

const group = (over: Partial<Group> = {}): Group => ({
  id: 'g1',
  name: 'A1',
  course_id: 'c1',
  teacher_id: 't1',
  branch_id: 'b1',
  room_id: 'r1',
  days: [1, 3, 5],
  start_time: '09:00',
  end_time: '10:30',
  start_date: '2026-01-01',
  end_date: null,
  status: 'active',
  capacity: 12,
  monthly_price: null,
  ...over,
})

describe('schedule', () => {
  it('weekday ISO', () => {
    expect(isoWeekday('2026-10-19')).toBe(1) // dushanba
    expect(isoWeekday('2026-10-25')).toBe(7) // yakshanba
  })
  it('lesson dates in month', () => {
    // 2026-10: Du/Cho/Ju kunlari
    const d = lessonDatesInMonth(group(), '2026-10')
    expect(d).toContain('2026-10-19')
    expect(d).toContain('2026-10-21')
    expect(d).toContain('2026-10-23')
    expect(d.length).toBe(13)
  })
  it('detects room and teacher conflicts', () => {
    const a = group()
    const b = group({ id: 'g2', start_time: '10:00', end_time: '11:00', days: [5] })
    const c = group({ id: 'g3', start_time: '10:30', end_time: '12:00', room_id: 'r1' })
    const conflicts = findConflicts([a, b, c])
    expect(conflicts.filter((x) => x.a.id === 'g1' && x.b.id === 'g2').map((x) => x.type).sort()).toEqual(['room', 'teacher'])
    expect(conflicts.some((x) => x.b.id === 'g3' && x.a.id === 'g1')).toBe(false) // 10:30 da tugaydi — to'qnashuv yo'q
  })
})

describe('finance', () => {
  const courses = [{ id: 'c1', monthly_price: 700000 }]
  it('discount', () => {
    expect(applyDiscount(700000, { discount_percent: 10, discount_amount: 0 })).toBe(630000)
    expect(applyDiscount(700000, { discount_percent: 0, discount_amount: 800000 })).toBe(0)
  })
  it('full month charge', () => {
    const r = chargeForMonth({ start_date: '2026-01-01', status: 'active' }, group(), courses, '2026-10')
    expect(r.amount).toBe(700000)
  })
  it('prorated charge when joining mid-month', () => {
    const r = chargeForMonth({ start_date: '2026-10-19', status: 'active' }, group(), courses, '2026-10')
    expect(r.lessons).toBe(6)
    expect(r.amount).toBe(323000) // 700000 × 6/13
  })
  it('frozen enrollment is not charged', () => {
    expect(chargeForMonth({ start_date: '2026-01-01', status: 'frozen' }, group(), courses, '2026-10').amount).toBe(0)
  })
  it('balance', () => {
    const payments = [
      { student_id: 's1', amount: 500000, status: 'completed' },
      { student_id: 's1', amount: 300000, status: 'cancelled' },
    ] as Payment[]
    const charges = [{ student_id: 's1', amount: 700000 }] as Charge[]
    expect(studentBalance('s1', payments, charges)).toBe(-200000)
  })
  it('teacher salary mixed', () => {
    const payments = [
      { student_id: 's1', group_id: 'g1', amount: 1000000, status: 'completed', paid_at: '2026-10-03', month: '2026-10' },
    ] as Payment[]
    const lessons = [
      { group_id: 'g1', date: '2026-10-05', status: 'done' as const },
      { group_id: 'g1', date: '2026-10-07', status: 'cancelled' as const },
    ]
    const r = calcTeacherSalary(
      { id: 't1', salary_type: 'mixed', salary_fixed: 1000000, salary_percent: 40, salary_per_lesson: 50000 },
      '2026-10',
      [group()],
      payments,
      lessons,
    )
    expect(r.total).toBe(1000000 + 400000 + 50000)
  })
  it('payme url encodes tiyin', () => {
    const url = paymeCheckoutUrl('M1', 's1', 1000)
    expect(atob(url.split('/').pop()!)).toBe('m=M1;ac.student_id=s1;a=100000')
  })
})

describe('analytics & format', () => {
  it('funnel and conversion', () => {
    const leads = [{ stage: 'new' }, { stage: 'won' }, { stage: 'lost' }, { stage: 'trial_attended' }] as any
    expect(leadFunnel(leads)[0].reached).toBe(3)
    expect(conversionRate(leads)).toBe(50)
  })
  it('absence streak', () => {
    expect(
      absenceStreak([
        { date: '2026-10-01', status: 'present' },
        { date: '2026-10-03', status: 'absent' },
        { date: '2026-10-05', status: 'absent' },
      ]),
    ).toBe(2)
  })
  it('format helpers', () => {
    expect(money(1250000)).toBe("1 250 000 so'm")
    expect(normalizePhone('90 123 45 67')).toBe('+998901234567')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
  })
})
