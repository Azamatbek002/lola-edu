import { useState } from 'react'
import { useT } from '@/lib/i18n'
import { useMe, useBranchFilter } from '@/lib/auth'
import { canEdit } from '@/lib/permissions'
import { useMutate, useRows } from '@/lib/data'
import { useToast } from '@/components/Toast'
import { ResourcePage } from '@/crud/ResourcePage'
import { Badge, Button, Field, Input, Modal, Textarea } from '@/components/ui'
import { addDays, date, todayISO } from '@/lib/format'
import { useGroupStats, useLookups } from '../shared'
import type { Homework } from '@/lib/types'

export default function HomeworkPage() {
  const t = useT()
  const me = useMe()
  const byBranch = useBranchFilter()
  const L = useLookups()
  const gs = useGroupStats()
  const groups = byBranch(useRows('groups')).filter((g) => g.status === 'active' && (me.role !== 'teacher' || g.teacher_id === me.id))
  const subs = useRows('homework_submissions')
  const ids = new Set(groups.map((g) => g.id))
  const [open, setOpen] = useState<Homework | null>(null)
  return (
    <>
      <ResourcePage
        table="homework"
        title={t('nav.homework')}
        editable={canEdit(me.role, 'homework')}
        addLabel={t('hw.add')}
        filter={(h) => ids.has(h.group_id)}
        onRowClick={(h) => setOpen(h)}
        searchText={(h) => h.title + ' ' + (L.groups.get(h.group_id)?.name ?? '')}
        initialSort={{ key: 'due_date', dir: -1 }}
        columns={[
          { key: 'title', label: t('grade.title'), render: (h) => <b>{h.title}</b> },
          { key: 'group', label: t('nav.groups'), value: (h) => L.groups.get(h.group_id)?.name, render: (h) => L.groups.get(h.group_id)?.name },
          { key: 'due_date', label: t('common.dueDate'), render: (h) => <span className={h.due_date < todayISO() ? 'muted' : 'bold'}>{date(h.due_date)}</span> },
          {
            key: 'subs',
            label: t('hw.submissions'),
            num: true,
            value: (h) => subs.filter((s) => s.homework_id === h.id).length,
            render: (h) => {
              const list = subs.filter((s) => s.homework_id === h.id)
              const unchecked = list.filter((s) => s.status === 'submitted').length
              return (
                <span>
                  {list.length}/{gs.count(h.group_id)} {unchecked > 0 && <Badge tone="brand">{unchecked}</Badge>}
                </span>
              )
            },
          },
        ]}
        fields={[
          { name: 'group_id', label: t('nav.groups'), type: 'select', options: groups.map((g) => ({ value: g.id, label: g.name })), required: true },
          { name: 'due_date', label: t('common.dueDate'), type: 'date', required: true },
          { name: 'title', label: t('grade.title'), required: true, full: true },
          { name: 'description', label: t('common.description'), type: 'textarea' },
          { name: 'attachment_url', label: t('common.url'), type: 'url', full: true },
        ]}
        defaults={() => ({ due_date: addDays(todayISO(), 2), created_by: me.id, group_id: groups[0]?.id })}
      />
      {open && <Submissions hw={open} onClose={() => setOpen(null)} />}
    </>
  )
}

function Submissions({ hw, onClose }: { hw: Homework; onClose: () => void }) {
  const t = useT()
  const toast = useToast()
  const L = useLookups()
  const enrollments = useRows('enrollments')
  const subs = useRows('homework_submissions').filter((s) => s.homework_id === hw.id)
  const m = useMutate('homework_submissions')
  const students = enrollments.filter((e) => e.group_id === hw.group_id && e.status === 'active').map((e) => L.students.get(e.student_id)!).filter(Boolean)
  const [check, setCheck] = useState<{ id: string; score: string; feedback: string } | null>(null)
  return (
    <Modal title={hw.title} onClose={onClose} wide>
      {hw.description && <p className="mb muted">{hw.description}</p>}
      {students.map((s) => {
        const sub = subs.find((x) => x.student_id === s.id)
        return (
          <div key={s.id} className="list-item" style={{ padding: '10px 0', alignItems: 'flex-start' }}>
            <div className="grow">
              <div className="bold">{s.full_name}</div>
              {sub?.text && <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{sub.text}</div>}
              {sub?.file_url && <a className="link small" href={sub.file_url} target="_blank" rel="noreferrer">📎 {sub.file_url}</a>}
              {sub?.feedback && <div className="small muted">💬 {sub.feedback}</div>}
            </div>
            {sub ? <Badge tone={sub.status === 'checked' ? 'green' : 'blue'}>{t('hw.status.' + sub.status)}{sub.score != null ? ` · ${sub.score}` : ''}</Badge> : <Badge tone="gray">{t('hw.pending')}</Badge>}
            {sub && <Button size="sm" onClick={() => setCheck({ id: sub.id, score: String(sub.score ?? ''), feedback: sub.feedback ?? '' })}>{t('hw.check')}</Button>}
          </div>
        )
      })}
      {check && (
        <Modal
          title={t('hw.check')}
          onClose={() => setCheck(null)}
          footer={
            <Button
              variant="primary"
              onClick={async () => {
                await m.update(check.id, { score: check.score ? Number(check.score) : null, feedback: check.feedback || null, status: 'checked' })
                toast.success(t('common.saved'))
                setCheck(null)
              }}
            >
              {t('common.save')}
            </Button>
          }
        >
          <Field label={t('common.score')}><Input type="number" value={check.score} onChange={(e) => setCheck({ ...check, score: e.target.value })} /></Field>
          <Field label={t('hw.feedback')}><Textarea value={check.feedback} onChange={(e) => setCheck({ ...check, feedback: e.target.value })} /></Field>
        </Modal>
      )}
    </Modal>
  )
}
