import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Calculator, Plus, Wallet, CreditCard, Banknote, AlertTriangle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useT } from '@/lib/i18n'
import { useMe, useBranchFilter } from '@/lib/auth'
import { canEdit } from '@/lib/permissions'
import { useRows } from '@/lib/data'
import { db } from '@/lib/db'
import { useMessenger } from '@/lib/messaging'
import { useToast } from '@/components/Toast'
import { Avatar, Badge, Button, Card, Modal, MonthInput, PageHead, SearchInput, Select, Stat, Tabs } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { date, downloadCSV, money, moneyShort, monthISO, monthLabel, phone, todayISO } from '@/lib/format'
import { chargeForMonth, daysBetween, dueDateFor, paymentDayFor, sumBy, sumPayments } from '@/lib/finance'
import { methodLabel, payMethodOptions, useCenterDay, useCharges, useLookups } from '../shared'
import { PaymentModal, ReceiptModal } from './PaymentModal'
import { MonthlyDues } from './Monthly'
import { DueDate } from './dues'
import type { Charge, Payment } from '@/lib/types'

export default function PaymentsPage() {
  const t = useT()
  const me = useMe()
  const byBranch = useBranchFilter()
  const L = useLookups()
  const all = byBranch(useRows('payments'))
  const [month, setMonth] = useState(monthISO())
  const [method, setMethod] = useState('')
  const [q, setQ] = useState('')
  const [add, setAdd] = useState(false)
  const [gen, setGen] = useState(false)
  const [receipt, setReceipt] = useState<Payment | null>(null)
  const [tab, setTab] = useState<'monthly' | 'history'>(() => (new URLSearchParams(window.location.search).get('tab') === 'history' ? 'history' : 'monthly'))
  const editable = canEdit(me.role, 'payments')
  const canGenerate = editable && (me.role === 'owner' || me.role === 'admin' || me.role === 'accountant' || me.role === 'manager')
  const today = todayISO()
  const charges = useRows('charges')
  const chargeOf = useMemo(() => {
    const m = new Map<string, Charge>()
    for (const c of charges) {
      m.set(c.student_id + '|' + c.group_id + '|' + c.month, c)
      if (!m.has(c.student_id + '||' + c.month)) m.set(c.student_id + '||' + c.month, c)
    }
    return (p: Payment) => (p.month ? m.get(p.student_id + '|' + (p.group_id || '') + '|' + p.month) : undefined)
  }, [charges])

  const rows = useMemo(
    () =>
      all.filter(
        (p) =>
          p.paid_at.startsWith(month) &&
          (!method || p.method === method) &&
          (!q || (L.students.get(p.student_id)?.full_name ?? '').toLowerCase().includes(q.toLowerCase())),
      ),
    [all, month, method, q, L.students],
  )
  const total = sumPayments(rows)
  const todayTotal = sumPayments(all.filter((p) => p.paid_at === today))
  const cashToday = sumPayments(all.filter((p) => p.paid_at === today && p.method === 'cash'))
  const byMethod = sumBy(rows.filter((p) => p.status === 'completed'), (p) => p.method, (p) => p.amount)

  return (
    <>
      <PageHead
        title={t('nav.payments')}
        actions={
          <>
            <MonthInput value={month} onChange={setMonth} />
            {canGenerate && <Button icon={<Calculator size={15} />} onClick={() => setGen(true)}>{t('pay.generateCharges')}</Button>}
            {editable && <Button variant="primary" icon={<Plus size={16} />} onClick={() => setAdd(true)}>{t('pay.add')}</Button>}
          </>
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'monthly', label: t('pay.monthly') },
          { key: 'history', label: t('pay.history') },
        ]}
      />
      {tab === 'monthly' && <MonthlyDues month={month} onGenerate={canGenerate ? () => setGen(true) : undefined} />}
      {tab === 'history' && (
      <>
      <div className="grid grid-stats mb">
        <Stat icon={<Wallet size={20} />} color="#12a150" label={monthLabel(month)} value={moneyShort(total)} sub={<span className="muted">{rows.length} {t('common.count').toLowerCase()}</span>} />
        <Stat icon={<CreditCard size={20} />} color="#2563eb" label={t('common.today')} value={moneyShort(todayTotal)} />
        <Stat icon={<Banknote size={20} />} color="#d97706" label={t('pay.cashbox')} value={money(cashToday)} />
      </div>
      <div className="row-wrap mb">
        {byMethod.map((m) => (
          <Badge key={m.key} tone="gray">{methodLabel(t, m.key as any)}: <b>{money(m.value)}</b></Badge>
        ))}
      </div>
      <Card>
        <div className="card-head">
          <SearchInput value={q} onChange={setQ} />
          <div className="row-wrap">
            <Select style={{ width: 170 }} value={method} onChange={(e) => setMethod(e.target.value)} options={payMethodOptions(t)} placeholder={t('common.method') + ': ' + t('common.all')} />
            <Button className="hide-sm" onClick={() => downloadCSV(`payments-${month}.csv`, [[t('common.date'), t('role.student'), t('nav.groups'), t('common.method'), t('common.amount'), t('common.status')], ...rows.map((p) => [p.paid_at, L.students.get(p.student_id)?.full_name, L.groups.get(p.group_id || '')?.name, methodLabel(t, p.method), p.amount, t('pay.status.' + p.status)])])}>
              {t('common.export')}
            </Button>
          </div>
        </div>
        <DataTable
          rows={rows}
          initialSort={{ key: 'paid_at', dir: -1 }}
          onRowClick={setReceipt}
          columns={[
            { key: 'paid_at', label: t('common.date'), render: (p) => date(p.paid_at) },
            { key: 'student', label: t('role.student'), value: (p) => L.students.get(p.student_id)?.full_name, render: (p) => <div className="row"><Avatar name={L.students.get(p.student_id)?.full_name} /><b>{L.students.get(p.student_id)?.full_name}</b></div> },
            { key: 'group', label: t('nav.groups'), hideSm: true, value: (p) => L.groups.get(p.group_id || '')?.name, render: (p) => L.groups.get(p.group_id || '')?.name ?? '—' },
            { key: 'month', label: t('pay.forMonth'), hideSm: true, render: (p) => (p.month ? monthLabel(p.month) : '—') },
            { key: 'method', label: t('common.method'), render: (p) => <Badge>{methodLabel(t, p.method)}</Badge> },
            { key: 'received_by', label: t('pay.receivedBy'), hideSm: true, value: (p) => L.profiles.get(p.received_by || '')?.full_name, render: (p) => <span className="small">{L.profiles.get(p.received_by || '')?.full_name ?? (p.external_id ? 'Online' : '—')}</span> },
            {
              key: 'due',
              label: t('pay.dueDate'),
              hideSm: true,
              value: (p) => chargeOf(p)?.due_date,
              render: (p) => {
                const c = chargeOf(p)
                if (!c) return '—'
                const late = daysBetween(c.due_date, p.paid_at)
                return (
                  <span className="col" style={{ gap: 2 }}>
                    <span className="nowrap">{date(c.due_date)}</span>
                    {late > 0 ? <span className="small red nowrap">{t('pay.lateBy').replace('{n}', String(late))}</span> : <span className="small green nowrap">{late < 0 ? t('pay.early') : t('pay.onTime')}</span>}
                  </span>
                )
              },
            },
            { key: 'amount', label: t('common.amount'), num: true, render: (p) => <b className={p.status === 'completed' ? 'green' : 'muted'} style={{ textDecoration: p.status !== 'completed' ? 'line-through' : undefined }}>{money(p.amount)}</b> },
          ]}
        />
      </Card>
      </>
      )}
      {add && <PaymentModal onClose={() => setAdd(false)} />}
      {gen && <GenerateCharges onClose={() => setGen(false)} />}
      {receipt && <ReceiptModal payment={receipt} onClose={() => setReceipt(null)} />}
    </>
  )
}

