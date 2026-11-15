// Oylik to'lovlar: har bir guruh alohida, har o'quvchi yonida to'lov sanasi va holati
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CalendarClock, CheckCircle2, Wallet, Calculator } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useMe, useBranchFilter } from '@/lib/auth'
import { canEdit, canView } from '@/lib/permissions'
import { useRows } from '@/lib/data'
import { Avatar, Badge, Button, Card, Empty, Progress, SearchInput, Select, Stat } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { money, moneyShort, phone } from '@/lib/format'
import { paymentDayFor, type ChargeInfo } from '@/lib/finance'
import { useCenterDay, useCharges, useLookups } from '../shared'
import { DueBadge, DueDate, everyMonth } from './dues'
import { PaymentModal } from './PaymentModal'

type StateFilter = '' | 'unpaid' | ChargeInfo['state']

export function MonthlyDues({ month, onGenerate }: { month: string; onGenerate?: () => void }) {
  const t = useT()
  const me = useMe()
  const nav = useNavigate()
  const byBranch = useBranchFilter()
  const L = useLookups()
  const groups = byBranch(useRows('groups'))
  const enrollments = useRows('enrollments')
  const { list } = useCharges()
  const centerDay = useCenterDay()
  const [group, setGroup] = useState('')
  const [state, setState] = useState<StateFilter>('')
  const [q, setQ] = useState('')
  const [pay, setPay] = useState<ChargeInfo | null>(null)
  const canPay = canEdit(me.role, 'payments')

  const groupIds = useMemo(() => new Set(groups.map((g) => g.id)), [groups])
  const monthList = useMemo(() => list.filter((i) => i.charge.month === month && groupIds.has(i.charge.group_id)), [list, month, groupIds])
  const scoped = group ? monthList.filter((i) => i.charge.group_id === group) : monthList

  const totals = useMemo(() => {
    const sum = (f: (i: ChargeInfo) => number, pred: (i: ChargeInfo) => boolean = () => true) => scoped.filter(pred).reduce((s, i) => s + f(i), 0)
    return {
      charged: sum((i) => i.charge.amount),
      paid: sum((i) => i.paid),
      overdue: sum((i) => i.left, (i) => i.state === 'overdue'),
      overdueN: scoped.filter((i) => i.state === 'overdue').length,
      expected: sum((i) => i.left, (i) => i.state === 'upcoming' || i.state === 'today'),
      todayN: scoped.filter((i) => i.state === 'today').length,
      paidN: scoped.filter((i) => i.state === 'paid').length,
    }
  }, [scoped])

  const match = (i: ChargeInfo) => {
    if (state === 'unpaid' ? i.state === 'paid' : state && i.state !== state) return false
    if (!q) return true
    return (L.students.get(i.charge.student_id)?.full_name ?? '').toLowerCase().includes(q.toLowerCase())
  }

  const sections = groups
    .filter((g) => (!group || g.id === group) && (g.status === 'active' || monthList.some((i) => i.charge.group_id === g.id)))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((g) => {
      const all = monthList.filter((i) => i.charge.group_id === g.id)
      const enr = new Map(enrollments.filter((e) => e.group_id === g.id).map((e) => [e.student_id, e]))
      const activeEnr = enrollments.some((e) => e.group_id === g.id && e.status === 'active')
      return { g, all, rows: all.filter(match), enr, activeEnr }
    })
    .filter((s) => s.rows.length > 0 || (!state && !q && s.all.length === 0 && s.activeEnr))

  return (
    <>
      <div className="grid grid-stats mb">
        <Stat icon={<Wallet size={20} />} label={t('pay.charges')} value={moneyShort(totals.charged)} sub={<span className="muted">{t('pay.paid')}: {moneyShort(totals.paid)}</span>} />
        <Stat icon={<CheckCircle2 size={20} />} color="#12a150" label={t('pay.state.paid')} value={`${totals.paidN} / ${scoped.length}`} />
        <Stat icon={<AlertTriangle size={20} />} color="#dc2626" label={t('pay.overdue')} value={money(totals.overdue)} sub={totals.overdueN ? <span className="red">{t('pay.nUnpaid').replace('{n}', String(totals.overdueN))}</span> : undefined} />
        <Stat icon={<CalendarClock size={20} />} color="#2563eb" label={t('pay.expected')} value={money(totals.expected)} sub={totals.todayN ? <span className="bold">{t('pay.dueToday')}: {totals.todayN}</span> : undefined} />
      </div>

      <div className="row-wrap mb">
        <SearchInput value={q} onChange={setQ} />
        <Select style={{ width: 230 }} value={group} onChange={(e) => setGroup(e.target.value)} options={groups.filter((g) => g.status === 'active' || g.status === 'forming').map((g) => ({ value: g.id, label: g.name }))} placeholder={t('pay.allGroups')} />
        <Select
          style={{ width: 210 }}
          value={state}
          onChange={(e) => setState(e.target.value as StateFilter)}
          options={[
            { value: 'unpaid', label: t('pay.state.unpaid') },
            { value: 'overdue', label: t('pay.state.overdue') },
            { value: 'today', label: t('pay.state.today') },
            { value: 'upcoming', label: t('pay.state.upcoming') },
            { value: 'paid', label: t('pay.state.paid') },
          ]}
          placeholder={t('common.status') + ': ' + t('common.all')}
        />
      </div>

      {sections.length === 0 && (
        <Card>
          <Empty />
        </Card>
      )}

      {sections.map(({ g, all, rows, enr }) => {
        const teacher = L.profiles.get(g.teacher_id || '')?.full_name
        const day = paymentDayFor(null, g, centerDay)
        const paidN = all.filter((i) => i.state === 'paid').length
        const charged = all.reduce((s, i) => s + i.charge.amount, 0)
        const paid = all.reduce((s, i) => s + i.paid, 0)
        const overdue = all.filter((i) => i.state === 'overdue').reduce((s, i) => s + i.left, 0)
        return (
          <Card
            key={g.id}
            className="mb"
            title={
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <span className="dot" style={{ background: L.courses.get(g.course_id)?.color || 'var(--brand)', marginTop: 6 }} />
                <div>
                  <h3 className="link" onClick={() => nav('/groups/' + g.id)}>{g.name}</h3>
                  <div className="small muted">
                    {teacher ? teacher + ' · ' : ''}
                    {t('pay.dueDate')}: <b>{everyMonth(t, day)}</b>
                  </div>
                </div>
              </div>
            }
            actions={
              all.length > 0 && (
                <div style={{ minWidth: 190 }}>
                  <div className="row between small" style={{ gap: 8 }}>
                    <b>{t('pay.paidOf').replace('{a}', String(paidN)).replace('{b}', String(all.length))}</b>
                    {overdue > 0 && <span className="red bold nowrap">−{money(overdue)}</span>}
                  </div>
                  <Progress value={charged ? (paid / charged) * 100 : 0} color={paid >= charged ? 'var(--green)' : undefined} />
                  <div className="small muted" style={{ marginTop: 2 }}>{money(paid)} / {money(charged)}</div>
                </div>
              )
            }
          >
            {all.length === 0 ? (
              <div className="card-body row between" style={{ flexWrap: 'wrap', gap: 8 }}>
                <span className="muted">{t('pay.notCharged')}</span>
                {onGenerate && <Button size="sm" icon={<Calculator size={14} />} onClick={onGenerate}>{t('pay.generateCharges')}</Button>}
              </div>
            ) : (
              <DataTable
                rows={rows.map((i) => ({ id: i.charge.id, i }))}
                pageSize={100}
                initialSort={{ key: 'due', dir: 1 }}
                onRowClick={canView(me.role, 'students') ? (r) => nav('/students/' + r.i.charge.student_id) : undefined}
                columns={[
                  {
                    key: 'name',
                    label: t('role.student'),
                    value: (r) => L.students.get(r.i.charge.student_id)?.full_name,
                    render: (r) => {
                      const s = L.students.get(r.i.charge.student_id)
                      return (
                        <div className="row" style={{ alignItems: 'flex-start' }}>
                          <Avatar name={s?.full_name} />
                          <div>
                            <div className="bold">{s?.full_name}</div>
                            <div className="small muted hide-sm">{phone(s?.parent_phone || s?.phone)}</div>
                            <div className="show-sm" style={{ marginTop: 2 }}>
                              <DueDate info={r.i} />
                            </div>
                          </div>
                        </div>
                      )
                    },
                  },
                  {
                    key: 'due',
                    label: t('pay.dueDate'),
                    hideSm: true,
                    value: (r) => r.i.charge.due_date + (L.students.get(r.i.charge.student_id)?.full_name ?? ''),
                    render: (r) => (
                      <span className="row" style={{ gap: 6, alignItems: 'flex-start' }}>
                        <DueDate info={r.i} />
                        {enr.get(r.i.charge.student_id)?.payment_day ? <Badge tone="purple">{t('pay.personal')}</Badge> : null}
                      </span>
                    ),
                  },
                  { key: 'amount', label: t('common.amount'), num: true, hideSm: true, value: (r) => r.i.charge.amount, render: (r) => money(r.i.charge.amount) },
                  { key: 'paid', label: t('pay.paid'), num: true, hideSm: true, value: (r) => r.i.paid, render: (r) => (r.i.paid ? <span className="green">{money(r.i.paid)}</span> : '—') },
                  { key: 'left', label: t('pay.remaining'), num: true, hideSm: true, value: (r) => r.i.left, render: (r) => (r.i.left ? <b className={r.i.state === 'overdue' ? 'red' : ''}>{money(r.i.left)}</b> : '—') },
                  { key: 'state', label: t('common.status'), value: (r) => ['overdue', 'today', 'upcoming', 'paid'].indexOf(r.i.state), render: (r) => (
                      <span>
                        <DueBadge info={r.i} short />
                        {r.i.left > 0 && <b className={'small show-sm ' + (r.i.state === 'overdue' ? 'red' : '')} style={{ marginTop: 2 }}>{money(r.i.left)}</b>}
                      </span>
                    ) },
                  {
                    key: 'act',
                    label: '',
                    sortable: false,
                    render: (r) =>
                      canPay && r.i.left > 0 ? (
                        <div className="row" style={{ justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" icon={<Wallet size={14} />} aria-label={t('pay.take')} title={t('pay.take')} variant={r.i.state === 'overdue' || r.i.state === 'today' ? 'primary' : 'secondary'} onClick={() => setPay(r.i)}>
                            <span className="hide-sm">{t('pay.take')}</span>
                          </Button>
                        </div>
                      ) : null,
                  },
                ]}
              />
            )}
          </Card>
        )
      })}

      {pay && <PaymentModal studentId={pay.charge.student_id} groupId={pay.charge.group_id} month={pay.charge.month} amount={pay.left} onClose={() => setPay(null)} />}
    </>
  )
}
