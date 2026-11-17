// Payme va Click mantiqi (supabase/functions/_shared/pay-core.ts) — Payme sandbox va Click hujjatidagi holatlar
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clickSignSource,
  handleClick,
  handlePayme,
  maskName,
  normalizeAccount,
  PAYME_TIMEOUT,
  type PayStore,
  type PayTx,
} from '../../supabase/functions/_shared/pay-core'

const STUDENT = { id: '11111111-2222-3333-4444-555555555555', full_name: 'Gulshoda Nurova', status: 'active', pay_code: '482913' }
const LEFT = { id: '99999999-2222-3333-4444-555555555555', full_name: 'Ketgan Talaba', status: 'left', pay_code: '700001' }

function memoryStore(opts: { mxik?: string } = {}) {
  const txs: PayTx[] = []
  const payments: { id: string; student_id: string; amount: number; method: string; external_id: string; status: string }[] = []
  const notified: number[] = []
  let seq = 0
  const store: PayStore = {
    async findStudent(acc) {
      return [STUDENT, LEFT].find((s) => s.pay_code === acc || s.id === acc) ?? null
    },
    async getTx(provider, ext) {
      return txs.find((t) => t.provider === provider && t.external_id === ext) ?? null
    },
    async insertTx(tx) {
      const row = { ...tx, id: 'tx-' + (seq + 1), seq: ++seq } as PayTx
      txs.push(row)
      return row
    },
    async updateTx(id, patch) {
      Object.assign(txs.find((t) => t.id === id)!, patch)
    },
    async createPayment(p) {
      const ex = payments.find((x) => x.method === p.method && x.external_id === p.external_id)
      if (ex) return ex.id
      const row = { ...p, id: 'pay-' + (payments.length + 1), status: 'completed' }
      payments.push(row)
      return row.id
    },
    async refundPayment(id) {
      payments.find((p) => p.id === id)!.status = 'refunded'
    },
    async listTx(provider, from, to, isTest) {
      return txs.filter((t) => t.provider === provider && t.is_test === isTest && t.create_time >= from && t.create_time <= to)
    },
    async notifyPaid(_s, amount) {
      notified.push(amount)
    },
    async fiscal() {
      return opts.mxik ? { mxik: opts.mxik, package_code: '1501348', vat_percent: 0, title: "Ta'lim xizmati" } : null
    },
  }
  return { store, txs, payments, notified }
}

// ─── Payme ───────────────────────────────────────────────────────────────────

const KEYS = { key: 'prod-key-123', testKey: 'test-key-456' }
const PROD = 'Basic ' + btoa('Paycom:prod-key-123')
const TEST = 'Basic ' + btoa('Paycom:test-key-456')
const T0 = 1_763_000_000_000

const rpc = (method: string, params: Record<string, unknown>, id = 1) => JSON.stringify({ id, method, params })

describe('Payme: avtorizatsiya va so\'rov', () => {
  it("kalitsiz yoki noto'g'ri kalit — -32504", async () => {
    const { store } = memoryStore()
    expect((await handlePayme(rpc('CheckTransaction', { id: 'x' }), null, KEYS, store)).error.code).toBe(-32504)
    expect((await handlePayme(rpc('CheckTransaction', { id: 'x' }), 'Basic ' + btoa('Paycom:wrong'), KEYS, store)).error.code).toBe(-32504)
    expect((await handlePayme(rpc('CheckTransaction', { id: 'x' }), PROD, { key: '' }, store)).error.code).toBe(-32504)
  })
  it("buzuq JSON — -32700, noma'lum metod — -32601", async () => {
    const { store } = memoryStore()
    expect((await handlePayme('{oops', PROD, KEYS, store)).error.code).toBe(-32700)
    expect((await handlePayme(rpc('Foo', {}), PROD, KEYS, store)).error.code).toBe(-32601)
  })
})

