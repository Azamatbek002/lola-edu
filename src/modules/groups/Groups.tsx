import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useT, type T } from '@/lib/i18n'
import { useMe } from '@/lib/auth'
import { canEdit } from '@/lib/permissions'
import { useRows } from '@/lib/data'
import { ResourcePage } from '@/crud/ResourcePage'
import { Badge, Progress, Select } from '@/components/ui'
import { money, todayISO } from '@/lib/format'
import { conflictsFor } from '@/lib/schedule'
import type { FieldDef } from '@/crud/EntityForm'
import type { Group } from '@/lib/types'
import { GroupStatusBadge, groupSchedule, useGroupStats, useLookups, useOptions } from '../shared'

const STATUSES: Group['status'][] = ['forming', 'active', 'finished', 'archived']

export function groupFields(t: T, opts: ReturnType<typeof useOptions>, branchId?: string): FieldDef<Group>[] {
  return [
    { name: 'name', label: t('common.name'), required: true },
    { name: 'course_id', label: t('group.course'), type: 'select', options: opts.courses, required: true },
    { name: 'branch_id', label: t('common.branch'), type: 'select', options: opts.branches, required: true },
    { name: 'teacher_id', label: t('group.teacher'), type: 'select', options: opts.teachers },
    { name: 'room_id', label: t('group.room'), type: 'select', options: opts.roomsFor(branchId) },
    { name: 'status', label: t('common.status'), type: 'select', required: true, options: STATUSES.map((s) => ({ value: s, label: t('group.status.' + s) })) },
    { name: 'days', label: t('group.days'), type: 'days', required: true },
    { name: 'start_time', label: t('group.startTime'), type: 'time', required: true },
    { name: 'end_time', label: t('group.endTime'), type: 'time', required: true },
    { name: 'start_date', label: t('group.startDate'), type: 'date', required: true },
    { name: 'end_date', label: t('group.endDate'), type: 'date' },
    { name: 'capacity', label: t('group.capacity'), type: 'number', required: true },
    { name: 'monthly_price', label: t('group.priceOverride'), type: 'money', hint: '' },
  ]
}

/** Saqlashdan oldin jadval to'qnashuvini tekshiradi */
export function useGroupValidator() {
  const t = useT()
  const groups = useRows('groups')
  const L = useLookups()
  return (v: Group) => {
    if (v.start_time >= v.end_time) return `${t('group.startTime')} < ${t('group.endTime')}`
    const c = conflictsFor({ ...v, id: v.id || '__new' }, groups)
    if (!c.length) return null
    return c
      .map((x) => {
        const other = x.a.id === (v.id || '__new') ? x.b : x.a
        return `${t('group.conflict')}: ${x.type === 'room' ? t('group.conflictRoom') + ' (' + (L.rooms.get(other.room_id || '')?.name ?? '') + ')' : t('group.conflictTeacher')} — ${other.name} ${other.start_time}–${other.end_time}`
      })
      .join('; ')
  }
}

export default function GroupsPage() {
  const t = useT()
  const me = useMe()
  const nav = useNavigate()
  const opts = useOptions()
  const L = useLookups()
  const gs = useGroupStats()
  const validate = useGroupValidator()
  const [status, setStatus] = useState('active')
  const [course, setCourse] = useState('')

  const filter = useMemo(
    () => (g: Group) =>
      (!status || g.status === status) && (!course || g.course_id === course) && (me.role !== 'teacher' || g.teacher_id === me.id),
    [status, course, me],
  )

  return (
    <ResourcePage
      table="groups"
      title={me.role === 'teacher' ? t('nav.myGroups') : t('nav.groups')}
      branchScoped
      editable={canEdit(me.role, 'groups')}
      addLabel={t('group.add')}
      onRowClick={(g) => nav('/groups/' + g.id)}
      searchText={(g) => g.name + ' ' + (L.profiles.get(g.teacher_id || '')?.full_name ?? '')}
      filter={filter}
      validate={validate as any}
      wideForm
      toolbar={
        <>
          <Select style={{ width: 150 }} value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: '', label: t('common.all') }, ...STATUSES.map((s) => ({ value: s, label: t('group.status.' + s) }))]} />
          <Select style={{ width: 200 }} value={course} onChange={(e) => setCourse(e.target.value)} options={opts.courses} placeholder={t('group.course') + ': ' + t('common.all')} />
        </>
      }
      columns={[
        {
          key: 'name',
          label: t('common.name'),
          render: (g) => (
            <div className="row">
              <span className="dot" style={{ background: L.courses.get(g.course_id)?.color || 'var(--brand)' }} />
              <div>
                <div className="bold">{g.name}</div>
                <div className="small muted">{L.courses.get(g.course_id)?.name}</div>
              </div>
            </div>
          ),
        },
        { key: 'schedule', label: t('nav.schedule'), value: (g) => g.start_time, render: (g) => <span className="small nowrap">{groupSchedule(t, g)}</span> },
        { key: 'teacher', label: t('group.teacher'), value: (g) => L.profiles.get(g.teacher_id || '')?.full_name, render: (g) => L.profiles.get(g.teacher_id || '')?.full_name ?? '—', hideSm: true },
        { key: 'room', label: t('group.room'), value: (g) => L.rooms.get(g.room_id || '')?.name, render: (g) => L.rooms.get(g.room_id || '')?.name ?? '—', hideSm: true },
        {
          key: 'students',
          label: t('group.students'),
          value: (g) => gs.count(g.id),
          render: (g) => (
            <div style={{ minWidth: 90 }}>
              <div className="small bold">{gs.count(g.id)} / {g.capacity}</div>
              <Progress value={(gs.count(g.id) / g.capacity) * 100} color={gs.count(g.id) >= g.capacity ? 'var(--green)' : undefined} />
            </div>
          ),
        },
        { key: 'price', label: t('common.price'), num: true, hideSm: true, value: (g) => gs.price(g), render: (g) => money(gs.price(g)) },
        { key: 'status', label: t('common.status'), render: (g) => <GroupStatusBadge s={g.status} /> },
      ]}
      fields={groupFields(t, opts)}
      defaults={() => ({ status: 'forming', days: [1, 3, 5], start_time: '09:00', end_time: '10:30', capacity: 12, start_date: todayISO(), branch_id: me.branch_id || opts.branches[0]?.value })}
      rowActions={(g) => (gs.count(g.id) >= g.capacity ? <Badge tone="green">{t('group.full')}</Badge> : null)}
    />
  )
}
