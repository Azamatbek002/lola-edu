// Click SHOP API: Prepare (action=0) va Complete (action=1). Mantiq: ../_shared/pay-core.ts (testlar: src/lib/onlinepay.test.ts)
// Click Merchant kabinetida Prepare URL va Complete URL: https://vowncclaomnzxbadedkm.supabase.co/functions/v1/click
// merchant_trans_id — o'quvchining 6 xonali to'lov raqami.
// Kalitlar (Supabase Secrets): CLICK_SECRET_KEY, CLICK_SERVICE_ID.
import { crypto } from 'jsr:@std/crypto@1'
import { encodeHex } from 'jsr:@std/encoding@1/hex'
import { adminClient, json } from '../_shared/util.ts'
import { handleClick } from '../_shared/pay-core.ts'
import { supabasePayStore } from '../_shared/pay-store.ts'

const md5 = async (s: string) => encodeHex(await crypto.subtle.digest('MD5', new TextEncoder().encode(s)))

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: true, service: 'click' })
  // Click application/x-www-form-urlencoded yuboradi
  let f: Record<string, string> = {}
  const type = req.headers.get('content-type') ?? ''
  try {
    if (type.includes('application/json')) f = Object.fromEntries(Object.entries(await req.json()).map(([k, v]) => [k, String(v)]))
    else f = Object.fromEntries([...(await req.formData()).entries()].map(([k, v]) => [k, String(v)]))
  } catch {
    return json({ error: -8, error_note: 'Error in request from click' })
  }
  const res = await handleClick(
    f,
    { secret: Deno.env.get('CLICK_SECRET_KEY') ?? '', serviceId: Deno.env.get('CLICK_SERVICE_ID') ?? '' },
    supabasePayStore(adminClient()),
    md5,
  )
  return json(res)
})