describe('Payme: CheckPerformTransaction', () => {
  it("noto'g'ri summa — -31001", async () => {
    const { store } = memoryStore()
    const r = await handlePayme(rpc('CheckPerformTransaction', { amount: 500, account: { student_id: '482913' } }), PROD, KEYS, store)
    expect(r.error.code).toBe(-31001)
  })
  it("o'quvchi topilmasa yoki ketgan bo'lsa — -31050", async () => {
    const { store } = memoryStore()
    for (const acc of ['000000', 'abc', '', '700001']) {
      const r = await handlePayme(rpc('CheckPerformTransaction', { amount: 50_000_000, account: { student_id: acc } }), PROD, KEYS, store)
      expect(r.error.code).toBe(-31050)
    }
  })
  it('to\'g\'ri — allow va yashirilgan ism; MXIK bo\'lsa chek ma\'lumoti', async () => {
    const { store } = memoryStore({ mxik: '10305008002000000' })
    const r: any = await handlePayme(rpc('CheckPerformTransaction', { amount: 50_000_000, account: { student_id: '482 913' } }), PROD, KEYS, store)
    expect(r.result.allow).toBe(true)
    expect(r.result.additional.student).toBe('Gulshoda N.')
    expect(r.result.detail.items[0]).toMatchObject({ code: '10305008002000000', price: 50_000_000, count: 1 })
  })
})

