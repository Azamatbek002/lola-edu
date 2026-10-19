import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useT } from '@/lib/i18n'
import { useMe } from '@/lib/auth'
import { canEdit } from '@/lib/permissions'
import { useRows } from '@/lib/data'
import { db, supabase } from '@/lib/db'
import { ResourcePage } from '@/crud/ResourcePage'
import { Avatar, Badge, Card, Empty, PageHead, Progress } from '@/components/ui'
import { addDays, date, money, phone, todayISO } from '@/lib/format'
import { attendanceRate } from '@/lib/analytics'
import { STAFF_ROLES, type Profile, type SalaryType } from '@/lib/types'
import { useGroupStats, useOptions } from '../shared'

const SALARY: SalaryType[] = ['fixed', 'percent', 'per_lesson', 'mixed']

export default function StaffPage() {
  const t = useT()
  const me = useMe()
  const qc = useQueryClient()
  const opts = useOptions()
  const isTeacher = (v: any) => v.role === 'teacher'
  return (
    <ResourcePage
      table="profiles"
      title={t('nav.staff')}
      editable={canEdit(me.role, 'staff')}
      addLabel={t('staff.add')}
      branchScoped
      filter={(p: Profile) => STAFF_ROLES.includes(p.role) && (me.role === 'owner' || p.role !== 'owner')}
      searchText={(p) => `${p.full_name} ${p.phone} ${p.email}`}
      onCreate={async (v) => {
        if (db.mode === 'supabase') {
          const { error } = await supabase!.functions.invoke('admin-users', { body: { action: 'create', ...v } })
          if (error) throw error
        } else {
          const { password, ...rest } = v
          await db.insert('profiles', rest)
        }
        qc.invalidateQueries({ queryKey: ['profiles'] })
      }}
      columns={[
        { key: 'full_name', label: t('common.fullName'), render: (p) => <div className="row"><Avatar name={p.full_name} /><div><div className="bold">{p.full_name}</div><div className="small muted">{p.email}</div></div></div> },
        { key: 'role', label: t('staff.role'), render: (p) => <Badge tone={p.role === 'owner' ? 'brand' : p.role === 'teacher' ? 'blue' : 'gray'}>{t('role.' + p.role)}</Badge> },
        { key: 'phone', label: t('common.phone'), render: (p) => phone(p.phone), hideSm: true },
        { key: 'branch', label: t('common.branch'), hideSm: true, render: (p) => opts.branches.find((b) => b.value === p.branch_id)?.label ?? t('common.all') },
        { key: 'hire_date', label: t('staff.hireDate'), hideSm: true, render: (p) => date(p.hire_date) },
        { key: 'is_active', label: t('common.status'), render: (p) => (p.is_active ? <Badge tone="green">{t('common.active')}</Badge> : <Badge>{t('common.inactive')}</Badge>) },
      ]}
      fields={[
        { name: 'full_name', label: t('common.fullName'), required: true, full: true },
        { name: 'role', label: t('staff.role'), type: 'select', required: true, options: STAFF_ROLES.filter((r) => me.role === 'owner' || r !== 'owner').map((r) => ({ value: r, label: t('role.' + r) })) },
        { name: 'branch_id', label: t('common.branch'), type: 'select', options: opts.branches },
        { name: 'phone', label: t('common.phone'), type: 'phone', required: true },
        { name: 'email', label: t('common.email'), type: 'email', required: true },
        { name: 'password', label: t('staff.password'), type: 'password', hint: t('staff.passwordHint'), show: (v: any) => !v.id },
        { name: 'hire_date', label: t('staff.hireDate'), type: 'date' },
        { name: 'specialization', label: t('staff.specialization'), show: isTeacher },
        { name: 'salary_type', label: t('staff.salaryType'), type: 'select', options: SALARY.map((s) => ({ value: s, label: t('staff.salary.' + s) })) },
        { name: 'salary_fixed', label: t('staff.salaryFixed'), type: 'money', show: (v: any) => !v.salary_type || v.salary_type === 'fixed' || v.salary_type === 'mixed' },
        { name: 'salary_percent', label: t('staff.salaryPercent') + ' (%)', type: 'number', max: 100, show: (v: any) => v.salary_type === 'percent' || v.salary_type === 'mixed' },
        { name: 'salary_per_lesson', label: t('staff.salaryPerLesson'), type: 'money', show: (v: any) => v.salary_type === 'per_lesson' || v.salary_type === 'mixed' },
        { name: 'is_active', label: t('common.status'), type: 'checkbox', placeholder: t('common.active') },
        { name: 'notes', label: t('common.note'), type: 'textarea' },
      ]}
      defaults={() => ({ role: 'teacher', is_active: true, hire_date: todayISO(), salary_type: 'fixed', lang: 'uz', branch_id: me.branch_id ?? null })}
    />
  )
}

