// Payme Merchant API (JSON-RPC 2.0)
// Hujjat: https://developer.help.paycom.uz/protokol-merchant-api/
// Kassa sozlamasida endpoint: https://<project>.supabase.co/functions/v1/payme
// Hisob (account) maydoni: student_id. Summa tiyinlarda keladi.
import { adminClient, json, money, safeEqual, todayTashkent } from '../_shared/util.ts'

const KEY = Deno.env.get('PAYME_KEY') ?? '' // Kassa kaliti (test yoki prod)
const TIMEOUT = 43_200_000 // 12 soat
const MIN_AMOUNT = 1_000_00 // 1 000 so'm (tiyinda)
const MAX_AMOUNT = 100_000_000_00

const ERR = {
  auth: { code: -32504, message: { uz: "Ruxsat yo'q", ru: 'Недостаточно привилегий', en: 'Insufficient privileges' } },
  method: { code: -32601, message: { uz: 'Metod topilmadi', ru: 'Метод не найден', en: 'Method not found' } },
  parse: { code: -32700, message: { uz: 'JSON xato', ru: 'Ошибка парсинга', en: 'Parse error' } },
  amount: { code: -31001, message: { uz: "Noto'g'ri summa", ru: 'Неверная сумма', en: 'Invalid amount' } },
  notFound: { code: -31003, message: { uz: 'Tranzaksiya topilmadi', ru: 'Транзакция не найдена', en: 'Transaction not found' } },
  cantCancel: { code: -31007, message: { uz: 'Bekor qilib bo‘lmaydi', ru: 'Невозможно отменить', en: 'Unable to cancel' } },
  cantPerform: { code: -31008, message: { uz: "Bajarib bo'lmaydi", ru: 'Невозможно выполнить операцию', en: 'Unable to perform' } },
  account: { code: -31050, message: { uz: "O'quvchi topilmadi", ru: 'Студент не найден', en: 'Student not found' }, data: 'student_id' },
}

type Rpc = { id: number; method: string; params: any }

