import type { Attendance, Campaign, Lead, LeadStage, Student } from './types'
import { LEAD_STAGES } from './types'
import { pct } from './format'

/** Voronka: har bir bosqichga yetib kelgan lidlar soni (keyingi bosqichdagilar ham hisoblanadi) */
export function leadFunnel(leads: Pick<Lead, 'stage'>[]): { stage: LeadStage; count: number; reached: number }[] {
  const order = LEAD_STAGES.filter((s) => s !== 'lost')
  return order.map((stage, i) => {
    const count = leads.filter((l) => l.stage === stage).length
    const reached = leads.filter((l) => l.stage !== 'lost' && order.indexOf(l.stage) >= i).length
    return { stage, count, reached }
  })
}

export function conversionRate(leads: Pick<Lead, 'stage'>[]): number {
  const closed = leads.filter((l) => l.stage === 'won' || l.stage === 'lost').length
  const won = leads.filter((l) => l.stage === 'won').length
  return pct(won, closed || leads.length)
}

export interface SourceStat {
  source: string
  leads: number
  won: number
  conversion: number
}

export function leadsBySource(leads: Pick<Lead, 'source' | 'stage'>[]): SourceStat[] {
  const m = new Map<string, { leads: number; won: number }>()
  for (const l of leads) {
    const s = m.get(l.source) || { leads: 0, won: 0 }
    s.leads++
    if (l.stage === 'won') s.won++
    m.set(l.source, s)
  }
  return [...m.entries()]
    .map(([source, v]) => ({ source, ...v, conversion: pct(v.won, v.leads) }))
    .sort((a, b) => b.leads - a.leads)
}

export interface CampaignStat {
  campaign: Campaign
  leads: number
  won: number
  cpl: number // bitta lid narxi
  cac: number // bitta o'quvchi narxi
}

export function campaignStats(campaigns: Campaign[], leads: Pick<Lead, 'campaign_id' | 'stage'>[]): CampaignStat[] {
  return campaigns.map((c) => {
    const mine = leads.filter((l) => l.campaign_id === c.id)
    const won = mine.filter((l) => l.stage === 'won').length
    return {
      campaign: c,
      leads: mine.length,
      won,
      cpl: mine.length ? Math.round(c.spent / mine.length) : 0,
      cac: won ? Math.round(c.spent / won) : 0,
    }
  })
}

export function attendanceRate(rows: Pick<Attendance, 'status'>[]): number {
  if (!rows.length) return 0
  const ok = rows.filter((r) => r.status === 'present' || r.status === 'late').length
  return pct(ok, rows.length)
}

/** Ketma-ket qoldirilgan darslar soni (oxirgi darslardan boshlab) */
export function absenceStreak(rows: Pick<Attendance, 'status' | 'date'>[]): number {
  const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date))
  let n = 0
  for (const r of sorted) {
    if (r.status === 'absent') n++
    else break
  }
  return n
}

/** Ketish xavfi ostidagi o'quvchilar: ketma-ket 3+ dars qoldirgan yoki davomati 60% dan past */
export function atRiskStudents(students: Student[], attendance: Attendance[]): { student: Student; streak: number; rate: number }[] {
  const out: { student: Student; streak: number; rate: number }[] = []
  for (const s of students) {
    if (s.status !== 'active') continue
    const rows = attendance.filter((a) => a.student_id === s.id)
    if (rows.length < 3) continue
    const streak = absenceStreak(rows)
    const rate = attendanceRate(rows.slice(-12))
    if (streak >= 3 || rate < 60) out.push({ student: s, streak, rate })
  }
  return out.sort((a, b) => b.streak - a.streak || a.rate - b.rate)
}
