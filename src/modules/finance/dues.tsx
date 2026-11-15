// To'lov sanalari: holat belgilari, to'lov kunini o'zgartirish va mavjud hisoblar muddatini yangilash
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useT } from '@/lib/i18n'
import { useRows } from '@/lib/data'
import { db } from '@/lib/db'
import { useToast } from '@/components/Toast'
import { Badge, Button, Field, Input, Modal, type Tone } from '@/components/ui'
import { date, monthISO } from '@/lib/format'
import { dueDateFor, paymentDayFor, type ChargeInfo, type ChargeState } from '@/lib/finance'
import type { Enrollment, Group } from '@/lib/types'
import { useCenterDay } from '../shared'

export const DUE_TONE: Record<ChargeState, Tone> = { paid: 'green', upcoming: 'blue', today: 'yellow', overdue: 'red' }

/** "To'langan" / "Kutilmoqda · 3 kun qoldi" / "Bugun" / "To'lanmagan · 5 kun o'tdi" */
export function DueBadge({ info, short }: { info: ChargeInfo; short?: boolean }) {
  const t = useT()
  const days =
    info.state === 'upcoming' ? t('pay.daysLeft').replace('{n}', String(info.days)) : info.state === 'overdue' ? t('pay.daysLate').replace('{n}', String(-info.days)) : ''
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

/** O'quvchining shaxsiy to'lov kuni (bo'sh — guruh kuni) */
export function PaymentDayModal({ enrollment, group, onClose }: { enrollment: Enrollment; group: Group; onClose: () => void }) {
  const t = useT()
  const qc = useQueryClient()
  const toast = useToast()
  const sync = useSyncDueDates()
  const centerDay = useCenterDay()
  const groupDay = paymentDayFor(null, group, centerDay)
  const startDay = Number(enrollment.start_date.slice(8, 10))
  const [v, setV] = useState(enrollment.payment_day ? String(enrollment.payment_day) : '')
  const [busy, setBusy] = useState(false)
  const n = Number(v)
  const valid = v === '' || (Number.isInteger(n) && n >= 1 && n <= 31)

  const save = async () => {
    setBusy(true)
    try {
      const payment_day = v === '' ? null : n
      await db.update('enrollments', enrollment.id, { payment_day })
      qc.invalidateQueries({ queryKey: ['enrollments'] })
      await sync(group, { ...enrollment, payment_day })
      toast.success(t('pay.dayUpdated'))
      onClose()
    } catch (e: any) {
      toast.error(e?.message || t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={t('pay.paymentDay')}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!valid || busy} onClick={save}>{t('common.save')}</Button>
        </>
      }
    >
      <p className="muted mb">{group.name}</p>
      <Field label={t('pay.paymentDay')} hint={t('pay.paymentDayStudentHint').replace('{n}', String(groupDay))}>
        <Input type="number" min={1} max={31} value={v} placeholder={String(groupDay)} onChange={(e) => setV(e.target.value)} />
      </Field>
      <div className="row-wrap mt">
        <Button size="sm" onClick={() => setV('')}>{t('pay.groupDay').replace('{n}', String(groupDay))}</Button>
        {startDay !== groupDay && <Button size="sm" onClick={() => setV(String(startDay))}>{t('pay.fromStartDay').replace('{n}', String(startDay))}</Button>}
      </div>
    </Modal>
  )
}
