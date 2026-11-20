// Payme Merchant API (JSON-RPC 2.0). Mantiq: ../_shared/pay-core.ts (testlar: src/lib/onlinepay.test.ts)
// Payme Business kabinetida endpoint: https://vowncclaomnzxbadedkm.supabase.co/functions/v1/payme
// Hisob maydoni: student_id — o'quvchining 6 xonali to'lov raqami. Summa tiyinlarda keladi.
// Kalitlar (Supabase Secrets): PAYME_KEY — asosiy kalit, PAYME_TEST_KEY — sinov kaliti (sandbox; ishga tushgach o'chiriladi).
import { adminClient, json } from '../_shared/util.ts'
import { handlePayme } from '../_shared/pay-core.ts'
import { supabasePayStore } from '../_shared/pay-store.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: true, service: 'payme' })
  const raw = await req.text()
  const res = await handlePayme(
    raw,
    req.headers.get('authorization'),
    { key: Deno.env.get('PAYME_KEY') ?? '', testKey: Deno.env.get('PAYME_TEST_KEY') ?? '' },
    supabasePayStore(adminClient()),
  )
  return json(res)
})
