// To'lov sanalari: holat belgilari, to'lov kunini o'zgartirish va mavjud hisoblar muddatini yangilash
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useT } from '@/lib/i18n'
import { useRows } from '@/lib/data'
import { db } from '@/lib/db'
import { useToast } from '@/components/Toast'
import { Badge, Button, Field, Input, Modal, Tabs, type Tone } from '@/components/ui'
import { date, money, monthISO, monthLabel } from '@/lib/format'
import { dueDateFor, groupPrice, monthlyPriceFor, paymentDayFor, type ChargeInfo, type ChargeState } from '@/lib/finance'
import { useMe } from '@/lib/auth'
import { canEditAmount } from '@/lib/permissions'
import type { Charge, Enrollment, Group } from '@/lib/types'
import { useCenterDay, useLookups } from '../shared'

export const DUE_TONE: Record<ChargeState, Tone> = { paid: 'green', upcoming: 'blue', today: 'yellow', overdue: 'red' }

/** "To'langan" / "Kutilmoqda · 3 kun qoldi" / "Bugun" / "To'lanmagan · 5 kun o'tdi" */
export function DueBadge({ info, short }: { info: ChargeInfo; short?: boolean }) {
  const t = useT()
  const days =
    info.state === 'upcoming' ? t('pay.daysLeft').replace('{n}', String(info.days)) : info.state === 'overdue' ? t('pay.daysLate').replace('{n}', String(-info.days)) : ''
  if (info.charge.amount === 0) return <Badge tone="gray">{t('pay.free')}</Badge>
  return (
    <span className="col" style={{ gap: 2, alignItems: 'flex-start' }}>
      <Badge tone={DUE_TONE[info.state]}>
        {t('pay.state.' + info.state)}
        {days && !short ? ` · ${days}` : ''}
      </Badge>
      {info.state !== 'paid' && info.paid > 0 && <span className="small muted">{t('pay.partial')}</span>}
    </span>
  )
}

/** To'lov sanasi + qisqa izoh (qolgan / o'tgan kunlar) */
export function DueDate({ info }: { info: ChargeInfo }) {
  const t = useT()
  const cls = info.state === 'overdue' ? 'red bold' : info.state === 'today' ? 'bold' : ''
  return (
    <span className="col" style={{ gap: 2 }}>
      <span className={'nowrap ' + cls}>{date(info.charge.due_date)}</span>
      {info.state === 'upcoming' && <span className="small muted nowrap">{t('pay.daysLeft').replace('{n}', String(info.days))}</span>}
      {info.state === 'overdue' && <span className="small red nowrap">{t('pay.daysLate').replace('{n}', String(-info.days))}</span>}
    </span>
  )
}

export function everyMonth(t: ReturnType<typeof useT>, day: number) {
  return t('pay.everyMonth').replace('{n}', String(day))
}

/**
 * To'lov kuni o'zgarganda joriy va keyingi oylar hisoblarining muddatini yangilaydi.
 * O'tgan oylar tarixi o'zgarmaydi.
 */
export function useSyncDueDates() {
  const qc = useQueryClient()
  const charges = useRows('charges')
  const enrollments = useRows('enrollments')
  const centerDay = useCenterDay()
  return async (group: Pick<Group, 'id' | 'payment_day'>, onlyEnrollment?: Pick<Enrollment, 'id' | 'student_id' | 'start_date' | 'payment_day'>) => {
    const from = monthISO()
    const list = onlyEnrollment ? [onlyEnrollment] : enrollments.filter((e) => e.group_id === group.id && e.status !== 'left')
    let n = 0
    for (const e of list) {
      const day = paymentDayFor(e, group, centerDay)
      for (const c of charges) {
        if (c.student_id !== e.student_id || c.group_id !== group.id || c.month < from) continue
        const due = dueDateFor(c.month, day, e.start_date)
        if (due !== c.due_date) {
          await db.update('charges', c.id, { due_date: due })
          n++
        }
      }
    }
    if (n) qc.invalidateQueries({ queryKey: ['charges'] })
    return n
  }
}