function GenerateCharges({ onClose }: { onClose: () => void }) {
  const t = useT()
  const qc = useQueryClient()
  const toast = useToast()
  const enrollments = useRows('enrollments')
  const groups = useRows('groups')
  const courses = useRows('courses')
  const charges = useRows('charges')
  const centerDay = useCenterDay()
  const [month, setMonth] = useState(monthISO())
  const [busy, setBusy] = useState(false)

  const plan = useMemo(() => {
    const exists = new Set(charges.filter((c) => c.month === month).map((c) => c.student_id + c.group_id))
    return enrollments
      .filter((e) => (e.status === 'active' || e.status === 'left') && !exists.has(e.student_id + e.group_id))
      .map((e) => {
        const g = groups.find((x) => x.id === e.group_id)
        if (!g || g.status !== 'active') return null
        const c = chargeForMonth(e, g, courses, month)
        const due_date = dueDateFor(month, paymentDayFor(e, g, centerDay), e.start_date)
        return c.amount > 0 ? { student_id: e.student_id, group_id: g.id, month, amount: c.amount, discount: c.discount, due_date } : null
      })
      .filter(Boolean) as any[]
  }, [enrollments, groups, courses, charges, month, centerDay])

  const run = async () => {
    setBusy(true)
    await db.insertMany('charges', plan)
    qc.invalidateQueries({ queryKey: ['charges'] })
    toast.success(`${plan.length} ${t('pay.generated')}`)
    setBusy(false)
    onClose()
  }
  return (
    <Modal title={t('pay.generateCharges')} onClose={onClose} footer={<Button variant="primary" disabled={busy || !plan.length} onClick={run}>{t('sal.calc')} ({plan.length})</Button>}>
      <p className="muted mb">{t('pay.generateHint')}</p>
      <MonthInput value={month} onChange={setMonth} />
      <div className="mt row between card" style={{ padding: 12 }}>
        <span>{plan.length} {t('common.count').toLowerCase()}</span>
        <b>{money(plan.reduce((s, c) => s + c.amount, 0))}</b>
      </div>
    </Modal>
  )
}