describe("Payme: to'liq oqim", () => {
  let m: ReturnType<typeof memoryStore>
  beforeEach(() => {
    m = memoryStore()
  })
  const create = (id = 'pm-1', t = T0, student_id = '482913', amount = 50_000_000) =>
    handlePayme(rpc('CreateTransaction', { id, time: t, amount, account: { student_id } }), PROD, KEYS, m.store, t) as Promise<any>

  it('Create → Perform → Check: bitta to\'lov, xabar, takroriy so\'rov xavfsiz', async () => {
    const c1 = await create()
    expect(c1.result.state).toBe(1)
    const c2 = await create()
    expect(c2.result).toEqual(c1.result) // takroriy Create — o'sha tranzaksiya

    const p1: any = await handlePayme(rpc('PerformTransaction', { id: 'pm-1' }), PROD, KEYS, m.store, T0 + 1000)
    expect(p1.result).toMatchObject({ state: 2, perform_time: T0 + 1000 })
    const p2: any = await handlePayme(rpc('PerformTransaction', { id: 'pm-1' }), PROD, KEYS, m.store, T0 + 5000)
    expect(p2.result.perform_time).toBe(T0 + 1000) // o'zgarmaydi
    expect(m.payments).toHaveLength(1)
    expect(m.payments[0]).toMatchObject({ student_id: STUDENT.id, amount: 500_000, method: 'payme', external_id: 'pm-1' })
    expect(m.notified).toEqual([500_000])

    const chk: any = await handlePayme(rpc('CheckTransaction', { id: 'pm-1' }), PROD, KEYS, m.store)
    expect(chk.result).toMatchObject({ create_time: T0, perform_time: T0 + 1000, cancel_time: 0, state: 2, reason: null })
  })

  it('bajarilgandan keyin bekor qilish — state -2 va to\'lov qaytariladi', async () => {
    await create()
    await handlePayme(rpc('PerformTransaction', { id: 'pm-1' }), PROD, KEYS, m.store, T0 + 1000)
    const c: any = await handlePayme(rpc('CancelTransaction', { id: 'pm-1', reason: 5 }), PROD, KEYS, m.store, T0 + 2000)
    expect(c.result).toMatchObject({ state: -2, cancel_time: T0 + 2000 })
    expect(m.payments[0].status).toBe('refunded')
    const again: any = await handlePayme(rpc('CancelTransaction', { id: 'pm-1', reason: 5 }), PROD, KEYS, m.store, T0 + 9000)
    expect(again.result).toMatchObject({ state: -2, cancel_time: T0 + 2000 })
    const chk: any = await handlePayme(rpc('CheckTransaction', { id: 'pm-1' }), PROD, KEYS, m.store)
    expect(chk.result).toMatchObject({ state: -2, reason: 5 })
  })

  it('bajarilmasdan bekor qilish — state -1, keyin Perform — -31008', async () => {
    await create()
    const c: any = await handlePayme(rpc('CancelTransaction', { id: 'pm-1', reason: 3 }), PROD, KEYS, m.store, T0 + 1000)
    expect(c.result.state).toBe(-1)
    const p: any = await handlePayme(rpc('PerformTransaction', { id: 'pm-1' }), PROD, KEYS, m.store, T0 + 2000)
    expect(p.error.code).toBe(-31008)
    expect(m.payments).toHaveLength(0)
  })

  it('12 soatdan keyin — tranzaksiya bekor (reason 4) va -31008', async () => {
    await create()
    const p: any = await handlePayme(rpc('PerformTransaction', { id: 'pm-1' }), PROD, KEYS, m.store, T0 + PAYME_TIMEOUT + 1)
    expect(p.error.code).toBe(-31008)
    expect(m.txs[0]).toMatchObject({ state: -1, reason: 4 })
  })

  it("noma'lum tranzaksiya — -31003; noto'g'ri summa/hisob bilan Create — xato", async () => {
    for (const method of ['PerformTransaction', 'CancelTransaction', 'CheckTransaction']) {
      const r: any = await handlePayme(rpc(method, { id: 'nope', reason: 1 }), PROD, KEYS, m.store)
      expect(r.error.code).toBe(-31003)
    }
    expect((await create('pm-2', T0, '123456')).error.code).toBe(-31050)
    expect((await create('pm-3', T0, '482913', 10)).error.code).toBe(-31001)
  })

  it("sinov kaliti: tranzaksiya bor, lekin haqiqiy to'lov yozilmaydi; GetStatement ajratadi", async () => {
    await handlePayme(rpc('CreateTransaction', { id: 'sb-1', time: T0, amount: 100_000, account: { student_id: '482913' } }), TEST, KEYS, m.store, T0)
    const p: any = await handlePayme(rpc('PerformTransaction', { id: 'sb-1' }), TEST, KEYS, m.store, T0 + 10)
    expect(p.result.state).toBe(2)
    expect(m.payments).toHaveLength(0)
    expect(m.notified).toHaveLength(0)
    await create('pm-9', T0 + 20)

    const sTest: any = await handlePayme(rpc('GetStatement', { from: T0 - 1, to: T0 + 100 }), TEST, KEYS, m.store)
    expect(sTest.result.transactions.map((t: any) => t.id)).toEqual(['sb-1'])
    const sProd: any = await handlePayme(rpc('GetStatement', { from: T0 - 1, to: T0 + 100 }), PROD, KEYS, m.store)
    expect(sProd.result.transactions).toHaveLength(1)
    expect(sProd.result.transactions[0]).toMatchObject({ id: 'pm-9', amount: 50_000_000, state: 1, account: { student_id: '482913' } })
  })
})

// ─── Click ───────────────────────────────────────────────────────────────────

const CFG = { secret: 'click-secret', serviceId: '12345' }
const fakeMd5 = async (s: string) => 'md5(' + s + ')'

async function clickReq(over: Record<string, string>) {
  const f: Record<string, string> = {
    click_trans_id: '9001',
    service_id: '12345',
    click_paydoc_id: '777',
    merchant_trans_id: '482913',
    amount: '300000.00',
    action: '0',
    error: '0',
    error_note: 'Success',
    sign_time: '2026-11-17 10:00:00',
    ...over,
  }
  f.sign_string = await fakeMd5(clickSignSource(f, CFG.secret))
  return f
}

