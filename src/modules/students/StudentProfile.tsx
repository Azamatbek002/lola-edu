import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, KeyRound, MessageSquare, Pencil, Phone, Plus, Snowflake, UserMinus, Wallet, CheckSquare } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useMe } from '@/lib/auth'
import { canEdit, canView } from '@/lib/permissions'
import { useMutate, useRows } from '@/lib/data'
import { useMessenger } from '@/lib/messaging'
import { useToast } from '@/components/Toast'
import { Avatar, Badge, Button, Card, Empty, Field, Input, Modal, Stat, Tabs, Textarea, Select } from '@/components/ui'
import { DataTable } from '@/components/DataTable'
import { EntityForm } from '@/crud/EntityForm'
import { age, date, money, monthISO, monthLabel, phone, todayISO } from '@/lib/format'
import { chargeForMonth, studentBalance } from '@/lib/finance'
import { attendanceRate } from '@/lib/analytics'
import { db } from '@/lib/db'
import { ATT_TONE, StudentStatusBadge, groupSchedule, methodLabel, useGroupStats, useLookups, useOptions } from '../shared'
import { studentFields } from './Students'
import { PaymentModal, ReceiptModal } from '../finance/PaymentModal'
import type { Enrollment, Payment } from '@/lib/types'

type Tab = 'groups' | 'payments' | 'attendance' | 'grades' | 'history'

