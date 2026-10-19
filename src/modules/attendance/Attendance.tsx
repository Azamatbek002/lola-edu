import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useT } from '@/lib/i18n'
import { useMe, useBranchFilter } from '@/lib/auth'
import { canEdit } from '@/lib/permissions'
import { useRows } from '@/lib/data'
import { db } from '@/lib/db'
import { useMessenger } from '@/lib/messaging'
import { useToast } from '@/components/Toast'
import { Avatar, Badge, Button, Card, Checkbox, Empty, Field, Input, PageHead, Select } from '@/components/ui'
import { date, todayISO } from '@/lib/format'
import { hasLessonOn } from '@/lib/schedule'
import { useLookups } from '../shared'
import type { AttendanceStatus } from '@/lib/types'

const STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'excused']

export default function AttendancePage() {
  const t = useT()
  const me = useMe()
  const qc = useQueryClient()
  const toast = useToast()
  const byBranch = useBranchFilter()
  const L = useLookups()
  const [sp, setSp] = useSearchParams()
  const groups = byBranch(useRows('groups')).filter((g) => (g.status === 'active' || g.status === 'forming') && (me.role !== 'teacher' || g.teacher_id === me.id))
  const enrollments = useRows('enrollments')
  const attendance = useRows('attendance')
  const lessons = useRows('lessons')
  const settings = useRows('settings')
  const { sendTrigger } = useMessenger()
  const editable = canEdit(me.role, 'attendance')

  const day = sp.get('date') || todayISO()
  const todays = groups.filter((g) => hasLessonOn(g, day)).sort((a, b) => a.start_time.localeCompare(b.start_time))
  const groupId = sp.get('group') || todays[0]?.id || groups[0]?.id || ''
  const g = groups.find((x) => x.id === groupId)

  const roster = useMemo(
    () =>
      enrollments
        .filter((e) => e.group_id === groupId && e.status === 'active' && e.start_date <= day && (!e.end_date || e.end_date >= day))
        .map((e) => L.students.get(e.student_id)!)
        .filter(Boolean)
        .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [enrollments, groupId, day, L.students],
  )
  const existing = useMemo(() => attendance.filter((a) => a.group_id === groupId && a.date === day), [attendance, groupId, day])
  const lesson = lessons.find((l) => l.group_id === groupId && l.date === day)

  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [topic, setTopic] = useState('')
  const [hw, setHw] = useState('')
  const autoNotify = (settings.find((s) => s.key === 'center')?.value as any)?.absence_alert ?? true
  const [notify, setNotify] = useState(autoNotify)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const m: Record<string, AttendanceStatus> = {}
    const n: Record<string, string> = {}
    for (const s of roster) {
      const ex = existing.find((a) => a.student_id === s.id)
      m[s.id] = ex?.status ?? 'present'
      if (ex?.note) n[s.id] = ex.note
    }
    setMarks(m)
    setNotes(n)
    setTopic(lesson?.topic ?? '')
    setHw(lesson?.homework ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, day, roster.length, existing.length, lesson?.id])

  const save = async (cancelled = false) => {
    if (!g) return
    setBusy(true)
    try {
      if (!cancelled) {
        for (const s of roster) {
          const ex = existing.find((a) => a.student_id === s.id)
          const row = { status: marks[s.id], note: notes[s.id] || null, marked_by: me.id }
          if (ex) {
            if (ex.status !== row.status || (ex.note || null) !== row.note) await db.update('attendance', ex.id, row)
          } else await db.insert('attendance', { group_id: g.id, student_id: s.id, date: day, ...row })
        }
      }
      const lrow = { topic: topic || null, homework: hw || null, status: cancelled ? ('cancelled' as const) : ('done' as const), teacher_id: g.teacher_id }
      if (lesson) await db.update('lessons', lesson.id, lrow)
      else await db.insert('lessons', { group_id: g.id, date: day, ...lrow })

      if (!cancelled && notify) {
        const newlyAbsent = roster.filter((s) => marks[s.id] === 'absent' && existing.find((a) => a.student_id === s.id)?.status !== 'absent')
        await sendTrigger(
          'absence',
          newlyAbsent.map((s) => ({
            phone: s.parent_phone || s.phone,
            telegram_chat_id: s.parent_telegram_chat_id || s.telegram_chat_id,
            name: s.full_name,
            vars: { date: date(day), group: g.name },
          })),
        )
      }
      qc.invalidateQueries({ queryKey: ['attendance'] })
      qc.invalidateQueries({ queryKey: ['lessons'] })
      toast.success(cancelled ? t('att.cancelled') : t('att.saved'))
    } catch (e: any) {
      toast.error(e?.message || t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  const counts = STATUSES.map((s) => ({ s, n: Object.values(marks).filter((x) => x === s).length }))

  return (
    <>
      <PageHead title={t('att.mark')} />
      <div className="grid grid-3">
        <Card title={t('dash.todayLessons')}>
          <div className="card-body">
            <Field label={t('common.date')}>
              <Input type="date" value={day} onChange={(e) => setSp({ date: e.target.value })} />
            </Field>
          </div>
          {todays.length === 0 && <Empty text={t('dash.noLessons')} />}
          {todays.map((x) => {
            const done = attendance.some((a) => a.group_id === x.id && a.date === day)
            return (
              <div key={x.id} className="list-item" style={{ cursor: 'pointer', background: x.id === groupId ? 'var(--brand-50)' : undefined }} onClick={() => setSp({ date: day, group: x.id })}>
                <b style={{ width: 46 }}>{x.start_time}</b>
                <div className="grow">
                  <div className="bold ellipsis">{x.name}</div>
                  <div className="small muted">{L.profiles.get(x.teacher_id || '')?.full_name}</div>
                </div>
                {done && <Badge tone="green">✓</Badge>}
              </div>
            )
          })}
          <div className="card-body">
            <Select value={groupId} options={groups.map((x) => ({ value: x.id, label: x.name }))} onChange={(e) => setSp({ date: day, group: e.target.value })} />
          </div>
        </Card>

        <Card
          className="span-2"
          title={g ? `${g.name} · ${date(day)}` : t('att.mark')}
          actions={
            editable &&
            g && (
              <Button size="sm" onClick={() => setMarks(Object.fromEntries(roster.map((s) => [s.id, 'present'])))}>
                {t('att.allPresent')}
              </Button>
            )
          }
        >
          {g && !hasLessonOn(g, day) && <div className="badge badge-yellow" style={{ margin: 14, padding: 8 }}>{t('att.noLessonToday')}</div>}
          {lesson?.status === 'cancelled' && <div className="badge badge-gray" style={{ margin: 14, padding: 8 }}>{t('att.cancelled')}</div>}
          {roster.length === 0 && <Empty />}
          {roster.map((s, i) => (
            <div key={s.id} className="att-row">
              <span className="muted small" style={{ width: 18 }}>{i + 1}</span>
              <Avatar name={s.full_name} />
              <div className="grow">
                <div className="bold">{s.full_name}</div>
                {marks[s.id] && marks[s.id] !== 'present' && (
                  <input className="input" style={{ minHeight: 30, marginTop: 4, padding: '4px 8px' }} placeholder={t('common.note')} value={notes[s.id] ?? ''} onChange={(e) => setNotes({ ...notes, [s.id]: e.target.value })} disabled={!editable} />
                )}
              </div>
              <div className="seg">
                {STATUSES.map((st) => (
                  <button key={st} disabled={!editable} className={(marks[s.id] === st ? 'on ' : '') + st} onClick={() => setMarks({ ...marks, [s.id]: st })}>
                    {t('att.' + st)}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {roster.length > 0 && (
            <div className="card-body">
              <div className="row-wrap mb">
                {counts.map((c) => (
                  <Badge key={c.s} tone={c.s === 'present' ? 'green' : c.s === 'absent' ? 'red' : c.s === 'late' ? 'yellow' : 'blue'}>
                    {t('att.' + c.s)}: {c.n}
                  </Badge>
                ))}
              </div>
              <div className="form-grid">
                <Field label={t('att.topic')}>
                  <Input value={topic} onChange={(e) => setTopic(e.target.value)} disabled={!editable} />
                </Field>
                <Field label={t('att.homework')}>
                  <Input value={hw} onChange={(e) => setHw(e.target.value)} disabled={!editable} />
                </Field>
                <div className="full">
                  <Checkbox label={t('att.notify')} checked={notify} onChange={setNotify} />
                </div>
              </div>
              {editable && (
                <div className="row mt" style={{ justifyContent: 'flex-end' }}>
                  <Button variant="ghost" disabled={busy} onClick={() => save(true)}>{t('att.cancelled')}</Button>
                  <Button variant="primary" disabled={busy} onClick={() => save(false)}>{t('common.save')}</Button>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
