import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useT } from '@/lib/i18n'
import { useMe } from '@/lib/auth'
import { canEdit } from '@/lib/permissions'
import { useRows } from '@/lib/data'
import { db } from '@/lib/db'
import { useToast } from '@/components/Toast'
import { Avatar, Badge, Button, Card, MonthInput, PageHead, Stat } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { addMonths, money, monthISO, monthLabel, todayISO } from '@/lib/format'
import { calcTeacherSalary } from '@/lib/finance'
import { Banknote } from 'lucide-react'

export default function SalaryPage() {
  const t = useT()
  const me = useMe()
  const qc = useQueryClient()
  const toast = useToast()
  const [month, setMonth] = useState(addMonths(monthISO(), me.role === 'teacher' ? 0 : -1))
  const profiles = useRows('profiles')
  const groups = useRows('groups')
  const payments = useRows('payments')
  const lessons = useRows('lessons')
  const payouts = useRows('salary_payouts')
  const editable = canEdit(me.role, 'salary')
  const [adj, setAdj] = useState<Record<string, { bonus: string; deduction: string }>>({})

  const teachers = profiles.filter((p) => p.role === 'teacher' && p.is_active && (me.role !== 'teacher' || p.id === me.id))
  const rows = useMemo(
    () =>
      teachers.map((p) => {
        const c = calcTeacherSalary(p, month, groups, payments, lessons)
        const saved = payouts.find((x) => x.teacher_id === p.id && x.month === month)
        const bonus = Number(adj[p.id]?.bonus ?? saved?.bonus ?? 0)
        const deduction = Number(adj[p.id]?.deduction ?? saved?.deduction ?? 0)
        return { id: p.id, p, c, saved, bonus, deduction, total: (saved && saved.status === 'paid' ? saved.base : c.total) + bonus - deduction }
      }),
    [teachers, month, groups, payments, lessons, payouts, adj],
  )

  const save = async (r: (typeof rows)[number], pay: boolean) => {
    const data = { teacher_id: r.id, month, base: r.c.total, bonus: r.bonus, deduction: r.deduction, total: r.c.total + r.bonus - r.deduction, status: pay ? ('paid' as const) : ('draft' as const), paid_at: pay ? todayISO() : null }
    if (r.saved) await db.update('salary_payouts', r.saved.id, data)
    else await db.insert('salary_payouts', data)
    qc.invalidateQueries({ queryKey: ['salary_payouts'] })
    toast.success(pay ? t('sal.paid') : t('common.saved'))
  }

  const total = rows.reduce((s, r) => s + r.total, 0)
  const paid = rows.filter((r) => r.saved?.status === 'paid').reduce((s, r) => s + r.saved!.total, 0)

  return (
    <>
      <PageHead title={me.role === 'teacher' ? t('nav.salaryMine') : t('nav.salary')} subtitle={monthLabel(month)} actions={<MonthInput value={month} onChange={setMonth} />} />
      {me.role !== 'teacher' && (
        <div className="grid grid-stats mb">
          <Stat icon={<Banknote size={20} />} label={t('common.total')} value={money(total)} />
          <Stat icon={<Banknote size={20} />} color="#12a150" label={t('sal.paid')} value={money(paid)} />
        </div>
      )}
      <Card>
        <DataTable
          rows={rows}
          columns={[
            { key: 'name', label: t('role.teacher'), value: (r) => r.p.full_name, render: (r) => <div className="row"><Avatar name={r.p.full_name} /><div><div className="bold">{r.p.full_name}</div><div className="small muted">{t('staff.salary.' + (r.p.salary_type || 'fixed'))}</div></div></div> },
            { key: 'fixed', label: t('sal.base'), num: true, value: (r) => r.c.fixed, render: (r) => money(r.c.fixed) },
            { key: 'collected', label: t('sal.collected'), num: true, hideSm: true, value: (r) => r.c.collected, render: (r) => <span className="small">{money(r.c.collected)}{r.c.percentPart ? <><br /><b>{r.p.salary_percent}% = {money(r.c.percentPart)}</b></> : null}</span> },
            { key: 'lessons', label: t('sal.lessons'), num: true, hideSm: true, value: (r) => r.c.lessons, render: (r) => <span className="small">{r.c.lessons}{r.c.lessonPart ? <><br /><b>{money(r.c.lessonPart)}</b></> : null}</span> },
            {
              key: 'bonus',
              label: t('sal.bonus'),
              num: true,
              render: (r) =>
                editable && r.saved?.status !== 'paid' ? (
                  <input className="input" style={{ width: 110 }} type="number" step={10000} value={adj[r.id]?.bonus ?? r.bonus} onChange={(e) => setAdj({ ...adj, [r.id]: { bonus: e.target.value, deduction: adj[r.id]?.deduction ?? String(r.deduction) } })} />
                ) : money(r.bonus),
            },
            {
              key: 'deduction',
              label: t('sal.deduction'),
              num: true,
              render: (r) =>
                editable && r.saved?.status !== 'paid' ? (
                  <input className="input" style={{ width: 110 }} type="number" step={10000} value={adj[r.id]?.deduction ?? r.deduction} onChange={(e) => setAdj({ ...adj, [r.id]: { deduction: e.target.value, bonus: adj[r.id]?.bonus ?? String(r.bonus) } })} />
                ) : money(r.deduction),
            },
            { key: 'total', label: t('common.total'), num: true, render: (r) => <b style={{ fontSize: '1rem' }}>{money(r.total)}</b> },
            {
              key: 'status',
              label: '',
              sortable: false,
              render: (r) =>
                r.saved?.status === 'paid' ? (
                  <Badge tone="green">{t('sal.paid')}</Badge>
                ) : editable ? (
                  <div className="row" style={{ gap: 4 }}>
                    <Button size="sm" onClick={() => save(r, false)}>{t('sal.save')}</Button>
                    <Button size="sm" variant="primary" onClick={() => save(r, true)}>{t('sal.pay')}</Button>
                  </div>
                ) : (
                  <Badge>{r.saved ? t('sal.draft') : '—'}</Badge>
                ),
            },
          ]}
        />
      </Card>
    </>
  )
}