export default function StudentProfile() {
  const { id = '' } = useParams()
  const t = useT()
  const me = useMe()
  const nav = useNavigate()
  const toast = useToast()
  const L = useLookups()
  const opts = useOptions()
  const students = useRows('students')
  const enrollments = useRows('enrollments')
  const payments = useRows('payments')
  const charges = useRows('charges')
  const attendance = useRows('attendance')
  const grades = useRows('grades')
  const audit = useRows('audit_log')
  const profiles = useRows('profiles')
  const sm = useMutate('students')
  const em = useMutate('enrollments')
  const pm = useMutate('payments')
  const { send } = useMessenger()
  const [tab, setTab] = useState<Tab>('groups')
  const [edit, setEdit] = useState(false)
  const [enroll, setEnroll] = useState(false)
  const [pay, setPay] = useState(false)
  const [msg, setMsg] = useState(false)
  const [leave, setLeave] = useState<Enrollment | null>(null)
  const [receipt, setReceipt] = useState<Payment | null>(null)
  const [access, setAccess] = useState(false)

  const s = students.find((x) => x.id === id)
  const myEnr = enrollments.filter((e) => e.student_id === id)
  const myPay = payments.filter((p) => p.student_id === id).sort((a, b) => b.paid_at.localeCompare(a.paid_at))
  const myCh = charges.filter((c) => c.student_id === id).sort((a, b) => b.month.localeCompare(a.month))
  const myAtt = attendance.filter((a) => a.student_id === id).sort((a, b) => b.date.localeCompare(a.date))
  const myGr = grades.filter((g) => g.student_id === id).sort((a, b) => b.date.localeCompare(a.date))
  const balance = useMemo(() => studentBalance(id, payments, charges), [id, payments, charges])
  const editable = canEdit(me.role, 'students')
  const canPay = canEdit(me.role, 'payments')
  const hasAccess = profiles.some((p) => p.student_id === id)

  if (!s) return <Empty />

  const setEnrStatus = async (e: Enrollment, status: Enrollment['status']) => {
    await em.update(e.id, { status })
    if (status === 'frozen' && !myEnr.some((x) => x.id !== e.id && x.status === 'active')) await sm.update(s.id, { status: 'frozen' })
    if (status === 'active' && s.status !== 'active') await sm.update(s.id, { status: 'active' })
    toast.success(t('common.saved'))
  }

  return (
    <>
      <div className="row mb">
        <Button variant="ghost" icon={<ArrowLeft size={18} />} onClick={() => nav(-1)} aria-label={t('common.back')} />
        <span className="muted">{t('student.profile')}</span>
      </div>
      <div className="grid grid-3 mb">
        <Card pad className="span-2">
          <div className="row" style={{ alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <Avatar name={s.full_name} size="lg" />
            <div style={{ flex: 1, minWidth: 220 }}>
              <div className="row-wrap">
                <h1>{s.full_name}</h1>
                <StudentStatusBadge s={s.status} />
                {s.level && <Badge tone="purple">{s.level}</Badge>}
              </div>
              <div className="row-wrap muted mt" style={{ marginTop: 6, gap: 16 }}>
                <span><Phone size={13} /> {phone(s.phone)}</span>
                {s.birth_date && <span>{date(s.birth_date)} ({age(s.birth_date)})</span>}
                <span>{L.branches.get(s.branch_id)?.name}</span>
                {s.source && <span>{t('common.source')}: {s.source}</span>}
              </div>
              {s.parent_name && (
                <div className="small mt" style={{ marginTop: 6 }}>
                  {t('role.parent')}: <b>{s.parent_name}</b> · {phone(s.parent_phone)}
                </div>
              )}
              {s.notes && <p className="small muted mt" style={{ marginTop: 6 }}>{s.notes}</p>}
            </div>
          </div>
          <div className="row-wrap mt">
            {editable && <Button icon={<Pencil size={15} />} onClick={() => setEdit(true)}>{t('common.edit')}</Button>}
            {editable && <Button icon={<Plus size={15} />} onClick={() => setEnroll(true)}>{t('student.enroll')}</Button>}
            {canPay && <Button variant="primary" icon={<Wallet size={15} />} onClick={() => setPay(true)}>{t('pay.add')}</Button>}
            {canView(me.role, 'messages') && <Button icon={<MessageSquare size={15} />} onClick={() => setMsg(true)}>{t('msg.compose')}</Button>}
            {editable && !hasAccess && <Button icon={<KeyRound size={15} />} onClick={() => setAccess(true)}>{t('student.portalAccess')}</Button>}
          </div>
        </Card>
        <div className="grid">
          <Stat icon={<Wallet size={20} />} color={balance < 0 ? '#dc2626' : '#12a150'} label={t('common.balance')} value={money(balance)} sub={balance < 0 ? <span className="red">{t('pay.debt')}</span> : undefined} />
          <Stat icon={<CheckSquare size={20} />} color="#2563eb" label={t('att.rate')} value={attendanceRate(myAtt) + '%'} />
        </div>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'groups', label: t('student.groups') },
          { key: 'payments', label: t('nav.payments') },
          { key: 'attendance', label: t('nav.attendance') },
          { key: 'grades', label: t('nav.grades') },
          { key: 'history', label: t('student.history') },
        ]}
      />

      {tab === 'groups' && (
        <Card>
          {myEnr.length === 0 && <Empty />}
          {myEnr.map((e) => {
            const g = L.groups.get(e.group_id)
            if (!g) return null
            return (
              <div key={e.id} className="list-item" style={{ flexWrap: 'wrap' }}>
                <span className="dot" style={{ background: L.courses.get(g.course_id)?.color || 'var(--brand)' }} />
                <div className="grow">
                  <div className="bold link" onClick={() => nav('/groups/' + g.id)}>{g.name}</div>
                  <div className="small muted">
                    {groupSchedule(t, g)} · {L.profiles.get(g.teacher_id || '')?.full_name} · {t('student.startDate')}: {date(e.start_date)}
                    {(e.discount_percent || e.discount_amount) ? ` · ${t('student.discount')}: ${e.discount_percent ? e.discount_percent + '%' : money(e.discount_amount)}` : ''}
                  </div>
                  {e.left_reason && <div className="small red">{e.left_reason}</div>}
                </div>
                <Badge tone={e.status === 'active' ? 'green' : e.status === 'frozen' ? 'yellow' : 'gray'}>{t('student.status.' + (e.status === 'finished' ? 'graduated' : e.status))}</Badge>
                {editable && e.status === 'active' && (
                  <>
                    <Button size="sm" icon={<Snowflake size={14} />} onClick={() => setEnrStatus(e, 'frozen')}>{t('student.freeze')}</Button>
                    <Button size="sm" variant="danger" icon={<UserMinus size={14} />} onClick={() => setLeave(e)}>{t('student.leave')}</Button>
                  </>
                )}
                {editable && e.status === 'frozen' && <Button size="sm" onClick={() => setEnrStatus(e, 'active')}>{t('student.unfreeze')}</Button>}
              </div>
            )
          })}
        </Card>
      )}

      {tab === 'payments' && (
        <div className="grid grid-2">
          <Card title={t('pay.charges')}>
            <DataTable
              rows={myCh}
              columns={[
                { key: 'month', label: t('common.month'), render: (c) => monthLabel(c.month) },
                { key: 'group', label: t('nav.groups'), render: (c) => L.groups.get(c.group_id)?.name },
                { key: 'discount', label: t('student.discount'), num: true, hideSm: true, render: (c) => (c.discount ? money(c.discount) : '—') },
                { key: 'amount', label: t('common.amount'), num: true, render: (c) => money(c.amount) },
              ]}
            />
          </Card>
          <Card title={t('pay.paid')}>
            <DataTable
              rows={myPay}
              columns={[
                { key: 'paid_at', label: t('common.date'), render: (p) => date(p.paid_at) },
                { key: 'method', label: t('common.method'), render: (p) => methodLabel(t, p.method) },
                { key: 'amount', label: t('common.amount'), num: true, render: (p) => <span className={p.status === 'completed' ? 'green bold' : 'muted'} style={{ textDecoration: p.status === 'refunded' || p.status === 'cancelled' ? 'line-through' : undefined }}>{money(p.amount)}</span> },
                {
                  key: 'act',
                  label: '',
                  sortable: false,
                  render: (p) => (
                    <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                      <Button size="sm" variant="ghost" onClick={() => setReceipt(p)}>{t('pay.receipt')}</Button>
                      {canPay && p.status === 'completed' && (me.role === 'owner' || me.role === 'admin' || me.role === 'accountant') && (
                        <Button size="sm" variant="ghost" onClick={() => pm.update(p.id, { status: 'refunded' })}>{t('pay.refund')}</Button>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        </div>
      )}

      {tab === 'attendance' && (
        <Card>
          <DataTable
            rows={myAtt}
            columns={[
              { key: 'date', label: t('common.date'), render: (a) => date(a.date) },
              { key: 'group', label: t('nav.groups'), render: (a) => L.groups.get(a.group_id)?.name },
              { key: 'status', label: t('common.status'), render: (a) => <Badge tone={ATT_TONE[a.status]}>{t('att.' + a.status)}</Badge> },
              { key: 'note', label: t('common.note'), hideSm: true },
            ]}
          />
        </Card>
      )}

      {tab === 'grades' && (
        <Card>
          <DataTable
            rows={myGr}
            columns={[
              { key: 'date', label: t('common.date'), render: (g) => date(g.date) },
              { key: 'title', label: t('grade.title') },
              { key: 'type', label: t('common.type'), render: (g) => t('grade.type.' + g.type) },
              { key: 'score', label: t('common.score'), num: true, render: (g) => <b>{g.score}/{g.max_score}</b> },
            ]}
          />
        </Card>
      )}

      {tab === 'history' && (
        <Card>
          <DataTable
            rows={audit.filter((a) => a.entity_id === id || myEnr.some((e) => e.id === a.entity_id) || myPay.some((p) => p.id === a.entity_id)).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))}
            columns={[
              { key: 'created_at', label: t('common.date'), render: (a) => date(a.created_at) },
              { key: 'user_name', label: t('audit.user') },
              { key: 'action', label: t('common.actions'), render: (a) => `${t('audit.' + a.action)} · ${a.entity}` },
            ]}
          />
        </Card>
      )}

      {edit && (
        <EntityForm
          title={t('common.edit')}
          fields={studentFields(t, opts)}
          initial={s}
          onClose={() => setEdit(false)}
          onSubmit={async (v) => {
            const { id: _id, created_at, ...patch } = v
            await sm.update(s.id, patch)
            toast.success(t('common.saved'))
            setEdit(false)
          }}
        />
      )}
      {enroll && <EnrollModal studentId={s.id} onClose={() => setEnroll(false)} />}
      {pay && <PaymentModal studentId={s.id} onClose={() => setPay(false)} />}
      {receipt && <ReceiptModal payment={receipt} onClose={() => setReceipt(null)} />}
      {leave && (
        <LeaveModal
          onClose={() => setLeave(null)}
          onSubmit={async (reason) => {
            await em.update(leave.id, { status: 'left', end_date: todayISO(), left_reason: reason })
            if (!myEnr.some((x) => x.id !== leave.id && x.status === 'active')) await sm.update(s.id, { status: 'left' })
            toast.success(t('common.saved'))
            setLeave(null)
          }}
        />
      )}
      {msg && (
        <QuickMessage
          onClose={() => setMsg(false)}
          onSend={async (text, toParent) => {
            const n = await send(text, [toParent ? { phone: s.parent_phone, telegram_chat_id: s.parent_telegram_chat_id, name: s.parent_name } : { phone: s.phone, telegram_chat_id: s.telegram_chat_id, name: s.full_name }])
            toast.success(`${n} ${t('msg.sent')}`)
            setMsg(false)
          }}
          hasParent={!!s.parent_phone}
        />
      )}
      {access && <PortalAccessModal studentId={s.id} name={s.full_name} phone={s.phone} parentName={s.parent_name} parentPhone={s.parent_phone} branchId={s.branch_id} onClose={() => setAccess(false)} />}
    </>
  )
}

export function EnrollModal({ studentId, groupId, onClose }: { studentId?: string; groupId?: string; onClose: () => void }) {
  const t = useT()
  const toast = useToast()
  const opts = useOptions()
  const L = useLookups()
  const gs = useGroupStats()
  const courses = useRows('courses')
  const enrollments = useRows('enrollments')
  const em = useMutate('enrollments')
  const cm = useMutate('charges')
  const sm = useMutate('students')
  const { sendTrigger } = useMessenger()
  const [v, setV] = useState({ student_id: studentId ?? '', group_id: groupId ?? '', start_date: todayISO(), discount_percent: '', discount_amount: '' })
  const g = L.groups.get(v.group_id)
  const already = enrollments.some((e) => e.student_id === v.student_id && e.group_id === v.group_id && e.status !== 'left')
  const full = g ? gs.count(g.id) >= g.capacity : false

  const preview = g
    ? chargeForMonth({ start_date: v.start_date, status: 'active', discount_percent: Number(v.discount_percent) || 0, discount_amount: Number(v.discount_amount) || 0 }, g, courses, monthISO())
    : null

  const save = async () => {
    if (!g || !v.student_id || already) return
    const e = await em.create({
      student_id: v.student_id,
      group_id: g.id,
      start_date: v.start_date,
      status: 'active',
      discount_percent: Number(v.discount_percent) || 0,
      discount_amount: Number(v.discount_amount) || 0,
    })
    // Joriy oy uchun proporsional hisob
    const month = monthISO()
    if (g.status === 'active' && v.start_date.slice(0, 7) <= month) {
      const c = chargeForMonth(e, g, courses, month)
      if (c.amount > 0) await cm.create({ student_id: v.student_id, group_id: g.id, month, amount: c.amount, discount: c.discount, due_date: month + '-10' })
    }
    const st = L.students.get(v.student_id)
    if (st && (st.status === 'trial' || st.status === 'left' || st.status === 'frozen')) await sm.update(st.id, { status: 'active' })
    if (st) await sendTrigger('welcome', [{ phone: st.phone, telegram_chat_id: st.telegram_chat_id, name: st.full_name, vars: { group: g.name, schedule: groupSchedule(t, g) } }])
    toast.success(t('common.saved'))
    onClose()
  }

  return (
    <Modal
      title={t('student.enroll')}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!g || !v.student_id || already} onClick={save}>{t('common.save')}</Button>
        </>
      }
    >
      <div className="form-grid">
        {!studentId && (
          <Field label={t('role.student') + ' *'} full>
            <Select value={v.student_id} options={opts.students} placeholder={t('common.select')} onChange={(e) => setV({ ...v, student_id: e.target.value })} />
          </Field>
        )}
        {!groupId && (
          <Field label={t('nav.groups') + ' *'} full>
            <Select value={v.group_id} options={opts.groups.map((o) => { const gg = L.groups.get(o.value)!; return { value: o.value, label: `${o.label} · ${gs.count(o.value)}/${gg.capacity} · ${groupSchedule(t, gg)}` } })} placeholder={t('common.select')} onChange={(e) => setV({ ...v, group_id: e.target.value })} />
          </Field>
        )}
        <Field label={t('student.startDate')}>
          <Input type="date" value={v.start_date} onChange={(e) => setV({ ...v, start_date: e.target.value })} />
        </Field>
        <div />
        <Field label={t('student.discountPercent')}>
          <Input type="number" min={0} max={100} value={v.discount_percent} onChange={(e) => setV({ ...v, discount_percent: e.target.value })} />
        </Field>
        <Field label={t('student.discountAmount')}>
          <Input type="number" min={0} step={1000} value={v.discount_amount} onChange={(e) => setV({ ...v, discount_amount: e.target.value })} />
        </Field>
        {already && <div className="full badge badge-red" style={{ padding: 8 }}>✗ {t('nav.groups')}: {g?.name}</div>}
        {full && <div className="full badge badge-yellow" style={{ padding: 8 }}>{t('group.full')}: {gs.count(g!.id)}/{g!.capacity}</div>}
        {preview && preview.lessons > 0 && (
          <div className="full card" style={{ padding: 12 }}>
            <div className="row between">
              <span className="muted">{monthLabel(monthISO())}: {preview.lessons}/{preview.total} {t('sal.lessons').toLowerCase()}</span>
              <b>{money(preview.amount)}</b>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

function LeaveModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (reason: string) => void }) {
  const t = useT()
  const [r, setR] = useState('')
  const reasons = ['Narx qimmat', "Vaqt to'g'ri kelmadi", "Ko'chib ketdi", "O'qituvchi yoqmadi", 'Maqsadiga erishdi', 'Boshqa markazga o‘tdi', 'Moliyaviy sabab']
  return (
    <Modal title={t('student.leave')} onClose={onClose} footer={<Button variant="primary" disabled={!r} onClick={() => onSubmit(r)}>{t('common.save')}</Button>}>
      <Field label={t('student.leaveReason')}>
        <Input list="leave-reasons" value={r} onChange={(e) => setR(e.target.value)} />
        <datalist id="leave-reasons">{reasons.map((x) => <option key={x} value={x} />)}</datalist>
      </Field>
    </Modal>
  )
}

export function QuickMessage({ onClose, onSend, hasParent }: { onClose: () => void; onSend: (text: string, toParent: boolean) => void; hasParent?: boolean }) {
  const t = useT()
  const [text, setText] = useState('')
  const [toParent, setToParent] = useState(false)
  return (
    <Modal title={t('msg.compose')} onClose={onClose} footer={<Button variant="primary" disabled={!text.trim()} onClick={() => onSend(text, toParent)}>{t('common.send')}</Button>}>
      {hasParent && (
        <Tabs value={toParent ? 'p' : 's'} onChange={(k) => setToParent(k === 'p')} tabs={[{ key: 's', label: t('role.student') }, { key: 'p', label: t('role.parent') }]} />
      )}
      <Field label={t('msg.text')}>
        <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      <div className="small muted">{text.length} / 160</div>
    </Modal>
  )
}

/** O'quvchi yoki ota-ona uchun portal hisobi yaratish */
function PortalAccessModal(p: { studentId: string; name: string; phone?: string; parentName?: string | null; parentPhone?: string | null; branchId: string; onClose: () => void }) {
  const t = useT()
  const toast = useToast()
  const qm = useMutate('profiles')
  const [forParent, setForParent] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(() => Math.random().toString(36).slice(2, 10))
  const save = async () => {
    const full_name = forParent ? p.parentName || t('role.parent') : p.name
    const phone = forParent ? p.parentPhone : p.phone
    const role = forParent ? 'parent' : 'student'
    if (db.mode === 'supabase') {
      const { supabase } = await import('@/lib/db')
      const { error } = await supabase!.functions.invoke('admin-users', { body: { action: 'create', email, password, full_name, phone, role, branch_id: p.branchId, student_id: p.studentId } })
      if (error) return toast.error(error.message)
    } else {
      await qm.create({ full_name, phone: phone ?? undefined, email, role, branch_id: p.branchId, student_id: p.studentId, is_active: true })
    }
    toast.success(t('common.saved'))
    p.onClose()
  }
  return (
    <Modal title={t('student.portalAccess')} onClose={p.onClose} footer={<Button variant="primary" disabled={!email} onClick={save}>{t('common.save')}</Button>}>
      {p.parentPhone && <Tabs value={forParent ? 'p' : 's'} onChange={(k) => setForParent(k === 'p')} tabs={[{ key: 's', label: t('role.student') }, { key: 'p', label: t('role.parent') }]} />}
      <div className="form-grid">
        <Field label={t('common.email')} full>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={t('staff.password')} full error={t('staff.passwordHint')}>
          <Input value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
