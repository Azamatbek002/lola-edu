// O'quvchi va ota-ona portali
import { useMemo, useState } from 'react'
import { CalendarDays, CheckSquare, CreditCard, Star, Wallet } from 'lucide-react'
import { useMe } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { useMutate, useRows } from '@/lib/data'
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHead, Progress, Stat, Textarea } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { date, money, monthLabel, todayISO, addDays } from '@/lib/format'
import { attendanceRate } from '@/lib/analytics'
import { hasLessonOn, isoWeekday } from '@/lib/schedule'
import { clickCheckoutUrl, paymeCheckoutUrl, studentBalance } from '@/lib/finance'
import { ATT_TONE, groupSchedule, methodLabel, useLookups } from '../shared'
import { useToast } from '@/components/Toast'
import type { Student } from '@/lib/types'

export function useMyStudent(): { student: Student | undefined; groupIds: string[] } {
  const me = useMe()
  const students = useRows('students')
  const enrollments = useRows('enrollments')
  const student = students.find((s) => s.id === me.student_id)
  const groupIds = enrollments.filter((e) => e.student_id === me.student_id && e.status === 'active').map((e) => e.group_id)
  return { student, groupIds }
}

function useNextLesson(groupIds: string[]) {
  const groups = useRows('groups')
  return useMemo(() => {
    const mine = groups.filter((g) => groupIds.includes(g.id) && g.status === 'active')
    const now = new Date().toTimeString().slice(0, 5)
    for (let i = 0; i < 14; i++) {
      const d = addDays(todayISO(), i)
      const list = mine.filter((g) => hasLessonOn(g, d) && (i > 0 || g.start_time > now)).sort((a, b) => a.start_time.localeCompare(b.start_time))
      if (list.length) return { date: d, group: list[0] }
    }
    return null
  }, [groups, groupIds])
}

export function PayOnline({ studentId, amount }: { studentId: string; amount: number }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [sum, setSum] = useState(String(Math.max(amount, 0) || ''))
  const payme = import.meta.env.VITE_PAYME_MERCHANT_ID as string | undefined
  const clickS = import.meta.env.VITE_CLICK_SERVICE_ID as string | undefined
  const clickM = import.meta.env.VITE_CLICK_MERCHANT_ID as string | undefined
  const ret = typeof location !== 'undefined' ? location.origin + '/my/payments' : undefined
  const n = Number(sum) || 0
  return (
    <>
      <Button variant="primary" icon={<CreditCard size={16} />} onClick={() => setOpen(true)}>
        {t('dash.payOnline')}
      </Button>
      {open && (
        <Modal title={t('pay.online')} onClose={() => setOpen(false)}>
          <Field label={t('common.amount')}>
            <Input type="number" value={sum} onChange={(e) => setSum(e.target.value)} />
          </Field>
          <p className="small muted mt">{t('pay.onlineHint')}</p>
          {!payme && !clickS && <div className="badge badge-yellow mt" style={{ whiteSpace: 'normal', padding: 10 }}>{t('pay.notConfigured')}</div>}
          <div className="grid grid-2 mt">
            <a
              className={'btn btn-secondary' + (!payme || n < 1000 ? ' disabled' : '')}
              style={{ padding: 14, pointerEvents: !payme || n < 1000 ? 'none' : undefined, opacity: !payme ? 0.5 : 1 }}
              href={payme ? paymeCheckoutUrl(payme, studentId, n, ret) : '#'}
            >
              <b style={{ color: '#33cccc', fontSize: '1.1rem' }}>Payme</b>
            </a>
            <a
              className="btn btn-secondary"
              style={{ padding: 14, pointerEvents: !clickS || n < 1000 ? 'none' : undefined, opacity: !clickS ? 0.5 : 1 }}
              href={clickS && clickM ? clickCheckoutUrl(clickS, clickM, studentId, n, ret) : '#'}
            >
              <b style={{ color: '#0073ff', fontSize: '1.1rem' }}>Click</b>
            </a>
          </div>
        </Modal>
      )}
    </>
  )
}