export function TeachersPage() {
  const t = useT()
  const nav = useNavigate()
  const teachers = useRows('profiles').filter((p) => p.role === 'teacher' && p.is_active)
  const groups = useRows('groups').filter((g) => g.status === 'active')
  const attendance = useRows('attendance')
  const grades = useRows('grades')
  const gs = useGroupStats()
  const since = addDays(todayISO(), -30)
  return (
    <>
      <PageHead title={t('nav.teachers')} />
      {teachers.length === 0 && <Card><Empty /></Card>}
      <div className="grid grid-3">
        {teachers.map((p) => {
          const mine = groups.filter((g) => g.teacher_id === p.id)
          const ids = new Set(mine.map((g) => g.id))
          const att = attendanceRate(attendance.filter((a) => ids.has(a.group_id) && a.date >= since))
          const gr = grades.filter((g) => ids.has(g.group_id))
          const avg = gr.length ? Math.round(gr.reduce((s, g) => s + (g.score / g.max_score) * 100, 0) / gr.length) : 0
          const students = mine.reduce((n, g) => n + gs.count(g.id), 0)
          return (
            <div key={p.id} className="card card-pad">
              <div className="row">
                <Avatar name={p.full_name} size="lg" />
                <div style={{ minWidth: 0 }}>
                  <h2 className="ellipsis">{p.full_name}</h2>
                  <div className="small muted">{p.specialization}</div>
                  <div className="small muted">{phone(p.phone)}</div>
                </div>
              </div>
              <div className="grid grid-3 mt" style={{ gap: 8, textAlign: 'center' }}>
                <div><div className="bold" style={{ fontSize: '1.2rem' }}>{mine.length}</div><div className="small muted">{t('nav.groups')}</div></div>
                <div><div className="bold" style={{ fontSize: '1.2rem' }}>{students}</div><div className="small muted">{t('group.students')}</div></div>
                <div><div className="bold" style={{ fontSize: '1.2rem' }}>{avg}</div><div className="small muted">{t('dash.avgScore')}</div></div>
              </div>
              <div className="mt small row between"><span className="muted">{t('att.rate')}</span><b>{att}%</b></div>
              <Progress value={att} color={att < 70 ? 'var(--red)' : 'var(--green)'} />
              <div className="mt small muted">
                {t('staff.salaryType')}: {t('staff.salary.' + (p.salary_type || 'fixed'))}
                {p.salary_fixed ? ` · ${money(p.salary_fixed)}` : ''}
                {p.salary_percent ? ` · ${p.salary_percent}%` : ''}
                {p.salary_per_lesson ? ` · ${money(p.salary_per_lesson)}/${t('sal.lessons').toLowerCase()}` : ''}
              </div>
              <div className="row-wrap mt">
                {mine.map((g) => (
                  <span key={g.id} className="badge badge-gray" style={{ cursor: 'pointer' }} onClick={() => nav('/groups/' + g.id)}>{g.name}</span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
