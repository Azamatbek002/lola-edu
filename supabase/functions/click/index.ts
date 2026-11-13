// Click SHOP API: Prepare (action=0) va Complete (action=1)
// Hujjat: https://docs.click.uz/click-api-request/
// Kabinetda Prepare URL va Complete URL: https://<project>.supabase.co/functions/v1/click
// merchant_trans_id = student_id
import { crypto } from 'jsr:@std/crypto@1'
import { encodeHex } from 'jsr:@std/encoding@1/hex'
import { adminClient, json, money, safeEqual, todayTashkent } from '../_shared/util.ts'

const SECRET = Deno.env.get('CLICK_SECRET_KEY') ?? ''
const SERVICE_ID = Deno.env.get('CLICK_SERVICE_ID') ?? ''

async function md5(s: string) {
  return encodeHex(await crypto.subtle.digest('MD5', new TextEncoder().encode(s)))
}

Deno.serve(async (req) => {
  const form = await req.formData().catch(() => null)
  if (!form) return json({ error: -8, error_note: 'Error in request from click' })
  const f = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]))
  const action = Number(f.action)
  const base = { click_trans_id: f.click_trans_id, merchant_trans_id: f.merchant_trans_id }
  const reply = (error: number, error_note: string, extra: Record<string, unknown> = {}) => json({ ...base, ...extra, error, error_note })

  if (!SECRET || f.service_id !== SERVICE_ID) return reply(-8, 'Error in request from click')
  const signSrc =
    action === 0
      ? `${f.click_trans_id}${f.service_id}${SECRET}${f.merchant_trans_id}${f.amount}${f.action}${f.sign_time}`
      : `${f.click_trans_id}${f.service_id}${SECRET}${f.merchant_trans_id}${f.merchant_prepare_id}${f.amount}${f.action}${f.sign_time}`
  if (!safeEqual(await md5(signSrc), f.sign_string ?? '')) return reply(-1, 'SIGN CHECK FAILED!')
  if (action !== 0 && action !== 1) return reply(-3, 'Action not found')

  const db = adminClient()
  const amount = Number(f.amount)
  if (!(amount >= 1000)) return reply(-2, 'Incorrect parameter amount')

  const { data: student } = /^[0-9a-f-]{36}$/i.test(f.merchant_trans_id ?? '')
    ? await db.from('students').select('id, full_name, phone, telegram_chat_id, status').eq('id', f.merchant_trans_id).maybeSingle()
    : { data: null }
  if (!student || student.status === 'left') return reply(-5, 'User does not exist')

  const { data: tx } = await db.from('payment_transactions').select('*').eq('provider', 'click').eq('external_id', f.click_trans_id).maybeSingle()

  if (action === 0) {
    if (tx?.state === 1) return reply(-4, 'Already paid')
    if (tx) return reply(0, 'Success', { merchant_prepare_id: tx.id })
    const { data, error } = await db
      .from('payment_transactions')
      .insert({ provider: 'click', external_id: f.click_trans_id, student_id: student.id, amount, state: 0, create_time: Date.now(), raw: f })
      .select()
      .single()
    if (error) return reply(-7, 'Failed to update user')
    return reply(0, 'Success', { merchant_prepare_id: data.id })
  }

  // Complete
  if (!tx || tx.id !== f.merchant_prepare_id) return reply(-6, 'Transaction does not exist')
  if (tx.state === 1) return reply(-4, 'Already paid', { merchant_confirm_id: tx.payment_id })
  if (tx.state === -1) return reply(-9, 'Transaction cancelled')
  if (Number(tx.amount) !== amount) return reply(-2, 'Incorrect parameter amount')
  if (Number(f.error) < 0) {
    await db.from('payment_transactions').update({ state: -1, cancel_time: Date.now(), reason: Number(f.error) }).eq('id', tx.id)
    return reply(-9, 'Transaction cancelled')
  }
  const today = todayTashkent()
  const { data: pay, error } = await db
    .from('payments')
    .insert({ student_id: student.id, amount, method: 'click', paid_at: today, month: today.slice(0, 7), status: 'completed', external_id: f.click_trans_id, note: 'Click' })
    .select()
    .single()
  if (error) return reply(-7, 'Failed to update user')
  await db.from('payment_transactions').update({ state: 1, perform_time: Date.now(), payment_id: pay.id }).eq('id', tx.id)
  await db.from('notifications').insert({ roles: ['owner', 'admin', 'accountant', 'reception'], title: `Click: ${money(amount)}`, body: student.full_name, link: '/finance/payments' })
  await db.rpc('queue_trigger', { p_trigger: 'payment_received', p_phone: student.phone, p_chat: student.telegram_chat_id, p_name: student.full_name, p_vars: { amount: money(amount) } })
  return reply(0, 'Success', { merchant_confirm_id: pay.id })
})
