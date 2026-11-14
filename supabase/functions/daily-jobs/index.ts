// Kunlik avtomatika: oylik hisob (1-kuni), qarz eslatmalari, tug'ilgan kunlar, sinov darsi eslatmalari.
// pg_cron har kuni 09:00 (Toshkent) da chaqiradi.
import { adminClient, cronAuthorized, json } from '../_shared/util.ts'

Deno.serve(async (req) => {
  if (!(await cronAuthorized(req))) return json({ error: 'forbidden' }, 403)
  const db = adminClient()
  const { data, error } = await db.rpc('run_daily_jobs')
  if (error) return json({ error: error.message }, 500)
  return json(data)
})
