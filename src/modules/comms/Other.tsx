// Fikrlar, tadbirlar va vazifalar
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useMe } from '@/lib/auth'
import { canEdit } from '@/lib/permissions'
import { useMutate, useRows } from '@/lib/data'
import { useToast } from '@/components/Toast'
import { ResourcePage } from '@/crud/ResourcePage'
import { EntityForm } from '@/crud/EntityForm'
import { Avatar, Badge, Button, Card, Empty, PageHead, Stat } from '@/components/ui'
import { date, todayISO, addDays } from '@/lib/format'
import { useLookups, useOptions } from '../shared'
import type { Feedback, Task } from '@/lib/types'
import { Star } from 'lucide-react'

export function FeedbackPage() {
  const t = useT()
  const me = useMe()
  const toast = useToast()
  const L = useLookups()
  const all = useRows('feedback')
  const m = useMutate('feedback')
  const [form, setForm] = useState(false)
  const isPortal = me.role === 'student' || me.role === 'parent'
  const types = ['nps', 'complaint', 'suggestion', 'praise'] as const

  if (isPortal) {
    const mine = all.filter((f) => f.student_id === me.student_id)
    return (
      <>
        <PageHead title={t('nav.feedback')} actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setForm(true)}>{t('fb.add')}</Button>} />
        <Card>
          {mine.length === 0 && <Empty />}
          {mine.map((f) => (
            <div key={f.id} className="list-item" style={{ alignItems: 'flex-start' }}>
              <div className="grow">
                <div className="row-wrap"><Badge>{t('fb.type.' + f.type)}</Badge><span className="rating">{'★'.repeat(f.rating)}</span><span className="small muted">{date(f.created_at)}</span></div>
                <p className="small">{f.text}</p>
                {f.response && <p className="small green">↳ {f.response}</p>}
              </div>
              <Badge tone={f.status === 'resolved' ? 'green' : 'yellow'}>{t('fb.status.' + f.status)}</Badge>
            </div>
          ))}
        </Card>
        {form && (
          <EntityForm
            title={t('fb.add')}
            fields={[
              { name: 'type', label: t('common.type'), type: 'select', required: true, options: types.map((x) => ({ value: x, label: t('fb.type.' + x) })) },
              { name: 'rating', label: t('fb.rating') + ' (1–5)', type: 'number', min: 1, max: 5, required: true },
              { name: 'text', label: t('common.comment'), type: 'textarea', required: true },
            ]}
            initial={{ type: 'nps', rating: 5, text: '' } as any}
            onClose={() => setForm(false)}
            onSubmit={async (v: any) => {
              await m.create({ ...v, rating: Math.min(5, Math.max(1, v.rating)), student_id: me.student_id, status: 'new' })
              toast.success(t('common.saved'))
              setForm(false)
            }}
          />
        )}
      </>
    )
  }

  const avg = all.length ? (all.reduce((s, f) => s + f.rating, 0) / all.length).toFixed(1) : '—'
  return (
    <ResourcePage
      table="feedback"
      title={t('nav.feedback')}
      editable={canEdit(me.role, 'feedback')}
      initialSort={{ key: 'created_at', dir: -1 }}
      top={
        <div className="grid grid-stats mb">
          <Stat icon={<Star size={20} />} color="#f5a524" label={t('fb.avg')} value={avg} />
          <Stat icon={<Star size={20} />} color="#dc2626" label={t('fb.status.new')} value={all.filter((f) => f.status === 'new').length} />
        </div>
      }
      searchText={(f) => (f.text ?? '') + (L.students.get(f.student_id || '')?.full_name ?? '')}
      columns={[
        { key: 'created_at', label: t('common.date'), render: (f) => date(f.created_at) },
        { key: 'student', label: t('role.student'), render: (f) => L.students.get(f.student_id || '')?.full_name ?? '—' },
        { key: 'type', label: t('common.type'), render: (f: Feedback) => <Badge tone={f.type === 'complaint' ? 'red' : f.type === 'praise' ? 'green' : 'blue'}>{t('fb.type.' + f.type)}</Badge> },
        { key: 'rating', label: t('fb.rating'), render: (f) => <span className="rating">{'★'.repeat(f.rating)}</span> },
        { key: 'text', label: t('common.comment'), render: (f) => <span className="small">{f.text}</span> },
        { key: 'status', label: t('common.status'), render: (f) => <Badge tone={f.status === 'resolved' ? 'green' : f.status === 'new' ? 'red' : 'yellow'}>{t('fb.status.' + f.status)}</Badge> },
      ]}
      fields={[
        { name: 'status', label: t('common.status'), type: 'select', required: true, options: ['new', 'in_progress', 'resolved'].map((s) => ({ value: s, label: t('fb.status.' + s) })) },
        { name: 'type', label: t('common.type'), type: 'select', required: true, options: types.map((x) => ({ value: x, label: t('fb.type.' + x) })) },
        { name: 'text', label: t('common.comment'), type: 'textarea' },
        { name: 'response', label: t('fb.response'), type: 'textarea' },
      ]}
      defaults={() => ({ status: 'new', type: 'suggestion', rating: 5 })}
    />
  )
}