export default function PortalDashboard() {
  const t = useT()
  const me = useMe()
  const { student, groupIds } = useMyStudent()
  const L = useLookups()
  const payments = useRows('payments')
  const charges = useRows('charges')
  const attendance = useRows('attendance')
  const grades = useRows('grades')
  const next = useNextLesson(groupIds)
  if (!student) return <Empty />
  const balance = studentBalance(student.id, payments, charges)
  const myAtt = attendance.filter((a) => a.student_id === student.id)
  const myGr = grades.filter((g) => g.student_id === student.id)
  const avg = myGr.length ? Math.round(myGr.reduce((s, g) => s + (g.score / g.max_score) * 100, 0) / myGr.length) : 0
  return (
    <>
      <PageHead title={`${t('dash.welcome')}, ${me.full_name.split(' ')[0]}!`} subtitle={me.role === 'parent' ? `${t('role.student')}: ${student.full_name}` : undefined} />
      <div className="grid grid-stats mb">
        <Stat icon={<Wallet size={20} />} color={balance < 0 ? '#dc2626' : '#12a150'} label={t('dash.myBalance')} value={money(balance)} sub={balance < 0 ? <span className="red">{t('pay.debt')}</span> : undefined} />
        <Stat icon={<CheckSquare size={20} />} color="#2563eb" label={t('att.rate')} value={attendanceRate(myAtt) + '%'} />
        <Stat icon={<Star size={20} />} color="#d97706" label={t('dash.avgScore')} value={avg} />
      </div>
      <div className="grid grid-2">
        <Card title={t('dash.nextLesson')} pad>
          {next ? (
            <div className="row">
              <CalendarDays size={36} className="brand" />
              <div>
                <div className="bold" style={{ fontSize: '1.1rem' }}>{next.group.name}</div>
                <div className="muted">
                  {date(next.date)} · {next.group.start_time}–{next.group.end_time} · {L.rooms.get(next.group.room_id || '')?.name}
                </div>
                <div className="small muted">{L.profiles.get(next.group.teacher_id || '')?.full_name}</div>
              </div>
            </div>
          ) : (
            <Empty />
          )}
        </Card>
        <Card title={t('nav.myPayments')} pad>
          <p className="muted mb">{balance < 0 ? `${t('pay.debt')}: ${money(-balance)}` : `${t('common.balance')}: ${money(balance)}`}</p>
          <PayOnline studentId={student.id} amount={-balance} />
        </Card>
      </div>
    </>
  )
}

export function MySchedule() {
  const t = useT()
  const { groupIds } = useMyStudent()
  const L = useLookups()
  const groups = useRows('groups').filter((g) => groupIds.includes(g.id))
  const lessons = useRows('lessons').filter((l) => groupIds.includes(l.group_id)).sort((a, b) => b.date.localeCompare(a.date))
  return (
    <>
      <PageHead title={t('nav.mySchedule')} />
      <div className="grid grid-2 mb">
        {groups.map((g) => (
          <Card key={g.id} pad>
            <div className="row">
              <span className="dot" style={{ background: L.courses.get(g.course_id)?.color || 'var(--brand)', width: 14, height: 14 }} />
              <div>
                <div className="bold">{g.name}</div>
                <div className="muted small">{L.courses.get(g.course_id)?.name}</div>
              </div>
            </div>
            <div className="divider" />
            <div className="small">{groupSchedule(t, g)}</div>
            <div className="small muted">{L.profiles.get(g.teacher_id || '')?.full_name} · {L.rooms.get(g.room_id || '')?.name}</div>
            <div className="days mt">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <button key={d} type="button" className={g.days.includes(d) ? 'on' : ''} style={{ outline: d === isoWeekday(todayISO()) ? '2px solid var(--text)' : undefined }}>
                  {t('day.' + d)}
                </button>
              ))}
            </div>
          </Card>
        ))}
      </div>
      <Card title={t('group.lessons')}>
        <DataTable
          rows={lessons}
          columns={[
            { key: 'date', label: t('common.date'), render: (l) => date(l.date) },
            { key: 'group', label: t('nav.groups'), render: (l) => L.groups.get(l.group_id)?.name },
            { key: 'topic', label: t('att.topic') },
            { key: 'homework', label: t('att.homework'), hideSm: true },
          ]}
        />
      </Card>
    </>
  )
}

