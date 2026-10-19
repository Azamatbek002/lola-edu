import { useMemo, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Printer } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useRows } from '@/lib/data'
import { Badge, Button, Card, PageHead, Select, Stat } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { addMonths, downloadCSV, money, moneyShort, monthISO, monthLabel, monthShort, pct } from '@/lib/format'
import { monthlyPnL, sumCharges, sumPayments } from '@/lib/finance'
import { attendanceRate } from '@/lib/analytics'
import { useLookups } from '../shared'
import { TrendingUp, Wallet, Percent, Receipt } from 'lucide-react'

const tip = { borderRadius: 10, background: 'var(--card)', border: '1px solid var(--border)' }

export default function ReportsPage() {
  const t = useT()
  const L = useLookups()
  const [n, setN] = useState(6)
  const payments = useRows('payments')
  const expenses = useRows('expenses')
  const payouts = useRows('salary_payouts')
  const charges = useRows('charges')
  const enrollments = useRows('enrollments')
  const groups = useRows('groups')
  const attendance = useRows('attendance')
  const branches = useRows('branches')
  const teachers = useRows('profiles').filter((p) => p.role === 'teacher')
  const month = monthISO()
  const months = useMemo(() => Array.from({ length: n }, (_, i) => addMonths(month, i - n + 1)), [n, month])

  const pnl = useMemo(() => monthlyPnL(months, payments, expenses, payouts), [months, payments, expenses, payouts])
  const totals = pnl.reduce((a, r) => ({ revenue: a.revenue + r.revenue, expenses: a.expenses + r.expenses + r.salaries, profit: a.profit + r.profit }), { revenue: 0, expenses: 0, profit: 0 })
  const periodPayments = payments.filter((p) => p.status === 'completed' && months.includes(p.paid_at.slice(0, 7)))
  const collection = pct(sumPayments(payments.filter((p) => p.month && months.includes(p.month))), sumCharges(charges.filter((c) => months.includes(c.month))))

  const flow = months.map((m) => ({
    name: monthShort(m),
    [t('rep.joined')]: enrollments.filter((e) => e.start_date.startsWith(m)).length,
    [t('rep.left')]: enrollments.filter((e) => e.status === 'left' && e.end_date?.startsWith(m)).length,
  }))

  const byBranch = branches.map((b) => {
    const p = sumPayments(periodPayments.filter((x) => x.branch_id === b.id))
    const e = expenses.filter((x) => x.branch_id === b.id && months.includes(x.date.slice(0, 7))).reduce((s, x) => s + x.amount, 0)
    return { id: b.id, name: b.name, revenue: p, expenses: e, profit: p - e }
  })

  const byTeacher = teachers.map((tc) => {
    const ids = new Set(groups.filter((g) => g.teacher_id === tc.id).map((g) => g.id))
    const rev = sumPayments(periodPayments.filter((p) => p.group_id && ids.has(p.group_id)))
    const students = new Set(enrollments.filter((e) => ids.has(e.group_id) && e.status === 'active').map((e) => e.student_id)).size
    const left = enrollments.filter((e) => ids.has(e.group_id) && e.status === 'left' && e.end_date && months.includes(e.end_date.slice(0, 7))).length
    return { id: tc.id, name: tc.full_name, revenue: rev, students, left, attendance: attendanceRate(attendance.filter((a) => ids.has(a.group_id) && months.includes(a.date.slice(0, 7)))) }
  })

  const reasons = [...enrollments.filter((e) => e.status === 'left' && e.left_reason).reduce((m, e) => m.set(e.left_reason!, (m.get(e.left_reason!) || 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1])

  const chart = pnl.map((r) => ({ name: monthShort(r.month), [t('rep.revenue')]: r.revenue, [t('rep.expenses')]: r.expenses, [t('rep.salaries')]: r.salaries, [t('rep.profit')]: r.profit }))

  return (
    <>
      <PageHead
        title={t('nav.reports')}
        actions={
          <>
            <Select style={{ width: 140 }} value={String(n)} onChange={(e) => setN(Number(e.target.value))} options={[3, 6, 12].map((x) => ({ value: String(x), label: `${x} ${t('rep.months')}` }))} />
            <Button className="hide-sm" onClick={() => downloadCSV('pnl.csv', [[t('common.month'), t('rep.revenue'), t('rep.expenses'), t('rep.salaries'), t('rep.profit')], ...pnl.map((r) => [r.month, r.revenue, r.expenses, r.salaries, r.profit])])}>{t('common.export')}</Button>
            <Button icon={<Printer size={15} />} className="hide-sm" onClick={() => window.print()}>{t('common.print')}</Button>
          </>
        }
      />
      <div className="grid grid-stats mb">
        <Stat icon={<Wallet size={20} />} color="#12a150" label={t('rep.revenue')} value={moneyShort(totals.revenue)} />
        <Stat icon={<Receipt size={20} />} color="#64748b" label={t('rep.expenses')} value={moneyShort(totals.expenses)} />
        <Stat icon={<TrendingUp size={20} />} label={t('rep.profit')} value={moneyShort(totals.profit)} sub={<span className="muted">{pct(totals.profit, totals.revenue)}%</span>} />
        <Stat icon={<Percent size={20} />} color="#2563eb" label={t('rep.collection')} value={collection + '%'} sub={<span className="muted">{t('rep.avgCheck')}: {moneyShort(periodPayments.length ? sumPayments(periodPayments) / periodPayments.length : 0)}</span>} />
      </div>
      <div className="grid grid-2 mb">
        <Card title={t('rep.pnl')}>
          <div className="card-body chart-box">
            <ResponsiveContainer>
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={moneyShort} fontSize={11} tickLine={false} axisLine={false} width={60} />
                <Tooltip formatter={(v: number) => money(v)} contentStyle={tip} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey={t('rep.revenue')} fill="#c0272d" radius={[5, 5, 0, 0]} />
                <Bar dataKey={t('rep.expenses')} stackId="e" fill="#94a3b8" />
                <Bar dataKey={t('rep.salaries')} stackId="e" fill="#475569" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title={t('rep.profit')}>
          <div className="card-body chart-box">
            <ResponsiveContainer>
              <AreaChart data={chart}>
                <defs>
                  <linearGradient id="gp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#12a150" stopOpacity={0.35} /><stop offset="100%" stopColor="#12a150" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={moneyShort} fontSize={11} tickLine={false} axisLine={false} width={60} />
                <Tooltip formatter={(v: number) => money(v)} contentStyle={tip} />
                <Area dataKey={t('rep.profit')} stroke="#12a150" strokeWidth={2} fill="url(#gp)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title={t('rep.studentFlow')}>
          <div className="card-body chart-box">
            <ResponsiveContainer>
              <LineChart data={flow}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} width={30} allowDecimals={false} />
                <Tooltip contentStyle={tip} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Line dataKey={t('rep.joined')} stroke="#12a150" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line dataKey={t('rep.left')} stroke="#c0272d" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title={t('rep.leaveReasons')}>
          {reasons.length === 0 && <div className="empty">{t('common.empty')}</div>}
          {reasons.map(([r, c]) => (
            <div key={r} className="list-item"><div className="grow">{r}</div><Badge tone="red">{c}</Badge></div>
          ))}
        </Card>
      </div>
      <div className="grid grid-2">
        <Card title={t('rep.byBranch')}>
          <DataTable
            rows={byBranch}
            columns={[
              { key: 'name', label: t('common.branch') },
              { key: 'revenue', label: t('rep.revenue'), num: true, render: (r) => money(r.revenue) },
              { key: 'expenses', label: t('rep.expenses'), num: true, render: (r) => money(r.expenses) },
              { key: 'profit', label: t('rep.profit'), num: true, render: (r) => <b className={r.profit < 0 ? 'red' : 'green'}>{money(r.profit)}</b> },
            ]}
          />
        </Card>
        <Card title={t('rep.byTeacher')}>
          <DataTable
            rows={byTeacher}
            initialSort={{ key: 'revenue', dir: -1 }}
            columns={[
              { key: 'name', label: t('role.teacher'), render: (r) => <b>{r.name}</b> },
              { key: 'students', label: t('group.students'), num: true },
              { key: 'left', label: t('rep.left'), num: true },
              { key: 'attendance', label: t('att.rate'), num: true, render: (r) => r.attendance + '%' },
              { key: 'revenue', label: t('rep.revenue'), num: true, render: (r) => money(r.revenue) },
            ]}
          />
        </Card>
      </div>
      <p className="small muted mt">{L.branches.size} {t('common.branch').toLowerCase()} · {monthLabel(months[0])} — {monthLabel(months[months.length - 1])}</p>
    </>
  )
}