export function EventsPage() {
  const t = useT()
  const me = useMe()
  const L = useLookups()
  const opts = useOptions()
  const types = ['speaking_club', 'exam', 'holiday', 'masterclass', 'meeting', 'other'] as const
  return (
    <ResourcePage
      table="events"
      title={t('nav.events')}
      editable={canEdit(me.role, 'events')}
      addLabel={t('ev.add')}
      branchScoped
      initialSort={{ key: 'date', dir: 1 }}
      filter={(e) => e.date >= addDays(todayISO(), -60)}
      searchText={(e) => e.title + (e.description ?? '')}
      columns={[
        { key: 'date', label: t('common.date'), render: (e) => <b className={e.date < todayISO() ? 'muted' : ''}>{date(e.date)} {e.time}</b> },
        { key: 'title', label: t('common.name'), render: (e) => <div><div className="bold">{e.title}</div><div className="small muted">{e.description}</div></div> },
        { key: 'type', label: t('common.type'), render: (e) => <Badge tone="purple">{t('ev.type.' + e.type)}</Badge> },
        { key: 'branch', label: t('common.branch'), hideSm: true, render: (e) => L.branches.get(e.branch_id || '')?.name ?? t('common.all') },
        { key: 'capacity', label: t('common.capacity'), num: true, hideSm: true },
      ]}
      fields={[
        { name: 'title', label: t('common.name'), required: true, full: true },
        { name: 'type', label: t('common.type'), type: 'select', required: true, options: types.map((x) => ({ value: x, label: t('ev.type.' + x) })) },
        { name: 'branch_id', label: t('common.branch'), type: 'select', options: opts.branches },
        { name: 'date', label: t('common.date'), type: 'date', required: true },
        { name: 'time', label: t('common.time'), type: 'time' },
        { name: 'capacity', label: t('common.capacity'), type: 'number' },
        { name: 'description', label: t('common.description'), type: 'textarea' },
      ]}
      defaults={() => ({ type: 'speaking_club', date: addDays(todayISO(), 7), time: '11:00' })}
    />
  )
}

const COLS: Task['status'][] = ['todo', 'in_progress', 'done']
const PRIO_TONE = { low: 'gray', medium: 'yellow', high: 'red' } as const

export function TasksPage() {
  const t = useT()
  const me = useMe()
  const toast = useToast()
  const L = useLookups()
  const opts = useOptions()
  const all = useRows('tasks')
  const m = useMutate('tasks')
  const [mine, setMine] = useState(!['owner', 'admin', 'manager'].includes(me.role))
  const [edit, setEdit] = useState<Partial<Task> | null>(null)
  const tasks = all.filter((x) => !mine || x.assigned_to === me.id || x.created_by === me.id)
  const today = todayISO()
  return (
    <>
      <PageHead
        title={t('nav.tasks')}
        actions={
          <>
            <label className="check"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> {t('dash.myTasks')}</label>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEdit({ status: 'todo', priority: 'medium', assigned_to: me.id, created_by: me.id, due_date: today })}>{t('task.add')}</Button>
          </>
        }
      />
      <div className="grid grid-3">
        {COLS.map((c) => (
          <div key={c} className="kanban-col" style={{ width: 'auto', minWidth: 0, maxHeight: 'none' }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const id = e.dataTransfer.getData('text/plain'); if (id) m.update(id, { status: c }) }}>
            <div className="kanban-col-head">{t('task.status.' + c)} <Badge>{tasks.filter((x) => x.status === c).length}</Badge></div>
            <div className="kanban-col-body">
              {tasks
                .filter((x) => x.status === c)
                .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
                .map((x) => (
                  <div key={x.id} className="kanban-card" draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', x.id)} onClick={() => setEdit(x)}>
                    <div className="row between"><b style={{ textDecoration: x.status === 'done' ? 'line-through' : undefined }}>{x.title}</b><Badge tone={PRIO_TONE[x.priority]}>{t('task.priority.' + x.priority)}</Badge></div>
                    {x.description && <div className="small muted">{x.description}</div>}
                    <div className="row between small" style={{ marginTop: 6 }}>
                      <span className="row" style={{ gap: 6 }}><Avatar name={L.profiles.get(x.assigned_to || '')?.full_name} /> {L.profiles.get(x.assigned_to || '')?.full_name?.split(' ')[0]}</span>
                      <span className={x.due_date && x.due_date < today && x.status !== 'done' ? 'red bold' : 'muted'}>{date(x.due_date)}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
      {edit && (
        <EntityForm
          title={edit.id ? t('common.edit') : t('task.add')}
          initial={edit as Task}
          fields={[
            { name: 'title', label: t('common.name'), required: true, full: true },
            { name: 'assigned_to', label: t('common.assignee'), type: 'select', options: opts.staff, required: true },
            { name: 'due_date', label: t('common.dueDate'), type: 'date' },
            { name: 'priority', label: t('common.priority'), type: 'select', required: true, options: (['low', 'medium', 'high'] as const).map((p) => ({ value: p, label: t('task.priority.' + p) })) },
            { name: 'status', label: t('common.status'), type: 'select', required: true, options: COLS.map((s) => ({ value: s, label: t('task.status.' + s) })) },
            { name: 'description', label: t('common.description'), type: 'textarea' },
          ]}
          onClose={() => setEdit(null)}
          extra={(v) => v.id ? <Button variant="danger" onClick={async () => { await m.remove(v.id); setEdit(null) }}>{t('common.delete')}</Button> : null}
          onSubmit={async (v) => {
            const { id, created_at, ...patch } = v
            if (id) await m.update(id, patch)
            else await m.create(patch)
            toast.success(t('common.saved'))
            setEdit(null)
          }}
        />
      )}
    </>
  )
}