export function MyAttendance() {
  const t = useT()
  const { student } = useMyStudent()
  const L = useLookups()
  const rows = useRows('attendance').filter((a) => a.student_id === student?.id).sort((a, b) => b.date.localeCompare(a.date))
  const rate = attendanceRate(rows)
  return (
    <>
      <PageHead title={t('nav.myAttendance')} />
      <div className="grid grid-stats mb">
        {(['present', 'late', 'absent', 'excused'] as const).map((s) => (
          <Stat key={s} icon={<CheckSquare size={18} />} color={{ present: '#12a150', late: '#d97706', absent: '#dc2626', excused: '#2563eb' }[s]} label={t('att.' + s)} value={rows.filter((r) => r.status === s).length} />
        ))}
      </div>
      <Card title={`${t('att.rate')}: ${rate}%`}>
        <div className="card-body">
          <Progress value={rate} color={rate < 60 ? 'var(--red)' : 'var(--green)'} />
        </div>
        <DataTable
          rows={rows}
          columns={[
            { key: 'date', label: t('common.date'), render: (a) => date(a.date) },
            { key: 'group', label: t('nav.groups'), render: (a) => L.groups.get(a.group_id)?.name },
            { key: 'status', label: t('common.status'), render: (a) => <Badge tone={ATT_TONE[a.status]}>{t('att.' + a.status)}</Badge> },
          ]}
        />
      </Card>
    </>
  )
}

export function MyGrades() {
  const t = useT()
  const { student } = useMyStudent()
  const L = useLookups()
  const rows = useRows('grades').filter((g) => g.student_id === student?.id).sort((a, b) => b.date.localeCompare(a.date))
  const certs = useRows('certificates').filter((c) => c.student_id === student?.id)
  return (
    <>
      <PageHead title={t('nav.myGrades')} />
      <Card>
        <DataTable
          rows={rows}
          columns={[
            { key: 'date', label: t('common.date'), render: (g) => date(g.date) },
            { key: 'title', label: t('grade.title') },
            { key: 'type', label: t('common.type'), render: (g) => t('grade.type.' + g.type) },
            { key: 'group', label: t('nav.groups'), render: (g) => L.groups.get(g.group_id)?.name, hideSm: true },
            { key: 'score', label: t('common.score'), num: true, render: (g) => <b className={g.score / g.max_score < 0.6 ? 'red' : 'green'}>{g.score}/{g.max_score}</b> },
            { key: 'comment', label: t('common.comment'), hideSm: true },
          ]}
        />
      </Card>
      {certs.length > 0 && (
        <Card title={t('nav.certificates')} className="mt">
          {certs.map((c) => (
            <div key={c.id} className="list-item">
              <div className="grow bold">{L.courses.get(c.course_id)?.name} {c.level && <Badge tone="purple">{c.level}</Badge>}</div>
              <span className="muted small">№ {c.number} · {date(c.issued_date)}</span>
            </div>
          ))}
        </Card>
      )}
    </>
  )
}