/** O'quvchining guruhdagi to'lov sozlamalari: to'lov kuni va shaxsiy oylik narx */
export function PaymentDayModal({ enrollment, group, onClose }: { enrollment: Enrollment; group: Group; onClose: () => void }) {
  const t = useT()
  const me = useMe()
  const qc = useQueryClient()
  const toast = useToast()
  const sync = useSyncDueDates()
  const centerDay = useCenterDay()
  const courses = useRows('courses')
  const priceEditable = canEditAmount(me.role)
  const groupDay = paymentDayFor(null, group, centerDay)
  const gPrice = groupPrice(group, courses)
  const startDay = Number(enrollment.start_date.slice(8, 10))
  const [v, setV] = useState(enrollment.payment_day ? String(enrollment.payment_day) : '')
  const hasCustom = enrollment.monthly_price != null || !!enrollment.discount_percent || !!enrollment.discount_amount
  const [price, setPrice] = useState(hasCustom ? String(monthlyPriceFor(enrollment, group, courses)) : '')
  const [busy, setBusy] = useState(false)
  const n = Number(v)
  const valid = v === '' || (Number.isInteger(n) && n >= 1 && n <= 31)
  const p = Number(price)
  const priceValid = price === '' || (Number.isFinite(p) && p >= 0)

  const save = async () => {
    setBusy(true)
    try {
      const payment_day = v === '' ? null : n
      const patch: Partial<Enrollment> = { payment_day }
      if (priceEditable) {
        const newPrice = price === '' ? null : p
        const curPrice = hasCustom ? monthlyPriceFor(enrollment, group, courses) : null
        // Narx o'zgargan bo'lsa: shaxsiy narx yoziladi, eski chegirmalar unga qo'shilgan hisoblanadi
        if (newPrice !== curPrice) Object.assign(patch, { monthly_price: newPrice, discount_percent: 0, discount_amount: 0 })
      }
      await db.update('enrollments', enrollment.id, patch)
      qc.invalidateQueries({ queryKey: ['enrollments'] })
      if ((enrollment.payment_day ?? null) !== payment_day) await sync(group, { ...enrollment, payment_day })
      toast.success(t('common.saved'))
      onClose()
    } catch (e: any) {
      toast.error(e?.message || t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={t('pay.settings')}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!valid || !priceValid || busy} onClick={save}>{t('common.save')}</Button>
        </>
      }
    >
      <p className="muted mb">{group.name}</p>
      <div className="form-grid">
        <Field label={t('pay.paymentDay')} hint={t('pay.paymentDayStudentHint').replace('{n}', String(groupDay))}>
          <Input type="number" min={1} max={31} value={v} placeholder={String(groupDay)} onChange={(e) => setV(e.target.value)} />
          <div className="row-wrap" style={{ marginTop: 6, gap: 6 }}>
            <Button size="sm" onClick={() => setV('')}>{t('pay.groupDay').replace('{n}', String(groupDay))}</Button>
            {startDay !== groupDay && <Button size="sm" onClick={() => setV(String(startDay))}>{t('pay.fromStartDay').replace('{n}', String(startDay))}</Button>}
          </div>
        </Field>
        {priceEditable && (
          <Field label={t('pay.monthlyPrice')} hint={t('pay.monthlyPriceHint').replace('{n}', money(gPrice))}>
            <Input type="number" min={0} step={1000} inputMode="numeric" value={price} placeholder={String(gPrice)} onChange={(e) => setPrice(e.target.value)} />
          </Field>
        )}
      </div>
    </Modal>
  )
}

/**
 * Oylik summani tahrirlash: shu oy hisobini o'zgartiradi va xohlasa keyingi oylar uchun
 * o'quvchining shaxsiy narxini belgilaydi (yoki guruh narxiga qaytaradi).
 */
