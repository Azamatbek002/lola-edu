// pay-core.ts uchun Supabase "store" (service role — RLS'ni chetlab o'tadi, faqat serverda)
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { money, todayTashkent } from './util.ts'
import type { Fiscal, PayStore, PayStudent, PayTx } from './pay-core.ts'

const UUID = /^[0-9a-f-]{36}$/i

export function supabasePayStore(db: SupabaseClient): PayStore {
  return {
    async findStudent(account) {
      const q = db.from('students').select('id, full_name, status, pay_code')
      const { data } = await (UUID.test(account) ? q.eq('id', account) : q.eq('pay_code', account)).maybeSingle()
      return (data as PayStudent | null) ?? null
    },

    async getTx(provider, externalId) {
      if (!externalId) return null
      const { data } = await db.from('payment_transactions').select('*').eq('provider', provider).eq('external_id', externalId).maybeSingle()
      return data ? norm(data) : null
    },

    async insertTx(tx) {
      const { data, error } = await db.from('payment_transactions').insert(tx).select().single()
      if (error) {
        // Bir vaqtda kelgan takroriy so'rov: mavjud yozuvni qaytaramiz
        if (error.code === '23505') return this.getTx(tx.provider, tx.external_id)
        console.error('insertTx', error.message)
        return null
      }
      return norm(data)
    },

    async updateTx(id, patch) {
      const { error } = await db.from('payment_transactions').update(patch).eq('id', id)
      if (error) throw new Error(error.message)
    },

    async createPayment({ student_id, amount, method, external_id }) {
      const { data: s } = await db.from('students').select('branch_id').eq('id', student_id).maybeSingle()
      const today = todayTashkent()
      const { data, error } = await db
        .from('payments')
        .insert({
          student_id,
          amount,
          method,
          paid_at: today,
          month: today.slice(0, 7),
          status: 'completed',
          external_id,
          branch_id: s?.branch_id ?? null,
          note: method === 'payme' ? 'Payme (onlayn)' : 'Click (onlayn)',
        })
        .select('id')
        .single()
      if (!error) return data.id as string
      if (error.code === '23505') {
        const { data: ex } = await db.from('payments').select('id').eq('method', method).eq('external_id', external_id).maybeSingle()
        return (ex?.id as string) ?? null
      }
      console.error('createPayment', error.message)
      return null
    },

    async refundPayment(paymentId) {
      const { error } = await db.from('payments').update({ status: 'refunded' }).eq('id', paymentId)
      if (error) throw new Error(error.message)
    },

    async listTx(provider, from, to, isTest) {
      const { data } = await db
        .from('payment_transactions')
        .select('*')
        .eq('provider', provider)
        .eq('is_test', isTest)
        .gte('create_time', from)
        .lte('create_time', to)
        .order('create_time')
      return (data ?? []).map(norm)
    },

    async notifyPaid(studentId, amount, provider) {
      const { data: s } = await db
        .from('students')
        .select('full_name, phone, telegram_chat_id, parent_phone, parent_telegram_chat_id')
        .eq('id', studentId)
        .maybeSingle()
      if (!s) return
      await db.from('notifications').insert({
        roles: ['owner', 'admin', 'accountant', 'reception'],
        title: `${provider}: ${money(amount)}`,
        body: s.full_name,
        link: '/finance/payments',
      })
      await db.rpc('queue_trigger', {
        p_trigger: 'payment_received',
        p_phone: s.parent_phone || s.phone,
        p_chat: s.parent_telegram_chat_id || s.telegram_chat_id,
        p_name: s.full_name,
        p_vars: { amount: money(amount) },
      })
    },

    async fiscal() {
      const { data } = await db.from('settings').select('value').eq('key', 'online_pay').maybeSingle()
      const v = (data?.value ?? {}) as Record<string, unknown>
      const mxik = String(v.mxik ?? '').trim()
      if (!mxik) return null
      return {
        mxik,
        package_code: String(v.package_code ?? '').trim(),
        vat_percent: Number(v.vat_percent ?? 0) || 0,
        title: String(v.receipt_title ?? "Ta'lim xizmati (turk tili kursi)"),
      } satisfies Fiscal
    },
  }
}

function norm(r: Record<string, unknown>): PayTx {
  return {
    ...(r as unknown as PayTx),
    seq: Number(r.seq),
    amount: Number(r.amount),
    create_time: Number(r.create_time),
    perform_time: r.perform_time == null ? null : Number(r.perform_time),
    cancel_time: r.cancel_time == null ? null : Number(r.cancel_time),
  }
}
