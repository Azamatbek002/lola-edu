// Edge Function'lar uchun umumiy yordamchilar (Deno)
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** Service role mijoz — RLS'ni chetlab o'tadi, faqat server tomonida ishlatiladi */
export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
}

export function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...extra } })
}

export function normalizePhone(p: string): string {
  let d = (p || '').replace(/\D/g, '')
  if (d.length === 9) d = '998' + d
  return d ? '+' + d : ''
}

export function money(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + " so'm"
}

/** Vaqtni doimiy vaqtda solishtirish (timing attack'dan himoya) */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

/** Toshkent vaqti bo'yicha bugungi sana (YYYY-MM-DD) */
export function todayTashkent(): string {
  return new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10)
}