describe('Click', () => {
  it('imzo manbasi hujjatdagidek', () => {
    const f = { click_trans_id: '1', service_id: '2', merchant_trans_id: '3', merchant_prepare_id: '4', amount: '5', action: '1', sign_time: '6' }
    expect(clickSignSource(f, 'S')).toBe('12S34516')
    expect(clickSignSource({ ...f, action: '0' }, 'S')).toBe('12S3506')
  })

  it("noto'g'ri imzo — -1, boshqa xizmat — -8, noma'lum action — -3", async () => {
    const { store } = memoryStore()
    const bad = { ...(await clickReq({})), sign_string: 'xxx' }
    expect((await handleClick(bad, CFG, store, fakeMd5)).error).toBe(-1)
    expect((await handleClick(await clickReq({ service_id: '999' }), CFG, store, fakeMd5)).error).toBe(-8)
    expect((await handleClick(await clickReq({ action: '5' }), CFG, store, fakeMd5)).error).toBe(-3)
  })

  it("o'quvchi topilmasa — -5, kichik summa — -2", async () => {
    const { store } = memoryStore()
    expect((await handleClick(await clickReq({ merchant_trans_id: '000000' }), CFG, store, fakeMd5)).error).toBe(-5)
    expect((await handleClick(await clickReq({ amount: '10' }), CFG, store, fakeMd5)).error).toBe(-2)
  })

  it('Prepare → Complete: bitta to\'lov; takroriy Complete — -4', async () => {
    const m = memoryStore()
    const prep = await handleClick(await clickReq({}), CFG, m.store, fakeMd5)
    expect(prep).toMatchObject({ error: 0, merchant_prepare_id: 1, click_trans_id: '9001', merchant_trans_id: '482913' })
    const prep2 = await handleClick(await clickReq({}), CFG, m.store, fakeMd5)
    expect(prep2.merchant_prepare_id).toBe(1)

    const done = await handleClick(await clickReq({ action: '1', merchant_prepare_id: '1' }), CFG, m.store, fakeMd5)
    expect(done).toMatchObject({ error: 0, merchant_confirm_id: 1 })
    expect(m.payments).toEqual([expect.objectContaining({ student_id: STUDENT.id, amount: 300_000, method: 'click', external_id: '9001' })])
    expect(m.notified).toEqual([300_000])

    const again = await handleClick(await clickReq({ action: '1', merchant_prepare_id: '1' }), CFG, m.store, fakeMd5)
    expect(again.error).toBe(-4)
    expect(m.payments).toHaveLength(1)
  })

  it("Complete: noto'g'ri prepare ID — -6, summa farq qilsa — -2, Click xatosi — bekor (-9)", async () => {
    const m = memoryStore()
    await handleClick(await clickReq({}), CFG, m.store, fakeMd5)
    expect((await handleClick(await clickReq({ action: '1', merchant_prepare_id: '42' }), CFG, m.store, fakeMd5)).error).toBe(-6)
    expect((await handleClick(await clickReq({ action: '1', merchant_prepare_id: '1', amount: '1000' }), CFG, m.store, fakeMd5)).error).toBe(-2)
    const cancelled = await handleClick(await clickReq({ action: '1', merchant_prepare_id: '1', error: '-5017' }), CFG, m.store, fakeMd5)
    expect(cancelled.error).toBe(-9)
    expect(m.txs[0].state).toBe(-1)
    expect(m.payments).toHaveLength(0)
    // bekor qilingandan keyin qayta Prepare ham rad etiladi
    expect((await handleClick(await clickReq({}), CFG, m.store, fakeMd5)).error).toBe(-9)
  })
})

describe('Yordamchilar', () => {
  it('hisob raqami va ism', () => {
    expect(normalizeAccount(' 482 913 ')).toBe('482913')
    expect(normalizeAccount('48291')).toBeNull()
    expect(normalizeAccount(STUDENT.id)).toBe(STUDENT.id)
    expect(maskName('Gulshoda Nurova')).toBe('Gulshoda N.')
    expect(maskName('Ali')).toBe('Ali')
  })
})
