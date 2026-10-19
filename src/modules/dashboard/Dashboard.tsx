import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, BookOpen, CalendarClock, CheckSquare, PhoneCall, Target, TrendingUp, Users, Wallet } from 'lucide-react'
import { useMe, useBranchFilter } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { useRows } from '@/lib/data'
import { canView } from '@/lib/permissions'
import { Badge, Card, Empty, PageHead, Stat, Avatar, Progress } from '@/components/ui'
import { addDays, addMonths, date, dayLabel, money, moneyShort, monthISO, monthShort, todayISO } from '@/lib/format'
import { monthlyPnL, sumPayments } from '@/lib/finance'
import { attendanceRate, atRiskStudents, conversionRate } from '@/lib/analytics'
import { hasLessonOn } from '@/lib/schedule'
import { useBalances, useGroupStats, useLookups } from '../shared'
import TeacherDashboard from './TeacherDashboard'
import PortalDashboard from '../portal/Portal'

export default function Dashboard() {
  const me = useMe()
  if (me.role === 'teacher') return <TeacherDashboard />
  if (me.role === 'student' || me.role === 'parent') return <PortalDashboard />
  return <StaffDashboard />
}

function StaffDashboard() {
  const me = useMe()
  const t = useT()
  const nav = useNavigate()
  const byBranch = useBranchFilter()
  const L = useLookups()
  const students = byBranch(useRows('students'))
  const groups = byBranch(useRows('groups'))
  const payments = byBranch(useRows('payments'))
  const expenses = byBranch(useRows('expenses'))
  const payouts = useRows('salary_payouts')
  const leads = byBranch(useRows('leads'))
  const attendance = useRows('attendance')
  const tasks = useRows('tasks')
  const events = useRows('events')
  const balances = useBalances()
  const gs = useGroupStats()

  const today = todayISO()
  const month = monthISO()
  const showFinance = canView(me.role, 'payments')
  const groupIds = useMemo(() => new Set(groups.map((g) => g.id)), [groups])

  const stats = useMemo(() => {
    const active = students.filter((s) => s.status === 'active')
    const debt = students.reduce((s, st) => s + Math.min(0, balances.get(st.id) || 0), 0)
    const monthRevenue = sumPayments(payments.filter((p) => p.paid_at.startsWith(month)))
    const prevRevenue = sumPayments(payments.filter((p) => p.paid_at.startsWith(addMonths(month, -1))))
    const since = addDays(today, -30)
    const recentLeads = leads.filter((l) => (l.created_at || '') >= since)
    const att = attendance.filter((a) => a.date >= since && groupIds.has(a.group_id))
    return {
      active: active.length,
      trial: students.filter((s) => s.status === 'trial').length,
      groups: groups.filter((g) => g.status === 'active').length,
      forming: groups.filter((g) => g.status === 'forming').length,
      debt: -debt,
      debtors: students.filter((s) => (balances.get(s.id) || 0) < 0 && s.status !== 'left').length,
      monthRevenue,
      growth: prevRevenue ? Math.round(((monthRevenue - prevRevenue) / prevRevenue) * 100) : 0,
      newLeads: recentLeads.length,
      conversion: conversionRate(recentLeads),
      attendance: attendanceRate(att),
    }
  }, [students, balances, payments, leads, attendance, groups, month, today, groupIds])

  const chart = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => addMonths(month, i - 5))
    return monthlyPnL(months, payments, expenses, payouts).map((r) => ({
      name: monthShort(r.month),
      [t('rep.revenue')]: r.revenue,
      [t('rep.expenses')]: r.expenses + r.salaries,
    }))
  }, [payments, expenses, payouts, month, t])

  const todayLessons = groups
    .filter((g) => g.status === 'active' && hasLessonOn(g, today))
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
  const markedToday = new Set(attendance.filter((a) => a.date === today).map((a) => a.group_id))
  const risk = useMemo(() => atRiskStudents(students, attendance).slice(0, 6), [students, attendance])
  const followups = leads
    .filter((l) => l.next_contact_at && l.next_contact_at <= today && !['won', 'lost'].includes(l.stage))
    .filter((l) => me.role !== 'sales' || l.assigned_to === me.id)
    .slice(0, 6)
  const myTasks = tasks.filter((x) => x.assigned_to === me.id && x.status !== 'done').slice(0, 5)
  const upcoming = events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4)

  return (
    <>
      <PageHead title={`${t('dash.welcome')}, ${me.full_name.split(' ')[0]}!`} subtitle={dayLabel(today)} />
      <div className="grid grid-stats mb">
        <Stat icon={<Users size={20} />} label={t('dash.activeStudents')} value={stats.active} sub={<span className="muted">+{stats.trial} {t('student.status.trial').toLowerCase()}</span>} />
        <Stat icon={<BookOpen size={20} />} color="#2563eb" label={t('dash.activeGroups')} value={stats.groups} sub={<span className="muted">+{stats.forming} {t('group.status.forming').toLowerCase()}</span>} />
        {showFinance && (
          <Stat
            icon={<Wallet size={20} />}
            color="#12a150"
            label={t('dash.monthRevenue')}
            value={moneyShort(stats.monthRevenue)}
            sub={<span className={stats.growth >= 0 ? 'green' : 'red'}>{stats.growth >= 0 ? '▲' : '▼'} {Math.abs(stats.growth)}%</span>}
          />
        )}
        {showFinance && (
          <Stat icon={<AlertTriangle size={20} />} color="#dc2626" label={t('dash.totalDebt')} value={moneyShort(stats.debt)} sub={<Link className="link" to="/finance/debtors">{stats.debtors} {t('nav.debtors').toLowerCase()} →</Link>} />
        )}
        {canView(me.role, 'leads') && (
          <Stat icon={<Target size={20} />} color="#7c3aed" label={t('dash.newLeads')} value={stats.newLeads} sub={<span className="muted">{t('dash.conversion')}: {stats.conversion}%</span>} />
        )}
        <Stat icon={<CheckSquare size={20} />} color="#d97706" label={t('dash.attendanceRate')} value={stats.attendance + '%'} />
      </div>

      <div className="grid grid-3 mb">
        {showFinance && (
          <Card title={t('dash.revenueChart')} className="span-2">
            <div className="card-body chart-box">
              <ResponsiveContainer>
                <BarChart data={chart} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickFormatter={(v) => moneyShort(v)} tickLine={false} axisLine={false} fontSize={11} width={60} />
                  <Tooltip formatter={(v: number) => money(v)} contentStyle={{ borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey={t('rep.revenue')} fill="#c0272d" radius={[6, 6, 0, 0]} />
                  <Bar dataKey={t('rep.expenses')} fill="#94a3b8" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
        <Card title={t('dash.todayLessons')} actions={<Badge tone="brand">{todayLessons.length}</Badge>} className={showFinance ? '' : 'span-2'}>
          {todayLessons.length === 0 && <Empty text={t('dash.noLessons')} icon={<CalendarClock size={30} />} />}
          {todayLessons.map((g) => (
            <div key={g.id} className="list-item" style={{ cursor: 'pointer' }} onClick={() => nav('/groups/' + g.id)}>
              <div className="bold" style={{ width: 48 }}>{g.start_time}</div>
              <div className="grow">
                <div className="bold ellipsis">{g.name}</div>
                <div className="small muted ellipsis">
                  {L.profiles.get(g.teacher_id || '')?.full_name} · {L.rooms.get(g.room_id || '')?.name} · {gs.count(g.id)} {t('group.students').toLowerCase()}
                </div>
              </div>
              {markedToday.has(g.id) ? <Badge tone="green">✓</Badge> : g.start_time < new Date().toTimeString().slice(0, 5) ? <Badge tone="yellow">{t('dash.lessonsMarked')}</Badge> : null}
            </div>
          ))}
        </Card>
      </div>

      <div className="grid grid-3">
        <Card title={<div><h3>{t('dash.atRisk')}</h3><div className="small muted">{t('dash.atRiskHint')}</div></div>}>
          {risk.length === 0 && <Empty />}
          {risk.map(({ student, streak, rate }) => (
            <div key={student.id} className="list-item" style={{ cursor: 'pointer' }} onClick={() => nav('/students/' + student.id)}>
              <Avatar name={student.full_name} />
              <div className="grow">
                <div className="bold ellipsis">{student.full_name}</div>
                <Progress value={rate} color={rate < 60 ? 'var(--red)' : 'var(--yellow)'} />
              </div>
              {streak > 0 && <Badge tone="red">{streak}× ✗</Badge>}
            </div>
          ))}
        </Card>
        {canView(me.role, 'leads') && (
          <Card title={t('dash.followups')} actions={<Link to="/leads" className="link small">{t('nav.leads')} →</Link>}>
            {followups.length === 0 && <Empty />}
            {followups.map((l) => (
              <div key={l.id} className="list-item">
                <PhoneCall size={16} className="brand" />
                <div className="grow">
                  <div className="bold ellipsis">{l.full_name}</div>
                  <div className="small muted">{l.phone} · {l.source}</div>
                </div>
                <a href={'tel:' + l.phone} className="btn btn-sm btn-secondary">☎</a>
              </div>
            ))}
          </Card>
        )}
        <Card title={t('dash.myTasks')} actions={<Link to="/tasks" className="link small">{t('nav.tasks')} →</Link>}>
          {myTasks.length === 0 && <Empty />}
          {myTasks.map((x) => (
            <div key={x.id} className="list-item">
              <span className="dot" style={{ background: x.priority === 'high' ? 'var(--red)' : x.priority === 'medium' ? '#f59e0b' : '#94a3b8' }} />
              <div className="grow ellipsis">{x.title}</div>
              <span className={'small ' + (x.due_date && x.due_date < today ? 'red' : 'muted')}>{date(x.due_date)}</span>
            </div>
          ))}
          {upcoming.length > 0 && (
            <>
              <div className="nav-section" style={{ color: 'var(--muted)', padding: '12px 18px 4px' }}>{t('dash.upcomingEvents')}</div>
              {upcoming.map((e) => (
                <div key={e.id} className="list-item">
                  <TrendingUp size={15} className="muted" />
                  <div className="grow ellipsis">{e.title}</div>
                  <span className="small muted">{date(e.date)}</span>
                </div>
              ))}
            </>
          )}
        </Card>
      </div>
    </>
  )
}

