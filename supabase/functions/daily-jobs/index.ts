// Kunlik avtomatika: oylik hisob (1-kuni), qarz eslatmalari, tug'ilgan kunlar, sinov darsi eslatmalari.
// pg_cron har kuni 09:00 (Toshkent) da chaqiradi.
import { adminClient, json, safeEqual } from '../_shared/util.ts'

const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

Deno.serve(async (req) => {
  if (!CRON_SECRET || !safeEqual(req.headers.get('authorization') ?? '', `Bearer ${CRON_SECRET}`)) return json({ error: 'forbidden' }, 403)
  const db = adminClient()
  const { data, error } = await db.rpc('run_daily_jobs')
  if (error) return json({ error: error.message }, 500)
  return json(data)
})
