// Payme va Click to'lov mantiqi — bazaga va Deno'ga bog'liq emas, shuning uchun testlanadi
// (src/lib/onlinepay.test.ts). Edge Function'lar (payme/, click/) bu yerga Supabase "store"ni beradi.
//
// Hisob (account) — o'quvchining 6 xonali to'lov raqami (students.pay_code). Eski havolalar uchun UUID ham qabul qilinadi.
// Payme sinov kaliti (sandbox) bilan kelgan so'rovlar tranzaksiya sifatida yoziladi, lekin haqiqiy to'lov yaratilmaydi.

export interface PayStudent {
  id: string
  full_name: string
  status: string
  pay_code: string
}

export interface PayTx {
  id: string
  seq: number
  provider: 'payme' | 'click'
  external_id: string
  student_id: string
  amount: number // so'mda
  state: number
  create_time: number
  perform_time?: number | null
  cancel_time?: number | null
  reason?: number | null
  payment_id?: string | null
  is_test: boolean
  raw?: Record<string, unknown> | null
}

export interface Fiscal {
  mxik: string // IKPU (MXIK) kodi — tasnif.soliq.uz
  package_code: string
  vat_percent: number
  title: string
}

export interface PayStore {
  findStudent(account: string): Promise<PayStudent | null>
  getTx(provider: PayTx['provider'], externalId: string): Promise<PayTx | null>
  insertTx(tx: Omit<PayTx, 'id' | 'seq'>): Promise<PayTx | null>
  updateTx(id: string, patch: Partial<PayTx>): Promise<void>
  /** Haqiqiy to'lov yozuvi (payments). Qaytaradi: to'lov ID yoki null (xato) */
  createPayment(p: { student_id: string; amount: number; method: 'payme' | 'click'; external_id: string }): Promise<string | null>
  refundPayment(paymentId: string): Promise<void>
  listTx(provider: PayTx['provider'], from: number, to: number, isTest: boolean): Promise<PayTx[]>
  notifyPaid(studentId: string, amount: number, provider: string): Promise<void>
  fiscal?(): Promise<Fiscal | null>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Hisob qiymatini tekshirish: 6 xonali raqam yoki UUID */
export function normalizeAccount(v: unknown): string | null {
  const s = String(v ?? '').replace(/\s+/g, '')
  if (/^\d{6}$/.test(s) || UUID.test(s)) return s
  return null
}

/** "Gulshoda Nurova" → "Gulshoda N." (to'lovchiga ko'rsatish uchun) */
export function maskName(full: string): string {
  const [first = '', second = ''] = full.trim().split(/\s+/)
  return second ? `${first} ${second[0]}.` : first
}

const timingSafe = (a: string, b: string) => {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

// ─── Payme Merchant API (JSON-RPC 2.0) ───────────────────────────────────────
// https://developer.help.paycom.uz/protokol-merchant-api/

export const PAYME_TIMEOUT = 43_200_000 // 12 soat
export const PAYME_MIN = 1_000_00 // 1 000 so'm, tiyinda
export const PAYME_MAX = 100_000_000_00 // 100 mln so'm, tiyinda

const msg = (uz: string, ru: string, en: string) => ({ uz, ru, en })
export const PAYME_ERR = {
  auth: { code: -32504, message: msg("Ruxsat yo'q", 'Недостаточно привилегий', 'Insufficient privileges') },
  method: { code: -32601, message: msg('Metod topilmadi', 'Метод не найден', 'Method not found') },
  parse: { code: -32700, message: msg('JSON xato', 'Ошибка парсинга JSON', 'Parse error') },
  request: { code: -32600, message: msg("So'rov noto'g'ri", 'Неверный запрос', 'Invalid request') },
  system: { code: -32400, message: msg('Tizim xatosi', 'Системная ошибка', 'System error') },
  amount: { code: -31001, message: msg("Noto'g'ri summa", 'Неверная сумма', 'Invalid amount') },
  notFound: { code: -31003, message: msg('Tranzaksiya topilmadi', 'Транзакция не найдена', 'Transaction not found') },
  cantCancel: { code: -31007, message: msg("Bekor qilib bo'lmaydi", 'Невозможно отменить транзакцию', 'Unable to cancel') },
  cantPerform: { code: -31008, message: msg("Bajarib bo'lmaydi", 'Невозможно выполнить операцию', 'Unable to perform operation') },
  account: { code: -31050, message: msg("O'quvchi topilmadi", 'Ученик не найден', 'Student not found'), data: 'student_id' },
}

export interface PaymeKeys {
  key: string // asosiy (prod) kassa kaliti
  testKey?: string // sinov (sandbox) kaliti — ishga tushgach o'chiriladi
}

type Rpc = { id?: unknown; method?: string; params?: any }
// deno-lint-ignore no-explicit-any
export type PaymeResponse = { id: unknown; result?: any; error?: any }

/** Payme so'rovini bajarish. Javob har doim HTTP 200 bilan qaytariladi. */
export async function handlePayme(raw: string, authHeader: string | null, keys: PaymeKeys, store: PayStore, now = Date.now()): Promise<PaymeResponse> {
  let body: Rpc
  try {
    body = JSON.parse(raw)
  } catch {
    return { error: PAYME_ERR.parse, id: null }
  }
  const id = body?.id ?? null
  const fail = (error: unknown): PaymeResponse => ({ error, id })
  const ok = (result: unknown): PaymeResponse => ({ result, id })

  // Avtorizatsiya: Basic base64("Paycom:<kalit>")
  const auth = authHeader ?? ''
  const isProd = !!keys.key && timingSafe(auth, 'Basic ' + btoa('Paycom:' + keys.key))
  const isTest = !isProd && !!keys.testKey && timingSafe(auth, 'Basic ' + btoa('Paycom:' + keys.testKey))
  if (!isProd && !isTest) return fail(PAYME_ERR.auth)
  if (!body || typeof body.method !== 'string' || typeof body.params !== 'object' || body.params === null) return fail(PAYME_ERR.request)

  const p = body.params
  const validAmount = (a: unknown) => typeof a === 'number' && Number.isFinite(a) && a >= PAYME_MIN && a <= PAYME_MAX

  const student = async () => {
    const acc = normalizeAccount(p.account?.student_id)
    if (!acc) return null
    const s = await store.findStudent(acc)
    return s && s.status !== 'left' ? s : null
  }
  const timedOut = (tx: PayTx) => now - tx.create_time > PAYME_TIMEOUT

  try {
    switch (body.method) {
      case 'CheckPerformTransaction': {
        if (!validAmount(p.amount)) return fail(PAYME_ERR.amount)
        const s = await student()
        if (!s) return fail(PAYME_ERR.account)
        const result: Record<string, unknown> = { allow: true, additional: { student: maskName(s.full_name), code: s.pay_code } }
        const f = await store.fiscal?.()
        if (f?.mxik) {
          result.detail = {
            receipt_type: 0,
            items: [{ title: f.title, price: p.amount, count: 1, code: f.mxik, package_code: f.package_code, vat_percent: f.vat_percent }],
          }
        }
        return ok(result)
      }

      case 'CreateTransaction': {
        if (typeof p.id !== 'string' || !p.id) return fail(PAYME_ERR.request)
        const existing = await store.getTx('payme', p.id)
        if (existing) {
          if (existing.state !== 1) return fail(PAYME_ERR.cantPerform)
          if (timedOut(existing)) {
            await store.updateTx(existing.id, { state: -1, reason: 4, cancel_time: now })
            return fail(PAYME_ERR.cantPerform)
          }
          return ok({ create_time: existing.create_time, transaction: existing.id, state: existing.state })
        }
        if (!validAmount(p.amount)) return fail(PAYME_ERR.amount)
        const s = await student()
        if (!s) return fail(PAYME_ERR.account)
        const tx = await store.insertTx({
          provider: 'payme',
          external_id: p.id,
          student_id: s.id,
          amount: p.amount / 100,
          state: 1,
          create_time: now,
          is_test: isTest,
          raw: { time: p.time, account: p.account },
        })
        if (!tx) return fail(PAYME_ERR.system)
        return ok({ create_time: tx.create_time, transaction: tx.id, state: 1 })
      }

      case 'PerformTransaction': {
        const tx = await store.getTx('payme', String(p.id ?? ''))
        if (!tx) return fail(PAYME_ERR.notFound)
        if (tx.state === 2) return ok({ transaction: tx.id, perform_time: tx.perform_time, state: 2 })
        if (tx.state !== 1) return fail(PAYME_ERR.cantPerform)
        if (timedOut(tx)) {
          await store.updateTx(tx.id, { state: -1, reason: 4, cancel_time: now })
          return fail(PAYME_ERR.cantPerform)
        }
        let paymentId: string | null = null
        if (!tx.is_test) {
          paymentId = await store.createPayment({ student_id: tx.student_id, amount: tx.amount, method: 'payme', external_id: tx.external_id })
          if (!paymentId) return fail(PAYME_ERR.cantPerform)
        }
        await store.updateTx(tx.id, { state: 2, perform_time: now, payment_id: paymentId })
        if (!tx.is_test) await store.notifyPaid(tx.student_id, tx.amount, 'Payme').catch(() => undefined)
        return ok({ transaction: tx.id, perform_time: now, state: 2 })
      }

      case 'CancelTransaction': {
        const tx = await store.getTx('payme', String(p.id ?? ''))
        if (!tx) return fail(PAYME_ERR.notFound)
        if (tx.state < 0) return ok({ transaction: tx.id, cancel_time: tx.cancel_time, state: tx.state })
        const state = tx.state === 2 ? -2 : -1
        if (state === -2 && tx.payment_id) await store.refundPayment(tx.payment_id)
        await store.updateTx(tx.id, { state, reason: typeof p.reason === 'number' ? p.reason : null, cancel_time: now })
        return ok({ transaction: tx.id, cancel_time: now, state })
      }

      case 'CheckTransaction': {
        const tx = await store.getTx('payme', String(p.id ?? ''))
        if (!tx) return fail(PAYME_ERR.notFound)
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
        const list = await store.listTx('payme', Number(p.from) || 0, Number(p.to) || 0, isTest)
        return ok({
          transactions: list.map((tx) => ({
            id: tx.external_id,
            time: Number((tx.raw as any)?.time) || tx.create_time,
            amount: Math.round(tx.amount * 100),
            account: (tx.raw as any)?.account ?? { student_id: tx.student_id },
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
        return fail(PAYME_ERR.method)
    }
  } catch {
    return fail(PAYME_ERR.system)
  }
}

// ─── Click SHOP API: Prepare (action=0) va Complete (action=1) ───────────────
// https://docs.click.uz/click-api-request/

export interface ClickConfig {
  secret: string
  serviceId: string
}

export const CLICK_ERR = {
  ok: [0, 'Success'],
  sign: [-1, 'SIGN CHECK FAILED!'],
  amount: [-2, 'Incorrect parameter amount'],
  action: [-3, 'Action not found'],
  paid: [-4, 'Already paid'],
  user: [-5, 'User does not exist'],
  tx: [-6, 'Transaction does not exist'],
  update: [-7, 'Failed to update user'],
  request: [-8, 'Error in request from click'],
  cancelled: [-9, 'Transaction cancelled'],
} as const

/** Click imzosi (sign_string) uchun manba qator */
export function clickSignSource(f: Record<string, string>, secret: string): string {
  return Number(f.action) === 1
    ? `${f.click_trans_id}${f.service_id}${secret}${f.merchant_trans_id}${f.merchant_prepare_id}${f.amount}${f.action}${f.sign_time}`
    : `${f.click_trans_id}${f.service_id}${secret}${f.merchant_trans_id}${f.amount}${f.action}${f.sign_time}`
}

export async function handleClick(
  f: Record<string, string>,
  cfg: ClickConfig,
  store: PayStore,
  md5: (s: string) => Promise<string>,
  now = Date.now(),
): Promise<Record<string, unknown>> {
  const action = Number(f.action)
  const base = { click_trans_id: f.click_trans_id, merchant_trans_id: f.merchant_trans_id }
  const reply = (e: readonly [number, string], extra: Record<string, unknown> = {}) => ({ ...base, ...extra, error: e[0], error_note: e[1] })

  if (!cfg.secret || !cfg.serviceId || !f.click_trans_id || f.service_id !== cfg.serviceId) return reply(CLICK_ERR.request)
  if (!timingSafe((await md5(clickSignSource(f, cfg.secret))).toLowerCase(), String(f.sign_string ?? '').toLowerCase())) return reply(CLICK_ERR.sign)
  if (action !== 0 && action !== 1) return reply(CLICK_ERR.action)

  const amount = Number(f.amount)
  if (!Number.isFinite(amount) || amount < 1000) return reply(CLICK_ERR.amount)

  try {
    const acc = normalizeAccount(f.merchant_trans_id)
    const student = acc ? await store.findStudent(acc) : null
    if (!student || student.status === 'left') return reply(CLICK_ERR.user)

    const tx = await store.getTx('click', f.click_trans_id)

    if (action === 0) {
      if (tx?.state === 1) return reply(CLICK_ERR.paid)
      if (tx?.state === -1) return reply(CLICK_ERR.cancelled)
      if (tx) return reply(CLICK_ERR.ok, { merchant_prepare_id: tx.seq })
      const created = await store.insertTx({
        provider: 'click',
        external_id: f.click_trans_id,
        student_id: student.id,
        amount,
        state: 0,
        create_time: now,
        is_test: false,
        raw: { click_paydoc_id: f.click_paydoc_id, merchant_trans_id: f.merchant_trans_id, sign_time: f.sign_time },
      })
      if (!created) return reply(CLICK_ERR.update)
      return reply(CLICK_ERR.ok, { merchant_prepare_id: created.seq })
    }

    // Complete
    if (!tx || String(tx.seq) !== String(f.merchant_prepare_id)) return reply(CLICK_ERR.tx)
    if (tx.state === 1) return reply(CLICK_ERR.paid, { merchant_confirm_id: tx.seq })
    if (tx.state === -1) return reply(CLICK_ERR.cancelled)
    if (Math.abs(Number(tx.amount) - amount) > 0.001) return reply(CLICK_ERR.amount)
    if (Number(f.error) < 0) {
      await store.updateTx(tx.id, { state: -1, cancel_time: now, reason: Number(f.error) })
      return reply(CLICK_ERR.cancelled)
    }
    const paymentId = await store.createPayment({ student_id: student.id, amount, method: 'click', external_id: f.click_trans_id })
    if (!paymentId) return reply(CLICK_ERR.update)
    await store.updateTx(tx.id, { state: 1, perform_time: now, payment_id: paymentId })
    await store.notifyPaid(student.id, amount, 'Click').catch(() => undefined)
    return reply(CLICK_ERR.ok, { merchant_confirm_id: tx.seq })
  } catch {
    return reply(CLICK_ERR.update)
  }
}
