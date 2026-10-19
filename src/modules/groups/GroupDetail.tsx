import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckSquare, MessageSquare, Pencil, UserPlus, Star } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useMe } from '@/lib/auth'
import { canEdit, canView } from '@/lib/permissions'
import { useMutate, useRows } from '@/lib/data'
import { useMessenger } from '@/lib/messaging'
import { useToast } from '@/components/Toast'
import { Avatar, Badge, Button, Card, Empty, Stat, Tabs } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { EntityForm } from '@/crud/EntityForm'
import { addMonths, date, money, monthISO, monthLabel, phone, todayISO } from '@/lib/format'
import { lessonDatesInMonth } from '@/lib/schedule'
import { attendanceRate } from '@/lib/analytics'
import { ATT_TONE, GroupStatusBadge, groupSchedule, useBalances, useGroupStats, useLookups, useOptions } from '../shared'
import { groupFields, useGroupValidator } from './Groups'
import { EnrollModal, QuickMessage } from '../students/StudentProfile'

type Tab = 'students' | 'journal' | 'lessons' | 'grades'

export default function GroupDetail() {
  const { id = '' } = useParams()
  const t = useT()
  const me = useMe()
  const nav = useNavigate()
  const toast = useToast()
  const L = useLookups()
  const opts = useOptions()
  const gs = useGroupStats()
  const validate = useGroupValidator()
  const balances = useBalances()
  const groups = useRows('groups')
  const enrollments = useRows('enrollments')
  const attendance = useRows('attendance')
  const lessons = useRows('lessons')
  const grades = useRows('grades')
  const gm = useMutate('groups')
  const { send } = useMessenger()
  const [tab, setTab] = useState<Tab>('students')
  const [edit, setEdit] = useState(false)
  const [enroll, setEnroll] = useState(false)
  const [msg, setMsg] = useState(false)
  const [month, setMonth] = useState(monthISO())

  const g = groups.find((x) => x.id === id)
  const enr = enrollments.filter((e) => e.group_id === id && e.status !== 'left')
  const studs = enr.map((e) => ({ e, s: L.students.get(e.student_id)! })).filter((x) => x.s)
  const att = attendance.filter((a) => a.group_id === id)
  const gLessons = lessons.filter((l) => l.group_id === id).sort((a, b) => b.date.localeCompare(a.date))

  const journal = useMemo(() => {
    if (!g) return { dates: [] as string[], map: new Map<string, string>() }
    const dates = lessonDatesInMonth(g, month)
    const map = new Map(att.filter((a) => a.date.startsWith(month)).map((a) => [a.student_id + a.date, a.status]))
    return { dates, map }
  }, [g, month, att])

  if (!g) return <Empty />
  const course = L.courses.get(g.course_id)
  const editable = canEdit(me.role, 'groups')

  return (
    <>
      <div className="row mb">
        <Button variant="ghost" icon={<ArrowLeft size={18} />} onClick={() => nav(-1)} aria-label={t('common.back')} />
        <span className="muted">{t('nav.groups')}</span>
      </div>
      <div className="grid grid-3 mb">
        <Card pad className="span-2">
          <div className="row-wrap">
            <span className="dot" style={{ background: course?.color || 'var(--brand)', width: 14, height: 14 }} />
            <h1>{g.name}</h1>
            <GroupStatusBadge s={g.status} />
          </div>
          <div className="muted mt" style={{ marginTop: 6 }}>{course?.name}</div>
          <div className="row-wrap mt" style={{ gap: 18 }}>
            <span>🕒 {groupSchedule(t, g)}</span>
            <span>👤 {L.profiles.get(g.teacher_id || '')?.full_name ?? '—'}</span>
            <span>🚪 {L.rooms.get(g.room_id || '')?.name ?? '—'}</span>
            <span>📅 {date(g.start_date)}{g.end_date ? ' — ' + date(g.end_date) : ''}</span>
            <span>💰 {money(gs.price(g))}</span>
          </div>
          <div className="row-wrap mt">
            {canView(me.role, 'attendance') && <Button variant="primary" icon={<CheckSquare size={15} />} onClick={() => nav(`/attendance?group=${g.id}&date=${todayISO()}`)}>{t('att.mark')}</Button>}
            {canEdit(me.role, 'grades') && <Button icon={<Star size={15} />} onClick={() => nav(`/grades?group=${g.id}`)}>{t('grade.bulk')}</Button>}
            {editable && <Button icon={<UserPlus size={15} />} onClick={() => setEnroll(true)}>{t('student.enroll')}</Button>}
            {editable && <Button icon={<Pencil size={15} />} onClick={() => setEdit(true)}>{t('common.edit')}</Button>}
            {canView(me.role, 'messages') && <Button icon={<MessageSquare size={15} />} onClick={() => setMsg(true)}>{t('msg.compose')}</Button>}
          </div>
        </Card>
        <div className="grid">
          <Stat icon={<UserPlus size={20} />} label={t('group.students')} value={`${gs.count(g.id)} / ${g.capacity}`} />
          <Stat icon={<CheckSquare size={20} />} color="#12a150" label={t('att.rate')} value={attendanceRate(att) + '%'} />
        </div>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'students', label: `${t('group.students')} (${studs.length})` },
          { key: 'journal', label: t('group.journal') },
          { key: 'lessons', label: t('group.lessons') },
          { key: 'grades', label: t('nav.grades') },
        ]}
      />

      {tab === 'students' && (
        <Card>
          <DataTable
            rows={studs.map((x) => ({ id: x.s.id, ...x }))}
            onRowClick={(r) => canView(me.role, 'students') && nav('/students/' + r.id)}
            columns={[
              { key: 'name', label: t('common.fullName'), value: (r) => r.s.full_name, render: (r) => <div className="row"><Avatar name={r.s.full_name} /><div><div className="bold">{r.s.full_name}</div><div className="small muted">{phone(r.s.phone)}</div></div></div> },
              { key: 'since', label: t('student.startDate'), render: (r) => date(r.e.start_date), hideSm: true },
              { key: 'status', label: t('common.status'), render: (r) => <Badge tone={r.e.status === 'active' ? 'green' : 'yellow'}>{t('student.status.' + (r.e.status === 'finished' ? 'graduated' : r.e.status))}</Badge> },
              { key: 'att', label: t('att.rate'), num: true, value: (r) => attendanceRate(att.filter((a) => a.student_id === r.id)), render: (r) => attendanceRate(att.filter((a) => a.student_id === r.id)) + '%' },
              ...(canView(me.role, 'payments')
                ? [{ key: 'bal', label: t('common.balance'), num: true, value: (r: any) => balances.get(r.id) || 0, render: (r: any) => { const b = balances.get(r.id) || 0; return <b className={b < 0 ? 'red' : 'green'}>{money(b)}</b> } }]
                : []),
            ]}
          />
        </Card>
      )}

      {tab === 'journal' && (
        <Card
          title={monthLabel(month)}
          actions={
            <>
              <Button size="sm" onClick={() => setMonth(addMonths(month, -1))}>‹</Button>
              <Button size="sm" onClick={() => setMonth(monthISO())}>{t('common.today')}</Button>
              <Button size="sm" onClick={() => setMonth(addMonths(month, 1))}>›</Button>
            </>
          }
        >
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('common.fullName')}</th>
                  {journal.dates.map((d) => (
                    <th key={d} style={{ textAlign: 'center', padding: '10px 4px' }}>{d.slice(8)}</th>
                  ))}
                  <th className="num">%</th>
                </tr>
              </thead>
              <tbody>
                {studs.map(({ s }) => {
                  const rows = journal.dates.map((d) => journal.map.get(s.id + d))
                  const marked = rows.filter(Boolean) as string[]
                  const ok = marked.filter((x) => x === 'present' || x === 'late').length
                  return (
                    <tr key={s.id}>
                      <td className="nowrap bold">{s.full_name}</td>
                      {rows.map((st, i) => (
                        <td key={i} style={{ textAlign: 'center', padding: '8px 4px' }}>
                          {st ? <Badge tone={ATT_TONE[st as keyof typeof ATT_TONE]}>{st === 'present' ? '✓' : st === 'absent' ? '✗' : st === 'late' ? 'K' : 'S'}</Badge> : <span className="muted">·</span>}
                        </td>
                      ))}
                      <td className="num bold">{marked.length ? Math.round((ok / marked.length) * 100) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'lessons' && (
        <Card>
          <DataTable
            rows={gLessons}
            columns={[
              { key: 'date', label: t('common.date'), render: (l) => date(l.date) },
              { key: 'topic', label: t('att.topic') },
              { key: 'homework', label: t('att.homework'), hideSm: true },
              { key: 'status', label: t('common.status'), render: (l) => (l.status === 'done' ? <Badge tone="green">✓</Badge> : <Badge tone="gray">{t('att.cancelled')}</Badge>) },
            ]}
          />
        </Card>
      )}

      {tab === 'grades' && (
        <Card>
          <DataTable
            rows={grades.filter((x) => x.group_id === id).sort((a, b) => b.date.localeCompare(a.date))}
            columns={[
              { key: 'date', label: t('common.date'), render: (x) => date(x.date) },
              { key: 'student', label: t('role.student'), value: (x) => L.students.get(x.student_id)?.full_name, render: (x) => L.students.get(x.student_id)?.full_name },
              { key: 'title', label: t('grade.title') },
              { key: 'type', label: t('common.type'), render: (x) => t('grade.type.' + x.type), hideSm: true },
              { key: 'score', label: t('common.score'), num: true, render: (x) => <b>{x.score}/{x.max_score}</b> },
            ]}
          />
        </Card>
      )}

      {edit && (
        <EntityForm
          title={t('common.edit')}
          fields={groupFields(t, opts, g.branch_id)}
          initial={g}
          wide
          validate={validate}
          onClose={() => setEdit(false)}
          onSubmit={async (v) => {
            const { id: _i, created_at, ...patch } = v
            await gm.update(g.id, patch)
            toast.success(t('common.saved'))
            setEdit(false)
          }}
        />
      )}
      {enroll && <EnrollModal groupId={g.id} onClose={() => setEnroll(false)} />}
      {msg && (
        <QuickMessage
          hasParent
          onClose={() => setMsg(false)}
          onSend={async (text, toParent) => {
            const n = await send(
              text,
              studs.map(({ s }) => (toParent ? { phone: s.parent_phone, telegram_chat_id: s.parent_telegram_chat_id, name: s.parent_name, vars: { group: g.name } } : { phone: s.phone, telegram_chat_id: s.telegram_chat_id, name: s.full_name, vars: { group: g.name } })),
            )
            toast.success(`${n} ${t('msg.sent')}`)
            setMsg(false)
          }}
        />
      )}
    </>
  )
}