export function MyHomework() {
  const t = useT()
  const me = useMe()
  const toast = useToast()
  const { student, groupIds } = useMyStudent()
  const L = useLookups()
  const hw = useRows('homework').filter((h) => groupIds.includes(h.group_id)).sort((a, b) => b.due_date.localeCompare(a.due_date))
  const subs = useRows('homework_submissions').filter((s) => s.student_id === student?.id)
  const m = useMutate('homework_submissions')
  const [open, setOpen] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  return (
    <>
      <PageHead title={t('nav.myHomework')} />
      <div className="grid grid-2">
        {hw.length === 0 && <Card><Empty /></Card>}
        {hw.map((h) => {
          const s = subs.find((x) => x.homework_id === h.id)
          return (
            <Card key={h.id} pad>
              <div className="row between">
                <b>{h.title}</b>
                {s ? <Badge tone={s.status === 'checked' ? 'green' : 'blue'}>{t('hw.status.' + s.status)}</Badge> : <Badge tone={h.due_date < todayISO() ? 'red' : 'yellow'}>{t('hw.pending')}</Badge>}
              </div>
              <div className="small muted">{L.groups.get(h.group_id)?.name} · {t('common.dueDate')}: {date(h.due_date)}</div>
              {h.description && <p className="mt small">{h.description}</p>}
              {h.attachment_url && <a className="link small" href={h.attachment_url} target="_blank" rel="noreferrer">📎 {t('common.open')}</a>}
              {s?.score != null && <div className="mt bold">{t('common.score')}: {s.score}</div>}
              {s?.feedback && <div className="small muted">{t('hw.feedback')}: {s.feedback}</div>}
              {!s && me.role === 'student' && (
                <Button variant="primary" size="sm" className="mt" onClick={() => setOpen(h.id)}>
                  {t('hw.submit')}
                </Button>
              )}
            </Card>
          )
        })}
      </div>
      {open && student && (
        <Modal
          title={t('hw.submit')}
          onClose={() => setOpen(null)}
          footer={
            <Button
              variant="primary"
              onClick={async () => {
                await m.create({ homework_id: open, student_id: student.id, text, file_url: url || null, status: 'submitted' })
                toast.success(t('common.saved'))
                setOpen(null)
                setText('')
                setUrl('')
              }}
            >
              {t('common.send')}
            </Button>
          }
        >
          <Field label={t('hw.answer')}>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} />
          </Field>
          <Field label={t('common.url')}>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://drive.google.com/..." />
          </Field>
        </Modal>
      )}
    </>
  )
}

export function MyPayments() {
  const t = useT()
  const { student } = useMyStudent()
  const L = useLookups()
  const payments = useRows('payments')
  const charges = useRows('charges')
  if (!student) return <Empty />
  const mine = payments.filter((p) => p.student_id === student.id).sort((a, b) => b.paid_at.localeCompare(a.paid_at))
  const myCharges = charges.filter((c) => c.student_id === student.id).sort((a, b) => b.month.localeCompare(a.month))
  const balance = studentBalance(student.id, payments, charges)
  return (
    <>
      <PageHead title={t('nav.myPayments')} actions={<PayOnline studentId={student.id} amount={-balance} />} />
      <div className="grid grid-stats mb">
        <Stat icon={<Wallet size={20} />} color={balance < 0 ? '#dc2626' : '#12a150'} label={t('common.balance')} value={money(balance)} />
      </div>
      <div className="grid grid-2">
        <Card title={t('pay.charges')}>
          <DataTable
            rows={myCharges}
            columns={[
              { key: 'month', label: t('common.month'), render: (c) => monthLabel(c.month) },
              { key: 'group', label: t('nav.groups'), render: (c) => L.groups.get(c.group_id)?.name },
              { key: 'amount', label: t('common.amount'), num: true, render: (c) => money(c.amount) },
            ]}
          />
        </Card>
        <Card title={t('pay.paid')}>
          <DataTable
            rows={mine}
            columns={[
              { key: 'paid_at', label: t('common.date'), render: (p) => date(p.paid_at) },
              { key: 'method', label: t('common.method'), render: (p) => methodLabel(t, p.method) },
              { key: 'amount', label: t('common.amount'), num: true, render: (p) => <span className={p.status === 'completed' ? 'green bold' : 'muted'}>{money(p.amount)}</span> },
            ]}
          />
        </Card>
      </div>
    </>
  )
}