Deno.serve(async (req) => {
  let body: Rpc
  try {
    body = await req.json()
  } catch {
    return json({ error: ERR.parse, id: null })
  }
  const auth = req.headers.get('authorization') ?? ''
  const expected = 'Basic ' + btoa('Paycom:' + KEY)
  if (!KEY || !safeEqual(auth, expected)) return json({ error: ERR.auth, id: body.id })

  const db = adminClient()
  const ok = (result: unknown) => json({ result, id: body.id })
  const fail = (error: unknown) => json({ error, id: body.id })
  const p = body.params ?? {}

  const findStudent = async (account: any) => {
    const sid = account?.student_id
    if (!sid || !/^[0-9a-f-]{36}$/i.test(sid)) return null
    const { data } = await db.from('students').select('id, full_name, phone, telegram_chat_id, branch_id, status').eq('id', sid).maybeSingle()
    return data
  }
  const getTx = async (id: string) => (await db.from('payment_transactions').select('*').eq('provider', 'payme').eq('external_id', id).maybeSingle()).data

  switch (body.method) {
    case 'CheckPerformTransaction': {
      if (p.amount < MIN_AMOUNT || p.amount > MAX_AMOUNT) return fail(ERR.amount)
      const s = await findStudent(p.account)
      if (!s || s.status === 'left') return fail(ERR.account)
      return ok({ allow: true, additional: { full_name: s.full_name } })
    }

    case 'CreateTransaction': {
      const existing = await getTx(p.id)
      if (existing) {
        if (existing.state !== 1) return fail(ERR.cantPerform)
        if (Date.now() - existing.create_time > TIMEOUT) {
          await db.from('payment_transactions').update({ state: -1, reason: 4, cancel_time: Date.now() }).eq('id', existing.id)
          return fail(ERR.cantPerform)
        }
        return ok({ create_time: existing.create_time, transaction: existing.id, state: existing.state })
      }
      if (p.amount < MIN_AMOUNT || p.amount > MAX_AMOUNT) return fail(ERR.amount)
      const s = await findStudent(p.account)
      if (!s || s.status === 'left') return fail(ERR.account)
      const { data, error } = await db
        .from('payment_transactions')
        .insert({ provider: 'payme', external_id: p.id, student_id: s.id, amount: p.amount / 100, state: 1, create_time: p.time ?? Date.now(), raw: p })
        .select()
        .single()
      if (error) return fail(ERR.cantPerform)
      return ok({ create_time: data.create_time, transaction: data.id, state: 1 })
    }

    case 'PerformTransaction': {
      const tx = await getTx(p.id)
      if (!tx) return fail(ERR.notFound)
      if (tx.state === 2) return ok({ transaction: tx.id, perform_time: tx.perform_time, state: 2 })
      if (tx.state !== 1) return fail(ERR.cantPerform)
      if (Date.now() - tx.create_time > TIMEOUT) {
        await db.from('payment_transactions').update({ state: -1, reason: 4, cancel_time: Date.now() }).eq('id', tx.id)
        return fail(ERR.cantPerform)
      }
      const perform_time = Date.now()
      const today = todayTashkent()
      const { data: pay, error } = await db
        .from('payments')
        .insert({ student_id: tx.student_id, amount: tx.amount, method: 'payme', paid_at: today, month: today.slice(0, 7), status: 'completed', external_id: p.id, note: 'Payme' })
        .select()
        .single()
      if (error) return fail(ERR.cantPerform)
      await db.from('payment_transactions').update({ state: 2, perform_time, payment_id: pay.id }).eq('id', tx.id)
      await notifyPaid(db, tx.student_id, tx.amount, 'Payme')
      return ok({ transaction: tx.id, perform_time, state: 2 })
    }

    case 'CancelTransaction': {
      const tx = await getTx(p.id)
      if (!tx) return fail(ERR.notFound)
      if (tx.state < 0) return ok({ transaction: tx.id, cancel_time: tx.cancel_time, state: tx.state })
      const cancel_time = Date.now()
      const state = tx.state === 2 ? -2 : -1
      if (tx.state === 2 && tx.payment_id) await db.from('payments').update({ status: 'refunded' }).eq('id', tx.payment_id)
      await db.from('payment_transactions').update({ state, reason: p.reason ?? null, cancel_time }).eq('id', tx.id)
      return ok({ transaction: tx.id, cancel_time, state })
    }

    case 'CheckTransaction': {
      const tx = await getTx(p.id)
      if (!tx) return fail(ERR.notFound)
      return ok({
        create_time: tx.create_time,
        perform_time: tx.perform_time ?? 0,
        cancel_time: tx.cancel_time ?? 0,
        transaction: tx.id,
        state: tx.state,
        reason: tx.reason ?? null,
      })
    }

    case 'GetStatement': {
      const { data } = await db
        .from('payment_transactions')
        .select('*')
        .eq('provider', 'payme')
        .gte('create_time', p.from)
        .lte('create_time', p.to)
        .order('create_time')
      return ok({
        transactions: (data ?? []).map((tx) => ({
          id: tx.external_id,
          time: tx.raw?.time ?? tx.create_time,
          amount: Math.round(tx.amount * 100),
          account: { student_id: tx.student_id },
          create_time: tx.create_time,
          perform_time: tx.perform_time ?? 0,
          cancel_time: tx.cancel_time ?? 0,
          transaction: tx.id,
          state: tx.state,
          reason: tx.reason ?? null,
        })),
      })
    }

    default:
      return fail(ERR.method)
  }
})

async function notifyPaid(db: ReturnType<typeof adminClient>, studentId: string, amount: number, provider: string) {
  const { data: s } = await db.from('students').select('full_name, phone, telegram_chat_id').eq('id', studentId).single()
  if (!s) return
  await db.from('notifications').insert({ roles: ['owner', 'admin', 'accountant', 'reception'], title: `${provider}: ${money(amount)}`, body: s.full_name, link: '/finance/payments' })
  await db.rpc('queue_trigger', { p_trigger: 'payment_received', p_phone: s.phone, p_chat: s.telegram_chat_id, p_name: s.full_name, p_vars: { amount: money(amount) } })
}
