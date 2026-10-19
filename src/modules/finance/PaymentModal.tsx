import { useMemo, useState } from 'react'
import { Printer } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useMutate, useRows } from '@/lib/data'
import { useMe } from '@/lib/auth'
import { useMessenger } from '@/lib/messaging'
import { useToast } from '@/components/Toast'
import { Button, Checkbox, Field, Input, Modal, Select, Textarea } from '@/components/ui'
import { date, money, monthISO, monthLabel, todayISO } from '@/lib/format'
import { studentBalance } from '@/lib/finance'
import { payMethodOptions, useOptions, useLookups } from '../shared'
import type { Payment, PayMethod } from '@/lib/types'

export function PaymentModal({ studentId, onClose }: { studentId?: string; onClose: () => void }) {
  const t = useT()
  const me = useMe()
  const toast = useToast()
  const opts = useOptions()
  const L = useLookups()
  const enrollments = useRows('enrollments')
  const payments = useRows('payments')
  const charges = useRows('charges')
  const m = useMutate('payments')
  const { sendTrigger } = useMessenger()

  const [sid, setSid] = useState(studentId ?? '')
  const myGroups = enrollments.filter((e) => e.student_id === sid && e.status !== 'left')
  const balance = sid ? studentBalance(sid, payments, charges) : 0
  const [v, setV] = useState({
    group_id: '',
    amount: '',
    method: 'cash' as PayMethod,
    paid_at: todayISO(),
    month: monthISO(),
    note: '',
  })
  const [notify, setNotify] = useState(true)
  const [receipt, setReceipt] = useState<Payment | null>(null)
  const groupId = v.group_id || myGroups[0]?.group_id || ''

  const suggested = useMemo(() => (balance < 0 ? -balance : 0), [balance])

  const save = async () => {
    const amount = Number(v.amount || suggested)
    if (!sid || !amount) return
    const st = L.students.get(sid)
    const p = await m.create({
      student_id: sid,
      group_id: groupId || null,
      amount,
      method: v.method,
      paid_at: v.paid_at,
      month: v.month,
      status: 'completed',
      received_by: me.id,
      branch_id: st?.branch_id ?? null,
      note: v.note || null,
    })
    if (notify && st) {
      await sendTrigger('payment_received', [{ phone: st.phone, telegram_chat_id: st.telegram_chat_id, name: st.full_name, vars: { amount: money(amount) } }])
    }
    toast.success(t('common.saved'))
    setReceipt(p)
  }

  if (receipt) return <ReceiptModal payment={receipt} onClose={onClose} />

  return (
    <Modal
      title={t('pay.add')}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!sid || m.busy} onClick={save}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label={t('role.student') + ' *'} full>
          <Select value={sid} options={opts.students} placeholder={t('common.select')} onChange={(e) => setSid(e.target.value)} disabled={!!studentId} />
        </Field>
        {sid && (
          <div className="full row between card" style={{ padding: '10px 14px' }}>
            <span className="muted">{t('common.balance')}</span>
            <b className={balance < 0 ? 'red' : 'green'}>{money(balance)}</b>
          </div>
        )}
        <Field label={t('nav.groups')}>
          <Select value={groupId} options={myGroups.map((e) => ({ value: e.group_id, label: L.groups.get(e.group_id)?.name || '' }))} placeholder="—" onChange={(e) => setV({ ...v, group_id: e.target.value })} />
        </Field>
        <Field label={t('common.amount') + ' *'}>
          <Input type="number" step={1000} value={v.amount} placeholder={suggested ? String(suggested) : ''} onChange={(e) => setV({ ...v, amount: e.target.value })} />
        </Field>
        <Field label={t('common.method')}>
          <Select value={v.method} options={payMethodOptions(t)} onChange={(e) => setV({ ...v, method: e.target.value as PayMethod })} />
        </Field>
        <Field label={t('pay.forMonth')}>
          <Input type="month" value={v.month} onChange={(e) => setV({ ...v, month: e.target.value })} />
        </Field>
        <Field label={t('common.date')}>
          <Input type="date" value={v.paid_at} onChange={(e) => setV({ ...v, paid_at: e.target.value })} />
        </Field>
        <Field label={t('common.note')} full>
          <Textarea rows={2} value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} />
        </Field>
        <div className="full">
          <Checkbox label={t('msg.trigger.payment_received') + ' — SMS/Telegram'} checked={notify} onChange={setNotify} />
        </div>
      </div>
    </Modal>
  )
}

export function ReceiptModal({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const t = useT()
  const L = useLookups()
  const s = L.students.get(payment.student_id)
  return (
    <Modal
      title={t('pay.receipt')}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('common.close')}</Button>
          <Button variant="primary" icon={<Printer size={16} />} onClick={() => window.print()}>
            {t('common.print')}
          </Button>
        </>
      }
    >
      <div className="receipt printable">
        <div style={{ textAlign: 'center', fontWeight: 700 }}>LOLA EDU</div>
        <div style={{ textAlign: 'center' }}>Türk Dili Markazi</div>
        <div>--------------------------------</div>
        <div className="line"><span>№</span><span>{payment.id.slice(0, 8).toUpperCase()}</span></div>
        <div className="line"><span>{t('common.date')}</span><span>{date(payment.paid_at)}</span></div>
        <div className="line"><span>{t('role.student')}</span><span>{s?.full_name}</span></div>
        {payment.group_id && <div className="line"><span>{t('nav.groups')}</span><span>{L.groups.get(payment.group_id)?.name}</span></div>}
        {payment.month && <div className="line"><span>{t('common.month')}</span><span>{monthLabel(payment.month)}</span></div>}
        <div className="line"><span>{t('common.method')}</span><span>{t('pay.method.' + payment.method)}</span></div>
        <div>--------------------------------</div>
        <div className="line" style={{ fontWeight: 700, fontSize: '1rem' }}><span>{t('common.total')}</span><span>{money(payment.amount)}</span></div>
        <div>--------------------------------</div>
        <div style={{ textAlign: 'center' }}>Teşekkürler! / Rahmat!</div>
      </div>
    </Modal>
  )
}
