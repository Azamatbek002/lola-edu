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
import { Avatar, Badge, Button, Card, Modal, MonthInput, PageHead, SearchInput, Select, Stat } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { date, downloadCSV, money, moneyShort, monthISO, monthLabel, phone, todayISO } from '@/lib/format'
import { chargeForMonth, sumBy, sumPayments } from '@/lib/finance'
import { methodLabel, payMethodOptions, useBalances, useLookups } from '../shared'
import { PaymentModal, ReceiptModal } from './PaymentModal'
import type { Payment } from '@/lib/types'

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
  const editable = canEdit(me.role, 'payments')
  const today = todayISO()

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
            {editable && (me.role === 'owner' || me.role === 'admin' || me.role === 'accountant' || me.role === 'manager') && (
              <Button icon={<Calculator size={15} />} onClick={() => setGen(true)}>{t('pay.generateCharges')}</Button>
            )}
            {editable && <Button variant="primary" icon={<Plus size={16} />} onClick={() => setAdd(true)}>{t('pay.add')}</Button>}
          </>
        }
      />
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
            { key: 'amount', label: t('common.amount'), num: true, render: (p) => <b className={p.status === 'completed' ? 'green' : 'muted'} style={{ textDecoration: p.status !== 'completed' ? 'line-through' : undefined }}>{money(p.amount)}</b> },
          ]}
        />
      </Card>
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
        return c.amount > 0 ? { student_id: e.student_id, group_id: g.id, month, amount: c.amount, discount: c.discount, due_date: month + '-10' } : null
      })
      .filter(Boolean) as any[]
  }, [enrollments, groups, courses, charges, month])

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
  const balances = useBalances()
  const students = byBranch(useRows('students'))
  const enrollments = useRows('enrollments')
  const { sendTrigger } = useMessenger()
  const [pay, setPay] = useState<string | null>(null)
  const month = monthISO()

  const rows = useMemo(
    () =>
      students
        .filter((s) => s.status !== 'left' && (balances.get(s.id) || 0) < 0)
        .map((s) => ({ ...s, debt: -(balances.get(s.id) || 0), groups: enrollments.filter((e) => e.student_id === s.id && e.status !== 'left').map((e) => L.groups.get(e.group_id)?.name).join(', ') })),
    [students, balances, enrollments, L.groups],
  )
  const total = rows.reduce((s, r) => s + r.debt, 0)

  const remind = async (list: typeof rows) => {
    const n = await sendTrigger(
      'debt_reminder',
      list.map((s) => ({ phone: s.parent_phone || s.phone, telegram_chat_id: s.parent_telegram_chat_id || s.telegram_chat_id, name: s.full_name, vars: { amount: money(s.debt), month: monthLabel(month) } })),
    )
    toast.success(`${n} ${t('msg.sent')}`)
  }

  return (
    <>
      <PageHead
        title={t('nav.debtors')}
        subtitle={`${rows.length} · ${money(total)}`}
        actions={rows.length > 0 && <Button variant="primary" icon={<Bell size={15} />} onClick={() => remind(rows)}>{t('pay.remindAll')}</Button>}
      />
      <div className="grid grid-stats mb">
        <Stat icon={<AlertTriangle size={20} />} color="#dc2626" label={t('dash.totalDebt')} value={money(total)} />
        <Stat icon={<Wallet size={20} />} label={t('nav.debtors')} value={rows.length} />
      </div>
      <Card>
        <DataTable
          rows={rows}
          initialSort={{ key: 'debt', dir: -1 }}
          onRowClick={(r) => nav('/students/' + r.id)}
          columns={[
            { key: 'full_name', label: t('common.fullName'), render: (s) => <div className="row"><Avatar name={s.full_name} /><div><div className="bold">{s.full_name}</div><div className="small muted">{phone(s.phone)}</div></div></div> },
            { key: 'groups', label: t('student.groups'), hideSm: true },
            { key: 'parent', label: t('role.parent'), hideSm: true, value: (s) => s.parent_name, render: (s) => (s.parent_name ? <span className="small">{s.parent_name}<br />{phone(s.parent_phone)}</span> : '—') },
            { key: 'debt', label: t('pay.debt'), num: true, render: (s) => <b className="red">{money(s.debt)}</b> },
            {
              key: 'act',
              label: '',
              sortable: false,
              render: (s) => (
                <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                  <a className="btn btn-sm btn-ghost" href={'tel:' + (s.parent_phone || s.phone)}>☎</a>
                  <Button size="sm" onClick={() => remind([s])}>{t('pay.remind')}</Button>
                  {canEdit(me.role, 'payments') && <Button size="sm" variant="primary" onClick={() => setPay(s.id)}>{t('pay.add')}</Button>}
                </div>
              ),
            },
          ]}
        />
      </Card>
      {pay && <PaymentModal studentId={pay} onClose={() => setPay(null)} />}
    </>
  )
}