export function DebtorsPage() {
  const t = useT()
  const me = useMe()
  const nav = useNavigate()
  const toast = useToast()
  const byBranch = useBranchFilter()
  const L = useLookups()
  const { list } = useCharges()
  const students = byBranch(useRows('students'))
  const groups = byBranch(useRows('groups'))
  const { sendTrigger } = useMessenger()
  const [pay, setPay] = useState<{ sid: string; gid: string; amount: number; month: string } | null>(null)
  const [group, setGroup] = useState('')

  const studentIds = useMemo(() => new Set(students.filter((s) => s.status !== 'left').map((s) => s.id)), [students])
  const overdue = useMemo(() => list.filter((i) => i.state === 'overdue' && studentIds.has(i.charge.student_id)), [list, studentIds])

  // Har bir guruh alohida: guruh → o'quvchi → muddati o'tgan summa va eng eski sana
  const sections = useMemo(() => {
    const byGroup = new Map<string, Map<string, { sid: string; debt: number; since: (typeof overdue)[number]; months: string[] }>>()
    for (const i of overdue) {
      const g = byGroup.get(i.charge.group_id) ?? new Map()
      byGroup.set(i.charge.group_id, g)
      const r = g.get(i.charge.student_id)
      if (!r) g.set(i.charge.student_id, { sid: i.charge.student_id, debt: i.left, since: i, months: [i.charge.month] })
      else {
        r.debt += i.left
        r.months.push(i.charge.month)
        if (i.charge.due_date < r.since.charge.due_date) r.since = i
      }
    }
    return groups
      .filter((g) => byGroup.has(g.id) && (!group || g.id === group))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((g) => {
        const rows = [...byGroup.get(g.id)!.values()].map((r) => ({ id: r.sid, ...r, s: L.students.get(r.sid)! })).filter((r) => r.s)
        return { g, rows, total: rows.reduce((x, r) => x + r.debt, 0) }
      })
  }, [overdue, groups, group, L.students])

  const total = sections.reduce((x, s) => x + s.total, 0)
  const debtors = new Set(sections.flatMap((s) => s.rows.map((r) => r.sid))).size
  const dueToday = list.filter((i) => i.state === 'today' && studentIds.has(i.charge.student_id)).length
  const dueSoon = list.filter((i) => i.state === 'upcoming' && i.days <= 3 && studentIds.has(i.charge.student_id)).length

  type Row = (typeof sections)[number]['rows'][number]
  const remind = async (rows: Row[]) => {
    const n = await sendTrigger(
      'debt_reminder',
      rows.map((r) => ({ phone: r.s.parent_phone || r.s.phone, telegram_chat_id: r.s.parent_telegram_chat_id || r.s.telegram_chat_id, name: r.s.full_name, vars: { amount: money(r.debt), month: r.months.map(monthLabel).join(', ') } })),
    )
    toast.success(`${n} ${t('msg.sent')}`)
  }

  return (
    <>
      <PageHead
        title={t('nav.debtors')}
        subtitle={t('pay.debtHint')}
        actions={sections.length > 0 && <Button variant="primary" icon={<Bell size={15} />} onClick={() => remind(sections.flatMap((s) => s.rows))}>{t('pay.remindAll')}</Button>}
      />
      <div className="grid grid-stats mb">
        <Stat icon={<AlertTriangle size={20} />} color="#dc2626" label={t('dash.totalDebt')} value={money(total)} />
        <Stat icon={<Wallet size={20} />} label={t('nav.debtors')} value={debtors} />
        <Stat icon={<Bell size={20} />} color="#d97706" label={t('pay.dueToday')} value={dueToday} />
        <Stat icon={<CreditCard size={20} />} color="#2563eb" label={t('pay.dueSoon')} value={dueSoon} />
      </div>
      <div className="row-wrap mb">
        <Select style={{ width: 230 }} value={group} onChange={(e) => setGroup(e.target.value)} options={groups.filter((g) => g.status === 'active' || g.status === 'forming').map((g) => ({ value: g.id, label: g.name }))} placeholder={t('pay.allGroups')} />
      </div>
      {sections.length === 0 && (
        <Card>
          <DataTable rows={[]} columns={[]} />
        </Card>
      )}
      {sections.map(({ g, rows, total: gTotal }) => (
        <Card
          key={g.id}
          className="mb"
          title={
            <div>
              <h3 className="link" onClick={() => nav('/groups/' + g.id)}>{g.name}</h3>
              <div className="small muted">{L.profiles.get(g.teacher_id || '')?.full_name}</div>
            </div>
          }
          actions={
            <>
              <b className="red nowrap">{money(gTotal)}</b>
              <Button size="sm" icon={<Bell size={14} />} onClick={() => remind(rows)}>{t('pay.remindAll')}</Button>
            </>
          }
        >
          <DataTable
            rows={rows}
            pageSize={100}
            initialSort={{ key: 'since', dir: 1 }}
            onRowClick={(r) => nav('/students/' + r.sid)}
            columns={[
              { key: 'full_name', label: t('common.fullName'), value: (r) => r.s.full_name, render: (r) => <div className="row"><Avatar name={r.s.full_name} /><div><div className="bold">{r.s.full_name}</div><div className="small muted">{phone(r.s.phone)}</div></div></div> },
              { key: 'parent', label: t('role.parent'), hideSm: true, value: (r) => r.s.parent_name, render: (r) => (r.s.parent_name ? <span className="small">{r.s.parent_name}<br />{phone(r.s.parent_phone)}</span> : '—') },
              { key: 'since', label: t('pay.dueDate'), value: (r) => r.since.charge.due_date, render: (r) => <DueDate info={r.since} /> },
              { key: 'debt', label: t('pay.debt'), num: true, value: (r) => r.debt, render: (r) => <b className="red">{money(r.debt)}</b> },
              {
                key: 'act',
                label: '',
                sortable: false,
                render: (r) => (
                  <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                    <a className="btn btn-sm btn-ghost" href={'tel:' + (r.s.parent_phone || r.s.phone)}>☎</a>
                    <Button size="sm" onClick={() => remind([r])}>{t('pay.remind')}</Button>
                    {canEdit(me.role, 'payments') && <Button size="sm" variant="primary" onClick={() => setPay({ sid: r.sid, gid: g.id, amount: r.debt, month: r.since.charge.month })}>{t('pay.take')}</Button>}
                  </div>
                ),
              },
            ]}
          />
        </Card>
      ))}
      {pay && <PaymentModal studentId={pay.sid} groupId={pay.gid} month={pay.month} amount={pay.amount} onClose={() => setPay(null)} />}
    </>
  )
}
