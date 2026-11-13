import { useMemo } from 'react'
import { Badge, type Opt, type Tone } from '@/components/ui'
import { useById, useRows } from '@/lib/data'
import { useT, type T } from '@/lib/i18n'
import { balancesByStudent, groupPrice } from '@/lib/finance'
import { useBranchFilter } from '@/lib/auth'
import type { AttendanceStatus, Group, LeadStage, PayMethod, StudentStatus } from '@/lib/types'
import { PAY_METHODS } from '@/lib/types'

export const STUDENT_TONE: Record<StudentStatus, Tone> = { trial: 'blue', active: 'green', frozen: 'yellow', left: 'gray', graduated: 'purple' }
export const GROUP_TONE: Record<Group['status'], Tone> = { forming: 'blue', active: 'green', finished: 'purple', archived: 'gray' }
export const ATT_TONE: Record<AttendanceStatus, Tone> = { present: 'green', absent: 'red', late: 'yellow', excused: 'blue' }
export const STAGE_COLOR: Record<LeadStage, string> = {
  new: '#3b82f6',
  contacted: '#06b6d4',
  interested: '#f59e0b',
  trial_scheduled: '#8b5cf6',
  trial_attended: '#a855f7',
  won: '#16a34a',
  lost: '#9ca3af',
}

export function StudentStatusBadge({ s }: { s: StudentStatus }) {
  const t = useT()
  return <Badge tone={STUDENT_TONE[s]}>{t('student.status.' + s)}</Badge>
}

export function GroupStatusBadge({ s }: { s: Group['status'] }) {
  const t = useT()
  return <Badge tone={GROUP_TONE[s]}>{t('group.status.' + s)}</Badge>
}

export function payMethodOptions(t: T): Opt[] {
  return PAY_METHODS.map((m) => ({ value: m, label: t('pay.method.' + m) }))
}

export function methodLabel(t: T, m: PayMethod) {
  return t('pay.method.' + m)
}

export function formatDays(t: T, days: number[]) {
  return days.map((d) => t('day.' + d)).join(', ')
}

export function groupSchedule(t: T, g: Group) {
  return `${formatDays(t, g.days)} · ${g.start_time}–${g.end_time}`
}

/** Tez-tez ishlatiladigan lug'atlar */
export function useLookups() {
  const students = useById('students')
  const groups = useById('groups')
  const courses = useById('courses')
  const profiles = useById('profiles')
  const branches = useById('branches')
  const rooms = useById('rooms')
  return { students, groups, courses, profiles, branches, rooms }
}

export function useOptions() {
  const byBranch = useBranchFilter()
  const students = useRows('students')
  const groups = useRows('groups')
  const courses = useRows('courses')
  const profiles = useRows('profiles')
  const branches = useRows('branches')
  const rooms = useRows('rooms')
  return useMemo(
    () => ({
      students: byBranch(students)
        .filter((s) => s.status !== 'left')
        .map((s) => ({ value: s.id, label: s.full_name + (s.phone ? ' · ' + s.phone : '') }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      allStudents: students.map((s) => ({ value: s.id, label: s.full_name })),
      groups: byBranch(groups)
        .filter((g) => g.status === 'active' || g.status === 'forming')
        .map((g) => ({ value: g.id, label: g.name })),
      allGroups: groups.map((g) => ({ value: g.id, label: g.name })),
      courses: courses.filter((c) => c.is_active).map((c) => ({ value: c.id, label: c.name })),
      teachers: profiles.filter((p) => p.role === 'teacher' && p.is_active).map((p) => ({ value: p.id, label: p.full_name })),
      staff: profiles.filter((p) => !['student', 'parent'].includes(p.role) && p.is_active).map((p) => ({ value: p.id, label: p.full_name })),
      branches: branches.map((b) => ({ value: b.id, label: b.name })),
      rooms: rooms.map((r) => ({ value: r.id, label: r.name })),
      roomsFor: (branchId?: string | null) => rooms.filter((r) => !branchId || r.branch_id === branchId).map((r) => ({ value: r.id, label: r.name })),
    }),
    [students, groups, courses, profiles, branches, rooms, byBranch],
  )
}

/** Balanslar xaritasi (talaba → balans) */
export function useBalances() {
  const payments = useRows('payments')
  const charges = useRows('charges')
  return useMemo(() => balancesByStudent(payments, charges), [payments, charges])
}

/** Guruhdagi faol o'quvchilar soni va narxi */
export function useGroupStats() {
  const enrollments = useRows('enrollments')
  const courses = useRows('courses')
  return useMemo(() => {
    const count = new Map<string, number>()
    for (const e of enrollments) if (e.status === 'active') count.set(e.group_id, (count.get(e.group_id) || 0) + 1)
    return {
      count: (gid: string) => count.get(gid) || 0,
      price: (g: Group) => groupPrice(g, courses),
    }
  }, [enrollments, courses])
}
