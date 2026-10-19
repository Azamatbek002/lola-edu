import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useT } from '@/lib/i18n'
import { useMe } from '@/lib/auth'
import { canEdit } from '@/lib/permissions'
import { useRows } from '@/lib/data'
import { ResourcePage } from '@/crud/ResourcePage'
import { Avatar, Select } from '@/components/ui'
import { age, money, phone, todayISO } from '@/lib/format'
import { LEVELS, type Student, type StudentStatus } from '@/lib/types'
import { StudentStatusBadge, useBalances, useLookups, useOptions } from '../shared'
import type { FieldDef } from '@/crud/EntityForm'
import type { T } from '@/lib/i18n'

const STATUSES: StudentStatus[] = ['trial', 'active', 'frozen', 'left', 'graduated']
export const SOURCES = ['Instagram', 'Telegram', 'Facebook', 'Google', 'TikTok', 'YouTube', 'Tavsiya', 'Banner', "Yo'ldan", 'Boshqa']

export function studentFields(t: T, opts: ReturnType<typeof useOptions>): FieldDef[] {
  return [
    { name: 'full_name', label: t('common.fullName'), required: true, full: true },
    { name: 'phone', label: t('common.phone'), type: 'phone', required: true },
    { name: 'birth_date', label: t('student.birthDate'), type: 'date' },
    { name: 'gender', label: t('student.gender'), type: 'select', options: [{ value: 'male', label: t('student.male') }, { value: 'female', label: t('student.female') }] },
    { name: 'branch_id', label: t('common.branch'), type: 'select', options: opts.branches, required: true },
    { name: 'status', label: t('common.status'), type: 'select', required: true, options: STATUSES.map((s) => ({ value: s, label: t('student.status.' + s) })) },
    { name: 'level', label: t('common.level'), type: 'select', options: LEVELS.map((l) => ({ value: l, label: l })) },
    { name: 'parent_name', label: t('student.parentName') },
    { name: 'parent_phone', label: t('student.parentPhone'), type: 'phone' },
    { name: 'source', label: t('common.source'), type: 'select', options: SOURCES.map((s) => ({ value: s, label: s })) },
    { name: 'referred_by', label: t('student.referredBy'), type: 'select', options: opts.allStudents },
    { name: 'address', label: t('student.address'), full: true },
    { name: 'notes', label: t('common.note'), type: 'textarea' },
  ]
}

export default function StudentsPage() {
  const t = useT()
  const me = useMe()
  const nav = useNavigate()
  const opts = useOptions()
  const L = useLookups()
  const balances = useBalances()
  const enrollments = useRows('enrollments')
  const [status, setStatus] = useState<string>('active')
  const [group, setGroup] = useState('')

  const groupsOf = (sid: string) =>
    enrollments
      .filter((e) => e.student_id === sid && e.status !== 'left' && e.status !== 'finished')
      .map((e) => L.groups.get(e.group_id)?.name)
      .filter(Boolean)
      .join(', ')

  return (
    <ResourcePage
      table="students"
      title={t('nav.students')}
      branchScoped
      editable={canEdit(me.role, 'students')}
      addLabel={t('student.add')}
      onRowClick={(r) => nav('/students/' + r.id)}
      searchText={(s) => `${s.full_name} ${s.phone} ${s.parent_phone ?? ''} ${s.parent_name ?? ''}`}
      filter={(s: Student) =>
        (!status || (status === 'debtors' ? (balances.get(s.id) || 0) < 0 && s.status !== 'left' : s.status === status)) &&
        (!group || enrollments.some((e) => e.student_id === s.id && e.group_id === group && e.status !== 'left'))
      }
      toolbar={
        <>
          <Select
            style={{ width: 170 }}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[{ value: '', label: t('common.all') }, ...STATUSES.map((s) => ({ value: s, label: t('student.status.' + s) })), { value: 'debtors', label: t('nav.debtors') }]}
          />
          <Select style={{ width: 170 }} value={group} onChange={(e) => setGroup(e.target.value)} options={opts.allGroups} placeholder={t('nav.groups') + ': ' + t('common.all')} />
        </>
      }
      columns={[
        {
          key: 'full_name',
          label: t('common.fullName'),
          render: (s) => (
            <div className="row">
              <Avatar name={s.full_name} />
              <div>
                <div className="bold">{s.full_name}</div>
                <div className="small muted">{phone(s.phone)}</div>
              </div>
            </div>
          ),
        },
        { key: 'groups', label: t('student.groups'), value: (s) => groupsOf(s.id), render: (s) => <span className="small">{groupsOf(s.id) || '—'}</span> },
        { key: 'level', label: t('common.level'), hideSm: true },
        { key: 'age', label: t('common.age'), value: (s) => age(s.birth_date) ?? '', hideSm: true, render: (s) => age(s.birth_date) ?? '—' },
        { key: 'status', label: t('common.status'), render: (s) => <StudentStatusBadge s={s.status} /> },
        {
          key: 'balance',
          label: t('common.balance'),
          num: true,
          value: (s) => balances.get(s.id) || 0,
          render: (s) => {
            const b = balances.get(s.id) || 0
            return <b className={b < 0 ? 'red' : b > 0 ? 'green' : 'muted'}>{money(b)}</b>
          },
        },
      ]}
      fields={studentFields(t, opts)}
      defaults={() => ({ status: 'trial', branch_id: me.branch_id || opts.branches[0]?.value, created_at: todayISO() })}
    />
  )
}