export function EditChargeModal({ charge, onClose }: { charge: Charge; onClose: () => void }) {
  const t = useT()
  const qc = useQueryClient()
  const toast = useToast()
  const L = useLookups()
  const courses = useRows('courses')
  const enrollments = useRows('enrollments')
  const g = L.groups.get(charge.group_id)
  const s = L.students.get(charge.student_id)
  const e = enrollments.find((x) => x.student_id === charge.student_id && x.group_id === charge.group_id && x.status !== 'left') ?? enrollments.find((x) => x.student_id === charge.student_id && x.group_id === charge.group_id)
  const gPrice = g ? groupPrice(g, courses) : 0
  const current = e && g ? monthlyPriceFor(e, g, courses) : gPrice
  const custom = !!e && (e.monthly_price != null || !!e.discount_percent || !!e.discount_amount)
  const [amount, setAmount] = useState(String(charge.amount))
  const [note, setNote] = useState(charge.note ?? '')
  const [next, setNext] = useState<'keep' | 'same' | 'group'>('keep')
  const [busy, setBusy] = useState(false)
  const a = Number(amount)
  const valid = amount !== '' && Number.isFinite(a) && a >= 0

  const save = async () => {
    setBusy(true)
    try {
      if (a !== charge.amount || (note || null) !== (charge.note ?? null)) {
        const base = charge.amount + (charge.discount || 0)
        await db.update('charges', charge.id, { amount: a, discount: Math.max(0, base - a), note: note || null })
        qc.invalidateQueries({ queryKey: ['charges'] })
      }
      if (e && next !== 'keep') {
        await db.update('enrollments', e.id, { monthly_price: next === 'same' ? a : null, discount_percent: 0, discount_amount: 0 })
        qc.invalidateQueries({ queryKey: ['enrollments'] })
      }
      toast.success(t('common.saved'))
      onClose()
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={t('pay.editAmount')}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!valid || busy} onClick={save}>{t('common.save')}</Button>
        </>
      }
    >
      <div className="mb">
        <div className="bold">{s?.full_name}</div>
        <div className="small muted">
          {g?.name} · {monthLabel(charge.month)} · {t('pay.dueDate')}: {date(charge.due_date)}
        </div>
      </div>
      <div className="form-grid">
        <Field label={t('pay.amountFor').replace('{m}', monthLabel(charge.month))} full>
          <Input type="number" min={0} step={1000} inputMode="numeric" value={amount} onChange={(x) => setAmount(x.target.value)} autoFocus />
        </Field>
        <div className="full row-wrap" style={{ gap: 6, marginTop: -4 }}>
          {[gPrice, current]
            .filter((x, i, arr) => x > 0 && arr.indexOf(x) === i && x !== a)
            .map((x) => (
              <Button key={x} size="sm" onClick={() => setAmount(String(x))}>{money(x)}</Button>
            ))}
          {a !== 0 && <Button size="sm" onClick={() => setAmount('0')}>{t('pay.free')}</Button>}
        </div>
        <Field label={t('common.note')} full>
          <Input value={note} placeholder={t('pay.notePlaceholder')} onChange={(x) => setNote(x.target.value)} />
        </Field>
      </div>
      {e && (
        <div className="mt">
          <div className="small bold mb" style={{ marginBottom: 6 }}>{t('pay.nextMonths')}</div>
          <Tabs
            value={next}
            onChange={setNext}
            tabs={[
              { key: 'keep', label: t('pay.keepPrice').replace('{n}', money(current)) },
              ...(valid && a !== current ? [{ key: 'same' as const, label: t('pay.useEveryMonth').replace('{n}', money(a)) }] : []),
              ...(custom ? [{ key: 'group' as const, label: t('pay.backToGroup').replace('{n}', money(gPrice)) }] : []),
            ]}
          />
          <p className="small muted" style={{ marginTop: 6 }}>{t('pay.nextMonthsHint')}</p>
        </div>
      )}
    </Modal>
  )
}
