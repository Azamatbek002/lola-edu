import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useMe, useBranchFilter } from '@/lib/auth'
import { canEdit } from '@/lib/permissions'
import { useMutate, useRows } from '@/lib/data'
import { useToast } from '@/components/Toast'
import { Avatar, Button, Card, Field, Input, Modal, PageHead, Select } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { date, todayISO } from '@/lib/format'
import { useLookups } from '../shared'
import type { GradeType } from '@/lib/types'

const TYPES: GradeType[] = ['homework', 'quiz', 'speaking', 'writing', 'listening', 'reading', 'midterm', 'final']

export default function GradesPage() {
  const t = useT()
  const me = useMe()
  const byBranch = useBranchFilter()
  const L = useLookups()
  const [sp, setSp] = useSearchParams()
  const groups = byBranch(useRows('groups')).filter((g) => g.status !== 'archived' && (me.role !== 'teacher' || g.teacher_id === me.id))
  const grades = useRows('grades')
  const m = useMutate('grades')
  const groupId = sp.get('group') || groups[0]?.id || ''
  const [bulk, setBulk] = useState(!!sp.get('group'))
  const editable = canEdit(me.role, 'grades')

  const rows = useMemo(() => grades.filter((g) => g.group_id === groupId).sort((a, b) => b.date.localeCompare(a.date)), [grades, groupId])

  // O'rtacha ballar jadvali (o'quvchi × tur)
  const summary = useMemo(() => {
    const map = new Map<string, { sum: number; n: number }>()
    for (const g of rows) {
      const k = g.student_id
      const x = map.get(k) || { sum: 0, n: 0 }
      x.sum += (g.score / g.max_score) * 100
      x.n++
      map.set(k, x)
    }
    return [...map.entries()].map(([sid, x]) => ({ id: sid, avg: Math.round(x.sum / x.n), n: x.n })).sort((a, b) => b.avg - a.avg)
  }, [rows])

  return (
    <>
      <PageHead
        title={t('nav.grades')}
        actions={
          <>
            <Select style={{ width: 200 }} value={groupId} options={groups.map((g) => ({ value: g.id, label: g.name }))} onChange={(e) => setSp({ group: e.target.value })} />
            {editable && <Button variant="primary" icon={<Plus size={16} />} onClick={() => setBulk(true)}>{t('grade.bulk')}</Button>}
          </>
        }
      />
      <div className="grid grid-3">
        <Card title={t('dash.avgScore')}>
          {summary.map((s, i) => (
            <div key={s.id} className="list-item">
              <span className="muted small" style={{ width: 18 }}>{i + 1}</span>
              <Avatar name={L.students.get(s.id)?.full_name} />
              <div className="grow ellipsis bold">{L.students.get(s.id)?.full_name}</div>
              <b className={s.avg < 60 ? 'red' : s.avg >= 85 ? 'green' : ''}>{s.avg}</b>
            </div>
          ))}
        </Card>
        <Card className="span-2">
          <DataTable
            rows={rows}
            columns={[
              { key: 'date', label: t('common.date'), render: (g) => date(g.date) },
              { key: 'student', label: t('role.student'), value: (g) => L.students.get(g.student_id)?.full_name, render: (g) => L.students.get(g.student_id)?.full_name },
              { key: 'title', label: t('grade.title') },
              { key: 'type', label: t('common.type'), render: (g) => t('grade.type.' + g.type), hideSm: true },
              { key: 'score', label: t('common.score'), num: true, value: (g) => g.score / g.max_score, render: (g) => <b className={g.score / g.max_score < 0.6 ? 'red' : ''}>{g.score}/{g.max_score}</b> },
              ...(editable ? [{ key: 'x', label: '', sortable: false, render: (g: any) => <Button size="sm" variant="ghost" onClick={() => m.remove(g.id)}>✕</Button> }] : []),
            ]}
          />
        </Card>
      </div>
      {bulk && groupId && <BulkGrade groupId={groupId} onClose={() => setBulk(false)} />}
    </>
  )
}

function BulkGrade({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const t = useT()
  const me = useMe()
  const toast = useToast()
  const L = useLookups()
  const enrollments = useRows('enrollments')
  const m = useMutate('grades')
  const students = enrollments.filter((e) => e.group_id === groupId && e.status === 'active').map((e) => L.students.get(e.student_id)!).filter(Boolean)
  const [head, setHead] = useState({ title: '', type: 'quiz' as GradeType, max_score: '100', date: todayISO() })
  const [scores, setScores] = useState<Record<string, string>>({})
  const [comments, setComments] = useState<Record<string, string>>({})
  const save = async () => {
    const rows = students
      .filter((s) => scores[s.id] !== undefined && scores[s.id] !== '')
      .map((s) => ({ student_id: s.id, group_id: groupId, type: head.type, title: head.title, score: Number(scores[s.id]), max_score: Number(head.max_score) || 100, date: head.date, comment: comments[s.id] || null, teacher_id: me.id }))
    if (!rows.length || !head.title) return
    await m.createMany(rows)
    toast.success(`${rows.length} · ${t('common.saved')}`)
    onClose()
  }
  return (
    <Modal title={`${t('grade.bulk')} — ${L.groups.get(groupId)?.name}`} onClose={onClose} wide footer={<Button variant="primary" disabled={!head.title} onClick={save}>{t('common.save')}</Button>}>
      <div className="form-grid mb">
        <Field label={t('grade.title') + ' *'}><Input value={head.title} onChange={(e) => setHead({ ...head, title: e.target.value })} /></Field>
        <Field label={t('common.type')}><Select value={head.type} options={TYPES.map((x) => ({ value: x, label: t('grade.type.' + x) }))} onChange={(e) => setHead({ ...head, type: e.target.value as GradeType })} /></Field>
        <Field label={t('grade.maxScore')}><Input type="number" value={head.max_score} onChange={(e) => setHead({ ...head, max_score: e.target.value })} /></Field>
        <Field label={t('common.date')}><Input type="date" value={head.date} onChange={(e) => setHead({ ...head, date: e.target.value })} /></Field>
      </div>
      {students.map((s) => (
        <div key={s.id} className="att-row" style={{ padding: '8px 0' }}>
          <Avatar name={s.full_name} />
          <div className="grow bold">{s.full_name}</div>
          <input className="input" style={{ width: 90 }} type="number" min={0} max={Number(head.max_score)} placeholder={t('common.score')} value={scores[s.id] ?? ''} onChange={(e) => setScores({ ...scores, [s.id]: e.target.value })} />
          <input className="input" style={{ width: 200 }} placeholder={t('common.comment')} value={comments[s.id] ?? ''} onChange={(e) => setComments({ ...comments, [s.id]: e.target.value })} />
        </div>
      ))}
    </Modal>
  )
}
